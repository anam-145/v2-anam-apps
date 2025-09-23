// Settings Page Logic

let currentWallet = null;

// Utils 함수 가져오기
const { showToast, copyToClipboard: copyToClipboardUtil } = window.SolanaUtils || {};

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

// Update network display
function updateNetworkDisplay() {
  const currentNetwork = window.SolanaConfig?.getCurrentNetwork();
  const networkName = currentNetwork?.displayName || currentNetwork?.name || 'Unknown';
  const networkElement = document.getElementById('current-network-name');
  if (networkElement) {
    networkElement.textContent = networkName;
  }
}

// Load wallet data
function loadWalletData() {
  const walletData = WalletStorage.get();
  
  if (walletData) {
    // WalletStorage.get()이 자동으로 네트워크 동기화함
    currentWallet = walletData;
  } else {
    showToast && showToast("No wallet found");
    navigateBack();
  }
}

// Navigate back to main page
function navigateBack() {
  window.location.href = "../index/index.html";
}


// Show recovery phrase
async function showRecoveryPhrase() {
  // 민감한 데이터 접근을 위해 getSecure 사용
  const secureWallet = await WalletStorage.getSecure();
  
  if (!secureWallet || !secureWallet.mnemonic) {
    showToast && showToast("No recovery phrase available", "warning");
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
  // 민감한 데이터 접근을 위해 getPrivateKeySecure 사용
  const privateKey = await WalletStorage.getPrivateKeySecure();
  
  if (!privateKey) {
    showToast && showToast("No private key available", "warning");
    return;
  }
  
  showModal(
    "Private Key (WIF)",
    "Never share this private key with anyone. Anyone with this key can access all assets in your wallet.",
    privateKey
  );
}

// Delete wallet
function deleteWallet() {
  try {
    // Get wallet address before clearing
    const wallet = WalletStorage.get();

    // Clear wallet data
    WalletStorage.clear();

    // Clear keystore if it exists
    if (wallet && wallet.address) {
      localStorage.removeItem(`keystore_${wallet.address}`);
    }

    // Clear ALL Solana-related caches comprehensively
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('sol_')) {
        keysToRemove.push(key);
      }
    }

    // Remove all Solana-related items
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log(`[Settings] Removed cache: ${key}`);
    });

    // Also clear address-specific cache if wallet exists
    if (wallet && wallet.address) {
      localStorage.removeItem(`sol_tx_${wallet.address}`);
      localStorage.removeItem(`sol_balance_${wallet.address}`);
      localStorage.removeItem(`sol_tokens_${wallet.address}`);
    }

    // Clear any pending flags
    localStorage.removeItem('sol_tx_pending');
    localStorage.removeItem('sol_balance_pending');

    showToast && showToast("Wallet deleted successfully", "success");
    
    // Navigate back to wallet creation page immediately
    setTimeout(() => {
      window.location.href = "../index/index.html";
    }, 500);
  } catch (error) {
    console.error("Failed to delete wallet:", error);
    showToast && showToast("Failed to delete wallet", "error");
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
    showToast && showToast("Failed to copy to clipboard", "error");
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
  const currentNetworkId = window.SolanaConfig?.getActiveNetwork() || 'devnet';
  updateNetworkCheckmarks(currentNetworkId);
}

function closeNetworkModal() {
  const modal = document.getElementById("network-modal");
  modal.style.display = "none";
}

async function selectNetwork(networkId) {
  console.log("[selectNetwork] Starting network switch to:", networkId);
  
  try {
    // 현재 지갑 데이터 확인
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    const currentWalletData = { ...currentWallet };
    console.log("[selectNetwork] Current wallet data:", {
      address: currentWalletData.address,
      hasNetworks: !!currentWalletData.networks,
      activeNetwork: currentWalletData.activeNetwork
    });
    
    // 네트워크 변경
    console.log("[selectNetwork] Calling setActiveNetwork...");
    const success = window.SolanaConfig.setActiveNetwork(networkId);
    
    if (!success) {
      console.error("[selectNetwork] Failed to set active network");
      showToast && showToast('Invalid network', 'error');
      return;
    }
    
    console.log("[selectNetwork] Network changed successfully");
    
    // UI 체크마크 업데이트
    updateNetworkCheckmarks(networkId);
    
    // 네트워크 캐시만 초기화 (API 캐시)
    console.log("[selectNetwork] Clearing network cache...");
    window.SolanaConfig.clearNetworkCache();
    
    // 성공 메시지
    const currentNetwork = window.SolanaConfig.getCurrentNetwork();
    const networkName = currentNetwork?.displayName || currentNetwork?.name;
    
    // 현재 네트워크 표시 업데이트
    updateNetworkDisplay();
    
    // 모달 닫기
    closeNetworkModal();
    
    // Solana는 모든 네트워크에서 동일한 주소 사용
    // 단순히 activeNetwork만 변경하면 됨
    if (currentWalletData) {
      console.log("[selectNetwork] Switching network for Solana wallet");
      
      // activeNetwork 업데이트
      currentWalletData.activeNetwork = networkId;
      
      console.log("[selectNetwork] Saving to localStorage...");
      localStorage.setItem(walletKey, JSON.stringify(currentWalletData));
      
      showToast && showToast(`Switched to ${networkName}`, 'success');
      
      // 페이지 새로고침
      console.log("[selectNetwork] Reloading page in 500ms...");
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } else {
      // 지갑이 없는 경우
      showToast && showToast('No wallet to switch', 'info');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
    
  } catch (error) {
    console.error('Failed to switch network:', error);
    showToast && showToast('Failed to switch network', 'error');
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


