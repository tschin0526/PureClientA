#!/bin/bash
# 更新版本号的脚本 - 支持语义化版本号
# 使用方式:
#   ./update_version.sh              # 升级构建号 (1.0.0(1) -> 1.0.0(2))
#   ./update_version.sh patch        # 升级修订版本 (1.0.0(1) -> 1.0.1(1))
#   ./update_version.sh minor        # 升级次版本 (1.0.0(1) -> 1.1.0(1))
#   ./update_version.sh major        # 升级主版本 (1.0.0(1) -> 2.0.0(1))
#
# 版本号来源：versionHistoryPluginReact.js（唯一版本号权威来源）
# index.html 不再包含版本号硬编码，版本显示由插件动态提供

# 从 versionHistoryPluginReact.js 中读取当前版本号（唯一来源）
# 只匹配 VERSION_DATA 中 <h3> 标签里的版本号，排除文件头注释中的旧版本号
get_current_version() {
    local VERSION=$(grep '^### ' versionHistoryPluginReact.js | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\([0-9]+\)')
    echo "$VERSION"
}

# 解析版本号为各个部分
parse_version() {
    local VERSION=$1
    # 格式: 1.0.0(1)
    if [[ $VERSION =~ ^([0-9]+)\.([0-9]+)\.([0-9]+)\(([0-9]+)\)$ ]]; then
        echo "${BASH_REMATCH[1]} ${BASH_REMATCH[2]} ${BASH_REMATCH[3]} ${BASH_REMATCH[4]}"
    else
        echo "1 0 0 1"
    fi
}

# 构建版本号字符串
build_version() {
    local MAJOR=$1
    local MINOR=$2
    local PATCH=$3
    local BUILD=$4
    echo "${MAJOR}.${MINOR}.${PATCH}(${BUILD})"
}

# 获取当前版本
CURRENT_VERSION=$(get_current_version)
echo "当前版本: $CURRENT_VERSION (来源: versionHistoryPluginReact.js)"

# 解析版本号
read MAJOR MINOR PATCH BUILD <<< $(parse_version "$CURRENT_VERSION")
echo "解析为 - 主版本:$MAJOR 次版本:$MINOR 修订版本:$PATCH 构建号:$BUILD"

# 根据参数决定如何升级
case "${1:-build}" in
    major)
        MAJOR=$((MAJOR + 1))
        MINOR=0
        PATCH=0
        BUILD=1
        echo "🔄 升级主版本"
        ;;
    minor)
        MINOR=$((MINOR + 1))
        PATCH=0
        BUILD=1
        echo "🔄 升级次版本"
        ;;
    patch)
        PATCH=$((PATCH + 1))
        BUILD=1
        echo "🔄 升级修订版本"
        ;;
    build|*)
        BUILD=$((BUILD + 1))
        echo "🔄 升级构建号"
        ;;
esac

# 构建新版本号
NEW_VERSION=$(build_version $MAJOR $MINOR $PATCH $BUILD)
echo "新版本: $NEW_VERSION"

# 更新 sw.js 中的缓存名称（如果存在）
if [ -f "sw.js" ]; then
    echo "正在更新 sw.js..."
    sed -i '' "s/CACHE_NAME = 'pureClientA-[^']*'/CACHE_NAME = 'pureClientA-$NEW_VERSION'/g" sw.js
fi

echo ""
echo "✅ 版本号更新完成！"
echo ""
echo "⚠️  注意：index.html 不再包含版本号硬编码"
echo "    版本号由 versionHistoryPluginReact.js 动态提供"
echo "    升版流程：修改 VERSION.md → 运行 update_version_react.sh → 完成"
echo ""
echo "版本升级规则说明:"
echo "  ./update_version.sh              - 升级构建号 (日常修改)"
echo "  ./update_version.sh patch        - 升级修订版本 (Bug修复)"
echo "  ./update_version.sh minor        - 升级次版本 (新功能)"
echo "  ./update_version.sh major        - 升级主版本 (重大更新)"
