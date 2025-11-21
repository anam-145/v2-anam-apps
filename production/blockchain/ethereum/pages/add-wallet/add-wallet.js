// ================================================================
// Add Wallet Page Logic - HD Wallet Integrated Version
// ================================================================

// 전역 변수
let hdManager = null;
let adapter = null;

// Utils 함수 가져오기
const { showToast } = window.EthereumUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Add Wallet page loaded");
  
  // HD Wallet Manager 초기화
  if (window.getHDWalletManager) {
    hdManager = window.getHDWalletManager();
    console.log("HD Wallet Manager initialized");
  } else {
    console.error("HD Wallet Manager not found");
    showToast("Failed to initialize wallet manager");
  }
  
  // Adapter 초기화
  adapter = window.getAdapter();
  if (!adapter) {
    console.error("Adapter not initialized");
    showToast("Failed to initialize adapter");
  }
  
  // Initialize theme
  applyTheme();
  
  // Display current wallet info
  displayCurrentWallet();
  
  // Check if we can add account to current wallet
  checkAddAccountAvailability();
  
  // Setup event listeners
  setupEventListeners();
});

// ================================================================
// Event Listeners Setup
// ================================================================

function setupEventListeners() {
  // Enter key support for input fields
  const mnemonicInput = document.getElementById('mnemonic-input');
  const privateKeyInput = document.getElementById('privatekey-input');
  
  if (mnemonicInput) {
    mnemonicInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter' && e.ctrlKey) {
        importFromMnemonic();
      }
    });
  }
  
  if (privateKeyInput) {
    privateKeyInput.addEventListener('keypress', function(e) {
      if (e.key === 'Enter') {
        importFromPrivateKey();
      }
    });
  }
}

// ================================================================
// Current Wallet Display
// ================================================================

function displayCurrentWallet() {
  if (!hdManager) {
    console.log("HD Manager not available");
    // Hide current wallet section if no HD manager
    const currentWalletSection = document.getElementById('current-wallet-section');
    if (currentWalletSection) {
      currentWalletSection.style.display = 'none';
    }
    return;
  }
  
  const currentWallet = hdManager.getCurrentWallet();
  
  if (currentWallet) {
    // Update wallet name
    const walletNameEl = document.getElementById('current-wallet-name');
    if (walletNameEl) {
      walletNameEl.textContent = currentWallet.name || 'Unnamed Wallet';
    }
    
    // Update wallet type
    const walletTypeEl = document.getElementById('current-wallet-type');
    if (walletTypeEl) {
      const typeDisplay = currentWallet.type === 'hd' ? 'HD WALLET' : 'IMPORTED';
      walletTypeEl.textContent = typeDisplay;
      walletTypeEl.className = `wallet-type wallet-type-${currentWallet.type}`;
    }
    
    // Update account count
    const accountCountEl = document.getElementById('current-account-count');
    if (accountCountEl) {
      const count = currentWallet.accounts ? currentWallet.accounts.length : 0;
      accountCountEl.textContent = `${count} account${count !== 1 ? 's' : ''}`;
    }
    
    // Show current wallet section
    const currentWalletSection = document.getElementById('current-wallet-section');
    if (currentWalletSection) {
      currentWalletSection.style.display = 'block';
    }
  } else {
    // No wallet exists - hide current wallet section
    const currentWalletSection = document.getElementById('current-wallet-section');
    if (currentWalletSection) {
      currentWalletSection.style.display = 'none';
    }
    
    // Change divider text
    const divider = document.querySelector('.divider span');
    if (divider) {
      divider.textContent = 'Create or import your first wallet';
    }
  }
}

function checkAddAccountAvailability() {
  if (!hdManager) return;
  
  const currentWallet = hdManager.getCurrentWallet();
  
  // Show add account button only for HD wallets
  const addAccountBtn = document.getElementById('add-account-btn');
  if (addAccountBtn) {
    if (currentWallet && currentWallet.type === 'hd') {
      addAccountBtn.style.display = 'flex';
      // Check if we've reached account limit
      if (currentWallet.accounts && currentWallet.accounts.length >= 100) {
        addAccountBtn.disabled = true;
        const btnContent = addAccountBtn.querySelector('p');
        if (btnContent) {
          btnContent.textContent = 'Maximum accounts reached (100)';
        }
      }
    } else {
      addAccountBtn.style.display = 'none';
    }
  }
}

