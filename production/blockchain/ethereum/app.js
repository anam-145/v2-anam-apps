// ================================================================
// Ethereum Adapter 구현
// EthereumAdapter 클래스만 포함 (공통 코드는 템플릿 참조)
// ================================================================

// Ethereum 어댑터 설정 (네트워크 설정은 utils/config.js에서 가져옴)
const EthereumAdapterConfig = {
  // 기본 정보
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  
  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get rpcEndpoint() {
      return window.EthereumConfig?.rpcEndpoint || "";
    },
    get networkName() {
      return window.EthereumConfig?.getActiveNetwork() || "mainnet";
    },
    get chainId() {
      return window.EthereumConfig?.chainId || 1;
    }
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#627EEA",      // 이더리움 메인 색상
    secondaryColor: "#8198F9",    // 이더리움 보조 색상  
    logoText: "Ethereum",
  },
  
  // 주소 설정
  address: {
    // 주소 형식 정규식 (검증용)
    regex: /^0x[a-fA-F0-9]{40}$/,
    // 주소 표시 형식
    displayFormat: "0x...",
  },
  
  // 트랜잭션 설정 (config.js에서 가져옴)
  transaction: {
    defaultGasLimit: window.EthereumConfig?.TRANSACTION?.DEFAULT_GAS_LIMIT || 21000,
    defaultGasPrice: window.EthereumConfig?.TRANSACTION?.DEFAULT_GAS_PRICE || "20",
    minAmount: window.EthereumConfig?.TRANSACTION?.MIN_AMOUNT || "0.000001",
    confirmationTime: window.EthereumConfig?.TRANSACTION?.CONFIRMATION_TIME || 15000,
  },
  
  // 기타 옵션
  options: {
    // 니모닉 지원 여부
    supportsMnemonic: true,
    // 토큰 지원 여부  
    supportsTokens: true,
    // QR 코드 지원
    supportsQRCode: true,
  },
};

// ================================================================
// EthereumAdapter 클래스 구현
// ================================================================

class EthereumAdapter {
  constructor(config) {
    this.config = config || EthereumAdapterConfig;
    this.provider = null;
  }

  // Provider 초기화
  async initProvider() {
    if (!this.provider && typeof ethers !== 'undefined') {
      // 현재 네트워크 설정 가져오기
      const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
      if (currentNetwork) {
        this.provider = new ethers.providers.JsonRpcProvider(
          currentNetwork.rpcEndpoint,
          currentNetwork.chainId
        );
      }
    }
    return this.provider;
  }

