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
  const networkModal = document.getElementById("network-modal");
  const customRpcModal = document.getElementById("custom-rpc-modal");
  
  if (event.target === modal) {
    closeModal();
  } else if (event.target === networkModal) {
    closeNetworkModal();
  } else if (event.target === customRpcModal) {
    closeCustomRPCModal();
  }
});

// Network Management Functions (Placeholders)
function showNetworkSelector() {
  console.log("Opening network selector");
  const modal = document.getElementById("network-modal");
  modal.style.display = "flex";
  
  // Update current network display
  updateNetworkDisplay();
  
  // Load custom networks
  loadCustomNetworks();
}

function closeNetworkModal() {
  const modal = document.getElementById("network-modal");
  modal.style.display = "none";
}

function selectNetwork(networkId) {
  console.log("Selecting network:", networkId);
  
  // Update UI checkmarks
  document.querySelectorAll('.network-check').forEach(el => {
    el.style.display = 'none';
  });
  
  const checkElement = document.getElementById(`${networkId}-check`);
  if (checkElement) {
    checkElement.style.display = 'block';
  }
  
  // TODO: Actually switch network
  showToast(`Switched to ${networkId}`);
  
  // Update current network display
  updateNetworkDisplay();
  
  // Close modal
  closeNetworkModal();
}

function showCustomRPCForm() {
  console.log("Opening custom RPC form");
  
  // Close network modal
  closeNetworkModal();
  
  // Open custom RPC modal
  const modal = document.getElementById("custom-rpc-modal");
  modal.style.display = "flex";
}

function closeCustomRPCModal() {
  const modal = document.getElementById("custom-rpc-modal");
  modal.style.display = "none";
  
  // Clear form
  document.getElementById("custom-rpc-form").reset();
}

function addCustomRPC(event) {
  event.preventDefault();
  
  console.log("Adding custom RPC");
  
  // Get form values
  const networkName = document.getElementById("network-name").value;
  const rpcUrl = document.getElementById("rpc-url").value;
  const chainId = document.getElementById("chain-id").value;
  const currencySymbol = document.getElementById("currency-symbol").value || "ETH";
  const explorerUrl = document.getElementById("explorer-url").value;
  
  // Validate RPC URL (basic test)
  if (!rpcUrl.startsWith("https://")) {
    showToast("RPC URL must start with https://");
    return;
  }
  
  // TODO: Test RPC connection
  console.log("Testing RPC connection to:", rpcUrl);
  
  // TODO: Save custom network
  const customNetwork = {
    id: `custom_${Date.now()}`,
    name: networkName,
    rpcEndpoint: rpcUrl,
    chainId: parseInt(chainId),
    symbol: currencySymbol,
    explorerUrl: explorerUrl
  };
  
  console.log("Custom network config:", customNetwork);
  
  showToast("Custom RPC added successfully!");
  
  // Close modal and refresh
  closeCustomRPCModal();
  showNetworkSelector();
}

function loadCustomNetworks() {
  console.log("Loading custom networks");
  
  const container = document.getElementById("custom-networks-container");
  
  // TODO: Load from localStorage
  // For now, just show placeholder
  container.innerHTML = `
    <!-- Example custom network (will be loaded dynamically) -->
    <!--
    <div class="network-item custom-network-item" onclick="selectNetwork('custom_1234')">
      <div class="network-item-content">
        <div class="network-details">
          <span class="network-name">My Custom RPC</span>
          <span class="network-chain">Chain ID: 1337</span>
        </div>
      </div>
      <button class="delete-network-btn" onclick="deleteCustomNetwork('custom_1234', event)">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>
    -->
  `;
}

function deleteCustomNetwork(networkId, event) {
  event.stopPropagation(); // Prevent network selection
  
  console.log("Deleting custom network:", networkId);
  
  // TODO: Remove from localStorage
  
  showToast("Custom network removed");
  loadCustomNetworks();
}

function updateNetworkDisplay() {
  // TODO: Get actual current network
  const currentNetworkName = "Sepolia Testnet"; // Placeholder
  
  const displayElement = document.getElementById("current-network-name");
  if (displayElement) {
    displayElement.textContent = currentNetworkName;
  }
}