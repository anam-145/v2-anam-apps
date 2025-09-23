# 블록체인 지갑 템플릿

이 템플릿은 Bitcoin 모듈을 기반으로 제작된 범용 블록체인 지갑 템플릿입니다. 다양한 블록체인을 쉽게 추가할 수 있도록 설계되었습니다.

## 📋 목차

- [개요](#개요)
- [아키텍처](#아키텍처)
- [필수 구현 기능](#필수-구현-기능)
- [새 블록체인 추가 가이드](#새-블록체인-추가-가이드)
- [유틸리티 함수](#유틸리티-함수)
- [파일별 수정 가이드](#파일별-수정-가이드)
- [번들러 생성 가이드](#번들러-생성-가이드)
- [테스트 체크리스트](#테스트-체크리스트)

## 개요

### 템플릿 특징
- ✅ **Bitcoin 기반**: 검증된 안정적인 구조
- ✅ **14개 필수 기능**: 완전한 지갑 기능 구현 필요
- ✅ **3단계 캐싱**: Memory → SessionStorage → LocalStorage
- ✅ **상세한 TODO**: 명확한 수정 가이드

### 지원 가능한 블록체인 유형
- Account 모델: Ethereum, Solana, Cosmos
- UTXO 모델: Bitcoin, Litecoin
- Object 모델: Sui, Aptos

## 아키텍처

```
template/
├── manifest.json          # 앱 메타데이터
├── app.js                # 메인 어댑터 (핵심 로직)
├── app.css               # 전역 스타일
├── assets/               
│   ├── icons/           # 앱 아이콘
│   ├── images/          # UI 이미지
│   └── [coin]-bundle.js # 번들된 라이브러리
├── utils/
│   ├── config.js        # 블록체인 설정
│   ├── storage.js       # 저장소 관리
│   └── helpers.js       # 유틸리티 함수
└── pages/
    ├── index/           # 메인 화면
    ├── send/            # 전송 화면
    ├── receive/         # 수신 화면
    └── settings/        # 설정 화면
```

## 폴더 및 파일 상세 설명

### 📁 루트 파일들

#### **manifest.json**
- **역할**: 미니앱의 메타데이터 정의
- **수정 필요**: 앱 이름과 아이콘 경로만 변경
```json
{
  "name": "Your Coin Wallet",  // 앱 이름 변경
  "icon": "assets/icons/app_icon.png",  // 아이콘 교체
  "pages": [...]  // 페이지 목록 (수정 불필요)
}
```

#### **app.js** (⭐ 가장 중요)
- **역할**: 블록체인과 UI를 연결하는 어댑터 패턴 구현
- **반드시 구현해야 할 함수**:
  - `generateWallet()`: 새 지갑 생성
  - `importFromMnemonic()`: 니모닉으로 지갑 복원
  - `sendTransaction()`: 트랜잭션 전송
  - `getBalance()`: 잔액 조회
  - `getTransactionHistory()`: 거래 내역 조회
  - `estimateFee()`: 수수료 계산
- **window 객체 노출**: `window.getAdapter()` 함수로 접근

#### **app.css**
- **역할**: 전체 앱의 공통 스타일
- **수정 필요**: 
  - CSS 변수의 색상값 변경 (`--coin-primary`, `--coin-secondary`)
  - 클래스명의 'btc' 접두사 변경 (선택사항)

### 📁 assets/ (리소스 폴더)

#### **assets/icons/**
- **app_icon.png**: 메인 앱 아이콘 (512x512px 권장)
- **logo.png**: 로고 이미지
- 수정: 블록체인별 아이콘으로 교체

#### **assets/images/**
- UI에 사용되는 이미지들 (settings.svg, send.svg 등)
- 수정: 일반적으로 수정 불필요

#### **assets/[coin]-bundle.js**
- **역할**: 블록체인 라이브러리 번들 파일
- **생성 방법**: bundler/ 폴더에서 빌드 후 복사
- **예시**: bitcoin-bundle.js, solana-bundle.js

### 📁 utils/ (유틸리티 폴더)

#### **utils/config.js**
- **역할**: 블록체인별 설정 중앙 관리
- **필수 수정 항목**:
```javascript
const CoinConfig = {
  name: 'Bitcoin',        // 코인 이름
  symbol: 'BTC',          // 코인 심볼
  decimals: 8,            // 소수점 자리수
  networks: {             // 네트워크 설정
    mainnet: { ... },
    testnet: { ... }
  },
  theme: {                // 테마 색상
    primaryColor: '#F7931A',
    secondaryColor: '#FFA500'
  }
}
```

#### **utils/storage.js**
- **역할**: 지갑 데이터 저장/조회 관리
- **주요 기능**:
  - 3단계 캐싱: Memory → SessionStorage → LocalStorage
  - Keystore API 통합 (암호화 저장)
  - 네트워크별 주소 관리
- **수정 필요**: 저장소 키 이름만 변경
```javascript
KEYS: {
  storage: 'eth_wallet',  // 블록체인별로 변경
  session: 'eth_wallet_cache'
}
```

#### **utils/helpers.js**
- **역할**: 공통 유틸리티 함수 모음
- **함수 카테고리**:
  - **포맷팅**: 금액 표시, 주소 축약
  - **UI**: 토스트, 로딩, QR코드
  - **검증**: 주소/금액 유효성 검사
  - **네트워크**: API 요청 헬퍼
- **수정 방법**: Bitcoin 전용 함수들을 블록체인에 맞게 수정

### 📁 pages/ (화면 폴더)

#### **pages/index/** (메인 화면)
- **index.html**: 메인 화면 레이아웃
- **index.js**: 메인 화면 로직
- **index.css**: 메인 화면 스타일
- **mnemonic/**: 니모닉 백업 플로우 (3단계)
  - step1-warning.js: 보안 경고
  - step2-display.js: 니모닉 표시
  - step3-verify.js: 니모닉 검증
- **구현 내용**:
  - 지갑 생성/복원 버튼
  - 잔액 표시
  - 거래 내역 목록
  - 주소 표시

#### **pages/send/** (전송 화면)
- **send.html**: 전송 폼 레이아웃
- **send.js**: 전송 로직 구현
- **send.css**: 전송 화면 스타일
- **구현 내용**:
  - 수신 주소 입력
  - 금액 입력
  - 수수료 선택
  - 트랜잭션 전송

#### **pages/receive/** (수신 화면)
- **receive.html**: QR 코드 표시 레이아웃
- **receive.js**: QR 코드 생성 로직
- **receive.css**: 수신 화면 스타일
- **구현 내용**:
  - 지갑 주소 표시
  - QR 코드 생성
  - 주소 복사 기능

#### **pages/settings/** (설정 화면)
- **settings.html**: 설정 메뉴 레이아웃
- **settings.js**: 설정 기능 구현
- **settings.css**: 설정 화면 스타일
- **구현 내용**:
  - 니모닉 백업 보기
  - 개인키 내보내기
  - 네트워크 전환
  - 지갑 삭제

## 구현 우선순위

### 1️⃣ 최우선 (핵심 기능)
1. **app.js**: 블록체인 어댑터 구현
2. **utils/config.js**: 네트워크 설정
3. **번들 파일**: 라이브러리 준비

### 2️⃣ 필수 수정
1. **manifest.json**: 앱 정보
2. **utils/storage.js**: 저장소 키
3. **utils/helpers.js**: 단위 변환 함수

### 3️⃣ UI 수정
1. HTML 파일들의 텍스트 (코인 이름, 단위)
2. CSS 색상 변수
3. 아이콘 교체

### 4️⃣ 선택 사항
1. 클래스명 변경 (btc → eth 등)
2. 추가 기능 구현

## 필수 구현 기능

템플릿에서 구현이 필요한 14개 필수 기능:

| 번호 | 기능 | 구현 위치 | 수정 필요도 | 설명 |
|------|------|----------|------------|------|
| 1 | 니모닉 생성 | `app.js:generateWallet()` | **필수** | 블록체인별 라이브러리로 교체 |
| 2 | 니모닉 복원 | `app.js:importFromMnemonic()` | **필수** | 블록체인별 라이브러리로 교체 |
| 3 | 트랜잭션 전송 | `app.js:sendTransaction()` | **필수** | 완전 재구현 필요 |
| 4 | 트랜잭션 조회 | `app.js:getTransactionHistory()` | **필수** | API 엔드포인트 변경 |
| 5 | 잔액 조회 | `app.js:getBalance()` | **필수** | API 엔드포인트 변경 |
| 6 | 주소 표시/복사 | `pages/index/index.js` | 낮음 | UI만 수정 |
| 7 | QR 코드 생성 | `pages/receive/receive.js` | 없음 | 그대로 사용 가능 |
| 8 | 네트워크 전환 | `utils/config.js` | **필수** | 네트워크 설정 추가 |
| 9 | 보안 저장소 | `utils/storage.js` | 중간 | 키 이름만 변경 |
| 10 | 설정 관리 | `pages/settings/settings.js` | 낮음 | UI 텍스트만 수정 |
| 11 | 수수료 관리 | `app.js:estimateFee()` | **필수** | 블록체인별 로직 구현 |
| 12 | 백업 플로우 | `pages/index/mnemonic/` | 없음 | 그대로 사용 가능 |
| 13 | 테마 시스템 | `utils/config.js:theme` | 낮음 | 색상만 변경 |
| 14 | 토스트 알림 | `utils/helpers.js:showToast()` | 없음 | 그대로 사용 가능 |

## 유틸리티 함수

### utils/helpers.js 주요 함수

템플릿에 포함된 유틸리티 함수들 (Bitcoin 기준으로 작성됨):

#### 포맷팅 함수
- `satoshiToBTC()` / `btcToSatoshi()` - **수정 필요**: 블록체인별 단위 변환
- `formatBalance()` - **수정 필요**: 소수점 자리수 조정
- `shortenAddress()` - 그대로 사용 가능
- `shortenTxId()` - 그대로 사용 가능

#### 수수료 관련 (Bitcoin 전용)
- `calculateDustLimit()` - **삭제 또는 수정**: UTXO 전용
- `estimateTxSize()` - **수정 필요**: 블록체인별 계산
- `calculateFee()` - **수정 필요**: 블록체인별 계산
- `selectUTXOs()` - **삭제**: UTXO 모델 전용

#### UI 함수 (그대로 사용 가능)
- `showToast()` - 토스트 메시지
- `showLoading()` - 로딩 표시
- `copyToClipboard()` - 클립보드 복사
- `generateQRCode()` - QR 코드 생성

#### 트랜잭션 분석 (완전 재구현 필요)
- `isTransactionSent()` - **수정 필요**: 블록체인별 구조
- `calculateTransactionAmount()` - **수정 필요**: 블록체인별 구조

#### 네트워크 헬퍼
- `fetchAPI()` - **수정 필요**: API URL 변경
- `broadcastTransaction()` - **수정 필요**: 엔드포인트 변경

#### 캐시 관리 (그대로 사용 가능)
- `setCache()` / `getCache()` - 로컬 캐싱

### utils/storage.js 주요 기능

#### 저장소 키 (수정 필요)
```javascript
KEYS: {
  storage: 'btc_wallet',  // TODO: 'eth_wallet', 'sol_wallet' 등으로 변경
  session: 'btc_wallet_cache'  // TODO: 블록체인별로 변경
}
```

#### 주요 메서드
- `saveSecure()` - Keystore API 사용 시 암호화 저장
- `getSecure()` - 암호화된 데이터 복호화
- `get()` / `save()` - 3단계 캐싱 적용
- `clear()` - 지갑 데이터 삭제

### utils/config.js 설정

#### 필수 수정 항목
- `name`, `symbol`, `decimals` - 코인 정보
- `networks` - RPC 엔드포인트
- `theme` - 브랜드 색상
- `explorer` - 블록 익스플로러 URL

## 새 블록체인 추가 가이드

### 1단계: 템플릿 복사
```bash
# 템플릿을 새 블록체인 폴더로 복사
cp -r blockchain-app/template blockchain-app/[your-coin]

# 예시
cp -r blockchain-app/template blockchain-app/polygon
```

### 2단계: 번들러 생성 (필요한 경우)

#### 번들러가 필요한 경우:
- 블록체인 라이브러리가 Node.js 전용
- Buffer, crypto 등 Node.js API 사용
- CommonJS 모듈 시스템 사용

#### 번들러가 필요없는 경우:
- CDN으로 직접 사용 가능 (예: ethers.js)
- 브라우저 호환 버전 제공

번들러 생성 방법은 [번들러 생성 가이드](#번들러-생성-가이드) 참조

### 3단계: 핵심 파일 수정

#### 3.1 manifest.json
```json
{
  "name": "Polygon Wallet",  // TODO: 지갑 이름 변경
  "icon": "assets/icons/app_icon.png",  // TODO: 아이콘 교체
  "pages": [
    "pages/index/index",
    "pages/send/send",
    "pages/receive/receive",
    "pages/settings/settings"
  ]
}
```

#### 3.2 utils/config.js
```javascript
const CoinConfig = {
  name: 'Polygon',           // TODO: 코인 이름
  symbol: 'MATIC',           // TODO: 코인 심볼
  decimals: 18,              // TODO: 소수점 자리수
  explorer: 'https://polygonscan.com',  // TODO: 익스플로러 URL
  
  // TODO: 네트워크 설정
  networks: {
    mainnet: {
      rpc: 'https://polygon-rpc.com',
      chainId: 137
    },
    testnet: {
      rpc: 'https://rpc-mumbai.maticvigil.com',
      chainId: 80001
    }
  },
  
  // TODO: 테마 색상
  theme: {
    primaryColor: '#8247E5',
    secondaryColor: '#6C3FC0'
  }
};
```

#### 3.3 app.js - 핵심 어댑터 구현

**필수 구현 함수들:**

```javascript
// 1. 지갑 생성
async generateWallet() {
  // TODO: 블록체인별 지갑 생성 로직
  // 예시 (Ethereum):
  const wallet = ethers.Wallet.createRandom();
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: wallet.mnemonic.phrase
  };
}

// 2. 니모닉 복원
async importFromMnemonic(mnemonic) {
  // TODO: 니모닉으로 지갑 복원
  // 예시 (Ethereum):
  const wallet = ethers.Wallet.fromMnemonic(mnemonic);
  return {
    address: wallet.address,
    privateKey: wallet.privateKey,
    mnemonic: mnemonic
  };
}

// 3. 잔액 조회
async getBalance(address) {
  // TODO: API 호출하여 잔액 조회
  // 예시:
  const response = await fetch(`${API_URL}/balance/${address}`);
  const data = await response.json();
  return data.balance;
}

// 4. 트랜잭션 전송
async sendTransaction(params) {
  // TODO: 트랜잭션 생성 및 전송
  // UTXO 모델 (Bitcoin) vs Account 모델 (Ethereum) 구분 필요
}

// 5. 트랜잭션 조회
async getTransactionHistory(address) {
  // TODO: API 호출하여 트랜잭션 목록 조회
}

// 6. 수수료 계산
async estimateFee(params) {
  // TODO: 네트워크 수수료 계산
  // Bitcoin: sat/vB
  // Ethereum: gas price * gas limit
}
```

### 4단계: UI 텍스트 수정

모든 HTML 파일에서 TODO 주석을 찾아 수정:

```html
<!-- 타이틀 변경 -->
<title>Polygon Wallet</title>

<!-- 코인 심볼 변경 -->
<span class="coin-symbol">MATIC</span>

<!-- 코인 단위 변경 -->
<span class="coin-unit">MATIC</span>
```

### 5단계: 스타일 커스터마이징

```css
/* app.css */
:root {
  --coin-primary: #8247E5;    /* 메인 색상 */
  --coin-secondary: #6C3FC0;  /* 보조 색상 */
}
```

## 파일별 수정 가이드

### 우선순위 높음 (필수 수정)

| 파일 | 수정 내용 | 난이도 |
|------|----------|--------|
| `app.js` | 블록체인 어댑터 구현 | 높음 |
| `utils/config.js` | 네트워크 설정 | 중간 |
| `manifest.json` | 앱 메타데이터 | 낮음 |

### 우선순위 중간 (권장 수정)

| 파일 | 수정 내용 | 난이도 |
|------|----------|--------|
| `utils/storage.js` | 저장소 키 이름 | 낮음 |
| `utils/helpers.js` | 유틸 함수 이름 | 낮음 |
| HTML 파일들 | UI 텍스트 | 낮음 |

### 우선순위 낮음 (선택 수정)

| 파일 | 수정 내용 | 난이도 |
|------|----------|--------|
| CSS 파일들 | 클래스명, 색상 | 낮음 |
| `assets/icons/` | 아이콘 교체 | 낮음 |

## 번들러 생성 가이드

### 1. 프로젝트 초기화
```bash
cd bundler/
mkdir [coin]-bundler && cd [coin]-bundler
npm init -y
```

### 2. 필수 패키지 설치
```bash
npm install vite vite-plugin-node-polyfills terser
npm install [blockchain-library]  # 예: @solana/web3.js
```

### 3. vite.config.js 생성
```javascript
import { defineConfig } from 'vite';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import path from 'path';

export default defineConfig({
  define: {
    global: 'globalThis',
  },
  plugins: [
    nodePolyfills({
      include: ['buffer', 'crypto', 'stream', 'util'],
      globals: {
        Buffer: true,
        process: true,
        global: true
      }
    })
  ],
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.js'),
      name: 'YourCoinJS',  // window.YourCoinJS로 접근
      formats: ['iife'],
      fileName: '[coin]-bundle',
    },
    minify: 'terser',
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'YourCoinJS',
        extend: true
      }
    }
  }
});
```

### 4. src/index.js 생성
```javascript
// 라이브러리 import
import * as lib from '@blockchain/library';

// 전역 객체로 노출
window.YourCoinJS = lib;

// 필요한 경우 추가 설정
export default lib;
```

### 5. 빌드 및 복사
```bash
npm run build
cp dist/[coin]-bundle.js ../../blockchain-app/[coin]/assets/
```


## 테스트 체크리스트

### 기능 테스트

- [ ] **지갑 생성**
  - [ ] 니모닉 12단어 생성
  - [ ] 주소 올바르게 표시
  - [ ] 백업 플로우 완료

- [ ] **지갑 복원**
  - [ ] 니모닉으로 복원
  - [ ] 같은 주소 생성 확인

- [ ] **트랜잭션**
  - [ ] 전송 성공
  - [ ] 수수료 계산 정확
  - [ ] 히스토리 표시

- [ ] **네트워크**
  - [ ] 메인넷/테스트넷 전환
  - [ ] RPC 연결 확인

### UI/UX 테스트

- [ ] 모든 페이지 로딩
- [ ] 버튼 클릭 동작
- [ ] 복사 기능
- [ ] QR 코드 생성
- [ ] 토스트 메시지

### 보안 테스트

- [ ] Keystore 암호화 확인
- [ ] 민감 데이터 노출 확인
- [ ] 네트워크 요청 HTTPS

## 트러블슈팅

### 자주 발생하는 문제

**1. Bundle not defined**
```javascript
// 해결: HTML에서 번들 파일 경로 확인
<script src="../../assets/[coin]-bundle.iife.js"></script>
```

**2. Buffer is not defined**
```javascript
// 해결: vite.config.js에 polyfill 추가
nodePolyfills({
  include: ['buffer'],
  globals: { Buffer: true }
})
```

**3. 트랜잭션 실패**
```javascript
// 해결: 네트워크 설정 확인
// RPC URL, Chain ID 검증
```

---

**Version**: 1.0.0  
**Based on**: Bitcoin Module v1.0.0