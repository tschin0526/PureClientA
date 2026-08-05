// Simplified front-end-only trades app for pureClientA
// - Stocks list is inlined from StockCodeList.txt and parsed to {name, qty, market}
// - UI fields: #stockInput (datalist), #sideSelect, #priceInput, buttons #addTxBtn
// - Stores trades in IndexedDB (migrated from localStorage key 'trades_v1')

// 全局变量
let currentBubbleMode = 'original';


// 引入股票数据模块
// 注意：在HTML中需要先加载stockData.js
// 例如：<script src="stockData.js"></script>

// 获取今天的日期（YYYY-MM-DD 格式）
function getTodayDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 格式化数字，添加千位分隔符
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// 将容器滚动到指定股票的位置（居中显示），找到则返回 true，否则返回 false
function scrollToStockPosition(stockName) {
  if (!stockName) return false;

  // 如果当前在表格-股票模式，尝试在表格中查找并滚动到该行
  if (currentView === 'table' && currentTableMode === 'stock') {
    // 首先尝试通过 ID 查找股票行
    const stockRowId = `stock-row-${stockName.replace(/\s+/g, '-').toLowerCase()}`;
    let row = document.getElementById(stockRowId);
    
    // 如果通过 ID 找不到，尝试遍历所有行查找
    if (!row) {
      const tb = document.querySelector('tbody');
      if (tb) {
        const rows = Array.from(tb.querySelectorAll('tr'));
        row = rows.find(r => {
          // 检查行的 ID 是否匹配
          if (r.id && r.id.startsWith('stock-row-')) {
            const rowStockName = r.id.replace('stock-row-', '').replace(/-/g, ' ').toLowerCase();
            if (rowStockName === stockName.toLowerCase()) return true;
          }
          // 也检查第一个单元格中的股票名称
          const firstTd = r.querySelector('td');
          if (!firstTd) return false;
          const text = firstTd.textContent.trim();
          return text.includes(stockName) || text.startsWith(stockName);
        });
      }
    }

    if (row) {
      const tb = document.querySelector('tbody');
      const container = tb ? (tb.parentElement || tb) : null;
      if (container) {
        const offsetTop = row.offsetTop;
        const targetScroll = Math.max(0, offsetTop - Math.floor(container.clientHeight / 2) + Math.floor(row.clientHeight / 2));
        container.scrollTop = Math.min(targetScroll, container.scrollHeight - container.clientHeight);
        console.log('滚动到股票位置:', stockName, 'offsetTop:', offsetTop, 'targetScroll:', targetScroll);
        return true;
      }
    }
  }



  return false;
}

// 跳转到指定股票位置（使用 scrollIntoView，更可靠）
function jumpToStock(stockName) {
  if (!stockName) return false;
  
  // 构建股票行的ID
  const stockRowId = `stock-row-${stockName.replace(/\s+/g, '-').toLowerCase()}`;
  const stockRow = document.getElementById(stockRowId);
  
  if (stockRow) {
    // 滚动到股票行
    stockRow.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'center'
    });
    
    // 高亮显示股票行
    stockRow.style.backgroundColor = '#fff3cd';
    setTimeout(() => {
      stockRow.style.backgroundColor = '';
    }, 1000);
    
    console.log('跳转到股票位置:', stockName);
    return true;
  }
  
  console.log('找不到股票行:', stockName, stockRowId);
  return false;
}

// 暴露到 window 对象，供其他模块调用
window.jumpToStock = jumpToStock;

// 暴露到 window 对象，供其他模块调用
window.scrollToStockPosition = scrollToStockPosition;


// 获取离今天最接近的前一个有交易的日期
function getRecentTradeDate(trades) {
  if (!trades || trades.length === 0) {
    return null;
  }
  
  // 提取所有唯一的日期，过滤掉今天的日期
  const today = getTodayDate();
  const uniqueDates = [...new Set(trades.map(trade => trade.date))]
    .filter(date => date !== today);
  
  if (uniqueDates.length === 0) {
    return null;
  }
  
  // 将日期转换为时间戳进行比较
  const todayTimestamp = new Date(today).getTime();
  const dateTimestamps = uniqueDates.map(date => {
    return {
      date: date,
      timestamp: new Date(date).getTime()
    };
  });
  
  // 找到离今天最近的日期
  let recentDate = null;
  let minDiff = Infinity;
  
  dateTimestamps.forEach(item => {
    // 只考虑今天之前的日期
    if (item.timestamp < todayTimestamp) {
      const diff = todayTimestamp - item.timestamp;
      if (diff < minDiff) {
        minDiff = diff;
        recentDate = item.date;
      }
    }
  });
  
  return recentDate;
}

// IndexedDB 配置
const DB_NAME = 'TradesDB';
const DB_VERSION = 2;
const STORE_NAME = 'trades';
const OLD_STORAGE_KEY = 'trades_v1';

// IndexedDB 封装
class TradesDB {
  constructor() {
    this.db = null;
  }

  // 打开数据库
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = (event) => {
        console.error('IndexedDB 打开失败:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 创建交易对象存储空间
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, {
            keyPath: 'id',
            autoIncrement: false
          });
          
          // 创建索引，用于快速查询
          store.createIndex('date', 'date', { unique: false });
          store.createIndex('createdAt', 'createdAt', { unique: false });
          store.createIndex('stock', 'stock', { unique: false });
          store.createIndex('market', 'market', { unique: false });
          store.createIndex('side', 'side', { unique: false });
        }
        
        // 创建配对结果对象存储空间
        const PAIRINGS_STORE_NAME = 'pairings';
        if (!db.objectStoreNames.contains(PAIRINGS_STORE_NAME)) {
          const pairingsStore = db.createObjectStore(PAIRINGS_STORE_NAME, {
            keyPath: 'stockName',
            autoIncrement: false
          });
          
          // 创建索引，用于快速查询
          pairingsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }
      };
    });
  }

  // 从 localStorage 迁移数据到 IndexedDB
  async migrateFromLocalStorage() {
    try {
      const oldData = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldData) {
        const trades = JSON.parse(oldData);
        if (trades.length > 0) {
          await this.saveAll(trades);
          localStorage.removeItem(OLD_STORAGE_KEY);
          console.log('已从 localStorage 迁移', trades.length, '条记录到 IndexedDB');
        }
      }
    } catch (error) {
      console.error('从 localStorage 迁移数据失败:', error);
    }
  }

  // 保存一条交易记录
  save(trade) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(trade);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };
    });
  }

  // 保存多条交易记录
  saveAll(trades) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);

      trades.forEach(trade => {
        store.put(trade);
      });

      transaction.oncomplete = (event) => {
        resolve(trades.length);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // 获取所有交易记录
  getAll() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result || []);
      };
    });
  }

  // 删除一条交易记录
  delete(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(id);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      transaction.oncomplete = (event) => {
        resolve(true);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // 清空所有交易记录
  clear() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(true);
      };
    });
  }

  // 保存配对结果
  savePairing(pairingData) {
    return new Promise((resolve, reject) => {
      const PAIRINGS_STORE_NAME = 'pairings';
      const transaction = this.db.transaction([PAIRINGS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PAIRINGS_STORE_NAME);
      
      pairingData.updatedAt = new Date().toISOString();
      
      const request = store.put(pairingData);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      transaction.oncomplete = (event) => {
        resolve(true);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // 获取单个股票的配对结果
  getPairing(stockName) {
    return new Promise((resolve, reject) => {
      const PAIRINGS_STORE_NAME = 'pairings';
      const transaction = this.db.transaction([PAIRINGS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PAIRINGS_STORE_NAME);
      const request = store.get(stockName);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result || null);
      };
    });
  }

  // 获取所有配对结果
  getAllPairings() {
    return new Promise((resolve, reject) => {
      const PAIRINGS_STORE_NAME = 'pairings';
      const transaction = this.db.transaction([PAIRINGS_STORE_NAME], 'readonly');
      const store = transaction.objectStore(PAIRINGS_STORE_NAME);
      const request = store.getAll();

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result || []);
      };
    });
  }

  // 删除单个股票的配对结果
  deletePairing(stockName) {
    return new Promise((resolve, reject) => {
      const PAIRINGS_STORE_NAME = 'pairings';
      const transaction = this.db.transaction([PAIRINGS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PAIRINGS_STORE_NAME);
      const request = store.delete(stockName);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      transaction.oncomplete = (event) => {
        resolve(true);
      };

      transaction.onerror = (event) => {
        reject(event.target.error);
      };
    });
  }

  // 清空所有配对结果
  clearAllPairings() {
    return new Promise((resolve, reject) => {
      const PAIRINGS_STORE_NAME = 'pairings';
      const transaction = this.db.transaction([PAIRINGS_STORE_NAME], 'readwrite');
      const store = transaction.objectStore(PAIRINGS_STORE_NAME);
      const request = store.clear();

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(true);
      };
    });
  }
}

// 初始化数据库实例
const tradesDB = new TradesDB();
// 暴露到全局，供其他脚本（如 bubbleDetail.js）访问
window.tradesDB = tradesDB;

function generateId() { return 't_' + Date.now() + '_' + Math.floor(Math.random()*1000); }

// UI elements
let stockInput, stockListEl, sideSelect, priceInput, remarkInput, addBtn;
let tableBody, summaryEl;

// 筛选相关元素
let filterDateInput, filterStockInput, filterStockList, filterBtn, resetBtn, clearPairingsBtn;

// 视图模式相关元素
let toggleViewBtn, tableView, textView, textModePairing, textModeNormal;

// 当前视图模式 ('table' 或 'text')
let currentView = 'table';
window.currentView = currentView;



// 当前表格模式 ('detail' 或 'stock')
let currentTableMode = 'stock';
window.currentTableMode = currentTableMode;

// 配对状态
let pairingState = {
  latestPaired: false,
  historyPaired: false
};

// 配对结果缓存（按股票名称存储）
let pairingCache = {};
window.pairingCache = pairingCache;

// 配对气泡屏蔽状态（按股票名称存储）
let pairBubbleHiddenState = {};

// 股票折叠状态（按股票名称存储）
let stockCollapsedState = {};

// 屏蔽气泡状态
let hideHideableBubbles = true;
let hideHideableBubblesCheckbox;

// 只显示当天股票状态
let showOnlyFilterDateStocks = false;
let showOnlyFilterDateStocksCheckbox;

// 气泡模式相关元素
let taiwanStockBubbles, chinaStockBubbles;

// 文本模式相关元素
let textOutput;

// 统计相关元素
let toggleStatsBtn, statsContent;

// 输入模式相关元素
let singleInputMode, batchInputMode, multiStockInputMode;
let batchStockInput, batchStockListEl, batchInput, addBatchBtn;
let multiStockInput, addMultiStockBtn;

// 当前输入模式 ('single', 'batch' 或 'multiStock')
let currentInputMode = 'single';

let trades = [];
let filteredTrades = [];

// populate datalist（异步：确保从 SQLite 读取最新数据）
async function populateDatalist() {
  if (!stockListEl) return;

  let stocks = window.STOCKS || [];
  try {
    if (window.stockCodeManager && typeof window.stockCodeManager.getStockList === 'function') {
      const sqliteStocks = await window.stockCodeManager.getStockList();
      if (sqliteStocks && sqliteStocks.length > 0) {
        stocks = sqliteStocks;
      }
    }
  } catch(e) { /* 回退到 window.STOCKS */ }

  stockListEl.innerHTML = '';
  stocks.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.label = `${s.name} (${s.qty}, ${s.market})`;
    stockListEl.appendChild(opt);
  });

  // 同时填充筛选下拉列表
  if (filterStockList) {
    filterStockList.innerHTML = '';
    stocks.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.label = `${s.name} (${s.qty}, ${s.market})`;
      filterStockList.appendChild(opt);
    });
  }

  // 同时填充批量输入下拉列表
  if (batchStockListEl) {
    batchStockListEl.innerHTML = '';
    stocks.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.label = `${s.name} (${s.qty}, ${s.market})`;
      batchStockListEl.appendChild(opt);
    });
  }

  // 同时填充新增交易模态框下拉列表
  const addTradeStockList = document.getElementById('addTradeStockList');
  if (addTradeStockList) {
    addTradeStockList.innerHTML = '';
    stocks.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.label = `${s.name} (${s.qty}, ${s.market})`;
      addTradeStockList.appendChild(opt);
    });
  }
}

// 更新所有股票下拉列表（供外部调用，异步）
async function updateAllStockDatalists() {
  await populateDatalist();

  let stocks = window.STOCKS || [];
  try {
    if (window.stockCodeManager && typeof window.stockCodeManager.getStockList === 'function') {
      const sqliteStocks = await window.stockCodeManager.getStockList();
      if (sqliteStocks && sqliteStocks.length > 0) {
        stocks = sqliteStocks;
      }
    }
  } catch(e) { /* 回退 */ }

  // 更新筛选下拉列表（populateDatalist 已处理，此处为双重保险）
  if (filterStockList && !filterStockList.hasChildNodes()) {
    filterStockList.innerHTML = '';
    stocks.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.label = `${s.name} (${s.qty}, ${s.market})`;
      filterStockList.appendChild(opt);
    });
  }

  // 更新股票跳转下拉列表
  const stockJumpSelect = document.getElementById('stockJumpSelect');
  if (stockJumpSelect) {
    stockJumpSelect.innerHTML = '<option value="">跳转到股票</option>';
    stocks.forEach(s => {
      const opt = document.createElement('option');
      opt.value = s.name;
      opt.textContent = s.name;
      stockJumpSelect.appendChild(opt);
    });
  }
}

// 暴露到全局
window.updateAllStockDatalists = updateAllStockDatalists;

// 更新跳转到股票下拉选单（异步：从 SQLite 读取最新数据）
async function updateStockJumpSelect() {
  const stockJumpSelect = document.getElementById('stockJumpSelect');
  if (!stockJumpSelect) return;

  stockJumpSelect.innerHTML = '<option value="">跳转到股票</option>';

  // 如果勾选了只显示当天股票，则只显示当天有交易的股票
  if (showOnlyFilterDateStocks) {
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    if (filterDate) {
      const todayStocks = new Set();
      const tradesToCheck = filteredTrades.length > 0 ? filteredTrades : trades;
      tradesToCheck.forEach(t => {
        if (t.date === filterDate) {
          todayStocks.add(t.stock);
        }
      });
      todayStocks.forEach(stockName => {
        const opt = document.createElement('option');
        opt.value = stockName;
        opt.textContent = stockName;
        stockJumpSelect.appendChild(opt);
      });
      return;
    }
  }

  // 默认显示所有股票（从 SQLite 读取最新数据）
  let stocks = window.STOCKS || [];
  try {
    if (window.stockCodeManager && typeof window.stockCodeManager.getStockList === 'function') {
      const sqliteStocks = await window.stockCodeManager.getStockList();
      if (sqliteStocks && sqliteStocks.length > 0) {
        stocks = sqliteStocks;
      }
    }
  } catch(e) { /* 回退到 window.STOCKS */ }
  stocks.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    stockJumpSelect.appendChild(opt);
  });
}

function findStockByName(name) {
  if (!name) return null;
  const n = name.trim();
  // 使用 window.STOCKS 以支持动态切换
  const stocks = window.STOCKS;
  return stocks.find(s => s.name === n) || null;
}

function renderTrades() {
  // 更新表格头部为详细模式
  const tableHead = document.getElementById('tableHead');
  if (tableHead) {
    tableHead.innerHTML = `
      <tr>
        <th>日期</th>
        <th>市场</th>
        <th>股票</th>
        <th>买/卖</th>
        <th>数量</th>
        <th>单价</th>
        <th>备注</th>
        <th>金额</th>
        <th>操作</th>
      </tr>
    `;
  }
  
  tableBody.innerHTML = '';
  const list = filteredTrades.slice().sort((a,b) => new Date(b.date) - new Date(a.date));
  list.forEach(t => {
    const tr = document.createElement('tr');
    // 显示完整小数位数，不使用toFixed固定位数
    const priceText = `${t.price}`;
    const amountText = `${Number(t.amount)}`;
    tr.innerHTML = `
      <td>${t.date}</td>
      <td>${escapeHtml(t.market)}</td>
      <td>${escapeHtml(t.stock)}</td>
      <td>${t.side === 'buy' ? '买入' : '卖出'}</td>
      <td>${t.qty}</td>
      <td>${priceText}</td>
      <td>${escapeHtml(t.remark || '')}</td>
      <td>${amountText}</td>
      <td><button data-id="${t.id}" class="del">删除</button></td>
    `;
    tableBody.appendChild(tr);
  });
  attachRowHandlers();
  renderSummary();
}

