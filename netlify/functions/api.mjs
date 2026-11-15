/**
 * Netlify Serverless Function handling all /api/* routes for the TERRA-X POC.
 * Zero external npm dependencies; mirrors engine/similarity.py & server.py.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const CRITERION_IDS = [
  "altimetry",
  "slope_roughness",
  "temperature",
  "aridity",
  "mineralogy",
  "geochemistry",
];

function loadCatalog() {
  const candidates = [
    path.resolve(process.cwd(), "data/scientific_catalog.json"),
    new URL("../../data/scientific_catalog.json", import.meta.url),
  ];
  for (const loc of candidates) {
    try {
      return JSON.parse(readFileSync(loc, "utf8"));
    } catch {
      // Try next candidate path
    }
  }
  throw new Error("Unable to locate data/scientific_catalog.json");
}

const CATALOG = loadCatalog();
const JOBS_STORE = new Map();
const CUSTOM_AOIS = new Map();

function roundTo(val, digits) {
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

function runAnalysis({
  aoiId = "jezero_crater",
  missionId = "soil_geochemistry",
  rawWeights = null,
  discoveryMode = "global",
  regionGroup = null,
}) {
  const baseAoi = CATALOG.planetary_aois.find((a) => a.id === aoiId);
  const mission = CATALOG.missions.find((m) => m.id === missionId);
  if (!baseAoi) throw new Error(`Unknown planetary AOI '${aoiId}'`);
  if (!mission) throw new Error(`Unknown mission scenario '${missionId}'`);

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

  const analysisId = `TX-RUN-${aoiId.slice(0, 4).toUpperCase()}-${missionId.slice(0, 4).toUpperCase()}-${crypto.randomUUID().slice(0, 6)}`;
  const execTimestamp = new Date().toISOString();

  evaluated.forEach((item, idx) => {
    item.rank = idx + 1;
    item.analysis_id = analysisId;
    item.target_aoi = aoi.name;
    item.target_body = aoi.body;
    item.mission_id = missionId;
    item.mission_name = mission.name_en || missionId;
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

function generateTerrainGrid(seed, style, reliefM, slopeDeg, size = 26) {
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
      } else if (style === "mound_basin") {
        h = 1.0 * Math.exp(-(r ** 2) / 0.22) - 0.35 * Math.exp(-((r - 0.62) ** 2) / 0.05) + 0.24 * wave;
      } else if (style === "lava_pit") {
        h = -1.05 * Math.exp(-(r ** 2) / 0.07) + 0.3 * Math.sin(nx * 4 + ny * 1.5) + 0.18 * wave;
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
  let sqDiff = 0;
  for (let i = 0; i < transect.length - 1; i += 1) {
    sqDiff += (transect[i + 1] - transect[i]) ** 2;
  }
  const rmsStepM = roundTo(Math.sqrt(sqDiff / Math.max(1, transect.length - 1)), 1);

  return { size, z: normalized, transect, relief_m: reliefM, slope_deg: slopeDeg, rms_step_m: rmsStepM };
}

function queryCopilot(analysis, question = "Why Tindouf?", lang = "en") {
  const q = question.toLowerCase();
  const { aoi, mission, results } = analysis;
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
  for (const dsId of (aoi.datasets || []).slice(0, 2)) {
    const ds = CATALOG.datasets.find((d) => d.id === dsId);
    if (ds) {
      citations.push({
        title: `${ds.name} (${ds.source})`,
        doi: ds.product,
        url: ds.url,
        finding: `Resolution: ${ds.resolution} | Units: ${ds.units}`,
      });
    }
  }

  return {
    site_id: target.site_id,
    answer,
    citations,
    limits: target.limits || [],
    guardrail: "LLM explains computed scores and peer-reviewed evidence; it never fabricates measurements.",
  };
}

function csvEscape(val) {
  const s = String(val ?? "");
  return /[",\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

function buildReportPayload(analysis, copilotHistory = [], fmt = "json") {
  const { aoi, mission, results, sensitivity } = analysis;

  if (fmt === "csv") {
    const header = [
      "Rank", "Site ID", "Site Name", "Country", "Lat", "Lon",
      "Similarity (%)", "Mission Aptitude (%)", "Confidence (%)",
      "Missing Criteria", "Incompatible Criteria", "Primary Reference",
    ];
    const rows = results.map((r) => [
      r.rank, r.site_id, r.name, r.country, r.lat, r.lon,
      roundTo(r.similarity_score * 100, 1),
      roundTo(r.mission_aptitude_score * 100, 1),
      roundTo(r.confidence_score * 100, 1),
      r.missing_criteria.join(";") || "None",
      r.incompatible_criteria.join(";") || "None",
      r.publications?.[0]?.doi || "Catalog",
    ]);
    const csv = [header, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    return { format: "csv", filename: `terra_x_${aoi.id}_report.csv`, mime: "text/csv", content: csv };
  }

  if (fmt === "geojson") {
    const geojson = {
      type: "FeatureCollection",
      features: results.map((r) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [r.lon, r.lat] },
        properties: {
          rank: r.rank,
          site_id: r.site_id,
          name: r.name,
          country: r.country,
          target_aoi: aoi.id,
          mission: mission.id,
          similarity_score: r.similarity_score,
          mission_aptitude_score: r.mission_aptitude_score,
          confidence_score: r.confidence_score,
          status: r.status,
        },
      })),
    };
    return {
      format: "geojson",
      filename: `terra_x_${aoi.id}_candidates.geojson`,
      mime: "application/geo+json",
      content: JSON.stringify(geojson, null, 2),
    };
  }

  if (fmt === "doc") {
    const rowsHtml = results
      .map(
        (r) =>
          `<tr><td>#${r.rank}</td><td>${r.name} (${r.country})</td><td>${roundTo(r.similarity_score * 100, 1)}%</td><td>${roundTo(r.mission_aptitude_score * 100, 1)}%</td><td>${roundTo(r.confidence_score * 100, 1)}%</td><td>${r.missing_criteria.join(", ") || "None"}</td></tr>`
      )
      .join("");
    const limitsHtml = results
      .slice(0, 3)
      .map((r) => `<li><strong>${r.name}:</strong> ${r.limits.join(" ")}</li>`)
      .join("");
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>TERRA-X Report — ${aoi.name}</title>
<style>body{font-family:Arial,sans-serif;color:#111;max-width:850px;margin:24px auto;line-height:1.5}
table{border-collapse:collapse;width:100%;margin:16px 0}th,td{border:1px solid #cbd5e1;padding:8px;text-align:left}
th{background:#0f172a;color:#fff}.note{background:#f8fafc;border-left:4px solid #0ea5e9;padding:10px;margin:12px 0}</style></head>
<body><h1>TERRA-X — Scientific Analog Analysis Report</h1>
<p><strong>Planetary Target:</strong> ${aoi.body.toUpperCase()} — ${aoi.name} (${aoi.target_crs})</p>
<p><strong>Mission Scenario:</strong> ${mission.name_en} (${mission.focus})</p>
<div class="note">${analysis.scientific_note}</div>
<h2>1. Ranked Candidate Earth Analogs</h2>
<table><thead><tr><th>Rank</th><th>Candidate Site</th><th>Similarity</th><th>Mission Aptitude</th><th>Confidence</th><th>Missing Data</th></tr></thead><tbody>${rowsHtml}</tbody></table>
<h2>2. Sensitivity & Robustness</h2>
<p>Ranking Stability Score (±15% weight perturbation): <strong>${Math.round(sensitivity.stability_score * 100)}%</strong> (${sensitivity.rank_flip_count} rank change(s) across ${sensitivity.total_perturbations} tests).</p>
<h2>3. Key Scientific Limitations</h2><ul>${limitsHtml}</ul></body></html>`;
    return { format: "doc", filename: `terra_x_${aoi.id}_report.doc`, mime: "application/msword", content: html };
  }

  return {
    format: "json",
    filename: `terra_x_${aoi.id}_report.json`,
    mime: "application/json",
    content: { analysis, copilot_notes: copilotHistory },
  };
}

export default async (req) => {
  const url = new URL(req.url);
  const pathName = url.pathname;

  try {
    if (req.method === "GET" && pathName === "/api/health") {
      return Response.json({ status: "ok", runtime: "netlify-functions", version: CATALOG.metadata.version });
    }

    if (req.method === "GET" && pathName === "/api/datasets") {
      const bodyFilter = url.searchParams.get("body");
      const datasets = bodyFilter ? CATALOG.datasets.filter((d) => d.body === bodyFilter) : CATALOG.datasets;
      return Response.json({
        datasets,
        criteria: CATALOG.criteria,
        planetary_aois: CATALOG.planetary_aois,
        missions: CATALOG.missions,
      });
    }

    if (req.method === "GET" && pathName.startsWith("/api/jobs/")) {
      const jobId = pathName.split("/api/jobs/")[1];
      const job = JOBS_STORE.get(jobId) || { job_id: jobId, status: "completed", note: "Stateless function completion" };
      return Response.json(job);
    }

    if (req.method !== "POST") {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));

    if (pathName === "/api/regions/planetary") {
      const aoiId = body.aoi_id || "jezero_crater";
      const base = CATALOG.planetary_aois.find((a) => a.id === aoiId);
      if (!base) return Response.json({ error: `Unknown AOI ${aoiId}` }, { status: 400 });
      const region = { ...base };
      if (body.custom_polygon) region.polygon = body.custom_polygon;
      if (body.area_km2) region.area_km2 = Number(body.area_km2);
      CUSTOM_AOIS.set(aoiId, region);
      return Response.json({ status: "selected", region });
    }

    if (pathName === "/api/discovery/jobs") {
      const mode = body.mode || "global";
      const sites = discoverSites({
        mode,
        regionGroup: body.region_group || null,
        maxSlopeDeg: body.max_slope_deg != null ? Number(body.max_slope_deg) : null,
        minAridity: body.min_aridity != null ? Number(body.min_aridity) : null,
      });
      const jobId = crypto.randomUUID().slice(0, 8);
      const job = { job_id: jobId, status: "completed", mode, count: sites.length, sites };
      JOBS_STORE.set(jobId, job);
      return Response.json(job);
    }

    if (pathName === "/api/analyses" || pathName === "/api/missions/simulate") {
      const result = runAnalysis({
        aoiId: body.aoi_id || "jezero_crater",
        missionId: body.mission_id || "soil_geochemistry",
        rawWeights: body.weights || null,
        discoveryMode: body.discovery_mode || "global",
        regionGroup: body.region_group || null,
      });
      return Response.json(result);
    }

    if (pathName === "/api/terrain/compare") {
      const aoi = CATALOG.planetary_aois.find((a) => a.id === (body.aoi_id || "jezero_crater"));
      const site = CATALOG.earth_sites.find((s) => s.id === (body.site_id || "tindouf_sebkha"));
      if (!aoi || !site) return Response.json({ error: "Invalid aoi_id or site_id" }, { status: 400 });
      return Response.json({
        aoi: {
          id: aoi.id,
          name: aoi.name,
          body: aoi.body,
          terrain: generateTerrainGrid(
            aoi.terrain_seed || 1,
            aoi.terrain_style || "delta_crater",
            Number(aoi.features.altimetry.value),
            Number(aoi.features.slope_roughness.value)
          ),
        },
        earth: {
          id: site.id,
          name: site.name,
          country: site.country,
          terrain: generateTerrainGrid(
            site.terrain_seed || 2,
            site.terrain_style || "clay_plain",
            Number(site.features.altimetry.value),
            Number(site.features.slope_roughness.value)
          ),
        },
      });
    }

    if (pathName === "/api/copilot/query") {
      const analysis = runAnalysis({
        aoiId: body.aoi_id || "jezero_crater",
        missionId: body.mission_id || "soil_geochemistry",
        rawWeights: body.weights || null,
        discoveryMode: body.discovery_mode || "global",
      });
      return Response.json(queryCopilot(analysis, body.question || "Why Tindouf?", body.lang || "en"));
    }

    if (pathName === "/api/reports") {
      const analysis = runAnalysis({
        aoiId: body.aoi_id || "jezero_crater",
        missionId: body.mission_id || "soil_geochemistry",
        rawWeights: body.weights || null,
        discoveryMode: body.discovery_mode || "global",
      });
      return Response.json(buildReportPayload(analysis, body.copilot_history || [], body.format || "json"));
    }

    return Response.json({ error: "Endpoint not found" }, { status: 404 });
  } catch (err) {
    return Response.json({ error: err?.message || "Internal server error" }, { status: 500 });
  }
};

export const config = {
  path: "/api/*",
};
