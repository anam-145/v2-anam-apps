// ================================================================
// Coin 지갑 메인 페이지 로직 - HD Wallet 통합 버전 (정리됨)
// ================================================================

// 전역 변수
let adapter = null;

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // Ethereum 어댑터 초기화
  adapter = window.getAdapter();
  if (!adapter) {
    console.error("EthereumAdapter not initialized");
    window.showToast("Failed to initialize Ethereum adapter", "error");
    return;
  }

  // UI 테마 적용
  applyTheme();

  // 기존 단일 지갑 데이터 마이그레이션
  migrateOldWalletData();

  // 네트워크 상태 확인
  checkNetworkStatus();

  // 지갑 상태 확인 및 화면 초기화
  initializeWalletUI();

  // 이벤트 리스너 설정
  setupEventListeners();

  // 주기적으로 잔액 업데이트 (30초마다)
  setInterval(() => {
    const manager = window.getHDWalletManager();
    if (manager.getCurrentAccount()) {
      updateAllBalances();
    }
  }, 30000);

  // 트랜잭션 요청 이벤트 리스너 등록
  window.addEventListener("transactionRequest", handleTransactionRequest);
});

// ================================================================
// 1. 초기화 및 마이그레이션
// ================================================================

// 기존 단일 지갑 데이터를 HD Wallet으로 마이그레이션
function migrateOldWalletData() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const oldWalletData = localStorage.getItem(walletKey);
  
  if (oldWalletData) {
    try {
      const oldWallet = JSON.parse(oldWalletData);
      const manager = window.getHDWalletManager();
      
      // 기존 지갑이 없으면 마이그레이션
      if (manager.wallets.size === 0) {
        console.log("Migrating old wallet data to HD Wallet");
        
        const walletId = manager.generateWalletId();
        const walletInfo = {
          id: walletId,
          name: "Migrated Wallet",
          type: oldWallet.mnemonic ? 'hd' : 'imported',
          mnemonic: oldWallet.mnemonic,
          accounts: [{
            index: 0,
            address: oldWallet.address,
            privateKey: oldWallet.privateKey,
            name: 'Main Account',
            balance: '0'
          }],
          currentAccountIndex: 0,
          createdAt: oldWallet.createdAt || new Date().toISOString()
        };

        manager.wallets.set(walletId, walletInfo);
        manager.currentWalletId = walletId;
        manager.saveToStorage();
        
        // 기존 데이터 삭제
        localStorage.removeItem(walletKey);
        
        window.showToast("Wallet migrated to new HD system", "success");
      }
    } catch (error) {
      console.error("Failed to migrate old wallet:", error);
    }
  }
}

// 지갑 UI 초기화
function initializeWalletUI() {
  const manager = window.getHDWalletManager();
  const walletState = window.App.checkWalletState();
  
  if (walletState === 'creation') {
    showWalletCreation();
  } else {
    showWalletMain();
    updateWalletDisplay();
    updateAllBalances();
  }
}

// 이벤트 리스너 설정
function setupEventListeners() {
  // 드롭다운 버튼 이벤트
  const dropdownBtn = document.getElementById('wallet-dropdown-btn');
  if (dropdownBtn) {
    dropdownBtn.addEventListener('click', function(e) {
      e.stopPropagation();
      toggleWalletDropdown();
    });
  }
  
  // 주소 표시 클릭으로 복사
  const addressDisplay = document.getElementById('address-display');
  if (addressDisplay) {
    addressDisplay.addEventListener('click', function(e) {
      e.stopPropagation();
      const accountInfo = window.App.getCurrentAccountInfo();
      if (accountInfo.address) {
        navigator.clipboard.writeText(accountInfo.address);
        window.showToast("Address copied to clipboard", "success");
      }
    });
  }

  // 지갑 추가 버튼
  const addWalletBtn = document.getElementById('add-wallet-btn');
  if (addWalletBtn) {
    addWalletBtn.addEventListener('click', function() {
      closeWalletDropdown();
      navigateToAddWallet();
    });
  }
  
  // 외부 클릭으로 드롭다운 닫기
  document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('wallet-dropdown');
    const dropdownBtn = document.getElementById('wallet-dropdown-btn');
    
    if (dropdown && dropdown.style.display === 'block') {
      if (!dropdown.contains(e.target) && e.target !== dropdownBtn) {
        closeWalletDropdown();
      }
    }
  });
}