// 股票模式表格渲染函数
async function renderStockModeTable() {
  // 更新表格头部为股票模式
  const tableHead = document.getElementById('tableHead');
  if (tableHead) {
    tableHead.innerHTML = `
      <tr>
        <th style="border: 1px solid #9ca3af;">股票</th>
        <th style="border: 1px solid #9ca3af;">单价</th>
        <th style="border: 1px solid #9ca3af;">市场</th>
        <th style="border: 1px solid #9ca3af;">操作</th>
      </tr>
    `;
  }
  
  tableBody.innerHTML = '';
  
  // 从数据库加载配对结果
  try {
    const allPairings = await tradesDB.getAllPairings();
    // 将数据库中的配对结果加载到内存缓存
    allPairings.forEach(pairing => {
      pairingCache[pairing.stockName] = {
        pairedTrades: pairing.pairedTrades || [],
        pairedBuyIds: pairing.pairedBuyIds || [],
        pairedSellIds: pairing.pairedSellIds || []
      };
    });
  } catch (error) {
    console.error('加载配对结果失败:', error.message);
  }
  
  // 获取筛选日期
  const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
  
  // 按股票和市场分组交易记录（包含所有交易，用于计算被屏蔽的数量）
  const allStockGroups = {};
  
  // 如果有筛选日期，使用所有交易记录，以便包含配对中的另一个交易
  let allTradesForGrouping = filterDate ? trades : filteredTrades;
  
  // 先使用所有交易分组（包括被屏蔽的），用于计算被屏蔽数量
  allTradesForGrouping.forEach(t => {
    const key = `${t.stock}_${t.market}`;
    if (!allStockGroups[key]) {
      allStockGroups[key] = {
        stock: t.stock,
        market: t.market,
        allTrades: [],
        hiddenBubbleCount: 0,
        hiddenPairCount: 0
      };
    }
    allStockGroups[key].allTrades.push(t);
    // 计算被屏蔽的气泡数量
    if (t.hideable === 'Y') {
      allStockGroups[key].hiddenBubbleCount++;
    }
  });
  
  // 计算被屏蔽的配对交易数量
  Object.keys(allStockGroups).forEach(key => {
    const stock = allStockGroups[key].stock;
    const cacheKey = stock;
    const cachedPairing = pairingCache[cacheKey];
    if (cachedPairing && cachedPairing.pairedTrades) {
      cachedPairing.pairedTrades.forEach(pair => {
        if (pair.hideable === 'Y') {
          allStockGroups[key].hiddenPairCount++;
        }
      });
    }
  });
  
  // 准备用于显示的交易（可能过滤掉被屏蔽的）
  let displayTrades = allTradesForGrouping;
  if (hideHideableBubbles) {
    displayTrades = displayTrades.filter(t => t.hideable !== 'Y');
  }
  
  // 构建最终的股票组
  const stockGroups = {};
  displayTrades.forEach(t => {
    const key = `${t.stock}_${t.market}`;
    if (!stockGroups[key]) {
      stockGroups[key] = {
        stock: t.stock,
        market: t.market,
        trades: [],
        allTrades: allStockGroups[key] ? allStockGroups[key].allTrades : [],
        hiddenBubbleCount: allStockGroups[key] ? allStockGroups[key].hiddenBubbleCount : 0,
        hiddenPairCount: allStockGroups[key] ? allStockGroups[key].hiddenPairCount : 0
      };
    }
    stockGroups[key].trades.push(t);
  });
  
  // 按照股票代码管理插件的持久化数据顺序排序（与 getStockList() 一致）
  let sortedGroups = [];
  let stockOrderSource = null;

  try {
    if (window.stockCodeManager && typeof window.stockCodeManager.getStockList === 'function') {
      stockOrderSource = await window.stockCodeManager.getStockList();
    }
  } catch (e) {
    console.warn('[renderStockModeTable] getStockList 失败，回退到 window.STOCKS:', e);
  }

  if (!stockOrderSource || !stockOrderSource.length) {
    stockOrderSource = window.STOCKS || null;
  }

  if (stockOrderSource) {
    // 遍历股票列表，按顺序添加有交易记录的股票
    stockOrderSource.forEach(stockInfo => {
      const key = `${stockInfo.name}_${stockInfo.market}`;
      if (stockGroups[key]) {
        sortedGroups.push(stockGroups[key]);
        delete stockGroups[key];
      }
    });
  } else {
    // 如果都不可用，使用市场+名称排序
    sortedGroups.push(...Object.values(stockGroups).sort((a, b) => {
      if (a.market !== b.market) {
        return a.market.localeCompare(b.market);
      }
      return a.stock.localeCompare(b.stock);
    }));
  }
  
  // 如果勾选了只显示当天股票，则过滤出当天有交易的股票
  if (showOnlyFilterDateStocks && filterDate) {
    sortedGroups = sortedGroups.filter(group => {
      // 检查该股票是否有当天日期的交易
      return group.trades.some(t => t.date === filterDate);
    });
  }
  
  // 渲染每个股票组
  sortedGroups.forEach(group => {
    // 按创建时间排序交易记录（最新的在前）
    const sortedTrades = group.trades.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 创建价格气泡容器
    const priceContainer = document.createElement('div');
    priceContainer.className = 'price-bubbles-container';
    
    // 分离买入和卖出交易（使用allTrades，包含所有交易，包括被屏蔽的）
    const allBuyTrades = group.allTrades.filter(t => t.side === 'buy');
    const allSellTrades = group.allTrades.filter(t => t.side === 'sell');
    
    // 合并配对结果
    const allPairedBuyIds = new Set();
    const allPairedSellIds = new Set();
    const allPairedTrades = [];
    
    // 检查缓存中是否有配对结果
    const cacheKey = group.stock;
    const cachedPairing = pairingCache[cacheKey];
    
    // 检查直接的pairedTrades数组（主要结构）
    if (cachedPairing && cachedPairing.pairedTrades) {
      cachedPairing.pairedTrades.forEach(pair => {
        allPairedTrades.push(pair);
        if (pair.buy && pair.buy.id) allPairedBuyIds.add(pair.buy.id);
        if (pair.sell && pair.sell.id) allPairedSellIds.add(pair.sell.id);
      });
    }
    
    // 创建统一的交易项列表（配对交易和未配对交易混在一起）
    const allItems = [];
    
    // 添加配对交易项
    allPairedTrades.forEach(pair => {
      // 检查交易是否仍然存在
      const buyExists = allBuyTrades.some(t => t.id === pair.buy.id);
      const sellExists = allSellTrades.some(t => t.id === pair.sell.id);
      if (!buyExists || !sellExists) return;
      
      // 检查是否有筛选日期，如果有，只显示包含该日期交易的配对
      if (filterDate) {
        const hasFilterDateTrade = pair.buy.date === filterDate || pair.sell.date === filterDate;
        if (!hasFilterDateTrade) return;
      }
      
      // 如果勾选了屏蔽气泡，不显示被屏蔽的配对交易
      if (hideHideableBubbles && pair.hideable === 'Y') return;
      
      // 使用买入或卖出中较新的时间作为排序依据
      const buyCreatedAt = new Date(pair.buy.createdAt);
      const sellCreatedAt = new Date(pair.sell.createdAt);
      const latestCreatedAt = buyCreatedAt > sellCreatedAt ? buyCreatedAt : sellCreatedAt;
      
      allItems.push({
        type: 'paired',
        buy: pair.buy,
        sell: pair.sell,
        hideable: pair.hideable,
        createdAt: latestCreatedAt,
        repTrade: buyCreatedAt > sellCreatedAt ? pair.buy : pair.sell
      });
    });
    
    // 找到未配对的最低买入价和最高卖出价
    let unpairedBuys = allBuyTrades.filter(t => !allPairedBuyIds.has(t.id));
    let unpairedSells = allSellTrades.filter(t => !allPairedSellIds.has(t.id));
    
    // 如果有筛选日期，只保留筛选日期的未配对交易
    if (filterDate) {
      unpairedBuys = unpairedBuys.filter(t => t.date === filterDate);
      unpairedSells = unpairedSells.filter(t => t.date === filterDate);
    }
    
    // 找出该股票 createdAt 最新的交易ID（按股票名称）
    let latestTradeId = null;
    let latestCreatedAt = null;
    trades.forEach(t => {
      if (t.stock === group.stock) {
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
    
    // 添加未配对的买入交易项
    allBuyTrades.forEach(trade => {
      if (allPairedBuyIds.has(trade.id)) return;
      
      // 如果有筛选日期，只添加筛选日期的未配对交易
      if (filterDate && trade.date !== filterDate) return;
      
      // 如果勾选了屏蔽气泡，不显示被屏蔽的未配对气泡
      if (hideHideableBubbles && trade.hideable === 'Y') return;
      
      allItems.push({
        type: 'unpaired-buy',
        trade: trade,
        createdAt: new Date(trade.createdAt),
        repTrade: trade
      });
    });
    
    // 添加未配对的卖出交易项
    allSellTrades.forEach(trade => {
      if (allPairedSellIds.has(trade.id)) return;
      
      // 如果有筛选日期，只添加筛选日期的未配对交易
      if (filterDate && trade.date !== filterDate) return;
      
      // 如果勾选了屏蔽气泡，不显示被屏蔽的未配对气泡
      if (hideHideableBubbles && trade.hideable === 'Y') return;
      
      allItems.push({
        type: 'unpaired-sell',
        trade: trade,
        createdAt: new Date(trade.createdAt),
        repTrade: trade
      });
    });
    
    // 按创建时间排序（从新到旧）
    allItems.sort((a, b) => b.createdAt - a.createdAt);
    
    // 渲染所有交易项
    allItems.forEach((item, index) => {
      if (item.type === 'paired') {
        const pairBubble = document.createElement('div');
        pairBubble.className = 'trade-pair';
        
        // 如果配对被屏蔽，添加加粗的虚线边框
        if (item.hideable === 'Y') {
          pairBubble.style.border = '3px dashed black';
          pairBubble.style.borderRadius = '16px';
        }
        
        // 计算利润率并添加小星星标识
        function calculateProfitRate(buyPrice, sellPrice, stockName) {
          const buyAmount = buyPrice * item.buy.qty;
          const sellAmount = sellPrice * item.sell.qty;
          const buyTax = calculateTax(stockName, 'buy', buyAmount);
          const sellTax = calculateTax(stockName, 'sell', sellAmount);
          const netProfit = sellAmount - buyAmount - buyTax - sellTax;
          const profitRate = (netProfit / buyAmount) * 100;
          return profitRate;
        }
        
        function getStarCount(profitRate) {
          if (profitRate <= 1) return 1;
          if (profitRate <= 2) return 2;
          if (profitRate <= 3) return 3;
          if (profitRate <= 4) return 4;
          if (profitRate <= 5) return 5;
          return 6;
        }
        
        const profitRate = calculateProfitRate(item.buy.price, item.sell.price, group.stock);
        const starCount = getStarCount(profitRate);
        
        // 创建星星标识
        const starsContainer = document.createElement('div');
        starsContainer.style.cssText = `
          position: absolute;
          top: -8px;
          left: 50%;
          transform: translateX(-50%);
          display: flex;
          gap: 1px;
          background-color: rgba(255, 255, 255, 0.9);
          padding: 2px 4px;
          border-radius: 10px;
          border: 1px solid #ffd700;
        `;
        
        for (let i = 0; i < starCount; i++) {
          const star = document.createElement('span');
          star.textContent = '★';
          star.style.cssText = `
            color: #ff0000;
            font-size: 8px;
            text-shadow: 0 0 1px #000;
          `;
          starsContainer.appendChild(star);
        }
        
        pairBubble.style.position = 'relative';
        pairBubble.appendChild(starsContainer);
        
        // 添加双击事件显示配对利润核算（使用FloatingWindow）
        pairBubble.addEventListener('dblclick', (e) => {
          // 阻止事件冒泡，避免触发买入或卖出气泡的双击事件
          e.stopPropagation();
          showPairDetailWithFloatingWindow(item, group.stock);
        });
        
        const buyBubble = document.createElement('span');
        buyBubble.className = 'price-bubble buy';
        buyBubble.textContent = `${item.buy.price}`;
        buyBubble.dataset.tradeId = item.buy.id;
        buyBubble.dataset.price = item.buy.price;
        buyBubble.dataset.side = item.buy.side;
        buyBubble.dataset.stock = item.buy.stock;
        buyBubble.dataset.date = item.buy.date;
        buyBubble.dataset.remark = item.buy.remark || '';
        
        // 为最新交易添加 latest-trade 类
        if (item.buy.id === latestTradeId) {
          buyBubble.classList.add('latest-trade');
        }
        
        // 为特殊交易数量的气泡添加淡黄色背景
        try {
          const stocks = window.STOCKS;
          if (stocks) {
            const stockData = stocks.find(function(s) { return s.name === item.buy.stock; });
            if (stockData && item.buy.qty !== stockData.qty) {
              buyBubble.style.backgroundColor = '#FFF9C4';
            }
          }
        } catch(e) {
          console.error('检查特殊交易数量失败:', e);
        }
        
        // 为今天日期的气泡添加红色粗线条边框
        if (item.buy.date === getTodayDate()) {
          buyBubble.style.border = '3px solid red';
          buyBubble.style.borderRadius = '20px';
        } else {
          // 为最近交易日期的气泡添加蓝色粗线条边框
          const recentDate = getRecentTradeDate(trades);
          if (recentDate && item.buy.date === recentDate) {
            buyBubble.style.border = '3px solid blue';
            buyBubble.style.borderRadius = '20px';
          }
        }
        
        // 为 hideable === 'Y' 的气泡添加虚线边框
        if (item.buy.hideable === 'Y') {
          buyBubble.style.border = '3px dashed black';
          buyBubble.style.borderRadius = '20px';
        }
        
        // 添加双击事件
        buyBubble.addEventListener('dblclick', () => {
          if (window.DebugAlert) {
            DebugAlert.info(`双击买入气泡，交易ID: ${item.buy.id}`);
          }
          if (window.showTradeDetail) {
            window.showTradeDetail(item.buy, 'main');
          } else {
            if (window.DebugAlert) {
              DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
            }
          }
        });
        
        pairBubble.appendChild(buyBubble);
        
        const sellBubble = document.createElement('span');
        sellBubble.className = 'price-bubble sell';
        sellBubble.textContent = `-${item.sell.price}`;
        sellBubble.dataset.tradeId = item.sell.id;
        sellBubble.dataset.price = item.sell.price;
        sellBubble.dataset.side = item.sell.side;
        sellBubble.dataset.stock = item.sell.stock;
        sellBubble.dataset.date = item.sell.date;
        sellBubble.dataset.remark = item.sell.remark || '';
        
        // 为最新交易添加 latest-trade 类
        if (item.sell.id === latestTradeId) {
          sellBubble.classList.add('latest-trade');
        }
        
        // 为特殊交易数量的气泡添加淡黄色背景
        try {
          const stocks = window.STOCKS;
          if (stocks) {
            const stockData = stocks.find(function(s) { return s.name === item.sell.stock; });
            if (stockData && item.sell.qty !== stockData.qty) {
              sellBubble.style.backgroundColor = '#FFF9C4';
            }
          }
        } catch(e) {
          console.error('检查特殊交易数量失败:', e);
        }
        
        // 为今天日期的气泡添加红色粗线条边框
        if (item.sell.date === getTodayDate()) {
          sellBubble.style.border = '3px solid red';
          sellBubble.style.borderRadius = '20px';
        } else {
          // 为最近交易日期的气泡添加蓝色粗线条边框
          const recentDate = getRecentTradeDate(trades);
          if (recentDate && item.sell.date === recentDate) {
            sellBubble.style.border = '3px solid blue';
            sellBubble.style.borderRadius = '20px';
          }
        }
        
        // 为 hideable === 'Y' 的气泡添加虚线边框
        if (item.sell.hideable === 'Y') {
          sellBubble.style.border = '3px dashed black';
          sellBubble.style.borderRadius = '20px';
        }
        
        // 添加双击事件
        sellBubble.addEventListener('dblclick', () => {
          if (window.DebugAlert) {
            DebugAlert.info(`双击卖出气泡，交易ID: ${item.sell.id}`);
          }
          if (window.showTradeDetail) {
            window.showTradeDetail(item.sell, 'main');
          } else {
            if (window.DebugAlert) {
              DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
            }
          }
        });
        
        pairBubble.appendChild(sellBubble);
        
        // 立即为配对气泡添加拖拽功能
        addDraggableToPair(pairBubble);
        
        priceContainer.appendChild(pairBubble);
      } else if (item.type === 'unpaired-buy' || item.type === 'unpaired-sell') {
        const trade = item.trade;
        const priceBubble = document.createElement('span');
        
        priceBubble.dataset.tradeId = trade.id;
        priceBubble.dataset.price = trade.price;
        priceBubble.dataset.side = trade.side;
        priceBubble.dataset.stock = trade.stock;
        priceBubble.dataset.date = trade.date;
        priceBubble.dataset.remark = trade.remark || '';
        
        if (trade.side === 'sell') {
          priceBubble.className = 'price-bubble sell';
          if (trade.id === latestTradeId) {
            priceBubble.classList.add('latest-trade');
          }
          priceBubble.textContent = `-${trade.price}`;
        } else {
          priceBubble.className = 'price-bubble buy';
          if (trade.id === latestTradeId) {
            priceBubble.classList.add('latest-trade');
          }
          priceBubble.textContent = `${trade.price}`;
        }
        
        // 为特殊交易数量的气泡添加淡黄色背景
        try {
          const stocks = window.STOCKS;
          if (stocks) {
            const stockData = stocks.find(function(s) { return s.name === trade.stock; });
            if (stockData && trade.qty !== stockData.qty) {
              priceBubble.style.backgroundColor = '#FFF9C4';
            }
          }
        } catch(e) {
          console.error('检查特殊交易数量失败:', e);
        }
        
        // 为今天日期的气泡添加红色粗线条边框
        if (trade.date === getTodayDate()) {
          priceBubble.style.border = '3px solid red';
          priceBubble.style.borderRadius = '20px';
        } else {
          // 为最近交易日期的气泡添加蓝色粗线条边框
          const recentDate = getRecentTradeDate(trades);
          if (recentDate && trade.date === recentDate) {
            priceBubble.style.border = '3px solid blue';
            priceBubble.style.borderRadius = '20px';
          }
        }
        
        // 为 hideable === 'Y' 的气泡添加虚线边框
        if (trade.hideable === 'Y') {
          priceBubble.style.border = '3px dashed black';
          priceBubble.style.borderRadius = '20px';
        }
        
        // 为每个股票中createdAt值最大的气泡（第一个，因为已排序）添加网格线背景
        if (index === 0) {
          priceBubble.style.backgroundImage = 'linear-gradient(to right, #cccccc 1px, transparent 1px), linear-gradient(to bottom, #cccccc 1px, transparent 1px)';
          priceBubble.style.backgroundSize = '5px 5px';
        }
        
        // 添加双击事件监听器
        priceBubble.addEventListener('dblclick', () => {
          if (window.DebugAlert) {
            DebugAlert.info(`双击表格模式气泡，交易ID: ${trade.id}`);
          }
          if (window.showTradeDetail) {
            window.showTradeDetail(trade, 'main');
          } else {
            if (window.DebugAlert) {
              DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
            }
          }
        });
        
        // 立即为气泡添加拖拽功能
        addDraggableToBubble(priceBubble);
        
        priceContainer.appendChild(priceBubble);
      }
    });
    
    // 创建股票行
    const tr = document.createElement('tr');
    tr.id = `stock-row-${group.stock.replace(/\s+/g, '-').toLowerCase()}`;
    
    // 根据市场设置不同的背景颜色
    const bgColor = group.market === '台股' ? '#f0f9ff' : '#fefce8'; // 台股：淡蓝色，陆股：淡黄色
    
    // 创建单元格
    const stockCell = document.createElement('td');
    stockCell.style.padding = '10px';
    stockCell.style.border = '1px solid #9ca3af';
    stockCell.style.fontWeight = 'bold';
    stockCell.style.backgroundColor = bgColor;
    stockCell.style.verticalAlign = 'top';
    stockCell.style.width = '1px';
    
    // 创建股票内容容器
    const stockContent = document.createElement('div');
    stockContent.style.display = 'flex';
    stockContent.style.flexDirection = 'column';
    stockContent.style.gap = '8px';
    stockContent.style.width = 'fit-content';
    stockContent.style.maxWidth = '100%';
    
    // 创建股票名称和展开/收起按钮一体化容器
    const stockHeader = document.createElement('div');
    stockHeader.style.display = 'flex';
    stockHeader.style.justifyContent = 'flex-start';
    stockHeader.style.alignItems = 'center';
    stockHeader.style.width = 'fit-content';
    stockHeader.style.maxWidth = '100%';
    
    // 创建一体化的展开/收起按钮（包含股票名称）
    const stockToggleBtn = document.createElement('button');
    stockToggleBtn.className = 'stock-toggle-btn';
    stockToggleBtn.style.cssText = `
      padding: 2px 4px;
      border: 1px solid #d1d5db;
      border-radius: 3px;
      background-color: #f3f4f6;
      color: #374151;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      display: flex;
      justify-content: space-between;
      align-items: center;
      width: fit-content;
      text-align: left;
      white-space: nowrap;
    `;
    
    // 创建按钮内容容器
    const btnContent = document.createElement('span');
    
    // 构建股票名称文本，如果有被屏蔽的气泡，始终显示数量（当数量大于0时）
    let stockNameText = group.stock;
    if (group.hiddenBubbleCount > 0) {
      stockNameText += ` -${group.hiddenBubbleCount}`;
    }
    if (group.hiddenPairCount > 0) {
      stockNameText += ` -${group.hiddenPairCount}`;
    }
    btnContent.textContent = stockNameText;
    
    // 创建箭头
    const arrow = document.createElement('span');
    arrow.textContent = ' ▼';
    arrow.style.marginLeft = '8px';
    
    // 添加内容到按钮
    stockToggleBtn.appendChild(btnContent);
    stockToggleBtn.appendChild(arrow);
    
    stockToggleBtn.onmouseover = function() {
      this.style.backgroundColor = '#e5e7eb';
      this.style.borderColor = '#9ca3af';
    };
    stockToggleBtn.onmouseout = function() {
      this.style.backgroundColor = '#f3f4f6';
      this.style.borderColor = '#d1d5db';
    };
    
    stockHeader.appendChild(stockToggleBtn);
    
    // 创建按钮工具条（默认隐藏）
    const stockToolbar = document.createElement('div');
    stockToolbar.style.cssText = `
      display: none;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
      padding: 6px;
      background-color: #f3f4f6;
      border-radius: 4px;
      border: 1px solid #d1d5db;
      width: fit-content;
      max-width: 200px;
    `;
    
    // 创建折叠该股票按钮
    const collapseStockBtn = document.createElement('button');
    collapseStockBtn.className = 'collapse-stock-btn';
    collapseStockBtn.style.cssText = `
      padding: 4px 8px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      background-color: #fef2f2;
      color: #991b1b;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      white-space: nowrap;
      display: inline-block;
      width: auto;
      min-width: auto;
    `;
    collapseStockBtn.textContent = '折叠该股票';
    
    collapseStockBtn.onmouseover = function() {
      this.style.backgroundColor = '#fee2e2';
      this.style.borderColor = '#fca5a5';
    };
    collapseStockBtn.onmouseout = function() {
      this.style.backgroundColor = '#fef2f2';
      this.style.borderColor = '#d1d5db';
    };
    
    // 创建股票讯息按钮
    const stockInfoBtn = document.createElement('button');
    stockInfoBtn.className = 'stock-info-btn';
    stockInfoBtn.style.cssText = `
      padding: 4px 8px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      background-color: #dbeafe;
      color: #1e40af;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      white-space: nowrap;
      display: inline-block;
      width: auto;
      min-width: auto;
    `;
    stockInfoBtn.textContent = '股票讯息';
    
    stockInfoBtn.onmouseover = function() {
      this.style.backgroundColor = '#bfdbfe';
      this.style.borderColor = '#93c5fd';
    };
    stockInfoBtn.onmouseout = function() {
      this.style.backgroundColor = '#dbeafe';
      this.style.borderColor = '#d1d5db';
    };
    
    // 添加股票讯息按钮点击事件
    stockInfoBtn.addEventListener('click', () => {
      window.stockInfoPlugin.showStockInfo(group.stock, group.allTrades);
    });
    
    // 添加折叠该股票按钮点击事件
    collapseStockBtn.addEventListener('click', () => {
      // 折叠股票行，只保留一个最小化的手柄
      const stockRow = tr;
      const stockHandle = document.createElement('div');
      stockHandle.className = 'stock-collapse-handle';
      stockHandle.style.cssText = `
        padding: 2px 6px;
        border: 1px solid #d1d5db;
        border-radius: 3px;
        background-color: #f3f4f6;
        color: #374151;
        font-size: 10px;
        cursor: pointer;
        transition: all 0.2s ease;
        font-weight: bold;
        white-space: nowrap;
        display: inline-block;
        margin: 1px;
        line-height: 1.2;
      `;
      stockHandle.textContent = group.stock + ' ▶';
      
      stockHandle.onmouseover = function() {
        this.style.backgroundColor = '#e5e7eb';
        this.style.borderColor = '#9ca3af';
      };
      stockHandle.onmouseout = function() {
        this.style.backgroundColor = '#f3f4f6';
        this.style.borderColor = '#d1d5db';
      };
      
      // 点击手柄展开股票
      stockHandle.addEventListener('click', () => {
        // 恢复原始行内容
        stockRow.innerHTML = '';
        stockRow.appendChild(stockCell);
        stockRow.appendChild(priceCell);
        stockRow.appendChild(marketCell);
        stockRow.appendChild(actionCell);
      });
      
      // 清空行内容，只添加手柄
      stockRow.innerHTML = '';
      const handleCell = document.createElement('td');
      handleCell.colSpan = 4;
      handleCell.style.padding = '4px';
      handleCell.style.border = '1px solid #9ca3af';
      handleCell.style.backgroundColor = bgColor;
      handleCell.style.textAlign = 'left';
      handleCell.appendChild(stockHandle);
      stockRow.appendChild(handleCell);
    });
    
    // 添加折叠该股票按钮到工具条
    stockToolbar.appendChild(collapseStockBtn);
    
    // 添加股票讯息按钮到工具条
    stockToolbar.appendChild(stockInfoBtn);
    
    // 创建买卖建议按钮
    const buySellAdviceBtn = document.createElement('button');
    buySellAdviceBtn.className = 'buy-sell-advice-btn';
    buySellAdviceBtn.style.cssText = `
      padding: 4px 8px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      background-color: #10b981;
      color: white;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      white-space: nowrap;
      margin-top: 4px;
      display: inline-block;
      width: auto;
      min-width: auto;
    `;
    buySellAdviceBtn.textContent = '买卖建议';
    
    buySellAdviceBtn.onmouseover = function() {
      this.style.backgroundColor = '#059669';
      this.style.borderColor = '#9ca3af';
    };
    buySellAdviceBtn.onmouseout = function() {
      this.style.backgroundColor = '#10b981';
      this.style.borderColor = '#d1d5db';
    };
    
    // 添加买卖建议按钮点击事件
    buySellAdviceBtn.addEventListener('click', () => {
      if (window.buySellAdvicePlugin) {
        window.buySellAdvicePlugin.showAdvice(group.stock, group.trades, pairingCache);
      } else {
        alert('买卖建议插件未加载');
      }
    });
    
    // 添加买卖建议按钮到工具条
    stockToolbar.appendChild(buySellAdviceBtn);
    
    // 创建隐藏/显示配对气泡按钮
    const togglePairedBtn = document.createElement('button');
    togglePairedBtn.className = 'toggle-paired-btn';
    togglePairedBtn.style.cssText = `
      padding: 4px 8px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      background-color: #fef3c7;
      color: #92400e;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      white-space: nowrap;
      margin-top: 4px;
      display: inline-block;
      width: auto;
      min-width: auto;
    `;
    togglePairedBtn.textContent = '隐藏配对气泡';
    
    togglePairedBtn.onmouseover = function() {
      this.style.backgroundColor = '#fde68a';
      this.style.borderColor = '#9ca3af';
    };
    togglePairedBtn.onmouseout = function() {
      this.style.backgroundColor = '#fef3c7';
      this.style.borderColor = '#d1d5db';
    };
    
    // 添加隐藏/显示配对气泡按钮点击事件
    let pairedBubblesHidden = false;
    togglePairedBtn.addEventListener('click', () => {
      pairedBubblesHidden = !pairedBubblesHidden;
      if (pairedBubblesHidden) {
        togglePairedBtn.style.backgroundColor = '#fde68a';
        togglePairedBtn.textContent = '显示配对气泡';
        // 隐藏配对气泡
        const pairedBubbles = priceContainer.querySelectorAll('.trade-pair');
        pairedBubbles.forEach(bubble => {
          bubble.style.display = 'none';
        });
      } else {
        togglePairedBtn.style.backgroundColor = '#fef3c7';
        togglePairedBtn.textContent = '隐藏配对气泡';
        // 显示配对气泡
        const pairedBubbles = priceContainer.querySelectorAll('.trade-pair');
        pairedBubbles.forEach(bubble => {
          bubble.style.display = 'block';
        });
      }
    });
    
    // 添加隐藏/显示配对气泡按钮到工具条
    stockToolbar.appendChild(togglePairedBtn);
    
    // 创建屏蔽气泡管理按钮
    const bubbleHideManagerBtn = document.createElement('button');
    bubbleHideManagerBtn.className = 'bubble-hide-manager-btn';
    bubbleHideManagerBtn.style.cssText = `
      padding: 4px 8px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      background-color: #e0e7ff;
      color: #3730a3;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      white-space: nowrap;
      margin-top: 4px;
      display: inline-block;
      width: auto;
      min-width: auto;
    `;
    bubbleHideManagerBtn.textContent = '屏蔽气泡管理';
    
    bubbleHideManagerBtn.onmouseover = function() {
      this.style.backgroundColor = '#c7d2fe';
      this.style.borderColor = '#9ca3af';
    };
    bubbleHideManagerBtn.onmouseout = function() {
      this.style.backgroundColor = '#e0e7ff';
      this.style.borderColor = '#d1d5db';
    };
    
    // 添加屏蔽气泡管理按钮点击事件
    bubbleHideManagerBtn.addEventListener('click', () => {
      if (window.openBubbleHideManagerWindow) {
        window.openBubbleHideManagerWindow(group.stock);
      }
    });
    
    // 添加屏蔽气泡管理按钮到工具条
    stockToolbar.appendChild(bubbleHideManagerBtn);
    
    // 添加股票头部和工具条到股票内容
    stockContent.appendChild(stockHeader);
    stockContent.appendChild(stockToolbar);
    
    // 只有在设定了筛选日期的情况下才显示历史数据显示 checkbox
    if (filterDate) {
      // 创建历史数据显示 checkbox 容器
      const historyDataContainer = document.createElement('div');
      historyDataContainer.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
        margin-top: 4px;
      `;
      
      // 创建 checkbox
      const historyDataCheckbox = document.createElement('input');
      historyDataCheckbox.type = 'checkbox';
      historyDataCheckbox.id = `history-data-${group.stock.replace(/\s+/g, '-')}`;
      historyDataCheckbox.style.cssText = `
        width: 14px;
        height: 14px;
        cursor: pointer;
      `;
      
      // 创建 label
      const historyDataLabel = document.createElement('label');
      historyDataLabel.htmlFor = historyDataCheckbox.id;
      historyDataLabel.textContent = '历史数据';
      historyDataLabel.style.cssText = `
        font-size: 12px;
        font-weight: bold;
        color: #3730a3;
        cursor: pointer;
        white-space: nowrap;
      `;
      
      // 添加 checkbox 变化事件
      historyDataCheckbox.addEventListener('change', () => {
        if (window.DebugAlert) {
          DebugAlert.info('历史数据 checkbox 状态变化，股票：' + group.stock + ', 状态：' + historyDataCheckbox.checked);
        }
        
        // 创建或切换历史数据 grid
        let historyGrid = priceCell.querySelector('.history-data-grid');
        if (historyDataCheckbox.checked) {
          // 如果 checkbox 被勾选，显示 grid
          if (!historyGrid) {
            // 默认为日期行模式
            const isRowMode = true;
            
            // 创建历史数据 grid 容器（独立区块，有自己的滚动条）
            const historyGridContainer = document.createElement('div');
            historyGridContainer.className = 'history-data-grid';
            historyGridContainer.style.cssText = `
              margin-top: 8px;
              width: 100%;
              box-sizing: border-box;
              border: 1px solid #e5e7eb;
              border-radius: 8px;
              padding: 8px;
              background-color: #fafafa;
            `;
            
            // 获取该股票的交易和配对信息（与主表格一致）
            const stockTrades = group.trades || []; // 使用与主表格相同的交易数据
            const pairing = pairingCache[group.stock] || {};
            const pairedBuyIds = new Set(pairing.pairedBuyIds || []);
            const pairedSellIds = new Set(pairing.pairedSellIds || []);
            
            // 过滤掉筛选日期的交易，只保留在历史数据中会显示的交易
            const historyTrades = HistoryDataModule.filterHistoryTrades(stockTrades, filterDate);
            
            // 计算该股票整体的未配对买入和卖出的最大/最小单价
            const priceExtremes = HistoryDataModule.calculateUnpairedPriceExtremes(historyTrades, pairedBuyIds, pairedSellIds);
            const stockBuyMinPrice = priceExtremes.buy.minPrice;
            const stockBuyMaxPrice = priceExtremes.buy.maxPrice;
            const stockBuyMinTrade = priceExtremes.buy.minTrade;
            const stockBuyMaxTrade = priceExtremes.buy.maxTrade;
            const stockSellMinPrice = priceExtremes.sell.minPrice;
            const stockSellMaxPrice = priceExtremes.sell.maxPrice;
            const stockSellMinTrade = priceExtremes.sell.minTrade;
            const stockSellMaxTrade = priceExtremes.sell.maxTrade;
            
            // 创建股票整体未配对最大/最小单价气泡容器
            if (stockBuyMinPrice !== null || stockBuyMaxPrice !== null || stockSellMinPrice !== null || stockSellMaxPrice !== null) {
              const stockMinMaxContainer = document.createElement('div');
              stockMinMaxContainer.style.cssText = `
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                padding: 8px;
                background-color: #f0fdf4;
                border-radius: 6px;
                border: 1px solid #86efac;
                margin-bottom: 8px;
              `;
              
              // 创建未配对买入最大单价气泡
              if (stockBuyMaxPrice !== null) {
                const buyMaxBubble = document.createElement('div');
                buyMaxBubble.className = 'price-bubble';
                buyMaxBubble.style.cssText = `
                  display: inline-flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 4px 8px;
                  border: 2px solid #93c5fd;
                  border-radius: 12px;
                  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                  font-size: 11px;
                  font-weight: 600;
                  color: #1e40af;
                  white-space: nowrap;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                  margin: 0;
                  position: relative;
                `;
                
                // 价格标签
                const buyMaxPriceLabel = document.createElement('div');
                buyMaxPriceLabel.style.cssText = `
                  font-size: 12px;
                `;
                buyMaxPriceLabel.textContent = `${stockBuyMaxPrice}`;
                buyMaxBubble.appendChild(buyMaxPriceLabel);
                
                // 日期标签（显示在气泡上缘的框线上）
                if (stockBuyMaxTrade) {
                  const buyMaxDateLabel = document.createElement('div');
                  buyMaxDateLabel.style.cssText = `
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: transparent;
                    padding: 0 4px;
                    font-size: 8px;
                    color: #000000;
                    font-weight: bold;
                    white-space: nowrap;
                  `;
                  // 年份只显示2位，如2026-03-05显示为26-03-05
                  const shortDate = stockBuyMaxTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4');
                  buyMaxDateLabel.textContent = shortDate;
                  buyMaxBubble.appendChild(buyMaxDateLabel);
                }
                
                // 添加双击事件显示所有未配对买入气泡（由高到低）
                buyMaxBubble.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  if (window.showUnpairedTradesBubbles && allUnpairedBuys.length > 0) {
                    window.showUnpairedTradesBubbles(allUnpairedBuys, group.stock, 'buy', 'desc');
                  }
                });
                stockMinMaxContainer.appendChild(buyMaxBubble);
              }
              
              // 创建未配对买入最小单价气泡
              if (stockBuyMinPrice !== null) {
                const buyMinBubble = document.createElement('div');
                buyMinBubble.className = 'price-bubble';
                buyMinBubble.style.cssText = `
                  display: inline-flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 4px 8px;
                  border: 2px solid #93c5fd;
                  border-radius: 12px;
                  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
                  font-size: 11px;
                  font-weight: 600;
                  color: #1e40af;
                  white-space: nowrap;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                  margin: 0;
                  position: relative;
                `;
                
                // 价格标签
                const buyMinPriceLabel = document.createElement('div');
                buyMinPriceLabel.style.cssText = `
                  font-size: 12px;
                `;
                buyMinPriceLabel.textContent = `${stockBuyMinPrice}`;
                buyMinBubble.appendChild(buyMinPriceLabel);
                
                // 日期标签（显示在气泡上缘的框线上）
                if (stockBuyMinTrade) {
                  const buyMinDateLabel = document.createElement('div');
                  buyMinDateLabel.style.cssText = `
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: transparent;
                    padding: 0 4px;
                    font-size: 8px;
                    color: #000000;
                    font-weight: bold;
                    white-space: nowrap;
                  `;
                  // 年份只显示2位，如2026-03-05显示为26-03-05
                  const shortDate = stockBuyMinTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4');
                  buyMinDateLabel.textContent = shortDate;
                  buyMinBubble.appendChild(buyMinDateLabel);
                }
                
                // 添加双击事件显示所有未配对买入气泡（由低到高）
                buyMinBubble.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  if (window.showUnpairedTradesBubbles && allUnpairedBuys.length > 0) {
                    window.showUnpairedTradesBubbles(allUnpairedBuys, group.stock, 'buy', 'asc');
                  }
                });
                stockMinMaxContainer.appendChild(buyMinBubble);
              }
              
              // 创建未配对卖出最大单价气泡
              if (stockSellMaxPrice !== null) {
                const sellMaxBubble = document.createElement('div');
                sellMaxBubble.className = 'price-bubble';
                sellMaxBubble.style.cssText = `
                  display: inline-flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 4px 8px;
                  border: 2px solid #fca5a5;
                  border-radius: 12px;
                  background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
                  font-size: 11px;
                  font-weight: 600;
                  color: #991b1b;
                  white-space: nowrap;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                  margin: 0;
                  position: relative;
                `;
                
                // 价格标签
                const sellMaxPriceLabel = document.createElement('div');
                sellMaxPriceLabel.style.cssText = `
                  font-size: 12px;
                `;
                sellMaxPriceLabel.textContent = `-${stockSellMaxPrice}`;
                sellMaxBubble.appendChild(sellMaxPriceLabel);
                
                // 日期标签（显示在气泡上缘的框线上）
                if (stockSellMaxTrade) {
                  const sellMaxDateLabel = document.createElement('div');
                  sellMaxDateLabel.style.cssText = `
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: transparent;
                    padding: 0 4px;
                    font-size: 8px;
                    color: #000000;
                    font-weight: bold;
                    white-space: nowrap;
                  `;
                  // 年份只显示2位，如2026-03-05显示为26-03-05
                  const shortDate = stockSellMaxTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4');
                  sellMaxDateLabel.textContent = shortDate;
                  sellMaxBubble.appendChild(sellMaxDateLabel);
                }
                
                // 添加双击事件显示所有未配对卖出气泡（由高到低）
                sellMaxBubble.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  if (window.showUnpairedTradesBubbles && allUnpairedSells.length > 0) {
                    window.showUnpairedTradesBubbles(allUnpairedSells, group.stock, 'sell', 'desc');
                  }
                });
                stockMinMaxContainer.appendChild(sellMaxBubble);
              }
              
              // 创建未配对卖出最小单价气泡
              if (stockSellMinPrice !== null) {
                const sellMinBubble = document.createElement('div');
                sellMinBubble.className = 'price-bubble';
                sellMinBubble.style.cssText = `
                  display: inline-flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                  padding: 4px 8px;
                  border: 2px solid #fca5a5;
                  border-radius: 12px;
                  background: linear-gradient(135deg, #fecaca 0%, #fca5a5 100%);
                  font-size: 11px;
                  font-weight: 600;
                  color: #991b1b;
                  white-space: nowrap;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                  margin: 0;
                  position: relative;
                `;
                
                // 价格标签
                const sellMinPriceLabel = document.createElement('div');
                sellMinPriceLabel.style.cssText = `
                  font-size: 12px;
                `;
                sellMinPriceLabel.textContent = `-${stockSellMinPrice}`;
                sellMinBubble.appendChild(sellMinPriceLabel);
                
                // 日期标签（显示在气泡上缘的框线上）
                if (stockSellMinTrade) {
                  const sellMinDateLabel = document.createElement('div');
                  sellMinDateLabel.style.cssText = `
                    position: absolute;
                    top: -6px;
                    left: 50%;
                    transform: translateX(-50%);
                    background-color: transparent;
                    padding: 0 4px;
                    font-size: 8px;
                    color: #000000;
                    font-weight: bold;
                    white-space: nowrap;
                  `;
                  // 年份只显示2位，如2026-03-05显示为26-03-05
                  const shortDate = stockSellMinTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4');
                  sellMinDateLabel.textContent = shortDate;
                  sellMinBubble.appendChild(sellMinDateLabel);
                }
                
                // 添加双击事件显示所有未配对卖出气泡（由低到高）
                sellMinBubble.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  if (window.showUnpairedTradesBubbles && allUnpairedSells.length > 0) {
                    window.showUnpairedTradesBubbles(allUnpairedSells, group.stock, 'sell', 'asc');
                  }
                });
                stockMinMaxContainer.appendChild(sellMinBubble);
              }
              
              historyGridContainer.appendChild(stockMinMaxContainer);
            }
            
            // 创建可横向滚动的容器（只滚动历史数据区块内部）
            const scrollContainer = document.createElement('div');
            if (isRowMode) {
              // 日期行模式：垂直布局，每个日期占一行
              scrollContainer.style.cssText = `
                display: flex;
                flex-direction: column;
                gap: 4px;
                overflow-y: auto;
                max-height: 300px;
                width: 100%;
              `;
            } else {
              // 日期列模式：水平布局，每个日期占一列
              scrollContainer.style.cssText = `
                display: flex;
                gap: 6px;
                overflow-x: auto;
                overflow-y: hidden;
                padding-bottom: 4px;
                width: 100%;
              `;
            }
            
            // 在历史数据中显示的交易中找出最新的交易ID（根据创建时间）
            const latestTradeId = HistoryDataModule.findLatestTradeId(historyTrades, group.stock);
            
            // 按日期分组交易
            const tradesByDate = HistoryDataModule.groupTradesByDate(stockTrades);
            
            // 按日期排序（最近的在前）
            const sortedDates = HistoryDataModule.getSortedDates(tradesByDate, false);
            
            // 为每个日期创建列/行（日期 + 气泡），但跳过筛选日期和没有交易的日期
            sortedDates.forEach(date => {
              // 如果日期等于筛选日期，则跳过（因为上面已经显示了）
              if (filterDate && date === filterDate) {
                return;
              }
              const dateTrades = tradesByDate[date];
              
              // 检查该日期是否有交易数据
              const hasTrades = HistoryDataModule.hasTradesForDate(tradesByDate, date, pairing, pairedBuyIds, pairedSellIds);
              
              // 如果没有交易数据，则跳过该日期
              if (!hasTrades) {
                return;
              }
              
              // 日期容器
              const dateContainer = document.createElement('div');
              if (isRowMode) {
                // 日期行模式：水平布局，日期在左边，气泡在右边
                dateContainer.style.cssText = `
                  display: flex;
                  flex-direction: row;
                  gap: 6px;
                  align-items: flex-start;
                  width: 100%;
                  flex-shrink: 0;
                `;
              } else {
                // 日期列模式：垂直布局，日期在上方，气泡在下方
                dateContainer.style.cssText = `
                  display: flex;
                  flex-direction: column;
                  gap: 4px;
                  min-width: 100px;
                  flex-shrink: 0;
                `;
              }
              
              // 日期单元格
              const dateCell = document.createElement('div');
              dateCell.textContent = date;
              if (isRowMode) {
                dateCell.style.cssText = `
                  padding: 6px 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  background-color: #ffffff;
                  text-align: center;
                  font-size: 11px;
                  font-weight: 500;
                  color: #374151;
                  white-space: nowrap;
                  min-width: 90px;
                  flex-shrink: 0;
                `;
              } else {
                dateCell.style.cssText = `
                  padding: 6px 10px;
                  border: 1px solid #e5e7eb;
                  border-radius: 6px;
                  background-color: #ffffff;
                  text-align: center;
                  font-size: 11px;
                  font-weight: 500;
                  color: #374151;
                  white-space: nowrap;
                `;
              }
              
              // 气泡容器
              const bubbleCell = document.createElement('div');
              if (isRowMode) {
                bubbleCell.style.cssText = `
                  display: flex;
                  flex-wrap: wrap;
                  gap: 6px;
                  padding: 6px;
                  background-color: #ffffff;
                  border-radius: 6px;
                  border: 1px solid #e5e7eb;
                  min-height: 36px;
                  flex: 1;
                  align-items: center;
                `;
              } else {
                bubbleCell.style.cssText = `
                  display: flex;
                  flex-wrap: wrap;
                  gap: 6px;
                  padding: 6px;
                  background-color: #ffffff;
                  border-radius: 6px;
                  border: 1px solid #e5e7eb;
                  min-height: 36px;
                  align-items: center;
                `;
              }
              
              // 找出该日期的配对
              const datePairs = [];
              if (pairing.pairedTrades) {
                pairing.pairedTrades.forEach(pair => {
                  const pairDate = pair.buy.date > pair.sell.date ? pair.buy.date : pair.sell.date;
                  if (pairDate === date) {
                    datePairs.push(pair);
                  }
                });
              }
              
              // 添加配对气泡（包含买入和卖出气泡，与主表格一致）
              datePairs.forEach(pair => {
                // 如果勾选了屏蔽气泡，不显示被屏蔽的配对交易
                if (hideHideableBubbles && pair.hideable === 'Y') return;
                
                const pairBubble = document.createElement('div');
                pairBubble.className = 'trade-pair';
                pairBubble.style.cssText = `
                  display: inline-flex;
                  align-items: center;
                  gap: 2px;
                  padding: 2px 4px;
                  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
                  border: 1px solid #fcd34d;
                  border-radius: 12px;
                  cursor: pointer;
                  position: relative;
                  box-shadow: 0 1px 2px rgba(0,0,0,0.05);
                  margin: 0;
                `;
                
                // 如果配对被屏蔽，添加加粗的虚线边框
                if (pair.hideable === 'Y') {
                  pairBubble.style.border = '3px dashed black';
                  pairBubble.style.borderRadius = '16px';
                }
                
                // 添加双击事件显示配对详情
                pairBubble.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  const tempItem = {
                    buy: pair.buy,
                    sell: pair.sell,
                    repTrade: pair.buy
                  };
                  if (window.showPairDetailWithFloatingWindow) {
                    window.showPairDetailWithFloatingWindow(tempItem, group.stock);
                  }
                });
                
                // 创建买入气泡
                const buyBubble = document.createElement('span');
                buyBubble.className = 'price-bubble buy';
                buyBubble.textContent = `${pair.buy.price}`;
                buyBubble.style.cssText = `
                  display: inline-block;
                  padding: 3px 7px;
                  background: #bfdbfe;
                  border: 1px solid #93c5fd;
                  border-radius: 14px;
                  font-size: 11px;
                  font-weight: 900;
                  color: #ef4444;
                  white-space: nowrap;
                  position: relative;
                  box-sizing: border-box;
                  text-shadow: 0.5px 0 0 currentColor;
                  letter-spacing: 0.3px;
                `;
                
                // 如果是最新交易，添加小勾勾
                if (pair.buy.id === latestTradeId) {
                  buyBubble.classList.add('latest-trade');
                }
                
                // 为特殊交易数量的气泡添加淡黄色背景
                try {
                  const stocks = window.STOCKS;
                  if (stocks) {
                    const stockData = stocks.find(function(s) { return s.name === pair.buy.stock; });
                    if (stockData && pair.buy.qty !== stockData.qty) {
                      buyBubble.style.backgroundColor = '#FFF9C4';
                    }
                  }
                } catch(e) {
                  console.error('检查特殊交易数量失败:', e);
                }
                
                // 创建卖出气泡
                const sellBubble = document.createElement('span');
                sellBubble.className = 'price-bubble sell';
                sellBubble.textContent = `-${pair.sell.price}`;
                sellBubble.style.cssText = `
                  display: inline-block;
                  padding: 3px 7px;
                  background: #fecaca;
                  border: 1px solid #fca5a5;
                  border-radius: 14px;
                  font-size: 11px;
                  font-weight: 900;
                  color: #3b82f6;
                  white-space: nowrap;
                  position: relative;
                  box-sizing: border-box;
                  text-shadow: 0.5px 0 0 currentColor;
                  letter-spacing: 0.3px;
                `;
                
                // 如果是最新交易，添加小勾勾
                if (pair.sell.id === latestTradeId) {
                  sellBubble.classList.add('latest-trade');
                }
                
                // 为特殊交易数量的气泡添加淡黄色背景
                try {
                  const stocks = window.STOCKS;
                  if (stocks) {
                    const stockData = stocks.find(function(s) { return s.name === pair.sell.stock; });
                    if (stockData && pair.sell.qty !== stockData.qty) {
                      sellBubble.style.backgroundColor = '#FFF9C4';
                    }
                  }
                } catch(e) {
                  console.error('检查特殊交易数量失败:', e);
                }
                
                pairBubble.appendChild(buyBubble);
                pairBubble.appendChild(sellBubble);
                bubbleCell.appendChild(pairBubble);
              });
              
              // 添加未配对气泡（蓝色=买入，红色=卖出，缩小到70%）
              const unpairedTrades = dateTrades.filter(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id));
              unpairedTrades.forEach(trade => {
                // 如果勾选了屏蔽气泡，不显示被屏蔽的未配对交易
                if (hideHideableBubbles && trade.hideable === 'Y') return;
                
                const unpairedBubble = document.createElement('div');
                const isBuy = trade.side === 'buy';
                unpairedBubble.className = 'price-bubble';
                unpairedBubble.style.cssText = `
                  display: inline-block;
                  padding: 3px 7px;
                  border: 1px solid ${isBuy ? '#93c5fd' : '#fca5a5'};
                  border-radius: 14px;
                  background: ${isBuy ? '#bfdbfe' : '#fecaca'};
                  font-size: 11px;
                  font-weight: 900;
                  color: ${isBuy ? '#ef4444' : '#3b82f6'};
                  cursor: pointer;
                  white-space: nowrap;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                  margin: 0;
                  position: relative;
                  box-sizing: border-box;
                  text-shadow: 0.5px 0 0 currentColor;
                  letter-spacing: 0.3px;
                `;
                
                // 如果未配对气泡被屏蔽，添加加粗的虚线边框
                if (trade.hideable === 'Y') {
                  unpairedBubble.style.border = '3px dashed black';
                  unpairedBubble.style.borderRadius = '12px';
                }
                
                unpairedBubble.textContent = `${isBuy ? '' : '-'}${trade.price}`;
                
                // 如果是最新交易，添加小勾勾
                if (trade.id === latestTradeId) {
                  unpairedBubble.classList.add('latest-trade');
                }
                
                // 为特殊交易数量的气泡添加淡黄色背景
                try {
                  const stocks = window.STOCKS;
                  if (stocks) {
                    const stockData = stocks.find(function(s) { return s.name === trade.stock; });
                    if (stockData && trade.qty !== stockData.qty) {
                      unpairedBubble.style.backgroundColor = '#FFF9C4';
                    }
                  }
                } catch(e) {
                  console.error('检查特殊交易数量失败:', e);
                }
                
                // 添加双击事件显示交易详情
                unpairedBubble.addEventListener('dblclick', (e) => {
                  e.stopPropagation();
                  if (window.showTradeDetail) {
                    window.showTradeDetail(trade, 'main');
                  }
                });
                
                bubbleCell.appendChild(unpairedBubble);
              });
              
              dateContainer.appendChild(dateCell);
              dateContainer.appendChild(bubbleCell);
              scrollContainer.appendChild(dateContainer);
            });
            
            historyGridContainer.appendChild(scrollContainer);
            priceCell.appendChild(historyGridContainer);
          }
        } else {
          // 如果 checkbox 未勾选，隐藏 grid
          if (historyGrid) {
            historyGrid.remove();
          }
        }
      });
      
      historyDataContainer.appendChild(historyDataCheckbox);
      historyDataContainer.appendChild(historyDataLabel);
      
      stockContent.appendChild(historyDataContainer);
    }
    
    // 添加股票内容到股票单元格
    stockCell.appendChild(stockContent);
    
    // 切换展开/收起
    stockToggleBtn.addEventListener('click', () => {
      if (stockToolbar.style.display === 'none') {
        stockToolbar.style.display = 'flex';
        arrow.textContent = ' ▲';
      } else {
        stockToolbar.style.display = 'none';
        arrow.textContent = ' ▼';
      }
    });
    
    const priceCell = document.createElement('td');
    priceCell.style.padding = '10px';
    priceCell.style.border = '1px solid #9ca3af';
    priceCell.style.backgroundColor = bgColor;
    priceCell.appendChild(priceContainer);
    
    const marketCell = document.createElement('td');
    marketCell.style.padding = '10px';
    marketCell.style.border = '1px solid #9ca3af';
    marketCell.style.backgroundColor = bgColor;
    marketCell.textContent = group.market;
    
    const actionCell = document.createElement('td');
    actionCell.style.padding = '10px';
    actionCell.style.border = '1px solid #9ca3af';
    actionCell.style.backgroundColor = bgColor;
    actionCell.style.minWidth = '150px';
    actionCell.style.width = '150px';
    
    // 创建操作按钮容器
    const actionContainer = document.createElement('div');
    actionContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
    `;
    
    // 创建展开/收起按钮
    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'action-toggle-btn';
    toggleBtn.style.cssText = `
      width: 100%;
      padding: 6px 12px;
      border: 2px solid #d1d5db;
      border-radius: 4px;
      background-color: #f3f4f6;
      color: #374151;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
    `;
    toggleBtn.textContent = '展开操作 ▼';
    
    toggleBtn.onmouseover = function() {
      this.style.backgroundColor = '#e5e7eb';
      this.style.borderColor = '#9ca3af';
    };
    toggleBtn.onmouseout = function() {
      this.style.backgroundColor = '#f3f4f6';
      this.style.borderColor = '#d1d5db';
    };
    
    // 创建操作按钮容器（默认隐藏）
    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = `
      display: none;
      flex-direction: row;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 4px;
    `;
    
    // 切换展开/收起
    toggleBtn.addEventListener('click', () => {
      if (buttonsContainer.style.display === 'none') {
        buttonsContainer.style.display = 'flex';
        toggleBtn.textContent = '收起操作 ▲';
      } else {
        buttonsContainer.style.display = 'none';
        toggleBtn.textContent = '展开操作 ▼';
      }
    });
    
    actionContainer.appendChild(toggleBtn);
    
    // 创建交易单价输入栏位和确认新增按钮容器（始终显示，在展开操作按钮下方）
    const quickAddContainer = document.createElement('div');
    quickAddContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-top: 6px;
      padding: 4px 6px;
      background-color: #f0f9ff;
      border-radius: 4px;
      border: 1px solid #bae6fd;
    `;
    
    // 创建输入框和按钮的行容器
    const inputRow = document.createElement('div');
    inputRow.style.cssText = `
      display: flex;
      gap: 4px;
      align-items: center;
    `;
    
    // 创建交易单价输入栏位
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.placeholder = '单价（-号表示卖出）';
    priceInput.style.cssText = `
      flex: 1;
      min-width: 60px;
      padding: 4px 6px;
      border: 1px solid #7dd3fc;
      border-radius: 3px;
      font-size: 11px;
    `;
    
    // 创建键盘图标按钮
    let keypadToggleBtn = null;
    if (window.NumericKeypad) {
      const toggleBtnWrapper = document.createElement('div');
      toggleBtnWrapper.innerHTML = window.NumericKeypad.generateToggleIconHTML();
      keypadToggleBtn = toggleBtnWrapper.firstElementChild;
    }
    
    // 创建确认新增按钮
    const confirmAddBtn = document.createElement('button');
    confirmAddBtn.textContent = '新增';
    confirmAddBtn.style.cssText = `
      padding: 2px 6px;
      border: 2px solid #0ea5e9;
      border-radius: 3px;
      background-color: #0ea5e9;
      color: white;
      font-size: 11px;
      cursor: pointer;
      transition: all 0.2s ease;
      font-weight: bold;
      white-space: nowrap;
      flex-shrink: 0;
      min-width: 40px;
    `;
    
    confirmAddBtn.onmouseover = function() {
      this.style.backgroundColor = '#0284c7';
      this.style.borderColor = '#0284c7';
    };
    confirmAddBtn.onmouseout = function() {
      this.style.backgroundColor = '#0ea5e9';
      this.style.borderColor = '#0ea5e9';
    };
    
    inputRow.appendChild(priceInput);
    
    // 添加Enter键事件：按Enter键自动触发新增按钮
    priceInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        confirmAddBtn.click();
      }
    });
    
    if (keypadToggleBtn) inputRow.appendChild(keypadToggleBtn);
    inputRow.appendChild(confirmAddBtn);
    quickAddContainer.appendChild(inputRow);
    
    // 创建数字键盘容器
    let keypadContainer = null;
    if (window.NumericKeypad) {
      keypadContainer = document.createElement('div');
      keypadContainer.innerHTML = window.NumericKeypad.generateKeypadHTML();
      quickAddContainer.appendChild(keypadContainer);
      
      const onEnter = () => confirmAddBtn.click();
      window.NumericKeypad.bindEvents(priceInput, keypadContainer, keypadToggleBtn, onEnter);
    }
    
    actionContainer.appendChild(quickAddContainer);
    
    // 构建操作按钮
    const stockName = group.stock;
    const buttons = [
      { text: '交易新增', color: '#dbeafe' },
      { text: '手动配对', color: '#fef3c7' },
      { text: '当日配对', color: '#fef3c7' },
      { text: '同日配对', color: '#fef3c7' },
      { text: '自动配对 (最大)', color: '#fef3c7' },
      { text: '自动配对 (最小)', color: '#fef3c7' },
      { text: '解除配对', color: '#fef2f2' },
      { text: '解除当日配对', color: '#fef2f2' }
    ];
    
    buttons.forEach(btnData => {
      const btn = document.createElement('button');
      btn.className = 'stock-action-btn';
      btn.dataset.stock = stockName;
      btn.textContent = btnData.text;
      btn.style.padding = '6px 12px';
      btn.style.border = '2px solid #d1d5db';
      btn.style.borderRadius = '4px';
      btn.style.backgroundColor = btnData.color;
      btn.style.color = '#374151';
      btn.style.fontSize = '12px';
      btn.style.cursor = 'pointer';
      btn.style.transition = 'all 0.2s ease';
      btn.style.flex = '1 0 30%';
      btn.style.minWidth = '0';
      
      // 添加悬停效果
      btn.onmouseover = function() {
        if (this.textContent === '解除配对' || this.textContent === '解除当日配对') {
          this.style.backgroundColor = '#fecaca';
        } else if (this.textContent === '交易新增') {
          this.style.backgroundColor = '#bfdbfe';
        } else {
          this.style.backgroundColor = '#fde68a';
        }
        this.style.borderColor = '#9ca3af';
      };
      btn.onmouseout = function() {
        if (this.textContent === '解除配对' || this.textContent === '解除当日配对') {
          this.style.backgroundColor = '#fef2f2';
        } else if (this.textContent === '交易新增') {
          this.style.backgroundColor = '#dbeafe';
        } else {
          this.style.backgroundColor = '#fef3c7';
        }
        this.style.borderColor = '#d1d5db';
      };
      
      // 添加点击事件监听器
        if (btn.textContent === '交易新增') {
        btn.addEventListener('click', () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;
          
          // 打开新增交易窗口，并传递回调函数以跳转到股票位置
          openAddTradeModal(stockName, async (newTrade) => {
            console.log('交易保存成功，准备跳转到股票:', stockName);
            
            // 延迟执行滚动，确保表格已渲染完成
            setTimeout(() => {
              if (window.jumpToStock) {
                window.jumpToStock(stockName);
              }
            }, 200);
          });
        });
      } else if (btn.textContent === '手动配对') {
        btn.addEventListener('click', () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;
          
          // 打开手动配对窗口，并指定股票
          openManualPairWindowForStock(stockName);
        });
      } else if (btn.textContent === '当日配对') {
        btn.addEventListener('click', async () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;

          // 保存滚动位置
          const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
          const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
          const savedPageY = window.scrollY || window.pageYOffset || 0;

          // 获取该股票的今日交易
          const today = getTodayDate();
          const stockTodayTrades = trades.filter(t => t.stock === stockName && t.date === today).map(t => ({...t, price: Number(t.price)}));
          if (stockTodayTrades.length === 0) {
            alert('该股票今天没有交易记录');
            return;
          }

          // 读取已有配对，排除已配对交易
          const existing = pairingCache[stockName] || {};
          const existingBuyIds = new Set(existing.pairedBuyIds || []);
          const existingSellIds = new Set(existing.pairedSellIds || []);

          const todayBuys = stockTodayTrades.filter(t => t.side === 'buy' && !existingBuyIds.has(t.id));
          const todaySells = stockTodayTrades.filter(t => t.side === 'sell' && !existingSellIds.has(t.id));

          if (todayBuys.length === 0 || todaySells.length === 0) {
            alert('今天没有足够的未配对买/卖记录可用于配对');
            return;
          }

          // 使用配对算法进行配对（利润最小化，尽可能配对更多数据）
          const pairingResult = findBestPairsMinimized(todayBuys, todaySells, stockName);
          if (!pairingResult || !pairingResult.pairedTrades || pairingResult.pairedTrades.length === 0) {
            alert('未找到有利可图的当日配对');
            return;
          }

          // 保留原有配对，只追加新配对
          pairingCache[stockName] = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
          const existingPairedTrades = pairingCache[stockName].pairedTrades || [];
          const existingPairedBuyIds = pairingCache[stockName].pairedBuyIds || [];
          const existingPairedSellIds = pairingCache[stockName].pairedSellIds || [];

          // 追加新配对到原有配对中
          pairingCache[stockName] = {
            pairedTrades: [...existingPairedTrades, ...pairingResult.pairedTrades],
            pairedBuyIds: [...existingPairedBuyIds, ...pairingResult.pairedTrades.map(p => p.buy.id)],
            pairedSellIds: [...existingPairedSellIds, ...pairingResult.pairedTrades.map(p => p.sell.id)]
          };

          try {
            await tradesDB.savePairing({
              stockName: stockName,
              pairedTrades: pairingCache[stockName].pairedTrades,
              pairedBuyIds: pairingCache[stockName].pairedBuyIds,
              pairedSellIds: pairingCache[stockName].pairedSellIds
            });

            // 显示配对结果表格
            showPairingResultsTable(stockName, pairingResult.pairedTrades);
            // 重新渲染并恢复滚动位置
            await renderStockModeTable();
            setTimeout(() => {
              try {
                if (tableContainer) tableContainer.scrollTop = savedTableScroll;
                window.scrollTo(0, savedPageY);
              } catch (e) {
                console.error('恢复滚动位置失败:', e);
              }
            }, 50);
          } catch (err) {
          console.error('保存当日配对失败:', err);
          alert('保存配对失败: ' + err.message);
        }
        });
      } else if (btn.textContent === '同日配对') {
        btn.addEventListener('click', async () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;

          // 保存滚动位置
          const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
          const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
          const savedPageY = window.scrollY || window.pageYOffset || 0;

          // 获取该股票的所有交易
          const stockAllTrades = trades.filter(t => t.stock === stockName).map(t => ({...t, price: Number(t.price)}));
          if (stockAllTrades.length === 0) {
            alert('该股票没有交易记录');
            return;
          }

          // 读取已有配对，排除已配对交易
          const existing = pairingCache[stockName] || {};
          const existingBuyIds = new Set(existing.pairedBuyIds || []);
          const existingSellIds = new Set(existing.pairedSellIds || []);

          // 按日期分组交易
          const tradesByDate = {};
          stockAllTrades.forEach(trade => {
            if (!tradesByDate[trade.date]) {
              tradesByDate[trade.date] = { buys: [], sells: [] };
            }
            if (trade.side === 'buy' && !existingBuyIds.has(trade.id)) {
              tradesByDate[trade.date].buys.push(trade);
            } else if (trade.side === 'sell' && !existingSellIds.has(trade.id)) {
              tradesByDate[trade.date].sells.push(trade);
            }
          });

          // 对每个日期的买卖交易进行配对
          let allPairedTrades = [];
          for (const date in tradesByDate) {
            const dateTrades = tradesByDate[date];
            if (dateTrades.buys.length === 0 || dateTrades.sells.length === 0) continue;

            // 使用配对算法进行配对（只会返回有利润的配对）
            const pairingResult = findBestPairs(dateTrades.buys, dateTrades.sells, stockName);
            if (pairingResult && pairingResult.pairedTrades && pairingResult.pairedTrades.length > 0) {
              allPairedTrades = allPairedTrades.concat(pairingResult.pairedTrades);
            }
          }

          if (allPairedTrades.length === 0) {
            alert('未找到有利可图的同日配对');
            return;
          }

          // 保留原有配对，只追加新配对
          pairingCache[stockName] = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
          const existingPairedTrades = pairingCache[stockName].pairedTrades || [];
          const existingPairedBuyIds = pairingCache[stockName].pairedBuyIds || [];
          const existingPairedSellIds = pairingCache[stockName].pairedSellIds || [];

          // 追加新配对到原有配对中
          pairingCache[stockName] = {
            pairedTrades: [...existingPairedTrades, ...allPairedTrades],
            pairedBuyIds: [...existingPairedBuyIds, ...allPairedTrades.map(p => p.buy.id)],
            pairedSellIds: [...existingPairedSellIds, ...allPairedTrades.map(p => p.sell.id)]
          };

          try {
            await tradesDB.savePairing({
              stockName: stockName,
              pairedTrades: pairingCache[stockName].pairedTrades,
              pairedBuyIds: pairingCache[stockName].pairedBuyIds,
              pairedSellIds: pairingCache[stockName].pairedSellIds
            });

            // 显示配对结果表格
            showPairingResultsTable(stockName, allPairedTrades);
            // 重新渲染并恢复滚动位置
            await renderStockModeTable();
            setTimeout(() => {
              try {
                if (tableContainer) tableContainer.scrollTop = savedTableScroll;
                window.scrollTo(0, savedPageY);
              } catch (e) {
                console.error('恢复滚动位置失败:', e);
              }
            }, 50);
          } catch (err) {
            console.error('保存同日配对失败:', err);
            alert('保存配对失败: ' + err.message);
          }
        });
      } else if (btn.textContent === '自动配对 (最大)') {
        btn.addEventListener('click', async () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;

          // 保存滚动位置
          const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
          const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
          const savedPageY = window.scrollY || window.pageYOffset || 0;

          // 获取该股票的所有交易（所有日期），并转为数字价格
          const stockAllTrades = trades.filter(t => t.stock === stockName).map(t => ({...t, price: Number(t.price)}));
          if (stockAllTrades.length === 0) {
            alert('该股票没有交易记录');
            return;
          }

          // 读取已有配对，排除已配对交易
          const existing = pairingCache[stockName] || {};
          const existingBuyIds = new Set(existing.pairedBuyIds || []);
          const existingSellIds = new Set(existing.pairedSellIds || []);

          const unpairedBuys = stockAllTrades.filter(t => t.side === 'buy' && !existingBuyIds.has(t.id));
          const unpairedSells = stockAllTrades.filter(t => t.side === 'sell' && !existingSellIds.has(t.id));

          if (unpairedBuys.length === 0 || unpairedSells.length === 0) {
            alert('没有足够的未配对买/卖记录可用于配对');
            return;
          }

          // 使用配对算法进行配对（只会返回有利润的配对）
          const pairingResult = findBestPairs(unpairedBuys, unpairedSells, stockName);
          if (!pairingResult || !pairingResult.pairedTrades || pairingResult.pairedTrades.length === 0) {
            alert('未找到有利可图的自动配对');
            return;
          }

          // 保留原有配对，只追加新配对
          pairingCache[stockName] = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
          const existingPairedTrades = pairingCache[stockName].pairedTrades || [];
          const existingPairedBuyIds = pairingCache[stockName].pairedBuyIds || [];
          const existingPairedSellIds = pairingCache[stockName].pairedSellIds || [];

          // 追加新配对到原有配对中
          pairingCache[stockName] = {
            pairedTrades: [...existingPairedTrades, ...pairingResult.pairedTrades],
            pairedBuyIds: [...existingPairedBuyIds, ...pairingResult.pairedTrades.map(p => p.buy.id)],
            pairedSellIds: [...existingPairedSellIds, ...pairingResult.pairedTrades.map(p => p.sell.id)]
          };

          try {
            await tradesDB.savePairing({
              stockName: stockName,
              pairedTrades: pairingCache[stockName].pairedTrades,
              pairedBuyIds: pairingCache[stockName].pairedBuyIds,
              pairedSellIds: pairingCache[stockName].pairedSellIds
            });

            // 显示配对结果表格
            showPairingResultsTable(stockName, pairingResult.pairedTrades);
            // 重新渲染并恢复滚动位置
            await renderStockModeTable();
            setTimeout(() => {
              try {
                if (tableContainer) tableContainer.scrollTop = savedTableScroll;
                window.scrollTo(0, savedPageY);
              } catch (e) {
                console.error('恢复滚动位置失败:', e);
              }
            }, 50);
          } catch (err) {
          console.error('保存自动配对失败:', err);
          alert('保存配对失败: ' + err.message);
        }
        });
      } else if (btn.textContent === '自动配对 (最小)') {
        btn.addEventListener('click', async () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;

          // 保存滚动位置
          const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
          const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
          const savedPageY = window.scrollY || window.pageYOffset || 0;

          // 获取该股票的所有交易（所有日期），并转为数字价格
          const stockAllTrades = trades.filter(t => t.stock === stockName).map(t => ({...t, price: Number(t.price)}));
          if (stockAllTrades.length === 0) {
            alert('该股票没有交易记录');
            return;
          }

          // 读取已有配对，排除已配对交易
          const existing = pairingCache[stockName] || {};
          const existingBuyIds = new Set(existing.pairedBuyIds || []);
          const existingSellIds = new Set(existing.pairedSellIds || []);

          const unpairedBuys = stockAllTrades.filter(t => t.side === 'buy' && !existingBuyIds.has(t.id));
          const unpairedSells = stockAllTrades.filter(t => t.side === 'sell' && !existingSellIds.has(t.id));

          if (unpairedBuys.length === 0 || unpairedSells.length === 0) {
            alert('没有足够的未配对买/卖记录可用于配对');
            return;
          }

          // 使用利润最小化配对算法进行配对（只会返回有利润的配对）
          const pairingResult = findBestPairsMinimized(unpairedBuys, unpairedSells, stockName);
          if (!pairingResult || !pairingResult.pairedTrades || pairingResult.pairedTrades.length === 0) {
            alert('未找到有利可图的自动配对(最小)');
            return;
          }

          // 保留原有配对，只追加新配对
          pairingCache[stockName] = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
          const existingPairedTrades = pairingCache[stockName].pairedTrades || [];
          const existingPairedBuyIds = pairingCache[stockName].pairedBuyIds || [];
          const existingPairedSellIds = pairingCache[stockName].pairedSellIds || [];

          // 追加新配对到原有配对中
          pairingCache[stockName] = {
            pairedTrades: [...existingPairedTrades, ...pairingResult.pairedTrades],
            pairedBuyIds: [...existingPairedBuyIds, ...pairingResult.pairedTrades.map(p => p.buy.id)],
            pairedSellIds: [...existingPairedSellIds, ...pairingResult.pairedTrades.map(p => p.sell.id)]
          };

          try {
            await tradesDB.savePairing({
              stockName: stockName,
              pairedTrades: pairingCache[stockName].pairedTrades,
              pairedBuyIds: pairingCache[stockName].pairedBuyIds,
              pairedSellIds: pairingCache[stockName].pairedSellIds
            });

            // 显示配对结果表格
            showPairingResultsTable(stockName, pairingResult.pairedTrades);
            // 重新渲染并恢复滚动位置
            await renderStockModeTable();
            setTimeout(() => {
              try {
                if (tableContainer) tableContainer.scrollTop = savedTableScroll;
                window.scrollTo(0, savedPageY);
              } catch (e) {
                console.error('恢复滚动位置失败:', e);
              }
            }, 50);
          } catch (err) {
          console.error('保存自动配对(最小)失败:', err);
          alert('保存配对失败: ' + err.message);
        }
        });
      } else if (btn.textContent === '解除配对') {
        btn.addEventListener('click', async () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;

          // 从数据库加载该股票的配对结果
          const dbPairing = await tradesDB.getPairing(stockName);
          if (!dbPairing || !dbPairing.pairedTrades || dbPairing.pairedTrades.length === 0) {
            alert('该股票没有配对记录');
            return;
          }

          if (confirm(`确定要解除 ${stockName} 的所有配对吗？`)) {
            try {
              // 保存要解除的配对记录（用于显示）
              const unpairedTrades = dbPairing.pairedTrades;
              
              // 删除该股票的配对结果
              await tradesDB.deletePairing(stockName);
              // 从内存缓存中删除
              delete pairingCache[stockName];
              
              // 保存当前滚动位置，重新渲染表格后恢复，避免跳到页面顶端
              const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
              const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
              const savedPageY = window.scrollY || window.pageYOffset || 0;

              // 重新渲染表格以显示配对标识
              await renderStockModeTable();

              // 恢复滚动位置（用 setTimeout 确保 DOM 已稳定）
              setTimeout(() => {
                try {
                  if (tableContainer) tableContainer.scrollTop = savedTableScroll;
                  window.scrollTo(0, savedPageY);
                } catch (e) {
                  console.error('恢复滚动位置失败:', e);
                }
              }, 50);
              
              // 显示被解除的配对表格
              showUnpairedResultsTable(stockName, unpairedTrades);
            } catch (error) {
              console.error('解除配对失败:', error);
              alert('解除配对失败: ' + error.message);
            }
          }
        });
      } else if (btn.textContent === '解除当日配对') {
        btn.addEventListener('click', async () => {
          const stockName = btn.getAttribute('data-stock');
          if (!stockName) return;

          try {
            // 获取今天日期
            const today = getTodayDate();
            
            // 从数据库加载该股票的配对结果
            const dbPairing = await tradesDB.getPairing(stockName);
            if (!dbPairing || !dbPairing.pairedTrades || dbPairing.pairedTrades.length === 0) {
            alert('该股票没有配对记录');
            return;
          }
            
            // 找出今天的配对（需要解除的配对）
            const todayPairings = dbPairing.pairedTrades.filter(pair => {
              return pair.buy.date === today && pair.sell.date === today;
            });
            
            // 如果没有今天的配对，显示提示信息
            if (todayPairings.length === 0) {
              alert('该股票今天没有配对记录');
              return;
            }
            
            if (confirm(`确定要解除 ${stockName} 的当日配对吗？`)) {
              // 过滤出不包含今天交易的配对（保留非当日配对，移除当日配对）
              const filterNonTodayPairings = (pairings) => {
                if (!pairings || !pairings.pairedTrades) return { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
                
                const filteredTrades = pairings.pairedTrades.filter(pair => {
                  // 检查买入和卖出交易是否都不在今天
                  return !(pair.buy.date === today && pair.sell.date === today);
                });
                
                return {
                  pairedTrades: filteredTrades,
                  pairedBuyIds: filteredTrades.map(p => p.buy.id),
                  pairedSellIds: filteredTrades.map(p => p.sell.id)
                };
              };
              
              // 更新配对结果，移除今天的配对
              const filteredResult = filterNonTodayPairings(dbPairing);
              const updatedPairing = {
                stockName: stockName,
                pairedTrades: filteredResult.pairedTrades,
                pairedBuyIds: filteredResult.pairedBuyIds,
                pairedSellIds: filteredResult.pairedSellIds
              };
              
              // 保存更新后的配对结果
              await tradesDB.savePairing(updatedPairing);
              
              // 更新内存缓存
              pairingCache[stockName] = updatedPairing;
              
              // 保存当前滚动位置，重新渲染表格后恢复，避免跳到页面顶端
              const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
              const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
              const savedPageY = window.scrollY || window.pageYOffset || 0;

              // 重新渲染表格以显示配对标识
              await renderStockModeTable();

              // 恢复滚动位置（用 setTimeout 确保 DOM 已稳定）
              setTimeout(() => {
                try {
                  if (tableContainer) tableContainer.scrollTop = savedTableScroll;
                  window.scrollTo(0, savedPageY);
                } catch (e) {
                  console.error('恢复滚动位置失败:', e);
                }
              }, 50);
              
              // 显示被解除的配对表格
              showUnpairedResultsTable(stockName, todayPairings);
            }
          } catch (error) {
            console.error('解除当日配对失败:', error);
            alert('解除当日配对失败: ' + error.message);
          }
        });
      }
      
      buttonsContainer.appendChild(btn);
    });
    
    // 为确认新增按钮添加点击事件处理
    confirmAddBtn.addEventListener('click', async () => {
      const priceValue = priceInput.value.trim();
      if (!priceValue) {
        alert('请输入交易单价');
        return;
      }
      
      // 判断买卖方向：输入 - 号表示卖出，否则为买入
      const isSell = priceValue.startsWith('-');
      const price = Math.abs(Number(priceValue));
      
      if (price <= 0) {
        alert('请输入有效的单价');
        return;
      }
      
      const side = isSell ? 'sell' : 'buy';
      
      // 获取股票信息
      const stockInfo = findStockByName(stockName);
      if (!stockInfo) {
        alert('未在清单找到该股票，请从下拉选择可用股票。');
        return;
      }
      
      const qty = stockInfo.qty;
      const amount = qty * price;
      const now = new Date();
      const newTrade = {
        id: generateId ? generateId() : Date.now().toString(),
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
      
      // 保存当前滚动位置
      const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
      const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
      const savedPageY = window.scrollY || window.pageYOffset || 0;
      
      try {
        // 检查可买入数量
        if (side === 'buy' && window.calculateMaxBuyQty) {
          const canBuyQty = window.calculateMaxBuyQty(stockName, newTrade.date);
          if (canBuyQty !== null && qty > canBuyQty) {
            alert(`该股票在${newTrade.date}最多只能再买入${canBuyQty}股`);
            return;
          }
        }
        
        // 保存交易
        if (tradesDB && tradesDB.save) {
          await tradesDB.save(newTrade);
          
          // 更新全局交易数据
          if (window.trades) {
            const existingIndex = window.trades.findIndex(t => t.id === newTrade.id);
            if (existingIndex >= 0) {
              window.trades[existingIndex] = newTrade;
            } else {
              window.trades.push(newTrade);
            }
          }
          
          // 刷新主程序数据
          if (window.loadTrades && typeof window.loadTrades === 'function') {
            await window.loadTrades();
          }
          
          if (window.applyFilters && typeof window.applyFilters === 'function') {
            await window.applyFilters();
          }
          
          // 显示成功消息（包含交易内容）
          const sideText = side === 'buy' ? '买入' : '卖出';
          alert(`交易保存成功\n股票：${stockInfo.name}\n${sideText}价格：${price}\n数量：${qty}\n金额：${amount.toFixed(2)}`);
          
          // 清空输入框
          priceInput.value = '';
          
          // 重新渲染表格
          await renderStockModeTable();
          
          // 恢复滚动位置（延迟执行，确保 DOM 已渲染完成）
          setTimeout(() => {
            try {
              if (tableContainer) tableContainer.scrollTop = savedTableScroll;
              window.scrollTo(0, savedPageY);
            } catch (e) {
              console.error('恢复滚动位置失败:', e);
            }
          }, 50);
        } else {
          alert('保存功能不可用，请检查数据库连接');
        }
      } catch (err) {
        console.error('保存交易时出错', err);
        alert('保存交易时出错，请重试');
      }
    });
    
    actionContainer.appendChild(buttonsContainer);
    actionCell.appendChild(actionContainer);
    
    // 组装行
    tr.appendChild(stockCell);
    tr.appendChild(priceCell);
    tr.appendChild(marketCell);
    tr.appendChild(actionCell);
    tableBody.appendChild(tr);
  });
  
  // 为股票模式表格中的气泡添加拖拽功能
  setTimeout(() => {
    document.querySelectorAll('.price-bubble').forEach(bubble => addDraggableToBubble(bubble));
    document.querySelectorAll('.trade-pair').forEach(pair => addDraggableToPair(pair));
  }, 100);
  
  // 填充股票下拉选单（显示完整股票清单，包含无交易的股票）
  if (stockJumpSelect) {
    stockJumpSelect.innerHTML = '<option value="">跳转到股票</option>';

    if (stockOrderSource && stockOrderSource.length > 0) {
      stockOrderSource.forEach(stockInfo => {
        const option = document.createElement('option');
        option.value = stockInfo.name;
        option.textContent = `${stockInfo.name} (${stockInfo.market})`;
        stockJumpSelect.appendChild(option);
      });
    } else {
      sortedGroups.forEach(group => {
        const option = document.createElement('option');
        option.value = group.stock;
        option.textContent = `${group.stock} (${group.market})`;
        stockJumpSelect.appendChild(option);
      });
    }
  }
  
  renderSummary();
}

function renderSummary() {
  // 重新获取统计相关元素，确保元素已存在
  const statsContainer = summaryEl.querySelector('.stats-container');
  const toggleStatsBtn = summaryEl.querySelector('#toggleStatsBtn');
  const statsContent = summaryEl.querySelector('.stats-content');
  const statsTitle = summaryEl.querySelector('.stats-header .stats-title');
  
  // 计算总统计
  const totalCount = filteredTrades.length;
  const totalAmount = filteredTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  // 计算买入卖出统计
  const buyTrades = filteredTrades.filter(t => t.side === 'buy');
  const buyCount = buyTrades.length;
  const buyAmount = buyTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  const sellTrades = filteredTrades.filter(t => t.side === 'sell');
  const sellCount = sellTrades.length;
  const sellAmount = sellTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  // 计算台股统计
  const taiwanTrades = filteredTrades.filter(t => t.market === '台股');
  const taiwanCount = taiwanTrades.length;
  
  const taiwanBuyTrades = taiwanTrades.filter(t => t.side === 'buy');
  const taiwanBuyCount = taiwanBuyTrades.length;
  const taiwanBuyAmount = taiwanBuyTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  const taiwanSellTrades = taiwanTrades.filter(t => t.side === 'sell');
  const taiwanSellCount = taiwanSellTrades.length;
  const taiwanSellAmount = taiwanSellTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  const taiwanNetAmount = taiwanBuyAmount - taiwanSellAmount;
  
  // 计算陆股统计
  const chinaTrades = filteredTrades.filter(t => t.market === '陆股');
  const chinaCount = chinaTrades.length;
  
  const chinaBuyTrades = chinaTrades.filter(t => t.side === 'buy');
  const chinaBuyCount = chinaBuyTrades.length;
  const chinaBuyAmount = chinaBuyTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  const chinaSellTrades = chinaTrades.filter(t => t.side === 'sell');
  const chinaSellCount = chinaSellTrades.length;
  const chinaSellAmount = chinaSellTrades.reduce((acc,t) => acc + Number(t.amount || 0), 0);
  
  const chinaNetAmount = chinaBuyAmount - chinaSellAmount;
  
  // 获取筛选日期
  const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
  
  // 计算台股配对气泡净利润（根据筛选日期过滤）
  let taiwanPairedProfit = 0;
  let taiwanDailyPairedProfit = 0;
  const taiwanStocks = [...new Set(taiwanTrades.map(t => t.stock))];
  taiwanStocks.forEach(stockName => {
    const cachedPairing = pairingCache[stockName];
    if (cachedPairing && cachedPairing.pairedTrades) {
      cachedPairing.pairedTrades.forEach(pair => {
        if (pair.buy && pair.sell) {
          const buyAmount = pair.buy.price * pair.buy.qty;
          const sellAmount = pair.sell.price * pair.sell.qty;
          const buyTax = calculateTax(stockName, 'buy', buyAmount);
          const sellTax = calculateTax(stockName, 'sell', sellAmount);
          const profit = sellAmount - buyAmount - buyTax - sellTax;
          
          if (filterDate && (pair.buy.date !== filterDate || pair.sell.date !== filterDate)) {
          } else {
            taiwanPairedProfit += profit;
          }
          
          if (filterDate && (pair.buy.date !== filterDate && pair.sell.date !== filterDate)) {
          } else {
            taiwanDailyPairedProfit += profit;
          }
        }
      });
    }
  });
  
  // 计算陆股配对气泡净利润（根据筛选日期过滤）
  let chinaPairedProfit = 0;
  let chinaDailyPairedProfit = 0;
  const chinaStocks = [...new Set(chinaTrades.map(t => t.stock))];
  chinaStocks.forEach(stockName => {
    const cachedPairing = pairingCache[stockName];
    if (cachedPairing && cachedPairing.pairedTrades) {
      cachedPairing.pairedTrades.forEach(pair => {
        if (pair.buy && pair.sell) {
          const buyAmount = pair.buy.price * pair.buy.qty;
          const sellAmount = pair.sell.price * pair.sell.qty;
          const buyTax = calculateTax(stockName, 'buy', buyAmount);
          const sellTax = calculateTax(stockName, 'sell', sellAmount);
          const profit = sellAmount - buyAmount - buyTax - sellTax;
          
          if (filterDate && (pair.buy.date !== filterDate || pair.sell.date !== filterDate)) {
          } else {
            chinaPairedProfit += profit;
          }
          
          if (filterDate && (pair.buy.date !== filterDate && pair.sell.date !== filterDate)) {
          } else {
            chinaDailyPairedProfit += profit;
          }
        }
      });
    }
  });
  
  // 计算净买入金额
  const totalNetAmount = buyAmount - sellAmount;
  
  // 生成个股统计（按市场分组）
  function generateStockStats(trades, marketName, pairedProfit, dailyPairedProfit) {
    // 按股票名称分组
    const stockStats = {};
    
    // 初始化合计统计
    let totalBuyCount = 0;
    let totalBuyAmount = 0;
    let totalSellCount = 0;
    let totalSellAmount = 0;
    
    trades.forEach(trade => {
      const stockName = trade.stock;
      if (!stockStats[stockName]) {
        stockStats[stockName] = {
          name: stockName,
          buyCount: 0,
          buyAmount: 0,
          sellCount: 0,
          sellAmount: 0
        };
      }
      
      if (trade.side === 'buy') {
        stockStats[stockName].buyCount++;
        stockStats[stockName].buyAmount += Number(trade.amount || 0);
        totalBuyCount++;
        totalBuyAmount += Number(trade.amount || 0);
      } else {
        stockStats[stockName].sellCount++;
        stockStats[stockName].sellAmount += Number(trade.amount || 0);
        totalSellCount++;
        totalSellAmount += Number(trade.amount || 0);
      }
    });
    
    // 转换为数组并排序
    const sortedStats = Object.values(stockStats).sort((a, b) => a.name.localeCompare(b.name));
    
    // 计算总净买入金额
    const totalNetAmount = totalBuyAmount - totalSellAmount;
    const totalNetClass = totalNetAmount >= 0 ? 'net-positive' : 'net-negative';
    
    // 配对气泡净利润样式
    const pairedProfitClass = pairedProfit >= 0 ? 'net-positive' : 'net-negative';
    const dailyPairedProfitClass = dailyPairedProfit >= 0 ? 'net-positive' : 'net-negative';
    
    // 生成HTML表格
    let html = `<div style="display: flex; justify-content: space-between; align-items: center; margin: 16px 0 8px 0;">
      <h4 style="margin: 0; color: #374151; font-size: 14px;">${marketName}个股统计</h4>
      <button class="btn-screenshot-verify" data-market="${marketName}" onclick="
        try {
          if(typeof window._svPlugin !== 'undefined' && window._svPlugin.openVerifyWindow){
            window._svPlugin.openVerifyWindow('${marketName}');
          } else {
            alert('截图对账插件未初始化');
          }
        } catch(e) {
          alert('截图对账出错: ' + e.message);
        }
      " style="padding: 6px 14px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">📸 截图对账</button>
      <button class="btn-screenshot-verify-react" data-market="${marketName}" onclick="
        try {
          if(typeof window._svPluginReact !== 'undefined' && window._svPluginReact && window._svPluginReact.openVerifyWindow){
            window._svPluginReact.openVerifyWindow('${marketName}');
          } else if (typeof window.ScreenshotVerifyPluginReact !== 'undefined') {
            window._svPluginReact = new window.ScreenshotVerifyPluginReact();
            window._svPluginReact.openVerifyWindow('${marketName}');
          } else {
            alert('截图对账插件(React版)未加载，请刷新页面重试');
          }
        } catch(e) {
          console.error('[Button] 错误:', e);
          alert('截图对账(React版)出错: ' + e.message);
        }
      " style="padding: 6px 14px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3); transition: all 0.3s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">⚛ 截图对账(R)</button>
    </div>`;
    html += `<div class="stock-stats-table-container" style="margin-bottom: 16px; overflow-x: auto;">`;
    html += `<table class="stock-stats-table" style="width: 100%; border-collapse: collapse; font-size: 13px;">`;
    html += `<thead><tr style="background-color: #f3f4f6;"><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: left;">股票名称</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">买入笔数</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">买入金额</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">卖出笔数</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">卖出金额</th><th style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">净买入金额</th></tr></thead>`;
    html += `<tbody>`;
    
    sortedStats.forEach(stock => {
      const netAmount = stock.buyAmount - stock.sellAmount;
      const netClass = netAmount >= 0 ? 'net-positive' : 'net-negative';
      html += `<tr>`;
      html += `<td style="padding: 8px; border: 1px solid #e5e7eb;">${escapeHtml(stock.name)}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${stock.buyCount}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${formatNumber(stock.buyAmount.toFixed(2))}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${stock.sellCount}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${formatNumber(stock.sellAmount.toFixed(2))}</td>`;
      html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><span class="${netClass}">${formatNumber(netAmount.toFixed(2))}</span></td>`;
      html += `</tr>`;
    });
    
    // 添加合计行
    html += `<tr style="background-color: #e5e7eb; font-weight: bold;">`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb;">合计</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${totalBuyCount}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${formatNumber(totalBuyAmount.toFixed(2))}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${totalSellCount}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;">${formatNumber(totalSellAmount.toFixed(2))}</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><span class="${totalNetClass}">${formatNumber(totalNetAmount.toFixed(2))}</span></td>`;
    html += `</tr>`;
    
    // 添加配对气泡净利润行
    html += `<tr style="background-color: #fef3c7; font-weight: bold;">`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb;" colspan="5">绝对当日配对气泡净利润</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><span class="${pairedProfitClass}">${formatNumber(pairedProfit.toFixed(2))}</span></td>`;
    html += `</tr>`;
    
    html += `<tr style="background-color: #dbeafe; font-weight: bold;">`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb;" colspan="5">当日配对气泡净利润</td>`;
    html += `<td style="padding: 8px; border: 1px solid #e5e7eb; text-align: right;"><span class="${dailyPairedProfitClass}">${formatNumber(dailyPairedProfit.toFixed(2))}</span></td>`;
    html += `</tr>`;
    
    html += `</tbody></table></div>`;
    return html;
  }
  
  // 生成台股和陆股的个股统计HTML
  const taiwanStockStatsHtml = generateStockStats(taiwanTrades, '台股', taiwanPairedProfit, taiwanDailyPairedProfit);
  const chinaStockStatsHtml = generateStockStats(chinaTrades, '陆股', chinaPairedProfit, chinaDailyPairedProfit);
  
  // 生成统计HTML
  const statsHtml = `
    <div class="stats-grid">
      <!-- 台股统计 -->
      <div class="stats-item">
        <div class="stats-item-title">台股总笔数</div>
        <div class="stats-item-value">${taiwanCount} 笔</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">台股买入笔数</div>
        <div class="stats-item-value">${taiwanBuyCount} 笔</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">台股买入金额</div>
        <div class="stats-item-value">${formatNumber(Math.round(taiwanBuyAmount))} 元</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">台股卖出笔数</div>
        <div class="stats-item-value">${taiwanSellCount} 笔</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">台股卖出金额</div>
        <div class="stats-item-value">${formatNumber(Math.round(taiwanSellAmount))} 元</div>
      </div>
      <div class="stats-item ${taiwanNetAmount >= 0 ? 'net-positive' : 'net-negative'}">
        <div class="stats-item-title">台股净买入金额</div>
        <div class="stats-item-value">${formatNumber(Math.round(taiwanNetAmount))} 元</div>
      </div>
      
      <!-- 陆股统计 -->
      <div class="stats-item">
        <div class="stats-item-title">陆股总笔数</div>
        <div class="stats-item-value">${chinaCount} 笔</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">陆股买入笔数</div>
        <div class="stats-item-value">${chinaBuyCount} 笔</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">陆股买入金额</div>
        <div class="stats-item-value">${formatNumber(Math.round(chinaBuyAmount))} 元</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">陆股卖出笔数</div>
        <div class="stats-item-value">${chinaSellCount} 笔</div>
      </div>
      <div class="stats-item">
        <div class="stats-item-title">陆股卖出金额</div>
        <div class="stats-item-value">${formatNumber(Math.round(chinaSellAmount))} 元</div>
      </div>
      <div class="stats-item ${chinaNetAmount >= 0 ? 'net-positive' : 'net-negative'}">
        <div class="stats-item-title">陆股净买入金额</div>
        <div class="stats-item-value">${formatNumber(Math.round(chinaNetAmount))} 元</div>
      </div>
    </div>
    
    <!-- 个股统计 -->
    <div class="stock-stats-section">
      ${taiwanStockStatsHtml}
      ${chinaStockStatsHtml}
    </div>
  `;
  
  // 更新统计内容
  if (statsContent) {
    statsContent.innerHTML = statsHtml;
  }
  
  // 更新顶部统计摘要
  if (statsTitle) {
    statsTitle.innerHTML = `
      <strong>总笔数：</strong>${totalCount} 笔 &nbsp; | &nbsp; 
      <strong>总金额：</strong>${formatNumber(Math.round(totalAmount))} 元 &nbsp; | &nbsp; 
      <strong>净买入：</strong><span class="${totalNetAmount >= 0 ? 'net-positive' : 'net-negative'}">${formatNumber(Math.round(totalNetAmount))} 元</span>
    `;
  }
  
  // 移除renderSummary中的事件监听器，避免与initFilters中的冲突
  // 事件监听器已在initFilters函数中绑定
}

function escapeHtml(s) { if (!s) return ''; return String(s).replace(/[&<>'"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'})[m]); }

function attachRowHandlers() {
  document.querySelectorAll('button.del').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.getAttribute('data-id');
      if (!id) return;
      if (confirm('确定删除？')) {
        // 获取要删除的交易信息
        const tradeToDelete = trades.find(t => t.id === id);
        
        // 删除交易
        await tradesDB.delete(id);
        
        // 如果删除了交易，保留已有的配对结果（配对仅在用户点击“全部取消配对”时清除）
        // 以前这里会删除该股票的配对数据；现保留 pairing 数据以满足不自动删除的规则。
        
        await loadTrades();
        await applyFilters();
      }
    };
  });
}

