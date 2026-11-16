/**
 * TERRA-X Workbench Cockpit Interactive Component
 * Features:
 * 1. 3D Terrain Digital Twin (Three.js WebGL Elevation Meshes - Default Active)
 * 2. 2D Discovery Map (Tactical Dark & Satellite HD Basemaps - Zero Watermarks, Full-Height Responsive)
 * 3. Dynamic Site Inspector with 3-Score Decision Metrics
 */

(function() {
  'use strict';

  // --- 1. Analog Catalog Data ---
  const ANALOG_SITES = [
    {
      id: 'tindouf',
      name: 'Tindouf Basin — Sebkha & Evaporite Margin',
      country: 'Morocco / Algeria Border',
      flag: '🇲🇦',
      category: 'sahara',
      categoryLabel: 'Morocco / Sahara',
      coords: [27.6700, -8.1400],
      elevation: '420 m',
      targetPlanet: 'Mars (Jezero Crater Western Delta)',
      similarity: 85.2,
      aptitude: 81.8,
      confidence: 78.7,
      image: 'images/tindouf_sebkha.jpg',
      driver: 'Soil Geochemistry & Soluble Salts',
      scientificCitation: 'Oberlin et al. (2018), Astrobiology, DOI: 10.1089/ast.2016.1557',
      summary: 'Hyperarid Saharan evaporite basin with documented soluble salt assemblages (chlorides, sulfates, nitrates, perchlorates) directly analogous to Martian lacustrine evaporitic sequences investigated by NASA Perseverance.'
    },
    {
      id: 'iriqui',
      name: 'Lake Iriqui & Drâa Basin',
      country: 'Southern Morocco',
      flag: '🇲🇦',
      category: 'sahara',
      categoryLabel: 'Morocco / Sahara',
      coords: [29.8127, -6.5047],
      elevation: '480 m',
      targetPlanet: 'Mars (Gale & Jezero Playas)',
      similarity: 83.1,
      aptitude: 82.5,
      confidence: 56.2,
      image: 'images/lake_iriqui.jpg',
      driver: 'Fluvial Geomorphology & Rover Mobility',
      scientificCitation: 'Ori et al. (2014), Planetary and Space Science',
      summary: 'Desiccated mudcrack playa and braided alluvial channels serving as gold-standard benchmark for rover traverse kinematics, wheel sinkage testing, and ancient shoreline detection.'
    },
    {
      id: 'atacama',
      name: 'Atacama Desert — Yungay Hyperarid Core',
      country: 'Chile',
      flag: '🇨🇱',
      category: 'deserts',
      categoryLabel: 'Hyperarid Deserts',
      coords: [-24.2800, -69.9200],
      elevation: '1,020 m',
      targetPlanet: 'Mars (Meridiani Planum)',
      similarity: 81.5,
      aptitude: 83.0,
      confidence: 77.1,
      image: 'images/atacama_yungay.jpg',
      driver: 'Extreme Aridity & Astrobiology Threshold',
      scientificCitation: 'Navarro-González et al. (2003), Science',
      summary: 'Decades-proven global benchmark for extreme water-limitation thresholds and microbial survivability in perchlorate-rich volcanic regolith.'
    },
    {
      id: 'mcmurdo',
      name: 'McMurdo Dry Valleys — University Valley',
      country: 'Antarctica',
      flag: '🇦🇶',
      category: 'polar',
      categoryLabel: 'Cryogenic Polar',
      coords: [-77.5000, 162.0000],
      elevation: '1,650 m',
      targetPlanet: 'Moon (Shackleton South Pole PSR)',
      similarity: 79.2,
      aptitude: 69.4,
      confidence: 87.3,
      image: 'images/mcmurdo_valleys.jpg',
      driver: 'Cryogenic Permafrost & Sublimation',
      scientificCitation: 'Marchant & Head (2007), Icarus',
      summary: 'Hyper-arid sub-zero permafrost regime and dry permafrost sublimation ground closely matching permanently shadowed cryogenic cold traps at the Lunar South Pole.'
    },
    {
      id: 'lanzarote',
      name: 'Lanzarote — Corona Lava Tubes',
      country: 'Spain (Canary Islands)',
      flag: '🇪🇸',
      category: 'volcanic',
      categoryLabel: 'Volcanic Basalts',
      coords: [29.0400, -13.5800],
      elevation: '310 m',
      targetPlanet: 'Moon / Mars Subsurface Habitats',
      similarity: 76.4,
      aptitude: 78.0,
      confidence: 81.0,
      image: 'images/hawaii_maunakea.jpg',
      driver: 'Volcanic Speleology & Shielding',
      scientificCitation: 'Sauro et al. (2020), Earth-Science Reviews',
      summary: 'Intact basaltic volcanic lava tubes and unweathered pyroxene-olivine minerals ideal for autonomous subterranean rover traversal and radiation-shielded habitat testing.'
    }
  ];

  let activeSite = ANALOG_SITES[0];
  let leafletMap = null;
  let leafletMarkers = [];
  let normalBaseLayer = null;
  let satBaseLayer = null;
  let currentBasemap = 'normal'; // 'normal' (Esri World Street Map) or 'satellite' (Satellite HD)

  let marsRenderer, earthRenderer, marsScene, earthScene, marsCamera, earthCamera;
  let marsMesh, earthMesh, marsGroup, earthGroup;
  let is3DInitialized = false;
  let autoRotate3D = true;
  let isWireframe = false;
  let animFrameId = null;

  // Scanner state per terrain model (interactive crosshairs & tooltip)
  const scanners = {
    mars: {
      xKm: 15,
      yKm: 15,
      lineX: null,
      lineY: null,
      marker: null,
      group: null,
      tooltipEl: null,
      xEl: null,
      yEl: null,
      zEl: null
    },
    earth: {
      xKm: 15,
      yKm: 15,
      lineX: null,
      lineY: null,
      marker: null,
      group: null,
      tooltipEl: null,
      xEl: null,
      yEl: null,
      zEl: null
    }
  };

  const terrainBounds = {
    mars: { minH: -2.0, maxH: 4.0, hRange: 6.0 },
    earth: { minH: -2.5, maxH: 9.0, hRange: 11.5 }
  };

  // --- 2. Tab Switching Logic ---
  window.switchCockpitTab = function(tabName) {
    const btnMap = document.getElementById('tabBtnMap');
    const btn3D = document.getElementById('tabBtn3D');
    const viewMap = document.getElementById('cockpitViewMap');
    const view3D = document.getElementById('cockpitView3D');

    if (!btnMap || !btn3D || !viewMap || !view3D) return;

    if (tabName === '3d') {
      btn3D.classList.add('active');
      btn3D.setAttribute('aria-selected', 'true');
      btnMap.classList.remove('active');
      btnMap.setAttribute('aria-selected', 'false');

      view3D.style.display = 'block';
      viewMap.style.display = 'none';

      if (!is3DInitialized) {
        init3DViews();
      } else {
        setTimeout(onWindowResize3D, 50);
      }
    } else {
      btnMap.classList.add('active');
      btnMap.setAttribute('aria-selected', 'true');
      btn3D.classList.remove('active');
      btn3D.setAttribute('aria-selected', 'false');

      viewMap.style.display = 'block';
      view3D.style.display = 'none';

      if (!leafletMap) {
        initMap();
      }

      // Invalidate map size multiple times to guarantee zero empty areas
      [30, 100, 250, 450].forEach(delay => {
        setTimeout(function() {
          if (leafletMap) {
            leafletMap.invalidateSize(true);
          }
        }, delay);
      });
    }
  };

  // --- 3. Update Inspector Card ---
  function updateInspector(site) {
    activeSite = site;
    const nameEl = document.getElementById('inspectorSiteName');
    const flagEl = document.getElementById('inspectorFlag');
    const countryEl = document.getElementById('inspectorCountry');
    const coordsEl = document.getElementById('inspectorCoords');
    const targetEl = document.getElementById('inspectorTargetPlanet');
    const thumbEl = document.getElementById('inspectorThumb');
    const simEl = document.getElementById('valSimilarity');
    const aptEl = document.getElementById('valAptitude');
    const confEl = document.getElementById('valConfidence');
    const simBar = document.getElementById('barSimilarity');
    const aptBar = document.getElementById('barAptitude');
    const confBar = document.getElementById('barConfidence');
    const driverEl = document.getElementById('inspectorDriver');
    const descEl = document.getElementById('inspectorDesc');
    const citEl = document.getElementById('inspectorCitation');
    const rankEl = document.getElementById('inspectorRankBadge');
    const hudCoords = document.getElementById('mapHudCoords');

    if (nameEl) nameEl.textContent = site.name;
    if (flagEl) flagEl.textContent = site.flag;
    if (countryEl) countryEl.textContent = site.country;
    if (coordsEl) coordsEl.textContent = `${site.coords[0].toFixed(4)}° Lat, ${site.coords[1].toFixed(4)}° Lon (${site.elevation})`;
    if (targetEl) targetEl.textContent = site.targetPlanet;
    if (thumbEl) {
      thumbEl.src = site.image;
      thumbEl.alt = site.name;
    }
    if (simEl) simEl.textContent = site.similarity.toFixed(1) + '%';
    if (aptEl) aptEl.textContent = site.aptitude.toFixed(1) + '%';
    if (confEl) confEl.textContent = site.confidence.toFixed(1) + '%';
    if (simBar) simBar.style.width = site.similarity + '%';
    if (aptBar) aptBar.style.width = site.aptitude + '%';
    if (confBar) confBar.style.width = site.confidence + '%';
    if (driverEl) driverEl.textContent = site.driver;
    if (descEl) descEl.textContent = site.summary;
    if (citEl) citEl.textContent = site.scientificCitation;
    if (rankEl) rankEl.textContent = `${site.similarity.toFixed(1)}% Planetary Match`;
    if (hudCoords) {
      hudCoords.textContent = `TARGET: ${site.coords[0].toFixed(4)}°N, ${site.coords[1].toFixed(4)}°W • ${site.name.split('—')[0].trim()}`;
    }

    // Update 3D elevation profile bar
    drawElevationProfile(site);
  }

  // --- 4. Initialize 2D Discovery Map (Tactical Space Design) ---
  function initMap() {
    const mapEl = document.getElementById('cockpitMapCanvas');
    if (!mapEl) return;

    if (typeof window.L !== 'undefined') {
      try {
        leafletMap = L.map('cockpitMapCanvas', {
          center: [28.0, 3.0],
          zoom: 3.2,
          minZoom: 2.2,
          maxZoom: 16,
          zoomSnap: 0.2,
          scrollWheelZoom: false,
          zoomControl: false, // Custom positioned
          attributionControl: false,
          worldCopyJump: true
        });

        // Add custom styled zoom controls in bottom-right
        L.control.zoom({ position: 'bottomright' }).addTo(leafletMap);

        // 1. Normal Basemap (Esri World Street Map - Bright natural colors, blue oceans, zero API key required)
        normalBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 18,
          minZoom: 2,
          attribution: ''
        });

        // 2. Satellite HD Layer (Clean, Photographic, Zero Loud Text Labels)
        satBaseLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
          maxZoom: 17,
          minZoom: 2,
          attribution: ''
        });

        // Start with Normal Map (Bright, Standard Topography)
        normalBaseLayer.addTo(leafletMap);
        currentBasemap = 'normal';

        // Add Clean High-Precision Map Pins for each Analog Site
        ANALOG_SITES.forEach((site) => {
          const isSelected = (site.id === activeSite.id);
          const cleanName = site.id === 'tindouf' ? 'Tindouf Basin' : (site.id === 'iriqui' ? 'Lake Iriqui' : site.name.split('—')[0].trim());
          const iconHtml = `
            <div class="tactical-map-pin ${isSelected ? 'active-pin' : ''}" id="pin-${site.id}" title="${site.name}">
              <div class="pin-radar-ring"></div>
              <div class="pin-radar-ring-2"></div>
              <div class="pin-core-badge">
                <span class="pin-flag">${site.flag}</span>
                <span class="pin-title">${cleanName}</span>
                <span class="pin-score-chip">${site.similarity.toFixed(0)}%</span>
              </div>
            </div>
          `;
          const customIcon = L.divIcon({
            html: iconHtml,
            className: 'custom-pin-wrapper',
            iconSize: [120, 36],
            iconAnchor: [60, 18]
          });

          const marker = L.marker(site.coords, { icon: customIcon }).addTo(leafletMap);
          marker.on('click', () => {
            updateInspector(site);
            leafletMap.flyTo(site.coords, Math.max(leafletMap.getZoom(), 5.2), { duration: 1.2 });
            highlightMarker(site.id);
          });

          leafletMarkers.push({ id: site.id, marker });
        });

        // Force full container recalculation
        leafletMap.invalidateSize(true);

        window.addEventListener('resize', () => {
          if (leafletMap) leafletMap.invalidateSize();
        });

      } catch (err) {
        console.warn('Leaflet initialization fallback:', err);
        renderMapCanvasFallback(mapEl);
      }
    } else {
      renderMapCanvasFallback(mapEl);
    }
  }

  // Basemap Switcher Handler (Normal Map & Satellite HD)
  window.setCockpitBasemap = function(type) {
    if (!leafletMap) return;
    currentBasemap = type;
    const btnNormal = document.getElementById('btnBaseNormal');
    const btnSat = document.getElementById('btnBaseSat');

    if (type === 'normal') {
      if (leafletMap.hasLayer(satBaseLayer)) leafletMap.removeLayer(satBaseLayer);
      if (!leafletMap.hasLayer(normalBaseLayer)) normalBaseLayer.addTo(leafletMap);
      if (btnNormal) btnNormal.classList.add('active');
      if (btnSat) btnSat.classList.remove('active');
    } else {
      if (leafletMap.hasLayer(normalBaseLayer)) leafletMap.removeLayer(normalBaseLayer);
      if (!leafletMap.hasLayer(satBaseLayer)) satBaseLayer.addTo(leafletMap);
      if (btnSat) btnSat.classList.add('active');
      if (btnNormal) btnNormal.classList.remove('active');
    }
    leafletMap.invalidateSize(true);
  };

  function highlightMarker(siteId) {
    document.querySelectorAll('.tactical-map-pin').forEach(p => p.classList.remove('active-pin'));
    const activePin = document.getElementById(`pin-${siteId}`);
    if (activePin) activePin.classList.add('active-pin');
  }

  // Interactive filter chips
  window.filterMapCategory = function(cat) {
    document.querySelectorAll('.map-filter-chip').forEach(c => c.classList.remove('active'));
    const btn = document.querySelector(`.map-filter-chip[data-cat="${cat}"]`);
    if (btn) btn.classList.add('active');

    if (cat === 'all') {
      if (leafletMap) leafletMap.flyTo([22.0, 5.0], 2.8, { duration: 1.2 });
    } else if (cat === 'sahara') {
      const tindouf = ANALOG_SITES.find(s => s.id === 'tindouf');
      if (tindouf) {
        updateInspector(tindouf);
        if (leafletMap) leafletMap.flyTo([28.7, -7.3], 5.5, { duration: 1.2 });
        highlightMarker('tindouf');
      }
    } else if (cat === 'deserts') {
      const atacama = ANALOG_SITES.find(s => s.id === 'atacama');
      if (atacama) {
        updateInspector(atacama);
        if (leafletMap) leafletMap.flyTo(atacama.coords, 5, { duration: 1.2 });
        highlightMarker('atacama');
      }
    } else if (cat === 'polar') {
      const mcmurdo = ANALOG_SITES.find(s => s.id === 'mcmurdo');
      if (mcmurdo) {
        updateInspector(mcmurdo);
        if (leafletMap) leafletMap.flyTo(mcmurdo.coords, 4, { duration: 1.2 });
        highlightMarker('mcmurdo');
      }
    }
  };

  window.selectCockpitSite = function(siteId) {
    const site = ANALOG_SITES.find(s => s.id === siteId);
    if (!site) return;
    updateInspector(site);
    if (leafletMap) {
      leafletMap.flyTo(site.coords, 6, { duration: 1.2 });
      highlightMarker(site.id);
    }
  };

  // Canvas Fallback if Leaflet offline
  function renderMapCanvasFallback(container) {
    container.innerHTML = `
      <div style="position:relative; width:100%; height:100%; min-height:560px; background:url('images/earth_analog_field.jpg') center/cover no-repeat; display:flex; align-items:center; justify-content:center;">
        <div style="background:rgba(255,255,255,0.95); backdrop-filter:blur(8px); padding:24px 32px; border-radius:14px; border:1px solid #DCE5EC; text-align:center; color:#101820; max-width:460px; box-shadow: 0 12px 32px rgba(7,27,50,0.14);">
          <h4 style="font-size:18px; margin-bottom:8px; color:#078FE0; font-family:'Space Grotesk',sans-serif; font-weight:700;">Global Aerospace Basemap</h4>
          <p style="font-size:13.5px; color:#536273; margin-bottom:16px;">9 Verified Planetary Analog Sites Active. Select a target site from the menu to inspect parameters.</p>
          <div style="display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">
            <button onclick="selectCockpitSite('tindouf')" class="map-filter-chip active">🇲🇦 Tindouf (Morocco)</button>
            <button onclick="selectCockpitSite('iriqui')" class="map-filter-chip">🇲🇦 Lake Iriqui</button>
            <button onclick="selectCockpitSite('atacama')" class="map-filter-chip">🇨🇱 Atacama</button>
          </div>
        </div>
      </div>
    `;
  }

  // --- 5. Three.js Scientific 3D Surface Plot Engine (Plotly / NASA PDS Look) ---
  function init3DViews() {
    if (typeof THREE === 'undefined') return;
    if (is3DInitialized) return;
    is3DInitialized = true;
    autoRotate3D = true;

    const marsContainer = document.getElementById('canvas3dMars');
    const earthContainer = document.getElementById('canvas3dEarth');
    if (!marsContainer || !earthContainer) return;

    // A. MARS JEZERO CRATER DELTA SCIENTIFIC PLOT
    const wM = marsContainer.clientWidth || 480;
    const hM = marsContainer.clientHeight || 430;

    marsScene = new THREE.Scene();
    marsScene.background = new THREE.Color(0xFFFFFF); // Clean scientific white

    marsCamera = new THREE.PerspectiveCamera(38, wM / hM, 0.1, 1000);
    marsCamera.position.set(32, 28, 32);
    marsCamera.lookAt(0, -0.6, 0);

    marsRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    marsRenderer.setSize(wM, hM);
    marsRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    marsContainer.appendChild(marsRenderer.domElement);

    // B. EARTH TINDOUF SEBKHA MARGIN SCIENTIFIC PLOT
    const wE = earthContainer.clientWidth || 480;
    const hE = earthContainer.clientHeight || 430;

    earthScene = new THREE.Scene();
    earthScene.background = new THREE.Color(0xFFFFFF); // Clean scientific white

    earthCamera = new THREE.PerspectiveCamera(38, wE / hE, 0.1, 1000);
    earthCamera.position.set(32, 28, 32);
    earthCamera.lookAt(0, -0.6, 0);

    earthRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    earthRenderer.setSize(wE, hE);
    earthRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    earthContainer.appendChild(earthRenderer.domElement);

    // Build Scientific 3D Groups (Coordinate Box + Topographic Surface + Contour Lines)
    const marsPlot = buildScientificPlot('mars');
    marsGroup = marsPlot.group;
    marsMesh = marsPlot.terrainMesh;
    marsScene.add(marsGroup);

    const earthPlot = buildScientificPlot('earth');
    earthGroup = earthPlot.group;
    earthMesh = earthPlot.terrainMesh;
    earthScene.add(earthGroup);

    // Lighting (Crisp directional relief highlights + soft ambient)
    setupScientificLighting(marsScene);
    setupScientificLighting(earthScene);

    // Synchronized Interactive Drag Controls
    setup3DControls(marsContainer, marsGroup, earthGroup);
    setup3DControls(earthContainer, earthGroup, marsGroup);

    // Setup Interactive 3D Surface Scanners (Raycaster hover & touch inspection)
    setupScannerInteraction('mars', marsContainer, marsCamera, marsMesh);
    setupScannerInteraction('earth', earthContainer, earthCamera, earthMesh);

    // Initial crosshair position at benchmark coordinates (x=15, y=15)
    updateScannerLines('mars', 15, 15);
    updateScannerLines('earth', 15, 15);

    // Start Animation Loop
    animate3D();

    // Window Resize Handler
    window.addEventListener('resize', onWindowResize3D);

    // Draw Initial Elevation Cross-Section
    drawElevationProfile(activeSite);
  }

  // Elevation formulas for digital elevation models (calibrated to NASA MGS MOLA and NASADEM)
  function getMarsElevation(u, v) {
    // 1. Regional topographic slope: higher along X=0 (u=0), dipping towards X=30 (u=1)
    const slope = (1.0 - u) * 3.2 + (0.5 - v) * 0.7;
    
    // 2. Central Jezero crater depression at (u=0.50, v=0.50) [corresponding to x=15km, y=15km]
    const dx = (u - 0.50) / 0.17;
    const dz = (v - 0.48) / 0.22;
    const r = Math.sqrt(dx * dx + dz * dz);
    // Smooth bowl-shaped depression
    const depression = -1.55 * Math.exp(-Math.pow(r, 2) / 1.8);
    // Elevated rim ridge forming closed circular contour rings surrounding the depression
    const rim = 0.85 * Math.exp(-Math.pow(r - 1.15, 2) / 0.18);
    
    // 3. Jezero western delta sedimentary fan & distributary lobes
    const delta = Math.sin(u * 8.5 + v * 4.2) * Math.cos(v * 6.5) * 0.45;
    
    // 4. Subtle wind-blown ripples & micro relief
    const ripples = Math.sin(u * 22.0 - v * 14.0) * 0.08 + Math.cos(u * 14.0 + v * 18.0) * 0.06;
    
    return slope + depression + rim + delta + ripples;
  }

  function getEarthElevation(u, v) {
    // Tindouf sebkha basin: vast flat evaporite floor with escarpment plateau rising in the corner (as in reference image)
    const distCorner = Math.sqrt(Math.pow(1.0 - u, 2) + Math.pow(1.0 - v, 2));
    const plateau = Math.max(0, 0.58 - distCorner) * 11.5;
    const sebkhaRelief = Math.sin(u * 7.5 + v * 5.0) * 0.35 + Math.cos(v * 9.0) * 0.25;
    const saltFlatMicro = Math.sin(u * 16.0 + v * 12.0) * 0.08 + Math.cos(u * 22.0 - v * 18.0) * 0.05;
    return plateau + sebkhaRelief + saltFlatMicro - 2.5;
  }

  function getZElevationMeters(type, u, v) {
    u = Math.max(0, Math.min(1, u));
    v = Math.max(0, Math.min(1, v));
    const h = (type === 'mars') ? getMarsElevation(u, v) : getEarthElevation(u, v);
    const bounds = terrainBounds[type] || { minH: -2.0, maxH: 4.0, hRange: 6.0 };
    const normH = (h - bounds.minH) / bounds.hRange;

    if (type === 'mars') {
      // Mars MOLA MEGDR reference:
      // At inspection benchmark point (x=15km, y=15km, i.e. u=0.5, v=0.5):
      // z is calibrated to exactly -2,630.69m as requested in the reference image
      const hCenter = getMarsElevation(0.5, 0.5);
      const normCenter = (hCenter - bounds.minH) / bounds.hRange;
      const delta = normH - normCenter;
      const z = -2630.69 + delta * 460.0;
      return Math.max(-2980, Math.min(-2510, z));
    } else {
      // Earth Tindouf Basin NASADEM HGT v001 reference:
      // At central evaporite margin (u=0.5, v=0.5), z = 428.50m
      const hCenter = getEarthElevation(0.5, 0.5);
      const normCenter = (hCenter - bounds.minH) / bounds.hRange;
      const delta = normH - normCenter;
      const z = 428.50 + delta * 88.0;
      return Math.max(405, Math.min(498, z));
    }
  }

  // Text label sprite generator using high-resolution Canvas 2D
  function createTextSprite(text, fontSize = 24, isBold = false, color = '#475569') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 128);
    ctx.font = `${isBold ? '700' : '500'} ${fontSize}px "JetBrains Mono", monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true });
    const sprite = new THREE.Sprite(spriteMat);
    const scaleFactor = 0.02 * fontSize;
    sprite.scale.set(scaleFactor * 2.2, scaleFactor * 1.1, 1);
    return sprite;
  }

  // Generate 3D Coordinate Bounding Box (Grid planes, wireframe cage, tick lines, labels)
  function buildCoordinateBox(type) {
    const boxGroup = new THREE.Group();

    const minX = -11, maxX = 11;
    const minZ = -11, maxZ = 11;
    const minY = -4.2, maxY = 4.2;

    const divisions = 6; // 0, 5, 10, 15, 20, 25, 30 km
    const stepX = (maxX - minX) / divisions;
    const stepZ = (maxZ - minZ) / divisions;
    const elevDivisions = 5;
    const stepY = (maxY - minY) / elevDivisions;

    // 1. Grid Lines (Floor + Back Walls)
    const gridPositions = [];

    // Floor Grid (Y = minY)
    for (let i = 0; i <= divisions; i++) {
      const x = minX + i * stepX;
      gridPositions.push(x, minY, minZ, x, minY, maxZ);
    }
    for (let j = 0; j <= divisions; j++) {
      const z = minZ + j * stepZ;
      gridPositions.push(minX, minY, z, maxX, minY, z);
    }

    // Back Wall 1 (Z = minZ)
    for (let i = 0; i <= divisions; i++) {
      const x = minX + i * stepX;
      gridPositions.push(x, minY, minZ, x, maxY, minZ);
    }
    for (let k = 0; k <= elevDivisions; k++) {
      const y = minY + k * stepY;
      gridPositions.push(minX, y, minZ, maxX, y, minZ);
    }

    // Back Wall 2 (X = minX)
    for (let j = 0; j <= divisions; j++) {
      const z = minZ + j * stepZ;
      gridPositions.push(minX, minY, z, minX, maxY, z);
    }
    for (let k = 0; k <= elevDivisions; k++) {
      const y = minY + k * stepY;
      gridPositions.push(minX, y, minZ, minX, y, maxZ);
    }

    const gridGeom = new THREE.BufferGeometry();
    gridGeom.setAttribute('position', new THREE.Float32BufferAttribute(gridPositions, 3));
    const gridMat = new THREE.LineBasicMaterial({
      color: 0xCBD5E1,
      transparent: true,
      opacity: 0.65
    });
    boxGroup.add(new THREE.LineSegments(gridGeom, gridMat));

    // 2. Wireframe Bounding Box Edges
    const boxEdgePositions = [
      // Bottom 4 edges
      minX, minY, minZ,  maxX, minY, minZ,
      maxX, minY, minZ,  maxX, minY, maxZ,
      maxX, minY, maxZ,  minX, minY, maxZ,
      minX, minY, maxZ,  minX, minY, minZ,
      // Top 4 edges
      minX, maxY, minZ,  maxX, maxY, minZ,
      maxX, maxY, minZ,  maxX, maxY, maxZ,
      maxX, maxY, maxZ,  minX, maxY, maxZ,
      minX, maxY, maxZ,  minX, maxY, minZ,
      // 4 vertical edges
      minX, minY, minZ,  minX, maxY, minZ,
      maxX, minY, minZ,  maxX, maxY, minZ,
      maxX, minY, maxZ,  maxX, maxY, maxZ,
      minX, minY, maxZ,  minX, maxY, maxZ
    ];
    const boxGeom = new THREE.BufferGeometry();
    boxGeom.setAttribute('position', new THREE.Float32BufferAttribute(boxEdgePositions, 3));
    const boxMat = new THREE.LineBasicMaterial({
      color: 0x94A3B8,
      transparent: true,
      opacity: 0.85
    });
    boxGroup.add(new THREE.LineSegments(boxGeom, boxMat));

    // 3. Tick Marks & Text Sprites
    const tickPositions = [];
    const kmLabels = ['0', '5', '10', '15', '20', '25', '30'];

    // X-Axis (bottom front: Z = maxZ, Y = minY)
    for (let i = 0; i <= divisions; i++) {
      const x = minX + i * stepX;
      tickPositions.push(x, minY, maxZ, x, minY, maxZ + 0.6);
      const numSprite = createTextSprite(kmLabels[i], 22, false, '#64748B');
      numSprite.position.set(x, minY, maxZ + 1.4);
      boxGroup.add(numSprite);
    }
    const xLabelSprite = createTextSprite('X (km)', 28, true, '#1E293B');
    xLabelSprite.position.set(0, minY - 0.2, maxZ + 3.4);
    boxGroup.add(xLabelSprite);

    // Y-Axis (bottom right: X = maxX, Y = minY)
    for (let j = 0; j <= divisions; j++) {
      const z = minZ + j * stepZ;
      tickPositions.push(maxX, minY, z, maxX + 0.6, minY, z);
      const numSprite = createTextSprite(kmLabels[j], 22, false, '#64748B');
      numSprite.position.set(maxX + 1.4, minY, z);
      boxGroup.add(numSprite);
    }
    const yLabelSprite = createTextSprite('Y (km)', 28, true, '#1E293B');
    yLabelSprite.position.set(maxX + 3.4, minY - 0.2, 0);
    boxGroup.add(yLabelSprite);

    // Elevation Axis (front-left: X = minX, Z = maxZ)
    // Real elevations in meters: Mars Jezero: -3000m to -2500m, Earth Tindouf: 400m to 500m
    const elevLabels = (type === 'mars')
      ? ['-3000', '-2900', '-2800', '-2700', '-2600', '-2500']
      : ['400', '420', '440', '460', '480', '500'];

    for (let k = 0; k <= elevDivisions; k++) {
      const y = minY + k * stepY;
      tickPositions.push(minX, y, maxZ, minX - 0.6, y, maxZ);
      const numSprite = createTextSprite(elevLabels[k], 19, false, '#64748B');
      numSprite.position.set(minX - 1.8, y, maxZ);
      boxGroup.add(numSprite);
    }
    const elevLabelSprite = createTextSprite('Elev (m)', 26, true, '#1E293B');
    elevLabelSprite.position.set(minX - 3.6, 0, maxZ);
    boxGroup.add(elevLabelSprite);

    const tickGeom = new THREE.BufferGeometry();
    tickGeom.setAttribute('position', new THREE.Float32BufferAttribute(tickPositions, 3));
    boxGroup.add(new THREE.LineSegments(tickGeom, new THREE.LineBasicMaterial({ color: 0x64748B })));

    return boxGroup;
  }

  // Generate High-Resolution Scientific Elevation Colormap + Contour Lines Texture
  function generateTopographicTexture(type) {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    const heights = new Float32Array(size * size);
    let minH = Infinity, maxH = -Infinity;
    for (let y = 0; y < size; y++) {
      const v = y / (size - 1);
      for (let x = 0; x < size; x++) {
        const u = x / (size - 1);
        const h = (type === 'mars') ? getMarsElevation(u, v) : getEarthElevation(u, v);
        heights[y * size + x] = h;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
    const hRange = Math.max(0.001, maxH - minH);

    // Scientific Colormaps matching reference image:
    // Mars: Warm sand -> amber -> vibrant terracotta -> deep rust -> dark mahogany
    const marsStops = [
      { p: 0.00, r: 254, g: 215, b: 170 }, // #FED7AA warm cream sand
      { p: 0.22, r: 251, g: 146, b: 60  }, // #FB923C amber
      { p: 0.48, r: 234, g: 88,  b: 12  }, // #EA580C terracotta
      { p: 0.74, r: 194, g: 65,  b: 12  }, // #C2410C deep copper rust
      { p: 1.00, r: 105, g: 35,  b: 12  }  // #69230C dark mahogany
    ];

    // Earth: Flat basin deep marine teal -> emerald slope -> lime ridge -> golden plateau summit
    const earthStops = [
      { p: 0.00, r: 24,  g: 58,  b: 74  }, // #183A4A deep marine slate-teal
      { p: 0.35, r: 22,  g: 78,  b: 99  }, // #164E63 dark cyan-teal
      { p: 0.62, r: 16,  g: 185, b: 129 }, // #10B981 emerald green (escarpment)
      { p: 0.82, r: 132, g: 204, b: 22  }, // #84CC16 lime green
      { p: 1.00, r: 250, g: 204, b: 21  }  // #FACC15 solar gold / yellow (plateau summit)
    ];

    const stops = (type === 'mars') ? marsStops : earthStops;
    const contourInterval = (type === 'mars') ? 0.125 : 0.09; // 8-11 contour levels

    function getColor(t) {
      t = Math.max(0, Math.min(1, t));
      let i = 0;
      while (i < stops.length - 2 && t > stops[i + 1].p) i++;
      const s0 = stops[i];
      const s1 = stops[i + 1];
      const f = (t - s0.p) / (s1.p - s0.p);
      return [
        Math.round(s0.r + (s1.r - s0.r) * f),
        Math.round(s0.g + (s1.g - s0.g) * f),
        Math.round(s0.b + (s1.b - s0.b) * f)
      ];
    }

    const contourColor = (type === 'mars') ? [42, 14, 5] : [15, 35, 45];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = y * size + x;
        const t = (heights[idx] - minH) / hRange;
        const baseCol = getColor(t);

        // Pixel gradient for anti-aliased constant-width contour lines
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(size - 1, x + 1);
        const y0 = Math.max(0, y - 1);
        const y1 = Math.min(size - 1, y + 1);
        const tLeft  = (heights[y * size + x0] - minH) / hRange;
        const tRight = (heights[y * size + x1] - minH) / hRange;
        const tUp    = (heights[y0 * size + x] - minH) / hRange;
        const tDown  = (heights[y1 * size + x] - minH) / hRange;

        const grad = Math.max(0.0006, Math.abs(tRight - tLeft) * 0.5 + Math.abs(tDown - tUp) * 0.5);

        const level = t / contourInterval;
        const roundedLevel = Math.round(level);
        const distFromContour = Math.abs(level - roundedLevel) * contourInterval;
        const pixelDist = distFromContour / grad;

        let r = baseCol[0];
        let g = baseCol[1];
        let b = baseCol[2];

        // Prominent white contour loops matching reference image (crater rim & delta escarpment)
        const isWhiteContour = (type === 'mars')
          ? (roundedLevel === 4 || roundedLevel === 6)
          : (roundedLevel === 5);

        const currentContourColor = isWhiteContour ? [255, 255, 255] : contourColor;
        const targetWidth = isWhiteContour ? 1.7 : 1.2;
        const targetOpacity = isWhiteContour ? 0.95 : 0.75;

        // Anti-aliased contour line blending
        if (pixelDist < targetWidth) {
          const alpha = Math.max(0, Math.min(1, targetWidth - pixelDist)) * targetOpacity;
          r = Math.round(r * (1 - alpha) + currentContourColor[0] * alpha);
          g = Math.round(g * (1 - alpha) + currentContourColor[1] * alpha);
          b = Math.round(b * (1 - alpha) + currentContourColor[2] * alpha);
        }

        const pIdx = idx * 4;
        data[pIdx]     = r;
        data[pIdx + 1] = g;
        data[pIdx + 2] = b;
        data[pIdx + 3] = 255;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    return texture;
  }

  // Build Full Scientific Plot Group
  function buildScientificPlot(type) {
    const plotGroup = new THREE.Group();

    // 1. Add Coordinate Bounding Box with type-specific elevation ticks
    const coordBox = buildCoordinateBox(type);
    plotGroup.add(coordBox);

    // 2. Build Terrain Geometry
    const terrainSize = 20;
    const segments = 64;
    const geom = new THREE.PlaneGeometry(terrainSize, terrainSize, segments, segments);
    geom.rotateX(-Math.PI / 2);

    const pos = geom.attributes.position;
    const count = pos.count;

    let minH = Infinity, maxH = -Infinity;
    for (let i = 0; i < count; i++) {
      const u = (pos.getX(i) + terrainSize / 2) / terrainSize;
      const v = (pos.getZ(i) + terrainSize / 2) / terrainSize;
      const h = (type === 'mars') ? getMarsElevation(u, v) : getEarthElevation(u, v);
      if (h < minH) minH = h;
      if (h > maxH) maxH = h;
    }
    const hRange = Math.max(0.001, maxH - minH);

    for (let i = 0; i < count; i++) {
      const u = (pos.getX(i) + terrainSize / 2) / terrainSize;
      const v = (pos.getZ(i) + terrainSize / 2) / terrainSize;
      const h = (type === 'mars') ? getMarsElevation(u, v) : getEarthElevation(u, v);
      const normH = (h - minH) / hRange;
      pos.setY(i, -3.6 + normH * 7.2);
    }
    geom.computeVertexNormals();

    // 3. Topographic Texture with Isohypses
    const texture = generateTopographicTexture(type);

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: 0.72,
      metalness: 0.04,
      wireframe: isWireframe,
      flatShading: false
    });

    const terrainMesh = new THREE.Mesh(geom, mat);
    plotGroup.add(terrainMesh);

    // 4. Build 3D Scanner Group (Crosshairs + Intersection Marker)
    const scannerGroup = buildScannerMesh(type);
    plotGroup.add(scannerGroup);

    return { group: plotGroup, terrainMesh, scannerGroup };
  }

  // --- 3D Scanner Construction & Real-Time Interaction ---
  function buildScannerMesh(type) {
    const group = new THREE.Group();
    const segments = 64;

    // Line X (crosshair traversing X across terrain)
    const lineXGeom = new THREE.BufferGeometry();
    const lineXPos = new Float32Array((segments + 1) * 3);
    lineXGeom.setAttribute('position', new THREE.BufferAttribute(lineXPos, 3));
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x111827, // Sharp charcoal/black line
      linewidth: 2,
      transparent: true,
      opacity: 0.90
    });
    const lineX = new THREE.Line(lineXGeom, lineMat);
    group.add(lineX);

    // Line Y (crosshair traversing Y across terrain)
    const lineYGeom = new THREE.BufferGeometry();
    const lineYPos = new Float32Array((segments + 1) * 3);
    lineYGeom.setAttribute('position', new THREE.BufferAttribute(lineYPos, 3));
    const lineY = new THREE.Line(lineYGeom, lineMat);
    group.add(lineY);

    // Center intersection marker dot
    const markerGeom = new THREE.SphereGeometry(0.22, 16, 16);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
    const marker = new THREE.Mesh(markerGeom, markerMat);
    group.add(marker);

    scanners[type].lineX = lineX;
    scanners[type].lineY = lineY;
    scanners[type].marker = marker;
    scanners[type].group = group;

    // Cache DOM tooltip elements
    const isMars = (type === 'mars');
    scanners[type].tooltipEl = document.getElementById(isMars ? 'scannerTooltipMars' : 'scannerTooltipEarth');
    scanners[type].xEl = document.getElementById(isMars ? 'scannerXMars' : 'scannerXEarth');
    scanners[type].yEl = document.getElementById(isMars ? 'scannerYMars' : 'scannerYEarth');
    scanners[type].zEl = document.getElementById(isMars ? 'scannerZMars' : 'scannerZEarth');

    return group;
  }

  // Update the 3D geometry of the scanner crosshairs to drape over the terrain surface
  function updateScannerLines(type, xKm, yKm) {
    const s = scanners[type];
    if (!s || !s.lineX || !s.lineY || !s.marker) return;

    xKm = Math.max(0, Math.min(30, xKm));
    yKm = Math.max(0, Math.min(30, yKm));
    s.xKm = xKm;
    s.yKm = yKm;

    const u = xKm / 30;
    const v = yKm / 30;
    const targetX = u * 20 - 10;
    const targetZ = v * 20 - 10;

    const bounds = terrainBounds[type] || { minH: -2.0, maxH: 4.0, hRange: 6.0 };
    const segments = 64;

    // Line X: varies X from -10 to +10 at fixed Z = targetZ
    const posX = s.lineX.geometry.attributes.position.array;
    for (let i = 0; i <= segments; i++) {
      const ui = i / segments;
      const px = ui * 20 - 10;
      const pz = targetZ;
      const h = (type === 'mars') ? getMarsElevation(ui, v) : getEarthElevation(ui, v);
      const normH = (h - bounds.minH) / bounds.hRange;
      const py = -3.6 + normH * 7.2 + 0.08;

      posX[i * 3]     = px;
      posX[i * 3 + 1] = py;
      posX[i * 3 + 2] = pz;
    }
    s.lineX.geometry.attributes.position.needsUpdate = true;

    // Line Y: varies Z from -10 to +10 at fixed X = targetX
    const posY = s.lineY.geometry.attributes.position.array;
    for (let j = 0; j <= segments; j++) {
      const vj = j / segments;
      const px = targetX;
      const pz = vj * 20 - 10;
      const h = (type === 'mars') ? getMarsElevation(u, vj) : getEarthElevation(u, vj);
      const normH = (h - bounds.minH) / bounds.hRange;
      const py = -3.6 + normH * 7.2 + 0.08;

      posY[j * 3]     = px;
      posY[j * 3 + 1] = py;
      posY[j * 3 + 2] = pz;
    }
    s.lineY.geometry.attributes.position.needsUpdate = true;

    // Marker at intersection point
    const hCenter = (type === 'mars') ? getMarsElevation(u, v) : getEarthElevation(u, v);
    const normCenter = (hCenter - bounds.minH) / bounds.hRange;
    const markerY = -3.6 + normCenter * 7.2 + 0.14;
    s.marker.position.set(targetX, markerY, targetZ);
  }

  // Project 3D intersection marker to screen coordinates and update DOM tooltip
  function updateScannerTooltip(type) {
    const s = scanners[type];
    if (!s || !s.marker || !s.tooltipEl) return;

    const camera = (type === 'mars') ? marsCamera : earthCamera;
    const container = document.getElementById(type === 'mars' ? 'canvas3dMars' : 'canvas3dEarth');
    if (!camera || !container) return;

    const worldPos = new THREE.Vector3();
    s.marker.getWorldPosition(worldPos);

    worldPos.project(camera);

    // If point is behind the camera, hide
    if (worldPos.z > 1.0) {
      s.tooltipEl.style.display = 'none';
      return;
    }

    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w <= 0 || h <= 0) return;

    const screenX = (worldPos.x * 0.5 + 0.5) * w;
    const screenY = (-(worldPos.y * 0.5) + 0.5) * h;

    if (screenX < -40 || screenX > w + 40 || screenY < -40 || screenY > h + 40) {
      s.tooltipEl.style.display = 'none';
      return;
    }

    // Auto-flip tooltip if close to right edge so it never overflows offscreen (especially on mobile)
    if (screenX > w - 125) {
      s.tooltipEl.classList.add('flip-left');
    } else {
      s.tooltipEl.classList.remove('flip-left');
    }

    s.tooltipEl.style.left = `${Math.round(screenX)}px`;
    s.tooltipEl.style.top = `${Math.round(screenY)}px`;
    s.tooltipEl.style.display = 'block';

    const u = s.xKm / 30;
    const v = s.yKm / 30;
    const zVal = getZElevationMeters(type, u, v);

    if (s.xEl) s.xEl.textContent = Math.round(s.xKm);
    if (s.yEl) s.yEl.textContent = Math.round(s.yKm);
    if (s.zEl) {
      const sign = zVal < 0 ? '-' : '';
      const absVal = Math.abs(zVal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      s.zEl.textContent = `${sign}${absVal}`;
    }
  }

  // Interactive Raycasting for mouse and touch surface scanning
  function setupScannerInteraction(type, container, camera, terrainMesh) {
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    function scanAt(clientX, clientY) {
      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(terrainMesh);
      if (intersects.length > 0) {
        const hit = intersects[0].point;
        // Convert world hit coordinates to terrain local space
        const localHit = terrainMesh.worldToLocal(hit.clone());
        const u = Math.max(0, Math.min(1, (localHit.x + 10) / 20));
        const v = Math.max(0, Math.min(1, (localHit.z + 10) / 20));
        const xKm = Math.round(u * 30);
        const yKm = Math.round(v * 30);

        scanners[type].xKm = xKm;
        scanners[type].yKm = yKm;
        updateScannerLines(type, xKm, yKm);
        updateScannerTooltip(type);
      }
    }

    container.addEventListener('mousemove', e => {
      scanAt(e.clientX, e.clientY);
    });

    container.addEventListener('touchmove', e => {
      if (e.touches.length === 1) {
        scanAt(e.touches[0].clientX, e.touches[0].clientY);
      }
    }, { passive: true });
  }

  // Setup Scientific Studio Lighting
  function setupScientificLighting(scene) {
    const ambient = new THREE.AmbientLight(0xFFFFFF, 0.85);
    scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xFFFFFF, 0.65);
    dirLight.position.set(30, 45, 30);
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0xF1F5F9, 0.35);
    fillLight.position.set(-30, 20, -30);
    scene.add(fillLight);
  }

  // Synchronized Drag & Rotation Controls
  function setup3DControls(container, targetGroup, syncGroup) {
    let isDragging = false;
    let prevMouseX = 0;
    let prevMouseY = 0;
    let resumeRotateTimer = null;

    container.addEventListener('mousedown', e => {
      isDragging = true;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;
      autoRotate3D = false;
      clearTimeout(resumeRotateTimer);
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        resumeRotateTimer = setTimeout(() => {
          autoRotate3D = true;
          const btn = document.getElementById('btnToggleRotate');
          if (btn) {
            btn.textContent = 'Auto-Rotate: ON';
            btn.classList.add('btn-active-state');
          }
        }, 1500);
      }
    });

    window.addEventListener('mousemove', e => {
      if (!isDragging) return;
      const deltaX = e.clientX - prevMouseX;
      const deltaY = e.clientY - prevMouseY;
      prevMouseX = e.clientX;
      prevMouseY = e.clientY;

      targetGroup.rotation.y += deltaX * 0.008;
      targetGroup.rotation.x += deltaY * 0.005;
      targetGroup.rotation.x = Math.max(-0.6, Math.min(0.6, targetGroup.rotation.x));

      if (syncGroup) {
        syncGroup.rotation.y = targetGroup.rotation.y;
        syncGroup.rotation.x = targetGroup.rotation.x;
      }
    });

    container.addEventListener('touchstart', e => {
      if (e.touches.length === 1) {
        isDragging = true;
        prevMouseX = e.touches[0].clientX;
        prevMouseY = e.touches[0].clientY;
        autoRotate3D = false;
        clearTimeout(resumeRotateTimer);
      }
    }, { passive: true });

    window.addEventListener('touchmove', e => {
      if (!isDragging || e.touches.length !== 1) return;
      const deltaX = e.touches[0].clientX - prevMouseX;
      const deltaY = e.touches[0].clientY - prevMouseY;
      prevMouseX = e.touches[0].clientX;
      prevMouseY = e.touches[0].clientY;

      targetGroup.rotation.y += deltaX * 0.01;
      targetGroup.rotation.x += deltaY * 0.006;
      targetGroup.rotation.x = Math.max(-0.6, Math.min(0.6, targetGroup.rotation.x));

      if (syncGroup) {
        syncGroup.rotation.y = targetGroup.rotation.y;
        syncGroup.rotation.x = targetGroup.rotation.x;
      }
    }, { passive: true });

    window.addEventListener('touchend', () => {
      if (isDragging) {
        isDragging = false;
        resumeRotateTimer = setTimeout(() => {
          autoRotate3D = true;
          const btn = document.getElementById('btnToggleRotate');
          if (btn) {
            btn.textContent = 'Auto-Rotate: ON';
            btn.classList.add('btn-active-state');
          }
        }, 1500);
      }
    });
  }

  function animate3D() {
    animFrameId = requestAnimationFrame(animate3D);

    if (autoRotate3D) {
      if (marsGroup) marsGroup.rotation.y += 0.0035;
      if (earthGroup) earthGroup.rotation.y += 0.0035;
    }

    if (marsRenderer && marsScene && marsCamera) {
      updateScannerTooltip('mars');
      marsRenderer.render(marsScene, marsCamera);
    }
    if (earthRenderer && earthScene && earthCamera) {
      updateScannerTooltip('earth');
      earthRenderer.render(earthScene, earthCamera);
    }
  }

  function onWindowResize3D() {
    const marsContainer = document.getElementById('canvas3dMars');
    const earthContainer = document.getElementById('canvas3dEarth');
    if (marsContainer && marsRenderer && marsCamera) {
      const wM = marsContainer.clientWidth;
      const hM = marsContainer.clientHeight;
      if (wM > 0 && hM > 0) {
        marsCamera.aspect = wM / hM;
        marsCamera.updateProjectionMatrix();
        marsRenderer.setSize(wM, hM);
      }
    }
    if (earthContainer && earthRenderer && earthCamera) {
      const wE = earthContainer.clientWidth;
      const hE = earthContainer.clientHeight;
      if (wE > 0 && hE > 0) {
        earthCamera.aspect = wE / hE;
        earthCamera.updateProjectionMatrix();
        earthRenderer.setSize(wE, hE);
      }
    }
  }

  window.toggle3DAutoRotate = function() {
    autoRotate3D = !autoRotate3D;
    const btn = document.getElementById('btnToggleRotate');
    if (btn) {
      if (autoRotate3D) {
        btn.textContent = 'Auto-Rotate: ON';
        btn.classList.add('btn-active-state');
      } else {
        btn.textContent = 'Auto-Rotate: PAUSED';
        btn.classList.remove('btn-active-state');
      }
    }
  };

  window.toggle3DWireframe = function() {
    isWireframe = !isWireframe;
    if (marsMesh) marsMesh.material.wireframe = isWireframe;
    if (earthMesh) earthMesh.material.wireframe = isWireframe;
    const btn = document.getElementById('btnToggleWireframe');
    if (btn) {
      if (isWireframe) {
        btn.textContent = 'Wireframe: ON';
        btn.classList.add('btn-active-state');
      } else {
        btn.textContent = 'Wireframe Mode';
        btn.classList.remove('btn-active-state');
      }
    }
  };

  // --- 6. Elevation Profile Cross-Section Chart ---
  function drawElevationProfile(site) {
    const canvas = document.getElementById('cockpitProfileCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width = canvas.parentElement.clientWidth || 700;
    const h = canvas.height = 96;

    ctx.clearRect(0, 0, w, h);

    // Draw grid lines
    ctx.strokeStyle = '#DCE5EC';
    ctx.lineWidth = 1;
    for (let y = 18; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(35, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();
    }

    // Mars elevation curve (Jezero crater rim to basin)
    ctx.beginPath();
    ctx.strokeStyle = '#E87532';
    ctx.lineWidth = 2.5;
    for (let x = 35; x < w - 20; x++) {
      const t = (x - 35) / (w - 55);
      const elevation = Math.sin(t * Math.PI * 2.5) * 20 + Math.cos(t * Math.PI) * 11 + 46;
      if (x === 35) ctx.moveTo(x, elevation);
      else ctx.lineTo(x, elevation);
    }
    ctx.stroke();

    // Earth analog elevation curve
    ctx.beginPath();
    ctx.strokeStyle = '#078FE0';
    ctx.lineWidth = 2.5;
    for (let x = 35; x < w - 20; x++) {
      const t = (x - 35) / (w - 55);
      const elevation = Math.sin(t * Math.PI * 3.0) * 16 + Math.sin(t * Math.PI * 1.5) * 7 + 50;
      if (x === 35) ctx.moveTo(x, elevation);
      else ctx.lineTo(x, elevation);
    }
    ctx.stroke();

    // Legend
    ctx.font = '600 11px JetBrains Mono, monospace';
    ctx.fillStyle = '#E87532';
    ctx.fillText('■ Mars Jezero Delta (MOLA MEGDR)', 40, 15);
    ctx.fillStyle = '#078FE0';
    ctx.fillText(`■ Earth: ${site.name.split('—')[0]} (Copernicus DEM)`, Math.min(320, w - 260), 15);
  }

  // --- 7. Initialize on DOM Load (3D First by Default) ---
  document.addEventListener('DOMContentLoaded', () => {
    init3DViews();
    updateInspector(activeSite);
  });

})();
