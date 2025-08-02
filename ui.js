 // This file will handle all interactions with the HTML DOM, including the login screen, chat box, and leaderboard.

// --- State ---
export let isChatActive = false;
export let isLeaderboardActive = false;
let isCustomizationActive = false;

// --- DOM Elements ---
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const leaderboard = document.getElementById('leaderboard');
const playerStatsGrid = document.getElementById('playerStatsGrid');
const globalStatsGrid = document.getElementById('globalStatsGrid');
const onlinePlayersList = document.getElementById('onlinePlayersList');
const customizationScreen = document.getElementById('customizationScreen');
const customCowColorInput = document.getElementById('customCowColor');
const saveCustomizationButton = document.getElementById('saveCustomizationButton');

// --- Helper Functions ---

export function addChatMessage(message, type = 'user') {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'chat-message';
    
    if (type === 'system') {
        messageDiv.innerHTML = `<span class="chat-system">${message}</span>`;
    } else {
        messageDiv.innerHTML = `<span class="chat-username">${message.username}:</span> ${message.text}`;
    }
    
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function updatePlayerStatsSection(playerStats) {
    const expToNextLevel = 100 - (playerStats.experience % 100);
    playerStatsGrid.innerHTML = `
        <div class="stat-item"><div class="stat-label">Level</div><div class="stat-value">${playerStats.level}</div></div>
        <div class="stat-item"><div class="stat-label">Experience</div><div class="stat-value">${playerStats.experience}</div></div>
        <div class="stat-item"><div class="stat-label">Next Level</div><div class="stat-value">${expToNextLevel} XP</div></div>
        <div class="stat-item"><div class="stat-label">Hay Eaten</div><div class="stat-value">${playerStats.hayEaten}</div></div>
        <div class="stat-item"><div class="stat-label">Time Played</div><div class="stat-value">${Math.floor(playerStats.timePlayed / 60)}m ${playerStats.timePlayed % 60}s</div></div>
        <div class="stat-item"><div class="stat-label">Coins</div><div class="stat-value">${playerStats.coins || 0}</div></div>
    `;
}

function updateGlobalStatsSection(globalStats) {
    const serverUptime = globalStats.serverStartTime ? Math.floor((Date.now() - globalStats.serverStartTime) / 1000) : 0;
    globalStatsGrid.innerHTML = `
        <div class="stat-item"><div class="stat-label">Total Players</div><div class="stat-value">${globalStats.totalPlayers}</div></div>
        <div class="stat-item"><div class="stat-label">Total Hay Eaten</div><div class="stat-value">${globalStats.totalHayEaten}</div></div>
        <div class="stat-item"><div class="stat-label">Server Uptime</div><div class="stat-value">${Math.floor(serverUptime / 60)}m ${serverUptime % 60}s</div></div>
    `;
}

function updateOnlinePlayersSection(otherPlayers, username, playerStats) {
    const players = Array.from(otherPlayers.values());
    players.unshift({
        username: username,
        level: playerStats.level,
        hayEaten: playerStats.hayEaten,
        isCurrentPlayer: true
    });
    players.sort((a, b) => (b.level || 1) - (a.level || 1) || (b.hayEaten || 0) - (a.hayEaten || 0));
    onlinePlayersList.innerHTML = players.map((p, i) => `
        <div class="player-item">
            <div class="player-name">${i + 1}. ${p.username} ${p.isCurrentPlayer ? '(You)' : ''}</div>
            <div class="player-stats">Level ${p.level || 1} / ${p.hayEaten || 0} hay</div>
        </div>
    `).join('');
}

export function updateLeaderboard(playerStats, globalStats, otherPlayers, username) {
    updatePlayerStatsSection(playerStats);
    updateGlobalStatsSection(globalStats);
    updateOnlinePlayersSection(otherPlayers, username, playerStats);
}

function preventPointerLock(event) {
    if (isLeaderboardActive) {
        event.preventDefault();
        event.stopPropagation();
        return false;
    }
}

function toggleCustomizationScreen(getState, show) {
    isCustomizationActive = show;
    customizationScreen.classList.toggle('hidden', !show);

    if (show) {
        const { cowColor } = getState();
        customCowColorInput.value = cowColor;
    }
}

function checkUsernameAvailability(username, usernameStatus) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    fetch('/check-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
        signal: controller.signal
    })
    .then(response => {
        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.json();
    })
    .then(data => {
        usernameStatus.textContent = data.available ? 'Username available' : 'Username already taken';
        usernameStatus.style.color = data.available ? '#4CAF50' : '#f44336';
    })
    .catch(error => {
        clearTimeout(timeoutId);
        usernameStatus.textContent = error.name === 'AbortError' ? 'Check timeout - server may be busy' : 'Error checking username';
        usernameStatus.style.color = '#ff9800';
    });
}

