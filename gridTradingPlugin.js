/**
 * 网格交易建议插件
 * 基于未配对数据提供网格交易建议
 */
class GridTradingPlugin {
  constructor() {
    this.initialized = false;
    this.floatingWindow = null;
    this.currentStock = null;
    this.data = {
      unpairedBuys: [],
      unpairedSells: [],
      allBuys: [],
      allSells: [],
      currentPrice: 0,
      thresholdPercent: 1.5
    };
    this.mode = 'unpaired';
  }

  init() {
    if (this.initialized) return;
    
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化网格交易插件');
      return;
    }
    
    this.floatingWindow = new FloatingWindow({
      title: '网格交易建议',
      sourceFile: 'gridTradingPlugin.js',
      width: '950px',
      height: '750px',
      draggable: false,
      id: 'grid-trading-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });
    
    this.initialized = true;
  }

  onWindowClose() {
    console.log('网格交易窗口已关闭');
  }

  onWindowShow() {
    console.log('网格交易窗口已显示');
  }

  onWindowHide() {
    console.log('网格交易窗口已隐藏');
  }

  show(stockName, unpairedBuys, unpairedSells, allBuys, allSells, currentPrice, thresholdPercent = 1.5, pairedProfit = 0) {
    if (!this.initialized) {
      this.init();
    }
    
    if (!this.floatingWindow) {
      console.error('FloatingWindow 未初始化');
      return;
    }
    
    this.currentStock = stockName;
    
    this.data = {
      unpairedBuys: unpairedBuys,
      unpairedSells: unpairedSells,
      allBuys: allBuys,
      allSells: allSells,
      currentPrice: currentPrice,
      thresholdPercent: thresholdPercent,
      pairedProfit: pairedProfit
    };
    
    this.floatingWindow.setTitle(`${stockName} - 网格交易建议`);
    this.floatingWindow.setContent(this.generateContent());
    this.floatingWindow.show();
    
    this.bindEvents();
  }

  renderContent() {
    if (!this.floatingWindow) return;
    const winEl = this.floatingWindow.getElement();
    if (!winEl) return;
    
    const content = winEl.querySelector('.floating-body');
    if (content) {
      content.innerHTML = this.generateContent();
      this.bindModeToggleEvent();
      this.bindBarDblClickEvents();
    }
  }

  bindModeToggleEvent() {
    if (!this.floatingWindow) return;
    const winEl = this.floatingWindow.getElement();
    if (!winEl) return;
    
    const toggleBtn = winEl.querySelector('.mode-toggle-btn');
    if (toggleBtn) {
      const newBtn = toggleBtn.cloneNode(true);
      toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
      
      newBtn.addEventListener('click', () => {
        this.mode = this.mode === 'unpaired' ? 'all' : 'unpaired';
        this.renderContent();
      });
    }
  }

  /**
   * 获取最大小数位数
   * @param {Array} prices - 价格数组
   * @returns {number} 最大小数位数
   */
  getMaxDecimalPlaces(prices) {
    let maxDecimals = 2; // 默认2位
    prices.forEach(price => {
      if (price !== null && price !== undefined) {
        const priceStr = price.toString();
        const dotIndex = priceStr.indexOf('.');
        if (dotIndex !== -1) {
          const decimals = priceStr.length - dotIndex - 1;
          if (decimals > maxDecimals) {
            maxDecimals = decimals;
          }
        }
      }
    });
    return maxDecimals;
  }

  /**
   * 生成显示内容
   */
  generateContent() {
    // 根据模式选择数据
    const buys = this.mode === 'unpaired' ? this.data.unpairedBuys : this.data.allBuys;
    const sells = this.mode === 'unpaired' ? this.data.unpairedSells : this.data.allSells;
    const currentPrice = this.data.currentPrice;
    const thresholdPercent = this.data.thresholdPercent;
    
    // 计算最大小数位数
    const allPricesForDecimal = [
      ...buys.map(t => t.price),
      ...sells.map(t => t.price),
      currentPrice
    ];
    const maxDecimalPlaces = this.getMaxDecimalPlaces(allPricesForDecimal);
    
    const threshold = thresholdPercent / 100;
    
    // 计算网格间距：最新交易价格 × 阈值百分比
    const gridStep = currentPrice * threshold;
    
    // 计算网格边界
    const allPrices = [
      ...buys.map(t => t.price),
      ...sells.map(t => t.price)
    ];
    
    if (allPrices.length === 0) {
      const modeText = this.mode === 'unpaired' ? '未配对' : '';
      return `<div class="grid-trading-content-wrapper" style="padding: 10px; height: 100%; box-sizing: border-box;"><div style="padding: 20px; text-align: center; color: #666;">暂无${modeText}数据</div></div>`;
    }
    
    const minPrice = Math.min(...allPrices);
    const maxPrice = Math.max(...allPrices);
    
    // 计算需要多少层级才能覆盖所有持仓（以当前价格为中心刻度）
    const stepsBelow = Math.ceil((currentPrice - minPrice) / gridStep);
    const stepsAbove = Math.ceil((maxPrice - currentPrice) / gridStep);
    const halfLevels = Math.max(stepsBelow, stepsAbove, 5); // 至少5层
    
    // 网格边界：当前价格为中心刻度，向上下扩展
    // 网格刻度：currentPrice, currentPrice ± gridStep, currentPrice ± 2*gridStep, ...
    // 每个网格的中心价格就是刻度值
    const gridMin = currentPrice - halfLevels * gridStep - gridStep / 2;
    const gridMax = currentPrice + halfLevels * gridStep + gridStep / 2;
    const actualLevels = halfLevels * 2 + 1;
    
    // 当前价格所在的层级索引（正中间）
    const currentLevelIndex = halfLevels;
    
    // 计算每个网格层级的持仓
    const gridData = [];
    for (let i = 0; i < actualLevels; i++) {
      // 网格中心价格（刻度）
      const centerPrice = currentPrice + (i - halfLevels) * gridStep;
      const priceLow = centerPrice - gridStep / 2;
      const priceHigh = centerPrice + gridStep / 2;
      
      // 计算该层级的买入持仓
      const buyQty = buys
        .filter(t => t.price >= priceLow && t.price < priceHigh)
        .reduce((sum, t) => sum + (t.qty || 0), 0);
      
      // 计算该层级的卖出持仓
      const sellQty = sells
        .filter(t => t.price >= priceLow && t.price < priceHigh)
        .reduce((sum, t) => sum + (t.qty || 0), 0);
      
      gridData.push({
        level: i,
        priceLow,
        priceHigh,
        centerPrice: (priceLow + priceHigh) / 2,
        buyQty,
        sellQty,
        netPosition: buyQty - sellQty
      });
    }
    
    // 计算总持仓
    const totalBuyQty = buys.reduce((sum, t) => sum + (t.qty || 0), 0);
    const totalSellQty = sells.reduce((sum, t) => sum + (t.qty || 0), 0);
    const netPosition = totalBuyQty - totalSellQty;
    
    // 计算平均成本
    const avgBuyCost = totalBuyQty > 0 
      ? buys.reduce((sum, t) => sum + t.price * (t.qty || 0), 0) / totalBuyQty 
      : 0;
    const avgSellCost = totalSellQty > 0 
      ? sells.reduce((sum, t) => sum + t.price * (t.qty || 0), 0) / totalSellQty 
      : 0;
    
    // 生成建议
    const suggestions = this.generateSuggestions(currentPrice, gridData, netPosition, avgBuyCost, avgSellCost, thresholdPercent, maxDecimalPlaces);
    
    // 计算最大持仓量用于绘图（取买入和卖出中的最大值）
    const maxPosition = Math.max(
      ...gridData.map(g => g.buyQty),
      ...gridData.map(g => g.sellQty),
      1
    );
    
    // 生成HTML
    let html = '<div class="grid-trading-content-wrapper" style="padding: 10px; height: 100%; box-sizing: border-box; overflow-y: auto;">';
    
    // 模式切换按钮
    const modeText = this.mode === 'unpaired' ? '未配对交易' : '全部交易';
    const nextModeText = this.mode === 'unpaired' ? '全部交易' : '未配对交易';
    html += '<div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">';
    html += `<span style="font-size: 14px; color: #374151; font-weight: bold;">当前显示: ${modeText}</span>`;
    html += `<button class="mode-toggle-btn" style="padding: 6px 12px; background-color: #8b5cf6; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px;">切换为${nextModeText}</button>`;
    html += '</div>';
    
    // 标题区域
    html += '<div class="grid-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #e5e7eb;">';
    html += `<div style="font-size: 18px; font-weight: bold; color: #374151;">网格交易分析</div>`;
    html += `<div style="font-size: 14px; color: #666;">当前价格: <span style="color: #f59e0b; font-weight: bold;">${currentPrice.toFixed(maxDecimalPlaces)}</span></div>`;
    html += '</div>';
    
    // 统计信息
    html += '<div class="grid-stats" style="display: flex; gap: 20px; margin-bottom: 20px; flex-wrap: wrap;">';
    html += `<div style="flex: 1; min-width: 150px; padding: 15px; background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 8px;">`;
    html += `<div style="font-size: 12px; color: #92400e;">总买入持仓</div>`;
    html += `<div style="font-size: 24px; font-weight: bold; color: #92400e;">${totalBuyQty}</div>`;
    html += `<div style="font-size: 12px; color: #92400e;">均价: ${avgBuyCost.toFixed(maxDecimalPlaces)}</div>`;
    html += '</div>';
    
    html += `<div style="flex: 1; min-width: 150px; padding: 15px; background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%); border-radius: 8px;">`;
    html += `<div style="font-size: 12px; color: #1e40af;">总卖出持仓</div>`;
    html += `<div style="font-size: 24px; font-weight: bold; color: #1e40af;">${totalSellQty}</div>`;
    html += `<div style="font-size: 12px; color: #1e40af;">均价: ${avgSellCost.toFixed(maxDecimalPlaces)}</div>`;
    html += '</div>';
    
    html += `<div style="flex: 1; min-width: 150px; padding: 15px; background: linear-gradient(135deg, ${netPosition >= 0 ? '#dcfce7' : '#fee2e2'} 0%, ${netPosition >= 0 ? '#bbf7d0' : '#fecaca'} 100%); border-radius: 8px;">`;
    html += `<div style="font-size: 12px; color: ${netPosition >= 0 ? '#166534' : '#991b1b'};">净持仓</div>`;
    html += `<div style="font-size: 24px; font-weight: bold; color: ${netPosition >= 0 ? '#166534' : '#991b1b'};">${netPosition >= 0 ? '+' : ''}${netPosition}</div>`;
    html += `<div style="font-size: 12px; color: ${netPosition >= 0 ? '#166534' : '#991b1b'};">${netPosition >= 0 ? '多头' : '空头'}</div>`;
    html += '</div>';
    
    // 配对净利润
    const pairedProfit = this.data.pairedProfit || 0;
    const pairedProfitClass = pairedProfit >= 0 ? 'net-positive' : 'net-negative';
    const pairedProfitBgColor = pairedProfit >= 0 ? '#dcfce7' : '#fee2e2';
    const pairedProfitBgEnd = pairedProfit >= 0 ? '#bbf7d0' : '#fecaca';
    const pairedProfitTextColor = pairedProfit >= 0 ? '#166534' : '#991b1b';
    html += `<div style="flex: 1; min-width: 150px; padding: 15px; background: linear-gradient(135deg, ${pairedProfitBgColor} 0%, ${pairedProfitBgEnd} 100%); border-radius: 8px;">`;
    html += `<div style="font-size: 12px; color: ${pairedProfitTextColor};">配对净利润</div>`;
    html += `<div style="font-size: 24px; font-weight: bold; color: ${pairedProfitTextColor};">${pairedProfit >= 0 ? '+' : ''}${pairedProfit.toFixed(2)}</div>`;
    html += `<div style="font-size: 12px; color: ${pairedProfitTextColor};">${pairedProfit >= 0 ? '盈利' : '亏损'}</div>`;
    html += '</div>';
    html += '</div>';
    
    // 网格图
    html += '<div class="grid-chart" style="margin-bottom: 20px;">';
    html += '<div style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 10px;">网格持仓分布图</div>';
    html += '<div class="grid-chart-container" data-buys=\'' + JSON.stringify(buys) + '\' data-sells=\'' + JSON.stringify(sells) + '\' style="display: flex; flex-direction: column; gap: 2px; background-color: #f9fafb; padding: 10px; border-radius: 8px;">';
    
    // 绘制网格
    for (let i = actualLevels - 1; i >= 0; i--) {
      const g = gridData[i];
      const isCurrentLevel = i === currentLevelIndex;
      const barWidth = Math.abs(g.netPosition) / maxPosition * 100;
      
      html += '<div class="grid-row" style="display: flex; align-items: center; gap: 10px;">';
      
      // 价格标签
      html += `<div style="width: 70px; text-align: right; font-size: 11px; color: ${isCurrentLevel ? '#f59e0b' : '#666'}; font-weight: ${isCurrentLevel ? 'bold' : 'normal'};">`;
      html += `${g.centerPrice.toFixed(maxDecimalPlaces)}`;
      html += '</div>';
      
      // 当前价格指示器
      if (isCurrentLevel) {
        html += `<div style="width: 20px; text-align: center; color: #f59e0b; font-weight: bold;">▶</div>`;
      } else {
        html += '<div style="width: 20px;"></div>';
      }
      
      // 持仓条
      html += `<div class="grid-bar-container" data-type="buy" data-price-low="${g.priceLow}" data-price-high="${g.priceHigh}" style="flex: 1; height: 20px; background-color: #e5e7eb; border-radius: 4px; overflow: hidden; position: relative; cursor: pointer;" title="买入持仓: ${g.buyQty}股\n价格区间: ${g.priceLow.toFixed(maxDecimalPlaces)} - ${g.priceHigh.toFixed(maxDecimalPlaces)}\n双击查看明细">`;
      
      // 买入持仓条
      if (g.buyQty > 0) {
        const buyBarWidth = (g.buyQty / maxPosition) * 50;
        html += `<div class="bar buy-bar" data-type="buy" data-price-low="${g.priceLow}" data-price-high="${g.priceHigh}" style="position: absolute; left: 50%; height: 100%; width: ${buyBarWidth}%; background-color: #ef4444; border-radius: 0 4px 4px 0; cursor: pointer;" title="买入持仓: ${g.buyQty}股\n价格区间: ${g.priceLow.toFixed(maxDecimalPlaces)} - ${g.priceHigh.toFixed(maxDecimalPlaces)}\n双击查看明细"></div>`;
      }
      
      // 卖出持仓条
      if (g.sellQty > 0) {
        const sellBarWidth = (g.sellQty / maxPosition) * 50;
        html += `<div class="bar sell-bar" data-type="sell" data-price-low="${g.priceLow}" data-price-high="${g.priceHigh}" style="position: absolute; right: 50%; height: 100%; width: ${sellBarWidth}%; background-color: #3b82f6; border-radius: 4px 0 0 4px; cursor: pointer;" title="卖出持仓: ${g.sellQty}股\n价格区间: ${g.priceLow.toFixed(maxDecimalPlaces)} - ${g.priceHigh.toFixed(maxDecimalPlaces)}\n双击查看明细"></div>`;
      }
      
      // 中线
      html += `<div style="position: absolute; left: 50%; top: 0; height: 100%; width: 1px; background-color: #9ca3af;"></div>`;
      html += '</div>';
      
      // 持仓数量
      html += `<div style="width: 60px; text-align: left; font-size: 11px;">`;
      if (g.buyQty > 0) {
        html += `<span style="color: #ef4444;">+${g.buyQty}</span>`;
      }
      if (g.sellQty > 0) {
        if (g.buyQty > 0) html += ' ';
        html += `<span style="color: #3b82f6;">-${g.sellQty}</span>`;
      }
      html += '</div>';

      
      html += '</div>';
    }
    
    // 图例
    html += '<div style="display: flex; justify-content: center; gap: 20px; margin-top: 10px; font-size: 12px; color: #666;">';
    html += '<span><span style="display: inline-block; width: 12px; height: 12px; background-color: #ef4444; border-radius: 2px; margin-right: 4px;"></span>买入持仓</span>';
    html += '<span><span style="display: inline-block; width: 12px; height: 12px; background-color: #3b82f6; border-radius: 2px; margin-right: 4px;"></span>卖出持仓</span>';
    html += '<span><span style="color: #f59e0b;">▶</span> 当前价格</span>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    
    // 交易建议
    html += '<div class="grid-suggestions" style="margin-bottom: 20px;">';
    html += '<div style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 10px;">交易建议</div>';
    html += '<div style="display: flex; gap: 15px; flex-wrap: wrap;">';
    
    suggestions.forEach(s => {
      const bgColor = s.type === 'buy' ? '#fef2f2' : s.type === 'sell' ? '#eff6ff' : '#f9fafb';
      const borderColor = s.type === 'buy' ? '#ef4444' : s.type === 'sell' ? '#3b82f6' : '#9ca3af';
      const textColor = s.type === 'buy' ? '#991b1b' : s.type === 'sell' ? '#1e40af' : '#374151';
      
      html += `<div style="flex: 1; min-width: 200px; padding: 15px; background-color: ${bgColor}; border-left: 4px solid ${borderColor}; border-radius: 0 8px 8px 0;">`;
      html += `<div style="font-size: 12px; color: ${textColor}; font-weight: bold; margin-bottom: 5px;">${s.title}</div>`;
      html += `<div style="font-size: 14px; color: ${textColor};">${s.content}</div>`;
      html += '</div>';
    });
    
    html += '</div>';
    html += '</div>';
    
    // 网格设置
    html += '<div class="grid-settings" style="padding: 15px; background-color: #f9fafb; border-radius: 8px;">';
    html += '<div style="font-size: 14px; font-weight: bold; color: #374151; margin-bottom: 10px;">网格设置</div>';
    html += '<div style="display: flex; gap: 20px; align-items: center; flex-wrap: wrap;">';
    html += `<div><span style="color: #666;">网格层级:</span> <span style="color: #374151; font-weight: bold;">${actualLevels}</span></div>`;
    html += `<div><span style="color: #666;">网格下限:</span> <span style="color: #374151; font-weight: bold;">${gridMin.toFixed(maxDecimalPlaces)}</span></div>`;
    html += `<div><span style="color: #666;">网格上限:</span> <span style="color: #374151; font-weight: bold;">${gridMax.toFixed(maxDecimalPlaces)}</span></div>`;
    html += '</div>';
    html += '<div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #e5e7eb;">';
    html += `<span style="color: #666;">网格间距: </span>`;
    html += `<span style="color: #374151; font-weight: bold;">${gridStep.toFixed(maxDecimalPlaces)}</span>`;
    html += `<span style="color: #9ca3af; font-size: 12px;"> (= 当前价格 ${currentPrice.toFixed(maxDecimalPlaces)} × 阈值 ${thresholdPercent}%)</span>`;
    html += '</div>';
    html += '</div>';
    
    html += '</div>';
    
    return html;
  }

  /**
   * 生成交易建议
   */
  generateSuggestions(currentPrice, gridData, netPosition, avgBuyCost, avgSellCost, thresholdPercent, maxDecimalPlaces) {
    const suggestions = [];
    
    // 找到当前价格所在的网格层级（当前价格正好是某个网格的中心价格）
    const currentLevelIndex = gridData.findIndex(g => Math.abs(g.centerPrice - currentPrice) < 0.001);
    const currentLevel = gridData[currentLevelIndex];
    
    // 建议1: 基于净持仓的建议
    if (netPosition > 0) {
      const profitPrice = avgBuyCost * (1 + thresholdPercent / 100);
      suggestions.push({
        type: 'sell',
        title: '卖出建议',
        content: `当前持有多头仓位 ${netPosition} 股，建议在 ${profitPrice.toFixed(maxDecimalPlaces)} 以上逐步卖出获利。`
      });
    } else if (netPosition < 0) {
      const buyBackPrice = avgSellCost * (1 - thresholdPercent / 100);
      suggestions.push({
        type: 'buy',
        title: '买入建议',
        content: `当前持有空头仓位 ${Math.abs(netPosition)} 股，建议在 ${buyBackPrice.toFixed(maxDecimalPlaces)} 以下买回平仓。`
      });
    } else {
      suggestions.push({
        type: 'neutral',
        title: '持仓平衡',
        content: '当前买卖持仓平衡，可根据市场波动进行网格交易。'
      });
    }
    
    // 建议2: 基于当前价格位置的建议
    if (currentLevel) {
      if (currentLevel.netPosition > 0) {
        suggestions.push({
          type: 'sell',
          title: '当前价位有卖压',
          content: `当前价格区间有 ${currentLevel.netPosition} 股买入持仓，可考虑卖出。`
        });
      } else if (currentLevel.netPosition < 0) {
        suggestions.push({
          type: 'buy',
          title: '当前价位有买压',
          content: `当前价格区间有 ${Math.abs(currentLevel.netPosition)} 股卖出持仓，可考虑买入。`
        });
      }
    }
    
    // 建议3: 网格交易建议
    const upperLevel = gridData[currentLevelIndex + 1];
    const lowerLevel = gridData[currentLevelIndex - 1];
    
    if (upperLevel && upperLevel.netPosition < 0) {
      suggestions.push({
        type: 'sell',
        title: '上方阻力位',
        content: `上方 ${upperLevel.centerPrice.toFixed(maxDecimalPlaces)} 附近有 ${Math.abs(upperLevel.netPosition)} 股卖出挂单。`
      });
    }
    
    if (lowerLevel && lowerLevel.netPosition > 0) {
      suggestions.push({
        type: 'buy',
        title: '下方支撑位',
        content: `下方 ${lowerLevel.centerPrice.toFixed(maxDecimalPlaces)} 附近有 ${lowerLevel.netPosition} 股买入挂单。`
      });
    }
    
    return suggestions;
  }

  bindEvents() {
    if (!this.floatingWindow) return;
    const winEl = this.floatingWindow.getElement();
    if (!winEl) return;
    
    this.bindModeToggleEvent();
    this.bindBarDblClickEvents();
  }

  bindBarDblClickEvents() {
    if (!this.floatingWindow) return;
    const winEl = this.floatingWindow.getElement();
    if (!winEl) return;
    
    const content = winEl.querySelector('.floating-body');
    if (!content) return;
    
    const chartContainer = content.querySelector('.grid-chart-container');
    if (!chartContainer) return;
    
    let buys = [];
    let sells = [];
    try {
      const buysData = chartContainer.getAttribute('data-buys');
      const sellsData = chartContainer.getAttribute('data-sells');
      if (buysData) buys = JSON.parse(buysData);
      if (sellsData) sells = JSON.parse(sellsData);
    } catch (parseErr) {
      console.error('解析交易数据失败', parseErr);
    }
    
    const buyBars = content.querySelectorAll('.bar.buy-bar');
    buyBars.forEach(bar => {
      bar.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        
        const priceLow = parseFloat(bar.getAttribute('data-price-low'));
        const priceHigh = parseFloat(bar.getAttribute('data-price-high'));
        
        const filteredTrades = buys.filter(t => t.price >= priceLow && t.price < priceHigh);
        
        if (filteredTrades.length === 0) {
          alert('该价格区间没有买入交易');
          return;
        }
        
        const maxDecimalPlaces = this.getMaxDecimalPlaces(filteredTrades.map(t => t.price));
        
        if (window.chartDetailModal) {
          window.chartDetailModal.show({
            type: 'buy',
            priceLow: priceLow,
            priceHigh: priceHigh,
            trades: filteredTrades,
            decimalPlaces: maxDecimalPlaces
          });
        } else {
          console.error('chartDetailModal 插件未加载');
        }
      });
    });
    
