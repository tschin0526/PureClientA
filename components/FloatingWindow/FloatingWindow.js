/**
 * 悬浮视窗组件
 * 可拖拽的悬浮视窗，支持自定义内容和样式
 */

class FloatingWindow {
  static currentMaxZIndex = 999999;

  static CLOSE_ANIMATIONS = [
    { name: 'rotate', duration: 1000, description: '旋转缩小' },
    { name: 'explode', duration: 800, description: '九宫格散开' },
    { name: 'blackhole', duration: 800, description: '黑洞吸入' },
    { name: 'fold', duration: 800, description: '折叠消失' },
    { name: 'lightning', duration: 600, description: '闪电消散' },
    { name: 'pixelate', duration: 700, description: '像素化消失' },
    { name: 'flip', duration: 700, description: '翻转消失' },
    { name: 'bounce', duration: 800, description: '弹跳消失' },
    { name: 'swirl', duration: 900, description: '漩涡消失' },
    { name: 'explosion', duration: 600, description: '爆炸粒子' },
    { name: 'wave', duration: 800, description: '波浪消失' },
    { name: 'ghost', duration: 1000, description: '幽灵消失' }
  ];

  constructor(options = {}) {
    this.options = {
      title: '悬浮视窗',
      width: '400px',
      height: '600px',
      x: '50px',
      y: '50px',
      draggable: true,
      id: `floating-window-${Date.now()}`,
      closeAnimation: 'random',
      sourceFile: '',
      ...options
    };
    
    this.element = null;
    this.isDragging = false;
    this.offsetX = 0;
    this.offsetY = 0;
    
    this.mouseDownHandler = null;
    this.mouseMoveHandler = null;
    this.mouseUpHandler = null;

    this.touchStartHandler = null;
    this.touchMoveHandler = null;
    this.touchEndHandler = null;
    
    this.init();
  }

  static getRandomAnimation() {
    const animations = FloatingWindow.CLOSE_ANIMATIONS;
    return animations[Math.floor(Math.random() * animations.length)];
  }

  static getAnimationByName(name) {
    return FloatingWindow.CLOSE_ANIMATIONS.find(a => a.name === name) || FloatingWindow.CLOSE_ANIMATIONS[0];
  }

  /**
   * 初始化组件
   */
  init() {
    this.createElement();
    this.applyStyles();
    this.setupEventListeners();
    
    // 如果提供了初始内容，自动设置
    if (this.options.content) {
      this.setContent(this.options.content);
    }
  }

  /**
   * 创建视窗元素
   */
  createElement() {
    console.log('FloatingWindow.createElement() 被调用');
    console.log('视窗ID:', this.options.id);
    console.log('视窗标题:', this.options.title);
    
    // 创建视窗容器
    this.element = document.createElement('div');
    this.element.id = this.options.id;
    this.element.className = 'floating-window';
    this.element.style.display = 'none';

    console.log('创建视窗元素:', this.element);

    // 视窗内容
    const titleWithSource = this.options.sourceFile
      ? `${this.options.title} (${this.options.sourceFile})`
      : this.options.title;

    this.element.innerHTML = `
      <div class="floating-content">
        <div class="floating-header">
          <div class="floating-header-left">
            <button class="floating-close-btn">×</button>
          </div>
          <h3 class="floating-title">${titleWithSource}</h3>
        </div>
        <div class="floating-body">
          <!-- 内容将通过setContent方法设置 -->
        </div>
      </div>
    `;

    console.log('视窗元素HTML:', this.element.innerHTML);

    // 添加到文档
    console.log('将视窗元素添加到DOM');
    console.log('添加前文档中的视窗数量:', document.querySelectorAll('.floating-window').length);
    
    document.body.appendChild(this.element);
    
    console.log('添加后视窗元素:', document.getElementById(this.options.id));
    console.log('添加后文档中的视窗数量:', document.querySelectorAll('.floating-window').length);
  }

