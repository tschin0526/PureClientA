/**
 * SelectBubbleExportImport Plugin
 * 选择勾选导入/导出 - 独立插件
 * 功能：选择日期 → 勾选气泡 → 导出/导入 JSON
 */

class SelectBubbleExportImport {
  constructor() {
    this.window = null;
    this.selectedTrades = new Set();
    this.init();
  }

  init() {
    console.log('SelectBubbleExportImport 插件初始化');
  }

  // 显示主窗体
  showModal() {
    if (!this.window) {
      this.window = new FloatingWindow({
        title: '✅ 选择勾选导入/导出',
        sourceFile: 'selectBubbleExportImport.js',
        width: '900px',
        height: '700px',
        x: '150px',
        y: '80px',
        draggable: true,
        id: 'selectBubbleExportImportWindow'
      });
    }

    const content = this.buildContent();
    this.window.setContent(content);
    this.window.show();

    this.bindEvents();
  }

  // 构建窗体内容
  buildContent() {
    var now = new Date();
    var pad = function(n) { return n < 10 ? '0' + n : n; };
    const today = now.getFullYear() + '-' + pad(now.getMonth()+1) + '-' + pad(now.getDate());
    
    return `
      <div class="sb-export-import-container" style="padding: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        
        <!-- 日期选择区 -->
        <div style="margin-bottom: 20px; padding: 12px; background: #f8f9fa; border-radius: 6px;">
          <label style="font-weight: bold; color: #333; font-size: 13px;">📅 选择日期：</label>
          <input type="date" id="sbSelectDate" value="${today}" 
                 style="padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; margin-left: 10px; font-size: 13px;">
          <button id="sbLoadDateBtn" style="padding: 6px 16px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 10px; font-size: 12px;">
            加载该日数据
          </button>
          <span id="sbDateInfo" style="margin-left: 15px; color: #666; font-size: 12px;"></span>
        </div>

        <!-- 操作按钮区 -->
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
          <button id="sbSelectAllBtn" style="padding: 8px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            ✓ 全选
          </button>
          <button id="sbDeselectAllBtn" style="padding: 8px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            ✗ 取消全选
          </button>
          <button id="sbExportBtn" style="padding: 8px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">
            📤 导出选中项 (JSON)
          </button>
          <button id="sbImportBtn" style="padding: 8px 24px; background: #6610f2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">
            📥 导入 JSON 文件
          </button>
          <input type="file" id="sbImportFile" accept=".json" style="display: none;">
          <span id="sbSelectedCount" style="padding: 6px 12px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; font-weight: bold;">
            已选择: 0 项
          </span>
        </div>

        <!-- 气泡列表区 -->
        <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
          <div style="background: #f1f3f5; padding: 10px; font-weight: bold; color: #495057; font-size: 13px; border-bottom: 1px solid #ddd;">
            📋 该日交易气泡列表
          </div>
          <div id="sbTradeList" style="max-height: 450px; overflow-y: auto; padding: 10px;">
            <div style="text-align: center; color: #999; padding: 40px; font-size: 14px;">
              请先选择日期并点击「加载该日数据」
            </div>
          </div>
        </div>

        <!-- 导入结果区 -->
        <div id="sbImportResult" style="margin-top: 15px; padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; display: none;">
          <strong>📥 导入结果：</strong>
          <pre id="sbImportResultText" style="margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px;"></pre>
        </div>

      </div>
    `;
  }

  // 绑定事件
  bindEvents() {
    const body = this.window.getElement().querySelector('.floating-body');

    // 加载该日数据按钮
    body.querySelector('#sbLoadDateBtn').addEventListener('click', () => {
      this.loadDateTrades();
    });

    // 全选按钮
    body.querySelector('#sbSelectAllBtn').addEventListener('click', () => {
      this.selectAll();
    });

    // 取消全选按钮
    body.querySelector('#sbDeselectAllBtn').addEventListener('click', () => {
      this.deselectAll();
    });

    // 导出按钮
    body.querySelector('#sbExportBtn').addEventListener('click', () => {
      this.exportSelected();
    });

    // 导入按钮
    body.querySelector('#sbImportBtn').addEventListener('click', () => {
      body.querySelector('#sbImportFile').click();
    });

    // 导入文件选择
    body.querySelector('#sbImportFile').addEventListener('change', (e) => {
      this.importFromFile(e);
    });
  }

