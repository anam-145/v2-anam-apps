// Bitcoin 지갑 메인 페이지 로직

// 전역 변수
let adapter = null; // 코인 어댑터 인스턴스
let currentWallet = null; // 현재 지갑 정보

// 설정은 BitcoinConfig에서 가져옴 (utils/config.js)
const { CACHE, getCurrentNetwork, getMempoolApiUrl } = window.BitcoinConfig || {};
const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "btc_tx_cache";
const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 5 * 60 * 1000;

// Utils 함수 가져오기
const { showToast } = window.BitcoinUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // Bitcoin 어댑터 초기화
  adapter = window.getAdapter();

  if (!adapter) {
    console.log("BitcoinAdapter not initialized");
    showToast("Failed to initialize Bitcoin adapter");
  }
  
  // 네트워크 변경 이벤트 리스너
  window.addEventListener('providerUpdated', handleNetworkChange);

  // UI 테마 적용
  applyTheme();

  // 지갑 존재 여부 확인 (UI 먼저 표시)
  checkWalletStatus();

  // 네트워크 라벨 업데이트
  updateNetworkLabel();

  // 네트워크 상태는 비동기로 확인 (블로킹하지 않음)
  checkNetworkStatus();

  // 주기적으로 잔액 및 트랜잭션 업데이트 (30초마다)
  setInterval(() => {
    if (currentWallet) {
      updateBalance();
      loadTransactionHistory();
    }
  }, 30000);

  // 트랜잭션 요청 이벤트 리스너 등록 (기존 방식 지원)
  window.addEventListener("transactionRequest", handleTransactionRequest);
  window.handleTransactionRequest = handleTransactionRequest; // Bridge Handler에서 사용
  
  // Bridge Handler 초기화 (지갑이 없어도 Handler는 초기화)
  initBridgeHandler();
});

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
    const currentNetwork = window.BitcoinConfig?.getCurrentNetwork();
    if (currentNetwork) {
      // Use displayName if available, otherwise use name
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
    // Bitcoin 네트워크 상태 확인 - Mempool API 사용
    const url = window.BitcoinConfig?.getApiUrl('/blocks/tip/height');
    if (!url) {
      throw new Error('API URL configuration not found');
    }
    
    const response = await fetch(url);
    if (response.ok) {
      const blockHeight = await response.text();
      console.log("Current block height:", blockHeight);
      document.getElementById("network-status").style.color = "#4cff4c";
    } else {
      throw new Error('Network unreachable');
    }
  } catch (error) {
    console.log("Network connection failed:", error);
    document.getElementById("network-status").style.color = "#ff4444";
  }
}

// 지갑 상태 확인
async function checkWalletStatus() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);

  if (walletData) {
    // 지갑이 있으면 메인 화면 표시
    try {
      currentWallet = JSON.parse(walletData);
      
      // 새 구조 지갑인 경우 현재 네트워크 주소 사용
      if (currentWallet.networks && currentWallet.activeNetwork) {
        const activeNetwork = currentWallet.activeNetwork;
        const networkData = currentWallet.networks[activeNetwork];
        if (networkData) {
          // 하위 호환성을 위해 최상위 레벨에도 현재 네트워크 정보 저장
          currentWallet.address = networkData.address;
          currentWallet.privateKey = networkData.privateKey;
        }
      }
      
      console.log('[checkWalletStatus] Wallet loaded:', currentWallet.address);
      
      // Bridge Handler 초기화
      initBridgeHandler();

      document.getElementById("wallet-creation").style.display = "none";
      document.getElementById("wallet-main").style.display = "block";
      console.log('[checkWalletStatus] Switched to main screen');

      displayWalletInfo();

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
    console.log('[checkWalletStatus] No wallet found, showing creation screen');
    document.getElementById("wallet-creation").style.display = "block";
    document.getElementById("wallet-main").style.display = "none";
  }
}

