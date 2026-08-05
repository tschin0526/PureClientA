/**
 * 截图对账插件 (ScreenshotVerifyPlugin)
 * 
 * UI 层插件，职责单一：
 * - 管理浮动视窗和用户交互
 * - 调用 OcrEngine 进行图片识别
 * - 调用 TextDataParser 进行文本解析
 * - 渲染结果表格
 * 
 * 依赖：
 * - FloatingWindow 组件
 * - ocrEngine.js（OCR 引擎）
 * - textDataParser.js（文本结构化解析器）
 */
class ScreenshotVerifyPlugin {
  constructor() {
    this.verifyWindow = null;
    this.currentMarket = '';
    this._images = [];
    this._allData = [];
    this.MAX_IMAGES = 3;
    this._ocr = null;
    this._parser = null;
    this._tableExtractor = null;

    // ===== 交易记录 Schema 定义 =====
    // 每笔记录占2行：上行(名称|价格|方向) + 下行(股号|数量|成交额)
    this.TRADE_SCHEMA = {
      name: "交易记录",
      linesPerRecord: 2,
      fields: [
        { name: "名称", type: "X", line: 0, position: 0 },
        { name: "股号", type: "X", line: 1, position: 0 },
        { name: "价格", type: "N", line: 0, position: 1, hint: "price" },
        { name: "数量", type: "N", line: 1, position: 1, hint: "qty" },
        { name: "方向", type: "X", line: 0, position: 2, enumValues: ["买入","卖出"] },
        { name: "成交额", type: "N", line: 1, position: 2, hint: "amount" }
      ]
    };
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  _preprocessText(rawText, imgObj) {
    if (!rawText || !rawText.trim()) return rawText;

    try {
      // 使用图片对象的独立设置
      var keyword = (imgObj && imgObj.keyword) ? imgObj.keyword.trim() : '';
      var searchPosition = (imgObj && imgObj.searchPosition) ? imgObj.searchPosition : 'topLeft';

      // 如果关键字为空，不进行预处理
      if (!keyword) {
        console.log('[ScreenshotVerify] 截图' + (imgObj ? imgObj.index+1 : '?') + ' 关键字为空，返回原始文本');
        return rawText;
      }

      console.log('[ScreenshotVerify] 截图' + (imgObj ? imgObj.index+1 : '?') + ' 预处理参数: 关键字=[' + keyword + '], 搜索位置=[' + searchPosition + ']');

      var text = rawText;
      var keywordIndex = -1;

      if (searchPosition === 'topLeft') {
        keywordIndex = text.indexOf(keyword);
        if (keywordIndex >= 0) {
          text = text.substring(keywordIndex);
          console.log('[ScreenshotVerify] 截图' + (imgObj ? imgObj.index+1 : '?') + ' 左上角模式: 在位置 ' + keywordIndex + ' 找到关键字，截取后文本长度=' + text.length);
        } else {
          console.warn('[ScreenshotVerify] 截图' + (imgObj ? imgObj.index+1 : '?') + ' 左上角模式: 未找到关键字 [' + keyword + ']，返回原始文本');
        }
      } else if (searchPosition === 'bottomRight') {
        keywordIndex = text.lastIndexOf(keyword);
        if (keywordIndex >= 0) {
          text = text.substring(keywordIndex);
          console.log('[ScreenshotVerify] 截图' + (imgObj ? imgObj.index+1 : '?') + ' 右下角模式: 在位置 ' + keywordIndex + ' 找到关键字（最后一个），截取后文本长度=' + text.length);
        } else {
          console.warn('[ScreenshotVerify] 截图' + (imgObj ? imgObj.index+1 : '?') + ' 右下角模式: 未找到关键字 [' + keyword + ']，返回原始文本');
        }
      }

      return text;
    } catch(err) {
      console.error('[ScreenshotVerify] 预处理出错:', err);
      return rawText;
    }
  }

  openVerifyWindow(market) {
    this.currentMarket = market || '未知市场';
    this._images = [];
    this._allData = [];

    // 初始化工具
    this._ocr = new OcrEngine();
    this._parser = new TextDataParser();
    this._tableExtractor = new TableGridExtractor();

    console.log('[ScreenshotVerify] openVerifyWindow, market=' + this.currentMarket);

    var self = this;
    if (this.verifyWindow) { try { this.verifyWindow.close(); } catch(e){} }

    this.verifyWindow = new FloatingWindow({
      title: this.currentMarket + ' - 截图对账',
      sourceFile: 'screenshotVerifyPlugin.js',
      width: '720px',
      height: '700px',
      draggable: false,
      on: { close: function() { self.verifyWindow = null; } }
    });

    var html = '<div id="svContainer" style="display:flex;flex-direction:column;min-height:0;height:100%;overflow:hidden;">'

      + '<div style="padding:12px 16px;background:linear-gradient(135deg,#667eea,#764ba2);color:white;flex-shrink:0;">'
      + '<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">'
      + '<h2 style="margin:0;font-size:17px;font-weight:700;flex:1;">📸 ' + this.escapeHtml(this.currentMarket) + ' 截图对账</h2>'
      + '<span id="svImgCount" style="font-size:11px;background:rgba(255,255,255,0.2);padding:3px 10px;border-radius:12px;display:none;">0/' + this.MAX_IMAGES + '</span>'

      + '<label id="svAddBtn" style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;background:rgba(255,255,255,0.22);border:1.5px solid rgba(255,255,255,0.4);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:white;transition:all 0.2s;white-space:nowrap;" '
      + 'onmouseover="this.style.background=\'rgba(255,255,255,0.35)\'" onmouseout="this.style.background=\'rgba(255,255,255,0.22)\'">'
      + '📁 +添加 <input type="file" id="svFileInput" accept=".png,.jpg,.jpeg,.bmp,.webp" multiple style="display:none;"></label>'
      + '<button id="svParseBtn" onclick="window._svPlugin.startBatchParse();return false;" title="开始解析所有截图" style="display:none;padding:6px 14px;background:rgba(34,197,94,0.7);border:1.5px solid rgba(255,255,255,0.4);border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:white;transition:all 0.2s;white-space:nowrap;" '
      + 'onmouseover="this.style.background=\'rgba(34,197,94,0.9)\'" onmouseout="this.style.background=\'rgba(34,197,94,0.7)\'">🔍 解析</button>'
      + '<button id="svTableBtn" onclick="window._svPlugin.startTableExtract();return false;" title="提取表格格子内容，输出JSON网格" style="display:none;padding:6px 12px;background:rgba(168,85,247,0.7);border:1.5px solid rgba(255,255,255,0.4);border-radius:8px;cursor:pointer;font-size:12px;font-weight:700;color:white;transition:all 0.2s;white-space:nowrap;" '
      + 'onmouseover="this.style.background=\'rgba(168,85,247,0.9)\'" onmouseout="this.style.background=\'rgba(168,85,247,0.7)\'">📊 表格提取</button>'
      + '<button id="svClearAllBtn" onclick="window._svPlugin.clearAllImages();return false;" title="清除全部截图" style="display:none;padding:6px 12px;background:rgba(239,68,68,0.6);border:1px solid rgba(255,255,255,0.3);border-radius:8px;cursor:pointer;font-size:12px;font-weight:600;color:white;transition:all 0.2s;" '
      + 'onmouseover="this.style.background=\'rgba(239,68,68,0.85)\'" onmouseout="this.style.background=\'rgba(239,68,68,0.6)\'">🗑️ 全清</button>'
      + '</div>'

      + '<div id="svThumbsRow" style="display:flex;gap:8px;min-height:0;overflow-x:auto;padding-bottom:4px;"></div>'
      + '</div>'

      + '<div id="svStatusMsg" style="padding:6px 16px;display:none;flex-shrink:0;"></div>'

      + '<div id="svMainArea" style="flex:1;min-height:0;overflow:auto;padding:0 16px 16px;">'
      + '<div id="svResultSection" style="display:none;"><div id="svTableContainer"></div></div>'
      + '<div id="svEmptyHint" style="display:flex;align-items:center;justify-content:center;height:100%;min-height:200px;color:#a0aec0;font-size:14px;">👆 请先选择截图文件，然后点击「解析」按钮（最多' + this.MAX_IMAGES + '张）</div>'
      + '</div>'

      + '</div>';

    this.verifyWindow.setContent(html);
    this.verifyWindow.show();
    console.log('[ScreenshotVerify] 浮动视窗已显示, 尺寸: 720x700');

    setTimeout(function() { self.bindEvents(); }, 100);
  }

  bindEvents() {
    var self = this;
    var fi = document.getElementById('svFileInput');
    if (fi) fi.addEventListener('change', function(e) {
      var files = e.target.files;
      if (!files || files.length === 0) return;
      for (var i = 0; i < files.length; i++) { self.addImage(files[i]); }
      fi.value = '';
    });
  }

  addImage(file) {
    if (this._images.length >= this.MAX_IMAGES) {
      this.showStatus('⚠️ 最多支持 ' + this.MAX_IMAGES + ' 张截图', false);
      return;
    }
    if (!file.type.startsWith('image/')) { this.showStatus('❌ 请选择图片文件',false); return; }

    var idx = this._images.length;
    var self = this;
    var reader = new FileReader();
    reader.onload = function(e) {
      var dataUrl = e.target.result;
      var imgObj = {
        index: idx,
        name: file.name,
        data: dataUrl,
        ocrDone: false,
        ocrText: '',
        parsedData: [],
        searchPosition: 'topLeft',
        keyword: ''
      };
      self._images.push(imgObj);
      self.renderThumb(imgObj);
      self.updateUI();
    };
    reader.readAsDataURL(file);
  }

  renderThumb(imgObj) {
    var row = document.getElementById('svThumbsRow');
    if (!row) return;
    var idx = imgObj.index;
    var div = document.createElement('div');
    div.id = 'svThumb_' + idx;
    div.style.cssText = 'position:relative;display:flex;flex-direction:column;flex-shrink:0;align-items:center;gap:4px;background:rgba(0,0,0,0.15);border-radius:8px;padding:6px 8px;min-width:140px;';
    div.innerHTML = ''
      + '<div style="display:flex;align-items:center;gap:3px;width:100%;">'
      + '<span style="font-size:10px;color:rgba(255,255,255,0.7);font-weight:600;min-width:14px;text-align:center;">' + (idx + 1) + '</span>'
      + '<img src="' + imgObj.data + '" alt="" style="height:36px;border-radius:5px;border:1.5px solid rgba(255,255,255,0.4);cursor:pointer;object-fit:cover;transition:border-color 0.2s;" '
      + 'onmouseover="this.style.borderColor=\'#ffd700\'" onmouseout="this.style.borderColor=\'rgba(255,255,255,0.4)\'" onclick="window._svPlugin.showFullImage(' + idx + ')">'
      + (imgObj.ocrDone
        ? '<span style="font-size:10px;color:#86efac;margin-left:2px;">✓</span>'
        : '<span style="font-size:9px;color:#fcd34d;margin-left:2px;">待</span>')
      + '<button onclick="window._svPlugin.removeImage(' + idx + ');return false;" title="移除此截图" style="width:16px;height:16px;background:#ef4444;color:white;border:none;border-radius:50%;font-size:10px;line-height:16px;text-align:center;cursor:pointer;padding:0;margin-left:2px;">✕</button>'
      + '</div>'

      + '<div style="display:flex;flex-direction:column;gap:3px;width:100%;margin-top:2px;">'
      + '<div style="display:flex;align-items:center;gap:3px;">'
      + '<label style="font-size:9px;color:rgba(255,255,255,0.8);white-space:nowrap;font-weight:500;min-width:28px;">📍位置:</label>'
      + '<select id="svPos_' + idx + '" onchange="window._svPlugin.updateImageSettings(' + idx + ')" style="flex:1;padding:1px 3px;border:1px solid rgba(255,255,255,0.25);border-radius:3px;background:rgba(255,255,255,0.1);color:white;font-size:9px;cursor:pointer;">'
      + '<option value="topLeft"' + (imgObj.searchPosition === 'topLeft' ? ' selected' : '') + '>左上角</option>'
      + '<option value="bottomRight"' + (imgObj.searchPosition === 'bottomRight' ? ' selected' : '') + '>右下角</option>'
      + '</select>'
      + '</div>'

      + '<div style="display:flex;align-items:center;gap:3px;">'
      + '<label style="font-size:9px;color:rgba(255,255,255,0.8);white-space:nowrap;font-weight:500;min-width:28px;">🔑关键字:</label>'
      + '<input type="text" id="svKw_' + idx + '" maxlength="20" value="' + this.escapeHtml(imgObj.keyword || '') + '" placeholder="关键字(可选)" '
      + 'onchange="window._svPlugin.updateImageSettings(' + idx + ')" '
      + 'style="flex:1;padding:1px 3px;border:1px solid rgba(255,255,255,0.25);border-radius:3px;background:rgba(255,255,255,0.1);color:white;font-size:9px;min-width:60px;" '
      + 'title="从此关键字开始解析，之前的内容将被清洗掉">'
      + '</div>'
      + '</div>';
    row.appendChild(div);
  }

  updateImageSettings(idx) {
    var img = this._images.find(function(i) { return i.index === idx; });
    if (!img) return;

    var posEl = document.getElementById('svPos_' + idx);
    var kwEl = document.getElementById('svKw_' + idx);

    if (posEl) img.searchPosition = posEl.value;
    if (kwEl) img.keyword = kwEl.value.trim();

    console.log('[ScreenshotVerify] 截图' + (idx+1) + ' 设置更新: 位置=' + img.searchPosition + ', 关键字=[' + img.keyword + ']');
  }

  removeImage(idx) {
    this._images = this._images.filter(function(img) { return img.index !== idx; });
    this.rebuildAllData();
    var el = document.getElementById('svThumb_' + idx);
    if (el) el.remove();
    this.updateUI();
  }

  clearAllImages() {
    this._images = [];
    this._allData = [];
    var row = document.getElementById('svThumbsRow');
    if (row) row.innerHTML = '';
    var rs = document.getElementById('svResultSection'), eh = document.getElementById('svEmptyHint'), tc = document.getElementById('svTableContainer');
    if(rs)rs.style.display='none'; if(eh)eh.style.display='flex'; if(tc)tc.innerHTML='';
    this.updateUI();
    this.showStatus('', true);
  }

  updateUI() {
    var count = this._images.length;
    var cntEl = document.getElementById('svImgCount');
    if (cntEl) { cntEl.textContent = count + '/' + this.MAX_IMAGES; cntEl.style.display = count > 0 ? 'inline' : 'none'; }
    var addBtn = document.getElementById('svAddBtn');
    if (addBtn) addBtn.style.display = count >= this.MAX_IMAGES ? 'none' : 'inline-flex';
    var clearBtn = document.getElementById('svClearAllBtn');
    if (clearBtn) clearBtn.style.display = count > 0 ? 'inline-block' : 'none';
    var hasPending = this._images.some(function(img){return !img.ocrDone;});
    var parseBtn = document.getElementById('svParseBtn');
    if (parseBtn) parseBtn.style.display = hasPending ? 'inline-flex' : 'none';
    var tableBtn = document.getElementById('svTableBtn');
    if (tableBtn) tableBtn.style.display = hasPending ? 'inline-flex' : 'none';
  }

  showFullImage(idx) {
    var img = this._images.find(function(i){return i.index===idx;});
    if(!img||!img.data) return;
    var ov=document.createElement('div');
    ov.id='svFullImgOverlay';
    ov.style.cssText='position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.75);z-index:99999;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:20px;box-sizing:border-box;';
    ov.innerHTML='<img src="'+img.data+'" style="max-width:100%;max-height:100%;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);" onclick="event.stopPropagation();">';
    ov.onclick=function(){document.body.removeChild(ov);};
    document.body.appendChild(ov);
  }

  async startBatchParse() {
    var pending = this._images.filter(function(img){return !img.ocrDone;});
    if (pending.length === 0) { this.showStatus('⚠️ 没有待解析的截图', false); return; }

    this.showStatus('🔍 开始解析 ' + pending.length + ' 张截图...', true);

    for (var i = 0; i < pending.length; i++) {
      await this.processOneImage(pending[i].index);
    }

    this.showStatus('✅ 全部解析完成！', true);
  }

  async processOneImage(idx) {
    var img = this._images.find(function(i){return i.index===idx;});
    if(!img) return;
    this.showStatus('🔍 截图 ' + (idx+1) + ' 正在OCR识别...', true);

    try {
      // 步骤1: OCR 识别
      var text = await this._ocr.recognize(img.data);
      img.ocrDone = true;
      img.ocrText = text || '';

      console.log('[ScreenshotVerify] 截图'+(idx+1)+' OCR 结果长度:', text ? text.length : 0);

      // 步骤2: 文本预处理（根据每个截图的独立设置清洗文本）
      var processedText = this._preprocessText(text, img);
      img.processedText = processedText;

      console.log('[ScreenshotVerify] 截图'+(idx+1)+' 预处理后文本长度:', processedText ? processedText.length : 0);

      // 步骤3: 文本结构化解析
      if (processedText && processedText.trim()) {
        img.parsedData = this._parser.parse(processedText.trim(), this.TRADE_SCHEMA);
        console.log('[ScreenshotVerify] 截图'+(idx+1)+' 解析出 '+img.parsedData.length+' 条记录');

        var debugStr = '═══ OCR 原始文本 (' + text.length + '字) ═══\n' + text.trim().substring(0, 300) + (text.length > 300 ? '\n...(省略)' : '') + '\n\n';
        if (processedText !== text) {
          debugStr += '═══ 预处理后文本 (' + processedText.length + '字) ═══\n' + processedText.trim().substring(0, 300) + (processedText.length > 300 ? '\n...(省略)' : '') + '\n\n';
        }
        debugStr += '═══ TextDataParser 解析结果: ' + img.parsedData.length + ' 条 ═══\n\n';
        for (var di = 0; di < img.parsedData.length; di++) {
          var r = img.parsedData[di];
          debugStr += (di+1) + '. 名称=[' + r['名称'] + '] 股号=[' + r['股号'] + '] 价格=[' + r['价格'] + '] 数量=[' + r['数量'] + '] 方向=[' + r['方向'] + '] 成交额=[' + r['成交额'] + ']\n';
        }
        if (img.parsedData.length === 0) debugStr += '(空！)';
        alert('【截图' + (idx+1) + '】\n\n' + debugStr);
      } else {
        img.parsedData = [];
        console.warn('[ScreenshotVerify] 截图'+(idx+1)+' OCR返回空文本');
      }

      // 更新缩略图状态
      var thumbEl = document.getElementById('svThumb_' + idx);
      if (thumbEl) {
        var spans = thumbEl.querySelectorAll('span');
        for (var s = 0; s < spans.length; s++) {
          if (spans[s].textContent === '待') {
            spans[s].textContent = img.parsedData.length > 0 ? '✓' : '✗';
            spans[s].style.color = img.parsedData.length > 0 ? '#86efac' : '#f87171';
            break;
          }
        }
      }

      this.rebuildAllData();
    } catch(err) {
      console.error('[ScreenshotVerify] 截图'+idx+' 处理失败:', err);
      img.ocrDone = true;
      img.parsedData = [];
      img.error = err.message;
      var thumbEl2 = document.getElementById('svThumb_' + idx);
      if (thumbEl2) {
        var spans2 = thumbEl2.querySelectorAll('span');
        for (var t = 0; t < spans2.length; t++) {
          if (spans2[t].textContent === '待') { spans2[t].textContent = '✗'; spans2[t].style.color = '#f87171'; break; }
        }
      }
      this.rebuildAllData();
    }
  }

  rebuildAllData() {
    var all = [];
    for (var i = 0; i < this._images.length; i++) {
      var img = this._images[i];
      if (img.parsedData && img.parsedData.length > 0) {
        for (var j = 0; j < img.parsedData.length; j++) {
          var rec = Object.assign({}, img.parsedData[j]);
          rec._srcIdx = img.index;
          rec._srcName = img.name;
          all.push(rec);
        }
      }
    }
    all = this.deduplicate(all);
    this._allData = all;

    var doneCount = this._images.filter(function(img){return img.ocrDone;}).length;
    var totalImg = this._images.length;
    var hasPending = doneCount < totalImg;

    if (hasPending) {
      if (all.length > 0) {
        var eh2=document.getElementById('svEmptyHint');if(eh2)eh2.style.display='none';
        this.renderTable(all);
        this.showStatus('🔍 已完成 '+doneCount+'/'+totalImg+' 张，已识别 '+all.length+' 条（继续解析中...）', true);
      } else {
        this.showStatus('🔍 正在解析第 '+(doneCount+1)+'/'+totalImg+' 张截图...', true);
      }
      return;
    }

    var rs=document.getElementById('svResultSection'), eh=document.getElementById('svEmptyHint'), tc=document.getElementById('svTableContainer');
    if(rs)rs.style.display='none'; if(tc)tc.innerHTML='';

    if (all.length === 0 && totalImg > 0) {
      this.showStatus('❌ 所有截图均未能识别到交易记录，请检查截图是否正确', false);
      if(eh){eh.style.display='flex';eh.innerHTML='<div style="text-align:center;color:#ef4444;font-size:15px;">⚠️ 无法识别交易数据<br><span style="font-size:12px;color:#a0aec0;margin-top:6px;display:inline-block;">请确认截图内容是否为交易明细</span></div>';}
      return;
    }
    if(eh)eh.style.display='none';
    this.renderTable(all);
    this.showStatus('✅ 全部 '+totalImg+' 张完成！共 '+all.length+' 条记录', true);
  }

  deduplicate(data){
    var seen={}, result=[];
    for(var i=0;i<data.length;i++){
      var r=data[i];
      var key=(r['名称']||'')+'|'+(r['股号']||'')+'|'+(r['价格']||'')+'|'+(r['数量']||'')+'|'+(r['方向']||'')+'|'+(r['成交额']||'');
      if(!seen[key]){seen[key]=true;result.push(r);}
    }
    if(result.length<data.length) console.log('[ScreenshotVerify] 去重: '+data.length+' → '+result.length);
    return result;
  }

  showDemoData(){
    var eh=document.getElementById('svEmptyHint');if(eh)eh.style.display='none';
    this.renderTable([
      {'名称':'GC001','股号':'204001','价格':'100.000','数量':'649','方向':'卖出','成交额':'649000.000'},
      {'名称':'证券ETF国泰','股号':'512880','价格':'1.085','数量':'40000','方向':'买入','成交额':'434000.000'},
      {'名称':'证券ETF国泰','股号':'512880','价格':'1.089','数量':'40000','方向':'卖出','成交额':'43540.000'},
      {'名称':'恒生科技ETF华泰柏瑞','股号':'513130','价格':'0.613','数量':'40000','方向':'买入','成交额':'24500.000'},
      {'名称':'恒生科技ETF华泰柏瑞','股号':'513130','价格':'0.615','数量':'40000','方向':'卖出','成交额':'24580.000'},
      {'名称':'中国神华','股号':'601088','价格':'47.825','数量':'1000','方向':'买入','成交额':'47825.000'},
      {'名称':'中国神华','股号':'601088','价格':'48.050','数量':'1000','方向':'卖出','成交额':'48050.000'},
      {'名称':'兴业银行','股号':'601166','价格':'17.938','数量':'4000','方向':'买入','成交额':'71750.000'},
      {'名称':'兴业银行','股号':'601166','价格':'17.960','数量':'2000','方向':'卖出','成交额':'35920.000'},
      {'名称':'联芸科技','股号':'688449','价格':'50.810','数量':'1500','方向':'买入','成交额':'76215.000'},
      {'名称':'联芸科技','股号':'688449','价格':'51.110','数量':'2000','方向':'卖出','成交额':'102220.000'},
      {'名称':'红棉股份','股号':'000523','价格':'3.450','数量':'5000','方向':'卖出','成交额':'17250.000'},
      {'名称':'嘉美包装','股号':'','价格':'22.960','quantity':'','direction':'买入','成交额':''}
    ]);
    this.showStatus('💡 演示数据（OCR不可用时）',true);
  }

  renderTable(data){
    var rs=document.getElementById('svResultSection'),tc=document.getElementById('svTableContainer');
    if(!rs||!tc)return;rs.style.display='block';

    var bc=data.filter(function(d){return d['方向']==='买入';}).length,sc=data.filter(function(d){return d['方向']==='卖出';}).length;

    var h='<div style="margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
      +'<span style="font-size:15px;font-weight:700;color:#2d3748;">📊 识别结果</span>'
      +'<div style="display:flex;gap:10px;flex:1;justify-content:flex-end;">'
      +'<span style="background:#ede9fe;color:#6d28d9;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">共 '+data.length+' 笔</span>'
      +'<span style="background:#d1fae5;color:#065f46;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">买入 '+bc+'</span>'
      +'<span style="background:#fee2e2;color:#991b1b;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">卖出 '+sc+'</span>'
      +'</div></div>'

      + '<div style="overflow:auto;border:1px solid #e2e8f0;border-radius:10px;background:white;">'
      + '<table style="width:auto;min-width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed;">'
      + '<thead><tr style="background:linear-gradient(135deg,#667eea,#764ba2);color:white;">'
      + '<th style="padding:7px 8px;text-align:left;font-weight:600;width:140px;">名称</th>'
      + '<th style="padding:7px 6px;text-align:left;font-weight:600;width:75px;">股号</th>'
      + '<th style="padding:7px 6px;text-align:right;font-weight:600;width:75px;">价格</th>'
      + '<th style="padding:7px 6px;text-align:right;font-weight:600;width:70px;">数量</th>'
      + '<th style="padding:7px 4px;text-align:center;font-weight:600;width:48px;">方向</th>'
      + '<th style="padding:7px 6px;text-align:right;font-weight:600;width:130px;">成交额</th></tr></thead><tbody>';

    for(var i=0;i<data.length;i++){
      var r=data[i];
      var dirStyle=r['方向']==='买入'?'color:#065f46':(r['方向']==='卖出'?'color:#991b1b':'color:#a0aec0');
      var bg=i%2===0?'#ffffff':'#f8fafc';
      var fmtQty=r['数量']?String(r['数量']).replace(/\B(?=(\d{3})+(?!\d))/g,','):'';
      var fmtAmt=r['成交额']?String(r['成交额']).replace(/\B(?=(\d{3})+(?!\d))/g,','):'';
      h+='<tr style="background:'+bg+';" onmouseover="this.style.background=\'#ebf4ff\'" onmouseout="this.style.background=\''+bg+'\'">'
        + '<td style="padding:6px 8px;border-bottom:1px solid #edf2f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"><span style="font-weight:700;color:#1a202c;">'+this.escapeHtml(r['名称'])+'</span></td>'
        + '<td style="padding:6px 6px;border-bottom:1px solid #edf2f2;font-family:monospace;color:#718096;font-size:11px;">'+this.escapeHtml(r['股号'])+'</td>'
        + '<td style="padding:6px 6px;border-bottom:1px solid #edf2f2;text-align:right;font-family:monospace;color:#2d3748;">'+r['价格']+'</td>'
        + '<td style="padding:6px 6px;border-bottom:1px solid #edf2f2;text-align:right;font-family:monospace;color:#4a5568;">'+fmtQty+'</td>'
        + '<td style="padding:3px 2px;border-bottom:1px solid #edf2f2;text-align:center;font-size:12px;font-weight:700;'+dirStyle+';">'+(r['方向']||'-')+'</td>'
        + '<td style="padding:6px 6px;border-bottom:1px solid #edf2f2;text-align:right;font-family:monospace;color:#1a202c;font-weight:700;">'+fmtAmt+'</td></tr>';
    }
    h+='</tbody></table></div>';
    tc.innerHTML=h;
  }

  showStatus(msg,isOk){
    var el=document.getElementById('svStatusMsg');if(!el)return;
    if(!msg){el.style.display='none';return;}
    el.innerHTML=msg;el.style.display='block';el.style.padding='6px 16px';el.style.margin='0';el.style.borderRadius='0';el.style.fontWeight='600';el.style.fontSize='12px';
    if(isOk){el.style.background='#d1fae5';el.style.color='#065f46';}
    else{el.style.background='#fee2e2';el.style.color='#991b1b';}
  }

  async startTableExtract() {
    var pending = this._images.filter(function(img){return !img.ocrDone;});
    if (pending.length === 0) { this.showStatus('⚠️ 没有待处理的截图', false); return; }
    if (pending.length > 1) { this.showStatus('⚠️ 表格提取仅支持单张截图，请只保留一张', false); return; }

    var img = pending[0];
    this.showStatus('📊 正在检测表格网格线...', true);

    try {
      var self = this;
      var result = await this._tableExtractor.extract(img.data, {
        onProgress: function(p) {
          if (p.step === 'detect_lines') {
            self.showStatus('📊 ' + p.message, true);
          } else if (p.step === 'ocr_cells') {
            var pct = Math.round(p.current / p.total * 100);
            self.showStatus('📊 OCR识别格子 ' + p.current + '/' + p.total + ' (' + pct + '%)', true);
          }
        }
      });

      img.ocrDone = true;
      img.tableGrid = result;

      console.log('[ScreenshotVerify] 表格提取完成: ' + result.rows + '行 x ' + result.cols + '列');

      var thumbEl = document.getElementById('svThumb_' + img.index);
      if (thumbEl) {
        var spans = thumbEl.querySelectorAll('span');
        for (var s = 0; s < spans.length; s++) {
          if (spans[s].textContent === '待') {
            spans[s].textContent = '✓';
            spans[s].style.color = '#c084fc';
            break;
          }
        }
      }

      this.renderTableGrid(result);
      this.showStatus('✅ 表格提取完成！共 ' + result.rows + ' 行 x ' + result.cols + ' 列', true);

    } catch (err) {
      console.error('[ScreenshotVerify] 表格提取失败:', err);
      this.showStatus('❌ 表格提取失败: ' + err.message, false);
    }
  }

  renderTableGrid(grid) {
    var rs = document.getElementById('svResultSection'), tc = document.getElementById('svTableContainer'), eh = document.getElementById('svEmptyHint');
    if (!rs || !tc) return;
    if (eh) eh.style.display = 'none';
    rs.style.display = 'block';

    if (!grid || !grid.cells || grid.cells.length === 0) {
      tc.innerHTML = '<div style="text-align:center;color:#a0aec0;padding:20px;">未能提取到表格数据</div>';
      return;
    }

    var rows = grid.rows;
    var cols = grid.cols;
    var cells = grid.cells;
    var jsonStr = JSON.stringify(grid, null, 2);

    var h = '<div style="margin-bottom:12px;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
      + '<span style="font-size:15px;font-weight:700;color:#2d3748;">📊 表格识别结果</span>'
      + '<div style="display:flex;gap:10px;flex:1;justify-content:flex-end;align-items:center;">'
      + '<span style="background:#ede9fe;color:#6d28d9;padding:4px 14px;border-radius:20px;font-size:12px;font-weight:600;">' + rows + '行×' + cols + '列</span>'
      + '<button id="svCopyJsonBtn" onclick="window._svPlugin.copyTableJson();return false;" '
      + 'style="padding:5px 12px;background:#6d28d9;color:white;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;" '
      + 'onmouseover="this.style.background=\'#5b21b6\'" onmouseout="this.style.background=\'#6d28d9\'">📋 复制JSON</button>'
      + '<button id="svViewJsonBtn" onclick="window._svPlugin.viewTableJson();return false;" '
      + 'style="padding:5px 12px;background:#7c3aed;color:white;border:none;border-radius:6px;cursor:pointer;font-size:11px;font-weight:600;display:flex;align-items:center;gap:4px;" '
      + 'onmouseover="this.style.background=\'#6d28d9\'" onmouseout="this.style.background=\'#7c3aed\'">👁️ 查看JSON</button>'
      + '</div></div>';

    h += '<div style="overflow:auto;border:1px solid #e2e8f0;border-radius:10px;background:white;max-height:400px;">';
    h += '<table style="width:auto;min-width:100%;border-collapse:collapse;font-size:11px;table-layout:auto;">';
    h += '<tbody>';

    for (var r = 0; r < rows; r++) {
      var rowBg = r === 0 ? 'linear-gradient(135deg,#667eea,#764ba2)' : (r % 2 === 0 ? '#ffffff' : '#f8fafc');
      var textColor = r === 0 ? 'white' : '#1a202c';
      var fontWeight = r === 0 ? '700' : '400';
      h += '<tr style="background:' + rowBg + ';">';
      for (var c = 0; c < cols; c++) {
        var cellContent = cells[r][c] || '';
        var maxW = cols > 8 ? '120px' : '150px';
        h += '<td style="padding:6px 10px;border-bottom:1px solid #edf2f2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:' + maxW + ';color:' + textColor + ';font-weight:' + fontWeight + ';font-size:' + (r === 0 ? '12px' : '11px') + ';">'
          + this.escapeHtml(cellContent) + '</td>';
      }
      h += '</tr>';
    }
    h += '</tbody></table></div>';

    this._lastGridJson = jsonStr;
    tc.innerHTML = h;
  }

  copyTableJson() {
    if (!this._lastGridJson) {
      alert('没有可复制的 JSON 数据');
      return;
    }
    var self = this;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(this._lastGridJson).then(function() {
        self.showStatus('✅ JSON 已复制到剪贴板！', true);
      }, function() {
        self._fallbackCopyJson();
      });
    } else {
      this._fallbackCopyJson();
    }
  }

  _fallbackCopyJson() {
    var ta = document.createElement('textarea');
    ta.value = this._lastGridJson;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showStatus('✅ JSON 已复制到剪贴板！', true);
    } catch (e) {
      alert('请手动复制以下 JSON:\n\n' + this._lastGridJson);
    }
    document.body.removeChild(ta);
  }

  viewTableJson() {
    if (!this._lastGridJson) {
      alert(JSON.stringify({rows:0, cols:0, cells:[]}, null, 2));
      return;
    }
    var maxShow = 2000;
    var showStr = this._lastGridJson;
    if (showStr.length > maxShow) {
      showStr = showStr.substring(0, maxShow) + '\n\n... (截断，总长度 ' + this._lastGridJson.length + ' 字符，请用「复制JSON」按钮获取完整数据)';
    }
    alert(showStr);
  }
}

// 注册全局实例
window._svPlugin = new ScreenshotVerifyPlugin();
console.log('[ScreenshotVerify] 插件已加载, 实例注册到 window._svPlugin');
