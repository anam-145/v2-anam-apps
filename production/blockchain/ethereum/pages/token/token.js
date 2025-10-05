// token.js
// ================================================================
// Token List Page Logic - Updated with provider initialization
// ================================================================

let adapter = null;
let currentTokens = [];
let pendingTokenInfo = null;

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

// 페이지 초기화 - Added async and provider initialization
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
  
  // Initialize the provider - CRITICAL FIX
  try {
    await adapter.initProvider();
    console.log("Provider initialized successfully");
  } catch (error) {
    console.error("Failed to initialize provider:", error);
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Failed to connect to network", "error");
    return;
  }
  
  // UI 초기화
  initializeUI();
  
  // 토큰 목록 로드
  loadTokenList();
  
  // 이벤트 리스너 설정
  setupEventListeners();
});

// ================================================================
// 1. 초기화 함수들
// ================================================================

function initializeUI() {
  const currentWallet = getCurrentWallet();
  if (currentWallet && currentWallet.address) {
    document.getElementById('current-account').textContent = 
      window.EthereumUtils?.shortenAddress(currentWallet.address) || currentWallet.address;
    updateNativeBalance(currentWallet.address);
  }
}

async function updateNativeBalance(address) {
  try {
    // Check if adapter and provider are initialized
    if (!adapter || !adapter.provider) {
      console.error("Adapter or provider not initialized");
      return;
    }
    
    const balance = await adapter.getBalance(address);
    
    // Format the balance properly
    const formattedBalance = ethers.utils.formatEther(balance);
    // Optionally limit decimal places
    const displayBalance = parseFloat(formattedBalance).toFixed(4);
    
    document.getElementById('eth-balance').textContent = displayBalance;
  } catch (error) {
    console.error("Failed to get ETH balance:", error);
  }
}

function setupEventListeners() {
  // 토큰 주소 입력 이벤트
  const addressInput = document.getElementById('token-address-input');
  if (addressInput) {
    addressInput.addEventListener('input', debounce(handleTokenAddressInput, 500));
  }
}

// ================================================================
// 2. 토큰 목록 관리
// ================================================================

function loadTokenList() {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) return;
  
  // Simple token storage key based on address
  const storageKey = `tokens_${currentWallet.address}`;
  const savedTokens = localStorage.getItem(storageKey);
  
  if (savedTokens) {
    try {
      currentTokens = JSON.parse(savedTokens);
      displayTokenList();
      // 각 토큰의 잔액 업데이트
      updateAllTokenBalances();
    } catch (e) {
      console.error("Failed to parse saved tokens:", e);
      showEmptyState();
    }
  } else {
    // 빈 상태 표시
    showEmptyState();
  }
}

function displayTokenList() {
  const tokenListEl = document.getElementById('token-list');
  const emptyStateEl = document.getElementById('empty-state');
  
  if (currentTokens.length === 0) {
    showEmptyState();
    return;
  }
  
  emptyStateEl.style.display = 'none';
  tokenListEl.innerHTML = '';
  
  currentTokens.forEach(token => {
    const tokenItem = createTokenElement(token);
    tokenListEl.appendChild(tokenItem);
  });
}

// Add this improved function with debugging
function getTokenIconUrl(token) {
  console.log("Getting icon for token:", token.symbol, token.address);
  
  // Special case for ETH
  if (token.address === 'native' || token.symbol === 'ETH') {
    return 'https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/info/logo.png';
  }
  
  try {
    // Get checksummed address (required for Trust Wallet)
    const checksumAddress = ethers.utils.getAddress(token.address);
    console.log("Checksum address:", checksumAddress);
    
    // For Sepolia, there won't be icons in Trust Wallet
    // So let's use mainnet paths for known tokens
    const tokenMainnetAddresses = {
      // Sepolia USDC -> Mainnet USDC
      '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      // Add other known Sepolia -> Mainnet mappings
    };
    
    // Use mainnet address for icon if available
    const iconAddress = tokenMainnetAddresses[checksumAddress] || checksumAddress;
    
    // Trust Wallet URL (use ethereum chain for icons)
    const trustWalletUrl = `https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/ethereum/assets/${ethers.utils.getAddress(iconAddress)}/logo.png`;
    
    console.log("Icon URL:", trustWalletUrl);
    return trustWalletUrl;
    
  } catch (error) {
    console.error("Error generating icon URL:", error);
    // Return null to trigger placeholder
    return null;
  }
}

