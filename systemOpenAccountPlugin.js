/**
 * SystemOpenAccount Plugin
 * 系统开帐插件
 */

class SystemOpenAccount {
  constructor() {
    this.openAccountWindow = null;
    this.tradesValidated = false;
    this.pairingsValidated = false;
    this.tradesData = null;
    this.pairingsData = null;
    this.init();
  }

  init() {
    console.log('SystemOpenAccount init() 被调用');
  }

  // trades 表的必填字段
  getTradesRequiredFields() {
    return ['id', 'date', 'createdAt', 'market', 'stock', 'side', 'qty', 'price', 'amount', 'remark'];
  }

  // trades 表的可选字段
  getTradesOptionalFields() {
    return ['hideable'];
  }

  // pairings 表的必填字段
  getPairingsRequiredFields() {
    return ['stockName', 'pairedTrades', 'pairedBuyIds', 'pairedSellIds', 'updatedAt'];
  }

  // pairings 表的可选字段
  getPairingsOptionalFields() {
    return [];
  }

  // 验证 pairedTrades 中的交易记录（和 trades 表一样）
  validateTradeRecord(trade, recordIndex, tradeIndex, side) {
    const requiredFields = this.getTradesRequiredFields();
    const optionalFields = this.getTradesOptionalFields();
    const allFields = [...requiredFields, ...optionalFields];
    let errors = [];
    let warnings = [];

    requiredFields.forEach(field => {
      if (!(field in trade)) {
        errors.push(`第 ${recordIndex + 1} 条记录的 pairedTrades[${tradeIndex}] ${side} 缺少必填字段: ${field}`);
      }
    });

    Object.keys(trade).forEach(field => {
      if (!allFields.includes(field)) {
        warnings.push(`第 ${recordIndex + 1} 条记录的 pairedTrades[${tradeIndex}] ${side} 包含未知字段: ${field}`);
      }
    });

    return { errors, warnings };
  }

  // 解析并验证 trades 资料
  parseAndValidateTradesData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      
      // 检查基本结构
      if (!data.database || !data.table || !data.data) {
        return { valid: false, message: 'JSON 格式不正确，缺少必要字段: database, table, data' };
      }

      if (data.table !== 'trades') {
        return { valid: false, message: `表名不正确，期望: trades，实际: ${data.table}` };
      }

      if (!Array.isArray(data.data)) {
        return { valid: false, message: 'data 字段必须是数组' };
      }

      const requiredFields = this.getTradesRequiredFields();
      const optionalFields = this.getTradesOptionalFields();
      const allFields = [...requiredFields, ...optionalFields];
      let errors = [];
      let warnings = [];

      // 检查每条记录
      data.data.forEach((item, index) => {
        // 检查必填字段
        requiredFields.forEach(field => {
          if (!(field in item)) {
            errors.push(`第 ${index + 1} 条记录缺少必填字段: ${field}`);
          }
        });

        // 检查是否有未知字段
        Object.keys(item).forEach(field => {
          if (!allFields.includes(field)) {
            warnings.push(`第 ${index + 1} 条记录包含未知字段: ${field}`);
          }
        });
      });

      if (errors.length > 0) {
        return {
          valid: false,
          message: `验证失败！\n\n错误:\n${errors.join('\n')}${warnings.length > 0 ? '\n\n警告:\n' + warnings.join('\n') : ''}`
        };
      }

      let message = `验证成功！\n\n数据库: ${data.database}\n表名: ${data.table}\n数据笔数: ${data.data.length}`;
      if (warnings.length > 0) {
        message += `\n\n警告:\n${warnings.join('\n')}`;
      }
      message += '\n\n此资料适合导入到 trades 表中！';