// ================================================================
// Add Account to Current Wallet
// ================================================================

async function addAccountToCurrent() {
  if (!hdManager) {
    showToast("Wallet manager not initialized", "error");
    return;
  }
  
  const currentWallet = hdManager.getCurrentWallet();
  
  if (!currentWallet || currentWallet.type !== 'hd') {
    showToast("Cannot add account to this wallet type", "error");
    return;
  }
  
  // Check account limit
  if (currentWallet.accounts && currentWallet.accounts.length >= 100) {
    showToast("Maximum number of accounts reached (100)", "warning");
    return;
  }
  
  try {
    // Disable button during operation
    const btn = document.getElementById('add-account-btn');
    const originalContent = btn ? btn.innerHTML : '';
    
    if (btn) {
      btn.classList.add('loading');
      btn.disabled = true;
      btn.innerHTML = `
        <div class="spinner"></div>
        <div class="option-content">
          <h3>Adding Account...</h3>
          <p>Please wait</p>
        </div>
      `;
    }
    
    showToast("Adding new account...", "info");
    
    // Add account using HD Manager
    const result = await hdManager.addAccountToWallet(currentWallet.id);
    
    if (result) {
      showToast(`${result.name || 'New account'} added successfully!`, "success");
      
      // Refresh display
      displayCurrentWallet();
      
      // Success animation
      if (btn) {
        btn.classList.remove('loading');
        btn.classList.add('success');
        btn.innerHTML = `
          <div class="option-icon">✅</div>
          <div class="option-content">
            <h3>Account Added!</h3>
            <p>Redirecting to main page...</p>
          </div>
        `;
        
        setTimeout(() => {
          navigateBack();
        }, 1500);
      }
    } else {
      throw new Error("Failed to add account");
    }
    
  } catch (error) {
    console.error("Failed to add account:", error);
    showToast("Failed to add account: " + error.message, "error");
    
    // Restore button
    const btn = document.getElementById('add-account-btn');
    if (btn) {
      btn.classList.remove('loading', 'success');
      btn.disabled = false;
      btn.innerHTML = originalContent || `
        <div class="option-icon">➕</div>
        <div class="option-content">
          <h3>Add Account</h3>
          <p>Add a new account to the current HD wallet</p>
        </div>
      `;
    }
  }
}

// ================================================================
// Create New Wallet
// ================================================================

async function createNewWallet() {
  if (!hdManager) {
    showToast("Wallet manager not initialized", "error");
    return;
  }

  try {
    // Show wallet name input modal
    const walletName = await showWalletNameModal();

    // If user cancelled, exit
    if (walletName === null) {
      return;
    }

    showToast("Creating new wallet...", "info");

    // Create wallet using HD Manager
    const result = await hdManager.createNewWallet();

    // Set custom name if provided
    if (walletName && walletName.trim()) {
      hdManager.renameWallet(result.id, walletName.trim());
    }

    // ✅ SECURE: Decrypt mnemonic ONLY for backup display
    // This requires user authentication and is immediately cleared after
    let mnemonic = null;
    try {
      const firstAccount = result.accounts[0];
      console.log('[AddWallet] Retrieving mnemonic for backup display...');
      mnemonic = await hdManager.getMnemonicForWallet(result.id, firstAccount.address);

      if (!mnemonic) {
        throw new Error('Failed to retrieve mnemonic for backup');
      }

      // Show mnemonic backup with copy functionality
      showMnemonicBackup(mnemonic);

      showToast("Wallet created successfully!", "success");

    } finally {
      // ✅ SECURE: Clear mnemonic from memory immediately
      if (mnemonic && window.SecurityUtils) {
        console.log('[AddWallet] Clearing mnemonic from memory...');
        window.SecurityUtils.clearString(mnemonic);
      }
      mnemonic = null;
    }

  } catch (error) {
    console.error("Failed to create wallet:", error);
    showToast("Failed to create wallet: " + error.message, "error");
  }
}

