import { createCow } from './cow.js';

// 3D Cow Preview for Customization Screen
let scene, camera, renderer, cowGroup, controls;

export function initializeCowPreview() {
    const canvas = document.getElementById('cowPreviewCanvas');
    if (!canvas) {
        console.error('Cow preview canvas not found');
        return;
    }

    // Check if THREE is available
    if (typeof THREE === 'undefined') {
        console.error('THREE.js is not loaded');
        return;
    }

    console.log('Initializing cow preview...');

    // Scene setup with transparent background
    scene = new THREE.Scene();
    scene.background = null; // Transparent background

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Renderer setup with transparency
    renderer = new THREE.WebGLRenderer({ 
        canvas: canvas, 
        antialias: true,
        alpha: true // Enable transparency
    });
    renderer.setSize(canvas.width, canvas.height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting - adjusted for floating cow without ground
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7); // Increased ambient light
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Add a second light from the opposite side for better illumination
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, 5, -5);
    scene.add(directionalLight2);

    // Create cow model using the same function as the game
    cowGroup = createCow('#ffffff');
    
    // Enable shadows for all cow parts
    cowGroup.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
        }
    });

    // Add a subtle shadow plane beneath the cow
    const shadowGeometry = new THREE.CircleGeometry(2, 32);
    const shadowMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x000000, 
        transparent: true, 
        opacity: 0.2 
    });
    const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
    shadow.rotation.x = -Math.PI / 2; // Lay flat
    shadow.position.y = -0.5; // Position below the cow
    shadow.receiveShadow = false; // Don't receive shadows, just cast them
    scene.add(shadow);

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // Add the cow to the scene
    scene.add(cowGroup);

    // Start animation loop
    animate();
    
    console.log('Cow preview initialized successfully');
}

function animate() {
    requestAnimationFrame(animate);
    if (controls) {
        controls.update();
    }
    if (renderer && scene && camera) {
        renderer.render(scene, camera);
    }
}

export function updateCowColor(color) {
    if (cowGroup) {
        // Update both body and head color (same as in the game)
        const body = cowGroup.children[0]; // Body is the first child
        const head = cowGroup.children[1];  // Head is the second child
        
        if (body && body.material) {
            body.material.color.setHex(color.replace('#', '0x'));
        }
        if (head && head.material) {
            head.material.color.setHex(color.replace('#', '0x'));
        }
        
        console.log('Updated cow color to:', color);
    }
}

export function dispose() {
    if (renderer) {
        renderer.dispose();
    }
    if (controls) {
        controls.dispose();
    }
    console.log('Cow preview disposed');
} 