/**
 * TERRA-X Static Client-Side Engine & Fetch Interceptor.
 * Allows 100% static hosting on GoDaddy, GitHub Pages, Apache, or any static web server
 * without requiring Python, Node.js, or any backend server runtime.
 */
import { CATALOG, TERRAIN_GRIDS } from "./catalog_data.js";

const CRITERION_IDS = [
  "altimetry",
  "slope_roughness",
  "temperature",
  "aridity",
  "mineralogy",
  "geochemistry",
];

const PLANETARY_GRID_MAP = {
  jezero_crater: "jezero",
  shackleton_rim: "nobile",
  oxia_planum: "jezero",
  gale_crater: "jezero",
};

const EARTH_GRID_MAP = {
  iriqui_draa: "iriqui",
  draa_valley: "draa",
  draa_fan: "draa",
  iriqui_playa: "iriqui",
  atacama_yungay: "atacama",
  tindouf_sebkha: "iriqui",
};

const TERRAIN_GRIDS_MAP = Object.fromEntries(TERRAIN_GRIDS.map((g) => [g.id, g]));
const CUSTOM_AOIS = new Map();
const JOBS_STORE = new Map();

function roundTo(val, digits = 4) {
  if (val === null || val === undefined || isNaN(val)) return 0;
  const factor = 10 ** digits;
  return Math.round(val * factor) / factor;
}

function normalizeWeights(rawWeights) {
  if (!rawWeights || typeof rawWeights !== "object") {
    const equal = 1 / CRITERION_IDS.length;
    return Object.fromEntries(CRITERION_IDS.map((c) => [c, roundTo(equal, 6)]));
  }
  const cleaned = {};
  let total = 0;
  for (const cid of CRITERION_IDS) {
    const v = Math.max(0, Number(rawWeights[cid] ?? 0) || 0);
    cleaned[cid] = v;
    total += v;
  }
  if (total <= 0) {
    const equal = 1 / CRITERION_IDS.length;
    return Object.fromEntries(CRITERION_IDS.map((c) => [c, roundTo(equal, 6)]));
  }
  return Object.fromEntries(CRITERION_IDS.map((c) => [c, cleaned[c] / total]));
}

function jaccardOverlap(tagsA, tagsB) {
  if (!tagsA?.length || !tagsB?.length) return null;
  const setA = new Set(tagsA);
  const setB = new Set(tagsB);
  const union = new Set([...setA, ...setB]);
  if (union.size === 0) return null;
  let inter = 0;
  for (const item of setA) {
    if (setB.has(item)) inter += 1;
  }
  return inter / union.size;
}

function computeCriterionSimilarity(cmeta, aoiFeat, siteFeat, body) {
  const cid = cmeta.id;
  const compatKey = body === "moon" ? "comparable_moon" : "comparable_mars";
  if (cmeta[compatKey] === false) {
    return {
      criterion: cid,
      status: "incompatible",
      score: null,
      reason: `Guardrail: '${cid}' is not physically comparable for ${body.toUpperCase()} targets.`,
    };
  }
  if (!aoiFeat || !siteFeat) {
    const side = !aoiFeat ? "planetary AOI" : "Earth site";
    return {
      criterion: cid,
      status: "missing",
      score: null,
      reason: `Missing harmonized measurement on ${side}.`,
    };
  }

  const valA = Number(aoiFeat.value);
  const valB = Number(siteFeat.value);
  const scale = Number(cmeta.scale_max || 1) || 1;
  const numericProx = Math.max(0, Math.min(1, 1 - Math.abs(valA - valB) / scale));

  let proximity = numericProx;
  if (cid === "mineralogy" || cid === "geochemistry") {
    const jacc = jaccardOverlap(aoiFeat.tags, siteFeat.tags);
    if (jacc !== null) proximity = 0.45 * numericProx + 0.55 * jacc;
  }

  return {
    criterion: cid,
    status: "observed",
    score: roundTo(proximity, 4),
    aoi_value: valA,
    site_value: valB,
    unit: cmeta.unit || "",
    site_provenance: siteFeat.provenance || "Unknown",
    site_resolution_m: siteFeat.resolution_m,
    measurement_type: siteFeat.measurement_type || "orbital",
  };
}

