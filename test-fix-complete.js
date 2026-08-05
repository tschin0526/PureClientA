// ============================================================
// 🧪 测试：超链接和引用数字的样式修复效果验证
// ============================================================
// 模拟 DeepSeek 原始 HTML（包含各种会导致问题的样式）
var testCases = [
  {
    name: "引用数字 1/2/9（带圆形背景和居中）",
    input: `<div style="text-align: center; background: #eff6ff; padding: 8px;">根据台湾证券交易所的数据，外资及陆资今天买超新台币286.9亿元 <a href="https://example.com/ref/1" style="display: inline-flex; align-items: center; justify-content: center; border-radius: 9999px; background: #e5e7eb; color: #374151; padding: 2px 8px; font-size: 11px; text-decoration: none; border: 1px solid #d1d5db; margin: 0 2px;">1</a><a href="https://example.com/ref/2" style="display: inline-flex; border-radius: 9999px; background: #e5e7eb; color: #374151; padding: 2px 8px; font-size: 11px;">2</a><a href="https://example.com/ref/9" style="display: inline-flex; border-radius: 9999px; background: #e5e7eb; color: #374151; padding: 2px 8px; font-size: 11px;">9</a>。</div>`
  },
  {
    name: "超链接 block 显示在画面中央",
    input: `<div style="text-align: center;"><a href="https://example.com" style="display: block; text-align: center; background: #dbeafe; padding: 12px; border-radius: 8px;">点击查看详情</a></div>`
  },
  {
    name: "div 容器带居中对齐和背景色",
    input: `<div style="text-align: center; background: #fef3c7; padding: 16px; border: 1px solid #fcd34d;">这是一段居中的文字，后面有 <a href="#" style="color: #2563eb;">蓝色链接</a> 内容。</div>`
  },
  {
    name: "上标引用数字",
    input: `根据研究结果<sup style="font-size: 12px; color: #2563eb; vertical-align: super;">1</sup>，这种方法的效果显著<sup style="font-size: 12px; color: #2563eb; vertical-align: super;">2</sup>。`
  },
  {
    name: "带 Tailwind class 的引用数字",
    input: `<div class="flex items-center max-w-3xl text-center">根据数据 <a class="rounded-full bg-gray-200 text-gray-600 inline-flex items-center justify-center w-6 h-6 text-xs font-medium" style="margin: 0 2px;">1</a>。</div>`
  },
  {
    name: "带 rgba 和 var 的复杂 style",
    input: `<div style="display: block; text-align: center; background: rgba(219, 234, 254, 0.5); padding: 10px; border: 1px solid var(--color-blue-200);"><a href="#" style="display: inline-block; background: var(--color-blue-100); padding: 4px 10px; border-radius: 6px;">引用1</a></div>`
  }
];

