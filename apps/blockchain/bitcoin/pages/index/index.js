// Coin 지갑 메인 페이지 로직

// 전역 변수
let adapter = null;
let currentWallet = null;

// Utils 함수를 전역 변수로 선언 (나중에 할당)
let showToast, copyToClipboard, formatBalance, shortenAddress, shortenTxId, timeAgo, satoshiToBTC;

// DOMContentLoaded 이벤트 전에 Utils 초기화 시도
if (window.BitcoinUtils) {
  ({ showToast, copyToClipboard, formatBalance, shortenAddress, shortenTxId, timeAgo, satoshiToBTC } = window.BitcoinUtils);
}

// 페이지 초기화
document.addEventListener("DOMContentLoaded", function () {
  console.log(`${CoinConfig.name} wallet page loaded`);
  
  // Utils 함수 재초기화 (혹시 이전에 로드되지 않았을 경우)
  if (window.BitcoinUtils && !shortenAddress) {
    ({ showToast, copyToClipboard, formatBalance, shortenAddress, shortenTxId, timeAgo, satoshiToBTC } = window.BitcoinUtils);
    console.log('Utils functions loaded in DOMContentLoaded');
  }

  // Bridge API 초기화
  if (window.anam) {
    console.log("Bridge API available");
  }

  // Bitcoin 어댑터 초기화
  adapter = window.getAdapter();
  
  if (!adapter) {
    console.error(
      "BitcoinAdapter not initialized."
    );
    showToast && showToast("Bitcoin adapter initialization failed", "error");
  }

  // UI 테마 적용
  applyTheme();

  // 네트워크 상태 확인
  checkNetworkStatus();

  // 지갑 존재 여부 확인
  checkWalletStatus();

  // 주기적으로 잔액 업데이트 (30초마다)
  setInterval(() => {
    if (currentWallet) {
      updateBalance();
      loadTransactionHistory();
    }
  }, 30000);

  // 트랜잭션 요청 이벤트 리스너 등록
  window.addEventListener("transactionRequest", handleTransactionRequest);
});

// 테마 적용
function applyTheme() {
  const root = document.documentElement;
  root.style.setProperty("--coin-primary", CoinConfig.theme.primaryColor);
  root.style.setProperty("--coin-secondary", CoinConfig.theme.secondaryColor);

  document.querySelectorAll(".logo-text").forEach((el) => {
    el.textContent = CoinConfig.theme.logoText;
  });

  document.querySelectorAll(".coin-unit").forEach((el) => {
    el.textContent = CoinConfig.symbol;
  });

  // 타이틀 변경
  document.title = `${CoinConfig.name} Wallet`;
  document.querySelector(
    ".creation-title"
  ).textContent = `${CoinConfig.name} Wallet`;
  document.querySelector(
    ".creation-description"
  ).textContent = `Create a secure ${CoinConfig.name} wallet`;
}

// 네트워크 상태 확인
async function checkNetworkStatus() {
  try {
    // 네트워크 상태 확인
    document.getElementById("network-status").style.color = "#4cff4c";
  } catch (error) {
    console.error("Network connection failed:", error);
    document.getElementById("network-status").style.color = "#ff4444";
  }
}

// 지갑 상태 확인
function checkWalletStatus() {
  const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
  const walletData = localStorage.getItem(walletKey);

  if (walletData) {
    try {
      currentWallet = JSON.parse(walletData);

      document.getElementById("wallet-creation").style.display = "none";
      document.getElementById("wallet-main").style.display = "block";

      displayWalletInfo();
      updateBalance();
      loadTransactionHistory();
    } catch (error) {
      console.error("Wallet loading failed:", error);
      showToast && showToast("Wallet loading failed", "error");
      resetWallet();
    }
  } else {
    document.getElementById("wallet-creation").style.display = "block";
    document.getElementById("wallet-main").style.display = "none";
  }
}