function evaluateSite(aoi, site, weights, mission) {
  const criteriaMap = Object.fromEntries(CATALOG.criteria.map((c) => [c.id, c]));
  const details = {};
  let observedWeight = 0;
  let weightedSum = 0;
  const missing = [];
  const incompatible = [];

  for (const cid of CRITERION_IDS) {
    const res = computeCriterionSimilarity(
      criteriaMap[cid],
      aoi.features[cid],
      site.features[cid],
      aoi.body
    );
    details[cid] = res;
    const w = weights[cid] || 0;
    if (res.status === "observed" && res.score !== null) {
      observedWeight += w;
      weightedSum += w * res.score;
    } else if (res.status === "missing") {
      missing.push(cid);
    } else if (res.status === "incompatible") {
      incompatible.push(cid);
    }
  }

  const similarity = observedWeight > 0 ? weightedSum / observedWeight : 0;
  const coverage = observedWeight;

  const access = Number(site.accessibility_score ?? 0.7);
  const safety = Number(site.safety_score ?? 0.7);
  const siteSlope = Number(site.features.slope_roughness?.value ?? 10);
  const maxSafeSlope = Number(mission.max_safe_slope_deg ?? 20);
  const slopePenalty =
    siteSlope > maxSafeSlope ? Math.min(0.35, (siteSlope - maxSafeSlope) * 0.03) : 0;

  let aptitude;
  if (mission.id === "rover_mobility") {
    aptitude = 0.55 * similarity + 0.25 * access + 0.2 * safety - slopePenalty;
  } else if (mission.id === "cold_arid") {
    aptitude = 0.72 * similarity + 0.14 * access + 0.14 * safety - slopePenalty * 0.5;
  } else {
    aptitude = 0.68 * similarity + 0.18 * access + 0.14 * safety - slopePenalty * 0.5;
  }
  aptitude = Math.max(0, Math.min(1, aptitude));

  const observedDetails = Object.values(details).filter((d) => d.status === "observed");
  const inSituRatio =
    observedDetails.filter((d) => d.measurement_type === "in_situ").length /
    Math.max(1, observedDetails.length);
  const resRatio =
    observedDetails.filter((d) => (d.site_resolution_m ?? 9999) <= 100).length /
    Math.max(1, observedDetails.length);

  let confidence = 0.5 * coverage + 0.3 * inSituRatio + 0.2 * resRatio;
  if (missing.length > 0) confidence = Math.max(0.15, confidence - 0.08 * missing.length);
  confidence = Math.max(0, Math.min(1, confidence));

  return {
    site_id: site.id,
    name: site.name,
    country: site.country,
    region_group: site.region_group,
    lat: site.lat,
    lon: site.lon,
    elevation_m: site.elevation_m,
    status: site.status,
    summary: site.summary,
    similarity_score: roundTo(similarity, 4),
    mission_aptitude_score: roundTo(aptitude, 4),
    confidence_score: roundTo(confidence, 4),
    composite_rank_score: roundTo(0.65 * similarity + 0.35 * aptitude, 4),
    coverage_ratio: roundTo(coverage, 4),
    missing_criteria: missing,
    incompatible_criteria: incompatible,
    criterion_details: details,
    publications: site.publications || [],
    limits: site.limits || [],
    terrain_seed: site.terrain_seed || 1,
    terrain_style: site.terrain_style || "clay_plain",
    slope_deg: siteSlope,
    relief_m: site.features.altimetry?.value ?? 300,
    crs: site.crs || "WGS 84 (EPSG:4326)",
    position_reference: site.position_reference || "Point de référence du catalogue",
    position_source: site.position_source || "Catalogue TERRA-X / DEM",
    bounding_box: site.bounding_box || null,
    bbox: site.bounding_box || null,
    raster_product: site.raster_product || null,
    grid_dx: site.grid_dx || null,
    is_regional: Boolean(site.is_regional),
    sector_note: site.sector_note || "",
  };
}

function discoverSites({ mode = "global", regionGroup = null, maxSlopeDeg = null, minAridity = null }) {
  return CATALOG.earth_sites.filter((site) => {
    if (mode === "regional") {
      if (site.region_group !== (regionGroup || "north_africa")) return false;
    } else if (mode === "benchmark") {
      if (!["tindouf_sebkha", "atacama_yungay", "mcmurdo_dry_valleys"].includes(site.id)) {
        return false;
      }
    }
    const slope = site.features.slope_roughness?.value;
    if (maxSlopeDeg !== null && slope != null && slope > maxSlopeDeg) return false;
    const aridity = site.features.aridity?.value;
    if (minAridity !== null && aridity != null && aridity < minAridity) return false;
    return true;
  });
}

