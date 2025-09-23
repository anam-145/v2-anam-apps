// ================================================================
// Add Wallet 페이지 로직
// ================================================================

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Add Wallet page loaded");
  
  // Initialize theme
  applyTheme();
  
  // Display current wallet info
  displayCurrentWallet();
  
  // Check if we can add account to current wallet
  checkAddAccountAvailability();
});

// ================================================================
// 활성화된 지갑 표시
// ================================================================

function displayCurrentWallet() {
  const manager = window.getHDWalletManager();
  const currentWallet = manager.getCurrentWallet();
  
  if (currentWallet) {
    // Update wallet name
    const walletNameEl = document.getElementById('current-wallet-name');
    if (walletNameEl) {
      walletNameEl.textContent = currentWallet.name;
    }
    
    // Update wallet type
    const walletTypeEl = document.getElementById('current-wallet-type');
    if (walletTypeEl) {
      walletTypeEl.textContent = currentWallet.type.toUpperCase();
    }
    
    // Update account count
    const accountCountEl = document.getElementById('current-account-count');
    if (accountCountEl) {
      const count = currentWallet.accounts.length;
      accountCountEl.textContent = `${count} account${count !== 1 ? 's' : ''}`;
    }
  }
}

function checkAddAccountAvailability() {
  const manager = window.getHDWalletManager();
  const currentWallet = manager.getCurrentWallet();
  
  // Show add account button only for HD wallets
  const addAccountBtn = document.getElementById('add-account-btn');
  if (addAccountBtn) {
    if (currentWallet && currentWallet.type === 'hd') {
      addAccountBtn.style.display = 'flex';
    } else {
      addAccountBtn.style.display = 'none';
    }
  }
}

// ================================================================
// 현재 활성화 된 지갑에 계정(주소)) 추가
// ================================================================

async function addAccountToCurrent() {
  const manager = window.getHDWalletManager();
  const currentWallet = manager.getCurrentWallet();
  
  if (!currentWallet || currentWallet.type !== 'hd') {
    window.showToast("Cannot add account to this wallet type", "error");
    return;
  }
  
  try {
    // Disable button during operation
    const btn = document.getElementById('add-account-btn');
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
    }
    
    window.showToast("Adding new account...", "info");
    
    const result = await manager.addAccountToWallet(currentWallet.id);
    
    window.showToast("New account added successfully!", "success");
    
    // Refresh display
    displayCurrentWallet();
    
    // Success animation
    if (btn) {
      btn.classList.add('success');
      setTimeout(() => {
        btn.classList.remove('success');
      }, 500);
    }
    
    // Navigate back to main page after short delay
    setTimeout(() => {
      navigateBack();
    }, 500);
    
  } catch (error) {
    console.error("Failed to add account:", error);
    window.showToast("Failed to add account: " + error.message, "error");
  } finally {
    const btn = document.getElementById('add-account-btn');
    if (btn) {
      btn.classList.remove('loading');
      btn.disabled = false;
    }
  }
}

// ================================================================
// 새로운 지갑 생성
// ================================================================

async function createNewWallet() {
  try {
    window.showToast("Creating new wallet...", "info");
    
    const manager = window.getHDWalletManager();
    const result = await manager.createNewWallet();
    
    // 니모닉 표시
    showMnemonicBackup(result.mnemonic);
    
    window.showToast("Wallet created successfully!", "success");
    
    // Navigate back to main page
    setTimeout(() => {
      navigateBack();
    }, 500);
    
  } catch (error) {
    console.error("Failed to create wallet:", error);
    window.showToast("Failed to create wallet: " + error.message, "error");
  }
}

// ================================================================
// Import Forms
// ================================================================

function showMnemonicImport() {
  document.getElementById('privatekey-form').style.display = 'none';
  document.querySelectorAll('.option-card').forEach(card => {
    card.style.display = 'none';
  });
  document.getElementById('mnemonic-form').style.display = 'block';
}

function showPrivateKeyImport() {
  document.getElementById('mnemonic-form').style.display = 'none';
  document.querySelectorAll('.option-card').forEach(card => {
    card.style.display = 'none';
  });
  document.getElementById('privatekey-form').style.display = 'block';
}

