/**
 * 股票代码管理插件
 * 用于管理股票代码、税率等数据
 */

class StockCodeManagerPlugin extends BaseManagerPlugin {
  // ============================================================
  // 配置常量（集中管理，避免硬编码）
  // ============================================================
  static CACHE_KEY = 'stocks_db_cache';
  
  // ============================================================
  // 实例属性
  // ============================================================
  constructor() {
    super('StockCodeManager', 'stocks_db_cache', 'stocks', '股票代码管理', 'ALL_STOCKS');
  }

  /**
   * 切换标签页（使用基类方法）
   */
  switchToTab(tabId) {
    super.switchToTab(tabId);
  }

  /**
   * 获取表名（封装重复的 schema 查询逻辑）
   * @param {string} tableType - 'stocks' | 'taxRates' | 'metadata'
   */
  getTableName(tableType) {
    const schema = window.STOCK_DATA_SCHEMA;
    if (schema && schema[tableType] && schema[tableType].tableName) {
      return schema[tableType].tableName;
    }
    const fallbacks = { stocks: 'stocks', taxRates: 'tax_rates', metadata: '_metadata' };
    return fallbacks[tableType] || tableType;
  }

  /**
   * 获取 localStorage 缓存键名
   */
  getCacheKey() {
    return StockCodeManagerPlugin.CACHE_KEY;
  }

  /**
   * HTML 转义（防 XSS）
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 动态检测 sql.js 是否可用
   */
  isSqlJsAvailable() {
    return typeof initSqlJs === 'function';
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;
    
    console.log('股票代码管理插件初始化中...');
    
    // 检查 FloatingWindow 是否可用
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化股票代码管理插件');
      return;
    }
    
    // 绑定按钮事件
    this.bindEvents();
    
