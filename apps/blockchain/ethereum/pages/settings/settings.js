// Settings Page Logic

let currentWallet = null;

// Utils 함수 가져오기
const { showToast, copyToClipboard: copyToClipboardUtil } = window.EthereumUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Settings page loaded");
  loadWalletData();
  applyTheme();
  checkRecoveryPhraseAvailability();
});

// Apply theme
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);
}

// Load wallet data
function loadWalletData() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);
  
  if (walletData) {
    currentWallet = JSON.parse(walletData);
  } else {
    showToast("No wallet found");
    navigateBack();
  }
}

// Navigate back to main page
function navigateBack() {
  window.location.href = "../index/index.html";
}

// Check if recovery phrase is available
function checkRecoveryPhraseAvailability() {
  if (!currentWallet || !currentWallet.mnemonic) {
    // Disable recovery phrase button if no mnemonic
    const recoveryBtn = document.getElementById("recovery-phrase-btn");
    const recoveryText = document.getElementById("recovery-phrase-text");
    
    if (recoveryBtn) {
      recoveryBtn.disabled = true;
      recoveryBtn.style.opacity = "0.5";
      recoveryBtn.style.cursor = "not-allowed";
      recoveryBtn.onclick = null;
    }
    
    if (recoveryText) {
      recoveryText.textContent = "Recovery Phrase Not Available";
    }
  }
}

// Show recovery phrase
function showRecoveryPhrase() {
  if (!currentWallet || !currentWallet.mnemonic) {
    showToast("No recovery phrase available");
    return;
  }
  
  showModal(
    "Recovery Phrase",
    "Keep these 12 words safe. You can recover your wallet with this phrase.",
    currentWallet.mnemonic
  );
}

// Export private key
function exportPrivateKey() {
  if (!currentWallet || !currentWallet.privateKey) {
    showToast("No private key available");
    return;
  }
  
  showModal(
    "Private Key",
    "Never share this private key with anyone. Anyone with this key can access all assets in your wallet.",
    currentWallet.privateKey
  );
}

// Delete wallet
function deleteWallet() {
  try {
    // Clear wallet data
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.removeItem(walletKey);
    
    // Clear transaction cache
    localStorage.removeItem("eth_tx_cache");
    
    // Clear any other related data
    localStorage.removeItem("walletData");
    
    showToast("Wallet deleted successfully");
    
    // Navigate back to wallet creation page immediately
    setTimeout(() => {
      window.location.href = "../index/index.html";
    }, 500);
  } catch (error) {
    console.error("Failed to delete wallet:", error);
    showToast("Failed to delete wallet");
  }
}

// Modal functions
function showModal(title, message, value) {
  const modal = document.getElementById("modal");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const modalValue = document.getElementById("modal-value");
  
  modalTitle.textContent = title;
  modalMessage.textContent = message;
  modalValue.textContent = value;
  modalValue.dataset.value = value; // Store for copying
  
  modal.style.display = "flex";
  
  // Reset copy button
  const copyBtn = document.getElementById("copy-btn");
  copyBtn.textContent = "Copy";
  copyBtn.classList.remove("copied");
}

function closeModal() {
  const modal = document.getElementById("modal");
  modal.style.display = "none";
  
  // Clear sensitive data
  const modalValue = document.getElementById("modal-value");
  modalValue.textContent = "";
  modalValue.dataset.value = "";
}

// Copy to clipboard
async function copyToClipboard() {
  const modalValue = document.getElementById("modal-value");
  const value = modalValue.dataset.value;
  const copyBtn = document.getElementById("copy-btn");
  
  let success = false;
  
  if (copyToClipboardUtil) {
    success = await copyToClipboardUtil(value);
  } else {
    // Fallback to direct clipboard API
    try {
      await navigator.clipboard.writeText(value);
      success = true;
    } catch (error) {
      console.error("Failed to copy:", error);
    }
  }
  
  if (success) {
    copyBtn.textContent = "Copied!";
    copyBtn.classList.add("copied");
    
    setTimeout(() => {
      copyBtn.textContent = "Copy";
      copyBtn.classList.remove("copied");
    }, 2000);
  } else {
    showToast("Failed to copy to clipboard");
  }
}

// Click outside modal to close
window.addEventListener("click", function(event) {
  const modal = document.getElementById("modal");
  if (event.target === modal) {
    closeModal();
  }
});