// Better implementation with actual fallback
async function loadTokenIcon(token, imgElement) {
  const urls = [
    getTokenIconUrl(token),
    // Try symbol-based icon services
    `https://cryptologos.cc/logos/${token.symbol.toLowerCase()}/${token.symbol.toLowerCase()}-logo.png`,
    `https://cdn.jsdelivr.net/gh/atomiclabs/cryptocurrency-icons/32/color/${token.symbol.toLowerCase()}.png`,
  ].filter(url => url !== null);
  
  // Get the placeholder element (next sibling)
  const placeholder = imgElement.nextElementSibling;
  
  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'HEAD' });
      if (response.ok) {
        // Icon found - show image, hide placeholder
        imgElement.src = url;
        imgElement.style.display = 'block';
        if (placeholder) {
          placeholder.style.display = 'none';
        }
        return;
      }
    } catch (error) {
      console.log(`Icon URL failed: ${url}`);
    }
  }
  
  // All failed, hide image and show placeholder
  imgElement.style.display = 'none';
  if (placeholder) {
    placeholder.style.display = 'flex';
  }
}

function createTokenElement(token) {
  const div = document.createElement('div');
  div.className = 'token-item';
  div.onclick = () => viewTokenDetails(token.address);
  
  // Create unique ID for this token's icon
  const iconId = `icon-${token.address}`;
  const placeholderId = `placeholder-${token.address}`;
  
  div.innerHTML = `
    <div class="token-icon">
      <img 
        id="${iconId}"
        alt="${token.symbol}"
        style="width: 40px; height: 40px; border-radius: 50%; display: none;"
        onerror="this.style.display='none'; document.getElementById('${placeholderId}').style.display='flex';"
      />
      <div id="${placeholderId}" class="token-icon-placeholder" style="
        width: 40px; 
        height: 40px; 
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: 600;
        font-size: 16px;
      ">
        ${token.symbol.substring(0, 2).toUpperCase()}
      </div>
    </div>
    <div class="token-info">
      <div class="token-symbol">${token.symbol}</div>
      <div class="token-name">${token.name}</div>
    </div>
    <div class="token-balance">
      <div class="balance-amount" id="balance-${token.address}">
        Loading...
      </div>
      <div class="balance-usd">≈ $0.00</div>
    </div>
  `;
  
  // Try to load icon after element is added to DOM
  setTimeout(() => {
    const imgEl = document.getElementById(iconId);
    if (imgEl) {
      loadTokenIcon(token, imgEl);
    }
  }, 0);
  
  return div;
}

function showEmptyState() {
  document.getElementById('token-list').innerHTML = '';
  document.getElementById('empty-state').style.display = 'block';
}

// ================================================================
// 3. 토큰 추가 기능
// ================================================================

async function handleTokenAddressInput(event) {
  const address = event.target.value.trim();
  const previewEl = document.getElementById('token-preview');
  const addBtn = document.getElementById('add-token-btn');
  
  if (!address || !ethers.utils.isAddress(address)) {
    previewEl.style.display = 'none';
    addBtn.disabled = true;
    pendingTokenInfo = null;
    return;
  }
  
  // Check if provider exists
  if (!adapter || !adapter.provider) {
    console.error("Provider not initialized");
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Network connection not ready", "error");
    return;
  }
  
  try {
    console.log("Attempting to load token at:", address);
    const network = await adapter.provider.getNetwork();
    console.log("Current network:", network);
    
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Loading token information...", "info");
    
    // ERC-20 토큰 정보 가져오기
    const tokenInfo = await getTokenInfo(address);
    
    // 미리보기 표시
    document.getElementById('preview-symbol').textContent = tokenInfo.symbol;
    document.getElementById('preview-name').textContent = tokenInfo.name;
    document.getElementById('preview-decimals').textContent = tokenInfo.decimals;
    
    previewEl.style.display = 'block';
    addBtn.disabled = false;
    pendingTokenInfo = tokenInfo;
    
  } catch (error) {
    console.error("Detailed error:", error);
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    
    // More specific error messages
    if (error.code === 'CALL_EXCEPTION') {
      showToastFn("Token not found on this network", "error");
    } else {
      showToastFn("Invalid token contract address", "error");
    }
    
    previewEl.style.display = 'none';
    addBtn.disabled = true;
    pendingTokenInfo = null;
  }
}