// 새 지갑 생성 - 니모닉 플로우 시작
async function createWallet() {
  if (!adapter) {
    showToast("CoinAdapter not implemented");
    return;
  }

  try {
    console.log("Starting mnemonic flow for wallet creation");
    
    // 니모닉 플로우 시작
    if (window.mnemonicFlow) {
      window.mnemonicFlow.start();
    } else {
      console.log("Mnemonic flow not initialized");
      showToast("Failed to initialize wallet creation flow");
    }
  } catch (error) {
    console.log("Failed to start wallet creation:", error);
    showToast("Failed to start wallet creation: " + error.message);
  }
}

// 니모닉으로 지갑 가져오기
async function importFromMnemonic() {
  if (!adapter) {
    showToast("CoinAdapter not implemented");
    return;
  }

  const mnemonicInput = document.getElementById("mnemonic-input").value.trim();

  if (!mnemonicInput) {
    showToast("Please enter the mnemonic");
    return;
  }

  try {
    showToast("Importing wallet...");

    const wallet = await adapter.importFromMnemonic(mnemonicInput);

    // localStorage에 저장
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: mnemonicInput,
      createdAt: new Date().toISOString(),
    };

    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.setItem(walletKey, JSON.stringify(walletData));
    currentWallet = walletData;
    updateWalletInfo(walletData);

    showToast("Wallet imported successfully!");

    // 화면 전환
    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();

    // 트랜잭션 로딩 표시 후 조회
    showTransactionLoading();
    setTimeout(() => {
      loadTransactionHistory(true); // skipLoadingUI = true
    }, 100);
  } catch (error) {
    console.log("Failed to import wallet:", error);
    showToast("Please enter a valid mnemonic");
  }
}


// 지갑 정보 표시
function displayWalletInfo() {
  if (!currentWallet || !adapter) return;

  const address = currentWallet.address;
  const addressDisplay = document.getElementById("address-display");

  // 주소 축약 표시
  const shortAddress = window.BitcoinUtils?.shortenAddress(address) || address;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address; // 전체 주소는 툴팁으로

  // 클릭 시 전체 주소 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    const success = await window.BitcoinUtils?.copyToClipboard(address);
    if (success) {
      showToast("Address copied to clipboard");
    }
  };
}

