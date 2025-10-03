// token-details.js
// ================================================================
// Token Details Page Logic - Updated for current wallet system
// ================================================================

let adapter = null;
let currentToken = null;

// ================================================================
// Compatibility layer for wallet system
// ================================================================

function getCurrentWallet() {
  // Try multiple methods to get wallet data
  
  // Method 1: Check if WalletStorage exists
  if (typeof WalletStorage !== 'undefined' && WalletStorage.get) {
    return WalletStorage.get();
  }
  
  // Method 2: Direct localStorage access
  const walletData = localStorage.getItem('eth_wallet');
  if (walletData) {
    try {
      return JSON.parse(walletData);
    } catch (e) {
      console.error("Failed to parse wallet data:", e);
    }
  }
  
  return null;
}

// 페이지 초기화
document.addEventListener("DOMContentLoaded", async function() {
  console.log("Token details page loaded");
  
  // 어댑터 초기화
  adapter = window.getAdapter();
  if (!adapter) {
    console.error("EthereumAdapter not initialized");
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Failed to initialize Ethereum adapter", "error");
    return;
  }
  
  // Initialize the provider
  try {
    await adapter.initProvider();
    console.log("Provider initialized successfully");
  } catch (error) {
    console.error("Failed to initialize provider:", error);
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Failed to connect to network", "error");
    return;
  }
  
  // 선택된 토큰 정보 로드
  loadTokenDetails();
});

// ================================================================
// 1. 토큰 정보 로드 및 표시
// ================================================================

function loadTokenDetails() {
  // sessionStorage에서 선택된 토큰 정보 가져오기
  const tokenData = sessionStorage.getItem('selectedToken');
  
  if (!tokenData) {
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("No token selected", "error");
    goBack();
    return;
  }
  
  currentToken = JSON.parse(tokenData);
  console.log("Loading details for token:", currentToken);
  
  // UI 업데이트
  displayTokenInfo();
  
  // 상세 정보 로드
  if (currentToken.address === 'native') {
    loadNativeTokenDetails();
  } else {
    loadERC20TokenDetails();
    // ERC-20 토큰은 제거 가능
    document.getElementById('danger-zone').style.display = 'block';
  }
}

function displayTokenInfo() {
  // 기본 정보 표시
  document.getElementById('token-symbol').textContent = currentToken.symbol;
  document.getElementById('token-name').textContent = currentToken.name;
  document.getElementById('token-icon-display').textContent = currentToken.symbol.substring(0, 3);
  
  if (currentToken.address === 'native') {
    document.getElementById('contract-address').textContent = 'Native Token';
  } else {
    // Use EthereumUtils for shortenAddress if available
    const shortenFn = window.EthereumUtils?.shortenAddress || window.shortenAddress || 
      (addr => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
    
    document.getElementById('contract-address').textContent = shortenFn(currentToken.address);
    document.getElementById('contract-address').title = currentToken.address;
  }
  
  document.getElementById('token-decimals').textContent = currentToken.decimals;
  
  // 페이지 타이틀 업데이트
  document.title = `${currentToken.symbol} Details`;
}

// ================================================================
// 2. Native Token (ETH) 처리
// ================================================================

async function loadNativeTokenDetails() {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) return;
  
  try {
    // ETH 잔액 가져오기
    const balance = await adapter.getBalance(currentWallet.address);
    
    // Format balance properly using ethers
    const formattedBalance = ethers.utils.formatEther(balance);
    const displayBalance = parseFloat(formattedBalance).toFixed(4);
    
    document.getElementById('token-balance').textContent = displayBalance;
    
    // Total Supply는 ETH의 경우 표시하지 않음
    document.getElementById('total-supply').textContent = 'N/A';
    document.getElementById('holdings-percentage').textContent = 'N/A';
    
    // 트랜잭션 히스토리 (간단한 예시)
    loadTransactionHistory(currentWallet.address, 'native');
    
  } catch (error) {
    console.error("Failed to load ETH details:", error);
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Failed to load token details", "error");
  }
}

// ================================================================
// 3. ERC-20 Token 처리
// ================================================================

async function loadERC20TokenDetails() {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) return;
  
  try {
    // ERC-20 컨트랙트 연결
    const minABI = [
      "function balanceOf(address) view returns (uint256)",
      "function totalSupply() view returns (uint256)",
      "function decimals() view returns (uint8)"
    ];
    
    const contract = new ethers.Contract(
      currentToken.address, 
      minABI, 
      adapter.provider
    );
    
    // 병렬로 데이터 가져오기
    const [balance, totalSupply] = await Promise.all([
      contract.balanceOf(currentWallet.address),
      contract.totalSupply()
    ]);
    
    // 잔액 표시
    const formattedBalance = ethers.utils.formatUnits(balance, currentToken.decimals);
    const displayBalance = parseFloat(formattedBalance).toFixed(4);
    document.getElementById('token-balance').textContent = displayBalance;
    
    // Total Supply 표시
    const formattedSupply = ethers.utils.formatUnits(totalSupply, currentToken.decimals);
    const displaySupply = formatLargeNumber(parseFloat(formattedSupply));
    document.getElementById('total-supply').textContent = displaySupply;
    
    // 보유 비율 계산
    if (totalSupply.gt(0)) {
      const percentage = balance.mul(10000).div(totalSupply).toNumber() / 100;
      document.getElementById('holdings-percentage').textContent = `${percentage.toFixed(4)}%`;
    } else {
      document.getElementById('holdings-percentage').textContent = '0%';
    }
    
    // 트랜잭션 히스토리 로드
    loadTransactionHistory(currentWallet.address, currentToken.address);
    
  } catch (error) {
    console.error("Failed to load token details:", error);
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Failed to load token details", "error");
  }
}

