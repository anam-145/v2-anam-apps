// ================================================================
// Send Page Logic - SECURE VERSION
// Uses on-demand private key derivation
// ================================================================

// Global variables
let adapter = null;
let currentWallet = null;

// Utils functions
const { showToast, formatBalance, isValidAddress } = window.EthereumUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", async function () {
  console.log("Send page loaded (SECURE)");

  // Load wallet info
  await loadWalletInfo();

  // Initialize Ethereum adapter
  adapter = window.getAdapter();

  if (!adapter) {
    console.log("EthereumAdapter not initialized");
    showToast("Failed to initialize Ethereum adapter");
  }

  // Initialize UI
  updateUI();

  // Check URL parameters (address from QR code)
  checkUrlParameters();
});

// Load wallet information
async function loadWalletInfo() {
  // 주소만 저장된 단순 스토리지 사용
  currentWallet = WalletStorage.get();

  if (currentWallet) {
    console.log("Wallet loaded:", currentWallet.address);
    return;
  }

  // 저장된 주소가 없으면 deriveKey로 한번 파생해 저장
  adapter = adapter || window.getAdapter();
  if (!adapter || typeof adapter.getWallet !== "function") {
    showToast("Failed to initialize wallet");
    goBack();
    return;
  }

  try {
    const derived = await adapter.getWallet();
    if (derived?.address) {
      currentWallet = { address: derived.address, createdAt: new Date().toISOString() };
      WalletStorage.save(currentWallet);
      console.log("Wallet derived and cached:", currentWallet.address);
    } else {
      showToast("Failed to load wallet");
      goBack();
    }
  } catch (e) {
    console.error("Failed to derive wallet:", e);
    showToast("Failed to derive wallet");
    goBack();
  }
}

// Update UI
async function updateUI() {
  // Update coin symbol to USDC
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = "USDC";
  });

  // Update title
  document.title = "Send USDC";

  // Update USDC balance
  if (adapter) {
    try {
      const address = currentWallet?.address;

      if (address) {
        const usdcResult = await adapter.getTokenBalance(address, "USDC");
        const formattedBalance = formatBalance ? formatBalance(usdcResult.raw, usdcResult.decimals) : "0.00";
        document.getElementById('available-balance').textContent = formattedBalance;
      }
    } catch (error) {
      console.log("Failed to fetch balance:", error);
    }
  }
}

// Go back
function goBack() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo('pages/index/index');
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo('pages/index/index');
  } else {
    window.location.href = '../index/index.html';
  }
}

// ================================================================
// SECURE: Confirm Send with On-Demand Key Derivation
// ================================================================

