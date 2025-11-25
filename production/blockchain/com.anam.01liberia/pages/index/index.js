// ================================================================
// Liberia Stellar Wallet - Main Page
// deriveKey API 사용 - 니모닉 관리 불필요
// ================================================================

let adapter = null;
let currentWallet = null;
let priceUSD = 0;

const { CACHE } = window.LiberiaConfig || {};
const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "liberia_stellar_tx_cache";
const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 1 * 60 * 1000;

const { showToast, formatBalance, shortenAddress, getTimeAgo } = window.StellarUtils || window.LiberiaUtils || {};

// ================================================================
// 초기화
// ================================================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("[LiberiaStellar] Page loaded");

  adapter = window.getAdapter();

  if (!adapter) {
    console.log("[LiberiaStellar] Adapter not initialized");
    showError("Failed to initialize adapter");
    return;
  }

  // 테마 적용
  applyTheme();

  // 지갑 초기화 시작
  initWallet();
});

// ================================================================
// 지갑 초기화 (deriveKey API 사용)
// ================================================================

async function initWallet() {
  showScreen("loading");

  try {
    // 1. 저장된 주소 확인
    const savedWallet = WalletStorage.get();

    if (savedWallet && savedWallet.address) {
      console.log("[LiberiaStellar] Using saved address:", savedWallet.address);
      currentWallet = savedWallet;
      await showMainScreen();
      return;
    }

    // 2. deriveKey API로 키 파생
    console.log("[LiberiaStellar] Deriving key from root mnemonic...");

    const derivedKey = await adapter.getWallet();

    if (!derivedKey || !derivedKey.address) {
      throw new Error("Failed to derive wallet");
    }

    // 3. 주소 저장 (privateKey는 저장하지 않음)
    currentWallet = {
      address: derivedKey.address,
      createdAt: new Date().toISOString()
    };

    WalletStorage.save(currentWallet);

    console.log("[LiberiaStellar] Wallet initialized:", currentWallet.address);

    await showMainScreen();

  } catch (error) {
    console.log("[LiberiaStellar] Init failed:", error);
    showError(error.message || "Failed to initialize wallet");
  }
}

// ================================================================
// 화면 관리
// ================================================================

function showScreen(screenId) {
  document.getElementById("wallet-loading").style.display = "none";
  document.getElementById("wallet-main").style.display = "none";
  document.getElementById("wallet-error").style.display = "none";

  const screen = document.getElementById(`wallet-${screenId}`);
  if (screen) {
    screen.style.display = screenId === "loading" ? "flex" : "block";
  }
}

function showError(message) {
  const errorEl = document.getElementById("error-message");
  if (errorEl) {
    errorEl.textContent = message;
  }
  showScreen("error");
}

async function showMainScreen() {
  showScreen("main");

  // UI 업데이트
  displayWalletInfo();
  updateNetworkLabel();

  // 비동기로 데이터 로드
  checkNetworkStatus();
  updateBalance();
  loadTransactionHistory();
  fetchPriceInfo();

  // 주기적 업데이트 (30초)
  setInterval(() => {
    if (currentWallet) {
      updateBalance();
      loadTransactionHistory(true);
    }
    checkNetworkStatus();
  }, 30000);
}

// ================================================================
// UI 함수들
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  const config = window.CoinConfig;

  if (config && config.theme) {
    root.style.setProperty("--coin-primary", config.theme.primaryColor);
    root.style.setProperty("--coin-secondary", config.theme.secondaryColor);

    document.querySelectorAll(".logo-text").forEach((el) => {
      el.textContent = config.theme.logoText;
    });

    document.querySelectorAll(".coin-unit").forEach((el) => {
      el.textContent = config.symbol;
    });

    document.title = `${config.name} Wallet`;
  }
}

function updateNetworkLabel() {
  const networkLabel = document.getElementById("network-label");
  if (networkLabel) {
    const currentNetwork = window.LiberiaConfig?.getCurrentNetwork();
    if (currentNetwork) {
      networkLabel.textContent = currentNetwork.displayName || currentNetwork.name || "Stellar Mainnet";
    }
  }
}