async function getTokenInfo(address) {
  // Check provider before making contract calls
  if (!adapter || !adapter.provider) {
    throw new Error("Provider not initialized");
  }
  
  // 최소 ERC-20 ABI
  const minABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)"
  ];
  
  const contract = new ethers.Contract(address, minABI, adapter.provider);
  
  const [name, symbol, decimals, totalSupply] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
    contract.totalSupply()
  ]);
  
  return {
    address: address,
    name: name,
    symbol: symbol,
    decimals: decimals,
    totalSupply: totalSupply.toString()
  };
}

async function addToken() {
  if (!pendingTokenInfo) return;
  
  const currentWallet = getCurrentWallet();
  if (!currentWallet) {
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("No wallet selected", "error");
    return;
  }
  
  // 중복 체크
  if (currentTokens.find(t => t.address.toLowerCase() === pendingTokenInfo.address.toLowerCase())) {
    const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
    showToastFn("Token already added", "warning");
    closeAddTokenModal();
    return;
  }
  
  // 토큰 추가
  currentTokens.push(pendingTokenInfo);
  
  // 저장 - simple key based on address
  const storageKey = `tokens_${currentWallet.address}`;
  localStorage.setItem(storageKey, JSON.stringify(currentTokens));
  
  const showToastFn = window.showToast || window.EthereumUtils?.showToast || console.log;
  showToastFn(`${pendingTokenInfo.symbol} added successfully`, "success");
  
  // UI 업데이트
  displayTokenList();
  updateTokenBalance(pendingTokenInfo.address);
  
  // 모달 닫기
  closeAddTokenModal();
}

// ================================================================
// 4. 토큰 잔액 업데이트
// ================================================================

async function updateAllTokenBalances() {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) return;
  
  // Check if provider is initialized
  if (!adapter || !adapter.provider) {
    console.log("Provider not ready, skipping balance update");
    return;
  }
  
  for (const token of currentTokens) {
    updateTokenBalance(token.address);
  }
}

async function updateTokenBalance(tokenAddress) {
  const currentWallet = getCurrentWallet();
  if (!currentWallet) return;
  
  // Check if provider is initialized
  if (!adapter || !adapter.provider) {
    return;
  }
  
  try {
    const minABI = ["function balanceOf(address) view returns (uint256)"];
    const contract = new ethers.Contract(tokenAddress, minABI, adapter.provider);
    
    const balance = await contract.balanceOf(currentWallet.address);
    const token = currentTokens.find(t => t.address === tokenAddress);
    
    if (token) {
      const formattedBalance = ethers.utils.formatUnits(balance, token.decimals);
      const displayBalance = parseFloat(formattedBalance).toFixed(4);
      
      const balanceEl = document.getElementById(`balance-${tokenAddress}`);
      if (balanceEl) {
        balanceEl.textContent = displayBalance;
      }
    }
  } catch (error) {
    console.error(`Failed to get balance for ${tokenAddress}:`, error);
  }
}

// ================================================================
// 5. 네비게이션 및 모달
// ================================================================

function viewTokenDetails(tokenAddress) {
  // 토큰 정보를 sessionStorage에 저장
  if (tokenAddress === 'native') {
    sessionStorage.setItem('selectedToken', JSON.stringify({
      address: 'native',
      symbol: 'ETH',
      name: 'Ethereum',
      decimals: 18
    }));
  } else {
    const token = currentTokens.find(t => t.address === tokenAddress);
    if (token) {
      sessionStorage.setItem('selectedToken', JSON.stringify(token));
    }
  }
  
  // 상세 페이지로 이동
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/token/token-details");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/token/token-details");
  } else {
    window.location.href = "token-details.html";
  }
}

function showAddTokenModal() {
  document.getElementById('add-token-modal').style.display = 'flex';
  // 입력 필드 초기화
  document.getElementById('token-address-input').value = '';
  document.getElementById('token-preview').style.display = 'none';
  document.getElementById('add-token-btn').disabled = true;
  pendingTokenInfo = null;
}

function closeAddTokenModal() {
  document.getElementById('add-token-modal').style.display = 'none';
}

function goBack() {
  if (window.anamUI && window.anamUI.navigateTo) {
    window.anamUI.navigateTo("pages/index/index");
  } else if (window.anam && window.anam.navigateTo) {
    window.anam.navigateTo("pages/index/index");
  } else {
    window.location.href = "../index/index.html";
  }
}

// ================================================================
// 6. 유틸리티 함수
// ================================================================

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func.apply(this, args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ================================================================
// 7. 전역 함수 등록
// ================================================================

window.goBack = goBack;
window.showAddTokenModal = showAddTokenModal;
window.closeAddTokenModal = closeAddTokenModal;
window.addToken = addToken;
window.viewTokenDetails = viewTokenDetails;