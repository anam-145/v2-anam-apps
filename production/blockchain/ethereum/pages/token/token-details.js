// token-details.js
let adapter = null;
let currentToken = null;

// ================================================================
// 1. 초기화 & 환경 Setup
//     - handles initial page load, adapter setup, wallet retrieval, token context loading, and UI preparation.
// ================================================================

// 페이지 초기화
document.addEventListener("DOMContentLoaded", async function() {
  console.log("Token page loaded");
  
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

function getCurrentWallet() {
  // Method 1: Use WalletStorage if available
  if (typeof WalletStorage !== 'undefined' && WalletStorage?.get) {
    return WalletStorage.get();
  }

  // Method 2: Fallback to localStorage
  try {
    const walletData = localStorage.getItem('eth_wallet');
    return walletData ? JSON.parse(walletData) : null;
  } catch (e) {
    console.error("Failed to parse wallet data:", e);
    return null;
  }
}

function getPrivateKeyFromWallet(walletData) {
  if (walletData.privateKey) {
    return walletData.privateKey;
  }
  
  if (walletData.mnemonic) {
    // Derive private key from mnemonic
    const wallet = ethers.Wallet.fromMnemonic(walletData.mnemonic);
    return wallet.privateKey;
  }
  
  throw new Error("No private key or mnemonic found");
}

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
  // Basic info display
  document.getElementById('token-symbol').textContent = currentToken.symbol;
  document.getElementById('token-name').textContent = currentToken.name;
  
  // Update icon display with proper loading
  const iconContainer = document.getElementById('token-icon-display');
  iconContainer.innerHTML = `
    <img 
      id="details-token-icon"
      alt="${currentToken.symbol}"
      style="width: 80px; height: 80px; border-radius: 50%; display: none;"
      onerror="this.style.display='none'; document.getElementById('details-placeholder').style.display='flex';"
    />
    <div id="details-placeholder" style="
      width: 80px; 
      height: 80px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      font-weight: 600;
      font-size: 24px;
    ">
      ${currentToken.symbol.substring(0, 2).toUpperCase()}
    </div>
  `;
  
  // Load icon with special handling for details page
  setTimeout(() => {
    const imgEl = document.getElementById('details-token-icon');
    if (imgEl) {
      loadTokenIconForDetails(currentToken, imgEl);
    }
  }, 0);

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
  
  // Page title update
  document.title = `${currentToken.symbol} Details`;
}

// ================================================================
// 2. 토큰 정보 로드 및 Icon 관리
//    - generates and fetches token icons from external repositories (TrustWallet / AtomicLabs).
//    - handles display fallback and image loading.
// ================================================================


function getTokenIconUrl(token) {
  
  // Special case for ETH
  if (token.address === 'native' || token.symbol === 'ETH') {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
  }
  
  try {
    const checksumAddress = ethers.utils.getAddress(token.address);
    console.log("Checksum address:", checksumAddress);
    
    // const tokenMainnetAddresses = {
    //   '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Sepolia USDC -> Mainnet USDC
    // };
    
    // const iconAddress = tokenMainnetAddresses[checksumAddress] || checksumAddress;
    const iconAddress = checksumAddress;

    const trustWalletUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${ethers.utils.getAddress(iconAddress)}/logo.png`;
    
    console.log("Icon URL:", trustWalletUrl);
    return trustWalletUrl;
    
  } catch (error) {
    console.error("Error generating icon URL:", error);
    return null;
  }
}

// Only atomiclabs as fallback source
async function loadTokenIconForDetails(token, imgElement) {
  const urls = [
    getTokenIconUrl(token),
    `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons/32/color/${token.symbol.toLowerCase()}.png`,
  ].filter(url => url !== null);
  
  const placeholder = imgElement.nextElementSibling;
  
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        imgElement.src = url;
        imgElement.style.display = 'block';
        if (placeholder) placeholder.style.display = 'none';
        return;
      }
    } catch (error) {
      console.log(`Icon URL failed: ${url}`);
    }
  }
  
  imgElement.style.display = 'none';
  if (placeholder) placeholder.style.display = 'flex';
}

// ================================================================
// 3. Native Token (ETH) 처리
//     - fetches and displays ETH balance, hides irrelevant supply/percentage fields, loads ETH transaction history,
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
    
    // 트랜잭션 히스토리
    loadTransactionHistory(currentWallet.address, 'native');
    
  } catch (error) {
    console.error("Failed to load ETH details:", error);
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Failed to load token details", "error");
  }
}

// ================================================================
// 4. ERC-20 Token 처리
//     - interacts with ERC-20 smart contracts (balance, totalSupply).
//     - displays formatted results and initiates transaction history load.
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
// 5. 트랜잭션 히스토리
//     - fetches on-chain and API-based transaction data, proceses both native(ETH) and ERC-20 transfers, and builds DOM elements for the UI.
// ================================================================

async function loadTransactionHistory(address, tokenAddress) {
  const txListEl = document.getElementById('tx-list');
  
  if (tokenAddress === 'native') {
    await loadNativeTransactionHistory(address, txListEl);
  } else {
    await loadTokenTransactionHistory(address, tokenAddress, txListEl);
  }
}

async function loadNativeTransactionHistory(address, txListEl) {
  try {
    const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
    const apiUrl = currentNetwork?.blockExplorer?.apiUrl || "https://api.etherscan.io/v2/api";
    const apiKey = window.EthereumConfig?.ETHERSCAN_API_KEY || "";
    const chainid = currentNetwork?.chainId;
    
    const response = await fetch(
      `${apiUrl}?chainid=${chainid}&module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
    );
    
    const data = await response.json();
    
    if (data.status === "1" && data.result.length > 0) {
      txListEl.innerHTML = '';
      
      data.result.slice(0, 10).forEach(tx => {
        const isReceived = tx.to.toLowerCase() === address.toLowerCase();
        const txItem = createTransactionElement(tx, isReceived, 'ETH');
        txListEl.appendChild(txItem);
      });
    } else {
      displayEmptyTransactions(txListEl);
    }
  } catch (error) {
    console.error("Failed to load native transactions:", error);
    displayEmptyTransactions(txListEl);
  }
}

