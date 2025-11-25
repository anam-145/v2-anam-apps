// ================================================================
// Liberia Stellar - Receive Page
// deriveKey API 사용 - 니모닉 관리 불필요
// ================================================================

// Global variables
let currentWallet = null;
let adapter = null;

// Utils functions
const { showToast, copyToClipboard: copyToClipboardUtil } = window.StellarUtils || window.LiberiaUtils || {};

// ================================================================
// 초기화
// ================================================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("[LiberiaStellar] Receive page loaded");

  // Load wallet info
  loadWalletInfo();

  // Initialize Stellar adapter
  adapter = window.getAdapter();

  // Apply theme
  applyTheme();

  // Initialize UI
  updateUI();

  // Generate QR code
  if (currentWallet) {
    generateQRCodeForAddress();
  }
});

// ================================================================
// 지갑 정보 로드
// ================================================================

function loadWalletInfo() {
  const walletData = WalletStorage.get();

  if (walletData) {
    currentWallet = walletData;
    console.log("[LiberiaStellar] Wallet loaded:", currentWallet.address);
  } else {
    console.log("[LiberiaStellar] No wallet found");
    showToast && showToast("No wallet found", "error");
    setTimeout(goBack, 1500);
  }
}

// ================================================================
// 테마 적용
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  const config = window.CoinConfig;

  if (config && config.theme) {
    root.style.setProperty("--coin-primary", config.theme.primaryColor);
    root.style.setProperty("--coin-secondary", config.theme.secondaryColor);
  }
}

// ================================================================
// UI 업데이트
// ================================================================

function updateUI() {
  const config = window.CoinConfig;

  // Update coin symbol
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = config?.symbol || "XLM";
  });

  // Update coin name
  document.querySelectorAll('.coin-name').forEach(el => {
    el.textContent = config?.name || "Stellar";
  });

  // Update title
  document.title = `Receive ${config?.symbol || "XLM"}`;

  // Display address
  if (currentWallet) {
    const addressEl = document.getElementById('receive-address');
    if (addressEl) {
      addressEl.textContent = currentWallet.address;
    }
  }
}

// ================================================================
// QR 코드 생성
// ================================================================

function generateQRCodeForAddress() {
  if (!currentWallet) return;

  const qrContainer = document.getElementById('qr-code');
  if (!qrContainer) return;

  // Clear existing content
  qrContainer.innerHTML = '';

  // Check if QRCode library is available
  if (window.QRCode) {
    try {
      new window.QRCode(qrContainer, {
        text: currentWallet.address,
        width: 200,
        height: 200,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
      console.log("[LiberiaStellar] QR code generated");
    } catch (error) {
      console.log("[LiberiaStellar] QR code generation failed:", error);
      qrContainer.innerHTML = '<div style="padding: 20px; color: #999;">QR code generation failed</div>';
    }
  } else {
    console.log("[LiberiaStellar] QRCode library not available");
    qrContainer.innerHTML = '<div style="padding: 20px; color: #999;">QR code library not loaded</div>';
  }
}

// ================================================================
// 네비게이션
// ================================================================

function goBack() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo('pages/index/index');
  } else {
    window.location.href = '../index/index.html';
  }
}

// ================================================================
// 주소 복사
// ================================================================

async function copyAddress() {
  if (!currentWallet) return;

  if (copyToClipboardUtil) {
    const success = await copyToClipboardUtil(currentWallet.address);
    if (success) {
      showToast && showToast("Address copied to clipboard", "success");
    } else {
      showToast && showToast("Failed to copy", "error");
    }
  } else {
    // Fallback: direct copy
    try {
      await navigator.clipboard.writeText(currentWallet.address);
      showToast && showToast("Address copied to clipboard", "success");
    } catch (err) {
      console.log('[LiberiaStellar] Copy failed:', err);
      showToast && showToast("Failed to copy", "error");
    }
  }
}

// ================================================================
// 전역 함수 등록
// ================================================================

window.goBack = goBack;
window.copyAddress = copyAddress;

console.log('[LiberiaStellar] Receive page loaded');
