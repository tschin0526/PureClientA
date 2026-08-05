#!/usr/bin/env node

/**
 * 将 stockData.js 中的股票数据转换为 SQLite 数据库
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// 读取 stockData.js 文件
const stockDataPath = path.join(__dirname, 'stockData.js');
const stockDataContent = fs.readFileSync(stockDataPath, 'utf8');

// 提取股票数据
function extractStockData() {
  // 提取 ALL_STOCKS 数组
  const allStocksMatch = stockDataContent.match(/const ALL_STOCKS = \[([\s\S]*?)\];/);
  if (!allStocksMatch) {
    throw new Error('无法提取 ALL_STOCKS 数据');
  }
  
  const allStocksStr = allStocksMatch[1];
  // 提取 FREQUENT_STOCKS 数组
  const frequentStocksMatch = stockDataContent.match(/const FREQUENT_STOCKS = \[([\s\S]*?)\];/);
  if (!frequentStocksMatch) {
    throw new Error('无法提取 FREQUENT_STOCKS 数据');
  }
  
  const frequentStocksStr = frequentStocksMatch[1];
  
  // 提取 TAX_RATES 对象
  const taxRatesMatch = stockDataContent.match(/const TAX_RATES = \{([\s\S]*?)\};/);
  if (!taxRatesMatch) {
    throw new Error('无法提取 TAX_RATES 数据');
  }
  
  const taxRatesStr = taxRatesMatch[1];
  
  // 转换为 JavaScript 对象
  const allStocks = eval(`[${allStocksStr}]`);
  const frequentStocks = eval(`[${frequentStocksStr}]`);
  const taxRates = eval(`{${taxRatesStr}}`);
  
  return { allStocks, frequentStocks, taxRates };
}

// 创建 SQLite 数据库
function createDatabase() {
  const dbPath = path.join(__dirname, 'stocks.db');
  
  // 如果数据库文件已存在，先删除
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
    console.log('已删除旧的数据库文件');
  }
  
  const db = new sqlite3.Database(dbPath);
  return db;
}

// 创建表结构
function createTables(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 创建 tax_rates 表
      db.run(`
        CREATE TABLE IF NOT EXISTS tax_rates (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          type TEXT UNIQUE NOT NULL,
          buy REAL NOT NULL,
          sell REAL NOT NULL,
          rebate REAL NOT NULL,
          min_tax_amount REAL NOT NULL
        )
      `, (err) => {
        if (err) return reject(err);
        
        // 创建 stocks 表
        db.run(`
          CREATE TABLE IF NOT EXISTS stocks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            qty INTEGER NOT NULL,
            market TEXT NOT NULL,
            type TEXT NOT NULL,
            is_frequent INTEGER DEFAULT 0
          )
        `, (err) => {
          if (err) return reject(err);
          resolve();
        });
      });
    });
  });
}

// 插入税率数据
function insertTaxRates(db, taxRates) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO tax_rates (type, buy, sell, rebate, min_tax_amount)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    let count = 0;
    const types = Object.keys(taxRates);
    
    types.forEach(type => {
      const rate = taxRates[type];
      stmt.run(type, rate.buy, rate.sell, rate.rebate, rate.minTaxAmount, (err) => {
        if (err) return reject(err);
        count++;
        if (count === types.length) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

// 插入股票数据
function insertStocks(db, allStocks, frequentStocks) {
  return new Promise((resolve, reject) => {
    const stmt = db.prepare(`
      INSERT INTO stocks (name, qty, market, type, is_frequent)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    let count = 0;
    const totalStocks = allStocks.length;
    
    // 创建频繁交易股票的集合，用于快速查找
    const frequentStockNames = new Set(frequentStocks.map(stock => stock.name));
    
    allStocks.forEach(stock => {
      const isFrequent = frequentStockNames.has(stock.name) ? 1 : 0;
      stmt.run(stock.name, stock.qty, stock.market, stock.type, isFrequent, (err) => {
        if (err) return reject(err);
        count++;
        if (count === totalStocks) {
          stmt.finalize();
          resolve();
        }
      });
    });
  });
}

// 验证数据
function verifyData(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 检查税率数据
      db.get('SELECT COUNT(*) as count FROM tax_rates', (err, row) => {
        if (err) return reject(err);
        console.log(`税率数据：${row.count} 条`);
        
        // 检查股票数据
        db.get('SELECT COUNT(*) as count FROM stocks', (err, row) => {
          if (err) return reject(err);
          console.log(`股票数据：${row.count} 条`);
          
          // 检查频繁交易股票
          db.get('SELECT COUNT(*) as count FROM stocks WHERE is_frequent = 1', (err, row) => {
            if (err) return reject(err);
            console.log(`频繁交易股票：${row.count} 条`);
            resolve();
          });
        });
      });
    });
  });
}

// 主函数
async function main() {
  try {
    console.log('开始转换股票数据到 SQLite 数据库...');
    
    // 提取数据
    const { allStocks, frequentStocks, taxRates } = extractStockData();
    console.log(`提取到 ${allStocks.length} 只股票，${frequentStocks.length} 只频繁交易股票`);
    
    // 创建数据库
    const db = createDatabase();
    console.log('创建 SQLite 数据库成功');
    
    // 创建表结构
    await createTables(db);
    console.log('创建表结构成功');
    
    // 插入税率数据
    await insertTaxRates(db, taxRates);
    console.log('插入税率数据成功');
    
    // 插入股票数据
    await insertStocks(db, allStocks, frequentStocks);
    console.log('插入股票数据成功');
    
    // 验证数据
    await verifyData(db);
    console.log('数据验证成功');
    
    // 关闭数据库
    db.close();
    console.log('转换完成！数据库文件：stocks.db');
    
  } catch (error) {
    console.error('转换过程中出现错误：', error);
    process.exit(1);
  }
}

// 检查是否安装了 sqlite3
if (!require.resolve('sqlite3')) {
  console.error('错误：需要安装 sqlite3 包');
  console.error('请运行：npm install sqlite3');
  process.exit(1);
}

// 执行主函数
main();