// 配对记录查看器相关功能

// 悬浮视窗实例
let pairingsFloatingWindow = null;

// 初始化配对记录查看器
function initPairingsViewer() {
  const showBtn = document.getElementById('showPairingsBtn');

  if (showBtn) {
    showBtn.addEventListener('click', async () => {
      await showAllPairings();
    });
  }
}

// 创建悬浮视窗实例
function createPairingsFloatingWindow() {
  if (!pairingsFloatingWindow) {
    pairingsFloatingWindow = new FloatingWindow({
      title: '配对记录',
      width: '700px',
      height: '600px',
      x: '100px',
      y: '100px',
      draggable: true,
      id: 'pairingsFloatingWindow'
    });
  }
}

async function showAllPairings() {
  // 确保悬浮视窗实例存在
  createPairingsFloatingWindow();

  let all = [];
  try {
    all = await tradesDB.getAllPairings();
  } catch (err) {
    console.error('读取配对记录失败', err);
    pairingsFloatingWindow.setContent('<div style="padding:16px;">读取配对记录失败：' + (err.message || err) + '</div>');
    pairingsFloatingWindow.show();
    return;
  }

  if (!Array.isArray(all)) all = [];

  const today = new Date().toISOString().slice(0,10);

  let html = `<div class="pairings-container">
    <div class="pairings-header" style="margin-bottom:8px;display:flex;align-items:center;gap:8px;">
      <label style="font-size:13px;display:flex;align-items:center;gap:6px;">
        <input type="checkbox" id="filterTodayPairs"> 只看指定日期配对
      </label>
      <input type="date" id="pairFilterDate" value="${today}">
    </div>
    <div style="overflow:auto; max-height:450px;">
      <table class="pairings-table" style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">股票</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:right;">配对数</th>
            <th style="padding:8px;border:1px solid #e5e7eb;text-align:left;">更新时间</th>
          </tr>
        </thead>
        <tbody>`;

  all.forEach(p => {
    const pairCount = (p.pairedTrades && Array.isArray(p.pairedTrades)) ? p.pairedTrades.length : 0;
    const todayPairs = (p.pairedTrades && Array.isArray(p.pairedTrades)) ? p.pairedTrades.filter(pair => (pair && ((pair.buy && pair.buy.date===today) || (pair.sell && pair.sell.date===today)))) : [];
    const todayCount = todayPairs.length;

    html += `<tr class="pairing-row" style="cursor:pointer;" data-stock="${escapeHtml(p.stockName)}" data-today-count="${todayCount}"><td style="padding:8px;border:1px solid #e5e7eb;">${escapeHtml(p.stockName)}</td><td style="padding:8px;border:1px solid #e5e7eb;text-align:right;">${pairCount}</td><td style="padding:8px;border:1px solid #e5e7eb;">${p.updatedAt || ''}</td></tr>`;

    // detail row includes full JSON and today's-filtered JSON (toggle by checkbox)
    const fullJson = escapeHtml(JSON.stringify(p, null, 2));
    // 构建仅包含当天配对的视图，同时过滤 pairedBuyIds / pairedSellIds
    const todayObj = Object.assign({}, p, { pairedTrades: todayPairs || [] });
    todayObj.pairedBuyIds = (todayPairs || []).map(pair => pair.buy && pair.buy.id).filter(Boolean);
    todayObj.pairedSellIds = (todayPairs || []).map(pair => pair.sell && pair.sell.id).filter(Boolean);
    const todayJson = escapeHtml(JSON.stringify(todayObj, null, 2));
    html += `<tr class="pairing-detail-row" style="display:none;"><td colspan="3" style="padding:8px;border:1px solid #e5e7eb;background:#fff;"><div class="pairings-detail-wrap"><div class="pairings-full" style="display:block;"><pre style="white-space:pre-wrap;word-break:break-word;">${fullJson}</pre></div><div class="pairings-today" style="display:none;"><pre style="white-space:pre-wrap;word-break:break-word;">${todayJson}</pre></div></div></td></tr>`;
  });

  html += `</tbody></table></div></div>`;

  // 设置悬浮视窗内容
  pairingsFloatingWindow.setContent(html);
  // 显示悬浮视窗
  pairingsFloatingWindow.show();

  // 行点击展开详细 JSON
  const floatingBody = pairingsFloatingWindow.getElement().querySelector('.floating-body');
  floatingBody.querySelectorAll('.pairing-row').forEach((row) => {
    row.addEventListener('click', () => {
      const next = row.nextElementSibling;
      if (!next) return;
      next.style.display = next.style.display === 'none' ? 'table-row' : 'none';
    });
  });

  // 复选框：只看当天配对
  const filterChk = floatingBody.querySelector('#filterTodayPairs');
  const dateInput = floatingBody.querySelector('#pairFilterDate');

  // 更新过滤逻辑（根据 dateInput 的值计算当天配对）
  function updateFilterView() {
    const selectedDate = (dateInput && dateInput.value) ? dateInput.value : today;
    const onlyToday = filterChk && filterChk.checked;

    floatingBody.querySelectorAll('.pairing-row').forEach(row => {
      const detail = row.nextElementSibling;
      let todayCount = 0;

      if (detail && detail.classList.contains('pairing-detail-row')) {
        // 解析 full JSON（detail 中的 .pairings-full pre）
        const fullPre = detail.querySelector('.pairings-full pre');
        const todayPre = detail.querySelector('.pairings-today pre');
        try {
          const fullText = fullPre ? fullPre.textContent || fullPre.innerText : '';
          const pObj = fullText ? JSON.parse(fullText) : null;
          const pairedTrades = (pObj && Array.isArray(pObj.pairedTrades)) ? pObj.pairedTrades : [];
          const filtered = pairedTrades.filter(pair => (pair && ((pair.buy && pair.buy.date === selectedDate) || (pair.sell && pair.sell.date === selectedDate))));

          todayCount = filtered.length;

          // 更新 todayPre 内容（显示仅当天的对象视图，包括过滤后的 id 列表）
          if (todayPre) {
            const todayObj = Object.assign({}, pObj || {}, { pairedTrades: filtered });
            todayObj.pairedBuyIds = filtered.map(pair => pair.buy && pair.buy.id).filter(Boolean);
            todayObj.pairedSellIds = filtered.map(pair => pair.sell && pair.sell.id).filter(Boolean);
            todayPre.textContent = JSON.stringify(todayObj, null, 2);
          }
        } catch (err) {
          console.error('解析配对 JSON 失败', err);
        }
      }

      // 更新 dataset
      row.dataset.todayCount = String(todayCount);

      // 根据 onlyToday 决定显示与隐藏，以及详情中显示哪一份
      row.style.display = onlyToday && todayCount === 0 ? 'none' : '';
      if (detail && detail.classList.contains('pairing-detail-row')) {
        const fullDiv = detail.querySelector('.pairings-full');
        const todayDiv = detail.querySelector('.pairings-today');
        if (onlyToday) {
          if (fullDiv) fullDiv.style.display = 'none';
          if (todayDiv) todayDiv.style.display = 'block';
        } else {
          if (fullDiv) fullDiv.style.display = 'block';
          if (todayDiv) todayDiv.style.display = 'none';
        }
      }
    });
  }

  if (filterChk) filterChk.addEventListener('change', updateFilterView);
  if (dateInput) dateInput.addEventListener('change', updateFilterView);

  // 初次渲染时执行一次更新以保证数据一致性
  updateFilterView();
}
