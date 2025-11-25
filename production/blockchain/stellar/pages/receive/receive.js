// ================================================================
// Receive Page Logic - Stellar
// ================================================================

// Global variables
let currentWallet = null;
let adapter = null;

// Utils functions - fundTestAccount와 showToast는 아래에서 사용
const { copyToClipboard: copyToClipboardUtil } = window.StellarUtils || {};

// Page initialization
document.addEventListener("DOMContentLoaded", function () {
  console.log("[Receive] Page loaded");

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

  // Show testnet funding button if on testnet
  checkAndShowTestnetButton();
});

// Load wallet information
function loadWalletInfo() {
  const walletData = WalletStorage.get();

  if (walletData) {
    currentWallet = walletData;
    console.log("[Receive] Wallet loaded:", currentWallet.address);
  } else {
    console.log("[Receive] No wallet found");
    window.StellarUtils?.showToast("No wallet found", "error");
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
function updateUI() {
  // Update coin symbol
  document.querySelectorAll('.coin-symbol').forEach(el => {
    el.textContent = CoinConfig.symbol;
  });

  // Update coin name
  document.querySelectorAll('.coin-name').forEach(el => {
    el.textContent = CoinConfig.name;
  });

  // Update title
  document.title = `Receive ${CoinConfig.name}`;

  // Display address
  if (currentWallet) {
    document.getElementById('receive-address').textContent = currentWallet.address;
  }
}

// Generate QR code
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
        width: 256,
        height: 256,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: window.QRCode.CorrectLevel.M
      });
      console.log("[Receive] QR code generated");
    } catch (error) {
      console.error("[Receive] QR code generation failed:", error);
      qrContainer.innerHTML = '<div style="padding: 20px; color: #999;">QR code generation failed</div>';
    }
  } else {
    console.error("[Receive] QRCode library not available");
    qrContainer.innerHTML = '<div style="padding: 20px; color: #999;">QR code library not loaded</div>';
  }
}

// Check and show testnet funding button
function checkAndShowTestnetButton() {
  const network = window.StellarConfig?.getCurrentNetwork();

  // Show button only on testnet or futurenet
  if (network && (network.id === 'testnet' || network.id === 'futurenet')) {
    const testnetSection = document.getElementById('testnet-section');
    if (testnetSection) {
      testnetSection.style.display = 'block';
    }
  }
}

// Fund test account
async function fundTestAccount() {
  if (!currentWallet) {
    window.StellarUtils?.showToast("No wallet found", "error");
    return;
  }

  // Check if we're on a testnet
  const network = window.StellarConfig?.getCurrentNetwork();
  if (!network || !network.friendbotUrl) {
    window.StellarUtils?.showToast("Funding only available on testnet/futurenet", "warning");
    return;
  }

  // Disable button during request
  const fundBtn = document.querySelector('.testnet-fund-btn');
  if (fundBtn) {
    fundBtn.disabled = true;
    fundBtn.textContent = 'Funding...';
  }

  try {
    // Use helper function if available
    if (window.StellarUtils && window.StellarUtils.fundTestAccount) {
      const success = await window.StellarUtils.fundTestAccount(currentWallet.address);

      // Check account after funding
      if (success && adapter) {
        // Clear transaction cache so index page fetches fresh data
        localStorage.removeItem('stellar_tx_cache');

        // Wait a bit for the transaction to be confirmed
        setTimeout(async () => {
          try {
            const balance = await adapter.getBalance(currentWallet.address, false);
            console.log("[Receive] Balance after funding:", balance);

            // Trigger balance update in index page if possible
            localStorage.setItem('xlm_balance_updated', Date.now().toString());
          } catch (error) {
            console.error("[Receive] Failed to check balance after funding:", error);
          }
        }, 2000);
      }
    } else {
      // Fallback: direct API call
      const response = await fetch(`${network.friendbotUrl}?addr=${encodeURIComponent(currentWallet.address)}`);

      if (response.ok) {
        window.StellarUtils?.showToast("Account funded successfully!", "success");

        // Clear transaction cache so index page fetches fresh data
        localStorage.removeItem('stellar_tx_cache');

        // Wait and check balance
        setTimeout(async () => {
          if (adapter) {
            const balance = await adapter.getBalance(currentWallet.address, false);
            console.log("[Receive] Balance after funding:", balance);
            localStorage.setItem('xlm_balance_updated', Date.now().toString());
          }
        }, 2000);
      } else {
        const text = await response.text();
        if (text.includes('already exist')) {
          window.StellarUtils?.showToast("Account already exists", "info");
        } else {
          window.StellarUtils?.showToast("Funding failed", "error");
        }
      }
    }
  } catch (error) {
    console.error("[Receive] Funding error:", error);
    window.StellarUtils?.showToast("Failed to fund account", "error");
  } finally {
    // Re-enable button
    if (fundBtn) {
      fundBtn.disabled = false;
      fundBtn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M10 2L3 7V11C3 14.55 5.84 17.74 10 18.5C14.16 17.74 17 14.55 17 11V7L10 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M10 10L10 13" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          <circle cx="10" cy="7" r="1" fill="currentColor"/>
        </svg>
        Fund Test Account (10,000 XLM)
      `;
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

// Copy address
async function copyAddress() {
  if (!currentWallet) return;

  if (copyToClipboardUtil) {
    const success = await copyToClipboardUtil(currentWallet.address);
    if (success) {
      window.StellarUtils?.showToast("Address copied to clipboard", "success");
    } else {
      window.StellarUtils?.showToast("Failed to copy", "error");
    }
  } else {
    // Fallback: direct copy
    try {
      await navigator.clipboard.writeText(currentWallet.address);
      window.StellarUtils?.showToast("Address copied to clipboard", "success");
    } catch (err) {
      console.error('[Receive] Copy failed:', err);
      window.StellarUtils?.showToast("Failed to copy", "error");
    }
  }
}

// Register global functions for HTML onclick
window.goBack = goBack;
window.copyAddress = copyAddress;
window.fundTestAccount = fundTestAccount;

console.log('[Receive] Stellar receive page loaded');
