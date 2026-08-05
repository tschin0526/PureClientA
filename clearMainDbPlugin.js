/**
 * ClearMainDbPlugin
 * 提供清空主数据库功能
 */

class ClearMainDbPlugin {
  constructor() {
    this.init();
  }

  init() {
    console.log('ClearMainDbPlugin initialized');
  }

  // 清空主数据库
  clearMainDatabase() {
    // 显示提示信息
    if (!confirm('警告：此操作将清空主数据库（TradesDB）中的所有数据！\n\n操作步骤：\n1. 先备份当前主数据库\n2. 备份成功后清空主数据库\n\n请确保您已了解此操作的后果！')) {
      return;
    }

    // 要求输入密码
    const password = prompt('请输入密码以确认操作：\n\n密码：123456');
    if (password !== '123456') {
      alert('密码错误，操作取消');
      return;
    }

    // 开始执行操作
    this.executeClearMainDatabase();
  }

  // 清空主数据库pairings表
  clearMainDatabasePairings() {
    // 显示提示信息
    if (!confirm('警告：此操作将清空主数据库（TradesDB）中的pairings表数据！\n\n操作步骤：\n1. 先备份当前主数据库\n2. 备份成功后清空pairings表\n\n请确保您已了解此操作的后果！')) {
      return;
    }

    // 要求输入密码
    const password = prompt('请输入密码以确认操作：\n\n密码：123456');
    if (password !== '123456') {
      alert('密码错误，操作取消');
      return;
    }

    // 开始执行操作
    this.executeClearMainDatabasePairings();
  }

  // 执行清空主数据库操作
  async executeClearMainDatabase() {
    try {
      // 1. 备份主数据库
      const backupResult = await this.backupMainDatabase();
      if (!backupResult.success) {
        alert('备份失败，操作取消：' + backupResult.error);
        return;
      }

      // 2. 清空主数据库
      await this.clearDatabase();

      // 3. 显示成功信息
      alert('操作完成！\n\n1. 主数据库备份成功：' + backupResult.backupName + '\n2. 主数据库已清空\n\n数据库已恢复到初始状态。');

      // 4. 刷新数据库列表
      if (window.DatabaseManager) {
        window.DatabaseManager.loadDatabaseList();
        window.DatabaseManager.loadDatabaseData();
      }
      
      // 5. 自动调用重置按钮来刷新数据
      if (typeof resetFilters === 'function') {
        resetFilters();
      }
    } catch (error) {
      console.error('清空主数据库失败:', error);
      alert('操作失败：' + error.message);
    }
  }

  // 执行清空主数据库pairings表操作
  async executeClearMainDatabasePairings() {
    try {
      // 1. 备份主数据库
      const backupResult = await this.backupMainDatabase();
      if (!backupResult.success) {
        alert('备份失败，操作取消：' + backupResult.error);
        return;
      }

      // 2. 清空主数据库pairings表
      await this.clearDatabasePairings();

      // 3. 显示成功信息
      alert('操作完成！\n\n1. 主数据库备份成功：' + backupResult.backupName + '\n2. 主数据库pairings表已清空\n\n数据库pairings表已恢复到初始状态。');

      // 4. 刷新数据库列表
      if (window.DatabaseManager) {
        window.DatabaseManager.loadDatabaseList();
        window.DatabaseManager.loadDatabaseData();
      }
      
      // 5. 自动调用重置按钮来刷新数据
      if (typeof resetFilters === 'function') {
        resetFilters();
      }
    } catch (error) {
      console.error('清空主数据库pairings表失败:', error);
      alert('操作失败：' + error.message);
    }
  }

