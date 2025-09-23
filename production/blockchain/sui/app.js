// ================================================================
// Sui Blockchain Adapter
// ================================================================

const SuiAdapterConfig = {
  name: "Sui",
  symbol: "SUI",
  decimals: 9,
  
  // 네트워크 설정 (config.js에서 동적으로 가져옴)
  network: {
    get networkName() {
      return window.SuiConfig?.getActiveNetwork() || "testnet";
    },
    get apiBaseUrl() {
      return window.SuiConfig?.currentNetwork?.rpcUrl || "https://fullnode.testnet.sui.io:443";
    }
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#6FBDFF",
    secondaryColor: "#4DA2E4",
    logoText: "Sui",
  },
  
  // 트랜잭션 설정 (config.js에서 가져옴)
  transaction: {
    get feeRate() {
      return window.SuiConfig?.TRANSACTION?.DEFAULT_GAS_BUDGET || 200000;
    }
  },
};

class SuiAdapter {
  constructor(config) {
    this.config = config || SuiAdapterConfig;
    this.suiSDK = window.suiSDK;
    
    // SUI RPC 클라이언트 초기화
    if (this.suiSDK && this.suiSDK.SuiClient) {
      const rpcUrl = this.config.network.apiBaseUrl;
      this.client = new this.suiSDK.SuiClient({ url: rpcUrl });
    }
  }

