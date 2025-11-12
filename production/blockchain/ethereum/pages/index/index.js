// Ethereum 지갑 메인 페이지 로직

// 전역 변수
let adapter = null; // 코인 어댑터 인스턴스
let currentWallet = null; // 현재 지갑 정보
let hdManager = null; // HD Wallet Manager 인스턴스
let pollTimer = null; // 폴링 타이머
let currentPollingInterval = null; // 현재 폴링 간격

// 폴링 설정
const POLLING_CONFIG = {
  PENDING: 15000,      // 15초 - Pending 있을 때
  NORMAL: 30000,       // 30초 - 기존 유지
  MAX_PENDING_TIME: 300000  // 5분 - 최대 pending 체크 시간
};

// 설정은 EthereumConfig에서 가져옴 (utils/config.js)
const { CACHE, getCurrentNetwork, getEtherscanApiUrl } =
  window.EthereumConfig || {};
const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "eth_tx_cache";
const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 5 * 60 * 1000;

// Utils 함수 가져오기
const { showToast } = window.EthereumUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // Ethereum 어댑터 초기화
  adapter = window.getAdapter();

  if (!adapter) {
    console.log("EthereumAdapter not initialized");
    showToast("Failed to initialize Ethereum adapter");
  }

  // HD Wallet Manager 초기화
  if (window.getHDWalletManager) {
    hdManager = window.getHDWalletManager();
    console.log("HD Wallet Manager initialized");
    
    // 기존 지갑 마이그레이션 체크
    migrateToHDWallet();
  }

  // walletReady 이벤트 리스너 등록 (Keystore 복호화 완료 시)
  window.addEventListener("walletReady", function() {
    console.log("[Index] Wallet decryption completed");
    // 복호화된 지갑 데이터로 재초기화
    currentWallet = getCurrentWalletInfo();
    if (currentWallet) {
      updateBalance();
      loadTransactionHistory();
    }
  });

  // 네트워크 변경 이벤트 리스너
  window.addEventListener("providerUpdated", handleNetworkChange);

  // 지갑 변경 이벤트 리스너 (설정에서 지갑 삭제 시)
  window.addEventListener("walletChanged", function(event) {
    console.log("[Index] Wallet changed event received");
    // Reload wallet data and update UI
    currentWallet = getCurrentWalletInfo();
    if (currentWallet) {
      displayWalletInfo();
      updateBalance();
      loadTransactionHistory();
      updateWalletDropdown();
    }
  });

  // UI 테마 적용
  applyTheme();

  // 지갑 존재 여부 확인 (UI 먼저 표시)
  checkWalletStatus();

  // 네트워크 라벨 업데이트
  updateNetworkLabel();

  // 네트워크 상태는 비동기로 확인 (블로킹하지 않음)
  checkNetworkStatus();

  // 동적 폴링 설정
  setupDynamicPolling();
  
  // Send에서 돌아왔을 때 즉시 업데이트 (pending TX가 있을 수 있음)
  if (localStorage.getItem('eth_has_pending_tx') === 'true') {
    console.log('Pending transaction detected, updating immediately');
    updateBalance();
    loadTransactionHistory();
  }

  // 트랜잭션 요청 이벤트 리스너 등록 (기존 방식 지원)
  window.addEventListener("transactionRequest", handleTransactionRequest);
  window.handleTransactionRequest = handleTransactionRequest; // Bridge Handler에서 사용

  // Bridge Handler 초기화 (지갑이 없어도 Handler는 초기화)
  initBridgeHandler();
});

// 기존 지갑 마이그레이션
function migrateToHDWallet() {
  if (!hdManager) return;
  
  // HD Manager에 지갑이 없고, 기존 지갑이 있으면 마이그레이션
  if (hdManager.wallets.size === 0) {
    const legacyWallet = WalletStorage.get();
    if (legacyWallet && legacyWallet.address) {
      console.log("Migrating legacy wallet to HD system");
      hdManager.migrateFromLegacyWallet(legacyWallet);
      showToast("Wallet migrated to new HD system");
    }
  }
}

// 현재 지갑 정보 가져오기
function getCurrentWalletInfo() {
  if (hdManager) {
    const account = hdManager.getCurrentAccount();
    if (account) {
      const wallet = hdManager.getCurrentWallet();
      return {
        address: account.address,
        privateKey: account.privateKey,
        mnemonic: wallet?.mnemonic,
        accountName: account.name,
        walletName: wallet?.name,
        walletId: wallet?.id,
        walletType: wallet?.type,
        isHDWallet: wallet?.type === 'hd',
        hasKeystore: true,
        createdAt: wallet?.createdAt || new Date().toISOString()
      };
    }
  }
  
  // HD Manager가 없으면 기존 방식
  return currentWallet;
}

// 지갑 정보 업데이트
function updateWalletInfo(wallet) {
  currentWallet = wallet;
}

// 테마 적용
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);

  // 텍스트 변경
  document.querySelectorAll(".logo-text").forEach((el) => {
    el.textContent = CoinConfig.theme.logoText;
  });

  document.querySelectorAll(".coin-unit").forEach((el) => {
    el.textContent = CoinConfig.symbol;
  });

  // 타이틀 변경
  document.title = `${CoinConfig.name} Wallet`;
}

// 네트워크 라벨 업데이트
function updateNetworkLabel() {
  const networkLabel = document.getElementById('network-label');
  if (networkLabel) {
    const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
    if (currentNetwork) {
      networkLabel.textContent = currentNetwork.name;
    }
  }
}

// 동적 폴링 설정
function setupDynamicPolling() {
  // Pending TX 체크
  const hasPending = localStorage.getItem('eth_has_pending_tx') === 'true';
  const interval = hasPending ? POLLING_CONFIG.PENDING : POLLING_CONFIG.NORMAL;
  
  // 이미 같은 간격으로 실행 중이면 변경 안 함
  if (currentPollingInterval === interval) return;
  
  // 기존 타이머 정리
  if (pollTimer) {
    clearInterval(pollTimer);
  }
  
  // 새 타이머 설정
  pollTimer = setInterval(() => {
    if (currentWallet || getCurrentWalletInfo()) {
      updateBalance();
      loadTransactionHistory();
      checkPendingComplete(); // Pending 완료 체크
    }
  }, interval);
  
  currentPollingInterval = interval;
  console.log(`Polling mode: ${hasPending ? 'FAST (15s)' : 'NORMAL (30s)'}`);
}

