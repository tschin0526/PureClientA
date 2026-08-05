/**
 * Prompt 管理器 (AiPromptManager)
 *
 * 功能：
 * - 管理 AI 图形识别的提示词（Prompt）
 * - 添加、编辑、删除自定义 Prompt
 * - 设置默认使用的 Prompt
 * - 提供常用模板和示例
 *
 * 技术栈：
 * - React 18 (函数组件 + Hooks)
 * - FloatingWindowReact (React 版浮动视窗)
 */

(function() {
  'use strict';

  // ===== 检查依赖 =====
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('[AI-Prompt] React 或 ReactDOM 未加载！');
    return;
  }

  if (typeof FloatingWindowReact === 'undefined') {
    console.error('[AI-Prompt] FloatingWindowReact 未加载！');
    return;
  }

  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var createElement = React.createElement;

  // ===== 默认 Prompt 模板 =====
  var DEFAULT_PROMPTS = [
    {
      id: 'default_table',
      name: '默认表格识别',
      content: '请识别这张图片中的表格数据，并以JSON格式输出。格式要求：{"headers": ["列1","列2",...], "rows": [["数据1","数据2",...],...]}. 只输出JSON，不要其他文字。',
      isDefault: true,
      isSystem: true,
      description: '通用型表格识别，适用于大多数标准表格'
    },
    {
      id: 'financial_table',
      name: '财务表格识别',
      content: '这是一张财务相关的表格截图。请识别其中的所有数据，包括股票代码、价格、数量、金额等数值信息。以JSON格式输出：{"headers": ["列名",...], "rows": [[值,...],...]}。注意保留原始数值精度，不要进行四舍五入。',
      isDefault: false,
      isSystem: true,
      description: '专门用于识别股票交易、财务报表等数据'
    },
    {
      id: 'stock_data',
      name: '股票数据识别',
      content: '请识别这张股票相关图片中的所有数据，包括：1) 股票名称和代码 2) 当前价格 3) 涨跌额和涨跌幅 4) 成交量/成交额（如有）。以结构化JSON格式输出，确保数字准确无误。',
      isDefault: false,
      isSystem: true,
      description: '针对股票行情截图优化，提取关键行情指标'
    },
    {
      id: 'detailed_analysis',
      name: '详细数据分析',
      content: '请详细分析这张图片中的所有数据：1) 识别并提取所有数值 2) 标注数据的单位和含义 3) 如有计算关系请说明 4) 以清晰的JSON结构输出结果，包含元数据说明。',
      isDefault: false,
      isSystem: false,
      description: '深度分析模式，提供更详细的数据解读'
    }
  ];

  // ===== 主应用组件 =====
  function AiPromptManagerApp(props) {
    var _useState1 = useState(loadPrompts()),
        prompts = _useState1[0],
        setPrompts = _useState1[1];

    var _useState2 = useState(null),
        editingPrompt = _useState2[0],
        setEditingPrompt = _useState2[1];

    var _useState3 = useState(false),
        showForm = _useState3[0],
        setShowForm = _useState3[1];

    var _useState4 = useState(''),
        searchQuery = _useState4[0],
        setSearchQuery = _useState4[1];

    // 表单数据状态（提升到顶层，避免在嵌套函数中调用 useState）
    var _useState5 = useState({ name: '', content: '', description: '', isDefault: false, isSystem: false, id: '' }),
        formData = _useState5[0],
        setFormData = _useState5[1];

    // 加载 Prompts（支持两套存储键，保持兼容性）
    function loadPrompts() {
      try {
        // 先尝试加载旧格式
        var saved = localStorage.getItem('ai_ocr_prompts');
        if (saved) {
          return JSON.parse(saved);
        }
        
        // 如果没有旧格式，尝试从 aiScreenshotParserPlugin 的格式中导入
        var singlePrompt = localStorage.getItem('ai_parser_prompt');
        if (singlePrompt && singlePrompt.trim() !== '') {
          // 创建一个包含该 prompt 的数组
          var importedPrompt = {
            id: 'imported_from_parser_' + Date.now(),
            name: '从解析器导入',
            content: singlePrompt,
            isDefault: true,
            isSystem: false,
            description: '从 AI 截图解析器导入的 Prompt'
          };
          var prompts = DEFAULT_PROMPTS.slice();
          prompts.push(importedPrompt);
          return prompts;
        }
      } catch(e) {
        console.warn('[AI-Prompt] 加载失败:', e);
      }
      return DEFAULT_PROMPTS.slice();
    }

    // 保存 Prompts（同时保存到两套存储键，保持兼容性）
    var savePrompts = useCallback(function(newPrompts) {
      setPrompts(newPrompts);
      localStorage.setItem('ai_ocr_prompts', JSON.stringify(newPrompts));
      
      // 同时将默认的 prompt 保存到 aiScreenshotParserPlugin 使用的格式
      var defaultPrompt = newPrompts.find(function(p) { return p.isDefault; });
      if (defaultPrompt && defaultPrompt.content) {
        localStorage.setItem('ai_parser_prompt', defaultPrompt.content);
      }
      
      console.log('[AI-Prompt] Prompts 已保存, 数量:', newPrompts.length);
    }, []);

    // 添加新 Prompt
    var addNewPrompt = useCallback(function() {
      var newPrompt = {
        id: 'custom_' + Date.now(),
        name: '',
        content: '',
        isDefault: false,
        isSystem: false,
        description: ''
      };
      setEditingPrompt(newPrompt);
      setFormData(Object.assign({}, newPrompt));  // 初始化表单数据
      setShowForm(true);
    }, []);

    // 编辑 Prompt
    var editPrompt = useCallback(function(prompt) {
      console.log('[AI-Prompt] 编辑 Prompt:', prompt.name, prompt.id);
      setEditingPrompt(Object.assign({}, prompt));
      setFormData(Object.assign({}, prompt));  // 初始化表单数据
      setShowForm(true);
      console.log('[AI-Prompt] 表单已打开，formData 已初始化');
    }, []);

    // 删除 Prompt
    var deletePrompt = useCallback(function(promptId) {
      if (!confirm('确定要删除这个 Prompt 吗？')) return;

      var newPrompts = prompts.filter(function(p) { return p.id !== promptId; });

      // 如果删除的是默认的，设置第一个为默认
      if (prompts.find(function(p) { return p.id === promptId && p.isDefault; })) {
        if (newPrompts.length > 0) {
          newPrompts[0].isDefault = true;
        }
      }

      savePrompts(newPrompts);
    }, [prompts, savePrompts]);

    // 设置默认 Prompt
    var setAsDefault = useCallback(function(promptId) {
      var newPrompts = prompts.map(function(p) {
        return Object.assign({}, p, { isDefault: p.id === promptId });
      });
      savePrompts(newPrompts);
    }, [prompts, savePrompts]);

    // 保存编辑的 Prompt
    var saveEditedPrompt = useCallback(function(updatedPrompt) {
      var existingIndex = prompts.findIndex(function(p) { return p.id === updatedPrompt.id; });
      var newPrompts;

      if (existingIndex >= 0) {
        // 更新现有
        newPrompts = prompts.slice();
        newPrompts[existingIndex] = updatedPrompt;
      } else {
        // 添加新的
        newPrompts = prompts.concat([updatedPrompt]);
      }

      savePrompts(newPrompts);
      setShowForm(false);
      setEditingPrompt(null);
    }, [prompts, savePrompts]);

    // 取消编辑
    var cancelEdit = useCallback(function() {
      setShowForm(false);
      setEditingPrompt(null);
      setFormData({ name: '', content: '', description: '', isDefault: false, isSystem: false, id: '' });  // 重置表单数据
    }, []);

    // 过滤 Prompts
    var filteredPrompts = prompts.filter(function(p) {
      if (!searchQuery) return true;
      var query = searchQuery.toLowerCase();
      return p.name.toLowerCase().indexOf(query) !== -1 ||
             p.content.toLowerCase().indexOf(query) !== -1 ||
             (p.description && p.description.toLowerCase().indexOf(query) !== -1);
    });

    // 渲染搜索栏
    var renderSearchBar = function() {
      return createElement('div', {
        style: {
          marginBottom: '16px',
          display: 'flex',
          gap: '10px'
        }
      },
        createElement('input', {
          type: 'text',
          value: searchQuery,
          onChange: function(e) { setSearchQuery(e.target.value); },
          placeholder: '🔍 搜索 Prompt...',
          style: {
            flex: 1,
            padding: '10px 14px',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            fontSize: '14px',
            outline: 'none',
            boxSizing: 'border-box'
          },
          onFocus: function(e) { e.target.style.borderColor = '#3b82f6'; },
          onBlur: function(e) { e.target.style.borderColor = '#cbd5e1'; }
        }),
        createElement('button', {
          onClick: addNewPrompt,
          style: {
            padding: '10px 20px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }
        }, '+ 新建')
      );
    };

    // 渲染 Prompt 卡片
    function renderPromptCard(prompt) {
      return createElement('div', {
        key: prompt.id,
        style: {
          border: '2px solid ' + (prompt.isDefault ? '#10b981' : '#e2e8f0'),
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '12px',
          background: prompt.isDefault ? '#f0fdf4' : 'white',
          transition: 'all 0.3s ease',
          position: 'relative'
        }
      },

        // 默认标识
        prompt.isDefault && createElement('div', {
          style: {
            position: 'absolute',
            top: '-10px',
            right: '16px',
            background: '#10b981',
            color: 'white',
            padding: '4px 12px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600
          }
        }, '✓ 当前默认'),

        // 系统标识
        prompt.isSystem && createElement('div', {
          style: {
            position: 'absolute',
            top: '-10px',
            left: '16px',
            background: '#f59e0b',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '11px',
            fontWeight: 600
          }
        }, '系统预设'),

        // 标题行
        createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '8px'
          }
        },
          createElement('h4', {
            style: {
              margin: 0,
              fontSize: '16px',
              color: '#1e293b',
              flex: 1
            }
          }, prompt.name),

          // 操作按钮组
          createElement('div', {
            style: { display: 'flex', gap: '6px', alignItems: 'center' }
          },

            !prompt.isDefault && createElement('button', {
              onClick: function() { setAsDefault(prompt.id); },
              title: '设为默认',
              style: {
                padding: '5px 10px',
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#166534'
              }
            }, '设为默认'),

            createElement('button', {
              onClick: function() { editPrompt(prompt); },
              title: '编辑',
              style: {
                padding: '5px 10px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#1e40af'
              }
            }, '✏️'),

            !prompt.isSystem && createElement('button', {
              onClick: function() { deletePrompt(prompt.id); },
              title: '删除',
              style: {
                padding: '5px 10px',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '5px',
                cursor: 'pointer',
                fontSize: '12px',
                color: '#dc2626'
              }
            }, '🗑️')
          )
        ),

        // 描述
        prompt.description && createElement('p', {
          style: {
            margin: '0 0 10px 0',
            fontSize: '13px',
            color: '#64748b',
            lineHeight: '1.4'
          }
        }, prompt.description),

        // 内容预览
        createElement('div', {
          style: {
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            padding: '10px 12px',
            maxHeight: '80px',
            overflow: 'hidden',
            position: 'relative'
          }
        },
          createElement('pre', {
            style: {
              margin: 0,
              fontSize: '12px',
              color: '#475569',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              lineHeight: '1.5',
              fontFamily: 'inherit'
            }
          }, prompt.content),

          prompt.content.length > 150 && createElement('div', {
            style: {
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: '30px',
              background: 'linear-gradient(transparent, #f8fafc)',
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              paddingBottom: '4px',
              fontSize: '11px',
              color: '#94a3b8'
            }
          }, '... 展开查看完整内容')
        )
      );
    }

    // 渲染编辑表单
    var renderEditForm = function() {
      if (!showForm || !editingPrompt) return null;

      console.log('[AI-Prompt] 渲染编辑表单...');
      console.log('[AI-Prompt] editingPrompt:', editingPrompt);
      console.log('[AI-Prompt] formData:', formData);

      // 使用组件顶层的 formData 状态（不再在函数内部调用 useState）
      var handleSave = function() {
        console.log('[AI-Prompt] 保存表单数据:', formData);

        if (!formData.name.trim()) {
          alert('请输入 Prompt 名称！');
          return;
        }
        if (!formData.content.trim()) {
          alert('请输入 Prompt 内容！');
          return;
        }

        // 更新 ID（保持原有 ID）
        var finalData = Object.assign({}, formData, { id: editingPrompt.id });
        console.log('[AI-Prompt] 最终保存数据:', finalData);
        saveEditedPrompt(finalData);
      };

      return createElement('div', {
        style: {
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        },
        onClick: cancelEdit
      },
        createElement('div', {
          style: {
            background: 'white',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '600px',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
            padding: '24px'
          },
          onClick: function(e) { e.stopPropagation(); }
        },

          // 表单标题
          createElement('h3', {
            style: {
              margin: '0 0 20px 0',
              fontSize: '19px',
              color: '#1e293b'
            }
          }, editingPrompt.id.startsWith('custom_') ? '✏️ 编辑 Prompt' : '📝 新建 Prompt'),

          // 名称输入
          createElement('div', { style: { marginBottom: '16px' } },
            createElement('label', {
              style: {
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px'
              }
            }, '名称 *'),
            createElement('input', {
              type: 'text',
              value: formData.name,
              onChange: function(e) { setFormData(Object.assign({}, formData, { name: e.target.value })); },
              placeholder: '例如：我的自定义识别模板',
              style: {
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }
            })
          ),

          // 描述输入
          createElement('div', { style: { marginBottom: '16px' } },
            createElement('label', {
              style: {
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px'
              }
            }, '描述（可选）'),
            createElement('input', {
              type: 'text',
              value: formData.description || '',
              onChange: function(e) { setFormData(Object.assign({}, formData, { description: e.target.value })); },
              placeholder: '简要描述此 Prompt 的用途',
              style: {
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box'
              }
            })
          ),

          // 内容输入
          createElement('div', { style: { marginBottom: '20px' } },
            createElement('label', {
              style: {
                display: 'block',
                fontSize: '13px',
                fontWeight: 600,
                color: '#334155',
                marginBottom: '6px'
              }
            }, 'Prompt 内容 *'),
            createElement('textarea', {
              value: formData.content,
              onChange: function(e) { setFormData(Object.assign({}, formData, { content: e.target.value })); },
              placeholder: '输入您的提示词内容...\n\n提示：可以使用变量或特殊标记来增强灵活性',
              rows: 8,
              style: {
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '13px',
                boxSizing: 'border-box',
                resize: 'vertical',
                lineHeight: '1.6',
                fontFamily: 'monospace'
              }
            })
          ),

          // 操作按钮
          createElement('div', {
            style: {
              display: 'flex',
              gap: '10px',
              justifyContent: 'flex-end'
            }
          },
            createElement('button', {
              onClick: cancelEdit,
              style: {
                padding: '10px 24px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                color: '#475569'
              }
            }, '取消'),
            createElement('button', {
              onClick: handleSave,
              style: {
                padding: '10px 24px',
                background: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: 600
              }
            }, '💾 保存')
          )
        )
      );
    };

    // 渲染统计信息
    var renderStats = function() {
      var systemCount = prompts.filter(function(p) { return p.isSystem; }).length;
      var customCount = prompts.filter(function(p) { return !p.isSystem; }).length;

      return createElement('div', {
        style: {
          display: 'flex',
          gap: '16px',
          marginBottom: '16px',
          padding: '12px 16px',
          background: '#f8fafc',
          borderRadius: '8px',
          border: '1px solid #e2e8f0'
        }
      },
        createElement('div', null,
          createElement('strong', { style: { color: '#334155', fontSize: '13px' } }, '总计: '),
          createElement('span', { style: { color: '#1e293b', fontSize: '15px', fontWeight: 600 } }, prompts.length)
        ),
        createElement('div', null,
          createElement('span', { style: { color: '#f59e0b', fontSize: '13px' } }, '📦 系统: '),
          createElement('span', { style: { color: '#1e293b', fontSize: '14px', fontWeight: 500 } }, systemCount)
        ),
        createElement('div', null,
          createElement('span', { style: { color: '#3b82f6', fontSize: '13px' } }, '✏️ 自定义: '),
          createElement('span', { style: { color: '#1e293b', fontSize: '14px', fontWeight: 500 } }, customCount)
        )
      );
    };

    // 渲染空状态
    var renderEmpty = function() {
      if (filteredPrompts.length > 0) return null;

      return createElement('div', {
        style: {
          textAlign: 'center',
          padding: '60px 20px',
          color: '#94a3b8'
        }
      },
        createElement('div', { style: { fontSize: '48px', marginBottom: '16px' } }, '📝'),
        createElement('h4', { style: { margin: '0 0 8px 0', color: '#64748b' } }, searchQuery ? '未找到匹配的 Prompt' : '暂无 Prompt'),
        createElement('p', { style: { margin: 0, fontSize: '14px' } }, searchQuery ? '尝试其他搜索关键词' : '点击"新建"按钮创建您的第一个 Prompt')
      );
    };

    // 主渲染
    return createElement('div', {
      className: 'ai-prompt-manager',
      style: {
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px'
      }
    },

      // 标题
      createElement('h3', {
        style: {
          margin: '0 0 16px 0',
          fontSize: '19px',
          color: '#1e293b',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      }, '📝 Prompt 管理'),

      // 统计信息
      renderStats(),

      // 搜索和新建按钮
      renderSearchBar(),

      // Prompt 列表
      createElement('div', {
        style: {
          flex: 1,
          overflowY: 'auto',
          paddingRight: '4px'
        }
      },
        filteredPrompts.map(renderPromptCard),
        renderEmpty()
      ),

      // 编辑表单（模态框）
      renderEditForm()
    );
  }

  // ===== 错误边界组件 =====
  function ErrorBoundary(props) {
    var _useState = useState({ hasError: false, error: null }),
        state = _useState[0],
        setState = _useState[1];

    useEffect(function() {
      var originalHandler = window.onerror;
      window.onerror = function(message, source, lineno, colno, error) {
        setState({ hasError: true, error: error });
        if (originalHandler) originalHandler.apply(this, arguments);
      };
      return function() { window.onerror = originalHandler; };
    }, []);

    if (state.hasError) {
      return createElement('div', {
        style: { padding: '40px', textAlign: 'center', color: '#dc2626' }
      },
        createElement('h3', null, '❌ 组件出错'),
        createElement('button', {
          onClick: function() { setState({ hasError: false, error: null }); },
          style: {
            marginTop: '16px',
            padding: '8px 24px',
            background: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer'
          }
        }, '重试')
      );
    }

    return props.children;
  }

  // ===== 插件管理器 =====
  function AiPromptManager() {
    this.reactRoot = null;
    this.container = null;
  }

  AiPromptManager.prototype.open = function() {
    console.log('[AI-Prompt] 打开 Prompt 管理窗口');

    try {
      // 如果窗口已存在，先关闭
      if (this.container) {
        this.close();
      }

      var container = document.createElement('div');
      container.id = 'ai-prompt-manager-container';
      // 注意：不设置 position/top/left/z-index，避免创建堆叠上下文限制子元素
      // FloatingWindowReact 组件会自行管理 position 和 z-index，支持点击置顶功能
      document.body.appendChild(container);
      this.container = container;

      if (!ReactDOM) throw new Error('ReactDOM 未定义');
      if (!FloatingWindowReact) throw new Error('FloatingWindowReact 未定义');

      var root = ReactDOM.createRoot(container);
      this.reactRoot = root;
      
      var self = this;

      root.render(
        createElement(FloatingWindowReact, {
          title: 'Prompt 管理',
          sourceFile: 'aiPromptManager.js',
          width: '650px',
          height: '700px',
          draggable: true,
          closeAnimation: 'fade',
          onClose: function() { self.close(); }
        },
          createElement(ErrorBoundary, null,
            createElement(AiPromptManagerApp, null)
          )
        )
      );

      console.log('[AI-Prompt] ✅ 窗口已打开');

    } catch(err) {
      console.error('[AI-Prompt] ❌ 打开窗口失败:', err.message);
      alert('❌ 打开 Prompt 管理窗口失败！\n\n错误信息: ' + err.message);
    }
  };
  
  AiPromptManager.prototype.close = function() {
    console.log('[AI-Prompt] 关闭 Prompt 管理窗口');
    
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch(e) {
        console.error('[AI-Prompt] 卸载组件失败:', e);
      }
      this.reactRoot = null;
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
  };

  // ===== 注册到全局 =====
  window.AiPromptManager = new AiPromptManager();

  console.log('[AI-Prompt] ========================================');
  console.log('[AI-Prompt] Prompt 管理器已加载');
  console.log('[AI-Prompt] 内置模板数:', DEFAULT_PROMPTS.length);
  console.log('[AI-Prompt] ========================================');

})();
