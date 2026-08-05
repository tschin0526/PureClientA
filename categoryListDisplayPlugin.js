/**
 * 类别清单展示插件
 * 专注于类别数据的只读展示
 * 
 * 参考 stockListDisplayPlugin.js 的实现模式
 * 职责单一：只负责数据展示，不涉及数据管理
 */

class CategoryListDisplayPlugin {
  constructor() {
    this.name = 'CategoryListDisplayPlugin';
    this.initialized = false;
    this.categoryListWindow = null;
  }

  /**
   * HTML 转义（防 XSS）
   */
  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * 初始化插件
   */
  init() {
    if (this.initialized) return;
    
    console.log('类别清单展示插件初始化中...');
    
    // 检查 FloatingWindow 是否可用
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化类别清单展示插件');
      return;
    }
    
    // 绑定按钮事件
    this.bindEvents();
    
    this.initialized = true;
    console.log('类别清单展示插件初始化完成');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const categoryListExportBtn = document.getElementById('categoryListExportBtn');
    if (categoryListExportBtn) {
      categoryListExportBtn.addEventListener('click', () => this.showCategoryListDropdown());
    }
  }

  /**
   * 获取类别列表（异步版本）
   * 优先从 CategoryManagerPlugin 获取数据，确保数据一致性
   */
  async getCategoryList() {
    try {
      // 如果 CategoryManagerPlugin 已初始化且可用，使用其数据源
      if (window.categoryManager && window.categoryManager.getList) {
        return await window.categoryManager.getList();
      }
      
      // 否则使用全局变量作为后备方案
      const categories = window.CATEGORIES || [];
      if (!categories || categories.length === 0) {
        console.warn('[CategoryListDisplay] 无法获取类别列表，CATEGORIES 为空或未定义');
      }
      
      return categories.map(c => ({ ...c }));
    } catch (e) {
      console.error('[CategoryListDisplay] getCategoryList 失败:', e);
      return (window.CATEGORIES || []).map(c => ({ ...c }));
    }
  }

  /**
   * 显示类别清单浮动视窗（供外部按钮调用，使用 FloatingWindow 组件）
   */
  async showCategoryListDropdown() {
    const categories = await this.getCategoryList();
    if (!categories || categories.length === 0) {
      alert('当前没有类别清单数据\n请先打开「类别代码管理」进行数据维护');
      return;
    }

    if (this.categoryListWindow) {
      try { this.categoryListWindow.close(); } catch(e) {}
    }

    const contentHtml = BaseManagerPlugin.renderListTable({
      title: '当前类别清单',
      icon: '📋',
      dataCount: categories.length,
      dataSource: '浏览器持久化',
      themeColor: { from: '#8b5cf6', to: '#6d28d9' },
      columns: [
        { key: 'code', label: '类别代号', width: '15%', align: 'left' },
        { key: 'shortName', label: '类别简称', width: '12%', align: 'center' },
        { key: 'name', label: '类别名称', width: '23%', align: 'left' },
        { key: 'remark', label: '备注', width: '50%', align: 'left' }
      ],
      data: categories,
      renderCell: (row, col) => {
        switch(col.key) {
          case 'code':
            return `<span style="font-weight:500;color:#6d28d9;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.code)}</span>`;
          case 'shortName':
            return BaseManagerPlugin.prototype.escapeHtml.call(null, row.shortName || '-');
          case 'name':
            return `<span style="font-weight:500;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.name)}</span>`;
          case 'remark':
            return `<span style="color:#666;font-size:12px;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.remark || '-')}</span>`;
          default:
            return BaseManagerPlugin.prototype.escapeHtml.call(null, row[col.key]);
        }
      },
      footerText: '数据由 CategoryManagerPlugin 提供 · 由 CategoryListDisplayPlugin 渲染'
    });

    this.categoryListWindow = new FloatingWindow({
      title: '类别清单',
      sourceFile: 'categoryListDisplayPlugin.js',
      width: 700,
      height: 520,
      draggable: false,
      on: {
        close: () => { this.categoryListWindow = null; }
      }
    });

    this.categoryListWindow.setContent(contentHtml);
    this.categoryListWindow.show();
  }

  /**
   * 销毁插件
   */
  destroy() {
    if (this.categoryListWindow) {
      try { this.categoryListWindow.close(); } catch(e) {}
      this.categoryListWindow = null;
    }
    this.initialized = false;
  }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CategoryListDisplayPlugin;
} else if (typeof window !== 'undefined') {
  window.CategoryListDisplayPlugin = CategoryListDisplayPlugin;
  // 创建全局实例
  window.categoryListDisplay = new CategoryListDisplayPlugin();
  
  // 等待 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.categoryListDisplay.init();
    });
  } else {
    // DOM 已经加载完成
    setTimeout(() => {
      window.categoryListDisplay.init();
    }, 100);
  }
}
