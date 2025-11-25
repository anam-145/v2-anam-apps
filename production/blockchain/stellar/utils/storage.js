// ================================================================
// Stellar Wallet Storage Manager
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
      storage: 'stellar_wallet',
      session: 'stellar_wallet_cache'
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
        console.error('[WalletStorage.get] SessionStorage read error:', error);
      }

      // 3. LocalStorage에서 로드
      try {
        const stored = localStorage.getItem(this.KEYS.storage);
        if (stored) {
          const walletData = JSON.parse(stored);

          // Keystore가 있는 경우 - 공개 정보만 반환 (복호화 필요)
          if (walletData.hasKeystore) {
            // 복호화는 getSecure()나 init()에서 처리
            // 여기서는 공개 정보만 반환
            this.wallet = walletData;
            return walletData;
          }

          // 평문 데이터인 경우 (개발 환경)
          this.wallet = walletData;
          // SessionStorage에 캐싱
          sessionStorage.setItem(this.KEYS.session, JSON.stringify(this.wallet));
          return this.wallet;
        }
      } catch (error) {
        console.error('[WalletStorage.get] LocalStorage read error:', error);
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
        console.error('[WalletStorage] Save error:', error);
        return false;
      }
    },

    /**
     * 지갑 데이터 삭제
     */
    clear: function() {
      localStorage.removeItem(this.KEYS.storage);
      sessionStorage.removeItem(this.KEYS.session);

      // Vault도 삭제
      const wallet = this.wallet;
      if (wallet && wallet.address) {
        localStorage.removeItem(`vault_${wallet.address}`);
      }

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
        console.error('[WalletStorage] Init error:', error);
      }

      return this.wallet;
    },

    // ========== Helper Functions ==========

    /**
     * Vault API 감지 헬퍼
     * @returns {Object|null} anamUI 또는 anam 객체
     */
    _getVaultAPI: function() {
      if (window.anamUI && window.anamUI.decryptVault) return window.anamUI;
      if (window.anam && window.anam.decryptVault) return window.anam;
      return null;
    },

    // ========== Keystore API 통합 ==========

    /**
     * 안전하게 지갑 저장 (Keystore API 사용)
     * @param {Object} walletData - 전체 wallet 객체
     */
    saveSecure: async function(walletData) {
      // 1. 공개 정보만 추출하여 localStorage에 저장
      const publicData = {
        address: walletData.address,
        publicKey: walletData.publicKey || walletData.address,
        hasKeystore: true,
        createdAt: new Date().toISOString()
      };

      // localStorage에 공개 정보만 저장 (privateKey, mnemonic 제외)
      localStorage.setItem(this.KEYS.storage, JSON.stringify(publicData));

      // 2. Vault API 사용 (PBKDF2 + AES-256-GCM)
      if (window.anamUI && window.anamUI.createVault) {
        return new Promise((resolve, reject) => {
          const handler = (event) => {
            window.removeEventListener('vaultCreated', handler);

            if (event.detail && event.detail.vault) {
              // Vault 저장
              localStorage.setItem(`vault_${walletData.address}`, event.detail.vault);

              // sessionStorage 캐시
              const fullData = { ...publicData, ...walletData };
              sessionStorage.setItem(this.KEYS.session, JSON.stringify(fullData));
              this.wallet = fullData;

              resolve(event.detail.vault);
            } else {
              reject(new Error('Failed to create vault'));
            }
          };

          window.addEventListener('vaultCreated', handler);

          // JSON 문자열로 암호화
          const walletJson = JSON.stringify({
            mnemonic: walletData.mnemonic,
            privateKey: walletData.privateKey
          });
          window.anamUI.createVault(walletJson, walletData.address);
        });
      } else {
        console.warn('[Stellar] Vault API not available, saving in plain text');
        const fullData = { ...publicData, ...walletData, hasKeystore: false };
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

      // 3. Vault 복호화 필요
      const wallet = this.get();
      if (!wallet || !wallet.hasKeystore) {
        return wallet;
      }

      return this.decryptVault(wallet.address);
    },

    /**
     * Vault 복호화 (PBKDF2 + AES-256-GCM)
     */
    decryptVault: async function(address) {
      const vault = localStorage.getItem(`vault_${address}`);
      if (!vault) {
        console.error('[Stellar] Vault not found for address:', address);
        return null;
      }

      const vaultAPI = this._getVaultAPI();
      if (!vaultAPI) {
        console.error('[Stellar] Vault API not available');
        return null;
      }

      return new Promise((resolve) => {
        const handler = (event) => {
          window.removeEventListener('vaultDecrypted', handler);

          if (event.detail && event.detail.success) {
            try {
              const wallet = this.get() || {};
              const decryptedData = JSON.parse(event.detail.secret);

              const decrypted = {
                ...wallet,
                ...decryptedData,
                address: wallet.address || event.detail.address,
                decryptedAt: Date.now()
              };

              // 캐시 업데이트
              this.wallet = decrypted;
              sessionStorage.setItem(this.KEYS.session, JSON.stringify(decrypted));
              window.dispatchEvent(new Event('walletReady'));

              resolve(decrypted);
            } catch (e) {
              console.error('[Stellar] Vault decryption failed:', e);
              resolve(null);
            }
          } else {
            console.error('[Stellar] Vault decryption failed');
            resolve(null);
          }
        };

        window.addEventListener('vaultDecrypted', handler);
        vaultAPI.decryptVault(vault);
      });
    },

    /**
     * 자동 복호화 (앱 시작 시)
     */
    autoDecrypt: function(address) {
      const vault = localStorage.getItem(`vault_${address}`);
      const vaultAPI = this._getVaultAPI();

      if (vault && vaultAPI) {
        this.decryptVault(address);
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
      return wallet ? wallet.privateKey : null;
    }
  };

  // ================================================================
  // 캐시 관리자
  // ================================================================

  window.CacheManager = {
    set: function(key, data, ttl) {
      try {
        const cacheData = {
          data: data,
          expiry: Date.now() + ttl
        };
        localStorage.setItem(key, JSON.stringify(cacheData));
        return true;
      } catch (error) {
        console.error('[Cache] Set failed:', error);
        return false;
      }
    },

    get: function(key) {
      try {
        const cached = localStorage.getItem(key);
        if (!cached) return null;

        const cacheData = JSON.parse(cached);

        // 만료 확인
        if (Date.now() > cacheData.expiry) {
          localStorage.removeItem(key);
          return null;
        }

        return cacheData.data;
      } catch (error) {
        console.error('[Cache] Get failed:', error);
        return null;
      }
    },

    clear: function(key) {
      try {
        localStorage.removeItem(key);
        return true;
      } catch (error) {
        console.error('[Cache] Clear failed:', error);
        return false;
      }
    },

    clearAll: function(prefix) {
      try {
        const keys = Object.keys(localStorage);
        for (const key of keys) {
          if (key.startsWith(prefix)) {
            localStorage.removeItem(key);
          }
        }
        return true;
      } catch (error) {
        console.error('[Cache] Clear all failed:', error);
        return false;
      }
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

  console.log('[WalletStorage] Module loaded with Keystore API support for Stellar');
})();