    const sellBars = content.querySelectorAll('.bar.sell-bar');
    sellBars.forEach(bar => {
      bar.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        
        const priceLow = parseFloat(bar.getAttribute('data-price-low'));
        const priceHigh = parseFloat(bar.getAttribute('data-price-high'));
        
        const filteredTrades = sells.filter(t => t.price >= priceLow && t.price < priceHigh);
        
        if (filteredTrades.length === 0) {
          alert('该价格区间没有卖出交易');
          return;
        }
        
        const maxDecimalPlaces = this.getMaxDecimalPlaces(filteredTrades.map(t => t.price));
        
        if (window.chartDetailModal) {
          window.chartDetailModal.show({
            type: 'sell',
            priceLow: priceLow,
            priceHigh: priceHigh,
            trades: filteredTrades,
            decimalPlaces: maxDecimalPlaces
          });
        } else {
          console.error('chartDetailModal 插件未加载');
        }
      });
    });
  }

  close() {
    if (this.floatingWindow) {
      this.floatingWindow.hide();
    }
  }

  hide() {
    this.close();
  }

  destroy() {
    if (this.floatingWindow) {
      this.floatingWindow.destroy();
      this.floatingWindow = null;
    }
    this.initialized = false;
  }
}

// 导出单例
window.gridTradingPlugin = new GridTradingPlugin();
