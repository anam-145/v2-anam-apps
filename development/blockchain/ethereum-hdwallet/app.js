// ================================================================
// COIN 미니앱 전역 설정 및 초기화
// ================================================================

// Coin 설정
const CoinConfig = {
  // 기본 정보
  name: "Ethereum",
  symbol: "ETH",
  decimals: 18,
  
  // 네트워크 설정
  network: {
    // QuickNode RPC 엔드포인트 (Sepolia 테스트넷)
    rpcEndpoint: "https://still-fluent-yard.ethereum-sepolia.quiknode.pro/ed1e699042dab42a0b3d7d6c7f059eaaef2cc930/",
    // 네트워크 이름
    networkName: "sepolia",
    // 체인 ID
    chainId: 11155111,  // Sepolia testnet
  },
  
  // UI 테마 설정
  theme: {
    primaryColor: "#4338CA",      // 이더리움 보라색
    secondaryColor: "#6366F1",    // 밝은 보라색
    logoText: "Ethereum",
  },
  
  // 주소 설정
  address: {
    // 주소 형식 정규식 (검증용)
    regex: /^0x[a-fA-F0-9]{40}$/,
    // 주소 표시 형식
    displayFormat: "0x...",
  },
  
  // 트랜잭션 설정
  transaction: {
    // 기본 가스비
    defaultGasLimit: 21000,
    // 기본 가스 가격 (gwei)
    defaultGasPrice: "20",
    // 최소 전송 금액
    minAmount: "0.000001",
    // 확인 대기 시간 (ms)
    confirmationTime: 15000,
  },
  
  // 기타 옵션
  options: {
    // 니모닉 지원 여부
    supportsMnemonic: true,
    // 토큰 지원 여부  
    supportsTokens: true,
    // QR 코드 지원
    supportsQRCode: true,
  },
};

