// 🧪 完整流程测试（模拟真实 DeepSeek HTML → 清理 → 注入样式）
var rawHtml = `
<div style="text-align: left; padding: 10px;">
  <table style="border-collapse: collapse;">
    <tr>
      <td style="padding: 8px; text-align: left;">受贾半指数暴跌影响，台股重挫1568点，陆资创今年来单日最大卖超<a href="#" style="display: inline-block; background: #e5e7eb; padding: 2px 8px; border-radius: 9999px;">-1</a><a href="#" style="display: inline-block; background: #e5e7eb; padding: 2px 8px; border-radius: 9999px;">-4</a></td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: left;">市场持续消化利空，陆资卖超力度与昨日基本持平<a href="#" style="display: inline-block; background: #e5e7eb; padding: 2px 8px;">-3</a><a href="#" style="display: inline-block; background: #e5e7eb; padding: 2px 8px;">-8</a></td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: left;">卖压大幅减缓，指数盘中一度反弹，陆资卖超缩小<a href="#" style="display: inline-block;">-2</a><a href="#" style="display: inline-block;">-7</a></td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: left;">转为净买入，市场恐慌情绪缓解，低接买盘进场<a href="#" style="display: inline-block;">-5</a></td>
    </tr>
    <tr>
      <td style="padding: 8px; text-align: left;">这是一个<span style="font-weight: bold;">普通链接</span>：<a href="https://example.com">点击查看详情</a></td>
    </tr>
  </table>
</div>
`;

// 模拟 1) cleanHtmlWhitespace 中 style 清理
var step1 = rawHtml.replace(/style="[^"]*"/gi, function(match) {
  var newStyle = match
    .replace(/text-align:\s*[^;]+;?/gi, '')
    .replace(/background(?:-color)?\s*:\s*[^;]+;?/gi, '')
    .replace(/padding(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
    .replace(/margin(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
    .replace(/display:\s*(?:block|flex|inline-flex|grid|inline-block|table|inline-table)[^;]*;?/gi, '')
    .replace(/border(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
    .replace(/border-radius:\s*[^;]+;?/gi, '')
    .replace(/box-shadow:\s*[^;]+;?/gi, '')
    .replace(/position:\s*(?:absolute|relative|fixed|sticky)[^;]*;?/gi, '')
    .replace(/float:\s*[^;]+;?/gi, '');

  newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^style="\s*;\s*/, 'style="').replace(/\s*;\s*"$/, '"');
  if (/^style="\s*"?$/.test(newStyle)) return '';
  return newStyle;
});

console.log('======== Step 1: style 清理后 ========\n');
console.log('重点检查 <a>-1</a> 和 <a>-4</a> 是否保留 href 但去掉了破坏性 style：');
var linkMatches = step1.match(/<a[^>]*>-?\d+[^<]*<\/a>/gi) || [];
linkMatches.slice(0, 4).forEach(function(m, i) {
  console.log('  ' + (i + 1) + '. ' + m);
});

// 模拟 2) injectInlineStyles 中 <a> 标签智能处理
var citationStyle = 'display: inline-block !important; text-align: center !important; border: 1.5px solid #475569 !important; border-radius: 50% !important; min-width: 18px !important; height: 18px !important; line-height: 15px !important; font-size: 10px !important; font-weight: 600 !important; color: #475569 !important; text-decoration: none !important; margin: 0 1px !important; vertical-align: baseline !important; background: transparent !important; padding: 0 !important;';
var normalLinkStyle = 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;';

var step2 = step1.replace(/<a(\s[^>]*)?>([^<]*?)<\/a>/gi, function(match, attrs, innerText) {
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

console.log('\n======== Step 2: 注入样式后 ========\n');
console.log('检查引用数字链接：');
var citationMatches = step2.match(/<a[^>]*border-radius:\s*50%[^>]*>\d+<\/a>/gi) || [];
citationMatches.forEach(function(m, i) {
  console.log('  ✅ ' + m.substring(0, 100) + '...');
});

console.log('\n检查普通链接：');
var normalMatches = step2.match(/<a[^>]*text-decoration:\s*underline[^>]*>[^<]*<\/a>/gi) || [];
normalMatches.forEach(function(m, i) {
  console.log('  ✅ ' + m.substring(0, 120) + '...');
});

console.log('\n======== 最终效果（视觉预览）========\n');
var preview = step2
  .replace(/<a[^>]*border-radius:\s*50%[^>]*>(\d+)<\/a>/gi, function(m, d) { return '[⓪①②③④⑤⑥⑦⑧⑨]'.match(new RegExp('\\[' + d + '\\]|\\[[^' + d + '\\]]{2,}\\]')) ? '[' + d + ']' : '(' + d + ')'; })
  .replace(/<a[^>]*>[^<]*<\/a>/gi, function(m) { return '<蓝色下划线:' + m.replace(/<[^>]+>/g, '') + '>'; })
  .replace(/<[^>]+>/g, ' ');

console.log(preview.replace(/\s+/g, ' ').trim());
console.log('\n注：[①] [②] [③] [④] 代表圆形边框的数字');
