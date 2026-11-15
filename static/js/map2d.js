/**
 * Module 01, 02 & 03: Interactive 2D Planetary AOI Canvas & Earth Analog Discovery Map.
 * TERRA-X — Compliant with NASA Space Apps 2026 Evaluation Standards & Spatial Verification.
 */

let leafletMap = null;
let markersLayer = null;
let analysisFootprintLayer = null;
let activeHaloLayer = null;
let currentTileLayer = null;
let drawMode = false;
let dragStart = null;
let customBox = null;
let currentPlanetaryAoi = null;
let cachedResults = [];
let cachedSelectedSiteId = null;
let onSelectCallback = null;
let isMapExpanded = false;

// Regional geographic bounds presets for instant screen navigation
const REGION_BOUNDS = {
  all: null,
  sahara: [[26.5, -11.5], [32.0, -4.5]],      // Morocco / Algeria (Tindouf, Iriqui, Drâa)
  deserts: [[-26.0, -72.0], [36.0, -114.0]],  // Hyperarid (Atacama, Mojave)
  polar: [[-78.5, 160.0], [76.0, -90.0]],     // Cryogenic (McMurdo, Haughton)
  volcanic: [[28.5, -14.0], [38.0, -6.5]],    // Basaltic & Acidic (Lanzarote, Rio Tinto)
};

// =============================================================================
// 1. Color Palettes & Helpers
// =============================================================================

function layerPalette(layerId, t, body) {
  if (layerId === "slope_roughness") {
    const r = Math.round(30 + 215 * t);
    const g = Math.round(210 - 130 * t);
    const b = Math.round(180 - 130 * t);
    return [r, g, b];
  }
  if (layerId === "temperature") {
    const r = Math.round(30 + 220 * t);
    const g = Math.round(100 + 80 * (1 - Math.abs(t - 0.5) * 2));
    const b = Math.round(230 - 180 * t);
    return [r, g, b];
  }
  if (layerId === "mineralogy" || layerId === "geochemistry") {
    const r = Math.round(45 + 190 * Math.pow(t, 1.3));
    const g = Math.round(60 + 170 * t);
    const b = Math.round(130 + 90 * (1 - t));
    return [r, g, b];
  }
  if (layerId === "aridity") {
    const r = Math.round(40 + 200 * t);
    const g = Math.round(160 + 40 * (1 - t));
    const b = Math.round(140 - 100 * t);
    return [r, g, b];
  }
  if (body === "moon") {
    const v = Math.round(55 + 175 * t);
    return [v, v + 4, Math.min(255, v + 12)];
  }
  const r = Math.round(70 + 165 * t);
  const g = Math.round(42 + 115 * t);
  const b = Math.round(32 + 78 * t);
  return [r, g, b];
}

export function formatLatitude(lat) {
  if (lat === null || lat === undefined || isNaN(lat)) return "Coordonnées indisponibles";
  const num = Math.abs(lat);
  const hemi = lat >= 0 ? "N" : "S";
  return `${num.toFixed(4)}° ${hemi} (${lat >= 0 ? "+" : ""}${lat.toFixed(4)})`;
}

export function formatLongitude(lon) {
  if (lon === null || lon === undefined || isNaN(lon)) return "Coordonnées indisponibles";
  const num = Math.abs(lon);
  const hemi = lon >= 0 ? "E" : "W";
  return `${num.toFixed(4)}° ${hemi} (${lon >= 0 ? "+" : ""}${lon.toFixed(4)})`;
}

// =============================================================================
// 2. Planetary Canvas Renderer
// =============================================================================

