/**
 * 文本数据解析器 (TextDataParser)
 * 
 * 独立的文本→结构化数据转换工具，职责单一：
 * - 接收 OCR 原始文本 + 结构化说明（Schema）
 * - 根据 Schema 定义的字段类型和位置规则进行智能解析
 * - 输出结构化的 JSON 数组
 * 
 * Schema 格式：
 *   {
 *     name: "交易记录",
 *     linesPerRecord: 2,
 *     fields: [
 *       { name: "名称", type: "X", line: 0, position: 0 },
 *       { name: "股号", type: "X", line: 1, position: 0 },
 *       { name: "价格", type: "N", line: 0, position: 1 },
 *       { name: "数量", type: "N", line: 1, position: 1 },
 *       { name: "方向", type: "X", line: 0, position: 2, enumValues: ["买入","卖出"] },
 *       { name: "成交额", type: "N", line: 1, position: 2 }
 *     ]
 *   }
 * 
 * 字段类型：
 *   X = 文字型（取非数字token）
 *   N = 数字型（取数字token）
 *   D = 日期型（匹配日期格式）
 *   X=值1/值2 = 枚举型（从指定值中匹配）
 * 
 * 使用方式：
 *   var parser = new TextDataParser();
 *   var result = parser.parse(ocrText, schema);
 */
class TextDataParser {
  constructor() {
    this._debug = false;
  }

