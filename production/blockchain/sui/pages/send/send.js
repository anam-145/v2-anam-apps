// ================================================================
// Sui Send 페이지 로직
// ================================================================

// 전역 변수
let adapter = null;
let currentWallet = null;

// ================================================================
// Utils 임포트
// ================================================================
const { showToast, formatBalance, validateAmount, validateAddress } = window.SuiUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Send page loaded");

  // 지갑 정보 로드
  loadWalletInfo();

  // 어댑터 초기화
  adapter = window.getAdapter();
  
  if (!adapter) {
    console.error("Sui adapter not initialized");
    showToast && showToast("Sui adapter initialization failed", "error");
  }

  // 테마 적용
  applyTheme();

  // UI 초기화
  updateUI();
  
  // Sui는 최소 금액 제한이 없으므로 힌트 숨기기
  const minAmountElement = document.getElementById('min-amount-hint');
  if (minAmountElement) {
    minAmountElement.style.display = 'none';
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
async function updateUI() {
  // 코인 심볼 업데이트
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = CoinConfig.symbol;
  });

  // 타이틀 업데이트
  document.title = `Send ${CoinConfig.name}`;

  // 잔액 업데이트
  const balanceElement = document.getElementById('available-balance');
  if (balanceElement) {
    // 초기값을 "-"로 설정
    balanceElement.textContent = '-';

    if (currentWallet && adapter) {
      try {
        const balance = await adapter.getBalance(currentWallet.address);
        const formattedBalance = formatBalance ?
          formatBalance(balance, CoinConfig.decimals) :
          (parseInt(balance) / 1000000000).toFixed(9);
        balanceElement.textContent = formattedBalance;
      } catch (error) {
        console.error("Balance query failed:", error);
        // 오류 발생 시에도 "-" 유지
        balanceElement.textContent = '-';
      }
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
// [필수 기능 3] 트랜잭션 전송 - UI에서 호출
// ================================================================
async function confirmSend() {
  console.log("confirmSend called");
  
  if (!currentWallet || !adapter) {
    console.log("No wallet or adapter:", { currentWallet, adapter });
    showToast && showToast("No wallet found", "error");
    return;
  }

  const recipient = document.getElementById("recipient-address").value.trim();
  const amount = document.getElementById("send-amount").value.trim();
  const feeLevel = document.getElementById("tx-fee").value;
  
  console.log("Input values:", { recipient, amount, feeLevel });

  // 유효성 검증
  if (!recipient || !amount) {
    console.log("Missing recipient or amount");
    showToast && showToast("Please enter recipient address and amount", "warning");
    return;
  }

  console.log("Validating address...");
  // 주소 검증 (SuiUtils 사용)
  if (validateAddress) {
    console.log("Using validateAddress function");
    const addressValidation = validateAddress(recipient);
    if (!addressValidation.valid) {
      console.log("Address validation failed:", addressValidation);
      showToast && showToast(addressValidation.error, "error");
      return;
    }
  } else if (adapter.isValidAddress) {
    console.log("Using adapter.isValidAddress");
    const isValid = adapter.isValidAddress(recipient);
    console.log("Address valid?", isValid);
    if (!isValid) {
      showToast && showToast("Invalid address format", "error");
      return;
    }
  }

  console.log("Validating amount...");
  // 금액 기본 검증
  const amountValue = parseFloat(amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    console.log("Invalid amount value");
    showToast && showToast("Please enter a valid amount greater than 0", "warning");
    return;
  }
  
  // 잔액 검증
  const balance = await adapter.getBalance(currentWallet.address);
  const amountMist = window.SuiUtils?.suiToMist(amount) || amount;
  const balanceMist = BigInt(balance);
  
  if (BigInt(amountMist) > balanceMist) {
    console.log("Insufficient balance");
    showToast && showToast("Insufficient balance", "error");
    return;
  }

  try {
    // Sui는 최소 금액 제한 없음 (Bitcoin의 dust limit과 다름)
    // 0보다 큰 모든 금액 전송 가능
    
    // 디버깅 로그
    console.log("Amount validation:", {
      inputAmount: amount,
      amountMist: amountMist,
      isValid: BigInt(amountMist) > 0n
    });
    
    if (BigInt(amountMist) <= 0n) {
      showToast && showToast(`Amount must be greater than 0`, "error");
      return;
    }
    
    showToast && showToast("Sending transaction...", "info");

    // 트랜잭션 전송
    // 민감한 데이터 접근을 위해 getPrivateKeySecure 사용
    const privateKey = await WalletStorage.getPrivateKeySecure();
    
    if (!privateKey) {
      throw new Error("Failed to access wallet private key");
    }
    
    const txParams = {
      from: currentWallet.address,
      to: recipient,
      amount: amount,
      privateKey: privateKey,
    };

    // Sui는 gasBudget 사용
    if (feeLevel) {
      const gasBudget = window.SuiUtils?.estimateGasBudget(feeLevel) || 200000;
      txParams.gasBudget = gasBudget;
    }

    const result = await adapter.sendTransaction(txParams);

    showToast && showToast("Transaction sent successfully!", "success");
    console.log("Transaction hash:", result.hash);

    // Pending 트랜잭션을 localStorage에 저장
    const pendingTx = {
      txid: result.digest || result.hash,  // index.js와 일치시키기 위해 txid 사용
      digest: result.digest || result.hash,  // Sui uses digest
      from: currentWallet.address,
      to: recipient,
      amount: parseFloat(amount),  // SUI 단위로 저장
      timestamp: Math.floor(Date.now() / 1000),
      isPending: true,  // pending 플래그
      gasBudget: txParams.gasBudget || 0
    };

    // 기존 캐시 가져오기
    const cacheKey = `sui_tx_${currentWallet.address}`;
    const cached = localStorage.getItem(cacheKey);
    
    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          // pending 트랜잭션을 맨 앞에 추가
          cacheData.data.unshift(pendingTx);
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("Pending transaction added to cache");
        }
      } catch (e) {
        console.log("Failed to update cache with pending tx:", e);
      }
    } else {
      // 캐시가 없으면 새로 생성
      const newCache = {
        data: [pendingTx],
        timestamp: Date.now(),
        ttl: 300000  // 5분
      };
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      console.log("New cache created with pending transaction");
    }

    // Pending 트랜잭션 플래그 설정
    localStorage.setItem('sui_has_pending_tx', 'true');
    localStorage.setItem('sui_pending_start_time', Date.now().toString());
    
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
    
    // Sui 주소 형식 확인 (0x로 시작하는 64자 hex)
    if (qrData && qrData.match(/^0x[a-fA-F0-9]{64}$/)) {
      // 주소 필드에 입력
      document.getElementById("recipient-address").value = qrData;
      showToast && showToast("Address imported successfully", "success");
      
      // 금액 입력란으로 포커스 이동
      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    } else {
      console.error("Invalid Sui address format:", qrData);
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

