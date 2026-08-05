/**
 * 批次修改气泡屏蔽插件
 * 用于批量设置多个交易记录的气泡屏蔽功能
 */

class BatchHideBubblePlugin {
  constructor() {
    this.name = 'BatchHideBubblePlugin';
    this.floatingWindow = null;
    this.initialized = false;
    this.currentStockName = null;
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;

    console.log('批次修改气泡屏蔽插件初始化中...');

    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化批次修改气泡屏蔽插件');
      return;
    }
    this.initialized = true;
    console.log('批次修改气泡屏蔽插件初始化完成');
  }

  /**
   * 打开批次修改窗口
   * @param {string} stockName - 股票名称
   */
  openBatchHideWindow(stockName) {
    if (!this.initialized) this.init();
    this.currentStockName = stockName;

    this.floatingWindow = new FloatingWindow({
      title: `批次修改气泡屏蔽 - ${stockName}`,
      width: '600px',
      height: '600px',
      x: '150px',
      y: '100px',
      draggable: true,
      id: 'batch-hide-bubble-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });

    const content = this.generateContent();
    this.floatingWindow.setContent(content);
    this.floatingWindow.show();
    this.bindEvents();
  }

  /**
   * 生成窗口内容
   * @returns {string} HTML内容
   */
  generateContent() {
    const stockTrades = (window.trades || []).filter(t => t.stock === this.currentStockName);
    let tableRows = stockTrades
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map(trade => `
        <tr data-trade-id="${trade.id}">
          <td><input type="checkbox" class="hide-checkbox" ${trade.hideable === 'Y' ? 'checked' : ''}></td>
          <td>${trade.date}</td>
          <td>${trade.side === 'buy' ? '买入' : '卖出'}</td>
          <td>${trade.price}</td>
          <td>${trade.qty}</td>
          <td>${trade.remark || ''}</td>
        </tr>
      `).join('');

    return `
      <div class="batch-hide-content">
        <style>
          .batch-hide-content {
            padding: 15px;
            font-family: Arial, sans-serif;
          }
          .batch-hide-table-container {
            max-height: 400px;
            overflow-y: auto;
            margin-bottom: 15px;
            border: 1px solid #ddd;
            border-radius: 4px;
          }
          .batch-hide-table {
            width: 100%;
            border-collapse: collapse;
          }
          .batch-hide-table th, .batch-hide-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
          }
          .batch-hide-table th {
            background-color: #f2f2f2;
            position: sticky;
            top: 0;
          }
          .batch-hide-actions {
            display: flex;
            justify-content: flex-end;
            gap: 10px;
          }
          .batch-hide-btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
          }
          .batch-hide-btn.save {
            background-color: #007bff;
            color: white;
          }
          .batch-hide-btn.cancel {
            background-color: #6c757d;
            color: white;
          }
        </style>
        <div class="batch-hide-table-container">
          <table class="batch-hide-table">
            <thead>
              <tr>
                <th>屏蔽</th>
                <th>日期</th>
                <th>买卖</th>
                <th>单价</th>
                <th>数量</th>
                <th>备注</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
        <div class="batch-hide-actions">
          <button class="batch-hide-btn cancel" id="batchHideCancelBtn">取消</button>
          <button class="batch-hide-btn save" id="batchHideSaveBtn">保存修改</button>
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
      if (!winEl) return;
      const saveBtn = winEl.querySelector('#batchHideSaveBtn');
      if (saveBtn) {
        saveBtn.addEventListener('click', () => this.saveChanges());
      }
      const cancelBtn = winEl.querySelector('#batchHideCancelBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => this.cancel());
      }
    } catch (err) {
      console.error('为批次修改窗口绑定事件失败', err);
    }
  }

  /**
   * 保存修改
   */
  saveChanges() {
    try {
      const winEl = this.floatingWindow.getElement();
      if (!winEl) return;
      const checkboxes = winEl.querySelectorAll('.hide-checkbox');
      
      const updates = [];
      checkboxes.forEach(cb => {
        const tr = cb.closest('tr');
        const tradeId = tr.dataset.tradeId;
        const isChecked = cb.checked;
        updates.push({ id: tradeId, hideable: isChecked ? 'Y' : 'N' });
      });

      if (window.tradesDB && window.tradesDB.save) {
        const promises = updates.map(async update => {
          const trade = window.trades.find(t => t.id === update.id);
          if (trade) {
            trade.hideable = update.hideable;
            return window.tradesDB.save(trade);
          }
          return Promise.resolve();
        });

        Promise.all(promises).then(async () => {
          if (window.loadTrades && typeof window.loadTrades === 'function') {
            await window.loadTrades();
          }
          if (window.applyFilters && typeof window.applyFilters === 'function') {
            await window.applyFilters();
          }
          
          // 刷新买卖建议窗口
          if (window.BuySellAdvicePlugin && window.buySellAdvicePlugin) {
            window.buySellAdvicePlugin.showAdvice(this.currentStockName, window.trades, window.pairingCache);
          }
          
          alert('保存成功');
          this.hideWindow();
        }).catch(err => {
          console.error('保存失败', err);
          alert('保存失败，请重试');
        });
      } else {
        alert('保存功能不可用');
      }
    } catch (err) {
      console.error('保存时出错', err);
      alert('保存时出错');
    }
  }

  /**
   * 取消
   */
  cancel() {
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
  }

  onWindowClose() {
    console.log('批次修改窗口已关闭');
  }

  onWindowShow() {
    console.log('批次修改窗口已显示');
  }

  onWindowHide() {
    console.log('批次修改窗口已隐藏');
  }
}

if (typeof window !== 'undefined') {
  window.BatchHideBubblePlugin = BatchHideBubblePlugin;
  window.batchHideBubblePlugin = new BatchHideBubblePlugin();
  window.openBatchHideBubbleWindow = function(stockName) {
    window.batchHideBubblePlugin.openBatchHideWindow(stockName);
  };
}
