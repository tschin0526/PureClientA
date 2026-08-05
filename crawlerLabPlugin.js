/**
 * 爬虫实验室 v3.0 - Electron API 专版
 *
 * 功能：
 * 1. 通过 Electron API 爬取页面超链接数据
 * 2. 爬取表格数据
 * 3. 爬取页面文本数据
 * 4. 爬取页面图片
 * 5. 爬取页面按钮图标
 * 6. 支持输入网址爬取外部网页
 * 7. 数据导出功能
 * 8. 【新增】爬虫卡片选择器（调用 electron-crawler 中的爬虫卡片）
 * 9. 【新增】自定义消息编辑器（根据卡片类型动态显示）
 * 10. 【新增】爬取选定卡片，支持传递自定义消息
 */

(function() {
  'use strict';

  if (!window.React || !window.ReactDOM) {
    console.error('[CrawlerLab] React 未加载');
    return;
  }

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var createElement = React.createElement;
  var useState = React.useState;
  var useEffect = React.useEffect;

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

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function downloadFile(content, filename, type) {
    var blob = new Blob([content], { type: type });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function CrawlerLabApp() {
    var _s1 = useState('markdown'), activeTab = _s1[0], setActiveTab = _s1[1];
    var _s2 = useState([]), links = _s2[0], setLinks = _s2[1];
    var _s3 = useState([]), tables = _s3[0], setTables = _s3[1];
    var _s4 = useState(''), textContent = _s4[0], setTextContent = _s4[1];
    var _s5 = useState([]), images = _s5[0], setImages = _s5[1];
    var _s6 = useState([]), buttons = _s6[0], setButtons = _s6[1];
    var _s7 = useState(false), loading = _s7[0], setLoading = _s7[1];
    var _s8 = useState(''), statusMsg = _s8[0], setStatusMsg = _s8[1];
    var _s9 = useState(''), statusType = _s9[0], setStatusType = _s9[1];
    var _s10 = useState(''), targetUrl = _s10[0], setTargetUrl = _s10[1];
    var _s11 = useState(null), electronStatus = _s11[0], setElectronStatus = _s11[1];
    var _s12 = useState(null), crawlResult = _s12[0], setCrawlResult = _s12[1];
    var _s13 = useState([]), bookmarks = _s13[0], setBookmarks = _s13[1];
    var _s14 = useState(null), selectedBookmark = _s14[0], setSelectedBookmark = _s14[1];
    var _s15 = useState(''), customMessage = _s15[0], setCustomMessage = _s15[1];
    var _s16 = useState(''), bookmarkSearch = _s16[0], setBookmarkSearch = _s16[1];
    var _s17 = useState('direct'), crawlMode = _s17[0], setCrawlMode = _s17[1];
    var _s18 = useState(false), showBookmarks = _s18[0], setShowBookmarks = _s18[1];

    var _s19 = useState(''), capturedContent = _s19[0], setCapturedContent = _s19[1];
    var _s19b = useState(''), capturedHtml = _s19b[0], setCapturedHtml = _s19b[1];

    var _s20 = useState(false), showApiDocs = _s20[0], setShowApiDocs = _s20[1];
    var _s21 = useState(false), showBookmarkDropdown = _s21[0], setShowBookmarkDropdown = _s21[1];
    var _s22 = useState('card'), inputMode = _s22[0], setInputMode = _s22[1];

    useEffect(function() {
      checkElectronAPI();
      var interval = setInterval(checkElectronAPI, 3000);
      return function() { clearInterval(interval); };
    }, []);

    async function checkElectronAPI() {
      try {
        var response = await fetch('http://localhost:3000/api/status');
        if (response.ok) {
          var data = await response.json();
          setElectronStatus('connected');
        } else {
          setElectronStatus(null);
        }
      } catch (e) {
        setElectronStatus(null);
      }
    }

    async function fetchBookmarks() {
      try {
        var response = await fetch('http://localhost:3000/api/bookmarks');
        if (response.ok) {
          var data = await response.json();
          setBookmarks(data.bookmarks || []);
        }
      } catch (e) {
        console.error('[CrawlerLab] 获取卡片列表失败:', e);
      }
    }

    async function crawlSelectedBookmark() {
      if (!selectedBookmark) {
        setStatusMsg('请先选择一个爬虫卡片');
        setStatusType('danger');
        return;
      }

      setLoading(true);
      
      if (selectedBookmark.previewOnly) {
        setStatusMsg(' 正在通过 Electron 在系统浏览器中打开预览: ' + selectedBookmark.name);
        setStatusType('info');

        try {
          var apiUrl = 'http://localhost:3000/api/preview-bookmark/' + selectedBookmark.index;
          var payload = {};
          if (customMessage.trim()) {
            payload.presetMessage = customMessage.trim();
          }

          var apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!apiResponse.ok) {
            throw new Error('API 请求失败: HTTP ' + apiResponse.status);
          }

          var result = await apiResponse.json();

          if (result.error) {
            throw new Error(result.error);
          }

          setStatusMsg(' 已在 electron-crawler 中打开预览窗口: ' + selectedBookmark.name);
          setStatusType('success');
          setLoading(false);

        } catch (e) {
          console.error('[CrawlerLab] Error:', e);
          setStatusMsg(' 预览失败：' + e.message);
          setStatusType('danger');
          setLoading(false);
        }
      } else {
        setStatusMsg(' 正在通过 Electron 爬虫卡片爬取...');
        setStatusType('info');

        try {
          var apiUrl = 'http://localhost:3000/api/crawl-bookmark/' + selectedBookmark.index;
          var payload = {};
          if (customMessage.trim()) {
            payload.presetMessage = customMessage.trim();
          }

          var apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (!apiResponse.ok) {
            throw new Error('API 请求失败: HTTP ' + apiResponse.status);
          }

          var result = await apiResponse.json();

          if (result.error) {
            throw new Error(result.error);
          }

          setLinks(result.links || []);
          setTables(result.tables || []);
          setTextContent(result.text || '');
          setImages(result.images || []);
          setButtons(result.buttons || []);
          setCrawlResult(result);
          // 同时捕获 html 和 content（如果存在）
          setCapturedContent(result.text || result.content || '');
          setCapturedHtml(result.html || '');
          setActiveTab('markdown');

          var totalLinks = result.links ? result.links.length : 0;
          var totalTables = result.tables ? result.tables.length : 0;
          var totalImages = result.images ? result.images.length : 0;
          var totalButtons = result.buttons ? result.buttons.length : 0;

          setStatusMsg(' 爬取成功！卡片:' + (result._bookmarkInfo ? result._bookmarkInfo.name : '') + ' | 链接:' + totalLinks + ' | 表格:' + totalTables + ' | 图片:' + totalImages + ' | 按钮:' + totalButtons);
          setStatusType('success');
          setLoading(false);

        } catch (e) {
          console.error('[CrawlerLab] Error:', e);
          setStatusMsg(' 爬取失败：' + e.message);
          setStatusType('danger');
          setLoading(false);
        }
      }
    }

    async function captureElementContent() {
      if (!selectedBookmark) {
        setStatusMsg('请先选择一个爬虫卡片');
        setStatusType('danger');
        return;
      }

      if (!selectedBookmark.replySelector) {
        setStatusMsg('该卡片未设置自定义回复选择器，无法获取元素内容');
        setStatusType('warning');
        return;
      }

      setLoading(true);
      setStatusMsg(' 正在获取元素内容...');
      setStatusType('info');

      try {
        var apiUrl = 'http://localhost:3000/api/capture-element-content';
        var payload = { bookmarkIndex: selectedBookmark.index };

        var apiResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!apiResponse.ok) {
          // 尝试读取服务器返回的错误详情
          var errorText = '';
          try {
            var errorData = await apiResponse.json();
            errorText = errorData.error || '';
          } catch(e) {
            errorText = '';
          }
          throw new Error('API 请求失败: HTTP ' + apiResponse.status + (errorText ? ' - ' + errorText : ''));
        }

        var result = await apiResponse.json();

        // 如果后端返回等待状态（网页还在活动中）
        if (result.waiting) {
          setStatusMsg('⏳ ' + result.message);
          setStatusType('warning');
          setLoading(false);
          // 3秒后自动重试
          setTimeout(function() {
            captureElementContent();
          }, 3000);
          return;
        }

        if (result.error) {
          throw new Error(result.error);
        }

        setCapturedContent(result.content || '');
        setCapturedHtml(result.html || '');
        setTextContent(result.content || '');
        setActiveTab('markdown');  // 默认显示 Markdown 模式

        setStatusMsg(' 获取成功！元素内容: ' + (result.length || 0) + ' 字符');
        setStatusType('success');
        setLoading(false);

      } catch (e) {
        console.error('[CrawlerLab] Error:', e);
        setStatusMsg(' 获取元素内容失败：' + e.message);
        setStatusType('danger');
        setLoading(false);
      }
    }

    function selectBookmark(index) {
      var bm = bookmarks[index];
      if (!bm) return;
      setSelectedBookmark({ index: index, name: bm.name, url: bm.url, category: bm.category, previewOnly: bm.previewOnly, presetMessage: bm.presetMessage || '', replySelector: bm.replySelector || '', heartbeatSelector: bm.heartbeatSelector || '' });
      if (bm.presetMessage) {
        setCustomMessage(bm.presetMessage);
      } else {
        setCustomMessage('');
      }
    }

    function clearBookmarkSelection() {
      setSelectedBookmark(null);
      setCustomMessage('');
    }

    var categoryLabels = {
      'general': '📌 通用',
      'news': '📰 新闻',
      'shopping': '🛒 购物',
      'social': '💬 社交',
      'tech': '💻 科技',
      'finance': '💰 金融',
      'education': ' 教育',
      'weather': '🌤️ 天气',
      'ai-chat': '🤖 AI Chat',
      'other': '📁 其他'
    };

    async function fetchAndCrawl() {
      if (!targetUrl.trim()) {
        setStatusMsg('请输入网址');
        setStatusType('danger');
        return;
      }

      var url = targetUrl.trim();
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      if (electronStatus !== 'connected') {
        setStatusMsg('⚠️ Electron 爬虫 API 未连接，请先启动 Electron 爬虫应用。');
        setStatusType('danger');
        return;
      }

      setLoading(true);
      setStatusMsg('⚡ 正在通过 Electron 爬虫 API 爬取...');
      setStatusType('info');

      try {
        var apiUrl = 'http://localhost:3000/api/crawl?url=' + encodeURIComponent(url);
        var apiResponse = await fetch(apiUrl);
        
        if (!apiResponse.ok) {
          throw new Error('API 请求失败: HTTP ' + apiResponse.status);
        }

        var result = await apiResponse.json();
        
        if (result.error) {
          throw new Error(result.error);
        }

        setLinks(result.links || []);
        setTables(result.tables || []);
        setTextContent(result.text || '');
        setImages(result.images || []);
        setButtons(result.buttons || []);
        setCrawlResult(result);
        // 同时捕获 html 和 content（如果存在）
        setCapturedContent(result.text || result.content || '');
        setCapturedHtml(result.html || '');
        setActiveTab('markdown');
        
        var totalLinks = result.links ? result.links.length : 0;
        var totalTables = result.tables ? result.tables.length : 0;
        var totalImages = result.images ? result.images.length : 0;
        var totalButtons = result.buttons ? result.buttons.length : 0;
        
        setStatusMsg('✅ 爬取成功！链接:' + totalLinks + ' | 表格:' + totalTables + ' | 图片:' + totalImages + ' | 按钮:' + totalButtons);
        setStatusType('success');
        setLoading(false);
        
      } catch (e) {
        console.error('[CrawlerLab] Error:', e);
        setStatusMsg('⚠️ 爬取失败：' + e.message);
        setStatusType('danger');
        setLoading(false);
      }
    }

    function exportAllData() {
      if (!crawlResult) {
        setStatusMsg('请先爬取数据');
        setStatusType('danger');
        return;
      }
      
      var data = JSON.stringify(crawlResult, null, 2);
      downloadFile(data, 'crawler-all-data_' + Date.now() + '.json', 'application/json;charset=utf-8');
      setStatusMsg('✅ 全部数据已导出');
      setStatusType('success');
    }

    function exportLinks() {
      var csv = 'ID,文本,链接,标题\n';
      links.forEach(function(link) {
        csv += link.id + ',"' + link.text.replace(/"/g, '""') + '","' + link.href + '","' + (link.title || '').replace(/"/g, '""') + '"\n';
      });
      downloadFile(csv, 'links_' + Date.now() + '.csv', 'text/csv;charset=utf-8');
    }

    function exportTables() {
      var allText = '';
      tables.forEach(function(table, idx) {
        allText += '=== 表格 ' + (idx + 1) + ' ===\n';
        table.rows.forEach(function(row) {
          allText += row.join('\t') + '\n';
        });
        allText += '\n';
      });
      downloadFile(allText, 'tables_' + Date.now() + '.txt', 'text/plain;charset=utf-8');
    }

    function exportText() {
      downloadFile(textContent, 'text_' + Date.now() + '.txt', 'text/plain;charset=utf-8');
    }

    function exportImages() {
      var csv = 'ID,源地址,描述,宽度,高度\n';
      images.forEach(function(img) {
        csv += img.id + ',"' + img.src + '","' + img.alt.replace(/"/g, '""') + '",' + img.width + ',' + img.height + '\n';
      });
      downloadFile(csv, 'images_' + Date.now() + '.csv', 'text/csv;charset=utf-8');
    }

    function exportButtons() {
      var csv = 'ID,标签,文本,类型\n';
      buttons.forEach(function(btn) {
        csv += btn.id + ',' + btn.tag + ',"' + btn.text.replace(/"/g, '""') + '","' + btn.type + '"\n';
      });
      downloadFile(csv, 'buttons_' + Date.now() + '.csv', 'text/csv;charset=utf-8');
    }

    // ====== 新的显示模式: 文本 / Markdown / HTML ======

    // 辅助: 清理破坏性样式（类似 ai-response-viewer.html）
    function cleanInlineStyles(html) {
      if (!html) return html;
      // 移除 text-align:center, background 等破坏性属性
      return html.replace(/style="[^"]*"/gi, function(match) {
        var newStyle = match
          .replace(/text-align:\s*[^;]+;?/gi, '')
          .replace(/background(?:-color)?\s*:\s*[^;]+;?/gi, '')
          .replace(/padding(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
          .replace(/margin(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
          .replace(/display:\s*(?:block|flex|inline-flex|grid|inline-block|table)[^;]*;?/gi, '')
          .replace(/border(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
          .replace(/border-radius:\s*[^;]+;?/gi, '')
          .replace(/box-shadow:\s*[^;]+;?/gi, '')
          .replace(/var\(--[^)]+\)/gi, '')
          .replace(/rgba?\([^)]+\)/gi, '');
        newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^style="\s*;\s*/, 'style="').replace(/\s*;\s*"$/, '"');
        if (/^style="\s*"?$/.test(newStyle)) return '';
        return newStyle;
      });
    }

    // 辅助: 注入智能样式（类似 aiChatParserPlugin.js 的 injectInlineStyles）
    function injectSmartStyles(html) {
      if (!html) return html;
      var result = html;

      // 1. <a> 标签: 识别引用数字 vs 普通链接
      result = result.replace(/<a(\s[^>]*)?>([\s\S]*?)<\/a>/gi, function(match, attrs, innerHtml) {
        var innerText = innerHtml.replace(/<[^>]+>/g, '').trim();
        var cleanedAttrs = (attrs || '').replace(/style\s*=\s*"[^"]*"/gi, '').trim();
        var isCitation = /^\d{1,2}$/.test(innerText) || /^-?\s*\d{1,2}\s*-?$/.test(innerText);

        var displayContent, styleAttr;
        if (isCitation) {
          displayContent = innerText.replace(/[-\s]/g, '') || innerText;
          styleAttr = 'style="display:inline-block;text-align:center;border:1.5px solid #475569;border-radius:50%;min-width:18px;height:18px;line-height:15px;font-size:10px;font-weight:600;color:#475569;text-decoration:none;margin:0 1px;vertical-align:baseline;background:transparent;padding:0 !important;"';
        } else {
          displayContent = innerHtml;
          styleAttr = 'style="display:inline;color:#2563eb;text-decoration:underline;font-weight:500;"';
        }

        if (cleanedAttrs && cleanedAttrs.length > 0) {
          return '<a ' + styleAttr + ' ' + cleanedAttrs + '>' + displayContent + '</a>';
        } else {
          return '<a ' + styleAttr + '>' + displayContent + '</a>';
        }
      });

      // 2. <strong>, <b> 高亮
      result = result.replace(/<(strong|b)(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, function(match, tag, attrs, content) {
        return '<span style="background:linear-gradient(120deg,#fef3c7 0%,#fde68a 100%);color:#7c2d12;padding:2px 6px;border-radius:4px;font-weight:700;">' + content + '</span>';
      });

      // 3. <h1> - <h4> 标题
      result = result.replace(/<(h[1-4])(\s[^>]*)?>([\s\S]*?)<\/\1>/gi, function(match, tag, attrs, content) {
        var sizes = { h1: '22px', h2: '20px', h3: '18px', h4: '16px' };
        var colors = { h1: '#1e40af', h2: '#1e3a8a', h3: '#2563eb', h4: '#3b82f6' };
        return '<' + tag + ' style="font-size:' + sizes[tag] + ';font-weight:700;color:' + colors[tag] + ';margin:16px 0 10px 0;line-height:1.5;">' + content + '</' + tag + '>';
      });

      // 4. <p> 段落
      result = result.replace(/<p(\s[^>]*)?>([\s\S]*?)<\/p>/gi, '<p style="margin:8px 0;line-height:1.7;font-size:14px;color:#1f2937;">$2</p>');

      // 5. <table> 表格
      result = result.replace(/<table(\s[^>]*)?>([\s\S]*?)<\/table>/gi, function(match, attrs, content) {
        var styledContent = content
          .replace(/<th(\s[^>]*)?>([\s\S]*?)<\/th>/gi, '<th style="padding:10px 14px;text-align:left;font-weight:600;font-size:13px;background:#f1f5f9;color:#334155;border:1px solid #e5e7eb;">$2</th>')
          .replace(/<td(\s[^>]*)?>([\s\S]*?)<\/td>/gi, '<td style="padding:10px 14px;font-size:14px;color:#374151;border:1px solid #e5e7eb;text-align:left;vertical-align:middle;">$2</td>')
          .replace(/<tr(\s[^>]*)?>([\s\S]*?)<\/tr>/gi, '<tr style="border-bottom:1px solid #e5e7eb;">$2</tr>');
        return '<table style="width:100%;border-collapse:collapse;margin:12px 0;background:white;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">' + styledContent + '</table>';
      });

      // 6. <code> 行内代码
      result = result.replace(/<code(\s[^>]*)?>([^<]*)<\/code>/gi, '<code style="background:#fef2f2;color:#dc2626;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:13px;">$2</code>');

      // 7. <blockquote> 引用
      result = result.replace(/<blockquote(\s[^>]*)?>([\s\S]*?)<\/blockquote>/gi, '<blockquote style="border-left:4px solid #3b82f6;padding:10px 16px;margin:12px 0;background:#f8fafc;color:#4b5563;font-style:italic;border-radius:0 6px 6px 0;">$2</blockquote>');

      return result;
    }

    // 辅助: 格式化 HTML 源码（添加缩进）
    function formatHtmlSource(html) {
      if (!html) return '';
      // 简化版: 在标签间添加换行
      var formatted = html
        .replace(/></g, '>\n<')
        .replace(/\n{2,}/g, '\n')
        .trim();
      return formatted;
    }

    // 新显示模式 1: 纯文本
    function renderPlainText() {
      var content = capturedContent || textContent;
      if (!content) {
        return createElement('div', { style: { textAlign: 'center', padding: '40px', color: C.textLight } }, '点击"获取元素内容"按钮获取数据');
      }
      return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        createElement('div', { style: { padding: '10px 16px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' } },
          createElement('span', { style: { fontSize: '12px', color: C.textDark } }, '📄 纯文本模式 · 字符数: ' + content.length),
          createElement('button', { onClick: function() { downloadFile(content, 'content.txt', 'text/plain'); }, style: btnStyle }, '📥 导出')
        ),
        createElement('pre', { style: { padding: '16px', overflow: 'auto', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0, fontSize: '13px', lineHeight: '1.7', color: C.textDark, background: 'white' } },
          escapeHtml(content)
        )
      );
    }

    // 新显示模式 2: Markdown / 智能渲染（带样式的 HTML）
    function renderSmartMarkdown() {
      var sourceHtml = capturedHtml || capturedContent || textContent;
      if (!sourceHtml) {
        return createElement('div', { style: { textAlign: 'center', padding: '40px', color: C.textLight } }, '点击"获取元素内容"按钮获取数据');
      }

      // 清理破坏性样式
      var cleaned = cleanInlineStyles(sourceHtml);

      // 注入智能样式
      var styled = injectSmartStyles(cleaned);

      // 字符数统计（纯文本）
      var plainText = sourceHtml.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();
      var charCount = plainText.length;

      return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        createElement('div', { style: { padding: '10px 16px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg,#f1f5f9,#e2e8f0)' } },
          createElement('span', { style: { fontSize: '12px', color: C.textDark, fontWeight: '500' } }, '🎨 Markdown 模式 · ' + charCount + ' 字符'),
          createElement('button', { onClick: function() { downloadFile(styled, 'content.html', 'text/html'); }, style: btnStyle }, '📥 导出')
        ),
        createElement('div', {
          style: { padding: '16px 20px', overflow: 'auto', flex: 1, background: 'white', fontSize: '14px', lineHeight: '1.7', color: '#374151' },
          dangerouslySetInnerHTML: { __html: styled }
        })
      );
    }

    // 新显示模式 3: HTML 源码
    function renderHtmlSource() {
      var sourceHtml = capturedHtml || capturedContent || textContent;
      if (!sourceHtml) {
        return createElement('div', { style: { textAlign: 'center', padding: '40px', color: C.textLight } }, '点击"获取元素内容"按钮获取数据');
      }

      var formatted = formatHtmlSource(sourceHtml);

      return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        createElement('div', { style: { padding: '10px 16px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#fef3c7' } },
          createElement('span', { style: { fontSize: '12px', color: '#92400e', fontWeight: '500' } }, '🌐 HTML 源码模式 · ' + sourceHtml.length + ' 字符'),
          createElement('button', { onClick: function() { downloadFile(sourceHtml, 'source.html', 'text/html'); }, style: btnStyle }, '📥 导出')
        ),
        createElement('pre', { style: { padding: '16px', overflow: 'auto', flex: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-all', margin: 0, fontSize: '12px', lineHeight: '1.6', color: '#1f2937', background: '#fefce8', fontFamily: 'Menlo, Monaco, Consolas, monospace' } },
          escapeHtml(formatted)
        )
      );
    }

    function renderBookmarkSelector() {
      var filteredBookmarks = bookmarks.filter(function(bm) {
        if (!bookmarkSearch) return true;
        var s = bookmarkSearch.toLowerCase();
        return (bm.name || '').toLowerCase().indexOf(s) >= 0 || (bm.url || '').toLowerCase().indexOf(s) >= 0 || (bm.category || '').toLowerCase().indexOf(s) >= 0;
      });

      return createElement('div', { style: { padding: '12px 16px', background: C.cardBg, borderBottom: '1px solid ' + C.border } },
        createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', gap: '10px' } },
          createElement('div', { style: { flex: 1, position: 'relative' } },
            createElement('input', {
              type: 'text',
              value: selectedBookmark ? escapeHtml(selectedBookmark.name) : bookmarkSearch,
              onChange: function(e) { setBookmarkSearch(e.target.value); },
              onFocus: function() { setShowBookmarkDropdown(true); fetchBookmarks(); },
              onBlur: function() { setTimeout(function() { setShowBookmarkDropdown(false); }, 200); },
              onKeyDown: function(e) { if (e.key === 'Escape') setShowBookmarkDropdown(false); },
              placeholder: '📋 选择爬虫卡片...',
              readOnly: !showBookmarkDropdown,
              style: { 
                width: '100%', 
                padding: '10px 14px', 
                border: '2px solid ' + (showBookmarkDropdown ? C.primary : C.border), 
                borderRadius: '8px', 
                fontSize: '14px',
                outline: 'none',
                cursor: 'pointer',
                transition: 'border-color 0.2s'
              }
            }),
            showBookmarkDropdown && createElement('div', { style: { position: 'absolute', top: '100%', left: 0, right: 0, maxHeight: '240px', overflowY: 'auto', background: C.cardBg, border: '1px solid ' + C.border, borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 1000, marginTop: '4px' } },
              filteredBookmarks.length === 0
                ? createElement('div', { style: { padding: '16px', textAlign: 'center', color: C.textLight, fontSize: '13px' } }, '暂无爬虫卡片')
                : filteredBookmarks.map(function(bm) {
                    var realIndex = bookmarks.indexOf(bm);
                    var isSelected = selectedBookmark && selectedBookmark.index === realIndex;
                    return createElement('div', {
                      key: realIndex,
                      onMouseDown: function() { selectBookmark(realIndex); setShowBookmarkDropdown(false); },
                      style: {
                        padding: '10px 14px',
                        borderBottom: '1px solid ' + C.border,
                        background: isSelected ? '#e0e7ff' : 'white',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        transition: 'background 0.2s'
                      }
                    },
                      createElement('span', { style: { fontSize: '14px' } }, bm.previewOnly ? '' : '🕷️'),
                      createElement('span', { style: { flex: 1, fontSize: '13px', fontWeight: isSelected ? 'bold' : 'normal', color: isSelected ? C.primary : C.textDark } },
                        escapeHtml(bm.name)
                      ),
                      createElement('span', {
                        style: {
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '11px',
                          fontWeight: '500',
                          background: isSelected ? '#c7d2fe' : '#f1f5f9',
                          color: isSelected ? C.primaryDark : C.textLight,
                          whiteSpace: 'nowrap'
                        }
                      }, categoryLabels[bm.category] || '📁 其他')
                    );
                  })
            ),
            selectedBookmark && createElement('button', {
              onClick: clearBookmarkSelection,
              style: { position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', padding: '4px 10px', background: C.danger, color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', whiteSpace: 'nowrap' }
            }, ' 清除')
          ),
          selectedBookmark && createElement('div', { style: { display: 'flex', gap: '8px', flexShrink: 0 } },
            selectedBookmark.replySelector && createElement('button', { 
              onClick: captureElementContent, 
              disabled: loading,
              style: { 
                padding: '8px 16px', 
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, #f59e0b, #d97706)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '13px', 
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              } 
            },
              loading ? '⏳ 获取中...' : ' 获取元素内容'
            ),
            createElement('button', { 
              onClick: crawlSelectedBookmark, 
              disabled: loading,
              title: '只会在服务器端程式的 webview 中预览网页，在当前前端环境中并不会显示此网页',
              style: { 
                padding: '8px 16px', 
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '13px', 
                fontWeight: 'bold',
                whiteSpace: 'nowrap'
              } 
            },
              loading ? '⏳ 浏览中...' : '🌐 只浏览网页'
            )
          )
        ),
        selectedBookmark && createElement('div', { style: { marginTop: '10px', padding: '10px 14px', background: '#fef3c7', borderRadius: '6px', border: '1px solid #fde68a', fontSize: '12px', color: '#92400e' } },
          '✅ 已选择: ' + escapeHtml(selectedBookmark.name) + (selectedBookmark.previewOnly ? ' (只预览模式)' : '')
        )
      );
    }

    function renderCustomMessageEditor() {
      if (!selectedBookmark) return null;
      if (selectedBookmark.previewOnly === false && !selectedBookmark.presetMessage) return null;

      return createElement('div', { style: { padding: '10px 16px', background: '#f0f9ff', borderBottom: '1px solid ' + C.border } },
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' } },
          createElement('span', { style: { fontSize: '13px', fontWeight: '600', color: C.textDark } }, '💬 自定义消息:'),
          createElement('span', { style: { fontSize: '11px', color: C.textLight } }, '(选填，部分卡片支持)')
        ),
        createElement('textarea', {
          value: customMessage,
          onChange: function(e) { setCustomMessage(e.target.value); },
          placeholder: '请输入要发送给爬虫卡片的自定义消息...',
          rows: 3,
          style: {
            width: '100%',
            padding: '10px 12px',
            border: '1px solid ' + C.border,
            borderRadius: '6px',
            fontSize: '13px',
            outline: 'none',
            resize: 'vertical',
            fontFamily: '-apple-system, sans-serif'
          }
        })
      );
    }

    var thStyle = { padding: '10px 12px', textAlign: 'left', borderBottom: '2px solid ' + C.border, fontWeight: 'bold', fontSize: '12px', color: C.textDark };
    var tdStyle = { padding: '8px 12px', fontSize: '13px', color: C.textDark };
    var btnStyle = { padding: '6px 16px', background: 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold', marginLeft: '8px' };
    var tabBtnStyle = function(active) {
      return {
        padding: '10px 20px',
        border: 'none',
        background: active ? 'white' : 'transparent',
        color: active ? C.primary : C.textLight,
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: active ? 'bold' : 'normal',
        borderBottom: active ? '3px solid ' + C.primary : '3px solid transparent'
      };
    };

    var tabs = [
      { id: 'text', label: '📄 文本' },
      { id: 'markdown', label: '🎨 Markdown' },
      { id: 'html', label: '🌐 HTML' }
    ];

    return createElement(window.FloatingWindowReact, {
      isOpen: true,
      width: '1000px',
      height: Math.floor(window.innerHeight * 0.88) + 'px',
      onClose: function() { var c = document.getElementById('crawler-lab-window'); if (c) { ReactDOM.unmountComponentAtNode(c); if (c.parentNode) c.parentNode.removeChild(c); } },
      title: '🔬 爬虫实验室',
      sourceFile: 'crawlerLabPlugin.js'
    },
      createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system, sans-serif' } },
        createElement('div', { style: { padding: '12px 16px', background: C.cardBg, borderBottom: '1px solid ' + C.border } },
          createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px', flexWrap: 'wrap' } },
            createElement('span', { 
              style: { 
                padding: '4px 12px', 
                borderRadius: '16px', 
                fontSize: '12px', 
                fontWeight: 'bold',
                background: electronStatus === 'connected' ? '#dcfce7' : '#fef2f2',
                color: electronStatus === 'connected' ? '#166534' : '#dc2626',
                cursor: electronStatus === 'connected' ? 'pointer' : 'default'
              },
              onClick: electronStatus === 'connected' ? function() { setShowApiDocs(!showApiDocs); } : null
            }, 
              electronStatus === 'connected' ? '⚡ Electron API (已连接)' : '⚡ Electron API (未连接)'
            ),
            electronStatus === 'connected' && createElement('span', { style: { fontSize: '12px', color: C.textLight } }, 'API 端点: http://localhost:3000')
          )
        ),
        showApiDocs && createElement('div', { style: { padding: '16px', background: '#f0fdf4', borderBottom: '1px solid ' + C.border, fontSize: '13px' } },
          createElement('div', { style: { fontWeight: 'bold', marginBottom: '10px', fontSize: '14px' } }, ' Electron API 服务说明'),
          createElement('table', { style: { width: '100%', borderCollapse: 'collapse' } },
            createElement('thead', null,
              createElement('tr', { style: { background: '#dcfce7' } },
                createElement('th', { style: { padding: '8px', textAlign: 'left', borderBottom: '1px solid ' + C.border } }, '端点'),
                createElement('th', { style: { padding: '8px', textAlign: 'left', borderBottom: '1px solid ' + C.border } }, '方法'),
                createElement('th', { style: { padding: '8px', textAlign: 'left', borderBottom: '1px solid ' + C.border } }, '说明'),
                createElement('th', { style: { padding: '8px', textAlign: 'left', borderBottom: '1px solid ' + C.border } }, '参数')
              )
            ),
            createElement('tbody', null,
              createElement('tr', { style: { borderBottom: '1px solid ' + C.border } },
                createElement('td', { style: { padding: '8px', fontFamily: 'monospace', fontSize: '12px' } }, '/api/bookmarks'),
                createElement('td', { style: { padding: '8px' } }, 'GET'),
                createElement('td', { style: { padding: '8px' } }, '获取爬虫卡片列表'),
                createElement('td', { style: { padding: '8px', color: C.textLight } }, '无')
              ),
              createElement('tr', { style: { borderBottom: '1px solid ' + C.border } },
                createElement('td', { style: { padding: '8px', fontFamily: 'monospace', fontSize: '12px' } }, '/api/crawl'),
                createElement('td', { style: { padding: '8px' } }, 'GET'),
                createElement('td', { style: { padding: '8px' } }, '爬取指定网址'),
                createElement('td', { style: { padding: '8px', color: C.textLight } }, 'url=网址')
              ),
              createElement('tr', { style: { borderBottom: '1px solid ' + C.border } },
                createElement('td', { style: { padding: '8px', fontFamily: 'monospace', fontSize: '12px' } }, '/api/crawl-bookmark/:index'),
                createElement('td', { style: { padding: '8px' } }, 'POST'),
                createElement('td', { style: { padding: '8px' } }, '爬取指定爬虫卡片'),
                createElement('td', { style: { padding: '8px', color: C.textLight } }, 'body: { presetMessage }')
              ),
              createElement('tr', { style: { borderBottom: '1px solid ' + C.border } },
                createElement('td', { style: { padding: '8px', fontFamily: 'monospace', fontSize: '12px' } }, '/api/preview-bookmark/:index'),
                createElement('td', { style: { padding: '8px' } }, 'POST'),
                createElement('td', { style: { padding: '8px' } }, '在 electron-crawler 主窗口中预览卡片'),
                createElement('td', { style: { padding: '8px', color: C.textLight } }, 'body: { presetMessage }')
              ),
              createElement('tr', { style: { borderBottom: '1px solid ' + C.border } },
                createElement('td', { style: { padding: '8px', fontFamily: 'monospace', fontSize: '12px' } }, '/api/capture-element-content'),
                createElement('td', { style: { padding: '8px' } }, 'POST'),
                createElement('td', { style: { padding: '8px' } }, '获取卡片网页中的指定元素内容'),
                createElement('td', { style: { padding: '8px', color: C.textLight } }, 'body: { bookmarkIndex }')
              ),
              createElement('tr', null,
                createElement('td', { style: { padding: '8px', fontFamily: 'monospace', fontSize: '12px' } }, '/api/status'),
                createElement('td', { style: { padding: '8px' } }, 'GET'),
                createElement('td', { style: { padding: '8px' } }, '检查 API 服务状态'),
                createElement('td', { style: { padding: '8px', color: C.textLight } }, '无')
              )
            )
          )
        ),
        createElement('div', { style: { display: 'flex', borderBottom: '1px solid ' + C.border, background: '#f1f5f9' } },
          createElement('button', {
            onClick: function() { setInputMode('card'); },
            style: {
              padding: '10px 24px',
              border: 'none',
              background: inputMode === 'card' ? 'white' : 'transparent',
              color: inputMode === 'card' ? C.primary : C.textLight,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: inputMode === 'card' ? 'bold' : 'normal',
              borderBottom: inputMode === 'card' ? '3px solid ' + C.primary : '3px solid transparent'
            }
          }, '📋 卡片模式'),
          createElement('button', {
            onClick: function() { setInputMode('url'); },
            style: {
              padding: '10px 24px',
              border: 'none',
              background: inputMode === 'url' ? 'white' : 'transparent',
              color: inputMode === 'url' ? C.primary : C.textLight,
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: inputMode === 'url' ? 'bold' : 'normal',
              borderBottom: inputMode === 'url' ? '3px solid ' + C.primary : '3px solid transparent'
            }
          }, '🔗 网址模式')
        ),
        inputMode === 'card' && createElement('div', { style: { flex: 1, overflowY: 'auto', overflowX: 'hidden' } },
          renderBookmarkSelector(),
          renderCustomMessageEditor(),
          statusMsg && createElement('div', { 
            style: { 
              padding: '10px 14px', 
              borderRadius: '6px',
              background: statusType === 'success' ? '#ecfdf5' : (statusType === 'danger' ? '#fef2f2' : '#eff6ff'),
              border: '1px solid ' + (statusType === 'success' ? '#a7f3d0' : (statusType === 'danger' ? '#fecaca' : '#bfdbfe')),
              color: statusType === 'success' ? '#065f46' : (statusType === 'danger' ? '#991b1b' : '#1e40af'),
              fontSize: '13px',
              margin: '10px 16px'
            } 
          }, statusMsg),
          createElement('div', { style: { display: 'flex', borderBottom: '1px solid ' + C.border, background: '#f1f5f9' } },
            tabs.map(function(tab) {
              return createElement('button', { 
                key: tab.id,
                onClick: function() { setActiveTab(tab.id); },
                style: tabBtnStyle(activeTab === tab.id)
              }, tab.label);
            })
          ),
          createElement('div', { style: { flex: 1, overflow: 'hidden', background: 'white' } },
            activeTab === 'text' && renderPlainText(),
            activeTab === 'markdown' && renderSmartMarkdown(),
            activeTab === 'html' && renderHtmlSource()
          )
        ),
        inputMode === 'url' && createElement('div', { style: { padding: '12px 16px', background: C.cardBg, borderBottom: '1px solid ' + C.border } },
          createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            createElement('span', { style: { fontSize: '13px', fontWeight: '500', color: C.textDark, whiteSpace: 'nowrap' } }, '🔗 目标网址:'),
            createElement('input', {
              type: 'text',
              value: targetUrl,
              onChange: function(e) { setTargetUrl(e.target.value); },
              onKeyDown: function(e) { if (e.key === 'Enter') fetchAndCrawl(); },
              placeholder: '请输入要爬取的网址，例如：https://baike.baidu.com',
              style: { 
                flex: 1, 
                padding: '10px 14px', 
                border: '2px solid ' + C.border, 
                borderRadius: '8px', 
                fontSize: '14px',
                outline: 'none'
              }
            }),
            createElement('button', { 
              onClick: fetchAndCrawl, 
              disabled: loading,
              style: { 
                padding: '10px 24px', 
                background: loading ? '#94a3b8' : 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: loading ? 'not-allowed' : 'pointer', 
                fontSize: '14px', 
                fontWeight: 'bold'
              } 
            },
              loading ? ' 爬取中...' : '🎯 开始爬取'
            ),
            crawlResult && createElement('button', { 
              onClick: exportAllData, 
              style: { 
                padding: '10px 20px', 
                background: 'linear-gradient(135deg, #10b981, #059669)', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                fontSize: '14px', 
                fontWeight: 'bold'
              } 
            },
              ' 导出全部'
            )
          ),
          statusMsg && createElement('div', { 
            style: { 
              marginTop: '10px', 
              padding: '10px 14px', 
              borderRadius: '6px',
              background: statusType === 'success' ? '#ecfdf5' : (statusType === 'danger' ? '#fef2f2' : '#eff6ff'),
              border: '1px solid ' + (statusType === 'success' ? '#a7f3d0' : (statusType === 'danger' ? '#fecaca' : '#bfdbfe')),
              color: statusType === 'success' ? '#065f46' : (statusType === 'danger' ? '#991b1b' : '#1e40af'),
              fontSize: '13px'
            } 
          }, statusMsg),
          createElement('div', { style: { display: 'flex', borderBottom: '1px solid ' + C.border, background: '#f1f5f9', marginTop: '10px' } },
            tabs.map(function(tab) {
              return createElement('button', { 
                key: tab.id,
                onClick: function() { setActiveTab(tab.id); },
                style: tabBtnStyle(activeTab === tab.id)
              }, tab.label);
            })
          ),
          createElement('div', { style: { flex: 1, overflow: 'hidden', background: 'white' } },
            activeTab === 'text' && renderPlainText(),
            activeTab === 'markdown' && renderSmartMarkdown(),
            activeTab === 'html' && renderHtmlSource()
          )
        )
      )
    );
  }

  function openCrawlerLab() {
    var existing = document.getElementById('crawler-lab-window');
    if (existing) {
      existing.style.display = 'block';
      return;
    }
    
    var container = document.createElement('div');
    container.id = 'crawler-lab-window';
    document.body.appendChild(container);
    ReactDOM.render(createElement(CrawlerLabApp), container);
  }

  function init() {
    var btn = document.getElementById('crawlerLabBtn');
    if (!btn) { setTimeout(init, 1000); return; }
    btn.addEventListener('click', function() {
      try {
        if (!window.FloatingWindowReact) { alert('FloatingWindowReact 未加载'); return; }
        openCrawlerLab();
      } catch(err) { alert('打开失败: ' + err.message); console.error(err); }
    });
    console.log('[CrawlerLab] ✅ 已初始化');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