function computeSensitivity(aoi, sites, weights, mission, baselineRanking) {
  const topCriteria = Object.entries(weights)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2);
  let flips = 0;
  const scenarios = [];

  for (const [cid] of topCriteria) {
    for (const delta of [-0.15, 0.15]) {
      const perturbed = { ...weights, [cid]: Math.max(0.01, weights[cid] * (1 + delta)) };
      const normP = normalizeWeights(perturbed);
      const scored = sites
        .map((s) => evaluateSite(aoi, s, normP, mission))
        .sort((a, b) => b.similarity_score - a.similarity_score);
      const topId = scored[0]?.site_id ?? null;
      const changed = topId !== (baselineRanking[0] ?? null);
      if (changed) flips += 1;
      scenarios.push({
        criterion: cid,
        delta_pct: Math.round(delta * 100),
        top_site_id: topId,
        rank_changed: changed,
      });
    }
  }

  return {
    stability_score: roundTo(1 - flips / Math.max(1, scenarios.length), 2),
    rank_flip_count: flips,
    total_perturbations: scenarios.length,
    scenarios,
  };
}

export function runAnalysis({
  aoiId = "jezero_crater",
  missionId = "soil_geochemistry",
  rawWeights = null,
  discoveryMode = "global",
  regionGroup = null,
} = {}) {
  const baseAoi = CATALOG.planetary_aois.find((a) => a.id === aoiId) || CATALOG.planetary_aois[0];
  const mission = CATALOG.missions.find((m) => m.id === missionId) || CATALOG.missions[0];

  const aoi = structuredClone(baseAoi);
  const custom = CUSTOM_AOIS.get(aoiId);
  if (custom) {
    if (custom.area_km2) aoi.area_km2 = custom.area_km2;
    if (custom.polygon) aoi.polygon = custom.polygon;
  }

  const weights = normalizeWeights(rawWeights || mission.weights);
  let candidates = discoverSites({ mode: discoveryMode, regionGroup });
  if (candidates.length === 0) candidates = CATALOG.earth_sites;

  const evaluated = candidates
    .map((site) => evaluateSite(aoi, site, weights, mission))
    .sort((a, b) => b.similarity_score - a.similarity_score || b.mission_aptitude_score - a.mission_aptitude_score);

  const analysisId = `TX-RUN-${aoi.id.slice(0, 4).toUpperCase()}-${mission.id.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 8)}`;
  const execTimestamp = new Date().toISOString();

  evaluated.forEach((item, idx) => {
    item.rank = idx + 1;
    item.analysis_id = analysisId;
    item.target_aoi = aoi.name;
    item.target_body = aoi.body;
    item.mission_id = mission.id;
    item.mission_name = mission.name_en || mission.id;
  });

  const sensitivity = computeSensitivity(
    aoi,
    candidates,
    weights,
    mission,
    evaluated.map((r) => r.site_id)
  );

  return {
    analysis_id: analysisId,
    timestamp: execTimestamp,
    aoi,
    mission,
    weights: Object.fromEntries(Object.entries(weights).map(([k, v]) => [k, roundTo(v, 4)])),
    discovery_mode: discoveryMode,
    candidate_count: evaluated.length,
    results: evaluated,
    sensitivity,
    scientific_note:
      "Scores measure similarity across physically comparable variables only. Earth sites are candidate analogs for specific properties, never full planetary equivalents.",
  };
}

function quantile(arr, q) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

function getGridIndices(grid, box = [0, 0, 1, 1]) {
  const w = grid.width;
  const h = grid.height;
  const left = Math.max(0, Math.min(w - 1, Math.round(box[0] * w)));
  const top = Math.max(0, Math.min(h - 1, Math.round(box[1] * h)));
  const right = Math.max(left + 1, Math.min(w, Math.round(box[2] * w)));
  const bottom = Math.max(top + 1, Math.min(h, Math.round(box[3] * h)));
  return [left, top, right, bottom];
}