  // Provider 재초기화 (네트워크 변경 시)
  async reinitProvider() {
    console.log('Provider 재초기화 중...');
    this.provider = null; // 기존 provider 제거
    await this.initProvider(); // 새로운 provider 생성
    return this.provider;
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  async generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase
    };
  }

  async importFromMnemonic(mnemonic) {
    try {
      const wallet = ethers.Wallet.fromMnemonic(mnemonic);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      throw new Error("Invalid mnemonic: " + error.message);
    }
  }

  async importFromPrivateKey(privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return {
        address: wallet.address
      };
    } catch (error) {
      throw new Error("Invalid private key: " + error.message);
    }
  }

  isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  async getBalance(address) {
    await this.initProvider();
    const balance = await this.provider.getBalance(address);
    
    return balance.toString(); // Wei 단위 BigNumber를 문자열로
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  async sendTransaction(params) {
    await this.initProvider();
    
    const wallet = new ethers.Wallet(params.privateKey, this.provider);
    
    // 기본 트랜잭션 객체
    const tx = {
      to: params.to,
      value: ethers.utils.parseEther(params.amount),
      gasLimit: params.gasLimit || this.config.transaction.defaultGasLimit
    };
    
    // 데이터 추가 (컨트랙트 호출)
    if (params.data) {
      tx.data = params.data;
    }
    
    // EIP-1559 트랜잭션 (maxFeePerGas, maxPriorityFeePerGas)
    if (params.maxFeePerGas) {
      tx.maxFeePerGas = params.maxFeePerGas;
      tx.maxPriorityFeePerGas = params.maxPriorityFeePerGas || params.maxFeePerGas;
      console.log('[EthereumAdapter] Using EIP-1559 gas:', {
        maxFeePerGas: params.maxFeePerGas,
        maxPriorityFeePerGas: params.maxPriorityFeePerGas
      });
    } 
    // Legacy 트랜잭션 (gasPrice)
    else if (params.gasPrice) {
      tx.gasPrice = ethers.utils.parseUnits(params.gasPrice, 'gwei');
      console.log('[EthereumAdapter] Using legacy gas price:', params.gasPrice);
    }
    // 가스 설정이 없으면 기본값 사용
    else {
      tx.gasPrice = ethers.utils.parseUnits(this.config.transaction.defaultGasPrice, 'gwei');
      console.log('[EthereumAdapter] Using default gas price:', this.config.transaction.defaultGasPrice);
    }
    
    console.log('[EthereumAdapter] Sending transaction:', {
      to: tx.to,
      value: ethers.utils.formatEther(tx.value),
      gasLimit: tx.gasLimit,
      dataLength: tx.data ? tx.data.length : 0
    });
    
    const transaction = await wallet.sendTransaction(tx);
    
    console.log('[EthereumAdapter] Transaction sent:', transaction.hash);
    
    return {
      hash: transaction.hash
    };
  }

  async getTransactionStatus(txHash) {
    await this.initProvider();
    
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        status: 'pending',
        confirmations: 0
      };
    }
    
    const currentBlock = await this.provider.getBlockNumber();
    
    return {
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      confirmations: currentBlock - receipt.blockNumber
    };
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  async getGasPrice() {
    await this.initProvider();
    
    const gasPrice = await this.provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
    
    return {
      low: (parseFloat(gasPriceGwei) * 0.8).toFixed(2),
      medium: gasPriceGwei,
      high: (parseFloat(gasPriceGwei) * 1.5).toFixed(2)
    };
  }

  async estimateFee(txParams) {
    await this.initProvider();
    
    const gasLimit = txParams.gasLimit || this.config.transaction.defaultGasLimit;
    const gasPrice = await this.provider.getGasPrice();
    
    const fee = gasPrice.mul(gasLimit);
    return ethers.utils.formatEther(fee);
  }

  /* ================================================================
   * 5. 이더리움 특화 기능
   * ================================================================ */

  // 현재 블록 번호 조회
  async getBlockNumber() {
    await this.initProvider();
    return await this.provider.getBlockNumber();
  }

  // 네트워크 정보 조회
  async getNetwork() {
    await this.initProvider();
    return await this.provider.getNetwork();
  }

  // ENS 이름 해석
  async resolveENS(ensName) {
    await this.initProvider();
    try {
      const address = await this.provider.resolveName(ensName);
      return address;
    } catch (error) {
      return null;
    }
  }

  // 트랜잭션 내역 조회 (Etherscan API 사용)
  async getTransactionHistory(address, apiKey) {
    const network = window.EthereumConfig?.getCurrentNetwork();
    const ETHERSCAN_BASE_URL = network?.blockExplorer?.apiUrl || "https://api-sepolia.etherscan.io/api";
    
    try {
      const response = await fetch(
        `${ETHERSCAN_BASE_URL}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apiKey=${apiKey}`
      );
      
      const data = await response.json();
      
      if (data.status === "1") {
        return data.result;
      } else {
        console.log("트랜잭션 없음 또는 API 에러:", data.message);
        return [];
      }
    } catch (error) {
      console.log("트랜잭션 내역 조회 실패:", error);
      return [];
    }
  }
}

// ================================================================
// 전역 설정 및 초기화
// ================================================================

// 전역 설정 접근자
window.CoinConfig = EthereumAdapterConfig;
window.getConfig = () => EthereumAdapterConfig;

// Ethereum Adapter 인스턴스 생성 및 등록
const ethereumAdapter = new EthereumAdapter(EthereumAdapterConfig);
window.getAdapter = () => ethereumAdapter;

// 네트워크 변경 이벤트 리스너
window.addEventListener('networkChanged', async () => {
  console.log('[EthereumAdapter] 네트워크 변경됨');
  await ethereumAdapter.reinitProvider();
  
  // 모든 페이지에 provider 업데이트 알림
  window.dispatchEvent(new Event('providerUpdated'));
});

console.log("[EthereumAdapter] 모듈 로드 완료");