// 새 지갑 생성
async function createWallet() {
  if (!adapter) {
    showToast && showToast("CoinAdapter not implemented", "error");
    return;
  }

  try {
    console.log("Starting new wallet creation");
    showToast && showToast("Creating wallet...", "info");

    // 어댑터를 통해 지갑 생성
    const wallet = await adapter.generateWallet();

    // localStorage에 저장
    const walletData = {
      address: wallet.address,
      privateKey: wallet.privateKey,
      mnemonic: wallet.mnemonic,
      createdAt: new Date().toISOString(),
    };

    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.setItem(walletKey, JSON.stringify(walletData));
    currentWallet = walletData;

    // 보안: 민감한 정보는 콘솔에 출력하지 않음
    console.log("Wallet created successfully");
    showToast && showToast("Wallet created successfully!", "success");

    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();
    loadTransactionHistory();
  } catch (error) {
    console.error("Wallet creation failed:", error);
    showToast && showToast("Failed to create wallet: " + error.message, "error");
  }
}

// 니모닉으로 지갑 가져오기
async function importFromMnemonic() {
  if (!adapter) {
    showToast && showToast("CoinAdapter not implemented", "error");
    return;
  }

  const mnemonicInput = document.getElementById("mnemonic-input").value.trim();

  if (!mnemonicInput) {
    showToast && showToast("Please enter mnemonic", "warning");
    return;
  }

  try {
    showToast && showToast("Importing wallet...", "info");

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

    showToast && showToast("Wallet imported successfully!", "success");

    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();
    loadTransactionHistory();
  } catch (error) {
    console.error("Wallet import failed:", error);
    showToast && showToast("Please enter valid mnemonic", "error");
  }
}

// 개인키로 지갑 가져오기
async function importFromPrivateKey() {
  if (!adapter) {
    showToast && showToast("CoinAdapter not implemented", "error");
    return;
  }

  const privateKeyInput = document
    .getElementById("privatekey-input")
    .value.trim();

  if (!privateKeyInput) {
    showToast && showToast("Please enter private key", "warning");
    return;
  }

  try {
    showToast && showToast("Importing wallet...", "info");

    const wallet = await adapter.importFromPrivateKey(privateKeyInput);

    // localStorage에 저장
    const walletData = {
      address: wallet.address,
      privateKey: privateKeyInput,
      mnemonic: null,
      createdAt: new Date().toISOString(),
    };

    const walletKey = `${CoinConfig.symbol.toLowerCase()}_wallet`;
    localStorage.setItem(walletKey, JSON.stringify(walletData));
    currentWallet = walletData;

    showToast && showToast("Wallet imported successfully!", "success");

    document.getElementById("wallet-creation").style.display = "none";
    document.getElementById("wallet-main").style.display = "block";

    displayWalletInfo();
    updateBalance();
    loadTransactionHistory();
  } catch (error) {
    console.error("Wallet import failed:", error);
    showToast && showToast("Please enter valid private key", "error");
  }
}

// 지갑 정보 표시
function displayWalletInfo() {
  if (!currentWallet || !adapter) return;

  const address = currentWallet.address;
  const addressDisplay = document.getElementById("address-display");

  // 주소 축약 표시 (BitcoinUtils 사용)
  let shortAddress;
  if (shortenAddress && typeof shortenAddress === 'function') {
    shortAddress = shortenAddress(address);
  } else if (address && typeof address === 'string') {
    shortAddress = `${address.slice(0, 6)}...${address.slice(-6)}`;
  } else {
    shortAddress = 'Invalid Address';
  }
  addressDisplay.textContent = shortAddress;
  addressDisplay.title = address || ''; // 전체 주소는 툴팁으로

  addressDisplay.style.cursor = "pointer";
  addressDisplay.onclick = () => {
    navigator.clipboard.writeText(address);
    showToast && showToast("Address copied to clipboard", "success");
  };
}

// 잔액 업데이트
async function updateBalance() {
  if (!currentWallet || !adapter) return;

  try {
    const balance = await adapter.getBalance(currentWallet.address);
    const formattedBalance = formatBalance ? 
      formatBalance(balance, CoinConfig.decimals) : 
      (parseInt(balance) / 100000000).toFixed(8);

    document.getElementById("balance-display").textContent = formattedBalance;

    // TODO: 실시간 가격 API 연동 필요
    document.getElementById("fiat-value").textContent = "";
  } catch (error) {
    // console.error("잔액 조회 실패:", error);
  }
}