  // 备份主数据库
  backupMainDatabase() {
    return new Promise((resolve) => {
      try {
        var now = new Date();
        var pad = function(n) { return n < 10 ? '0' + n : n; };
        const timestamp = now.getFullYear() + '' + pad(now.getMonth()+1) + pad(now.getDate()) + '-' + pad(now.getHours()) + pad(now.getMinutes()) + pad(now.getSeconds());
        const backupName = `TradesDB-Backup-${timestamp}`;
        const mainDbName = 'TradesDB';

        console.log('开始备份主数据库:', mainDbName);
        console.log('备份名称:', backupName);

        // 打开主数据库
        const request = indexedDB.open(mainDbName, 2);

        request.onerror = (event) => {
          resolve({ success: false, error: event.target.error.message });
        };

        request.onsuccess = (event) => {
          const mainDb = event.target.result;
          
          // 读取 trades 表数据
          const tradesTransaction = mainDb.transaction('trades', 'readonly');
          const tradesStore = tradesTransaction.objectStore('trades');
          const tradesRequest = tradesStore.getAll();

          tradesRequest.onsuccess = () => {
            const tradesData = tradesRequest.result;
            console.log('读取到 trades 数据:', tradesData.length, '条');

            // 读取 pairings 表数据
            const pairingsTransaction = mainDb.transaction('pairings', 'readonly');
            const pairingsStore = pairingsTransaction.objectStore('pairings');
            const pairingsRequest = pairingsStore.getAll();

            pairingsRequest.onsuccess = () => {
              const pairingsData = pairingsRequest.result;
              console.log('读取到 pairings 数据:', pairingsData.length, '条');

              // 关闭主数据库
              mainDb.close();

              // 创建备份数据库
              const backupRequest = indexedDB.open(backupName, 2);

              backupRequest.onerror = (event) => {
                resolve({ success: false, error: event.target.error.message });
              };

              backupRequest.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // 创建 trades 表
                if (!db.objectStoreNames.contains('trades')) {
                  db.createObjectStore('trades', {
                    keyPath: 'id',
                    autoIncrement: false
                  });
                }
                
                // 创建 pairings 表
                if (!db.objectStoreNames.contains('pairings')) {
                  db.createObjectStore('pairings', {
                    keyPath: 'stockName',
                    autoIncrement: false
                  });
                }
              };

              backupRequest.onsuccess = (event) => {
                const backupDb = event.target.result;

                // 保存 trades 表数据
                const tradesBackupTransaction = backupDb.transaction('trades', 'readwrite');
                const tradesBackupStore = tradesBackupTransaction.objectStore('trades');
                
                tradesData.forEach(item => {
                  tradesBackupStore.put(item);
                });

                tradesBackupTransaction.oncomplete = () => {
                  console.log('trades 数据备份完成');

                  // 保存 pairings 表数据
                  const pairingsBackupTransaction = backupDb.transaction('pairings', 'readwrite');
                  const pairingsBackupStore = pairingsBackupTransaction.objectStore('pairings');
                  
                  pairingsData.forEach(item => {
                    pairingsBackupStore.put(item);
                  });

                  pairingsBackupTransaction.oncomplete = () => {
                    backupDb.close();
                    console.log('pairings 数据备份完成');
                    resolve({ success: true, backupName: backupName });
                  };

                  pairingsBackupTransaction.onerror = (event) => {
                    backupDb.close();
                    resolve({ success: false, error: event.target.error.message });
                  };
                };

                tradesBackupTransaction.onerror = (event) => {
                  backupDb.close();
                  resolve({ success: false, error: event.target.error.message });
                };
              };
            };

            pairingsRequest.onerror = (event) => {
              mainDb.close();
              resolve({ success: false, error: event.target.error.message });
            };
          };

          tradesRequest.onerror = (event) => {
            mainDb.close();
            resolve({ success: false, error: event.target.error.message });
          };
        };
      } catch (error) {
        resolve({ success: false, error: error.message });
      }
    });
  }

  // 清空主数据库
  clearDatabase() {
    return new Promise((resolve, reject) => {
      try {
        const dbName = 'TradesDB';

        // 打开主数据库
        const request = indexedDB.open(dbName, 2);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const db = event.target.result;

          // 清空 trades 表
          const tradesTransaction = db.transaction('trades', 'readwrite');
          const tradesStore = tradesTransaction.objectStore('trades');
          const clearTradesRequest = tradesStore.clear();

          clearTradesRequest.onsuccess = () => {
            console.log('trades 表清空完成');

            // 清空 pairings 表
            const pairingsTransaction = db.transaction('pairings', 'readwrite');
            const pairingsStore = pairingsTransaction.objectStore('pairings');
            const clearPairingsRequest = pairingsStore.clear();

            clearPairingsRequest.onsuccess = () => {
              db.close();
              console.log('pairings 表清空完成');
              resolve();
            };

            clearPairingsRequest.onerror = (event) => {
              db.close();
              reject(event.target.error);
            };
          };

          clearTradesRequest.onerror = (event) => {
            db.close();
            reject(event.target.error);
          };
        };
      } catch (error) {
        reject(error);
      }
    });
  }

  // 清空主数据库pairings表
  clearDatabasePairings() {
    return new Promise((resolve, reject) => {
      try {
        const dbName = 'TradesDB';

        // 打开主数据库
        const request = indexedDB.open(dbName, 2);

        request.onerror = (event) => {
          reject(event.target.error);
        };

        request.onsuccess = (event) => {
          const db = event.target.result;

          // 清空 pairings 表
          const pairingsTransaction = db.transaction('pairings', 'readwrite');
          const pairingsStore = pairingsTransaction.objectStore('pairings');
          const clearPairingsRequest = pairingsStore.clear();

          clearPairingsRequest.onsuccess = () => {
            db.close();
            console.log('pairings 表清空完成');
            resolve();
          };

          clearPairingsRequest.onerror = (event) => {
            db.close();
            reject(event.target.error);
          };
        };
      } catch (error) {
        reject(error);
      }
    });
  }
}

// 初始化插件
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    window.ClearMainDbPlugin = new ClearMainDbPlugin();
  });
} else {
  window.ClearMainDbPlugin = new ClearMainDbPlugin();
}

console.log('ClearMainDbPlugin loaded successfully');
