/**
 * OCR 引擎 (OcrEngine)
 * 
 * 独立的 OCR 工具类，职责单一：
 * - 接收图片数据（Data URL / File）
 * - 调用 Tesseract.js 进行文字识别
 * - 返回识别后的纯文本
 * 
 * 使用方式：
 *   var engine = new OcrEngine();
 *   var text = await engine.recognize(imageDataUrl);
 */
class OcrEngine {
  constructor() {
    this._loaded = false;
    this._loading = false;
  }

  async recognize(imageData) {
    if (!imageData) throw new Error('OcrEngine: 图片数据为空');

    if (!this._loaded) {
      await this._ensureLoaded();
    }

    var self = this;
    var result = await Tesseract.recognize(imageData, 'chi_sim+eng', {
      logger: function(m) {
        if (self.onProgress && typeof self.onProgress === 'function') {
          self.onProgress(m);
        }
      },
      
      // ✅ 新增：优化中文识别配置，减少字间空格
      tessedit_char_whitelist: '',  // 不限制字符集（允许所有字符）
      tessedit_preserve_interword_spaces: '0',  // ❌ 关键！保留单词间空格 = 否
      preserve_interword_spaces: false,           // 不保留单词间的空格
      
      // 页面分割模式 (Page Segmentation Mode)
      // 6 = 假设为统一文本块（适合表格、列表）
      // 7 = 将图片视为单行文本
      // 11 = 稀疏文本（尽量不添加额外空格）
      psm: 6,
      
      // OEM (OCR Engine Mode)
      // 1 = LSTM only（神经网络模式，更准确）
      oem: 1,
      
      // 其他优化参数
      textord_heavy_norm: '1',       // 使用重度规范化
      edges_use_new_outline_complexity_clsfr: '0',  // 减少边缘检测复杂度
      chop_enable: '0'               // 禁用字符切割（减少错误分割）
    });

    return result.data.text || '';
  }

  async _ensureLoaded() {
    if (this._loaded) return;
    if (this._loading) {
      while (this._loading) { await new Promise(function(r){setTimeout(r,100);}); }
      return;
    }

    this._loading = true;

    if (typeof Tesseract === 'undefined') {
      console.log('[OcrEngine] 加载 Tesseract.js...');
      await new Promise(function(res, rej) {
        var s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        s.onload = res;
        s.onerror = function() { rej(new Error('Tesseract.js 加载失败')); };
        document.head.appendChild(s);
      });
    }

    this._loaded = true;
    this._loading = false;
    console.log('[OcrEngine] Tesseract.js 就绪');
  }

  isReady() {
    return this._loaded;
  }
}

window.OcrEngine = OcrEngine;
console.log('[OcrEngine] 工具已加载');
