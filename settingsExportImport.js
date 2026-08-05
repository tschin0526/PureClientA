/**
 * SettingsExportImport Plugin
 * 参数导入导出 - 独立插件
 * 功能：导出/导入系统设定参数（除主数据库外的所有配置）
 */

class SettingsExportImport {
  constructor() {
    this.window = null;
    this.selectedCategories = new Set();
    this.init();
  }

  init() {
    console.log('SettingsExportImport 插件初始化');
  }

  // 显示主窗体
  showModal() {
    if (!this.window) {
      this.window = new FloatingWindow({
        title: '⚙️ 参数导入导出',
        sourceFile: 'settingsExportImport.js',
        width: '850px',
        height: '700px',
        x: '120px',
        y: '60px',
        draggable: false,
        id: 'settingsExportImportWindow'
      });
    }

    const content = this.buildContent();
    this.window.setContent(content);
    this.window.show();

    // 默认全选
    this.selectAll();
    this.bindEvents();
  }

  // 获取所有可导出的参数定义
  getAvailableCategories() {
    return [
      {
        id: 'compactModeSettings',
        name: '📱 紧凑模式设置',
        description: '紧凑模式的所有显示和交互设置',
        icon: '📋',
        items: [
          { key: 'currentViewMode', label: '视图模式', desc: '水平/垂直布局' },
          { key: 'bubbleScale', label: '气泡缩放比例', desc: '气泡显示大小' },
          { key: 'historyDays', label: '历史天数', desc: '显示的历史数据天数' },
          { key: 'showHistoryPairedBubbles', label: '显示历史配对气泡', desc: '是否显示已配对的历史气泡' },
          { key: 'historyPairedDays', label: '配对气泡天数筛选', desc: '只显示指定天数的配对' },
          { key: 'showHistoryByDate', label: '按日显示历史数据', desc: '历史数据按日期分组' },
          { key: 'showHistoryBySide', label: '按买卖显示历史数据', desc: '历史数据按买卖排序' }
        ]
      },
      {
        id: 'stockDisplaySettings',
        name: '📈 股票显示设置',
        description: '股票卡片的显示、隐藏、排序等设置',
        icon: '🎨',
        items: [
          { key: 'collapsedMarkets', label: '折叠的市场列表', desc: '被折叠不显示的市场' },
          { key: 'hiddenStocks', label: '隐藏的股票列表', desc: '被屏蔽不显示的股票' },
          { key: 'collapsedStocks', label: '折叠的股票列表', desc: '被折叠的股票' },
          { key: 'stockOrder', label: '股票自定义排序', desc: '股票显示顺序' }
        ]
      },
      {
        id: 'stockCustomization',
        name: '🎯 股票个性化设置',
        description: '每只股票的自定义颜色、备注、阈值等',
        icon: '✏️',
        items: [
          { key: 'stockColors', label: '股票自定义颜色', desc: '每只股票的专属颜色' },
          { key: 'stockNotes', label: '股票备注', desc: '每只股票的文字备注' },
          { key: 'stockThresholds', label: '卖出阈值', desc: '触发卖出的价格阈值' },
          { key: 'stockBuyThresholds', label: '买入阈值', desc: '触发买入的价格阈值' },
          { key: 'stockThresholdLinkage', label: '阈值联动状态', desc: '阈值是否联动' },
          { key: 'stockThresholdLinkageDirection', label: '阈值联动方向', desc: '联动方向设置' }
        ]
      },
      {
        id: 'otherSettings',
        name: '⚙️ 其他设置',
        description: '系统的其他配置参数',
        icon: '🔧',
        items: [
          { key: 'filterDate', label: '当前筛选日期', desc: '紧凑模式当前查看的日期' },
          { key: 'stockListMode', label: '股票清单模式', desc: '经常交易/所有股票' }
        ]
      }
    ];
  }