  /**
   * 应用样式
   */
  applyStyles() {
    console.log('FloatingWindow.applyStyles() 被调用');
    console.log('视窗元素:', this.element);
    console.log('视窗宽度:', this.options.width);
    console.log('视窗高度:', this.options.height);
    console.log('视窗位置:', this.options.x, this.options.y);
    
    const style = this.element.style;
    style.position = 'fixed';
    style.width = this.options.width;
    style.height = this.options.height;
    style.zIndex = '999999';
    style.overflow = 'hidden';
    style.opacity = '1';
    style.visibility = 'visible';
    
    console.log('应用样式后的width:', style.width);
    console.log('应用样式后的height:', style.height);
    console.log('应用样式后的z-index:', style.zIndex);
    console.log('应用样式后的opacity:', style.opacity);
    console.log('应用样式后的visibility:', style.visibility);
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    // 关闭按钮事件
    const closeBtn = this.element.querySelector('.floating-close-btn');
    closeBtn.addEventListener('click', () => {
      this.hide();
      this.emit('close');
    });

    // 拖拽功能（同时支持鼠标和触摸）
    if (this.options.draggable) {
      const header = this.element.querySelector('.floating-header');

      // 设置初始光标样式
      header.style.cursor = 'grab';
      header.style.touchAction = 'none';

      // 鼠标事件
      this.mouseDownHandler = (e) => this.handleMouseDown(e, header);
      this.mouseMoveHandler = (e) => this.handleMouseMove(e);
      this.mouseUpHandler = () => this.handleMouseUp(header);

      header.addEventListener('mousedown', this.mouseDownHandler);
      document.addEventListener('mousemove', this.mouseMoveHandler);
      document.addEventListener('mouseup', this.mouseUpHandler);

      // 触摸事件（移动端支持）
      this.touchStartHandler = (e) => this.handleTouchStart(e, header);
      this.touchMoveHandler = (e) => this.handleTouchMove(e);
      this.touchEndHandler = () => this.handleTouchEnd(header);

      header.addEventListener('touchstart', this.touchStartHandler, { passive: false });
      document.addEventListener('touchmove', this.touchMoveHandler, { passive: false });
      document.addEventListener('touchend', this.touchEndHandler);
      document.addEventListener('touchcancel', this.touchEndHandler);
    } else {
      // 不可拖拽的窗口，设置头部光标为默认
      const header = this.element.querySelector('.floating-header');
      if (header) {
        header.style.cursor = 'default';
        // 不可拖拽的窗口允许正常的触摸操作
        header.style.touchAction = 'auto';
      }
      
      // 重要：不可拖拽的窗口不应该添加任何全局触摸事件监听器！
      // 否则会干扰正常的滚动行为
    }

    // 为整个窗口添加点击事件，实现"点击即置顶"
    this.element.addEventListener('mousedown', (e) => {
      // 排除关闭按钮的点击（关闭按钮有自己的处理逻辑）
      if (e.target.closest('.floating-close-btn')) return;
      
      // 点击窗口任意位置时置于最顶层
      this.bringToFront();
    });
  }

  /**
   * 处理鼠标按下事件
   * @param {MouseEvent} e - 鼠标事件
   * @param {HTMLElement} header - 头部元素
   */
  handleMouseDown(e, header) {
    // 只处理鼠标左键
    if (e.button !== 0) return;
    
    this.isDragging = true;
    
    // 点击时将窗口置于最顶层
    this.bringToFront();
    
    // 计算偏移量
    const rect = this.element.getBoundingClientRect();
    this.offsetX = e.clientX - rect.left;
    this.offsetY = e.clientY - rect.top;
    
    // 修改cursor样式
    header.style.cursor = 'grabbing';
  }

  /**
   * 处理鼠标移动事件
   * @param {MouseEvent} e - 鼠标事件
   */
  handleMouseMove(e) {
    if (this.isDragging) {
      // 计算新位置
      const x = e.clientX - this.offsetX;
      const y = e.clientY - this.offsetY;
      
      // 使用transform属性提高性能（GPU加速）
      this.element.style.transform = `translate(${x}px, ${y}px)`;
    }
  }

  /**
   * 处理鼠标释放事件
   * @param {HTMLElement} header - 头部元素
   */
  handleMouseUp(header) {
    if (this.isDragging) {
      this.isDragging = false;

      // 恢复cursor样式
      if (header) {
        header.style.cursor = 'grab';
      }
    }
  }

  /**
   * 处理触摸开始事件
   * @param {TouchEvent} e - 触摸事件
   * @param {HTMLElement} header - 头部元素
   */
  handleTouchStart(e, header) {
    if (e.touches.length !== 1) return;
    e.preventDefault();

    this.isDragging = true;

    const touch = e.touches[0];
    const rect = this.element.getBoundingClientRect();
    this.offsetX = touch.clientX - rect.left;
    this.offsetY = touch.clientY - rect.top;
  }

  /**
   * 处理触摸移动事件
   * @param {TouchEvent} e - 触摸事件
   */
  handleTouchMove(e) {
    // 只在真正拖拽时才处理
    if (!this.isDragging || e.touches.length !== 1) return;
    
    // 只在有拖拽动作时才 preventDefault，避免干扰正常滚动
    e.preventDefault();

    const touch = e.touches[0];
    const x = touch.clientX - this.offsetX;
    const y = touch.clientY - this.offsetY;

    this.element.style.transform = `translate(${x}px, ${y}px)`;
  }

  /**
   * 处理触摸结束事件
   * @param {HTMLElement} header - 头部元素
   */
  handleTouchEnd(header) {
    this.isDragging = false;
  }

  /**
   * 销毁视窗
   */
  destroy() {
    if (this.element && this.element.parentNode) {
      // 移除事件监听器
      if (this.options.draggable) {
        const header = this.element.querySelector('.floating-header');
        if (header && this.mouseDownHandler) {
          header.removeEventListener('mousedown', this.mouseDownHandler);
          header.removeEventListener('touchstart', this.touchStartHandler);
        }
        if (this.mouseMoveHandler) {
          document.removeEventListener('mousemove', this.mouseMoveHandler);
          document.removeEventListener('touchmove', this.touchMoveHandler);
        }
        if (this.mouseUpHandler) {
          document.removeEventListener('mouseup', this.mouseUpHandler);
        }
        if (this.touchEndHandler) {
          document.removeEventListener('touchend', this.touchEndHandler);
          document.removeEventListener('touchcancel', this.touchEndHandler);
        }
      }
      
      this.element.parentNode.removeChild(this.element);
      this.element = null;
      this.emit('destroy');
    }
  }

