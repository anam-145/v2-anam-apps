// ================================================================
// Sui 메인 페이지 로직
// ================================================================

// 전역 변수
let adapter = null; // 코인 어댑터 인스턴스
let currentWallet = null; // 현재 지갑 정보
let isLoadingTransactions = false; // 트랜잭션 로딩 중복 방지 플래그

// ================================================================
// Config 및 Utils 임포트
// ================================================================
const { CACHE, getCurrentNetwork } = window.SuiConfig || {};
const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "sui_tx_cache";
const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 5 * 60 * 1000;

const { showToast } = window.SuiUtils || {};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // ================================================================
  // 어댑터 초기화
  // ================================================================
  adapter = window.getAdapter();

  if (!adapter) {
    console.log("Sui adapter not initialized");
    showToast("Failed to initialize Sui adapter");
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
  
  // Keystore 복호화 완료 이벤트 리스너
  window.addEventListener('walletReady', function() {
    console.log('[Sui] Wallet decrypted and ready');
    // 지갑 상태 다시 확인
    checkWalletStatus();
  });
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
    const currentNetwork = window.SuiConfig?.getCurrentNetwork();
    if (currentNetwork) {
      // Use displayName if available, otherwise use name
      const displayText = currentNetwork.displayName || currentNetwork.name || 'Unknown';
      networkLabel.textContent = displayText;
    } else {
      networkLabel.textContent = 'Network Error';
    }
  }
}

