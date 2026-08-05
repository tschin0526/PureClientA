#!/bin/bash
"""
启动脚本 - 支持 HTTP 和 HTTPS 模式选择
"""

echo "========================================"
echo "纯前端交易记录系统 - 启动器"
echo "========================================"
echo ""
echo "选择运行模式:"
echo "1) HTTPS 模式 (推荐) - 支持 PWA 离线功能"
echo "2) HTTP 模式 - 无安全提示，适合快速测试"
echo ""
read -p "请输入选择 (1 或 2): " choice

case $choice in
    1)
        echo ""
        echo "启动 HTTPS 模式..."
        python3 start_https_server.py
        ;;
    2)
        echo ""
        echo "启动 HTTP 模式..."
        python3 start_https_server.py http
        ;;
    *)
        echo ""
        echo "无效选择，使用默认 HTTPS 模式..."
        python3 start_https_server.py
        ;;
esac