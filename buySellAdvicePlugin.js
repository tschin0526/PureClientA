/**
 * 买卖建议插件
 * 显示股票的买卖建议，使用悬浮视窗作为显示载体
 */

class BuySellAdvicePlugin {
  constructor() {
    this.name = 'BuySellAdvicePlugin';
    this.floatingWindow = null;
    this.currentStock = null;
    this.initialized = false;
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;
    
    console.log('买卖建议插件初始化中...');
    
    // 检查 FloatingWindow 是否可用
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化买卖建议插件');
      return;
    }
    
    // 创建悬浮视窗
    this.floatingWindow = new FloatingWindow({
      title: '买卖建议',
      sourceFile: 'buySellAdvicePlugin.js',
      width: '1100px',
      height: '700px',
      draggable: false,
      id: 'buy-sell-advice-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });
    
    this.initialized = true;
    console.log('买卖建议插件初始化完成');
  }

  /**
   * 显示买卖建议
   * @param {string} stockName - 股票名称
   * @param {Array} trades - 交易数据
   * @param {Object} pairingCache - 配对缓存
   */
  showAdvice(stockName, trades, pairingCache) {
    if (!this.initialized) {
      this.init();
    }
    
    this.currentStock = stockName;
    
    // 获取该股票的所有交易数据
    const stockTrades = trades.filter(t => t.stock === stockName);
    if (!stockTrades || stockTrades.length === 0) {
      alert('该股票暂无交易数据');
      return;
    }
    
    // 计算日期范围
    const today = new Date().toISOString().slice(0, 10);
    const dates = [...new Set(stockTrades.map(t => t.date))].sort().reverse();
    const recentDates = [];
    
    if (dates.includes(today)) {
      // 当天有数据，取今天和最近四天
      const todayIndex = dates.indexOf(today);
      recentDates.push(today);
      if (dates[todayIndex + 1]) recentDates.push(dates[todayIndex + 1]);
      if (dates[todayIndex + 2]) recentDates.push(dates[todayIndex + 2]);
      if (dates[todayIndex + 3]) recentDates.push(dates[todayIndex + 3]);
      if (dates[todayIndex + 4]) recentDates.push(dates[todayIndex + 4]);
    } else {
      // 当天无数据，取最近五天
      if (dates[0]) recentDates.push(dates[0]);
      if (dates[1]) recentDates.push(dates[1]);
      if (dates[2]) recentDates.push(dates[2]);
      if (dates[3]) recentDates.push(dates[3]);
      if (dates[4]) recentDates.push(dates[4]);
    }
    
    // 1. 整理显示气泡的集合
    const displaySet = new Set();
    
    // 2. 添加符合条件的配对资料和未配对资料
    // 获取该股票的配对资料
    const stockPairing = pairingCache[stockName] || { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
    const pairedTradesMap = new Map();
    
    // 处理配对资料
    if (stockPairing.pairedTrades) {
      stockPairing.pairedTrades.forEach(pair => {
        const hasMatchingDate = (pair.buy && recentDates.includes(pair.buy.date)) || 
                              (pair.sell && recentDates.includes(pair.sell.date));
        if (hasMatchingDate) {
          // 添加配对资料到显示集合
          if (pair.buy) displaySet.add(pair.buy);
          if (pair.sell) displaySet.add(pair.sell);
          // 记录配对关系
          if (pair.buy && pair.sell) {
            pairedTradesMap.set(pair.buy.id, pair);
            pairedTradesMap.set(pair.sell.id, pair);
          }
        }
      });
    }

    // 确保当天和最近五个交易日的所有未配对交易也被加入显示集合
    // 这样当天和最近五个交易日的未配对气泡会如实显示
    stockTrades.forEach(t => {
      if ((t.date === today || recentDates.includes(t.date)) && !displaySet.has(t)) {
        displaySet.add(t);
      }
    });
    
    // 3. 收集所有已配对的交易ID
    const pairedTradeIds = new Set();
    if (stockPairing.pairedTrades) {
      stockPairing.pairedTrades.forEach(pair => {
        if (pair.buy && pair.buy.id) pairedTradeIds.add(pair.buy.id);
        if (pair.sell && pair.sell.id) pairedTradeIds.add(pair.sell.id);
      });
    }
    
    // 4. 添加未配对交易中的卖出最高五个单价
    const unpairedSells = stockTrades.filter(t => t.side === 'sell' && !pairedTradeIds.has(t.id));
    const top5SellPrices = [...unpairedSells]
      .sort((a, b) => b.price - a.price)
      .slice(0, 5);
    top5SellPrices.forEach(trade => displaySet.add(trade));
    
    // 5. 添加未配对交易中的买入最低五个单价
    const unpairedBuys = stockTrades.filter(t => t.side === 'buy' && !pairedTradeIds.has(t.id));
    const bottom5BuyPrices = [...unpairedBuys]
      .sort((a, b) => a.price - b.price)
      .slice(0, 5);
    bottom5BuyPrices.forEach(trade => displaySet.add(trade));
    
    // 5. 生成显示内容
    const content = this.generateContent([...displaySet], pairedTradesMap, recentDates, stockName, stockPairing, stockTrades);
    
    // 更新悬浮视窗
    this.floatingWindow.setTitle(`${stockName} - 买卖建议`);
    this.floatingWindow.setContent(content);
    this.floatingWindow.show();

    // 为视窗内的气泡添加双击事件，调用主程式的 showTradeDetail
    try {
      const winEl = this.floatingWindow.getElement();
      if (winEl) {
        const body = winEl.querySelector('.floating-body');
        const bubbles = body ? body.querySelectorAll('.price-bubble') : [];
        bubbles.forEach(b => {
          b.addEventListener('dblclick', (e) => {
            const ds = b.dataset || {};
            const trade = {
              id: ds.tradeId || ds.tradeid || '',
              price: (typeof ds.price !== 'undefined' && ds.price !== '') ? Number(ds.price) : undefined,
              qty: (typeof ds.qty !== 'undefined' && ds.qty !== '') ? Number(ds.qty) : undefined,
              amount: (typeof ds.amount !== 'undefined' && ds.amount !== '') ? Number(ds.amount) : undefined,
              side: ds.side || '',
              stock: ds.stock || stockName,
              date: ds.date || '',
              createdAt: ds.createdat || ds.createdAt || ds.created_at || '',
              hideable: (typeof ds.hideable !== 'undefined') ? ds.hideable : undefined,
              remark: ds.remark || ''
            };

            if (window.DebugUtils) DebugUtils.showDebugInfo(`插件气泡双击，trade=${JSON.stringify(trade)}`);

            if (window.showTradeDetail && typeof window.showTradeDetail === 'function') {
              try { window.showTradeDetail(trade, 'advice'); } catch (err) { console.error('调用 window.showTradeDetail 失败', err); }
            } else if (window._bubble_showTradeDetail && typeof window._bubble_showTradeDetail === 'function') {
              try { window._bubble_showTradeDetail(trade, 'advice'); } catch (err) { console.error('调用 _bubble_showTradeDetail 失败', err); }
            } else {
              console.warn('未找到 showTradeDetail 函数，无法显示交易详情');
            }
          });
        });
          // 为配对容器绑定双击事件，优先调用 showPairDetailWithFloatingWindow(pairObj, stockName)
          const pairs = body ? body.querySelectorAll('.trade-pair') : [];
          pairs.forEach(p => {
            p.addEventListener('dblclick', (ev) => {
              // 阻止事件冒泡，避免触发买入或卖出气泡的双击事件
              ev.stopPropagation();
              
              // 重建 pair 对象
              const ds = p.dataset || {};
              const pairObj = {
                buy: {
                  id: ds.buyId || ds.buyid || '',
                  price: (typeof ds.buyPrice !== 'undefined' && ds.buyPrice !== '') ? Number(ds.buyPrice) : undefined,
                  qty: (typeof ds.buyQty !== 'undefined' && ds.buyQty !== '') ? Number(ds.buyQty) : undefined,
                  side: 'buy',
                  stock: ds.buyStock || ds.buystock || stockName,
                  date: ds.buyDate || ds.buydate || '',
                  remark: ds.buyRemark || ds.buyremark || ''
                },
                sell: {
                  id: ds.sellId || ds.sellid || '',
                  price: (typeof ds.sellPrice !== 'undefined' && ds.sellPrice !== '') ? Number(ds.sellPrice) : undefined,
                  qty: (typeof ds.sellQty !== 'undefined' && ds.sellQty !== '') ? Number(ds.sellQty) : undefined,
                  side: 'sell',
                  stock: ds.sellStock || ds.sellstock || stockName,
                  date: ds.sellDate || ds.selldate || '',
                  remark: ds.sellRemark || ds.sellremark || ''
                }
              };

              if (window.DebugUtils) DebugUtils.showDebugInfo(`插件配对气泡双击，pair=${JSON.stringify(pairObj)}`);

              if (window.showPairDetailWithFloatingWindow && typeof window.showPairDetailWithFloatingWindow === 'function') {
                try { window.showPairDetailWithFloatingWindow(pairObj, stockName); } catch (err) { console.error('调用 window.showPairDetailWithFloatingWindow 失败', err); }
              } else if (window.showPairDetail && typeof window.showPairDetail === 'function') {
                try { window.showPairDetail(pairObj, stockName); } catch (err) { console.error('调用 window.showPairDetail 失败', err); }
              } else {
                // 回退：先尝试分别打开买/卖详情
                if (window.showTradeDetail && typeof window.showTradeDetail === 'function') {
                  try { window.showTradeDetail(pairObj.buy, 'advice'); } catch (err) { console.error('调用 window.showTradeDetail(buy) 失败', err); }
                  try { window.showTradeDetail(pairObj.sell, 'advice'); } catch (err) { console.error('调用 window.showTradeDetail(sell) 失败', err); }
                } else if (window._bubble_showTradeDetail && typeof window._bubble_showTradeDetail === 'function') {
                  try { window._bubble_showTradeDetail(pairObj.buy, 'advice'); } catch (err) { console.error('调用 _bubble_showTradeDetail(buy) 失败', err); }
                  try { window._bubble_showTradeDetail(pairObj.sell, 'advice'); } catch (err) { console.error('调用 _bubble_showTradeDetail(sell) 失败', err); }
                } else {
                  console.warn('未找到 showPairDetailWithFloatingWindow、showPairDetail 或 showTradeDetail，无法显示配对详情');
                }
              }
            });
          });
          
          // 保存插件实例的引用
          const pluginInstance = this;
          
          // 为新增交易按钮绑定点击事件
          const addTradeBtns = body ? body.querySelectorAll('.add-trade-btn') : [];
          addTradeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const stockName = btn.getAttribute('data-stock');
              if (stockName && window.openAddTradeModal && typeof window.openAddTradeModal === 'function') {
                try { 
                  // 添加回调函数，在交易保存成功后刷新买卖建议窗口
                  window.openAddTradeModal(stockName, (newTrade) => {
                    console.log('交易保存成功，开始自动刷新数据', newTrade);
                    
                    // 显示加载提示
                    alert('正在刷新数据，请稍候...');
                    
                    // 确保数据库已打开
                    if (window.tradesDB && typeof window.tradesDB.open === 'function') {
                      window.tradesDB.open().then(() => {
                        console.log('数据库已打开');
                        
                        // 从数据库重新加载交易数据
                        if (window.loadTrades && typeof window.loadTrades === 'function') {
                          window.loadTrades().then(() => {
                            console.log('交易数据加载完成，window.trades长度:', window.trades ? window.trades.length : 0);
                            
                            // 从数据库重新加载配对数据
                            if (window.tradesDB && window.tradesDB.getAllPairings && typeof window.tradesDB.getAllPairings === 'function') {
                              window.tradesDB.getAllPairings().then(allPairings => {
                                console.log('配对数据加载完成，数量:', allPairings.length);
                                // 确保window.pairingCache存在
                                if (!window.pairingCache) {
                                  window.pairingCache = {};
                                  console.log('创建了新的window.pairingCache');
                                }
                                // 更新全局配对缓存
                                allPairings.forEach(pairing => {
                                  window.pairingCache[pairing.stockName] = {
                                    pairedTrades: pairing.pairedTrades || [],
                                    pairedBuyIds: pairing.pairedBuyIds || [],
                                    pairedSellIds: pairing.pairedSellIds || []
                                  };
                                });
                                console.log('配对缓存更新完成，window.pairingCache:', window.pairingCache);
                                
                                // 应用筛选
                                if (window.applyFilters && typeof window.applyFilters === 'function') {
                                  window.applyFilters().then(() => {
                                    console.log('筛选应用完成');
                                    
                                    // 刷新买卖建议窗口
                                    console.log('检查条件：');
                                    console.log('window.trades:', window.trades);
                                    console.log('window.pairingCache:', window.pairingCache);
                                    console.log('pluginInstance:', pluginInstance);
                                    console.log('stockName:', stockName);
                                    
                                    if (window.trades && window.pairingCache && pluginInstance && stockName) {
                                      // 直接调用showAdvice方法，确保使用最新的数据
                                      console.log('所有条件满足，开始刷新窗口');
                                      pluginInstance.showAdvice(stockName, window.trades, window.pairingCache);
                                      
                                      // 显示刷新成功的提示
                                      alert('交易新增成功，数据已自动刷新！');
                                    } else {
                                      console.error('刷新失败：缺少必要的数据或插件实例');
                                      alert('交易新增成功，但刷新数据失败，请手动点击刷新按钮！');
                                    }
                                  });
                                } else {
                                  // 刷新买卖建议窗口
                                  if (window.trades && window.pairingCache && pluginInstance && stockName) {
                                    pluginInstance.showAdvice(stockName, window.trades, window.pairingCache);
                                    alert('交易新增成功，数据已自动刷新！');
                                  } else {
                                    console.error('刷新失败：缺少必要的数据或插件实例');
                                    alert('交易新增成功，但刷新数据失败，请手动点击刷新按钮！');
                                  }
                                }
                              });
                            } else {
                              console.error('window.tradesDB.getAllPairings 不存在或不是函数');
                              alert('交易新增成功，但刷新数据失败，请手动点击刷新按钮！');
                            }
                          });
                        } else {
                          console.error('window.loadTrades 不存在或不是函数');
                          alert('交易新增成功，但刷新数据失败，请手动点击刷新按钮！');
                        }
                      });
                    } else {
                      console.error('window.tradesDB 不存在或不是函数');
                      alert('交易新增成功，但刷新数据失败，请手动点击刷新按钮！');
                    }
                  }); 
                } catch (err) { console.error('调用 window.openAddTradeModal 失败', err); }
              }
            });
          });

          // 为批次修改按钮绑定点击事件
          const batchHideBtns = body ? body.querySelectorAll('.batch-hide-btn') : [];
          batchHideBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const stockName = btn.getAttribute('data-stock');
              if (stockName && window.openBatchHideBubbleWindow && typeof window.openBatchHideBubbleWindow === 'function') {
                try {
                  window.openBatchHideBubbleWindow(stockName);
                } catch (err) {
                  console.error('调用 window.openBatchHideBubbleWindow 失败', err);
                }
              }
            });
          });
          
          // 为刷新按钮绑定点击事件
          const refreshBtns = body ? body.querySelectorAll('.refresh-btn') : [];
          refreshBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
              e.stopPropagation();
              // 使用更现代的dataset方式获取股票名称
              const stockName = btn.dataset.stock || btn.getAttribute('data-stock');
              
              console.log('刷新按钮点击，stockName:', stockName);
              
              // 显示加载提示
              alert('正在刷新数据，请稍候...');
              
              try {
                // 1. 确保数据库已打开
                if (window.tradesDB && typeof window.tradesDB.open === 'function') {
                  await window.tradesDB.open();
                  console.log('数据库已打开');
                }
                
                // 2. 从数据库重新加载交易数据
                if (window.loadTrades && typeof window.loadTrades === 'function') {
                  console.log('开始加载交易数据');
                  await window.loadTrades();
                  console.log('交易数据加载完成，window.trades:', window.trades);
                } else {
                  console.error('window.loadTrades 不存在或不是函数');
                }
                
                // 3. 从数据库重新加载配对数据
                if (window.tradesDB && window.tradesDB.getAllPairings && typeof window.tradesDB.getAllPairings === 'function') {
                  console.log('开始加载配对数据');
                  const allPairings = await window.tradesDB.getAllPairings();
                  console.log('配对数据加载完成，数量:', allPairings.length);
                  // 确保window.pairingCache存在
                  if (!window.pairingCache) {
                    window.pairingCache = {};
                    console.log('创建了新的window.pairingCache');
                  }
                  // 更新全局配对缓存
                  allPairings.forEach(pairing => {
                    window.pairingCache[pairing.stockName] = {
                      pairedTrades: pairing.pairedTrades || [],
                      pairedBuyIds: pairing.pairedBuyIds || [],
                      pairedSellIds: pairing.pairedSellIds || []
                    };
                  });
                  console.log('配对缓存更新完成，window.pairingCache:', window.pairingCache);
                } else {
                  console.error('window.tradesDB.getAllPairings 不存在或不是函数');
                }
                
                // 4. 应用筛选
                if (window.applyFilters && typeof window.applyFilters === 'function') {
                  console.log('开始应用筛选');
                  await window.applyFilters();
                  console.log('筛选应用完成');
                }
                
                // 5. 调试信息：检查交易数据
                if (window.trades) {
                  const stockTrades = window.trades.filter(t => t.stock === stockName);
                  const today = new Date().toISOString().slice(0, 10);
                  const todayTrades = stockTrades.filter(t => t.date === today);
                  
                  console.log(`刷新后 - 股票: ${stockName}`);
                  console.log(`总交易数: ${stockTrades.length}`);
                  console.log(`今日交易数: ${todayTrades.length}`);
                  console.log(`今日交易详情:`, todayTrades);
                  console.log(`插件实例:`, pluginInstance);
                }
                
                // 6. 刷新买卖建议窗口
                console.log('检查条件：');
                console.log('window.trades:', window.trades);
                console.log('window.pairingCache:', window.pairingCache);
                console.log('pluginInstance:', pluginInstance);
                console.log('stockName:', stockName);
                
                if (window.trades && window.pairingCache && pluginInstance && stockName) {
                  // 直接调用showAdvice方法，确保使用最新的数据
                  console.log('所有条件满足，开始刷新窗口');
                  pluginInstance.showAdvice(stockName, window.trades, window.pairingCache);
                  
                  // 显示刷新成功的提示
                  alert('数据刷新成功！');
                } else {
                  console.error('刷新失败：缺少必要的数据或插件实例');
                  console.error('window.trades:', window.trades);
                  console.error('window.pairingCache:', window.pairingCache);
                  console.error('pluginInstance:', pluginInstance);
                  console.error('stockName:', stockName);
                  alert('刷新失败：缺少必要的数据');
                }
              } catch (error) {
                console.error('刷新数据失败:', error);
                alert('刷新数据失败，请重试！');
              }
            });
          });
          
          // 为网格交易按钮绑定点击事件
          const gridTradingBtns = body ? body.querySelectorAll('.grid-trading-btn') : [];
          gridTradingBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const stockName = btn.getAttribute('data-stock');
              
              if (!stockName) return;
              
              // 获取该股票的全部交易数据（从 TradesDB 数据库）
              const stockTrades = window.trades ? window.trades.filter(t => t.stock === stockName) : [];
              
              // 获取配对缓存
              const stockPairing = window.pairingCache ? window.pairingCache[stockName] : { pairedTrades: [], pairedBuyIds: [], pairedSellIds: [] };
              
              // 使用 pairedBuyIds 和 pairedSellIds 来确定已配对的交易
              const pairedBuyIds = new Set(stockPairing.pairedBuyIds || []);
              const pairedSellIds = new Set(stockPairing.pairedSellIds || []);
              
              // 全部买入和卖出数据
              const allBuys = stockTrades.filter(t => t.side === 'buy');
              const allSells = stockTrades.filter(t => t.side === 'sell');
              
              // 未配对的买入和卖出数据（排除已配对的ID）
              const unpairedBuys = allBuys.filter(t => !pairedBuyIds.has(t.id));
              const unpairedSells = allSells.filter(t => !pairedSellIds.has(t.id));
              
              // 获取最新交易价格作为当前价格
              let currentPrice = 0;
              if (stockTrades.length > 0) {
                const sortedTrades = [...stockTrades].sort((a, b) => {
                  const dateA = new Date(a.createdAt || a.createdat || a.created_at || a.date).getTime();
                  const dateB = new Date(b.createdAt || b.createdat || b.created_at || b.date).getTime();
                  return dateB - dateA;
                });
                currentPrice = Math.abs(sortedTrades[0].price);
              }
              
              // 获取阈值
              const savedThresholdStr = localStorage.getItem(`tradeThresholdPercent_${stockName}`);
              const thresholdPercent = savedThresholdStr !== null ? parseFloat(savedThresholdStr) : 1.5;
              
              // 计算配对净利润
              let pairedProfit = 0;
              const pairedTrades = stockPairing.pairedTrades || [];
              pairedTrades.forEach(pair => {
                if (pair.buy && pair.sell) {
                  const buyAmount = pair.buy.price * pair.buy.qty;
                  const sellAmount = pair.sell.price * pair.sell.qty;
                  const buyTax = window.calculateTax ? window.calculateTax(stockName, 'buy', buyAmount) : 0;
                  const sellTax = window.calculateTax ? window.calculateTax(stockName, 'sell', sellAmount) : 0;
                  const profit = sellAmount - buyAmount - buyTax - sellTax;
                  pairedProfit += profit;
                }
              });
              
              // 调用网格交易插件
              if (window.gridTradingPlugin) {
                window.gridTradingPlugin.show(stockName, unpairedBuys, unpairedSells, allBuys, allSells, currentPrice, thresholdPercent, pairedProfit);
              } else {
                console.error('gridTradingPlugin 插件未加载');
              }
            });
          });

          // 为排序选择器绑定change事件
          const sortSelects = body ? body.querySelectorAll('.sort-select') : [];
          sortSelects.forEach(select => {
            select.addEventListener('change', (e) => {
              e.stopPropagation();
              const category = select.getAttribute('data-category');
              const sortValue = select.value;
              const stockName = select.getAttribute('data-stock');
              
              // 保存排序设置到localStorage
              if (category === 'unpaired-sell') {
                localStorage.setItem(`unpairedSellSort_${stockName}`, sortValue);
              } else if (category === 'unpaired-buy') {
                localStorage.setItem(`unpairedBuySort_${stockName}`, sortValue);
              }
              
              // 找到对应的气泡容器
              const row = select.closest('tr');
              const bubbleContainer = row ? row.querySelector('.bubble-container') : null;
              if (!bubbleContainer) return;
              
              // 获取所有气泡元素
              const bubbles = Array.from(bubbleContainer.querySelectorAll('.price-bubble'));
              
              // 根据排序方式重新排序
              bubbles.sort((a, b) => {
                const priceA = parseFloat(a.dataset.price) || 0;
                const priceB = parseFloat(b.dataset.price) || 0;
                const createdAtA = a.dataset.createdat ? new Date(a.dataset.createdat).getTime() : 0;
                const createdAtB = b.dataset.createdat ? new Date(b.dataset.createdat).getTime() : 0;
                
                if (sortValue === 'price-desc') {
                  return priceB - priceA;
                } else if (sortValue === 'price-asc') {
                  return priceA - priceB;
                } else if (sortValue === 'time-desc') {
                  return createdAtB - createdAtA;
                }
                return 0;
              });
              
              // 重新添加排序后的气泡到容器
              bubbles.forEach(bubble => bubbleContainer.appendChild(bubble));
              
              // 刷新交易建议
              const refreshBtn = body.querySelector(`.refresh-btn[data-stock="${stockName}"]`);
              if (refreshBtn) refreshBtn.click();
            });
          });

          // 为保存阈值按钮绑定点击事件
          const saveThresholdBtns = body ? body.querySelectorAll('.save-threshold-btn') : [];
          saveThresholdBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const stockName = btn.getAttribute('data-stock');
              const input = btn.parentElement.querySelector('.threshold-input');
              const thresholdValue = input ? input.value : '1.5';
              
              // 按股票名称保存到localStorage
              localStorage.setItem(`tradeThresholdPercent_${stockName}`, thresholdValue);
              
              // 刷新买卖建议窗口以更新柱状图
              if (window.trades && window.pairingCache && pluginInstance && stockName) {
                pluginInstance.showAdvice(stockName, window.trades, window.pairingCache);
              }
            });
          });
          
          // 为图表切换按钮绑定点击事件
          const chartToggleBtns = body ? body.querySelectorAll('.chart-toggle-btn') : [];
          chartToggleBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
              e.stopPropagation();
              const chartContainer = btn.closest('.price-distribution-chart');
              if (!chartContainer) return;
              
              const barView = chartContainer.querySelector('.chart-bar-view');
              const lineView = chartContainer.querySelector('.chart-line-view');
              
              if (barView && lineView) {
                if (barView.style.display !== 'none') {
                  barView.style.display = 'none';
                  lineView.style.display = 'block';
                  btn.textContent = '切换柱状图';
                } else {
                  barView.style.display = 'flex';
                  lineView.style.display = 'none';
                  btn.textContent = '切换折线图';
                }
              }
            });
          });
          
          // 为柱子绑定双击事件，显示明细信息
          const chartBars = body ? body.querySelectorAll('.price-distribution-chart .bar') : [];
          chartBars.forEach(bar => {
            bar.addEventListener('dblclick', (e) => {
              e.stopPropagation();
              
              const type = bar.getAttribute('data-type');
              const priceLow = parseFloat(bar.getAttribute('data-price-low'));
              const priceHigh = parseFloat(bar.getAttribute('data-price-high'));
              
              const chartContainer = bar.closest('.chart-container');
              if (!chartContainer) return;
              
              let unpairedBuys = [];
              let unpairedSells = [];
              
              try {
                const buysData = chartContainer.getAttribute('data-unpaired-buys');
                const sellsData = chartContainer.getAttribute('data-unpaired-sells');
                if (buysData) unpairedBuys = JSON.parse(buysData);
                if (sellsData) unpairedSells = JSON.parse(sellsData);
              } catch (parseErr) {
                console.error('解析未配对数据失败', parseErr);
              }
              
              // 根据类型筛选对应价格区间的交易
              let filteredTrades = [];
              if (type === 'buy') {
                filteredTrades = unpairedBuys.filter(t => t.price >= priceLow && t.price < priceHigh);
              } else {
                filteredTrades = unpairedSells.filter(t => t.price >= priceLow && t.price < priceHigh);
              }
              
              if (filteredTrades.length === 0) {
                alert('该价格区间没有未配对交易');
                return;
              }
              
              // 使用明细弹窗插件显示
              if (window.chartDetailModal) {
                window.chartDetailModal.show({
                  type: type,
                  priceLow: priceLow,
                  priceHigh: priceHigh,
                  trades: filteredTrades,
                  decimalPlaces: 2
                });
              } else {
                console.error('chartDetailModal 插件未加载');
              }
            });
          });

          // 为阈值输入框绑定input事件，动态更新建议买入和卖出价格
          const thresholdInputs = body ? body.querySelectorAll('.threshold-input') : [];
          thresholdInputs.forEach(input => {
            input.addEventListener('input', (e) => {
              e.stopPropagation();
              const parsedValue = parseFloat(input.value);
              const thresholdValue = isNaN(parsedValue) ? 1.5 : parsedValue;
              const threshold = thresholdValue / 100;
              
              // 找到建议买入和卖出的气泡元素
              const suggestBuyBubbles = body.querySelectorAll('.suggest-buy');
              const suggestSellBubbles = body.querySelectorAll('.suggest-sell');
              
              // 更新建议买入价格
              suggestBuyBubbles.forEach(bubble => {
                const basePrice = parseFloat(bubble.getAttribute('data-base-price'));
                if (!isNaN(basePrice)) {
                  const newPrice = (basePrice * (1 - threshold)).toFixed(2);
                  bubble.textContent = newPrice;
                }
              });
              
              // 更新建议卖出价格
              suggestSellBubbles.forEach(bubble => {
                const basePrice = parseFloat(bubble.getAttribute('data-base-price'));
                if (!isNaN(basePrice)) {
                  const newPrice = (basePrice * (1 + threshold)).toFixed(2);
                  bubble.textContent = `-${newPrice}`;
                }
              });
            });
          });
      }
    } catch (err) {
      console.error('为插件气泡绑定双击事件失败', err);
    }
  }

  /**
   * 生成显示内容
   * @param {Array} trades - 交易数据
   * @param {Map} pairedTradesMap - 配对交易映射
   * @param {Array} recentDates - 最近日期
   * @param {string} stockName - 股票名称
   * @param {Object} stockPairing - 完整的股票配对数据
   * @param {Array} stockTrades - 所有股票交易数据
   * @returns {string} HTML内容
   */
  generateContent(trades, pairedTradesMap, recentDates, stockName, stockPairing, stockTrades) {
    // 收集所有已配对的交易ID
    const pairedTradeIds = new Set();
    // 使用完整的股票配对数据，而不是只使用最近日期的配对数据
    if (stockPairing && stockPairing.pairedTrades) {
      stockPairing.pairedTrades.forEach(pair => {
        if (pair.buy && pair.buy.id) pairedTradeIds.add(pair.buy.id);
        if (pair.sell && pair.sell.id) pairedTradeIds.add(pair.sell.id);
      });
    }
    
    // 找出 createdAt 最新的交易ID
    let latestTradeId = null;
    let latestCreatedAt = null;
    stockTrades.forEach(t => {
      const createdAt = t.createdAt || t.createdat || t.created_at;
      if (createdAt) {
        const createdTime = new Date(createdAt).getTime();
        if (latestCreatedAt === null || createdTime > latestCreatedAt) {
          latestCreatedAt = createdTime;
          latestTradeId = t.id;
        }
      }
    });
    
    // 分类资料
    const today = new Date().toISOString().slice(0, 10);
    // 当天：除了当天日期的单笔交易之外，任何配对中只要买或卖任一为当天，都应以配对气泡显示在当天分组
    const category1 = trades.filter(t => t.date === today || ((pairedTradesMap.get(t.id) && (pairedTradesMap.get(t.id).buy && pairedTradesMap.get(t.id).buy.date === today)) || (pairedTradesMap.get(t.id) && (pairedTradesMap.get(t.id).sell && pairedTradesMap.get(t.id).sell.date === today))))
      .sort((a, b) => {
        // 首先按日期降序排序
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        // 日期相同，按创建时间降序排序
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        // 没有创建时间，按价格降序排序
        return b.price - a.price;
      });
    const category2 = trades.filter(t => recentDates.includes(t.date) && t.date !== today)
      .sort((a, b) => {
        // 首先按日期降序排序
        if (a.date !== b.date) {
          return b.date.localeCompare(a.date);
        }
        // 日期相同，按创建时间降序排序
        if (a.createdAt && b.createdAt) {
          return new Date(b.createdAt) - new Date(a.createdAt);
        }
        // 没有创建时间，按价格降序排序
        return b.price - a.price;
      });
    // 未配对分类应排除所有已配对的交易（pairedTradeIds 中存在的交易）
    // 读取保存的排序设置
    const savedSellSort = localStorage.getItem(`unpairedSellSort_${stockName}`) || 'price-desc';
    const savedBuySort = localStorage.getItem(`unpairedBuySort_${stockName}`) || 'price-asc';
    
    // 未配对卖出：根据保存的排序设置排序
    const category3 = stockTrades.filter(t => t.side === 'sell' && !pairedTradeIds.has(t.id))
      .sort((a, b) => {
        if (savedSellSort === 'price-desc') {
          return b.price - a.price;
        } else if (savedSellSort === 'price-asc') {
          return a.price - b.price;
        } else if (savedSellSort === 'time-desc') {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        }
        return b.price - a.price;
      });
    // 未配对买入：根据保存的排序设置排序
    const category4 = stockTrades.filter(t => t.side === 'buy' && !pairedTradeIds.has(t.id))
      .sort((a, b) => {
        if (savedBuySort === 'price-asc') {
          return a.price - b.price;
        } else if (savedBuySort === 'price-desc') {
          return b.price - a.price;
        } else if (savedBuySort === 'time-desc') {
          const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return timeB - timeA;
        }
        return a.price - b.price;
      });
    
    // 构建带显示标题（包含日期标签）的分类显示区域
    const recentFiveDates = recentDates.filter(d => d !== today).slice(0, 5);
    const recentFiveLabel = recentFiveDates.length ? ` (${recentFiveDates.join(',')})` : '';
    const todayLabel = ` (${today})`;

    const categories = [
      { name: '当天资料', displayName: `当天资料${todayLabel}`, trades: category1 },
      { name: '最近五个交易日资料', displayName: `最近五个交易日資料${recentFiveLabel}`, trades: category2 },
      { name: '未配对卖出(由大到小)', displayName: '未配对卖出(由大到小)', trades: category3 },
      { name: '未配对买入(由小到大)', displayName: '未配对买入(由小到大)', trades: category4 },
      { name: '交易建议', displayName: '交易建议', trades: [] }
    ];
    
    // 计算结存数量
    let totalBuyQty = 0;
    let totalSellQty = 0;
    stockTrades.forEach(trade => {
      if (trade.side === 'buy') {
        totalBuyQty += trade.qty || 0;
      } else if (trade.side === 'sell') {
        totalSellQty += trade.qty || 0;
      }
    });
    const balanceQty = totalBuyQty - totalSellQty;
    
    // 创建表格结构
    let html = '<div class="buy-sell-advice-content">';
    html += '<div class="advice-header">';
    html += `<h3>${stockName} - 买卖建议 <span style="font-size: 14px; color: #666;">(结存数量: ${balanceQty.toLocaleString()})</span></h3>`;
    html += '<div class="header-buttons">';
    html += '<button class="grid-trading-btn" data-stock="' + stockName + '">网格交易</button>';
    html += '<button class="add-trade-btn" data-stock="' + stockName + '">新增交易</button>';
    html += '<button class="batch-hide-btn" data-stock="' + stockName + '">批次修改</button>';
    html += '<button class="refresh-btn" data-stock="' + stockName + '">刷新</button>';
    html += '</div>';
    html += '</div>';
    html += '<table class="advice-table">';
    
    // 全局记录已显示的交易ID，避免跨分类重复显示
    const globalDisplayed = new Set();

    // 计算在“当天资料”或“最近五个交易日资料”中出现且未配对的交易价格集合
    // 用于在“未配对卖出/买入”分类中对相同单价的气泡做粗边框高亮（只比较价格）
    const recentUnpairedPrices = new Set();
    [category1, category2].forEach(cat => {
      cat.forEach(t => {
        if (t && typeof t.price !== 'undefined' && !pairedTradeIds.has(t.id)) {
          const formattedPrice = (t.side === 'sell') ? `-${t.price}` : `${t.price}`;
          recentUnpairedPrices.add(String(formattedPrice));
        }
      });
    });

    categories.forEach(category => {
      if (category.trades.length === 0 && category.name !== '交易建议') return;

      // 创建表格行
      html += '<tr>';
      
      // 左侧标题单元格
      const titleText = category.displayName || category.name;
      html += `<td class="advice-title">${titleText}`;
      
      // 为未配对卖出和未配对买入添加排序选择器
      if (category.name === '未配对卖出(由大到小)') {
        const savedSellSort = localStorage.getItem(`unpairedSellSort_${stockName}`) || 'price-desc';
        html += `<br><select class="sort-select" data-category="unpaired-sell" data-stock="${stockName}" style="margin-top: 4px; font-size: 12px;">`;
        html += `<option value="price-desc" ${savedSellSort === 'price-desc' ? 'selected' : ''}>单价 由大到小</option>`;
        html += `<option value="price-asc" ${savedSellSort === 'price-asc' ? 'selected' : ''}>单价 由小到大</option>`;
        html += `<option value="time-desc" ${savedSellSort === 'time-desc' ? 'selected' : ''}>按输入时间(降序)</option>`;
        html += `</select>`;
      } else if (category.name === '未配对买入(由小到大)') {
        const savedBuySort = localStorage.getItem(`unpairedBuySort_${stockName}`) || 'price-asc';
        html += `<br><select class="sort-select" data-category="unpaired-buy" data-stock="${stockName}" style="margin-top: 4px; font-size: 12px;">`;
        html += `<option value="price-asc" ${savedBuySort === 'price-asc' ? 'selected' : ''}>单价 由小到大</option>`;
        html += `<option value="price-desc" ${savedBuySort === 'price-desc' ? 'selected' : ''}>单价 由大到小</option>`;
        html += `<option value="time-desc" ${savedBuySort === 'time-desc' ? 'selected' : ''}>按输入时间(降序)</option>`;
        html += `</select>`;
      } else if (category.name === '交易建议') {
        const savedThresholdValue = localStorage.getItem(`tradeThresholdPercent_${stockName}`);
        const savedThreshold = savedThresholdValue !== null ? savedThresholdValue : '1.5';
        html += `<br><div style="margin-top: 4px; font-size: 12px;">`;
        html += `<label>阈值百分比：</label>`;
        html += `<input type="number" class="threshold-input" data-stock="${stockName}" value="${savedThreshold}" min="0" max="100" step="0.1" style="width: 60px; margin-left: 4px; font-size: 12px;">`;
        html += `<span>%</span>`;
        html += `<button class="save-threshold-btn" data-stock="${stockName}" style="margin-left: 8px; font-size: 12px;">保存</button>`;
        html += `</div>`;
      }
      
      html += `</td>`;
      
      // 右侧内容单元格
      html += '<td class="advice-content">';
      html += '<div class="bubble-container">';

      // 交易建议分类特殊处理
      if (category.name === '交易建议') {
        // 读取当前股票的阈值
        const savedThresholdStr = localStorage.getItem(`tradeThresholdPercent_${stockName}`);
        const thresholdPercent = savedThresholdStr !== null ? parseFloat(savedThresholdStr) : 1.5;
        const threshold = thresholdPercent / 100;
        
        // 1. 最新一笔交易
        const latestTrade = stockTrades.find(t => t.id === latestTradeId);
        if (latestTrade) {
          const priceText = latestTrade.side === 'sell' ? `-${latestTrade.price}` : `${latestTrade.price}`;
          const bubbleClass = latestTrade.side === 'sell' ? 'sell' : 'buy';
          const hideableClass = latestTrade.hideable === 'Y' ? 'hideable' : '';
          const isSell = latestTrade.side === 'sell';
          
          // 计算建议买入和卖出价格
          const basePrice = Math.abs(latestTrade.price);
          const suggestBuyPrice = (basePrice * (1 - threshold)).toFixed(2);
          const suggestSellPrice = (basePrice * (1 + threshold)).toFixed(2);
          
          // 根据最新交易的正负决定排列顺序
          if (isSell) {
            // 卖出（负数）：建议买入 -> 建议卖出
            html += `<div class="suggested-item">最新一笔交易：<span class="price-bubble ${bubbleClass} latest-trade ${hideableClass}">${priceText}</span> ---> 建议买入：<span class="price-bubble buy suggest-buy" data-base-price="${basePrice}">${suggestBuyPrice}</span> ---> 建议卖出：<span class="price-bubble sell suggest-sell" data-base-price="${basePrice}">-${suggestSellPrice}</span></div>`;
          } else {
            // 买入（正数）：建议卖出 -> 建议买入
            html += `<div class="suggested-item">最新一笔交易：<span class="price-bubble ${bubbleClass} latest-trade ${hideableClass}">${priceText}</span> ---> 建议卖出：<span class="price-bubble sell suggest-sell" data-base-price="${basePrice}">-${suggestSellPrice}</span> ---> 建议买入：<span class="price-bubble buy suggest-buy" data-base-price="${basePrice}">${suggestBuyPrice}</span></div>`;
          }
        }
        
        // 2. 卖出交易（已按保存的排序设置排序，取第一笔）
        if (category3.length > 0) {
          const selectedSell = category3[0];
          const sellLabel = (savedSellSort === 'price-desc') ? '最高卖出交易' : '最低卖出交易';
          const hideableClass = selectedSell.hideable === 'Y' ? 'hideable' : '';
          const basePrice = Math.abs(selectedSell.price);
          const suggestBuyPrice = (basePrice * (1 - threshold)).toFixed(2);
          const suggestSellPrice = (basePrice * (1 + threshold)).toFixed(2);
          // 卖出（负数）：建议买入 -> 建议卖出
          html += `<div class="suggested-item">${sellLabel}：<span class="price-bubble sell ${hideableClass}">-${selectedSell.price}</span> ---> 建议买入：<span class="price-bubble buy suggest-buy" data-base-price="${basePrice}">${suggestBuyPrice}</span> ---> 建议卖出：<span class="price-bubble sell suggest-sell" data-base-price="${basePrice}">-${suggestSellPrice}</span></div>`;
        }
        
        // 3. 买入交易（已按保存的排序设置排序，取第一笔）
        if (category4.length > 0) {
          const selectedBuy = category4[0];
          const buyLabel = (savedBuySort === 'price-asc') ? '最低买进交易' : '最高买进交易';
          const hideableClass = selectedBuy.hideable === 'Y' ? 'hideable' : '';
          const basePrice = Math.abs(selectedBuy.price);
          const suggestBuyPrice = (basePrice * (1 - threshold)).toFixed(2);
          const suggestSellPrice = (basePrice * (1 + threshold)).toFixed(2);
          // 买入（正数）：建议卖出 -> 建议买入
          html += `<div class="suggested-item">${buyLabel}：<span class="price-bubble buy ${hideableClass}">${selectedBuy.price}</span> ---> 建议卖出：<span class="price-bubble sell suggest-sell" data-base-price="${basePrice}">-${suggestSellPrice}</span> ---> 建议买入：<span class="price-bubble buy suggest-buy" data-base-price="${basePrice}">${suggestBuyPrice}</span></div>`;
        }
        
        html += '</div>';
        html += '</td>';
        // 建议交易单价单元格
        html += '<td class="advice-suggested-price">';
        html += '<span style="color: #888;">-</span>';
        html += '</td>';
        html += '</tr>';
        
        return;
      }

      // 处理配对资料（避免跨分类重复）
      category.trades.forEach(trade => {
        // 对于未配对卖出(由大到小)和未配对买入(由小到大)，不需要检查globalDisplayed
        const isUnpairedCategory = category.name === '未配对卖出(由大到小)' || category.name === '未配对买入(由小到大)';
        if (!isUnpairedCategory && globalDisplayed.has(trade.id)) return;

        const pair = pairedTradesMap.get(trade.id);

        // 对于配对交易：当天分组需显示任何一端为当天的配对气泡
        if (pair && pair.buy && pair.sell) {
          const buyIsToday = pair.buy.date === today;
          const sellIsToday = pair.sell.date === today;

          if (category.name === '当天资料' && (buyIsToday || sellIsToday)) {
            const buyTradeClass = buyIsToday ? '' : (recentDates.includes(pair.buy.date) ? 'recent-trade' : '');
            const sellTradeClass = sellIsToday ? '' : (recentDates.includes(pair.sell.date) ? 'recent-trade' : '');
            const buyLatestClass = pair.buy.id === latestTradeId ? 'latest-trade' : '';
            const sellLatestClass = pair.sell.id === latestTradeId ? 'latest-trade' : '';

            html += `
              <div class="trade-pair" data-buy-id="${pair.buy.id || ''}" data-buy-price="${pair.buy.price || ''}" data-buy-qty="${pair.buy.qty || ''}" data-buy-date="${pair.buy.date || ''}" data-buy-stock="${pair.buy.stock || ''}" data-buy-remark="${(pair.buy.remark||'').toString().replace(/"/g,'&quot;')}" data-sell-id="${pair.sell.id || ''}" data-sell-price="${pair.sell.price || ''}" data-sell-qty="${pair.sell.qty || ''}" data-sell-date="${pair.sell.date || ''}" data-sell-stock="${pair.sell.stock || ''}" data-sell-remark="${(pair.sell.remark||'').toString().replace(/"/g,'&quot;')}">
                  <span class="price-bubble buy ${buyTradeClass} ${buyLatestClass} ${pair.buy && pair.buy.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${pair.buy.id || ''}" data-price="${pair.buy.price}" data-qty="${pair.buy.qty || ''}" data-amount="${pair.buy.amount || ''}" data-createdat="${pair.buy.createdAt || pair.buy.createdat || pair.buy.created_at || ''}" data-hideable="${pair.buy.hideable || ''}" data-side="buy" data-stock="${pair.buy.stock || ''}" data-date="${pair.buy.date || ''}" data-remark="${pair.buy.remark || ''}">${pair.buy.price}</span>
                  <span class="price-bubble sell ${sellTradeClass} ${sellLatestClass} ${pair.sell && pair.sell.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${pair.sell.id || ''}" data-price="${pair.sell.price}" data-qty="${pair.sell.qty || ''}" data-amount="${pair.sell.amount || ''}" data-createdat="${pair.sell.createdAt || pair.sell.createdat || pair.sell.created_at || ''}" data-hideable="${pair.sell.hideable || ''}" data-side="sell" data-stock="${pair.sell.stock || ''}" data-date="${pair.sell.date || ''}" data-remark="${pair.sell.remark || ''}">-${pair.sell.price}</span>
                </div>
            `;

            globalDisplayed.add(pair.buy.id);
            globalDisplayed.add(pair.sell.id);
            return;
          }

          // 最近五个交易日：如果配对中任一端为最近五日之一，也应显示配对气泡
          if (category.name === '最近五个交易日资料' && (recentDates.includes(pair.buy.date) || recentDates.includes(pair.sell.date))) {
            const buyTradeClass = recentDates.includes(pair.buy.date) ? '' : (pair.buy.date === today ? '' : '');
            const sellTradeClass = recentDates.includes(pair.sell.date) ? '' : (pair.sell.date === today ? '' : '');
            const buyLatestClass = pair.buy.id === latestTradeId ? 'latest-trade' : '';
            const sellLatestClass = pair.sell.id === latestTradeId ? 'latest-trade' : '';

            html += `
              <div class="trade-pair" data-buy-id="${pair.buy.id || ''}" data-buy-price="${pair.buy.price || ''}" data-buy-qty="${pair.buy.qty || ''}" data-buy-date="${pair.buy.date || ''}" data-buy-stock="${pair.buy.stock || ''}" data-buy-remark="${(pair.buy.remark||'').toString().replace(/"/g,'&quot;')}" data-sell-id="${pair.sell.id || ''}" data-sell-price="${pair.sell.price || ''}" data-sell-qty="${pair.sell.qty || ''}" data-sell-date="${pair.sell.date || ''}" data-sell-stock="${pair.sell.stock || ''}" data-sell-remark="${(pair.sell.remark||'').toString().replace(/"/g,'&quot;')}">
                  <span class="price-bubble buy ${buyTradeClass} ${buyLatestClass} ${pair.buy && pair.buy.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${pair.buy.id || ''}" data-price="${pair.buy.price}" data-qty="${pair.buy.qty || ''}" data-amount="${pair.buy.amount || ''}" data-createdat="${pair.buy.createdAt || pair.buy.createdat || pair.buy.created_at || ''}" data-hideable="${pair.buy.hideable || ''}" data-side="buy" data-stock="${pair.buy.stock || ''}" data-date="${pair.buy.date || ''}" data-remark="${pair.buy.remark || ''}">${pair.buy.price}</span>
                  <span class="price-bubble sell ${sellTradeClass} ${sellLatestClass} ${pair.sell && pair.sell.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${pair.sell.id || ''}" data-price="${pair.sell.price}" data-qty="${pair.sell.qty || ''}" data-amount="${pair.sell.amount || ''}" data-createdat="${pair.sell.createdAt || pair.sell.createdat || pair.sell.created_at || ''}" data-hideable="${pair.sell.hideable || ''}" data-side="sell" data-stock="${pair.sell.stock || ''}" data-date="${pair.sell.date || ''}" data-remark="${pair.sell.remark || ''}">-${pair.sell.price}</span>
                </div>
            `;

            globalDisplayed.add(pair.buy.id);
            globalDisplayed.add(pair.sell.id);
            return;
          }

          // 其它分类：当两个端都位于该分类时，显示配对气泡
          const buyInCategory = category.trades.some(t => t.id === pair.buy.id);
          const sellInCategory = category.trades.some(t => t.id === pair.sell.id);
          if (buyInCategory && sellInCategory) {
            const buyTradeClass = pair.buy.date === today ? '' : (recentDates.includes(pair.buy.date) ? 'recent-trade' : '');
            const sellTradeClass = pair.sell.date === today ? '' : (recentDates.includes(pair.sell.date) ? 'recent-trade' : '');
            const buyLatestClass = pair.buy.id === latestTradeId ? 'latest-trade' : '';
            const sellLatestClass = pair.sell.id === latestTradeId ? 'latest-trade' : '';

            html += `
              <div class="trade-pair" data-buy-id="${pair.buy.id || ''}" data-buy-price="${pair.buy.price || ''}" data-buy-qty="${pair.buy.qty || ''}" data-buy-date="${pair.buy.date || ''}" data-buy-stock="${pair.buy.stock || ''}" data-buy-remark="${(pair.buy.remark||'').toString().replace(/"/g,'&quot;')}" data-sell-id="${pair.sell.id || ''}" data-sell-price="${pair.sell.price || ''}" data-sell-qty="${pair.sell.qty || ''}" data-sell-date="${pair.sell.date || ''}" data-sell-stock="${pair.sell.stock || ''}" data-sell-remark="${(pair.sell.remark||'').toString().replace(/"/g,'&quot;')}">
                    <span class="price-bubble buy ${buyTradeClass} ${buyLatestClass} ${pair.buy && pair.buy.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${pair.buy.id || ''}" data-price="${pair.buy.price}" data-qty="${pair.buy.qty || ''}" data-amount="${pair.buy.amount || ''}" data-createdat="${pair.buy.createdAt || pair.buy.createdat || pair.buy.created_at || ''}" data-hideable="${pair.buy.hideable || ''}" data-side="buy" data-stock="${pair.buy.stock || ''}" data-date="${pair.buy.date || ''}" data-remark="${pair.buy.remark || ''}">${pair.buy.price}</span>
                    <span class="price-bubble sell ${sellTradeClass} ${sellLatestClass} ${pair.sell && pair.sell.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${pair.sell.id || ''}" data-price="${pair.sell.price}" data-qty="${pair.sell.qty || ''}" data-amount="${pair.sell.amount || ''}" data-createdat="${pair.sell.createdAt || pair.sell.createdat || pair.sell.created_at || ''}" data-hideable="${pair.sell.hideable || ''}" data-side="sell" data-stock="${pair.sell.stock || ''}" data-date="${pair.sell.date || ''}" data-remark="${pair.sell.remark || ''}">-${pair.sell.price}</span>
                </div>
            `;

            globalDisplayed.add(pair.buy.id);
            globalDisplayed.add(pair.sell.id);
            return;
          }
        }

        // 非配对或未被配对显示的单独气泡
        if (isUnpairedCategory || !globalDisplayed.has(trade.id)) {
          const tradeClass = trade.date === today ? '' : (recentDates.includes(trade.date) ? 'recent-trade' : '');
          const bubbleClass = trade.side === 'sell' ? 'sell' : 'buy';
          const priceText = trade.side === 'sell' ? `-${trade.price}` : `${trade.price}`;
          const latestClass = trade.id === latestTradeId ? 'latest-trade' : '';

          // 对于未配对分类中，若该交易的价格文本出现在当天或最近五日未配对价格集合中，则使用粗边框
          const isHighlightedInUnpaired = isUnpairedCategory && typeof priceText !== 'undefined' && recentUnpairedPrices.has(String(priceText));
          const extraClass = isHighlightedInUnpaired ? 'highlight-unpaired' : '';

          // escape attribute values minimally by replacing double quotes
          const dataTradeId = trade.id || '';
          const dataPrice = trade.price || '';
          const dataStock = trade.stock || '';
          const dataDate = trade.date || '';
          const dataRemark = (trade.remark || '').toString().replace(/"/g, '&quot;');

          html += `
            <span class="price-bubble ${bubbleClass} ${tradeClass} ${latestClass} ${extraClass} ${trade && trade.hideable === 'Y' ? 'hideable' : ''}" data-trade-id="${dataTradeId}" data-price="${dataPrice}" data-qty="${trade.qty || ''}" data-amount="${trade.amount || ''}" data-createdat="${trade.createdAt || trade.createdat || trade.created_at || ''}" data-hideable="${trade.hideable || ''}" data-side="${trade.side}" data-stock="${dataStock}" data-date="${dataDate}" data-remark="${dataRemark}">${priceText}</span>
          `;

          // 只有非未配对分类才需要添加到globalDisplayed
          if (!isUnpairedCategory) {
            globalDisplayed.add(trade.id);
          }
        }
      });

      html += '</div>';
      html += '</td>';
      // 建议交易单价单元格
      html += '<td class="advice-suggested-price">';
      html += '<span style="color: #888;">-</span>';
      html += '</td>';
      html += '</tr>';
    });
    
    // 底部汇总行：合并三列，用于显示区间股价分布柱状图
    html += '<tr class="summary-row">';
    html += '<td colspan="3" class="advice-summary" style="background-color: #f0f9ff; padding: 15px;">';
    
    // 读取当前股票的阈值
    const savedThresholdStr = localStorage.getItem(`tradeThresholdPercent_${stockName}`);
    const thresholdPercent = savedThresholdStr !== null ? parseFloat(savedThresholdStr) : 1.5;
    
    // 获取最新一笔交易作为基准价格
    const latestTrade = stockTrades.find(t => t.id === latestTradeId);
    const basePrice = latestTrade ? Math.abs(latestTrade.price) : null;
    
    // 生成柱状图
    const chartHtml = this.generatePriceDistributionChart(category3, category4, thresholdPercent, basePrice);
    html += chartHtml;
    
    html += '</td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div>';
    
    return html;
  }

  /**
   * 生成价格分布柱状图
   * @param {Array} unpairedSells - 未配对卖出数据
   * @param {Array} unpairedBuys - 未配对买入数据
   * @param {number} thresholdPercent - 阈值百分比
   * @param {number} basePrice - 基准价格（最新一笔交易单价）
   * @returns {string} HTML内容
   */
  generatePriceDistributionChart(unpairedSells, unpairedBuys, thresholdPercent = 1.5, basePrice = null) {
    if (unpairedSells.length === 0 && unpairedBuys.length === 0) {
      return '<div style="text-align: center; color: #888; padding: 20px;">暂无数据</div>';
    }

    const allPrices = [
      ...unpairedBuys.map(t => t.price),
      ...unpairedSells.map(t => t.price)
    ];

    if (allPrices.length === 0) {
      return '<div style="text-align: center; color: #888; padding: 20px;">暂无数据</div>';
    }

    // 如果没有基准价格，使用所有价格的中位数
    if (basePrice === null) {
      const sortedPrices = [...allPrices].sort((a, b) => a - b);
      const mid = Math.floor(sortedPrices.length / 2);
      basePrice = sortedPrices.length % 2 !== 0
        ? sortedPrices[mid]
        : (sortedPrices[mid - 1] + sortedPrices[mid]) / 2;
    }

    const threshold = thresholdPercent / 100;
    
    // 每个柱子代表的价格区间宽度
    const priceStep = basePrice * threshold;
    
    // 找出所有价格的最小值和最大值（包含最新交易价格）
    const minPrice = Math.min(...allPrices, basePrice);
    const maxPrice = Math.max(...allPrices, basePrice);
    
    // 计算柱子数量：从最低价到最高价，确保最左柱子对应最低价，最右柱子对应最高价
    // 找到最低价和最高价对应的柱子中心位置
    const minBarCenter = Math.round(minPrice / priceStep) * priceStep;
    const maxBarCenter = Math.round(maxPrice / priceStep) * priceStep;
    
    // 计算需要多少个柱子
    const barCount = Math.max(Math.round((maxBarCenter - minBarCenter) / priceStep) + 1, 1);
    
    // 计算每个柱子的价格范围
    const barRanges = [];
    for (let i = 0; i < barCount; i++) {
      const center = minBarCenter + i * priceStep;
      const low = center - priceStep / 2;
      const high = center + priceStep / 2;
      barRanges.push({ low, high, center });
    }

    const buyBars = new Array(barCount).fill(0);
    const sellBars = new Array(barCount).fill(0);

    // 将交易分配到对应的柱子
    unpairedBuys.forEach(t => {
      const price = t.price;
      
      // 找到对应的柱子索引
      const barIndex = Math.round((price - minBarCenter) / priceStep);
      
      // 确保索引在有效范围内
      const clampedIndex = Math.max(0, Math.min(barCount - 1, barIndex));
      buyBars[clampedIndex] += t.qty || 0;
    });

    unpairedSells.forEach(t => {
      const price = t.price;
      
      // 找到对应的柱子索引
      const barIndex = Math.round((price - minBarCenter) / priceStep);
      
      // 确保索引在有效范围内
      const clampedIndex = Math.max(0, Math.min(barCount - 1, barIndex));
      sellBars[clampedIndex] += t.qty || 0;
    });

    // 找到最新一笔交易对应的柱子索引
    const latestBarIndex = Math.round((basePrice - minBarCenter) / priceStep);
    const latestBarClampedIndex = Math.max(0, Math.min(barCount - 1, latestBarIndex));

    // 计算所有价格的最大小数位数
    const maxDecimalPlaces = Math.max(
      ...allPrices.map(p => {
        const str = p.toString();
        const decimalIndex = str.indexOf('.');
        return decimalIndex >= 0 ? str.length - decimalIndex - 1 : 0;
      }),
      2 // 至少显示2位小数
    );

    const maxQty = Math.max(
      ...buyBars,
      ...sellBars,
      1
    );

    let html = '<div class="price-distribution-chart">';
    html += `<div class="chart-title" style="text-align: center; font-weight: bold; margin-bottom: 10px; color: #374151;">股价分布柱状图（基准: ${basePrice.toFixed(maxDecimalPlaces)}，阈值: ${thresholdPercent}%）</div>`;
    
    // 滚动容器
    const chartWidth = barCount * 43 + 20; // 每个柱子40px + 3px间距
    html += `<div class="chart-scroll-container" style="width: 100%; overflow-x: auto; overflow-y: visible;">`;
    html += `<div class="chart-container chart-bar-view" data-unpaired-buys='${JSON.stringify(unpairedBuys)}' data-unpaired-sells='${JSON.stringify(unpairedSells)}' style="display: flex; flex-direction: column; align-items: center; position: relative; min-width: ${chartWidth}px;">`;
    
    html += '<div class="chart-y-axis" style="display: flex; flex-direction: column; align-items: center; margin-bottom: 5px;">';
    html += `<span style="font-size: 10px; color: #ef4444;">买入 ↑</span>`;
    html += '</div>';
    
    // 价格标签行（上方）- 偶数索引显示
    html += '<div class="chart-price-labels-top" style="display: flex; gap: 3px; height: 38px; overflow: visible; padding-top: 8px;">';
    for (let i = 0; i < barCount; i++) {
      const isLatest = i === latestBarClampedIndex;
      const isEven = i % 2 === 0;
      const priceLow = barRanges[i].low.toFixed(maxDecimalPlaces);
      const priceHigh = barRanges[i].high.toFixed(maxDecimalPlaces);
      const labelColor = isLatest ? '#f59e0b' : '#374151';
      
      html += `<div style="width: 40px; flex-shrink: 0; text-align: center; display: flex; flex-direction: column; align-items: center;">`;
      if (isEven) {
        html += `<span style="font-size: 9px; color: ${labelColor}; font-weight: ${isLatest ? 'bold' : 'normal'}; white-space: nowrap; line-height: 1.3;">${priceLow}</span>`;
        html += `<span style="font-size: 9px; color: ${labelColor}; font-weight: ${isLatest ? 'bold' : 'normal'}; white-space: nowrap; line-height: 1.3;">~${priceHigh}</span>`;
      }
      html += `</div>`;
    }
    html += '</div>';
    
    // 买入区域（0轴上方）
    html += '<div class="chart-buy-area" style="display: flex; align-items: flex-end; gap: 3px; height: 160px; overflow: visible;">';
    for (let i = 0; i < barCount; i++) {
      const buyQty = buyBars[i];
      const buyHeight = buyQty > 0 ? Math.max((buyQty / maxQty) * 150, 20) : 0;
      const priceLow = barRanges[i].low;
      const priceHigh = barRanges[i].high;
      const priceStart = priceLow.toFixed(maxDecimalPlaces);
      const priceEnd = priceHigh.toFixed(maxDecimalPlaces);
      const isLatest = i === latestBarClampedIndex;
      
      const bgColor = isLatest ? '#fbbf24' : '#ef4444';
      const borderColor = isLatest ? 'border: 3px solid #f59e0b;' : '';
      
      html += `<div class="bar buy-bar" data-type="buy" data-price-low="${priceLow}" data-price-high="${priceHigh}" style="width: 40px; height: ${buyHeight}px; background-color: ${bgColor}; border-radius: 3px 3px 0 0; position: relative; flex-shrink: 0; cursor: pointer; ${borderColor}" title="买入: ${buyQty}股\n价格区间: ${priceStart} - ${priceEnd}${isLatest ? '\n★ 最新交易' : ''}\n双击查看明细">`;
      
      if (buyQty > 0) {
        html += `<span style="font-size: 10px; color: ${isLatest ? '#92400e' : '#ef4444'}; font-weight: bold; position: absolute; top: -14px; left: 50%; transform: translateX(-50%); white-space: nowrap;">${buyQty}</span>`;
      }
      if (isLatest && buyQty === 0) {
        html += `<span style="font-size: 8px; color: #92400e; font-weight: bold; position: absolute; top: -12px; left: 50%; transform: translateX(-50%); white-space: nowrap;">★</span>`;
      }
      html += '</div>';
    }
    html += '</div>';
    
    // 0轴线
    html += '<div class="zero-line" style="width: 100%; height: 2px; background-color: #374151; margin: 2px 0;"></div>';
    
    // 卖出区域（0轴下方）
    html += '<div class="chart-sell-area" style="display: flex; align-items: flex-start; gap: 3px; height: 160px; overflow: visible;">';
    for (let i = 0; i < barCount; i++) {
      const sellQty = sellBars[i];
      const sellHeight = sellQty > 0 ? Math.max((sellQty / maxQty) * 150, 20) : 0;
      const priceLow = barRanges[i].low;
      const priceHigh = barRanges[i].high;
      const priceStart = priceLow.toFixed(maxDecimalPlaces);
      const priceEnd = priceHigh.toFixed(maxDecimalPlaces);
      const isLatest = i === latestBarClampedIndex;
      
      const bgColor = isLatest ? '#fbbf24' : '#3b82f6';
      const borderColor = isLatest ? 'border: 3px solid #f59e0b;' : '';
      
      html += `<div class="bar sell-bar" data-type="sell" data-price-low="${priceLow}" data-price-high="${priceHigh}" style="width: 40px; height: ${sellHeight}px; background-color: ${bgColor}; border-radius: 0 0 3px 3px; position: relative; flex-shrink: 0; cursor: pointer; ${borderColor}" title="卖出: ${sellQty}股\n价格区间: ${priceStart} - ${priceEnd}${isLatest ? '\n★ 最新交易' : ''}\n双击查看明细">`;
      
      if (sellQty > 0) {
        html += `<span style="font-size: 10px; color: ${isLatest ? '#92400e' : '#3b82f6'}; font-weight: bold; position: absolute; bottom: -14px; left: 50%; transform: translateX(-50%); white-space: nowrap;">${sellQty}</span>`;
      }
      if (isLatest && sellQty === 0) {
        html += `<span style="font-size: 8px; color: #92400e; font-weight: bold; position: absolute; bottom: -12px; left: 50%; transform: translateX(-50%); white-space: nowrap;">★</span>`;
      }
      html += '</div>';
    }
    html += '</div>';
    
    // 价格标签行（下方）- 奇数索引显示
    html += '<div class="chart-price-labels-bottom" style="display: flex; gap: 3px; height: 38px; overflow: visible; padding-bottom: 8px;">';
    for (let i = 0; i < barCount; i++) {
      const isLatest = i === latestBarClampedIndex;
      const isOdd = i % 2 === 1;
      const priceLow = barRanges[i].low.toFixed(maxDecimalPlaces);
      const priceHigh = barRanges[i].high.toFixed(maxDecimalPlaces);
      const labelColor = isLatest ? '#f59e0b' : '#374151';
      
      html += `<div style="width: 40px; flex-shrink: 0; text-align: center; display: flex; flex-direction: column; align-items: center;">`;
      if (isOdd) {
        html += `<span style="font-size: 9px; color: ${labelColor}; font-weight: ${isLatest ? 'bold' : 'normal'}; white-space: nowrap; line-height: 1.3;">${priceLow}</span>`;
        html += `<span style="font-size: 9px; color: ${labelColor}; font-weight: ${isLatest ? 'bold' : 'normal'}; white-space: nowrap; line-height: 1.3;">~${priceHigh}</span>`;
      }
      html += `</div>`;
    }
    html += '</div>';
    
    html += '<div class="chart-y-axis" style="display: flex; flex-direction: column; align-items: center; margin-top: 5px;">';
    html += `<span style="font-size: 10px; color: #3b82f6;">↓ 卖出</span>`;
    html += '</div>';
    
    html += '<div class="chart-x-axis" style="display: flex; justify-content: space-between; width: 100%; margin-top: 5px;">';
    html += `<span style="font-size: 10px; color: #666;">${barRanges[0].low.toFixed(maxDecimalPlaces)}</span>`;
    html += `<span style="font-size: 10px; color: #f59e0b; font-weight: bold;">★ 基准: ${basePrice.toFixed(maxDecimalPlaces)}</span>`;
    html += `<span style="font-size: 10px; color: #666;">${barRanges[barCount - 1].high.toFixed(maxDecimalPlaces)}</span>`;
    html += '</div>';
    
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    return html;
  }

  /**
   * 隐藏买卖建议
   */
  hideAdvice() {
    if (this.floatingWindow) {
      this.floatingWindow.hide();
    }
  }

  /**
   * 窗口关闭事件处理
   */
  onWindowClose() {
    console.log('买卖建议窗口已关闭');
  }

  /**
   * 窗口显示事件处理
   */
  onWindowShow() {
    console.log('买卖建议窗口已显示');
  }

  /**
   * 窗口隐藏事件处理
   */
  onWindowHide() {
    console.log('买卖建议窗口已隐藏');
  }

  /**
   * 销毁插件
   */
  destroy() {
    if (this.floatingWindow) {
      this.floatingWindow.destroy();
      this.floatingWindow = null;
    }
    this.initialized = false;
    this.currentStock = null;
  }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BuySellAdvicePlugin;
} else if (typeof window !== 'undefined') {
  window.BuySellAdvicePlugin = BuySellAdvicePlugin;
  // 创建全局实例
  window.buySellAdvicePlugin = new BuySellAdvicePlugin();
}
