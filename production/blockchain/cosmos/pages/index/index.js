// ================================================================
// Cosmos2 - 메인 페이지 로직
// ================================================================

// 전역 변수
let adapter = null; // 코인 어댑터 인스턴스
let currentWallet = null; // 현재 지갑 정보
let isLoadingTransactions = false; // 트랜잭션 로딩 중복 방지 플래그

// ================================================================
// [필수 설정] Config 및 Utils 임포트
// ================================================================
// Cosmos Config 임포트
const { CACHE, getCurrentNetwork, getRpcUrl } = window.CosmosConfig || {};
const TX_CACHE_KEY = CACHE?.TX_CACHE_KEY || "cosmos_tx_cache";
const TX_CACHE_TTL = CACHE?.TX_CACHE_TTL || 5 * 60 * 1000;

// Cosmos Utils 임포트 (아직 없으면 기본 함수 사용)
const { showToast } = window.CosmosUtils || {
  showToast: (message) => {
    // 기본 toast 구현
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      z-index: 1000;
      font-size: 14px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => document.body.removeChild(toast), 3000);
  }
};

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // ================================================================
  // [필수 기능] 어댑터 초기화
  // ================================================================
  // TODO: 어댑터 초기화 로직 확인
  // app.js에서 설정한 어댑터를 가져옴
  adapter = window.getAdapter();

  if (!adapter) {
    // TODO: 에러 메시지를 블록체인명으로 변경
    console.log("Adapter not initialized");
    showToast("Failed to initialize adapter");
  }
  
  // 네트워크 변경 이벤트 리스너 (Solana2/Sui2와 동일한 패턴)
  window.addEventListener('cosmosNetworkChanged', handleNetworkChange);
  window.addEventListener('providerUpdated', handleNetworkChange); // 하위 호환성

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
    console.log('[Cosmos] Wallet decrypted and ready');
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
    const currentNetwork = window.CosmosConfig?.getCurrentNetwork();
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
    // TODO: 블록체인별 네트워크 상태 확인 로직 구현
    // 예시:
    // - Ethereum: const blockNumber = await provider.getBlockNumber();
    // - Solana: const slot = await connection.getSlot();
    // - Cosmos: const status = await client.getStatus();
    // - Sui: const checkpoint = await client.getLatestCheckpointSequenceNumber();
    
    // Cosmos 네트워크 상태 확인
    const adapter = window.getAdapter();
    if (adapter && adapter.getLatestBlock) {
      // adapter가 있으면 사용
      const block = await adapter.getLatestBlock();
      if (block && block.header) {
        console.log("Current block height:", block.header.height);
        document.getElementById("network-status").style.color = "#4cff4c";
      }
    } else {
      // 대체: Cosmos REST API 사용
      const restUrl = window.CosmosConfig?.getRestUrl();
      if (!restUrl) {
        throw new Error('API URL configuration not found');
      }

      const response = await fetch(`${restUrl}/cosmos/base/tendermint/v1beta1/blocks/latest`);
      if (response.ok) {
        const data = await response.json();
        const height = data.block?.header?.height || 'unknown';
        console.log("Current block height:", height);
        document.getElementById("network-status").style.color = "#4cff4c";
      } else {
        throw new Error('Network unreachable');
      }
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
    // TODO: 니모닉 플로우가 필요하지 않은 경우 직접 생성
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
    // TODO: 블록체인별 에러 메시지 커스터마이징
    // 예시:
    // - "Invalid mnemonic" → BIP39 체크섬 실패
    // - "library not loaded" → 번들 로드 실패
    // - "Network error" → RPC 연결 실패
    
    if (error.message && error.message.includes("Invalid mnemonic")) {
      showToast("Invalid recovery phrase. Please check that all words are correct and in the right order.", "error");
    } else if (error.message && error.message.includes("library not loaded")) {
      // TODO: 블록체인 이름으로 변경
      showToast("Library is not loaded. Please refresh the page and try again.", "error");
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
  // TODO: Utils 함수 변경
  const shortAddress = window.CosmosUtils?.shortenAddress(address) || address;
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address; // 전체 주소는 툴팁으로

  // 클릭 시 전체 주소 복사
  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = async () => {
    // TODO: Utils 함수 변경
    const success = await window.CosmosUtils?.copyToClipboard(address);
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

    // TODO: 포맷팅 함수 변경
    // 예시:
    // - Ethereum: window.EthereumUtils?.formatBalance(balance, 18)
    // - Solana: window.SolanaUtils?.formatBalance(balance, 9)
    const formattedBalance = window.CosmosUtils?.formatBalance(balance) || balance;

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
  // 이미 로딩 중이면 중복 호출 방지
  if (isLoadingTransactions) {
    console.log('[Transaction] Already loading, skipping duplicate call');
    return;
  }

  // 로딩 플래그 설정
  isLoadingTransactions = true;

  // 로딩 상태 표시 (이미 표시 중이면 스킵)
  if (!skipLoadingUI) {
    showTransactionLoading();
  }

  try {
    // Pending TX가 있으면 캐시를 무시하고 API 호출
    const hasPending = localStorage.getItem('cosmos_has_pending_tx') === 'true';
    
    if (hasPending) {
      console.log('Pending transaction exists, forcing API call');
      // API 직접 호출하여 최신 데이터 가져오기
      const transactions = await fetchTransactionHistory(currentWallet.address);
      saveTransactionCache(currentWallet.address, transactions);
      displayTransactions(transactions);
      return;
    }
    
    // Pending이 없을 때는 기존 캐시 로직 사용
    const cached = getTransactionCache();
    if (
      cached &&
      cached.address &&
      cached.transactions &&
      cached.transactions.length > 0 && // 빈 배열이 아닌 경우만 캐시 사용
      currentWallet &&
      currentWallet.address &&
      cached.address.toLowerCase() === currentWallet.address.toLowerCase()
    ) {
      console.log("Using cached transactions for:", cached.address);
      displayTransactions(cached.transactions);
      return;
    }

    // API 호출
    const transactions = await fetchTransactionHistory(currentWallet.address);

    // 캐시 저장
    saveTransactionCache(currentWallet.address, transactions);

    // UI 업데이트
    displayTransactions(transactions);
  } catch (error) {
    console.log("Failed to load transactions:", error);
    showTransactionError(error.message);
  } finally {
    // 로딩 완료 후 플래그 해제
    isLoadingTransactions = false;
  }
}

// ================================================================
// [필수 기능 4] 트랜잭션 히스토리 - API 호출
// ================================================================
async function fetchTransactionHistory(address) {
  try {
    // Cosmos 트랜잭션 조회
    const adapter = window.getAdapter();
    if (!adapter) {
      console.error('Adapter not initialized');
      return [];
    }

    // adapter의 getTransactions 메서드 사용
    const transactions = await adapter.getTransactions(address);

    // Cosmos 트랜잭션 형식으로 변환
    console.log('[Index] Formatting transactions for address:', address);

    const formattedTxs = transactions.map((tx, idx) => {
      console.log(`[Index] TX ${idx} raw data:`, {
        hash: tx.hash,
        from: tx.from_address,
        to: tx.to_address,
        amount: tx.amount,
        height: tx.height,
        code: tx.code
      });

      const isSent = tx.from_address === address;
      console.log(`[Index] TX ${idx} direction:`, {
        currentAddress: address,
        fromAddress: tx.from_address,
        isSent: isSent,
        type: isSent ? 'sent' : 'received'
      });

      return {
        txid: tx.txhash || tx.hash,
        hash: tx.txhash || tx.hash,
        timestamp: tx.timestamp || Math.floor(Date.now() / 1000),
        type: isSent ? 'sent' : 'received',
        amount: tx.amount || 0,
        from: tx.from_address || '',
        to: tx.to_address || '',
        fee: tx.fee || 0,
        status: tx.code === 0 ? 'confirmed' : 'failed',
        confirmations: tx.height ? 1 : 0,
        isPending: !tx.height
      };
    });

    console.log('[Index] Final formatted transactions:', formattedTxs);

    return formattedTxs;
  } catch (error) {
    console.error('Failed to fetch transactions:', error);
    return [];
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
    // TODO: Utils 함수 변경
    const isSent = CosmosUtils.isTransactionSent(tx, currentWallet.address);
    const txElement = createTransactionElement(tx, isSent);
    txList.appendChild(txElement);
  });
  
  // 확정된 트랜잭션 표시
  confirmedTxs.forEach((tx) => {
    // TODO: Utils 함수 변경
    const isSent = CosmosUtils.isTransactionSent(tx, currentWallet.address);
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
    
    formattedAmount = CosmosUtils.formatBalance(
      CosmosUtils.atomToUatom(tx.amount || 0)
    );
    timeAgo = CosmosUtils.getTimeAgo(tx.timestamp || Date.now() / 1000);
  } else {
    // 확정된 트랜잭션 처리
    txLabel = isSent ? "Sent" : "Received";
    
    const amountSatoshi = CosmosUtils.calculateTransactionAmount(tx, currentWallet.address);
    formattedAmount = CosmosUtils.formatBalance(amountSatoshi);
    timeAgo = CosmosUtils.getTimeAgo(tx.timestamp || Date.now() / 1000);
  }

  div.innerHTML = `
    <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
    <div class="tx-details">
      <div class="tx-type">${txLabel}${statusSuffix}</div>
      <div class="tx-address">${CosmosUtils.shortenAddress(tx.txid, 6)}</div>
    </div>
    <div class="tx-amount">
      <div class="tx-eth ${txType}">${isSent ? "-" : "+"}${formattedAmount} ATOM</div>
      <div class="tx-time">${timeAgo}</div>
    </div>
  `;

  // 클릭 시 Cosmos explorer로 이동
  div.style.cursor = "pointer";
  div.onclick = () => {
    const explorerUrl = window.CosmosConfig?.getExplorerUrl(tx.txid || tx.hash);
    if (explorerUrl) {
      window.open(explorerUrl, "_blank");
    }
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
        <!-- TODO: 코인 심볼 변경 -->
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
  // TODO: Utils 함수 변경
  const data = CosmosUtils.getCache(TX_CACHE_KEY);
  if (data && Date.now() - data.timestamp > TX_CACHE_TTL) {
    CosmosUtils.clearCache(TX_CACHE_KEY);
    return null;
  }
  return data;
}

// 트랜잭션 캐시 저장
function saveTransactionCache(address, transactions) {
  const data = {
    address: address,
    transactions: transactions,
    timestamp: Date.now(),
  };
  // TODO: Utils 함수 변경
  CosmosUtils.setCache(TX_CACHE_KEY, data, TX_CACHE_TTL);
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
  // TODO: 저장소 키 이름 변경
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
    // TODO: 저장소 키 이름 변경
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
    // Cosmos 트랜잭션 요청 처리
    // 예시:
    // - Cosmos 형식: {recipient, amount, memo}
    // - Ethereum 형식: {to, amount, data}
    // - Solana 형식: {destination, lamports}

    // 기본 트랜잭션 파라미터 (공통)
    const txParams = {
      from: currentWallet.address,
      to: requestData.to || requestData.recipient || requestData.destination,
      amount: requestData.amount || requestData.value,
      privateKey: currentWallet.privateKey,
    };

    // Cosmos 추가 파라미터 처리
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
      // Cosmos 추가 응답 데이터
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

    // Cosmos 추가 파라미터 처리
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
        // TODO: 설명 텍스트를 블록체인명으로 변경
        description: "Scan wallet address QR code",
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
  // TODO: 블록체인별 주소 형식 검증 로직 구현
  // 예시:
  // - Ethereum: /^0x[a-fA-F0-9]{40}$/
  // - Solana: Base58 형식, 32-44자
  // - Cosmos: cosmos1... (bech32 형식)
  // - Sui: 0x... (64자 hex)
  
  // Cosmos 예시: cosmos1..., cosmosvaloper1... 형식
  if (data.match(/^cosmos1[a-z0-9]{38}$/)) {
    console.log("Format: Cosmos address detected");
    console.log("Address:", data);
    // Navigate to Send page with address
    navigateToSendWithAddress(data);
    return;
  }

  // TODO: 블록체인별 URI 형식 처리
  // 예시:
  // - Ethereum: ethereum:0x...
  // - Solana: solana:...
  // - Cosmos: cosmos:...
  
  // Cosmos 예시: cosmos:...
  if (data.startsWith("cosmos:")) {
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
  const currentNetwork = window.CosmosConfig?.getCurrentNetwork();
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
// Cosmos는 Universal Bridge를 사용하지 않음
// ================================================================

// Bridge Handler 초기화 (Cosmos는 기본 트랜잭션만 지원)
function initBridgeHandler() {
  // Cosmos는 DApp 브라우저 기능이 없음
  console.log("Cosmos wallet initialized - basic transaction support only");
}

// 지갑 정보 업데이트
function updateWalletInfo(wallet) {
  currentWallet = wallet;
}

