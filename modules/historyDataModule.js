// 历史数据模块
class HistoryDataModule {
  /**
   * 获取股票历史数据
   * @param {Array} stockTrades - 股票交易数据
   * @param {Object} pairingCache - 配对缓存
   * @param {string} stockName - 股票名称
   * @param {number} limit - 限制返回的日期数量（默认5个）
   * @returns {Array} 历史数据数组
   */
  static getStockHistoryData(stockTrades, pairingCache, stockName, limit = 5) {
    const historyData = [];
    
    // 从缓存中获取该股票的配对信息
    const pairing = pairingCache[stockName] || {};
    const pairedBuyIds = new Set(pairing.pairedBuyIds || []);
    const pairedSellIds = new Set(pairing.pairedSellIds || []);
    
    // 按日期分组交易
    const tradesByDate = {};
    const addedPairIds = new Set();
    
    stockTrades.forEach(trade => {
      if (!tradesByDate[trade.date]) {
        tradesByDate[trade.date] = {
          trades: [],
          pairedTrades: []
        };
      }
      tradesByDate[trade.date].trades.push(trade);
    });
    
    // 处理配对交易，确保每个配对只添加到一个日期中（使用较大的交易日期）
    if (pairing.pairedTrades) {
      pairing.pairedTrades.forEach(pair => {
        // 生成配对的唯一标识符
        const pairId = pair.buy && pair.buy.id ? pair.buy.id : pair.sell.id;
        if (pairId && !addedPairIds.has(pairId)) {
          // 确定配对交易的日期（使用较大的交易日期）
          let pairDate = null;
          if (pair.buy && pair.sell) {
            // 比较两个日期，使用较大的那个
            pairDate = pair.buy.date > pair.sell.date ? pair.buy.date : pair.sell.date;
          } else if (pair.buy) {
            pairDate = pair.buy.date;
          } else if (pair.sell) {
            pairDate = pair.sell.date;
          }
          
          if (pairDate && tradesByDate[pairDate]) {
            tradesByDate[pairDate].pairedTrades.push(pair);
            addedPairIds.add(pairId);
          }
        }
      });
    }
    
    // 按日期排序（最近的在前）
    const sortedDates = Object.keys(tradesByDate).sort((a, b) => b.localeCompare(a));
    
    // 限制返回的日期数量
    const recentDates = limit > 0 ? sortedDates.slice(0, limit) : sortedDates;
    
    // 为每个日期生成统计数据
    recentDates.forEach(date => {
      const dateData = tradesByDate[date];
      const dateTrades = dateData.trades;
      let pairedTrades = dateData.pairedTrades;
      
      // 按交易时间排序配对交易（最新的在前）
      pairedTrades.sort((a, b) => {
        // 获取配对中最新的交易时间
        const getPairTimestamp = (pair) => {
          const buyTime = pair.buy && pair.buy.createdAt ? new Date(pair.buy.createdAt).getTime() : 0;
          const sellTime = pair.sell && pair.sell.createdAt ? new Date(pair.sell.createdAt).getTime() : 0;
          return Math.max(buyTime, sellTime);
        };
        return getPairTimestamp(b) - getPairTimestamp(a);
      });
      
      // 按交易时间排序未配对交易（最新的在前）
      const unpairedTrades = dateTrades
        .filter(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });
      
      const prices = dateTrades.map(t => parseFloat(t.price));
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const avgPrice = (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
      
      historyData.push({
        label: date,
        value: `高:${maxPrice} 低:${minPrice} 均:${avgPrice}`,
        pairedTrades: pairedTrades,
        unpairedTrades: unpairedTrades
      });
    });
    
    return historyData;
  }

  /**
   * 按日期分组交易
   * @param {Array} trades - 交易数据
   * @returns {Object} 按日期分组的交易数据
   */
  static groupTradesByDate(trades) {
    const tradesByDate = {};
    trades.forEach(trade => {
      if (!tradesByDate[trade.date]) {
        tradesByDate[trade.date] = [];
      }
      tradesByDate[trade.date].push(trade);
    });
    return tradesByDate;
  }

  /**
   * 获取排序后的日期列表
   * @param {Object} tradesByDate - 按日期分组的交易数据
   * @param {boolean} ascending - 是否升序排序（默认降序）
   * @returns {Array} 排序后的日期列表
   */
  static getSortedDates(tradesByDate, ascending = false) {
    return Object.keys(tradesByDate).sort((a, b) => {
      return ascending ? a.localeCompare(b) : b.localeCompare(a);
    });
  }

  /**
   * 计算交易价格的统计信息
   * @param {Array} trades - 交易数据
   * @returns {Object} 统计信息
   */
  static calculatePriceStats(trades) {
    const prices = trades.map(t => parseFloat(t.price));
    if (prices.length === 0) {
      return {
        maxPrice: null,
        minPrice: null,
        avgPrice: null
      };
    }
    
    const maxPrice = Math.max(...prices);
    const minPrice = Math.min(...prices);
    const avgPrice = (prices.reduce((sum, price) => sum + price, 0) / prices.length).toFixed(2);
    
    return {
      maxPrice,
      minPrice,
      avgPrice
    };
  }

