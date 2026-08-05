/**
 * 全网搜索 API 调用实验室 v4.0
 *
 * 功能：
 * 1. 生成各大搜索引擎的搜索链接
 * 2. 集成简易浏览器（使用当前页面作为"内联浏览器"）
 * 3. 一键切换到爬虫实验室爬取数据
 * 4. 自动检测页面加载完成，提示爬取
 */

(function() {
  'use strict';

  if (!window.React || !window.ReactDOM) {
    console.error('[GlobalSearchApiLab] React 未加载');
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
    warning: '#f59e0b',
    bg: '#f8fafc',
    cardBg: '#ffffff',
    border: '#e2e8f0',
    textDark: '#1e293b',
    textLight: '#64748b'
  };

  var SEARCH_ENGINES = [
    {
      id: 'bing',
      name: '微软 Bing',
      icon: '🔍',
      baseUrl: 'https://www.bing.com/search',
      queryParam: 'q',
      description: 'Bing 搜索引擎'
    },
    {
      id: 'baidu',
      name: '百度搜索',
      icon: '🌐',
      baseUrl: 'https://www.baidu.com/s',
      queryParam: 'wd',
      description: '百度搜索引擎'
    },
    {
      id: 'duckduckgo',
      name: 'DuckDuckGo',
      icon: '🦆',
      baseUrl: 'https://duckduckgo.com/',
      queryParam: 'q',
      description: '隐私搜索引擎'
    },
    {
      id: 'sogou',
      name: '搜狗搜索',
      icon: '🐕',
      baseUrl: 'https://www.sogou.com/web',
      queryParam: 'query',
      description: '搜狗搜索引擎'
    },
    {
      id: 'google',
      name: 'Google 搜索',
      icon: '🔎',
      baseUrl: 'https://www.google.com/search',
      queryParam: 'q',
      description: 'Google 搜索引擎'
    }
  ];

  function escapeHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function buildSearchUrl(engine, query) {
    var url = new URL(engine.baseUrl);
    url.searchParams.set(engine.queryParam, query);
    return url.toString();
  }

  function GlobalSearchApiLabApp() {
    var _s1 = useState('');
    var searchQuery = _s1[0];
    var setSearchQuery = _s1[1];

    var _s2 = useState({});
    var selectedEngines = _s2[0];
    var setSelectedEngines = _s2[1];

    var _s3 = useState([]);
    var searchHistory = _s3[0];
    var setSearchHistory = _s3[1];

    var _s4 = useState('results');
    var activeTab = _s4[0];
    var setActiveTab = _s4[1];

    var _s5 = useState({});
    var openTabs = _s5[0];
    var setOpenTabs = _s5[1];

    var _s6 = useState(null);
    var currentEngine = _s6[0];
    var setCurrentEngine = _s6[1];

    var _s7 = useState(false);
    var pageLoaded = _s7[0];
    var setPageLoaded = _s7[1];

    useEffect(function() {
      try {
        var saved = localStorage.getItem('globalSearchApiLab_history');
        if (saved) {
          setSearchHistory(JSON.parse(saved));
        }
      } catch (e) {
        console.error('加载历史记录失败:', e);
      }
      
      var defaultSelected = {};
      SEARCH_ENGINES.forEach(function(engine) {
        defaultSelected[engine.id] = true;
      });
      setSelectedEngines(defaultSelected);

      // 监听页面加载完成
      var checkInterval = setInterval(function() {
        if (currentEngine && document.readyState === 'complete') {
          setPageLoaded(true);
        }
      }, 1000);

      return function() {
        clearInterval(checkInterval);
      };
    }, [currentEngine]);

    var saveToHistory = useCallback(function(query, results) {
      var newEntry = {
        id: Date.now(),
        query: query,
        timestamp: new Date().toISOString(),
        results: results
      };
      setSearchHistory(function(prev) {
        var updated = [newEntry].concat(prev).slice(0, 50);
        try {
          localStorage.setItem('globalSearchApiLab_history', JSON.stringify(updated));
        } catch (e) {
          console.error('保存历史记录失败:', e);
        }
        return updated;
      });
    }, []);

    var clearHistory = useCallback(function() {
      if (confirm('确定要清空所有历史记录吗？')) {
        setSearchHistory([]);
        try {
          localStorage.removeItem('globalSearchApiLab_history');
        } catch (e) {
          console.error('清除历史记录失败:', e);
        }
      }
    }, []);

    var toggleEngine = useCallback(function(engineId) {
      setSelectedEngines(function(prev) {
        var updated = Object.assign({}, prev);
        updated[engineId] = !updated[engineId];
        return updated;
      });
    }, []);

    var toggleOpenTab = useCallback(function(engineId) {
      setOpenTabs(function(prev) {
        var updated = Object.assign({}, prev);
        updated[engineId] = !updated[engineId];
        return updated;
      });
    }, []);

    var executeSearch = useCallback(function() {
      if (!searchQuery.trim()) {
        return;
      }

      var selectedEngineList = SEARCH_ENGINES.filter(function(engine) {
        return selectedEngines[engine.id];
      });

      if (selectedEngineList.length === 0) {
        return;
      }

      var results = selectedEngineList.map(function(engine) {
        return {
          engineId: engine.id,
          engineName: engine.name,
          engineIcon: engine.icon,
          searchUrl: buildSearchUrl(engine, searchQuery),
          opened: false
        };
      });

      saveToHistory(searchQuery, results);
    }, [searchQuery, selectedEngines, saveToHistory]);

    var openSearchUrl = useCallback(function(url, engine) {
      setCurrentEngine(engine);
      setPageLoaded(false);
      window.open(url, '_blank');
    }, []);

    var openInCurrentTab = useCallback(function(url, engine) {
      setCurrentEngine(engine);
      setPageLoaded(false);
      window.location.href = url;
    }, []);

    var loadHistoryEntry = useCallback(function(entry) {
      setSearchQuery(entry.query);
      setActiveTab('results');
    }, []);

    var exportAllUrls = useCallback(function() {
      var selectedEngineList = SEARCH_ENGINES.filter(function(engine) {
        return selectedEngines[engine.id];
      });
      
      if (selectedEngineList.length === 0 || !searchQuery.trim()) {
        alert('请选择搜索引擎并输入关键词');
        return;
      }
      
      var urls = selectedEngineList.map(function(engine) {
        return engine.name + ': ' + buildSearchUrl(engine, searchQuery);
      }).join('\n');
      
      var blob = new Blob([urls], { type: 'text/plain;charset=utf-8' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'search_urls_' + Date.now() + '.txt';
      a.click();
      URL.revokeObjectURL(a.href);
    }, [searchQuery, selectedEngines]);

    var openCrawlerLab = useCallback(function() {
      var btn = document.getElementById('crawlerLabBtn');
      if (btn) {
        btn.click();
      } else {
        alert('请先加载爬虫实验室插件');
      }
    }, []);

    function renderEnginesSelection() {
      return createElement('div', { style: { padding: '12px 16px', background: C.cardBg, borderBottom: '1px solid ' + C.border } },
        createElement('div', { style: { fontWeight: 'bold', marginBottom: '8px', color: C.textDark } }, '选择搜索引擎:'),
        createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px' } },
          SEARCH_ENGINES.map(function(engine) {
            var isSelected = selectedEngines[engine.id];
            return createElement('label', { 
              key: engine.id,
              style: { 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px',
                padding: '6px 12px',
                background: isSelected ? '#e0e7ff' : '#f3f4f6',
                border: '2px solid ' + (isSelected ? C.primary : C.border),
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }
            },
              createElement('input', {
                type: 'checkbox',
                checked: isSelected,
                onChange: function() { toggleEngine(engine.id); },
                style: { margin: 0 }
              }),
              createElement('span', { style: { fontSize: '16px' } }, engine.icon),
              createElement('span', { style: { fontSize: '13px', fontWeight: isSelected ? 'bold' : 'normal' } }, engine.name)
            );
          })
        )
      );
    }

    function renderSearchInput() {
      return createElement('div', { style: { padding: '12px 16px', background: C.cardBg, borderBottom: '1px solid ' + C.border } },
        createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' } },
          createElement('span', { style: { fontSize: '13px', fontWeight: 'bold', color: C.primaryDark, whiteSpace: 'nowrap' } }, '🔍 搜索关键词:'),
          createElement('input', {
            type: 'text',
            value: searchQuery,
            onChange: function(e) { setSearchQuery(e.target.value); },
            onKeyDown: function(e) { if (e.key === 'Enter') executeSearch(); },
            placeholder: '输入要搜索的关键词...',
            style: { 
              flex: 1, 
              padding: '10px 14px', 
              border: '2px solid ' + C.primary, 
              borderRadius: '8px', 
              fontSize: '14px', 
              outline: 'none', 
              background: '#fff', 
              boxShadow: '0 0 0 3px rgba(99,102,241,0.1)' 
            }
          })
        ),
        createElement('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
          createElement('button', { 
            onClick: executeSearch, 
            style: { 
              padding: '10px 20px', 
              background: 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              fontWeight: 'bold'
            } 
          }, '📋 生成链接'),
          searchQuery.trim() && createElement('button', { 
            onClick: function() {
              var engines = SEARCH_ENGINES.filter(function(e) { return selectedEngines[e.id]; });
              engines.forEach(function(engine, index) {
                setTimeout(function() {
                  openSearchUrl(buildSearchUrl(engine, searchQuery), engine);
                }, index * 300);
              });
            },
            style: { 
              padding: '10px 20px', 
              background: '#f59e0b', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              fontWeight: 'bold'
            } 
          }, '🚀 全部打开'),
          searchQuery.trim() && createElement('button', { 
            onClick: exportAllUrls,
            style: { 
              padding: '10px 20px', 
              background: '#10b981', 
              color: '#fff', 
              border: 'none', 
              borderRadius: '8px', 
              cursor: 'pointer', 
              fontSize: '14px', 
              fontWeight: 'bold'
            } 
          }, '📥 导出链接')
        )
      );
    }

    function renderBrowserPanel() {
      if (!currentEngine) return null;

      return createElement('div', { 
        style: { 
          padding: '12px 16px', 
          background: pageLoaded ? '#ecfdf5' : '#eff6ff', 
          borderBottom: '1px solid ' + C.border,
          borderLeft: '4px solid ' + (pageLoaded ? C.success : C.primary)
        } 
      },
        createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
            createElement('span', { style: { fontSize: '20px' } }, currentEngine.icon),
            createElement('span', { style: { fontWeight: 'bold', fontSize: '14px', color: C.textDark } }, 
              currentEngine.name + ' 已打开'
            ),
            pageLoaded && createElement('span', { 
              style: { 
                padding: '4px 10px', 
                background: C.success, 
                color: '#fff', 
                borderRadius: '12px', 
                fontSize: '12px', 
                fontWeight: 'bold' 
              } 
            }, '✅ 页面已加载')
          ),
          createElement('div', { style: { display: 'flex', gap: '8px' } },
            createElement('button', {
              onClick: openCrawlerLab,
              disabled: !pageLoaded,
              style: { 
                padding: '8px 16px', 
                background: pageLoaded ? 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')' : '#cbd5e1', 
                color: '#fff', 
                border: 'none', 
                borderRadius: '6px', 
                cursor: pageLoaded ? 'pointer' : 'not-allowed', 
                fontSize: '13px', 
                fontWeight: 'bold'
              }
            }, '🕷️ 打开爬虫实验室')
          )
        ),
        createElement('div', { style: { marginTop: '10px', fontSize: '13px', color: C.textLight } },
          '💡 提示：在新标签页中打开搜索结果后，点击"打开爬虫实验室"即可爬取当前页面数据'
        )
      );
    }

    function renderResultsTab() {
      var latestResult = searchHistory.length > 0 ? searchHistory[0] : null;
      
      if (!latestResult) {
        return createElement('div', { style: { textAlign: 'center', padding: '60px 20px', color: C.textLight } }, 
          createElement('div', { style: { marginBottom: '16px', fontSize: '48px' } }, '🔍'),
          createElement('div', { style: { fontSize: '16px', marginBottom: '8px' } }, '输入关键词并点击"生成链接"'),
          createElement('div', { style: { fontSize: '13px', color: C.textLight } }, '配合「爬虫实验室」使用效果更佳！')
        );
      }

      var selectedEngineList = latestResult.results;
      
      return createElement('div', { style: { padding: '16px', overflow: 'auto', flex: 1 } },
        renderBrowserPanel(),
        createElement('div', { style: { marginTop: '16px', marginBottom: '16px', fontWeight: 'bold', fontSize: '14px', color: C.textDark } },
          '搜索关键词：', createElement('span', { style: { color: C.primary } }, escapeHtml(latestResult.query))
        ),
        createElement('div', { style: { display: 'grid', gap: '12px' } },
          selectedEngineList.map(function(result, index) {
            var engine = SEARCH_ENGINES.find(function(e) { return e.id === result.engineId; });
            var isOpen = openTabs[result.engineId];
            
            return createElement('div', { 
              key: result.engineId, 
              style: { 
                padding: '16px', 
                border: '1px solid ' + C.border, 
                borderRadius: '8px', 
                background: C.cardBg,
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              } 
            },
              createElement('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' } },
                createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px' } },
                  createElement('span', { style: { fontSize: '24px' } }, engine ? engine.icon : result.engineIcon),
                  createElement('span', { style: { fontWeight: 'bold', fontSize: '15px', color: C.textDark } }, result.engineName)
                ),
                createElement('div', { style: { display: 'flex', gap: '8px' } },
                  createElement('button', {
                    onClick: function() { toggleOpenTab(result.engineId); },
                    style: { 
                      padding: '6px 12px', 
                      background: isOpen ? '#e0e7ff' : '#f3f4f6', 
                      color: C.textDark, 
                      border: '1px solid ' + C.border, 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontSize: '12px', 
                      fontWeight: 'bold'
                    }
                  }, isOpen ? '▼ 收起' : '▶ 展开')
                )
              ),
              isOpen && createElement('div', null,
                createElement('div', { style: { wordBreak: 'break-all', fontSize: '12px', color: C.textLight, marginBottom: '12px', background: '#f8fafc', padding: '10px 12px', borderRadius: '6px', border: '1px solid ' + C.border } },
                  escapeHtml(result.searchUrl)
                ),
                createElement('div', { style: { display: 'flex', gap: '10px', flexWrap: 'wrap' } },
                  createElement('button', {
                    onClick: function() { openSearchUrl(result.searchUrl, engine); },
                    style: { 
                      padding: '8px 16px', 
                      background: 'linear-gradient(135deg, ' + C.primary + ', ' + C.primaryDark + ')', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: 'bold'
                    }
                  }, '🔗 新标签页打开'),
                  createElement('button', {
                    onClick: function() { openInCurrentTab(result.searchUrl, engine); },
                    style: { 
                      padding: '8px 16px', 
                      background: '#f59e0b', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: 'bold'
                    }
                  }, ' 当前页打开'),
                  createElement('button', {
                    onClick: function() { 
                      navigator.clipboard.writeText(result.searchUrl).then(function() {
                        alert('链接已复制到剪贴板！');
                      }).catch(function() {
                        var textarea = document.createElement('textarea');
                        textarea.value = result.searchUrl;
                        document.body.appendChild(textarea);
                        textarea.select();
                        try {
                          document.execCommand('copy');
                          alert('链接已复制到剪贴板！');
                        } catch (e) {
                          alert('复制失败，请手动复制');
                        }
                        document.body.removeChild(textarea);
                      });
                    },
                    style: { 
                      padding: '8px 16px', 
                      background: '#10b981', 
                      color: '#fff', 
                      border: 'none', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontSize: '13px', 
                      fontWeight: 'bold'
                    }
                  }, '📋 复制链接')
                )
              )
            );
          })
        )
      );
    }

    function renderHistoryTab() {
      return createElement('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        createElement('div', { style: { padding: '10px 16px', borderBottom: '1px solid ' + C.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          createElement('span', { style: { fontWeight: 'bold', color: C.textDark } }, '历史记录 (' + searchHistory.length + ')'),
          createElement('button', {
            onClick: clearHistory,
            style: { padding: '6px 12px', background: '#fef2f2', color: C.danger, border: '1px solid #fecaca', borderRadius: '4px', cursor: 'pointer', fontSize: '12px', fontWeight: 'bold' }
          }, '🗑️ 清空历史')
        ),
        createElement('div', { style: { overflow: 'auto', flex: 1, padding: '8px' } },
          !searchHistory.length ? createElement('div', { style: { textAlign: 'center', padding: '30px 12px', color: C.textLight, fontSize: '13px' } }, '暂无搜索历史') :
          searchHistory.map(function(entry, index) {
            return createElement('div', { 
              key: entry.id, 
              style: { 
                marginBottom: '8px',
                padding: '12px',
                border: '1px solid ' + C.border,
                borderRadius: '6px',
                background: '#fff',
                cursor: 'pointer'
              },
              onClick: function() { loadHistoryEntry(entry); }
            },
              createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                createElement('div', { style: { fontWeight: 'bold', fontSize: '14px', color: C.textDark } }, '🔍 ' + escapeHtml(entry.query)),
                createElement('div', { style: { fontSize: '11px', color: C.textLight } }, new Date(entry.timestamp).toLocaleString('zh-CN'))
              ),
              createElement('div', { style: { fontSize: '12px', color: C.textLight, marginTop: '6px' } },
                entry.results.length + ' 个搜索引擎'
              )
            );
          })
        )
      );
    }

    function renderTabBar() {
      var tabs = [
        { id: 'results', label: '📋 搜索链接' },
        { id: 'history', label: ' 搜索历史' }
      ];

      return createElement('div', { style: { display: 'flex', borderBottom: '2px solid ' + C.border, background: C.cardBg, flexShrink: 0 } },
        tabs.map(function(tab) {
          var isActive = activeTab === tab.id;
          return createElement('button', {
            key: tab.id,
            onClick: function() { setActiveTab(tab.id); },
            style: { 
              padding: '10px 20px', 
              border: 'none', 
              borderBottom: isActive ? '3px solid ' + C.primary : '3px solid transparent', 
              background: isActive ? '#fff' : 'transparent', 
              color: isActive ? C.primary : C.textLight, 
              cursor: 'pointer', 
              fontSize: '13px', 
              fontWeight: isActive ? 'bold' : 'normal'
            }
          }, tab.label);
        })
      );
    }

    return createElement(window.FloatingWindowReact, {
      isOpen: true,
      width: '900px',
      height: Math.floor(window.innerHeight * 0.85) + 'px',
      onClose: function() { 
        var container = document.getElementById('globalSearchApiLab_window'); 
        if (container) { 
          ReactDOM.unmountComponentAtNode(container); 
          if (container.parentNode) container.parentNode.removeChild(container); 
        } 
      },
      title: '🔍 全网搜索 API 调用实验室',
      sourceFile: 'globalSearchApiLabPlugin.js'
    },
      createElement('div', { style: { height: '100%', display: 'flex', flexDirection: 'column', background: C.bg, fontFamily: '-apple-system, sans-serif' } },
        renderEnginesSelection(),
        renderSearchInput(),
        renderTabBar(),
        createElement('div', { style: { flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' } },
          activeTab === 'results' ? renderResultsTab() : renderHistoryTab()
        )
      )
    );
  }

  function init() {
    var btn = document.getElementById('globalSearchApiLabBtn');
    if (!btn) {
      setTimeout(init, 1000);
      return;
    }
    btn.addEventListener('click', function() {
      try {
        if (!window.FloatingWindowReact) {
          alert('FloatingWindowReact 未加载');
          return;
        }
        var oldContainer = document.getElementById('globalSearchApiLab_window');
        if (oldContainer) {
          ReactDOM.unmountComponentAtNode(oldContainer);
          if (oldContainer.parentNode) oldContainer.parentNode.removeChild(oldContainer);
        }
        var container = document.createElement('div');
        container.id = 'globalSearchApiLab_window';
        document.body.appendChild(container);
        ReactDOM.render(createElement(GlobalSearchApiLabApp), container);
      } catch (err) {
        alert('打开失败：' + err.message);
        console.error(err);
      }
    });
    console.log('[GlobalSearchApiLab] ✅ 已初始化');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  console.log('[GlobalSearchApiLab] ✅ 全网搜索 API 调用实验室 v4.0 已加载');
})();