async function checkNetworkStatus() {
  try {
    const statusElement = document.getElementById("network-status");
    if (statusElement) {
      const isOnline = await window.StellarUtils?.checkNetworkStatus();
      statusElement.style.color = isOnline ? "#4cff4c" : "#ff4444";
    }
  } catch (error) {
    console.log("[LiberiaStellar] Network check failed:", error);
    const statusElement = document.getElementById("network-status");
    if (statusElement) {
      statusElement.style.color = "#ff4444";
    }
  }
}

function displayWalletInfo() {
  if (!currentWallet) return;

  const addressDisplay = document.getElementById("address-display");
  if (!addressDisplay) return;

  const address = currentWallet.address;

  // 주소 축약 표시
  const shortAddress = shortenAddress ? shortenAddress(address) : `${address.slice(0, 4)}...${address.slice(-4)}`;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address;

  // 클릭 시 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    try {
      await navigator.clipboard.writeText(address);
      if (showToast) showToast("Address copied!", "success");
    } catch (e) {
      console.log("[LiberiaStellar] Copy failed:", e);
    }
  };
}

async function updateBalance() {
  if (!currentWallet || !adapter) return;

  try {
    const balance = await adapter.getBalance(currentWallet.address);
    const formattedBalance = formatBalance ? formatBalance(balance) : parseFloat(balance).toFixed(2);

    const balanceEl = document.getElementById("xlm-balance-display");
    if (balanceEl) {
      balanceEl.textContent = formattedBalance;
    }

    // USD 가격 계산
    if (priceUSD > 0) {
      const usdValue = parseFloat(balance) * priceUSD;
      const balanceUsdEl = document.getElementById("balance-usd");
      if (balanceUsdEl) {
        balanceUsdEl.textContent = `≈ $${usdValue.toFixed(2)} USD`;
      }
    }

    // 계정 활성화 상태 확인
    updateActivationWarning(balance);
  } catch (error) {
    console.log("[LiberiaStellar] Balance error:", error);
    const balanceEl = document.getElementById("xlm-balance-display");
    if (balanceEl) {
      balanceEl.textContent = "0.00";
    }
    updateActivationWarning("0");
  }
}

// 계정 활성화 경고 표시/숨김
function updateActivationWarning(balance) {
  const warningEl = document.getElementById("activation-warning");
  if (!warningEl) return;

  const balanceNum = parseFloat(balance) || 0;

  // Stellar 계정은 최소 1 XLM이 있어야 활성화됨
  if (balanceNum === 0) {
    warningEl.style.display = "flex";
  } else {
    warningEl.style.display = "none";
  }
}

// 가격 정보 가져오기
async function fetchPriceInfo() {
  try {
    priceUSD = await window.StellarUtils?.fetchPriceData() || 0;
    if (priceUSD > 0 && currentWallet) {
      updateBalance();
    }
  } catch (error) {
    console.log("[LiberiaStellar] Price fetch failed:", error);
  }
}

// ================================================================
// 트랜잭션 히스토리
// ================================================================

async function loadTransactionHistory(skipCache = false) {
  if (!currentWallet || !adapter) return;

  const txList = document.getElementById("tx-list");
  if (!txList) return;

  try {
    // 캐시 확인
    if (!skipCache) {
      const cached = getTransactionCache();
      if (cached && cached.address === currentWallet.address && cached.transactions?.length > 0) {
        console.log("[LiberiaStellar] Using cached transactions");
        displayTransactions(cached.transactions);
        return;
      }
    }

    // 로딩 표시
    showTransactionLoading();

    // API 호출
    console.log("[LiberiaStellar] Fetching transactions from Horizon...");
    const transactions = await adapter.getTransactionHistory(currentWallet.address, 10);

    // 캐시 저장
    saveTransactionCache(currentWallet.address, transactions);

    // UI 업데이트
    displayTransactions(transactions);

  } catch (error) {
    console.log("[LiberiaStellar] TX history error:", error);
    showTransactionError("Failed to load transactions");
  }
}

