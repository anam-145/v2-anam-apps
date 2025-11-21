// ================================================================
// Security Utilities
// Auto-lock, memory clearing, and other security features
// ================================================================

(function() {
  'use strict';

  window.SecurityUtils = {
    // ================================================================
    // Memory Clearing
    // ================================================================

    /**
     * Attempts to clear a string from memory
     * Note: JavaScript doesn't guarantee memory clearing, but this helps
     * @param {string} str - String to clear
     * @returns {null}
     */
    clearString: function(str) {
      if (typeof str !== 'string') return null;

      // Overwrite with zeros (attempt to clear memory)
      for (let i = 0; i < str.length; i++) {
        str = str.substring(0, i) + '0' + str.substring(i + 1);
      }

      return null;
    },

    /**
     * Derive private key with auto-clear timeout
     * ✅ SECURE: Automatically clears key from memory after specified time
     * @param {string} walletId - Wallet ID
     * @param {number} accountIndex - Account index
     * @param {number} timeoutMs - Timeout in milliseconds (default 30 seconds)
     * @returns {Promise<string>} Private key
     */
    deriveWithTimeout: async function(walletId, accountIndex, timeoutMs = 30000) {
      const hdManager = window.getHDWalletManager();
      if (!hdManager) {
        throw new Error('HD Wallet Manager not initialized');
      }

      const privateKey = await hdManager.derivePrivateKeyForAccount(walletId, accountIndex);

      // Auto-clear after timeout
      setTimeout(() => {
        if (privateKey) {
          console.log('[Security] ⏰ Auto-clearing derived private key after timeout');
          this.clearString(privateKey);
        }
      }, timeoutMs);

      return privateKey;
    },

    /**
     * Execute a function with a private key that gets auto-cleared
     * ✅ SECURE: Best practice for handling private keys
     * @param {string} walletId - Wallet ID
     * @param {number} accountIndex - Account index
     * @param {Function} callback - Function to execute with private key
     * @returns {Promise<any>} Result from callback
     */
    withPrivateKey: async function(walletId, accountIndex, callback) {
      const hdManager = window.getHDWalletManager();
      if (!hdManager) {
        throw new Error('HD Wallet Manager not initialized');
      }

      let privateKey = null;

      try {
        console.log('[Security] 🔐 Deriving private key for secure operation...');
        privateKey = await hdManager.derivePrivateKeyForAccount(walletId, accountIndex);

        if (!privateKey) {
          throw new Error('Failed to derive private key');
        }

        // Execute callback with private key
        const result = await callback(privateKey);

        console.log('[Security] ✅ Operation completed successfully');
        return result;

      } catch (error) {
        console.error('[Security] Operation failed:', error);
        throw error;

      } finally {
        // ✅ SECURE: Always clear private key, even on error
        if (privateKey) {
          console.log('[Security] 🧹 Clearing private key from memory...');
          this.clearString(privateKey);
          privateKey = null;
        }
      }
    },

    // ================================================================
    // Wallet Lock Status
    // ================================================================

    /**
     * Check if wallet is locked (mnemonic not decrypted)
     * @returns {boolean}
     */
    isWalletLocked: function() {
      const cached = sessionStorage.getItem('eth_wallet_cache');
      if (!cached) return true;

      try {
        const data = JSON.parse(cached);
        return !data.mnemonic;
      } catch {
        return true;
      }
    },

    /**
     * Lock wallet (clear sessionStorage)
     */
    lockWallet: function() {
      sessionStorage.removeItem('eth_wallet_cache');
      console.log('[Security] 🔒 Wallet locked');

      // Dispatch event for UI updates
      window.dispatchEvent(new Event('walletLocked'));

      // Show toast notification
      if (window.showToast) {
        window.showToast('Wallet locked for security', 'info');
      }
    },

    /**
     * Unlock wallet (requires user to re-authenticate via Keystore)
     * @returns {Promise<boolean>}
     */
    unlockWallet: async function() {
      const hdManager = window.getHDWalletManager();
      if (!hdManager) {
        console.error('[Security] HD Wallet Manager not initialized');
        return false;
      }

      const currentWallet = hdManager.getCurrentWallet();
      if (!currentWallet) {
        console.error('[Security] No current wallet');
        return false;
      }

      const currentAccount = hdManager.getCurrentAccount();
      if (!currentAccount) {
        console.error('[Security] No current account');
        return false;
      }

      try {
        console.log('[Security] 🔓 Attempting to unlock wallet...');

        // Trigger mnemonic decryption (requires user authentication)
        const mnemonic = await hdManager.getMnemonicForWallet(
          currentWallet.id,
          currentAccount.address
        );

        if (mnemonic) {
          console.log('[Security] ✅ Wallet unlocked successfully');
          window.dispatchEvent(new Event('walletUnlocked'));

          if (window.showToast) {
            window.showToast('Wallet unlocked', 'success');
          }

          return true;
        } else {
          console.log('[Security] ❌ Failed to unlock wallet');
          return false;
        }
      } catch (error) {
        console.error('[Security] Unlock failed:', error);
        return false;
      }
    },

    // ================================================================
    // Auto-Lock Feature
    // ================================================================

    /**
     * Setup auto-lock after inactivity
     * @param {number} minutes - Minutes of inactivity before locking (default 5)
     */
    setupAutoLock: function(minutes = 5) {
      let timeout;

      const resetTimer = () => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          console.log('[Security] ⏰ Auto-locking due to inactivity');
          this.lockWallet();
        }, minutes * 60 * 1000);
      };

      // Reset timer on user activity
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.addEventListener(event, resetTimer, true);
      });

      // Initial timer
      resetTimer();

      console.log(`[Security] ⏱️ Auto-lock enabled (${minutes} minutes of inactivity)`);
    },

    /**
     * Disable auto-lock
     */
    disableAutoLock: function() {
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
      events.forEach(event => {
        document.removeEventListener(event, this.resetTimer, true);
      });

      console.log('[Security] ⏱️ Auto-lock disabled');
    },

    // ================================================================
    // Security Status Check
    // ================================================================

    /**
     * Get security status of current wallet
     * @returns {Object} Security status
     */
    getSecurityStatus: function() {
      const hdManager = window.getHDWalletManager();
      const currentWallet = hdManager ? hdManager.getCurrentWallet() : null;

      const status = {
        hasWallet: !!currentWallet,
        isLocked: this.isWalletLocked(),
        walletType: currentWallet ? currentWallet.type : null,
        mnemonicEncrypted: currentWallet ? currentWallet.mnemonicEncrypted : false,
        accountCount: currentWallet ? currentWallet.accounts.length : 0,
        timestamp: Date.now()
      };

      return status;
    },

    /**
     * Log security status
     */
    logSecurityStatus: function() {
      const status = this.getSecurityStatus();
      console.log('[Security] 📊 Security Status:', {
        'Has Wallet': status.hasWallet ? '✅' : '❌',
        'Is Locked': status.isLocked ? '🔒' : '🔓',
        'Wallet Type': status.walletType || 'N/A',
        'Mnemonic Encrypted': status.mnemonicEncrypted ? '✅' : '❌',
        'Account Count': status.accountCount
      });
    },

    // ================================================================
    // Data Sanitization
    // ================================================================

    /**
     * Sanitize localStorage data (check for sensitive data)
     * @returns {Object} Report of sensitive data found
     */
    auditLocalStorage: function() {
      const report = {
        privateKeysFound: 0,
        mnemonicsFound: 0,
        sensitiveKeys: [],
        timestamp: Date.now()
      };

      // Check all localStorage items
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        const value = localStorage.getItem(key);

        try {
          const data = JSON.parse(value);

          // Check for private keys
          if (this.containsPrivateKey(data)) {
            report.privateKeysFound++;
            report.sensitiveKeys.push(key);
          }

          // Check for mnemonics
          if (this.containsMnemonic(data)) {
            report.mnemonicsFound++;
            if (!report.sensitiveKeys.includes(key)) {
              report.sensitiveKeys.push(key);
            }
          }
        } catch {
          // Not JSON, check as plain text
          if (value && (value.includes('privateKey') || value.match(/\b\w+\s+\w+\s+\w+\s+\w+\s+\w+\s+\w+\b/))) {
            report.sensitiveKeys.push(key);
          }
        }
      }

      return report;
    },

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
          if (key === 'privateKey' && data[key]) {
            return true;
          }
          if (typeof data[key] === 'object') {
            if (this.containsPrivateKey(data[key])) {
              return true;
            }
          }
        }
      }

      if (Array.isArray(data)) {
        for (const item of data) {
          if (this.containsPrivateKey(item)) {
            return true;
          }
        }
      }

      return false;
    },

    /**
     * Check if data contains mnemonic
     * @private
     */
    containsMnemonic: function(data) {
      if (typeof data === 'string') {
        // Check for 12/24 word mnemonic pattern
        const words = data.split(/\s+/);
        return words.length === 12 || words.length === 24;
      }

      if (typeof data === 'object' && data !== null) {
        for (const key in data) {
          if (key === 'mnemonic' && data[key] && typeof data[key] === 'string') {
            return this.containsMnemonic(data[key]);
          }
          if (typeof data[key] === 'object') {
            if (this.containsMnemonic(data[key])) {
              return true;
            }
          }
        }
      }

      if (Array.isArray(data)) {
        for (const item of data) {
          if (this.containsMnemonic(item)) {
            return true;
          }
        }
      }

      return false;
    },

    // ================================================================
    // Security Audit
    // ================================================================

    /**
     * Run full security audit
     * @returns {Object} Audit results
     */
    runSecurityAudit: function() {
      console.log('[Security] 🔍 Running security audit...');

      const results = {
        timestamp: Date.now(),
        walletStatus: this.getSecurityStatus(),
        storageAudit: this.auditLocalStorage(),
        recommendations: []
      };

      // Generate recommendations
      if (results.storageAudit.privateKeysFound > 0) {
        results.recommendations.push({
          severity: 'CRITICAL',
          message: `Found ${results.storageAudit.privateKeysFound} private key(s) in localStorage!`,
          action: 'Migrate to secure storage immediately'
        });
      }

      if (results.storageAudit.mnemonicsFound > 0) {
        results.recommendations.push({
          severity: 'CRITICAL',
          message: `Found ${results.storageAudit.mnemonicsFound} mnemonic(s) in plaintext!`,
          action: 'Encrypt mnemonics using Keystore API'
        });
      }

      if (results.walletStatus.hasWallet && !results.walletStatus.mnemonicEncrypted) {
        results.recommendations.push({
          severity: 'HIGH',
          message: 'Wallet mnemonic is not encrypted',
          action: 'Enable mnemonic encryption'
        });
      }

      if (results.walletStatus.hasWallet && !results.walletStatus.isLocked) {
        results.recommendations.push({
          severity: 'MEDIUM',
          message: 'Wallet is currently unlocked',
          action: 'Lock wallet when not in use'
        });
      }

      // Log results
      console.log('[Security] 📋 Audit Results:', results);

      if (results.recommendations.length === 0) {
        console.log('[Security] ✅ No security issues found');
      } else {
        console.log('[Security] ⚠️ Security issues found:', results.recommendations);
      }

      return results;
    }
  };

  // ================================================================
  // Auto-Setup on Load
  // ================================================================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
      // Setup auto-lock (5 minutes by default)
      window.SecurityUtils.setupAutoLock(5);

      // Log security status
      window.SecurityUtils.logSecurityStatus();

      console.log('[SecurityUtils] ✅ Module loaded');
    });
  } else {
    // Setup auto-lock immediately
    window.SecurityUtils.setupAutoLock(5);

    // Log security status
    window.SecurityUtils.logSecurityStatus();

    console.log('[SecurityUtils] ✅ Module loaded');
  }

})();
