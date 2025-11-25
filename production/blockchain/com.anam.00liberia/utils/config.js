// ================================================================
// Liberia (Base Chain) 중앙 설정 파일
// API 키, 엔드포인트, 설정값 등을 중앙 관리
// ================================================================

(function () {
  "use strict";

  const API_KEYS = {
    ETHERSCAN: "GD4K6FTTVNF23VIICEYJ3AY3TP7RWT6PIY", // Etherscan V2 - 모든 EVM 체인 지원
    ALCHEMY: "-U_T-L6mReK8r94w4Y2_K", // Base Mainnet & Sepolia 공용
  };

  const NETWORKS = {
    mainnet: {
      name: "Base Mainnet",
      chainId: 8453,
      rpcEndpoint: `https://base-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
      explorerUrl: "https://basescan.org",
      explorerApiUrl: "https://api.basescan.org/api",
      symbol: "ETH",
      decimals: 18,
    },
    sepolia: {
      name: "Base Sepolia",
      chainId: 84532,
      rpcEndpoint: `https://base-sepolia.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
      explorerUrl: "https://sepolia.basescan.org",
      explorerApiUrl: "https://api-sepolia.basescan.org/api",
      symbol: "ETH",
      decimals: 18,
    },
  };

  // ================================================================
  // 토큰 설정 (네트워크별 컨트랙트 주소)
  // ================================================================

  const TOKENS = {
    USDC: {
      symbol: "USDC",
      name: "USD Coin",
      decimals: 6,
      addresses: {
        mainnet: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        sepolia: "0xc12975eeed6cae78c96c2e11828d6a1c4aa2866b",
      },
    },
  };

  function getTokenAddress(tokenSymbol) {
    const token = TOKENS[tokenSymbol];
    if (!token) return null;
    const networkId = getActiveNetwork();
    return token.addresses[networkId] || null;
  }

  function getTokenConfig(tokenSymbol) {
    return TOKENS[tokenSymbol] || null;
  }

  // BIP44 경로 - Base는 Ethereum과 동일한 coin type 60 사용
  const BIP44_PATH = "m/44'/60'/0'/0/0";

  // Curve 타입 - secp256k1 (Ethereum/EVM), ed25519 (Solana/Stellar 등)
  const CURVE = "secp256k1";

  // ================================================================
  // 네트워크 관리
  // ================================================================

  function getActiveNetwork() {
    const saved = localStorage.getItem("liberia_active_network");
    return saved || "sepolia";
  }

  function setActiveNetwork(networkId) {
    localStorage.setItem("liberia_active_network", networkId);
    window.dispatchEvent(new Event("networkChanged"));
  }

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    TX_CACHE_KEY: "liberia_tx_cache",
    TX_CACHE_TTL: 1 * 60 * 1000,
    BALANCE_CACHE_KEY: "liberia_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000,
    PRICE_CACHE_KEY: "liberia_price_cache",
    PRICE_CACHE_TTL: 60 * 1000,
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    DEFAULT_GAS_LIMIT: 21000,
    DEFAULT_GAS_PRICE: "0.001", // Gwei (Base is cheaper)
    MIN_AMOUNT: "0.000001",
    MAX_AMOUNT: "1000",
    CONFIRMATION_TIME: 2000, // 2초 (Base is faster)
    CONFIRMATION_BLOCKS: 1,
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 2000,
  };

  // ================================================================
  // UI 설정
  // ================================================================

  const UI_CONFIG = {
    TOAST_DURATION: 3000,
    BALANCE_REFRESH_INTERVAL: 30000,
    TX_REFRESH_INTERVAL: 60000,
    TX_PER_PAGE: 20,
    MAX_TX_DISPLAY: 100,
    ADDRESS_DISPLAY_CHARS: 4,
    ANIMATION_DURATION: 300,
  };

  // ================================================================
  // 헬퍼 함수
  // ================================================================

  function getCurrentNetwork() {
    const activeId = getActiveNetwork();
    if (NETWORKS[activeId]) {
      return NETWORKS[activeId];
    }
    return NETWORKS.sepolia;
  }

  function getExplorerApiUrl(module, action, params = {}) {
    const network = getCurrentNetwork();
    const baseUrl = network.explorerApiUrl;
    const apiKey = API_KEYS.BASESCAN;

    const queryParams = new URLSearchParams({
      module,
      action,
      apikey: apiKey,
      ...params,
    });

    return `${baseUrl}?${queryParams.toString()}`;
  }

  function getRpcEndpoint(networkName) {
    const network = NETWORKS[networkName] || getCurrentNetwork();
    return network.rpcEndpoint;
  }

  // ================================================================
  // 전역 설정 객체
  // ================================================================

  const LiberiaConfig = {
    API_KEYS,
    NETWORKS,
    TOKENS,
    BIP44_PATH,
    CURVE,

    // 토큰
    getTokenAddress,
    getTokenConfig,

    // 네트워크 관리
    getActiveNetwork,
    setActiveNetwork,

    // 캐시
    CACHE: CACHE_CONFIG,

    // 트랜잭션
    TRANSACTION: TRANSACTION_CONFIG,

    // UI
    UI: UI_CONFIG,

    // 헬퍼 함수
    getCurrentNetwork,
    getExplorerApiUrl,
    getRpcEndpoint,

    // 바로가기
    get currentNetwork() {
      return this.getCurrentNetwork();
    },
    get chainId() {
      return this.currentNetwork.chainId;
    },
    get rpcEndpoint() {
      return this.currentNetwork.rpcEndpoint;
    },
    get explorerUrl() {
      return this.currentNetwork.explorerUrl;
    },
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.LiberiaConfig = LiberiaConfig;
  // 호환성을 위해 EthereumConfig도 alias로 제공
  window.EthereumConfig = LiberiaConfig;

  console.log("[LiberiaConfig] Module loaded - Base Chain");
})();
