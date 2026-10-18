// 历史数据UI插件 - 独立的弹窗展示模块
class HistoryDataPlugin {
  constructor() {
    this.name = 'HistoryDataPlugin';
    this.floatingWindow = null;
  }

  /**
   * 显示历史数据弹窗
   * @param {string} stockName - 股票名称
   * @param {string} market - 市场
   */
  showPopup(stockName, market) {
    // 获取交易数据和配对缓存
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    
    // 获取该股票的所有交易
    const stockTrades = trades.filter(t => t.stock === stockName && t.market === market);
    
    // 使用历史数据模块获取历史数据
    if (!window.HistoryDataModule) {
      console.error('HistoryDataModule 未加载');
      return;
    }
    
    const historyData = HistoryDataModule.getStockHistoryData(stockTrades, pairingCache, stockName, 0);
    
    // 获取筛选日期
    const filterDateInput = document.getElementById('filterDate');
    const filterDate = filterDateInput ? filterDateInput.value.trim() : '';
    
    // 计算未配对交易的最大/最小价格
    const pairing = pairingCache[stockName] || {};
    const pairedBuyIds = new Set(pairing.pairedBuyIds || []);
    const pairedSellIds = new Set(pairing.pairedSellIds || []);
    const priceExtremes = HistoryDataModule.calculateUnpairedPriceExtremes(stockTrades, pairedBuyIds, pairedSellIds);

    const popupContent = this.generateContent(stockName, market, historyData, priceExtremes, filterDate);
    
    this.floatingWindow = new FloatingWindow({
      title: `${stockName} - 历史数据`,
      sourceFile: 'historyDataPlugin.js',
      width: '94%',
      height: '650px',
      x: '3%',
      y: '3%',
      draggable: false,
      id: 'history-data-popup'
    });

    this.floatingWindow.setContent(popupContent);
    this.floatingWindow.show();
    
    // 绑定事件
    this.bindEvents(stockName, market);
  }