    this.initialized = true;
    console.log('股票代码管理插件初始化完成');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const self = this;
    const bindClick = () => {
      const stockCodeManagerBtn = document.getElementById('stockCodeManagerBtn');
      if (stockCodeManagerBtn) {
        stockCodeManagerBtn.addEventListener('click', () => self.openStockCodeManager());
      }
    };
    
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindClick);
    } else {
      bindClick();
    }
    
    // 注意：stockListExportBtn 的绑定已移至 StockListDisplayPlugin
  }

  /**
   * 打开股票代码管理窗口
   */
  async openStockCodeManager() {
    // 检查是否已有窗口实例存在
    if (this.floatingWindow) {
      try {
        // 聚焦到已有窗口
        this.floatingWindow.show();
        // 如果数据库已关闭，重新初始化
        if (!this.sqliteDB) {
          await this.initSQLite();
        }
        await this.loadStockData();
        this.loadTaxData();
        this.loadSettings();
        return;
      } catch (e) {
        // 如果聚焦失败，可能窗口已被关闭，继续创建新窗口
        console.log('聚焦窗口失败，创建新窗口:', e);
        this.floatingWindow = null;
      }
    }
    
    // 构建HTML内容
    const content = `
      <div class="stock-manager-container">
        <div class="header">
          <h1>股票代码管理</h1>
        </div>
        
        <div id="statusMessage" class="status-message" style="display: none;"></div>
        
        <!-- 标签页 -->
        <div style="border-bottom: 1px solid #ddd; margin-bottom: 15px;">
          <button data-stock-code-manager-tab="stocks" onclick="window.stockCodeManager.switchToTab('stocks')" class="tab-btn active">股票列表</button>
          <button data-stock-code-manager-tab="tax" onclick="window.stockCodeManager.switchToTab('tax')" class="tab-btn">税率设置</button>
          <button data-stock-code-manager-tab="settings" onclick="window.stockCodeManager.switchToTab('settings')" class="tab-btn">设置</button>
        </div>

        <div data-stock-code-manager-panel="stocks" style="display: block;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <div>
                <button class="btn btn-primary" onclick="window.stockCodeManager.showAddStockModal()">新增股票</button>
              </div>
              <div>
                <input type="text" id="stockSearch" placeholder="搜索股票" style="padding: 6px; border: 1px solid #ddd; border-radius: 4px;">
              </div>
            </div>
            <table id="stocksTable">
              <thead>
                <tr>
                  <th>股票代码</th>
                  <th>股票名称</th>
                  <th>股票名称-截图用</th>
                  <th>交易单位</th>
                  <th>市场</th>
                  <th>类型</th>
                  <th>频繁交易</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="stocksTableBody">
                <!-- 股票数据将通过JavaScript动态加载 -->
              </tbody>
            </table>
          </div>
          
          <!-- 税率设置标签页 -->
          <div data-stock-code-manager-panel="tax" style="display: none;">
            <button class="btn btn-primary" onclick="window.stockCodeManager.showAddTaxModal()">新增税率</button>
            <table id="taxTable">
              <thead>
                <tr>
                  <th>类型</th>
                  <th>买入税率</th>
                  <th>卖出税率</th>
                  <th>返点</th>
                  <th>最低税额</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody id="taxTableBody">
                <!-- 税率数据将通过JavaScript动态加载 -->
              </tbody>
            </table>
          </div>
          
          <!-- 设置标签页 -->
          <div data-stock-code-manager-panel="settings" style="display: none;">
            <div id="stockCodeManagerInfoPanel" style="padding: 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px;"></div>
            <div style="display: flex; gap: 10px; margin-top: 15px;">
              <button class="btn btn-secondary" onclick="window.stockCodeManager.exportToSQLite()">💾 备份至 SQLite</button>
              <button class="btn btn-secondary" onclick="window.stockCodeManager.importSQLiteDatabase()" title="从 SQLite 文件导入数据">📥 导入数据库</button>
              <button class="btn btn-secondary" onclick="window.stockCodeManager.initializeFromJsData()" title="使用 stockData.js 的数据初始化当前股票清单资料">🔄 初始化</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 新增/编辑股票模态框 -->
      <div id="stockModal" class="modal">
        <div class="modal-content">
          <span class="close" onclick="window.stockCodeManager.closeStockModal()">&times;</span>
          <h2 id="stockModalTitle">新增股票</h2>
          <form id="stockForm" onsubmit="event.preventDefault(); window.stockCodeManager.saveStock()">
            <div class="form-group">
              <label for="stockCode">股票代码</label>
              <input type="text" id="stockCode" name="stockCode" placeholder="如：2330">
            </div>
            <div class="form-group">
              <label for="stockName">股票名称 <span style="color: red;">*</span></label>
              <input type="text" id="stockName" name="stockName" required>
            </div>
            <div class="form-group">
              <label for="stockScreenshotName">股票名称-截图用</label>
              <input type="text" id="stockScreenshotName" name="stockScreenshotName" placeholder="用于截图显示的名称（可选）">
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="stockQty">交易单位 <span style="color: red;">*</span></label>
                <input type="number" id="stockQty" name="stockQty" min="1" required>
              </div>
              <div class="form-group">
                <label for="stockMarket">市场 <span style="color: red;">*</span></label>
                <select id="stockMarket" name="stockMarket" required>
                  <option value="台股">台股</option>
                  <option value="陆股">陆股</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label for="stockType">类型 <span style="color: red;">*</span></label>
              <select id="stockType" name="stockType" required>
                <option value="tETF">台股ETF</option>
                <option value="tA">台股个股</option>
                <option value="cETF">陆股ETF</option>
                <option value="cA">陆股个股</option>
                <option value="cG">贵金属</option>
              </select>
            </div>
            <div class="form-group">
              <label for="stockIsFrequent">
                <input type="checkbox" id="stockIsFrequent" name="stockIsFrequent"> 频繁交易股票
              </label>
            </div>
            <div style="text-align: right; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" onclick="window.stockCodeManager.closeStockModal()">取消</button>
              <button type="submit" class="btn btn-primary" style="margin-left: 10px;">保存</button>
            </div>
          </form>
        </div>
      </div>

      <!-- 新增/编辑税率模态框 -->
      <div id="taxModal" class="modal">
        <div class="modal-content">
          <span class="close" onclick="window.stockCodeManager.closeTaxModal()">&times;</span>
          <h2 id="taxModalTitle">新增税率</h2>
          <form id="taxForm" onsubmit="event.preventDefault(); window.stockCodeManager.saveTax()">
            <div class="form-group">
              <label for="taxType">类型 <span style="color: red;">*</span></label>
              <input type="text" id="taxType" name="taxType" required>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="taxBuy">买入税率 <span style="color: red;">*</span></label>
                <input type="number" id="taxBuy" name="taxBuy" step="0.01" required>
              </div>
              <div class="form-group">
                <label for="taxSell">卖出税率 <span style="color: red;">*</span></label>
                <input type="number" id="taxSell" name="taxSell" step="0.01" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label for="taxRebate">返点</label>
                <input type="number" id="taxRebate" name="taxRebate" step="0.01" value="0">
              </div>
              <div class="form-group">
                <label for="taxMinAmount">最低税额</label>
                <input type="number" id="taxMinAmount" name="taxMinAmount" step="0.01" value="0">
              </div>
            </div>
            <div style="text-align: right; margin-top: 20px;">
              <button type="button" class="btn btn-secondary" onclick="window.stockCodeManager.closeTaxModal()">取消</button>
              <button type="submit" class="btn btn-primary" style="margin-left: 10px;">保存</button>
            </div>
          </form>
        </div>
      </div>
    `;
    
    // 创建浮动窗口
    this.floatingWindow = new FloatingWindow({
      title: '股票代码管理',
      sourceFile: 'stockCodeManagerPlugin.js',
      width: '1000px',
      height: '800px',
      draggable: false,
      on: {
        close: () => {
          // 只隐藏窗口，不销毁数据库（以便下次打开时可以复用）
          this.floatingWindow.hide();
        }
      }
    });
    
    // 设置窗口内容
    this.floatingWindow.setContent(content);
    
    // 显示窗口
    this.floatingWindow.show();
    
    // 等待窗口完全渲染后再加载数据
    requestAnimationFrame(() => {
      requestAnimationFrame(async () => {
        // 加载数据（必须等待 SQLite 初始化完成）
        await this.loadStockData();
        this.loadTaxData();
        this.loadSettings();
        
        // 绑定标签页事件
        this.bindTabEvents();
        
        // 绑定搜索事件
        this.bindSearchEvents();
      });
    });
  }

  /**
   * 初始化 SQLite 数据库
   */
  async initSQLite() {
    if (this.sqliteDB) return this.sqliteDB;
    
    if (!this.isSqlJsAvailable() || typeof initSqlJs !== 'function') {
      console.error('[StockCodeManager] sql.js 未加载');
      throw new Error('sql.js 未加载，无法使用数据库功能');
    }
    
    try {
      const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.9.0/${file}`
      });
      
      // 尝试从 localStorage 缓存加载 SQLite 数据库
      const cachedDB = localStorage.getItem(this.getCacheKey());
      if (cachedDB) {
        try {
          const uint8Array = new Uint8Array(JSON.parse(cachedDB));
          this.sqliteDB = new SQL.Database(uint8Array);
          console.log('[StockCodeManager] 从缓存加载 SQLite 数据库成功');
          
          // 检测 schema 版本是否需要重建
          this.ensureSchemaUpToDate(this.sqliteDB);
          
          // 重建后重新缓存
          this._syncToLocalStorage();
          
          return this.sqliteDB;
        } catch (e) {
          console.warn('[StockCodeManager] 从缓存加载失败:', e);
        }
      }
      
      // 如果没有缓存，创建新的空数据库并初始化表结构
      this.sqliteDB = new SQL.Database();
      this.initSQLiteTables(this.sqliteDB);
      console.log('[StockCodeManager] 创建新 SQLite 数据库成功（schema version: ' +
        (window.STOCK_DATA_SCHEMA && window.STOCK_DATA_SCHEMA.version) + ')');
      return this.sqliteDB;
    } catch (error) {
      console.error('[StockCodeManager] 初始化 SQLite 失败:', error);
      throw error;
    }
  }

  /**
   * 根据 stockData.js 的 STOCK_DATA_SCHEMA 动态创建表结构
   */
  initSQLiteTables(db) {
    const schema = window.STOCK_DATA_SCHEMA;
    if (!schema) {
      console.warn('[StockCodeManager] STOCK_DATA_SCHEMA 未定义，使用默认结构');
    }
    
    // 创建元数据表
    db.run(`
      CREATE TABLE IF NOT EXISTS _metadata (
        key TEXT PRIMARY KEY,
        value TEXT
      )
    `);
    
    // 根据 schema 动态建表
    if (schema && schema.stocks) {
      const cols = schema.stocks.columns.map(c => `${c.name} ${c.type}`).join(', ');
      db.run(`CREATE TABLE IF NOT EXISTS ${schema.stocks.tableName} (${cols})`);
    } else {
      db.run(`
        CREATE TABLE IF NOT EXISTS stocks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT UNIQUE NOT NULL,
          qty INTEGER NOT NULL,
          market TEXT NOT NULL,
          type TEXT NOT NULL,
          is_frequent INTEGER DEFAULT 0
        )
      `);
    }
    
    if (schema && schema.taxRates) {
      const cols = schema.taxRates.columns.map(c => `${c.name} ${c.type}`).join(', ');
      db.run(`CREATE TABLE IF NOT EXISTS ${schema.taxRates.tableName} (${cols})`);
    } else {
      db.run(`
        CREATE TABLE IF NOT EXISTS tax_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT UNIQUE NOT NULL,
          buy REAL NOT NULL,
          sell REAL NOT NULL,
          rebate REAL NOT NULL,
          min_tax_amount REAL NOT NULL
        )
      `);
    }
    
    // 写入 schema 版本到元数据表
    const version = (schema && schema.version) || 'unknown';
    try {
      db.run("INSERT OR REPLACE INTO _metadata (key, value) VALUES ('schema_version', ?)", [version]);
      db.run("INSERT OR REPLACE INTO _metadata (key, value) VALUES ('schema_updated', ?)", [
        (schema && schema.updatedAt) || new Date().toISOString().slice(0, 10)
      ]);
    } catch(e) {
      console.warn('[StockCodeManager] 写入元数据失败:', e);
    }
  }

  /**
   * 检查数据库中的 schema 版本是否与当前 stockData.js 一致
   * 返回: { match: boolean, dbVersion: string, currentVersion: string }
   */
  checkSchemaVersion(db) {
    const schema = window.STOCK_DATA_SCHEMA;
    const currentVersion = (schema && schema.version) || 'unknown';
    
    try {
      const result = db.exec("SELECT value FROM _metadata WHERE key = 'schema_version'");
      let dbVersion = null;
      
      if (result.length > 0 && result[0].values.length > 0) {
        dbVersion = result[0].values[0][0];
      }
      
      return {
        match: dbVersion === currentVersion,
        dbVersion: dbVersion || '(空)',
        currentVersion: currentVersion
      };
    } catch(e) {
      return { match: false, dbVersion: '(读取失败)', currentVersion };
    }
  }

  /**
   * 检测并处理 schema 变更：
   * 如果 DB 中 schema 版本与当前不一致 → 删除旧表并重建
   */
  ensureSchemaUpToDate(db) {
    const check = this.checkSchemaVersion(db);
    
    if (!check.match) {
      console.warn(`[StockCodeManager] Schema 版本不匹配！DB=${check.dbVersion}, 当前=${check.currentVersion}，将重建表`);
      
      // 删除旧表
      try { db.run("DROP TABLE IF EXISTS stocks"); } catch(e) {}
      try { db.run("DROP TABLE IF EXISTS tax_rates"); } catch(e) {}
      try { db.run("DROP TABLE IF EXISTS _metadata"); } catch(e) {}
      
      // 用最新 schema 重建
      this.initSQLiteTables(db);
      
      console.log('[StockCodeManager] 表结构已按最新 schema 重建完成');
      return true; // 表示发生了重建
    }
    
    return false;
  }

  /**
   * 从文件加载 SQLite 数据库
   */
  async loadSQLiteFromFile(file) {
    if (!this.isSqlJsAvailable() || typeof initSqlJs !== 'function') {
      throw new Error('sql.js 未加载');
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const SQL = await initSqlJs({
            locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.9.0/${file}`
          });
          
          if (this.sqliteDB) {
            this.sqliteDB.close();
          }
          
          const uint8Array = new Uint8Array(e.target.result);
          this.sqliteDB = new SQL.Database(uint8Array);
          
          // 检测 schema 版本，不匹配则自动重建表结构
          const rebuilt = this.ensureSchemaUpToDate(this.sqliteDB);
          if (rebuilt) {
            console.log('[StockCodeManager] 导入的数据库 schema 已更新，旧数据已清除');
          }
          
          // 缓存到 localStorage
          this._syncToLocalStorage();
          
          resolve(this.sqliteDB);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('读取文件失败'));
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * 从 SQLite 加载股票数据
   */
  loadStockDataFromSQLite() {
    if (!this.sqliteDB) {
      console.warn('[StockCodeManager] SQLite 数据库未初始化');
      return { stocks: [], frequentStocks: [], taxRates: {} };
    }
    
    try {
      // 加载股票数据
      const stockResult = this.sqliteDB.exec("SELECT name, code, screenshot_name, qty, market, type, is_frequent FROM stocks");
      const stocks = [];
      const frequentStocks = [];
      
      if (stockResult.length > 0 && stockResult[0].values) {
        stockResult[0].values.forEach(row => {
          const stock = {
            name: row[0],
            code: row[1],
            screenshotName: row[2],
            qty: row[3],
            market: row[4],
            type: row[5]
          };
          stocks.push(stock);
          
          if (row[5] === 1) {
            frequentStocks.push(stock);
          }
        });
      }
      
      // 加载税率数据
      const taxResult = this.sqliteDB.exec("SELECT type, buy, sell, rebate, min_tax_amount FROM tax_rates");
      const taxRates = {};
      
      if (taxResult.length > 0 && taxResult[0].values) {
        taxResult[0].values.forEach(row => {
          taxRates[row[0]] = {
            buy: row[1],
            sell: row[2],
            rebate: row[3],
            minTaxAmount: row[4]
          };
        });
      }
      
      return { stocks, frequentStocks, taxRates };
    } catch (error) {
      console.error('[StockCodeManager] 从 SQLite 加载数据失败:', error);
      return { stocks: [], frequentStocks: [], taxRates: {} };
    }
  }

  /**
   * 检查 SQLite 数据库是否为空（无股票数据）
   */
  isSQLiteEmpty() {
    if (!this.sqliteDB) return true;
    try {
      const result = this.sqliteDB.exec("SELECT COUNT(*) FROM stocks");
      const count = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : 0;
      return count === 0;
    } catch (e) {
      return true;
    }
  }

  /**
   * 将 .js 中的初始数据写入 SQLite
   */
  async seedSQLiteFromJsData() {
    if (!this.sqliteDB || !this.isSqlJsAvailable()) return false;
    
    try {
      const stocksTable = this.getTableName('stocks');
      const taxRatesTable = this.getTableName('taxRates');
      
      // 写入股票数据
      const allStocks = window.ALL_STOCKS || [];
      const frequentStocks = window.FREQUENT_STOCKS || [];
      const frequentNames = new Set(frequentStocks.map(s => s.name));
      
      allStocks.forEach(stock => {
        this.sqliteDB.run(
          `INSERT OR REPLACE INTO ${stocksTable} (name, code, screenshot_name, qty, market, type, is_frequent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stock.name, stock.code || '', stock.screenshotName || '', stock.qty, stock.market, stock.type, frequentNames.has(stock.name) ? 1 : 0]
        );
      });
      
      // 写入税率数据
      const taxRates = window.TAX_RATES || {};
      Object.keys(taxRates).forEach(type => {
        const rate = taxRates[type];
        this.sqliteDB.run(
          `INSERT OR REPLACE INTO ${taxRatesTable} (type, buy, sell, rebate, min_tax_amount) VALUES (?, ?, ?, ?, ?)`,
          [type, rate.buy, rate.sell, rate.rebate, rate.minTaxAmount]
        );
      });
      
      // 更新缓存
      this._syncToLocalStorage();
      
      console.log(`[StockCodeManager] 已将 .js 数据写入 SQLite (${allStocks.length} 只股票, ${Object.keys(taxRates).length} 种税率)`);
      return true;
    } catch (error) {
      console.error('[StockCodeManager] 写入 .js 数据到 SQLite 失败:', error);
      return false;
    }
  }

  /**
   * 加载股票数据（自动检测逻辑）
   * 
   * 策略：
   *   1. 尝试从 SQLite 加载
   *   2. 如果 SQLite 有数据 → 使用 SQLite 数据
   *   3. 如果 SQLite 为空或不可用 → 使用 .js 数据，并自动写入 SQLite
   */
  async loadStockData() {
    try {
      const content = this.getWindowContent();
      if (!content) {
        console.error('[loadStockData] getWindowContent() 返回 null');
        return;
      }
      
      let stocks = [];
      let frequentStocks = [];
      let dataSource = 'js';
      
      // 尝试初始化并加载 SQLite
      let sqliteAvailable = false;
      try {
        await this.initSQLite();
        sqliteAvailable = true;
      } catch (e) {
        console.warn('[loadStockData] SQLite 不可用，使用 .js 数据');
      }
      
      if (sqliteAvailable && !this.isSQLiteEmpty()) {
        // SQLite 有数据 → 使用 SQLite
        const data = this.loadStockDataFromSQLite();
        stocks = data.stocks;
        frequentStocks = data.frequentStocks;
        dataSource = 'sqlite';
        
        window.STOCKS = stocks;
        window.FREQUENT_STOCKS = frequentStocks;
        
        if (Object.keys(data.taxRates).length > 0) {
          window.TAX_RATES = data.taxRates;
        }
      } else {
        // SQLite 为空或不可用 → 使用 .js 数据
        stocks = window.STOCKS || [...(window.ALL_STOCKS || [])];
        frequentStocks = window.FREQUENT_STOCKS || [...(window.FREQUENT_STOCKS || [])];
        dataSource = 'js';
        
        // 如果 SQLite 可用但为空，自动写入 .js 数据
        if (sqliteAvailable && this.isSQLiteEmpty()) {
          await this.seedSQLiteFromJsData();
        }
      }
      
      const frequentStockNames = new Set(frequentStocks.map(stock => stock.name));
      
      const tbody = content.querySelector('#stocksTableBody');
      if (!tbody) {
        console.error('[loadStockData] 找不到 #stocksTableBody 元素');
        return;
      }
      
      tbody.innerHTML = '';
      
      stocks.forEach(stock => {
        const row = document.createElement('tr');
        const isFrequent = frequentStockNames.has(stock.name) ? '是' : '否';
        
        row.innerHTML = `
          <td>${this.escapeHtml(stock.code || '')}</td>
          <td>${this.escapeHtml(stock.name)}</td>
          <td>${this.escapeHtml(stock.screenshotName || '')}</td>
          <td>${this.escapeHtml(String(stock.qty))}</td>
          <td>${this.escapeHtml(stock.market)}</td>
          <td>${this.escapeHtml(stock.type)}</td>
          <td>${isFrequent}</td>
          <td class="actions">
            <button class="btn btn-warning" data-action="edit" data-name="${this.escapeHtml(stock.name)}" title="编辑">编辑</button>
            <button class="btn btn-danger" data-action="delete" data-name="${this.escapeHtml(stock.name)}" title="删除">删除</button>
          </td>
        `;
        tbody.appendChild(row);
      });
      
      // 使用事件委托绑定按钮事件（防 XSS）
      tbody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const name = e.target.dataset.name;
          if (action === 'edit') this.showEditStockModal(name);
          else if (action === 'delete') this.deleteStock(name);
        });
      });
    } catch (error) {
      console.error('加载股票数据失败:', error);
      this.showStatusMessage('加载股票数据失败', false);
    }
  }

  /**
   * 获取浮动窗口的内容元素
   */
  getWindowContent() {
    if (!this.floatingWindow || !this.floatingWindow.getElement()) {
      return null;
    }
    return this.floatingWindow.getElement().querySelector('.floating-body');
  }

  /**
   * 绑定标签页事件
   */
  bindTabEvents() {
    const content = this.getWindowContent();
    if (!content) return;
    
    const tabs = content.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        const tabContents = content.querySelectorAll('.tab-content');
        tabContents.forEach(c => c.classList.remove('active'));
        
        const tabId = tab.dataset.tab;
        const activeContent = content.querySelector(`#${tabId}Tab`);
        if (activeContent) activeContent.classList.add('active');
      });
    });
  }

  /**
   * 绑定搜索事件
   */
  bindSearchEvents() {
    const content = this.getWindowContent();
    if (!content) return;
    
    const searchInput = content.querySelector('#stockSearch');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.filterStocks(searchInput.value));
    }
  }

  /**
   * 过滤股票
   */
  filterStocks(searchTerm) {
    const content = this.getWindowContent();
    if (!content) return;
    
    const tbody = content.querySelector('#stocksTableBody');
    if (!tbody) return;
    
    tbody.querySelectorAll('tr').forEach(row => {
      const name = row.querySelector('td:first-child').textContent.toLowerCase();
      row.style.display = searchTerm === '' || name.includes(searchTerm.toLowerCase()) ? '' : 'none';
    });
  }

  /**
   * 显示状态消息
   */
  showStatusMessage(message, isSuccess = true) {
    const content = this.getWindowContent();
    if (!content) return;
    
    const statusDiv = content.querySelector('#statusMessage');
    if (!statusDiv) return;
    
    statusDiv.textContent = message;
    statusDiv.className = `status-message ${isSuccess ? 'status-success' : 'status-error'}`;
    statusDiv.style.display = 'block';
    
    setTimeout(() => { statusDiv.style.display = 'none'; }, 3000);
  }

  /**
   * 导出当前内存数据为 SQLite 数据库文件
   */
  async exportToSQLite() {
    try {
      this.showStatusMessage('正在生成数据库文件...');
      
      if (!this.isSqlJsAvailable()) throw new Error('sql.js 未加载');
      
      const SQL = await initSqlJs({
        locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.9.0/${file}`
      });
      
      const db = new SQL.Database();
      this.initSQLiteTables(db);
      
      const stocksTable = this.getTableName('stocks');
      const taxRatesTable = this.getTableName('taxRates');
      const stocks = window.STOCKS || [];
      const frequentStocks = window.FREQUENT_STOCKS || [];
      const frequentNames = new Set(frequentStocks.map(s => s.name));
      
      stocks.forEach(stock => {
        db.run(
          `INSERT OR REPLACE INTO ${stocksTable} (name, code, screenshot_name, qty, market, type, is_frequent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stock.name, stock.code || '', stock.screenshotName || '', stock.qty, stock.market, stock.type, frequentNames.has(stock.name) ? 1 : 0]
        );
      });
      
      const taxRates = window.TAX_RATES || {};
      Object.keys(taxRates).forEach(type => {
        const rate = taxRates[type];
        db.run(
          `INSERT OR REPLACE INTO ${taxRatesTable} (type, buy, sell, rebate, min_tax_amount) VALUES (?, ?, ?, ?, ?)`,
          [type, rate.buy, rate.sell, rate.rebate, rate.minTaxAmount]
        );
      });
      
      const data = db.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = window.SQLITE_BACKUP_FILENAME || 'stock_data.db';
      a.click();
      URL.revokeObjectURL(url);
      db.close();
      
      this.showStatusMessage(`数据库导出成功！${stocks.length} 只股票 | ${Object.keys(taxRates).length} 种税率`);
    } catch (error) {
      console.error('[StockCodeManager] 导出失败:', error);
      this.showStatusMessage('导出失败: ' + error.message, false);
    }
  }

  /**
   * 加载税率数据
   */
  loadTaxData() {
    try {
      const content = this.getWindowContent();
      if (!content) return;
      
      const taxRates = window.TAX_RATES || {};
      const tbody = content.querySelector('#taxTableBody');
      if (!tbody) return;
      
      tbody.innerHTML = '';
      
      Object.keys(taxRates).forEach(type => {
        const rate = taxRates[type];
        const row = document.createElement('tr');
        
        row.innerHTML = `
          <td>${this.escapeHtml(type)}</td>
          <td>${this.escapeHtml(String(rate.buy))}</td>
          <td>${this.escapeHtml(String(rate.sell))}</td>
          <td>${this.escapeHtml(String(rate.rebate))}</td>
          <td>${this.escapeHtml(String(rate.minTaxAmount))}</td>
          <td class="actions">
            <button class="btn btn-warning" data-action="editTax" data-type="${this.escapeHtml(type)}" title="编辑">编辑</button>
            <button class="btn btn-danger" data-action="deleteTax" data-type="${this.escapeHtml(type)}" title="删除">删除</button>
          </td>
        `;
        tbody.appendChild(row);
      });
      
      // 使用事件委托绑定按钮事件（防 XSS）
      tbody.querySelectorAll('button[data-action]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const action = e.target.dataset.action;
          const type = e.target.dataset.type;
          if (action === 'editTax') this.showEditTaxModal(type);
          else if (action === 'deleteTax') this.deleteTax(type);
        });
      });
    } catch (error) {
      console.error('加载税率数据失败:', error);
      this.showStatusMessage('加载税率数据失败', false);
    }
  }

  /**
   * 加载设置
   */
  loadSettings() {
    try {
      const content = this.getWindowContent();
      if (!content) return;
      
      const defaultMode = window.getStockListMode ? window.getStockListMode() : 'all';
      const modeSelect = content.querySelector('#defaultStockListMode');
      if (modeSelect) {
        modeSelect.value = defaultMode;
      }

      this.renderDataInfoPanel();
    } catch (error) {
      console.error('加载设置失败:', error);
    }
  }

  

  /**
   * 高亮指定行（操作反馈）
   * @param {string} stockName - 要高亮的股票名称（通过 data-name 匹配）
   */
  highlightRow(stockName) {
    const content = this.getWindowContent();
    if (!content) return;
    const tbody = content.querySelector('#stocksTableBody');
    if (!tbody) return;
    const row = tbody.querySelector(`tr [data-name="${this.escapeHtml(stockName)}"]`);
    if (row) {
      const tr = row.closest('tr');
      if (tr) {
        tr.classList.add('row-highlight');
        setTimeout(() => tr.classList.remove('row-highlight'), 2000);
      }
    }
  }

  /**
   * 显示新增股票模态框
   */
  showAddStockModal() {
    const content = this.getWindowContent();
    if (!content) return;
    
    const modal = content.querySelector('#stockModal');
    const modalTitle = content.querySelector('#stockModalTitle');
    const form = content.querySelector('#stockForm');
    
    if (!modal || !modalTitle || !form) return;
    
    modalTitle.textContent = '新增股票';
    form.reset();

    const stockNameInput = content.querySelector('#stockName');
    if (stockNameInput) stockNameInput.removeAttribute('readonly');

    modal.style.display = 'block';
  }

  /**
   * 显示编辑股票模态框
   * @param {string} stockName - 股票名称
   */
  showEditStockModal(stockName) {
    const content = this.getWindowContent();
    if (!content) return;
    
    const stocks = window.STOCKS || [];
    const stock = stocks.find(s => s.name === stockName);
    
    if (stock) {
      const modal = content.querySelector('#stockModal');
      const modalTitle = content.querySelector('#stockModalTitle');
      
      if (!modal || !modalTitle) return;
      
      modalTitle.textContent = '编辑股票';
      
      const stockCodeInput = content.querySelector('#stockCode');
      const stockNameInput = content.querySelector('#stockName');
      const stockScreenshotNameInput = content.querySelector('#stockScreenshotName');
      const stockQtyInput = content.querySelector('#stockQty');
      const stockMarketSelect = content.querySelector('#stockMarket');
      const stockTypeSelect = content.querySelector('#stockType');
      const stockIsFrequentInput = content.querySelector('#stockIsFrequent');
      
      if (!stockCodeInput || !stockNameInput || !stockScreenshotNameInput || !stockQtyInput || !stockMarketSelect || !stockTypeSelect || !stockIsFrequentInput) return;
      
      stockCodeInput.value = stock.code || '';
      stockNameInput.value = stock.name;
      stockScreenshotNameInput.value = stock.screenshotName || '';
      stockNameInput.setAttribute('readonly', 'true');
      stockQtyInput.value = stock.qty;
      stockMarketSelect.value = stock.market;
      stockTypeSelect.value = stock.type;
      
      // 检查是否为频繁交易股票
      const frequentStocks = window.FREQUENT_STOCKS || [];
      const isFrequent = frequentStocks.some(s => s.name === stockName);
      stockIsFrequentInput.checked = isFrequent;
      
      modal.style.display = 'block';
    }
  }

  /**
   * 关闭股票模态框
   */
  closeStockModal() {
    const content = this.getWindowContent();
    if (!content) return;
    
    const modal = content.querySelector('#stockModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * 保存股票
   */
  async saveStock() {
    try {
      const content = this.getWindowContent();
      if (!content) return;
      
      const form = content.querySelector('#stockForm');
      if (!form) return;
      
      // 表单验证
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      // 获取表单数据
      const stockCodeInput = content.querySelector('#stockCode');
      const stockNameInput = content.querySelector('#stockName');
      const stockScreenshotNameInput = content.querySelector('#stockScreenshotName');
      const stockQtyInput = content.querySelector('#stockQty');
      const stockMarketSelect = content.querySelector('#stockMarket');
      const stockTypeSelect = content.querySelector('#stockType');
      const stockIsFrequentInput = content.querySelector('#stockIsFrequent');
      
      if (!stockCodeInput || !stockNameInput || !stockScreenshotNameInput || !stockQtyInput || !stockMarketSelect || !stockTypeSelect || !stockIsFrequentInput) return;
      
      const stockCode = stockCodeInput.value.trim();
      const stockName = stockNameInput.value.trim();
      const stockScreenshotName = stockScreenshotNameInput.value.trim();
      const stockQty = parseInt(stockQtyInput.value);
      const stockMarket = stockMarketSelect.value;
      const stockType = stockTypeSelect.value;
      const stockIsFrequent = stockIsFrequentInput.checked;
      
      // 检查股票是否已存在
      const existingStocks = window.STOCKS || [];
      const existingStockIndex = existingStocks.findIndex(s => s.name === stockName);
      
      if (existingStockIndex >= 0) {
        existingStocks[existingStockIndex] = {
          name: stockName,
          code: stockCode,
          screenshotName: stockScreenshotName,
          qty: stockQty,
          market: stockMarket,
          type: stockType
        };
      } else {
        existingStocks.push({
          name: stockName,
          code: stockCode,
          screenshotName: stockScreenshotName,
          qty: stockQty,
          market: stockMarket,
          type: stockType
        });
      }
      
      // 更新频繁交易股票
      let frequentStocks = window.FREQUENT_STOCKS || [];
      if (stockIsFrequent && !frequentStocks.some(s => s.name === stockName)) {
        frequentStocks.push({
          name: stockName,
          code: stockCode,
          screenshotName: stockScreenshotName,
          qty: stockQty,
          market: stockMarket,
          type: stockType
        });
      } else if (!stockIsFrequent) {
        frequentStocks = frequentStocks.filter(s => s.name !== stockName);
      }
      
      // 更新全局变量
      window.STOCKS = existingStocks;
      window.FREQUENT_STOCKS = frequentStocks;
      
      // 如果是数据库模式，同步写入 SQLite
      if (this.sqliteDB) {
        const stocksTable = this.getTableName('stocks');
        const isFrequent = frequentStocks.some(s => s.name === stockName) ? 1 : 0;
        this.sqliteDB.run(
          `INSERT OR REPLACE INTO ${stocksTable} (name, code, screenshot_name, qty, market, type, is_frequent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stockName, stockCode, stockScreenshotName, stockQty, stockMarket, stockType, isFrequent]
        );
        // 更新缓存
        this._syncToLocalStorage();
      }
      
      window.dispatchEvent(new CustomEvent('stockListChanged', { 
        detail: { 
          mode: window.getStockListMode ? window.getStockListMode() : 'all', 
          stocks: existingStocks 
        } 
      }));
      
      this.showStatusMessage('股票保存成功');
      this.closeStockModal();
      await this.loadStockData();
      this.highlightRow(stockName);
    } catch (error) {
      console.error('保存股票失败:', error);
      this.showStatusMessage('保存股票失败', false);
    }
  }

  /**
   * 删除股票
   * @param {string} stockName - 股票名称
   */
  async deleteStock(stockName) {
    if (confirm(`确定要删除股票 "${stockName}" 吗？`)) {
      try {
        let stocks = window.STOCKS || [];
        stocks = stocks.filter(s => s.name !== stockName);
        
        let frequentStocks = window.FREQUENT_STOCKS || [];
        frequentStocks = frequentStocks.filter(s => s.name !== stockName);
        
        window.STOCKS = stocks;
        window.FREQUENT_STOCKS = frequentStocks;
        
        // 如果是数据库模式，同步从 SQLite 删除
        if (this.sqliteDB) {
          const stocksTable = this.getTableName('stocks');
          this.sqliteDB.run(`DELETE FROM ${stocksTable} WHERE name = ?`, [stockName]);
          // 更新缓存
          this._syncToLocalStorage();
        }
        
        window.dispatchEvent(new CustomEvent('stockListChanged', { 
          detail: { 
            mode: window.getStockListMode ? window.getStockListMode() : 'all', 
            stocks: stocks 
          } 
        }));
        
        this.showStatusMessage('股票删除成功');
        await this.loadStockData();
      } catch (error) {
        console.error('删除股票失败:', error);
        this.showStatusMessage('删除股票失败', false);
      }
    }
  }

  /**
   * 显示新增税率模态框
   */
  showAddTaxModal() {
    const content = this.getWindowContent();
    if (!content) return;
    
    const modal = content.querySelector('#taxModal');
    const modalTitle = content.querySelector('#taxModalTitle');
    const form = content.querySelector('#taxForm');
    
    if (!modal || !modalTitle || !form) return;
    
    modalTitle.textContent = '新增税率';
    form.reset();
    modal.style.display = 'block';
  }

  /**
   * 显示编辑税率模态框
   * @param {string} taxType - 税率类型
   */
  showEditTaxModal(taxType) {
    const content = this.getWindowContent();
    if (!content) return;
    
    const taxRates = window.TAX_RATES || {};
    const rate = taxRates[taxType];
    
    if (rate) {
      const modal = content.querySelector('#taxModal');
      const modalTitle = content.querySelector('#taxModalTitle');
      
      if (!modal || !modalTitle) return;
      
      modalTitle.textContent = '编辑税率';
      
      const taxTypeInput = content.querySelector('#taxType');
      const taxBuyInput = content.querySelector('#taxBuy');
      const taxSellInput = content.querySelector('#taxSell');
      const taxRebateInput = content.querySelector('#taxRebate');
      const taxMinAmountInput = content.querySelector('#taxMinAmount');
      
      if (!taxTypeInput || !taxBuyInput || !taxSellInput || !taxRebateInput || !taxMinAmountInput) return;
      
      taxTypeInput.value = taxType;
      taxBuyInput.value = rate.buy;
      taxSellInput.value = rate.sell;
      taxRebateInput.value = rate.rebate;
      taxMinAmountInput.value = rate.minTaxAmount;
      
      modal.style.display = 'block';
    }
  }

  /**
   * 关闭税率模态框
   */
  closeTaxModal() {
    const content = this.getWindowContent();
    if (!content) return;
    
    const modal = content.querySelector('#taxModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * 保存税率
   */
  async saveTax() {
    try {
      const content = this.getWindowContent();
      if (!content) return;
      
      const form = content.querySelector('#taxForm');
      if (!form) return;
      
      // 表单验证
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      
      // 获取表单数据
      const taxTypeInput = content.querySelector('#taxType');
      const taxBuyInput = content.querySelector('#taxBuy');
      const taxSellInput = content.querySelector('#taxSell');
      const taxRebateInput = content.querySelector('#taxRebate');
      const taxMinAmountInput = content.querySelector('#taxMinAmount');
      
      if (!taxTypeInput || !taxBuyInput || !taxSellInput || !taxRebateInput || !taxMinAmountInput) return;
      
      const taxType = taxTypeInput.value.trim();
      const taxBuy = parseFloat(taxBuyInput.value);
      const taxSell = parseFloat(taxSellInput.value);
      const taxRebate = parseFloat(taxRebateInput.value) || 0;
      const taxMinAmount = parseFloat(taxMinAmountInput.value) || 0;
      
      // 更新内存
      const taxRates = window.TAX_RATES || {};
      taxRates[taxType] = {
        buy: taxBuy,
        sell: taxSell,
        rebate: taxRebate,
        minTaxAmount: taxMinAmount
      };
      window.TAX_RATES = taxRates;
      
      // 如果是数据库模式，同步写入 SQLite
      if (this.sqliteDB) {
        const taxRatesTable = this.getTableName('taxRates');
        this.sqliteDB.run(
          `INSERT OR REPLACE INTO ${taxRatesTable} (type, buy, sell, rebate, min_tax_amount) VALUES (?, ?, ?, ?, ?)`,
          [taxType, taxBuy, taxSell, taxRebate, taxMinAmount]
        );
        this._syncToLocalStorage();
      }
      
      this.showStatusMessage('税率保存成功');
      this.closeTaxModal();
      await this.loadTaxData();
    } catch (error) {
      console.error('保存税率失败:', error);
      this.showStatusMessage('保存税率失败', false);
    }
  }

  /**
   * 删除税率
   * @param {string} taxType - 税率类型
   */
  async deleteTax(taxType) {
    if (confirm(`确定要删除税率类型 "${taxType}" 吗？`)) {
      try {
        const taxRates = window.TAX_RATES || {};
        delete taxRates[taxType];
        window.TAX_RATES = taxRates;
        
        // 如果是数据库模式，同步从 SQLite 删除
        if (this.sqliteDB) {
          const taxRatesTable = this.getTableName('taxRates');
          this.sqliteDB.run(`DELETE FROM ${taxRatesTable} WHERE type = ?`, [taxType]);
          this._syncToLocalStorage();
        }
        
        this.showStatusMessage('税率删除成功');
        await this.loadTaxData();
      } catch (error) {
        console.error('删除税率失败:', error);
        this.showStatusMessage('删除税率失败', false);
      }
    }
  }

  /**
   * 导入 SQLite 数据库文件
   */
  importSQLiteDatabase() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.sqlite';
    
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        this.showStatusMessage('正在导入数据库文件...');
        
        await this.loadSQLiteFromFile(file);
        
        // 重新加载数据
        await this.loadStockData();
        this.loadTaxData();
        
        this.showStatusMessage('数据库文件导入成功');
      } catch (error) {
        console.error('导入数据库失败:', error);
        this.showStatusMessage('导入数据库失败: ' + error.message, false);
      }
    };
    
    input.click();
  }

  /**
   * 使用 stockData.js 的初始数据重新初始化当前股票清单（需密码确认）
   */
  async initializeFromJsData() {
    const password = prompt('请输入密码以确认初始化操作：\n\n此操作将使用 stockData.js 的数据覆盖当前所有股票和税率资料！\n\n密码：123456');
    if (password !== '123456') {
      alert('密码错误，操作取消');
      return;
    }

    const confirmed = confirm('⚠️ 确定要初始化吗？\n\n当前所有股票和税率数据将被 stockData.js 的初始数据完全覆盖！');
    if (!confirmed) return;

    try {
      this.showStatusMessage('正在初始化，请稍候...');

      await this.initSQLite();

      const stocksTable = this.getTableName('stocks');
      const taxRatesTable = this.getTableName('taxRates');

      this.sqliteDB.run(`DELETE FROM ${stocksTable}`);
      this.sqliteDB.run(`DELETE FROM ${taxRatesTable}`);

      const allStocks = window.ALL_STOCKS || [];
      const frequentStocks = window.FREQUENT_STOCKS || [];
      const frequentNames = new Set(frequentStocks.map(s => s.name));

      allStocks.forEach(stock => {
        this.sqliteDB.run(
          `INSERT OR REPLACE INTO ${stocksTable} (name, code, screenshot_name, qty, market, type, is_frequent) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stock.name, stock.code || '', stock.screenshotName || '', stock.qty, stock.market, stock.type, frequentNames.has(stock.name) ? 1 : 0]
        );
      });

      const taxRates = window.TAX_RATES || {};
      Object.keys(taxRates).forEach(type => {
        const rate = taxRates[type];
        this.sqliteDB.run(
          `INSERT OR REPLACE INTO ${taxRatesTable} (type, buy, sell, rebate, min_tax_amount) VALUES (?, ?, ?, ?, ?)`,
          [type, rate.buy, rate.sell, rate.rebate, rate.minTaxAmount]
        );
      });

      this._syncToLocalStorage();

      window.STOCKS = [...allStocks];
      window.FREQUENT_STOCKS = [...frequentStocks];
      window.TAX_RATES = { ...taxRates };

      if (typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('stockListChanged', {
          detail: {
            mode: window.getStockListMode ? window.getStockListMode() : 'all',
            stocks: window.STOCKS
          }
        }));
      }

      if (typeof window.updateAllStockDatalists === 'function') {
        window.updateAllStockDatalists();
      }

      await this.loadStockData();
      this.loadTaxData();
      this.renderDataInfoPanel();
      this.switchToTab('stocks');
      this.showStatusMessage(`初始化成功！已恢复 ${allStocks.length} 只股票、${Object.keys(taxRates).length} 种税率`);
    } catch (error) {
      console.error('[StockCodeManager] 初始化失败:', error);
      this.showStatusMessage('初始化失败: ' + error.message, false);
    }
  }

  /**
   * 获取浏览器持久化的股票清单（供外部程序调用）
   * 返回的股票顺序与页面显示的顺序完全一致
   * @returns {Array} 股票对象数组 [{name, qty, market, type, is_frequent}, ...]
   */
  /**
   * 获取浏览器持久化的股票清单（供外部程序调用）
   * 直接从 SQLite 数据库读取，确保数据与插件画面完全一致
   * @returns {Promise<Array>} 股票对象数组 [{name, qty, market, type, is_frequent}, ...]
   */
  async getStockList() {
    try {
      await this.initSQLite();
      if (!this.sqliteDB) return [];
      if (this.isSQLiteEmpty()) return [];
      const data = this.loadStockDataFromSQLite();
      const mode = this.getStockListMode ? this.getStockListMode() : 'all';
      return mode === 'frequent' ? data.frequentStocks : data.stocks;
    } catch (e) {
      console.warn('[StockCodeManager] getStockList 失败:', e);
      return (window.STOCKS || []).map(s => ({ ...s }));
    }
  }

  /**
   * 同步版本（内部使用，已确保 SQLite 已初始化时调用）
   */
  _getStockListSync() {
    if (!this.sqliteDB || this.isSQLiteEmpty()) {
      return (window.STOCKS || []).map(s => ({ ...s }));
    }
    try {
      const data = this.loadStockDataFromSQLite();
      const mode = window.getStockListMode ? window.getStockListMode() : 'all';
      return mode === 'frequent' ? data.frequentStocks : data.stocks;
    } catch (e) {
      return (window.STOCKS || []).map(s => ({ ...s }));
    }
  }

  /**
   * 销毁插件
   */
  destroy() {
    if (this.sqliteDB) {
      try { this.sqliteDB.close(); } catch(e) { console.warn('[StockCodeManager] 关闭 SQLite 失败:', e); }
      this.sqliteDB = null;
    }
    if (this.floatingWindow) {
      this.floatingWindow.close();
      this.floatingWindow = null;
    }
    // 注意：stockListWindow 的管理已移至 StockListDisplayPlugin
    this.initialized = false;
  }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StockCodeManagerPlugin;
} else if (typeof window !== 'undefined') {
  window.StockCodeManagerPlugin = StockCodeManagerPlugin;
  // 创建全局实例
  window.stockCodeManager = new StockCodeManagerPlugin();
  // 初始化插件
  window.stockCodeManager.init();
}