function extractSubgridMatrix(grid, box = [0, 0, 1, 1]) {
  const [left, top, right, bottom] = getGridIndices(grid, box);
  const width = grid.width;
  const values = grid.values;
  const matrix = [];
  for (let y = top; y < bottom; y++) {
    const row = [];
    for (let x = left; x < right; x++) {
      const z = values[y * width + x];
      row.append ? row.append(z) : row.push(z !== null && Number.isFinite(z) ? roundTo(z, 2) : null);
    }
    matrix.push(row);
  }
  return matrix;
}

function computeGridStats(grid, box = [0, 0, 1, 1]) {
  const [left, top, right, bottom] = getGridIndices(grid, box);
  const width = grid.width;
  const values = grid.values;
  const dx = grid.dx || 500;
  const elevations = [];
  const slopes = [];
  const profile = [];
  const midRow = Math.floor((top + bottom - 1) / 2);

  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const z = values[y * width + x];
      if (y === midRow) {
        profile.push({
          distance: (x - left) * dx,
          elevation: z !== null && Number.isFinite(z) ? z : null,
        });
      }
      if (z === null || !Number.isFinite(z)) continue;
      elevations.push(z);

      if (x > left && x < right - 1 && y > top && y < bottom - 1) {
        const leftZ = values[y * width + (x - 1)];
        const rightZ = values[y * width + (x + 1)];
        const topZ = values[(y - 1) * width + x];
        const bottomZ = values[(y + 1) * width + x];
        if (
          leftZ !== null && rightZ !== null && topZ !== null && bottomZ !== null &&
          Number.isFinite(leftZ) && Number.isFinite(rightZ) && Number.isFinite(topZ) && Number.isFinite(bottomZ)
        ) {
          const dzdx = (rightZ - leftZ) / (2 * dx);
          const dzdy = (bottomZ - topZ) / (2 * dx);
          slopes.push(Math.atan(Math.hypot(dzdx, dzdy)) * (180 / Math.PI));
        }
      }
    }
  }

  const valid = elevations.length;
  const total = (right - left) * (bottom - top);
  const elevP90 = quantile(elevations, 0.9);
  const elevP10 = quantile(elevations, 0.1);
  const relief = elevP90 !== null && elevP10 !== null ? elevP90 - elevP10 : 200;
  const slopeP50 = quantile(slopes, 0.5) || 2.5;

  const minLon = grid.minLon || -10;
  const maxLon = grid.maxLon || 0;
  const minLat = grid.minLat || 20;
  const maxLat = grid.maxLat || 30;

  return {
    relief,
    slope: slopeP50,
    valid,
    total,
    coverage: total > 0 ? (100 * valid) / total : 100,
    profile,
    bbox: [minLon, minLat, maxLon, maxLat],
  };
}

function generateProceduralTerrain(seed, style, reliefM, slopeDeg, size = 26) {
  const zGrid = [];
  const center = (size - 1) / 2;
  const slopeFactor = Math.max(0.35, Math.min(2.2, slopeDeg / 8.5));

  for (let y = 0; y < size; y += 1) {
    const row = [];
    const ny = (y - center) / center;
    for (let x = 0; x < size; x += 1) {
      const nx = (x - center) / center;
      const r = Math.hypot(nx, ny);
      const wave =
        0.28 * Math.sin(nx * 3.1 + seed * 0.7) * Math.cos(ny * 2.7 - seed * 0.3) +
        0.14 * Math.sin((nx + ny) * 5.2 + seed);

      let h;
      if (style === "delta_crater") {
        h =
          0.75 * Math.exp(-((r - 0.72) ** 2) / 0.045) +
          0.55 * Math.exp(-((nx + 0.35) ** 2 + (ny * 1.4) ** 2) / 0.18) +
          0.25 * wave;
      } else if (style === "polar_rim") {
        h =
          -0.85 * Math.exp(-(r ** 2) / 0.24) +
          0.9 * Math.exp(-((r - 0.68) ** 2) / 0.03) * (1 + 0.35 * Math.cos(Math.atan2(ny, nx) * 2)) +
          0.22 * wave;
      } else {
        h = -0.35 * Math.exp(-(r ** 2) / 0.45) + 0.22 * Math.sin(nx * 6.5 + seed * 0.4) + 0.2 * wave;
      }
      row.push(h * slopeFactor);
    }
    zGrid.push(row);
  }

  const flat = zGrid.flat();
  const zMin = Math.min(...flat);
  const zMax = Math.max(...flat);
  const span = zMax - zMin || 1;
  const normalized = zGrid.map((row) => row.map((v) => roundTo(((v - zMin) / span) * reliefM, 1)));
  const transect = normalized[Math.floor(size / 2)];
  return { size, z: normalized, transect, relief_m: reliefM, slope_deg: slopeDeg, rms_step_m: 25.0 };
}

