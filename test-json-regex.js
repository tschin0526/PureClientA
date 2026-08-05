// 模拟豆包返回的 HTML 中 JSON 的各种可能格式
var testCases = [
  // 情况1: 简单 <code> 包裹，没有嵌套
  '<div><code>{"city":"杭州","temp":23}</code></div>',

  // 情况2: <code> 里有 <span> 做语法高亮（很多 AI 平台会这样）
  '<div><code class="language-json"><span class="string">"{"</span><span class="key">"city"</span>: <span class="string">"杭州"</span>}</code></div>',

  // 情况3: 没有 <code>，只是普通 <div> 里的文本
  '<div>json</div><div>{"city":"杭州","temp":23,"forecast":[{"date":"2026-06-12"}]}</div>',

  // 情况4: 用 <div><code> 包裹，内容是完整 JSON
  '<div><code>{"city":"杭州","update_time":"2026-06-12 18:00","forecast_7days":[{"date":"2026-06-12","weekday":"周五","weather":"阴转多云","temp_low":23,"temp_high":33}]}</code></div>',
];

// AI 交互框当前的正则
var codePattern = /<code([^>]*)>([^<]*)<\/code>/gi;

console.log('=== 测试 AI 交互框当前的 <code> 正则 ===\n');
testCases.forEach((html, i) => {
  console.log(`情况 ${i + 1}:`);
  console.log(`  HTML: ${html.substring(0, 80)}...`);
  var match;
  var found = false;
  while ((match = codePattern.exec(html)) !== null) {
    console.log(`  ✅ 匹配到: codeContent="${match[2].substring(0, 60)}..."`);
    found = true;
  }
  if (!found) console.log('  ❌ 没匹配到！');
  console.log('');
  codePattern.lastIndex = 0;
});

console.log('\n=== 测试元素内容查看器的策略：直接匹配文本中的 JSON ===\n');
var textJsonPattern = /(\[[\s\S]*?\])(?=\s*(?:<|$))/gi;
testCases.forEach((html, i) => {
  console.log(`情况 ${i + 1}:`);
  console.log(`  HTML: ${html.substring(0, 80)}...`);
  var match;
  var found = false;
  while ((match = textJsonPattern.exec(html)) !== null) {
    // 只检测长的、包含 { 的内容
    if (match[1].length > 50 && match[1].includes('{')) {
      console.log(`  ✅ 匹配到 JSON 文本 (${match[1].length} 字符)`);
      found = true;
    }
  }
  if (!found) console.log('  ❌ 没匹配到 JSON 文本');
  console.log('');
  textJsonPattern.lastIndex = 0;
});

console.log('\n=== 测试：从复杂 <code> 中提取纯文本（应对 <span> 嵌套） ===\n');
var complexCase = '<div><code class="language-json"><span style="color:#c7254e;">"{"</span><span class="key">"city"</span>: <span class="string">"杭州"</span>}</code></div>';
console.log('输入:', complexCase);

// 策略：先匹配 <code ...>...</code>，然后用 extractPlainText 去除内部的 <span> 等
var m = complexCase.match(/<code([^>]*)>([\s\S]*?)<\/code>/i);
if (m) {
  console.log('✅ <code> 内容:', m[2]);
  // 提取纯文本
  var inner = m[2]
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
  console.log('✅ 提取纯文本:', inner);
  try {
    JSON.parse(inner);
    console.log('✅ JSON.parse 成功!');
  } catch(e) {
    console.log('❌ JSON.parse 失败:', e.message);
  }
}