async function loadTokenTransactionHistory(address, tokenAddress, txListEl) {
  try {
    const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
    const apiUrl = currentNetwork?.blockExplorer?.apiUrl || "https://api.etherscan.io/v2/api";
    const apiKey = window.EthereumConfig?.ETHERSCAN_API_KEY || "";
    const chainid = currentNetwork?.chainId;
    
    const response = await fetch(
      `${apiUrl}?chainid=${chainid}&module=account&action=tokentx&contractaddress=${tokenAddress}&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`
    );
    
    const data = await response.json();

    if (data.status === "1" && data.result.length > 0) {
      txListEl.innerHTML = '';

      data.result.slice(0, 10).forEach(tx => {
        const isReceived = tx.to.toLowerCase() === address.toLowerCase();
        const txItem = createTokenTransactionElement(tx, isReceived);
        txListEl.appendChild(txItem);
      });
    } else {
      await loadTokenEventsFromChain(address, tokenAddress, txListEl);
    }
  } catch (error) {
    console.error("Failed to load token transactions:", error);
    await loadTokenEventsFromChain(address, tokenAddress, txListEl);
  }
}

async function loadTokenEventsFromChain(address, tokenAddress, txListEl) {
  try {
    // Try Etherscan API first for ERC-20 Transfer events
    const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
    const apiUrl = currentNetwork?.blockExplorer?.apiUrl || "https://api.etherscan.io/v2/api";
    const apiKey = window.EthereumConfig?.ETHERSCAN_API_KEY || "";
    const chainid = currentNetwork?.chainId;
    
    // Use Etherscan's event log API
    const url = `${apiUrl}?chainid=${chainid}&module=logs&action=getLogs&fromBlock=0&toBlock=latest&address=${tokenAddress}&topic0=0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef&apikey=${apiKey}`;
    
    console.log("Fetching token events from Etherscan:", url);
    
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === "1" && data.result && data.result.length > 0) {
      txListEl.innerHTML = '';
      
      // Filter and process Transfer events
      const relevantEvents = data.result.filter(log => {
        // Decode the topics to check if address is involved
        const from = '0x' + log.topics[1]?.slice(26);
        const to = '0x' + log.topics[2]?.slice(26);
        return from.toLowerCase() === address.toLowerCase() || 
               to.toLowerCase() === address.toLowerCase();
      });
      
      // Sort by block number (most recent first)
      relevantEvents.sort((a, b) => 
        parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16)
      );
      
      // Display events (limit to recent 50)
      for (const log of relevantEvents.slice(0, 50)) {
        const from = '0x' + log.topics[1]?.slice(26);
        const to = '0x' + log.topics[2]?.slice(26);
        const value = log.data;
        const isReceived = to.toLowerCase() === address.toLowerCase();
        
        const txItem = createEtherscanEventElement({
          transactionHash: log.transactionHash,
          from: from,
          to: to,
          value: value,
          blockNumber: parseInt(log.blockNumber, 16),
          timeStamp: parseInt(log.timeStamp, 16)
        }, isReceived);
        
        txListEl.appendChild(txItem);
      }
      
      if (relevantEvents.length === 0) {
        displayEmptyTransactions(txListEl);
      }
    } else {
      console.log("No events found via Etherscan, trying direct chain query");
      // Fallback to original chain query with 5 block limit
      await loadTokenEventsFromChainFallback(address, tokenAddress, txListEl);
    }
  } catch (error) {
    console.error("Failed to load events from Etherscan:", error);
    // Fallback to original method
    await loadTokenEventsFromChainFallback(address, tokenAddress, txListEl);
  }
}

