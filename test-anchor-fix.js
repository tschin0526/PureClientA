// 模拟 DeepSeek 原始 HTML（包含带 display:block/center/blue background 的 <a>）
var testHtml = `<div>根据今天（2026年6月12日）的最新数据，<a href="https://example.com/stock/2887" style="display:block;text-align:center;color:#2563eb;background:#eff6ff;padding:2px 6px;border:1px solid #2563eb;border-radius:4px;font-size:12px;cursor:pointer;">台股外资不仅没有流出，反而出现了大规模的流入</a>。<br>今天外资终结了连续6个交易日的卖超，转为买超。</div>`;

var testHtml2 = `<div>根据今天的最新数据，<a href="#" style="display: inline-block; text-align: center; color: blue; background: #eff6ff; padding: 4px 8px; border: 1px solid blue; border-radius: 4px;">台新光金(2887)</a>、<a style="display: block; margin: 0 auto; background: #eff6ff; color: blue; padding: 2px 6px; border: 1px solid blue; border-radius: 4px;">华航(2610)</a> 等股票。</div>`;

// 模拟修复后的 injectInlineStyles（只包含 <a> 的处理逻辑）
function injectInlineStyles_aOnly(html) {
  var styles = {
    'a': 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;'
  };
  var result = html;
  Object.keys(styles).forEach(function(tag) {
    var style = styles[tag];
    var regex = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');
    result = result.replace(regex, function(match, attrs) {
      // 对 <a> 特殊处理：完全替换原有 style
      if (tag === 'a') {
        return match.replace(/style\s*=\s*"[^"]*"/gi, '').replace(/<a(\s|>)/i, function(m, sep) {
          return '<a style="' + style + '"' + (sep === '>' ? '>' : sep);
        });
      }
      if (attrs && attrs.indexOf('style=') > -1) {
        return match.replace(/style="([^"]*)"/i, 'style="$1 ' + style + '"');
      } else {
        return '<' + tag + (attrs || '') + ' style="' + style + '">';
      }
    });
  });
  return result;
}

console.log('=== 原始 HTML ===');
console.log(testHtml);
console.log('');
console.log('=== 修复后 ===');
console.log(injectInlineStyles_aOnly(testHtml));
console.log('');
console.log('=== 验证：还有 display:block 吗？===');
var fixed = injectInlineStyles_aOnly(testHtml);
console.log('有 display:block？', /display\s*:\s*block/i.test(fixed) ? '❌ 还有' : '✅ 没有（已被清除）');
console.log('有 text-align:center？', /text-align\s*:\s*center/i.test(fixed) ? '❌ 还有' : '✅ 没有（已被清除）');
console.log('有 background:blue / eff6ff？', /background\s*:[^;]*(blue|eff6ff)/i.test(fixed) ? '❌ 还有' : '✅ 没有（已被清除）');
console.log('有 border: 1px solid blue？', /border\s*:[^;]*solid\s*[^;]*(blue|#)/i.test(fixed) ? '❌ 还有' : '✅ 没有（已被清除）');
console.log('有 padding？', /padding\s*:[^;]*\d+/i.test(fixed) ? '⚠️ 还有 padding（可能影响视觉但不重要）' : '✅ 没有');
console.log('');
console.log('=== 测试 2（带 inline-block 的情况）===');
console.log(testHtml2);
console.log('');
var fixed2 = injectInlineStyles_aOnly(testHtml2);
console.log('修复后:');
console.log(fixed2);
console.log('');
console.log('验证:');
console.log('有 display:block/inline-block？', /display\s*:\s*(block|inline-block)/i.test(fixed2) ? '❌ 还有' : '✅ 没有');
console.log('有 text-align:center？', /text-align\s*:\s*center/i.test(fixed2) ? '❌ 还有' : '✅ 没有');
console.log('有 background？', /background\s*:/i.test(fixed2) ? '❌ 还有' : '✅ 没有');
console.log('有 border？', /border\s*:/i.test(fixed2) ? '❌ 还有' : '✅ 没有');