// Pending 트랜잭션 완료 확인
async function checkPendingComplete() {
  const hasPending = localStorage.getItem('eth_has_pending_tx') === 'true';
  if (!hasPending) return;
  
  const walletInfo = currentWallet || getCurrentWalletInfo();
  if (!walletInfo) return;
  
  // 캐시에서 pending TX 확인
  const cacheKey = `eth_tx_${walletInfo.address.toLowerCase()}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const data = JSON.parse(cached);
      const stillPending = data.data?.some(tx => tx.isPending);
      
      if (!stillPending) {
        // Pending 완료 → Normal 모드로
        console.log('All pending transactions confirmed, switching to normal mode');
        localStorage.removeItem('eth_has_pending_tx');
        localStorage.removeItem('eth_pending_start_time');
        setupDynamicPolling(); // 재설정 (30초로)
      }
    } catch (e) {
      console.log('Error checking pending status:', e);
    }
  }
  
  // 5분 타임아웃 (안전장치)
  const pendingStart = localStorage.getItem('eth_pending_start_time');
  if (pendingStart && Date.now() - parseInt(pendingStart) > POLLING_CONFIG.MAX_PENDING_TIME) {
    console.log('Pending timeout reached, switching to normal mode');
    localStorage.removeItem('eth_has_pending_tx');
    localStorage.removeItem('eth_pending_start_time');
    setupDynamicPolling();
  }
}

// 네트워크 상태 확인
async function checkNetworkStatus() {
  try {
    // Ethereum 네트워크 상태 확인
    await adapter.initProvider();
    const blockNumber = await adapter.getBlockNumber();
    console.log("Current block number:", blockNumber);
    document.getElementById("network-status").style.color = "#4cff4c";
  } catch (error) {
    console.log("Network connection failed:", error);
    document.getElementById("network-status").style.color = "#ff4444";
  }
}

// 지갑 상태 확인
async function checkWalletStatus() {
  // WalletStorage 초기화
  WalletStorage.init();
  
  // HD Manager 우선 체크
  if (hdManager) {
    const hdWallet = hdManager.getCurrentWallet();
    if (hdWallet) {
      currentWallet = getCurrentWalletInfo();
    } else {
      // HD에 지갑이 없으면 기존 방식 체크
      currentWallet = WalletStorage.get();
      
      // 기존 지갑이 있으면 마이그레이션
      if (currentWallet) {
        migrateToHDWallet();
        currentWallet = getCurrentWalletInfo();
      }
    }
  } else {
    // HD Manager가 없으면 기존 방식
    currentWallet = WalletStorage.get();
  }

  if (currentWallet) {
    // 지갑이 있으면 메인 화면 표시
    try {
      console.log("[checkWalletStatus] Wallet loaded:", currentWallet.address);

      // Bridge Handler 초기화
      initBridgeHandler();

      document.getElementById("wallet-creation").style.display = "none";
      document.getElementById("wallet-main").style.display = "block";
      console.log("[checkWalletStatus] Switched to main screen");

      displayWalletInfo();

      // HDWalletManager에 지갑이 있으면 드롭다운 설정 (현재 지갑이 HD가 아니어도)
      const hdManager = window.getHDWalletManager ? window.getHDWalletManager() : null;
      if (hdManager && hdManager.getAllWallets().length > 0) {
        setupWalletDropdown();
      }

      // 트랜잭션 로딩 UI를 즉시 표시
      showTransactionLoading();

      // 잔액과 트랜잭션을 병렬로 로드 (속도 개선)
      try {
        await Promise.all([
          updateBalance(),
          loadTransactionHistory(true), // skipLoadingUI = true (이미 표시했으므로)
        ]);
      } catch (error) {
        console.log("Failed to load wallet data:", error);
      }

      // 백업 리마인더 체크 (니모닉 플로우에서 스킵한 경우)
      if (window.mnemonicFlow) {
        window.mnemonicFlow.checkBackupReminder();
      }
    } catch (error) {
      console.log("Failed to load wallet:", error);
      showToast("Failed to load wallet");
      resetWallet();
    }
  } else {
    // 지갑이 없으면 생성 화면 표시
    console.log("[checkWalletStatus] No wallet found, showing creation screen");
    document.getElementById("wallet-creation").style.display = "block";
    document.getElementById("wallet-main").style.display = "none";
  }
}

// 새 지갑 생성
async function createWallet() {
  if (!adapter) {
    showToast("Adapter not initialized");
    return;
  }

  try {
    console.log("Starting wallet creation");
    
    if (hdManager) {
      // HD Wallet 생성
      const walletInfo = await hdManager.createNewWallet();
      currentWallet = getCurrentWalletInfo();

      // Show mnemonic backup
      const mnemonic = walletInfo.accounts[0].mnemonic || walletInfo.mnemonic;
      showMnemonicBackup(mnemonic);

      // UI 전환
      document.getElementById("wallet-creation").style.display = "none";
      document.getElementById("wallet-main").style.display = "block";

      displayWalletInfo();
      setupWalletDropdown();
      updateBalance();
      loadTransactionHistory();

    } else {
      // Fallback: No HD Manager available
      console.log("HD Manager not initialized");
      showToast("Failed to initialize wallet creation");
    }
  } catch (error) {
    console.log("Failed to create wallet:", error);
    showToast("Failed to create wallet: " + error.message);
  }
}

// 니모닉으로 지갑 가져오기
async function importFromMnemonic() {
  if (!adapter) {
    showToast("Adapter not initialized");
    return;
  }

  const mnemonicInput = document.getElementById("mnemonic-input").value.trim();
  
  if (!mnemonicInput) {
    showToast("Please enter the mnemonic");
    return;
  }

  try {
    showToast("Importing wallet...");
    
    if (hdManager) {
      // HD Manager로 import
      const discoveryChoice = confirm(
        "Do you want to discover all used accounts?\n" +
        "OK = Discover all accounts\n" +
        "Cancel = Import first account only"
      );
      
      let result;
      if (discoveryChoice) {
        showToast("Discovering used accounts...");
        result = await hdManager.importWalletWithDiscovery(mnemonicInput);
        showToast(`Discovered ${result.accounts?.length || 1} account(s)`);
      } else {
        result = await hdManager.importWalletFromMnemonic(mnemonicInput);
        showToast("Wallet imported successfully!");
      }
      
      currentWallet = getCurrentWalletInfo();
      
    } else {
      // 기존 방식
      const wallet = await adapter.importFromMnemonic(mnemonicInput);
      await WalletStorage.saveSecure(
        mnemonicInput,
        wallet.address,
        wallet.privateKey
      );
      
      currentWallet = {
        address: wallet.address,
        privateKey: wallet.privateKey,
        mnemonic: mnemonicInput,
        createdAt: new Date().toISOString(),
      };
      updateWalletInfo(currentWallet);
      showToast("Wallet imported successfully!");
    }
    
    // UI 업데이트
    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";
    
    displayWalletInfo();
    if (hdManager) setupWalletDropdown();
    updateBalance();
    
    // 트랜잭션 로딩 표시 후 조회
    showTransactionLoading();
    setTimeout(() => {
      loadTransactionHistory(true);
    }, 100);
    
  } catch (error) {
    console.log("Failed to import wallet:", error);
    showToast("Failed to import: " + error.message);
  }
}

// HD Wallet 드롭다운 설정
function setupWalletDropdown() {
  if (!hdManager) return;
  
  const dropdownBtn = document.getElementById('wallet-dropdown-btn');
  const dropdown = document.getElementById('wallet-dropdown');
  const walletList = document.getElementById('wallet-list');
  
  if (!dropdownBtn || !dropdown || !walletList) return;
  
  // 드롭다운 버튼 표시
  dropdownBtn.style.display = 'inline-flex';
  
  // 드롭다운 토글
  dropdownBtn.onclick = () => {
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  };
  
  // 클릭 외부 영역 클릭시 닫기
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.address-container')) {
      dropdown.style.display = 'none';
    }
  });
  
  // 드롭다운 컨텐츠 업데이트
  updateWalletDropdown();
  
  // Add wallet 버튼 이벤트
  const addWalletBtn = document.getElementById('add-wallet-btn');
  if (addWalletBtn) {
    addWalletBtn.onclick = navigateToAddWallet;
  }
}

// 드롭다운 컨텐츠 업데이트
function updateWalletDropdown() {
  if (!hdManager) return;
  
  const walletList = document.getElementById('wallet-list');
  if (!walletList) return;
  
  const currentWalletId = hdManager.currentWalletId;
  const wallets = hdManager.getAllWallets();
  
  let html = '';
  
  for (const wallet of wallets) {
    const isActive = wallet.id === currentWalletId;
    
    html += `
      <li class="wallet-item ${isActive ? 'active' : ''}">
        <div class="wallet-header">
          <span class="wallet-name">${wallet.name}</span>
          <span class="account-count"> - ${wallet.accountCount} account(s)</span>
        </div>
    `;
    
    // 현재 지갑의 계정들 표시
    if (isActive) {
      const accounts = hdManager.getWalletAccounts(wallet.id);
      html += '<ul class="account-list">';
      
      for (const account of accounts) {
        html += `
          <li class="account-item ${account.isActive ? 'active' : ''}" 
              onclick="switchToAccount('${wallet.id}', ${account.index})">
            <span class="account-name">${account.name}</span>
            <span class="account-address">${window.EthereumUtils.shortenAddress(account.address)}</span>
          </li>
        `;
      }
      
      // HD 지갑이면 "Add Account" 버튼 추가
      if (wallet.type === 'hd') {
        html += `
          <li class="add-account-item" onclick="addNewAccount('${wallet.id}', event)">
            <span>+ Add Account</span>
          </li>
        `;
      }
      
      html += '</ul>';
    } else {
      // 다른 지갑 클릭시 전환
      html += `
        <div class="wallet-switch" onclick="switchToWallet('${wallet.id}')">
          Switch to this wallet →
        </div>
      `;
    }
    
    html += '</li>';
  }
  
  walletList.innerHTML = html;
}

// 계정 전환
async function switchToAccount(walletId, accountIndex) {
  if (!hdManager) return;
  
  try {
    hdManager.switchAccount(walletId, accountIndex);
    currentWallet = getCurrentWalletInfo();
    
    // UI 업데이트
    displayWalletInfo();
    updateBalance();
    loadTransactionHistory();
    updateWalletDropdown();
    
    // 드롭다운 닫기
    document.getElementById('wallet-dropdown').style.display = 'none';
    
    showToast("Switched account");
  } catch (error) {
    showToast("Failed to switch account: " + error.message);
  }
}

// 지갑 전환
async function switchToWallet(walletId) {
  if (!hdManager) return;
  
  try {
    hdManager.switchWallet(walletId);
    currentWallet = getCurrentWalletInfo();
    
    // UI 업데이트
    displayWalletInfo();
    updateBalance();
    loadTransactionHistory();
    updateWalletDropdown();
    
    // 드롭다운 닫기
    document.getElementById('wallet-dropdown').style.display = 'none';
    
    showToast("Switched wallet");
  } catch (error) {
    showToast("Failed to switch wallet: " + error.message);
  }
}

// 새 계정 추가
async function addNewAccount(walletId, event) {
  if (!hdManager) return;

  // Get the clicked element
  const clickedElement = event?.target?.closest('.add-account-item');

  // Check if already disabled
  if (clickedElement && clickedElement.dataset.disabled === 'true') {
    console.log("Account addition already in progress");
    return;
  }

  const wallet = hdManager.wallets.get(walletId);
  if (!wallet || wallet.type !== 'hd') {
    showToast("Cannot add account to this wallet type");
    return;
  }

  try {
    // Disable the clicked button
    if (clickedElement) {
      clickedElement.dataset.disabled = 'true';
      clickedElement.style.pointerEvents = 'none';
      clickedElement.style.opacity = '0.5';
      clickedElement.innerHTML = '<span>Adding account...</span>';
    }

    showToast("Adding new account...");
    const newAccount = await hdManager.addAccountToWallet(walletId);

    currentWallet = getCurrentWalletInfo();

    // UI 업데이트
    displayWalletInfo();
    updateBalance();
    updateWalletDropdown(); // 이 시점에서 버튼이 새로 그려짐

    showToast(`Added ${newAccount.name}`);
  } catch (error) {
    showToast("Failed to add account: " + error.message);

    // Re-enable on error
    if (clickedElement) {
      delete clickedElement.dataset.disabled;
      clickedElement.style.pointerEvents = 'auto';
      clickedElement.style.opacity = '1';
      clickedElement.innerHTML = '<span>+ Add Account</span>';
    }
  }
}

// 지갑 정보 표시
function displayWalletInfo() {
  const walletInfo = currentWallet || getCurrentWalletInfo();
  if (!walletInfo || !adapter) return;

  const address = walletInfo.address;
  const addressDisplay = document.getElementById("address-display");

  // HD 지갑 정보 표시
  if (walletInfo.isHDWallet && walletInfo.walletName) {
    const walletLabel = document.createElement('div');
    walletLabel.className = 'wallet-label';
    walletLabel.textContent = `${walletInfo.walletName} - ${walletInfo.accountName}`;
    
    // 기존 라벨 제거하고 새로 추가
    const existingLabel = document.querySelector('.wallet-label');
    if (existingLabel) existingLabel.remove();
    
    const addressContainer = document.querySelector('.address-container');
    if (addressContainer) {
      addressContainer.insertBefore(walletLabel, addressContainer.firstChild);
    }
  }

  // 주소 축약 표시
  const shortAddress = window.EthereumUtils?.shortenAddress(address) || address;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address; // 전체 주소는 툴팁으로

  // 클릭 시 전체 주소 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    const success = await window.EthereumUtils?.copyToClipboard(address);
    if (success) {
      showToast("Address copied to clipboard");
    }
  };
}

// 잔액 업데이트
async function updateBalance() {
  const walletInfo = currentWallet || getCurrentWalletInfo();
  if (!walletInfo || !adapter) return;

  try {
    const balance = await adapter.getBalance(walletInfo.address);

    // 디버깅 로그 추가
    console.log("Wallet address:", walletInfo.address);
    console.log("Raw balance from adapter:", balance);
    console.log("Type of balance:", typeof balance);

    const formattedBalance =
      window.EthereumUtils?.formatBalance(balance) || balance;

    console.log("Formatted balance:", formattedBalance);

    document.getElementById("balance-display").textContent = formattedBalance;
  } catch (error) {
    console.log("Failed to fetch balance:", error);
  }
}

// ================================================================
// 트랜잭션 히스토리 관리
// ================================================================

// 트랜잭션 히스토리 로드 (캐시 우선)
async function loadTransactionHistory(skipLoadingUI = false) {
  // 로딩 상태 표시 (이미 표시 중이면 스킵)
  if (!skipLoadingUI) {
    showTransactionLoading();
  }

  const walletInfo = currentWallet || getCurrentWalletInfo();
  if (!walletInfo) return;

  try {
    // Pending TX가 있으면 캐시를 무시하고 API 호출
    const hasPending = localStorage.getItem('eth_has_pending_tx') === 'true';
    
    if (hasPending) {
      console.log('Pending transaction exists, forcing API call');
      // API 직접 호출하여 최신 데이터 가져오기
      const transactions = await fetchTransactionHistory(walletInfo.address);
      saveTransactionCache(walletInfo.address, transactions);
      displayTransactions(transactions);
      return;
    }
    
    // Pending이 없을 때는 기존 캐시 로직 사용
    const cached = getTransactionCache();
    if (
      cached &&
      cached.address &&
      walletInfo &&
      walletInfo.address &&
      cached.address.toLowerCase() === walletInfo.address.toLowerCase()
    ) {
      console.log("Loading transactions from cache");
      displayTransactions(cached.transactions);
      
      // 캐시가 오래되면 백그라운드에서 업데이트
      const isCacheOld = Date.now() - cached.timestamp > 60000; // 1분
      if (isCacheOld) {
        console.log('Cache is old, fetching new data in background');
        fetchTransactionHistory(walletInfo.address)
          .then(transactions => {
            saveTransactionCache(walletInfo.address, transactions);
            displayTransactions(transactions);
          })
          .catch(error => {
            console.log("Background fetch failed:", error);
          });
      }
    } else {
      // 캐시 없음 - API 호출
      console.log("No cache, fetching from API");
      const transactions = await fetchTransactionHistory(walletInfo.address);
      saveTransactionCache(walletInfo.address, transactions);
      displayTransactions(transactions);
    }
  } catch (error) {
    console.log("Failed to load transactions:", error);
    showTransactionError("Unable to load transactions");
  }
}

// Etherscan API에서 트랜잭션 조회
async function fetchTransactionHistory(address) {
  try {
    const apiUrl = getEtherscanApiUrl("account", "txlist", {
      address: address,
      startblock: 0,
      endblock: 99999999,
      sort: "desc",
    });

    const response = await fetch(apiUrl);
    const data = await response.json();

    if (data.status === "1") {
      console.log(`Fetched ${data.result.length} transactions`);
      return data.result.slice(0, 20); // 최근 20개만
    } else {
      console.log("No transactions found");
      return [];
    }
  } catch (error) {
    console.log("API call failed:", error);
    throw error;
  }
}

// 트랜잭션 표시
function displayTransactions(transactions) {
  const txList = document.getElementById("tx-list");
  const walletInfo = currentWallet || getCurrentWalletInfo();
  
  if (!walletInfo) return;

  if (!transactions || transactions.length === 0) {
    txList.innerHTML = `
      <div class="tx-empty">
        <div class="tx-empty-icon">📭</div>
        <div class="tx-empty-text">No transactions yet</div>
      </div>
    `;
    return;
  }

  // Pending TX 추적용
  let hasPendingTx = false;

  const html = transactions
    .map((tx) => {
      // tx.to가 null이거나 빈 문자열이면 컨트랙트 생성 트랜잭션
      const isContractCreation = !tx.to || tx.to === "" || tx.to === "0x";
      const isPending = !tx.blockNumber || tx.blockNumber === null;
      const isSent =
        tx.from &&
        walletInfo.address &&
        tx.from.toLowerCase() === walletInfo.address.toLowerCase();

      const txType = isPending
        ? "pending"
        : tx.txreceipt_status === "0"
        ? "failed"
        : isSent
        ? "sent"
        : "received";

      const icon = getTransactionIcon(txType, isContractCreation);
      const amount = window.EthereumUtils?.formatBalance(tx.value) || "0";
      const displayAddress = isContractCreation
        ? "Contract Creation"
        : isSent
        ? tx.to
        : tx.from;
      const shortAddress = isContractCreation
        ? "New Contract"
        : window.EthereumUtils?.shortenAddress(displayAddress) ||
          displayAddress;

      const status = isPending
        ? "Pending..."
        : tx.txreceipt_status === "0"
        ? "Failed"
        : "";

      const time = isPending
        ? "Processing..."
        : window.EthereumUtils?.formatTimestamp(tx.timeStamp) || "";

      // Pending 트랜잭션이 있으면 표시
      if (isPending) {
        hasPendingTx = true;
        tx.isPending = true; // 캐시 저장 시 사용
      }

      return `
        <div class="tx-item ${txType}" onclick="openTransaction('${tx.hash}')">
          <div class="tx-icon">${icon}</div>
          <div class="tx-details">
            <div class="tx-main">
              <span class="tx-address">${
                isSent ? "To: " : isContractCreation ? "" : "From: "
              }${shortAddress}</span>
              ${status ? `<span class="tx-status ${txType}">${status}</span>` : ""}
            </div>
            <div class="tx-time">${time}</div>
          </div>
          <div class="tx-amount ${txType}">
            ${isSent ? "-" : "+"}${amount} ${CoinConfig.symbol}
          </div>
        </div>
      `;
    })
    .join("");

  txList.innerHTML = html;

  // Pending 상태 추적
  if (hasPendingTx && localStorage.getItem('eth_has_pending_tx') !== 'true') {
    console.log('New pending transaction detected, switching to fast polling');
    localStorage.setItem('eth_has_pending_tx', 'true');
    localStorage.setItem('eth_pending_start_time', Date.now().toString());
    setupDynamicPolling(); // Fast 모드로 전환
  }
}

// 트랜잭션 아이콘 가져오기
function getTransactionIcon(type, isContractCreation) {
  if (isContractCreation) return "📜"; // 컨트랙트 생성
  
  switch (type) {
    case "sent":
      return "↗️";
    case "received":
      return "↘️";
    case "pending":
      return "⏳";
    case "failed":
      return "❌";
    default:
      return "💎";
  }
}

// 트랜잭션 상세 보기 (Etherscan)
function openTransaction(hash) {
  const currentNetwork = getCurrentNetwork();
  const baseUrl =
    currentNetwork.name === "mainnet"
      ? "https://etherscan.io"
      : `https://${currentNetwork.name}.etherscan.io`;
  
  const url = `${baseUrl}/tx/${hash}`;
  
  if (window.anamUI && window.anamUI.openExternalLink) {
    window.anamUI.openExternalLink(url);
  } else if (window.anam && window.anam.openExternalLink) {
    window.anam.openExternalLink(url);
  } else {
    window.open(url, "_blank");
  }
}