// 잔액 업데이트
async function updateBalance() {
  if (!currentWallet || !adapter) return;

  try {
    const balance = await adapter.getBalance(currentWallet.address);

    // 디버깅 로그 추가
    console.log("Wallet address:", currentWallet.address);
    console.log("Raw balance from adapter:", balance);
    console.log("Type of balance:", typeof balance);

    const formattedBalance = window.BitcoinUtils?.formatBalance(balance) || balance;

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

  try {
    // 캐시 확인 (주소가 일치하는 경우만 사용)
    const cached = getTransactionCache();
    if (
      cached &&
      cached.address &&
      currentWallet &&
      currentWallet.address &&
      cached.address.toLowerCase() === currentWallet.address.toLowerCase()
    ) {
      console.log("Using cached transactions for:", cached.address);
      
      // 캐시된 트랜잭션에서 pending 트랜잭션 확인
      // Send에서 추가한 pending이 있을 수 있으므로 캐시를 다시 읽어서 표시
      const cacheKey = `btc_tx_${currentWallet.address}`;
      const rawCache = localStorage.getItem(cacheKey);
      if (rawCache) {
        try {
          const cacheData = JSON.parse(rawCache);
          if (cacheData.data && Array.isArray(cacheData.data)) {
            displayTransactions(cacheData.data);
            return;
          }
        } catch (e) {
          console.log("Error reading cache:", e);
        }
      }
      
      // 캐시 데이터가 유효하지 않으면 기존 cached 사용
      displayTransactions(cached.transactions);
      return;
    }

    // API 호출
    console.log("Fetching transactions from Mempool.space...");
    const transactions = await fetchTransactionHistory(currentWallet.address);

    // 캐시 저장
    saveTransactionCache(currentWallet.address, transactions);

    // UI 업데이트
    displayTransactions(transactions);
  } catch (error) {
    console.log("Failed to load transactions:", error);
    showTransactionError(error.message);
  }
}

// Mempool API로 트랜잭션 조회
async function fetchTransactionHistory(address) {
  const url = window.BitcoinConfig?.getApiUrl(`/address/${address}/txs`);
  
  if (!url) {
    throw new Error('API URL configuration not found');
  }

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Network error: ${response.status}`);
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    return [];
  }

  // API에서 가져온 트랜잭션 (최근 10개)
  const apiTransactions = data.slice(0, 10);
  
  // pending 트랜잭션 정리: API 결과에 있는 해시는 pending에서 제거
  const cacheKey = `btc_tx_${address}`;
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      if (cacheData.data && Array.isArray(cacheData.data)) {
        // API 결과의 txid 목록
        const confirmedTxids = new Set(apiTransactions.map(tx => tx.txid));
        
        // pending 트랜잭션 중 확정되지 않은 것만 유지
        const remainingPending = cacheData.data.filter(tx => 
          tx.isPending && !confirmedTxids.has(tx.txid)
        );
        
        // 14일 이상 된 pending 트랜잭션 제거 (Bitcoin mempool expiry)
        const fourteenDaysAgo = Math.floor(Date.now() / 1000) - (14 * 24 * 60 * 60);
        const validPending = remainingPending.filter(tx => 
          parseInt(tx.timestamp) > fourteenDaysAgo
        );
        
        // 캐시 업데이트: pending + API 결과
        const mergedTransactions = [...validPending, ...apiTransactions];
        cacheData.data = mergedTransactions;
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        // 병합된 결과 반환
        return mergedTransactions;
      }
    } catch (e) {
      console.log("Error processing cache:", e);
    }
  }
  
  // 캐시가 없으면 API 결과만 반환
  return apiTransactions;
}

// 트랜잭션 표시
function displayTransactions(transactions) {
  const txList = document.getElementById("tx-list");

  if (!transactions || transactions.length === 0) {
    showTransactionEmpty();
    return;
  }

  txList.innerHTML = "";

  // pending 트랜잭션과 확정된 트랜잭션 분리
  const pendingTxs = [];
  const confirmedTxs = [];
  
  transactions.forEach((tx) => {
    if (tx.isPending) {
      pendingTxs.push(tx);
    } else {
      confirmedTxs.push(tx);
    }
  });
  
  // pending 트랜잭션 먼저 표시
  pendingTxs.forEach((tx) => {
    const isSent = BitcoinUtils.isTransactionSent(tx, currentWallet.address);
    const txElement = createTransactionElement(tx, isSent);
    txList.appendChild(txElement);
  });
  
  // 확정된 트랜잭션 표시
  confirmedTxs.forEach((tx) => {
    const isSent = BitcoinUtils.isTransactionSent(tx, currentWallet.address);
    const txElement = createTransactionElement(tx, isSent);
    txList.appendChild(txElement);
  });
}

// 트랜잭션 요소 생성
function createTransactionElement(tx, isSent) {
  const div = document.createElement("div");
  div.className = "tx-item";

  const txType = isSent ? "send" : "receive";
  
  // Pending 트랜잭션 처리
  let formattedAmount;
  let timeAgo;
  let txLabel;
  let statusIcon = "";
  
  if (tx.isPending) {
    // Pending 트랜잭션 처리
    txLabel = "Pending";
    statusIcon = "⏳ ";  // pending 아이콘
    div.className += " tx-pending";  // pending 스타일 클래스 추가
    
    // Pending tx는 간단한 구조로 저장했으므로 직접 사용
    formattedAmount = BitcoinUtils.formatBalance(
      BitcoinUtils.BTCtoSatoshi(tx.amount || 0)
    );
    timeAgo = BitcoinUtils.getTimeAgo(tx.timestamp || Date.now() / 1000);
  } else {
    // 확정된 트랜잭션 처리
    txLabel = isSent ? "Sent" : "Received";
    
    // Bitcoin 트랜잭션 금액 계산
    const amountSatoshi = BitcoinUtils.calculateTransactionAmount(tx, currentWallet.address);
    formattedAmount = BitcoinUtils.formatBalance(amountSatoshi);
    timeAgo = BitcoinUtils.getTimeAgo(tx.status?.block_time || Date.now() / 1000);
  }

  div.innerHTML = `
    <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
    <div class="tx-details">
      <div class="tx-type">${statusIcon}${txLabel}</div>
      <div class="tx-address">${BitcoinUtils.shortenAddress(tx.txid, 6)}</div>
    </div>
    <div class="tx-amount">
      <div class="tx-eth ${txType}">${isSent ? "-" : "+"}${formattedAmount} BTC</div>
      <div class="tx-time">${timeAgo}</div>
    </div>
  `;

  // 클릭 시 Mempool explorer로 이동
  div.style.cursor = "pointer";
  div.onclick = () => {
    const baseUrl = window.BitcoinConfig?.explorerUrl || 'https://mempool.space';
    const explorerUrl = `${baseUrl}/tx/${tx.txid}`;
    window.open(explorerUrl, "_blank");
  };

  return div;
}

// 로딩 상태 표시
function showTransactionLoading() {
  const txList = document.getElementById("tx-list");
  txList.innerHTML = `
    <div class="tx-loading">
      <div class="tx-loading-spinner"></div>
      <div class="tx-loading-text">Loading transactions...</div>
    </div>
  `;
}

// 빈 상태 표시
function showTransactionEmpty() {
  const txList = document.getElementById("tx-list");
  txList.innerHTML = `
    <div class="tx-empty">
      <div class="tx-empty-icon">📭</div>
      <div class="tx-empty-title">No transactions yet</div>
      <div class="tx-empty-text">
        Your transaction history will appear here<br>
        once you send or receive BTC
      </div>
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
// 트랜잭션 캐시 읽기 - BitcoinUtils 사용
function getTransactionCache() {
  const data = BitcoinUtils.getCache(TX_CACHE_KEY);
  if (data && Date.now() - data.timestamp > TX_CACHE_TTL) {
    BitcoinUtils.clearCache(TX_CACHE_KEY);
    return null;
  }
  return data;
}

// 트랜잭션 캐시 저장 - BitcoinUtils 사용
function saveTransactionCache(address, transactions) {
  const data = {
    address: address,
    transactions: transactions,
    timestamp: Date.now(),
  };
  BitcoinUtils.setCache(TX_CACHE_KEY, data, TX_CACHE_TTL);
}

// Send 페이지로 이동
function navigateToSend() {
  if (!currentWallet) {
    showToast("No wallet found");
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

// QR 스캔 후 주소와 함께 Send 페이지로 이동
function navigateToSendWithAddress(address) {
  if (!currentWallet) {
    showToast("No wallet found");
    return;
  }

  console.log("Navigating to send page with address:", address);

  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    // 쿼리 파라미터로 주소 전달
    window.anamUI.navigateTo(
      `pages/send/send?address=${encodeURIComponent(address)}`
    );
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo(
      `pages/send/send?address=${encodeURIComponent(address)}`
    );
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = `../send/send.html?address=${encodeURIComponent(
      address
    )}`;
  }
}

// Receive 페이지로 이동
function navigateToReceive() {
  if (!currentWallet) {
    showToast("No wallet found");
    return;
  }
  // blockchain miniapp은 anamUI 네임스페이스 사용
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/receive/receive");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/receive/receive");
  } else {
    // 개발 환경: 일반 HTML 페이지 이동
    window.location.href = "../receive/receive.html";
  }
}

// 지갑 초기화
function resetWallet() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  localStorage.removeItem(walletKey);

  // 트랜잭션 캐시도 함께 삭제 (중요!)
  localStorage.removeItem(TX_CACHE_KEY);

  currentWallet = null;

  // 화면 전환
  document.getElementById("wallet-main").style.display = "none";
  document.getElementById("wallet-creation").style.display = "block";

  // 입력 필드 초기화
  const mnemonicInput = document.getElementById("mnemonic-input");
  const privateKeyInput = document.getElementById("privatekey-input");
  if (mnemonicInput) mnemonicInput.value = "";
  if (privateKeyInput) privateKeyInput.value = "";

  showToast("Wallet has been reset");
}