async function confirmSend() {
  if (!currentWallet || !adapter) {
    showToast("No wallet found");
    return;
  }

  const recipient = document.getElementById("recipient-address").value.trim();
  const amount = document.getElementById("send-amount").value.trim();

  // Validation
  if (!recipient || !amount) {
    showToast("Please enter recipient address and amount");
    return;
  }

  if (!isValidAddress(recipient)) {
    showToast("Invalid address format");
    return;
  }

  if (parseFloat(amount) <= 0) {
    showToast("Please enter an amount greater than 0");
    return;
  }

  let privateKey = null;

  try {
    showToast("Sending transaction...");

    // ✅ SECURE: Get private key using appropriate method
    let senderAddress;

    // 파생된 키 즉시 사용 (저장하지 않음)
    const derived = await adapter.getWallet();
    senderAddress = derived.address;
    privateKey = derived.privateKey;

    if (!privateKey) {
      showToast("Failed to access wallet keys. Wallet may be locked.");
      return;
    }

    // Send USDC token transaction
    const txParams = {
      from: senderAddress,
      to: recipient,
      amount: amount,
      privateKey: privateKey,
      tokenSymbol: "USDC",
    };

    const result = await adapter.sendTokenTransaction(txParams);

    // ✅ SECURE: Clear private key from memory immediately using SecurityUtils
    console.log('[Send] 🧹 Clearing private key from memory...');
    if (window.SecurityUtils && window.SecurityUtils.clearString) {
      window.SecurityUtils.clearString(privateKey);
      window.SecurityUtils.clearString(txParams.privateKey);
    }
    privateKey = null;
    txParams.privateKey = null;

    showToast(`Transaction sent successfully!`);
    console.log("[Send] ✅ Transaction hash:", result.hash);

    // Store pending transaction in localStorage (USDC 토큰용)
    const tokenConfig = window.LiberiaConfig?.getTokenConfig("USDC");
    const decimals = tokenConfig?.decimals || 6;
    console.log("[Send] 💰 Token config:", { decimals });

    // USDC amount를 raw value로 변환 (6 decimals)
    const rawValue = ethers.utils.parseUnits(amount, decimals).toString();
    console.log("[Send] 💰 Raw value:", rawValue, "(from amount:", amount, ")");

    const pendingTx = {
      hash: result.hash,
      from: senderAddress.toLowerCase(),
      to: recipient.toLowerCase(),
      value: rawValue,
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      isPending: true,
      tokenSymbol: "USDC",
      tokenDecimal: decimals.toString()
    };
    console.log("[Send] 📦 Pending TX object:", pendingTx);

    // Get existing cache (USDC용 캐시 키)
    const cacheKey = `usdc_tx_${senderAddress.toLowerCase()}`;
    console.log("[Send] 🔑 Cache key:", cacheKey);

    const cached = localStorage.getItem(cacheKey);
    console.log("[Send] 📦 Existing cache:", cached);

    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        console.log("[Send] 📦 Parsed existing cache:", cacheData);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          // Add pending transaction at the beginning
          cacheData.data.unshift(pendingTx);
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("[Send] ✅ Pending TX added to existing cache, total:", cacheData.data.length);
        }
      } catch (e) {
        console.log("[Send] ❌ Failed to update cache:", e);
      }
    } else {
      // Create new cache
      const newCache = {
        data: [pendingTx],
        timestamp: Date.now(),
        ttl: 300000  // 5 minutes
      };
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      console.log("[Send] ✅ New cache created with pending TX:", newCache);
    }

    // Set pending transaction flag (USDC용)
    localStorage.setItem('usdc_has_pending_tx', 'true');
    localStorage.setItem('usdc_pending_start_time', Date.now().toString());
    console.log("[Send] 🚩 Pending flags set");

    // Return to main page
    setTimeout(() => {
      goBack();
    }, 2000);

  } catch (error) {
    console.error("Transaction failed:", error);
    showToast("Transaction failed: " + error.message);

    // ✅ SECURE: Make sure to clear private key even on error using SecurityUtils
    if (privateKey) {
      console.log('[Send] 🧹 Clearing private key from memory (error path)...');
      if (window.SecurityUtils && window.SecurityUtils.clearString) {
        window.SecurityUtils.clearString(privateKey);
      }
      privateKey = null;
    }
  }
}

// ================================================================
// URL Parameters & QR Code Functions
// ================================================================

function checkUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const address = urlParams.get('address');

  if (address) {
    console.log("Address from QR code:", address);

    const addressInput = document.getElementById('recipient-address');
    if (addressInput) {
      addressInput.value = address;
      console.log("Address auto-filled in recipient field");

      showToast("Address imported from QR code");

      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    }
  }
}

function scanQRCode() {
  console.log("scanQRCode() called from send page");

  if (window.anamUI && window.anamUI.scanQRCode) {
    console.log("Using anamUI.scanQRCode API");

    window.addEventListener('qrScanned', handleQRScanned);

    window.anamUI.scanQRCode(JSON.stringify({
      title: "Scan QR Code",
      description: "Scan recipient's wallet address QR code"
    }));

    console.log("QR scanner requested to main process");
  } else {
    console.log("anamUI.scanQRCode API not available");
    showToast("QR scan feature is not available");

    // Development environment
    const testAddress = prompt("Enter address (development mode):");
    if (testAddress) {
      document.getElementById("recipient-address").value = testAddress;
    }
  }
}

function handleQRScanned(event) {
  console.log("QR scan event received:", event);

  window.removeEventListener('qrScanned', handleQRScanned);

  if (event.detail && event.detail.success) {
    const qrData = event.detail.data;
    console.log("QR scan success:", qrData);

    if (qrData && qrData.match(/^0x[a-fA-F0-9]{40}$/)) {
      document.getElementById("recipient-address").value = qrData;
      showToast("Address imported successfully");

      const amountInput = document.getElementById('send-amount');
      if (amountInput) {
        amountInput.focus();
      }
    } else {
      console.log("Invalid Ethereum address format:", qrData);
      showToast("Invalid address format");
    }
  } else {
    const error = event.detail ? event.detail.error : "Unknown error";
    console.log("QR scan failed:", error);
    showToast("QR scan failed: " + error);
  }
}

// Register global functions for HTML onclick
window.goBack = goBack;
window.confirmSend = confirmSend;
window.scanQRCode = scanQRCode;

console.log('[Send] ✅ Secure send page loaded');