// 应用筛选
async function applyFilters() {
  filteredTrades = [...trades];
  
  // 按日期筛选
  const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
  if (filterDate) {
    filteredTrades = filteredTrades.filter(t => t.date === filterDate);
  }
  
  // 按股票筛选
  const filterStock = filterStockInput ? filterStockInput.value.trim() : '';
  if (filterStock) {
    filteredTrades = filteredTrades.filter(t => t.stock === filterStock);
  }
  
  // 更新跳转到股票下拉选单（如果勾选了只显示当天股票）
  if (showOnlyFilterDateStocks) {
    await updateStockJumpSelect();
  }

  // 根据当前视图模式渲染
  if (currentView === 'table') {
    if (currentTableMode === 'stock') {
      await renderStockModeTable();
    } else {
      renderTrades();
    }
  } else if (currentView === 'text') {
    renderTextView();
  }
  
  // 重新计算并更新统计信息
  renderSummary();
  
  // 控制紧凑模式按钮的显示
  const compactModeBtn = document.getElementById('openCompactModeBtn');
  if (compactModeBtn) {
    compactModeBtn.style.display = filterDate ? 'inline-block' : 'none';
  }
}

// 重置筛选
async function resetFilters() {
  if (filterDateInput) filterDateInput.value = '';
  if (filterStockInput) filterStockInput.value = '';

  await updateAllStockDatalists();

  await loadTrades();
  await applyFilters();
  
  // 隐藏紧凑模式按钮
  const compactModeBtn = document.getElementById('openCompactModeBtn');
  if (compactModeBtn) {
    compactModeBtn.style.display = 'none';
  }
}

