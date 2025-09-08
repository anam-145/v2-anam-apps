// ================================================================
// Ethereum Wallet Storage Manager
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
      storage: 'eth_wallet',
      session: 'eth_wallet_cache'
    },

    /**
     * 지갑 데이터 가져오기
     * 우선순위: 메모리 > sessionStorage > localStorage
     */
    get: function() {
      // 1. 메모리 캐시 확인
      if (this.wallet) {
        return this.wallet;
      }

      // 2. SessionStorage 확인
      try {
        const cached = sessionStorage.getItem(this.KEYS.session);
        if (cached) {
          this.wallet = JSON.parse(cached);
          return this.wallet;
        }
      } catch (error) {
        console.error('SessionStorage read error:', error);
      }

      // 3. LocalStorage에서 로드
      try {
        const stored = localStorage.getItem(this.KEYS.storage);
        if (stored) {
          this.wallet = JSON.parse(stored);
          // SessionStorage에 캐싱
          sessionStorage.setItem(this.KEYS.session, stored);
          return this.wallet;
        }
      } catch (error) {
        console.error('LocalStorage read error:', error);
      }

      return null;
    },

    /**
     * 지갑 데이터 저장
     * localStorage와 sessionStorage 모두 업데이트
     */
    save: function(walletData) {
      try {
        const data = JSON.stringify(walletData);
        localStorage.setItem(this.KEYS.storage, data);
        sessionStorage.setItem(this.KEYS.session, data);
        this.wallet = walletData;
        return true;
      } catch (error) {
        console.error('Storage save error:', error);
        return false;
      }
    },

    /**
     * 지갑 데이터 삭제
     */
    clear: function() {
      localStorage.removeItem(this.KEYS.storage);
      sessionStorage.removeItem(this.KEYS.session);
      this.wallet = null;
    },

    /**
     * 지갑 존재 여부 확인
     */
    exists: function() {
      return this.get() !== null;
    },

    /**
     * 주소만 가져오기
     */
    getAddress: function() {
      const wallet = this.get();
      return wallet ? wallet.address : null;
    },

    /**
     * 개인키 가져오기 (주의: 보안 민감)
     */
    getPrivateKey: function() {
      const wallet = this.get();
      return wallet ? wallet.privateKey : null;
    },

    /**
     * 니모닉 가져오기
     */
    getMnemonic: function() {
      const wallet = this.get();
      return wallet ? wallet.mnemonic : null;
    },

    /**
     * 지갑 업데이트 (부분 업데이트)
     */
    update: function(updates) {
      const wallet = this.get();
      if (wallet) {
        const updated = Object.assign({}, wallet, updates);
        return this.save(updated);
      }
      return false;
    },

    /**
     * 초기화 (페이지 로드 시 호출)
     * localStorage에서 sessionStorage로 캐싱
     */
    init: function() {
      // 이미 초기화되었으면 스킵
      if (this.wallet || sessionStorage.getItem(this.KEYS.session)) {
        return this.get();
      }

      // localStorage에서 로드
      try {
        const stored = localStorage.getItem(this.KEYS.storage);
        if (stored) {
          const walletData = JSON.parse(stored);
          
          // Keystore가 있으면 자동 복호화 시도
          if (walletData.hasKeystore) {
            this.autoDecrypt(walletData.address);
          } else {
            // 평문 데이터 (개발 환경)
            sessionStorage.setItem(this.KEYS.session, stored);
            this.wallet = walletData;
          }
        }
      } catch (error) {
        console.error('Storage init error:', error);
      }

      return this.wallet;
    },

    // ========== Keystore API 통합 ==========

    /**
     * 안전하게 지갑 저장 (Keystore API 사용)
     * @param {string} mnemonic - 니모닉 문구
     * @param {string} address - 지갑 주소
     * @param {string} privateKey - 개인키 (사용 안 함, mnemonic에서 유도)
     */
    saveSecure: async function(mnemonic, address, privateKey) {
      // 1. 공개 정보만 localStorage에 저장
      const publicData = {
        address: address,
        hasKeystore: true,
        createdAt: new Date().toISOString()
      };
      
      // localStorage에 공개 정보 저장
      localStorage.setItem(this.KEYS.storage, JSON.stringify(publicData));
      
      // 2. Keystore API 사용 가능 확인
      if (window.anamUI && window.anamUI.createKeystore) {
        return new Promise((resolve, reject) => {
          // 일회성 이벤트 리스너
          const handler = (event) => {
            window.removeEventListener('keystoreCreated', handler);
            
            if (event.detail && event.detail.keystore) {
              // 암호화된 keystore 저장
              localStorage.setItem(`keystore_${address}`, event.detail.keystore);
              
              // sessionStorage에 평문 캐시
              const fullData = {
                ...publicData,
                mnemonic: mnemonic,
                privateKey: privateKey
              };
              sessionStorage.setItem(this.KEYS.session, JSON.stringify(fullData));
              this.wallet = fullData;
              
              console.log('[WalletStorage] Wallet saved securely with Keystore API');
              resolve(event.detail.keystore);
            } else {
              reject(new Error('Failed to create keystore'));
            }
          };
          
          window.addEventListener('keystoreCreated', handler);
          
          const encoder = new TextEncoder();
          const data = encoder.encode(mnemonic);
          const hexArray = Array.from(data, byte => byte.toString(16).padStart(2, '0'));
          const secretHex = '0x' + hexArray.join('');
          
          window.anamUI.createKeystore(secretHex, address);
        });
      } else {
        console.warn('[WalletStorage] Keystore API not available, saving in plain text');
        const fullData = {
          ...publicData,
          mnemonic: mnemonic,
          hasKeystore: false
        };
        this.save(fullData);
        return Promise.resolve(null);
      }
    },

    /**
     * 암호화된 지갑 복호화
     */
    getSecure: async function() {
      // 1. 이미 복호화된 데이터 확인
      if (this.wallet && this.wallet.mnemonic) {
        return this.wallet;
      }
      
      // 2. sessionStorage 확인
      const cached = sessionStorage.getItem(this.KEYS.session);
      if (cached) {
        const data = JSON.parse(cached);
        if (data.mnemonic) {
          this.wallet = data;
          return data;
        }
      }
      
      // 3. 복호화 필요
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
            
            const secretHex = event.detail.secret;
            let mnemonic = null;
            let privateKey = null;
            
            try {
              const bytes = new Uint8Array(secretHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
              const decoder = new TextDecoder();
              mnemonic = decoder.decode(bytes);
              
              if (mnemonic && window.ethers) {
                try {
                  const hdWallet = ethers.Wallet.fromMnemonic(mnemonic);
                  privateKey = hdWallet.privateKey;
                } catch (e) {
                  console.error('[WalletStorage] Failed to derive privateKey:', e.message);
                }
              }
            } catch (decodeError) {
              console.error('[WalletStorage] Failed to decode hex:', decodeError.message);
            }
            
            const decrypted = {
              ...wallet,
              mnemonic: mnemonic,
              privateKey: privateKey,
              address: event.detail.address,
              decryptedAt: Date.now()
            };
            
            // 캐시 업데이트
            this.wallet = decrypted;
            sessionStorage.setItem(this.KEYS.session, JSON.stringify(decrypted));
            
            window.dispatchEvent(new Event('walletReady'));
            resolve(decrypted);
          } else {
            console.error('[WalletStorage] Decryption failed');
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
        console.log('[WalletStorage] Auto-decrypting wallet using:', keystoreAPI === window.anamUI ? 'anamUI' : 'anam');
        
        // 비동기로 복호화 진행
        setTimeout(() => {
          this.decryptKeystore(address);
        }, 100);
      }
    },

    /**
     * 민감한 데이터 접근 헬퍼
     */
    getMnemonicSecure: async function() {
      const wallet = await this.getSecure();
      return wallet ? wallet.mnemonic : null;
    },

    getPrivateKeySecure: async function() {
      const wallet = await this.getSecure();
      // 이미 캐싱된 privateKey 바로 반환 - 초고속!
      return wallet ? wallet.privateKey : null;
    }
  };

  // 페이지 로드 시 자동 초기화
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      WalletStorage.init();
    });
  } else {
    WalletStorage.init();
  }

  console.log('[WalletStorage] Module loaded with Keystore API support');
})();