  /**
   * 绑定弹窗内的事件处理
   * @param {string} stockName - 股票名称
   * @param {string} market - 市场
   */
  bindEvents(stockName, market) {
    const popupElement = this.floatingWindow.getElement();
    if (!popupElement) return;

    // 绑定导出 PDF 按钮
    const exportPdfBtn = popupElement.querySelector('#exportPdfBtn');
    if (exportPdfBtn) {
      exportPdfBtn.addEventListener('click', () => {
        this.exportToPDF(stockName);
      });
    }

    // 绑定导出 EXCEL 按钮 → 先弹收件人选择浮层
    const exportExcelBtn = popupElement.querySelector('#exportExcelBtn');
    if (exportExcelBtn) {
      exportExcelBtn.addEventListener('click', () => {
        this.openEmailRecipientDialog(stockName, market);
      });
    }
    
    // 为所有配对气泡添加双击事件
    const allPairBubbles = popupElement.querySelectorAll('.trade-pair');
    allPairBubbles.forEach(pairBubble => {
      pairBubble.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const pairDataStr = pairBubble.dataset.pair;
        const pairStockName = pairBubble.dataset.stockName;
        
        if (pairDataStr && pairStockName) {
          try {
            const pairData = JSON.parse(pairDataStr);
            const tempItem = {
              buy: pairData.buy,
              sell: pairData.sell,
              repTrade: pairData.buy
            };
            
            if (window.showPairDetailWithFloatingWindow && typeof window.showPairDetailWithFloatingWindow === 'function') {
              window.showPairDetailWithFloatingWindow(tempItem, pairStockName);
            }
          } catch (error) {
            console.error('解析配对数据失败:', error);
          }
        }
      });
    });
    
    // 为所有单个气泡添加双击事件
    const allBubbles = popupElement.querySelectorAll('.compact-bubble');
    allBubbles.forEach(bubble => {
      bubble.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        const tradeDataStr = bubble.dataset.trade;
        
        if (tradeDataStr) {
          try {
            const tradeData = JSON.parse(tradeDataStr);
            
            if (window.showTradeDetail && typeof window.showTradeDetail === 'function') {
              window.showTradeDetail(tradeData, 'history');
            }
          } catch (error) {
            console.error('解析交易数据失败:', error);
          }
        }
      });
    });
  }

  /**
   * 导出历史数据为 PDF 文件（包含所有数据，自动分页）
   * @param {string} stockName - 股票名称
   */
  async exportToPDF(stockName) {
    try {
      // 检查必要的库是否加载
      if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
        alert('PDF 导出库未加载，请检查网络连接');
        return;
      }

      const popupElement = this.floatingWindow.getElement();
      if (!popupElement) {
        alert('无法获取导出内容');
        return;
      }

      const contentElement = popupElement.querySelector('.history-data-content');
      if (!contentElement) {
        alert('无法找到要导出的内容');
        return;
      }

      // 显示加载提示
      const exportBtn = popupElement.querySelector('#exportPdfBtn');
      const originalText = exportBtn ? exportBtn.innerHTML : '';
      if (exportBtn) {
        exportBtn.innerHTML = '⏳ 导出中...';
        exportBtn.disabled = true;
      }

      // ===== 关键步骤：临时移除高度和滚动限制，让所有数据都可见 =====
      const historyDataList = contentElement.querySelector('.history-data-list');
      const originalStyles = {};

      if (historyDataList) {
        // 保存原始样式
        originalStyles.maxHeight = historyDataList.style.maxHeight;
        originalStyles.overflow = historyDataList.style.overflow;
        originalStyles.overflowY = historyDataList.style.overflowY;
        
        // 临时移除所有限制，让所有内容展开显示
        historyDataList.style.maxHeight = 'none';
        historyDataList.style.overflow = 'visible';
        historyDataList.style.overflowY = 'visible';
      }

      // 同时确保父容器也没有高度限制
      contentElement.style.height = 'auto';
      
      // 短暂延迟以确保 DOM 更新完成
      await new Promise(resolve => setTimeout(resolve, 100));

      // 使用 html2canvas 捕获完整内容（所有数据都会被捕获）
      const canvas = await html2canvas(contentElement, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        height: contentElement.scrollHeight,
        windowHeight: contentElement.scrollHeight
      });

      // ===== 恢复原始样式 =====
      if (historyDataList) {
        historyDataList.style.maxHeight = originalStyles.maxHeight || '';
        historyDataList.style.overflow = originalStyles.overflow || '';
        historyDataList.style.overflowY = originalStyles.overflowY || '';
      }
      contentElement.style.height = '';

      // 获取 canvas 尺寸（现在包含了所有数据的完整尺寸）
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;

      // ===== A4 纸张尺寸设置（单位：mm）=====
      const a4Width = 210;  // A4 宽度 (mm)
      const a4Height = 297; // A4 高度 (mm)
      const margin = 10;    // 页边距 (mm)
      
      // 计算实际可用区域
      const usableWidth = a4Width - (margin * 2);
      const usableHeight = a4Height - (margin * 2);

      // 计算缩放比例，使内容适应 A4 宽度
      // canvas 是 scale=2 生成的，所以实际像素需要除以2
      const contentWidthPx = imgWidth / 2;
      const contentHeightPx = imgHeight / 2;
      const scale = usableWidth / contentWidthPx; // mm/px
      
      // 计算每页可容纳的内容高度（像素）
      const pageContentHeightPx = usableHeight / scale;

      // 创建 PDF（A4 纵向）
      const pdf = new window.jspdf.jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: [a4Width, a4Height]
      });

      // 转换 canvas 为图片数据
      const imgData = canvas.toDataURL('image/png');
      
      // 生成日期字符串（提前定义，避免作用域问题）
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

      // 计算总页数
      const totalPages = Math.ceil(contentHeightPx / pageContentHeightPx);

      // 分页添加内容
      for (let page = 0; page < totalPages; page++) {
        if (page > 0) {
          pdf.addPage();
        }

        // 计算当前页要截取的区域（像素坐标，基于原始尺寸）
        const sourceY = page * pageContentHeightPx * 2; // 乘以2因为canvas是2倍缩放
        const sourceHeightPx = Math.min(pageContentHeightPx * 2, imgHeight - sourceY);
        
        // 计算当前页在PDF中的显示高度（mm）
        const displayHeight = (sourceHeightPx / 2) * scale;

        // 创建临时 canvas 用于裁剪当前页的内容
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = sourceHeightPx;
        const tempCtx = tempCanvas.getContext('2d');
        
        // 从原 canvas 中裁剪出当前页的内容
        tempCtx.drawImage(
          canvas,
          0, sourceY,              // 源起始位置
          imgWidth, sourceHeightPx, // 源尺寸
          0, 0,                    // 目标起始位置
          imgWidth, sourceHeightPx  // 目标尺寸
        );
        
        // 将裁剪后的 canvas 转换为图片数据
        const pageImgData = tempCanvas.toDataURL('image/png');

        // 在当前页添加图片（使用正确的参数）
        pdf.addImage(
          pageImgData, 
          'PNG', 
          margin, 
          margin, 
          usableWidth, 
          displayHeight
        );

        // 添加页码
        const pageNum = page + 1;
        pdf.setFontSize(9);
        pdf.setTextColor(128, 128, 128);
        pdf.text(
          `第 ${pageNum} 页 / 共 ${totalPages} 页`, 
          a4Width / 2, 
          a4Height - margin / 2, 
          { align: 'center' }
        );
        
        // 添加股票名称和日期作为页眉
        pdf.setFontSize(8);
        pdf.text(
          `${stockName} - 历史数据 (${dateStr})`,
          margin,
          margin / 2
        );
      }

      // 生成文件名（包含股票名称和日期）
      const fileName = `${stockName}_历史数据_完整_${dateStr}.pdf`;

      // 保存 PDF
      pdf.save(fileName);

      // 恢复按钮状态
      if (exportBtn) {
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
      }

      console.log(`PDF 导出成功（包含所有历史数据，共 ${totalPages} 页）: ${fileName}`);
    } catch (error) {
      console.error('PDF 导出失败:', error);
      
      // 恢复样式和按钮状态
      try {
        const popupElement = this.floatingWindow.getElement();
        if (popupElement) {
          const contentElement = popupElement.querySelector('.history-data-content');
          if (contentElement) {
            const historyDataList = contentElement.querySelector('.history-data-list');
            if (historyDataList) {
              historyDataList.style.maxHeight = '';
              historyDataList.style.overflow = '';
              historyDataList.style.overflowY = '';
            }
            contentElement.style.height = '';
          }
          
          const exportBtn = popupElement.querySelector('#exportPdfBtn');
          if (exportBtn) {
            exportBtn.innerHTML = '📄 导出PDF';
            exportBtn.disabled = false;
          }
        }
      } catch (e) {
        console.error('恢复样式失败:', e);
      }
      
      alert('PDF 导出失败: ' + error.message);
    }
  }

  /**
   * 打开发件人选择浮层：支持从常用清单下拉选择或手动输入收件人邮箱，确认后导出 Excel 并发送邮件。
   * 常用清单来自公用邮件服务 GET http://localhost:5003/recipients（data/email-recipients.json）。
   */
  async openEmailRecipientDialog(stockName, market) {
    try {
    // 避免重复打开
    if (document.getElementById('hdEmailOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'hdEmailOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:2147483647;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
      <div id="hdEmailBox" style="background:#fff;border-radius:12px;padding:20px 24px;width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.3);">
        <div style="font-size:16px;font-weight:600;color:#1e293b;margin-bottom:6px;">📧 导出 Excel 并发邮件</div>
        <div style="font-size:12px;color:#64748b;margin-bottom:14px;">股票：${stockName}（${market}）</div>
        <label style="display:block;font-size:13px;color:#334155;margin-bottom:6px;">收件人邮箱</label>
        <div style="position:relative;">
          <input id="hdEmailInput" type="text" placeholder="输入或选择收件人邮箱…" autocomplete="off"
            style="width:100%;padding:10px 12px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;box-sizing:border-box;outline:none;" />
          <div id="hdEmailDropdown" style="position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;max-height:200px;overflow-y:auto;display:none;z-index:1;box-shadow:0 4px 12px rgba(0,0,0,0.1);"></div>
        </div>
        <div style="display:flex;gap:10px;margin-top:16px;justify-content:flex-end;">
          <button id="hdEmailCancel" style="padding:8px 16px;border:1px solid #cbd5e1;background:#fff;border-radius:8px;cursor:pointer;font-size:13px;">取消</button>
          <button id="hdEmailSend" style="padding:8px 16px;border:none;background:#3b82f6;color:#fff;border-radius:8px;cursor:pointer;font-size:13px;">发送</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('#hdEmailInput');
    const dropdown = overlay.querySelector('#hdEmailDropdown');
    const sendBtn = overlay.querySelector('#hdEmailSend');
    const cancelBtn = overlay.querySelector('#hdEmailCancel');
    const box = overlay.querySelector('#hdEmailBox');

    let allRecipients = [];
    try {
      const resp = await fetch('http://localhost:5003/recipients');
      const data = await resp.json();
      allRecipients = Array.isArray(data) ? data : [];
    } catch (e) { console.warn('加载收件人清单失败:', e); }

    const renderDropdown = () => {
      const raw = input.value || '';
      const parts = raw.split(/[,，;]/);
      const token = (parts[parts.length - 1] || '').trim().toLowerCase();
      const match = (email) => {
        const e = email.toLowerCase();
        if (!token) return true;
        if (e.startsWith(token)) return true;
        if ((e.split('@')[0] || '').startsWith(token)) return true;
        if (token.length >= 2) {
          const words = e.split(/[@.\-_]+/);
          if (words.some(w => w.startsWith(token))) return true;
        }
        return false;
      };
      const items = token ? allRecipients.filter(match) : allRecipients.slice();
      dropdown.innerHTML = '';
      if (!items.length) {
        dropdown.innerHTML = '<div style="padding:10px 12px;color:#94a3b8;font-size:13px;">' + (allRecipients.length ? '无匹配收件人' : '暂无常用收件人，可直接输入邮箱') + '</div>';
      } else {
        items.forEach(email => {
          const div = document.createElement('div');
          div.style.cssText = 'padding:8px 12px;cursor:pointer;font-size:13px;color:#334155;';
          div.textContent = email;
          div.addEventListener('mouseenter', () => div.style.background = '#f1f5f9');
          div.addEventListener('mouseleave', () => div.style.background = '');
          div.addEventListener('mousedown', (e) => {
            e.preventDefault();
            input.value = email;
            dropdown.style.display = 'none';
            input.focus();
          });
          dropdown.appendChild(div);
        });
      }
      dropdown.style.display = items.length || allRecipients.length ? 'block' : 'none';
    };

    input.addEventListener('input', renderDropdown);
    input.addEventListener('focus', renderDropdown);
    input.addEventListener('blur', () => setTimeout(() => { dropdown.style.display = 'none'; }, 150));

    const close = () => { overlay.remove(); };
    const send = async () => {
      const recipient = (input.value || '').trim();
      if (!recipient) { input.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
        alert('收件人邮箱格式不正确');
        input.focus();
        return;
      }
      sendBtn.disabled = true;
      sendBtn.textContent = '发送中…';
      overlay.remove();
      await this.doExportAndSendEmail(stockName, market, recipient);
    };

    sendBtn.addEventListener('click', send);
    cancelBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); send(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    input.focus();
    renderDropdown();
    } catch (err) {
      console.error('打开收件人浮层失败:', err);
      alert('打开收件人浮层失败: ' + (err && err.message ? err.message : err));
    }
  }

  /**
   * 导出历史数据为 Excel 文件（.xlsx，含「汇总」与「历史明细」两个工作表，数值列可在 Excel 中直接计算）
   * @param {string} stockName - 股票名称
   * @param {string} market - 市场
   */
  async doExportAndSendEmail(stockName, market, recipient) {
    const popupElement = this.floatingWindow ? this.floatingWindow.getElement() : null;
    const exportBtn = popupElement ? popupElement.querySelector('#exportExcelBtn') : null;
    const originalText = exportBtn ? exportBtn.innerHTML : '';

    try {
      // 检查必要的库是否加载
      if (typeof window.XLSX === 'undefined') {
        alert('Excel 导出库未加载，请检查网络连接');
        return;
      }

      // 显示加载提示
      if (exportBtn) {
        exportBtn.innerHTML = '⏳ 导出中...';
        exportBtn.disabled = true;
      }

      // 获取筛选日期（与弹窗保持一致）
      const filterDateInput = document.getElementById('filterDate');
      const filterDate = filterDateInput ? filterDateInput.value.trim() : '';

      // 与弹窗共用同一份行模型数据
      const { rows, priceExtremes, positionStats } = this.buildHistoryRows(stockName, market, filterDate);

      // ===== Sheet1：历史明细 =====
      // 将每个「交易气泡」（未配对的单独买入/卖出）与「配对气泡」（已配对的买入+卖出组合）展开为一行
      // 配对气泡的日期取买入/卖出中较大的日期；已配对的交易不再作为单独气泡重复出现，避免结余计算重复
      const detailHeader = ['交易日期', '买入交易数量', '买入交易单价', '买入交易金额', '卖出交易数量', '卖出交易单价', '卖出交易金额', '毛利润', '累计结余数量'];

      const flatItems = [];
      rows.forEach(row => {
        // 配对气泡（已配对的买入+卖出组合）
        row.pairs.forEach(pair => {
          const buy = pair.buy;
          const sell = pair.sell;
          const buyTime = buy && buy.createdAt ? new Date(buy.createdAt).getTime() : 0;
          const sellTime = sell && sell.createdAt ? new Date(sell.createdAt).getTime() : 0;
          const timestamp = Math.max(buyTime, sellTime);
          const buyQty = buy ? (parseFloat(buy.qty) || 0) : 0;
          const buyPrice = buy ? (parseFloat(buy.price) || 0) : 0;
          const buyAmount = buyQty * buyPrice;
          const sellQty = sell ? (parseFloat(sell.qty) || 0) : 0;
          const sellPrice = sell ? (parseFloat(sell.price) || 0) : 0;
          const sellAmount = sellQty * sellPrice;
          // 配对日期取买卖中较大的日期
          const pairDate = buy && sell
            ? (buy.date > sell.date ? buy.date : sell.date)
            : (buy ? buy.date : (sell ? sell.date : row.date));
          flatItems.push({
            date: pairDate,
            timestamp,
            buyQty, buyPrice, buyAmount,
            sellQty, sellPrice, sellAmount,
            grossProfit: sellAmount - buyAmount
          });
        });

        // 未配对的单独交易气泡（buildHistoryRows 已排除已配对交易，不会重复计算）
        row.unpaired.forEach(trade => {
          const timestamp = trade.createdAt ? new Date(trade.createdAt).getTime() : 0;
          const qty = parseFloat(trade.qty) || 0;
          const price = parseFloat(trade.price) || 0;
          const amount = qty * price;
          if (trade.side === 'buy') {
            flatItems.push({
              date: trade.date,
              timestamp,
              buyQty: qty, buyPrice: price, buyAmount: amount,
              sellQty: 0, sellPrice: 0, sellAmount: 0,
              grossProfit: 0
            });
          } else {
            flatItems.push({
              date: trade.date,
              timestamp,
              buyQty: 0, buyPrice: 0, buyAmount: 0,
              sellQty: qty, sellPrice: price, sellAmount: amount,
              grossProfit: 0
            });
          }
        });
      });

      // 按交易发生时间正序计算累计结余数量（从最早到最晚累加 买入数量 - 卖出数量）
      flatItems.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.timestamp - b.timestamp;
      });
      let cumulativeQty = 0;
      flatItems.forEach(item => {
        cumulativeQty += item.buyQty - item.sellQty;
        item.cumulativeQty = cumulativeQty;
      });

      // 按交易日期倒序显示（最近的在第一行）
      flatItems.reverse();

      const detailRows = flatItems.map(item => [
        item.date,
        this.roundTo2(item.buyQty),
        this.roundTo2(item.buyPrice),
        this.roundTo2(item.buyAmount),
        this.roundTo2(item.sellQty),
        this.roundTo2(item.sellPrice),
        this.roundTo2(item.sellAmount),
        this.roundTo2(item.grossProfit),
        this.roundTo2(item.cumulativeQty)
      ]);

      const detailSheet = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
      detailSheet['!cols'] = [
        { wch: 12 }, { wch: 13 }, { wch: 13 }, { wch: 14 },
        { wch: 13 }, { wch: 13 }, { wch: 14 }, { wch: 13 }, { wch: 14 }
      ];

      // ===== Sheet2：汇总 =====
      const { long: longStats, short: shortStats } = positionStats;
      // 行模型按日期倒序，首行（最新日期）的累计值即为全周期总计
      const newestRow = rows.length > 0 ? rows[0] : null;
      const formatExtremePrice = (trade) => (trade ? `${trade.price}（${trade.date}）` : '-');
      const summarySheet = XLSX.utils.aoa_to_sheet([
        ['项目', '数值'],
        ['股票名称', `${stockName}（${market}）`],
        ['导出时间', new Date().toLocaleString('zh-CN')],
        ['多头部位', `${longStats.count}笔 / ${longStats.totalQty}股${longStats.avgPrice ? `（平均股价 ${longStats.avgPrice}）` : ''}`],
        ['空头部位', `${shortStats.count}笔 / ${shortStats.totalQty}股${shortStats.avgPrice ? `（平均股价 ${shortStats.avgPrice}）` : ''}`],
        ['买入最高价', formatExtremePrice(priceExtremes.buy.maxTrade)],
        ['买入最低价', formatExtremePrice(priceExtremes.buy.minTrade)],
        ['卖出最高价', formatExtremePrice(priceExtremes.sell.maxTrade)],
        ['卖出最低价', formatExtremePrice(priceExtremes.sell.minTrade)],
        ['累计净利润', newestRow ? this.roundTo2(newestRow.cumulative.netProfit) : 0],
        ['累计结余数量', newestRow ? this.roundTo2(newestRow.cumulative.qty) : 0],
        ['累计结余金额', newestRow ? this.roundTo2(newestRow.cumulative.balance) : 0]
      ]);
      summarySheet['!cols'] = [{ wch: 14 }, { wch: 36 }];

      // ===== 生成并保存文件 =====
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, detailSheet, '历史明细');
      XLSX.utils.book_append_sheet(workbook, summarySheet, '汇总');

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const fileName = `${stockName}_历史数据_${dateStr}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      // 恢复按钮状态
      if (exportBtn) {
        exportBtn.innerHTML = originalText;
        exportBtn.disabled = false;
      }

      console.log(`Excel 导出成功（共 ${flatItems.length} 笔交易）: ${fileName}`);

      // ===== 发送邮件（附带 Excel 附件，复用公用邮件服务）=====
      try {
        const excelArray = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
        const excelBlob = new Blob([excelArray], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });

        const formData = new FormData();
        formData.append('receiver_email', recipient);
        formData.append('subject', `${stockName} 历史数据 - ${dateStr}`);
        formData.append('body',
          `股票：${stockName}（${market}）\n` +
          `导出时间：${new Date().toLocaleString('zh-CN')}\n` +
          `交易笔数：${flatItems.length}\n\n` +
          `附件为历史数据 Excel 文件（含历史明细与汇总两个工作表）。`
        );
        formData.append('attachments', excelBlob, fileName);

        const emailResponse = await fetch('http://localhost:5003/send_email', {
          method: 'POST',
          body: formData
        });
        const emailResult = await emailResponse.json();

        if (emailResult.status === 'success') {
          console.log('邮件发送成功:', emailResult);
          // 将本次收件人追加到常用清单（与 electron-crawler 共用 data/email-recipients.json）
          try {
            await fetch('http://localhost:5003/recipients/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipients: [recipient] })
            });
          } catch (e) { console.warn('追加收件人清单失败:', e); }
          alert(`Excel 导出成功，邮件已发送！\n收件人：${recipient}\n共 ${flatItems.length} 笔交易`);
        } else {
          console.warn('邮件发送失败:', emailResult);
          alert(`Excel 已导出，但邮件发送失败：${emailResult.message || '未知错误'}`);
        }
      } catch (emailError) {
        console.error('邮件发送异常:', emailError);
        alert(`Excel 已导出，但邮件发送失败：${emailError.message}`);
      }
    } catch (error) {
      console.error('Excel 导出失败:', error);

      // 恢复按钮状态
      if (exportBtn) {
        exportBtn.innerHTML = originalText || '📊 导出EXCEL&发邮件';
        exportBtn.disabled = false;
      }

      alert('Excel 导出失败: ' + error.message);
    }
  }

  /**
   * 数值保留 2 位小数（消除浮点计算噪声，便于 Excel 直接计算）
   * @param {number} value - 数值
   * @returns {number} 保留 2 位小数后的数值
   */
  roundTo2(value) {
    return Math.round((parseFloat(value) || 0) * 100) / 100;
  }

  /**
   * 构建历史数据行模型（弹窗渲染与 Excel 导出共用的单一数据源）
   * @param {string} stockName - 股票名称
   * @param {string} market - 市场
   * @param {string} filterDate - 筛选日期
   * @returns {Object} { rows, priceExtremes, positionStats, latestTradeId }
   *   rows: 每日行模型数组（按日期倒序），每行包含：
   *     date       - 交易日期
   *     pairs      - 该日期行的配对交易（买入/卖出，已按交易时间倒序）
   *     unpaired   - 该日期行的未配对交易（已按交易时间倒序）
   *     summary    - 当日汇总 { netQty, netAmount, totalPairedNetProfit, ... }
   *     cumulative - 截至当日的累计值 { qty, balance, netProfit }
   */
  buildHistoryRows(stockName, market, filterDate) {
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};

    // 获取该股票的所有交易
    const stockTrades = trades.filter(t => t.stock === stockName && t.market === market);

    // 获取配对信息
    const pairing = pairingCache[stockName] || {};
    const pairedBuyIds = new Set(pairing.pairedBuyIds || []);
    const pairedSellIds = new Set(pairing.pairedSellIds || []);

    // 计算未配对交易的最大/最小价格
    const priceExtremes = HistoryDataModule.calculateUnpairedPriceExtremes(stockTrades, pairedBuyIds, pairedSellIds);

    // 计算多头/空头部位统计（未配对交易）
    const allUnpairedTrades = stockTrades.filter(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id));
    const positionStats = {
      long: this.calculatePositionStats(allUnpairedTrades.filter(t => t.side === 'buy')),
      short: this.calculatePositionStats(allUnpairedTrades.filter(t => t.side === 'sell'))
    };

    // 在历史数据中显示的交易中找出最新的交易ID（根据创建时间）
    const latestTradeId = HistoryDataModule.findLatestTradeId(stockTrades, stockName);

    // 按日期分组交易
    const tradesByDate = HistoryDataModule.groupTradesByDate(stockTrades);

    // 按日期排序（最近的在前）
    const sortedDates = HistoryDataModule.getSortedDates(tradesByDate, false);

    // ===== 第一遍：筛选有数据的日期，计算每日汇总 =====
    const dateSummaries = {};
    const datePairsByDate = {};
    sortedDates.forEach(date => {
      // 如果没有交易数据，则跳过该日期
      if (!HistoryDataModule.hasTradesForDate(tradesByDate, date, pairing, pairedBuyIds, pairedSellIds)) {
        return;
      }

      // 找出该日期的配对
      const datePairs = [];
      if (pairing.pairedTrades) {
        pairing.pairedTrades.forEach(pair => {
          const pairDate = pair.buy.date > pair.sell.date ? pair.buy.date : pair.sell.date;
          if (pairDate === date) {
            datePairs.push(pair);
          }
        });
      }
      datePairsByDate[date] = datePairs;

      dateSummaries[date] = this.calculateDateSummary(
        stockName,
        market,
        date,
        tradesByDate[date],
        datePairs,
        pairedBuyIds,
        pairedSellIds
      );
    });

    // ===== 倒序累计：结余数量、结余金额、累计净利润 =====
    let cumulativeBalance = 0;
    let cumulativeQty = 0;
    let cumulativeNetProfit = 0;
    const cumulativeByDate = {};
    for (let i = sortedDates.length - 1; i >= 0; i--) {
      const date = sortedDates[i];
      if (!dateSummaries[date]) {
        continue;
      }
      cumulativeBalance += dateSummaries[date].netAmount + dateSummaries[date].totalPairedNetProfit;
      cumulativeQty += dateSummaries[date].netQty;
      cumulativeNetProfit += dateSummaries[date].totalPairedNetProfit;
      cumulativeByDate[date] = {
        qty: cumulativeQty,
        balance: cumulativeBalance,
        netProfit: cumulativeNetProfit
      };
    }

    // ===== 第二遍：组装行模型 =====
    const rows = [];
    sortedDates.forEach(date => {
      if (!dateSummaries[date]) {
        return;
      }

      // 该日期的配对，按交易时间排序（最新的在前）
      const datePairs = [...datePairsByDate[date]].sort((a, b) => {
        const getPairTimestamp = (pair) => {
          const buyTime = pair.buy && pair.buy.createdAt ? new Date(pair.buy.createdAt).getTime() : 0;
          const sellTime = pair.sell && pair.sell.createdAt ? new Date(pair.sell.createdAt).getTime() : 0;
          return Math.max(buyTime, sellTime);
        };
        return getPairTimestamp(b) - getPairTimestamp(a);
      });

      // 该日期的未配对交易，按交易时间排序（最新的在前）
      const dateUnpairedTrades = tradesByDate[date]
        .filter(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id))
        .sort((a, b) => {
          const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bTime - aTime;
        });

      rows.push({
        date,
        pairs: datePairs,
        unpaired: dateUnpairedTrades,
        summary: dateSummaries[date],
        cumulative: cumulativeByDate[date]
      });
    });

    return { rows, priceExtremes, positionStats, latestTradeId };
  }

  /**
   * 计算部位统计（笔数、总数量、加权平均价）
   * @param {Array} trades - 未配对交易数组
   * @returns {Object} { count, totalQty, avgPrice }
   */
  calculatePositionStats(trades) {
    const count = trades.length;
    const totalQty = trades.reduce((sum, t) => sum + (parseInt(t.qty) || 0), 0);
    const avgPrice = count > 0
      ? (trades.reduce((sum, t) => sum + (parseFloat(t.price) || 0) * (parseInt(t.qty) || 0), 0) / totalQty).toFixed(2)
      : null;
    return { count, totalQty, avgPrice };
  }

  /**
   * 生成历史数据弹窗内容
   * @param {string} stockName - 股票名称
   * @param {string} market - 市场
   * @param {Array} historyData - 历史数据（保留参数，暂未使用）
   * @param {Object} priceExtremes - 价格极值信息（保留参数，缺省时使用内部计算值）
   * @param {string} filterDate - 筛选日期
   * @returns {string} HTML内容
   */
  generateContent(stockName, market, historyData, priceExtremes, filterDate) {
    const { rows, priceExtremes: computedPriceExtremes, positionStats, latestTradeId } =
      this.buildHistoryRows(stockName, market, filterDate);
    const extremes = priceExtremes || computedPriceExtremes;

    // 生成价格极值 HTML
    let priceExtremesHtml = '';
    if (extremes && (extremes.buy.minPrice !== null || extremes.buy.maxPrice !== null || extremes.sell.minPrice !== null || extremes.sell.maxPrice !== null)) {
      const { long: longStats, short: shortStats } = positionStats;
      
      priceExtremesHtml = `
        <div class="stock-min-max-container">
          ${extremes.buy.maxPrice !== null && extremes.buy.maxTrade ? `
            <div class="price-bubble">
              <div class="price-date">${extremes.buy.maxTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4')}</div>
              <div class="price-value">${extremes.buy.maxPrice}</div>
            </div>
          ` : ''}
          ${extremes.buy.minPrice !== null && extremes.buy.minTrade ? `
            <div class="price-bubble">
              <div class="price-date">${extremes.buy.minTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4')}</div>
              <div class="price-value">${extremes.buy.minPrice}</div>
            </div>
          ` : ''}
          ${extremes.sell.maxPrice !== null && extremes.sell.maxTrade ? `
            <div class="price-bubble sell">
              <div class="price-date">${extremes.sell.maxTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4')}</div>
              <div class="price-value">-${extremes.sell.maxPrice}</div>
            </div>
          ` : ''}
          ${extremes.sell.minPrice !== null && extremes.sell.minTrade ? `
            <div class="price-bubble sell">
              <div class="price-date">${extremes.sell.minTrade.date.replace(/^(\d{2})(\d{2})-(\d{2})-(\d{2})$/, '$2-$3-$4')}</div>
              <div class="price-value">-${extremes.sell.minPrice}</div>
            </div>
          ` : ''}
          
          <div class="position-stats-container">
            <div class="position-stat-item long">
              <span class="position-label">多头部位</span>
              <div class="position-data">
                <span class="position-value">${longStats.count}笔 / ${longStats.totalQty}股</span>
                ${longStats.avgPrice ? `<span class="position-avg-price">平均股价：${longStats.avgPrice}</span>` : ''}
              </div>
            </div>
            <div class="position-stat-divider"></div>
            <div class="position-stat-item short">
              <span class="position-label">空头部位</span>
              <div class="position-data">
                <span class="position-value">${shortStats.count}笔 / ${shortStats.totalQty}股</span>
                ${shortStats.avgPrice ? `<span class="position-avg-price">平均股价：${shortStats.avgPrice}</span>` : ''}
              </div>
            </div>
          </div>
        </div>
      `;
    }
    
    // 生成历史数据项
    let historyItemsHtml = '';
    rows.forEach(row => {
      const { date, pairs: datePairs, unpaired: dateUnpairedTrades, summary: dateSummary, cumulative } = row;

      const formattedDailyQty = `${dateSummary.netQty >= 0 ? '+' : '-'}${this.formatAmountNoDecimals(Math.abs(dateSummary.netQty || 0))}`;
      const formattedDailyAmount = `${dateSummary.netAmount >= 0 ? '+' : '-'}${this.formatAmountNoDecimals(Math.abs(dateSummary.netAmount || 0))}`;
      const formattedNetProfit = `${dateSummary.totalPairedNetProfit >= 0 ? '+' : '-'}${this.formatAmountNoDecimals(Math.abs(dateSummary.totalPairedNetProfit))}`;
      const formattedCumulativeQty = `${cumulative.qty >= 0 ? '+' : '-'}${this.formatAmountNoDecimals(Math.abs(cumulative.qty || 0))}`;
      const formattedCumulativeBalance = `${cumulative.balance >= 0 ? '+' : '-'}${this.formatAmountNoDecimals(Math.abs(cumulative.balance || 0))}`;
      const formattedCumulativeNetProfit = `${cumulative.netProfit >= 0 ? '+' : '-'}${this.formatAmountNoDecimals(Math.abs(cumulative.netProfit || 0))}`;
      
      // 生成日期容器HTML
      let dateHtml = `
        <div class="history-data-item">
          <div class="history-data-date">${date}</div>
          <div class="history-data-bubbles" style="display: flex; flex-wrap: wrap; gap: 4px; max-width: 600px;">
      `;
      
      // 添加配对气泡
      datePairs.forEach(pair => {
        const isBuyLatest = pair.buy && pair.buy.id === latestTradeId;
        const isSellLatest = pair.sell && pair.sell.id === latestTradeId;
        
        const isBuyToday = pair.buy && pair.buy.date === filterDate;
        const isSellToday = pair.sell && pair.sell.date === filterDate;
        const bothToday = isBuyToday && isSellToday;
        const oneNotToday = !bothToday && (isBuyToday || isSellToday);
        
        // 判断配对气泡中的两个交易是否同一天
        const sameDay = pair.buy && pair.sell && pair.buy.date === pair.sell.date;
        
        let pairClass = 'trade-pair';
        if (bothToday) {
          pairClass += ' both-today';
        } else if (oneNotToday) {
          pairClass += ' one-not-today';
        }
        // 添加边框样式类（同一天配对显示实线，跨天配对显示虚线）
        if (sameDay) {
          pairClass += ' same-day-pair';
        } else {
          pairClass += ' cross-day-pair';
        }
        
        let buyClass = 'compact-bubble buy';
        if (isBuyToday) buyClass += ' today-trade';
        if (isBuyLatest) buyClass += ' latest-trade';
        if (pair.buy && this.isSpecialQty(pair.buy, stockName)) buyClass += ' special-qty';
        // 如果是该日期的气泡（交易日期等于当前行日期标题），添加黑色细实线边框
        if (pair.buy && pair.buy.date === date) {
          buyClass += ' target-date-bubble';
        }
        
        let sellClass = 'compact-bubble sell';
        if (isSellToday) sellClass += ' today-trade';
        if (isSellLatest) sellClass += ' latest-trade';
        if (pair.sell && this.isSpecialQty(pair.sell, stockName)) sellClass += ' special-qty';
        // 如果是该日期的气泡（交易日期等于当前行日期标题），添加黑色细实线边框
        if (pair.sell && pair.sell.date === date) {
          sellClass += ' target-date-bubble';
        }
        
        dateHtml += `
          <div class="${pairClass}" data-pair='${JSON.stringify(pair)}' data-stock-name="${stockName}">
            ${pair.buy ? `<span class="${buyClass}" data-trade='${JSON.stringify(pair.buy)}'>${pair.buy.price}</span>` : ''}
            ${pair.sell ? `<span class="${sellClass}" data-trade='${JSON.stringify(pair.sell)}'>-${pair.sell.price}</span>` : ''}
          </div>
        `;
      });
      
      // 添加未配对气泡
      dateUnpairedTrades.forEach(trade => {
        const isLatest = trade.id === latestTradeId;
        const isToday = trade.date === filterDate;
        
        let bubbleClass = `compact-bubble ${trade.side}`;
        if (isToday) bubbleClass += ' today-trade';
        if (isLatest) bubbleClass += ' latest-trade';
        if (this.isSpecialQty(trade, stockName)) bubbleClass += ' special-qty';
        // 未配对交易的日期一定等于当前行日期，添加黑色细实线边框
        if (trade.date === date) {
          bubbleClass += ' target-date-bubble';
        }
        
        dateHtml += `
          <span class="${bubbleClass}" data-trade='${JSON.stringify(trade)}'>
            ${trade.side === 'sell' ? '-' : ''}${trade.price}
          </span>
        `;
      });
      
      // 关闭日期容器
      dateHtml += `
          </div>
          <div class="history-data-summary" style="margin-top: 6px; padding: 6px 8px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; font-size: 12px; color: #334155; overflow-x: auto;">
            <table style="width:100%; border-collapse: collapse;">
              <tbody>
                <tr>
                  <td style="padding: 6px 8px; text-align: right;">${formattedDailyQty} (${formattedDailyAmount})</td>
                  <td style="padding: 6px 8px; text-align: right;">${formattedNetProfit} (${formattedCumulativeNetProfit})</td>
                  <td style="padding: 6px 8px; text-align: right;">${formattedCumulativeQty} (${formattedCumulativeBalance})</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      `;
      
      historyItemsHtml += dateHtml;
    });
    
    return `
      <div class="history-data-content" style="width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden;">
        <div class="history-data-header" style="flex-shrink: 0;">
          <div class="history-data-title">${stockName}</div>
          <div class="history-data-market">${market}</div>
          <div style="display: flex; gap: 8px; align-items: center;">
            <button id="exportPdfBtn" class="export-pdf-btn" title="导出为PDF">📄 导出PDF</button>
            <button id="exportExcelBtn" class="export-excel-btn" title="导出EXCEL并发送邮件">📊 导出EXCEL&发邮件</button>
          </div>
        </div>
        
        <div style="flex: 1; overflow: auto; min-width: 0;">
          <div style="min-width: fit-content; width: max-content;">
            ${priceExtremesHtml}
            
            <div class="history-data-table-header" style="display: flex; gap: 4px; align-items: center; margin-bottom: 8px; padding: 10px 8px; background: #eef2ff; border: 1px solid #c7d2fe; border-radius: 6px; font-size: 12px; font-weight: 600; color: #374151;">
              <div style="min-width: 85px; flex-shrink: 0; text-align: center;">交易日期</div>
              <div style="flex: 1; min-width: 200px;">交易气泡</div>
              <div style="min-width: 120px; text-align: right; line-height: 1.4;">当日交易数量<br><span style="font-weight: normal; font-size: 11px; color: #6b7280;">(金额)</span></div>
              <div style="min-width: 130px; text-align: right; line-height: 1.4;">当日净利润<br><span style="font-weight: normal; font-size: 11px; color: #6b7280;">(累计净利润)</span></div>
              <div style="min-width: 130px; text-align: right; line-height: 1.4;">累计结余数量<br><span style="font-weight: normal; font-size: 11px; color: #6b7280;">(金额)</span></div>
            </div>
            
            <div class="history-data-list">
              ${historyItemsHtml || `
                <div class="history-data-empty">
                  暂无历史数据
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * 计算指定日期的交易汇总
   * @param {string} stockName - 股票名称
   * @param {string} market - 市场
   * @param {string} targetDate - 目标日期（该日期行）
   * @param {Array} dateTrades - 该日期的所有交易记录
   * @param {Array} datePairs - 显示在该日期行的配对（已按较大日期分配）
   * @param {Set} pairedBuyIds - 已配对的买入ID集合
   * @param {Set} pairedSellIds - 已配对的卖出ID集合
   * @returns {Object} 汇总数据
   */
  calculateDateSummary(stockName, market, targetDate, dateTrades, datePairs, pairedBuyIds, pairedSellIds) {
    let totalBuyAmount = 0;
    let totalSellAmount = 0;
    let totalBuyQty = 0;
    let totalSellQty = 0;

    // 1. 统计未配对交易（独立的未配对气泡）
    //    买入 = +数量/金额, 卖出 = -数量/金额
    //    不考虑 hideable 设置，全部计算！
    (dateTrades || []).forEach(trade => {
      if (pairedBuyIds.has(trade.id) || pairedSellIds.has(trade.id)) return;
      
      const price = parseFloat(trade.price) || 0;
      const qty = parseFloat(trade.qty) || 0;
      const amount = price * qty;
      
      if (trade.side === 'buy') {
        totalBuyAmount += amount;
        totalBuyQty += qty;
      } else if (trade.side === 'sell') {
        totalSellAmount += amount;
        totalSellQty += qty;
      }
    });

    // 2. 统计配对交易（显示在该日期行的配对气泡）
    //    配对中的买入和卖出都应该算入该日期（因为配对显示在这一行）
    //    不考虑 hideable 设置，全部计算！
    (datePairs || []).forEach(pair => {
      if (pair.buy) {
        const buyPrice = parseFloat(pair.buy.price) || 0;
        const buyQty = parseFloat(pair.buy.qty) || 0;
        totalBuyAmount += buyPrice * buyQty;
        totalBuyQty += buyQty;
      }
      
      if (pair.sell) {
        const sellPrice = parseFloat(pair.sell.price) || 0;
        const sellQty = parseFloat(pair.sell.qty) || 0;
        totalSellAmount += sellPrice * sellQty;
        totalSellQty += sellQty;
      }
    });

    // 3. 计算配对净利润
    let totalPairedNetProfit = 0;
    (datePairs || []).forEach(pair => {
      const buyAmount = pair.buy ? (parseFloat(pair.buy.price) || 0) * (parseFloat(pair.buy.qty) || 0) : 0;
      const sellAmount = pair.sell ? (parseFloat(pair.sell.price) || 0) * (parseFloat(pair.sell.qty) || 0) : 0;
      const calculateTax = window.calculateTax || null;
      const buyTax = calculateTax ? calculateTax(stockName, 'buy', buyAmount) : 0;
      const sellTax = calculateTax ? calculateTax(stockName, 'sell', sellAmount) : 0;
      const grossProfit = sellAmount - buyAmount;
      const netProfit = grossProfit - buyTax - sellTax;
      totalPairedNetProfit += netProfit;
    });

    return {
      netAmount: totalBuyAmount - totalSellAmount,
      totalAmount: totalBuyAmount + totalSellAmount,
      totalPairedNetProfit: totalPairedNetProfit,
      netQty: totalBuyQty - totalSellQty,
      totalQty: totalBuyQty + totalSellQty
    };
  }

  /**
   * 格式化金额（无小数位）
   * @param {number} value - 数值
   * @returns {string} 格式化后的字符串
   */
  formatAmountNoDecimals(value) {
    const rounded = Math.round(value || 0);
    return rounded.toLocaleString('en-US');
  }

  /**
   * 判断是否为特殊数量交易
   * @param {Object} trade - 交易对象
   * @param {string} stockName - 股票名称
   * @returns {boolean} 是否特殊数量
   */
  isSpecialQty(trade, stockName) {
    if (!trade || !trade.qty) return false;
    
    const qty = parseInt(trade.qty);
    if (isNaN(qty) || qty <= 0) return false;
    
    // 特殊数量：整百、整千、整万
    if (qty % 10000 === 0 && qty >= 10000) return true;
    if (qty % 1000 === 0 && qty >= 1000) return true;
    if (qty % 100 === 0 && qty >= 500) return true;
    
    return false;
  }
}

// 导出插件
if (typeof window !== 'undefined') {
  window.HistoryDataPlugin = HistoryDataPlugin;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = HistoryDataPlugin;
}