  parse(text, schema) {
    if (!text || !text.trim()) return [];
    if (!schema || !schema.fields || !schema.fields.length) {
      console.error('[TextDataParser] 无效的 Schema');
      return [];
    }

    var linesPerRecord = schema.linesPerRecord || 2;
    var skipPatterns = this._buildSkipPatterns(schema);
    var rawLines = text.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });

    console.log('[TextDataParser] 输入: ' + rawLines.length + ' 行, Schema: ' + schema.name + ', ' + linesPerRecord + '行/记录');

    // 过滤非数据行
    var dataLines = [];
    for (var i = 0; i < rawLines.length; i++) {
      var shouldSkip = false;
      for (var p = 0; p < skipPatterns.length; p++) {
        if (skipPatterns[p].test(rawLines[i])) { shouldSkip = true; break; }
      }
      if (!shouldSkip) dataLines.push(rawLines[i]);
    }
    console.log('[TextDataParser] 过滤后: ' + dataLines.length + ' 行有效数据');

    // 按记录分组
    var records = [];
    for (var r = 0; r < dataLines.length; r += linesPerRecord) {
      var recordLines = [];
      for (var l = 0; l < linesPerRecord && (r + l) < dataLines.length; l++) {
        recordLines.push(dataLines[r + l]);
      }

      if (recordLines.length < linesPerRecord && r + linesPerRecord > dataLines.length) break;

      var rec = this._extractRecord(recordLines, schema);
      if (rec) records.push(rec);
    }

    console.log('[TextDataParser] 解析完成: ' + records.length + ' 条记录');
    return records;
  }

  _buildSkipPatterns(schema) {
    var patterns = [
      /成交汇总/, /当日/, /名\s*称.*价\s*格.*数\s*量.*方\s*向.*成\s*交\s*额/,
      /个股统计/, /合计/, /净买入/, /笔$/,
      /^[\d]{1,2}:\d{2}/, /^</, /\(CD/, /^\s*全\s*$/,
      /^\S+\s+\/\S+/,           // 包含 "/" 分隔符的行
      /^[<\u4e00-\u9fa5\s]+$/     // 纯中文+空格的短标题行
    ];
    if (schema.skipPatterns) {
      for (var i = 0; i < schema.skipPatterns.length; i++) {
        patterns.push(new RegExp(schema.skipPatterns[i]));
      }
    }
    return patterns;
  }

  _extractRecord(recordLines, schema) {
    var result = {};
    var fields = schema.fields;

    for (var f = 0; f < fields.length; f++) {
      var field = fields[f];
      var lineIdx = field.line || 0;
      if (lineIdx >= recordLines.length) continue;

      var line = recordLines[lineIdx];
      var value = this._extractField(line, field, recordLines);

      if (value !== undefined && value !== null && value !== '') {
        result[field.name] = value;
      } else {
        result[field.name] = '';
      }
    }

    // 验证：至少有一个非空字段才算有效记录
    var hasContent = false;
    for (var k in result) {
      if (result[k] !== '') { hasContent = true; break; }
    }
    return hasContent ? result : null;
  }

  _extractField(line, field, allLines) {
    var cleanLine = line.replace(/\s+/g, '');
    var nextLine = allLines.length > (field.line || 0) + 1 ? allLines[(field.line || 0) + 1] : '';

    switch (field.type) {
      case 'N': return this._extractNumber(line, field);
      case 'D': return this._extractDate(cleanLine);
      case 'X':
        if (field.enumValues) return this._extractEnum(cleanLine, nextLine.replace(/\s+/g,''), field.enumValues);
        return this._extractText(line, field);
      default: return '';
    }
  }

  _extractNumber(line, field) {
    var tokens = line.split(/\s+/).filter(function(t){return t;});
    var numbers = line.match(/[\d,.]+/g) || [];

    if (numbers.length === 0) return '';

    // 价格特征：带小数点，整数部分较短，值较小(<10000)
    if (field.hint === 'price' || field.name === '价格') {
      for (var j = 0; j < numbers.length; j++) {
        var n = numbers[j];
        if (n.indexOf('.') >= 0 && n.split('.')[0].length <= 4 && parseFloat(n) < 10000) {
          return n;
        }
      }
      return numbers[0] || '';
    }

    // 数量特征：纯整数，范围合理
    if (field.hint === 'qty' || field.name === '数量') {
      for (var k = 0; k < numbers.length; k++) {
        var nk = numbers[k];
        if (nk.indexOf('.') < 0) {
          var nv = parseInt(nk);
          if (nv >= 10 && nv < 10000000) return nk;
        }
      }
      if (numbers.length > 0) return numbers[0];
      return '';
    }

    // 成交额：通常是最大的数字
    if (field.hint === 'amount' || field.name === '成交额') {
      var maxVal = 0, maxIdx = 0;
      for (var m = 0; m < numbers.length; m++) {
        var v = parseFloat(numbers[m]) || 0;
        if (v > maxVal) { maxVal = v; maxIdx = m; }
      }
      return numbers[maxIdx] || '';
    }

    // 默认：按位置取数字
    var pos = field.position || 0;
    if (pos < numbers.length) return numbers[pos];

    return numbers[0] || '';
  }

  _extractText(line, field) {
    var tokens = line.split(/\s+/).filter(function(t){return t;});
    if (tokens.length === 0) return '';

    var fname = field.name || '';

    // ===== 名称字段：合并所有前导文字token（遇到数字就停）=====
    if (fname === '名称' || fname === 'name') {
      var nameParts = [];
      for (var i = 0; i < tokens.length; i++) {
        // 遇到数字token就停止（后面的不是名字了）
        if (/^[\d,.]+$/.test(tokens[i])) break;
        nameParts.push(tokens[i]);
      }
      return nameParts.join('') || tokens[0] || '';
    }

    // ===== 股号字段：取第一个token（通常是代码）=====
    if (fname === '股号' || fname === 'code') {
      return tokens[0] || '';
    }

    // ===== 通用：按位置取非数字token =====
    var pos = field.position || 0;
    var textTokens = [];
    for (var j = 0; j < tokens.length; j++) {
      if (!/^[\d,.]+$/.test(tokens[j])) {
        textTokens.push(tokens[j]);
      }
    }
    if (pos < textTokens.length) return textTokens[pos];
    if (textTokens.length > 0) return textTokens[0];
    return tokens[pos] || '';
  }

  _extractEnum(cleanLine, cleanNextLine, enumValues) {
    for (var e = 0; e < enumValues.length; e++) {
      var ev = enumValues[e].replace(/\s+/g,'');
      if (cleanLine.indexOf(ev) >= 0) return enumValues[e];
      if (cleanNextLine && cleanNextLine.indexOf(ev) >= 0) return enumValues[e];
    }
    return '';
  }

  _extractDate(cleanLine) {
    var dateMatch = cleanLine.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/)
      || cleanLine.match(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (dateMatch) return dateMatch[0];
    return '';
  }
}

window.TextDataParser = TextDataParser;
console.log('[TextDataParser] 工具已加载');
