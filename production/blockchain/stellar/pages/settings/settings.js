// ================================================================
// Settings Page Logic - Stellar
// ================================================================

let currentWallet = null;

// Utils functions - helpers.js에서 전역으로 제공됨
const { copyToClipboard: copyToClipboardUtil } = window.StellarUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Settings] Page loaded");
  loadWalletData();
  applyTheme();
  updateNetworkDisplay();
});

// Apply theme
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);
}

// Update network display
function updateNetworkDisplay() {
  const network = window.StellarConfig?.getCurrentNetwork();
  const networkName = network ? network.displayName : 'Testnet';
  const networkElement = document.getElementById('current-network-name');
  if (networkElement) {
    networkElement.textContent = networkName;
  }

  // Show/hide faucet section based on network
  const activeNetwork = window.StellarConfig?.getActiveNetwork();
  const faucetSection = document.getElementById('faucet-section');
  if (faucetSection) {
    if (activeNetwork === 'testnet' || activeNetwork === 'futurenet') {
      faucetSection.style.display = 'block';
    } else {
      faucetSection.style.display = 'none';
    }
  }
}

// Load wallet data
function loadWalletData() {
  const walletData = WalletStorage.get();

  if (walletData) {
    currentWallet = walletData;
  } else {
    window.StellarUtils?.showToast("No wallet found", "error");
    navigateBack();
  }
}

// Navigate back to main page
function navigateBack() {
  window.location.href = "../index/index.html";
}

// Show recovery phrase
async function showRecoveryPhrase() {
  // Access sensitive data using getSecure
  const secureWallet = await WalletStorage.getSecure();

  if (!secureWallet || !secureWallet.mnemonic) {
    window.StellarUtils?.showToast("No recovery phrase available", "warning");
    return;
  }

  showModal(
    "Recovery Phrase",
    "Keep these 12 words safe. You can recover your wallet with this phrase.",
    secureWallet.mnemonic
  );
}

// Export private key
async function exportPrivateKey() {
  // Access sensitive data using getPrivateKeySecure
  const privateKey = await WalletStorage.getPrivateKeySecure();

  if (!privateKey) {
    window.StellarUtils?.showToast("No private key available", "warning");
    return;
  }

  showModal(
    "Private Key (Secret Seed)",
    "Never share this private key with anyone. Anyone with this key can access all assets in your wallet.",
    privateKey
  );
}

// Delete wallet
function deleteWallet() {
  if (!confirm("Are you sure you want to delete this wallet? This action cannot be undone. Make sure you have backed up your recovery phrase!")) {
    return;
  }

  try {
    // Get wallet address before clearing
    const wallet = WalletStorage.get();

    // Clear wallet data
    WalletStorage.clear();

    // Clear keystore if it exists
    if (wallet && wallet.address) {
      localStorage.removeItem(`keystore_${wallet.address}`);
    }

    // Clear transaction cache (Stellar specific)
    const txCacheKey = `${CoinConfig.symbol.toLowerCase()}_tx_cache`;
    localStorage.removeItem(txCacheKey);

    // Clear wallet status
    localStorage.removeItem(`${CoinConfig.symbol.toLowerCase()}_wallet_status`);
    localStorage.removeItem(`${CoinConfig.symbol.toLowerCase()}_mnemonic_skip_count`);

    // Clear balance cache
    if (wallet && wallet.address) {
      localStorage.removeItem(`xlm_tx_${wallet.address}`);
    }

    window.StellarUtils?.showToast("Wallet deleted successfully", "success");

    // Navigate back to wallet creation page immediately
    setTimeout(() => {
      window.location.href = "../index/index.html";
    }, 500);
  } catch (error) {
    console.error("[Settings] Failed to delete wallet:", error);
    window.StellarUtils?.showToast("Failed to delete wallet", "error");
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
      console.error("[Settings] Failed to copy:", error);
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
    window.StellarUtils?.showToast("Failed to copy to clipboard", "error");
  }
}

