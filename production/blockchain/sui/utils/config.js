// ================================================================
// Sui 중앙 설정 파일
// 네트워크 설정, API 엔드포인트 등을 중앙 관리
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 네트워크 설정
  // ================================================================

  const NETWORKS = {
    mainnet: {
      name: "mainnet",
      displayName: "Sui Mainnet",
      rpcUrl: "https://fullnode.mainnet.sui.io:443",
      apiBaseUrl: "https://fullnode.mainnet.sui.io:443",
      explorerUrl: "https://suiscan.xyz/mainnet",
      addressPrefix: ["0x"],
      networkType: "mainnet"
    },
    testnet: {
      name: "testnet",
      displayName: "Sui Testnet",
      rpcUrl: "https://fullnode.testnet.sui.io:443",
      apiBaseUrl: "https://fullnode.testnet.sui.io:443",
      explorerUrl: "https://suiscan.xyz/testnet",
      addressPrefix: ["0x"],
      networkType: "testnet"
    },
    devnet: {
      name: "devnet",
      displayName: "Sui Devnet",
      rpcUrl: "https://fullnode.devnet.sui.io:443",
      apiBaseUrl: "https://fullnode.devnet.sui.io:443",
      explorerUrl: "https://suiscan.xyz/devnet",
      addressPrefix: ["0x"],
      networkType: "devnet"
    }
  };

  // ================================================================
  // 네트워크 관리
  // ================================================================

  // 활성 네트워크 가져오기
  function getActiveNetwork() {
    const saved = localStorage.getItem('sui_active_network');
    return saved || 'mainnet'; // 기본값을 mainnet으로 설정
  }

  // 활성 네트워크 설정
  function setActiveNetwork(networkId) {
    if (!NETWORKS[networkId]) {
      console.error(`Invalid network ID: ${networkId}`);
      return false;
    }
    
    localStorage.setItem('sui_active_network', networkId);
    
    // 네트워크 변경 이벤트 발생
    window.dispatchEvent(new CustomEvent('suiNetworkChanged', { 
      detail: { network: networkId } 
    }));
    
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
    TX_CACHE_KEY: "sui_tx_cache",
    TX_CACHE_TTL: 1 * 60 * 1000,  // 1분
    
    // 잔액 캐시
    BALANCE_CACHE_KEY: "sui_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000,  // 30초
    
    // Sui 객체 캐시
    OBJECTS_CACHE_KEY: "sui_objects_cache",
    OBJECTS_CACHE_TTL: 60 * 1000,  // 1분
    
    // 가격 캐시
    PRICE_CACHE_KEY: "sui_price_cache",
    PRICE_CACHE_TTL: 60 * 1000,  // 1분
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    // Sui 가스 설정 (MIST 단위, 1 SUI = 10^9 MIST)
    FEE_RATES: {
      slow: 100000,      // 0.0001 SUI
      medium: 200000,    // 0.0002 SUI
      fast: 500000,      // 0.0005 SUI
      urgent: 1000000    // 0.001 SUI
    },
    
    // 기본 가스 예산
    DEFAULT_GAS_BUDGET: 200000, // 0.0002 SUI
    
    // 트랜잭션 한도 (Sui는 최소 금액 제한 없음)
    // MIN_AMOUNT: 제거 - Sui는 dust limit 없음
    // MIN_AMOUNT_SUI: 제거 - Sui는 최소 금액 제한 없음
    
    // 확인 설정
    CONFIRMATION_TIME: 3000,  // 3초 (Sui 평균 블록 시간)
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
  };

  // ================================================================
  // API 헬퍼 함수
  // ================================================================

  // API URL 생성
  function getApiUrl(endpoint) {
    const network = getCurrentNetwork();
    return `${network.apiBaseUrl}${endpoint}`;
  }

  // 주소 유효성 검증
  function isValidAddress(address) {
    // Sui 주소는 0x로 시작하는 64자 hex 문자열
    return /^0x[a-fA-F0-9]{64}$/.test(address);
  }

  // ================================================================
  // 캐시 관리
  // ================================================================

  function clearNetworkCache() {
    // 네트워크 관련 캐시 삭제
    localStorage.removeItem(CACHE_CONFIG.TX_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.BALANCE_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.OBJECTS_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.PRICE_CACHE_KEY);
    console.log('[SuiConfig] Network cache cleared');
  }

  // ================================================================
  // 전역 설정 객체
  // ================================================================

  const SuiConfig = {
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
    }
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.SuiConfig = SuiConfig;

  console.log('[SuiConfig] Module loaded');
  console.log('[SuiConfig] Active network:', SuiConfig.getActiveNetwork());
})();