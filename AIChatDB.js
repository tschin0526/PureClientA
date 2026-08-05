/**
 * AI Chat IndexedDB 数据库管理器
 * 
 * 功能：
 * - 创建和管理 IndexedDB 数据库
 * - 存储/查询/删除 AI 对话记录
 * - 支持请求(request)和响应(response)两种记录类型
 * - 按时序索引，支持快速查询
 */

(function() {
  'use strict';

  // ===== 配置 =====
  var DB_NAME = 'AIChatDatabase';
  var DB_VERSION = 2;
  var STORE_NAME = 'chat_records';
  var SETTINGS_STORE = 'settings';
  var INDEX_NAME = 'timestamp';

  // ===== 数据库实例 =====
  var db = null;

  // ===== 设置缓存层（同步读写，异步持久化到 IndexedDB） =====
  var settingsCache = {};
  var settingsCacheLoaded = false;

  /**
   * 初始化数据库（异步）
   * @returns {Promise<IDBDatabase>} 数据库实例
   */
  function initDB() {
    return new Promise(function(resolve, reject) {
      if (db) {
        resolve(db);
        return;
      }

      var request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = function(event) {
        console.error('[AI-Chat-DB] ❌ 打开数据库失败:', event.target.error);
        reject(event.target.error);
      };

      request.onsuccess = function(event) {
        db = event.target.result;
        console.log('[AI-Chat-DB] ✅ 数据库打开成功');
        resolve(db);
      };

      request.onupgradeneeded = function(event) {
        var database = event.target.result;
        
        console.log('[AI-Chat-DB] 🔧 正在创建/升级数据库...');
        
        if (!database.objectStoreNames.contains(STORE_NAME)) {
          var store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex(INDEX_NAME, 'timestamp', { unique: false });
          store.createIndex('type', 'type', { unique: false });
          store.createIndex('modelProvider', 'modelProvider', { unique: false });
          console.log('[AI-Chat-DB] ✅ 创建 chat_records 存储成功');
        }

        if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
          var settingsStore = database.createObjectStore(SETTINGS_STORE, { keyPath: 'key' });
          console.log('[AI-Chat-DB] ✅ 创建 settings 存储成功');
        }
      };
    });
  }

  // ===== Settings 同步缓存 API =====

  /**
   * 从 IndexedDB 加载所有设置到缓存（异步）
   * @returns {Promise<void>}
   */
  function loadSettingsToCache() {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        try {
          var transaction = database.transaction([SETTINGS_STORE], 'readonly');
          var store = transaction.objectStore(SETTINGS_STORE);
          var request = store.getAll();

          request.onsuccess = function(event) {
            var records = event.target.result || [];
            records.forEach(function(record) {
              settingsCache[record.key] = record.value;
            });
            settingsCacheLoaded = true;
            console.log('[AI-Chat-DB] ✅ 已加载 ' + records.length + ' 个设置到缓存');
            resolve();
          };

          request.onerror = function(event) {
            console.error('[AI-Chat-DB] ❌ 加载设置失败:', event.target.error);
            settingsCacheLoaded = true;
            resolve();
          };
        } catch(e) {
          console.error('[AI-Chat-DB] ❌ 加载设置异常:', e);
          settingsCacheLoaded = true;
          resolve();
        }
      }).catch(function(e) {
        console.error('[AI-Chat-DB] ❌ 初始化失败:', e);
        settingsCacheLoaded = true;
        resolve();
      });
    });
  }

  /**
   * 同步获取设置值（从缓存读取）
   * @param {string} key - 设置键名
   * @param {*} defaultValue - 默认值
   * @returns {*} 设置值
   */
  function getSetting(key, defaultValue) {
    if (key in settingsCache) {
      return settingsCache[key];
    }
    return defaultValue !== undefined ? defaultValue : null;
  }

  /**
   * 同步设置值（写入缓存 + 异步持久化到 IndexedDB）
   * @param {string} key - 设置键名
   * @param {*} value - 设置值
   */
  function setSetting(key, value) {
    settingsCache[key] = value;

    initDB().then(function(database) {
      try {
        var transaction = database.transaction([SETTINGS_STORE], 'readwrite');
        var store = transaction.objectStore(SETTINGS_STORE);
        store.put({ key: key, value: value });
      } catch(e) {
        console.error('[AI-Chat-DB] ❌ 保存设置失败:', e);
      }
    }).catch(function(e) {
      console.error('[AI-Chat-DB] ❌ 保存设置失败:', e);
    });
  }

  /**
   * 同步删除设置值
   * @param {string} key - 设置键名
   */
  function removeSetting(key) {
    delete settingsCache[key];

    initDB().then(function(database) {
      try {
        var transaction = database.transaction([SETTINGS_STORE], 'readwrite');
        var store = transaction.objectStore(SETTINGS_STORE);
        store.delete(key);
      } catch(e) {
        console.error('[AI-Chat-DB] ❌ 删除设置失败:', e);
      }
    }).catch(function(e) {
      console.error('[AI-Chat-DB] ❌ 删除设置失败:', e);
    });
  }

  /**
   * 清空所有设置
   */
  function clearSettings() {
    settingsCache = {};

    initDB().then(function(database) {
      try {
        var transaction = database.transaction([SETTINGS_STORE], 'readwrite');
        var store = transaction.objectStore(SETTINGS_STORE);
        store.clear();
      } catch(e) {
        console.error('[AI-Chat-DB] ❌ 清空设置失败:', e);
      }
    }).catch(function(e) {
      console.error('[AI-Chat-DB] ❌ 清空设置失败:', e);
    });
  }

  /**
   * 从 localStorage 迁移数据到 IndexedDB（一次性操作）
   */
  function migrateFromLocalStorage() {
    var migratedKeys = [
      'ai_parser_model',
      'ai_parser_models',
      'ai_ocr_settings',
      'ai_chat_web_search',
      'ai_chat_economy_mode',
      'ai_chat_ai_enabled'
    ];

    var providerKeys = ['zhipu', 'tongyi', 'fangzhou'];
    providerKeys.forEach(function(p) {
      migratedKeys.push('ai_parser_active_key_name_' + p);
    });

    var migrated = 0;
    migratedKeys.forEach(function(key) {
      var value = localStorage.getItem(key);
      if (value !== null && !(key in settingsCache)) {
        settingsCache[key] = value;
        migrated++;
      }
    });

    if (migrated > 0) {
      console.log('[AI-Chat-DB] 🔄 从 localStorage 迁移了 ' + migrated + ' 个设置');
      initDB().then(function(database) {
        try {
          var transaction = database.transaction([SETTINGS_STORE], 'readwrite');
          var store = transaction.objectStore(SETTINGS_STORE);
          Object.keys(settingsCache).forEach(function(key) {
            store.put({ key: key, value: settingsCache[key] });
          });
        } catch(e) {
          console.error('[AI-Chat-DB] ❌ 迁移数据写入失败:', e);
        }
      }).catch(function(e) {});
    }
  }

  /**
   * 生成唯一 ID
   * @param {Date} date - 日期对象
   * @param {number} seq - 序号
   * @returns {string} 唯一 ID
   */
  function generateId(date, seq) {
    var d = date || new Date();
    var s = seq || Math.floor(Math.random() * 1000);
    
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hour = String(d.getHours()).padStart(2, '0');
    var minute = String(d.getMinutes()).padStart(2, '0');
    var second = String(d.getSeconds()).padStart(2, '0');
    var ms = String(d.getMilliseconds()).padStart(3, '0');
    
    return year + month + day + '_' + hour + minute + second + '_' + String(s).padStart(3, '0');
  }

  /**
   * 格式化时间戳
   * @param {Date} date - 日期对象
   * @returns {string} 格式化的时间字符串
   */
  function formatTimestamp(date) {
    var d = date || new Date();
    var year = d.getFullYear();
    var month = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var hour = String(d.getHours()).padStart(2, '0');
    var minute = String(d.getMinutes()).padStart(2, '0');
    var second = String(d.getSeconds()).padStart(2, '0');
    var millisecond = String(d.getMilliseconds()).padStart(3, '0');
    
    return year + '-' + month + '-' + day + ' ' + hour + ':' + minute + ':' + second + '.' + millisecond;
  }

  // ===== CRUD 操作 =====

  /**
   * 添加记录
   * @param {Object} record - 记录对象
   * @returns {Promise<string>} 记录 ID
   */
  function addRecord(record) {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        
        // 自动生成 ID 和时间戳
        if (!record.id) {
          record.id = generateId(new Date());
        }
        if (!record.timestamp) {
          record.timestamp = formatTimestamp(new Date());
        }
        
        var request = store.add(record);
        
        request.onsuccess = function() {
          console.log('[AI-Chat-DB] ✅ 添加记录成功:', record.id);
          resolve(record.id);
        };
        
        request.onerror = function(event) {
          console.error('[AI-Chat-DB] ❌ 添加记录失败:', event.target.error);
          reject(event.target.error);
        };
      }).catch(reject);
    });
  }

  /**
   * 批量添加记录（事务性操作）
   * @param {Array} records - 记录数组
   * @returns {Promise<string[]>} 记录 ID 数组
   */
  function addRecords(records) {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        var ids = [];
        var completed = 0;
        var errors = [];
        
        records.forEach(function(record, index) {
          if (!record.id) {
            record.id = generateId(new Date(), index);
          }
          if (!record.timestamp) {
            record.timestamp = formatTimestamp(new Date());
          }
          
          var request = store.add(record);
          
          request.onsuccess = function() {
            ids.push(record.id);
            completed++;
            
            if (completed === records.length) {
              if (errors.length > 0) {
                reject(errors);
              } else {
                console.log('[AI-Chat-DB] ✅ 批量添加记录成功，共', ids.length, '条');
                resolve(ids);
              }
            }
          };
          
          request.onerror = function(event) {
            errors.push(event.target.error);
            completed++;
            
            if (completed === records.length) {
              reject(errors);
            }
          };
        });
        
        // 处理空数组
        if (records.length === 0) {
          resolve([]);
        }
        
      }).catch(reject);
    });
  }

  /**
   * 获取所有记录（按时序倒序）
   * @param {number} limit - 返回数量限制（可选）
   * @returns {Promise<Array>} 记录数组
   */
  function getAllRecords(limit) {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readonly');
        var store = transaction.objectStore(STORE_NAME);
        var index = store.index(INDEX_NAME);
        var request = index.openCursor(null, 'prev');  // 倒序
        
        var results = [];
        
        request.onsuccess = function(event) {
          var cursor = event.target.result;
          
          if (cursor && (!limit || results.length < limit)) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            console.log('[AI-Chat-DB] 📋 获取记录成功，共', results.length, '条');
            resolve(results);
          }
        };
        
        request.onerror = function(event) {
          console.error('[AI-Chat-DB] ❌ 获取记录失败:', event.target.error);
          reject(event.target.error);
        };
      }).catch(reject);
    });
  }

  /**
   * 根据 ID 获取记录
   * @param {string} id - 记录 ID
   * @returns {Promise<Object>} 记录对象
   */
  function getRecordById(id) {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readonly');
        var store = transaction.objectStore(STORE_NAME);
        var request = store.get(id);
        
        request.onsuccess = function() {
          if (request.result) {
            resolve(request.result);
          } else {
            resolve(null);
          }
        };
        
        request.onerror = function(event) {
          reject(event.target.error);
        };
      }).catch(reject);
    });
  }

  /**
   * 按类型查询记录
   * @param {string} type - 类型 ('request' | 'response')
   * @param {number} limit - 数量限制
   * @returns {Promise<Array>}
   */
  function getRecordsByType(type, limit) {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readonly');
        var store = transaction.objectStore(STORE_NAME);
        var index = store.index('type');
        var request = index.openCursor(IDBKeyRange.only(type), 'prev');
        
        var results = [];
        
        request.onsuccess = function(event) {
          var cursor = event.target.result;
          
          if (cursor && (!limit || results.length < limit)) {
            results.push(cursor.value);
            cursor.continue();
          } else {
            resolve(results);
          }
        };
        
        request.onerror = function(event) {
          reject(event.target.error);
        };
      }).catch(reject);
    });
  }

  /**
   * 删除记录
   * @param {string} id - 记录 ID
   * @returns {Promise<void>}
   */
  function deleteRecord(id) {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        var request = store.delete(id);
        
        request.onsuccess = function() {
          console.log('[AI-Chat-DB] 🗑️ 删除记录成功:', id);
          resolve();
        };
        
        request.onerror = function(event) {
          reject(event.target.error);
        };
      }).catch(reject);
    });
  }

  /**
   * 清空所有记录
   * @returns {Promise<void>}
   */
  function clearAllRecords() {
    return new Promise(function(resolve, reject) {
      initDB().then(function(database) {
        var transaction = database.transaction([STORE_NAME], 'readwrite');
        var store = transaction.objectStore(STORE_NAME);
        var request = store.clear();
        
        request.onsuccess = function() {
          console.log('[AI-Chat-DB] 🧹 清空所有记录成功');
          resolve();
        };
        
        request.onerror = function(event) {
          reject(event.target.error);
        };
      }).catch(reject);
    });
  }

  /**
   * 获取统计信息
   * @returns {Promise<Object>} 统计数据
   */
  function getStatistics() {
    return new Promise(function(resolve, reject) {
      getAllRecords().then(function(records) {
        var stats = {
          total: records.length,
          requests: records.filter(function(r) { return r.type === 'request'; }).length,
          responses: records.filter(function(r) { return r.type === 'response'; }).length,
          byModel: {},
          byProvider: {},
          oldestRecord: records.length > 0 ? records[records.length - 1].timestamp : null,
          newestRecord: records.length > 0 ? records[0].timestamp : null,
          totalSize: JSON.stringify(records).length
        };
        
        // 按模型统计
        records.forEach(function(r) {
          if (r.modelName) {
            stats.byModel[r.modelName] = (stats.byModel[r.modelName] || 0) + 1;
          }
          if (r.modelProvider) {
            stats.byProvider[r.modelProvider] = (stats.byProvider[r.modelProvider] || 0) + 1;
          }
        });
        
        resolve(stats);
      }).catch(reject);
    });
  }

  // ===== 导出 API =====
  window.AIChatDB = {
    // 初始化
    init: initDB,
    
    // CRUD 操作
    add: addRecord,
    addBatch: addRecords,
    getAll: getAllRecords,
    getById: getRecordById,
    getByType: getRecordsByType,
    delete: deleteRecord,
    clear: clearAllRecords,
    
    // Settings API（同步缓存 + 异步持久化）
    loadSettings: loadSettingsToCache,
    getSetting: getSetting,
    setSetting: setSetting,
    removeSetting: removeSetting,
    clearSettings: clearSettings,
    migrateFromLocalStorage: migrateFromLocalStorage,
    
    // 工具函数
    generateId: generateId,
    formatTimestamp: formatTimestamp,
    getStats: getStatistics,
    
    // 常量
    DB_NAME: DB_NAME,
    STORE_NAME: STORE_NAME,
    INDEX_NAME: INDEX_NAME
  };

  console.log('[AI-Chat-DB]  AIChatDB v2.0 模块已加载 (Settings 缓存层 + IndexedDB 持久化)');
  console.log('[AI-Chat-DB] 数据库名称:', DB_NAME);
  console.log('[AI-Chat-DB] 版本:', DB_VERSION);
  
  //  启动时：加载设置到缓存 + 从 localStorage 迁移
  loadSettingsToCache().then(function() {
    migrateFromLocalStorage();
  }).catch(function(e) {
    console.error('[AI-Chat-DB]  启动初始化失败:', e);
  });

})();