      return { valid: true, message, data: data.data };
    } catch (e) {
      return { valid: false, message: `JSON 解析失败: ${e.message}` };
    }
  }

  // 解析并验证 pairings 资料
  parseAndValidatePairingsData(jsonStr) {
    try {
      const data = JSON.parse(jsonStr);
      
      // 检查基本结构
      if (!data.database || !data.table || !data.data) {
        return { valid: false, message: 'JSON 格式不正确，缺少必要字段: database, table, data' };
      }

      if (data.table !== 'pairings') {
        return { valid: false, message: `表名不正确，期望: pairings，实际: ${data.table}` };
      }

      if (!Array.isArray(data.data)) {
        return { valid: false, message: 'data 字段必须是数组' };
      }

      const requiredFields = this.getPairingsRequiredFields();
      const optionalFields = this.getPairingsOptionalFields();
      const allFields = [...requiredFields, ...optionalFields];
      let errors = [];
      let warnings = [];

      // 检查每条记录
      data.data.forEach((item, index) => {
        // 检查必填字段
        requiredFields.forEach(field => {
          if (!(field in item)) {
            errors.push(`第 ${index + 1} 条记录缺少必填字段: ${field}`);
          }
        });

        // 检查是否有未知字段
        Object.keys(item).forEach(field => {
          if (!allFields.includes(field)) {
            warnings.push(`第 ${index + 1} 条记录包含未知字段: ${field}`);
          }
        });

        // 检查 pairedTrades 是否是数组
        if (item.pairedTrades && !Array.isArray(item.pairedTrades)) {
          errors.push(`第 ${index + 1} 条记录的 pairedTrades 必须是数组`);
        } else if (item.pairedTrades) {
          // 检查 pairedTrades 中的每个配对记录
          item.pairedTrades.forEach((pairedTrade, tradeIndex) => {
            // 检查 buy 和 sell 是否存在
            if (!pairedTrade.buy) {
              errors.push(`第 ${index + 1} 条记录的 pairedTrades[${tradeIndex}] 缺少 buy 字段`);
            } else {
              const buyResult = this.validateTradeRecord(pairedTrade.buy, index, tradeIndex, 'buy');
              errors.push(...buyResult.errors);
              warnings.push(...buyResult.warnings);
            }

            if (!pairedTrade.sell) {
              errors.push(`第 ${index + 1} 条记录的 pairedTrades[${tradeIndex}] 缺少 sell 字段`);
            } else {
              const sellResult = this.validateTradeRecord(pairedTrade.sell, index, tradeIndex, 'sell');
              errors.push(...sellResult.errors);
              warnings.push(...sellResult.warnings);
            }

            // 检查 profit 字段
            if (!('profit' in pairedTrade)) {
              errors.push(`第 ${index + 1} 条记录的 pairedTrades[${tradeIndex}] 缺少 profit 字段`);
            }

            // 检查 hideable 字段（可选）
            const pairedTradeFields = ['buy', 'sell', 'profit', 'hideable'];
            Object.keys(pairedTrade).forEach(field => {
              if (!pairedTradeFields.includes(field)) {
                warnings.push(`第 ${index + 1} 条记录的 pairedTrades[${tradeIndex}] 包含未知字段: ${field}`);
              }
            });
          });
        }

        // 检查 pairedBuyIds 和 pairedSellIds 是否是数组
        if (item.pairedBuyIds && !Array.isArray(item.pairedBuyIds)) {
          errors.push(`第 ${index + 1} 条记录的 pairedBuyIds 必须是数组`);
        }
        if (item.pairedSellIds && !Array.isArray(item.pairedSellIds)) {
          errors.push(`第 ${index + 1} 条记录的 pairedSellIds 必须是数组`);
        }
      });

      if (errors.length > 0) {
        return {
          valid: false,
          message: `验证失败！\n\n错误:\n${errors.join('\n')}${warnings.length > 0 ? '\n\n警告:\n' + warnings.join('\n') : ''}`
        };
      }

      // 计算总的配对笔数
      let totalPairs = 0;
      data.data.forEach(item => {
        if (item.pairedTrades && Array.isArray(item.pairedTrades)) {
          totalPairs += item.pairedTrades.length;
        }
      });

      let message = `验证成功！\n\n数据库: ${data.database}\n表名: ${data.table}\n股票数: ${data.data.length}\n配对笔数: ${totalPairs}`;
      if (warnings.length > 0) {
        message += `\n\n警告:\n${warnings.join('\n')}`;
      }
      message += '\n\n此资料适合导入到 pairings 表中！';

      return { valid: true, message, data: data.data };
    } catch (e) {
      return { valid: false, message: `JSON 解析失败: ${e.message}` };
    }
  }

  // 更新按钮状态
  updateButtonState(importBtn, hasDbData) {
    const shouldDisable = hasDbData || !this.tradesValidated || !this.pairingsValidated;
    
    if (shouldDisable) {
      importBtn.disabled = true;
      importBtn.style.opacity = '0.5';
      importBtn.style.cursor = 'not-allowed';
      if (hasDbData) {
        importBtn.title = '数据库已在运行，不可以重新开帐!';
      } else if (!this.tradesValidated && !this.pairingsValidated) {
        importBtn.title = '请先验证 trades 和 pairings 资料！';
      } else if (!this.tradesValidated) {
        importBtn.title = '请先验证 trades 交易资料！';
      } else {
        importBtn.title = '请先验证 pairings 交易配对资料！';
      }
    } else {
      importBtn.disabled = false;
      importBtn.style.opacity = '1';
      importBtn.style.cursor = 'pointer';
      importBtn.title = '';
    }
  }

  // 显示系统开帐视窗
  async showModal() {
    // 确保悬浮视窗实例存在
    if (!this.openAccountWindow) {
      this.openAccountWindow = new FloatingWindow({
        title: '*系统开帐*',
        sourceFile: 'systemOpenAccountPlugin.js',
        width: '900px',
        height: '700px',
        x: '100px',
        y: '100px',
        draggable: false,
        id: 'systemOpenAccountWindow'
      });
    }

    // 检查数据库是否有数据
    const hasData = await this.checkDatabaseHasData();
    
    // 重置验证状态和数据
    this.tradesValidated = false;
    this.pairingsValidated = false;
    this.tradesData = null;
    this.pairingsData = null;

    // 构建视窗内容
    const content = `
      <div class="system-open-account-container">
        <div class="top-button-container">
          <button id="importDataBtn">开帐资料导入</button>
        </div>
        <div class="editors-container">
          <div class="editor-panel">
            <div class="editor-header" style="display: flex; justify-content: space-between; align-items: center;">
              <span>trades 交易资料</span>
              <button id="parseTradesBtn" style="padding: 4px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">资料解析</button>
            </div>
            <textarea id="tradesEditor" class="editor-textarea" placeholder="请输入trades交易资料..."></textarea>
            <div id="tradesParseResult" style="padding: 8px; font-size: 12px; display: none;"></div>
          </div>
          <div class="editor-panel">
            <div class="editor-header" style="display: flex; justify-content: space-between; align-items: center;">
              <span>pairings 交易配对资料</span>
              <button id="parsePairingsBtn" style="padding: 4px 12px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">资料解析</button>
            </div>
            <textarea id="pairingsEditor" class="editor-textarea" placeholder="请输入pairings交易配对资料..."></textarea>
            <div id="pairingsParseResult" style="padding: 8px; font-size: 12px; display: none;"></div>
          </div>
        </div>
      </div>
    `;

    // 设置视窗内容
    this.openAccountWindow.setContent(content);
    // 显示视窗
    this.openAccountWindow.show();

    // 获取视窗主体元素
    const floatingBody = this.openAccountWindow.getElement().querySelector('.floating-body');
    const importBtn = floatingBody.querySelector('#importDataBtn');
    const tradesEditor = floatingBody.querySelector('#tradesEditor');
    const pairingsEditor = floatingBody.querySelector('#pairingsEditor');
    const parseTradesBtn = floatingBody.querySelector('#parseTradesBtn');
    const tradesParseResult = floatingBody.querySelector('#tradesParseResult');
    const parsePairingsBtn = floatingBody.querySelector('#parsePairingsBtn');
    const pairingsParseResult = floatingBody.querySelector('#pairingsParseResult');

    // 初始更新按钮状态
    this.updateButtonState(importBtn, hasData);

    // 资料解析按钮事件
    parseTradesBtn.addEventListener('click', () => {
      const jsonStr = tradesEditor.value.trim();
      if (!jsonStr) {
        tradesParseResult.style.display = 'block';
        tradesParseResult.style.color = '#dc3545';
        tradesParseResult.style.background = '#f8d7da';
        tradesParseResult.style.padding = '8px';
        tradesParseResult.style.borderRadius = '4px';
        tradesParseResult.textContent = '请先在编辑框中输入 JSON 资料！';
        this.tradesValidated = false;
        this.updateButtonState(importBtn, hasData);
        return;
      }

      const result = this.parseAndValidateTradesData(jsonStr);
      this.tradesValidated = result.valid;
      if (result.valid) {
        this.tradesData = result.data;
      } else {
        this.tradesData = null;
      }
      tradesParseResult.style.display = 'block';
      tradesParseResult.style.padding = '8px';
      tradesParseResult.style.borderRadius = '4px';
      tradesParseResult.style.whiteSpace = 'pre-wrap';

      if (result.valid) {
        tradesParseResult.style.color = '#155724';
        tradesParseResult.style.background = '#d4edda';
      } else {
        tradesParseResult.style.color = '#721c24';
        tradesParseResult.style.background = '#f8d7da';
      }
      tradesParseResult.textContent = result.message;
      this.updateButtonState(importBtn, hasData);
    });

    // pairings 资料解析按钮事件
    parsePairingsBtn.addEventListener('click', () => {
      const jsonStr = pairingsEditor.value.trim();
      if (!jsonStr) {
        pairingsParseResult.style.display = 'block';
        pairingsParseResult.style.color = '#dc3545';
        pairingsParseResult.style.background = '#f8d7da';
        pairingsParseResult.style.padding = '8px';
        pairingsParseResult.style.borderRadius = '4px';
        pairingsParseResult.textContent = '请先在编辑框中输入 JSON 资料！';
        this.pairingsValidated = false;
        this.updateButtonState(importBtn, hasData);
        return;
      }

      const result = this.parseAndValidatePairingsData(jsonStr);
      this.pairingsValidated = result.valid;
      if (result.valid) {
        this.pairingsData = result.data;
      } else {
        this.pairingsData = null;
      }
      pairingsParseResult.style.display = 'block';
      pairingsParseResult.style.padding = '8px';
      pairingsParseResult.style.borderRadius = '4px';
      pairingsParseResult.style.whiteSpace = 'pre-wrap';

      if (result.valid) {
        pairingsParseResult.style.color = '#155724';
        pairingsParseResult.style.background = '#d4edda';
      } else {
        pairingsParseResult.style.color = '#721c24';
        pairingsParseResult.style.background = '#f8d7da';
      }
      pairingsParseResult.textContent = result.message;
      this.updateButtonState(importBtn, hasData);
    });

    // 如果数据库有数据，只设置状态即可
    if (!hasData) {
      // 开帐资料导入按钮事件
      importBtn.addEventListener('click', () => {
        this.handleImportData();
      });

      // 监听编辑框内容变化，内容改变时重置验证状态
      const resetTradesValidation = () => {
        this.tradesValidated = false;
        this.updateButtonState(importBtn, hasData);
      };
      const resetPairingsValidation = () => {
        this.pairingsValidated = false;
        this.updateButtonState(importBtn, hasData);
      };
      tradesEditor.addEventListener('input', resetTradesValidation);
      pairingsEditor.addEventListener('input', resetPairingsValidation);
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

  // 检查数据库是否有数据
  async checkDatabaseHasData() {
    try {
      const db = await this.openDb('TradesDB');
      const tradesData = await this.getAllData(db, 'trades');
      const pairingsData = await this.getAllData(db, 'pairings');
      db.close();
      
      return tradesData.length > 0 || pairingsData.length > 0;
    } catch (error) {
      console.error('检查数据库失败:', error);
      return false;
    }
  }

  // 验证密码
  promptPassword() {
    return new Promise((resolve) => {
      const password = prompt('请输入开帐密码：');
      resolve(password === '123456');
    });
  }

  // 处理开帐资料导入
  async handleImportData() {
    console.log('开帐资料导入按钮被点击');
    
    // 检查是否两个资料都验证成功
    if (!this.tradesValidated || !this.pairingsValidated) {
      let message = '请先完成以下验证：\n';
      if (!this.tradesValidated) {
        message += '- trades 交易资料\n';
      }
      if (!this.pairingsValidated) {
        message += '- pairings 交易配对资料\n';
      }
      alert(message);
      return;
    }
    
    // 检查数据库是否有数据
    const hasData = await this.checkDatabaseHasData();
    
    if (hasData) {
      alert('数据库已在运行，不可以重新开帐!');
      return;
    }
    
    // 验证密码
    const passwordValid = await this.promptPassword();
    
    if (!passwordValid) {
      alert('密码错误!');
      return;
    }
    
    alert('密码验证成功，继续后续操作!');
    
    // 开始导入数据
    await this.importData();
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

  // 导入数据到数据库
  async importData() {
    try {
      console.log('开始导入数据...');
      
      // 打开数据库
      const db = await this.openDb('TradesDB');
      
      // 导入 trades 数据
      if (this.tradesData && this.tradesData.length > 0) {
        console.log(`导入 ${this.tradesData.length} 条 trades 记录`);
        await this.saveDataToDb(db, 'trades', this.tradesData);
      }
      
      // 导入 pairings 数据
      if (this.pairingsData && this.pairingsData.length > 0) {
        console.log(`导入 ${this.pairingsData.length} 条 pairings 记录`);
        await this.saveDataToDb(db, 'pairings', this.pairingsData);
      }
      
      db.close();
      
      alert('开帐成功！数据已导入数据库。');
      
      // 自动调用重置按钮来刷新数据
      if (typeof resetFilters === 'function') {
        resetFilters();
      }
      
      // 关闭系统开帐视窗
      if (this.openAccountWindow) {
        this.openAccountWindow.hide();
      }
      
      // 重置状态
      this.tradesValidated = false;
      this.pairingsValidated = false;
      this.tradesData = null;
      this.pairingsData = null;
      
    } catch (error) {
      console.error('导入数据失败:', error);
      alert('导入失败：' + error.message);
    }
  }
}

// 初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM 加载完成，初始化 SystemOpenAccount');
    window.SystemOpenAccountPlugin = new SystemOpenAccount();
  });
} else {
  console.log('DOM 已加载，直接初始化 SystemOpenAccount');
  window.SystemOpenAccountPlugin = new SystemOpenAccount();
}

console.log('SystemOpenAccount plugin loaded successfully');
