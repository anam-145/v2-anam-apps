// ================================================================
// Ethereum 중앙 설정 파일
// API 키, 엔드포인트, 설정값 등을 중앙 관리
// ================================================================

(function () {
  "use strict";

  const API_KEYS = {
    ETHERSCAN: "ADGVUU56AP4I5HMIWN118Z8WPUNPZHF5QT",
    ALCHEMY: "KTCeB6pisOdbnHN7ercbQ",
  };

  const NETWORKS = {
    mainnet: {
      name: "mainnet",
      chainId: 1,
      rpcEndpoint: `https://eth-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
      etherscanUrl: "https://etherscan.io",
      etherscanApiUrl: "https://api.etherscan.io/v2/api",
    },
    sepolia: {
      name: "sepolia",
      chainId: 11155111,
      rpcEndpoint: `https://eth-sepolia.g.alchemy.com/v2/${API_KEYS.ALCHEMY}`,
      etherscanUrl: "https://sepolia.etherscan.io",
      etherscanApiUrl: "https://api.etherscan.io/v2/api", // V2는 모든 체인을 하나의 엔드포인트에서 처리
    },
  };

  // ================================================================
  // 네트워크 관리
  // ================================================================

  // 활성 네트워크 가져오기 (동적)
  function getActiveNetwork() {
    const saved = localStorage.getItem("eth_active_network");
    return saved || "mainnet"; // 기본값: mainnet (DApp 호환성)
  }

  // 활성 네트워크 설정
  function setActiveNetwork(networkId) {
    localStorage.setItem("eth_active_network", networkId);

    // 네트워크 변경 이벤트 발생
    window.dispatchEvent(new Event("networkChanged"));
  }

  // 커스텀 네트워크 가져오기
  function getCustomNetworks() {
    try {
      return JSON.parse(localStorage.getItem("eth_custom_networks") || "[]");
    } catch (error) {
      console.log("Failed to load custom networks:", error);
      return [];
    }
  }

  // 커스텀 네트워크 추가
  function addCustomNetwork(networkConfig) {
    const customNetworks = getCustomNetworks();
    const newNetwork = {
      id: `custom_${Date.now()}`,
      ...networkConfig,
    };
    customNetworks.push(newNetwork);
    localStorage.setItem("eth_custom_networks", JSON.stringify(customNetworks));
    return newNetwork.id;
  }

  // 커스텀 네트워크 삭제
  function removeCustomNetwork(networkId) {
    const customNetworks = getCustomNetworks();
    const filtered = customNetworks.filter((n) => n.id !== networkId);
    localStorage.setItem("eth_custom_networks", JSON.stringify(filtered));
  }

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    // 트랜잭션 캐시
    TX_CACHE_KEY: "eth_tx_cache",
    TX_CACHE_TTL: 1 * 60 * 1000, // 1분

    // 잔액 캐시
    BALANCE_CACHE_KEY: "eth_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000, // 30초

    // 가격 캐시
    PRICE_CACHE_KEY: "eth_price_cache",
    PRICE_CACHE_TTL: 60 * 1000, // 1분
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    // 기본 가스 설정
    DEFAULT_GAS_LIMIT: 21000,
    DEFAULT_GAS_PRICE: "20", // Gwei

    // 트랜잭션 한도
    MIN_AMOUNT: "0.000001",
    MAX_AMOUNT: "1000",

    // 확인 설정
    CONFIRMATION_TIME: 15000, // 15초
    CONFIRMATION_BLOCKS: 12,

    // 재시도 설정
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 3000, // 3초
  };

  // ================================================================
  // UI 설정
  // ================================================================

  const UI_CONFIG = {
    // 토스트 메시지
    TOAST_DURATION: 3000, // 3초

    // 새로고침 간격
    BALANCE_REFRESH_INTERVAL: 30000, // 30초
    TX_REFRESH_INTERVAL: 60000, // 60초

    // 페이지네이션
    TX_PER_PAGE: 20,
    MAX_TX_DISPLAY: 100,

    // 주소 표시
    ADDRESS_DISPLAY_CHARS: 4,

    // 애니메이션
    ANIMATION_DURATION: 300, // ms
  };

  // ================================================================
  // 헬퍼 함수
  // ================================================================

  // 현재 네트워크 설정 가져오기
  function getCurrentNetwork() {
    const activeId = getActiveNetwork();

    // 기본 네트워크인 경우
    if (NETWORKS[activeId]) {
      return NETWORKS[activeId];
    }

    // 커스텀 네트워크인 경우
    const customNetworks = getCustomNetworks();
    const customNetwork = customNetworks.find((n) => n.id === activeId);

    if (customNetwork) {
      return {
        name: customNetwork.name,
        chainId: customNetwork.chainId,
        rpcEndpoint: customNetwork.rpcEndpoint,
        etherscanUrl: customNetwork.explorerUrl || "",
        etherscanApiUrl: "", // 커스텀 네트워크는 API 없음
      };
    }

    // 폴백: mainnet
    return NETWORKS.mainnet;
  }

  // API URL 생성
  function getEtherscanApiUrl(module, action, params = {}) {
    const network = getCurrentNetwork();
    const baseUrl = network.etherscanApiUrl;
    const apiKey = API_KEYS.ETHERSCAN;

    const queryParams = new URLSearchParams({
      chainid: network.chainId,
      module,
      action,
      apikey: apiKey,
      ...params,
    });

    return `${baseUrl}?${queryParams.toString()}`;
  }

  // RPC 엔드포인트 가져오기
  function getRpcEndpoint(networkName) {
    const network = NETWORKS[networkName] || getCurrentNetwork();
    return network.rpcEndpoint;
  }

  // ================================================================
  // 전역 설정 객체
  // ================================================================

  const EthereumConfig = {
    // API 키
    API_KEYS,

    // 네트워크
    NETWORKS,

    // 네트워크 관리 함수들
    getActiveNetwork,
    setActiveNetwork,
    getCustomNetworks,
    addCustomNetwork,
    removeCustomNetwork,

    // 캐시
    CACHE: CACHE_CONFIG,

    // 트랜잭션
    TRANSACTION: TRANSACTION_CONFIG,

    // UI
    UI: UI_CONFIG,

    // 헬퍼 함수
    getCurrentNetwork,
    getEtherscanApiUrl,
    getRpcEndpoint,

    // 현재 네트워크 바로가기
    get currentNetwork() {
      return this.getCurrentNetwork();
    },

    get chainId() {
      return this.currentNetwork.chainId;
    },

    get rpcEndpoint() {
      return this.currentNetwork.rpcEndpoint;
    },

    get etherscanUrl() {
      return this.currentNetwork.etherscanUrl;
    },
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.EthereumConfig = EthereumConfig;

  console.log("[EthereumConfig] Module loaded");
})();
