// 模拟豆包/DeepSeek 等 AI 平台返回的真实 HTML
// 它们经常在 JSON 的不同部分外面包上 <span> 做语法高亮！

// 场景 A：简单版 - JSON 在 <code> 中，但每个 token 用 <span> 包裹
var html_A = `<div>二、对应 JSON 数据集</div>
<div>json</div>
<div>
  <code>
    <span class="token punctuation">{</span>
    <span class="token property">"city"</span>
    <span class="token operator">:</span>
    <span class="token string">"杭州"</span>
    <span class="token punctuation">,</span>
    <span class="token property">"update_time"</span>
    <span class="token operator">:</span>
    <span class="token string">"2026-06-12 18:00"</span>
    <span class="token punctuation">}</span>
  </code>
</div>
<div>要不要我把这份 JSON 保存成文件给你...</div>`;

// 场景 B：更简单 - 只有一个大的 <code> 包裹整个 JSON
var html_B = `<div>二、对应 JSON 数据集</div>
<div>json</div>
<div>
  <code class="language-json">{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33,"wind":"西南风2~3级"}]}</code>
</div>
<div>要不要我把这份 JSON 保存成文件给你...</div>`;

// 场景 C：最糟糕的情况 - JSON 在普通 <div> 里，根本没有任何代码标签
var html_C = `<div>二、对应 JSON 数据集</div>
<div>json</div>
<div class="json-block">{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33}]}</div>
<div>要不要我把这份 JSON 保存成文件给你...</div>`;

console.log('=== 用当前 AI 交互框的 formatJsonBlocks 测试三个真实场景 ===\n');

function formatJsonBlocks_current(html) {
  if (!html) return html;
  var hasJsonShape = /[\[{"]/.test(html);
  if (!hasJsonShape) return html;
  var result = html;
  var changed = false;

  // 步骤1: 匹配完整的 <code ...>...</code> 标签对
  // ❌ 问题：[^<]* 只能匹配不含 < 的内容！如果 code 内有 <span>，就匹配不到！
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
    // ❌ 问题：/>([^<>]+)</g 只能匹配标签间的纯文本！
    // 如果 JSON 在 <div> 内部，应该也能检测到
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

// ============ 测试 ============
var scenes = [
  { name: '场景 A：<code> 内有 <span> 做语法高亮', html: html_A },
  { name: '场景 B：<code> 包裹纯 JSON（没有 span）', html: html_B },
  { name: '场景 C：JSON 在普通 <div> 里（没有 code 标签）', html: html_C }
];

for (var i = 0; i < scenes.length; i++) {
  var scene = scenes[i];
  var out = formatJsonBlocks_current(scene.html);
  var hasPre = /<pre[\s\S]*?<\/pre>/.test(out);
  console.log('[' + (i + 1) + '] ' + scene.name);
  console.log('    → ' + (hasPre ? '✅ 成功格式化为 <pre>！' : '❌ 仍然是一行（未被检测到！）'));
  console.log('');
}

console.log('=== 核心问题分析 ===\n');
console.log('❌ 场景 A 失败原因：/<code([^>]*)>([^<]*)<\\/code>/gi 中的 [^<]*');
console.log('   因为 <code> 内部有 <span>，第一个 < 就终止了匹配！');
console.log('');
console.log('❌ 场景 C 失败原因：/>([^<>]+)</g 只在标签边界之间检测');
console.log('   需要在"标签内部文本"中也能检测到 JSON');
console.log('');
console.log('=== 解决方案 ===\n');
console.log('✅ 用 <code([^>]*)>([\\s\\S]*?)<\\/code> 代替 [^<]*');
console.log('   允许 code 内部有任意内容（包括 <span> 等）');
console.log('');
console.log('✅ 在 code 内部用 extractPlainText 移除 <span> 等标签后再 JSON.parse');
console.log('');
console.log('✅ 场景 C：需要一个"全局扫描器"，在任何位置（标签间+标签内）找有效的 JSON');