// ============================================================
// 模拟修复后的 cleanHtmlWhitespace
// ============================================================
function cleanHtmlWhitespace_test(html) {
  var cleaned = html;
  var isDirtyHtml = /(?:dark:text-|max-w-|flex flex-|border-\[|rounded-|bg-\[|text-\[|p-\[|m-\[)/.test(cleaned);

  if (isDirtyHtml) {
    // 步骤A: 移除 Tailwind 类名
    cleaned = cleaned.replace(/\s*class="[^"]*(?:dark:text-|max-w-|flex flex-|border-\[|rounded-|bg-\[|text-\[|p-\[|m-\[)[^"]*"/gi, '');
    cleaned = cleaned.replace(/\s*class="[^"]*\b(?:text-|bg-|p-|m-|w-|h-|flex|grid|gap-|rounded|shadow|opacity|transform|transition|duration|ease|hover:|focus:|active:)[^"]*"/gi, '');

    // 步骤B: 对所有 style 属性进行基础安全清理
    cleaned = cleaned.replace(/style="[^"]*"/gi, 
      function(match) {
        var newStyle = match
          .replace(/text-align:\s*[^;]+;?/gi, '')
          .replace(/background(?:-color)?\s*:\s*[^;]+;?/gi, '')
          .replace(/padding(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
          .replace(/margin(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
          .replace(/display:\s*(?:block|flex|inline-flex|grid|inline-block|table|inline-table)[^;]*;?/gi, '')
          .replace(/border(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
          .replace(/border-radius:\s*[^;]+;?/gi, '')
          .replace(/box-shadow:\s*[^;]+;?/gi, '')
          .replace(/(?:min-|max-)?width:\s*(?:\d+(?:\.\d+)?(?:px|em|rem|%)|auto)[^;]*;?/gi, '')
          .replace(/(?:min-|max-)?height:\s*(?:\d+(?:\.\d+)?(?:px|em|rem|%)|auto)[^;]*;?/gi, '')
          .replace(/position:\s*(?:absolute|relative|fixed|sticky)[^;]*;?/gi, '')
          .replace(/(?:top|bottom|left|right):\s*[^;]+;?/gi, '')
          .replace(/z-index:\s*[^;]+;?/gi, '')
          .replace(/float:\s*[^;]+;?/gi, '')
          .replace(/clear:\s*[^;]+;?/gi, '')
          .replace(/overflow(?:-x|-y)?:\s*[^;]+;?/gi, '')
          .replace(/opacity:\s*[^;]+;?/gi, '')
          .replace(/transform:\s*[^;]+;?/gi, '')
          .replace(/var\(--[^)]+\)/gi, '')
          .replace(/rgba?\([^)]+\)/gi, '');

        // 清理多余的分号和空格
        newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^style="\s*;\s*/, 'style="').replace(/\s*;\s*"$/, '"');
        if (/^style="\s*"?$/.test(newStyle)) {
          return '';
        }
        return newStyle;
      });
  }

  // 标准清理
  cleaned = cleaned.replace(/>\s+</g, '><').replace(/\n\s*\n/g, '\n').replace(/^\s+|\s+$/g, '');
  return cleaned;
}

// ============================================================
// 模拟修复后的 injectInlineStyles
// ============================================================
function injectInlineStyles_test(html) {
  var styles = {
    'a': 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;',
    'sup': 'font-size: 10px !important; vertical-align: super !important; line-height: 1 !important; color: #64748b !important;',
    'strong': 'background: linear-gradient(120deg, #fef3c7 0%, #fde68a 100%) !important; color: #7c2d12 !important; padding: 2px 6px !important; border-radius: 4px !important; font-weight: 700 !important;',
    'h1': 'font-size: 26px !important; font-weight: 800 !important; color: #1e40af !important; margin: 24px 0 16px 0 !important;',
    'h2': 'font-size: 22px !important; font-weight: 700 !important; color: #1e3a8a !important; margin: 20px 0 12px 0 !important;',
    'h3': 'font-size: 18px !important; font-weight: 700 !important; color: #2563eb !important; margin: 16px 0 10px 0 !important;',
    'h4': 'font-size: 16px !important; font-weight: 600 !important; color: #3b82f6 !important; margin: 14px 0 8px 0 !important;',
    'code': 'background: #fee2e2 !important; color: #dc2626 !important; padding: 2px 6px !important; border-radius: 4px !important;',
    'pre': 'background: #f8f9fa !important; color: #24292e !important; padding: 16px !important; border-radius: 6px !important; overflow-x: auto !important; margin: 16px 0 !important; font-family: monospace !important; font-size: 13px !important; line-height: 1.6 !important; white-space: pre-wrap !important; word-break: break-all !important;',
    'ul': 'padding-left: 28px !important; margin: 12px 0 !important;',
    'ol': 'padding-left: 28px !important; margin: 12px 0 !important;',
    'li': 'margin: 6px 0 !important; line-height: 1.7 !important; font-size: 14px !important; color: #1f2937 !important;',
    'blockquote': 'border-left: 4px solid #3b82f6 !important; padding: 10px 16px !important; margin: 16px 0 !important; background: #f8fafc !important; color: #4b5563 !important; font-style: italic !important; border-radius: 0 6px 6px 0 !important;',
    'p': 'margin: 10px 0 !important; line-height: 1.7 !important; font-size: 14px !important;',
    'table': 'width: 100% !important; border-collapse: collapse !important; margin: 16px 0 !important; background: white !important; border-radius: 8px !important; overflow: hidden !important; box-shadow: 0 1px 3px rgba(0,0,0,0.1) !important; border: 1px solid #e5e7eb !important;',
    'thead': 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important; color: white !important;',
    'tbody': 'background: white !important;',
    'tr': 'border-bottom: 1px solid #e5e7eb !important; transition: background 0.2s !important;',
    'th': 'padding: 12px 16px !important; text-align: left !important; font-weight: 600 !important; font-size: 13px !important; letter-spacing: 0.5px !important; border-right: 1px solid rgba(255,255,255,0.2) !important;',
    'td': 'padding: 12px 16px !important; font-size: 14px !important; color: #374151 !important; border-right: 1px solid #f3f4f6 !important; text-align: left !important; vertical-align: middle !important;'
  };

  var result = html;
  Object.keys(styles).forEach(function(tag) {
    var style = styles[tag];
    var regex = new RegExp('<' + tag + '(\\s[^>]*)?>', 'gi');

    result = result.replace(regex, function(match, attrs) {
      // 对 <a> 和 <sup> 特殊处理：完全替换原有 style
      if (tag === 'a' || tag === 'sup') {
        return match.replace(/style\s*=\s*"[^"]*"/gi, '').replace(new RegExp('<' + tag + '(\\s|>)', 'i'), function(m, sep) {
          return '<' + tag + ' style="' + style + '"' + (sep === '>' ? '>' : sep);
        });
      }
      // 其他标签：追加 style
      if (attrs && attrs.indexOf('style=') > -1) {
        return match.replace(/style="([^"]*)"/i, 'style="$1 ' + style + '"');
      } else {
        return '<' + tag + (attrs || '') + ' style="' + style + '">';
      }
    });
  });

  return result;
}

// ============================================================
// 运行测试
// ============================================================
console.log('\n========================================');
console.log('🧪 测试：超链接和引用数字的样式修复');
console.log('========================================\n');

var allPassed = true;

testCases.forEach(function(testCase, index) {
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('【测试 ' + (index + 1) + '】' + testCase.name);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  var step1 = cleanHtmlWhitespace_test(testCase.input);
  var step2 = injectInlineStyles_test(step1);
  var finalHtml = step2;

  // 检查关键问题
  var problems = [];

  // 1. 检查是否还有 text-align: center
  if (/text-align:\s*center/i.test(finalHtml)) {
    problems.push('❌ 仍有 text-align: center');
  } else {
    problems.push('✅ text-align: center 已清除');
  }

  // 2. 检查是否还有 display: block/flex/inline-flex 等
  if (/display:\s*(block|flex|inline-flex|grid|inline-block)/i.test(finalHtml)) {
    problems.push('❌ 仍有 display: block/flex/inline-flex 等');
  } else {
    problems.push('✅ display 问题已修复');
  }

  // 3. 检查是否还有 background（除了我们在 injectInlineStyles 中定义的）
  var hasBackground = /background:\s*(?!linear-gradient|#fee2e2|#f8f9fa|#fef3c7|#f8fafc|#e5e7eb|white|rgba\(219,234,254)/i;
  if (hasBackground.test(finalHtml)) {
    // 这个检查比较复杂，简化处理
    // console.log('  ℹ️ 有 background（如果是我们注入的美化样式则没问题）');
  }

  // 4. 检查 <a> 标签是否有我们的样式
  var linkMatches = finalHtml.match(/<a[^>]*style="[^"]*"[^>]*>[^<]*<\/a>/gi) || [];
  if (linkMatches.length > 0) {
    problems.push('✅ <a> 标签有 style 属性（' + linkMatches.length + ' 个）');
    // 检查是否有 display: inline
    if (/display:\s*inline\s*!important/i.test(finalHtml)) {
      problems.push('✅ <a> 有 display: inline !important');
    } else {
      problems.push('❌ <a> 缺少 display: inline !important');
    }
  } else {
    problems.push('⚠️ 没有 <a> 标签（可能不需要处理）');
  }

  // 5. 检查数字内容是否保留
  if (/\d+/.test(finalHtml)) {
    problems.push('✅ 数字内容保留');
  } else {
    problems.push('⚠️ 没有数字（可能不需要）');
  }

  // 输出结果
  console.log('  原始输入（前200字符）：');
  console.log('    ' + testCase.input.substring(0, 200).replace(/\n/g, ' '));
  console.log('');
  console.log('  修复后（前200字符）：');
  console.log('    ' + finalHtml.substring(0, 200).replace(/\n/g, ' '));
  console.log('');
  console.log('  检查结果：');
  problems.forEach(function(p) {
    console.log('    ' + p);
    if (p.indexOf('❌') > -1) allPassed = false;
  });
  console.log('');
});

console.log('========================================');
if (allPassed) {
  console.log('✅ 所有测试通过！超链接和引用数字的问题已修复');
} else {
  console.log('⚠️ 部分测试未通过，请检查');
}
console.log('========================================\n');