// Send 페이지로 이동
function navigateToSend() {
  if (!currentWallet) {
    showToast && showToast("No wallet found", "error");
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

// Receive 페이지로 이동
function navigateToReceive() {
  if (!currentWallet) {
    showToast && showToast("No wallet found", "error");
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
  localStorage.removeItem(TX_CACHE_KEY); // 트랜잭션 캐시도 삭제
  currentWallet = null;

  document.getElementById("wallet-main").style.display = "none";
  document.getElementById("wallet-creation").style.display = "block";

  const mnemonicInput = document.getElementById("mnemonic-input");
  const privateKeyInput = document.getElementById("privatekey-input");
  if (mnemonicInput) mnemonicInput.value = "";
  if (privateKeyInput) privateKeyInput.value = "";

  showToast && showToast("Wallet has been reset", "info");
}

// 트랜잭션 요청 처리 (Bridge API)
async function handleTransactionRequest(event) {
  console.log("Transaction request received:", event.detail);

  if (!currentWallet || !adapter) {
    console.error("No wallet found");
    return;
  }

  const requestData = event.detail;
  const requestId = requestData.requestId;

  try {
    // 기본 트랜잭션 파라미터
    const txParams = {
      from: currentWallet.address,
      to: requestData.to || requestData.recipient || requestData.destination,
      amount: requestData.amount || requestData.value,
      privateKey: currentWallet.privateKey,
    };

    const result = await adapter.sendTransaction(txParams);

    const responseData = {
      hash: result.hash || result.txid || result.signature,
      from: currentWallet.address,
      to: txParams.to,
      amount: txParams.amount,
      network: CoinConfig.network.networkName,
      symbol: CoinConfig.symbol,
    };

    if (window.anam && window.anam.sendTransactionResponse) {
      window.anam.sendTransactionResponse(
        requestId,
        JSON.stringify(responseData)
      );
      console.log("Transaction response sent:", responseData);
    }

    setTimeout(updateBalance, 3000);
  } catch (error) {
    console.error("Transaction failed:", error);

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


// Navigate to settings
function navigateToSettings() {
  window.location.href = "../settings/settings.html";
}

// Transaction History Functions

// 트랜잭션 캐시 키
const TX_CACHE_KEY = `${CoinConfig.symbol.toLowerCase()}_tx_cache`;
const TX_CACHE_TTL = 5 * 60 * 1000; // 5분 (Ethereum과 동일)

// 트랜잭션 히스토리 로드
async function loadTransactionHistory() {
  if (!currentWallet) return;

  try {
    // 캐시 확인 (주소가 일치하는 경우만 사용)
    const cached = getTransactionCache();
    if (
      cached &&
      cached.address &&
      currentWallet &&
      currentWallet.address &&
      cached.address === currentWallet.address
    ) {
      console.log("Using cached transactions for:", cached.address);
      displayTransactions(cached.transactions);
      return;
    }

    // 로딩 상태 표시
    showTransactionLoading();

    // Mempool.space API 호출 (config 사용)
    const url = window.BitcoinConfig?.getApiUrl(`/address/${currentWallet.address}/txs`) || 
                `https://mempool.space/testnet4/api/address/${currentWallet.address}/txs`;
    
    console.log("Fetching transactions from:", url);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }
    
    const transactions = await response.json();
    console.log(`Loaded ${transactions.length} transactions`);
    
    // 최근 10개만 사용
    const recentTransactions = transactions.slice(0, 10);
    
    // 캐시 저장
    saveTransactionCache(currentWallet.address, recentTransactions);
    
    // 트랜잭션 표시
    displayTransactions(recentTransactions);
    
  } catch (error) {
    console.error("Failed to load transactions:", error);
    
    // 캐시된 데이터가 있으면 표시
    const cached = getTransactionCache();
    if (cached && cached.transactions) {
      displayTransactions(cached.transactions);
    } else {
      showTransactionError("Failed to load transaction history");
    }
  }
}

// 트랜잭션 표시
function displayTransactions(transactions) {
  const txList = document.getElementById("tx-list");
  
  if (!transactions || transactions.length === 0) {
    showTransactionEmpty();
    return;
  }
  
  txList.innerHTML = "";
  
  transactions.forEach((tx) => {
    const txElement = createBitcoinTransactionElement(tx);
    txList.appendChild(txElement);
  });
}

// 비트코인 트랜잭션 요소 생성
function createBitcoinTransactionElement(tx) {
  const div = document.createElement("div");
  div.className = "tx-item";
  
  // 송수신 여부 판단
  let isSent = false;
  let amount = 0;
  let address = "";
  
  // 입력 검사 (보낸 경우)
  const myInputs = tx.vin.filter(input => 
    input.prevout && input.prevout.scriptpubkey_address === currentWallet.address
  );
  
  // 출력 검사 (받은 경우)
  const myOutputs = tx.vout.filter(output => 
    output.scriptpubkey_address === currentWallet.address
  );
  
  if (myInputs.length > 0) {
    // 보낸 트랜잭션
    isSent = true;
    
    // 총 입력 금액
    const inputAmount = myInputs.reduce((sum, input) => 
      sum + (input.prevout ? input.prevout.value : 0), 0
    );
    
    // 내 주소로 돌아온 금액 (거스름돈)
    const changeAmount = myOutputs.reduce((sum, output) => 
      sum + output.value, 0
    );
    
    // 실제 보낸 금액 = 입력 - 거스름돈
    amount = inputAmount - changeAmount;
    
    // 받는 주소 찾기 (내 주소가 아닌 첫 번째 출력)
    const recipientOutput = tx.vout.find(output => 
      output.scriptpubkey_address !== currentWallet.address
    );
    address = recipientOutput ? recipientOutput.scriptpubkey_address : "Unknown";
    
  } else if (myOutputs.length > 0) {
    // 받은 트랜잭션
    isSent = false;
    amount = myOutputs.reduce((sum, output) => sum + output.value, 0);
    
    // 보낸 주소 찾기 (첫 번째 입력의 주소)
    if (tx.vin.length > 0 && tx.vin[0].prevout) {
      address = tx.vin[0].prevout.scriptpubkey_address || "Unknown";
    } else {
      address = "Unknown";
    }
  }
  
  // 사토시를 BTC로 변환
  const btcAmount = (amount / 100000000).toFixed(8);
  
  // 시간 계산
  const timeAgo = tx.status.confirmed 
    ? getTimeAgo(tx.status.block_time * 1000)
    : "Pending";
  
  const txType = isSent ? "send" : "receive";
  const txLabel = isSent ? "Sent" : "Received";
  
  div.innerHTML = `
    <div class="tx-icon ${txType}">${isSent ? "↑" : "↓"}</div>
    <div class="tx-details">
      <div class="tx-type">${txLabel}</div>
      <div class="tx-address">${shortenAddress ? shortenAddress(address, 6) : address}</div>
    </div>
    <div class="tx-amount">
      <div class="tx-btc ${txType}">${isSent ? "-" : "+"}${btcAmount} BTC</div>
      <div class="tx-time">${timeAgo}</div>
    </div>
  `;
  
  // 클릭 시 Mempool.space로 이동
  div.style.cursor = "pointer";
  div.onclick = () => {
    const network = CoinConfig.network.networkName === 'mainnet' ? '' : 'testnet4/';
    const explorerUrl = `https://mempool.space/${network}tx/${tx.txid}`;
    window.open(explorerUrl, "_blank");
  };
  
  return div;
}

// 시간 계산
function getTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return `${seconds} seconds ago`;
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days > 1 ? "s" : ""} ago`;
  
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks} week${weeks > 1 ? "s" : ""} ago`;
  
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? "s" : ""} ago`;
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
      <div class="tx-error-icon">⚠️</div>
      <div class="tx-error-title">Unable to load transactions</div>
      <div class="tx-error-text">${message}</div>
    </div>
  `;
}

// 캐시 관리 함수
function getTransactionCache() {
  try {
    const cached = localStorage.getItem(TX_CACHE_KEY);
    if (!cached) return null;

    const data = JSON.parse(cached);

    // TTL 확인
    if (Date.now() - data.timestamp > TX_CACHE_TTL) {
      localStorage.removeItem(TX_CACHE_KEY);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Cache read error:", error);
    return null;
  }
}

function saveTransactionCache(address, transactions) {
  try {
    const data = {
      address: address,
      transactions: transactions,
      timestamp: Date.now(),
    };
    localStorage.setItem(TX_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error("Cache save error:", error);
  }
}

// HTML onclick을 위한 전역 함수 등록
window.createWallet = createWallet;
window.importFromMnemonic = importFromMnemonic;
window.importFromPrivateKey = importFromPrivateKey;
window.navigateToSend = navigateToSend;
window.navigateToReceive = navigateToReceive;
window.navigateToSettings = navigateToSettings;
window.resetWallet = resetWallet;
