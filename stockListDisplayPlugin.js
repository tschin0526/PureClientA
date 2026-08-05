/**
 * 股票清单展示插件
 * 专注于股票数据的只读展示，包括交易统计、持仓信息等
 * 
 * 拆分自 stockCodeManagerPlugin.js（方案B：架构优化）
 * 职责单一：只负责数据展示，不涉及数据管理
 */

class StockListDisplayPlugin {
  constructor() {
    this.name = 'StockListDisplayPlugin';
    this.initialized = false;
    this.stockListWindow = null;
  }

  /**
   * HTML 转义（防 XSS）
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;
    
    console.log('股票清单展示插件初始化中...');
    
    // 检查 FloatingWindow 是否可用
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化股票清单展示插件');
      return;
    }
    
    // 绑定按钮事件
    this.bindEvents();
    
    this.initialized = true;
    console.log('股票清单展示插件初始化完成');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const stockListExportBtn = document.getElementById('stockListExportBtn');
    if (stockListExportBtn) {
      stockListExportBtn.addEventListener('click', () => this.showStockListDropdown());
    }
  }

  /**
   * 获取股票列表（异步版本）
   * 优先从 StockCodeManagerPlugin 获取数据，确保数据一致性
   */
  async getStockList() {
    try {
      // 如果 StockCodeManagerPlugin 已初始化且可用，使用其数据源
      if (window.stockCodeManager && window.stockCodeManager.getStockList) {
        return await window.stockCodeManager.getStockList();
      }
      
      // 否则使用全局变量作为后备方案
      const stocks = window.STOCKS || [];
      if (!stocks || stocks.length === 0) {
        console.warn('[StockListDisplay] 无法获取股票列表，STOCKS 为空或未定义');
      }
      
      return stocks.map(s => ({ ...s }));
    } catch (e) {
      console.error('[StockListDisplay] getStockList 失败:', e);
      return (window.STOCKS || []).map(s => ({ ...s }));
    }
  }

  /**
   * 显示股票清单浮动视窗（供外部按钮调用，使用 FloatingWindow 组件）
   */
  async showStockListDropdown() {
    const stocks = await this.getStockList();
    if (!stocks || stocks.length === 0) {
      alert('当前没有股票清单数据\n请先打开「股票代码管理」进行数据维护');
      return;
    }

    if (this.stockListWindow) {
      try { this.stockListWindow.close(); } catch(e) {}
    }

    const allTrades = window.trades || [];
    const tradeStats = {};
    allTrades.forEach(t => {
      if (!tradeStats[t.stock]) { tradeStats[t.stock] = { buy: 0, sell: 0 }; }
      if (t.side === 'buy') { tradeStats[t.stock].buy += t.qty; }
      else if (t.side === 'sell') { tradeStats[t.stock].sell += t.qty; }
    });

    const contentHtml = BaseManagerPlugin.renderListTable({
      title: '当前股票清单',
      icon: '📋',
      dataCount: stocks.length,
      dataSource: '浏览器持久化',
      themeColor: { from: '#3b82f6', to: '#1d4ed8' },
      columns: [
        { key: 'code', label: '股票代码', width: '10%', align: 'center' },
        { key: 'name', label: '股票名称', width: '15%', align: 'left' },
        { key: 'screenshotName', label: '截图用名称', width: '12%', align: 'left' },
        { key: 'qty', label: '单位', width: '6%', align: 'center' },
        { key: 'market', label: '市场', width: '6%', align: 'center' },
        { key: 'type', label: '类型', width: '8%', align: 'center' },
        { key: '_buyCount', label: '买入数量', width: '14%', align: 'right' },
        { key: '_sellCount', label: '卖出数量', width: '14%', align: 'right' },
        { key: '_remain', label: '结余数量', width: '15%', align: 'right' }
      ],
      data: stocks.map(s => {
        const stats = tradeStats[s.name] || { buy: 0, sell: 0 };
        return {
          ...s,
          _buyCount: stats.buy,
          _sellCount: stats.sell,
          _remain: stats.buy - stats.sell
        };
      }),
      renderCell: (row, col) => {
        switch(col.key) {
          case 'code':
            return `<span style="color:#6b7280;font-size:12px;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.code || '-')}</span>`;
          case 'name':
            return `<span style="font-weight:500;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.name)}</span>`;
          case 'screenshotName':
            const displayName = row.screenshotName || row.name || '-';
            return `<span style="color:#059669;font-style:italic;">${BaseManagerPlugin.prototype.escapeHtml.call(null, displayName)}</span>`;
          case 'type':
            return `<span style="background:#dbeafe;color:#1d4ed8;padding:2px 6px;border-radius:4px;font-size:11px;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.type)}</span>`;
          case '_buyCount':
            return `<span style="color:#059669;font-weight:500;">${row._buyCount.toLocaleString()}</span>`;
          case '_sellCount':
            return `<span style="color:#dc2626;font-weight:500;">${row._sellCount.toLocaleString()}</span>`;
          case '_remain':
            const color = row._remain >= 0 ? '#1e40af' : '#dc2626';
            return `<span style="font-weight:600;color:${color};">${row._remain.toLocaleString()}</span>`;
          default:
            return BaseManagerPlugin.prototype.escapeHtml.call(null, row[col.key]);
        }
      },
      footerText: '数据由 StockCodeManagerPlugin 提供 · 由 StockListDisplayPlugin 渲染'
    });

    this.stockListWindow = new FloatingWindow({
      title: '股票清单',
      sourceFile: 'stockListDisplayPlugin.js',
      width: 700,
      height: 520,
      draggable: false,
      on: {
        close: () => { this.stockListWindow = null; }
      }
    });

    this.stockListWindow.setContent(contentHtml);
    this.stockListWindow.show();
  }

  /**
   * 销毁插件
   */
  destroy() {
    if (this.stockListWindow) {
      try { this.stockListWindow.close(); } catch(e) {}
      this.stockListWindow = null;
    }
    this.initialized = false;
  }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = StockListDisplayPlugin;
} else if (typeof window !== 'undefined') {
  window.StockListDisplayPlugin = StockListDisplayPlugin;
  // 创建全局实例
  window.stockListDisplay = new StockListDisplayPlugin();
  
  // 等待 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.stockListDisplay.init();
    });
  } else {
    // DOM 已经加载完成
    setTimeout(() => {
      window.stockListDisplay.init();
    }, 100);
  }
}