// 트랜잭션 요청 처리 (Bridge API)
async function handleTransactionRequest(event) {
  console.log("Transaction request received:", event.detail);

  // 지갑 정보 다시 로드 (BlockchainService 환경에서 실행될 때를 위해)
  if (!currentWallet) {
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    const walletData = localStorage.getItem(walletKey);
    if (walletData) {
      try {
        currentWallet = JSON.parse(walletData);
        console.log("Wallet info reloaded");
      } catch (e) {
        console.log("Failed to load wallet:", e);
      }
    }
  }

  if (!currentWallet || !adapter) {
    console.log("No wallet found");
    return;
  }

  const requestData = event.detail;
  const requestId = requestData.requestId;

  try {
    // Bitcoin 트랜잭션 요청 처리
    // 예시:
    // - Bitcoin 형식: {recipient, satoshis, memo}
    // - Ethereum 형식: {to, amount, data}
    // - Solana 형식: {destination, lamports}

    // 기본 트랜잭션 파라미터 (공통)
    const txParams = {
      from: currentWallet.address,
      to: requestData.to || requestData.recipient || requestData.destination,
      amount: requestData.amount || requestData.value,
      privateKey: currentWallet.privateKey,
    };

    // Bitcoin 추가 파라미터 처리
    if (requestData.memo) {
      txParams.memo = requestData.memo;
    }
    if (requestData.feeRate) {
      txParams.feeRate = requestData.feeRate;
    }

    const result = await adapter.sendTransaction(txParams);

    // 응답 데이터 구성
    const responseData = {
      txHash: result.hash || result.txid || result.signature, // government24 호환성을 위해 txHash 사용
      from: currentWallet.address,
      to: txParams.to,
      amount: txParams.amount,
      chainId: CoinConfig.network.chainId, // government24 호환성을 위해 chainId 사용
      network: CoinConfig.network.networkName,
      symbol: CoinConfig.symbol,
      // Bitcoin 추가 응답 데이터
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
      // 캐시 무효화 후 트랜잭션 다시 로드
      localStorage.removeItem(TX_CACHE_KEY);
      loadTransactionHistory();
    }, 3000);
  } catch (error) {
    console.log("Transaction failed:", error);

    // 에러 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      const errorResponse = {
        error: error.message,
        from: currentWallet.address,
        symbol: CoinConfig.symbol,
      };
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(errorResponse)
      );
    }
  }
}

