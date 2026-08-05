/**
 * 配对详情插件
 * 用于显示配对利润核算的浮动窗口
 */

// 显示配对利润核算（使用FloatingWindow）
async function showPairDetailWithFloatingWindow(pair, stockName) {
  if (!pair || !stockName) return;
  
  // 确保必要的依赖存在
  if (typeof STOCKS === 'undefined' || typeof TAX_RATES === 'undefined') {
    console.error('缺少必要的依赖：STOCKS 或 TAX_RATES');
    return;
  }
  
  // 从数据库中获取最新的配对数据，确保屏蔽状态是最新的
  let latestPair = pair;
  if (window.tradesDB) {
    try {
      const allPairings = await window.tradesDB.getAllPairings();
      const stockPairing = allPairings.find(p => p.stockName === stockName);
      
      if (stockPairing) {
        // 在所有可能的结构中查找配对
        let found = false;
        
        // 检查直接的pairedTrades数组（主要结构）
        if (stockPairing.pairedTrades) {
          for (let i = 0; i < stockPairing.pairedTrades.length; i++) {
            const p = stockPairing.pairedTrades[i];
            if (p.buy.id === pair.buy.id && p.sell.id === pair.sell.id) {
              latestPair = p;
              found = true;
              break;
            }
          }
        }
        
        // 同时检查可能存在的其他结构（兼容旧格式）
        if (!found && stockPairing.latest && stockPairing.latest.pairedTrades) {
          for (let i = 0; i < stockPairing.latest.pairedTrades.length; i++) {
            const p = stockPairing.latest.pairedTrades[i];
            if (p.buy.id === pair.buy.id && p.sell.id === pair.sell.id) {
              latestPair = p;
              found = true;
              break;
            }
          }
        }
        
        if (!found && stockPairing.history && stockPairing.history.pairedTrades) {
          for (let i = 0; i < stockPairing.history.pairedTrades.length; i++) {
            const p = stockPairing.history.pairedTrades[i];
            if (p.buy.id === pair.buy.id && p.sell.id === pair.sell.id) {
              latestPair = p;
              found = true;
              break;
            }
          }
        }
        
        if (!found && stockPairing.crossBlock && stockPairing.crossBlock.pairedTrades) {
          for (let i = 0; i < stockPairing.crossBlock.pairedTrades.length; i++) {
            const p = stockPairing.crossBlock.pairedTrades[i];
            if (p.buy.id === pair.buy.id && p.sell.id === pair.sell.id) {
              latestPair = p;
              found = true;
              break;
            }
          }
        }
      }
    } catch (error) {
      console.error('获取最新配对数据失败:', error);
    }
  }
  
  const stockData = STOCKS.find(s => s.name === stockName);
  const type = stockData ? stockData.type : '';
  const taxRate = TAX_RATES[type];
  
  // 确保pair.buy.qty和pair.sell.qty存在
  if (!latestPair.buy.qty) latestPair.buy.qty = 1000; // 默认数量
  if (!latestPair.sell.qty) latestPair.sell.qty = 1000; // 默认数量
  
  const windowTitle = `${stockName}(${latestPair.buy.qty}, ${type}) - 配对利润核算`;
  
  // 计算金额和税费
  const buyAmount = latestPair.buy.price * latestPair.buy.qty;
  const sellAmount = latestPair.sell.price * latestPair.sell.qty;
  const buyTax = calculateTax ? calculateTax(stockName, 'buy', buyAmount) : 0;
  const sellTax = calculateTax ? calculateTax(stockName, 'sell', sellAmount) : 0;
  const grossProfit = sellAmount - buyAmount;
  const netProfit = grossProfit - buyTax - sellTax;
  
  // 生成窗口内容
  const bodyContent = `
    <div style="padding: 8px;">
      <div class="pair-detail-section">
      <h4 class="pair-detail-title">买入信息</h4>
      <div class="detail-item">
        <span class="detail-label">买入价格：</span>
        <span class="detail-value trade-side-buy">${latestPair.buy.price}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入数量：</span>
        <span class="detail-value">${latestPair.buy.qty}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入金额：</span>
        <span class="detail-value">${buyAmount}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入日期：</span>
        <span class="detail-value">${latestPair.buy.date || ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入时间：</span>
        <span class="detail-value">${latestPair.buy.createdAt && formatDateTime ? formatDateTime(latestPair.buy.createdAt) : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入税费率：</span>
        <span class="detail-value">${taxRate ? taxRate.buy : 0}‱</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">买入税费：</span>
        <span class="detail-value">${buyTax.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="pair-detail-section">
      <h4 class="pair-detail-title">卖出信息</h4>
      <div class="detail-item">
        <span class="detail-label">卖出价格：</span>
        <span class="detail-value trade-side-sell">${latestPair.sell.price}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出数量：</span>
        <span class="detail-value">${latestPair.sell.qty}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出金额：</span>
        <span class="detail-value">${sellAmount}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出日期：</span>
        <span class="detail-value">${latestPair.sell.date || ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出时间：</span>
        <span class="detail-value">${latestPair.sell.createdAt && formatDateTime ? formatDateTime(latestPair.sell.createdAt) : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出税费率：</span>
        <span class="detail-value">${taxRate ? taxRate.sell : 0}‱</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">卖出税费：</span>
        <span class="detail-value">${sellTax.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="pair-detail-section pair-profit-section">
      <h4 class="pair-detail-title">利润核算</h4>
      <div class="detail-item">
        <span class="detail-label">毛利润（卖出-买入）：</span>
        <span class="detail-value ${grossProfit >= 0 ? 'net-positive' : 'net-negative'}">${grossProfit.toFixed(2)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">总税费（买入+卖出）：</span>
        <span class="detail-value">-${(buyTax + sellTax).toFixed(2)}</span>
      </div>
      <div class="detail-item profit-total">
        <span class="detail-label">净利润：</span>
        <span class="detail-value ${netProfit >= 0 ? 'net-positive' : 'net-negative'}">${netProfit.toFixed(2)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">屏蔽状态：</span>
        <select id="hideableSelect" style="padding: 4px 8px; font-size: 12px;">
          <option value="" ${latestPair.hideable !== 'Y' ? 'selected' : ''}>未屏蔽</option>
          <option value="Y" ${latestPair.hideable === 'Y' ? 'selected' : ''}>已屏蔽</option>
        </select>
      </div>
    </div>
    
    <div style="margin-top: 20px; padding-top: 10px; border-top: 1px solid #ddd;">
      <button id="saveHideableBtn" style="padding: 8px 16px; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">保存屏蔽状态</button>
    </div>
    </div>
  `;
  
  // 确保 FloatingWindow 类存在
  if (typeof FloatingWindow === 'undefined') {
    console.error('FloatingWindow 类未定义');
    return;
  }
  
  // 创建 FloatingWindow 实例
  const pairDetailWindow = new FloatingWindow({
    title: windowTitle,
    sourceFile: 'pairDetailPlugin.js',
    width: '600px',
    height: '700px',
    x: '100px',
    y: '100px',
    draggable: false,
    id: `pair-detail-window-${Date.now()}`
  });
  
  // 设置窗口内容并显示
  pairDetailWindow.setContent(bodyContent);
  pairDetailWindow.show();
  
  // 为保存按钮添加点击事件处理
  const saveBtn = pairDetailWindow.getElement().querySelector('#saveHideableBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', async () => {
      try {
        const hideableSelect = pairDetailWindow.getElement().querySelector('#hideableSelect');
        if (!hideableSelect) {
          console.error('未找到 hideableSelect 元素');
          return;
        }
        
        const newHideableValue = hideableSelect.value;
        
        // 检查 tradesDB 是否存在
        if (!window.tradesDB) {
          console.error('tradesDB 未定义');
          return;
        }
        
        // 获取该股票的配对数据
        const allPairings = await window.tradesDB.getAllPairings();
        const stockPairing = allPairings.find(p => p.stockName === stockName);
        
        if (!stockPairing) {
          console.error('未找到该股票的配对数据');
          return;
        }
        
        // 找到要更新的配对
        let updated = false;
        
        // 检查直接的pairedTrades数组（主要结构）
        if (stockPairing.pairedTrades) {
          for (let i = 0; i < stockPairing.pairedTrades.length; i++) {
            const p = stockPairing.pairedTrades[i];
            if (p.buy.id === latestPair.buy.id && p.sell.id === latestPair.sell.id) {
              p.hideable = newHideableValue;
              updated = true;
              break;
            }
          }
        }
        
        // 同时检查可能存在的其他结构（兼容旧格式）
        if (!updated && stockPairing.latest && stockPairing.latest.pairedTrades) {
          for (let i = 0; i < stockPairing.latest.pairedTrades.length; i++) {
            const p = stockPairing.latest.pairedTrades[i];
            if (p.buy.id === latestPair.buy.id && p.sell.id === latestPair.sell.id) {
              p.hideable = newHideableValue;
              updated = true;
              break;
            }
          }
        }
        
        if (!updated && stockPairing.history && stockPairing.history.pairedTrades) {
          for (let i = 0; i < stockPairing.history.pairedTrades.length; i++) {
            const p = stockPairing.history.pairedTrades[i];
            if (p.buy.id === latestPair.buy.id && p.sell.id === latestPair.sell.id) {
              p.hideable = newHideableValue;
              updated = true;
              break;
            }
          }
        }
        
        if (!updated && stockPairing.crossBlock && stockPairing.crossBlock.pairedTrades) {
          for (let i = 0; i < stockPairing.crossBlock.pairedTrades.length; i++) {
            const p = stockPairing.crossBlock.pairedTrades[i];
            if (p.buy.id === latestPair.buy.id && p.sell.id === latestPair.sell.id) {
              p.hideable = newHideableValue;
              updated = true;
              break;
            }
          }
        }
        
        if (updated) {
          // 保存更新后的配对数据
          await window.tradesDB.savePairing(stockPairing);
          
          // 重新加载配对数据并更新全局配对缓存
          if (window.pairingCache) {
            window.pairingCache[stockName] = {
              pairedTrades: stockPairing.pairedTrades || [],
              pairedBuyIds: stockPairing.pairedBuyIds || [],
              pairedSellIds: stockPairing.pairedSellIds || [],
              latest: stockPairing.latest,
              history: stockPairing.history,
              crossBlock: stockPairing.crossBlock
            };
          }
          
          // 重新渲染表格
          if (window.renderStockModeTable) {
            await window.renderStockModeTable();
          }
          
          // 关闭窗口
          pairDetailWindow.destroy();
          
          // 显示保存成功提示
          alert('屏蔽状态已保存');
          
          // 跳转到当前股票的位置（用setTimeout确保DOM已稳定）
          setTimeout(() => {
            if (stockName && window.jumpToStock) {
              window.jumpToStock(stockName);
            }
          }, 200);
        } else {
          console.error('未找到要更新的配对');
          alert('未找到要更新的配对');
        }
      } catch (error) {
          console.error('保存屏蔽状态失败:', error);
          alert('保存失败: ' + error.message);
        }
    });
  }
}

// 将函数暴露到全局作用域，以便其他文件调用
if (typeof window !== 'undefined') {
  window.showPairDetailWithFloatingWindow = showPairDetailWithFloatingWindow;
}

// 支持 CommonJS 模块导出（如果在 Node.js 环境中使用）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = showPairDetailWithFloatingWindow;
}
