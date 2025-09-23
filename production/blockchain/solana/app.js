// ================================================================
// Solana Adapter - Template 기반
// ================================================================

const SolanaAdapterConfig = {
  // 기본 정보
  name: "Solana",
  symbol: "SOL",
  decimals: 9,
  
  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get networkName() {
      return window.SolanaConfig?.getActiveNetwork() || "testnet";
    },
    get rpcUrl() {
      const network = window.SolanaConfig?.getCurrentNetwork();
      return network?.rpcUrl || "https://api.testnet.solana.com";
    },
    get explorerUrl() {
      const network = window.SolanaConfig?.getCurrentNetwork();
      return network?.explorerUrl || "https://explorer.solana.com";
    }
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#9945FF",   // Solana 보라색
    secondaryColor: "#19FB9B", // Solana 민트색
    logoText: "Solana",
  },
  // 트랜잭션 설정 (config.js에서 가져옴)
  transaction: {
    get fee() {
      return window.SolanaConfig?.TRANSACTION?.DEFAULT_FEE || 0.000005; // 5000 lamports
    },
    get confirmationTime() {
      return window.SolanaConfig?.TRANSACTION?.CONFIRMATION_TIME || 20000; // 20초
    }
  },
};

// ================================================================
// Solana Adapter 클래스
// ================================================================

class SolanaAdapter {
  constructor(config) {
    this.config = config || SolanaAdapterConfig;
    
    // ================================================================
    // [필수 기능 8] Provider/네트워크 관리
    // ================================================================
    // Solana Connection 초기화
    this.connection = null;
    this.initConnection();
  }

  /**
   * Solana Connection 초기화
   */
  initConnection() {
    const rpcUrl = this.config.network.rpcUrl;
    
    // SolanaJS 번들에서 Connection 가져오기
    if (window.SolanaJS) {
      this.connection = new window.SolanaJS.Connection(rpcUrl, 'confirmed');
      console.log('[SolanaAdapter] Connection initialized:', rpcUrl);
    } else {
      console.error('[SolanaAdapter] SolanaJS bundle not loaded');
    }
  }
  
