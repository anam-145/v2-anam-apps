// ================================================================
// Liberia Wallet (Base Chain) - 메인 페이지
// deriveKey API 사용 - 니모닉 관리 불필요
// ================================================================

let adapter = null;
let currentWallet = null;

const { CACHE } = window.LiberiaConfig || {};
const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "liberia_tx_cache";
const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 5 * 60 * 1000;

const { showToast } = window.LiberiaUtils || window.EthereumUtils || {};

// ================================================================
// 초기화
// ================================================================

document.addEventListener("DOMContentLoaded", function () {
  console.log("[Liberia] Page loaded");

  adapter = window.getAdapter();

  if (!adapter) {
    console.log("[Liberia] Adapter not initialized");
    showError("Failed to initialize adapter");
    return;
  }

  // 네트워크 변경 이벤트
  window.addEventListener("providerUpdated", handleNetworkChange);

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
      console.log("[Liberia] Using saved address:", savedWallet.address);
      currentWallet = savedWallet;
      await showMainScreen();
      return;
    }

    // 2. deriveKey API로 키 파생
    console.log("[Liberia] Deriving key from root mnemonic...");

    const derivedKey = await adapter.getWallet();

    // 3. 주소 저장
    currentWallet = {
      address: derivedKey.address,
      createdAt: new Date().toISOString()
    };

    WalletStorage.save(currentWallet);

    console.log("[Liberia] Wallet initialized:", currentWallet.address);

    await showMainScreen();

  } catch (error) {
    console.error("[Liberia] Init failed:", error);
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
  document.getElementById("error-message").textContent = message;
  showScreen("error");
}

async function showMainScreen() {
  showScreen("main");

  // UI 업데이트
  displayWalletInfo();
  updateNetworkLabel();

  // 비동기로 잔액/트랜잭션 로드
  await checkNetworkStatus();
  updateBalance();
  loadTransactionHistory();

  // 주기적 업데이트 (30초)
  setInterval(() => {
    if (currentWallet) {
      updateBalance();
      loadTransactionHistory();
    }
    checkNetworkStatus();
  }, 30000);
}

// ================================================================
// UI 함수들
// ================================================================

function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);

  document.querySelectorAll(".logo-text").forEach((el) => {
    el.textContent = CoinConfig.theme.logoText;
  });

  // coin-unit은 HTML에서 직접 설정 (USDC, ETH 각각)
  document.title = `${CoinConfig.name} Wallet`;
}

function updateNetworkLabel() {
  const networkLabel = document.getElementById("network-label");
  if (networkLabel) {
    const currentNetwork = window.LiberiaConfig?.getCurrentNetwork();
    if (currentNetwork) {
      networkLabel.textContent = currentNetwork.name;
    }
  }
}

async function checkNetworkStatus() {
  const statusElement = document.getElementById("network-status");
  if (!statusElement) return;

  try {
    await adapter.initProvider();
    const blockNumber = await adapter.getBlockNumber();
    console.log("[Liberia] Current block:", blockNumber);
    statusElement.style.color = "#4cff4c";
  } catch (error) {
    console.log("[Liberia] Network check failed:", error.message);
    // RPC 실패해도 일단 노란색으로 (연결 시도 중)
    // 완전 실패는 빨간색
    if (adapter.provider) {
      statusElement.style.color = "#ffcc00"; // 노란색: 연결됨 but 응답 없음
    } else {
      statusElement.style.color = "#ff4444"; // 빨간색: 연결 실패
    }
  }
}

function displayWalletInfo() {
  if (!currentWallet) return;

  const addressDisplay = document.getElementById("address-display");
  const address = currentWallet.address;

  // 주소 축약 표시
  const shortAddress = `${address.slice(0, 6)}...${address.slice(-4)}`;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address;

  // 클릭 시 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    try {
      await navigator.clipboard.writeText(address);
      if (showToast) showToast("Address copied!");
    } catch (e) {
      console.log("Copy failed:", e);
    }
  };
}

async function updateBalance() {
  if (!currentWallet || !adapter) return;

  const { formatBalance } = window.EthereumUtils || {};

  try {
    // USDC 잔액 조회 (메인)
    const usdcResult = await adapter.getTokenBalance(currentWallet.address, "USDC");
    const usdcFormatted = formatBalance ? formatBalance(usdcResult.raw, usdcResult.decimals) : "0.00";
    document.getElementById("usdc-balance-display").textContent = usdcFormatted;

    // ETH 잔액 조회 (수수료용)
    const ethBalance = await adapter.getBalance(currentWallet.address);
    const ethFormatted = formatBalance ? formatBalance(ethBalance) : "0.0000";
    document.getElementById("eth-balance-display").textContent = ethFormatted;
  } catch (error) {
    console.log("[Liberia] Balance error:", error);
  }
}

// ================================================================
// 트랜잭션 히스토리
// ================================================================

