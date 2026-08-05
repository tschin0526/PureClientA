// 🧪 测试：引用数字圆形边框效果
var testHtml = `根据台湾证券交易所的数据，外资及陆资今天买超新台币286.9亿元 <a href="https://deepseek.com/ref/1" style="display: inline-block; background: #e5e7eb; padding: 2px 8px;">3</a><a href="https://deepseek.com/ref/2" style="display: inline-block; background: #e5e7eb; padding: 2px 8px;">8</a>。今天外资终结了连续6个交易日的卖超，转为买超 <a href="#" style="display: block; text-align: center;">点击查看详情</a>，另外有更详细的数据来源：<a href="#">1</a><a href="#">2</a><a href="#">9</a>。单数字：<a href="#">5</a>。`;

// 模拟完整流程
function cleanHtmlWhitespace_test(html) {
  var cleaned = html;
  // 简化：直接清理所有 style 的破坏性样式
  cleaned = cleaned.replace(/style="[^"]*"/gi, function(match) {
    var newStyle = match
      .replace(/text-align:\s*[^;]+;?/gi, '')
      .replace(/background(?:-color)?\s*:\s*[^;]+;?/gi, '')
      .replace(/padding(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
      .replace(/margin(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
      .replace(/display:\s*(?:block|flex|inline-flex|grid|inline-block|table|inline-table)[^;]*;?/gi, '')
      .replace(/border(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
      .replace(/border-radius:\s*[^;]+;?/gi, '')
      .replace(/box-shadow:\s*[^;]+;?/gi, '')
      .replace(/var\(--[^)]+\)/gi, '')
      .replace(/rgba?\([^)]+\)/gi, '');
    newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^style="\s*;\s*/, 'style="').replace(/\s*;\s*"$/, '"');
    if (/^style="\s*"?$/.test(newStyle)) return '';
    return newStyle;
  });
  return cleaned;
}

function injectInlineStyles_test(html) {
  var styles = {
    'a': 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;',
    'a_citation': 'display: inline-flex !important; align-items: center !important; justify-content: center !important; border: 1.5px solid #64748b !important; border-radius: 50% !important; width: 20px !important; height: 20px !important; font-size: 11px !important; font-weight: 600 !important; color: #64748b !important; text-decoration: none !important; margin: 0 2px !important; line-height: 1 !important; vertical-align: middle !important; background: transparent !important;'
  };

  var result = html;
  result = result.replace(/<a(\s[^>]*)?>([^<]*?)<\/a>/gi, function(match, attrs, innerText) {
    var cleanedAttrs = (attrs || '').replace(/style\s*=\s*"[^"]*"/gi, '').trim();
    var trimmedText = (innerText || '').trim();
    var isCitation = /^\d{1,2}$/.test(trimmedText);
    var styleToUse = isCitation ? (styles['a_citation'] || styles['a']) : styles['a'];

    if (cleanedAttrs && cleanedAttrs.length > 0) {
      return '<a style="' + styleToUse + '" ' + cleanedAttrs + '>' + innerText + '</a>';
    } else {
      return '<a style="' + styleToUse + '">' + innerText + '</a>';
    }
  });
  return result;
}

console.log('\n==== 原始 HTML ====');
console.log(testHtml);

var step1 = cleanHtmlWhitespace_test(testHtml);
var finalHtml = injectInlineStyles_test(step1);

console.log('\n==== 处理后 ====');
console.log(finalHtml);

console.log('\n==== 检查结果 ====');
// 检查引用数字应该有圆形边框
var citationMatches = finalHtml.match(/<a[^>]*border-radius:\s*50%[^>]*>\s*\d+\s*<\/a>/gi) || [];
console.log('引用数字（带圆形边框）数量:', citationMatches.length);
citationMatches.forEach(function(m, i) {
  console.log('  ' + (i + 1) + '.', m.substring(0, 120));
});

// 检查普通链接应该是蓝色下划线
var normalLinks = finalHtml.match(/<a[^>]*text-decoration:\s*underline[^>]*>[^<]*<\/a>/gi) || [];
console.log('\n普通链接（蓝色下划线）数量:', normalLinks.length);
normalLinks.slice(0, 3).forEach(function(m, i) {
  console.log('  ' + (i + 1) + '.', m);
});

console.log('\n==== 视觉预览（简化）');
// 可视化测试：模拟引用数字 3 应该显示成圆圈
console.log('圆形边框的数字：');
console.log('  -3-8 应该显示为 -[3]-[8]');
console.log('  123 应该显示为 [1][2][3]');
console.log('其中 [x] 代表带圆圈的数字 x');
console.log('');
