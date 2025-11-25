// ================================================================
// Stellar2 Adapter - 템플릿 기반 구현
// ================================================================

const StellarAdapterConfig = {
  // 기본 정보
  name: "Stellar",
  symbol: "XLM",
  decimals: 7,

  // UI 테마 설정
  theme: {
    primaryColor: "#08B5E5",
    secondaryColor: "#000000",
    logoText: "Stellar"
  },

  // 네트워크 설정 (다른 체인과 동일한 패턴)
  network: {
    get networkName() {
      return window.StellarConfig?.getActiveNetwork() || "testnet";
    },
    get horizonUrl() {
      return window.StellarConfig?.getHorizonUrl() || "https://horizon-testnet.stellar.org";
    },
    get passphrase() {
      return window.StellarConfig?.getCurrentNetwork()?.passphrase || "Test SDF Network ; September 2015";
    }
  },

  // 주소 설정
  address: {
    regex: /^G[A-Z2-7]{55}$/,
    displayFormat: "G..."
  },

  // 트랜잭션 설정
  transaction: {
    defaultFee: "0.00001", // 100 stroops
    minAmount: "0.0000001",
    confirmTime: 5000
  },

  // 옵션
  options: {
    supportsMnemonic: true,
    supportsTokens: true,
    supportsQRCode: true
  }
};

// ================================================================
// Stellar Adapter 클래스 (템플릿 패턴)
// ================================================================
class StellarAdapter {
  constructor(config) {
    this.config = config || StellarAdapterConfig;
    this.stellarSDK = window.stellarSDK;
    this.server = null;
    this.isInitialized = false;

    if (!this.stellarSDK) {
      console.error('[Stellar] SDK not loaded');
      this.isInitialized = false;
      return;
    }

    this.isInitialized = true;
    this.initializeServer();
  }

  /**
   * 현재 네트워크 이름 가져오기 (다른 체인과 동일한 패턴)
   */
  getNetworkName() {
    return this.config.network.networkName;
  }

  /**
   * 서버 초기화 - Config에서 동적으로 네트워크 정보 가져옴
   */
  initializeServer() {
    if (!this.stellarSDK) return;

    const networkName = this.getNetworkName();

    const networks = {
      'mainnet': {
        url: 'https://horizon.stellar.org',
        passphrase: this.stellarSDK.Networks.PUBLIC
      },
      'testnet': {
        url: 'https://horizon-testnet.stellar.org',
        passphrase: this.stellarSDK.Networks.TESTNET
      },
      'futurenet': {
        url: 'https://horizon-futurenet.stellar.org',
        passphrase: 'Test SDF Future Network ; October 2022'
      }
    };

    const network = networks[networkName];
    if (network) {
      this.server = new this.stellarSDK.Server(network.url);
      this.networkPassphrase = network.passphrase;
      console.log(`[Stellar] Server initialized for ${networkName}: ${network.url}`);
    } else {
      console.error(`[Stellar] Unknown network: ${networkName}`);
    }
  }

  // ================================================================
  // 섹션 1: 지갑 생성 및 관리 (템플릿 표준)
  // ================================================================

  // 새 지갑 생성
  async generateWallet() {
    try {
      if (!this.stellarSDK || !this.stellarSDK.StellarHDWallet) {
        throw new Error('Stellar SDK not loaded');
      }

      // 12자 니모닉 생성
      const mnemonic = this.stellarSDK.StellarHDWallet.generateMnemonic({ entropyBits: 128 });
      const hdWallet = this.stellarSDK.StellarHDWallet.fromMnemonic(mnemonic);
      const keypair = hdWallet.getKeypair(0);

      return {
        address: keypair.publicKey(),
        privateKey: keypair.secret(),
        mnemonic: mnemonic,
        publicKey: keypair.publicKey()
      };
    } catch (error) {
      console.error('[Stellar] Wallet generation failed:', error);
      throw error;
    }
  }

  // 니모닉에서 지갑 복구
  async importFromMnemonic(mnemonic) {
    try {
      if (!this.stellarSDK || !this.stellarSDK.StellarHDWallet) {
        throw new Error('Stellar SDK not loaded');
      }

      const hdWallet = this.stellarSDK.StellarHDWallet.fromMnemonic(mnemonic);
      const keypair = hdWallet.getKeypair(0);

      return {
        address: keypair.publicKey(),
        privateKey: keypair.secret(),
        mnemonic: mnemonic,
        publicKey: keypair.publicKey()
      };
    } catch (error) {
      console.error('[Stellar] Import from mnemonic failed:', error);
      throw error;
    }
  }

  // 개인키에서 지갑 복구
  async importFromPrivateKey(privateKey) {
    try {
      if (!this.stellarSDK) {
        throw new Error('Stellar SDK not loaded');
      }

      const keypair = this.stellarSDK.Keypair.fromSecret(privateKey);

      return {
        address: keypair.publicKey(),
        privateKey: privateKey,
        publicKey: keypair.publicKey()
      };
    } catch (error) {
      console.error('[Stellar] Import from private key failed:', error);
      throw error;
    }
  }

