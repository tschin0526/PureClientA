/**
 * AI 截图解析插件 - 完整版 v8.6 (2026-05-12)
 * 
 * 核心功能：直接使用 TableGridExtractor（已验证正确）
 * UI样式：恢复专业的深色主题（如截图二）
 * 优化：重新设计 Prompt 编辑区域布局
 */
(function() {
  'use strict';

  console.log('[AI-Parser] 正在加载 v8.6 (专业版 UI + TableGridExtractor + 优化Prompt布局)');

  // =========================================================
  // 工具函数
  // =========================================================

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // =========================================================
  // React 组件
  // =========================================================

  var React = window.React;
  var ReactDOM = window.ReactDOM;
  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var useRef = React.useRef;

  // =========================================================
  // 主应用组件
  // =========================================================

  function AIScreenshotParserApp() {
    var [images, setImages] = useState([]);
    var [selectedModel, setSelectedModel] = useState('qwen');
    var [qwenApiKey, setQwenApiKey] = useState('');
    var [zhipuApiKey, setZhipuApiKey] = useState('');
    var [prompt, setPrompt] = useState('');
    var [availablePrompts, setAvailablePrompts] = useState([]);
    var [status, setStatus] = useState(null);
    var [isParsing, setIsParsing] = useState(false);
    var [parseProgress, setParseProgress] = useState(null);
    var [parseCompleteInfo, setParseCompleteInfo] = useState(null);
    var [results, setResults] = useState([]);
    var [selectedResultIndex, setSelectedResultIndex] = useState(0);
    var [activeTab, setActiveTab] = useState('images');
    var [showSettingsMenu, setShowSettingsMenu] = useState(false);
    var [isCompleteInfoCollapsed, setIsCompleteInfoCollapsed] = useState(false);
    var [showJsonView, setShowJsonView] = useState(false);
    var [resultSubTab, setResultSubTab] = useState('table');

    // 新增：模型版本选择状态
    var [zhipuModelVersion, setZhipuModelVersion] = useState('glm-4.6v-flash');
    var [qwenModelVersion, setQwenModelVersion] = useState('qwen-vl-max-latest');
    var [showModelSelector, setShowModelSelector] = useState(false);

    // 新增：当前激活的 API Key 名称
    var [activeKeyName, setActiveKeyName] = useState('');

    var fileInputRef = useRef(null);
    var extractorRef = useRef(null);

    // 初始化 TableGridExtractor
    useEffect(function() {
      if (typeof TableGridExtractor !== 'undefined') {
        extractorRef.current = new TableGridExtractor();
        console.log('[AI-Parser] TableGridExtractor 已初始化');
      }
    }, []);

    // 加载设置
  useEffect(function() {
    try {
      var qk = localStorage.getItem('ai_parser_qwen_key') || '';
      var zk = localStorage.getItem('ai_parser_zhipu_key') || '';
      var sm = localStorage.getItem('ai_parser_model') || 'qwen';
      setQwenApiKey(qk);
      setZhipuApiKey(zk);
      setSelectedModel(sm);

      // 加载保存的模型版本
      var savedModels = localStorage.getItem('ai_parser_models');
      if (savedModels) {
        try {
          var models = JSON.parse(savedModels);
          if (models.zhipu) setZhipuModelVersion(models.zhipu);
          if (models.tongyi) setQwenModelVersion(models.tongyi);
        } catch(e) {
          console.error('[AI-Parser] 加载模型版本失败:', e);
        }
      }

      // 加载当前激活的 API Key 名称
      var provider = sm === 'qwen' ? 'tongyi' : 'zhipu';
      var keyName = localStorage.getItem('ai_parser_active_key_name_' + provider) || '';

      // 如果没有保存的名称，尝试从完整设置中获取默认名称
      if (!keyName) {
        try {
          var settingsStr = localStorage.getItem('ai_ocr_settings');
          if (settingsStr) {
            var settings = JSON.parse(settingsStr);
            var keys = settings.apiKeys?.[provider] || [];
            var activeIndex = settings.activeKeyIndex?.[provider] || 0;
            if (keys[activeIndex]) {
              keyName = keys[activeIndex].name || ('Key #' + (activeIndex + 1));
            }
          }
        } catch(e) {
          console.warn('[AI-Parser] 读取 Key 名称失败:', e);
        }

        // 如果还是没有，使用默认值
        if (!keyName) {
          keyName = 'Key #1';
        }
      }

      setActiveKeyName(keyName);

      // 从 ai_ocr_prompts 读取所有 prompts
      var promptsStr = localStorage.getItem('ai_ocr_prompts');
      if (promptsStr) {
        var allPrompts = JSON.parse(promptsStr);
        setAvailablePrompts(allPrompts);
        // 找到默认的 prompt
        var defaultPrompt = allPrompts.find(function(p) { return p.isDefault; });
        if (defaultPrompt && defaultPrompt.content) {
          setPrompt(defaultPrompt.content);
        }
      } else {
        // 如果没有，尝试从旧格式读取
        var pr = localStorage.getItem('ai_parser_prompt') || '';
        setPrompt(pr);
      }
    } catch(e) {
      console.error('[AI-Parser] 加载设置失败:', e);
    }
  }, []);

    // 监听 localStorage 变化（当用户在 AI API Key 设定中切换模型时自动刷新）
  useEffect(function() {
    function handleStorageChange(event) {
      if (event.key === 'ai_parser_model' && event.newValue) {
        setSelectedModel(event.newValue);
        console.log('[AI-Parser] 检测到模型切换:', event.newValue);

        // 切换模型时，更新对应的 Key 名称
        var newProvider = event.newValue === 'qwen' ? 'tongyi' : 'zhipu';
        var newName = localStorage.getItem('ai_parser_active_key_name_' + newProvider) || '';
        setActiveKeyName(newName);
      }
      if (event.key === 'ai_ocr_prompts' && event.newValue) {
        try {
          var allPrompts = JSON.parse(event.newValue);
          setAvailablePrompts(allPrompts);
          var defaultPrompt = allPrompts.find(function(p) { return p.isDefault; });
          if (defaultPrompt && defaultPrompt.content) {
            setPrompt(defaultPrompt.content);
          }
        } catch(e) {}
      }
      if (event.key === 'ai_parser_prompt' && event.newValue) {
        setPrompt(event.newValue);
      }
      if (event.key === 'ai_parser_qwen_key' && event.newValue) {
        setQwenApiKey(event.newValue);
      }
      if (event.key === 'ai_parser_zhipu_key' && event.newValue) {
        setZhipuApiKey(event.newValue);
      }
      // 新增：监听模型版本变化
      if (event.key === 'ai_parser_models' && event.newValue) {
        try {
          var models = JSON.parse(event.newValue);
          if (models.zhipu) setZhipuModelVersion(models.zhipu);
          if (models.tongyi) setQwenModelVersion(models.tongyi);
          console.log('[AI-Parser] 检测到模型版本变化:', models);
        } catch(e) {}
      }
      // 新增：监听 API Key 名称变化
      if (event.key === 'ai_parser_active_key_name_tongyi' && selectedModel === 'qwen') {
        setActiveKeyName(event.newValue || '');
      }
      if (event.key === 'ai_parser_active_key_name_zhipu' && selectedModel === 'zhipu') {
        setActiveKeyName(event.newValue || '');
      }
    }

    window.addEventListener('storage', handleStorageChange);
    return function() { window.removeEventListener('storage', handleStorageChange); };
  }, []);

    // 选择图片
    var handleFileSelect = useCallback(function(e) {
      var files = e.target.files;
      if (!files || files.length === 0) return;

      var newImages = [];
      var toLoad = files.length;

      for (var i = 0; i < files.length; i++) {
        (function(file) {
          var reader = new FileReader();
          reader.onload = function(ev) {
            newImages.push({ id: Date.now() + Math.random(), file: file, data: ev.target.result, name: file.name });
            toLoad--;
            if (toLoad === 0) {
              setImages(function(prev) { return prev.concat(newImages); });
            }
          };
          reader.readAsDataURL(file);
        })(files[i]);
      }

      e.target.value = '';
    }, []);

    // 删除图片
    var handleRemoveImage = useCallback(function(id) {
      setImages(function(prev) { return prev.filter(function(img) { return img.id !== id; }); });
    }, []);

    // 解析图片（使用 TableGridExtractor）
    var handleParseWithAI = useCallback(async function() {
      if (images.length === 0) {
        setStatus({ message: '❌ 请先选择图片', isOk: false });
        return;
      }

      if (!extractorRef.current) {
        if (typeof TableGridExtractor !== 'undefined') {
          extractorRef.current = new TableGridExtractor();
        } else {
          setStatus({ message: '❌ TableGridExtractor 未找到', isOk: false });
          return;
        }
      }

      var extractor = extractorRef.current;
      var apiKey = selectedModel === 'qwen' ? qwenApiKey : zhipuApiKey;
      if (!apiKey.trim()) {
        setStatus({ message: '❌ 请输入 ' + (selectedModel === 'qwen' ? '通义千问' : '智谱 GLM') + ' 的 API Key', isOk: false });
        return;
      }

      setIsParsing(true);
      setParseCompleteInfo(null);
      var startTime = Date.now();
      var newResults = [];
      var successCount = 0;
      var failCount = 0;

      // 使用编辑过的 prompt
      var currentPrompt = prompt;

      extractor.setApiKey(apiKey, selectedModel);

      for (var i = 0; i < images.length; i++) {
        var img = images[i];
        setParseProgress({ current: i + 1, total: images.length, imageName: img.name, step: 'calling' });
        setStatus({ message: '🤖 正在解析 (' + (i + 1) + '/' + images.length + ') ' + img.name + '...', isOk: true });

        try {
          // 获取当前选择的模型版本
          var currentModelVersion = selectedModel === 'zhipu' ? zhipuModelVersion : qwenModelVersion;
          
          console.log('[AI-Parser] 🎯 准备调用AI - 厂商:', selectedModel, ', 模型版本:', currentModelVersion);

          var result = await extractor.extract(img.data, {
            customPrompt: currentPrompt,
            modelName: currentModelVersion,  // 传入模型版本
            onProgress: function(p) {
              setParseProgress({ current: i + 1, total: images.length, imageName: img.name, step: p.step || 'processing' });
              if (p.message) setStatus({ message: p.message, isOk: true });
            }
          });

          newResults.push({
            id: img.id,
            imageName: img.name,
            model: selectedModel,
            modelName: selectedModel === 'qwen' ? '通义千问 ' + currentModelVersion : '智谱GLM ' + currentModelVersion,
            keyName: activeKeyName || 'Key #1',
            prompt: currentPrompt,
            result: result,
            timestamp: new Date().toLocaleString('zh-CN'),
            success: true
          });
          successCount++;
        } catch(err) {
          console.error('[AI-Parser] 解析失败:', err.message);
          newResults.push({
            id: img.id,
            imageName: img.name,
            model: selectedModel,
            modelName: selectedModel === 'qwen' ? '通义千问' : '智谱 GLM',
            keyName: activeKeyName || 'Key #1',
            prompt: currentPrompt,
            error: err.message,
            timestamp: new Date().toLocaleString('zh-CN'),
            success: false
          });
          failCount++;
        }
      }

      var durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      var currentModelVersionForDisplay = selectedModel === 'zhipu' ? zhipuModelVersion : qwenModelVersion;
      setParseCompleteInfo({
        totalImages: images.length,
        successCount: successCount,
        failCount: failCount,
        durationSec: durationSec,
        modelName: (selectedModel === 'qwen' ? '通义千问 ' : '智谱GLM ') + currentModelVersionForDisplay,
        keyName: activeKeyName || ('Key #1'),
        timestamp: new Date().toLocaleString('zh-CN'),
        hasPrompt: !!currentPrompt.trim()
      });
      setResults(function(prev) { return newResults.concat(prev); });
      setStatus({
        message: '✅ 完成！成功 ' + successCount + '/' + images.length + ' (' + durationSec + '秒) [🔑 ' + (activeKeyName || 'Key #1') + ']',
        isOk: successCount > 0
      });

      setTimeout(function() { setIsParsing(false); setParseProgress(null); }, 500);
      setActiveTab('results');
      if (newResults.length > 0) setSelectedResultIndex(0);
    }, [images, selectedModel, qwenApiKey, zhipuApiKey, prompt, zhipuModelVersion, qwenModelVersion]);

    // 清空所有
    var handleClearAll = useCallback(function() {
      setImages([]);
      setResults([]);
      setParseCompleteInfo(null);
      setStatus(null);
    }, []);

    // =========================================================
    // 渲染函数 - 专业深色主题UI
    // =========================================================

    // 从 localStorage 重新加载 prompt
    var reloadPrompt = useCallback(function() {
      try {
        var promptsStr = localStorage.getItem('ai_ocr_prompts');
        if (promptsStr) {
          var allPrompts = JSON.parse(promptsStr);
          setAvailablePrompts(allPrompts);
          var defaultPrompt = allPrompts.find(function(p) { return p.isDefault; });
          if (defaultPrompt && defaultPrompt.content) {
            setPrompt(defaultPrompt.content);
          }
        }
      } catch(e) {}
    }, []);

    // 选择一个 prompt
    var handleSelectPrompt = useCallback(function(promptId) {
      var selected = availablePrompts.find(function(p) { return p.id === promptId; });
      if (selected && selected.content) {
        setPrompt(selected.content);
      }
    }, [availablePrompts]);

    function renderImagesTab() {
      return React.createElement('div', null,
        React.createElement('div', { style: { marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '10px' } },
          React.createElement('input', {
            ref: fileInputRef,
            type: 'file',
            multiple: true,
            accept: 'image/*',
            onChange: handleFileSelect,
            style: { display: 'none' }
          }),
          React.createElement('button', {
            onClick: function() { fileInputRef.current && fileInputRef.current.click(); },
            style: {
              padding: '10px 20px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer'
            }
          }, '📷 选择图片'),
          images.length > 0 && !isParsing && React.createElement('button', {
            onClick: handleParseWithAI,
            style: {
              marginLeft: '10px',
              padding: '10px 24px',
              background: '#6366f1',
              border: 'none',
              borderRadius: '8px',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer'
            }
          }, '🚀 开始解析')
        ),
        parseProgress && React.createElement('div', {
          style: {
            padding: '20px',
            background: '#ede9fe',
            border: '2px solid #c4b5fd',
            borderRadius: '12px',
            marginBottom: '16px',
            position: 'relative',
            overflow: 'hidden'
          }
        },
          // 背景动画效果
          React.createElement('div', {
            style: {
              position: 'absolute',
              top: 0,
              left: '-100%',
              width: '100%',
              height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)',
              animation: 'shimmer 2s infinite'
            }
          }),
          // 主要内容
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              position: 'relative',
              zIndex: 1
            }
          },
            // 旋转的 AI 图标
            React.createElement('div', {
              style: {
                width: '48px',
                height: '48px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '24px',
                animation: 'spin 1s linear infinite',
                boxShadow: '0 4px 12px rgba(99,102,241,0.5)'
              }
            }, '🤖'),
            // 文字信息
            React.createElement('div', {
              style: {
                flex: 1
              }
            },
              React.createElement('div', {
                style: {
                  fontSize: '15px',
                  fontWeight: 700,
                  color: '#4c1d95',
                  marginBottom: '4px',
                  animation: 'pulse 2s ease-in-out infinite'
                }
              }, '正在处理 ', parseProgress.current, '/', parseProgress.total),
              React.createElement('div', {
                style: {
                  fontSize: '13px',
                  color: '#7c3aed',
                  fontFamily: 'monospace'
                }
              }, parseProgress.imageName)
            )
          ),
          // 进度条
          React.createElement('div', {
            style: {
              marginTop: '12px',
              height: '6px',
              background: 'rgba(0,0,0,0.3)',
              borderRadius: '3px',
              overflow: 'hidden',
              position: 'relative'
            }
          },
            React.createElement('div', {
              style: {
                height: '100%',
                width: (parseProgress.current / parseProgress.total * 100) + '%',
                background: 'linear-gradient(90deg, #6366f1, #8b5cf6, #a78bfa)',
                borderRadius: '3px',
                transition: 'width 0.3s ease',
                animation: 'progressShimmer 1.5s ease-in-out infinite',
                boxShadow: '0 0 10px rgba(99,102,241,0.5)'
              }
            })
          )
        ),
        // 添加 CSS 动画样式
        React.createElement('style', null, `
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.7; }
          }
          @keyframes shimmer {
            0% { left: -100%; }
            100% { left: 100%; }
          }
          @keyframes progressShimmer {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.8; }
          }
        `),
        images.length > 0 && React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px'
          }
        },
          // 左边：图片
          React.createElement('div', null,
            React.createElement('h4', { style: { margin: '0 0 12px 0', fontSize: '14px', color: '#c7d2fe', fontWeight: 600 } }, '🖼 已选择的图片'),
            React.createElement('div', {
              style: {
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                gap: '12px'
              }
            },
              images.map(function(img) {
                return React.createElement('div', {
                  key: img.id,
                  style: {
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '8px',
                    overflow: 'hidden',
                    position: 'relative'
                  }
                },
                  React.createElement('img', {
                    src: img.data,
                    style: { width: '100%', height: '110px', objectFit: 'cover' }
                  }),
                  React.createElement('div', {
                    style: {
                      padding: '8px',
                      fontSize: '11px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: '#c7d2fe'
                    }
                  }, img.name),
                  React.createElement('button', {
                    onClick: function() { handleRemoveImage(img.id); },
                    style: {
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '22px',
                      height: '22px',
                      borderRadius: '50%',
                      background: 'rgba(239,68,68,0.9)',
                      border: 'none',
                      color: 'white',
                      cursor: 'pointer',
                      fontSize: '14px',
                      lineHeight: '22px',
                      textAlign: 'center'
                    }
                  }, '×')
                );
              })
            )
          ),
          // 右边：Prompt 编辑区（集中所有 Prompt 控件）
          React.createElement('div', null,
            React.createElement('div', {
              style: {
                background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(79,70,229,0.05))',
                border: '1px solid rgba(99,102,241,0.25)',
                borderRadius: '12px',
                padding: '16px'
              }
            },
              // Prompt 模板选择器
              availablePrompts.length > 0 && React.createElement('div', {
                style: {
                  marginBottom: '12px'
                }
              },
                React.createElement('select', {
                  onChange: function(e) { if (e.target.value) handleSelectPrompt(e.target.value); },
                  style: {
                    width: '100%',
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: '8px',
                    color: '#e0e7ff',
                    fontSize: '13px',
                    cursor: 'pointer',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }
                },
                  React.createElement('option', { value: '' }, '📋 选择 Prompt 模板...'),
                  availablePrompts.map(function(p) {
                    return React.createElement('option', { key: p.id, value: p.id },
                      (p.isDefault ? '✓ ' : '') + p.name
                    );
                  })
                )
              ),

              // Prompt 编辑框
              React.createElement('div', null,
                React.createElement('textarea', {
                  value: prompt,
                  onChange: function(e) { setPrompt(e.target.value); },
                  placeholder: '请输入或编辑 Prompt...',
                  style: {
                    width: '100%',
                    minHeight: '320px',
                    padding: '14px',
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(99,102,241,0.35)',
                    borderRadius: '8px',
                    color: '#e0e7ff',
                    fontSize: '13px',
                    lineHeight: '1.7',
                    fontFamily: '"SF Mono", Monaco, Consolas, monospace',
                    resize: 'vertical',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'all 0.2s ease'
                  }
                }),
                
                // 字符统计
                React.createElement('div', {
                  style: {
                    marginTop: '8px',
                    textAlign: 'right',
                    fontSize: '11px',
                    color: 'rgba(199,210,254,0.5)'
                  }
                }, prompt.length, ' 字符')
              )
            )
          )
        ),
        images.length === 0 && React.createElement('div', {
          style: {
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(199,210,254,0.5)',
            fontSize: '14px'
          }
        }, '请选择图片开始解析')
      );
    }

    function renderTableResult(result) {
      if (!result || !result.cells || !result.cells.length) {
        return React.createElement('div', { style: { color: '#fca5a5', fontSize: '13px' } }, '无有效表格数据');
      }

      var rows = result.cells.length;
      var cols = Math.max.apply(null, result.cells.map(function(r) { return r.length; }));

      return React.createElement('div', {},
        React.createElement('div', { style: { fontSize: '13px', color: '#86efac', marginBottom: '10px', fontWeight: 600 } },
          '📋 表格尺寸：', rows, '行 × ', cols, '列'
        ),
        React.createElement('div', {
          style: {
            overflowX: 'auto',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: '8px',
            background: 'rgba(0,0,0,0.2)'
          }
        },
          React.createElement('table', {
            style: {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              background: 'transparent'
            }
          },
            React.createElement('tbody', null,
              result.cells.map(function(row, rowIndex) {
                return React.createElement('tr', { key: rowIndex },
                  row.map(function(cell, colIndex) {
                    var isHeader = rowIndex === 0;
                    return React.createElement('td', {
                      key: colIndex,
                      style: {
                        padding: '10px 14px',
                        border: '1px solid rgba(99,102,241,0.15)',
                        background: isHeader
                          ? 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(79,70,229,0.15))'
                          : (rowIndex % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'),
                        color: isHeader ? '#a5b4fc' : '#e0e7ff',
                        fontWeight: isHeader ? 700 : 400,
                        textAlign: colIndex === 0 ? 'left' : 'right',
                        minWidth: '90px',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '200px'
                      }
                    }, String(cell));
                  })
                );
              })
            )
          )
        )
      );
    }

    function renderJsonResult(result) {
      var jsonString = JSON.stringify(result, null, 2);
      return React.createElement('div', {},
        React.createElement('div', { style: { fontSize: '13px', color: '#86efac', marginBottom: '10px', fontWeight: 600 } }, '{} JSON 数据'),
        React.createElement('div', { style: { position: 'relative' } },
          React.createElement('pre', {
            style: {
              background: 'rgba(0,0,0,0.5)',
              padding: '16px',
              borderRadius: '8px',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#a5b4fc',
              fontSize: '11px',
              lineHeight: '1.6',
              overflow: 'auto',
              maxHeight: '400px',
              margin: 0,
              fontFamily: '"SF Mono", Monaco, Consolas, monospace'
            }
          }, jsonString),
          React.createElement('button', {
            onClick: function() {
              navigator.clipboard.writeText(jsonString).then(function() {
                alert('✅ JSON 已复制到剪贴板');
              }).catch(function() {
                alert('❌ 复制失败，请手动选择复制');
              });
            },
            style: {
              position: 'absolute',
              top: '8px',
              right: '8px',
              padding: '6px 14px',
              background: 'rgba(99,102,241,0.4)',
              border: '1px solid rgba(99,102,241,0.6)',
              borderRadius: '6px',
              color: '#c7d2fe',
              fontSize: '11px',
              cursor: 'pointer',
              fontWeight: 600
            }
          }, '📋 复制')
        )
      );
    }

    function renderRawTab() {
      if (results.length === 0) {
        return React.createElement('div', {
          style: {
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(199,210,254,0.5)',
            fontSize: '14px'
          }
        }, '暂无解析结果，请先上传并解析图片');
      }

      var selectedResult = results[selectedResultIndex];
      var result = selectedResult.result;
      
      // 调试输出
      console.log('[renderRawTab] result:', result);
      console.log('[renderRawTable] _rawResponse:', result ? result._rawResponse : 'undefined');
      console.log('[renderRawTab] _fullApiResponse:', result ? result._fullApiResponse : 'undefined');
      console.log('[renderRawTab] _model:', result ? result._model : 'undefined');
      
      var hasRaw = !!(result && result._rawResponse);
      var hasFullApi = !!(result && result._fullApiResponse);
      var rawText = (result && result._rawResponse) || '';
      var fullApi = (result && result._fullApiResponse) ? JSON.stringify(result._fullApiResponse, null, 2) : '';
      var promptText = (result && result._prompt) || '';
      var modelName = (result && result._model) || (selectedResult.modelName || '未知');

      return React.createElement('div', null,
        // 结果选择器 + 模型信息
        React.createElement('div', {
          style: {
            marginBottom: '16px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }
        },
          results.map(function(r, idx) {
            return React.createElement('button', {
              key: r.id,
              onClick: function() { setSelectedResultIndex(idx); },
              style: {
                padding: '8px 16px',
                background: idx === selectedResultIndex
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(79,70,229,0.3))'
                  : 'rgba(255,255,255,0.05)',
                border: idx === selectedResultIndex
                  ? '1px solid rgba(99,102,241,0.6)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: idx === selectedResultIndex ? '#c7d2fe' : 'rgba(199,210,254,0.7)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }
            },
              r.success ? '✅ ' : '❌ ',
              r.imageName.substring(0, 18),
              r.imageName.length > 18 ? '...' : ''
            );
          }),
          
          // 模型信息标签
          React.createElement('span', {
            style: {
              padding: '6px 12px',
              background: 'rgba(139, 92, 246, 0.2)',
              border: '1px solid rgba(139, 92, 246, 0.4)',
              borderRadius: '6px',
              color: '#c4b5fd',
              fontSize: '12px',
              fontWeight: 600,
              marginLeft: 'auto'
            }
          }, '🤖 ', modelName)
        ),
        
        selectedResult && React.createElement('div', null,
          // 状态提示
          (!hasRaw && !hasFullApi) && React.createElement('div', {
            style: {
              background: 'rgba(245, 158, 11, 0.15)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              borderRadius: '8px',
              padding: '12px 16px',
              marginBottom: '16px',
              color: '#fbbf24',
              fontSize: '13px'
            }
          },
            '⚠️ 此结果没有保存原始响应数据。',
            React.createElement('br'),
            '可能原因：使用了 Tesseract OCR 备用方案，或结果是在功能更新前保存的。'
          ),
          
          React.createElement('div', {
            style: {
              display: 'flex',
              gap: '8px',
              marginBottom: '16px',
              borderBottom: '2px solid rgba(99,102,241,0.2)',
              paddingBottom: '8px'
            }
          },
            ['response', 'prompt', 'full'].map(function(tab) {
              var labels = {
                response: '🤖 AI响应的内容(Content)',
                prompt: '📝 使用的 Prompt',
                full: '📦 完整 API 响应'
              };
              return React.createElement('button', {
                key: tab,
                onClick: function() { setResultSubTab(tab); },
                style: {
                  padding: '8px 16px',
                  background: resultSubTab === tab
                    ? 'linear-gradient(180deg, rgba(99,102,241,0.35), rgba(79,70,229,0.2))'
                    : 'rgba(255,255,255,0.05)',
                  border: resultSubTab === tab
                    ? '2px solid #6366f1'
                    : '2px solid transparent',
                  borderRadius: '8px',
                  color: resultSubTab === tab ? '#fff' : 'rgba(199,210,254,0.7)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600
                }
              }, labels[tab]);
            })
          ),

          resultSubTab === 'response' && React.createElement('div', {
            style: {
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '8px',
              padding: '16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: hasRaw ? '#e0e7ff' : '#fbbf24',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              maxHeight: '500px',
              overflow: 'auto'
            }
          }, rawText || '⚠️ 没有保存 AI 响应内容'),

          resultSubTab === 'prompt' && React.createElement('div', {
            style: {
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(99,102,241,0.3)',
              borderRadius: '8px',
              padding: '16px',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              color: promptText ? '#e0e7ff' : '#fbbf24',
              fontFamily: 'monospace',
              fontSize: '13px',
              lineHeight: '1.6',
              maxHeight: '500px',
              overflow: 'auto'
            }
          }, promptText || '⚠️ 没有保存 Prompt'),

          resultSubTab === 'full' && React.createElement('div', { style: { position: 'relative' } },
            React.createElement('pre', {
              style: {
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(99,102,241,0.3)',
                borderRadius: '8px',
                padding: '16px',
                color: hasFullApi ? '#a5b4fc' : '#fbbf24',
                fontSize: '11px',
                lineHeight: '1.6',
                overflow: 'auto',
                maxHeight: '500px',
                margin: 0,
                fontFamily: '"SF Mono", Monaco, Consolas, monospace'
              }
            }, fullApi || '⚠️ 没有保存完整 API 响应'),
            fullApi && React.createElement('button', {
              onClick: function() {
                navigator.clipboard.writeText(fullApi).then(function() {
                  alert('✅ 完整 API 响应已复制到剪贴板');
                }).catch(function() {
                  alert('❌ 复制失败，请手动选择复制');
                });
              },
              style: {
                position: 'absolute',
                top: '8px',
                right: '8px',
                padding: '6px 14px',
                background: 'rgba(99,102,241,0.4)',
                border: '1px solid rgba(99,102,241,0.6)',
                borderRadius: '6px',
                color: '#c7d2fe',
                fontSize: '11px',
                cursor: 'pointer',
                fontWeight: 600
              }
            }, '📋 复制')
          )
        )
      );
    }

    function renderResultsTab() {
      if (results.length === 0) {
        return React.createElement('div', {
          style: {
            textAlign: 'center',
            padding: '60px 20px',
            color: 'rgba(199,210,254,0.5)',
            fontSize: '14px'
          }
        }, '暂无解析结果');
      }

      var selectedResult = results[selectedResultIndex];

      return React.createElement('div', null,
        React.createElement('div', {
          style: {
            marginBottom: '16px',
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }
        },
          results.map(function(r, idx) {
            return React.createElement('button', {
              key: r.id,
              onClick: function() { setSelectedResultIndex(idx); },
              style: {
                padding: '8px 16px',
                background: idx === selectedResultIndex
                  ? 'linear-gradient(135deg, rgba(99,102,241,0.4), rgba(79,70,229,0.3))'
                  : 'rgba(255,255,255,0.05)',
                border: idx === selectedResultIndex
                  ? '1px solid rgba(99,102,241,0.6)'
                  : '1px solid rgba(255,255,255,0.1)',
                borderRadius: '8px',
                color: idx === selectedResultIndex ? '#c7d2fe' : 'rgba(199,210,254,0.7)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 500
              }
            },
              r.success ? '✅ ' : '❌ ',
              r.imageName.substring(0, 18),
              r.imageName.length > 18 ? '...' : ''
            );
          })
        ),

        selectedResult && React.createElement('div', null,
          React.createElement('details', { open: true, style: { marginBottom: '16px' } },
            React.createElement('summary', {
              style: {
                cursor: 'pointer',
                padding: '12px 16px',
                background: selectedResult.success
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(220,38,38,0.1))',
                border: '1px solid ' + (selectedResult.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'),
                borderRadius: '8px',
                color: selectedResult.success ? '#86efac' : '#fca5a5',
                fontWeight: 600,
                fontSize: '14px',
                listStyle: 'none',
                outline: 'none'
              }
            },
              selectedResult.success ? '✅ ' : '❌ ',
              selectedResult.imageName
            ),
            React.createElement('div', {
              style: {
                marginTop: '8px',
                padding: '12px 16px',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '8px',
                fontSize: '12px',
                color: 'rgba(199,210,254,0.7)'
              }
            },
              selectedResult.modelName,
              React.createElement('span', {
                style: {
                  background: 'rgba(59, 130, 246, 0.2)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  color: '#93c5fd',
                  fontWeight: 500,
                  marginLeft: '8px'
                }
              }, '🔑 ', selectedResult.keyName || '未命名'),
              React.createElement('br'),
              selectedResult.timestamp
            )
          ),

          selectedResult.success && selectedResult.result && React.createElement('div', null,
            React.createElement('div', {
              style: {
                display: 'flex',
                gap: '8px',
                marginBottom: '16px',
                borderBottom: '2px solid rgba(99,102,241,0.2)',
                paddingBottom: '8px'
              }
            },
              ['table', 'json'].map(function(tab) {
                var labels = {
                  table: '📊 表格视图',
                  json: '{} JSON 视图'
                };
                return React.createElement('button', {
                  key: tab,
                  onClick: function() { setResultSubTab(tab); },
                  style: {
                    padding: '8px 16px',
                    background: resultSubTab === tab
                      ? 'linear-gradient(180deg, rgba(99,102,241,0.35), rgba(79,70,229,0.2))'
                      : 'rgba(255,255,255,0.05)',
                    border: resultSubTab === tab
                      ? '2px solid #6366f1'
                      : '2px solid transparent',
                    borderRadius: '8px',
                    color: resultSubTab === tab ? '#fff' : 'rgba(199,210,254,0.7)',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: 600
                  }
                }, labels[tab]);
              })
            ),

            resultSubTab === 'table' && renderTableResult(selectedResult.result),
            resultSubTab === 'json' && renderJsonResult(selectedResult.result)
          ),

          !selectedResult.success && React.createElement('div', {
            style: {
              padding: '20px',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '8px',
              color: '#fca5a5',
              textAlign: 'center'
            }
          },
            '⚠️ 解析失败',
            React.createElement('br'),
            React.createElement('span', { style: { fontSize: '13px', opacity: 0.8 } }, selectedResult.error || '未知错误')
          )
        )
      );
    }

    // =========================================================
    // 主渲染
    // =========================================================

    var mainContent = React.createElement('div', {
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)',
        color: '#1e293b',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }
    },
      // 标题区域
      React.createElement('div', {
        style: {
          padding: '20px 24px 16px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }
      },
        React.createElement('div', null,
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', marginBottom: '8px' } },
            React.createElement('span', { style: { fontSize: '20px', marginRight: '8px' } }, '🤖'),
            React.createElement('h2', { style: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#1e293b' } }, 'AI 截图资料解析')
          ),
          React.createElement('p', { style: { margin: 0, fontSize: '13px', color: '#64748b' } },
            '使用 AI 智能协作 让聪明的"人"与我们一同做工'
          )
        ),
        // 右上角设置按钮
        React.createElement('div', { style: { position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' } },
          // 当前 AI 模型名称 + 模型版本选择器
          React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }
          },
            // 模型提供商标签
            React.createElement('span', {
              style: {
                padding: '6px 12px',
                background: '#ede9fe',
                border: '1px solid #c4b5fd',
                borderRadius: '8px',
                color: '#7c3aed',
                fontSize: '13px',
                fontWeight: 600,
                whiteSpace: 'nowrap'
              }
            }, '🤖 ', selectedModel === 'qwen' ? '通义千问' : selectedModel === 'zhipu' ? '智谱GLM' : selectedModel),

            // 模型版本标签（可点击切换）
            React.createElement('span', {
              style: {
                padding: '6px 12px',
                background: selectedModel === 'zhipu' && (zhipuModelVersion === 'glm-4.6v-flash' || zhipuModelVersion === 'glm-4v-flash')
                  ? '#d1fae5'
                  : '#fef3c7',
                border: selectedModel === 'zhipu' && (zhipuModelVersion === 'glm-4.6v-flash' || zhipuModelVersion === 'glm-4v-flash')
                  ? '1px solid #6ee7b7'
                  : '1px solid #fcd34d',
                borderRadius: '8px',
                color: selectedModel === 'zhipu' && (zhipuModelVersion === 'glm-4.6v-flash' || zhipuModelVersion === 'glm-4v-flash')
                  ? '#059669'
                  : '#d97706',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              },
              onClick: function(e) {
                e.stopPropagation();
                setShowModelSelector(!showModelSelector);
              },
              title: '当前模型版本（点击切换）'
            },
              selectedModel === 'zhipu' ? zhipuModelVersion : qwenModelVersion,
              selectedModel === 'zhipu' && (zhipuModelVersion === 'glm-4.6v-flash' || zhipuModelVersion === 'glm-4v-flash')
                ? ' ✅'
                : ' ⚠️'
            ),

            // 当前 API Key 名称标签（始终显示）
            React.createElement('span', {
              style: {
                padding: '6px 12px',
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                borderRadius: '8px',
                color: '#2563eb',
                fontSize: '12px',
                fontWeight: 600,
                whiteSpace: 'nowrap',
                maxWidth: '150px',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              },
              title: activeKeyName
                ? '当前使用的 API Key：' + activeKeyName
                : '点击 API Key 管理按钮设置 Key 名称'
            }, '🔑 ', activeKeyName || '未命名'),

            // 模型版本下拉选择器
            showModelSelector && React.createElement('div', {
              style: {
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                minWidth: '280px',
                background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
                zIndex: 9999,
                overflow: 'hidden',
                padding: '12px'
              },
              onClick: function(e) { e.stopPropagation(); }
            },
              React.createElement('div', {
                style: {
                  fontSize: '14px',
                  fontWeight: 700,
                  color: '#1e293b',
                  marginBottom: '10px',
                  paddingBottom: '8px',
                  borderBottom: '1px solid #e2e8f0'
                }
              }, '🤖 选择模型版本'),

              // 智谱模型列表
              React.createElement('div', { style: { marginBottom: '10px' } },
                React.createElement('div', {
                  style: { fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }
                }, '智谱 GLM 模型：'),
                ['glm-4.6v-flash', 'glm-4v-flash', 'glm-4v-plus', 'glm-4v'].map(function(modelId) {
                  var isFree = modelId.includes('flash');
                  var modelNames = {
                    'glm-4.6v-flash': 'GLM-4.6V-Flash (免费·最新)',
                    'glm-4v-flash': 'GLM-4V-Flash (免费·稳定)',
                    'glm-4v-plus': 'GLM-4V-Plus (付费·精准)',
                    'glm-4v': 'GLM-4V (付费·最强)'
                  };
                  return React.createElement('button', {
                    key: modelId,
                    onClick: function() {
                      setZhipuModelVersion(modelId);
                      setSelectedModel('zhipu');
                      setShowModelSelector(false);
                      var models = JSON.parse(localStorage.getItem('ai_parser_models') || '{}');
                      models.zhipu = modelId;
                      localStorage.setItem('ai_parser_models', JSON.stringify(models));
                      localStorage.setItem('ai_parser_model', 'zhipu');
                      console.log('[AI-Parser] 切换到智谱模型:', modelId);
                    },
                    style: {
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '4px',
                      background: selectedModel === 'zhipu' && zhipuModelVersion === modelId
                        ? '#ede9fe'
                        : '#f8fafc',
                      border: selectedModel === 'zhipu' && zhipuModelVersion === modelId
                        ? '2px solid #7c3aed'
                        : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      color: selectedModel === 'zhipu' && zhipuModelVersion === modelId
                        ? '#7c3aed'
                        : '#475569',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }
                  },
                    React.createElement('span', null,
                      isFree ? '✅ ' : '💰 ',
                      modelNames[modelId]
                    ),
                    selectedModel === 'zhipu' && zhipuModelVersion === modelId
                      ? React.createElement('span', { style: { color: '#86efac', fontWeight: 700 } }, '✓ 当前使用')
                      : null
                  );
                })
              ),

              // 通义千问模型列表
              React.createElement('div', null,
                React.createElement('div', {
                  style: { fontSize: '12px', color: '#64748b', marginBottom: '6px', fontWeight: 600 }
                }, '通义千问 Qwen 模型：'),
                ['qwen-vl-max-latest', 'qwen-vl-plus-latest', 'qwen-vl-max'].map(function(modelId) {
                  var modelNames = {
                    'qwen-vl-max-latest': 'Qwen-VL-Max-Latest (最新)',
                    'qwen-vl-plus-latest': 'Qwen-VL-Plus-Latest (增强)',
                    'qwen-vl-max': 'Qwen-VL-Max (稳定)'
                  };
                  return React.createElement('button', {
                    key: modelId,
                    onClick: function() {
                      setQwenModelVersion(modelId);
                      setSelectedModel('qwen');
                      setShowModelSelector(false);
                      var models = JSON.parse(localStorage.getItem('ai_parser_models') || '{}');
                      models.tongyi = modelId;
                      localStorage.setItem('ai_parser_models', JSON.stringify(models));
                      localStorage.setItem('ai_parser_model', 'qwen');
                      console.log('[AI-Parser] 切换到通义模型:', modelId);
                    },
                    style: {
                      width: '100%',
                      padding: '8px 12px',
                      marginBottom: '4px',
                      background: selectedModel === 'qwen' && qwenModelVersion === modelId
                        ? '#dbeafe'
                        : '#f8fafc',
                      border: selectedModel === 'qwen' && qwenModelVersion === modelId
                        ? '2px solid #2563eb'
                        : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      color: selectedModel === 'qwen' && qwenModelVersion === modelId
                        ? '#2563eb'
                        : '#475569',
                      cursor: 'pointer',
                      fontSize: '13px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'all 0.2s ease'
                    }
                  },
                    React.createElement('span', null, '☁️ ', modelNames[modelId]),
                    selectedModel === 'qwen' && qwenModelVersion === modelId
                      ? React.createElement('span', { style: { color: '#86efac', fontWeight: 700 } }, '✓ 当前使用')
                      : null
                  );
                })
              )
            )
          ),
          React.createElement('button', {
            onClick: function(e) {
              e.stopPropagation();
              setShowSettingsMenu(!showSettingsMenu);
            },
            title: 'AI 设置',
            style: {
              padding: '8px 14px',
              background: showSettingsMenu ? '#e0e7ff' : '#f1f5f9',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              color: '#475569',
              fontSize: '16px',
              cursor: 'pointer'
            }
          }, '⚙️'),
          // 工具下拉菜单（包含两个选项，打开独立插件窗口）
          showSettingsMenu && React.createElement('div', {
            style: {
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '8px',
              minWidth: '240px',
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              boxShadow: '0 10px 40px rgba(0,0,0,0.1)',
              zIndex: 9999,
              overflow: 'hidden'
            }
          },
            React.createElement('button', {
              onClick: function(e) {
                e.stopPropagation();
                setShowSettingsMenu(false);
                console.log('[AI-Parser] 打开 AI API Key 管理器');
                if (window.AiApiKeyManager) {
                  window.AiApiKeyManager.open();
                } else {
                  alert('AI API Key 管理器插件未加载');
                }
              },
              style: {
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: '1px solid #f1f5f9',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }
            }, '🔑', 'AI API Key 设定'),
            React.createElement('button', {
              onClick: function(e) {
                e.stopPropagation();
                setShowSettingsMenu(false);
                console.log('[AI-Parser] 打开 Prompt 管理器');
                if (window.AiPromptManager) {
                  window.AiPromptManager.open();
                } else {
                  alert('AI Prompt 管理器插件未加载');
                }
              },
              style: {
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }
            }, '📝', 'Prompt 管理'),
            React.createElement('button', {
              onClick: function(e) {
                e.stopPropagation();
                setShowSettingsMenu(false);
                console.log('[AI-Parser] 打开 AI 聊天助手');

                // 动态加载并打开聊天工具
                var chatContainer = document.getElementById('ai-chat-container');
                if (chatContainer) {
                  window.ReactDOM.unmountComponentAtNode(chatContainer);
                  if (chatContainer.parentNode) chatContainer.parentNode.removeChild(chatContainer);
                }

                // 检查是否已加载
                if (window.AIChatParserLoaded) {
                  openChatTool();
                } else {
                  // 动态加载脚本
                  var script = document.createElement('script');
                  script.src = 'aiChatParserPlugin.js';
                  script.onload = function() {
                    window.AIChatParserLoaded = true;
                    setTimeout(openChatTool, 500);
                  };
                  script.onerror = function() {
                    alert('❌ 加载 AI 聊天助手失败');
                  };
                  document.head.appendChild(script);
                }
              },
              style: {
                width: '100%',
                padding: '12px 16px',
                background: 'transparent',
                border: 'none',
                borderBottom: 'none',
                color: '#475569',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: 600,
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }
            }, '💬', 'AI 聊天助手 (新版)')
          )
        )
      ),

      // 状态信息
      status && React.createElement('div', {
        style: {
          margin: '12px 24px',
          padding: '12px 16px',
          borderRadius: '8px',
          background: status.isOk
            ? '#d1fae5'
            : '#fee2e2',
          border: '1px solid ' + (status.isOk ? '#6ee7b7' : '#fca5a5'),
          color: status.isOk ? '#059669' : '#dc2626',
          fontSize: '13px',
          fontWeight: 600
        }
      }, status.message),

      // 统计信息卡片
      parseCompleteInfo && React.createElement('div', {
        style: { margin: '12px 24px' }
      },
        React.createElement('div', {
          style: {
            padding: '12px 16px',
            background: '#f0fdf4',
            border: '1px solid #bbf7d0',
            borderRadius: '10px'
          }
        },
          React.createElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }
          },
            React.createElement('div', {
              style: {
                fontSize: '15px',
                fontWeight: 700,
                color: '#059669'
              }
            }, '✨ 全部完成！成功解析 ', parseCompleteInfo.successCount, ' 张图片'),
            React.createElement('button', {
              onClick: function() { setIsCompleteInfoCollapsed(!isCompleteInfoCollapsed); },
              style: {
                background: 'none',
                border: 'none',
                color: '#6ee7b7',
                cursor: 'pointer',
                fontSize: '18px'
              }
            }, isCompleteInfoCollapsed ? '▼' : '▲')
          ),
          !isCompleteInfoCollapsed && React.createElement('div', {
            style: {
              display: 'flex',
              gap: '10px',
              marginTop: '10px'
            }
          },
            ['总图片', '成功', '失败', '耗时'].map(function(label, idx) {
              var values = [
                parseCompleteInfo.totalImages,
                parseCompleteInfo.successCount,
                parseCompleteInfo.failCount,
                parseCompleteInfo.durationSec + 's'
              ];
              var colors = [
                { bg: '#f1f5f9', text: '#64748b' },
                { bg: '#d1fae5', text: '#059669' },
                { bg: '#fee2e2', text: '#dc2626' },
                { bg: '#ede9fe', text: '#7c3aed' }
              ];
              return React.createElement('div', {
                key: label,
                style: {
                  flex: 1,
                  textAlign: 'center',
                  padding: '10px 8px',
                  background: colors[idx].bg,
                  borderRadius: '8px',
                  border: '1px solid ' + (idx === 0 ? '#e2e8f0' : idx === 1 ? '#6ee7b7' : idx === 2 ? '#fca5a5' : '#c4b5fd')
                }
              },
                React.createElement('div', {
                  style: {
                    fontSize: '11px',
                    color: colors[idx].text,
                    opacity: 0.8,
                    marginBottom: '4px'
                  }
                }, label),
                React.createElement('div', {
                  style: {
                    fontSize: '18px',
                    fontWeight: 800,
                    color: colors[idx].text
                  }
                }, values[idx])
              );
            })
          ),
          React.createElement('div', {
            style: {
              marginTop: '10px',
              fontSize: '12px',
              color: '#64748b',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '8px',
              lineHeight: '1.8'
            }
          },
            React.createElement('span', null, '🤖 模型：', parseCompleteInfo.modelName),
            React.createElement('span', {
              style: {
                background: '#dbeafe',
                padding: '2px 8px',
                borderRadius: '4px',
                color: '#2563eb',
                fontWeight: 500
              }
            }, '🔑 ', parseCompleteInfo.keyName || '未命名'),
            parseCompleteInfo.hasPrompt
              ? React.createElement('span', null, '📝 Prompt：✓ 自定义')
              : React.createElement('span', null, '📝 Prompt：默认'),
            React.createElement('span', null, '🕐 ', parseCompleteInfo.timestamp)
          )
        )
      ),

      // 标签页
      React.createElement('div', {
        style: {
          display: 'flex',
          gap: '4px',
          margin: '12px 24px',
          borderBottom: '2px solid rgba(99,102,241,0.2)',
          paddingBottom: '0'
        }
      },
        ['images', 'raw', 'results'].map(function(tab) {
          var labels = { images: '🖼 图片', raw: '📜 原始结果', results: '📊 结果' };
          var counts = { images: images.length, raw: results.length, results: results.length };
          return React.createElement('button', {
            key: tab,
            onClick: function() { setActiveTab(tab); },
            style: {
              padding: '10px 20px',
              background: activeTab === tab
                ? '#ffffff'
                : 'transparent',
              border: activeTab === tab
                ? '2px solid #e2e8f0'
                : '2px solid transparent',
              borderBottom: activeTab === tab
                ? '2px solid #6366f1'
                : '2px solid transparent',
              borderRadius: '8px 8px 0 0',
              color: activeTab === tab ? '#1e293b' : '#64748b',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              marginBottom: activeTab === tab ? '-2px' : '0'
            }
          },
            labels[tab],
            counts[tab] > 0 && tab !== 'images' && React.createElement('span', {
              style: {
                marginLeft: '6px',
                padding: '2px 8px',
                borderRadius: '10px',
                background: '#6366f1',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 700
              }
            }, counts[tab])
          );
        })
      ),

      // 主内容区
      React.createElement('div', {
        style: {
          flex: 1,
          overflowY: 'auto',
          overflowX: 'hidden',
          padding: '0 24px 24px'
        }
      },
        activeTab === 'images' && renderImagesTab(),
        activeTab === 'raw' && renderRawTab(),
        activeTab === 'results' && renderResultsTab()
      )
    );

    return React.createElement(window.FloatingWindowReact, {
      isOpen: true,
      width: '900px',
      height: '750px',
      onClose: function() {
        var container = document.getElementById('ai-parser-container');
        if (container) ReactDOM.unmountComponentAtNode(container);
        if (container.parentNode) container.parentNode.removeChild(container);
      },
      title: '🤖 AI 截图资料解析 (aiScreenshotParserPlugin.js)'
    }, mainContent);
  }

  // =========================================================
  // 打开 AI 聊天助手工具
  // =========================================================

  function openChatTool() {
    var container = document.createElement('div');
    container.id = 'ai-chat-container';
    // 注意：不设置 position 和 z-index，避免创建堆叠上下文限制子元素
    // FloatingWindowReact 组件会自行管理 position 和 z-index，支持点击置顶功能
    document.body.appendChild(container);

    if (window.AIChatApp) {
      window.ReactDOM.render(React.createElement(window.AIChatApp), container);
    } else {
      console.warn('[AI-Parser] AI 聊天组件尚未就绪');
    }
  }

  // 暴露到全局
  window.openAIChatTool = openChatTool;

  // =========================================================
  // 初始化
  // =========================================================

  function init() {
    var aiParserBtn = document.getElementById('aiParserBtn');
    if (aiParserBtn) {
      console.log('[AI-Parser] 找到按钮，正在挂载...');

      aiParserBtn.addEventListener('click', function() {
        console.log('[AI-Parser] 按钮被点击');

        var existingContainer = document.getElementById('ai-parser-container');
        if (existingContainer) {
          ReactDOM.unmountComponentAtNode(existingContainer);
          if (existingContainer.parentNode) existingContainer.parentNode.removeChild(existingContainer);
        }

        var container = document.createElement('div');
        container.id = 'ai-parser-container';
        // 注意：不设置 position 和 z-index，避免创建堆叠上下文限制子元素
        // FloatingWindowReact 组件会自行管理 position 和 z-index，支持点击置顶功能
        document.body.appendChild(container);
        ReactDOM.render(React.createElement(AIScreenshotParserApp), container);
      });

      console.log('[AI-Parser] ✅ 插件就绪 v7.0 (专业版 UI + TableGridExtractor)');
    } else {
      console.warn('[AI-Parser] 未找到 #aiParserBtn，将在 1 秒后重试...');
      setTimeout(init, 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
