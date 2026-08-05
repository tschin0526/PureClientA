#!/bin/bash

# ============================================================
# 完整版本升级脚本（仅 React 版）
# 
# 功能：一次性更新所有版本相关的文件（仅使用 React 版）
# 1. VERSION.md - 版本历史记录
# 2. versionHistoryPluginReact.js - React 版 Markdown 格式
# 3. index.html - 版本号参数
# 4. sw.js - Service Worker 缓存版本
#
# 使用方法：
#   ./full_update_react.sh [patch|minor|major] "版本描述"
#
# 示例：
#   ./full_update_react.sh patch "修复了一个 bug"
#   ./full_update_react.sh minor "新增了功能"
#   ./full_update_react.sh major "重大更新"
# ============================================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 获取参数
UPDATE_TYPE="${1:-patch}"
DESCRIPTION="${2:-日常修改}"

# 验证参数
if [[ ! "$UPDATE_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}❌ 错误: 升级类型必须是 patch|minor|major${NC}"
  echo "用法: $0 [patch|minor|major] \"版本描述\""
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}🔄 开始完整版本升级流程（仅 React 版）...${NC}"
echo -e "${YELLOW}升级类型: $UPDATE_TYPE${NC}"
echo -e "${YELLOW}版本描述: $DESCRIPTION${NC}"
echo ""

# ============================================
# 步骤 1: 获取当前版本信息
# ============================================
echo -e "${BLUE}步骤 1/5: 检测当前版本...${NC}"

# 从 VERSION.md 提取最新版本号
CURRENT_VERSION=$(grep -E "^### [0-9]+\.[0-9]+\.[0-9]+\([0-9]+\)" VERSION.md | head -1 | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\([0-9]+\)")

if [ -z "$CURRENT_VERSION" ]; then
  echo -e "${RED}❌ 无法从 VERSION.md 检测到版本号${NC}"
  exit 1
fi

echo -e "${GREEN}✅ 当前版本: $CURRENT_VERSION${NC}"

# 解析版本号
MAJOR=$(echo $CURRENT_VERSION | grep -oE "^[0-9]+" | head -1)
MINOR=$(echo $CURRENT_VERSION | grep -oE "\.[0-9]+\." | head -1 | tr -d '.')
PATCH=$(echo $CURRENT_VERSION | grep -oE "\.[0-9]+\(" | head -1 | grep -oE "[0-9]+")
BUILD=$(echo $CURRENT_VERSION | grep -oE "\([0-9]+\)" | tr -d '()')

echo -e "   主版本: $MAJOR | 次版本: $MINOR | 修订: $PATCH | 构建: $BUILD"
echo ""

# ============================================
# 步骤 2: 计算新版本号
# ============================================
echo -e "${BLUE}步骤 2/5: 计算新版本号...${NC}"

case "$UPDATE_TYPE" in
  major)
    NEW_MAJOR=$((MAJOR + 1))
    NEW_MINOR=0
    NEW_PATCH=0
    NEW_BUILD=1
    TYPE_LABEL="主版本"
    TYPE_EMOJI="🔥"
    ;;
  minor)
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$((MINOR + 1))
    NEW_PATCH=0
    NEW_BUILD=$((BUILD + 1))
    TYPE_LABEL="次版本"
    TYPE_EMOJI="✨"
    ;;
  patch)
    NEW_MAJOR=$MAJOR
    NEW_MINOR=$MINOR
    NEW_PATCH=$((PATCH + 1))
    NEW_BUILD=$((BUILD + 1))
    TYPE_LABEL="修订版本"
    TYPE_EMOJI="🔧"
    ;;
esac

NEW_VERSION="${NEW_MAJOR}.${NEW_MINOR}.${NEW_PATCH}(${NEW_BUILD})"
TODAY_DATE=$(date '+%Y-%m-%d')

echo -e "${GREEN}✅ 新版本: $NEW_VERSION ($TODAY_DATE)${NC}"
echo ""

# ============================================
# 步骤 3: 更新 VERSION.md
# ============================================
echo -e "${BLUE}步骤 3/5: 更新 VERSION.md...${NC}"

# 创建新的版本记录块
VERSION_ENTRY="### ${TYPE_EMOJI} ${NEW_VERSION} - ${TODAY_DATE}

- **类型**: ${TYPE_LABEL}升级
- **功能说明**:
  - ${DESCRIPTION}
- **改动文件**:
  - （待补充具体改动）

"

# 在第一个版本记录前插入新版本
TEMP_FILE=$(mktemp)
{
  while IFS= read -r line; do
    if [[ "$line" =~ ^###\  ]]; then
      echo "$VERSION_ENTRY"
      echo "$line"
      break
    else
      echo "$line"
    fi
  done
  cat
} < VERSION.md > "$TEMP_FILE"

mv "$TEMP_FILE" VERSION.md

echo -e "${GREEN}✅ VERSION.md 已更新${NC}"
echo ""

# ============================================
# 步骤 4: 更新 React 版插件
# ============================================
echo -e "${BLUE}步骤 4/5: 更新 React 版插件...${NC}"

if [ -f "./update_version_react.sh" ]; then
  chmod +x ./update_version_react.sh
  ./update_version_react.sh
  echo -e "${GREEN}✅ versionHistoryPluginReact.js 已更新${NC}"
else
  echo -e "${YELLOW}⚠️  未找到 update_version_react.sh，跳过${NC}"
fi

echo ""

# ============================================
# 步骤 5: 运行版本号更新脚本
# ============================================
echo -e "${BLUE}步骤 5/5: 更新版本号...${NC}"

if [ -f "./update_version.sh" ]; then
  chmod +x ./update_version.sh
  ./update_version.sh "$UPDATE_TYPE"
  echo -e "${GREEN}✅ index.html 和 sw.js 已更新${NC}"
else
  echo -e "${YELLOW}⚠️  未找到 update_version.sh，跳过此步${NC}"
fi

echo ""

# ============================================
# 完成
# ============================================
echo "============================================="
echo -e "${GREEN}🎉 完整版本升级完成！${NC}"
echo "============================================="
echo ""
echo -e "${BLUE}版本信息:${NC}"
echo "  旧版本: ${RED}$CURRENT_VERSION${NC}"
echo "  新版本: ${GREEN}$NEW_VERSION${NC}"
echo "  升级类型: $TYPE_LABEL"
echo "  升级日期: $TODAY_DATE"
echo ""
echo -e "${BLUE}已更新的文件:${NC}"
echo "  ✅ VERSION.md"
echo "  ✅ versionHistoryPluginReact.js"
echo "  ✅ index.html"
echo "  ✅ sw.js"
echo ""
echo -e "${YELLOW}⚠️  下一步操作:${NC}"
echo "  1. 强制刷新浏览器 (Cmd+Shift+R 或 Ctrl+Shift+R)"
echo "  2. 点击左上角版本号按钮查看新版本历史"
echo ""
