/**
 * 跨源数据迁移工具
 * 帮助用户在不同源（不同 IP/端口/协议）之间迁移数据
 */

class CrossOriginDataMigration {
  constructor() {
    this.migrationWindow = null;
    this.init();
  }

  init() {
    console.log('CrossOriginDataMigration 初始化完成');
  }

  showMigrationModal() {
    if (!this.migrationWindow) {
      this.migrationWindow = new FloatingWindow({
        title: '🔄 跨源数据迁移工具',
        sourceFile: 'crossOriginDataMigration.js',
        width: '700px',
        height: '650px',
        x: '150px',
        y: '150px',
        draggable: false,
        id: 'migrationWindow'
      });
    }

    const content = `
      <div style="padding: 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="background: #e3f2fd; border-radius: 8px; padding: 16px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 8px 0; color: #1976d2;">📌 当前源信息</h4>
          <div style="font-size: 14px; color: #424242; word-break: break-all;">
            <strong>协议:</strong> ${window.location.protocol}<br>
            <strong>域名:</strong> ${window.location.hostname}<br>
            <strong>端口:</strong> ${window.location.port || '(默认)'}<br>
            <strong>完整源:</strong> <span style="background: #fff; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${window.location.origin}</span>
          </div>
        </div>

        <div style="margin-bottom: 20px;">
          <h4 style="margin: 0 0 12px 0; color: #333;">迁移方式</h4>
          
          <div style="display: flex; flex-direction: column; gap: 12px;">
            <button id="exportToClipboardBtn" style="
              padding: 12px 20px;
              border: 2px solid #4caf50;
              border-radius: 8px;
              background: white;
              color: #2e7d32;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
              text-align: left;
              transition: all 0.2s;
            ">
              📋 方式一：复制到剪贴板<br>
              <span style="font-size: 12px; font-weight: normal; color: #666;">
                适合少量数据，快速复制到新地址粘贴
              </span>
            </button>

            <button id="exportToFileBtn" style="
              padding: 12px 20px;
              border: 2px solid #2196f3;
              border-radius: 8px;
              background: white;
              color: #1565c0;
              cursor: pointer;
              font-size: 14px;
              font-weight: bold;
              text-align: left;
              transition: all 0.2s;
            ">
              💾 方式二：导出为文件<br>
              <span style="font-size: 12px; font-weight: normal; color: #666;">
                适合大量数据，下载文件后在新地址导入
              </span>
            </button>

            <div style="border-top: 1px solid #eee; padding-top: 12px; margin-top: 8px;">
              <h5 style="margin: 0 0 12px 0; color: #666;">📥 导入数据</h5>
              <div style="display: flex; gap: 10px; align-items: center;">
                <input type="file" id="importMigrationFile" accept=".json" style="display: none;">
                <button id="importFromClipboardBtn" style="
                  padding: 10px 16px;
                  border: none;
                  border-radius: 6px;
                  background: #ff9800;
                  color: white;
                  cursor: pointer;
                  font-size: 13px;
                ">
                  📋 从剪贴板粘贴
                </button>
                <button id="importFromFileBtn" style="
                  padding: 10px 16px;
                  border: none;
                  border-radius: 6px;
                  background: #00bcd4;
                  color: white;
                  cursor: pointer;
                  font-size: 13px;
                ">
                  📁 选择文件导入
                </button>
              </div>
            </div>
          </div>
        </div>

        <div style="background: #fff3e0; border-radius: 8px; padding: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #e65100;">📖 使用步骤</h4>
          <ol style="margin: 0; padding-left: 20px; font-size: 13px; color: #5d4037; line-height: 1.8;">
            <li>在<strong>旧地址</strong>打开应用，点击「复制到剪贴板」或「导出为文件」</li>
            <li>在<strong>新地址</strong>打开应用</li>
            <li>点击「从剪贴板粘贴」或「选择文件导入」</li>
            <li>确认导入后刷新页面即可看到数据</li>
          </ol>
        </div>

        <div id="migrationStatus" style="margin-top: 16px; padding: 12px; border-radius: 6px; display: none;"></div>
      </div>
    `;

    this.migrationWindow.setContent(content);
    this.migrationWindow.show();

    const floatingBody = this.migrationWindow.getElement().querySelector('.floating-body');
    this.checkDatabaseStateAndUpdateButtons(floatingBody);
    this.bindMigrationEvents();
  }

