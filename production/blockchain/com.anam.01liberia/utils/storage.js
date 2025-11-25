// ================================================================
// Liberia Stellar Wallet Storage Manager
// 단순화된 버전 - deriveKey API 사용으로 Vault 불필요
// localStorage에는 주소만 저장
// ================================================================

(function() {
  'use strict';

  window.WalletStorage = {
    // 메모리 캐시
    wallet: null,
    getDefaultPath: function() {
      return (window.LiberiaConfig && window.LiberiaConfig.BIP44_PATH) || "m/44'/148'/0'";
    },
    getDefaultCurve: function() {
      return (window.LiberiaConfig && window.LiberiaConfig.CURVE) || "ed25519";
    },

    // Storage 키
    KEYS: {
      storage: 'liberia_stellar_wallet',
      session: 'liberia_stellar_wallet_cache'
    },

    /**
     * 지갑 데이터 가져오기
     */
    get: function() {
      if (this.wallet) {
        return this.wallet;
      }

      try {
        const cached = sessionStorage.getItem(this.KEYS.session);
        if (cached) {
          this.wallet = JSON.parse(cached);
          return this.wallet;
        }
      } catch (error) {
        console.error('[WalletStorage.get] SessionStorage read error:', error);
      }

      try {
        const stored = localStorage.getItem(this.KEYS.storage);
        if (stored) {
          this.wallet = JSON.parse(stored);
          sessionStorage.setItem(this.KEYS.session, stored);
          return this.wallet;
        }
      } catch (error) {
        console.error('[WalletStorage.get] LocalStorage read error:', error);
      }

      return null;
    },

    /**
     * 지갑 데이터 저장
     * deriveKey 사용으로 주소만 저장 (privateKey는 저장 안함)
     */
    save: function(walletData) {
      try {
        // 공개 정보만 저장
        const publicData = {
          address: walletData.address,
          createdAt: walletData.createdAt || new Date().toISOString()
        };

        const data = JSON.stringify(publicData);
        localStorage.setItem(this.KEYS.storage, data);
        sessionStorage.setItem(this.KEYS.session, data);
        this.wallet = publicData;
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
     * 파생된 프라이빗키를 즉시 반환 (저장하지 않음)
     * deriveKey 지원이 없거나 adapter가 없으면 예외 발생
     */
    getPrivateKeySecure: async function(path, curve) {
      const adapter = (typeof window.getAdapter === 'function') ? window.getAdapter() : null;
      if (!adapter || typeof adapter.getWallet !== 'function') {
        throw new Error('Adapter or deriveKey API not available');
      }

      const targetPath = path || this.getDefaultPath();
      const targetCurve = curve || this.getDefaultCurve();
      const derived = await adapter.getWallet(targetPath, targetCurve);

      // 주소 로컬 저장소 없으면 저장
      if (derived && derived.address && !this.getAddress()) {
        this.save({ address: derived.address, createdAt: new Date().toISOString() });
      }

      return derived?.privateKey || null;
    },

    /**
     * 보안 데이터 요청 호환용 (니모닉 없음)
     */
    getSecure: async function() {
      return null;
    },

    /**
     * 초기화
     */
    init: function() {
      if (this.wallet || sessionStorage.getItem(this.KEYS.session)) {
        return this.get();
      }

      try {
        const stored = localStorage.getItem(this.KEYS.storage);
        if (stored) {
          this.wallet = JSON.parse(stored);
          sessionStorage.setItem(this.KEYS.session, stored);
        }
      } catch (error) {
        console.error('Storage init error:', error);
      }

      return this.wallet;
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

  console.log('[WalletStorage] Liberia Stellar module loaded - simplified (deriveKey API)');
})();
