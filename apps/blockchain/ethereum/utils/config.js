// ================================================================
// Ethereum 중앙 설정 파일
// API 키, 엔드포인트, 설정값 등을 중앙 관리
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // API 키 및 엔드포인트
  // ================================================================

  const API_KEYS = {
    // Etherscan API Key
    ETHERSCAN: "GD4K6FTTVNF23VIICEYJ3AY3TP7RWT6PIY",
    
    // QuickNode RPC 엔드포인트
    QUICKNODE: "ed1e699042dab42a0b3d7d6c7f059eaaef2cc930",
    
    // 기타 API 키 (필요시 추가)
    // INFURA: "your-infura-key",
    // ALCHEMY: "your-alchemy-key",
  };

  // ================================================================
  // 네트워크 설정
  // ================================================================

  const NETWORKS = {
    mainnet: {
      name: "mainnet",
      chainId: 1,
      rpcEndpoint: `https://eth-mainnet.g.alchemy.com/v2/${API_KEYS.ALCHEMY || 'demo'}`,
      etherscanUrl: "https://etherscan.io",
      etherscanApiUrl: "https://api.etherscan.io/api"
    },
    sepolia: {
      name: "sepolia",
      chainId: 11155111,
      rpcEndpoint: `https://still-fluent-yard.ethereum-sepolia.quiknode.pro/${API_KEYS.QUICKNODE}/`,
      etherscanUrl: "https://sepolia.etherscan.io",
      etherscanApiUrl: "https://api-sepolia.etherscan.io/api"
    },
    goerli: {
      name: "goerli",
      chainId: 5,
      rpcEndpoint: `https://goerli.infura.io/v3/${API_KEYS.INFURA || 'demo'}`,
      etherscanUrl: "https://goerli.etherscan.io",
      etherscanApiUrl: "https://api-goerli.etherscan.io/api"
    }
  };

  // 현재 활성 네트워크
  const ACTIVE_NETWORK = "sepolia";

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    // 트랜잭션 캐시
    TX_CACHE_KEY: "eth_tx_cache",
    TX_CACHE_TTL: 5 * 60 * 1000,  // 5분
    
    // 잔액 캐시
    BALANCE_CACHE_KEY: "eth_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000,  // 30초
    
    // 가격 캐시
    PRICE_CACHE_KEY: "eth_price_cache",
    PRICE_CACHE_TTL: 60 * 1000,  // 1분
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    // 기본 가스 설정
    DEFAULT_GAS_LIMIT: 21000,
    DEFAULT_GAS_PRICE: "20",  // Gwei
    
    // 트랜잭션 한도
    MIN_AMOUNT: "0.000001",
    MAX_AMOUNT: "1000",
    
    // 확인 설정
    CONFIRMATION_TIME: 15000,  // 15초
    CONFIRMATION_BLOCKS: 12,
    
    // 재시도 설정
    MAX_RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 3000,  // 3초
  };

  // ================================================================
  // UI 설정
  // ================================================================

  const UI_CONFIG = {
    // 토스트 메시지
    TOAST_DURATION: 3000,  // 3초
    
    // 새로고침 간격
    BALANCE_REFRESH_INTERVAL: 30000,  // 30초
    TX_REFRESH_INTERVAL: 60000,  // 60초
    
    // 페이지네이션
    TX_PER_PAGE: 20,
    MAX_TX_DISPLAY: 100,
    
    // 주소 표시
    ADDRESS_DISPLAY_CHARS: 4,
    
    // 애니메이션
    ANIMATION_DURATION: 300,  // ms
  };

  // ================================================================
  // 헬퍼 함수
  // ================================================================

  // 현재 네트워크 설정 가져오기
  function getCurrentNetwork() {
    return NETWORKS[ACTIVE_NETWORK];
  }

  // API URL 생성
  function getEtherscanApiUrl(module, action, params = {}) {
    const network = getCurrentNetwork();
    const baseUrl = network.etherscanApiUrl;
    const apiKey = API_KEYS.ETHERSCAN;
    
    const queryParams = new URLSearchParams({
      module,
      action,
      apiKey: apiKey,
      ...params
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
    ACTIVE_NETWORK,
    
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
    }
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.EthereumConfig = EthereumConfig;

  console.log('[EthereumConfig] Module loaded');
})();