// 加载交易记录
async function loadTrades() {
  try {
    trades = await tradesDB.getAll();
    filteredTrades = [...trades];
    // 暴露给调试和其他插件使用
    window._trades = trades;
    window.trades = trades;
    return trades;
  } catch (error) {
    console.error('加载交易记录失败:', error);
    trades = [];
    filteredTrades = [];
    window._trades = [];
    window.trades = [];
    return [];
  }
}

// 初始化筛选功能
function initFilters() {
  filterDateInput = document.getElementById('filterDate');
  filterStockInput = document.getElementById('filterStock');
  filterStockList = document.getElementById('filterStockList');
  filterBtn = document.getElementById('filterBtn');
  resetFilterBtn = document.getElementById('resetFilterBtn');

  clearPairingsBtn = document.getElementById('clearPairings');
  
  // 视图模式相关元素
  toggleViewBtn = document.getElementById('toggleViewBtn');
  tableView = document.getElementById('tableView');
  textView = document.getElementById('textView');
  
  // 文本模式相关元素
  textOutput = document.getElementById('textOutput');
  
  // 统计相关元素
  toggleStatsBtn = document.getElementById('toggleStatsBtn');
  statsContent = document.querySelector('.stats-content');

  // 折叠统计功能
  if (toggleStatsBtn && statsContent) {
    // 添加点击事件监听器
    toggleStatsBtn.onclick = () => {
      const isVisible = statsContent.style.display !== 'none';
      if (isVisible) {
        statsContent.style.display = 'none';
        toggleStatsBtn.setAttribute('data-expanded', 'false');
      } else {
        statsContent.style.display = 'block';
        toggleStatsBtn.setAttribute('data-expanded', 'true');
      }
    };
  }
  
  if (filterBtn) {
    filterBtn.addEventListener('click', applyFilters);
  }
  
  if (resetFilterBtn) {
    resetFilterBtn.addEventListener('click', resetFilters);
  }
  
  // 清空配对数据按钮事件
  if (clearPairingsBtn) {
    clearPairingsBtn.addEventListener('click', clearAllPairings);
  }
  

  
  // 填充筛选下拉列表（异步：确保从 SQLite 读取最新数据）
  if (filterStockList) {
    (async () => {
      let stocks = window.STOCKS || [];
      try {
        if (window.stockCodeManager && typeof window.stockCodeManager.getStockList === 'function') {
          const sqliteStocks = await window.stockCodeManager.getStockList();
          if (sqliteStocks && sqliteStocks.length > 0) {
            stocks = sqliteStocks;
          }
        }
      } catch(e) { /* 回退 */ }
      filterStockList.innerHTML = '';
      stocks.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.name;
        opt.label = `${s.name} (${s.qty}, ${s.market})`;
        filterStockList.appendChild(opt);
      });
    })();
  }
  
  // 视图模式切换事件
  if (toggleViewBtn) {
    toggleViewBtn.addEventListener('click', async () => {
      // 循环切换视图模式：table → text → table
      let newView;
      if (currentView === 'table') {
        newView = 'text';
      } else {
        newView = 'table';
      }
      await switchView(newView);
    });
  }
  
  // 气泡模式切换事件
  if (bubbleModeBtn) {
    // 初始化按钮状态
    bubbleModeBtn.dataset.mode = 'original';
    bubbleModeBtn.textContent = '原始模式';
    
    bubbleModeBtn.addEventListener('click', async () => {
      const currentMode = bubbleModeBtn.dataset.mode;
      const newMode = currentMode === 'original' ? 'separated' : 'original';
      
      // 切换模式
      currentBubbleMode = newMode;
      
      // 更新按钮状态
      if (newMode === 'original') {
        // 切换到原始模式，重置配对状态
        pairingState.latestPaired = false;
        pairingState.historyPaired = false;
        // 清空配对缓存
        pairingCache = {};
        window.pairingCache = pairingCache;
        
        bubbleModeBtn.dataset.mode = 'original';
        bubbleModeBtn.textContent = '原始模式';
        // 隐藏配对按钮
        const pairingControls = document.getElementById('pairingControls');
        if (pairingControls) {
          pairingControls.style.display = 'none';
        }
      } else {
        // 切换到配对模式，从数据库加载配对结果
        try {
          const allPairings = await tradesDB.getAllPairings();
          // 将数据库中的配对结果加载到内存缓存
          allPairings.forEach(pairing => {
            pairingCache[pairing.stockName] = {
              pairedTrades: pairing.pairedTrades || [],
              pairedBuyIds: pairing.pairedBuyIds || [],
              pairedSellIds: pairing.pairedSellIds || []
            };
          });
          
          bubbleModeBtn.dataset.mode = 'separated';
          bubbleModeBtn.textContent = '配对模式';
          // 显示配对按钮
          const pairingControls = document.getElementById('pairingControls');
          if (pairingControls) {
            pairingControls.style.display = 'flex';
          }
        } catch (error) {
          console.error('加载配对结果失败:', error);
          alert('加载配对结果失败: ' + error.message);
          // 切换失败，恢复到原始模式
          currentBubbleMode = 'original';
          bubbleModeBtn.dataset.mode = 'original';
          bubbleModeBtn.textContent = '原始模式';
        }
      }
      
      // 重新渲染气泡视图
      renderBubbleView();
    });
  }
  
  // 全部配对按钮事件
  if (toggleAllPairBtn) {
    toggleAllPairBtn.textContent = '全部配对';
    toggleAllPairBtn.addEventListener('click', async () => {
      // 执行全部配对（设置所有配对开关为 true），不支持取消功能
      pairingState.latestPaired = true;
      pairingState.historyPaired = true;
      await executeAllPairing();
      renderBubbleView();
    });
  }
  
  // 全部屏蔽配对气泡按钮事件
  if (toggleAllPairBubbleBtn) {
    // 初始化全部屏蔽配对按钮状态（默认为"全部屏蔽配对"）
    toggleAllPairBubbleBtn.dataset.allHidden = 'false';
    toggleAllPairBubbleBtn.textContent = '全部屏蔽配对';
    
    toggleAllPairBubbleBtn.addEventListener('click', () => {
      const currentAllHidden = toggleAllPairBubbleBtn.dataset.allHidden === 'true';
      const newAllHidden = !currentAllHidden;
      
      // 直接更新所有按钮的状态，而不是点击它们
      const allToggleButtons = document.querySelectorAll('.toggle-pair-btn');
      allToggleButtons.forEach(btn => {
        const stockName = btn.dataset.stockName;
        if (stockName) {
          // 更新状态
          pairBubbleHiddenState[stockName] = newAllHidden;
          btn.dataset.hidden = newAllHidden;
          btn.textContent = newAllHidden ? '展开配对' : '屏蔽配对';
        }
      });
      
      // 只在所有按钮更新完毕后重新渲染一次
      renderBubbleView();
      
      // 更新全部屏蔽配对按钮状态
      toggleAllPairBubbleBtn.dataset.allHidden = newAllHidden;
      toggleAllPairBubbleBtn.textContent = newAllHidden ? '全部展开配对' : '全部屏蔽配对';
    });
  }
  
  // 全部折叠/展开按钮事件
  if (toggleAllCollapseBtn) {
    // 初始化全部折叠按钮状态（默认为"全部折叠"）
    toggleAllCollapseBtn.dataset.allCollapsed = 'false';
    toggleAllCollapseBtn.textContent = '全部折叠';
    
    toggleAllCollapseBtn.addEventListener('click', () => {
      const currentAllCollapsed = toggleAllCollapseBtn.dataset.allCollapsed === 'true';
      const newAllCollapsed = !currentAllCollapsed;
      
      // 遍历所有股票的折叠按钮，根据状态决定是否点击它们
      const allCollapseButtons = document.querySelectorAll('.collapse-btn');
      allCollapseButtons.forEach(btn => {
        const stockName = btn.dataset.stockName;
        if (stockName) {
          // 更新状态
          stockCollapsedState[stockName] = newAllCollapsed;
          btn.dataset.collapsed = newAllCollapsed;
          btn.textContent = newAllCollapsed ? '▶' : '▼';
        }
      });
      
      // 只在所有按钮更新完毕后重新渲染一次
      renderBubbleView();
      
      // 更新全部折叠按钮状态
      toggleAllCollapseBtn.dataset.allCollapsed = newAllCollapsed;
      toggleAllCollapseBtn.textContent = newAllCollapsed ? '全部展开' : '全部折叠';
    });
  }
}

// 更新全部屏蔽/展开按钮的状态（简化版，直接使用dataset状态）
function updateToggleAllButtonState() {
  if (!toggleAllPairBtn) return;
  
  // 按钮状态由点击事件管理，这里只用于初始化
  // 不需要做任何操作
}

// 切换视图模式
async function switchView(viewType) {
  currentView = viewType;
  window.currentView = currentView;
  
  // 更新视图显示
  if (tableView && textView) {
    // 隐藏所有视图
    tableView.style.display = 'none';
    textView.style.display = 'none';
    
    // 根据视图类型显示对应视图
    if (viewType === 'table') {
      tableView.style.display = 'block';
      // 渲染股票模式表格
      renderStockModeTable();
      // 更新按钮文本
      if (toggleViewBtn) {
        toggleViewBtn.textContent = '表格模式';
      }
    } else if (viewType === 'text') {
      textView.style.display = 'block';
      // 渲染文本模式
      renderTextView();
      // 更新按钮文本
      if (toggleViewBtn) {
        toggleViewBtn.textContent = '文本模式';
      }
    }
  }
}

// 渲染气泡视图
function renderBubbleView() {
  // 清空现有气泡
  if (taiwanStockBubbles) taiwanStockBubbles.innerHTML = '';
  if (chinaStockBubbles) chinaStockBubbles.innerHTML = '';
  
  // 检查是否设置了筛选日期
  const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
  
  // 如果设置了筛选日期，使用原始模式
  if (filterDate) {
    renderOriginalBubbleView();
    return;
  }
  
  // 根据当前气泡模式选择渲染方式
  if (currentBubbleMode === 'original') {
    renderOriginalBubbleView();
  } else if (currentBubbleMode === 'separated') {
    renderSeparatedBubbleView();
  }
}

// 渲染原始气泡模式
function renderOriginalBubbleView() {
  // 按股票和方向分组交易记录
  const stockTrades = {};
  
  filteredTrades.forEach(trade => {
    const key = `${trade.stock}_${trade.qty}_${trade.market}`;
    if (!stockTrades[key]) {
      stockTrades[key] = {
        stock: trade.stock,
        qty: trade.qty,
        market: trade.market,
        trades: []
      };
    }
    stockTrades[key].trades.push({
      price: Number(trade.price),
      side: trade.side
    });
  });
  
  // 按股票名称计算每个股票的 latestTrade（一个股票只显示一个小勾勾）
  const stockLatestTrades = {};
  trades.forEach(trade => {
    const stockName = trade.stock;
    if (!stockLatestTrades[stockName]) {
      stockLatestTrades[stockName] = { trade: null, createdAt: null };
    }
    const createdAt = trade.createdAt || trade.createdat || trade.created_at;
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      if (stockLatestTrades[stockName].createdAt === null || createdTime > stockLatestTrades[stockName].createdAt) {
        stockLatestTrades[stockName] = { trade: trade, createdAt: createdTime };
      }
    }
  });
  
  // 遍历所有股票
  Object.values(stockTrades).forEach(stockInfo => {
    // 创建气泡元素
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'stock-bubble';
    // 获取股票信息，使用type字段
    const stocksForBubble = window.STOCKS;
    const stockData = stocksForBubble.find(s => s.name === stockInfo.stock);
    const type = stockData ? stockData.type : (stockInfo.market === '台股' ? 'tA' : 'cETF');
    bubbleDiv.innerHTML = `${stockInfo.stock}(${stockInfo.qty}, ${type})`;
    
    // 获取该股票的 latestTrade（按股票名称，而非 stock_qty_market）
    const latestTradeInfo = stockLatestTrades[stockInfo.stock];
    const latestTrade = latestTradeInfo ? latestTradeInfo.trade : null;
    
    // 确保最新交易在显示列表中
    const tradesToDisplay = filteredTrades.filter(
      t => t.stock === stockInfo.stock && t.qty === stockInfo.qty && t.market === stockInfo.market
    );
    
    // 如果最新交易不在筛选结果中，将其添加到显示列表
    if (latestTrade && !tradesToDisplay.some(t => t.id === latestTrade.id)) {
      tradesToDisplay.push(latestTrade);
    }
    
    tradesToDisplay.forEach(originalTrade => {
        const priceBubble = document.createElement('span');
        
        // 存储完整的交易信息到dataset
        priceBubble.dataset.tradeId = originalTrade.id;
        priceBubble.dataset.price = originalTrade.price;
        priceBubble.dataset.side = originalTrade.side;
        priceBubble.dataset.stock = originalTrade.stock;
        priceBubble.dataset.date = originalTrade.date;
        priceBubble.dataset.remark = originalTrade.remark || '';
        priceBubble.dataset.qty = originalTrade.qty;
        priceBubble.dataset.amount = originalTrade.amount;
        priceBubble.dataset.createdAt = originalTrade.createdAt;
        priceBubble.dataset.market = originalTrade.market;
        
        let priceText;
        if (originalTrade.side === 'sell') {
          priceBubble.className = 'price-bubble sell';
          priceText = `-${originalTrade.price}`;
        } else {
          priceBubble.className = 'price-bubble buy';
          priceText = `${originalTrade.price}`;
        }
        
        priceBubble.textContent = priceText;
        
        // 为特殊交易数量的气泡添加淡黄色背景
        try {
          const stocks = window.STOCKS;
          if (stocks) {
            const stockData = stocks.find(function(s) { return s.name === originalTrade.stock; });
            if (stockData && originalTrade.qty !== stockData.qty) {
              priceBubble.style.backgroundColor = '#FFF9C4';
            }
          }
        } catch(e) {
          console.error('检查特殊交易数量失败:', e);
        }
        
        // 为今天日期的气泡添加红色粗线条边框
        if (originalTrade.date === getTodayDate()) {
          priceBubble.style.border = '3px solid red';
          priceBubble.style.borderRadius = '20px';
        } else {
          // 为最近交易日期的气泡添加蓝色粗线条边框
          const recentDate = getRecentTradeDate(trades);
          if (recentDate && originalTrade.date === recentDate) {
            priceBubble.style.border = '3px solid blue';
            priceBubble.style.borderRadius = '20px';
          }
        }
        
        // 为 hideable === 'Y' 的气泡添加虚线边框
        if (originalTrade.hideable === 'Y') {
          priceBubble.style.border = '3px dashed black';
          priceBubble.style.borderRadius = '20px';
        }
        
        // 为每个股票中createdAt值最大的气泡添加网状线条背景和latest-trade类
        if (latestTrade && originalTrade.id === latestTrade.id) {
          priceBubble.classList.add('latest-trade');
          priceBubble.style.backgroundImage = 'linear-gradient(45deg, #cccccc 25%, transparent 25%), linear-gradient(-45deg, #cccccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cccccc 75%), linear-gradient(-45deg, transparent 75%, #cccccc 75%)';
          priceBubble.style.backgroundSize = '20px 20px';
          priceBubble.style.backgroundPosition = '0 0, 0 10px, 10px -10px, -10px 0px';
        }
        
        // 添加双击事件监听器，传递完整的交易对象
        priceBubble.addEventListener('dblclick', () => {
          if (window.DebugAlert) {
            DebugAlert.info(`双击气泡，交易ID: ${originalTrade.id}`);
          }
          if (window.showTradeDetail) {
            window.showTradeDetail(originalTrade, 'main');
          } else {
            if (window.DebugAlert) {
              DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
            }
          }
        });
        
        bubbleDiv.appendChild(priceBubble);
    });
    
    // 根据市场类型添加到对应容器
    if (stockInfo.market === '台股') {
      if (taiwanStockBubbles) {
        taiwanStockBubbles.appendChild(bubbleDiv);
      }
    } else {
      if (chinaStockBubbles) {
        chinaStockBubbles.appendChild(bubbleDiv);
      }
    }
  });
}

// 计算税费的辅助函数
function calculateTax(stockName, side, amount) {
  const stocks = window.STOCKS;
  const stockData = stocks.find(s => s.name === stockName);
  if (!stockData) return 0;
  
  const taxRate = TAX_RATES[stockData.type];
  if (!taxRate) return 0;
  
  const rate = side === 'buy' ? taxRate.buy : taxRate.sell;
  const calculatedTax = (amount * rate) / 10000;
  
  // 如果有最低税费金额，且计算出的税费小于最低金额，则使用最低金额
  if (taxRate.minTaxAmount && calculatedTax < taxRate.minTaxAmount) {
    return taxRate.minTaxAmount;
  }
  
  return calculatedTax;
}

// 获取股票历史数据 - 使用 HistoryDataModule
// 原函数已迁移到 HistoryDataModule.getStockHistoryData

// 改进的配对算法 - 找到所有可能的配对组合
function findBestPairs(buyTrades, sellTrades, stockName) {
  const pairedTrades = [];
  const usedBuyIndices = new Set();
  const usedSellIndices = new Set();
  
  // 按价格排序：买入升序，卖出降序（实现利润最大化）
  // 这样最低的买入价会配对最高的卖出价，实现最大利润
  const sortedBuys = buyTrades.map((trade, index) => ({ trade, originalIndex: index }))
    .sort((a, b) => a.trade.price - b.trade.price);
  const sortedSells = sellTrades.map((trade, index) => ({ trade, originalIndex: index }))
    .sort((a, b) => b.trade.price - a.trade.price);
  
  // 尝试所有可能的配对组合
  for (let i = 0; i < sortedBuys.length; i++) {
    if (usedBuyIndices.has(sortedBuys[i].originalIndex)) continue;
    
    const buyTrade = sortedBuys[i].trade;
    const buyAmount = buyTrade.price * buyTrade.qty;
    const buyTax = calculateTax(stockName, 'buy', buyAmount);
    
    for (let j = 0; j < sortedSells.length; j++) {
      if (usedSellIndices.has(sortedSells[j].originalIndex)) continue;
      
      const sellTrade = sortedSells[j].trade;
      const sellAmount = sellTrade.price * sellTrade.qty;
      const sellTax = calculateTax(stockName, 'sell', sellAmount);
      const profit = sellAmount - buyAmount - buyTax - sellTax;
      
      // 配对必须满足三个条件：
      // 1. 交易数量一致
      // 2. 买入单价低于卖出单价
      // 3. 扣除税费后必须有正利润
      if (buyTrade.qty === sellTrade.qty && buyTrade.price < sellTrade.price && profit > 0) {
        // 找到符合条件的配对（利润最大化）
        pairedTrades.push({
          buy: buyTrade,
          sell: sellTrade,
          profit: profit,
          hideable: ''
        });
        usedBuyIndices.add(sortedBuys[i].originalIndex);
        usedSellIndices.add(sortedSells[j].originalIndex);
        break; // 这个买入已经配对，继续下一个买入
      }
    }
  }
  
  return { pairedTrades, usedBuyIndices, usedSellIndices };
}