function cancelImport() {
  document.getElementById('mnemonic-form').style.display = 'none';
  document.getElementById('privatekey-form').style.display = 'none';
  
  // Show option cards again
  document.querySelectorAll('.option-card').forEach(card => {
    card.style.display = 'flex';
  });
  
  // Clear inputs
  document.getElementById('mnemonic-input').value = '';
  document.getElementById('wallet-name-input').value = '';
  document.getElementById('privatekey-input').value = '';
  document.getElementById('account-name-input').value = '';
  
  // Re-check add account availability
  checkAddAccountAvailability();
}

// ================================================================
// 니모닉으로 복구
// ================================================================

async function importFromMnemonic() {
  const mnemonicInput = document.getElementById('mnemonic-input');
  const walletNameInput = document.getElementById('wallet-name-input');
  
  if (!mnemonicInput) return;
  
  const mnemonic = mnemonicInput.value.trim();
  const walletName = walletNameInput.value.trim() || undefined;
  
  if (!mnemonic) {
    window.showToast("Please enter mnemonic phrase", "error");
    return;
  }
  
  try {
    window.showToast("Importing wallet...", "info");
    
    const manager = window.getHDWalletManager();
    
    // Import with only 1 account (m/44'/60'/0'/0/0)
    const result = await manager.importWalletWithDiscovery(mnemonic, walletName, 1);
    
    if (result.alreadyExists) {
      window.showToast(
        `Switched to existing wallet`, 
        "info"
      );
    } else {
      window.showToast(
        `Wallet imported successfully!`, 
        "success"
      );
    }
    
    // Navigate back to main page
    setTimeout(() => {
      navigateBack();
    }, 500);
    
  } catch (error) {
    console.error("Mnemonic import failed:", error);
    window.showToast("Failed to import wallet: " + error.message, "error");
  }
}

// ================================================================
// 개인키로 복구
// ================================================================

async function importFromPrivateKey() {
  const privateKeyInput = document.getElementById('privatekey-input');
  const accountNameInput = document.getElementById('account-name-input');
  
  if (!privateKeyInput) return;
  
  const privateKey = privateKeyInput.value.trim();
  const accountName = accountNameInput.value.trim() || undefined;
  
  if (!privateKey) {
    window.showToast("Please enter private key", "error");
    return;
  }
  
  try {
    window.showToast("Importing account...", "info");
    
    const manager = window.getHDWalletManager();
    const result = await manager.importWalletFromPrivateKey(privateKey, accountName);
    
    if (result.alreadyExists) {
      window.showToast("Switched to existing account", "info");
    } else {
      window.showToast("Account imported successfully!", "success");
    }
    
    // Navigate back to main page
    setTimeout(() => {
      navigateBack();
    }, 500);
    
  } catch (error) {
    console.error("Private key import failed:", error);
    window.showToast("Failed to import account: " + error.message, "error");
  }
}

// ================================================================
// 유틸리티 함수
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  const config = window.getConfig();
  
  root.style.setProperty("--coin-primary", config.theme.primaryColor);
  root.style.setProperty("--coin-secondary", config.theme.secondaryColor);
  root.style.setProperty("--coin-dark", "#312E81");
  root.style.setProperty("--coin-light", "#E0E7FF");
  root.style.setProperty("--coin-gradient", `linear-gradient(135deg, ${config.theme.primaryColor} 0%, ${config.theme.secondaryColor} 100%)`);
}

function showMnemonicBackup(mnemonic) {
  const message = `IMPORTANT: Save your mnemonic phrase securely!\n\n${mnemonic}\n\nThis is the only way to recover your wallet.`;
  alert(message);
}

// ================================================================
// 네비게이션
// ================================================================

function navigateBack() {
  // Check if in anam miniapp environment
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/index/index");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/index/index");
  } else {
    // Development environment
    window.location.href = "../index/index.html";
  }
}

// ================================================================
// 전역 함수 (for HTML onclick)
// ================================================================

window.addAccountToCurrent = addAccountToCurrent;
window.createNewWallet = createNewWallet;
window.showMnemonicImport = showMnemonicImport;
window.showPrivateKeyImport = showPrivateKeyImport;
window.cancelImport = cancelImport;
window.importFromMnemonic = importFromMnemonic;
window.importFromPrivateKey = importFromPrivateKey;
window.navigateBack = navigateBack;