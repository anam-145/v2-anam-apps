// ================================================================
// Liberia Adapter 구현 (Base Chain)
// deriveKey API 사용 - 니모닉 관리 불필요
// ================================================================

const LiberiaAdapterConfig = {
  // 기본 정보
  name: "Liberia",
  symbol: "ETH",
  decimals: 18,

  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get rpcEndpoint() {
      return window.LiberiaConfig?.rpcEndpoint || "";
    },
    get networkName() {
      return window.LiberiaConfig?.getActiveNetwork() || "sepolia";
    },
    get chainId() {
      return window.LiberiaConfig?.chainId || 8453;
    }
  },

  // UI 테마 설정
  theme: {
    primaryColor: "#0052FF",      // Base 메인 색상 (파란색)
    secondaryColor: "#1652F0",    // Base 보조 색상
    logoText: "Liberia",
  },

  // 주소 설정
  address: {
    regex: /^0x[a-fA-F0-9]{40}$/,
    displayFormat: "0x...",
  },

  // 트랜잭션 설정
  transaction: {
    defaultGasLimit: window.LiberiaConfig?.TRANSACTION?.DEFAULT_GAS_LIMIT || 21000,
    defaultGasPrice: window.LiberiaConfig?.TRANSACTION?.DEFAULT_GAS_PRICE || "0.001",
    minAmount: window.LiberiaConfig?.TRANSACTION?.MIN_AMOUNT || "0.000001",
    confirmationTime: window.LiberiaConfig?.TRANSACTION?.CONFIRMATION_TIME || 2000,
  },

  // 기타 옵션
  options: {
    supportsMnemonic: false,  // deriveKey API 사용 - 모듈 내 니모닉 관리 안함
    supportsTokens: true,
    supportsQRCode: true,
  },
};

// ================================================================
// LiberiaAdapter 클래스 구현
// ================================================================

class LiberiaAdapter {
  constructor(config) {
    this.config = config || LiberiaAdapterConfig;
    this.provider = null;
  }

  async initProvider() {
    if (!this.provider && typeof ethers !== 'undefined') {
      const currentNetwork = window.LiberiaConfig?.getCurrentNetwork();
      if (currentNetwork) {
        this.provider = new ethers.providers.JsonRpcProvider(
          currentNetwork.rpcEndpoint,
          currentNetwork.chainId
        );
      }
    }
    return this.provider;
  }

  async reinitProvider() {
    console.log('[LiberiaAdapter] Provider 재초기화 중...');
    this.provider = null;
    await this.initProvider();
    return this.provider;
  }

  /* ================================================================
   * 1. 지갑 - deriveKey API 사용
   * ================================================================ */

  // deriveKey API v2로 키 파생 (Promise 래퍼)
  // curve: "secp256k1" (Ethereum/EVM) 또는 "ed25519" (Solana/Stellar 등)
  deriveKey(path, curve = "secp256k1") {
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        window.removeEventListener('keyDerived', handler);
        if (event.detail.success) {
          const { privateKey, publicKey, path: derivedPath, curve: derivedCurve } = event.detail;

          // secp256k1의 경우 ethers.js로 address 계산
          let address = null;
          if (curve === "secp256k1" && typeof ethers !== 'undefined') {
            const wallet = new ethers.Wallet(privateKey);
            address = wallet.address;
          }

          resolve({
            address: address,
            privateKey: privateKey,
            publicKey: publicKey,
            path: derivedPath,
            curve: derivedCurve
          });
        } else {
          reject(new Error(event.detail.error));
        }
      };
      window.addEventListener('keyDerived', handler);

