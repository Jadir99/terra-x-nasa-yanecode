/** TERRA-X Workbench Main Orchestrator */

import "./static_backend.js";
import { applyLanguage } from "./i18n.js";
import {
  renderEarthMap,
  renderPlanetaryCanvas,
  setDrawAoiMode,
  fitAllCandidateSites,
  navigateSiteDelta,
  toggleMapExpanded,
  zoomToRegion,
} from "./map2d.js";
import {
  renderProvenanceTable,
  renderSelectedBreakdown,
  renderSensitivityPanel,
  renderSimilarityHeatmap,
} from "./charts.js";
import { loadAndRenderTerrainTwin } from "./terrain3d.js";
import { askCopilot } from "./copilot.js";
import { exportReport, renderReportPreview } from "./reports.js";

const state = {
  lang: "en",
  catalog: null,
  body: "mars",
  aoiId: "jezero_crater",
  discoveryMode: "global",
  activeLayer: "altimetry",
  missionId: "soil_geochemistry",
  weights: null,
  analysis: null,
  selectedSiteId: "tindouf_sebkha",
  activeBox: [0, 0, 1, 1],
  copilotHistory: [],
};

function updateJourneyStep(maxStep) {
  document.querySelectorAll(".journey-bar .step").forEach((el) => {
    const s = Number(el.dataset.step);
    el.classList.toggle("active", s <= maxStep);
  });
}

function normalizeClientWeights(weights) {
  const total = Object.values(weights).reduce((a, b) => a + b, 0) || 1;
  const norm = {};
  Object.keys(weights).forEach((k) => {
    norm[k] = weights[k] / total;
  });
  return norm;
}

function renderAoiSelector() {
  const select = document.getElementById("aoi-select");
  const aois = state.catalog.planetary_aois.filter((a) => a.body === state.body);
  select.innerHTML = aois.map((a) => `<option value="${a.id}">${a.name}</option>`).join("");
  if (!aois.some((a) => a.id === state.aoiId)) {
    state.aoiId = aois[0].id;
  }
  select.value = state.aoiId;
  renderAoiMeta();
}

function renderAoiMeta() {
  const aoi = state.catalog.planetary_aois.find((a) => a.id === state.aoiId);
  if (!aoi) return;
  document.getElementById("aoi-summary").textContent = aoi.summary;
  document.getElementById("aoi-meta-pills").innerHTML = `
    <span class="meta-pill">${aoi.region}</span>
    <span class="meta-pill">${aoi.area_km2} km²</span>
    <span class="meta-pill">Slope: ${aoi.features.slope_roughness.value}°</span>
  `;
  const titleEl = document.getElementById("planetary-map-title");
  if (titleEl) titleEl.textContent = `${aoi.body.toUpperCase()} — ${aoi.name}`;
}

function renderLayersPanel() {
  const list = document.getElementById("layers-list");
  const guardrail = document.getElementById("guardrail-banner");
  const isMoon = state.body === "moon";

  list.innerHTML = state.catalog.criteria
    .map((c) => {
      const compatible = isMoon ? c.comparable_moon : c.comparable_mars;
      const isActive = state.activeLayer === c.id;
      const label = state.lang === "fr" ? c.label_fr : c.label_en;
      return `<div class="layer-item ${isActive ? "active" : ""} ${!compatible ? "disabled" : ""}" data-layer="${c.id}" data-compat="${compatible}">
        <span>${label}</span>
        <span class="layer-badge">${compatible ? c.unit : "EXCLUDED"}</span>
      </div>`;
    })
    .join("");

  list.querySelectorAll(".layer-item").forEach((el) => {
    el.addEventListener("click", () => {
      if (el.dataset.compat === "false") return;
      state.activeLayer = el.dataset.layer;
      document.getElementById("planetary-layer-badge").textContent = `• ${state.activeLayer.toUpperCase()}`;
      renderLayersPanel();
      const aoi = state.analysis?.aoi || state.catalog.planetary_aois.find((a) => a.id === state.aoiId);
      renderPlanetaryCanvas(aoi, state.activeLayer, handleCustomAoiDraw);
    });
  });

  if (isMoon) {
    guardrail.textContent =
      state.lang === "fr"
        ? "Garde-fou : « Aridité » exclue pour la Lune (absence d'atmosphère / cycle hydrique comparable)."
        : "Guardrail: 'Aridity' is excluded for Lunar targets (no comparable atmosphere/water cycle).";
  } else {
    guardrail.textContent =
      state.lang === "fr"
        ? "Garde-fou : chaque variable comparée respecte la compatibilité physique et les unités."
        : "Guardrail: only physically compatible variables with harmonized units are scored.";
  }
}

