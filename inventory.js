// Inventory system for cow customization with single grid navigation

// Sample inventory data organized by categories
const inventoryData = {
    hats: [
        { id: 'hat_cowboy', name: 'Cowboy Hat', icon: '🤠', unlocked: true },
        { id: 'hat_party', name: 'Party Hat', icon: '🎉', unlocked: true },
        { id: 'hat_crown', name: 'Crown', icon: '👑', unlocked: false },
        { id: 'hat_santa', name: 'Santa Hat', icon: '🎅', unlocked: false },
        { id: 'hat_wizard', name: 'Wizard Hat', icon: '🧙‍♂️', unlocked: false },
        { id: 'hat_chef', name: 'Chef Hat', icon: '👨‍🍳', unlocked: false }
    ],
    glasses: [
        { id: 'glasses_sun', name: 'Sunglasses', icon: '😎', unlocked: true },
        { id: 'glasses_nerd', name: 'Nerd Glasses', icon: '🤓', unlocked: false },
        { id: 'glasses_monocle', name: 'Monocle', icon: '🧐', unlocked: false },
        { id: 'glasses_3d', name: '3D Glasses', icon: '🎬', unlocked: false }
    ],
    accessories: [
        { id: 'bow_tie', name: 'Bow Tie', icon: '🎀', unlocked: true },
        { id: 'scarf', name: 'Scarf', icon: '🧣', unlocked: false },
        { id: 'necklace', name: 'Necklace', icon: '💎', unlocked: false },
        { id: 'bell', name: 'Bell', icon: '🔔', unlocked: true },
        { id: 'flower', name: 'Flower', icon: '🌸', unlocked: false },
        { id: 'bandana', name: 'Bandana', icon: '🧕', unlocked: false }
    ],
    patterns: [
        { id: 'spots_black', name: 'Black Spots', icon: '⚫', unlocked: true },
        { id: 'spots_brown', name: 'Brown Spots', icon: '🟤', unlocked: true },
        { id: 'stripes', name: 'Stripes', icon: '〰️', unlocked: false },
        { id: 'stars', name: 'Stars', icon: '⭐', unlocked: false },
        { id: 'hearts', name: 'Hearts', icon: '💖', unlocked: false },
        { id: 'rainbow', name: 'Rainbow', icon: '🌈', unlocked: false }
    ],
    effects: [
        { id: 'sparkle', name: 'Sparkle', icon: '✨', unlocked: true },
        { id: 'fire', name: 'Fire', icon: '🔥', unlocked: false },
        { id: 'ice', name: 'Ice', icon: '❄️', unlocked: false },
        { id: 'rainbow_trail', name: 'Rainbow Trail', icon: '🌈', unlocked: false },
        { id: 'confetti', name: 'Confetti', icon: '🎊', unlocked: false },
        { id: 'bubbles', name: 'Bubbles', icon: '🫧', unlocked: false }
    ]
};

let currentCategory = 'hats';
let selectedItems = {
    hats: null,
    glasses: null,
    accessories: null,
    patterns: null,
    effects: null
};

export function initializeInventory() {
    setupNavigation();
    populateGrid();
}

function setupNavigation() {
    const navButtons = document.querySelectorAll('.nav-btn');
    
    navButtons.forEach(button => {
        button.addEventListener('click', () => {
            const category = button.getAttribute('data-page');
            switchCategory(category);
        });
    });
}

function switchCategory(category) {
    // Update navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[data-page="${category}"]`).classList.add('active');
    
    currentCategory = category;
    populateGrid();
}

function populateGrid() {
    const gridElement = document.getElementById('inventoryGrid');
    
    if (!gridElement) return;
    
    gridElement.innerHTML = '';
    
    const items = inventoryData[currentCategory];
    items.forEach(item => {
        const itemElement = createInventoryItem(item);
        gridElement.appendChild(itemElement);
    });
}

function createInventoryItem(item) {
    const itemDiv = document.createElement('div');
    itemDiv.className = `inventory-item ${item.unlocked ? '' : 'locked'}`;
    
    if (item.unlocked) {
        itemDiv.addEventListener('click', () => selectItem(item));
    }
    
    itemDiv.innerHTML = `
        <div style="font-size: 24px; margin-bottom: 5px;">${item.icon}</div>
        <div style="font-size: 12px; color: #333;">${item.name}</div>
        ${!item.unlocked ? '<div style="font-size: 10px; color: #999; margin-top: 5px;">🔒 Locked</div>' : ''}
    `;
    
    return itemDiv;
}

function selectItem(item) {
    // Remove previous selection from current category
    const gridElement = document.getElementById('inventoryGrid');
    gridElement.querySelectorAll('.inventory-item').forEach(el => {
        el.classList.remove('selected');
    });
    
    // Highlight selected item
    const selectedElement = Array.from(gridElement.querySelectorAll('.inventory-item')).find(el => 
        el.querySelector('div:nth-child(2)').textContent === item.name
    );
    
    if (selectedElement) {
        selectedElement.classList.add('selected');
    }
    
    // Update selection state
    selectedItems[currentCategory] = item;
    
    console.log(`Selected ${currentCategory}:`, item.name);
    updateCowCustomization();
}

function updateCowCustomization() {
    const customization = {
        hat: selectedItems.hats?.id || null,
        glasses: selectedItems.glasses?.id || null,
        accessory: selectedItems.accessories?.id || null,
        pattern: selectedItems.patterns?.id || null,
        effect: selectedItems.effects?.id || null
    };
    
    console.log('Current customization:', customization);
    
    // TODO: Update the cow preview with the selected items
    // This would involve calling functions to add/remove accessories, patterns, effects
}

export function getCurrentCustomization() {
    return {
        hat: selectedItems.hats?.id || null,
        glasses: selectedItems.glasses?.id || null,
        accessory: selectedItems.accessories?.id || null,
        pattern: selectedItems.patterns?.id || null,
        effect: selectedItems.effects?.id || null
    };
}

export function resetCustomization() {
    selectedItems = {
        hats: null,
        glasses: null,
        accessories: null,
        patterns: null,
        effects: null
    };
    
    // Reset visual selections
    document.querySelectorAll('.inventory-item').forEach(el => {
        el.classList.remove('selected');
    });
} 