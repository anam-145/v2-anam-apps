// ================================================================
// Liberia Stellar 중앙 설정 파일
// 네트워크 스위칭 지원 - deriveKey API 사용
// ================================================================

(function () {
  "use strict";

  // ================================================================
  // 네트워크 설정 (Mainnet, Testnet, Futurenet)
  // ================================================================

  const NETWORKS = {
    mainnet: {
      id: "mainnet",
      name: "mainnet",
      displayName: "Stellar Mainnet",
      horizonUrl: "https://horizon.stellar.org",
      passphrase: "Public Global Stellar Network ; September 2015",
      explorerUrl: "https://stellar.expert/explorer/public",
      friendbotUrl: null,
      symbol: "XLM",
      decimals: 7,
    },
    testnet: {
      id: "testnet",
      name: "testnet",
      displayName: "Stellar Testnet",
      horizonUrl: "https://horizon-testnet.stellar.org",
      passphrase: "Test SDF Network ; September 2015",
      explorerUrl: "https://stellar.expert/explorer/testnet",
      friendbotUrl: "https://friendbot.stellar.org",
      symbol: "XLM",
      decimals: 7,
    },
    futurenet: {
      id: "futurenet",
      name: "futurenet",
      displayName: "Stellar Futurenet",
      horizonUrl: "https://horizon-futurenet.stellar.org",
      passphrase: "Test SDF Future Network ; October 2022",
      explorerUrl: "https://stellar.expert/explorer/futurenet",
      friendbotUrl: "https://friendbot-futurenet.stellar.org",
      symbol: "XLM",
      decimals: 7,
    },
  };

  // BIP44 경로 - Stellar coin type 148
  const BIP44_PATH = "m/44'/148'/0'";

  // Curve 타입 - Stellar는 ed25519
  const CURVE = "ed25519";

  // ================================================================
  // 네트워크 관리
  // ================================================================

  // 활성 네트워크 가져오기
  function getActiveNetwork() {
    const saved = localStorage.getItem("liberia_stellar_active_network");
    return saved || "testnet"; // 기본값은 testnet
  }

  // 활성 네트워크 설정
  function setActiveNetwork(networkId) {
    if (!NETWORKS[networkId]) {
      console.error(`[LiberiaConfig] Invalid network ID: ${networkId}`);
      return false;
    }

    const previousNetwork = getActiveNetwork();
    localStorage.setItem("liberia_stellar_active_network", networkId);

    console.log(`[LiberiaConfig] Network changed: ${previousNetwork} -> ${networkId}`);

    // 캐시 클리어
    clearNetworkCache();

    // 네트워크 변경 이벤트 발생
    window.dispatchEvent(
      new CustomEvent("stellarNetworkChanged", {
        detail: { network: networkId, previous: previousNetwork },
      })
    );

    return true;
  }

  // 현재 네트워크 설정 가져오기
  function getCurrentNetwork() {
    const activeId = getActiveNetwork();
    return NETWORKS[activeId] || NETWORKS.testnet;
  }

  // Horizon URL 가져오기
  function getHorizonUrl(endpoint = "") {
    const network = getCurrentNetwork();
    return network.horizonUrl + endpoint;
  }

  // Network Passphrase 가져오기
  function getNetworkPassphrase() {
    return getCurrentNetwork().passphrase;
  }

  // Explorer URL 생성
  function getExplorerUrl(type, value) {
    const network = getCurrentNetwork();
    const baseUrl = network.explorerUrl;

    switch (type) {
      case "tx":
        return `${baseUrl}/tx/${value}`;
      case "account":
      case "address":
        return `${baseUrl}/account/${value}`;
      case "op":
        return `${baseUrl}/op/${value}`;
      default:
        return baseUrl;
    }
  }

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    TX_CACHE_KEY: "liberia_stellar_tx_cache",
    TX_CACHE_TTL: 1 * 60 * 1000,
    BALANCE_CACHE_KEY: "liberia_stellar_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000,
    PRICE_CACHE_KEY: "liberia_stellar_price_cache",
    PRICE_CACHE_TTL: 60 * 1000,
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    BASE_FEE: 100, // 100 stroops
    MIN_BALANCE: 1, // 1 XLM minimum for account activation
    MIN_AMOUNT: "0.0000001",
    MAX_AMOUNT: "1000000",
    TIMEOUT: 30,
    CONFIRMATION_TIME: 5000, // 5초
    MEMO_MAX_LENGTH: 28,
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
  // 가격 API
  // ================================================================

  function getPriceApiUrl() {
    return "https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=usd";
  }

  // ================================================================
  // 캐시 클리어
  // ================================================================

  function clearNetworkCache() {
    localStorage.removeItem(CACHE_CONFIG.TX_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.BALANCE_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.PRICE_CACHE_KEY);
    console.log("[LiberiaConfig] Network cache cleared");
  }

  // ================================================================
  // 전역 설정 객체
  // ================================================================

  const LiberiaStellarConfig = {
    NETWORKS,
    BIP44_PATH,
    CURVE,

    // 네트워크 관리
    getActiveNetwork,
    setActiveNetwork,
    getCurrentNetwork,
    getHorizonUrl,
    getNetworkPassphrase,
    getExplorerUrl,

    // 캐시
    CACHE: CACHE_CONFIG,
    clearNetworkCache,

    // 트랜잭션
    TRANSACTION: TRANSACTION_CONFIG,

    // UI
    UI: UI_CONFIG,

    // 가격 API
    getPriceApiUrl,

    // 바로가기
    get currentNetwork() {
      return this.getCurrentNetwork();
    },
    get horizonUrl() {
      return this.currentNetwork.horizonUrl;
    },
    get explorerUrl() {
      return this.currentNetwork.explorerUrl;
    },
    get networkName() {
      return this.currentNetwork.name;
    },
    get displayName() {
      return this.currentNetwork.displayName;
    },
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.LiberiaStellarConfig = LiberiaStellarConfig;
  // 호환성을 위해 LiberiaConfig도 제공
  window.LiberiaConfig = LiberiaStellarConfig;

  console.log("[LiberiaConfig] Module loaded");
  console.log("[LiberiaConfig] Active network:", LiberiaStellarConfig.getActiveNetwork());
})();
