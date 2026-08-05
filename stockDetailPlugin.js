/**
 * 股票详情插件
 * 用于显示股票的详细状况，包括配对情况、未配对交易等信息
 */

class StockDetailPlugin {
    constructor() {
        this.floatingWindow = null;
        this.init();
    }

    /**
     * 初始化插件
     */
    init() {
        this.createFloatingWindow();
    }

    /**
     * 创建股票详情悬浮视窗
     */
    createFloatingWindow() {
        // 检查悬浮视窗是否已存在
        if (this.floatingWindow) {
            return;
        }

        // 创建悬浮视窗实例
        this.floatingWindow = new FloatingWindow({
            title: '股票详情',
            width: '400px',
            height: '600px',
            x: '50px',
            y: '50px',
            draggable: true,
            id: 'stockDetailModal',
            on: {
                close: () => {
                    this.hideModal();
                }
            }
        });
    }

    /**
     * 显示股票详情悬浮视窗
     * @param {string} stockName - 股票名称
     * @param {Array} trades - 所有交易记录
     */
    showModal(stockName, trades) {
        if (!this.floatingWindow) {
            this.createFloatingWindow();
        }

        // 更新标题
        this.floatingWindow.setTitle(`${stockName} 详情`);

        // 计算股票详情
        const stockDetails = this.calculateStockDetails(stockName, trades);

        // 生成详情HTML
        const detailHTML = this.generateDetailHTML(stockDetails);

        // 更新内容
        this.floatingWindow.setContent(detailHTML);

        // 显示悬浮视窗
        this.floatingWindow.show();
    }

    /**
     * 隐藏股票详情悬浮视窗
     */
    hideModal() {
        if (this.floatingWindow) {
            this.floatingWindow.hide();
        }
    }

    /**
     * 计算股票详情
     * @param {string} stockName - 股票名称
     * @param {Array} trades - 所有交易记录
     * @returns {Object} 股票详情
     */
    calculateStockDetails(stockName, trades) {
        // 筛选该股票的交易
        const stockTrades = trades.filter(t => t.stock === stockName);

        // 计算配对和未配对交易
        const unpairedBuys = [];
        const unpairedSells = [];

        // 简单分类（实际应用中可能需要更复杂的配对逻辑）
        stockTrades.forEach(trade => {
            if (trade.side === 'buy') {
                unpairedBuys.push(trade);
            } else if (trade.side === 'sell') {
                unpairedSells.push(trade);
            }
        });

        // 获取配对缓存中的配对气泡数量
        let pairedCount = 0;
        let pairedProfit = 0;
        
        // 检查配对缓存
        console.log('Checking pairing cache for:', stockName);
        console.log('Window pairingCache exists:', !!window.pairingCache);
        
        // 尝试不同的缓存键名
        let pairingData = null;
        
        // 尝试直接使用股票名称作为键
        if (window.pairingCache && window.pairingCache[stockName]) {
            pairingData = window.pairingCache[stockName];
            console.log('Found pairing data with stockName key:', pairingData);
        }
        
        // 尝试使用股票名称+市场作为键（如果上面没有找到）
        if (!pairingData && window.pairingCache) {
            // 查找包含股票名称的键
            const cacheKeys = Object.keys(window.pairingCache);
            console.log('All cache keys:', cacheKeys);
            
            // 尝试找到包含股票名称的键
            for (const key of cacheKeys) {
                if (key.includes(stockName)) {
                    pairingData = window.pairingCache[key];
                    console.log('Found pairing data with key containing stockName:', key, pairingData);
                    break;
                }
            }
        }
        
        // 如果找到配对数据，计算配对气泡数量和净利润
        if (pairingData) {
            if (pairingData.pairedTrades && Array.isArray(pairingData.pairedTrades)) {
                pairedCount = pairingData.pairedTrades.length;
                console.log('Paired trades count:', pairedCount);
                
                // 计算配对交易净利润
                pairingData.pairedTrades.forEach(pair => {
                    if (pair.sell && pair.buy) {
                        pairedProfit += (pair.sell.amount || 0) - (pair.buy.amount || 0);
                    }
                });
            } else {
                console.log('No pairedTrades array found in pairing data:', pairingData);
            }
        } else {
            console.log('No pairing data found for:', stockName);
        }

        // 计算未配对买入交易
        const unpairedBuyCount = unpairedBuys.length;
        const unpairedBuyAmount = unpairedBuys.reduce((sum, trade) => sum + (trade.amount || 0), 0);
        const unpairedBuyTotalQty = unpairedBuys.reduce((sum, trade) => sum + (trade.qty || 0), 0);
        const unpairedBuyAvgPrice = unpairedBuyTotalQty > 0 ? unpairedBuyAmount / unpairedBuyTotalQty : 0;

        // 计算未配对卖出交易
        const unpairedSellCount = unpairedSells.length;
        const unpairedSellAmount = unpairedSells.reduce((sum, trade) => sum + (trade.amount || 0), 0);
        const unpairedSellTotalQty = unpairedSells.reduce((sum, trade) => sum + (trade.qty || 0), 0);
        const unpairedSellAvgPrice = unpairedSellTotalQty > 0 ? unpairedSellAmount / unpairedSellTotalQty : 0;

        return {
            stockName,
            totalTrades: stockTrades.length,
            paired: {
                count: pairedCount,
                profit: pairedProfit
            },
            unpairedBuys: {
                count: unpairedBuyCount,
                amount: unpairedBuyAmount,
                avgPrice: unpairedBuyAvgPrice
            },
            unpairedSells: {
                count: unpairedSellCount,
                amount: unpairedSellAmount,
                avgPrice: unpairedSellAvgPrice
            }
        };
    }

