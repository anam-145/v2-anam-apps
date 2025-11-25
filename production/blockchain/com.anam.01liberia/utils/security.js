// ================================================================
// Security Utilities for Liberia (deriveKey-based)
// Simplified version - no HDWalletManager dependency
// ================================================================

(function() {
  'use strict';

  window.SecurityUtils = {
    // ================================================================
    // Memory Clearing
    // ================================================================

    /**
     * Attempts to clear a string from memory
     * @param {string} str - String to clear
     * @returns {null}
     */
    clearString: function(str) {
      if (typeof str !== 'string') return null;
      for (let i = 0; i < str.length; i++) {
        str = str.substring(0, i) + '0' + str.substring(i + 1);
      }
      return null;
    },

    // ================================================================
    // Auto-Lock Feature
    // ================================================================

    /**
     * Setup auto-lock after inactivity
     * @param {number} minutes - Minutes of inactivity before locking
     */
    setupAutoLock: function(minutes = 5) {
      let timeout;

      const resetTimer = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          console.log('[Security] Auto-locking due to inactivity');
          this.lockWallet();
        }, minutes * 60 * 1000);
      };

      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, resetTimer, true);
      });

      resetTimer();
      console.log(`[Security] Auto-lock enabled (${minutes} minutes)`);
    },

    /**
     * Lock wallet (clear session data)
     */
    lockWallet: function() {
      sessionStorage.removeItem('liberia_wallet_cache');
      console.log('[Security] Wallet locked');
      window.dispatchEvent(new Event('walletLocked'));
    },

    // ================================================================
    // Data Sanitization
    // ================================================================

    /**
     * Check if data contains private key
     * @private
     */
    containsPrivateKey: function(data) {
      if (typeof data === 'string') {
        return data.startsWith('0x') && data.length === 66;
      }
      if (typeof data === 'object' && data !== null) {
        for (const key in data) {
          if (key === 'privateKey' && data[key]) return true;
          if (typeof data[key] === 'object' && this.containsPrivateKey(data[key])) return true;
        }
      }
      return false;
    },

    /**
     * Audit localStorage for sensitive data
     */
    auditLocalStorage: function() {
      const report = { privateKeysFound: 0, sensitiveKeys: [] };

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);
        try {
          const data = JSON.parse(value);
          if (this.containsPrivateKey(data)) {
            report.privateKeysFound++;
            report.sensitiveKeys.push(key);
          }
        } catch { /* not JSON */ }
      }

      return report;
    }
  };

  // Auto-setup on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      window.SecurityUtils.setupAutoLock(5);
      console.log('[SecurityUtils] Module loaded (Liberia)');
    });
  } else {
    window.SecurityUtils.setupAutoLock(5);
    console.log('[SecurityUtils] Module loaded (Liberia)');
  }

})();
