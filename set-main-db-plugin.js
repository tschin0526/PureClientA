/**
 * SetMainDbPlugin
 * 提供设定主数据库的功能
 */

class SetMainDbPlugin {
  constructor() {
    this.mainDbName = 'TradesDB';
    console.log('SetMainDbPlugin 初始化');
  }

  // 显示设定主数据库的模态窗口
  showSetMainDbModal() {
    // 创建模态窗口
    const modal = document.createElement('div');
    modal.id = 'setMainDbModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: #fff;
      padding: 30px;
      border-radius: 8px;
      width: 90%;
      max-width: 600px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    `;

    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 25px;">
        <h2 style="margin: 0; color: #333; font-size: 18px;">设定主数据库</h2>
        <button id="closeSetMainDbModal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #999;">&times;</button>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">选择要设为主数据库的备份：</label>
        <select id="backupDbSelect" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
          <option value="">加载中...</option>
        </select>
      </div>
      
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 8px; font-weight: 500; color: #555;">输入密码确认操作：</label>
        <input type="password" id="setMainDbPassword" placeholder="请输入密码" style="width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px;">
      </div>
      
      <div style="margin-bottom: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; border-left: 4px solid #ffc107; color: #666;">
        <h4 style="margin-top: 0; margin-bottom: 10px; color: #333; font-size: 14px;">操作说明：</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.5;">
          <li>选择一个备份数据库作为新的主数据库</li>
          <li>当前主数据库 (TradesDB) 将被覆盖</li>
          <li>操作前会自动关闭所有相关数据库</li>
          <li>请确保选择的备份数据库包含完整的交易数据</li>
        </ul>
      </div>
      
      <div style="display: flex; gap: 10px; justify-content: flex-end;">
        <button id="cancelSetMainDbBtn" style="padding: 10px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">取消</button>
        <button id="confirmSetMainDbBtn" style="padding: 10px 20px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px;">确认设定</button>
      </div>
    `;

    modal.appendChild(modalContent);
    document.body.appendChild(modal);

    // 关闭按钮
    document.getElementById('closeSetMainDbModal').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // 取消按钮
    document.getElementById('cancelSetMainDbBtn').addEventListener('click', () => {
      document.body.removeChild(modal);
    });

    // 点击模态框外部关闭
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        document.body.removeChild(modal);
      }
    });

    // 加载备份数据库列表
    this.loadBackupDatabases();

    // 确认按钮
    document.getElementById('confirmSetMainDbBtn').addEventListener('click', async () => {
      await this.confirmSetMainDb(modal);
    });
  }

  // 加载备份数据库列表
  async loadBackupDatabases() {
    const selectElement = document.getElementById('backupDbSelect');
    selectElement.innerHTML = '<option value="">加载中...</option>';

    try {
      const databases = await this.getAllDatabases();
      const backupDatabases = databases.filter(db => 
        db.name.startsWith('TradesDB-Backup-')
      );

      if (backupDatabases.length === 0) {
        selectElement.innerHTML = '<option value="">暂无备份数据库</option>';
        return;
      }

      let options = '<option value="">请选择备份数据库</option>';
      backupDatabases.forEach(db => {
        options += `<option value="${db.name}">${db.name}</option>`;
      });

      selectElement.innerHTML = options;
    } catch (error) {
      console.error('加载备份数据库列表失败:', error);
      selectElement.innerHTML = '<option value="">加载失败</option>';
    }
  }

  // 确认设定主数据库
  async confirmSetMainDb(modal) {
    const selectedDb = document.getElementById('backupDbSelect').value;
    const password = document.getElementById('setMainDbPassword').value;

    if (!selectedDb) {
      alert('请选择要设为主数据库的备份');
      return;
    }

    if (password !== '123456') {
      alert('密码错误，请输入正确的密码');
      return;
    }

    // 显示确认提示
    if (!confirm(`确定要将 ${selectedDb} 设为主数据库吗？\n\n当前主数据库 (TradesDB) 将被覆盖。\n\n操作过程可能需要一些时间，请耐心等待。`)) {
      return;
    }

    // 关闭模态窗口
    document.body.removeChild(modal);

    try {
      console.log('开始处理设定主数据库');
      
      // 先读取备份数据库的数据
      console.log('开始读取备份数据库:', selectedDb);
      const sourceDb = await this.openDb(selectedDb);
      const tradesData = await this.getAllData(sourceDb, 'trades');
      const pairingsData = await this.getAllData(sourceDb, 'pairings');
      sourceDb.close();
      console.log('备份数据库读取完成，交易记录数:', tradesData.length, '配对记录数:', pairingsData.length);

      // 创建一个简单的处理状态提示
      const statusDiv = document.createElement('div');
      statusDiv.id = 'setMainDbStatus';
      statusDiv.style.cssText = `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        z-index: 1001;
        text-align: center;
      `;
      statusDiv.innerHTML = `
        <h3 style="margin-top: 0; color: #333;">正在处理</h3>
        <p style="margin-bottom: 20px; color: #666;">请稍候，正在设置主数据库...</p>
        <div style="display: inline-block; width: 20px; height: 20px; border: 2px solid #f3f3f3; border-top: 2px solid #3498db; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
      `;
      document.body.appendChild(statusDiv);

      // 直接打开主数据库并覆盖数据，不删除数据库
      console.log('开始覆盖主数据库');
      const targetDb = await this.openDb(this.mainDbName);
      
      // 清空现有数据
      console.log('清空主数据库现有数据');
      await this.clearObjectStore(targetDb, 'trades');
      await this.clearObjectStore(targetDb, 'pairings');
      
      // 导入新数据
      console.log('开始导入交易记录');
      await this.saveDataToDb(targetDb, 'trades', tradesData);
      console.log('开始导入配对记录');
      await this.saveDataToDb(targetDb, 'pairings', pairingsData);
      
      targetDb.close();
      console.log('主数据库覆盖完成');

      // 移除状态提示
      document.body.removeChild(statusDiv);

      // 显示成功提示
      alert(`主数据库设定成功！\n\n已将 ${selectedDb} 设为主数据库。`);
      
      // 自动调用重置按钮来刷新数据
      if (typeof resetFilters === 'function') {
        resetFilters();
      }
    } catch (error) {
      console.error('设定主数据库失败:', error);
      
      // 移除可能存在的状态提示
      const statusDiv = document.getElementById('setMainDbStatus');
      if (statusDiv) {
        document.body.removeChild(statusDiv);
      }
      
      if (error.message.includes('删除数据库被阻止')) {
        alert('设定主数据库失败：删除数据库被阻止\n\n请尝试以下操作：\n1. 关闭所有打开的应用标签页\n2. 刷新页面\n3. 重新尝试设定主数据库\n\n如果问题仍然存在，请关闭浏览器并重新打开后重试。');
      } else {
        alert('设定主数据库失败：' + error.message);
      }
    }
  }

  // 清空对象存储
  clearObjectStore(db, storeName) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          reject(event.target.error);
        };
      } catch (error) {
        reject(error);
      }
    });
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

  // 关闭所有数据库连接
  closeAllDatabaseConnections() {
    // 由于IndexedDB API限制，无法直接关闭所有连接
    // 但我们可以通过删除和重新创建数据库来确保连接被关闭
    return Promise.resolve();
  }

  // 删除数据库
  deleteDatabase(dbName) {
    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(dbName);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = (event) => {
        reject(event.target.error);
      };

      request.onblocked = () => {
        reject(new Error('删除数据库被阻止，请关闭其他标签页后重试'));
      };
    });
  }

  // 复制数据库
  async copyDatabase(sourceDbName, targetDbName) {
    // 打开源数据库
    const sourceDb = await this.openDb(sourceDbName);

    try {
      // 读取源数据库中的数据
      const tradesData = await this.getAllData(sourceDb, 'trades');
      const pairingsData = await this.getAllData(sourceDb, 'pairings');

      // 关闭源数据库
      sourceDb.close();

      // 打开目标数据库
      const targetDb = await this.openDb(targetDbName);

      try {
        // 保存数据到目标数据库
        await this.saveDataToDb(targetDb, 'trades', tradesData);
        await this.saveDataToDb(targetDb, 'pairings', pairingsData);

        // 关闭目标数据库
        targetDb.close();
      } catch (error) {
        targetDb.close();
        throw error;
      }
    } catch (error) {
      if (sourceDb) {
        sourceDb.close();
      }
      throw error;
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
        }

        // 创建 pairings 表
        if (!db.objectStoreNames.contains('pairings')) {
          const store = db.createObjectStore('pairings', {
            keyPath: 'stockName',
            autoIncrement: false
          });
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
}

// 初始化插件
if (typeof window !== 'undefined') {
  window.SetMainDbPlugin = new SetMainDbPlugin();
  console.log('SetMainDbPlugin 已加载');
}
