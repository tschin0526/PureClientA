// 对象代码数据模块
(function() {
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }

  const ALL_OBJECT_CODES_PRIVATE = [
    { code: 'STOCK', shortName: '股票', name: '股票类', remark: '各种股票' },
    { code: 'ETF-A01', shortName: 'ETFAAA', name: '指数型基金', remark: '指数型基金' },
    { code: 'BOND1', shortName: '债券', name: '债券', remark: '债券' },
    { code: 'FUND2', shortName: '基金', name: '共同基金', remark: '共同基金' },
    { code: 'FUND3', shortName: '基金A', name: '共同基金A', remark: '共同基金A' },   
    { code: 'FUND-B', shortName: '基金B', name: '共同基金B', remark: '共同基金B' },     
    { code: 'COMMODITY1', shortName: '商品', name: '大宗商品', remark: '大宗商品' }
  ];

  ALL_OBJECT_CODES_PRIVATE.forEach(item => Object.freeze(item));
  Object.freeze(ALL_OBJECT_CODES_PRIVATE);

  window.ALL_OBJECT_CODES = ALL_OBJECT_CODES_PRIVATE;
  window.OBJECT_CODES = Array.from(ALL_OBJECT_CODES_PRIVATE);

  window.OBJECT_DATA_SCHEMA = {
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

  window.SQLITE_BACKUP_FILENAME_OBJECT_CODE = 'object_code_data.db';

  window.getAllObjectCodes = function() {
    return window.ALL_OBJECT_CODES;
  };

  window.getObjectCodes = function() {
    return window.OBJECT_CODES;
  };

  window.setObjectCodes = function(codes) {
    window.OBJECT_CODES = codes;
  };
}());