// ================================================================
// 2. 테마 및 UI 설정
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);

  // 텍스트 변경
  document.querySelectorAll(".logo-text").forEach((el) => {
    el.textContent = CoinConfig.theme.logoText;
  });

  document.querySelectorAll(".coin-unit").forEach((el) => {
    el.textContent = CoinConfig.symbol;
  });

  // 타이틀 변경
  document.title = `${CoinConfig.name} Wallet`;
}

// 네트워크 상태 확인
async function checkNetworkStatus() {
  try {
    await adapter.initProvider();
    const blockNumber = await adapter.getBlockNumber();
    console.log("Current block number:", blockNumber);
    
    const statusEl = document.getElementById("network-status");
    if (statusEl) statusEl.style.color = "#4cff4c";
  } catch (error) {
    console.error("Network connection failed:", error);
    const statusEl = document.getElementById("network-status");
    if (statusEl) statusEl.style.color = "#ff4444";
  }
}

// ================================================================
// 3. 화면 전환
// ================================================================

function showWalletCreation() {
  const creationEl = document.getElementById('wallet-creation');
  const mainEl = document.getElementById('wallet-main');
  
  if (creationEl) creationEl.style.display = 'block';
  if (mainEl) mainEl.style.display = 'none';
}

function showWalletMain() {
  const creationEl = document.getElementById('wallet-creation');
  const mainEl = document.getElementById('wallet-main');
  
  if (creationEl) creationEl.style.display = 'none';
  if (mainEl) mainEl.style.display = 'block';
}

// ================================================================
// +. 처음 계정 생성
// ================================================================

async function createWallet() {
  try {
    console.log("Starting new wallet creation");
    window.showToast("Creating wallet...", "info");

    const manager = window.getHDWalletManager();
    const result = await manager.createNewWallet();

    console.log("Wallet created:", result.address);
    window.showToast("Wallet created successfully!", "success");
    
    // 니모닉 백업 알림
    showMnemonicBackup(result.mnemonic);

    // 화면 전환
    showWalletMain();
    updateWalletDisplay();
    updateAllBalances();
    
  } catch (error) {
    console.error("Failed to create wallet:", error);
    window.showToast("Failed to create wallet: " + error.message, "error");
  }
}

async function importFromMnemonic() {
  const mnemonicInput = document.getElementById("mnemonic-input");
  if (!mnemonicInput) return;
  
  const mnemonic = mnemonicInput.value.trim();
  
  if (!mnemonic) {
    window.showToast("Please enter mnemonic phrase", "error");
    return;
  }
  
  try {
    window.showToast("Importing wallet...", "info");
    
    const manager = window.getHDWalletManager();
    
    // Import with only 1 account (first account at m/44'/60'/0'/0/0)
    const result = await manager.importWalletWithDiscovery(mnemonic, null, 1);
    
    if (result.alreadyExists) {
      window.showToast("Switched to existing wallet", "info");
    } else {
      window.showToast("Wallet imported successfully!", "success");
    }
    
    // 화면 전환
    showWalletMain();
    updateWalletDisplay();
    updateAllBalances();
    
  } catch (error) {
    console.error("Mnemonic import failed:", error);
    window.showToast("Failed to import wallet: " + error.message, "error");
  }
}

async function importFromPrivateKey() {
  const privateKeyInput = document.getElementById("privatekey-input");
  if (!privateKeyInput) return;
  
  const privateKey = privateKeyInput.value.trim();
  
  if (!privateKey) {
    window.showToast("Please enter private key", "error");
    return;
  }
  
  try {
    window.showToast("Importing account...", "info");

    const manager = window.getHDWalletManager();
    const result = await manager.importWalletFromPrivateKey(privateKey);

    if (result.alreadyExists) {
      window.showToast("Switched to existing account", "info");
    } else {
      window.showToast("Account imported successfully!", "success");
    }
    
    // 화면 전환
    showWalletMain();
    updateWalletDisplay();
    updateAllBalances();
    
  } catch (error) {
    console.error("Private key import failed:", error);
    window.showToast("Failed to import account: " + error.message, "error");
  }
}

// ================================================================
// 4. 드롭다운 관리
// ================================================================

function toggleWalletDropdown() {
  const dropdown = document.getElementById('wallet-dropdown');
  const dropdownBtn = document.getElementById('wallet-dropdown-btn');
  
  if (!dropdown || !dropdownBtn) return;
  
  if (dropdown.style.display === 'none' || !dropdown.style.display) {
    openWalletDropdown();
  } else {
    closeWalletDropdown();
  }
}

function openWalletDropdown() {
  const dropdown = document.getElementById('wallet-dropdown');
  const dropdownBtn = document.getElementById('wallet-dropdown-btn');
  
  if (!dropdown || !dropdownBtn) return;
  
  updateWalletDropdown();
  dropdown.style.display = 'block';
  dropdownBtn.classList.add('active');
}

