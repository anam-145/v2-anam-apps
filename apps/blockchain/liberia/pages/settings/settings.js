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
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);
  
  if (walletData) {
    currentWallet = JSON.parse(walletData);
    
    // 새 구조 지갑인 경우 현재 네트워크 주소 사용
    if (currentWallet.networks && currentWallet.activeNetwork) {
      const activeNetwork = currentWallet.activeNetwork;
      const networkData = currentWallet.networks[activeNetwork];
      if (networkData) {
        // 하위 호환성을 위해 최상위 레벨에도 현재 네트워크 정보 저장
        currentWallet.address = networkData.address;
        currentWallet.privateKey = networkData.privateKey;
      }
    }
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
function showRecoveryPhrase() {
  if (!currentWallet || !currentWallet.mnemonic) {
    // This should not happen anymore as all wallets have mnemonic
    showToast && showToast("No recovery phrase available", "warning");
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
    showToast && showToast("No private key available", "warning");
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
    
    // Clear transaction cache (Bitcoin specific)
    const txCacheKey = `${CoinConfig.symbol.toLowerCase()}_tx_cache`;
    localStorage.removeItem(txCacheKey);
    
    // Clear any other related data
    localStorage.removeItem("walletData");
    
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
  console.log("Selecting network:", networkId);
  
  try {
    // 현재 지갑 데이터 확인
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    const currentWalletData = { ...currentWallet };
    
    // 네트워크 변경
    const success = window.BitcoinConfig.setActiveNetwork(networkId);
    
    if (!success) {
      showToast && showToast('Invalid network', 'error');
      return;
    }
    
    // UI 체크마크 업데이트
    updateNetworkCheckmarks(networkId);
    
    // 캐시 초기화
    window.BitcoinConfig.clearNetworkCache();
    
    // 성공 메시지
    const networkName = window.BitcoinConfig.displayName;
    
    // 현재 네트워크 표시 업데이트
    updateNetworkDisplay();
    
    // 모달 닫기
    closeNetworkModal();
    
    // 새로운 구조의 지갑인지 확인
    if (currentWalletData?.networks) {
      // 이미 양쪽 네트워크 주소가 있는 경우 - 즉시 전환
      currentWalletData.activeNetwork = networkId;
      
      // 현재 네트워크 주소를 하위 호환성 필드에 복사
      const networkData = currentWalletData.networks[networkId];
      if (networkData) {
        currentWalletData.address = networkData.address;
        currentWalletData.privateKey = networkData.privateKey;
      }
      
      localStorage.setItem(walletKey, JSON.stringify(currentWalletData));
      
      showToast && showToast(`Switched to ${networkName}`, 'success');
      
      // 페이지 새로고침 (빠르게)
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


