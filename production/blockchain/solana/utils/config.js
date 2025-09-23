// ================================================================
// Solana - 중앙 설정 파일
// 네트워크 설정, API 엔드포인트 등을 중앙 관리
// ================================================================

(function () {
  "use strict";

  // ================================================================
  // 네트워크 설정
  // ================================================================

  // Solana 네트워크 설정
  const NETWORKS = {
    mainnet: {
      name: "mainnet",
      displayName: "Solana Mainnet",
      rpcUrl:
        "https://newest-virulent-river.solana-mainnet.quiknode.pro/6087fe67210abeccbf8ecf38eef42ebc652ac243/",
      explorerUrl: "https://explorer.solana.com",
      cluster: "mainnet-beta",
      networkType: "mainnet",
    },
    testnet: {
      name: "testnet",
      displayName: "Solana Testnet",
      rpcUrl:
        "https://methodical-few-slug.solana-testnet.quiknode.pro/ced6f6658c56f53433e198c2124918a0e6dd6b0d",
      explorerUrl: "https://explorer.solana.com/?cluster=testnet",
      cluster: "testnet",
      networkType: "testnet",
    },
    devnet: {
      name: "devnet",
      displayName: "Solana Devnet",
      rpcUrl: "https://api.devnet.solana.com",
      // Devnet은 보통 더 안정적
      explorerUrl: "https://explorer.solana.com/?cluster=devnet",
      cluster: "devnet",
      networkType: "devnet",
    },
  };

  // ================================================================
  // 네트워크 관리
  // ================================================================

  // 활성 네트워크 가져오기
  function getActiveNetwork() {
    const saved = localStorage.getItem("sol_active_network");
    return saved || "mainnet"; // 기본값을 mainnet으로 설정 (QuickNode 사용)
  }

  // 활성 네트워크 설정
  function setActiveNetwork(networkId) {
    if (!NETWORKS[networkId]) {
      console.error(`Invalid network ID: ${networkId}`);
      return false;
    }

    localStorage.setItem("sol_active_network", networkId);

    // 네트워크 변경 이벤트 발생
    window.dispatchEvent(
      new CustomEvent("solNetworkChanged", {
        detail: { network: networkId },
      })
    );

    return true;
  }

  // 현재 네트워크 설정 가져오기
  function getCurrentNetwork() {
    const activeId = getActiveNetwork();
    return NETWORKS[activeId] || NETWORKS.mainnet;
  }

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    // 트랜잭션 캐시
    TX_CACHE_KEY: "sol_tx_cache",
    TX_CACHE_TTL: 1 * 60 * 1000, // 1분 (5분 → 1분으로 단축)

    // 잔액 캐시
    BALANCE_CACHE_KEY: "sol_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000, // 30초

    // SPL 토큰 캐시
    TOKEN_CACHE_KEY: "sol_token_cache",
    TOKEN_CACHE_TTL: 60 * 1000, // 1분

    // 가격 캐시
    PRICE_CACHE_KEY: "sol_price_cache",
    PRICE_CACHE_TTL: 60 * 1000, // 1분
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    // Solana는 고정 수수료 사용 (5000 lamports)
    FEE_RATES: {
      slow: 5000, // 5000 lamports
      medium: 5000, // 5000 lamports
      fast: 5000, // 5000 lamports
      urgent: 5000, // 5000 lamports
    },

    // 기본 수수료율
    DEFAULT_FEE_RATE: 5000, // 5000 lamports

    // 확인 설정
    CONFIRMATION_TIME: 30000, // 30초 (Solana는 빠른 확인)
    CONFIRMATION_BLOCKS: 1, // 1 확인 = 완전 확정 (Solana는 빠름)

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
    ADDRESS_DISPLAY_CHARS: 6,

    // 애니메이션
    ANIMATION_DURATION: 300, // ms
  };

  // ================================================================
  // API 헬퍼 함수
  // ================================================================

  // API URL 생성
  function getApiUrl(endpoint) {
    const network = getCurrentNetwork();
    return `${network.apiBaseUrl}${endpoint}`;
  }

  // Explorer URL 생성
  function getExplorerUrl(type, value) {
    const network = getCurrentNetwork();
    const networkName = network.name;

    // Solana Explorer는 mainnet일 때는 cluster 파라미터 불필요
    // testnet/devnet일 때만 ?cluster= 파라미터 추가
    const baseUrl = "https://explorer.solana.com";
    const clusterParam = networkName === "mainnet" ? "" : `?cluster=${networkName}`;

    switch (type) {
      case "tx":
        return `${baseUrl}/tx/${value}${clusterParam}`;
      case "address":
        return `${baseUrl}/address/${value}${clusterParam}`;
      case "block":
        return `${baseUrl}/block/${value}${clusterParam}`;
      default:
        return `${baseUrl}${clusterParam}`;
    }
  }

  // 주소 유효성 검증
  function isValidAddress(address) {
    if (!address || typeof address !== "string") {
      return false;
    }

    // Solana 주소는 base58 형식 (32-44 문자)
    return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
  }

  // ================================================================
  // 캐시 관리
  // ================================================================

  function clearNetworkCache() {
    // 네트워크 관련 캐시 삭제
    localStorage.removeItem(CACHE_CONFIG.TX_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.BALANCE_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.TOKEN_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.PRICE_CACHE_KEY);
    console.log("[SolanaConfig] Network cache cleared");
  }

  // ================================================================
  // 전역 설정 객체
  // ================================================================

  const SolanaConfig = {
    // 네트워크
    NETWORKS,

    // 네트워크 관리
    getActiveNetwork,
    setActiveNetwork,
    getCurrentNetwork,

    // 캐시
    CACHE: CACHE_CONFIG,

    // 트랜잭션
    TRANSACTION: TRANSACTION_CONFIG,

    // UI
    UI: UI_CONFIG,

    // 헬퍼 함수
    getApiUrl,
    getExplorerUrl,
    isValidAddress,
    clearNetworkCache,

    // 현재 네트워크 바로가기
    get currentNetwork() {
      return this.getCurrentNetwork();
    },

    get apiBaseUrl() {
      return this.currentNetwork.apiBaseUrl;
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

  window.SolanaConfig = SolanaConfig;

  console.log("[SolanaConfig] Module loaded");
  console.log(
    "[SolanaConfig] Active network:",
    SolanaConfig.getActiveNetwork()
  );
})();
