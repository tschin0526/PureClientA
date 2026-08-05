// 调试浮动窗口
console.log('调试浮动窗口脚本加载');

// 测试FloatingWindow组件
function debugFloatingWindow() {
  console.log('=== 开始调试FloatingWindow组件 ===');
  
  // 检查FloatingWindow是否存在
  if (typeof FloatingWindow === 'undefined') {
    console.error('FloatingWindow 未定义');
    return;
  }
  
  console.log('FloatingWindow 已定义');
  
  // 创建测试窗口
  try {
    const testWindow = new FloatingWindow({
      title: '测试窗口',
      width: '400px',
      height: '300px',
      x: '100px',
      y: '100px',
      draggable: true
    });
    
    console.log('测试窗口创建成功:', testWindow);
    console.log('测试窗口元素:', testWindow.getElement());
    
    // 设置内容
    testWindow.setContent('<h2>测试内容</h2><p>这是一个测试浮动窗口的内容。</p>');
    console.log('测试窗口内容已设置');
    
    // 显示窗口
    testWindow.show();
    console.log('测试窗口已显示');
    
    // 检查窗口是否在DOM中
    const windowElement = document.querySelector('.floating-window');
    console.log('DOM中的浮动窗口元素:', windowElement);
    if (windowElement) {
      console.log('浮动窗口样式:', windowElement.style);
      console.log('浮动窗口显示状态:', windowElement.style.display);
    }
    
  } catch (error) {
    console.error('创建测试窗口失败:', error);
  }
}

// 测试showTradeDetail函数
function debugShowTradeDetail() {
  console.log('=== 开始调试showTradeDetail函数 ===');
  
  // 检查showTradeDetail是否存在
  if (typeof window.showTradeDetail === 'undefined') {
    console.error('showTradeDetail 未定义');
    return;
  }
  
  console.log('showTradeDetail 已定义');
  
  // 创建测试交易对象
  const testTrade = {
    id: 'test-123',
    stock: '台积电',
    side: 'buy',
    qty: 100,
    price: 500,
    amount: 50000,
    date: '2026-02-05',
    createdAt: new Date().toISOString(),
    market: '台股'
  };
  
  console.log('测试交易对象:', testTrade);
  
  // 调用showTradeDetail
  try {
    window.showTradeDetail(testTrade);
    console.log('showTradeDetail 调用成功');
  } catch (error) {
    console.error('showTradeDetail 调用失败:', error);
  }
}

// 当DOM加载完成后运行调试
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM加载完成，开始调试');
    debugFloatingWindow();
    // 延迟测试showTradeDetail，确保FloatingWindow测试完成
    setTimeout(debugShowTradeDetail, 1000);
  });
} else {
  console.log('DOM已加载，开始调试');
  debugFloatingWindow();
  // 延迟测试showTradeDetail，确保FloatingWindow测试完成
  setTimeout(debugShowTradeDetail, 1000);
}