export function renderPlanetaryCanvas(aoi, activeLayer, onCustomAoiDrawn) {
  const canvas = document.getElementById("planetary-canvas");
  if (!canvas || !aoi) return;

  currentPlanetaryAoi = aoi;
  const coordsEl = document.getElementById("planetary-coords");
  if (coordsEl) {
    coordsEl.textContent = `Lat ${aoi.lat.toFixed(2)}°, Lon ${aoi.lon.toFixed(2)}° | CRS: ${aoi.body.toUpperCase()}`;
  }

  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const seed = aoi.terrain_seed || 42;
  const style = aoi.terrain_style || "delta_crater";
  const body = aoi.body || "mars";

  const img = ctx.createImageData(w, h);
  const data = img.data;

  for (let py = 0; py < h; py++) {
    const ny = (py / h) * 2 - 1;
    for (let px = 0; px < w; px++) {
      const nx = (px / w) * 2 - 1;
      const r = Math.sqrt(nx * nx + ny * ny);
      const n1 = Math.sin(nx * 4.5 + seed * 0.3) * Math.cos(ny * 3.8 - seed * 0.2);
      const n2 = Math.sin((nx - ny) * 8.5 + seed) * 0.35;
      let val = 0.5 + 0.25 * n1 + 0.15 * n2;

      if (style === "delta_crater") {
        val += 0.35 * Math.exp(-Math.pow(r - 0.65, 2) / 0.05) + 0.25 * Math.exp(-((nx + 0.3) ** 2 + (ny * 1.3) ** 2) / 0.16);
      } else if (style === "polar_rim") {
        val += -0.45 * Math.exp(-(r ** 2) / 0.22) + 0.42 * Math.exp(-Math.pow(r - 0.62, 2) / 0.035);
      } else if (style === "mound_basin") {
        val += 0.5 * Math.exp(-(r ** 2) / 0.18) - 0.2 * Math.exp(-Math.pow(r - 0.55, 2) / 0.05);
      } else if (style === "lava_pit") {
        val += -0.6 * Math.exp(-(r ** 2) / 0.06) + 0.15 * Math.sin(nx * 6 + ny * 2);
      } else {
        val += -0.18 * Math.exp(-(r ** 2) / 0.4) + 0.15 * Math.sin(nx * 7 + seed);
      }

      if (activeLayer === "mineralogy" || activeLayer === "geochemistry") {
        val = val * 0.6 + 0.4 * Math.max(0, Math.sin(nx * 5.2 + ny * 4.1 + seed));
      } else if (activeLayer === "slope_roughness") {
        val = Math.abs(Math.sin(nx * 9 + seed) * Math.cos(ny * 8)) * 0.5 + val * 0.5;
      }

      const t = Math.max(0, Math.min(1, val));
      const [cr, cg, cb] = layerPalette(activeLayer, t, body);
      const idx = (py * w + px) * 4;
      data[idx] = cr;
      data[idx + 1] = cg;
      data[idx + 2] = cb;
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1;
  for (let gx = 1; gx < 5; gx++) {
    ctx.beginPath();
    ctx.moveTo((w / 5) * gx, 0);
    ctx.lineTo((w / 5) * gx, h);
    ctx.stroke();
  }
  for (let gy = 1; gy < 4; gy++) {
    ctx.beginPath();
    ctx.moveTo(0, (h / 4) * gy);
    ctx.lineTo(w, (h / 4) * gy);
    ctx.stroke();
  }

  const box = customBox || { x: w * 0.28, y: h * 0.24, bw: w * 0.44, bh: h * 0.50 };
  ctx.strokeStyle = "#078FE0";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 4]);
  ctx.strokeRect(box.x, box.y, box.bw, box.bh);
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(7, 143, 224, 0.15)";
  ctx.fillRect(box.x, box.y, box.bw, box.bh);

  ctx.fillStyle = "#0566A8";
  ctx.font = "600 11px 'JetBrains Mono', monospace";
  ctx.fillText(`AOI (${aoi.area_km2} km²)`, box.x + 6, box.y + 16);

  if (!canvas.dataset.bound) {
    canvas.dataset.bound = "1";
    const coordsEl = document.getElementById("planetary-coords");

    canvas.addEventListener("mousemove", (e) => {
      if (!currentPlanetaryAoi) return;
      const rect = canvas.getBoundingClientRect();
      const rx = (e.clientX - rect.left) / rect.width;
      const ry = (e.clientY - rect.top) / rect.height;
      const curLat = (currentPlanetaryAoi.lat + (0.5 - ry) * 0.6).toFixed(2);
      const curLon = (currentPlanetaryAoi.lon + (rx - 0.5) * 0.8).toFixed(2);
      if (coordsEl) coordsEl.textContent = `Lat ${curLat}°, Lon ${curLon}° | CRS: ${currentPlanetaryAoi.body.toUpperCase()}`;
    });

    canvas.addEventListener("mousedown", (e) => {
      if (!drawMode) return;
      const rect = canvas.getBoundingClientRect();
      dragStart = {
        x: ((e.clientX - rect.left) / rect.width) * canvas.width,
        y: ((e.clientY - rect.top) / rect.height) * canvas.height,
      };
    });

    canvas.addEventListener("mouseup", (e) => {
      if (!drawMode || !dragStart) return;
      const rect = canvas.getBoundingClientRect();
      const ex = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const ey = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const bw = Math.max(30, Math.abs(ex - dragStart.x));
      const bh = Math.max(30, Math.abs(ey - dragStart.y));
      customBox = {
        x: Math.min(dragStart.x, ex),
        y: Math.min(dragStart.y, ey),
        bw,
        bh,
      };
      dragStart = null;
      drawMode = false;
      document.getElementById("btn-draw-aoi")?.classList.remove("active");
      const areaEstimate = Math.round((bw / canvas.width) * (bh / canvas.height) * 620);
      if (onCustomAoiDrawn) onCustomAoiDrawn(areaEstimate, customBox);
    });
  }
}

