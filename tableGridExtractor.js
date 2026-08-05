/**
 * TableGridExtractor v6.0 - 纯 AI 版本（移除 Tesseract OCR）
 * 只使用 AI（智谱 GLM / 通义千问），失败直接报错
 */
class TableGridExtractor {
  constructor() {
    this._apiKey = '';
    this._provider = 'zhipu';
  }

  setApiKey(key, provider) {
    this._apiKey = key || '';
    this._provider = provider || 'zhipu';
    try {
      if (this._apiKey && typeof localStorage !== 'undefined') {
        localStorage.setItem('sv_ai_api_key', this._apiKey);
        localStorage.setItem('sv_ai_provider', this._provider);
      }
    } catch(e) {}
  }

  getApiConfig() {
    if (!this._apiKey && typeof localStorage !== 'undefined') {
      try {
        this._apiKey = localStorage.getItem('sv_ai_api_key') || '';
        this._provider = localStorage.getItem('sv_ai_provider') || 'zhipu';
      } catch(e) {}
    }
    return { key: this._apiKey, provider: this._provider };
  }

  async extract(imageData, options) {
    options = options || {};
    var onProgress = options.onProgress || function() {};
    var customPrompt = options.customPrompt || '';
    var modelName = options.modelName || null;  // 新增：接收模型名称参数
    if (!imageData) throw new Error('图片数据为空');

    this.getApiConfig();

    if (!this._apiKey) {
      throw new Error('❌ 未设置 API Key！请先在 AI API Key 设定中配置密钥。');
    }

    var p = this._provider === 'auto' ? 'zhipu' : this._provider;
    console.log('[TableGridExtractor] AI引擎: ' + p + (customPrompt ? ', 自定义要求: 是' : '') + (modelName ? ', 模型版本: ' + modelName : ''));

    if (p === 'qwen') return await this._extractWithQwen(imageData, onProgress, customPrompt, modelName);
    return await this._extractWithZhipu(imageData, onProgress, customPrompt, modelName);
  }

