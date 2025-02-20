// 定义重试间隔序列（毫秒）
const RETRY_INTERVALS = [1000, 5000, 20000];
let currentIntervalIndex = 0;
let isRetrying = false;
let retryTimer = null;

// 点击次数限制
let retryClickCount = 0;
let maxRetryCount = 5;

// 调试日志函数
function debugLog(message) {
    console.log(`[DeepSeek Assistant] ${message}`);
    showPopup(message);
}

// 创建UI控制面板
function createUIBox() {
    const container = document.createElement('div');
    container.id = 'auto-retry-box';
    container.style.position = 'fixed';
    container.style.bottom = '10px';
    container.style.right = '10px';
    container.style.zIndex = 9999;
    container.style.background = 'rgba(120, 241, 104, 0.79)';
    container.style.color = '#fff';
    container.style.padding = '10px';
    container.style.borderRadius = '5px';
    container.style.fontSize = '14px';

    // 状态显示
    const statusBox = document.createElement('div');
    statusBox.style.marginBottom = '10px';
    statusBox.textContent = `当前状态: ${isRetrying ? '重试中' : '已停止'}`;
    container.appendChild(statusBox);

    // 点击次数显示
    const clickBox = document.createElement('div');
    clickBox.style.marginBottom = '10px';
    clickBox.innerHTML = `点击次数: <span id="click-count">0</span> / <input type="number" id="max-retry-input" value="${maxRetryCount}" min="1" style="width: 50px">`;
    container.appendChild(clickBox);

    // 更新最大重试次数
    const maxRetryInput = clickBox.querySelector('#max-retry-input');
    maxRetryInput.addEventListener('change', () => {
        maxRetryCount = Number(maxRetryInput.value) || maxRetryCount;
        debugLog(`最大重试次数已更新为: ${maxRetryCount}`);
    });

    // 下次重试倒计时
    const countdownBox = document.createElement('div');
    countdownBox.id = 'countdown-box';
    countdownBox.textContent = '下次重试: 等待触发';
    container.appendChild(countdownBox);

    document.body.appendChild(container);
    updateUI();
}

// 更新UI显示
function updateUI() {
    const container = document.getElementById('auto-retry-box');
    if (!container) return;

    container.style.backgroundColor = isRetrying ? 'rgba(120, 241, 104, 0.79)' : 'rgba(0, 0, 0, 0.3)';
    container.querySelector('#click-count').textContent = retryClickCount;
}

// 更新倒计时显示
function updateCountdown(timeLeft) {
    const countdownBox = document.getElementById('countdown-box');
    if (countdownBox) {
        countdownBox.textContent = isRetrying ? 
            `下次重试: ${Math.ceil(timeLeft/1000)}秒` : 
            '下次重试: 已停止';
    }
}

// 创建弹窗提示容器
function createPopupContainer() {
    const container = document.createElement('div');
    container.id = 'popup-container';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'flex-end';
    container.style.gap = '5px';
    container.style.zIndex = 10000;
    document.body.appendChild(container);
    return container;
}

// 显示弹窗提示
function showPopup(message) {
    let container = document.getElementById('popup-container');
    if (!container) {
        container = createPopupContainer();
    }
    
    const popup = document.createElement('div');
    popup.textContent = message;
    popup.style.backgroundColor = '#d0f0c040';
    popup.style.color = '#000';
    popup.style.padding = '10px 20px';
    popup.style.borderRadius = '5px';
    popup.style.fontSize = '14px';
    popup.style.opacity = 0;
    popup.style.transform = 'translateY(20px)';
    popup.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
    
    container.appendChild(popup);
    
    setTimeout(() => {
        popup.style.opacity = 1;
        popup.style.transform = 'translateY(0)';
    }, 100);
    
    setTimeout(() => {
        popup.style.opacity = 0;
        popup.style.transform = 'translateY(-20px)';
        setTimeout(() => popup.remove(), 500);
    }, 3000);
}

// 检查是否存在服务器繁忙消息
function checkForServerBusyMessage() {
    // 检查所有可能包含错误消息的元素
    const messages = document.querySelectorAll('div');
    const hasError = Array.from(messages).some(msg => {
        const text = msg.textContent || '';
        const isError = text.includes('服务器繁忙') || text.includes('请稍后再试');
        if (isError) {
            debugLog('Found error message: ' + text);
        }
        return isError;
    });
    return hasError;
}

// 检查是否正在生成内容
function isGenerating() {
    // 检查所有可能表示加载状态的元素
    const loadingIndicators = document.querySelectorAll('div[class*="loading"], div[class*="spinner"]');
    const isLoading = loadingIndicators.length > 0;
    if (isLoading) {
        debugLog('Content is generating...');
    }
    return isLoading;
}