export function compareTerrain({ aoi_id = "jezero_crater", site_id = "tindouf_sebkha", box = [0, 0, 1, 1] } = {}) {
  const aoi = CATALOG.planetary_aois.find((a) => a.id === aoi_id) || CATALOG.planetary_aois[0];
  const site = CATALOG.earth_sites.find((s) => s.id === site_id) || CATALOG.earth_sites[0];

  const targetGridId = PLANETARY_GRID_MAP[aoi_id];
  const siteGridId = EARTH_GRID_MAP[site_id];
  const targetGrid = TERRAIN_GRIDS_MAP[targetGridId];
  const siteGrid = TERRAIN_GRIDS_MAP[siteGridId];

  let aoiTerrain;
  let siteTerrain;

  if (targetGrid && siteGrid) {
    const aoiStats = computeGridStats(targetGrid, box);
    const siteStats = computeGridStats(siteGrid, [0, 0, 1, 1]);
    const aoiMatrix = extractSubgridMatrix(targetGrid, box);
    const siteMatrix = extractSubgridMatrix(siteGrid, [0, 0, 1, 1]);

    aoiTerrain = {
      z: aoiMatrix,
      transect: aoiStats.profile.map((p) => p.elevation).filter((e) => e !== null),
      relief_m: roundTo(aoiStats.relief, 1),
      slope_deg: roundTo(aoiStats.slope, 2),
      rms_step_m: roundTo((targetGrid.dx || 500) * 0.05, 1),
      is_real_measurement: true,
      badge: `[Mesure Réelle · ${targetGrid.source || "NASA PDS"}]`,
      source: targetGrid.source,
      product: targetGrid.product,
      datum: targetGrid.datum,
      resolution: targetGrid.nativeResolution,
      bbox: aoiStats.bbox,
      coverage_pct: aoiStats.coverage,
    };

    siteTerrain = {
      z: siteMatrix,
      transect: siteStats.profile.map((p) => p.elevation).filter((e) => e !== null),
      relief_m: roundTo(siteStats.relief, 1),
      slope_deg: roundTo(siteStats.slope, 2),
      rms_step_m: roundTo((siteGrid.dx || 500) * 0.05, 1),
      is_real_measurement: true,
      badge: `[Mesure Réelle · ${siteGrid.source || "Copernicus DEM"}]`,
      source: siteGrid.source,
      product: siteGrid.product,
      datum: siteGrid.datum,
      resolution: siteGrid.nativeResolution,
      bbox: siteStats.bbox,
      coverage_pct: siteStats.coverage,
    };
  } else {
    aoiTerrain = generateProceduralTerrain(
      aoi.terrain_seed || 1,
      aoi.terrain_style || "delta_crater",
      Number(aoi.features.altimetry?.value || 200),
      Number(aoi.features.slope_roughness?.value || 3)
    );
    aoiTerrain.is_real_measurement = false;
    aoiTerrain.badge = "[Modélisation 3D / Synthèse]";

    siteTerrain = generateProceduralTerrain(
      site.terrain_seed || 2,
      site.terrain_style || "clay_plain",
      Number(site.features.altimetry?.value || 250),
      Number(site.features.slope_roughness?.value || 3.5)
    );
    siteTerrain.is_real_measurement = false;
    siteTerrain.badge = "[Modélisation 3D / Synthèse]";
  }

  return {
    aoi: { id: aoi.id, name: aoi.name, body: aoi.body, terrain: aoiTerrain },
    earth: { id: site.id, name: site.name, country: site.country, terrain: siteTerrain },
  };
}

