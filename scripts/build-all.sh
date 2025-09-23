#!/bin/bash

# 모든 미니앱 빌드 스크립트
# production과 development 폴더의 모든 미니앱을 빌드

echo "🔨 Building ALL MiniApps for AnamHub..."
echo "================================="

# 스크립트 위치 기준으로 프로젝트 루트 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Production 빌드
echo ""
echo "▶️  PRODUCTION APPS"
echo "================================="
"$SCRIPT_DIR/build-production.sh"

# Development 빌드
echo ""
echo "▶️  DEVELOPMENT APPS"
echo "================================="
"$SCRIPT_DIR/build-development.sh"

echo ""
echo "================================="
echo "🎉 All builds completed!"
echo ""

# 전체 결과 표시
echo "📊 Build Summary:"
echo "  - Production: check zip/production/"
echo "  - Development: check zip/development/"
echo ""

# 생성된 파일 수 계산
if [ -d "$SCRIPT_DIR/../zip" ]; then
    PROD_COUNT=$(ls -1 "$SCRIPT_DIR/../zip/production/"*.zip 2>/dev/null | wc -l)
    DEV_COUNT=$(ls -1 "$SCRIPT_DIR/../zip/development/"*.zip 2>/dev/null | wc -l)
    TOTAL_COUNT=$((PROD_COUNT + DEV_COUNT))

    echo "📦 Total ZIP files created: $TOTAL_COUNT"
    echo "  - Production: $PROD_COUNT files"
    echo "  - Development: $DEV_COUNT files"
fi