  // 加载指定日期的交易数据
  async loadDateTrades() {
    const dateInput = document.getElementById('sbSelectDate');
    const tradeListEl = document.getElementById('sbTradeList');
    const dateInfoEl = document.getElementById('sbDateInfo');

    if (!dateInput || !tradeListEl || !dateInfoEl) return;

    const selectedDate = dateInput.value;
    if (!selectedDate) {
      alert('请先选择日期！');
      return;
    }

    try {
      // 清空已选项
      this.selectedTrades.clear();
      this.updateSelectedCount();

      // 从数据库获取交易数据
      if (!window.tradesDB || !window.trades) {
        throw new Error('数据库或交易数据未加载');
      }

      // 过滤指定日期的交易
      const dateTrades = window.trades.filter(t => t.date === selectedDate);

      if (dateTrades.length === 0) {
        tradeListEl.innerHTML = `
          <div style="text-align: center; color: #999; padding: 40px; font-size: 14px;">
            📭 该日期没有找到任何交易记录
          </div>
        `;
        dateInfoEl.textContent = `${selectedDate}: 共 0 笔交易`;
        return;
      }

      // 按股票分组显示
      const groupedByStock = {};
      dateTrades.forEach(trade => {
        if (!groupedByStock[trade.stock]) {
          groupedByStock[trade.stock] = [];
        }
        groupedByStock[trade.stock].push(trade);
      });

      let html = '';
      Object.keys(groupedByStock).sort().forEach(stockName => {
        const trades = groupedByStock[stockName];
        html += `
          <div style="margin-bottom: 15px; border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 8px 12px; font-weight: bold; font-size: 13px;">
              📈 ${stockName} (${trades.length} 笔)
            </div>
            <div style="padding: 10px;">
        `;

        trades.forEach(trade => {
          const sideIcon = trade.side === 'buy' ? '🟢' : '🔴';
          const sideText = trade.side === 'buy' ? '买入' : '卖出';
          const priceDisplay = trade.price > 0 ? `+${trade.price}` : trade.price;
          
          html += `
            <div class="sb-trade-item" data-trade-id="${trade.id}" 
                 style="display: flex; align-items: center; padding: 8px; margin: 4px 0; background: #f8f9fa; border-radius: 4px; border-left: 3px solid ${trade.side === 'buy' ? '#28a745' : '#dc3545'}; cursor: pointer; transition: all 0.2s;"
                 onclick="window.SelectBubbleExportImport.toggleTrade('${trade.id}')">
              <input type="checkbox" class="sb-trade-checkbox" data-trade-id="${trade.id}" 
                     style="margin-right: 10px; width: 16px; height: 16px; cursor: pointer;">
              <div style="flex: 1; font-size: 12px;">
                <span style="font-weight: bold; color: ${trade.side === 'buy' ? '#28a745' : '#dc3545'};">${sideIcon} ${sideText}</span>
                <span style="color: #333; margin-left: 8px;">单价: ${priceDisplay}</span>
                <span style="color: #666; margin-left: 8px;">数量: ${trade.qty}</span>
                ${trade.isSpecialQty ? '<span style="background: #ffc107; color: #212529; padding: 2px 6px; border-radius: 3px; font-size: 10px; margin-left: 8px;">非标量</span>' : ''}
              </div>
              <div style="color: #888; font-size: 11px;">ID: ${trade.id}</div>
            </div>
          `;
        });

        html += '</div></div>';
      });

      tradeListEl.innerHTML = html;
      dateInfoEl.textContent = `${selectedDate}: 共 ${dateTrades.length} 笔交易 (${Object.keys(groupedByStock).length} 只股票)`;

      // 绑定checkbox事件
      tradeListEl.querySelectorAll('.sb-trade-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          e.stopPropagation();
          const tradeId = e.target.dataset.tradeId;
          if (e.target.checked) {
            this.selectedTrades.add(tradeId);
          } else {
            this.selectedTrades.delete(tradeId);
          }
          this.updateSelectedCount();
          this.updateItemStyle(tradeId, e.target.checked);
        });
      });

    } catch (error) {
      console.error('加载日期交易失败:', error);
      tradeListEl.innerHTML = `
        <div style="text-align: center; color: #dc3545; padding: 40px; font-size: 14px;">
          ❌ 加载失败: ${error.message}
        </div>
      `;
    }
  }

  // 切换单个交易的选中状态
  toggleTrade(tradeId) {
    const checkbox = document.querySelector(`.sb-trade-checkbox[data-trade-id="${tradeId}"]`);
    if (!checkbox) return;

    if (this.selectedTrades.has(tradeId)) {
      this.selectedTrades.delete(tradeId);
      checkbox.checked = false;
      this.updateItemStyle(tradeId, false);
    } else {
      this.selectedTrades.add(tradeId);
      checkbox.checked = true;
      this.updateItemStyle(tradeId, true);
    }
    
    this.updateSelectedCount();
  }

  // 更新单项样式
  updateItemStyle(tradeId, isSelected) {
    const item = document.querySelector(`.sb-trade-item[data-trade-id="${tradeId}"]`);
    if (item) {
      if (isSelected) {
        item.style.background = '#e3f2fd';
        item.style.borderLeftWidth = '5px';
      } else {
        item.style.background = '#f8f9fa';
        item.style.borderLeftWidth = '3px';
      }
    }
  }

  // 全选
  selectAll() {
    document.querySelectorAll('.sb-trade-checkbox').forEach(checkbox => {
      checkbox.checked = true;
      this.selectedTrades.add(checkbox.dataset.tradeId);
      this.updateItemStyle(checkbox.dataset.tradeId, true);
    });
    this.updateSelectedCount();
  }

  // 取消全选
  deselectAll() {
    document.querySelectorAll('.sb-trade-checkbox').forEach(checkbox => {
      checkbox.checked = false;
      this.selectedTrades.delete(checkbox.dataset.tradeId);
      this.updateItemStyle(checkbox.dataset.tradeId, false);
    });
    this.updateSelectedCount();
  }

  // 更新选中计数
  updateSelectedCount() {
    const countEl = document.getElementById('sbSelectedCount');
    if (countEl) {
      countEl.textContent = `已选择: ${this.selectedTrades.size} 项`;
      countEl.style.background = this.selectedTrades.size > 0 ? '#cce5ff' : '#e3f2fd';
      countEl.style.color = this.selectedTrades.size > 0 ? '#004085' : '#1976d2';
    }
  }

  // 导出选中的交易
  exportSelected() {
    if (this.selectedTrades.size === 0) {
      alert('⚠️ 请先勾选要导出的交易气泡！');
      return;
    }

    try {
      // 获取选中的交易数据
      const selectedDate = document.getElementById('sbSelectDate')?.value;
      const selectedTradesData = window.trades.filter(t =>
        this.selectedTrades.has(t.id) && t.date === selectedDate
      );

      if (selectedTradesData.length === 0) {
        alert('❌ 未找到匹配的交易数据！');
        return;
      }

      // 构建导出数据结构 - 导出完整对象，保留所有字段（包括金额）
      const exportData = {
        version: '1.0',
        exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
        sourceDate: selectedDate,
        totalCount: selectedTradesData.length,
        trades: selectedTradesData.map(trade => ({
          id: trade.id,
          stock: trade.stock,
          date: trade.date,
          price: Number(trade.price),
          qty: trade.qty,
          amount: Number(trade.amount) || (Number(trade.price) * Number(trade.qty)),  // ✅ 新增金额字段
          side: trade.side,
          isSpecialQty: trade.isSpecialQty || false,
          notes: trade.notes || '',
          market: trade.market || '台股',
          createdAt: trade.createdAt || new Date().toLocaleString('zh-CN', { hour12: false })
        }))
      };

      // 转换为JSON字符串
      const jsonStr = JSON.stringify(exportData, null, 2);

      // 创建下载
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bubble_export_${selectedDate}_${this.selectedTrades.size}items.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ 导出成功！\n\n📊 统计信息：\n• 导出日期：${selectedDate}\n• 交易笔数：${selectedTradesData.length} 笔\n• 涉及股票：${[...new Set(selectedTradesData.map(t => t.stock))].length} 只\n\n文件已自动下载！`);

    } catch (error) {
      console.error('导出失败:', error);
      alert('❌ 导出失败：' + error.message);
    }
  }

  // 从文件导入
  async importFromFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const importData = JSON.parse(text);

      // 验证数据格式
      if (!importData.trades || !Array.isArray(importData.trades)) {
        throw new Error('无效的JSON格式：缺少trades数组');
      }

      if (importData.trades.length === 0) {
        throw new Error('导入文件中没有交易数据');
      }

      // 显示确认对话框
      const stocks = [...new Set(importData.trades.map(t => t.stock))];
      const confirmMsg = `确定要增量导入以下数据吗？\n\n` +
        `📋 数据来源：${importData.sourceDate || '未知'}\n` +
        `📊 交易笔数：${importData.trades.length} 笔\n` +
        `📈 涉及股票：${stocks.join(', ')}\n\n` +
        `🔍 智能去重规则：\n` +
        `系统会根据「股票 + 单价 + 日期 + 时间」四字段组合检查重复\n` +
        `同一天同一股票相同单价但不同时间的交易将被视为独立交易\n` +
        `已存在的记录将自动跳过（Skip），不会覆盖或重复存档`;

      if (!confirm(confirmMsg)) {
        event.target.value = '';
        return;
      }

      // 执行增量导入
      let importedCount = 0;
      let skippedCount = 0;
      let errorCount = 0;
      const errors = [];
      const skippedRecords = []; // 记录被跳过的记录详情

      for (const importTrade of importData.trades) {
        try {
          // 验证必要字段
          if (!importTrade.id || !importTrade.stock || !importTrade.date) {
            throw new Error(`交易ID ${importTrade.id || '缺失'} 缺少必要字段(id/stock/date)`);
          }

          // 构建完整的交易对象，确保所有字段都存在（包括金额）
          const completeTrade = {
            id: String(importTrade.id),
            stock: String(importTrade.stock),
            date: importTrade.date,
            price: String(importTrade.price || 0),
            qty: Number(importTrade.qty) || 0,
            amount: Number(importTrade.amount) || (Number(importTrade.price || 0) * Number(importTrade.qty || 0)),  // ✅ 新增金额字段（自动计算）
            side: importTrade.side || 'buy',
            isSpecialQty: Boolean(importTrade.isSpecialQty),
            notes: importTrade.notes || '',
            market: importTrade.market || '台股',
            createdAt: importTrade.createdAt || new Date().toLocaleString('zh-CN', { hour12: false })
          };

          // 🔍 智能去重检测：根据「股票 + 单价 + 日期 + 时间」四字段组合检查
          const duplicateIndex = window.trades.findIndex(t =>
            t.stock === completeTrade.stock &&
            String(t.price) === completeTrade.price &&
            t.date === completeTrade.date &&
            (t.createdAt || t.id) === (completeTrade.createdAt || completeTrade.id)
          );

          if (duplicateIndex >= 0) {
            // ⏭️ 发现重复记录 - 跳过该笔资料
            skippedCount++;
            skippedRecords.push({
              id: completeTrade.id,
              stock: completeTrade.stock,
              date: completeTrade.date,
              time: completeTrade.createdAt ? new Date(completeTrade.createdAt).toLocaleTimeString('zh-TW') : '未知',
              price: completeTrade.price,
              reason: '已存在相同 [股票+单价+日期+时间] 的记录'
            });
            continue; // 跳过，处理下一笔
          }

          // ✅ 无重复 - 正常新增记录
          window.trades.push(completeTrade);
          await window.tradesDB.save(completeTrade);
          importedCount++;

        } catch (err) {
          errorCount++;
          errors.push(`ID ${importTrade.id}: ${err.message}`);
        }
      }

      // 显示结果
      const resultEl = document.getElementById('sbImportResult');
      const resultTextEl = document.getElementById('sbImportResultText');

      if (resultEl && resultTextEl) {
        resultEl.style.display = 'block';
        let resultText = `✅ 导入完成！\n\n`;
        resultText += `📊 处理统计：\n`;
        resultText += `• ✅ 新增：${importedCount} 笔\n`;
        resultText += `• ⏭️ 跳过（重复）：${skippedCount} 笔\n`;
        resultText += `• ❌ 错误：${errorCount} 笔\n\n`;

        // 显示被跳过的记录详情（最多显示前10条）
        if (skippedRecords.length > 0) {
          resultText += `⏭️ 跳过的重复记录（前10条）：\n`;
          skippedRecords.slice(0, 10).forEach(record => {
            resultText += `   • ${record.stock} | ${record.date} ${record.time || ''} | 单价:${record.price}\n`;
          });
          if (skippedRecords.length > 10) {
            resultText += `   ... 还有 ${skippedRecords.length - 10} 条被跳过\n`;
          }
          resultText += `\n`;
        }

        if (errors.length > 0) {
          resultText += `❌ 错误详情：\n`;
          errors.slice(0, 5).forEach(err => {
            resultText += `• ${err}\n`;
          });
          if (errors.length > 5) {
            resultText += `• ... 还有 ${errors.length - 5} 个错误\n`;
          }
        }

        resultTextEl.textContent = resultText;
      }

      // 导入成功后自动调用重置按钮来刷新数据
      if (typeof resetFilters === 'function') {
        resetFilters();
      }

      alert(`✅ 增量导入完成！\n\n📊 处理统计：\n• ✅ 新增：${importedCount} 笔\n• ⏭️ 跳过（重复）：${skippedCount} 笔\n• ❌ 错误：${errorCount} 笔\n\n数据已自动刷新！`);

      // 重置文件输入
      event.target.value = '';

    } catch (error) {
      console.error('导入失败:', error);
      alert('❌ 导入失败：' + error.message);
      event.target.value = '';
    }
  }
}

// 初始化插件
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM加载完成，初始化 SelectBubbleExportImport');
    window.SelectBubbleExportImport = new SelectBubbleExportImport();
  });
} else {
  console.log('DOM已加载，直接初始化 SelectBubbleExportImport');
  window.SelectBubbleExportImport = new SelectBubbleExportImport();
}

console.log('SelectBubbleExportImport 插件加载成功');
