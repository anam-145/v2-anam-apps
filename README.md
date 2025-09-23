# v2-anam-apps

AnamWallet V2용 미니앱 개발 플랫폼

## 📁 프로젝트 구조

```
v2-anam-apps/
├── production/             # 🚀 프로덕션 준비 완료
│   ├── blockchain/         # 블록체인 지갑 (bitcoin, ethereum, ...)
│   └── services/          # 공공 서비스 (government24, koreauniv)
│
├── development/           # 🔧 개발/테스트 중
│   ├── blockchain/        # 테스트용 블록체인
│   └── services/          # 지역별 서비스
│       ├── seoul/         # 서울 서비스들
│       ├── busan/         # 부산 서비스들
│       └── ...            # LA, 라이베리아, 르완다, DeFi 등
│
├── shared/                # 📚 공유 리소스
│   ├── template/          # 미니앱 템플릿
│   ├── bundler/           # 블록체인 번들러
│   └── admin/             # 관리 도구
│
└── scripts/               # 🔨 빌드 도구
    ├── build-all.sh       # 모든 앱 빌드
    ├── build-production.sh # Production 앱 빌드
    └── build-development.sh # Development 앱 빌드
```

## 🚀 빠른 시작

### 1. ZIP 파일 빌드

```bash
# 모든 미니앱 빌드
./scripts/build-all.sh

# Production 앱만 빌드
./scripts/build-production.sh

# Development 앱만 빌드
./scripts/build-development.sh
```
