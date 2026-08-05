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
    updateCallbacks: [],  // 用于通知更新的回调函数列表
    
    // 全局面板状态
    showPanel: false,
    panelPosition: { top: 0, left: 0 },
    panelContainer: null,
    triggerButton: null,  // 保存触发按钮的引用，用于跟随窗口移动

    // 注册更新回调（用于 React 组件响应窗口数量变化）
    registerUpdateCallback: function(callback) {
      this.updateCallbacks.push(callback);
    },
    
    // 注销更新回调
    unregisterUpdateCallback: function(callback) {
      var index = this.updateCallbacks.indexOf(callback);
      if (index > -1) {
        this.updateCallbacks.splice(index, 1);
      }
    },
    
    // 通知所有回调更新
    notifyUpdate: function() {
      for (var i = 0; i < this.updateCallbacks.length; i++) {
        try {
          this.updateCallbacks[i]();
        } catch(e) {
          console.error('[WindowManager] 更新回调执行失败:', e);
        }
      }
    },

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
      
      // 通知更新
      this.notifyUpdate();
      
      // 确保面板容器存在
      this.ensurePanelContainer();
    },

    unregister: function(id) {
      if (this.windows.has(id)) {
        this.windows.delete(id);
        console.log('[WindowManager] ❌ 注销窗口:', id, '(剩余:', this.windows.size, ')');
        
        // 通知更新
        this.notifyUpdate();
        
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
    
    // 计算面板位置（根据按钮位置）
    calculatePanelPosition: function(buttonElement) {
      if (!buttonElement) return null;
      
      var rect = buttonElement.getBoundingClientRect();
      
      // 智能定位：确保面板完全在屏幕内
      var panelWidth = 300;
      var panelHeight = 320;
      var viewportWidth = window.innerWidth;
      var viewportHeight = window.innerHeight;
      
      // 计算初始位置（按钮下方，面板向左展开：右边缘对齐按钮右边缘）
      var top = rect.bottom + window.scrollY + 4;
      var left = rect.right - panelWidth + window.scrollX;
      
      // 边界检测和调整
      // 如果左侧超出屏幕，向右调整
      if (left < 10) {
        left = 10;
      }
      // 如果右侧超出屏幕，向左调整
      if (left + panelWidth > viewportWidth) {
        left = viewportWidth - panelWidth - 10;
      }
      // 如果底部超出屏幕，显示在按钮上方
      if (top + panelHeight > viewportHeight + window.scrollY) {
        top = rect.top + window.scrollY - panelHeight - 4;
      }
      // 如果顶部超出屏幕，显示在视窗顶部
      if (top < window.scrollY) {
        top = window.scrollY + 10;
      }
      
      return { top: top, left: left };
    },
    
    togglePanel: function(buttonElement) {
      // 保存按钮引用，用于后续跟随窗口移动
      if (buttonElement) {
        this.triggerButton = buttonElement;
      }
      
      // 计算面板位置
      var position = this.calculatePanelPosition(this.triggerButton);
      if (position) {
        this.panelPosition = position;
      }
      
      this.showPanel = !this.showPanel;
      this.updatePanelVisibility();
      
      console.log('[WindowManager] 🔄 切换面板:', this.showPanel ? '显示' : '隐藏', '位置:', this.panelPosition);
    },
    
    // 更新面板位置（跟随窗口移动时调用）
    updatePanelPosition: function() {
      // 只有面板显示时才更新位置
      if (!this.showPanel || !this.triggerButton) return;
      
      var position = this.calculatePanelPosition(this.triggerButton);
      if (position) {
        this.panelPosition = position;
        // 直接更新 DOM 位置，避免重新渲染
        if (this.panelContainer) {
          this.panelContainer.style.top = this.panelPosition.top + 'px';
          this.panelContainer.style.left = this.panelPosition.left + 'px';
        }
      }
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
      var w, h;
      if (typeof props.width === 'number') {
        w = props.width;
      } else if (typeof props.width === 'string' && props.width.indexOf('%') !== -1) {
        w = Math.floor(win.width * (parseFloat(props.width) / 100));
      } else if (typeof props.width === 'string') {
        w = parseInt(props.width) || Math.floor(win.width * 0.9);
      } else {
        w = Math.floor(win.width * 0.9);
      }
      if (typeof props.height === 'number') {
        h = props.height;
      } else if (typeof props.height === 'string' && props.height.indexOf('%') !== -1) {
        h = Math.floor(win.height * (parseFloat(props.height) / 100));
      } else if (typeof props.height === 'string') {
        h = parseInt(props.height) || Math.floor(win.height * 0.9);
      } else {
        h = Math.floor(win.height * 0.9);
      }
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
      
    var _useState6 = useState(WindowManager.getCount()),
      windowCount = _useState6[0],
      setWindowCount = _useState6[1];

    var _useState7 = useState(false),
      isMinimized = _useState7[0],
      setIsMinimized = _useState7[1];

    var _useState8 = useState(function() {
      var win = getWindowSize();
      var w;
      if (typeof props.width === 'number') {
        w = props.width;
      } else if (typeof props.width === 'string' && props.width.indexOf('%') !== -1) {
        w = Math.floor(win.width * (parseFloat(props.width) / 100));
      } else if (typeof props.width === 'string') {
        w = parseInt(props.width) || Math.floor(win.width * 0.9);
      } else {
        w = Math.floor(win.width * 0.9);
      }
      return w;
    }),
      windowWidth = _useState8[0],
      setWindowWidth = _useState8[1];

    var _useState9 = useState(function() {
      var win = getWindowSize();
      var h;
      if (typeof props.height === 'number') {
        h = props.height;
      } else if (typeof props.height === 'string' && props.height.indexOf('%') !== -1) {
        h = Math.floor(win.height * (parseFloat(props.height) / 100));
      } else if (typeof props.height === 'string') {
        h = parseInt(props.height) || Math.floor(win.height * 0.9);
      } else {
        h = Math.floor(win.height * 0.9);
      }
      return h;
    }),
      windowHeight = _useState9[0],
      setWindowHeight = _useState9[1];

    var containerRef = useRef(null);
    var isDraggingRef = useRef(false);
    var offsetRef = useRef({ x: 0, y: 0 });
    var isResizingRef = useRef(false);
    var resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
    var managerBtnRef = useRef(null);
    
    // 生成唯一 ID 用于 WindowManager 注册
    var windowId = useRef('fw-react-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9));

    var title = props.title || '悬浮视窗';
    var draggable = props.draggable !== false; // 默认可拖拽
    var resizable = props.resizable !== false; // 默认可调整大小
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
      
      // 注册更新回调，用于响应窗口数量变化（先注册！）
      var updateCallback = function() {
        setWindowCount(WindowManager.getCount());
      };
      WindowManager.registerUpdateCallback(updateCallback);

      // 注册到 WindowManager
      WindowManager.register(windowId.current, instanceRef);
      
      // 立即同步一次当前窗口数量（确保新窗口能正确显示）
      setWindowCount(WindowManager.getCount());

      // 返回清理函数（组件卸载时注销）
      return function() {
        WindowManager.unregister(windowId.current);
        WindowManager.unregisterUpdateCallback(updateCallback);
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
      // 播放关闭动画
      var anim = closeAnimation === 'random'
        ? CLOSE_ANIMATIONS[Math.floor(Math.random() * CLOSE_ANIMATIONS.length)]
        : getAnimationByName(closeAnimation);

      console.log('[FW-React] 播放关闭动画:', anim.description);

      setIsClosing(true);
      setAnimationClass('fw-closing-' + anim.name);

      // 动画结束后，通过 props.onClose 通知外部清理
      setTimeout(function() {
        setIsVisible(false);
        setIsClosing(false);
        setAnimationClass('');

        if (onHide) onHide();
        if (onClose) onClose();
      }, anim.duration);
    }, [closeAnimation, onHide, onClose]);

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

      // 🔧 修復：優先使用 position state（像素值），避免 getBoundingClientRect() 與 transform 衝突
      var currentLeft, currentTop;
      if (position && position.left && position.top) {
        // 如果已有像素位置，直接使用（最準確）
        currentLeft = typeof position.left === 'number' ? position.left : parseFloat(position.left);
        currentTop = typeof position.top === 'number' ? position.top : parseFloat(position.top);
      } else {
        // 否則使用 getBoundingClientRect() 作為降級方案
        var rect = containerRef.current.getBoundingClientRect();
        currentLeft = rect.left;
        currentTop = rect.top;
        // 同步更新 position state，避免後續跳變
        setPosition({ left: currentLeft, top: currentTop });
      }

      offsetRef.current = {
        x: e.clientX - currentLeft,
        y: e.clientY - currentTop
      };

      document.body.style.userSelect = 'none'; // 防止选中文本
    }, [draggable, position, bringToFront, setPosition]);

    // 触摸事件
    var handleTouchStart = useCallback(function(e) {
      if (!draggable || e.touches.length !== 1) return;

      e.preventDefault();
      isDraggingRef.current = true;

      var touch = e.touches[0];

      // 🔧 修復：與 handleMouseDown 保持一致的坐標計算邏輯
      var currentLeft, currentTop;
      if (position && position.left && position.top) {
        currentLeft = typeof position.left === 'number' ? position.left : parseFloat(position.left);
        currentTop = typeof position.top === 'number' ? position.top : parseFloat(position.top);
      } else {
        var rect = containerRef.current.getBoundingClientRect();
        currentLeft = rect.left;
        currentTop = rect.top;
        setPosition({ left: currentLeft, top: currentTop });
      }

      offsetRef.current = {
        x: touch.clientX - currentLeft,
        y: touch.clientY - currentTop
      };
    }, [draggable, position, setPosition]);

    // 调整大小相关
    var handleResizeMouseDown = useCallback(function(e) {
      if (!resizable) return;
      e.preventDefault();
      e.stopPropagation();
      isResizingRef.current = true;
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: windowWidth,
        height: windowHeight
      };
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'nwse-resize';
      bringToFront();
    }, [resizable, windowWidth, windowHeight, bringToFront]);

    var handleResizeTouchStart = useCallback(function(e) {
      if (!resizable || e.touches.length !== 1) return;
      e.preventDefault();
      e.stopPropagation();
      var touch = e.touches[0];
      isResizingRef.current = true;
      resizeStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        width: windowWidth,
        height: windowHeight
      };
      bringToFront();
    }, [resizable, windowWidth, windowHeight, bringToFront]);

    // 修改现有的 move/up 处理函数，整合调整大小逻辑
    var handleMouseMove = useCallback(function(e) {
      if (isResizingRef.current) {
        var dx = e.clientX - resizeStartRef.current.x;
        var dy = e.clientY - resizeStartRef.current.y;
        setWindowWidth(Math.max(200, resizeStartRef.current.width + dx));
        setWindowHeight(Math.max(150, resizeStartRef.current.height + dy));
        return;
      }
      if (!isDraggingRef.current) return;

      var x = e.clientX - offsetRef.current.x;
      var y = e.clientY - offsetRef.current.y;

      setPosition({ left: x, top: y });
      
      // 拖拽时更新面板位置，让面板跟随窗口移动
      WindowManager.updatePanelPosition();
    }, []);

    var handleMouseUp = useCallback(function() {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        return;
      }
      if (!isDraggingRef.current) return;

      isDraggingRef.current = false;
      document.body.style.userSelect = '';
    }, []);

    var handleTouchMove = useCallback(function(e) {
      if (isResizingRef.current) {
        if (e.touches.length !== 1) return;
        e.preventDefault();
        var touch = e.touches[0];
        var dx = touch.clientX - resizeStartRef.current.x;
        var dy = touch.clientY - resizeStartRef.current.y;
        setWindowWidth(Math.max(200, resizeStartRef.current.width + dx));
        setWindowHeight(Math.max(150, resizeStartRef.current.height + dy));
        return;
      }
      if (!isDraggingRef.current || e.touches.length !== 1) return;

      e.preventDefault();

      var touch = e.touches[0];
      var x = touch.clientX - offsetRef.current.x;
      var y = touch.clientY - offsetRef.current.y;

      setPosition({ left: x, top: y });
      
      // 触摸拖拽时也更新面板位置
      WindowManager.updatePanelPosition();
    }, []);

    var handleTouchEnd = useCallback(function() {
      if (isResizingRef.current) {
        isResizingRef.current = false;
        return;
      }
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

    // ===== 🆕 监听浏览器窗口大小变化（确保浮动窗口不超过浏览器视窗） =====
    useEffect(function() {
      var resizeTimer = null;

      var handleWindowResize = function() {
        // 节流：避免频繁触发
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
          if (!containerRef.current) return;

          var win = getWindowSize();

          // 1️⃣ 根据 props 重新计算尺寸
          var newWidth, newHeight;
          if (typeof props.width === 'number') {
            newWidth = props.width;
          } else if (typeof props.width === 'string' && props.width.indexOf('%') !== -1) {
            newWidth = Math.floor(win.width * (parseFloat(props.width) / 100));
          } else if (typeof props.width === 'string') {
            newWidth = parseInt(props.width) || Math.floor(win.width * 0.9);
          } else {
            newWidth = Math.floor(win.width * 0.9);
          }
          if (typeof props.height === 'number') {
            newHeight = props.height;
          } else if (typeof props.height === 'string' && props.height.indexOf('%') !== -1) {
            newHeight = Math.floor(win.height * (parseFloat(props.height) / 100));
          } else if (typeof props.height === 'string') {
            newHeight = parseInt(props.height) || Math.floor(win.height * 0.9);
          } else {
            newHeight = Math.floor(win.height * 0.9);
          }

          // 2️⃣ 确保尺寸不超过视窗（留 20px 边距）
          var maxWidth = Math.max(200, win.width - 20);
          var maxHeight = Math.max(150, win.height - 20);
          newWidth = Math.min(newWidth, maxWidth);
          newHeight = Math.min(newHeight, maxHeight);

          // 3️⃣ 更新尺寸状态
          setWindowWidth(newWidth);
          setWindowHeight(newHeight);

          // 4️⃣ 调整位置：确保窗口完全在视窗内
          var currentLeft = position ? (typeof position.left === 'number' ? position.left : parseFloat(position.left) || 0) : 0;
          var currentTop = position ? (typeof position.top === 'number' ? position.top : parseFloat(position.top) || 0) : 0;

          // 如果窗口超出右边界，向左调整
          if (currentLeft + newWidth > win.width) {
            currentLeft = Math.max(0, win.width - newWidth);
          }
          // 如果窗口超出下边界，向上调整
          if (currentTop + newHeight > win.height) {
            currentTop = Math.max(0, win.height - newHeight);
          }

          // 如果窗口超出左边界，向右调整
          if (currentLeft < 0) {
            currentLeft = 0;
          }
          // 如果窗口超出上边界，向下调整
          if (currentTop < 0) {
            currentTop = 0;
          }

          setPosition({ left: currentLeft, top: currentTop });

          // 5️⃣ 同步更新 DOM（确保即时生效）
          if (containerRef.current) {
            containerRef.current.style.left = currentLeft + 'px';
            containerRef.current.style.top = currentTop + 'px';
            containerRef.current.style.width = newWidth + 'px';
            containerRef.current.style.height = newHeight + 'px';
          }
        }, 100); // 100ms 节流
      };

      window.addEventListener('resize', handleWindowResize);

      return function() {
        window.removeEventListener('resize', handleWindowResize);
        if (resizeTimer) clearTimeout(resizeTimer);
      };
    }, [props.width, props.height, position, windowWidth, windowHeight, setWindowWidth, setWindowHeight, setPosition]);

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
      width: isMinimized ? '300px' : (windowWidth + 'px'),  // 最小化时缩小宽度
      height: isMinimized ? '44px' : (windowHeight + 'px'),  // 最小化时只显示标题栏
      zIndex: zIndex,  // 使用动态的 z-index
      overflow: 'hidden',
      opacity: isClosing ? '0' : '1',
      visibility: 'visible',
      left: position ? position.left : '50%',
      top: position ? position.top : '50%',
      transform: position ? 'none' : 'translate(-50%, -50%)',
      transition: isClosing
        ? ('all ' + (getAnimationByName(closeAnimation).duration) + 'ms ease')
        : (isMinimized ? 'all 0.3s ease' : 'none'),  // 最小化时添加过渡动画
      borderRadius: isMinimized ? '8px' : '12px',  // 最小化时圆角稍小
      boxShadow: isMinimized
        ? '0 2px 12px rgba(0, 0, 0, 0.15)'
        : '0 10px 40px rgba(0, 0, 0, 0.2)'
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

          // 左侧区域（关闭 + 最小化按钮）
          createElement('div', {
            className: 'floating-header-left',
            style: {
              position: 'absolute',
              left: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1,
              gap: '6px'
            }
          },
            // 关闭按钮
            createElement('button', {
              className: 'floating-close-btn',
              onClick: handleClose,
              style: {}
            }, '×'),
            // 最小化按钮
            createElement('button', {
              className: 'floating-minimize-btn',
              onClick: function() { setIsMinimized(!isMinimized); },
              title: isMinimized ? '还原窗口' : '最小化窗口',
              style: {
                background: isMinimized
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                border: 'none',
                color: 'white',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: 'pointer',
                width: '28px',
                height: '28px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
                lineHeight: '1',
                transition: 'all 0.2s ease',
                boxShadow: isMinimized
                  ? '0 2px 8px rgba(16, 185, 129, 0.3)'
                  : '0 2px 8px rgba(245, 158, 11, 0.3)'
              }
            }, isMinimized ? '□' : '−')
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
            title: '窗口管理器 (' + windowCount + ' 个窗口)',
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
          }, '🪟 ' + windowCount)
        ),

        // 内容区 - 复用原版CSS类名
        createElement('div', {
          className: 'floating-body',
          style: {
            padding: '0',
            overflow: isMinimized ? 'hidden' : 'auto',  // 最小化时隐藏滚动
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0',
            opacity: isMinimized ? '0' : '1',  // 最小化时透明
            visibility: isMinimized ? 'hidden' : 'visible',  // 最小化时不可见
            height: isMinimized ? '0' : 'auto',  // 最小化时高度为0
            transition: 'all 0.3s ease'
          }
        }, children)
      ),
      // 调整大小手柄
      createElement('div', {
        className: 'floating-resize-handle',
        onMouseDown: handleResizeMouseDown,
        onTouchStart: handleResizeTouchStart,
        style: {
          position: 'absolute',
          bottom: '2px',
          right: '2px',
          width: '14px',
          height: '14px',
          cursor: 'nwse-resize',
          zIndex: 10,
          display: (isMinimized || !resizable) ? 'none' : 'block',
          borderRight: '2px solid rgba(0,0,0,0.15)',
          borderBottom: '2px solid rgba(0,0,0,0.15)'
        }
      })
    );
  }

  // ===== 导出 =====
  window.FloatingWindowReact = FloatingWindowReact;

  console.log('[FW-React] FloatingWindowReact 组件已加载');
  console.log('[FW-React] 支持的关闭动画:', CLOSE_ANIMATIONS.map(function(a) { return a.name; }).join(', '));
  console.log('[FW-React] ✅ 窗口管理器已启用 - 可通过 window.FloatingWindowManager 访问');

})();
