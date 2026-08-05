-- 创建数据库表结构

-- 创建 tax_rates 表
CREATE TABLE IF NOT EXISTS tax_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT UNIQUE NOT NULL,
  buy REAL NOT NULL,
  sell REAL NOT NULL,
  rebate REAL NOT NULL,
  min_tax_amount REAL NOT NULL
);

-- 创建 stocks 表
CREATE TABLE IF NOT EXISTS stocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  qty INTEGER NOT NULL,
  market TEXT NOT NULL,
  type TEXT NOT NULL,
  is_frequent INTEGER DEFAULT 0
);

-- 插入税率数据
INSERT INTO tax_rates (type, buy, sell, rebate, min_tax_amount) VALUES
('tETF', 14.16, 23.14, 9.91, 0),
('tA', 14.16, 46.25, 9.91, 0),
('cETF', 1.05, 1.05, 0, 5),
('cA', 1.05, 9, 0, 5),
('cG', 0, 0, 0, 0);

-- 插入股票数据
INSERT INTO stocks (name, qty, market, type, is_frequent) VALUES
('台股A50', 1000, '台股', 'tETF', 0),
('富邦深100', 1000, '台股', 'tETF', 0),
('群台精', 1000, '台股', 'tETF', 0),
('国永高', 1000, '台股', 'tETF', 0),
('复华科', 1000, '台股', 'tETF', 0),
('永丰优息', 1000, '台股', 'tETF', 0),
('中信金', 1000, '台股', 'tA', 1),
('元大金', 1000, '台股', 'tA', 1),
('国泰金', 1000, '台股', 'tA', 0),
('富邦金', 1000, '台股', 'tA', 0),
('统一', 1000, '台股', 'tA', 0),
('南亚', 1000, '台股', 'tA', 0),
('远传', 1000, '台股', 'tA', 0),
('台哥大', 1000, '台股', 'tA', 0),
('红利50ETF', 20000, '陆股', 'cETF', 1),
('证券ETF', 20000, '陆股', 'cETF', 0),
('软件ETF', 20000, '陆股', 'cETF', 1),
('银行ETF', 20000, '陆股', 'cETF', 0),
('半导体', 20000, '陆股', 'cETF', 1),
('恒生科技ETF', 20000, '陆股', 'cETF', 1),
('兴业银行', 1000, '陆股', 'cA', 0),
('嘉美包装', 500, '陆股', 'cA', 0),
('红棉股份', 5000, '陆股', 'cA', 0),
('联芸科技', 500, '陆股', 'cA', 0),
('神华', 500, '陆股', 'cA', 0),
('中矿', 500, '陆股', 'cA', 0),
('科创50', 20000, '陆股', 'cETF', 0),
('安通控股', 10000, '陆股', 'cA', 0),
('泰鸿', 1000, '陆股', 'cA', 0),
('AI智能', 20000, '陆股', 'cETF', 1),
('机器人', 20000, '陆股', 'cETF', 0),
('黄金ETF', 3000, '陆股', 'cETF', 0),
('医疗ETF', 50000, '陆股', 'cETF', 0),
('陆股A50', 20000, '陆股', 'cETF', 0),
('兴业积存金', 5, '陆股', 'cG', 1);

-- 验证数据
SELECT '税率数据' as type, COUNT(*) as count FROM tax_rates;
SELECT '股票数据' as type, COUNT(*) as count FROM stocks;
SELECT '频繁交易股票' as type, COUNT(*) as count FROM stocks WHERE is_frequent = 1;