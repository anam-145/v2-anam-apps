// ================================================================
// Liberia Stellar - Send Page
// deriveKey API 사용 - 니모닉 관리 불필요
// ================================================================

// Global variables
let adapter = null;
let currentWallet = null;

// Utils functions
const { showToast, formatBalance, isValidAddress, isValidAmount, isValidMemo } = window.StellarUtils || window.LiberiaUtils || {};

// ================================================================
// 초기화
// ================================================================

document.addEventListener("DOMContentLoaded", async function () {
  console.log("[LiberiaStellar] Send page loaded");

  // Load wallet info
  await loadWalletInfo();

  // Initialize Stellar adapter
  adapter = window.getAdapter();

  if (!adapter) {
    console.log("[LiberiaStellar] Adapter not initialized");
    showToast && showToast("Stellar adapter initialization failed", "error");
  }

  // Apply theme
  applyTheme();

  // Initialize UI
  await updateUI();
});

// ================================================================
// 지갑 정보 로드
// ================================================================

async function loadWalletInfo() {
  // 주소만 저장된 단순 스토리지 사용
  currentWallet = WalletStorage.get();

  if (currentWallet) {
    console.log("[LiberiaStellar] Wallet loaded:", currentWallet.address);
    return;
  }

  // 저장된 주소가 없으면 deriveKey로 한번 파생해 저장
  adapter = adapter || window.getAdapter();
  if (!adapter || typeof adapter.getWallet !== "function") {
    showToast && showToast("Failed to initialize wallet", "error");
    goBack();
    return;
  }

  try {
    const derived = await adapter.getWallet();
    if (derived?.address) {
      currentWallet = { address: derived.address, createdAt: new Date().toISOString() };
      WalletStorage.save(currentWallet);
      console.log("[LiberiaStellar] Wallet derived and cached:", currentWallet.address);
    } else {
      showToast && showToast("Failed to load wallet", "error");
      goBack();
    }
  } catch (e) {
    console.log("[LiberiaStellar] Failed to derive wallet:", e);
    showToast && showToast("Failed to derive wallet", "error");
    goBack();
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

async function updateUI() {
  // Update coin symbol
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = window.CoinConfig?.symbol || "XLM";
  });

  // Update title
  document.title = `Send ${window.CoinConfig?.symbol || "XLM"}`;

  // Update balance
  if (currentWallet && adapter) {
    try {
      const balance = await adapter.getBalance(currentWallet.address);
      const formattedBalance = formatBalance ?
        formatBalance(balance, window.CoinConfig?.decimals || 7) :
        parseFloat(balance).toFixed(7);
      document.getElementById('available-balance').textContent = formattedBalance;
    } catch (error) {
      console.log("[LiberiaStellar] Balance query failed:", error);
    }
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
// 송금 확인 (deriveKey API 사용)
// ================================================================

async function confirmSend() {
  console.log("[LiberiaStellar] confirmSend called");

  if (!currentWallet || !adapter) {
    console.log("[LiberiaStellar] No wallet or adapter");
    showToast && showToast("No wallet found", "error");
    return;
  }

  const recipient = document.getElementById("recipient-address").value.trim();
  const amount = document.getElementById("send-amount").value.trim();
  const memo = document.getElementById("memo-input").value.trim();

  console.log("[LiberiaStellar] Input values:", { recipient, amount, memo });

  // Validation
  if (!recipient || !amount) {
    showToast && showToast("Please enter recipient address and amount", "warning");
    return;
  }

  // Address validation (G로 시작하는 56자)
  if (isValidAddress) {
    if (!isValidAddress(recipient)) {
      showToast && showToast("Invalid Stellar address format (must start with G)", "error");
      return;
    }
  } else if (!/^G[A-Z2-7]{55}$/.test(recipient)) {
    showToast && showToast("Invalid Stellar address format", "error");
    return;
  }

  // Amount validation
  const amountValue = parseFloat(amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    showToast && showToast("Please enter a valid amount greater than 0", "warning");
    return;
  }

  // Minimum amount check (0.0000001 XLM)
  if (amountValue < 0.0000001) {
    showToast && showToast("Minimum amount is 0.0000001 XLM", "error");
    return;
  }

  // Memo validation (max 28 bytes)
  if (memo && isValidMemo) {
    if (!isValidMemo(memo)) {
      showToast && showToast("Memo too long (max 28 characters)", "error");
      return;
    }
  }

  let privateKey = null;

  // Balance check
  try {
    const balance = await adapter.getBalance(currentWallet.address);
    const balanceValue = parseFloat(balance);

    if (balanceValue === 0) {
      showToast && showToast("Account not activated. Minimum 1 XLM required.", "error");
      return;
    }

    if (amountValue > balanceValue) {
      showToast && showToast("Insufficient balance", "error");
      return;
    }

    showToast && showToast("Sending transaction...", "info");

    // Get private key via deriveKey API (즉시 파생, 저장하지 않음)
    console.log("[LiberiaStellar] Getting private key via deriveKey API...");
    const derived = await adapter.getWallet();

    if (!derived || !derived.privateKey) {
      throw new Error("Failed to access wallet private key");
    }

    privateKey = derived.privateKey;  // S... 형식

    // Send transaction
    const result = await adapter.sendTransaction({
      from: currentWallet.address,
      to: recipient,
      amount: amount,
      privateKey: privateKey,
      memo: memo
    });

    // SECURE: Clear private key from memory immediately
    console.log('[LiberiaStellar] Clearing private key from memory...');
    if (window.SecurityUtils && window.SecurityUtils.clearString) {
      window.SecurityUtils.clearString(privateKey);
    }
    privateKey = null;

    showToast && showToast("Transaction sent successfully!", "success");
    console.log("[LiberiaStellar] Transaction hash:", result.hash);

    // Store pending transaction in localStorage
    const pendingTx = {
      hash: result.hash,
      from: currentWallet.address,
      to: recipient,
      amount: parseFloat(amount),
      memo: memo,
      timestamp: Date.now(),
      timeStamp: Math.floor(Date.now() / 1000),
      isPending: true,
      type: 'send'
    };

    // Update cache
    const cacheKey = window.LiberiaConfig?.CACHE?.TX_CACHE_KEY || `liberia_stellar_tx_cache`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.transactions && Array.isArray(cacheData.transactions)) {
          cacheData.transactions.unshift(pendingTx);
          cacheData.timestamp = Date.now();
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("[LiberiaStellar] Pending TX added to cache");
        }
      } catch (e) {
        console.log("[LiberiaStellar] Failed to update cache:", e);
      }
    }

    // Return to main page
    setTimeout(() => {
      goBack();
    }, 2000);

  } catch (error) {
    console.log("[LiberiaStellar] Transaction failed:", error);
    let errorMessage = error.message;

    // Parse Stellar specific errors
    if (error.response && error.response.data) {
      const extras = error.response.data.extras;
      if (extras && extras.result_codes) {
        const codes = extras.result_codes;
        if (codes.transaction === 'tx_insufficient_balance') {
          errorMessage = 'Insufficient balance for transaction and fees';
        } else if (codes.operations && codes.operations.includes('op_underfunded')) {
          errorMessage = 'Insufficient balance for this operation';
        } else if (codes.operations && codes.operations.includes('op_no_destination')) {
          errorMessage = 'Destination account does not exist (minimum 1 XLM required to create)';
        }
      }
    }

    showToast && showToast("Transaction failed: " + errorMessage, "error");

    // SECURE: Make sure to clear private key even on error
    if (privateKey) {
      console.log('[LiberiaStellar] Clearing private key from memory (error path)...');
      if (window.SecurityUtils && window.SecurityUtils.clearString) {
        window.SecurityUtils.clearString(privateKey);
      }
      privateKey = null;
    }
  }
}

