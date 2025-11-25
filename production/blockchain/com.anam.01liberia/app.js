// ================================================================
// Liberia Stellar Adapter 구현
// deriveKey API v2 (ed25519) 사용 - 니모닉 관리 불필요
// ================================================================

const LiberiaStellarAdapterConfig = {
  // 기본 정보
  name: "Liberia Stellar",
  symbol: "XLM",
  decimals: 7,

  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get horizonUrl() {
      return window.LiberiaConfig?.horizonUrl || "https://horizon.stellar.org";
    },
    get networkName() {
      return window.LiberiaConfig?.getActiveNetwork() || "mainnet";
    },
    get passphrase() {
      return window.LiberiaConfig?.getNetworkPassphrase() || "Public Global Stellar Network ; September 2015";
    }
  },

  // UI 테마 설정
  theme: {
    primaryColor: "#08B5E5",      // Stellar 메인 색상
    secondaryColor: "#000000",    // 보조 색상
    logoText: "Stellar",
  },

  // 주소 설정
  address: {
    regex: /^G[A-Z2-7]{55}$/,
    displayFormat: "G...",
  },

  // 트랜잭션 설정
  transaction: {
    baseFee: window.LiberiaConfig?.TRANSACTION?.BASE_FEE || 100,
    minBalance: window.LiberiaConfig?.TRANSACTION?.MIN_BALANCE || 1,
    minAmount: window.LiberiaConfig?.TRANSACTION?.MIN_AMOUNT || "0.0000001",
    confirmationTime: window.LiberiaConfig?.TRANSACTION?.CONFIRMATION_TIME || 5000,
  },

  // 기타 옵션
  options: {
    supportsMnemonic: false,  // deriveKey API 사용 - 모듈 내 니모닉 관리 안함
    supportsTokens: false,    // XLM만 지원
    supportsQRCode: true,
  },
};

// ================================================================
// LiberiaStellarAdapter 클래스 구현
// ================================================================

class LiberiaStellarAdapter {
  constructor(config) {
    this.config = config || LiberiaStellarAdapterConfig;
    this.stellarSDK = window.stellarSDK;
    this.server = null;
    this.isInitialized = false;

    if (!this.stellarSDK) {
      console.error('[LiberiaStellar] SDK not loaded');
      this.isInitialized = false;
      return;
    }

    this.isInitialized = true;
    this.initializeServer();
  }

  initializeServer() {
    if (!this.stellarSDK) return;

    const horizonUrl = this.config.network.horizonUrl;
    this.server = new this.stellarSDK.Server(horizonUrl);
    this.networkPassphrase = this.config.network.passphrase;
    console.log(`[LiberiaStellar] Server initialized: ${horizonUrl}`);
  }

  /* ================================================================
   * 1. 지갑 - deriveKey API v2 사용 (ed25519)
   * ================================================================ */

