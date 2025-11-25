// ================================================================
// Stellar Wallet Main Page
// ================================================================

// 전역 변수
let adapter = null;
let currentWallet = null;
let priceUSD = 0;

// 캐시 설정 (나중에 초기화)
let TX_CACHE_KEY = "stellar_tx_cache";
let TX_CACHE_TTL = 1 * 60 * 1000;

// DOM 로드 시 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log('[Stellar] Wallet page loaded');

  // 설정 초기화
  if (window.StellarConfig && window.StellarConfig.CACHE) {
    TX_CACHE_KEY = window.StellarConfig.CACHE.TX_CACHE_KEY || TX_CACHE_KEY;
    TX_CACHE_TTL = window.StellarConfig.CACHE.TX_CACHE_TTL || TX_CACHE_TTL;
  }

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // 어댑터 초기화
  adapter = window.getAdapter();

  if (!adapter) {
    console.log("StellarAdapter not initialized");
    window.StellarUtils?.showToast("Failed to initialize Stellar adapter", "error");
  }

  // 네트워크 변경 이벤트 리스너
  window.addEventListener('stellarNetworkChanged', handleNetworkChange);

  // 테마 적용
  applyTheme();

  // 지갑 상태 확인 (UI 먼저 표시)
  checkWalletStatus();

  // 네트워크 라벨 업데이트
  updateNetworkLabel();

  // 네트워크 상태는 비동기로 확인 (블로킹하지 않음)
  checkNetworkStatus();

  // 가격 정보 가져오기
  fetchPriceInfo();

  // 주기적으로 잔액 및 트랜잭션 업데이트 (30초마다)
  setInterval(() => {
    if (currentWallet) {
      updateBalance();
      loadTransactionHistory(true);
    }
    checkNetworkStatus();
  }, 30000);

  // Bridge Handler 초기화
  initBridgeHandler();

  // Keystore 복호화 완료 이벤트 리스너
  window.addEventListener('walletReady', function() {
    console.log('[Stellar] Wallet decrypted and ready');
    // 지갑 상태 다시 확인
    checkWalletStatus();
  });
});

// ================================================================
// 초기화 함수들
// ================================================================

// 어댑터 초기화
function initializeAdapter() {
  adapter = window.getAdapter();

  if (!adapter || !adapter.isInitialized) {
    console.error('[Stellar] Adapter not initialized');
    window.StellarUtils?.showToast('Wallet system not ready', 'error');
    return false;
  }

  return true;
}

// 테마 적용
function applyTheme() {
  const root = document.documentElement;
  const config = window.CoinConfig;

  if (config && config.theme) {
    root.style.setProperty("--coin-primary", config.theme.primaryColor);
    root.style.setProperty("--coin-secondary", config.theme.secondaryColor);

    // 로고 텍스트 업데이트
    document.querySelectorAll(".logo-text").forEach(el => {
      el.textContent = config.theme.logoText;
    });

    // 코인 단위 업데이트
    document.querySelectorAll(".coin-unit").forEach(el => {
      el.textContent = config.symbol;
    });

    // 페이지 타이틀
    document.title = `${config.name} Wallet`;
  }
}

// 네트워크 라벨 업데이트
function updateNetworkLabel() {
  const networkLabel = document.getElementById("network-label");
  if (networkLabel) {
    const currentNetwork = window.StellarConfig?.getCurrentNetwork();
    if (currentNetwork) {
      const displayText = currentNetwork.displayName || currentNetwork.name || 'Unknown';
      networkLabel.textContent = displayText;
    } else {
      networkLabel.textContent = 'Network Error';
    }
  }
}

// 네트워크 상태 확인
async function checkNetworkStatus() {
  try {
    const statusElement = document.getElementById("network-status");
    if (statusElement) {
      const isOnline = await window.StellarUtils?.checkNetworkStatus();
      statusElement.style.color = isOnline ? "#4cff4c" : "#ff4444";
    }
  } catch (error) {
    console.log("Network connection failed:", error);
    const statusElement = document.getElementById("network-status");
    if (statusElement) {
      statusElement.style.color = "#ff4444";
    }
  }
}

