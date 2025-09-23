#!/bin/bash

# Development 미니앱 빌드 스크립트
# development 폴더의 미니앱들을 AnamHub 규격에 맞게 ZIP으로 압축

echo "🔧 Building Development MiniApps for AnamHub..."

# 스크립트 위치 기준으로 프로젝트 루트 찾기
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEVELOPMENT_DIR="$PROJECT_ROOT/development"
ZIP_DIR="$PROJECT_ROOT/zip/development"

# zip 폴더가 없으면 생성
mkdir -p "$ZIP_DIR"

# 기존 ZIP 파일들 삭제
echo "🗑️  Cleaning old development builds..."
rm -f "$ZIP_DIR"/*.zip

# 성공/실패 카운터
SUCCESS_COUNT=0
FAIL_COUNT=0

# 빌드 함수
build_app() {
    local app_path=$1
    local app_name=$(basename "$app_path")
    local category=$(basename "$(dirname "$app_path")")

    echo "  - Building $category/$app_name..."

    # manifest.json 존재 확인
    if [ ! -f "$app_path/manifest.json" ]; then
        echo "    ❌ manifest.json not found!"
        ((FAIL_COUNT++))
        return 1
    fi

    # manifest.json 필수 필드 검증 및 app_id, version 추출
    if command -v jq &> /dev/null; then
        local name=$(jq -r '.name // empty' "$app_path/manifest.json")
        local icon=$(jq -r '.icon // empty' "$app_path/manifest.json")
        local pages=$(jq -r '.pages // empty' "$app_path/manifest.json")
        local app_id=$(jq -r '.app_id // empty' "$app_path/manifest.json")
        local version=$(jq -r '.version // empty' "$app_path/manifest.json")

        if [ -z "$name" ] || [ -z "$icon" ] || [ -z "$pages" ]; then
            echo "    ❌ manifest.json missing required fields (name, icon, or pages)!"
            ((FAIL_COUNT++))
            return 1
        fi

        # name 길이 검증 (20자 제한)
        if [ ${#name} -gt 20 ]; then
            echo "    ❌ name field exceeds 20 characters!"
            ((FAIL_COUNT++))
            return 1
        fi

        # pages 배열에 index 페이지 포함 확인
        if ! echo "$pages" | grep -q "pages/index/index"; then
            echo "    ❌ pages array must include 'pages/index/index'!"
            ((FAIL_COUNT++))
            return 1
        fi

        # ZIP 파일명 결정 (카테고리 포함)
        local zip_filename
        if [ -n "$app_id" ] && [ -n "$version" ]; then
            zip_filename="${app_id}_${version}.zip"
        else
            zip_filename="${category}_${app_name}.zip"
        fi
    else
        # jq가 없는 경우 기본 파일명 사용
        local zip_filename="${category}_${app_name}.zip"
    fi

    # ZIP 파일 생성 (app 디렉토리 내에서 실행하여 루트 레벨 구조 보장)
    cd "$app_path"
    zip -r "$ZIP_DIR/${zip_filename}" . \
        -x "*.DS_Store" \
        -x ".git/*" \
        -x "node_modules/*" \
        -x "test.html" \
        -x "mock-*.js" \
        -x "*.test.js" \
        -x ".gitignore" \
        > /dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "    ✅ Success: ${zip_filename}"
        ((SUCCESS_COUNT++))
    else
        echo "    ❌ Failed to create ZIP!"
        ((FAIL_COUNT++))
    fi

    cd - > /dev/null
}

# 1. Development Blockchain 앱 빌드
echo ""
echo "⛓️  Building Development Blockchain Apps..."
if [ -d "$DEVELOPMENT_DIR/blockchain" ]; then
    for app in "$DEVELOPMENT_DIR/blockchain"/*; do
        if [ -d "$app" ]; then
            build_app "$app"
        fi
    done
else
    echo "  ⚠️  No development blockchain apps directory found"
fi

# 2. Development Services 빌드 (하위 폴더 구조 지원)
echo ""
echo "🌐 Building Development Services..."
if [ -d "$DEVELOPMENT_DIR/services" ]; then
    # 각 지역/카테고리별로 처리
    for region in "$DEVELOPMENT_DIR/services"/*; do
        if [ -d "$region" ]; then
            local region_name=$(basename "$region")
            echo ""
            echo "📁 Building $region_name services..."
            for app in "$region"/*; do
                if [ -d "$app" ] && [ -f "$app/manifest.json" ]; then
                    build_app "$app"
                fi
            done
        fi
    done
else
    echo "  ⚠️  No development services directory found"
fi

echo ""
echo "✅ Development build completed!"
echo "   Success: $SUCCESS_COUNT"
echo "   Failed: $FAIL_COUNT"
echo ""

# 생성된 ZIP 파일 목록
if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "📁 Built files in: $ZIP_DIR"
    ls -la "$ZIP_DIR"/*.zip 2>/dev/null | awk '{print "  - " $9 " (" $5 " bytes)"}'
fi

echo ""
echo "💡 Next steps:"
echo "  1. Test ZIP structure: unzip -l $ZIP_DIR/<app>.zip"
echo "  2. Upload to AnamHub at http://localhost:9090"