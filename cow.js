// Cow model and movement functionality
export function createCow() {
    const cowGroup = new THREE.Group();

    // Materials
    const white = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const black = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const pink = new THREE.MeshStandardMaterial({ color: 0xffa3b1 });
    const brown = new THREE.MeshStandardMaterial({ color: 0x5a3a1a });

    // Cow body
    const body = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), white);
    body.position.y = 1;
    cowGroup.add(body);

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.75, 0.75), white);
    head.position.set(1.375, 1.25, 0);
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

    // Rotate the entire cow model to make one side face forward
    cowGroup.rotation.y = Math.PI / 2;

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
        // Strafe left relative to camera direction
        moveX += cameraDirection.z;
        moveZ -= cameraDirection.x;
    }
    if (keys.d) {
        // Strafe right relative to camera direction
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
        
        // Calculate target rotation based on movement direction
        const targetRotation = Math.atan2(moveX, moveZ) - Math.PI / 2;
        
        // Apply smooth rotation
        const currentRotation = player.rotation.y;
        const rotationDiff = targetRotation - currentRotation;
        
        // Normalize the rotation difference to be between -PI and PI
        const normalizedDiff = Math.atan2(Math.sin(rotationDiff), Math.cos(rotationDiff));
        
        // Apply smooth rotation with increased speed for more responsive turning
        player.rotation.y += normalizedDiff * 0.2;
    }

    // Initialize jump properties if they don't exist
    if (!player.velocity) {
        player.velocity = 0;
        player.isGrounded = true;
    }

    // Apply gravity
    const gravity = 0.015;
    const jumpForce = 0.15;
    const groundLevel = 0.5; // Height of the cow's legs

    // Handle jumping
    if (keys[' '] && player.isGrounded) { // Space bar
        player.velocity = jumpForce;
        player.isGrounded = false;
    }

    // Apply gravity and update position
    player.velocity -= gravity;
    player.position.y += player.velocity;

    // Ground collision
    if (player.position.y <= groundLevel) {
        player.position.y = groundLevel;
        player.velocity = 0;
        player.isGrounded = true;
    }

    // Keep player within bounds (adjusted for larger cow size)
    const bounds = 20;
    player.position.x = Math.max(-bounds, Math.min(bounds, player.position.x));
    player.position.z = Math.max(-bounds, Math.min(bounds, player.position.z));
} 