// 로딩 상태 표시
function showTransactionLoading() {
  const txList = document.getElementById("tx-list");
  txList.innerHTML = `
    <div class="tx-loading">
      <div class="spinner"></div>
      <div>Loading transactions...</div>
    </div>
  `;
}

// 에러 상태 표시
function showTransactionError(message) {
  const txList = document.getElementById("tx-list");
  txList.innerHTML = `
    <div class="tx-error">
      <div class="tx-error-text">Failed to load transactions: ${message}</div>
      <button class="tx-retry-btn" onclick="loadTransactionHistory()">
        Retry
      </button>
    </div>
  `;
}

// 캐시 관리
// 트랜잭션 캐시 읽기 - EthereumUtils 사용
function getTransactionCache() {
  const data = EthereumUtils.getCache(TX_CACHE_KEY);
  if (data && Date.now() - data.timestamp > TX_CACHE_TTL) {
    EthereumUtils.clearCache(TX_CACHE_KEY);
    return null;
  }
  return data;
}

// 트랜잭션 캐시 저장 - EthereumUtils 사용
function saveTransactionCache(address, transactions) {
  const data = {
    address: address,
    transactions: transactions,
    timestamp: Date.now(),
  };
  EthereumUtils.setCache(TX_CACHE_KEY, data, TX_CACHE_TTL);
}

// ================================================================
// Navigation Helper
// ================================================================

function navigate(page, query = '') {
  const pageName = page.split('/').pop();
  const path = query ? `${page}?${query}` : page;

  if (window.anamUI?.navigateTo) {
    window.anamUI.navigateTo(path);
  } else if (window.anam?.navigateTo) {
    window.anam.navigateTo(path);
  } else {
    // Development environment
    window.location.href = `../${pageName}/${pageName}.html${query ? '?' + query : ''}`;
  }
}

// Send 페이지로 이동
function navigateToSend() {
  if (!getCurrentWalletInfo()) {
    showToast("No wallet found");
    return;
  }
  navigate("pages/send/send");
}

// QR 스캔 후 주소와 함께 Send 페이지로 이동
function navigateToSendWithAddress(address) {
  if (!getCurrentWalletInfo()) {
    showToast("No wallet found");
    return;
  }
  console.log("Navigating to send page with address:", address);
  navigate("pages/send/send", `address=${encodeURIComponent(address)}`);
}

// Receive 페이지로 이동
function navigateToReceive() {
  if (!getCurrentWalletInfo()) {
    showToast("No wallet found");
    return;
  }
  navigate("pages/receive/receive");
}

// Token 페이지로 이동
function navigateToToken() {
  if (!getCurrentWalletInfo()) {
    showToast("No wallet found");
    return;
  }
  navigate("pages/token/token");
}

// Settings 페이지로 이동
function navigateToSettings() {
  navigate("pages/settings/settings");
}

// Add Wallet 페이지로 이동
function navigateToAddWallet() {
  navigate("pages/add-wallet/add-wallet");
}

// 지갑 초기화
function resetWallet() {
  if (confirm('Reset all wallets? This cannot be undone!')) {
    if (hdManager) {
      hdManager.resetAllWallets();
    }
    
    // 기존 storage도 클리어
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.removeItem(walletKey);
    
    // 트랜잭션 캐시 삭제
    localStorage.removeItem(TX_CACHE_KEY);
    localStorage.removeItem('eth_has_pending_tx');
    localStorage.removeItem('eth_pending_start_time');
    
    // 개별 트랜잭션 캐시도 삭제
    const allKeys = Object.keys(localStorage);
    allKeys.forEach(key => {
      if (key.startsWith('eth_tx_')) {
        localStorage.removeItem(key);
      }
    });

    if (window.WalletStorage) {
      WalletStorage.clear();
    }
    
    currentWallet = null;
    location.reload();
  }
}

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

// 니모닉 백업 표시
function showMnemonicBackup(mnemonic) {
  // Create a more user-friendly backup dialog
  const dialog = document.createElement('div');
  dialog.className = 'mnemonic-backup-dialog';
  dialog.innerHTML = `
    <div class="dialog-overlay"></div>
    <div class="dialog-content">
      <h2>⚠️ Important: Save Your Recovery Phrase</h2>
      <p class="warning-text">Write down these words in order. This is the ONLY way to recover your wallet!</p>
      <div class="mnemonic-display">
        ${mnemonic.split(' ').map((word, index) =>
          `<span class="mnemonic-word">${index + 1}. ${word}</span>`
        ).join('')}
      </div>
      <div class="dialog-buttons">
        <button class="btn-copy" onclick="copyMnemonicToClipboard('${mnemonic}')">📋 Copy to Clipboard</button>
        <button class="btn-confirm" onclick="closeMnemonicBackupDialog()">✅ I've Saved It</button>
      </div>
    </div>
  `;

  document.body.appendChild(dialog);

  // Auto-focus on confirm button
  setTimeout(() => {
    const confirmBtn = dialog.querySelector('.btn-confirm');
    if (confirmBtn) confirmBtn.focus();
  }, 100);
}