// ================================================================
// QR 코드 스캔
// ================================================================

function scanQRCode() {
  console.log("[LiberiaStellar] scanQRCode() called");

  if (window.anamUI && window.anamUI.scanQRCode) {
    console.log("[LiberiaStellar] Using anamUI.scanQRCode API");

    window.addEventListener('qrScanned', handleQRScanned);

    window.anamUI.scanQRCode(JSON.stringify({
      title: "Scan QR Code",
      description: "Scan recipient's wallet address QR code"
    }));

    console.log("[LiberiaStellar] QR scanner requested");
  } else {
    console.log("[LiberiaStellar] anamUI.scanQRCode API not available");
    showToast && showToast("QR scan feature is not available", "warning");

    // Development environment test
    const testAddress = prompt("Enter address (development mode):");
    if (testAddress) {
      document.getElementById("recipient-address").value = testAddress;
    }
  }
}

// Handle QR scan result
function handleQRScanned(event) {
  console.log("[LiberiaStellar] QR scan event received:", event);

  window.removeEventListener('qrScanned', handleQRScanned);

  if (event.detail && event.detail.success) {
    const qrData = event.detail.data;
    console.log("[LiberiaStellar] QR scan success:", qrData);

    // Check Stellar address format (G + 55 characters)
    if (qrData && qrData.match(/^G[A-Z2-7]{55}$/)) {
      document.getElementById("recipient-address").value = qrData;
      showToast && showToast("Address imported successfully", "success");

      // Focus on amount input
      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    } else {
      console.log("[LiberiaStellar] Invalid Stellar address format:", qrData);
      showToast && showToast("Invalid Stellar address format", "error");
    }
  } else {
    const error = event.detail ? event.detail.error : "Unknown error";
    console.log("[LiberiaStellar] QR scan failed:", error);
    showToast && showToast("QR scan failed: " + error, "error");
  }
}

// ================================================================
// 전역 함수 등록
// ================================================================

window.goBack = goBack;
window.confirmSend = confirmSend;
window.scanQRCode = scanQRCode;

console.log('[LiberiaStellar] Send page loaded');
