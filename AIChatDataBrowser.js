/**
 * AI Chat 数据浏览器 - 生产稳定版 v2.0
 * 
 * 功能：
 * - 表格形式浏览 IndexedDB 中的所有记录
 * - 支持按类型筛选（请求/响应）
 * - 查看详细内容（JSON 格式）
 * - 删除单条或清空所有记录
 * - 显示统计信息
 */

(function() {
  'use strict';

  // 检查依赖
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('[AI-Chat-Browser] React 或 ReactDOM 未加载！');
    return;
  }

  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var useRef = React.useRef;
  var createElement = React.createElement;

  /**
   * 数据浏览器主组件（带安全错误处理）
   */
  function DataBrowser(props) {
    var _state1 = useState([]);
    var records = _state1[0];
    var setRecords = _state1[1];

    var _state2 = useState(null);
    var selectedRecord = _state2[0];
    var setSelectedRecord = _state2[1];

    var _state2b = useState(false);
    var showDetailModal = _state2b[0];
    var setShowDetailModal = _state2b[1];

    var _state3 = useState('all');
    var filterType = _state3[0];
    var setFilterType = _state3[1];

    var _state4 = useState({
      total: 0,
      requests: 0,
      responses: 0,
      totalSize: 0
    });
    var stats = _state4[0];
    var setStats = _state4[1];

    var _state5 = useState(false);
    var isLoading = _state5[0];
    var setIsLoading = _state5[1];

    var _state6 = useState(null);
    var error = _state6[0];
    var setError = _state6[1];

    // 🆕 批量删除：选中的记录 ID
    var _state7 = useState([]);
    var selectedIds = _state7[0];
    var setSelectedIds = _state7[1];

    // 安全加载数据
    var loadData = useCallback(function() {
      setIsLoading(true);
      setError(null);

      // 检查 AIChatDB 是否可用
      if (typeof window.AIChatDB === 'undefined') {
        setError('⚠️ AIChatDB 未加载！请刷新页面后重试。');
        setIsLoading(false);
        return;
      }

      // 获取统计信息
      if (window.AIChatDB.getStats) {
        window.AIChatDB.getStats().then(function(s) {
          setStats(s || { total: 0, requests: 0, responses: 0, totalSize: 0 });
        }).catch(function(err) {
          console.error('获取统计失败:', err);
          // 不设置错误，继续执行
        });
      }

      // 获取记录
      var getPromise;
      if (filterType === 'all') {
        if (window.AIChatDB.getAll) {
          console.log('[AI-Chat-Browser] 📡 调用 getAll(100)...');
          getPromise = window.AIChatDB.getAll(100).then(function(data) {
            console.log('[AI-Chat-Browser] 📦 getAll 返回:', data);
            console.log('[AI-Chat-Browser] 📊 数据类型:', typeof data);
            console.log('[AI-Chat-Browser] 📏 数据长度:', data ? data.length : 'null');
            
            if (!data || !Array.isArray(data)) {
              console.error('[AI-Chat-Browser] ❌ 返回的不是数组！');
              return [];
            }
            
            return data;
          });
        } else {
          console.warn('[AI-Chat-Browser] ⚠️ getAll 方法不存在！');
          getPromise = Promise.resolve([]);
        }
      } else {
        if (window.AIChatDB.getByType) {
          console.log('[AI-Chat-Browser] 📡 调用 getByType(' + filterType + ', 100)...');
          getPromise = window.AIChatDB.getByType(filterType, 100).then(function(data) {
            console.log('[AI-Chat-Browser] 📦 getByType 返回:', data);
            return data || [];
          });
        } else {
          console.warn('[AI-Chat-Browser] ⚠️ getByType 方法不存在！');
          getPromise = Promise.resolve([]);
        }
      }

      getPromise.then(function(data) {
        console.log('[AI-Chat-Browser] ✅ 准备设置 records, 数量:', data ? data.length : 0);
        setRecords(data || []);
        setIsLoading(false);
      }).catch(function(err) {
        console.error('[AI-Chat-Browser] ❌ 加载数据失败:', err);
        setError('❌ 加载数据失败: ' + err.message);
        setRecords([]);
        setIsLoading(false);
      });
    }, [filterType]);

    // 初始加载
    useEffect(function() {
      loadData();
    }, [loadData]);

    // 删除记录
    var handleDelete = useCallback(function(id) {
      if (!confirm('确定要删除这条记录吗？')) return;

      if (!window.AIChatDB || !window.AIChatDB.delete) {
        alert('❌ 删除功能不可用');
        return;
      }

      window.AIChatDB.delete(id).then(function() {
        loadData();
        setSelectedRecord(null);
        alert('✅ 记录已删除');
      }).catch(function(err) {
        alert('❌ 删除失败: ' + err.message);
      });
    }, [loadData]);

    // 🆕 切换单条记录的选择状态
    var toggleSelect = useCallback(function(id) {
      setSelectedIds(function(prev) {
        if (prev.indexOf(id) !== -1) {
          return prev.filter(function(x) { return x !== id; });
        } else {
          return prev.concat([id]);
        }
      });
    }, []);

    // 🆕 全选 / 取消全选
    var toggleSelectAll = useCallback(function() {
      if (selectedIds.length === records.length) {
        setSelectedIds([]);
      } else {
        var allIds = records.map(function(r) { return r.id; });
        setSelectedIds(allIds);
      }
    }, [selectedIds, records]);

    // 🆕 批量删除选中的记录
    var handleBatchDelete = useCallback(function() {
      if (selectedIds.length === 0) {
        alert('⚠️ 请先勾选要删除的记录！');
        return;
      }
      if (!confirm('⚠️ 确定要删除选中的 ' + selectedIds.length + ' 条记录吗？此操作不可恢复！')) return;

      if (!window.AIChatDB) {
        alert('❌ 删除功能不可用');
        return;
      }

      // 优先使用批量删除方法
      var deletePromise;
      if (window.AIChatDB.deleteMany) {
        deletePromise = window.AIChatDB.deleteMany(selectedIds);
      } else if (window.AIChatDB.delete) {
        // 退回到逐条删除
        var promises = selectedIds.map(function(id) { return window.AIChatDB.delete(id); });
        deletePromise = Promise.all(promises);
      } else {
        alert('❌ 删除功能不可用');
        return;
      }

      deletePromise.then(function() {
        setSelectedIds([]);
        loadData();
        setSelectedRecord(null);
        alert('✅ 已删除 ' + selectedIds.length + ' 条记录');
      }).catch(function(err) {
        alert('❌ 删除失败: ' + err.message);
      });
    }, [selectedIds, loadData]);

    // 导出数据为 JSON
    var handleExport = useCallback(function() {
      if (records.length === 0) {
        alert('⚠️ 没有数据可以导出');
        return;
      }

      try {
        var dataStr = JSON.stringify(records, null, 2);
        var blob = new Blob([dataStr], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        
        var link = document.createElement('a');
        link.href = url;
        link.download = 'ai_chat_data_' + new Date().toISOString().slice(0,10) + '.json';
        link.click();
        
        URL.revokeObjectURL(url);
        alert('✅ 数据已导出为 JSON 文件');
      } catch(err) {
        alert('❌ 导出失败: ' + err.message);
      }
    }, [records]);

    // 渲染表格行
      function renderTableRow(record, index) {
        var bgColor = record.type === 'request' ? '#eff6ff' : '#f0fdf4';
        var typeLabel = record.type === 'request' ? '请求' : '响应';
        var typeBgColor = record.type === 'request' ? '#3b82f6' : '#10b981';
        var typeTextColor = '#fff';
        var isSelected = selectedIds.indexOf(record.id) !== -1;
      
      // 获取内容摘要
      var contentSummary = '';
      function safeStr(val) {
        if (val == null) return '';
        if (typeof val === 'string') return val;
        if (typeof val === 'object' && val.text !== undefined) return String(val.text);
        return String(val);
      }
      if (record.type === 'request' && record.requestContent) {
        var _prompt = safeStr(record.requestContent.prompt);
        contentSummary = _prompt.substring(0, 200) + (_prompt.length > 200 ? '...' : '');
        if (record.requestContent.files && record.requestContent.files.length > 0) {
          contentSummary += ' [' + record.requestContent.files.length + '图]';
        }
      } else if (record.type === 'response' && record.responseContent) {
        var _rawText = safeStr(record.responseContent.rawText);

        if (!_rawText && record.responseContent.fullApiResponse) {
          try {
            var _api = record.responseContent.fullApiResponse;

            if (_api.choices && _api.choices.length > 0 &&
                _api.choices[0] && _api.choices[0].message) {
              _rawText = _api.choices[0].message.content || '';
            } else if (_api.output && _api.output.length > 0) {
              var _findMsg = function(items) {
                for (var i = 0; i < items.length; i++) {
                  if (items[i].type === 'message' && items[i].role === 'assistant') {
                    return items[i];
                  }
                }
                return null;
              };
              var _msgObj = _findMsg(_api.output);

              if (_msgObj && _msgObj.content && _msgObj.content.length > 0) {
                var _findText = function(contents) {
                  for (var j = 0; j < contents.length; j++) {
                    if (contents[j].type === 'output_text') {
                      return contents[j];
                    }
                  }
                  return null;
                };
                var _textObj = _findText(_msgObj.content);
                _rawText = _textObj ? _textObj.text : (_msgObj.content[0].text || '');
              } else if (_api.output[0]) {
                var _fallback = _api.output[0];
                _rawText = (_fallback.summary && _fallback.summary.length > 0 && _fallback.summary[0] && _fallback.summary[0].text) ||
                           (_fallback.content && _fallback.content.length > 0 && _fallback.content[0] && _fallback.content[0].text) ||
                           '';
              }
            }
          } catch(_e) {
            console.warn('[AI-Chat-Browser] 提取 rawText 失敗:', _e);
          }
        }

        contentSummary = _rawText.substring(0, 200) + (_rawText.length > 200 ? '...' : '');
      }

      return createElement('tr', {
        key: record.id || index,
        style: {
          background: isSelected ? '#fef3c7' : (index % 2 === 0 ? bgColor : '#fff'),
          cursor: 'pointer',
          transition: 'background 0.2s'
        },
        onClick: function() {
          if (window.RecordDetailViewer && typeof window.RecordDetailViewer.show === 'function') {
            window.RecordDetailViewer.show(record);
          } else {
            console.warn('[AI-Chat-Browser] ⚠️ RecordDetailViewer 未加載，使用備用方案');
            setSelectedRecord(record);
            setShowDetailModal(true);
          }
        },
        onMouseEnter: function(e) { if (!isSelected) e.currentTarget.style.background = '#e0f2fe'; },
        onMouseLeave: function(e) { e.currentTarget.style.background = isSelected ? '#fef3c7' : (index % 2 === 0 ? bgColor : '#fff'); }
      },
        // 🆕 第一列：复选框
        createElement('td', {
          onClick: function(e) { e.stopPropagation(); },
          style: {
            padding: '8px',
            textAlign: 'center',
            width: '36px'
          }
        },
          createElement('input', {
            type: 'checkbox',
            checked: isSelected,
            onChange: function() { toggleSelect(record.id); },
            onClick: function(e) { e.stopPropagation(); },
            style: {
              width: '16px',
              height: '16px',
              cursor: 'pointer',
              accentColor: '#f59e0b'
            }
          })
        ),
        createElement('td', { style: { padding: '8px', fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' } }, 
          record.timestamp || '-'
        ),
        createElement('td', { style: { padding: '8px', fontSize: '12px', fontWeight: 600 } },
          createElement('span', {
            style: {
              padding: '4px 12px',
              borderRadius: '6px',
              background: typeBgColor,
              color: typeTextColor,
              fontSize: '11px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              boxShadow: record.type === 'request' 
                ? '0 2px 4px rgba(59, 130, 246, 0.3)' 
                : '0 2px 4px rgba(16, 185, 129, 0.3)'
            }
          }, typeLabel)
        ),
        createElement('td', { style: { padding: '8px', fontSize: '11px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } },
          record.modelName || '-'
        ),
        createElement('td', {
          style: {
            padding: '10px 12px',
            fontSize: '11px',
            lineHeight: '1.4',
            wordBreak: 'break-word',
            display: '-webkit-box',
            WebkitLineClamp: '3',
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxHeight: 'calc(1.4em * 3 + 20px)'
          }
        },
          contentSummary || '-'
        ),
        createElement('td', { style: { padding: '8px', textAlign: 'center' } },
          createElement('button', {
            onClick: function(e) {
              e.stopPropagation();
              handleDelete(record.id);
            },
            title: '删除此记录',
            style: {
              padding: '4px 8px',
              background: '#fee2e2',
              border: '1px solid #ef4444',
              borderRadius: '4px',
              color: '#dc2626',
              cursor: 'pointer',
              fontSize: '10px'
            }
          }, '🗑️')
        )
      );
    }

    // 渲染详情面板
    function renderDetailPanel() {
      if (!selectedRecord) {
        return createElement('div', {
          style: {
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '14px'
          }
        }, '👆 点击左侧表格查看详细信息');
      }

      return createElement('div', {
        style: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderLeft: '2px solid #e2e8f0',
          padding: '16px',
          overflow: 'auto'
        }
      },
        // 标题栏
        createElement('div', {
          style: {
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            paddingBottom: '12px',
            borderBottom: '2px solid #e2e8f0'
          }
        },
          createElement('h3', { style: { margin: 0, fontSize: '16px', color: '#1e293b' } },
            '📋 记录详情'
          ),
          createElement('button', {
            onClick: function() { setShowDetailModal(false); },
            style: {
              padding: '6px 12px',
              background: '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px'
            }
          }, '✕ 关闭')
        ),

        // 基本信息
        createElement('div', { style: { marginBottom: '16px' } },
          createElement('div', { style: { marginBottom: '8px' } },
            createElement('strong', null, 'ID: '),
            selectedRecord.id || '-'
          ),
          createElement('div', { style: { marginBottom: '8px' } },
            createElement('strong', null, '时序: '),
            selectedRecord.timestamp || '-'
          ),
          createElement('div', { style: { marginBottom: '8px' } },
            createElement('strong', null, '类型: '),
            selectedRecord.type === 'request' ? '📤 请求' : '📥 响应'
          ),
          createElement('div', { style: { marginBottom: '8px' } },
            createElement('strong', null, '模型: '),
            (selectedRecord.modelProvider || '') + ' / ' + (selectedRecord.modelName || '')
          ),
          createElement('div', { style: { marginBottom: '8px' } },
            createElement('strong', null, 'API Key: '),
            selectedRecord.apiKeyName || '-'
          )
        ),

        // 内容详情
        createElement('div', { style: { marginBottom: '8px', fontWeight: 600, color: '#1e293b' } },
          '📦 内容详情:'
        ),
        
        createElement('pre', {
          style: {
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '11px',
            overflow: 'auto',
            maxHeight: '400px',
            fontFamily: 'Monaco, Menlo, monospace',
            lineHeight: '1.5',
            color: '#334155'
          }
        },
          JSON.stringify(selectedRecord.requestContent || selectedRecord.responseContent || {}, null, 2)
        )
      );
    }

    // 错误状态
    if (error) {
      return createElement('div', {
        style: {
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fef2f2',
          padding: '40px'
        }
      },
        createElement('div', { style: { fontSize: '64px', marginBottom: '20px' } }, '⚠️'),
        createElement('h2', { 
          style: { 
            color: '#991b1b', 
            fontSize: '24px', 
            marginBottom: '16px' 
          } 
        }, '出现错误'),
        createElement('p', { 
          style: { 
            color: '#dc2626', 
            fontSize: '14px',
            textAlign: 'center',
            marginBottom: '30px',
            maxWidth: '400px'
          } 
        }, error),
        createElement('button', {
          onClick: loadData,
          style: {
            padding: '12px 30px',
            background: '#dc2626',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '16px',
            cursor: 'pointer',
            fontWeight: 'bold'
          }
        }, '🔄 重试')
      );
    }

    // 主渲染
    return createElement('div', {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: '8px',
        overflow: 'hidden'
      }
    },

      // 工具栏
      createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          background: '#f8fafc',
          borderBottom: '2px solid #e2e8f0',
          flexShrink: 0
        }
      },

        // 左侧：标题和统计
        createElement('div', null,
          createElement('h2', { style: { margin: 0, fontSize: '18px', color: '#1e293b' } },
            '💾 AI 对话数据库浏览器'
          ),
          stats && createElement('div', {
            style: { marginTop: '4px', fontSize: '12px', color: '#64748b' }
          },
            '共 ' + stats.total + ' 条记录 | ',
            '请求: ' + stats.requests + ' | ',
            '响应: ' + stats.responses,
            stats.totalSize > 1024 * 1024 
              ? (' | 大小: ' + (stats.totalSize / 1024 / 1024).toFixed(2) + ' MB')
              : (' | 大小: ' + Math.round(stats.totalSize / 1024) + ' KB')
          )
        ),

        // 右侧：操作按钮
        createElement('div', {
          style: { display: 'flex', gap: '8px', alignItems: 'center' }
        },
          // 筛选器
          createElement('select', {
            value: filterType,
            onChange: function(e) { setFilterType(e.target.value); },
            style: {
              padding: '6px 12px',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              fontSize: '12px',
              cursor: 'pointer'
            }
          },
            createElement('option', { value: 'all' }, '全部'),
            createElement('option', { value: 'request' }, '仅请求'),
            createElement('option', { value: 'response' }, '仅响应')
          ),

          // 刷新按钮
          createElement('button', {
            onClick: loadData,
            disabled: isLoading,
            title: '刷新数据',
            style: {
              padding: '6px 12px',
              background: '#3b82f6',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: isLoading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: isLoading ? 0.6 : 1
            }
          }, isLoading ? '⏳ 刷新中...' : '🔄 刷新'),

          // 导出按钮
          createElement('button', {
            onClick: handleExport,
            disabled: records.length === 0,
            title: '导出为 JSON 文件',
            style: {
              padding: '6px 12px',
              background: '#10b981',
              border: 'none',
              borderRadius: '6px',
              color: '#fff',
              cursor: records.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              opacity: records.length === 0 ? 0.6 : 1
            }
          }, '📥 导出'),

          // 🆕 批量删除按钮
          createElement('button', {
            onClick: handleBatchDelete,
            disabled: selectedIds.length === 0,
            title: selectedIds.length > 0 ? '删除选中的 ' + selectedIds.length + ' 条记录' : '请先勾选要删除的记录',
            style: {
              padding: '6px 14px',
              background: selectedIds.length > 0 ? '#f59e0b' : '#d1d5db',
              border: '2px solid ' + (selectedIds.length > 0 ? '#d97706' : '#9ca3af'),
              borderRadius: '6px',
              color: '#fff',
              cursor: selectedIds.length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              boxShadow: selectedIds.length > 0 ? '0 2px 6px rgba(245, 158, 11, 0.4)' : 'none',
              transition: 'all 0.2s'
            }
          }, (selectedIds.length > 0 ? '🗑️ 批量删除 (' + selectedIds.length + ')' : '🗑️ 批量删除'))
        )
      ),

      // 主内容区（表格 + 详情）
      createElement('div', {
        style: {
          flex: 1,
          display: 'flex',
          overflow: 'hidden'
        }
      },

        // 左侧：表格（全宽显示，带边距）
        createElement('div', {
          style: {
            flex: 1,
            overflow: 'auto',
            padding: '16px'
          }
        },
          createElement('table', {
            style: {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px'
            }
          },
            // 表头
            createElement('thead', {
              style: {
                position: 'sticky',
                top: 0,
                background: '#f1f5f9',
                zIndex: 10
              }
            },
              createElement('tr', null,
                // 🆕 第一列：全选复选框
                createElement('th', {
                  key: 'checkbox',
                  style: {
                    padding: '10px 8px',
                    textAlign: 'center',
                    width: '36px',
                    fontWeight: 600,
                    color: '#475569',
                    borderBottom: '2px solid #e2e8f0'
                  }
                },
                  createElement('input', {
                    type: 'checkbox',
                    checked: selectedIds.length === records.length && records.length > 0,
                    onChange: toggleSelectAll,
                    title: selectedIds.length === records.length ? '取消全选' : '全选',
                    style: {
                      width: '16px',
                      height: '16px',
                      cursor: records.length > 0 ? 'pointer' : 'not-allowed',
                      accentColor: '#f59e0b',
                      opacity: records.length > 0 ? 1 : 0.4
                    }
                  })
                ),
                ['时序', '类型', '模型', '内容摘要', '操作'].map(function(header) {
                  return createElement('th', {
                    key: header,
                    style: {
                      padding: '10px 8px',
                      textAlign: 'left',
                      fontWeight: 600,
                      color: '#475569',
                      borderBottom: '2px solid #e2e8f0',
                      fontSize: '11px',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }
                  }, header);
                })
              )
            ),

            // 表体
            createElement('tbody', null,
              records.map(function(record, index) {
                return renderTableRow(record, index);
              })
            )
          ),

          // 空状态
          records.length === 0 && !isLoading && !error && createElement('div', {
            style: {
              padding: '40px',
              textAlign: 'center',
              color: '#94a3b8',
              fontSize: '14px'
            }
          },
            createElement('div', { style: { fontSize: '32px', marginBottom: '12px' } }, '📭'),
            '暂无数据记录',
            
            // 🔍 数据持久性诊断
            createElement('div', {
              style: {
                marginTop: '30px',
                padding: '20px',
                background: '#f0f9ff',
                border: '2px solid #0ea5e9',
                borderRadius: '10px',
                color: '#0369a1',
                fontSize: '13px',
                textAlign: 'left',
                maxWidth: '550px',
                margin: '30px auto 0'
              }
            },
              createElement('strong', null, '🔍 数据持久性诊断'),
              createElement('br', null),
              createElement('br', null),
              
              stats && stats.total > 0 
                ? [
                    createElement('div', null, '⚠️ 统计显示有 ', createElement('strong', null, stats.total), ' 条记录，但表格为空。'),
                    createElement('br', null),
                    createElement('div', null, '可能原因：'),
                    createElement('ul', { style: { marginLeft: '20px', marginTop: '8px' } },
                      createElement('li', null, 'IndexedDB 数据在刷新后被清除（浏览器隐私模式？）'),
                      createElement('li', null, 'getAll() 方法执行失败但未报错'),
                      createElement('li', null, '数据格式不正确')
                    ),
                    createElement('br', null),
                    createElement('button', {
                      onClick: function() {
                        if (window.AIChatDB && window.AIChatDB.getAll) {
                          window.AIChatDB.getAll(5).then(function(data) {
                            alert('🔍 直接查询结果：\n\n数据类型: ' + typeof data + '\n是否数组: ' + Array.isArray(data) + '\n数据长度: ' + (data ? data.length : 'null') + '\n\n前3条数据:\n' + JSON.stringify(data ? data.slice(0, 3) : [], null, 2));
                          }).catch(function(err) {
                            alert('❌ 查询失败: ' + err.message);
                          });
                        } else {
                          alert('❌ AIChatDB 不可用');
                        }
                      },
                      style: {
                        marginTop: '15px',
                        padding: '10px 20px',
                        background: '#0ea5e9',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }
                    }, '🔍 验证 IndexedDB 数据')
                  ]
                : [
                    createElement('div', null, '✅ 统计也显示为 0，说明数据库确实为空。'),
                    createElement('br', null),
                    createElement('div', null, '可能原因：'),
                    createElement('ul', { style: { marginLeft: '20px', marginTop: '8px' } },
                      createElement('li', null, '从未保存过数据到数据库'),
                      createElement('li', null, '数据已被手动删除'),
                      createElement('li', null, '浏览器清除了 IndexedDB（隐私模式/存储限制）')
                    )
                  ]
            )
          ),

          // 加载状态
          isLoading && createElement('div', {
            style: {
              padding: '40px',
              textAlign: 'center',
              color: '#64748b'
            }
          }, '⏳ 正在加载数据...')
        ),

        // 独立浮动窗口：记录详情
        showDetailModal && selectedRecord && createElement(window.FloatingWindowReact, {
          isOpen: true,
          width: '700px',
          height: '600px',
          onClose: function() { setShowDetailModal(false); },
          title: '📋 记录详情 - ' + (selectedRecord.id || '').substring(0, 12)
        },
          renderDetailPanel()
        )
      )
    );
  }

  /**
   * 打开数据浏览器窗口
   */
  function openDataBrowser() {
    try {
      console.log('[AI-Chat-Browser] 🚀 正在打开数据浏览器...');
      
      // 检查必要依赖
      if (typeof window.FloatingWindowReact === 'undefined') {
        alert('❌ 浮动窗口组件未加载！\n\n请检查 FloatingWindowReact.js 是否正确加载。');
        return;
      }
      
      var containerId = 'ai-chat-data-browser';
      
      // 如果已存在，先移除
      var existing = document.getElementById(containerId);
      if (existing) {
        ReactDOM.unmountComponentAtNode(existing);
        if (existing.parentNode) existing.remove();
      }

      // 创建容器
      var container = document.createElement('div');
      container.id = containerId;
      document.body.appendChild(container);

      // 渲染组件
      ReactDOM.render(
        createElement(window.FloatingWindowReact, {
          isOpen: true,
          width: '1200px',
          height: '700px',
          onClose: function() {
            ReactDOM.unmountComponentAtNode(container);
            if (container.parentNode) container.remove();
          },
          title: '💾 AI 对话数据浏览器 (AIChatDataBrowser.js)'
        },
          createElement(DataBrowser)
        ),
        container
      );
      
      console.log('[AI-Chat-Browser] ✅ 数据浏览器已成功打开！');
      
    } catch(err) {
      console.error('[AI-Chat-Browser] ❌ 打开数据浏览器失败:', err);
      alert('❌ 打开数据浏览器失败！\n\n错误信息: ' + err.message);
    }
  }

  // ===== 导出 =====
  window.AIChatDataBrowser = {
    open: openDataBrowser,
    Component: DataBrowser
  };

  console.log('[AI-Chat-Browser] ✅ 数据浏览器模块已加载（生产稳定版 v2.0 - 完整功能 + 美观UI）');

})();