  /**
   * Cluster URL 가져오기
   */
  getClusterUrl() {
    const networkName = window.SolanaConfig?.getActiveNetwork() || 'testnet';
    
    if (window.SolanaJS) {
      if (networkName === 'mainnet') {
        return window.SolanaJS.clusterApiUrl('mainnet-beta');
      } else if (networkName === 'devnet') {
        return window.SolanaJS.clusterApiUrl('devnet');
      } else {
        return window.SolanaJS.clusterApiUrl('testnet');
      }
    }
    
    // 폴백: 기본 testnet RPC
    return 'https://api.testnet.solana.com';
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  /**
   * 새 지갑 생성
   */
  async generateWallet() {
    try {
      // ================================================================
      // [필수 기능 1] 니모닉 생성 - Solana
      // ================================================================
      if (!window.SolanaJS) {
        throw new Error("SolanaJS library not loaded");
      }

      const { generateMnemonic, keypairFromMnemonic, Keypair } = window.SolanaJS;
      
      // 12단어 니모닉 생성
      const mnemonic = generateMnemonic();

      // ================================================================
      // [필수 로직] 니모닉으로부터 주소 유도
      // ================================================================
      // Solana BIP44 경로: m/44'/501'/0'/0'
      const keypair = await keypairFromMnemonic(mnemonic, 0);
      const address = keypair.publicKey.toBase58();
      
      // 개인키를 base58 형식으로 저장
      const privateKeyArray = Array.from(keypair.secretKey);
      const privateKeyBase58 = window.bs58.encode(keypair.secretKey);

      // 보안: 민감한 정보는 콘솔에 출력하지 않음
      console.log("[SolanaAdapter] Wallet generated successfully");

      return {
        mnemonic: mnemonic,
        address: address,
        privateKey: privateKeyBase58
      };
    } catch (error) {
      console.error("Failed to generate wallet:", error);
      throw error;
    }
  }

  /**
   * 니모닉으로 지갑 복구
   */
  async importFromMnemonic(mnemonic) {
    try {
      // ================================================================
      // [필수 기능 2] 니모닉 복원 - Solana
      // ================================================================
      if (!window.SolanaJS) {
        throw new Error("SolanaJS library not loaded");
      }

      const { validateMnemonic, keypairFromMnemonic } = window.SolanaJS;

      // 니모닉 유효성 검증
      if (!validateMnemonic(mnemonic)) {
        throw new Error("Invalid mnemonic phrase. Please check your recovery phrase and try again.");
      }

      // 니모닉으로부터 Keypair 생성
      const keypair = await keypairFromMnemonic(mnemonic, 0);
      const address = keypair.publicKey.toBase58();
      
      // 개인키를 base58 형식으로 저장
      const privateKeyBase58 = window.bs58.encode(keypair.secretKey);

      return {
        mnemonic: mnemonic,
        address: address,
        privateKey: privateKeyBase58
      };
    } catch (error) {
      console.error("Failed to import from mnemonic:", error);
      throw error;
    }
  }

/**
   * 주소 유효성 검증
   */
  isValidAddress(address) {
    if (!window.SolanaJS) return false;
    return window.SolanaJS.isValidAddress(address);
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  /**
   * 잔액 조회
   */
  async getBalance(address) {
    try {
      // ================================================================
      // [필수 기능 5] 잔액 조회
      // ================================================================
      // TODO: 블록체인별 잔액 조회 로직 구현
      // 1. RPC 엔드포인트 또는 API 호출
      // 2. 네이티브 토큰 잔액 조회
      // 3. Wei/Lamports/Satoshi 등 최소 단위로 반환
      // 4. 캐싱 전략 적용 (30초 TTL)
      // 
      // 예시:
      // - Ethereum: const balance = await provider.getBalance(address);
      //             return balance.toString(); // Wei 단위
      // - Solana: const balance = await connection.getBalance(new PublicKey(address));
      //           return balance.toString(); // Lamports 단위
      // Solana 잔액 조회
      if (!this.connection) {
        this.initConnection();
      }
      
      const { PublicKey } = window.SolanaJS;
      const pubkey = new PublicKey(address);
      const balance = await this.connection.getBalance(pubkey);
      
      // 보안: 주소 일부만 표시
      const shortAddress = address.slice(0, 6) + '...' + address.slice(-4);
      console.log(`Balance for ${shortAddress}:`, balance, 'lamports');
      
      return balance.toString(); // lamports 단위로 반환
    } catch (error) {
      console.error('Failed to get balance:', error);
      throw error;
    }
  }

  /**
   * 최근 트랜잭션 조회
   */
  async getRecentTransactions(address) {
    try {
      if (!this.connection) {
        this.initConnection();
      }

      const { PublicKey } = window.SolanaJS;
      const publicKey = new PublicKey(address);

      // 재시도 로직 추가 (최대 3회)
      let signatures = [];
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          // 최근 트랜잭션 서명 가져오기
          signatures = await this.connection.getSignaturesForAddress(publicKey, { limit: 30 });
          console.log(`[SolanaAdapter] Found ${signatures.length} recent transactions`);
          break;
        } catch (error) {
          if (error.message && error.message.includes('503')) {
            console.warn(`[SolanaAdapter] RPC unavailable, attempt ${attempt}/3`);
            if (attempt < 3) {
              // 재시도 전 대기 (1초, 2초, 3초 점진적 증가)
              await new Promise(resolve => setTimeout(resolve, attempt * 1000));
            }
          } else {
            throw error; // 503이 아닌 오류는 즉시 throw
          }
        }
      }

      // 트랜잭션 상세 정보를 병렬로 가져오기 (성능 개선)
      const txPromises = signatures.map(sigInfo =>
        this.connection.getParsedTransaction(sigInfo.signature, {
          maxSupportedTransactionVersion: 0
        }).catch(err => {
          console.warn(`Failed to get tx ${sigInfo.signature}:`, err);
          return null;
        })
      );

      const txDetails = await Promise.all(txPromises);

      // 트랜잭션 정보 처리
      const transactions = [];
      for (let i = 0; i < signatures.length; i++) {
        const sigInfo = signatures[i];
        const tx = txDetails[i];

        if (!tx) {
          // 상세 정보를 가져올 수 없으면 기본 정보만 사용
          transactions.push({
            signature: sigInfo.signature,
            slot: sigInfo.slot,
            timestamp: sigInfo.blockTime,
            status: sigInfo.err ? 'failed' : 'confirmed',
            confirmationStatus: sigInfo.confirmationStatus
          });
          continue;
        }

        try {

          // 트랜잭션에서 관련 정보 추출
          let from = null;
          let to = null;
          let amount = 0;
          let preBalance = 0;
          let postBalance = 0;

          // 계정 키 목록
          const accountKeys = tx.transaction.message.accountKeys;

          // SOL 전송 명령 찾기
          for (const instruction of tx.transaction.message.instructions) {
            if (instruction.program === 'system' && instruction.parsed?.type === 'transfer') {
              from = instruction.parsed.info.source;
              to = instruction.parsed.info.destination;
              amount = instruction.parsed.info.lamports;
              break;
            }
          }

          // 잔액 변경 정보 추출
          if (tx.meta && tx.meta.preBalances && tx.meta.postBalances) {
            // 현재 주소의 인덱스 찾기
            const addressIndex = accountKeys.findIndex(
              key => key.pubkey.toBase58() === address
            );

            if (addressIndex !== -1) {
              preBalance = tx.meta.preBalances[addressIndex];
              postBalance = tx.meta.postBalances[addressIndex];
            }
          }

          // 트랜잭션 객체 생성
          transactions.push({
            signature: sigInfo.signature,
            slot: sigInfo.slot,
            timestamp: sigInfo.blockTime,
            from: from || (accountKeys[0]?.pubkey.toBase58()),
            to: to,
            amount: amount,
            preBalance: preBalance,
            postBalance: postBalance,
            fee: tx.meta?.fee || 5000,
            status: sigInfo.err ? 'failed' : 'confirmed',
            confirmationStatus: sigInfo.confirmationStatus
          });

        } catch (txError) {
          console.warn(`Error processing transaction ${sigInfo.signature}:`, txError);
          // 처리 중 오류 발생시 기본 정보만 사용
          transactions.push({
            signature: sigInfo.signature,
            slot: sigInfo.slot,
            timestamp: sigInfo.blockTime,
            status: sigInfo.err ? 'failed' : 'confirmed',
            confirmationStatus: sigInfo.confirmationStatus
          });
        }
      }

      return transactions;
    } catch (error) {
      console.error('Failed to get recent transactions:', error);
      // 오류 발생시에도 빈 배열 반환 (앱 중단 방지)
      return [];
    }
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  /**
   * 트랜잭션 전송
   */
  async sendTransaction(params) {
    const { to, amount, privateKey } = params;

    try {
      if (!window.SolanaJS) {
        throw new Error("SolanaJS library not loaded");
      }

      if (!this.connection) {
        this.initConnection();
      }

      const { 
        Keypair, 
        PublicKey, 
        Transaction, 
        SystemProgram,
        solToLamports,
        sendAndConfirmTransaction 
      } = window.SolanaJS;

      // 개인키로부터 Keypair 생성
      const secretKey = window.bs58.decode(privateKey);
      const keypair = Keypair.fromSecretKey(secretKey);
      const fromPubkey = keypair.publicKey;

      // 수신자 PublicKey 생성
      const toPubkey = new PublicKey(to);
      
      // SOL을 lamports로 변환
      const lamports = solToLamports(parseFloat(amount));
      
      // 잔액 확인
      const balance = await this.connection.getBalance(fromPubkey);
      if (balance < lamports + 5000) { // 5000 lamports for fee
        throw new Error(`Insufficient balance. Need ${lamports + 5000} lamports, have ${balance}`);
      }

      // ================================================================
      // Solana 트랜잭션 생성 및 전송
      // ================================================================
      
      // 최근 블록해시 가져오기
      const { blockhash } = await this.connection.getLatestBlockhash();
      
      // 트랜잭션 생성
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: fromPubkey,
          toPubkey: toPubkey,
          lamports: lamports,
        })
      );
      
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = fromPubkey;

