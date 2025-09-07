// Settings Page Logic

let currentWallet = null;

// Utils 함수 가져오기
const { showToast, copyToClipboard: copyToClipboardUtil } = window.EthereumUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Settings page loaded");
  loadWalletData();
  applyTheme();
  updateNetworkDisplay(); // 현재 네트워크 표시
});

// Apply theme
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);
}

// Load wallet data
function loadWalletData() {
  currentWallet = WalletStorage.get();
  
  if (currentWallet) {
  } else {
    showToast("No wallet found");
    navigateBack();
  }
}

// Navigate back to main page
function navigateBack() {
  window.location.href = "../index/index.html";
}


// Show recovery phrase
function showRecoveryPhrase() {
  if (!currentWallet || !currentWallet.mnemonic) {
    // This should not happen anymore as all wallets have mnemonic
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
    WalletStorage.clear();
    
    // Clear transaction cache
    localStorage.removeItem("eth_tx_cache");
    
    showToast("Wallet deleted successfully");
    
    // Navigate back to wallet creation page immediately
    setTimeout(() => {
      window.location.href = "../index/index.html";
    }, 500);
  } catch (error) {
    console.log("Failed to delete wallet:", error);
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
      console.log("Failed to copy:", error);
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

// Network Management Functions
function showNetworkSelector() {
  console.log("Opening network selector");
  const modal = document.getElementById("network-modal");
  modal.style.display = "flex";
  
  // Update checkmarks based on current network
  const currentNetworkId = window.EthereumConfig?.getActiveNetwork() || 'mainnet';
  updateNetworkCheckmarks(currentNetworkId);
  
  // Load custom networks
  loadCustomNetworks();
}

function closeNetworkModal() {
  const modal = document.getElementById("network-modal");
  modal.style.display = "none";
}

async function selectNetwork(networkId) {
  console.log("Selecting network:", networkId);
  
  try {
    // 네트워크 변경
    window.EthereumConfig.setActiveNetwork(networkId);
    
    // UI 체크마크 업데이트
    updateNetworkCheckmarks(networkId);
    
    // 캐시 초기화
    clearNetworkCache();
    
    // 성공 메시지
    const networkName = getNetworkDisplayName(networkId);
    showToast(`Switched to ${networkName}`);
    
    // 현재 네트워크 표시 업데이트
    updateNetworkDisplay();
    
    // 모달 닫기
    closeNetworkModal();
    
    // 잠시 후 페이지 새로고침 (네트워크 변경 반영)
    setTimeout(() => {
      window.location.reload();
    }, 1000);
    
  } catch (error) {
    console.log('Failed to switch network:', error);
    showToast('Failed to switch network');
  }
}

function updateNetworkCheckmarks(networkId) {
  // 모든 체크마크 숨기기
  document.querySelectorAll('.network-check').forEach(el => {
    el.style.display = 'none';
  });
  
  // 선택된 네트워크 체크마크 표시
  const checkElement = document.getElementById(`${networkId}-check`);
  if (checkElement) {
    checkElement.style.display = 'flex';
  } else if (networkId.startsWith('custom_')) {
    // 커스텀 네트워크의 경우
    const customCheck = document.querySelector(`[data-network-id="${networkId}"] .network-check`);
    if (customCheck) {
      customCheck.style.display = 'flex';
    }
  }
}

function clearNetworkCache() {
  // 네트워크 관련 캐시 삭제
  localStorage.removeItem('eth_tx_cache');
  localStorage.removeItem('eth_balance_cache');
  localStorage.removeItem('eth_price_cache');
  console.log('Network cache cleared');
}

function getNetworkDisplayName(networkId) {
  const networks = window.EthereumConfig?.NETWORKS;
  if (networks && networks[networkId]) {
    return networks[networkId].name;
  }
  
  // 커스텀 네트워크
  const customNetworks = window.EthereumConfig?.getCustomNetworks() || [];
  const customNetwork = customNetworks.find(n => n.id === networkId);
  if (customNetwork) {
    return customNetwork.name;
  }
  
  return networkId;
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

async function addCustomRPC(event) {
  event.preventDefault();
  
  console.log("Adding custom RPC");
  
  // Get form values
  const networkName = document.getElementById("network-name").value.trim();
  const rpcUrl = document.getElementById("rpc-url").value.trim();
  const chainId = document.getElementById("chain-id").value.trim();
  const currencySymbol = document.getElementById("currency-symbol").value.trim() || "ETH";
  const explorerUrl = document.getElementById("explorer-url").value.trim();
  
  // Validate RPC URL
  if (!rpcUrl.startsWith("https://") && !rpcUrl.startsWith("wss://")) {
    showToast("RPC URL must start with https:// or wss://");
    return;
  }
  
  // Test RPC connection
  showToast("Testing RPC connection...");
  
  try {
    const testProvider = new ethers.providers.JsonRpcProvider(rpcUrl, parseInt(chainId));
    const blockNumber = await testProvider.getBlockNumber();
    console.log("RPC connection successful, block number:", blockNumber);
  } catch (error) {
    console.log("RPC connection failed:", error);
    showToast("Failed to connect to RPC endpoint");
    return;
  }
  
  // Save custom network
  const customNetwork = {
    name: networkName,
    rpcEndpoint: rpcUrl,
    chainId: parseInt(chainId),
    symbol: currencySymbol,
    explorerUrl: explorerUrl
  };
  
  // Add to config
  const networkId = window.EthereumConfig.addCustomNetwork(customNetwork);
  console.log("Custom network saved with ID:", networkId);
  
  showToast("Custom RPC added successfully!");
  
  // Close modal and switch to new network
  closeCustomRPCModal();
  
  // Automatically switch to the new network
  await selectNetwork(networkId);
}

function loadCustomNetworks() {
  console.log("Loading custom networks");
  
  const container = document.getElementById("custom-networks-container");
  const customNetworks = window.EthereumConfig?.getCustomNetworks() || [];
  
  if (customNetworks.length === 0) {
    container.innerHTML = '';
    return;
  }
  
  // Generate HTML for custom networks
  const customNetworksHTML = customNetworks.map(network => `
    <div class="network-item custom-network-item" data-network-id="${network.id}" onclick="selectNetwork('${network.id}')">
      <div class="network-item-content">
        <div class="network-details">
          <span class="network-name">${network.name}</span>
          <span class="network-chain">Chain ID: ${network.chainId}</span>
        </div>
      </div>
      <span class="network-check" style="display: none;">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M7 10L9 12L13 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
      <button class="delete-network-btn" onclick="deleteCustomNetwork('${network.id}', event)" style="position: absolute; right: 40px;">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 4L12 12M4 12L12 4" stroke="currentColor" stroke-width="2"/>
        </svg>
      </button>
    </div>
  `).join('');
  
  container.innerHTML = customNetworksHTML;
  
  // Update check marks for current network
  const currentNetworkId = window.EthereumConfig?.getActiveNetwork();
  if (currentNetworkId && currentNetworkId.startsWith('custom_')) {
    updateNetworkCheckmarks(currentNetworkId);
  }
}

function deleteCustomNetwork(networkId, event) {
  event.stopPropagation(); // Prevent network selection
  
  console.log("Deleting custom network:", networkId);
  
  // Check if this is the current network
  const currentNetworkId = window.EthereumConfig?.getActiveNetwork();
  if (currentNetworkId === networkId) {
    showToast("Cannot delete active network. Switch to another network first.");
    return;
  }
  
  // Remove from storage
  window.EthereumConfig.removeCustomNetwork(networkId);
  
  showToast("Custom network removed");
  loadCustomNetworks();
}

function updateNetworkDisplay() {
  const currentNetworkId = window.EthereumConfig?.getActiveNetwork() || 'mainnet';
  const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
  
  const displayElement = document.getElementById("current-network-name");
  if (displayElement && currentNetwork) {
    // Display network name
    if (currentNetwork.name === 'mainnet') {
      displayElement.textContent = 'Ethereum Mainnet';
    } else if (currentNetwork.name === 'sepolia') {
      displayElement.textContent = 'Sepolia Testnet';
    } else {
      displayElement.textContent = currentNetwork.name;
    }
  }
}

