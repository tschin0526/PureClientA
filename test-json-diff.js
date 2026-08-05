// 模拟真实的豆包返回的 HTML（从截图推断）
var doubaoHtml = `<div>二、对应 JSON 数据集</div><div>json</div><div><code>{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33,"wind":"西南风2~3级"},{"date":"2026-06-13","weekday":"周六","weather":"阴有阵雨或雷雨","temp_low":22}]}</code></div><div>要不要我把这份 JSON 保存成文件给你...</div>`;

console.log('=== 原始 HTML 长度:', doubaoHtml.length);
console.log('');

// ========================================
// AI 交互框当前的 formatJsonBlocks
// ========================================
function formatJsonBlocks_aiChat(html) {
  if (!html) return html;
  var result = html;
  var changed = false;

  // 步骤1: 匹配完整的 <code ...>...</code> 标签对
  // ❌ 问题: ([^<]*) 不能匹配内部有 <span> 或其他标签的内容
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

  // 步骤2: 扫描普通容器中的 JSON（标签间文本）
  // ❌ 问题: 只匹配 >TEXT< 中的内容，如果 JSON 在 <code> 里就不会走到这一步
  // ❌ 另外: JSON 是对象 {..}，但这里用 ([^<>]+)，需要第一个字符是 {
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
      segments.push(processPlainTextForJson_old(beforeTag));
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
    if (!inPreOrCode) segments.push(processPlainTextForJson_old(result.substring(cursor)));
    else segments.push(result.substring(cursor));
  }

  result = segments.join('');
  return result;

  function processPlainTextForJson_old(textChunk) {
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
        return '><pre><code class="language-json">' + escaped + '</code></pre><';
      } catch (e) { return m; }
    });
  }
}

// ========================================
// 元素内容查看器的关键逻辑（简化版）
// ========================================
function formatJsonBlocks_viewer(html) {
  if (!html) return html;

  function extractPlainText(text) {
    return text
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/div>/gi, '\n')
      .replace(/<[^>]+>/g, '')  // 移除所有标签（包括 <span> 等）
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();
  }

  function tryFormatJson(text) {
    try {
      return { success: true, result: JSON.stringify(JSON.parse(text), null, 2) };
    } catch (e) {}

    try {
      var cleaned = text
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
        .replace(/^\s*```(?:json)?\s*/gm, '')
        .replace(/\s*```\s*$/gm, '')
        .trim();
      return { success: true, result: JSON.stringify(JSON.parse(cleaned), null, 2) };
    } catch (e) {}

    // 🌟 策略C: 在整个文本中查找 {...} 或 [...]（最关键！）
    var jsonPattern = /\{[\s\S]*\}|\[[\s\S]*\]/;
    var match = text.match(jsonPattern);
    if (match && match[0].length > 20) {
      try {
        return { success: true, result: JSON.stringify(JSON.parse(match[0]), null, 2) };
      } catch (e) {}
    }
    return { success: false, error: '所有策略均失败' };
  }

  function formatJsonString(jsonStr) {
    var escaped = jsonStr
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return '<pre style="background: #f8f9fa; color: #24292e; padding: 16px; border-radius: 6px; border: 1px solid #e1e4e8; margin: 16px 0; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre; overflow-x: auto;"><code>' + escaped + '</code></pre>';
  }

  var result = html;

  // 策略1: 匹配 <code>...</code>（允许内部有标签！用 [\s\S]*? 而不是 [^<]*）
  result = result.replace(/<code([^>]*)>([\s\S]*?)<\/code>/gi, function(match, attrs, inner) {
    var plainText = extractPlainText(inner);
    if (plainText.length < 30) return match;
    var firstChar = plainText.charAt(0);
    var lastChar = plainText.charAt(plainText.length - 1);
    if (!((firstChar === '{' && lastChar === '}') || (firstChar === '[' && lastChar === ']'))) return match;

    var f = tryFormatJson(plainText);
    if (f.success) return formatJsonString(f.result);
    return match;
  });

  // 🌟 策略2: 扫描所有标签间的文本，找 JSON 对象/数组
  // 关键点：不依赖特定标签，在任何地方都能找到 {...} 或 [...]
  result = result.replace(/>([^<{}\[\]]+)</g, function(match, inner) {
    // 这个正则不好——JSON 里本身有 {}，所以需要不同方法
    return match;
  });

  // 🌟 真正的策略：遍历整段 HTML（分段处理），在纯文本部分中找 JSON
  // 用 split 方法：把 HTML 切成 "标签" 和 "文本" 交替的段
  var finalResult = [];
  var parts = result.split(/(<[^>]+>)/);
  for (var i = 0; i < parts.length; i++) {
    var part = parts[i];
    if (part.charAt(0) === '<') {
      // 这是标签——跳过，直接保留
      finalResult.push(part);
    } else {
      // 这是文本段——检查是否包含 JSON
      var decoded = part
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
      if (decoded.length < 30 || !decoded.includes(':')) {
        finalResult.push(part);
        continue;
      }

      // 在这段文本中找 {...} 或 [...]（从第一个 { 或 [ 到最后一个 } 或 ]）
      var jsonMatch = decoded.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch && jsonMatch[0].length > 30) {
        try {
          var formatted = JSON.stringify(JSON.parse(jsonMatch[0]), null, 2);
          var escaped = formatted
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
          finalResult.push('<pre style="background: #f8f9fa; color: #24292e; padding: 16px; border-radius: 6px; border: 1px solid #e1e4e8; margin: 16px 0; font-family: monospace; font-size: 13px; line-height: 1.6; white-space: pre; overflow-x: auto;"><code>' + escaped + '</code></pre>');
          console.log('✅ 策略C（文本扫描）成功！找到', jsonMatch[0].length, '字符的 JSON');
        } catch (e) {
          finalResult.push(part);
        }
      } else {
        finalResult.push(part);
      }
    }
  }

  return finalResult.join('');
}

