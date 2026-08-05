class BubbleHideManagerPlugin {
  constructor() {
    this.name = 'BubbleHideManagerPlugin';
    this.floatingWindow = null;
    this.initialized = false;
    this.currentTab = 'unpaired';
    this.currentStockName = null;
    this.pendingTrades = { toHide: [], toUnhide: [] };
    this.viewState = {
      'unpaired-not-hidden': 'bubble',
      'unpaired-hidden': 'bubble',
      'paired-not-hidden': 'bubble',
      'paired-hidden': 'bubble'
    };
    this.sortState = {
      'unpaired-not-hidden': { column: null, direction: 'asc' },
      'unpaired-hidden': { column: null, direction: 'asc' },
      'paired-not-hidden': { column: null, direction: 'asc' },
      'paired-hidden': { column: null, direction: 'asc' }
    };
  }

  init() {
    if (this.initialized) return;

    console.log('气泡屏蔽管理插件初始化中...');

    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化气泡屏蔽管理插件');
      return;
    }
    this.initialized = true;
    console.log('气泡屏蔽管理插件初始化完成');
  }

  openWindow(stockName) {
    if (!this.initialized) this.init();
    this.currentStockName = stockName;

    this.floatingWindow = new FloatingWindow({
      title: `屏蔽气泡管理 - ${stockName}`,
      sourceFile: 'bubbleHideManagerPlugin.js',
      width: '700px',
      height: '750px',
      x: '200px',
      y: '100px',
      draggable: false,
      id: 'bubble-hide-manager-window',
      on: {
        close: () => this.onWindowClose(),
        show: () => this.onWindowShow(),
        hide: () => this.onWindowHide()
      }
    });

    const content = this.generateContent();
    this.floatingWindow.setContent(content);
    this.floatingWindow.show();
    this.bindEvents();
  }

  generateContent() {
    return `
      <style>
        .bubble-hide-manager-content {
          display: flex;
          flex-direction: column;
          height: 700px;
          box-sizing: border-box;
          padding: 5px;
        }
        .tabs {
          flex-shrink: 0;
          margin-bottom: 3px;
        }
        .tab-content {
          flex: 1;
          overflow: hidden;
          margin-bottom: 3px;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .tab-panel {
          flex: 1;
          display: none;
          flex-direction: column;
          min-height: 0;
        }
        .tab-panel.active {
          display: flex;
        }
        .bubble-stats-container {
          display: flex;
          flex-direction: column;
          gap: 5px;
          flex: 1;
          min-height: 0;
        }
        .bubble-stats-box {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 5px;
          padding: 5px;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }
        .bubble-stats-header {
          flex-shrink: 0;
          margin-bottom: 2px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .all-drag-btn {
          padding: 2px 8px;
          border: 1px solid #007bff;
          border-radius: 3px;
          background-color: #e3f2fd;
          color: #007bff;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
        }
        .all-drag-btn:hover {
          background-color: #bbdefb;
        }
        .view-toggle-btn {
          padding: 2px 8px;
          border: 1px solid #6c757d;
          border-radius: 3px;
          background-color: #f8f9fa;
          color: #495057;
          cursor: pointer;
          font-size: 12px;
          font-weight: bold;
          margin-left: 5px;
        }
        .view-toggle-btn:hover {
          background-color: #e2e6ea;
        }
        .bubble-stats-info {
          flex-shrink: 0;
          margin-bottom: 2px;
        }
        .bubble-stats-bubbles {
          flex: 1;
          overflow: auto;
          min-height: 0;
          margin-top: 2px;
        }
        .action-section {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          padding: 5px;
          border: 3px dashed #007bff;
          border-radius: 10px;
          background-color: #f0f8ff;
          box-sizing: border-box;
        }
        .action-section .section-title {
          font-size: 13px;
          font-weight: bold;
          color: #007bff;
          margin-bottom: 3px;
          text-align: center;
        }
        .drop-zone {
          min-height: 50px;
          max-height: 70px;
          border: 2px dashed #6c757d;
          border-radius: 8px;
          padding: 4px;
          background-color: white;
          transition: all 0.3s ease;
          overflow: auto;
        }
        .drop-zone.drag-over {
          border-color: #28a745;
          background-color: #d4edda;
        }
        .drop-zone-placeholder {
          text-align: center;
          color: #6c757d;
          font-size: 12px;
          padding: 10px 0;
        }
        .pending-bubbles {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          justify-content: center;
          align-content: flex-start;
        }
        .pending.to-hide {
          opacity: 0.8;
          border: 2px solid #dc3545 !important;
          cursor: pointer;
        }
        .pending.to-unhide {
          opacity: 0.8;
          border: 2px solid #28a745 !important;
          cursor: pointer;
        }
        .action-buttons {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 5px;
          gap: 5px;
        }
        .pending-stats {
          font-size: 13px;
          font-weight: bold;
          color: #495057;
        }
        .action-btn {
          padding: 8px 16px;
          border: none;
          border-radius: 5px;
          cursor: pointer;
          font-size: 13px;
          font-weight: bold;
        }
        .action-btn.clear {
          background-color: #6c757d;
          color: white;
        }
        .action-btn.execute {
          background-color: #007bff;
          color: white;
        }
        .dragging {
          opacity: 0.5;
        }
        .stats-bubble-row {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-bottom: 8px;
        }
        .stats-bubble-row:last-child {
          margin-bottom: 0;
        }
        .bubble-stats-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12px;
        }
        .bubble-stats-table th,
        .bubble-stats-table td {
          border: 1px solid #ddd;
          padding: 4px;
          text-align: center;
        }
        .bubble-stats-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        .bubble-stats-table tr:hover {
          background-color: #f5f5f5;
        }
        .bubble-stats-table .price-bubble {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 12px;
          font-weight: 900;
          font-size: 12px;
          text-shadow: 0.5px 0 0 currentColor;
          letter-spacing: 0.3px;
        }
        .bubble-stats-table .price-bubble.buy {
          background-color: #bfdbfe;
          color: #ef4444;
          border: 1px solid #93c5fd;
        }
        .bubble-stats-table .price-bubble.sell {
          background-color: #fecaca;
          color: #3b82f6;
          border: 1px solid #fca5a5;
        }
        .bubble-stats-table tr[draggable="true"] {
          cursor: grab;
          transition: background-color 0.2s;
        }
        .bubble-stats-table tr[draggable="true"]:hover {
          background-color: #e3f2fd;
        }
        .bubble-stats-table tr[draggable="true"]:active {
          cursor: grabbing;
        }
        .bubble-stats-table tr.dragging {
          opacity: 0.5;
        }
        .bubble-stats-table th.sortable {
          cursor: pointer;
          user-select: none;
          position: relative;
        }
        .bubble-stats-table th.sortable:hover {
          background-color: #e3f2fd;
        }
      </style>
      <div class="bubble-hide-manager-content">
        <div class="tabs">
          <button class="tab-btn active" data-tab="unpaired">未配对气泡屏蔽管理</button>
          <button class="tab-btn" data-tab="paired">配对气泡屏蔽管理</button>
        </div>

        <div class="tab-content">
          <div class="tab-panel active" id="unpaired-panel">
            <div class="bubble-stats-container">
              <div class="bubble-stats-box">
                <div class="bubble-stats-header">
                  <h4>未屏蔽气泡</h4>
                  <div style="display: flex; align-items: center;">
                    <button class="all-drag-btn" data-action="hide-all" data-type="unpaired">全部拖入</button>
                    <button class="view-toggle-btn" data-view="bubble" data-type="unpaired" data-status="not-hidden">以表格显示</button>
                  </div>
                </div>
                <div class="bubble-stats-info" id="unpaired-not-hidden-stats">
                  加载中...
                </div>
                <div class="bubble-stats-bubbles" id="unpaired-bubbles-container">
                  加载中...
                </div>
              </div>
              <div class="bubble-stats-box">
                <div class="bubble-stats-header">
                  <h4>已屏蔽气泡</h4>
                  <div style="display: flex; align-items: center;">
                    <button class="all-drag-btn" data-action="unhide-all" data-type="unpaired">全部拖入</button>
                    <button class="view-toggle-btn" data-view="bubble" data-type="unpaired" data-status="hidden">以表格显示</button>
                  </div>
                </div>
                <div class="bubble-stats-info" id="unpaired-hidden-stats">
                  加载中...
                </div>
                <div class="bubble-stats-bubbles" id="unpaired-hidden-bubbles-container">
                  加载中...
                </div>
              </div>
            </div>
          </div>

          <div class="tab-panel" id="paired-panel">
            <div class="bubble-stats-container">
              <div class="bubble-stats-box">
                <div class="bubble-stats-header">
                  <h4>未屏蔽气泡</h4>
                  <div style="display: flex; align-items: center;">
                    <button class="all-drag-btn" data-action="hide-all" data-type="paired">全部拖入</button>
                    <button class="view-toggle-btn" data-view="bubble" data-type="paired" data-status="not-hidden">以表格显示</button>
                  </div>
                </div>
                <div class="bubble-stats-info" id="paired-not-hidden-stats">
                  加载中...
                </div>
                <div class="bubble-stats-bubbles" id="paired-bubbles-container">
                  加载中...
                </div>
              </div>
              <div class="bubble-stats-box">
                <div class="bubble-stats-header">
                  <h4>已屏蔽气泡</h4>
                  <div style="display: flex; align-items: center;">
                    <button class="all-drag-btn" data-action="unhide-all" data-type="paired">全部拖入</button>
                    <button class="view-toggle-btn" data-view="bubble" data-type="paired" data-status="hidden">以表格显示</button>
                  </div>
                </div>
                <div class="bubble-stats-info" id="paired-hidden-stats">
                  加载中...
                </div>
                <div class="bubble-stats-bubbles" id="paired-hidden-bubbles-container">
                  加载中...
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="action-section">
          <div class="section-title">屏蔽/撤销屏蔽设定区块</div>
          <div class="drop-zone" id="drop-zone">
            <div class="drop-zone-placeholder">将气泡拖入此处</div>
            <div class="pending-bubbles" id="pending-bubbles-container"></div>
          </div>
          <div class="action-buttons">
            <div class="pending-stats" id="pending-stats"></div>
            <button class="action-btn clear" id="clear-btn">清空</button>
            <button class="action-btn execute" id="execute-btn">确定执行</button>
          </div>
        </div>
      </div>
    `;
  }

  bindTableDragEvents(winEl, container) {
    const tableRows = container.querySelectorAll('tr[draggable="true"]');
    console.log('Found', tableRows.length, 'draggable table rows');
    
    tableRows.forEach(row => {
      row.addEventListener('dragstart', (e) => {
        console.log('Table row dragstart:', row.dataset.tradeId || row.dataset.pairId);
        row.classList.add('dragging');
        
        const priceBubbles = row.querySelectorAll('.price-bubble');
        let html;
        
        if (row.dataset.tradeType === 'unpaired') {
          const priceClass = priceBubbles[0]?.classList.contains('buy') ? 'buy' : 'sell';
          const priceText = priceBubbles[0]?.textContent || '';
          html = `<div class="stats-bubble ${priceClass}" data-trade-id="${row.dataset.tradeId}" data-trade-type="${row.dataset.tradeType}" data-action="${row.dataset.action}">${priceText}</div>`;
        } else {
          html = `<div class="trade-pair" data-pair-id="${row.dataset.pairId}" data-trade-type="${row.dataset.tradeType}" data-action="${row.dataset.action}">`;
          priceBubbles.forEach(bubble => {
            html += bubble.outerHTML;
          });
          html += '</div>';
        }
        
        const data = {
          id: row.dataset.tradeId || row.dataset.pairId,
          type: row.dataset.tradeType,
          action: row.dataset.action,
          html: html
        };
        
        console.log('Setting drag data from table row:', data);
        e.dataTransfer.setData('text/plain', JSON.stringify(data));
        e.dataTransfer.effectAllowed = 'move';
      });
      
      row.addEventListener('dragend', (e) => {
        console.log('Table row dragend');
        row.classList.remove('dragging');
      });
    });
  }

  bindTableSortEvents(winEl, container, stateKey) {
    const sortableHeaders = container.querySelectorAll('th.sortable');
    console.log('Found', sortableHeaders.length, 'sortable headers');
    
    sortableHeaders.forEach(header => {
      header.style.cursor = 'pointer';
      header.style.userSelect = 'none';
      
      header.addEventListener('click', () => {
        const column = header.dataset.column;
        const currentSort = this.sortState[stateKey];
        
        if (currentSort.column === column) {
          currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.column = column;
          currentSort.direction = 'asc';
        }
        
        console.log('Sort changed:', stateKey, currentSort.column, currentSort.direction);
        this.updateStats(winEl);
      });
    });
  }

  bindEvents() {
    try {
      const winEl = this.floatingWindow.getElement();
      if (!winEl) return;

      this.updateStats(winEl);

      const tabBtns = winEl.querySelectorAll('.tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const tab = btn.dataset.tab;
          this.switchTab(tab, winEl);
        });
      });

      const dropZone = winEl.querySelector('#drop-zone');
      
      winEl.addEventListener('dragstart', (e) => {
        const target = e.target;
        const isBubble = target.classList.contains('stats-bubble') || target.classList.contains('trade-pair');
        const isTableRow = target.tagName === 'TR' && target.hasAttribute('draggable');
        
        console.log('dragstart event:', target.tagName, isBubble, isTableRow);
        
        if (isBubble || isTableRow) {
          e.target.classList.add('dragging');
          
          let html;
          if (isTableRow) {
            const priceBubbles = target.querySelectorAll('.price-bubble');
            if (target.dataset.tradeType === 'unpaired') {
              const priceClass = priceBubbles[0]?.classList.contains('buy') ? 'buy' : 'sell';
              const priceText = priceBubbles[0]?.textContent || '';
              html = `<div class="stats-bubble ${priceClass}" data-trade-id="${target.dataset.tradeId}" data-trade-type="${target.dataset.tradeType}" data-action="${target.dataset.action}">${priceText}</div>`;
            } else {
              html = `<div class="trade-pair" data-pair-id="${target.dataset.pairId}" data-trade-type="${target.dataset.tradeType}" data-action="${target.dataset.action}">`;
              priceBubbles.forEach(bubble => {
                html += bubble.outerHTML;
              });
              html += '</div>';
            }
          } else {
            html = target.outerHTML;
          }
          
          const data = {
            id: target.dataset.tradeId || target.dataset.pairId,
            type: target.dataset.tradeType,
            action: target.dataset.action,
            html: html
          };
          
          console.log('Setting drag data:', data);
          e.dataTransfer.setData('text/plain', JSON.stringify(data));
          e.dataTransfer.effectAllowed = 'move';
        }
      });

      winEl.addEventListener('dragend', (e) => {
        const isBubble = e.target.classList.contains('stats-bubble') || e.target.classList.contains('trade-pair');
        const isTableRow = e.target.tagName === 'TR' && e.target.hasAttribute('draggable');
        
        if (isBubble || isTableRow) {
          e.target.classList.remove('dragging');
        }
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        
        try {
          const rawData = e.dataTransfer.getData('text/plain');
          console.log('Raw drag data:', rawData);
          
          const data = JSON.parse(rawData);
          console.log('Parsed drag data:', data);
          
          this.addToPending(winEl, data);
        } catch (err) {
          console.error('解析拖拽数据失败', err);
        }
      });

      winEl.querySelector('#clear-btn').addEventListener('click', () => {
        this.clearPending(winEl);
      });

      winEl.querySelector('#execute-btn').addEventListener('click', () => {
        this.executeActions(winEl);
      });

      // 绑定全部拖入按钮事件
      const allDragBtns = winEl.querySelectorAll('.all-drag-btn');
      allDragBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const action = btn.dataset.action;
          const type = btn.dataset.type;
          this.handleAllDrag(winEl, action, type);
        });
      });

      // 绑定视图切换按钮事件
      const viewToggleBtns = winEl.querySelectorAll('.view-toggle-btn');
      viewToggleBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const currentView = btn.dataset.view;
          const newView = currentView === 'bubble' ? 'table' : 'bubble';
          btn.dataset.view = newView;
          btn.textContent = newView === 'bubble' ? '以表格显示' : '以气泡显示';
          
          const type = btn.dataset.type;
          const status = btn.dataset.status;
          const key = `${type}-${status}`;
          this.viewState[key] = newView;
          
          this.updateStats(winEl);
        });
      });

    } catch (err) {
      console.error('绑定事件失败', err);
    }
  }

  addToPending(winEl, data) {
    const existingHide = this.pendingTrades.toHide.find(t => t.id === data.id);
    const existingUnhide = this.pendingTrades.toUnhide.find(t => t.id === data.id);
    
    if (existingHide || existingUnhide) {
      return;
    }

    if (data.action === 'hide') {
      this.pendingTrades.toHide.push(data);
    } else {
      this.pendingTrades.toUnhide.push(data);
    }

    this.updatePendingDisplay(winEl);
  }

  updatePendingDisplay(winEl) {
    const container = winEl.querySelector('#pending-bubbles-container');
    const statsEl = winEl.querySelector('#pending-stats');
    const placeholder = winEl.querySelector('.drop-zone-placeholder');

    container.innerHTML = '';
    
    this.pendingTrades.toHide.forEach(data => {
      const div = document.createElement('div');
      div.innerHTML = data.html;
      const el = div.firstChild;
      el.classList.add('pending', 'to-hide');
      el.removeAttribute('draggable');
      el.addEventListener('click', () => this.removeFromPending(winEl, data.id, 'hide'));
      container.appendChild(el);
    });

    this.pendingTrades.toUnhide.forEach(data => {
      const div = document.createElement('div');
      div.innerHTML = data.html;
      const el = div.firstChild;
      el.classList.add('pending', 'to-unhide');
      el.removeAttribute('draggable');
      el.addEventListener('click', () => this.removeFromPending(winEl, data.id, 'unhide'));
      container.appendChild(el);
    });

    if (this.pendingTrades.toHide.length + this.pendingTrades.toUnhide.length > 0) {
      placeholder.style.display = 'none';
    } else {
      placeholder.style.display = 'block';
    }

    statsEl.innerHTML = `待屏蔽: ${this.pendingTrades.toHide.length} | 待撤销: ${this.pendingTrades.toUnhide.length}`;
  }

  removeFromPending(winEl, id, action) {
    if (action === 'hide') {
      this.pendingTrades.toHide = this.pendingTrades.toHide.filter(t => t.id !== id);
    } else {
      this.pendingTrades.toUnhide = this.pendingTrades.toUnhide.filter(t => t.id !== id);
    }
    this.updatePendingDisplay(winEl);
  }

  clearPending(winEl) {
    this.pendingTrades = { toHide: [], toUnhide: [] };
    this.updatePendingDisplay(winEl);
  }

  handleAllDrag(winEl, action, type) {
    try {
      const trades = window.trades || [];
      const pairingCache = window.pairingCache || {};
      const stockPairing = pairingCache[this.currentStockName] || {};
      
      if (action === 'hide-all') {
        if (type === 'unpaired') {
          // 未配对气泡的未屏蔽列表
          const unpairedTrades = this.getUnpairedTrades();
          const notHiddenTrades = unpairedTrades.filter(t => t.hideable !== 'Y');
          
          notHiddenTrades.forEach(trade => {
            const data = {
              id: trade.id,
              type: 'unpaired',
              action: 'hide',
              html: `<div class="stats-bubble ${trade.side}" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="hide">${trade.side === 'buy' ? trade.price.toFixed(2) : '-' + trade.price.toFixed(2)}</div>`
            };
            this.addToPending(winEl, data);
          });
        } else {
          // 配对气泡的未屏蔽列表
          const pairedTrades = stockPairing.pairedTrades || [];
          const notHiddenPairs = pairedTrades.filter(p => p.hideable !== 'Y');
          
          notHiddenPairs.forEach(pair => {
            const pairId = pair.buy ? pair.buy.id : (pair.sell ? pair.sell.id : '');
            let html = `<div class="trade-pair" data-pair-id="${pairId}" data-trade-type="paired" data-action="hide">`;
            if (pair.buy) {
              html += `<span class="price-bubble buy">${pair.buy.price.toFixed(2)}</span>`;
            }
            if (pair.sell) {
              html += `<span class="price-bubble sell">-${pair.sell.price.toFixed(2)}</span>`;
            }
            html += '</div>';
            
            const data = {
              id: pairId,
              type: 'paired',
              action: 'hide',
              html: html
            };
            this.addToPending(winEl, data);
          });
        }
      } else if (action === 'unhide-all') {
        if (type === 'unpaired') {
          // 未配对气泡的已屏蔽列表
          const unpairedTrades = this.getUnpairedTrades();
          const hiddenTrades = unpairedTrades.filter(t => t.hideable === 'Y');
          
          hiddenTrades.forEach(trade => {
            const data = {
              id: trade.id,
              type: 'unpaired',
              action: 'unhide',
              html: `<div class="stats-bubble ${trade.side}" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="unhide">${trade.side === 'buy' ? trade.price.toFixed(2) : '-' + trade.price.toFixed(2)}</div>`
            };
            this.addToPending(winEl, data);
          });
        } else {
          // 配对气泡的已屏蔽列表
          const pairedTrades = stockPairing.pairedTrades || [];
          const hiddenPairs = pairedTrades.filter(p => p.hideable === 'Y');
          
          hiddenPairs.forEach(pair => {
            const pairId = pair.buy ? pair.buy.id : (pair.sell ? pair.sell.id : '');
            let html = `<div class="trade-pair" data-pair-id="${pairId}" data-trade-type="paired" data-action="unhide">`;
            if (pair.buy) {
              html += `<span class="price-bubble buy">${pair.buy.price.toFixed(2)}</span>`;
            }
            if (pair.sell) {
              html += `<span class="price-bubble sell">-${pair.sell.price.toFixed(2)}</span>`;
            }
            html += '</div>';
            
            const data = {
              id: pairId,
              type: 'paired',
              action: 'unhide',
              html: html
            };
            this.addToPending(winEl, data);
          });
        }
      }
    } catch (err) {
      console.error('处理全部拖入失败', err);
    }
  }

  async executeActions(winEl) {
    try {
      console.log('开始执行操作...');
      const toHideCount = this.pendingTrades.toHide.length;
      const toUnhideCount = this.pendingTrades.toUnhide.length;

      if (toHideCount + toUnhideCount === 0) {
        alert('没有待执行的操作');
        return;
      }

      const confirmMsg = `确定要执行吗？\n- 屏蔽 ${toHideCount} 个气泡\n- 撤销屏蔽 ${toUnhideCount} 个气泡`;
      if (!confirm(confirmMsg)) {
        return;
      }

      const trades = window.trades || [];
      const pairingCache = window.pairingCache || {};
      const stockPairing = pairingCache[this.currentStockName] || {};

      console.log('交易数据长度:', trades.length);
      console.log('配对缓存:', pairingCache);
      console.log('当前股票配对:', stockPairing);

      const tradesToUpdate = [];

      // 处理待屏蔽的气泡
      this.pendingTrades.toHide.forEach(data => {
        console.log('处理待屏蔽气泡:', data);
        if (data.type === 'unpaired') {
          const trade = trades.find(t => t.id === data.id);
          if (trade) {
            tradesToUpdate.push(trade);
            trade.hideable = 'Y';
            console.log('已标记为屏蔽:', trade);
          } else {
            console.warn('未找到交易:', data.id);
          }
        } else {
          // 处理配对气泡
          const pair = (stockPairing.pairedTrades || []).find(p => {
            const pairId = p.buy ? p.buy.id : (p.sell ? p.sell.id : '');
            return pairId === data.id;
          });
          if (pair) {
            pair.hideable = 'Y';
            console.log('已标记配对为屏蔽:', pair);
            if (pair.buy) {
              const trade = trades.find(t => t.id === pair.buy.id);
              if (trade) {
                tradesToUpdate.push(trade);
                trade.hideable = 'Y';
                console.log('已标记买入交易为屏蔽:', trade);
              } else {
                console.warn('未找到买入交易:', pair.buy.id);
              }
            }
            if (pair.sell) {
              const trade = trades.find(t => t.id === pair.sell.id);
              if (trade) {
                tradesToUpdate.push(trade);
                trade.hideable = 'Y';
                console.log('已标记卖出交易为屏蔽:', trade);
              } else {
                console.warn('未找到卖出交易:', pair.sell.id);
              }
            }
          } else {
            console.warn('未找到配对:', data.id);
          }
        }
      });

      // 处理待撤销屏蔽的气泡
      this.pendingTrades.toUnhide.forEach(data => {
        console.log('处理待撤销屏蔽气泡:', data);
        if (data.type === 'unpaired') {
          const trade = trades.find(t => t.id === data.id);
          if (trade) {
            tradesToUpdate.push(trade);
            trade.hideable = 'N';
            console.log('已标记为撤销屏蔽:', trade);
          } else {
            console.warn('未找到交易:', data.id);
          }
        } else {
          // 处理配对气泡
          const pair = (stockPairing.pairedTrades || []).find(p => {
            const pairId = p.buy ? p.buy.id : (p.sell ? p.sell.id : '');
            return pairId === data.id;
          });
          if (pair) {
            pair.hideable = 'N';
            console.log('已标记配对为撤销屏蔽:', pair);
            if (pair.buy) {
              const trade = trades.find(t => t.id === pair.buy.id);
              if (trade) {
                tradesToUpdate.push(trade);
                trade.hideable = 'N';
                console.log('已标记买入交易为撤销屏蔽:', trade);
              } else {
                console.warn('未找到买入交易:', pair.buy.id);
              }
            }
            if (pair.sell) {
              const trade = trades.find(t => t.id === pair.sell.id);
              if (trade) {
                tradesToUpdate.push(trade);
                trade.hideable = 'N';
                console.log('已标记卖出交易为撤销屏蔽:', trade);
              } else {
                console.warn('未找到卖出交易:', pair.sell.id);
              }
            }
          } else {
            console.warn('未找到配对:', data.id);
          }
        }
      });

      // 保存交易数据
      if (tradesToUpdate.length > 0) {
        console.log('更新交易数据:', tradesToUpdate.length, '条');
        await this.updateTrades(tradesToUpdate);
      }

      // 保存配对信息
      if (stockPairing) {
        pairingCache[this.currentStockName] = stockPairing;
        console.log('保存配对信息:', stockPairing);
        
        // 确保 stockPairing 有 stockName 属性
        if (!stockPairing.stockName) {
          stockPairing.stockName = this.currentStockName;
          console.log('添加 stockName 属性:', this.currentStockName);
        }
        
        // 直接调用 tradesDB.savePairing 保存配对信息
        if (window.tradesDB) {
          console.log('tradesDB 存在');
          if (window.tradesDB.savePairing) {
            console.log('准备保存配对信息到数据库');
            try {
              await window.tradesDB.savePairing(stockPairing);
              console.log('配对信息已保存到数据库');
            } catch (saveError) {
              console.error('保存配对信息失败:', saveError);
              // 继续执行，不中断整个操作
            }
          } else {
            console.warn('tradesDB.savePairing 方法不存在');
          }
        } else {
          console.warn('tradesDB 不存在');
        }
      }

      // 完成操作
      this.clearPending(winEl);
      this.updateStats(winEl);
      alert(`执行完成！\n- 屏蔽 ${toHideCount} 个气泡\n- 撤销屏蔽 ${toUnhideCount} 个气泡`);
      console.log('操作执行完成');
    } catch (error) {
      console.error('执行操作失败:', error);
      console.error('错误堆栈:', error.stack);
      alert('执行操作失败，请检查控制台日志');
    }
  }

  switchTab(tab, winEl) {
    this.currentTab = tab;
    winEl.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    winEl.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === `${tab}-panel`);
    });
    this.updateStats(winEl);
  }

  getUnpairedTrades() {
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    const pairedIds = new Set();

    const stockPairing = pairingCache[this.currentStockName] || {};
    (stockPairing.pairedBuyIds || []).forEach(id => pairedIds.add(id));
    (stockPairing.pairedSellIds || []).forEach(id => pairedIds.add(id));

    return trades.filter(t => t.stock === this.currentStockName && !pairedIds.has(t.id));
  }

  getPairedTrades() {
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    const pairedIds = new Set();

    const stockPairing = pairingCache[this.currentStockName] || {};
    (stockPairing.pairedBuyIds || []).forEach(id => pairedIds.add(id));
    (stockPairing.pairedSellIds || []).forEach(id => pairedIds.add(id));

    return trades.filter(t => t.stock === this.currentStockName && pairedIds.has(t.id));
  }

  async updateTrades(trades) {
    if (!window.tradesDB || !window.tradesDB.save) {
      alert('数据库不可用');
      return 0;
    }

    const promises = trades.map(async trade => {
      return window.tradesDB.save(trade);
    });

    await Promise.all(promises);

    if (window.loadTrades && typeof window.loadTrades === 'function') {
      await window.loadTrades();
    }
    if (window.applyFilters && typeof window.applyFilters === 'function') {
      await window.applyFilters();
    }

    return trades.length;
  }



  hideWindow() {
    if (this.floatingWindow) {
      this.floatingWindow.hide();
      this.floatingWindow.destroy();
      this.floatingWindow = null;
    }
  }

  onWindowClose() {
    console.log('气泡屏蔽管理窗口已关闭');
    // 刷新调用程序的画面
    if (window.loadTrades && typeof window.loadTrades === 'function') {
      window.loadTrades().then(async () => {
        // 应用筛选条件
        if (window.applyFilters && typeof window.applyFilters === 'function') {
          await window.applyFilters();
        }
        // 刷新气泡视图
        if (window.renderBubbleView && typeof window.renderBubbleView === 'function') {
          window.renderBubbleView();
        }
        // 跳转到当前股票的位置（用setTimeout确保DOM已稳定）
        setTimeout(() => {
          if (this.currentStockName && window.jumpToStock) {
            window.jumpToStock(this.currentStockName);
          }
        }, 200);
      });
    } else {
      // 如果没有loadTrades函数，直接跳转到原来的股票位置
      setTimeout(() => {
        if (this.currentStockName && window.jumpToStock) {
          window.jumpToStock(this.currentStockName);
        }
      }, 200);
    }
  }

  onWindowShow() {
    console.log('气泡屏蔽管理窗口已显示');
  }

  onWindowHide() {
    console.log('气泡屏蔽管理窗口已隐藏');
  }

  updateStats(winEl) {
    const trades = window.trades || [];
    const pairingCache = window.pairingCache || {};
    const stockPairing = pairingCache[this.currentStockName] || {};
    
    const stockTrades = trades.filter(t => t.stock === this.currentStockName);
    
    const pairedTrades = stockPairing.pairedTrades || [];
    const pairedBuyIds = new Set(stockPairing.pairedBuyIds || []);
    const pairedSellIds = new Set(stockPairing.pairedSellIds || []);
    
    const unpairedTrades = stockTrades.filter(t => !pairedBuyIds.has(t.id) && !pairedSellIds.has(t.id));

    const unpairedNotHidden = unpairedTrades.filter(t => t.hideable !== 'Y');
    const unpairedHidden = unpairedTrades.filter(t => t.hideable === 'Y');
    
    const pairedNotHidden = pairedTrades.filter(p => p.hideable !== 'Y');
    const pairedHidden = pairedTrades.filter(p => p.hideable === 'Y');

    const unpairedNotHiddenEl = winEl.querySelector('#unpaired-not-hidden-stats');
    const unpairedHiddenEl = winEl.querySelector('#unpaired-hidden-stats');
    const pairedNotHiddenEl = winEl.querySelector('#paired-not-hidden-stats');
    const pairedHiddenEl = winEl.querySelector('#paired-hidden-stats');

    const unpairedBubblesContainer = winEl.querySelector('#unpaired-bubbles-container');
    const unpairedHiddenBubblesContainer = winEl.querySelector('#unpaired-hidden-bubbles-container');
    const pairedBubblesContainer = winEl.querySelector('#paired-bubbles-container');
    const pairedHiddenBubblesContainer = winEl.querySelector('#paired-hidden-bubbles-container');

    // 格式化日期时间
    function formatDateTime(dateTimeStr) {
      if (!dateTimeStr) return '';
      const date = new Date(dateTimeStr);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }

    // 排序未配对交易
    function sortUnpairedTrades(trades, column, direction) {
      const sorted = [...trades];
      sorted.sort((a, b) => {
        let valA, valB;
        
        switch (column) {
          case 'price':
            valA = a.price;
            valB = b.price;
            break;
          case 'qty':
            valA = a.qty;
            valB = b.qty;
            break;
          case 'amount':
            valA = a.price * a.qty;
            valB = b.price * b.qty;
            break;
          case 'date':
            valA = a.date || '';
            valB = b.date || '';
            break;
          case 'createdAt':
            valA = new Date(a.createdAt || 0).getTime();
            valB = new Date(b.createdAt || 0).getTime();
            break;
          case 'remark':
            valA = a.remark || '';
            valB = b.remark || '';
            break;
          default:
            return 0;
        }
        
        if (typeof valA === 'string') {
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return direction === 'asc' ? valA - valB : valB - valA;
      });
      
      return sorted;
    }

    // 排序配对交易
    function sortPairedTrades(pairs, column, direction) {
      const sorted = [...pairs];
      sorted.sort((a, b) => {
        let valA, valB;
        
        switch (column) {
          case 'buyPrice':
            valA = a.buy ? a.buy.price : 0;
            valB = b.buy ? b.buy.price : 0;
            break;
          case 'sellPrice':
            valA = a.sell ? a.sell.price : 0;
            valB = b.sell ? b.sell.price : 0;
            break;
          case 'qty':
            valA = a.buy ? a.buy.qty : (a.sell ? a.sell.qty : 0);
            valB = b.buy ? b.buy.qty : (b.sell ? b.sell.qty : 0);
            break;
          case 'buyAmount':
            valA = a.buy ? a.buy.price * a.buy.qty : 0;
            valB = b.buy ? b.buy.price * b.buy.qty : 0;
            break;
          case 'sellAmount':
            valA = a.sell ? a.sell.price * a.sell.qty : 0;
            valB = b.sell ? b.sell.price * b.sell.qty : 0;
            break;
          case 'buyDate':
            valA = a.buy ? a.buy.date || '' : '';
            valB = b.buy ? b.buy.date || '' : '';
            break;
          case 'sellDate':
            valA = a.sell ? a.sell.date || '' : '';
            valB = b.sell ? b.sell.date || '' : '';
            break;
          case 'createdAt':
            valA = new Date(a.buy ? a.buy.createdAt : (a.sell ? a.sell.createdAt : 0)).getTime();
            valB = new Date(b.buy ? b.buy.createdAt : (b.sell ? b.sell.createdAt : 0)).getTime();
            break;
          case 'remark':
            valA = a.buy ? a.buy.remark || '' : (a.sell ? a.sell.remark || '' : '');
            valB = b.buy ? b.buy.remark || '' : (b.sell ? b.sell.remark || '' : '');
            break;
          default:
            return 0;
        }
        
        if (typeof valA === 'string') {
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return direction === 'asc' ? valA - valB : valB - valA;
      });
      
      return sorted;
    }

    // 生成未配对气泡的表格视图
    function generateUnpairedTable(trades, action, sortColumn, sortDirection) {
      console.log('Generating unpaired table with', trades.length, 'trades, action:', action);
      
      const sortIndicator = (col) => {
        if (sortColumn === col) {
          return sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
      };
      
      let tableHtml = '<table class="bubble-stats-table">';
      tableHtml += '<thead><tr>';
      tableHtml += `<th class="sortable" data-column="price">单价${sortIndicator('price')}</th>`;
      tableHtml += `<th class="sortable" data-column="qty">数量${sortIndicator('qty')}</th>`;
      tableHtml += `<th class="sortable" data-column="amount">金额${sortIndicator('amount')}</th>`;
      tableHtml += `<th class="sortable" data-column="date">日期${sortIndicator('date')}</th>`;
      tableHtml += `<th class="sortable" data-column="createdAt">输入时间${sortIndicator('createdAt')}</th>`;
      tableHtml += `<th class="sortable" data-column="remark">备注${sortIndicator('remark')}</th>`;
      tableHtml += '</tr></thead>';
      tableHtml += '<tbody>';
      
      trades.forEach(trade => {
        const price = trade.side === 'sell' ? -trade.price : trade.price;
        const priceClass = trade.side === 'buy' ? 'buy' : 'sell';
        const amount = trade.price * trade.qty;
        tableHtml += `<tr draggable="true" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="${action}">
          <td><span class="price-bubble ${priceClass}">${price.toFixed(2)}</span></td>
          <td>${trade.qty}</td>
          <td>${amount.toLocaleString()}</td>
          <td>${trade.date || ''}</td>
          <td>${formatDateTime(trade.createdAt)}</td>
          <td>${trade.remark || ''}</td>
        </tr>`;
      });
      
      tableHtml += '</tbody></table>';
      console.log('Generated table HTML length:', tableHtml.length);
      return tableHtml;
    }

    // 生成配对气泡的表格视图
    function generatePairedTable(pairs, action, sortColumn, sortDirection) {
      const sortIndicator = (col) => {
        if (sortColumn === col) {
          return sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
      };
      
      let tableHtml = '<table class="bubble-stats-table">';
      tableHtml += '<thead><tr>';
      tableHtml += `<th class="sortable" data-column="buyPrice">买入单价${sortIndicator('buyPrice')}</th>`;
      tableHtml += `<th class="sortable" data-column="sellPrice">卖出单价${sortIndicator('sellPrice')}</th>`;
      tableHtml += `<th class="sortable" data-column="qty">数量${sortIndicator('qty')}</th>`;
      tableHtml += `<th class="sortable" data-column="buyAmount">买入金额${sortIndicator('buyAmount')}</th>`;
      tableHtml += `<th class="sortable" data-column="sellAmount">卖出金额${sortIndicator('sellAmount')}</th>`;
      tableHtml += `<th class="sortable" data-column="buyDate">买入日期${sortIndicator('buyDate')}</th>`;
      tableHtml += `<th class="sortable" data-column="sellDate">卖出日期${sortIndicator('sellDate')}</th>`;
      tableHtml += `<th class="sortable" data-column="createdAt">输入时间${sortIndicator('createdAt')}</th>`;
      tableHtml += `<th class="sortable" data-column="remark">备注${sortIndicator('remark')}</th>`;
      tableHtml += '</tr></thead>';
      tableHtml += '<tbody>';
      
      pairs.forEach(pair => {
        const pairId = pair.buy ? pair.buy.id : (pair.sell ? pair.sell.id : '');
        const buyPrice = pair.buy ? pair.buy.price : '';
        const sellPrice = pair.sell ? -pair.sell.price : '';
        const qty = pair.buy ? pair.buy.qty : (pair.sell ? pair.sell.qty : '');
        const buyAmount = pair.buy ? (pair.buy.price * pair.buy.qty) : '';
        const sellAmount = pair.sell ? (pair.sell.price * pair.sell.qty) : '';
        const buyDate = pair.buy ? pair.buy.date : '';
        const sellDate = pair.sell ? pair.sell.date : '';
        const createdAt = pair.buy ? pair.buy.createdAt : (pair.sell ? pair.sell.createdAt : '');
        const remark = pair.buy ? pair.buy.remark : (pair.sell ? pair.sell.remark : '');
        
        tableHtml += `<tr draggable="true" data-pair-id="${pairId}" data-trade-type="paired" data-action="${action}">
          <td>${buyPrice ? `<span class="price-bubble buy">${buyPrice.toFixed(2)}</span>` : ''}</td>
          <td>${sellPrice ? `<span class="price-bubble sell">${sellPrice.toFixed(2)}</span>` : ''}</td>
          <td>${qty}</td>
          <td>${buyAmount ? buyAmount.toLocaleString() : ''}</td>
          <td>${sellAmount ? sellAmount.toLocaleString() : ''}</td>
          <td>${buyDate}</td>
          <td>${sellDate}</td>
          <td>${formatDateTime(createdAt)}</td>
          <td>${remark || ''}</td>
        </tr>`;
      });
      
      tableHtml += '</tbody></table>';
      return tableHtml;
    }

    if (unpairedNotHiddenEl) {
      const buyCount = unpairedNotHidden.filter(t => t.side === 'buy').length;
      const sellCount = unpairedNotHidden.filter(t => t.side === 'sell').length;
      
      const buyTrades = unpairedNotHidden.filter(t => t.side === 'buy').sort((a, b) => b.price - a.price);
      const sellTrades = unpairedNotHidden.filter(t => t.side === 'sell').sort((a, b) => a.price - b.price);
      let allTrades = [...buyTrades, ...sellTrades];
      
      unpairedNotHiddenEl.innerHTML = `数量:${unpairedNotHidden.length} 买入:${buyCount} 卖出:${sellCount}`;
      
      console.log('unpaired-not-hidden viewState:', this.viewState['unpaired-not-hidden']);
      
      if (this.viewState['unpaired-not-hidden'] === 'table') {
        console.log('Setting table view for unpaired-not-hidden');
        const sortState = this.sortState['unpaired-not-hidden'];
        if (sortState.column) {
          allTrades = sortUnpairedTrades(allTrades, sortState.column, sortState.direction);
        }
        unpairedBubblesContainer.innerHTML = generateUnpairedTable(allTrades, 'hide', sortState.column, sortState.direction);
        this.bindTableDragEvents(winEl, unpairedBubblesContainer);
        this.bindTableSortEvents(winEl, unpairedBubblesContainer, 'unpaired-not-hidden');
      } else {
        let bubblesHtml = '';
        bubblesHtml += '<div class="stats-bubble-row buy-row">';
        buyTrades.forEach(trade => {
          bubblesHtml += `<div class="stats-bubble buy" draggable="true" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="hide">${trade.price.toFixed(2)}</div>`;
        });
        bubblesHtml += '</div>';
        
        bubblesHtml += '<div class="stats-bubble-row sell-row">';
        sellTrades.forEach(trade => {
          bubblesHtml += `<div class="stats-bubble sell" draggable="true" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="hide">-${trade.price.toFixed(2)}</div>`;
        });
        bubblesHtml += '</div>';
        
        unpairedBubblesContainer.innerHTML = bubblesHtml;
      }
    }

    if (unpairedHiddenEl) {
      const buyCount = unpairedHidden.filter(t => t.side === 'buy').length;
      const sellCount = unpairedHidden.filter(t => t.side === 'sell').length;
      
      const buyTrades = unpairedHidden.filter(t => t.side === 'buy').sort((a, b) => b.price - a.price);
      const sellTrades = unpairedHidden.filter(t => t.side === 'sell').sort((a, b) => a.price - b.price);
      let allTrades = [...buyTrades, ...sellTrades];
      
      unpairedHiddenEl.innerHTML = `数量:${unpairedHidden.length} 买入:${buyCount} 卖出:${sellCount}`;
      
      if (this.viewState['unpaired-hidden'] === 'table') {
        const sortState = this.sortState['unpaired-hidden'];
        if (sortState.column) {
          allTrades = sortUnpairedTrades(allTrades, sortState.column, sortState.direction);
        }
        unpairedHiddenBubblesContainer.innerHTML = generateUnpairedTable(allTrades, 'unhide', sortState.column, sortState.direction);
        this.bindTableDragEvents(winEl, unpairedHiddenBubblesContainer);
        this.bindTableSortEvents(winEl, unpairedHiddenBubblesContainer, 'unpaired-hidden');
      } else {
        let bubblesHtml = '';
        bubblesHtml += '<div class="stats-bubble-row buy-row">';
        buyTrades.forEach(trade => {
          bubblesHtml += `<div class="stats-bubble buy" draggable="true" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="unhide">${trade.price.toFixed(2)}</div>`;
        });
        bubblesHtml += '</div>';
        
        bubblesHtml += '<div class="stats-bubble-row sell-row">';
        sellTrades.forEach(trade => {
          bubblesHtml += `<div class="stats-bubble sell" draggable="true" data-trade-id="${trade.id}" data-trade-type="unpaired" data-action="unhide">-${trade.price.toFixed(2)}</div>`;
        });
        bubblesHtml += '</div>';
        
        unpairedHiddenBubblesContainer.innerHTML = bubblesHtml;
      }
    }

    if (pairedNotHiddenEl && pairedBubblesContainer) {
      const buyCount = pairedNotHidden.reduce((sum, p) => sum + (p.buy && p.buy.side === 'buy' ? 1 : 0), 0);
      const sellCount = pairedNotHidden.reduce((sum, p) => sum + (p.sell && p.sell.side === 'sell' ? 1 : 0), 0);
      
      pairedNotHiddenEl.innerHTML = `数量:${pairedNotHidden.length} 买入:${buyCount} 卖出:${sellCount}`;
      
      if (this.viewState['paired-not-hidden'] === 'table') {
        const sortState = this.sortState['paired-not-hidden'];
        let sortedPairs = pairedNotHidden;
        if (sortState.column) {
          sortedPairs = sortPairedTrades(pairedNotHidden, sortState.column, sortState.direction);
        }
        pairedBubblesContainer.innerHTML = generatePairedTable(sortedPairs, 'hide', sortState.column, sortState.direction);
        this.bindTableDragEvents(winEl, pairedBubblesContainer);
        this.bindTableSortEvents(winEl, pairedBubblesContainer, 'paired-not-hidden');
      } else {
        let bubblesHtml = '';
        pairedNotHidden.forEach(pair => {
          const pairId = pair.buy ? pair.buy.id : (pair.sell ? pair.sell.id : '');
          bubblesHtml += `<div class="trade-pair" draggable="true" data-pair-id="${pairId}" data-trade-type="paired" data-action="hide">`;
          if (pair.buy) {
            bubblesHtml += `<span class="price-bubble buy">${pair.buy.price.toFixed(2)}</span>`;
          }
          if (pair.sell) {
            bubblesHtml += `<span class="price-bubble sell">-${pair.sell.price.toFixed(2)}</span>`;
          }
          bubblesHtml += '</div>';
        });
        
        pairedBubblesContainer.innerHTML = bubblesHtml;
      }
    }

    if (pairedHiddenEl && pairedHiddenBubblesContainer) {
      const buyCount = pairedHidden.reduce((sum, p) => sum + (p.buy && p.buy.side === 'buy' ? 1 : 0), 0);
      const sellCount = pairedHidden.reduce((sum, p) => sum + (p.sell && p.sell.side === 'sell' ? 1 : 0), 0);
      
      pairedHiddenEl.innerHTML = `数量:${pairedHidden.length} 买入:${buyCount} 卖出:${sellCount}`;
      
      if (this.viewState['paired-hidden'] === 'table') {
        const sortState = this.sortState['paired-hidden'];
        let sortedPairs = pairedHidden;
        if (sortState.column) {
          sortedPairs = sortPairedTrades(pairedHidden, sortState.column, sortState.direction);
        }
        pairedHiddenBubblesContainer.innerHTML = generatePairedTable(sortedPairs, 'unhide', sortState.column, sortState.direction);
        this.bindTableDragEvents(winEl, pairedHiddenBubblesContainer);
        this.bindTableSortEvents(winEl, pairedHiddenBubblesContainer, 'paired-hidden');
      } else {
        let bubblesHtml = '';
        pairedHidden.forEach(pair => {
          const pairId = pair.buy ? pair.buy.id : (pair.sell ? pair.sell.id : '');
          bubblesHtml += `<div class="trade-pair" draggable="true" data-pair-id="${pairId}" data-trade-type="paired" data-action="unhide">`;
          if (pair.buy) {
            bubblesHtml += `<span class="price-bubble buy">${pair.buy.price.toFixed(2)}</span>`;
          }
          if (pair.sell) {
            bubblesHtml += `<span class="price-bubble sell">-${pair.sell.price.toFixed(2)}</span>`;
          }
          bubblesHtml += '</div>';
        });
        
        pairedHiddenBubblesContainer.innerHTML = bubblesHtml;
      }
    }
  }
}

if (typeof window !== 'undefined') {
  window.BubbleHideManagerPlugin = BubbleHideManagerPlugin;
  window.bubbleHideManagerPlugin = new BubbleHideManagerPlugin();
  window.openBubbleHideManagerWindow = function(stockName) {
    window.bubbleHideManagerPlugin.openWindow(stockName);
  };
  
  // 保存配对缓存到数据库
  window.savePairingCache = async function() {
    if (!window.pairingCache) {
      console.warn('当前没有可保存的配对缓存');
      return;
    }

    try {
      for (const stockName in window.pairingCache) {
        const pairingData = window.pairingCache[stockName];
        if (window.tradesDB && window.tradesDB.savePairing) {
          await window.tradesDB.savePairing(pairingData);
        }
      }
      console.log('配对缓存已持久化到数据库');
    } catch (error) {
      console.error('保存配对缓存失败:', error);
      throw error;
    }
  };
}