// 지갑 상태 확인
async function checkWalletStatus() {
  const walletData = WalletStorage.get();

  if (walletData) {
    // 지갑이 있으면 메인 화면 표시
    try {
      // Keystore가 있는 경우 복호화 필요 확인
      if (walletData.hasKeystore && !walletData.mnemonic) {
        console.log('[checkWalletStatus] Wallet needs decryption, getting secure...');
        const decryptedWallet = await WalletStorage.getSecure();
        if (decryptedWallet) {
          currentWallet = decryptedWallet;
        } else {
          console.log('[checkWalletStatus] Failed to decrypt wallet');
          currentWallet = walletData;
        }
      } else {
        currentWallet = walletData;
      }

      // Bridge Handler 초기화
      initBridgeHandler();

      document.getElementById("wallet-creation").style.display = "none";
      document.getElementById("wallet-main").style.display = "block";

      displayWalletInfo();

      // 트랜잭션 로딩 UI를 즉시 표시
      showTransactionLoading();

      // 잔액과 트랜잭션을 병렬로 로드 (속도 개선)
      try {
        await Promise.all([
          updateBalance(),
          loadTransactionHistory(true),
        ]);
      } catch (error) {
        console.log("Failed to load wallet data:", error);
      }

      // 백업 리마인더 체크
      if (window.mnemonicFlow) {
        window.mnemonicFlow.checkBackupReminder();
      }
    } catch (error) {
      console.log("Failed to load wallet:", error);
      window.StellarUtils?.showToast("Failed to load wallet", "error");
      resetWallet();
    }
  } else {
    // 지갑이 없으면 생성 화면 표시
    document.getElementById("wallet-creation").style.display = "block";
    document.getElementById("wallet-main").style.display = "none";
  }
}

// ================================================================
// 지갑 생성 및 Import
// ================================================================

// 새 지갑 생성 - Mnemonic Flow 시작
function createWallet() {
  if (!adapter) {
    window.StellarUtils?.showToast("StellarAdapter not initialized", "error");
    return;
  }

  try {
    console.log('[Stellar] Starting mnemonic flow');

    // Mnemonic Flow 시작
    if (window.mnemonicFlow) {
      window.mnemonicFlow.start();
    } else if (window.startMnemonicFlow) {
      window.startMnemonicFlow();
    } else {
      console.log("Mnemonic flow not initialized");
      window.StellarUtils?.showToast("Failed to initialize wallet creation flow", "error");
    }
  } catch (error) {
    console.log("Failed to start wallet creation:", error);
    window.StellarUtils?.showToast("Failed to start wallet creation: " + error.message, "error");
  }
}

// Mnemonic flow 완료 콜백
window.onMnemonicFlowComplete = async function(walletData) {
  console.log('[Stellar] Mnemonic flow completed, wallet created:', walletData.address);

  // 현재 지갑 설정
  currentWallet = walletData;

  // Bridge Handler 초기화
  initBridgeHandler();

  // 화면 전환
  document.getElementById("wallet-creation").style.display = "none";
  document.getElementById("wallet-main").style.display = "block";

  // 지갑 정보 표시
  displayWalletInfo();
  updateBalance();

  // 트랜잭션 로딩 표시 후 조회
  showTransactionLoading();
  setTimeout(() => {
    loadTransactionHistory(true);
  }, 100);
};

// Import 옵션 표시
function showImportOptions() {
  document.querySelector('.creation-content-metamask').style.display = 'none';
  document.getElementById('import-options').style.display = 'block';
}

// Import 옵션 숨기기
function hideImportOptions() {
  document.querySelector('.creation-content-metamask').style.display = 'flex';
  document.getElementById('import-options').style.display = 'none';
  document.getElementById('mnemonic-input').value = '';
}

// 니모닉에서 지갑 Import
async function importFromMnemonic() {
  if (!adapter) {
    window.StellarUtils?.showToast("StellarAdapter not initialized", "error");
    return;
  }

  const mnemonicInput = document.getElementById("mnemonic-input").value.trim();

  if (!mnemonicInput) {
    window.StellarUtils?.showToast("Please enter the mnemonic", "warning");
    return;
  }

  // 니모닉 단어 개수 확인
  const words = mnemonicInput.split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    window.StellarUtils?.showToast('Invalid recovery phrase (must be 12 or 24 words)', 'error');
    return;
  }

  try {
    window.StellarUtils?.showToast("Importing wallet...", "info");

    const wallet = await adapter.importFromMnemonic(mnemonicInput);

    // Keystore API로 안전하게 저장
    await WalletStorage.saveSecure(wallet);

    currentWallet = wallet;

    window.StellarUtils?.showToast("Wallet imported successfully!", "success");

    // 화면 전환
    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();

    // 트랜잭션 로딩 표시 후 조회
    showTransactionLoading();
    setTimeout(() => {
      loadTransactionHistory(true);
    }, 100);
  } catch (error) {
    console.error("Failed to import wallet:", error);

    if (error.message && error.message.includes("Invalid mnemonic")) {
      window.StellarUtils?.showToast("Invalid recovery phrase. Please check that all words are correct.", "error");
    } else {
      window.StellarUtils?.showToast("Failed to import wallet. Please check your recovery phrase.", "error");
    }
  }
}

