import * as THREE from '../vendor/three.module.js';

export class PortfolioHero3D {
  constructor(canvas, statusEl) {
    this.canvas = canvas;
    this.statusEl = statusEl;
    this.isRunning = false;
    this.isPaused = false;
    this.rafId = null;
    this.mode = 'polyhedron';
    this.targetRotX = 0.25;
    this.targetRotY = 0.4;
    this.isDragging = false;
    this.lastX = 0;
    this.lastY = 0;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
  }

  init() {
    if (!this.canvas) return;
    try {
      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
    } catch {
      if (this.statusEl) this.statusEl.textContent = 'WebGL tidak aktif — mode kartu interaktif berjalan.';
      return;
    }

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    this.camera.position.set(0, 0, 5.2);

    const ambient = new THREE.AmbientLight(0x94a3b8, 1.2);
    const keyLight = new THREE.PointLight(0x38bdf8, 45, 25);
    keyLight.position.set(3.2, 2.8, 4.2);
    const fillLight = new THREE.PointLight(0x14b8a6, 30, 25);
    fillLight.position.set(-3.4, -2.5, 3.0);
    this.scene.add(ambient, keyLight, fillLight);

    this.rootGroup = new THREE.Group();
    this.scene.add(this.rootGroup);

    this.buildMeshes();
    this.buildOrbitNodes();
    this.bindEvents();
    this.resize();
    this.isRunning = !this.reducedMotion;
    this.renderFrame();
    if (this.isRunning) this.animate();
  }

  buildMeshes() {
    this.clearMeshGroup();
    this.centerGroup = new THREE.Group();
    this.rootGroup.add(this.centerGroup);

    if (this.mode === 'polyhedron') {
      const coreGeo = new THREE.IcosahedronGeometry(1.18, 1);
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x0ea5e9,
        metalness: 0.45,
        roughness: 0.25,
        flatShading: true
      });
      const wireMat = new THREE.MeshBasicMaterial({
        color: 0x7dd3fc,
        wireframe: true,
        transparent: true,
        opacity: 0.55
      });
      this.coreMesh = new THREE.Mesh(coreGeo, coreMat);
      this.wireMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(1.42, 1), wireMat);
      this.centerGroup.add(this.coreMesh, this.wireMesh);
    } else if (this.mode === 'torus') {
      const torusGeo = new THREE.TorusKnotGeometry(0.92, 0.28, 110, 18);
      const torusMat = new THREE.MeshStandardMaterial({
        color: 0x14b8a6,
        metalness: 0.5,
        roughness: 0.2
      });
      const shellMat = new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        wireframe: true,
        transparent: true,
        opacity: 0.28
      });
      this.coreMesh = new THREE.Mesh(torusGeo, torusMat);
      this.wireMesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.65, 1), shellMat);
      this.centerGroup.add(this.coreMesh, this.wireMesh);
    } else {
      const group = new THREE.Group();
      const boxGeo = new THREE.BoxGeometry(0.32, 0.32, 0.32);
      for (let x = -1; x <= 1; x += 1) {
        for (let y = -1; y <= 1; y += 1) {
          for (let z = -1; z <= 1; z += 1) {
            const mat = new THREE.MeshStandardMaterial({
              color: (x + y + z) % 2 === 0 ? 0x38bdf8 : 0x0f766e,
              metalness: 0.35,
              roughness: 0.3
            });
            const cube = new THREE.Mesh(boxGeo, mat);
            cube.position.set(x * 0.62, y * 0.62, z * 0.62);
            group.add(cube);
          }
        }
      }
      this.coreMesh = group;
      this.centerGroup.add(group);
    }

    const ringGeo = new THREE.TorusGeometry(2.05, 0.018, 12, 80);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45 });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2.6;
    const ring2 = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.35 }));
    ring2.rotation.y = Math.PI / 3;
    this.centerGroup.add(ring1, ring2);
  }

  buildOrbitNodes() {
    this.orbitGroup = new THREE.Group();
    const colors = [0x38bdf8, 0x2dd4bf, 0xfbbf24, 0x818cf8];
    const geo = new THREE.SphereGeometry(0.11, 16, 16);
    for (let i = 0; i < 4; i += 1) {
      const mat = new THREE.MeshStandardMaterial({ color: colors[i], emissive: colors[i], emissiveIntensity: 0.35 });
      const node = new THREE.Mesh(geo, mat);
      const angle = (i * Math.PI) / 2;
      node.position.set(Math.cos(angle) * 2.05, Math.sin(angle) * 0.72, Math.sin(angle) * 1.85);
      this.orbitGroup.add(node);
    }
    this.rootGroup.add(this.orbitGroup);
  }

  clearMeshGroup() {
    if (!this.centerGroup) return;
    this.centerGroup.traverse((obj) => {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) obj.material.dispose();
    });
    this.rootGroup.remove(this.centerGroup);
  }

  setMode(mode) {
    if (this.mode === mode) return;
    this.mode = mode;
    this.buildMeshes();
    this.renderFrame();
  }

  setPaused(paused) {
    this.isPaused = paused;
    if (!paused && !this.reducedMotion && !this.rafId) {
      this.isRunning = true;
      this.animate();
    }
  }

  resetView() {
    this.targetRotX = 0.25;
    this.targetRotY = 0.4;
    this.renderFrame();
  }

  resize() {
    if (!this.renderer || !this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    const width = Math.max(200, Math.floor(rect.width));
    const height = Math.max(200, Math.floor(rect.height));
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  bindEvents() {
    const startDrag = (x, y) => {
      this.isDragging = true;
      this.lastX = x;
      this.lastY = y;
    };
    const moveDrag = (x, y) => {
      if (!this.isDragging) return;
      const dx = x - this.lastX;
      const dy = y - this.lastY;
      this.lastX = x;
      this.lastY = y;
      this.targetRotY += dx * 0.01;
      this.targetRotX = Math.max(-1.2, Math.min(1.2, this.targetRotX + dy * 0.01));
      if (!this.isRunning || this.isPaused) this.renderFrame();
    };
    const endDrag = () => {
      this.isDragging = false;
    };

    this.canvas.addEventListener('pointerdown', (e) => startDrag(e.clientX, e.clientY));
    window.addEventListener('pointermove', (e) => moveDrag(e.clientX, e.clientY));
    window.addEventListener('pointerup', endDrag);
    window.addEventListener('resize', () => {
      this.resize();
      this.renderFrame();
    });
  }

  renderFrame() {
    if (!this.renderer || !this.scene || !this.camera) return;
    this.rootGroup.rotation.x = this.targetRotX;
    this.rootGroup.rotation.y = this.targetRotY;
    this.renderer.render(this.scene, this.camera);
  }

  animate() {
    if (!this.isRunning || this.isPaused) {
      this.rafId = null;
      return;
    }
    if (!this.isDragging) {
      this.targetRotY += 0.0045;
    }
    if (this.orbitGroup) this.orbitGroup.rotation.y -= 0.006;
    if (this.wireMesh) this.wireMesh.rotation.z += 0.002;
    this.rootGroup.rotation.x += (this.targetRotX - this.rootGroup.rotation.x) * 0.14;
    this.rootGroup.rotation.y += (this.targetRotY - this.rootGroup.rotation.y) * 0.14;
    this.renderer.render(this.scene, this.camera);
    this.rafId = window.requestAnimationFrame(() => this.animate());
  }
}