async function copyMnemonicToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Recovery phrase copied to clipboard", "success");
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.cssText = "position:fixed;opacity:0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showToast("Recovery phrase copied to clipboard", "success");
    } catch (err) {
      showToast("Failed to copy. Please copy manually.", "error");
    }
    document.body.removeChild(textArea);
  }
}

function closeMnemonicBackupDialog() {
  const dialog = document.querySelector('.mnemonic-backup-dialog');
  if (dialog) {
    dialog.remove();
  }
}

// Bridge Handler 초기화
function initBridgeHandler() {
  const walletInfo = currentWallet || getCurrentWalletInfo();
  
  if (window.BridgeHandler && walletInfo) {
    window.BridgeHandler.initHandler(
      walletInfo,
      adapter,
      CoinConfig
    );
    
    // Universal Bridge 이벤트 리스너 등록
    window.addEventListener('universalBridgeRequest', window.BridgeHandler.handleUniversalRequest);
    console.log('[Index] Bridge Handler initialized');
  }
}

// Bridge Handler 지갑 업데이트
function updateBridgeHandlerWallet() {
  const walletInfo = currentWallet || getCurrentWalletInfo();
  
  if (window.BridgeHandler && walletInfo) {
    window.BridgeHandler.updateWallet(walletInfo);
    console.log('[Index] Bridge Handler wallet updated');
  }
}

// ================================================================
// DApp 트랜잭션 요청 처리 (Universal Bridge v2)
// ================================================================

// Universal Bridge v2 (BrowserWebView) 요청 처리
async function handleUniversalTransactionRequest(event) {
  console.log("Universal transaction request received:", event.detail);

  const walletInfo = currentWallet || getCurrentWalletInfo();
  
  if (!walletInfo || !adapter) {
    console.log("No wallet found for transaction");
    return;
  }

  const { requestId, payload } = event.detail;

  try {
    const requestData = JSON.parse(payload);
    
    // 트랜잭션 파라미터 구성
    const txParams = {
      from: walletInfo.address,
      to: requestData.to,
      amount: requestData.amount || requestData.value || "0",
      privateKey: walletInfo.privateKey,
    };

    // Ethereum 추가 파라미터 처리
    if (requestData.data) txParams.data = requestData.data;
    if (requestData.gasPrice) txParams.gasPrice = requestData.gasPrice;
    if (requestData.gasLimit) txParams.gasLimit = requestData.gasLimit;
    if (requestData.maxFeePerGas) txParams.maxFeePerGas = requestData.maxFeePerGas;
    if (requestData.maxPriorityFeePerGas) txParams.maxPriorityFeePerGas = requestData.maxPriorityFeePerGas;

    const result = await adapter.sendTransaction(txParams);

    // 응답 전송
    const response = {
      jsonrpc: "2.0",
      id: requestId,
      result: result.hash
    };

    if (window.anam && window.anam.sendUniversalResponse) {
      window.anam.sendUniversalResponse(requestId, JSON.stringify(response));
      console.log("Universal transaction response sent:", response);
    }

    // UI 업데이트
    setTimeout(() => {
      updateBalance();
      loadTransactionHistory();
    }, 3000);

  } catch (error) {
    console.log("Universal transaction failed:", error);

    // 에러 응답 전송
    if (window.anam && window.anam.sendUniversalResponse) {
      const errorResponse = {
        jsonrpc: "2.0",
        id: requestId,
        error: {
          code: -32000,
          message: error.message
        }
      };
      window.anam.sendUniversalResponse(requestId, JSON.stringify(errorResponse));
    }
  }
}

// 트랜잭션 요청 처리 (기존 방식 - WebApp에서 직접 호출)
async function handleTransactionRequest(event) {
  console.log("Transaction request received (legacy):", event.detail);

  // 지갑 정보 다시 로드 (BlockchainService 환경에서 실행될 때를 위해)
  let walletInfo = currentWallet || getCurrentWalletInfo();
  
  if (!walletInfo) {
    walletInfo = WalletStorage.get();
    if (walletInfo) {
      try {
        console.log("Wallet info reloaded");
      } catch (e) {
        console.log("Failed to load wallet:", e);
      }
    }
  }

  if (!walletInfo || !adapter) {
    console.log("No wallet found");
    // 에러 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      const requestId = event.detail.requestId;
      const errorResponse = {
        error: "No wallet found",
        status: "error",
      };
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(errorResponse)
      );
    }
    return;
  }

  const requestData = event.detail;
  const requestId = requestData.requestId;

  try {
    // 트랜잭션 데이터 파싱
    let transactionData;
    if (typeof requestData.transactionData === "string") {
      transactionData = JSON.parse(requestData.transactionData);
    } else {
      transactionData = requestData;
    }

    // 트랜잭션 파라미터 구성
    const txParams = {
      from: walletInfo.address,
      to: transactionData.to,
      amount: transactionData.amount || transactionData.value || "0",
      privateKey: walletInfo.privateKey,
    };

    // Ethereum 추가 파라미터 처리
    if (transactionData.data) {
      txParams.data = transactionData.data;
    }
    if (transactionData.gasPrice) {
      txParams.gasPrice = transactionData.gasPrice;
    }
    if (transactionData.gasLimit) {
      txParams.gasLimit = transactionData.gasLimit;
    }

    console.log("Sending transaction with params:", txParams);
    const result = await adapter.sendTransaction(txParams);

    // 응답 데이터 구성
    const responseData = {
      requestId: requestId,
      status: "success",
      txHash: result.hash || result.txid || result.signature,
      from: walletInfo.address,
      to: txParams.to,
      amount: txParams.amount,
      chainId: CoinConfig.network.chainId,
      network: CoinConfig.network.networkName,
      symbol: CoinConfig.symbol,
    };

    // Bridge API를 통해 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(responseData)
      );
      console.log("Transaction response sent:", responseData);
    }

    // UI 업데이트
    setTimeout(() => {
      updateBalance();
      loadTransactionHistory();
    }, 3000);
  } catch (error) {
    console.log("Transaction failed:", error);

    // 에러 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      const errorResponse = {
        error: error.message,
        from: walletInfo.address,
        symbol: CoinConfig.symbol,
      };
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(errorResponse)
      );
    }
  }
}

// QR 스캔 함수
function scanQRCode() {
  console.log("=== QR scan initiated ===");

  // QR 스캔 결과 이벤트 리스너 등록 (일회성)
  window.addEventListener("qrScanned", handleQRScanned, { once: true });

  if (window.anamUI && window.anamUI.scanQRCode) {
    // miniapp API 사용
    window.anamUI.scanQRCode();

    console.log("QR scanner requested to main process");
  } else {
    console.log("anamUI.scanQRCode API not available");
    showToast("QR scan feature is not available");
  }
}

// QR 스캔 결과 처리
function handleQRScanned(event) {
  console.log("QR scan event received:", event);

  // 이벤트 리스너 제거 (일회성)
  window.removeEventListener("qrScanned", handleQRScanned);

  if (event.detail && event.detail.success) {
    const qrData = event.detail.data;
    console.log("=== QR scan success ===");
    console.log("QR data:", qrData);
    console.log("Data length:", qrData.length);
    console.log("Data type:", typeof qrData);

    // Analyze QR data
    analyzeQRData(qrData);

    // 사용자에게 알림
    showToast("QR scan completed");
  } else {
    const error = event.detail ? event.detail.error : "Unknown error";
    console.log("QR scan failed:", error);
    showToast("QR scan failed: " + error);
  }
}

// Analyze QR data
function analyzeQRData(data) {
  console.log("=== QR data analysis ===");

  // 1. Check Ethereum address format (42 characters starting with 0x)
  if (data.startsWith("0x") && data.length === 42) {
    console.log("Format: Ethereum address");
    console.log("Address:", data);
    // Navigate to Send page with address
    navigateToSendWithAddress(data);
    return;
  }

  // 2. Check Ethereum URI format (ethereum:0x...)
  if (data.startsWith("ethereum:")) {
    console.log("Format: Ethereum URI");
    const parts = data.split(":");
    if (parts.length >= 2) {
      const address = parts[1].split("?")[0]; // Remove parameters
      console.log("Address:", address);
      // Navigate to Send page with address
      navigateToSendWithAddress(address);
    }
    return;
  }

  // 3. Check private key format (64 hex characters)
  if (/^[0-9a-fA-F]{64}$/.test(data)) {
    console.log("Format: Private key (CAUTION: Sensitive information)");
    // Private key is not processed automatically for security
    showToast("Private key QR code detected");
    return;
  }

  // 4. Unknown format
  console.log("Format: Unknown");
  console.log("Data:", data.substring(0, 50) + "...");
  showToast("Unrecognized QR code");
}

// 네트워크 변경 핸들러
function handleNetworkChange() {
  console.log("[Index] Network changed, refreshing page data");
  console.log("Page visibility:", document.visibilityState);
  console.log("Is background:", document.hidden);
  console.log("Timestamp:", new Date().toISOString());

  // 현재 네트워크 정보 업데이트
  const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
  if (currentNetwork) {
    console.log(
      `Switched to network: ${currentNetwork.name} (Chain ID: ${currentNetwork.chainId})`
    );
  }

  // 네트워크 라벨 업데이트
  updateNetworkLabel();

  // 지갑이 있다면 잔액과 트랜잭션 다시 로드
  const walletInfo = currentWallet || getCurrentWalletInfo();
  if (walletInfo && walletInfo.address) {
    updateBalance();
    loadTransactionHistory();
  }

  // 네트워크 표시 업데이트 (있다면)
  const networkDisplay = document.querySelector(".network-indicator");
  if (networkDisplay && currentNetwork) {
    networkDisplay.textContent = currentNetwork.name;
  }
}

// ================================================================
// 전역 함수 등록 (HTML onclick을 위해)
// ================================================================

// 기존 함수들
window.createWallet = createWallet;
window.importFromMnemonic = importFromMnemonic;
window.showImportOptions = showImportOptions;
window.hideImportOptions = hideImportOptions;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.navigateToToken = navigateToToken;
window.navigateToSettings = navigateToSettings;
window.navigateToAddWallet = navigateToAddWallet;
window.resetWallet = resetWallet;
window.scanQRCode = scanQRCode;
window.openTransaction = openTransaction;
window.loadTransactionHistory = loadTransactionHistory;

// HD Wallet 함수들
window.switchToAccount = switchToAccount;
window.switchToWallet = switchToWallet;
window.addNewAccount = addNewAccount;
window.updateWalletDropdown = updateWalletDropdown;

// Mnemonic backup functions
window.copyMnemonicToClipboard = copyMnemonicToClipboard;
window.closeMnemonicBackupDialog = closeMnemonicBackupDialog;




// // Ethereum 지갑 메인 페이지 로직

// // 전역 변수
// let adapter = null; // 코인 어댑터 인스턴스
// let hdManager = null; // HD Wallet Manager 인스턴스
// let currentWallet = null; // 현재 지갑 정보
// let pollTimer = null; // 폴링 타이머
// let currentPollingInterval = null; // 현재 폴링 간격