// ================================================================
// 지갑 정보 표시
// ================================================================

// 지갑 정보 표시
function displayWalletInfo() {
  if (!currentWallet || !adapter) return;

  const address = currentWallet.address;
  const addressDisplay = document.getElementById("address-display");

  // 주소 축약 표시
  const shortAddress = window.StellarUtils?.shortenAddress(address) || address;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address; // 전체 주소는 툴팁으로

  // 클릭 시 전체 주소 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    const success = await window.StellarUtils?.copyToClipboard(address);
    if (success) {
      window.StellarUtils?.showToast("Address copied to clipboard", "success");
    }
  };
}

// 잔액 업데이트
async function updateBalance() {
  if (!currentWallet || !adapter) return;

  try {
    const balance = await adapter.getBalance(currentWallet.address);
    const formattedBalance = window.StellarUtils?.formatBalance(balance) || balance;

    document.getElementById("balance-display").textContent = formattedBalance;

    // USD 가격 계산
    if (priceUSD > 0) {
      const usdValue = parseFloat(balance) * priceUSD;
      const balanceUsdEl = document.getElementById("balance-usd");
      if (balanceUsdEl) {
        balanceUsdEl.textContent = `≈ $${usdValue.toFixed(2)} USD`;
      }
    }

    // 계정 활성화 상태 확인 및 경고 표시
    updateActivationWarning(balance);
  } catch (error) {
    console.log("Failed to fetch balance:", error);
    document.getElementById("balance-display").textContent = "0.00";
    // 잔액 조회 실패 시에도 경고 표시 (미활성화 가능성)
    updateActivationWarning("0");
  }
}

// 계정 활성화 경고 표시/숨김
function updateActivationWarning(balance) {
  const warningEl = document.getElementById("activation-warning");
  if (!warningEl) return;

  const balanceNum = parseFloat(balance) || 0;

  // Stellar 계정은 최소 1 XLM이 있어야 활성화됨
  // 잔액이 0이면 미활성화 상태
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
    console.error('[Stellar] Price fetch failed:', error);
  }
}

// ================================================================
// 트랜잭션 히스토리
// ================================================================

// 트랜잭션 히스토리 로드 (캐시 우선)
async function loadTransactionHistory(skipLoadingUI = false, forceRefresh = false) {
  if (!currentWallet || !adapter) return;

  if (!skipLoadingUI) {
    showTransactionLoading();
  }

  try {
    // 캐시 확인 (forceRefresh가 아니고, 캐시가 있고, 빈 배열이 아닐 때만)
    if (!forceRefresh) {
      const cached = getTransactionCache();
      if (cached &&
          cached.address &&
          currentWallet &&
          currentWallet.address &&
          cached.address === currentWallet.address &&
          cached.transactions &&
          cached.transactions.length > 0) {
        console.log("Using cached transactions for:", cached.address);
        displayTransactions(cached.transactions);
        return;
      }
    }

    // API 호출
    console.log("Fetching transactions from Horizon...");
    const transactions = await adapter.getTransactionHistory(currentWallet.address, 10);

    // 캐시 저장
    saveTransactionCache(currentWallet.address, transactions);

    // UI 업데이트
    displayTransactions(transactions);
  } catch (error) {
    console.error('[Stellar] Transaction history failed:', error);
    showTransactionError('Failed to load transactions');
  }
}

// 트랜잭션 표시
function displayTransactions(transactions) {
  const txList = document.getElementById("tx-list");
  if (!txList) return;

  if (!transactions || transactions.length === 0) {
    showTransactionEmpty();
    return;
  }

  txList.innerHTML = "";

  transactions.forEach(tx => {
    const txElement = createTransactionElement(tx);
    txList.appendChild(txElement);
  });
}

