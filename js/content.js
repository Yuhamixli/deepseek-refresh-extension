// 定义重试间隔序列（毫秒）
const RETRY_INTERVALS = [1000, 5000, 20000];
let currentIntervalIndex = 0;
let isRetrying = false;
let retryTimer = null;

// 调试日志函数
function debugLog(message) {
    console.log(`[DeepSeek Assistant] ${message}`);
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
    
    debugLog('Starting retry cycle');
    isRetrying = true;
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
}

// 安排下一次重试
function scheduleNextRetry() {
    if (!isRetrying) {
        debugLog('Retry cycle stopped, not scheduling next retry');
        return;
    }

    const interval = RETRY_INTERVALS[currentIntervalIndex];
    debugLog(`Scheduling next retry in ${interval}ms`);
    
    retryTimer = setTimeout(() => {
        if (checkForServerBusyMessage()) {
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