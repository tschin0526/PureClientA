/**
 * SQLiteBackupPlugin
 * IndexedDB → SQLite 备份插件（带去重）
 * 功能：将 IndexedDB 数据导出为 SQLite 数据库文件，支持增量备份和去重
 */

// 调试输出已禁用（2026-05-09：用户确认调试完毕，移除初始化日志）

class SQLiteBackupPlugin {
  constructor() {
    this.window = null;
    this.sqliteDB = null;
    this.sqljsAvailable = typeof initSqlJs === 'function';
    this._sqljsCheckCount = 0;
    this._maxSqljsCheckCount = 20;
    this.init();
  }

  init() {
    // 初始化（无调试输出）
  }

  debugLog(msg) {
    try { console.log('[SQLiteBackupPlugin] ' + msg); } catch(e) {}  // 仅控制台输出，不弹窗
  }

  showModal() {
    this.debugLog('showModal() 被调用');
    
    if (typeof FloatingWindow === 'undefined') {
      this.debugLog('ERROR: FloatingWindow 未定义');
      alert('FloatingWindow 组件未加载');
      return;
    }

    if (!this.window) {
      this.window = new FloatingWindow({
        title: '💾 SQLite 备份工具',
        sourceFile: 'sqliteBackupPlugin.js',
        width: '900px',
        height: '750px',
        x: '80px',
        y: '40px',
        draggable: false,
        id: 'sqliteBackupWindow'
      });
    }

    const content = this.buildContent();
    this.window.setContent(content);
    this.window.show();
    this.bindEvents();
    this.checkSQLjsLoaded();
  }

  buildContent() {
    return `
      <div class="sqlite-backup-container" style="padding: 12px;">
        
        <!-- 状态栏 -->
        <div id="sqliteStatus" style="background: linear-gradient(135deg, #e0e7ff 0%, #fce7f3 100%); padding: 12px; border-radius: 10px; margin-bottom: 16px; font-size: 13px;">
          <strong>📊 状态：</strong>
          <span id="statusText">正在检查 sql.js 加载状态...</span>
        </div>

        <!-- 操作按钮区 -->
        <div style="margin-bottom: 16px;">
          <button id="btnOneClickBackup" onclick="window.SQLiteBackupPlugin.oneClickBackup()"
                  style="width: 100%; padding: 16px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(17,153,142,0.3);">
            💾 备份至 SQLite
          </button>
        </div>

        <!-- 辅助操作区 -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <button id="btnDownloadDB" onclick="window.SQLiteBackupPlugin.downloadDatabase()"
                  style="padding: 12px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;" disabled>
            📥 下载 .db 文件
          </button>
          <button id="btnClearCache" onclick="window.SQLiteBackupPlugin.clearSQLiteCache()"
                  style="padding: 12px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer;">
            🗑️ 清空缓存
          </button>
        </div>

        <!-- 恢复操作区 -->
        <div style="margin-bottom: 16px;">
          <button id="btnRestoreFromSQLite" onclick="window.SQLiteBackupPlugin.restoreFromSQLite()"
                  style="width: 100%; padding: 16px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 12px; font-size: 18px; font-weight: 700; cursor: pointer; box-shadow: 0 4px 15px rgba(102,126,234,0.3);">
            🔄 以SQLite复原
          </button>
        </div>



        <!-- 源数据统计 -->
        <div id="sourceStats" style="background: #fff; border: 2px solid #667eea; border-radius: 10px; padding: 14px; margin-bottom: 16px; display: none;">
          <h3 style="font-size: 14px; color: #667eea; margin-bottom: 10px;">📊 IndexedDB 源数据</h3>
          <div id="sourceStatsContent"></div>
        </div>

        <!-- SQLite 统计 -->
        <div id="sqliteStats" style="background: #fff; border: 2px solid #11998e; border-radius: 10px; padding: 14px; margin-bottom: 16px; display: none;">
          <h3 style="font-size: 14px; color: #11998e; margin-bottom: 10px;">🗄️ SQLite 目标数据库</h3>
          <div id="sqliteStatsContent"></div>
        </div>

        <!-- 操作日志 -->
        <div style="background: #1a1a2e; border-radius: 10px; padding: 14px;">
          <h3 style="font-size: 14px; color: #fff; margin-bottom: 10px;">📝 操作日志</h3>
          <div id="logArea" style="background: #16213e; border-radius: 8px; padding: 12px; max-height: 200px; overflow-y: auto; font-family: Monaco, Menlo, monospace; font-size: 11px; line-height: 1.6; color: #eee;">
            <div style="color: #888;">[系统] 等待操作...</div>
          </div>
        </div>

      </div>
    `;
  }