      if (window.anamUI && window.anamUI.deriveKey) {
        window.anamUI.deriveKey(path, curve);
      } else {
        window.removeEventListener('keyDerived', handler);
        reject(new Error('deriveKey API not available'));
      }
    });
  }

  // 기본 경로로 지갑 가져오기 (경로, curve 인자 허용)
  async getWallet(path, curve) {
    const targetPath = path || window.LiberiaConfig?.BIP44_PATH || "m/44'/60'/0'/0/0";
    const targetCurve = curve || window.LiberiaConfig?.CURVE || "secp256k1";
    return await this.deriveKey(targetPath, targetCurve);
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
    return balance.toString();
  }

  // ERC20 토큰 잔액 조회
  async getTokenBalance(address, tokenSymbol = "USDC") {
    await this.initProvider();

    const tokenConfig = window.LiberiaConfig?.getTokenConfig(tokenSymbol);
    const decimals = tokenConfig?.decimals || 18;

    const tokenAddress = window.LiberiaConfig?.getTokenAddress(tokenSymbol);
    if (!tokenAddress) {
      console.log(`[LiberiaAdapter] Token ${tokenSymbol} not configured`);
      return { raw: "0", decimals };
    }

    // ERC20 balanceOf ABI
    const erc20Abi = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.Contract(tokenAddress, erc20Abi, this.provider);

    try {
      const balance = await contract.balanceOf(address);
      return { raw: balance.toString(), decimals };
    } catch (error) {
      console.log(`[LiberiaAdapter] Token balance error:`, error);
      return { raw: "0", decimals };
    }
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  async sendTransaction(params) {
    await this.initProvider();

    const wallet = new ethers.Wallet(params.privateKey, this.provider);

    const tx = {
      to: params.to,
      value: ethers.utils.parseEther(params.amount),
      gasLimit: params.gasLimit || this.config.transaction.defaultGasLimit
    };

    if (params.data) {
      tx.data = params.data;
    }

    // EIP-1559 트랜잭션
    if (params.maxFeePerGas) {
      tx.maxFeePerGas = params.maxFeePerGas;
      tx.maxPriorityFeePerGas = params.maxPriorityFeePerGas || params.maxFeePerGas;
    } else if (params.gasPrice) {
      tx.gasPrice = ethers.utils.parseUnits(params.gasPrice, 'gwei');
    } else {
      tx.gasPrice = ethers.utils.parseUnits(this.config.transaction.defaultGasPrice, 'gwei');
    }

    console.log('[LiberiaAdapter] Sending transaction:', {
      to: tx.to,
      value: ethers.utils.formatEther(tx.value),
      gasLimit: tx.gasLimit
    });

    const transaction = await wallet.sendTransaction(tx);
    console.log('[LiberiaAdapter] Transaction sent:', transaction.hash);

    return { hash: transaction.hash };
  }

  // ERC20 토큰 전송
  async sendTokenTransaction(params) {
    await this.initProvider();

    const { to, amount, privateKey, tokenSymbol = "USDC" } = params;

    const tokenConfig = window.LiberiaConfig?.getTokenConfig(tokenSymbol);
    const tokenAddress = window.LiberiaConfig?.getTokenAddress(tokenSymbol);

    if (!tokenAddress) {
      throw new Error(`Token ${tokenSymbol} not configured`);
    }

    const decimals = tokenConfig?.decimals || 18;
    const wallet = new ethers.Wallet(privateKey, this.provider);

    // ERC20 ABI
    const erc20Abi = [
      "function transfer(address to, uint256 amount) returns (bool)"
    ];
    const contract = new ethers.Contract(tokenAddress, erc20Abi, wallet);

    // amount를 토큰 decimals로 변환
    const tokenAmount = ethers.utils.parseUnits(amount, decimals);

    console.log('[LiberiaAdapter] Sending token:', {
      token: tokenSymbol,
      to: to,
      amount: amount,
      tokenAddress: tokenAddress
    });

    const transaction = await contract.transfer(to, tokenAmount);
    console.log('[LiberiaAdapter] Token transaction sent:', transaction.hash);

    return { hash: transaction.hash };
  }

  async getTransactionStatus(txHash) {
    await this.initProvider();

    const receipt = await this.provider.getTransactionReceipt(txHash);

    if (!receipt) {
      return { status: 'pending', confirmations: 0 };
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
      low: (parseFloat(gasPriceGwei) * 0.8).toFixed(6),
      medium: gasPriceGwei,
      high: (parseFloat(gasPriceGwei) * 1.5).toFixed(6)
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
   * 5. 유틸리티
   * ================================================================ */

  async getBlockNumber() {
    await this.initProvider();
    return await this.provider.getBlockNumber();
  }

  async getNetwork() {
    await this.initProvider();
    return await this.provider.getNetwork();
  }

  async getTransactionHistory(address) {
    const network = window.LiberiaConfig?.getCurrentNetwork();
    const apiUrl = network?.explorerApiUrl;
    const apiKey = window.LiberiaConfig?.API_KEYS?.BASESCAN;

    try {
      const response = await fetch(
        `${apiUrl}?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
      );

      const data = await response.json();

      if (data.status === "1") {
        return data.result;
      }
      return [];
    } catch (error) {
      console.log("트랜잭션 내역 조회 실패:", error);
      return [];
    }
  }

  // ERC20 토큰 전송 히스토리 조회 (Etherscan V2 API 사용 - 모든 EVM 체인 지원)
  async getTokenTransactionHistory(address, tokenSymbol = "USDC") {
    const tokenAddress = window.LiberiaConfig?.getTokenAddress(tokenSymbol);
    const tokenConfig = window.LiberiaConfig?.getTokenConfig(tokenSymbol);
    const network = window.LiberiaConfig?.getCurrentNetwork();
    const chainId = network?.chainId;
    const apiKey = window.LiberiaConfig?.API_KEYS?.ETHERSCAN;

    console.log('[LiberiaAdapter] Token history request:', { tokenSymbol, tokenAddress, chainId });

    if (!tokenAddress) {
      console.log(`[LiberiaAdapter] Token ${tokenSymbol} not configured`);
      return [];
    }

    try {
      // Etherscan V2 API로 토큰 히스토리 조회 (chainid로 체인 지정)
      const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=tokentx&contractaddress=${tokenAddress}&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
      console.log('[LiberiaAdapter] Fetching from Etherscan V2:', url);

      const response = await fetch(url);
      const data = await response.json();
      console.log('[LiberiaAdapter] Etherscan V2 response:', data.status, data.message, data.result);

      if (data.status === "1" && data.result) {
        // 결과를 표준 형식으로 변환
        const transactions = data.result.map(tx => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to,
          value: tx.value,
          timeStamp: tx.timeStamp,
          tokenSymbol: tx.tokenSymbol || tokenSymbol,
          tokenDecimal: tx.tokenDecimal || (tokenConfig?.decimals || 6).toString(),
          blockNumber: tx.blockNumber
        }));
        console.log('[LiberiaAdapter] Processed transactions:', transactions.length);
        return transactions;
      }

      // API 실패 시 빈 배열 반환
      console.log('[LiberiaAdapter] Etherscan V2 API returned no results:', data.message);
      return [];

    } catch (error) {
      console.log("[LiberiaAdapter] 토큰 트랜잭션 내역 조회 실패:", error);
      return [];
    }
  }
}

// ================================================================
// 전역 설정 및 초기화
// ================================================================

window.CoinConfig = LiberiaAdapterConfig;
window.getConfig = () => LiberiaAdapterConfig;

const liberiaAdapter = new LiberiaAdapter(LiberiaAdapterConfig);
window.getAdapter = () => liberiaAdapter;

// 네트워크 변경 이벤트 리스너
window.addEventListener('networkChanged', async () => {
  console.log('[LiberiaAdapter] 네트워크 변경됨');
  await liberiaAdapter.reinitProvider();
  window.dispatchEvent(new Event('providerUpdated'));
});

console.log("[LiberiaAdapter] 모듈 로드 완료 - Base Chain");