// 利润最小化配对算法 - 找到所有可能的配对组合（利润最小化）
function findBestPairsMinimized(buyTrades, sellTrades, stockName) {
  const pairedTrades = [];
  const usedBuyIndices = new Set();
  const usedSellIndices = new Set();
  
  // 按价格排序：买入降序，卖出升序（实现利润最小化）
  // 这样最高的买入价会配对最低的卖出价，实现最小利润
  const sortedBuys = buyTrades.map((trade, index) => ({ trade, originalIndex: index }))
    .sort((a, b) => b.trade.price - a.trade.price);
  const sortedSells = sellTrades.map((trade, index) => ({ trade, originalIndex: index }))
    .sort((a, b) => a.trade.price - b.trade.price);
  
  // 尝试所有可能的配对组合
  for (let i = 0; i < sortedBuys.length; i++) {
    if (usedBuyIndices.has(sortedBuys[i].originalIndex)) continue;
    
    const buyTrade = sortedBuys[i].trade;
    const buyAmount = buyTrade.price * buyTrade.qty;
    const buyTax = calculateTax(stockName, 'buy', buyAmount);
    
    for (let j = 0; j < sortedSells.length; j++) {
      if (usedSellIndices.has(sortedSells[j].originalIndex)) continue;
      
      const sellTrade = sortedSells[j].trade;
      const sellAmount = sellTrade.price * sellTrade.qty;
      const sellTax = calculateTax(stockName, 'sell', sellAmount);
      const profit = sellAmount - buyAmount - buyTax - sellTax;
      
      // 配对必须满足三个条件：
      // 1. 交易数量一致
      // 2. 买入单价低于卖出单价
      // 3. 扣除税费后必须有正利润
      if (buyTrade.qty === sellTrade.qty && buyTrade.price < sellTrade.price && profit > 0) {
        // 找到符合条件的配对（利润最小化）
        pairedTrades.push({
          buy: buyTrade,
          sell: sellTrade,
          profit: profit,
          hideable: ''
        });
        usedBuyIndices.add(sortedBuys[i].originalIndex);
        usedSellIndices.add(sortedSells[j].originalIndex);
        break; // 这个买入已经配对，继续下一个买入
      }
    }
  }
  
  return { pairedTrades, usedBuyIndices, usedSellIndices };
}

// 执行配对并保存到数据库
async function executeAndCachePairing(stockName, allTrades) {
  const cacheKey = stockName;
  
  // 初始化缓存
  if (!pairingCache[cacheKey]) {
    pairingCache[cacheKey] = {
      pairedTrades: [],
      pairedBuyIds: [],
      pairedSellIds: []
    };
  }
  
  // 保留原有配对
  const existingPairedTrades = pairingCache[cacheKey].pairedTrades || [];
  const existingPairedBuyIds = new Set(pairingCache[cacheKey].pairedBuyIds || []);
  const existingPairedSellIds = new Set(pairingCache[cacheKey].pairedSellIds || []);
  
  // 分离买入和卖出交易，过滤掉已配对的交易
  const buyTrades = allTrades.filter(t => t.side === 'buy' && !existingPairedBuyIds.has(t.id));
  const sellTrades = allTrades.filter(t => t.side === 'sell' && !existingPairedSellIds.has(t.id));
  
  // 执行配对
  if (pairingState.latestPaired || pairingState.historyPaired) {
    const pairingResult = findBestPairs(buyTrades, sellTrades, stockName);
    
    // 保留原有配对，只追加新配对
    pairingCache[cacheKey] = {
      pairedTrades: [...existingPairedTrades, ...pairingResult.pairedTrades],
      pairedBuyIds: [...Array.from(existingPairedBuyIds), ...pairingResult.pairedTrades.map(p => p.buy.id)],
      pairedSellIds: [...Array.from(existingPairedSellIds), ...pairingResult.pairedTrades.map(p => p.sell.id)]
    };
  }
  
  // 保存配对结果到数据库
  await tradesDB.savePairing({
    stockName: stockName,
    pairedTrades: pairingCache[cacheKey].pairedTrades,
    pairedBuyIds: pairingCache[cacheKey].pairedBuyIds,
    pairedSellIds: pairingCache[cacheKey].pairedSellIds
  });
}

// 执行所有股票的配对并保存到数据库
async function executeAllPairing() {
  // 按股票分组交易记录
  const stockTrades = {};
  
  filteredTrades.forEach(trade => {
    const key = `${trade.stock}_${trade.qty}_${trade.market}`;
    if (!stockTrades[key]) {
      stockTrades[key] = {
        stock: trade.stock,
        qty: trade.qty,
        market: trade.market,
        trades: []
      };
    }
    stockTrades[key].trades.push({
      ...trade,
      price: Number(trade.price)
    });
  });
  
  // 遍历所有股票
  for (const stockInfo of Object.values(stockTrades)) {
    // 按创建时间排序交易记录（最新的在前，精确到秒）
    const sortedTrades = [...stockInfo.trades].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 不再分离最新区块和历史区块，直接使用所有交易
    const allTrades = sortedTrades;
    
    // 从数据库读取已有的配对结果
    const existingPairing = await tradesDB.getPairing(stockInfo.stock);
    
    // 如果数据库中有配对结果，先加载到内存缓存
    if (existingPairing) {
      pairingCache[stockInfo.stock] = {
        pairedTrades: existingPairing.pairedTrades || [],
        pairedBuyIds: existingPairing.pairedBuyIds || [],
        pairedSellIds: existingPairing.pairedSellIds || []
      };
    }
    
    // 执行配对并保存到数据库
    await executeAndCachePairing(stockInfo.stock, allTrades);
  }
}

// 渲染配对气泡模式
function renderSeparatedBubbleView() {
  // 按股票分组交易记录
  const stockTrades = {};
  
  filteredTrades.forEach(trade => {
    const key = `${trade.stock}_${trade.qty}_${trade.market}`;
    if (!stockTrades[key]) {
      stockTrades[key] = {
        stock: trade.stock,
        qty: trade.qty,
        market: trade.market,
        trades: []
      };
    }
    stockTrades[key].trades.push({
      ...trade, // 保存完整的交易对象
      price: Number(trade.price)
    });
  });
  
  // 按股票名称计算每个股票的 latestTradeId（一个股票只显示一个小勾勾）
  const stockLatestTradeIds = {};
  trades.forEach(trade => {
    const stockName = trade.stock;
    if (!stockLatestTradeIds[stockName]) {
      stockLatestTradeIds[stockName] = { id: null, createdAt: null };
    }
    const createdAt = trade.createdAt || trade.createdat || trade.created_at;
    if (createdAt) {
      const createdTime = new Date(createdAt).getTime();
      if (stockLatestTradeIds[stockName].createdAt === null || createdTime > stockLatestTradeIds[stockName].createdAt) {
        stockLatestTradeIds[stockName] = { id: trade.id, createdAt: createdTime };
      }
    }
  });
  
  // 遍历所有股票
  Object.values(stockTrades).forEach(stockInfo => {
    // 获取股票信息，使用type字段
    const stocksForStockMode = window.STOCKS;
    const stockData = stocksForStockMode.find(s => s.name === stockInfo.stock);
    const type = stockData ? stockData.type : (stockInfo.market === '台股' ? 'tA' : 'cETF');
    
    // 获取今天的日期
    const today = new Date().toISOString().slice(0, 10);
    
    // 获取该股票的 latestTradeId（按股票名称，而非 stock_qty_market）
    const latestTradeInfo = stockLatestTradeIds[stockInfo.stock];
    const latestTradeId = latestTradeInfo ? latestTradeInfo.id : null;
    
    // 按创建时间排序交易记录（最新的在前，精确到秒）
    const sortedTrades = [...stockInfo.trades].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    
    // 不再分离最新区块和历史区块，直接使用所有交易
    const allTrades = sortedTrades;
    
    // 分离买入和卖出交易
    const allBuyTrades = allTrades.filter(t => t.side === 'buy');
    const allSellTrades = allTrades.filter(t => t.side === 'sell');
    
    // ========================== 第一步：收集所有未配对交易 ==========================
    const allUnpairedBuys = [];
    const allUnpairedSells = [];
    
    // 检查缓存中是否有配对结果
    const cacheKey = stockInfo.stock;
    const cachedPairing = pairingCache[cacheKey];
    
    // 使用统一的配对结果
    const allPairedBuyIds = new Set(cachedPairing ? cachedPairing.pairedBuyIds : []);
    const allPairedSellIds = new Set(cachedPairing ? cachedPairing.pairedSellIds : []);
    
    // 收集未配对的买入和卖出交易
    allBuyTrades.forEach(trade => {
      if (!allPairedBuyIds.has(trade.id)) {
        trade.isCrossBlockPaired = false;
        allUnpairedBuys.push(trade);
      }
    });
    
    allSellTrades.forEach(trade => {
      if (!allPairedSellIds.has(trade.id)) {
        trade.isCrossBlockPaired = false;
        allUnpairedSells.push(trade);
      }
    });
    
    // ========================== 第二步：执行跨区块配对 ==========================
    // 不再使用单独的 crossBlock 分类，所有配对都在统一的 pairedTrades 中
    const crossBlockPairedTrades = [];
    
    // ========================== 第三步：渲染区块 ==========================
    // 创建配对模式的气泡元素
    const bubbleDiv = document.createElement('div');
    bubbleDiv.className = 'stock-bubble-separated';
    
    // 获取当前股票的配对气泡屏蔽状态
    const isPairBubbleHidden = pairBubbleHiddenState[stockInfo.stock] || false;
    
    // 获取当前股票的折叠状态
    const isCollapsed = stockCollapsedState[stockInfo.stock] || false;
    
    // 创建气泡头部（股票名称）
    const headerDiv = document.createElement('div');
    headerDiv.className = 'bubble-header';
    
    // 创建折叠/展开按钮
    const collapseBtn = document.createElement('button');
    collapseBtn.className = 'collapse-btn';
    collapseBtn.textContent = isCollapsed ? '▶' : '▼';
    collapseBtn.dataset.stockName = stockInfo.stock;
    collapseBtn.dataset.collapsed = isCollapsed;
    
    // 添加点击事件
    collapseBtn.addEventListener('click', () => {
      const currentCollapsed = collapseBtn.dataset.collapsed === 'true';
      const newCollapsed = !currentCollapsed;
      stockCollapsedState[stockInfo.stock] = newCollapsed;
      collapseBtn.dataset.collapsed = newCollapsed;
      collapseBtn.textContent = newCollapsed ? '▶' : '▼';
      // 重新渲染气泡视图
      renderBubbleView();
    });
    
    headerDiv.appendChild(collapseBtn);
    
    // 股票名称文本
    const stockNameSpan = document.createElement('span');
    stockNameSpan.className = 'stock-name';
    stockNameSpan.textContent = `${stockInfo.stock}(${stockInfo.qty}, ${type})`;
    headerDiv.appendChild(stockNameSpan);
    
    // 创建屏蔽配对气泡切换按钮
    const togglePairBtn = createTogglePairButton(stockInfo.stock, isPairBubbleHidden);
    headerDiv.appendChild(togglePairBtn);
    bubbleDiv.appendChild(headerDiv);
    
    // 创建内容容器（用于折叠）
    const contentDiv = document.createElement('div');
    contentDiv.className = 'bubble-content';
    contentDiv.style.display = isCollapsed ? 'none' : 'block';
    
    // 创建统一的交易部分
    if (allTrades.length > 0) {
      const unifiedSection = document.createElement('div');
      unifiedSection.className = 'bubble-section';
      
      // 使用统一的配对结果
    const allPairedTrades = cachedPairing ? cachedPairing.pairedTrades : [];
      
      // 创建统一的交易项列表（配对交易和未配对交易混在一起）
      const allItems = [];
      
      // 添加配对交易项
      allPairedTrades.forEach(pair => {
        // 检查交易是否仍然存在
        const buyExists = allBuyTrades.some(t => t.id === pair.buy.id);
        const sellExists = allSellTrades.some(t => t.id === pair.sell.id);
        if (!buyExists || !sellExists) return;
        
        // 使用买入或卖出中较新的时间作为排序依据
        const buyCreatedAt = new Date(pair.buy.createdAt);
        const sellCreatedAt = new Date(pair.sell.createdAt);
        const latestCreatedAt = buyCreatedAt > sellCreatedAt ? buyCreatedAt : sellCreatedAt;
        
        allItems.push({
          type: 'paired',
          buy: pair.buy,
          sell: pair.sell,
          createdAt: latestCreatedAt,
          repTrade: buyCreatedAt > sellCreatedAt ? pair.buy : pair.sell
        });
      });
      
      // 添加未配对的买入交易项
      allBuyTrades.forEach(trade => {
        if (allPairedBuyIds.has(trade.id)) return;
        
        allItems.push({
          type: 'unpaired-buy',
          trade: trade,
          createdAt: new Date(trade.createdAt),
          repTrade: trade
        });
      });
      
      // 添加未配对的卖出交易项
      allSellTrades.forEach(trade => {
        if (allPairedSellIds.has(trade.id)) return;
        
        allItems.push({
          type: 'unpaired-sell',
          trade: trade,
          createdAt: new Date(trade.createdAt),
          repTrade: trade
        });
      });
      
      // 按创建时间排序（从新到旧）
      allItems.sort((a, b) => b.createdAt - a.createdAt);
      
      // 确保最新交易在 allItems 中
      if (latestTradeId) {
        const latestInItems = allItems.some(item => {
          if (item.type === 'paired') {
            return item.buy.id === latestTradeId || item.sell.id === latestTradeId;
          } else {
            return item.trade.id === latestTradeId;
          }
        });
        
        if (!latestInItems) {
          // 找到最新交易并添加到 allItems
          const latestTradeObj = trades.find(t => t.id === latestTradeId);
          if (latestTradeObj) {
            allItems.unshift({
              type: latestTradeObj.side === 'buy' ? 'unpaired-buy' : 'unpaired-sell',
              trade: latestTradeObj,
              createdAt: new Date(latestTradeObj.createdAt),
              repTrade: latestTradeObj
            });
          }
        }
      }
      
      // 渲染所有交易项
      allItems.forEach(item => {
        if (item.type === 'paired') {
          // 如果屏蔽配对气泡，则跳过渲染配对气泡
          if (isPairBubbleHidden) return;
          
          const pairBubble = document.createElement('div');
          pairBubble.className = 'trade-pair';
          
          // 如果配对被屏蔽，添加加粗的虚线边框
          if (item.hideable === 'Y') {
            pairBubble.style.border = '3px dashed black';
            pairBubble.style.borderRadius = '16px';
          }
          
          // 添加双击事件显示配对利润核算（使用FloatingWindow）
          pairBubble.addEventListener('dblclick', (e) => {
            // 阻止事件冒泡，避免触发买入或卖出气泡的双击事件
            e.stopPropagation();
            showPairDetailWithFloatingWindow(item, stockInfo.stock);
          });
          
          const buyBubble = document.createElement('span');
          buyBubble.className = 'price-bubble buy';
          buyBubble.textContent = `${item.buy.price}`;
          
          // 为最新交易添加 latest-trade 类
          if (item.buy.id === latestTradeId) {
            buyBubble.classList.add('latest-trade');
          }
          
          // 检查是否是跨区块配对的交易，如果是则添加红色圆点
          if (item.buy.isCrossBlockPaired) {
            buyBubble.classList.add('cross-block-pair');
          }
          
          // 为 hideable === 'Y' 的气泡添加虚线边框
          if (item.buy.hideable === 'Y') {
            buyBubble.style.border = '3px dashed black';
            buyBubble.style.borderRadius = '20px';
          }
          
          // 添加双击事件
          buyBubble.addEventListener('dblclick', () => {
            if (window.DebugAlert) {
              DebugAlert.info(`双击买入气泡，交易ID: ${item.buy.id}`);
            }
            if (window.showTradeDetail) {
              window.showTradeDetail(item.buy);
            } else {
              if (window.DebugAlert) {
                DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
              }
            }
          });
          
          pairBubble.appendChild(buyBubble);
          
          const sellBubble = document.createElement('span');
          sellBubble.className = 'price-bubble sell';
          sellBubble.textContent = `-${item.sell.price}`;
          sellBubble.dataset.tradeId = item.sell.id;
          sellBubble.dataset.price = item.sell.price;
          sellBubble.dataset.side = item.sell.side;
          sellBubble.dataset.stock = item.sell.stock;
          sellBubble.dataset.date = item.sell.date;
          sellBubble.dataset.remark = item.sell.remark || '';
          
          // 为最新交易添加 latest-trade 类
          if (item.sell.id === latestTradeId) {
            sellBubble.classList.add('latest-trade');
          }
          
          // 检查是否是跨区块配对的交易，如果是则添加红色圆点
          if (item.sell.isCrossBlockPaired) {
            sellBubble.classList.add('cross-block-pair');
          }
          
          // 为 hideable === 'Y' 的气泡添加虚线边框
          if (item.sell.hideable === 'Y') {
            sellBubble.style.border = '3px dashed black';
            sellBubble.style.borderRadius = '20px';
          }
          
          // 添加双击事件
          sellBubble.addEventListener('dblclick', () => {
            if (window.DebugAlert) {
              DebugAlert.info(`双击卖出气泡，交易ID: ${item.sell.id}`);
            }
            if (window.showTradeDetail) {
              window.showTradeDetail(item.sell);
            } else {
              if (window.DebugAlert) {
                DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
              }
            }
          });
          
          pairBubble.appendChild(sellBubble);
          
          unifiedSection.appendChild(pairBubble);
        } else if (item.type === 'unpaired-buy') {
          const priceBubble = document.createElement('span');
          priceBubble.className = 'price-bubble buy';
          priceBubble.textContent = `${item.trade.price}`;
          priceBubble.dataset.tradeId = item.trade.id;
          priceBubble.dataset.price = item.trade.price;
          priceBubble.dataset.side = item.trade.side;
          priceBubble.dataset.stock = item.trade.stock;
          priceBubble.dataset.date = item.trade.date;
          priceBubble.dataset.remark = item.trade.remark || '';
          
          // 为最新交易添加 latest-trade 类
          if (item.trade.id === latestTradeId) {
            priceBubble.classList.add('latest-trade');
          }
          
          // 为今天日期的气泡添加红色粗线条边框
          if (item.trade.date === getTodayDate()) {
            priceBubble.style.border = '3px solid red';
            priceBubble.style.borderRadius = '20px';
          } else {
            // 为最近交易日期的气泡添加蓝色粗线条边框
            const recentDate = getRecentTradeDate(trades);
            if (recentDate && item.trade.date === recentDate) {
              priceBubble.style.border = '3px solid blue';
              priceBubble.style.borderRadius = '20px';
            }
          }
          
          // 检查是否是跨区块配对的交易，如果是则添加红色圆点
          if (item.trade.isCrossBlockPaired) {
            priceBubble.classList.add('cross-block-pair');
          }
          
          // 为 hideable === 'Y' 的气泡添加虚线边框
          if (item.trade.hideable === 'Y') {
            priceBubble.style.border = '3px dashed black';
            priceBubble.style.borderRadius = '20px';
          }
          
          // 添加双击事件
          priceBubble.addEventListener('dblclick', () => {
            if (window.DebugAlert) {
              DebugAlert.info(`双击未配对买入气泡，交易ID: ${item.trade.id}`);
            }
            if (window.showTradeDetail) {
              window.showTradeDetail(item.trade);
            } else {
              if (window.DebugAlert) {
                DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
              }
            }
          });
          
          unifiedSection.appendChild(priceBubble);
        } else if (item.type === 'unpaired-sell') {
          const priceBubble = document.createElement('span');
          priceBubble.className = 'price-bubble sell';
          priceBubble.textContent = `-${item.trade.price}`;
          priceBubble.dataset.tradeId = item.trade.id;
          priceBubble.dataset.price = item.trade.price;
          priceBubble.dataset.side = item.trade.side;
          priceBubble.dataset.stock = item.trade.stock;
          priceBubble.dataset.date = item.trade.date;
          priceBubble.dataset.remark = item.trade.remark || '';
          
          // 为最新交易添加 latest-trade 类
          if (item.trade.id === latestTradeId) {
            priceBubble.classList.add('latest-trade');
          }
          
          // 为今天日期的气泡添加红色粗线条边框
          if (item.trade.date === getTodayDate()) {
            priceBubble.style.border = '3px solid red';
            priceBubble.style.borderRadius = '20px';
          } else {
            // 为最近交易日期的气泡添加蓝色粗线条边框
            const recentDate = getRecentTradeDate(trades);
            if (recentDate && item.trade.date === recentDate) {
              priceBubble.style.border = '3px solid blue';
              priceBubble.style.borderRadius = '20px';
            }
          }
          
          // 检查是否是跨区块配对的交易，如果是则添加红色圆点
          if (item.trade.isCrossBlockPaired) {
            priceBubble.classList.add('cross-block-pair');
          }
          
          // 为 hideable === 'Y' 的气泡添加虚线边框
          if (item.trade.hideable === 'Y') {
            priceBubble.style.border = '3px dashed black';
            priceBubble.style.borderRadius = '20px';
          }
          
          // 添加双击事件
          priceBubble.addEventListener('dblclick', () => {
            if (window.DebugAlert) {
              DebugAlert.info(`双击未配对卖出气泡，交易ID: ${item.trade.id}`);
            }
            if (window.showTradeDetail) {
              window.showTradeDetail(item.trade);
            } else {
              if (window.DebugAlert) {
                DebugAlert.warn('bubbleDetail.js 未加载，无法显示交易详情');
              }
            }
          });
          
          unifiedSection.appendChild(priceBubble);
        }
      });
      
      contentDiv.appendChild(unifiedSection);
    }
    
    // 如果没有交易记录，只显示股票名称
    if (allTrades.length === 0) {
      contentDiv.appendChild(document.createTextNode('暂无交易记录'));
    }
    
    // 将内容容器添加到气泡中
    bubbleDiv.appendChild(contentDiv);
    
    // 根据市场类型添加到对应容器
    if (stockInfo.market === '台股') {
      if (taiwanStockBubbles) {
        taiwanStockBubbles.appendChild(bubbleDiv);
      }
    } else {
      if (chinaStockBubbles) {
        chinaStockBubbles.appendChild(bubbleDiv);
      }
    }
  });
}

// 创建屏蔽配对气泡切换按钮（公共函数，提高代码重用）
function createTogglePairButton(stockName, isHidden) {
  const togglePairBtn = document.createElement('button');
  togglePairBtn.className = 'toggle-pair-btn';
  togglePairBtn.textContent = isHidden ? '展开配对' : '屏蔽配对';
  togglePairBtn.dataset.stockName = stockName;
  togglePairBtn.dataset.hidden = isHidden;
  
  // 添加点击事件
  togglePairBtn.addEventListener('click', () => {
    const currentHidden = togglePairBtn.dataset.hidden === 'true';
    const newHidden = !currentHidden;
    pairBubbleHiddenState[stockName] = newHidden;
    togglePairBtn.dataset.hidden = newHidden;
    togglePairBtn.textContent = newHidden ? '展开配对' : '屏蔽配对';
    // 个股设定不影响全部按钮状态，直接重新渲染
    renderBubbleView();
  });
  
  // 创建新增交易按钮
  const addTradeBtn = document.createElement('button');
  addTradeBtn.className = 'add-trade-btn';
  addTradeBtn.textContent = '新增交易';
  addTradeBtn.dataset.stockName = stockName;
  
  // 添加点击事件
  addTradeBtn.addEventListener('click', () => {
    openAddTradeModal(stockName);
  });
  
  // 创建按钮容器
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'button-container';
  buttonContainer.appendChild(togglePairBtn);
  buttonContainer.appendChild(addTradeBtn);

  // 创建手动配对按钮，放在新增交易旁
  const manualPairLocalBtn = document.createElement('button');
  manualPairLocalBtn.className = 'manual-pair-btn';
  manualPairLocalBtn.textContent = '手动配对';
  manualPairLocalBtn.dataset.stockName = stockName;
  manualPairLocalBtn.addEventListener('click', () => {
    showDragPairZone();
  });
  buttonContainer.appendChild(manualPairLocalBtn);

  // 创建批次修改气泡屏蔽按钮，放在新增交易旁
  const batchHideBtn = document.createElement('button');
  batchHideBtn.className = 'add-trade-btn';
  batchHideBtn.textContent = '批次修改';
  batchHideBtn.dataset.stockName = stockName;
  batchHideBtn.addEventListener('click', () => {
    openBatchHideBubbleWindow(stockName);
  });
  buttonContainer.appendChild(batchHideBtn);
  
  return buttonContainer;
}

// ---------------- 手动配对模态逻辑 ----------------
function initManualPairModal() {
  const modal = document.getElementById('manualPairModal');
  const closeBtn = document.getElementById('closeManualPairModalBtn');
  const confirmBtn = document.getElementById('manualPairConfirmBtn');
  const unpairBtn = document.getElementById('manualUnpairSelectedBtn');
  const stockInputEl = document.getElementById('manualPairStock');

  if (closeBtn) closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
  if (modal) modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });

  if (stockInputEl) {
    stockInputEl.addEventListener('change', () => renderManualLists(stockInputEl.value.trim()));
  }

  if (confirmBtn) confirmBtn.addEventListener('click', async () => {
    await manualPairConfirm();
  });

  if (unpairBtn) unpairBtn.addEventListener('click', async () => {
    await manualUnpairSelected();
  });
}

function openManualPairModal(stockName) {
  const modal = document.getElementById('manualPairModal');
  const stockInputEl = document.getElementById('manualPairStock');
  if (!modal || !stockInputEl) return;
  stockInputEl.value = stockName || '';
  if (stockName) renderManualLists(stockName);
  modal.style.display = 'block';
}

function renderManualLists(stockName) {
  const buysEl = document.getElementById('manualUnpairedBuys');
  const sellsEl = document.getElementById('manualUnpairedSells');
  const pairedEl = document.getElementById('manualPairedList');
  if (!buysEl || !sellsEl || !pairedEl) return;

  buysEl.innerHTML = '';
  sellsEl.innerHTML = '';
  pairedEl.innerHTML = '';

  // collect trades for this stock
  const stockTrades = trades.filter(t => t.stock === stockName);
  if (stockTrades.length === 0) return;

  // 按创建时间排序交易记录（最新的在前）
  const sortedTrades = [...stockTrades].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  // load existing pairing for this stock
  const cachedPairing = pairingCache[stockName] || {};

  // 使用统一的配对结果
  const allPairedBuyIds = new Set(cachedPairing ? cachedPairing.pairedBuyIds : []);
  const allPairedSellIds = new Set(cachedPairing ? cachedPairing.pairedSellIds : []);

  // render unpaired buys (按时间排序)
  sortedTrades.filter(t => t.side === 'buy' && !allPairedBuyIds.has(t.id)).forEach(t => {
    const el = document.createElement('div'); el.className = 'list-item buy'; el.textContent = `${t.createdAt.split('T')[1].slice(0,8)} ${t.price}`;
    el.dataset.id = t.id; el.dataset.side='buy'; el.dataset.stock=t.stock;
    el.addEventListener('click', () => toggleManualSelect(el));
    buysEl.appendChild(el);
  });

  // render unpaired sells (按时间排序)
  sortedTrades.filter(t => t.side === 'sell' && !allPairedSellIds.has(t.id)).forEach(t => {
    const el = document.createElement('div'); el.className = 'list-item sell'; el.textContent = `${t.createdAt.split('T')[1].slice(0,8)} -${t.price}`;
    el.dataset.id = t.id; el.dataset.side='sell'; el.dataset.stock=t.stock;
    el.addEventListener('click', () => toggleManualSelect(el));
    sellsEl.appendChild(el);
  });

  // render existing paired records
  const pairedRecords = [];
  if (cachedPairing && Array.isArray(cachedPairing.pairedTrades)) {
    pairedRecords.push(...cachedPairing.pairedTrades);
  }

  // 按时间排序配对记录
  pairedRecords.sort((a, b) => {
    const aTime = Math.max(new Date(a.buy.createdAt), new Date(a.sell.createdAt));
    const bTime = Math.max(new Date(b.buy.createdAt), new Date(b.sell.createdAt));
    return bTime - aTime;
  });

  pairedRecords.forEach((pair, idx) => {
    const wrap = document.createElement('div'); wrap.className='list-item';
    wrap.dataset.pairIndex = idx;
    wrap.innerHTML = `<strong>${pair.buy.price}</strong> / <strong>-${pair.sell.price}</strong>`;
    wrap.addEventListener('click', () => {
      // mark for unpairing
      document.querySelectorAll('#manualPairedList .list-item').forEach(n=>n.classList.remove('selected'));
      wrap.classList.add('selected');
    });
    pairedEl.appendChild(wrap);
  });
}

function toggleManualSelect(el) {
  // allow selecting one buy and one sell
  const list = el.parentElement;
  if (!list) return;
  // toggle selected
  el.classList.toggle('selected');
  // keep at most one selected per side
  const side = el.dataset.side;
  const container = el.parentElement;
  if (side === 'buy') {
    Array.from(container.querySelectorAll('.list-item.buy')).forEach(i=>{ if(i!==el) i.classList.remove('selected'); });
  } else if (side === 'sell') {
    Array.from(container.querySelectorAll('.list-item.sell')).forEach(i=>{ if(i!==el) i.classList.remove('selected'); });
  }
}

async function manualPairConfirm() {
  const stock = (document.getElementById('manualPairStock').value || '').trim();
  if (!stock) { alert('请选择股票'); return; }
  const buyEl = document.querySelector('#manualUnpairedBuys .list-item.selected');
  const sellEl = document.querySelector('#manualUnpairedSells .list-item.selected');
  if (!buyEl || !sellEl) { alert('请分别选择一笔买入与一笔卖出交易'); return; }
  const buyId = buyEl.dataset.id; const sellId = sellEl.dataset.id;

  const buyTrade = trades.find(t=>t.id===buyId);
  const sellTrade = trades.find(t=>t.id===sellId);
  if (!buyTrade || !sellTrade) { alert('未找到选定交易'); return; }

  // 配对必须满足三个条件：
  // 1. 交易数量一致
  // 2. 买入单价低于卖出单价
  // 3. 扣除税费后必须有正利润
  if (buyTrade.qty !== sellTrade.qty) {
    alert('交易数量不一致，无法配对');
    return;
  }

  if (buyTrade.price >= sellTrade.price) {
    alert('买入单价必须低于卖出单价，无法配对');
    return;
  }

  const qty = buyTrade.qty;
  const buyAmount = buyTrade.price * qty;
  const sellAmount = sellTrade.price * qty;
  const buyTax = calculateTax(stock, 'buy', buyAmount);
  const sellTax = calculateTax(stock, 'sell', sellAmount);
  const profit = sellAmount - buyAmount - buyTax - sellTax;

  if (profit <= 0) {
    alert(`配对将产生负利润（${profit.toFixed(2)}），无法配对`);
    return;
  }

  // load existing pairing from DB
  const existing = await tradesDB.getPairing(stock);
  const newPair = { buy: buyTrade, sell: sellTrade, profit };

  const today = new Date().toISOString().slice(0,10);
  // determine nearestDate same as executeAllPairing
  const stockTrades = trades.filter(t=>t.stock===stock);
  let nearestDate=null, minDaysDiff=Infinity;
  stockTrades.forEach(tr=>{ const d=Math.abs((new Date(tr.date)-new Date(today))/(1000*60*60*24)); if(d<minDaysDiff){minDaysDiff=d;nearestDate=tr.date;} });

  const inLatest = (buyTrade.date===nearestDate) && (sellTrade.date===nearestDate);
  const inHistory = (buyTrade.date!==nearestDate) && (sellTrade.date!==nearestDate);

  const updated = existing ? JSON.parse(JSON.stringify(existing)) : { 
    stockName: stock, 
    pairedTrades: [],
    pairedBuyIds: [],
    pairedSellIds: []
  };

  // 添加新配对
  updated.pairedTrades.push(newPair);
  updated.pairedBuyIds.push(buyTrade.id);
  updated.pairedSellIds.push(sellTrade.id);

  // save to DB and update cache
  await tradesDB.savePairing(updated);
  pairingCache[stock] = {
    pairedTrades: updated.pairedTrades,
    pairedBuyIds: updated.pairedBuyIds,
    pairedSellIds: updated.pairedSellIds
  };

  // refresh trades and UI for this stock
  await loadTrades();
  await applyFilters();
  if (currentView === 'table') {
    if (currentTableMode === 'stock') {
      await renderStockModeTable();
    } else {
      renderTrades();
    }
  } else {
    renderBubbleView();
  }
  // close modal
  const modal = document.getElementById('manualPairModal'); if (modal) modal.style.display='none';
}

async function manualUnpairSelected() {
  const stock = (document.getElementById('manualPairStock').value || '').trim();
  if (!stock) { alert('请选择股票'); return; }
  const pairedEl = document.querySelector('#manualPairedList .list-item.selected');
  if (!pairedEl) { alert('请选择要解除的配对记录'); return; }
  const index = Number(pairedEl.dataset.pairIndex || 0);
  const existing = await tradesDB.getPairing(stock);
  if (!existing) { alert('没有配对记录'); return; }

  // find all pairs combined
  const combined = [];
  if (existing.pairedTrades && Array.isArray(existing.pairedTrades)) combined.push(...existing.pairedTrades);
  const pair = combined[index];
  if (!pair) { alert('未找到选定配对'); return; }

  // remove from unified pairing structure
  if (existing.pairedTrades && Array.isArray(existing.pairedTrades)) {
    existing.pairedTrades = existing.pairedTrades.filter(p=> !(p.buy.id===pair.buy.id && p.sell.id===pair.sell.id));
  }
  if (existing.pairedBuyIds && Array.isArray(existing.pairedBuyIds)) {
    existing.pairedBuyIds = existing.pairedBuyIds.filter(id=> id!==pair.buy.id);
  }
  if (existing.pairedSellIds && Array.isArray(existing.pairedSellIds)) {
    existing.pairedSellIds = existing.pairedSellIds.filter(id=> id!==pair.sell.id);
  }

  // save
  await tradesDB.savePairing(existing);
  pairingCache[stock] = {
    pairedTrades: existing.pairedTrades || [],
    pairedBuyIds: existing.pairedBuyIds || [],
    pairedSellIds: existing.pairedSellIds || []
  };
  await loadTrades();
  await applyFilters();
  if (currentView === 'table') {
    if (currentTableMode === 'stock') {
      await renderStockModeTable();
    } else {
      renderTrades();
    }
  } else {
    renderBubbleView();
  }
  const modal = document.getElementById('manualPairModal'); if (modal) modal.style.display='none';
}