function closeWalletDropdown() {
  const dropdown = document.getElementById('wallet-dropdown');
  const dropdownBtn = document.getElementById('wallet-dropdown-btn');
  
  if (dropdown) dropdown.style.display = 'none';
  if (dropdownBtn) dropdownBtn.classList.remove('active');
}

function updateWalletDropdown() {
  const manager = window.getHDWalletManager();
  const wallets = manager.getAllWallets();
  const currentWallet = manager.getCurrentWallet();
  const currentAccount = manager.getCurrentAccount();
  const walletList = document.getElementById('wallet-list');
  
  if (!walletList) return;
  
  walletList.innerHTML = '';
  
  wallets.forEach(wallet => {
    // 지갑 헤더
    const walletHeaderItem = document.createElement('li');
    walletHeaderItem.style.cssText = 'background: #f8f9fa; border-bottom: 1px solid #e0e0e0; cursor: default; padding: 8px 16px;';
    walletHeaderItem.innerHTML = `
      <div class="wallet-header">
        ${wallet.name}
        <span class="wallet-type-badge">${wallet.type.toUpperCase()}</span>
      </div>
    `;
    walletList.appendChild(walletHeaderItem);
    
    // 계정 목록
    const accounts = manager.getWalletAccounts(wallet.id);
    accounts.forEach(account => {
      const accountItem = document.createElement('li');
      const isActiveAccount = wallet.id === currentWallet?.id && account.index === currentAccount?.index;
      
      accountItem.className = `account-item ${isActiveAccount ? 'active' : ''}`;
      accountItem.onclick = () => switchToAccount(wallet.id, account.index);
      
      accountItem.innerHTML = `
        <div class="account-name">${account.name}</div>
        <div class="account-address">${window.shortenAddress(account.address)}</div>
        <div class="account-balance">${window.formatBalance(account.balance)} ${CoinConfig.symbol}</div>
      `;
      
      walletList.appendChild(accountItem);
    });
  });
}

// ================================================================
// 5. 계정 관리
// ================================================================

function switchToAccount(walletId, accountIndex) {
  try {
    const manager = window.getHDWalletManager();
    const oldWallet = manager.getCurrentWallet();
    const oldAccount = manager.getCurrentAccount();
    
    // 이미 현재 계정이면 드롭다운만 닫기
    if (oldWallet?.id === walletId && oldAccount?.index === accountIndex) {
      closeWalletDropdown();
      return;
    }
    
    // 지갑 전환 (필요한 경우)
    if (manager.currentWalletId !== walletId) {
      manager.switchWallet(walletId);
    }
    
    // 계정 전환
    manager.switchAccount(walletId, accountIndex);
    
    // UI 업데이트
    updateWalletDisplay();
    closeWalletDropdown();
    
    // 성공 메시지
    const newWallet = manager.getCurrentWallet();
    const newAccount = manager.getCurrentAccount();
    window.showToast(`Switched to ${newWallet.name} - ${newAccount.name}`, "success");
    
    // 잔액 업데이트
    setTimeout(() => {
      const manager = window.getHDWalletManager();
      manager.refreshAccountBalance(newAccount.address).then(() => {
        updateWalletDisplay();
      });
    }, 500);
    
  } catch (error) {
    console.error("Failed to switch account:", error);
    window.showToast("Failed to switch account: " + error.message, "error");
  }
}

// ================================================================
// 6. UI 업데이트
// ================================================================

function updateWalletDisplay() {
  const accountInfo = window.App.getCurrentAccountInfo();
  
  if (!accountInfo.address) {
    showWalletCreation()
    return;
  }
  
  // 주소 표시 업데이트
  const addressDisplay = document.getElementById('address-display');
  if (addressDisplay) {
    addressDisplay.textContent = window.shortenAddress(accountInfo.address);
    addressDisplay.title = `${accountInfo.walletName} - ${accountInfo.accountName}\nAddress: ${accountInfo.address}\nClick to copy`;
  }
  
  // 잔액 표시 업데이트
  const balanceDisplay = document.getElementById('balance-display');
  if (balanceDisplay) {
    balanceDisplay.textContent = window.formatBalance(accountInfo.balance);
  }
  
  // 페이지 제목 업데이트
  document.title = `${accountInfo.walletName} - ${accountInfo.accountName}`;
  
  // 드롭다운이 열려있으면 업데이트
  const dropdown = document.getElementById('wallet-dropdown');
  if (dropdown && dropdown.style.display === 'block') {
    updateWalletDropdown();
  }
}