  bindMigrationEvents() {
    const floatingBody = this.migrationWindow.getElement().querySelector('.floating-body');
    if (!floatingBody) return;

    floatingBody.querySelector('#exportToClipboardBtn').addEventListener('click', async () => {
      await this.exportToClipboard();
    });

    floatingBody.querySelector('#exportToFileBtn').addEventListener('click', async () => {
      await this.exportToFile();
    });

    floatingBody.querySelector('#importFromClipboardBtn').addEventListener('click', async () => {
      await this.importFromClipboard();
    });

    const fileInput = floatingBody.querySelector('#importMigrationFile');
    floatingBody.querySelector('#importFromFileBtn').addEventListener('click', () => {
      fileInput.click();
    });

    fileInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) {
        await this.importFromFile(file);
      }
      fileInput.value = '';
    });
  }

  async getCurrentData() {
    try {
      const db = await this.openDb('TradesDB');
      const trades = await this.getAllData(db, 'trades');
      const pairings = await this.getAllData(db, 'pairings');
      db.close();

      return {
        version: '1.0',
        exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
        sourceOrigin: window.location.origin,
        trades: trades,
        pairings: pairings
      };
    } catch (error) {
      throw new Error('读取数据失败: ' + error.message);
    }
  }

  async exportToClipboard() {
    const status = this.showStatus('正在读取数据...', 'info');
    try {
      const data = await this.getCurrentData();
      const jsonStr = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonStr);
      
      const tradeCount = data.trades.length;
      const pairingCount = data.pairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0);
      
      this.showStatus(
        `✅ 复制成功！\n交易记录: ${tradeCount} 笔\n配对记录: ${pairingCount} 笔\n\n请切换到新地址粘贴`,
        'success'
      );
    } catch (error) {
      this.showStatus('❌ 复制失败: ' + error.message, 'error');
    }
  }

  async exportToFile() {
    const status = this.showStatus('正在读取数据...', 'info');
    try {
      const data = await this.getCurrentData();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : n; };
      const timestamp = now.getFullYear() + '' + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
      const a = document.createElement('a');
      a.href = url;
      a.download = `TradesDB-Migration-${timestamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      const tradeCount = data.trades.length;
      const pairingCount = data.pairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0);
      
      this.showStatus(
        `✅ 导出成功！\n交易记录: ${tradeCount} 笔\n配对记录: ${pairingCount} 笔\n\n文件已下载`,
        'success'
      );
    } catch (error) {
      this.showStatus('❌ 导出失败: ' + error.message, 'error');
    }
  }

  async importFromClipboard() {
    const status = this.showStatus('正在读取剪贴板...', 'info');
    try {
      const text = await navigator.clipboard.readText();
      await this.importData(text);
    } catch (error) {
      this.showStatus('❌ 读取剪贴板失败: ' + error.message, 'error');
    }
  }

  async importFromFile(file) {
    const status = this.showStatus('正在读取文件...', 'info');
    try {
      const text = await file.text();
      await this.importData(text);
    } catch (error) {
      this.showStatus('❌ 读取文件失败: ' + error.message, 'error');
    }
  }

  async importData(jsonText) {
    try {
      const data = JSON.parse(jsonText);
      
      if (!data.trades || !data.pairings) {
        throw new Error('无效的数据格式');
      }

      const tradeCount = data.trades.length;
      const pairingCount = data.pairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0);
      
      const db = await this.openDb('TradesDB');
      const currentTrades = await this.getAllData(db, 'trades');
      const currentPairings = await this.getAllData(db, 'pairings');
      db.close();
      
      const hasData = currentTrades.length > 0 || currentPairings.length > 0;
      
      if (hasData) {
        const currentPairingCount = currentPairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0);
        this.showStatus(
          `⚠️ 当前数据库中已有数据！\n\n` +
          `交易记录：${currentTrades.length} 笔\n` +
          `配对记录：${currentPairingCount} 笔\n\n` +
          `为避免数据错误叠加，请先清空数据库或使用其他方式处理。`,
          'error'
        );
        return;
      }

      const confirmed = confirm(
        `确定要导入数据吗？\n\n` +
        `📊 待导入数据:\n` +
        `• 交易记录: ${tradeCount} 笔\n` +
        `• 配对记录: ${pairingCount} 笔\n` +
        (data.sourceOrigin ? `• 来源: ${data.sourceOrigin}\n` : '') +
        `\n✅ 当前数据库为空，可以安全导入。`
      );

      if (!confirmed) {
        this.showStatus('已取消导入', 'info');
        return;
      }

      this.showStatus('正在导入数据...', 'info');
      
      const importDb = await this.openDb('TradesDB');
      
      for (const trade of data.trades) {
        await this.putData(importDb, 'trades', trade);
      }
      
      for (const pairing of data.pairings) {
        await this.putData(importDb, 'pairings', pairing);
      }
      
      importDb.close();

      // 导入成功后自动调用重置按钮来刷新数据
      if (typeof resetFilters === 'function') {
        resetFilters();
      }

      this.showStatus(
        `✅ 导入成功！\n交易记录: ${tradeCount} 笔\n配对记录: ${pairingCount} 笔\n\n数据已自动刷新`,
        'success'
      );
    } catch (error) {
      this.showStatus('❌ 导入失败: ' + error.message, 'error');
    }
  }

  showStatus(message, type) {
    const floatingBody = this.migrationWindow?.getElement()?.querySelector('.floating-body');
    if (!floatingBody) return;

    const statusDiv = floatingBody.querySelector('#migrationStatus');
    if (!statusDiv) return;

    statusDiv.style.display = 'block';
    statusDiv.style.whiteSpace = 'pre-line';
    
    const colors = {
      info: { bg: '#e3f2fd', color: '#1565c0' },
      success: { bg: '#e8f5e9', color: '#2e7d32' },
      error: { bg: '#ffebee', color: '#c62828' }
    };

    const style = colors[type] || colors.info;
    statusDiv.style.background = style.bg;
    statusDiv.style.color = style.color;
    statusDiv.textContent = message;

    return statusDiv;
  }

  openDb(name) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, 2);
      request.onerror = (event) => reject(event.target.error);
      request.onsuccess = (event) => resolve(event.target.result);
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        if (!db.objectStoreNames.contains('trades')) {
          db.createObjectStore('trades', { keyPath: 'id', autoIncrement: false });
        }
        if (!db.objectStoreNames.contains('pairings')) {
          db.createObjectStore('pairings', { keyPath: 'stockName', autoIncrement: false });
        }
      };
    });
  }

  getAllData(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();
        request.onerror = (event) => reject(event.target.error);
        request.onsuccess = (event) => resolve(event.target.result);
      } catch (error) {
        resolve([]);
      }
    });
  }

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

  async checkDatabaseStateAndUpdateButtons(floatingBody) {
    try {
      const db = await this.openDb('TradesDB');
      const trades = await this.getAllData(db, 'trades');
      const pairings = await this.getAllData(db, 'pairings');
      db.close();

      const hasData = trades.length > 0 || pairings.length > 0;
      const importFromClipboardBtn = floatingBody.querySelector('#importFromClipboardBtn');
      const importFromFileBtn = floatingBody.querySelector('#importFromFileBtn');
      
      if (hasData) {
        const currentPairingCount = pairings.reduce((sum, p) => sum + (p.pairedTrades?.length || 0), 0);
        const tooltipText = `当前数据库已有数据（交易：${trades.length}，配对：${currentPairingCount}），请先清空后再导入`;
        
        if (importFromClipboardBtn) {
          importFromClipboardBtn.disabled = true;
          importFromClipboardBtn.style.opacity = '0.5';
          importFromClipboardBtn.style.pointerEvents = 'none';
          importFromClipboardBtn.title = tooltipText;
        }
        
        if (importFromFileBtn) {
          importFromFileBtn.disabled = true;
          importFromFileBtn.style.opacity = '0.5';
          importFromFileBtn.style.pointerEvents = 'none';
          importFromFileBtn.title = tooltipText;
        }
      } else {
        if (importFromClipboardBtn) {
          importFromClipboardBtn.disabled = false;
          importFromClipboardBtn.style.opacity = '1';
          importFromClipboardBtn.style.pointerEvents = 'auto';
          importFromClipboardBtn.title = '从剪贴板粘贴数据';
        }
        
        if (importFromFileBtn) {
          importFromFileBtn.disabled = false;
          importFromFileBtn.style.opacity = '1';
          importFromFileBtn.style.pointerEvents = 'auto';
          importFromFileBtn.title = '选择文件导入数据';
        }
      }
    } catch (error) {
      console.error('检查数据库状态失败:', error);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    window.CrossOriginDataMigration = new CrossOriginDataMigration();
  });
} else {
  window.CrossOriginDataMigration = new CrossOriginDataMigration();
}

console.log('CrossOriginDataMigration plugin loaded successfully');
