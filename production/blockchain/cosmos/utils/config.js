// ================================================================
// Cosmos2 중앙 설정 파일
// QuickNode RPC 엔드포인트 사용
// ================================================================

(function () {
  "use strict";

  // ================================================================
  // 체인 설정 (Cosmos Hub)
  // ================================================================
  const CHAIN_CONFIG = {
    chain_name: "cosmoshub",
    chain_type: "cosmos",
    chain_id: "cosmoshub-4",
    website: "https://cosmos.network/",
    pretty_name: "Cosmos Hub",
    status: "live",
    network_type: "mainnet",
    bech32_prefix: "cosmos",
    daemon_name: "gaiad",
    node_home: "$HOME/.gaia",
    key_algos: ["secp256k1"],
    slip44: 118,
    fees: {
      fee_tokens: [
        {
          denom: "uatom",
          fixed_min_gas_price: 0.005,
          low_gas_price: 0.01,
          average_gas_price: 0.025,
          high_gas_price: 0.03,
        },
      ],
    },
    staking: {
      staking_tokens: [
        {
          denom: "uatom",
        },
      ],
    },
    assets: [
      {
        description: "ATOM is the native cryptocurrency of the Cosmos network",
        denom_units: [
          { denom: "uatom", exponent: 0 },
          { denom: "atom", exponent: 6 },
        ],
        base: "uatom",
        name: "Cosmos Hub Atom",
        display: "atom",
        symbol: "ATOM",
        coingecko_id: "cosmos",
        type_asset: "staking",
      },
    ],
  };

  // ================================================================
  // 네트워크 설정 (BlockPI 공용 엔드포인트)
  // ================================================================
  const NETWORKS = {
    mainnet: {
      name: "mainnet",
      displayName: "Cosmos Mainnet",
      chainId: "cosmoshub-4",
      // BlockPI 공용 엔드포인트 사용
      rpcUrl: "https://cosmos.blockpi.network/rpc/v1/public",
      restUrl: "https://cosmos.blockpi.network/lcd/v1/public",
      // 폴백 RPC (BlockPI 실패 시)
      fallbackRpc: [
        "https://cosmos-rpc.publicnode.com:443",
        "https://rpc.cosmos.network:443",
      ],
      explorerUrl: "https://www.mintscan.io/cosmos",
      ...CHAIN_CONFIG,
    },
    testnet: {
      name: "testnet",
      displayName: "Cosmos Testnet",
      chainId: "provider", // ICS Provider 테스트넷
      // 테스트넷 RPC (Polkachu 공개 RPC 사용)
      rpcUrl: "https://cosmos-testnet-rpc.polkachu.com",
      restUrl: "https://cosmos-testnet-api.polkachu.com",
      fallbackRpc: [
        "https://rpc.sentry-01.theta-testnet.polypore.xyz",
        "https://rpc.sentry-02.theta-testnet.polypore.xyz",
      ],
      // Mintscan Testnet Explorer
      explorerUrl: "https://www.mintscan.io/ics-testnet-provider",
      bech32_prefix: "cosmos",
      fees: {
        fee_tokens: [
          {
            denom: "uatom",
            fixed_min_gas_price: 0.005,
            low_gas_price: 0.01,
            average_gas_price: 0.025,
            high_gas_price: 0.03,
          },
        ],
      },
      assets: [
        {
          denom_units: [
            { denom: "uatom", exponent: 0 },
            { denom: "atom", exponent: 6 },
          ],
          base: "uatom",
          name: "Cosmos Test Token",
          display: "atom",
          symbol: "ATOM",
        },
      ],
    },
  };

  // ================================================================
  // 활성 네트워크 관리
  // ================================================================
  let activeNetwork = "mainnet";

  // localStorage에서 네트워크 설정 로드
  if (typeof window !== "undefined" && window.localStorage) {
    const savedNetwork = localStorage.getItem("cosmos_active_network");
    if (savedNetwork && NETWORKS[savedNetwork]) {
      activeNetwork = savedNetwork;
    }
  }

  // ================================================================
  // API 함수들
  // ================================================================
  const CosmosConfig = {
    // 네트워크 관련
    getActiveNetwork: () => activeNetwork,

    setActiveNetwork: (network) => {
      if (NETWORKS[network]) {
        activeNetwork = network;
        if (typeof window !== "undefined" && window.localStorage) {
          localStorage.setItem("cosmos_active_network", network);
        }
        console.log("[CosmosConfig] Network switched to:", network);

        // 네트워크 변경 이벤트 발생 (Solana2/Sui2와 동일한 패턴)
        if (typeof window !== "undefined") {
          window.dispatchEvent(
            new CustomEvent("cosmosNetworkChanged", {
              detail: { network: network },
            })
          );
        }

        return true;
      }
      return false;
    },

    getCurrentNetwork: () => {
      return NETWORKS[activeNetwork];
    },

    getNetworks: () => {
      return Object.keys(NETWORKS).map((key) => ({
        name: key,
        displayName: NETWORKS[key].displayName,
      }));
    },

    // RPC URL 가져오기 (QuickNode 우선)
    getRpcUrl: () => {
      const network = NETWORKS[activeNetwork];
      return network.rpcUrl;
    },

    // REST URL 가져오기
    getRestUrl: () => {
      const network = NETWORKS[activeNetwork];
      return network.restUrl || network.rpcUrl;
    },

    // 폴백 RPC 가져오기
    getFallbackRpc: () => {
      const network = NETWORKS[activeNetwork];
      return network.fallbackRpc || [];
    },

    // Explorer URL 가져오기
    getExplorerUrl: (txHash) => {
      const network = NETWORKS[activeNetwork];
      // Mintscan은 /tx/ 사용 (txs가 아님)
      if (network.explorerUrl.includes("mintscan.io")) {
        return `${network.explorerUrl}/tx/${txHash}`;
      }
      // 다른 Explorer는 /txs/ 사용
      return `${network.explorerUrl}/txs/${txHash}`;
    },

    // 체인 정보 가져오기
    getChainInfo: () => {
      const network = NETWORKS[activeNetwork];
      return {
        chainId: network.chainId,
        chainName: network.name,
        bech32Prefix: network.bech32_prefix,
        denom: network.assets[0].base,
        displayDenom: network.assets[0].display,
        symbol: network.assets[0].symbol,
        decimals: 6, // ATOM은 6자리
      };
    },

    // 수수료 정보 가져오기
    getFeeInfo: () => {
      const network = NETWORKS[activeNetwork];
      return network.fees.fee_tokens[0];
    },

    // 자산 정보 가져오기
    getAssetInfo: () => {
      const network = NETWORKS[activeNetwork];
      return network.assets[0];
    },

    // 주소 유효성 검증
    isValidAddress: (address) => {
      const network = NETWORKS[activeNetwork];
      const prefix = network.bech32_prefix;
      if (!address || typeof address !== "string") {
        return false;
      }
      // Cosmos 주소는 bech32 형식
      // 길이는 보통 45자 정도
      return (
        address.startsWith(prefix) && address.length > 30 && address.length < 80
      );
    },

    // 네트워크 캐시 초기화
    clearNetworkCache: () => {
      // 캐시 키들 삭제
      if (typeof window !== "undefined" && window.localStorage) {
        // 트랜잭션 캐시 삭제
        localStorage.removeItem(CosmosConfig.CACHE_CONFIG.TX_CACHE_KEY);
        localStorage.removeItem(CosmosConfig.CACHE_CONFIG.BALANCE_CACHE_KEY);
        localStorage.removeItem(CosmosConfig.CACHE_CONFIG.NETWORK_CACHE_KEY);
        // 네트워크별 캐시도 삭제
        Object.keys(localStorage).forEach((key) => {
          if (
            key.startsWith("cosmos_tx_") ||
            key.startsWith("cosmos_balance_")
          ) {
            localStorage.removeItem(key);
          }
        });
        console.log("[CosmosConfig] Network cache cleared");
      }
    },

    // CosmosJS에 전달할 전체 설정 객체
    getCosmosJSConfig: () => {
      const network = NETWORKS[activeNetwork];
      return {
        chain_id: network.chainId,
        chain_name: network.chain_name || network.name,
        pretty_name: network.pretty_name || network.displayName,
        bech32_prefix: network.bech32_prefix,
        fees: network.fees,
        assets: network.assets,
        apis: {
          rpc: [
            { address: network.rpcUrl, provider: "QuickNode" },
            ...network.fallbackRpc.map((url) => ({
              address: url,
              provider: "Public",
            })),
          ],
          rest: [
            {
              address: network.restUrl || network.rpcUrl,
              provider: "QuickNode",
            },
          ],
          grpc: [],
        },
        explorers: [
          {
            name: "Mintscan",
            url: network.explorerUrl,
            tx_page: `${network.explorerUrl}/txs/{txHash}`,
          },
        ],
      };
    },

    // 테마 설정 (Cosmos 브랜드 켈러)
    theme: {
      primaryColor: "#6F4CFF", // Cosmos 보라색
      secondaryColor: "#1C1C3A", // Cosmos 진한 남색
      darkColor: "#5031E5", // 진한 보라색
      lightColor: "#F0EDFF", // 연한 보라색
      gradient: "linear-gradient(135deg, #6F4CFF 0%, #9B51E0 100%)",
    },

    // 상수들
    TRANSACTION: {
      DEFAULT_GAS: 200000,
      DEFAULT_MEMO: "",
      CONFIRMATION_TIME: 10000, // 10초
    },

    UI: {
      REFRESH_INTERVAL: 30000, // 30초
      TOAST_DURATION: 3000, // 3초
    },

    // 캐시 설정 (Solana2/Sui2와 동일한 구조)
    CACHE_CONFIG: {
      TX_CACHE_KEY: "cosmos_tx_cache",
      BALANCE_CACHE_KEY: "cosmos_balance_cache",
      DELEGATION_CACHE_KEY: "cosmos_delegation_cache",
      PRICE_CACHE_KEY: "cosmos_price_cache",
      NETWORK_CACHE_KEY: "cosmos_network_cache",
    },

    CACHE: {
      BALANCE_TTL: 30000, // 30초 (Solana2/Sui2와 동일)
      TX_TTL: 60000, // 1분
      PRICE_TTL: 300000, // 5분
      TX_CACHE_KEY: "cosmos_tx_cache", // 하위 호환성
    },
  };

  // ================================================================
  // 전역 노출
  // ================================================================
  if (typeof window !== "undefined") {
    window.CosmosConfig = CosmosConfig;

    // CosmosJS에 설정 자동 등록
    if (window.CosmosJS) {
      try {
        window.CosmosJS.registerConfig(CosmosConfig.getCosmosJSConfig());
        console.log("[CosmosConfig] Auto-registered with CosmosJS");
      } catch (e) {
        console.log("[CosmosConfig] CosmosJS not ready yet");
      }
    }

    console.log("[CosmosConfig] Module loaded");
    console.log("[CosmosConfig] Active network:", activeNetwork);
  }
})();
