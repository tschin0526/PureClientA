#!/bin/bash

# ============================================================
# 版本历史插件更新脚本（React版）
#
# 功能：从 VERSION.md 读取 Markdown 版本历史，
#       嵌入到 versionHistoryPluginReact.js 的 VERSION_DATA
#       渲染时由内置的 markdownToHtml() 自动转为 HTML
#
# 架构说明：
#   VERSION.md (Markdown) → VERSION_DATA (Markdown原始文本)
#   → markdownToHtml() 运行时转换 → HTML 渲染
#
# 使用时机：
#   - 每次修改 VERSION.md 后运行此脚本
#
# 使用方法：
#   ./update_version_react.sh
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VERSION_MD="$SCRIPT_DIR/VERSION.md"
PLUGIN_REACT="$SCRIPT_DIR/versionHistoryPluginReact.js"
BACKUP_REACT="$PLUGIN_REACT.backup"

echo "📦 开始更新版本历史插件（React版）..."
echo ""

if [ ! -f "$VERSION_MD" ]; then
  echo "❌ 错误：找不到 VERSION.md 文件"
  exit 1
fi

if [ ! -f "$PLUGIN_REACT" ]; then
  echo "❌ 错误：找不到 versionHistoryPluginReact.js 文件"
  exit 1
fi

cp "$PLUGIN_REACT" "$BACKUP_REACT"
echo "✅ 已备份原插件文件"

# 使用正则精确提取版本号
LATEST_VERSION=$(grep "^### " "$VERSION_MD" | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+\([0-9]+\)')
echo "📌 最新版本号: $LATEST_VERSION"

python3 - "$SCRIPT_DIR" << 'PYTHON_SCRIPT'
import re
import os
import sys

script_dir = sys.argv[1] if len(sys.argv) > 1 else os.getcwd()
version_md_path = os.path.join(script_dir, 'VERSION.md')
plugin_path = os.path.join(script_dir, 'versionHistoryPluginReact.js')

with open(version_md_path, 'r', encoding='utf-8') as f:
    md_content = f.read()

with open(plugin_path, 'r', encoding='utf-8') as f:
    plugin_content = f.read()

escaped_md = md_content.replace('\\', '\\\\')
escaped_md = escaped_md.replace('$', '\\$')
escaped_md = escaped_md.replace('`', '\\`')

start_marker = 'var VERSION_DATA = `'
end_marker = '`;'

start_idx = plugin_content.find(start_marker)
end_idx = plugin_content.find(end_marker, start_idx + len(start_marker))

if start_idx == -1 or end_idx == -1:
    print(" 错误：找不到 VERSION_DATA 标记")
    exit(1)

new_plugin = (
    plugin_content[:start_idx + len(start_marker)] +
    escaped_md +
    plugin_content[end_idx:]
)

with open(plugin_path, 'w', encoding='utf-8') as f:
    f.write(new_plugin)

print("✅ 成功更新 versionHistoryPluginReact.js")
PYTHON_SCRIPT

echo ""
echo "🎉 版本历史插件（React版）更新完成！"
echo "📋 下一步操作："
echo "   刷新浏览器页面 (Cmd+Shift+R)"
