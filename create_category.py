# 创建干净的 categoryData.js 文件
content = '''// 类别代码数据模块
const ALL_CATEGORIES = [
  { code: "TW-STOCK", shortName: "台股", name: "台湾股票", remark: "包含所有台湾上市股票" },
  { code: "CN-STOCK", shortName: "陆股", name: "大陆股票", remark: "包含所有大陆A股和ETF" },
  { code: "US-STOCK", shortName: "美股", name: "美国股票", remark: "包含美国市场股票" },
  { code: "TW-ETF", shortName: "台湾ETF", name: "台湾指数型基金", remark: "台湾指数型基金" },
  { code: "CN-ETF", shortName: "大陆ETF", name: "大陆A股指数型基金", remark: "各类指数基金" },
  { code: "US-ETF", shortName: "美股ETF", name: "美国指数型基金", remark: "美国指数型基金" },
  { code: "BOND", shortName: "债券", name: "债券类产品", remark: "政府债、公司债等" },
  { code: "FUND", shortName: "基金", name: "共同基金", remark: "开放式/封闭式基金" },
  { code: "COMMODITY", shortName: "商品", name: "大宗商品", remark: "黄金、原油等" }
];
let CATEGORIES = [...ALL_CATEGORIES];
if (typeof window !== "undefined") {
  window.ALL_CATEGORIES = ALL_CATEGORIES;
  window.CATEGORIES = CATEGORIES;
}
'''

with open('categoryData.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('categoryData.js created successfully')
