/**
 * 截图对账插件 - 纯 React 18 版本 (ScreenshotVerifyPluginReact)
 * 
 * 📦 版本: 2.0.0 (2026-05-07)
 * 
 * 🔥 v2.0.0 重大更新 - 智能数据提取与自动识别系统
 * 
 * ✨ 新功能:
 * 1. 智能字段提取算法
 *    - 从固定position改为基于内容特征识别
 *    - 名称=连续非数字token, 价格=数字, 方向=买卖+入/出
 *    - 股号/数量/成交额按数字出现顺序分配
 * 
 * 2. 股票名称智能矫正系统 (correctStockName)
 *    - 三级匹配策略：代码精确匹配 > 名称包含 > 模糊匹配
 *    - 优先使用股票代码进行100%准确匹配
 *    - 从 window.ALL_STOCKS 读取 screenshotName 数据
 *    - 只在OCR确实错误时才显示矫正信息（智能判断）
 * 
 * 3. 自动关键字检测功能 (detectStockNameFromOCR)
 *    - OCR完成后自动检测已知股票名称并填充关键字框
 *    - 8条严格验证规则（防时间戳、表头、数字等误匹配）
 *    - 自动填充后立即用于解析（与手动输入完全一致）
 *    - UI特殊样式标识（黄色边框+✨标记）
 * 
 * 4. 多截图完整支持
 *    - OCR/预处理/解析结果标签页支持显示所有截图
 *    - 数据结构从单对象改为数组存储
 *    - 垂直滚动查看所有截图结果
 * 
 * 5. 文本预处理增强展示
 *    - Token分解可视化（按类型着色：名称/数字/其他）
 *    - 字段提取结果内联显示（每行显示该行提取的字段值）
 *    - 执行代码信息展示（4个核心模块说明）
 *    - 矫正详情对比（OCR原值 vs 矫正值 + 匹配度）
 * 
 * 🐛 Bug修复:
 * - ✅ 修复字段映射错误（lineInRecord计算bug）
 * - ✅ 修复解析结果与预处理数据不一致的问题
 * - ✅ 修复多截图时只显示最后一个的严重Bug
 * - ✅ 修复stockData加载路径错误（window.ALL_STOCKS）
 * - ✅ 修复自动填充关键字未触发解析的致命问题
 * - ✅ 修复自动检测误匹配时间戳/表头的安全问题
 * 
 * 📊 数据源:
 * - stockData.js v1.2.0 (screenshotName + code 字段)
 * - ocrEngine.js (Tesseract.js v5, PSM:6, OEM:1)
 * - textDataParser.js (Schema-based parser)
 * 
 * 技术栈：
 * - React 18 (函数组件 + Hooks)
 * - ReactDOM 18 (createRoot API)
 * - FloatingWindowReact (React 版浮动视窗)
 * - React.createElement() (不使用 JSX，无需 Babel)
 *
 * 架构特点：
 * ✅ 完全的 React 架构（无 Vanilla JS 混合）
 * ✅ 使用 useState 管理状态
 * ✅ 使用 useCallback 优化事件处理
 * ✅ 使用 useRef 存储 OCR/Parser 实例
 * ✅ 正确的生命周期管理
 * ✅ 统一的事件系统
 *
 * 依赖：
 * - FloatingWindowReact.js (React 版浮动视窗)
 * - ocrEngine.js / textDataParser.js
 * - stockData.js (股票数据，window.ALL_STOCKS)
 */

