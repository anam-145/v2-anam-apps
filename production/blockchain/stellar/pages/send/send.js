// ================================================================
// Send Page Logic - Stellar
// ================================================================

// Global variables
let adapter = null;
let currentWallet = null;

// Utils functions
const { showToast, formatBalance, isValidAddress, isValidAmount, isValidMemo } = window.StellarUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", async function () {
  console.log("[Send] Page loaded");

  // Load wallet info
  loadWalletInfo();

  // Initialize Stellar adapter
  adapter = window.getAdapter();

  if (!adapter) {
    console.error("[Send] StellarAdapter not initialized");
    showToast && showToast("Stellar adapter initialization failed", "error");
  }

  // Apply theme
  applyTheme();

  // Initialize UI
  await updateUI();
});

// Load wallet information
function loadWalletInfo() {
  const walletData = WalletStorage.get();

  if (walletData) {
    currentWallet = walletData;
    console.log("[Send] Wallet loaded:", currentWallet.address);
  } else {
    console.log("[Send] No wallet found");
    showToast && showToast("No wallet found", "error");
    setTimeout(goBack, 1500);
  }
}

// Apply theme
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);
}

// Update UI
async function updateUI() {
  // Update coin symbol
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = CoinConfig.symbol;
  });

  // Update title
  document.title = `Send ${CoinConfig.name}`;

  // Update balance
  if (currentWallet && adapter) {
    try {
      const balance = await adapter.getBalance(currentWallet.address);
      const formattedBalance = formatBalance ?
        formatBalance(balance, CoinConfig.decimals) :
        parseFloat(balance).toFixed(7);
      document.getElementById('available-balance').textContent = formattedBalance;
    } catch (error) {
      console.error("[Send] Balance query failed:", error);
    }
  }
}

// Go back
function goBack() {
  // blockchain miniapp uses anamUI namespace
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo('pages/index/index');
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo('pages/index/index');
  } else {
    // Development environment: regular HTML page navigation
    window.location.href = '../index/index.html';
  }
}

// Confirm send
async function confirmSend() {
  console.log("[Send] confirmSend called");

  if (!currentWallet || !adapter) {
    console.log("[Send] No wallet or adapter:", { currentWallet, adapter });
    showToast && showToast("No wallet found", "error");
    return;
  }

  const recipient = document.getElementById("recipient-address").value.trim();
  const amount = document.getElementById("send-amount").value.trim();
  const memo = document.getElementById("memo-input").value.trim();

  console.log("[Send] Input values:", { recipient, amount, memo });

  // Validation
  if (!recipient || !amount) {
    console.log("[Send] Missing recipient or amount");
    showToast && showToast("Please enter recipient address and amount", "warning");
    return;
  }

  console.log("[Send] Validating address...");
  // Address validation
  if (isValidAddress) {
    if (!isValidAddress(recipient)) {
      console.log("[Send] Address validation failed");
      showToast && showToast("Invalid Stellar address format", "error");
      return;
    }
  } else if (adapter.isValidAddress) {
    if (!adapter.isValidAddress(recipient)) {
      showToast && showToast("Invalid address format", "error");
      return;
    }
  }

  console.log("[Send] Validating amount...");
  // Amount validation
  const amountValue = parseFloat(amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    console.log("[Send] Invalid amount value");
    showToast && showToast("Please enter a valid amount greater than 0", "warning");
    return;
  }

  // Minimum amount check (0.0000001 XLM)
  if (amountValue < 0.0000001) {
    showToast && showToast("Minimum amount is 0.0000001 XLM", "error");
    return;
  }

  // Memo validation
  if (memo && isValidMemo) {
    if (!isValidMemo(memo)) {
      showToast && showToast("Memo too long (max 28 characters)", "error");
      return;
    }
  }

  // Balance check
  try {
    const balance = await adapter.getBalance(currentWallet.address);
    const balanceValue = parseFloat(balance);

    if (amountValue > balanceValue) {
      console.log("[Send] Insufficient balance");
      showToast && showToast("Insufficient balance", "error");
      return;
    }

    showToast && showToast("Sending transaction...", "info");

    // Get private key securely
    const privateKey = await WalletStorage.getPrivateKeySecure();

    if (!privateKey) {
      throw new Error("Failed to access wallet private key");
    }

    // Send transaction
    const result = await adapter.sendTransaction(
      privateKey,
      recipient,
      amount,
      memo
    );

    showToast && showToast("Transaction sent successfully!", "success");
    console.log("[Send] Transaction hash:", result.hash);

    // Store pending transaction in localStorage
    const pendingTx = {
      hash: result.hash,
      from: currentWallet.address,
      to: recipient,
      amount: parseFloat(amount),
      memo: memo,
      timestamp: Math.floor(Date.now() / 1000),
      isPending: true,
      type: 'sent'
    };

    // Get existing cache
    const cacheKey = `xlm_tx_${currentWallet.address}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          // Add pending transaction at the beginning
          cacheData.data.unshift(pendingTx);
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("[Send] Pending transaction added to cache");
        }
      } catch (e) {
        console.log("[Send] Failed to update cache with pending tx:", e);
      }
    } else {
      // Create new cache
      const newCache = {
        data: [pendingTx],
        timestamp: Date.now(),
        ttl: 300000  // 5 minutes
      };
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      console.log("[Send] New cache created with pending transaction");
    }

    // Set pending transaction flag
    localStorage.setItem('xlm_has_pending_tx', 'true');
    localStorage.setItem('xlm_pending_start_time', Date.now().toString());

    // Return to main page
    setTimeout(() => {
      goBack();
    }, 2000);

  } catch (error) {
    console.error("[Send] Transaction failed:", error);
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
          errorMessage = 'Destination account does not exist (minimum 1 XLM required)';
        }
      }
    }

    showToast && showToast("Transaction failed: " + errorMessage, "error");
  }
}

// QR code scan function
function scanQRCode() {
  console.log("[Send] scanQRCode() called");

  // Check anamUI API (used in blockchain miniapp)
  if (window.anamUI && window.anamUI.scanQRCode) {
    console.log("[Send] Using anamUI.scanQRCode API");

    // Register QR scan result event listener
    window.addEventListener('qrScanned', handleQRScanned);

    // Call QR scanner - main process runs camera
    window.anamUI.scanQRCode(JSON.stringify({
      title: "Scan QR Code",
      description: "Scan recipient's wallet address QR code"
    }));

    console.log("[Send] QR scanner requested to main process");
  } else {
    console.error("[Send] anamUI.scanQRCode API not available");
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
  console.log("[Send] QR scan event received:", event);

  // Remove event listener (one-time)
  window.removeEventListener('qrScanned', handleQRScanned);

  if (event.detail && event.detail.success) {
    const qrData = event.detail.data;
    console.log("[Send] QR scan success:", qrData);

    // Check Stellar address format (G + 55 characters)
    if (qrData && qrData.match(/^G[A-Z2-7]{55}$/)) {
      // Enter address in field
      document.getElementById("recipient-address").value = qrData;
      showToast && showToast("Address imported successfully", "success");

      // Focus on amount input
      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    } else {
      console.error("[Send] Invalid Stellar address format:", qrData);
      showToast && showToast("Invalid address format", "error");
    }
  } else {
    const error = event.detail ? event.detail.error : "Unknown error";
    console.error("[Send] QR scan failed:", error);
    showToast && showToast("QR scan failed: " + error, "error");
  }
}

// Register global functions for HTML onclick
window.goBack = goBack;
window.confirmSend = confirmSend;
window.scanQRCode = scanQRCode;

console.log('[Send] Stellar send page loaded');
