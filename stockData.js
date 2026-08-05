// 股票数据模块
// 将股票数据独立出来，便于维护和修改

const STOCK_DATA_SCHEMA = {
  version: '1.2.0',
  updatedAt: '2026-05-06',

  stocks: {
    tableName: 'stocks',
    columns: [
      { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
      { name: 'name', type: 'TEXT UNIQUE NOT NULL' },
      { name: 'code', type: 'TEXT' },
      { name: 'screenshot_name', type: 'TEXT' },
      { name: 'qty', type: 'INTEGER NOT NULL' },
      { name: 'market', type: 'TEXT NOT NULL' },
      { name: 'type', type: 'TEXT NOT NULL' },
      { name: 'is_frequent', type: 'INTEGER DEFAULT 0' }
    ]
  },
  
  taxRates: {
    tableName: 'tax_rates',
    columns: [
      { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
      { name: 'type', type: 'TEXT UNIQUE NOT NULL' },
      { name: 'buy', type: 'REAL NOT NULL' },
      { name: 'sell', type: 'REAL NOT NULL' },
      { name: 'rebate', type: 'REAL NOT NULL' },
      { name: 'min_tax_amount', type: 'REAL NOT NULL' }
    ]
  },
  
  metadata: {
    tableName: '_metadata',
    columns: [
      { name: 'key', type: 'TEXT PRIMARY KEY' },
      { name: 'value', type: 'TEXT' }
    ]
  }
};

const SQLITE_BACKUP_FILENAME = 'stock_data.db';

const TAX_RATES = {
  tETF: { buy: 14.16, sell: 23.14, rebate: 9.91, minTaxAmount: 0 },
  tA: { buy: 14.16, sell: 46.25, rebate: 9.91, minTaxAmount: 0 },
  cETF: { buy: 1.05, sell: 1.05, rebate: 0, minTaxAmount: 5 },
  cA: { buy: 1.05, sell: 9, rebate: 0, minTaxAmount: 5 },
  cG: { buy: 0, sell: 0, rebate: 0, minTaxAmount: 0 }
};

const ALL_STOCKS = [
  { name: '台股A50', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { name: '富邦深100', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { name: '群台精', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { name: '国永高', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { name: '复华科', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { name: '永丰优息', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { id: '0052', name: '富邦科技', code: '0052', screenshotName: '', qty: 1000, market: '台股', type: 'tETF' },
  { name: '中信金', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '元大金', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '国泰金', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { id: '2886', name: '兆丰金', code: '2886', screenshotName: '兆丰金', qty: 1000, market: '台股', type: 'tA' },
  { name: '第一金', code: '2892', screenshotName: '第一金', qty: 1000, market: '台股', type: 'tA' },
  { name: '富邦金', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '统一', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '统一超', code: '2912', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '南亚', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '远传', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '台哥大', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '红利50ETF', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '证券ETF', code: '512880', screenshotName: '证券ETF国泰', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '软件ETF', code: '159852', screenshotName: '软件ETF嘉实', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '银行ETF', code: '159887', screenshotName: '银行ETF国富', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '半导体', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '芯片ETF华夏', code: '159995', screenshotName: '芯片ETF华夏', qty: 10000, market: '陆股', type: 'cETF' },
  { name: '恒生科技ETF', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '兴业银行', code: '601166', screenshotName: '兴业银行', qty: 1000, market: '陆股', type: 'cA' },
  { name: '嘉美包装', code: '002969', screenshotName: '嘉美包装', qty: 500, market: '陆股', type: 'cA' },
  { name: '红棉股份', code: '000523', screenshotName: '红棉股份', qty: 5000, market: '陆股', type: 'cA' },
  { name: '联芸科技', code: '688449', screenshotName: '联芸科技', qty: 500, market: '陆股', type: 'cA' },
  { name: '电力ETF广发', code: '159611', screenshotName: '电力ETF广发', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '绿电ETF华夏', code: '562550', screenshotName: '绿电ETF华夏', qty: 20000, market: '陆股', type: 'cETF' },  
  { name: '神华', code: '601088', screenshotName: '中国神华', qty: 500, market: '陆股', type: 'cA' },
  { name: '中矿', code: '', screenshotName: '', qty: 500, market: '陆股', type: 'cA' },
  { name: '科创50', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '安通控股', code: '', screenshotName: '', qty: 10000, market: '陆股', type: 'cA' },
  { name: '泰鸿', code: '', screenshotName: '', qty: 1000, market: '陆股', type: 'cA' },
  { name: 'AI智能', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '机器人', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '黄金ETF', code: '', screenshotName: '', qty: 3000, market: '陆股', type: 'cETF' },
  { name: '医疗ETF', code: '', screenshotName: '', qty: 50000, market: '陆股', type: 'cETF' },
  { name: '陆股A50', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '兴业积存金', code: '', screenshotName: '', qty: 5, market: '陆股', type: 'cG' }
];

const FREQUENT_STOCKS = [
  { name: '中信金', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '元大金', code: '', screenshotName: '', qty: 1000, market: '台股', type: 'tA' },
  { name: '红利50ETF', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '软件ETF', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '半导体', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '恒生科技ETF', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: 'AI智能', code: '', screenshotName: '', qty: 20000, market: '陆股', type: 'cETF' },
  { name: '兴业积存金', code: '', screenshotName: '', qty: 5, market: '陆股', type: 'cG' }
];

let STOCKS = (function() {
  const mode = (typeof localStorage !== 'undefined' && localStorage.getItem('stockListMode')) || 'all';
  return mode === 'frequent' ? [...FREQUENT_STOCKS] : [...ALL_STOCKS];
})();

let stockListMode = (typeof localStorage !== 'undefined' && localStorage.getItem('stockListMode')) || 'all';

function switchStockList(mode) {
  stockListMode = mode;
  if (mode === 'all') {
    STOCKS = [...ALL_STOCKS];
  } else {
    STOCKS = [...FREQUENT_STOCKS];
  }
  window.STOCKS = STOCKS;
  
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('stockListMode', mode);
  }
  
  window.dispatchEvent(new CustomEvent('stockListChanged', { detail: { mode, stocks: STOCKS } }));
  
  return STOCKS;
}

function getStockListMode() {
  return stockListMode;
}

function getAllStocks() {
  return ALL_STOCKS;
}

function getFrequentStocks() {
  return FREQUENT_STOCKS;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    STOCKS, TAX_RATES, ALL_STOCKS, FREQUENT_STOCKS,
    switchStockList, getStockListMode, getAllStocks, getFrequentStocks,
    STOCK_DATA_SCHEMA, SQLITE_BACKUP_FILENAME
  };
} else if (typeof window !== 'undefined') {
  window.STOCKS = STOCKS;
  window.TAX_RATES = TAX_RATES;
  window.ALL_STOCKS = ALL_STOCKS;
  window.FREQUENT_STOCKS = FREQUENT_STOCKS;
  window.switchStockList = switchStockList;
  window.getStockListMode = getStockListMode;
  window.getAllStocks = getAllStocks;
  window.getFrequentStocks = getFrequentStocks;
  window.STOCK_DATA_SCHEMA = STOCK_DATA_SCHEMA;
  window.SQLITE_BACKUP_FILENAME = SQLITE_BACKUP_FILENAME;
}