  // 주소 유효성 검사
  isValidAddress(address) {
    if (!address || typeof address !== 'string') return false;
    return this.config.address.regex.test(address);
  }

  // ================================================================
  // 섹션 2: 잔액 조회 (템플릿 표준)
  // ================================================================

  // 잔액 조회
  async getBalance(address) {
    try {
      if (!this.server) {
        throw new Error('Server not initialized');
      }

      const account = await this.server.loadAccount(address);
      const xlmBalance = account.balances.find(balance => balance.asset_type === 'native');

      return xlmBalance ? xlmBalance.balance : '0';
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // 계정이 활성화되지 않음 - 정상적인 상태
        return '0';
      }
      console.error('[Stellar] Balance fetch failed:', error);
      return '0';
    }
  }

  // 계정 존재 여부 확인 (= 계정 활성화 여부)
  async checkAddressHistory(address) {
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

  // 계정 활성화 여부 확인 (checkAddressHistory의 별칭)
  async isAccountActivated(address) {
    return this.checkAddressHistory(address);
  }

  // ================================================================
  // 섹션 3: 트랜잭션 처리 (템플릿 표준)
  // ================================================================

  // 트랜잭션 전송
  async sendTransaction(params) {
    try {
      const { from, to, amount, privateKey, memo = '' } = params;

      if (!this.server || !this.stellarSDK) {
        throw new Error('SDK not initialized');
      }

      // 키페어 생성
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
      console.error('[Stellar] Transaction failed:', error);
      throw error;
    }
  }

  // 트랜잭션 상태 조회
  async getTransactionStatus(txHash) {
    try {
      const transaction = await this.server.transactions().transaction(txHash).call();
      return {
        confirmed: transaction.successful,
        ledger: transaction.ledger,
        createdAt: transaction.created_at
      };
    } catch (error) {
      console.error('[Stellar] Transaction status fetch failed:', error);
      throw error;
    }
  }

  // ================================================================
  // 섹션 4: 수수료 관련 (템플릿 표준)
  // ================================================================

  // 가스 가격 조회 (Stellar의 경우 base fee)
  async getGasPrice() {
    try {
      const fee = await this.server.fetchBaseFee();
      return {
        baseFee: fee,
        recommendedFee: fee
      };
    } catch (error) {
      console.error('[Stellar] Fee fetch failed:', error);
      return {
        baseFee: 100,
        recommendedFee: 100
      };
    }
  }

  // 수수료 추정
  async estimateFee(txParams) {
    const fee = await this.server.fetchBaseFee();
    return fee.toString();
  }

  // ================================================================
  // 섹션 5: 트랜잭션 히스토리 (추가 기능)
  // ================================================================

  async getTransactionHistory(address, limit = 10) {
    try {
      if (!this.server) return [];

      // 계정 존재 확인
      const exists = await this.checkAddressHistory(address);
      if (!exists) return [];

      // Operations 조회 (payments + create_account 모두 포함)
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
          // 일반 결제
          const isSent = op.from === address;
          type = isSent ? 'send' : 'receive';
          amount = op.amount;
          from = op.from;
          to = op.to;
          otherAddress = isSent ? op.to : op.from;
        } else if (op.type === 'create_account') {
          // 계정 생성 (Friendbot 포함)
          const isSent = op.source_account === address;
          type = isSent ? 'send' : 'receive';
          amount = op.starting_balance;
          from = op.source_account || op.funder;
          to = op.account;
          otherAddress = isSent ? op.account : (op.source_account || op.funder);
        } else {
          // 기타 오퍼레이션은 스킵 (trust_line, offer 등)
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
          success: op.transaction_successful !== false
        });
      }

      return transactions;
    } catch (error) {
      console.error('[Stellar] Transaction history fetch failed:', error);
      return [];
    }
  }

  // ================================================================
  // 네트워크 관리
  // ================================================================

  /**
   * 네트워크 전환 (Config를 통해 관리)
   */
  switchNetwork(networkId) {
    if (window.StellarConfig?.setActiveNetwork) {
      window.StellarConfig.setActiveNetwork(networkId);
    }
    this.initializeServer();
  }

  /**
   * 현재 네트워크 가져오기
   */
  getCurrentNetwork() {
    return this.getNetworkName();
  }
}

// ================================================================
// 전역 설정
// ================================================================

// CoinConfig 전역 변수
window.CoinConfig = StellarAdapterConfig;

// Adapter 인스턴스 생성 함수
window.getAdapter = function() {
  if (!window.stellarSDK) {
    console.warn('[Stellar] SDK not loaded');
    return null;
  }
  return new StellarAdapter(StellarAdapterConfig);
};

// 초기화 로그
console.log('[StellarAdapter] Module loaded');
console.log('[StellarAdapter] Network:', window.StellarConfig?.getActiveNetwork() || 'testnet');