function renderMissionPresets() {
  const grid = document.getElementById("mission-presets");
  grid.innerHTML = state.catalog.missions
    .map(
      (m) => `<button class="mission-btn ${m.id === state.missionId ? "active" : ""}" data-mission="${m.id}">
      <span class="mission-code">SCENARIO ${m.code}</span>
      <span class="mission-name">${state.lang === "fr" ? m.name_fr : m.name_en}</span>
    </button>`
    )
    .join("");

  grid.querySelectorAll(".mission-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.missionId = btn.dataset.mission;
      const mission = state.catalog.missions.find((m) => m.id === state.missionId);
      state.weights = { ...mission.weights };
      renderMissionPresets();
      renderWeightSliders();
      updateJourneyStep(6);
      runAnalysisAndRefresh();
    });
  });
}

function renderWeightSliders() {
  const wrap = document.getElementById("weight-sliders");
  wrap.innerHTML = state.catalog.criteria
    .map((c) => {
      const val = state.weights[c.id] || 0;
      const shortName = (state.lang === "fr" ? c.label_fr : c.label_en).split("&")[0].trim();
      return `<div class="slider-row">
        <span>${shortName}</span>
        <input type="range" min="0" max="60" value="${Math.round(val * 100)}" data-cid="${c.id}" />
        <span class="slider-val">${Math.round(val * 100)}%</span>
      </div>`;
    })
    .join("");

  let debounceTimer = null;
  wrap.querySelectorAll('input[type="range"]').forEach((slider) => {
    slider.addEventListener("input", () => {
      const cid = slider.dataset.cid;
      state.weights[cid] = Number(slider.value) / 100;
      state.weights = normalizeClientWeights(state.weights);
      // Update displayed percentages without destroying active slider drag
      wrap.querySelectorAll(".slider-row").forEach((row) => {
        const inp = row.querySelector("input");
        const pct = Math.round((state.weights[inp.dataset.cid] || 0) * 100);
        row.querySelector(".slider-val").textContent = `${pct}%`;
      });
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        updateJourneyStep(6);
        runAnalysisAndRefresh("/api/missions/simulate");
      }, 140);
    });
  });
}

function renderCandidateCards() {
  const container = document.getElementById("candidate-cards");
  const results = state.analysis?.results || [];
  document.getElementById("earth-count-badge").textContent = `(${results.length} verified sites)`;

  const stab = Math.round((state.analysis?.sensitivity?.stability_score || 1) * 100);
  const stabEl = document.getElementById("stability-pill");
  if (stabEl) stabEl.textContent = `Stability: ${stab}%`;

  container.innerHTML = results
    .map((r) => {
      const isSelected = r.site_id === state.selectedSiteId;
      const missingFlag = r.missing_criteria.length
        ? `<span class="flag-warn">Missing: ${r.missing_criteria.join(", ")}</span>`
        : `<span class="flag-ok">Full coverage</span>`;
      return `<div class="candidate-card ${isSelected ? "selected" : ""}" data-site="${r.site_id}">
        <div class="cand-top">
          <div>
            <div class="cand-name">${r.name}</div>
            <div class="cand-country">${r.country} • ${r.status}</div>
          </div>
          <span class="cand-rank">#${r.rank}</span>
        </div>
        <div class="score-trio">
          <div class="score-box"><span class="lbl">Sim.</span><span class="val" style="color:var(--cyan)">${Math.round(r.similarity_score * 100)}%</span></div>
          <div class="score-box"><span class="lbl">Aptitude</span><span class="val" style="color:var(--amber)">${Math.round(r.mission_aptitude_score * 100)}%</span></div>
          <div class="score-box"><span class="lbl">Confid.</span><span class="val" style="color:var(--green)">${Math.round(r.confidence_score * 100)}%</span></div>
        </div>
        <div class="cand-flags">${missingFlag}</div>
      </div>`;
    })
    .join("");

  container.querySelectorAll(".candidate-card").forEach((card) => {
    card.addEventListener("click", () => selectSite(card.dataset.site));
  });
}