// 检查是否有正常输出
function hasNormalOutput() {
    // 检查最新的消息元素
    const messages = document.querySelectorAll('div[class*="message"]');
    const lastMessage = messages[messages.length - 1];
    const hasOutput = lastMessage && !checkForServerBusyMessage() && !isGenerating();
    if (hasOutput) {
        debugLog('Normal output detected');
    }
    return hasOutput;
}

// 查找重新生成按钮的多种方法
function findRegenerateButton() {
    debugLog('Searching for regenerate button using multiple methods...');
    
    // 方法1：通过SVG rect的id查找
    const svgRect = document.querySelector('rect[id="重新生成"]');
    if (svgRect) {
        debugLog('Found regenerate button by SVG rect id');
        // 查找最近的可点击父元素
        const clickableParent = svgRect.closest('button, div[class*="ds-icon-button"], div[role="button"]');
        if (clickableParent) {
            debugLog('Found clickable parent element');
            return clickableParent;
        }
    }
    
    // 方法2：通过class名称查找
    const buttonsByClass = document.querySelector('div[class*="ds-icon-button"]');
    if (buttonsByClass) {
        const svgInButton = buttonsByClass.querySelector('svg rect[id="重新生成"]');
        if (svgInButton) {
            debugLog('Found button by class name with correct SVG');
            return buttonsByClass;
        }
    }
    
    // 方法3：遍历所有图标按钮
    const allIconButtons = document.querySelectorAll('div[class*="ds-icon-button"]');
    debugLog(`Found ${allIconButtons.length} icon buttons`);
    
    for (const button of allIconButtons) {
        const buttonHtml = button.innerHTML;
        debugLog(`Checking button HTML: ${buttonHtml.substring(0, 100)}...`);
        if (buttonHtml.includes('重新生成')) {
            debugLog('Found button containing regenerate text in HTML');
            return button;
        }
    }
    
    return null;
}

// 点击重新生成按钮
function clickRegenerateButton() {
    const regenerateButton = findRegenerateButton();
    
    if (regenerateButton) {
        debugLog('Clicking regenerate button');
        regenerateButton.click();
        retryClickCount++;
        updateUI();
    } else {
        debugLog('Regenerate button not found');
    }
}

// 开始重试循环
function startRetrying() {
    if (isRetrying) {
        debugLog('Already retrying, skipping...');
        return;
    }
    
    if (retryClickCount >= maxRetryCount) {
        debugLog('已达到最大重试次数，停止重试');
        return;
    }
    
    debugLog('Starting retry cycle');
    isRetrying = true;
    updateUI();
    scheduleNextRetry();
}

// 停止重试
function stopRetrying() {
    debugLog('Stopping retry cycle');
    isRetrying = false;
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    currentIntervalIndex = 0;
    updateUI();
}

// 安排下一次重试
function scheduleNextRetry() {
    if (!isRetrying) {
        debugLog('Retry cycle stopped, not scheduling next retry');
        return;
    }

    const interval = RETRY_INTERVALS[currentIntervalIndex];
    debugLog(`Scheduling next retry in ${interval}ms`);
    
    let timeLeft = interval;
    const countdownInterval = setInterval(() => {
        timeLeft -= 1000;
        if (timeLeft >= 0) {
            updateCountdown(timeLeft);
        }
    }, 1000);
    
    retryTimer = setTimeout(() => {
        clearInterval(countdownInterval);
        if (checkForServerBusyMessage()) {
            if (retryClickCount >= maxRetryCount) {
                debugLog('已达到最大重试次数，停止重试');
                stopRetrying();
                return;
            }
            debugLog('Server still busy, retrying...');
            clickRegenerateButton();
            currentIntervalIndex = (currentIntervalIndex + 1) % RETRY_INTERVALS.length;
            scheduleNextRetry();
        } else if (isGenerating()) {
            debugLog('Content is generating, waiting...');
            scheduleNextRetry();
        } else if (hasNormalOutput()) {
            debugLog('Normal output detected, stopping retry cycle');
            stopRetrying();
        }
    }, interval);
}

// 初始化扩展
function initializeExtension() {
    debugLog('Initializing DeepSeek Refresh Assistant...');
    
    // 创建UI控制面板
    createUIBox();
    
    // 监听DOM变化
    const observer = new MutationObserver((mutations) => {
        if (checkForServerBusyMessage() && !isRetrying) {
            debugLog('Server busy message detected, starting retry cycle');
            startRetrying();
        } else if (hasNormalOutput() && isRetrying) {
            debugLog('Normal output detected, stopping retry cycle');
            stopRetrying();
        }
    });

    // 开始观察DOM变化
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
    });

    debugLog('DOM observer started');

    // 初始检查
    if (checkForServerBusyMessage()) {
        debugLog('Initial check: Server busy message detected');
        startRetrying();
    }
}

// 确保页面完全加载后再初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
    initializeExtension();
}

// 通知扩展已加载
debugLog('Content script loaded successfully'); 