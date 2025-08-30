// Settings Page Logic

let currentWallet = null;

// Utils 함수 가져오기
const { showToast, copyToClipboard: copyToClipboardUtil } = window.BitcoinUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Settings page loaded");
  loadWalletData();
  applyTheme();
  checkRecoveryPhraseAvailability();
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
  } else {
    showToast && showToast("No wallet found", "error");
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
    // 현재 지갑의 니모닉 저장 (있는 경우)
    const currentMnemonic = currentWallet?.mnemonic;
    
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
    showToast && showToast(`Switching to ${networkName}...`, 'info');
    
    // 현재 네트워크 표시 업데이트
    updateNetworkDisplay();
    
    // 모달 닫기
    closeNetworkModal();
    
    // 니모닉이 있는 경우 같은 시드로 새 네트워크 주소 생성
    if (currentMnemonic) {
      showToast && showToast('Regenerating wallet for new network...', 'info');
      
      try {
        // 어댑터 가져오기
        const adapter = window.getAdapter();
        
        // 같은 니모닉으로 새 네트워크 주소 생성
        const newWallet = await adapter.importFromMnemonic(currentMnemonic);
        
        // 새 지갑 데이터 저장
        const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
        localStorage.setItem(walletKey, JSON.stringify(newWallet));
        
        showToast && showToast(`Wallet regenerated for ${networkName}`, 'success');
        
        // 페이지 새로고침
        setTimeout(() => {
          window.location.reload();
        }, 1500);
        
      } catch (error) {
        console.error('Failed to regenerate wallet:', error);
        showToast && showToast('Failed to regenerate wallet. Please import manually.', 'error');
        
        // 실패 시 지갑 데이터 초기화하고 새로고침
        const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
        localStorage.removeItem(walletKey);
        
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } else {
      // 니모닉이 없는 경우 (개인키로 가져온 경우) 경고
      showToast && showToast('Cannot regenerate wallet without seed phrase', 'warning');
      showToast && showToast('Please create a new wallet or import with seed phrase', 'info');
      
      // 지갑 데이터 초기화
      const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
      localStorage.removeItem(walletKey);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
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

// ================================================================
// 전역 스코프에 함수 노출 (HTML onclick 이벤트용)
// ================================================================
window.navigateBack = navigateBack;
window.deleteWallet = deleteWallet;
window.showPrivateKey = showPrivateKey;
window.showRecoveryPhrase = showRecoveryPhrase;
window.closeModal = closeModal;
window.copyToClipboard = copyToClipboard;
window.showNetworkSelector = showNetworkSelector;
window.closeNetworkModal = closeNetworkModal;
window.selectNetwork = selectNetwork;

