// bubbleDetail.js - 处理气泡详情相关功能

// 全局浮动窗口实例
let tradeDetailWindow = null;

function showTemporaryMessage(message) {
  const existing = document.getElementById('temporaryTradeMessage');
  if (existing) existing.remove();

  const messageElement = document.createElement('div');
  messageElement.id = 'temporaryTradeMessage';
  messageElement.textContent = message;
  messageElement.style.cssText = [
    'position: fixed',
    'left: 50%',
    'top: 50%',
    'transform: translate(-50%, -50%)',
    'padding: 18px 28px',
    'border-radius: 8px',
    'background: rgba(0, 0, 0, 0.78)',
    'color: #fff',
    'font-size: 16px',
    'z-index: 2147483647',
    'pointer-events: none',
    'text-align: center',
    'white-space: pre-line'
  ].join(';');
  document.body.appendChild(messageElement);

  setTimeout(() => {
    messageElement.remove();
  }, 1500);
}
window.showTemporaryMessage = showTemporaryMessage;

// 显示交易详情
function showTradeDetail(trade, source = 'main') {
  // 使用DebugUtils显示调试信息
  if (window.DebugUtils) {
    DebugUtils.showDebugInfo(`showTradeDetail 被调用，交易ID: ${trade.id}`);
  }
  
  if (!trade) {
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo('交易数据为空');
    }
    alert('交易数据为空');
    return;
  }
  
  let stockData, type, sideText, windowTitle;
  
  try {
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo('检查 STOCKS 变量: ' + (typeof STOCKS !== 'undefined'));
      DebugUtils.showDebugInfo('交易对象: ' + JSON.stringify(trade));
      DebugUtils.showDebugInfo('交易对象包含stock属性: ' + (trade.stock !== undefined));
      DebugUtils.showDebugInfo('交易对象包含qty属性: ' + (trade.qty !== undefined));
      DebugUtils.showDebugInfo('交易对象包含market属性: ' + (trade.market !== undefined));
      DebugUtils.showDebugInfo('交易对象包含side属性: ' + (trade.side !== undefined));
    }
    
    // 安全获取交易属性
    const stock = trade.stock || '未知股票';
    const qty = trade.qty || 0;
    const market = trade.market || '未知市场';
    const side = trade.side || 'buy';
    
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo('安全获取的属性: stock=' + stock + ', qty=' + qty + ', market=' + market + ', side=' + side);
    }
    
    stockData = STOCKS ? STOCKS.find(s => s.name === stock) : null;
    type = stockData ? stockData.type : (market === '台股' ? 'tA' : 'cETF');
    
    sideText = side === 'buy' ? '买入' : '卖出';
    windowTitle = `${stock}(${qty}, ${type}) - ${sideText}详情`;
    
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo(`创建浮动窗口，标题: ${windowTitle}`);
    }
    
    // 如果浮动窗口已存在，销毁它
    if (tradeDetailWindow && tradeDetailWindow.element) {
      if (window.DebugUtils) {
        DebugUtils.showDebugInfo('销毁现有浮动窗口');
      }
      if (tradeDetailWindow.element.parentNode) {
        tradeDetailWindow.element.parentNode.removeChild(tradeDetailWindow.element);
      }
      tradeDetailWindow = null;
    }
    
    // 创建新的浮动窗口
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo('开始创建浮动窗口');
      DebugUtils.showDebugInfo('FloatingWindow 类存在: ' + (typeof FloatingWindow !== 'undefined'));
    }
    
    // 根据屏幕尺寸动态设置窗口大小
    const isMobile = window.innerWidth < 768;
    const windowWidth = isMobile ? '90vw' : '800px';
    const windowHeight = isMobile ? '80vh' : '700px';
    
    // 使用 FloatingWindow 类创建窗口实例
    tradeDetailWindow = new FloatingWindow({
      title: windowTitle,
      sourceFile: 'bubbleDetail.js',
      width: windowWidth,
      height: windowHeight,
      x: '50px',
      y: '50px',
      draggable: false,
      id: `trade-detail-window-${trade.id}`
    });
    
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo('浮动窗口已创建');
      DebugUtils.showDebugInfo('浮动窗口ID: ' + tradeDetailWindow.options.id);
      DebugUtils.showDebugInfo('浮动窗口可拖拽: ' + tradeDetailWindow.options.draggable);
    }
  } catch (error) {
    if (window.DebugUtils) {
      DebugUtils.showDebugInfo(`创建浮动窗口失败: ${error.message}`);
      DebugUtils.showDebugInfo(`错误堆栈: ${error.stack}`);
    }
    alert('显示交易详情失败: ' + error.message);
    return;
  }
  
  // 创建显示模式内容
  function createViewMode() {
    console.log('createViewMode 被调用');
    console.log('trade对象:', trade);
    console.log('sideText:', sideText);
    console.log('tradeDetailWindow:', tradeDetailWindow);
    
    const safeSideText = sideText || (trade.side === 'buy' ? '买入' : '卖出');
    
    const bodyContent = `
      <div class="trade-detail-container" style="padding: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <div style="display: flex; gap: 10px;">
            <button id="editTradeBtn" style="padding: 10px 20px; background: #ffc107; color: #212529; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">修改</button>
            ${source === 'compact' ? '<button id="splitTradeBtn" style="padding: 10px 20px; background: #0d6efd; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">拆分气泡</button>' : ''}
            <button id="deleteTradeBtn" style="padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">删除此交易</button>
          </div>
        </div>
        
        <div style="margin-bottom: 20px;">
          <h3 style="margin-bottom: 10px; color: #555; font-size: 12px;">交易基本信息</h3>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <thead style="background: #f8f9fa;">
                <tr>
                  <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">字段</th>
                  <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">值</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">股票名称</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.stock || '未知'}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易方向</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;"><span class="${trade.side === 'buy' ? 'trade-side-buy' : 'trade-side-sell'}">${safeSideText}</span></td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易数量</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.qty || 0}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易单价</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;"><span class="${trade.side === 'buy' ? 'trade-side-buy' : 'trade-side-sell'}">${trade.price || 0}</span></td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易金额</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.amount || 0}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易日期</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.date || '未知'}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">输入时间</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${formatDateTime(trade.createdAt) || '未知'}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">屏蔽气泡</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.hideable ? trade.hideable : '否'}</td>
                </tr>
                <tr>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易备注</td>
                  <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.remark || '无'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h3 style="margin-bottom: 10px; color: #555; font-size: 12px;">交易数据</h3>
          <div id="tradeDataDisplay" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-height: 300px; overflow: auto; background: #f8f9fa; font-family: monospace; font-size: 14px;">
            <pre style="margin: 0;">${JSON.stringify(trade, null, 2)}</pre>
          </div>
        </div>
        
        <div id="pairingDataSection" style="margin-top: 20px;">
          <h3 style="margin-bottom: 10px; color: #555; font-size: 12px;">配对数据</h3>
          <div id="pairingDataDisplay" style="border: 1px solid #ddd; border-radius: 4px; padding: 10px; max-height: 300px; overflow: auto; background: #f8f9fa; font-family: monospace; font-size: 14px;">
            <div id="pairingDataContent">加载中...</div>
          </div>
        </div>
      </div>
    `;
    
    console.log('准备设置浮动窗口内容');
    // 设置浮动窗口内容
    tradeDetailWindow.setContent(bodyContent);
    console.log('浮动窗口内容已设置');
    
    // 显示窗口
    tradeDetailWindow.show();
    console.log('浮动窗口已显示');
    
    // 获取视窗主体元素
    const floatingBody = tradeDetailWindow.getElement().querySelector('.floating-body');
    
    // 修改按钮
    floatingBody.querySelector('#editTradeBtn').addEventListener('click', () => {
      createEditMode();
    });

    const splitTradeButton = floatingBody.querySelector('#splitTradeBtn');
    if (splitTradeButton) {
      splitTradeButton.addEventListener('click', async () => {
        const originalQty = Number(trade.qty);
        if (!Number.isInteger(originalQty) || originalQty <= 1) {
          alert('交易数量必须大于 1 才能拆分');
          return;
        }

        const firstQtyInput = prompt(`请输入第一个气泡数量（1-${originalQty - 1}）：`, String(Math.floor(originalQty / 2)));
        if (firstQtyInput === null) return;

        const firstQty = Number(firstQtyInput.trim());
        const secondQty = originalQty - firstQty;
        if (!Number.isInteger(firstQty) || firstQty <= 0 || secondQty <= 0) {
          alert(`拆分数量必须是 1 到 ${originalQty - 1} 之间的整数，且两笔数量合计必须等于 ${originalQty}`);
          return;
        }

        if (!confirm(`确定将 ${originalQty} 拆分为 ${firstQty} 和 ${secondQty} 两个气泡吗？`)) {
          return;
        }

        if (!window.tradesDB || typeof window.tradesDB.save !== 'function') {
          alert('交易数据库不可用，无法拆分气泡');
          return;
        }

        const originalTrade = { ...trade };
        const firstTrade = {
          ...trade,
          qty: firstQty,
          amount: Number((Number(trade.price || 0) * firstQty).toFixed(2))
        };
        const secondTrade = {
          ...trade,
          id: `${trade.id}-split-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          qty: secondQty,
          amount: Number((Number(trade.price || 0) * secondQty).toFixed(2))
        };

        splitTradeButton.disabled = true;
        try {
          if (typeof window.tradesDB.saveAll === 'function') {
            await window.tradesDB.saveAll([firstTrade, secondTrade]);
          } else {
            await window.tradesDB.save(firstTrade);
            await window.tradesDB.save(secondTrade);
          }

          if (window.loadTrades) await window.loadTrades();
          if (window.applyFilters) await window.applyFilters();
          if (window.renderBubbleView) window.renderBubbleView();

          if (window.compactModePlugin && window.compactModePlugin.floatingWindow) {
            const compactWin = window.compactModePlugin.floatingWindow;
            const compactWinElement = compactWin.getElement();
            const filterDateInput = document.getElementById('filterDate');
            const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
            if (compactWinElement && compactWinElement.style.display !== 'none' && filterDate) {
              const data = window.compactModePlugin.collectData(filterDate);
              compactWin.setContent(window.compactModePlugin.renderCompactView(data, filterDate));
              window.compactModePlugin.bindEvents();
              window.compactModePlugin.applyBubbleScale();
              window.compactModePlugin.scrollToStock(trade.stock);
            }
          }

          if (tradeDetailWindow) {
            tradeDetailWindow.destroy();
            tradeDetailWindow = null;
          }
          showTemporaryMessage(`气泡已拆分：${firstQty} + ${secondQty} = ${originalQty}`);
        } catch (error) {
          try {
            await window.tradesDB.save(originalTrade);
          } catch (rollbackError) {
            console.error('拆分失败后恢复原交易失败:', rollbackError);
          }
          console.error('拆分气泡失败:', error);
          alert('拆分气泡失败: ' + error.message);
          splitTradeButton.disabled = false;
        }
      });
    }
    
    // 删除按钮
    floatingBody.querySelector('#deleteTradeBtn').addEventListener('click', async () => {
      if (confirm('**确定要删除这笔交易吗？此操作不可恢复！')) {
        try {
          if (window.DebugUtils) {
            DebugUtils.showDebugInfo(`删除交易，ID: ${trade.id}`);
          }
          
          // 检查tradesDB是否存在
          if (!window.tradesDB) {
            throw new Error('tradesDB 未定义');
          }
          
          // 删除交易
          await window.tradesDB.delete(trade.id);
          
          // 保留该股票的配对结果（用户操作不应自动删除配对资料）
          
          // 检查loadTrades和applyFilters是否存在
          if (window.loadTrades) {
            await loadTrades();
            
            // 重新加载配对数据并更新全局配对缓存
            if (window.tradesDB && window.tradesDB.getAllPairings && typeof window.tradesDB.getAllPairings === 'function') {
              const allPairings = await window.tradesDB.getAllPairings();
              // 确保window.pairingCache存在
              if (!window.pairingCache) {
                window.pairingCache = {};
              }
              // 更新全局配对缓存
              allPairings.forEach(pairing => {
                window.pairingCache[pairing.stockName] = {
                  pairedTrades: pairing.pairedTrades || [],
                  pairedBuyIds: pairing.pairedBuyIds || [],
                  pairedSellIds: pairing.pairedSellIds || []
                };
              });
            }
          } else {
            if (window.DebugUtils) {
              DebugUtils.showDebugInfo('loadTrades 未定义');
            }
          }
          
          if (window.applyFilters) {
            await applyFilters();
          } else {
            if (window.DebugUtils) {
              DebugUtils.showDebugInfo('applyFilters 未定义');
            }
          }
          
          // 刷新气泡视图
          if (window.renderBubbleView) {
            renderBubbleView();
          } else {
            if (window.DebugUtils) {
              DebugUtils.showDebugInfo('renderBubbleView 未定义');
            }
          }

          // 刷新股票卡片视图（解决删除后股票卡片未即时刷新的问题）
          if (window.currentView === 'table' && window.currentTableMode === 'stock') {
            if (window.renderStockModeTable) {
              try {
                await renderStockModeTable();
                if (window.DebugUtils) {
                  DebugUtils.showDebugInfo('已刷新股票卡片视图');
                }
              } catch (err) {
                console.error('刷新股票卡片视图失败:', err);
                if (window.DebugUtils) {
                  DebugUtils.showDebugInfo('刷新股票卡片视图失败: ' + err.message);
                }
              }
            } else {
              if (window.DebugUtils) {
                DebugUtils.showDebugInfo('renderStockModeTable 未定义');
              }
            }
          }

          // 刷新紧凑模式视图（解决删除后紧凑模式未即时刷新的问题）
          if (window.compactModePlugin && window.compactModePlugin.floatingWindow) {
            try {
              const compactWin = window.compactModePlugin.floatingWindow;
              const winEl = compactWin.getElement();
              if (winEl && winEl.style.display !== 'none') {
                const filterDateInput = document.getElementById('filterDate');
                const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
                
                if (filterDate) {
                  const data = window.compactModePlugin.collectData(filterDate);
                  const content = window.compactModePlugin.renderCompactView(data, filterDate);
                  compactWin.setContent(content);
                  window.compactModePlugin.bindEvents();
                  window.compactModePlugin.applyBubbleScale();
                  window.compactModePlugin.scrollToStock(trade.stock);

                  if (window.DebugUtils) {
                    DebugUtils.showDebugInfo('已刷新紧凑模式视图');
                  }
                }
              }
            } catch (err) {
              console.error('刷新紧凑模式视图失败:', err);
              if (window.DebugUtils) {
                DebugUtils.showDebugInfo('刷新紧凑模式视图失败: ' + err.message);
              }
            }
          }

          // 跳转到当前股票的位置
          setTimeout(() => {
            if (window.jumpToStock && trade.stock) {
              window.jumpToStock(trade.stock);
            }
            if (window.compactModePlugin && trade.stock) {
              window.compactModePlugin.scrollToStock(trade.stock);
            }
          }, 200);
          
          // 刷新买卖建议插件窗口（只有当调用来源是 advice 时才刷新）
          if (source === 'advice' && window.buySellAdvicePlugin && trade.stock && window.trades && window.pairingCache) {
            try {
              window.buySellAdvicePlugin.showAdvice(trade.stock, window.trades, window.pairingCache);
            } catch (err) {
              console.error('刷新买卖建议插件窗口失败', err);
            }
          }
          
          // 关闭浮动窗口
          if (tradeDetailWindow) {
            tradeDetailWindow.destroy();
            tradeDetailWindow = null;
          }
          
          showTemporaryMessage('交易已删除');
        } catch (error) {
          if (window.DebugUtils) {
            DebugUtils.showDebugInfo(`删除交易失败: ${error.message}`);
          }
          alert('删除交易失败: ' + error.message);
        }
      }
    });
    
    // 加载配对数据
    async function loadPairingData() {
      try {
        // 检查tradesDB是否存在
        if (!window.tradesDB) {
          throw new Error('tradesDB 未定义');
        }
        
        // 获取该股票的配对数据
        const allPairings = await window.tradesDB.getAllPairings();
        const stockPairing = allPairings.find(pairing => pairing.stockName === trade.stock);
        
        const pairingDataContent = floatingBody.querySelector('#pairingDataContent');
        if (pairingDataContent) {
          if (stockPairing) {
            // 查找与当前交易相关的配对数据
            const relevantPairings = [];
            
            // 检查直接的pairedTrades数组（主要结构）
            if (stockPairing.pairedTrades) {
              stockPairing.pairedTrades.forEach(pair => {
                if (pair.buy && pair.buy.id === trade.id || pair.sell && pair.sell.id === trade.id) {
                  relevantPairings.push({ section: 'main', pair });
                }
              });
            }
            
            // 同时检查可能存在的其他结构（兼容旧格式）
            // 检查latest配对
            if (stockPairing.latest && stockPairing.latest.pairedTrades) {
              stockPairing.latest.pairedTrades.forEach(pair => {
                if (pair.buy && pair.buy.id === trade.id || pair.sell && pair.sell.id === trade.id) {
                  relevantPairings.push({ section: 'latest', pair });
                }
              });
            }
            
            // 检查history配对
            if (stockPairing.history && stockPairing.history.pairedTrades) {
              stockPairing.history.pairedTrades.forEach(pair => {
                if (pair.buy && pair.buy.id === trade.id || pair.sell && pair.sell.id === trade.id) {
                  relevantPairings.push({ section: 'history', pair });
                }
              });
            }
            
            // 检查crossBlock配对
            if (stockPairing.crossBlock && stockPairing.crossBlock.pairedTrades) {
              stockPairing.crossBlock.pairedTrades.forEach(pair => {
                if (pair.buy && pair.buy.id === trade.id || pair.sell && pair.sell.id === trade.id) {
                  relevantPairings.push({ section: 'crossBlock', pair });
                }
              });
            }
            
            if (relevantPairings.length > 0) {
              // 格式化相关配对数据显示
              const formattedPairingData = JSON.stringify(relevantPairings, null, 2);
              pairingDataContent.innerHTML = `<pre style="margin: 0;">${formattedPairingData}</pre>`;
            } else {
              pairingDataContent.textContent = '该交易无配对数据';
            }
          } else {
            pairingDataContent.textContent = '该交易无配对数据';
          }
        }
      } catch (error) {
        console.error('加载配对数据失败:', error);
        const pairingDataContent = floatingBody.querySelector('#pairingDataContent');
        if (pairingDataContent) {
          pairingDataContent.textContent = '加载配对数据失败: ' + error.message;
        }
      }
    }
    
    // 调用加载配对数据函数
    loadPairingData();
  }
  
  // 创建编辑模式内容
  // 辅助：把 ISO/时间字符串转换为 datetime-local 输入的值（本地时间，无时区后缀）
  function toLocalDatetimeInputValue(dateString) {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const yyyy = d.getFullYear();
    const MM = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mm = pad(d.getMinutes());
    const ss = pad(d.getSeconds());
    return `${yyyy}-${MM}-${dd}T${hh}:${mm}:${ss}`;
  }

  function createEditMode() {
    const bodyContent = `
      <div style="padding: 8px;">
      <div style="margin-bottom: 20px;">
        <h3 style="margin-bottom: 10px; color: #555; font-size: 12px;">编辑交易信息</h3>
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead style="background: #f8f9fa;">
              <tr>
                <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">字段</th>
                <th style="border: 1px solid #ddd; padding: 5px; text-align: left; font-size: 12px;">值</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">股票名称</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">${trade.stock}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易方向</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <select id="editSide" style="width: 100%; padding: 3px; font-size: 12px;">
                    <option value="buy" ${trade.side === 'buy' ? 'selected' : ''}>买入</option>
                    <option value="sell" ${trade.side === 'sell' ? 'selected' : ''}>卖出</option>
                  </select>
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易数量</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <input type="number" id="editQty" style="width: 100%; padding: 3px; font-size: 12px;" value="${trade.qty}" min="1">
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易单价</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <input type="number" id="editPrice" style="width: 100%; padding: 3px; font-size: 12px;" value="${trade.price}" step="0.01" min="0">
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">输入时间</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <input type="datetime-local" id="editCreatedAt" style="width: 100%; padding: 3px; font-size: 12px;" value="${toLocalDatetimeInputValue(trade.createdAt)}">
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易日期</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <input type="date" id="editDate" style="width: 100%; padding: 3px; font-size: 12px;" value="${trade.date}">
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">交易备注</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <input type="text" id="editRemark" style="width: 100%; padding: 3px; font-size: 12px;" value="${trade.remark || ''}">
                </td>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">是否可屏蔽气泡</td>
                <td style="border: 1px solid #ddd; padding: 5px; font-size: 12px;">
                  <select id="editHideable" style="width: 100%; padding: 3px; font-size: 12px;">
                    <option value="" ${!trade.hideable ? 'selected' : ''}>(空白/不可屏蔽)</option>
                    <option value="Y" ${trade.hideable === 'Y' ? 'selected' : ''}>Y/可屏蔽</option>
                  </select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'space-between';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.marginTop = '20px';
    buttonContainer.style.paddingTop = '15px';
    buttonContainer.style.borderTop = '1px solid #ddd';
    
    // 添加取消按钮
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'modal-action-btn cancel-btn';
    cancelBtn.textContent = '取消';
    cancelBtn.style.padding = '10px 20px';
    cancelBtn.style.background = '#6c757d';
    cancelBtn.style.color = 'white';
    cancelBtn.style.border = 'none';
    cancelBtn.style.borderRadius = '4px';
    cancelBtn.style.cursor = 'pointer';
    cancelBtn.style.fontSize = '12px';
    
    cancelBtn.addEventListener('click', () => {
      createViewMode();
    });
    
    // 添加保存按钮
    const saveBtn = document.createElement('button');
    saveBtn.className = 'modal-action-btn save-btn';
    saveBtn.textContent = '保存';
    saveBtn.style.padding = '10px 20px';
    saveBtn.style.background = '#28a745';
    saveBtn.style.color = 'white';
    saveBtn.style.border = 'none';
    saveBtn.style.borderRadius = '4px';
    saveBtn.style.cursor = 'pointer';
    saveBtn.style.fontSize = '12px';
    
    saveBtn.addEventListener('mouseenter', () => {
      saveBtn.style.background = '#218838';
    });
    
    saveBtn.addEventListener('mouseleave', () => {
      saveBtn.style.background = '#28a745';
    });
    
    saveBtn.addEventListener('click', async () => {
      try {
        if (window.DebugUtils) {
          DebugUtils.showDebugInfo('保存修改后的交易');
        }
        
        // 获取编辑后的值
        const editedSide = document.getElementById('editSide').value;
        const editedQty = parseInt(document.getElementById('editQty').value);
        const editedPrice = parseFloat(document.getElementById('editPrice').value);
        const editedDate = document.getElementById('editDate').value;
        const editedCreatedAtInput = document.getElementById('editCreatedAt') ? document.getElementById('editCreatedAt').value : '';
        const editedRemark = document.getElementById('editRemark').value;
        const editedHideable = document.getElementById('editHideable').value;
        
        if (window.DebugUtils) {
          DebugUtils.showDebugInfo(`编辑后的值: ${JSON.stringify({ editedSide, editedQty, editedPrice, editedDate, editedCreatedAtInput, editedRemark })}`);
        }
        
        // 验证必填项
        if (!editedSide || isNaN(editedQty) || isNaN(editedPrice) || !editedDate) {
          alert('请填写所有必填字段');
          return;
        }
        
        // 获取股票信息，用于计算金额和税费
        const editedStockData = STOCKS ? STOCKS.find(s => s.name === trade.stock) : null;
        const editedMarket = editedStockData ? editedStockData.market : (stockData ? stockData.market : '台股');
        
        // 计算交易金额
        const editedAmount = (editedPrice * editedQty).toFixed(2);
        
        // 更新交易对象
        const updatedTrade = {
          ...trade,
          side: editedSide,
          qty: editedQty,
          price: editedPrice,
          amount: parseFloat(editedAmount),
          date: editedDate,
          market: editedMarket,
          remark: editedRemark || '',
          hideable: editedHideable || ''
        };
        // 如果用户填写了输入时间，将其转换为 ISO 并保存到 createdAt
        if (editedCreatedAtInput) {
          const parsed = new Date(editedCreatedAtInput);
          if (!isNaN(parsed.getTime())) {
            updatedTrade.createdAt = parsed.toLocaleString('zh-CN', { hour12: false });
          }
        }
        
        if (window.DebugUtils) {
          DebugUtils.showDebugInfo(`更新后的交易对象: ${JSON.stringify(updatedTrade)}`);
        }
        
        // 检查tradesDB是否存在
        if (!window.tradesDB) {
          throw new Error('tradesDB 未定义');
        }
        
        // 保存修改后的交易
        await window.tradesDB.save(updatedTrade);
        
        // 保留该股票的配对结果（用户操作不应自动删除配对资料）
        
        // 检查loadTrades和applyFilters是否存在
        if (window.loadTrades) {
          await loadTrades();
          
          // 重新加载配对数据并更新全局配对缓存
          if (window.tradesDB && window.tradesDB.getAllPairings && typeof window.tradesDB.getAllPairings === 'function') {
            const allPairings = await window.tradesDB.getAllPairings();
            // 确保window.pairingCache存在
            if (!window.pairingCache) {
              window.pairingCache = {};
            }
            // 更新全局配对缓存
            allPairings.forEach(pairing => {
              window.pairingCache[pairing.stockName] = {
                pairedTrades: pairing.pairedTrades || [],
                pairedBuyIds: pairing.pairedBuyIds || [],
                pairedSellIds: pairing.pairedSellIds || []
              };
            });
          }
        } else {
          if (window.DebugUtils) {
            DebugUtils.showDebugInfo('loadTrades 未定义');
          }
        }
        
        if (window.applyFilters) {
          await applyFilters();
        } else {
          if (window.DebugUtils) {
            DebugUtils.showDebugInfo('applyFilters 未定义');
          }
        }
        
        // 刷新气泡视图
        if (window.renderBubbleView) {
          renderBubbleView();
        } else {
          if (window.DebugUtils) {
            DebugUtils.showDebugInfo('renderBubbleView 未定义');
          }
        }
        
        // 刷新股票卡片视图（解决修改后股票卡片未即时刷新的问题）
        if (window.currentView === 'table' && window.currentTableMode === 'stock') {
          if (window.renderStockModeTable) {
            try {
              await renderStockModeTable();
              if (window.DebugUtils) {
                DebugUtils.showDebugInfo('已刷新股票卡片视图');
              }
            } catch (err) {
              console.error('刷新股票卡片视图失败:', err);
              if (window.DebugUtils) {
                DebugUtils.showDebugInfo('刷新股票卡片视图失败: ' + err.message);
              }
            }
          } else {
            if (window.DebugUtils) {
              DebugUtils.showDebugInfo('renderStockModeTable 未定义');
            }
          }
        }

        // 刷新紧凑模式视图（解决修改后紧凑模式未即时刷新的问题）
        if (window.compactModePlugin && window.compactModePlugin.floatingWindow) {
          try {
            const compactWin = window.compactModePlugin.floatingWindow;
            const winEl = compactWin.getElement();
            if (winEl && winEl.style.display !== 'none') {
              const filterDateInput = document.getElementById('filterDate');
              const filterDate = filterDateInput ? filterDateInput.value.trim() : '';

              if (filterDate) {
                const data = window.compactModePlugin.collectData(filterDate);
                const content = window.compactModePlugin.renderCompactView(data, filterDate);
                compactWin.setContent(content);
                window.compactModePlugin.bindEvents();
                window.compactModePlugin.applyBubbleScale();
                window.compactModePlugin.scrollToStock(trade.stock);

                if (window.DebugUtils) {
                  DebugUtils.showDebugInfo('已刷新紧凑模式视图');
                }
              }
            }
          } catch (err) {
            console.error('刷新紧凑模式视图失败:', err);
            if (window.DebugUtils) {
              DebugUtils.showDebugInfo('刷新紧凑模式视图失败: ' + err.message);
            }
          }
        }

        // 跳转到当前股票的位置
        setTimeout(() => {
          if (window.jumpToStock && trade.stock) {
            window.jumpToStock(trade.stock);
          }
        }, 200);
        
        // 刷新买卖建议插件窗口（只有当调用来源是 advice 时才刷新）
        if (source === 'advice' && window.buySellAdvicePlugin && trade.stock && window.trades && window.pairingCache) {
          try {
            window.buySellAdvicePlugin.showAdvice(trade.stock, window.trades, window.pairingCache);
          } catch (err) {
            console.error('刷新买卖建议插件窗口失败', err);
          }
        }
        
        // 关闭浮动窗口
        if (tradeDetailWindow) {
          tradeDetailWindow.destroy();
          tradeDetailWindow = null;
        }
        
        // 显示修改成功提示
        showTemporaryMessage('交易已修改');
      } catch (error) {
        if (window.DebugUtils) {
          DebugUtils.showDebugInfo(`修改交易失败: ${error.message}`);
        }
        alert('修改交易失败: ' + error.message);
      }
    });
    
    buttonContainer.appendChild(cancelBtn);
    buttonContainer.appendChild(saveBtn);
    
    // 创建内容容器
    const contentContainer = document.createElement('div');
    contentContainer.style.padding = '8px';
    contentContainer.innerHTML = bodyContent;
    contentContainer.appendChild(buttonContainer);
    
    // 设置浮动窗口内容
    tradeDetailWindow.setContent(contentContainer);
    // 确保窗口显示
    tradeDetailWindow.show();
  }
  
  // 初始显示为查看模式
  createViewMode();
  
  // 显示浮动窗口
  console.log('准备显示浮动窗口');
  console.log('浮动窗口对象:', tradeDetailWindow);
  console.log('浮动窗口元素:', tradeDetailWindow.getElement());
  console.log('浮动窗口选项:', tradeDetailWindow.options);
  
  if (window.DebugUtils) {
    DebugUtils.showDebugInfo('准备显示浮动窗口');
    DebugUtils.showDebugInfo('浮动窗口元素: ' + (tradeDetailWindow.getElement() ? '存在' : '不存在'));
    DebugUtils.showDebugInfo('浮动窗口可拖拽: ' + tradeDetailWindow.options.draggable);
  }
  
  // 显示窗口
  console.log('调用tradeDetailWindow.show()');
  tradeDetailWindow.show();
  console.log('浮动窗口已显示');
  
  if (window.DebugUtils) {
    DebugUtils.showDebugInfo('浮动窗口已调用show()方法');
    DebugUtils.showDebugInfo('浮动窗口现在应该可以拖拽了');
  }
}

// 在全局保存原始实现，避免被其他脚本覆盖或引起命名冲突
try {
  if (typeof window !== 'undefined' && typeof showTradeDetail === 'function') {
    if (!window._bubble_showTradeDetail) {
      window._bubble_showTradeDetail = showTradeDetail;
    }
  }
} catch (e) {
  if (window && window.DebugUtils) {
    DebugUtils.showDebugInfo('导出 _bubble_showTradeDetail 失败: ' + e.message);
  }
}

// 格式化日期时间
function formatDateTime(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch (error) {
    return '';
  }
}

// 显示所有未配对买卖气泡的函数
function showUnpairedTradesBubbles(trades, stockName, side, sortOrder) {
  if (!trades || trades.length === 0) {
    alert('没有未配对的交易数据');
    return;
  }
  
  // 按价格排序
  const sortedTrades = [...trades].sort((a, b) => {
    const priceA = parseFloat(a.price);
    const priceB = parseFloat(b.price);
    return sortOrder === 'desc' ? priceB - priceA : priceA - priceB;
  });
  
  const sideText = side === 'buy' ? '买入' : '卖出';
  const sortOrderText = sortOrder === 'desc' ? '由高到低' : '由低到高';
  const windowTitle = `${stockName} - 未配对${sideText}气泡(${sortOrderText})`;
  
  // 销毁现有的浮动窗口
  if (tradeDetailWindow && tradeDetailWindow.element) {
    if (tradeDetailWindow.element.parentNode) {
      tradeDetailWindow.element.parentNode.removeChild(tradeDetailWindow.element);
    }
    tradeDetailWindow = null;
  }
  
  // 根据屏幕尺寸动态设置窗口大小
  const isMobile = window.innerWidth < 768;
  const windowWidth = isMobile ? '90vw' : '800px';
  const windowHeight = isMobile ? '80vh' : '600px';
  
  // 创建新的浮动窗口
  tradeDetailWindow = new FloatingWindow({
    title: windowTitle,
    sourceFile: 'bubbleDetail.js',
    width: windowWidth,
    height: windowHeight,
    x: '100px',
    y: '100px',
    draggable: false,
    id: `unpaired-trades-window-${stockName}-${side}`
  });
  
  // 创建气泡内容
  const bodyContent = document.createElement('div');
  bodyContent.style.cssText = `
    padding: 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-content: flex-start;
    overflow-y: auto;
    height: 100%;
  `;
  
  // 为每个交易创建气泡
  sortedTrades.forEach(trade => {
    const isBuy = trade.side === 'buy';
    const bubble = document.createElement('div');
    bubble.className = 'price-bubble';
    bubble.style.cssText = `
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 4px 8px;
      border: 2px solid ${isBuy ? '#93c5fd' : '#fca5a5'};
      border-radius: 12px;
      background: ${isBuy ? '#bfdbfe' : '#fecaca'};
      font-size: 12px;
      font-weight: 900;
      color: ${isBuy ? '#ef4444' : '#3b82f6'};
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
      margin: 0;
      position: relative;
    `;
    
    // 价格标签
    const priceLabel = document.createElement('div');
    priceLabel.style.cssText = `
      font-size: 12px;
    `;
    priceLabel.textContent = `${isBuy ? '' : '-'}${trade.price}`;
    bubble.appendChild(priceLabel);
    
    // 日期标签（显示在气泡上缘的框线上）
    if (trade.date) {
      const dateLabel = document.createElement('div');
      dateLabel.style.cssText = `
        position: absolute;
        top: -6px;
        left: 50%;
        transform: translateX(-50%);
        background-color: transparent;
        padding: 0 4px;
        font-size: 8px;
        color: #000000;
        font-weight: bold;
        white-space: nowrap;
      `;
      // 年份只显示2位，如2026-03-05显示为26-03-05
      const shortDate = trade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4');
      dateLabel.textContent = shortDate;
      bubble.appendChild(dateLabel);
    }
    
    // 添加双击事件显示交易详情
    bubble.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      if (window.showTradeDetail) {
        window.showTradeDetail(trade, 'main');
      }
    });
    
    bodyContent.appendChild(bubble);
  });
  
  // 设置浮动窗口内容
  tradeDetailWindow.setContent(bodyContent);
  tradeDetailWindow.show();
}

// 将showTradeDetail函数暴露给全局作用域，以便其他文件调用
window.showTradeDetail = showTradeDetail;
window.showUnpairedTradesBubbles = showUnpairedTradesBubbles;

// 初始化函数，确保所有依赖都已加载
function initBubbleDetail() {
  console.log('初始化 bubbleDetail.js');
  console.log('检查依赖项:');
  console.log(`- FloatingWindow 存在: ${typeof FloatingWindow !== 'undefined'}`);
  console.log(`- STOCKS 存在: ${typeof STOCKS !== 'undefined'}`);
  console.log(`- tradesDB 存在: ${typeof tradesDB !== 'undefined'}`);
  console.log(`- loadTrades 存在: ${typeof loadTrades !== 'undefined'}`);
  console.log(`- applyFilters 存在: ${typeof applyFilters !== 'undefined'}`);
  console.log(`- showTradeDetail 已暴露: ${typeof window.showTradeDetail !== 'undefined'}`);
  
  if (window.DebugUtils) {
    DebugUtils.showDebugInfo('初始化 bubbleDetail.js');
    DebugUtils.showDebugInfo('检查依赖项:');
    DebugUtils.showDebugInfo(`- FloatingWindow 存在: ${typeof FloatingWindow !== 'undefined'}`);
    DebugUtils.showDebugInfo(`- STOCKS 存在: ${typeof STOCKS !== 'undefined'}`);
    DebugUtils.showDebugInfo(`- tradesDB 存在: ${typeof tradesDB !== 'undefined'}`);
    DebugUtils.showDebugInfo(`- loadTrades 存在: ${typeof loadTrades !== 'undefined'}`);
    DebugUtils.showDebugInfo(`- applyFilters 存在: ${typeof applyFilters !== 'undefined'}`);
    DebugUtils.showDebugInfo(`- showTradeDetail 已暴露: ${typeof window.showTradeDetail !== 'undefined'}`);
  }
}

// 当DOM加载完成后初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBubbleDetail);
} else {
  initBubbleDetail();
}