// 트랜잭션 요청 처리 (기존 방식 - WebApp에서 직접 호출)
async function handleTransactionRequest(event) {
  console.log("Transaction request received (legacy):", event.detail);

  // 지갑 정보 다시 로드 (BlockchainService 환경에서 실행될 때를 위해)
  if (!currentWallet) {
    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    const walletData = localStorage.getItem(walletKey);
    if (walletData) {
      try {
        currentWallet = JSON.parse(walletData);
        console.log("Wallet info reloaded");
      } catch (e) {
        console.log("Failed to load wallet:", e);
      }
    }
  }

  if (!currentWallet || !adapter) {
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
      from: currentWallet.address,
      to: transactionData.to,
      amount: transactionData.amount || transactionData.value || "0",
      privateKey: currentWallet.privateKey,
    };

    // Bitcoin 추가 파라미터 처리
    if (transactionData.memo) {
      txParams.memo = transactionData.memo;
    }
    if (transactionData.feeRate) {
      txParams.feeRate = transactionData.feeRate;
    }

    console.log("Sending transaction with params:", txParams);
    const result = await adapter.sendTransaction(txParams);

    // 응답 데이터 구성
    const responseData = {
      requestId: requestId,
      status: "success",
      txHash: result.hash || result.txid || result.signature,
      from: currentWallet.address,
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
      // 캐시 무효화 후 트랜잭션 다시 로드
      localStorage.removeItem(TX_CACHE_KEY);
      loadTransactionHistory();
    }, 3000);
  } catch (error) {
    console.log("Transaction failed:", error);

    // 에러 응답 전송
    if (window.anam && window.anam.sendTransactionResponse) {
      const errorResponse = {
        requestId: requestId,
        status: "error",
        error: error.message,
        from: currentWallet.address,
        symbol: CoinConfig.symbol,
      };
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(errorResponse)
      );
    }
  }
}

