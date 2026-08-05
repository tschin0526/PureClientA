/**
 * 📊 JSON 数据浏览器 (JSONDataBrowser)
 *
 * 功能特性：
 * - 双页签界面：文本编辑 + 表格显示
 * - 实时JSON验证与格式化
 * - 智能表格渲染（支持嵌套结构）
 * - 美观的现代化UI设计
 *
 * 技术栈：
 * - React 18 (函数组件 + Hooks)
 * - FloatingWindowReact (浮动窗口)
 * - 纯手工CSS样式（无外部依赖）
 */

console.log('[JSON-Browser] 🚀 开始加载模块...');

// ===== 预先暴露接口（确保始终可用）=====
window.JSONDataBrowser = window.JSONDataBrowser || {
  _initialized: false,
  _error: null,
  open: function() {
    if (!this._initialized) {
      alert('⚠️ JSON数据浏览器正在初始化中...\n\n请稍后再试，或刷新页面。\n\n错误信息: ' + (this._error || '未知错误'));
      console.error('[JSON-Browser] ❌ 模块未完成初始化');
      return;
    }
    // 实际的open逻辑会在后面被覆盖
    console.warn('[JSON-Browser] ⚠️ 使用了默认的open方法');
  }
};

(function() {
  'use strict';

  try {

  console.log('[JSON-Browser] 🔍 检查依赖...');

  // ===== 依赖检查（带详细日志）=====
  var deps = {
    React: window.React,
    ReactDOM: window.ReactDOM,
    FloatingWindowReact: window.FloatingWindowReact
  };

  var missingDeps = Object.keys(deps).filter(function(key) { return !deps[key]; });

  if (missingDeps.length > 0) {
    var errorMsg = '缺少必要依赖: ' + missingDeps.join(', ');
    console.error('[JSON-Browser] ❌ ' + errorMsg);
    window.JSONDataBrowser._error = errorMsg;

    // 显示用户友好的提示
    setTimeout(function() {
      if (document.readyState === 'complete') {
        console.warn('[JSON-Browser] ⚠️ 页面已加载完成但依赖仍缺失，可能是加载顺序问题');
      }
    }, 1000);

    return;  // 依赖缺失，无法继续
  }

  console.log('[JSON-Browser] ✅ 所有依赖已加载:', Object.keys(deps).join(', '));

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var createElement = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var useMemo = React.useMemo;
  var useRef = React.useRef;

  console.log('[JSON-Browser] ✅ 所有依赖已加载');

  // ===== 配色常量 =====
  var COLORS = {
    primary: '#3b82f6',       // 主色调（蓝色）
    primaryLight: '#dbeafe',  // 主色浅色
    primaryDark: '#1d4ed8',   // 主色深色
    success: '#10b981',       // 成功色（绿色）
    successLight: '#d1fae5',  // 成功浅色
    error: '#ef4444',         // 错误色（红色）
    errorLight: '#fee2e2',    // 错误浅色
    warning: '#f59e0b',       // 警告色（橙色）
    warningLight: '#fef3c7',  // 警告浅色
    bgLight: '#f8fafc',       // 浅背景
    bgWhite: '#ffffff',       // 白色背景
    textDark: '#1e293b',      // 深色文字
    textGray: '#64748b',      // 灰色文字
    border: '#e2e8f0'         // 边框色
  };

  // ===== 主组件 =====
  function JSONDataBrowser() {

    // State 声明
    var _state1 = useState('');           // 通用文本内容
    var textContent = _state1[0];
    var setTextContent = _state1[1];

    var _state2 = useState('');           // Markdown文本
    var markdownText = _state2[0];
    var setMarkdownText = _state2[1];

    var _state3 = useState('');           // JSON文本内容
    var jsonText = _state3[0];
    var setJsonText = _state3[1];

    var _state4 = useState(0);            // 当前激活的页签 (0=文本编辑器, 1=Markdown编辑器, 2=JSON编辑器, 3=表格视图)
    var activeTab = _state4[0];
    var setActiveTab = _state4[1];

    var _state5 = useState(null);         // 解析后的JSON数据
    var parsedData = _state5[0];
    var setParsedData = _state5[1];

    var _state6 = useState(null);         // 验证状态 {ok, msg}
    var validateStatus = _state6[0];
    var setValidateStatus = _state6[1];

    var _state7 = useState(false);        // 是否正在格式化
    var isFormatting = _state7[0];
    var setIsFormatting = _state7[1];

    var _state8 = useState({});         // 用户自定义列宽覆盖 { key: width }
    var columnWidthOverrides = _state8[0];
    var setColumnWidthOverrides = _state8[1];

    var colResizeRef = useRef(null);    // 列宽拖拽状态 { key, startX, startWidth, namespace }

    var _state9 = useState(false);       // 是否正在拖拽调整列宽（用于全局光标）
    var isResizingCol = _state9[0];
    var setIsResizingCol = _state9[1];

    // ===== 列宽拖拽事件处理 =====
    useEffect(function() {
      function handleMouseMove(e) {
        if (!colResizeRef.current) return;
        var info = colResizeRef.current;
        var delta = e.clientX - info.startX;
        var newWidth = Math.max(40, info.startWidth + delta); // 最小列宽 40px
        setColumnWidthOverrides(function(prev) {
          var next = Object.assign({}, prev);
          next[info.key] = newWidth;
          return next;
        });
      }

      function handleMouseUp() {
        if (colResizeRef.current) {
          colResizeRef.current = null;
          setIsResizingCol(false);
          document.body.style.cursor = '';
          document.body.style.userSelect = '';
        }
      }

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);

      return function() {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }, []);

    var onColResizeStart = useCallback(function(key, startWidth, e, namespace) {
      e.preventDefault();
      e.stopPropagation();
      var lookupKey = namespace ? namespace + '::' + key : key;
      colResizeRef.current = {
        key: lookupKey,
        startX: e.clientX,
        startWidth: startWidth
      };
      setIsResizingCol(true);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }, []);

    var getColWidth = useCallback(function(key, defaultWidth, namespace) {
      var lookupKey = namespace ? namespace + '::' + key : key;
      if (columnWidthOverrides.hasOwnProperty(lookupKey)) {
        return columnWidthOverrides[lookupKey];
      }
      return defaultWidth;
    }, [columnWidthOverrides]);

    // ===== JSON验证函数 =====
    function validateAndParse(text) {
      if (!text || !text.trim()) {
        return {
          ok: false,
          msg: '⚠️ 请输入JSON文本',
          data: null
        };
      }

      try {
        var data = JSON.parse(text);
        return {
          ok: true,
          msg: '✅ JSON格式正确 (' + formatBytes(text.length) + ')',
          data: data
        };
      } catch (err) {
        return {
          ok: false,
          msg: '❌ JSON解析错误: ' + err.message,
          data: null
        };
      }
    }

    // ===== 格式化JSON =====
    function formatJSON() {
      if (!isJsonMode) {
        setValidateStatus({ ok: false, msg: '⚠️ 请切换到JSON编辑器或表格视图后再执行格式化。' });
        return;
      }

      if (!jsonText.trim()) {
        setValidateStatus({ ok: false, msg: '⚠️ 没有可格式化的内容' });
        return;
      }

      setIsFormatting(true);

      setTimeout(function() {
        try {
          var data = JSON.parse(jsonText);
          var formatted = JSON.stringify(data, null, 2);
          setJsonText(formatted);

          var result = validateAndParse(formatted);
          setParsedData(result.data);
          setValidateStatus({ ok: true, msg: '✅ 格式化完成！' });
        } catch (err) {
          setValidateStatus({ ok: false, msg: '❌ 格式化失败: ' + err.message });
        }

        setIsFormatting(false);
      }, 100);
    }

    // ===== 文本变化处理 =====
    function handleTextChange(e) {
      var newText = e.target.value;
      setJsonText(newText);

      // 实时验证（防抖300ms）
      clearTimeout(window._jsonValidateTimer);
      window._jsonValidateTimer = setTimeout(function() {
        var result = validateAndParse(newText);
        setParsedData(result.data);
        setValidateStatus(result);
      }, 300);
    }

    // ===== 页签切换 =====
    function switchTab(tabIndex) {
      setActiveTab(tabIndex);

      if (tabIndex === 2 || tabIndex === 3) {
        // 切换到JSON相关页签时重新验证当前JSON文本
        var result = validateAndParse(jsonText);
        setParsedData(result.data);
        setValidateStatus(result);
      }
    }

    // ===== 字节格式化工具函数 =====
    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function renderMarkdownPreview(markdown) {
      if (!markdown) {
        return '<div style="color: ' + COLORS.textGray + '; padding: 20px;">在此输入Markdown文本，右侧实时预览。</div>';
      }

      var text = markdown
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/```([\s\S]*?)```/g, function(match, code) {
          return '<pre style="padding: 12px; border-radius: 12px; background: #0f172a; color: #f8fafc; overflow-x: auto;"><code>' + code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';
        })
        .replace(/^###### (.+)$/gm, '<h6>$1</h6>')
        .replace(/^##### (.+)$/gm, '<h5>$1</h5>')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/`([^`]+)`/g, '<code style="background: rgba(15, 23, 42, 0.15); padding: 2px 6px; border-radius: 4px;">$1</code>')
        .replace(/\[(.+?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
        .replace(/^\s*[-*+] (.+)$/gm, '<li>$1</li>');

      text = text.replace(/(?:<li>.*?<\/li>\s*)+/g, function(match) {
        return '<ul style="padding-left: 20px; margin: 12px 0;">' + match.trim() + '</ul>';
      });

      text = text.replace(/(?:\r?\n){2,}/g, '</p><p>');
      text = '<p style="margin: 0 0 16px; line-height: 1.8;">' + text + '</p>';
      text = text.replace(/<p><\/p>/g, '');

      return text;
    }

    var isJsonMode = activeTab === 2 || activeTab === 3;

    // ===== 渲染主界面 =====
    return createElement(window.FloatingWindowReact, {
      isOpen: true,
      width: '1100px',
      height: '700px',
      sourceFile: 'JSONDataBrowser.js',  // ✅ 显示源文件名
      onClose: function() {
        var container = document.getElementById('json-browser-window');
        if (container) {
          ReactDOM.unmountComponentAtNode(container);
          if (container.parentNode) container.parentNode.removeChild(container);
        }
      },
      title: '📊 JSON 数据浏览器'
    },

      createElement('div', {
        style: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: COLORS.bgLight,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
        }
      },

        // ========== 标题栏区域 ==========
        createElement('div', {
          style: {
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            padding: '16px 24px',
            color: 'white',
            flexShrink: 0
          }
        },
          createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }
          },
            // 左侧：标题信息
            createElement('div', null,
              createElement('h2', {
                style: {
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: 700,
                  marginBottom: '4px',
                  textShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }
              }, '📊 JSON 数据浏览器'),
              createElement('p', {
                style: {
                  margin: 0,
                  fontSize: '13px',
                  opacity: 0.9
                }
              }, '编辑 · 验证 · 可视化')
            ),

            // 右侧：操作按钮组
            createElement('div', {
              style: {
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }
            },
              // 格式化按钮
              createElement('button', {
                onClick: formatJSON,
                disabled: isFormatting || !isJsonMode,
                title: isJsonMode ? '格式化JSON (Ctrl+Shift+F)' : '请切换到JSON编辑器后再执行格式化',
                style: {
                  padding: '8px 16px',
                  background: isFormatting || !isJsonMode ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.2)',
                  border: '1px solid rgba(255,255,255,0.4)',
                  borderRadius: '8px',
                  color: 'white',
                  cursor: isFormatting || !isJsonMode ? 'not-allowed' : 'pointer',
                  opacity: isFormatting || !isJsonMode ? 0.7 : 1,
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s ease',
                  backdropFilter: 'blur(10px)'
                }
              }, isFormatting ? '⏳ 格式中...' : '✨ 格式化'),

              // 清空按钮
              createElement('button', {
                onClick: function() {
                  if (confirm('确定要清空所有内容吗？')) {
                    setTextContent('');
                    setMarkdownText('');
                    setJsonText('');
                    setParsedData(null);
                    setValidateStatus(null);
                  }
                },
                title: '清空内容',
                style: {
                  padding: '8px 12px',
                  background: 'rgba(239, 68, 68, 0.2)',
                  border: '1px solid rgba(239, 68, 68, 0.4)',
                  borderRadius: '8px',
                  color: '#fecaca',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 500,
                  transition: 'all 0.2s ease'
                }
              }, '🗑️ 清空')
            )
          )
        ),

        // ========== 页签导航栏 ==========
        createElement('div', {
          style: {
            display: 'flex',
            background: COLORS.bgWhite,
            borderBottom: `2px solid ${COLORS.border}`,
            flexShrink: 0,
            padding: '0 24px'
          }
        },

          // 页签1：文本编辑器
          createElement('button', {
            onClick: function() { switchTab(0); },
            style: {
              padding: '14px 24px',
              background: activeTab === 0 ? COLORS.bgWhite : 'transparent',
              border: 'none',
              borderBottom: activeTab === 0 ? `3px solid ${COLORS.primary}` : '3px solid transparent',
              color: activeTab === 0 ? COLORS.primaryDark : COLORS.textGray,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 0 ? 700 : 500,
              transition: 'all 0.2s ease',
              position: 'relative',
              marginBottom: '-2px'
            }
          },
            createElement('span', { style: { marginRight: '6px' } }, '📝'),
            '文本编辑器',
            activeTab === 0 && createElement('span', {
              style: {
                marginLeft: '8px',
                fontSize: '11px',
                background: COLORS.primaryLight,
                color: COLORS.primary,
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600
              }
            }, 'TEXT')
          ),

          // 页签2：Markdown编辑器
          createElement('button', {
            onClick: function() { switchTab(1); },
            style: {
              padding: '14px 24px',
              background: activeTab === 1 ? COLORS.bgWhite : 'transparent',
              border: 'none',
              borderBottom: activeTab === 1 ? `3px solid ${COLORS.warning}` : '3px solid transparent',
              color: activeTab === 1 ? COLORS.warning : COLORS.textGray,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 1 ? 700 : 500,
              transition: 'all 0.2s ease',
              position: 'relative',
              marginBottom: '-2px'
            }
          },
            createElement('span', { style: { marginRight: '6px' } }, '🪄'),
            'Markdown 编辑器',
            activeTab === 1 && createElement('span', {
              style: {
                marginLeft: '8px',
                fontSize: '11px',
                background: COLORS.warningLight,
                color: COLORS.warning,
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600
              }
            }, 'MD')
          ),

          // 页签3：JSON编辑器
          createElement('button', {
            onClick: function() { switchTab(2); },
            style: {
              padding: '14px 24px',
              background: activeTab === 2 ? COLORS.bgWhite : 'transparent',
              border: 'none',
              borderBottom: activeTab === 2 ? `3px solid ${COLORS.primary}` : '3px solid transparent',
              color: activeTab === 2 ? COLORS.primaryDark : COLORS.textGray,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 2 ? 700 : 500,
              transition: 'all 0.2s ease',
              position: 'relative',
              marginBottom: '-2px'
            }
          },
            createElement('span', { style: { marginRight: '6px' } }, '🔧'),
            'JSON 编辑器',
            activeTab === 2 && createElement('span', {
              style: {
                marginLeft: '8px',
                fontSize: '11px',
                background: COLORS.primaryLight,
                color: COLORS.primary,
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600
              }
            }, 'JSON')
          ),

          // 页签4：表格视图
          createElement('button', {
            onClick: function() { switchTab(3); },
            style: {
              padding: '14px 24px',
              background: activeTab === 3 ? COLORS.bgWhite : 'transparent',
              border: 'none',
              borderBottom: activeTab === 3 ? `3px solid ${COLORS.success}` : '3px solid transparent',
              color: activeTab === 3 ? COLORS.success : COLORS.textGray,
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: activeTab === 3 ? 700 : 500,
              transition: 'all 0.2s ease',
              position: 'relative',
              marginBottom: '-2px'
            }
          },
            createElement('span', { style: { marginRight: '6px' } }, '📊'),
            '表格视图',
            activeTab === 3 && createElement('span', {
              style: {
                marginLeft: '8px',
                fontSize: '11px',
                background: COLORS.successLight,
                color: COLORS.success,
                padding: '2px 8px',
                borderRadius: '10px',
                fontWeight: 600
              }
            }, 'VIEW')
          )
        ),

        createElement('div', {
          style: {
            flex: 1,
            overflowY: 'auto',
            overflowX: 'visible',
            padding: '20px 24px',
            display: 'flex',
            flexDirection: 'column',
            minWidth: 0
          }
        },
          validateStatus && createElement('div', {
            style: {
              padding: '10px 16px',
              marginBottom: '16px',
              borderRadius: '8px',
              background: validateStatus.ok
                ? `linear-gradient(135deg, ${COLORS.successLight}, #ecfdf5)`
                : `linear-gradient(135deg, ${COLORS.errorLight}, #fef2f2)`,
              border: `1px solid ${validateStatus.ok ? COLORS.success : COLORS.error}`,
              color: validateStatus.ok ? '#065f46' : '#991b1b',
              fontSize: '13px',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: `0 2px 8px ${validateStatus.ok ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}`
            }
          },
            createElement('span', { style: { fontSize: '16px' } },
              validateStatus.ok ? '✅' : '❌'
            ),
            validateStatus.msg
          ),

          // ===== 页签1：文本编辑器 =====
          activeTab === 0 && createElement('div', {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }
          },
            createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: COLORS.bgWhite,
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`
              }
            },
              createElement('div', {
                style: {
                  display: 'flex',
                  gap: '16px',
                  fontSize: '12px',
                  color: COLORS.textGray
                }
              },
                createElement('span', null, '📏 行数: ', textContent.split('\n').length),
                createElement('span', null, '💾 大小: ', formatBytes(textContent.length)),
                createElement('span', null, '🔤 字符: ', textContent.length.toLocaleString())
              ),
              createElement('div', {
                style: {
                  fontSize: '11px',
                  color: COLORS.textGray,
                  fontStyle: 'italic'
                }
              }, '提示: 这是通用文本编辑器，可以用来编辑任意内容')
            ),
            createElement('textarea', {
              value: textContent,
              onChange: function(e) { setTextContent(e.target.value); },
              placeholder: '在此编辑通用文本，例如Markdown、JSON、普通内容...',
              spellCheck: false,
              style: {
                flex: 1,
                width: '100%',
                padding: '16px',
                fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                border: `2px solid ${COLORS.border}`,
                borderRadius: '12px',
                outline: 'none',
                resize: 'none',
                background: COLORS.bgWhite,
                color: COLORS.textDark,
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box'
              },
              onFocus: function(e) {
                e.target.style.borderColor = COLORS.primary;
                e.target.style.boxShadow = `0 0 0 3px ${COLORS.primaryLight}`;
              },
              onBlur: function(e) {
                e.target.style.borderColor = COLORS.border;
                e.target.style.boxShadow = 'none';
              }
            })
          ),

          // ===== 页签2：Markdown编辑器 =====
          activeTab === 1 && createElement('div', {
            style: {
              flex: 1,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px'
            }
          },
            createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }
            },
              createElement('div', {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  background: COLORS.bgWhite,
                  borderRadius: '8px',
                  border: `1px solid ${COLORS.border}`
                }
              },
                createElement('div', {
                  style: { fontSize: '13px', color: COLORS.textGray }
                }, 'Markdown 输入区'),
                createElement('div', {
                  style: { fontSize: '12px', color: COLORS.textGray }
                }, '支持标题 / 列表 / 代码块 / 链接')
              ),
              createElement('textarea', {
                value: markdownText,
                onChange: function(e) { setMarkdownText(e.target.value); },
                placeholder: '在此输入Markdown文本...\n\n示例:\n# 标题\n\n- 列表项1\n- 列表项2\n\n`inline code`\n\n```\nconsole.log("Hello")\n```',
                spellCheck: false,
                style: {
                  flex: 1,
                  width: '100%',
                  padding: '16px',
                  fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
                  fontSize: '13px',
                  lineHeight: '1.6',
                  border: `2px solid ${COLORS.border}`,
                  borderRadius: '12px',
                  outline: 'none',
                  resize: 'none',
                  background: COLORS.bgWhite,
                  color: COLORS.textDark,
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box',
                  minHeight: '100%'
                },
                onFocus: function(e) {
                  e.target.style.borderColor = COLORS.warning;
                  e.target.style.boxShadow = `0 0 0 3px ${COLORS.warningLight}`;
                },
                onBlur: function(e) {
                  e.target.style.borderColor = COLORS.border;
                  e.target.style.boxShadow = 'none';
                }
              })
            ),
            createElement('div', {
              style: {
                background: COLORS.bgWhite,
                borderRadius: '16px',
                border: `1px solid ${COLORS.border}`,
                padding: '18px',
                overflow: 'auto',
                minHeight: '100%'
              }
            },
              createElement('div', {
                style: {
                  marginBottom: '12px',
                  fontSize: '14px',
                  fontWeight: 700,
                  color: COLORS.primaryDark
                }
              }, 'Markdown 实时预览'),
              createElement('div', {
                style: {
                  color: COLORS.textDark,
                  lineHeight: '1.8'
                },
                dangerouslySetInnerHTML: { __html: renderMarkdownPreview(markdownText) }
              })
            )
          ),

          // ===== 页签3：JSON编辑器 =====
          activeTab === 2 && createElement('div', {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px'
            }
          },
            createElement('div', {
              style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                background: COLORS.bgWhite,
                borderRadius: '8px',
                border: `1px solid ${COLORS.border}`
              }
            },
              createElement('div', {
                style: {
                  display: 'flex',
                  gap: '16px',
                  fontSize: '12px',
                  color: COLORS.textGray
                }
              },
                createElement('span', null, '📏 行数: ', jsonText.split('\n').length),
                createElement('span', null, '💾 大小: ', formatBytes(jsonText.length)),
                createElement('span', null, '🔤 字符: ', jsonText.length.toLocaleString())
              ),
              createElement('div', {
                style: {
                  fontSize: '11px',
                  color: COLORS.textGray,
                  fontStyle: 'italic'
                }
              }, '提示: 这里为专用JSON编辑器，支持实时校验')
            ),
            createElement('textarea', {
              value: jsonText,
              onChange: function(e) {
                var newText = e.target.value;
                setJsonText(newText);
                clearTimeout(window._jsonValidateTimer);
                window._jsonValidateTimer = setTimeout(function() {
                  var result = validateAndParse(newText);
                  setParsedData(result.data);
                  setValidateStatus(result);
                }, 300);
              },
              placeholder: '在此粘贴或输入JSON文本...\n\n示例:\n{\n  "name": "张三",\n  "age": 25,\n  "skills": ["JavaScript", "Python"]\n}',
              spellCheck: false,
              style: {
                flex: 1,
                width: '100%',
                padding: '16px',
                fontFamily: '"SF Mono", "Fira Code", "Cascadia Code", Consolas, monospace',
                fontSize: '13px',
                lineHeight: '1.6',
                border: `2px solid ${COLORS.border}`,
                borderRadius: '12px',
                outline: 'none',
                resize: 'none',
                background: COLORS.bgWhite,
                color: COLORS.textDark,
                transition: 'border-color 0.2s ease',
                boxSizing: 'border-box'
              },
              onFocus: function(e) {
                e.target.style.borderColor = COLORS.primary;
                e.target.style.boxShadow = `0 0 0 3px ${COLORS.primaryLight}`;
              },
              onBlur: function(e) {
                e.target.style.borderColor = COLORS.border;
                e.target.style.boxShadow = 'none';
              },
              onKeyDown: function(e) {
                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                  e.preventDefault();
                  formatJSON();
                }
                if (e.key === 'Tab') {
                  e.preventDefault();
                  var start = e.target.selectionStart;
                  var end = e.target.selectionEnd;
                  var value = e.target.value;
                  e.target.value = value.substring(0, start) + '  ' + value.substring(end);
                  e.target.selectionStart = e.target.selectionEnd = start + 2;
                  var newText = e.target.value;
                  setJsonText(newText);
                  clearTimeout(window._jsonValidateTimer);
                  window._jsonValidateTimer = setTimeout(function() {
                    var result = validateAndParse(newText);
                    setParsedData(result.data);
                    setValidateStatus(result);
                  }, 300);
                }
              }
            })
          ),

          // ===== 页签4：表格视图 =====
          activeTab === 3 && createElement('div', {
            style: {
              flex: 1,
              display: 'flex',
              flexDirection: 'column'
            }
          },
            !parsedData && createElement('div', {
              style: {
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: COLORS.textGray,
                gap: '16px'
              }
            },
              createElement('div', { style: { fontSize: '64px', opacity: 0.3 } }, '📋'),
              createElement('div', {
                style: { fontSize: '18px', fontWeight: 600, color: COLORS.textDark }
              }, validateStatus && !validateStatus.ok ? '❌ JSON格式错误' : '暂无数据'),
              createElement('div', {
                style: { fontSize: '14px', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' }
              }, validateStatus && !validateStatus.ok
                ? validateStatus.msg
                : '请在"JSON 编辑器"页签中输入有效的JSON数据，然后切换到此页签查看表格视图。'
              )
            ),
            parsedData && renderDataTable(parsedData, onColResizeStart, getColWidth, columnWidthOverrides)
          )
        )
      )
    );
  }

  // ===== 表格渲染组件 =====
  function renderDataTable(data, onColResizeStart, getColWidth, columnWidthOverrides) {
    var dataType = Object.prototype.toString.call(data);

    // 数组类型 → 渲染为表格
    if (dataType === '[object Array]') {
      if (data.length === 0) {
        return createElement('div', {
          style: {
            textAlign: 'center',
            padding: '40px',
            color: COLORS.textGray
          }
        }, '📭 空数组');
      }

      // 检查是否为对象数组
      if (typeof data[0] === 'object' && data[0] !== null) {
        return renderObjectArrayTable(data, onColResizeStart, getColWidth, columnWidthOverrides);
      } else {
        // 简单值数组
        return renderSimpleArrayTable(data);
      }
    }

    // 对象类型 → 渲染为键值对表格
    if (dataType === '[object Object]') {
      return renderObjectTable(data, onColResizeStart, getColWidth, columnWidthOverrides);
    }

    // 基本类型 → 直接显示值
    return renderPrimitiveValue(data);
  }

  // ===== 智能列宽计算算法 =====
  function calculateColumnWidths(arr, keys) {
    var columnWidths = {};
    var totalWidth = 0;
    var containerWidth = 950;

    keys.forEach(function(key) {
      var values = arr.map(function(item) { return item[key]; });
      var maxContentLength = 0;
      var hasLongText = false;
      var hasArray = false;
      var hasNumberOnly = true;
      var avgValueLength = 0;

      values.forEach(function(val) {
        if (val === null || val === undefined) return;

        if (typeof val === 'number') {
          maxContentLength = Math.max(maxContentLength, String(val).length);
          avgValueLength += String(val).length;
        } else if (typeof val === 'string') {
          hasNumberOnly = false;
          maxContentLength = Math.max(maxContentLength, val.length);
          avgValueLength += val.length;
          if (val.length > 50) hasLongText = true;
        } else if (Array.isArray(val)) {
          hasNumberOnly = false;
          hasArray = true;
          var arrayContent = val.join(', ');
          maxContentLength = Math.max(maxContentLength, arrayContent.length);
          avgValueLength += arrayContent.length;
        } else if (typeof val === 'object') {
          hasNumberOnly = false;
          var objStr = JSON.stringify(val);
          maxContentLength = Math.max(maxContentLength, objStr.length);
          avgValueLength += objStr.length;
        }
      });

      avgValueLength = Math.ceil(avgValueLength / values.length);

      var keyNameLength = key.length;
      var estimatedWidth;

      if (hasArray) {
        estimatedWidth = Math.min(Math.max(180, keyNameLength * 12 + 80), 280);
      } else if (hasNumberOnly && maxContentLength <= 5) {
        estimatedWidth = Math.min(70, keyNameLength * 10 + 30);
      } else if (maxContentLength <= 15 && !hasLongText) {
        estimatedWidth = Math.min(100, Math.max(keyNameLength * 11 + 20, 90));
      } else if (maxContentLength <= 40 && !hasLongText) {
        estimatedWidth = Math.min(150, Math.max(keyNameLength * 11 + 30, 130));
      } else if (avgValueLength > 80 || hasLongText) {
        estimatedWidth = Math.min(320, Math.max(avgValueLength * 6.5, 260));
      } else {
        estimatedWidth = Math.min(200, Math.max(avgValueLength * 7.5, 160));
      }

      columnWidths[key] = estimatedWidth;
      totalWidth += estimatedWidth;
    });

    totalWidth += 60;

    return {
      widths: columnWidths,
      totalWidth: totalWidth,
      needsScroll: totalWidth > containerWidth,
      containerWidth: containerWidth
    };
  }

  // ===== 对象数组表格 =====
  function renderObjectArrayTable(arr, onColResizeStart, getColWidth, columnWidthOverrides) {
    // 收集所有字段
    var allKeys = [];
    arr.forEach(function(item) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(function(key) {
          if (allKeys.indexOf(key) === -1) {
            allKeys.push(key);
          }
        });
      }
    });

    // 计算智能列宽
    var widthInfo = calculateColumnWidths(arr, allKeys);

    // 应用用户自定义覆盖，计算实际列宽
    var effectiveWidths = {};
    var actualTotalWidth = 0;
    allKeys.forEach(function(key) {
      var w = getColWidth(key, widthInfo.widths[key], '');
      effectiveWidths[key] = w;
      actualTotalWidth += w;
    });
    actualTotalWidth += 60; // 序号列
    var needsScroll = actualTotalWidth > 950;

    return createElement('div', {
      style: {
        width: '100%',
        height: '100%',
        overflow: 'auto',
        background: COLORS.bgWhite,
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
      }
    },

      // 表格标题
      createElement('div', {
        style: {
          padding: '16px 20px',
          background: `linear-gradient(135deg, ${COLORS.primaryLight}, #e0e7ff)`,
          borderBottom: `2px solid ${COLORS.primary}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }
      },
        createElement('div', {
          style: { fontSize: '15px', fontWeight: 700, color: COLORS.primaryDark }
        }, '📊 数据表格'),
        createElement('div', {
          style: {
            fontSize: '12px',
            color: COLORS.textGray,
            background: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontWeight: 600
          }
        }, arr.length + ' 条记录 | ' + allKeys.length + ' 个字段' + (needsScroll ? ' | ↔ 可横向滚动' : ''))
      ),

      // 表格容器
      createElement('div', {
        style: Object.assign({
          width: '100%'
        }, needsScroll ? {
          overflowX: 'auto',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'auto',
          scrollbarColor: `${COLORS.primary} ${COLORS.bgLight}`
        } : {
          overflow: 'visible'
        })
      },
        createElement('table', {
          style: Object.assign({
            borderCollapse: 'collapse',
            fontSize: '13px'
          }, needsScroll ? {
            width: actualTotalWidth + 'px'
          } : {
            width: '100%',
            tableLayout: 'fixed'
          })
        },

          // 表头
          createElement('thead', null,
            createElement('tr', null,

              // 序号列
              createElement('th', {
                style: tableHeaderStyle(true)
              }, '#'),

              // 数据列（使用可拖拽宽度）
              allKeys.map(function(key) {
                var colWidth = effectiveWidths[key];
                return createElement('th', {
                  key: key,
                  style: Object.assign(tableHeaderStyle(), {
                    width: colWidth + 'px',
                    minWidth: colWidth + 'px',
                    maxWidth: (colWidth + 100) + 'px',
                    position: 'relative'
                  })
                },
                  createElement('div', {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }
                  },
                    createElement('span', {
                      style: { fontWeight: 700, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }, key),
                    // 列宽拖拽手柄
                    createElement('div', {
                      style: {
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        zIndex: 2,
                        background: 'transparent'
                      },
                      onMouseDown: function(e) {
                        onColResizeStart(key, colWidth, e, '');
                      },
                      // 悬停高亮
                      onMouseEnter: function(e) {
                        e.currentTarget.style.background = COLORS.primary;
                      },
                      onMouseLeave: function(e) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    })
                  )
                );
              })
            )
          ),

          // 表体
          createElement('tbody', null,
            arr.map(function(row, idx) {
              return createElement('tr', {
                key: idx,
                style: {
                  background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc',
                  transition: 'background 0.15s ease'
                },
                onMouseEnter: function(e) {
                  e.currentTarget.style.background = COLORS.primaryLight;
                },
                onMouseLeave: function(e) {
                  e.currentTarget.style.background = idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc';
                }
              },

                // 序号
                createElement('td', {
                  style: tableCellStyle(true)
                },
                  createElement('span', {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '24px',
                      height: '24px',
                      borderRadius: '50%',
                      background: idx % 2 === 0 ? COLORS.primary : COLORS.success,
                      color: 'white',
                      fontSize: '11px',
                      fontWeight: 700
                    }
                  }, idx + 1)
                ),

                // 数据单元格（使用实际列宽）
                allKeys.map(function(key) {
                  var value = row[key];
                  var colWidth = effectiveWidths[key];
                  return createElement('td', { key: key, style: Object.assign(tableCellStyle(false), {
                    width: colWidth + 'px',
                    maxWidth: (colWidth + 100) + 'px'
                  })},
                    renderCellValue(value)
                  );
                })
              );
            })
          )
        )
      )
    );
  }

  // ===== 简单数组表格 =====
  function renderSimpleArrayTable(arr) {
    return createElement('div', {
      style: {
        width: '100%',
        background: COLORS.bgWhite,
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        overflow: 'visible'
      }
    },
      createElement('div', {
        style: {
          padding: '16px 20px',
          background: `linear-gradient(135deg, ${COLORS.successLight}, #d1fae5)`,
          borderBottom: `2px solid ${COLORS.success}`,
          fontWeight: 700,
          color: '#065f46'
        }
      }, '📋 数组数据 (', arr.length, ' 个元素)'),
      createElement('div', {
        style: {
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '8px'
        }
      },
        arr.map(function(item, idx) {
          return createElement('div', {
            key: idx,
            style: {
              padding: '12px',
              background: idx % 2 === 0 ? COLORS.bgLight : COLORS.bgWhite,
              borderRadius: '8px',
              border: `1px solid ${COLORS.border}`,
              fontSize: '13px',
              fontFamily: 'monospace',
              wordBreak: 'break-all'
            }
          },
            createElement('span', {
              style: {
                marginRight: '8px',
                color: COLORS.textGray,
                fontWeight: 600
              }
            }, '[' + idx + ']:'),
            renderCellValue(item)
          );
        })
      )
    );
  }

  // ===== 对象键值对表格 =====
  function renderObjectTable(obj, onColResizeStart, getColWidth, columnWidthOverrides) {
    var keys = Object.keys(obj);

    return createElement('div', {
      style: {
        width: '100%',
        background: COLORS.bgWhite,
        borderRadius: '12px',
        border: `1px solid ${COLORS.border}`,
        overflow: 'visible'
      }
    },
      createElement('div', {
        style: {
          padding: '16px 20px',
          background: `linear-gradient(135deg, ${COLORS.warningLight}, #fef3c7)`,
          borderBottom: `2px solid ${COLORS.warning}`,
          fontWeight: 700,
          color: '#92400e'
        }
      }, '🔑 对象属性 (', keys.length, ' 个字段)'),
      createElement('table', {
        style: {
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed'
        }
      },
        createElement('tbody', null,
          keys.map(function(key, idx) {
            var value = obj[key];
            var isObjectArray = Array.isArray(value) && value.length > 0 && typeof value[0] === 'object' && value[0] !== null;

            if (isObjectArray) {
              return createElement('tr', { key: key },
                createElement('td', {
                  colSpan: 2,
                  style: {
                    padding: '16px',
                    background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc',
                    borderTop: idx > 0 ? `1px solid ${COLORS.border}` : 'none'
                  }
                },
                  createElement('div', {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '12px',
                      paddingBottom: '12px',
                      borderBottom: `2px dashed ${COLORS.border}`
                    }
                  },
                    createElement('div', null,
                      createElement('span', { style: { fontWeight: 700, color: COLORS.primaryDark, fontFamily: 'monospace', fontSize: '14px' } }, '🔑 ', key),
                      createElement('span', {
                        style: {
                          fontSize: '10px',
                          background: getTypeColor(value),
                          color: 'white',
                          padding: '2px 8px',
                          borderRadius: '8px',
                          fontWeight: 600,
                          marginLeft: '8px'
                        }
                      }, 'Array[' + value.length + ']')
                    ),
                    createElement('span', {
                      style: {
                        fontSize: '12px',
                        color: COLORS.textGray,
                        fontWeight: 600
                      }
                    }, '📊 包含 ', value.length, ' 条记录')
                  ),
                  renderNestedArrayTable(value, key, onColResizeStart, getColWidth, columnWidthOverrides)
                )
              );
            }

            return createElement('tr', {
              key: key,
              style: {
                background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc',
                borderTop: idx > 0 ? `1px solid ${COLORS.border}` : 'none'
              }
            },

              createElement('td', {
                style: {
                  padding: '12px 16px',
                  fontWeight: 700,
                  color: COLORS.primaryDark,
                  width: '30%',
                  verticalAlign: 'top',
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  background: idx % 2 === 0 ? `${COLORS.primaryLight}33` : 'transparent'
                }
              },

                createElement('div', { style: { marginBottom: '4px' } }, '🔑 ', key),

                createElement('span', {
                  style: {
                    fontSize: '10px',
                    background: getTypeColor(value),
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '8px',
                    fontWeight: 600,
                    textTransform: 'uppercase'
                  }
                }, typeof value)
              ),

              createElement('td', {
                style: {
                  padding: '12px 16px',
                  verticalAlign: 'top',
                  fontSize: '13px',
                  color: COLORS.textDark,
                  lineHeight: '1.6'
                }
              }, renderCellValue(value, true))
            );
          })
        )
      )
    );
  }

  // ===== 嵌套数组表格（用于在对象视图中展示对象数组）=====
  function renderNestedArrayTable(arr, parentKey, onColResizeStart, getColWidth, columnWidthOverrides) {
    var allKeys = [];
    arr.forEach(function(item) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(function(key) {
          if (allKeys.indexOf(key) === -1) {
            allKeys.push(key);
          }
        });
      }
    });

    // 计算嵌套表格的智能列宽
    var widthInfo = calculateColumnWidths(arr, allKeys);
    var namespace = parentKey || '';

    // 应用用户自定义覆盖，计算实际列宽
    var effectiveWidths = {};
    var actualTotalWidth = 0;
    allKeys.forEach(function(key) {
      var w = getColWidth(key, widthInfo.widths[key], namespace);
      effectiveWidths[key] = w;
      actualTotalWidth += w;
    });
    actualTotalWidth += 40; // 序号列
    var needsScroll = actualTotalWidth > 900;

    return createElement('div', null,
      createElement('div', {
        style: {
          marginBottom: '12px',
          fontSize: '12px',
          color: COLORS.textGray,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      },
        createElement('span', { style: { fontSize: '14px' } }, '📊'),
        '包含 ', arr.length, ' 条记录 | ', allKeys.length, ' 个字段' + (needsScroll ? ' | ↔ 可横向滚动' : '')
      ),
      createElement('div', {
        style: Object.assign({
          width: '100%'
        }, needsScroll ? {
          overflowX: 'auto',
          overflowY: 'visible',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'auto',
          scrollbarColor: `${COLORS.success} ${COLORS.bgLight}`
        } : {
          overflow: 'visible'
        })
      },
        createElement('table', {
          style: Object.assign({
            borderCollapse: 'collapse',
            fontSize: '12px',
            background: COLORS.bgLight,
            borderRadius: '8px'
          }, needsScroll ? {
            width: actualTotalWidth + 'px'
          } : {
            width: '100%',
            tableLayout: 'fixed'
          })
        },
          createElement('thead', null,
            createElement('tr', null,
              createElement('th', {
                style: {
                  padding: '10px 12px',
                  background: `linear-gradient(180deg, ${COLORS.successLight}, #d1fae5)`,
                  color: '#065f46',
                  fontWeight: 700,
                  fontSize: '11px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  borderBottom: `2px solid ${COLORS.success}`,
                  whiteSpace: 'nowrap',
                  textAlign: 'center',
                  width: '40px'
                }
              }, '#'),
              allKeys.map(function(key) {
                var colWidth = effectiveWidths[key];
                return createElement('th', {
                  key: key,
                  style: {
                    padding: '10px 12px',
                    background: `linear-gradient(180deg, ${COLORS.successLight}, #d1fae5)`,
                    color: '#065f46',
                    fontWeight: 700,
                    fontSize: '11px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    borderBottom: `2px solid ${COLORS.success}`,
                    whiteSpace: 'nowrap',
                    width: colWidth + 'px',
                    minWidth: colWidth + 'px',
                    maxWidth: (colWidth + 100) + 'px',
                    position: 'relative'
                  }
                },
                  createElement('div', {
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      overflow: 'hidden'
                    }
                  },
                    createElement('span', {
                      style: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
                    }, key),
                    // 列宽拖拽手柄
                    createElement('div', {
                      style: {
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: '6px',
                        cursor: 'col-resize',
                        zIndex: 2,
                        background: 'transparent'
                      },
                      onMouseDown: function(e) {
                        onColResizeStart(key, colWidth, e, namespace);
                      },
                      onMouseEnter: function(e) {
                        e.currentTarget.style.background = COLORS.success;
                      },
                      onMouseLeave: function(e) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    })
                  )
                );
              })
            )
          ),
          createElement('tbody', null,
            arr.map(function(row, idx) {
              return createElement('tr', {
                key: idx,
                style: {
                  background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc',
                  borderBottom: `1px solid ${COLORS.border}`
                },
                onMouseEnter: function(e) {
                  e.currentTarget.style.background = COLORS.successLight;
                },
                onMouseLeave: function(e) {
                  e.currentTarget.style.background = idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc';
                }
              },
                createElement('td', {
                  style: {
                    padding: '8px 10px',
                    textAlign: 'center',
                    borderBottom: `1px solid ${COLORS.border}`
                  }
                },
                  createElement('span', {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: idx % 2 === 0 ? COLORS.success : COLORS.primary,
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 700
                    }
                  }, idx + 1)
                ),
                allKeys.map(function(key) {
                  var value = row[key];
                  var colWidth = effectiveWidths[key];
                  return createElement('td', { key: key, style: {
                    padding: '10px 12px',
                    borderBottom: `1px solid ${COLORS.border}`,
                    verticalAlign: 'top',
                    lineHeight: '1.4',
                    width: colWidth + 'px',
                    maxWidth: (colWidth + 100) + 'px',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                    overflowWrap: 'break-word'
                  }},
                    renderCellValue(value)
                  );
                })
              );
            })
          )
        )
      )
    );
  }

  // ===== 基本类型值渲染 =====
  function renderPrimitiveValue(value) {
    var type = typeof value;

    return createElement('div', {
      style: {
        textAlign: 'center',
        padding: '40px',
        background: COLORS.bgWhite,
        borderRadius: '12px',
        border: `2px dashed ${COLORS.border}`
      }
    },
      createElement('div', { style: { fontSize: '48px', marginBottom: '16px', opacity: 0.5 } },
        type === 'string' ? '📝' : type === 'number' ? '🔢' : type === 'boolean' ? '☑️' : '❓'
      ),
      createElement('div', {
        style: {
          fontSize: '24px',
          fontWeight: 700,
          color: COLORS.textDark,
          fontFamily: 'monospace',
          marginBottom: '8px',
          wordBreak: 'break-all'
        }
      },
        typeof value === 'string' ? '"' + value + '"' : String(value)
      ),
      createElement('div', {
        style: {
          fontSize: '12px',
          color: COLORS.textGray,
          textTransform: 'uppercase',
          fontWeight: 600,
          letterSpacing: '1px'
        }
      }, type)
    );
  }

  // ===== 单元格值渲染 =====
  function renderCellValue(value, expanded) {
    var type = typeof value;

    // null
    if (value === null) {
      return createElement('span', {
        style: {
          color: COLORS.error,
          fontStyle: 'italic',
          fontWeight: 600
        }
      }, 'null');
    }

    // 字符串
    if (type === 'string') {
      return createElement('span', {
        style: {
          color: COLORS.success,
          fontFamily: expanded ? 'inherit' : 'monospace',
          wordBreak: 'break-word'
        }
      }, '"', value, '"');
    }

    // 数字
    if (type === 'number') {
      return createElement('span', {
        style: {
          color: COLORS.primary,
          fontWeight: 600,
          fontFamily: 'monospace'
        }
      }, value);
    }

    // 布尔值
    if (type === 'boolean') {
      return createElement('span', {
        style: {
          color: value ? COLORS.success : COLORS.error,
          fontWeight: 700,
          background: value ? COLORS.successLight : COLORS.errorLight,
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '11px'
        }
      }, value ? '✅ TRUE' : '❌ FALSE');
    }

    // 数组 - 展开显示内容
    if (Array.isArray(value)) {
      if (value.length === 0) {
        return createElement('span', {
          style: {
            color: COLORS.textGray,
            fontStyle: 'italic',
            fontSize: '11px'
          }
        }, '[] 空数组');
      }

      return createElement('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          maxWidth: expanded ? '100%' : '280px'
        }
      },
        value.map(function(item, itemIdx) {
          var itemType = typeof item;

          if (itemType === 'string') {
            return createElement('span', {
              key: itemIdx,
              style: {
                background: COLORS.warningLight,
                color: '#92400e',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontFamily: 'monospace',
                border: `1px solid ${COLORS.warning}`,
                display: 'inline-block',
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                title: item
              }
            }, item);
          }

          if (itemType === 'number') {
            return createElement('span', {
              key: itemIdx,
              style: {
                background: COLORS.primaryLight,
                color: COLORS.primaryDark,
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 600,
                fontFamily: 'monospace'
              }
            }, String(item));
          }

          if (itemType === 'boolean') {
            return createElement('span', {
              key: itemIdx,
              style: {
                background: item ? COLORS.successLight : COLORS.errorLight,
                color: item ? '#065f46' : '#991b1b',
                padding: '2px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700
              }
            }, item ? 'TRUE' : 'FALSE');
          }

          if (item === null) {
            return createElement('span', {
              key: itemIdx,
              style: {
                color: COLORS.error,
                fontStyle: 'italic',
                fontSize: '11px'
              }
            }, 'null');
          }

          if (Array.isArray(item)) {
            return createElement('span', {
              key: itemIdx,
              style: {
                background: COLORS.warningLight,
                color: '#92400e',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontStyle: 'italic'
              }
            }, '[Array(', item.length, ')]');
          }

          if (itemType === 'object') {
            var objKeys = Object.keys(item);
            return createElement('span', {
              key: itemIdx,
              style: {
                background: COLORS.primaryLight,
                color: COLORS.primaryDark,
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '10px',
                fontStyle: 'italic'
              }
            }, '{Object(', objKeys.length, ')}');
          }

          return createElement('span', {
            key: itemIdx,
            style: {
              background: COLORS.bgLight,
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '11px'
            }
          }, String(item));
        })
      );
    }

    // 对象 - 展开显示内容
    if (type === 'object') {
      var keys = Object.keys(value);

      if (keys.length === 0) {
        return createElement('span', {
          style: {
            color: COLORS.textGray,
            fontStyle: 'italic',
            fontSize: '11px'
          }
        }, '{} 空对象');
      }

      return createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          maxWidth: expanded ? '100%' : '280px'
        }
      },
        keys.map(function(key) {
          var itemValue = value[key];
          var itemType = typeof itemValue;

          if (itemType === 'string') {
            return createElement('div', {
              key: key,
              style: {
                display: 'flex',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }
            },
              createElement('span', {
                style: {
                  color: COLORS.primaryDark,
                  fontWeight: 600,
                  minWidth: '60px'
                }
              }, key + ':'),
              createElement('span', {
                style: {
                  color: COLORS.success,
                  background: `${COLORS.successLight}33`,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }
              }, '"' + itemValue + '"')
            );
          }

          if (itemType === 'number') {
            return createElement('div', {
              key: key,
              style: {
                display: 'flex',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }
            },
              createElement('span', {
                style: {
                  color: COLORS.primaryDark,
                  fontWeight: 600,
                  minWidth: '60px'
                }
              }, key + ':'),
              createElement('span', {
                style: {
                  color: COLORS.primary,
                  fontWeight: 600
                }
              }, String(itemValue))
            );
          }

          if (itemType === 'boolean') {
            return createElement('div', {
              key: key,
              style: {
                display: 'flex',
                gap: '4px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }
            },
              createElement('span', {
                style: {
                  color: COLORS.primaryDark,
                  fontWeight: 600,
                  minWidth: '60px'
                }
              }, key + ':'),
              createElement('span', {
                style: {
                  color: itemValue ? COLORS.success : COLORS.error,
                  fontWeight: 700,
                  background: itemValue ? COLORS.successLight : COLORS.errorLight,
                  padding: '1px 6px',
                  borderRadius: '4px'
                }
              }, itemValue ? 'true' : 'false')
            );
          }

          if (Array.isArray(itemValue)) {
            return createElement('div', { key: key, style: { fontSize: '11px' } },
              createElement('span', {
                style: {
                  color: COLORS.primaryDark,
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }
              }, key + ':'),
              renderCellValue(itemValue)
            );
          }

          if (itemType === 'object' && itemValue !== null) {
            var nestedKeys = Object.keys(itemValue);
            return createElement('div', { key: key, style: { fontSize: '11px' } },
              createElement('span', {
                style: {
                  color: COLORS.primaryDark,
                  fontWeight: 600,
                  fontFamily: 'monospace'
                }
              }, key + ':'),
              renderCellValue(itemValue)
            );
          }

          return createElement('div', {
            key: key,
            style: {
              display: 'flex',
              gap: '4px',
              fontSize: '11px',
              fontFamily: 'monospace'
            }
          },
            createElement('span', {
              style: {
                color: COLORS.primaryDark,
                fontWeight: 600,
                minWidth: '60px'
              }
            }, key + ':'),
            createElement('span', null, String(itemValue))
          );
        })
      );
    }

    return createElement('span', null, String(value));
  }

  // ===== 获取类型对应的颜色 =====
  function getTypeColor(value) {
    if (value === null) return COLORS.error;
    var type = typeof value;

    switch(type) {
      case 'string': return COLORS.success;
      case 'number': return COLORS.primary;
      case 'boolean': return value ? COLORS.success : COLORS.error;
      case 'object':
        return Array.isArray(value) ? COLORS.warning : COLORS.primaryDark;
      default: return COLORS.textGray;
    }
  }

  // ===== 表格表头样式 =====
  function tableHeaderStyle(isNumber) {
    return Object.assign({
      padding: '14px 16px',
      textAlign: 'left',
      background: `linear-gradient(180deg, ${COLORS.primaryLight}, #e0e7ff)`,
      color: COLORS.primaryDark,
      fontWeight: 700,
      fontSize: '12px',
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      borderBottom: `2px solid ${COLORS.primary}`,
      whiteSpace: 'nowrap',
      position: 'sticky',
      top: 0,
      zIndex: 1
    }, isNumber ? {
      width: '60px',
      textAlign: 'center'
    } : {});
  }

  // ===== 表格单元格样式 =====
  function tableCellStyle(isNumber) {
    return Object.assign({
      padding: '12px 16px',
      borderBottom: `1px solid ${COLORS.border}`,
      color: COLORS.textDark,
      verticalAlign: 'top',
      lineHeight: '1.5'
    }, isNumber ? {
      textAlign: 'center',
      width: '60px'
    } : {
      wordBreak: 'break-word',
      whiteSpace: 'pre-wrap',
      overflowWrap: 'break-word'
    });
  }

  // ===== 全局暴露（增强版）=====
  console.log('[JSON-Browser] 🎯 正在暴露全局接口...');

  window.JSONDataBrowser = {
    _initialized: true,
    _error: null,
    open: function() {
      console.log('[JSON-Browser] 🚀 open() 被调用');

      // 再次检查运行时依赖
      if (!window.React || !window.ReactDOM || !window.FloatingWindowReact) {
        alert('❌ 运行时错误：React组件未加载！\n\n请刷新页面后重试。');
        console.error('[JSON-Browser] ❌ 运行时依赖缺失');
        return;
      }

      try {
        // 如果已经打开，先关闭旧的
        var oldContainer = document.getElementById('json-browser-window');
        if (oldContainer) {
          console.log('[JSON-Browser] 🔄 关闭旧窗口');
          ReactDOM.unmountComponentAtNode(oldContainer);
          if (oldContainer.parentNode) oldContainer.parentNode.removeChild(oldContainer);
        }

        // 创建新容器
        var container = document.createElement('div');
        container.id = 'json-browser-window';
        // 注意：不设置 position 和 z-index，避免创建堆叠上下文限制子元素
        // FloatingWindowReact 组件会自行管理 position 和 z-index，支持点击置顶功能
        document.body.appendChild(container);

        console.log('[JSON-Browser] 📦 渲染组件...');

        // 渲染组件
        ReactDOM.render(createElement(JSONDataBrowser), container);

        console.log('[JSON-Browser] ✅ JSON数据浏览器已成功打开！');

      } catch (err) {
        console.error('[JSON-Browser] ❌ 打开失败:', err);
        alert('❌ 打开JSON数据浏览器失败！\n\n错误信息: ' + err.message + '\n\n请查看浏览器控制台获取详细信息。');
      }
    }
  };

  console.log('[JSON-Browser] ✅ JSONDataBrowser 模块已完全加载');
  console.log('[JSON-Browser] 💡 使用方法: window.JSONDataBrowser.open()');
  console.log('[JSON-Browser] 🎉 初始化完成！');

  } catch (initError) {
    // 捕获初始化过程中的任何错误
    console.error('[JSON-Browser] 💥 初始化过程中发生严重错误:', initError);
    console.error('[JSON-Browser] 堆栈信息:', initError.stack);

    window.JSONDataBrowser._initialized = false;
    window.JSONDataBrowser._error = '初始化错误: ' + initError.message;

    // 尝试显示错误提示
    setTimeout(function() {
      console.warn('[JSON-Browser] ⚠️ 模块加载失败，但接口已暴露（带错误状态）');
    }, 100);
  }

})();
