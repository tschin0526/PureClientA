class CompactModePlugin {
  constructor() {
    this.name = 'CompactModePlugin';
    this.floatingWindow = null;
    this.initialized = false;
    this.currentViewMode = 'horizontal'; // 'horizontal' or 'vertical'
    this.bubbleScale = 1; // 气泡缩放比例
    this.historyDays = 5; // 显示的历史天数
    this.showHistoryPairedBubbles = true; // 是否显示历史数据的配对气泡
    this.historyPairedDays = ''; // 显示配对气泡的天数（空白表示全部显示）
    this.showHistoryByDate = true; // 是否显示历史数据-按日显示
    this.showHistoryBySide = true; // 是否显示历史数据-按买卖排序显示
    this.hiddenStocks = new Set(); // 被隐藏的股票名称集合
    this.collapsedMarkets = new Set(); // 被折叠的市场集合
    this.collapsedStocks = new Set(); // 被折叠的股票名称集合
    this.stockOrder = []; // 股票自定义排序
    this.stockColors = {}; // 股票自定义颜色
    this.stockNotes = {}; // 股票备注
    this.stockThresholds = {}; // 股票卖出阈值
    this.stockBuyThresholds = {}; // 股票买入阈值
    this._stockListCache = null; // 股票清单缓存（从 stockCodeManagerPlugin 获取）
    this.stockThresholdLinkage = {}; // 股票阈值联动状态
    this.stockThresholdLinkageDirection = {}; // 股票阈值联动方向 ('left-to-right' 或 'right-to-left')
    this._keyDownHandler = null; // 键盘事件处理器引用
    this._smartAddKeyNavHandler = null; // 智能保存键盘导航处理器引用
    this._smartAddSpeechTimers = []; // 智能保存语音定时器数组
    this.scaleMultiplier = 1; // 放大倍数（1=不放大）
    this.expandedStock = null; // 扩展模式下的股票名称
    this.expandedMarket = null; // 扩展模式下的市场名称
    this.expandedStockList = []; // 扩展模式下的完整股票列表
    this.expandedStockIndex = -1; // 扩展模式下当前股票的索引
    
    // 加载保存的设定
    this.loadSettings();
  }

  async _refreshStockListCache() {
    try {
      if (window.stockCodeManager && typeof window.stockCodeManager.getStockList === 'function') {
        const stocks = await window.stockCodeManager.getStockList();
        if (stocks && stocks.length > 0) {
          this._stockListCache = stocks;
          return;
        }
      }
    } catch(e) {}
    this._stockListCache = (window.STOCKS || []).map(s => ({ ...s }));
  }

  _getStockListSync() {
    if (this._stockListCache && this._stockListCache.length > 0) return this._stockListCache;
    this._stockListCache = (window.STOCKS || []).map(s => ({ ...s }));
    return this._stockListCache;
  }

  _findStockByName(name) {
    const stocks = this._getStockListSync();
    return stocks ? stocks.find(s => s.name === name) : null;
  }
  
  // 安全检查是否为特殊交易数量
  // 验证价格输入是否为有效的数字
  isValidPriceInput(priceStr) {
    if (!priceStr || typeof priceStr !== 'string') {
      return false;
    }
    
    // 去除首尾空格
    const trimmedStr = priceStr.trim();
    if (!trimmedStr) {
      return false;
    }
    
    // 检查是否包含字母或特殊字符（除了负号和小数点）
    if (/[^0-9.-]/.test(trimmedStr)) {
      return false;
    }
    
    // 检查是否有多个负号
    if (trimmedStr.split('-').length > 2) {
      return false;
    }
    
    // 检查是否有多个小数点
    if (trimmedStr.split('.').length > 2) {
      return false;
    }
    
    // 检查负号是否只在开头
    if (trimmedStr.indexOf('-') > 0) {
      return false;
    }
    
    // 检查是否为有效的数字
    const num = Number(trimmedStr);
    return !isNaN(num) && isFinite(num);
  }

  // 语音播报错误信息并显示提示
  speakErrorAndAlert(message) {
    // 先开始语音播报
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = 'zh-CN';
      window.speechSynthesis.speak(utterance);
    }
    
    // 延迟显示alert，让语音有时间开始播放
    setTimeout(() => {
      alert(message);
      // 当用户关闭alert对话框时，停止语音播报
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }, 100);
  }

  showTemporaryMessage(message) {
    if (typeof window.showTemporaryMessage === 'function') {
      window.showTemporaryMessage(message);
      return;
    }

    const existing = document.getElementById('temporaryTradeMessage');
    if (existing) existing.remove();

    const messageElement = document.createElement('div');
    messageElement.id = 'temporaryTradeMessage';
    messageElement.textContent = message;
    messageElement.style.cssText = 'position: fixed; left: 50%; top: 50%; transform: translate(-50%, -50%); padding: 18px 28px; border-radius: 8px; background: rgba(0, 0, 0, 0.78); color: #fff; font-size: 16px; z-index: 2147483647; pointer-events: none; text-align: center; white-space: pre-line;';
    document.body.appendChild(messageElement);
    setTimeout(() => messageElement.remove(), 1500);
  }

  isSpecialQty(trade, stockName) {
    try {
      if (!trade || !stockName) return false;
      const stockData = this._findStockByName(stockName);
      return stockData && trade.qty !== stockData.qty;
    } catch(e) {
      console.error('检查特殊交易数量失败:', e);
      return false;
    }
  }

  // 将颜色加深（darken by 20%）
  darkenColor(color) {
    if (!color) return null;
    // 处理 hex 颜色
    if (color.startsWith('#')) {
      let r = parseInt(color.slice(1, 3), 16);
      let g = parseInt(color.slice(3, 5), 16);
      let b = parseInt(color.slice(5, 7), 16);
      
      // 加深 20%
      r = Math.max(0, Math.floor(r * 0.8));
      g = Math.max(0, Math.floor(g * 0.8));
      b = Math.max(0, Math.floor(b * 0.8));
      
      return '#' + r.toString(16).padStart(2, '0') + g.toString(16).padStart(2, '0') + b.toString(16).padStart(2, '0');
    }
    return null;
  }

  // 获取折页符号的样式字符串
  getCornerFoldStyle(color, position) {
    const darkerColor = this.darkenColor(color);
    if (!darkerColor) return '';
    
    let style = '';
    switch(position) {
      case 'top-left':
        style = `border-top-color: ${darkerColor} !important;`;
        break;
      case 'top-right':
        style = `border-top-color: ${darkerColor} !important;`;
        break;
      case 'bottom-left':
        style = `border-bottom-color: ${darkerColor} !important;`;
        break;
      case 'bottom-right':
        style = `border-bottom-color: ${darkerColor} !important;`;
        break;
    }
    return style;
  }

  // 保存设定到 localStorage
  saveSettings() {
    const settings = {
      currentViewMode: this.currentViewMode,
      bubbleScale: this.bubbleScale,
      historyDays: this.historyDays,
      showHistoryPairedBubbles: this.showHistoryPairedBubbles,
      historyPairedDays: this.historyPairedDays,
      showHistoryByDate: this.showHistoryByDate,
      showHistoryBySide: this.showHistoryBySide,
      collapsedMarkets: Array.from(this.collapsedMarkets),
      hiddenStocks: Array.from(this.hiddenStocks),
      collapsedStocks: Array.from(this.collapsedStocks),
      stockOrder: this.stockOrder,
      stockColors: this.stockColors,
      stockNotes: this.stockNotes,
      stockThresholds: this.stockThresholds,
      stockBuyThresholds: this.stockBuyThresholds,
      stockThresholdLinkage: this.stockThresholdLinkage,
      stockThresholdLinkageDirection: this.stockThresholdLinkageDirection
    };
    try {
      localStorage.setItem('compactModeSettings', JSON.stringify(settings));
    } catch (e) {
      console.error('保存设定失败:', e);
    }
  }

  // 从 localStorage 加载设定
  loadSettings() {
    try {
      const saved = localStorage.getItem('compactModeSettings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.currentViewMode) this.currentViewMode = settings.currentViewMode;
        if (settings.bubbleScale) this.bubbleScale = settings.bubbleScale;
        if (settings.historyDays) this.historyDays = settings.historyDays;
        if (typeof settings.showHistoryPairedBubbles === 'boolean') this.showHistoryPairedBubbles = settings.showHistoryPairedBubbles;
        if (typeof settings.historyPairedDays !== 'undefined') this.historyPairedDays = settings.historyPairedDays;
        if (typeof settings.showHistoryByDate === 'boolean') this.showHistoryByDate = settings.showHistoryByDate;
        if (typeof settings.showHistoryBySide === 'boolean') this.showHistoryBySide = settings.showHistoryBySide;
        if (Array.isArray(settings.collapsedMarkets)) {
          this.collapsedMarkets = new Set(settings.collapsedMarkets);
        }
        if (Array.isArray(settings.hiddenStocks)) {
          this.hiddenStocks = new Set(settings.hiddenStocks);
        }
        if (Array.isArray(settings.collapsedStocks)) {
          this.collapsedStocks = new Set(settings.collapsedStocks);
        }
        if (Array.isArray(settings.stockOrder)) {
          this.stockOrder = settings.stockOrder;
        }
        if (settings.stockColors && typeof settings.stockColors === 'object') {
          this.stockColors = settings.stockColors;
        }
        if (settings.stockNotes && typeof settings.stockNotes === 'object') {
          this.stockNotes = settings.stockNotes;
        }
        if (settings.stockThresholds && typeof settings.stockThresholds === 'object') {
          this.stockThresholds = settings.stockThresholds;
        }
        if (settings.stockBuyThresholds && typeof settings.stockBuyThresholds === 'object') {
          this.stockBuyThresholds = settings.stockBuyThresholds;
        }
        if (settings.stockThresholdLinkage && typeof settings.stockThresholdLinkage === 'object') {
          this.stockThresholdLinkage = settings.stockThresholdLinkage;
        }
        if (settings.stockThresholdLinkageDirection && typeof settings.stockThresholdLinkageDirection === 'object') {
          this.stockThresholdLinkageDirection = settings.stockThresholdLinkageDirection;
        }
      }
    } catch (e) {
      console.error('加载设定失败:', e);
    }
  }

  // 彻底清理智能保存相关的语音播报和键盘监听器
  cleanupSmartAddSpeech() {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    
    if (this._smartAddKeyNavHandler) {
      document.removeEventListener('keydown', this._smartAddKeyNavHandler);
      this._smartAddKeyNavHandler = null;
    }
    
    if (this._smartAddSpeechTimers && this._smartAddSpeechTimers.length > 0) {
      this._smartAddSpeechTimers.forEach(timerId => clearTimeout(timerId));
      this._smartAddSpeechTimers = [];
    }
  }
  
  // 导航到上一个股票
  navigateToPrevStock() {
    if (!this.expandedStockList || this.expandedStockList.length <= 1) return;
    if (this.expandedStockIndex <= 0) return;
    
    const prevStock = this.expandedStockList[this.expandedStockIndex - 1];
    if (prevStock) {
      this.expandedStock = prevStock.stock;
      this.expandedMarket = prevStock.market;
      this.expandedStockIndex = this.expandedStockIndex - 1;
      
      // 重新渲染
      const filterDateInput = document.getElementById('filterDate');
      const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
      if (filterDate) {
        const data = this.collectData(filterDate);
        const content = this.renderCompactView(data, filterDate);
        this.floatingWindow.setContent(content);
        this.bindEvents();
        this.applyBubbleScale();
      }
    }
  }
  
  // 导航到下一个股票
  navigateToNextStock() {
    if (!this.expandedStockList || this.expandedStockList.length <= 1) return;
    if (this.expandedStockIndex >= this.expandedStockList.length - 1) return;
    
    const nextStock = this.expandedStockList[this.expandedStockIndex + 1];
    if (nextStock) {
      this.expandedStock = nextStock.stock;
      this.expandedMarket = nextStock.market;
      this.expandedStockIndex = this.expandedStockIndex + 1;
      
      // 重新渲染
      const filterDateInput = document.getElementById('filterDate');
      const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
      if (filterDate) {
        const data = this.collectData(filterDate);
        const content = this.renderCompactView(data, filterDate);
        this.floatingWindow.setContent(content);
        this.bindEvents();
        this.applyBubbleScale();
      }
    }
  }

  // 获取股票实际有交易的历史日期（按照股票自己的交易资料）
  getStockHistoryDates(stockName, market, targetDate, historyDays, trades, pairingCache, showPaired = true) {
    const stockTrades = trades.filter(t => t.stock === stockName && t.market === market);
    const stockPairing = pairingCache[stockName] || { pairedTrades: [] };
    
    const allDatesSet = new Set();
    
    stockTrades.forEach(trade => {
      // 包含当天的日期，这样当天的未配对气泡也能显示
      if (trade.date <= targetDate) {
        allDatesSet.add(trade.date);
      }
    });
    
    stockPairing.pairedTrades.forEach(pair => {
      const buyDate = pair.buy ? pair.buy.date : null;
      const sellDate = pair.sell ? pair.sell.date : null;
      const pairDate = buyDate > sellDate ? buyDate : sellDate;
      // 包含当天的日期，这样当天的未配对气泡也能显示
      if (pairDate <= targetDate) {
        allDatesSet.add(pairDate);
      }
    });
    
    let allDates = Array.from(allDatesSet).sort((a, b) => b.localeCompare(a));
    
    // 返回所有日期，不限制数量，让渲染时再筛选
    return allDates;
  }

  init() {
    if (this.initialized) return;

    console.log('紧凑模式插件初始化中...');

    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化紧凑模式插件');
      return;
    }
    this.initialized = true;
    console.log('紧凑模式插件初始化完成');
  }

  async openWindow() {
    if (!this.initialized) this.init();

    await this._refreshStockListCache();

    this.floatingWindow = new FloatingWindow({
      title: '紧凑模式',
      sourceFile: 'compactDataExportPlugin.js',
      width: '100%',
      height: '100%',
      x: '0%',
      y: '0%',
      draggable: false,
      id: 'compact-mode-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });

    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    
    let content;
    if (filterDate) {
      const data = this.collectData(filterDate);
      content = this.renderCompactView(data, filterDate);
    } else {
      content = this.generateContent();
    }
    
    this.floatingWindow.setContent(content);
    this.floatingWindow.show();
    this.bindEvents();
    this.applyBubbleScale();
  }

  // 获取今天的日期（YYYY-MM-DD 格式）
  getTodayDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  collectData(filterDate) {
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    const today = this.getTodayDate();
    
    // 检查主程序是否勾选了"只显示当天股票"
    const showOnlyFilterDateStocksCheckbox = document.getElementById('showOnlyFilterDateStocks');
    const showOnlyFilterDateStocks = showOnlyFilterDateStocksCheckbox ? showOnlyFilterDateStocksCheckbox.checked : false;
    
    const todayTrades = trades.filter(t => t.date === filterDate);
    const stockMap = new Map();
    
    todayTrades.forEach(trade => {
      if (!stockMap.has(trade.stock)) {
        stockMap.set(trade.stock, {
          stock: trade.stock,
          market: trade.market,
          buys: [],
          sells: []
        });
      }
      const stockData = stockMap.get(trade.stock);
      if (trade.side === 'buy') {
        stockData.buys.push(trade);
      } else {
        stockData.sells.push(trade);
      }
    });

    const result = [];

    // 使用 stockCodeManager 缓存的股票顺序（与 getStockList 一致）
    const allStocksOrder = this._getStockListSync();
    const stockNameOrder = allStocksOrder.map(s => s.name);
    
    if (showOnlyFilterDateStocks) {
      // 如果勾选了"只显示当天股票"，只显示当天有交易的股票，并按 ALL_STOCKS 顺序排列
      const todayStockNames = Array.from(stockMap.keys());
      // 按 ALL_STOCKS 顺序筛选和排序
      stockNameOrder.forEach(stockName => {
        if (todayStockNames.includes(stockName)) {
          const stockData = stockMap.get(stockName);
          this.processStockData(stockData, stockName, trades, pairingCache, filterDate, today, result);
        }
      });
    } else {
      // 如果没有勾选"只显示当天股票"，按 ALL_STOCKS 顺序显示有交易的股票
      if (allStocksOrder) {
        allStocksOrder.forEach(stockInfo => {
          const stockName = stockInfo.name;
          
          // 检查是否有历史交易（无论是否显示配对气泡，都要检查）
          const historyDatesWithPaired = this.getStockHistoryDates(stockName, stockInfo.market, filterDate, this.historyDays, trades, pairingCache, true);
          const historyDatesWithoutPaired = this.getStockHistoryDates(stockName, stockInfo.market, filterDate, this.historyDays, trades, pairingCache, false);
          const hasHistoryTrades = historyDatesWithPaired.length > 0 || historyDatesWithoutPaired.length > 0;
          
          const todayTrades = trades.filter(t => t.stock === stockName && t.market === stockInfo.market && t.date === filterDate);
          const hasTodayTrades = todayTrades.length > 0;
          
          const stockPairing = pairingCache[stockName] || { pairedTrades: [] };
          const hasTodayPairedTrades = (stockPairing.pairedTrades || []).some(pair => {
            const buyDate = pair.buy ? pair.buy.date : null;
            const sellDate = pair.sell ? pair.sell.date : null;
            const pairDate = buyDate > sellDate ? buyDate : sellDate;
            return pairDate === filterDate;
          });
          
          if (hasTodayPairedTrades || hasTodayTrades || hasHistoryTrades) {
            let stockData = stockMap.get(stockName);
            if (!stockData) {
              stockData = {
                stock: stockName,
                market: stockInfo.market,
                buys: [],
                sells: []
              };
            }
            this.processStockData(stockData, stockName, trades, pairingCache, filterDate, today, result);
          } else {
            result.push({
              stock: stockName,
              market: stockInfo.market,
              buys: [],
              sells: [],
              isEmpty: true
            });
          }
        });
      }
    }

    return result;
  }

  // 处理单个股票数据
  processStockData(stockData, stockName, trades, pairingCache, filterDate, today, result) {
    const stockPairing = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
    const pairedBuyIds = new Set(stockPairing.pairedBuyIds || []);
    const pairedSellIds = new Set(stockPairing.pairedSellIds || []);
    
    const unpairedBuys = stockData.buys.filter(t => !pairedBuyIds.has(t.id));
    const unpairedSells = stockData.sells.filter(t => !pairedSellIds.has(t.id));
    
    const pairedTrades = (stockPairing.pairedTrades || []).filter(pair => {
      const buyDate = pair.buy ? pair.buy.date : null;
      const sellDate = pair.sell ? pair.sell.date : null;
      return buyDate === filterDate || sellDate === filterDate;
    });

    let totalBuyQty = 0;
    let totalSellQty = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    
    unpairedBuys.forEach(t => {
      if (t.hideable !== 'Y') {
        totalBuyQty += t.qty;
        totalBuyAmount += t.price * t.qty;
      }
    });
    
    unpairedSells.forEach(t => {
      if (t.hideable !== 'Y') {
        totalSellQty += t.qty;
        totalSellAmount += t.price * t.qty;
      }
    });
    
    pairedTrades.forEach(pair => {
      if (pair.hideable !== 'Y') {
        if (pair.buy && pair.buy.date === filterDate) {
          totalBuyQty += pair.buy.qty;
          totalBuyAmount += pair.buy.price * pair.buy.qty;
        }
        if (pair.sell && pair.sell.date === filterDate) {
          totalSellQty += pair.sell.qty;
          totalSellAmount += pair.sell.price * pair.sell.qty;
        }
      }
    });

    // 找出该股票最新的交易ID
    let latestTradeId = null;
    let latestCreatedAt = null;
    trades.forEach(t => {
      if (t.stock === stockName) {
        const createdAt = t.createdAt || t.createdat || t.created_at;
        if (createdAt) {
          const createdTime = new Date(createdAt).getTime();
          if (latestCreatedAt === null || createdTime > latestCreatedAt) {
            latestCreatedAt = createdTime;
            latestTradeId = t.id;
          }
        }
      }
    });

    // 构建气泡数据
    const bubbleData = [];
    
    // 添加配对交易
    pairedTrades.forEach(pair => {
      if (pair.hideable === 'Y') return;
      
      const buyCreatedAt = pair.buy ? new Date(pair.buy.createdAt).getTime() : 0;
      const sellCreatedAt = pair.sell ? new Date(pair.sell.createdAt).getTime() : 0;
      const latestCreatedAt = Math.max(buyCreatedAt, sellCreatedAt);
      
      bubbleData.push({
        type: 'paired',
        buy: pair.buy,
        sell: pair.sell,
        timestamp: latestCreatedAt,
        isLatest: (pair.buy && pair.buy.id === latestTradeId) || (pair.sell && pair.sell.id === latestTradeId)
      });
    });
    
    // 添加未配对买入交易
    unpairedBuys.forEach(trade => {
      if (trade.hideable === 'Y') return;
      
      bubbleData.push({
        type: 'unpaired',
        trade: trade,
        timestamp: new Date(trade.createdAt).getTime(),
        isLatest: trade.id === latestTradeId
      });
    });
    
    // 添加未配对卖出交易
    unpairedSells.forEach(trade => {
      if (trade.hideable === 'Y') return;
      
      bubbleData.push({
        type: 'unpaired',
        trade: trade,
        timestamp: new Date(trade.createdAt).getTime(),
        isLatest: trade.id === latestTradeId
      });
    });
    
    // 按时间戳排序（最新的在前）
    bubbleData.sort((a, b) => {
      return b.timestamp - a.timestamp;
    });

    // 计算该股票的结存数量 - 参考买卖建议插件的方式
    let totalAllBuyQty = 0;
    let totalAllSellQty = 0;
    trades.forEach(t => {
      if (t.stock === stockName) {
        if (t.side === 'buy') {
          totalAllBuyQty += t.qty || 0;
        } else if (t.side === 'sell') {
          totalAllSellQty += t.qty || 0;
        }
      }
    });
    const stockQty = totalAllBuyQty - totalAllSellQty;

    result.push({
      stock: stockData.stock,
      market: stockData.market,
      totalBuyQty: totalBuyQty,
      totalSellQty: totalSellQty,
      totalBuyAmount: totalBuyAmount,
      totalSellAmount: totalSellAmount,
      netQty: totalBuyQty - totalSellQty,
      stockQty: stockQty,
      bubbleData: bubbleData,
      latestTradeId: latestTradeId
    });
  }

  generateContent() {
    return `
      <div class="compact-mode-container">
        <div class="compact-mode-header">
          <div class="compact-mode-title">紧凑模式</div>
          <div class="compact-mode-actions">
            <button id="viewToggleBtn" class="compact-btn">切换视图</button>
            <button id="copyToClipboardBtn" class="compact-btn">复制</button>
            <button id="exportTextBtn" class="compact-btn">导出</button>
            <button id="printBtn" class="compact-btn">打印</button>
          </div>
        </div>
        <div id="compactViewContent"></div>
      </div>
    `;
  }

  renderCompactView(data, filterDate) {
    const taiwanStocks = data.filter(s => s.market === '台股');
    const chinaStocks = data.filter(s => s.market === '陆股');
    const isVertical = this.currentViewMode === 'vertical';
    
    // 构建完整的股票列表用于导航（按 stockCodeManager 缓存顺序）
    const allStocksOrder = this._getStockListSync();
    const stockNameOrder = allStocksOrder.map(s => s.name);
    
    // 先合并台股和陆股，然后按 ALL_STOCKS 顺序排序
    // 只包含未隐藏、未折叠股票、且所在市场未折叠的股票（用于Z模式导航）
    const isTaiwanMarketCollapsed = this.collapsedMarkets.has('台股');
    const isChinaMarketCollapsed = this.collapsedMarkets.has('陆股');
    
    let allVisibleStocks = [
      ...taiwanStocks.filter(s => 
        !this.hiddenStocks.has(s.stock) && 
        !this.collapsedStocks.has(s.stock) && 
        !isTaiwanMarketCollapsed
      ),
      ...chinaStocks.filter(s => 
        !this.hiddenStocks.has(s.stock) && 
        !this.collapsedStocks.has(s.stock) && 
        !isChinaMarketCollapsed
      )
    ];
    
    // 按 ALL_STOCKS 顺序重新排列
    allVisibleStocks.sort((a, b) => {
      const indexA = stockNameOrder.indexOf(a.stock);
      const indexB = stockNameOrder.indexOf(b.stock);
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    // 保存完整的股票列表用于导航
    this.expandedStockList = allVisibleStocks;
    
    // 如果是扩展模式，只显示指定的股票
    let displayTaiwanStocks = taiwanStocks;
    let displayChinaStocks = chinaStocks;
    
    if (this.expandedStock && this.expandedMarket) {
      if (this.expandedMarket === '台股') {
        displayTaiwanStocks = taiwanStocks.filter(s => s.stock === this.expandedStock);
        displayChinaStocks = [];
      } else {
        displayTaiwanStocks = [];
        displayChinaStocks = chinaStocks.filter(s => s.stock === this.expandedStock);
      }
      
      // 更新当前股票在列表中的索引
      this.expandedStockIndex = allVisibleStocks.findIndex(s => s.stock === this.expandedStock);
    }
    
    // 计算可见的股票数量
    const visibleStocks = data.filter(s => !this.hiddenStocks.has(s.stock));
    
    // 生成被隐藏股票的下拉选项
    let hiddenStocksOptions = '';
    this.hiddenStocks.forEach(stockName => {
      hiddenStocksOptions += `<option value="${stockName}">${stockName}</option>`;
    });

    // 生成导航按钮（仅在扩展模式下显示）
    let navigationButtonsHtml = '';
    let stockSelectorHtml = '';
    
    if (this.expandedStock && this.expandedMarket && this.expandedStockList.length > 1) {
      const currentIndex = this.expandedStockIndex;
      const totalCount = this.expandedStockList.length;
      const hasPrev = currentIndex > 0;
      const hasNext = currentIndex < totalCount - 1;
      
      const prevStockName = hasPrev ? this.expandedStockList[currentIndex - 1].stock : '';
      const nextStockName = hasNext ? this.expandedStockList[currentIndex + 1].stock : '';
      
      // 筛选函数
      const filterStocks = (filterType) => {
        if (filterType === 'all') return this.expandedStockList;
        return this.expandedStockList.filter(stock => {
          if (filterType === 'china') return stock.market !== '台股';
          if (filterType === 'taiwan') return stock.market === '台股';
          return true;
        });
      };
      
      // 生成股票选择菜单选项
      let stockOptionsHtml = this.expandedStockList.map((stock, idx) => {
        const isSelected = idx === currentIndex;
        return `<option value="${idx}" ${isSelected ? 'selected' : ''}>${idx + 1}. ${stock.stock}</option>`;
      }).join('');
      
      navigationButtonsHtml = `
        <div style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); display: flex; gap: 12px; z-index: 1000; background: rgba(255,255,255,0.95); padding: 16px 24px; border-radius: 50px; box-shadow: 0 4px 20px rgba(0,0,0,0.15);">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${hasPrev ? `
              <div style="text-align: right; min-width: 100px;">
              <div style="font-size: 11px; color: #9ca3af;">上一个</div>
              <div style="font-size: 13px; font-weight: 500; color: #374151;">${prevStockName}</div>
            </div>
            ` : ''}
            <button id="prevStockBtn" style="width: 60px; height: 60px; border-radius: 50%; border: none; font-size: 28px; cursor: pointer; background: ${hasPrev ? '#3b82f6' : '#e5e7eb'}; color: ${hasPrev ? 'white' : '#9ca3af'}; ${hasPrev ? '' : 'cursor: not-allowed;'}" ${hasPrev ? '' : 'disabled'}>
              ◀
            </button>
          </div>
          
          <div id="stockIndexArea" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 140px; padding: 0 16px; cursor: pointer; user-select: none;">
            <div style="font-size: 24px; font-weight: bold; color: #374151;">${currentIndex + 1} / ${totalCount}</div>
            <div style="font-size: 16px; color: #6b7280; font-weight: 500;">${this.expandedStock}</div>
            <div style="font-size: 10px; color: #9ca3af; margin-top: 2px;">长按或双击选择</div>
          </div>
          
          <div style="display: flex; align-items: center; gap: 8px;">
            <button id="nextStockBtn" style="width: 60px; height: 60px; border-radius: 50%; border: none; font-size: 28px; cursor: pointer; background: ${hasNext ? '#3b82f6' : '#e5e7eb'}; color: ${hasNext ? 'white' : '#9ca3af'}; ${hasNext ? '' : 'cursor: not-allowed;'}" ${hasNext ? '' : 'disabled'}>
              ▶
            </button>
            ${hasNext ? `
            <div style="text-align: left; min-width: 100px;">
              <div style="font-size: 11px; color: #9ca3af;">下一个</div>
              <div style="font-size: 13px; font-weight: 500; color: #374151;">${nextStockName}</div>
            </div>
            ` : ''}
          </div>
        </div>
      `;
      
      stockSelectorHtml = `
        <div id="stockSelectorModal" style="display: none; position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; justify-content: center; align-items: center;">
          <div style="background: white; border-radius: 16px; padding: 20px; max-width: 700px; width: 95%; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
              <!-- 筛选按钮 -->
              <div style="display: flex; gap: 6px;">
                <button class="stock-filter-btn" data-filter="all" style="padding: 8px 14px; border: none; border-radius: 8px; background: #3b82f6; color: white; font-size: 13px; font-weight: 600; cursor: pointer;">全部</button>
                <button class="stock-filter-btn" data-filter="china" style="padding: 8px 14px; border: none; border-radius: 8px; background: #f3f4f6; color: #374151; font-size: 13px; font-weight: 600; cursor: pointer;">陆股</button>
                <button class="stock-filter-btn" data-filter="taiwan" style="padding: 8px 14px; border: none; border-radius: 8px; background: #f3f4f6; color: #374151; font-size: 13px; font-weight: 600; cursor: pointer;">台股</button>
              </div>
              <div style="font-size: 18px; font-weight: bold; color: #374151;">选择股票</div>
              <div style="width: 140px;"></div>
            </div>
            
            <!-- 水平滚动选择器 -->
            <div style="position: relative; overflow: hidden; border-radius: 12px;">
              <!-- 中心指示器 -->
              <div style="position: absolute; left: 50%; top: 0; bottom: 0; transform: translateX(-50%); width: 52px; background: linear-gradient(90deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.25) 50%, rgba(59,130,246,0.15) 100%); border-left: 3px solid #3b82f6; border-right: 3px solid #3b82f6; pointer-events: none; z-index: 10;"></div>
              
              <!-- 滚动容器 -->
              <div id="stockScroller" style="display: flex; gap: 3px; padding: 16px 8px; overflow-x: auto; overflow-y: hidden; -webkit-overflow-scrolling: touch; scrollbar-width: none; -ms-overflow-style: none;">
                <div style="flex-shrink: 0; width: calc(50% - 26px);"></div>
                ${this.expandedStockList.map((stock, idx) => {
                  const isTaiwan = stock.market === '台股';
                  return `
                  <div class="stock-scroller-item" data-index="${idx}" data-market="${isTaiwan ? 'taiwan' : 'china'}" style="flex-shrink: 0; min-width: 44px; max-width: 44px; padding: 5px 3px; border-radius: 8px; scroll-snap-align: center; transition: all 0.3s; background: ${idx === currentIndex ? '#3b82f6' : '#f3f4f6'}; color: ${idx === currentIndex ? 'white' : '#374151'}; border: 2px solid ${idx === currentIndex ? '#3b82f6' : 'transparent'}; text-align: center; cursor: pointer;">
                    <div style="font-size: 9px; opacity: 0.7; margin-bottom: 1px;">${idx + 1}</div>
                    <div style="font-weight: ${idx === currentIndex ? 'bold' : '600'}; font-size: 11px; line-height: 1.4; word-break: break-all; letter-spacing: 0.3px;">${stock.stock}</div>
                  </div>
                  `;
                }).join('')}
                <div style="flex-shrink: 0; width: calc(50% - 26px);"></div>
              </div>
            </div>
            
            <!-- 当前选中提示 -->
            <div id="selectedStockDisplay" style="text-align: center; margin-top: 14px; font-size: 15px; font-weight: 600; color: #374151; min-height: 48px; line-height: 1.2;">
              当前选择: <span style="font-size: 45px; font-weight: bold;">${this.expandedStock}</span>
            </div>
            
            <div style="display: flex; gap: 10px; margin-top: 16px;">
              <button id="closeStockSelector" style="flex: 1; padding: 12px; border: none; border-radius: 10px; background: #e5e7eb; color: #374151; font-size: 24px; font-weight: 600; cursor: pointer;">❌</button>
              <button id="confirmStockSelector" style="flex: 1; padding: 12px; border: none; border-radius: 10px; background: #3b82f6; color: white; font-size: 24px; font-weight: 600; cursor: pointer;">✓</button>
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="compact-mode-container">
        <div class="compact-mode-header">
          <div class="compact-mode-title">${filterDate}</div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <div class="compact-mode-date">${visibleStocks.length} 档股票</div>
            ${this.hiddenStocks.size > 0 ? `
              <select id="hiddenStocksSelect" style="padding: 2px 6px; border-radius: 4px; border: 1px solid #d1d5db; font-size: 13px; cursor: pointer; max-width: 150px;">
                <option value="">显示被屏蔽股票</option>
                ${hiddenStocksOptions}
              </select>
            ` : ''}
            <div style="display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f3f4f6; border-radius: 4px; border: 1px solid #e5e7eb;">
              <input type="checkbox" id="showHistoryPairedBubblesCheckbox" ${this.showHistoryPairedBubbles ? 'checked' : ''} style="cursor: pointer;">
              <label for="showHistoryPairedBubblesCheckbox" style="font-size: 13px; cursor: pointer; white-space: nowrap;">历史未配对气泡</label>
              <input type="number" id="historyPairedDaysInput" value="${this.historyPairedDays}" placeholder="天数" style="width: 50px; padding: 1px 4px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f3f4f6; border-radius: 4px; border: 1px solid #e5e7eb;">
              <label style="font-size: 13px; cursor: pointer; white-space: nowrap;">历史天数</label>
              <input type="number" id="historyDaysInput" value="${this.historyDays}" placeholder="天数" style="width: 50px; padding: 1px 4px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px; cursor: pointer;">
            </div>
            <div style="display: flex; align-items: center; gap: 4px; padding: 2px 6px; background: #f3f4f6; border-radius: 4px; border: 1px solid #e5e7eb;">
              <label style="font-size: 13px; cursor: pointer; white-space: nowrap;">字体缩放</label>
              <input type="number" id="bubbleScaleInput" value="${Math.round(this.bubbleScale * 100)}" placeholder="%" style="width: 50px; padding: 1px 4px; border: 1px solid #d1d5db; border-radius: 3px; font-size: 12px; cursor: pointer;">
            </div>
            <span class="view-toggle-btn" id="viewToggleBtn" style="cursor: pointer; font-size: 12px; padding: 2px 6px;">${isVertical ? '↔️' : '↕️'}</span>
          </div>
        </div>
        
        <div class="compact-mode-content">
          ${this.renderMarketSection('台股', displayTaiwanStocks, isVertical, filterDate)}
          ${this.renderMarketSection('陆股', displayChinaStocks, isVertical, filterDate)}
        </div>
        
        ${navigationButtonsHtml}
        ${stockSelectorHtml}
        
        <div class="compact-actions">
          <button class="compact-btn primary" id="copyToClipboardBtn">📋 复制</button>
          <button class="compact-btn secondary" id="exportTextBtn">📄 导出</button>
          <button class="compact-btn secondary" id="printBtn">🖨️ 打印</button>
        </div>
      </div>
    `;
  }

  renderMarketSection(marketName, stocks, isVertical = false, filterDate) {
    if (stocks.length === 0) return '';
    
    const isCollapsed = this.collapsedMarkets.has(marketName);
    
    // 检查是否是扩展模式
    const isExpandedMode = this.expandedStock && this.expandedMarket === marketName;
    
    // 计算该市场所有股票当日交易的总笔数
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    let totalTrades = 0;
    let totalPairedNetProfit = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    
    stocks.forEach(stock => {
      const stockTrades = trades.filter(t => t.stock === stock.stock && t.market === marketName && t.date === filterDate);
      totalTrades += stockTrades.length;
      
      // 计算该股票的买入和卖出金额
      stockTrades.forEach(trade => {
        if (trade.hideable === 'Y') return;
        const amount = trade.price * trade.qty;
        if (trade.side === 'buy') {
          totalBuyAmount += amount;
        } else {
          totalSellAmount += amount;
        }
      });
      
      // 计算该股票的配对气泡净利润
      const stockPairing = pairingCache[stock.stock] || { pairedTrades: [] };
      (stockPairing.pairedTrades || []).forEach(pair => {
        if (pair.hideable === 'Y') return;
        
        const buyDate = pair.buy ? pair.buy.date : null;
        const sellDate = pair.sell ? pair.sell.date : null;
        
        // 只计算买入和卖出都是当日的配对气泡
        if (buyDate === filterDate && sellDate === filterDate) {
          const buyAmount = pair.buy ? pair.buy.price * pair.buy.qty : 0;
          const sellAmount = pair.sell ? pair.sell.price * pair.sell.qty : 0;
          const buyTax = calculateTax ? calculateTax(stock.stock, 'buy', buyAmount) : 0;
          const sellTax = calculateTax ? calculateTax(stock.stock, 'sell', sellAmount) : 0;
          const grossProfit = sellAmount - buyAmount;
          const netProfit = grossProfit - buyTax - sellTax;
          totalPairedNetProfit += netProfit;
        }
      });
    });
    
    // 取绝对值并保留两位小数
    const absPairedNetProfit = Math.abs(totalPairedNetProfit);
    const formattedNetProfit = absPairedNetProfit.toFixed(2);
    const netAmount = totalBuyAmount - totalSellAmount;
    let formattedNetAmount;
    if (netAmount > 0) {
      formattedNetAmount = `加仓 ${netAmount.toLocaleString()}`;
    } else if (netAmount < 0) {
      formattedNetAmount = `减仓 ${Math.abs(netAmount).toLocaleString()}`;
    } else {
      formattedNetAmount = netAmount.toLocaleString();
    }
    
    // 计算当前显示的股票数量（不被隐藏的股票）
    const visibleStocksCount = stocks.filter(stock => !this.hiddenStocks.has(stock.stock)).length;
    
    // 根据自定义排序重新排列股票
    const sortedStocks = [...stocks].sort((a, b) => {
      const indexA = this.stockOrder.indexOf(a.stock);
      const indexB = this.stockOrder.indexOf(b.stock);
      
      if (indexA === -1 && indexB === -1) return 0;
      if (indexA === -1) return 1;
      if (indexB === -1) return -1;
      return indexA - indexB;
    });
    
    return `
      <div class="compact-market-section" data-market="${marketName}">
        <div class="compact-market-title" style="flex-wrap: wrap;">
          <div style="display: flex; align-items: center; width: 100%; gap: 4px;">
            <button class="compact-market-toggle" data-market="${marketName}" data-expanded="${!isCollapsed}">
            </button>
            <span style="padding-left: 22px; flex: 1;">${marketName} (${stocks.length}档/${visibleStocksCount}档) - ${totalTrades}笔 (${formattedNetAmount}) - 绝对当日配对气泡净利润 ${formattedNetProfit}</span>
            <div style="flex: 1;"></div>
            <div class="market-smart-add" style="display: flex; align-items: flex-start; gap: 8px; flex-wrap: wrap;">
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                  <button class="trade-list-btn" data-market="${marketName}" title="查看${marketName}交易明细" style="padding: 4px 10px; border: 2px solid #3b82f6; border-radius: 4px; background: #3b82f6; color: white; font-size: 12px; font-weight: bold; cursor: pointer; white-space: nowrap;">交易列表</button>
                  <input type="text" class="smart-add-price" data-market="${marketName}" placeholder="输入单价（-号表示卖出）" style="padding: 4px 8px; border: 2px solid #fbbf24; border-radius: 4px; font-size: 12px; font-weight: bold; width: 140px;">
                  <button class="keypad-toggle-btn" data-market="${marketName}" title="显示/隐藏数字键盘" style="padding: 0; border: none; border-radius: 0; background: transparent; color: #3b82f6; font-size: 28px; cursor: pointer; display: flex; align-items: center; justify-content: center; width: auto; height: auto; line-height: 1;">
                    ⌨️
                  </button>
                </div>
                <div class="smart-add-keypad" data-market="${marketName}" style="display: none; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px;">
                  <button class="keypad-btn" data-key="7" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">7</button>
                  <button class="keypad-btn" data-key="8" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">8</button>
                  <button class="keypad-btn" data-key="9" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">9</button>
                  <button class="keypad-btn keypad-clear" data-key="clear" style="padding: 6px; border: 1px solid #ef4444; border-radius: 4px; background: white; color: #ef4444; font-size: 12px; font-weight: bold; cursor: pointer;">清除</button>
                  
                  <button class="keypad-btn" data-key="4" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">4</button>
                  <button class="keypad-btn" data-key="5" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">5</button>
                  <button class="keypad-btn" data-key="6" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">6</button>
                  <button class="keypad-btn" data-key="backspace" style="padding: 6px; border: 1px solid #f59e0b; border-radius: 4px; background: white; color: #f59e0b; font-size: 12px; font-weight: bold; cursor: pointer;">←</button>
                  
                  <button class="keypad-btn" data-key="1" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">1</button>
                  <button class="keypad-btn" data-key="2" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">2</button>
                  <button class="keypad-btn" data-key="3" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">3</button>
                  <button class="keypad-btn" data-key="-" style="padding: 6px; border: 1px solid #8b5cf6; border-radius: 4px; background: white; color: #8b5cf6; font-size: 14px; font-weight: bold; cursor: pointer;">-</button>
                  
                  <button class="keypad-btn" data-key="0" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">0</button>
                  <button class="keypad-btn" data-key="00" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 12px; font-weight: bold; cursor: pointer;">00</button>
                  <button class="keypad-btn" data-key="." style="padding: 6px; border: 1px solid #10b981; border-radius: 4px; background: white; color: #10b981; font-size: 14px; font-weight: bold; cursor: pointer;">.</button>
                  <button class="keypad-btn keypad-enter" data-key="enter" style="padding: 6px; border: 1px solid #10b981; border-radius: 4px; background: #10b981; color: white; font-size: 12px; font-weight: bold; cursor: pointer;">确认</button>
                </div>
              </div>
              <button class="smart-add-btn" data-market="${marketName}" style="padding: 4px 12px; border: 2px solid #10b981; border-radius: 4px; background: #10b981; color: white; font-size: 12px; font-weight: bold; cursor: pointer;">智能保存</button>
            </div>
          </div>
          <div class="smart-add-results" data-market="${marketName}" style="display: none; width: 100%; margin-top: 8px; padding: 8px; background: white; border: 1px solid #e5e7eb; border-radius: 6px;">
            <div style="font-weight: bold; font-size: 12px; color: #374151; margin-bottom: 6px;">选择匹配的股票（前三笔最接近）：</div>
            <div class="smart-add-stock-list" data-market="${marketName}" style="display: flex; gap: 8px; flex-wrap: wrap;"></div>
            <div class="smart-add-pairing-profits" data-market="${marketName}" style="display: none; margin-top: 8px; padding-top: 8px; border-top: 1px dashed #d1d5db;"></div>
          </div>
        </div>
        <div class="compact-stock-grid ${isVertical ? 'vertical' : ''}${isExpandedMode ? ' expanded-mode-grid' : ''}" ${isCollapsed ? 'style="display: none;"' : ''} data-market-grid="${marketName}">
          ${sortedStocks.map(stock => this.renderStockCard(stock, isVertical, filterDate)).join('')}
        </div>
      </div>
    `;
  }

  // 显示市场交易明细子视窗（按输入时间由大到小排序）
  showTradeListModal(marketName, filterDate, winEl) {
    // 移除已存在的交易明细弹窗，避免重复
    const existingModal = winEl.querySelector('#tradeListModal');
    if (existingModal) existingModal.remove();

    const trades = (window.trades || [])
      .filter(t => t.market === marketName && t.date === filterDate)
      .map(t => {
        const createdAt = t.createdAt || t.createdat || t.created_at || '';
        const ts = createdAt ? new Date(createdAt).getTime() : 0;
        return { ...t, _ts: ts };
      })
      .sort((a, b) => b._ts - a._ts);

    const rowsHtml = trades.map((t, idx) => {
      const isBuy = t.side === 'buy';
      const timeStr = t._ts ? new Date(t._ts).toTimeString().slice(0, 8) : '-';
      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 6px 8px; font-size: 13px; color: #9ca3af; text-align: center; width: 40px;">${idx + 1}</td>
          <td style="padding: 6px 10px; font-size: 13px; font-weight: 600; color: #374151; text-align: left;">${t.stock}</td>
          <td style="padding: 6px 10px; font-size: 13px; font-weight: bold; text-align: center; color: ${isBuy ? '#ef4444' : '#22c55e'};">${isBuy ? '+' : '-'} ${isBuy ? '买入' : '卖出'}</td>
          <td style="padding: 6px 10px; font-size: 13px; color: #374151; text-align: right;">${t.price}</td>
          <td style="padding: 6px 10px; font-size: 13px; color: #6b7280; text-align: center;">${timeStr}</td>
        </tr>
      `;
    }).join('');

    const emptyHtml = `
      <tr>
        <td colspan="5" style="padding: 20px; font-size: 13px; color: #9ca3af; text-align: center;">${filterDate} ${marketName} 无交易记录</td>
      </tr>
    `;

    const modal = document.createElement('div');
    modal.id = 'tradeListModal';
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); z-index: 2000; display: flex; justify-content: center; align-items: center;';
    modal.innerHTML = `
      <div style="background: white; border-radius: 12px; padding: 16px; max-width: 480px; width: 90%; max-height: 70vh; display: flex; flex-direction: column; box-shadow: 0 20px 60px rgba(0,0,0,0.3);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <div style="font-size: 15px; font-weight: bold; color: #374151;">${marketName} 交易明细 <span style="font-size: 12px; font-weight: normal; color: #9ca3af;">${filterDate}（${trades.length}笔）</span></div>
          <button id="closeTradeListModal" style="border: none; background: transparent; font-size: 18px; cursor: pointer; color: #6b7280;">✕</button>
        </div>
        <div style="overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f9fafb; position: sticky; top: 0;">
                <th style="padding: 8px 8px; font-size: 12px; color: #6b7280; text-align: center; width: 40px;">项次</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #6b7280; text-align: left;">股票名称</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #6b7280; text-align: center;">买卖</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #6b7280; text-align: right;">交易单价</th>
                <th style="padding: 8px 10px; font-size: 12px; color: #6b7280; text-align: center;">输入时间</th>
              </tr>
            </thead>
            <tbody>${trades.length > 0 ? rowsHtml : emptyHtml}</tbody>
          </table>
        </div>
      </div>
    `;
    winEl.appendChild(modal);

    // 关闭事件：点击关闭按钮或遮罩层空白处
    modal.querySelector('#closeTradeListModal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });
  }

  renderStockCard(stock, isVertical = false, filterDate) {
    const stockQtyText = (stock.stockQty || 0).toLocaleString();
    const firstChar = stock.stock.charAt(0);
    const restOfName = stock.stock.slice(1);
    
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    
    // 获取全部日期（不限制数量）
    const historyDates = this.getStockHistoryDates(stock.stock, stock.market, filterDate, this.historyDays, trades, pairingCache, this.showHistoryPairedBubbles);
    
    let historyBubblesHtml = '';
    
    // 收集历史数据区域实际显示的未配对气泡
    const allUnpairedTradesInHistory = [];
    
    // 计算配对气泡的截止日期（如果设置了配对天数）
    let pairedBubbleCutoffDate = null;
    if (this.showHistoryPairedBubbles && this.historyPairedDays && this.historyPairedDays > 0) {
      const numDays = parseInt(this.historyPairedDays);
      if (historyDates.length > 0 && numDays <= historyDates.length) {
        pairedBubbleCutoffDate = historyDates[numDays - 1];
      }
    }
    
    // 先收集所有日期，然后筛选出有可见气泡的日期，直到收集到设定的天数（最多50天，确保安全）
    const validDatesWithBubbles = [];
    const safeMaxDays = Math.min(this.historyDays, 50);
    let iterationCount = 0;
    const maxIterations = Math.min(historyDates.length, 200);
    
    for (let i = 0; i < historyDates.length && validDatesWithBubbles.length < safeMaxDays && iterationCount < maxIterations; i++) {
      iterationCount++;
      const historyDate = historyDates[i];
      
      try {
        const historyBubbles = this.getStockHistoryBubbles(stock.stock, stock.market, historyDate);
        
        // 过滤气泡
        let filteredBubbles = historyBubbles;
        if (!this.showHistoryPairedBubbles) {
          filteredBubbles = historyBubbles.filter(b => b.type !== 'paired');
        } else if (pairedBubbleCutoffDate) {
          const isDateWithinPairedLimit = historyDates.indexOf(historyDate) < historyDates.indexOf(pairedBubbleCutoffDate) || historyDate === pairedBubbleCutoffDate;
          if (!isDateWithinPairedLimit) {
            filteredBubbles = historyBubbles.filter(b => b.type !== 'paired');
          }
        }
        
        // 只有有可见气泡的日期才加入
        if (filteredBubbles.length > 0) {
          validDatesWithBubbles.push({
            date: historyDate,
            bubbles: filteredBubbles
          });
        }
        
        // 收集未配对气泡（收集全部日期的，限制数量最多500个）
        if (allUnpairedTradesInHistory.length < 500) {
          historyBubbles.forEach(bubble => {
            if (bubble && bubble.type === 'unpaired' && bubble.trade) {
              allUnpairedTradesInHistory.push(bubble.trade);
            }
          });
        }
      } catch (e) {
        console.error('处理历史日期时出错:', historyDate, e);
      }
    }
    
    // 收集所有交易并建立序号映射
    const allTrades = [];
    const seenTradeIds = new Set();
    
    // 收集今日气泡中的交易
    if (stock.bubbleData && Array.isArray(stock.bubbleData)) {
      stock.bubbleData.forEach(bubble => {
        if (bubble.type === 'paired') {
          if (bubble.buy && !seenTradeIds.has(bubble.buy.id)) {
            seenTradeIds.add(bubble.buy.id);
            allTrades.push({
              trade: bubble.buy,
              bubble,
              type: 'paired-buy'
            });
          }
          if (bubble.sell && !seenTradeIds.has(bubble.sell.id)) {
            seenTradeIds.add(bubble.sell.id);
            allTrades.push({
              trade: bubble.sell,
              bubble,
              type: 'paired-sell'
            });
          }
        } else {
          if (bubble.trade && !seenTradeIds.has(bubble.trade.id)) {
            seenTradeIds.add(bubble.trade.id);
            allTrades.push({
              trade: bubble.trade,
              bubble,
              type: 'unpaired'
            });
          }
        }
      });
    }
    
    // 收集历史气泡中的交易
    validDatesWithBubbles.forEach(item => {
      item.bubbles.forEach(bubble => {
        if (bubble.type === 'paired') {
          if (bubble.buy && !seenTradeIds.has(bubble.buy.id)) {
            seenTradeIds.add(bubble.buy.id);
            allTrades.push({
              trade: bubble.buy,
              bubble,
              type: 'paired-buy'
            });
          }
          if (bubble.sell && !seenTradeIds.has(bubble.sell.id)) {
            seenTradeIds.add(bubble.sell.id);
            allTrades.push({
              trade: bubble.sell,
              bubble,
              type: 'paired-sell'
            });
          }
        } else {
          if (bubble.trade && !seenTradeIds.has(bubble.trade.id)) {
            seenTradeIds.add(bubble.trade.id);
            allTrades.push({
              trade: bubble.trade,
              bubble,
              type: 'unpaired'
            });
          }
        }
      });
    });
    
    // 按时间戳排序（最新的在前）
    allTrades.sort((a, b) => {
      const dateA = new Date(a.trade.createdAt || a.trade.date);
      const dateB = new Date(b.trade.createdAt || b.trade.date);
      return dateB - dateA;
    });
    
    // 创建交易序号映射
    const tradeOrderMap = new Map();
    const maxOrder = allTrades.length;
    allTrades.forEach((item, index) => {
      tradeOrderMap.set(item.trade.id, index + 1);
    });
    
    // 找到所有气泡中日期最大的
    let latestBuyId = null;
    let latestSellId = null;
    let latestTradeId = null;
    let maxTimestamp = -1;
    
    validDatesWithBubbles.forEach(item => {
      item.bubbles.forEach(bubble => {
        if (bubble.timestamp > maxTimestamp) {
          maxTimestamp = bubble.timestamp;
          if (bubble.type === 'paired') {
            // 对于配对气泡，比较买入和卖出的创建时间，只给更新的那个打勾
            const buyCreatedAt = bubble.buy ? new Date(bubble.buy.createdAt).getTime() : 0;
            const sellCreatedAt = bubble.sell ? new Date(bubble.sell.createdAt).getTime() : 0;
            if (buyCreatedAt > sellCreatedAt) {
              latestBuyId = bubble.buy ? bubble.buy.id : null;
              latestSellId = null;
            } else {
              latestSellId = bubble.sell ? bubble.sell.id : null;
              latestBuyId = null;
            }
            latestTradeId = null;
          } else {
            latestTradeId = bubble.trade ? bubble.trade.id : null;
            latestBuyId = null;
            latestSellId = null;
          }
        }
      });
    });
    
    // 渲染"历史数据-按日显示"区域（只显示有可见气泡的日期，最多显示设定的天数）
    validDatesWithBubbles.forEach(item => {
      const historyDate = item.date;
      const filteredBubbles = item.bubbles;
      const monthDay = historyDate.slice(5);
      historyBubblesHtml += `
        <div class="compact-history-date">${monthDay}</div>
        ${this.renderHistoryBubbles(filteredBubbles, historyDate, this.showHistoryPairedBubbles, latestBuyId, latestSellId, latestTradeId, tradeOrderMap, maxOrder)}
      `;
    });
    
    // 从收集的未配对交易中分离买入和卖出（合理限制数量，防止崩溃）
    const unpairedBuys = [];
    const unpairedSells = [];
    const maxUnpairedPerSide = 100; // 每边最多显示100个未配对气泡
    
    for (let i = 0; i < allUnpairedTradesInHistory.length && (unpairedBuys.length < maxUnpairedPerSide || unpairedSells.length < maxUnpairedPerSide); i++) {
      const trade = allUnpairedTradesInHistory[i];
      if (trade && trade.side) {
        if (trade.side === 'buy' && unpairedBuys.length < maxUnpairedPerSide) {
          unpairedBuys.push(trade);
        } else if (trade.side === 'sell' && unpairedSells.length < maxUnpairedPerSide) {
          unpairedSells.push(trade);
        }
      }
    }
    
    // 按价格降序排序
    unpairedBuys.sort((a, b) => {
      const priceA = a && a.price ? parseFloat(a.price) : 0;
      const priceB = b && b.price ? parseFloat(b.price) : 0;
      return priceB - priceA;
    });
    unpairedSells.sort((a, b) => {
      const priceA = a && a.price ? parseFloat(a.price) : 0;
      const priceB = b && b.price ? parseFloat(b.price) : 0;
      return priceB - priceA;
    });
    
    // 渲染未配对买入和卖出气泡
    let unpairedBuysHtml = '';
    let unpairedSellsHtml = '';
    
    unpairedBuys.forEach(trade => {
      if (trade && trade.price) {
        const specialClass = this.isSpecialQty(trade, stock.stock) ? ' special-qty' : '';
        const order = tradeOrderMap.get(trade.id);
        const orderClass = (order === maxOrder || order === 1) ? ' bubble-order-max' : '';
        unpairedBuysHtml += `<span class="compact-bubble buy history${specialClass}" data-trade='${JSON.stringify(trade)}' data-stock-name="${stock.stock}">${trade.price}<span class="bubble-order${orderClass}">${order}</span></span>`;
      }
    });
    
    unpairedSells.forEach(trade => {
      if (trade && trade.price) {
        const specialClass = this.isSpecialQty(trade, stock.stock) ? ' special-qty' : '';
        const order = tradeOrderMap.get(trade.id);
        const orderClass = (order === maxOrder || order === 1) ? ' bubble-order-max' : '';
        unpairedSellsHtml += `<span class="compact-bubble sell history${specialClass}" data-trade='${JSON.stringify(trade)}' data-stock-name="${stock.stock}">-${trade.price}<span class="bubble-order${orderClass}">${order}</span></span>`;
      }
    });
    
    const hasUnpairedBubbles = unpairedBuysHtml || unpairedSellsHtml;
    
    const isStockHidden = this.hiddenStocks.has(stock.stock);
    const isStockCollapsed = this.collapsedStocks.has(stock.stock);
    const stockColor = this.stockColors[stock.stock] || '';
    
    // 淡色选项
    const colorOptions = [
      { value: '', label: '无' },
      { value: '#fef3c7', label: '淡黄' },
      { value: '#fce7f3', label: '淡粉' },
      { value: '#e0f2fe', label: '淡蓝' },
      { value: '#dcfce7', label: '淡绿' },
      { value: '#f3e8ff', label: '淡紫' },
      { value: '#fff7ed', label: '淡橙' }
    ];
    
    let cardStyle = '';
    if (isStockHidden) {
      cardStyle = 'display: none;';
    }
    if (stockColor) {
      cardStyle += `background-color: ${stockColor};`;
    }
    
    const stockNote = this.stockNotes[stock.stock] || '';
    
    let fullCardStyle = cardStyle || '';
    if (!fullCardStyle.includes('position')) {
      fullCardStyle = 'position: relative;' + fullCardStyle;
    }
    
    // 如果是扩展模式，添加CSS类
    const isExpanded = this.expandedStock === stock.stock && this.expandedMarket === stock.market;
    
    const hasNote = stockNote && stockNote.trim() !== '';
    const darkerColor = this.darkenColor(stockColor);
    const cornerStyle = darkerColor ? `--corner-color: ${darkerColor};` : '';
    
    // 将未配对交易数据和交易序号映射保存到卡片元素上
    const tradeOrderMapArray = Array.from(tradeOrderMap.entries());
    
    // ==== 计算该股票的绝对当日配对气泡净利润 ====
    let stockPairedNetProfit = 0;
    const stockPairing = pairingCache[stock.stock] || { pairedTrades: [] };
    (stockPairing.pairedTrades || []).forEach(pair => {
      if (pair.hideable === 'Y') return;
      
      const buyDate = pair.buy ? pair.buy.date : null;
      const sellDate = pair.sell ? pair.sell.date : null;
      
      // 只计算买入和卖出都是当日的配对气泡
      if (buyDate === filterDate && sellDate === filterDate) {
        const buyAmount = pair.buy ? pair.buy.price * pair.buy.qty : 0;
        const sellAmount = pair.sell ? pair.sell.price * pair.sell.qty : 0;
        const buyTax = window.calculateTax ? window.calculateTax(stock.stock, 'buy', buyAmount) : 0;
        const sellTax = window.calculateTax ? window.calculateTax(stock.stock, 'sell', sellAmount) : 0;
        const grossProfit = sellAmount - buyAmount;
        const netProfit = grossProfit - buyTax - sellTax;
        stockPairedNetProfit += netProfit;
      }
    });
    
    // 取绝对值并格式化（净利润不保留小数位数）
    const absStockPairedNetProfit = Math.abs(stockPairedNetProfit);
    const formattedStockNetProfit = Math.round(absStockPairedNetProfit).toLocaleString();
    // =================================================
    
    return `
      <div class="compact-stock-card${isExpanded ? ' expanded-mode' : ''}" style="${fullCardStyle}${cornerStyle}" draggable="true" data-stock-name="${stock.stock}" data-unpaired-buys='${JSON.stringify(unpairedBuys)}' data-unpaired-sells='${JSON.stringify(unpairedSells)}' data-trade-order-map='${JSON.stringify(tradeOrderMapArray)}'${stockColor ? ` data-card-color="${stockColor}"` : ''}>
        <button class="compact-note-toggle${hasNote ? ' has-note' : ''}" data-stock="${stock.stock}" data-position="top-right" style="position: absolute; top: 0; right: 0; width: 18px; height: 18px; cursor: pointer; overflow: hidden; z-index: 10;"></button>
        <button class="compact-bottom-left-toggle" data-stock="${stock.stock}" data-position="bottom-left" style="position: absolute; bottom: 0; left: 0; width: 18px; height: 18px; cursor: pointer; overflow: hidden; z-index: 10;"></button>
        <button class="compact-bottom-right-toggle" data-stock="${stock.stock}" data-position="bottom-right" style="position: absolute; bottom: 0; right: 0; width: 18px; height: 18px; cursor: pointer; overflow: hidden; z-index: 10;"></button>
        <div class="compact-stock-header">
          <div class="compact-stock-info">
            <button class="compact-stock-collapse" data-stock="${stock.stock}" data-expanded="${!isStockCollapsed}" data-position="top-left"></button>
            <label class="compact-stock-color-wrapper" data-stock="${stock.stock}" for="color-picker-${stock.stock}">
              <div class="compact-stock-color-inner" style="background-color: ${stockColor || 'transparent'};"></div>
              <input type="color" id="color-picker-${stock.stock}" class="compact-stock-color-picker-hidden" data-stock="${stock.stock}" value="${stockColor || '#ffffff'}">
            </label>
            <input type="checkbox" class="compact-stock-toggle" data-stock="${stock.stock}" ${!isStockHidden ? 'checked' : ''}>
            <span class="compact-stock-name">
              <span class="first-char">${firstChar}</span>${restOfName}
            </span>
          </div>
          <div class="compact-stock-actions">
            <button class="add-trade-btn" data-stock="${stock.stock}" data-market="${stock.market}">+</button>
            <button class="daily-pair-btn" data-stock="${stock.stock}" data-market="${stock.market}" title="当日配对">M</button>
            <button class="manual-pair-btn" data-stock="${stock.stock}" data-market="${stock.market}" title="手动配对">H</button>
            <button class="refresh-stock-btn" data-stock="${stock.stock}" data-market="${stock.market}" title="刷新资料">F</button>
            <button class="expand-card-btn" data-stock="${stock.stock}" data-market="${stock.market}" title="卡片扩展">Z</button>
            <button class="history-btn" data-stock="${stock.stock}" data-market="${stock.market}">h</button>
            <!-- 结存数量和净利润上下显示的区块 -->
            <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 2px;">
              <span class="compact-stock-net" style="font-weight: bold; font-size: 12px;">
                ${stockQtyText}
              </span>
              <span class="compact-stock-net" style="font-weight: bold; font-size: 12px; color: #1f2937;">
                ${formattedStockNetProfit}
              </span>
            </div>
          </div>
        </div>
        <div class="compact-stock-content" ${isStockCollapsed ? 'style="display: none;"' : ''}>
          <div class="compact-today-label">当日数据</div>
          <div class="compact-stock-bubbles" data-bubble-data='${JSON.stringify(stock.bubbleData || [])}'>
            ${this.renderBubbles(stock, filterDate, tradeOrderMap, maxOrder)}
          </div>
          <div class="compact-note-editor" style="display: none; margin-top: 8px; padding: 8px; background: #fffbeb; border-radius: 4px; border: 1px solid #fcd34d;">
            <textarea class="compact-note-textarea" data-stock="${stock.stock}"  placeholder="输入备注内容，按 Command+S (或 Ctrl+S) 保存...">${stockNote}</textarea>
            <div style="margin-top: 4px; font-size: 10px; color: #92400e;">💡 按 Command+S (或 Ctrl+S) 保存</div>
          </div>
          ${validDatesWithBubbles.length > 0 ? `
            <div class="compact-section-toggle">
              <input type="checkbox" class="compact-history-toggle" data-toggle="history-by-date" ${this.showHistoryByDate ? 'checked' : ''}>
              <div class="compact-divider-container">
                <div class="compact-divider-line"></div>
                <div class="compact-divider-label">历史数据-按日显示</div>
              </div>
            </div>
            <div class="compact-history-container" ${this.showHistoryByDate ? '' : 'style="display: none;"'}>
              ${historyBubblesHtml}
            </div>
          ` : ''}
          ${hasUnpairedBubbles ? `
            <div class="compact-section-toggle">
              <input type="checkbox" class="compact-history-toggle" data-toggle="history-by-side" ${this.showHistoryBySide ? 'checked' : ''}>
              <div class="compact-divider-container">
                <div class="compact-divider-line"></div>
                <div class="compact-divider-label">历史数据-按买卖排序显示</div>
              </div>
            </div>
            <div class="compact-history-container" ${this.showHistoryBySide ? '' : 'style="display: none;"'}>
              ${unpairedBuysHtml ? `
                <div class="compact-history-date compact-unpaired-buy-label">未配对买入</div>
                ${unpairedBuysHtml}
              ` : ''}
              ${unpairedSellsHtml ? `
                <div class="compact-history-date compact-unpaired-sell-label">未配对卖出</div>
                ${unpairedSellsHtml}
              ` : ''}
            </div>
          ` : ''}
          <div class="compact-quick-add" style="display: none; margin-top: 6px; padding: 4px; background: #f0f9ff; border-radius: 4px; border: 1px solid #bae6fd;">
            <div style="display: flex; gap: 4px;">
              <input type="text" class="quick-add-price" placeholder="单价（-号表示卖出）" style="flex: 1; padding: 2px 4px; border: 1px solid #7dd3fc; border-radius: 3px; font-size: 11px;">
              <button class="quick-add-confirm" data-stock="${stock.stock}" data-market="${stock.market}" style="padding: 2px 6px; border: 2px solid #0ea5e9; border-radius: 3px; background: #0ea5e9; color: white; font-size: 11px; font-weight: bold; cursor: pointer; white-space: nowrap;">新增</button>
            </div>
            <div class="numeric-keypad" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px;">
              <button class="keypad-btn" data-key="7" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">7</button>
              <button class="keypad-btn" data-key="8" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">8</button>
              <button class="keypad-btn" data-key="9" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">9</button>
              <button class="keypad-btn keypad-clear" data-key="clear" style="padding: 6px; border: 1px solid #ef4444; border-radius: 4px; background: white; color: #ef4444; font-size: 12px; font-weight: bold; cursor: pointer;">清除</button>
              
              <button class="keypad-btn" data-key="4" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">4</button>
              <button class="keypad-btn" data-key="5" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">5</button>
              <button class="keypad-btn" data-key="6" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">6</button>
              <button class="keypad-btn" data-key="backspace" style="padding: 6px; border: 1px solid #f59e0b; border-radius: 4px; background: white; color: #f59e0b; font-size: 12px; font-weight: bold; cursor: pointer;">←</button>
              
              <button class="keypad-btn" data-key="1" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">1</button>
              <button class="keypad-btn" data-key="2" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">2</button>
              <button class="keypad-btn" data-key="3" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">3</button>
              <button class="keypad-btn" data-key="-" style="padding: 6px; border: 1px solid #8b5cf6; border-radius: 4px; background: white; color: #8b5cf6; font-size: 14px; font-weight: bold; cursor: pointer;">-</button>
              
              <button class="keypad-btn" data-key="0" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">0</button>
              <button class="keypad-btn" data-key="00" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 12px; font-weight: bold; cursor: pointer;">00</button>
              <button class="keypad-btn" data-key="." style="padding: 6px; border: 1px solid #10b981; border-radius: 4px; background: white; color: #10b981; font-size: 14px; font-weight: bold; cursor: pointer;">.</button>
              <button class="keypad-btn keypad-enter" data-key="enter" style="padding: 6px; border: 1px solid #10b981; border-radius: 4px; background: #10b981; color: white; font-size: 12px; font-weight: bold; cursor: pointer;">确认</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderBubbles(stock, filterDate, tradeOrderMap, maxOrder) {
    if (!stock.bubbleData || !Array.isArray(stock.bubbleData)) {
      return '';
    }

    // 确保 stock.stock 存在
    const stockName = stock.stock || stock.name || '';

    return stock.bubbleData.map(bubble => {
      if (bubble.type === 'paired') {
        const buyPrice = bubble.buy ? `${bubble.buy.price}` : '';
        const sellPrice = bubble.sell ? `${bubble.sell.price}` : '';
        const isBuyLatest = bubble.buy && bubble.buy.id === stock.latestTradeId;
        const isSellLatest = bubble.sell && bubble.sell.id === stock.latestTradeId;
        
        const isBuyToday = bubble.buy && bubble.buy.date === filterDate;
        const isSellToday = bubble.sell && bubble.sell.date === filterDate;
        const bothToday = isBuyToday && isSellToday;
        const oneNotToday = !bothToday && (isBuyToday || isSellToday);
        
        let pairClass = 'compact-pair';
        if (bothToday) {
          pairClass += ' both-today';
        } else if (oneNotToday) {
          pairClass += ' one-not-today';
        }
        
        let buyClass = 'compact-bubble buy';
        if (isBuyToday) buyClass += ' today-trade';
        if (isBuyLatest) buyClass += ' latest-trade';
        if (bubble.buy && this.isSpecialQty(bubble.buy, stockName)) buyClass += ' special-qty';
        
        let sellClass = 'compact-bubble sell';
        if (isSellToday) sellClass += ' today-trade';
        if (isSellLatest) sellClass += ' latest-trade';
        if (bubble.sell && this.isSpecialQty(bubble.sell, stockName)) sellClass += ' special-qty';
        
        const buyOrder = bubble.buy ? tradeOrderMap.get(bubble.buy.id) : '';
        const sellOrder = bubble.sell ? tradeOrderMap.get(bubble.sell.id) : '';
        const buyOrderClass = (buyOrder === maxOrder || buyOrder === 1) ? ' bubble-order-max' : '';
        const sellOrderClass = (sellOrder === maxOrder || sellOrder === 1) ? ' bubble-order-max' : '';
        
        return `
          <div class="${pairClass}" data-pair='${JSON.stringify({ buy: bubble.buy, sell: bubble.sell })}' data-stock-name="${stockName}">
            ${buyPrice ? `<span class="${buyClass}">${buyPrice}<span class="bubble-order${buyOrderClass}">${buyOrder}</span></span>` : ''}
            ${sellPrice ? `<span class="${sellClass}">-${sellPrice}<span class="bubble-order${sellOrderClass}">${sellOrder}</span></span>` : ''}
          </div>
        `;
      } else {
        const trade = bubble.trade;
        const isLatest = trade.id === stock.latestTradeId;
        const isToday = trade.date === filterDate;
        
        let bubbleClass = `compact-bubble ${trade.side}`;
        if (isToday) bubbleClass += ' today-trade';
        if (isLatest) bubbleClass += ' latest-trade';
        if (this.isSpecialQty(trade, stockName)) bubbleClass += ' special-qty';
        
        const order = tradeOrderMap.get(trade.id);
        const orderClass = (order === maxOrder || order === 1) ? ' bubble-order-max' : '';
        
        return `
          <span class="${bubbleClass}" data-trade='${JSON.stringify(trade)}' data-stock-name="${stockName}">
            ${trade.side === 'sell' ? '-' : ''}${trade.price}<span class="bubble-order${orderClass}">${order}</span>
          </span>
        `;
      }
    }).join('');
  }

  // 收集所有股票的最新交易价格（序号为1的）
  collectStockLatestPrices(data, filterDate) {
    const stockLatestPrices = [];
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    
    data.forEach(stock => {
      // 跳过被屏蔽的股票
      if (this.hiddenStocks.has(stock.stock)) {
        return;
      }
      
      const stockTrades = trades.filter(t => t.stock === stock.stock && t.market === stock.market);
      if (stockTrades.length === 0) return;
      
      let latestTrade = null;
      let latestTimestamp = -1;
      
      stockTrades.forEach(trade => {
        const createdAt = trade.createdAt || trade.createdat || trade.created_at;
        const timestamp = createdAt ? new Date(createdAt).getTime() : new Date(trade.date).getTime();
        if (timestamp > latestTimestamp) {
          latestTimestamp = timestamp;
          latestTrade = trade;
        }
      });
      
      if (latestTrade) {
        stockLatestPrices.push({
          stock: stock.stock,
          market: stock.market,
          price: latestTrade.price,
          side: latestTrade.side
        });
      }
    });
    
    return stockLatestPrices;
  }

  showPairingProfitSuggestions(stockName, inputPrice, inputSide, containerEl) {
    if (!stockName || !containerEl) {
      containerEl.style.display = 'none';
      return;
    }
    const winEl = this.floatingWindow ? this.floatingWindow.getElement() : null;
    if (!winEl) {
      containerEl.style.display = 'none';
      return;
    }
    const stockCard = winEl.querySelector(`.compact-stock-card[data-stock-name="${stockName}"]`);
    if (!stockCard) {
      containerEl.style.display = 'none';
      return;
    }
    
    const stockData = this._findStockByName(stockName);
    const standardQty = stockData ? stockData.qty : 1;
    
    let unpairedBuys = [];
    let unpairedSells = [];
    try {
      unpairedBuys = JSON.parse(stockCard.dataset.unpairedBuys || '[]');
      unpairedSells = JSON.parse(stockCard.dataset.unpairedSells || '[]');
    } catch (e) {
      containerEl.style.display = 'none';
      return;
    }
    
    const targetSide = inputSide === 'buy' ? 'sell' : 'buy';
    let candidateTrades = targetSide === 'buy' ? unpairedBuys : unpairedSells;
    
    candidateTrades = candidateTrades.filter(trade => !this.isSpecialQty(trade, stockName));
    
    if (candidateTrades.length === 0) {
      containerEl.innerHTML = `<div style="font-size: 11px; color: #9ca3af;">该股票没有可配对的${targetSide === 'buy' ? '买入' : '卖出'}未配对气泡（已排除非标准数量）</div>`;
      containerEl.style.display = 'block';
      return;
    }
    const calculateTax = window.calculateTax || null;
    const inputPriceAbs = Math.abs(inputPrice);
    const inputIsSell = inputSide === 'sell';
    const pairingResults = candidateTrades.map(trade => {
      const tradePrice = parseFloat(trade.price);
      const tradeAmount = tradePrice * standardQty;
      const inputAmount = inputPriceAbs * standardQty;
      let grossProfit, buyAmount, sellAmount;
      if (inputIsSell) {
        sellAmount = inputAmount;
        buyAmount = tradeAmount;
      } else {
        sellAmount = tradeAmount;
        buyAmount = inputAmount;
      }
      grossProfit = sellAmount - buyAmount;
      const buyTax = calculateTax ? calculateTax(stockName, 'buy', buyAmount) : 0;
      const sellTax = calculateTax ? calculateTax(stockName, 'sell', sellAmount) : 0;
      const netProfit = grossProfit - buyTax - sellTax;
      return {
        trade,
        tradePrice,
        standardQty,
        grossProfit,
        netProfit,
        profitPercent: tradePrice > 0 ? (netProfit / (tradePrice * standardQty)) * 100 : 0
      };
    });
    pairingResults.sort((a, b) => b.netProfit - a.netProfit);
    const top3 = pairingResults.slice(0, 3);
    const inputLabel = `${inputIsSell ? '卖出' : '买入'}${inputPriceAbs}`;
    const targetLabel = targetSide === 'buy' ? '买入' : '卖出';
    containerEl.innerHTML = `
      <div style="font-size: 11px; font-weight: bold; color: #4b5563; margin-bottom: 4px;">
        💡 ${inputLabel} 与 ${stockName} 的 ${targetLabel}未配对气泡配对（利润由大到小，数量×${standardQty}）：
      </div>
      <div style="display: flex; gap: 6px; flex-wrap: wrap;">
        ${top3.map((item, idx) => {
          const profitColor = item.netProfit >= 0 ? '#059669' : '#dc2626';
          const bgColor = item.netProfit >= 0 ? '#d1fae5' : '#fee2e2';
          const borderColor = idx === 0 ? '#f59e0b' : profitColor;
          return `
            <span style="padding: 4px 8px; border: 2px solid ${borderColor}; border-radius: 4px; background: ${bgColor}; color: ${profitColor}; font-size: 11px; font-weight: bold; white-space: nowrap;">
              ${targetLabel}${item.tradePrice} → 利润 ${item.netProfit >= 0 ? '+' : ''}${item.netProfit.toFixed(2)} (${item.profitPercent.toFixed(2)}%)
            </span>
          `;
        }).join('')}
      </div>
    `;
    containerEl.style.display = 'block';
  }

  // 应用最高/最低单价气泡闪烁效果
  applyPriceBlinkEffect(winEl) {
    if (!winEl) return;
    
    // 清除之前的闪烁效果
    const existingBlinks = winEl.querySelectorAll('.price-highest, .price-lowest');
    existingBlinks.forEach(bubble => {
      bubble.classList.remove('price-highest', 'price-lowest');
    });
    
    // 获取所有股票卡片
    const stockCards = winEl.querySelectorAll('.compact-stock-card');
    
    stockCards.forEach(card => {
      const allBubbles = [];
      
      // 收集所有独立的交易气泡（未配对的）
      const standaloneBubbles = card.querySelectorAll('.compact-stock-bubbles > .compact-bubble:not(.compact-pair .compact-bubble)');
      standaloneBubbles.forEach(bubble => {
        const priceText = (bubble.firstChild?.nodeValue || bubble.textContent).replace(/[^-\d.]/g, '');
        const price = parseFloat(priceText);
        if (!isNaN(price)) {
          allBubbles.push({ element: bubble, price: Math.abs(price) });
        }
      });

      // 收集配对气泡中的交易气泡
      const pairContainers = card.querySelectorAll('.compact-pair, .trade-pair');
      pairContainers.forEach(pairContainer => {
        const pairedBubbles = pairContainer.querySelectorAll(':scope > .compact-bubble');
        pairedBubbles.forEach(bubble => {
          const priceText = (bubble.firstChild?.nodeValue || bubble.textContent).replace(/[^-\d.]/g, '');
          const price = parseFloat(priceText);
          if (!isNaN(price)) {
            allBubbles.push({ element: bubble, price: Math.abs(price) });
          }
        });
      });

      // 也收集历史数据中的交易气泡
      const historyBubbles = card.querySelectorAll('.compact-history-container .compact-bubble:not(.compact-pair .compact-bubble)');
      historyBubbles.forEach(bubble => {
        const priceText = (bubble.firstChild?.nodeValue || bubble.textContent).replace(/[^-\d.]/g, '');
        const price = parseFloat(priceText);
        if (!isNaN(price)) {
          allBubbles.push({ element: bubble, price: Math.abs(price) });
        }
      });

      // 收集历史配对气泡中的交易气泡
      const historyPairContainers = card.querySelectorAll('.compact-history-container .compact-pair.history, .compact-history-container .trade-pair');
      historyPairContainers.forEach(pairContainer => {
        const pairedBubbles = pairContainer.querySelectorAll(':scope > .compact-bubble');
        pairedBubbles.forEach(bubble => {
          const priceText = (bubble.firstChild?.nodeValue || bubble.textContent).replace(/[^-\d.]/g, '');
          const price = parseFloat(priceText);
          if (!isNaN(price)) {
            allBubbles.push({ element: bubble, price: Math.abs(price) });
          }
        });
      });
      
      // 如果有足够的气泡，找出最高和最低单价
      if (allBubbles.length >= 2) {
        // 按价格排序
        allBubbles.sort((a, b) => a.price - b.price);

        // 找出最低价格值和最高价格值
        const lowestPrice = allBubbles[0].price;
        const highestPrice = allBubbles[allBubbles.length - 1].price;

        // 只有当最高和最低价格不同时才应用效果（避免所有价格相同的情况）
        if (lowestPrice < highestPrice) {
          // 标记所有最低价格的气泡（可能出现在多个区域）
          allBubbles.filter(b => b.price === lowestPrice).forEach(b => {
            b.element.classList.add('price-lowest');
          });
          // 标记所有最高价格的气泡（可能出现在多个区域）
          allBubbles.filter(b => b.price === highestPrice).forEach(b => {
            b.element.classList.add('price-highest');
          });
        }
      } else if (allBubbles.length === 1) {
        // 如果只有一个气泡，同时标记为最高和最低
        allBubbles[0].element.classList.add('price-highest', 'price-lowest');
      }
    });
  }

  bindEvents() {
    try {
      this.cleanupSmartAddSpeech();
      
      const winEl = this.floatingWindow.getElement();
      if (!winEl) return;
      
      // 应用最高/最低单价气泡闪烁效果
      this.applyPriceBlinkEffect(winEl);
      
      const filterDateInput = document.getElementById('filterDate');
      const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
      let currentData = null;
      if (filterDate) {
        currentData = this.collectData(filterDate);
      }
      
      // 监听"只显示当天股票"checkbox变化，触发紧凑模式刷新
      const showOnlyCheckbox = document.getElementById('showOnlyFilterDateStocks');
      if (showOnlyCheckbox) {
        if (this._showOnlyHandler) {
          showOnlyCheckbox.removeEventListener('change', this._showOnlyHandler);
        }
        this._showOnlyHandler = () => {
          const winEl2 = this.floatingWindow ? this.floatingWindow.getElement() : null;
          if (!winEl2) return;
          const style2 = window.getComputedStyle(winEl2);
          const isVisible2 = style2.display !== 'none' && style2.visibility !== 'hidden' && style2.opacity !== '0';
          if (!isVisible2) return;
          const fd = filterDateInput ? filterDateInput.value.trim() : '';
          if (fd) {
            const data = this.collectData(fd);
            const content = this.renderCompactView(data, fd);
            this.floatingWindow.setContent(content);
            this.bindEvents();
          }
        };
        showOnlyCheckbox.addEventListener('change', this._showOnlyHandler);
      }
      
      // 添加键盘事件监听器：向上键聚焦到输入单价输入框，左右键在扩展模式下导航
      const handleKeyDown = (e) => {
        if (e.key === 'ArrowUp') {
          const winEl = this.floatingWindow.getElement();
          if (!winEl) return;
          
          // 检查窗口是否可见（使用更可靠的方法）
          const style = window.getComputedStyle(winEl);
          const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
          if (!isVisible) return;
          
          const activeElement = document.activeElement;
          if (!activeElement || (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA')) {
            const firstPriceInput = winEl.querySelector('.smart-add-price');
            if (firstPriceInput) {
              e.preventDefault();
              firstPriceInput.focus();
            }
          }
        } else if (e.key === 'ArrowLeft' && this.expandedStock && this.expandedMarket) {
          // 检查是否有智能输入单价的结果显示，如果有，不执行导航
          const resultsContainer = winEl.querySelector('.smart-add-results');
          const isResultsVisible = resultsContainer && window.getComputedStyle(resultsContainer).display !== 'none';
          if (isResultsVisible) return;
          
          // 在扩展模式下导航到上一个股票
          e.preventDefault();
          this.navigateToPrevStock();
        } else if (e.key === 'ArrowRight' && this.expandedStock && this.expandedMarket) {
          // 检查是否有智能输入单价的结果显示，如果有，不执行导航
          const resultsContainer = winEl.querySelector('.smart-add-results');
          const isResultsVisible = resultsContainer && window.getComputedStyle(resultsContainer).display !== 'none';
          if (isResultsVisible) return;
          
          // 在扩展模式下导航到下一个股票
          e.preventDefault();
          this.navigateToNextStock();
        }
      };
      
      // 先移除旧的监听器（避免重复）
      if (this._keyDownHandler) {
        document.removeEventListener('keydown', this._keyDownHandler, true);
      }
      
      // 保存监听器引用并添加到document上
      this._keyDownHandler = handleKeyDown;
      document.addEventListener('keydown', this._keyDownHandler, true);
      
      let draggedStock = null;
      
      // 智能粘性标题功能 - 补充底部固定
      const contentEl = winEl.querySelector('.compact-mode-content');
      const marketTitles = winEl.querySelectorAll('.compact-market-title');
      
      if (contentEl && marketTitles.length > 0) {
        const updateStickyTitles = () => {
          const scrollTop = contentEl.scrollTop;
          const clientHeight = contentEl.clientHeight;
          
          marketTitles.forEach((title) => {
            const section = title.closest('.compact-market-section');
            if (!section) return;
            
            const sectionTop = section.offsetTop;
            const sectionBottom = sectionTop + section.offsetHeight;
            const titleHeight = title.offsetHeight;
            
            // 计算section底部在可视区域的位置
            const sectionBottomInView = sectionBottom - scrollTop;
            
            // 如果section底部进入可视区域，并且section底部距离顶部小于可视区域高度
            if (sectionBottomInView < clientHeight && sectionBottomInView > titleHeight) {
              // 计算需要固定在底部的位置
              title.style.top = 'auto';
              title.style.position = 'sticky';
              title.style.bottom = '0';
            } else {
              // 恢复默认的顶部sticky
              title.style.bottom = 'auto';
              title.style.top = '0';
              title.style.position = 'sticky';
            }
          });
        };
        
        // 初始更新
        updateStickyTitles();
        
        // 监听滚动事件
        contentEl.addEventListener('scroll', updateStickyTitles);
      }
      
      // 智能保存按钮事件 - 每个市场一个
      const smartAddBtns = winEl.querySelectorAll('.smart-add-btn');
      smartAddBtns.forEach(smartAddBtn => {
        const marketName = smartAddBtn.dataset.market;
        const priceInput = winEl.querySelector(`.smart-add-price[data-market="${marketName}"]`);
        const resultsContainer = winEl.querySelector(`.smart-add-results[data-market="${marketName}"]`);
        const stockListContainer = winEl.querySelector(`.smart-add-stock-list[data-market="${marketName}"]`);
        
        if (smartAddBtn && priceInput) {
          const performSmartSave = () => {
          const priceValue = priceInput.value.trim();
          if (!priceValue) {
            const errorMsg = '请输入交易单价';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
          
          // 验证价格输入是否有效
          if (!this.isValidPriceInput(priceValue)) {
            const errorMsg = '请输入有效的单价！';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
          
          if (!currentData) {
            const errorMsg = '无法获取数据，请刷新页面';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
          
          const targetPrice = Math.abs(Number(priceValue));
          if (targetPrice <= 0) {
            const errorMsg = '请输入有效的单价';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
            
            const stockLatestPrices = this.collectStockLatestPrices(currentData, filterDate);
            
            // 跨市场检索最相近的股票（不限制于当前市场）
            const allMarketStockPrices = stockLatestPrices;
            
            if (allMarketStockPrices.length === 0) {
              alert('没有找到匹配的股票');
              return;
            }
            
            // 计算价格差异并排序
            const priceMatches = allMarketStockPrices.map(item => ({
              ...item,
              diff: Math.abs(item.price - targetPrice)
            })).sort((a, b) => a.diff - b.diff).slice(0, 3);
            
            if (priceMatches.length === 0) {
              alert('没有找到匹配的股票');
              return;
            }
            
            // 显示匹配结果
            const getDecimalPlaces = (priceStr) => {
              const str = priceStr.toString();
              if (str.includes('.')) {
                return str.split('.')[1].length;
              }
              return 0;
            };
            
            const inputPriceStr = priceValue.startsWith('-') ? priceValue.slice(1) : priceValue;
            const inputDecimalPlaces = getDecimalPlaces(inputPriceStr);
            
            stockListContainer.innerHTML = priceMatches.map((item, index) => {
              const itemDecimalPlaces = getDecimalPlaces(item.price);
              const decimalPlaces = Math.max(itemDecimalPlaces, inputDecimalPlaces);
              const displayDecimalPlaces = Math.max(decimalPlaces, 2);
              const diffPercent = item.price > 0 ? (item.diff / item.price * 100) : 0;
              const diffPercentStr = diffPercent.toFixed(2) + '%';
              return `
                <button class="smart-add-stock-btn" 
                        data-stock="${item.stock}" 
                        data-market="${item.market}" 
                        data-price="${item.price}"
                        data-side="${item.side}"
                        data-source-market="${marketName}"
                        data-index="${index}"
                        data-diff-percent="${diffPercent}"
                        style="padding: 6px 12px; border: 2px solid ${index === 0 ? '#10b981' : '#3b82f6'}; border-radius: 6px; background: ${index === 0 ? '#d1fae5' : 'white'}; color: ${index === 0 ? '#065f46' : '#3b82f6'}; font-size: 12px; font-weight: bold; cursor: pointer;">
                  ${item.stock} (${item.side === 'buy' ? '买' : '卖'}${item.price} → 差${item.diff.toFixed(displayDecimalPlaces)} (${diffPercentStr}))
                </button>
              `;
            }).join('');
            
            resultsContainer.style.display = 'block';
            
            // 语音播报匹配的股票建议
            try {
              const getDecimalPlaces = (priceStr) => {
                const str = priceStr.toString();
                if (str.includes('.')) {
                  return str.split('.')[1].length;
                }
                return 0;
              };
              
              const inputPriceStr2 = priceValue.startsWith('-') ? priceValue.slice(1) : priceValue;
              const inputDecimalPlaces2 = getDecimalPlaces(inputPriceStr2);
              
              const inputIsSell = priceValue.startsWith('-');
              const inputPrice = Math.abs(Number(priceValue));
              
              // 开头只播报一次"本次买入/卖出价格"，后续每个建议只播报"上次..."
              const speechTexts = priceMatches.map((item, index) => {
                return `上次${item.side === 'buy' ? '买入' : '卖出'}${item.stock}${item.price}`;
              });
              
              const fullSpeechText = `本次${inputIsSell ? '卖出' : '买入'}${inputPrice}。` + speechTexts.join('。');
              
              if ('speechSynthesis' in window) {
                // 先设置键盘导航和聚焦（在播报之前）
                const stockBtns = stockListContainer.querySelectorAll('.smart-add-stock-btn');
                
                if (stockBtns.length > 0) {
                  let currentIndex = 0;
                  const pairingProfitsContainer = winEl.querySelector(`.smart-add-pairing-profits[data-market="${marketName}"]`);
                  const inputPriceForPairing = Math.abs(Number(priceValue));
                  const inputSideForPairing = priceValue.startsWith('-') ? 'sell' : 'buy';
                  
                  // 聚焦按钮并高亮显示
                  const focusButton = (index) => {
                    stockBtns.forEach(btn => {
                      btn.style.outline = '';
                      btn.style.boxShadow = '';
                      btn.style.transform = '';
                    });
                    
                    const currentBtn = stockBtns[index];
                    currentBtn.style.outline = '3px solid #f59e0b';
                    currentBtn.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
                    currentBtn.style.transform = 'scale(1.05)';
                    currentBtn.focus();
                    
                    this.showPairingProfitSuggestions(
                      currentBtn.dataset.stock,
                      inputPriceForPairing,
                      inputSideForPairing,
                      pairingProfitsContainer
                    );
                  };
                  
                  // 先清理旧的键盘导航监听器和语音定时器
                  this.cleanupSmartAddSpeech();
                  
                  // 键盘导航事件
                  const handleKeyNav = (e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      
                      if (e.key === 'ArrowRight') {
                        currentIndex = (currentIndex + 1) % stockBtns.length;
                      } else if (e.key === 'ArrowLeft') {
                        currentIndex = (currentIndex - 1 + stockBtns.length) % stockBtns.length;
                      }
                      
                      focusButton(currentIndex);
                      
                      if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        
                        const currentBtn = stockBtns[currentIndex];
                        const stockName = currentBtn.dataset.stock;
                        const btnPriceValue = currentBtn.dataset.price;
                        const btnIsSell = currentBtn.dataset.side === 'sell';
                        const btnPrice = Math.abs(Number(btnPriceValue));
                        
                        let currentSpeechText = `上次${btnIsSell ? '卖出' : '买入'}${stockName}${btnPrice}`;
                        
                        const timerId = setTimeout(() => {
                          window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentSpeechText));
                        }, 50);
                        this._smartAddSpeechTimers.push(timerId);
                      }
                    } else if (e.key === 'Escape' || e.key === 'ArrowUp') {
                      e.preventDefault();
                      
                      if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                      
                      resultsContainer.style.display = 'none';
                      
                      if (pairingProfitsContainer) {
                        pairingProfitsContainer.style.display = 'none';
                      }
                      
                      stockBtns.forEach(btn => {
                        btn.style.outline = '';
                        btn.style.boxShadow = '';
                        btn.style.transform = '';
                      });
                      
                      priceInput.focus();
                      
                      if (e.key === 'ArrowUp') {
                        const currentPriceValue = priceInput.value.trim();
                        if (currentPriceValue !== '' && 'speechSynthesis' in window) {
                          const currentIsSell = currentPriceValue.startsWith('-');
                          const currentPrice = Math.abs(Number(currentPriceValue));
                          const currentSpeechText = `本次${currentIsSell ? '卖出' : '买入'}${currentPrice}。`;
                          
                          const timerId = setTimeout(() => {
                            window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentSpeechText));
                          }, 200);
                          this._smartAddSpeechTimers.push(timerId);
                        }
                      }
                      
                      document.removeEventListener('keydown', handleKeyNav);
                      if (this._smartAddKeyNavHandler === handleKeyNav) {
                        this._smartAddKeyNavHandler = null;
                      }
                    }
                  };
                  
                  this._smartAddKeyNavHandler = handleKeyNav;
                  document.addEventListener('keydown', handleKeyNav);
                  
                  // 为每个股票按钮添加点击事件，显示配对利润建议
                  const ppc = pairingProfitsContainer;
                  const ipp = inputPriceForPairing;
                  const isp = inputSideForPairing;
                  stockBtns.forEach((btn, btnIdx) => {
                    btn.addEventListener('click', () => {
                      this.showPairingProfitSuggestions(btn.dataset.stock, ipp, isp, ppc);
                      currentIndex = btnIdx;
                      focusButton(btnIdx);
                    });
                  });
                  
                  // 立即聚焦第一个按钮
                  setTimeout(() => {
                    focusButton(0);
                  }, 50);
                }
                
                // 开始语音播报
                const utterance = new SpeechSynthesisUtterance(fullSpeechText);
                utterance.lang = 'zh-CN';
                utterance.rate = 1.0;
                utterance.pitch = 1.0;
                utterance.volume = 1.0;
                
                window.speechSynthesis.cancel();
                setTimeout(() => {
                  window.speechSynthesis.speak(utterance);
                }, 100);
              } else {
                // 如果不支持语音播报，直接设置键盘导航
                const stockBtns = stockListContainer.querySelectorAll('.smart-add-stock-btn');
                if (stockBtns.length > 0) {
                  let currentIndex = 0;
                  const pairingProfitsContainer2 = winEl.querySelector(`.smart-add-pairing-profits[data-market="${marketName}"]`);
                  const inputPriceForPairing2 = Math.abs(Number(priceValue));
                  const inputSideForPairing2 = priceValue.startsWith('-') ? 'sell' : 'buy';
                  
                  this.cleanupSmartAddSpeech();
                  
                  const focusButton = (index) => {
                    stockBtns.forEach(btn => {
                      btn.style.outline = '';
                      btn.style.boxShadow = '';
                      btn.style.transform = '';
                    });
                    
                    const currentBtn = stockBtns[index];
                    currentBtn.style.outline = '3px solid #f59e0b';
                    currentBtn.style.boxShadow = '0 0 10px rgba(245, 158, 11, 0.5)';
                    currentBtn.style.transform = 'scale(1.05)';
                    currentBtn.focus();
                    
                    this.showPairingProfitSuggestions(
                      currentBtn.dataset.stock,
                      inputPriceForPairing2,
                      inputSideForPairing2,
                      pairingProfitsContainer2
                    );
                  };
                  
                  setTimeout(() => {
                    focusButton(0);
                  }, 100);
                  
                  const handleKeyNav = (e) => {
                    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                      e.preventDefault();
                      
                      if (e.key === 'ArrowRight') {
                        currentIndex = (currentIndex + 1) % stockBtns.length;
                      } else if (e.key === 'ArrowLeft') {
                        currentIndex = (currentIndex - 1 + stockBtns.length) % stockBtns.length;
                      }
                      
                      focusButton(currentIndex);
                      
                      if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                        
                        const currentBtn = stockBtns[currentIndex];
                        const stockName = currentBtn.dataset.stock;
                        const btnPriceValue2 = currentBtn.dataset.price;
                        const btnIsSell2 = btnPriceValue2.startsWith('-');
                        const btnPrice2 = Math.abs(Number(btnPriceValue2));
                        
                        let currentSpeechText = `上次${btnIsSell2 ? '卖出' : '买入'}${stockName}${btnPrice2}`;
                        
                        const timerId = setTimeout(() => {
                          window.speechSynthesis.speak(new SpeechSynthesisUtterance(currentSpeechText));
                        }, 50);
                        this._smartAddSpeechTimers.push(timerId);
                      }
                    } else if (e.key === 'Escape') {
                      e.preventDefault();
                      
                      if ('speechSynthesis' in window) {
                        window.speechSynthesis.cancel();
                      }
                      
                      resultsContainer.style.display = 'none';
                      
                      if (pairingProfitsContainer2) {
                        pairingProfitsContainer2.style.display = 'none';
                      }
                      
                      stockBtns.forEach(btn => {
                        btn.style.outline = '';
                        btn.style.boxShadow = '';
                        btn.style.transform = '';
                      });
                      
                      priceInput.focus();
                      
                      document.removeEventListener('keydown', handleKeyNav);
                      if (this._smartAddKeyNavHandler === handleKeyNav) {
                        this._smartAddKeyNavHandler = null;
                      }
                    }
                  };
                  
                  this._smartAddKeyNavHandler = handleKeyNav;
                  document.addEventListener('keydown', handleKeyNav);
                  
                  const ppc2 = pairingProfitsContainer2;
                  const ipp2 = inputPriceForPairing2;
                  const isp2 = inputSideForPairing2;
                  stockBtns.forEach((btn, btnIdx) => {
                    btn.addEventListener('click', () => {
                      this.showPairingProfitSuggestions(btn.dataset.stock, ipp2, isp2, ppc2);
                      currentIndex = btnIdx;
                      focusButton(btnIdx);
                    });
                  });
                }
              }
            } catch (speechError) {
              console.error('语音播报失败:', speechError);
            }
            
            // 绑定股票选择事件
            const stockBtns = stockListContainer.querySelectorAll('.smart-add-stock-btn');
            stockBtns.forEach(btn => {
              btn.addEventListener('click', async () => {
                const diffPercent = parseFloat(btn.dataset.diffPercent);
                
                if (isNaN(diffPercent)) {
                  const errorMsg = '价格计算异常，禁止保存！';
                  this.speakErrorAndAlert(errorMsg);
                  return;
                }
                
                if (diffPercent > 15) {
                  const errorMsg = `差异百分比 (${diffPercent.toFixed(2)}%) 超过15%，可能是误输入，禁止保存！`;
                  this.speakErrorAndAlert(errorMsg);
                  return;
                }
                
                this.cleanupSmartAddSpeech();
                
                const stockName = btn.dataset.stock;
                const market = btn.dataset.market;
                const sourceMarket = btn.dataset.sourceMarket;
                
                // 获取用户输入的价格
                const inputPriceValue = priceInput.value.trim();
                const isSell = inputPriceValue.startsWith('-');
                const price = Math.abs(Number(inputPriceValue));
                
                if (price <= 0) {
                  this.speakErrorAndAlert('请输入有效的单价');
                  return;
                }
                
                const stockInfo = this._findStockByName(stockName);
                if (!stockInfo) {
                  this.speakErrorAndAlert('未在清单找到该股票');
                  return;
                }
                
                const qty = stockInfo.qty;
                const amount = qty * price;
                const now = new Date();
                
                // 使用本地时间而非UTC时间（修复时区问题）
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, '0');
                const day = String(now.getDate()).padStart(2, '0');
                const localDateStr = `${year}-${month}-${day}`;
                const hours = String(now.getHours()).padStart(2, '0');
                const minutes = String(now.getMinutes()).padStart(2, '0');
                const seconds = String(now.getSeconds()).padStart(2, '0');
                const localTimeStr = `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
                
                const newTrade = {
                  id: Date.now().toString(),
                  date: localDateStr,
                  createdAt: localTimeStr,
                  market,
                  stock: stockName,
                  side: isSell ? 'sell' : 'buy',
                  qty,
                  price,
                  amount,
                  remark: ''
                };
                
                try {
                  if (window.tradesDB && window.tradesDB.save) {
                    await window.tradesDB.save(newTrade);
                    
                    if (window.loadTrades) {
                      await window.loadTrades();
                    }
                    
                    const newData = this.collectData(filterDate);
                    const content = this.renderCompactView(newData, filterDate);
                    this.floatingWindow.setContent(content);
                    this.bindEvents();
                    this.applyBubbleScale();
                    
                    // 检查是否处于扩展模式，如果是，切换到被保存的股票
                    if (this.expandedStock && this.expandedMarket) {
                      this.expandedStock = stockName;
                      this.expandedMarket = market;
                      // 重新渲染以切换到新股票
                      const dataAfterSwitch = this.collectData(filterDate);
                      const contentAfterSwitch = this.renderCompactView(dataAfterSwitch, filterDate);
                      this.floatingWindow.setContent(contentAfterSwitch);
                      this.bindEvents();
                      this.applyBubbleScale();
                    }
                    
                    // 滚动到新增交易所属的股票卡片位置
                    this.scrollToStock(stockName);
                    
                    // 延迟显示成功提示和重新聚焦，让滚动先完成
                    setTimeout(() => {
                    this.showTemporaryMessage(`交易新增成功！\n股票：${stockName}\n价格：${isSell ? '-' : ''}${price}`);
                    
                    const newPriceInput = this.floatingWindow.getElement().querySelector(`.smart-add-price[data-market="${sourceMarket}"]`);
                    if (newPriceInput) {
                      newPriceInput.value = '';
                      newPriceInput.focus({ preventScroll: true });
                    }
                    this.scrollToStock(stockName);
                  }, 350);
                  } else {
                    this.speakErrorAndAlert('交易数据库未初始化');
                  }
                } catch (error) {
                  console.error('新增交易失败:', error);
                  this.speakErrorAndAlert('新增交易失败: ' + error.message);
                }
              });
            });
          };
          
          smartAddBtn.addEventListener('click', performSmartSave);
          
          // 输入框内容变化时隐藏建议
          priceInput.addEventListener('input', () => {
            resultsContainer.style.display = 'none';
          });
          
          // 输入框按 Enter = 智能保存
          priceInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              
              // 如果结果已经显示，按 Enter 选择第一个
              if (resultsContainer.style.display === 'block') {
                const firstBtn = stockListContainer.querySelector('.smart-add-stock-btn');
                if (firstBtn) {
                  firstBtn.click();
                }
              } else {
                // 结果没显示，按 Enter = 智能保存
                performSmartSave();
              }
            }
          });
        }
      });
      
      // 拖拽开始 - 只有在头部区域才能拖拽卡片
      const stockCards = winEl.querySelectorAll('.compact-stock-card');
      stockCards.forEach(card => {
        const header = card.querySelector('.compact-stock-header');
        
        // 只允许从头部区域拖拽卡片
        if (header) {
          header.setAttribute('draggable', 'true');
          header.addEventListener('dragstart', (e) => {
            draggedStock = card.dataset.stockName;
            card.style.opacity = '0.5';
            e.dataTransfer.effectAllowed = 'move';
            e.stopPropagation();
          });
          
          header.addEventListener('dragend', (e) => {
            card.style.opacity = '';
            draggedStock = null;
            e.stopPropagation();
            // 清除所有提示样式
            stockCards.forEach(c => c.classList.remove('drag-over', 'drag-over-left', 'drag-over-right'));
          });
        }
        
        // 卡片的拖拽相关事件
        card.addEventListener('dragover', (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          
          const targetCard = e.currentTarget;
          const rect = targetCard.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const midX = rect.width / 2;
          
          // 清除其他卡片的提示
          stockCards.forEach(c => {
            if (c !== targetCard) {
              c.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
            }
          });
          
          // 添加位置提示
          targetCard.classList.add('drag-over');
          targetCard.classList.remove('drag-over-left', 'drag-over-right');
          
          if (x < midX) {
            targetCard.classList.add('drag-over-left');
          } else {
            targetCard.classList.add('drag-over-right');
          }
        });
        
        card.addEventListener('dragleave', (e) => {
          e.currentTarget.classList.remove('drag-over', 'drag-over-left', 'drag-over-right');
        });
        
        card.addEventListener('drop', (e) => {
          e.preventDefault();
          const targetStock = e.currentTarget.dataset.stockName;
          
          if (draggedStock && targetStock && draggedStock !== targetStock) {
            this.reorderStocks(draggedStock, targetStock);
          }
          
          // 清除所有提示样式
          stockCards.forEach(c => c.classList.remove('drag-over', 'drag-over-left', 'drag-over-right'));
        });
      });

      // 为紧凑模式气泡添加拖拽功能（用于手动配对）
      const compactBubbles = winEl.querySelectorAll('.compact-bubble');
      compactBubbles.forEach(bubble => {
        if (bubble.classList.contains('draggable')) return;
        
        bubble.classList.add('draggable');
        bubble.setAttribute('draggable', 'true');
        
        bubble.addEventListener('dragstart', (e) => {
          e.stopPropagation();
          bubble.classList.add('dragging');
          
          // 从data-trade属性获取交易数据
          const tradeDataStr = bubble.dataset.trade;
          if (tradeDataStr) {
            try {
              const trade = JSON.parse(tradeDataStr);
              const dragData = {
                type: 'trade',
                trade: trade
              };
              e.dataTransfer.setData('application/json', JSON.stringify(dragData));
              e.dataTransfer.effectAllowed = 'copy';
            } catch (err) {
              console.error('解析交易数据失败:', err);
            }
          }
        });
        
        bubble.addEventListener('dragend', (e) => {
          e.stopPropagation();
          bubble.classList.remove('dragging');
        });
      });

      // 为颜色选择器添加事件（使用 HTML 原生 label 关联，兼容 iPhone Safari）
      const colorWrappers = winEl.querySelectorAll('.compact-stock-color-wrapper');
      colorWrappers.forEach(wrapper => {
        const picker = wrapper.querySelector('.compact-stock-color-picker-hidden');
        const inner = wrapper.querySelector('.compact-stock-color-inner');
        const stockName = wrapper.dataset.stock;
        
        // 监听颜色选择器的 input 和 change 事件
        const handleColorChange = (e) => {
          let color = e.target.value;
          
          // 如果选择白色，视为清除颜色
          if (color === '#ffffff') {
            color = '';
          }
          
          if (color) {
            this.stockColors[stockName] = color;
            inner.style.backgroundColor = color;
          } else {
            delete this.stockColors[stockName];
            inner.style.backgroundColor = 'transparent';
          }
          
          this.saveSettings();
          
          // 更新卡片背景色和折页符号颜色
          const stockCard = wrapper.closest('.compact-stock-card');
          if (stockCard) {
            if (color) {
              stockCard.style.backgroundColor = color;
              const darkerColor = this.darkenColor(color);
              stockCard.style.setProperty('--corner-color', darkerColor);
              stockCard.dataset.cardColor = color;
            } else {
              stockCard.style.backgroundColor = '';
              stockCard.style.removeProperty('--corner-color');
              delete stockCard.dataset.cardColor;
            }
          }
        };
        
        if (picker) {
          picker.addEventListener('input', handleColorChange);
          picker.addEventListener('change', handleColorChange);
        }
        
        // 备选方案：如果 label 关联不起作用（某些特殊情况），使用 JS 触发
        // 但优先使用原生机制（已在模板中使用 <label for="..."> 实现）
      });

      const copyBtn = winEl.querySelector('#copyToClipboardBtn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => this.copyToClipboard());
      }

      const exportBtn = winEl.querySelector('#exportTextBtn');
      if (exportBtn) {
        exportBtn.addEventListener('click', () => this.exportAsText());
      }

      const printBtn = winEl.querySelector('#printBtn');
      if (printBtn) {
        printBtn.addEventListener('click', () => this.printView());
      }

      const viewToggleBtn = winEl.querySelector('#viewToggleBtn');
      if (viewToggleBtn) {
        viewToggleBtn.addEventListener('click', () => this.toggleViewMode());
      }

      // 为市场折叠/展开按钮添加事件
      const marketToggles = winEl.querySelectorAll('.compact-market-toggle');
      marketToggles.forEach(toggle => {
        toggle.addEventListener('click', (e) => {
          const marketName = e.target.dataset.market;
          if (this.collapsedMarkets.has(marketName)) {
            this.collapsedMarkets.delete(marketName);
          } else {
            this.collapsedMarkets.add(marketName);
          }
          this.saveSettings();
          // 重新渲染
          const filterDateInput = document.getElementById('filterDate');
          const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
          if (filterDate) {
            const data = this.collectData(filterDate);
            const content = this.renderCompactView(data, filterDate);
            this.floatingWindow.setContent(content);
            this.bindEvents();
            this.applyBubbleScale();
          }
        });
      });
      
      // 为历史数据切换区域添加点击事件（仅处理没有checkbox的情况，即交易建议视图）
      const sectionToggles = winEl.querySelectorAll('.compact-section-toggle');
      sectionToggles.forEach(toggle => {
        // 检查是否有checkbox
        const hasCheckbox = toggle.querySelector('input[type="checkbox"]');
        if (!hasCheckbox) {
          toggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const container = toggle.nextElementSibling;
            
            if (container && container.classList.contains('compact-history-container')) {
              if (container.style.display === 'none') {
                container.style.display = '';
              } else {
                container.style.display = 'none';
              }
            }
          });
        }
      });

      // 为卖出阈值输入框添加事件
      const sellThresholdInputs = winEl.querySelectorAll('.compact-threshold-input[id^="sell-threshold-"]');
      sellThresholdInputs.forEach(input => {
        input.addEventListener('input', (e) => {
          const stockName = e.target.id.replace('sell-threshold-', '');
          const threshold = parseFloat(e.target.value);
          if (!isNaN(threshold) && threshold >= -10 && threshold <= 10) {
            this.stockThresholds[stockName] = threshold;
            this.saveSettings();
            this.calculateSuggestedPrices(stockName);
          }
        });
      });
      
      // 为买入阈值输入框添加事件
      const buyThresholdInputs = winEl.querySelectorAll('.compact-threshold-input[id^="buy-threshold-"]');
      buyThresholdInputs.forEach(input => {
        input.addEventListener('input', (e) => {
          const stockName = e.target.id.replace('buy-threshold-', '');
          const threshold = parseFloat(e.target.value);
          if (!isNaN(threshold) && threshold >= -10 && threshold <= 10) {
            this.stockBuyThresholds[stockName] = threshold;
            this.saveSettings();
            this.calculateSuggestedPrices(stockName);
          }
        });
      });

      // 初始化时计算所有股票的建议价格
      const allStockCards = winEl.querySelectorAll('.compact-stock-card');
      allStockCards.forEach(card => {
        const stockName = card.dataset.stockName;
        if (stockName) {
          this.calculateSuggestedPrices(stockName);
        }
      });

      // 为股票折叠/展开按钮添加事件
      const stockCollapseBtns = winEl.querySelectorAll('.compact-stock-collapse');
      stockCollapseBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          const stockName = e.target.dataset.stock;
          if (this.collapsedStocks.has(stockName)) {
            this.collapsedStocks.delete(stockName);
          } else {
            this.collapsedStocks.add(stockName);
          }
          this.saveSettings();
          
          // 重新渲染视图以更新Z模式导航的股票集合（排除折叠的股票）
          const filterDateInput = document.getElementById('filterDate');
          const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
          if (filterDate) {
            const data = this.collectData(filterDate);
            const content = this.renderCompactView(data, filterDate);
            this.floatingWindow.setContent(content);
            this.bindEvents();
            this.applyBubbleScale();
          }
        });
      });

      // 为历史天数输入框添加事件
      const historyDaysInput = winEl.querySelector('#historyDaysInput');
      if (historyDaysInput) {
        historyDaysInput.addEventListener('input', () => {
          const newDays = parseInt(historyDaysInput.value);
          if (!isNaN(newDays) && newDays >= 1) {
            // 安全限制：最大50天
            this.historyDays = Math.min(newDays, 50);
            this.saveSettings();
            // 重新渲染
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (filterDate) {
              const data = this.collectData(filterDate);
              const content = this.renderCompactView(data, filterDate);
              this.floatingWindow.setContent(content);
              this.bindEvents();
              this.applyBubbleScale();
            }
          }
        });
      }

      // 为气泡缩放输入框添加事件
      const bubbleScaleInput = winEl.querySelector('#bubbleScaleInput');
      if (bubbleScaleInput) {
        bubbleScaleInput.addEventListener('input', () => {
          const newScale = parseInt(bubbleScaleInput.value);
          if (!isNaN(newScale) && newScale >= 50 && newScale <= 200) {
            this.bubbleScale = newScale / 100;
            this.saveSettings();
            this.applyBubbleScale();
            // 更新输入框显示（为了四舍五入）
            bubbleScaleInput.value = Math.round(this.bubbleScale * 100);
          }
        });
      }

      // 为历史配对气泡复选框添加事件
      const historyPairedBubblesCheckbox = winEl.querySelector('#showHistoryPairedBubblesCheckbox');
      if (historyPairedBubblesCheckbox) {
        historyPairedBubblesCheckbox.addEventListener('change', () => {
          this.showHistoryPairedBubbles = historyPairedBubblesCheckbox.checked;
          this.saveSettings();
          // 重新渲染
          const filterDateInput = document.getElementById('filterDate');
          const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
          if (filterDate) {
            const data = this.collectData(filterDate);
            const content = this.renderCompactView(data, filterDate);
            this.floatingWindow.setContent(content);
            this.bindEvents();
            this.applyBubbleScale();
          }
        });
      }

      // 为历史配对气泡天数输入框添加事件
      const historyPairedDaysInput = winEl.querySelector('#historyPairedDaysInput');
      if (historyPairedDaysInput) {
        historyPairedDaysInput.addEventListener('input', () => {
          this.historyPairedDays = historyPairedDaysInput.value;
          this.saveSettings();
          // 重新渲染
          const filterDateInput = document.getElementById('filterDate');
          const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
          if (filterDate) {
            const data = this.collectData(filterDate);
            const content = this.renderCompactView(data, filterDate);
            this.floatingWindow.setContent(content);
            this.bindEvents();
            this.applyBubbleScale();
          }
        });
      }

      // 为历史数据-按日显示切换checkbox添加事件
      const historyByDateToggles = winEl.querySelectorAll('.compact-history-toggle[data-toggle="history-by-date"]');
      historyByDateToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
          this.showHistoryByDate = e.target.checked;
          this.saveSettings();
          const toggleContainer = e.target.closest('.compact-section-toggle');
          const nextElement = toggleContainer.nextElementSibling;
          if (nextElement && nextElement.classList.contains('compact-history-container')) {
            nextElement.style.display = this.showHistoryByDate ? '' : 'none';
          }
        });
      });

      // 为历史数据-按买卖排序显示切换checkbox添加事件
      const historyBySideToggles = winEl.querySelectorAll('.compact-history-toggle[data-toggle="history-by-side"]');
      historyBySideToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
          this.showHistoryBySide = e.target.checked;
          this.saveSettings();
          const toggleContainer = e.target.closest('.compact-section-toggle');
          const nextElement = toggleContainer.nextElementSibling;
          if (nextElement && nextElement.classList.contains('compact-history-container')) {
            nextElement.style.display = this.showHistoryBySide ? '' : 'none';
          }
        });
      });

      // 为股票切换checkbox添加事件
      const stockToggles = winEl.querySelectorAll('.compact-stock-toggle');
      stockToggles.forEach(toggle => {
        toggle.addEventListener('change', (e) => {
          const stockName = e.target.dataset.stock;
          if (!e.target.checked) {
            // 保存滚动位置
            const contentEl = winEl.querySelector('.compact-mode-content');
            const scrollPosition = contentEl ? contentEl.scrollTop : 0;
            
            // 隐藏股票
            this.hiddenStocks.add(stockName);
            this.saveSettings();
            const stockCard = e.target.closest('.compact-stock-card');
            if (stockCard) {
              stockCard.style.display = 'none';
            }
            // 重新渲染以更新下拉列表
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (filterDate) {
              const data = this.collectData(filterDate);
              const content = this.renderCompactView(data, filterDate);
              this.floatingWindow.setContent(content);
              this.bindEvents();
              this.applyBubbleScale();
              
              // 恢复滚动位置
              const newContentEl = this.floatingWindow.getElement().querySelector('.compact-mode-content');
              if (newContentEl) {
                newContentEl.scrollTop = scrollPosition;
              }
            }
          }
        });
      });

      // 为被隐藏股票下拉清单添加事件
      const hiddenStocksSelect = winEl.querySelector('#hiddenStocksSelect');
      if (hiddenStocksSelect) {
        hiddenStocksSelect.addEventListener('change', (e) => {
          const stockName = e.target.value;
          if (stockName) {
            // 保存滚动位置
            const contentEl = winEl.querySelector('.compact-mode-content');
            const scrollPosition = contentEl ? contentEl.scrollTop : 0;
            
            // 显示股票
            this.hiddenStocks.delete(stockName);
            this.saveSettings();
            // 重新渲染以更新画面
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (filterDate) {
              const data = this.collectData(filterDate);
              const content = this.renderCompactView(data, filterDate);
              this.floatingWindow.setContent(content);
              this.bindEvents();
              this.applyBubbleScale();
              
              // 定位到新增交易所属的股票卡片
              this.scrollToStock(stockName);
            }
          }
          // 重置下拉选择
          e.target.value = '';
        });
      }

      // 为+按钮添加点击事件
      const addTradeBtns = winEl.querySelectorAll('.add-trade-btn');
      addTradeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockCard = btn.closest('.compact-stock-card');
          const quickAddContainer = stockCard.querySelector('.compact-quick-add');
          
          // 切换显示/隐藏状态
          if (quickAddContainer.style.display === 'none') {
            quickAddContainer.style.display = 'block';
            // 自动聚焦到输入框
            const priceInput = quickAddContainer.querySelector('.quick-add-price');
            if (priceInput) priceInput.focus();
          } else {
            quickAddContainer.style.display = 'none';
          }
        });
      });

      // 为历史数据按钮添加点击事件
      const historyBtns = winEl.querySelectorAll('.history-btn');
      historyBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          const market = btn.dataset.market;
          
          // 获取交易数据和配对缓存
          const trades = window.trades || [];
          const pairingCache = window.pairingCache || {};
          
          // 使用历史数据插件显示弹窗
          if (window.HistoryDataPlugin) {
            const historyPlugin = new HistoryDataPlugin();
            historyPlugin.showPopup(stockName, market);
          } else {
            this.speakErrorAndAlert('历史数据插件未加载');
          }
        });
      });

      // 为当日配对按钮添加点击事件
      const dailyPairBtns = winEl.querySelectorAll('.daily-pair-btn');
      dailyPairBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          if (!stockName) return;

          // 保存滚动位置
          const contentEl = winEl.querySelector('.compact-mode-content');
          const scrollPosition = contentEl ? contentEl.scrollTop : 0;

          // 获取该股票的今日交易
          const trades = window.trades || [];
          const pairingCache = window.pairingCache || {};
          const getTodayDate = window.getTodayDate;
          const findBestPairsMinimized = window.findBestPairsMinimized;
          const tradesDB = window.tradesDB;
          const renderStockModeTable = window.renderStockModeTable;
          const loadTrades = window.loadTrades;

          if (!getTodayDate || !findBestPairsMinimized || !tradesDB) {
            this.speakErrorAndAlert('必要的函数未定义，无法执行当日配对');
            return;
          }

          const today = getTodayDate();
          const stockTodayTrades = trades.filter(t => t.stock === stockName && t.date === today).map(t => ({...t, price: Number(t.price)}));
          if (stockTodayTrades.length === 0) {
            this.speakErrorAndAlert('该股票今天没有交易记录');
            return;
          }

          // 读取已有配对，排除已配对交易
          const existing = pairingCache[stockName] || {};
          const existingBuyIds = new Set(existing.pairedBuyIds || []);
          const existingSellIds = new Set(existing.pairedSellIds || []);

          const todayBuys = stockTodayTrades.filter(t => t.side === 'buy' && !existingBuyIds.has(t.id));
          const todaySells = stockTodayTrades.filter(t => t.side === 'sell' && !existingSellIds.has(t.id));

          if (todayBuys.length === 0 || todaySells.length === 0) {
            this.speakErrorAndAlert('今天没有足够的未配对买/卖记录可用于配对');
            return;
          }

          // 使用配对算法进行配对（利润最小化，尽可能配对更多数据）
          const pairingResult = findBestPairsMinimized(todayBuys, todaySells, stockName);
          if (!pairingResult || !pairingResult.pairedTrades || pairingResult.pairedTrades.length === 0) {
            this.speakErrorAndAlert('未找到有利可图的当日配对');
            return;
          }

          // 保留原有配对，只追加新配对
          window.pairingCache = window.pairingCache || {};
          window.pairingCache[stockName] = window.pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
          const existingPairedTrades = window.pairingCache[stockName].pairedTrades || [];
          const existingPairedBuyIds = window.pairingCache[stockName].pairedBuyIds || [];
          const existingPairedSellIds = window.pairingCache[stockName].pairedSellIds || [];

          // 追加新配对到原有配对中
          window.pairingCache[stockName] = {
            pairedTrades: [...existingPairedTrades, ...pairingResult.pairedTrades],
            pairedBuyIds: [...existingPairedBuyIds, ...pairingResult.pairedTrades.map(p => p.buy.id)],
            pairedSellIds: [...existingPairedSellIds, ...pairingResult.pairedTrades.map(p => p.sell.id)]
          };

          try {
            await tradesDB.savePairing({
              stockName: stockName,
              pairedTrades: window.pairingCache[stockName].pairedTrades,
              pairedBuyIds: window.pairingCache[stockName].pairedBuyIds,
              pairedSellIds: window.pairingCache[stockName].pairedSellIds
            });

            // 重新加载交易数据
            if (loadTrades) {
              await loadTrades();
            }

            // 刷新主程式的资料
            if (renderStockModeTable) {
              await renderStockModeTable();
            }

            // 重新渲染紧凑模式（所有设定会保持原样）
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (filterDate) {
              const data = this.collectData(filterDate);
              const content = this.renderCompactView(data, filterDate);
              this.floatingWindow.setContent(content);
              this.bindEvents();
              this.applyBubbleScale();
              
              // 恢复滚动位置
              const newContentEl = this.floatingWindow.getElement().querySelector('.compact-mode-content');
              if (newContentEl) {
                newContentEl.scrollTop = scrollPosition;
              }
            }

            alert(`当日配对成功！配对了 ${pairingResult.pairedTrades.length} 笔交易`);
          } catch (err) {
            console.error('保存当日配对失败:', err);
            this.speakErrorAndAlert('保存配对失败: ' + err.message);
          }
        });
      });

      // 为手动配对按钮添加点击事件
      const manualPairBtns = winEl.querySelectorAll('.manual-pair-btn');
      manualPairBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          if (!stockName) return;

          // 打开手动配对窗口，并指定股票
          if (window.openManualPairWindowForStock) {
            window.openManualPairWindowForStock(stockName);
          } else {
            this.speakErrorAndAlert('手动配对功能未加载');
          }
        });
      });

      // 为刷新按钮添加点击事件
      const refreshStockBtns = winEl.querySelectorAll('.refresh-stock-btn');
      refreshStockBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          if (!stockName) return;

          // 保存滚动位置
          const contentEl = winEl.querySelector('.compact-mode-content');
          const scrollPosition = contentEl ? contentEl.scrollTop : 0;

          try {
            // 重新加载交易数据
            if (window.loadTrades) {
              await window.loadTrades();
            }

            // 刷新主程式的资料
            if (window.renderStockModeTable) {
              await window.renderStockModeTable();
            }

            // 重新渲染紧凑模式
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (filterDate) {
              const data = this.collectData(filterDate);
              const content = this.renderCompactView(data, filterDate);
              this.floatingWindow.setContent(content);
              this.bindEvents();
              this.applyBubbleScale();
              
              // 恢复滚动位置
              const newContentEl = this.floatingWindow.getElement().querySelector('.compact-mode-content');
              if (newContentEl) {
                newContentEl.scrollTop = scrollPosition;
              }
            }

            // 显示刷新成功提示
            btn.style.background = '#10b981';
            setTimeout(() => {
              btn.style.background = '';
            }, 500);
          } catch (err) {
            console.error('刷新股票资料失败:', err);
            this.speakErrorAndAlert('刷新失败: ' + err.message);
          }
        });
      });

      // 为卡片扩展按钮添加点击事件
      const expandCardBtns = winEl.querySelectorAll('.expand-card-btn');
      expandCardBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          const marketName = btn.dataset.market;
          if (!stockName || !marketName) return;
          
          let scrollToStock = null;
          let scrollToMarket = null;
          
          // 切换扩展模式
          if (this.expandedStock === stockName && this.expandedMarket === marketName) {
            // 已经是扩展模式，取消扩展 - 记录要滚动到的股票
            scrollToStock = stockName;
            scrollToMarket = marketName;
            this.expandedStock = null;
            this.expandedMarket = null;
          } else {
            // 进入扩展模式
            this.expandedStock = stockName;
            this.expandedMarket = marketName;
          }
          
          // 重新渲染
          const filterDateInput = document.getElementById('filterDate');
          const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
          if (filterDate) {
            const data = this.collectData(filterDate);
            const content = this.renderCompactView(data, filterDate);
            this.floatingWindow.setContent(content);
            this.bindEvents();
            this.applyBubbleScale();
            
            // 如果是还原扩展模式，滚动到该股票卡片位置
            if (scrollToStock && scrollToMarket) {
              const newContentEl = this.floatingWindow.getElement().querySelector('.compact-mode-content');
              if (newContentEl) {
                const targetCard = newContentEl.querySelector(`.compact-stock-card[data-stock-name="${scrollToStock}"]`);
                if (targetCard) {
                  targetCard.scrollIntoView({
                    behavior: 'smooth',
                    block: 'center',
                    inline: 'nearest'
                  });
                }
              }
            }
          }
        });
      });

      // 为上一个股票按钮添加点击事件
      const prevStockBtn = winEl.querySelector('#prevStockBtn');
      if (prevStockBtn) {
        prevStockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.navigateToPrevStock();
        });
      }

      // 为下一个股票按钮添加点击事件
      const nextStockBtn = winEl.querySelector('#nextStockBtn');
      if (nextStockBtn) {
        nextStockBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.navigateToNextStock();
        });
      }

      // 扩展模式下滑动导航
      if (this.expandedStock && this.expandedMarket) {
        const contentEl = winEl.querySelector('.compact-mode-content');
        if (contentEl) {
          let swipeStartX = 0;
          let swipeStartY = 0;
          let swipeStartTime = 0;
          const SWIPE_THRESHOLD = 50;
          const SWIPE_MAX_TIME = 500;

          contentEl.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            swipeStartX = e.touches[0].clientX;
            swipeStartY = e.touches[0].clientY;
            swipeStartTime = Date.now();
          }, { passive: true });

          contentEl.addEventListener('touchend', (e) => {
            if (!swipeStartX || !swipeStartY) return;
            const touch = e.changedTouches[0];
            const deltaX = touch.clientX - swipeStartX;
            const deltaY = touch.clientY - swipeStartY;
            const elapsed = Date.now() - swipeStartTime;

            if (elapsed > SWIPE_MAX_TIME) {
              swipeStartX = 0;
              swipeStartY = 0;
              return;
            }

            if (Math.abs(deltaX) > SWIPE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
              if (deltaX > 0) {
                this.navigateToPrevStock();
              } else {
                this.navigateToNextStock();
              }
            }

            swipeStartX = 0;
            swipeStartY = 0;
          }, { passive: true });

          // 处理鼠标滚轮和触摸板水平滚动
          let wheelTimeout = null;
          let wheelDeltaX = 0;
          const WHEEL_THRESHOLD = 50;
          
          contentEl.addEventListener('wheel', (e) => {
            // 优先处理水平滚动
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
              e.preventDefault();
              
              // 累积水平滚动值
              wheelDeltaX += e.deltaX;
              
              // 防抖，避免连续触发
              if (wheelTimeout) {
                clearTimeout(wheelTimeout);
              }
              
              wheelTimeout = setTimeout(() => {
                // 只有当累积值超过阈值时才触发
                if (Math.abs(wheelDeltaX) > WHEEL_THRESHOLD) {
                  if (wheelDeltaX > 0) {
                    this.navigateToNextStock();
                  } else if (wheelDeltaX < 0) {
                    this.navigateToPrevStock();
                  }
                  // 重置累积值
                  wheelDeltaX = 0;
                }
              }, 50);
            }
          }, { passive: false });
        }
      }

      // 长按处理变量
      let longPressTimer = null;
      
      // 打开股票选择器的函数
      const openStockSelector = () => {
        const stockSelectorModal = document.getElementById('stockSelectorModal');
        if (stockSelectorModal) {
          stockSelectorModal.style.display = 'flex';
          const scroller = document.getElementById('stockScroller');
          if (scroller) {
            const items = scroller.querySelectorAll('.stock-scroller-item');
            const targetItem = Array.from(items).find(item => parseInt(item.dataset.index) === this.expandedStockIndex);
            if (targetItem) {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                  const rect = targetItem.getBoundingClientRect();
                  const scrollerRect = scroller.getBoundingClientRect();
                  const containerWidth = scroller.clientWidth;
                  const itemWidth = rect.width;
                  const offsetInContainer = rect.left - scrollerRect.left;
                  const currentScrollLeft = scroller.scrollLeft;
                  const targetScrollLeft = currentScrollLeft + offsetInContainer - (containerWidth / 2) + (itemWidth / 2);
                  scroller.scrollLeft = targetScrollLeft;
                  setTimeout(() => {
                    scroller.scrollLeft = targetScrollLeft;
                    scroller.style.scrollSnapType = 'x mandatory';
                  }, 100);
                });
              });
            }
          }
        }
      };
      
      // 为索引区域添加长按和双击事件支持
      const stockIndexArea = winEl.querySelector('#stockIndexArea');
      if (stockIndexArea) {
        // 鼠标按下开始计时
        const startLongPress = (e) => {
          // 只对鼠标事件 preventDefault，不要对触摸事件 preventDefault
          // 这样不会干扰正常的滚动
          if (e.type === 'mousedown') {
            e.preventDefault();
          }
          longPressTimer = setTimeout(openStockSelector, 500); // 500毫秒长按
        };
        
        // 取消长按计时
        const cancelLongPress = () => {
          if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
          }
        };
        
        stockIndexArea.addEventListener('mousedown', startLongPress);
        stockIndexArea.addEventListener('mouseup', cancelLongPress);
        stockIndexArea.addEventListener('mouseleave', cancelLongPress);
        stockIndexArea.addEventListener('dblclick', openStockSelector); // 添加双击事件
        
        // 触摸事件支持 - 不使用 preventDefault 以避免干扰滚动
        stockIndexArea.addEventListener('touchstart', startLongPress, { passive: true });
        stockIndexArea.addEventListener('touchend', cancelLongPress);
        stockIndexArea.addEventListener('touchmove', cancelLongPress);
      }
      
      // 水平滚动股票选择器功能
      const stockScroller = winEl.querySelector('#stockScroller');
      const selectedStockDisplay = winEl.querySelector('#selectedStockDisplay');
      let selectedIndex = this.expandedStockIndex;
      let isInitializing = false;
      
      if (stockScroller) {
        // 滚动时更新选中状态
        const updateSelectedStock = () => {
          const items = stockScroller.querySelectorAll('.stock-scroller-item');
          const scrollLeft = stockScroller.scrollLeft;
          const containerWidth = stockScroller.clientWidth;
          const centerX = scrollLeft + containerWidth / 2;
          
          let closestIndex = 0;
          let closestDistance = Infinity;
          
          // 只考虑可见的股票项目
          const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
          
          visibleItems.forEach((item) => {
            if (item.dataset.index) {
              const rect = item.getBoundingClientRect();
              const scrollerRect = stockScroller.getBoundingClientRect();
              const itemCenterX = rect.left - scrollerRect.left + rect.width / 2 + scrollLeft;
              const distance = Math.abs(centerX - itemCenterX);
              
              if (distance < closestDistance) {
                closestDistance = distance;
                closestIndex = parseInt(item.dataset.index);
              }
            }
          });
          
          // 如果正在初始化，强制使用当前股票索引
          if (isInitializing) {
            closestIndex = this.expandedStockIndex;
          }
          
          // 更新选中样式
          items.forEach((item) => {
            const idx = parseInt(item.dataset.index);
            const isVisible = item.style.display !== 'none';
            if (isVisible && idx === closestIndex) {
              item.style.background = '#3b82f6';
              item.style.color = 'white';
              item.style.borderColor = '#3b82f6';
              item.style.transform = 'scale(1.1)';
            } else if (isVisible) {
              item.style.background = '#f3f4f6';
              item.style.color = '#374151';
              item.style.borderColor = 'transparent';
              item.style.transform = 'scale(1)';
            }
          });
          
          // 更新显示文本
          selectedIndex = closestIndex;
          if (selectedStockDisplay && this.expandedStockList[closestIndex]) {
            selectedStockDisplay.innerHTML = '当前选择: <span style="font-size: 45px; font-weight: bold;">' + this.expandedStockList[closestIndex].stock + '</span>';
          }
        };
        
        // 初始定位到当前股票
        const initialScrollToSelected = () => {
          const items = stockScroller.querySelectorAll('.stock-scroller-item');
          const targetItem = Array.from(items).find(item => parseInt(item.dataset.index) === this.expandedStockIndex);
          if (targetItem) {
            const rect = targetItem.getBoundingClientRect();
            const scrollerRect = stockScroller.getBoundingClientRect();
            const containerWidth = stockScroller.clientWidth;
            const itemWidth = rect.width;
            const offsetInContainer = rect.left - scrollerRect.left;
            const currentScrollLeft = stockScroller.scrollLeft;
            const targetScrollLeft = currentScrollLeft + offsetInContainer - (containerWidth / 2) + (itemWidth / 2);
            stockScroller.scrollLeft = targetScrollLeft;
          }
        };
        
        // 添加滚动事件监听
        let scrollTimeout;
        stockScroller.addEventListener('scroll', () => {
          clearTimeout(scrollTimeout);
          // 初始化期间不触发更新
          if (!isInitializing) {
            scrollTimeout = setTimeout(updateSelectedStock, 50);
          }
        });
        
        // 点击项目直接选择
        const scrollerItems = stockScroller.querySelectorAll('.stock-scroller-item');
        scrollerItems.forEach((item) => {
          item.addEventListener('click', () => {
            item.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            setTimeout(updateSelectedStock, 300);
          });
        });
      }
      
      // 筛选按钮功能
      const filterBtns = winEl.querySelectorAll('.stock-filter-btn');
      let currentFilter = 'all';
      
      const applyFilter = (filterType) => {
        currentFilter = filterType;
        
        // 更新按钮样式
        filterBtns.forEach(btn => {
          const btnFilter = btn.dataset.filter;
          if (btnFilter === filterType) {
            btn.style.background = '#3b82f6';
            btn.style.color = 'white';
          } else {
            btn.style.background = '#f3f4f6';
            btn.style.color = '#374151';
          }
        });
        
        // 筛选并显示/隐藏股票项目
        const allItems = stockScroller.querySelectorAll('.stock-scroller-item');
        allItems.forEach(item => {
          const itemMarket = item.dataset.market;
          let shouldShow = true;
          
          if (filterType === 'china') {
            shouldShow = itemMarket === 'china';
          } else if (filterType === 'taiwan') {
            shouldShow = itemMarket === 'taiwan';
          }
          
          item.style.display = shouldShow ? '' : 'none';
        });
        
        // 重新计算选中的股票
        setTimeout(() => {
          updateSelectedStock();
        }, 50);
      };
      
      filterBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const filterType = btn.dataset.filter;
          applyFilter(filterType);
        });
      });
      
      // 为确认按钮添加点击事件
      const confirmStockSelectorBtn = winEl.querySelector('#confirmStockSelector');
      if (confirmStockSelectorBtn) {
        confirmStockSelectorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockSelectorModal = document.getElementById('stockSelectorModal');
          
          if (this.expandedStockList[selectedIndex]) {
            const targetStock = this.expandedStockList[selectedIndex];
            this.expandedStock = targetStock.stock;
            this.expandedMarket = targetStock.market;
            this.expandedStockIndex = selectedIndex;
            
            // 隐藏选择器
            if (stockSelectorModal) {
              stockSelectorModal.style.display = 'none';
            }
            
            // 重新渲染
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (filterDate) {
              const data = this.collectData(filterDate);
              const content = this.renderCompactView(data, filterDate);
              this.floatingWindow.setContent(content);
              this.bindEvents();
              this.applyBubbleScale();
            }
          }
        });
      }
      
      // 为关闭按钮添加点击事件
      const closeStockSelectorBtn = winEl.querySelector('#closeStockSelector');
      if (closeStockSelectorBtn) {
        closeStockSelectorBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockSelectorModal = document.getElementById('stockSelectorModal');
          if (stockSelectorModal) {
            stockSelectorModal.style.display = 'none';
          }
        });
      }
      
      // 点击模态框背景关闭
      const stockSelectorModal = winEl.querySelector('#stockSelectorModal');
      if (stockSelectorModal) {
        stockSelectorModal.addEventListener('click', (e) => {
          if (e.target === stockSelectorModal) {
            stockSelectorModal.style.display = 'none';
          }
        });
      }

      // 为快速添加输入框添加 Enter 键支持
      const quickAddPriceInputs = winEl.querySelectorAll('.quick-add-price');
      quickAddPriceInputs.forEach(input => {
        input.addEventListener('keydown', async (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            
            const stockCard = input.closest('.compact-stock-card');
            const confirmBtn = stockCard.querySelector('.quick-add-confirm');
            if (confirmBtn) {
              // 触发确认按钮的点击事件
              confirmBtn.click();
            }
          }
        });
      });

      // 为新增按钮添加点击事件
      const quickAddConfirmBtns = winEl.querySelectorAll('.quick-add-confirm');
      quickAddConfirmBtns.forEach(btn => {
        btn.addEventListener('click', async (e) => {
          e.stopPropagation();
          const stockCard = btn.closest('.compact-stock-card');
          const priceInput = stockCard.querySelector('.quick-add-price');
          const priceValue = priceInput.value.trim();
          
          if (!priceValue) {
            const errorMsg = '请输入交易单价';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
          
          // 验证价格输入是否有效
          if (!this.isValidPriceInput(priceValue)) {
            const errorMsg = '请输入有效的单价（只允许数字、负号和小数点）';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
          
          // 判断买卖方向：输入 - 号表示卖出，否则为买入
          const isSell = priceValue.startsWith('-');
          const price = Math.abs(Number(priceValue));
          
          if (price <= 0) {
            const errorMsg = '请输入有效的单价';
            this.speakErrorAndAlert(errorMsg);
            return;
          }
          
          const side = isSell ? 'sell' : 'buy';
          const stockName = btn.dataset.stock;
          const market = btn.dataset.market;
          
          // 获取股票信息（假设STOCKS数组存在）
          const stockInfo = this._findStockByName(stockName);
          if (!stockInfo) {
            this.speakErrorAndAlert('未在清单找到该股票');
            return;
          }
          
          const qty = stockInfo.qty;
          const amount = qty * price;
          const now = new Date();
          const newTrade = {
            id: Date.now().toString(),
            date: now.toISOString().slice(0, 10),
            createdAt: now.toISOString(),
            market: stockInfo.market,
            stock: stockInfo.name,
            side,
            qty,
            price,
            amount,
            remark: ''
          };
          
          try {
            // 保存交易记录（假设tradesDB存在）
            if (window.tradesDB && window.tradesDB.save) {
              await window.tradesDB.save(newTrade);
              
              // 重新加载交易数据
              if (window.loadTrades) {
                await window.loadTrades();
              }
              
              // 刷新主程式的资料
              if (window.renderStockModeTable) {
                await window.renderStockModeTable();
              }
              
              // 重新渲染紧凑模式（所有设定会保持原样）
              const filterDateInput = document.getElementById('filterDate');
              const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
              if (filterDate) {
                const data = this.collectData(filterDate);
                const content = this.renderCompactView(data, filterDate);
                this.floatingWindow.setContent(content);
                this.bindEvents();
                this.applyBubbleScale();
                
                // 定位到新增交易所属的股票卡片
                this.scrollToStock(stockName);
              }
              
              // 隐藏快速添加容器
              const quickAddContainer = stockCard.querySelector('.compact-quick-add');
              if (quickAddContainer) {
                quickAddContainer.style.display = 'none';
              }
              priceInput.value = '';
              
              this.showTemporaryMessage('交易新增成功！');
            } else {
              this.speakErrorAndAlert('交易数据库未初始化');
            }
          } catch (error) {
            console.error('新增交易失败:', error);
            this.speakErrorAndAlert('新增交易失败: ' + error.message);
          }
        });
      });

      // 为交易列表按钮添加点击事件：打开该市场的交易明细子视窗
      const tradeListBtns = winEl.querySelectorAll('.trade-list-btn[data-market]');
      tradeListBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const marketName = btn.dataset.market;
          const fd = filterDateInput ? filterDateInput.value.trim() : '';
          if (!fd) return;
          this.showTradeListModal(marketName, fd, winEl);
        });
      });

      // 为键盘图标按钮添加切换事件（紧凑模式智能添加）
      const smartAddToggleBtns = winEl.querySelectorAll('.keypad-toggle-btn[data-market]');
      smartAddToggleBtns.forEach(toggleBtn => {
        toggleBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const marketName = toggleBtn.dataset.market;
          const keypad = winEl.querySelector(`.smart-add-keypad[data-market="${marketName}"]`);
          if (keypad) {
            if (keypad.style.display === 'none' || !keypad.style.display) {
              keypad.style.display = 'grid';
              toggleBtn.style.color = '#10b981';
            } else {
              keypad.style.display = 'none';
              toggleBtn.style.color = '#3b82f6';
            }
          }
        });
      });

      // 为数字键盘按钮添加点击事件（支持股票卡片和紧凑模式智能添加）
      const keypadBtns = winEl.querySelectorAll('.keypad-btn');
      keypadBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const key = btn.dataset.key;
          
          let priceInput = null;
          let confirmBtn = null;
          
          // 首先尝试查找是否是股票卡片中的快速添加键盘
          const stockCard = btn.closest('.compact-stock-card');
          if (stockCard) {
            priceInput = stockCard.querySelector('.quick-add-price');
            confirmBtn = stockCard.querySelector('.quick-add-confirm');
          }
          
          // 如果没有找到，尝试查找是否是市场标题中的智能添加键盘
          if (!priceInput) {
            const marketTitle = btn.closest('.compact-market-title');
            if (marketTitle) {
              const marketName = btn.closest('[data-market]')?.dataset.market;
              if (marketName) {
                priceInput = marketTitle.querySelector(`.smart-add-price[data-market="${marketName}"]`);
                confirmBtn = marketTitle.querySelector(`.smart-add-btn[data-market="${marketName}"]`);
              }
            }
          }
          
          if (!priceInput) return;
          
          switch(key) {
            case 'clear':
              priceInput.value = '';
              break;
            case 'backspace':
              priceInput.value = priceInput.value.slice(0, -1);
              break;
            case 'enter':
              if (confirmBtn) confirmBtn.click();
              break;
            case '-':
              if (priceInput.value.startsWith('-')) {
                priceInput.value = priceInput.value.slice(1);
              } else {
                priceInput.value = '-' + priceInput.value;
              }
              break;
            case '.':
              if (!priceInput.value.includes('.')) {
                priceInput.value += '.';
              }
              break;
            default:
              priceInput.value += key;
          }
          
          priceInput.focus();
        });
      });

      // 为所有配对气泡添加双击事件，显示截图讯息（包括历史气泡）
      const pairBubbles = winEl.querySelectorAll('.compact-pair');
      pairBubbles.forEach(pairBubble => {
        // 为配对气泡添加拖拽功能（用于手动配对窗口解除配对）
        if (!pairBubble.classList.contains('draggable')) {
          pairBubble.classList.add('draggable');
          pairBubble.setAttribute('draggable', 'true');
          
          pairBubble.addEventListener('dragstart', (e) => {
            e.stopPropagation();
            pairBubble.classList.add('dragging');
            
            const pairDataStr = pairBubble.dataset.pair;
            if (pairDataStr) {
              try {
                const pairData = JSON.parse(pairDataStr);
                const dragData = {
                  type: 'pair',
                  buy: pairData.buy,
                  sell: pairData.sell
                };
                e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                e.dataTransfer.effectAllowed = 'copy';
              } catch (err) {
                console.error('解析配对数据失败:', err);
              }
            }
          });
          
          pairBubble.addEventListener('dragend', (e) => {
            e.stopPropagation();
            pairBubble.classList.remove('dragging');
          });
        }
        
        pairBubble.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const pairDataStr = pairBubble.dataset.pair;
          const stockName = pairBubble.dataset.stockName;
          
          if (pairDataStr && stockName) {
            try {
              const pairData = JSON.parse(pairDataStr);
              const tempItem = {
                buy: pairData.buy,
                sell: pairData.sell,
                repTrade: pairData.buy
              };
              
              if (window.showPairDetailWithFloatingWindow && typeof window.showPairDetailWithFloatingWindow === 'function') {
                window.showPairDetailWithFloatingWindow(tempItem, stockName);
              } else {
                console.warn('未找到 showPairDetailWithFloatingWindow 函数');
              }
            } catch (error) {
              console.error('解析配对数据失败:', error);
            }
          }
        });
      });

      // 为所有未配对气泡添加双击事件，显示截图讯息（包括历史气泡）
      const unpairedBubbles = winEl.querySelectorAll('.compact-bubble:not(.compact-pair .compact-bubble)');
      unpairedBubbles.forEach(unpairedBubble => {
        unpairedBubble.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const tradeDataStr = unpairedBubble.dataset.trade;
          
          if (tradeDataStr) {
            try {
              const tradeData = JSON.parse(tradeDataStr);
              
              if (window.showTradeDetail && typeof window.showTradeDetail === 'function') {
                window.showTradeDetail(tradeData, 'compact');
              } else {
                console.warn('未找到 showTradeDetail 函数');
              }
            } catch (error) {
              console.error('解析交易数据失败:', error);
            }
          }
        });
      });

      // 为备注折页符号添加点击事件
      const noteToggleBtns = winEl.querySelectorAll('.compact-note-toggle');
      noteToggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          const stockCard = btn.closest('.compact-stock-card');
          const noteEditor = stockCard.querySelector('.compact-note-editor');
          const bubblesContainer = stockCard.querySelector('.compact-stock-bubbles');
          const historyContainers = stockCard.querySelectorAll('.compact-history-container');
          const sectionToggles = stockCard.querySelectorAll('.compact-section-toggle');
          const stockContent = stockCard.querySelector('.compact-stock-content');
          
          if (noteEditor) {
            if (noteEditor.style.display === 'none' || noteEditor.style.display === '') {
              // 保存当前状态
              const savedStates = {};
              savedStates.bubblesDisplay = bubblesContainer ? bubblesContainer.style.display : '';
              savedStates.historyByDateChecked = false;
              savedStates.historyBySideChecked = false;
              
              // 保存历史数据复选框状态和section-toggles的显示状态
              const historyByDateToggle = stockCard.querySelector('.compact-history-toggle[data-toggle="history-by-date"]');
              if (historyByDateToggle) savedStates.historyByDateChecked = historyByDateToggle.checked;
              
              const historyBySideToggle = stockCard.querySelector('.compact-history-toggle[data-toggle="history-by-side"]');
              if (historyBySideToggle) savedStates.historyBySideChecked = historyBySideToggle.checked;
              
              // 保存section-toggles的显示状态
              savedStates.sectionTogglesDisplay = [];
              sectionToggles.forEach((toggle, index) => {
                savedStates.sectionTogglesDisplay.push(toggle.style.display);
              });
              
              // 将保存的状态存储在stockCard上
              stockCard.dataset.savedStates = JSON.stringify(savedStates);
              
              // 折叠所有气泡显示（模拟点击左上角折页符号的效果）
              if (bubblesContainer) bubblesContainer.style.display = 'none';
              historyContainers.forEach(container => {
                container.style.display = 'none';
              });
              sectionToggles.forEach(toggle => {
                toggle.style.display = 'none';
                const checkbox = toggle.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.checked = false;
              });
              // 显示备注输入框
              noteEditor.style.display = 'flex';
              // 确保股票内容区域使用flex布局
              if (stockContent) {
                stockContent.style.display = 'flex';
                stockContent.style.flexDirection = 'column';
                stockContent.style.flex = '1';
              }
              // 确保备注编辑器使用flex布局并占据剩余空间
              noteEditor.style.flex = '1';
              noteEditor.style.minHeight = '0';
              const textarea = noteEditor.querySelector('.compact-note-textarea');
              if (textarea) {
                textarea.style.flex = '1';
                textarea.style.minHeight = '0';
                textarea.focus();
              }
            } else {
              // 恢复保存的状态
              let savedStates = null;
              try {
                if (stockCard.dataset.savedStates) {
                  savedStates = JSON.parse(stockCard.dataset.savedStates);
                }
              } catch (e) {
                console.error('解析保存状态失败:', e);
              }
              
              // 隐藏备注输入框
              noteEditor.style.display = 'none';
              // 恢复显示气泡
              if (bubblesContainer) {
                bubblesContainer.style.display = ''; // 使用默认值
              }
              // 恢复历史数据复选框状态和显示
              if (savedStates) {
                const historyByDateToggle = stockCard.querySelector('.compact-history-toggle[data-toggle="history-by-date"]');
                if (historyByDateToggle) historyByDateToggle.checked = savedStates.historyByDateChecked;
                
                const historyBySideToggle = stockCard.querySelector('.compact-history-toggle[data-toggle="history-by-side"]');
                if (historyBySideToggle) historyBySideToggle.checked = savedStates.historyBySideChecked;
                
                // 恢复section-toggles的显示状态
                sectionToggles.forEach((toggle, index) => {
                  if (savedStates.sectionTogglesDisplay && savedStates.sectionTogglesDisplay[index] !== undefined) {
                    toggle.style.display = savedStates.sectionTogglesDisplay[index];
                  } else {
                    toggle.style.display = '';
                  }
                });
                
                // 恢复历史数据容器显示
                const allHistoryContainers = stockCard.querySelectorAll('.compact-history-container');
                let containerIndex = 0;
                sectionToggles.forEach((toggle, index) => {
                  const checkbox = toggle.querySelector('input[type="checkbox"]');
                  const nextContainer = toggle.nextElementSibling;
                  if (nextContainer && nextContainer.classList.contains('compact-history-container')) {
                    nextContainer.style.display = checkbox && checkbox.checked ? '' : 'none';
                  }
                });
              } else {
                // 如果没有保存的状态，使用默认方式恢复
                const historyByDateToggle = stockCard.querySelector('.compact-history-toggle[data-toggle="history-by-date"]');
                const historyByDateContainer = stockCard.querySelector('.compact-history-container:nth-child(3)');
                if (historyByDateToggle && historyByDateContainer) {
                  historyByDateContainer.style.display = historyByDateToggle.checked ? '' : 'none';
                }
                const historyBySideToggle = stockCard.querySelector('.compact-history-toggle[data-toggle="history-by-side"]');
                const historyBySideContainer = stockCard.querySelector('.compact-history-container:nth-child(5)');
                if (historyBySideToggle && historyBySideContainer) {
                  historyBySideContainer.style.display = historyBySideToggle.checked ? '' : 'none';
                }
              }
            }
          }
        });
      });

      // 为备注编辑框添加键盘事件（Command+S 或 Ctrl+S 保存）
      const noteTextareas = winEl.querySelectorAll('.compact-note-textarea');
      noteTextareas.forEach(textarea => {
        textarea.addEventListener('keydown', (e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 's') {
            e.preventDefault();
            e.stopPropagation();
            
            const stockName = textarea.dataset.stock;
            const noteContent = textarea.value;
            
            this.stockNotes[stockName] = noteContent;
            this.saveSettings();
            
            alert('备注已保存！');
          }
        });
      });

      // 为左下折页符号添加点击事件
      const bottomLeftToggles = winEl.querySelectorAll('.compact-bottom-left-toggle');
      bottomLeftToggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          alert('加工中！');
        });
      });

      // 为右下折页符号添加点击事件
      const bottomRightToggles = winEl.querySelectorAll('.compact-bottom-right-toggle');
      bottomRightToggles.forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const stockName = btn.dataset.stock;
          
          // 获取该股票的卡片
          const card = btn.closest('.compact-stock-card');
          if (!card) return;
          
          // 获取卡片内容区域
          const stockContent = card.querySelector('.compact-stock-content');
          if (!stockContent) return;
          
          // 检查是否已经保存了原始内容
          if (!card.dataset.originalContent) {
            // 第一次点击，保存原始内容
            card.dataset.originalContent = stockContent.innerHTML;
          }
          
          // 检查是否已经显示了主视图内容
          let mainViewArea = card.querySelector('.main-view-area');
          
          if (mainViewArea && mainViewArea.style.display !== 'none') {
            // 已经显示了主视图内容，需要还原到原始视图
            stockContent.innerHTML = card.dataset.originalContent;
          } else {
            // 显示主视图内容
            this.showMainViewContent(card, stockName);
          }
        });
      });

    } catch (err) {
      console.error('绑定事件失败', err);
    }
  }

  // 显示与主视图一模一样的内容
  showMainViewContent(card, stockName) {
    try {
      // 获取卡片内容区域
      const stockContent = card.querySelector('.compact-stock-content');
      if (!stockContent) return;
      
      // 检查是否已经存在主视图内容区域
      let mainViewArea = card.querySelector('.main-view-area');
      
      // 如果主视图内容区域已经存在，直接显示它
      if (mainViewArea) {
        // 清空内容，只显示主视图区域
        stockContent.innerHTML = '';
        stockContent.appendChild(mainViewArea);
        mainViewArea.style.display = 'block';
        return;
      }
      
      // 获取当前的filterDate
      const filterDateInput = document.getElementById('filterDate');
      const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
      
      // 直接从卡片元素上读取数据
      const unpairedBuys = JSON.parse(card.dataset.unpairedBuys || '[]');
      const unpairedSells = JSON.parse(card.dataset.unpairedSells || '[]');
      const tradeOrderMapArray = JSON.parse(card.dataset.tradeOrderMap || '[]');
      const tradeOrderMap = new Map(tradeOrderMapArray);
      const bubbleDataStr = card.querySelector('.compact-stock-bubbles') ? card.querySelector('.compact-stock-bubbles').dataset.bubbleData : null;
      let bubbleData = [];
      if (bubbleDataStr) {
        try {
          bubbleData = JSON.parse(bubbleDataStr);
        } catch (e) {
          console.error('解析bubbleData失败:', e);
        }
      }
      
      const trades = window.trades || [];
      const pairingCache = window.pairingCache || {};
      
      // 获取该股票的所有交易
      const stockTrades = trades.filter(t => t.stock === stockName);
      if (stockTrades.length === 0) return;
      
      // 收集所有交易并建立序号映射
      const allTrades = [];
      const seenTradeIds = new Set();
      
      // 收集今日气泡中的交易
      if (bubbleData && Array.isArray(bubbleData)) {
        bubbleData.forEach(bubble => {
          if (bubble.type === 'paired') {
            if (bubble.buy && !seenTradeIds.has(bubble.buy.id)) {
              seenTradeIds.add(bubble.buy.id);
              allTrades.push({
                trade: bubble.buy,
                bubble,
                type: 'paired-buy'
              });
            }
            if (bubble.sell && !seenTradeIds.has(bubble.sell.id)) {
              seenTradeIds.add(bubble.sell.id);
              allTrades.push({
                trade: bubble.sell,
                bubble,
                type: 'paired-sell'
              });
            }
          } else {
            if (bubble.trade && !seenTradeIds.has(bubble.trade.id)) {
              seenTradeIds.add(bubble.trade.id);
              allTrades.push({
                trade: bubble.trade,
                bubble,
                type: 'unpaired'
              });
            }
          }
        });
      }
      
      // 获取股票的市场信息 - 从该股票的任何一笔交易中获取
      let stockMarket = card.dataset.market || '';
      if (!stockMarket) {
        const allTradesData = window.trades || [];
        const stockTrade = allTradesData.find(t => t.stock === stockName);
        if (stockTrade && stockTrade.market) {
          stockMarket = stockTrade.market;
        }
      }
      
      // 获取历史日期和气泡 - 用于收集历史气泡中的交易
      const historyDatesForCollect = this.getStockHistoryDates(stockName, stockMarket, filterDate, this.historyDays, trades, pairingCache, this.showHistoryPairedBubbles);
      
      // 收集历史气泡中的交易
      for (const historyDate of historyDatesForCollect) {
        try {
          const historyBubbles = this.getStockHistoryBubbles(stockName, stockMarket, historyDate);
          
          historyBubbles.forEach(bubble => {
            if (bubble.type === 'paired') {
              if (bubble.buy && !seenTradeIds.has(bubble.buy.id)) {
                seenTradeIds.add(bubble.buy.id);
                allTrades.push({
                  trade: bubble.buy,
                  bubble,
                  type: 'paired-buy'
                });
              }
              if (bubble.sell && !seenTradeIds.has(bubble.sell.id)) {
                seenTradeIds.add(bubble.sell.id);
                allTrades.push({
                  trade: bubble.sell,
                  bubble,
                  type: 'paired-sell'
                });
              }
            } else {
              if (bubble.trade && !seenTradeIds.has(bubble.trade.id)) {
                seenTradeIds.add(bubble.trade.id);
                allTrades.push({
                  trade: bubble.trade,
                  bubble,
                  type: 'unpaired'
                });
              }
            }
          });
        } catch (e) {
          console.error('收集历史气泡交易时出错:', historyDate, e);
        }
      }
      
      // 按时间戳排序（最新的在前）
      allTrades.sort((a, b) => {
        const dateA = new Date(a.trade.createdAt || a.trade.date);
        const dateB = new Date(b.trade.createdAt || b.trade.date);
        return dateB - dateA;
      });
      
      // 创建交易序号映射
      const maxOrder = allTrades.length;
      
      // 获取序号1的交易的日期 - 最简单直接的方法：直接从所有交易中找到序号1的交易
      let order1Date = filterDate;
      let order1Trade = null;  // 存储序号1的交易
      
      // 从tradeOrderMap中找到序号为1的交易ID
      let order1TradeId = null;
      for (const [tradeId, order] of tradeOrderMap.entries()) {
        if (order === 1) {
          order1TradeId = tradeId;
          break;
        }
      }
      
      // 直接从window.trades中找到这个交易
      if (order1TradeId) {
        const allTradesData = window.trades || [];
        const foundOrder1Trade = allTradesData.find(t => t.id === order1TradeId);
        
        if (foundOrder1Trade && foundOrder1Trade.date) {
          order1Date = foundOrder1Trade.date;
          order1Trade = foundOrder1Trade;
        } else {
          // 如果在trades中没找到，试试在pairingCache中找
          const pairingCache = window.pairingCache || {};
          for (const stockName in pairingCache) {
            const stockPairing = pairingCache[stockName];
            if (stockPairing && stockPairing.pairedTrades) {
              for (const pair of stockPairing.pairedTrades) {
                if (pair.buy && pair.buy.id === order1TradeId && pair.buy.date) {
                  order1Date = pair.buy.date;
                  order1Trade = pair.buy;
                  break;
                }
                if (pair.sell && pair.sell.id === order1TradeId && pair.sell.date) {
                  order1Date = pair.sell.date;
                  order1Trade = pair.sell;
                  break;
                }
              }
            }
          }
        }
      }
      
      // 获取序号1日期的气泡数据
      const order1BubbleData = this.getStockHistoryBubbles(stockName, stockMarket, order1Date);
      console.log('调试 - stockName:', stockName);
      console.log('调试 - stockMarket:', stockMarket);
      console.log('调试 - order1Date:', order1Date);
      console.log('调试 - order1BubbleData:', order1BubbleData);
      
      // 找到序号1日期气泡中最新的交易ID
      let order1LatestBuyId = null;
      let order1LatestSellId = null;
      let order1LatestTradeId = null;
      let order1MaxTimestamp = -1;
      
      if (order1BubbleData && Array.isArray(order1BubbleData)) {
        order1BubbleData.forEach(bubble => {
          if (bubble.timestamp > order1MaxTimestamp) {
            order1MaxTimestamp = bubble.timestamp;
            if (bubble.type === 'paired') {
              const buyCreatedAt = bubble.buy ? new Date(bubble.buy.createdAt).getTime() : 0;
              const sellCreatedAt = bubble.sell ? new Date(bubble.sell.createdAt).getTime() : 0;
              if (buyCreatedAt > sellCreatedAt) {
                order1LatestBuyId = bubble.buy ? bubble.buy.id : null;
                order1LatestSellId = null;
              } else {
                order1LatestSellId = bubble.sell ? bubble.sell.id : null;
                order1LatestBuyId = null;
              }
              order1LatestTradeId = null;
            } else {
              order1LatestTradeId = bubble.trade ? bubble.trade.id : null;
              order1LatestBuyId = null;
              order1LatestSellId = null;
            }
          }
        });
      }
      
      // 找到所有气泡中日期最大的
      let latestBuyId = null;
      let latestSellId = null;
      let latestTradeId = null;
      let maxTimestamp = -1;
      
      if (bubbleData && Array.isArray(bubbleData)) {
        bubbleData.forEach(bubble => {
          if (bubble.timestamp > maxTimestamp) {
            maxTimestamp = bubble.timestamp;
            if (bubble.type === 'paired') {
              // 对于配对气泡，比较买入和卖出的创建时间，只给更新的那个打勾
              const buyCreatedAt = bubble.buy ? new Date(bubble.buy.createdAt).getTime() : 0;
              const sellCreatedAt = bubble.sell ? new Date(bubble.sell.createdAt).getTime() : 0;
              if (buyCreatedAt > sellCreatedAt) {
                latestBuyId = bubble.buy ? bubble.buy.id : null;
                latestSellId = null;
              } else {
                latestSellId = bubble.sell ? bubble.sell.id : null;
                latestBuyId = null;
              }
              latestTradeId = null;
            } else {
              latestTradeId = bubble.trade ? bubble.trade.id : null;
              latestBuyId = null;
              latestSellId = null;
            }
          }
        });
      }
      
      // 获取历史日期和气泡
      const historyDates = this.getStockHistoryDates(stockName, stockMarket, filterDate, this.historyDays, trades, pairingCache, this.showHistoryPairedBubbles);
      
      let historyBubblesHtml = '';
      
      // 计算配对气泡的截止日期（如果设置了配对天数）
      let pairedBubbleCutoffDate = null;
      if (this.showHistoryPairedBubbles && this.historyPairedDays && this.historyPairedDays > 0) {
        const numDays = parseInt(this.historyPairedDays);
        if (historyDates.length > 0 && numDays <= historyDates.length) {
          pairedBubbleCutoffDate = historyDates[numDays - 1];
        }
      }
      
      // 先收集所有日期，然后筛选出有可见气泡的日期，直到收集到设定的天数（最多50天，确保安全）
      const validDatesWithBubbles = [];
      const safeMaxDays = Math.min(this.historyDays, 50);
      let iterationCount = 0;
      const maxIterations = Math.min(historyDates.length, 200);
      
      for (let i = 0; i < historyDates.length && validDatesWithBubbles.length < safeMaxDays && iterationCount < maxIterations; i++) {
        iterationCount++;
        const historyDate = historyDates[i];
        
        try {
          const historyBubbles = this.getStockHistoryBubbles(stockName, card.dataset.market || '', historyDate);
          
          // 过滤气泡
          let filteredBubbles = historyBubbles;
          if (!this.showHistoryPairedBubbles) {
            filteredBubbles = historyBubbles.filter(b => b.type !== 'paired');
          } else if (pairedBubbleCutoffDate) {
            const isDateWithinPairedLimit = historyDates.indexOf(historyDate) < historyDates.indexOf(pairedBubbleCutoffDate) || historyDate === pairedBubbleCutoffDate;
            if (!isDateWithinPairedLimit) {
              filteredBubbles = historyBubbles.filter(b => b.type !== 'paired');
            }
          }
          
          // 只有有可见气泡的日期才加入
          if (filteredBubbles.length > 0) {
            validDatesWithBubbles.push({
              date: historyDate,
              bubbles: filteredBubbles
            });
          }
        } catch (e) {
          console.error('处理历史日期时出错:', historyDate, e);
        }
      }
      
      // 渲染"历史数据-按日显示"区域（只显示有可见气泡的日期，最多显示设定的天数）
      validDatesWithBubbles.forEach(item => {
        const historyDate = item.date;
        const filteredBubbles = item.bubbles;
        
        const monthDay = historyDate.slice(5);
        historyBubblesHtml += `
          <div class="compact-history-date">${monthDay}</div>
          ${this.renderHistoryBubbles(filteredBubbles, historyDate, this.showHistoryPairedBubbles, latestBuyId, latestSellId, latestTradeId, tradeOrderMap, maxOrder)}
        `;
      });
      
      // 按价格降序排序
      unpairedBuys.sort((a, b) => {
        const priceA = a && a.price ? parseFloat(a.price) : 0;
        const priceB = b && b.price ? parseFloat(b.price) : 0;
        return priceB - priceA;
      });
      unpairedSells.sort((a, b) => {
        const priceA = a && a.price ? parseFloat(a.price) : 0;
        const priceB = b && b.price ? parseFloat(b.price) : 0;
        return priceB - priceA;
      });
      
      // 渲染未配对买入和卖出气泡
      let unpairedBuysHtml = '';
      let unpairedSellsHtml = '';
      
      unpairedBuys.forEach(trade => {
        if (trade && trade.price) {
          const specialClass = this.isSpecialQty(trade, stockName) ? ' special-qty' : '';
          const order = tradeOrderMap.get(trade.id);
          const orderClass = (order === maxOrder || order === 1) ? ' bubble-order-max' : '';
          unpairedBuysHtml += `<span class="compact-bubble buy history${specialClass}" data-trade-id="${trade.id}" data-trade='${JSON.stringify(trade)}' data-stock-name="${stockName}">${trade.price}<span class="bubble-order${orderClass}">${order}</span></span>`;
        }
      });
      
      unpairedSells.forEach(trade => {
        if (trade && trade.price) {
          const specialClass = this.isSpecialQty(trade, stockName) ? ' special-qty' : '';
          const order = tradeOrderMap.get(trade.id);
          const orderClass = (order === maxOrder || order === 1) ? ' bubble-order-max' : '';
          unpairedSellsHtml += `<span class="compact-bubble sell history${specialClass}" data-trade-id="${trade.id}" data-trade='${JSON.stringify(trade)}' data-stock-name="${stockName}">-${trade.price}<span class="bubble-order${orderClass}">${order}</span></span>`;
        }
      });
      
      const hasUnpairedBubbles = unpairedBuysHtml || unpairedSellsHtml;
      
      // 创建主视图内容区域
      mainViewArea = document.createElement('div');
      mainViewArea.className = 'main-view-area';
      mainViewArea.style.cssText = `
        padding: 0;
        margin: 0;
        border-radius: 0;
        background: transparent;
        border: none;
      `;
      
      // 生成主视图内容HTML
      const order1LatestTradeIdForRender = order1LatestTradeId || order1LatestBuyId || order1LatestSellId;
      const mainViewHtml = `
        <div class="compact-trading-suggestion-title">交易建议</div>
        <div class="compact-today-label">序号1(${order1Date})当日数据</div>
        <div class="compact-stock-bubbles order1-suggestion-bubbles">
          ${this.renderBubbles({ stock: stockName, bubbleData: order1BubbleData, latestTradeId: order1LatestTradeIdForRender }, order1Date, tradeOrderMap, maxOrder)}
        </div>
        <div class="compact-suggestion-title">下次交易价格建议</div>
        <div class="compact-suggestion-container">
          <div class="compact-suggestion-row">
            <div class="compact-suggestion-item sell">
              <div class="compact-suggestion-label">建议下次卖出</div>
              <div class="suggestion-bubble-wrapper">
                <div class="suggestion-bubble-row">
                  <span class="suggestion-bubble-indicator sell-indicator" id="suggested-sell-indicator-${stockName}" style="display: none;"></span>
                  <span class="compact-bubble sell suggestion-bubble" id="suggested-sell-${stockName}">--</span>
                </div>
                <span class="suggestion-bubble-diff" id="suggested-sell-diff-${stockName}">--</span>
              </div>
              <div class="compact-threshold-input-wrapper">
                <input type="number" class="compact-threshold-input" id="sell-threshold-${stockName}" value="${this.stockThresholds[stockName] !== undefined ? this.stockThresholds[stockName] : 1}" min="-10" max="10" step="0.1">
                <span class="compact-threshold-percent">%</span>
              </div>
              <div class="compact-threshold-diff" id="threshold-diff-sell-${stockName}">与序号1的差额: --</div>
            </div>
            <div class="threshold-linkage-wrapper">
              <button class="threshold-linkage-btn ${this.stockThresholdLinkage[stockName] ? 'linked' : ''} ${this.stockThresholdLinkageDirection[stockName] || ''}" id="threshold-linkage-${stockName}" data-stock-name="${stockName}" title="${this.stockThresholdLinkage[stockName] ? '点击断开联动' : '点击左半部分：左→右联动，点击右半部分：右→左联动'}">
                <span class="linkage-icon">${this.stockThresholdLinkage[stockName] ? (this.stockThresholdLinkageDirection[stockName] === 'left-to-right' ? '→' : '←') : '⚡'}</span>
              </button>
            </div>
            <div class="compact-suggestion-item buy">
              <div class="compact-suggestion-label">建议下次买进</div>
              <div class="suggestion-bubble-wrapper">
                <div class="suggestion-bubble-row">
                  <span class="suggestion-bubble-indicator" id="suggested-buy-indicator-${stockName}" style="display: none;"></span>
                  <span class="compact-bubble buy suggestion-bubble" id="suggested-buy-${stockName}">--</span>
                </div>
                <span class="suggestion-bubble-diff" id="suggested-buy-diff-${stockName}">--</span>
              </div>
              <div class="compact-threshold-input-wrapper">
                <input type="number" class="compact-threshold-input" id="buy-threshold-${stockName}" value="${this.stockBuyThresholds[stockName] !== undefined ? this.stockBuyThresholds[stockName] : 0}" min="-10" max="10" step="0.1">
                <span class="compact-threshold-percent">%</span>
              </div>
              <div class="compact-threshold-diff" id="threshold-diff-buy-${stockName}">与序号1的差额: --</div>
            </div>
          </div>
        </div>
        ${validDatesWithBubbles.length > 0 ? `
          <div class="compact-section-toggle">
            <div class="compact-divider-container">
              <div class="compact-divider-line"></div>
              <div class="compact-divider-label">历史数据-按日显示</div>
            </div>
          </div>
          <div class="compact-history-container" ${this.showHistoryByDate ? '' : 'style="display: none;"'}>
            ${historyBubblesHtml}
          </div>
        ` : ''}
          <div class="compact-section-toggle">
            <div class="compact-divider-container">
              <div class="compact-divider-line"></div>
              <div class="compact-divider-label">历史数据-按买卖排序显示</div>
            </div>
          </div>
          <div class="compact-history-container" ${this.showHistoryBySide ? '' : 'style="display: none;"'}>
            <div class="compact-unpaired-split-container">
              <div class="compact-unpaired-sell-column">
                <div class="compact-unpaired-column-title sell">历史未配对卖出</div>
                <div class="compact-unpaired-column-bubbles">
                  ${unpairedSellsHtml}
                </div>
              </div>
              <div class="compact-unpaired-buy-column">
                <div class="compact-unpaired-column-title buy">历史未配对买入</div>
                <div class="compact-unpaired-column-bubbles">
                  ${unpairedBuysHtml}
                </div>
              </div>
            </div>
          </div>
      `;
      
      mainViewArea.innerHTML = mainViewHtml;
      
      // 清空内容，只显示主视图区域
      stockContent.innerHTML = '';
      stockContent.appendChild(mainViewArea);
      
      // 确保显示
      mainViewArea.style.display = 'block';
      
      // 立即计算并显示建议价格
      if (order1Trade && order1Trade.price) {
        this.calculateSuggestedPrices(stockName, order1Trade, unpairedBuys, unpairedSells);
      }
      
      // 为卖出阈值输入框添加事件监听器
      const sellThresholdInput = mainViewArea.querySelector(`#sell-threshold-${stockName}`);
      if (sellThresholdInput) {
        sellThresholdInput.addEventListener('input', (e) => {
          const threshold = parseFloat(e.target.value);
          if (!isNaN(threshold) && threshold >= -10 && threshold <= 10) {
            this.stockThresholds[stockName] = threshold;
            
            // 如果联动开启，同步更新买入阈值
            if (this.stockThresholdLinkage[stockName]) {
              this.stockBuyThresholds[stockName] = threshold;
              if (buyThresholdInput) {
                buyThresholdInput.value = threshold;
              }
            }
            
            this.saveSettings();
            this.calculateSuggestedPrices(stockName, order1Trade, unpairedBuys, unpairedSells);
          }
        });
      }
      
      // 为买入阈值输入框添加事件监听器
      const buyThresholdInput = mainViewArea.querySelector(`#buy-threshold-${stockName}`);
      if (buyThresholdInput) {
        buyThresholdInput.addEventListener('input', (e) => {
          const threshold = parseFloat(e.target.value);
          if (!isNaN(threshold) && threshold >= -10 && threshold <= 10) {
            this.stockBuyThresholds[stockName] = threshold;
            
            // 如果联动开启，同步更新卖出阈值
            if (this.stockThresholdLinkage[stockName]) {
              this.stockThresholds[stockName] = threshold;
              if (sellThresholdInput) {
                sellThresholdInput.value = threshold;
              }
            }
            
            this.saveSettings();
            this.calculateSuggestedPrices(stockName, order1Trade, unpairedBuys, unpairedSells);
          }
        });
      }
      
      // 为阈值联动按钮添加点击事件
      const linkageBtn = mainViewArea.querySelector(`#threshold-linkage-${stockName}`);
      if (linkageBtn) {
        linkageBtn.addEventListener('click', (e) => {
          e.preventDefault();
          
          // 获取点击位置相对于按钮的X坐标
          const rect = linkageBtn.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const buttonWidth = rect.width;
          
          // 切换联动状态
          this.stockThresholdLinkage[stockName] = !this.stockThresholdLinkage[stockName];
          
          // 更新按钮样式和提示
          if (this.stockThresholdLinkage[stockName]) {
            linkageBtn.classList.add('linked');
            // 移除之前的方向类
            linkageBtn.classList.remove('left-to-right', 'right-to-left');
            
            // 根据点击位置决定赋值方向
            if (clickX < buttonWidth / 2) {
              // 点击左半部分：左边（卖出）→ 右边（买入）
              this.stockThresholdLinkageDirection[stockName] = 'left-to-right';
              linkageBtn.classList.add('left-to-right');
              linkageBtn.title = '点击断开联动 (左→右)';
              linkageBtn.querySelector('.linkage-icon').textContent = '→';
              
              const currentSellThreshold = this.stockThresholds[stockName] !== undefined ? this.stockThresholds[stockName] : 1;
              this.stockBuyThresholds[stockName] = currentSellThreshold;
              if (buyThresholdInput) {
                buyThresholdInput.value = currentSellThreshold;
              }
            } else {
              // 点击右半部分：右边（买入）→ 左边（卖出）
              this.stockThresholdLinkageDirection[stockName] = 'right-to-left';
              linkageBtn.classList.add('right-to-left');
              linkageBtn.title = '点击断开联动 (右→左)';
              linkageBtn.querySelector('.linkage-icon').textContent = '←';
              
              const currentBuyThreshold = this.stockBuyThresholds[stockName] !== undefined ? this.stockBuyThresholds[stockName] : 0;
              this.stockThresholds[stockName] = currentBuyThreshold;
              if (sellThresholdInput) {
                sellThresholdInput.value = currentBuyThreshold;
              }
            }
          } else {
            linkageBtn.classList.remove('linked', 'left-to-right', 'right-to-left');
            linkageBtn.title = '点击左半部分：左→右联动，点击右半部分：右→左联动';
            linkageBtn.querySelector('.linkage-icon').textContent = '⚡';
          }
          
          this.saveSettings();
          this.calculateSuggestedPrices(stockName, order1Trade, unpairedBuys, unpairedSells);
        });
        
        // 设置初始提示和类
        if (!this.stockThresholdLinkage[stockName]) {
          linkageBtn.title = '点击左半部分：左→右联动，点击右半部分：右→左联动';
        } else {
          const direction = this.stockThresholdLinkageDirection[stockName];
          if (direction) {
            linkageBtn.classList.add(direction);
          }
        }
      }
      
      // 为交易建议视图中的所有配对气泡添加双击事件（包括历史数据）
      const suggestionPairBubbles = mainViewArea.querySelectorAll('.compact-pair');
      suggestionPairBubbles.forEach(pairBubble => {
        pairBubble.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const pairDataStr = pairBubble.dataset.pair;
          const stockName = pairBubble.dataset.stockName;
          
          if (pairDataStr && stockName) {
            try {
              const pairData = JSON.parse(pairDataStr);
              const tempItem = {
                buy: pairData.buy,
                sell: pairData.sell,
                repTrade: pairData.buy
              };
              
              if (window.showPairDetailWithFloatingWindow && typeof window.showPairDetailWithFloatingWindow === 'function') {
                window.showPairDetailWithFloatingWindow(tempItem, stockName);
              }
            } catch (error) {
              console.error('解析配对数据失败:', error);
            }
          }
        });
      });
      
      // 为交易建议视图中的所有未配对气泡添加双击事件（包括历史数据）
      const suggestionUnpairedBubbles = mainViewArea.querySelectorAll('.compact-bubble:not(.compact-pair .compact-bubble)');
      suggestionUnpairedBubbles.forEach(unpairedBubble => {
        unpairedBubble.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const tradeDataStr = unpairedBubble.dataset.trade;
          
          if (tradeDataStr) {
            try {
              const tradeData = JSON.parse(tradeDataStr);
              
              if (window.showTradeDetail && typeof window.showTradeDetail === 'function') {
                window.showTradeDetail(tradeData, 'compact');
              }
            } catch (error) {
              console.error('解析交易数据失败:', error);
            }
          }
        });
      });
    } catch (error) {
      console.error('显示主视图内容失败:', error);
    }
  }

  toggleViewMode() {
    this.currentViewMode = this.currentViewMode === 'horizontal' ? 'vertical' : 'horizontal';
    this.saveSettings();
    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    const data = this.collectData(filterDate);
    const content = this.renderCompactView(data, filterDate);
    this.floatingWindow.setContent(content);
    this.bindEvents();
    this.applyBubbleScale();
  }

  adjustBubbleScale(delta) {
    this.bubbleScale = Math.max(0.5, Math.min(2, this.bubbleScale + delta));
    this.saveSettings();
    this.applyBubbleScale();
    this.updateScaleDisplay();
  }

  adjustHistoryDays(delta) {
    // 安全限制：最大50天
    this.historyDays = Math.max(1, Math.min(50, this.historyDays + delta));
    this.saveSettings();
    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    const data = this.collectData(filterDate);
    const content = this.renderCompactView(data, filterDate);
    this.floatingWindow.setContent(content);
    this.bindEvents();
    this.applyBubbleScale();
  }

  // 重新排序股票
  reorderStocks(draggedStock, targetStock) {
    const draggedIndex = this.stockOrder.indexOf(draggedStock);
    const targetIndex = this.stockOrder.indexOf(targetStock);
    
    // 如果两个股票都不在排序数组中，添加它们
    if (draggedIndex === -1 && targetIndex === -1) {
      this.stockOrder.push(draggedStock);
      this.stockOrder.push(targetStock);
    } else if (draggedIndex === -1) {
      // 只有拖拽的股票不在数组中，插入到目标位置
      this.stockOrder.splice(targetIndex, 0, draggedStock);
    } else if (targetIndex === -1) {
      // 只有目标股票不在数组中，添加到拖拽股票后面
      this.stockOrder.splice(draggedIndex + 1, 0, targetStock);
    } else {
      // 两个都在数组中，交换位置
      this.stockOrder.splice(draggedIndex, 1);
      const newTargetIndex = this.stockOrder.indexOf(targetStock);
      this.stockOrder.splice(newTargetIndex, 0, draggedStock);
    }
    
    this.saveSettings();
    
    // 重新渲染以更新排序
    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    if (filterDate) {
      const data = this.collectData(filterDate);
      const content = this.renderCompactView(data, filterDate);
      this.floatingWindow.setContent(content);
      this.bindEvents();
      this.applyBubbleScale();
    }
  }

  updateHistoryDaysDisplay() {
    const winEl = this.floatingWindow ? this.floatingWindow.getElement() : null;
    if (!winEl) return;

    const historyDaysValue = winEl.querySelector('.history-days-value');
    if (historyDaysValue) {
      historyDaysValue.textContent = `${this.historyDays}天`;
    }
  }

  applyBubbleScale() {
    const winEl = this.floatingWindow ? this.floatingWindow.getElement() : null;
    if (!winEl) return;

    const container = winEl.querySelector('.compact-mode-container');
    if (container) {
      container.style.setProperty('--bubble-scale', this.bubbleScale);
    }

    const grids = winEl.querySelectorAll('.compact-stock-grid:not(.vertical)');
    grids.forEach(grid => {
      let minWidth = 220;
      if (this.bubbleScale > 1.5) {
        minWidth = 350;
      } else if (this.bubbleScale > 1.2) {
        minWidth = 280;
      } else if (this.bubbleScale >= 1) {
        minWidth = 220;
      } else if (this.bubbleScale > 0.7) {
        minWidth = 180;
      } else {
        minWidth = 150;
      }
      grid.style.gridTemplateColumns = `repeat(auto-fill, minmax(${minWidth}px, 1fr))`;
    });
  }

  scrollToStock(stockName) {
    if (!stockName || !this.floatingWindow) return false;

    const winEl = this.floatingWindow.getElement();
    const contentEl = winEl ? winEl.querySelector('.compact-mode-content') : null;
    if (!contentEl) return false;

    const targetCard = Array.from(contentEl.querySelectorAll('.compact-stock-card'))
      .find(card => card.dataset.stockName === stockName);
    if (!targetCard) return false;

    const scrollToCard = () => {
      const contentRect = contentEl.getBoundingClientRect();
      const cardRect = targetCard.getBoundingClientRect();
      const targetScrollTop = contentEl.scrollTop
        + cardRect.top
        - contentRect.top
        - (contentEl.clientHeight - targetCard.offsetHeight) / 2;
      const maxScrollTop = Math.max(0, contentEl.scrollHeight - contentEl.clientHeight);

      contentEl.scrollTo({
        top: Math.max(0, Math.min(targetScrollTop, maxScrollTop)),
        behavior: 'smooth'
      });
    };

    requestAnimationFrame(() => {
      requestAnimationFrame(scrollToCard);
    });
    return true;
  }

  updateScaleDisplay() {
    const winEl = this.floatingWindow ? this.floatingWindow.getElement() : null;
    if (!winEl) return;

    const scaleValue = winEl.querySelector('.scale-value');
    if (scaleValue) {
      scaleValue.textContent = `${Math.round(this.bubbleScale * 100)}%`;
    }
  }

  copyToClipboard() {
    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    
    if (!filterDate) {
      this.speakErrorAndAlert('请先设置筛选条件：选择筛选日期');
      return;
    }
    
    const data = this.collectData(filterDate);
    const text = this.generateTextExport(data, filterDate);
    
    navigator.clipboard.writeText(text).then(() => {
      alert('已复制到剪贴板！');
    }).catch(err => {
      console.error('复制失败:', err);
      alert('复制失败，请手动复制');
    });
  }

  exportAsText() {
    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    const data = this.collectData(filterDate);
    const text = this.generateTextExport(data, filterDate);
    
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `交易数据_${filterDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  generateTextExport(data, filterDate) {
    let text = `交易数据 - ${filterDate}\n`;
    text += `${'='.repeat(50)}\n\n`;
    
    const taiwanStocks = data.filter(s => s.market === '台股');
    const chinaStocks = data.filter(s => s.market === '陆股');
    
    text += this.generateMarketText('台股', taiwanStocks);
    text += this.generateMarketText('陆股', chinaStocks);
    
    let totalBuyQty = 0;
    let totalSellQty = 0;
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    
    data.forEach(s => {
      totalBuyQty += s.totalBuyQty;
      totalSellQty += s.totalSellQty;
      totalBuyAmount += s.totalBuyAmount;
      totalSellAmount += s.totalSellAmount;
    });
    
    text += `${'='.repeat(50)}\n`;
    text += `总计:\n`;
    text += `  买入数量: ${totalBuyQty.toLocaleString()}\n`;
    text += `  卖出数量: ${totalSellQty.toLocaleString()}\n`;
    text += `  净部位: ${(totalBuyQty - totalSellQty).toLocaleString()}\n`;
    text += `  买入金额: ${totalBuyAmount.toLocaleString()}\n`;
    text += `  卖出金额: ${totalSellAmount.toLocaleString()}\n`;
    
    return text;
  }

  generateMarketText(marketName, stocks) {
    if (stocks.length === 0) return '';
    
    let text = `${marketName}:\n`;
    text += `${'-'.repeat(30)}\n`;
    
    stocks.forEach(stock => {
      text += `  ${stock.stock}: `;
      if (stock.netQty !== 0) {
        text += `${stock.netQty > 0 ? '+' : ''}${stock.netQty.toLocaleString()}`;
      }
      text += '\n';
    });
    
    text += '\n';
    return text;
  }

  printView() {
    const winEl = this.floatingWindow ? this.floatingWindow.getElement() : null;
    if (!winEl) return;

    const content = winEl.querySelector('.compact-mode-container');
    if (!content) return;

    const printWindow = window.open('', '_blank');
    
    const styles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(el => el.outerHTML)
      .join('\n');

    const contentClone = content.cloneNode(true);
    
    const originalGrids = winEl.querySelectorAll('.compact-stock-grid');
    const clonedGrids = contentClone.querySelectorAll('.compact-stock-grid');
    let gridPrintStyles = '';
    originalGrids.forEach((originalGrid, index) => {
      if (clonedGrids[index]) {
        clonedGrids[index].style.cssText = originalGrid.style.cssText;
        if (originalGrid.style.gridTemplateColumns) {
          gridPrintStyles += `
            .compact-stock-grid:nth-of-type(${index + 1}) {
              grid-template-columns: ${originalGrid.style.gridTemplateColumns} !important;
            }
          `;
        }
      }
    });

    const isHorizontal = this.currentViewMode === 'horizontal';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>紧凑模式打印</title>
          ${styles}
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
              padding: 10px;
            }

            @media print {
              @page {
                size: ${isHorizontal ? 'A4 landscape' : 'A4 portrait'};
                margin: 10mm;
              }
              
              .compact-stock-grid:not(.vertical) {
                grid-template-columns: none !important;
              }

              ${gridPrintStyles}

              .compact-mode-container {
                --bubble-scale: ${this.bubbleScale} !important;
              }
            }

            .view-toggle-btn,
            .compact-btn,
            .add-trade-btn,
            .history-btn,
            .compact-actions,
            .scale-btn,
            .bubble-scale-control {
              display: none !important;
            }

            .compact-mode-container {
              --bubble-scale: ${this.bubbleScale};
            }
          </style>
        </head>
        <body>
          ${contentClone.outerHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() {
                  window.close();
                };
              }, 500);
            };
          <\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  }

  hideWindow() {
    if (this.floatingWindow) {
      this.floatingWindow.hide();
      this.floatingWindow.destroy();
      this.floatingWindow = null;
    }
  }

  onWindowClose() {
    console.log('紧凑数据导出窗口已关闭');
    // 刷新主程式的资料
    if (window.renderStockModeTable) {
      window.renderStockModeTable();
    }
  }

  onWindowShow() {
    console.log('紧凑数据导出窗口已显示');
  }

  onWindowHide() {
    console.log('紧凑数据导出窗口已隐藏');
  }



  // 获取交易的时间戳
  getTradeTimestamp(trade) {
    const createdAt = trade.createdAt || trade.createdat || trade.created_at;
    return createdAt ? new Date(createdAt).getTime() : new Date(trade.date).getTime();
  }

  // 获取之前的N天日期
  getPreviousNDays(dateStr, n) {
    const result = [];
    const date = new Date(dateStr);
    for (let i = 1; i <= n; i++) {
      const prevDate = new Date(date);
      prevDate.setDate(date.getDate() - i);
      const year = prevDate.getFullYear();
      const month = String(prevDate.getMonth() + 1).padStart(2, '0');
      const day = String(prevDate.getDate()).padStart(2, '0');
      result.push(`${year}-${month}-${day}`);
    }
    return result;
  }

  // 获取股票指定日期的历史气泡数据
  getStockHistoryBubbles(stockName, market, targetDate) {
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    
    const stockTrades = trades.filter(t => t.stock === stockName && t.market === market);
    if (stockTrades.length === 0) return [];
    
    const stockPairing = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
    const pairedBuyIds = new Set(stockPairing.pairedBuyIds || []);
    const pairedSellIds = new Set(stockPairing.pairedSellIds || []);
    
    const dateTrades = stockTrades.filter(t => t.date === targetDate);
    
    const pairedTrades = (stockPairing.pairedTrades || []).filter(pair => {
      const buyDate = pair.buy ? pair.buy.date : null;
      const sellDate = pair.sell ? pair.sell.date : null;
      const pairDate = buyDate > sellDate ? buyDate : sellDate;
      return pairDate === targetDate;
    });
    
    const unpairedBuys = dateTrades.filter(t => t.side === 'buy' && !pairedBuyIds.has(t.id));
    const unpairedSells = dateTrades.filter(t => t.side === 'sell' && !pairedSellIds.has(t.id));
    
    const bubbleData = [];
    
    pairedTrades.forEach(pair => {
      if (pair.hideable === 'Y') return;
      const buyCreatedAt = pair.buy ? new Date(pair.buy.createdAt).getTime() : 0;
      const sellCreatedAt = pair.sell ? new Date(pair.sell.createdAt).getTime() : 0;
      const latestCreatedAt = Math.max(buyCreatedAt, sellCreatedAt);
      
      bubbleData.push({
        type: 'paired',
        buy: pair.buy,
        sell: pair.sell,
        timestamp: latestCreatedAt
      });
    });
    
    unpairedBuys.forEach(trade => {
      if (trade.hideable === 'Y') return;
      bubbleData.push({
        type: 'unpaired',
        trade: trade,
        timestamp: new Date(trade.createdAt).getTime()
      });
    });
    
    unpairedSells.forEach(trade => {
      if (trade.hideable === 'Y') return;
      bubbleData.push({
        type: 'unpaired',
        trade: trade,
        timestamp: new Date(trade.createdAt).getTime()
      });
    });
    
    bubbleData.sort((a, b) => {
      return b.timestamp - a.timestamp;
    });
    
    return bubbleData;
  }

  // 渲染历史气泡（不使用缩放）
  renderHistoryBubbles(bubbleData, targetDate, showPaired = true, latestBuyId = null, latestSellId = null, latestTradeId = null, tradeOrderMap = new Map(), maxOrder = 0) {
    if (!bubbleData || !Array.isArray(bubbleData) || bubbleData.length === 0) {
      return '';
    }

    return bubbleData.map((bubble, index) => {
      if (bubble.type === 'paired') {
        if (!showPaired) return '';
        
        const buyPrice = bubble.buy ? `${bubble.buy.price}` : '';
        const sellPrice = bubble.sell ? `${bubble.sell.price}` : '';
        
        const isBuyToday = bubble.buy && bubble.buy.date === targetDate;
        const isSellToday = bubble.sell && bubble.sell.date === targetDate;
        const bothToday = isBuyToday && isSellToday;
        const oneNotToday = !bothToday && (isBuyToday || isSellToday);
        
        // 判断配对气泡中的两个交易是否同一天
        const sameDay = bubble.buy && bubble.sell && bubble.buy.date === bubble.sell.date;
        
        const isBuyLatest = bubble.buy && bubble.buy.id === latestBuyId;
        const isSellLatest = bubble.sell && bubble.sell.id === latestSellId;
        
        let pairClass = 'compact-pair history';
        if (bothToday) {
          pairClass += ' both-today';
        } else if (oneNotToday) {
          pairClass += ' one-not-today';
        }
        // 添加边框样式类
        if (!sameDay) {
          pairClass += ' cross-day-pair';
        }
        
        let buyClass = 'compact-bubble buy history';
        if (isBuyLatest) buyClass += ' latest-trade';
        if (isBuyToday) buyClass += ' target-date-trade';
        if (bubble.buy) {
          const stockName = bubble.buy.stock;
          if (this.isSpecialQty(bubble.buy, stockName)) buyClass += ' special-qty';
        }
        
        let sellClass = 'compact-bubble sell history';
        if (isSellLatest) sellClass += ' latest-trade';
        if (isSellToday) sellClass += ' target-date-trade';
        if (bubble.sell) {
          const stockName = bubble.sell.stock;
          if (this.isSpecialQty(bubble.sell, stockName)) sellClass += ' special-qty';
        }
        
        const buyOrder = bubble.buy ? tradeOrderMap.get(bubble.buy.id) : '';
        const sellOrder = bubble.sell ? tradeOrderMap.get(bubble.sell.id) : '';
        const buyOrderClass = (buyOrder === maxOrder || buyOrder === 1) ? ' bubble-order-max' : '';
        const sellOrderClass = (sellOrder === maxOrder || sellOrder === 1) ? ' bubble-order-max' : '';
        
        const stockName = bubble.buy ? bubble.buy.stock : (bubble.sell ? bubble.sell.stock : '');
        return `
          <div class="${pairClass}" data-pair='${JSON.stringify({ buy: bubble.buy, sell: bubble.sell })}' data-stock-name="${stockName}">
            ${buyPrice ? `<span class="${buyClass}">${buyPrice}<span class="bubble-order${buyOrderClass}">${buyOrder}</span></span>` : ''}
            ${sellPrice ? `<span class="${sellClass}">-${sellPrice}<span class="bubble-order${sellOrderClass}">${sellOrder}</span></span>` : ''}
          </div>
        `;
      } else {
        const trade = bubble.trade;
        const isToday = trade.date === targetDate;
        const isLatest = trade.id === latestTradeId;
        
        let bubbleClass = `compact-bubble ${trade.side} history`;
        if (isLatest) bubbleClass += ' latest-trade';
        if (isToday) bubbleClass += ' target-date-trade';
        if (this.isSpecialQty(trade, trade.stock)) bubbleClass += ' special-qty';
        
        const order = tradeOrderMap.get(trade.id);
        const orderClass = (order === maxOrder || order === 1) ? ' bubble-order-max' : '';
        
        return `
          <span class="${bubbleClass}" data-trade='${JSON.stringify(trade)}' data-stock-name="${trade.stock}">
            ${trade.side === 'sell' ? '-' : ''}${trade.price}<span class="bubble-order${orderClass}">${order}</span>
          </span>
        `;
      }
    }).join('');
  }

  // 获取交易的时间戳
  getTradeTimestamp(trade) {
    if (!trade) return 0;
    
    // 尝试从不同的时间字段获取时间戳
    const createdAt = trade.createdAt || trade.createdat || trade.created_at;
    if (createdAt) {
      return new Date(createdAt).getTime();
    }
    
    // 如果没有创建时间，使用交易日期
    if (trade.date) {
      return new Date(trade.date).getTime();
    }
    
    return 0;
  }

  // 计算建议卖出和买进价格
  calculateSuggestedPrices(stockName, order1Trade, unpairedBuys = [], unpairedSells = []) {
    if (!stockName) return;
    
    let order1Price = null;
    let order1PriceStr = null;
    
    // 收集前三个交易的价格字符串，用于确定小数位数
    const topPrices = [];
    
    if (order1Trade && order1Trade.price) {
      // 如果提供了 order1Trade，直接使用它的价格
      order1Price = parseFloat(order1Trade.price);
      order1PriceStr = String(order1Trade.price);
      topPrices.push(order1PriceStr);
    } else {
      // 如果没有提供 order1Trade，尝试查找交易建议视图中的序号1交易
      // 首先找到对应的股票卡片
      const stockCard = document.querySelector(`.compact-stock-card[data-stock-name="${stockName}"]`);
      if (stockCard) {
        const tradeOrderMapArray = JSON.parse(stockCard.dataset.tradeOrderMap || '[]');
        const tradeOrderMap = new Map(tradeOrderMapArray);
        
        // 找到序号1的交易ID
        let order1TradeId = null;
        for (const [tradeId, order] of tradeOrderMap.entries()) {
          if (order === 1) {
            order1TradeId = tradeId;
            break;
          }
        }
        
        // 从 window.trades 中找到序号1的交易
        if (order1TradeId) {
          const allTrades = window.trades || [];
          const foundTrade = allTrades.find(t => t.id === order1TradeId);
          if (foundTrade && foundTrade.price) {
            order1Price = parseFloat(foundTrade.price);
            order1PriceStr = String(foundTrade.price);
            topPrices.push(order1PriceStr);
          }
        }
        
        // 收集前三个交易的价格
        const sortedTrades = Array.from(tradeOrderMap.entries())
          .sort((a, b) => a[1] - b[1])
          .slice(0, 3);
        
        const allTrades = window.trades || [];
        sortedTrades.forEach(([tradeId, order]) => {
          const trade = allTrades.find(t => t.id === tradeId);
          if (trade && trade.price) {
            topPrices.push(String(trade.price));
          }
        });
      }
      
      // 如果还是找不到，使用最新的交易
      if (!order1Price) {
        const trades = window.trades || [];
        const stockTrades = trades.filter(t => t.stock === stockName);
        
        if (stockTrades.length === 0) return;
        
        // 按时间戳排序（最新的在前）
        stockTrades.sort((a, b) => {
          const timestampA = a.createdAt ? new Date(a.createdAt).getTime() : new Date(a.date).getTime();
          const timestampB = b.createdAt ? new Date(b.createdAt).getTime() : new Date(b.date).getTime();
          return timestampB - timestampA;
        });
        
        const latestTrade = stockTrades[0];
        if (!latestTrade || !latestTrade.price) return;
        
        order1Price = parseFloat(latestTrade.price);
        order1PriceStr = String(latestTrade.price);
        topPrices.push(order1PriceStr);
        
        // 收集前三笔交易的价格
        stockTrades.slice(0, 3).forEach(trade => {
          if (trade && trade.price) {
            topPrices.push(String(trade.price));
          }
        });
      }
    }
    
    const sellThreshold = this.stockThresholds[stockName] !== undefined ? this.stockThresholds[stockName] : 1;
    const buyThreshold = this.stockBuyThresholds[stockName] !== undefined ? this.stockBuyThresholds[stockName] : 0;
    
    const suggestedSellPrice = order1Price * (1 + sellThreshold / 100);
    const suggestedBuyPrice = order1Price * (1 + buyThreshold / 100);
    
    // 获取前三个气泡中最多的小数位数
    let decimalPlaces = 2;
    topPrices.forEach(priceStr => {
      if (priceStr && priceStr.includes('.')) {
        const places = priceStr.split('.')[1].length;
        if (places > decimalPlaces) {
          decimalPlaces = places;
        }
      }
    });
    
    const sellElement = document.getElementById(`suggested-sell-${stockName}`);
    const buyElement = document.getElementById(`suggested-buy-${stockName}`);
    const sellDiffAmountElement = document.getElementById(`threshold-diff-sell-${stockName}`);
    const buyDiffAmountElement = document.getElementById(`threshold-diff-buy-${stockName}`);
    const sellDiffElement = document.getElementById(`suggested-sell-diff-${stockName}`);
    const buyDiffElement = document.getElementById(`suggested-buy-diff-${stockName}`);
    const buyIndicatorElement = document.getElementById(`suggested-buy-indicator-${stockName}`);
    const sellIndicatorElement = document.getElementById(`suggested-sell-indicator-${stockName}`);
    
    if (sellElement) {
      sellElement.textContent = '-' + suggestedSellPrice.toFixed(decimalPlaces);
    }
    
    if (buyElement) {
      buyElement.textContent = suggestedBuyPrice.toFixed(decimalPlaces);
    }
    
    // 计算并显示序号1与建议下次卖出的单价差
    if (sellDiffElement) {
      const sellPriceDiff = suggestedSellPrice - order1Price;
      if (sellPriceDiff >= 0) {
        sellDiffElement.textContent = '+' + sellPriceDiff.toFixed(decimalPlaces);
      } else {
        sellDiffElement.textContent = sellPriceDiff.toFixed(decimalPlaces);
      }
    }
    
    // 计算并显示序号1与建议下次买进的单价差
    if (buyDiffElement) {
      const buyPriceDiff = suggestedBuyPrice - order1Price;
      if (buyPriceDiff >= 0) {
        buyDiffElement.textContent = '+' + buyPriceDiff.toFixed(decimalPlaces);
      } else {
        buyDiffElement.textContent = buyPriceDiff.toFixed(decimalPlaces);
      }
    }
    
    // 获取该股票的标准交易数量
    const stockInfo = this._findStockByName(stockName);
    const standardQty = stockInfo ? stockInfo.qty : 0;
    
    // 计算并显示卖出差额
    if (sellDiffAmountElement) {
      if (standardQty > 0) {
        // 计算价格差（卖出价格与序号1价格的差）
        const priceDiff = suggestedSellPrice - order1Price;
        // 计算差异金额 = 价格差 * 标准交易数量
        const diffAmount = priceDiff * standardQty;
        
        // 格式化差异金额显示
        sellDiffAmountElement.textContent = `与序号1的差额: ${diffAmount.toFixed(2)}`;
      } else {
        sellDiffAmountElement.textContent = `与序号1的差额: --`;
      }
    }
    
    // 计算并显示买入差额
    if (buyDiffAmountElement) {
      if (standardQty > 0) {
        // 计算价格差（买入价格与序号1价格的差）
        const priceDiff = suggestedBuyPrice - order1Price;
        // 计算差异金额 = 价格差 * 标准交易数量
        const diffAmount = priceDiff * standardQty;
        
        // 格式化差异金额显示
        buyDiffAmountElement.textContent = `与序号1的差额: ${diffAmount.toFixed(2)}`;
      } else {
        buyDiffAmountElement.textContent = `与序号1的差额: --`;
      }
    }
    
    // 检查建议下次买进的单价与历史未配对卖出中某一个气泡的单价是否低（有价差利润）
    // 逻辑：建议买进价格 < 历史未配对卖出价格，意味着可以低价买回，有利润空间
    const matchingSellTradeIds = [];
    let showBuyIndicator = false;
    
    if (unpairedSells && Array.isArray(unpairedSells) && unpairedSells.length > 0 && order1Price > 0) {
      for (const trade of unpairedSells) {
        if (trade && trade.price) {
          const historyPrice = parseFloat(trade.price);
          if (historyPrice > 0 && suggestedBuyPrice < historyPrice) {
            matchingSellTradeIds.push(trade.id);
            showBuyIndicator = true;
          }
        }
      }
    }
    
    // 显示或隐藏建议买进小圈圈
    if (buyIndicatorElement) {
      buyIndicatorElement.style.display = showBuyIndicator ? 'inline-block' : 'none';
    }
    
    // 先清除所有历史未配对卖出气泡的小圈圈
    const allSellBubbles = document.querySelectorAll('.compact-unpaired-sell-column [data-trade-id]');
    allSellBubbles.forEach(bubble => {
      bubble.classList.remove('suggestion-matching-sell');
    });
    
    // 给符合条件的历史未配对卖出气泡添加红色小圈圈
    matchingSellTradeIds.forEach(tradeId => {
      const bubbleElement = document.querySelector(`[data-trade-id="${tradeId}"]`);
      if (bubbleElement) {
        bubbleElement.classList.add('suggestion-matching-sell');
      }
    });
    
    // 检查建议下次卖出的单价与历史未配对买入中某一个气泡的单价是否高（有价差利润）
    // 逻辑：建议卖出价格 > 历史未配对买入价格，意味着可以高价卖出，有利润空间
    const matchingBuyTradeIds = [];
    let showSellIndicator = false;
    
    if (unpairedBuys && Array.isArray(unpairedBuys) && unpairedBuys.length > 0 && order1Price > 0) {
      for (const trade of unpairedBuys) {
        if (trade && trade.price) {
          const historyPrice = parseFloat(trade.price);
          if (historyPrice > 0 && suggestedSellPrice > historyPrice) {
            matchingBuyTradeIds.push(trade.id);
            showSellIndicator = true;
          }
        }
      }
    }
    
    // 显示或隐藏建议卖出小圈圈
    if (sellIndicatorElement) {
      sellIndicatorElement.style.display = showSellIndicator ? 'inline-block' : 'none';
    }
    
    // 先清除所有历史未配对买入气泡的小圈圈
    const allBuyBubbles = document.querySelectorAll('.compact-unpaired-buy-column [data-trade-id]');
    allBuyBubbles.forEach(bubble => {
      bubble.classList.remove('suggestion-matching-buy');
    });
    
    // 给符合条件的历史未配对买入气泡添加红色小圈圈
    matchingBuyTradeIds.forEach(tradeId => {
      const bubbleElement = document.querySelector(`[data-trade-id="${tradeId}"]`);
      if (bubbleElement) {
        bubbleElement.classList.add('suggestion-matching-buy');
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.CompactModePlugin = CompactModePlugin;
  window.compactModePlugin = new CompactModePlugin();
  window.openCompactDataExportWindow = function() {
    window.compactModePlugin.openWindow();
  };
}