// ========================================
// 测试对比
// ========================================
console.log('=== AI 交互框当前版本 ===');
var r1 = formatJsonBlocks_aiChat(doubaoHtml);
var hasPre1 = /<pre[\s\S]*?<\/pre>/.test(r1);
console.log('是否生成了 <pre> 代码块？', hasPre1 ? '✅ 是' : '❌ 否');
if (!hasPre1) {
  // 看看 code 标签匹配到了什么
  var match = doubaoHtml.match(/<code([^>]*)>([^<]*)<\/code>/i);
  if (match) {
    console.log('  → 匹配到的 <code> 内容:', match[2].substring(0, 60), '...');
    // 检查是否 { 开头和 } 结尾
    var trimmed = match[2].trim();
    console.log('  → 第一个字符:', JSON.stringify(trimmed.charAt(0)), '最后一个字符:', JSON.stringify(trimmed.charAt(trimmed.length - 1)));
  } else {
    console.log('  → ❌ 连 <code> 标签都没匹配到！（检查正则）');
  }
}
console.log('');

console.log('=== 元素内容查看器版本（策略 A+B+C） ===');
var r2 = formatJsonBlocks_viewer(doubaoHtml);
var hasPre2 = /<pre[\s\S]*?<\/pre>/.test(r2);
console.log('是否生成了 <pre> 代码块？', hasPre2 ? '✅ 是' : '❌ 否');
if (hasPre2) {
  // 提取 <pre> 中的代码文本
  var preMatch = r2.match(/<pre[^>]*><code>([\s\S]*?)<\/code><\/pre>/i);
  if (preMatch) {
    var jsonText = preMatch[1]
      .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
    console.log('  → JSON 已格式化，换行符数量:', (jsonText.match(/\n/g) || []).length);
    console.log('  → 前200字符:', jsonText.substring(0, 200));
  }
}