// 트랜잭션 요소 생성
function createTransactionElement(tx) {
  const div = document.createElement("div");
  div.className = "tx-item";

  const isSent = tx.type === 'send';
  const txType = isSent ? "send" : "receive";
  const amount = window.StellarUtils?.formatBalance(tx.amount) || tx.amount;
  const address = window.StellarUtils?.shortenAddress(tx.address) || tx.address;
  const timeAgo = window.StellarUtils?.getTimeAgo(tx.timestamp) || '';

  div.innerHTML = `
    <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
    <div class="tx-details">
      <div class="tx-type">${isSent ? 'Sent' : 'Received'}</div>
      <div class="tx-address">${isSent ? 'To' : 'From'}: ${address}</div>
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
      const explorerUrl = window.StellarConfig?.getExplorerUrl('tx', tx.hash);
      if (explorerUrl) {
        window.open(explorerUrl, "_blank");
      }
    };
  }

  return div;
}

// 로딩 상태 표시
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

// 빈 상태 표시
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

// 에러 상태 표시
function showTransactionError(message) {
  const txList = document.getElementById("tx-list");
  if (txList) {
    txList.innerHTML = `
      <div class="tx-error">
        <div class="tx-error-text">Failed to load transactions: ${message}</div>
        <button class="tx-retry-btn" onclick="loadTransactionHistory()">
          Retry
        </button>
      </div>
    `;
  }
}

// 캐시 관리
function getTransactionCache() {
  return CacheManager.get(TX_CACHE_KEY);
}

function saveTransactionCache(address, transactions) {
  const data = {
    address: address,
    transactions: transactions,
    timestamp: Date.now(),
  };
  CacheManager.set(TX_CACHE_KEY, data, TX_CACHE_TTL);
}

// ================================================================
// 네비게이션 함수들
// ================================================================

function navigateToSend() {
  if (!currentWallet) {
    window.StellarUtils?.showToast("No wallet found", "error");
    return;
  }
  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/send/send");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/send/send");
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = "../send/send.html";
  }
}

function navigateToReceive() {
  if (!currentWallet) {
    window.StellarUtils?.showToast("No wallet found", "error");
    return;
  }
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/receive/receive");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/receive/receive");
  } else {
    window.location.href = "../receive/receive.html";
  }
}

function navigateToSettings() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/settings/settings");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/settings/settings");
  } else {
    window.location.href = "../settings/settings.html";
  }
}

// ================================================================
// 지갑 초기화
// ================================================================

function resetWallet() {
  WalletStorage.clear();

  // 트랜잭션 캐시도 함께 삭제
  CacheManager.clear(TX_CACHE_KEY);

  currentWallet = null;

  // 화면 전환
  document.getElementById("wallet-main").style.display = "none";
  document.getElementById("wallet-creation").style.display = "block";

  // 입력 필드 초기화
  const mnemonicInput = document.getElementById("mnemonic-input");
  if (mnemonicInput) mnemonicInput.value = "";

  window.StellarUtils?.showToast("Wallet has been reset", "info");
}

// ================================================================
// 유틸리티 함수들
// ================================================================

// 계정 펀딩 (Testnet)
async function fundAccount() {
  if (!currentWallet) return;

  const success = await window.StellarUtils?.fundTestAccount(currentWallet.address);
  if (success) {
    setTimeout(() => {
      updateBalance();
      loadTransactionHistory();
    }, 3000);
  }
}

// 네트워크 변경 핸들러
function handleNetworkChange(event) {
  console.log('[Index] Network changed, refreshing page data');

  // 현재 네트워크 정보 업데이트
  const currentNetwork = window.StellarConfig?.getCurrentNetwork();
  if (currentNetwork) {
    console.log(`Switched to network: ${currentNetwork.name}`);
  }

  // 어댑터 재초기화 (네트워크 변경 시)
  if (adapter && adapter.switchNetwork) {
    adapter.switchNetwork(event.detail?.network || 'testnet');
  }

  // 네트워크 라벨 업데이트
  updateNetworkLabel();

  // 지갑이 있다면 잔액과 트랜잭션 다시 로드
  if (currentWallet && currentWallet.address) {
    // 캐시 클리어
    CacheManager.clear(TX_CACHE_KEY);
    updateBalance();
    loadTransactionHistory();
  }
}

// ================================================================
// Bridge Handler (Stellar는 기본 트랜잭션만 지원)
// ================================================================

function initBridgeHandler() {
  // Stellar은 DApp 브라우저 기능이 없음
  console.log("Stellar wallet initialized - basic transaction support only");
}

// ================================================================
// 전역 노출
// ================================================================

window.createWallet = createWallet;
window.importFromMnemonic = importFromMnemonic;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.navigateToSettings = navigateToSettings;
window.showImportOptions = showImportOptions;
window.hideImportOptions = hideImportOptions;
window.resetWallet = resetWallet;
window.loadTransactionHistory = loadTransactionHistory;
window.fundAccount = fundAccount;

console.log('[Stellar] Index page initialized');
