// Cow model and movement functionality
export function createCow() {
    const cowGroup = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.BoxGeometry(1.5, 1, 2);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.y = 1;
    cowGroup.add(body);

    // Head
    const headGeometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.2, 0.8);
    cowGroup.add(head);

    // Snout
    const snoutGeometry = new THREE.BoxGeometry(0.4, 0.3, 0.4);
    const snoutMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const snout = new THREE.Mesh(snoutGeometry, snoutMaterial);
    snout.position.set(0, 1.1, 1.2);
    cowGroup.add(snout);

    // Legs
    const legGeometry = new THREE.BoxGeometry(0.3, 1, 0.3);
    const legMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const positions = [
        [-0.5, 0.5, 0.5],  // Front left
        [0.5, 0.5, 0.5],   // Front right
        [-0.5, 0.5, -0.5], // Back left
        [0.5, 0.5, -0.5]   // Back right
    ];

    positions.forEach(pos => {
        const leg = new THREE.Mesh(legGeometry, legMaterial);
        leg.position.set(...pos);
        cowGroup.add(leg);
    });

    // Ears
    const earGeometry = new THREE.BoxGeometry(0.2, 0.3, 0.1);
    const earMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftEar = new THREE.Mesh(earGeometry, earMaterial);
    leftEar.position.set(-0.2, 1.6, 0.6);
    cowGroup.add(leftEar);

    const rightEar = new THREE.Mesh(earGeometry, earMaterial);
    rightEar.position.set(0.2, 1.6, 0.6);
    cowGroup.add(rightEar);

    // Spots
    const spotGeometry = new THREE.CircleGeometry(0.2, 32);
    const spotMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const spotPositions = [
        [-0.5, 1.01, 0.5],
        [0.5, 1.01, -0.5],
        [0, 1.01, 0],
        [-0.3, 1.01, -0.3],
        [0.3, 1.01, 0.3]
    ];

    spotPositions.forEach(pos => {
        const spot = new THREE.Mesh(spotGeometry, spotMaterial);
        spot.position.set(...pos);
        spot.rotation.x = -Math.PI / 2;
        cowGroup.add(spot);
    });

    // Rotate the entire cow model 180 degrees to face forward
    cowGroup.rotation.y = Math.PI;

    return cowGroup;
}

export function updateCowMovement(player, keys, moveSpeed, camera) {
    // Calculate movement direction based on camera's rotation
    const cameraDirection = new THREE.Vector3();
    camera.getWorldDirection(cameraDirection);
    
    // Project camera direction onto XZ plane
    cameraDirection.y = 0;
    cameraDirection.normalize();

    // Calculate movement vector
    let moveX = 0;
    let moveZ = 0;

    if (keys.w) {
        moveX += cameraDirection.x;
        moveZ += cameraDirection.z;
    }
    if (keys.s) {
        moveX -= cameraDirection.x;
        moveZ -= cameraDirection.z;
    }
    if (keys.a) {
        moveX += cameraDirection.z;
        moveZ -= cameraDirection.x;
    }
    if (keys.d) {
        moveX -= cameraDirection.z;
        moveZ += cameraDirection.x;
    }

    // Normalize movement vector if moving diagonally
    if (moveX !== 0 && moveZ !== 0) {
        const length = Math.sqrt(moveX * moveX + moveZ * moveZ);
        moveX /= length;
        moveZ /= length;
    }

    // Apply movement
    if (keys.w || keys.s || keys.a || keys.d) {
        player.position.x += moveX * moveSpeed;
        player.position.z += moveZ * moveSpeed;
        // Make cow face the direction it's moving
        player.rotation.y = Math.atan2(moveX, moveZ);
    }

    // Keep player within bounds
    player.position.x = Math.max(-24, Math.min(24, player.position.x));
    player.position.z = Math.max(-24, Math.min(24, player.position.z));
} 