  /**
   * Sui 클라이언트 초기화
   */
  getClient() {
    if (!this.client && this.suiSDK) {
      const rpcUrl = this.config.network.apiBaseUrl;
      this.client = new this.suiSDK.SuiClient({ url: rpcUrl });
    }
    return this.client;
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  /**
   * 새 지갑 생성
   */
  async generateWallet() {
    try {
      // Sui SDK 확인
      if (!this.suiSDK) {
        throw new Error("Sui SDK not loaded");
      }

      // 니모닉 생성
      const mnemonic = this.suiSDK.generateMnemonic();
      console.log("Mnemonic generated successfully");

      // 니모닉으로부터 키페어 생성
      const keypair = this.suiSDK.Ed25519Keypair.deriveKeypair(mnemonic);
      const address = keypair.getPublicKey().toSuiAddress();

      // 개인키를 suiprivkey1 형식으로 추출
      let privateKeyString;
      
      // SDK의 getSecretKey 메서드가 suiprivkey1 형식 반환
      if (typeof keypair.getSecretKey === 'function') {
        // getSecretKey()는 suiprivkey1 형식 문자열 반환
        privateKeyString = keypair.getSecretKey();
      } else if (typeof keypair.export === 'function') {
        // export().privateKey는 suiprivkey1 형식
        const exported = keypair.export();
        privateKeyString = exported.privateKey;
      } else {
        // 폴백: 바이트에서 suiprivkey1 생성
        let privateKeyBytes;
        if (typeof keypair.exportSecretKey === 'function') {
          privateKeyBytes = keypair.exportSecretKey();
        } else if (keypair.secretKey) {
          privateKeyBytes = keypair.secretKey;
        } else {
          throw new Error('Cannot export private key from keypair');
        }
        // Ed25519Keypair.fromSecretKey를 사용하여 suiprivkey1 형식 생성
        const tempKeypair = this.suiSDK.Ed25519Keypair.fromSecretKey(privateKeyBytes);
        privateKeyString = tempKeypair.getSecretKey();
      }

      console.log("Wallet generated successfully");

      return {
        mnemonic: mnemonic,
        address: address,
        privateKey: privateKeyString
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
      // Sui SDK 확인
      if (!this.suiSDK) {
        throw new Error("Sui SDK not loaded");
      }

      // 니모닉 유효성 검증
      if (!this.suiSDK.isValidMnemonic || !this.suiSDK.isValidMnemonic(mnemonic)) {
        // 유효성 검증 함수가 없으면 기본 검증
        const words = mnemonic.trim().split(/\s+/);
        if (words.length !== 12 && words.length !== 24) {
          throw new Error("Invalid mnemonic phrase. Must be 12 or 24 words.");
        }
      }

      // 니모닉으로부터 키페어 생성
      const keypair = this.suiSDK.Ed25519Keypair.deriveKeypair(mnemonic);
      const address = keypair.getPublicKey().toSuiAddress();

      // 개인키를 suiprivkey1 형식으로 추출
      let privateKeyString;
      
      // SDK의 getSecretKey 메서드가 suiprivkey1 형식 반환
      if (typeof keypair.getSecretKey === 'function') {
        // getSecretKey()는 suiprivkey1 형식 문자열 반환
        privateKeyString = keypair.getSecretKey();
      } else if (typeof keypair.export === 'function') {
        // export().privateKey는 suiprivkey1 형식
        const exported = keypair.export();
        privateKeyString = exported.privateKey;
      } else {
        // 폴백: 바이트에서 suiprivkey1 생성
        let privateKeyBytes;
        if (typeof keypair.exportSecretKey === 'function') {
          privateKeyBytes = keypair.exportSecretKey();
        } else if (keypair.secretKey) {
          privateKeyBytes = keypair.secretKey;
        } else {
          throw new Error('Cannot export private key from keypair');
        }
        // Ed25519Keypair.fromSecretKey를 사용하여 suiprivkey1 형식 생성
        const tempKeypair = this.suiSDK.Ed25519Keypair.fromSecretKey(privateKeyBytes);
        privateKeyString = tempKeypair.getSecretKey();
      }

      console.log("Wallet imported successfully");

      return {
        mnemonic: mnemonic,
        address: address,
        privateKey: privateKeyString
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
    return window.SuiConfig?.isValidAddress(address) || false;
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  /**
   * 잔액 조회
   * @param {string} address - Sui 주소 (0x로 시작하는 64자 hex)
   * @returns {Promise<string>} - 잔액 (MIST 단위, 1 SUI = 10^9 MIST)
   */
  async getBalance(address) {
    try {
      // Sui RPC 클라이언트 확인
      if (!this.client) {
        this.client = this.getClient();
      }

      // Sui 주소 형식 검증
      if (!address || !address.startsWith('0x')) {
        throw new Error('Invalid Sui address format');
      }

      // Sui RPC 호출: getBalance
      // owner: 지갑 주소
      // coinType: 기본값은 '0x2::sui::SUI' (SUI 네이티브 토큰)
      const balanceResult = await this.client.getBalance({
        owner: address,
        coinType: '0x2::sui::SUI'  // SUI 네이티브 토큰
      });

      // totalBalance는 문자열로 반환됨 (MIST 단위)
      const balance = balanceResult.totalBalance || '0';
      
      // 로그: 주소 일부만 표시 (보안)
      const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
      console.log(`Balance for ${shortAddress}: ${balance} MIST`);
      
      return balance;
    } catch (error) {
      console.error('Failed to get balance:', error);
      // 사용자 친화적 에러 메시지
      if (error.message?.includes('Invalid Sui address')) {
        throw new Error('Invalid wallet address');
      }
      throw error;
    }
  }


  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  /**
   * 트랜잭션 전송
   * @param {Object} params - 트랜잭션 파라미터
   * @param {string} params.to - 수신자 주소
   * @param {string} params.amount - 전송 금액 (SUI 단위)
   * @param {string} params.privateKey - 개인키
   * @param {string} params.feeLevel - 수수료 레벨 (low/medium/high)
   * @returns {Promise<Object>} - 트랜잭션 결과
   */
  async sendTransaction(params) {
    const { to, amount, privateKey, feeLevel = 'medium' } = params;

    try {
      // Sui SDK 확인
      if (!this.suiSDK) {
        throw new Error("Sui SDK not loaded");
      }

      // RPC 클라이언트 확인
      if (!this.client) {
        this.client = this.getClient();
      }

      // ==============================================
      // 1. 개인키로부터 키페어 생성
      // ==============================================
      let keypair;
      
      // suiprivkey1 형식만 지원
      if (typeof privateKey === 'string' && privateKey.startsWith('suiprivkey1')) {
        keypair = this.suiSDK.Ed25519Keypair.fromSecretKey(privateKey);
      } else {
        throw new Error('Invalid private key format. Only suiprivkey1 format is supported.');
      }

      // ==============================================
      // 2. 금액 변환 (SUI -> MIST)
      // ==============================================
      // 1 SUI = 10^9 MIST
      const amountInMist = Math.floor(parseFloat(amount) * 1_000_000_000);
      
      if (amountInMist <= 0) {
        throw new Error('Invalid amount');
      }

      console.log(`Sending ${amount} SUI (${amountInMist} MIST) to ${to}`);

      // ==============================================
      // 3. 가스 예산 설정
      // ==============================================
      const gasBudget = window.SuiConfig?.TRANSACTION?.FEE_RATES[feeLevel] || 200000;

      // ==============================================
      // 4. 트랜잭션 생성 및 전송
      // ==============================================
      // 최신 SDK의 Transaction 블록 사용
      if (this.suiSDK.Transaction) {
        const tx = new this.suiSDK.Transaction();
        
        // 가스 예산 설정
        tx.setGasBudget(gasBudget);
        
        // 코인 분할 및 전송
        const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountInMist)]);
        tx.transferObjects([coin], tx.pure.address(to));

        // 트랜잭션 서명 및 전송
        const result = await this.client.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
          options: {
            showEffects: true,
            showObjectChanges: true
          },
          requestType: 'WaitForLocalExecution'
        });

        // 트랜잭션 해시 추출
        const txHash = result.digest || result.effectsDigest || 'unknown';
        
        console.log('Transaction successful:', txHash);
        return {
          hash: txHash,
          signature: txHash,
          status: 'success'
        };
      } 
      // 레거시 SDK의 TransactionBlock 사용
      else if (this.suiSDK.TransactionBlock) {
        const tx = new this.suiSDK.TransactionBlock();
        
        // 코인 분할 및 전송
        const [coin] = tx.splitCoins(tx.gas, [
          tx.pure(amountInMist, 'u64')
        ]);
        tx.transferObjects([coin], tx.pure(to, 'address'));

        // 트랜잭션 서명 및 전송 (레거시 SDK도 동일한 메서드 사용)
        const result = await this.client.signAndExecuteTransaction({
          signer: keypair,
          transaction: tx,
          options: {
            showEffects: true,
            showObjectChanges: true
          },
          requestType: 'WaitForLocalExecution'
        });

        // 트랜잭션 해시 추출
        const txHash = result.digest || result.effectsDigest || 'unknown';
        
        console.log('Transaction successful:', txHash);
        return {
          hash: txHash,
          signature: txHash,
          status: 'success'
        };
      } else {
        throw new Error('No compatible Sui transaction API found');
      }
    } catch (error) {
      console.error("Failed to send transaction:", error);
      throw error;
    }
  }


  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  /**
   * 현재 네트워크 수수료 조회
   * Sui RPC를 사용하여 참조 가스 가격 조회
   */
  async getGasPrice() {
    try {
      const client = this.getClient();
      if (!client) {
        throw new Error('Sui client not initialized');
      }

      // Sui RPC: 참조 가스 가격 조회
      const referenceGasPrice = await client.getReferenceGasPrice();
      const basePrice = BigInt(referenceGasPrice);

      // 수수료 레벨별 가스 가격 계산 (MIST 단위)
      return {
        low: (basePrice * 80n / 100n).toString(),    // 80% of reference
        medium: basePrice.toString(),                 // 100% of reference
        high: (basePrice * 150n / 100n).toString()   // 150% of reference
      };
    } catch (error) {
      console.error('Failed to get gas price:', error);
      // 폴백 값 (MIST 단위)
      return {
        low: '100000',     // 0.0001 SUI
        medium: '200000',  // 0.0002 SUI
        high: '500000'     // 0.0005 SUI
      };
    }
  }