async function loadTransactionHistory() {
  const txList = document.getElementById("tx-list");
  console.log("[History] 📋 Loading transaction history...");

  try {
    // USDC 토큰 트랜잭션 히스토리 조회
    console.log("[History] 🔍 Fetching token history for:", currentWallet.address);
    const transactions = await adapter.getTokenTransactionHistory(currentWallet.address, "USDC");
    console.log("[History] ✅ Fetched transactions:", transactions.length, transactions);

    // Pending 트랜잭션 캐시 확인
    const cacheKey = `usdc_tx_${currentWallet.address.toLowerCase()}`;
    const cached = localStorage.getItem(cacheKey);
    let pendingTxs = [];

    console.log("[Pending] 📦 Cache key:", cacheKey);
    console.log("[Pending] 📦 Cached data:", cached);

    if (cached) {
      try {
        const cacheData = JSON.parse(cached);
        console.log("[Pending] 📦 Parsed cache:", cacheData);
        if (cacheData.data && Array.isArray(cacheData.data)) {
          pendingTxs = cacheData.data.filter(tx => tx.isPending);
          console.log("[Pending] ⏳ Pending transactions found:", pendingTxs.length, pendingTxs);
        }
      } catch (e) {
        console.log("[Pending] ❌ Failed to read pending cache:", e);
      }
    } else {
      console.log("[Pending] 📭 No pending cache found");
    }

    // Pending 트랜잭션 중 이미 확인된 것은 제거
    const confirmedHashes = new Set(transactions.map(tx => tx.hash.toLowerCase()));
    console.log("[Pending] 🔗 Confirmed hashes:", [...confirmedHashes]);

    const beforeFilter = pendingTxs.length;
    pendingTxs = pendingTxs.filter(tx => !confirmedHashes.has(tx.hash.toLowerCase()));
    console.log("[Pending] 🧹 Filtered pending:", beforeFilter, "->", pendingTxs.length);

    // 캐시 업데이트 (확인된 pending 제거)
    if (cached && pendingTxs.length === 0) {
      console.log("[Pending] 🗑️ Clearing pending cache (all confirmed)");
      localStorage.removeItem(cacheKey);
      localStorage.removeItem('usdc_has_pending_tx');
      localStorage.removeItem('usdc_pending_start_time');
    }

    // Pending + 확인된 트랜잭션 합치기
    const allTransactions = [...pendingTxs, ...transactions];
    console.log("[History] 📊 Total transactions (pending + confirmed):", allTransactions.length);

    if (!allTransactions || allTransactions.length === 0) {
      console.log("[History] 📭 No transactions to display");
      showTransactionEmpty();
      return;
    }

    txList.innerHTML = "";

    allTransactions.slice(0, 10).forEach((tx, index) => {
      const isSent = tx.from.toLowerCase() === currentWallet.address.toLowerCase();
      console.log(`[History] 📝 TX ${index}:`, {
        hash: tx.hash?.slice(0, 10),
        from: tx.from?.slice(0, 10),
        to: tx.to?.slice(0, 10),
        value: tx.value,
        isPending: tx.isPending,
        isSent
      });
      const txElement = createTransactionElement(tx, isSent);
      txList.appendChild(txElement);
    });

    console.log("[History] ✅ History loaded successfully");

  } catch (error) {
    console.log("[History] ❌ TX history error:", error);
    showTransactionEmpty();
  }
}

function createTransactionElement(tx, isSent) {
  const div = document.createElement("div");
  div.className = "tx-item" + (tx.isPending ? " tx-pending" : "");

  const txType = isSent ? "send" : "receive";
  const txLabel = tx.isPending ? (isSent ? "Sending..." : "Receiving...") : (isSent ? "Sent" : "Received");

  // 토큰 트랜잭션: tokenDecimal 사용 (USDC는 6 decimals)
  const { formatBalance } = window.EthereumUtils || {};
  const decimals = parseInt(tx.tokenDecimal) || 6;
  const formattedAmount = formatBalance ? formatBalance(tx.value || "0", decimals) : "0.00";
  const tokenSymbol = tx.tokenSymbol || "USDC";

  const timeAgo = tx.isPending ? "Pending" : getTimeAgo(tx.timeStamp);

  div.innerHTML = `
    <div class="tx-icon ${txType}">${tx.isPending ? "⏳" : (isSent ? "↑" : "↓")}</div>
    <div class="tx-details">
      <div class="tx-type">${txLabel}</div>
      <div class="tx-address">${tx.hash.slice(0, 10)}...</div>
    </div>
    <div class="tx-amount">
      <div class="tx-eth ${txType}">${isSent ? "-" : "+"}${formattedAmount} ${tokenSymbol}</div>
      <div class="tx-time">${timeAgo}</div>
    </div>
  `;

  // 클릭 시 explorer로 이동
  div.style.cursor = "pointer";
  div.onclick = () => {
    const explorerUrl = window.LiberiaConfig?.explorerUrl || "https://basescan.org";
    window.open(`${explorerUrl}/tx/${tx.hash}`, "_blank");
  };

  return div;
}

function showTransactionEmpty() {
  const txList = document.getElementById("tx-list");
  txList.innerHTML = `
    <div class="tx-empty">
      <div class="tx-empty-icon">📭</div>
      <div class="tx-empty-title">No transactions yet</div>
      <div class="tx-empty-text">
        Your transaction history will appear here<br>
        once you send or receive USDC
      </div>
    </div>
  `;
}

function getTimeAgo(timestamp) {
  const now = Date.now() / 1000;
  const diff = now - parseInt(timestamp);

  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ================================================================
// 네비게이션
// ================================================================

function navigateToSend() {
  if (!currentWallet) {
    if (showToast) showToast("No wallet found");
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
    if (showToast) showToast("No wallet found");
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
// 네트워크 변경 핸들러
// ================================================================

function handleNetworkChange() {
  console.log("[Liberia] Network changed");
  updateNetworkLabel();

  if (currentWallet) {
    updateBalance();
    loadTransactionHistory();
  }
}

// 전역 함수 등록
window.initWallet = initWallet;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.navigateToSettings = navigateToSettings;

console.log("[Liberia] Index.js loaded");