(function() {
  'use strict';

  // ===== 检查依赖 =====
  if (typeof React === 'undefined' || typeof ReactDOM === 'undefined') {
    console.error('[SV-React] React 或 ReactDOM 未加载！');
    return;
  }

  if (typeof FloatingWindowReact === 'undefined') {
    console.error('[SV-React] FloatingWindowReact 未加载！');
    return;
  }

  var useState = React.useState;
  var useEffect = React.useEffect;
  var useCallback = React.useCallback;
  var useRef = React.useRef;
  var createElement = React.createElement;

  // ===== 工具函数 =====
  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function formatNumber(val) {
    if (!val && val !== 0) return '';
    return String(val).replace(/\B(?=(\d{3})+(?!\d))/g,',');
  }

  // ===== 股票名称智能矫正系统 =====

  var _svStocks = null;
var _svLastGridJson = null;

  function getStockNameMapping() {
    if (_svStocks && _svStocks.length > 0) {
      return _svStocks.map(function(s) {
        return { name: s.name, code: s.code || '', screenshotName: (s.screenshotName || s.name || '').trim() };
      });
    }
    try {
      var allStocks = window.ALL_STOCKS;
      if (!allStocks && typeof stockData !== 'undefined') allStocks = stockData.ALL_STOCKS;
      if (allStocks) {
        return allStocks.map(function(s) {
          return { name: s.name, code: s.code || '', screenshotName: (s.screenshotName || s.name || '').trim() };
        });
      }
    } catch(e) { console.error('[SV-React] ❌ 加载失败:', e.message); }
    return [];
  }

  /**
   * 计算两个字符串的相似度（基于最长公共子序列）
   * @param {string} str1 
   * @param {string} str2
   * @returns {number} 0-1 之间的相似度
   */
  function calculateSimilarity(str1, str2) {
    if (!str1 || !str2) return 0;
    
    var s1 = str1.replace(/\s+/g, '');
    var s2 = str2.replace(/\s+/g, '');
    
    if (s1 === s2) return 1.0;
    if (s1.indexOf(s2) >= 0 || s2.indexOf(s1) >= 0) return 0.9;
    
    // 简单的字符级别相似度计算
    var len1 = s1.length;
    var len2 = s2.length;
    var maxLen = Math.max(len1, len2);
    if (maxLen === 0) return 1.0;
    
    var matches = 0;
    for (var i = 0; i < Math.min(len1, len2); i++) {
      if (s1[i] === s2[i]) matches++;
    }
    
    return matches / maxLen;
  }

  /**
   * 智能股票名称矫正（增强版 - 支持代码优先验证 + 智能判断是否需要矫正）
   * @param {string} ocrName - OCR识别出的名称
   * @param {string} [stockCode] - 提取出的股票代码（可选）
   * @returns {object} { correctedName, originalName, isCorrected, matchScore, matchedStock, correctionMethod }
   */
  function correctStockName(ocrName, stockCode) {
    console.log('[SV-React] 📞 correctStockName 被调用');
    console.log('[SV-React]   - ocrName:', ocrName);
    console.log('[SV-React]   - stockCode:', stockCode, '(类型:', typeof stockCode, ')');
    
    if (!ocrName || !ocrName.trim()) {
      console.log('[SV-React] ⚠️ ocrName 为空，返回原始值');
      return { correctedName: ocrName, originalName: ocrName, isCorrected: false };
    }

    var stockMapping = getStockNameMapping();
    console.log('[SV-React] 📊 获取到映射表长度:', stockMapping.length);
    
    if (stockMapping.length === 0) {
      console.warn('[SV-React] ❌ 映射表为空！矫正功能不可用');
      return { correctedName: ocrName, originalName: ocrName, isCorrected: false };
    }

    // ✅ 核心改进：先查找正确的标准名称
    var standardName = null;  // 从数据库查到的正确名称
    var matchMethod = null;
    var matchedStock = null;

    // ===== 策略0：股票代码精确匹配 =====
    if (stockCode && stockCode.trim()) {
      var normalizedCode = stockCode.replace(/[\s]/g, '');
      
      for (var ci = 0; ci < stockMapping.length; ci++) {
        var codeStock = stockMapping[ci];
        if (codeStock.code && codeStock.code.replace(/[\s]/g, '') === normalizedCode) {
          standardName = codeStock.screenshotName;
          matchMethod = 'CODE_EXACT';
          matchedStock = codeStock;
          break;
        }
      }
    }

    // ===== 策略1：名称完全匹配或包含关系（如果代码没匹配到）=====
    if (!standardName) {
      var normalizedOCR = ocrName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
      
      for (var i = 0; i < stockMapping.length; i++) {
        var stock = stockMapping[i];
        var knownName = stock.screenshotName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
        
        if (normalizedOCR === knownName || 
            normalizedOCR.indexOf(knownName) >= 0 || 
            knownName.indexOf(normalizedOCR) >= 0) {
          standardName = stock.screenshotName;
          matchMethod = 'NAME_CONTAIN';
          matchedStock = stock;
          break;
        }
      }

      // ===== 策略2：模糊匹配 =====
      if (!standardName) {
        var bestMatch = null;
        var bestScore = 0;
        var THRESHOLD = 0.55;

        for (var fi = 0; fi < stockMapping.length; fi++) {
          var fuzzyStock = stockMapping[fi];
          var fuzzyKnownName = fuzzyStock.screenshotName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
          
          var score = calculateSimilarity(normalizedOCR, fuzzyKnownName);
          if (score > bestScore && score >= THRESHOLD) {
            bestScore = score;
            bestMatch = fuzzyStock;
          }
        }

        if (bestMatch) {
          standardName = bestMatch.screenshotName;
          matchMethod = 'FUZZY';
          matchedStock = bestMatch;
        }
      }
    }

    // ✅ 关键判断：比较 OCR 名称和标准名称，决定是否需要矫正
    if (standardName) {
      var normalizedOCRFinal = ocrName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
      var normalizedStandard = standardName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
      
      // 判断：只有当两个名称确实不同时，才标记为"已矫正"
      var needsCorrection = (normalizedOCRFinal !== normalizedStandard);
      
      console.log('[SV-React] 📊 匹配结果分析:');
      console.log('[SV-React]   OCR名称:', ocrName, '(标准化后:', normalizedOCRFinal, ')');
      console.log('[SV-React]   标准名称:', standardName, '(标准化后:', normalizedStandard, ')');
      console.log('[SV-React]   是否需要矫正:', needsCorrection ? '✅ 是' : '❌ 否 (已正确)');
      console.log('[SV-React]   匹配方法:', matchMethod);
      
      return {
        correctedName: standardName,
        originalName: ocrName,
        isCorrected: needsCorrection,  // ← 关键！只在真正需要时才标记为 true
        matchScore: needsCorrection ? calculateSimilarity(normalizedOCRFinal, normalizedStandard) : 1.0,
        matchedStock: matchedStock,
        correctionMethod: matchMethod
      };
    }

    // 未找到任何匹配
    return { correctedName: ocrName, originalName: ocrName, isCorrected: false };
  }

  /**
   * 从OCR文本中自动检测股票名称（用于自动填充关键字）- 增强版
   * @param {string} ocrText - OCR识别的原始文本
   * @returns {object} { detectedName, matchedStock, matchMethod } | null
   */
  function detectStockNameFromOCR(ocrText) {
    if (!ocrText || !ocrText.trim()) {
      return null;
    }

    // 去除所有空格，得到纯净文本
    var cleanText = ocrText.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
    
    if (cleanText.length < 10) {
      return null;  // 文本太短，不太可能包含完整的交易记录
    }

    console.log('[SV-React] 🔍 开始从OCR文本中检测股票名称...');
    console.log('[SV-React] 原始文本长度:', ocrText.length, '字符');
    console.log('[SV-React] 清洗后长度:', cleanText.length, '字符');
    console.log('[SV-React] 前100字符预览:', cleanText.substring(0, 100));

    // 获取所有已知的股票名称（优先使用 screenshotName）
    var stockMapping = getStockNameMapping();
    
    if (stockMapping.length === 0) {
      console.warn('[SV-React] ⚠️ 无股票名称数据，无法自动检测');
      return null;
    }

    console.log('[SV-React] 可用股票名称数:', stockMapping.length);

    /**
     * 验证函数：检查字符串是否像有效的股票名称
     * @param {string} name - 待验证的名称
     * @param {number} position - 在文本中的位置
     * @returns {boolean} 是否有效
     */
    function isValidStockName(name, position) {
      // 规则1：长度检查（至少2个字符）
      if (!name || name.length < 2) {
        console.log('  ❌ 验证失败: 名称太短 ("' + name + '")');
        return false;
      }
      
      // 规则2：必须包含至少一个中文字符
      var hasChinese = /[\u4e00-\u9fa5]/.test(name);
      if (!hasChinese) {
        console.log('  ❌ 验证失败: 不包含中文 ("' + name + '")');
        return false;
      }
      
      // 规则3：不能是纯数字
      if (/^[\d,.]+$/.test(name)) {
        console.log('  ❌ 验证失败: 纯数字 ("' + name + '")');
        return false;
      }
      
      // 规则4：不能是时间戳格式（如 "18:02", "18:02有", "2026/05/06"）
      if (/^\d{1,2}:\d{2}/.test(name) || /^\d{4}\/\d{2}\/\d{2}/.test(name)) {
        console.log('  ❌ 验证失败: 时间戳格式 ("' + name + '")');
        return false;
      }
      
      // 规则5：不能是表头文字（常见表头关键词黑名单）
      var headerKeywords = ['名称', '价格', '数量', '方向', '成交额', '股号', '代码', '金额', '买入', '卖出', '持仓', '盈亏'];
      var isHeaderKeyword = headerKeywords.some(function(kw) {
        return name.indexOf(kw) >= 0 && name.length <= kw.length + 3;
      });
      if (isHeaderKeyword) {
        console.log('  ❌ 验证失败: 包含表头关键词 ("' + name + '")');
        return false;
      }
      
      // 规则6：不能以数字开头后跟冒号或斜杠（时间特征）
      if (/^\d+[:\/]/.test(name)) {
        console.log('  ❌ 验证失败: 以数字和特殊符号开头 ("' + name + '")');
        return false;
      }
      
      // 规则7：位置不能在最开头0-20字符内（通常是标题/表头区域）
      if (position < 20 && cleanText.length > 50) {
        console.log('  ⚠️ 警告: 匹配位置过于靠前 (' + position + ')，可能是表头');
        // 不直接拒绝，但降低优先级
      }
      
      // 规则8：不能包含明显的非名称字符组合
      if (/[<>{}[\]|\\\/=+\-*#@!%^&()]/.test(name)) {
        console.log('  ❌ 验证失败: 包含特殊符号 ("' + name + '")');
        return false;
      }
      
      console.log('  ✅ 验证通过: "' + name + '" (位置:' + position + ')');
      return true;
    }

    // 按名称长度降序排列（优先匹配较长的名称，避免短名称误匹配）
    var sortedStocks = stockMapping.slice().sort(function(a, b) {
      return b.screenshotName.length - a.screenshotName.length;
    });

    // 存储所有候选结果（通过验证的）
    var candidates = [];

    // ===== 策略1：精确匹配（严格验证）=====
    console.log('\n[SV-React] 📋 策略1: 精确匹配（严格验证）');
    
    for (var si = 0; si < sortedStocks.length; si++) {
      var stock = sortedStocks[si];
      var stockName = stock.screenshotName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');  // 清理空格
      
      if (!stockName || stockName.length < 2) continue;

      // 在清洗后的OCR文本中查找
      var position = cleanText.indexOf(stockName);
      
      if (position >= 0 && isValidStockName(stockName, position)) {
        console.log('[SV-React] ✅✅✅ 通过精确匹配+严格验证找到:', 
          '"' + stockName + '"', 
          '(位置:', position, ', 长度:', stockName.length, ')',
          '- 匹配到:', stock.name,
          '- 代码:', stock.code || '(未设置)'
        );

        candidates.push({
          detectedName: stock.screenshotName,
          matchedStock: stock,
          matchMethod: 'EXACT_MATCH',
          position: position,
          confidence: 1.0,
          nameLength: stockName.length
        });
        
        break;  // 找到一个就停止（最长且最先出现的）
      }
    }

    // 如果精确匹配成功，返回最佳候选
    if (candidates.length > 0) {
      // 选择位置最靠前且最长的
      candidates.sort(function(a, b) {
        if (a.position !== b.position) return a.position - b.position;  // 位置越靠前越好
        return b.nameLength - a.nameLength;  // 同位置时越长越好
      });
      
      var bestCandidate = candidates[0];
      console.log('[SV-React] 🎯 最终选择:', '"' + bestCandidate.detectedName + '"');
      return bestCandidate;
    }

    // ===== 策略2：宽松匹配（仅用于长名称，>4个字符）=====
    console.log('\n[SV-React] 📋 策略2: 宽松匹配（仅限长名称）');
    
    var longStocks = sortedStocks.filter(function(s) {
      var name = s.screenshotName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
      return name.length >= 4;  // 只考虑4字符以上的名称
    });

    for (var li = 0; li < longStocks.length; li++) {
      var longStock = longStocks[li];
      var longName = longStock.screenshotName.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
      
      var loosePosition = cleanText.indexOf(longName);
      
      if (loosePosition >= 20) {  // 排除表头区域
        // 宽松验证（只检查基本条件）
        var hasChineseLoose = /[\u4e00-\u9fa5]/.test(longName);
        var notPureNumber = !/^[\d,.]+$/.test(longName);
        var notTimestamp = !/^\d+[:\/]/.test(longName);
        
        if (hasChineseLoose && notPureNumber && notTimestamp) {
          console.log('[SV-React] 🔍 宽松匹配找到:', 
            '"' + longName + '"',
            '(位置:', loosePosition, ', 长度:', longName.length, ')'
          );
          
          return {
            detectedName: longStock.screenshotName,
            matchedStock: longStock,
            matchMethod: 'LOOSE_MATCH',
            position: loosePosition,
            confidence: 0.85,
            nameLength: longName.length
          };
        }
      }
    }

    console.log('[SV-React] ❌ 未检测到任何有效的股票名称');
    console.log('[SV-React] 💡 提示: 可能原因：');
    console.log('   1. OCR文本中不包含已知的股票名称');
    console.log('   2. 股票名称维护不完整（请检查 stockData.js 的 screenshotName）');
    console.log('   3. OCR识别误差过大导致无法匹配');
    
    return null;
  }

  // ===== Schema 定义 =====
  var TRADE_SCHEMA = {
    name: "光大证券金阳光",
    templateId: "EVERBRIGHT_TRADING",
    linesPerRecord: 2,
    fields: [
      { name: "名称", type: "X", line: 0, position: 0, required: true },
      { name: "股号", type: "X", line: 1, position: 0, required: true },
      { name: "价格", type: "N", line: 0, position: 1, hint: "price", required: true },
      { name: "数量", type: "N", line: 1, position: 1, hint: "qty", required: true },
      { name: "方向", type: "X", line: 0, position: 2, enumValues: ["买入","卖出"], required: true },
      { name: "成交额", type: "N", line: 1, position: 2, hint: "amount", required: true }
    ]
  };

  // ✨ 新增：股票清单模板 Schema
  var STOCK_LIST_SCHEMA = {
    name: "股票清单",
    templateId: "STOCK_INVENTORY",
    linesPerRecord: 1,
    fields: [
      { name: "股票代码", type: "X", line: 0, position: 0, required: true },
      { name: "股票名称", type: "X", line: 0, position: 1, required: true },
      { name: "截图用名称", type: "X", line: 0, position: 2, required: false },
      { name: "单位", type: "X", line: 0, position: 3, required: true },
      { name: "市场", type: "X", line: 0, position: 4, required: true, enumValues: ["台股","陆股","美股"] },
      { name: "类型", type: "X", line: 0, position: 5, required: true, enumValues: ["tA","cA","tETF","cETF"] },
      { name: "买入数量", type: "N", line: 0, position: 6, required: true },
      { name: "卖出数量", type: "N", line: 0, position: 7, required: false },
      { name: "结余数量", type: "N", line: 0, position: 8, required: true }
    ]
  };

  // ✨ 新增：原始文本默认模板（用于未规范数据）
  var RAW_TEXT_SCHEMA = {
    name: "原始文本",
    templateId: "RAW_TEXT",
    isDefaultTemplate: true,
    fields: []
  };

  // ✨ 多模板注册表
  var TEMPLATE_REGISTRY = [TRADE_SCHEMA, STOCK_LIST_SCHEMA, RAW_TEXT_SCHEMA];

  var MAX_IMAGES = 3;

  // ===== 子组件：表格网格展示 =====
  function TableGridDisplay({ grid, onCopyJson, onViewJson }) {
    if (!grid || !grid.cells || !grid.cells.length) return null;

    var rows = grid.rows;
    var cols = grid.cols;
    var cells = grid.cells;

    return createElement('div', {
      style: { padding: '12px' }
    },
      createElement('div', {
        style: {
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }
      },
        createElement('span', {
          style: { fontSize: '15px', fontWeight: 700, color: '#2d3748' }
        }, '📊 表格识别结果'),
        createElement('div', {
          style: { display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }
        },
          createElement('span', {
            style: {
              background: '#ede9fe',
              color: '#6d28d9',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600
            }
          }, rows + '行×' + cols + '列'),
          createElement('button', {
            onClick: onCopyJson,
            style: {
              padding: '5px 12px',
              background: '#6d28d9',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }
          }, '📋 复制JSON'),
          createElement('button', {
            onClick: onViewJson,
            style: {
              padding: '5px 12px',
              background: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600
            }
          }, '👁️ 查看JSON')
        )
      ),
      createElement('div', {
        style: {
          overflow: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          background: 'white',
          maxHeight: '400px'
        }
      },
        createElement('table', {
          style: {
            width: 'auto',
            minWidth: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            tableLayout: 'auto'
          }
        },
          createElement('tbody', null,
            cells.map(function(rowCells, r) {
              var rowBg = r === 0
                ? 'linear-gradient(135deg,#667eea,#764ba2)'
                : (r % 2 === 0 ? '#ffffff' : '#f8fafc');
              var textColor = r === 0 ? 'white' : '#1a202c';
              var fontWeight = r === 0 ? '700' : '400';
              var fontSize = r === 0 ? '13px' : '12px';

              return createElement('tr', {
                key: r,
                style: { background: rowBg }
              },
                rowCells.map(function(cellContent, c) {
                  return createElement('td', {
                    key: c,
                    style: {
                      padding: '6px 10px',
                      borderBottom: '1px solid #edf2f2',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      maxWidth: cols > 8 ? '120px' : '160px',
                      color: textColor,
                      fontWeight: fontWeight,
                      fontSize: fontSize
                    }
                  }, cellContent || '');
                })
              );
            })
          )
        )
      )
    );
  }

  // ===== 子组件：工具栏 =====
  function Toolbar({ images, onAdd, onParse, onTableExtract, onClearAll, onUpdateImage, geminiApiKey, onGeminiKeyChange, aiProvider, onAiProviderChange, tablePrompt, onTablePromptChange }) {
    var count = images.length;
    var hasPending = images.some(function(img) { return !img.ocrDone; });

    return createElement('div', {
      style: {
        padding: '12px 16px',
        background: 'linear-gradient(135deg,#667eea,#764ba2)',
        color: 'white',
        flexShrink: 0
      }
    },
      createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '8px',
          flexWrap: 'wrap'
        }
      },
        createElement('h2', {
          style: { margin: 0, fontSize: '17px', fontWeight: 700, flex: 1, minWidth: '150px' }
        }, '\uD83D\uDCF8 截图对账 ', createElement('span', { style: { fontSize: '12px', opacity: 0.8 } }, '(Pure React版)')),

        count > 0 && createElement('span', {
          style: {
            fontSize: '11px',
            background: 'rgba(255,255,255,0.2)',
            padding: '3px 10px',
            borderRadius: '12px'
          }
        }, count + '/' + MAX_IMAGES),

        createElement('label', {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            padding: '6px 14px',
            background: 'rgba(255,255,255,0.22)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            color: 'white'
          }
        },
          '\uD83D\uDCC1 +添加',
          createElement('input', {
            type: 'file',
            accept: '.png,.jpg,.jpeg,.bmp,.webp',
            multiple: true,
            style: { display: 'none' },
            onChange: function(e) {
              var files = e.target.files;
              if (!files || !files.length) return;
              for (var i = 0; i < files.length; i++) {
                onAdd(files[i]);
              }
              e.target.value = '';
            }
          })
        ),

        hasPending && createElement('button', {
          onClick: onParse,
          style: {
            padding: '6px 14px',
            background: 'rgba(34,197,94,0.7)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            color: 'white'
          }
        }, '\uD83D\uDD0D 解析'),

        hasPending && createElement('button', {
          onClick: onTableExtract,
          title: '提取表格格子内容，输出JSON网格',
          style: {
            padding: '6px 12px',
            background: 'rgba(168,85,247,0.7)',
            border: '1.5px solid rgba(255,255,255,0.4)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 700,
            color: 'white'
          }
        }, '\uD83D\uDCCA 表格提取'),

        count > 0 && createElement('button', {
          onClick: onClearAll,
          style: {
            padding: '6px 12px',
            background: 'rgba(239,68,68,0.6)',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            color: 'white'
          }
        }, '\uD83D\uDDD1 全清')
      ),

      // Gemini API Key 配置行（有图片时显示）
      count > 0 && createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginTop: '6px',
          padding: '6px 10px',
          background: 'rgba(0,0,0,0.15)',
          borderRadius: '6px',
          flexWrap: 'wrap'
        }
      },
        createElement('span', {
          style: { fontSize: '10px', color: 'rgba(255,255,255,0.7)', whiteSpace: 'nowrap', fontWeight: 600 }
        }, geminiApiKey ? '\u2705 AI引擎' : '\uD83E\uDDE0 AI引擎'),

        createElement('select', {
          value: aiProvider || 'zhipu',
          onChange: function(e) { if (onAiProviderChange) onAiProviderChange(e.target.value); },
          style: {
            padding: '2px 6px',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            fontSize: '11px',
            outline: 'none',
            cursor: 'pointer'
          }
        },
          createElement('option', { value: 'zhipu' }, '\uD83E\uDD16 智谱GLM (免费)'),
          createElement('option', { value: 'qwen' }, '\uD83C\uDF34 通义千问')
        ),

        createElement('input', {
          type: 'password',
          value: geminiApiKey,
          placeholder: aiProvider === 'qwen' ? '阿里云 API Key' : '智谱 API Key (可选)',
          onChange: function(e) {
            if (onGeminiKeyChange) onGeminiKeyChange(e.target.value);
            try { localStorage.setItem('sv_ai_api_key', e.target.value); } catch(ex){}
          },
          style: {
            flex: 1,
            padding: '3px 8px',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.12)',
            color: 'white',
            fontSize: '11px',
            outline: 'none',
            minWidth: '120px'
          }
        }),

        geminiApiKey ? createElement('span', {
          style: { fontSize: '9px', color: '#86efac', whiteSpace: 'nowrap' }
        }, '\u2705 已配置') : createElement('a', {
          href: aiProvider === 'qwen' ? 'https://bailian.console.aliyun.com/' : 'https://open.bigmodel.cn/usercenter/apikeys',
          target: '_blank',
          style: { fontSize: '9px', color: '#93c5fd', textDecoration: 'underline', whiteSpace: 'nowrap' }
        }, '\u514D\u8D39\u83B7\u53D6')
      ),

      // 自定义排版要求（有图片时显示）
      count > 0 && createElement('div', {
        style: {
          marginTop: '6px',
          padding: '6px 10px',
          background: 'rgba(99,102,241,0.12)',
          borderRadius: '6px',
          border: '1px solid rgba(99,102,241,0.25)'
        }
      },
        createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' }
        },
          createElement('span', {
            style: { fontSize: '10px', color: '#a5b4fc', fontWeight: 600, whiteSpace: 'nowrap' }
          }, '\uD83D\uDCDD 排版要求'),
          createElement('span', {
            style: { fontSize: '9px', color: 'rgba(165,180,252,0.7)' }
          }, '(可选，告诉AI如何处理数据)')
        ),
        createElement('textarea', {
          value: tablePrompt || '',
          placeholder: '例如：\n- 数字保留2位小数\n- 日期格式统一为 YYYY-MM-DD\n- 空值用 - 表示\n- 去掉所有空格',
          onChange: function(e) {
            var val = e.target.value;
            if (onTablePromptChange) onTablePromptChange(val);
            try { localStorage.setItem('sv_table_prompt', val); } catch(ex){}
          },
          rows: 2,
          style: {
            width: '100%',
            padding: '5px 8px',
            border: '1px solid rgba(99,102,241,0.3)',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.08)',
            color: '#e0e7ff',
            fontSize: '11px',
            resize: 'vertical',
            outline: 'none',
            fontFamily: 'inherit',
            lineHeight: '1.4'
          }
        })
      ),

      // 缩略图行
      createElement(ThumbRow, { images: images, onUpdateImage: onUpdateImage })
    );
  }

  // ===== 子组件：缩略图行 =====
  function ThumbRow({ images, onUpdateImage }) {
    if (!images.length) return null;

    return createElement('div', {
      style: {
        display: 'flex',
        gap: '8px',
        overflowX: 'auto',
        paddingBottom: '4px'
      }
    }, images.map(function(img, i) {
      var color = img.ocrDone ? '#10b981' : '#f59e0b';
      var icon = img.ocrDone ? '\u2705' : '\u23F3';

      return createElement('div', {
        key: img.index,
        style: {
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
          background: 'rgba(0,0,0,0.12)',
          borderRadius: '8px',
          padding: '6px',
          minWidth: '130px',
          flexShrink: 0
        }
      },
        // 缩略图区域
        createElement('div', {
          style: {
            position: 'relative',
            width: '60px',
            height: '50px',
            borderRadius: '5px',
            overflow: 'hidden',
            border: '2px solid ' + color
          }
        },
          createElement('img', {
            src: img.data,
            alt: img.name,
            style: { width: '100%', height: '100%', objectFit: 'cover' }
          }),
          createElement('span', {
            style: {
              position: 'absolute',
              top: '1px',
              right: '1px',
              background: 'rgba(0,0,0,0.6)',
              color: 'white',
              fontSize: '9px',
              padding: '1px 3px',
              borderRadius: '2px'
            }
          }, icon)
        ),

        // 预处理设置区域
        createElement('div', {
          style: {
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
            width: '100%'
          }
        },
          // 搜索位置选择
          createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: '2px' }
          },
            createElement('label', {
              style: { fontSize: '8px', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', fontWeight: 500, minWidth: '24px' }
            }, '\uD83D\uDCCD'),
            createElement('select', {
              value: img.searchPosition || 'topLeft',
              onChange: function(e) {
                if (onUpdateImage) onUpdateImage(img.index, 'searchPosition', e.target.value);
              },
              style: {
                flex: 1,
                padding: '1px 3px',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '3px',
                background: 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '8px',
                cursor: 'pointer'
              }
            },
              createElement('option', { value: 'topLeft' }, '左上角'),
              createElement('option', { value: 'bottomRight' }, '右下角')
            )
          ),

          // 关键字输入
          createElement('div', {
            style: { display: 'flex', alignItems: 'center', gap: '2px' }
          },
            createElement('label', {
              style: { fontSize: '8px', color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', fontWeight: 500, minWidth: '24px' }
            }, '\uD83D\uDD11'),
            createElement('input', {
              type: 'text',
              maxLength: 20,
              value: img.keyword || '',
              onChange: function(e) {
                if (onUpdateImage) onUpdateImage(img.index, 'keyword', e.target.value);
              },
              placeholder: img._autoDetectedKeyword ? '✨ 自动识别' : '关键字',
              style: {
                flex: 1,
                padding: '1px 3px',
                border: '1px solid ' + (img._autoDetectedKeyword ? '#fbbf24' : 'rgba(255,255,255,0.25)'),
                borderRadius: '3px',
                background: img._autoDetectedKeyword ? 'rgba(251, 191, 36, 0.15)' : 'rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '8px',
                minWidth: '55px',
                fontWeight: img._autoDetectedKeyword ? 600 : 400
              },
              title: img._autoDetectedKeyword 
                ? '✨ 此关键字由系统自动从OCR文本中识别得出，可手动修改' 
                : '从此关键字开始解析，之前的内容将被清洗掉'
            }),
            // ✅ 显示自动检测标记
            img._autoDetectedKeyword ? createElement('span', {
              style: {
                fontSize: '10px',
                marginLeft: '2px',
                color: '#fbbf24',
                cursor: 'help',
                title: '自动识别的关键字（基于 stockData.js 中的 screenshotName）'
              }
            }, '✨') : null
          )
        ),
        
        // ✨ 新增：模板识别结果显示
        img.templateName ? createElement('div', {
          style: {
            width: '100%',
            padding: '3px 6px',
            background: img.isTemplateMatch 
              ? 'rgba(16, 185, 129, 0.2)'   // ✅ 匹配 - 绿色背景
              : (img.templateName.indexOf('部分匹配') >= 0 
                ? 'rgba(251, 191, 36, 0.2)'  // ⚠️ 部分匹配 - 黄色背景
                : 'rgba(239, 68, 68, 0.2)'),  // ❌ 不匹配 - 红色背景
            borderRadius: '3px',
            border: '1px solid ' + (
              img.isTemplateMatch 
                ? '#10b981'   // 绿色边框
                : (img.templateName.indexOf('部分匹配') >= 0 
                  ? '#fbbf24'  // 黄色边框
                  : '#ef4444') // 红色边框
            ),
            fontSize: '8px',
            fontWeight: 600,
            color: img.isTemplateMatch 
              ? '#065f46'    // 深绿色文字
              : (img.templateName.indexOf('部分匹配') >= 0 
                ? '#92400e'   // 深黄色文字
                : '#991b1b'), // 深红色文字
            textAlign: 'center',
            cursor: 'help',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginTop: '2px'
          },
          title: img.isTemplateMatch 
            ? '✅ 符合 "光大证券金阳光" 模板\n成功解析出完整的6个字段数据'
            : (img.templateName.indexOf('部分匹配') >= 0 
              ? '⚠️ 部分匹配 "光大证券金阳光" 模板\n解析出 ' + (img.templateMatchDetails && img.templateMatchDetails.totalFields || 0) + '/6 个字段\n缺失: ' + (img.templateMatchDetails && img.templateMatchDetails.missingFields ? img.templateMatchDetails.missingFields.join(', ') : '')
              : '❌ 未被规范的数据\n无法完整解析出6个字段\n请检查截图格式或手动调整')
        }, 
          (img.isTemplateMatch ? '✅ ' : (img.templateName.indexOf('部分匹配') >= 0 ? '⚠️ ' : '❌ ')) +
          img.templateName
        ) : null
      );
    }));
  }

  // ===== 子组件：状态消息 =====
  function StatusMessage({ status }) {
    if (!status.message) return null;

    return createElement('div', {
      style: {
        padding: '6px 16px',
        fontWeight: 600,
        fontSize: '12px',
        background: status.isOk ? '#d1fae5' : '#fee2e2',
        color: status.isOk ? '#065f46' : '#991b1b',
        flexShrink: 0
      }
    }, status.message);
  }

  // ===== 子组件：空状态提示 =====
  function EmptyHint() {
    return createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        minHeight: '200px',
        color: '#a0aec0',
        fontSize: '14px'
      }
    }, '\uD83D\uDC46 请先选择截图文件，然后点击「解析」按钮（最多' + MAX_IMAGES + '张）');
  }

  // ===== 子组件：页签栏 =====
  function TabBar({ activeTab, onTabChange, tabs }) {
    return createElement('div', {
      style: {
        display: 'flex',
        gap: '2px',
        padding: '8px 16px',
        background: '#f3f4f6',
        borderBottom: '2px solid #e5e7eb',
        flexShrink: 0
      }
    }, tabs.map(function(tab, index) {
      var isActive = activeTab === index;
      var hasContent = tab.hasContent;

      return createElement('button', {
        key: index,
        onClick: function() { if (hasContent) onTabChange(index); },
        style: {
          flex: 1,
          padding: '8px 12px',
          border: 'none',
          borderRadius: '6px 6px 0 0',
          cursor: hasContent ? 'pointer' : 'not-allowed',
          fontSize: '12px',
          fontWeight: isActive ? 700 : 500,
          color: isActive ? (tab.activeColor || '#1f2937') : (hasContent ? '#6b7280' : '#d1d5db'),
          background: isActive ? (tab.activeBg || '#ffffff') : (hasContent ? '#e5e7eb' : '#f9fafb'),
          borderBottom: isActive ? '3px solid ' + (tab.borderColor || '#667eea') : '3px solid transparent',
          transition: 'all 0.2s',
          opacity: hasContent ? 1 : 0.6,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px'
        }
      }, tab.icon, tab.label, !hasContent ? createElement('span', {
        style: { fontSize: '9px', fontStyle: 'italic', marginLeft: '2px' }
      }, '(待解析)') : null);
    }));
  }

  // ===== 子组件：截图文件预览面板 =====
  function ImagePreviewPanel({ images }) {
    if (!images || images.length === 0) {
      return createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '200px',
          color: '#a0aec0',
          fontSize: '14px'
        }
      }, '\uD83D\uDC46 请先添加截图文件（最多' + MAX_IMAGES + '张）');
    }

    var imageCards = images.map(function(img, i) {
      return createElement('div', {
        key: img.index,
        style: {
          background: 'white',
          borderRadius: '10px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          overflow: 'hidden',
          marginBottom: '16px'
        }
      },
        createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px',
            background: 'linear-gradient(135deg,#667eea,#764ba2)',
            color: 'white'
          }
        },
          createElement('span', {
            style: {
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: '13px'
            }
          }, i + 1),
          createElement('div', { style: { flex: 1 } },
            createElement('div', {
              style: { fontWeight: 600, fontSize: '13px', marginBottom: '2px' }
            }, escapeHtml(img.name)),
            createElement('div', {
              style: { fontSize: '11px', opacity: 0.9 }
            }, img.ocrDone ? '\u2705 已完成OCR识别' : '\u23F3 等待识别...')
          ),
          img.ocrDone ? createElement('span', {
            style: {
              background: 'rgba(255,255,255,0.25)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px',
              fontWeight: 600
            }
          }, '\u2705 完成') : createElement('span', {
            style: {
              background: 'rgba(255,255,255,0.15)',
              padding: '4px 10px',
              borderRadius: '12px',
              fontSize: '11px'
            }
          }, '\u23F3 待处理')
        ),
        createElement('div', {
          style: {
            padding: '12px',
            textAlign: 'center',
            background: '#f8fafc'
          }
        },
          createElement('img', {
            src: img.data,
            alt: img.name,
            style: {
              maxWidth: '100%',
              maxHeight: '400px',
              objectFit: 'contain',
              borderRadius: '6px',
              border: '2px solid #e5e7eb'
            }
          })
        )
      );
    });

    return createElement('div', null,
      createElement('div', {
        style: {
          marginBottom: '16px',
          fontSize: '14px',
          fontWeight: 600,
          color: '#374151',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }
      }, '\uD83D\uDDBC 截图文件列表', createElement('span', {
        style: {
          background: '#ede9fe',
          color: '#6d28d9',
          padding: '2px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600
        }
      }, '共 ' + images.length + ' 张')),
      imageCards
    );
  }

  // ===== 子组件：中间结果展示面板 =====
  function IntermediateResultPanel({ result, onContinue }) {
    try {
      if (!result) return null;

      var isOcrResult = result.type === 'ocr';
      var isCleanedResult = result.type === 'cleaned';
      var isParsedResult = result.type === 'parsed';

    var panelTitle, panelBg, borderColor, titleColor, nextStepText;

    if (isOcrResult) {
      panelTitle = '\uD83D\uDCDD OCR 识别结果 - 截图 ' + (result.imageIndex + 1);
      panelBg = '#fef3c7';
      borderColor = '#f59e0b';
      titleColor = '#92400e';
      nextStepText = '继续执行文本预处理';
    } else if (isCleanedResult) {
      panelTitle = '\uD83D\uDCDC 文本预处理结果 - 截图 ' + (result.imageIndex + 1);
      panelBg = '#dbeafe';
      borderColor = '#3b82f6';
      titleColor = '#1e40af';
      nextStepText = '继续执行结构化解析';
    } else {
      panelTitle = '\uD83D\uDCCA 解析结果 - 截图 ' + (result.imageIndex + 1);
      panelBg = '#d1fae5';
      borderColor = '#10b981';
      titleColor = '#065f46';
      nextStepText = '查看最终表格';
    }

    var content;

    if (isOcrResult) {
      content = createElement('div', null,
        createElement('div', {
          style: {
            marginBottom: '12px',
            fontSize: '13px',
            color: '#4b5563'
          }
        }, '\uD83D\uDDBC 图片名称: ', createElement('strong', null, result.imageName)),
        createElement('div', {
          style: {
            marginBottom: '8px',
            fontSize: '12px',
            color: '#6b7280'
          }
        }, '\u23F0 识别时间: ', result.timestamp),
        createElement('div', {
          style: {
            marginBottom: '8px',
            padding: '8px 12px',
            background: '#eff6ff',
            borderLeft: '3px solid #3b82f6',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#1e40af',
            fontFamily: 'monospace',
            lineHeight: '1.6'
          }
        }, 
          '\uD83D\uDCDA 执行代码:\n' +
          '  \u25B6 主程序: screenshotVerifyPluginReact.js (processOneImage函数)\n' +
          '  \u25B6 子模块1: ocrEngine.js (OcrEngine.recognize - Tesseract.js OCR识别)\n' +
          '  \u25B6 参数: PSM=6(均匀块), OEM=1(LSTM神经网络), 语言=chi_sim+eng'
        ),
        createElement('div', {
          style: {
            marginBottom: '8px',
            fontSize: '12px',
            fontWeight: 600,
            color: titleColor
          }
        }, '\u{1F4DD} 原始文本 (共 ' + result.text.length + ' 字):'),
        createElement('pre', {
          style: {
            background: '#ffffff',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '11px',
            fontFamily: 'monospace',
            lineHeight: '1.6',
            maxHeight: '300px',
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
            color: '#1f2937'
          }
        }, result.text || '(空文本)')
      );
    } else if (isCleanedResult) {
      // 显示关键字过滤信息
      var keywordInfo = null;
      if (result.keyword) {
        var normalizedKeywordDisplay = result.keyword.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
        var isSmartMatch = result.keyword !== normalizedKeywordDisplay || /[\s]/.test(result.keyword);

        keywordInfo = createElement('div', {
          style: {
            marginBottom: '12px',
            padding: '12px 16px',
            background: '#ecfdf5',
            border: '2px solid #10b981',
            borderRadius: '8px',
            fontSize: '12px'
          }
        },
          createElement('div', { style: { fontWeight: 700, color: '#065f46', marginBottom: '8px', fontSize: '14px' } },
            '✅ 关键字过滤已应用', 
            isSmartMatch ? createElement('span', { 
              style: { 
                marginLeft: '8px', 
                background: '#3b82f6', 
                color: 'white', 
                padding: '2px 8px', 
                borderRadius: '4px', 
                fontSize: '11px',
                fontWeight: 600
              } }, '🧠 智能匹配') : null
          ),
          createElement('div', { style: { color: '#047857', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '12px' } },
            createElement('div', null,
              '🔑 输入关键字: ', createElement('strong', null, '"', result.keyword, '"')
            ),
            createElement('div', null,
              '🔍 标准化后: ', createElement('strong', { color: '#2563eb' }, '"', normalizedKeywordDisplay, '"'),
              isSmartMatch ? createElement('span', { 
                style: { 
                  fontSize: '10px', 
                  color: '#6b7280',
                  fontStyle: 'italic',
                  marginLeft: '4px'
                } }, '(自动忽略空格)') : null
            )
          ),
          createElement('div', { style: { color: '#047857', marginBottom: '4px' } },
            '📍 搜索位置: ', createElement('strong', null, result.searchPosition === 'topLeft' ? '左上角（从前往后）' : '右下角（从后往前）')
          ),
          createElement('div', {
            style: {
              padding: '8px 10px',
              background: '#f0fdf4',
              borderRadius: '6px',
              marginTop: '6px',
              fontSize: '11px',
              color: '#166534'
            }
          },
            '📊 文本统计:',
            createElement('br', null),
            '   原始长度: ', (result.originalText || '').length, ' 字符 → ',
            createElement('br', null),
            '   过滤后长度: ', (result.processedText || '').length, ' 字符',
            createElement('br', null),
            '   ✂️ 清洗掉 ', ((result.originalText || '').length - (result.processedText || '').length), ' 字符无用信息'
          ),
          isSmartMatch ? createElement('div', {
            style: {
              padding: '8px 10px',
              background: '#eff6ff',
              borderRadius: '6px',
              marginTop: '6px',
              fontSize: '11px',
              color: '#1e40af'
            }
          },
            '💡 提示: 系统已自动忽略OCR识别产生的空格，确保能正确匹配中文关键字'
          ) : null
        );
      } else {
        keywordInfo = createElement('div', {
          style: {
            marginBottom: '12px',
            padding: '10px 14px',
            background: '#fef3c7',
            border: '2px solid #f59e0b',
            borderRadius: '8px',
            fontSize: '12px'
          }
        },
          createElement('div', { style: { fontWeight: 700, color: '#92400e', marginBottom: '6px' } },
            '⚠️ 未设置关键字（使用全部原始文本）'
          ),
         createElement('div', { style: { color: '#b45309', fontSize: '11px' } },
            '💡 提示：在每个截图下方设置"关键字"，可自动清洗掉表头等无用信息')
        );
      }

      // ✅ 关键修复：判断当前数据模式（支持3种模板）
      var isRawTextMode = result.extractedRecords && 
                          result.extractedRecords.length > 0 && 
                          result.extractedRecords[0].isRawText;
      
      var isStockListMode = result.extractedRecords && 
                            result.extractedRecords.length > 0 && 
                            result.extractedRecords[0].isStockList;
      
      // 判断是否为结构化数据（TRADE或STOCK_LIST）
      var isStructuredDataMode = !isRawTextMode;  // TRADE或STOCK_LIST都是结构化数据
      
      // ✅ 恢复逐行展示 + 在每行后显示字段提取结果
      var cleanedRows = (result.cleanedLines || []).map(function(lineData, i) {
        var tokensDisplay = (lineData.tokens || []).map(function(t, ti) {
          // ✅ 关键修复：根据模式进行不同的Token着色
          var isNamePart = !isRawTextMode && lineData.nameExtracted && lineData.nameExtracted.indexOf(t) >= 0;
          var isNumber = /^[\d,.]+$/.test(t);
          
          // ✅ STOCK_LIST模式：特殊识别类型和市场枚举值
          var isStockTypeEnum = isStockListMode && /tETF|tA|cA|cETF/.test(t);
          var isMarketEnum = isStockListMode && /台股|陆股|美股|港股/.test(t);
          return createElement('span', {
            key: ti,
            style: {
              display: 'inline-block',
              padding: '2px 6px',
              margin: '2px',
              borderRadius: '4px',
              // ✅ 根据模式和Token类型设置不同的颜色
              background: isNamePart ? '#fef3c7' : 
                         (isStockTypeEnum ? '#dbeafe' : 
                         (isMarketEnum ? '#fef3c7' : 
                         (isNumber ? '#fee2e2' : '#f3f4f6'))),
              color: isNamePart ? '#92400e' : 
                    (isStockTypeEnum ? '#1e40af' : 
                    (isMarketEnum ? '#92400e' : 
                    (isNumber ? '#991b1b' : '#374151'))),
              fontSize: '11px',
              fontFamily: 'monospace',
              fontWeight: isNamePart || isStockTypeEnum || isMarketEnum ? 600 : 400
            }
          }, t);
        });

        // 查找该行属于哪个记录，并获取从该行提取的字段
        var lineFields = null;
        var belongingRecord = null;
        if (result.extractedRecords) {
          for (var ri = 0; ri < result.extractedRecords.length; ri++) {
            var rec = result.extractedRecords[ri];
            if (rec.lineNumbers && rec.lineNumbers.indexOf(i + 1) >= 0) {
              belongingRecord = rec;
              
              // ✅ 修复：正确计算该行在记录中的位置（line 0 或 line 1）
              // lineNumbers 是从1开始的实际行号，需要转换为0-based的相对位置
              var positionInLineNumbers = rec.lineNumbers.indexOf(i + 1);
              var lineInRecord = positionInLineNumbers;  // 0 = 第一行, 1 = 第二行
              
              console.log('[SV-React] 行号调试: 第', (i+1), '行属于 记录#', (rec.recordIndex+1), 
                ', lineNumbers=', rec.lineNumbers,
                ', positionInLineNumbers=', positionInLineNumbers,
                ', lineInRecord=', lineInRecord);
              
              // ✅ 关键修复：RAW_TEXT模式不提取任何字段
              if (rec.isRawText) {
                console.log('[SV-React] ⚠️ RAW_TEXT模式 - 跳过字段提取');
                belongingRecord = rec;
                lineFields = null;  // 不显示任何字段
                break;  // 直接跳出循环
              }
              
              // ✅ 关键修复：根据模板类型动态选择字段Schema
              var currentFieldSchema = rec.isStockList ? STOCK_LIST_SCHEMA : TRADE_SCHEMA;
              
              // 提取该行对应的字段（支持TRADE和STOCK_LIST两种模式）
              lineFields = {};
              currentFieldSchema.fields.forEach(function(fieldDef) {
                if (fieldDef.line === lineInRecord) {
                  lineFields[fieldDef.name] = rec.fields[fieldDef.name];
                  console.log('  → 提取字段 (', currentFieldSchema.templateId, '):', fieldDef.name, '=', rec.fields[fieldDef.name]);
                }
              });
              
              if (Object.keys(lineFields).length > 0) {
                break;  // 找到字段就停止
              }
            }
          }
        }

        // 构建字段提取结果展示（支持3种模板的不同样式）
        var fieldsDisplay = null;
        if (lineFields && Object.keys(lineFields).length > 0) {
          fieldsDisplay = createElement('div', {
            style: {
              marginTop: '8px',
              paddingTop: '8px',
              borderTop: '2px solid ' + (isStockListMode ? '#8b5cf6' : '#22c55e'),
              padding: '8px 10px',
              background: isStockListMode ? '#f5f3ff' : '#f0fdf4',
              borderRadius: '6px'
            }
          },
            createElement('div', {
              style: { 
                fontSize: '11px', 
                fontWeight: 700, 
                color: isStockListMode ? '#5b21b6' : '#166534',
                marginBottom: '6px'
              }
            }, '\u2705 \u4ECE\u6B42\u884C\u63D0\u53D6\u7684\u5B57\u6BB5\u503C' + 
              (belongingRecord ? ' (\u8BB0\u5F55 #' + (belongingRecord.recordIndex + 1) + ')' : '')),
            createElement('div', {
              style: {
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px'
              }
            },
              Object.keys(lineFields).map(function(fieldName) {
                var fieldValue = lineFields[fieldName];
                var isNumber = typeof fieldValue === 'number';
                var isDirection = fieldName === '\u65B9\u5411';
                var isNameField = fieldName === '\u540D\u79F0';  // "名称"字段
                
                // ✅ 检查是否有名称矫正信息
                var correctionInfo = null;
                if (isNameField && belongingRecord && belongingRecord.fields && belongingRecord.fields['_nameCorrection']) {
                  correctionInfo = belongingRecord.fields['_nameCorrection'];
                }
                
                // ✅ 关键优化：只在真正需要矫正时才显示特殊样式
                var actuallyCorrected = correctionInfo && correctionInfo.isCorrected;

                return createElement('div', {
                  key: fieldName,
                  style: {
                    padding: '4px 8px',
                    background: isDirection ? (fieldValue === '\u4E70\u5165' ? '#dcfce7' : '#fee2e2') : 
                              (actuallyCorrected ? '#fef3c7' : '#e0f2fe'),  // 只在确实矫正时用黄色
                    borderRadius: '4px',
                    borderLeft: '3px solid ' + (
                      isDirection ? (fieldValue === '\u4E70\u5165' ? '#22c55e' : '#ef4444') : 
                      (actuallyCorrected ? '#f59e0b' : '#0ea5e9')  // 只在确实矫正时用橙色边框
                    ),
                    minWidth: actuallyCorrected ? '200px' : '120px'
                  }
                },
                  createElement('div', { style: { fontSize: '10px', color: '#6b7280', marginBottom: '2px' } }, 
                    fieldName + (actuallyCorrected ? ' ✨' : (correctionInfo ? ' ✓' : ''))
                  ),
                  
                  // ✅ 只在确实需要矫正时才显示对比信息
                  actuallyCorrected ?
                    createElement('div', null,
                      createElement('div', { 
                        style: { 
                          fontSize: '11px', 
                          color: '#991b1b',
                          textDecoration: 'line-through',
                          marginBottom: '2px'
                        }}, 
                        'OCR: ' + correctionInfo.originalName
                      ),
                      createElement('div', { 
                        style: { 
                          fontSize: '13px', 
                          fontWeight: 700, 
                          color: '#b45309'
                        }}, 
                        (correctionInfo.correctionMethod === 'CODE_EXACT' ? '🔢 ' : 
                         correctionInfo.correctionMethod === 'NAME_CONTAIN' ? '📝 ' : '🔍 ') +
                        correctionInfo.correctedName
                      ),
                      createElement('div', { 
                        style: { 
                          fontSize: '9px', 
                          color: '#059669',
                          marginTop: '2px'
                        }}, 
                        (correctionInfo.correctionMethod === 'CODE_EXACT' ? '✅ 代码精确匹配' :
                         correctionInfo.correctionMethod === 'NAME_CONTAIN' ? '✓ 名称包含匹配' :
                         '相似度: ' + (correctionInfo.matchScore * 100).toFixed(0) + '%')
                      )
                    )
                  :
                  // ✅ OCR已正确或无矫正信息：简洁显示
                  createElement('div', { 
                    style: { 
                      fontSize: '13px', 
                      fontWeight: 700, 
                      color: isDirection ? (fieldValue === '\u4E70\u5165' ? '#166534' : '#991b1b') : '#0369a1',
                      fontFamily: isNumber ? 'monospace' : 'inherit'
                    }}, 
                    isNumber ? fieldValue.toLocaleString(undefined, { minimumFractionDigits: fieldValue % 1 !== 0 ? 3 : 0 }) : fieldValue
                  )
                );
              })
            )
          );
        }

        return createElement('div', {
          key: i,
          style: {
            marginBottom: '14px',
            padding: '12px',
            background: 'white',
            borderRadius: '8px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
          }
        },
          // 行号标题
          createElement('div', {
            style: {
              marginBottom: '8px',
              fontSize: '11px',
              color: '#6b7280',
              fontWeight: 600,
              paddingBottom: '6px',
              borderBottom: '1px dashed #e5e7eb'
            }
          }, '\uD83D\uDCCB \u7B2C ' + (i + 1) + ' \u884C'),
          
          // 原始OCR文本
          createElement('div', {
            style: {
              marginBottom: '6px',
              fontSize: '11px',
              color: '#9ca3af',
              textDecoration: 'line-through'
            }
          }, '\uD83D\uDCDD \u539F\u59CB: ', createElement('code', null, escapeHtml(lineData.original))),
          
          // 清洗后的文本
          createElement('div', {
            style: {
              marginBottom: '6px',
              fontSize: '13px',
              color: '#111827',
              fontWeight: 600,
              fontFamily: 'monospace'
            }
          }, '\uD83D\uDDDC \u6E05\u6D17\u540E: ', createElement('code', null, lineData.cleaned)),
          
          // Token分解
          createElement('div', {
            style: {
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: '1px dashed #e5e7eb'
            }
          },
            createElement('div', {
              style: { fontSize: '10px', color: '#6b7280', marginBottom: '4px' }
            }, 
              '\uD83D\uDE80 Token \u5206\u89E3:', 
              // ✅ 关键修复：根据模式显示不同的处理说明
              (isRawTextMode) ? ' (\u6570\u636E\u7C7B\u578B\u8BC6\u522B)' : 
              (isStockListMode) ? ' (\u80A1\u7968\u6E05\u5355\u5B57\u6BB5\u8BC6\u522B)' :
              (!lineData.nameExtracted) ? ' (\u6570\u636E\u7C7B\u578B\u8BC6\u522B)' : ' (\u540D\u79F0\u63D0\u53D6\u8FC7\u7A0B)'
            ),
            createElement('div', {
              style: { display: 'flex', flexWrap: 'wrap', gap: '2px' }
            }, tokensDisplay),
            
            // 名称提取结果 - ✅ 关键修复：RAW_TEXT模式下完全隐藏
            (!isRawTextMode && lineData.nameExtracted) ? createElement('div', {
              style: { marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed #e5e7eb', fontSize: '11px', color: '#059669', fontWeight: 600 }
            }, '\u2705 \u63D0\u53D6\u540D\u79F0: "', lineData.nameExtracted, '"') : null
          ),
          
          // ✅ 新增：字段提取结果（因果关系的关键！）
          fieldsDisplay
        );
      });

      if (!cleanedRows.length) {
        cleanedRows = [createElement('div', {
          key: 'empty',
          style: { padding: '30px 20px', textAlign: 'center', color: '#9ca3af' }
        }, '\uD83D\uDDED \u6682\u65E0\u6570\u636E')];
      }

      content = createElement('div', null,
        keywordInfo,  // 关键字过滤信息
        
        // ✅ 执行代码信息（完整调用链展示）
        createElement('div', {
          style: {
            marginBottom: '8px',
            padding: '8px 12px',
            background: '#dbeafe',
            borderLeft: '3px solid #3b82f6',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#1e40af',
            fontFamily: 'monospace',
            lineHeight: '1.6'
          }
        }, 
          '\uD83D\uDCDA 执行代码:\n' +
          '  \u25B6 主程序: screenshotVerifyPluginReact.js (processOneImage函数)\n' +
          '  \u25B6 子模块1: ocrEngine.js (OCR原始文本)\n' +
          (isRawTextMode ? 
            '  \u25B6 处理模式: RAW_TEXT (原始文本模式 - 不进行字段拆解)\n' +
            '  \u25B6 功能1: 中文文本清洗 (移除OCR产生的中文字符间空白)\n' +
            '  \u25B6 功能2: 整体视为原始文本，保留完整内容'
            : isStockListMode ?
            '  \u25B6 处理模式: STOCK_LIST (股票清单模式 - 单行9字段结构)\n' +
            '  \u25B6 功能1: 智能字段提取 (STOCK_LIST_SCHEMA - 基于位置+特征识别)\n' +
            '  \u25B6 功能2: 枚举值验证 (市场/类型字段)\n' +
            '  \u25B6 功能3: 数量汇总计算'
            :
            '  \u25B6 子模块2: stockData.js (window.ALL_STOCKS - screenshotName数据)\n' +
            '  \u25B6 功能1: 文本预处理 (关键字过滤 + 智能匹配normalizeText)\n' +
            '  \u25B6 功能2: 智能字段提取 (TRADE_SCHEMA - 基于内容特征识别)\n' +
            '  \u25B6 功能3: correctStockName() (股票名称智能矫正 - 三级匹配策略)'
          )
        ),
        
        // 统计信息栏 - 根据模式显示不同内容（支持3种模板）
        (result.extractedRecords && result.extractedRecords.length > 0) ? createElement('div', {
          style: {
            marginTop: '12px',
            marginBottom: '12px',
            padding: '10px 14px',
            background: isRawTextMode ? '#fef3c7' : (isStockListMode ? '#ede9fe' : '#ecfdf5'),
            border: '2px solid ' + (isRawTextMode ? '#f59e0b' : (isStockListMode ? '#8b5cf6' : '#10b981')),
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }
        },
          createElement('div', { style: { fontWeight: 700, color: isRawTextMode ? '#92400e' : (isStockListMode ? '#5b21b6' : '#065f46'), fontSize: '13px' } },
            isRawTextMode ? 
              '📄 原始文本模式' :
              isStockListMode ?
              '📋 股票清单模式' :
              '✅ 共识别 ' + (result.totalRecords || result.extractedRecords.length || 0) + ' 笔交易记录'
          ),
          createElement('div', { style: { fontSize: '11px', color: isRawTextMode ? '#b45309' : (isStockListMode ? '#6d28d9' : '#047857') } },
            isRawTextMode ?
              '不进行字段拆解' :
              isStockListMode ?
              '9字段单行结构' :
              '字段: ' + (result.schemaFields || []).join(' · ') + ' ｜ 每笔 ' + (result.linesPerRecord || 2) + ' 行数据'
          )
        ) : null,

        // 文本预处理详情标题
        createElement('div', {
          style: {
            marginBottom: '12px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#4b5563'
          }
        }, 
          '\uD83D\uDDBC \u56FE\u7247\u540D\u79F0: ', createElement('strong', null, result.imageName),
          createElement('div', {
            style: { fontSize: '11px', color: '#6b7280', marginTop: '4px' }
          }, '\u23F0 处理时间: ', result.timestamp)
        ),
        
        // ✅ 核心内容：逐行展示（包含字段提取结果）
        createElement('div', {
          style: { maxHeight: '500px', overflow: 'auto', paddingRight: '8px' }
        }, cleanedRows)
      );

    } else if (isParsedResult) {
      var parsedRows = (result.data || []).map(function(r, i) {
        return createElement('tr', { key: i, style: { background: i % 2 === 0 ? '#ffffff' : '#f9fafb' } },
          createElement('td', { style: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px' } },
            escapeHtml(r['名称'] || '-')
          ),
          createElement('td', { style: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', fontFamily: 'monospace' } },
            escapeHtml(r['股号'] || '-')
          ),
          createElement('td', { style: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', textAlign: 'right', fontFamily: 'monospace' } },
            r['价格'] || '-'
          ),
          createElement('td', { style: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', textAlign: 'right', fontFamily: 'monospace' } },
            formatNumber(r['数量'])
          ),
          createElement('td', { style: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', textAlign: 'center', fontWeight: 600, color: r['方向'] === '买入' ? '#065f46' : '#991b1b' } },
            r['方向'] || '-'
          ),
          createElement('td', { style: { padding: '6px 8px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 } },
            formatNumber(r['成交额'])
          )
        );
      });

      content = createElement('div', null,
        createElement('div', {
          style: {
            marginBottom: '12px',
            fontSize: '13px',
            color: '#4b5563'
          }
        }, '\uD83D\uDDBC 图片名称: ', createElement('strong', null, result.imageName)),
        createElement('div', {
          style: {
            marginBottom: '8px',
            fontSize: '12px',
            color: '#6b7280'
          }
        }, '\u23F0 解析时间: ', result.timestamp),
        createElement('div', {
          style: {
            marginBottom: '8px',
            padding: '8px 12px',
            background: '#d1fae5',
            borderLeft: '3px solid #10b981',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#065f46',
            fontFamily: 'monospace',
            lineHeight: '1.6'
          }
        }, 
          '\uD83D\uDCDA 执行代码:\n' +
          '  \u25B6 主程序: screenshotVerifyPluginReact.js (processOneImage函数)\n' +
          '  \u25B6 子模块1: stockData.js (window.ALL_STOCKS - 股票名称矫正数据源)\n' +
          '  \u25B6 功能1: TRADE_SCHEMA (结构化字段定义 - 名称/股号/价格/数量/方向/成交额)\n' +
          '  \u25B6 功能2: extractedRecords[] (智能提取结果 - 按记录分组)\n' +
          '  \u25B6 功能3: correctStockName() (名称矫正 - 代码精确/名称包含/模糊匹配)'
        ),
        createElement('div', {
          style: {
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexWrap: 'wrap'
          }
        },
          createElement('span', {
            style: {
              background: '#ede9fe',
              color: '#6d28d9',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 600
            }
          }, '共 ' + (result.data || []).length + ' 笔记录'),
          createElement('span', {
            style: {
              background: '#dbeafe',
              color: '#1e40af',
              padding: '4px 14px',
              borderRadius: '20px',
              fontSize: '12px',
              cursor: 'pointer',
              textDecoration: 'underline'
            },
            onClick: function() {
              setIntermediateResult({
                type: 'ocr',
                imageIndex: result.imageIndex,
                imageName: result.imageName,
                text: result.originalText,
                timestamp: result.timestamp
              });
            }
          }, '\u{1F50D} 查看原始OCR文本')
        ),
        createElement('div', {
          style: {
            overflow: 'auto',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            background: 'white',
            maxHeight: '350px'
          }
        },
          createElement('table', {
            style: {
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '11px'
            }
          },
            createElement('thead', null,
              createElement('tr', { style: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white' } },
                createElement('th', { style: { padding: '7px 8px', textAlign: 'left', fontWeight: 600 } }, '名称'),
                createElement('th', { style: { padding: '7px 8px', textAlign: 'left', fontWeight: 600 } }, '股号'),
                createElement('th', { style: { padding: '7px 8px', textAlign: 'right', fontWeight: 600 } }, '价格'),
                createElement('th', { style: { padding: '7px 8px', textAlign: 'right', fontWeight: 600 } }, '数量'),
                createElement('th', { style: { padding: '7px 8px', textAlign: 'center', fontWeight: 600 } }, '方向'),
                createElement('th', { style: { padding: '7px 8px', textAlign: 'right', fontWeight: 600 } }, '成交额')
              )
            ),
            createElement('tbody', null, parsedRows)
          )
        )
      );
    }

    return createElement('div', {
      style: {
        flex: 1,
        minHeight: 0,
        overflow: 'auto',
        padding: '16px',
        background: panelBg,
        borderLeft: '4px solid ' + borderColor,
        margin: '0 16px 16px',
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)'
      }
    },
      createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
          paddingBottom: '8px',
          borderBottom: '2px solid ' + borderColor
        }
      },
        createElement('h3', {
          style: {
            margin: 0,
            fontSize: '16px',
            fontWeight: 700,
            color: titleColor,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }
        }, panelTitle),
        createElement('button', {
          onClick: onContinue,
          style: {
            padding: '8px 24px',
            background: isOcrResult ? '#f59e0b' : '#10b981',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 700,
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
            transition: 'all 0.2s'
          }
        }, '\u25B6 ', nextStepText, ' \u25B6')
      ),
      content
    );

    } catch(err) {
      console.error('[SV-React] IntermediateResultPanel 错误:', err);
      alert('❌ IntermediateResultPanel 组件错误:\n\n' + err.message);
      return createElement('div', {
        style: { padding: '20px', background: '#fee2e2', border: '2px solid #ef4444', borderRadius: '8px' }
      }, createElement('h3', null, '⚠️ 组件渲染错误'), createElement('p', null, err.message));
    }
  }

  // ===== 辅助函数：解析内联样式 =====
  function parseInlineStyle(styleStr) {
    if (!styleStr) return {};
    var obj = {};
    styleStr.split(';').forEach(function(s) {
      var parts = s.split(':');
      if (parts.length === 2) {
        var k = parts[0].trim();
        var v = parts[1].trim();
        if (k && v) obj[k] = v;
      }
    });
    return obj;
  }

  // ===== 子组件：数据表格 =====
  function DataTable({ data }) {
    if (!data || !data.length) return null;

    var buyCount = data.filter(function(d) { return d['方向'] === '买入'; }).length;
    var sellCount = data.filter(function(d) { return d['方向'] === '卖出'; }).length;

    var headerCells = [
      createElement('th', { key: 'h-name', style: { padding: '7px 8px', textAlign: 'left', fontWeight: 600, width: '140px' } }, '名称'),
      createElement('th', { key: 'h-code', style: { padding: '7px 6px', textAlign: 'left', fontWeight: 600, width: '75px' } }, '股号'),
      createElement('th', { key: 'h-price', style: { padding: '7px 6px', textAlign: 'right', fontWeight: 600, width: '75px' } }, '价格'),
      createElement('th', { key: 'h-qty', style: { padding: '7px 6px', textAlign: 'right', fontWeight: 600, width: '70px' } }, '数量'),
      createElement('th', { key: 'h-dir', style: { padding: '7px 4px', textAlign: 'center', fontWeight: 600, width: '48px' } }, '方向'),
      createElement('th', { key: 'h-amount', style: { padding: '7px 6px', textAlign: 'right', fontWeight: 600, width: '130px' } }, '成交额')
    ];

    var bodyRows = data.map(function(r, i) {
      var dir = r['方向'] || '-';
      var dirStyle = dir === '买入'
        ? 'color:#065f46;font-weight:700;'
        : (dir === '卖出' ? 'color:#991b1b;font-weight:700;' : '');
      var bg = i % 2 === 0 ? '#ffffff' : '#f8fafc';

      return createElement('tr', { key: i, style: { background: bg } },
        createElement('td', { key: 'name', style: { padding: '6px 8px', borderBottom: '1px solid #edf2f2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
          createElement('strong', { style: { color: '#1a202c' } }, escapeHtml(r['名称']))
        ),
        createElement('td', { key: 'code', style: { padding: '6px 6px', borderBottom: '1px solid #edf2f2', fontFamily: 'monospace', fontSize: '11px', color: '#718096' } },
          escapeHtml(r['股号'])
        ),
        createElement('td', { key: 'price', style: { padding: '6px 6px', borderBottom: '1px solid #edf2f2', textAlign: 'right', fontFamily: 'monospace', color: '#2d3748' } },
          r['价格']
        ),
        createElement('td', { key: 'qty', style: { padding: '6px 6px', borderBottom: '1px solid #edf2f2', textAlign: 'right', fontFamily: 'monospace', color: '#4a5568' } },
          formatNumber(r['数量'])
        ),
        createElement('td', { key: 'dir', style: Object.assign({ padding: '3px 2px', borderBottom: '1px solid #edf2f2', textAlign: 'center', fontSize: '12px' }, parseInlineStyle(dirStyle)) },
          dir
        ),
        createElement('td', { key: 'amount', style: { padding: '6px 6px', borderBottom: '1px solid #edf2f2', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#1a202c' } },
          formatNumber(r['成交额'])
        )
      );
    });

    return createElement('div', null,
      // 统计摘要
      createElement('div', {
        style: {
          marginBottom: '12px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          flexWrap: 'wrap'
        }
      },
        createElement('span', { style: { fontSize: '15px', fontWeight: 700, color: '#2d3748' } }, '\uD83D\uDCCA 识别结果'),
        createElement('div', { style: { display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end' } },
          createElement('span', { style: { background: '#ede9fe', color: '#6d28d9', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 } },
            '共 ' + data.length + ' 笔'
          ),
          createElement('span', { style: { background: '#d1fae5', color: '#065f46', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 } },
            '买入 ' + buyCount
          ),
          createElement('span', { style: { background: '#fee2e2', color: '#991b1b', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 } },
            '卖出 ' + sellCount
          )
        )
      ),

      // 表格
      createElement('div', {
        style: {
          overflow: 'auto',
          border: '1px solid #e2e8f0',
          borderRadius: '10px',
          background: 'white'
        }
      },
        createElement('table', {
          style: {
            width: 'auto',
            minWidth: '100%',
            borderCollapse: 'collapse',
            fontSize: '12px',
            tableLayout: 'fixed'
          }
        },
          createElement('thead', null,
            createElement('tr', { style: { background: 'linear-gradient(135deg,#667eea,#764ba2)', color: 'white' } },
              headerCells
            )
          ),
          createElement('tbody', null,
            bodyRows
          )
        )
      )
    );
  }

  // ===== 子组件：股票清单表格显示（用于STOCK_LIST模式） =====
  function StockListDataTable({ data }) {
    // ✅ 调试日志：检查传入的数据
    console.log('[SV-React] 📊 StockListDataTable - 接收数据:', 
      '- data长度:', (data || []).length,
      '- data[0]存在:', !!(data && data[0]),
      '- data[0].fields存在:', !!(data && data[0] && data[0].fields));
    
    if (!data || !data.length) return null;

    var stockFields = ['股票代码', '股票名称', '截图用名称', '单位', '市场', '类型', '买入数量', '卖出数量', '结余数量'];
    
    return createElement('div', {
      style: {
        overflowX: 'auto',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        background: '#ffffff'
      }
    },
      createElement('table', {
        style: {
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: '13px'
        }
      },
        createElement('thead', null,
          createElement('tr', {
            style: { 
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: '#ffffff',
              fontWeight: 700,
              fontSize: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }
          },
            stockFields.map(function(field) {
              return createElement('th', {
                key: field,
                style: {
                  padding: '12px 8px',
                  textAlign: field === '买入数量' || field === '卖出数量' ? 'right' : 'left',
                  borderBottom: '2px solid #4c51bf',
                  whiteSpace: 'nowrap',
                  fontSize: '11px'
                }
              }, field);
            })
          )
        ),
        createElement('tbody', null,
          data.map(function(record, idx) {
            var fields = record.fields || {};
            
            // ✅ 调试日志：检查每条记录的fields
            if (idx === 0) {
              console.log('[SV-React] 📊 StockListDataTable - 第1条记录:', 
                '- record keys:', Object.keys(record).join(','),
                '- fields:', fields,
                '- 股票名称:', fields['股票名称'],
                '- 类型:', fields['类型']);
            }
            
            return createElement('tr', {
              key: idx,
              style: {
                background: idx % 2 === 0 ? '#f7fafc' : '#ffffff',
                transition: 'background-color 0.15s ease',
                ':hover': { backgroundColor: '#ebf8ff' }
              }
            },
              stockFields.map(function(field) {
                var value = fields[field] || '-';
                
                // 根据字段类型设置样式
                var cellStyle = {
                  padding: '10px 8px',
                  borderBottom: '1px solid #e2e8f0',
                  fontSize: '12px',
                  fontFamily: field === '股票代码' || /^[\d,]+$/.test(value) ? 'monospace' : 'inherit'
                };
                
                // 数字对齐
                if (field === '买入数量' || field === '卖出数量' || field === '结余数量') {
                  cellStyle.textAlign = 'right';
                  cellStyle.fontWeight = 600;
                  
                  // 颜色编码（模拟截图中的颜色）
                  if (field === '买入数量') {
                    cellStyle.color = '#059669';  // 绿色
                  } else if (field === '卖出数量') {
                    cellStyle.color = '#dc2626';  // 红色
                  } else {
                    cellStyle.color = '#1f2937';  // 黑色/深灰
                  }
                }
                
                // 类型标签样式
                if (field === '类型') {
                  cellStyle.background = '#dbeafe';
                  cellStyle.color = '#1e40af';
                  cellStyle.padding = '2px 8px';
                  cellStyle.borderRadius = '4px';
                  cellStyle.display = 'inline-block';
                  cellStyle.fontWeight = 600;
                  cellStyle.fontSize = '11px';
                }
                
                // 截图用名称样式（绿色斜体）
                if (field === '截图用名称') {
                  cellStyle.color = '#059669';
                  cellStyle.fontStyle = 'italic';
                }
                
                return createElement('td', { key: field, style: cellStyle }, value);
              })
            );
          })
        ),
        
        // 汇总统计行
        data.length > 0 && createElement('tfoot', null,
          createElement('tr', {
            style: {
              background: '#f0fdf4',
              borderTop: '3px solid #10b981',
              fontWeight: 700
            }
          },
            createElement('td', {
              colSpan: 6,
              style: { padding: '12px 8px', color: '#065f46', textAlign: 'right', fontSize: '12px' }
            }, '📊 合计 (' + data.length + ' 条记录):'),
            stockFields.slice(6).map(function(field) {
              var total = data.reduce(function(sum, record) {
                // ✅ 安全检查：确保record.fields存在
                if (!record || !record.fields) return sum;
                var val = parseFloat((record.fields[field] || '0').replace(/,/g, ''));
                return sum + (isNaN(val) ? 0 : val);
              }, 0);
              
              return createElement('td', {
                key: field,
                style: {
                  padding: '12px 8px',
                  textAlign: 'right',
                  color: field === '卖出数量' ? '#dc2626' : '#059669',
                  fontWeight: 700,
                  fontFamily: 'monospace',
                  fontSize: '13px'
                }
              }, total.toLocaleString());
            })
          )
        )
      )
    );
  }

  // ===== 子组件：股票清单解析结果显示（STOCK_LIST模式专用） =====
  function StockListParsedDisplay({ data }) {
    if (!data || !data.data || !data.data.length) return null;

    var stockFields = ['股票代码', '股票名称', '截图用名称', '单位', '市场', '类型', '买入数量', '卖出数量', '结余数量'];
    
    return createElement('div', {
      style: {
        background: '#f5f3ff',
        border: '2px solid #8b5cf6',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '24px'
      }
    },
      // 标题栏
      createElement('div', { 
        style: { 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '2px solid #c4b5fd'
        }
      },
        createElement('div', null,
          createElement('span', { 
            style: { 
              fontSize: '16px', 
              fontWeight: 700, 
              color: '#5b21b6',
              marginRight: '8px'
          }}, '📋'),
          createElement('span', { 
            style: { fontSize: '14px', fontWeight: 600, color: '#7c3aed' }}, 
            '股票清单解析结果 (STOCK_INVENTORY)')
        ),
        createElement('span', {
          style: {
            fontSize: '11px',
            color: '#6d28d9',
            background: '#ede9fe',
            padding: '4px 10px',
            borderRadius: '20px',
            fontWeight: 600
          }
        }, data.data.length + ' 条记录')
      ),

      // 图片信息
      createElement('div', {
        style: { fontSize: '12px', color: '#6b7280', marginBottom: '12px' }
      },
        createElement('strong', null, '📷 图片名称: '),
        data.imageName,
        createElement('br'),
        createElement('strong', null, '⏰ 处理时间: '),
        data.timestamp
      ),

      // 数据表格
      createElement('div', { style: { overflowX: 'auto', borderRadius: '8px', border: '1px solid #e9d5ff' } },
        createElement('table', {
          style: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            background: '#ffffff'
          }
        },
          createElement('thead', null,
            createElement('tr', {
              style: { 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#ffffff',
                fontWeight: 700
              }
            },
              stockFields.map(function(field) {
                return createElement('th', {
                  key: field,
                  style: {
                    padding: '12px 8px',
                    textAlign: field.includes('数量') ? 'right' : 'left',
                    fontSize: '11px',
                    whiteSpace: 'nowrap'
                  }
                }, field);
              })
            )
          ),
          createElement('tbody', null,
            data.data.map(function(record, idx) {
              var fields = record.fields || {};
              return createElement('tr', {
                key: idx,
                style: { background: idx % 2 === 0 ? '#faf5ff' : '#ffffff' }
              },
                stockFields.map(function(field) {
                  var value = fields[field] || '-';
                  var cellStyle = {
                    padding: '10px 8px',
                    borderBottom: '1px solid #f3e8ff',
                    fontSize: '12px'
                  };
                  
                  if (field === '买入数量') {
                    cellStyle.textAlign = 'right';
                    cellStyle.color = '#059669';
                    cellStyle.fontWeight = 600;
                  } else if (field === '卖出数量') {
                    cellStyle.textAlign = 'right';
                    cellStyle.color = '#dc2626';
                    cellStyle.fontWeight = 600;
                  } else if (field === '结余数量') {
                    cellStyle.textAlign = 'right';
                    cellStyle.color = '#1f2937';
                    cellStyle.fontWeight = 600;
                  } else if (field === '类型') {
                    cellStyle.background = '#dbeafe';
                    cellStyle.color = '#1e40af';
                    cellStyle.padding = '2px 8px';
                    cellStyle.borderRadius = '4px';
                    cellStyle.display = 'inline-block';
                    cellStyle.fontWeight = 600;
                  } else if (field === '截图用名称') {
                    cellStyle.color = '#059669';
                    cellStyle.fontStyle = 'italic';
                  }

                  return createElement('td', { key: field, style: cellStyle }, value);
                })
              );
            })
          ),

          // 汇总统计行
          data.data.length > 0 && createElement('tfoot', null,
            createElement('tr', {
              style: {
                background: '#ede9fe',
                borderTop: '3px solid #8b5cf6',
                fontWeight: 700
              }
            },
              createElement('td', {
                colSpan: 6,
                style: { padding: '12px 8px', color: '#5b21b6', textAlign: 'right', fontSize: '12px' }
              }, '📊 合计 (' + data.data.length + ' 条):'),
              stockFields.slice(6).map(function(field) {
                var total = data.data.reduce(function(sum, record) {
                  var val = parseFloat((record.fields[field] || '0').replace(/,/g, ''));
                  return sum + (isNaN(val) ? 0 : val);
                }, 0);
                
                return createElement('td', {
                  key: field,
                  style: {
                    padding: '12px 8px',
                    textAlign: 'right',
                    color: field === '卖出数量' ? '#dc2626' : '#059669',
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    fontSize: '13px'
                  }
                }, total.toLocaleString());
              })
            )
          )
        )
      ),

      // 提示信息
      createElement('div', {
        style: {
          marginTop: '16px',
          padding: '12px',
          background: '#faf5ff',
          border: '1px solid #d8b4fe',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#7c3aed'
        }
      },
        createElement('strong', null, '💡 提示: '),
        '此截图已按照 "股票清单" 模板进行结构化解析。',
        createElement('br'),
        '共识别 ', data.data.length, ' 条股票持仓记录，包含完整的9个字段。',
        createElement('br'),
        '数据已通过位置+特征双重验证，确保准确性。'
      )
    );
  }

  // ===== 子组件：交易记录解析结果显示（TRADE模式专用） =====
  function TradeParsedDisplay({ data }) {
    if (!data || !data.data || !data.data.length) return null;

    var tradeFields = ['名称', '股号', '价格', '数量', '方向', '成交额'];
    
    return createElement('div', {
      style: {
        background: '#ecfdf5',
        border: '2px solid #10b981',
        borderRadius: '10px',
        padding: '16px',
        marginBottom: '24px'
      }
    },
      // 标题栏
      createElement('div', { 
        style: { 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px',
          paddingBottom: '12px',
          borderBottom: '2px solid #86efac'
        }
      },
        createElement('div', null,
          createElement('span', { 
            style: { 
              fontSize: '16px', 
              fontWeight: 700, 
              color: '#065f46',
              marginRight: '8px'
          }}, '✅'),
          createElement('span', { 
            style: { fontSize: '14px', fontWeight: 600, color: '#047857' }}, 
            '交易记录解析结果 (光大证券金阳光)')
        ),
        createElement('span', {
          style: {
            fontSize: '11px',
            color: '#047857',
            background: '#d1fae5',
            padding: '4px 10px',
            borderRadius: '20px',
            fontWeight: 600
          }
        }, data.data.length + ' 条记录')
      ),

      // 数据表格
      createElement('div', { style: { overflowX: 'auto', borderRadius: '8px', border: '1px solid #bbf7d0' } },
        createElement('table', {
          style: {
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: '13px',
            background: '#ffffff'
          }
        },
          createElement('thead', null,
            createElement('tr', {
              style: { 
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                color: '#ffffff',
                fontWeight: 700
              }
            },
              tradeFields.map(function(field) {
                return createElement('th', {
                  key: field,
                  style: {
                    padding: '12px 8px',
                    textAlign: field === '价格' || field === '数量' || field === '成交额' ? 'right' : 'left',
                    fontSize: '11px',
                    whiteSpace: 'nowrap'
                  }
                }, field);
              })
            )
          ),
          createElement('tbody', null,
            data.data.map(function(record, idx) {
              var fields = record.fields || {};
              return createElement('tr', {
                key: idx,
                style: { background: idx % 2 === 0 ? '#f0fdf4' : '#ffffff' }
              },
                tradeFields.map(function(field) {
                  var value = fields[field] || '-';
                  var cellStyle = {
                    padding: '10px 8px',
                    borderBottom: '1px solid #dcfce7',
                    fontSize: '12px'
                  };
                  
                  if (field === '方向') {
                    cellStyle.color = value === '买入' ? '#059669' : '#dc2626';
                    cellStyle.fontWeight = 700;
                    cellStyle.textAlign = 'center';
                  } else if (field === '价格' || field === '成交额') {
                    cellStyle.textAlign = 'right';
                    cellStyle.fontFamily = 'monospace';
                  } else if (field === '数量') {
                    cellStyle.textAlign = 'right';
                    cellStyle.fontFamily = 'monospace';
                    cellStyle.fontWeight = 600;
                  }

                  return createElement('td', { key: field, style: cellStyle }, value);
                })
              );
            })
          )
        )
      ),

      // 提示信息
      createElement('div', {
        style: {
          marginTop: '16px',
          padding: '12px',
          background: '#f0fdf4',
          border: '1px solid #86efac',
          borderRadius: '8px',
          fontSize: '12px',
          color: '#166534'
        }
      },
        createElement('strong', null, '💡 提示: '),
        '此截图已按照 "光大证券金阳光" 模板进行结构化解析。',
        createElement('br'),
        '共识别 ', data.data.length, ' 条交易记录，包含完整的6个字段。',
        createElement('br'),
        '股票名称已通过三级匹配策略进行智能矫正。'
      )
    );
  }

  // ===== 原始文本显示（用于未规范数据） =====
  function RawTextDisplay({ data, images }) {
    if (!data || !data.length) return null;

    // ✅ 基础中文文本清洗（仅移除中文字符间的空白）
    function cleanChineseText(text) {
      if (!text) return '';
      var cleaned = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
      var prevText = '';
      var maxIterations = 5;
      var iteration = 0;
      while (prevText !== cleaned && iteration < maxIterations) {
        prevText = cleaned;
        cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
        iteration++;
      }
      return cleaned;
    }

    var allTexts = [];
    
    images.forEach(function(img, idx) {
      if (img.ocrText) {
        // ✅ 关键修复：使用清洗后的文本（无空格）
        var displayText = cleanChineseText(img.ocrText);
        console.log('[SV-React] 📄 RawTextDisplay - 原始长度:', img.ocrText.length, ', 清洗后长度:', displayText.length);
        
        allTexts.push({
          index: idx + 1,
          name: img.name || ('截图' + (idx + 1)),
          text: displayText,
          isRawText: img.templateId === 'RAW_TEXT'
        });
      }
    });

    if (allTexts.length === 0 && data.length > 0) {
      var combinedText = data.map(function(record, i) {
        var lines = Object.keys(record).map(function(key) { return key + ': ' + (record[key] || '(空)'); });
        return '【记录 ' + (i+1) + '】\n' + lines.join('\n');
      }).join('\n\n');
      
      // ✅ 关键修复：清洗合并后的文本
      var cleanedCombinedText = cleanChineseText(combinedText);
      
      allTexts.push({
        index: 1,
        name: '提取数据',
        text: cleanedCombinedText,
        isRawText: true
      });
    }

    return createElement('div', null,
      createElement('div', {
        style: { marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }
      },
        createElement('span', { style: { fontSize: '15px', fontWeight: 700, color: '#2d3748' } }, '📄 原始文本'),
        createElement('div', { style: { display: 'flex', gap: '10px', flex: 1, justifyContent: 'flex-end' } },
          createElement('span', { style: { background: '#fef3c7', color: '#92400e', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 } },
            '共 ' + allTexts.length + ' 个来源'
          ),
          createElement('span', { style: { background: '#fee2e2', color: '#991b1b', padding: '4px 14px', borderRadius: '20px', fontSize: '12px', fontWeight: 600 } },
            '未规范数据 - 仅显示原始OCR文本'
          )
        )
      ),

      ...allTexts.map(function(item, idx) {
        return createElement('div', { key: idx, style: { marginBottom: idx < allTexts.length - 1 ? '20px' : '0' } },
          createElement('div', {
            style: {
              background: 'linear-gradient(135deg,#f59e0b,#d97706)',
              color: 'white',
              padding: '8px 12px',
              borderRadius: '6px 6px 0 0',
              fontSize: '13px',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }
          },
            createElement('span', null, '📷 ' + item.name),
            createElement('span', { style: { fontSize: '11px', opacity: 0.9 } }, '#' + item.index)
          ),
          createElement('div', {
            style: {
              border: '2px solid #f59e0b',
              borderTop: 'none',
              borderRadius: '0 0 6px 6px',
              background: '#1e293b',
              padding: '16px',
              maxHeight: '400px',
              overflow: 'auto'
            }
          },
            createElement('pre', {
              style: {
                margin: 0,
                fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
                fontSize: '12px',
                lineHeight: '1.6',
                color: '#e2e8f0',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all'
              }
            }, item.text)
          )
        );
      })
    );
  }

  // ===== 子组件：RAW_TEXT模式的文本预处理展示（简化版） =====
  function RawTextCleanedDisplay({ result }) {
    if (!result) return null;

    return createElement('div', null,
      createElement('div', {
        style: {
          marginBottom: '12px',
          padding: '10px 14px',
          background: '#fef3c7',
          border: '1px solid #f59e0b',
          borderRadius: '8px',
          fontSize: '12px'
        }
      },
        createElement('div', { style: { fontWeight: 700, color: '#92400e', marginBottom: '6px' } },
          '⚠️ RAW_TEXT模式 - 未检测到规范数据特征'
        ),
        createElement('div', { style: { color: '#b45309', marginBottom: '4px' } },
          '✅ 处理方式：将整个OCR文本视为一个整体，不进行字段拆解')
        ),
      
      createElement('div', {
        style: {
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          overflow: 'hidden'
        }
      },
        createElement('div', {
          style: {
            background: 'linear-gradient(135deg,#f59e0b,#d97706)',
            color: 'white',
            padding: '8px 12px',
            fontSize: '12px',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }
        },
          createElement('span', null, '📝 清洗后的原始文本'),
          createElement('span', { style: { fontSize: '11px', opacity: 0.9 } }, 
            (result.processedText || '').split('\n').length + ' 行'
          )
        ),
        createElement('div', {
          style: {
            background: '#1e293b',
            padding: '16px',
            maxHeight: '350px',
            overflow: 'auto'
          }
        },
          createElement('pre', {
            style: {
              margin: 0,
              fontFamily: '"Monaco", "Menlo", "Ubuntu Mono", monospace',
              fontSize: '12px',
              lineHeight: '1.6',
              color: '#e2e8f0',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }
          }, result.processedText || '(无文本内容)')
        )
      ),
      
      createElement('div', {
        style: {
          marginTop: '12px',
          padding: '10px 14px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '6px',
          fontSize: '11px',
          color: '#64748b'
        }
      },
        createElement('div', { style: { marginBottom: '4px' } },
          createElement('strong', null, '📊 数据统计：'),
          '共 ' + (result.originalText || '').split('\n').length + ' 行原始文本 → ',
          '清洗后 ' + (result.processedText || '').split('\n').length + ' 行'
        ),
        createElement('div', null,
          createElement('strong', null, '💡 提示：'),
          '此数据未匹配任何规范模板，仅显示原始OCR文本'
        )
      )
    );
  }

  // ===== 错误边界组件（用于捕获子组件错误）=====
  class ErrorBoundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
      return { hasError: true, error: error };
    }

    componentDidCatch(error, errorInfo) {
      console.error('[SV-React] Error Boundary 捕获到错误:', error, errorInfo);
      
      // 将错误信息显示给用户
      var errorMsg = '❌ [致命错误] ScreenshotVerifyApp 渲染失败！\n\n' +
                     '错误类型: ' + error.name + '\n' +
                     '错误信息: ' + error.message + '\n\n' +
                     '错误堆栈:\n' + (error.stack || '无') + '\n\n' +
                     '组件堆栈:\n' + (errorInfo.componentStack || '无');
      
      alert(errorMsg);
      
      this.setState({ 
        hasError: true, 
        error: error,
        errorInfo: errorInfo
      });
    }

    render() {
      if (this.state.hasError) {
        return createElement('div', {
          style: {
            padding: '20px',
            background: '#fee2e2',
            border: '2px solid #ef4444',
            borderRadius: '8px',
            margin: '20px'
          }
        },
          createElement('h3', { style: { color: '#dc2626', marginTop: 0 } }, '⚠️ 组件渲染出错'),
          createElement('p', { style: { color: '#991b1b' } }, 
            '错误信息: ' + (this.state.error ? this.state.error.message : '未知错误')
          ),
          createElement('pre', { 
            style: { 
              background: '#fef2f2', 
              padding: '10px', 
              borderRadius: '4px',
              fontSize: '12px',
              overflow: 'auto',
              maxHeight: '300px',
              color: '#7f1d1d'
            } 
          }, 
            this.state.error ? this.state.error.stack : ''
          )
        );
      }

      return this.props.children;
    }
  }

  // ===== 主应用组件 =====
  function ScreenshotVerifyApp({ market }) {
    var _useState1 = useState([]),
      images = _useState1[0],
      setImages = _useState1[1];

    var _useState2 = useState([]),
      allData = _useState2[0],
      setAllData = _useState2[1];

    var _useState3 = useState({ message: '', isOk: true }),
      status = _useState3[0],
      setStatus = _useState3[1];

    var _useState4 = useState(0),
      forceUpdate = _useState4[0],
      triggerForceUpdate = _useState4[1];

    var _useState5 = useState(null),
      intermediateResult = _useState5[0],
      setIntermediateResult = _useState5[1];

    var _useState6 = useState(0),
      activeTab = _useState6[0],
      setActiveTab = _useState6[1];

    var _useState7 = useState({
      tab3_ocr: [],       // 改为数组：存储所有截图的OCR结果
      tab4_cleaned: [],   // 改为数组：存储所有截图的预处理结果
      tab5_parsed: []     // 改为数组：存储所有截图的解析结果
    }),
      tabHistory = _useState7[0],
      setTabHistory = _useState7[1];

    // ✨ 新增：当前模板ID状态（用于"最终结果"标签页渲染）
    var _useState8 = useState(null),
      currentTemplateIdState = _useState8[0],
      setCurrentTemplateIdState = _useState8[1];

    var ocrRef = useRef(null);
    var parserRef = useRef(null);
    var tableExtractorRef = useRef(null);
    var imagesRef = useRef(images);

    var _useState9 = useState(function() {
      try { return localStorage.getItem('sv_ai_api_key') || ''; } catch(e) { return ''; }
    }),
      geminiApiKeyState = _useState9[0],
      setGeminiApiKey = _useState9[1];

    var _useState10 = useState(function() {
      try { return localStorage.getItem('sv_ai_provider') || 'zhipu'; } catch(e) { return 'zhipu'; }
    }),
      aiProviderState = _useState10[0],
      setAiProvider = _useState10[1];

    var _useState11 = useState(function() {
      try { return localStorage.getItem('sv_table_prompt') || ''; } catch(e) { return ''; }
    }),
      tablePromptState = _useState11[0],
      setTablePrompt = _useState11[1];

    // 同步 imagesRef
    useEffect(function() {
      imagesRef.current = images;
    }, [images]);

    // 初始化 OCR 和 Parser
    useEffect(function() {
      ocrRef.current = new OcrEngine();
      parserRef.current = new TextDataParser();

      // 懒初始化 TableGridExtractor（即使加载失败也不阻塞）
      if (typeof TableGridExtractor !== 'undefined') {
        tableExtractorRef.current = new TableGridExtractor();
        console.log('[SV-React] TableGridExtractor 已初始化');
      } else {
        console.warn('[SV-React] TableGridExtractor 未定义，将在使用时尝试重新加载');
        tableExtractorRef.current = null;
      }

      console.log('[SV-React] OCR 和 Parser 已初始化');

      return function() {
        console.log('[SV-React] 组件卸载，清理资源');
        ocrRef.current = null;
        parserRef.current = null;
        tableExtractorRef.current = null;
      };
    }, []);

    // 添加图片
    var handleAdd = useCallback(function(file) {
      var currentImages = imagesRef.current;
      if (currentImages.length >= MAX_IMAGES) {
        setStatus({ message: '\u26A0\uFE0F 最多支持 ' + MAX_IMAGES + ' 张截图', isOk: false });
        return;
      }
      if (!file.type.startsWith('image/')) {
        setStatus({ message: '\u274C 请选择图片文件', isOk: false });
        return;
      }

      var idx = currentImages.length;
      var reader = new FileReader();

      reader.onload = function(e) {
        var newImg = {
          index: idx,
          name: file.name,
          data: e.target.result,
          ocrDone: false,
          parsedData: [],
          searchPosition: 'topLeft',
          keyword: ''
        };

        setImages(function(prev) {
          return prev.concat([newImg]);
        });
        setStatus({ message: '', isOk: true });
      };

      reader.readAsDataURL(file);
    }, []);

    // 更新单个图片的设置
    var handleUpdateImage = useCallback(function(idx, field, value) {
      setImages(function(prev) {
        return prev.map(function(img, i) {
          if (i === idx) {
            var updated = Object.assign({}, img);
            if (field === 'searchPosition') {
              updated.searchPosition = value;
            } else if (field === 'keyword') {
              updated.keyword = value;
            }
            return updated;
          }
          return img;
        });
      });
      console.log('[SV-React] 截图' + (idx+1) + ' 设置更新: 字段=' + field + ', 值=' + value);
    }, []);

    // 删除图片
    var handleRemove = useCallback(function(idx) {
      setImages(function(prev) {
        return prev.filter(function(img, i) { return i !== idx; }).map(function(img, i) {
          return Object.assign({}, img, { index: i });
        });
      });

      setTimeout(function() {
        rebuildDataFromImages();
        triggerForceUpdate(function(v) { return v + 1; });
      }, 100);
    }, []);

    // 清空所有
    var handleClearAll = useCallback(function() {
      setImages([]);
      setAllData([]);
      setTabHistory({});
      setActiveTab(0);
      setStatus({ message: '', isOk: true });
    }, []);

    // 开始解析
    var handleParse = useCallback(async function() {
      var currentImages = imagesRef.current;
      var pending = currentImages.filter(function(img) { return !img.ocrDone; });

      if (!pending.length) {
        setStatus({ message: '\u26A0\uFE0F 没有待解析的截图', isOk: false });
        return;
      }

      setStatus({ message: '\uD83D\uDD0D 开始解析 ' + pending.length + ' 张...', isOk: true });

      for (var i = 0; i < pending.length; i++) {
        await processOneImage(pending[i].index);
      }

      triggerForceUpdate(function(v) { return v + 1; });

      // 延迟等待数据完全写入后再统计
      setTimeout(function() {
        var finalData = imagesRef.current.reduce(function(acc, img) {
          if (img.parsedData && img.parsedData.length > 0) {
            img.parsedData.forEach(function(r) {
              acc.push(Object.assign({}, r));
            });
          }
          return acc;
        }, []);

        var uniqueCount = deduplicateData(finalData).length;
        setStatus({
          message: '\u2705 全部解析完成！共 ' + uniqueCount + ' 条记录',
          isOk: true
        });

        console.log('[SV-React] 解析统计 - 总记录:', finalData.length, '去重后:', uniqueCount);
      }, 200);
    }, []);

    var handleTableExtract = useCallback(async function() {
      var currentImages = imagesRef.current;
      var pending = currentImages.filter(function(img) { return !img.ocrDone; });

      if (!pending.length) {
        setStatus({ message: '\u26A0\uFE0F 没有待处理的截图', isOk: false });
        return;
      }
      if (pending.length > 1) {
        setStatus({ message: '\u26A0\uFE0F 表格提取仅支持单张截图，请只保留一张', isOk: false });
        return;
      }

      var img = pending[0];
      var extractor = tableExtractorRef.current;

      // 动态重试：如果未加载，尝试重新创建或动态加载脚本
      if (!extractor) {
        setStatus({ message: '\u23F3 正在加载表格提取引擎...', isOk: true });

        // 第1步：尝试重新创建（类可能已延迟加载）
        if (typeof TableGridExtractor !== 'undefined') {
          tableExtractorRef.current = new TableGridExtractor();
          extractor = tableExtractorRef.current;
          console.log('[SV-React] TableGridExtractor 重新初始化成功');
        }
        // 第2步：动态加载（用绝对路径 + 时间戳破缓存）
        else {
          console.warn('[SV-React] 动态加载 tableGridExtractor.js...');
          try {
            var scriptBase = '';
            var scripts = document.getElementsByTagName('script');
            for (var si = 0; si < scripts.length; si++) {
              if (scripts[si].src && scripts[si].src.indexOf('screenshotVerifyPluginReact') >= 0) {
                scriptBase = scripts[si].src.substring(0, scripts[si].src.lastIndexOf('/') + 1);
                break;
              }
            }

            await new Promise(function(res, rej) {
              var ds = document.createElement('script');
              ds.src = scriptBase + 'tableGridExtractor.js?v=51&t=' + Date.now();
              ds.onload = function() { console.log('[SV-React] 动态加载成功'); res(); };
              ds.onerror = function(e) { console.error('[SV-React] 加载错误', e); rej(new Error('脚本加载失败')); };
              document.head.appendChild(ds);
            });

            if (typeof TableGridExtractor !== 'undefined') {
              tableExtractorRef.current = new TableGridExtractor();
              extractor = tableExtractorRef.current;
              console.log('[SV-React] 动态加载后初始化成功');
            } else {
              setStatus({ message: '\u274C 引擎加载失败，请按 Cmd+Shift+R 强制刷新页面', isOk: false });
              return;
            }
          } catch (loadErr) {
            console.error('[SV-React] 动态加载异常:', loadErr.message);
            setStatus({ message: '\u274C 引擎加载失败: ' + loadErr.message + '，请强制刷新页面(Cmd+Shift+R)', isOk: false });
            return;
          }
        }
      }

      var savedKey = '';
      try { savedKey = localStorage.getItem('sv_ai_api_key') || ''; } catch(e) {}
      var savedProvider = 'zhipu';
      try { savedProvider = localStorage.getItem('sv_ai_provider') || 'zhipu'; } catch(e) {}

      if (savedKey) extractor.setApiKey(savedKey, savedProvider);

      var engineName = savedKey ? (savedProvider === 'qwen' ? '通义千问' : '智谱GLM') : 'Tesseract';
      setStatus({ message: '\uD83D\uDCCA 表格提取中 (' + engineName + ')...', isOk: true });

      try {
        var customPrompt = '';
        try { customPrompt = localStorage.getItem('sv_table_prompt') || ''; } catch(e) {}

        var result = await extractor.extract(img.data, {
          onProgress: function(p) {
            if (p.step === 'detect_lines') {
              setStatus({ message: '\uD83D\uDCCA ' + p.message, isOk: true });
            } else if (p.step === 'ocr_cells') {
              var pct = Math.round(p.current / p.total * 100);
              setStatus({ message: '\uD83D\uDCCA OCR识别格子 ' + p.current + '/' + p.total + ' (' + pct + '%)', isOk: true });
            }
          },
          customPrompt: customPrompt
        });

        setImages(function(prev) {
          return prev.map(function(im) {
            if (im.index === img.index) {
              return Object.assign({}, im, {
                ocrDone: true,
                tableGrid: result
              });
            }
            return im;
          });
        });

        triggerForceUpdate(function(v) { return v + 1; });

        console.log('[SV-React] 表格提取完成: ' + result.rows + '行 x ' + result.cols + '列');
        setStatus({
          message: '\u2705 表格提取完成！共 ' + result.rows + ' 行 x ' + result.cols + ' 列',
          isOk: true
        });

        _svLastGridJson = JSON.stringify(result, null, 2);
      } catch (err) {
        console.error('[SV-React] 表格提取失败:', err);
        setStatus({ message: '\u274C 表格提取失败: ' + (err.message || '未知错误'), isOk: false });
      }
    }, []);

    // 处理单张图片（自动执行：OCR → 清洗 → 解析，结果保存到页签）
    async function processOneImage(idx) {
      var currentImages = imagesRef.current;
      var img = currentImages.find(function(i) { return i.index === idx; });
      if (!img) {
        console.warn('[SV-React] 图片未找到，index:', idx);
        return;
      }

      setStatus({
        message: '\uD83D\uDD0D 截图 ' + (idx + 1) + ' 正在OCR识别...',
        isOk: true
      });

      try {
        var ocr = ocrRef.current;
        var parser = parserRef.current;

        if (!ocr || !parser) {
          throw new Error('OCR 或 Parser 未初始化');
        }

        console.log('[SV-React] 开始 OCR，图片:', img.name);
        var text = await ocr.recognize(img.data);
        console.log('[SV-React] OCR 完成，文本长度:', (text || '').length);

        setImages(function(prev) {
          return prev.map(function(im) {
            if (im.index === idx) {
              return Object.assign({}, im, {
                ocrDone: true,
                ocrText: text || ''
              });
            }
            return im;
          });
        });

        // ✅ 自动检测股票名称并填充关键字，并立即用于后续解析
        var autoDetectedKeyword = null;  // 存储检测到的关键字（立即使用）
        
        if (text && text.trim()) {
          var detectedStock = detectStockNameFromOCR(text);
          
          if (detectedStock && detectedStock.detectedName) {
            console.log('[SV-React] 🎯 自动检测到股票名称，将填充到关键字:', 
              '"' + detectedStock.detectedName + '"',
              '(方法:', detectedStock.matchMethod, ')'
            );
            
            // ✅ 关键修复：保存到变量，立即用于后续解析
            autoDetectedKeyword = detectedStock.detectedName;
            
            // 同时更新UI显示（异步，不影响当前流程）
            setImages(function(prev) {
              return prev.map(function(im) {
                if (im.index === idx) {
                  return Object.assign({}, im, {
                    keyword: autoDetectedKeyword,  // 填充关键字
                    _autoDetectedKeyword: true  // 标记为自动检测
                  });
                }
                return im;
              });
            });
            
            // 更新状态提示
            setStatus({
              message: '✅ 截图 ' + (idx + 1) + ' OCR完成！已自动识别关键字: "' + autoDetectedKeyword + '"',
              isOk: true
            });
          } else {
            console.log('[SV-React] ℹ️ 未能在OCR文本中自动检测到已知股票名称');
          }
        }

        setStatus({
          message: '\u2705 截图 ' + (idx + 1) + ' OCR识别完成！',
          isOk: true
        });

        setTabHistory(function(prev) {
          return Object.assign({}, prev, {
            tab3_ocr: (prev.tab3_ocr || []).concat([{
              type: 'ocr',
              imageIndex: idx,
              imageName: img.name,
              text: text || '',
              timestamp: new Date().toLocaleTimeString()
            }])
          });
        });

        if (text && text.trim()) {
          setStatus({
            message: '\uD83D\uDD0D 截图 ' + (idx + 1) + ' 正在执行文本预处理...',
            isOk: true
          });

          // 根据每个截图的独立设置进行预处理（先做关键字过滤）
          var processedText = text;
          
          // ✅ 关键修复：优先使用自动检测的关键字，其次用手动输入的
          var imgKeyword = (autoDetectedKeyword || img.keyword || '').trim();
          console.log('[SV-React] 📝 使用的关键字:', 
            '"' + imgKeyword + '"',
            '(来源:', autoDetectedKeyword ? '自动检测' : (img.keyword ? '手动输入' : '无'), ')'
          );
          
          var imgSearchPosition = img.searchPosition || 'topLeft';

          // ✅ 新增：智能关键字匹配（解决OCR中文空格问题）
          if (imgKeyword) {
            var kwIndex = -1;

            // 标准化函数：去除所有空白字符（空格、制表符、换行等）
            function normalizeText(str) {
              return str.replace(/[\s\u00A0\u3000\t\r\n]+/g, '');
            }

            var normalizedKeyword = normalizeText(imgKeyword);
            var normalizedText = normalizeText(text);

            console.log('[SV-React] 截图' + (idx+1) + ' 智能关键字匹配:');
            console.log('  原始关键字: [' + imgKeyword + ']');
            console.log('  标准化关键字: [' + normalizedKeyword + ']');
            console.log('  原始文本长度:', text.length, ', 标准化后长度:', normalizedText.length);

            if (imgSearchPosition === 'topLeft') {
              // 在标准化文本中查找
              var normalizedKwIndex = normalizedText.indexOf(normalizedKeyword);

              if (normalizedKwIndex >= 0) {
                // ✅ 关键：需要将标准化文本的位置映射回原始文本
                // 通过逐字符比对找到原始位置
                var origIndex = 0;
                var normIndex = 0;
                var found = false;

                while (origIndex < text.length && normIndex < normalizedText.length) {
                  // 跳过原始文本中的空白字符
                  while (origIndex < text.length && /[\s\u00A0\u3000\t\r\n]/.test(text[origIndex])) {
                    origIndex++;
                  }

                  // 比对字符
                  if (normIndex === normalizedKwIndex) {
                    kwIndex = origIndex;  // 找到原始位置！
                    found = true;
                    break;
                  }

                  if (origIndex < text.length && normIndex < normalizedText.length) {
                    origIndex++;
                    normIndex++;
                  } else {
                    break;
                  }
                }

                if (found && kwIndex >= 0) {
                  processedText = text.substring(kwIndex);
                  console.log('[SV-React] 截图' + (idx+1) + ' 左上角模式: 在原始位置 ' + kwIndex + ' 找到关键字 [' + imgKeyword + ']');
                  console.log('[SV-React] 截取后文本前50字:', processedText.substring(0, 50));
                } else {
                  // 备用方案：直接使用标准化位置（可能不够精确但能用）
                  console.warn('[SV-React] 位置映射失败，尝试直接截取...');
                  // 简单方法：从标准化位置附近向前找第一个非空白字符
                  var approxIndex = 0;
                  var charCount = 0;
                  for (var i = 0; i < text.length && charCount < normalizedKwIndex; i++) {
                    if (!/[\s\u00A0\u3000\t\r\n]/.test(text[i])) {
                      charCount++;
                    }
                    approxIndex = i;
                  }
                  
                  // 跳过前面的空白，找到真正的起始位置
                  while (approxIndex < text.length && /[\s\u00A0\u3000\t\r\n]/.test(text[approxIndex])) {
                    approxIndex++;
                  }
                  
                  kwIndex = approxIndex;
                  if (kwIndex < text.length) {
                    processedText = text.substring(kwIndex);
                    console.log('[SV-React] 使用近似位置 ' + kwIndex + ' 进行截取');
                  }
                }
              } else {
                console.warn('[SV-React] 截图' + (idx+1) + ' 左上角模式: 未找到关键字 [' + imgKeyword + ']（即使忽略空格也未找到）');
              }

            } else if (imgSearchPosition === 'bottomRight') {
              // 右下角模式：从后往前找
              var normalizedLastKwIndex = normalizedText.lastIndexOf(normalizedKeyword);

              if (normalizedLastKwIndex >= 0) {
                // 同样需要映射回原始位置（从后往前）
                var origIndexRev = text.length - 1;
                var normIndexRev = normalizedText.length - 1;

                while (origIndexRev >= 0 && normIndexRev >= normalizedLastKwIndex) {
                  // 跳过原始文本中的空白字符
                  while (origIndexRev >= 0 && /[\s\u00A0\u3000\t\r\n]/.test(text[origIndexRev])) {
                    origIndexRev--;
                  }

                  if (normIndexRev === normalizedLastKwIndex) {
                    kwIndex = origIndexRev;
                    break;
                  }

                  if (origIndexRev >= 0 && normIndexRev >= 0) {
                    origIndexRev--;
                    normIndexRev--;
                  } else {
                    break;
                  }
                }

                if (kwIndex >= 0) {
                  processedText = text.substring(kwIndex);
                  console.log('[SV-React] 截图' + (idx+1) + ' 右下角模式: 在原始位置 ' + kwIndex + ' 找到最后一个关键字 [' + imgKeyword + ']');
                } else {
                  // 备用方案
                  var charCountRev = 0;
                  var approxIndexRev = text.length;
                  for (var j = text.length - 1; j >= 0 && charCountRev < (normalizedText.length - normalizedLastKwIndex); j--) {
                    if (!/[\s\u00A0\u3000\t\r\n]/.test(text[j])) {
                      charCountRev++;
                    }
                    approxIndexRev = j;
                  }
                  
                  while (approxIndexRev < text.length && /[\s\u00A0\u3000\t\r\n]/.test(text[approxIndexRev])) {
                    approxIndexRev++;
                  }
                  
                  kwIndex = approxIndexRev;
                  if (kwIndex < text.length) {
                    processedText = text.substring(kwIndex);
                    console.log('[SV-React] 右下角使用近似位置 ' + kwIndex);
                  }
                }
              } else {
                console.warn('[SV-React] 截图' + (idx+1) + ' 右下角模式: 未找到关键字 [' + imgKeyword + ']');
              }
            }

            // 记录实际使用的参数
            setImages(function(prev) {
              return prev.map(function(im) {
                if (im.index === idx) {
                  return Object.assign({}, im, {
                    _actualKeyword: imgKeyword,
                    _normalizedKeyword: normalizedKeyword,
                    _keywordFound: kwIndex >= 0,
                    _keywordPosition: kwIndex
                  });
                }
                return im;
              });
            });

          } else {
            console.log('[SV-React] 截图' + (idx+1) + ' 关键字为空，使用原始文本');
          }

          // ✨ v2.1.7: 中文文本清洗 - 移除OCR产生的中文间空白（仅基础版，不过度处理）
          var cleanedChineseText = processedText.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
          var prevText = '';
          var maxIterations = 5;
          var iteration = 0;
          while (prevText !== cleanedChineseText && iteration < maxIterations) {
            prevText = cleanedChineseText;
            cleanedChineseText = cleanedChineseText.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
            iteration++;
          }
          
          if (cleanedChineseText !== processedText) {
            console.log('[SV-React] 🧹 中文文本清洗完成，移除了', (processedText.length - cleanedChineseText.length), '个字符的中文间空白');
            processedText = cleanedChineseText;
          }

          // ✨ 新增：表格空值标准化处理（防止Shift问题）
          function standardizeTableEmptyValues(text) {
            if (!text) return '';
            
            // 步骤1：将连续多个空格（2个及以上）替换为单个空格 + 特殊标记"␣"
            // 这样可以保留空值的位置信息，避免后续字段提取时Shift
            var standardized = text.replace(/ {2,}/g, ' ␣');  // ␣ 是Unicode空白符号U+2423
            
            // 步骤2：将行首/行尾的多余空格也标准化
            standardized = standardized.replace(/^ +| +$/gm, '');
            
            // 步骤3：将制表符转换为空格
            standardized = standardized.replace(/\t/g, ' ');
            
            console.log('[SV-React] 🔧 表格空值标准化完成');
            
            return standardized;
          }
          
          var preStandardizedText = processedText;
          var standardizedText = standardizeTableEmptyValues(preStandardizedText);
          
          if (standardizedText !== preStandardizedText) {
            console.log('[SV-React] ✅ 已应用表格空值标准化（使用␣标记空值位置）');
            processedText = standardizedText;
          }

          // ✨ v2.1.6: 严格预检测 - 判断文本是否符合规范模板特征
          var rawLines = processedText.split('\n').map(function(l) { return l.trim(); }).filter(function(l) { return l; });
          
          var normalizedForCheck = processedText.replace(/\s+/g, '');
          var hasBuySellKeywords = /买入|卖出|买出/.test(normalizedForCheck);
          var isEvenLines = rawLines.length % 2 === 0 && rawLines.length >= 2;
          var firstLineLooksLikeTradingRecord = false;
          if (rawLines.length > 0) {
            var firstLineTokens = rawLines[0].split(/\s+/);
            var hasChineseInFirstLine = firstLineTokens.some(function(t) { return /[\u4e00-\u9fa5]/.test(t); });
            var hasNumberInFirstLine = firstLineTokens.some(function(t) { return /^[\d,.]+$/.test(t); });
            var hasDirectionInFirstLine = firstLineTokens.some(function(t) { return /买|卖/.test(t); });
            var firstLineScore = 0;
            if (hasChineseInFirstLine) firstLineScore++;
            if (hasNumberInFirstLine) firstLineScore++;
            if (hasDirectionInFirstLine) firstLineScore++;
            firstLineLooksLikeTradingRecord = firstLineScore >= 2;
          }
          
          var secondLineLooksLikeTradingRecord = false;
          if (rawLines.length > 1) {
            var secondLineTokens = rawLines[1].split(/\s+/);
            var numbersInSecondLine = secondLineTokens.filter(function(t) { 
              return /^[\d,.]+$/.test(t) && parseFloat(t.replace(/,/g, '')) > 0; 
            });
            secondLineLooksLikeTradingRecord = numbersInSecondLine.length >= 2;
          }
          
          var lineCount = rawLines.length;
          var avgLineLength = rawLines.reduce(function(sum, line) { return sum + line.length; }, 0) / (lineCount || 1);
          
          var looksLikeTradingData = 
            hasBuySellKeywords && 
            isEvenLines && 
            firstLineLooksLikeTradingRecord && 
            secondLineLooksLikeTradingRecord &&
            lineCount <= 50 &&
            avgLineLength >= 5 && avgLineLength <= 80;

          console.log('[SV-React] 🔍 预检测结果:', looksLikeTradingData ? '✅ 交易数据' : '⚠️ 未规范数据(RAW_TEXT)');

          // ✨ 新增：股票清单模板预检测
          console.log('[SV-React] 📋 开始股票清单预检测...');
          var stockListKeywords = /股票代码|股票名称|截图用名称|单位|市场|类型|买入数量|卖出数量|结余数量/;
          var hasStockListHeader = stockListKeywords.test(normalizedForCheck);
          
          // 检查是否包含股票类型枚举值
          var hasStockTypeEnum = /tETF|tA|cA|cETF/.test(normalizedForCheck);
          
          // 检查是否包含市场枚举值
          var hasMarketEnum = /台股|陆股|美股|港股/.test(normalizedForCheck);
          
          // 检查典型行结构（单行多token）
          var typicalLineTokenCount = 0;
          if (rawLines.length > 2) {
            var sampleLines = rawLines.slice(1, Math.min(6, rawLines.length)); // 跳过可能的表头，取5行样本
            var validLineCount = sampleLines.filter(function(line) { 
              return line.split(/\s+/).filter(function(t) { return t; }).length >= 7; 
            }).length;
            typicalLineTokenCount = validLineCount;
          }
          
          // 综合判断是否为股票清单（✅ 关键修复：提高门槛，避免误判）
          var looksLikeStockList = false;
          if (!looksLikeTradingData) {
            // 只有在不是交易数据时才判断为股票清单
            var stockListScore = 0;
            if (hasStockListHeader) stockListScore += 3;  // 有表头关键词（强特征）
            if (hasStockTypeEnum) stockListScore += 3;    // ✅ 提高权重：有类型枚举值（强特征）
            if (hasMarketEnum) stockListScore += 1;       // 有市场枚举值
            if (typicalLineTokenCount >= Math.max(5, Math.floor(rawLines.length * 0.6))) stockListScore += 1; // ✅ 更严格：>=60%的行符合token数要求
            if (rawLines.length >= 8) stockListScore += 1; // ✅ 更严格：至少8行数据
            
            // ✅ 新增：必须同时具备表头或类型枚举 + 足够的数据量
            var hasStrongFeature = hasStockListHeader || hasStockTypeEnum;
            var hasEnoughData = typicalLineTokenCount >= 5 && rawLines.length >= 8;
            
            // ✅ 最终判断：(有强特征且足够数据) 且 总分>=5
            looksLikeStockList = hasStrongFeature && hasEnoughData && (stockListScore >= 5);
            
            console.log('[SV-React] 📋 股票清单严格检测:', 
              '- 强特征:', hasStrongFeature, 
              '(表头:', hasStockListHeader, ', 类型枚举:', hasStockTypeEnum, ')',
              '- 足够数据:', hasEnoughData,
              '(符合token数行数:', typicalLineTokenCount, ', 总行数:', rawLines.length, ')',
              '- 总分:', stockListScore, '/7',
              '- 最终结果:', looksLikeStockList ? '✅ STOCK_LIST' : '❌ 非STOCK_LIST');
          }
          
          console.log('[SV-React] 📋 股票清单检测结果:', 
            looksLikeStockList ? '✅ 股票清单' : '❌ 非股票清单',
            '- 表头:', hasStockListHeader,
            '- 类型枚举:', hasStockTypeEnum,
            '- 市场枚举:', hasMarketEnum,
            '- 典型行token数>=7的行数:', typicalLineTokenCount);

          // 对过滤后的文本进行字段提取（按 TRADE_SCHEMA 结构化）
          var extractedRecords = [];
          
          if (!looksLikeTradingData) {
            // ✅ RAW_TEXT模式：不进行字段提取
            console.log('[SV-React] ⚠️ 使用RAW_TEXT模式，跳过字段提取');
            extractedRecords.push({
              recordIndex: 0,
              lineNumbers: Array.from({ length: rawLines.length }, function(_, i) { return i + 1; }),
              originalLines: rawLines.slice(),
              mergedText: processedText,
              fields: { _rawText: processedText },
              isValid: true,
              isRawText: true
            });
          } else if (looksLikeStockList) {
            // ✨ 新增：使用STOCK_LIST_SCHEMA提取字段（股票清单模式）
            console.log('[SV-React] 📋 使用STOCK_LIST模式，开始提取股票清单字段...');
            
            var stockListRecords = [];
            for (var si = 0; si < rawLines.length; si++) {
              var stockLine = rawLines[si];
              
              // 跳过表头行
              if (/股票代码|股票名称|截图用名称|单位|市场|类型|买入数量|卖出数量|结余数量/.test(stockLine)) {
                console.log('[SV-React]   跳过表头行:', stockLine.substring(0, 30));
                continue;
              }
              
              // 分割token
              var stockTokens = stockLine.split(/\s+/).filter(function(t) { return t; });
              
              // 至少需要7个token才可能是有效记录
              if (stockTokens.length < 7) {
                console.log('[SV-React]   跳过无效行（token数不足）:', stockLine.substring(0, 30), '- Token数:', stockTokens.length);
                continue;
              }
              
              // 智能字段提取（基于位置+特征）
              var stockFields = {};
              
              // ✅ 辅助函数：判断是否为空值标记
              function isEmptyMarker(token) {
                if (!token) return true;
                var trimmed = token.trim();
                return trimmed === '-' || 
                       trimmed === '—' || 
                       trimmed === '␣' ||  // Unicode空白符号（空值标准化标记）
                       trimmed === '' ||
                       /^\s*$/.test(trimmed);  // 纯空格/空白
              }
              
              // 字段1: 股票代码（第1个token，可能是"-"或数字）
              stockFields['股票代码'] = isEmptyMarker(stockTokens[0]) ? '' : stockTokens[0];
              
              // 字段2: 股票名称（第2个token，中文）
              stockFields['股票名称'] = isEmptyMarker(stockTokens[1]) ? '' : stockTokens[1];
              
              // 字段3: 截图用名称（第3个token）
              stockFields['截图用名称'] = isEmptyMarker(stockTokens[2]) ? '' : stockTokens[2];
              
              // 字段4-9: 后续字段（根据特征识别）
              var remainingTokens = stockTokens.slice(3);
              var numericIndex = 0;
              
              for (var ri2 = 0; ri2 < remainingTokens.length && ri2 < 6; ri2++) {
                var token = remainingTokens[ri2];
                
                // 识别市场
                if (/台股|陆股|美股|港股/.test(token)) {
                  stockFields['市场'] = token;
                  continue;
                }
                
                // 识别类型
                if (/tA|cA|tETF|cETF/.test(token)) {
                  stockFields['类型'] = token;
                  continue;
                }
                
                // 数字字段（按顺序：单位→买入数量→卖出数量→结余数量）
                if (/^[\d,.]+$/.test(token)) {
                  numericIndex++;
                  switch(numericIndex) {
                    case 1: stockFields['单位'] = token; break;
                    case 2: stockFields['买入数量'] = token; break;
                    case 3: stockFields['卖出数量'] = token; break;
                    case 4: stockFields['结余数量'] = token; break;
                    default: break;
                  }
                }
              }
              
              // 验证必要字段
              if (stockFields['股票名称']) {
                stockListRecords.push({
                  recordIndex: stockListRecords.length,
                  lineNumbers: [si + 1],
                  originalText: stockLine,
                  fields: stockFields,
                  isValid: true,
                  isStockList: true
                });
                
                console.log('[SV-React]   ✓ 提取到股票清单记录 #', stockListRecords.length, ':', 
                  stockFields['股票代码'] || '-', stockFields['股票名称'],
                  '- 类型:', stockFields['类型'], '- 买入:', stockFields['买入数量']);
              }
            }
            
            extractedRecords = stockListRecords;
            console.log('[SV-React] 📋 股票清单提取完成，共', extractedRecords.length, '条记录');
            
          } else {
            // ✅ 规范数据：使用TRADE_SCHEMA提取字段
            var linesPerRecord = TRADE_SCHEMA.linesPerRecord || 2;

            for (var ri = 0; ri < rawLines.length; ri += linesPerRecord) {
            var recordLines = rawLines.slice(ri, ri + linesPerRecord);
            if (recordLines.length < linesPerRecord) break;  // 不完整的记录跳过

            // 合并所有行的文本（用于Token分析）
            var mergedText = recordLines.join(' ');

            // ✅ 智能字段提取算法（基于内容特征识别，而非固定position）
            var extractedFields = {};
            
            // ===== 优先提取第2行（line 1）：获取股票代码（用于后续名称矫正） =====
            var extractedStockCode = '';  // 暂存提取到的股票代码
            
            console.log('[SV-React] 📝 开始提取第', ri, '条记录的字段...');
            console.log('[SV-React]   第2行数据:', recordLines[1] || '(不存在)');
            
            if (recordLines[1]) {
              var line1Tokens = recordLines[1].split(/\s+/).filter(function(t) { return t; });
              console.log('[SV-React]   第2行Token分割:', line1Tokens);
              
              // 收集该行所有数字token（按出现顺序）
              var numTokens = [];
              for (var nti = 0; nti < line1Tokens.length; nti++) {
                if (/^[\d,.]+$/.test(line1Tokens[nti])) {
                  numTokens.push(line1Tokens[nti]);
                }
              }
              
              console.log('[SV-React]   提取到数字token:', numTokens);
              
              // 按顺序分配：股号→数量→成交额
              if (numTokens.length > 0) {
                extractedFields['股号'] = numTokens[0];
                extractedStockCode = numTokens[0];  // ✅ 保存到变量，供名称矫正使用
                console.log('[SV-React]   ✅ 提取到股票代码:', extractedStockCode);
              } else {
                console.warn('[SV-React]   ⚠️ 第2行未找到数字token！');
              }
              if (numTokens.length > 1) extractedFields['数量'] = parseFloat(numTokens[1].replace(/,/g, '')) || 0;
              if (numTokens.length > 2) extractedFields['成交额'] = parseFloat(numTokens[2].replace(/,/g, '')) || 0;
            } else {
              console.warn('[SV-React]   ❌ 第2行不存在！无法提取股票代码');
            }
            
            // ===== 然后提取第1行（line 0）：名称/价格/方向（此时已有股票代码可参考） =====
            if (recordLines[0]) {
              var line0Tokens = recordLines[0].split(/\s+/).filter(function(t) { return t; });
              
              // 1️⃣ 名称：从开头连续取所有非数字token（中文/英文/字母组合）
              var nameParts = [];
              var nameTokenCount = 0;
              for (var ni = 0; ni < line0Tokens.length; ni++) {
                if (/^[\d,.]+$/.test(line0Tokens[ni])) break;  // 遇到数字停止
                nameParts.push(line0Tokens[ni]);
                nameTokenCount++;
              }
              var rawOCRName = nameParts.join('');
              
              console.log('[SV-React]   第1行提取到原始名称:', rawOCRName);
              console.log('[SV-React]   将传入矫正函数的参数:', { ocrName: rawOCRName, stockCode: extractedStockCode });
              
              // ✅ 智能名称矫正（增强版 - 传入股票代码进行精确匹配）
              var correctionResult = correctStockName(rawOCRName, extractedStockCode);
              
              console.log('[SV-React]   矫正结果:', {
                isCorrected: correctionResult.isCorrected,
                correctedName: correctionResult.correctedName,
                method: correctionResult.correctionMethod
              });
              
              extractedFields['名称'] = correctionResult.correctedName;
              
              // ✅ 区分：真正矫正 vs 已验证正确
              if (correctionResult.isCorrected) {
                // 真正进行了矫正（OCR有误）
                console.log('[SV-React] 🎯 名称已矫正:', 
                  '原始="' + rawOCRName + '"', 
                  '→ 矫正="' + correctionResult.correctedName + '"',
                  '方法=' + (correctionResult.correctionMethod || 'UNKNOWN'),
                  correctionResult.matchedStock ? '(匹配到: ' + correctionResult.matchedStock.name + ')' : ''
                );
                extractedFields['_nameCorrection'] = correctionResult;  // 存储矫正详情（用于UI显示）
              } else if (correctionResult.matchedStock) {
                // OCR已正确，只是验证通过
                console.log('[SV-React] ✓ 名称验证通过:', 
                  '"' + rawOCRName + '"',
                  '与数据库一致',
                  '(方法: ' + (correctionResult.correctionMethod || 'UNKNOWN') + ')'
                );
                // 不存储 _nameCorrection，UI会显示简洁样式
              }
              
              // 2️⃣ 价格：名称之后的第一个数字token
              for (var pri = nameTokenCount; pri < line0Tokens.length; pri++) {
                if (/^[\d,.]+$/.test(line0Tokens[pri])) {
                  extractedFields['价格'] = parseFloat(line0Tokens[pri].replace(/,/g, '')) || 0;
                  break;
                }
              }
              
              // 3️⃣ 方向：查找包含"买"或"卖"的token（可能需要合并如"买"+"入"）
              var dirParts = [];
              for (var dri = 0; dri < line0Tokens.length; dri++) {
                var token = line0Tokens[dri];
                if (token.indexOf('买') >= 0 || token.indexOf('卖') >= 0) {
                  dirParts.push(token);
                  // 检查下一个token是否为补语（入/出）
                  if (dri + 1 < line0Tokens.length) {
                    var nextToken = line0Tokens[dri + 1];
                    if (nextToken === '入' || nextToken === '出') {
                      dirParts.push(nextToken);
                    }
                  }
                  break;
                }
              }
              extractedFields['方向'] = dirParts.join('');
            }

            extractedRecords.push({
              recordIndex: Math.floor(ri / linesPerRecord),
              lineNumbers: Array.from({ length: recordLines.length }, function(_, i) { return ri + i + 1; }),
              originalLines: recordLines.slice(),  // 保留原始行
              mergedText: mergedText,             // 合并文本
              fields: extractedFields,           // 提取的字段值
              isValid: Object.keys(extractedFields).length > 0  // 是否有效
            });
          }
          }  // ✅ 结束 else 分支（规范数据模式）

          // 保留旧的 cleanedLines 数据（用于向后兼容和详细查看）
          var cleanedLines = [];
          for (var cli = 0; cli < rawLines.length; cli++) {
            var cline = rawLines[cli];
            var ctokens = cline.split(/\s+/).filter(function(t){return t;});
            var cnameParts = [];
            for (var cti = 0; cti < ctokens.length; cti++) {
              if (/^[\d,.]+$/.test(ctokens[cti])) break;
              cnameParts.push(ctokens[cti]);
            }
            var ccleanedName = cnameParts.join('');
            var ccleanedLine = cline.replace(/\s+/g, '');

            cleanedLines.push({
              original: cline,
              cleaned: ccleanedLine,
              nameExtracted: ccleanedName,
              tokens: ctokens
            });
          }

          // ✅ 保存到历史记录（包含结构化的字段提取结果）- 支持多截图
          setTabHistory(function(prev) {
            return Object.assign({}, prev, {
              tab4_cleaned: (prev.tab4_cleaned || []).concat([{
                type: 'cleaned',
                imageIndex: idx,
                imageName: img.name,
                originalText: text || '',                    // 原始OCR文本
                processedText: processedText,                 // 关键字过滤后的文本
                keyword: imgKeyword,                         // 使用的关键字
                searchPosition: imgSearchPosition,           // 搜索位置
                
                // ✅ 新增：结构化字段提取结果
                extractedRecords: extractedRecords,          // 按记录分组
                totalRecords: extractedRecords.length,        // 总记录数
                schemaFields: TRADE_SCHEMA.fields.map(function(f) { return f.name; }),  // 字段名列表
                linesPerRecord: linesPerRecord,               // 每条记录占几行
                
                // 保留旧数据（用于详细调试）
                cleanedLines: cleanedLines,
                timestamp: new Date().toLocaleTimeString(),
                sourceCode: 'ocrEngine.js (OCR识别) → 文本预处理 (关键字过滤+智能匹配) → TRADE_SCHEMA (结构化字段提取) → correctStockName (智能名称矫正)'
              }])
            });
          });

          // ✅ 修复：直接从 extractedRecords 转换为表格数据（不再使用旧的 parser.parse）
          var parsedResult = extractedRecords.filter(function(rec) {
            return rec.isValid;
          }).map(function(rec) {
            return rec.fields;  // 直接返回字段对象
          });
          console.log('[SV-React] 解析完成，记录数:', parsedResult.length, '(来自智能提取算法)');
          
          // ✨ 新功能：模板识别系统 - 基于 TRADE_SCHEMA 的 required 属性判断
          var TEMPLATE_NAME = '光大证券金阳光';
          
          // 从 schema 中动态获取所有必填字段（required: true）
          var REQUIRED_FIELDS = TRADE_SCHEMA.fields
            .filter(function(fieldDef) { return fieldDef.required; })
            .map(function(fieldDef) { return fieldDef.name; });
          
          var totalRequiredFields = REQUIRED_FIELDS.length;
          
          console.log('[SV-React] 📋 Schema必填字段定义:', 
            REQUIRED_FIELDS.join(', '), 
            '(共', totalRequiredFields, '个)');
          
          var isTemplateMatch = false;
          var templateName = '未被规范的数据';
          var matchDetails = { validRecords: 0, totalFields: 0, missingFields: [], requiredTotal: totalRequiredFields };
          
          // ✅ 关键修复：RAW_TEXT模式强制不匹配任何模板
          if (!looksLikeTradingData) {
            console.log('[SV-React] ⚠️ RAW_TEXT模式 - 强制设置isTemplateMatch=false');
            isTemplateMatch = false;
            templateName = '原始文本';
            matchDetails.isRawTextMode = true;
          } else if (parsedResult.length > 0 && extractedRecords.length > 0) {
            // 检查第一条有效记录是否包含所有必需字段
            var firstValidRecord = extractedRecords.find(function(rec) { return rec.isValid; });
            
            if (firstValidRecord && firstValidRecord.fields) {
              var fields = firstValidRecord.fields;
              var validFieldCount = 0;
              var missing = [];
              
              for (var fi = 0; fi < REQUIRED_FIELDS.length; fi++) {
                var fieldName = REQUIRED_FIELDS[fi];
                var value = fields[fieldName];
                var fieldDef = TRADE_SCHEMA.fields.find(function(f) { return f.name === fieldName; });
                
                // 检查字段值是否存在且有效
                var isValidValue = false;
                
                if (value !== undefined && value !== null && value !== '') {
                  // 对于枚举类型字段（如方向），检查值是否在允许范围内
                  if (fieldDef && fieldDef.enumValues && fieldDef.enumValues.length > 0) {
                    isValidValue = fieldDef.enumValues.indexOf(value) >= 0;
                    
                    if (!isValidValue) {
                      console.warn('[SV-React] ⚠️ 字段 "' + fieldName + '" 值不在允许范围内:', 
                        value, '(应为:', fieldDef.enumValues.join('/'), ')');
                    }
                  } else {
                    // 数字类型：只要有值就有效（包括0）
                    isValidValue = true;
                  }
                }
                
                if (isValidValue) {
                  validFieldCount++;
                } else {
                  missing.push(fieldName);
                }
              }
              
              matchDetails.validRecords = parsedResult.length;
              matchDetails.totalFields = validFieldCount;
              matchDetails.missingFields = missing;
              
              // 判断：所有必填字段都齐全才算是模板匹配
              if (validFieldCount === totalRequiredFields) {
                isTemplateMatch = true;
                templateName = TEMPLATE_NAME;
              } else if (validFieldCount >= Math.ceil(totalRequiredFields * 0.7)) {
                // 至少70%的字段：部分匹配
                templateName = TEMPLATE_NAME + ' (部分匹配)';
              }
            }
          }
          
          console.log('[SV-React] 📋 模板识别结果:', 
            isTemplateMatch ? '✅ 匹配' : '❌ 不匹配',
            '- 模板名:', templateName,
            '- 有效记录:', matchDetails.validRecords,
            '- 字段完整度:', matchDetails.totalFields + '/' + matchDetails.requiredTotal,
            matchDetails.missingFields.length > 0 ? '- 缺失字段: [' + matchDetails.missingFields.join(', ') + ']' : ''
          );

          setImages(function(prev) {
            return prev.map(function(im) {
              if (im.index === idx) {
                return Object.assign({}, im, {
                  ocrDone: true,
                  ocrText: text || '',
                  parsedData: parsedResult,
                  // ✨ 新增：模板识别结果
                  templateName: templateName,
                  isTemplateMatch: isTemplateMatch,
                  templateMatchDetails: matchDetails,
                  // ✅ 关键修复：设置模板ID用于"最终结果"页签渲染（支持3种模板）
                  templateId: (looksLikeTradingData && isTemplateMatch) ? 'TRADE' : (looksLikeStockList ? 'STOCK_LIST' : 'RAW_TEXT')
                });
              }
              return im;
            });
          });
          
          // ✅ 关键修复：更新当前模板ID状态（用于renderTabContent判断，支持3种模板）
          var finalTemplateId = (looksLikeTradingData && isTemplateMatch) ? 'TRADE' : (looksLikeStockList ? 'STOCK_LIST' : 'RAW_TEXT');
          setCurrentTemplateIdState(finalTemplateId);
          console.log('[SV-React] 🎯 已设置currentTemplateIdState:', finalTemplateId);

          setStatus({
            message: '\u2705 截图 ' + (idx + 1) + ' 解析完成！共 ' + parsedResult.length + ' 条记录',
            isOk: true
          });

          setTabHistory(function(prev) {
            return Object.assign({}, prev, {
              tab5_parsed: (prev.tab5_parsed || []).concat([{
                type: 'parsed',
                imageIndex: idx,
                imageName: img.name,
                data: parsedResult,
                originalText: text || '',
                // ✅ 关键修复：添加清洗后的文本（用于RAW_TEXT模式显示）
                processedText: processedText || '',
                timestamp: new Date().toLocaleTimeString(),
                // ✨ 新增：模板识别结果（用于决定显示方式）
                isTemplateMatch: isTemplateMatch,
                templateName: templateName,
                templateMatchDetails: matchDetails
              }])
            });
          });
        } else {
          setImages(function(prev) {
            return prev.map(function(im) {
              if (im.index === idx) {
                return Object.assign({}, im, {
                  ocrDone: true,
                  ocrText: '',
                  parsedData: []
                });
              }
              return im;
            });
          });
        }

        setTimeout(function() {
          rebuildDataFromImages();
          setActiveTab(0);
          triggerForceUpdate(function(v) { return v + 1; });
        }, 150);

      } catch(err) {
        console.error('[SV-React] OCR error:', err);

        setImages(function(prev) {
          return prev.map(function(im) {
            if (im.index === idx) {
              return Object.assign({}, im, { ocrDone: true, parsedData: [] });
            }
            return im;
          });
        });

        setTimeout(function() {
          rebuildDataFromImages();
          setActiveTab(0);
          triggerForceUpdate(function(v) { return v + 1; });
        }, 150);
      }
    }

    // 从 imagesRef 重建 allData
    function rebuildDataFromImages() {
      var currentImages = imagesRef.current;
      console.log('[SV-React] rebuildDataFromImages - 当前图片数:', currentImages.length);

      var all = [];
      currentImages.forEach(function(img) {
        console.log('[SV-React]   图片', img.index, '- ocrDone:', img.ocrDone, '- 记录数:', (img.parsedData || []).length);

        if (img.parsedData && img.parsedData.length > 0) {
          img.parsedData.forEach(function(r) {
            // ✅ 调试日志：检查数据结构
            console.log('[SV-React]     记录详情:', 
              '- hasFields:', !!r.fields,
              '- isStockList:', r.isStockList,
              '- keys:', Object.keys(r).join(','));
            
            if (r.fields) {
              console.log('[SV-React]       fields:', JSON.stringify(r.fields));
            }
            
            all.push(Object.assign({}, r));
          });
        }
      });

      all = deduplicateData(all);
      setAllData(all);

      console.log('[SV-React] 数据已重建，共', all.length, '条记录');
    }

    // 去重
    function deduplicateData(data) {
      var seen = {};
      var result = [];

      data.forEach(function(r) {
        var key = [
          r['名称'], r['股号'], r['价格'],
          r['数量'], r['方向'], r['成交额']
        ].join('|');

        if (!seen[key]) {
          seen[key] = true;
          result.push(r);
        }
      });

      return result;
    }

    // 渲染主内容
    var showResult = allData.length > 0;
    var hasImages = images.length > 0;
    var hasOcrData = Array.isArray(tabHistory.tab3_ocr) && tabHistory.tab3_ocr.length > 0;
    var hasCleanedData = Array.isArray(tabHistory.tab4_cleaned) && tabHistory.tab4_cleaned.length > 0;
    var hasParsedData = Array.isArray(tabHistory.tab5_parsed) && tabHistory.tab5_parsed.length > 0;
    var hasTableGrid = images.some(function(img) { return img.tableGrid; });

    var tabs = [
      {
        icon: '\uD83D\uDCCA',
        label: '最终结果',
        hasContent: showResult,
        activeBg: '#ffffff',
        activeColor: '#1f2937',
        borderColor: '#10b981'
      },
      {
        icon: '\uD83D\uDDBC',
        label: '截图文件',
        hasContent: hasImages,
        activeBg: '#fce7f3',
        activeColor: '#9d174d',
        borderColor: '#ec4899'
      },
      {
        icon: '\uD83D\uDCDD',
        label: 'OCR原始文本',
        hasContent: hasOcrData,
        activeBg: '#fef3c7',
        activeColor: '#92400e',
        borderColor: '#f59e0b'
      },
      {
        icon: '\uD83D\uDCDC',
        label: '文本预处理',
        hasContent: hasCleanedData,
        activeBg: '#dbeafe',
        activeColor: '#1e40af',
        borderColor: '#3b82f6'
      },
      {
        icon: '\uD83D\uDCCA',
        label: '解析结果',
        hasContent: hasParsedData,
        activeBg: '#d1fae5',
        activeColor: '#065f46',
        borderColor: '#10b981'
      },
      {
        icon: '\uD83E\uDDEE',
        label: '表格结果',
        hasContent: hasTableGrid,
        activeBg: '#ede9fe',
        activeColor: '#6d28d9',
        borderColor: '#8b5cf6'
      }
    ];

    function renderTabContent() {
      switch (activeTab) {
        case 0:
          // ✅ 关键修复：根据模板ID决定显示组件（支持3种模板）
          if (!showResult) return createElement(EmptyHint);
          
          // 判断当前模板模式
          var isRawTextMode = currentTemplateIdState === 'RAW_TEXT';
          var isStockListMode = currentTemplateIdState === 'STOCK_LIST';
          console.log('[SV-React] 📊 最终结果页签 - 当前模板:', currentTemplateIdState, 
            ', RAW_TEXT:', isRawTextMode, ', STOCK_LIST:', isStockListMode);
          
          if (isRawTextMode) {
            // ✅ RAW_TEXT模式：使用原始文本显示组件（清洗后的数据，无空格）
            return createElement(RawTextDisplay, { data: allData, images: images });
          } else if (isStockListMode) {
            // ✅ STOCK_LIST模式：使用股票清单专用表格显示
            return createElement(StockListDataTable, { data: allData });
          } else {
            // ✅ TRADE模式：使用结构化表格显示
            return createElement(DataTable, { data: allData });
          }
        case 1:
          return createElement(ImagePreviewPanel, { images: images });
        case 2:
          // ✅ OCR原始文本 - 显示所有截图的结果
          var ocrResults = (tabHistory.tab3_ocr || []);
          if (ocrResults.length === 0) return createElement(EmptyHint);
          
          return createElement('div', { style: { maxHeight: '100%', overflowY: 'auto', padding: '12px' } },
            ocrResults.map(function(ocrResult, idx) {
              return createElement('div', { key: idx, style: { marginBottom: idx < ocrResults.length - 1 ? '24px' : '0' } },
                createElement(IntermediateResultPanel, { result: ocrResult })
              );
            })
          );
        case 3:
          // ✅ 文本预处理 - 显示所有截图的结果
          var cleanedResults = (tabHistory.tab4_cleaned || []);
          if (cleanedResults.length === 0) return createElement(EmptyHint);
          
          return createElement('div', { style: { maxHeight: '100%', overflowY: 'auto', padding: '12px' } },
            cleanedResults.map(function(cleanedResult, idx) {
              return createElement('div', { key: idx, style: { marginBottom: idx < cleanedResults.length - 1 ? '24px' : '0' } },
                createElement(IntermediateResultPanel, { result: cleanedResult })
              );
            })
          );
        case 4:
          // ✅ 解析结果 - 根据模板ID决定显示组件（支持3种独立模式）
          var parsedResults = (tabHistory.tab5_parsed || []);
          if (parsedResults.length === 0) return createElement(EmptyHint);
          
          return createElement('div', { style: { maxHeight: '100%', overflowY: 'auto', padding: '12px' } },
            parsedResults.map(function(parsedResult, idx) {
              // ✅ 关键修复：根据templateId选择专用的显示组件
              console.log('[SV-React] 📊 解析结果页签 - 记录#', idx, 
                'templateId:', parsedResult.templateId,
                'isTemplateMatch:', parsedResult.isTemplateMatch);
              
              if (parsedResult.templateId === 'STOCK_LIST') {
                // ✅ STOCK_LIST模式：使用股票清单专用解析结果组件
                return createElement(StockListParsedDisplay, { key: idx, data: parsedResult });
                
              } else if (parsedResult.templateId === 'TRADE') {
                // ✅ TRADE模式：使用交易记录专用解析结果组件
                return createElement(TradeParsedDisplay, { key: idx, data: parsedResult });
                
              } else {
                // ❌ RAW_TEXT模式：使用原始文本显示组件
                
                // 基础中文文本清洗（仅移除中文字符间的空白）
                function cleanChineseTextForDisplay(text) {
                  if (!text) return '';
                  var cleaned = text.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
                  var prevText = '';
                  var maxIterations = 5;
                  var iteration = 0;
                  while (prevText !== cleaned && iteration < maxIterations) {
                    prevText = cleaned;
                    cleaned = cleaned.replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2');
                    iteration++;
                  }
                  return cleaned;
                }
                
                var displayTextForParsed = cleanChineseTextForDisplay(parsedResult.processedText || parsedResult.originalText || '');
                
                return createElement('div', { key: idx, style: { 
                  marginBottom: idx < parsedResults.length - 1 ? '24px' : '0',
                  background: '#fef2f2',
                  border: '2px solid #ef4444',
                  borderRadius: '8px',
                  padding: '16px'
                }},
                  createElement('div', { 
                    style: { 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #fecaca'
                    }
                  },
                    createElement('div', null,
                      createElement('span', { 
                        style: { 
                          fontSize: '14px', 
                          fontWeight: 700, 
                          color: '#991b1b',
                          marginRight: '8px'
                        }}, '❌'),
                      createElement('span', { 
                        style: { fontSize: '14px', fontWeight: 600, color: '#dc2626' }
                      }, '未被规范的数据 - 清洗后的原始文本')
                    ),
                    createElement('span', {
                      style: {
                        fontSize: '11px',
                        color: '#6b7280',
                        background: '#fee2e2',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }
                    }, parsedResult.templateName || '未识别')
                  ),
                  
                  createElement('div', {
                    style: { fontSize: '12px', color: '#6b7280', marginBottom: '8px' }
                  },
                    createElement('strong', null, '📷 图片名称: '),
                    parsedResult.imageName,
                    createElement('br'),
                    createElement('strong', null, '⏰ 处理时间: '),
                    parsedResult.timestamp
                  ),
                  
                  createElement('div', null,
                    createElement('div', {
                      style: { 
                        fontSize: '12px', 
                        fontWeight: 600, 
                        color: '#374151',
                        marginBottom: '6px'
                      }
                    }, '📄 清洗后的原始文本 (共 ' + displayTextForParsed.length + ' 字):'),
                    createElement('pre', {
                      style: {
                        background: '#ffffff',
                        border: '1px solid #e5e7eb',
                        borderRadius: '6px',
                        padding: '12px',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        lineHeight: '1.6',
                        maxHeight: '400px',
                        overflow: 'auto',
                        whiteSpace: 'pre-wrap',
                        wordWrap: 'break-word',
                        color: '#1f2937'
                      }
                    }, displayTextForParsed || '(无文本数据)')
                  ),
                  
                  createElement('div', {
                    style: {
                      marginTop: '12px',
                      padding: '10px',
                      background: '#ede9fe',
                      border: '1px solid #c4b5fd',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#5b21b6'
                    }
                  },
                    createElement('strong', null, '💡 提示: '),
                    '此截图无法按照任何已知模板进行结构化解析。',
                    createElement('br'),
                    '上方显示的是经过清洗处理的文本（已移除OCR产生的中文间空白）。',
                    createElement('br'),
                    '可能原因：截图格式非标准、OCR识别误差过大、或缺少关键字段。'
                  )
                );
              }
            })
          );
        case 5:
          var gridImage = images.find(function(img) { return img.tableGrid; });
          if (!gridImage || !gridImage.tableGrid) return createElement(EmptyHint);
          return createElement(TableGridDisplay, { grid: gridImage.tableGrid, onCopyJson: _svPluginReact.copyTableJson.bind(_svPluginReact), onViewJson: _svPluginReact.viewTableJson.bind(_svPluginReact) });
        default:
          return createElement(EmptyHint);
      }
    }

    return createElement('div', {
      id: 'svContainer',
      style: {
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#f9fafb'
      }
    },
      createElement(Toolbar, {
        images: images,
        onAdd: handleAdd,
        onParse: handleParse,
        onTableExtract: handleTableExtract,
        onClearAll: handleClearAll,
        onUpdateImage: handleUpdateImage,
        geminiApiKey: geminiApiKeyState,
        onGeminiKeyChange: function(key) { setGeminiApiKey(key); },
        aiProvider: aiProviderState,
        onAiProviderChange: function(p) {
          setAiProvider(p);
          try { localStorage.setItem('sv_ai_provider', p); } catch(e){}
        },
        tablePrompt: tablePromptState,
        onTablePromptChange: setTablePrompt
      }),

      createElement(StatusMessage, { status: status }),

      createElement(TabBar, {
        activeTab: activeTab,
        onTabChange: setActiveTab,
        tabs: tabs
      }),

      createElement('div', {
        style: {
          flex: 1,
          minHeight: 0,
          overflow: 'auto',
          padding: '16px',
          background: activeTab === 0 ? '#f9fafb' : (tabs[activeTab] && tabs[activeTab].activeBg) || '#ffffff'
        }
      }, renderTabContent())
    );
  }

  // ===== 插件主类（桥接层）=====
  function ScreenshotVerifyPluginReact() {
    this.reactRoot = null;
    this.containerId = null;
    this.container = null;
  }

 ScreenshotVerifyPluginReact.prototype.openVerifyWindow = async function(market) {
    try {
      var scm = window.stockCodeManager;
      if (scm && typeof scm.getStockList === 'function') {
        await scm.getStockList();
        if (typeof scm._getStockListSync === 'function') {
          _svStocks = scm._getStockListSync();
          console.log('[SV-React] ✅ stockManager 加载', (_svStocks||[]).length, '只股票');
        }
      }
    } catch(e) { console.warn('[SV-React] 加载失败:', e); }

    var self = this;

    try {
      // 清理旧实例
      if (this.container) {
        this.close();
      }

      // 创建新容器
      this.containerId = 'sv-react-root-' + Date.now();
      var container = document.createElement('div');
      container.id = this.containerId;
      container.style.position = 'fixed';
      container.style.top = '0';
      container.style.left = '0';
      container.style.zIndex = '999998';
      document.body.appendChild(container);
      this.container = container;

      // 检查依赖
      if (!ReactDOM) throw new Error('ReactDOM 未定义');
      if (!FloatingWindowReact) throw new Error('FloatingWindowReact 未定义');

      // 创建 React Root 并渲染
      var root = ReactDOM.createRoot(container);
      this.reactRoot = root;

      root.render(
        createElement(FloatingWindowReact, {
          title: (market || '未知市场') + ' - 截图对账',
          sourceFile: 'screenshotVerifyPluginReact.js',
          width: '720px',
          height: '700px',
          draggable: false,
          closeAnimation: 'fade',
          onClose: function() { self.close(); }
        },
          createElement(ErrorBoundary, null,
            createElement(ScreenshotVerifyApp, { market: market })
          )
        )
      );

      console.log('[SV-React] 截图对账窗口已打开，市场:', market);

    } catch(err) {
      console.error('[SV-React] 打开窗口失败:', err.message);
      alert('❌ 打开截图对账窗口失败！\n\n错误信息: ' + err.message);
    }
  };
  
  ScreenshotVerifyPluginReact.prototype.close = function() {
    console.log('[SV-React] 关闭截图对账窗口');
    
    if (this.reactRoot) {
      try {
        this.reactRoot.unmount();
      } catch(e) {
        console.error('[SV-React] 卸载组件失败:', e);
      }
      this.reactRoot = null;
    }
    
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
      this.container = null;
    }
    this.containerId = null;
  };

  ScreenshotVerifyPluginReact.prototype.copyTableJson = function() {
    if (!_svLastGridJson) {
      alert('没有可复制的 JSON 数据，请先执行表格提取');
      return;
    }
    var self = this;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(_svLastGridJson).then(function() {
        alert('✅ JSON 已复制到剪贴板！');
      }, function() {
        self._fallbackCopyJson(_svLastGridJson);
      });
    } else {
      this._fallbackCopyJson(_svLastGridJson);
    }
  };

  ScreenshotVerifyPluginReact.prototype.viewTableJson = function() {
    if (!_svLastGridJson) {
      alert('没有可查看的 JSON 数据，请先执行表格提取');
      return;
    }
    var maxShow = 3000;
    var showStr = _svLastGridJson;
    if (showStr.length > maxShow) {
      showStr = showStr.substring(0, maxShow) + '\n\n... (截断，总长度 ' + _svLastGridJson.length + ' 字符，请用复制JSON功能获取完整数据)';
    }
    alert(showStr);
  };

  ScreenshotVerifyPluginReact.prototype._fallbackCopyJson = function(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      alert('✅ JSON 已复制到剪贴板！');
    } catch (e) {
      alert('请手动复制以下 JSON:\n\n' + text.substring(0, 500));
    }
    document.body.removeChild(ta);
  };

  // ===== 注册到全局 =====
  window.ScreenshotVerifyPluginReact = ScreenshotVerifyPluginReact;
  window._svPluginReact = new ScreenshotVerifyPluginReact();

  console.log('[SV-React] ========================================');
  console.log('[SV-React] 截图对账插件已加载（Pure React 版本）');
  console.log('[SV-React] React 版本:', React.version);
  console.log('[SV-React] ReactDOM 版本:', ReactDOM.version);
  console.log('[SV-React] 架构：完全 React（FloatingWindowReact + Hooks）');
  console.log('[SV-React] ========================================');

})();