// ================================================================
// Import Forms UI Management
// ================================================================

function showMnemonicImport() {
  // Hide other forms
  const privateKeyForm = document.getElementById('privatekey-form');
  if (privateKeyForm) privateKeyForm.style.display = 'none';
  
  // Hide option cards
  document.querySelectorAll('.option-card').forEach(card => {
    card.style.display = 'none';
  });
  
  // Show mnemonic form
  const mnemonicForm = document.getElementById('mnemonic-form');
  if (mnemonicForm) {
    mnemonicForm.style.display = 'block';
    // Focus on input
    const input = document.getElementById('mnemonic-input');
    if (input) input.focus();
  }
}

function showPrivateKeyImport() {
  // Hide other forms
  const mnemonicForm = document.getElementById('mnemonic-form');
  if (mnemonicForm) mnemonicForm.style.display = 'none';
  
  // Hide option cards
  document.querySelectorAll('.option-card').forEach(card => {
    card.style.display = 'none';
  });
  
  // Show private key form
  const privateKeyForm = document.getElementById('privatekey-form');
  if (privateKeyForm) {
    privateKeyForm.style.display = 'block';
    // Focus on input
    const input = document.getElementById('privatekey-input');
    if (input) input.focus();
  }
}

function cancelImport() {
  // Hide all forms
  const mnemonicForm = document.getElementById('mnemonic-form');
  const privateKeyForm = document.getElementById('privatekey-form');
  
  if (mnemonicForm) mnemonicForm.style.display = 'none';
  if (privateKeyForm) privateKeyForm.style.display = 'none';
  
  // Show option cards again
  document.querySelectorAll('.option-card').forEach(card => {
    // Don't show add account button if it should be hidden
    if (card.id === 'add-account-btn') {
      checkAddAccountAvailability();
    } else {
      card.style.display = 'flex';
    }
  });
  
  // Clear inputs
  ['mnemonic-input', 'wallet-name-input', 'privatekey-input', 'account-name-input']
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
}

// ================================================================
// Import with Mnemonic
// ================================================================

async function importFromMnemonic() {
  if (!hdManager) {
    showToast("Wallet manager not initialized", "error");
    return;
  }
  
  const mnemonicInput = document.getElementById('mnemonic-input');
  const walletNameInput = document.getElementById('wallet-name-input');
  
  if (!mnemonicInput) return;
  
  const mnemonic = mnemonicInput.value.trim();
  const walletName = walletNameInput ? walletNameInput.value.trim() : undefined;
  
  if (!mnemonic) {
    showToast("Please enter mnemonic phrase", "error");
    return;
  }
  
  // Validate mnemonic format
  const wordCount = mnemonic.split(/\s+/).length;
  if (wordCount !== 12 && wordCount !== 24) {
    showToast("Mnemonic must be 12 or 24 words", "error");
    return;
  }
  
  try {
    // Create custom dialog for import options
    const importDialog = createImportDialog();
    document.body.appendChild(importDialog);
    
    // Wait for user choice
    const choice = await new Promise((resolve) => {
      const discoveryBtn = importDialog.querySelector('#discovery-import');
      const quickBtn = importDialog.querySelector('#quick-import');
      const customBtn = importDialog.querySelector('#custom-import');
      const cancelBtn = importDialog.querySelector('#cancel-import');
      
      discoveryBtn.onclick = () => {
        document.body.removeChild(importDialog);
        resolve('discovery');
      };
      
      quickBtn.onclick = () => {
        document.body.removeChild(importDialog);
        resolve('quick');
      };
      
      customBtn.onclick = () => {
        document.body.removeChild(importDialog);
        const count = prompt("How many accounts to import? (1-20):");
        const accountCount = parseInt(count);
        if (!isNaN(accountCount) && accountCount >= 1 && accountCount <= 20) {
          resolve(accountCount);
        } else {
          resolve(null);
        }
      };
      
      cancelBtn.onclick = () => {
        document.body.removeChild(importDialog);
        resolve(null);
      };
    });
    
    if (choice === null) {
      return; // User cancelled
    }
    
    let result;
    
    if (choice === 'discovery') {
      showToast("Discovering used accounts...", "info");
      result = await hdManager.importWalletWithDiscovery(mnemonic, walletName);
    } else if (choice === 'quick') {
      showToast("Importing wallet...", "info");
      result = await hdManager.importWalletFromMnemonic(mnemonic, walletName);
    } else if (typeof choice === 'number') {
      showToast(`Importing ${choice} accounts...`, "info");
      result = await hdManager.importWalletWithDiscovery(mnemonic, walletName, choice);
    } else {
      return;
    }
    
    // Handle result
    if (result) {
      if (result.alreadyExists) {
        showToast("Switched to existing wallet", "info");
      } else {
        const accountCount = result.accounts ? result.accounts.length : 1;
        showToast(`Wallet imported with ${accountCount} account(s)!`, "success");
      }
      
      // Navigate back to main page
      setTimeout(() => {
        navigateBack();
      }, 1500);
    }
    
  } catch (error) {
    console.error("Mnemonic import failed:", error);
    showToast("Failed to import wallet: " + error.message, "error");
  }
}

