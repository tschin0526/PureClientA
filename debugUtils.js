/**
 * 调试工具模块（升级版）
 * 
 * 功能特性：
 * 1. DebugAlert - 累积式调试讯息收集器（新版，推荐使用）
 *    - 连续调试讯息收集，一次性显示
 *    - 支持自动/手动触发显示
 *    - 方便用户复制粘贴给 AI 助手
 * 
 * 2. DebugUtils - 页面内嵌调试视窗（旧版，保留兼容）
 *    - 在页面上显示调试信息浮窗
 *    - 自动关闭功能
 * 
 * 3. getBeijingTime() - 北京时间工具函数
 *    - 统一时间格式化，避免时区问题
 * 
 * @version 2.0.0
 * @update 2026-05-09 升级为双模式调试系统
 */

console.log('debugUtils.js 开始加载（v2.0.0）');

(function() {
    'use strict';
    
    console.log('debugUtils.js IIFE 开始执行');
    
    // ============================================
    // 北京时间工具函数
    // ============================================
    
    /**
     * 获取当前北京时间
     * 解决 toISOString() 返回 UTC 时间（比北京时间晚8小时）的问题
     * 
     * @param {string} format - 输出格式
     *   - 'full': 完整时间 (2026-05-09 10:30:00)
     *   - 'date': 只有日期 (2026-05-09)
     *   - 'time': 只有时间 (10:30:00)
     *   - 'timestamp': 紧凑时间戳 (20260509103000)
     *   - 'file': 文件名友好格式 (20260509_1030)
     * @returns {string} 格式化后的北京时间字符串
     */
    function getBeijingTime(format) {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const beijing = new Date(now.getTime() + offset + (8 * 60 * 60 * 1000));
        
        const pad = function(n) {
            return String(n).padStart(2, '0');
        };
        
        const y = beijing.getFullYear();
        const m = pad(beijing.getMonth() + 1);
        const d = pad(beijing.getDate());
        const h = pad(beijing.getHours());
        const min = pad(beijing.getMinutes());
        const s = pad(beijing.getSeconds());
        
        switch(format) {
            case 'full':
                return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
            case 'date':
                return y + '-' + m + '-' + d;
            case 'time':
                return h + ':' + min + ':' + s;
            case 'timestamp':
                return y + m + d + h + min + s;
            case 'file':
                return y + m + d + '_' + h + min;
            default:
                return y + '-' + m + '-' + d + ' ' + h + ':' + min + ':' + s;
        }
    }
    
    // ============================================
    // DebugAlert - 累积式调试讯息收集器（新版）
    // ============================================
    
    /**
     * 全局调试讯息管理器
     * 
     * 核心特点：
     * 1. 累积多条讯息，一次性显示（减少弹窗次数）
     * 2. 支持手动触发或达到阈值自动显示
     * 3. 统一格式，方便复制粘贴给 AI 助手
     * 4. 自动添加北京时间戳
     * 
     * 使用示例：
     *   DebugAlert.add('步骤1: 开始处理');
     *   DebugAlert.add(`数据长度: ${data.length}`);
     *   DebugAlert.show(); // 显示所有累积的讯息
     */
    const DebugAlert = {
        messages: [],
        autoShowThreshold: 15,
        isEnabled: true,
        
        /**
         * 添加调试讯息（不立即显示）
         * @param {string} message - 调试讯息内容
         * @param {boolean} immediate - 是否立即显示（默认false）
         */
        add: function(message, immediate) {
            if (!this.isEnabled) return;
            
            var timestamp = getBeijingTime('time');
            this.messages.push('[' + timestamp + '] ' + message);
            
            console.log('[DebugAlert] ' + message);
            
            if (immediate || this.messages.length >= this.autoShowThreshold) {
                this.show();
            }
        },
        
        /**
         * 显示所有累积的调试讯息
         * 显示后自动清空讯息列表
         */
        show: function() {
            if (!this.isEnabled) return;
            
            if (this.messages.length === 0) {
                alert('没有待显示的调试讯息');
                return;
            }
            
            var header = '=== 调试讯息 (' + this.messages.length + '条) ===\n';
            var content = this.messages.join('\n');
            var footer = '\n=== 讯息结束 ===\n\n提示：可直接复制此内容粘贴给 AI 助手';
            
            alert(header + content + footer);
            
            this.messages = [];
        },
        
        /**
         * 清空所有未显示的讯息
         */
        clear: function() {
            this.messages = [];
            console.log('[DebugAlert] 讯息已清空');
        },
        
        /**
         * 启用/禁用调试功能
         * @param {boolean} enabled - 是否启用
         */
        setEnabled: function(enabled) {
            this.isEnabled = enabled;
            console.log('[DebugAlert] 调试功能已' + (enabled ? '启用' : '禁用'));
        },
        
        /**
         * 设置自动显示阈值
         * @param {number} threshold - 达到此数量后自动显示
         */
        setAutoShowThreshold: function(threshold) {
            this.autoShowThreshold = threshold > 0 ? threshold : 15;
        },
        
        /**
         * 获取当前未显示的讯息数量
         * @returns {number} 讯息数量
         */
        getMessageCount: function() {
            return this.messages.length;
        },
        
        /**
         * 快捷方法：立即显示单条讯息（用于关键错误）
         * @param {string} message - 错误讯息
         */
        error: function(message) {
            this.add('❌ 错误: ' + message, true);
        },
        
        /**
         * 快捷方法：显示警告讯息
         * @param {string} message - 警告讯息
         */
        warn: function(message) {
            this.add('⚠️ 警告: ' + message, false);
        },
        
        /**
         * 快捷方法：显示成功讯息
         * @param {string} message - 成功讯息
         */
        success: function(message) {
            this.add('✅ 成功: ' + message, false);
        },
        
        /**
         * 快捷方法：显示信息性讯息
         * @param {string} message - 信息讯息
         */
        info: function(message) {
            this.add('ℹ️ 信息: ' + message, false);
        },
        
        /**
         * 分隔线：在讯息中添加视觉分隔
         * @param {string} title - 分隔标题（可选）
         */
        separator: function(title) {
            var line = title ? '--- ' + title + ' ---' : '------------------------';
            this.messages.push(line);
        }
    };
    
    // ============================================
    // DebugUtils - 页面内嵌调试视窗（旧版，保留兼容）
    // ============================================
    
    var autoCloseTimer = null;
    
    const DebugUtils = {
        isDebugEnabled: function() {
            var checkbox = document.getElementById('showDebugWindow');
            return checkbox ? checkbox.checked : true;
        },
        
        getTimeoutSeconds: function() {
            var input = document.getElementById('debugTimeout');
            if (input) {
                var value = parseInt(input.value, 10);
                return (isNaN(value) || value < 1) ? 3 : value;
            }
            return 3;
        },
        
        showDebugInfo: function(message) {
            console.log('调试信息:', message);
            
            // ✅ 升级：自动转发给 DebugAlert（统一使用 Alert 弹窗模式）
            // 这样所有旧代码调用 DebugUtils.showDebugInfo() 都会自动使用新版 DebugAlert
            if (window.DebugAlert && window.DebugAlert.add) {
                DebugAlert.add(message);
                return;
            }
            
            // 降级方案：如果 DebugAlert 不可用，才显示旧版浮窗（理论上不会执行到这里）
            if (!this.isDebugEnabled()) {
                return;
            }
            
            if (autoCloseTimer) {
                clearTimeout(autoCloseTimer);
            }
            
            var debugInfo = document.getElementById('debugInfo');
            if (!debugInfo) {
                debugInfo = document.createElement('div');
                debugInfo.id = 'debugInfo';
                debugInfo.style.cssText =
                    'position: fixed;' +
                    'top: 10px;' +
                    'left: 10px;' +
                    'background: rgba(0, 0, 0, 0.9);' +
                    'color: white;' +
                    'padding: 10px;' +
                    'border-radius: 4px;' +
                    'font-family: monospace;' +
                    'font-size: 12px;' +
                    'max-width: 600px;' +
                    'max-height: 300px;' +
                    'overflow-y: auto;' +
                    'overflow-x: hidden;' +
                    'z-index: 999999;' +
                    'box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);' +
                    'white-space: pre-wrap;' +
                    'word-wrap: break-word;';
                debugInfo.textContent = '***调试讯息***\n\n';
                document.body.appendChild(debugInfo);
            }
            
            var timestamp = getBeijingTime('time');
            debugInfo.textContent += '[' + timestamp + '] ' + message + '\n';
            
            debugInfo.scrollTop = debugInfo.scrollHeight;
            
            var timeoutSeconds = this.getTimeoutSeconds();
            var self = this;
            autoCloseTimer = setTimeout(function() {
                if (debugInfo && debugInfo.parentNode) {
                    debugInfo.remove();
                }
                autoCloseTimer = null;
            }, timeoutSeconds * 1000);
        },
        
        clearDebugInfo: function() {
            if (autoCloseTimer) {
                clearTimeout(autoCloseTimer);
                autoCloseTimer = null;
            }
            
            var debugInfo = document.getElementById('debugInfo');
            if (debugInfo) {
                debugInfo.remove();
            }
        },
        
        showDebugInfoCompat: function(message) {
            DebugAlert.add(message);
        }
    };
    
    // ============================================
    // 暴露到全局
    // ============================================
    
    window.getBeijingTime = getBeijingTime;
    window.DebugAlert = DebugAlert;
    window.DebugUtils = DebugUtils;
    
    window.DebugUtils._isCommonUtils = true;
    window.DebugAlert._version = '2.0.0';
    
    console.log('debugUtils.js 已成功加载（v2.0.0）');
    console.log('- getBeijingTime() 已就绪');
    console.log('- DebugAlert 已就绪（推荐使用）');
    console.log('- DebugUtils 已就绪（兼容模式）');
})();
