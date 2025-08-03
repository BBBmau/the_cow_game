// 3D Cow Preview for Customization Screen
let scene, camera, renderer, cowMesh, headMesh, controls;

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

    // Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x87CEEB); // Sky blue background

    // Camera setup
    camera = new THREE.PerspectiveCamera(75, canvas.width / canvas.height, 0.1, 1000);
    camera.position.set(0, 2, 5);

    // Renderer setup
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setSize(canvas.width, canvas.height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create cow model
    createCowModel();

    // Controls
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 1.0;

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshLambertMaterial({ color: 0x90EE90 }); // Light green
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Start animation loop
    animate();
    
    console.log('Cow preview initialized successfully');
}

function createCowModel() {
    // Create the exact same cow model used in the game
    const cowGroup = new THREE.Group();

    // Materials (same as in cow.js)
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const black = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xffa3b1 });
    const brown = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });

    // Cow body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), white);
    body.position.y = 1;
    body.castShadow = true;
    cowGroup.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), white);
    head.position.set(1.375, 1.25, 0);
    head.castShadow = true;
    cowGroup.add(head);

    // Horns
    const hornLeft = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.1), brown);
    hornLeft.position.set(1.625, 1.625, -0.2);
    const hornRight = hornLeft.clone();
    hornRight.position.z = 0.2;
    cowGroup.add(hornLeft, hornRight);

    // Legs
    for (let i = -1; i <= 1; i += 2) {
        for (let j = -0.4; j <= 0.4; j += 0.8) {
            const leg = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1, 0.25), black);
            leg.position.set(i * 0.75, 0.5, j);
            leg.castShadow = true;
            cowGroup.add(leg);
        }
    }

    // Udder
    const udder = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.15, 0.25), pink);
    udder.position.set(0, 0.35, 0);
    cowGroup.add(udder);

    // Black spots
    const spots = [
        [0.25, 1.25, 0.5],
        [-0.5, 1, -0.5],
        [-0.75, 1.15, 0],
        [0.5, 1.1, -0.4],
        [-0.4, 1.2, 0.4],
        [0.6, 1.05, 0.25]
    ];
    spots.forEach(([x, y, z]) => {
        const spot = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.05), black);
        spot.position.set(x, y, z);
        cowGroup.add(spot);
    });

    // Rotate the entire cow model to make one side face forward (same as in cow.js)
    cowGroup.rotation.y = Math.PI / 2;

    // Store the body mesh for color updates
    cowMesh = body;
    headMesh = head; // Store the head mesh
    
    scene.add(cowGroup);
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
    if (cowMesh) {
        cowMesh.material.color.setHex(color.replace('#', '0x'));
    }
    if (headMesh) {
        headMesh.material.color.setHex(color.replace('#', '0x'));
    }
    console.log('Updated cow color to:', color);
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