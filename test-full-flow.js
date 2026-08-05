// 模拟 AI 交互框的完整渲染流程
var doubaoHtml = `<div>二、对应 JSON 数据集</div><div>json</div><div><code>{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33,"wind":"西南风2~3级"},{"date":"2026-06-13","weekday":"周六","weather":"阴有阵雨或雷雨","temp_low":22}]}</code></div><div>要不要我把这份 JSON 保存成文件给你...</div>`;

console.log('=== 模拟完整的 AI 交互框渲染流程 ===\n');
console.log('步骤0: 原始输入长度:', doubaoHtml.length);
console.log('');

// ======= 步骤1: cleanHtmlWhitespace =======
function cleanHtmlWhitespace(html) {
  var cleaned = html;
  cleaned = cleaned
    .replace(/>\s+</g, '><')
    .replace(/\n\s*\n/g, '\n')
    .replace(/^\s+|\s+$/g, '');
  return cleaned;
}
var step1 = cleanHtmlWhitespace(doubaoHtml);
console.log('步骤1 (cleanHtmlWhitespace) 后:', step1.length, '字符');
console.log('  → 是否还包含 <code>{...}？', /<code>\{/.test(step1) ? '✅ 是' : '❌ 否');
console.log('');

// ======= 步骤2: formatJsonBlocks（当前版本） =======
function formatJsonBlocks_current(html) {
  if (!html) return html;
  var hasJsonShape = /[\[{"]/.test(html);
  if (!hasJsonShape) return html;
  var result = html;
  var changed = false;

  // 步骤1: 匹配完整的 <code ...>...</code> 标签对
  var codeTagPattern = /<code([^>]*)>([^<]*)<\/code>/gi;
  result = result.replace(codeTagPattern, function(match, attrs, innerText) {
    var trimmed = String(innerText).trim();
    if (!trimmed) return match;
    var firstChar = trimmed.charAt(0);
    var lastChar = trimmed.charAt(trimmed.length - 1);
    if (!((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']'))) return match;
    if (trimmed.indexOf(':') === -1) return match;
    if (trimmed.length < 30) return match;

    var decoded = trimmed
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    try {
      var parsed = JSON.parse(decoded);
      var formatted = JSON.stringify(parsed, null, 2);
      var escaped = formatted
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      changed = true;
      return '<pre><code class="language-json">' + escaped + '</code></pre>';
    } catch (e) { return match; }
  });

  // 步骤2: 扫描普通容器
  var inPreOrCode = false;
  var segments = [];
  var cursor = 0;
  var tagPattern = /<\/?(pre|code)[^>]*>/gi;
  var tagMatch;
  while ((tagMatch = tagPattern.exec(result)) !== null) {
    var tagStart = tagMatch.index;
    var tagText = tagMatch[0];
    var tagName = tagMatch[1].toLowerCase();
    var isClosing = /^<\//.test(tagText);
    if (!inPreOrCode) {
      segments.push(processPlainTextForJson(result.substring(cursor, tagStart)));
      segments.push(tagText);
      if (!isClosing) inPreOrCode = true;
    } else {
      segments.push(result.substring(cursor, tagStart));
      segments.push(tagText);
      if (isClosing) inPreOrCode = false;
    }
    cursor = tagMatch.index + tagText.length;
  }
  if (cursor < result.length) {
    if (!inPreOrCode) segments.push(processPlainTextForJson(result.substring(cursor)));
    else segments.push(result.substring(cursor));
  }
  result = segments.join('');
  return result;

  function processPlainTextForJson(textChunk) {
    if (!textChunk) return textChunk;
    return textChunk.replace(/>([^<>]+)</g, function(m, inner) {
      var trimmed = String(inner).trim();
      if (!trimmed || trimmed.replace(/\s+/g, '').length === 0) return m;
      var firstChar = trimmed.charAt(0);
      var lastChar = trimmed.charAt(trimmed.length - 1);
      if (!((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']'))) return m;
      if (trimmed.indexOf(':') === -1) return m;
      if (trimmed.length < 30) return m;

      var decoded = trimmed
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      try {
        var parsed = JSON.parse(decoded);
        var formatted = JSON.stringify(parsed, null, 2);
        var escaped = formatted
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        changed = true;
        return '><pre><code class="language-json">' + escaped + '</code></pre><';
      } catch (e) { return m; }
    });
  }
}

var step2 = formatJsonBlocks_current(step1);
console.log('步骤2 (formatJsonBlocks) 后:', step2.length, '字符');
console.log('  → 是否现在包含 <pre>?', /<pre[\s\S]*?<\/pre>/.test(step2) ? '✅ 是' : '❌ 否');
console.log('');

// ======= 步骤3: injectInlineStyles =======
function injectInlineStyles(html) {
  var styles = {
    'code': 'background: #fee2e2 !important; color: #dc2626 !important; padding: 2px 6px !important; border-radius: 4px !important; border: 1px solid #fca5a5 !important; font-family: monospace !important; font-size: 13px !important;',
    'pre': 'background: #f8f9fa !important; color: #24292e !important; padding: 16px !important; border-radius: 6px !important; border: 1px solid #e1e4e8 !important; overflow-x: auto !important; margin: 16px 0 !important; font-family: monospace !important; font-size: 13px !important; line-height: 1.6 !important; white-space: pre-wrap !important; word-break: break-all !important;',
    'div': 'word-break: break-word !important; line-height: 1.7 !important;'
  };

  var result = html;
  Object.keys(styles).forEach(function(tag) {
    var style = styles[tag];
    var regex = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');
    result = result.replace(regex, function(match, attrs) {
      if (attrs && attrs.indexOf('style=') > -1) {
        return match.replace(/style="([^"]*)"/i, 'style="$1 ' + style + '"');
      } else {
        return '<' + tag + (attrs || '') + ' style="' + style + '">';
      }
    });
  });
  return result;
}

var step3 = injectInlineStyles(step2);
console.log('步骤3 (injectInlineStyles) 后:', step3.length, '字符');
console.log('  → <pre> 是否有 white-space？', /<pre[^>]*style="[^"]*white-space: pre-wrap/.test(step3) ? '✅ 是' : '❌ 否');

// 提取 <pre> 标签看看
var preMatch = step3.match(/<pre[\s\S]*?<\/pre>/i);
if (preMatch) {
  console.log('  → <pre> 标签内容:', preMatch[0].substring(0, 150), '...');
  // 检查 <code> 是否在 <pre> 内
  var codeInPre = preMatch[0].match(/<code[\s\S]*?<\/code>/i);
  if (codeInPre) {
    console.log('  → <code> 在 <pre> 内是否有 white-space？', /white-space/.test(codeInPre[0]) ? '有' : '无');
    console.log('  → <code> 样式中是否有 white-space？', /white-space/.test(codeInPre[0]) ? '有（会覆盖 pre 的！）' : '无（继承 pre 的 pre-wrap）');
  }
}
console.log('');

// ======= 关键检查：<pre> 内的 <code> 是否会覆盖 white-space？ =======
console.log('=== 关键检查：CSS 继承分析 ===');
console.log('浏览器中：');
console.log('  1. <pre style="white-space: pre-wrap"> 给所有子元素设置 white-space');
console.log('  2. <code> 元素默认 display: inline，但继承 white-space');
console.log('  3. 如果 <code> 没有自己设 white-space，就继承 <pre> 的 pre-wrap');
console.log('  4. 关键问题：injectInlineStyles 给 ALL <code> 加样式，但');
console.log('     不设 white-space！所以应该会继承...');
console.log('');
console.log('但等一下！我们来检查 <code> 的实际 CSS 属性：');
console.log('  <code> style: padding: 2px 6px !important; font-size: 13px !important; ...');
console.log('  没有 white-space！理论上会继承 pre-wrap');
console.log('');

console.log('=== 等等，让我检查一个更可能的问题 ===');
console.log('当我们有 <pre><code>...</code></pre> 时：');
console.log('  - <pre> 的 white-space: pre-wrap 让换行生效');
console.log('  - 但浏览器中，<code> 在 <pre> 内有时会被当成 inline 元素');
console.log('  - 如果 code 是 inline，它的内容应该被 <pre> 的 white-space 控制');
console.log('');

// 让我检查一下实际浏览器中会如何渲染
// 在浏览器中 <pre> 的 white-space 默认就是 'pre'，它会让所有文本（包括子元素中的）按字面量换行
// 但是关键问题是：我们的 JSON 字符串中有没有真正的 \n 换行符？

console.log('=== 最关键的检查：JSON 格式化后的字符串中有没有 \n？ ===');

// 模拟 JSON 格式化
var testJson = '{"city":"杭州","temp":23}';
var parsed = JSON.parse(testJson);
var formatted = JSON.stringify(parsed, null, 2);
console.log('格式化后的 JSON：');
console.log(formatted);
console.log('');
console.log('换行符数量:', (formatted.match(/\n/g) || []).length);
console.log('字符 10 是什么？', JSON.stringify(formatted.charAt(10)));  // 找到第一个 \n
console.log('');

var escaped = formatted
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
console.log('HTML escape 后是否还保留 \\n？');
console.log('  → 前50字符:', JSON.stringify(escaped.substring(0, 50)));
console.log('  → 有 \n 吗？', escaped.indexOf('\n') > -1 ? '✅ 有！' : '❌ 没有！');

// 最后检查：<pre> 内的 <code> 的文本会不会被浏览器当成单行？
console.log('\n=== 关键的关键：===');
console.log('HTML: <pre><code>' + formatted.substring(0, 50).replace(/\n/g, '\\n') + '...</code></pre>');
console.log('');
console.log('在浏览器中，这应该会按 \n 换行，因为 <pre> 的 white-space: pre-wrap');
console.log('但是如果 injectInlineStyles 给 <code> 加了 white-space: normal 就会出问题！');
console.log('让我检查 code 样式是否有 white-space...');

var codeStyle = 'background: #fee2e2 !important; color: #dc2626 !important; padding: 2px 6px !important; border-radius: 4px !important; border: 1px solid #fca5a5 !important; font-family: monospace !important; font-size: 13px !important;';
console.log('  <code> 的 style:', codeStyle);
console.log('  是否有 white-space？', codeStyle.indexOf('white-space') > -1 ? '有' : '没有 ✅');

console.log('\n=== 理论上应该能工作。那问题是什么呢？ ===');
console.log('让我检查 DOMPurify 是否移除了 \n 字符！');