  // deriveKey API v2로 키 파생 (Promise 래퍼)
  deriveKey(path, curve = "ed25519") {
    return new Promise((resolve, reject) => {
      const handler = (event) => {
        window.removeEventListener('keyDerived', handler);
        if (event.detail.success) {
          const { privateKey, publicKey, path: derivedPath, curve: derivedCurve } = event.detail;

          // ed25519의 경우 Stellar Keypair 생성
          let address = null;
          let secretKey = null;

          if (curve === "ed25519" && this.stellarSDK) {
            try {
              // privateKey(32 bytes hex)에서 Stellar Keypair 생성
              const seed = this.hexToBytes(privateKey);
              const keypair = this.stellarSDK.Keypair.fromRawEd25519Seed(seed);
              address = keypair.publicKey();  // G...
              secretKey = keypair.secret();   // S...
            } catch (error) {
              console.error('[LiberiaStellar] Keypair generation failed:', error);
              reject(error);
              return;
            }
          }

          resolve({
            address: address,
            privateKey: secretKey,  // Stellar secret key (S...)
            publicKey: address,     // Stellar public key (G...)
            rawPrivateKey: privateKey,  // 원본 32바이트 hex
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

  // Hex to Uint8Array 변환
  hexToBytes(hex) {
    const cleanHex = hex.replace('0x', '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    return bytes;
  }

  // 기본 경로로 지갑 가져오기
  async getWallet(path, curve) {
    const targetPath = path || window.LiberiaConfig?.BIP44_PATH || "m/44'/148'/0'";
    const targetCurve = curve || window.LiberiaConfig?.CURVE || "ed25519";
    return await this.deriveKey(targetPath, targetCurve);
  }

  isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return this.config.address.regex.test(address);
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  async getBalance(address) {
    try {
      if (!this.server) {
        return '0';
      }

      const account = await this.server.loadAccount(address);
      const xlmBalance = account.balances.find(balance => balance.asset_type === 'native');
      return xlmBalance ? xlmBalance.balance : '0';
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // 계정이 활성화되지 않음
        return '0';
      }
      console.error('[LiberiaStellar] Balance fetch failed:', error);
      return '0';
    }
  }

  // 계정 활성화 여부 확인
  async isAccountActivated(address) {
    try {
      await this.server.loadAccount(address);
      return true;
    } catch (error) {
      if (error.response && error.response.status === 404) {
        return false;
      }
      throw error;
    }
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  async sendTransaction(params) {
    try {
      const { from, to, amount, privateKey, memo = '' } = params;

      if (!this.server || !this.stellarSDK) {
        throw new Error('SDK not initialized');
      }

      // 키페어 생성 (S... 형식의 secret key)
      const sourceKeypair = this.stellarSDK.Keypair.fromSecret(privateKey);
      const sourceAddress = sourceKeypair.publicKey();

      // 계정 정보 로드
      const account = await this.server.loadAccount(sourceAddress);

      // 받는 계정 존재 확인
      let destinationExists = true;
      try {
        await this.server.loadAccount(to);
      } catch (error) {
        if (error.response && error.response.status === 404) {
          destinationExists = false;
        } else {
          throw error;
        }
      }

      // 트랜잭션 빌더
      const fee = await this.server.fetchBaseFee();
      const transactionBuilder = new this.stellarSDK.TransactionBuilder(account, {
        fee: fee.toString(),
        networkPassphrase: this.networkPassphrase
      });

      // 작업 추가
      if (destinationExists) {
        // 일반 송금
        transactionBuilder.addOperation(
          this.stellarSDK.Operation.payment({
            destination: to,
            asset: this.stellarSDK.Asset.native(),
            amount: amount
          })
        );
      } else {
        // 계정 생성 (최소 1 XLM 필요)
        const createAmount = Math.max(parseFloat(amount), 1).toString();
        transactionBuilder.addOperation(
          this.stellarSDK.Operation.createAccount({
            destination: to,
            startingBalance: createAmount
          })
        );
      }

      // 메모 추가
      if (memo && memo.trim()) {
        transactionBuilder.addMemo(this.stellarSDK.Memo.text(memo.trim()));
      }

      // 트랜잭션 빌드 및 서명
      const transaction = transactionBuilder.setTimeout(30).build();
      transaction.sign(sourceKeypair);

      // 트랜잭션 제출
      const result = await this.server.submitTransaction(transaction);

      return {
        hash: result.hash,
        success: result.successful,
        ledger: result.ledger
      };
    } catch (error) {
      console.error('[LiberiaStellar] Transaction failed:', error);
      throw error;
    }
  }

  async getTransactionStatus(txHash) {
    try {
      const transaction = await this.server.transactions().transaction(txHash).call();
      return {
        confirmed: transaction.successful,
        ledger: transaction.ledger,
        createdAt: transaction.created_at
      };
    } catch (error) {
      console.error('[LiberiaStellar] Transaction status fetch failed:', error);
      throw error;
    }
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  async getBaseFee() {
    try {
      const fee = await this.server.fetchBaseFee();
      return fee;
    } catch (error) {
      console.error('[LiberiaStellar] Fee fetch failed:', error);
      return 100; // 기본값 100 stroops
    }
  }

  async estimateFee() {
    const fee = await this.getBaseFee();
    // stroops를 XLM으로 변환 (1 XLM = 10^7 stroops)
    return (fee / 10000000).toFixed(7);
  }

  /* ================================================================
   * 5. 트랜잭션 히스토리
   * ================================================================ */

  async getTransactionHistory(address, limit = 10) {
    try {
      if (!this.server) return [];

      // 계정 존재 확인
      const exists = await this.isAccountActivated(address);
      if (!exists) return [];

      // Operations 조회
      const operations = await this.server
        .operations()
        .forAccount(address)
        .order('desc')
        .limit(limit)
        .call();

      const transactions = [];

      for (const op of operations.records) {
        let type = 'unknown';
        let amount = '0';
        let otherAddress = '';
        let from = '';
        let to = '';

        if (op.type === 'payment') {
          const isSent = op.from === address;
          type = isSent ? 'send' : 'receive';
          amount = op.amount;
          from = op.from;
          to = op.to;
          otherAddress = isSent ? op.to : op.from;
        } else if (op.type === 'create_account') {
          const isSent = op.source_account === address;
          type = isSent ? 'send' : 'receive';
          amount = op.starting_balance;
          from = op.source_account || op.funder;
          to = op.account;
          otherAddress = isSent ? op.account : (op.source_account || op.funder);
        } else {
          continue;
        }

        transactions.push({
          hash: op.transaction_hash,
          type: type,
          amount: amount,
          from: from,
          to: to,
          address: otherAddress,
          timestamp: new Date(op.created_at).getTime(),
          timeStamp: Math.floor(new Date(op.created_at).getTime() / 1000),
          success: op.transaction_successful !== false
        });
      }

      return transactions;
    } catch (error) {
      console.error('[LiberiaStellar] Transaction history fetch failed:', error);
      return [];
    }
  }

  /* ================================================================
   * 6. 네트워크 상태
   * ================================================================ */

  async checkNetworkStatus() {
    try {
      const response = await fetch(this.config.network.horizonUrl);
      return response.ok;
    } catch (error) {
      return false;
    }
  }
}

// ================================================================
// 전역 설정 및 초기화
// ================================================================

window.CoinConfig = LiberiaStellarAdapterConfig;
window.getConfig = () => LiberiaStellarAdapterConfig;

const liberiaStellarAdapter = new LiberiaStellarAdapter(LiberiaStellarAdapterConfig);
window.getAdapter = () => liberiaStellarAdapter;

console.log("[LiberiaStellarAdapter] 모듈 로드 완료 - " + (window.LiberiaConfig?.displayName || "Stellar"));