  // 构建窗体内容
  buildContent() {
    const categories = this.getAvailableCategories();

    return `
      <div class="sei-container" style="padding: 15px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        
        <!-- 操作按钮区 -->
        <div style="display: flex; gap: 10px; margin-bottom: 15px; flex-wrap: wrap;">
          <button id="seiSelectAllBtn" style="padding: 8px 20px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            ✓ 全选
          </button>
          <button id="seiDeselectAllBtn" style="padding: 8px 20px; background: #6c757d; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 12px;">
            ✗ 取消全选
          </button>
          <button id="seiExportBtn" style="padding: 8px 24px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">
            📤 导出选中项 (JSON)
          </button>
          <button id="seiImportBtn" style="padding: 8px 24px; background: #6610f2; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 13px; font-weight: bold;">
            📥 导入 JSON 文件
          </button>
          <input type="file" id="seiImportFile" accept=".json" style="display: none;">
          <span id="seiSelectedCount" style="padding: 6px 12px; background: #e3f2fd; color: #1976d2; border-radius: 4px; font-size: 12px; font-weight: bold;">
            已选择: 0 个分类
          </span>
        </div>

        <!-- 参数分类列表 -->
        <div style="border: 1px solid #ddd; border-radius: 6px; overflow: hidden;">
          <div style="background: #f1f3f5; padding: 10px; font-weight: bold; color: #495057; font-size: 13px; border-bottom: 1px solid #ddd;">
            📋 可导出的参数分类（勾选需要导出的项目）
          </div>
          <div id="seiCategoryList" style="max-height: 520px; overflow-y: auto; padding: 10px;">
            ${this.renderCategories(categories)}
          </div>
        </div>

        <!-- 导入结果区 -->
        <div id="seiImportResult" style="margin-top: 15px; padding: 12px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 6px; display: none;">
          <strong>📥 导入结果：</strong>
          <pre id="seiImportResultText" style="margin-top: 8px; white-space: pre-wrap; word-break: break-all; font-size: 12px;"></pre>
        </div>

      </div>
    `;
  }

