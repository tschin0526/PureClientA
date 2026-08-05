/**
 * 股票信息插件
 * 显示股票的统计数据（配对笔数、利润、买卖统计等），使用悬浮视窗作为显示载体
 */

class StockInfoPlugin {
  constructor() {
    this.name = 'StockInfoPlugin';
    this.floatingWindow = null;
    this.currentStock = null;
    this.initialized = false;
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;

    console.log('股票信息插件初始化中...');

    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化股票信息插件');
      return;
    }

    this.floatingWindow = new FloatingWindow({
      title: '股票信息',
      sourceFile: 'stockInfoPlugin.js',
      width: '500px',
      height: '600px',
      draggable: false,
      id: 'stock-info-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });

    this.initialized = true;
    console.log('股票信息插件初始化完成');
  }

  /**
   * 显示股票信息
   * @param {string} stockName - 股票名称
   * @param {Array} stockTrades - 该股票的交易数据
   */
  showStockInfo(stockName, stockTrades) {
    if (!this.initialized) {
      this.init();
    }

    this.currentStock = stockName;

    if (!stockTrades || stockTrades.length === 0) {
      alert('该股票暂无交易数据');
      return;
    }

    const stats = this.calculateStockStats(stockName, stockTrades);
    const content = this.generateContent(stockName, stats);

    this.floatingWindow.setTitle(`${stockName} - 股票信息`);
    this.floatingWindow.setContent(content);
    this.floatingWindow.show();
  }

  /**
   * 计算股票统计数据
   * @param {string} stockName - 股票名称
   * @param {Array} stockTrades - 交易数据
   * @returns {Object} 统计数据对象
   */
  calculateStockStats(stockName, stockTrades) {
    const stats = {
      pairedCount: 0,
      pairedProfit: 0,
      buyCount: 0,
      buyQty: 0,
      buyAmount: 0,
      sellCount: 0,
      sellQty: 0,
      sellAmount: 0,
      unpairedBuyCount: 0,
      unpairedBuyQty: 0,
      unpairedBuyAmount: 0,
      unpairedSellCount: 0,
      unpairedSellQty: 0,
      unpairedSellAmount: 0
    };

    const cachedPairing = pairingCache[stockName] || {};
    const pairedTrades = cachedPairing.pairedTrades || [];
    const pairedBuyIds = new Set(cachedPairing.pairedBuyIds || []);
    const pairedSellIds = new Set(cachedPairing.pairedSellIds || []);

    stats.pairedCount = pairedTrades.length;
    pairedTrades.forEach(pair => {
      if (pair.buy && pair.sell) {
        const buyAmount = pair.buy.price * pair.buy.qty;
        const sellAmount = pair.sell.price * pair.sell.qty;
        const buyTax = calculateTax(stockName, 'buy', buyAmount);
        const sellTax = calculateTax(stockName, 'sell', sellAmount);
        const profit = sellAmount - buyAmount - buyTax - sellTax;
        stats.pairedProfit += profit;
      }
    });

    stockTrades.forEach(trade => {
      if (trade.side === 'buy') {
        stats.buyCount++;
        stats.buyQty += trade.qty;
        stats.buyAmount += trade.price * trade.qty;

        if (!pairedBuyIds.has(trade.id)) {
          stats.unpairedBuyCount++;
          stats.unpairedBuyQty += trade.qty;
          stats.unpairedBuyAmount += trade.price * trade.qty;
        }
      } else if (trade.side === 'sell') {
        stats.sellCount++;
        stats.sellQty += trade.qty;
        stats.sellAmount += trade.price * trade.qty;

        if (!pairedSellIds.has(trade.id)) {
          stats.unpairedSellCount++;
          stats.unpairedSellQty += trade.qty;
          stats.unpairedSellAmount += trade.price * trade.qty;
        }
      }
    });

    stats.balanceQty = stats.buyQty - stats.sellQty;
    stats.balanceAmount = stats.buyAmount - stats.sellAmount;
    stats.balanceUnitCost = stats.balanceQty !== 0 ? stats.balanceAmount / stats.balanceQty : 0;

    return stats;
  }

  /**
   * 格式化金额为千分撇
   * @param {number} amount - 金额
   * @returns {string} 格式化后的字符串
   */
  formatAmount(amount) {
    return amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * 根据值返回颜色类名
   * @param {number} value - 数值
   * @returns {string} CSS类名
   */
  getValueColorClass(value) {
    if (value > 0) return 'stock-info-value-positive';
    if (value < 0) return 'stock-info-value-negative';
    return '';
  }

  /**
   * 生成内容HTML
   * @param {string} stockName - 股票名称
   * @param {Object} stats - 统计数据
   * @returns {string} HTML字符串
   */
  generateContent(stockName, stats) {
    const tableData = [
      { label: '配对笔数', value: stats.pairedCount, color: false },
      { label: '配对利润', value: `¥${this.formatAmount(stats.pairedProfit)}`, color: true, rawValue: stats.pairedProfit },
      { label: '买入笔数', value: stats.buyCount, color: false },
      { label: '买入数量', value: stats.buyQty, color: false },
      { label: '买入金额', value: `¥${this.formatAmount(stats.buyAmount)}`, color: false },
      { label: '卖出笔数', value: stats.sellCount, color: false },
      { label: '卖出数量', value: stats.sellQty, color: false },
      { label: '卖出金额', value: `¥${this.formatAmount(stats.sellAmount)}`, color: false },
      { label: '结存数量', value: stats.balanceQty, color: false },
      { label: '结存金额', value: `¥${this.formatAmount(stats.balanceAmount)}`, color: true, rawValue: stats.balanceAmount },
      { label: '结存单位成本', value: `¥${this.formatAmount(stats.balanceUnitCost)}`, color: true, rawValue: stats.balanceUnitCost },
      { label: '未配对买入笔数', value: stats.unpairedBuyCount, color: false },
      { label: '未配对买入数量', value: stats.unpairedBuyQty, color: false },
      { label: '未配对买入金额', value: `¥${this.formatAmount(stats.unpairedBuyAmount)}`, color: false },
      { label: '未配对卖出笔数', value: stats.unpairedSellCount, color: false },
      { label: '未配对卖出数量', value: stats.unpairedSellQty, color: false },
      { label: '未配对卖出金额', value: `¥${this.formatAmount(stats.unpairedSellAmount)}`, color: false }
    ];

    let rowsHtml = '';
    tableData.forEach(row => {
      const valueClass = row.color ? this.getValueColorClass(row.rawValue) : '';
      rowsHtml += `
        <tr>
          <td class="stock-info-label">${row.label}</td>
          <td class="stock-info-value ${valueClass}">${row.value}</td>
        </tr>`;
    });

    return `
      <div class="stock-info-container">
        <table class="stock-info-table">
          <thead>
            <tr>
              <th>项目</th>
              <th>数值</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    `;
  }

  onWindowClose() {
    console.log('股票信息视窗已关闭');
  }

  onWindowShow() {
    console.log('股票信息视窗已显示');
  }

  onWindowHide() {
    console.log('股票信息视窗已隐藏');
  }
}

window.StockInfoPlugin = StockInfoPlugin;
window.stockInfoPlugin = new StockInfoPlugin();
