# 创建完整的 objectData.js 文件
content = '''// 对象代码数据模块
// 将对象数据独立出来，便于维护和修改

const OBJECT_DATA_SCHEMA = {
  version: '1.0.0',
  updatedAt: '2026-04-28',
  
  objectCodes: {
    tableName: 'object_codes',
    columns: [
      { name: 'id', type: 'INTEGER PRIMARY KEY AUTOINCREMENT' },
      { name: 'code', type: 'TEXT UNIQUE NOT NULL' },
      { name: 'short_name', type: 'TEXT' },
      { name: 'name', type: 'TEXT NOT NULL' },
      { name: 'remark', type: 'TEXT' }
    ]
  },
  
  metadata: {
    tableName: '_metadata',
    columns: [
      { name: 'key', type: 'TEXT PRIMARY KEY' },
      { name: 'value', type: 'TEXT' }
    ]
  }
};

const SQLITE_BACKUP_FILENAME = 'object_code_data.db';

const ALL_OBJECT_CODES = [
  { code: 'STOCK', shortName: '股票', name: '股票类', remark: '各种股票' },
  { code: 'ETF', shortName: 'ETF', name: '指数型基金', remark: '指数型基金' },
  { code: 'BOND', shortName: '债券', name: '债券', remark: '债券' },
  { code: 'FUND', shortName: '基金', name: '共同基金', remark: '共同基金' },
  { code: 'COMMODITY', shortName: '商品', name: '大宗商品', remark: '大宗商品' }
];

let OBJECT_CODES = [...ALL_OBJECT_CODES];

function getAllObjectCodes() {
  return ALL_OBJECT_CODES;
}

function getObjectCodes() {
  return OBJECT_CODES;
}

function setObjectCodes(objectCodes) {
  OBJECT_CODES = objectCodes;
  if (typeof window !== 'undefined') {
    window.OBJECT_CODES = OBJECT_CODES;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    OBJECT_CODES, ALL_OBJECT_CODES,
    getAllObjectCodes, getObjectCodes, setObjectCodes,
    OBJECT_DATA_SCHEMA, SQLITE_BACKUP_FILENAME
  };
}

if (typeof window !== 'undefined') {
  window.OBJECT_CODES = OBJECT_CODES;
  window.ALL_OBJECT_CODES = ALL_OBJECT_CODES;
  window.getAllObjectCodes = getAllObjectCodes;
  window.getObjectCodes = getObjectCodes;
  window.setObjectCodes = setObjectCodes;
  window.OBJECT_DATA_SCHEMA = OBJECT_DATA_SCHEMA;
  window.SQLITE_BACKUP_FILENAME_OBJECT_CODE = SQLITE_BACKUP_FILENAME;
}
'''

with open('objectData.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('objectData.js created successfully')
