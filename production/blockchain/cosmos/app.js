// ================================================================
// Cosmos2 Adapter - Template 기반 구현
// QuickNode RPC 우선 사용, 폴백 지원
// ================================================================

const CosmosAdapterConfig = {
  // 기본 정보
  name: "Cosmos",
  symbol: "ATOM",
  decimals: 6,  // ATOM은 6자리 소수점
  
  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get networkName() {
      return window.CosmosConfig?.getActiveNetwork() || "mainnet";
    },
    get rpcUrl() {
      return window.CosmosConfig?.getRpcUrl();
    },
    get restUrl() {
      return window.CosmosConfig?.getRestUrl();
    },
    get explorerUrl() {
      const network = window.CosmosConfig?.getCurrentNetwork();
      return network?.explorerUrl || "https://www.mintscan.io/cosmos";
    }
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#2E3148",   // Cosmos 보라색
    secondaryColor: "#6F7390", // 보조 색상
    logoText: "Cosmos",
  },
  
  // 트랜잭션 설정 (config.js에서 가져옴)
  transaction: {
    get defaultGas() {
      return window.CosmosConfig?.TRANSACTION?.DEFAULT_GAS || 200000;
    },
    get minAmount() {
      return "0.000001"; // 0.000001 ATOM (1 uatom)
    },
    get confirmationTime() {
      return window.CosmosConfig?.TRANSACTION?.CONFIRMATION_TIME || 10000;
    }
  },
  
};

// ================================================================
// Cosmos Adapter 구현
// ================================================================

class CosmosAdapter {
  constructor(config) {
    this.config = config || CosmosAdapterConfig;

    // ================================================================
    // Cosmos Provider/네트워크 관리
    // ================================================================
    this.client = null;         // StargateClient (읽기 전용)
    this.signingClient = null;  // SigningStargateClient (트랜잭션용)
    this.cosmosJS = window.CosmosJS; // 번들된 CosmosJS 라이브러리

    // 초기화
    this.initializeClient();
  }

  /**
   * RPC 클라이언트 초기화 (폴백 지원)
   */
  async initializeClient() {
    try {
      const rpcUrl = window.CosmosConfig?.getRpcUrl();
      if (this.cosmosJS && rpcUrl) {
        this.client = await this.cosmosJS.connectClient(rpcUrl);
        console.log('[CosmosAdapter] Client connected to:', rpcUrl);
      }
    } catch (error) {
      console.error('[CosmosAdapter] Failed to connect, trying fallback:', error);

      // 폴백 RPC 시도
      const fallbackRpcs = window.CosmosConfig?.getFallbackRpc() || [];
      for (const fallbackUrl of fallbackRpcs) {
        try {
          this.client = await this.cosmosJS.connectClient(fallbackUrl);
          console.log('[CosmosAdapter] Connected to fallback:', fallbackUrl);
          break;
        } catch (e) {
          console.error('[CosmosAdapter] Fallback failed:', e);
        }
      }
    }
  }

