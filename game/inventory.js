// Inventory system for cow customization - simulating server response

// Simulate server response data
const mockServerResponse = {
    hats: [
        { id: 'hat_cowboy', name: 'TESTING (WILL BE REMOVED)', icon: '🤠', unlocked: false },
    ],
    glasses: [],
    accessories: [],
    patterns: [],
    effects: []
};

let inventoryData = mockServerResponse;
let currentCategory = 'hats';
let selectedItems = {
    hats: null,
    glasses: null,
    accessories: null,
    patterns: null,
    effects: null
};

export function initializeInventory() {
    console.log('Initializing inventory with mock server data:', inventoryData);
    setupNavigation();
    populateGrid();
}

// Make it available globally for use in index.html
window.initializeInventory = initializeInventory;
window.resetCustomization = resetCustomization;
window.saveCurrentCustomization = saveCurrentCustomization;

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
    
    const items = inventoryData[currentCategory] || [];
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

export function saveCurrentCustomization() {
    // Simulate saving to server
    console.log('Saving customization to server:', selectedItems);
    return Promise.resolve(true);
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