// 更新单个股票的按钮状态（公共函数，提高代码重用）
function updateToggleButtonState(button, isHidden) {
  button.dataset.hidden = isHidden;
  button.textContent = isHidden ? '展开配对' : '屏蔽配对';
}

// 渲染文本视图
function renderTextView() {
  if (!textOutput) return;
  
  // 按股票和方向分组交易记录
  const stockTrades = {};
  
  filteredTrades.forEach(trade => {
    const key = `${trade.stock}_${trade.market}`;
    if (!stockTrades[key]) {
      stockTrades[key] = {
        stock: trade.stock,
        market: trade.market,
        trades: []
      };
    }
    stockTrades[key].trades.push({
      price: Number(trade.price),
      side: trade.side
    });
  });
  
  // 生成文本输出
  let output = "税费参数：\n";
  output += "tETF(14.16,23.14,9.91) tA(14.16,46.25,9.91) cETF(1.05,1.05,0) cA(1.05,9,0) cG(0,0,0)\n\n";
  var now = new Date();
  var pad = function(n) { return n < 10 ? '0' + n : n; };
  output += `#${now.getFullYear()}/${pad(now.getMonth()+1)}/${pad(now.getDate())}#\n\n`;
  
  // 台股部分
  output += "台股部分：\n";
  
  // 使用 window.STOCKS 以支持动态切换
  const stocksForText = window.STOCKS;
  
  // 遍历所有台股
  Object.values(stockTrades)
    .filter(stockInfo => stockInfo.market === '台股')
    .forEach(stockInfo => {
      // 获取股票信息
      const stockData = stocksForText.find(s => s.name === stockInfo.stock);
      if (!stockData) return;
      
      // 生成股票行，使用股票的type字段
      let line = `${stockInfo.stock}(${stockData.qty},${stockData.type})`;
      
      // 添加交易价格
      stockInfo.trades.forEach(trade => {
        if (trade.side === 'sell') {
          // 卖出：显示负号
          line += ` -${trade.price}`;
        } else {
          // 买入：显示正数
          line += ` ${trade.price}`;
        }
      });
      
      output += line + "\n";
    });
  
  output += "\n";
  
  // 陆股部分
  output += "陆股部分：\n";
  
  // 遍历所有陆股
  Object.values(stockTrades)
    .filter(stockInfo => stockInfo.market === '陆股')
    .forEach(stockInfo => {
      // 获取股票信息
      const stockData = stocksForText.find(s => s.name === stockInfo.stock);
      if (!stockData) return;
      
      // 生成股票行，使用股票的type字段
      let line = `${stockInfo.stock}(${stockData.qty},${stockData.type})`;
      
      // 添加交易价格
      stockInfo.trades.forEach(trade => {
        if (trade.side === 'sell') {
          // 卖出：显示负号
          line += ` -${trade.price}`;
        } else {
          // 买入：显示正数
          line += ` ${trade.price}`;
        }
      });
      
      output += line + "\n";
    });
  
  // 设置文本输出
  textOutput.textContent = output;
}

// 渲染配对关系模式文本输出
async function renderPairingModeTextView() {
  if (!textOutput) return;
  
  // 获取筛选日期
  const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
  if (!filterDate) return;
  
  try {
    // 加载配对结果
    const allPairings = await tradesDB.getAllPairings();
    
    // 按股票和市场分组交易记录
    const stockTrades = {};
    const stockInfoMap = {};
    
    // 首先构建股票信息映射
    filteredTrades.forEach(trade => {
      const key = `${trade.stock}_${trade.market}`;
      if (!stockTrades[key]) {
        stockTrades[key] = {
          stock: trade.stock,
          market: trade.market,
          trades: []
        };
      }
      stockTrades[key].trades.push({
        id: trade.id,
        price: Number(trade.price),
        side: trade.side,
        date: trade.date
      });
      
      // 构建股票信息映射
      if (!stockInfoMap[trade.stock]) {
        const stocksForMap = window.STOCKS;
        const stockData = stocksForMap.find(s => s.name === trade.stock);
        if (stockData) {
          stockInfoMap[trade.stock] = {
            qty: stockData.qty,
            type: stockData.type
          };
        }
      }
    });
    
    // 构建配对映射
    const pairingMap = {};
    allPairings.forEach(pairing => {
      pairingMap[pairing.stockName] = pairing;
    });
    
    // 生成文本输出
    let output = "税费参数：\n";
    output += "tETF(14.16,23.14,9.91) tA(14.16,46.25,9.91) cETF(1.05,1.05,0) cA(1.05,9,0) cG(0,0,0)\n\n";
    output += `#${filterDate.replace(/-/g, '/')}#\n\n`;
    
    // 台股部分
    output += "台股部分：\n";
    
    // 遍历所有台股
    Object.values(stockTrades)
      .filter(stockInfo => stockInfo.market === '台股')
      .forEach(stockInfo => {
        const stockName = stockInfo.stock;
        const stockData = stockInfoMap[stockName];
        if (!stockData) return;
        
        // 生成股票行，使用股票的type字段
        let line = `${stockName}(${stockData.qty},${stockData.type})`;
        
        // 获取该股票的配对信息（兼容新旧格式）
        const pairing = pairingMap[stockName];
        const pairedTradeIds = new Set();
        const pairingGroups = {};

        // 收集配对信息：使用统一的 pairedTrades
        if (pairing) {
          const allPairedTrades = [];
          if (pairing.pairedTrades && Array.isArray(pairing.pairedTrades)) allPairedTrades.push(...pairing.pairedTrades);

          if (allPairedTrades.length > 0) {
            // 为每个股票单独计算配对编号，确保从a1开始
            // 先过滤出与当前筛选日期匹配的配对
            const sameDayPairs = allPairedTrades.filter(pair => {
              return pair.buy?.date === filterDate || pair.sell?.date === filterDate;
            });

            // 为当天的配对生成编号
            sameDayPairs.forEach((pair, index) => {
              const groupId = `a${index + 1}`; // 每个股票的当天配对从a1开始编号
              pairingGroups[groupId] = {
                buyId: pair.buy?.id,
                sellId: pair.sell?.id,
                buyPrice: pair.buy?.price,
                sellPrice: pair.sell?.price,
                buyDate: pair.buy?.date,
                sellDate: pair.sell?.date
              };
              pair.buy?.id && pairedTradeIds.add(pair.buy.id);
              pair.sell?.id && pairedTradeIds.add(pair.sell.id);
            });

            // 处理跨日期的配对（不生成a1、a2等编号，只用于显示配对价格）
            const crossDayPairs = allPairedTrades.filter(pair => {
              return pair.buy?.date !== filterDate && pair.sell?.date !== filterDate;
            });

            crossDayPairs.forEach((pair, index) => {
              const groupId = `cross_${index}`;
              pairingGroups[groupId] = {
                buyId: pair.buy?.id,
                sellId: pair.sell?.id,
                buyPrice: pair.buy?.price,
                sellPrice: pair.sell?.price,
                buyDate: pair.buy?.date,
                sellDate: pair.sell?.date
              };
              pair.buy?.id && pairedTradeIds.add(pair.buy.id);
              pair.sell?.id && pairedTradeIds.add(pair.sell.id);
            });
          }
        }
        
        // 处理交易记录，添加配对标识
        stockInfo.trades.forEach(trade => {
          let priceStr = trade.side === 'sell' ? `-${trade.price}` : `${trade.price}`;
          
          // 查找该交易是否在配对中
          let pairingId = null;
          let pairedPrice = null;
          let isSameDay = false;
          
          for (const [groupId, pair] of Object.entries(pairingGroups)) {
            if (pair.buyId === trade.id) {
              pairingId = groupId;
              // 直接从配对数据中获取卖出价格和日期
              if (pair.sellPrice !== undefined) {
                pairedPrice = `-${pair.sellPrice}`; // 卖出价格显示为负数
                // 检查是否同一天
                isSameDay = trade.date === pair.sellDate;
              }
              break;
            }
            if (pair.sellId === trade.id) {
              pairingId = groupId;
              // 直接从配对数据中获取买入价格和日期
              if (pair.buyPrice !== undefined) {
                pairedPrice = `${pair.buyPrice}`; // 买入价格显示为正数
                // 检查是否同一天
                isSameDay = trade.date === pair.buyDate;
              }
              break;
            }
          }
          
          // 添加配对标识
          if (pairingId && isSameDay && !pairingId.startsWith('cross_')) {
            // 同一天的配对，使用#a1、#a2等标识
            priceStr += `(#${pairingId})`;
          } else if (pairedPrice) {
            // 跨日期的配对，显示配对价格
            priceStr += `(#${pairedPrice})`;
          }
          
          line += ` ${priceStr}`;
        });
        
        output += line + "\n";
      });
  
  output += "\n";
  
  // 陆股部分
  output += "陆股部分：\n";
  
  // 遍历所有陆股
  Object.values(stockTrades)
    .filter(stockInfo => stockInfo.market === '陆股')
    .forEach(stockInfo => {
      const stockName = stockInfo.stock;
      const stockData = stockInfoMap[stockName];
      if (!stockData) return;
      
      // 生成股票行，使用股票的type字段
      let line = `${stockName}(${stockData.qty},${stockData.type})`;
      
      // 获取该股票的配对信息（兼容新旧格式）
      const pairing = pairingMap[stockName];
      const pairedTradeIds = new Set();
      const pairingGroups = {};

      // 收集配对信息：使用统一的 pairedTrades
      if (pairing) {
        const allPairedTrades = [];
        if (pairing.pairedTrades && Array.isArray(pairing.pairedTrades)) allPairedTrades.push(...pairing.pairedTrades);

        if (allPairedTrades.length > 0) {
          // 为每个股票单独计算配对编号，确保从a1开始
          // 先过滤出与当前筛选日期匹配的配对
          const sameDayPairs = allPairedTrades.filter(pair => {
            return pair.buy?.date === filterDate || pair.sell?.date === filterDate;
          });

          // 为当天的配对生成编号
          sameDayPairs.forEach((pair, index) => {
            const groupId = `a${index + 1}`; // 每个股票的当天配对从a1开始编号
            pairingGroups[groupId] = {
              buyId: pair.buy?.id,
              sellId: pair.sell?.id,
              buyPrice: pair.buy?.price,
              sellPrice: pair.sell?.price,
              buyDate: pair.buy?.date,
              sellDate: pair.sell?.date
            };
            pair.buy?.id && pairedTradeIds.add(pair.buy.id);
            pair.sell?.id && pairedTradeIds.add(pair.sell.id);
          });

          // 处理跨日期的配对（不生成a1、a2等编号，只用于显示配对价格）
          const crossDayPairs = allPairedTrades.filter(pair => {
            return pair.buy?.date !== filterDate && pair.sell?.date !== filterDate;
          });

          crossDayPairs.forEach((pair, index) => {
            const groupId = `cross_${index}`;
            pairingGroups[groupId] = {
              buyId: pair.buy?.id,
              sellId: pair.sell?.id,
              buyPrice: pair.buy?.price,
              sellPrice: pair.sell?.price,
              buyDate: pair.buy?.date,
              sellDate: pair.sell?.date
            };
            pair.buy?.id && pairedTradeIds.add(pair.buy.id);
            pair.sell?.id && pairedTradeIds.add(pair.sell.id);
          });
        }
      }
      
      // 处理交易记录，添加配对标识
      stockInfo.trades.forEach(trade => {
        let priceStr = trade.side === 'sell' ? `-${trade.price}` : `${trade.price}`;
        
        // 查找该交易是否在配对中
        let pairingId = null;
        let pairedPrice = null;
        let isSameDay = false;
        
        for (const [groupId, pair] of Object.entries(pairingGroups)) {
          if (pair.buyId === trade.id) {
            pairingId = groupId;
            // 直接从配对数据中获取卖出价格和日期
            if (pair.sellPrice !== undefined) {
              pairedPrice = `-${pair.sellPrice}`; // 卖出价格显示为负数
              // 检查是否同一天
              isSameDay = trade.date === pair.sellDate;
            }
            break;
          }
          if (pair.sellId === trade.id) {
            pairingId = groupId;
            // 直接从配对数据中获取买入价格和日期
            if (pair.buyPrice !== undefined) {
              pairedPrice = `${pair.buyPrice}`; // 买入价格显示为正数
              // 检查是否同一天
              isSameDay = trade.date === pair.buyDate;
            }
            break;
          }
        }
        
        // 添加配对标识
        if (pairingId && isSameDay && !pairingId.startsWith('cross_')) {
          // 同一天的配对，使用#a1、#a2等标识
          priceStr += `(#${pairingId})`;
        } else if (pairedPrice) {
          // 跨日期的配对，显示配对价格
          priceStr += `(#${pairedPrice})`;
        }
        
        line += ` ${priceStr}`;
      });
      
      output += line + "\n";
    });
  
  // 设置文本输出
  textOutput.textContent = output;
  } catch (error) {
    console.error('渲染配对关系模式失败:', error);
    textOutput.textContent = `渲染失败: ${error.message}`;
  }
}





// 初始化函数
async function init() {
  try {
    // 获取UI元素
    stockInput = document.getElementById('stockInput');
    stockListEl = document.getElementById('stockList');
    sideSelect = document.getElementById('sideSelect');
    priceInput = document.getElementById('priceInput');
    remarkInput = document.getElementById('remarkInput');
    addBtn = document.getElementById('addTxBtn');
    
    // 获取输入模式相关元素
    singleInputMode = document.getElementById('singleInputMode');
    batchInputMode = document.getElementById('batchInputMode');
    multiStockInputMode = document.getElementById('multiStockInputMode');
    multiStockMultiDateInputMode = document.getElementById('multiStockMultiDateInputMode');
    batchStockInput = document.getElementById('batchStockInput');
    batchStockListEl = document.getElementById('batchStockList');
    batchInput = document.getElementById('batchInput');
    addBatchBtn = document.getElementById('addBatchTxBtn');
    multiStockInput = document.getElementById('multiStockInput');
    addMultiStockBtn = document.getElementById('addMultiStockTxBtn');
    multiStockMultiDateInput = document.getElementById('multiStockMultiDateInput');
    addMultiStockMultiDateBtn = document.getElementById('addMultiStockMultiDateTxBtn');
    
    tableBody = document.querySelector('tbody');
    window.tableBody = tableBody; // 暴露到 window 对象，供其他模块调用
    summaryEl = document.querySelector('.summary');
    
    // 获取表格模式相关元素
    tableModeDetail = document.getElementById('tableModeDetail');
    tableModeStock = document.getElementById('tableModeStock');
    stockModeToolbar = document.getElementById('stockModeToolbar');
    toggleAllStocksBtn = document.getElementById('toggleAllStocksBtn');
    stockJumpSelect = document.getElementById('stockJumpSelect');
    hideHideableBubblesCheckbox = document.getElementById('hideHideableBubbles');
    if (hideHideableBubblesCheckbox) {
      hideHideableBubblesCheckbox.checked = true;
    }
    showOnlyFilterDateStocksCheckbox = document.getElementById('showOnlyFilterDateStocks');
    
    // 获取文本模式相关元素
    textModePairing = document.getElementById('textModePairing');
    textModeNormal = document.getElementById('textModeNormal');
    
    // 打开数据库
    await tradesDB.open();
    
    // 从 localStorage 迁移数据
    await tradesDB.migrateFromLocalStorage();
    
    // 加载交易记录
    await loadTrades();

    // 初始化 UI（异步：从 SQLite 读取最新股票清单）
    await populateDatalist();
    
    // 为主画面单笔输入的交易单价添加数字键盘
    if (window.NumericKeypad) {
      const priceInputToggleBtn = document.getElementById('priceInputToggleBtn');
      const priceInputKeypad = document.getElementById('priceInputKeypad');
      
      if (priceInputToggleBtn && priceInputKeypad) {
        priceInputToggleBtn.innerHTML = window.NumericKeypad.generateToggleIconHTML();
        priceInputKeypad.innerHTML = window.NumericKeypad.generateKeypadHTML();
        
        const toggleBtn = priceInputToggleBtn.firstElementChild;
        const onEnter = () => {
          if (addBtn) addBtn.click();
        };
        window.NumericKeypad.bindEvents(priceInput, priceInputKeypad, toggleBtn, onEnter);
      }
    }
    
    // 为主画面单价输入框添加Enter键事件：按Enter自动触发新增按钮
    if (priceInput && addBtn) {
      priceInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          addBtn.click();
        }
      });
    }
    
    // 根据当前模式渲染对应的视图
    if (currentTableMode === 'stock') {
      await renderStockModeTable();
    } else {
      renderTrades();
    }
    
    // 初始化筛选功能
    initFilters();

    // 初始化手动配对模态（按钮在每个股票的按钮组中创建）
    initManualPairModal();
    // 初始化配对记录查看器
    initPairingsViewer();
    
    // 添加事件监听器 - 单笔输入
    addBtn.addEventListener('click', async () => {
      const stockName = (stockInput.value || '').trim();
      if (!stockName) { alert('请选择或输入股票'); return; }
      const stockInfo = findStockByName(stockName);
      if (!stockInfo) { alert('未在清单找到该股票，请从下拉选择可用股票。'); return; }
      const side = sideSelect.value === 'sell' ? 'sell' : 'buy';
      const price = Number(priceInput.value) || 0;
      if (price <= 0) { alert('请输入有效单价'); return; }
      
      // 获取备注信息
      const remark = (remarkInput.value || '').trim();

      const qty = stockInfo.qty;
      const amount = qty * price;
      const now = new Date();
      const t = {
        id: generateId(),
        date: now.toISOString().slice(0,10),
        createdAt: now.toISOString(), // 记录具体时间（ISO格式）
        market: stockInfo.market,
        stock: stockInfo.name,
        side,
        qty,
        price,
        amount,
        remark
      };
      
      try {
        await tradesDB.save(t);
        // 保持已有配对结果：新增交易不应自动删除数据库中的配对资料
        
        await loadTrades();
        await applyFilters();
        // reset inputs
        stockInput.value = '';
        priceInput.value = '';
        remarkInput.value = '';
      } catch (error) {
        console.error('保存交易记录失败:', error);
        alert('保存交易记录失败: ' + error.message);
      }
    });
    
    // 添加事件监听器 - 多笔输入
    addBatchBtn.addEventListener('click', async () => {
      const stockName = (batchStockInput.value || '').trim();
      if (!stockName) { alert('请选择或输入股票'); return; }
      
      const stockInfo = findStockByName(stockName);
      if (!stockInfo) { alert('未在清单找到该股票，请从下拉选择可用股票。'); return; }
      
      const inputText = batchInput.value.trim();
      if (!inputText) { alert('请输入多笔交易内容'); return; }
      
      // 解析多笔交易
      const parsedTrades = parseBatchInput(inputText);
      if (parsedTrades.length === 0) { alert('没有解析到有效的交易记录'); return; }
      
      const qty = stockInfo.qty;
      const date = new Date().toISOString().slice(0,10);
      
      try {
        // 批量保存交易
        for (const parsedTrade of parsedTrades) {
          const now = new Date();
          const amount = qty * parsedTrade.price;
          const trade = {
            id: generateId(),
            date,
            createdAt: now.toISOString(),
            market: stockInfo.market,
            stock: stockInfo.name,
            side: parsedTrade.side,
            qty,
            price: parsedTrade.price,
            amount,
            remark: parsedTrade.remark
          };
          await tradesDB.save(trade);
        }
        
        // 保持已有配对结果：批量新增交易不应自动删除数据库中的配对资料
        
        // 更新数据和UI
        await loadTrades();
        await applyFilters();
        
        // 清空输入
        batchInput.value = '';
        // 聚焦到股票输入框
        batchStockInput.focus();
        
        alert(`成功添加 ${parsedTrades.length} 笔交易`);
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    });
    
    // 添加模式切换事件监听器 - 按钮版本
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        switchInputMode(mode);
        
        // 更新按钮激活状态
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });
    
    // 添加事件监听器 - 多笔多股输入
    addMultiStockBtn.addEventListener('click', async () => {
      const inputText = multiStockInput.value.trim();
      if (!inputText) { alert('请输入交易内容'); return; }
      
      // 解析多笔多股交易
      const parsedTrades = parseMultiStockInput(inputText);
      if (parsedTrades.length === 0) { alert('没有解析到有效的交易记录'); return; }
      
      const date = new Date().toISOString().slice(0,10);
      
      try {
        // 批量保存交易
        const affectedStocks = new Set();
        for (const parsedTrade of parsedTrades) {
          const now = new Date();
          const stockInfo = parsedTrade.stockInfo;
          const amount = stockInfo.qty * parsedTrade.price;
          const trade = {
            id: generateId(),
            date,
            createdAt: now.toISOString(),
            market: stockInfo.market,
            stock: stockInfo.name,
            side: parsedTrade.side,
            qty: stockInfo.qty,
            price: parsedTrade.price,
            amount,
            remark: parsedTrade.remark
          };
          await tradesDB.save(trade);
          // 记录受影响的股票
          affectedStocks.add(stockInfo.name);
        }
        
        // 保持已有配对结果：多股票新增不应自动删除数据库中的配对资料
        // 如果需要强制使配对重新计算，可以提供显式按钮触发重新配对。
        
        // 更新数据和UI
        await loadTrades();
        await applyFilters();
        
        // 清空输入
        multiStockInput.value = '';
        
        alert(`成功添加 ${parsedTrades.length} 笔交易`);
      } catch (err) {
        alert('保存失败: ' + err.message);
      }
    });
    
    // 添加事件监听器 - 多笔多股多日期输入
    if (addMultiStockMultiDateBtn) {
      addMultiStockMultiDateBtn.addEventListener('click', async () => {
        const inputText = multiStockMultiDateInput.value.trim();
        if (!inputText) { alert('请输入交易内容'); return; }
        
        // 解析多笔多股多日期交易
        const parsedTrades = parseMultiStockMultiDateInput(inputText);
        if (parsedTrades.length === 0) { alert('没有解析到有效的交易记录'); return; }
        
        try {
          // 批量保存交易
          const affectedStocks = new Set();
          for (const parsedTrade of parsedTrades) {
            const now = new Date();
            const stockInfo = parsedTrade.stockInfo;
            const amount = parsedTrade.qty * parsedTrade.price;
            const trade = {
              id: generateId(),
              date: parsedTrade.date,
              createdAt: now.toISOString(),
              market: stockInfo.market,
              stock: stockInfo.name,
              side: parsedTrade.side,
              qty: parsedTrade.qty,
              price: parsedTrade.price,
              amount,
              remark: parsedTrade.remark
            };
            await tradesDB.save(trade);
            // 记录受影响的股票
            affectedStocks.add(stockInfo.name);
          }
          
          // 保持已有配对结果：多股票多日期新增不应自动删除数据库中的配对资料
          
          // 更新数据和UI
          await loadTrades();
          await applyFilters();
          
          // 清空输入
          multiStockMultiDateInput.value = '';
          
          alert(`成功添加 ${parsedTrades.length} 笔交易`);
        } catch (err) {
          alert('保存失败: ' + err.message);
        }
      });
    }
    
    // 添加事件监听器 - 表格模式切换
    if (tableModeDetail) {
      tableModeDetail.addEventListener('click', () => {
        // 切换到详细模式
        currentTableMode = 'detail';
        window.currentTableMode = currentTableMode;
        tableModeDetail.classList.add('active');
        if (tableModeStock) tableModeStock.classList.remove('active');
        // 隐藏股票模式工具条
        if (stockModeToolbar) stockModeToolbar.style.display = 'none';
        // 重置切换按钮状态
        if (toggleAllStocksBtn) toggleAllStocksBtn.textContent = '折叠所有股票';
        renderTrades();
      });
    }
    
    if (tableModeStock) {
      tableModeStock.addEventListener('click', async () => {
        // 切换到股票模式
        currentTableMode = 'stock';
        window.currentTableMode = currentTableMode;
        tableModeStock.classList.add('active');
        if (tableModeDetail) tableModeDetail.classList.remove('active');
        // 显示股票模式工具条
        if (stockModeToolbar) stockModeToolbar.style.display = 'flex';
        // 重置切换按钮状态
        if (toggleAllStocksBtn) toggleAllStocksBtn.textContent = '折叠所有股票';
        await renderStockModeTable();
      });
    }
    
    // 折叠/展开所有股票按钮（切换按钮）
    if (toggleAllStocksBtn) {
      let allStocksCollapsed = false;
      
      toggleAllStocksBtn.addEventListener('click', () => {
        if (allStocksCollapsed) {
          // 展开所有股票
          const collapseHandles = document.querySelectorAll('.stock-collapse-handle');
          collapseHandles.forEach(handle => {
            handle.click();
          });
          toggleAllStocksBtn.textContent = '折叠所有股票';
          allStocksCollapsed = false;
        } else {
          // 折叠所有股票
          const collapseBtns = document.querySelectorAll('.collapse-stock-btn');
          collapseBtns.forEach(btn => {
            btn.click();
          });
          toggleAllStocksBtn.textContent = '展开所有股票';
          allStocksCollapsed = true;
        }
      });
    }
    
    // 全部自动配对(最小)按钮 - 逐个股票执行自动配对(最小)
    const autoPairAllMinBtn = document.getElementById('autoPairAllMinBtn');
    if (autoPairAllMinBtn) {
      autoPairAllMinBtn.addEventListener('click', async () => {
        if (!confirm('确定要对所有股票执行 auto配对(最小) 吗？\n\n系统将逐个处理每个股票的未配对交易。')) {
          return;
        }
        
        // 获取所有唯一的股票名称
        const allStockNames = [...new Set(trades.map(t => t.stock))];
        
        if (allStockNames.length === 0) {
          alert('没有找到任何股票数据');
          return;
        }
        
        console.log(`开始执行 auto配对(最小)，共 ${allStockNames.length} 个股票`);
        
        let totalPaired = 0;
        let skippedStocks = 0;
        const results = [];
        
        for (let i = 0; i < allStockNames.length; i++) {
          const stockName = allStockNames[i];
          
          try {
            // 获取该股票的所有交易（所有日期），并转为数字价格
            const stockAllTrades = trades.filter(t => t.stock === stockName).map(t => ({...t, price: Number(t.price)}));
            if (stockAllTrades.length === 0) {
              continue;
            }

            // 读取已有配对，排除已配对交易
            const existing = pairingCache[stockName] || {};
            const existingBuyIds = new Set(existing.pairedBuyIds || []);
            const existingSellIds = new Set(existing.pairedSellIds || []);

            const unpairedBuys = stockAllTrades.filter(t => t.side === 'buy' && !existingBuyIds.has(t.id));
            const unpairedSells = stockAllTrades.filter(t => t.side === 'sell' && !existingSellIds.has(t.id));

            if (unpairedBuys.length === 0 || unpairedSells.length === 0) {
              skippedStocks++;
              continue;
            }

            // 使用利润最小化配对算法进行配对（只会返回有利润的配对）
            const pairingResult = findBestPairsMinimized(unpairedBuys, unpairedSells, stockName);
            if (!pairingResult || !pairingResult.pairedTrades || pairingResult.pairedTrades.length === 0) {
              skippedStocks++;
              continue;
            }

            // 保留原有配对，只追加新配对
            pairingCache[stockName] = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
            const existingPairedTrades = pairingCache[stockName].pairedTrades || [];
            const existingPairedBuyIds = pairingCache[stockName].pairedBuyIds || [];
            const existingPairedSellIds = pairingCache[stockName].pairedSellIds || [];

            // 追加新配对到原有配对中
            pairingCache[stockName] = {
              pairedTrades: [...existingPairedTrades, ...pairingResult.pairedTrades],
              pairedBuyIds: [...existingPairedBuyIds, ...pairingResult.pairedTrades.map(p => p.buy.id)],
              pairedSellIds: [...existingPairedSellIds, ...pairingResult.pairedTrades.map(p => p.sell.id)]
            };

            // 保存到数据库
            await tradesDB.savePairing({
              stockName: stockName,
              pairedTrades: pairingCache[stockName].pairedTrades,
              pairedBuyIds: pairingCache[stockName].pairedBuyIds,
              pairedSellIds: pairingCache[stockName].pairedSellIds
            });

            totalPaired += pairingResult.pairedTrades.length;
            results.push({ stock: stockName, pairedCount: pairingResult.pairedTrades.length, status: '✅ 成功' });
            
          } catch (err) {
            console.error(`处理股票 ${stockName} 时出错:`, err);
            results.push({ stock: stockName, pairedCount: 0, status: `❌ 错误: ${err.message}` });
            skippedStocks++;
          }
        }
        
        // 重新渲染表格以显示更新后的配对状态
        await renderStockModeTable();
        
        // 显示结果摘要
        let summary = `✅ auto配对(最小) 执行完成！\n\n`;
        summary += `📊 处理结果：\n`;
        summary += `• 总计处理股票：${allStockNames.length} 个\n`;
        summary += `• 成功配对笔数：${totalPaired} 笔\n`;
        summary += `• 跳过股票数：${skippedStocks} 个（无未配对交易或无法配对）\n\n`;
        summary += `📋 详细结果：\n`;
        
        results.forEach(r => {
          summary += `${r.status} | ${r.stock}: ${r.pairedCount} 笔配对\n`;
        });
        
        alert(summary);
        console.log('auto配对(最小)完成:', { totalPaired, skippedStocks, results });
      });
    }
    
    // 股票下拉选单 - 滚动到所选股票
    if (stockJumpSelect) {
      stockJumpSelect.addEventListener('change', () => {
        const selectedStock = stockJumpSelect.value;
        if (!selectedStock) return;
        
        // 构建股票行的ID
        const stockRowId = `stock-row-${selectedStock.replace(/\s+/g, '-').toLowerCase()}`;
        const stockRow = document.getElementById(stockRowId);
        
        if (stockRow) {
          // 滚动到股票行
          stockRow.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'center'
          });
          
          // 高亮显示股票行（可选）
          stockRow.style.backgroundColor = '#fff3cd';
          setTimeout(() => {
            stockRow.style.backgroundColor = '';
          }, 1000);
        }
      });
    }
    
    // 屏蔽气泡checkbox事件监听器
    if (hideHideableBubblesCheckbox) {
      hideHideableBubblesCheckbox.addEventListener('change', () => {
        hideHideableBubbles = hideHideableBubblesCheckbox.checked;
        // 重新渲染股票模式表格
        renderStockModeTable();
      });
    }
    
    // 只显示当天股票checkbox事件监听器
    if (showOnlyFilterDateStocksCheckbox) {
      showOnlyFilterDateStocksCheckbox.addEventListener('change', async (e) => {
        // 检查是否设定了筛选日期
        const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
        if (showOnlyFilterDateStocksCheckbox.checked && !filterDate) {
          // 自动设定当天日期为筛选日期
          const today = new Date();
          const year = today.getFullYear();
          const month = String(today.getMonth() + 1).padStart(2, '0');
          const day = String(today.getDate()).padStart(2, '0');
          const todayDate = `${year}-${month}-${day}`;
          
          if (filterDateInput) {
            filterDateInput.value = todayDate;
          }
        }
        
        showOnlyFilterDateStocks = showOnlyFilterDateStocksCheckbox.checked;
        
        // 控制紧凑模式按钮的显示
        const compactModeBtn = document.getElementById('openCompactModeBtn');
        if (compactModeBtn) {
          const currentFilterDate = filterDateInput ? filterDateInput.value.trim() : '';
          compactModeBtn.style.display = currentFilterDate ? 'inline-block' : 'none';
        }
        
        // 更新跳转到股票下拉选单
        await updateStockJumpSelect();
        await applyFilters();
        // 重新渲染股票模式表格
        renderStockModeTable();
      });
    }
    
    // 紧凑模式按钮事件监听器
    const compactModeBtn = document.getElementById('openCompactModeBtn');
    if (compactModeBtn) {
      compactModeBtn.addEventListener('click', () => {
        if (window.openCompactDataExportWindow) {
          window.openCompactDataExportWindow();
        }
      });
    }
    
    // 添加事件监听器 - 文本模式配对关系模式
    if (textModePairing) {
      textModePairing.addEventListener('click', async () => {
        // 检查是否设置了筛选日期
        const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
        if (!filterDate) {
          alert('配对关系模式只有在设定了筛选日期时有效，请先设定日期！');
          return;
        }
        
        // 更新按钮状态
        textModePairing.classList.add('active');
        if (textModeNormal) textModeNormal.classList.remove('active');
        
        // 渲染配对关系模式文本输出
        await renderPairingModeTextView();
      });
    }
    
    // 添加事件监听器 - 文本模式普通模式
    if (textModeNormal) {
      textModeNormal.addEventListener('click', () => {
        // 更新按钮状态
        textModeNormal.classList.add('active');
        if (textModePairing) textModePairing.classList.remove('active');
        
        // 渲染普通模式文本输出
        renderTextView();
      });
    }
    
  } catch (error) {
    console.error('pureClientA 初始化失败:', error);
    alert('应用初始化失败: ' + error.message);
  }
}

