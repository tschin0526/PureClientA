/**
 * 明细弹窗插件
 * 用于显示柱状图双击后的交易明细
 */
class ChartDetailModal {
  constructor() {
    this.modal = null;
  }

  /**
   * 显示明细弹窗
   * @param {Object} options - 配置选项
   * @param {string} options.type - 类型 (buy/sell)
   * @param {number} options.priceLow - 价格区间下限
   * @param {number} options.priceHigh - 价格区间上限
   * @param {Array} options.trades - 交易数据
   * @param {number} options.decimalPlaces - 小数位数
   */
  show(options) {
    const { type, priceLow, priceHigh, trades, decimalPlaces = 2 } = options;

    if (!trades || trades.length === 0) {
      alert('该价格区间没有未配对交易');
      return;
    }

    // 计算总数量
    let totalQty = 0;
    trades.forEach(t => {
      totalQty += t.qty || 0;
    });

    // 创建弹窗
    this.modal = document.createElement('div');
    this.modal.className = 'chart-detail-modal';
    this.modal.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 9999999;';

    const modalContent = document.createElement('div');
    modalContent.className = 'chart-detail-modal-content';
    modalContent.style.cssText = 'background-color: white; border-radius: 8px; padding: 20px; max-width: 600px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 20px rgba(0,0,0,0.3);';

    // 标题
    const title = document.createElement('div');
    title.className = 'chart-detail-modal-title';
    title.style.cssText = 'font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #374151; border-bottom: 2px solid #e5e7eb; padding-bottom: 10px;';
    title.textContent = `${type === 'buy' ? '买入' : '卖出'}明细（价格区间: ${priceLow.toFixed(decimalPlaces)} - ${priceHigh.toFixed(decimalPlaces)}）`;
    modalContent.appendChild(title);

    // 统计信息
    const stats = document.createElement('div');
    stats.className = 'chart-detail-modal-stats';
    stats.style.cssText = 'display: flex; gap: 20px; margin-bottom: 15px; padding: 10px; background-color: #f9fafb; border-radius: 4px;';
    stats.innerHTML = `
      <span>交易笔数: <strong>${trades.length}</strong> 笔</span>
      <span>总数量: <strong>${totalQty}</strong> 股</span>
    `;
    modalContent.appendChild(stats);

    // 表格
    const table = document.createElement('table');
    table.className = 'chart-detail-modal-table';
    table.style.cssText = 'width: 100%; border-collapse: collapse; margin-bottom: 15px;';

    // 表头
    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr style="background-color: #f3f4f6;">
        <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb; width: 50px;">序号</th>
        <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">日期</th>
        <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">价格</th>
        <th style="padding: 10px; text-align: center; border: 1px solid #e5e7eb;">数量</th>
      </tr>
    `;
    table.appendChild(thead);

    // 表体
    const tbody = document.createElement('tbody');
    trades.forEach((t, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${idx + 1}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${t.date || '-'}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${t.price.toFixed(decimalPlaces)}</td>
        <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${t.qty || 0}</td>
      `;
      tbody.appendChild(row);
    });

    // 总计行
    const totalRow = document.createElement('tr');
    totalRow.className = 'chart-detail-modal-total';
    totalRow.style.cssText = 'background-color: #fef3c7; font-weight: bold;';
    totalRow.innerHTML = `
      <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;" colspan="3">总计</td>
      <td style="padding: 8px; text-align: center; border: 1px solid #e5e7eb;">${totalQty}</td>
    `;
    tbody.appendChild(totalRow);

    table.appendChild(tbody);
    modalContent.appendChild(table);

    // 按钮区域
    const buttonArea = document.createElement('div');
    buttonArea.className = 'chart-detail-modal-buttons';
    buttonArea.style.cssText = 'display: flex; justify-content: center; gap: 10px;';

    // 关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'chart-detail-modal-close-btn';
    closeBtn.textContent = '关闭';
    closeBtn.style.cssText = 'padding: 8px 20px; background-color: #6b7280; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; transition: background-color 0.2s;';
    closeBtn.onmouseover = () => { closeBtn.style.backgroundColor = '#4b5563'; };
    closeBtn.onmouseout = () => { closeBtn.style.backgroundColor = '#6b7280'; };
    closeBtn.onclick = () => this.close();
    buttonArea.appendChild(closeBtn);

    modalContent.appendChild(buttonArea);
    this.modal.appendChild(modalContent);

    // 点击背景关闭
    this.modal.onclick = (e) => {
      if (e.target === this.modal) {
        this.close();
      }
    };

    // ESC键关闭
    this.escHandler = (e) => {
      if (e.key === 'Escape') {
        this.close();
      }
    };
    document.addEventListener('keydown', this.escHandler);

    document.body.appendChild(this.modal);
  }

  /**
   * 关闭弹窗
   */
  close() {
    if (this.modal) {
      document.removeEventListener('keydown', this.escHandler);
      document.body.removeChild(this.modal);
      this.modal = null;
    }
  }
}

// 导出单例
window.chartDetailModal = new ChartDetailModal();
