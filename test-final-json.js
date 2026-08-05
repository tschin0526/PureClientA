// 测试修复后的 formatJsonBlocks 对真实场景的处理
// 直接从 aiChatParserPlugin.js 中提取核心逻辑进行测试

// ========= 场景 A：豆包/DeepSeek 常见格式 - JSON 在 <code> 中被 <span> 拆分 =========
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
    <span class="token punctuation">,</span>
    <span class="token property">"forecast_7days"</span>
    <span class="token operator">:</span>
    <span class="token punctuation">[</span>
    <span class="token punctuation">{</span>
    <span class="token property">"date"</span>
    <span class="token operator">:</span>
    <span class="token string">"2026-06-12"</span>
    <span class="token punctuation">,</span>
    <span class="token property">"weather"</span>
    <span class="token operator">:</span>
    <span class="token string">"阴转多云"</span>
    <span class="token punctuation">}</span>
    <span class="token punctuation">]</span>
    <span class="token punctuation">}</span>
  </code>
</div>`;

// ========= 场景 B：简单版 - JSON 在 <code> 中，没有嵌套标签 =========
var html_B = `<div>二、对应 JSON 数据集</div><div>json</div><div><code class="language-json">{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33,"wind":"西南风2~3级"}]}</code></div><div>要不要我把这份 JSON 保存成文件给你...</div>`;

// ========= 场景 C：普通 div 中的 JSON =========
var html_C = `<div>二、对应 JSON 数据集</div><div>json</div><div class="json-block">{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云"}]}</div>`;

// ========= 复制修改后的 formatJsonBlocks 核心逻辑 =========
function formatJsonBlocks_fixed(html) {
  if (!html) return html;
  var hasJsonShape = /[\[{"]/.test(html);
  if (!hasJsonShape) return html;
  var result = html;
  var changed = false;

  // 步骤 1：匹配 <code ...>...</code>（允许内部有 <span> 等标签！）
  var codeTagPattern = /<code([^>]*)>([\s\S]*?)<\/code>/gi;
  result = result.replace(codeTagPattern, function(match, attrs, innerHtml) {
    // 提取纯文本 - 移除内部标签
    var plainText = innerHtml
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    if (!plainText || plainText.length < 30) return match;
    if (plainText.indexOf(':') === -1) return match;

    var firstChar = plainText.charAt(0);
    var lastChar = plainText.charAt(plainText.length - 1);
    if (!((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']'))) {
      var jsonMatch = plainText.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (!jsonMatch || jsonMatch[0].length < 30) return match;
      plainText = jsonMatch[0];
    }

    try {
      var parsed = JSON.parse(plainText);
      var formatted = JSON.stringify(parsed, null, 2);
      var escaped = formatted
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
      changed = true;
      return '<pre><code class="language-json">' + escaped + '</code></pre>';
    } catch (e) { return match; }
  });

  // 步骤 2：处理普通容器中的 JSON
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
      var formattedChunk = beforeTag.replace(/>([^<>]+)</g, function(m, inner) {
        var trimmed = String(inner).trim();
        if (!trimmed || trimmed.replace(/\s+/g, '').length === 0) return m;
        var decoded = trimmed
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        var firstChar = decoded.charAt(0);
        var lastChar = decoded.charAt(decoded.length - 1);
        if (!((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']'))) {
          var jsonMatch = decoded.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (!jsonMatch || jsonMatch[0].length < 30) return m;
          decoded = jsonMatch[0];
        }
        if (decoded.indexOf(':') === -1) return m;
        if (decoded.length < 30) return m;
        try {
          var parsed = JSON.parse(decoded);
          var formatted = JSON.stringify(parsed, null, 2);
          var escaped = formatted
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          changed = true;
          return '><pre><code class="language-json">' + escaped + '</code></pre><';
        } catch (e) { return m; }
      });
      segments.push(formattedChunk);
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
    if (!inPreOrCode) {
      var lastPart2 = result.substring(cursor);
      var formattedLast = lastPart2.replace(/>([^<>]+)</g, function(m, inner) {
        var trimmed = String(inner).trim();
        if (!trimmed || trimmed.replace(/\s+/g, '').length === 0) return m;
        var decoded = trimmed
          .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
        var firstChar = decoded.charAt(0);
        var lastChar = decoded.charAt(decoded.length - 1);
        if (!((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']'))) {
          var jsonMatch = decoded.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
          if (!jsonMatch || jsonMatch[0].length < 30) return m;
          decoded = jsonMatch[0];
        }
        if (decoded.indexOf(':') === -1) return m;
        if (decoded.length < 30) return m;
        try {
          var parsed = JSON.parse(decoded);
          var formatted = JSON.stringify(parsed, null, 2);
          var escaped = formatted
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          changed = true;
          return '><pre><code class="language-json">' + escaped + '</code></pre><';
        } catch (e) { return m; }
      });
      segments.push(formattedLast);
    } else {
      segments.push(result.substring(cursor));
    }
  }

  return segments.join('');
}

// ========= 运行测试 =========
console.log('=== 测试修复后的 formatJsonBlocks ===\n');

var scenes = [
  { name: '场景 A：<code> 内有 <span> 做语法高亮（豆包/DeepSeek 常见）', html: html_A },
  { name: '场景 B：<code> 包裹纯 JSON（没有 span）', html: html_B },
  { name: '场景 C：JSON 在普通 <div> 里（没有 code 标签）', html: html_C }
];

var allPassed = true;
for (var i = 0; i < scenes.length; i++) {
  var scene = scenes[i];
  var out = formatJsonBlocks_fixed(scene.html);
  var hasPre = /<pre[\s\S]*?<\/pre>/.test(out);
  console.log('[' + (i + 1) + '] ' + scene.name);
  console.log('    → ' + (hasPre ? '✅ 成功格式化为 <pre>！' : '❌ 仍然是一行！'));

  if (hasPre) {
    // 提取 <pre> 中的文本，检查是否有换行符
    var preMatch = out.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/i);
    if (preMatch) {
      var codeContent = preMatch[1]
        .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
      var newlineCount = (codeContent.match(/\n/g) || []).length;
      console.log('    → 格式化后的 JSON 有 ' + newlineCount + ' 行');
      if (newlineCount < 3) {
        console.log('    ⚠️ 警告：行数太少，可能没有正确缩进');
        allPassed = false;
      } else {
        console.log('    → 预览前 200 字符：');
        console.log('      ' + codeContent.substring(0, 200).replace(/\n/g, '\n      '));
      }
    }
  } else {
    allPassed = false;
  }
  console.log('');
}

console.log('=== 总结 ===');
console.log(allPassed ? '✅ 所有场景测试通过！' : '❌ 部分场景失败，请检查');
