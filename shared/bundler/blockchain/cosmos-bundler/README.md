# Cosmos SDK 번들러

Cosmos Hub 및 기타 Cosmos SDK 기반 블록체인을 위한 JavaScript 번들러입니다.

## 설정 파일

`config.json` 파일을 통해 체인 설정을 관리할 수 있습니다.

### 설정 파일 구조

```json
{
    "chain_name": "cosmoshub",
    "chain_id": "cosmoshub-4",
    "bech32_prefix": "cosmos",
    "slip44": 118,
    "fees": {
        "fee_tokens": [
            {
                "denom": "uatom",
                "average_gas_price": 0.025
            }
        ]
    },
    "assets": [
        {
            "denom_units": [
                { "denom": "uatom", "exponent": 0 },
                { "denom": "atom", "exponent": 6 }
            ],
            "base": "uatom",
            "display": "atom",
            "symbol": "ATOM"
        }
    ],
    "apis": {
        "rpc": [
            {
                "address": "https://cosmoshub.tendermintrpc.lava.build:443",
                "provider": "Lava"
            },
            {
                "address": "https://cosmos-rpc.quickapi.com:443",
                "provider": "Chainlayer"
            }
        ],
        "rest": [
            {
                "address": "https://cosmoshub.lava.build:443",
                "provider": "Lava"
            },
            {
                "address": "https://cosmos-lcd.quickapi.com:443",
                "provider": "Chainlayer"
            }
        ],
        "grpc": [
            {
                "address": "cosmoshub.grpc.lava.build",
                "provider": "Lava"
            }
        ]
    },
    "explorers": [
        {
            "kind": "mintscan",
            "url": "https://www.mintscan.io/cosmos",
            "tx_page": "https://www.mintscan.io/cosmos/transactions/${txHash}",
            "account_page": "https://www.mintscan.io/cosmos/accounts/${accountAddress}"
        }
    ]
}
```

## 사용법

### 1. 설정 초기화

```javascript
// 설정 파일 로드
await CosmosJS.initializeConfig();

// 체인 정보 가져오기
const chainInfo = CosmosJS.getChainInfo();
console.log(chainInfo);
// {
//   name: "cosmoshub",
//   prettyName: "Cosmos Hub",
//   chainId: "cosmoshub-4",
//   networkType: "mainnet",
//   status: "live",
//   website: "https://cosmos.network/",
//   bech32Prefix: "cosmos",
//   slip44: 118
// }
```

### 2. 지갑 생성

```javascript
// 니모닉 생성
const mnemonic = CosmosJS.generateMnemonic();

// HD 지갑 생성
const wallet = await CosmosJS.createHdWalletFromMnemonic(
    mnemonic
);

// 주소 가져오기
const address = await CosmosJS.getWalletAddress(wallet);
console.log('Address:', address);

// 개인키 추출 (니모닉에서) - 기본 방법
const keyInfo = await CosmosJS.getPrivateKeyFromMnemonic(
    mnemonic
);
console.log('Private Key:', keyInfo.privateKey);
console.log('Public Key:', keyInfo.publicKey);
console.log('Address:', keyInfo.address);
console.log('Path:', keyInfo.path);

// 개인키 추출 (니모닉에서) - 개선된 방법 (에러 처리 포함)
const result = await CosmosJS.extractPrivateKey(mnemonic);
if (result.success) {
    console.log('Private Key:', result.data.privateKey);
    console.log('Address:', result.data.address);
} else {
    console.error('Error:', result.error);
}
```

### 3. 클라이언트 연결

```javascript
// 읽기 전용 클라이언트 연결
const client = await CosmosJS.connectClient(
    CosmosJS.getDefaultRpcUrl()
);

// 서명 클라이언트 연결
const signingClient = await CosmosJS.connectSigningClient(
    CosmosJS.getDefaultRpcUrl(),
    wallet
);
```

### 4. 잔액 조회

```javascript
const balance = await CosmosJS.getBalance(client, address);
console.log(balance);
// {
//   amount: "1000000",
//   denom: "uatom",
//   formatted: "1.0"
// }
```

### 5. 토큰 전송

```javascript
const result = await CosmosJS.sendTokens(
    signingClient,
    fromAddress,
    toAddress,
    amount, // 기본 단위 (uatom)
    null, // denom (null이면 설정에서 자동 선택)
    'memo' // 메모
);

console.log(result);
// {
//   height: 123456,
//   hash: "ABC123...",
//   gasUsed: 50000,
//   gasWanted: 200000
// }
```

### 6. 단위 변환

```javascript
// 표시 단위 → 기본 단위 (ATOM → uATOM)
const baseAmount = CosmosJS.displayToBase('1.5');
console.log(baseAmount); // "1500000"

// 기본 단위 → 표시 단위 (uATOM → ATOM)
const displayAmount = CosmosJS.baseToDisplay('1500000');
console.log(displayAmount); // "1.5"
```

### 7. 주소 검증

```javascript
const isValid = CosmosJS.validateAddress(address);
console.log('Valid address:', isValid);
```

## 설정 메서드

### 체인 정보

-   `getChainInfo()`: 체인 기본 정보
-   `getAssetInfo()`: 자산 정보
-   `getFeeInfo()`: 수수료 정보

### 엔드포인트

-   `getRpcEndpoints()`: RPC 엔드포인트 목록
-   `getRestEndpoints()`: REST API 엔드포인트 목록
-   `getGrpcEndpoints()`: gRPC 엔드포인트 목록
-   `getDefaultRpcUrl()`: 기본 RPC URL
-   `getDefaultRestUrl()`: 기본 REST URL
-   `getExplorers()`: 익스플로러 목록

## 다른 체인 지원

다른 Cosmos SDK 기반 체인을 지원하려면 `config.json` 파일을 수정하세요:

```json
{
    "chain_name": "osmosis",
    "chain_id": "osmosis-1",
    "bech32_prefix": "osmo",
    "slip44": 118,
    "fees": {
        "fee_tokens": [
            {
                "denom": "uosmo",
                "average_gas_price": 0.025
            }
        ]
    },
    "assets": [
        {
            "denom_units": [
                { "denom": "uosmo", "exponent": 0 },
                { "denom": "osmo", "exponent": 6 }
            ],
            "base": "uosmo",
            "display": "osmo",
            "symbol": "OSMO"
        }
    ],
    "apis": {
        "rpc": [
            {
                "address": "https://rpc.osmosis.zone:26657",
                "provider": "Osmosis"
            }
        ],
        "rest": [
            {
                "address": "https://lcd.osmosis.zone",
                "provider": "Osmosis"
            }
        ],
        "grpc": []
    },
    "explorers": [
        {
            "kind": "mintscan",
            "url": "https://www.mintscan.io/osmosis",
            "tx_page": "https://www.mintscan.io/osmosis/transactions/${txHash}",
            "account_page": "https://www.mintscan.io/osmosis/accounts/${accountAddress}"
        }
    ]
}
```

## 빌드

```bash
npm run build
```

빌드된 파일은 `dist/` 디렉토리에 생성됩니다.