// ================================================================
// [필수 기능 8] Provider/네트워크 관리 - 네트워크 상태 확인
// ================================================================
async function checkNetworkStatus() {
  try {
    // Sui: RPC를 통한 체크포인트 확인
    const url = window.SuiConfig?.currentNetwork?.rpcUrl;
    if (!url) {
      throw new Error('RPC URL configuration not found');
    }
    
    // Sui는 JSON-RPC 사용
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'sui_getLatestCheckpointSequenceNumber',
        params: []
      })
    });
    
    if (response.ok) {
      const data = await response.json();
      console.log("Latest checkpoint:", data.result);
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
  
  const walletData = WalletStorage.get();

  if (walletData) {
    // 지갑이 있으면 메인 화면 표시
    try {
      // Keystore가 있는 경우 복호화 필요 확인
      if (walletData.hasKeystore && !walletData.mnemonic) {
        console.log('[checkWalletStatus] Wallet needs decryption, getting secure...');
        // 복호화 시도
        const decryptedWallet = await WalletStorage.getSecure();
        if (decryptedWallet) {
          currentWallet = decryptedWallet;
        } else {
          console.log('[checkWalletStatus] Failed to decrypt wallet');
          // 복호화 실패 시 공개 정보만 사용
          currentWallet = walletData;
        }
      } else {
        // 이미 복호화됨 또는 평문
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
    document.getElementById("wallet-creation").style.display = "block";
    document.getElementById("wallet-main").style.display = "none";
  }
}

// ================================================================
// [필수 기능 1] 니모닉 생성 - UI 플로우 시작
// ================================================================
async function createWallet() {
  if (!adapter) {
    showToast("Adapter not implemented");
    return;
  }

  try {
    console.log("Starting mnemonic flow for wallet creation");
    
    // 니모닉 플로우 시작
    // Sui는 Ed25519 키페어 사용 - 직접 생성 가능
    // 예시 (단순 생성):
    // const wallet = await adapter.generateWallet();
    // await WalletStorage.saveSecure(wallet);
    // currentWallet = wallet;
    // 화면 전환...
    
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

// ================================================================
// [필수 기능 2] 니모닉 복원 - UI에서 호출
// ================================================================
async function importFromMnemonic() {
  if (!adapter) {
    showToast("Adapter not implemented");
    return;
  }

  const mnemonicInput = document.getElementById("mnemonic-input").value.trim();

  if (!mnemonicInput) {
    showToast("Please enter the mnemonic");
    return;
  }

  try {
    showToast("Importing wallet...");

    // adapter.importFromMnemonic()는 app.js에서 구현
    const wallet = await adapter.importFromMnemonic(mnemonicInput);

    // ================================================================
    // [필수 기능 7] 키스토어 관리 - 안전한 저장
    // ================================================================
    // Keystore API로 암호화하여 저장
    await WalletStorage.saveSecure(wallet);
    
    currentWallet = wallet;
    updateWalletInfo(wallet);

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
    console.error("Failed to import wallet:", error);
    
    // ================================================================
    // [필수 기능 10] 에러 처리 패턴
    // ================================================================
    // Sui 에러 메시지 처리
    // - "Invalid mnemonic" → BIP39 체크섬 실패
    // - "library not loaded" → Sui SDK 번들 로드 실패  
    // - "Network error" → Sui RPC 연결 실패
    
    if (error.message && error.message.includes("Invalid mnemonic")) {
      showToast("Invalid recovery phrase. Please check that all words are correct and in the right order.", "error");
    } else if (error.message && error.message.includes("library not loaded")) {
      // Sui SDK 로드 실패
      showToast("Sui SDK is not loaded. Please refresh the page and try again.", "error");
    } else {
      showToast("Failed to import wallet. Please check your recovery phrase and try again.", "error");
    }
  }
}


// ================================================================
// [필수 기능 11] 주소 복사 - 클립보드
// ================================================================
function displayWalletInfo() {
  if (!currentWallet || !adapter) return;

  const address = currentWallet.address;
  const addressDisplay = document.getElementById("address-display");

  // 주소 축약 표시
  // Sui Utils 주소 축약 함수
  const shortAddress = window.SuiUtils?.shortenAddress(address) || address;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address; // 전체 주소는 툴팁으로

  // 클릭 시 전체 주소 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    // Sui Utils 클립보드 복사 함수
    const success = await window.SuiUtils?.copyToClipboard(address);
    if (success) {
      showToast("Address copied to clipboard");
    }
  };
}

// ================================================================
// [필수 기능 5] 잔액 조회 - UI 업데이트
// ================================================================
async function updateBalance() {
  if (!currentWallet || !adapter) return;

  try {
    // adapter.getBalance()는 app.js에서 구현
    const balance = await adapter.getBalance(currentWallet.address);

    const formattedBalance = window.SuiUtils?.formatBalance(balance) || balance;

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
  console.log('[loadTransactionHistory] Starting transaction history load');
  console.log('[loadTransactionHistory] skipLoadingUI:', skipLoadingUI);

  // 중복 로딩 방지
  if (isLoadingTransactions) {
    console.log('[Transaction] Already loading, skipping duplicate call');
    return;
  }

  isLoadingTransactions = true;

  // 로딩 상태 표시 (이미 표시 중이면 스킵)
  if (!skipLoadingUI) {
    showTransactionLoading();
  }

  try {
    // Pending TX가 있으면 캐시를 무시하고 API 호출
    const hasPending = localStorage.getItem('sui_has_pending_tx') === 'true';
    console.log('[loadTransactionHistory] Has pending transactions:', hasPending);
    
    if (hasPending) {
      console.log('[loadTransactionHistory] Pending transaction exists, forcing API call');
      // API 직접 호출하여 최신 데이터 가져오기
      const transactions = await fetchTransactionHistory(currentWallet.address);
      console.log('[loadTransactionHistory] Fetched transactions with pending:', transactions?.length || 0, 'transactions');
      saveTransactionCache(currentWallet.address, transactions);
      displayTransactions(transactions);
      return;
    }
    
    // Pending이 없을 때는 기존 캐시 로직 사용
    const cached = getTransactionCache();
    console.log('[loadTransactionHistory] Cache check result:', {
      hasCached: !!cached,
      cachedAddress: cached?.address,
      currentAddress: currentWallet?.address,
      cachedTxCount: cached?.transactions?.length || 0
    });

    if (
      cached &&
      cached.address &&
      currentWallet &&
      currentWallet.address &&
      cached.address.toLowerCase() === currentWallet.address.toLowerCase()
    ) {
      console.log('[loadTransactionHistory] Using cached transactions for:', cached.address);
      console.log('[loadTransactionHistory] Cached transactions:', cached.transactions?.length || 0);
      displayTransactions(cached.transactions);
      return;
    }

    // API 호출
    console.log('[loadTransactionHistory] Fetching transactions from Sui network for address:', currentWallet.address);
    const transactions = await fetchTransactionHistory(currentWallet.address);
    console.log('[loadTransactionHistory] Fetched', transactions?.length || 0, 'transactions from API');

    // 캐시 저장
    saveTransactionCache(currentWallet.address, transactions);
    console.log('[loadTransactionHistory] Saved transactions to cache');

    // UI 업데이트
    displayTransactions(transactions);
    console.log('[loadTransactionHistory] Updated UI with transactions');
  } catch (error) {
    console.error('[loadTransactionHistory] Failed to load transactions:', error);
    console.error('[loadTransactionHistory] Error stack:', error.stack);
    showTransactionError(error.message);
  } finally {
    // 로딩 플래그 해제
    isLoadingTransactions = false;
  }
}

// ================================================================
// [필수 기능 4] 트랜잭션 히스토리 - API 호출
// ================================================================
async function fetchTransactionHistory(address) {
  console.log('[fetchTransactionHistory] Starting fetch for address:', address);
  // Sui: 어댑터를 통한 트랜잭션 조회
  try {
    if (!adapter) {
      console.error('[fetchTransactionHistory] Adapter not initialized');
      throw new Error('Adapter not initialized');
    }

    console.log('[fetchTransactionHistory] Calling adapter.getTransactionHistory');
    // 어댑터의 getTransactionHistory 메서드 사용
    const data = await adapter.getTransactionHistory(address);
    console.log('[fetchTransactionHistory] Raw API response:', {
      hasData: !!data,
      dataLength: data?.length || 0,
      firstTx: data?.[0] || null
    });

    if (!data || data.length === 0) {
      console.log('[fetchTransactionHistory] No transactions found, returning empty array');
      return [];
    }

    // API에서 가져온 트랜잭션 (최근 10개)
    const apiTransactions = data.slice(0, 10);
    console.log('[fetchTransactionHistory] Sliced to', apiTransactions.length, 'transactions');
  
  // ================================================================
  // [필수 기능 9] Pending TX 관리 시스템
  // ================================================================
  // Sui pending 트랜잭션 관리
  // 1. localStorage에 pending TX 저장
  // 2. API 결과와 비교하여 확정된 TX 제거
  // 3. Sui pending 트랜잭션 만료: 7일
  // Sui는 빠른 최종성으로 인해 pending이 거의 발생하지 않음
  
  const cacheKey = `sui_tx_${address}`;
  const cached = localStorage.getItem(cacheKey);
  console.log('[fetchTransactionHistory] Cache key:', cacheKey);
  console.log('[fetchTransactionHistory] Has cached data:', !!cached);

  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      console.log('[fetchTransactionHistory] Cached data:', {
        hasData: !!cacheData.data,
        cachedLength: cacheData.data?.length || 0,
        timestamp: cacheData.timestamp
      });

      if (cacheData.data && Array.isArray(cacheData.data)) {
        // API 결과의 txid 목록
        const confirmedTxids = new Set(apiTransactions.map(tx => tx.txid));
        console.log('[fetchTransactionHistory] Confirmed txids from API:', Array.from(confirmedTxids));
        
        // pending 트랜잭션 중 확정되지 않은 것만 유지
        const remainingPending = cacheData.data.filter(tx =>
          tx.isPending && !confirmedTxids.has(tx.txid)
        );
        console.log('[fetchTransactionHistory] Remaining pending transactions:', remainingPending.length);
        
        // Sui pending 트랜잭션 만료 시간: 7일 (168시간)
        const sevenDaysAgo = Math.floor(Date.now() / 1000) - (7 * 24 * 60 * 60);
        const validPending = remainingPending.filter(tx => 
          parseInt(tx.timestamp) > sevenDaysAgo
        );
        
        // 캐시 업데이트: pending + API 결과
        const mergedTransactions = [...validPending, ...apiTransactions];
        cacheData.data = mergedTransactions;
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
        
        console.log('[fetchTransactionHistory] Merged transactions:', mergedTransactions.length);
        // 병합된 결과 반환
        return mergedTransactions;
      }
    } catch (e) {
      console.error('[fetchTransactionHistory] Error processing cache:', e);
    }
  }

  // 캐시가 없으면 API 결과만 반환
  console.log('[fetchTransactionHistory] No cache, returning API results:', apiTransactions.length, 'transactions');
  return apiTransactions;
  } catch (error) {
    console.error('[fetchTransactionHistory] Error:', error);
    console.error('[fetchTransactionHistory] Error stack:', error.stack);
    throw error;
  }
}

// ================================================================
// [필수 기능 4] 트랜잭션 히스토리 - UI 표시
// ================================================================
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
    // Sui Utils 트랜잭션 방향 판별
    const isSent = window.SuiUtils?.isTransactionSent?.(tx, currentWallet.address) || false;
    const txElement = createTransactionElement(tx, isSent);
    txList.appendChild(txElement);
  });
  
  // 확정된 트랜잭션 표시
  confirmedTxs.forEach((tx) => {
    // Sui Utils 트랜잭션 방향 판별
    const isSent = window.SuiUtils?.isTransactionSent?.(tx, currentWallet.address) || false;
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
  let statusSuffix = "";
  
  if (tx.isPending) {
    // Pending 트랜잭션 처리
    txLabel = "Pending";
    statusSuffix = "...";  // pending 표시
    div.className += " tx-pending";  // pending 스타일 클래스 추가
    
    // Sui MIST 단위 변환 (1 SUI = 10^9 MIST)
    // pending TX는 SUI 단위로 저장되어 MIST로 변환 필요
    formattedAmount = window.SuiUtils?.formatBalance?.(
      window.SuiUtils?.suiToMist?.(tx.amount || 0) || 0
    ) || '0';
    timeAgo = window.SuiUtils?.getTimeAgo?.(tx.timestamp || Date.now() / 1000) || '';
  } else {
    // 확정된 트랜잭션 처리
    txLabel = isSent ? "Sent" : "Received";
    
    // Sui 트랜잭션 금액 계산
    // Sui는 coin objects 모델을 사용하여 balance changes로 금액 계산
    const amountMist = window.SuiUtils?.calculateTransactionAmount?.(tx, currentWallet.address) || 0;
    formattedAmount = window.SuiUtils?.formatBalance?.(amountMist) || '0';
    timeAgo = window.SuiUtils?.getTimeAgo?.(tx.timestamp || Date.now() / 1000) || '';
  }

  div.innerHTML = `
    <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
    <div class="tx-details">
      <div class="tx-type">${txLabel}${statusSuffix}</div>
      <div class="tx-address">${window.SuiUtils?.shortenAddress?.(tx.txid || tx.digest, 6) || ''}</div>
    </div>
    <div class="tx-amount">
      <div class="tx-eth ${txType}">${isSent ? "-" : "+"}${formattedAmount} SUI</div>
      <div class="tx-time">${timeAgo}</div>
    </div>
  `;

  // 클릭 시 Sui explorer로 이동
  div.style.cursor = "pointer";
  div.onclick = () => {
    const baseUrl = window.SuiConfig?.explorerUrl || 'https://suiscan.xyz/testnet';
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
        <!-- Sui 코인 심볼 -->
        once you send or receive ${CoinConfig.symbol}
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

// ================================================================
// [필수 기능 12] 캐싱 시스템
// ================================================================
// 트랜잭션 캐시 읽기
function getTransactionCache() {
  console.log('[getTransactionCache] Reading cache with key:', TX_CACHE_KEY);
  // Sui 캐시 함수
  const data = window.SuiUtils?.getCache?.(TX_CACHE_KEY);

  if (data) {
    const age = Date.now() - data.timestamp;
    console.log('[getTransactionCache] Cache found, age:', age, 'ms, TTL:', TX_CACHE_TTL, 'ms');

    if (age > TX_CACHE_TTL) {
      console.log('[getTransactionCache] Cache expired, clearing');
      window.SuiUtils?.clearCache?.(TX_CACHE_KEY);
      return null;
    }

    console.log('[getTransactionCache] Returning valid cache with', data.transactions?.length || 0, 'transactions');
  } else {
    console.log('[getTransactionCache] No cache found');
  }

  return data;
}

// 트랜잭션 캐시 저장
function saveTransactionCache(address, transactions) {
  console.log('[saveTransactionCache] Saving cache for address:', address);
  console.log('[saveTransactionCache] Saving', transactions?.length || 0, 'transactions');

  const data = {
    address: address,
    transactions: transactions,
    timestamp: Date.now(),
  };

  // Sui Utils 캐싱 함수
  const result = window.SuiUtils?.setCache?.(TX_CACHE_KEY, data, TX_CACHE_TTL);
  console.log('[saveTransactionCache] Cache saved successfully, TTL:', TX_CACHE_TTL, 'ms');
}

// ================================================================
// [필수 기능 14] 페이지 네비게이션
// ================================================================
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
  // Sui 지갑 저장소 키
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

// ================================================================
// [필수 기능 - Bridge API] 외부 트랜잭션 요청 처리
// ================================================================
// NOTE: 이 기능은 DApp 브리지와 다름. 기본 트랜잭션 요청만 처리
async function handleTransactionRequest(event) {
  console.log("Transaction request received:", event.detail);

  // 지갑 정보 다시 로드 (BlockchainService 환경에서 실행될 때를 위해)
  if (!currentWallet) {
    // Sui 지갑 저장소 키
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
    // Sui 트랜잭션 요청 처리
    // 예시:
    // - Sui 형식: {recipient, amount, memo}
    // - Ethereum 형식: {to, amount, data}
    // - Solana 형식: {destination, lamports}

    // 기본 트랜잭션 파라미터 (공통)
    const txParams = {
      from: currentWallet.address,
      to: requestData.to || requestData.recipient || requestData.destination,
      amount: requestData.amount || requestData.value,
      privateKey: currentWallet.privateKey,
    };

    // Sui 추가 파라미터 처리
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
      // Sui 추가 응답 데이터
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

    // Sui 추가 파라미터 처리
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

// ================================================================
// [필수 기능 6] QR 코드 스캔
// ================================================================
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
        description: "Scan Sui wallet address QR code",
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

  // ================================================================
  // [필수 로직] QR 데이터 분석 및 주소 파싱
  // ================================================================
  // Sui 주소 형식 검증: 0x로 시작하는 64자 hex 문자열
  // 예: 0x123...abc (총 66자, 0x 포함)
  
  // Sui 주소: 0x로 시작하는 64자 hex
  if (data.match(/^0x[a-fA-F0-9]{64}$/)) {
    console.log("Format: Sui address detected");
    console.log("Address:", data);
    // Navigate to Send page with address
    navigateToSendWithAddress(data);
    return;
  }

  // Sui URI 형식: sui:address?amount=value&label=text&message=note
  // BIP-21과 유사한 형식 사용
  
  // Sui 예시: sui:...
  if (data.startsWith("sui:")) {
    console.log("Format: URI detected");
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
  const currentNetwork = window.SuiConfig?.getCurrentNetwork();
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
  // Clear inputs (check if elements exist first)
  const mnemonicInput = document.getElementById('mnemonic-input');
  if (mnemonicInput) {
    mnemonicInput.value = '';
  }
  const privatekeyInput = document.getElementById('privatekey-input');
  if (privatekeyInput) {
    privatekeyInput.value = '';
  }
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
// Sui는 Universal Bridge를 사용하지 않음
// ================================================================

// Bridge Handler 초기화 (Sui는 기본 트랜잭션만 지원)
function initBridgeHandler() {
  // Sui는 DApp 브라우저 기능이 없음
  console.log("Sui wallet initialized - basic transaction support only");
}

// 지갑 정보 업데이트
function updateWalletInfo(wallet) {
  currentWallet = wallet;
}