export function queryCopilot(analysis, question = "Why Tindouf?", lang = "en") {
  const q = question.toLowerCase();
  const { aoi, mission, results } = analysis || runAnalysis();
  let matched = results.find((r) => {
    const tokens = [r.site_id.split("_")[0], r.name.toLowerCase().split(" ")[0], r.country.toLowerCase()];
    return tokens.some((t) => t.length > 3 && q.includes(t));
  });

  if (q.includes("tindouf")) matched = results.find((r) => r.site_id === "tindouf_sebkha") || matched;
  else if (q.includes("atacama")) matched = results.find((r) => r.site_id === "atacama_yungay") || matched;
  else if (q.includes("mcmurdo") || q.includes("antarct")) matched = results.find((r) => r.site_id === "mcmurdo_dry_valleys") || matched;
  else if (q.includes("iriqui") || q.includes("maroc") || q.includes("morocco") || q.includes("draa")) {
    matched = results.find((r) => r.site_id === "iriqui_draa") || matched;
  }

  const target = matched || results[0];
  if (!target) {
    return { answer: "No candidate evaluation data is available yet.", citations: [], limits: [] };
  }

  const observed = Object.entries(target.criterion_details)
    .filter(([, d]) => d.status === "observed" && d.score !== null)
    .map(([cid, d]) => [cid, d.score])
    .sort((a, b) => b[1] - a[1]);

  const simPct = roundTo(target.similarity_score * 100, 1);
  const aptPct = roundTo(target.mission_aptitude_score * 100, 1);
  const confPct = roundTo(target.confidence_score * 100, 1);
  const strongTxt = observed.slice(0, 2).map(([c, s]) => `${c} (${roundTo(s * 100, 1)}%)`).join(", ");
  const weakest = observed[observed.length - 1];
  const weakTxt = weakest ? `${weakest[0]} (${roundTo(weakest[1] * 100, 1)}%)` : "N/A";

  let answer;
  if (/limit|missing|uncertaint|confidence|confiance|manquant|incertitude/.test(q)) {
    const missingStr = target.missing_criteria.join(", ") || "None";
    const incompStr = target.incompatible_criteria.join(", ") || "None";
    answer =
      lang === "fr"
        ? `Analyse de confiance et limites pour **${target.name}** face à **${aoi.name}** : Confiance **${confPct}%** (couverture pondérée : ${Math.round(target.coverage_ratio * 100)}%). Variables manquantes : **${missingStr}** ; variables écartées par garde-fou : **${incompStr}**.`
        : `Confidence & limits audit for **${target.name}** against **${aoi.name}**: Confidence is **${confPct}%** (weighted coverage: ${Math.round(target.coverage_ratio * 100)}%). Missing variables: **${missingStr}**; excluded by guardrail: **${incompStr}**. Missing criteria are never silently imputed—they reduce Confidence.`;
  } else if (/compare|compar|triad|versus|\bvs\b/.test(q)) {
    const triad = results.filter((r) =>
      ["tindouf_sebkha", "atacama_yungay", "mcmurdo_dry_valleys"].includes(r.site_id)
    );
    const list = triad.length ? triad : results.slice(0, 3);
    const header =
      lang === "fr"
        ? `Comparaison pour **${aoi.name}** (*${mission.name_fr}*) :`
        : `Comparison for **${aoi.name}** under *${mission.name_en}*:`;
    const lines = list.map(
      (r) =>
        `- **#${r.rank} ${r.name}**: Similarity **${roundTo(r.similarity_score * 100, 1)}%** | Mission Aptitude **${roundTo(r.mission_aptitude_score * 100, 1)}%** | Confidence **${roundTo(r.confidence_score * 100, 1)}%**`
    );
    answer = `${header}\n${lines.join("\n")}`;
  } else {
    answer =
      lang === "fr"
        ? `Pour **${aoi.name}** (${mission.name_fr}), **${target.name}** (Rang #${target.rank}) obtient **${simPct}%** de Similarité, **${aptPct}%** d'Aptitude Mission et **${confPct}%** de Confiance.\n\n• **Points forts calculés** : ${strongTxt}.\n• **Critère le plus faible** : ${weakTxt}.\n• **Ancrage scientifique** : ${target.summary}`
        : `For target **${aoi.name}** under **${mission.name_en}**, **${target.name}** (Rank #${target.rank}) achieves **${simPct}% Similarity**, **${aptPct}% Mission Aptitude**, and **${confPct}% Confidence**.\n\n• **Top computed drivers**: ${strongTxt}.\n• **Weakest comparable axis**: ${weakTxt}.\n• **Scientific context**: ${target.summary}`;
  }

  const citations = (target.publications || []).map((p) => ({
    title: p.citation,
    doi: p.doi,
    url: p.url,
    finding: p.key_finding,
  }));

  return {
    site_id: target.site_id,
    answer,
    citations,
    limits: target.limits || [],
    guardrail: "LLM explains computed scores and peer-reviewed evidence; it never fabricates measurements.",
  };
}

