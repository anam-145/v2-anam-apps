// ================================================================
// [BLOCKCHAIN] 템플릿 - Send 페이지 로직
// TODO: Bitcoin을 해당 블록체인으로 변경
// ================================================================

// 전역 변수
let adapter = null;
let currentWallet = null;

// ================================================================
// [필수 설정] Utils 임포트
// ================================================================
// TODO: BitcoinUtils를 해당 블록체인 Utils로 변경
// 예시:
// - Ethereum: const { showToast, formatBalance } = window.EthereumUtils || {};
// - Solana: const { showToast, formatBalance } = window.SolanaUtils || {};
const { showToast, formatBalance, validateAmount, validateAddress } = window.BitcoinUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Send page loaded");

  // 지갑 정보 로드
  loadWalletInfo();

  // 어댑터 초기화
  adapter = window.getAdapter();
  
  if (!adapter) {
    // TODO: 에러 메시지를 블록체인명으로 변경
    console.error("Adapter not initialized");
    showToast && showToast("Adapter initialization failed", "error");
  }

  // 테마 적용
  applyTheme();

  // UI 초기화
  updateUI();
  
  // 최소 금액 계산 및 표시
  await updateMinAmount();
  
  // 수수료 변경 시 최소 금액 재계산
  const feeSelect = document.getElementById("tx-fee");
  if (feeSelect) {
    feeSelect.addEventListener("change", updateMinAmount);
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

// ================================================================
// [필수 로직] 최소 금액 계산
// ================================================================
async function updateMinAmount() {
  try {
    if (!adapter) return;
    
    // TODO: 블록체인별 수수료 및 최소 금액 계산 로직 구현
    // 예시:
    // - Ethereum: 가스 가격 * 21000 (min gas)
    // - Solana: 5000 lamports (rent-exempt minimum)
    // - Cosmos: 수수료 + 최소 잔액
    // - Sui: 0.001 SUI (network minimum)
    
    const feeLevel = document.getElementById("tx-fee")?.value || "medium";
    const fees = await adapter.getGasPrice();
    const feeRate = fees[feeLevel] || 10; // 기본값
    
    // Bitcoin 예시: dust limit 계산
    const dustLimit = window.BitcoinUtils?.calculateDustLimit(feeRate) || 546;
    const minBTC = (dustLimit / 100000000).toFixed(8);
    
    // UI 업데이트
    const minAmountElement = document.getElementById('min-amount-hint');
    if (minAmountElement) {
      minAmountElement.textContent = `Minimum: ${minBTC} BTC`;
    }
    
    // input min 속성 업데이트
    const amountInput = document.getElementById('send-amount');
    if (amountInput) {
      amountInput.min = minBTC;
    }
    
    return dustLimit;
  } catch (error) {
    console.error("Failed to update minimum amount:", error);
    // 에러 시 기본값 표시
    const minAmountElement = document.getElementById('min-amount-hint');
    if (minAmountElement) {
      minAmountElement.textContent = `Minimum: 0.00000546 BTC`;
    }
    return 546;
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
  // 주소 검증 (BitcoinUtils 사용)
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
  const amountSatoshi = window.BitcoinUtils?.btcToSatoshi(amount) || Math.floor(amountValue * 100000000);
  const balanceSatoshi = parseInt(balance);
  
  if (amountSatoshi > balanceSatoshi) {
    console.log("Insufficient balance");
    showToast && showToast("Insufficient balance", "error");
    return;
  }

  try {
    // 수수료 가져오기
    const gasPrice = await adapter.getGasPrice();
    const feeRate = gasPrice[feeLevel] || 10;
    
    // 동적 dust limit 검증 (amountSatoshi는 이미 위에서 계산됨)
    const dustLimit = window.BitcoinUtils?.calculateDustLimit(feeRate) || 546;
    
    // 디버깅 로그
    console.log("Amount validation:", {
      inputAmount: amount,
      amountSatoshi: amountSatoshi,
      dustLimit: dustLimit,
      feeRate: feeRate,
      comparison: `${amountSatoshi} < ${dustLimit} = ${amountSatoshi < dustLimit}`
    });
    
    if (amountSatoshi < dustLimit) {
      const minBTC = (dustLimit / 100000000).toFixed(8);
      showToast && showToast(`Minimum amount is ${minBTC} BTC`, "error");
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

    // Bitcoin은 feeRate를 사용 (sat/vByte)
    if (feeLevel && feeRate) {
      txParams.feeRate = parseInt(feeRate);
    }

    const result = await adapter.sendTransaction(txParams);

    showToast && showToast("Transaction sent successfully!", "success");
    console.log("Transaction hash:", result.hash);

    // Pending 트랜잭션을 localStorage에 저장
    const pendingTx = {
      txid: result.hash,  // Bitcoin uses txid instead of hash
      from: currentWallet.address,
      to: recipient,
      amount: parseFloat(amount),  // BTC 단위로 저장
      timestamp: Math.floor(Date.now() / 1000),
      isPending: true,  // pending 플래그
      fee: txParams.feeRate || 0
    };

    // 기존 캐시 가져오기
    const cacheKey = `btc_tx_${currentWallet.address}`;
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
    localStorage.setItem('btc_has_pending_tx', 'true');
    localStorage.setItem('btc_pending_start_time', Date.now().toString());
    
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

