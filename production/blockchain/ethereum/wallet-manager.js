class HDWalletManager {
  constructor() {
    this.wallets = new Map();
    this.currentWalletId = null;
    this.loadFromStorage();
  }
  
  // Adapter를 통해 블록체인 작업 수행
  async createNewWallet() {
    const adapter = window.getAdapter();
    const walletData = await adapter.generateWallet();

    // 지갑 정보 저장 (localStorage)
    const walletId = this.generateWalletId();
    const walletInfo = {
      id: walletId,
      name: `Wallet ${this.wallets.size + 1}`,
      type: 'hd',
      mnemonic: walletData.mnemonic,
      accounts: [{
        index: 0,
        address: walletData.address,
        privateKey: walletData.privateKey,
        name: 'Account 1',
        balance: '0'
      }],
      currentAccountIndex: 0,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: walletData.address,
        privateKey: walletData.privateKey,
        mnemonic: walletData.mnemonic,
        name: walletInfo.name
      });
    }

    return walletInfo;
  }
  
  async importWalletFromMnemonic(mnemonic, name = null) {
    // Check if this mnemonic is already imported
    for (const [id, wallet] of this.wallets) {
      if (wallet.mnemonic === mnemonic) {
        // Wallet already exists, just switch to it
        this.currentWalletId = id;
        this.saveToStorage();

        // Sync with WalletStorage
        const account = wallet.accounts[0];
        if (window.WalletStorage && account) {
          window.WalletStorage.save({
            address: account.address,
            privateKey: account.privateKey,
            mnemonic: wallet.mnemonic,
            name: wallet.name
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

    const adapter = window.getAdapter();
    const walletData = await adapter.importFromMnemonic(mnemonic);

    const walletId = this.generateWalletId();
    const walletInfo = {
      id: walletId,
      name: name || `Imported Wallet ${this.wallets.size + 1}`,
      type: 'hd',
      mnemonic: mnemonic,
      accounts: [{
        index: 0,
        address: walletData.address,
        privateKey: walletData.privateKey,
        name: 'Account 1',
        balance: '0'
      }],
      currentAccountIndex: 0,
      nextAccountIndex: 1,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: walletData.address,
        privateKey: walletData.privateKey,
        mnemonic: mnemonic,
        name: walletInfo.name
      });
    }

    return {
      walletId,
      address: walletData.address,
      alreadyExists: false
    };
  }

  async importWalletWithDiscovery(mnemonic, name, accountCount) {
    const adapter = window.getAdapter();

    // accountCount가 지정되면 해당 수만큼, 아니면 discovery
    let accounts;
    if (accountCount && accountCount > 0) {
      accounts = await adapter.importAccountsWithBalance(mnemonic, accountCount);
    } else {
      accounts = await adapter.discoverAccountsFromMnemonic(mnemonic);
    }

    // 지갑 정보 구성 및 저장
    const walletId = this.generateWalletId();
    const walletInfo = {
      id: walletId,
      name: name || `Imported Wallet`,
      type: 'hd',
      mnemonic: mnemonic,
      accounts: accounts.map((acc, idx) => ({
        ...acc,
        name: `Account ${idx + 1}`
      })),
      currentAccountIndex: 0
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    if (window.WalletStorage && walletInfo.accounts.length > 0) {
      const firstAccount = walletInfo.accounts[0];
      window.WalletStorage.save({
        address: firstAccount.address,
        privateKey: firstAccount.privateKey,
        mnemonic: mnemonic,
        name: walletInfo.name
      });
    }

    return walletInfo;
  }

  async importWalletFromPrivateKey(privateKey, name = null) {
    // Private key로는 HD 지갑이 아닌 단일 계정 지갑 생성
    const adapter = window.getAdapter();
    const walletData = await adapter.importFromPrivateKey(privateKey);

    const walletId = this.generateWalletId();
    const walletInfo = {
      id: walletId,
      name: name || `Imported Account`,
      type: 'imported',  // HD가 아닌 imported 타입
      mnemonic: null,
      accounts: [{
        index: 0,
        address: walletData.address,
        privateKey: privateKey,
        name: 'Imported Account',
        balance: '0'
      }],
      currentAccountIndex: 0,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: walletData.address,
        privateKey: privateKey,
        mnemonic: null,
        name: walletInfo.name
      });
    }

    return {
      walletId,
      address: walletData.address,
      alreadyExists: false
    };
  }

  async addAccountToWallet(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet || wallet.type !== 'hd') {
      throw new Error('Cannot add account to this wallet');
    }
    
    const adapter = window.getAdapter();
    const nextIndex = wallet.accounts.length;
    
    // 새 계정 파생
    const newAccount = await adapter.deriveAccountFromMnemonic(
      wallet.mnemonic, 
      nextIndex
    );
    
    // 잔액 조회
    newAccount.balance = await adapter.getBalance(newAccount.address);
    newAccount.name = `Account ${nextIndex + 1}`;

    wallet.accounts.push(newAccount);
    wallet.currentAccountIndex = nextIndex;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: newAccount.address,
        privateKey: newAccount.privateKey,
        mnemonic: wallet.mnemonic,
        name: wallet.name
      });
    }

    return newAccount;
  }

  switchAccount(walletId, accountIndex) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');

    const account = wallet.accounts.find(acc => acc.index === accountIndex);
    if (!account) throw new Error('Account not found');

    wallet.currentAccountIndex = accountIndex;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    if (window.WalletStorage) {
      window.WalletStorage.save({
        address: account.address,
        privateKey: account.privateKey,
        mnemonic: wallet.mnemonic,
        name: wallet.name
      });
    }
  }

  switchWallet(walletId) {
    if (!this.wallets.has(walletId)) throw new Error('Wallet not found');
    this.currentWalletId = walletId;
    this.saveToStorage();

    // Sync with WalletStorage for backward compatibility
    const wallet = this.wallets.get(walletId);
    const account = wallet.accounts.find(acc => acc.index === wallet.currentAccountIndex);
    if (window.WalletStorage && account) {
      window.WalletStorage.save({
        address: account.address,
        privateKey: account.privateKey,
        mnemonic: wallet.mnemonic,
        name: wallet.name
      });
    }
  }

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
    // Check if wallet exists
    if (!this.wallets.has(walletId)) {
      throw new Error('Wallet not found');
    }

    // Get wallet info before deleting
    const wallet = this.wallets.get(walletId);

    // Delete the wallet
    this.wallets.delete(walletId);

    // Clean up related data
    if (wallet && wallet.accounts) {
      wallet.accounts.forEach(account => {
        // Remove keystore for each account if it exists
        localStorage.removeItem(`keystore_${account.address}`);
        // Remove token list for each account/network
        const networks = window.EthereumConfig?.NETWORKS || {};
        Object.keys(networks).forEach(networkKey => {
          const network = networks[networkKey];
          if (network && network.chainId) {
            localStorage.removeItem(`tokens_${account.address}_${network.chainId}`);
          }
        });
      });
    }

    // If this was the current wallet, switch to another or set to null
    let switchedTo = null;
    if (this.currentWalletId === walletId) {
      if (this.wallets.size > 0) {
        // Switch to the first available wallet
        this.currentWalletId = Array.from(this.wallets.keys())[0];
        switchedTo = this.wallets.get(this.currentWalletId);
      } else {
        // No wallets left
        this.currentWalletId = null;
      }
    }

    // Save updated state
    this.saveToStorage();

    // Update WalletStorage for compatibility
    if (this.currentWalletId) {
      const currentWallet = this.getCurrentWallet();
      const currentAccount = this.getCurrentAccount();
      if (currentAccount) {
        window.WalletStorage?.save({
          address: currentAccount.address,
          privateKey: currentAccount.privateKey,
          mnemonic: currentWallet.mnemonic,
          name: currentWallet.name
        });
      }
    } else {
      // No wallets left, clear WalletStorage
      if (window.WalletStorage) {
        window.WalletStorage.clear();
      }
      // Clear transaction cache
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

    // 기존 WalletStorage도 클리어
    if (window.WalletStorage) {
      window.WalletStorage.clear();
    }
  }

  saveToStorage() {
    try {
      const data = {
        wallets: Array.from(this.wallets.entries()),
        currentWalletId: this.currentWalletId
      };
      localStorage.setItem('hdWalletData', JSON.stringify(data));
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

// 전역 등록
window.getHDWalletManager = (function() {
  let instance = null;
  return function() {
    if (!instance) {
      instance = new HDWalletManager();
    }
    return instance;
  };
})();