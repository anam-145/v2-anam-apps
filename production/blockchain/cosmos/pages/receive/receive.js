// ================================================================
// [BLOCKCHAIN] 템플릿 - Receive 페이지 로직
// TODO: Cosmos을 해당 블록체인으로 변경
// ================================================================

// 전역 변수
let currentWallet = null;

// ================================================================
// [필수 설정] Utils 임포트
// ================================================================
// TODO: CosmosUtils를 해당 블록체인 Utils로 변경
// 예시:
// - Ethereum: const { showToast, copyToClipboard, generateQRCode } = window.EthereumUtils || {};
// - Solana: const { showToast, copyToClipboard, generateQRCode } = window.SolanaUtils || {};
const { showToast, copyToClipboard, generateQRCode, shortenAddress } = window.CosmosUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log("Receive page loaded");

  // 지갑 정보 로드
  loadWalletInfo();

  // 테마 적용
  applyTheme();

  // UI 초기화
  updateUI();

  // QR 코드 생성
  if (currentWallet) {
    generateQRCodeForAddress();
  }
});

// 지갑 정보 로드
function loadWalletInfo() {
  const walletData = WalletStorage.get();

  if (walletData) {
    // WalletStorage.get()이 자동으로 네트워크 동기화함
    currentWallet = walletData;
    
    console.log("Wallet loaded:", currentWallet.address);
  } else {
    console.log("No wallet found");
    showToast && showToast("No wallet found", "error");
    setTimeout(goBack, 1500);
  }
}

// 테마 적용
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);
}

// UI 업데이트
function updateUI() {
  // 코인 심볼 업데이트
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = CoinConfig.symbol;
  });

  // 코인 이름 업데이트
  document.querySelectorAll('.coin-name').forEach(el => {
    el.textContent = CoinConfig.name;
  });

  // 타이틀 업데이트
  document.title = `Receive ${CoinConfig.name}`;

  // 주소 표시
  if (currentWallet) {
    document.getElementById('receive-address').textContent = currentWallet.address;
  }
}

// ================================================================
// [필수 기능 6] QR 코드 생성
// ================================================================
function generateQRCodeForAddress() {
  if (!currentWallet) return;
  
  // TODO: QR 코드 생성 로직
  // 모든 블록체인에서 QRCode.js 라이브러리를 공통으로 사용
  // 주소를 QR 코드로 변환하여 표시
  
  if (generateQRCode) {
    generateQRCode('qr-code', currentWallet.address);
  } else {
    console.error('QRCode generation function not available');
    const qrContainer = document.getElementById('qr-code');
    if (qrContainer) {
      qrContainer.innerHTML = '<div style="padding: 20px; color: #999;">QR code generation failed</div>';
    }
  }
}

// 뒤로 가기
function goBack() {
  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo('pages/index/index');
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo('pages/index/index');
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = '../index/index.html';
  }
}

// ================================================================
// [필수 기능 11] 주소 복사 - 클립보드
// ================================================================
async function copyAddress() {
  if (!currentWallet) return;
  
  // TODO: Utils 함수 변경
  if (copyToClipboard) {
    await copyToClipboard(currentWallet.address);
  } else {
    // 폴백: 직접 복사 시도
    try {
      await navigator.clipboard.writeText(currentWallet.address);
      showToast && showToast("Address copied to clipboard", "success");
    } catch (err) {
      console.error('Copy failed:', err);
      showToast && showToast("Failed to copy", "error");
    }
  }
}

// HTML onclick을 위한 전역 함수 등록
window.goBack = goBack;
window.copyAddress = copyAddress;