function populateTwinSiteSelector() {
  const sel = document.getElementById("twin-site-select");
  if (!sel || !state.analysis) return;
  sel.innerHTML = state.analysis.results
    .map((r) => `<option value="${r.site_id}">#${r.rank} ${r.name}</option>`)
    .join("");
  sel.value = state.selectedSiteId;
}

function selectSite(siteId) {
  state.selectedSiteId = siteId;
  renderCandidateCards();
  const activeMission = state.catalog?.missions?.find((m) => m.id === state.missionId);
  const execMeta = {
    target_body: state.body,
    aoi_name: state.analysis?.aoi?.name,
    mission_name: activeMission ? (state.lang === "fr" ? activeMission.name_fr : activeMission.name_en) : null,
    analysis_id: state.analysis?.analysis_id,
  };
  const results = state.analysis?.results || state.catalog?.earth_sites || [];
  renderEarthMap(results, state.selectedSiteId, selectSite, state.discoveryMode, execMeta);
  const siteObj = results.find((r) => r.site_id === siteId) || results[0];
  if (siteObj && state.analysis?.weights) {
    renderSelectedBreakdown(siteObj, state.analysis.weights);
  }
  const twinSel = document.getElementById("twin-site-select");
  if (twinSel) twinSel.value = state.selectedSiteId;
  if (document.getElementById("view-3d")?.classList.contains("active")) {
    loadAndRenderTerrainTwin(state.aoiId, state.selectedSiteId, state.activeBox);
  }
  const card = document.querySelector(`.candidate-card[data-site="${siteId}"]`);
  if (card) {
    card.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}

async function handleCustomAoiDraw(areaKm2, rawBox = null) {
  let box = [0, 0, 1, 1];
  if (Array.isArray(rawBox)) {
    box = rawBox;
  } else if (rawBox && typeof rawBox === "object" && rawBox.bw && rawBox.bh) {
    const canvas = document.getElementById("planetary-canvas");
    const cw = canvas?.width || 540;
    const ch = canvas?.height || 280;
    box = [
      Math.max(0, Math.min(1, rawBox.x / cw)),
      Math.max(0, Math.min(1, rawBox.y / ch)),
      Math.max(0, Math.min(1, (rawBox.x + rawBox.bw) / cw)),
      Math.max(0, Math.min(1, (rawBox.y + rawBox.bh) / ch)),
    ];
  }
  state.activeBox = box;

  const res = await fetch("/api/regions/planetary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aoi_id: state.aoiId, area_km2: areaKm2, box }),
  });
  if (res.ok) {
    const data = await res.json();
    const aoi = state.catalog.planetary_aois.find((a) => a.id === state.aoiId);
    if (aoi && data.region) {
      Object.assign(aoi, data.region);
    }
    renderAoiMeta();
    await runAnalysisAndRefresh();
    loadAndRenderTerrainTwin(state.aoiId, state.selectedSiteId, state.activeBox);
  }
}

async function runAnalysisAndRefresh(endpoint = "/api/analyses") {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aoi_id: state.aoiId,
      mission_id: state.missionId,
      weights: state.weights,
      discovery_mode: state.discoveryMode,
    }),
  });
  if (!res.ok) return;
  state.analysis = await res.json();

  if (!state.analysis.results.some((r) => r.site_id === state.selectedSiteId) && state.analysis.results.length) {
    state.selectedSiteId = state.analysis.results[0].site_id;
  }

  const activeMission = state.catalog?.missions?.find((m) => m.id === state.missionId);
  const execMeta = {
    target_body: state.body,
    aoi_name: state.analysis.aoi?.name,
    mission_name: activeMission ? (state.lang === "fr" ? activeMission.name_fr : activeMission.name_en) : null,
    analysis_id: state.analysis.analysis_id,
  };

  renderPlanetaryCanvas(state.analysis.aoi, state.activeLayer, handleCustomAoiDraw);
  renderEarthMap(state.analysis.results, state.selectedSiteId, selectSite, state.discoveryMode, execMeta);
  renderCandidateCards();
  renderSimilarityHeatmap(state.analysis);

  const selectedObj =
    state.analysis.results.find((r) => r.site_id === state.selectedSiteId) || state.analysis.results[0];
  if (selectedObj) renderSelectedBreakdown(selectedObj, state.analysis.weights);
  renderSensitivityPanel(state.analysis.sensitivity);
  populateTwinSiteSelector();
  renderReportPreview(state.analysis);

  if (document.getElementById("view-3d")?.classList.contains("active")) {
    loadAndRenderTerrainTwin(state.aoiId, state.selectedSiteId, state.activeBox);
  }
}