// 多笔交易解析函数
function parseBatchInput(input) {
  // 移除所有多余空格，保留一个空格作为分隔符
  const normalizedInput = input.replace(/\s+/g, ' ').trim();
  
  // 使用正则表达式匹配每笔交易
  // 匹配模式：[+-]?\d+(\.\d+)?\s*[\(（]?([^\)）]+)?[\)）]?
  const tradeRegex = /([+-]?\d+(?:\.\d+)?)(?:\s*[\(（]([^\)）]+)[\)）])?/g;
  
  const trades = [];
  let match;
  
  while ((match = tradeRegex.exec(normalizedInput)) !== null) {
    const fullMatch = match[0];
    const priceStr = match[1];
    let remark = match[2] || '';
    
    // 清理备注
    remark = remark.trim();
    
    // 确定交易方向
    const isSell = priceStr.startsWith('-');
    // 提取纯价格数字
    const price = parseFloat(priceStr.replace(/^[+-]/, ''));
    
    // 验证价格有效性
    if (isNaN(price) || price <= 0) continue;
    
    trades.push({
      price: price,
      side: isSell ? 'sell' : 'buy',
      remark: remark
    });
  }
  
  return trades;
}

// 切换输入模式
function switchInputMode(mode) {
  currentInputMode = mode;
  
  // 更新UI
  switch (currentInputMode) {
    case 'single':
      // 显示单笔输入，隐藏其他
      singleInputMode.style.display = 'grid';
      batchInputMode.style.display = 'none';
      multiStockInputMode.style.display = 'none';
      if (multiStockMultiDateInputMode) multiStockMultiDateInputMode.style.display = 'none';
      break;
    case 'batch':
      // 显示多笔输入，隐藏其他
      singleInputMode.style.display = 'none';
      batchInputMode.style.display = 'grid';
      multiStockInputMode.style.display = 'none';
      if (multiStockMultiDateInputMode) multiStockMultiDateInputMode.style.display = 'none';
      break;
    case 'multiStock':
      // 显示多笔多股输入，隐藏其他
      singleInputMode.style.display = 'none';
      batchInputMode.style.display = 'none';
      multiStockInputMode.style.display = 'grid';
      if (multiStockMultiDateInputMode) multiStockMultiDateInputMode.style.display = 'none';
      // 自动填充默认的股票列表到多行多股输入框
      populateMultiStockInput();
      break;
    case 'multiStockMultiDate':
      // 显示多笔多股多日期输入，隐藏其他
      singleInputMode.style.display = 'none';
      batchInputMode.style.display = 'none';
      multiStockInputMode.style.display = 'none';
      if (multiStockMultiDateInputMode) multiStockMultiDateInputMode.style.display = 'grid';
      break;
  }
}

// 自动填充多笔多股输入框的默认股票列表
function populateMultiStockInput() {
  if (!multiStockInput) return;
  
  // 使用 window.STOCKS 以支持动态切换
  const stocks = window.STOCKS;
  
  // 按市场分组股票
  const taiwanStocks = stocks.filter(s => s.market === '台股');
  const chinaStocks = stocks.filter(s => s.market === '陆股');
  
  // 生成默认文本
  let defaultText = "台股：\n";
  taiwanStocks.forEach(stock => {
    defaultText += `${stock.name}\n`;
  });
  
  defaultText += "\n陆股：\n";
  chinaStocks.forEach(stock => {
    defaultText += `${stock.name}\n`;
  });
  
  // 如果输入框为空，则填充默认文本
  if (!multiStockInput.value.trim()) {
    multiStockInput.value = defaultText;
  }
}

// 多笔多股交易解析函数
function parseMultiStockInput(input) {
  const trades = [];
  
  // 按行分割
  const lines = input.split('\n');
  
  // 标记当前市场
  let currentMarket = null;
  
  lines.forEach(line => {
    // 跳过空行
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    
    // 检查是否为市场标记行
    if (trimmedLine === '台股：' || trimmedLine === '台股:') {
      currentMarket = '台股';
      return;
    }
    if (trimmedLine === '陆股：' || trimmedLine === '陆股:') {
      currentMarket = '陆股';
      return;
    }
    
    // 解析股票和交易价格
    // 格式：股票名称 价格1 -价格2 价格3...
    const parts = trimmedLine.split(/\s+/);
    if (parts.length < 1) return;
    
    // 提取股票名称
    const stockName = parts[0];
    const stockInfo = findStockByName(stockName);
    
    // 如果没找到股票，尝试从当前市场的股票中匹配（忽略市场限制）
    if (!stockInfo) {
      // 尝试从所有股票中查找
      const stocksForParse = window.STOCKS;
      const allStockInfo = stocksForParse.find(s => s.name === stockName);
      if (allStockInfo) {
        stockInfo = allStockInfo;
      } else {
        // 跳过未知股票
        return;
      }
    }
    
    // 提取价格部分
    const priceParts = parts.slice(1);
    if (priceParts.length === 0) return;
    
    // 解析每个价格
    priceParts.forEach(pricePart => {
      // 跳过空价格
      if (!pricePart.trim()) return;
      
      // 确定交易方向
      const isSell = pricePart.startsWith('-');
      // 提取纯价格数字
      const price = parseFloat(pricePart.replace(/^[+-]/, ''));
      
      // 验证价格有效性
      if (isNaN(price) || price <= 0) return;
      
      trades.push({
        stockInfo,
        price,
        side: isSell ? 'sell' : 'buy',
        remark: ''
      });
    });
  });
  
  return trades;
}

// 多笔多股多日期交易解析函数
function parseMultiStockMultiDateInput(input) {
  const trades = [];
  
  // 按行分割
  const lines = input.split('\n');
  
  // 标记当前市场
  let currentMarket = null;
  
  lines.forEach(line => {
    // 跳过空行
    const trimmedLine = line.trim();
    if (!trimmedLine) return;
    
    // 检查是否为市场标记行
    if (trimmedLine === '台股：' || trimmedLine === '台股:') {
      currentMarket = '台股';
      return;
    }
    if (trimmedLine === '陆股：' || trimmedLine === '陆股:') {
      currentMarket = '陆股';
      return;
    }
    
    // 解析股票和交易价格
    // 格式：股票名称 价格1(日期,数量) -价格2(日期,数量) 价格3(日期,数量)...
    const parts = trimmedLine.split(/\s+/);
    if (parts.length < 1) return;
    
    // 提取股票名称
    const stockName = parts[0];
    const stockInfo = findStockByName(stockName);
    
    // 如果没找到股票，尝试从当前市场的股票中匹配（忽略市场限制）
    if (!stockInfo) {
      // 尝试从所有股票中查找
      const stocksForMultiDate = window.STOCKS;
      const allStockInfo = stocksForMultiDate.find(s => s.name === stockName);
      if (allStockInfo) {
        stockInfo = allStockInfo;
      } else {
        // 跳过未知股票
        return;
      }
    }
    
    // 提取价格部分
    const priceParts = parts.slice(1);
    if (priceParts.length === 0) return;
    
    // 解析每个价格
    priceParts.forEach(pricePart => {
      // 跳过空价格
      if (!pricePart.trim()) return;
      
      // 正则表达式匹配价格和日期数量
      // 格式：价格(日期,数量) 或 -价格(日期,数量)
      const match = pricePart.match(/^([+-]?\d+(?:\.\d+)?)(?:\(([^,]+),(\d+)\))?$/);
      if (!match) return;
      
      // 提取价格、日期和数量
      const priceStr = match[1];
      const date = match[2] || new Date().toISOString().slice(0,10);
      const qty = match[3] ? parseInt(match[3]) : stockInfo.qty;
      
      // 确定交易方向
      const isSell = priceStr.startsWith('-');
      // 提取纯价格数字
      const price = parseFloat(priceStr.replace(/^[+-]/, ''));
      
      // 验证价格和数量有效性
      if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) return;
      
      trades.push({
        stockInfo,
        price,
        side: isSell ? 'sell' : 'buy',
        date,
        qty,
        remark: ''
      });
    });
  });
  
  return trades;
}

// 显示交易详情
// 调用bubbleDetail.js中的showTradeDetail函数
function showTradeDetailWrapper(trade, source) {
  // 优先使用 bubbleDetail.js 导出的原始实现，避免被 app 中同名函数覆盖
  if (window._bubble_showTradeDetail) {
    try {
      window._bubble_showTradeDetail(trade, source);
      return;
    } catch (err) {
      console.error('调用 _bubble_showTradeDetail 失败:', err);
    }
  }

  // 退回到全局的 showTradeDetail（若存在且不是本文件的 wrapper）
  if (window.showTradeDetail && window.showTradeDetail !== showTradeDetail) {
    try {
      window.showTradeDetail(trade, source);
      return;
    } catch (err) {
      console.error('调用 window.showTradeDetail 失败:', err);
    }
  }

  console.error('bubbleDetail.js 未加载或实现不可用，无法显示交易详情');
}

// 重命名原始函数以避免冲突
function showTradeDetail(trade, source) {
  showTradeDetailWrapper(trade, source);
}

// 显示配对利润核算（使用模态框）
function showPairDetail(pair, stockName) {
  if (!pair || !stockName) return;
  
  const stocksForPair = window.STOCKS;
  const stockData = stocksForPair.find(s => s.name === stockName);
  const type = stockData ? stockData.type : '';
  const taxRate = TAX_RATES[type];
  
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const bubbleDetailModal = document.getElementById('bubbleDetailModal');
  
  modalTitle.textContent = `${stockName}(${pair.buy.qty}, ${type}) - 配对利润核算`;
  
  const buyAmount = pair.buy.price * pair.buy.qty;
  const sellAmount = pair.sell.price * pair.sell.qty;
  const buyTax = calculateTax(stockName, 'buy', buyAmount);
  const sellTax = calculateTax(stockName, 'sell', sellAmount);
  const grossProfit = sellAmount - buyAmount;
  const netProfit = grossProfit - buyTax - sellTax;
  
  const bodyContent = `
    <div class="pair-detail-section">
      <h4 class="pair-detail-title">买入信息</h4>
      <div class="detail-item">
        <span class="detail-label">买入价格：</span>
        <span class="detail-value trade-side-buy">${pair.buy.price}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入数量：</span>
        <span class="detail-value">${pair.buy.qty}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入金额：</span>
        <span class="detail-value">${buyAmount}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入日期：</span>
        <span class="detail-value">${pair.buy.date || ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入时间：</span>
        <span class="detail-value">${pair.buy.createdAt ? formatDateTime(pair.buy.createdAt) : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入税费率：</span>
        <span class="detail-value">${taxRate ? taxRate.buy : 0}‱</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入税费：</span>
        <span class="detail-value">${buyTax.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="pair-detail-section">
      <h4 class="pair-detail-title">卖出信息</h4>
      <div class="detail-item">
        <span class="detail-label">卖出价格：</span>
        <span class="detail-value trade-side-sell">${pair.sell.price}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出数量：</span>
        <span class="detail-value">${pair.sell.qty}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出金额：</span>
        <span class="detail-value">${sellAmount}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出日期：</span>
        <span class="detail-value">${pair.sell.date || ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出时间：</span>
        <span class="detail-value">${pair.sell.createdAt ? formatDateTime(pair.sell.createdAt) : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出税费率：</span>
        <span class="detail-value">${taxRate ? taxRate.sell : 0}‱</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出税费：</span>
        <span class="detail-value">${sellTax.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="pair-detail-section pair-profit-section">
      <h4 class="pair-detail-title">利润核算</h4>
      <div class="detail-item">
        <span class="detail-label">毛利润（卖出-买入）：</span>
        <span class="detail-value ${grossProfit >= 0 ? 'net-positive' : 'net-negative'}">${grossProfit.toFixed(2)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">总税费（买入+卖出）：</span>
        <span class="detail-value">-${(buyTax + sellTax).toFixed(2)}</span>
      </div>
      <div class="detail-item profit-total">
        <span class="detail-label">净利润：</span>
        <span class="detail-value ${netProfit >= 0 ? 'net-positive' : 'net-negative'}">${netProfit.toFixed(2)}</span>
      </div>
    </div>
  `;
  
  modalBody.innerHTML = bodyContent;
  // 确保配对利润核算模态框位于所有 FloatingWindow 之上
  try {
    bubbleDetailModal.style.zIndex = '1000001';
    const modalContentEl = bubbleDetailModal.querySelector('.modal-content');
    if (modalContentEl) modalContentEl.style.zIndex = '1000002';
  } catch (err) {
    console.warn('设置 bubbleDetailModal zIndex 时出错', err);
  }

  bubbleDetailModal.style.display = 'block';
}

// showPairDetailWithFloatingWindow 函数已移至 pairDetailPlugin.js 文件中定义

// 格式化日期时间
function formatDateTime(dateString) {
  const createdAt = new Date(dateString);
  return createdAt.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    millisecond: '3-digit'
  });
}

// 初始化模态框事件
function initModal() {
  const bubbleDetailModal = document.getElementById('bubbleDetailModal');
  const closeModalBtn = document.getElementById('closeModalBtn');
  
  // 关闭按钮事件
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', () => {
      bubbleDetailModal.style.display = 'none';
    });
  }
  
  // 点击模态框外部关闭
  if (bubbleDetailModal) {
    bubbleDetailModal.addEventListener('click', (event) => {
      if (event.target === bubbleDetailModal) {
        bubbleDetailModal.style.display = 'none';
      }
    });
  }
}

// 初始化配对记录查看器 - 使用pairingsViewer.js中定义的函数
// 此处不重复定义，避免覆盖pairingsViewer.js中的实现



// 手动配对相关变量
let manualPairingState = {
  currentStock: null,
  buyTrade: null,
  sellTrade: null
};

// 打开手动配对模态框
function openManualPairingModal(stockName) {
  const manualPairingContainer = document.getElementById('manualPairingContainer');
  const buyDropContent = document.getElementById('buyDropContent');
  const sellDropContent = document.getElementById('sellDropContent');
  
  // 设置当前股票
  manualPairingState.currentStock = stockName;
  manualPairingState.buyTrade = null;
  manualPairingState.sellTrade = null;
  
  // 清空拖放区域
  if (buyDropContent) {
    buyDropContent.innerHTML = '<div class="drop-zone-placeholder">拖入买入交易</div>';
  }
  if (sellDropContent) {
    sellDropContent.innerHTML = '<div class="drop-zone-placeholder">拖入卖出交易</div>';
  }
  
  // 显示模态框
  if (manualPairingContainer) {
    manualPairingContainer.classList.add('show');
  }
  
  // 初始化拖放功能
  initDragAndDrop();
}

// 关闭手动配对模态框
function closeManualPairingModal() {
  const manualPairingContainer = document.getElementById('manualPairingContainer');
  if (manualPairingContainer) {
    manualPairingContainer.classList.remove('show');
  }
  
  // 清空状态
  manualPairingState.currentStock = null;
  manualPairingState.buyTrade = null;
  manualPairingState.sellTrade = null;
}

// 初始化拖放功能
function initDragAndDrop() {
  const buyDropZone = document.getElementById('buyDropZone');
  const sellDropZone = document.getElementById('sellDropZone');
  
  if (!buyDropZone || !sellDropZone) return;
  
  // 为所有价格气泡添加拖拽功能
  const priceBubbles = document.querySelectorAll('.price-bubble');
  priceBubbles.forEach(bubble => {
    if (!bubble.classList.contains('draggable')) {
      bubble.classList.add('draggable');
      bubble.draggable = true;
      
      bubble.addEventListener('dragstart', handleDragStart);
      bubble.addEventListener('dragend', handleDragEnd);
    }
  });
  
  // 为买入区域添加拖放事件
  buyDropZone.addEventListener('dragover', handleDragOver);
  buyDropZone.addEventListener('dragleave', handleDragLeave);
  buyDropZone.addEventListener('drop', (e) => handleDrop(e, 'buy'));
  
  // 为卖出区域添加拖放事件
  sellDropZone.addEventListener('dragover', handleDragOver);
  sellDropZone.addEventListener('dragleave', handleDragLeave);
  sellDropZone.addEventListener('drop', (e) => handleDrop(e, 'sell'));
}

// 拖拽开始
function handleDragStart(e) {
  e.dataTransfer.setData('text/plain', JSON.stringify({
    id: e.target.dataset.tradeId,
    price: e.target.dataset.price,
    side: e.target.dataset.side,
    stock: e.target.dataset.stock,
    date: e.target.dataset.date,
    remark: e.target.dataset.remark
  }));
  e.target.classList.add('dragging');
}

// 拖拽结束
function handleDragEnd(e) {
  e.target.classList.remove('dragging');
}

// 拖拽经过
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

// 拖拽离开
function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

// 拖拽放置
function handleDrop(e, zoneType) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  
  const data = e.dataTransfer.getData('text/plain');
  if (!data) return;
  
  const tradeData = JSON.parse(data);
  
  // 验证股票是否匹配
  if (tradeData.stock !== manualPairingState.currentStock) {
    alert('只能拖入同一股票的交易！');
    return;
  }
  
  // 验证交易方向是否匹配
  if (zoneType === 'buy' && tradeData.side !== 'buy') {
    alert('买入区域只能拖入买入交易！');
    return;
  }
  if (zoneType === 'sell' && tradeData.side !== 'sell') {
    alert('卖出区域只能拖入卖出交易！');
    return;
  }
  
  // 查找完整的交易记录
  const fullTrade = trades.find(t => t.id === tradeData.id);
  if (!fullTrade) return;
  
  // 更新状态
  if (zoneType === 'buy') {
    manualPairingState.buyTrade = fullTrade;
  } else {
    manualPairingState.sellTrade = fullTrade;
  }
  
  // 更新UI
  updateDropZoneUI(zoneType, fullTrade);
}

// 更新拖放区域UI
function updateDropZoneUI(zoneType, trade) {
  const dropContent = document.getElementById(zoneType === 'buy' ? 'buyDropContent' : 'sellDropContent');
  if (!dropContent) return;
  
  const sideText = trade.side === 'buy' ? '买入' : '卖出';
  const priceClass = trade.side === 'buy' ? 'buy' : 'sell';
  
  dropContent.innerHTML = `
    <div class="draggable-trade ${trade.side}" data-trade-id="${trade.id}">
      <div class="draggable-trade-info">
        <span class="draggable-trade-price ${priceClass}">${trade.price}</span>
        <span class="draggable-trade-date">${trade.date}</span>
      </div>
      ${trade.remark ? `<div class="draggable-trade-remark">${trade.remark}</div>` : ''}
    </div>
  `;
}

// 建立配对
async function createManualPair() {
  if (!manualPairingState.buyTrade || !manualPairingState.sellTrade) {
    alert('请先拖入一笔买入交易和一笔卖出交易！');
    return;
  }
  
  const buyTrade = manualPairingState.buyTrade;
  const sellTrade = manualPairingState.sellTrade;
  const stock = buyTrade.stock;
  
  try {
    const existing = await tradesDB.getPairing(stock);
    
    const newPair = { buy: buyTrade, sell: sellTrade, profit: 0 };

    const updated = existing ? JSON.parse(JSON.stringify(existing)) : { 
      stockName: stock, 
      pairedTrades: [],
      pairedBuyIds: [],
      pairedSellIds: []
    };

    // 使用统一的配对结构
    updated.pairedTrades = updated.pairedTrades || [];
    updated.pairedBuyIds = updated.pairedBuyIds || [];
    updated.pairedSellIds = updated.pairedSellIds || [];
    
    // 添加新配对
    updated.pairedTrades.push(newPair);
    updated.pairedBuyIds.push(buyTrade.id);
    updated.pairedSellIds.push(sellTrade.id);

    await tradesDB.savePairing(updated);
    pairingCache[stock] = {
      pairedTrades: updated.pairedTrades,
      pairedBuyIds: updated.pairedBuyIds,
      pairedSellIds: updated.pairedSellIds
    };

    alert('配对成功！');
    
    closeManualPairingModal();
    
    await loadTrades();
    renderBubbleView();
  } catch (error) {
    console.error('配对失败:', error);
    alert('配对失败: ' + error.message);
  }
}

// 解除配对
async function removeManualPair() {
  if (!manualPairingState.buyTrade || !manualPairingState.sellTrade) {
    alert('请先拖入一笔买入交易和一笔卖出交易！');
    return;
  }
  
  const buyTrade = manualPairingState.buyTrade;
  const sellTrade = manualPairingState.sellTrade;
  const stock = buyTrade.stock;
  
  try {
    const existing = await tradesDB.getPairing(stock);
    if (!existing) {
      alert('没有配对记录');
      return;
    }

    // 使用统一的配对结构
    if (existing.pairedTrades && Array.isArray(existing.pairedTrades)) {
      const originalLength = existing.pairedTrades.length;
      existing.pairedTrades = existing.pairedTrades.filter(p =>
        !(p.buy.id === buyTrade.id && p.sell.id === sellTrade.id)
      );
      
      if (existing.pairedTrades.length !== originalLength) {
        // 更新对应的ID数组
        if (existing.pairedBuyIds) {
          existing.pairedBuyIds = existing.pairedBuyIds.filter(id => id !== buyTrade.id);
        }
        if (existing.pairedSellIds) {
          existing.pairedSellIds = existing.pairedSellIds.filter(id => id !== sellTrade.id);
        }

        await tradesDB.savePairing(existing);
        pairingCache[stock] = {
          pairedTrades: existing.pairedTrades || [],
          pairedBuyIds: existing.pairedBuyIds || [],
          pairedSellIds: existing.pairedSellIds || []
        };

        alert('解除配对成功！');
      } else {
        alert('未找到该配对记录');
        return;
      }
    } else {
      alert('未找到该配对记录');
      return;
    }

    closeManualPairingModal();
    
    await loadTrades();
    renderBubbleView();
  } catch (error) {
    console.error('解除配对失败:', error);
    alert('解除配对失败: ' + error.message);
  }
}

// 初始化买卖建议插件
if (typeof BuySellAdvicePlugin !== 'undefined') {
  window.buySellAdvicePlugin = new BuySellAdvicePlugin();
  window.buySellAdvicePlugin.init();
  console.log('买卖建议插件初始化完成');
} else {
  console.error('BuySellAdvicePlugin 未定义，无法初始化买卖建议插件');
}

// 显示配对结果表格
function showPairingResultsTable(stockName, pairedTrades) {
  // 创建模态框元素
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  // 创建模态框内容
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // 创建模态框标题
  const modalTitle = document.createElement('h3');
  modalTitle.textContent = `${stockName} 配对结果 (共 ${pairedTrades.length} 笔)`;
  modalTitle.style.marginTop = '0';
  modalTitle.style.marginBottom = '20px';
  modalContent.appendChild(modalTitle);

  // 创建表格
  const table = document.createElement('table');
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  `;

  // 创建表头
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr style="background-color: #f8f9fa;">
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">配对序号</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">买入价格</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">卖出价格</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">数量</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">买入日期</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">卖出日期</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">利润</th>
    </tr>
  `;
  table.appendChild(thead);

  // 创建表体
  const tbody = document.createElement('tbody');
  
  pairedTrades.forEach((pair, index) => {
    const buyPrice = Number(pair.buy.price);
    const sellPrice = Number(pair.sell.price);
    const qty = Number(pair.buy.qty);
    const profit = (sellPrice - buyPrice) * qty;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="border: 1px solid #dee2e6; padding: 8px;">${index + 1}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px; color: #dc3545;">${buyPrice}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px; color: #28a745;">${sellPrice}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px;">${qty}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px;">${pair.buy.date || ''}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px;">${pair.sell.date || ''}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold; color: ${profit >= 0 ? '#28a745' : '#dc3545'};">${profit.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  modalContent.appendChild(table);

  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    margin-top: 20px;
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  modalContent.appendChild(closeButton);

  // 添加到模态框
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

// 显示被解除的配对结果表格
function showUnpairedResultsTable(stockName, unpairedTrades) {
  // 创建模态框元素
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 10000;
  `;

  // 创建模态框内容
  const modalContent = document.createElement('div');
  modalContent.style.cssText = `
    background-color: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    width: 90%;
    max-width: 800px;
    max-height: 80vh;
    overflow-y: auto;
  `;

  // 创建模态框标题
  const modalTitle = document.createElement('h3');
  modalTitle.textContent = `${stockName} 已解除的当日配对 (共 ${unpairedTrades.length} 笔)`;
  modalTitle.style.marginTop = '0';
  modalTitle.style.marginBottom = '20px';
  modalContent.appendChild(modalTitle);

  // 创建表格
  const table = document.createElement('table');
  table.style.cssText = `
    width: 100%;
    border-collapse: collapse;
    font-size: 14px;
  `;

  // 创建表头
  const thead = document.createElement('thead');
  thead.innerHTML = `
    <tr style="background-color: #f8f9fa;">
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">配对序号</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">买入价格</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">卖出价格</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">数量</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">买入日期</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">卖出日期</th>
      <th style="border: 1px solid #dee2e6; padding: 8px; text-align: left;">利润</th>
    </tr>
  `;
  table.appendChild(thead);

  // 创建表体
  const tbody = document.createElement('tbody');
  
  unpairedTrades.forEach((pair, index) => {
    const buyPrice = Number(pair.buy.price);
    const sellPrice = Number(pair.sell.price);
    const qty = Number(pair.buy.qty);
    const profit = (sellPrice - buyPrice) * qty;
    
    const row = document.createElement('tr');
    row.innerHTML = `
      <td style="border: 1px solid #dee2e6; padding: 8px;">${index + 1}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px; color: #dc3545;">${buyPrice}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px; color: #28a745;">${sellPrice}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px;">${qty}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px;">${pair.buy.date || ''}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px;">${pair.sell.date || ''}</td>
      <td style="border: 1px solid #dee2e6; padding: 8px; font-weight: bold; color: ${profit >= 0 ? '#28a745' : '#dc3545'};">${profit.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });
  
  table.appendChild(tbody);
  modalContent.appendChild(table);

  // 创建关闭按钮
  const closeButton = document.createElement('button');
  closeButton.textContent = '关闭';
  closeButton.style.cssText = `
    margin-top: 20px;
    padding: 10px 20px;
    background-color: #007bff;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
  `;
  closeButton.addEventListener('click', () => {
    document.body.removeChild(modal);
  });
  modalContent.appendChild(closeButton);

  // 添加到模态框
  modal.appendChild(modalContent);
  document.body.appendChild(modal);

  // 点击模态框外部关闭
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  });
}

async function clearAllPairings() {
  try {
    if (!confirm('确定要清空所有配对数据吗？此操作不可恢复！')) {
      return;
    }

    await tradesDB.clearAllPairings();
    pairingCache = {};
    window.pairingCache = pairingCache;
    
    await loadTrades();
    await applyFilters();
    renderBubbleView();
    
    alert('所有配对数据已清空');
  } catch (error) {
    console.error('清空配对数据失败:', error);
    alert('清空配对数据失败: ' + error.message);
  }
}

// 初始化手动配对模态框事件
function initManualPairingModal() {
  const closeManualPairingBtn = document.getElementById('closeManualPairingBtn');
  const createPairBtn = document.getElementById('createPairBtn');
  const removePairBtn = document.getElementById('removePairBtn');
  
  // 关闭按钮
  if (closeManualPairingBtn) {
    closeManualPairingBtn.addEventListener('click', closeManualPairingModal);
  }
  
  // 建立配对按钮
  if (createPairBtn) {
    createPairBtn.addEventListener('click', createManualPair);
  }
  
  // 解除配对按钮
  if (removePairBtn) {
    removePairBtn.addEventListener('click', removeManualPair);
  }
  
  // 点击模态框外部关闭
  const manualPairingContainer = document.getElementById('manualPairingContainer');
  if (manualPairingContainer) {
    manualPairingContainer.addEventListener('click', (event) => {
      if (event.target === manualPairingContainer) {
        closeManualPairingModal();
      }
    });
  }
}

// 暴露给调试
window._loadTrades = loadTrades;
window._applyFilters = applyFilters;

// 初始化应用
init();
// 初始化模态框
initModal();

// ==================== 拖拽配对功能 ====================

// 拖拽配对区域状态
// 修复：移除了对不存在的initAddTradeModal()函数的调用
const dragPairState = {
  items: [],
  collapsed: false
};

// 初始化拖拽配对功能
initDragPairing();

// ==================== 手动配对窗口功能 ====================

// 手动配对窗口状态
const manualPairState = {
  items: [],
  isOpen: false,
  currentStock: null
};

// 初始化手动配对窗口
initManualPairWindow();

function initManualPairWindow() {
  const closeBtn = document.getElementById('closeManualPairWindowBtn');
  const confirmBtn = document.getElementById('confirmManualPairBtn');
  const clearBtn = document.getElementById('clearManualPairBtn');
  const dropZone = document.getElementById('manualPairDropZone');

  // 关闭手动配对窗口
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      const modalEl = document.getElementById('manualPairWindow');
      if (modalEl) {
        modalEl.style.display = 'none';
        manualPairState.isOpen = false;
        manualPairState.items = [];
        manualPairState.currentStock = null;
        updateManualPairWindow();
        // 恢复打开窗口前的滚动位置（如果有保存）
        try {
          if (manualPairState.savedScroll) {
            const { tableScroll, pageY } = manualPairState.savedScroll;
            const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
            if (tableContainer && typeof tableScroll === 'number') tableContainer.scrollTop = tableScroll;
            if (typeof pageY === 'number') window.scrollTo(0, pageY);
          }
        } catch (e) {
          console.error('恢复手动配对窗口前滚动位置失败:', e);
        }
      }
    });
  }

  // 清空按钮
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      manualPairState.items = [];
      updateManualPairWindow();
    });
  }

  // 确认配对按钮
  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      confirmManualPair();
    });
  }

  // 拖放区域事件
  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (e.target === dropZone) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleManualPairDrop(e);
    });
  }
}

// 打开手动配对窗口（从股票模式表格按钮）
function openManualPairWindowForStock(stockName) {
  const modalEl = document.getElementById('manualPairWindow');
  if (modalEl) {
    // 🔧 确保手动配对窗口永远在最上层
    modalEl.style.zIndex = '2147483647';
    
    // 保存当前滚动位置，确保打开/操作窗口时可以恢复
    try {
      const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
      const savedTableScroll = tableContainer ? tableContainer.scrollTop : 0;
      const savedPageY = window.scrollY || window.pageYOffset || 0;
      manualPairState.savedScroll = { tableScroll: savedTableScroll, pageY: savedPageY };
    } catch (e) {
      console.error('保存手动配对窗口前滚动位置失败:', e);
      manualPairState.savedScroll = null;
    }

    modalEl.style.display = 'block';
    manualPairState.isOpen = true;
    manualPairState.currentStock = stockName;
    manualPairState.items = [];
    updateManualPairWindow();
    
    console.log(`[手动配对] ✅ 手动配对窗口已打开 - 股票: ${stockName} (z-index: 2147483647)`);
    
    // 更新窗口标题
    const titleElement = modalEl.querySelector('.manual-pair-header h3');
    if (titleElement) {
      titleElement.textContent = `手动配对 - ${stockName}`;
    }
    
    // 更新提示文本
    const infoTextElement = document.getElementById('manualPairInfoText');
    if (infoTextElement) {
      infoTextElement.textContent = `当前股票：${stockName}\n拖动未配对的买卖气泡到此窗口进行配对，或拖动已配对的气泡到此窗口解除配对`;
    }
    
    // 确保所有气泡都有拖拽功能
    setTimeout(() => {
      document.querySelectorAll('.price-bubble').forEach(bubble => {
        if (!bubble.classList.contains('draggable')) {
          addDraggableToBubble(bubble);
        }
      });
      document.querySelectorAll('.trade-pair').forEach(pair => {
        if (!pair.classList.contains('draggable')) {
          addDraggableToPair(pair);
        }
      });
    }, 50);
  }
}

function handleManualPairDrop(e) {
  const data = e.dataTransfer.getData('application/json');
  if (!data) return;

  const parsedData = JSON.parse(data);

  if (parsedData.type === 'trade') {
    // 检查是否指定了股票，如果指定了则只允许该股票的交易
    if (manualPairState.currentStock && parsedData.trade.stock !== manualPairState.currentStock) {
      alert(`只能拖动 ${manualPairState.currentStock} 的交易到配对窗口`);
      return;
    }
    addTradeToManualPairWindow(parsedData.trade);
  } else if (parsedData.type === 'pair') {
    // 检查是否指定了股票，如果指定了则只允许该股票的配对
    if (manualPairState.currentStock && parsedData.buy.stock !== manualPairState.currentStock) {
      alert(`只能拖动 ${manualPairState.currentStock} 的配对到配对窗口`);
      return;
    }
    addPairToManualPairWindow(parsedData);
  }
}

function addTradeToManualPairWindow(trade) {
  const exists = manualPairState.items.some(item => 
    item.type === 'trade' && item.trade.id === trade.id
  );
  
  if (exists) {
    alert('该交易已在配对窗口中');
    return;
  }

  manualPairState.items.push({
    type: 'trade',
    trade: trade
  });

  updateManualPairWindow();
}

function addPairToManualPairWindow(pairData) {
  const exists = manualPairState.items.some(item => 
    item.type === 'pair' && 
    item.buy.id === pairData.buy.id && 
    item.sell.id === pairData.sell.id
  );
  
  if (exists) {
    alert('该配对已在配对窗口中');
    return;
  }

  manualPairState.items.push({
    type: 'pair',
    buy: pairData.buy,
    sell: pairData.sell
  });

  updateManualPairWindow();
}