      // 트랜잭션 서명
      transaction.sign(keypair);
      
      // 트랜잭션 전송
      const signature = await this.connection.sendTransaction(transaction, [keypair]);
      
      // 트랜잭션 확인 대기
      await this.connection.confirmTransaction(signature);
      
      console.log("Transaction sent:", signature);

      return {
        hash: signature,
        fee: "5000", // Solana 기본 수수료 (5000 lamports)
      };
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw error;
    }
  }

  /**
   * 토큰 조회 (SPL 토큰)
   */
  async getTokenAccounts(address) {
    try {
      // TODO: SPL 토큰 계정 조회 구현
      // 현재는 미구현
      console.log('[SolanaAdapter] Token accounts not implemented yet');
      return [];
    } catch (error) {
      console.error('Failed to get token accounts:', error);
      throw error;
    }
  }

/**
   * 현재 블록 높이 조회
   */
  async getBlockHeight() {
    try {
      if (!this.connection) {
        this.initConnection();
      }
      
      const blockHeight = await this.connection.getBlockHeight();
      return blockHeight;
    } catch (error) {
      console.error('[SolanaAdapter] Failed to get block height:', error);
      return 0;
    }
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  /**
   * 현재 네트워크 수수료 조회
   */
  async getGasPrice() {
    try {
      if (!this.connection) {
        this.initConnection();
      }
      
      // Solana의 기본 수수료는 5000 lamports
      const feeCalculator = await this.connection.getMinimumBalanceForRentExemption(0);
      
      return {
        low: "5000",      // 5000 lamports
        medium: "5000",    // 5000 lamports
        high: "5000",      // 5000 lamports (Solana는 고정 수수료)
      };
    } catch (error) {
      console.error('[SolanaAdapter] Failed to get fee rates:', error);
      // 폴백 값
      return {
        low: "5000",
        medium: "5000",
        high: "5000",
      };
    }
  }

}

// ================================================================
// 전역 설정
// ================================================================

// 설정 접근자
window.CoinConfig = SolanaAdapterConfig;

// 어댑터 설정
window.setAdapter = (adapter) => {
  window.adapter = adapter;
};

window.getAdapter = () => {
  return window.adapter;
};

// Solana 어댑터 인스턴스 생성
const solanaAdapter = new SolanaAdapter(SolanaAdapterConfig);
window.setAdapter(solanaAdapter);

// 로그 메시지
console.log('[SolanaAdapter] Module loaded');
console.log('[SolanaAdapter] Network:', window.SolanaConfig?.getActiveNetwork() || 'testnet');