// --- Main Setup Function ---

export function initializeUI(callbacks, getState) {
    // --- Login Form ---
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const cowColorInput = document.getElementById('cowColor');
    const startButton = document.getElementById('startButton');

    startButton.addEventListener('click', () => {
        callbacks.onStartGame(usernameInput.value, passwordInput.value, customCowColorInput.value);
    });

    saveCustomizationButton.addEventListener('click', () => {
        const newColor = customCowColorInput.value;
        callbacks.onCowColorChange(newColor);
        toggleCustomizationScreen(getState, false); // Close screen after saving
    });
    
    usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') passwordInput.focus(); });
    passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') startButton.click(); });

    const usernameStatus = document.createElement('div');
    usernameStatus.style.cssText = `margin-top: 5px; font-size: 12px; min-height: 16px;`;
    usernameInput.parentNode.insertBefore(usernameStatus, usernameInput.nextSibling);

    let usernameCheckTimeout;
    usernameInput.addEventListener('input', (e) => {
        const username = e.target.value.trim();
        clearTimeout(usernameCheckTimeout);
        if (!username) { usernameStatus.textContent = ''; return; }
        usernameStatus.textContent = 'Checking availability...';
        usernameStatus.style.color = '#888';
        usernameCheckTimeout = setTimeout(() => checkUsernameAvailability(username, usernameStatus), 500);
    });

    // --- Event Listeners ---
    document.addEventListener('pointerlockchange', () => {
        const { gameStarted } = getState();
        if (!gameStarted || isLeaderboardActive || isChatActive) return;

        if (document.pointerLockElement) {
            // Mouse was just locked, close the customization screen
            if (isCustomizationActive) {
                toggleCustomizationScreen(getState, false);
            }
        } else {
            // Mouse was just unlocked, open the customization screen
            toggleCustomizationScreen(getState, true);
        }
    }, false);

    document.addEventListener('keydown', (e) => {
        const state = getState();

        // Chat Toggling (T key to open)
        if (state.gameStarted && e.key.toLowerCase() === 't' && !isChatActive) {
            e.preventDefault();
            isChatActive = true;
            chatInput.focus();
            if (document.pointerLockElement === document.body) document.exitPointerLock();
        }

        // Leaderboard Toggling
        if (e.key === 'Tab') {
            if (!state.gameStarted) return;
            e.preventDefault();
            // The toggleLeaderboard function is removed, so this block is now empty.
            // The leaderboard state will be managed directly by isLeaderboardActive.
        }

        // Stop game keys if chat is active
        if (isChatActive && e.key.toLowerCase() !== 'escape') {
            e.stopPropagation();
        }

        // Consolidated Escape key handler
        if (e.key === 'Escape') {
            // If any modal is open, the respective handler will deal with it.
            // If not, our only job is to exit pointer lock. The 'pointerlockchange'
            // listener will then handle opening the menu.
            if (isCustomizationActive) {
                toggleCustomizationScreen(getState, false);
                // After closing the menu, re-lock the pointer for gameplay
                document.body.requestPointerLock();
            } else if (isChatActive) {
                isChatActive = false;
                chatInput.blur();
                document.body.requestPointerLock();
            } else if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    });

    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && chatInput.value.trim()) {
            e.preventDefault();
            callbacks.onSendMessage(chatInput.value.trim());
            chatInput.value = '';
            isChatActive = false;
            chatInput.blur();
        }
    });

    chatInput.addEventListener('focus', () => {
        isChatActive = true;
        chatInput.style.background = 'rgba(255, 255, 255, 1)';
    });

    chatInput.addEventListener('blur', () => {
        isChatActive = false;
        chatInput.style.background = 'rgba(255, 255, 255, 0.9)';
    });

    document.addEventListener('click', (event) => {
        const { gameStarted } = getState();
        if (!gameStarted || event.target.closest('#leaderboard, #customizationScreen, #chatContainer, #players, #coordinates, #debugView') || isLeaderboardActive || isCustomizationActive) {
            return;
        }
        if (!document.pointerLockElement) document.body.requestPointerLock();
    });
}
