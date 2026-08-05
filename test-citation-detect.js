// 🧪 实际检测测试 - 模拟 DeepSeek HTML 中真实的引用数字结构
var testCases = [
  { name: '单个数字 <a>1</a>', html: '<a href="#">1</a>' },
  { name: '单个数字 <a>8</a>', html: '<a href="#">8</a>' },
  { name: '带空白的数字 <a> 3 </a>', html: '<a href="#"> 3 </a>' },
  { name: '表格单元格中的引用 <td>...-1-4</td>', html: '<td style="...">受贾半指数暴跌影响，台股重挫1568点，陆资创今年来单日最大卖超<a href="#">-1</a><a href="#">-4</a></td>' },
  { name: '可能的情况：<a>-1</a>', html: '<a href="#">-1</a>' },
  { name: '可能的情况：<a>-1-4</a>', html: '<a href="#">-1-4</a>' },
  { name: '可能的情况：1 在 <a>-1</a> 中', html: '大卖超<a href="...">-1</a><a href="...">-4</a>' },
  { name: '真实 DeepSeek 样式：带 Tailwind 的数字', html: '<div class="...">外资及陆资今天买超新台币286.9亿元 <a class="rounded-full bg-gray-200 text-xs inline-flex items-center justify-center w-5 h-5" href="...">-3</a><a class="rounded-full bg-gray-200 text-xs inline-flex items-center justify-center w-5 h-5" href="...">-8</a></div>' },
  { name: '真实：带 inline style 的数字', html: '<div>外资及陆资今天买超新台币286.9亿元 <a href="..." style="display: inline-block; background: #e5e7eb; padding: 2px 8px; border-radius: 9999px;">3</a><a href="..." style="display: inline-block; background: #e5e7eb; padding: 2px 8px; border-radius: 9999px;">8</a></div>' }
];

// 现有的检测逻辑
function currentDetection(innerText) {
  var trimmedText = (innerText || '').trim();
  var isCitation = /^\d{1,2}$/.test(trimmedText);
  return {
    isCitation: isCitation,
    reason: isCitation ? '匹配 /^\\d{1,2}$/' : '不匹配'
  };
}

// 改进后的检测逻辑
function improvedDetection(innerText) {
  var trimmedText = (innerText || '').trim();
  // 情况1：纯 1-2 位数字
  if (/^\d{1,2}$/.test(trimmedText)) {
    return { isCitation: true, isSimpleDigit: true, reason: '纯数字' };
  }
  // 情况2：带前/后短横线的数字，如 -1、1-、-1-
  if (/^-?\s*\d{1,2}\s*-?$/.test(trimmedText)) {
    return { isCitation: true, isSimpleDigit: false, reason: '带横线的数字' };
  }
  // 情况3：-1-4 形式（数字-数字）
  if (/^-?\s*\d{1,2}\s*-\s*\d{1,2}\s*-?$/.test(trimmedText)) {
    return { isCitation: true, isSimpleDigit: false, multiDigit: true, reason: '多数字引用' };
  }
  return { isCitation: false, reason: '不匹配任何引用模式' };
}

console.log('\n================ 现有检测逻辑 ================\n');
testCases.forEach(function(tc) {
  // 提取 <a> 内部的文字
  var matches = tc.html.match(/<a[^>]*>([^<]+?)<\/a>/gi) || [];
  console.log('【' + tc.name + '】');
  matches.forEach(function(m) {
    var inner = m.replace(/<\/?[^>]+>/g, '');
    var result = currentDetection(inner);
    console.log('  "' + inner + '" → ' + (result.isCitation ? '✅ 圆形边框' : '❌ 普通链接') + ' (' + result.reason + ')');
  });
  console.log('');
});

console.log('\n================ 改进后的检测逻辑 ================\n');
testCases.forEach(function(tc) {
  var matches = tc.html.match(/<a[^>]*>([^<]+?)<\/a>/gi) || [];
  console.log('【' + tc.name + '】');
  matches.forEach(function(m) {
    var inner = m.replace(/<\/?[^>]+>/g, '');
    var result = improvedDetection(inner);
    console.log('  "' + inner + '" → ' + (result.isCitation ? '✅ 圆形边框' : '❌ 普通链接') + ' (' + result.reason + ')');
  });
  console.log('');
});