// Fund testnet account
async function fundAccount() {
  const walletData = WalletStorage.get();
  if (!walletData) {
    window.StellarUtils?.showToast("No wallet found", "error");
    return;
  }

  const network = window.StellarConfig?.getActiveNetwork();
  if (network !== 'testnet' && network !== 'futurenet') {
    window.StellarUtils?.showToast("Funding only available on testnet/futurenet", "warning");
    return;
  }

  showToast && showToast("Requesting testnet XLM...", "info");

  const success = await window.StellarUtils?.fundTestAccount(walletData.address);
  if (success) {
    window.StellarUtils?.showToast("Account funded successfully! Check your balance.", "success");
  }
}

// Click outside modal to close
window.addEventListener("click", function(event) {
  const modal = document.getElementById("modal");
  const networkModal = document.getElementById("network-modal");

  if (event.target === modal) {
    closeModal();
  } else if (event.target === networkModal) {
    closeNetworkModal();
  }
});

// Network Management Functions
function showNetworkSelector() {
  console.log("[Settings] Opening network selector");
  const modal = document.getElementById("network-modal");
  modal.style.display = "flex";

  // Update checkmarks based on current network
  const currentNetworkId = window.StellarConfig?.getActiveNetwork() || 'testnet';
  updateNetworkCheckmarks(currentNetworkId);
}

function closeNetworkModal() {
  const modal = document.getElementById("network-modal");
  modal.style.display = "none";
}

async function selectNetwork(networkId) {
  console.log("[Settings] Starting network switch to:", networkId);

  try {
    // Get current wallet data
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    const currentWalletData = { ...currentWallet };
    console.log("[Settings] Current wallet data:", {
      address: currentWalletData.address,
      hasNetwork: !!currentWalletData.network
    });

    // Change network
    console.log("[Settings] Calling setActiveNetwork...");
    const success = window.StellarConfig.setActiveNetwork(networkId);

    if (!success) {
      console.error("[Settings] Failed to set active network");
      window.StellarUtils?.showToast('Invalid network', 'error');
      return;
    }

    console.log("[Settings] Network changed successfully");

    // Clear all caches when network changes (using Config function like other chains)
    window.StellarConfig.clearNetworkCache();

    // Update UI checkmarks
    updateNetworkCheckmarks(networkId);

    // Get network name
    const network = window.StellarConfig.getCurrentNetwork();
    const networkName = network ? network.displayName : networkId;

    // Update current network display
    updateNetworkDisplay();

    // Close modal
    closeNetworkModal();

    // Note: Stellar uses the same address/keys across all networks
    // Only the network configuration changes
    window.StellarUtils?.showToast(`Switched to ${networkName}`, 'success');

    // Reload page to apply new network settings
    console.log("[Settings] Reloading page in 500ms...");
    setTimeout(() => {
      window.location.reload();
    }, 500);

  } catch (error) {
    console.error('[Settings] Failed to switch network:', error);
    window.StellarUtils?.showToast('Failed to switch network', 'error');
  }
}

function updateNetworkCheckmarks(networkId) {
  // Hide all checkmarks
  document.querySelectorAll('.network-check').forEach(el => {
    el.style.display = 'none';
  });

  // Show selected network checkmark
  const checkElement = document.getElementById(`${networkId}-check`);
  if (checkElement) {
    checkElement.style.display = 'flex';
  }
}

// Export functions for HTML onclick handlers
window.navigateBack = navigateBack;
window.showRecoveryPhrase = showRecoveryPhrase;
window.exportPrivateKey = exportPrivateKey;
window.deleteWallet = deleteWallet;
window.showModal = showModal;
window.closeModal = closeModal;
window.copyToClipboard = copyToClipboard;
window.showNetworkSelector = showNetworkSelector;
window.closeNetworkModal = closeNetworkModal;
window.selectNetwork = selectNetwork;
window.fundAccount = fundAccount;

console.log('[Settings] Stellar settings page loaded');