// Fallback function (original QuickNode limited query)
async function loadTokenEventsFromChainFallback(address, tokenAddress, txListEl) {
  try {
    const contract = new ethers.Contract(
      tokenAddress,
      ["event Transfer(address indexed from, address indexed to, uint256 value)"],
      adapter.provider
    );
    
    const currentBlock = await adapter.provider.getBlockNumber();
    const fromBlock = Math.max(0, currentBlock - 4);
    
    const [incomingFilter, outgoingFilter] = [
      contract.filters.Transfer(null, address),
      contract.filters.Transfer(address, null)
    ];
    
    const [incomingEvents, outgoingEvents] = await Promise.all([
      contract.queryFilter(incomingFilter, fromBlock, currentBlock),
      contract.queryFilter(outgoingFilter, fromBlock, currentBlock)
    ]);
    
    const allEvents = [...incomingEvents, ...outgoingEvents]
      .sort((a, b) => b.blockNumber - a.blockNumber);
    
    if (allEvents.length > 0) {
      txListEl.innerHTML = '';
      
      for (const event of allEvents) {
        const block = await adapter.provider.getBlock(event.blockNumber);
        const isReceived = event.args.to.toLowerCase() === address.toLowerCase();
        const txItem = await createEventTransactionElement(event, isReceived, block.timestamp);
        txListEl.appendChild(txItem);
      }
    } else {
      displayEmptyTransactions(txListEl);
    }
  } catch (error) {
    console.error("Failed to load events from chain:", error);
    displayEmptyTransactions(txListEl);
  }
}

// Helper function to create element from Etherscan event
function createEtherscanEventElement(event, isReceived) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  
  const amount = ethers.utils.formatUnits(event.value, currentToken.decimals);
  const time = event.timeStamp ? new Date(event.timeStamp * 1000).toLocaleString() : 'Unknown';
  const otherAddress = isReceived ? event.from : event.to;
  
  const shortenFn = window.EthereumUtils?.shortenAddress || 
    (addr => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
  
  div.innerHTML = `
    <div class="tx-info">
      <div class="tx-type">${isReceived ? 'Received from' : 'Sent to'}</div>
      <div class="tx-address">${shortenFn(otherAddress)}</div>
      <div class="tx-time">${time}</div>
    </div>
    <div class="tx-amount ${isReceived ? 'received' : 'sent'}">
      ${isReceived ? '+' : '-'}${parseFloat(amount).toFixed(6)} ${currentToken.symbol}
    </div>
  `;
  
  div.onclick = () => {
    const explorerUrl = window.EthereumUtils?.getEtherscanUrl('tx', event.transactionHash) || 
      `https://sepolia.etherscan.io/tx/${event.transactionHash}`;
    window.open(explorerUrl, '_blank');
  };
  
  div.style.cursor = 'pointer';
  
  return div;
}