// ================================================================
// 4. 트랜잭션 히스토리 (간단한 구현)
// ================================================================

async function loadTransactionHistory(address, tokenAddress) {
  const txListEl = document.getElementById('tx-list');
  
  // 실제 구현에서는 Etherscan API 또는 이벤트 로그를 사용
  // 여기서는 간단한 예시만 표시
  if (tokenAddress === 'native') {
    txListEl.innerHTML = `
      <div class="tx-item">
        <div class="tx-type">Received</div>
        <div class="tx-amount">+0.5 ETH</div>
        <div class="tx-time">2 hours ago</div>
      </div>
      <div class="tx-item">
        <div class="tx-type">Sent</div>
        <div class="tx-amount">-0.1 ETH</div>
        <div class="tx-time">1 day ago</div>
      </div>
    `;
  } else {
    // ERC-20 토큰의 경우 Transfer 이벤트를 조회
    try {
      const contract = new ethers.Contract(
        tokenAddress,
        ["event Transfer(address indexed from, address indexed to, uint256 value)"],
        adapter.provider
      );
      
      // 최근 블록에서 Transfer 이벤트 조회 (Quicknode RPC free plan: 5 blocks 조회 가능)
      const filter = contract.filters.Transfer(null, address);
      const events = await contract.queryFilter(filter, -4, 'latest');  // 이 부분 -4 -> 5 blocks 조회
      
      if (events.length > 0) {
        txListEl.innerHTML = '';
        events.slice(0, 5).forEach(event => {
          const amount = ethers.utils.formatUnits(event.args.value, currentToken.decimals);
          const txItem = document.createElement('div');
          txItem.className = 'tx-item';
          
          // Use shortenAddress function
          const shortenFn = window.EthereumUtils?.shortenAddress || window.shortenAddress || 
            (addr => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
          
          txItem.innerHTML = `
            <div class="tx-type">Received</div>
            <div class="tx-amount">+${parseFloat(amount).toFixed(4)} ${currentToken.symbol}</div>
            <div class="tx-hash">${shortenFn(event.transactionHash)}</div>
          `;
          txListEl.appendChild(txItem);
        });
      }
    } catch (error) {
      console.log("Could not load transaction history:", error);
    }
  }
}

// ================================================================
// 5. 액션 함수들
// ================================================================

function sendToken() {
  // 토큰 정보를 sessionStorage에 저장하고 send 페이지로 이동
  sessionStorage.setItem('sendingToken', JSON.stringify(currentToken));
  
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/send/send");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/send/send");
  } else {
    window.location.href = "../send/send.html";
  }
}

function receiveToken() {
  // receive 페이지로 이동 (토큰도 같은 주소 사용)
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/receive/receive");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/receive/receive");
  } else {
    window.location.href = "../receive/receive.html";
  }
}

function copyAddress() {
  if (currentToken.address === 'native') {
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Native token has no contract address", "info");
    return;
  }
  
  navigator.clipboard.writeText(currentToken.address);
  const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
  showToastFn("Contract address copied to clipboard", "success");
}

function removeToken() {
  if (!currentToken || currentToken.address === 'native') return;
  
  if (confirm(`Are you sure you want to remove ${currentToken.symbol}?`)) {
    const currentWallet = getCurrentWallet();
    if (!currentWallet) return;
    
    // localStorage에서 토큰 목록 로드 - simple key based on address
    const storageKey = `tokens_${currentWallet.address}`;
    let tokens = JSON.parse(localStorage.getItem(storageKey) || '[]');
    
    // 토큰 제거
    tokens = tokens.filter(t => t.address !== currentToken.address);
    localStorage.setItem(storageKey, JSON.stringify(tokens));
    
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn(`${currentToken.symbol} removed`, "success");
    
    // 토큰 목록 페이지로 돌아가기
    setTimeout(() => goBack(), 1000);
  }
}

function goBack() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/token/token");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/token/token");
  } else {
    window.location.href = "token.html";
  }
}

// ================================================================
// 6. 유틸리티 함수
// ================================================================

function formatLargeNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// ================================================================
// 7. 전역 함수 등록
// ================================================================

window.goBack = goBack;
window.sendToken = sendToken;
window.receiveToken = receiveToken;
window.copyAddress = copyAddress;
window.removeToken = removeToken;