    /**
     * 生成详情HTML
     * @param {Object} stockDetails - 股票详情
     * @returns {string} HTML字符串
     */
    generateDetailHTML(stockDetails) {
        return `
            <div class="stock-detail-grid">
                <div class="grid-section">
                    <h4>基本信息</h4>
                    <div class="grid-item">
                        <span class="grid-label">股票名称：</span>
                        <span class="grid-value">${stockDetails.stockName}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-label">总交易次数：</span>
                        <span class="grid-value">${stockDetails.totalTrades}</span>
                    </div>
                </div>

                <div class="grid-section">
                    <h4>配对情况</h4>
                    <div class="grid-item">
                        <span class="grid-label">配对气泡数量：</span>
                        <span class="grid-value">${stockDetails.paired.count}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-label">配对交易净利润：</span>
                        <span class="grid-value ${stockDetails.paired.profit >= 0 ? 'net-positive' : 'net-negative'}">
                            ${stockDetails.paired.profit.toFixed(2)}
                        </span>
                    </div>
                </div>

                <div class="grid-section">
                    <h4>未配对买入</h4>
                    <div class="grid-item">
                        <span class="grid-label">未配对买入气泡数量：</span>
                        <span class="grid-value">${stockDetails.unpairedBuys.count}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-label">未配对买入金额：</span>
                        <span class="grid-value">${stockDetails.unpairedBuys.amount.toFixed(2)}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-label">平均买入单价：</span>
                        <span class="grid-value">${stockDetails.unpairedBuys.avgPrice.toFixed(2)}</span>
                    </div>
                </div>

                <div class="grid-section">
                    <h4>未配对卖出</h4>
                    <div class="grid-item">
                        <span class="grid-label">未配对卖出气泡数量：</span>
                        <span class="grid-value">${stockDetails.unpairedSells.count}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-label">未配对卖出金额：</span>
                        <span class="grid-value">${stockDetails.unpairedSells.amount.toFixed(2)}</span>
                    </div>
                    <div class="grid-item">
                        <span class="grid-label">平均卖出单价：</span>
                        <span class="grid-value">${stockDetails.unpairedSells.avgPrice.toFixed(2)}</span>
                    </div>
                </div>
            </div>
        `;
    }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StockDetailPlugin;
} else if (typeof window !== 'undefined') {
    window.StockDetailPlugin = StockDetailPlugin;
    // 初始化插件
    window.stockDetailPlugin = new StockDetailPlugin();
}
