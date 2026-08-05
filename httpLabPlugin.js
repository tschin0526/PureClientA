/**
 * 标准 HTTP GET 请求实验室 v1.3 (2026-05-23)
 *
 * 功能：
 * 1. 输入任意 URL，执行 HTTP GET 请求
 * 2. 自动检测响应类型（腾讯财经 / JSON / HTML）
 * 3. 智能解析腾讯 qt.gtimg.cn 格式为表格（修复 GBK 乱码）
 * 4. JSON/CSV 导出
 * 5. 历史记录 + 历史记录清理功能
 *
 * 已验证可用数据源：qt.gtimg.cn（腾讯财经）
 */

(function() {
  'use strict';

  if (!window.React || !window.ReactDOM) {
    console.error('[HTTPLab] React 未加载');
    return;
  }

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var createElement = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;

  var C = {
    primary: '#6366f1',
    primaryDark: '#4f46e5',
    success: '#10b981',
    danger: '#ef4444',
    bg: '#f8fafc',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    textDark: '#1e293b',
    textLight: '#64748b'
  };

  var PRESETS = [
    { name: '🔥 A股 热门', url: 'https://qt.gtimg.cn/q=sh600519,sz000858,sh601398,sz000001,sz002594,sh600036,sz300750' },
    { name: '📈 大盘指数', url: 'https://qt.gtimg.cn/q=sh000001,sz399001,sz399006,sh000300,sh000016,sh000688' },
    { name: '💹 港股 热门', url: 'https://qt.gtimg.cn/q=r_hk00700,r_hk09988,r_hk01810,r_hk09999,r_hk03690,r_hk06618' },
    { name: '🌐 美股 科技', url: 'https://qt.gtimg.cn/q=usAAPL,usGOOGL,usMSFT,usTSLA,usNVDA,usAMZN,usMETA' },
    { name: '🌍 中美混合', url: 'https://qt.gtimg.cn/q=usAAPL,usGOOGL,usMSFT,usTSLA,usNVDA,sz002594' },
    { name: '🔍 自定义单股', url: 'https://qt.gtimg.cn/q=sh600519' }
  ];

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function copyToClipboard(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text);
    } else {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        document.body.removeChild(textarea);
        return Promise.resolve();
      } catch (e) {
        document.body.removeChild(textarea);
        return Promise.reject(e);
      }
    }
  }

  function downloadFile(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function isTencentQt(text) {
    return text && text.indexOf('v_') !== -1 && text.indexOf('~') !== -1 && text.indexOf('="') !== -1;
  }

  function parseTencentQt(text) {
    var lines = text.split(';').filter(function(l) { return l.indexOf('v_') !== -1; });
    var rows = [];
    lines.forEach(function(line) {
      var m = line.match(/v_(\S+?)="(.*)"/);
      if (!m) return;
      var code = m[1], dataStr = m[2];
      if (!dataStr) return;
      var p = dataStr.split('~');
      if (p.length < 35) return;
      rows.push({
        _index: rows.length + 1,
        '代码': p[2] || code,
        '名称': p[1],
        '当前价': p[3],
        '昨收': p[4],
        '今开': p[5],
        '成交量(手)': p[6],
        '成交额(万)': p[37] || p[36] || '',
        '涨跌额': p[31] || '',
        '涨跌幅': p[32] || '',
        '最高': p[33] || '',
        '最低': p[34] || '',
        '买一': p[9],
        '卖一': p[18],
        '时间': p[30] || ''
      });
    });
    return rows.length > 0 ? { title: '腾讯财经即时行情', fields: Object.keys(rows[0]), rows: rows } : null;
  }

  function flattenJson(obj, prefix, depth, maxDepth) {
    maxDepth = maxDepth || 4;
    depth = depth || 0;
    var out = [];
    if (depth > maxDepth) { out.push({ key: prefix || '(root)', type: '...', value: '(深层对象)' }); return out; }
    if (obj === null || obj === undefined) { out.push({ key: prefix || '(root)', type: 'null', value: 'null' }); }
    else if (Array.isArray(obj)) {
      obj.forEach(function(item, i) {
        if (typeof item === 'object' && item !== null) {
          out = out.concat(flattenJson(item, prefix ? prefix + '[' + i + ']' : '[' + i + ']', depth + 1));
        } else {
          out.push({ key: (prefix || '') + '[' + i + ']', type: typeof item, value: String(item) });
        }
      });
    } else if (typeof obj === 'object') {
      Object.keys(obj).forEach(function(k) { out = out.concat(flattenJson(obj[k], prefix ? prefix + '.' + k : k, depth + 1)); });
    } else {
      out.push({ key: prefix || '(root)', type: typeof obj, value: String(obj) });
    }
    return out;
  }

  function HTTPLabApp() {
    var _s1 = useState(PRESETS[0].url), url = _s1[0], setUrl = _s1[1];
    var _s2 = useState(false), loading = _s2[0], setLoading = _s2[1];
    var _s3 = useState(''), statusMsg = _s3[0], setStatusMsg = _s3[1];
    var _s4 = useState('info'), statusType = _s4[0], setStatusType = _s4[1];
    var _s5 = useState(null), tableData = _s5[0], setTableData = _s5[1];
    var _s7 = useState(null), rawData = _s7[0], setRawData = _s7[1];
    var _s8 = useState(null), jsonData = _s8[0], setJsonData = _s8[1];
    var _s9 = useState('table'), activeTab = _s9[0], setActiveTab = _s9[1];
    var _s10 = useState([]), history = _s10[0], setHistory = _s10[1];
    var _s11 = useState(''), copyStatus = _s11[0], setCopyStatus = _s11[1];

    useEffect(function() {
      try { var s = localStorage.getItem('http_lab_history'); if (s) setHistory(JSON.parse(s)); } catch(e) {}
    }, []);

    var saveHistory = useCallback(function(u) {
      setHistory(function(prev) {
        var updated = [{ url: u, time: Date.now() }].concat(prev.filter(function(h) { return h.url !== u; })).slice(0, 20);
        try { localStorage.setItem('http_lab_history', JSON.stringify(updated)); } catch(e) {}
        return updated;
      });
    }, []);

    var clearHistory = useCallback(function() {
      if (confirm('确定要清空所有历史记录吗？')) {
        setHistory([]);
        try { localStorage.removeItem('http_lab_history'); } catch(e) {}
        setStatusMsg('✅ 历史记录已清空');
        setStatusType('success');
      }
    }, []);

    var deleteHistoryItem = useCallback(function(index) {
      setHistory(function(prev) {
        var updated = prev.filter(function(_, i) { return i !== index; });
        try { localStorage.setItem('http_lab_history', JSON.stringify(updated)); } catch(e) {}
        return updated;
      });
    }, []);

    var doCopyRaw = useCallback(function() {
      var toCopy = jsonData ? JSON.stringify(jsonData, null, 2) : (rawData || '');
      copyToClipboard(toCopy)
        .then(function() {
          setCopyStatus('✅ 已复制');
          setTimeout(function() { setCopyStatus(''); }, 1500);
        })
        .catch(function() {
          setCopyStatus('❌ 复制失败');
          setTimeout(function() { setCopyStatus(''); }, 1500);
        });
    }, [rawData, jsonData]);

    var doFetch = useCallback(function() {
      var u = url.trim();
      if (!u) { setStatusMsg('请输入 URL'); setStatusType('error'); return; }
      setLoading(true);
      setStatusMsg('⏳ 请求中...');
      setStatusType('info');
      setTableData(null); setRawData(null); setJsonData(null);
      var isTencent = u.indexOf('qt.gtimg.cn') !== -1;

      fetch(u, { method: 'GET', headers: { 'Accept': '*/*' } })
        .then(function(res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return isTencent ? res.arrayBuffer() : res.text();
        })
        .then(function(data) {
          var text;
          if (isTencent && data instanceof ArrayBuffer) {
            var decoder = new TextDecoder('gbk');
            text = decoder.decode(data);
          } else {
            text = data;
          }
          setRawData(text);
          saveHistory(u);

          if (isTencentQt(text)) {
            var td = parseTencentQt(text);
            if (td) {
              setTableData(td);
              setJsonData(td.rows); // 同时把数据作为 JSON 存储，显示第三个页签
              setActiveTab('table');
              setStatusMsg('✅ 腾讯财经格式！共 ' + td.rows.length + ' 只股票');
              setStatusType('success');
              setLoading(false);
              return;
            }
          }
          try {
            var j = JSON.parse(text);
            setJsonData(j);
            setActiveTab('json');
            setStatusMsg('✅ JSON 响应成功');
            setStatusType('success');
          } catch(e) {
            setActiveTab('raw');
            setStatusMsg('✅ 响应成功 (' + text.length + ' 字符)');
            setStatusType('success');
          }
          setLoading(false);
        })
        .catch(function(err) {
          setStatusMsg('❌ 请求失败: ' + err.message);
          setStatusType('danger');
          setLoading(false);
        });
    }, [url, saveHistory]);

    var exportJSON = useCallback(function() {
      if (tableData) downloadFile(JSON.stringify(tableData.rows, null, 2), 'data-' + Date.now() + '.json', 'application/json');
      else if (jsonData) downloadFile(JSON.stringify(jsonData, null, 2), 'data-' + Date.now() + '.json', 'application/json');
    }, [tableData, jsonData]);

    var exportCSV = useCallback(function() {
      var rows = tableData ? tableData.rows : [];
      if (!rows.length) return;
      var keys = Object.keys(rows[0]);
      var csv = [keys.join(',')].concat(rows.map(function(r) { return keys.map(function(k) { var v = r[k]; return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }).join(','); }));
      downloadFile(csv.join('\n'), 'data-' + Date.now() + '.csv', 'text/csv;charset=utf-8');
    }, [tableData]);

    function renderTable() {
      if (!tableData) return createElement('div', { style: emptyStyle }, '无表格数据');
      var f = tableData.fields, rs = tableData.rows;
      return createElement('div', null,
        tableData.title && createElement('div', { style: titleStyle }, '📌 ' + escapeHtml(tableData.title)),
        createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
          createElement('thead', null,
            createElement('tr', { style: thRowStyle },
              f.map(function(k) { return createElement('th', { key: k, style: thStyle }, escapeHtml(k)); })
            )
          ),
          createElement('tbody', null,
            rs.map(function(row, idx) {
              return createElement('tr', { key: idx, style: idx % 2 === 0 ? trEvenStyle : trOddStyle },
                f.map(function(k) {
                  var v = row[k] !== undefined ? row[k] : '';
                  var isPrice = ['当前价','今开','最高','最低','昨收'].indexOf(k) >= 0;
                  var isChange = ['涨跌额','涨跌幅'].indexOf(k) >= 0;
                  return createElement('td', { key: k, style: tdStyle(isPrice, isChange) }, escapeHtml(v));
                })
              );
            })
          )
        )
      );
    }

    function renderRaw() {
      if (!rawData) return createElement('div', { style: emptyStyle }, '暂无数据');
      return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        createElement('div', { style: { padding: '8px 12px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' } },
          copyStatus && createElement('span', { style: { fontSize: '12px', fontWeight: 600, color: copyStatus.indexOf('✅') >= 0 ? C.success : C.danger } }, copyStatus),
          createElement('button', { onClick: doCopyRaw, style: { padding: '6px 12px', background: '#f1f5f9', border: '1px solid ' + C.border, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' } }, '📋 复制')
        ),
        createElement('pre', { style: { margin: 0, padding: '12px', fontSize: '12px', lineHeight: '1.6', fontFamily: '"SF Mono", Monaco, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#f8fafc', color: C.textDark, overflow: 'auto', flex: 1 } },
          escapeHtml(rawData)
        )
      );
    }

    function renderJsonData() {
      if (!jsonData) return createElement('div', { style: emptyStyle }, '无 JSON 数据');
      return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        createElement('div', { style: { padding: '8px 12px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center' } },
          copyStatus && createElement('span', { style: { fontSize: '12px', fontWeight: 600, color: copyStatus.indexOf('✅') >= 0 ? C.success : C.danger } }, copyStatus),
          createElement('button', { onClick: doCopyRaw, style: { padding: '6px 12px', background: '#f1f5f9', border: '1px solid ' + C.border, borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' } }, '📋 复制')
        ),
        createElement('pre', { style: { margin: 0, padding: '12px', fontSize: '12px', lineHeight: '1.6', fontFamily: '"SF Mono", Monaco, monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all', background: '#1e293b', color: '#e2e8f0', overflow: 'auto', flex: 1 } },
          escapeHtml(JSON.stringify(jsonData, null, 2))
        )
      );
    }

    var tabBarStyle = { display: 'flex', borderBottom: '2px solid ' + C.border, background: C.cardBg, flexShrink: 0 };
    var thRowStyle = { background: '#f1f5f9' };
    var thStyle = { padding: '8px 12px', textAlign: 'left', borderBottom: '2px solid ' + C.border, fontWeight: 700, fontSize: '12px', color: C.textDark, whiteSpace: 'nowrap' };
    var trOddStyle = { borderBottom: '1px solid ' + C.border };
    var trEvenStyle = { borderBottom: '1px solid ' + C.border, background: '#f8fafc' };
    var tdStyle = function(bold, change) { return { padding: '6px 12px', fontSize: '13px', color: C.textDark, textAlign: bold || change ? 'right' : 'left', fontWeight: bold ? 700 : 400, color: change ? (String(arguments[1]).indexOf('+') >= 0 ? '#dc2626' : String(arguments[1]).indexOf('-') >= 0 ? '#16a34a' : C.textDark) : C.textDark }; };
    var titleStyle = { padding: '8px 12px', marginBottom: '8px', background: 'linear-gradient(135deg, #dbeafe, #ede9fe)', borderRadius: '6px', fontSize: '14px', fontWeight: 700, color: C.primaryDark };
    var emptyStyle = { textAlign: 'center', padding: '60px 20px', color: C.textLight };
    var btnStyle = { flex: 1, padding: '6px 12px', background: 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 };

    return createElement(window.FloatingWindowReact, {
      isOpen: true,
      width: '1000px',
      height: Math.floor(window.innerHeight * 0.88) + 'px',
      onClose: function() { var c = document.getElementById('http-lab-window'); if (c) { ReactDOM.unmountComponentAtNode(c); if (c.parentNode) c.parentNode.removeChild(c); } },
      title: '🔬 标准 HTTP GET 请求实验室',
      sourceFile: 'httpLabPlugin.js'
    },
      createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system, sans-serif' } },
        createElement('div', { style: { padding: '12px 16px', background: C.cardBg, borderBottom: '1px solid ' + C.border, flexShrink: 0 } },
          createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' } },
            createElement('span', { style: { fontSize: '13px', fontWeight: 700, color: C.primaryDark, whiteSpace: 'nowrap' } }, '📍 URL：'),
            createElement('input', {
              type: 'text', value: url,
              onChange: function(e) { setUrl(e.target.value); },
              onKeyDown: function(e) { if (e.key === 'Enter') doFetch(); },
              placeholder: '输入 HTTP GET 目标地址，如 https://qt.gtimg.cn/q=sh600519,sz000858...',
              style: { flex: 1, padding: '10px 14px', border: '2px solid ' + C.primary, borderRadius: '8px', fontSize: '14px', outline: 'none', background: '#fff', boxShadow: '0 0 0 3px rgba(99,102,241,0.1)', minWidth: '0' }
            })
          ),
          createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
            createElement('button', { onClick: doFetch, disabled: loading, style: { padding: '10px 28px', background: loading ? '#94a3b8' : 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '15px', fontWeight: 700, whiteSpace: 'nowrap', boxShadow: loading ? 'none' : '0 2px 8px rgba(99,102,241,0.3)' } },
              loading ? '⏳ 请求中...' : '🚀 GET 发送请求'
            ),
            createElement('span', { style: { fontSize: '12px', color: C.textLight, fontWeight: 500 } }, '或选择预设：'),
            createElement('select', {
              onChange: function(e) { var idx = e.target.value; if (idx !== '') { setUrl(PRESETS[idx].url); e.target.value = ''; } },
              style: { padding: '9px 10px', border: '1px solid ' + C.border, borderRadius: '8px', fontSize: '13px', outline: 'none', background: '#fff', cursor: 'pointer', flex: 1 }
            },
              createElement('option', { value: '' }, '📋 快速预设（点击填入URL）'),
              PRESETS.map(function(p, i) { return createElement('option', { key: i, value: i }, p.name + ' — ' + p.url.replace('https://qt.gtimg.cn/q=', '')); })
            )
          )
        ),
        statusMsg && createElement('div', { style: { padding: '8px 16px', fontSize: '13px', fontWeight: 500, background: statusType === 'success' ? '#ecfdf5' : statusType === 'danger' ? '#fef2f2' : '#eff6ff', color: statusType === 'success' ? '#065f46' : statusType === 'danger' ? '#991b1b' : '#1e40af', borderBottom: '1px solid ' + C.border, flexShrink: 0 } }, statusMsg),
        createElement('div', { style: { flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 } },
          createElement('div', { style: { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 } },
            createElement('div', { style: tabBarStyle },
              [
                { id: 'table', label: '📊 数据表格', show: !!tableData },
                { id: 'raw', label: '📄 原始响应', show: !!rawData },
                { id: 'json', label: '📦 JSON数据', show: !!jsonData }
              ].filter(function(t) { return t.show; }).map(function(tab) {
                var active = activeTab === tab.id;
                return createElement('button', {
                  key: tab.id,
                  onClick: function() { setActiveTab(tab.id); },
                  style: { padding: '10px 20px', border: 'none', borderBottom: active ? '3px solid ' + C.primary : '3px solid transparent', background: active ? '#fff' : 'transparent', color: active ? C.primary : C.textLight, cursor: 'pointer', fontSize: '13px', fontWeight: active ? 700 : 500 }
                }, tab.label);
              })
            ),
            createElement('div', { style: { flex: 1, overflow: 'hidden', padding: '0', background: '#fff' } },
              activeTab === 'table' ? renderTable() :
              activeTab === 'raw' ? renderRaw() :
              renderJsonData()
            )
          ),
          createElement('div', { style: { width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', background: C.cardBg, borderLeft: '1px solid ' + C.border } },
            createElement('div', { style: { padding: '10px 14px', borderBottom: '1px solid ' + C.border, fontWeight: 700, fontSize: '13px', color: C.textDark, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
              '📜 历史',
              history.length > 0 && createElement('button', {
                onClick: clearHistory,
                title: '清空历史',
                style: { padding: '4px 8px', background: '#fef2f2', color: C.danger, border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }
              }, '🗑️ 清空')
            ),
            createElement('div', { style: { flex: 1, overflow: 'auto', padding: '8px' } },
              !history.length ? createElement('div', { style: { textAlign: 'center', padding: '30px 12px', color: C.textLight, fontSize: '12px' } }, '暂无记录')
              : history.map(function(h, i) {
                  return createElement('div', { key: i, style: { marginBottom: '4px' } },
                    createElement('div', {
                      onClick: function() { setUrl(h.url); },
                      style: { padding: '8px 10px', borderRadius: '6px', border: '1px solid ' + C.border, cursor: 'pointer', background: '#fff', transition: 'background 0.15s', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }
                    },
                      createElement('div', { style: { flex: 1, minWidth: 0 } },
                        createElement('div', { style: { fontSize: '11px', fontWeight: 600, color: C.textDark, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, h.url),
                        createElement('div', { style: { fontSize: '10px', color: C.textLight, marginTop: '2px' } }, new Date(h.time).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }))
                      ),
                      createElement('button', {
                        onClick: function(e) { e.stopPropagation(); deleteHistoryItem(i); },
                        title: '删除此项',
                        style: { marginLeft: '4px', padding: '2px 6px', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '11px', color: C.textLight }
                      }, '×')
                    )
                  );
                })
            ),
            (tableData || jsonData) && createElement('div', { style: { padding: '10px', borderTop: '1px solid ' + C.border, display: 'flex', gap: '6px' } },
              createElement('button', { onClick: exportJSON, style: btnStyle }, '📥 JSON'),
              createElement('button', { onClick: exportCSV, style: btnStyle }, '📊 CSV')
            )
          )
        )
      )
    );
  }

  function init() {
    var btn = document.getElementById('httpLabBtn');
    if (!btn) { setTimeout(init, 1000); return; }
    btn.addEventListener('click', function() {
      try {
        if (!window.FloatingWindowReact) { alert('FloatingWindowReact 未加载'); return; }
        var old = document.getElementById('http-lab-window');
        if (old) { ReactDOM.unmountComponentAtNode(old); if (old.parentNode) old.parentNode.removeChild(old); }
        var c = document.createElement('div');
        c.id = 'http-lab-window';
        document.body.appendChild(c);
        ReactDOM.render(createElement(HTTPLabApp), c);
      } catch(err) { alert('打开失败: ' + err.message); console.error(err); }
    });
    console.log('[HTTPLab] ✅ 已初始化');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
  console.log('[HTTPLab] ✅ 标准 HTTP GET 请求实验室 v1.3 已加载');
})();
