class CategoryManagerPlugin extends BaseManagerPlugin {
  constructor() {
    super(
      'CategoryManager',
      'category_codes_db_cache',
      'categories',
      '类别代码管理',
      'ALL_CATEGORIES'
    );
  }

  bindEvents() {
    const self = this;
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('categoryManagerBtn');
      if (btn) {
        btn.onclick = () => self.openCategoryManager();
      }
    });
  }

  async loadData() {
    await this.loadAndRenderFromSQLite();
  }

  async loadAndRenderFromSQLite() {
    if (!this.sqliteDB) return;

    try {
      const table = this.getTableName('categories');
      const result = this.sqliteDB.exec(`SELECT id, code, short_name, name, remark FROM ${table} ORDER BY code`);
      const data = result[0]?.values || [];

      const tbody = document.getElementById('categoriesTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">暂无数据</td></tr>';
          document.getElementById('categoryCount').textContent = '0';
          return;
        }

        data.forEach(row => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td><strong>${row[1]}</strong></td>
            <td>${row[2] || '-'}</td>
            <td>${row[3]}</td>
            <td style="color: #666; font-size: 12px;">${row[4] || '-'}</td>
            <td>
              <button class="btn btn-sm btn-secondary" onclick="window.categoryManager.openEditModal(${row[0]})">编辑</button>
              <button class="btn btn-sm btn-danger" onclick="window.categoryManager.deleteCategory(${row[0]}, '${row[1]}')">删除</button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        document.getElementById('categoryCount').textContent = data.length.toString();
      }
    } catch (e) {
      console.error('[CategoryManager] 加载数据失败:', e);
    }
  }

  async openCategoryManager() {
    if (this.floatingWindow) {
      try {
        // 等待窗口完全显示后再加载数据
        await this.showWindowAndWait();
        if (!this.sqliteDB) {
          await this.initSQLite();
        }
        await this.loadAndRenderFromSQLite();
        this.switchToTab('categories');
        return;
      } catch (e) {
        console.log('聚焦窗口失败，创建新窗口:', e);
        this.floatingWindow = null;
      }
    }

    if (!this.sqliteDB) {
      try {
        this.showStatusMessage('正在初始化数据库...');
        await this.initSQLite();
      } catch (error) {
        console.error('初始化数据库失败:', error);
        this.showStatusMessage('初始化数据库失败: ' + error.message, false);
        return;
      }
    }

    const contentHtml = `
      <div class="stock-manager-container">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
          <h3>📂 ${this.windowTitle}</h3>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary" onclick="window.categoryManager.openAddModal()">➕ 新增类别</button>
            <input type="text" id="categorySearchInput" placeholder="搜索类别..." style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 200px;" onkeyup="window.categoryManager.searchCategories()">
          </div>
        </div>

        <div style="border-bottom: 1px solid #ddd; margin-bottom: 15px;">
          <button data-category-manager-tab="categories" onclick="window.categoryManager.switchToTab('categories')" class="tab-btn active">类别列表</button>
          <button data-category-manager-tab="settings" onclick="window.categoryManager.switchToTab('settings')" class="tab-btn">设置</button>
        </div>

        <div data-category-manager-panel="categories" style="display: block;">
          <table class="data-table">
            <thead>
              <tr>
                <th>类别代号</th>
                <th>类别简称</th>
                <th>类别名称</th>
                <th>备注</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="categoriesTableBody">
              <tr><td colspan="5" style="text-align: center; color: #666;">加载中...</td></tr>
            </tbody>
          </table>
          <div style="margin-top: 15px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 13px; color: #0369a1;">
            共 <strong id="categoryCount">0</strong> 条记录 · 数据来源：浏览器持久化
          </div>
        </div>

        <div data-category-manager-panel="settings" style="display: none;">
          <div id="categoryManagerInfoPanel" style="padding: 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px;"></div>
          <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="btn btn-primary" onclick="window.categoryManager.exportToSQLite()">💾 备份至 SQLite</button>
            <button class="btn btn-secondary" onclick="window.categoryManager.importSQLiteDatabase()" title="从 SQLite 文件导入数据">📥 导入数据库</button>
            <button class="btn btn-secondary" onclick="window.categoryManager.initializeFromJsData()" title="使用 categoryData.js 的数据初始化当前类别资料">🔄 初始化</button>
          </div>
        </div>

        <div id="categoryModal" class="modal" style="display: none;">
          <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 id="categoryModalTitle">新增类别</h3>
              <button class="modal-close" onclick="window.categoryManager.closeCategoryModal()">&times;</button>
            </div>
            <form id="categoryForm">
              <div style="margin-bottom: 12px;">
                <label>类别代号 *</label>
                <input type="text" id="categoryCode" required placeholder="如：TSTOCK" style="width: 100%; padding: 8px; margin-top: 4px;">
              </div>
              <div style="margin-bottom: 12px;">
                <label>类别简称</label>
                <input type="text" id="categoryShortName" placeholder="如：股票" style="width: 100%; padding: 8px; margin-top: 4px;">
              </div>
              <div style="margin-bottom: 12px;">
                <label>类别名称 *</label>
                <input type="text" id="categoryName" required style="width: 100%; padding: 8px; margin-top: 4px;">
              </div>
              <div style="margin-bottom: 15px;">
                <label>备注</label>
                <textarea id="categoryRemark" rows="3" style="width: 100%; padding: 8px; margin-top: 4px;"></textarea>
              </div>
              <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="window.categoryManager.closeCategoryModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>

        <div id="categoryManagerStatus" style="margin-top: 10px; font-size: 13px; color: #16a34a; min-height: 18px;"></div>
      </div>
    `;

    this.floatingWindow = new FloatingWindow({
      title: this.windowTitle,
      width: '1000px',
      height: '800px',
      draggable: false,
      content: contentHtml,
      on: {
        close: () => {
          // 只隐藏窗口，不销毁数据库（以便下次打开时可以复用）
          this.floatingWindow.hide();
        }
      }
    });

    this.floatingWindow.show();

    document.getElementById('categoryForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveCategory();
    });

    await this.loadAndRenderFromSQLite();
    this.renderDataInfoPanel();
  }

  openAddModal() {
    this.editingId = null;
    document.getElementById('categoryModalTitle').textContent = '新增类别';
    document.getElementById('categoryForm').reset();
    document.getElementById('categoryModal').style.display = 'block';
  }

  async openEditModal(id) {
    if (!this.sqliteDB) return;

    try {
      const table = this.getTableName('categories');
      const result = this.sqliteDB.exec(`SELECT * FROM ${table} WHERE id = ${id}`);
      const row = result[0]?.values?.[0];

      if (row) {
        this.editingId = id;
        document.getElementById('categoryModalTitle').textContent = '编辑类别';
        document.getElementById('categoryCode').value = row[1];
        document.getElementById('categoryShortName').value = row[2] || '';
        document.getElementById('categoryName').value = row[3];
        document.getElementById('categoryRemark').value = row[4] || '';
        document.getElementById('categoryModal').style.display = 'block';
      }
    } catch (e) {
      console.error('[CategoryManager] 加载编辑数据失败:', e);
    }
  }

  closeCategoryModal() {
    document.getElementById('categoryModal').style.display = 'none';
    this.editingId = null;
  }

  async saveCategory() {
    const code = document.getElementById('categoryCode').value.trim();
    const shortName = document.getElementById('categoryShortName').value.trim();
    const name = document.getElementById('categoryName').value.trim();
    const remark = document.getElementById('categoryRemark').value.trim();

    if (!code || !name) {
      alert('请填写必填字段（类别代号和类别名称）');
      return;
    }

    if (!this.sqliteDB) {
      await this.initSQLite();
    }

    try {
      const table = this.getTableName('categories');

      if (this.editingId) {
        this.sqliteDB.run(
          `UPDATE ${table} SET code = ?, short_name = ?, name = ?, remark = ? WHERE id = ?`,
          [code, shortName, name, remark, this.editingId]
        );
        this.showStatusMessage('类别更新成功');
      } else {
        this.sqliteDB.run(
          `INSERT INTO ${table} (code, short_name, name, remark) VALUES (?, ?, ?, ?)`,
          [code, shortName, name, remark]
        );
        this.showStatusMessage('类别新增成功');
      }

      this._syncToLocalStorage();
      await this.loadAndRenderFromSQLite();
      this.closeCategoryModal();
    } catch (e) {
      console.error('[CategoryManager] 保存失败:', e);
      this.showStatusMessage('保存失败: ' + e.message, false);
    }
  }

  async deleteCategory(id, code) {
    if (!confirm(`确定要删除类别「${code}」吗？`)) return;

    try {
      const table = this.getTableName('categories');
      this.sqliteDB.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
      this._syncToLocalStorage();
      await this.loadAndRenderFromSQLite();
      this.showStatusMessage('类别删除成功');
    } catch (e) {
      console.error('[CategoryManager] 删除失败:', e);
      this.showStatusMessage('删除失败: ' + e.message, false);
    }
  }

  searchCategories() {
    const searchTerm = document.getElementById('categorySearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#categoriesTableBody tr');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  }

  showWindowAndWait() {
    return new Promise((resolve) => {
      const checkElement = () => {
        const tableBody = document.getElementById('categoriesTableBody');
        if (tableBody) {
          resolve();
        } else {
          setTimeout(checkElement, 50);
        }
      };
      this.floatingWindow.show();
      checkElement();
    });
  }
}

window.categoryManager = new CategoryManagerPlugin();
window.categoryManager.init();