async function updateAllBalances() {
  try {
    const manager = window.getHDWalletManager();
    await manager.refreshAllBalances();
    updateWalletDisplay();
  } catch (error) {
    console.error("Failed to refresh balances:", error);
  }
}

// ================================================================
// 7. 네비게이션
// ================================================================

function navigateToSend() {
  const accountInfo = window.App.getCurrentAccountInfo();
  if (!accountInfo.address) {
    window.showToast("No wallet selected", "error");
    return;
  }
  
  // anam miniapp 환경
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/send/send");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/send/send");
  } else {
    // 개발 환경
    window.location.href = "../send/send.html";
  }
}

function navigateToReceive() {
  const accountInfo = window.App.getCurrentAccountInfo();
  if (!accountInfo.address) {
    window.showToast("No wallet selected", "error");
    return;
  }
  
  // anam miniapp 환경
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/receive/receive");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/receive/receive");
  } else {
    // 개발 환경
    window.location.href = "../receive/receive.html";
  }
}

function navigateToAddWallet() {
  // anam miniapp 환경
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/add-wallet/add-wallet");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/add-wallet/add-wallet");
  } else {
    // 개발 환경
    window.location.href = "../add-wallet/add-wallet.html";
  }
}

// ================================================================
// 8. Bridge API 트랜잭션 처리
// ================================================================

async function handleTransactionRequest(event) {
  console.log("Transaction request received:", event.detail);

  const manager = window.getHDWalletManager();
  const currentAccount = manager.getCurrentAccount();
  
  if (!currentAccount || !adapter) {
    console.error("No wallet found");
    return;
  }

  const requestData = event.detail;
  const requestId = requestData.requestId;

  try {
    // 트랜잭션 파라미터 구성
    const txParams = {
      from: currentAccount.address,
      to: requestData.to || requestData.recipient || requestData.destination,
      amount: requestData.amount || requestData.value,
      privateKey: currentAccount.privateKey,
    };

    // Ethereum 추가 파라미터 처리
    if (requestData.data) txParams.data = requestData.data;
    if (requestData.gasPrice) txParams.gasPrice = requestData.gasPrice;
    if (requestData.gasLimit) txParams.gasLimit = requestData.gasLimit;

    const result = await adapter.sendTransaction(txParams);

    // 응답 데이터 구성
    const responseData = {
      txHash: result.hash,
      from: currentAccount.address,
      to: txParams.to,
      amount: txParams.amount,
      chainId: CoinConfig.network.chainId,
      network: CoinConfig.network.networkName,
      symbol: CoinConfig.symbol,
    };

    // Bridge API를 통해 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      window.anam.sendTransactionResponse(requestId, JSON.stringify(responseData));
      console.log("Transaction response sent:", responseData);
    }

    // UI 업데이트
    setTimeout(updateAllBalances, 3000);
    
  } catch (error) {
    console.error("Transaction failed:", error);

    // 에러 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      const errorResponse = {
        error: error.message,
        from: currentAccount.address,
        symbol: CoinConfig.symbol,
      };
      window.anam.sendTransactionResponse(requestId, JSON.stringify(errorResponse));
    }
  }
}

// ================================================================
// 9. 유틸리티 함수
// ================================================================

function showMnemonicBackup(mnemonic) {
  const message = `IMPORTANT: Save your mnemonic phrase securely!\n\n${mnemonic}\n\nThis is the only way to recover your wallet.`;
  alert(message);
}

function resetWallet() {
  if (confirm('Are you sure you want to reset all wallets? This action cannot be undone!')) {
    const manager = window.getHDWalletManager();
    manager.resetAllWallets();
    
    window.showToast("All wallets have been reset", "info");
    showWalletCreation();
    
    // 입력 필드 초기화
    const mnemonicInput = document.getElementById("mnemonic-input");
    const privateKeyInput = document.getElementById("privatekey-input");
    if (mnemonicInput) mnemonicInput.value = "";
    if (privateKeyInput) privateKeyInput.value = "";
  }
}

// ================================================================
// 10. 전역 함수 등록 (HTML onclick을 위해)
// ================================================================

window.createWallet = createWallet;
window.importFromMnemonic = importFromMnemonic;
window.importFromPrivateKey = importFromPrivateKey;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.navigateToAddWallet = navigateToAddWallet;
window.resetWallet = resetWallet;
window.switchToAccount = switchToAccount;
window.toggleWalletDropdown = toggleWalletDropdown;
window.openWalletDropdown = openWalletDropdown;
window.closeWalletDropdown = closeWalletDropdown;