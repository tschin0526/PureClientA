// 🧪 完整流程测试 - 修复后验证
var styles = {
    'a': 'display: inline !important; text-align: left !important; color: #2563eb !important; text-decoration: underline !important; font-weight: 500 !important;',
    'a_citation': 'display: inline-block !important; text-align: center !important; border: 1.5px solid #475569 !important; border-radius: 50% !important; min-width: 18px !important; height: 18px !important; line-height: 15px !important; font-size: 10px !important; font-weight: 600 !important; color: #475569 !important; text-decoration: none !important; margin: 0 1px !important; vertical-align: baseline !important; background: transparent !important; padding: 0 !important;'
};

function cleanHtmlWhitespace_FIXED(html) {
    var cleaned = html;

    // 模拟：总是执行 style 清理（不依赖 isDirtyHtml）
    cleaned = cleaned.replace(/style="[^"]*"/gi, function(match) {
        var newStyle = match
            .replace(/text-align:\s*[^;]+;?/gi, '')
            .replace(/background(?:-color)?\s*:\s*[^;]+;?/gi, '')
            .replace(/padding(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
            .replace(/margin(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
            .replace(/display:\s*(?:block|flex|inline-flex|grid|inline-block|table|inline-table)[^;]*;?/gi, '')
            .replace(/border(?:-top|-bottom|-left|-right)?\s*:\s*[^;]+;?/gi, '')
            .replace(/border-radius:\s*[^;]+;?/gi, '')
            .replace(/box-shadow:\s*[^;]+;?/gi, '')
            .replace(/var\(--[^)]+\)/gi, '')
            .replace(/rgba?\([^)]+\)/gi, '');

        newStyle = newStyle.replace(/;\s*;/g, ';').replace(/^style="\s*;\s*/, 'style="').replace(/\s*;\s*"$/, '"');
        if (/^style="\s*"?$/.test(newStyle)) return '';
        return newStyle;
    });

    return cleaned;
}

function injectInlineStyles_FIXED(html) {
    var result = html;

    // ✅ 关键修复：用 ([\s\S]*?) 允许 <a> 内部有 <span> 等嵌套标签
    result = result.replace(/<a(\s[^>]*)?>([\s\S]*?)<\/a>/gi, function(match, attrs, innerHtml) {
        var cleanedAttrs = (attrs || '').replace(/style\s*=\s*"[^"]*"/gi, '').trim();

        // 从内部 HTML 中提取纯文本（移除 <span> 等所有标签）
        var innerText = (innerHtml || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
        var trimmedText = innerText.trim();

        var isSimpleDigit = /^\d{1,2}$/.test(trimmedText);
        var isHyphenDigit = /^-?\s*\d{1,2}\s*-?$/.test(trimmedText);
        var isMultiDigit = /^-?\s*\d{1,2}\s*-\s*\d{1,2}\s*-?$/.test(trimmedText);
        var isCitation = isSimpleDigit || isHyphenDigit || isMultiDigit;

        var styleToUse, displayContent;
        if (isCitation) {
            styleToUse = styles['a_citation'] || styles['a'];
            var digitsOnly = trimmedText.replace(/[-\s]/g, '');
            displayContent = digitsOnly || trimmedText;
        } else {
            styleToUse = styles['a'];
            displayContent = innerHtml;
        }

        if (cleanedAttrs && cleanedAttrs.length > 0) {
            return '<a style="' + styleToUse + '" ' + cleanedAttrs + '>' + displayContent + '</a>';
        } else {
            return '<a style="' + styleToUse + '">' + displayContent + '</a>';
        }
    });

    return result;
}

// 测试用例 - 模拟真实的 DeepSeek HTML
var testCases = [
    {
        name: '1. 简单 <a>-1</a>',
        html: '台股重挫1568点，陆资创今年来单日最大卖超<a href="https://deepseek.com/ref/1" style="display:inline-block;background:#e5e7eb;padding:2px 8px;border-radius:9999px;">-1</a><a href="#" style="display:inline-block;background:#e5e7eb;padding:2px 8px;">-4</a>',
        expectedCircle: 2
    },
    {
        name: '2. 带 <span> 嵌套 <a><span>-1</span></a>',
        html: '陆资创今年来单日最大卖超<a href="#" style="..."><span style="font-size:11px;color:#374151;">-3</span></a><a href="#" style="..."><span>-8</span></a>',
        expectedCircle: 2
    },
    {
        name: '3. 带 Tailwind class 的引用数字',
        html: '最大卖超<a class="inline-flex items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs font-medium" href="#">-1</a><a class="inline-flex items-center justify-center rounded-full bg-gray-200" href="#">-2</a>',
        expectedCircle: 2
    },
    {
        name: '4. 混合场景：引用数字 + 普通链接',
        html: '根据研究结果<a href="#">1</a>，请参考详细资料<a href="https://example.com">点击查看详情</a>，其他参考<a href="#">2</a><a href="#">9</a>',
        expectedCircle: 3
    },
    {
        name: '5. 表格中的引用数字（DeepSeek 真实数据样式）',
        html: '<table><tr><td>受贾半指数暴跌影响，台股重挫1568点，陆资创今年来单日最大卖超<a href="#" style="display:inline-block;text-align:center;background:#f3f4f6;border-radius:9999px;padding:2px 6px;border:1px solid #e5e7eb;">-1</a><a href="#" style="display:inline-block;text-align:center;background:#f3f4f6;border-radius:9999px;padding:2px 6px;border:1px solid #e5e7eb;">-4</a></td></tr></table>',
        expectedCircle: 2
    }
];

console.log('\n========== 🧪 修复后测试 ==========\n');

var allPassed = true;

testCases.forEach(function(tc) {
    console.log('【' + tc.name + '】');

    var step1 = cleanHtmlWhitespace_FIXED(tc.html);
    var finalHtml = injectInlineStyles_FIXED(step1);

    // 统计圆形边框的引用数字
    var circleCount = 0;
    var circleMatches = finalHtml.match(/<a[^>]*border-radius:\s*50%[^>]*>\d+<\/a>/gi) || [];
    circleCount = circleMatches.length;

    // 统计普通蓝色下划线链接
    var normalCount = 0;
    var normalMatches = finalHtml.match(/<a[^>]*text-decoration:\s*underline[^>]*>[^<]*<\/a>/gi) || [];
    normalCount = normalMatches.length;

    console.log('  ✅ 圆形边框引用数字:', circleCount, '个 (期望: ' + tc.expectedCircle + ')');
    console.log('  ✅ 普通蓝色下划线链接:', normalCount, '个');

    if (circleCount !== tc.expectedCircle) {
        allPassed = false;
        console.log('  ❌ 不匹配！');
    }

    // 显示前3个圆形边框的引用数字
    circleMatches.slice(0, 3).forEach(function(m) {
        // 提取内容数字
        var num = m.match(/>(\d+)</) ? m.match(/>(\d+)</)[1] : '?';
        console.log('    📌 ' + num + ' 显示为圆形边框');
    });

    console.log('');
});

console.log('========== 测试结果 ==========\n');
if (allPassed) {
    console.log('✅✅✅ 所有测试通过！引用数字现在应该显示为圆形边框了！');
} else {
    console.log('❌ 部分测试未通过');
}
console.log('');
