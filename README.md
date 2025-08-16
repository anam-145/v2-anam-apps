# v2-anam-apps

AnamWallet V2용 모듈 및 개발도구 모음

## 📁 프로젝트 구조

```
v2-anam-apps/
├── templates/              # 미니앱 개발용 템플릿
│   ├── app.js             # CoinAdapter 베이스 코드
│   ├── app.css            # 공통 스타일
│   ├── manifest.json      # 앱 메타데이터 템플릿
│   ├── assets/            # 리소스 파일
│   │   └── icons/         # 아이콘 템플릿
│   └── pages/             # 페이지 템플릿
│       ├── index/         # 메인 페이지
│       ├── send/          # 전송 페이지
│       └── receive/       # 수신 페이지
│
├── apps/                   # 완성된 미니앱들
│   ├── blockchain/         # 블록체인 미니앱
│   │   ├── bitcoin/       # Bitcoin 지갑
│   │   ├── ethereum/      # Ethereum 지갑
│   │   └── solana/        # Solana 지갑
│   │
│   └── webapp/            # 일반 웹 미니앱
│       ├── anam/          # Anam 공식 앱
│       ├── busan/         # 부산 지역 앱
│       ├── seoul/         # 서울 지역 앱
│       ├── la/            # LA 지역 앱
│       └── etc/           # 기타 서비스 (DeFi 등)
│
├── bundler/               # 브라우저 번들러
│   ├── blockchain/        # 블록체인 라이브러리 번들러
│   │   ├── bitcoin-bundler/  # Bitcoin 번들러
│   │   └── solana-bundler/   # Solana 번들러
│   │
│   └── README.md         # 번들러 사용 가이드
│
├── scripts/              # 유틸리티 스크립트
│   └── build-apps.sh     # AnamHub용 ZIP 빌드 스크립트
│
├── zip/                  # 빌드된 ZIP 파일 (build-apps.sh 실행 시 생성)
│
└── README.md            # 프로젝트 소개
```
