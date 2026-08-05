/**
 * ⊞ JSON 表格视图插件 (JsonTableViewerPlugin)
 *
 * 功能：
 * - 接收 JSON 数据，以表格形式展示在浮动窗口中
 * - 支持数组/对象类型自动识别
 * - 内置复制 JSON 数据按钮
 * - 可复用，任何模块都可调用 JsonTableViewerPlugin.show(jsonData, title)
 *
 * @version 1.0.0(1)
 * @date 2026-05-18
 */

console.log('[JsonTableViewer] 🚀 开始加载模块...');

window.JsonTableViewer = window.JsonTableViewer || {
  _initialized: false,
  _error: null,
  show: function(data, title) {
    if (!this._initialized) {
      alert('⚠️ JSON表格视图正在初始化中...\n\n请稍后再试，或刷新页面。\n\n错误信息: ' + (this._error || '未知错误'));
      console.error('[JsonTableViewer] ❌ 模块未完成初始化');
      return;
    }
    console.warn('[JsonTableViewer] ⚠️ 使用了默认的show方法');
  }
};

(function() {
  'use strict';

  try {

  var deps = {
    React: window.React,
    ReactDOM: window.ReactDOM,
    FloatingWindowReact: window.FloatingWindowReact
  };

  var missingDeps = Object.keys(deps).filter(function(key) { return !deps[key]; });
  if (missingDeps.length > 0) {
    var errorMsg = '缺少必要依赖: ' + missingDeps.join(', ');
    console.error('[JsonTableViewer] ❌ ' + errorMsg);
    window.JsonTableViewer._error = errorMsg;
    return;
  }

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var createElement = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;

  console.log('[JsonTableViewer] ✅ 所有依赖已加载');

  var COLORS = {
    primary: '#3b82f6',
    primaryLight: '#dbeafe',
    primaryDark: '#1d4ed8',
    success: '#10b981',
    successLight: '#d1fae5',
    error: '#ef4444',
    errorLight: '#fee2e2',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    textDark: '#1f2937',
    textGray: '#64748b',
    bgWhite: '#ffffff',
    border: '#e2e8f0'
  };

  var reactRoot = null;
  var reactContainer = null;
  var currentData = null;
  var currentTitle = '';

  function ensureContainer() {
    cleanup();
    reactContainer = document.createElement('div');
    reactContainer.id = 'json-table-viewer-container';
    document.body.appendChild(reactContainer);
    return reactContainer;
  }

  function cleanup() {
    if (reactRoot) {
      try { reactRoot.unmount(); } catch(e) {}
      reactRoot = null;
    }
    if (reactContainer && reactContainer.parentNode) {
      reactContainer.parentNode.removeChild(reactContainer);
    }
    reactContainer = null;
  }

  function GridIcon(size, color) {
    var s = size || 14;
    var c = color || COLORS.primary;
    return createElement('svg', {
      width: String(s), height: String(s),
      viewBox: '0 0 16 16',
      fill: 'none', style: { display: 'block' }
    },
      createElement('rect', {
        x: '1', y: '1', width: '14', height: '14',
        rx: '2.5', ry: '2.5',
        stroke: c, strokeWidth: '1.5', fill: 'white'
      }),
      createElement('line', { x1: '1', y1: '6', x2: '15', y2: '6', stroke: c, strokeWidth: '1' }),
      createElement('line', { x1: '1', y1: '10', x2: '15', y2: '10', stroke: c, strokeWidth: '1' }),
      createElement('line', { x1: '5.5', y1: '1', x2: '5.5', y2: '15', stroke: c, strokeWidth: '1' }),
      createElement('line', { x1: '10.5', y1: '1', x2: '10.5', y2: '15', stroke: c, strokeWidth: '1' })
    );
  }

  function copyJsonToClipboard(text) {
    var formatted;
    try {
      formatted = JSON.stringify(JSON.parse(text), null, 2);
    } catch(e) {
      formatted = text;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(formatted).then(function() {
        showCopyStatus('✅ 已复制JSON数据');
      }).catch(function() { fallbackCopy(formatted); });
    } else {
      fallbackCopy(formatted);
    }
  }

  function fallbackCopy(text) {
    try {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.left = '-9999px';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showCopyStatus('✅ 已复制JSON数据');
    } catch(e) {
      showCopyStatus('❌ 复制失败');
    }
  }

  function showCopyStatus(msg) {
    var el = document.getElementById('json-table-copy-status');
    if (el) {
      el.textContent = msg;
      el.style.opacity = '1';
      setTimeout(function() {
        el.style.opacity = '0';
      }, 2000);
    }
  }

  function renderCellValue(value) {
    if (value === null) {
      return createElement('span', { style: { color: '#000000', fontStyle: 'italic', fontWeight: 600 } }, 'null');
    }
    var type = typeof value;
    if (type === 'string') {
      return createElement('span', { style: { color: '#000000', fontFamily: 'monospace', wordBreak: 'break-word' } }, value);
    }
    if (type === 'number') {
      return createElement('span', { style: { color: '#000000', fontWeight: 600, fontFamily: 'monospace' } }, value.toLocaleString());
    }
    if (type === 'boolean') {
      return createElement('span', {
        style: {
          color: '#000000',
          fontWeight: 700,
          background: value ? '#f0fdf4' : '#fef2f2',
          padding: '2px 8px',
          borderRadius: '6px',
          fontSize: '11px'
        }
      }, value ? 'TRUE' : 'FALSE');
    }
    if (Array.isArray(value)) {
      return createElement('span', { style: { color: '#000000', fontFamily: 'monospace', fontSize: '11px', background: '#fffbeb', padding: '2px 6px', borderRadius: '4px' } }, '[Array(', value.length, ')]');
    }
    if (type === 'object') {
      var keys = Object.keys(value);
      return createElement('span', { style: { color: '#000000', fontFamily: 'monospace', fontSize: '11px', background: '#eff6ff', padding: '2px 6px', borderRadius: '4px' } }, '{Object(', keys.length, ')}');
    }
    return String(value);
  }

  function renderTable(data) {
    var dataType = Object.prototype.toString.call(data);

    if (dataType === '[object Array]') {
      if (data.length === 0) {
        return createElement('div', { style: { textAlign: 'center', padding: '60px 20px', color: COLORS.textGray, fontSize: '16px' } },
          createElement('div', { style: { fontSize: '48px', marginBottom: '12px', opacity: 0.3 } }, '📭'),
          createElement('div', { style: { fontWeight: 600 } }, '空数组')
        );
      }
      if (typeof data[0] === 'object' && data[0] !== null) {
        return renderArrayTable(data);
      }
      return renderSimpleArrayTable(data);
    }

    if (dataType === '[object Object]') {
      return renderObjectTable(data);
    }

    return createElement('div', { style: { textAlign: 'center', padding: '40px', color: COLORS.textGray } }, String(data));
  }

  function renderArrayTable(arr) {
    var allKeys = [];
    arr.forEach(function(item) {
      if (item && typeof item === 'object') {
        Object.keys(item).forEach(function(key) {
          if (allKeys.indexOf(key) === -1) allKeys.push(key);
        });
      }
    });

    var headerStyle = {
      padding: '12px 16px',
      textAlign: 'left',
      background: 'linear-gradient(180deg, #dbeafe, #e0e7ff)',
      color: COLORS.primaryDark,
      fontWeight: 700,
      fontSize: '13px',
      letterSpacing: '0.3px',
      borderBottom: '2px solid ' + COLORS.primary,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      position: 'sticky',
      top: 0,
      zIndex: 1
    };

    var cellStyle = {
      padding: '12px 16px',
      borderBottom: '1px solid ' + COLORS.border,
      color: '#000000',
      verticalAlign: 'top',
      fontSize: '13px',
      lineHeight: '1.6',
      whiteSpace: 'normal',
      wordBreak: 'break-word'
    };

    var numHeaderStyle = Object.assign({ width: '50px', textAlign: 'center' }, headerStyle);
    var numCellStyle = Object.assign({ width: '50px', textAlign: 'center' }, cellStyle);

    return createElement('div', { style: { width: '100%', height: '100%', overflow: 'auto', background: COLORS.bgWhite, borderRadius: '10px', border: '1px solid ' + COLORS.border } },

      createElement('div', {
        style: {
          padding: '12px 18px',
          background: 'linear-gradient(135deg, #dbeafe, #ede9fe)',
          borderBottom: '2px solid ' + COLORS.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }
      },
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          createElement('span', { style: { fontSize: '15px', fontWeight: 700, color: COLORS.primaryDark, display: 'inline-flex', alignItems: 'center', gap: '6px' } },
            GridIcon(16), '数据表格'),
          createElement('span', {
            style: { fontSize: '12px', color: COLORS.textGray, background: 'white', padding: '3px 10px', borderRadius: '10px', fontWeight: 600 }
          }, arr.length + ' 条 | ' + allKeys.length + ' 字段')
        ),
        createElement('button', {
          onClick: function() {
            copyJsonToClipboard(JSON.stringify(currentData, null, 2));
          },
          title: '复制JSON数据（格式化）',
          style: {
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white',
            border: 'none',
            padding: '6px 14px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'all 0.15s ease'
          }
        }, '📋 复制JSON'),
        createElement('span', { id: 'json-table-copy-status', style: { fontSize: '11px', fontWeight: 600, color: COLORS.success, opacity: 0, transition: 'opacity 0.3s', minWidth: '120px', textAlign: 'right' } })
      ),

      createElement('div', { style: { overflowX: 'auto' } },
        createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
          createElement('thead', null,
            createElement('tr', null,
              createElement('th', { style: numHeaderStyle }, '#'),
              allKeys.map(function(key) {
                return createElement('th', { key: key, style: headerStyle }, key);
              })
            )
          ),
          createElement('tbody', null,
            arr.map(function(row, idx) {
              return createElement('tr', {
                key: idx,
                style: {
                  background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc',
                  transition: 'background 0.15s ease'
                },
                onMouseEnter: function(e) { e.currentTarget.style.background = COLORS.primaryLight; },
                onMouseLeave: function(e) { e.currentTarget.style.background = idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc'; }
              },
                createElement('td', { style: numCellStyle },
                  createElement('span', {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: idx % 2 === 0 ? COLORS.primary : COLORS.success,
                      color: 'white',
                      fontSize: '10px',
                      fontWeight: 700
                    }
                  }, idx + 1)
                ),
                allKeys.map(function(key) {
                  return createElement('td', { key: key, style: cellStyle }, renderCellValue(row[key]));
                })
              );
            })
          )
        )
      )
    );
  }

  function renderSimpleArrayTable(arr) {
    return createElement('div', { style: { width: '100%', height: '100%', overflow: 'auto', background: COLORS.bgWhite, borderRadius: '10px', border: '1px solid ' + COLORS.border } },
      createElement('div', { style: { padding: '12px 18px', background: 'linear-gradient(135deg, #dbeafe, #ede9fe)', borderBottom: '2px solid ' + COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          createElement('span', { style: { fontSize: '15px', fontWeight: 700, color: COLORS.primaryDark } }, '📋 数组列表'),
          createElement('span', { style: { fontSize: '12px', color: COLORS.textGray, background: 'white', padding: '3px 10px', borderRadius: '10px', fontWeight: 600 } }, arr.length + ' 个元素')
        ),
        createElement('button', {
          onClick: function() { copyJsonToClipboard(JSON.stringify(currentData, null, 2)); },
          style: { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }
        }, '📋 复制JSON')
      ),
      createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
        createElement('tbody', null,
          arr.map(function(item, idx) {
            return createElement('tr', { key: idx, style: { background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc', borderBottom: '1px solid ' + COLORS.border } },
              createElement('td', { style: { padding: '10px 18px', width: '50px', textAlign: 'center', color: COLORS.textGray, fontWeight: 600 } }, '#' + (idx + 1)),
              createElement('td', { style: { padding: '10px 18px' } }, renderCellValue(item))
            );
          })
        )
      )
    );
  }

  function renderObjectTable(obj) {
    var keys = Object.keys(obj);
    return createElement('div', { style: { width: '100%', height: '100%', overflow: 'auto', background: COLORS.bgWhite, borderRadius: '10px', border: '1px solid ' + COLORS.border } },
      createElement('div', { style: { padding: '12px 18px', background: 'linear-gradient(135deg, #dbeafe, #ede9fe)', borderBottom: '2px solid ' + COLORS.primary, display: 'flex', alignItems: 'center', justifyContent: 'space-between' } },
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
          createElement('span', { style: { fontSize: '15px', fontWeight: 700, color: COLORS.primaryDark } }, '🔑 键值对视图'),
          createElement('span', { style: { fontSize: '12px', color: COLORS.textGray, background: 'white', padding: '3px 10px', borderRadius: '10px', fontWeight: 600 } }, keys.length + ' 个属性')
        ),
        createElement('button', {
          onClick: function() { copyJsonToClipboard(JSON.stringify(currentData, null, 2)); },
          style: { background: 'linear-gradient(135deg, #3b82f6, #2563eb)', color: 'white', border: 'none', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600 }
        }, '📋 复制JSON')
      ),
      createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
        createElement('tbody', null,
          keys.map(function(key, idx) {
            return createElement('tr', { key: key, style: { background: idx % 2 === 0 ? COLORS.bgWhite : '#fafbfc', borderBottom: '1px solid ' + COLORS.border } },
              createElement('td', { style: { padding: '10px 18px', width: '30%', fontWeight: 600, color: COLORS.primaryDark, fontFamily: 'monospace', fontSize: '12px', verticalAlign: 'top', whiteSpace: 'nowrap' } }, key),
              createElement('td', { style: { padding: '10px 18px' } }, renderCellValue(obj[key]))
            );
          })
        )
      )
    );
  }

  function renderViewer() {
    return createElement(FloatingWindowReact, {
      title: currentTitle || '⊞ JSON 数据表格视图',
      sourceFile: 'JsonTableViewerPlugin.js',
      width: '85vw',
      maxHeight: '80vh',
      draggable: true,
      closeAnimation: 'fade',
      onHide: function() { cleanup(); }
    },
      createElement('div', {
        style: {
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        }
      },
        currentData ? renderTable(currentData) :
        createElement('div', {
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
          createElement('div', { style: { fontSize: '64px', opacity: 0.3 } }, GridIcon(64, COLORS.textGray)),
          createElement('div', { style: { fontSize: '18px', fontWeight: 600, color: COLORS.textDark } }, '暂无数据'),
          createElement('div', { style: { fontSize: '14px', textAlign: 'center', maxWidth: '400px', lineHeight: '1.6' } }, '请传入有效的 JSON 数据以查看表格视图。')
        )
      )
    );
  }

  window.JsonTableViewer = {
    _initialized: true,
    _error: null,

    show: function(data, title) {
      console.log('[JsonTableViewer] 🚀 show() 被调用');

      if (!window.React || !window.ReactDOM || !window.FloatingWindowReact) {
        alert('❌ 运行时错误：React组件未加载！\n\n请刷新页面后重试。');
        return;
      }

      try {
        var parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        currentData = parsedData;
        currentTitle = title || '⊞ JSON 数据表格视图';

        var container = ensureContainer();
        reactRoot = ReactDOM.createRoot(container);
        reactRoot.render(createElement(renderViewer));

        console.log('[JsonTableViewer] ✅ 表格视图已打开，数据条数:', Array.isArray(parsedData) ? parsedData.length : Object.keys(parsedData).length);
      } catch(e) {
        console.error('[JsonTableViewer] ❌ 渲染失败:', e);
        alert('❌ 数据解析失败：' + e.message);
      }
    },

    close: function() {
      cleanup();
      console.log('[JsonTableViewer] 🔒 表格视图已关闭');
    }
  };

  console.log('[JsonTableViewer] ✅ 模块加载完成，接口已暴露');

  } catch(e) {
    console.error('[JsonTableViewer] ❌ 初始化失败:', e);
    window.JsonTableViewer._error = String(e);
  }

})();

console.log('[JsonTableViewer] 🎯 JsonTableViewerPlugin 加载完毕');
