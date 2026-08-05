// 调试 AI 截图解析插件的设置窗口
console.log('🔍 === 开始调试 AI 解析插件设置窗口 ===');

function debugAISettings() {
  console.log('📋 [调试] 检查 AI 插件相关对象...');
  
  // 1. 检查 React
  console.log('📦 [调试] React:', typeof React);
  console.log('📦 [调试] ReactDOM:', typeof ReactDOM);
  
  // 2. 检查 FloatingWindowReact
  console.log('📦 [调试] FloatingWindowReact:', typeof FloatingWindowReact);
  
  // 3. 检查主插件
  console.log('📦 [调试] window.AIScreenshotParserPlugin:', typeof window.AIScreenshotParserPlugin);
  if (window.AIScreenshotParserPlugin) {
    console.log('📦 [调试] AIScreenshotParserPlugin.show:', typeof window.AIScreenshotParserPlugin.show);
    console.log('📦 [调试] AIScreenshotParserPlugin._initialized:', window.AIScreenshotParserPlugin._initialized);
  }
  
  // 4. 检查 AI 模型设置窗口
  console.log('📦 [调试] window.AIModelSettingsWindow:', typeof window.AIModelSettingsWindow);
  if (window.AIModelSettingsWindow) {
    console.log('📦 [调试] AIModelSettingsWindow.show:', typeof window.AIModelSettingsWindow.show);
  }
  
  // 5. 检查 Prompt 设置窗口（重点！）
  console.log('📦 [调试] window.PromptSettingsWindow:', typeof window.PromptSettingsWindow);
  if (window.PromptSettingsWindow) {
    console.log('📦 [调试] PromptSettingsWindow.show:', typeof window.PromptSettingsWindow.show);
    console.log('✅ [调试] PromptSettingsWindow 对象存在且完整！');
  } else {
    console.error('❌ [调试] PromptSettingsWindow 不存在！');
  }
}

function testPromptSettingsWindow() {
  console.log('🎯 === 测试打开 Prompt 管理中心窗口 ===');
  
  try {
    // 前置检查
    if (typeof React === 'undefined') {
      console.error('❌ [测试] React 未加载');
      alert('❌ React 未加载！\n请刷新页面。');
      return;
    }
    
    if (typeof ReactDOM === 'undefined') {
      console.error('❌ [测试] ReactDOM 未加载');
      alert('❌ ReactDOM 未加载！\n请刷新页面。');
      return;
    }
    
    if (typeof FloatingWindowReact === 'undefined') {
      console.error('❌ [测试] FloatingWindowReact 未加载');
      alert('❌ FloatingWindowReact 未加载！\n请刷新页面。');
      return;
    }
    
    if (!window.PromptSettingsWindow) {
      console.error('❌ [测试] window.PromptSettingsWindow 不存在');
      alert('❌ PromptSettingsWindow 对象不存在！\n\n可能原因：\n1. 插件未完全加载\n2. JavaScript 执行错误\n\n请查看控制台错误信息。');
      return;
    }
    
    if (typeof window.PromptSettingsWindow.show !== 'function') {
      console.error('❌ [测试] show 不是函数');
      alert('❌ PromptSettingsWindow.show 不是一个函数！\n\n对象结构：' + JSON.stringify(Object.keys(window.PromptSettingsWindow)));
      return;
    }
    
    console.log('✅ [测试] 所有前置检查通过');
    console.log('🚀 [测试] 正在调用 show()...');
    
    // 调用 show()
    var result = window.PromptSettingsWindow.show();
    
    console.log('✅ [测试] show() 执行完成');
    console.log('📊 [测试] 返回值:', result);
    console.log('📊 [测试] 返回值类型:', typeof result);
    
    if (result) {
      console.log('✅ [测试] 窗口应该已成功创建！');
      console.log('📦 [测试] reactRoot:', window.PromptSettingsWindow.reactRoot);
      console.log('📦 [测试] containerId:', window.PromptSettingsWindow.containerId);
      
      // 检查 DOM 中是否有新元素
      if (window.PromptSettingsWindow.containerId) {
        var el = document.getElementById(window.PromptSettingsWindow.containerId);
        console.log('📦 [测试] 容器元素:', el);
        if (el) {
          console.log('📦 [测试] 容器子元素数量:', el.children.length);
          console.log('📦 [测试] 容器 innerHTML 长度:', el.innerHTML.length);
        } else {
          console.warn('⚠️ [测试] 容器元素未找到在 DOM 中');
        }
      }
      
      alert('✅ Prompt 管理中心窗口应该已经打开了！\n\n如果看不到窗口，请检查：\n1. 是否被其他窗口遮挡\n2. 控制台是否有错误');
    } else {
      console.warn('⚠️ [测试] show() 返回 null');
      alert('⚠️ 窗口创建返回 null\n\n可能原因：\n1. 内部错误被捕获\n2. 依赖组件缺失\n\n请查看控制台详细信息。');
    }
    
  } catch(err) {
    console.error('❌ [测试] 异常:', err);
    console.error('❌ [测试] 错误堆栈:', err.stack);
    alert('❌ 打开失败！\n\n错误信息：' + err.message + '\n\n错误位置：' + (err.stack || '未知') + '\n\n请将此信息反馈给开发者。');
  }
}

function testAIModelSettingsWindow() {
  console.log('🎯 === 测试打开 AI 模型设置窗口 ===');
  
  try {
    if (!window.AIModelSettingsWindow) {
      console.error('❌ [测试] AIModelSettingsWindow 不存在');
      alert('❌ AIModelSettingsWindow 不存在！');
      return;
    }
    
    console.log('🚀 [测试] 正在调用 AIModelSettingsWindow.show()...');
    var result = window.AIModelSettingsWindow.show();
    
    console.log('✅ [测试] AI 设置窗口创建结果:', result);
    alert(result ? '✅ AI 模型设置窗口应该已打开！' : '⚠️ 返回 null');
    
  } catch(err) {
    console.error('❌ [测试] 异常:', err);
    alert('❌ 错误：' + err.message);
  }
}

// 手动触发测试的函数
window.debugAIPlugin = {
  checkAll: debugAISettings,
  testPrompt: testPromptSettingsWindow,
  testAIModel: testAIModelSettingsWindow
};

// 页面加载完成后自动运行基础检查
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    setTimeout(debugAISettings, 1000);
  });
} else {
  setTimeout(debugAISettings, 500);
}

console.log('💡 [调试] 可以在控制台中使用以下命令手动测试：');
console.log('   - window.debugAIPlugin.checkAll()       # 检查所有对象');
console.log('   - window.debugAIPlugin.testPrompt()     # 测试 Prompt 窗口');
console.log('   - window.debugAIPlugin.testAIModel()    # 测试 AI 设置窗口');
console.log('🔍 === 调试脚本加载完成 ===');