  // ====== 智谱 GLM-4V ======
  async _extractWithZhipu(imageData, onProgress, customPrompt, modelName) {
    onProgress({ step: 'ai', message: '\uD83E\uDDE0 智谱GLM分析中...' });
    var b64 = this._toBase64(imageData);

    var userPrompt = customPrompt || '';
    var basePrompt = '请识别这张图片中的表格数据，并以JSON格式输出。\n\n请按以下格式输出：\n1. 首先输出一个JSON代码块：{"headers": ["列1","列2",...], "rows": [["数据1","数据2",...],...]}\n2. （可选）在JSON之后，可以添加您的说明、建议或注意事项（用自然语言）';
    if (customPrompt && customPrompt.trim()) {
      basePrompt = customPrompt.trim();
    }

    // 使用传入的模型名称，如果没有则使用默认值
    var actualModel = modelName || 'glm-4.6v-flash';

    try {
      var r = await fetch('https://open.bigmodel.cn/api/paas/v4/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this._apiKey },
        body: JSON.stringify({
          model: actualModel,  // 使用动态模型名称
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
              { type: 'text', text: basePrompt }
            ]
          }],
          temperature: 0.1
        })
      });

      if (!r.ok) {
        var errBody = '';
        try { errBody = await r.text(); } catch(e) {}
        throw new Error('智谱API错误(' + r.status + '): ' + errBody.substring(0, 200));
      }

      var data = await r.json();
      var text = data.choices && data.choices[0] ? data.choices[0].message.content || '' : '';
      console.log('[TableGridExtractor] 智谱返回:', text.substring(0, 200));
      var result = this._parseJson(text);
      result._rawResponse = text;
      result._fullApiResponse = data;
      result._prompt = userPrompt;
      result._actualPrompt = basePrompt;
      result._model = actualModel;  // 记录实际使用的模型
      onProgress({ step: 'done', message: '\u2705 完成!' + result.rows + '行x' + result.cols + '列(智谱-' + actualModel + ')' });
      return result;
    } catch(err) {
      console.error('[TableGridExtractor] 智谱失败:', err.message);
      onProgress({ step: 'error', message: '\u274C 智谱AI调用失败: ' + err.message });
      throw new Error('\u274C 智谱AI调用失败: ' + err.message);
    }
  }

  // ====== 通义千问 Qwen-VL ======
  async _extractWithQwen(imageData, onProgress, customPrompt, modelName) {
    onProgress({ step: 'ai', message: '\uD83C\uDF34 通义千问分析中...' });
    var b64 = this._toBase64(imageData);
    var userPrompt = customPrompt || '';
    var basePrompt = '请识别这张图片中的表格数据，并以JSON格式输出。\n\n请按以下格式输出：\n1. 首先输出一个JSON代码块：{"headers": ["列1","列2",...], "rows": [["数据1","数据2",...],...]}\n2. （可选）在JSON之后，可以添加您的说明、建议或注意事项（用自然语言）';
    if (customPrompt && customPrompt.trim()) {
      basePrompt = customPrompt.trim();
    }

    // 使用传入的模型名称，如果没有则使用默认值
    var actualModel = modelName || 'qwen-vl-max-latest';

    try {
      var r = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + this._apiKey },
        body: JSON.stringify({
          model: actualModel,  // 使用动态模型名称
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: 'data:image/png;base64,' + b64 } },
              { type: 'text', text: basePrompt }
            ]
          }],
          temperature: 0.1
        })
      });

      if (!r.ok) throw new Error('通义千问错误(' + r.status + ')');
      var data = await r.json();
      var text = data.choices && data.choices[0] ? data.choices[0].message.content || '' : '';
      var result = this._parseJson(text);
      result._rawResponse = text;
      result._fullApiResponse = data;
      result._prompt = userPrompt;
      result._actualPrompt = basePrompt;
      result._model = actualModel;  // 记录实际使用的模型
      onProgress({ step: 'done', message: '\u2705 完成!' + result.rows + '行x' + result.cols + '列(通义-' + actualModel + ')' });
      return result;
    } catch(err) {
      console.error('[TableGridExtractor] 通义千问失败:', err.message);
      onProgress({ step: 'error', message: '\u274C 通义千问AI调用失败: ' + err.message });
      throw new Error('\u274C 通义千问AI调用失败: ' + err.message);
    }
  }

  _parseJson(raw) {
    if (!raw) return { rows: 1, cols: 1, cells: [['']] };
    
    var s = raw.trim();
    console.log('[TableGridExtractor] _parseJson 输入长度:', s.length);
    
    // 方法1: 先尝试提取 ```json ... ``` 代码块
    var codeBlockMatch = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      console.log('[TableGridExtractor] 找到代码块，尝试解析...');
      var result = this._tryParseJsonString(codeBlockMatch[1].trim());
      if (result) return result;
    }
    
    // 方法2: 尝试找到第一个完整的 JSON 对象（使用括号匹配）
    var firstBrace = s.indexOf('{');
    if (firstBrace >= 0) {
      var braceCount = 0;
      var jsonEnd = -1;
      
      for (var i = firstBrace; i < s.length; i++) {
        if (s[i] === '{') braceCount++;
        else if (s[i] === '}') {
          braceCount--;
          if (braceCount === 0) {
            jsonEnd = i;
            break;
          }
        }
      }
      
      if (jsonEnd > firstBrace) {
        var jsonStr = s.substring(firstBrace, jsonEnd + 1);
        console.log('[TableGridExtractor] 提取JSON长度:', jsonStr.length);
        var result = this._tryParseJsonString(jsonStr);
        if (result) return result;
      }
    }
    
    // 方法3: 尝试清理后解析整个字符串
    var cleaned = s.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/g, '');
    var result = this._tryParseJsonString(cleaned.trim());
    if (result) return result;
    
    // 都失败了，返回原始文本的前200字符
    console.warn('[TableGridExtractor] JSON 解析全部失败');
    return { rows: 1, cols: 1, cells: [[s.substring(0, 200).replace(/\n/g, ' | ')]] };
  }

  _tryParseJsonString(jsonStr) {
    try {
      var p = JSON.parse(jsonStr);
      console.log('[TableGridExtractor] 解析成功:', Object.keys(p));
      
      // 格式1: {"headers": [...], "rows": [...]} (新格式)
      if (p && Array.isArray(p.headers) && Array.isArray(p.rows) && p.rows.length > 0) {
        var cells = [p.headers].concat(p.rows);
        var cols = 0;
        for (var r = 0; r < cells.length; r++) {
          if (Array.isArray(cells[r]) && cells[r].length > cols) {
            cols = cells[r].length;
          }
        }
        console.log('[TableGridExtractor] 新格式解析成功:', cells.length, '行 x', cols, '列');
        return { rows: cells.length, cols: cols, cells: cells };
      }
      
      // 格式2: {"rows":n,"cols":m,"cells":[[...]]} (旧格式)
      if (p && Array.isArray(p.cells) && p.cells.length > 0) {
        var rows = p.cells.length, cols = 0;
        for (var r = 0; r < p.cells.length; r++)
          if (Array.isArray(p.cells[r]) && p.cells[r].length > cols) cols = p.cells[r].length;
        console.log('[TableGridExtractor] 旧格式解析成功:', rows, '行 x', cols, '列');
        return { rows: rows, cols: cols, cells: p.cells };
      }
      
      console.log('[TableGridExtractor] JSON格式不匹配');
    } catch(e) {
      console.log('[TableGridExtractor] JSON.parse 失败:', e.message);
    }
    return null;
  }

  _toBase64(dataUrl) {
    var idx = dataUrl.indexOf(',');
    return idx >= 0 ? dataUrl.substring(idx + 1) : dataUrl;
  }
}

window.TableGridExtractor = TableGridExtractor;
console.log('[TableGridExtractor v6.0] OK - 纯AI版本，已移除Tesseract');
