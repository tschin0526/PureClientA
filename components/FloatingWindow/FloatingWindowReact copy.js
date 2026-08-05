/**
 * 浮动视窗组件 - React 版 (FloatingWindowReact)
 *
 * 功能与 FloatingWindow.js 完全一致：
 * - 窗口框架（标题栏 + 内容区 + 关闭按钮）
 * - 居中显示 / 隐藏（带动画）
 * - 可选拖拽功能（鼠标 + 触摸）
 * - 12种关闭动画效果
 * - 事件回调系统
 *
 * 技术栈：
 * - React 18 (函数组件 + Hooks)
 * - React.createElement() (不使用 JSX)
 *
 * 与原版的关系：
 * - 原版：Vanilla JS 类，通过 innerHTML 设置内容
 * - 本版：React 组件，通过 children 或 render prop 设置内容
 */

(function() {
  'use strict';

  // ===== 检查 React 是否可用 =====
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('[FW-React] React 或 ReactDOM 未加载！');
    return;
  }

  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var useRef = React.useRef;
  var createElement = React.createElement;

  // ===== 动画配置 =====
  var CLOSE_ANIMATIONS = [
    { name: 'fade', duration: 300, description: '淡出消失' },
    { name: 'scale', duration: 300, description: '缩小消失' },
    { name: 'slideUp', duration: 300, description: '向上滑出' },
    { name: 'slideDown', duration: 300, description: '向下滑出' },
    { name: 'rotate', duration: 500, description: '旋转消失' },
    { name: 'bounce', duration: 500, description: '弹跳消失' }
  ];

  // ===== 全局 z-index 管理 =====
  var currentMaxZIndex = 999999;

  // ===== 全局窗口管理器 =====
  var WindowManager = {
    windows: new Map(),
    windowCounter: 0,
    
    // 全局面板状态
    showPanel: false,
    panelPosition: { top: 0, left: 0 },
    panelContainer: null,

    register: function(id, instance) {
      this.windowCounter++;
      this.windows.set(id, {
        id: id,
        instance: instance,
        title: instance.props.title || '未命名窗口',
        sourceFile: instance.props.sourceFile || '',
        createdAt: Date.now(),
        order: this.windowCounter
      });
      console.log('[WindowManager] ✅ 注册窗口:', id, '(总数:', this.windows.size, ')');
      
      // 确保面板容器存在
      this.ensurePanelContainer();
    },

    unregister: function(id) {
      if (this.windows.has(id)) {
        this.windows.delete(id);
        console.log('[WindowManager] ❌ 注销窗口:', id, '(剩余:', this.windows.size, ')');
        
        // 如果没有窗口了，关闭面板
        if (this.windows.size === 0) {
          this.showPanel = false;
          this.updatePanelVisibility();
        }
      }
    },
    
    ensurePanelContainer: function() {
      if (!this.panelContainer) {
        this.panelContainer = document.createElement('div');
        this.panelContainer.id = 'global-window-manager-panel';
        this.panelContainer.style.cssText = `
          position: fixed;
          z-index: 2147483647;  /* 最大值，确保在最上层 */
          display: none;
          pointer-events: auto;
        `;
        document.body.appendChild(this.panelContainer);
        console.log('[WindowManager] ✨ 创建全局面板容器');
      }
    },
    
    togglePanel: function(buttonElement) {
      if (buttonElement) {
        var rect = buttonElement.getBoundingClientRect();
        
        // 智能定位：确保面板完全在屏幕内
        var panelWidth = 300;
        var panelHeight = 320;
        var viewportWidth = window.innerWidth;
        var viewportHeight = window.innerHeight;
        
        // 计算初始位置（按钮下方）
        var top = rect.bottom + window.scrollY + 4;
        var left = rect.right - panelWidth + window.scrollX;  // 面板右边缘对齐按钮右边缘
        
        // 边界检测和调整
        // 如果右侧超出屏幕，向左调整
        if (left + panelWidth > viewportWidth) {
          left = viewportWidth - panelWidth - 10;
        }
        // 如果左侧超出屏幕，向右调整
        if (left < 10) {
          left = 10;
        }
        // 如果底部超出屏幕，显示在按钮上方
        if (top + panelHeight > viewportHeight + window.scrollY) {
          top = rect.top + window.scrollY - panelHeight - 4;
        }
        // 如果顶部超出屏幕，显示在视窗顶部
        if (top < window.scrollY) {
          top = window.scrollY + 10;
        }
        
        this.panelPosition = { top: top, left: left };
      }
      
      this.showPanel = !this.showPanel;
      this.updatePanelVisibility();
      
      console.log('[WindowManager] 🔄 切换面板:', this.showPanel ? '显示' : '隐藏', '位置:', this.panelPosition);
    },
    
    updatePanelVisibility: function() {
      if (this.panelContainer) {
        if (this.showPanel && this.windows.size > 0) {
          this.panelContainer.style.display = 'block';
          this.panelContainer.style.top = this.panelPosition.top + 'px';
          this.panelContainer.style.left = this.panelPosition.left + 'px';
          this.renderPanelContent();
        } else {
          this.panelContainer.style.display = 'none';
        }
      }
    },
    
    renderPanelContent: function() {
      if (!this.panelContainer) return;
      
      var windowsList = this.getAllWindows();
      
      this.panelContainer.innerHTML = '';
      
      // 创建面板DOM
      var panel = document.createElement('div');
      panel.style.cssText = `
        background: rgba(255, 255, 255, 0.98);
        backdrop-filter: blur(10px);
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(102, 126, 234, 0.3);
        min-width: 280px;
        max-height: 300px;
        overflow: auto;
        padding: 12px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      `;
      
      // 标题栏
      var header = document.createElement('div');
      header.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 2px solid #667eea;
      `;
      header.innerHTML = `
        <span style="font-size: 14px; font-weight: 700; color: #667eea;">
          🪟 窗口管理器 (${windowsList.length})
        </span>
        <button id="close-panel-btn" style="
          background: none;
          border: none;
          color: #999;
          cursor: pointer;
          font-size: 16px;
          font-weight: bold;
          padding: 0 4px;
        ">×</button>
      `;
      panel.appendChild(header);
      
      // 关闭按钮事件
      header.querySelector('#close-panel-btn').addEventListener('click', () => {
        this.showPanel = false;
        this.updatePanelVisibility();
      });
      
      // 窗口列表
      if (windowsList.length > 0) {
        windowsList.forEach(win => {
          var isCurrentWin = win.id === this.currentWindowId;
          
          var item = document.createElement('div');
          item.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 10px;
            margin-bottom: 6px;
            border-radius: 6px;
            background: ${isCurrentWin ? 'linear-gradient(135deg, #667eea20, #764ba220)' : '#f8f9fa'};
            border: ${isCurrentWin ? '2px solid #667eea' : '1px solid #e9ecef'};
            cursor: pointer;
            transition: all 0.2s ease;
            opacity: ${isCurrentWin ? 1 : 0.85};
          `;
          item.innerHTML = `
            <div style="flex: 1; overflow: hidden;">
              <div style="font-size: 13px; font-weight: 600; color: #333; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-bottom: 2px;">
                ${isCurrentWin ? '✅ ' : '   '}${this.escapeHtml(win.title)}
              </div>
              <div style="font-size: 11px; color: #888; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${this.escapeHtml(win.sourceFile || '未知来源')}
              </div>
            </div>
            <button class="bring-to-front-btn" data-window-id="${win.id}" style="
              background: ${isCurrentWin ? '#667eea' : '#e9ecef'};
              border: none;
              color: ${isCurrentWin ? 'white' : '#666'};
              cursor: pointer;
              padding: 4px 10px;
              border-radius: 4px;
              font-size: 11px;
              font-weight: 600;
              margin-left: 8px;
              transition: all 0.2s ease;
            ">${isCurrentWin ? '当前' : '置顶'}</button>
          `;
          
          // 点击整个项或按钮都触发置顶
          item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('bring-to-front-btn')) {
              this.bringToFront(win.id);
            }
          });
          
          item.querySelector('.bring-to-front-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.bringToFront(win.id);
          });
          
          // Hover效果
          item.addEventListener('mouseenter', () => {
            if (!isCurrentWin) {
              item.style.background = '#e9ecef';
              item.style.transform = 'translateX(2px)';
            }
          });
          item.addEventListener('mouseleave', () => {
            if (!isCurrentWin) {
              item.style.background = '#f8f9fa';
              item.style.transform = 'translateX(0)';
            }
          });
          
          panel.appendChild(item);
        });
      } else {
        var emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = `
          text-align: center;
          padding: 20px;
          color: #999;
          font-size: 13px;
        `;
        emptyMsg.textContent = '暂无其他打开的窗口';
        panel.appendChild(emptyMsg);
      }
      
      this.panelContainer.appendChild(panel);
    },
    
    escapeHtml: function(text) {
      var div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    },
    
    setCurrentWindowId: function(id) {
      this.currentWindowId = id;
      // 更新面板内容以反映当前窗口变化
      if (this.showPanel) {
        this.renderPanelContent();
      }
    },

    bringToFront: function(id) {
      var win = this.windows.get(id);
      if (win && win.instance && win.instance.bringToFrontRef) {
        win.instance.bringToFrontRef();
        console.log('[WindowManager] 🔄 切换到前台:', win.title);
        
        // 延迟关闭面板，让用户看到效果
        setTimeout(() => {
          this.showPanel = false;
          this.updatePanelVisibility();
        }, 200);
      }
    },

    getAllWindows: function() {
      return Array.from(this.windows.values()).sort(function(a, b) {
        return a.order - b.order;
      });
    },

    getCount: function() {
      return this.windows.size;
    }
  };

  // 暴露到全局，方便调试
  window.FloatingWindowManager = WindowManager;

  function getAnimationByName(name) {
    return CLOSE_ANIMATIONS.find(function(a) { return a.name === name; }) || CLOSE_ANIMATIONS[0];
  }

  // ===== 工具函数 =====
  function getWindowSize() {
    return {
      width: window.innerWidth || document.documentElement.clientWidth,
      height: window.innerHeight || document.documentElement.clientHeight
    };
  }

  function centerPosition(elementWidth, elementHeight) {
    var win = getWindowSize();
    return {
      left: Math.max(0, (win.width - elementWidth) / 2),
      top: Math.max(0, (win.height - elementHeight) / 2)
    };
  }

  // ===== 主组件 =====
  function FloatingWindowReact(props) {
    var _useState1 = useState(true),   // ✅ 改为 true：默认显示
      isVisible = _useState1[0],
      setIsVisible = _useState1[1];

    var _useState2 = useState(function() {
      // 初始化时就计算一个合理的默认位置
      // 避免首次渲染时 position 为 null 导致的拖拽问题
      var win = getWindowSize();
      var w = typeof width === 'number' ? width : parseInt(width) || 700;
      var h = typeof height === 'number' ? height : parseInt(height) || 600;
      return {
        left: Math.max(0, (win.width - w) / 2),
        top: Math.max(0, (win.height - h) / 2)
      };
    }),
      position = _useState2[0],
      setPosition = _useState2[1];

    var _useState3 = useState(false),
      isClosing = _useState3[0],
      setIsClosing = _useState3[1];

    var _useState4 = useState(''),
      animationClass = _useState4[0],
      setAnimationClass = _useState4[1];

    var _useState5 = useState(999999),
      zIndex = _useState5[0],
      setZIndex = _useState5[1];

    var containerRef = useRef(null);
    var isDraggingRef = useRef(false);
    var offsetRef = useRef({ x: 0, y: 0 });
    var managerBtnRef = useRef(null);
    
    // 生成唯一 ID 用于 WindowManager 注册
    var windowId = useRef('fw-react-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

    var title = props.title || '悬浮视窗';
    var width = props.width || '400px';
    var height = props.height || '600px';
    var draggable = props.draggable !== false; // 默认可拖拽
    var closeAnimation = props.closeAnimation || 'random';
    var sourceFile = props.sourceFile || '';
    var onClose = props.onClose || function() {};
    var onShow = props.onShow || function() {};
    var onHide = props.onHide || function() {};
    var headerRight = props.headerRight;
    var children = props.children;

    // 显示窗口
    var show = useCallback(function() {
      if (!containerRef.current) return;

      setIsVisible(true);
      setIsClosing(false);
      setAnimationClass('');

      requestAnimationFrame(function() {
        var rect = containerRef.current.getBoundingClientRect();
        var pos = centerPosition(rect.width, rect.height);
        setPosition(pos);

        if (onShow) onShow();
      });
    }, [onShow]);

    // 隐藏窗口（带动画）
    var hide = useCallback(function() {
      if (!containerRef.current || !isVisible) return;

      var anim = closeAnimation === 'random'
        ? CLOSE_ANIMATIONS[Math.floor(Math.random() * CLOSE_ANIMATIONS.length)]
        : getAnimationByName(closeAnimation);

      console.log('[FW-React] 播放关闭动画:', anim.description);

      setIsClosing(true);
      setAnimationClass('fw-closing-' + anim.name);

      setTimeout(function() {
        setIsVisible(false);
        setIsClosing(false);
        setAnimationClass('');

        if (onHide) onHide();
      }, anim.duration);
    }, [isVisible, closeAnimation, onHide]);

    // 首次挂载时自动居中（同步执行，避免拖拽时 position 为 null）
    useEffect(function() {
      if (containerRef.current) {
        // 设置初始 z-index 到 DOM
        containerRef.current.style.zIndex = zIndex;
        
        // 由于 useState 初始化时已经设置了默认位置，这里只需要微调
        // 使用 requestAnimationFrame 确保 DOM 完全渲染后再精确调整
        requestAnimationFrame(function() {
          if (!containerRef.current) return;
          
          var rect = containerRef.current.getBoundingClientRect();
          var pos = centerPosition(rect.width, rect.height);
          
          console.log('[FW-React] 精确调整位置:', {
            当前位置: position,
            新位置: pos,
            元素尺寸: { width: rect.width, height: rect.height }
          });
          
          setPosition(pos);

          // 新打开的窗口自动置于最顶层
          bringToFront();

          if (onShow) onShow();
        });
      }
    }, []); // 只执行一次

    // 监听 zIndex 变化，同步到 DOM
    useEffect(function() {
      if (containerRef.current) {
        containerRef.current.style.zIndex = zIndex;
      }
    }, [zIndex]);

    // 注册/注销到全局窗口管理器
    useEffect(function() {
      // 创建实例引用对象，供外部调用
      var instanceRef = {
        props: props,
        bringToFrontRef: null  // 将在下面赋值
      };

      // 注册到 WindowManager
      WindowManager.register(windowId.current, instanceRef);

      // 返回清理函数（组件卸载时注销）
      return function() {
        WindowManager.unregister(windowId.current);
      };
    }, []);

    // 切换管理面板显示状态（调用全局面板）
    var toggleManagerPanel = useCallback(function(e) {
      e.stopPropagation(); // 阻止事件冒泡，避免触发窗口置顶
      
      // 设置当前窗口ID
      WindowManager.setCurrentWindowId(windowId.current);
      
      // 调用全局面板切换
      WindowManager.togglePanel(e.currentTarget);
    }, []);

    // 关闭按钮处理
    var handleClose = useCallback(function() {
      hide();
      if (onClose) onClose();
    }, [hide, onClose]);

    // 将窗口置于最顶层
    var bringToFront = useCallback(function() {
      currentMaxZIndex++;
      
      // 立即更新状态（用于 React 渲染）
      setZIndex(currentMaxZIndex);
      
      // 同时直接操作 DOM（确保即时生效，避免 React 异步更新的延迟）
      if (containerRef.current) {
        containerRef.current.style.zIndex = currentMaxZIndex;
      }
      
      console.log('[FW-React] "' + title + '" z-index 提升至:', currentMaxZIndex);
    }, [title]);

    // 暴露给外部的引用（供 WindowManager 调用）
    var bringToFrontRef = bringToFront;

    // 更新 WindowManager 中的实例引用
    useEffect(function() {
      if (windowId.current) {
        var win = WindowManager.windows.get(windowId.current);
        if (win) {
          win.instance.bringToFrontRef = bringToFront;
          win.title = title;
          win.sourceFile = sourceFile;
        }
        
        // 更新当前窗口ID
        WindowManager.setCurrentWindowId(windowId.current);
      }
    }, [bringToFront, title, sourceFile]);

    // 整个窗口点击时置顶（排除关闭按钮）
    var handleWindowMouseDown = useCallback(function(e) {
      // 排除关闭按钮的点击
      if (e.target.closest('.floating-close-btn')) return;

      // 点击窗口任意位置时置于最顶层
      bringToFront();
    }, [bringToFront]);

    // 拖拽相关
    var handleMouseDown = useCallback(function(e) {
      if (!draggable || e.button !== 0) return;

      e.preventDefault();
      isDraggingRef.current = true;

      // 点击标题栏时将窗口置于最顶层
      bringToFront();

      var rect = containerRef.current.getBoundingClientRect();
      offsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      document.body.style.userSelect = 'none'; // 防止选中文本
    }, [draggable, position, bringToFront]);

    var handleMouseMove = useCallback(function(e) {
      if (!isDraggingRef.current) return;

      var x = e.clientX - offsetRef.current.x;
      var y = e.clientY - offsetRef.current.y;

      setPosition({ left: x, top: y });
    }, []);

    var handleMouseUp = useCallback(function() {
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      document.body.style.userSelect = '';
    }, []);

    // 触摸事件
    var handleTouchStart = useCallback(function(e) {
      if (!draggable || e.touches.length !== 1) return;

      e.preventDefault();
      isDraggingRef.current = true;

      var touch = e.touches[0];
      var rect = containerRef.current.getBoundingClientRect();
      offsetRef.current = {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }, [draggable]);

    var handleTouchMove = useCallback(function(e) {
      if (!isDraggingRef.current || e.touches.length !== 1) return;

      e.preventDefault();

      var touch = e.touches[0];
      var x = touch.clientX - offsetRef.current.x;
      var y = touch.clientY - offsetRef.current.y;

      setPosition({ left: x, top: y });
    }, []);

    var handleTouchEnd = useCallback(function() {
      isDraggingRef.current = false;
    }, []);

    // 全局鼠标/触摸事件监听
    useEffect(function() {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      document.addEventListener('touchcancel', handleTouchEnd);

      return function() {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
        document.removeEventListener('touchcancel', handleTouchEnd);
      };
    }, [handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

    // 标题显示（带源文件名）
    var displayTitle = sourceFile
      ? title + ' (' + sourceFile + ')'
      : title;

    // 如果不可见，返回 null（不渲染）
    if (!isVisible && !isClosing) {
      return null;
    }

    // 计算样式
    var windowStyle = {
      position: 'fixed',
      width: width,
      height: height,
      zIndex: zIndex,  // 使用动态的 z-index
      overflow: 'hidden',
      opacity: isClosing ? '0' : '1',
      visibility: 'visible',
      left: position ? position.left : '50%',
      top: position ? position.top : '50%',
      transform: position ? 'none' : 'translate(-50%, -50%)',
      transition: isClosing ? ('all ' + (getAnimationByName(closeAnimation).duration) + 'ms ease') : 'none'
    };

    // 合并自定义样式
    if (props.style) {
      Object.assign(windowStyle, props.style);
    }

    return createElement('div', {
      ref: containerRef,
      className: 'floating-window floating-window-react' + (animationClass ? ' ' + animationClass : ''),
      style: windowStyle,
      onMouseDown: handleWindowMouseDown
    },
      // 内容容器 - 复用原版CSS类名
      createElement('div', {
        className: 'floating-content',
        style: {
          display: 'flex',
          flexDirection: 'column',
          height: '100%'
        }
      },

        // 标题栏 - 复用原版CSS类名
        createElement('div', {
          className: 'floating-header',
          style: {
            display: 'flex',
            alignItems: 'center',
            padding: '8.4px 16px',
            background: 'linear-gradient(135deg,#d0e8ff,#a8c8ff)',
            color: '#0369a1',
            flexShrink: 0,
            cursor: draggable ? 'grab' : 'default',
            userSelect: 'none',
            touchAction: draggable ? 'none' : 'auto',
            position: 'relative'
          },
          onMouseDown: handleMouseDown,
          onTouchStart: handleTouchStart
        },

          // 左侧区域（关闭按钮）
          createElement('div', {
            className: 'floating-header-left',
            style: {
              position: 'absolute',
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1
            }
          },
            createElement('button', {
              className: 'floating-close-btn',
              onClick: handleClose,
              style: {}
            }, '×')
          ),

          // 标题文字
          createElement('h3', {
            className: 'floating-title',
            style: {
              margin: 0,
              fontSize: '16px',
              fontWeight: 600,
              lineHeight: '1',
              paddingLeft: '40px',
              paddingRight: '120px',  // 为关闭按钮 + 管理按钮留出空间
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }
          }, displayTitle),

          // 右侧自定义区域
          headerRight && createElement('div', {
            className: 'floating-header-right',
            style: {
              position: 'absolute',
              right: '50px',  // 留出空间给管理按钮
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1
            }
          }, headerRight),

          // 窗口管理按钮 🪟
          createElement('button', {
            ref: managerBtnRef,
            className: 'floating-window-manager-btn',
            onClick: toggleManagerPanel,
            title: '窗口管理器 (' + WindowManager.getCount() + ' 个窗口)',
            style: {
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              boxShadow: '0 2px 8px rgba(102, 126, 234, 0.3)',
              transition: 'all 0.2s ease',
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minWidth: '32px',
              height: '24px',
              lineHeight: '1'
            }
          }, '🪟 ' + WindowManager.getCount())
        ),

        // 内容区 - 复用原版CSS类名
        createElement('div', {
          className: 'floating-body',
          style: {
            padding: '0',
            overflow: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0'
          }
        }, children)
      )
    );
  }

  // ===== 导出 =====
  window.FloatingWindowReact = FloatingWindowReact;

  console.log('[FW-React] FloatingWindowReact 组件已加载');
  console.log('[FW-React] 支持的关闭动画:', CLOSE_ANIMATIONS.map(function(a) { return a.name; }).join(', '));
  console.log('[FW-React] ✅ 窗口管理器已启用 - 可通过 window.FloatingWindowManager 访问');

})();
