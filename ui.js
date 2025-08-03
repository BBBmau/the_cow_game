import { initializeCowPreview, updateCowColor, dispose as disposeCowPreview } from './cowPreview.js';
import { initializeInventory, resetCustomization } from './inventory.js';

// This file will handle all interactions with the HTML DOM, including the login screen, chat box, and leaderboard.

// --- State ---
export let isChatActive = false;
export let isLeaderboardActive = false;

// Function to get DOM elements safely
function getDOMElements() {
    return {
        chatMessages: document.getElementById('chatMessages'),
        chatInput: document.getElementById('chatInput'),
        leaderboard: document.getElementById('leaderboard'),
        playerStatsGrid: document.getElementById('playerStatsGrid'),
        globalStatsGrid: document.getElementById('globalStatsGrid'),
        onlinePlayersList: document.getElementById('onlinePlayersList'),
        customizationScreen: document.getElementById('customizationScreen'),
        saveCustomizationButton: document.getElementById('saveCustomizationButton')
    };
}

// Function to check if required libraries are loaded
function checkLibrariesLoaded() {
    const libraries = {
        'iro.js': typeof iro !== 'undefined',
        'THREE.js': typeof THREE !== 'undefined',
        'OrbitControls': typeof THREE !== 'undefined' && THREE.OrbitControls
    };
    
    console.log('Library status:', libraries);
    
    const allLoaded = Object.values(libraries).every(loaded => loaded);
    if (!allLoaded) {
        console.error('Some libraries are not loaded:', libraries);
    }
    
    return allLoaded;
}

// --- Helper Functions ---

export function addChatMessage(message, type = 'player') {
    const { chatMessages } = getDOMElements();
    if (!chatMessages) {
        console.error('Chat messages container not found');
        return;
    }
    
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
    const { playerStatsGrid } = getDOMElements();
    if (!playerStatsGrid) {
        console.error('Player stats grid not found');
        return;
    }
    
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
    const { globalStatsGrid } = getDOMElements();
    if (!globalStatsGrid) {
        console.error('Global stats grid not found');
        return;
    }
    
    const serverUptime = globalStats.serverStartTime ? Math.floor((Date.now() - globalStats.serverStartTime) / 1000) : 0;
    globalStatsGrid.innerHTML = `
        <div class="stat-item"><div class="stat-label">Total Players</div><div class="stat-value">${globalStats.totalPlayers}</div></div>
        <div class="stat-item"><div class="stat-label">Total Hay Eaten</div><div class="stat-value">${globalStats.totalHayEaten}</div></div>
        <div class="stat-item"><div class="stat-label">Server Uptime</div><div class="stat-value">${Math.floor(serverUptime / 60)}m ${serverUptime % 60}s</div></div>
    `;
}

