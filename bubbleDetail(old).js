// bubbleDetail.js - 处理气泡详情相关功能
// 调试输出已禁用（2026-05-09：用户确认调试完毕，移除初始化日志）

// 显示交易详情（使用原生模态框）
function showTradeDetail(trade, source = 'main') {
  if (!trade) {
    alert('交易数据为空');
    return;
  }
  
  try {
    const stockData = STOCKS ? STOCKS.find(s => s.name === trade.stock) : null;
    const type = stockData ? stockData.type : ((trade.market || '未知市场') === '台股' ? 'tA' : 'cETF');
    
    const sideText = trade.side === 'buy' ? '买入' : '卖出';
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    const bubbleDetailModal = document.getElementById('bubbleDetailModal');
    
    if (!modalTitle || !modalBody || !bubbleDetailModal) {
      console.error('找不到模态框元素');
      alert('无法显示交易详情：模态框元素不存在');
      return;
    }
    
    modalTitle.textContent = `${trade.stock}(${trade.qty || 0}, ${type}) - ${sideText}详情`;
    
    // 构建模态框内容
    const bodyContent = `
      <div class="detail-item">
        <span class="detail-label">股票名称：</span>
        <span class="detail-value">${trade.stock}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">交易方向：</span>
        <span class="detail-value ${trade.side === 'buy' ? 'trade-side-buy' : 'trade-side-sell'}">${sideText}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">交易数量：</span>
        <span class="detail-value">${trade.qty || 0}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">交易单价：</span>
        <span class="detail-value ${trade.side === 'buy' ? 'trade-side-buy' : 'trade-side-sell'}">${trade.price}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">交易金额：</span>
        <span class="detail-value">${trade.amount || (trade.qty * trade.price)}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">交易日期：</span>
        <span class="detail-value">${trade.date || ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">输入时间：</span>
        <span class="detail-value">${trade.createdAt ? formatDateTime(trade.createdAt) : ''}</span>
      </div>
      <div class="detail-item">
        <span class="detail-label">交易备注：</span>
        <span class="detail-value">${trade.remark || '无'}</span>
      </div>
    `;
    
    modalBody.innerHTML = bodyContent;
    
    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.justifyContent = 'center';
    buttonContainer.style.alignItems = 'center';
    buttonContainer.style.gap = '20px';
    buttonContainer.style.marginTop = '30px';
    buttonContainer.style.paddingTop = '25px';
    buttonContainer.style.borderTop = '2px solid #f3f4f6';
    
    // 添加关闭按钮
    const closeBtn = document.createElement('button');
    closeBtn.className = 'modal-action-btn close-btn';
    closeBtn.textContent = '关闭';
    closeBtn.style.background = 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)';
    closeBtn.style.color = '#1e293b';
    closeBtn.style.border = 'none';
    closeBtn.style.padding = '0';
    closeBtn.style.borderRadius = '8px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.style.fontSize = '12px';
    closeBtn.style.fontWeight = '600';
    closeBtn.style.letterSpacing = '0.5px';
    closeBtn.style.boxShadow = '0 4px 6px rgba(148, 163, 184, 0.3), 0 2px 4px rgba(148, 163, 184, 0.2)';
    closeBtn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    closeBtn.style.textShadow = 'none';
    closeBtn.style.width = '70px';
    closeBtn.style.height = '24px';
    closeBtn.style.display = 'flex';
    closeBtn.style.alignItems = 'center';
    closeBtn.style.justifyContent = 'center';
    
    closeBtn.addEventListener('mouseenter', () => {
      closeBtn.style.transform = 'translateY(-2px)';
      closeBtn.style.boxShadow = '0 8px 12px rgba(148, 163, 184, 0.4), 0 4px 6px rgba(148, 163, 184, 0.3)';
      closeBtn.style.background = 'linear-gradient(135deg, #cbd5e1 0%, #e2e8f0 100%)';
    });
    
    closeBtn.addEventListener('mouseleave', () => {
      closeBtn.style.transform = 'translateY(0)';
      closeBtn.style.boxShadow = '0 4px 6px rgba(148, 163, 184, 0.3), 0 2px 4px rgba(148, 163, 184, 0.2)';
      closeBtn.style.background = 'linear-gradient(135deg, #94a3b8 0%, #cbd5e1 100%)';
    });
    
    closeBtn.addEventListener('click', () => {
      bubbleDetailModal.style.display = 'none';
    });
    
    // 添加删除按钮
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'modal-action-btn delete-btn';
    deleteBtn.textContent = '删除此交易';
    deleteBtn.style.background = 'linear-gradient(135deg, #fca5a5 0%, #fecaca 100%)';
    deleteBtn.style.color = '#991b1b';
    deleteBtn.style.border = 'none';
    deleteBtn.style.padding = '0';
    deleteBtn.style.borderRadius = '8px';
    deleteBtn.style.cursor = 'pointer';
    deleteBtn.style.fontSize = '12px';
    deleteBtn.style.fontWeight = '600';
    deleteBtn.style.letterSpacing = '0.5px';
    deleteBtn.style.boxShadow = '0 4px 6px rgba(252, 165, 165, 0.3), 0 2px 4px rgba(252, 165, 165, 0.2)';
    deleteBtn.style.transition = 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)';
    deleteBtn.style.textShadow = 'none';
    deleteBtn.style.width = '70px';
    deleteBtn.style.height = '24px';
    deleteBtn.style.display = 'flex';
    deleteBtn.style.alignItems = 'center';
    deleteBtn.style.justifyContent = 'center';
    
    deleteBtn.addEventListener('mouseenter', () => {
      deleteBtn.style.transform = 'translateY(-2px)';
      deleteBtn.style.boxShadow = '0 8px 12px rgba(252, 165, 165, 0.4), 0 4px 6px rgba(252, 165, 165, 0.3)';
      deleteBtn.style.background = 'linear-gradient(135deg, #fecaca 0%, #fee2e2 100%)';
    });
    
    deleteBtn.addEventListener('mouseleave', () => {
      deleteBtn.style.transform = 'translateY(0)';
      deleteBtn.style.boxShadow = '0 4px 6px rgba(252, 165, 165, 0.3), 0 2px 4px rgba(252, 165, 165, 0.2)';
      deleteBtn.style.background = 'linear-gradient(135deg, #fca5a5 0%, #fecaca 100%)';
    });
    
    deleteBtn.addEventListener('click', async () => {
      if (confirm('确定要删除这笔交易吗？此操作不可恢复！')) {
        try {
          await tradesDB.delete(trade.id);
          
          if (typeof loadTrades === 'function') {
            await loadTrades();
          }
          if (typeof applyFilters === 'function') {
            applyFilters();
          }
          
          bubbleDetailModal.style.display = 'none';
          alert('交易已删除');
        } catch (error) {
          console.error('删除交易失败:', error);
          alert('删除交易失败: ' + error.message);
        }
      }
    });
    
    buttonContainer.appendChild(closeBtn);
    buttonContainer.appendChild(deleteBtn);
    modalBody.appendChild(buttonContainer);
    
    // 确保模态框位于所有 FloatingWindow 之上
    try {
      bubbleDetailModal.style.zIndex = '1000001';
      const modalContentEl = bubbleDetailModal.querySelector('.modal-content');
      if (modalContentEl) modalContentEl.style.zIndex = '1000002';
    } catch (err) {
      console.warn('设置 bubbleDetailModal zIndex 时出错', err);
    }

    bubbleDetailModal.style.display = 'block';
    
  } catch (error) {
    console.error('显示交易详情失败:', error);
    alert(`显示交易详情失败: ${error.message}`);
  }
}

// 保存原始函数引用供其他插件调用
window._bubble_showTradeDetail = showTradeDetail;