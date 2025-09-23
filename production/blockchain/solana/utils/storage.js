// ================================================================
// Solana - Wallet Storage Manager
// localStorage와 sessionStorage를 효율적으로 관리
// ================================================================

(function() {
  'use strict';

  // Storage Manager 객체
  window.WalletStorage = {
    // 메모리 캐시
    wallet: null,

    // Storage 키
    KEYS: {
      // Solana 저장소 키
      storage: 'sol_wallet',
      session: 'sol_wallet_cache'
    },

    /**
     * 지갑 데이터 가져오기
     * 우선순위: 메모리 > sessionStorage > localStorage
     */
    get walletData() {
      // 1. 메모리 캐시 확인
      if (this.wallet) {
        return this.wallet;
      }

      // 2. Session Storage 확인
      const sessionData = sessionStorage.getItem(this.KEYS.session);
      if (sessionData) {
        try {
          const wallet = JSON.parse(sessionData);
          this.wallet = wallet;
          console.log('[Storage] Wallet from session cache');
          return wallet;
        } catch (e) {
          console.error('[Storage] Session data parse error:', e);
        }
      }

      // 3. Local Storage 확인
      const storageData = localStorage.getItem(this.KEYS.storage);
      if (storageData) {
        try {
          const wallet = JSON.parse(storageData);
          this.wallet = wallet;
          // Session Storage에도 캐싱
          sessionStorage.setItem(this.KEYS.session, storageData);
          console.log('[Storage] Wallet from local storage');
          return wallet;
        } catch (e) {
          console.error('[Storage] Storage data parse error:', e);
        }
      }

      return null;
    },

    /**
     * 지갑 데이터 저장
     * localStorage와 sessionStorage에 동시 저장
     */
    set walletData(data) {
      if (!data) {
        this.clear();
        return;
      }

      try {
        const jsonData = JSON.stringify(data);
        
        // 모든 저장소에 저장
        this.wallet = data;
        localStorage.setItem(this.KEYS.storage, jsonData);
        sessionStorage.setItem(this.KEYS.session, jsonData);
        
        console.log('[Storage] Wallet saved:', data.address);
      } catch (e) {
        console.error('[Storage] Save error:', e);
      }
    },

    /**
     * 지갑 데이터 가져오기
     */
    get() {
      return this.walletData;
    },

    /**
     * 지갑 데이터 저장 (Ethereum/Bitcoin 패턴)
     */
    save(walletData) {
      this.walletData = walletData;
    },

    /**
     * 지갑 데이터 설정 (호환성 메서드)
     * @deprecated Use save() instead
     */
    set(data) {
      this.save(data);
    },
    
    /**
     * 지갑 존재 확인
     */
    hasWallet() {
      return this.walletData !== null;
    },

    /**
     * 지갑 주소 가져오기
     */
    getAddress() {
      const wallet = this.walletData;
      return wallet?.address || null;
    },

    /**
     * 니모닉 가져오기 (보안 주의)
     */
    getMnemonic() {
      const wallet = this.walletData;
      return wallet?.mnemonic || null;
    },

    /**
     * 개인키 가져오기 (보안 주의)
     */
    getPrivateKey() {
      const wallet = this.walletData;
      return wallet?.privateKey || null;
    },
    
    /**
     * 니모닉 보안 가져오기 (비동기)
     */
    async getMnemonicSecure() {
      const wallet = await this.getSecure();
      return wallet ? wallet.mnemonic : null;
    },

    /**
     * 개인키 보안 가져오기 (비동기)
     */
    async getPrivateKeySecure() {
      const wallet = await this.getSecure();
      return wallet ? wallet.privateKey : null;
    },
    
    /**
     * 보안 데이터 가져오기 (비동기)
     */
    async getSecure() {
      // 1. 메모리 캐시 확인
      if (this.wallet) {
        return this.wallet;
      }

      // 2. 세션 스토리지 확인
      const sessionData = sessionStorage.getItem(this.KEYS.session);
      if (sessionData) {
        try {
          this.wallet = JSON.parse(sessionData);
          return this.wallet;
        } catch (e) {
          console.error('[WalletStorage] Failed to parse session data:', e);
        }
      }

      // 3. localStorage 확인 (공개 데이터만)
      const wallet = this.get();
      if (!wallet || !wallet.hasKeystore) {
        return wallet;  // 평문이거나 지갑 없음
      }

      // 4. Keystore 복호화
      return this.decryptKeystore(wallet.address);
    },

    /**
     * Keystore 복호화
     */
    decryptKeystore: async function(address) {
      const keystore = localStorage.getItem(`keystore_${address}`);

      if (!keystore) {
        console.error('[WalletStorage] Keystore not found for address:', address);
        return null;
      }

      // Keystore API 감지 - anamUI 우선, anam 폴백
      const keystoreAPI = (window.anamUI && window.anamUI.decryptKeystore) ? window.anamUI :
                          (window.anam && window.anam.decryptKeystore) ? window.anam : null;

      if (!keystoreAPI) {
        console.error('[WalletStorage] Keystore API not available in both anamUI and anam');
        return null;
      }

      return new Promise((resolve) => {
        const handler = (event) => {
          window.removeEventListener('keystoreDecrypted', handler);

          if (event.detail && event.detail.success) {
            const wallet = this.get() || {};
            let decryptedData = {};

            if (event.detail.secret) {
              // Secret hex를 바이트 배열로 변환
              const secretHex = event.detail.secret;
              const bytes = new Uint8Array(secretHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
              const decoder = new TextDecoder();
              const walletJson = decoder.decode(bytes);
              decryptedData = JSON.parse(walletJson);
            }

            const decrypted = {
              ...wallet,
              ...decryptedData,
              address: event.detail.address,
              decryptedAt: Date.now()
            };

            // 캐시 업데이트
            this.wallet = decrypted;
            sessionStorage.setItem(this.KEYS.session, JSON.stringify(decrypted));

            window.dispatchEvent(new Event('walletReady'));

            resolve(decrypted);
          } else {
            resolve(null);
          }
        };

        window.addEventListener('keystoreDecrypted', handler);

        // 복호화 요청 (감지된 API 사용)
        keystoreAPI.decryptKeystore(keystore);
      });
    },

    /**
     * 자동 복호화 (앱 시작 시)
     */
    autoDecrypt: function(address) {
      const keystore = localStorage.getItem(`keystore_${address}`);

      // Keystore API 감지 - anamUI 우선, anam 폴백
      const keystoreAPI = (window.anamUI && window.anamUI.decryptKeystore) ? window.anamUI :
                          (window.anam && window.anam.decryptKeystore) ? window.anam : null;

      if (keystore && keystoreAPI) {
        setTimeout(() => {
          this.decryptKeystore(address);
        }, 100);
      }
    },

    
    /**
     * 안전하게 지갑 저장 (Keystore API 사용)
     * @param {Object} walletData - 전체 wallet 객체
     */
    async saveSecure(walletData) {
      // 1. 공개 정보만 추출하여 localStorage에 저장
      const publicData = {
        address: walletData.address,
        hasKeystore: true,
        createdAt: new Date().toISOString()
      };
      
      // localStorage에 공개 정보만 저장 (privateKey, mnemonic 제외)
      localStorage.setItem(this.KEYS.storage, JSON.stringify(publicData));
      
      // 2. Keystore API 사용 가능 확인
      if (window.anamUI && window.anamUI.createKeystore) {
        return new Promise((resolve, reject) => {
          // 일회성 이벤트 리스너
          const handler = (event) => {
            window.removeEventListener('keystoreCreated', handler);
            
            if (event.detail && event.detail.keystore) {
              // 암호화된 keystore 저장
              localStorage.setItem(`keystore_${walletData.address}`, event.detail.keystore);
              
              // sessionStorage에 전체 데이터 캐시 (임시)
              const fullData = {
                ...publicData,
                ...walletData  // mnemonic, privateKey 포함
              };
              sessionStorage.setItem(this.KEYS.session, JSON.stringify(fullData));
              this.wallet = fullData;

              // 자동 복호화 트리거
              setTimeout(() => {
                this.autoDecrypt(walletData.address);
              }, 100);

              resolve(event.detail.keystore);
            } else {
              reject(new Error('Failed to create keystore'));
            }
          };
          
          window.addEventListener('keystoreCreated', handler);
          
          // 전체 wallet 데이터를 JSON으로 변환하여 암호화
          const walletJson = JSON.stringify({
            mnemonic: walletData.mnemonic,
            privateKey: walletData.privateKey
          });
          const encoder = new TextEncoder();
          const data = encoder.encode(walletJson);
          const hexArray = Array.from(data, byte => byte.toString(16).padStart(2, '0'));
          const secretHex = '0x' + hexArray.join('');
          window.anamUI.createKeystore(secretHex, walletData.address);
        });
      } else {
        console.warn('[WalletStorage] Keystore API not available, saving in plain text');
        const fullData = {
          ...publicData,
          ...walletData,
          hasKeystore: false
        };
        this.save(fullData);
        return Promise.resolve(null);
      }
    },

    /**
     * 네트워크 정보 가져오기
     */
    getNetwork() {
      // 네트워크는 Config에서 관리
      return window.SolanaConfig?.getActiveNetwork() || 'testnet';
    },

    /**
     * 지갑 데이터 업데이트 (Ethereum/Bitcoin 패턴)
     */
    update(updates) {
      const wallet = this.walletData;
      if (!wallet) return;

      const updatedWallet = { ...wallet, ...updates };
      this.save(updatedWallet);
    },

    /**
     * 지갑 데이터 업데이트 (호환성)
     * @deprecated Use update() instead
     */
    updateWallet(updates) {
      this.update(updates);
    },

    /**
     * 저장소 초기화
     */
    clear() {
      this.wallet = null;
      localStorage.removeItem(this.KEYS.storage);
      sessionStorage.removeItem(this.KEYS.session);
      console.log('[Storage] Cleared');
    },

    /**
     * 세션 캐시만 초기화
     */
    clearSession() {
      this.wallet = null;
      sessionStorage.removeItem(this.KEYS.session);
      console.log('[Storage] Session cleared');
    },

    /**
     * 저장소 상태 확인 (디버깅용)
     */
    getStatus() {
      return {
        hasMemory: this.wallet !== null,
        hasSession: sessionStorage.getItem(this.KEYS.session) !== null,
        hasStorage: localStorage.getItem(this.KEYS.storage) !== null,
        address: this.getAddress()
      };
    },

    /**
     * 백업 데이터 생성
     */
    exportWallet() {
      const wallet = this.walletData;
      if (!wallet) return null;

      // 민감한 정보를 포함한 전체 데이터
      return {
        version: '1.0',
        type: 'solana',
        timestamp: Date.now(),
        data: wallet
      };
    },

    /**
     * 백업 데이터 복원
     */
    importWallet(backupData) {
      if (!backupData || backupData.type !== 'solana') {
        throw new Error('Invalid backup data');
      }

      this.walletData = backupData.data;
      return true;
    }
  };

  // 전역 접근 헬퍼 함수
  window.getWalletStorage = () => window.WalletStorage;

  console.log('[WalletStorage] Loaded');

})();