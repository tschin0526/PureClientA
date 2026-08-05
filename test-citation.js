// 模拟 DeepSeek 引用数字的 HTML 结构
// 在 DeepSeek 网页中，这些引用数字通常是带 Tailwind 类名的小圆圈标签：
// 例如：
// <a href="..." class="rounded-full bg-gray-200 hover:bg-gray-300 text-xs text-gray-600 inline-flex items-center justify-center w-5 h-5 border border-gray-300 text-xs font-medium no-underline">1</a>

var testHtml = `根据今天（2026年6月12日）的最新数据，台股外资不仅没有流出，反而出现了大规模的流入<br><br>今天外资终结了连续6个交易日的卖超，转为买超，具体情况如下：<br><br>• 今日买入：根据台湾证券交易所的数据，外资及陆资今天买超新台币286.9亿元 <a href="https://example.com/ref/1" style="display: inline-block; border-radius: 9999px; background: #e5e7eb; color: #374151; padding: 2px 8px; font-size: 11px; text-decoration: none; border: 1px solid #d1d5db; margin: 0 2px;">1</a><a href="https://example.com/ref/2" style="display: inline-block; border-radius: 9999px; background: #e5e7eb; color: #374151; padding: 2px 8px; font-size: 11px; text-decoration: none; border: 1px solid #d1d5db; margin: 0 2px;">2</a><a href="https://example.com/ref/9" style="display: inline-block; border-radius: 9999px; background: #e5e7eb; color: #374151; padding: 2px 8px; font-size: 11px; text-decoration: none; border: 1px solid #d1d5db; margin: 0 2px;">9</a>。<br><br>• 逆转趋势：在此之前，外资已经连续卖超台股6天。今天的买超有力地扭转了这一趋势，并带动大盘指数上涨超过1000点。`;

console.log('=== 第一步：cleanHtmlWhitespace 后的结果 ===');

// 模拟 cleanHtmlWhitespace 的实际逻辑
function cleanHtmlWhitespace(html) {
  var cleaned = html;
  // 移除 Tailwind 类名（关键！）
  // 只移除包含 Tailwind 的 class，保留 style 属性和内部文本内容！
  cleaned = cleaned.replace(/\s*class="[^"]*(?:dark:text-|max-w-|flex flex-|border-\[|rounded-|bg-\[|text-\[|p-\[|m-\[)[^"]*"/gi, '');
  console.log('  [步骤 A - 移除 Tailwind 后：', /<a[^>]*>.*?<\/a>/gi.exec(cleaned)?.[0]?.substring(0, 200))

  // 移除非文本块
  const patterns = [/<svg[\s\S]*?<\/svg>/gi, /<math[\s\S]*?<\/math>/gi, /<span class="katex[\s\S]*?<\/span>/gi, /<canvas[^>]*><\/canvas>/gi, /<script[\s\S]*?<\/script>/gi, /<style[\s\S]*?<\/style>/gi, /<button[\s\S]*?<\/button>/gi, /<input[^>]*>/gi, /<i class="icon[\s\S]*?<\/i>/gi];
  patterns.forEach(function(pattern) { cleaned = cleaned.replace(pattern, ''); });

  // 移除多余空白
  cleaned = cleaned.replace(/>\s+</g, '><').replace(/\n\s*\n/g, '\n').replace(/^\s+|\s+$/g, '');
  return cleaned;
}

var step1 = cleanHtmlWhitespace(testHtml);

// 检查 <a> 的完整内容
var matches = step1.match(/<a[^>]*>.*?<\/a>/gi);
console.log('  <a> 标签内容:');
matches && matches.forEach(function(m) {
  console.log('    ', m.substring(0, 150));
});
console.log('');

console.log('=== 第二步：injectInlineStyles（现在的 <a> 替换逻辑 ===');

function injectInlineStyles(html) {
  var styles = {
    'a': 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;'
  };
  var result = html;
  Object.keys(styles).forEach(function(tag) {
    var style = styles[tag];
    var regex = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');

    result = result.replace(regex, function(match, attrs) {
      // 对 <a> 特殊处理：完全替换原有 style
      return match.replace(/style\s*=\s*"[^"]*"/gi, '').replace(/<a(\s|>)/i, function(m, sep) {
        return '<a style="' + style + '"' + (sep === '>' ? '>' : sep);
      });
    });
  });
  return result;
}

var step2 = injectInlineStyles(step1);
var matches2 = step2.match(/<a[^>]*>[^<]*<\/a>/gi);
console.log('  <a> 标签（替换后:');
matches2 && matches2.forEach(function(m) {
  console.log('    ', m.substring(0, 200));
});
console.log('');
console.log('=== 第三步：检查 <a> 的 textContent 还在不在？===');
matches2 && matches2.forEach(function(m, i) {
  var innerMatch = m.match(/<a[^>]*>([^<]*)<\/a>/i);
  console.log('  第', (i+1), '个 <a>: 内容=', innerMatch ? innerMatch[1] : '(空', ' ！');
});