function createTransactionElement(tx, isReceived, symbol) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  
  const amount = ethers.utils.formatEther(tx.value);
  const time = new Date(parseInt(tx.timeStamp) * 1000).toLocaleString();
  const otherAddress = isReceived ? tx.from : tx.to;
  
  const shortenFn = window.EthereumUtils?.shortenAddress || 
    (addr => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
  
  div.innerHTML = `
    <div class="tx-info">
      <div class="tx-type">${isReceived ? 'Received from' : 'Sent to'}</div>
      <div class="tx-address">${shortenFn(otherAddress)}</div>
      <div class="tx-time">${time}</div>
    </div>
    <div class="tx-amount ${isReceived ? 'received' : 'sent'}">
      ${isReceived ? '+' : '-'}${parseFloat(amount).toFixed(6)} ${symbol}
    </div>
  `;
  
  div.onclick = () => {
    const explorerUrl = window.EthereumUtils?.getEtherscanUrl('tx', tx.hash) || 
      `https://sepolia.etherscan.io/tx/${tx.hash}`;
    window.open(explorerUrl, '_blank');
  };
  
  div.style.cursor = 'pointer';
  
  return div;
}

function createTokenTransactionElement(tx, isReceived) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  
  const amount = ethers.utils.formatUnits(tx.value, tx.tokenDecimal || currentToken.decimals);
  const time = new Date(parseInt(tx.timeStamp) * 1000).toLocaleString();
  const otherAddress = isReceived ? tx.from : tx.to;
  
  const shortenFn = window.EthereumUtils?.shortenAddress || 
    (addr => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
  
  div.innerHTML = `
    <div class="tx-info">
      <div class="tx-type">${isReceived ? 'Received from' : 'Sent to'}</div>
      <div class="tx-address">${shortenFn(otherAddress)}</div>
      <div class="tx-time">${time}</div>
    </div>
    <div class="tx-amount ${isReceived ? 'received' : 'sent'}">
      ${isReceived ? '+' : '-'}${parseFloat(amount).toFixed(6)} ${tx.tokenSymbol || currentToken.symbol}
    </div>
  `;
  
  div.onclick = () => {
    const explorerUrl = window.EthereumUtils?.getEtherscanUrl('tx', tx.hash) || 
      `https://sepolia.etherscan.io/tx/${tx.hash}`;
    window.open(explorerUrl, '_blank');
  };
  
  div.style.cursor = 'pointer';
  
  return div;
}

async function createEventTransactionElement(event, isReceived, timestamp) {
  const div = document.createElement('div');
  div.className = 'tx-item';
  
  const amount = ethers.utils.formatUnits(event.args.value, currentToken.decimals);
  const time = new Date(timestamp * 1000).toLocaleString();
  const otherAddress = isReceived ? event.args.from : event.args.to;
  
  const shortenFn = window.EthereumUtils?.shortenAddress || 
    (addr => `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`);
  
  div.innerHTML = `
    <div class="tx-info">
      <div class="tx-type">${isReceived ? 'Received from' : 'Sent to'}</div>
      <div class="tx-address">${shortenFn(otherAddress)}</div>
      <div class="tx-time">${time}</div>
    </div>
    <div class="tx-amount ${isReceived ? 'received' : 'sent'}">
      ${isReceived ? '+' : '-'}${parseFloat(amount).toFixed(6)} ${currentToken.symbol}
    </div>
  `;
  
  div.onclick = () => {
    const explorerUrl = window.EthereumUtils?.getEtherscanUrl('tx', event.transactionHash) || 
      `https://sepolia.etherscan.io/tx/${event.transactionHash}`;
    window.open(explorerUrl, '_blank');
  };
  
  div.style.cursor = 'pointer';
  
  return div;
}

function displayEmptyTransactions(txListEl) {
  txListEl.innerHTML = '<div class="empty-tx">No recent transactions</div>';
}

// ================================================================
// 6. Navigation Helper
// ================================================================

function navigate(page, fallbackFile) {
  const pageName = page.split('/').pop();

  if (window.anamUI?.navigateTo) {
    window.anamUI.navigateTo(page);
  } else if (window.anam?.navigateTo) {
    window.anam.navigateTo(page);
  } else {
    // Development environment
    window.location.href = fallbackFile || `../${pageName}/${pageName}.html`;
  }
}