  /* ================================================================
   * 5. 트랜잭션 조회
   * ================================================================ */

  /**
   * 트랜잭션 히스토리 조회
   * @param {string} address - 지갑 주소
   * @returns {Promise<Array>} - 트랜잭션 목록
   */
  async getTransactionHistory(address) {
    console.log('[getTransactionHistory] Starting for address:', address);
    try {
      const client = this.getClient();
      if (!client) {
        console.error('[getTransactionHistory] Client not initialized');
        throw new Error('Sui client not initialized');
      }

      console.log('[getTransactionHistory] Querying transaction blocks from RPC');
      console.log('[getTransactionHistory] Current network:', this.config?.currentNetwork?.name);
      console.log('[getTransactionHistory] RPC URL:', this.config?.currentNetwork?.rpcUrl);

      // Sui RPC: 보낸 트랜잭션 조회
      console.log('[getTransactionHistory] Querying FromAddress (sent transactions)');
      const sentTxs = await client.queryTransactionBlocks({
        filter: {
          FromAddress: address
        },
        options: {
          showInput: true,
          showEffects: true,
          showBalanceChanges: true
        },
        limit: 30  // 최근 30개
      });

      console.log('[getTransactionHistory] Sent transactions:', sentTxs.data?.length || 0);

      // Sui RPC: 받은 트랜잭션 조회
      console.log('[getTransactionHistory] Querying ToAddress (received transactions)');
      const receivedTxs = await client.queryTransactionBlocks({
        filter: {
          ToAddress: address
        },
        options: {
          showInput: true,
          showEffects: true,
          showBalanceChanges: true
        },
        limit: 30  // 최근 30개
      });

      console.log('[getTransactionHistory] Received transactions:', receivedTxs.data?.length || 0);

      // 두 결과를 합치고 중복 제거
      const allTxs = [...sentTxs.data, ...receivedTxs.data];
      const uniqueTxs = Array.from(
        new Map(allTxs.map(tx => [tx.digest, tx])).values()
      );

      // 타임스탬프로 정렬 (최신 순)
      uniqueTxs.sort((a, b) => {
        const timeA = a.timestampMs || 0;
        const timeB = b.timestampMs || 0;
        return timeB - timeA;
      });

      console.log('[getTransactionHistory] Total unique transactions:', uniqueTxs.length);

      // 트랜잭션 데이터 포맷팅
      const formatted = uniqueTxs.slice(0, 50).map(tx => ({
        txid: tx.digest,  // 변경: digest -> txid (index.js와 일치)
        digest: tx.digest,
        sender: tx.transaction?.data?.sender || address,
        recipient: this.extractRecipient(tx, address),
        amount: this.extractTransactionAmount(tx),
        timestamp: tx.timestampMs ? Math.floor(tx.timestampMs / 1000) : Date.now() / 1000,
        status: tx.effects?.status?.status === 'success' ? 'confirmed' : 'failed',
        gasUsed: tx.effects?.gasUsed?.computationCost || '0',
        type: this.determineTransactionType(tx, address)  // sent/received 구분
      }));

      console.log('[getTransactionHistory] Formatted transactions:', formatted.length);
      console.log('[getTransactionHistory] First formatted tx:', formatted[0]);

      return formatted;
    } catch (error) {
      console.error('[getTransactionHistory] Failed to get transaction history:', error);
      console.error('[getTransactionHistory] Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      return [];
    }
  }


  /**
   * 트랜잭션 타입 결정 (sent/received)
   */
  determineTransactionType(tx, address) {
    try {
      const sender = tx.transaction?.data?.sender;
      if (sender && sender.toLowerCase() === address.toLowerCase()) {
        return 'sent';
      }
      return 'received';
    } catch (error) {
      console.error('Failed to determine transaction type:', error);
      return 'unknown';
    }
  }

  /**
   * 수신자 주소 추출
   */
  extractRecipient(tx, senderAddress) {
    try {
      // Balance changes에서 수신자 찾기
      const balanceChanges = tx.effects?.balanceChanges || [];
      for (const change of balanceChanges) {
        if (change.coinType === '0x2::sui::SUI' &&
            change.owner?.AddressOwner &&
            change.owner.AddressOwner !== senderAddress &&
            parseInt(change.amount) > 0) {
          return change.owner.AddressOwner;
        }
      }

      // Created objects에서 찾기
      if (tx.effects?.created?.length > 0) {
        const created = tx.effects.created[0];
        if (created.owner?.AddressOwner) {
          return created.owner.AddressOwner;
        }
      }

      // Transaction data에서 찾기
      if (tx.transaction?.data?.transaction?.commands) {
        for (const cmd of tx.transaction.data.transaction.commands) {
          if (cmd.TransferObjects && cmd.TransferObjects.recipient) {
            return cmd.TransferObjects.recipient;
          }
        }
      }

      return '';
    } catch (error) {
      console.error('Failed to extract recipient:', error);
      return '';
    }
  }

  /**
   * 트랜잭션에서 금액 추출 (헬퍼 메서드)
   */
  extractTransactionAmount(tx) {
    try {
      // Balance changes에서 SUI 전송 금액 찾기
      const balanceChanges = tx.effects?.balanceChanges || [];
      const suiChange = balanceChanges.find(change => 
        change.coinType === '0x2::sui::SUI'
      );
      
      if (suiChange) {
        return Math.abs(parseInt(suiChange.amount)).toString();
      }

      // TransactionBlock에서 금액 찾기
      if (tx.transaction?.data?.transaction?.inputs) {
        const amountInput = tx.transaction.data.transaction.inputs.find(
          input => input.type === 'pure' && input.value
        );
        if (amountInput) {
          return amountInput.value;
        }
      }

      return '0';
    } catch (error) {
      console.error('Failed to extract transaction amount:', error);
      return '0';
    }
  }
}

// ================================================================
// 전역 설정
// ================================================================

// 설정 접근자
window.CoinConfig = SuiAdapterConfig;

// 어댑터 설정
window.setAdapter = (adapter) => {
  window.adapter = adapter;
};

window.getAdapter = () => {
  return window.adapter;
};

// Sui 어댑터 인스턴스 생성
const suiAdapter = new SuiAdapter(SuiAdapterConfig);
window.setAdapter(suiAdapter);

console.log('[SuiAdapter] Module loaded');
console.log('[SuiAdapter] Network:', window.SuiConfig?.getActiveNetwork());