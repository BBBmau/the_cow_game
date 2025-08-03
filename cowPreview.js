// 3D Cow Preview for Customization Screen
let scene, camera, renderer, cowMesh, controls;

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
    // Create a simple cow using basic geometric shapes
    const cowGroup = new THREE.Group();

    // Body (main part) - using cylinder instead of capsule
    const bodyGeometry = new THREE.CylinderGeometry(1, 1, 2, 8);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    body.castShadow = true;
    cowGroup.add(body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.6, 8, 6);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(1.5, 1.5, 0);
    head.castShadow = true;
    cowGroup.add(head);

    // Snout
    const snoutGeometry = new THREE.CylinderGeometry(0.3, 0.4, 0.8, 8);
    const snoutMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
    snout.position.set(2.2, 1.3, 0);
    snout.rotation.z = Math.PI / 2;
    snout.castShadow = true;
    cowGroup.add(snout);

    // Ears
    const earGeometry = new THREE.ConeGeometry(0.2, 0.4, 8);
    const earMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(1.3, 2.2, 0.3);
    leftEar.rotation.z = -Math.PI / 6;
    cowGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(1.3, 2.2, -0.3);
    rightEar.rotation.z = Math.PI / 6;
    cowGroup.add(rightEar);

    // Legs
    const legGeometry = new THREE.CylinderGeometry(0.2, 0.2, 1.5, 8);
    const legMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    
    const positions = [
        [-0.5, 0, 0.5],   // Front left
        [-0.5, 0, -0.5],  // Front right
        [0.5, 0, 0.5],    // Back left
        [0.5, 0, -0.5]    // Back right
    ];

    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(pos[0], pos[1], pos[2]);
        leg.castShadow = true;
        cowGroup.add(leg);
    });

    // Tail
    const tailGeometry = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
    const tailMaterial = new THREE.MeshLambertMaterial({ color: 0x8B4513 }); // Brown
    const tail = new THREE.Mesh(tailGeometry, tailMaterial);
    tail.position.set(-1.5, 1.5, 0);
    tail.rotation.z = -Math.PI / 4;
    cowGroup.add(tail);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 6);
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 }); // Black
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(1.8, 1.7, 0.3);
    cowGroup.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(1.8, 1.7, -0.3);
    cowGroup.add(rightEye);

    // Nose
    const noseGeometry = new THREE.SphereGeometry(0.08, 8, 6);
    const noseMaterial = new THREE.MeshLambertMaterial({ color: 0x000000 }); // Black
    const nose = new THREE.Mesh(noseGeometry, noseMaterial);
    nose.position.set(2.5, 1.3, 0);
    cowGroup.add(nose);

    // Store the body mesh for color updates
    cowMesh = body;
    
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
        console.log('Updated cow color to:', color);
    } else {
        console.error('Cow mesh not found for color update');
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