// // 폴링 설정
// const POLLING_CONFIG = {
//   PENDING: 15000,      // 15초 - Pending 있을 때
//   NORMAL: 30000,       // 30초 - 기존 유지
//   MAX_PENDING_TIME: 300000  // 5분 - 최대 pending 체크 시간
// };

// // 설정은 EthereumConfig에서 가져옴 (utils/config.js)
// const { CACHE, getCurrentNetwork, getEtherscanApiUrl } =
//   window.EthereumConfig || {};
// const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "eth_tx_cache";
// const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 5 * 60 * 1000;

// // Utils 함수 가져오기
// const { showToast } = window.EthereumUtils || {};

// // 페이지 초기화
// document.addEventListener("DOMContentLoaded", function () {
//   console.log(`${CoinConfig.name} wallet page loaded`);

//   // Bridge API 초기화
//   if (window.anam) {
//     console.log("Bridge API available");
//   }

//   // Ethereum 어댑터 초기화
//   adapter = window.getAdapter();

//   if (!adapter) {
//     console.log("EthereumAdapter not initialized");
//     showToast("Failed to initialize Ethereum adapter");
//   }

//   if (window.getHDWalletManager) {
//     hdManager = window.getHDWalletManager();
//     console.log("HD Wallet Manager initialized");
    
//     // 기존 지갑 마이그레이션 체크
//     // migrateToHDWallet(); // ?
//   }

//   // walletReady 이벤트 리스너 등록 (Keystore 복호화 완료 시)
//   window.addEventListener("walletReady", function() {
//     console.log("[Index] Wallet decryption completed");
//     // 복호화된 지갑 데이터로 재초기화
//     currentWallet = WalletStorage.get();
//     if (currentWallet) {
//       updateBalance();
//       loadTransactionHistory();
//     }
//   });

//   // 네트워크 변경 이벤트 리스너
//   window.addEventListener("providerUpdated", handleNetworkChange);

//   // UI 테마 적용
//   applyTheme();

//   // 지갑 존재 여부 확인 (UI 먼저 표시)
//   checkWalletStatus();

//   // 네트워크 라벨 업데이트
//   updateNetworkLabel();

//   // 네트워크 상태는 비동기로 확인 (블로킹하지 않음)
//   checkNetworkStatus();

//   // 동적 폴링 설정
//   setupDynamicPolling();
  
//   // Send에서 돌아왔을 때 즉시 업데이트 (pending TX가 있을 수 있음)
//   if (localStorage.getItem('eth_has_pending_tx') === 'true') {
//     console.log('Pending transaction detected, updating immediately');
//     updateBalance();
//     loadTransactionHistory();
//   }

//   // 트랜잭션 요청 이벤트 리스너 등록 (기존 방식 지원)
//   window.addEventListener("transactionRequest", handleTransactionRequest);
//   window.handleTransactionRequest = handleTransactionRequest; // Bridge Handler에서 사용

//   // Bridge Handler 초기화 (지갑이 없어도 Handler는 초기화)
//   initBridgeHandler();
// });

// // 테마 적용
// function applyTheme() {
//   const root = document.documentElement;
//   root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
//   root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);

//   // 텍스트 변경
//   document.querySelectorAll(".logo-text").forEach((el) => {
//     el.textContent = CoinConfig.theme.logoText;
//   });

//   document.querySelectorAll(".coin-unit").forEach((el) => {
//     el.textContent = CoinConfig.symbol;
//   });

//   // 타이틀 변경
//   document.title = `${CoinConfig.name} Wallet`;
// }

// // 네트워크 라벨 업데이트
// function updateNetworkLabel() {
//   const networkLabel = document.getElementById('network-label');
//   if (networkLabel) {
//     const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
//     if (currentNetwork) {
//       networkLabel.textContent = currentNetwork.name;
//     }
//   }
// }

// // 동적 폴링 설정
// function setupDynamicPolling() {
//   // Pending TX 체크
//   const hasPending = localStorage.getItem('eth_has_pending_tx') === 'true';
//   const interval = hasPending ? POLLING_CONFIG.PENDING : POLLING_CONFIG.NORMAL;
  
//   // 이미 같은 간격으로 실행 중이면 변경 안 함
//   if (currentPollingInterval === interval) return;
  
//   // 기존 타이머 정리
//   if (pollTimer) {
//     clearInterval(pollTimer);
//   }
  
//   // 새 타이머 설정
//   pollTimer = setInterval(() => {
//     if (currentWallet) {
//       updateBalance();
//       loadTransactionHistory();
//       checkPendingComplete(); // Pending 완료 체크
//     }
//   }, interval);
  
//   currentPollingInterval = interval;
//   console.log(`Polling mode: ${hasPending ? 'FAST (15s)' : 'NORMAL (30s)'}`);
// }

// // Pending 트랜잭션 완료 확인
// async function checkPendingComplete() {
//   const hasPending = localStorage.getItem('eth_has_pending_tx') === 'true';
//   if (!hasPending) return;
  
//   // 캐시에서 pending TX 확인
//   const cacheKey = `eth_tx_${currentWallet.address.toLowerCase()}`;
//   const cached = localStorage.getItem(cacheKey);
  
//   if (cached) {
//     try {
//       const data = JSON.parse(cached);
//       const stillPending = data.data?.some(tx => tx.isPending);
      
//       if (!stillPending) {
//         // Pending 완료 → Normal 모드로
//         console.log('All pending transactions confirmed, switching to normal mode');
//         localStorage.removeItem('eth_has_pending_tx');
//         localStorage.removeItem('eth_pending_start_time');
//         setupDynamicPolling(); // 재설정 (30초로)
//       }
//     } catch (e) {
//       console.log('Error checking pending status:', e);
//     }
//   }
  
//   // 5분 타임아웃 (안전장치)
//   const pendingStart = localStorage.getItem('eth_pending_start_time');
//   if (pendingStart && Date.now() - parseInt(pendingStart) > POLLING_CONFIG.MAX_PENDING_TIME) {
//     console.log('Pending timeout reached, switching to normal mode');
//     localStorage.removeItem('eth_has_pending_tx');
//     localStorage.removeItem('eth_pending_start_time');
//     setupDynamicPolling();
//   }
// }

// // 네트워크 상태 확인
// async function checkNetworkStatus() {
//   try {
//     // Ethereum 네트워크 상태 확인
//     await adapter.initProvider();
//     const blockNumber = await adapter.getBlockNumber();
//     console.log("Current block number:", blockNumber);
//     document.getElementById("network-status").style.color = "#4cff4c";
//   } catch (error) {
//     console.log("Network connection failed:", error);
//     document.getElementById("network-status").style.color = "#ff4444";
//   }
// }

// // // 지갑 상태 확인
// // async function checkWalletStatus() {
// //   // WalletStorage 초기화
// //   WalletStorage.init();
// //   currentWallet = WalletStorage.get();

// //   if (currentWallet) {
// //     // 지갑이 있으면 메인 화면 표시
// //     try {
// //       console.log("[checkWalletStatus] Wallet loaded:", currentWallet.address);

// //       // Bridge Handler 초기화
// //       initBridgeHandler();

// //       document.getElementById("wallet-creation").style.display = "none";
// //       document.getElementById("wallet-main").style.display = "block";
// //       console.log("[checkWalletStatus] Switched to main screen");

// //       displayWalletInfo();

// //       // 트랜잭션 로딩 UI를 즉시 표시
// //       showTransactionLoading();

// //       // 잔액과 트랜잭션을 병렬로 로드 (속도 개선)
// //       try {
// //         await Promise.all([
// //           updateBalance(),
// //           loadTransactionHistory(true), // skipLoadingUI = true (이미 표시했으므로)
// //         ]);
// //       } catch (error) {
// //         console.log("Failed to load wallet data:", error);
// //       }

// //       // 백업 리마인더 체크 (니모닉 플로우에서 스킵한 경우)
// //       if (window.mnemonicFlow) {
// //         window.mnemonicFlow.checkBackupReminder();
// //       }
// //     } catch (error) {
// //       console.log("Failed to load wallet:", error);
// //       showToast("Failed to load wallet");
// //       resetWallet();
// //     }
// //   } else {
// //     // 지갑이 없으면 생성 화면 표시
// //     console.log("[checkWalletStatus] No wallet found, showing creation screen");
// //     document.getElementById("wallet-creation").style.display = "block";
// //     document.getElementById("wallet-main").style.display = "none";
// //   }
// // }

// // checkWalletStatus 수정
// async function checkWalletStatus() {
//   WalletStorage.init();
  
//   const useHDWallet = window.getHDWalletManager !== undefined;
  
//   if (useHDWallet) {
//     const manager = window.getHDWalletManager();
//     if (manager.getCurrentWallet()) {
//       currentWallet = getCurrentWalletInfo();
//     } else {
//       // HD 지갑 없음
//       currentWallet = null;
//     }
//   } else {
//     currentWallet = WalletStorage.get();
//   }
  
//   if (currentWallet) {
//     // 지갑 있음 - 메인 화면
//     document.getElementById("wallet-creation").style.display = "none";
//     document.getElementById("wallet-main").style.display = "block";
    
//     displayWalletInfo();
//     updateBalance();
//     loadTransactionHistory();
//   } else {
//     // 지갑 없음 - 생성 화면
//     document.getElementById("wallet-creation").style.display = "block";
//     document.getElementById("wallet-main").style.display = "none";
//   }
// }

// // 새 지갑 생성 - 니모닉 플로우 시작
// async function createWallet() {
//   if (!adapter) {
//     showToast("CoinAdapter not implemented");
//     return;
//   }

//   try {
//     console.log("Starting mnemonic flow for wallet creation");

//     // HD Wallet Manager 사용 가능 여부 확인
//     const useHDWallet = window.getHDWalletManager !== undefined;

//     if (useHDWallet) {
//       // HD 지갑 생성
//       const manager = window.getHDWalletManager();
//       const result = await manager.createNewWallet();

//       if (window.mnemonicFlow) {
//         window.mnemonicFlow.showBackup(result.mnemonic, result.walletId);
//       } else {
//         showMnemonicBackup(result.mnemonic);
//       }
//       updateCurrentWallet();
//     }
//     // 니모닉 플로우 시작
//     if (window.mnemonicFlow) {
//       window.mnemonicFlow.start();
//     } else {
//       console.log("Mnemonic flow not initialized");
//       showToast("Failed to initialize wallet creation flow");
//     }
//   } catch (error) {
//     console.log("Failed to start wallet creation:", error);
//     showToast("Failed to start wallet creation: " + error.message);
//   }
// }

// // 니모닉으로 지갑 가져오기
// async function importFromMnemonic() {
//   if (!adapter) {
//     showToast("CoinAdapter not implemented");
//     return;
//   }

//   const mnemonicInput = document.getElementById("mnemonic-input").value.trim();

