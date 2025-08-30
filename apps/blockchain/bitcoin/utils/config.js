// ================================================================
// Bitcoin 중앙 설정 파일
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
      displayName: "Bitcoin Mainnet",
      apiBaseUrl: "https://mempool.space/api",
      explorerUrl: "https://mempool.space",
      addressPrefix: ["bc1", "1", "3"],
      // bitcoinjs-lib 네트워크 객체는 번들에서 가져옴
      networkType: "bitcoin",
      bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4
      },
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80
    },
    testnet4: {
      name: "testnet4",
      displayName: "Bitcoin Testnet4",
      apiBaseUrl: "https://mempool.space/testnet4/api",
      explorerUrl: "https://mempool.space/testnet4",
      addressPrefix: ["tb1", "m", "n", "2"],
      networkType: "testnet",
      bip32: {
        public: 0x043587cf,
        private: 0x04358394
      },
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef
    }
  };

  // ================================================================
  // 네트워크 관리
  // ================================================================

  // 활성 네트워크 가져오기
  function getActiveNetwork() {
    const saved = localStorage.getItem('btc_active_network');
    return saved || 'testnet4'; // 기본값을 testnet4로 설정
  }

  // 활성 네트워크 설정
  function setActiveNetwork(networkId) {
    if (!NETWORKS[networkId]) {
      console.error(`Invalid network ID: ${networkId}`);
      return false;
    }
    
    localStorage.setItem('btc_active_network', networkId);
    
    // 네트워크 변경 이벤트 발생
    window.dispatchEvent(new CustomEvent('btcNetworkChanged', { 
      detail: { network: networkId } 
    }));
    
    return true;
  }

  // 현재 네트워크 설정 가져오기
  function getCurrentNetwork() {
    const activeId = getActiveNetwork();
    return NETWORKS[activeId] || NETWORKS.testnet4;
  }

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    // 트랜잭션 캐시
    TX_CACHE_KEY: "btc_tx_cache",
    TX_CACHE_TTL: 5 * 60 * 1000,  // 5분
    
    // 잔액 캐시
    BALANCE_CACHE_KEY: "btc_balance_cache",
    BALANCE_CACHE_TTL: 30 * 1000,  // 30초
    
    // UTXO 캐시
    UTXO_CACHE_KEY: "btc_utxo_cache",
    UTXO_CACHE_TTL: 60 * 1000,  // 1분
    
    // 가격 캐시
    PRICE_CACHE_KEY: "btc_price_cache",
    PRICE_CACHE_TTL: 60 * 1000,  // 1분
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    // 수수료율 (satoshi/vByte)
    FEE_RATES: {
      slow: 5,      // ~60분
      medium: 10,   // ~30분
      fast: 20,     // ~10분
      urgent: 50    // 다음 블록
    },
    
    // 기본 수수료율
    DEFAULT_FEE_RATE: 10,
    
    // 트랜잭션 한도
    MIN_AMOUNT: 546,  // dust limit (satoshi)
    MIN_AMOUNT_BTC: "0.00000546",
    
    // 확인 설정
    CONFIRMATION_TIME: 600000,  // 10분 (평균 블록 시간)
    CONFIRMATION_BLOCKS: 6,  // 6 확인 = 완전 확정
    
    // UTXO 설정
    MAX_UTXOS_TO_USE: 100,  // 한 트랜잭션에 사용할 최대 UTXO 수
    
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
    ADDRESS_DISPLAY_CHARS: 6,
    
    // 애니메이션
    ANIMATION_DURATION: 300,  // ms
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
    const baseUrl = network.explorerUrl;
    
    switch(type) {
      case 'tx':
        return `${baseUrl}/tx/${value}`;
      case 'address':
        return `${baseUrl}/address/${value}`;
      case 'block':
        return `${baseUrl}/block/${value}`;
      default:
        return baseUrl;
    }
  }

  // 주소 유효성 검증
  function isValidAddress(address) {
    const network = getCurrentNetwork();
    
    // 네트워크별 주소 접두사 확인
    const hasValidPrefix = network.addressPrefix.some(prefix => 
      address.startsWith(prefix)
    );
    
    if (!hasValidPrefix) {
      return false;
    }
    
    // 주소 형식 검증 (기본적인 검증)
    // Legacy (P2PKH): 1... (mainnet) / m,n... (testnet)
    // Script (P2SH): 3... (mainnet) / 2... (testnet) 
    // Native SegWit (Bech32): bc1... (mainnet) / tb1... (testnet)
    
    // Bech32 주소
    if (address.startsWith('bc1') || address.startsWith('tb1')) {
      return /^(bc1|tb1)[a-z0-9]{39,59}$/.test(address);
    }
    
    // Legacy/Script 주소  
    return /^[123mn][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address);
  }

  // ================================================================
  // 캐시 관리
  // ================================================================

  function clearNetworkCache() {
    // 네트워크 관련 캐시 삭제
    localStorage.removeItem(CACHE_CONFIG.TX_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.BALANCE_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.UTXO_CACHE_KEY);
    localStorage.removeItem(CACHE_CONFIG.PRICE_CACHE_KEY);
    console.log('[BitcoinConfig] Network cache cleared');
  }

  // ================================================================
  // 전역 설정 객체
  // ================================================================

  const BitcoinConfig = {
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
    }
  };

  // ================================================================
  // 모듈 내보내기
  // ================================================================

  window.BitcoinConfig = BitcoinConfig;

  console.log('[BitcoinConfig] Module loaded');
  console.log('[BitcoinConfig] Active network:', BitcoinConfig.getActiveNetwork());
})();