  /**
   * 设置视窗内容
   * @param {string|HTMLElement} content - 内容
   */
  setContent(content) {
    const body = this.element.querySelector('.floating-body');
    if (body) {
      if (typeof content === 'string') {
        body.innerHTML = content;
      } else if (content instanceof HTMLElement) {
        body.innerHTML = '';
        body.appendChild(content);
      }
    }
  }

  /**
   * 设置视窗标题
   * @param {string} title - 标题
   */
  setTitle(title) {
    const titleElement = this.element.querySelector('.floating-title');
    if (titleElement) {
      const titleWithSource = this.options.sourceFile
        ? `${title} (${this.options.sourceFile})`
        : title;
      titleElement.textContent = titleWithSource;
    }
  }

  /**
   * 显示视窗
   */
  show() {
    console.log('FloatingWindow.show() 被调用');
    console.log('视窗元素:', this.element);
    console.log('视窗ID:', this.options.id);
    
    if (this.element) {
      console.log('显示前的display样式:', this.element.style.display);
      this.element.style.display = 'block';
      
      // 使用 requestAnimationFrame 确保元素完全渲染后再计算居中位置
      requestAnimationFrame(() => {
        // 居中显示窗口
        const rect = this.element.getBoundingClientRect();
        const windowWidth = window.innerWidth || document.documentElement.clientWidth;
        const windowHeight = window.innerHeight || document.documentElement.clientHeight;
        const left = Math.max(0, (windowWidth - rect.width) / 2);
        const top = Math.max(0, (windowHeight - rect.height) / 2);
        
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
        this.element.style.transform = 'none';
        
        // 新打开的窗口自动置于最顶层
        this.bringToFront();
        
        console.log('显示后的display样式:', this.element.style.display);
        console.log('视窗在DOM中的位置:', document.getElementById(this.options.id));
        console.log('居中位置 - left:', left, 'top:', top);
        console.log('视窗尺寸 - width:', rect.width, 'height:', rect.height);
        console.log('视口尺寸 - width:', windowWidth, 'height:', windowHeight);
        this.emit('show');
      });
    } else {
      console.error('视窗元素不存在，无法显示');
    }
  }

  hide() {
    if (this.element) {
      let animation;
      if (this.options.closeAnimation === 'random') {
        animation = FloatingWindow.getRandomAnimation();
      } else {
        animation = FloatingWindow.getAnimationByName(this.options.closeAnimation);
      }
      
      console.log(`播放关闭动画: ${animation.description} (${animation.name})`);
      
      const animationClass = `closing-${animation.name}`;
      this.element.classList.add(animationClass);
      
      if (animation.name === 'explode') {
        const directions = [
          { x: '-150px', y: '-150px' },
          { x: '0px', y: '-200px' },
          { x: '150px', y: '-150px' },
          { x: '-200px', y: '0px' },
          { x: '200px', y: '0px' },
          { x: '-150px', y: '150px' },
          { x: '0px', y: '200px' },
          { x: '150px', y: '150px' }
        ];
        const dir = directions[Math.floor(Math.random() * directions.length)];
        this.element.style.setProperty('--explode-x', dir.x);
        this.element.style.setProperty('--explode-y', dir.y);
      }
      
      setTimeout(() => {
        this.element.style.display = 'none';
        this.element.classList.remove(animationClass);
        this.element.classList.remove('closing');
        this.element.style.opacity = '1';
        this.element.style.transform = 'none';
        this.element.style.removeProperty('--explode-x');
        this.element.style.removeProperty('--explode-y');
        this.emit('hide');
      }, animation.duration);
    }
  }



  /**
   * 触发事件
   * @param {string} eventName - 事件名称
   * @param {*} data - 事件数据
   */
  emit(eventName, data) {
    if (this.options.on && typeof this.options.on[eventName] === 'function') {
      this.options.on[eventName](data);
    }
  }

  /**
   * 将窗口置于最顶层
   * 点击或拖拽窗口时自动调用
   */
  bringToFront() {
    FloatingWindow.currentMaxZIndex++;
    this.element.style.zIndex = FloatingWindow.currentMaxZIndex;
    console.log(`[FloatingWindow] "${this.options.title}" z-index 提升至: ${FloatingWindow.currentMaxZIndex}`);
  }

  /**
   * 获取视窗元素
   * @returns {HTMLElement} 视窗元素
   */
  getElement() {
    return this.element;
  }

  /**
   * 更新样式
   * @param {Object} styles - 样式对象
   */
  updateStyles(styles) {
    if (this.element) {
      Object.assign(this.element.style, styles);
    }
  }
}

// 导出组件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FloatingWindow;
} else if (typeof window !== 'undefined') {
  window.FloatingWindow = FloatingWindow;
}