  /**
   * 过滤历史交易（排除指定日期）
   * @param {Array} trades - 交易数据
   * @param {string} excludeDate - 要排除的日期
   * @returns {Array} 过滤后的交易数据
   */
  static filterHistoryTrades(trades, excludeDate) {
    return trades.filter(t => !excludeDate || t.date !== excludeDate);
  }

  /**
   * 计算未配对交易的最大/最小价格
   * @param {Array} trades - 交易数据
   * @param {Set} pairedBuyIds - 已配对的买入交易ID
   * @param {Set} pairedSellIds - 已配对的卖出交易ID
   * @returns {Object} 未配对交易的最大/最小价格信息
   */
  static calculateUnpairedPriceExtremes(trades, pairedBuyIds, pairedSellIds) {
    const allUnpairedTrades = trades.filter(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id));
    
    // 计算未配对买入的最大和最小单价
    const allUnpairedBuys = allUnpairedTrades.filter(t => t.side === 'buy');
    let stockBuyMinPrice = null;
    let stockBuyMaxPrice = null;
    let stockBuyMinTrade = null;
    let stockBuyMaxTrade = null;
    
    if (allUnpairedBuys.length > 0) {
      const buyPrices = allUnpairedBuys.map(t => parseFloat(t.price));
      stockBuyMinPrice = Math.min(...buyPrices);
      stockBuyMaxPrice = Math.max(...buyPrices);
      // 找到对应的交易记录
      stockBuyMinTrade = allUnpairedBuys.find(t => parseFloat(t.price) === stockBuyMinPrice);
      stockBuyMaxTrade = allUnpairedBuys.find(t => parseFloat(t.price) === stockBuyMaxPrice);
    }
    
    // 计算未配对卖出的最大和最小单价
    const allUnpairedSells = allUnpairedTrades.filter(t => t.side === 'sell');
    let stockSellMinPrice = null;
    let stockSellMaxPrice = null;
    let stockSellMinTrade = null;
    let stockSellMaxTrade = null;
    
    if (allUnpairedSells.length > 0) {
      const sellPrices = allUnpairedSells.map(t => parseFloat(t.price));
      stockSellMinPrice = Math.min(...sellPrices);
      stockSellMaxPrice = Math.max(...sellPrices);
      // 找到对应的交易记录
      stockSellMinTrade = allUnpairedSells.find(t => parseFloat(t.price) === stockSellMinPrice);
      stockSellMaxTrade = allUnpairedSells.find(t => parseFloat(t.price) === stockSellMaxPrice);
    }
    
    return {
      buy: {
        minPrice: stockBuyMinPrice,
        maxPrice: stockBuyMaxPrice,
        minTrade: stockBuyMinTrade,
        maxTrade: stockBuyMaxTrade
      },
      sell: {
        minPrice: stockSellMinPrice,
        maxPrice: stockSellMaxPrice,
        minTrade: stockSellMinTrade,
        maxTrade: stockSellMaxTrade
      }
    };
  }

  /**
   * 找到最新的交易ID
   * @param {Array} trades - 交易数据
   * @param {string} stockName - 股票名称
   * @returns {string} 最新交易的ID
   */
  static findLatestTradeId(trades, stockName) {
    let latestTradeId = null;
    let latestCreatedAt = null;
    
    trades.forEach(t => {
      if (t.stock === stockName) {
        const createdAt = t.createdAt || t.createdat || t.created_at;
        if (createdAt) {
          const createdTime = new Date(createdAt).getTime();
          if (latestCreatedAt === null || createdTime > latestCreatedAt) {
            latestCreatedAt = createdTime;
            latestTradeId = t.id;
          }
        }
      }
    });
    
    return latestTradeId;
  }

  /**
   * 检查日期是否有交易数据
   * @param {Object} tradesByDate - 按日期分组的交易数据
   * @param {string} date - 日期
   * @param {Object} pairing - 配对信息
   * @param {Set} pairedBuyIds - 已配对的买入交易ID
   * @param {Set} pairedSellIds - 已配对的卖出交易ID
   * @returns {boolean} 是否有交易数据
   */
  static hasTradesForDate(tradesByDate, date, pairing, pairedBuyIds, pairedSellIds) {
    const dateTrades = tradesByDate[date] || [];
    
    // 检查该日期是否有任何配对交易
    const hasPairedTrades = pairing.pairedTrades ? pairing.pairedTrades.some(pair => {
      const pairDate = pair.buy.date > pair.sell.date ? pair.buy.date : pair.sell.date;
      return pairDate === date;
    }) : false;
    
    // 检查该日期是否有任何未配对交易
    const hasUnpairedTrades = dateTrades.some(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id));
    
    return hasPairedTrades || hasUnpairedTrades;
  }
}

// 导出模块
if (typeof window !== 'undefined') {
  window.HistoryDataModule = HistoryDataModule;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryDataModule;
}