// Coin Adapter 추상 클래스
// 모든 블록체인 지갑이 구현해야 하는 공통 인터페이스
class CoinAdapter {
  constructor(config) {
    if (this.constructor === CoinAdapter) {
      throw new Error(
        "CoinAdapter is an abstract class. Cannot be instantiated directly."
      );
    }
    this.config = config;
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  async generateWallet() {
    throw new Error("generateWallet() method must be implemented.");
  }

  async importFromMnemonic(mnemonic) {
    throw new Error("importFromMnemonic() method must be implemented.");
  }

  async importFromPrivateKey(privateKey) {
    throw new Error("importFromPrivateKey() method must be implemented.");
  }

  isValidAddress(address) {
    throw new Error("isValidAddress() method must be implemented.");
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  async getBalance(address) {
    throw new Error("getBalance() method must be implemented.");
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  async sendTransaction(params) {
    throw new Error("sendTransaction() method must be implemented.");
  }

  async getTransactionStatus(txHash) {
    throw new Error("getTransactionStatus() method must be implemented.");
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  async getGasPrice() {
    throw new Error("getGasPrice() method must be implemented.");
  }

  async estimateFee(txParams) {
    throw new Error("estimateFee() method must be implemented.");
  }
}

// ================================================================
// 미니앱 생명주기 정의
// ================================================================

// 전역 앱 상태 관리
const AppState = {
  isInitialized: false,
  walletData: null,
  config: CoinConfig,
  adapter: null, // 실제 구현체에서 설정
};

// 미니앱 생명주기 핸들러
window.App = {
  // 앱 시작 시 호출 (최초 1회)
  onLaunch(options) {
    console.log("Mini app started:", options);
    this.initializeApp();
    this.loadWalletData();
    this.startNetworkMonitoring();
  },

  // 앱이 포그라운드로 전환될 때
  onShow(options) {
    console.log("Mini app activated:", options);
    if (AppState.walletData?.address) {
      this.refreshBalance();
    }
    this.checkNetworkStatus();
  },

  // 앱이 백그라운드로 전환될 때
  onHide() {
    console.log("Mini app deactivated");
  },

  // 앱 오류 발생 시
  onError(error) {
    console.error("Mini app error:", error);
  },

  // ================================================================
  // 초기화 메서드
  // ================================================================

  initializeApp() {
    if (AppState.isInitialized) return;
    this.validateConfig();
    AppState.isInitialized = true;
  },

  validateConfig() {
    const required = ["name", "symbol", "network"];
    for (const field of required) {
      if (!CoinConfig[field]) {
        throw new Error(`Required configuration missing: ${field}`);
      }
    }
  },

  // ================================================================
  // 데이터 관리
  // ================================================================

  loadWalletData() {
    try {
      const stored = localStorage.getItem("walletData");
      if (stored) {
        AppState.walletData = JSON.parse(stored);
      }
    } catch (e) {
      console.error("Failed to load wallet data:", e);
    }
  },

  saveWalletData(data) {
    try {
      AppState.walletData = data;
      localStorage.setItem("walletData", JSON.stringify(data));
    } catch (e) {
      console.error("Failed to save wallet data:", e);
    }
  },

  // ================================================================
  // 네트워크 관리
  // ================================================================

  startNetworkMonitoring() {
    console.log("Network monitoring started");
  },

  checkNetworkStatus() {
    return true;
  },

  // ================================================================
  // 비즈니스 로직
  // ================================================================

  async refreshBalance() {
    if (!AppState.adapter || !AppState.walletData?.address) return;

    try {
      const balance = await AppState.adapter.getBalance(
        AppState.walletData.address
      );
      console.log("Balance updated:", balance);
    } catch (e) {
      console.error("Failed to fetch balance:", e);
    }
  },
};

// ================================================================
// 전역 유틸리티 함수
// ================================================================

// 설정 접근자
window.getConfig = () => AppState.config;

// 어댑터 접근자
window.getAdapter = () => AppState.adapter;

// 어댑터 설정 (각 코인 구현체에서 호출)
window.setAdapter = (adapter) => {
  if (!(adapter instanceof CoinAdapter)) {
    throw new Error("Not a valid CoinAdapter instance.");
  }
  AppState.adapter = adapter;
};

// ================================================================
// 공통 유틸리티 함수
// ================================================================

// Toast 메시지 표시
window.showToast = (message, type = "info") => {
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("show");
  }, 100);

  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
};

// 잔액을 사람이 읽기 쉬운 형식으로 변환
window.formatBalance = (balance, decimals = 18) => {
  const value = Number(balance) / Math.pow(10, decimals);
  return value.toFixed(4);
};

// 금액을 최소 단위로 변환
window.parseAmount = (amount, decimals = 18) => {
  const value = parseFloat(amount) * Math.pow(10, decimals);
  return value.toString();
};

// 주소 축약 표시
window.shortenAddress = (address, chars = 4) => {
  if (!address) return "";
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
};

// ================================================================
// Ethereum Adapter 구현
// ================================================================

class EthereumAdapter extends CoinAdapter {
  constructor(config) {
    super(config);
    this.provider = null;
    this.hdWallets = {};
  }

  // Provider 초기화
  async initProvider() {
    if (!this.provider && typeof ethers !== 'undefined') {
      this.provider = new ethers.providers.JsonRpcProvider(this.config.network.rpcEndpoint);
    }
    return this.provider;
  }

  /* ================================================================
   * 1. 지갑 생성 및 관리
   * ================================================================ */

  async generateWallet() {
    const wallet = ethers.Wallet.createRandom();
    
    return {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic.phrase
    };
  }

  async importFromMnemonic(mnemonic) {
    try {
      const wallet = ethers.Wallet.fromMnemonic(mnemonic);
      return {
        address: wallet.address,
        privateKey: wallet.privateKey
      };
    } catch (error) {
      throw new Error("Invalid mnemonic: " + error.message);
    }
  }

  async importFromPrivateKey(privateKey) {
    try {
      const wallet = new ethers.Wallet(privateKey);
      return {
        address: wallet.address
      };
    } catch (error) {
      throw new Error("Invalid private key: " + error.message);
    }
  }

  isValidAddress(address) {
    return ethers.utils.isAddress(address);
  }

  /* ================================================================
   * 2. 잔액 조회
   * ================================================================ */

  async getBalance(address) {
    await this.initProvider();
    const balance = await this.provider.getBalance(address);
    return balance.toString();
  }

  /* ================================================================
   * 3. 트랜잭션 처리
   * ================================================================ */

  async sendTransaction(params) {
    await this.initProvider();
    
    const wallet = new ethers.Wallet(params.privateKey, this.provider);
    
    const tx = {
      to: params.to,
      value: ethers.utils.parseEther(params.amount),
      gasLimit: params.gasLimit || this.config.transaction.defaultGasLimit,
      gasPrice: ethers.utils.parseUnits(params.gasPrice || this.config.transaction.defaultGasPrice, 'gwei')
    };
    
    if (params.data) {
      tx.data = params.data;
    }
    
    const transaction = await wallet.sendTransaction(tx);
    
    return {
      hash: transaction.hash
    };
  }

  async getTransactionStatus(txHash) {
    await this.initProvider();
    
    const receipt = await this.provider.getTransactionReceipt(txHash);
    
    if (!receipt) {
      return {
        status: 'pending',
        confirmations: 0
      };
    }
    
    const currentBlock = await this.provider.getBlockNumber();
    
    return {
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      confirmations: currentBlock - receipt.blockNumber
    };
  }

  /* ================================================================
   * 4. 수수료 관련
   * ================================================================ */

  async getGasPrice() {
    await this.initProvider();
    
    const gasPrice = await this.provider.getGasPrice();
    const gasPriceGwei = ethers.utils.formatUnits(gasPrice, 'gwei');
    
    return {
      low: (parseFloat(gasPriceGwei) * 0.8).toFixed(2),
      medium: gasPriceGwei,
      high: (parseFloat(gasPriceGwei) * 1.5).toFixed(2)
    };
  }

  async estimateFee(txParams) {
    await this.initProvider();
    
    const gasLimit = txParams.gasLimit || this.config.transaction.defaultGasLimit;
    const gasPrice = await this.provider.getGasPrice();
    
    const fee = gasPrice.mul(gasLimit);
    return ethers.utils.formatEther(fee);
  }

  /* ================================================================
   * 5. 이더리움 특화 기능
   * ================================================================ */

  async getBlockNumber() {
    await this.initProvider();
    return await this.provider.getBlockNumber();
  }

  async getNetwork() {
    await this.initProvider();
    return await this.provider.getNetwork();
  }

  async resolveENS(ensName) {
    await this.initProvider();
    try {
      const address = await this.provider.resolveName(ensName);
      return address;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Check if an address has transaction history
   * @param {string} address 
   * @returns {Promise<boolean>}
   */
  async checkAddressHistory(address) {
    try {
      await this.initProvider();
      // For Ethereum, check transaction count (nonce)
      const txCount = await this.provider.getTransactionCount(address);
      return txCount > 0;
    } catch (error) {
      console.error("Error checking address history:", error);
      return false;
    }
  }
}

// ================================================================
// HD Wallet 관리 클래스
// ================================================================

class HDWalletManager {
  constructor() {
    this.wallets = new Map();
    this.currentWalletId = null;
    this.loadFromStorage();
  }

  // ================================================================
  // 1. 지갑 생성 및 관리
  // ================================================================

  async createNewWallet() {
    const adapter = window.getAdapter();
    const walletData = await adapter.generateWallet();
    
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
      nextAccountIndex: 1,
      createdAt: new Date().toISOString()
    };

    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;
    this.saveToStorage();

    return {
      walletId,
      address: walletData.address,
      mnemonic: walletData.mnemonic
    };
  }

  async importWalletFromMnemonic(mnemonic, name = null) {
    // Check if this mnemonic is already imported
    for (const [id, wallet] of this.wallets) {
      if (wallet.mnemonic === mnemonic) {
        // Wallet already exists, just switch to it
        this.currentWalletId = id;
        this.saveToStorage();
        
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

    return {
      walletId,
      address: walletData.address,
      alreadyExists: false
    };
  }

  /**
   * Import wallet with account discovery
   * Checks for used accounts and imports all that have transaction history
   * @param {string} mnemonic 
   * @param {string} name 
   * @param {number} accountCount - If specified, import exact number of accounts regardless of usage
   * @returns {Promise<{walletId: string, addresses: Array, discoveredCount: number}>}
   */
  async importWalletWithDiscovery(mnemonic, name = null, accountCount = null) {
    // Check if this mnemonic is already imported
    for (const [id, wallet] of this.wallets) {
      if (wallet.mnemonic === mnemonic) {
        // Wallet already exists, just switch to it
        this.currentWalletId = id;
        this.saveToStorage();
        
        window.showToast("This wallet is already imported. Switching to it.", "info");
        
        return {
          walletId: id,
          addresses: wallet.accounts.map(a => a.address),
          discoveredCount: wallet.accounts.length,
          alreadyExists: true
        };
      }
    }
    const adapter = window.getAdapter();
    
    // Create HD node from mnemonic
    const hdNode = ethers.utils.HDNode.fromMnemonic(mnemonic);
    
    const walletId = this.generateWalletId();
    const accounts = [];
    
    console.log("Starting account discovery/import...");
    
    // If accountCount is specified, import exact number of accounts
    if (accountCount && accountCount > 0) {
      window.showToast(`Importing ${accountCount} accounts...`, "info");
      
      for (let i = 0; i < accountCount && i < 100; i++) {
        const hdPath = `m/44'/60'/0'/0/${i}`;
        const derivedWallet = hdNode.derivePath(hdPath);
        
        // Get balance for each account
        let balance = '0';
        try {
          balance = await adapter.getBalance(derivedWallet.address);
        } catch (error) {
          console.error(`Error getting balance for account ${i}:`, error);
        }
        
        accounts.push({
          index: i,
          address: derivedWallet.address,
          privateKey: derivedWallet.privateKey,
          name: `Account ${i + 1}`,
          balance: balance,
          hdPath: hdPath
        });
        
        console.log(`Imported account ${i}: ${derivedWallet.address}`);
      }
    } else {
      // Standard discovery - only find used accounts
      window.showToast("Discovering used accounts...", "info");
      
      let consecutiveEmpty = 0;
      let accountIndex = 0;
      let lastUsedIndex = -1;
      const maxGap = 5;
      
      while (true) {
        const hdPath = `m/44'/60'/0'/0/${accountIndex}`;
        const derivedWallet = hdNode.derivePath(hdPath);
        
        console.log(`Checking account ${accountIndex}: ${derivedWallet.address}`);
        
        try {
          const balance = await adapter.getBalance(derivedWallet.address);
          const hasTransactions = await adapter.checkAddressHistory(derivedWallet.address);
          
          console.log(`Account ${accountIndex} - Balance: ${balance}, Has TX: ${hasTransactions}`);
          
          if (balance !== '0' || hasTransactions || accountIndex === 0) {
            // Account is used (or it's the first account), add it
            accounts.push({
              index: accountIndex,
              address: derivedWallet.address,
              privateKey: derivedWallet.privateKey,
              name: `Account ${accountIndex + 1}`,
              balance: balance,
              hdPath: hdPath
            });
            
            if (balance !== '0' || hasTransactions) {
              lastUsedIndex = accountIndex;
              consecutiveEmpty = 0;
              console.log(`Found used account ${accountIndex}: ${derivedWallet.address}`);
            }
          }
          
          // Count consecutive empty accounts after the last used one
          if (accountIndex > lastUsedIndex) {
            if (balance === '0' && !hasTransactions) {
              consecutiveEmpty++;
            } else {
              consecutiveEmpty = 0;
            }
          }
          
        } catch (error) {
          console.error(`Error checking account ${accountIndex}:`, error);
          if (accountIndex > lastUsedIndex) {
            consecutiveEmpty++;
          }
        }
        
        accountIndex++;
        
        // Stop conditions
        if (consecutiveEmpty >= maxGap || accountIndex > 100) {
          console.log(`Stopping discovery. Consecutive empty: ${consecutiveEmpty}, Index: ${accountIndex}`);
          break;
        }
      }
    }
    
    // Sort accounts by index
    accounts.sort((a, b) => a.index - b.index);
    
    // Create wallet with all discovered/imported accounts
    const walletInfo = {
      id: walletId,
      name: name || `Imported HD Wallet ${this.wallets.size + 1}`,
      type: 'hd',
      mnemonic: mnemonic,
      accounts: accounts,
      currentAccountIndex: 0,
      nextAccountIndex: accounts.length > 0 ? Math.max(...accounts.map(a => a.index)) + 1 : 0,
      createdAt: new Date().toISOString()
    };
    
    this.wallets.set(walletId, walletInfo);
    this.currentWalletId = walletId;
    this.saveToStorage();
    
    const message = accounts.length === 1 
      ? "Wallet imported with 1 account" 
      : `Wallet imported with ${accounts.length} accounts`;
    
    console.log(message);
    console.log("Imported accounts:", accounts);
    window.showToast(message, "success");
    
    return {
      walletId,
      addresses: accounts.map(a => a.address),
      discoveredCount: accounts.length
    };
  }

  async importWalletFromPrivateKey(privateKey, name = null) {
    // Check if this private key is already imported
    for (const [id, wallet] of this.wallets) {
      for (const account of wallet.accounts) {
        if (account.privateKey === privateKey) {
          // Account already exists, switch to it
          this.currentWalletId = id;
          wallet.currentAccountIndex = account.index;
          this.saveToStorage();
          
          window.showToast("This account is already imported. Switching to it.", "info");
          
          return {
            walletId: id,
            address: account.address,
            alreadyExists: true
          };
        }
      }
    }
    
    const adapter = window.getAdapter();
    const walletData = await adapter.importFromPrivateKey(privateKey);
    
    const walletId = this.generateWalletId();
    const walletInfo = {
      id: walletId,
      name: name || `Imported Account ${this.wallets.size + 1}`,
      type: 'imported',
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

    return {
      walletId,
      address: walletData.address,
      alreadyExists: false
    };
  }

  // ================================================================
  // 2. 계정 관리 (HD 지갑 내 여러 주소)
  // ================================================================

  async addAccountToWallet(walletId) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    if (wallet.type !== 'hd') throw new Error('Cannot add account to non-HD wallet');

    // Use nextAccountIndex if available, otherwise use array length
    const nextIndex = wallet.nextAccountIndex || wallet.accounts.length;
    
    // HD path for new account
    const hdPath = `m/44'/60'/0'/0/${nextIndex}`;
    const hdNode = ethers.utils.HDNode.fromMnemonic(wallet.mnemonic);
    const derivedWallet = hdNode.derivePath(hdPath);

    const newAccount = {
      index: nextIndex,
      address: derivedWallet.address,
      privateKey: derivedWallet.privateKey,
      name: `Account ${nextIndex + 1}`,
      balance: '0',
      hdPath: hdPath
    };

    wallet.accounts.push(newAccount);
    wallet.currentAccountIndex = wallet.accounts.length - 1;
    wallet.nextAccountIndex = nextIndex + 1;
    this.saveToStorage();

    return {
      address: newAccount.address,
      accountIndex: newAccount.index
    };
  }

  switchAccount(walletId, accountIndex) {
    const wallet = this.wallets.get(walletId);
    if (!wallet) throw new Error('Wallet not found');
    
    const account = wallet.accounts.find(acc => acc.index === accountIndex);
    if (!account) throw new Error('Account not found');
    
    wallet.currentAccountIndex = accountIndex;
    this.saveToStorage();
  }

  switchWallet(walletId) {
    if (!this.wallets.has(walletId)) throw new Error('Wallet not found');
    this.currentWalletId = walletId;
    this.saveToStorage();
  }

  // ================================================================
  // 3. 정보 조회
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
  // 4. 잔액 관리
  // ================================================================

  async refreshAllBalances() {
    const adapter = window.getAdapter();
    
    for (const wallet of this.wallets.values()) {
      for (const account of wallet.accounts) {
        try {
          const balance = await adapter.getBalance(account.address);
          account.balance = balance;
        } catch (error) {
          console.error(`Failed to update balance for ${account.address}:`, error);
        }
      }
    }
    
    this.saveToStorage();
  }

  async refreshAccountBalance(address) {
    const adapter = window.getAdapter();
    
    for (const wallet of this.wallets.values()) {
      const account = wallet.accounts.find(acc => acc.address === address);
      if (account) {
        try {
          account.balance = await adapter.getBalance(address);
          this.saveToStorage();
          break;
        } catch (error) {
          console.error(`Failed to update balance for ${address}:`, error);
        }
      }
    }
  }

  // ================================================================
  // 5. 지갑 관리
  // ================================================================

  resetAllWallets() {
    this.wallets.clear();
    this.currentWalletId = null;
    this.saveToStorage();
  }

  // ================================================================
  // 6. 저장소 관리
  // ================================================================

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

// ================================================================
// app.js의 AppState에 추가
// ================================================================

// 기존 AppState에 HD Wallet Manager 추가
AppState.hdWalletManager = new HDWalletManager();

// 전역 접근자 함수들
window.getHDWalletManager = () => AppState.hdWalletManager;

// 기존 App 객체에 HD Wallet 관련 메서드 추가
Object.assign(window.App, {
  // HD Wallet 초기화 체크
  checkWalletState() {
    const manager = window.getHDWalletManager();
    const currentWallet = manager.getCurrentWallet();
    
    if (!currentWallet) {
      // 지갑이 없으면 생성 화면으로
      return 'creation';
    } else {
      // 지갑이 있으면 메인 화면으로
      return 'main';
    }
  },

  // 현재 계정 정보 가져오기
  getCurrentAccountInfo() {
    const manager = window.getHDWalletManager();
    const account = manager.getCurrentAccount();
    const wallet = manager.getCurrentWallet();
    
    return {
      address: account?.address,
      balance: account?.balance || '0',
      walletName: wallet?.name,
      accountName: account?.name,
      canAddAccount: wallet?.type === 'hd'
    };
  }
});

// ================================================================
// 앱 초기화
// ================================================================

// Ethereum Adapter 인스턴스 생성 및 등록
const ethereumAdapter = new EthereumAdapter(CoinConfig);
window.setAdapter(ethereumAdapter);

// 앱 시작 시 호출
if (window.App && window.App.onLaunch) {
  window.App.onLaunch({});
}