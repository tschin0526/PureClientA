/**
 * 数字键盘组件
 * 用于为价格输入框提供数字键盘支持
 */

class NumericKeypad {
  /**
   * 生成数字键盘的 HTML（默认隐藏，通过按钮切换）
   * @param {string} keypadId - 键盘的唯一 ID
   * @returns {string} HTML 字符串
   */
  static generateKeypadHTML(keypadId = '') {
    const idAttr = keypadId ? `id="${keypadId}"` : '';
    return `
      <div class="numeric-keypad" ${idAttr} style="display: none; grid-template-columns: repeat(4, 1fr); gap: 4px; margin-top: 8px;">
        <button class="keypad-btn" data-key="7" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">7</button>
        <button class="keypad-btn" data-key="8" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">8</button>
        <button class="keypad-btn" data-key="9" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">9</button>
        <button class="keypad-btn keypad-clear" data-key="clear" style="padding: 6px; border: 1px solid #ef4444; border-radius: 4px; background: white; color: #ef4444; font-size: 12px; font-weight: bold; cursor: pointer;">清除</button>
        
        <button class="keypad-btn" data-key="4" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">4</button>
        <button class="keypad-btn" data-key="5" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">5</button>
        <button class="keypad-btn" data-key="6" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">6</button>
        <button class="keypad-btn" data-key="backspace" style="padding: 6px; border: 1px solid #f59e0b; border-radius: 4px; background: white; color: #f59e0b; font-size: 12px; font-weight: bold; cursor: pointer;">←</button>
        
        <button class="keypad-btn" data-key="1" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">1</button>
        <button class="keypad-btn" data-key="2" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">2</button>
        <button class="keypad-btn" data-key="3" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">3</button>
        <button class="keypad-btn" data-key="-" style="padding: 6px; border: 1px solid #8b5cf6; border-radius: 4px; background: white; color: #8b5cf6; font-size: 14px; font-weight: bold; cursor: pointer;">-</button>
        
        <button class="keypad-btn" data-key="0" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 14px; font-weight: bold; cursor: pointer;">0</button>
        <button class="keypad-btn" data-key="00" style="padding: 6px; border: 1px solid #3b82f6; border-radius: 4px; background: white; color: #3b82f6; font-size: 12px; font-weight: bold; cursor: pointer;">00</button>
        <button class="keypad-btn" data-key="." style="padding: 6px; border: 1px solid #10b981; border-radius: 4px; background: white; color: #10b981; font-size: 14px; font-weight: bold; cursor: pointer;">.</button>
        <button class="keypad-btn keypad-enter" data-key="enter" style="padding: 6px; border: 1px solid #10b981; border-radius: 4px; background: #10b981; color: white; font-size: 12px; font-weight: bold; cursor: pointer;">确认</button>
      </div>
    `;
  }

  /**
   * 生成键盘图标按钮的 HTML
   * @returns {string} HTML 字符串
   */
  static generateToggleIconHTML() {
    return `
      <button class="keypad-toggle-btn" title="显示/隐藏数字键盘" style="
        padding: 0;
        border: none;
        border-radius: 0;
        background: transparent;
        color: #3b82f6;
        font-size: 28px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        width: auto;
        height: auto;
        line-height: 1;
      ">
        ⌨️
      </button>
    `;
  }

  /**
   * 绑定键盘事件
   * @param {HTMLElement} inputElement - 输入框元素
   * @param {HTMLElement} keypadContainer - 键盘容器
   * @param {HTMLElement} toggleBtn - 切换按钮
   * @param {Function} onEnter - 按确认键的回调
   */
  static bindEvents(inputElement, keypadContainer, toggleBtn, onEnter = null) {
    // 绑定切换事件
    if (toggleBtn && keypadContainer) {
      const keypadElement = keypadContainer.querySelector('.numeric-keypad') || keypadContainer;
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (keypadElement.style.display === 'none' || !keypadElement.style.display) {
          keypadElement.style.display = 'grid';
          toggleBtn.style.color = '#10b981';
        } else {
          keypadElement.style.display = 'none';
          toggleBtn.style.color = '#3b82f6';
        }
      });
    }

    // 绑定键盘按钮事件
    if (!inputElement || !keypadContainer) return;

    const keypadBtns = keypadContainer.querySelectorAll('.keypad-btn');
    
    keypadBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const key = btn.dataset.key;
        
        switch(key) {
          case 'clear':
            inputElement.value = '';
            break;
          case 'backspace':
            inputElement.value = inputElement.value.slice(0, -1);
            break;
          case 'enter':
            if (onEnter) onEnter();
            break;
          case '-':
            if (inputElement.value.startsWith('-')) {
              inputElement.value = inputElement.value.slice(1);
            } else {
              inputElement.value = '-' + inputElement.value;
            }
            break;
          case '.':
            if (!inputElement.value.includes('.')) {
              inputElement.value += '.';
            }
            break;
          default:
            inputElement.value += key;
        }
        
        inputElement.focus();
      });
    });
  }
}

// 暴露到全局
if (typeof window !== 'undefined') {
  window.NumericKeypad = NumericKeypad;
}