// ================================================================
// 7. 액션 함수들 (User Operations)
//     - implements all user-triggered token actions: send, receive, remove, copy contract address, and navigation.
//     - includes modal setup, validation, gas estimation, transaction signing, and UI updates.
// ================================================================

// Initialize send modal when page loads
function initializeSendModal() {
  // Create modal HTML if it doesn't exist
  if (!document.getElementById('token-send-modal')) {
    const modalHTML = `
      <div id="token-send-modal" class="modal" style="display: none;">
        <div class="modal-content">
          <div class="modal-header">
            <h2>Send <span id="send-token-symbol">Token</span></h2>
            <button class="close-btn" onclick="closeSendModal()">×</button>
          </div>
          <div class="modal-body">
            <div class="form-group">
              <label>Recipient Address</label>
              <input type="text" id="send-recipient-address" placeholder="0x...">
            </div>
            <div class="form-group">
              <label>Amount</label>
              <input type="number" id="send-amount" placeholder="0.0" step="any">
              <div class="input-hint">
                Available: <span id="available-balance">0.0</span> <span id="available-symbol">TOKEN</span>
              </div>
            </div>
            <div class="form-group">
              <label>Gas Fee (estimated)</label>
              <div class="gas-estimate" id="gas-estimate">Calculating...</div>
            </div>
            <div id="send-error" class="error-message" style="display: none; color: red; margin: 10px 0;"></div>
          </div>
          <div class="modal-footer">
            <button class="secondary-btn" onclick="closeSendModal()">Cancel</button>
            <button class="primary-btn" onclick="confirmSend()" id="confirm-send-btn">Send</button>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
  }
}

// Open send modal with current token info
function sendToken() {
  initializeSendModal();
  
  const modal = document.getElementById('token-send-modal');
  const currentWallet = getCurrentWallet();
  
  if (!currentWallet) {
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("No wallet connected", "error");
    return;
  }
  
  // Update modal with current token info
  document.getElementById('send-token-symbol').textContent = currentToken.symbol;
  document.getElementById('available-symbol').textContent = currentToken.symbol;
  
  // Get current balance
  const balanceEl = document.getElementById('token-balance');
  const currentBalance = balanceEl ? balanceEl.textContent : '0';
  document.getElementById('available-balance').textContent = currentBalance;
  
  // Clear previous inputs
  document.getElementById('send-recipient-address').value = '';
  document.getElementById('send-amount').value = '';
  document.getElementById('send-error').style.display = 'none';
  document.getElementById('gas-estimate').textContent = 'Calculating...';
  
  // Show modal
  modal.style.display = 'flex';
  
  // Estimate gas
  estimateGas();
}

// Close send modal
function closeSendModal() {
  const modal = document.getElementById('token-send-modal');
  if (modal) {
    modal.style.display = 'none';
  }
}

// Estimate gas for transaction
async function estimateGas() {
  try {
    if (currentToken.address === 'native') {
      // ETH transfer gas
      const gasPrice = await adapter.provider.getGasPrice();
      const gasLimit = 21000;
      const gasCost = gasPrice.mul(gasLimit);
      const gasCostEth = ethers.utils.formatEther(gasCost);
      document.getElementById('gas-estimate').textContent = `~${parseFloat(gasCostEth).toFixed(6)} ETH`;
    } else {
      // ERC-20 transfer gas (usually higher)
      const gasPrice = await adapter.provider.getGasPrice();
      const gasLimit = 65000; // Typical ERC-20 transfer
      const gasCost = gasPrice.mul(gasLimit);
      const gasCostEth = ethers.utils.formatEther(gasCost);
      document.getElementById('gas-estimate').textContent = `~${parseFloat(gasCostEth).toFixed(6)} ETH`;
    }
  } catch (error) {
    console.error("Failed to estimate gas:", error);
    document.getElementById('gas-estimate').textContent = 'Unable to estimate';
  }
}

// Validate and confirm send
async function confirmSend() {
  const recipient = document.getElementById('send-recipient-address').value.trim();
  const amount = document.getElementById('send-amount').value.trim();
  const errorEl = document.getElementById('send-error');
  
  // Reset error
  errorEl.style.display = 'none';
  errorEl.textContent = '';
  
  // Validate recipient address
  if (!recipient) {
    errorEl.textContent = 'Please enter recipient address';
    errorEl.style.display = 'block';
    return;
  }
  
  if (!ethers.utils.isAddress(recipient)) {
    errorEl.textContent = 'Invalid recipient address';
    errorEl.style.display = 'block';
    return;
  }
  
  // Validate amount
  if (!amount || parseFloat(amount) <= 0) {
    errorEl.textContent = 'Please enter a valid amount';
    errorEl.style.display = 'block';
    return;
  }
  
  const availableBalance = parseFloat(document.getElementById('available-balance').textContent);
  if (parseFloat(amount) > availableBalance) {
    errorEl.textContent = 'Insufficient balance';
    errorEl.style.display = 'block';
    return;
  }
  
  // Disable button during transaction
  const sendBtn = document.getElementById('confirm-send-btn');
  sendBtn.disabled = true;
  sendBtn.textContent = 'Sending...';
  
  try {
    if (currentToken.address === 'native') {
      // Send ETH
      await sendNativeToken(recipient, amount);
    } else {
      // Send ERC-20 token
      await sendERC20Token(recipient, amount);
    }
  } catch (error) {
    console.error("Send failed:", error);
    errorEl.textContent = error.message || 'Transaction failed';
    errorEl.style.display = 'block';
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send';
  }
}

// Send native ETH
async function sendNativeToken(recipient, amount) {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) throw new Error("No wallet connected");
  
  try {
    // Get private key from mnemonic if needed
    const privateKey = getPrivateKeyFromWallet(currentWallet);
    
    const wallet = new ethers.Wallet(privateKey, adapter.provider);
    
    const tx = {
      to: recipient,
      value: ethers.utils.parseEther(amount.toString())
    };
    
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Sending transaction...", "info");
    
    const transaction = await wallet.sendTransaction(tx);
    showToastFn("Transaction sent! Waiting for confirmation...", "info");
    
    const receipt = await transaction.wait();
    
    if (receipt.status === 1) {
      showToastFn(`Successfully sent ${amount} ETH!`, "success");
      closeSendModal();
      loadNativeTokenDetails();
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error("Transaction error:", error);
    throw error;
  }
}

// Send ERC-20 token
async function sendERC20Token(recipient, amount) {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) throw new Error("No wallet connected");
  
  try {
    // Get private key from mnemonic if needed
    const privateKey = getPrivateKeyFromWallet(currentWallet);
    
    const wallet = new ethers.Wallet(privateKey, adapter.provider);
    
    const contract = new ethers.Contract(
      currentToken.address,
      ["function transfer(address to, uint256 amount) returns (bool)"],
      wallet
    );
    
    const parsedAmount = ethers.utils.parseUnits(amount.toString(), currentToken.decimals);
    
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Sending transaction...", "info");
    
    const tx = await contract.transfer(recipient, parsedAmount);
    showToastFn("Transaction sent! Waiting for confirmation...", "info");
    
    const receipt = await tx.wait();
    
    if (receipt.status === 1) {
      showToastFn(`Successfully sent ${amount} ${currentToken.symbol}!`, "success");
      closeSendModal();
      loadERC20TokenDetails();
    } else {
      throw new Error("Transaction failed");
    }
  } catch (error) {
    console.error("Transaction error:", error);
    throw error;
  }
}

function receiveToken() {
  navigate("pages/receive/receive", "../receive/receive.html");
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

    // Get current network to build the correct storage key
    const currentNetwork = window.EthereumConfig?.getCurrentNetwork();
    if (!currentNetwork) {
      console.error("Failed to get current network");
      return;
    }

    // localStorage에서 토큰 목록 로드 - key based on address & chainId
    const storageKey = `tokens_${currentWallet.address}_${currentNetwork.chainId}`;
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
  navigate("pages/token/token", "token.html");
}

// ================================================================
// 7. 유틸리티 함수
// ================================================================

function formatLargeNumber(num) {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
  return num.toFixed(2);
}

// ================================================================
// 8. 전역 함수 등록
//     - expose selected functions globally for UI bindings and cross-module invocation.
// ================================================================

window.goBack = goBack;
window.sendToken = sendToken;
window.receiveToken = receiveToken;
window.copyAddress = copyAddress;
window.removeToken = removeToken;
window.closeSendModal = closeSendModal;
window.confirmSend = confirmSend;