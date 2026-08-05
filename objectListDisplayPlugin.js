/**
 * 对象清单展示插件
 * 专注于对象数据的只读展示
 * 
 * 参考 stockListDisplayPlugin.js 和 categoryListDisplayPlugin.js 的实现模式
 * 职责单一：只负责数据展示，不涉及数据管理
 */

class ObjectListDisplayPlugin {
  constructor() {
    this.name = 'ObjectListDisplayPlugin';
    this.initialized = false;
    this.objectListWindow = null;
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
    
    console.log('对象清单展示插件初始化中...');
    
    // 检查 FloatingWindow 是否可用
    if (typeof FloatingWindow === 'undefined') {
      console.error('FloatingWindow 组件未加载，无法初始化对象清单展示插件');
      return;
    }
    
    // 绑定按钮事件
    this.bindEvents();
    
    this.initialized = true;
    console.log('对象清单展示插件初始化完成');
  }

  /**
   * 绑定事件
   */
  bindEvents() {
    const objectListExportBtn = document.getElementById('objectListExportBtn');
    if (objectListExportBtn) {
      objectListExportBtn.addEventListener('click', () => this.showObjectListDropdown());
    }
  }

  /**
   * 获取对象列表（异步版本）
   * 优先从 ObjectCodeManagerPlugin 获取数据，确保数据一致性
   */
  async getObjectList() {
    try {
      // 如果 ObjectCodeManagerPlugin 已初始化且可用，使用其数据源
      if (window.objectCodeManager && window.objectCodeManager.getList) {
        return await window.objectCodeManager.getList();
      }
      
      // 否则使用全局变量作为后备方案
      const objects = window.OBJECTS || [];
      if (!objects || objects.length === 0) {
        console.warn('[ObjectListDisplay] 无法获取对象列表，OBJECTS 为空或未定义');
      }
      
      return objects.map(o => ({ ...o }));
    } catch (e) {
      console.error('[ObjectListDisplay] getObjectList 失败:', e);
      return (window.OBJECTS || []).map(o => ({ ...o }));
    }
  }

  /**
   * 显示对象清单浮动视窗（供外部按钮调用，使用 FloatingWindow 组件）
   */
  async showObjectListDropdown() {
    const objects = await this.getObjectList();
    if (!objects || objects.length === 0) {
      alert('当前没有对象清单数据\n请先打开「对象代号管理」进行数据维护');
      return;
    }

    if (this.objectListWindow) {
      try { this.objectListWindow.close(); } catch(e) {}
    }

    const contentHtml = BaseManagerPlugin.renderListTable({
      title: '当前对象清单',
      icon: '📋',
      dataCount: objects.length,
      dataSource: '浏览器持久化',
      themeColor: { from: '#f59e0b', to: '#d97706' },
      columns: [
        { key: 'code', label: '对象代号', width: '15%', align: 'left' },
        { key: 'shortName', label: '对象简称', width: '12%', align: 'center' },
        { key: 'name', label: '对象名称', width: '23%', align: 'left' },
        { key: 'remark', label: '说明', width: '50%', align: 'left' }
      ],
      data: objects,
      renderCell: (row, col) => {
        switch(col.key) {
          case 'code':
            return `<span style="font-weight:500;color:#d97706;">${BaseManagerPlugin.prototype.escapeHtml.call(null, row.code)}</span>`;
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
      footerText: '数据由 ObjectCodeManagerPlugin 提供 · 由 ObjectListDisplayPlugin 渲染'
    });

    this.objectListWindow = new FloatingWindow({
      title: '对象清单',
      sourceFile: 'objectListDisplayPlugin.js',
      width: 700,
      height: 520,
      draggable: false,
      on: {
        close: () => { this.objectListWindow = null; }
      }
    });

    this.objectListWindow.setContent(contentHtml);
    this.objectListWindow.show();
  }

  /**
   * 销毁插件
   */
  destroy() {
    if (this.objectListWindow) {
      try { this.objectListWindow.close(); } catch(e) {}
      this.objectListWindow = null;
    }
    this.initialized = false;
  }
}

// 导出插件
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ObjectListDisplayPlugin;
} else if (typeof window !== 'undefined') {
  window.ObjectListDisplayPlugin = ObjectListDisplayPlugin;
  // 创建全局实例
  window.objectListDisplay = new ObjectListDisplayPlugin();
  
  // 等待 DOM 加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.objectListDisplay.init();
    });
  } else {
    // DOM 已经加载完成
    setTimeout(() => {
      window.objectListDisplay.init();
    }, 100);
  }
}
