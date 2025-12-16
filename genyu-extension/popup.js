// Popup.js - Control panel for Token Pool Extension

let isRunning = false;
let currentInterval = 5000; // Default 5 seconds
let poolSize = 0;

// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');
const poolSizeEl = document.getElementById('poolSize');
const currentIntervalEl = document.getElementById('currentInterval');
const intervalInput = document.getElementById('intervalInput');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');

// Load current status from background
async function loadStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });

        isRunning = response.isRunning;
        currentInterval = response.interval;
        poolSize = response.poolSize || 0;

        updateUI();
    } catch (e) {
        console.error('Failed to load status:', e);
    }
}

// Update UI based on current status
function updateUI() {
    // Status indicator
    if (isRunning) {
        statusIndicator.className = 'status-indicator active';
        statusText.textContent = 'Running';
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
    } else {
        statusIndicator.className = 'status-indicator inactive';
        statusText.textContent = 'Stopped';
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
    }

    // Pool size
    poolSizeEl.textContent = `${poolSize} tokens`;

    // Interval
    const seconds = currentInterval / 1000;
    currentIntervalEl.textContent = `${seconds}s`;
    intervalInput.value = seconds;
}

// Start auto-generate
startBtn.addEventListener('click', async () => {
    const interval = parseInt(intervalInput.value) * 1000;

    if (interval < 3000 || interval > 60000) {
        alert('Interval must be between 3 and 60 seconds');
        return;
    }

    await chrome.runtime.sendMessage({
        type: 'START_GENERATE',
        interval: interval
    });

    isRunning = true;
    currentInterval = interval;
    updateUI();
});

// Stop auto-generate
stopBtn.addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'STOP_GENERATE' });

    isRunning = false;
    updateUI();
});

// Update pool size periodically
setInterval(async () => {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_STATUS' });
        poolSize = response.poolSize || 0;
        poolSizeEl.textContent = `${poolSize} tokens`;
    } catch (e) {
        // Ignore
    }
}, 2000);

// Load status on popup open
loadStatus();
