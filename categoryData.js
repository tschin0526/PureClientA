// 类别代码数据模块
(function() 
{
  'use strict';

  if (typeof window === 'undefined') {
    return;
  }

  const ALL_CATEGORIES_PRIVATE = [
    { code: 'TW22-STOCK', shortName: '台股', name: '台湾股票', remark: '包含所有台湾上市股票' },
    { code: 'CN1-STOCK', shortName: '陆股', name: '大陆股票', remark: '包含所有大陆A股和ETF' },
    { code: 'US1-STOCK', shortName: '美股', name: '美国股票', remark: '包含美国市场股票' },
    { code: 'TW22-ETF', shortName: '台湾ETF', name: '台湾指数型基金', remark: '台湾指数型基金' },
    { code: 'CN1-ETF', shortName: '大陆ETF', name: '大陆A股指数型基金', remark: '各类指数基金' },
    { code: 'US1-ETF', shortName: '美股ETF', name: '美国指数型基金', remark: '美国指数型基金' },
    { code: 'BOND', shortName: '债券', name: '债券类产品', remark: '政府债、公司债等' },
    { code: 'FUND', shortName: '基金', name: '共同基金', remark: '开放式/封闭式基金' },
    { code: 'FUND1', shortName: '基金1', name: '共同基金1', remark: '开放式/封闭式基金1' },
    { code: 'COMMODITY-001', shortName: '商品', name: '大宗商品', remark: '黄金、原油等' },        
    { code: 'COMMODITY-002', shortName: '商品2', name: '大宗商品2', remark: '黄金、原油等' }
  ];

  ALL_CATEGORIES_PRIVATE.forEach(item => Object.freeze(item));
  Object.freeze(ALL_CATEGORIES_PRIVATE);

  window.ALL_CATEGORIES = ALL_CATEGORIES_PRIVATE;
  window.CATEGORIES = Array.from(ALL_CATEGORIES_PRIVATE);

  window.CATEGORY_DATA_SCHEMA = {
    version: '1.0.0',
    updatedAt: '2026-04-28',
    categories: {
      tableName: 'categories',
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

  window.SQLITE_BACKUP_FILENAME_CATEGORY = 'category_data.db';

  window.getAllCategories = function() {
    return window.ALL_CATEGORIES;
  };

  window.getCategories = function() {
    return window.CATEGORIES;
  };

  window.setCategories = function(categories) {
    window.CATEGORIES = categories;
  };
}
());