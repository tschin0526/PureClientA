# 创建干净的 objectData.js 文件
content = '''// 对象代码数据模块
const ALL_OBJECT_CODES = [
  { code: "STOCK", shortName: "股票", name: "股票类", remark: "各种股票" },
  { code: "ETF", shortName: "ETF", name: "指数型基金", remark: "指数型基金" },
  { code: "BOND", shortName: "债券", name: "债券", remark: "债券" },
  { code: "FUND", shortName: "基金", name: "共同基金", remark: "共同基金" },
  { code: "COMMODITY", shortName: "商品", name: "大宗商品", remark: "大宗商品" }
];
let OBJECT_CODES = [...ALL_OBJECT_CODES];
if (typeof window !== "undefined") {
  window.ALL_OBJECT_CODES = ALL_OBJECT_CODES;
  window.OBJECT_CODES = OBJECT_CODES;
}
'''

with open('objectData.js', 'w', encoding='utf-8') as f:
    f.write(content)
print('objectData.js created successfully')
