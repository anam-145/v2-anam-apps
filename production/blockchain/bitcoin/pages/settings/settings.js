// Settings Page Logic

let currentWallet = null;

// Utils 함수 가져오기
const { showToast, copyToClipboard: copyToClipboardUtil } = window.BitcoinUtils || {};

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
  const networkName = window.BitcoinConfig?.displayName || 'Testnet4';
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
    
    // Clear transaction cache (Bitcoin specific)
    const txCacheKey = `${CoinConfig.symbol.toLowerCase()}_tx_cache`;
    localStorage.removeItem(txCacheKey);
    
    // Clear wallet status
    localStorage.removeItem(`${CoinConfig.symbol.toLowerCase()}_wallet_status`);
    localStorage.removeItem(`${CoinConfig.symbol.toLowerCase()}_mnemonic_skip_count`);
    
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
  const currentNetworkId = window.BitcoinConfig?.getActiveNetwork() || 'testnet4';
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
    const success = window.BitcoinConfig.setActiveNetwork(networkId);
    
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
    window.BitcoinConfig.clearNetworkCache();
    
    // 성공 메시지
    const networkName = window.BitcoinConfig.displayName;
    
    // 현재 네트워크 표시 업데이트
    updateNetworkDisplay();
    
    // 모달 닫기
    closeNetworkModal();
    
    // 새로운 구조의 지갑인지 확인
    if (currentWalletData?.networks) {
      console.log("[selectNetwork] Wallet has networks, switching immediately");
      console.log("[selectNetwork] Available networks:", Object.keys(currentWalletData.networks));
      
      // 이미 양쪽 네트워크 주소가 있는 경우 - 즉시 전환
      currentWalletData.activeNetwork = networkId;
      
      // 현재 네트워크 주소를 하위 호환성 필드에 복사
      const networkData = currentWalletData.networks[networkId];
      console.log("[selectNetwork] Network data for", networkId, ":", networkData);
      
      if (networkData) {
        currentWalletData.address = networkData.address;
        currentWalletData.privateKey = networkData.privateKey;
        console.log("[selectNetwork] Updated wallet address to:", currentWalletData.address);
      } else {
        console.error("[selectNetwork] No network data found for:", networkId);
      }
      
      console.log("[selectNetwork] Saving to localStorage...");
      localStorage.setItem(walletKey, JSON.stringify(currentWalletData));
      
      showToast && showToast(`Switched to ${networkName}`, 'success');
      
      // 페이지 새로고침 (빠르게)
      console.log("[selectNetwork] Reloading page in 500ms...");
      setTimeout(() => {
        window.location.reload();
      }, 500);
      
    } else if (currentWalletData?.mnemonic) {
      // 구 버전 지갑 - 새 구조로 마이그레이션
      showToast && showToast('Migrating wallet structure...', 'info');
      
      try {
        const adapter = window.getAdapter();
        const newWallet = await adapter.importFromMnemonic(currentWalletData.mnemonic);
        
        // 새 구조로 저장
        const walletData = {
          ...currentWalletData,  // 기존 데이터 유지
          ...newWallet,  // 새 구조 덮어쓰기
          activeNetwork: networkId
        };
        
        localStorage.setItem(walletKey, JSON.stringify(walletData));
        
        showToast && showToast(`Migrated and switched to ${networkName}`, 'success');
        
        setTimeout(() => {
          window.location.reload();
        }, 1000);
        
      } catch (error) {
        console.error('Failed to migrate wallet:', error);
        showToast && showToast('Migration failed', 'error');
      }
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