function updateOnlinePlayersSection(otherPlayers, username, playerStats) {
    const { onlinePlayersList } = getDOMElements();
    if (!onlinePlayersList) {
        console.error('Online players list not found');
        return;
    }
    
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

function toggleLeaderboard(playerStats, globalStats, otherPlayers, username, getState) {
    const { leaderboard } = getDOMElements();
    if (!leaderboard) {
        console.error('Leaderboard element not found');
        return;
    }
    
    isLeaderboardActive = !isLeaderboardActive;
    if (isLeaderboardActive) {
        leaderboard.style.display = 'block';
        updateLeaderboard(playerStats, globalStats, otherPlayers, username);
        if (document.pointerLockElement) document.exitPointerLock();
        document.body.classList.add('leaderboard-active');
        document.addEventListener('click', preventPointerLock, true);
    } else {
        leaderboard.style.display = 'none';
        document.body.classList.remove('leaderboard-active');
        document.removeEventListener('click', preventPointerLock, true);
        setTimeout(() => {
            // Only re-lock if the game has started and the leaderboard is closed
            const { gameStarted } = getState();
            if (gameStarted && !isLeaderboardActive && !document.pointerLockElement) {
                document.body.requestPointerLock();
            }
        }, 100);
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
    let isCustomizationActive = false;
    let cowColorPicker;
    let originalColor;
    let isIntentionallyClosingCustomization = false; // Add this flag

    function showCustomizationScreen(initialColor) {
        const { customizationScreen } = getDOMElements();
        if (!customizationScreen) {
            console.error('Customization screen element not found');
            return;
        }
        
        originalColor = initialColor;
        isCustomizationActive = true;
        isIntentionallyClosingCustomization = false; // Reset the flag
        customizationScreen.classList.remove('hidden');

        // Check if libraries are loaded before initializing
        if (!checkLibrariesLoaded()) {
            console.error('Cannot initialize customization screen - libraries not loaded');
            return;
        }

        // Initialize the 3D cow preview
        initializeCowPreview();
        updateCowColor(initialColor);

        // Initialize the inventory system
        initializeInventory();

        // Use setTimeout to ensure the DOM is fully visible before initializing the color picker
        setTimeout(() => {
            const container = document.getElementById('color-picker-wheel');
            console.log('Color picker container:', container);
            
            // Check if iro is available
            if (typeof iro === 'undefined') {
                console.error('iro.js library is not loaded');
                return;
            }
            
            if (cowColorPicker) {
                console.log('Updating existing color picker');
                cowColorPicker.color.hexString = initialColor;
            } else {
                console.log('Creating new color picker');
                try {
                    cowColorPicker = new iro.ColorPicker('#color-picker-wheel', {
                        width: 280,
                        color: initialColor,
                        borderWidth: 1,
                        borderColor: '#fff',
                    });

                    cowColorPicker.on('color:change', function(color) {
                        console.log('Color changed to:', color.hexString);
                        callbacks.onCowColorChange(color.hexString);
                        updateCowColor(color.hexString); // Update the 3D preview
                    });
                    
                    console.log('Color picker created successfully');
                } catch (error) {
                    console.error('Error creating color picker:', error);
                }
            }
        }, 100); // Small delay to ensure DOM is ready
    }

    function hideCustomizationScreen() {
        const { customizationScreen } = getDOMElements();
        if (!customizationScreen) {
            console.error('Customization screen element not found');
            return;
        }
        
        isCustomizationActive = false;
        isIntentionallyClosingCustomization = true; // Set the flag
        customizationScreen.classList.add('hidden');
        
        // Dispose of the 3D cow preview
        disposeCowPreview();
        
        // Reset inventory customization
        resetCustomization();
    }

    // --- Login Form ---
    const usernameInput = document.getElementById('usernameInput');
    const passwordInput = document.getElementById('passwordInput');
    const startButton = document.getElementById('startButton');

    if (usernameInput && startButton) {
        startButton.addEventListener('click', () => {
            const initialColor = cowColorPicker ? cowColorPicker.color.hexString : '#ffffff';
            callbacks.onStartGame(usernameInput.value, passwordInput.value, initialColor);
        });
    }

    const { saveCustomizationButton, customizationScreen, chatInput } = getDOMElements();
    
    if (saveCustomizationButton) {
        saveCustomizationButton.addEventListener('click', () => {
            hideCustomizationScreen();
            document.body.requestPointerLock();
        });
    }
    
    if (usernameInput) {
        usernameInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') passwordInput.focus(); });
    }
    if (passwordInput) {
        passwordInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') startButton.click(); });
    }

    const usernameStatus = document.createElement('div');
    usernameStatus.style.cssText = `margin-top: 5px; font-size: 12px; min-height: 16px;`;
    if (usernameInput && usernameInput.parentNode) {
        usernameInput.parentNode.insertBefore(usernameStatus, usernameInput.nextSibling);
    }

    let usernameCheckTimeout;
    if (usernameInput) {
        usernameInput.addEventListener('input', (e) => {
            const username = e.target.value.trim();
            clearTimeout(usernameCheckTimeout);
            if (!username) { usernameStatus.textContent = ''; return; }
            usernameStatus.textContent = 'Checking availability...';
            usernameStatus.style.color = '#888';
            usernameCheckTimeout = setTimeout(() => checkUsernameAvailability(username, usernameStatus), 500);
        });
    }

    if (customizationScreen) {
        customizationScreen.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // --- Event Listeners ---
    document.addEventListener('keydown', (e) => {
        const state = getState();
        if (!state.gameStarted) return;

        // Open chat with 'T'
        if (e.key.toLowerCase() === 't' && !isChatActive) {
            e.preventDefault();
            chatInput.focus();
            if (document.pointerLockElement) document.exitPointerLock();
            return;
        }

        // Toggle leaderboard with Tab
        if (e.key === 'Tab') {
            e.preventDefault();
            const { playerStats, globalStats, otherPlayers, username } = state;
            toggleLeaderboard(playerStats, globalStats, otherPlayers, username, getState);
        }

        // Stop game keys if chat is active
        if (isChatActive && e.key.toLowerCase() !== 'escape') {
            e.stopPropagation();
        }

        // Consolidated Escape key handler
        if (e.key === 'Escape') {
            if (isCustomizationActive) {
                callbacks.onCowColorChange(originalColor);
                hideCustomizationScreen();
                document.body.requestPointerLock();
            } else if (isChatActive) {
                isChatActive = false;
                chatInput.blur();
                document.body.requestPointerLock();
            } else if (isLeaderboardActive) {
                // Let the toggle function handle it, which will re-lock pointer.
                toggleLeaderboard(null, null, null, null, getState);
            } else if (document.pointerLockElement) {
                // If no menus are open, pressing ESC should unlock the pointer to open the customization menu.
                document.exitPointerLock();
            }
        }

        // Open customization with 'C'
        if (e.key.toLowerCase() === 'c' && !isLeaderboardActive && !isChatActive) {
            if (isCustomizationActive) {
                hideCustomizationScreen();
            } else {
                showCustomizationScreen(state.cowColor);
            }
        }
    });

    if (chatInput) {
        chatInput.addEventListener('focus', () => {
            isChatActive = true;
        });

        chatInput.addEventListener('blur', () => {
            isChatActive = false;
        });

        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const message = chatInput.value;
                if (message.trim()) {
                    callbacks.onSendMessage(message);
                    chatInput.value = '';
                }
            }
        });
    }

    document.addEventListener('pointerlockchange', () => {
        const isLocked = document.pointerLockElement === document.body;
        if (!isLocked && !isChatActive && !isLeaderboardActive && !isCustomizationActive && !isIntentionallyClosingCustomization) {
            const state = getState();
            if (state.gameStarted) {
                showCustomizationScreen(state.cowColor);
            }
        }
        // Reset the flag after the pointer lock change is processed
        if (isLocked) {
            isIntentionallyClosingCustomization = false;
        }
    });

    document.body.addEventListener('click', (e) => {
        const target = e.target;
        // Prevent pointer lock when clicking on any interactive UI element.
        if (target.closest('#chatContainer, #leaderboard, #players, #coordinates, #debugView, button, input')) {
            return;
        }
        if (!document.pointerLockElement) {
            const state = getState();
            if (state.gameStarted) {
                document.body.requestPointerLock();
            }
        }
    });

    // Initial setup
    const initialCowColor = '#ffffff'; 
    callbacks.onCowColorChange(initialCowColor);
}
