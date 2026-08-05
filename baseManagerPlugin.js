class BaseManagerPlugin {
  constructor(pluginName, cacheKey, tableName, windowTitle, dataKey) {
    this.name = pluginName;
    this.cacheKey = cacheKey;
    this.tableName = tableName;
    this.windowTitle = windowTitle;
    this.dataKey = dataKey;
    this.sqliteDB = null;
    this.initialized = false;
    this.floatingWindow = null;
    this.editingId = null;
  }

  init() {
    if (this.initialized) return;
    console.log(`${this.name} 插件初始化中...`);
    
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化插件');
      return;
    }

    this.bindEvents();
    this.initialized = true;
    console.log(`${this.name} 插件初始化完成`);
  }

  isSqlJsAvailable() {
    return typeof initSqlJs === 'function';
  }

  getCacheKey() {
    return this.cacheKey;
  }

  getTableName(tableType) {
    if (tableType === '_metadata') {
      return '_metadata';
    }
    return this.tableName;
  }

  _syncToLocalStorage() {
    if (!this.sqliteDB) {
      console.warn(`[${this.name}] 缓存同步失败：sqliteDB 为空`);
      return;
    }
    try {
      const data = this.sqliteDB.export();
      const arrayData = Array.from(data);
      const jsonString = JSON.stringify(arrayData);
      localStorage.setItem(this.getCacheKey(), jsonString);
      console.log(`[${this.name}] 缓存同步成功，数据大小: ${data.length} 字节`);
    } catch (e) {
      console.warn(`[${this.name}] 缓存同步失败:`, e);
    }
  }

  async initSQLite() {
    if (!this.isSqlJsAvailable()) {
      throw new Error('sql.js 未加载');
    }

    const SQL = await initSqlJs({
      locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.9.0/${file}`
    });

    const cacheKey = this.getCacheKey();
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
      try {
        const arrayData = JSON.parse(cachedData);
        const uint8Array = new Uint8Array(arrayData);
        this.sqliteDB = new SQL.Database(uint8Array);
        this.ensureSchemaUpToDate();
        this._syncToLocalStorage();
        console.log(`[${this.name}] 从缓存恢复数据库成功`);
        return;
      } catch (e) {
        console.warn(`[${this.name}] 从缓存恢复失败，创建新数据库:`, e);
      }
    }

    this.sqliteDB = new SQL.Database();
    this.createTable(this.tableName);
    console.log(`[${this.name}] 新建数据库成功`);
  }

  createTable(tableName) {
    const metaTable = this.getTableName('_metadata');
    
    try {
      const createCategoriesSQL = 
        `CREATE TABLE IF NOT EXISTS ${tableName} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          short_name TEXT,
          name TEXT NOT NULL,
          remark TEXT
        )`;
      this.sqliteDB.run(createCategoriesSQL);
      
      const createMetaSQL = 
        `CREATE TABLE IF NOT EXISTS ${metaTable} (
          key TEXT PRIMARY KEY,
          value TEXT
        )`;
      this.sqliteDB.run(createMetaSQL);
      
      this.sqliteDB.run("INSERT OR REPLACE INTO " + metaTable + " (key, value) VALUES ('version', '1.0.0')");
    } catch (e) {
      console.error(`[${this.name}] 创建表失败:`, e);
    }
  }

  ensureSchemaUpToDate() {
    const categoriesTable = this.tableName;
    const metaTable = this.getTableName('_metadata');
    
    try {
      const result = this.sqliteDB.exec("PRAGMA table_info(" + categoriesTable + ")");
      const columns = result[0]?.values || [];
      const columnNames = columns.map(col => col[1]);
      
      if (!columnNames.includes('short_name')) {
        this.sqliteDB.run("ALTER TABLE " + categoriesTable + " ADD COLUMN short_name TEXT");
      }
      if (!columnNames.includes('remark')) {
        this.sqliteDB.run("ALTER TABLE " + categoriesTable + " ADD COLUMN remark TEXT");
      }
    } catch (e) {
      console.error(`[${this.name}] ensureSchemaUpToDate 失败:`, e.message);
      try {
        this.sqliteDB.run("DROP TABLE IF EXISTS " + categoriesTable);
        this.sqliteDB.run("DROP TABLE IF EXISTS " + metaTable);
        this.createTable(categoriesTable);
      } catch (e2) {
        console.error(`[${this.name}] 重建失败:`, e2.message);
      }
    }
  }

  async loadSQLiteFromFile(file) {
    if (!this.isSqlJsAvailable()) {
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
          this.ensureSchemaUpToDate();
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

  importSQLiteDatabase() {
    const password = prompt(`请输入密码以确认导入操作：\n\n此操作将使用导入的数据库文件覆盖当前所有${this.windowTitle.replace('管理', '')}资料！\n\n密码：123456`);
    if (password !== '123456') {
      alert('密码错误，取消导入操作');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.db,.sqlite';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        this.showStatusMessage('正在导入数据库文件...');
        await this.loadSQLiteFromFile(file);
        await this.loadData();
        this.renderDataInfoPanel();
        this.switchToTab(this.tableName);
        this.showStatusMessage('数据库文件导入成功');
      } catch (error) {
        console.error('导入数据库失败:', error);
        this.showStatusMessage('导入数据库失败: ' + error.message, false);
      }
    };
    input.click();
  }

  exportToSQLite() {
    if (!this.sqliteDB) {
      alert('数据库尚未初始化');
      return;
    }

    try {
      const data = this.sqliteDB.export();
      const blob = new Blob([data], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${this.cacheKey}.db`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showStatusMessage('数据库备份成功');
    } catch (e) {
      console.error('导出失败:', e);
      this.showStatusMessage('导出失败: ' + e.message, false);
    }
  }

  async seedSQLiteFromJsData() {
    if (!this.sqliteDB) {
      await this.initSQLite();
    }

    const table = this.tableName;
    this.sqliteDB.run("DELETE FROM " + table);

    const allData = window[this.dataKey] || [];
    allData.forEach(item => {
      this.sqliteDB.run(
        `INSERT OR REPLACE INTO ${table} (code, short_name, name, remark) VALUES (?, ?, ?, ?)`,
        [item.code, item.shortName, item.name, item.remark]
      );
    });

    this._syncToLocalStorage();
    console.log(`[${this.name}] 从 JS 数据初始化完成，共 ${allData.length} 条记录`);
  }

  async initializeFromJsData() {
    const password = prompt(`请输入密码以确认初始化操作：\n\n此操作将使用 ${this.dataKey}.js 的数据覆盖当前所有${this.windowTitle.replace('管理', '')}资料！\n\n密码：123456`);
    if (password !== '123456') {
      alert('密码错误，取消初始化操作');
      return;
    }

    try {
      this.showStatusMessage('正在初始化...');
      
      localStorage.removeItem(this.getCacheKey());
      
      await this.seedSQLiteFromJsData();
      await this.loadData();
      this.renderDataInfoPanel();
      this.switchToTab(this.tableName);
      
      const allData = window[this.dataKey] || [];
      window[this.dataKey.replace('ALL_', '')] = [...allData];
      
      this.showStatusMessage(`初始化成功，共 ${allData.length} 条记录`);
    } catch (e) {
      console.error('初始化失败:', e);
      this.showStatusMessage('初始化失败: ' + e.message, false);
    }
  }

  showStatusMessage(message, success = true) {
    // 生成正确的驼峰命名 ID（CategoryManager → categoryManager）
    const camelName = this.name.charAt(0).toLowerCase() + this.name.slice(1);
    const statusElement = document.getElementById(`${camelName}Status`);
    if (statusElement) {
      statusElement.textContent = message;
      statusElement.style.color = success ? '#16a34a' : '#dc2626';
      setTimeout(() => {
        statusElement.textContent = '';
      }, 3000);
    }
  }

  renderDataInfoPanel() {
    // 生成正确的驼峰命名 ID（CategoryManager → categoryManager）
    const camelName = this.name.charAt(0).toLowerCase() + this.name.slice(1);
    const infoPanel = document.getElementById(`${camelName}InfoPanel`);
    if (infoPanel) {
      const cacheKey = this.getCacheKey();
      const cachedData = localStorage.getItem(cacheKey);
      const dataSize = cachedData ? (cachedData.length / 1024).toFixed(2) + ' KB' : '0 KB';
      const dataLength = cachedData ? cachedData.length.toLocaleString() : '0';
      
      // 获取记录数量
      let recordCount = '未知';
      if (this.sqliteDB) {
        try {
          const result = this.sqliteDB.exec(`SELECT COUNT(*) FROM ${this.tableName}`);
          recordCount = result[0]?.values?.[0]?.[0]?.toString() || '0';
        } catch (e) {
          recordCount = '查询失败';
        }
      }
      
      infoPanel.innerHTML = `
        <div style="font-size: 13px; color: #666;">
          <p><strong>数据来源：</strong>浏览器 localStorage</p>
          <p><strong>缓存键名：</strong><code style="background: #f0f0f0; padding: 2px 6px; border-radius: 3px;">${cacheKey}</code></p>
          <p><strong>缓存大小：</strong>${dataSize} (${dataLength} 字符)</p>
          <p><strong>数据库状态：</strong>${this.sqliteDB ? '✅ 已初始化' : '❌ 未初始化'}</p>
          <p><strong>记录数量：</strong>${recordCount} 条</p>
          <p><strong>存储格式：</strong>SQLite 数据库 JSON 序列化</p>
        </div>
      `;
    }
  }

  switchToTab(tabId) {
    // 将驼峰命名转换为连字符命名（CategoryManager → category-manager）
    const dataName = this.name.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
    const tabs = document.querySelectorAll(`[data-${dataName}-tab]`);
    const panels = document.querySelectorAll(`[data-${dataName}-panel]`);
    
    // 将连字符命名转换为驼峰命名（category-manager → categoryManager）用于 dataset 访问
    const camelName = dataName.replace(/-([a-z])/g, (match, letter) => letter.toUpperCase());
    
    tabs.forEach(tab => {
      tab.classList.toggle('active', tab.dataset[camelName + 'Tab'] === tabId);
    });
    
    panels.forEach(panel => {
      panel.style.display = panel.dataset[camelName + 'Panel'] === tabId ? 'block' : 'none';
    });
  }

  destroy() {
    if (this.sqliteDB) {
      this.sqliteDB.close();
      this.sqliteDB = null;
    }
    this.floatingWindow = null;
    this.editingId = null;
  }

  bindEvents() {
    console.log(`${this.name} 绑定事件`);
  }

  loadData() {
    throw new Error('子类必须实现 loadData 方法');
  }

  openManager() {
    throw new Error('子类必须实现 openManager 方法');
  }

  /**
   * 获取浏览器持久化的数据清单（供外部程序调用）
   * 直接从 SQLite 数据库读取，确保数据与插件画面完全一致
   * @returns {Promise<Array>} 数据对象数组
   */
  async getList() {
    try {
      await this.initSQLite();
      if (!this.sqliteDB) return [];
      if (this._isSQLiteEmpty()) return [];
      const data = this._loadDataFromSQLite();
      return data;
    } catch (e) {
      console.warn(`[${this.name}] getList 失败:`, e);
      const allData = window[this.dataKey] || [];
      return allData.map(item => ({ ...item }));
    }
  }

  /**
   * 同步版本（内部使用，已确保 SQLite 已初始化时调用）
   */
  _getListSync() {
    if (!this.sqliteDB || this._isSQLiteEmpty()) {
      const allData = window[this.dataKey] || [];
      return allData.map(item => ({ ...item }));
    }
    try {
      return this._loadDataFromSQLite();
    } catch (e) {
      const allData = window[this.dataKey] || [];
      return allData.map(item => ({ ...item }));
    }
  }

  /**
   * 检查数据库是否为空
   */
  _isSQLiteEmpty() {
    if (!this.sqliteDB) return true;
    try {
      const result = this.sqliteDB.exec(`SELECT COUNT(*) FROM ${this.tableName}`);
      const count = result.length > 0 && result[0].values.length > 0 ? result[0].values[0][0] : 0;
      return count === 0;
    } catch (e) {
      return true;
    }
  }

  /**
   * 从 SQLite 加载数据（子类可以重写此方法以返回特定格式的数据）
   */
  _loadDataFromSQLite() {
    if (!this.sqliteDB) return [];
    
    try {
      const table = this.getTableName(this.tableName);
      const result = this.sqliteDB.exec(`SELECT id, code, short_name, name, remark FROM ${table} ORDER BY code`);
      const data = result[0]?.values || [];
      
      return data.map(row => ({
        id: row[0],
        code: row[1],
        shortName: row[2],
        name: row[3],
        remark: row[4]
      }));
    } catch (e) {
      console.error(`[${this.name}] _loadDataFromSQLite 失败:`, e);
      return [];
    }
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
   * 通用清单表格渲染器（供所有 Display 插件使用）
   * 统一生成对齐的表格 HTML，避免重复代码
   * 
   * @param {Object} config - 配置对象
   * @param {string} config.title - 标题文字（如：'当前股票清单'）
   * @param {string} config.icon - 图标 emoji（如：'📋'）
   * @param {number} config.dataCount - 数据数量
   * @param {string} config.dataSource - 数据来源描述
   * @param {Object} config.themeColor - 主题渐变色 { from: '#3b82f6', to: '#1d4ed8' }
   * @param {Array} config.columns - 列定义 [{ key, label, width, align }]
   * @param {Array} config.data - 数据数组
   * @param {Function} config.renderCell - 单元格渲染函数 (row, column) => string
   * @param {string} config.footerText - 底部说明文字
   * @returns {string} 完整的 HTML 字符串
   */
  renderListTable(config) {
    const {
      title,
      icon = '📋',
      dataCount = 0,
      dataSource = '浏览器持久化',
      themeColor = { from: '#3b82f6', to: '#1d4ed8' },
      columns = [],
      data = [],
      renderCell = null,
      footerText = ''
    } = config;

    const renderCellValue = (row, col) => {
      if (renderCell) {
        return renderCell(row, col);
      }
      const value = row[col.key];
      return this.escapeHtml(value != null ? String(value) : '-');
    };

    return `
      <div style="padding: 16px 20px; background: linear-gradient(135deg,${themeColor.from},${themeColor.to}); color: #fff; border-radius: 12px 12px 0 0;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div>
            <div style="font-size:18px;font-weight:bold;">${icon} ${title}</div>
            <div style="font-size:12px;opacity:0.85;margin-top:2px;">共 ${dataCount} 条记录 · 数据来源：${dataSource}</div>
          </div>
        </div>
      </div>
      <div style="overflow-y:auto;max-height:55vh;padding-bottom:8px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead>
            <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
              ${columns.map(col => `
                <th style="padding:10px 14px;text-align:${col.align || 'left'};font-weight:600;color:#374151;white-space:nowrap;width:${col.width || 'auto'};">${col.label}</th>
              `).join('')}
            </tr>
          </thead>
          <tbody>
            ${data.map((row, i) => `
              <tr style="${i % 2 === 0 ? 'background:#ffffff' : '#fafafa'}">
                ${columns.map(col => `
                  <td style="padding:7px 14px;border-bottom:1px solid #f3f4f6;text-align:${col.align || 'left'};">
                    ${renderCellValue(row, col)}
                  </td>
                `).join('')}
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      <div style="padding:12px 20px;background:#f9fafb;border-top:1px solid #e5e7eb;text-align:right;font-size:12px;color:#9ca3af;border-radius:0 0 12px 12px;">
        ${footerText}
      </div>
    `;
  }

  /**
   * 静态版本：可直接通过类名调用（不需要实例）
   */
  static renderListTable(config) {
    const instance = new BaseManagerPlugin();
    return instance.renderListTable(config);
  }
}

window.BaseManagerPlugin = BaseManagerPlugin;