// QR 코드 스캔
function scanQRCode() {
  console.log("scanQRCode() called");

  // anamUI API 확인 (블록체인 미니앱에서 사용)
  if (window.anamUI && window.anamUI.scanQRCode) {
    console.log("Using anamUI.scanQRCode API");

    // QR 스캔 결과 이벤트 리스너 등록
    window.addEventListener("qrScanned", handleQRScanned);

    // QR 스캐너 호출 - 메인 프로세스에서 카메라 실행
    window.anamUI.scanQRCode(
      JSON.stringify({
        title: "Scan QR Code",
        description: "Scan Bitcoin wallet address QR code",
      })
    );

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

  // 1. Check Bitcoin address format (Bech32: bc1/tb1, P2PKH: 1/m/n, P2SH: 3/2)
  if (data.match(/^(bc1|tb1|[13mn2])[a-zA-HJ-NP-Z0-9]{25,62}$/)) {
    console.log("Format: Bitcoin address");
    console.log("Address:", data);
    // Navigate to Send page with address
    navigateToSendWithAddress(data);
    return;
  }

  // 2. Check Bitcoin URI format (bitcoin:...)
  if (data.startsWith("bitcoin:")) {
    console.log("Format: Bitcoin URI");
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
  console.log('[Index] Network changed, refreshing page data');
  console.log('Page visibility:', document.visibilityState);
  console.log('Is background:', document.hidden);
  console.log('Timestamp:', new Date().toISOString());
  
  // 현재 네트워크 정보 업데이트
  const currentNetwork = window.BitcoinConfig?.getCurrentNetwork();
  if (currentNetwork) {
    console.log(`Switched to network: ${currentNetwork.name}`);
  }
  
  // 네트워크 라벨 업데이트
  updateNetworkLabel();
  
  // 지갑이 있다면 잔액과 트랜잭션 다시 로드
  if (currentWallet && currentWallet.address) {
    updateBalance();
    loadTransactionHistory();
  }
  
  // 네트워크 표시 업데이트 (있다면)
  const networkDisplay = document.querySelector('.network-indicator');
  if (networkDisplay && currentNetwork) {
    networkDisplay.textContent = currentNetwork.name;
  }
}

// HTML onclick을 위한 전역 함수 등록
window.createWallet = createWallet;
window.importFromMnemonic = importFromMnemonic;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;

// Navigate to settings
function navigateToSettings() {
  window.location.href = "../settings/settings.html";
}
window.navigateToSettings = navigateToSettings;
window.resetWallet = resetWallet;
window.loadTransactionHistory = loadTransactionHistory;

// Import UI Functions
function showImportOptions() {
  document.querySelector('.creation-content-metamask').style.display = 'none';
  document.getElementById('import-options').style.display = 'block';
}

function hideImportOptions() {
  document.querySelector('.creation-content-metamask').style.display = 'flex';
  document.getElementById('import-options').style.display = 'none';
  // Clear inputs
  document.getElementById('mnemonic-input').value = '';
  document.getElementById('privatekey-input').value = '';
}


window.showImportOptions = showImportOptions;
window.hideImportOptions = hideImportOptions;

// 니모닉 플로우 완료 콜백
window.onMnemonicFlowComplete = function(walletData) {
  console.log("Mnemonic flow completed, wallet created:", walletData.address);
  
  // 현재 지갑 설정
  currentWallet = walletData;
  updateWalletInfo(walletData);
  
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
    loadTransactionHistory(true); // skipLoadingUI = true
  }, 100);
};

// ================================================================
// Bitcoin은 Universal Bridge를 사용하지 않음
// ================================================================

// Bridge Handler 초기화 (Bitcoin은 기본 트랜잭션만 지원)
function initBridgeHandler() {
  // Bitcoin은 DApp 브라우저 기능이 없음
  console.log("Bitcoin wallet initialized - basic transaction support only");
}

// 지갑 정보 업데이트
function updateWalletInfo(wallet) {
  currentWallet = wallet;
}