// ================================================================
// Import with Private Key
// ================================================================

async function importFromPrivateKey() {
  if (!hdManager) {
    showToast("Wallet manager not initialized", "error");
    return;
  }
  
  const privateKeyInput = document.getElementById('privatekey-input');
  const accountNameInput = document.getElementById('account-name-input');
  
  if (!privateKeyInput) return;
  
  let privateKey = privateKeyInput.value.trim();
  const accountName = accountNameInput ? accountNameInput.value.trim() : undefined;
  
  if (!privateKey) {
    showToast("Please enter private key", "error");
    return;
  }
  
  // Add 0x prefix if missing
  if (!privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey;
  }
  
  // Validate private key format
  if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey)) {
    showToast("Invalid private key format", "error");
    return;
  }
  
  try {
    showToast("Importing account...", "info");
    
    // Import using HD Manager
    const result = await hdManager.importWalletFromPrivateKey(privateKey, accountName);
    
    if (result) {
      if (result.alreadyExists) {
        showToast("Switched to existing account", "info");
      } else {
        showToast("Account imported successfully!", "success");
      }
      
      // Clear the private key input for security
      privateKeyInput.value = '';
      
      // Navigate back to main page
      setTimeout(() => {
        navigateBack();
      }, 1500);
    }
    
  } catch (error) {
    console.error("Private key import failed:", error);
    showToast("Failed to import account: " + error.message, "error");
  }
}

// ================================================================
// Utilities
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  const config = window.getConfig ? window.getConfig() : window.CoinConfig;
  
  if (config && config.theme) {
    root.style.setProperty("--coin-primary", config.theme.primaryColor);
    root.style.setProperty("--coin-secondary", config.theme.secondaryColor);
    root.style.setProperty("--coin-dark", "#312E81");
    root.style.setProperty("--coin-light", "#E0E7FF");
    root.style.setProperty("--coin-gradient", `linear-gradient(135deg, ${config.theme.primaryColor} 0%, ${config.theme.secondaryColor} 100%)`);
  }
}

function showMnemonicBackup(mnemonic) {
  // Create a more user-friendly backup dialog
  const dialog = document.createElement('div');
  dialog.className = 'mnemonic-backup-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay"></div>
    <div class="dialog-content">
      <h2>⚠️ Important: Save Your Recovery Phrase</h2>
      <p class="warning-text">Write down these words in order. This is the ONLY way to recover your wallet!</p>
      <div class="mnemonic-display">
        ${mnemonic.split(' ').map((word, index) =>
          `<span class="mnemonic-word">${index + 1}. ${word}</span>`
        ).join('')}
      </div>
      <div class="dialog-buttons">
        <button class="btn-copy" onclick="copyMnemonic('${mnemonic}')">📋 Copy to Clipboard</button>
        <button class="btn-confirm" onclick="confirmMnemonicSaved()">✅ I've Saved It</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Auto-focus on confirm button
  setTimeout(() => {
    const confirmBtn = dialog.querySelector('.btn-confirm');
    if (confirmBtn) confirmBtn.focus();
  }, 100);
}

