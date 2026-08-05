# 创建完整的 categoryData.js 文件
content = '''// 类别代码数据模块
// 将类别数据独立出来，便于维护和修改

const CATEGORY_DATA_SCHEMA = {
  version: "1.0.0",
  updatedAt: "2026-04-27",
  
  categories: {
    tableName: "categories",
    columns: [
      { name: "id", type: "INTEGER PRIMARY KEY AUTOINCREMENT" },
      { name: "code", type: "TEXT UNIQUE NOT NULL" },
      { name: "short_name", type: "TEXT" },
      { name: "name", type: "TEXT NOT NULL" },
      { name: "remark", type: "TEXT" }
    ]
  },
  
  metadata: {
    tableName: "_metadata",
    columns: [
      { name: "key", type: "TEXT PRIMARY KEY" },
      { name: "value", type: "