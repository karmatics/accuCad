class ThreeJSLoader {
  constructor(canvasId, options = {}) {
    this.canvasId = canvasId;
    this.options = options || {};
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.raycaster = null;
    this.THREE = null;
    this.animId = null;
    this.isDestroyed = false;
    this.onUpdateCallback = null;
    this.onUpdateCallbacks = [];
    this.modules = {};
    this.loaders = {};
    this._pmremGenerator = null;
    this._envTexture = null;
  }

  add(object) {
    if (this.scene && object) this.scene.add(object);
    return this;
  }

  remove(object) {
    if (this.scene && object) this.scene.remove(object);
    return this;
  }

  static isReady() {
    return typeof THREE !== 'undefined';
  }

  static async load(version = 'r128') {
      const loadScript = (src) => new Promise((resolve, reject) => {
        if (document.querySelector('script[src="' + src + '"]')) return resolve();
        const s = document.createElement('script');
        s.src = src;
        s.async = false;
        s.onload = resolve;
        s.onerror = reject;
        document.head.appendChild(s);
      });

      // 1. Core Three.js
      if (!ThreeJSLoader.isReady()) {
        const coreSources = [
          'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js',
          'https://cdn.jsdelivr.net/npm/three@0.128.0/build/three.min.js',
          'https://unpkg.com/three@0.128.0/build/three.min.js'
        ];
        for (const src of coreSources) {
          try {
            await loadScript(src);
            if (typeof THREE !== 'undefined') break;
          } catch(e) {}
        }
      }

      if (typeof THREE === 'undefined') {
        throw new Error('[ThreeJSLoader] Could not load Three.js core from CDN.');
      }

      const CDN_BASE = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/';

      // 2. Add-on Libraries & Loaders
      const addons = [
        { check: () => typeof THREE.OrbitControls !== 'undefined', url: 'controls/OrbitControls.js' },
        { check: () => typeof THREE.GLTFLoader !== 'undefined', url: 'loaders/GLTFLoader.js' },
        { check: () => typeof THREE.DRACOLoader !== 'undefined', url: 'loaders/DRACOLoader.js' },
        { check: () => typeof THREE.SVGLoader !== 'undefined', url: 'loaders/SVGLoader.js' },
        { check: () => typeof THREE.BufferGeometryUtils !== 'undefined', url: 'utils/BufferGeometryUtils.js' },
        { check: () => typeof THREE.LineSegmentsGeometry !== 'undefined', url: 'lines/LineSegmentsGeometry.js' },
        { check: () => typeof THREE.LineGeometry !== 'undefined', url: 'lines/LineGeometry.js' },
        { check: () => typeof THREE.LineMaterial !== 'undefined', url: 'lines/LineMaterial.js' },
        { check: () => typeof THREE.LineSegments2 !== 'undefined', url: 'lines/LineSegments2.js' },
        { check: () => typeof THREE.Line2 !== 'undefined', url: 'lines/Line2.js' }
      ];

      for (const addon of addons) {
        if (!addon.check()) {
          try {
            await loadScript(CDN_BASE + addon.url);
          } catch (e) {
            console.warn('[ThreeJSLoader] Notice loading ' + addon.url + ':', e.message);
          }
        }
      }

      // Expose constructor references to globalThis for CAD consumers
      if (THREE.LineGeometry) globalThis.LineGeometry = THREE.LineGeometry;
      if (THREE.LineMaterial) globalThis.LineMaterial = THREE.LineMaterial;
      if (THREE.Line2) globalThis.Line2 = THREE.Line2;
      if (THREE.LineSegments2) globalThis.LineSegments2 = THREE.LineSegments2;
      if (THREE.LineSegmentsGeometry) globalThis.LineSegmentsGeometry = THREE.LineSegmentsGeometry;
      if (THREE.SVGLoader) globalThis.SVGLoader = THREE.SVGLoader;
      if (THREE.DRACOLoader) globalThis.DRACOLoader = THREE.DRACOLoader;
      if (THREE.GLTFLoader) globalThis.GLTFLoader = THREE.GLTFLoader;
      if (THREE.BufferGeometryUtils) globalThis.BufferGeometryUtils = THREE.BufferGeometryUtils;

      return window.THREE;
    }

  async init(container) {
      this.container = container || document.getElementById(this.canvasId) || document.body;
      await ThreeJSLoader.load();
      this.THREE = window.THREE;
      const THREE = this.THREE;

      this.modules = {
        NURBSSurface: THREE.NURBSSurface,
        NURBSUtils: THREE.NURBSUtils,
        ParametricGeometry: THREE.ParametricGeometry,
        OrbitControls: THREE.OrbitControls,
        GLTFLoader: THREE.GLTFLoader,
        DRACOLoader: THREE.DRACOLoader,
        SVGLoader: THREE.SVGLoader,
        BufferGeometryUtils: THREE.BufferGeometryUtils,
        Line2: THREE.Line2 || globalThis.Line2,
        LineGeometry: THREE.LineGeometry || globalThis.LineGeometry,
        LineMaterial: THREE.LineMaterial || globalThis.LineMaterial,
        LineSegments2: THREE.LineSegments2 || globalThis.LineSegments2,
        LineSegmentsGeometry: THREE.LineSegmentsGeometry || globalThis.LineSegmentsGeometry
      };

      const width = this.container.clientWidth || window.innerWidth || 800;
      const height = this.container.clientHeight || window.innerHeight || 600;

      // 1. Scene
      this.scene = new THREE.Scene();

      // 2. Camera
      const fov = this.options.fov || 45;
      this.camera = new THREE.PerspectiveCamera(fov, width / height, 0.1, 2000);
      const camPos = this.options.cameraPos || { x: 0, y: 150, z: 250 };
      this.camera.position.set(camPos.x, camPos.y, camPos.z);

      // 3. Renderer with ACES Filmic Tone Mapping
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setSize(width, height);
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      if (THREE.sRGBEncoding) this.renderer.outputEncoding = THREE.sRGBEncoding;
      if (THREE.ACESFilmicToneMapping) this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.0;
      this.renderer.domElement.style.width = '100%';
      this.renderer.domElement.style.height = '100%';
      this.renderer.domElement.style.display = 'block';
      this.container.appendChild(this.renderer.domElement);

      // 4. OrbitControls
      if (this.options.enableControls && THREE.OrbitControls) {
        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        const target = this.options.cameraTarget || this.options.target || { x: 0, y: 0.5, z: 0 };
        this.controls.target.set(target.x, target.y, target.z);
      }

      // 5. Raycaster
      this.raycaster = new THREE.Raycaster();

      // 6. Animation Loop
      const animate = () => {
        if (this.isDestroyed) return;
        this.animId = requestAnimationFrame(animate);
        if (this.controls) this.controls.update();

        if (typeof this.onUpdateCallback === 'function') {
          try { this.onUpdateCallback(); } catch(e) {}
        }

        for (const cb of this.onUpdateCallbacks) {
          try { cb(); } catch(e) {}
        }

        this.renderer.render(this.scene, this.camera);
      };
      animate();

      return this;
    }
  resize(width, height) {
    if (!this.renderer || !this.camera) return;
    const w = width || (this.container ? this.container.clientWidth : window.innerWidth);
    const h = height || (this.container ? this.container.clientHeight : window.innerHeight);
    if (w > 0 && h > 0) {
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    }
  }

  destroy() {
    this.isDestroyed = true;
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
    if (this.renderer) this.renderer.dispose();
  }

  async loadEnvironment(url) {
    if (!this.THREE || !this.scene) return;
    const THREE = this.THREE;
    return new Promise((resolve, reject) => {
      if (THREE.RGBELoader) {
        const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
        pmremGenerator.compileEquirectangularShader();
        new THREE.RGBELoader().load(
          url,
          (texture) => {
            const envMap = pmremGenerator.fromEquirectangular(texture).texture;
            this.scene.environment = envMap;
            texture.dispose();
            pmremGenerator.dispose();
            resolve(envMap);
          },
          undefined,
          reject
        );
      } else {
        const textureLoader = new THREE.TextureLoader();
        textureLoader.load(
          url,
          (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.environment = texture;
            resolve(texture);
          },
          undefined,
          reject
        );
      }
    });
  }

  clearEnvironment() {
    if (this.scene) {
      this.scene.environment = null;
    }
  }
}

globalThis.ThreeJSLoader = ThreeJSLoader;
if (typeof module !== "undefined" && module.exports) module.exports = ThreeJSLoader;