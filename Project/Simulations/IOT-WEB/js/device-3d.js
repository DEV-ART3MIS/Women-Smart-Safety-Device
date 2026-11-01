/**
 * AEGIS-CORE : Interactive 3D Product Visualizer
 * Built with Three.js & OrbitControls
 * Accurately models the 10.0cm x 6.0cm x 5.0cm Powerbank-style Safety Device
 * with cutaway viewing mode, internal components, and glowing 0.96" OLED screen.
 */

class Device3DViewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.deviceGroup = null;
    this.internalGroup = null;
    this.outerShellMesh = null;
    this.oledTexture = null;

    this.isCutaway = true;
    this.isAutoRotate = true;
    this.animId = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 500;
    const height = this.container.clientHeight || 450;

    // 1. Scene setup
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);

    // Subtle space fog
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.04);

    // 2. Camera setup
    this.camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.camera.position.set(12, 10, 16);

    // 3. Renderer setup
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls setup
    if (window.THREE && THREE.OrbitControls) {
      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.05;
      this.controls.maxDistance = 35;
      this.controls.minDistance = 6;
      this.controls.autoRotate = this.isAutoRotate;
      this.controls.autoRotateSpeed = 1.2;
      this.controls.target.set(0, 0, 0);
    }

    // 5. Lighting setup
    this.setupLighting();

    // 6. Build the 3D Powerbank Device
    this.buildDeviceModel();

    // 7. Event listeners
    window.addEventListener('resize', () => this.onResize());

    // 8. Animation loop
    this.animate();
  }

  setupLighting() {
    // Ambient Light
    const ambient = new THREE.AmbientLight(0xffffff, 0.7);
    this.scene.add(ambient);

    // Key Light (Warm White)
    const keyLight = new THREE.DirectionalLight(0xfff5ea, 1.8);
    keyLight.position.set(10, 15, 12);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    this.scene.add(keyLight);

    // Tactical Blue Fill Light
    const fillLight = new THREE.DirectionalLight(0x06b6d4, 1.2);
    fillLight.position.set(-12, 8, -10);
    this.scene.add(fillLight);

    // Emergency Red Rim Accent
    const rimLight = new THREE.PointLight(0xef4444, 2.5, 20);
    rimLight.position.set(5, -6, 8);
    this.scene.add(rimLight);

    // Ground Grid Helper
    const grid = new THREE.GridHelper(30, 30, 0x06b6d4, 0x1e293b);
    grid.position.y = -6;
    this.scene.add(grid);
  }

  // Create OLED Display Canvas Texture
  createOledTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // Deep OLED Black
    ctx.fillStyle = '#030712';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Cyan Border
    ctx.strokeStyle = '#06B6D4';
    ctx.lineWidth = 4;
    ctx.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);

    // Header bar
    ctx.fillStyle = '#06B6D4';
    ctx.fillRect(4, 4, canvas.width - 8, 24);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('AEGIS SHIELD v2.4', 12, 20);

    // Status items
    ctx.fillStyle = '#10B981';
    ctx.font = 'bold 15px monospace';
    ctx.fillText('GPS : OK (FIX 3D)', 16, 52);

    ctx.fillStyle = '#38BDF8';
    ctx.fillText('GSM : OK (-78dBm)', 16, 74);

    ctx.fillStyle = '#F59E0B';
    ctx.fillText('BAT : 82% [3.94V]', 16, 96);

    ctx.fillStyle = '#10B981';
    ctx.fillText('STATUS: ARMED / READY', 16, 116);

    const texture = new THREE.CanvasTexture(canvas);
    texture.anisotropy = 4;
    return texture;
  }

  buildDeviceModel() {
    this.deviceGroup = new THREE.Group();
    this.internalGroup = new THREE.Group();

    // Scaling: 1 unit = 1 cm.
    // Dimensions: Height: 10.0 cm, Width: 6.0 cm, Depth: 5.0 cm
    const W = 6.0;
    const H = 10.0;
    const D = 5.0;

    // --- 1. OUTER HOUSING (POWERBANK STYLE ENCLOSURE) ---
    // Matte dark charcoal with chamfered look
    const shellMat = new THREE.MeshPhysicalMaterial({
      color: 0x111827,
      metalness: 0.1,
      roughness: 0.35,
      clearcoat: 0.2,
      clearcoatRoughness: 0.1,
      transparent: true,
      opacity: 0.45, // Default cutaway transparency
      depthWrite: false
    });

    const shellGeo = new THREE.BoxGeometry(W, H, D);
    this.outerShellMesh = new THREE.Mesh(shellGeo, shellMat);
    this.deviceGroup.add(this.outerShellMesh);

    // Casing Bezel Trim / Frame Accent
    const frameGeo = new THREE.EdgesGeometry(shellGeo);
    const frameMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 1.5, transparent: true, opacity: 0.7 });
    const frameLines = new THREE.LineSegments(frameGeo, frameMat);
    this.deviceGroup.add(frameLines);

    // --- 2. FRONT FACE EXTERNAL COMPONENTS ---

    // A. 0.96" OLED Display Screen (Front Upper)
    const oledTex = this.createOledTexture();
    const oledMat = new THREE.MeshBasicMaterial({ map: oledTex });
    const oledGeo = new THREE.PlaneGeometry(3.6, 2.2);
    const oledMesh = new THREE.Mesh(oledGeo, oledMat);
    oledMesh.position.set(0, 2.8, D / 2 + 0.02);
    this.deviceGroup.add(oledMesh);

    // OLED Glass Bezel
    const bezelGeo = new THREE.BoxGeometry(4.0, 2.6, 0.1);
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x030712, roughness: 0.2 });
    const bezelMesh = new THREE.Mesh(bezelGeo, bezelMat);
    bezelMesh.position.set(0, 2.8, D / 2 + 0.01);
    this.deviceGroup.add(bezelMesh);

    // B. Large Red SOS Push Button (Front Center)
    const sosBaseGeo = new THREE.BoxGeometry(2.4, 2.2, 0.4);
    const sosBaseMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.4, metalness: 0.1 });
    const sosBase = new THREE.Mesh(sosBaseGeo, sosBaseMat);
    sosBase.position.set(0, 0.2, D / 2 + 0.18);
    this.deviceGroup.add(sosBase);

    // White "SOS" Text Canvas on Button
    const sosCanvas = document.createElement('canvas');
    sosCanvas.width = 128;
    sosCanvas.height = 128;
    const sCtx = sosCanvas.getContext('2d');
    sCtx.fillStyle = '#EF4444';
    sCtx.fillRect(0, 0, 128, 128);
    sCtx.fillStyle = '#FFFFFF';
    sCtx.font = 'bold 52px sans-serif';
    sCtx.textAlign = 'center';
    sCtx.textBaseline = 'middle';
    sCtx.fillText('SOS', 64, 64);
    const sosTex = new THREE.CanvasTexture(sosCanvas);

    const sosCapGeo = new THREE.PlaneGeometry(2.0, 1.8);
    const sosCapMat = new THREE.MeshBasicMaterial({ map: sosTex });
    const sosCap = new THREE.Mesh(sosCapGeo, sosCapMat);
    sosCap.position.set(0, 0.2, D / 2 + 0.39);
    this.deviceGroup.add(sosCap);

    // C. MAX9814 Microphone Sound Port (Front Lower)
    const micRimGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.3, 32);
    micRimGeo.rotateX(Math.PI / 2);
    const micRimMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.8, roughness: 0.2 });
    const micRim = new THREE.Mesh(micRimGeo, micRimMat);
    micRim.position.set(0, -2.4, D / 2 + 0.1);
    this.deviceGroup.add(micRim);

    // Mic Grille Center
    const micHoleGeo = new THREE.CircleGeometry(0.45, 24);
    const micHoleMat = new THREE.MeshBasicMaterial({ color: 0x050811 });
    const micHole = new THREE.Mesh(micHoleGeo, micHoleMat);
    micHole.position.set(0, -2.4, D / 2 + 0.26);
    this.deviceGroup.add(micHole);

    // D. USB Charging Port (Bottom)
    const usbGeo = new THREE.BoxGeometry(1.6, 0.4, 0.8);
    const usbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.2 });
    const usbMesh = new THREE.Mesh(usbGeo, usbMat);
    usbMesh.position.set(0, -H / 2 - 0.05, 0);
    this.deviceGroup.add(usbMesh);

    // --- 3. INTERNAL ELECTRONIC COMPONENTS (CUTAWAY STACK) ---

    // A. 18650 Li-ion Battery Cylinder (Top Layer, 3.7V)
    const batGeo = new THREE.CylinderGeometry(0.9, 0.9, 4.8, 32);
    batGeo.rotateZ(Math.PI / 2);
    // Purple/Violet wrapper like standard 18650 cell
    const batMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, metalness: 0.3, roughness: 0.4 });
    const battery = new THREE.Mesh(batGeo, batMat);
    battery.position.set(0, 3.6, -0.6);
    this.internalGroup.add(battery);

    // Battery Terminals (+ and -)
    const termGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16);
    termGeo.rotateZ(Math.PI / 2);
    const termMat = new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.9 });
    const posTerm = new THREE.Mesh(termGeo, termMat);
    posTerm.position.set(2.5, 3.6, -0.6);
    this.internalGroup.add(posTerm);

    // B. TP4056 USB Li-ion Charging Module
    const tpGeo = new THREE.BoxGeometry(2.4, 0.2, 1.8);
    const tpMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.4 }); // Blue PCB
    const tp4056 = new THREE.Mesh(tpGeo, tpMat);
    tp4056.position.set(0, 2.2, -0.8);
    this.internalGroup.add(tp4056);

    // C. ESP32 DevKit V1 (Main Controller Board)
    const espPcbGeo = new THREE.BoxGeometry(2.8, 5.0, 0.2);
    const espPcbMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 }); // Black PCB
    const espPcb = new THREE.Mesh(espPcbGeo, espPcbMat);
    espPcb.position.set(0, -0.6, -0.2);
    this.internalGroup.add(espPcb);

    // ESP-WROOM-32 Silver Shield Can
    const shieldGeo = new THREE.BoxGeometry(1.8, 2.2, 0.3);
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.85, roughness: 0.2 });
    const shield = new THREE.Mesh(shieldGeo, shieldMat);
    shield.position.set(0, 0.6, 0.05);
    espPcb.add(shield);

    // Gold Pin Headers on ESP32 sides
    const pinHeaderGeo = new THREE.BoxGeometry(0.3, 4.6, 0.4);
    const pinHeaderMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.8, roughness: 0.3 });
    const leftHeader = new THREE.Mesh(pinHeaderGeo, pinHeaderMat);
    leftHeader.position.set(-1.25, 0, 0.1);
    espPcb.add(leftHeader);
    const rightHeader = new THREE.Mesh(pinHeaderGeo, pinHeaderMat);
    rightHeader.position.set(1.25, 0, 0.1);
    espPcb.add(rightHeader);

    // D. SIM800L GSM Module (Red Breakout PCB)
    const simGeo = new THREE.BoxGeometry(2.2, 2.4, 0.2);
    const simMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.4 }); // Classic Red SIM800L
    const sim800l = new THREE.Mesh(simGeo, simMat);
    sim800l.position.set(1.4, -0.4, 1.1);
    this.internalGroup.add(sim800l);

    // Gold SIM Card Tray on Module
    const trayGeo = new THREE.BoxGeometry(1.2, 1.4, 0.15);
    const trayMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.8 });
    const tray = new THREE.Mesh(trayGeo, trayMat);
    tray.position.set(0, 0, 0.15);
    sim800l.add(tray);

    // E. NEO-6M GPS Module with Ceramic Patch Antenna
    const gpsGeo = new THREE.BoxGeometry(2.2, 2.2, 0.2);
    const gpsMat = new THREE.MeshStandardMaterial({ color: 0x047857, roughness: 0.4 }); // Green PCB
    const neo6m = new THREE.Mesh(gpsGeo, gpsMat);
    neo6m.position.set(-1.4, -0.4, 1.1);
    this.internalGroup.add(neo6m);

    // Ceramic Patch Antenna (Square Beige Block)
    const antGeo = new THREE.BoxGeometry(1.6, 1.6, 0.5);
    const antMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6 }); // Ceramic beige
    const antenna = new THREE.Mesh(antGeo, antMat);
    antenna.position.set(0, 0, 0.35);
    neo6m.add(antenna);

    // Antenna Center Pin
    const antPinGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.1, 8);
    const antPinMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
    const antPin = new THREE.Mesh(antPinGeo, antPinMat);
    antPin.rotation.x = Math.PI / 2;
    antPin.position.set(0, 0, 0.62);
    neo6m.add(antPin);

    // F. MPU6050 Motion / Fall Detection Sensor (Blue Breakout)
    const mpuGeo = new THREE.BoxGeometry(1.5, 1.8, 0.2);
    const mpuMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.4 }); // Blue
    const mpu6050 = new THREE.Mesh(mpuGeo, mpuMat);
    mpu6050.position.set(-1.4, -3.2, 0.6);
    this.internalGroup.add(mpu6050);

    // G. MicroSD Card SPI Module
    const sdGeo = new THREE.BoxGeometry(1.6, 2.0, 0.25);
    const sdMat = new THREE.MeshStandardMaterial({ color: 0x0369a1, roughness: 0.3 }); // Navy blue
    const sdModule = new THREE.Mesh(sdGeo, sdMat);
    sdModule.position.set(1.4, -3.2, 0.6);
    this.internalGroup.add(sdModule);

    // Silver SD Card Slot
    const sdSlotGeo = new THREE.BoxGeometry(1.2, 1.4, 0.2);
    const sdSlotMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 });
    const sdSlot = new THREE.Mesh(sdSlotGeo, sdSlotMat);
    sdSlot.position.set(0, 0, 0.18);
    sdModule.add(sdSlot);

    // H. Coin Vibration Motor (3V)
    const motorGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.25, 24);
    motorGeo.rotateX(Math.PI / 2);
    const motorMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8 });
    const motor = new THREE.Mesh(motorGeo, motorMat);
    motor.position.set(0, -3.5, -1.2);
    this.internalGroup.add(motor);

    // Add internal components group into device
    this.deviceGroup.add(this.internalGroup);

    // Slightly elevate device
    this.deviceGroup.position.y = 0.5;
    this.scene.add(this.deviceGroup);
  }

  toggleCutaway(forceState) {
    if (typeof forceState === 'boolean') {
      this.isCutaway = forceState;
    } else {
      this.isCutaway = !this.isCutaway;
    }

    if (this.outerShellMesh) {
      if (this.isCutaway) {
        this.outerShellMesh.material.opacity = 0.40;
        this.outerShellMesh.material.transparent = true;
        this.outerShellMesh.material.depthWrite = false;
      } else {
        this.outerShellMesh.material.opacity = 1.0;
        this.outerShellMesh.material.transparent = false;
        this.outerShellMesh.material.depthWrite = true;
      }
      this.outerShellMesh.material.needsUpdate = true;
    }
    return this.isCutaway;
  }

  toggleAutoRotate(forceState) {
    if (typeof forceState === 'boolean') {
      this.isAutoRotate = forceState;
    } else {
      this.isAutoRotate = !this.isAutoRotate;
    }
    if (this.controls) {
      this.controls.autoRotate = this.isAutoRotate;
    }
    return this.isAutoRotate;
  }

  resetView() {
    if (this.controls && this.camera) {
      this.camera.position.set(12, 10, 16);
      this.controls.target.set(0, 0, 0);
      this.controls.update();
    }
  }

  onResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  animate() {
    this.animId = requestAnimationFrame(() => this.animate());

    if (this.controls) {
      this.controls.update();
    }

    // Gentle floating bob
    if (this.deviceGroup) {
      this.deviceGroup.position.y = 0.5 + Math.sin(Date.now() * 0.0015) * 0.15;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

// Global hook
window.initDevice3D = function(containerId) {
  return new Device3DViewer(containerId);
};
