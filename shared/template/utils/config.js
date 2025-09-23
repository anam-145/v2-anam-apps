// ================================================================
// [BLOCKCHAIN] 템플릿 - 중앙 설정 파일
// TODO: Bitcoin을 해당 블록체인으로 변경
// 네트워크 설정, API 엔드포인트 등을 중앙 관리
// ================================================================

(function() {
  'use strict';

  // ================================================================
  // 네트워크 설정
  // ================================================================

  // TODO: 블록체인별 네트워크 설정 변경
  // 예시:
  // - Ethereum: mainnet, sepolia, goerli
  // - Solana: mainnet-beta, testnet, devnet
  // - Cosmos: cosmoshub-4, theta-testnet
  // - Sui: mainnet, testnet, devnet
  
  const NETWORKS = {
    mainnet: {
      name: "mainnet",
      displayName: "Bitcoin Mainnet", // TODO: 블록체인명 변경
      apiBaseUrl: "https://mempool.space/api", // TODO: API URL 변경
      explorerUrl: "https://mempool.space", // TODO: Explorer URL 변경
      addressPrefix: ["bc1", "1", "3"], // TODO: 주소 접두사 변경
      // TODO: 블록체인별 추가 설정
      // 예시 (Ethereum):
      // chainId: 1,
      // rpcUrl: "https://mainnet.infura.io/v3/...",
      // 예시 (Solana):
      // rpcUrl: "https://api.mainnet-beta.solana.com",
      // 예시 (Cosmos):
      // chainId: "cosmoshub-4",
      // rpcUrl: "https://cosmos-rpc.quickapi.com",
      // denom: "uatom",
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
      displayName: "Bitcoin Testnet4", // TODO: 테스트넷 이름 변경
      apiBaseUrl: "https://mempool.space/testnet4/api", // TODO: 테스트넷 API URL
      explorerUrl: "https://mempool.space/testnet4", // TODO: 테스트넷 Explorer URL
      addressPrefix: ["tb1", "m", "n", "2"], // TODO: 테스트넷 주소 접두사
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
    // TODO: 저장소 키 이름 변경
    const saved = localStorage.getItem('btc_active_network');
    return saved || 'mainnet'; // 기본값을 mainnet으로 설정
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
    return NETWORKS[activeId] || NETWORKS.mainnet;
  }

  // ================================================================
  // 캐시 설정
  // ================================================================

  const CACHE_CONFIG = {
    // 트랜잭션 캐시
    TX_CACHE_KEY: "btc_tx_cache", // TODO: 키 이름 변경 (eth_tx_cache, sol_tx_cache 등)
    TX_CACHE_TTL: 1 * 60 * 1000,  // 1분
    
    // 잔액 캐시
    BALANCE_CACHE_KEY: "btc_balance_cache", // TODO: 키 이름 변경
    BALANCE_CACHE_TTL: 30 * 1000,  // 30초
    
    // TODO: 블록체인별 추가 캐시 설정
    // Bitcoin: UTXO 캐시
    UTXO_CACHE_KEY: "btc_utxo_cache",
    UTXO_CACHE_TTL: 60 * 1000,  // 1분
    
    // 가격 캐시
    PRICE_CACHE_KEY: "btc_price_cache", // TODO: 키 이름 변경
    PRICE_CACHE_TTL: 60 * 1000,  // 1분
  };

  // ================================================================
  // 트랜잭션 설정
  // ================================================================

  const TRANSACTION_CONFIG = {
    // TODO: 블록체인별 수수료 설정 변경
    // Bitcoin: satoshi/vByte
    // Ethereum: Gwei
    // Solana: lamports
    // Cosmos: uatom
    FEE_RATES: {
      slow: 5,      // TODO: 블록체인별 조정
      medium: 10,   // TODO: 블록체인별 조정
      fast: 20,     // TODO: 블록체인별 조정
      urgent: 50    // TODO: 블록체인별 조정
    },
    
    // 기본 수수료율
    DEFAULT_FEE_RATE: 10, // TODO: 블록체인별 기본값
    
    // 트랜잭션 한도
    // TODO: 블록체인별 최소 금액 설정
    // Bitcoin: dust limit (546 satoshi)
    // Ethereum: gas * gasPrice
    // Solana: rent-exempt minimum (5000 lamports)
    MIN_AMOUNT: 546,  // 최소 단위
    MIN_AMOUNT_BTC: "0.00000546",  // 표시용 최소 금액
    
    // 확인 설정
    CONFIRMATION_TIME: 600000,  // 10분 (평균 블록 시간)

    // UTXO 설정
    MAX_UTXOS_TO_USE: 100,  // 한 트랜잭션에 사용할 최대 UTXO 수
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