  bindEvents() {}

  log(message, type) {
    var logArea = document.getElementById('logArea');
    if (!logArea) return;
    
    var timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false });
    var colors = { info: '#4facfe', success: '#38ef7d', warning: '#f6e05e', error: '#fc8181' };
    
    var div = document.createElement('div');
    div.style.color = colors[type] || colors.info;
    div.textContent = '[' + timestamp + '] ' + message;
    logArea.appendChild(div);
    logArea.scrollTop = logArea.scrollHeight;
    
    this.debugLog(message);
  }

  updateStatus(text) {
    var el = document.getElementById('statusText');
    if (el) el.textContent = text;
  }

  // sql.js 加载检查
  checkSQLjsLoaded() {
    this._sqljsCheckCount++;
    
    if (typeof initSqlJs === 'function') {
      this.sqljsAvailable = true;
      this.updateStatus('✅ sql.js 已加载就绪');
      this.log('sql.js WebAssembly 模块加载成功', 'success');
      this.tryRestoreFromCache();
    } else if (this._sqljsCheckCount < this._maxSqljsCheckCount) {
      this.updateStatus('⏳ 等待 sql.js 加载... (' + this._sqljsCheckCount + '/' + this._maxSqljsCheckCount + ')');
      var self = this;
      setTimeout(function() { self.checkSQLjsLoaded(); }, 500);
    } else {
      this.sqljsAvailable = false;
      this.updateStatus('❌ sql.js 加载失败');
      this.log('sql.js 加载失败！请检查网络连接或刷新页面重试', 'error');
    }
  }

  // 初始化 SQLite 数据库
  async initSQLite() {
    if (typeof initSqlJs !== 'function') {
      throw new Error('sql.js 未加载！');
    }
    
    try {
      var SQL = await initSqlJs({
        locateFile: function(file) { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.9.0/' + file; }
      });
      
      // 每次都创建新的内存数据库，确保数据的纯净性
      this.sqliteDB = new SQL.Database();
      this.log('SQLite 内存数据库初始化成功', 'success');
      this.createTables();
      
      return this.sqliteDB;
    } catch (error) {
      this.log('初始化 SQLite 失败: ' + error.message, 'error');
      throw error;
    }
  }





  createTables() {
    var db = this.sqliteDB;
    db.run("CREATE TABLE IF NOT EXISTS trades (id TEXT PRIMARY KEY, date TEXT NOT NULL, stock TEXT NOT NULL, market TEXT, side TEXT, price REAL, qty INTEGER, remark TEXT, created_at TEXT, backup_time TEXT, source_origin TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS pairings (stockName TEXT PRIMARY KEY, pairedTrades TEXT, backup_time TEXT, source_origin TEXT)");
    db.run("CREATE TABLE IF NOT EXISTS backup_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT)");
    this.log('数据表创建/验证完成', 'info');
  }

  // 扫描源数据
  async scanSourceData() {
    this.log('开始扫描 IndexedDB 源数据...', 'info');
    this.updateStatus('🔍 正在扫描 IndexedDB...');
    
    try {
      var tradesData = await this.getAllIndexedDBData('trades');
      var pairingsData = await this.getAllIndexedDBData('pairings');
      
      var stats = {
        tradesCount: tradesData.length,
        pairingsCount: pairingsData.reduce(function(sum, p) { return sum + (p.pairedTrades ? p.pairedTrades.length : 0); }, 0),
        totalPairingRecords: pairingsData.length,
        dateRange: this.getDateRange(tradesData),
        stocks: this.getUniqueStocks(tradesData),
        origin: window.location.origin,
        scanTime: new Date().toISOString()
      };
      
      this.displaySourceStats(stats);
      this.log('扫描完成：' + stats.tradesCount + ' 条交易，' + stats.totalPairingRecords + ' 个配对组', 'success');
      this.updateStatus('✅ 扫描完成：发现 ' + stats.tradesCount + ' 条交易记录');
      
      return stats;
    } catch (error) {
      this.log('扫描失败: ' + error.message, 'error');
      this.updateStatus('❌ 扫描失败');
    }
  }

  getAllIndexedDBData(storeName) {
    return new Promise(function(resolve, reject) {
      var request = indexedDB.open('TradesDB', 2);
      request.onerror = function() { reject(request.error); };
      request.onsuccess = function(event) {
        var db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) { db.close(); resolve([]); return; }
        var tx = db.transaction(storeName, 'readonly');
        var store = tx.objectStore(storeName);
        var getAllRequest = store.getAll();
        getAllRequest.onsuccess = function() { resolve(getAllRequest.result || []); db.close(); };
        getAllRequest.onerror = function() { reject(getAllRequest.error); };
      };
    });
  }

  getDateRange(trades) {
    if (!trades || trades.length === 0) return { start: '-', end: '-' };
    var dates = trades.map(function(t) { return t.date; }).filter(function(d) { return d; }).sort();
    return { start: dates[0] || '-', end: dates[dates.length - 1] || '-' };
  }

  getUniqueStocks(trades) {
    if (!trades) return [];
    var seen = {};
    return trades.filter(function(t) { return t.stock; }).filter(function(t) { if (seen[t.stock]) return false; seen[t.stock] = true; return true; }).map(function(t) { return t.stock; });
  }

  displaySourceStats(stats) {
    var container = document.getElementById('sourceStats');
    var content = document.getElementById('sourceStatsContent');
    container.style.display = 'block';
    
    content.innerHTML = '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 8px;">' +
      '<div style="background: #f0f4ff; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 22px; font-weight: bold; color: #667eea;">' + stats.tradesCount + '</div><div style="font-size: 11px; color: #666;">交易记录数</div></div>' +
      '<div style="background: #f0fff4; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 22px; font-weight: bold; color: #11998e;">' + stats.totalPairingRecords + '</div><div style="font-size: 11px; color: #666;">配对组数</div></div>' +
      '<div style="background: #fff0f7; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 22px; font-weight: bold; color: #d53f8c;">' + stats.stocks.length + '</div><div style="font-size: 11px; color: #666;">涉及股票数</div></div>' +
      '<div style="background: #fffaf0; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 13px; font-weight: bold; color: #dd6b20;">' + stats.dateRange.start + ' ~ ' + stats.dateRange.end + '</div><div style="font-size: 11px; color: #666;">日期范围</div></div>' +
      '</div>' +
      '<div style="margin-top: 10px; font-size: 12px; color: #666;"><strong>来源：</strong>' + stats.origin + '</div>';
  }

  // 一键备份：扫描 → 去重 → 写入 SQLite → 缓存
  async oneClickBackup() {
    var btn = document.getElementById('btnOneClickBackup');
    if (!btn) return;

    btn.disabled = true;
    btn.textContent = '⏳ 备份中...';
    btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

    this.log('═══ 一键备份开始 ═══', 'info');
    this.updateStatus('⏳ 正在执行一键备份...');

    try {
      // 步骤 1：扫描源数据
      this.log('步骤 1/4: 扫描 IndexedDB 源数据...', 'info');
      var tradesData = await this.getAllIndexedDBData('trades');
      var pairingsData = await this.getAllIndexedDBData('pairings');

      var scanStats = {
        tradesCount: tradesData.length,
        pairingsCount: pairingsData.reduce(function(sum, p) { return sum + (p.pairedTrades ? p.pairedTrades.length : 0); }, 0),
        totalPairingRecords: pairingsData.length,
        dateRange: this.getDateRange(tradesData),
        stocks: this.getUniqueStocks(tradesData)
      };
      this.displaySourceStats(scanStats);
      this.log('扫描完成：' + scanStats.tradesCount + ' 条交易，' + scanStats.totalPairingRecords + ' 个配对组', 'success');

      // 步骤 2：初始化 SQLite 并写入数据
      this.log('步骤 2/4: 初始化 SQLite 并写入数据...', 'info');
      await this.initSQLite();

      var insertResult = this.insertToSQLite(tradesData, pairingsData);
      this.log('成功写入 ' + insertResult.tradesInserted + ' 条交易，' + insertResult.pairingsInserted + ' 个配对', 'success');

      // 步骤 3：更新元数据 + 缓存
      this.log('步骤 3/4: 更新元数据并保存缓存...', 'info');
      this.updateBackupMeta(insertResult);
      await this.saveToBrowserCache();
      this.displaySQLiteStats();

      // 步骤 4：自动下载
      this.log('步骤 4/4: 自动下载 .db 文件...', 'info');
      document.getElementById('btnDownloadDB').disabled = false;
      this.downloadDatabase();

      this.log('═══ 一键备份完成 ═══', 'success');
      this.updateStatus('✅ 备份完成！文件已自动下载');

      btn.textContent = '✅ 备份完成，点击再次备份';
      btn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';

      setTimeout(function() {
        btn.disabled = false;
        btn.textContent = '💾 备份至 SQLite';
      }, 2000);

    } catch (error) {
      this.log('一键备份失败: ' + error.message, 'error');
      this.updateStatus('❌ 备份失败: ' + error.message);
      btn.disabled = false;
      btn.textContent = '💾 备份至 SQLite';
      btn.style.background = 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)';
    }
  }

  // 主备份功能（保留供单独调用）
  async backupToSQLite() {
    this.log('═══ 开始备份到 SQLite ═══', 'info');
    this.updateStatus('💾 正在备份数据到 SQLite...');
    
    try {
      await this.initSQLite();
      
      this.log('步骤 1/5: 读取 IndexedDB 数据...', 'info');
      var tradesData = await this.getAllIndexedDBData('trades');
      var pairingsData = await this.getAllIndexedDBData('pairings');
      this.log('读取到 ' + tradesData.length + ' 条交易，' + pairingsData.length + ' 个配对组', 'success');
      
      this.log('步骤 2/5: 执行去重检查...', 'info');
      var dedupeResult = this.deduplicateTrades(tradesData);
      this.log('去重结果: 总计 ' + dedupeResult.total + ' | 新增 ' + dedupeResult.newRecords + ' | 跳过重复 ' + dedupeResult.skipped, dedupeResult.skipped > 0 ? 'warning' : 'success');
      
      this.log('步骤 3/5: 写入 SQLite 数据库...', 'info');
      var insertResult = this.insertToSQLite(dedupeResult.recordsToInsert, pairingsData);
      this.log('成功写入 ' + insertResult.tradesInserted + ' 条交易，' + insertResult.pairingsInserted + ' 个配对', 'success');
      
      this.log('步骤 4/5: 更新元数据...', 'info');
      this.updateBackupMeta(insertResult);
      
      this.log('步骤 5/5: 保存到本地缓存...', 'info');
      await this.saveToBrowserCache();
      
      this.displaySQLiteStats();
      document.getElementById('btnDownloadDB').disabled = false;
      
      this.log('═══ 备份完成 ═══', 'success');
      this.updateStatus('✅ 备份完成！可下载 .db 文件');
      
    } catch (error) {
      this.log('备份失败: ' + error.message, 'error');
      this.updateStatus('❌ 备份失败: ' + error.message);
    }
  }



  insertToSQLite(trades, pairings) {
    var db = this.sqliteDB;
    var tradesInserted = 0;
    var pairingsInserted = 0;
    
    db.run('BEGIN TRANSACTION');
    
    try {
      var tradeStmt = db.prepare("INSERT OR REPLACE INTO trades (id, date, stock, market, side, price, qty, remark, created_at, backup_time, source_origin) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
      
      for (var i = 0; i < trades.length; i++) {
        var trade = trades[i];
        tradeStmt.run([trade.id, trade.date, trade.stock, trade.market || '', trade.side || '', parseFloat(trade.price) || 0, parseInt(trade.qty) || 0, trade.remark || '', trade.createdAt || trade.createdat || '', trade.backup_time || new Date().toISOString(), trade.source_origin || '']);
        tradesInserted++;
      }
      
      tradeStmt.free();
      
      var pairingStmt = db.prepare("INSERT OR REPLACE INTO pairings (stockName, pairedTrades, backup_time, source_origin) VALUES (?, ?, ?, ?)");
      
      for (var j = 0; j < pairings.length; j++) {
        var pairing = pairings[j];
        pairingStmt.run([pairing.stockName, JSON.stringify(pairing.pairedTrades || []), new Date().toISOString(), window.location.origin]);
        pairingsInserted++;
      }
      
      pairingStmt.free();
      db.run('COMMIT');
      
    } catch (error) {
      db.run('ROLLBACK');
      throw error;
    }
    
    return { tradesInserted: tradesInserted, pairingsInserted: pairingsInserted };
  }

  updateBackupMeta(insertResult) {
    var db = this.sqliteDB;
    var now = new Date().toISOString();
    
    var totalTrades = 0;
    var totalPairings = 0;
    
    try {
      var tc = db.exec("SELECT COUNT(*) FROM trades");
      if (tc.length > 0) totalTrades = tc[0].values[0][0];
      var pc = db.exec("SELECT COUNT(*) FROM pairings");
      if (pc.length > 0) totalPairings = pc[0].values[0][0];
    } catch (e) {}
    
    var metaStmt = db.prepare("INSERT OR REPLACE INTO backup_meta (key, value, updated_at) VALUES (?, ?, ?)");
    metaStmt.run(['last_backup_time', now, now]);
    metaStmt.run(['total_trades', String(totalTrades), now]);
    metaStmt.run(['total_pairings', String(totalPairings), now]);
    metaStmt.free();
  }

  saveToBrowserCache() {
    try {
      var db = this.sqliteDB;
      var data = db.export();
      var buffer = new Uint8Array(data);
      
      if ('indexedDB' in window) {
        var self = this;
        var saveReq = indexedDB.open('SQLiteBackupCache', 1);
        saveReq.onupgradeneeded = function(event) {
          var cacheDB = event.target.result;
          if (!cacheDB.objectStoreNames.contains('backups')) {
            cacheDB.createObjectStore('backups', { keyPath: 'id', autoIncrement: false });
          }
        };
        saveReq.onsuccess = function(event) {
          var cacheDB = event.target.result;
          var tx = cacheDB.transaction('backups', 'readwrite');
          var store = tx.objectStore('backups');
          store.put({ id: 'latest', data: buffer, size: buffer.length, created_at: new Date().toISOString(), trades_count: self.getRecordCount() });
          cacheDB.close();
          self.log('已保存到 IndexedDB 缓存', 'success');
        };
      }
    } catch (error) {
      this.log('保存缓存失败: ' + error.message, 'warning');
    }
  }

  getRecordCount() {
    if (!this.sqliteDB) return 0;
    try {
      var r = this.sqliteDB.exec("SELECT COUNT(*) as cnt FROM trades");
      return r.length > 0 ? r[0].values[0][0] : 0;
    } catch (e) { return 0; }
  }

  tryRestoreFromCache() {
    try {
      if ('indexedDB' in window) {
        var self = this;
        var request = indexedDB.open('SQLiteBackupCache', 1);
        request.onsuccess = function(event) {
          var cacheDB = event.target.result;
          if (cacheDB.objectStoreNames.contains('backups')) {
            var tx = cacheDB.transaction('backups', 'readonly');
            var store = tx.objectStore('backups');
            var getRequest = store.get('latest');
            getRequest.onsuccess = function() {
              if (getRequest.result && getRequest.result.data) {
                self.log('从缓存恢复 SQLite 数据库...', 'info');
                var SQL = window.initSqlJs ? null : null;
                self.sqliteDB = new SQL.Database(new Uint8Array(getRequest.result.data));
                self.createTables();
                self.displaySQLiteStats();
                document.getElementById('btnDownloadDB').disabled = false;
                self.log('✅ 从缓存恢复成功！', 'success');
              }
            };
            cacheDB.close();
          }
        };
      }
    } catch (error) {
      this.log('缓存恢复失败: ' + error.message, 'warning');
    }
  }

  displaySQLiteStats() {
    var container = document.getElementById('sqliteStats');
    var content = document.getElementById('sqliteStatsContent');
    container.style.display = 'block';
    
    var totalTrades = 0, totalPairings = 0, lastBackup = '-', backupCount = 0, dbSize = 0;
    
    try {
      var db = this.sqliteDB;
      var tr = db.exec("SELECT COUNT(*) FROM trades");
      if (tr.length > 0) totalTrades = tr[0].values[0][0];
      var pr = db.exec("SELECT COUNT(*) FROM pairings");
      if (pr.length > 0) totalPairings = pr[0].values[0][0];
      var mr = db.exec("SELECT value FROM backup_meta WHERE key='last_backup_time'");
      if (mr.length > 0 && mr[0].values.length > 0) lastBackup = mr[0].values[0][0];
      var cr = db.exec("SELECT value FROM backup_meta WHERE key='backup_count'");
      if (cr.length > 0 && cr[0].values.length > 0) backupCount = parseInt(cr[0].values[0][0]) || 0;
      var data = db.export();
      dbSize = data.byteLength;
    } catch (e) {}
    
    content.innerHTML =
      '<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 10px; margin-top: 8px;">' +
        '<div style="background: #f0fdf4; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 22px; font-weight: bold; color: #11998e;">' + totalTrades + '</div><div style="font-size: 11px; color: #666;">交易总数</div></div>' +
        '<div style="background: #fefce8; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 22px; font-weight: bold; color: #d97706;">' + totalPairings + '</div><div style="font-size: 11px; color: #666;">配对组数</div></div>' +
        '<div style="background: #fdf4ff; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 22px; font-weight: bold; color: #a855f7;">' + backupCount + '</div><div style="font-size: 11px; color: #666;">备份次数</div></div>' +
        '<div style="background: #eff6ff; padding: 10px; border-radius: 8px; text-align: center;"><div style="font-size: 16px; font-weight: bold; color: #2563eb;">' + this.formatSize(dbSize) + '</div><div style="font-size: 11px; color: #666;">数据库大小</div></div>' +
      '</div>' +
      '<div style="margin-top: 10px; font-size: 12px; color: #666;"><strong>最后备份：</strong>' + (lastBackup !== '-' ? lastBackup : '尚未备份') + '</div>';
  }

  downloadDatabase() {
    if (!this.sqliteDB) { alert('请先执行备份操作！'); return; }
    
    this.log('开始生成下载文件...', 'info');
    
    try {
      var data = this.sqliteDB.export();
      var blob = new Blob([data], { type: 'application/octet-stream' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : n; };
      var localTime = now.getFullYear() + '-' +
                       pad(now.getMonth() + 1) + '-' +
                       pad(now.getDate()) + 'T' +
                       pad(now.getHours()) + '-' +
                       pad(now.getMinutes()) + '-' +
                       pad(now.getSeconds());
      a.download = 'TradesDB-Backup-' + localTime + '.db';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.log('✅ 数据库文件下载成功！', 'success');
    } catch (error) {
      this.log('下载失败: ' + error.message, 'error');
      alert('下载失败: ' + error.message);
    }
  }

  clearSQLiteCache() {
    if (!confirm('确定要清空 SQLite 缓存吗？\n\n这将清除内存中的 SQLite 数据库和浏览器缓存。')) { return; }
    
    try {
      if (this.sqliteDB) { this.sqliteDB.close(); this.sqliteDB = null; }
      localStorage.removeItem('sqlite_backup_latest');
      
      if ('indexedDB' in window) {
        var deleteReq = indexedDB.deleteDatabase('SQLiteBackupCache');
        deleteReq.onsuccess = function() {};
      }
      
      document.getElementById('sqliteStats').style.display = 'none';
      document.getElementById('btnDownloadDB').disabled = true;
      
      this.log('✅ 所有缓存已清空', 'success');
      this.updateStatus('🗑️ 缓存已清空');
    } catch (error) {
      this.log('清空缓存失败: ' + error.message, 'error');
    }
  }

  formatSize(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 从SQLite恢复到IndexedDB
  async restoreFromSQLite() {
    // 要求输入密码
    const password = prompt('请输入密码以确认操作：\n\n密码：123456');
    if (password !== '123456') {
      alert('密码错误，操作取消');
      return;
    }

    var btn = document.getElementById('btnRestoreFromSQLite');
    if (!btn) return;

    // 步骤0：创建文件选择器
    this.log('═══ 开始从SQLite恢复 ═══', 'info');
    this.updateStatus('📁 请选择SQLite .db文件...');

    // 创建文件输入元素
    var fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.db';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);

    // 监听文件选择
    fileInput.onchange = async (event) => {
      var file = event.target.files[0];
      if (!file) {
        this.log('未选择文件', 'info');
        this.updateStatus('❌ 未选择文件');
        document.body.removeChild(fileInput);
        return;
      }

      // 再次要求输入密码进行确认
      const secondPassword = prompt('请再次输入密码以确认操作：\n\n密码：123456');
      if (secondPassword !== '123456') {
        alert('密码错误，操作取消');
        document.body.removeChild(fileInput);
        return;
      }

      btn.disabled = true;
      btn.textContent = '⏳ 恢复中...';
      btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

      try {
        // 步骤1：读取文件并初始化SQLite
        this.log('步骤 1/5: 读取SQLite文件...', 'info');
        this.updateStatus('🔄 正在读取SQLite文件...');
        await this.loadSQLiteFile(file);

        // 步骤2：检查文件结构
        this.log('步骤 2/5: 检查文件结构...', 'info');
        this.updateStatus('🔍 正在检查文件结构...');
        var structureValid = this.checkSQLiteStructure();
        if (!structureValid) {
          throw new Error('SQLite文件结构无效，缺少必要的表');
        }

        // 步骤3：从SQLite读取数据
        this.log('步骤 3/5: 从SQLite读取数据...', 'info');
        this.updateStatus('📋 正在读取数据...');
        var tradesFromSQLite = this.readTradesFromSQLite();
        var pairingsFromSQLite = this.readPairingsFromSQLite();

        this.log('读取到 ' + tradesFromSQLite.length + ' 条交易，' + pairingsFromSQLite.length + ' 个配对组', 'success');

        // 步骤4：清空并写回IndexedDB
        this.log('步骤 4/5: 写回IndexedDB...', 'info');
        this.updateStatus('💾 正在写回IndexedDB...');
        var writeResult = await this.writeToIndexedDB(tradesFromSQLite, pairingsFromSQLite);

        // 步骤5：完成恢复
        this.log('步骤 5/5: 恢复完成...', 'info');
        this.log('成功写入 ' + writeResult.tradesWritten + ' 条交易，' + writeResult.pairingsWritten + ' 个配对组', 'success');
        this.log('═══ 恢复完成 ═══', 'success');
        this.updateStatus('✅ 恢复完成！数据已写回IndexedDB');

        btn.textContent = '✅ 恢复完成，点击再次恢复';
        btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';

        // 恢复完成后自动调用重置按钮功能，刷新显示最新数据
        if (typeof resetFilters === 'function') {
          this.log('自动刷新数据显示...', 'info');
          resetFilters();
        }

        setTimeout(function() {
          btn.disabled = false;
          btn.textContent = '🔄 以SQLite复原';
        }, 2000);

      } catch (error) {
        this.log('恢复失败: ' + error.message, 'error');
        this.updateStatus('❌ 恢复失败: ' + error.message);
        btn.disabled = false;
        btn.textContent = '🔄 以SQLite复原';
        btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      } finally {
        document.body.removeChild(fileInput);
      }
    };

    // 触发文件选择对话框
    fileInput.click();
  }

  // 从SQLite读取交易数据
  readTradesFromSQLite() {
    if (!this.sqliteDB) return [];
    
    try {
      var result = this.sqliteDB.exec("SELECT * FROM trades");
      if (!result || result.length === 0) return [];
      
      var trades = [];
      var columns = result[0].columns;
      var values = result[0].values;
      
      for (var i = 0; i < values.length; i++) {
        var trade = {};
        for (var j = 0; j < columns.length; j++) {
          var column = columns[j];
          var value = values[i][j];
          
          // 映射列名到IndexedDB的字段名
          if (column === 'id') trade.id = value;
          else if (column === 'date') trade.date = value;
          else if (column === 'stock') trade.stock = value;
          else if (column === 'market') trade.market = value;
          else if (column === 'side') trade.side = value;
          else if (column === 'price') trade.price = value;
          else if (column === 'qty') trade.qty = value;
          else if (column === 'remark') trade.remark = value;
          else if (column === 'created_at') trade.createdAt = value;
        }
        trades.push(trade);
      }
      
      return trades;
    } catch (error) {
      this.log('读取SQLite交易数据失败: ' + error.message, 'error');
      return [];
    }
  }

  // 从SQLite读取配对数据
  readPairingsFromSQLite() {
    if (!this.sqliteDB) return [];
    
    try {
      var result = this.sqliteDB.exec("SELECT * FROM pairings");
      if (!result || result.length === 0) return [];
      
      var pairings = [];
      var columns = result[0].columns;
      var values = result[0].values;
      
      for (var i = 0; i < values.length; i++) {
        var pairing = {};
        for (var j = 0; j < columns.length; j++) {
          var column = columns[j];
          var value = values[i][j];
          
          if (column === 'stockName') pairing.stockName = value;
          else if (column === 'pairedTrades') {
            try {
              pairing.pairedTrades = JSON.parse(value);
            } catch (e) {
              pairing.pairedTrades = [];
            }
          }
        }
        pairings.push(pairing);
      }
      
      return pairings;
    } catch (error) {
      this.log('读取SQLite配对数据失败: ' + error.message, 'error');
      return [];
    }
  }

  // 写回IndexedDB
  writeToIndexedDB(trades, pairings) {
    return new Promise(function(resolve, reject) {
      var request = indexedDB.open('TradesDB', 2);
      
      request.onerror = function() {
        reject(request.error);
      };
      
      request.onsuccess = function(event) {
        var db = event.target.result;
        var tx = db.transaction(['trades', 'pairings'], 'readwrite');
        
        // 清空现有数据
        var tradesStore = tx.objectStore('trades');
        var pairingsStore = tx.objectStore('pairings');
        
        var clearTrades = tradesStore.clear();
        var clearPairings = pairingsStore.clear();
        
        clearTrades.onsuccess = function() {
          // 写入新交易数据
          var tradeCount = 0;
          for (var i = 0; i < trades.length; i++) {
            var trade = trades[i];
            var addRequest = tradesStore.add(trade);
            addRequest.onsuccess = function() {
              tradeCount++;
            };
          }
          
          clearPairings.onsuccess = function() {
            // 写入新配对数据
            var pairingCount = 0;
            for (var j = 0; j < pairings.length; j++) {
              var pairing = pairings[j];
              var addRequest = pairingsStore.add(pairing);
              addRequest.onsuccess = function() {
                pairingCount++;
              };
            }
            
            tx.oncomplete = function() {
              db.close();
              resolve({ tradesWritten: tradeCount, pairingsWritten: pairingCount });
            };
          };
        };
      };
    });
  }

  // 从文件加载SQLite数据库
  async loadSQLiteFile(file) {
    return new Promise(async (resolve, reject) => {
      try {
        if (typeof initSqlJs !== 'function') {
          throw new Error('sql.js 未加载！');
        }

        var SQL = await initSqlJs({
          locateFile: function(file) { return 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.9.0/' + file; }
        });

        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            var arrayBuffer = e.target.result;
            var uint8Array = new Uint8Array(arrayBuffer);
            this.sqliteDB = new SQL.Database(uint8Array);
            this.log('SQLite文件加载成功', 'success');
            resolve();
          } catch (error) {
            this.log('SQLite文件加载失败: ' + error.message, 'error');
            reject(new Error('SQLite文件加载失败: ' + error.message));
          }
        }.bind(this);

        reader.onerror = function() {
          reject(new Error('文件读取失败'));
        };

        reader.readAsArrayBuffer(file);
      } catch (error) {
        reject(error);
      }
    });
  }

  // 检查SQLite文件结构
  checkSQLiteStructure() {
    if (!this.sqliteDB) return false;

    try {
      // 检查trades表是否存在
      var tradesResult = this.sqliteDB.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='trades'");
      if (!tradesResult || tradesResult.length === 0 || tradesResult[0].values.length === 0) {
        this.log('SQLite文件缺少trades表', 'error');
        return false;
      }

      // 检查pairings表是否存在
      var pairingsResult = this.sqliteDB.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='pairings'");
      if (!pairingsResult || pairingsResult.length === 0 || pairingsResult[0].values.length === 0) {
        this.log('SQLite文件缺少pairings表', 'error');
        return false;
      }

      // 检查表结构是否合理
      var tradesColumns = this.sqliteDB.exec("PRAGMA table_info(trades)");
      var pairingsColumns = this.sqliteDB.exec("PRAGMA table_info(pairings)");

      if (!tradesColumns || !tradesColumns[0] || tradesColumns[0].values.length < 5) {
        this.log('trades表结构不合理', 'error');
        return false;
      }

      if (!pairingsColumns || !pairingsColumns[0] || pairingsColumns[0].values.length < 2) {
        this.log('pairings表结构不合理', 'error');
        return false;
      }

      this.log('SQLite文件结构检查通过', 'success');
      return true;
    } catch (error) {
      this.log('检查SQLite文件结构失败: ' + error.message, 'error');
      return false;
    }
  }
}

// 初始化（无调试输出）
window.SQLiteBackupPlugin = new SQLiteBackupPlugin();