//   if (!mnemonicInput) {
//     showToast("Please enter the mnemonic");
//     return;
//   }

//   try {
//     showToast("Importing wallet...");

//     const wallet = await adapter.importFromMnemonic(mnemonicInput);

//     // Keystore API로 안전하게 저장
//     await WalletStorage.saveSecure(
//       mnemonicInput,
//       wallet.address,
//       wallet.privateKey
//     );
    
//     // 메모리에 캐시
//     currentWallet = {
//       address: wallet.address,
//       privateKey: wallet.privateKey,
//       mnemonic: mnemonicInput,
//       createdAt: new Date().toISOString(),
//     };
//     updateWalletInfo(currentWallet);

//     showToast("Wallet imported successfully!");

//     // 화면 전환
//     document.getElementById("wallet-creation").style.display = "none";
//     document.getElementById("wallet-main").style.display = "block";

//     displayWalletInfo();
//     updateBalance();

//     // 트랜잭션 로딩 표시 후 조회
//     showTransactionLoading();
//     setTimeout(() => {
//       loadTransactionHistory(true); // skipLoadingUI = true
//     }, 100);
//   } catch (error) {
//     console.log("Failed to import wallet:", error);
//     showToast("Please enter a valid mnemonic");
//   }
// }

// // 개인키로 지갑 가져오기

// // 지갑 정보 표시
// // function displayWalletInfo() {
// //   if (!currentWallet || !adapter) return;

// //   const address = currentWallet.address;
// //   const addressDisplay = document.getElementById("address-display");

// //   // 주소 축약 표시
// //   const shortAddress = window.EthereumUtils?.shortenAddress(address) || address;
// //   addressDisplay.textContent = shortAddress;
// //   addressDisplay.title = address; // 전체 주소는 툴팁으로

// //   // 클릭 시 전체 주소 복사
// //   addressDisplay.style.cursor = "pointer";
// //   addressDisplay.onclick = async () => {
// //     const success = await window.EthereumUtils?.copyToClipboard(address);
// //     if (success) {
// //       showToast("Address copied to clipboard");
// //     }
// //   };
// // }

// function displayWalletInfo() {
//   const walletInfo = getCurrentWalletInfo();
//   if (!walletInfo || !adapter) return;
  
//   const address = walletInfo.address;
//   const addressDisplay = document.getElementById("address-display");
  
//   // HD 지갑인 경우 추가 정보 표시
//   if (walletInfo.isHDWallet) {
//     // 지갑/계정 이름 표시
//     const walletLabel = document.getElementById("wallet-label");
//     if (walletLabel) {
//       walletLabel.textContent = `${walletInfo.walletName} - ${walletInfo.accountName}`;
//     }
    
//     // 계정 선택 드롭다운 표시
//     showAccountSelector();
//   }
  
//   // 주소 표시 (기존 로직)
//   const shortAddress = window.EthereumUtils?.shortenAddress(address) || address;
//   addressDisplay.textContent = shortAddress;
//   addressDisplay.title = address;
  
//   addressDisplay.onclick = async () => {
//     const success = await window.EthereumUtils?.copyToClipboard(address);
//     if (success) {
//       showToast("Address copied to clipboard");
//     }
//   };
// }

// // 잔액 업데이트
// async function updateBalance() {
//   if (!currentWallet || !adapter) return;

//   try {
//     const balance = await adapter.getBalance(currentWallet.address);

//     // 디버깅 로그 추가
//     console.log("Wallet address:", currentWallet.address);
//     console.log("Raw balance from adapter:", balance);
//     console.log("Type of balance:", typeof balance);

//     const formattedBalance =
//       window.EthereumUtils?.formatBalance(balance) || balance;

//     console.log("Formatted balance:", formattedBalance);

//     document.getElementById("balance-display").textContent = formattedBalance;
//   } catch (error) {
//     console.log("Failed to fetch balance:", error);
//   }
// }

// function showAccountSelector() {
//   const manager = window.getHDWalletManager();
//   if (!manager) return;

//   const wallet = manager.getCurrentWallet();
//   if (!wallet || wallet.type !== 'hd') return;

//   // 계정 선택 드롭다운 HTML 생성
//   const selectorHTML = `
//     <div class="account-selector">
//       <select id="account-dropdown" onchange="switchAccount(this.value)">
//         ${wallet.accounts.map(acc => `
//           <option value="${acc.index}" ${acc.index === wallet.currentAccountIndex ? 'selected' : ''}>
//             ${acc.name} (${window.EthereumUtils.shortenAddress(acc.address)})
//           </option>
//         `).join('')}
//       </select>
//       <button onclick="addNewAccount()" class="add-account-btn">+ Add Account</button>
//     </div>
//   `;

//   const container = document.getElementById("account-selector-container");
//   if (container) {
//     container.innerHTML = selectorHTML;
//     container.style.display = 'block';
//   }
// }

// async function switchAccount(accountIndex) {
//   const manager = window.getHDWalletManager();
//   const walletId = manager.getCurrentWallet().id;

//   manager.switchAccount(walletId, parseInt(accountIndex));

//   // UI 업데이트
//   updateCurrentWallet();
//   displayWalletInfo();
//   updateBalance();
//   loadTransactionHistory();

//   showToast("Switched Account");
// }

// async function addNewAccount() {
//   const manager = window.getHDWalletManager();
//   const wallet = manager.getCurrentWallet();

//   if (!wallet || wallet.type !== 'hd') {
//     showToast("Cannot add account to this wallet type");
//     return;
//   }

//   try {
//     showToast("Adding new account...");
//     const result = await manager.addAccountToWallet(wallet.id);

//     showAccountSelector();
//     updateCurrentWallet();
//     updateBalance();

//     showToast("New account added!");
//   } catch (error) {
//     showToast("Failed to add account: " + error.message);
//   }
// }

// // ================================================================
// // 트랜잭션 히스토리 관리
// // ================================================================

// // 트랜잭션 히스토리 로드 (캐시 우선)
// async function loadTransactionHistory(skipLoadingUI = false) {
//   // 로딩 상태 표시 (이미 표시 중이면 스킵)
//   if (!skipLoadingUI) {
//     showTransactionLoading();
//   }

//   try {
//     // Pending TX가 있으면 캐시를 무시하고 API 호출
//     const hasPending = localStorage.getItem('eth_has_pending_tx') === 'true';
    
//     if (hasPending) {
//       console.log('Pending transaction exists, forcing API call');
//       // API 직접 호출하여 최신 데이터 가져오기
//       const transactions = await fetchTransactionHistory(currentWallet.address);
//       saveTransactionCache(currentWallet.address, transactions);
//       displayTransactions(transactions);
//       return;
//     }
    
//     // Pending이 없을 때는 기존 캐시 로직 사용
//     const cached = getTransactionCache();
//     if (
//       cached &&
//       cached.address &&
//       currentWallet &&
//       currentWallet.address &&
//       cached.address.toLowerCase() === currentWallet.address.toLowerCase()
//     ) {
//       console.log("Using cached transactions for:", cached.address);
//       displayTransactions(cached.transactions);
//       return;
//     }

//     // API 호출
//     console.log("Fetching transactions from Etherscan...");
//     const transactions = await fetchTransactionHistory(currentWallet.address);

//     // 캐시 저장
//     saveTransactionCache(currentWallet.address, transactions);

//     // UI 업데이트
//     displayTransactions(transactions);
//   } catch (error) {
//     console.log("Failed to load transactions:", error);
//     showTransactionError(error.message);
//   }
// }

// // Etherscan API로 트랜잭션 조회
// async function fetchTransactionHistory(address) {
//   const url = EthereumConfig.getEtherscanApiUrl("account", "txlist", {
//     address: address,
//     startblock: 0,
//     endblock: 99999999,
//     sort: "desc",
//   });

//   const response = await fetch(url);

//   if (!response.ok) {
//     throw new Error(`Network error: ${response.status}`);
//   }

//   const data = await response.json();

//   if (data.status === "0" && data.message === "No transactions found") {
//     return [];
//   }

//   if (data.status !== "1") {
//     throw new Error(data.message || "Failed to fetch transactions");
//   }

//   // API에서 가져온 트랜잭션 (최근 10개)
//   const apiTransactions = data.result.slice(0, 10);
  
//   // pending 트랜잭션 정리: API 결과에 있는 해시는 pending에서 제거
//   const cacheKey = `eth_tx_${address.toLowerCase()}`;
//   const cached = localStorage.getItem(cacheKey);
  
//   if (cached) {
//     try {
//       const cacheData = JSON.parse(cached);
//       if (cacheData.data && Array.isArray(cacheData.data)) {
//         // API 결과의 해시 목록
//         const confirmedHashes = new Set(apiTransactions.map(tx => tx.hash.toLowerCase()));
        
//         // pending 트랜잭션 중 확정되지 않은 것만 유지
//         const remainingPending = cacheData.data.filter(tx => 
//           tx.isPending && !confirmedHashes.has(tx.hash.toLowerCase())
//         );
        
//         // 30분 이상 된 pending 트랜잭션 제거
//         const thirtyMinutesAgo = Math.floor(Date.now() / 1000) - (30 * 60);
//         const validPending = remainingPending.filter(tx => 
//           parseInt(tx.timeStamp) > thirtyMinutesAgo
//         );
        
//         // 캐시 업데이트: pending + API 결과
//         const mergedTransactions = [...validPending, ...apiTransactions];
//         cacheData.data = mergedTransactions;
//         localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
//         // 병합된 결과 반환
//         return mergedTransactions;
//       }
//     } catch (e) {
//       console.log("Error processing cache:", e);
//     }
//   }
  
//   // 캐시가 없으면 API 결과만 반환
//   return apiTransactions;
// }

// // 트랜잭션 표시
// function displayTransactions(transactions) {
//   const txList = document.getElementById("tx-list");

//   if (!transactions || transactions.length === 0) {
//     showTransactionEmpty();
//     return;
//   }

//   txList.innerHTML = "";

//   // pending 트랜잭션과 확정된 트랜잭션 분리
//   const pendingTxs = [];
//   const confirmedTxs = [];
  
//   transactions.forEach((tx) => {
//     if (tx.isPending) {
//       pendingTxs.push(tx);
//     } else {
//       confirmedTxs.push(tx);
//     }
//   });
  
//   // pending 트랜잭션 먼저 표시
//   pendingTxs.forEach((tx) => {
//     const isSent = EthereumUtils.isTransactionSent(tx, currentWallet.address);
//     const txElement = createTransactionElement(tx, isSent);
//     txList.appendChild(txElement);
//   });
  
//   // 확정된 트랜잭션 표시
//   confirmedTxs.forEach((tx) => {
//     const isSent = EthereumUtils.isTransactionSent(tx, currentWallet.address);
//     const txElement = createTransactionElement(tx, isSent);
//     txList.appendChild(txElement);
//   });
// }