async function runDemoFlow() {
  // Implements Slide 34: 3-minute continuous demo scenario
  state.body = "mars";
  state.aoiId = "jezero_crater";
  state.discoveryMode = "global";
  state.missionId = "soil_geochemistry";
  const mission = state.catalog.missions.find((m) => m.id === state.missionId);
  state.weights = { ...mission.weights };
  state.selectedSiteId = "tindouf_sebkha";

  document.querySelectorAll("#planet-toggle .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.body === "mars"));
  document.querySelectorAll("#discovery-toggle .seg-btn").forEach((b) => b.classList.toggle("active", b.dataset.mode === "global"));
  renderAoiSelector();
  renderLayersPanel();
  renderMissionPresets();
  renderWeightSliders();
  document.querySelector('[data-tab="view-maps"]')?.click();

  await runAnalysisAndRefresh();
  updateJourneyStep(7);
  await askCopilot(state, "Compare Tindouf, Atacama, and McMurdo for Soil Geochemistry and state limits");
}

function bindEvents() {
  // Stage tabs
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      btn.classList.add("active");
      const target = document.getElementById(btn.dataset.tab);
      target?.classList.add("active");

      if (btn.dataset.tab === "view-matrix" && state.analysis) {
        renderSimilarityHeatmap(state.analysis);
      } else if (btn.dataset.tab === "view-3d" && state.analysis) {
        loadAndRenderTerrainTwin(state.aoiId, state.selectedSiteId, state.activeBox);
      } else if (btn.dataset.tab === "view-report") {
        updateJourneyStep(8);
      } else if (btn.dataset.tab === "view-maps" && state.analysis) {
        renderEarthMap(state.analysis.results, state.selectedSiteId, selectSite, state.discoveryMode);
      }
    });
  });

  // Planet toggle
  document.querySelectorAll("#planet-toggle .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.body = btn.dataset.body;
      document.querySelectorAll("#planet-toggle .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
      if (state.body === "moon" && state.activeLayer === "aridity") {
        state.activeLayer = "altimetry";
      }
      renderAoiSelector();
      renderLayersPanel();
      updateJourneyStep(3);
      runAnalysisAndRefresh();
    });
  });

  // AOI change
  document.getElementById("aoi-select").addEventListener("change", (e) => {
    state.aoiId = e.target.value;
    setDrawAoiMode(false);
    renderAoiMeta();
    updateJourneyStep(2);
    runAnalysisAndRefresh();
  });

  // AOI Presets & Draw Tools
  const setPresetActive = (btnId) => {
    ["btn-aoi-full", "btn-aoi-west", "btn-aoi-east"].forEach((id) => {
      document.getElementById(id)?.classList.toggle("active", id === btnId);
    });
  };

  document.getElementById("btn-aoi-full")?.addEventListener("click", () => {
    setPresetActive("btn-aoi-full");
    setDrawAoiMode(false);
    document.getElementById("btn-draw-aoi")?.classList.remove("active");
    handleCustomAoiDraw(272, [0.0, 0.0, 1.0, 1.0]);
  });
  document.getElementById("btn-aoi-west")?.addEventListener("click", () => {
    setPresetActive("btn-aoi-west");
    setDrawAoiMode(false);
    document.getElementById("btn-draw-aoi")?.classList.remove("active");
    handleCustomAoiDraw(136, [0.0, 0.0, 0.5, 1.0]);
  });
  document.getElementById("btn-aoi-east")?.addEventListener("click", () => {
    setPresetActive("btn-aoi-east");
    setDrawAoiMode(false);
    document.getElementById("btn-draw-aoi")?.classList.remove("active");
    handleCustomAoiDraw(136, [0.5, 0.0, 1.0, 1.0]);
  });

  document.getElementById("btn-draw-aoi")?.addEventListener("click", (e) => {
    const active = e.currentTarget.classList.toggle("active");
    setDrawAoiMode(active);
  });
  document.getElementById("btn-reset-aoi")?.addEventListener("click", () => {
    setDrawAoiMode(false);
    setPresetActive("btn-aoi-full");
    document.getElementById("btn-draw-aoi")?.classList.remove("active");
    handleCustomAoiDraw(272, [0.0, 0.0, 1.0, 1.0]);
  });

  // Discovery toggle & run
  document.querySelectorAll("#discovery-toggle .seg-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.discoveryMode = btn.dataset.mode;
      document.querySelectorAll("#discovery-toggle .seg-btn").forEach((b) => b.classList.toggle("active", b === btn));
      updateJourneyStep(4);
      runAnalysisAndRefresh();
    });
  });

  document.getElementById("btn-discover").addEventListener("click", async () => {
    await fetch("/api/discovery/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: state.discoveryMode }),
    });
    updateJourneyStep(5);
    runAnalysisAndRefresh();
  });

  // Reset mission weights
  document.getElementById("btn-reset-weights").addEventListener("click", () => {
    const mission = state.catalog.missions.find((m) => m.id === state.missionId);
    state.weights = { ...mission.weights };
    renderWeightSliders();
    runAnalysisAndRefresh();
  });

  // 3D twin Earth selector
  document.getElementById("twin-site-select").addEventListener("change", (e) => {
    state.selectedSiteId = e.target.value;
    loadAndRenderTerrainTwin(state.aoiId, state.selectedSiteId);
  });

  // Copilot form & chips
  document.getElementById("copilot-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = document.getElementById("copilot-input");
    const q = input.value.trim();
    if (!q) return;
    input.value = "";
    updateJourneyStep(7);
    await askCopilot(state, q);
  });

  document.querySelectorAll("#quick-prompts .chip-btn").forEach((chip) => {
    chip.addEventListener("click", () => {
      updateJourneyStep(7);
      askCopilot(state, chip.dataset.q);
    });
  });

  // Exports
  document.getElementById("export-pdf").addEventListener("click", () => exportReport(state, "pdf"));
  document.getElementById("export-doc").addEventListener("click", () => exportReport(state, "doc"));
  document.getElementById("export-csv").addEventListener("click", () => exportReport(state, "csv"));
  document.getElementById("export-geojson").addEventListener("click", () => exportReport(state, "geojson"));

  // Language toggle
  document.getElementById("btn-lang-toggle").addEventListener("click", () => {
    state.lang = state.lang === "en" ? "fr" : "en";
    applyLanguage(state.lang);
    renderLayersPanel();
    renderMissionPresets();
    renderWeightSliders();
  });

  // 3-Minute Demo
  document.getElementById("btn-demo-flow").addEventListener("click", runDemoFlow);

  // Map toolbar: Fit all candidate sites
  document.getElementById("btn-map-fit-all")?.addEventListener("click", () => {
    fitAllCandidateSites();
  });

  // Map toolbar: Toggle map expanded height (330px <-> 480px)
  document.getElementById("btn-toggle-map-size")?.addEventListener("click", () => {
    toggleMapExpanded();
  });

  // Map carousel arrows: Next and Previous
  document.getElementById("btn-nav-prev-site")?.addEventListener("click", () => {
    navigateSiteDelta(-1);
  });
  document.getElementById("btn-nav-next-site")?.addEventListener("click", () => {
    navigateSiteDelta(1);
  });

  // Region filter buttons
  document.querySelectorAll(".region-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".region-filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      zoomToRegion(btn.dataset.region);
    });
  });

  // Map toolbar: Quick search site
  const mapSearchInput = document.getElementById("map-site-search");
  if (mapSearchInput) {
    mapSearchInput.addEventListener("input", (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (!q) return;
      const sites = state.analysis?.results || state.catalog?.earth_sites || [];
      const match = sites.find((s) => s.name.toLowerCase().includes(q) || (s.country && s.country.toLowerCase().includes(q)));
      if (match) {
        selectSite(match.site_id);
      }
    });
  }
}

async function init() {
  const res = await fetch("/api/datasets");
  state.catalog = await res.json();

  const initialMission = state.catalog.missions.find((m) => m.id === state.missionId);
  state.weights = { ...initialMission.weights };

  renderAoiSelector();
  renderLayersPanel();
  renderMissionPresets();
  renderWeightSliders();
  renderProvenanceTable(state.catalog.datasets);
  bindEvents();

  // Pre-analysis map preview so inspection works before running analysis
  if (state.catalog?.earth_sites) {
    renderEarthMap(state.catalog.earth_sites, state.selectedSiteId, selectSite, state.discoveryMode);
  }

  await runAnalysisAndRefresh();
  await askCopilot(state, "Why Tindouf?");
}

init();
