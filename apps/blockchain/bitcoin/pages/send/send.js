// Send 페이지 로직

// 전역 변수
let adapter = null;
let currentWallet = null;

// Utils 함수 가져오기
const { showToast, formatBalance, validateAmount, validateAddress } = window.BitcoinUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log("Send page loaded");

  // 지갑 정보 로드
  loadWalletInfo();

  // Bitcoin 어댑터 초기화
  adapter = window.getAdapter();
  
  if (!adapter) {
    console.error("BitcoinAdapter not initialized");
    showToast && showToast("Bitcoin adapter initialization failed", "error");
  }

  // 테마 적용
  applyTheme();

  // UI 초기화
  updateUI();
});

// 지갑 정보 로드
function loadWalletInfo() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);

  if (walletData) {
    currentWallet = JSON.parse(walletData);
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
async function updateUI() {
  // 코인 심볼 업데이트
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = CoinConfig.symbol;
  });

  // 타이틀 업데이트
  document.title = `Send ${CoinConfig.name}`;

  // 잔액 업데이트
  if (currentWallet && adapter) {
    try {
      const balance = await adapter.getBalance(currentWallet.address);
      const formattedBalance = formatBalance ? 
        formatBalance(balance, CoinConfig.decimals) : 
        (parseInt(balance) / 100000000).toFixed(8);
      document.getElementById('available-balance').textContent = formattedBalance;
    } catch (error) {
      console.error("Balance query failed:", error);
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

// 전송 확인
async function confirmSend() {
  if (!currentWallet || !adapter) {
    showToast && showToast("No wallet found", "error");
    return;
  }

  const recipient = document.getElementById("recipient-address").value.trim();
  const amount = document.getElementById("send-amount").value.trim();
  const feeLevel = document.getElementById("tx-fee").value;

  // 유효성 검증
  if (!recipient || !amount) {
    showToast && showToast("Please enter recipient address and amount", "warning");
    return;
  }

  // 주소 검증 (BitcoinUtils 사용)
  if (validateAddress) {
    const addressValidation = validateAddress(recipient);
    if (!addressValidation.valid) {
      showToast && showToast(addressValidation.error, "error");
      return;
    }
  } else if (!adapter.isValidAddress(recipient)) {
    showToast && showToast("Invalid address format", "error");
    return;
  }

  // 금액 검증 (BitcoinUtils 사용)
  if (validateAmount) {
    const balance = await adapter.getBalance(currentWallet.address);
    const amountValidation = validateAmount(amount, balance);
    if (!amountValidation.valid) {
      showToast && showToast(amountValidation.error, "error");
      return;
    }
  } else if (parseFloat(amount) <= 0) {
    showToast && showToast("Please enter amount greater than 0", "warning");
    return;
  }

  try {
    showToast && showToast("Sending transaction...", "info");

    // 수수료 가져오기
    const gasPrice = await adapter.getGasPrice();
    const fee = gasPrice[feeLevel];

    // 트랜잭션 전송
    const txParams = {
      from: currentWallet.address,
      to: recipient,
      amount: amount,
      privateKey: currentWallet.privateKey,
    };

    // Bitcoin은 feeRate를 사용 (sat/vByte)
    if (feeLevel && fee) {
      txParams.feeRate = parseInt(fee);
    }

    const result = await adapter.sendTransaction(txParams);

    showToast && showToast("Transaction sent successfully!", "success");
    console.log("Transaction hash:", result.hash);

    // 메인 페이지로 돌아가기
    setTimeout(() => {
      goBack();
    }, 2000);

  } catch (error) {
    console.error("Transaction failed:", error);
    showToast && showToast("Transaction failed: " + error.message, "error");
  }
}

// QR 코드 스캔 함수
function scanQRCode() {
  console.log("scanQRCode() called from send page");
  
  // anamUI API 확인 (블록체인 미니앱에서 사용)
  if (window.anamUI && window.anamUI.scanQRCode) {
    console.log("Using anamUI.scanQRCode API");
    
    // QR 스캔 결과 이벤트 리스너 등록
    window.addEventListener('qrScanned', handleQRScanned);
    
    // QR 스캐너 호출 - 메인 프로세스에서 카메라 실행
    window.anamUI.scanQRCode(JSON.stringify({
      title: "Scan QR Code",
      description: "Scan recipient's wallet address QR code"
    }));
    
    console.log("QR scanner requested to main process");
  } else {
    console.error("anamUI.scanQRCode API not available");
    showToast && showToast("QR scan feature is not available", "warning");
    
    // 개발 환경에서 테스트용
    const testAddress = prompt("Enter address (development mode):");
    if (testAddress) {
      document.getElementById("recipient-address").value = testAddress;
    }
  }
}

// QR 스캔 결과 처리
function handleQRScanned(event) {
  console.log("QR scan event received:", event);
  
  // 이벤트 리스너 제거 (일회성)
  window.removeEventListener('qrScanned', handleQRScanned);
  
  if (event.detail && event.detail.success) {
    const qrData = event.detail.data;
    console.log("QR scan success:", qrData);
    
    // 비트코인 주소 형식 확인
    if (qrData && qrData.match(/^(1[a-km-zA-HJ-NP-Z1-9]{25,34}|3[a-km-zA-HJ-NP-Z1-9]{25,34}|bc1[a-z0-9]{39,59}|tb1[a-z0-9]{39,59})$/)) {
      // 주소 필드에 입력
      document.getElementById("recipient-address").value = qrData;
      showToast && showToast("Address imported successfully", "success");
      
      // 금액 입력란으로 포커스 이동
      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    } else {
      console.error("Invalid Bitcoin address format:", qrData);
      showToast && showToast("Invalid address format", "error");
    }
  } else {
    const error = event.detail ? event.detail.error : "Unknown error";
    console.error("QR scan failed:", error);
    showToast && showToast("QR scan failed: " + error, "error");
  }
}

// HTML onclick을 위한 전역 함수 등록
window.goBack = goBack;
window.confirmSend = confirmSend;
window.scanQRCode = scanQRCode;