// // 트랜잭션 요소 생성
// function createTransactionElement(tx, isSent) {
//   const div = document.createElement("div");
//   div.className = "tx-item";

//   const txType = isSent ? "send" : "receive";
//   // formatBalance를 사용하여 작은 금액도 제대로 표시
//   const formattedAmount = EthereumUtils.formatBalance(tx.value || "0");
//   const timeAgo = EthereumUtils.getTimeAgo(parseInt(tx.timeStamp) * 1000);
//   const address = isSent ? tx.to : tx.from;

//   // 컨트랙트 호출인지 확인
//   const isContract = tx.input && tx.input !== "0x";
  
//   // Pending 상태 확인 및 라벨 설정
//   let txLabel;
//   let statusSuffix = "";
  
//   if (tx.isPending) {
//     txLabel = "Pending";
//     statusSuffix = "...";  // pending 표시
//     div.className += " tx-pending";  // pending 스타일 클래스 추가
//   } else {
//     txLabel = isContract ? "Contract" : isSent ? "Sent" : "Received";
//   }

//   div.innerHTML = `
//     <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
//     <div class="tx-details">
//       <div class="tx-type">${txLabel}${statusSuffix}</div>
//       <div class="tx-address">${EthereumUtils.shortenAddress(address, 6)}</div>
//     </div>
//     <div class="tx-amount">
//       <div class="tx-eth ${txType}">${isSent ? "-" : "+"}${formattedAmount} ETH</div>
//       <div class="tx-time">${timeAgo}</div>
//     </div>
//   `;

//   // 클릭 시 Etherscan으로 이동
//   div.style.cursor = "pointer";
//   div.onclick = () => {
//     const explorerUrl = EthereumUtils.getEtherscanUrl("tx", tx.hash, "sepolia");
//     window.open(explorerUrl, "_blank");
//   };

//   return div;
// }

// // 로딩 상태 표시
// function showTransactionLoading() {
//   const txList = document.getElementById("tx-list");
//   txList.innerHTML = `
//     <div class="tx-loading">
//       <div class="tx-loading-spinner"></div>
//       <div class="tx-loading-text">Loading transactions...</div>
//     </div>
//   `;
// }

// // 빈 상태 표시
// function showTransactionEmpty() {
//   const txList = document.getElementById("tx-list");
//   txList.innerHTML = `
//     <div class="tx-empty">
//       <div class="tx-empty-icon">📭</div>
//       <div class="tx-empty-title">No transactions yet</div>
//       <div class="tx-empty-text">
//         Your transaction history will appear here<br>
//         once you send or receive ETH
//       </div>
//     </div>
//   `;
// }

// // 에러 상태 표시
// function showTransactionError(message) {
//   const txList = document.getElementById("tx-list");
//   txList.innerHTML = `
//     <div class="tx-error">
//       <div class="tx-error-text">Failed to load transactions: ${message}</div>
//       <button class="tx-retry-btn" onclick="loadTransactionHistory()">
//         Retry
//       </button>
//     </div>
//   `;
// }

// // 캐시 관리
// // 트랜잭션 캐시 읽기 - EthereumUtils 사용
// function getTransactionCache() {
//   const data = EthereumUtils.getCache(TX_CACHE_KEY);
//   if (data && Date.now() - data.timestamp > TX_CACHE_TTL) {
//     EthereumUtils.clearCache(TX_CACHE_KEY);
//     return null;
//   }
//   return data;
// }

// // 트랜잭션 캐시 저장 - EthereumUtils 사용
// function saveTransactionCache(address, transactions) {
//   const data = {
//     address: address,
//     transactions: transactions,
//     timestamp: Date.now(),
//   };
//   EthereumUtils.setCache(TX_CACHE_KEY, data, TX_CACHE_TTL);
// }

// // Send 페이지로 이동
// function navigateToSend() {
//   if (!currentWallet) {
//     showToast("No wallet found");
//     return;
//   }
//   // blockchain miniapp은 anamUI 네임스페이스 사용
//   if (window.anamUI && window.anamUI.navigateTo) {
//     window.anamUI.navigateTo("pages/send/send");
//   } else if (window.anam && window.anam.navigateTo) {
//     window.anam.navigateTo("pages/send/send");
//   } else {
//     // 개발 환경: 일반 HTML 페이지 이동
//     window.location.href = "../send/send.html";
//   }
// }

// // QR 스캔 후 주소와 함께 Send 페이지로 이동
// function navigateToSendWithAddress(address) {
//   if (!currentWallet) {
//     showToast("No wallet found");
//     return;
//   }

//   console.log("Navigating to send page with address:", address);

//   // blockchain miniapp은 anamUI 네임스페이스 사용
//   if (window.anamUI && window.anamUI.navigateTo) {
//     // 쿼리 파라미터로 주소 전달
//     window.anamUI.navigateTo(
//       `pages/send/send?address=${encodeURIComponent(address)}`
//     );
//   } else if (window.anam && window.anam.navigateTo) {
//     window.anam.navigateTo(
//       `pages/send/send?address=${encodeURIComponent(address)}`
//     );
//   } else {
//     // 개발 환경: 일반 HTML 페이지 이동
//     window.location.href = `../send/send.html?address=${encodeURIComponent(
//       address
//     )}`;
//   }
// }

// // Receive 페이지로 이동
// function navigateToReceive() {
//   if (!currentWallet) {
//     showToast("No wallet found");
//     return;
//   }
//   // blockchain miniapp은 anamUI 네임스페이스 사용
//   if (window.anamUI && window.anamUI.navigateTo) {
//     window.anamUI.navigateTo("pages/receive/receive");
//   } else if (window.anam && window.anam.navigateTo) {
//     window.anam.navigateTo("pages/receive/receive");
//   } else {
//     // 개발 환경: 일반 HTML 페이지 이동
//     window.location.href = "../receive/receive.html";
//   }
// }

// // 지갑 초기화
// // function resetWallet() {
// //   const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
// //   localStorage.removeItem(walletKey);

// //   // 트랜잭션 캐시도 함께 삭제 (중요!)
// //   localStorage.removeItem(TX_CACHE_KEY);

// //   currentWallet = null;

// //   // 화면 전환
// //   document.getElementById("wallet-main").style.display = "none";
// //   document.getElementById("wallet-creation").style.display = "block";

// //   // 입력 필드 초기화
// //   const mnemonicInput = document.getElementById("mnemonic-input");
// //   const privateKeyInput = document.getElementById("privatekey-input");
// //   if (mnemonicInput) mnemonicInput.value = "";
// //   if (privateKeyInput) privateKeyInput.value = "";

// //   showToast("Wallet has been reset");
// // }

// function resetWallet() {
//   const useHDWallet = window.getHDWalletManager !== undefined;
  
//   if (useHDWallet) {
//     if (confirm('Reset all wallets and accounts? This cannot be undone!')) {
//       const manager = window.getHDWalletManager();
//       manager.resetAllWallets();
      
//       // 캐시 초기화
//       WalletStorage.clear();
//       localStorage.removeItem(TX_CACHE_KEY);
      
//       currentWallet = null;
//       location.reload();
//     }
//   } else {
//     // 기존 단일 지갑 리셋
//     const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
//     localStorage.removeItem(walletKey);
    
//     // 트랜잭션 캐시 삭제
//     localStorage.removeItem(TX_CACHE_KEY);
    
//     WalletStorage.clear();
//     currentWallet = null;
    
//     location.reload();
//   }
// }

// // 트랜잭션 요청 처리 (Bridge API)
// async function handleTransactionRequest(event) {
//   console.log("Transaction request received:", event.detail);

//   // 지갑 정보 다시 로드 (BlockchainService 환경에서 실행될 때를 위해)
//   if (!currentWallet) {
//     currentWallet = WalletStorage.get();
//     if (currentWallet) {
//       try {
//         console.log("Wallet info reloaded");
//       } catch (e) {
//         console.log("Failed to load wallet:", e);
//       }
//     }
//   }

//   if (!currentWallet || !adapter) {
//     console.log("No wallet found");
//     return;
//   }

//   const requestData = event.detail;
//   const requestId = requestData.requestId;

//   try {
//     // Ethereum 트랜잭션 요청 처리
//     // 예시:
//     // - Ethereum 형식: {to, amount, data}
//     // - Bitcoin 형식: {recipient, satoshis, memo}
//     // - Solana 형식: {destination, lamports}

//     // 기본 트랜잭션 파라미터 (공통)
//     const txParams = {
//       from: currentWallet.address,
//       to: requestData.to || requestData.recipient || requestData.destination,
//       amount: requestData.amount || requestData.value,
//       privateKey: currentWallet.privateKey,
//     };

//     // Ethereum 추가 파라미터 처리
//     if (requestData.data) {
//       txParams.data = requestData.data;
//     }
//     if (requestData.gasPrice) {
//       txParams.gasPrice = requestData.gasPrice;
//     }
//     if (requestData.gasLimit) {
//       txParams.gasLimit = requestData.gasLimit;
//     }

//     const result = await adapter.sendTransaction(txParams);

//     // 응답 데이터 구성
//     const responseData = {
//       txHash: result.hash || result.txid || result.signature, // government24 호환성을 위해 txHash 사용
//       from: currentWallet.address,
//       to: txParams.to,
//       amount: txParams.amount,
//       chainId: CoinConfig.network.chainId, // government24 호환성을 위해 chainId 사용
//       network: CoinConfig.network.networkName,
//       symbol: CoinConfig.symbol,
//       // Ethereum 추가 응답 데이터
//     };

//     // Bridge API를 통해 응답 전송
//     if (window.anam && window.anam.sendTransactionResponse) {
//       window.anam.sendTransactionResponse(
//         requestId,
//         JSON.stringify(responseData)
//       );
//       console.log("Transaction response sent:", responseData);
//     }

//     // UI 업데이트
//     setTimeout(() => {
//       updateBalance();
//       // 캐시 무효화 후 트랜잭션 다시 로드
//       localStorage.removeItem(TX_CACHE_KEY);
//       loadTransactionHistory();
//     }, 3000);
//   } catch (error) {
//     console.log("Transaction failed:", error);

//     // 에러 응답 전송
//     if (window.anam && window.anam.sendTransactionResponse) {
//       const errorResponse = {
//         error: error.message,
//         from: currentWallet.address,
//         symbol: CoinConfig.symbol,
//       };
//       window.anam.sendTransactionResponse(
//         requestId,
//         JSON.stringify(errorResponse)
//       );
//     }
//   }
// }

// // 트랜잭션 요청 처리 (기존 방식 - WebApp에서 직접 호출)
// async function handleTransactionRequest(event) {
//   console.log("Transaction request received (legacy):", event.detail);

//   // 지갑 정보 다시 로드 (BlockchainService 환경에서 실행될 때를 위해)
//   if (!currentWallet) {
//     currentWallet = WalletStorage.get();
//     if (currentWallet) {
//       try {
//         console.log("Wallet info reloaded");
//       } catch (e) {
//         console.log("Failed to load wallet:", e);
//       }
//     }
//   }

