# 项目开发规范知识库

> 本文档定义 pureClientA 项目的核心开发规范，所有 AI 助手和开发者必须严格遵守

---

## 📋 目录

1. [版本管理规范](#版本管理规范)
2. [代码编写规范](#代码编写规范)
3. [调试信息规范](#调试信息规范)
4. [项目架构概览](#项目架构概览)

---

## 版本管理规范

### ⚠️⚠️⚠️ 绝对铁律：确认完成 = 必须升版 ⚠️⚠️⚠️

**这是本项目最重要的规则，违反此规则 = 严重失误！**

---

#### 🎯 触发词清单（用户说出以下任一话时，必须立即升版）

**明确确认类**：
- ✅ 「测试OK」/「测试通过了」/「测试OK了」
- ✅ 「可以了」/「好了」/「完成」/「没问题」
- ✅ 「符合预期」/「效果不错」/「很好」

**隐含确认类**：
- ✅ 👍 / 👏 / 🎉 （表情符号确认）
- ✅ 「继续下一步」/「还有其他吗」（表示当前任务已完成）
- ✅ 任何正面反馈 + 没有提出新需求

**⚠️ 危险信号（容易被忽略）**：
- ⚠️ 用户说「谢谢」
- ⚠️ 用户开始问新问题（暗示当前任务已结束）
- ⚠️ 对话自然转向其他话题

---

#### 🔒 强制执行流程（5步检查清单，缺一不可）

**当检测到上述任一触发词时，AI 必须立即执行：**

```
步骤 1: ✅ 立即停止当前话题
       → 不要说「太棒了」「很高兴」等废话
       → 直接进入升版流程

步骤 2: ✅ 更新 VERSION.md
       → 在文件顶部添加新版本记录
       → 格式：### X.Y.Z(NNN) - YYYY-MM-DD
       → 包含：功能说明、改动文件、影响范围

步骤 3: ✅ 更新 versionHistoryPlugin.js
       → 在 VERSION_DATA 变量顶部添加新版本 HTML
       → 确保左上角按钮显示新版本号
       → 确保点击后显示完整的版本历史

步骤 4: ✅ 运行 ./update_version.sh [类型]
       → patch（Bug修复）
       → minor（新功能）← 最常用
       → major（重大更新）

步骤 5: ✅ 向用户报告升版结果
       → 显示新版本号
       → 列出更新的文件
       → 提醒用户强制刷新浏览器
```

---

#### 🛡️ 多重保障机制（防止遗漏）

**保障 1：任务结束时自动检查**
```
每次 TodoWrite 标记任务为 completed 时：
→ 自动扫描是否有代码修改
→ 如果有修改 → 立即提示是否需要升版
```

**保障 2：对话结束前最后检查**
```
在回复用户之前，最后检查一次：
□ 是否有代码修改？
□ 用户是否确认完成？
□ VERSION.md 是否已更新？
□ versionHistoryPlugin.js 是否已更新？
□ 是否运行了 update_version.sh？
→ 如果任何一项为 NO → 立即执行，不要回复用户！
```

**保障 3：RAG 知识库强化记忆**
```
本规则已写入 .trae/rules/project_rules.md
Trae AI 每次启动时会自动索引此文件
→ AI 必须严格遵守，不得以「忘记」「没注意到」为借口
```

---

### ✅ 强制要求：每次完整修改后必须升版

**触发条件**：当用户确认完成一次完整的代码修改后，**必须自动执行以下操作**：

#### 升版流程（按顺序执行）

```bash
# 步骤1：更新 VERSION.md（添加新的版本记录）
# 格式：主版本.次版本.修订版本(构建号) - YYYY-MM-DD

# 步骤2：更新 versionHistoryPlugin.js（硬编码的版本数据）
# 在 VERSION_DATA 变量最前面添加新版本的 HTML

# 步骤3：运行升版脚本
./update_version.sh              # 日常修改：只升级构建号
# 或
./update_version.sh patch        # Bug修复：升级修订版本
./update_version.sh minor        # 新功能：升级次版本  
./update_version.sh major        # 重大更新：升级主版本

# 步骤4：提醒用户强制刷新浏览器
```

#### VERSION.md 记录格式

```markdown
### X.Y.Z(NNN) - YYYY-MM-DD
- **类型**：（新增/修复/优化/重构/重大更新）
- **功能说明**：
  - ✅ 具体改动点1
  - ✅ 具体改动点2
- **改动文件**：
  - 修改：file1.js（改动说明）
  - 新增：file2.js（说明）
```

#### 当前版本信息

- **最新版本**：<code>2.1.1(35)</code> - 2026-05-10
- **版本格式**：`主版本.次版本.修订版本(构建号)`
- **构建号范围**：每次修改递增（当前已到35）

---

## 数据源规范

### ⚠️ 股票清单数据源：必须使用 stockCodeManager

**架构级铁律：所有 UI 组件获取股票清单必须使用 `stockCodeManager.getStockList()`，禁止直接用 `window.STOCKS`/`ALL_STOCKS`！**

```javascript
// ❌ 禁止
const stocks = window.STOCKS;
const stocks = window.ALL_STOCKS;
const stocks = getAllStocks();

// ✅ 异步
const stocks = await window.stockCodeManager.getStockList();

// ✅ 同步（先暖机）
await window.stockCodeManager.getStockList();
const stocks = window.stockCodeManager._getStockListSync();
```

---

## 代码编写规范

### 🌐 语言要求：全中文支持

#### 注释和文档
```javascript
/**
 * 股票清单展示插件
 * 专注于股票数据的只读展示，包括交易统计、持仓信息等
 * 
 * 拆分自 stockCodeManagerPlugin.js（方案B：架构优化）
 * 职责单一：只负责数据展示，不涉及数据管理
 */
```

#### 用户界面文字
```javascript
// ✅ 正确：中文界面
alert('数据库备份成功');
alert('密码错误，取消导入操作');

// ❌ 错误：英文界面（除非专业术语）
alert('Database backup success');
```

#### 变量命名
- 使用英文驼峰命名（标准 JavaScript 规范）
- 但注释必须用中文解释用途

### ⏰ 时间规范：统一使用北京时间

#### 禁止使用的 API
```javascript
// ❌ 错误：toISOString() 返回 UTC 时间（比北京时间晚8小时）
const time = new Date().toISOString();  // 2026-05-09T02:30:00.000Z (UTC)

// ❌ 错误：直接使用 Date 对象可能有时区问题
const time = new Date().toString();     // 可能显示 GMT+0800 或其他格式
```

#### 正确的时间处理方式

**场景1：用户可见的显示时间**
```javascript
// ✅ 正确：格式化为北京时间字符串
function getBeijingTime() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60000));
  
  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');
  const hours = String(beijingTime.getHours()).padStart(2, '0');
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
  const seconds = String(beijingTime.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

// 示例输出：2026-05-09 10:30:00 （北京时间）
```

**场景2：文件名中的时间戳**
```javascript
// ✅ 正确：用于导出文件名
function getBeijingTimestamp() {
  const now = new Date();
  const beijingTime = new Date(now.getTime() + (8 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60000));
  
  const year = beijingTime.getFullYear();
  const month = String(beijingTime.getMonth() + 1).padStart(2, '0');
  const day = String(beijingTime.getDate()).padStart(2, '0');
  const hours = String(beijingTime.getHours()).padStart(2, '0');
  const minutes = String(beijingTime.getMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}_${hours}${minutes}`;
}

// 示例输出：20260509_1030
```

**场景3：元数据和记录存储**
```javascript
// ✅ 正确：存储时保留时区信息
const record = {
  createdAt: new Date().toLocaleString('zh-CN', { 
    hour12: false,
    timeZone: 'Asia/Shanghai' 
  }),
  // 同时保存 ISO 格式用于内部排序（不显示给用户）
  _sortTime: new Date().toISOString()
};
```

#### 时区转换工具函数（推荐在项目中使用）

```javascript
/**
 * 获取当前北京时间
 * @param {string} format - 输出格式 ('full'|'date'|'time'|'timestamp'|'file')
 * @returns {string} 格式化后的北京时间字符串
 */
function getBeijingTime(format = 'full') {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000; // 本地时区偏移（毫秒）
  const beijing = new Date(now.getTime() + offset + (8 * 60 * 60 * 1000)); // 北京时间
  
  const pad = (n) => String(n).padStart(2, '0');
  const y = beijing.getFullYear();
  const m = pad(beijing.getMonth() + 1);
  const d = pad(beijing.getDate());
  const h = pad(beijing.getHours());
  const min = pad(beijing.getMinutes());
  const s = pad(beijing.getSeconds());
  
  switch(format) {
    case 'full':    return `${y}-${m}-${d} ${h}:${min}:${s}`;
    case 'date':    return `${y}-${m}-${d}`;
    case 'time':    return `${h}:${min}:${s}`;
    case 'timestamp': return `${y}${m}${d}${h}${min}${s}`;
    case 'file':    return `${y}${m}${d}_${h}${min}`;
    default:       return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
}
```

---

## 调试信息规范

### ⚠️⚠️⚠️ 最高优先级规则（强制执行）⚠️⚠️⚠️

#### 🎯 触发条件（满足任一即适用本规范）

**当以下情况发生时，必须且只能使用 `DebugAlert` 机制：**

1. **用户明确要求**：「帮我加调试讯息」、「加个调试看看」、「debug一下」等
2. **AI 主动添加**：AI 助手自己在代码中插入调试代码时
3. **问题排查**：需要输出变量值、执行流程、错误信息时
4. **任何调试场景**：只要目的是调试/诊断/追踪，就必须用 DebugAlert

#### ✅ 唯一正确的做法

```javascript
// ✅✅✅ 正确：使用 DebugAlert 累积式调试（唯一允许的方式）
DebugAlert.add('步骤1: 开始处理数据');
DebugAlert.add(`变量值: ${variable}`);
DebugAlert.add('处理完成');
DebugAlert.show(); // 统一显示所有累积的讯息

// 快捷方法（带状态图标）
DebugAlert.info('一般信息');     // ℹ️ 信息
DebugAlert.success('操作成功');   // ✅ 成功
DebugAlert.warn('警告提示');      // ⚠️ 警告
DebugAlert.error('严重错误', true); // ❌ 错误（立即显示）
```

#### ❌❌❌ 绝对禁止的做法（违反本规范）

```javascript
// ❌❌❌ 错误1：使用 console.log（用户看不到！）
console.log('调试信息');

// ❌❌❌ 错误2：每次调用独立 alert（太烦人！）
alert('调试1');
alert('调试2');

// ❌❌❌ 错误3：使用旧版 DebugUtils.showDebugInfo()
// （会产生左上角浮窗，已废弃，会被自动转发但不应直接调用）
DebugUtils.showDebugInfo('调试信息');

// ❌❌❌ 错误4：自己写 alert 拼接字符串
let msg = '';
msg += '调试1\n';
msg += '调试2\n';
alert(msg);
```

#### 🔧 为什么必须用 DebugAlert？

| 问题 | DebugAlert 的解决方案 |
|------|---------------------|
| 用户不想开控制台 | ✅ 用 Alert 弹窗显示 |
| 多条调试讯息很烦 | ✅ 累积收集，一次性显示 |
| 复制粘贴给 AI 很麻烦 | ✅ 统一格式，一键全选复制 |
| 不知道是北京时间还是 UTC | ✅ 自动添加北京时间戳 |
| 分不清信息/警告/错误 | ✅ 用图标区分（ℹ️✅⚠️❌） |
| 讯息太多看不过来 | ✅ 支持分隔线分组 |

---

### 🚨 核心原则：必须使用 alert 显示调试讯息

**重要原因**：
- 用户不想打开浏览器控制台查看调试信息
- 需要快速复制调试内容给 AI 助手
- 减少操作步骤，提升效率

### ✅ 强制要求：连续调试讯息合并显示

#### 实现方式：累积式调试讯息收集器

```javascript
/**
 * 全局调试讯息管理器
 * 特点：
 * 1. 累积多条讯息，一次性显示
 * 2. 支持手动触发显示或达到阈值自动显示
 * 3. 方便用户复制粘贴给 AI 助手
 */
window.DebugAlert = {
  messages: [],
  autoShowThreshold: 10, // 累积10条后自动显示
  
  /**
   * 添加调试讯息（不立即显示）
   * @param {string} message - 调试讯息
   * @param {boolean} immediate - 是否立即显示（默认false）
   */
  add: function(message, immediate = false) {
    const timestamp = window.getBeijingTime ? getBeijingTime('time') : new Date().toLocaleTimeString('zh-CN');
    this.messages.push(`[${timestamp}] ${message}`);
    
    console.log(`[调试] ${message}`); // 同时输出到控制台作为备份
    
    if (immediate || this.messages.length >= this.autoShowThreshold) {
      this.show();
    }
  },
  
  /**
   * 显示所有累积的调试讯息
   */
  show: function() {
    if (this.messages.length === 0) {
      alert('没有调试讯息');
      return;
    }
    
    const header = `=== 调试讯息 (${this.messages.length}条) ===\n`;
    const content = this.messages.join('\n');
    const footer = `\n=== 讯息结束 ===`;
    
    alert(header + content + footer);
    
    // 显示后清空（避免重复显示）
    this.messages = [];
  },
  
  /**
   * 清空所有未显示的讯息
   */
  clear: function() {
    this.messages = [];
  }
};
```

#### 使用示例

```javascript
// 场景1：连续调试（累积多条后一次性显示）
function debugProcessData(data) {
  DebugAlert.add('开始处理数据...');
  DebugAlert.add(`数据长度: ${data.length}`);
  
  data.forEach((item, index) => {
    DebugAlert.add(`[${index}] 名称: ${item.name}, 价格: ${item.price}`);
    // 处理逻辑...
  });
  
  DebugAlert.add('数据处理完成');
  DebugAlert.add(`总计: ${data.length} 条记录`);
  
  DebugAlert.show(); // 手动触发显示所有讯息
}

// 场景2：关键错误立即显示
if (errorOccurred) {
  DebugAlert.add(`严重错误: ${error.message}`, true); // immediate=true 立即显示
}

// 场景3：异步操作调试
async function debugAsyncOperation() {
  try {
    DebugAlert.add('步骤1: 开始异步请求...');
    const result = await fetchData();
    DebugAlert.add(`步骤2: 收到响应, 大小: ${result.size}`);
    
    const processed = await processData(result);
    DebugAlert.add(`步骤3: 处理完成, 数量: ${processed.count}`);
    
    DebugAlert.show(); // 显示整条链路的调试讯息
  } catch (e) {
    DebugAlert.add(`异步操作失败: ${e.message}`, true);
  }
}
```

### ❌ 禁止使用的调试方式

```javascript
// ❌ 错误1：单独使用 console.log（用户看不到）
console.log('调试信息'); 

// ❌ 错误2：每次调用都弹出独立 alert（太烦人）
alert('调试1');
alert('调试2');
alert('调试3');

// ❌ 错误3：使用现有的 debugUtils.js（显示在页面上，不方便复制）
DebugUtils.showDebugInfo('调试信息');
```

### ✅ 推荐的调试模式

```javascript
// 模式1：函数级调试（进入/退出/关键节点）
function complexFunction(param) {
  DebugAlert.add(`[进入] complexFunction(${param})`);
  
  try {
    const step1Result = step1(param);
    DebugAlert.add(`[步骤1] 结果: ${JSON.stringify(step1Result)}`);
    
    const step2Result = step2(step1Result);
    DebugAlert.add(`[步骤2] 结果类型: ${typeof step2Result}`);
    
    const finalResult = finalize(step2Result);
    DebugAlert.add(`[完成] 最终结果: ${finalResult}`);
    
    return finalResult;
  } catch (e) {
    DebugAlert.add(`[异常] ${e.stack}`, true); // 出错立即显示
    throw e;
  }
}

// 模式2：循环调试（追踪每次迭代）
function processArray(items) {
  DebugAlert.add(`[循环开始] 总数: ${items.length}`);
  
  items.forEach((item, i) => {
    const status = processItem(item);
    DebugAlert.add(`[${i}/${items.length}] ${item.id}: ${status}`);
  });
  
  DebugAlert.show(); // 循环结束后统一显示
}

// 模式3：条件断点式调试
if (someCondition) {
  DebugAlert.add(`[条件触发] 变量a=${a}, 变量b=${b}`);
  DebugAlert.show(); // 立即显示以便分析
}
```

---

## 项目架构概览

### 技术栈

| 类别 | 技术 | 说明 |
|------|------|------|
| 前端框架 | 原生 JavaScript | 无框架依赖 |
| UI 组件 | FloatingWindow | 自定义浮动窗口组件 |
| 数据库 | sql.js (WebAssembly) | 浏览器端 SQLite |
| 缓存 | localStorage + IndexedDB | 双层缓存机制 |
| OCR | Tesseract.js | 截图文字识别 |

### 核心插件系统

```
pureClientA/
├── baseManagerPlugin.js          # 基类（所有管理插件的父类）
├── stockCodeManagerPlugin.js     # 股票代码管理
├── stockListDisplayPlugin.js     # 股票清单展示（只读）
├── categoryManagerPlugin.js      # 类别代码管理
├── objectCodeManagerPlugin.js    # 对象代号管理
├── screenshotVerifyPlugin.js     # 截图对账验证
├── compactDataExportPlugin.js    # 紧凑模式数据导出
├── sqliteBackupPlugin.js         # SQLite 备份工具
├── settingsExportImport.js       # 设置导入导出
├── ocrEngine.js                  # OCR 引擎
└── debugUtils.js                 # 调试工具（页面显示模式）
```

### 关键全局对象

| 对象名 | 类型 | 用途 |
|--------|------|------|
| `window.stockCodeManager` | StockCodeManagerPlugin | 股票代码管理实例 |
| `window.stockDisplay` | StockListDisplayPlugin | 股票清单展示实例 |
| `window.categoryManager` | CategoryManagerPlugin | 类别管理实例 |
| `window.objectManager` | ObjectCodeManagerPlugin | 对象管理实例 |
| `window.tradesDB` | TradesDB | 主数据库实例 |
| `window.DebugUtils` | Object | 页面调试工具（旧版） |
| `window.DebugAlert` | Object | Alert调试工具（新版，推荐） |

### 数据流架构

```
用户操作 → 插件方法 → SQLite/IndexedDB → UI刷新
                ↓
         DebugAlert.add() ← 调试讯息收集
                ↓
         DebugAlert.show() ← 统一弹窗显示
```

---

## 附录：快速检查清单

### ✅ 提交代码前必查

- [ ] 所有注释都是中文？
- [ ] 所有用户可见的文字都是中文？
- [ ] 所有时间都使用北京时间（非 UTC）？
- [ ] 调试讯息都通过 `DebugAlert.add()` 收集？
- [ ] 连续调试讯息最后调用 `DebugAlert.show()` 统一显示？
- [ ] 如果是完整修改，是否已更新 VERSION.md？
- [ ] 是否运行了 `./update_version.sh`？

### 🔧 常用代码片段

```javascript
// 1. 获取北京时间
const beijingTime = getBeijingTime('full');

// 2. 添加调试讯息
DebugAlert.add('处理开始');
DebugAlert.add(`变量值: ${variable}`);

// 3. 显示调试讯息（在关键节点）
DebugAlert.show();

// 4. 错误处理（立即显示）
try {
  // 代码逻辑
} catch (e) {
  DebugAlert.add(`错误: ${e.message}`, true); // immediate=true
}

// 5. 版本更新提醒（在完成修改后）
console.log('[提示] 请记得运行 ./update_version.sh 更新版本');
```

---

**文档版本**：1.1.0  
**最后更新**：2026-05-10  
**适用范围**：pureClientA 项目所有代码修改