function displayTransactions(transactions) {
  const txList = document.getElementById("tx-list");
  if (!txList) return;

  if (!transactions || transactions.length === 0) {
    showTransactionEmpty();
    return;
  }

  txList.innerHTML = "";

  transactions.forEach((tx) => {
    const txElement = createTransactionElement(tx);
    txList.appendChild(txElement);
  });
}

function createTransactionElement(tx) {
  const div = document.createElement("div");
  div.className = "tx-item";

  const isSent = tx.type === "send";
  const txType = isSent ? "send" : "receive";
  const amount = formatBalance ? formatBalance(tx.amount) : tx.amount;
  const address = shortenAddress ? shortenAddress(tx.address) : tx.address;
  const timeAgo = getTimeAgo ? getTimeAgo(tx.timestamp) : "";

  div.innerHTML = `
    <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
    <div class="tx-details">
      <div class="tx-type">${isSent ? "Sent" : "Received"}</div>
      <div class="tx-address">${isSent ? "To" : "From"}: ${address}</div>
    </div>
    <div class="tx-amount">
      <div class="tx-xlm ${txType}">${isSent ? "-" : "+"}${amount} XLM</div>
      <div class="tx-time">${timeAgo}</div>
    </div>
  `;

  // 클릭 시 Explorer로 이동
  if (tx.hash) {
    div.style.cursor = "pointer";
    div.onclick = () => {
      const explorerUrl = window.LiberiaConfig?.getExplorerUrl("tx", tx.hash);
      if (explorerUrl) {
        window.open(explorerUrl, "_blank");
      }
    };
  }

  return div;
}

function showTransactionLoading() {
  const txList = document.getElementById("tx-list");
  if (txList) {
    txList.innerHTML = `
      <div class="tx-loading">
        <div class="tx-loading-spinner"></div>
        <div class="tx-loading-text">Loading transactions...</div>
      </div>
    `;
  }
}

function showTransactionEmpty() {
  const txList = document.getElementById("tx-list");
  if (txList) {
    txList.innerHTML = `
      <div class="tx-empty">
        <div class="tx-empty-icon">📭</div>
        <div class="tx-empty-title">No transactions yet</div>
        <div class="tx-empty-text">
          Your transaction history will appear here<br>
          once you send or receive XLM
        </div>
      </div>
    `;
  }
}

function showTransactionError(message) {
  const txList = document.getElementById("tx-list");
  if (txList) {
    txList.innerHTML = `
      <div class="tx-error">
        <div class="tx-error-text">${message}</div>
        <button class="tx-retry-btn" onclick="loadTransactionHistory()">Retry</button>
      </div>
    `;
  }
}

// ================================================================
// 캐시 관리
// ================================================================

function getTransactionCache() {
  try {
    const cached = localStorage.getItem(TX_CACHE_KEY);
    if (!cached) return null;

    const cacheData = JSON.parse(cached);
    const now = Date.now();

    // TTL 확인
    if (cacheData.timestamp && (now - cacheData.timestamp) > TX_CACHE_TTL) {
      localStorage.removeItem(TX_CACHE_KEY);
      return null;
    }

    return cacheData;
  } catch (error) {
    return null;
  }
}

function saveTransactionCache(address, transactions) {
  const data = {
    address: address,
    transactions: transactions,
    timestamp: Date.now()
  };
  localStorage.setItem(TX_CACHE_KEY, JSON.stringify(data));
}

// ================================================================
// 네비게이션
// ================================================================

function navigateToSend() {
  if (!currentWallet) {
    if (showToast) showToast("No wallet found", "error");
    return;
  }

  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/send/send");
  } else {
    window.location.href = "../send/send.html";
  }
}

function navigateToReceive() {
  if (!currentWallet) {
    if (showToast) showToast("No wallet found", "error");
    return;
  }

  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/receive/receive");
  } else {
    window.location.href = "../receive/receive.html";
  }
}

function navigateToSettings() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/settings/settings");
  } else {
    window.location.href = "../settings/settings.html";
  }
}

// ================================================================
// 전역 함수 등록
// ================================================================

window.initWallet = initWallet;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.navigateToSettings = navigateToSettings;
window.loadTransactionHistory = loadTransactionHistory;

console.log("[LiberiaStellar] Index.js loaded");