//   if (!currentWallet || !adapter) {
//     console.log("No wallet found");
//     // 에러 응답 전송
//     if (window.anam && window.anam.sendTransactionResponse) {
//       const requestId = event.detail.requestId;
//       const errorResponse = {
//         error: "No wallet found",
//         status: "error",
//       };
//       window.anam.sendTransactionResponse(
//         requestId,
//         JSON.stringify(errorResponse)
//       );
//     }
//     return;
//   }

//   const requestData = event.detail;
//   const requestId = requestData.requestId;

//   try {
//     // 트랜잭션 데이터 파싱
//     let transactionData;
//     if (typeof requestData.transactionData === "string") {
//       transactionData = JSON.parse(requestData.transactionData);
//     } else {
//       transactionData = requestData;
//     }

//     // 트랜잭션 파라미터 구성
//     const txParams = {
//       from: currentWallet.address,
//       to: transactionData.to,
//       amount: transactionData.amount || transactionData.value || "0",
//       privateKey: currentWallet.privateKey,
//     };

//     // Ethereum 추가 파라미터 처리
//     if (transactionData.data) {
//       txParams.data = transactionData.data;
//     }
//     if (transactionData.gasPrice) {
//       txParams.gasPrice = transactionData.gasPrice;
//     }
//     if (transactionData.gasLimit) {
//       txParams.gasLimit = transactionData.gasLimit;
//     }

//     console.log("Sending transaction with params:", txParams);
//     const result = await adapter.sendTransaction(txParams);

//     // 응답 데이터 구성
//     const responseData = {
//       requestId: requestId,
//       status: "success",
//       txHash: result.hash || result.txid || result.signature,
//       from: currentWallet.address,
//       to: txParams.to,
//       amount: txParams.amount,
//       chainId: CoinConfig.network.chainId,
//       network: CoinConfig.network.networkName,
//       symbol: CoinConfig.symbol,
//     };

//     // Bridge API를 통해 응답 전송
//     if (window.anam && window.anam.sendTransactionResponse) {
//       window.anam.sendTransactionResponse(
//         requestId,
//         JSON.stringify(responseData)
//       );
//       console.log("Transaction response sent:", responseData);
//     }

//     // UI 업데이트
//     setTimeout(() => {
//       updateBalance();
//       // 캐시 무효화 후 트랜잭션 다시 로드
//       localStorage.removeItem(TX_CACHE_KEY);
//       loadTransactionHistory();
//     }, 3000);
//   } catch (error) {
//     console.log("Transaction failed:", error);

//     // 에러 응답 전송
//     if (window.anam && window.anam.sendTransactionResponse) {
//       const errorResponse = {
//         requestId: requestId,
//         status: "error",
//         error: error.message,
//         from: currentWallet.address,
//         symbol: CoinConfig.symbol,
//       };
//       window.anam.sendTransactionResponse(
//         requestId,
//         JSON.stringify(errorResponse)
//       );
//     }
//   }
// }

// // QR 코드 스캔
// function scanQRCode() {
//   console.log("scanQRCode() called");

//   // anamUI API 확인 (블록체인 미니앱에서 사용)
//   if (window.anamUI && window.anamUI.scanQRCode) {
//     console.log("Using anamUI.scanQRCode API");

//     // QR 스캔 결과 이벤트 리스너 등록
//     window.addEventListener("qrScanned", handleQRScanned);

//     // QR 스캐너 호출 - 메인 프로세스에서 카메라 실행
//     window.anamUI.scanQRCode(
//       JSON.stringify({
//         title: "Scan QR Code",
//         description: "Scan Ethereum wallet address QR code",
//       })
//     );

//     console.log("QR scanner requested to main process");
//   } else {
//     console.log("anamUI.scanQRCode API not available");
//     showToast("QR scan feature is not available");
//   }
// }

// // QR 스캔 결과 처리
// function handleQRScanned(event) {
//   console.log("QR scan event received:", event);

//   // 이벤트 리스너 제거 (일회성)
//   window.removeEventListener("qrScanned", handleQRScanned);

//   if (event.detail && event.detail.success) {
//     const qrData = event.detail.data;
//     console.log("=== QR scan success ===");
//     console.log("QR data:", qrData);
//     console.log("Data length:", qrData.length);
//     console.log("Data type:", typeof qrData);

//     // Analyze QR data
//     analyzeQRData(qrData);

//     // 사용자에게 알림
//     showToast("QR scan completed");
//   } else {
//     const error = event.detail ? event.detail.error : "Unknown error";
//     console.log("QR scan failed:", error);
//     showToast("QR scan failed: " + error);
//   }
// }

// // Analyze QR data
// function analyzeQRData(data) {
//   console.log("=== QR data analysis ===");

//   // 1. Check Ethereum address format (42 characters starting with 0x)
//   if (data.startsWith("0x") && data.length === 42) {
//     console.log("Format: Ethereum address");
//     console.log("Address:", data);
//     // Navigate to Send page with address
//     navigateToSendWithAddress(data);
//     return;
//   }

//   // 2. Check Ethereum URI format (ethereum:0x...)
//   if (data.startsWith("ethereum:")) {
//     console.log("Format: Ethereum URI");
//     const parts = data.split(":");
//     if (parts.length >= 2) {
//       const address = parts[1].split("?")[0]; // Remove parameters
//       console.log("Address:", address);
//       // Navigate to Send page with address
//       navigateToSendWithAddress(address);
//     }
//     return;
//   }

//   // 3. Check private key format (64 hex characters)
//   if (/^[0-9a-fA-F]{64}$/.test(data)) {
//     console.log("Format: Private key (CAUTION: Sensitive information)");
//     // Private key is not processed automatically for security
//     showToast("Private key QR code detected");
//     return;
//   }

//   // 4. Unknown format
//   console.log("Format: Unknown");
//   console.log("Data:", data.substring(0, 50) + "...");
//   showToast("Unrecognized QR code");
// }

// // 네트워크 변경 핸들러
// function handleNetworkChange() {
//   console.log("[Index] Network changed, refreshing page data");
//   console.log("Page visibility:", document.visibilityState);
//   console.log("Is background:", document.hidden);
//   console.log("Timestamp:", new Date().toISOString());

//   // 현재 네트워크 정보 업데이트
//   const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
//   if (currentNetwork) {
//     console.log(
//       `Switched to network: ${currentNetwork.name} (Chain ID: ${currentNetwork.chainId})`
//     );
//   }

//   // 네트워크 라벨 업데이트
//   updateNetworkLabel();

//   // 지갑이 있다면 잔액과 트랜잭션 다시 로드
//   if (currentWallet && currentWallet.address) {
//     updateBalance();
//     loadTransactionHistory();
//   }

//   // 네트워크 표시 업데이트 (있다면)
//   const networkDisplay = document.querySelector(".network-indicator");
//   if (networkDisplay && currentNetwork) {
//     networkDisplay.textContent = currentNetwork.name;
//   }
// }

// // HTML onclick을 위한 전역 함수 등록
// window.createWallet = createWallet;
// window.importFromMnemonic = importFromMnemonic;
// window.navigateToSend = navigateToSend;
// window.navigateToReceive = navigateToReceive;

// // Navigate to settings
// function navigateToSettings() {
//   window.location.href = "../settings/settings.html";
// }
// window.navigateToSettings = navigateToSettings;
// window.resetWallet = resetWallet;
// window.loadTransactionHistory = loadTransactionHistory;

// // Import UI Functions
// function showImportOptions() {
//   document.querySelector(".creation-content-metamask").style.display = "none";
//   document.getElementById("import-options").style.display = "block";
// }

// function hideImportOptions() {
//   document.querySelector(".creation-content-metamask").style.display = "flex";
//   document.getElementById("import-options").style.display = "none";
//   // Clear inputs
//   document.getElementById("mnemonic-input").value = "";
//   document.getElementById("privatekey-input").value = "";
// }

// window.showImportOptions = showImportOptions;
// window.hideImportOptions = hideImportOptions;

// // 니모닉 플로우 완료 콜백
// window.onMnemonicFlowComplete = function (walletData) {
//   console.log("Mnemonic flow completed, wallet created:", walletData.address);

//   // 현재 지갑 설정
//   currentWallet = walletData;
//   updateWalletInfo(walletData);

//   // Bridge Handler 초기화
//   initBridgeHandler();

//   // 화면 전환
//   document.getElementById("wallet-creation").style.display = "none";
//   document.getElementById("wallet-main").style.display = "block";

//   // 지갑 정보 표시
//   displayWalletInfo();
//   updateBalance();

//   // 트랜잭션 로딩 표시 후 조회
//   showTransactionLoading();
//   setTimeout(() => {
//     loadTransactionHistory(true); // skipLoadingUI = true
//   }, 100);
// };

// // ================================================================
// // Universal Bridge 요청 처리 (bridge/handler.js 사용)
// // ================================================================

// // Bridge Handler 초기화 및 이벤트 리스너 등록
// function initBridgeHandler() {
//   if (window.BridgeHandler) {
//     // Handler 초기화
//     window.BridgeHandler.initHandler(currentWallet, adapter, CoinConfig);

//     // Universal Bridge 요청 이벤트 리스너
//     window.addEventListener(
//       "universalRequest",
//       window.BridgeHandler.handleUniversalRequest
//     );

//     // DApp 트랜잭션 완료 콜백
//     window.onDAppTransactionSent = (txHash) => {
//       console.log("DApp transaction sent:", txHash);
//       // UI 업데이트
//       setTimeout(() => {
//         updateBalance();
//         // 캐시 무효화 후 트랜잭션 다시 로드
//         localStorage.removeItem(TX_CACHE_KEY);
//         loadTransactionHistory();
//       }, 3000);
//     };
//     console.log("BridgeHandler initialized");
//   } else {
//     console.log("BridgeHandler not loaded");
//   }
// }

// // 지갑 정보 업데이트 시 Handler에도 알림
// function updateWalletInfo(wallet) {
//   currentWallet = wallet;
//   if (window.BridgeHandler) {
//     window.BridgeHandler.updateWallet(wallet);
//   }
// }


// function getCurrentWalletInfo() {
//   if (hdManager) {
//     const account = hdManager.getCurrentAccount();
//     if (account) {
//       const wallet = hdManager.getCurrentWallet();
//       return {
//         address: account.address,
//         privateKey: account.privateKey, // 제외 가능성.
//         mnemonic: wallet?.mnemonic,
//         accountName: account.name,
//         walletName: wallet?.name,
//         walletId: wallet?.id,
//         walletType: wallet?.type,
//         isHDWallet: wallet?.type === 'hd'
//       };
//     }
//   }
  
//   // HD Manager가 없으면 기존 방식
//   return currentWallet;
// }

// function updateCurrentWallet() {
//   currentWallet = getCurrentWalletInfo();
// }