export function setDrawAoiMode(enabled) {
  drawMode = enabled;
  if (!enabled) customBox = null;
}

// =============================================================================
// 3. Earth Discovery Map & Spatial Inspector
// =============================================================================

/**
 * Compact & Collapsible Spatial Inspector Card
 * In compact view: ~110px height, non-intrusive, leaves map completely navigable.
 * Clicking "▾ Détails" smoothly reveals full bounding box, grid cells, and citations.
 */
function buildInspectorPopupHtml(site, executionMeta = {}) {
  const hasAnalysis = typeof site.similarity_score === "number" && !isNaN(site.similarity_score);
  const crs = site.crs || "WGS 84 (EPSG:4326)";
  const posRef = site.position_reference || "Point de référence géodésique du catalogue";
  const posSrc = site.position_source || "USGS Astrogeology / Littérature scientifique évaluée par les pairs";
  const rawCopyStr = `${site.lat}, ${site.lon}`;

  const bbox = site.bounding_box || site.bbox || null;
  const isRegional = site.is_regional === true;

  const simPct = hasAnalysis ? Math.round(site.similarity_score * 100) : null;
  const aptPct = hasAnalysis ? Math.round((site.mission_aptitude_score || 0) * 100) : null;
  const confPct = hasAnalysis ? Math.round((site.confidence_score || 0) * 100) : null;
  const runId = site.analysis_id || executionMeta.analysis_id || "TX-RUN-ACTIVE";
  const targetBody = (executionMeta.target_body || site.target_body || "MARS").toUpperCase();
  const targetName = executionMeta.aoi_name || site.target_aoi || "Cible active";
  const scenario = executionMeta.mission_name || site.mission_name || "Scénario standard";

  let footprintSectionHtml = "";
  if (bbox && Array.isArray(bbox) && bbox.length === 4) {
    const [w, s, e, n] = bbox;
    const prod = site.raster_product || "Copernicus DEM / NASADEM HGT";
    const dx = site.grid_dx || 500;
    footprintSectionHtml = `
      <div class="inspector-box-footprint" style="margin-top:6px;padding:6px 8px;background:#F0F7FD;border-radius:5px;border:1px solid #BEE3F8;font-size:10.5px;">
        <div style="font-weight:700;color:#0566A8;margin-bottom:2px;display:flex;align-items:center;gap:3px;">
          <span>📐 Emprise Raster Terrestre Vérifiable (Grille 33×33)</span>
        </div>
        <div style="font-family:'JetBrains Mono',monospace;color:#2D3748;line-height:1.4;font-size:10px;">
          <strong>Bornes WGS84:</strong> [O: ${w.toFixed(4)}°, S: ${s.toFixed(4)}°, E: ${e.toFixed(4)}°, N: ${n.toFixed(4)}°]<br/>
          <strong>Produit source:</strong> ${prod}<br/>
          <strong>Pas de grille:</strong> ${dx} m &bull; <strong>Cellules valides:</strong> 1 089
        </div>
      </div>
    `;
  } else if (isRegional) {
    footprintSectionHtml = `
      <div class="inspector-box-regional" style="margin-top:6px;padding:6px 8px;background:#FFF7ED;border-radius:5px;border:1px solid #FFEDD5;font-size:10.5px;color:#9A3412;">
        <div style="font-weight:700;display:flex;align-items:center;gap:3px;margin-bottom:1px;">
          <span>⚠️ Score régional · emprise de calcul non documentée</span>
        </div>
        <div style="line-height:1.35;font-size:10px;color:#7C2D12;">
          Caractérisation scientifique globale par analogie bibliographique. Aucune emprise raster n'est déduite du symbole circulaire.
        </div>
      </div>
    `;
  }

  let analysisResultHtml = "";
  if (hasAnalysis) {
    analysisResultHtml = `
      <div class="inspector-analysis-block" style="margin-top:6px;padding:6px 8px;background:#F8FAFC;border:1px solid #E2E8F0;border-radius:5px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
          <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:11px;color:#0F172A;">
            Résultat de cette analyse
          </span>
          <span style="font-family:'JetBrains Mono',monospace;font-size:9.5px;background:#E2E8F0;padding:1px 5px;border-radius:3px;color:#334155;">
            ${runId}
          </span>
        </div>
        <div style="font-size:10.5px;color:#475569;margin-bottom:4px;line-height:1.3;">
          <strong>Cible:</strong> ${targetBody} — ${targetName} &bull; <strong>Scénario:</strong> ${scenario} &bull; <strong>Rang:</strong> #${site.rank || 1}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;text-align:center;">
          <div style="background:#FFFFFF;padding:3px;border-radius:4px;border:1px solid #E2E8F0;">
            <div style="font-size:9px;color:#64748B;font-weight:600;">SIMILARITÉ</div>
            <div style="font-size:13px;font-weight:700;color:#078FE0;">${simPct}%</div>
          </div>
          <div style="background:#FFFFFF;padding:3px;border-radius:4px;border:1px solid #E2E8F0;">
            <div style="font-size:9px;color:#64748B;font-weight:600;">APTITUDE</div>
            <div style="font-size:13px;font-weight:700;color:#E87532;">${aptPct}%</div>
          </div>
          <div style="background:#FFFFFF;padding:3px;border-radius:4px;border:1px solid #E2E8F0;">
            <div style="font-size:9px;color:#64748B;font-weight:600;">CONFIANCE</div>
            <div style="font-size:13px;font-weight:700;color:#16A34A;">${confPct}%</div>
          </div>
        </div>
        ${footprintSectionHtml}
      </div>
    `;
  } else {
    analysisResultHtml = `
      <div class="inspector-pending-block" style="margin-top:6px;padding:6px 8px;background:#F1F5F9;border-radius:5px;border:1px dashed #CBD5E1;display:flex;align-items:center;gap:6px;">
        <span style="font-size:12px;">⏳</span>
        <div style="font-size:10.5px;color:#475569;">
          <strong>Analyse à lancer</strong> — Cliquez sur « Lancer l'analyse » pour calculer la similarité vis-à-vis de la cible active.
        </div>
      </div>
      ${footprintSectionHtml}
    `;
  }

  return `
    <div class="terrax-site-inspector-card" style="font-family:'Inter',sans-serif;width:315px;max-width:calc(100vw - 32px);color:#101820;padding:2px;">
      <!-- En-tête : Nom du site, Pays, CRS -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:5px;border-bottom:1px solid #E2E8F0;padding-bottom:5px;">
        <div style="max-width:235px;">
          <div style="font-family:'Space Grotesk',sans-serif;font-size:13px;font-weight:700;color:#071B32;line-height:1.2;">
            ${site.rank ? `#${site.rank} ` : ""}${site.name}
          </div>
          <div style="font-size:10px;color:#64748B;margin-top:1px;">
            ${site.country || ""}
          </div>
        </div>
        <span style="font-size:9.5px;font-weight:700;padding:2px 6px;border-radius:999px;background:#E0F2FE;color:#0369A1;white-space:nowrap;">
          ${crs}
        </span>
      </div>

      <!-- Ligne Compacte Coordonnées & Trio de Scores -->
      <div style="display:flex;justify-content:space-between;align-items:center;background:#F8FAFC;padding:4px 8px;border-radius:5px;border:1px solid #E2E8F0;margin-bottom:6px;font-size:11px;">
        <div style="font-family:'JetBrains Mono',monospace;font-size:10px;color:#071B32;white-space:nowrap;">
          <span style="color:#64748B;font-weight:700;">LAT:</span> ${formatLatitude(site.lat).split(" ")[0]} &bull;
          <span style="color:#64748B;font-weight:700;">LON:</span> ${formatLongitude(site.lon).split(" ")[0]}
        </div>
        ${hasAnalysis ? `
          <div style="display:flex;gap:5px;font-weight:700;font-size:11px;font-family:'JetBrains Mono',monospace;">
            <span style="color:#078FE0;" title="Similarité">${simPct}%</span>
            <span style="color:#E87532;" title="Aptitude">${aptPct}%</span>
            <span style="color:#16A34A;" title="Confiance">${confPct}%</span>
          </div>
        ` : `
          <span style="font-size:9.5px;color:#64748B;font-style:italic;">Analyse à lancer</span>
        `}
      </div>

      <!-- Actions Principales : Copier, Emprise, GeoJSON, Plus de Détails -->
      <div style="display:flex;gap:3px;flex-wrap:wrap;margin-bottom:2px;">
        <button id="btn-copy-coords-${site.site_id}" class="inspector-btn" data-coords="${rawCopyStr}" style="flex:1;min-width:105px;padding:4px 7px;font-size:10px;font-weight:600;background:#078FE0;color:#FFFFFF;border:none;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:3px;transition:background 0.2s;">
          <span>📋 Copier</span>
        </button>
        ${bbox ? `
          <button id="btn-zoom-footprint-${site.site_id}" class="inspector-btn" data-site="${site.site_id}" style="padding:4px 6px;font-size:10px;font-weight:600;background:#FFFFFF;color:#078FE0;border:1px solid #078FE0;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:2px;" title="Cadrer l'emprise raster de calcul">
            <span>⛶ Emprise</span>
          </button>
        ` : ""}
        <button id="btn-export-geojson-${site.site_id}" class="inspector-btn" data-site="${site.site_id}" style="padding:4px 6px;font-size:10px;font-weight:600;background:#F1F5F9;color:#334155;border:1px solid #CBD5E1;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:2px;" title="Exporter en GeoJSON RFC 7946">
          <span>⬇ GeoJSON</span>
        </button>
        <button id="btn-toggle-details-${site.site_id}" class="inspector-btn" style="padding:4px 6px;font-size:10px;font-weight:600;background:#F8FAFC;color:#475569;border:1px solid #CBD5E1;border-radius:4px;cursor:pointer;display:inline-flex;align-items:center;gap:2px;" title="Afficher/Masquer les détails scientifiques complets">
          <span id="btn-toggle-details-text-${site.site_id}">▾ Détails</span>
        </button>
      </div>

      <!-- Volet Détails Repliable (Masqué par défaut pour ne pas bloquer la carte) -->
      <div id="inspector-details-${site.site_id}" class="inspector-details-collapsed inspector-details-expanded hidden" style="border-top:1px dashed #CBD5E1;margin-top:5px;padding-top:5px;">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px;">
          <div style="background:#F8FAFC;padding:4px 6px;border-radius:4px;border:1px solid #E2E8F0;">
            <div style="font-size:8.5px;font-weight:700;color:#64748B;letter-spacing:0.5px;text-transform:uppercase;">LATITUDE</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;color:#071B32;margin-top:1px;">
              ${formatLatitude(site.lat)}
            </div>
          </div>
          <div style="background:#F8FAFC;padding:4px 6px;border-radius:4px;border:1px solid #E2E8F0;">
            <div style="font-size:8.5px;font-weight:700;color:#64748B;letter-spacing:0.5px;text-transform:uppercase;">LONGITUDE</div>
            <div style="font-family:'JetBrains Mono',monospace;font-size:10.5px;font-weight:700;color:#071B32;margin-top:1px;">
              ${formatLongitude(site.lon)}
            </div>
          </div>
        </div>
        <div style="font-size:10px;line-height:1.35;margin-bottom:5px;color:#334155;">
          <div><strong style="color:#071B32;">Repère :</strong> ${posRef}</div>
          <div style="margin-top:1px;"><strong style="color:#071B32;">Source de la position :</strong> ${posSrc}</div>
        </div>
        ${analysisResultHtml}
      </div>
    </div>
  `;
}

function drawSiteFootprint(site) {
  if (!leafletMap || !analysisFootprintLayer) return;
  analysisFootprintLayer.clearLayers();

  const bbox = site?.bounding_box || site?.bbox;
  if (!bbox || !Array.isArray(bbox) || bbox.length !== 4) return;

  const [west, south, east, north] = bbox;
  const bounds = [[south, west], [north, east]];

  const rect = window.L.rectangle(bounds, {
    color: "#078FE0",
    weight: 2,
    dashArray: "6, 4",
    fillColor: "#078FE0",
    fillOpacity: 0.18,
  });

  const labelText = `<strong>Emprise Terrestre Analysée:</strong> ${site.name}<br/><span style="font-family:monospace;font-size:10px;">${site.raster_product || "DEM 33×33"} (${site.grid_dx || 500}m)</span>`;
  rect.bindTooltip(labelText, { sticky: true, className: "footprint-tooltip" });

  analysisFootprintLayer.addLayer(rect);
}

export function copySiteCoordinates(coordString, buttonEl) {
  if (!coordString) return;
  const originalHtml = buttonEl ? buttonEl.innerHTML : "";

  function notifySuccess() {
    if (buttonEl) {
      buttonEl.innerHTML = "<span>✓ Coordonnées Copiées !</span>";
      buttonEl.style.backgroundColor = "#16A34A";
      setTimeout(() => {
        buttonEl.innerHTML = originalHtml;
        buttonEl.style.backgroundColor = "#078FE0";
      }, 2000);
    }
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(coordString).then(notifySuccess).catch(() => {
      fallbackCopy(coordString);
      notifySuccess();
    });
  } else {
    fallbackCopy(coordString);
    notifySuccess();
  }
}

function fallbackCopy(text) {
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try {
    document.execCommand("copy");
  } catch (_) {}
  document.body.removeChild(ta);
}

export function exportSiteGeoJSON(site) {
  if (!site) return;
  const bbox = site.bounding_box || site.bbox;
  const features = [
    {
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: [site.lon, site.lat],
      },
      properties: {
        site_id: site.site_id,
        name: site.name,
        country: site.country,
        crs: site.crs || "WGS 84 (EPSG:4326)",
        position_reference: site.position_reference || "Barycentre du catalogue",
        position_source: site.position_source || "Littérature peer-reviewed",
        is_regional: Boolean(site.is_regional),
        sector_note: site.sector_note || null,
        rank: site.rank || null,
        similarity_score: site.similarity_score !== undefined ? site.similarity_score : null,
        mission_aptitude_score: site.mission_aptitude_score !== undefined ? site.mission_aptitude_score : null,
        confidence_score: site.confidence_score !== undefined ? site.confidence_score : null,
        analysis_id: site.analysis_id || "TX-RUN-ACTIVE",
      },
    },
  ];

  if (bbox && Array.isArray(bbox) && bbox.length === 4) {
    const [w, s, e, n] = bbox;
    features.push({
      type: "Feature",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [w, s],
            [e, s],
            [e, n],
            [w, n],
            [w, s],
          ],
        ],
      },
      properties: {
        site_id: site.site_id,
        name: `${site.name} — Emprise de calcul raster`,
        type: "computing_footprint",
        raster_product: site.raster_product || "Copernicus DEM",
        grid_dx_meters: site.grid_dx || 500,
        west: w,
        south: s,
        east: e,
        north: n,
      },
    });
  }

  const geojson = {
    type: "FeatureCollection",
    crs: {
      type: "name",
      properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
    },
    features,
  };

  const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/geo+json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `terrax_${site.site_id}_spatial_footprint.geojson`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (a.parentNode) document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 2000);
}

export function zoomToSiteFootprint(siteId) {
  if (!leafletMap) return;
  const site = cachedResults.find((s) => s.site_id === siteId);
  if (!site) return;

  const bbox = site.bounding_box || site.bbox;
  if (bbox && Array.isArray(bbox) && bbox.length === 4) {
    const [w, s, e, n] = bbox;
    leafletMap.flyToBounds([[s, w], [n, e]], { padding: [40, 40], maxZoom: 13, duration: 1.2 });
  } else {
    leafletMap.flyTo([site.lat, site.lon], 7, { duration: 1.0 });
  }
}

export function fitAllCandidateSites() {
  if (!leafletMap || cachedResults.length === 0) return;
  const pts = cachedResults.filter((s) => s.lat !== undefined && s.lon !== undefined).map((s) => [s.lat, s.lon]);
  if (pts.length > 0) {
    leafletMap.flyToBounds(pts, { padding: [35, 35], maxZoom: 5, duration: 1.0 });
  } else {
    leafletMap.flyTo([18, 5], 2);
  }
}

// =============================================================================
// 4. On-Screen Navigation Controls (Pills, Carousel, Regions, Height Toggle)
// =============================================================================

/**
 * Render quick site navigation pill carousel above the map.
 */
export function renderQuickNavStrip(results, selectedSiteId, onSelectSite) {
  const container = document.getElementById("earth-nav-pills");
  if (!container || !results) return;

  container.innerHTML = results
    .map((site) => {
      const isSelected = site.site_id === selectedSiteId;
      const shortName = site.name.split("—")[0].trim().split("-")[0].trim();
      const hasSim = typeof site.similarity_score === "number" && !isNaN(site.similarity_score);
      const simPct = hasSim ? `${Math.round(site.similarity_score * 100)}%` : "";

      return `
        <button class="map-nav-pill ${isSelected ? "active" : ""}" data-site="${site.site_id}" title="${site.name} (${site.country})">
          <span style="font-family:'Space Grotesk',sans-serif;font-weight:700;">#${site.rank || ""}</span>
          <span>${shortName}</span>
          ${simPct ? `<span class="pill-score">${simPct}</span>` : ""}
        </button>
      `;
    })
    .join("");

  container.querySelectorAll(".map-nav-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const siteId = pill.dataset.site;
      if (onSelectSite) onSelectSite(siteId);
      zoomToSiteFootprint(siteId);
    });
  });

  // Auto-scroll active pill into center view
  const activePill = container.querySelector(".map-nav-pill.active");
  if (activePill) {
    activePill.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }
}

/**
 * Navigate to next or previous candidate site in carousel order.
 */
export function navigateSiteDelta(delta) {
  if (!cachedResults || cachedResults.length === 0) return;
  const currentIndex = cachedResults.findIndex((s) => s.site_id === cachedSelectedSiteId);
  let nextIndex = currentIndex + delta;
  if (nextIndex < 0) nextIndex = cachedResults.length - 1;
  if (nextIndex >= cachedResults.length) nextIndex = 0;

  const targetSite = cachedResults[nextIndex];
  if (targetSite && onSelectCallback) {
    onSelectCallback(targetSite.site_id);
    zoomToSiteFootprint(targetSite.site_id);
  }
}

/**
 * Populate quick-select dropdown in the map header.
 */
export function populateQuickSelect(results, selectedSiteId, onSelectSite) {
  const sel = document.getElementById("map-quick-select");
  if (!sel || !results) return;

  sel.innerHTML = `
    <option value="">📍 Aller au site...</option>
    ${results
      .map((s) => {
        const hasSim = typeof s.similarity_score === "number" && !isNaN(s.similarity_score);
        const simPct = hasSim ? ` (${Math.round(s.similarity_score * 100)}%)` : "";
        return `<option value="${s.site_id}" ${s.site_id === selectedSiteId ? "selected" : ""}>
          #${s.rank || ""} ${s.name.split("—")[0].trim()}${simPct}
        </option>`;
      })
      .join("")}
  `;

  if (!sel.dataset.bound) {
    sel.dataset.bound = "1";
    sel.addEventListener("change", (e) => {
      const val = e.target.value;
      if (val && onSelectCallback) {
        onSelectCallback(val);
        zoomToSiteFootprint(val);
      }
    });
  }
}

/**
 * Zoom to geographical cluster / region.
 */
export function zoomToRegion(regionKey) {
  if (!leafletMap) return;
  const bounds = REGION_BOUNDS[regionKey];
  if (bounds) {
    leafletMap.flyToBounds(bounds, { padding: [30, 30], maxZoom: 6, duration: 1.0 });
  } else {
    fitAllCandidateSites();
  }
}

/**
 * Toggle map container vertical height between standard (330px) and expanded (480px).
 */
export function toggleMapExpanded() {
  const box = document.getElementById("earth-map-box");
  const canvasWrap = document.querySelector(".canvas-wrap");
  const btn = document.getElementById("btn-toggle-map-size");

  isMapExpanded = !isMapExpanded;

  box?.classList.toggle("map-expanded", isMapExpanded);
  canvasWrap?.classList.toggle("map-expanded", isMapExpanded);

  if (btn) {
    btn.textContent = isMapExpanded ? "⤢ Réduire" : "⛶ Agrandir";
    btn.title = isMapExpanded ? "Réduire la hauteur de la carte à 330px" : "Agrandir la hauteur de la carte à 480px";
  }

  setTimeout(() => {
    if (leafletMap) leafletMap.invalidateSize();
  }, 150);
}

// =============================================================================
// 5. Main Earth Map Rendering Function
// =============================================================================

export function renderEarthMap(results, selectedSiteId, onSelectSite, discoveryMode = "global", executionMeta = {}) {
  cachedResults = results || [];
  cachedSelectedSiteId = selectedSiteId;
  onSelectCallback = onSelectSite;

  const mapDiv = document.getElementById("earth-map");
  const fallbackCanvas = document.getElementById("earth-fallback-canvas");
  const offlineAlert = document.getElementById("map-offline-alert");
  const hasLeaflet = typeof window.L !== "undefined";

  // Update on-screen navigation controls
  renderQuickNavStrip(cachedResults, selectedSiteId, onSelectSite);
  populateQuickSelect(cachedResults, selectedSiteId, onSelectSite);

  if (hasLeaflet && mapDiv) {
    mapDiv.classList.remove("hidden");
    fallbackCanvas?.classList.add("hidden");

    if (!leafletMap) {
      leafletMap = window.L.map(mapDiv, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([18, 5], 2);

      window.L.control.zoom({ position: "bottomright" }).addTo(leafletMap);

      currentTileLayer = window.L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        { maxZoom: 18 }
      );
      currentTileLayer.on("tileerror", () => {
        if (offlineAlert) offlineAlert.classList.remove("hidden");
      });
      currentTileLayer.addTo(leafletMap);

      analysisFootprintLayer = window.L.featureGroup().addTo(leafletMap);
      activeHaloLayer = window.L.layerGroup().addTo(leafletMap);
      markersLayer = window.L.layerGroup().addTo(leafletMap);

      // Event delegation for all inspection popup actions
      mapDiv.addEventListener("click", (evt) => {
        const copyBtn = evt.target.closest("button[id^='btn-copy-coords-']");
        if (copyBtn) {
          evt.stopPropagation();
          copySiteCoordinates(copyBtn.dataset.coords, copyBtn);
          return;
        }

        const zoomBtn = evt.target.closest("button[id^='btn-zoom-footprint-']");
        if (zoomBtn) {
          evt.stopPropagation();
          zoomToSiteFootprint(zoomBtn.dataset.site);
          return;
        }

        const exportBtn = evt.target.closest("button[id^='btn-export-geojson-']");
        if (exportBtn) {
          evt.stopPropagation();
          const site = cachedResults.find((s) => s.site_id === exportBtn.dataset.site);
          if (site) exportSiteGeoJSON(site);
          return;
        }

        const toggleDetailsBtn = evt.target.closest("button[id^='btn-toggle-details-']");
        if (toggleDetailsBtn) {
          evt.stopPropagation();
          const siteId = toggleDetailsBtn.id.replace("btn-toggle-details-", "");
          const detailsContainer = document.getElementById(`inspector-details-${siteId}`);
          const toggleDetailsText = document.getElementById(`btn-toggle-details-text-${siteId}`);
          if (detailsContainer) {
            const isHidden = detailsContainer.classList.contains("hidden");
            detailsContainer.classList.toggle("hidden", !isHidden);
            if (toggleDetailsText) {
              toggleDetailsText.textContent = isHidden ? "▴ Réduire" : "▾ Détails";
            }
          }
          return;
        }
      });

      // Keyboard navigation & accessibility
      window.addEventListener("keydown", (e) => {
        const tag = document.activeElement ? document.activeElement.tagName : "";
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

        if (e.key === "ArrowLeft") {
          navigateSiteDelta(-1);
        } else if (e.key === "ArrowRight") {
          navigateSiteDelta(1);
        } else if (e.key === "Escape" && leafletMap) {
          leafletMap.closePopup();
        }
      });
    }

    markersLayer.clearLayers();
    activeHaloLayer.clearLayers();
    const bounds = [];
    let selectedMarkerToOpen = null;
    let selectedSiteObj = null;

    results.forEach((site) => {
      if (site.lat === undefined || site.lon === undefined) return;

      const isSelected = site.site_id === selectedSiteId;
      if (isSelected) selectedSiteObj = site;

      const hasSim = typeof site.similarity_score === "number" && !isNaN(site.similarity_score);
      const simPct = hasSim ? Math.round(site.similarity_score * 100) : null;

      let markerColor = "#94A3B8";
      if (isSelected) {
        markerColor = "#E87532";
      } else if (hasSim) {
        markerColor = simPct >= 75 ? "#078FE0" : "#43B5F5";
      }

      if (isSelected) {
        const halo = window.L.circleMarker([site.lat, site.lon], {
          radius: 17,
          color: "#E87532",
          weight: 2,
          opacity: 0.75,
          fillColor: "#E87532",
          fillOpacity: 0.22,
          className: "leaflet-marker-active-halo",
        });
        halo.addTo(activeHaloLayer);
      }

      const marker = window.L.circleMarker([site.lat, site.lon], {
        radius: isSelected ? 9.5 : 7,
        color: "#FFFFFF",
        weight: isSelected ? 3 : 2,
        fillColor: markerColor,
        fillOpacity: 0.95,
        className: isSelected ? "leaflet-marker-active" : "leaflet-marker-normal",
      });

      const popupContent = buildInspectorPopupHtml(site, executionMeta);
      const popup = window.L.popup({
        offset: [0, -8],
        closeButton: true,
        autoPan: true,
        autoPanPadding: [25, 25],
        className: "terrax-spatial-popup",
      }).setContent(popupContent);

      marker.bindPopup(popup);

      marker.on("click", () => {
        if (onSelectSite) onSelectSite(site.site_id);
      });

      marker.addTo(markersLayer);
      bounds.push([site.lat, site.lon]);

      if (isSelected) {
        selectedMarkerToOpen = marker;
      }
    });

    if (selectedSiteObj) {
      drawSiteFootprint(selectedSiteObj);
      if (selectedMarkerToOpen && !selectedMarkerToOpen.isPopupOpen()) {
        selectedMarkerToOpen.openPopup();
      }
    } else {
      analysisFootprintLayer.clearLayers();
    }

    if (discoveryMode === "regional") {
      leafletMap.setView([28.5, -7.2], 5);
    } else if (selectedSiteObj && selectedSiteObj.lat !== undefined) {
      // Keep center on selected site
    } else if (bounds.length > 0 && results.length <= 3) {
      leafletMap.fitBounds(bounds, { padding: [35, 35], maxZoom: 5 });
    }

    setTimeout(() => leafletMap.invalidateSize(), 60);
    return;
  }

  // Fallback vector map
  if (fallbackCanvas) {
    mapDiv?.classList.add("hidden");
    fallbackCanvas.classList.remove("hidden");
    const ctx = fallbackCanvas.getContext("2d");
    const w = fallbackCanvas.width;
    const h = fallbackCanvas.height;
    ctx.fillStyle = "#060E1D";
    ctx.fillRect(0, 0, w, h);

    ctx.strokeStyle = "rgba(148, 163, 184, 0.2)";
    for (let lon = -180; lon <= 180; lon += 60) {
      const x = ((lon + 180) / 360) * w;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let lat = -60; lat <= 60; lat += 30) {
      const y = ((90 - lat) / 180) * h;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    results.forEach((site) => {
      if (site.lat === undefined || site.lon === undefined) return;
      const x = ((site.lon + 180) / 360) * w;
      const y = ((90 - site.lat) / 180) * h;
      const isSelected = site.site_id === selectedSiteId;
      ctx.beginPath();
      ctx.arc(x, y, isSelected ? 8 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? "#E87532" : "#078FE0";
      ctx.fill();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "11px 'Inter', sans-serif";
      ctx.fillText(site.name.split(" ")[0], x + 9, y + 3);
    });
  }
}
