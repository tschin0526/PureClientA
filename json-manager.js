/**
 * DatabaseManager Plugin
 * 提供数据备份、恢复和管理功能
 */

class DatabaseManager {
  constructor() {
    this.dbName = 'TradesDB';
    this.databaseWindow = null;
    this.init();
  }

  init() {
    this.initDatabaseManagerBtn();
    // DebugUtils 已在 index.html 中静态加载，无需动态加载
    console.log('DatabaseManager init() 被调用');
    console.log('检查 window.DebugUtils:', window.DebugUtils);
    if (window.DebugUtils) {
      console.log('DebugUtils 已加载');
      console.log('DebugUtils._isCommonUtils:', window.DebugUtils._isCommonUtils);
    } else {
      console.warn('DebugUtils 未加载，请检查 index.html 中的脚本引用');
    }
  }

  // 初始化数据库管理按钮事件
  initDatabaseManagerBtn() {
    const databaseManagerBtn = document.getElementById('databaseManagerBtn');
    if (!databaseManagerBtn) return;

    databaseManagerBtn.addEventListener('click', () => {
      this.showDatabaseManagerModal();
    });

    const toolbar = document.querySelector('.toolbar');
    if (toolbar) {
      this.createDebugControl(toolbar);
    }
  }
  
  // 创建调试控制区域
  createDebugControl(container) {
    if (document.getElementById('debugControlContainer')) return;
    
    const debugControl = document.createElement('div');
    debugControl.id = 'debugControlContainer';
    debugControl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 10px;
      padding: 4px 10px;
      background-color: #f0f0f0;
      border-radius: 6px;
      font-size: 12px;
    `;
    
    // checkbox
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.id = 'showDebugWindow';
    checkbox.checked = (window._runMode === 'file');
    
    const label = document.createElement('label');
    label.htmlFor = 'showDebugWindow';
    label.textContent = '调试视窗';
    label.style.cssText = 'cursor: pointer; user-select: none;';
    
    // 数字输入
    const numInput = document.createElement('input');
    numInput.type = 'number';
    numInput.id = 'debugTimeout';
    numInput.min = '1';
    numInput.max = '30';
    numInput.value = '3';
    numInput.style.cssText = 'width: 50px; padding: 4px 6px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px;';
    numInput.title = '调试视窗显示秒数';
    
    const span = document.createElement('span');
    span.textContent = '秒';
    span.style.color = '#666';
    
    debugControl.appendChild(checkbox);
    debugControl.appendChild(label);
    debugControl.appendChild(numInput);
    debugControl.appendChild(span);
    
    // 创建股票清单切换控件
    this.createStockListControl(container);
    
    container.appendChild(debugControl);
    
    // 添加复选框事件监听器：控制 DebugAlert 和旧版调试视窗的开关
    checkbox.addEventListener('change', (e) => {
      // ✅ 控制 DebugAlert（新版累积式调试）
      if (window.DebugAlert) {
        window.DebugAlert.setEnabled(e.target.checked);
        if (!e.target.checked) {
          window.DebugAlert.clear(); // 取消勾选时清空未显示的讯息
        }
      }
      
      // 兼容旧版调试视窗
      if (!e.target.checked) {
        if (window.DebugUtils) {
          window.DebugUtils.clearDebugInfo();
        }
      }
    });
    
    // 添加超时输入框事件：控制 DebugAlert 自动显示阈值
    numInput.addEventListener('change', (e) => {
      const value = parseInt(e.target.value, 10);
      if (value >= 1 && value <= 30 && window.DebugAlert) {
        // 将秒数转换为自动显示阈值（例如3秒对应15条阈值）
        window.DebugAlert.setAutoShowThreshold(value * 5);
      }
    });
  }
  
  // 创建股票清单切换控件
  createStockListControl(container) {
    if (document.getElementById('stockListControlContainer')) return;
    
    const stockListControl = document.createElement('div');
    stockListControl.id = 'stockListControlContainer';
    stockListControl.style.cssText = `
      display: flex;
      align-items: center;
      gap: 6px;
      margin-left: 10px;
      padding: 4px 10px;
      background-color: #e8f5e9;
      border-radius: 6px;
      font-size: 12px;
    `;
    
    const label = document.createElement('span');
    label.textContent = '股票清单:';
    label.style.fontWeight = 'bold';
    
    const select = document.createElement('select');
    select.id = 'stockListModeSelect';
    select.style.cssText = 'padding: 4px 8px; border: 1px solid #ccc; border-radius: 4px; font-size: 12px; cursor: pointer;';
    
    const optionFrequent = document.createElement('option');
    optionFrequent.value = 'frequent';
    optionFrequent.textContent = '经常交易';
    
    const optionAll = document.createElement('option');
    optionAll.value = 'all';
    optionAll.textContent = '所有股票';
    
    select.appendChild(optionFrequent);
    select.appendChild(optionAll);
    
    // 设置当前选中值
    if (window.getStockListMode) {
      select.value = window.getStockListMode();
    }
    
    // 监听切换事件
    select.addEventListener('change', (e) => {
      const mode = e.target.value;
      if (window.switchStockList) {
        window.switchStockList(mode);
        // 更新所有下拉列表
        if (window.updateAllStockDatalists) {
          window.updateAllStockDatalists();
        }
      }
    });
    
    stockListControl.appendChild(label);
    stockListControl.appendChild(select);
    
    container.appendChild(stockListControl);
  }

  // 显示数据库管理悬浮视窗
  showDatabaseManagerModal() {
    // 确保悬浮视窗实例存在
    if (!this.databaseWindow) {
      this.databaseWindow = new FloatingWindow({
        title: '*数据库管理*',
        sourceFile: 'json-manager.js',
        width: '800px',
        height: '700px',
        x: '100px',
        y: '100px',
        draggable: false,
        id: 'databaseManagerWindow'
      });
    }

    // 构建视窗内容
    const content = `
      <div class="database-manager-container" style="padding: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div style="display: flex; gap: 10px; flex-wrap: wrap;">
            <button id="exportJsonBtn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📤 导出 JSON</button>
            <button id="importJsonBtn" style="padding: 10px 20px; background: #6610f2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">📥 导入 JSON</button>
            <input type="file" id="importJsonFile" accept=".json" style="display: none;">
            <button id="backupCurrentDataBtn" style="padding: 10px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">当前数据备份</button>
            <button id="setMainDbBtn" style="padding: 10px 20px; background: #ffc107; color: #212529; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">设定主数据库</button>
            <button id="clearMainDbBtn" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">清空主数据库</button>
            <button id="clearMainDbPairingsBtn" style="padding: 10px 20px; background: #fd7e14; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">清空主数据pairings表</button>
            <button id="systemOpenAccountBtn" style="padding: 10px 20px; background: #17a2b8; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">系统开帐</button>
            <button id="crossOriginMigrationBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">🔄 跨源迁移</button>
            <button id="selectBubbleExportImportBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">✅ 选择勾选导入/导出</button>
            <button id="settingsExportImportBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">⚙️ 参数导入导出</button>
            <button id="sqliteBackupBtn" style="padding: 10px 20px; background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;">💾 SQLite 备份</button>
          </div>
          <button id="deleteSelectedDatabaseBtn" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; opacity: 0.5; pointer-events: none; font-size: 12px;">删除选中数据库</button>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 10px; color: #555; font-size: 12px;">数据表列表</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead style="background: #f8f9fa;">
                <tr>
                  <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">数据库名称</th>
                  <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">表名</th>
                  <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">数据笔数</th>
                  <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">最后异动时间</th>
                </tr>
              </thead>
              <tbody id="databaseTableBody">
                <tr>
                  <td colspan="4" style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #999; font-size: 12px;">加载数据中...</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h3 style="margin: 0; color: #555;">数据库数据</h3>
            <button id="copyDatabaseDataBtn" style="padding: 6px 16px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">复制文本</button>
          </div>
          <div id="databaseDataDisplay" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-height: 300px; overflow: auto; background: #f8f9fa; font-family: monospace; font-size: 14px;">
            <pre style="margin: 0;">{"loading": true}</pre>
          </div>
        </div>
      </div>
    `;

    // 设置视窗内容
    this.databaseWindow.setContent(content);
    // 显示视窗
    this.databaseWindow.show();

    // 获取视窗主体元素
    const floatingBody = this.databaseWindow.getElement().querySelector('.floating-body');

    // 检查数据库状态并设置按钮状态
    this.checkDatabaseStateAndUpdateButtons(floatingBody);
    
    // 导出 JSON 按钮
    floatingBody.querySelector('#exportJsonBtn').addEventListener('click', async () => {
      try {
        const mainDb = await this.openDb(this.dbName);
        const tradesData = await this.getAllData(mainDb, 'trades');
        const pairingsData = await this.getAllData(mainDb, 'pairings');
        mainDb.close();
        
        const exportData = {
          exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
          trades: tradesData,
          pairings: pairingsData
        };

        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        var now = new Date();
        var pad = function(n) { return n < 10 ? '0' + n : n; };
        var timestamp = now.getFullYear() + '' + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
        a.href = url;
        a.download = `TradesDB-Export-${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('导出成功！文件已下载。');
      } catch (error) {
        console.error('导出失败:', error);
        alert('导出失败：' + error.message);
      }
    });
    
    // 导入 JSON 按钮
    const importFileInput = floatingBody.querySelector('#importJsonFile');
    floatingBody.querySelector('#importJsonBtn').addEventListener('click', () => {
      importFileInput.click();
    });
    
    importFileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      
      try {
        const text = await file.text();
        const importData = JSON.parse(text);
        
        if (!importData.trades || !importData.pairings) {
          throw new Error('无效的 JSON 文件格式');
        }
        
        const mainDb = await this.openDb(this.dbName);
        const currentTrades = await this.getAllData(mainDb, 'trades');
        const currentPairings = await this.getAllData(mainDb, 'pairings');
        mainDb.close();
        
        const hasData = currentTrades.length > 0 || currentPairings.length > 0;
        
        if (hasData) {
          alert(`⚠️ 当前数据库中已有数据！\n\n交易记录：${currentTrades.length} 笔\n配对记录：${currentPairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0)} 笔\n\n为避免数据错误叠加，请先清空数据库或使用其他方式处理。`);
          importFileInput.value = '';
          return;
        }
        
        if (!confirm('确定要导入数据吗？\n\n当前数据库为空，可以安全导入。')) {
          importFileInput.value = '';
          return;
        }
        
        const importDb = await this.openDb(this.dbName);
        
        for (const trade of importData.trades) {
          await this.putData(importDb, 'trades', trade);
        }
        
        for (const pairing of importData.pairings) {
          await this.putData(importDb, 'pairings', pairing);
        }
        
        importDb.close();
        importFileInput.value = '';
        
        alert(`导入成功！\n\n交易记录：${importData.trades.length} 笔\n配对记录：${importData.pairings.length} 笔\n\n请刷新页面以查看更新。`);
        
        if (confirm('是否立即刷新页面？')) {
          location.reload();
        }
      } catch (error) {
        console.error('导入失败:', error);
        alert('导入失败：' + error.message);
        importFileInput.value = '';
      }
    });

    // 备份当前数据按钮
    floatingBody.querySelector('#backupCurrentDataBtn').addEventListener('click', () => {
      // 添加确认提示
      if (confirm('确定要备份当前数据吗？\n\n备份过程可能需要一些时间，请耐心等待。\n\n备份完成后会显示提示信息。')) {
        this.backupCurrentData();
      }
    });

    // 设定主数据库按钮
    floatingBody.querySelector('#setMainDbBtn').addEventListener('click', () => {
      if (window.SetMainDbPlugin) {
        window.SetMainDbPlugin.showSetMainDbModal();
      } else {
        alert('设定主数据库插件未加载，请刷新页面重试。');
      }
    });

    // 清空主数据库按钮
    floatingBody.querySelector('#clearMainDbBtn').addEventListener('click', async () => {
      if (window.ClearMainDbPlugin) {
        window.ClearMainDbPlugin.clearMainDatabase();
        // 等待一下，然后更新按钮状态
        setTimeout(async () => {
          await this.checkDatabaseStateAndUpdateButtons(floatingBody);
        }, 500);
      } else {
        alert('清空主数据库插件未加载，请刷新页面重试。');
      }
    });

    // 清空主数据pairings表按钮
    floatingBody.querySelector('#clearMainDbPairingsBtn').addEventListener('click', async () => {
      if (window.ClearMainDbPlugin) {
        window.ClearMainDbPlugin.clearMainDatabasePairings();
        // 等待一下，然后更新按钮状态
        setTimeout(async () => {
          await this.checkDatabaseStateAndUpdateButtons(floatingBody);
        }, 500);
      } else {
        alert('清空主数据库插件未加载，请刷新页面重试。');
      }
    });

    // 删除选中数据库按钮
    floatingBody.querySelector('#deleteSelectedDatabaseBtn').addEventListener('click', () => {
      this.deleteSelectedDatabase();
    });

    // 系统开帐按钮
    floatingBody.querySelector('#systemOpenAccountBtn').addEventListener('click', () => {
      if (window.SystemOpenAccountPlugin) {
        window.SystemOpenAccountPlugin.showModal();
      } else {
        alert('系统开帐插件未加载，请刷新页面重试。');
      }
    });

    // 跨源迁移按钮
    floatingBody.querySelector('#crossOriginMigrationBtn').addEventListener('click', () => {
      if (window.CrossOriginDataMigration) {
        window.CrossOriginDataMigration.showMigrationModal();
      } else {
        alert('跨源迁移插件未加载，请刷新页面重试。');
      }
    });

    // 选择勾选导入/导出按钮
    floatingBody.querySelector('#selectBubbleExportImportBtn').addEventListener('click', () => {
      if (window.SelectBubbleExportImport) {
        window.SelectBubbleExportImport.showModal();
      } else {
        alert('选择勾选导入/导出插件未加载，请刷新页面重试。');
      }
    });

    // 参数导入导出按钮
    floatingBody.querySelector('#settingsExportImportBtn').addEventListener('click', () => {
      if (window.SettingsExportImport) {
        window.SettingsExportImport.showModal();
      } else {
        alert('参数导入导出插件未加载，请刷新页面重试。');
      }
    });

    // SQLite 备份按钮
    floatingBody.querySelector('#sqliteBackupBtn').addEventListener('click', () => {
      const pluginExists = !!window.SQLiteBackupPlugin;
      const msg = '[SQLiteBackup] 按钮被点击, window.SQLiteBackupPlugin = ' + pluginExists;
      console.log(msg);
      if (window.DebugUtils) window.DebugUtils.showDebugInfo(msg);
      
      if (window.SQLiteBackupPlugin) {
        const msg2 = '[SQLiteBackup] 调用 showModal()';
        console.log(msg2);
        if (window.DebugUtils) window.DebugUtils.showDebugInfo(msg2);
        window.SQLiteBackupPlugin.showModal();
      } else {
        const errMsg = '[SQLiteBackup] 插件未加载!';
        console.error(errMsg);
        if (window.DebugUtils) window.DebugUtils.showDebugInfo(errMsg);
        alert('SQLite 备份插件未加载，请刷新页面重试。\n\n请查看左上角调试视窗中的详细信息。');
      }
    });

    // 复制文本按钮
    floatingBody.querySelector('#copyDatabaseDataBtn').addEventListener('click', () => {
      const preElement = floatingBody.querySelector('#databaseDataDisplay pre');
      if (preElement) {
        const textToCopy = preElement.textContent;
        navigator.clipboard.writeText(textToCopy)
          .then(() => {
            alert('复制成功！');
          })
          .catch((error) => {
            console.error('复制失败:', error);
            alert('复制失败，请重试');
          });
      }
    });

    // 加载数据库列表
    this.loadDatabaseList();

    // 加载数据库数据
    this.loadDatabaseData();
  }

  // 显示调试信息
  showDebug(message) {
    console.log('showDebug 被调用，消息:', message);
    console.log('window.DebugUtils 存在?', !!window.DebugUtils);
    if (window.DebugUtils) {
      console.log('使用 DebugUtils 显示调试信息');
      console.log('window.DebugUtils._isCommonUtils?', window.DebugUtils._isCommonUtils);
      window.DebugUtils.showDebugInfo(message);
    } else {
      console.log('DebugUtils 未加载，使用备用调试窗口');
      this.createSimpleDebugWindow(message);
    }
  }

  // 创建简单的调试窗口
  createSimpleDebugWindow(message) {
    let debugInfo = document.getElementById('debugInfo');
    if (!debugInfo) {
      debugInfo = document.createElement('div');
      debugInfo.id = 'debugInfo';
      debugInfo.style.cssText = `
        position: fixed;
        top: 10px;
        left: 10px;
        background: rgba(0, 0, 0, 0.9);
        color: white;
        padding: 10px;
        border-radius: 4px;
        font-family: monospace;
        font-size: 12px;
        max-width: 600px;
        max-height: 300px;
        overflow-y: auto;
        overflow-x: hidden;
        z-index: 999999;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.5);
        white-space: pre-wrap;
        word-wrap: break-word;
      `;
      // 添加固定的开头
      debugInfo.textContent = '*****调试讯息*****.\n\n';
      document.body.appendChild(debugInfo);
      console.log('已创建简单调试窗口');
    }
    debugInfo.textContent += message + '\n';
    
    // 自动滚动到最新资料位置（最下面）
    debugInfo.scrollTop = debugInfo.scrollHeight;
  }

  // 备份当前数据
  async backupCurrentData() {
    try {
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : n; };
      const timestamp = now.getFullYear() + '' + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
      const backupName = `TradesDB-Backup-${timestamp}`;
      
      this.showDebug(`[${new Date().toLocaleString()}] 开始备份数据`);
      this.showDebug(`[${new Date().toLocaleString()}] 备份数据库名称: ${backupName}`);
      
      // 打开主数据库
      this.showDebug(`[${new Date().toLocaleString()}] 打开主数据库: ${this.dbName}`);
      const mainDb = await this.openDb(this.dbName);
      
      // 读取 trades 表数据
      this.showDebug(`[${new Date().toLocaleString()}] 读取 trades 表数据`);
      const tradesData = await this.getAllData(mainDb, 'trades');
      this.showDebug(`[${new Date().toLocaleString()}] 读取到 ${tradesData.length} 条交易记录`);
      
      // 读取 pairings 表数据
      this.showDebug(`[${new Date().toLocaleString()}] 读取 pairings 表数据`);
      const pairingsData = await this.getAllData(mainDb, 'pairings');
      this.showDebug(`[${new Date().toLocaleString()}] 读取到 ${pairingsData.length} 条配对记录`);
      
      // 关闭主数据库
      this.showDebug(`[${new Date().toLocaleString()}] 关闭主数据库`);
      mainDb.close();

      // 创建备份数据库
      this.showDebug(`[${new Date().toLocaleString()}] 创建备份数据库: ${backupName}`);
      const backupDb = await this.openDb(backupName);
      
      // 保存 trades 表
      if (tradesData.length > 0) {
        this.showDebug(`[${new Date().toLocaleString()}] 保存 trades 表数据 (${tradesData.length} 条记录)`);
        await this.saveDataToDb(backupDb, 'trades', tradesData);
        this.showDebug(`[${new Date().toLocaleString()}] trades 表数据保存完成`);
      } else {
        this.showDebug(`[${new Date().toLocaleString()}] trades 表无数据，跳过保存`);
      }
      
      // 保存 pairings 表
      if (pairingsData.length > 0) {
        this.showDebug(`[${new Date().toLocaleString()}] 保存 pairings 表数据 (${pairingsData.length} 条记录)`);
        await this.saveDataToDb(backupDb, 'pairings', pairingsData);
        this.showDebug(`[${new Date().toLocaleString()}] pairings 表数据保存完成`);
      } else {
        this.showDebug(`[${new Date().toLocaleString()}] pairings 表无数据，跳过保存`);
      }
      
      // 关闭备份数据库
      this.showDebug(`[${new Date().toLocaleString()}] 关闭备份数据库`);
      backupDb.close();
      
      // 重新加载数据库列表
      this.showDebug(`[${new Date().toLocaleString()}] 重新加载数据库列表`);
      await this.loadDatabaseList();
      
      this.showDebug(`[${new Date().toLocaleString()}] 备份完成！`);
      alert('备份成功！');
    } catch (error) {
      console.error('备份失败:', error);
      this.showDebug(`[${new Date().toLocaleString()}] 备份失败: ${error.message}`);
      alert('备份失败：' + error.message);
    }
  }

  // 打开数据库
  openDb(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 2);

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onsuccess = (event) => {
        resolve(event.target.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        // 创建 trades 表
        if (!db.objectStoreNames.contains('trades')) {
          const store = db.createObjectStore('trades', {
            keyPath: 'id',
            autoIncrement: false
          });
          this.showDebug(`[${new Date().toLocaleString()}] 创建 trades 表`);
        }
        
        // 创建 pairings 表
        if (!db.objectStoreNames.contains('pairings')) {
          const store = db.createObjectStore('pairings', {
            keyPath: 'stockName',
            autoIncrement: false
          });
          this.showDebug(`[${new Date().toLocaleString()}] 创建 pairings 表`);
        }
      };
    });
  }

  // 获取所有数据
  getAllData(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          resolve(event.target.result);
        };
      } catch (error) {
        resolve([]);
      }
    });
  }

  // 保存数据到数据库
  saveDataToDb(db, storeName, data) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        
        for (const item of data) {
          store.put(item);
        }

        transaction.oncomplete = resolve;
        transaction.onerror = reject;
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // 清空表数据
  clearTable(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        
        request.onsuccess = resolve;
        request.onerror = reject;
      } catch (error) {
        reject(error);
      }
    });
  }
  
  // 插入单条数据
  putData(db, storeName, data) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(data);
        
        request.onsuccess = resolve;
        request.onerror = reject;
      } catch (error) {
        reject(error);
      }
    });
  }

  // 加载数据库列表
  async loadDatabaseList() {
    try {
      const databaseTableBody = document.getElementById('databaseTableBody');
      if (!databaseTableBody) return;

      // 获取所有数据库
      const databases = await this.getAllDatabases();
      const relevantDatabases = databases.filter(db => 
        db.name === 'TradesDB' || db.name.startsWith('TradesDB-Backup-')
      );

      let html = '';
      
      for (const dbInfo of relevantDatabases) {
        try {
          const db = await this.openDb(dbInfo.name);
          
          // 检查 trades 表
          if (db.objectStoreNames.contains('trades')) {
            const tradesData = await this.getAllData(db, 'trades');
            html += `
              <tr style="border-bottom: 1px solid #ddd; cursor: pointer; font-size: 12px;" data-db="${dbInfo.name}" data-table="trades">
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${dbInfo.name}</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">trades</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${tradesData.length}</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${new Date().toLocaleString()}</td>
              </tr>
            `;
          }
          
          // 检查 pairings 表
          if (db.objectStoreNames.contains('pairings')) {
            const pairingsData = await this.getAllData(db, 'pairings');
            // 计算所有交易对的总数
            let totalPairings = 0;
            pairingsData.forEach(stock => {
              if (stock.pairedTrades && Array.isArray(stock.pairedTrades)) {
                totalPairings += stock.pairedTrades.length;
              }
            });
            html += `
              <tr style="border-bottom: 1px solid #ddd; cursor: pointer; font-size: 12px;" data-db="${dbInfo.name}" data-table="pairings">
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${dbInfo.name}</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">pairings</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${totalPairings}</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${new Date().toLocaleString()}</td>
              </tr>
            `;
          }
          
          db.close();
        } catch (error) {
          console.error('加载数据库信息失败:', error);
        }
      }

      if (html === '') {
        html = '<tr><td colspan="4" style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #999; font-size: 12px;">暂无数据库信息</td></tr>';
      }

      databaseTableBody.innerHTML = html;

      // 添加点击事件监听器
      const rows = databaseTableBody.querySelectorAll('tr[data-db][data-table]');
      rows.forEach(row => {
        row.addEventListener('click', (e) => {
          e.stopPropagation();
          // 移除其他行的选中状态
          rows.forEach(r => r.style.background = '');
          // 设置当前行的选中状态
          row.style.background = '#e3f2fd';
          
          const dbName = row.getAttribute('data-db');
          const tableName = row.getAttribute('data-table');
          this.showTableData(dbName, tableName);
          this.updateDeleteButtonState(dbName);
        });
        
        // 添加双击编辑数据库名称事件监听器
        row.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          const dbName = row.getAttribute('data-db');
          // 不能编辑主数据库
          if (dbName === 'TradesDB') {
            alert('不能编辑主数据库名称');
            return;
          }
          
          const dbNameCell = row.querySelector('td:first-child');
          if (dbNameCell) {
            this.editDatabaseName(dbNameCell, dbName);
          }
        });
      });
    } catch (error) {
      console.error('加载数据库列表失败:', error);
      document.getElementById('databaseTableBody').innerHTML = '<tr><td colspan="4" style="border: 1px solid #ddd; padding: 10px; text-align: center; color: #dc3545; font-size: 12px;">加载数据库列表失败</td></tr>';
    }
  }

  // 更新删除按钮状态
  updateDeleteButtonState(dbName) {
    const deleteBtn = document.getElementById('deleteSelectedDatabaseBtn');
    if (!deleteBtn) return;

    // 检查是否是主数据库
    const isMainDatabase = dbName === 'TradesDB';
    
    if (isMainDatabase) {
      // 禁用删除按钮
      deleteBtn.style.opacity = '0.5';
      deleteBtn.style.pointerEvents = 'none';
    } else {
      // 启用删除按钮
      deleteBtn.style.opacity = '1';
      deleteBtn.style.pointerEvents = 'auto';
    }
  }

  // 显示表数据
  async showTableData(dbName, tableName) {
    try {
      const databaseDataDisplay = document.getElementById('databaseDataDisplay');
      if (!databaseDataDisplay) return;

      // 打开数据库
      const db = await this.openDb(dbName);
      const tableData = await this.getAllData(db, tableName);
      db.close();

      // 计算正确的数据笔数
      let count = tableData.length;
      if (tableName === 'pairings') {
        // 对于pairings表，计算所有交易对的总数
        count = 0;
        tableData.forEach(stock => {
          if (stock.pairedTrades && Array.isArray(stock.pairedTrades)) {
            count += stock.pairedTrades.length;
          }
        });
      }

      const databaseData = {
        database: dbName,
        table: tableName,
        data: tableData,
        count: count
      };

      const jsonStr = JSON.stringify(databaseData, null, 2);
      
      // 直接更新文本内容，避免页面闪烁
      const preElement = databaseDataDisplay.querySelector('pre');
      if (preElement) {
        preElement.textContent = jsonStr;
      } else {
        databaseDataDisplay.innerHTML = `<pre style="margin: 0;">${jsonStr}</pre>`;
      }
    } catch (error) {
      console.error('显示表数据失败:', error);
      const databaseDataDisplay = document.getElementById('databaseDataDisplay');
      if (databaseDataDisplay) {
        const preElement = databaseDataDisplay.querySelector('pre');
        if (preElement) {
          preElement.textContent = `显示数据失败：${error.message}`;
          preElement.style.color = '#dc3545';
        } else {
          databaseDataDisplay.innerHTML = `<pre style="margin: 0; color: #dc3545;">显示数据失败：${error.message}</pre>`;
        }
      }
    }
  }

  // 获取所有数据库
  getAllDatabases() {
    return new Promise((resolve) => {
      if (!indexedDB.databases) {
        resolve([]);
        return;
      }
      indexedDB.databases().then(resolve).catch(() => resolve([]));
    });
  }

  // 加载数据库数据
  async loadDatabaseData() {
    try {
      const databaseDataDisplay = document.getElementById('databaseDataDisplay');
      if (!databaseDataDisplay) return;

      // 打开主数据库
      const db = await this.openDb(this.dbName);
      const tradesData = await this.getAllData(db, 'trades');
      const pairingsData = await this.getAllData(db, 'pairings');
      db.close();

      const databaseData = {
        databases: {
          [this.dbName]: {
            tables: {
              trades: tradesData,
              pairings: pairingsData
            }
          }
        }
      };

      const jsonStr = JSON.stringify(databaseData, null, 2);
      
      // 直接更新文本内容，避免页面闪烁
      const preElement = databaseDataDisplay.querySelector('pre');
      if (preElement) {
        preElement.textContent = jsonStr;
      } else {
        databaseDataDisplay.innerHTML = `<pre style="margin: 0;">${jsonStr}</pre>`;
      }
    } catch (error) {
      console.error('加载数据库数据失败:', error);
      const databaseDataDisplay = document.getElementById('databaseDataDisplay');
      if (databaseDataDisplay) {
        const preElement = databaseDataDisplay.querySelector('pre');
        if (preElement) {
          preElement.textContent = `加载数据库数据失败: ${error.message}`;
          preElement.style.color = '#dc3545';
        } else {
          databaseDataDisplay.innerHTML = `<pre style="margin: 0; color: #dc3545;">加载数据库数据失败: ${error.message}</pre>`;
        }
      }
    }
  }

  // 删除选中数据库
  async deleteSelectedDatabase() {
    const databaseTableBody = document.getElementById('databaseTableBody');
    if (!databaseTableBody) return;

    const selectedRows = databaseTableBody.querySelectorAll('tr[data-db][data-table][style*="background:"]');
    if (selectedRows.length === 0) {
      alert('请先选择要删除的数据库');
      return;
    }

    // 记录当前选中项目的信息
    const selectedRow = selectedRows[0];
    const dbName = selectedRow.getAttribute('data-db');
    const tableName = selectedRow.getAttribute('data-table');
    const rowIndex = Array.from(databaseTableBody.querySelectorAll('tr')).indexOf(selectedRow);

    if (dbName === 'TradesDB') {
      alert('不能删除主数据库');
      return;
    }

    if (!confirm(`确定要删除数据库 ${dbName} 吗？`)) {
      return;
    }

    // 实现删除逻辑
    try {
      this.showDebug(`[${new Date().toLocaleString()}] 删除数据库: ${dbName}`);
      indexedDB.deleteDatabase(dbName);
      this.showDebug(`[${new Date().toLocaleString()}] 数据库删除成功`);
      alert('数据库删除成功！');
      // 重新加载数据库列表
      await this.loadDatabaseList();
      
      // 自动选择相近的项目
      this.autoSelectNextItem(rowIndex, dbName, tableName);
      
      // 清空数据库数据显示
      const databaseDataDisplay = document.getElementById('databaseDataDisplay');
      if (databaseDataDisplay) {
        const preElement = databaseDataDisplay.querySelector('pre');
        if (preElement) {
          preElement.textContent = '{}';
        }
      }
    } catch (error) {
      console.error('删除数据库失败:', error);
      this.showDebug(`[${new Date().toLocaleString()}] 删除数据库失败: ${error.message}`);
      alert('删除数据库失败：' + error.message);
    }
  }

  // 自动选择下一个相近的项目
  autoSelectNextItem(previousIndex, deletedDbName, deletedTableName) {
    try {
      const databaseTableBody = document.getElementById('databaseTableBody');
      if (!databaseTableBody) return;

      const rows = databaseTableBody.querySelectorAll('tr[data-db][data-table]');
      if (rows.length === 0) {
        // 禁用删除按钮
        this.updateDeleteButtonState('TradesDB');
        return;
      }

      // 查找相近的项目
      let selectedRow = null;
      
      // 1. 尝试选择同一位置的项目
      if (previousIndex < rows.length) {
        selectedRow = rows[previousIndex];
      }
      // 2. 如果没有，选择最后一个项目
      else if (rows.length > 0) {
        selectedRow = rows[rows.length - 1];
      }

      if (selectedRow) {
        // 设置选中状态
        rows.forEach(r => r.style.background = '');
        selectedRow.style.background = '#e3f2fd';
        
        // 获取选中项目的信息
        const dbName = selectedRow.getAttribute('data-db');
        const tableName = selectedRow.getAttribute('data-table');
        
        // 显示选中项目的数据
        this.showTableData(dbName, tableName);
        
        // 更新删除按钮状态
        this.updateDeleteButtonState(dbName);
        
        this.showDebug(`[${new Date().toLocaleString()}] 自动选择项目: ${dbName} - ${tableName}`);
      } else {
        // 禁用删除按钮
        this.updateDeleteButtonState('TradesDB');
      }
    } catch (error) {
      console.error('自动选择项目失败:', error);
    }
  }
  
  // 编辑数据库名称
  editDatabaseName(cell, oldDbName) {
    // 保存原始文本
    const originalText = cell.textContent;
    
    // 创建输入框
    const input = document.createElement('input');
    input.type = 'text';
    input.value = oldDbName;
    input.style.width = '100%';
    input.style.padding = '2px 4px';
    input.style.border = '1px solid #007bff';
    input.style.borderRadius = '4px';
    
    // 替换单元格内容为输入框
    cell.innerHTML = '';
    cell.appendChild(input);
    
    // 聚焦并选中输入框内容
    input.focus();
    input.select();
    
    // 处理键盘事件
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        // 确认修改
        this.renameDatabase(oldDbName, input.value, cell, originalText);
      } else if (e.key === 'Escape') {
        // 取消修改
        cell.textContent = originalText;
      }
    });
    
    // 处理失去焦点事件
    input.addEventListener('blur', () => {
      // 确认修改
      this.renameDatabase(oldDbName, input.value, cell, originalText);
    });
  }
  
  // 重命名数据库
  async renameDatabase(oldDbName, newDbName, cell, originalText) {
    // 验证新名称
    if (!newDbName || newDbName.trim() === '') {
      cell.textContent = originalText;
      return;
    }
    
    if (newDbName === oldDbName) {
      cell.textContent = originalText;
      return;
    }
    
    if (newDbName === 'TradesDB') {
      alert('不能使用主数据库名称');
      cell.textContent = originalText;
      return;
    }
    
    try {
      this.showDebug(`[${new Date().toLocaleString()}] 开始重命名数据库: ${oldDbName} -> ${newDbName}`);
      
      // 打开旧数据库
      const oldDb = await this.openDb(oldDbName);
      
      // 读取数据
      const tradesData = await this.getAllData(oldDb, 'trades');
      const pairingsData = await this.getAllData(oldDb, 'pairings');
      oldDb.close();
      
      this.showDebug(`[${new Date().toLocaleString()}] 读取旧数据库数据完成，交易记录数: ${tradesData.length}, 配对记录数: ${pairingsData.length}`);
      
      // 创建新数据库
      const newDb = await this.openDb(newDbName);
      
      // 保存数据到新数据库
      if (tradesData.length > 0) {
        await this.saveDataToDb(newDb, 'trades', tradesData);
        this.showDebug(`[${new Date().toLocaleString()}] 保存交易记录到新数据库完成`);
      }
      
      if (pairingsData.length > 0) {
        await this.saveDataToDb(newDb, 'pairings', pairingsData);
        this.showDebug(`[${new Date().toLocaleString()}] 保存配对记录到新数据库完成`);
      }
      
      newDb.close();
      
      // 删除旧数据库
      this.showDebug(`[${new Date().toLocaleString()}] 删除旧数据库: ${oldDbName}`);
      indexedDB.deleteDatabase(oldDbName);
      
      this.showDebug(`[${new Date().toLocaleString()}] 数据库重命名成功: ${oldDbName} -> ${newDbName}`);
      
      // 更新界面
      cell.textContent = newDbName;
      
      // 重新加载数据库列表
      await this.loadDatabaseList();
      
      alert('数据库重命名成功！');
    } catch (error) {
      console.error('数据库重命名失败:', error);
      this.showDebug(`[${new Date().toLocaleString()}] 数据库重命名失败: ${error.message}`);
      alert('数据库重命名失败：' + error.message);
      cell.textContent = originalText;
    }
  }

  async checkDatabaseStateAndUpdateButtons(floatingBody) {
    try {
      const db = await this.openDb(this.dbName);
      const trades = await this.getAllData(db, 'trades');
      const pairings = await this.getAllData(db, 'pairings');
      db.close();

      const hasData = trades.length > 0 || pairings.length > 0;
      const importBtn = floatingBody.querySelector('#importJsonBtn');
      
      if (importBtn) {
        if (hasData) {
          const currentPairingCount = pairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0);
          importBtn.disabled = true;
          importBtn.style.opacity = '0.5';
          importBtn.style.pointerEvents = 'none';
          importBtn.title = `当前数据库已有数据（交易：${trades.length}，配对：${currentPairingCount}），请先清空后再导入`;
        } else {
          importBtn.disabled = false;
          importBtn.style.opacity = '1';
          importBtn.style.pointerEvents = 'auto';
          importBtn.title = '导入JSON数据';
        }
      }
    } catch (error) {
      console.error('检查数据库状态失败:', error);
    }
  }
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，初始化 DatabaseManager');
    window.DatabaseManager = new DatabaseManager();
  });
} else {
  console.log('DOM 已加载，直接初始化 DatabaseManager');
  window.DatabaseManager = new DatabaseManager();
}

console.log('DatabaseManager plugin loaded successfully');

// 测试调试窗口
console.log('测试调试窗口显示');
setTimeout(() => {
  if (window.DatabaseManager) {
    window.DatabaseManager.showDebug('测试调试窗口显示 - 系统初始化完成');
  }
}, 1000);