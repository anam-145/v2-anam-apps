// ================================================================
// Send Page Logic - SECURE VERSION
// Uses on-demand private key derivation
// ================================================================

// Global variables
let adapter = null;
let currentWallet = null;
let hdManager = null;

// Utils functions
const { showToast, formatBalance, isValidAddress } = window.EthereumUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("Send page loaded (SECURE)");

  // Initialize HD Wallet Manager
  hdManager = window.getHDWalletManager();
  if (!hdManager) {
    console.error("HD Wallet Manager not initialized");
    showToast("Failed to initialize wallet manager");
  }

  // Load wallet info
  loadWalletInfo();

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
function loadWalletInfo() {
  // Try HD Wallet Manager first
  if (hdManager) {
    currentWallet = hdManager.getCurrentWallet();
    const currentAccount = hdManager.getCurrentAccount();

    if (currentWallet && currentAccount) {
      console.log("HD Wallet loaded:", {
        wallet: currentWallet.name,
        account: currentAccount.address,
        type: currentWallet.type
      });
      return;
    }
  }

  // Fallback to legacy WalletStorage
  currentWallet = WalletStorage.get();

  if (currentWallet) {
    console.log("Legacy wallet loaded:", currentWallet.address);
  } else {
    showToast("No wallet found");
    goBack();
  }
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
  if (adapter) {
    try {
      let address;

      if (hdManager && currentWallet) {
        const currentAccount = hdManager.getCurrentAccount();
        address = currentAccount ? currentAccount.address : currentWallet.address;
      } else if (currentWallet) {
        address = currentWallet.address;
      }

      if (address) {
        const balance = await adapter.getBalance(address);
        const formattedBalance = formatBalance ? formatBalance(balance) : balance;
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
  const feeLevel = document.getElementById("tx-fee").value;

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

    // Get fee
    const gasPrice = await adapter.getGasPrice();
    const fee = gasPrice[feeLevel];

    // ✅ SECURE: Get private key using appropriate method
    let senderAddress;

    if (hdManager && currentWallet) {
      const currentAccount = hdManager.getCurrentAccount();
      senderAddress = currentAccount.address;

      if (currentWallet.type === 'hd') {
        // ✅ SECURE: Derive private key on-demand (requires user authentication)
        console.log('[Send] 🔐 Deriving private key for transaction...');
        privateKey = await hdManager.derivePrivateKeyForAccount(
          currentWallet.id,
          currentAccount.index
        );
        console.log('[Send] ✅ Private key derived successfully');
      } else if (currentWallet.type === 'imported') {
        // ✅ SECURE: Decrypt private key on-demand for imported wallet
        console.log('[Send] 🔐 Decrypting private key for imported wallet...');
        privateKey = await hdManager.derivePrivateKeyForAccount(
          currentWallet.id,
          currentAccount.index
        );
        console.log('[Send] ✅ Private key decrypted successfully');
      }
    } else {
      // Legacy wallet - should not happen with new implementation
      console.warn('[Send] ⚠️ Legacy wallet detected - this should be migrated');
      showToast("Please reimport your wallet for better security");
      return;
    }

    if (!privateKey) {
      showToast("Failed to access wallet keys. Wallet may be locked.");
      return;
    }

    // Send transaction
    const txParams = {
      from: senderAddress,
      to: recipient,
      amount: amount,
      privateKey: privateKey,
    };

    // Ethereum-specific parameters
    if (feeLevel && fee) {
      txParams.gasPrice = fee; // Gwei
      txParams.gasLimit = 21000; // Default ETH transfer gas limit
    }

    const result = await adapter.sendTransaction(txParams);

    // ✅ SECURE: Clear private key from memory immediately using SecurityUtils
    console.log('[Send] 🧹 Clearing private key from memory...');
    if (window.SecurityUtils && window.SecurityUtils.clearString) {
      window.SecurityUtils.clearString(privateKey);
      window.SecurityUtils.clearString(txParams.privateKey);
    }
    privateKey = null;
    txParams.privateKey = null;

    showToast(`Transaction sent successfully!`);
    console.log("Transaction hash:", result.hash);

    // Store pending transaction in localStorage
    const pendingTx = {
      hash: result.hash,
      from: senderAddress.toLowerCase(),
      to: recipient.toLowerCase(),
      value: ethers.utils.parseEther(amount).toString(),
      timeStamp: Math.floor(Date.now() / 1000).toString(),
      isPending: true,
      gasUsed: "21000",
      gasPrice: txParams.gasPrice ? ethers.utils.parseUnits(txParams.gasPrice, 'gwei').toString() : "0"
    };

    // Get existing cache
    const cacheKey = `eth_tx_${senderAddress.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          // Add pending transaction at the beginning
          cacheData.data.unshift(pendingTx);
          localStorage.setItem(cacheKey, JSON.stringify(cacheData));
          console.log("Pending transaction added to cache");
        }
      } catch (e) {
        console.log("Failed to update cache with pending tx:", e);
      }
    } else {
      // Create new cache
      const newCache = {
        data: [pendingTx],
        timestamp: Date.now(),
        ttl: 300000  // 5 minutes
      };
      localStorage.setItem(cacheKey, JSON.stringify(newCache));
      console.log("New cache created with pending transaction");
    }

    // Set pending transaction flag
    localStorage.setItem('eth_has_pending_tx', 'true');
    localStorage.setItem('eth_pending_start_time', Date.now().toString());

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
