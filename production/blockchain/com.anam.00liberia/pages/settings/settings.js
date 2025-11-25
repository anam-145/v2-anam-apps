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

  if (!currentWallet) {
    showToast("No wallet found");
    navigateBack();
  }
}

// Navigate back to main page
function navigateBack() {
  window.location.href = "../index/index.html";
}


// Show recovery phrase
async function showRecoveryPhrase() {
  showToast("Recovery phrase is not stored (deriveKey-only wallet)");
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

  if (event.target === modal) {
    closeModal();
  } else if (event.target === networkModal) {
    closeNetworkModal();
  }
});

// Network Management Functions
function showNetworkSelector() {
  console.log("Opening network selector");
  const modal = document.getElementById("network-modal");
  modal.style.display = "flex";
  
  // Update checkmarks based on current network
  const currentNetworkId = window.LiberiaConfig?.getActiveNetwork() || 'sepolia';
  updateNetworkCheckmarks(currentNetworkId);
}

function closeNetworkModal() {
  const modal = document.getElementById("network-modal");
  modal.style.display = "none";
}

async function selectNetwork(networkId) {
  console.log("Selecting network:", networkId);
  
  try {
    // 네트워크 변경
    window.LiberiaConfig.setActiveNetwork(networkId);
    
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
  }
}

function clearNetworkCache() {
  // 네트워크 관련 캐시 삭제 (USDC용)
  // 주의: liberia_active_network는 삭제하면 안 됨!
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key === 'liberia_active_network') {
      return; // 네트워크 설정은 유지
    }
    if (key.startsWith('usdc_tx_') || key.startsWith('liberia_tx_') ||
        key.startsWith('liberia_balance_') || key.startsWith('liberia_price_')) {
      localStorage.removeItem(key);
    }
  });
  localStorage.removeItem('usdc_has_pending_tx');
  localStorage.removeItem('usdc_pending_start_time');
  console.log('Network cache cleared');
}

function getNetworkDisplayName(networkId) {
  const networks = window.LiberiaConfig?.NETWORKS;
  if (networks && networks[networkId]) {
    return networks[networkId].name;
  }
  return networkId;
}

function updateNetworkDisplay() {
  const currentNetworkId = window.LiberiaConfig?.getActiveNetwork() || 'sepolia';
  const currentNetwork = window.LiberiaConfig?.getCurrentNetwork();

  const displayElement = document.getElementById("current-network-name");
  if (displayElement && currentNetwork) {
    displayElement.textContent = currentNetwork.name;
  }
}
