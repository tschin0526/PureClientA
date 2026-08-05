/**
 * 記錄詳情查看器 - 獨立可復用插件 v1.0
 * 
 * 功能：
 * - 以獨立浮動視窗顯示記錄詳細內容
 * - 支持任意格式的記錄數據
 * - 可在任何程式中調用，達到公用效果
 * 
 * 使用方式：
 *   window.RecordDetailViewer.show(recordData);
 *   
 * 參數格式：
 *   {
 *     id: '記錄ID',
 *     timestamp: '2026-05-20 06:46:15.193',
 *     type: 'request' | 'response',
 *     modelProvider: 'zhipu',
 *     modelName: 'glm-4.6v-flash',
 *     apiKeyName: 'TSCHIN#2',
 *     requestContent: { ... } | null,
 *     responseContent: { ... } | null
 *   }
 */

(function() {
  'use strict';

  // 檢查依賴
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('[RecordDetailViewer] React 或 ReactDOM 未加載！');
    return;
  }

  var useState = React.useState;
  var useCallback = React.useCallback;
  var useEffect = React.useEffect;
  var useRef = React.useRef;
  var createElement = React.createElement;

  /**
   * 記錄詳情組件（支持雙頁籤）
   */
  function RecordDetailComponent(props) {
    var record = props.record || {};

    // 頁籤狀態管理
    var _tabState = useState('raw'); // 'raw' | 'text'
    var activeTab = _tabState[0];
    var setActiveTab = _tabState[1];

    // 確定類型標籤
    var typeLabel = record.type === 'request' ? '📤 請求' : '📥 響應';
    var typeColor = record.type === 'request' ? '#3b82f6' : '#10b981';

    /**
     * 從 API 響應中提取 AI 回復的純文本（rawText）
     * 支持三種模型格式：方舟、智譜GLM、通義千問
     */
    function extractRawTextFromResponse(fullApiResponse, modelProvider) {
      if (!fullApiResponse) return '';

      try {
        var provider = modelProvider;

        // 自動檢測模型類型（如果未提供）
        if (!provider) {
          if (fullApiResponse.output && Array.isArray(fullApiResponse.output)) {
            provider = 'fangzhou';
          } else if (fullApiResponse.choices && Array.isArray(fullApiResponse.choices)) {
            provider = 'zhipu';
          }
        }

        if (provider === 'fangzhou') {
          // 方舟格式：data.output → message → content[].text
          if (fullApiResponse.output && fullApiResponse.output.length > 0) {
            var messageOutput = null;
            for (var i = 0; i < fullApiResponse.output.length; i++) {
              if (fullApiResponse.output[i].type === 'message' &&
                  fullApiResponse.output[i].role === 'assistant') {
                messageOutput = fullApiResponse.output[i];
                break;
              }
            }

            if (messageOutput && messageOutput.content && messageOutput.content.length > 0) {
              var textContent = null;
              for (var j = 0; j < messageOutput.content.length; j++) {
                if (messageOutput.content[j].type === 'output_text') {
                  textContent = messageOutput.content[j];
                  break;
                }
              }
              if (textContent && textContent.text) {
                return textContent.text;
              } else {
                return messageOutput.content[0].text || '';
              }
            } else {
              var fallback = fullApiResponse.output[0];
              if (fallback) {
                return (fallback.summary && fallback.summary.length > 0 && fallback.summary[0] && fallback.summary[0].text) ||
                       (fallback.content && fallback.content.length > 0 && fallback.content[0] && fallback.content[0].text) ||
                       '';
              }
            }
          }
        } else {
          // 智譜/通義格式：data.choices[0].message.content
          if (fullApiResponse.choices && fullApiResponse.choices.length > 0 &&
              fullApiResponse.choices[0] && fullApiResponse.choices[0].message) {
            return fullApiResponse.choices[0].message.content || '';
          }
        }
      } catch(err) {
        console.warn('[RecordDetailViewer] ⚠️ 提取 rawText 失敗:', err);
      }

      return '';
    }

    /**
     * 從記錄數據中獲取 AI 回復文本
     */
    function getResponseText() {
      // 優先使用已存儲的 rawText
      if (record.responseContent && record.responseContent.rawText) {
        return record.responseContent.rawText;
      }

      // 否則從 fullApiResponse 中動態提取
      if (record.responseContent && record.responseContent.fullApiResponse) {
        return extractRawTextFromResponse(
          record.responseContent.fullApiResponse,
          record.modelProvider
        );
      }

      return '';
    }

    // 獲取顯示用的數據
    var responseText = getResponseText();
    var hasRawText = responseText.length > 0;

    /**
     * 從文本中提取 JSON 數據（與 aiChatParserPlugin.js 一致）
     * 支持從 AI 回復文本中自動識別並提取 JSON 數組或對象
     */
    function extractJsonFromText(text) {
      if (!text) return null;
      var jsonPatterns = [
        /(\[[\s\S]*?\{[\s\S]*\}[\s\S]*?\])/g,
        /(\{[\s\S]*?\}[\s\S]*?(?=\n\n|\n$|$))/g
      ];
      for (var p = 0; p < jsonPatterns.length; p++) {
        var matches = text.match(jsonPatterns[p]);
        if (matches) {
          for (var i = 0; i < matches.length; i++) {
            try {
              var parsed = JSON.parse(matches[i]);
              if (Array.isArray(parsed) && parsed.length > 0) return matches[i];
              if (typeof parsed === 'object' && Object.keys(parsed).length > 0) return matches[i];
            } catch(e) {}
          }
        }
      }
      var bracketStart = text.indexOf('[');
      var braceStart = text.indexOf('{');
      if (bracketStart === -1 && braceStart === -1) return null;
      var startIdx = bracketStart >= 0 && (braceStart === -1 || bracketStart < braceStart) ? bracketStart : braceStart;
      var openChar = text[startIdx];
      var closeChar = openChar === '[' ? ']' : '}';
      var depth = 0;
      var endIdx = -1;
      for (var j = startIdx; j < text.length; j++) {
        if (text[j] === openChar) { depth++; }
        else if (text[j] === closeChar) { depth--; if (depth === 0) { endIdx = j + 1; break; } }
      }
      if (endIdx > startIdx) {
        try {
          var candidate = text.substring(startIdx, endIdx);
          JSON.parse(candidate);
          return candidate;
        } catch(e) {}
      }
      return null;
    }

    return createElement('div', {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        padding: '0'
      }
    },

      // 標題欄
      createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px',
          borderBottom: '2px solid #e2e8f0',
          background: '#f8fafc'
        }
      },
        createElement('h3', { style: { margin: 0, fontSize: '16px', color: '#1e293b', fontWeight: 600 } },
          '📋 记录详情'
        ),
        createElement('button', {
          onClick: function() {
            if (props.onClose) props.onClose();
          },
          style: {
            padding: '6px 14px',
            background: '#f1f5f9',
            border: '1px solid #cbd5e1',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#475569',
            fontWeight: 500
          }
        }, '✕ 关闭')
      ),

      // 內容區域
      createElement('div', {
        style: {
          flex: 1,
          overflow: 'auto',
          padding: '20px'
        }
      },

        // 基本信息卡片
        createElement('div', {
          style: {
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '16px'
          }
        },

          // ID
          createElement('div', { style: { marginBottom: '10px', display: 'flex', alignItems: 'baseline' } },
            createElement('strong', { style: { color: '#64748b', fontSize: '12px', minWidth: '70px' } }, 'ID：'),
            createElement('span', { style: { color: '#1e293b', fontSize: '13px', fontFamily: 'Monaco, monospace', wordBreak: 'break-all' } },
              (record.id || '').substring(0, 30) + ((record.id || '').length > 30 ? '...' : '')
            )
          ),

          // 時序
          createElement('div', { style: { marginBottom: '10px', display: 'flex', alignItems: 'baseline' } },
            createElement('strong', { style: { color: '#64748b', fontSize: '12px', minWidth: '70px' } }, '時序：'),
            createElement('span', { style: { color: '#1e293b', fontSize: '13px' } },
              record.timestamp || '-'
            )
          ),

          // 類型
          createElement('div', { style: { marginBottom: '10px', display: 'flex', alignItems: 'center' } },
            createElement('strong', { style: { color: '#64748b', fontSize: '12px', minWidth: '70px' } }, '類型：'),
            createElement('span', {
              style: {
                padding: '4px 12px',
                borderRadius: '6px',
                background: typeColor,
                color: '#fff',
                fontSize: '12px',
                fontWeight: 600,
                display: 'inline-block'
              }
            }, typeLabel)
          ),

          // 模型
          (record.modelName || record.modelProvider) && createElement('div', { style: { marginBottom: '10px', display: 'flex', alignItems: 'baseline' } },
            createElement('strong', { style: { color: '#64748b', fontSize: '12px', minWidth: '70px' } }, '模型：'),
            createElement('span', { style: { color: '#1e293b', fontSize: '13px' } },
              (record.modelProvider || '') + ' / ' + (record.modelName || '')
            )
          ),

          // API Key
          record.apiKeyName && createElement('div', { style: { display: 'flex', alignItems: 'baseline' } },
            createElement('strong', { style: { color: '#64748b', fontSize: '12px', minWidth: '70px' } }, 'API Key：'),
            createElement('span', { style: { color: '#1e293b', fontSize: '13px', fontFamily: 'Monaco, monospace' } },
              record.apiKeyName
            )
          )
        ),

        // 🔥 內容詳情 - 雙頁籤
        createElement('div', null,

          // 頁籤標題
          createElement('div', {
            style: {
              marginBottom: '12px',
              fontWeight: 600,
              color: '#1e293b',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }
          },
            createElement('span', { style: { fontSize: '16px' } }, '📦'),
            '内容详情:'
          ),

          // 頁籤切換按鈕
          createElement('div', {
            style: {
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              borderBottom: '2px solid #e2e8f0',
              paddingBottom: '8px'
            }
          },

            // 頁籤 1：原始資料
            createElement('button', {
              onClick: function() { setActiveTab('raw'); },
              style: {
                padding: '8px 16px',
                background: activeTab === 'raw' ? '#3b82f6' : '#f1f5f9',
                color: activeTab === 'raw' ? '#fff' : '#475569',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === 'raw' ? 600 : 400,
                transition: 'all 0.2s'
              }
            }, '📋 原始資料'),

            // 頁籤 2：AI 回復文本（僅在有回復文本時顯示）
            hasRawText && createElement('button', {
              onClick: function() { setActiveTab('text'); },
              style: {
                padding: '8px 16px',
                background: activeTab === 'text' ? '#10b981' : '#f1f5f9',
                color: activeTab === 'text' ? '#fff' : '#475569',
                border: 'none',
                borderRadius: '6px 6px 0 0',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: activeTab === 'text' ? 600 : 400,
                transition: 'all 0.2s'
              }
            }, '💬 AI 回復文本')
          ),

          // 頁籤內容區域
          createElement('div', {
            style: {
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              padding: '16px',
              overflow: 'auto',
              maxHeight: '450px'
            }
          },

            // ===== 頁籤 1：原始 JSON 資料 =====
            activeTab === 'raw' && createElement('div', null,

              // 工具欄：包含 JSON表格視圖按鈕（參考 aiChatParserPlugin.js）
              createElement('div', {
                style: {
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center',
                  marginBottom: '10px'
                }
              },

                // JSON表格視圖按鈕（與截圖一功能一致）
                createElement('button', {
                  onClick: function(e) {
                    e.stopPropagation();
                    // ✅ 關鍵修正：與 aiChatParserPlugin.js 一致的處理邏輯
                    var jsonText = extractJsonFromText(responseText);
                    if (jsonText) {
                      try {
                        if (window.JsonTableViewer && window.JsonTableViewer.show) {
                          window.JsonTableViewer.show(jsonText, '⊞ JSON 数据表格视图');
                        } else {
                          console.warn('[RecordDetailViewer] ⚠️ JsonTableViewer 未加载');
                          alert('⚠️ JSON表格视图组件未加载！\n\n请确保 JsonTableViewerPlugin.js 已正确引入。');
                        }
                      } catch(err) {
                        console.error('[RecordDetailViewer] ❌ 打开表格视图失败:', err);
                      }
                    } else {
                      // 如果從 responseText 提取不到 JSON，嘗試使用 parsedData
                      var parsedData = record.responseContent && record.responseContent.parsedData;
                      if (parsedData && typeof parsedData === 'object' && Object.keys(parsedData).length > 0) {
                        try {
                          if (window.JsonTableViewer && window.JsonTableViewer.show) {
                            window.JsonTableViewer.show(parsedData, '⊞ JSON 数据表格视图');
                          }
                        } catch(err) {
                          console.error('[RecordDetailViewer] ❌ 打开表格视图失败:', err);
                        }
                      } else {
                        alert('⚠️ 未找到可显示的 JSON 数据！\n\n当前记录的 AI 回复文本中不包含有效的 JSON 格式数据。');
                      }
                    }
                  },
                  title: 'JSON表格視圖',
                  style: {
                    background: 'transparent',
                    border: 'none',
                    padding: '4px 8px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#888',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    transition: 'all 0.2s ease'
                  },
                  onMouseEnter: function(e) {
                    e.target.style.background = '#e0e7ff';
                    e.target.style.color = '#3b82f6';
                  },
                  onMouseLeave: function(e) {
                    e.target.style.background = 'transparent';
                    e.target.style.color = '#888';
                  }
                },
                  createElement('svg', {
                    width: '14',
                    height: '14',
                    viewBox: '0 0 16 16',
                    fill: 'none',
                    style: { display: 'block' }
                  },
                    createElement('rect', {
                      x: '1', y: '1', width: '14', height: '14',
                      rx: '2.5', ry: '2.5',
                      stroke: '#3b82f6',
                      strokeWidth: '1.5',
                      fill: 'white'
                    }),
                    createElement('line', { x1: '1', y1: '6', x2: '15', y2: '6', stroke: '#3b82f6', strokeWidth: '1' }),
                    createElement('line', { x1: '1', y1: '10', x2: '15', y2: '10', stroke: '#3b82f6', strokeWidth: '1' }),
                    createElement('line', { x1: '5.5', y1: '1', x2: '5.5', y2: '15', stroke: '#3b82f6', strokeWidth: '1' }),
                    createElement('line', { x1: '10.5', y1: '1', x2: '10.5', y2: '15', stroke: '#3b82f6', strokeWidth: '1' })
                  ),
                  'JSON表格視圖'
                )
              ),

              // JSON 數據顯示區域
              createElement('pre', {
                style: {
                  margin: '0',
                  fontSize: '11px',
                  fontFamily: 'Monaco, Menlo, monospace',
                  lineHeight: '1.6',
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word'
                }
              },
                JSON.stringify(record.requestContent || record.responseContent || {}, null, 2)
              )
            ),

            // ===== 頁籤 2：AI 回復純文本 =====
            activeTab === 'text' && createElement('div', null,

              // 如果沒有回復文本，顯示提示
              !hasRawText && createElement('div', {
                style: {
                  padding: '20px',
                  textAlign: 'center',
                  color: '#94a3b8',
                  fontSize: '14px'
                }
              }, '⚠️ 此記錄無法提取 AI 回復文本'),

              // 如果有回復文本，格式化顯示
              hasRawText && createElement('pre', {
                style: {
                  margin: '0',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '6px',
                  fontSize: '12px',
                  lineHeight: '1.7',
                  color: '#1e293b',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  border: '1px solid #e2e8f0',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
                }
              }, responseText)
            )
          )
        )
      )
    );
  }

  /**
   * 打開記錄詳情視窗
   * @param {Object} recordData - 記錄數據對象
   */
  function show(recordData) {
    try {
      console.log('[RecordDetailViewer] 🚀 正在打開記錄詳情...');

      // 檢查必要依賴
      if (typeof window.FloatingWindowReact === 'undefined') {
        alert('❌ 浮動窗口組件未加載！\n\n請檢查 FloatingWindowReact.js 是否正確加載。');
        return;
      }

      if (!recordData) {
        alert('❌ 未提供記錄數據！');
        return;
      }

      // 生成唯一容器 ID
      var containerId = 'record-detail-viewer-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

      // 如果已存在舊的容器，先移除
      var existing = document.getElementById(containerId);
      if (existing) {
        ReactDOM.unmountComponentAtNode(existing);
        if (existing.parentNode) existing.remove();
      }

      // 創建容器
      var container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);

      // 渲染組件
      ReactDOM.render(
        createElement(window.FloatingWindowReact, {
          isOpen: true,
          width: '700px',
          height: '650px',
          onClose: function() {
            ReactDOM.unmountComponentAtNode(container);
            if (container.parentNode) container.remove();
          },
          title: '📋 记录详情查看器 (RecordDetailViewer.js)'
        },
          createElement(RecordDetailComponent, {
            record: recordData,
            onClose: function() {
              ReactDOM.unmountComponentAtNode(container);
              if (container.parentNode) container.remove();
            }
          })
        ),
        container
      );

      console.log('[RecordDetailViewer] ✅ 記錄詳情視窗已成功打開！');
      
    } catch(err) {
      console.error('[RecordDetailViewer] ❌ 打開失敗:', err);
      alert('❌ 打開記錄詳情失敗！\n\n錯誤信息: ' + err.message);
    }
  }

  // ===== 導出 =====
  window.RecordDetailViewer = {
    show: show,
    Component: RecordDetailComponent
  };

  console.log('[RecordDetailViewer] ✅ 記錄詳情查看器模組已加載（v1.0 - 獨立可復用版本）');

})();