async function copyMnemonic(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Recovery phrase copied to clipboard", "success");
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("Recovery phrase copied to clipboard", "success");
    } catch (err) {
      showToast("Failed to copy. Please copy manually.", "error");
    }
    document.body.removeChild(textArea);
  }
}

function closeMnemonicDialog() {
  const dialog = document.querySelector('.mnemonic-backup-dialog');
  if (dialog) {
    dialog.remove();
  }
}

function confirmMnemonicSaved() {
  closeMnemonicDialog();
  // Navigate back to main page after user confirms
  setTimeout(() => {
    navigateBack();
  }, 500);
}

function showWalletNameModal() {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'wallet-name-modal';
    modal.innerHTML = `
      <div class="dialog-overlay"></div>
      <div class="dialog-content">
        <h2>Name Your Wallet</h2>
        <p>Enter a name for your new wallet (optional)</p>
        <input
          type="text"
          id="wallet-name-modal-input"
          class="import-input"
          placeholder="e.g., My Main Wallet"
          maxlength="50"
        />
        <div class="dialog-buttons">
          <button class="btn-secondary btn" id="wallet-name-cancel">Skip</button>
          <button class="btn-primary btn" id="wallet-name-confirm">Continue</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#wallet-name-modal-input');
    const cancelBtn = modal.querySelector('#wallet-name-cancel');
    const confirmBtn = modal.querySelector('#wallet-name-confirm');

    // Focus input
    setTimeout(() => input.focus(), 100);

    // Enter key to confirm
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const name = input.value.trim();
        modal.remove();
        resolve(name || '');
      }
    });

    // Cancel button
    cancelBtn.onclick = () => {
      modal.remove();
      resolve('');
    };

    // Confirm button
    confirmBtn.onclick = () => {
      const name = input.value.trim();
      modal.remove();
      resolve(name || '');
    };
  });
}

function createImportDialog() {
  const dialog = document.createElement('div');
  dialog.className = 'import-options-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay"></div>
    <div class="dialog-content">
      <h2>Import Options</h2>
      <p>Choose how to import your wallet:</p>
      
      <button id="discovery-import" class="import-option">
        <div class="option-icon">🔍</div>
        <div class="option-text">
          <h3>Smart Discovery</h3>
          <p>Automatically find all your used accounts (Recommended)</p>
        </div>
      </button>
      
      <button id="quick-import" class="import-option">
        <div class="option-icon">⚡</div>
        <div class="option-text">
          <h3>Quick Import</h3>
          <p>Import only the first account</p>
        </div>
      </button>
      
      <button id="custom-import" class="import-option">
        <div class="option-icon">⚙️</div>
        <div class="option-text">
          <h3>Custom Import</h3>
          <p>Choose specific number of accounts</p>
        </div>
      </button>
      
      <button id="cancel-import" class="dialog-cancel">Cancel</button>
    </div>
  `;
  
  return dialog;
}

// ================================================================
// Navigation
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
// Global Functions (for HTML onclick)
// ================================================================

window.addAccountToCurrent = addAccountToCurrent;
window.createNewWallet = createNewWallet;
window.showMnemonicImport = showMnemonicImport;
window.showPrivateKeyImport = showPrivateKeyImport;
window.cancelImport = cancelImport;
window.importFromMnemonic = importFromMnemonic;
window.importFromPrivateKey = importFromPrivateKey;
window.navigateBack = navigateBack;
window.copyMnemonic = copyMnemonic;
window.closeMnemonicDialog = closeMnemonicDialog;
window.confirmMnemonicSaved = confirmMnemonicSaved;