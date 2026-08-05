// 模拟更接近真实的场景
// 注意：从豆包抓取的 innerHTML 中，JSON 里的 { } 可能已经有 <span> 包裹

// 场景1: 简单的 JSON 在 <code> 里（测试脚本里能工作）
var simpleCase = '<div><code>{"city":"杭州","temp":23}</code></div>';

// 场景2: 更真实的场景 - JSON 在普通 div 里，没有 code 标签（这是截图的实际情况！）
var realCase = `<div>二、对应 JSON 数据集</div><div>json</div><div class="json-block">{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33,"wind":"西南风2~3级"},{"date":"2026-06-13","weekday":"周六","weather":"阴有阵雨或雷雨","temp_low":22}]}</div><div>要不要我把这份 JSON 保存成文件给你...</div>`;

// 场景3: JSON 在 <code> 里，但 code 有 class 属性
var case3 = '<div><code class="language-json">{"city":"杭州","forecast_7days":[{"date":"2026-06-12"}]}</code></div>';

console.log('=== 检查 AI 交互框当前的 formatJsonBlocks ===\n');

// 从 aiChatParserPlugin.js 实际代码中取出关键逻辑
function formatJsonBlocks_current(html) {
  if (!html) return html;

  var hasJsonShape = /[\[{"]/.test(html);
  if (!hasJsonShape) return html;

  var result = html;
  var changed = false;

  // 步骤1: 匹配完整的 <code ...>...</code> 标签对（[^\s>]* 匹配属性， [^<]* 不允许内部有标签）
  var codeTagPattern = /<code([^>]*)>([^<]*)<\/code>/gi;
  result = result.replace(codeTagPattern, function(match, attrs, innerText) {
    console.log('  → 步骤1 匹配到 <code>，内容:', innerText.substring(0, 50));
    var trimmed = String(innerText).trim();
    if (!trimmed) return match;

    var firstChar = trimmed.charAt(0);
    var lastChar = trimmed.charAt(trimmed.length - 1);
    console.log('  → firstChar=', JSON.stringify(firstChar), 'lastChar=', JSON.stringify(lastChar));
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
    } catch (e) { console.log('  → JSON.parse 失败:', e.message); return match; }
  });

  // 步骤2: 扫描普通容器（扫描器跟踪 pre/code）
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
      var beforeTag = result.substring(cursor, tagStart);
      segments.push(processPlainTextForJson(beforeTag));
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
      console.log('  → 步骤2 扫描到文本:', inner.substring(0, 60));
      var trimmed = String(inner).trim();
      if (!trimmed || trimmed.replace(/\s+/g, '').length === 0) return m;
      var firstChar = trimmed.charAt(0);
      var lastChar = trimmed.charAt(trimmed.length - 1);
      console.log('  → firstChar=', JSON.stringify(firstChar), 'lastChar=', JSON.stringify(lastChar));
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
      } catch (e) { console.log('  → JSON.parse 失败:', e.message); return m; }
    });
  }
}

console.log('--- 场景1: JSON 在 <code> 中（简单） ---');
var r1 = formatJsonBlocks_current(simpleCase);
var hasPre1 = /<pre[^>]*>/.test(r1);
console.log('结果: 是否有 <pre>？', hasPre1 ? '✅' : '❌');
console.log('');

console.log('--- 场景2: JSON 在普通 <div> 中（无 code 标签，这是真实场景！） ---');
var r2 = formatJsonBlocks_current(realCase);
var hasPre2 = /<pre[^>]*>/.test(r2);
console.log('结果: 是否有 <pre>？', hasPre2 ? '✅' : '❌');
console.log('');

console.log('--- 场景3: JSON 在带 class 的 <code> 中 ---');
var r3 = formatJsonBlocks_current(case3);
var hasPre3 = /<pre[^>]*>/.test(r3);
console.log('结果: 是否有 <pre>？', hasPre3 ? '✅' : '❌');
console.log('');

console.log('=== 关键结论 ===');
console.log('场景1 (简单code):', hasPre1 ? '能工作' : '❌');
console.log('场景2 (真实 div):', hasPre2 ? '能工作' : '❌ 最关键的场景失败！');
console.log('场景3 (带class code):', hasPre3 ? '能工作' : '❌');
