/**
 * TERRA-X — NASA Eyes-Inspired Interactive 3D Hero Celestial Experience
 * File: static/js/hero-eyes-3d.js
 *
 * PHOTOREALISTIC EDITION:
 * - Genuine NASA Equirectangular High-Resolution Textures:
 *     * Earth: NASA Blue Marble 2K surface (/images/earth_texture.jpg)
 *     * Moon: NASA LROC 1K cratered surface (/images/moon_texture.jpg)
 *     * Mars: NASA Viking 1K Martian topography (/images/mars_texture.jpg)
 * - Delicate, realistic cloud layer with soft alpha rotation
 * - Photorealistic solar terminator lighting with Electric Blue (#078FE0) Fresnel rim atmosphere
 * - Smooth interactive orbit controls (drag to orbit, wheel zoom, touch controls)
 * - Orbiting Moon with logo-matching 24° tilted elliptical trajectory
 * - Orbiting Mars with 14° inclined trajectory
 * - Zero reliance on cluttered inner-screen widgets (pure, clean 3D viewport)
 */

(function () {
  "use strict";

  const TELEMETRY_DATA = {
    earth: {
      title: "EARTH (TERRA)",
      banner: "EARTH (TERRA) • Radius: 6,371 km • Semi-major: 1.000 AU • Analogs Mapped: 8 Sites",
    },
    moon: {
      title: "MOON (LUNA)",
      banner: "MOON (LUNA) • Radius: 1,737 km • Orbital Period: 27.3 d • Target: Shackleton Rim",
    },
    mars: {
      title: "MARS (ARES)",
      banner: "MARS (ARES) • Radius: 3,389 km • Distance: 1.524 AU • Target: Jezero Crater",
    },
    system: {
      title: "SOLAR SYSTEM",
      banner: "SOLAR SYSTEM • Ephemeris View • 3 Planetary Bodies Active • NASA Eyes Engine",
    },
  };

  const EARTH_ANALOG_SITES = [
    { id: "tindouf_sebkha", name: "Tindouf Sebkha", country: "Morocco", lat: 27.67, lon: -8.14 },
    { id: "atacama_desert", name: "Atacama Desert", country: "Chile", lat: -24.50, lon: -69.25 },
    { id: "svalbard_permafrost", name: "Svalbard", country: "Norway", lat: 78.22, lon: 15.65 },
    { id: "iceland_highlands", name: "Iceland Highlands", country: "Iceland", lat: 64.90, lon: -18.20 },
    { id: "mojave_desert", name: "Mojave Desert", country: "USA", lat: 35.01, lon: -115.47 },
    { id: "hanksville_mdrs", name: "Hanksville MDRS", country: "USA (Utah)", lat: 38.40, lon: -110.79 },
    { id: "mauna_kea", name: "Mauna Kea", country: "USA (Hawaii)", lat: 19.82, lon: -155.46 },
    { id: "haughton_crater", name: "Haughton Crater", country: "Canada", lat: 75.38, lon: -89.68 },
  ];

  function latLonToSpherePos(lat, lon, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lon + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  /** Subtle procedural cloud texture for the atmospheric layer */
  function createSoftCloudTexture() {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const w = canvas.width;
    const h = canvas.height;

    // Swirling equatorial and mid-latitude cloud whisps
    for (let i = 0; i < 36; i++) {
      const cx = (i * 47) % w;
      const cy = h * 0.5 + Math.sin(i * 0.7) * 45;
      const rx = 45 + (i % 5) * 22;
      const ry = 12 + (i % 4) * 8;
      const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, rx);
      grad.addColorStop(0, "rgba(255, 255, 255, 0.45)");
      grad.addColorStop(0.5, "rgba(240, 248, 255, 0.22)");
      grad.addColorStop(1, "rgba(255, 255, 255, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0.08 * (i % 4), 0, Math.PI * 2);
      ctx.fill();
    }

    const midLats = [h * 0.26, h * 0.74];
    midLats.forEach((latY, idx) => {
      for (let i = 0; i < 20; i++) {
        const cx = (i * 62 + idx * 35) % w;
        const cy = latY + Math.cos(i * 1.2) * 25;
        const rad = 30 + (i % 4) * 16;
        const grad = ctx.createRadialGradient(cx, cy, 3, cx, cy, rad);
        grad.addColorStop(0, "rgba(255, 255, 255, 0.38)");
        grad.addColorStop(0.6, "rgba(235, 245, 255, 0.16)");
        grad.addColorStop(1, "rgba(255, 255, 255, 0)");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx, cy, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    return texture;
  }

  /** Atmosphere Fresnel Shader: Electric Blue (#078FE0) Limb Glow */
  function createAtmosphereShaderMaterial() {
    const vertexShader = `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        vNormal = normalize(normalMatrix * normal);
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vView = normalize(-mvPosition.xyz);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragmentShader = `
      varying vec3 vNormal;
      varying vec3 vView;
      void main() {
        float rim = 1.0 - max(0.0, dot(vNormal, vView));
        float intensity = pow(rim, 3.2);
        // Electric Blue matching #078FE0: RGB (0.027, 0.561, 0.878)
        vec3 glowColor = vec3(0.027, 0.561, 0.878);
        gl_FragColor = vec4(glowColor, intensity * 0.95);
      }
    `;

    return new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }

  class HeroEyesSimulation {
    constructor(canvas) {
      this.canvas = canvas;
      this.container = canvas.parentElement;
      this.activeTarget = "earth";

      this.controls = {
        yaw: 0.35,
        pitch: 0.18,
        radius: 13.5,
        targetYaw: 0.35,
        targetPitch: 0.18,
        targetRadius: 13.5,
        minRadius: 6.5,
        maxRadius: 80.0,
        damping: 0.08,
        isDragging: false,
        lastX: 0,
        lastY: 0,
      };

      this.currentLookAt = new THREE.Vector3(0, 0, 0);
      this.targetLookAt = new THREE.Vector3(0, 0, 0);
      this.targetCameraPos = new THREE.Vector3(0, 2.2, 13.5);

      this.orbits = {
        moonAngle: 0.8,
        moonSpeed: 0.006,
        moonRadiusA: 14.0,
        moonRadiusB: 13.2,
        moonInclination: 24.0 * (Math.PI / 180),

        marsAngle: 2.2,
        marsSpeed: 0.003,
        marsRadiusA: 30.0,
        marsRadiusB: 28.0,
        marsInclination: 14.0 * (Math.PI / 180),
      };

      this.init();
    }

    init() {
      this.canvas.setAttribute("role", "img");
      this.canvas.setAttribute(
        "aria-label",
        "Photorealistic 3D Solar System & Planetary Analogs Simulation. Drag to rotate, scroll to zoom."
      );

      const width = this.container ? this.container.clientWidth : window.innerWidth;
      const height = this.container ? this.container.clientHeight : window.innerHeight;

      try {
        this.renderer = new THREE.WebGLRenderer({
          canvas: this.canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
      } catch (err) {
        console.warn("[TERRA-X HeroEyes] WebGL init fallback:", err);
        this.renderFallback();
        return;
      }

      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(width, height, false);
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.05;

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
      this.camera.position.copy(this.targetCameraPos);
      this.camera.lookAt(this.currentLookAt);

      this.textureLoader = new THREE.TextureLoader();

      this.buildLighting();
      this.buildStarfield();
      this.buildEarthSystem();
      this.buildMoonSystem();
      this.buildMarsSystem();

      this.bindEvents();
      this.bindHUDControls();

      this.animate = this.animate.bind(this);
      requestAnimationFrame(this.animate);
    }

    renderFallback() {
      if (!this.container) return;
      const fallbackDiv = document.createElement("div");
      fallbackDiv.className = "hero-eyes-fallback";
      fallbackDiv.innerHTML = `
        <div style="position: absolute; inset: 0; background: radial-gradient(circle, #0F2A48 0%, #071B32 100%); display: flex; align-items: center; justify-content: center; flex-direction: column; color: #FFFFFF; text-align: center; padding: 24px;">
          <img src="images/planet_earth_view.jpg" alt="Earth from Space" style="width: 240px; height: 240px; border-radius: 50%; box-shadow: 0 0 40px rgba(7, 143, 224, 0.4); margin-bottom: 16px; object-fit: cover;" />
          <div style="font-family: var(--font-display); font-size: 18px; font-weight: 700;">EARTH ANALOGS 3D TWIN</div>
          <div style="font-family: var(--font-mono); font-size: 12px; color: #71849A; margin-top: 6px;">WebGL hardware acceleration required for interactive view.</div>
        </div>
      `;
      this.container.appendChild(fallbackDiv);
    }

    buildLighting() {
      // Directional Sunlight (creating crisp day/night terminator)
      this.sunLight = new THREE.DirectionalLight(0xffffff, 1.35);
      this.sunLight.position.set(38, 16, 28);
      this.scene.add(this.sunLight);

      // Deep space ambient fill
      this.ambientLight = new THREE.AmbientLight(0x182436, 0.42);
      this.scene.add(this.ambientLight);

      // Soft rim fill from deep space
      const rimLight = new THREE.DirectionalLight(0x078fe0, 0.2);
      rimLight.position.set(-30, -12, -22);
      this.scene.add(rimLight);
    }

    buildStarfield() {
      const starCount = 2200;
      const starGeometry = new THREE.BufferGeometry();
      const positions = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);

      const palette = [
        new THREE.Color("#ffffff"),
        new THREE.Color("#c8e6ff"),
        new THREE.Color("#078FE0"),
        new THREE.Color("#ffe5b4"),
      ];

      for (let i = 0; i < starCount; i++) {
        const radius = 150 + Math.random() * 150;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);

        positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
        positions[i * 3 + 2] = radius * Math.cos(phi);

        const col = palette[Math.floor(Math.random() * palette.length)];
        colors[i * 3] = col.r;
        colors[i * 3 + 1] = col.g;
        colors[i * 3 + 2] = col.b;
      }

      starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      starGeometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));

      const starMaterial = new THREE.PointsMaterial({
        size: 1.3,
        vertexColors: true,
        transparent: true,
        opacity: 0.85,
      });

      this.starfield = new THREE.Points(starGeometry, starMaterial);
      this.scene.add(this.starfield);
    }

    buildEarthSystem() {
      this.earthGroup = new THREE.Group();
      this.earthGroup.name = "earthGroup";

      const earthRadius = 4.8;
      const earthGeom = new THREE.SphereGeometry(earthRadius, 96, 96);

      // Load authentic NASA Blue Marble texture
      const earthTex = this.textureLoader.load(
        "images/earth_texture.jpg",
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          if (this.earthMaterial) this.earthMaterial.needsUpdate = true;
        }
      );

      this.earthMaterial = new THREE.MeshStandardMaterial({
        map: earthTex,
        roughness: 0.68,
        metalness: 0.06,
      });

      this.earthMesh = new THREE.Mesh(earthGeom, this.earthMaterial);
      this.earthMesh.name = "earth";
      this.earthMesh.userData = { type: "planet", name: "earth", title: "EARTH (TERRA)" };
      this.earthGroup.add(this.earthMesh);

      // Translucent rotating cloud layer
      const cloudGeom = new THREE.SphereGeometry(earthRadius + 0.05, 64, 64);
      const cloudTex = createSoftCloudTexture();
      this.cloudMaterial = new THREE.MeshLambertMaterial({
        map: cloudTex,
        transparent: true,
        opacity: 0.32,
        blending: THREE.NormalBlending,
      });
      this.cloudMesh = new THREE.Mesh(cloudGeom, this.cloudMaterial);
      this.cloudMesh.name = "clouds";
      this.earthGroup.add(this.cloudMesh);

      // Breathtaking Electric Blue Atmosphere Rim
      const atmoGeom = new THREE.SphereGeometry(earthRadius + 0.22, 64, 64);
      this.atmoMesh = new THREE.Mesh(atmoGeom, createAtmosphereShaderMaterial());
      this.atmoMesh.name = "atmosphereGlow";
      this.earthGroup.add(this.atmoMesh);

      // Primary Earth Analog Site Beacons
      this.analogPinsGroup = new THREE.Group();
      const pinGeom = new THREE.SphereGeometry(0.07, 16, 16);
      const pinMat = new THREE.MeshBasicMaterial({ color: 0x078fe0 });
      const ringGeom = new THREE.RingGeometry(0.1, 0.16, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x43b5f5,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8,
      });

      EARTH_ANALOG_SITES.forEach((site) => {
        const pos = latLonToSpherePos(site.lat, site.lon, earthRadius + 0.03);
        const pinMesh = new THREE.Mesh(pinGeom, pinMat);
        pinMesh.position.copy(pos);
        pinMesh.userData = { type: "analogPin", data: site };

        const halo = new THREE.Mesh(ringGeom, ringMat);
        halo.position.copy(pos);
        halo.lookAt(pos.clone().multiplyScalar(2));
        pinMesh.add(halo);

        this.analogPinsGroup.add(pinMesh);
      });

      this.earthMesh.add(this.analogPinsGroup);
      this.scene.add(this.earthGroup);
    }

    buildMoonSystem() {
      this.moonRadius = 1.32;
      const moonGeom = new THREE.SphereGeometry(this.moonRadius, 48, 48);

      // Load authentic NASA Moon surface texture
      const moonTex = this.textureLoader.load(
        "images/moon_texture.jpg",
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          if (this.moonMaterial) this.moonMaterial.needsUpdate = true;
        }
      );

      this.moonMaterial = new THREE.MeshStandardMaterial({
        map: moonTex,
        roughness: 0.92,
        metalness: 0.0,
      });

      this.moonMesh = new THREE.Mesh(moonGeom, this.moonMaterial);
      this.moonMesh.name = "moon";
      this.moonMesh.userData = { type: "planet", name: "moon", title: "MOON (LUNA)" };
      this.scene.add(this.moonMesh);

      // Elliptical Orbital Path (tilted ~24° matching logo)
      const curvePts = [];
      const segments = 128;
      const a = this.orbits.moonRadiusA;
      const b = this.orbits.moonRadiusB;
      const tilt = this.orbits.moonInclination;

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        let x = a * Math.cos(theta);
        let z = b * Math.sin(theta);
        let y = z * Math.sin(tilt);
        z = z * Math.cos(tilt);
        curvePts.push(new THREE.Vector3(x, y, z));
      }

      const orbitGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0x078fe0,
        transparent: true,
        opacity: 0.35,
      });
      this.moonOrbitLine = new THREE.Line(orbitGeom, orbitMat);
      this.scene.add(this.moonOrbitLine);
    }

    buildMarsSystem() {
      this.marsRadius = 2.45;
      const marsGeom = new THREE.SphereGeometry(this.marsRadius, 54, 54);

      // Mars Distinct Red-Orange Accent Color Token: #E87532
      const marsTex = this.textureLoader.load(
        "images/mars_texture.jpg",
        (tex) => {
          tex.wrapS = THREE.RepeatWrapping;
          tex.wrapT = THREE.ClampToEdgeWrapping;
          if (this.marsMaterial) this.marsMaterial.needsUpdate = true;
        }
      );

      this.marsMaterial = new THREE.MeshStandardMaterial({
        map: marsTex,
        roughness: 0.84,
        metalness: 0.04,
      });

      this.marsMesh = new THREE.Mesh(marsGeom, this.marsMaterial);
      this.marsMesh.name = "mars";
      this.marsMesh.userData = { type: "planet", name: "mars", title: "MARS (ARES)" };
      this.scene.add(this.marsMesh);

      // Mars Elliptical Orbit
      const curvePts = [];
      const segments = 144;
      const a = this.orbits.marsRadiusA;
      const b = this.orbits.marsRadiusB;
      const tilt = this.orbits.marsInclination;

      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        let x = a * Math.cos(theta);
        let z = b * Math.sin(theta);
        let y = z * Math.sin(tilt);
        z = z * Math.cos(tilt);
        curvePts.push(new THREE.Vector3(x, y, z));
      }

      const orbitGeom = new THREE.BufferGeometry().setFromPoints(curvePts);
      const orbitMat = new THREE.LineBasicMaterial({
        color: 0xe87532,
        transparent: true,
        opacity: 0.3,
      });
      this.marsOrbitLine = new THREE.Line(orbitGeom, orbitMat);
      this.scene.add(this.marsOrbitLine);
    }

    bindEvents() {
      const el = this.canvas;

      el.addEventListener("mousedown", (e) => {
        this.controls.isDragging = true;
        this.controls.lastX = e.clientX;
        this.controls.lastY = e.clientY;
      });

      window.addEventListener("mousemove", (e) => {
        if (!this.controls.isDragging) return;
        const dx = e.clientX - this.controls.lastX;
        const dy = e.clientY - this.controls.lastY;
        this.controls.lastX = e.clientX;
        this.controls.lastY = e.clientY;

        this.controls.targetYaw -= dx * 0.005;
        this.controls.targetPitch += dy * 0.005;
        this.controls.targetPitch = Math.max(-1.3, Math.min(1.3, this.controls.targetPitch));
      });

      window.addEventListener("mouseup", () => {
        this.controls.isDragging = false;
      });

      el.addEventListener(
        "wheel",
        (e) => {
          e.preventDefault();
          this.controls.targetRadius += e.deltaY * 0.02;
          this.controls.targetRadius = Math.max(
            this.controls.minRadius,
            Math.min(this.controls.maxRadius, this.controls.targetRadius)
          );
        },
        { passive: false }
      );

      // Touch events (Mobile support)
      el.addEventListener(
        "touchstart",
        (e) => {
          if (e.touches.length === 1) {
            this.controls.isDragging = true;
            this.controls.lastX = e.touches[0].clientX;
            this.controls.lastY = e.touches[0].clientY;
          }
        },
        { passive: true }
      );

      el.addEventListener(
        "touchmove",
        (e) => {
          if (this.controls.isDragging && e.touches.length === 1) {
            const dx = e.touches[0].clientX - this.controls.lastX;
            const dy = e.touches[0].clientY - this.controls.lastY;
            this.controls.lastX = e.touches[0].clientX;
            this.controls.lastY = e.touches[0].clientY;

            this.controls.targetYaw -= dx * 0.006;
            this.controls.targetPitch += dy * 0.006;
            this.controls.targetPitch = Math.max(-1.3, Math.min(1.3, this.controls.targetPitch));
          }
        },
        { passive: true }
      );

      el.addEventListener(
        "touchend",
        () => {
          this.controls.isDragging = false;
        },
        { passive: true }
      );

      // ResizeObserver
      if (window.ResizeObserver && this.container) {
        this.resizeObserver = new ResizeObserver(() => this.onResize());
        this.resizeObserver.observe(this.container);
      } else {
        window.addEventListener("resize", () => this.onResize());
      }
    }

    onResize() {
      if (!this.container || !this.renderer || !this.camera) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w === 0 || h === 0) return;

      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h, false);
    }

    bindHUDControls() {
      const buttons = document.querySelectorAll(".hero-eyes-hud .planet-pill-btn, .hero-eyes-hud .hud-btn");
      if (!buttons || buttons.length === 0) return;

      buttons.forEach((btn) => {
        btn.addEventListener("click", () => {
          buttons.forEach((b) => {
            b.classList.remove("active");
            b.setAttribute("aria-pressed", "false");
          });
          btn.classList.add("active");
          btn.setAttribute("aria-pressed", "true");

          const target = btn.dataset.target || "earth";
          this.setTarget(target);
        });
      });
    }

    setTarget(targetKey) {
      this.activeTarget = targetKey;

      if (targetKey === "earth") {
        this.targetLookAt.set(0, 0, 0);
        this.controls.targetRadius = 13.5;
        this.controls.minRadius = 6.2;
      } else if (targetKey === "moon") {
        this.controls.targetRadius = 5.2;
        this.controls.minRadius = 2.4;
      } else if (targetKey === "mars") {
        this.controls.targetRadius = 7.5;
        this.controls.minRadius = 3.6;
      } else if (targetKey === "system") {
        this.targetLookAt.set(0, 0, 0);
        this.controls.targetRadius = 48.0;
        this.controls.targetPitch = 0.55;
        this.controls.minRadius = 12.0;
      }

      this.updateTelemetryUI(targetKey);
    }

    updateTelemetryUI(targetKey) {
      const textEl = document.getElementById("heroEyesTelemetryText");
      const badgeEl = document.getElementById("heroEyesTelemetryBadge");
      const data = TELEMETRY_DATA[targetKey];
      if (!data) return;

      if (textEl) textEl.textContent = data.banner;
      if (badgeEl) badgeEl.textContent = data.title;
    }

    animate() {
      requestAnimationFrame(this.animate);

      // Check reduced motion
      const prefersReducedMotion =
        window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      if (!prefersReducedMotion && !this.controls.isDragging) {
        this.controls.targetYaw += 0.0009; // subtle planetary axial rotation
      }

      // Smooth camera dampening
      this.controls.yaw += (this.controls.targetYaw - this.controls.yaw) * this.controls.damping;
      this.controls.pitch += (this.controls.targetPitch - this.controls.pitch) * this.controls.damping;
      this.controls.radius += (this.controls.targetRadius - this.controls.radius) * this.controls.damping;

      // Update Moon position along tilted elliptical orbit
      if (!prefersReducedMotion) {
        this.orbits.moonAngle += this.orbits.moonSpeed;
      }
      const mA = this.orbits.moonRadiusA;
      const mB = this.orbits.moonRadiusB;
      const mTilt = this.orbits.moonInclination;
      const mTheta = this.orbits.moonAngle;
      let mx = mA * Math.cos(mTheta);
      let mz = mB * Math.sin(mTheta);
      let my = mz * Math.sin(mTilt);
      mz = mz * Math.cos(mTilt);

      if (this.moonMesh) {
        this.moonMesh.position.set(mx, my, mz);
        this.moonMesh.rotation.y += 0.002;
      }

      // Update Mars position along orbit
      if (!prefersReducedMotion) {
        this.orbits.marsAngle += this.orbits.marsSpeed;
      }
      const rA = this.orbits.marsRadiusA;
      const rB = this.orbits.marsRadiusB;
      const rTilt = this.orbits.marsInclination;
      const rTheta = this.orbits.marsAngle;
      let rx = rA * Math.cos(rTheta);
      let rz = rB * Math.sin(rTheta);
      let ry = rz * Math.sin(rTilt);
      rz = rz * Math.cos(rTilt);

      if (this.marsMesh) {
        this.marsMesh.position.set(rx, ry, rz);
        this.marsMesh.rotation.y += 0.003;
      }

      // Earth & Cloud Rotation
      if (this.earthMesh && !prefersReducedMotion) {
        this.earthMesh.rotation.y += 0.0012;
      }
      if (this.cloudMesh && !prefersReducedMotion) {
        this.cloudMesh.rotation.y += 0.0016;
      }

      // Focal Target tracking
      if (this.activeTarget === "moon" && this.moonMesh) {
        this.targetLookAt.copy(this.moonMesh.position);
      } else if (this.activeTarget === "mars" && this.marsMesh) {
        this.targetLookAt.copy(this.marsMesh.position);
      } else if (this.activeTarget === "earth" || this.activeTarget === "system") {
        this.targetLookAt.set(0, 0, 0);
      }

      this.currentLookAt.lerp(this.targetLookAt, 0.06);

      // Compute Camera Position
      const cp = this.controls.pitch;
      const cy = this.controls.yaw;
      const cr = this.controls.radius;

      const camOffset = new THREE.Vector3(
        cr * Math.cos(cp) * Math.sin(cy),
        cr * Math.sin(cp),
        cr * Math.cos(cp) * Math.cos(cy)
      );

      this.camera.position.copy(this.currentLookAt).add(camOffset);
      this.camera.lookAt(this.currentLookAt);

      if (this.renderer && this.scene && this.camera) {
        this.renderer.render(this.scene, this.camera);
      }
    }
  }

  // Automatic initialization
  function initHeroEyes() {
    const canvas = document.getElementById("heroEyesCanvas");
    if (!canvas) return;

    if (window.THREE) {
      new HeroEyesSimulation(canvas);
    } else {
      console.warn("[TERRA-X] Three.js not loaded yet. Waiting...");
      window.addEventListener("load", () => {
        if (window.THREE) new HeroEyesSimulation(canvas);
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initHeroEyes);
  } else {
    initHeroEyes();
  }
})();
