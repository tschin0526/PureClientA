/**
 * 交易新增插件
 * 用于添加和编辑交易的浮动窗口
 */

class AddTradePlugin {
  constructor() {
    this.name = 'AddTradePlugin';
    this.floatingWindow = null;
    this.currentTrade = null;
    this.initialized = false;
    this.onSaveCallback = null;
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;
    
    console.log('交易新增插件初始化中...');
    
    // 检查 FloatingWindow 是否可用
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化交易新增插件');
      return;
    }
    
    this.initialized = true;
    console.log('交易新增插件初始化完成');
  }

  /**
   * 打开新增交易窗口
   * @param {Object|string} existingTrade - 现有交易数据（用于编辑）或股票名称（用于新增）
   * @param {Function} onSave - 保存成功后的回调函数
   */
  openAddTradeWindow(existingTrade = null, onSave = null) {
    if (!this.initialized) {
      this.init();
    }
    
    // 处理股票名称字符串参数
    let tradeData = null;
    let stockName = '';
    
    if (typeof existingTrade === 'string') {
      // 传入的是股票名称
      stockName = existingTrade;
      tradeData = null;
    } else {
      // 传入的是交易对象
      tradeData = existingTrade;
      stockName = existingTrade ? existingTrade.stock : '';
    }
    
    this.currentTrade = tradeData;
    this.onSaveCallback = onSave;
    
    // 创建浮动窗口
    this.floatingWindow = new FloatingWindow({
      title: tradeData ? '编辑交易' : '新增交易',
      width: '500px',
      height: '650px',
      x: '100px',
      y: '100px',
      draggable: false,
      id: 'add-trade-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });
    
    // 生成窗口内容
    const content = this.generateContent(tradeData, stockName);
    this.floatingWindow.setContent(content);
    this.floatingWindow.show();

    // 绑定事件
    this.bindEvents();
  }

  /**
   * 生成窗口内容
   * @param {Object} existingTrade - 现有交易数据
   * @param {string} stockName - 股票名称
   * @returns {string} HTML内容
   */
  generateContent(existingTrade = null, stockName = '') {
    const today = new Date().toISOString().slice(0, 10);
    const date = existingTrade ? existingTrade.date : today;
    const stock = existingTrade ? existingTrade.stock : stockName;
    const side = existingTrade ? existingTrade.side : 'buy';
    
    // 设置默认数量
    let defaultQty = '';
    if (existingTrade) {
      defaultQty = existingTrade.qty;
    } else if (stock && window.STOCKS) {
      const stockInfo = window.STOCKS.find(s => s.name === stock);
      defaultQty = stockInfo ? stockInfo.qty : 1000;
    } else {
      defaultQty = 1000;
    }
    
    const qty = existingTrade ? existingTrade.qty : defaultQty;
    const price = existingTrade ? existingTrade.price : '';
    const remark = existingTrade ? existingTrade.remark || '' : '';
    
    return `
      <div class="add-trade-content compact">
        <div class="form-group">
          <label for="addTradeDateInput">日期</label>
          <input type="date" id="addTradeDateInput" value="${date}" required>
        </div>
        
        <div class="form-group">
          <label for="addTradeStockInput">股票名称</label>
          <input type="text" id="addTradeStockInput" list="stockList" value="${stock}" placeholder="股票名称" required>
        </div>
        
        <div class="form-group">
          <label for="addTradeSideSelect">买卖方向</label>
          <select id="addTradeSideSelect" required>
            <option value="buy" ${side === 'buy' ? 'selected' : ''}>买入</option>
            <option value="sell" ${side === 'sell' ? 'selected' : ''}>卖出</option>
          </select>
        </div>
        
        <div class="form-group">
          <label for="addTradeQtyInput">数量</label>
          <input type="number" id="addTradeQtyInput" min="0" step="0.01" value="${qty}" placeholder="交易数量" required>
        </div>
        
        <div class="form-group">
          <label for="addTradePriceInput">单价（负数表示卖出）</label>
          <input type="number" id="addTradePriceInput" step="0.01" value="${price}" placeholder="正数买入，负数卖出" required>
        </div>
        
        <div class="form-group">
          <label for="addTradeRemarkInput">备注</label>
          <textarea id="addTradeRemarkInput" rows="2" placeholder="备注（可选）">${remark}</textarea>
        </div>
        
        <div class="form-actions">
          <button id="cancelTradeBtn" class="btn-cancel">取消</button>
          <button id="saveTradeBtn" class="btn-save">保存交易</button>
        </div>
      </div>
    `;
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    try {
      const winEl = this.floatingWindow.getElement();
      if (winEl) {
        // 保存按钮
        const saveBtn = winEl.querySelector('#saveTradeBtn');
        if (saveBtn) {
          saveBtn.addEventListener('click', () => this.saveTrade());
        }
        
        // 取消按钮
        const cancelBtn = winEl.querySelector('#cancelTradeBtn');
        if (cancelBtn) {
          cancelBtn.addEventListener('click', () => this.cancelTrade());
        }
        
        // 日期输入变化时计算可买入数量
        const dateInput = winEl.querySelector('#addTradeDateInput');
        const stockInput = winEl.querySelector('#addTradeStockInput');
        const sideSelect = winEl.querySelector('#addTradeSideSelect');
        const qtyInput = winEl.querySelector('#addTradeQtyInput');
        const priceInput = winEl.querySelector('#addTradePriceInput');
        
        if (dateInput && stockInput && sideSelect) {
          const updateQtyPlaceholder = () => {
            const date = dateInput.value;
            const stock = stockInput.value;
            const side = sideSelect.value;
            
            if (date && stock && side === 'buy') {
              if (window.calculateMaxBuyQty) {
                const canBuyQty = window.calculateMaxBuyQty(stock, date);
                if (canBuyQty !== null && canBuyQty > 0) {
                  qtyInput.placeholder = `最多再买${canBuyQty}股`;
                } else {
                  qtyInput.placeholder = '交易数量';
                }
              }
            } else {
              qtyInput.placeholder = '交易数量';
            }
          };
          
          dateInput.addEventListener('change', updateQtyPlaceholder);
          stockInput.addEventListener('input', updateQtyPlaceholder);
          sideSelect.addEventListener('change', updateQtyPlaceholder);
        }
        
        // 单价输入事件：负数自动切换为卖出，正数自动切换为买入
        if (priceInput && sideSelect) {
          priceInput.addEventListener('input', () => {
            const priceValue = parseFloat(priceInput.value);
            if (!isNaN(priceValue)) {
              if (priceValue < 0) {
                sideSelect.value = 'sell';
              } else if (priceValue > 0) {
                sideSelect.value = 'buy';
              }
            }
          });
        }
      }
    } catch (err) {
      console.error('为交易新增窗口绑定事件失败', err);
    }
  }

  /**
   * 保存交易
   */
  saveTrade() {
    try {
      const winEl = this.floatingWindow.getElement();
      if (!winEl) return;
      
      const dateInput = winEl.querySelector('#addTradeDateInput');
      const stockInput = winEl.querySelector('#addTradeStockInput');
      const sideSelect = winEl.querySelector('#addTradeSideSelect');
      const qtyInput = winEl.querySelector('#addTradeQtyInput');
      const priceInput = winEl.querySelector('#addTradePriceInput');
      const remarkInput = winEl.querySelector('#addTradeRemarkInput');
      
      const date = dateInput.value.trim();
      const stock = stockInput.value.trim();
      const side = sideSelect.value;
      const qty = parseFloat(qtyInput.value);
      let price = parseFloat(priceInput.value);
      const remark = remarkInput.value.trim();
      
      // 将负数价格转为正数（负号仅用于表示卖出方向）
      if (price < 0) {
        price = Math.abs(price);
      }
      
      // 验证输入
      if (!date || !stock || !side || isNaN(qty) || isNaN(price) || qty <= 0 || price <= 0) {
        alert('请填写完整正确的信息：日期、股票、买卖方向、数量和价格');
        return;
      }
      
      // 检查股票是否有效
      let stockInfo = null;
      if (window.findStockByName) {
        stockInfo = window.findStockByName(stock);
      }
      
      if (!stockInfo) {
        alert('无效的股票名称，请从下拉列表中选择');
        return;
      }
      
      // 检查可买入数量
      if (side === 'buy' && date && window.calculateMaxBuyQty) {
        const canBuyQty = window.calculateMaxBuyQty(stock, date);
        if (canBuyQty !== null && qty > canBuyQty) {
          alert(`该股票在${date}最多只能再买入${canBuyQty}股`);
          return;
        }
      }
      
      // 创建交易对象
      const newTrade = {
        id: this.currentTrade ? this.currentTrade.id : (window.generateId ? window.generateId() : Date.now().toString()),
        date,
        createdAt: this.currentTrade ? this.currentTrade.createdAt : new Date().toLocaleString('zh-CN', { hour12: false }),
        market: stockInfo.market,
        stock: stockInfo.name,
        side,
        qty,
        price,
        amount: qty * price,
        remark
      };
      
      // 保存交易
          if (window.tradesDB && window.tradesDB.save) {
            console.log('开始保存交易', newTrade);
            window.tradesDB.save(newTrade).then(async () => {
              console.log('交易保存成功，开始更新全局交易数据');
              if (window.trades) {
                // 更新全局交易数据
                const existingIndex = window.trades.findIndex(t => t.id === newTrade.id);
                if (existingIndex >= 0) {
                  console.log('更新现有交易数据', existingIndex);
                  window.trades[existingIndex] = newTrade;
                } else {
                  console.log('添加新交易数据');
                  window.trades.push(newTrade);
                }
                console.log('全局交易数据更新完成，window.trades长度:', window.trades.length);
              }
              
              // 刷新主程序数据
              if (window.loadTrades && typeof window.loadTrades === 'function') {
                console.log('开始加载交易数据');
                await window.loadTrades();
                console.log('交易数据加载完成');
              }
              
              if (window.applyFilters && typeof window.applyFilters === 'function') {
                console.log('开始应用筛选');
                await window.applyFilters();
                console.log('筛选应用完成');
              }
              
              // 在数据完全加载和刷新后调用回调函数
              console.log('调用回调函数', this.onSaveCallback);
              if (this.onSaveCallback) {
                this.onSaveCallback(newTrade);
              }
              
              // 显示成功消息
              alert('交易保存成功');
            }).catch(err => {
              console.error('保存交易失败', err);
              alert('保存交易失败，请重试');
            });
          } else {
            alert('保存功能不可用，请检查数据库连接');
          }
    } catch (err) {
      console.error('保存交易时出错', err);
      alert('保存交易时出错，请重试');
    }
  }

  /**
   * 取消新增
   */
  cancelTrade() {
    this.hideWindow();
  }

  /**
   * 隐藏窗口
   */
  hideWindow() {
    if (this.floatingWindow) {
      this.floatingWindow.hide();
      this.floatingWindow.destroy();
      this.floatingWindow = null;
    }
    this.currentTrade = null;
    this.onSaveCallback = null;
  }

  /**
   * 窗口关闭事件处理
   */
  onWindowClose() {
    console.log('交易新增窗口已关闭');
    this.currentTrade = null;
    this.onSaveCallback = null;
  }

  /**
   * 窗口显示事件处理
   */
  onWindowShow() {
    console.log('交易新增窗口已显示');
  }

  /**
   * 窗口隐藏事件处理
   */
  onWindowHide() {
    console.log('交易新增窗口已隐藏');
  }

  /**
   * 销毁插件
   */
  destroy() {
    this.hideWindow();
    this.initialized = false;
  }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AddTradePlugin;
} else if (typeof window !== 'undefined') {
  window.AddTradePlugin = AddTradePlugin;
  // 创建全局实例
  window.addTradePlugin = new AddTradePlugin();
  // 暴露全局函数
  window.openAddTradeModal = function(existingTrade = null, onSave = null) {
    window.addTradePlugin.openAddTradeWindow(existingTrade, onSave);
  };
}
