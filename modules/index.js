// 模块导出文件

// 导出历史数据模块（数据处理层）
const HistoryDataModule = require('./historyDataModule');

// 导出历史数据UI插件（展示层）
const HistoryDataPlugin = require('./historyDataPlugin');

// 导出所有模块
module.exports = {
  HistoryDataModule,
  HistoryDataPlugin
};

// 在浏览器环境中也导出到全局
if (typeof window !== 'undefined') {
  window.Modules = {
    HistoryDataModule,
    HistoryDataPlugin
  };
}
