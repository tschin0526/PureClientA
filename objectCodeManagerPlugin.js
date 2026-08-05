class ObjectCodeManagerPlugin extends BaseManagerPlugin {
  constructor() {
    super(
      'ObjectCodeManager',
      'object_codes_db_cache',
      'object_codes',
      '对象代号管理',
      'ALL_OBJECT_CODES'
    );
  }

  bindEvents() {
    const self = this;
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('objectCodeManagerBtn');
      if (btn) {
        btn.onclick = () => self.openObjectCodeManager();
      }
    });
  }

  async loadData() {
    await this.loadObjectData();
  }

  switchToTab(tabId) {
    super.switchToTab(tabId === 'object_codes' ? 'objects' : tabId);
  }

  async loadObjectData() {
    if (!this.sqliteDB) return;

    try {
      const table = this.getTableName('objectCodes');
      const result = this.sqliteDB.exec(`SELECT id, code, short_name, name, remark FROM ${table} ORDER BY code`);
      const data = result[0]?.values || [];

      const tbody = document.getElementById('objectsTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        
        if (data.length === 0) {
          tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: #666;">暂无数据</td></tr>';
          document.getElementById('objectCount').textContent = '0';
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
              <button class="btn btn-sm btn-secondary" onclick="window.objectCodeManager.openEditModal(${row[0]})">编辑</button>
              <button class="btn btn-sm btn-danger" onclick="window.objectCodeManager.deleteObject(${row[0]}, '${row[1]}')">删除</button>
            </td>
          `;
          tbody.appendChild(tr);
        });

        document.getElementById('objectCount').textContent = data.length.toString();
      }
    } catch (e) {
      console.error('[ObjectCodeManager] 加载数据失败:', e);
    }
  }

  async openObjectCodeManager() {
    if (this.floatingWindow) {
      try {
        // 等待窗口完全显示后再加载数据
        await this.showWindowAndWait();
        if (!this.sqliteDB) {
          await this.initSQLite();
        }
        await this.loadObjectData();
        this.switchToTab('objects');
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
          <h3>${this.windowTitle}</h3>
          <div style="display: flex; gap: 10px;">
            <button class="btn btn-primary" onclick="window.objectCodeManager.openAddModal()">新增对象</button>
            <input type="text" id="objectSearchInput" placeholder="搜索对象..." style="padding: 6px 12px; border: 1px solid #ddd; border-radius: 4px; width: 200px;" onkeyup="window.objectCodeManager.searchObjects()">
          </div>
        </div>

        <div style="border-bottom: 1px solid #ddd; margin-bottom: 15px;">
          <button data-object-code-manager-tab="objects" onclick="window.objectCodeManager.switchToTab('objects')" class="tab-btn active">对象列表</button>
          <button data-object-code-manager-tab="settings" onclick="window.objectCodeManager.switchToTab('settings')" class="tab-btn">设置</button>
        </div>

        <div data-object-code-manager-panel="objects" style="display: block;">
          <table class="data-table">
            <thead>
              <tr>
                <th>对象代号</th>
                <th>对象简称</th>
                <th>对象名称</th>
                <th>说明</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody id="objectsTableBody">
              <tr><td colspan="5" style="text-align: center; color: #666;">加载中...</td></tr>
            </tbody>
          </table>
          <div style="margin-top: 15px; padding: 12px; background: #f0f9ff; border-radius: 8px; font-size: 13px; color: #0369a1;">
            共 <strong id="objectCount">0</strong> 条记录 · 数据来源：浏览器持久化
          </div>
        </div>

        <div data-object-code-manager-panel="settings" style="display: none;">
          <div id="objectCodeManagerInfoPanel" style="padding: 15px; background: #f8fafc; border-radius: 8px; margin-bottom: 15px;"></div>
          <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="btn btn-primary" onclick="window.objectCodeManager.exportToSQLite()">💾 备份至 SQLite</button>
            <button class="btn btn-secondary" onclick="window.objectCodeManager.importSQLiteDatabase()" title="从 SQLite 文件导入数据">📥 导入数据库</button>
            <button class="btn btn-secondary" onclick="window.objectCodeManager.initializeFromJsData()" title="使用 objectData.js 的数据初始化当前对象资料">🔄 初始化</button>
          </div>
        </div>

        <div id="objectModal" class="modal" style="display: none;">
          <div class="modal-content">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
              <h3 id="objectModalTitle">新增对象</h3>
              <button class="modal-close" onclick="window.objectCodeManager.closeObjectModal()">&times;</button>
            </div>
            <form id="objectForm">
              <div style="margin-bottom: 12px;">
                <label>对象代号 *</label>
                <input type="text" id="objectCode" required placeholder="如：OBJ001" style="width: 100%; padding: 8px; margin-top: 4px;">
              </div>
              <div style="margin-bottom: 12px;">
                <label>对象简称</label>
                <input type="text" id="objectShortName" placeholder="如：股票" style="width: 100%; padding: 8px; margin-top: 4px;">
              </div>
              <div style="margin-bottom: 12px;">
                <label>对象名称 *</label>
                <input type="text" id="objectName" required style="width: 100%; padding: 8px; margin-top: 4px;">
              </div>
              <div style="margin-bottom: 15px;">
                <label>说明</label>
                <textarea id="objectRemark" rows="3" style="width: 100%; padding: 8px; margin-top: 4px;"></textarea>
              </div>
              <div style="display: flex; gap: 10px; justify-content: flex-end;">
                <button type="button" class="btn btn-secondary" onclick="window.objectCodeManager.closeObjectModal()">取消</button>
                <button type="submit" class="btn btn-primary">保存</button>
              </div>
            </form>
          </div>
        </div>

        <div id="objectCodeManagerStatus" style="margin-top: 10px; font-size: 13px; color: #16a34a; min-height: 18px;"></div>
      </div>
    `;

    this.floatingWindow = new FloatingWindow({
      title: this.windowTitle,
      width: '1000px',
      height: '780px',
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

    document.getElementById('objectForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveObject();
    });

    await this.loadObjectData();
    this.renderDataInfoPanel();
  }

  openAddModal() {
    this.editingId = null;
    document.getElementById('objectModalTitle').textContent = '新增对象';
    document.getElementById('objectForm').reset();
    document.getElementById('objectModal').style.display = 'block';
  }

  async openEditModal(id) {
    if (!this.sqliteDB) return;

    try {
      const table = this.getTableName('objectCodes');
      const result = this.sqliteDB.exec(`SELECT * FROM ${table} WHERE id = ${id}`);
      const row = result[0]?.values?.[0];

      if (row) {
        this.editingId = id;
        document.getElementById('objectModalTitle').textContent = '编辑对象';
        document.getElementById('objectCode').value = row[1];
        document.getElementById('objectShortName').value = row[2] || '';
        document.getElementById('objectName').value = row[3];
        document.getElementById('objectRemark').value = row[4] || '';
        document.getElementById('objectModal').style.display = 'block';
      }
    } catch (e) {
      console.error('[ObjectCodeManager] 加载编辑数据失败:', e);
    }
  }

  closeObjectModal() {
    document.getElementById('objectModal').style.display = 'none';
    this.editingId = null;
  }

  async saveObject() {
    const code = document.getElementById('objectCode').value.trim();
    const shortName = document.getElementById('objectShortName').value.trim();
    const name = document.getElementById('objectName').value.trim();
    const remark = document.getElementById('objectRemark').value.trim();

    if (!code || !name) {
      alert('请填写必填字段（对象代号和对象名称）');
      return;
    }

    if (!this.sqliteDB) {
      await this.initSQLite();
    }

    try {
      const table = this.getTableName('objectCodes');

      if (this.editingId) {
        this.sqliteDB.run(
          `UPDATE ${table} SET code = ?, short_name = ?, name = ?, remark = ? WHERE id = ?`,
          [code, shortName, name, remark, this.editingId]
        );
        this.showStatusMessage('对象更新成功');
      } else {
        this.sqliteDB.run(
          `INSERT INTO ${table} (code, short_name, name, remark) VALUES (?, ?, ?, ?)`,
          [code, shortName, name, remark]
        );
        this.showStatusMessage('对象新增成功');
      }

      this._syncToLocalStorage();
      await this.loadObjectData();
      this.closeObjectModal();
    } catch (e) {
      console.error('[ObjectCodeManager] 保存失败:', e);
      this.showStatusMessage('保存失败: ' + e.message, false);
    }
  }

  async deleteObject(id, code) {
    if (!confirm(`确定要删除对象「${code}」吗？`)) return;

    try {
      const table = this.getTableName('objectCodes');
      this.sqliteDB.run(`DELETE FROM ${table} WHERE id = ?`, [id]);
      this._syncToLocalStorage();
      await this.loadObjectData();
      this.showStatusMessage('对象删除成功');
    } catch (e) {
      console.error('[ObjectCodeManager] 删除失败:', e);
      this.showStatusMessage('删除失败: ' + e.message, false);
    }
  }

  searchObjects() {
    const searchTerm = document.getElementById('objectSearchInput').value.toLowerCase();
    const rows = document.querySelectorAll('#objectsTableBody tr');

    rows.forEach(row => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? '' : 'none';
    });
  }

  showWindowAndWait() {
    return new Promise((resolve) => {
      const checkElement = () => {
        const tableBody = document.getElementById('objectsTableBody');
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

window.objectCodeManager = new ObjectCodeManagerPlugin();
window.objectCodeManager.init();