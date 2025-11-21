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
     */
    saveSecure: async function(mnemonic, address) {
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

              // ✅ SECURE: Only cache public data, NO sensitive data in sessionStorage
              sessionStorage.setItem(this.KEYS.session, JSON.stringify(publicData));
              this.wallet = publicData;

              console.log('[WalletStorage] Wallet saved securely with Keystore API (no sensitive data cached)');
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
     * ❌ DEPRECATED: Use getMnemonicSecure() or derive keys on-demand instead
     * This method is kept for backward compatibility but should not be used
     */
    getSecure: async function() {
      console.warn('[WalletStorage] getSecure() is deprecated. Use getMnemonicSecure() for on-demand derivation.');
      const wallet = this.get();
      return wallet;  // Only return public data
    },

    /**
     * Keystore 복호화 (On-Demand, NO CACHING)
     * ✅ SECURE: Returns decrypted mnemonic but does NOT cache it
     * Caller MUST clear the mnemonic from memory after use
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

      console.log('[WalletStorage] 🔐 Decrypting keystore on-demand (no caching)...');

      return new Promise((resolve) => {
        const handler = (event) => {
          window.removeEventListener('keystoreDecrypted', handler);

          if (event.detail && event.detail.success) {
            const secretHex = event.detail.secret;
            let mnemonic = null;

            try {
              const bytes = new Uint8Array(secretHex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
              const decoder = new TextDecoder();
              mnemonic = decoder.decode(bytes);
            } catch (decodeError) {
              console.error('[WalletStorage] Failed to decode hex:', decodeError.message);
            }

            // ✅ SECURE: Return mnemonic directly, NO caching anywhere
            console.log('[WalletStorage] ✅ Mnemonic decrypted (temporary, not cached)');
            window.dispatchEvent(new Event('walletReady'));
            resolve(mnemonic);
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
     * ❌ REMOVED: Auto-decryption disabled for security
     * Mnemonic should only be decrypted on-demand when needed
     */
    autoDecrypt: function() {
      console.log('[WalletStorage] Auto-decrypt disabled. Use on-demand decryption for security.');
      // No automatic decryption - require explicit user action
    },

    /**
     * ✅ SECURE: Get mnemonic on-demand (NO CACHING)
     * Caller MUST clear mnemonic from memory after use
     */
    getMnemonicSecure: async function() {
      const wallet = this.get();
      if (!wallet) {
        console.error('[WalletStorage] No wallet found');
        return null;
      }

      if (!wallet.hasKeystore) {
        console.warn('[WalletStorage] Wallet does not use Keystore encryption');
        return wallet.mnemonic || null;
      }

      // Decrypt on-demand (requires user authentication)
      const mnemonic = await this.decryptKeystore(wallet.address);
      return mnemonic;
    },

    /**
     * ❌ DEPRECATED: Do not use this method
     * Instead, derive private key from mnemonic on-demand using HDWalletManager
     */
    getPrivateKeySecure: async function() {
      console.error('[WalletStorage] getPrivateKeySecure() is deprecated. Use HDWalletManager.derivePrivateKeyForAccount() instead.');
      return null;
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