  // 渲染分类列表
  renderCategories(categories) {
    return categories.map(cat => `
      <div class="sei-category-item" data-category-id="${cat.id}" 
           style="margin-bottom: 15px; border: 1px solid #e9ecef; border-radius: 6px; overflow: hidden; background: white;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 10px 12px; display: flex; align-items: center; justify-content: space-between; cursor: pointer;"
             onclick="window.SettingsExportImport.toggleCategory('${cat.id}')">
          <div>
            <span style="font-size: 16px; margin-right: 8px;">${cat.icon}</span>
            <strong style="font-size: 14px;">${cat.name}</strong>
            <div style="font-size: 11px; opacity: 0.9; margin-top: 2px;">${cat.description}</div>
          </div>
          <input type="checkbox" class="sei-category-checkbox" data-category-id="${cat.id}" 
                 style="width: 18px; height: 18px; cursor: pointer;" checked>
        </div>
        <div class="sei-category-items" style="padding: 10px; background: #f8f9fa; display: block;">
          <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
            <thead>
              <tr style="background: #e9ecef;">
                <th style="border: 1px solid #dee2e6; padding: 4px; text-align: left;">参数名称</th>
                <th style="border: 1px solid #dee2e6; padding: 4px; text-align: left;">说明</th>
              </tr>
            </thead>
            <tbody>
              ${cat.items.map(item => `
                <tr style="border-bottom: 1px solid #eee;">
                  <td style="border: 1px solid #dee2e6; padding: 4px; font-family: monospace; color: #0d6efd;">${item.label}</td>
                  <td style="border: 1px solid #dee2e6; padding: 4px; color: #666;">${item.desc}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `).join('');
  }

  // 绑定事件
  bindEvents() {
    const body = this.window.getElement().querySelector('.floating-body');

    // 全选按钮
    body.querySelector('#seiSelectAllBtn').addEventListener('click', () => {
      this.selectAll();
    });

    // 取消全选按钮
    body.querySelector('#seiDeselectAllBtn').addEventListener('click', () => {
      this.deselectAll();
    });

    // 导出按钮
    body.querySelector('#seiExportBtn').addEventListener('click', () => {
      this.exportSelected();
    });

    // 导入按钮
    body.querySelector('#seiImportBtn').addEventListener('click', () => {
      body.querySelector('#seiImportFile').click();
    });

    // 导入文件选择
    body.querySelector('#seiImportFile').addEventListener('change', (e) => {
      this.importFromFile(e);
    });

    // 分类checkbox事件
    body.querySelectorAll('.sei-category-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        const catId = e.target.dataset.categoryId;
        if (e.target.checked) {
          this.selectedCategories.add(catId);
        } else {
          this.selectedCategories.delete(catId);
        }
        this.updateSelectedCount();
        this.updateCategoryStyle(catId, e.target.checked);
      });
    });
  }

  // 切换分类展开/折叠
  toggleCategory(categoryId) {
    const checkbox = document.querySelector(`.sei-category-checkbox[data-category-id="${categoryId}"]`);
    if (checkbox) {
      checkbox.checked = !checkbox.checked;
      
      if (checkbox.checked) {
        this.selectedCategories.add(categoryId);
      } else {
        this.selectedCategories.delete(categoryId);
      }
      
      this.updateSelectedCount();
      this.updateCategoryStyle(categoryId, checkbox.checked);
    }
  }

  // 更新单项样式
  updateCategoryStyle(catId, isSelected) {
    const itemEl = document.querySelector(`.sei-category-item[data-category-id="${catId}"]`);
    if (itemEl) {
      const headerEl = itemEl.querySelector('div:first-child');
      if (headerEl) {
        if (isSelected) {
          headerEl.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        } else {
          headerEl.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }
      }
      
      const itemsEl = itemEl.querySelector('.sei-category-items');
      if (itemsEl) {
        itemsEl.style.display = isSelected ? 'block' : 'none';
      }
    }
  }

  // 全选
  selectAll() {
    document.querySelectorAll('.sei-category-checkbox').forEach(checkbox => {
      checkbox.checked = true;
      this.selectedCategories.add(checkbox.dataset.categoryId);
      this.updateCategoryStyle(checkbox.dataset.categoryId, true);
    });
    this.updateSelectedCount();
  }

  // 取消全选
  deselectAll() {
    document.querySelectorAll('.sei-category-checkbox').forEach(checkbox => {
      checkbox.checked = false;
      this.selectedCategories.delete(checkbox.dataset.categoryId);
      this.updateCategoryStyle(checkbox.dataset.categoryId, false);
    });
    this.updateSelectedCount();
  }

  // 更新选中计数
  updateSelectedCount() {
    const countEl = document.getElementById('seiSelectedCount');
    if (countEl) {
      countEl.textContent = `已选择: ${this.selectedCategories.size} 个分类`;
      countEl.style.background = this.selectedCategories.size > 0 ? '#cce5ff' : '#e3f2fd';
      countEl.style.color = this.selectedCategories.size > 0 ? '#004085' : '#1976d2';
    }
  }

  // 收集选中的参数数据
  collectSelectedData() {
    const result = {};
    const categories = this.getAvailableCategories();

    for (const cat of categories) {
      if (!this.selectedCategories.has(cat.id)) continue;

      switch (cat.id) {
        case 'compactModeSettings':
          // 从 compactModePlugin 实例获取设置
          if (window.compactModePlugin) {
            result.compactModeSettings = {
              currentViewMode: window.compactModePlugin.currentViewMode,
              bubbleScale: window.compactModePlugin.bubbleScale,
              historyDays: window.compactModePlugin.historyDays,
              showHistoryPairedBubbles: window.compactModePlugin.showHistoryPairedBubbles,
              historyPairedDays: window.compactModePlugin.historyPairedDays,
              showHistoryByDate: window.compactModePlugin.showHistoryByDate,
              showHistoryBySide: window.compactModePlugin.showHistoryBySide,
              collapsedMarkets: Array.from(window.compactModePlugin.collapsedMarkets || []),
              hiddenStocks: Array.from(window.compactModePlugin.hiddenStocks || []),
              collapsedStocks: Array.from(window.compactModePlugin.collapsedStocks || []),
              stockOrder: window.compactModePlugin.stockOrder || [],
              stockColors: window.compactModePlugin.stockColors || {},
              stockNotes: window.compactModePlugin.stockNotes || {},
              stockThresholds: window.compactModePlugin.stockThresholds || {},
              stockBuyThresholds: window.compactModePlugin.stockBuyThresholds || {},
              stockThresholdLinkage: window.compactModePlugin.stockThresholdLinkage || {},
              stockThresholdLinkageDirection: window.compactModePlugin.stockThresholdLinkageDirection || {}
            };
          }
          break;

        case 'stockDisplaySettings':
        case 'stockCustomization':
          // 这些已经包含在 compactModeSettings 中，跳过避免重复
          break;

        case 'otherSettings':
          result.otherSettings = {};
          
          // 筛选日期
          const filterDateInput = document.getElementById('filterDate');
          if (filterDateInput) {
            result.otherSettings.filterDate = filterDateInput.value;
          }
          
          // 股票清单模式
          const stockListModeSelect = document.getElementById('stockListModeSelect');
          if (stockListModeSelect) {
            result.otherSettings.stockListMode = stockListModeSelect.value;
          }
          break;
      }
    }

    return result;
  }

  // 导出选中的参数
  exportSelected() {
    if (this.selectedCategories.size === 0) {
      alert('⚠️ 请先勾选要导出的参数分类！');
      return;
    }

    try {
      const exportData = {
        version: '1.0',
        exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
        appName: 'pureClientA',
        appVersion: '1.0.3(99)',
        selectedCategories: Array.from(this.selectedCategories),
        totalCount: this.selectedCategories.size,
        data: this.collectSelectedData(),
        metadata: {
          note: '此文件包含系统设定参数，不含主数据库(trades/pairings)的交易数据',
          warning: '导入将覆盖现有同名参数，请谨慎操作'
        }
      };

      // 统计实际包含的数据量
      let actualDataSize = 0;
      for (const key of Object.keys(exportData.data)) {
        const val = exportData.data[key];
        if (Array.isArray(val)) {
          actualDataSize += val.length;
        } else if (typeof val === 'object' && val !== null) {
          actualDataSize += Object.keys(val).length;
        } else {
          actualDataSize += 1;
        }
      }
      exportData.actualDataSize = actualDataSize;

      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      var now = new Date();
      var pad = function(n) { return n < 10 ? '0' + n : n; };
      a.download = `settings_export_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${this.selectedCategories.size}categories.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert(`✅ 导出成功！\n\n📊 统计信息：\n• 导出分类数：${this.selectedCategories.size} 个\n• 数据项总数：${actualDataSize} 项\n• 文件大小：${(jsonStr.length / 1024).toFixed(1)} KB\n\n文件已自动下载！`);

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
      if (!importData.data || typeof importData.data !== 'object') {
        throw new Error('无效的JSON格式：缺少data对象或格式错误');
      }

      if (importData.appName !== 'pureClientA') {
        if (!confirm('⚠️ 此文件可能不是本应用的参数导出文件。\n\n来源应用：' + (importData.appName || '未知') + '\n版本：' + (importData.appVersion || '未知') + '\n\n是否仍要继续导入？')) {
          event.target.value = '';
          return;
        }
      }

      // 显示确认对话框
      const categories = Object.keys(importData.data);
      const confirmMsg = `确定要导入以下参数吗？\n\n` +
        `📋 来源信息：\n` +
        `• 应用：${importData.appName || '未知'}\n` +
        `• 版本：${importData.appVersion || '未知'}\n` +
        `• 导出时间：${importData.exportTime || '未知'}\n` +
        `• 包含分类：${categories.join(', ')}\n\n` +
        `⚠️ 注意：导入将覆盖现有的同名参数设置！`;

      if (!confirm(confirmMsg)) {
        event.target.value = '';
        return;
      }

      // 执行导入
      let importedCount = 0;
      let skippedCount = 0;
      const importedItems = [];

      for (const [categoryKey, categoryValue] of Object.entries(importData.data)) {
        try {
          if (categoryKey === 'compactModeSettings' && window.compactModePlugin) {
            // 恢复紧凑模式设置
            const plugin = window.compactModePlugin;
            
            if (categoryValue.currentViewMode !== undefined) plugin.currentViewMode = categoryValue.currentViewMode;
            if (categoryValue.bubbleScale !== undefined) plugin.bubbleScale = categoryValue.bubbleScale;
            if (categoryValue.historyDays !== undefined) plugin.historyDays = categoryValue.historyDays;
            if (typeof categoryValue.showHistoryPairedBubbles === 'boolean') plugin.showHistoryPairedBubbles = categoryValue.showHistoryPairedBubbles;
            if (categoryValue.historyPairedDays !== undefined) plugin.historyPairedDays = categoryValue.historyPairedDays;
            if (typeof categoryValue.showHistoryByDate === 'boolean') plugin.showHistoryByDate = categoryValue.showHistoryByDate;
            if (typeof categoryValue.showHistoryBySide === 'boolean') plugin.showHistoryBySide = categoryValue.showHistoryBySide;
            
            if (Array.isArray(categoryValue.collapsedMarkets)) plugin.collapsedMarkets = new Set(categoryValue.collapsedMarkets);
            if (Array.isArray(categoryValue.hiddenStocks)) plugin.hiddenStocks = new Set(categoryValue.hiddenStocks);
            if (Array.isArray(categoryValue.collapsedStocks)) plugin.collapsedStocks = new Set(categoryValue.collapsedStocks);
            
            if (Array.isArray(categoryValue.stockOrder)) plugin.stockOrder = categoryValue.stockOrder;
            if (categoryValue.stockColors) plugin.stockColors = { ...plugin.stockColors, ...categoryValue.stockColors };
            if (categoryValue.stockNotes) plugin.stockNotes = { ...plugin.stockNotes, ...categoryValue.stockNotes };
            if (categoryValue.stockThresholds) plugin.stockThresholds = { ...plugin.stockThresholds, ...categoryValue.stockThresholds };
            if (categoryValue.stockBuyThresholds) plugin.stockBuyThresholds = { ...plugin.stockBuyThresholds, ...categoryValue.stockBuyThresholds };
            if (categoryValue.stockThresholdLinkage) plugin.stockThresholdLinkage = { ...plugin.stockThresholdLinkage, ...categoryValue.stockThresholdLinkage };
            if (categoryValue.stockThresholdLinkageDirection) plugin.stockThresholdLinkageDirection = { ...plugin.stockThresholdLinkageDirection, ...categoryValue.stockThresholdLinkageDirection };
            
            // 保存到localStorage
            plugin.saveSettings();
            
            importedCount++;
            importedItems.push({ category: '紧凑模式设置', status: '✅ 成功' });
          }
          else if (categoryKey === 'otherSettings') {
            // 恢复其他设置
            
            if (categoryValue.filterDate !== undefined) {
              const filterDateInput = document.getElementById('filterDate');
              if (filterDateInput) {
                filterDateInput.value = categoryValue.filterDate;
                // 触发change事件以更新视图
                filterDateInput.dispatchEvent(new Event('change'));
              }
            }
            
            if (categoryValue.stockListMode !== undefined) {
              const stockListModeSelect = document.getElementById('stockListModeSelect');
              if (stockListModeSelect) {
                stockListModeSelect.value = categoryValue.stockListMode;
                stockListModeSelect.dispatchEvent(new Event('change'));
              }
            }
            
            importedCount++;
            importedItems.push({ category: '其他设置', status: '✅ 成功' });
          }
          else {
            skippedCount++;
            importedItems.push({ category: categoryKey, status: '⏭️ 跳过（未知分类）' });
          }

        } catch (err) {
          skippedCount++;
          importedItems.push({ category: categoryKey, status: `❌ 错误: ${err.message}` });
        }
      }

      // 刷新紧凑模式视图（如果打开的话）
      try {
        if (window.compactModePlugin && window.compactModePlugin.floatingWindow) {
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
            }
          }
        }
      } catch (refreshErr) {
        console.error('刷新紧凑模式失败:', refreshErr);
      }

      // 显示结果
      const resultEl = document.getElementById('seiImportResult');
      const resultTextEl = document.getElementById('seiImportResultText');
      
      if (resultEl && resultTextEl) {
        resultEl.style.display = 'block';
        let resultText = `✅ 导入完成！\n\n`;
        resultText += `📊 处理统计：\n`;
        resultText += `• ✅ 成功导入：${importedCount} 个分类\n`;
        resultText += `• ⏭️ 跳过：${skippedCount} 个分类\n\n`;
        
        resultText += `📋 详细结果：\n`;
        importedItems.forEach(item => {
          resultText += `${item.status} | ${item.category}\n`;
        });

        resultTextEl.textContent = resultText;
      }

      alert(`✅ 参数导入完成！\n\n📊 统计信息：\n• 成功导入：${importedCount} 个分类\n• 跳过：${skippedCount} 个分类\n\n请检查设置是否正确应用！`);

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
    console.log('DOM加载完成，初始化 SettingsExportImport');
    window.SettingsExportImport = new SettingsExportImport();
  });
} else {
  console.log('DOM已加载，直接初始化 SettingsExportImport');
  window.SettingsExportImport = new SettingsExportImport();
}

console.log('SettingsExportImport 插件加载成功');
