// 🧪 真实场景测试：DeepSeek 中引用数字的实际 HTML 结构

// 假设 1：DeepSeek 中引用数字是简单的 <a>-1</a>
var test1 = '受贾半指数暴跌影响，台股重挫1568点，陆资创今年来单日最大卖超<a href="https://chat.deepseek.com/ref/1" style="display:inline-block;background:#e5e7eb;padding:2px 8px;border-radius:9999px;color:#374151;">-1</a><a href="https://chat.deepseek.com/ref/4" style="display:inline-block;background:#e5e7eb;padding:2px 8px;border-radius:9999px;color:#374151;">-4</a>。';

// 假设 2：DeepSeek 中引用数字内部有 <span> 嵌套
var test2 = '陆资创今年来单日最大卖超<a href="#" style="..."><span style="font-size:11px;color:#374151;">-1</span></a><a href="#" style="..."><span style="font-size:11px;color:#374151;">-4</span></a>';

// 假设 3：DeepSeek 中引用数字内部有多个 <span>（高亮 + 数字）
var test3 = '最大卖超<a href="#" style="display:inline-block;text-align:center;background:#f3f4f6;border-radius:9999px;padding:2px 6px;border:1px solid #e5e7eb;margin:0 1px;font-size:11px;color:#6b7280;text-decoration:none;"><span style="color:#6b7280;font-size:11px;">-3-8</span></a>';

// 假设 4：每个数字是单独的 <a> 标签（DeepSeek 真实格式）
var test4 = '最大卖超<a class="inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-medium" href="#" style="margin:0 1px;">-1</a><a class="inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-medium" href="#" style="margin:0 1px;">-4</a>';

// 模拟 injectInlineStyles 的 <a> 处理逻辑
function injectATags(html) {
  var citationStyle = 'display: inline-block !important; text-align: center !important; border: 1.5px solid #475569 !important; border-radius: 50% !important; min-width: 18px !important; height: 18px !important; line-height: 15px !important; font-size: 10px !important; font-weight: 600 !important; color: #475569 !important; text-decoration: none !important; margin: 0 1px !important; vertical-align: baseline !important; background: transparent !important; padding: 0 !important;';
  var normalLinkStyle = 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;';

  // 当前的正则
  var result = html.replace(/<a(\s[^>]*)?>([^<]*?)<\/a>/gi, function(match, attrs, innerText) {
    var cleanedAttrs = (attrs || '').replace(/style\s*=\s*"[^"]*"/gi, '').trim();
    var trimmedText = (innerText || '').trim();

    var isSimpleDigit = /^\d{1,2}$/.test(trimmedText);
    var isHyphenDigit = /^-?\s*\d{1,2}\s*-?$/.test(trimmedText);
    var isMultiDigit = /^-?\s*\d{1,2}\s*-\s*\d{1,2}\s*-?$/.test(trimmedText);
    var isCitation = isSimpleDigit || isHyphenDigit || isMultiDigit;

    var styleToUse, displayContent;
    if (isCitation) {
      styleToUse = citationStyle;
      var digitsOnly = trimmedText.replace(/[-\s]/g, '');
      displayContent = digitsOnly || trimmedText;
    } else {
      styleToUse = normalLinkStyle;
      displayContent = innerText;
    }

    if (cleanedAttrs && cleanedAttrs.length > 0) {
      return '<a style="' + styleToUse + '" ' + cleanedAttrs + '>' + displayContent + '</a>';
    } else {
      return '<a style="' + styleToUse + '">' + displayContent + '</a>';
    }
  });

  return result;
}

console.log('======== 测试用例分析 ========\n');

[test1, test2, test3, test4].forEach(function(t, idx) {
  console.log('【测试 ' + (idx + 1) + '】原始 HTML 中的 <a> 标签：');
  var matches = t.match(/<a[\s\S]*?<\/a>/gi) || [];
  matches.forEach(function(m) {
    // 提取内部文本（去标签）
    var innerText = m.replace(/<[^>]+>/g, '');
    console.log('  原始标签: ' + m.substring(0, 120));
    console.log('  纯文本内容: "' + innerText.trim() + '"');
    console.log('  正则匹配到的内容: "' + (m.match(/<a[\s>]*([^<]*?)<\/a>/i) || [])[1] + '"');
    console.log('');
  });
});

console.log('\n======== 处理结果分析 ========\n');

[test1, test2, test3, test4].forEach(function(t, idx) {
  console.log('【测试 ' + (idx + 1) + '】处理后：');
  var processed = injectATags(t);

  // 检查是否有圆形边框样式
  var hasCircleStyle = processed.indexOf('border-radius: 50%') > -1;
  var hasNormalStyle = processed.indexOf('text-decoration: underline') > -1;

  console.log('  ✅ 应用圆形边框:', hasCircleStyle);
  console.log('  ✅ 应用普通下划线:', hasNormalStyle);

  // 显示最终的 <a> 标签内容（去掉长的 style，只看关键）
  var finalAs = processed.match(/<a[^>]*>[^<]*<\/a>/gi) || [];
  console.log('  最终 <a> 内容:');
  finalAs.forEach(function(a) {
    var simplified = a.replace(/style="[^"]*"/gi, 'style="【圆形边框】"').substring(0, 100);
    console.log('    ' + simplified);
  });
  console.log('');
});

console.log('\n======== 关键问题检查 ========\n');

// 测试：如果 <a> 内部有 <span>，[^<]*? 会匹配失败
var testSpan = '<a href="#" style="..."><span style="font-size:11px;">-3</span></a>';
var match1 = testSpan.match(/<a(\s[^>]*)?>([^<]*?)<\/a>/i);
console.log('测试 <a><span>-3</span></a> 的匹配:');
console.log('  整体 match:', match1 ? match1[0] : 'NULL');
console.log('  innerText 捕获组:', match1 ? match1[2] : 'NULL');
console.log('  ❗️ 如果 innerText 是空字符串，trim() 后会变成空字符串，无法检测到引用数字！');
console.log('');

// 改进：允许 <a> 内部有任意嵌套标签，然后提取纯文本
var match2 = testSpan.match(/<a[\s\S]*?<\/a>/i);
if (match2) {
  var innerHtml = match2[0].replace(/<a[^>]*>/i, '').replace(/<\/a>/i, '');
  var plainText = innerHtml.replace(/<[^>]+>/g, '').trim();
  console.log('改进方案 - 提取纯文本:');
  console.log('  <a> 内部 HTML: "' + innerHtml + '"');
  console.log('  去掉所有标签后: "' + plainText + '"');
  console.log('  ✅ 这样就能正确检测到 "-3" 是引用数字了！');
}