  /**
   * Cosmos 체인 정보 가져오기
   */
  getChainInfo() {
    return window.CosmosConfig?.getChainInfo() || {
      chainId: 'cosmoshub-4',
      chainName: 'mainnet',
      bech32Prefix: 'cosmos',
      denom: 'uatom',
      displayDenom: 'atom',
      symbol: 'ATOM',
      decimals: 6
    };
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  /**
   * 새 지갑 생성
   *
   * 📝 개선 메모: Cosmos는 네트워크와 관계없이 같은 주소를 사용하므로
   * Cosmos는 네트워크별로 다른 주소를 사용하지 않습니다.
   */
  async generateWallet() {
    try {
      if (!this.cosmosJS) {
        throw new Error("CosmosJS library not loaded");
      }

      // 니모닉 생성 (12단어)
      const mnemonic = this.cosmosJS.generateMnemonic();

      // HD 지갑 생성 (BIP44 경로: m/44'/118'/0'/0/0)
      const hdWallet = await this.cosmosJS.createHdWalletFromMnemonic(mnemonic);
      const accounts = await hdWallet.getAccounts();
      const address = accounts[0].address;

      // 개인키 추출
      const keyInfo = await this.cosmosJS.getPrivateKeyFromMnemonic(mnemonic);

      console.log("[CosmosAdapter] Wallet generated successfully");

      return {
        mnemonic: mnemonic,
        address: address,
        privateKey: keyInfo.privateKey,
        publicKey: keyInfo.publicKey,
        path: keyInfo.path || "m/44'/118'/0'/0/0",
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("[CosmosAdapter] Failed to generate wallet:", error);
      throw error;
    }
  }

  /**
   * 니모닉으로 지갑 복구
   */
  async importFromMnemonic(mnemonic) {
    try {
      if (!this.cosmosJS) {
        throw new Error("CosmosJS library not loaded");
      }

      // 니모닉 유효성 검증
      if (!this.cosmosJS.validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic phrase. Please check your recovery phrase and try again.");
      }

      // HD 지갑 생성
      const hdWallet = await this.cosmosJS.createHdWalletFromMnemonic(mnemonic);
      const accounts = await hdWallet.getAccounts();
      const address = accounts[0].address;

      // 개인키 추출
      const keyInfo = await this.cosmosJS.getPrivateKeyFromMnemonic(mnemonic);

      console.log("[CosmosAdapter] Wallet imported successfully");

      return {
        mnemonic: mnemonic,
        address: address,
        privateKey: keyInfo.privateKey,
        publicKey: keyInfo.publicKey,
        path: keyInfo.path || "m/44'/118'/0'/0/0",
        createdAt: new Date().toISOString()
      };
    } catch (error) {
      console.error("[CosmosAdapter] Failed to import from mnemonic:", error);
      throw error;
    }
  }


  /**
   * 주소 유효성 검증
   */
  isValidAddress(address) {
    return window.CosmosConfig?.isValidAddress(address) || false;
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  /**
   * 잔액 조회
   *
   * 📝 개선 메모: CosmosJS.getBalance를 사용하여 이미 포맷팅된 값까지 받아옵니다.
   */
  async getBalance(address) {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const balance = await this.cosmosJS.getBalance(this.client, address);

      // 보안: 주소 일부만 표시
      const shortAddress = address.slice(0, 10) + '...' + address.slice(-6);
      console.log(`[CosmosAdapter] Balance for ${shortAddress}:`, balance.formatted, 'ATOM');

      // uatom 단위로 반환 (최소 단위)
      return balance.amount;
    } catch (error) {
      console.error('[CosmosAdapter] Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * 최신 블록 정보 조회
   */
  async getLatestBlock() {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const block = await this.client.getBlock();
      return block;
    } catch (error) {
      console.error('[CosmosAdapter] Failed to get latest block:', error);
      return null;
    }
  }

  /**
   * 트랜잭션 내역 조회 (단순화된 인터페이스)
   */
  async getTransactions(address, limit = 30) {
    return this.getTransactionHistory(address, limit);
  }

  /**
   * 트랜잭션 히스토리 조회
   *
   * 📝 개선 메모: 기존 Cosmos1에는 히스토리 기능이 없었습니다.
   * CosmosJS.getTransactions를 활용하여 구현합니다.
   */
  async getTransactionHistory(address, limit = 30) {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const transactions = await this.cosmosJS.getTransactions(this.client, address, limit);

      console.log(`[CosmosAdapter] Found ${transactions.length} transactions`);
      console.log('[CosmosAdapter] Raw transactions:', transactions);

      // 포맷팅하여 반환 (CosmosJS에서 이미 파싱된 데이터 그대로 전달)
      return transactions.map(tx => ({
        hash: tx.hash,
        height: tx.height,
        timestamp: tx.timestamp,
        gasUsed: tx.gasUsed,
        gasWanted: tx.gasWanted,
        code: tx.code,
        events: tx.events,
        // CosmosJS에서 파싱한 주소와 금액 정보 포함
        from_address: tx.from_address,
        to_address: tx.to_address,
        amount: tx.amount
      }));
    } catch (error) {
      console.error('[CosmosAdapter] Failed to get transaction history:', error);
      // 에러 발생 시 빈 배열 반환
      return [];
    }
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  /**
   * 트랜잭션 전송
   *
   * 📝 개선 메모: UTXO 기반 로직을 Cosmos의 계정 기반으로 전면 수정
   */
  async sendTransaction(params) {
    const { to, amount, privateKey, memo = '' } = params;

    try {
      if (!this.cosmosJS) {
        throw new Error("CosmosJS library not loaded");
      }

      // 개인키로 지갑 객체 생성
      const wallet = await this.cosmosJS.createWalletFromPrivateKey(privateKey);
      const accounts = await wallet.getAccounts();
      const fromAddress = accounts[0].address;

      // 서명 클라이언트 연결
      if (!this.signingClient) {
        const rpcUrl = window.CosmosConfig?.getRpcUrl();
        this.signingClient = await this.cosmosJS.connectSigningClient(rpcUrl, wallet);
      }

      // 금액 변환 (ATOM -> uatom)
      // 📝 개선 메모: CosmosJS.displayToBase를 사용하여 정확한 변환
      const amountInBase = this.cosmosJS.displayToBase(amount);

      // 트랜잭션 전송
      const result = await this.cosmosJS.sendTokens(
        this.signingClient,
        fromAddress,
        to,
        amountInBase,
        null, // denom은 config에서 자동으로
        memo
      );

      console.log("[CosmosAdapter] Transaction sent successfully", result);

      return {
        hash: result.hash,
        height: result.height,
        gasUsed: result.gasUsed?.toString() || '0',
        gasWanted: result.gasWanted?.toString() || '0'
      };
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw error;
    }
  }

  /**
   * 현재 블록 높이 조회
   */
  async getBlockHeight() {
    try {
      if (!this.client) {
        await this.initializeClient();
      }

      const height = await this.client.getHeight();
      return height;
    } catch (error) {
      console.error('[CosmosAdapter] Failed to get block height:', error);
      return 0;
    }
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  /**
   * 현재 네트워크 수수료 조회
   *
   * 📝 개선 메모: config에서 설정된 수수료 정보를 가져옵니다.
   */
  async getGasPrice() {
    try {
      const feeInfo = window.CosmosConfig?.getFeeInfo();

      return {
        low: feeInfo.low_gas_price?.toString() || "0.01",
        medium: feeInfo.average_gas_price?.toString() || "0.025",
        high: feeInfo.high_gas_price?.toString() || "0.03",
      };
    } catch (error) {
      console.error('[CosmosAdapter] Failed to get fee rates:', error);
      // 폴백 값
      return {
        low: "0.01",
        medium: "0.025",
        high: "0.03",
      };
    }
  }

}

// ================================================================
// 전역 설정
// ================================================================

// 설정 접근자
window.CoinConfig = CosmosAdapterConfig;

// 어댑터 설정
window.setAdapter = (adapter) => {
  window.adapter = adapter;
};

window.getAdapter = () => {
  return window.adapter;
};

// 어댑터 인스턴스 생성
const cosmosAdapter = new CosmosAdapter(CosmosAdapterConfig);
window.setAdapter(cosmosAdapter);

// CosmosJS 초기화 확인
if (window.CosmosJS && window.CosmosConfig) {
  const config = window.CosmosConfig.getCosmosJSConfig();
  window.CosmosJS.registerConfig(config);
  console.log('[CosmosAdapter] CosmosJS registered with config');
}

console.log('[CosmosAdapter] Module loaded');
console.log('[CosmosAdapter] Network:', window.CosmosConfig?.getActiveNetwork());