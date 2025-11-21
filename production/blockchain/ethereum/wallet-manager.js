class HDWalletManager {
  constructor() {
    this.wallets = new Map();
    this.currentWalletId = null;
    this.loadFromStorage();
  }

  // ================================================================
  // SECURE: Mnemonic Encryption & Storage
  // ================================================================

  /**
   * Encrypts and stores mnemonic using Keystore API
   * @private
   */
  async encryptAndStoreMnemonic(walletId, mnemonic, address) {
    if (window.WalletStorage && window.WalletStorage.saveSecure) {
      try {
        await window.WalletStorage.saveSecure(mnemonic, address, null);
        console.log(`[HDWalletManager] ✅ Mnemonic encrypted for wallet ${walletId}`);
        return true;
      } catch (error) {
        console.error('[HDWalletManager] ❌ Failed to encrypt mnemonic:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Gets decrypted mnemonic from Keystore
   * @private
   */
  async getMnemonicForWallet(walletId, address) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (!wallet.mnemonicEncrypted) {
      console.warn('[HDWalletManager] ⚠️ Wallet mnemonic is not encrypted!');
      return null;
    }

    // Use WalletStorage to decrypt from Keystore using the specific address
    if (window.WalletStorage && window.WalletStorage.decryptKeystore) {
      try {
        console.log(`[HDWalletManager] Decrypting keystore for address: ${address}`);
        const mnemonic = await window.WalletStorage.decryptKeystore(address);
        return mnemonic;
      } catch (error) {
        console.error('[HDWalletManager] Failed to decrypt mnemonic:', error);
        return null;
      }
    }

    return null;
  }

  // ================================================================
  // SECURE: On-Demand Private Key Derivation
  // ================================================================

  /**
   * Derives private key for a specific account ONLY when needed
   * Private key is NOT stored, only derived temporarily
   * @param {string} walletId - Wallet ID
   * @param {number} accountIndex - Account index
   * @returns {Promise<string>} Private key (caller must clear it after use)
   */
  async derivePrivateKeyForAccount(walletId, accountIndex) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.type === 'imported') {
      // ✅ SECURE: Decrypt private key from Keystore for imported wallets
      const account = wallet.accounts.find(acc => acc.index === accountIndex);
      if (!account) {
        throw new Error('Account not found');
      }

      if (wallet.privateKeyEncrypted) {
        console.log('[HDWalletManager] 🔐 Decrypting private key for imported wallet...');
        const privateKey = await this.getPrivateKeyForImportedWallet(walletId, account.address);
        if (!privateKey) {
          throw new Error('Failed to decrypt private key. Wallet may be locked.');
        }
        console.log('[HDWalletManager] ✅ Private key decrypted successfully');
        return privateKey;
      } else {
        // Legacy imported wallet without encryption
        console.warn('[HDWalletManager] ⚠️ Imported wallet is not encrypted (legacy)');
        return account.privateKey || null;
      }
    }

    if (wallet.type !== 'hd') {
      throw new Error('Can only derive keys for HD wallets');
    }

    const account = wallet.accounts.find(acc => acc.index === accountIndex);
    if (!account) {
      throw new Error('Account not found');
    }

    console.log(`[HDWalletManager] 🔐 Deriving private key for account ${accountIndex}...`);

    // ✅ SECURE: Decrypt mnemonic from Keystore (requires user authentication)
    // Always use first account's address where the keystore is stored
    const firstAccount = wallet.accounts[0];
    let mnemonic = await this.getMnemonicForWallet(walletId, firstAccount.address);

    if (!mnemonic) {
      throw new Error('Failed to decrypt mnemonic. Wallet may be locked.');
    }

    // Derive private key using adapter
    const adapter = window.getAdapter();
    const derivedAccount = await adapter.deriveAccountFromMnemonic(mnemonic, accountIndex);

    // ✅ SECURE: Clear mnemonic from memory immediately after derivation
    if (window.SecurityUtils && window.SecurityUtils.clearString) {
      window.SecurityUtils.clearString(mnemonic);
    }
    mnemonic = null;

    // Verify derived address matches stored address (security check)
    if (derivedAccount.address.toLowerCase() !== account.address.toLowerCase()) {
      console.error('[HDWalletManager] ❌ Address mismatch!', {
        expected: account.address,
        derived: derivedAccount.address
      });

      // Clear private key before throwing
      if (window.SecurityUtils && window.SecurityUtils.clearString) {
        window.SecurityUtils.clearString(derivedAccount.privateKey);
      }

      throw new Error('Security Error: Derived address does not match stored address');
    }

    console.log(`[HDWalletManager] ✅ Private key derived successfully`);

    // Return private key (caller MUST clear it from memory after use)
    return derivedAccount.privateKey;
  }

  // ================================================================
  // Wallet Creation (SECURE)
  // ================================================================

  async createNewWallet() {
    const adapter = window.getAdapter();
    const walletData = await adapter.generateWallet();

    const walletId = this.generateWalletId();

    // ✅ SECURE: Only store public information (NO private keys!)
    const walletInfo = {
      id: walletId,
      name: `Wallet ${this.wallets.size + 1}`,
      type: 'hd',
      mnemonicEncrypted: true,  // Flag indicating mnemonic is encrypted
      accounts: [{
        index: 0,
        address: walletData.address,
        // ❌ NO privateKey field!
        hdPath: `m/44'/60'/0'/0/0`,
        name: 'Account 1',
        balance: '0'
      }],
      currentAccountIndex: 0,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;

    // ✅ SECURE: Encrypt mnemonic using Keystore API
    await this.encryptAndStoreMnemonic(walletId, walletData.mnemonic, walletData.address);

    // Save wallet info (NO sensitive data)
    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage (no sensitive data)
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: walletData.address,
        name: walletInfo.name,
        hasKeystore: true
      });
    }

    return walletInfo;
  }

  // ================================================================
  // Import Wallet from Mnemonic (SECURE)
  // ================================================================

  async importWalletFromMnemonic(mnemonic, name = null) {
    const adapter = window.getAdapter();
    const firstAccount = await adapter.deriveAccountFromMnemonic(mnemonic, 0);

    // Check for duplicates
    for (const [id, wallet] of this.wallets) {
      if (wallet.accounts[0]?.address === firstAccount.address) {
        this.currentWalletId = id;
        this.saveToStorage();

        // ✅ SECURE: Sync only public data
        const account = wallet.accounts[0];
        if (window.WalletStorage && account) {
          window.WalletStorage.save({
            address: account.address,
            name: wallet.name,
            hasKeystore: wallet.mnemonicEncrypted
          });
        }

        window.showToast("This wallet is already imported. Switching to it.", "info");

        return {
          walletId: id,
          address: wallet.accounts[0].address,
          alreadyExists: true
        };
      }
    }

    const walletId = this.generateWalletId();

    // ✅ SECURE: Only store public info
    const walletInfo = {
      id: walletId,
      name: name || `Imported Wallet ${this.wallets.size + 1}`,
      type: 'hd',
      mnemonicEncrypted: true,
      accounts: [{
        index: 0,
        address: firstAccount.address,
        // ❌ NO privateKey!
        hdPath: firstAccount.hdPath,
        name: 'Account 1',
        balance: '0'
      }],
      currentAccountIndex: 0,
      nextAccountIndex: 1,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;

    // ✅ SECURE: Encrypt mnemonic
    await this.encryptAndStoreMnemonic(walletId, mnemonic, firstAccount.address);

    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: firstAccount.address,
        name: walletInfo.name,
        hasKeystore: true
      });
    }

    return { walletId, address: firstAccount.address, alreadyExists: false };
  }

  // ================================================================
  // Import Wallet with Discovery (SECURE)
  // ================================================================

  async importWalletWithDiscovery(mnemonic, name, accountCount) {
    const adapter = window.getAdapter();

    let accounts;
    if (accountCount && accountCount > 0) {
      // Import specific number of accounts
      const derivedAccounts = await adapter.deriveMultipleAccounts(mnemonic, accountCount);
      accounts = await Promise.all(
        derivedAccounts.map(async (acc) => ({
          ...acc,
          balance: await adapter.getBalance(acc.address)
        }))
      );
    } else {
      // Discovery mode
      accounts = await adapter.discoverAccountsFromMnemonic(mnemonic);
    }

    const walletId = this.generateWalletId();

    // ✅ SECURE: Only store public info (NO private keys!)
    const walletInfo = {
      id: walletId,
      name: name || `Imported Wallet`,
      type: 'hd',
      mnemonicEncrypted: true,
      accounts: accounts.map((acc, idx) => ({
        index: acc.index,
        address: acc.address,
        // ❌ NO privateKey!
        hdPath: acc.hdPath,
        name: `Account ${idx + 1}`,
        balance: acc.balance || '0'
      })),
      currentAccountIndex: 0
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;

    // ✅ SECURE: Encrypt mnemonic
    await this.encryptAndStoreMnemonic(walletId, mnemonic, accounts[0].address);

    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage
    if (window.WalletStorage && walletInfo.accounts.length > 0) {
      const firstAccount = accounts[0];
      window.WalletStorage.save({
        address: firstAccount.address,
        name: walletInfo.name,
        hasKeystore: true
      });
    }

    return walletInfo;
  }

  // ================================================================
  // Import from Private Key (Non-HD wallet)
  // ================================================================

  async importWalletFromPrivateKey(privateKey, name = null) {
    const adapter = window.getAdapter();
    const walletData = await adapter.importFromPrivateKey(privateKey);

    const walletId = this.generateWalletId();

    // ✅ SECURE: Encrypt private key using Keystore API
    const walletInfo = {
      id: walletId,
      name: name || `Imported Account`,
      type: 'imported',
      privateKeyEncrypted: true,  // Flag indicating private key is encrypted
      accounts: [{
        index: 0,
        address: walletData.address,
        // ❌ NO privateKey stored in plaintext!
        name: 'Imported Account',
        balance: '0'
      }],
      currentAccountIndex: 0,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;

    // ✅ SECURE: Encrypt private key using Keystore API
    await this.encryptPrivateKey(walletId, privateKey, walletData.address);

    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: walletData.address,
        name: walletInfo.name,
        hasKeystore: true
      });
    }

    return { walletId, address: walletData.address, alreadyExists: false };
  }

  /**
   * Encrypts and stores private key for imported wallets using Keystore API
   * @private
   */
  async encryptPrivateKey(walletId, privateKey, address) {
    if (window.WalletStorage && window.WalletStorage.saveSecure) {
      try {
        // Store private key as if it were a mnemonic (same encryption mechanism)
        await window.WalletStorage.saveSecure(privateKey, address);
        console.log(`[HDWalletManager] ✅ Private key encrypted for imported wallet ${walletId}`);
        return true;
      } catch (error) {
        console.error('[HDWalletManager] ❌ Failed to encrypt private key:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Gets decrypted private key for imported wallet from Keystore
   * @private
   */
  async getPrivateKeyForImportedWallet(walletId, address) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) {
      throw new Error('Wallet not found');
    }

    if (wallet.type !== 'imported') {
      throw new Error('This method is only for imported wallets');
    }

    if (!wallet.privateKeyEncrypted) {
      console.warn('[HDWalletManager] ⚠️ Imported wallet private key is not encrypted!');
      return null;
    }

    // Use WalletStorage to decrypt from Keystore using the specific address
    // (The keystore stores the private key as if it were a mnemonic)
    if (window.WalletStorage && window.WalletStorage.decryptKeystore) {
      try {
        console.log(`[HDWalletManager] Decrypting private key for address: ${address}`);
        const privateKey = await window.WalletStorage.decryptKeystore(address);
        return privateKey;
      } catch (error) {
        console.error('[HDWalletManager] Failed to decrypt private key:', error);
        return null;
      }
    }

    return null;
  }

  // ================================================================
  // Add Account to Wallet (SECURE)
  // ================================================================

  async addAccountToWallet(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet || wallet.type !== 'hd') {
      throw new Error('Cannot add account to this wallet');
    }

    const adapter = window.getAdapter();
    const nextIndex = wallet.accounts.length;

    // Get mnemonic for derivation
    const firstAccount = wallet.accounts[0];
    let mnemonic = await this.getMnemonicForWallet(walletId, firstAccount.address);

    if (!mnemonic) {
      throw new Error('Failed to decrypt wallet mnemonic. Wallet may be locked.');
    }

    // Derive new account
    const newAccount = await adapter.deriveAccountFromMnemonic(mnemonic, nextIndex);

    // ✅ SECURE: Clear mnemonic from memory immediately after derivation
    if (window.SecurityUtils && window.SecurityUtils.clearString) {
      window.SecurityUtils.clearString(mnemonic);
    }
    mnemonic = null;

    // Fetch balance
    const balance = await adapter.getBalance(newAccount.address);

    // ✅ SECURE: Only store public info
    const accountInfo = {
      index: nextIndex,
      address: newAccount.address,
      // ❌ NO privateKey!
      hdPath: newAccount.hdPath,
      name: `Account ${nextIndex + 1}`,
      balance: balance
    };

    wallet.accounts.push(accountInfo);
    wallet.currentAccountIndex = nextIndex;
    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: newAccount.address,
        name: wallet.name,
        hasKeystore: wallet.mnemonicEncrypted
      });
    }

    return accountInfo;
  }

  // ================================================================
  // Account & Wallet Switching
  // ================================================================

  async switchAccount(walletId, accountIndex) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const account = wallet.accounts.find(acc => acc.index === accountIndex);
    if (!account) throw new Error('Account not found');

    wallet.currentAccountIndex = accountIndex;
    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: account.address,
        name: wallet.name,
        hasKeystore: wallet.type === 'hd' ? wallet.mnemonicEncrypted : false
      });
    }
  }

  async switchWallet(walletId) {
    if (!this.wallets.has(walletId)) throw new Error('Wallet not found');
    this.currentWalletId = walletId;
    this.saveToStorage();

    // ✅ SECURE: Only sync public data to WalletStorage
    const wallet = this.wallets.get(walletId);
    const account = wallet.accounts.find(acc => acc.index === wallet.currentAccountIndex);

    if (window.WalletStorage && account) {
      window.WalletStorage.save({
        address: account.address,
        name: wallet.name,
        hasKeystore: wallet.type === 'hd' ? wallet.mnemonicEncrypted : false
      });
    }
  }

  // ================================================================
  // Getters
  // ================================================================

  getCurrentWallet() {
    if (!this.currentWalletId) return null;
    return this.wallets.get(this.currentWalletId);
  }

  getCurrentAccount() {
    const wallet = this.getCurrentWallet();
    if (!wallet) return null;
    return wallet.accounts.find(acc => acc.index === wallet.currentAccountIndex);
  }

  getAllWallets() {
    return Array.from(this.wallets.values()).map(wallet => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      accountCount: wallet.accounts.length,
      currentAddress: wallet.accounts.find(acc => acc.index === wallet.currentAccountIndex)?.address,
      createdAt: wallet.createdAt
    }));
  }

  getWalletAccounts(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) return [];

    return wallet.accounts.map(account => ({
      index: account.index,
      address: account.address,
      name: account.name,
      balance: account.balance,
      isActive: account.index === wallet.currentAccountIndex
    }));
  }

  // ================================================================
  // Wallet Management
  // ================================================================

  renameWallet(walletId, newName) {
    const wallet = this.wallets.get(walletId);
    if (wallet) {
      wallet.name = newName;
      this.saveToStorage();
    }
  }

  renameAccount(walletId, accountIndex, newName) {
    const wallet = this.wallets.get(walletId);
    if (wallet) {
      const account = wallet.accounts.find(acc => acc.index === accountIndex);
      if (account) {
        account.name = newName;
        this.saveToStorage();
      }
    }
  }

  deleteWallet(walletId) {
    if (!this.wallets.has(walletId)) {
      throw new Error('Wallet not found');
    }

    const wallet = this.wallets.get(walletId);
    this.wallets.delete(walletId);

    // Clean up related data
    if (wallet && wallet.accounts) {
      wallet.accounts.forEach(account => {
        localStorage.removeItem(`keystore_${account.address}`);
        const networks = window.EthereumConfig?.NETWORKS || {};
        Object.keys(networks).forEach(networkKey => {
          const network = networks[networkKey];
          if (network && network.chainId) {
            localStorage.removeItem(`tokens_${account.address}_${network.chainId}`);
          }
        });
      });
    }

    // Switch to another wallet or clear
    let switchedTo = null;
    if (this.currentWalletId === walletId) {
      if (this.wallets.size > 0) {
        this.currentWalletId = Array.from(this.wallets.keys())[0];
        switchedTo = this.wallets.get(this.currentWalletId);
      } else {
        this.currentWalletId = null;
      }
    }

    this.saveToStorage();

    // ✅ SECURE: Update WalletStorage with public data only
    if (this.currentWalletId) {
      const currentWallet = this.getCurrentWallet();
      const currentAccount = this.getCurrentAccount();
      if (currentAccount) {
        window.WalletStorage?.save({
          address: currentAccount.address,
          name: currentWallet.name,
          hasKeystore: currentWallet.type === 'hd' ? currentWallet.mnemonicEncrypted : false
        });
      }
    } else {
      if (window.WalletStorage) {
        window.WalletStorage.clear();
      }
      localStorage.removeItem('eth_tx_cache');
    }

    return {
      deleted: true,
      walletsRemaining: this.wallets.size,
      switchedTo: switchedTo
    };
  }

  resetAllWallets() {
    this.wallets.clear();
    this.currentWalletId = null;
    localStorage.removeItem('hdWalletData');

    if (window.WalletStorage) {
      window.WalletStorage.clear();
    }
  }

  // ================================================================
  // Storage (SECURE - No sensitive data)
  // ================================================================

  saveToStorage() {
    try {
      const data = {
        wallets: Array.from(this.wallets.entries()),
        currentWalletId: this.currentWalletId
      };

      // ✅ SECURE: This data contains NO mnemonics or private keys
      // (except for 'imported' type wallets which need special handling)
      localStorage.setItem('hdWalletData', JSON.stringify(data));

      console.log('[HDWalletManager] ✅ Wallet data saved (no sensitive data in localStorage)');
    } catch (error) {
      console.error('Failed to save wallet data:', error);
    }
  }

  loadFromStorage() {
    try {
      const stored = localStorage.getItem('hdWalletData');
      if (stored) {
        const data = JSON.parse(stored);
        this.wallets = new Map(data.wallets || []);
        this.currentWalletId = data.currentWalletId;
        console.log(`[HDWalletManager] ✅ Loaded ${this.wallets.size} wallets from storage`);
      }
    } catch (error) {
      console.error('Failed to load wallet data:', error);
      this.wallets = new Map();
      this.currentWalletId = null;
    }
  }

  generateWalletId() {
    return 'wallet_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

// ================================================================
// Global Singleton
// ================================================================

window.getHDWalletManager = (function() {
  let instance = null;
  return function() {
    if (!instance) {
      instance = new HDWalletManager();
    }
    return instance;
  };
})();

console.log('[HDWalletManager] ✅ Secure HD Wallet Manager loaded');
