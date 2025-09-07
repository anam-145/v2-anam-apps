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
          sessionStorage.setItem(this.KEYS.session, stored);
          this.wallet = JSON.parse(stored);
        }
      } catch (error) {
        console.error('Storage init error:', error);
      }

      return this.wallet;
    }
  };

  console.log('[WalletStorage] Module loaded');
})();