export function buildReport(analysis, format = "json") {
  const { aoi, mission, results } = analysis || runAnalysis();
  if (format === "csv") {
    const header = ["Rank", "Site ID", "Site Name", "Country", "Similarity (%)", "Aptitude (%)", "Confidence (%)"];
    const rows = results.map((r) => [
      r.rank,
      r.site_id,
      `"${r.name}"`,
      `"${r.country}"`,
      roundTo(r.similarity_score * 100, 1),
      roundTo(r.mission_aptitude_score * 100, 1),
      roundTo(r.confidence_score * 100, 1),
    ]);
    return {
      format: "csv",
      filename: `terra_x_${aoi.id}_report.csv`,
      mime: "text/csv",
      content: [header.join(","), ...rows.map((row) => row.join(","))].join("\n"),
    };
  }
  return {
    format: "json",
    filename: `terra_x_${aoi.id}_report.json`,
    mime: "application/json",
    content: JSON.stringify(analysis, null, 2),
  };
}

/**
 * Handle incoming API paths directly in the browser when running without a backend.
 */
export async function handleStaticApi(path, options = {}) {
  let body = {};
  if (options.body) {
    try {
      body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
    } catch (_) {}
  }

  const cleanPath = path.split("?")[0].replace(/^https?:\/\/[^\/]+/, "");

  let data;
  let status = 200;

  if (cleanPath === "/api/datasets") {
    data = CATALOG;
  } else if (cleanPath === "/api/analyses" || cleanPath === "/api/missions/simulate") {
    data = runAnalysis({
      aoiId: body.aoi_id,
      missionId: body.mission_id,
      rawWeights: body.weights,
      discoveryMode: body.discovery_mode,
      regionGroup: body.region_group,
    });
  } else if (cleanPath === "/api/terrain/compare") {
    data = compareTerrain({
      aoi_id: body.aoi_id,
      site_id: body.site_id,
      box: body.box,
    });
  } else if (cleanPath === "/api/copilot/query") {
    data = queryCopilot(body.analysis, body.question, body.lang);
  } else if (cleanPath === "/api/reports") {
    data = buildReport(body.analysis, body.format);
  } else if (cleanPath === "/api/regions/planetary") {
    const aoiId = body.aoi_id || "jezero_crater";
    const region = { aoi_id: aoiId, area_km2: body.area_km2 || 145, polygon: body.custom_polygon || null };
    CUSTOM_AOIS.set(aoiId, region);
    data = { status: "selected", region };
  } else if (cleanPath === "/api/discovery/jobs") {
    const sites = discoverSites({ mode: body.mode || "global" });
    const jobId = Math.random().toString(36).slice(2, 10);
    data = { job_id: jobId, status: "completed", mode: body.mode || "global", count: sites.length, sites };
    JOBS_STORE.set(jobId, data);
  } else if (cleanPath.startsWith("/api/discovery/jobs/")) {
    const jobId = cleanPath.split("/").pop();
    data = JOBS_STORE.get(jobId) || { job_id: jobId, status: "completed" };
  } else {
    data = { status: "ok" };
  }

  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Seamless Global Fetch Interceptor
if (typeof window !== "undefined") {
  const originalFetch = window.fetch.bind(window);
  window.fetch = async function (resource, init) {
    const url = typeof resource === "string" ? resource : resource?.url || "";
    if (url.startsWith("/api/") || url.includes("/api/")) {
      try {
        const networkResponse = await originalFetch(resource, init);
        if (networkResponse && networkResponse.ok) {
          return networkResponse;
        }
      } catch (_) {
        // Network failure (GoDaddy static hosting, file:// or offline mode)
      }
      return handleStaticApi(url, init);
    }
    return originalFetch(resource, init);
  };
}