function updateManualPairWindow() {
  const itemsContainer = document.getElementById('manualPairItems');
  const confirmBtn = document.getElementById('confirmManualPairBtn');
  const placeholder = document.querySelector('.manual-pair-drop-zone .drop-zone-placeholder');
  const resultDiv = document.getElementById('manualPairResult');

  if (!itemsContainer) return;

  itemsContainer.innerHTML = '';
  resultDiv.classList.remove('show');
  resultDiv.innerHTML = '';

  if (manualPairState.items.length === 0) {
    if (placeholder) placeholder.classList.remove('hidden');
    confirmBtn.disabled = true;
    return;
  }

  if (placeholder) placeholder.classList.add('hidden');

  const hasTrade = manualPairState.items.some(item => item.type === 'trade');
  const hasPair = manualPairState.items.some(item => item.type === 'pair');

  if (hasPair) {
    confirmBtn.textContent = '解除配对';
    confirmBtn.disabled = false;
  } else if (hasTrade) {
    const trades = manualPairState.items.filter(item => item.type === 'trade');
    const buyCount = trades.filter(t => t.trade.side === 'buy').length;
    const sellCount = trades.filter(t => t.trade.side === 'sell').length;
    
    if (buyCount === 1 && sellCount === 1) {
      confirmBtn.textContent = '确认配对';
      confirmBtn.disabled = false;
    } else {
      confirmBtn.textContent = '确认配对';
      confirmBtn.disabled = true;
    }
  } else {
    confirmBtn.textContent = '确认配对';
    confirmBtn.disabled = true;
  }

  manualPairState.items.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = `manual-pair-item ${item.type === 'trade' ? item.trade.side : 'paired'}`;

    if (item.type === 'trade') {
      const trade = item.trade;
      itemEl.innerHTML = `
        <div class="manual-pair-item-info">
          <span class="item-title">${trade.stock}</span>
          <span class="item-detail">${trade.side === 'buy' ? '买入' : '卖出'} ¥${trade.price} × ${trade.qty}</span>
        </div>
        <button class="manual-pair-item-remove" onclick="removeItemFromManualPairWindow(${index})">✕</button>
      `;
    } else if (item.type === 'pair') {
      itemEl.innerHTML = `
        <div class="manual-pair-item-info">
          <span class="item-title">${item.buy.stock}</span>
          <span class="item-detail">买入 ¥${item.buy.price} / 卖出 ¥${item.sell.price} × ${item.buy.qty}</span>
        </div>
        <button class="manual-pair-item-remove" onclick="removeItemFromManualPairWindow(${index})">✕</button>
      `;
    }

    itemsContainer.appendChild(itemEl);
  });
}

window.removeItemFromManualPairWindow = function(index) {
  manualPairState.items.splice(index, 1);
  updateManualPairWindow();
};

async function confirmManualPair() {
  const trades = manualPairState.items.filter(item => item.type === 'trade').map(item => item.trade);
  const pairs = manualPairState.items.filter(item => item.type === 'pair');

  // 保存当前滚动位置，传给 pairTrades/unpairTrades 以避免被内部滚动覆盖
  const savedScroll = manualPairState.savedScroll || (() => {
    const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
    return { tableScroll: tableContainer ? tableContainer.scrollTop : 0, pageY: window.scrollY || 0 };
  })();

  if (pairs.length > 0) {
    for (const pair of pairs) {
      const qty = pair.buy.qty;
      const buyAmount = pair.buy.price * qty;
      const sellAmount = pair.sell.price * qty;
      const buyTax = calculateTax(pair.buy.stock, 'buy', buyAmount);
      const sellTax = calculateTax(pair.sell.stock, 'sell', sellAmount);
      const profit = sellAmount - buyAmount - buyTax - sellTax;

      const confirmResult = confirm('🔓 解除配对确认\n\n股票名称：' + pair.buy.stock + '\n买入价格：¥' + pair.buy.price + '\n卖出价格：¥' + pair.sell.price + '\n数量：' + qty + '\n买入金额：¥' + buyAmount.toFixed(2) + '\n卖出金额：¥' + sellAmount.toFixed(2) + '\n买入税费：¥' + buyTax.toFixed(2) + '\n卖出税费：¥' + sellTax.toFixed(2) + '\n预计利润：¥' + profit.toFixed(2) + '\n\n确定要解除这个配对吗？');
      
      if (confirmResult) {
        await unpairTrades(pair.buy, pair.sell, { preserveScroll: true, savedScroll });
        showManualPairResult('解除配对成功', pair.buy.stock, pair.buy.price, pair.sell.price, qty, profit);
      }
    }
  }

  if (trades.length === 2) {
    const buyTrade = trades.find(t => t.side === 'buy');
    const sellTrade = trades.find(t => t.side === 'sell');

    if (!buyTrade || !sellTrade) {
      alert('❌ 配对失败\n\n原因：请选择一笔买入和一笔卖出交易进行配对');
      return;
    }

    if (buyTrade.stock !== sellTrade.stock) {
      alert('❌ 配对失败\n\n原因：买入和卖出交易必须是同一只股票\n\n买入股票：' + buyTrade.stock + '\n卖出股票：' + sellTrade.stock);
      return;
    }

    const qty = buyTrade.qty;
    const buyAmount = buyTrade.price * qty;
    const sellAmount = sellTrade.price * qty;
    const buyTax = calculateTax(buyTrade.stock, 'buy', buyAmount);
    const sellTax = calculateTax(sellTrade.stock, 'sell', sellAmount);
    const profit = sellAmount - buyAmount - buyTax - sellTax;

    if (profit <= 0) {
      const confirmResult = confirm('⚠️ 配对警告\n\n原因：配对将产生非正利润\n\n股票名称：' + buyTrade.stock + '\n买入价格：¥' + buyTrade.price + '\n卖出价格：¥' + sellTrade.price + '\n数量：' + qty + '\n买入金额：¥' + buyAmount.toFixed(2) + '\n卖出金额：¥' + sellAmount.toFixed(2) + '\n买入税费：¥' + buyTax.toFixed(2) + '\n卖出税费：¥' + sellTax.toFixed(2) + '\n预计利润：¥' + profit.toFixed(2) + '\n\n是否仍然强制配对？');
      if (!confirmResult) {
        return;
      }
    }

    await pairTrades(buyTrade, sellTrade, { preserveScroll: true, savedScroll });
    showManualPairResult('配对成功', buyTrade.stock, buyTrade.price, sellTrade.price, qty, profit);
  }

  manualPairState.items = [];
  updateManualPairWindow();
  
  // 自动刷新紧凑模式的股票卡片显示（模拟F按钮功能）
  try {
    if (window.compactModePlugin && window.compactModePlugin.floatingWindow) {
      const compactWin = window.compactModePlugin.floatingWindow;
      const winEl = compactWin.getElement();
      if (winEl && winEl.style.display !== 'none') {
        const filterDateInput = document.getElementById('filterDate');
        const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
        
        if (filterDate) {
          // 保存滚动位置
          const contentEl = winEl.querySelector('.compact-mode-content');
          const scrollPosition = contentEl ? contentEl.scrollTop : 0;
          
          // 重新收集数据并渲染（与F按钮逻辑一致）
          const data = window.compactModePlugin.collectData(filterDate);
          const content = window.compactModePlugin.renderCompactView(data, filterDate);
          compactWin.setContent(content);
          window.compactModePlugin.bindEvents();
          window.compactModePlugin.applyBubbleScale();
          
          // 恢复滚动位置
          const newContentEl = compactWin.getElement().querySelector('.compact-mode-content');
          if (newContentEl) {
            newContentEl.scrollTop = scrollPosition;
          }
        }
      }
    }
  } catch (err) {
    console.error('自动刷新紧凑模式视图失败:', err);
  }
  
  // 操作完成后尝试恢复打开前的滚动位置，保证页面位置不变
  try {
    if (manualPairState.savedScroll) {
      const { tableScroll, pageY } = manualPairState.savedScroll;
      const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
      if (tableContainer && typeof tableScroll === 'number') tableContainer.scrollTop = tableScroll;
      if (typeof pageY === 'number') window.scrollTo(0, pageY);
    }
  } catch (e) {
    console.error('配对完成后恢复滚动位置失败:', e);
  }
}

function showManualPairResult(title, stock, buyPrice, sellPrice, qty, profit) {
  const resultDiv = document.getElementById('manualPairResult');
  if (!resultDiv) return;

  const profitClass = profit >= 0 ? '' : 'negative';
  
  resultDiv.innerHTML = `
    <div class="result-title">${title}</div>
    <div class="result-detail">
      股票：${stock}<br>
      买入：¥${buyPrice}<br>
      卖出：¥${sellPrice}<br>
      数量：${qty}
    </div>
    <div class="result-profit ${profitClass}">利润：¥${profit.toFixed(2)}</div>
  `;
  
  resultDiv.classList.add('show');
}

// 初始化拖拽配对功能
function initDragPairing() {
  const dragPairZone = document.getElementById('dragPairZone');
  const toggleBtn = document.getElementById('toggleDragPairZone');
  const confirmBtn = document.getElementById('confirmDragPairBtn');
  const clearBtn = document.getElementById('clearDragPairBtn');
  const dropZone = document.getElementById('dragPairDropZone');

  if (!dragPairZone) return;

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      dragPairState.collapsed = !dragPairState.collapsed;
      dragPairZone.classList.toggle('collapsed', dragPairState.collapsed);
      toggleBtn.textContent = dragPairState.collapsed ? '+' : '−';
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      dragPairState.items = [];
      updateDragPairZone();
    });
  }

  if (confirmBtn) {
    confirmBtn.addEventListener('click', () => {
      confirmDragPair();
    });
  }

  if (dropZone) {
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (e.target === dropZone) {
        dropZone.classList.remove('drag-over');
      }
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      handleDrop(e);
    });
  }

  addDraggableToBubbles();
}

function showDragPairZone() {
  const dragPairZone = document.getElementById('dragPairZone');
  if (dragPairZone) {
    // 🔧 确保配对窗口永远在最上层
    // 获取当前最大 z-index（从 FloatingWindowReact 的全局变量）
    const currentMaxZIndex = window.FloatingWindowManager 
      ? (window.currentMaxZIndex || 999999) + 1 
      : 1000000;
    
    // 设置为绝对最高层级（浏览器最大值：2147483647）
    dragPairZone.style.zIndex = '2147483647';
    
    dragPairZone.classList.add('show');
    dragPairState.collapsed = false;
    dragPairZone.classList.remove('collapsed');
    const toggleBtn = document.getElementById('toggleDragPairZone');
    if (toggleBtn) {
      toggleBtn.textContent = '−';
    }
    
    console.log('[手动配对] ✅ 配对窗口已置顶 (z-index: 2147483647)');
  }
}

function hideDragPairZone() {
  const dragPairZone = document.getElementById('dragPairZone');
  if (dragPairZone) {
    dragPairZone.classList.remove('show');
    dragPairState.items = [];
    updateDragPairZone();
  }
}

function addDraggableToBubbles() {
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType === 1) {
          const priceBubbles = node.querySelectorAll ? node.querySelectorAll('.price-bubble') : [];
          const tradePairs = node.querySelectorAll ? node.querySelectorAll('.trade-pair') : [];
          
          priceBubbles.forEach(bubble => addDraggableToBubble(bubble));
          tradePairs.forEach(pair => addDraggableToPair(pair));

          if (node.classList && node.classList.contains('price-bubble')) {
            addDraggableToBubble(node);
          }
          if (node.classList && node.classList.contains('trade-pair')) {
            addDraggableToPair(node);
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  document.querySelectorAll('.price-bubble').forEach(bubble => addDraggableToBubble(bubble));
  document.querySelectorAll('.trade-pair').forEach(pair => addDraggableToPair(pair));
}

function addDraggableToBubble(bubble) {
  if (bubble.classList.contains('draggable')) return;

  bubble.classList.add('draggable');
  bubble.setAttribute('draggable', 'true');

  bubble.addEventListener('dragstart', (e) => {
    bubble.classList.add('dragging');
    
    const tradeData = getTradeDataFromBubble(bubble);
    if (tradeData) {
      e.dataTransfer.setData('application/json', JSON.stringify(tradeData));
      e.dataTransfer.effectAllowed = 'copy';
    }
  });

  bubble.addEventListener('dragend', () => {
    bubble.classList.remove('dragging');
  });
}

function addDraggableToPair(pairBubble) {
  if (pairBubble.classList.contains('draggable')) return;

  pairBubble.classList.add('draggable');
  pairBubble.setAttribute('draggable', 'true');

  pairBubble.addEventListener('dragstart', (e) => {
    pairBubble.classList.add('dragging');
    
    const pairData = getPairDataFromBubble(pairBubble);
    if (pairData) {
      e.dataTransfer.setData('application/json', JSON.stringify({
        type: 'pair',
        ...pairData
      }));
      e.dataTransfer.effectAllowed = 'copy';
    }
  });

  pairBubble.addEventListener('dragend', () => {
    pairBubble.classList.remove('dragging');
  });
}

function getTradeDataFromBubble(bubble) {
  // 首先尝试从dataset获取数据（适用于股票模式表格）
  if (bubble.dataset.tradeId && bubble.dataset.price && bubble.dataset.side && bubble.dataset.stock) {
    const trade = trades.find(t => t.id === bubble.dataset.tradeId);
    if (trade) {
      return {
        type: 'trade',
        trade: trade
      };
    }
  }
  
  // 如果dataset方式失败，尝试通过DOM结构获取（适用于气泡模式）
  const parentSection = bubble.closest('.bubble-section');
  const stockBubble = bubble.closest('.stock-bubble-separated');
  
  if (!stockBubble) return null;

  const stockNameSpan = stockBubble.querySelector('.stock-name');
  const stockName = stockNameSpan ? stockNameSpan.textContent.split('(')[0].trim() : '';
  
  const priceText = bubble.textContent.replace(/−/g, '-').replace(/-/g, '');
  const price = parseFloat(priceText);
  const isSell = bubble.classList.contains('sell');
  const side = isSell ? 'sell' : 'buy';

  const trade = trades.find(t => 
    t.stock === stockName && 
    t.price === price && 
    t.side === side
  );

  if (!trade) return null;

  return {
    type: 'trade',
    trade: trade
  };
}

function getPairDataFromBubble(pairBubble) {
  const buyBubble = pairBubble.querySelector('.price-bubble.buy');
  const sellBubble = pairBubble.querySelector('.price-bubble.sell');
  
  if (!buyBubble || !sellBubble) return null;

  const buyData = getTradeDataFromBubble(buyBubble);
  const sellData = getTradeDataFromBubble(sellBubble);

  if (!buyData || !sellData) return null;

  return {
    buy: buyData.trade,
    sell: sellData.trade
  };
}

function handleDrop(e) {
  const data = e.dataTransfer.getData('application/json');
  if (!data) return;

  const parsedData = JSON.parse(data);

  if (parsedData.type === 'trade') {
    addTradeToPairZone(parsedData.trade);
  } else if (parsedData.type === 'pair') {
    addPairToPairZone(parsedData);
  }
}

function addTradeToPairZone(trade) {
  const exists = dragPairState.items.some(item => 
    item.type === 'trade' && item.trade.id === trade.id
  );
  
  if (exists) {
    alert('该交易已在配对区域中');
    return;
  }

  dragPairState.items.push({
    type: 'trade',
    trade: trade
  });

  updateDragPairZone();
}

function addPairToPairZone(pairData) {
  const qty = pairData.buy.qty;
  const buyAmount = pairData.buy.price * qty;
  const sellAmount = pairData.sell.price * qty;
  const buyTax = calculateTax(pairData.buy.stock, 'buy', buyAmount);
  const sellTax = calculateTax(pairData.sell.stock, 'sell', sellAmount);
  const profit = sellAmount - buyAmount - buyTax - sellTax;

  dragPairState.items.push({
    type: 'pair',
    buy: pairData.buy,
    sell: pairData.sell,
    profit: profit
  });

  updateDragPairZone();
}

function removeTradeFromPairZone(index) {
  dragPairState.items.splice(index, 1);
  updateDragPairZone();
}

function updateDragPairZone() {
  const itemsContainer = document.getElementById('dragPairItems');
  const placeholder = document.querySelector('.drop-zone-placeholder');
  const confirmBtn = document.getElementById('confirmDragPairBtn');
  const infoDiv = document.getElementById('dragPairInfo');

  if (!itemsContainer) return;

  itemsContainer.innerHTML = '';

  if (dragPairState.items.length === 0) {
    placeholder.classList.remove('hidden');
    confirmBtn.disabled = true;
    confirmBtn.textContent = '配对';
    infoDiv.classList.remove('show');
  } else {
    placeholder.classList.add('hidden');
    confirmBtn.disabled = false;
    
    const hasPairs = dragPairState.items.some(item => item.type === 'pair');
    const hasTrades = dragPairState.items.some(item => item.type === 'trade');
    
    if (hasPairs && hasTrades) {
      confirmBtn.textContent = '配对/解除配对';
    } else if (hasPairs) {
      confirmBtn.textContent = '解除配对';
    } else {
      confirmBtn.textContent = '配对';
    }
  }

  dragPairState.items.forEach((item, index) => {
    const itemEl = document.createElement('div');
    itemEl.className = `drag-pair-item ${item.type === 'trade' ? item.trade.side : 'pair'}`;

    if (item.type === 'trade') {
      const trade = item.trade;
      itemEl.innerHTML = `
        <div class="item-info">
          <span class="item-stock">${trade.stock}</span>
          <span class="item-price">${trade.side === 'sell' ? '-' : ''}${trade.price}</span>
        </div>
        <button class="item-remove" onclick="removeTradeFromPairZone(${index})">✕</button>
      `;
    } else if (item.type === 'pair') {
      itemEl.innerHTML = `
        <div class="item-info">
          <span class="item-stock">${item.buy.stock}</span>
          <span class="item-price">${item.buy.price} / -${item.sell.price}</span>
        </div>
        <button class="item-remove" onclick="removeTradeFromPairZone(${index})">✕</button>
      `;
    }

    itemsContainer.appendChild(itemEl);
  });

  if (dragPairState.items.length > 0) {
    updatePairInfo(infoDiv);
  }
}

function updatePairInfo(infoDiv) {
  if (!infoDiv) return;

  const trades = dragPairState.items.filter(item => item.type === 'trade').map(item => item.trade);
  const pairs = dragPairState.items.filter(item => item.type === 'pair');

  if (trades.length === 0 && pairs.length === 0) {
    infoDiv.classList.remove('show');
    return;
  }

  let totalProfit = 0;
  let totalTax = 0;

  if (trades.length === 2) {
    const buyTrade = trades.find(t => t.side === 'buy');
    const sellTrade = trades.find(t => t.side === 'sell');

    if (buyTrade && sellTrade && buyTrade.stock === sellTrade.stock) {
      const qty = buyTrade.qty;
      const buyAmount = buyTrade.price * qty;
      const sellAmount = sellTrade.price * qty;
      const buyTax = calculateTax(buyTrade.stock, 'buy', buyAmount);
      const sellTax = calculateTax(sellTrade.stock, 'sell', sellAmount);
      const profit = sellAmount - buyAmount - buyTax - sellTax;

      totalProfit = profit;
      totalTax = buyTax + sellTax;
    }
  }

  if (pairs.length > 0) {
    pairs.forEach(pair => {
      if (pair.profit !== undefined) {
        totalProfit += pair.profit;
      } else {
        const qty = pair.buy.qty;
        const buyAmount = pair.buy.price * qty;
        const sellAmount = pair.sell.price * qty;
        const buyTax = calculateTax(pair.buy.stock, 'buy', buyAmount);
        const sellTax = calculateTax(pair.sell.stock, 'sell', sellAmount);
        const profit = sellAmount - buyAmount - buyTax - sellTax;
        totalProfit += profit;
      }
    });
  }

  infoDiv.innerHTML = `
    <div class="info-row">
      <span class="info-label">预计利润：</span>
      <span class="info-value ${totalProfit >= 0 ? '' : 'negative'}">¥${totalProfit.toFixed(2)}</span>
    </div>
    ${totalTax > 0 ? `
    <div class="info-row">
      <span class="info-label">税费：</span>
      <span class="info-value">¥${totalTax.toFixed(2)}</span>
    </div>
    ` : ''}
  `;

  infoDiv.classList.add('show');
}

async function confirmDragPair() {
  const trades = dragPairState.items.filter(item => item.type === 'trade').map(item => item.trade);
  const pairs = dragPairState.items.filter(item => item.type === 'pair');

  // 在拖拽配对确认时保存当前滚动位置，避免 pair/unpair 内部滚动覆盖
  const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
  const savedScroll = { tableScroll: tableContainer ? tableContainer.scrollTop : 0, pageY: window.scrollY || 0 };

  if (pairs.length > 0) {
    for (const pair of pairs) {
      const qty = pair.buy.qty;
      const buyAmount = pair.buy.price * qty;
      const sellAmount = pair.sell.price * qty;
      const buyTax = calculateTax(pair.buy.stock, 'buy', buyAmount);
      const sellTax = calculateTax(pair.sell.stock, 'sell', sellAmount);
      const profit = sellAmount - buyAmount - buyTax - sellTax;

      const confirmResult = confirm('🔓 解除配对确认\n\n股票名称：' + pair.buy.stock + '\n买入价格：¥' + pair.buy.price + '\n卖出价格：¥' + pair.sell.price + '\n数量：' + qty + '\n买入金额：¥' + buyAmount.toFixed(2) + '\n卖出金额：¥' + sellAmount.toFixed(2) + '\n买入税费：¥' + buyTax.toFixed(2) + '\n卖出税费：¥' + sellTax.toFixed(2) + '\n预计利润：¥' + profit.toFixed(2) + '\n\n确定要解除这个配对吗？');
      
      if (confirmResult) {
        await unpairTrades(pair.buy, pair.sell, { preserveScroll: true, savedScroll });
        alert('✅ 解除配对成功！\n\n股票名称：' + pair.buy.stock + '\n买入价格：¥' + pair.buy.price + '\n卖出价格：¥' + pair.sell.price + '\n数量：' + qty + '\n买入金额：¥' + buyAmount.toFixed(2) + '\n卖出金额：¥' + sellAmount.toFixed(2) + '\n买入税费：¥' + buyTax.toFixed(2) + '\n卖出税费：¥' + sellTax.toFixed(2) + '\n预计利润：¥' + profit.toFixed(2));
      }
    }
  }

  if (trades.length === 2) {
    const buyTrade = trades.find(t => t.side === 'buy');
    const sellTrade = trades.find(t => t.side === 'sell');

    if (!buyTrade || !sellTrade) {
      const buyCount = trades.filter(t => t.side === 'buy').length;
      const sellCount = trades.filter(t => t.side === 'sell').length;
      
      let errorMsg = '❌ 配对失败\n\n原因：请选择一笔买入和一笔卖出交易进行配对\n\n当前选择：';
      if (buyCount === 0) {
        errorMsg += '\n- 已选择 ' + sellCount + ' 笔卖出交易';
        errorMsg += '\n- 未选择买入交易';
      } else if (sellCount === 0) {
        errorMsg += '\n- 已选择 ' + buyCount + ' 笔买入交易';
        errorMsg += '\n- 未选择卖出交易';
      }
      
      alert(errorMsg);
      return;
    }

    if (buyTrade.stock !== sellTrade.stock) {
      alert('❌ 配对失败\n\n原因：买入和卖出交易必须是同一只股票\n\n买入股票：' + buyTrade.stock + '\n卖出股票：' + sellTrade.stock);
      return;
    }

    const qty = buyTrade.qty;
    const buyAmount = buyTrade.price * qty;
    const sellAmount = sellTrade.price * qty;
    const buyTax = calculateTax(buyTrade.stock, 'buy', buyAmount);
    const sellTax = calculateTax(sellTrade.stock, 'sell', sellAmount);
    const profit = sellAmount - buyAmount - buyTax - sellTax;

    if (profit <= 0) {
      const confirmResult = confirm('⚠️ 配对警告\n\n原因：配对将产生非正利润\n\n股票名称：' + buyTrade.stock + '\n买入价格：¥' + buyTrade.price + '\n卖出价格：¥' + sellTrade.price + '\n数量：' + qty + '\n买入金额：¥' + buyAmount.toFixed(2) + '\n卖出金额：¥' + sellAmount.toFixed(2) + '\n买入税费：¥' + buyTax.toFixed(2) + '\n卖出税费：¥' + sellTax.toFixed(2) + '\n预计利润：¥' + profit.toFixed(2) + '\n\n是否仍然强制配对？');
      if (!confirmResult) {
        return;
      }
    }

    await pairTrades(buyTrade, sellTrade, { preserveScroll: true, savedScroll });
    
    alert('✅ 配对成功！\n\n股票名称：' + buyTrade.stock + '\n买入价格：¥' + buyTrade.price + '\n卖出价格：¥' + sellTrade.price + '\n数量：' + qty + '\n买入金额：¥' + buyAmount.toFixed(2) + '\n卖出金额：¥' + sellAmount.toFixed(2) + '\n买入税费：¥' + buyTax.toFixed(2) + '\n卖出税费：¥' + sellTax.toFixed(2) + '\n预计利润：¥' + profit.toFixed(2));
  } else if (trades.length > 0 && trades.length !== 2) {
    const buyCount = trades.filter(t => t.side === 'buy').length;
    const sellCount = trades.filter(t => t.side === 'sell').length;
    
    let errorMsg = '❌ 配对失败\n\n原因：请选择一笔买入和一笔卖出交易进行配对\n\n当前选择：';
    if (buyCount === 0 && sellCount === 0) {
      errorMsg += '\n- 未选择任何交易';
    } else if (buyCount === 0) {
      errorMsg += '\n- 已选择 ' + sellCount + ' 笔卖出交易';
      errorMsg += '\n- 未选择买入交易';
    } else if (sellCount === 0) {
      errorMsg += '\n- 已选择 ' + buyCount + ' 笔买入交易';
      errorMsg += '\n- 未选择卖出交易';
    } else {
      errorMsg += '\n- 已选择 ' + buyCount + ' 笔买入交易';
      errorMsg += '\n- 已选择 ' + sellCount + ' 笔卖出交易';
      errorMsg += '\n- 只能选择 1 笔买入和 1 笔卖出交易';
    }
    
    alert(errorMsg);
    return;
  }

  dragPairState.items = [];
  updateDragPairZone();
  hideDragPairZone();
}

async function pairTrades(buyTrade, sellTrade, options = {}) {
  try {
    const qty = buyTrade.qty;
    const buyAmount = buyTrade.price * qty;
    const sellAmount = sellTrade.price * qty;
    const buyTax = calculateTax(buyTrade.stock, 'buy', buyAmount);
    const sellTax = calculateTax(sellTrade.stock, 'sell', sellAmount);
    const profit = sellAmount - buyAmount - buyTax - sellTax;

    if (!(profit > 0)) {
      if (!confirm('配对将产生非正利润，是否仍然强制配对？')) {
        return;
      }
    }

    const stock = buyTrade.stock;

    const existing = await tradesDB.getPairing(stock);
    const newPair = { buy: buyTrade, sell: sellTrade, profit };

    const updated = existing ? JSON.parse(JSON.stringify(existing)) : {
      stockName: stock,
      pairedTrades: [],
      pairedBuyIds: [],
      pairedSellIds: []
    };

    // 使用统一的配对结构
    updated.pairedTrades = updated.pairedTrades || [];
    updated.pairedBuyIds = updated.pairedBuyIds || [];
    updated.pairedSellIds = updated.pairedSellIds || [];
    
    // 添加新配对
    updated.pairedTrades.push(newPair);
    updated.pairedBuyIds.push(buyTrade.id);
    updated.pairedSellIds.push(sellTrade.id);

    await tradesDB.savePairing(updated);
    pairingCache[stock] = {
      pairedTrades: updated.pairedTrades,
      pairedBuyIds: updated.pairedBuyIds,
      pairedSellIds: updated.pairedSellIds
    };

    // 保存当前滚动位置（包含页面、表格容器与气泡容器）
    const pageScrollY = window.scrollY || window.pageYOffset || 0;
    const tableWrap = document.querySelector('.table-wrap');
    const tableWrapScrollTop = tableWrap ? tableWrap.scrollTop : 0;
    const taiwanStockBubbles = document.getElementById('taiwanStockBubbles');
    const chinaStockBubbles = document.getElementById('chinaStockBubbles');
    const taiwanScrollTop = taiwanStockBubbles ? taiwanStockBubbles.scrollTop : 0;
    const chinaScrollTop = chinaStockBubbles ? chinaStockBubbles.scrollTop : 0;

    // 根据当前视图模式刷新UI
    await loadTrades();
    await applyFilters();
    if (currentView === 'table') {
      if (currentTableMode === 'stock') {
        await renderStockModeTable();
      } else {
        renderTrades();
      }
    } else {
      renderBubbleView();
    }

    // 恢复滚动位置
    // 使用 rAF + 延迟，确保所有 DOM 渲染完成后再恢复滚动
    requestAnimationFrame(() => {
      setTimeout(() => {
        // 如果调用方要求保留调用前的滚动位置并提供了 savedScroll，则优先使用它
        if (options && options.preserveScroll && options.savedScroll) {
          try {
            const { tableScroll, pageY } = options.savedScroll;
            const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
            if (tableContainer && typeof tableScroll === 'number') tableContainer.scrollTop = tableScroll;
            if (typeof pageY === 'number') window.scrollTo(0, pageY);
            return;
          } catch (e) {
            console.error('使用 caller 提供的滚动位置恢复失败，退回默认恢复策略:', e);
          }
        }

        const targetStock = stock;
        const scrolled = scrollToStockPosition(targetStock);
        if (!scrolled) {
          // 恢复表格容器与气泡容器滚动位置，再恢复页面滚动
          if (tableWrap) tableWrap.scrollTop = tableWrapScrollTop;
          if (taiwanStockBubbles) taiwanStockBubbles.scrollTop = taiwanScrollTop;
          if (chinaStockBubbles) chinaStockBubbles.scrollTop = chinaScrollTop;
          window.scrollTo(0, pageScrollY);
        }
      }, 200);
    });
  } catch (error) {
    console.error('配对失败:', error);
    alert('配对失败: ' + error.message);
  }
}

async function unpairTrades(buyTrade, sellTrade, options = {}) {
  try {
    const stock = buyTrade.stock;
    const existing = await tradesDB.getPairing(stock);
    if (!existing) {
      alert('没有配对记录');
      return;
    }

    // 使用统一的配对结构
    if (existing.pairedTrades && Array.isArray(existing.pairedTrades)) {
      existing.pairedTrades = existing.pairedTrades.filter(p =>
        !(p.buy.id === buyTrade.id && p.sell.id === sellTrade.id)
      );
      if (existing.pairedBuyIds) {
        existing.pairedBuyIds = existing.pairedBuyIds.filter(id => id !== buyTrade.id);
      }
      if (existing.pairedSellIds) {
        existing.pairedSellIds = existing.pairedSellIds.filter(id => id !== sellTrade.id);
      }
    }

    await tradesDB.savePairing(existing);
    pairingCache[stock] = {
      pairedTrades: existing.pairedTrades || [],
      pairedBuyIds: existing.pairedBuyIds || [],
      pairedSellIds: existing.pairedSellIds || []
    };


    // 保存当前滚动位置（包含页面、表格容器与气泡容器）
    const pageScrollY = window.scrollY || window.pageYOffset || 0;
    const tableWrap = document.querySelector('.table-wrap');
    const tableWrapScrollTop = tableWrap ? tableWrap.scrollTop : 0;
    const taiwanStockBubbles = document.getElementById('taiwanStockBubbles');
    const chinaStockBubbles = document.getElementById('chinaStockBubbles');
    const taiwanScrollTop = taiwanStockBubbles ? taiwanStockBubbles.scrollTop : 0;
    const chinaScrollTop = chinaStockBubbles ? chinaStockBubbles.scrollTop : 0;

    await loadTrades();
    await applyFilters();
    if (currentView === 'table') {
      if (currentTableMode === 'stock') {
        await renderStockModeTable();
      } else {
        renderTrades();
      }
    } else {
      renderBubbleView();
    }

    // 恢复滚动位置
    // 使用 rAF + 延迟，确保所有 DOM 渲染完成后再恢复滚动
    requestAnimationFrame(() => {
      setTimeout(() => {
        // 如果调用方要求保留调用前的滚动位置并提供了 savedScroll，则优先使用它
        if (options && options.preserveScroll && options.savedScroll) {
          try {
            const { tableScroll, pageY } = options.savedScroll;
            const tableContainer = tableBody && tableBody.parentElement ? tableBody.parentElement : (document.scrollingElement || document.documentElement);
            if (tableContainer && typeof tableScroll === 'number') tableContainer.scrollTop = tableScroll;
            if (typeof pageY === 'number') window.scrollTo(0, pageY);
            return;
          } catch (e) {
            console.error('使用 caller 提供的滚动位置恢复失败，退回默认恢复策略:', e);
          }
        }

        const targetStock = buyTrade ? buyTrade.stock : null;
        const scrolled = targetStock ? scrollToStockPosition(targetStock) : false;
        if (!scrolled) {
          if (tableWrap) tableWrap.scrollTop = tableWrapScrollTop;
          if (taiwanStockBubbles) taiwanStockBubbles.scrollTop = taiwanScrollTop;
          if (chinaStockBubbles) chinaStockBubbles.scrollTop = chinaScrollTop;
          window.scrollTo(0, pageScrollY);
        }
      }, 200);
    });
  } catch (error) {
    console.error('解除配对失败:', error);
    alert('解除配对失败: ' + error.message);
  }
}
