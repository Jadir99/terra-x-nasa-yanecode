"""Scientific similarity, mission aptitude, confidence, discovery, 3D terrain, and grounded copilot engine."""

from __future__ import annotations

import copy
import csv
from datetime import datetime, timezone
import io
import json
import math
from typing import Any


CRITERION_IDS = [
    "altimetry",
    "slope_roughness",
    "temperature",
    "aridity",
    "mineralogy",
    "geochemistry",
]


def load_catalog(path: str) -> dict[str, Any]:
    """Load the scientific catalog JSON from disk."""
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def normalize_weights(raw_weights: dict[str, float] | None) -> dict[str, float]:
    """Normalize criterion weights so their sum strictly equals 1.0."""
    if not raw_weights:
        equal = 1.0 / len(CRITERION_IDS)
        return {cid: round(equal, 6) for cid in CRITERION_IDS}

    cleaned = {cid: max(0.0, float(raw_weights.get(cid, 0.0))) for cid in CRITERION_IDS}
    total = sum(cleaned.values())
    if total <= 0.0:
        equal = 1.0 / len(CRITERION_IDS)
        return {cid: round(equal, 6) for cid in CRITERION_IDS}

    return {cid: cleaned[cid] / total for cid in CRITERION_IDS}


def _jaccard_overlap(tags_a: list[str] | None, tags_b: list[str] | None) -> float | None:
    """Compute Jaccard similarity between two mineral/geochemical tag lists."""
    if not tags_a or not tags_b:
        return None
    set_a = set(tags_a)
    set_b = set(tags_b)
    union = set_a | set_b
    if not union:
        return None
    return len(set_a & set_b) / len(union)


def compute_criterion_similarity(
    criterion_meta: dict[str, Any],
    aoi_feat: dict[str, Any] | None,
    site_feat: dict[str, Any] | None,
    body: str,
) -> dict[str, Any]:
    """Compute proximity s_ij in [0, 1] with scientific compatibility guardrails."""
    cid = criterion_meta["id"]
    comparable_key = "comparable_moon" if body == "moon" else "comparable_mars"
    if not criterion_meta.get(comparable_key, True):
        return {
            "criterion": cid,
            "status": "incompatible",
            "score": None,
            "reason": f"Guardrail: '{cid}' is not physically comparable for {body.upper()} targets.",
        }

    if aoi_feat is None or site_feat is None:
        missing_side = "planetary AOI" if aoi_feat is None else "Earth site"
        return {
            "criterion": cid,
            "status": "missing",
            "score": None,
            "reason": f"Missing harmonized measurement on {missing_side}.",
        }

    val_a = float(aoi_feat["value"])
    val_b = float(site_feat["value"])
    scale = float(criterion_meta.get("scale_max", 1.0)) or 1.0

    # Physical proximity: 1 - normalized absolute difference, clamped to [0, 1]
    numeric_prox = max(0.0, min(1.0, 1.0 - abs(val_a - val_b) / scale))

    # For mineralogy and geochemistry, blend abundance index with compositional Jaccard overlap
    if cid in ("mineralogy", "geochemistry"):
        jacc = _jaccard_overlap(aoi_feat.get("tags"), site_feat.get("tags"))
        if jacc is not None:
            proximity = 0.45 * numeric_prox + 0.55 * jacc
        else:
            proximity = numeric_prox
    else:
        proximity = numeric_prox

    return {
        "criterion": cid,
        "status": "observed",
        "score": round(proximity, 4),
        "aoi_value": val_a,
        "site_value": val_b,
        "unit": criterion_meta.get("unit", ""),
        "site_provenance": site_feat.get("provenance", "Unknown"),
        "site_resolution_m": site_feat.get("resolution_m"),
        "measurement_type": site_feat.get("measurement_type", "orbital"),
    }


def _compute_raw_similarity_and_coverage(
    criteria_map: dict[str, dict[str, Any]],
    aoi: dict[str, Any],
    site: dict[str, Any],
    weights: dict[str, float],
) -> tuple[float, float, dict[str, dict[str, Any]], list[str], list[str]]:
    """Evaluate criterion proximities and return weighted similarity with missing-data tracking."""
    body = aoi["body"]
    details: dict[str, dict[str, Any]] = {}
    observed_weight = 0.0
    weighted_sum = 0.0
    missing: list[str] = []
    incompatible: list[str] = []

    for cid in CRITERION_IDS:
        cmeta = criteria_map[cid]
        res = compute_criterion_similarity(
            cmeta,
            aoi["features"].get(cid),
            site["features"].get(cid),
            body,
        )
        details[cid] = res
        w = weights.get(cid, 0.0)
        if res["status"] == "observed" and res["score"] is not None:
            observed_weight += w
            weighted_sum += w * res["score"]
        elif res["status"] == "missing":
            missing.append(cid)
        elif res["status"] == "incompatible":
            incompatible.append(cid)

    # Explicit weight redistribution over observed & compatible criteria
    if observed_weight > 0:
        similarity = weighted_sum / observed_weight
    else:
        similarity = 0.0

    # Effective weight coverage (how much of the mission's weighted priorities had valid data)
    coverage = observed_weight
    return similarity, coverage, details, missing, incompatible


def evaluate_site(
    catalog: dict[str, Any],
    aoi: dict[str, Any],
    site: dict[str, Any],
    weights: dict[str, float],
    mission: dict[str, Any],
) -> dict[str, Any]:
    """Compute Similarity, Mission Aptitude, Confidence, and full scientific audit for one site."""
    criteria_map = {c["id"]: c for c in catalog["criteria"]}
    similarity, coverage, details, missing, incompatible = _compute_raw_similarity_and_coverage(
        criteria_map, aoi, site, weights
    )

    # 1. Mission Aptitude: real-world operational fitness (constraints, safety, accessibility)
    access = float(site.get("accessibility_score", 0.7))
    safety = float(site.get("safety_score", 0.7))
    site_slope = (site["features"].get("slope_roughness") or {}).get("value", 10.0)
    max_safe_slope = float(mission.get("max_safe_slope_deg", 20.0))

    slope_penalty = 0.0
    if site_slope > max_safe_slope:
        slope_penalty = min(0.35, (site_slope - max_safe_slope) * 0.03)

    mission_id = mission["id"]
    if mission_id == "rover_mobility":
        aptitude = 0.55 * similarity + 0.25 * access + 0.20 * safety - slope_penalty
    elif mission_id == "cold_arid":
        aptitude = 0.72 * similarity + 0.14 * access + 0.14 * safety - slope_penalty * 0.5
    else:
        aptitude = 0.68 * similarity + 0.18 * access + 0.14 * safety - slope_penalty * 0.5

    aptitude = max(0.0, min(1.0, aptitude))

    # 2. Confidence: data coverage, in-situ quality, resolution parity, and uncertainty
    observed_details = [d for d in details.values() if d["status"] == "observed"]
    in_situ_count = sum(1 for d in observed_details if d.get("measurement_type") == "in_situ")
    in_situ_ratio = in_situ_count / max(1, len(observed_details))

    # Resolution parity penalty if coarse climate grid (>1000m) dominates
    high_res_count = sum(
        1 for d in observed_details if (d.get("site_resolution_m") or 9999) <= 100
    )
    res_ratio = high_res_count / max(1, len(observed_details))

    confidence = 0.50 * coverage + 0.30 * in_situ_ratio + 0.20 * res_ratio
    if missing:
        confidence = max(0.15, confidence - 0.08 * len(missing))
    confidence = max(0.0, min(1.0, confidence))

    return {
        "site_id": site["id"],
        "name": site["name"],
        "country": site["country"],
        "region_group": site["region_group"],
        "lat": site["lat"],
        "lon": site["lon"],
        "elevation_m": site["elevation_m"],
        "status": site["status"],
        "summary": site["summary"],
        "similarity_score": round(similarity, 4),
        "mission_aptitude_score": round(aptitude, 4),
        "confidence_score": round(confidence, 4),
        "composite_rank_score": round(0.65 * similarity + 0.35 * aptitude, 4),
        "coverage_ratio": round(coverage, 4),
        "missing_criteria": missing,
        "incompatible_criteria": incompatible,
        "criterion_details": details,
        "publications": site.get("publications", []),
        "limits": site.get("limits", []),
        "terrain_seed": site.get("terrain_seed", 1),
        "terrain_style": site.get("terrain_style", "clay_plain"),
        "slope_deg": site_slope,
        "relief_m": (site["features"].get("altimetry") or {}).get("value", 300),
        "crs": site.get("crs", "WGS 84 (EPSG:4326)"),
        "position_reference": site.get("position_reference", "Point de référence du catalogue"),
        "position_source": site.get("position_source", "Catalogue TERRA-X / DEM"),
        "bounding_box": site.get("bounding_box"),
        "bbox": site.get("bounding_box"),
        "raster_product": site.get("raster_product"),
        "grid_dx": site.get("grid_dx"),
        "is_regional": site.get("is_regional", False),
        "sector_note": site.get("sector_note", ""),
    }


def _compute_sensitivity(
    catalog: dict[str, Any],
    aoi: dict[str, Any],
    sites: list[dict[str, Any]],
    weights: dict[str, float],
    mission: dict[str, Any],
    baseline_ranking: list[str],
) -> dict[str, Any]:
    """Perturb top criterion weights by +/-15% to test ranking stability (Slide 4 & 11)."""
    top_criteria = sorted(weights.items(), key=lambda kv: kv[1], reverse=True)[:2]
    flips = 0
    tested_scenarios = []

    for cid, _ in top_criteria:
        for delta in (-0.15, 0.15):
            perturbed = dict(weights)
            perturbed[cid] = max(0.01, perturbed[cid] * (1.0 + delta))
            norm_p = normalize_weights(perturbed)
            scored = [evaluate_site(catalog, aoi, s, norm_p, mission) for s in sites]
            scored.sort(key=lambda r: r["similarity_score"], reverse=True)
            top_id = scored[0]["site_id"] if scored else None
            changed = top_id != (baseline_ranking[0] if baseline_ranking else None)
            if changed:
                flips += 1
            tested_scenarios.append(
                {
                    "criterion": cid,
                    "delta_pct": int(delta * 100),
                    "top_site_id": top_id,
                    "rank_changed": changed,
                }
            )

    stability_score = 1.0 - (flips / max(1, len(tested_scenarios)))
    return {
        "stability_score": round(stability_score, 2),
        "rank_flip_count": flips,
        "total_perturbations": len(tested_scenarios),
        "scenarios": tested_scenarios,
    }


def discover_sites(
    catalog: dict[str, Any],
    mode: str = "global",
    region_group: str | None = None,
    max_slope_deg: float | None = None,
    min_aridity: float | None = None,
) -> list[dict[str, Any]]:
    """Filter Earth analog candidates in Global or Regional (e.g., Morocco/North Africa) mode."""
    sites = catalog["earth_sites"]
    results = []
    for site in sites:
        if mode == "regional":
            target_region = region_group or "north_africa"
            if site.get("region_group") != target_region:
                continue
        elif mode == "benchmark":
            if site["id"] not in ("tindouf_sebkha", "atacama_yungay", "mcmurdo_dry_valleys"):
                continue

        slope = (site["features"].get("slope_roughness") or {}).get("value")
        if max_slope_deg is not None and slope is not None and slope > max_slope_deg:
            continue

        aridity = (site["features"].get("aridity") or {}).get("value")
        if min_aridity is not None and aridity is not None and aridity < min_aridity:
            continue

        results.append(site)
    return results


def run_analysis(
    catalog: dict[str, Any],
    aoi_id: str,
    mission_id: str = "soil_geochemistry",
    raw_weights: dict[str, float] | None = None,
    discovery_mode: str = "global",
    region_group: str | None = None,
    custom_aoi_override: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Execute end-to-end multicriteria similarity & mission aptitude evaluation."""
    aois_map = {a["id"]: a for a in catalog["planetary_aois"]}
    missions_map = {m["id"]: m for m in catalog["missions"]}

    if aoi_id not in aois_map:
        raise ValueError(f"Unknown planetary AOI '{aoi_id}'")
    if mission_id not in missions_map:
        raise ValueError(f"Unknown mission scenario '{mission_id}'")

    aoi = copy.deepcopy(aois_map[aoi_id])
    if custom_aoi_override:
        if "area_km2" in custom_aoi_override:
            aoi["area_km2"] = float(custom_aoi_override["area_km2"])
        if "polygon" in custom_aoi_override:
            aoi["polygon"] = custom_aoi_override["polygon"]
        if "name" in custom_aoi_override:
            aoi["name"] = custom_aoi_override["name"]

    mission = missions_map[mission_id]
    weights = normalize_weights(raw_weights if raw_weights else mission["weights"])

    candidate_sites = discover_sites(catalog, mode=discovery_mode, region_group=region_group)
    if not candidate_sites:
        candidate_sites = catalog["earth_sites"]

    evaluated = [evaluate_site(catalog, aoi, site, weights, mission) for site in candidate_sites]
    evaluated.sort(key=lambda r: (r["similarity_score"], r["mission_aptitude_score"]), reverse=True)

    # Traceable execution run identifier & timestamp
    weights_tuple = tuple(sorted((k, round(v, 4)) for k, v in weights.items()))
    run_hash = abs(hash((aoi_id, mission_id, weights_tuple, discovery_mode))) % 1000000
    analysis_id = f"TX-RUN-{aoi_id[:4].upper()}-{mission_id[:4].upper()}-{run_hash:06d}"
    exec_timestamp = datetime.now(timezone.utc).isoformat()

    for idx, item in enumerate(evaluated, start=1):
        item["rank"] = idx
        item["analysis_id"] = analysis_id
        item["target_aoi"] = aoi["name"]
        item["target_body"] = aoi["body"]
        item["mission_id"] = mission_id
        item["mission_name"] = mission.get("name_en", mission_id)

    baseline_ranking = [r["site_id"] for r in evaluated]
    sensitivity = _compute_sensitivity(catalog, aoi, candidate_sites, weights, mission, baseline_ranking)

    return {
        "analysis_id": analysis_id,
        "timestamp": exec_timestamp,
        "aoi": aoi,
        "mission": mission,
        "weights": {k: round(v, 4) for k, v in weights.items()},
        "discovery_mode": discovery_mode,
        "candidate_count": len(evaluated),
        "results": evaluated,
        "sensitivity": sensitivity,
        "scientific_note": (
            "Scores measure similarity across physically comparable variables only. "
            "Earth sites are candidate analogs for specific properties, never full planetary equivalents."
        ),
    }


def generate_terrain_grid(
    seed: int,
    style: str,
    relief_m: float,
    slope_deg: float,
    size: int = 26,
) -> dict[str, Any]:
    """Generate a deterministic 2D elevation grid (m) and transect profile matching site relief & slope."""
    z_grid: list[list[float]] = []
    center = (size - 1) / 2.0
    slope_factor = max(0.35, min(2.2, slope_deg / 8.5))

    for y in range(size):
        row: list[float] = []
        ny = (y - center) / center
        for x in range(size):
            nx = (x - center) / center
            r = math.sqrt(nx * nx + ny * ny)
            wave = (
                0.28 * math.sin(nx * 3.1 + seed * 0.7) * math.cos(ny * 2.7 - seed * 0.3)
                + 0.14 * math.sin((nx + ny) * 5.2 + seed)
            )

            if style == "delta_crater":
                rim = 0.75 * math.exp(-((r - 0.72) ** 2) / 0.045)
                delta = 0.55 * math.exp(-((nx + 0.35) ** 2 + (ny * 1.4) ** 2) / 0.18)
                h = rim + delta + 0.25 * wave
            elif style == "polar_rim":
                crater = -0.85 * math.exp(-(r ** 2) / 0.24)
                ridge = 0.90 * math.exp(-((r - 0.68) ** 2) / 0.03) * (1 + 0.35 * math.cos(math.atan2(ny, nx) * 2))
                h = crater + ridge + 0.22 * wave
            elif style == "mound_basin":
                mound = 1.0 * math.exp(-(r ** 2) / 0.22)
                ring = -0.35 * math.exp(-((r - 0.62) ** 2) / 0.05)
                h = mound + ring + 0.24 * wave
            elif style == "lava_pit":
                pit = -1.05 * math.exp(-(r ** 2) / 0.07)
                flow = 0.30 * math.sin(nx * 4.0 + ny * 1.5)
                h = pit + flow + 0.18 * wave
            else:  # clay_plain / evaporite basin
                basin = -0.35 * math.exp(-(r ** 2) / 0.45)
                dunes = 0.22 * math.sin(nx * 6.5 + seed * 0.4)
                h = basin + dunes + 0.20 * wave

            row.append(h * slope_factor)
        z_grid.append(row)

    # Normalize z_grid strictly so (max - min) == relief_m
    flat = [v for row in z_grid for v in row]
    z_min, z_max = min(flat), max(flat)
    span = (z_max - z_min) or 1.0
    normalized = [
        [round(((val - z_min) / span) * relief_m, 1) for val in row]
        for row in z_grid
    ]

    mid = size // 2
    transect = normalized[mid]
    rms_roughness_m = round(
        math.sqrt(sum((transect[i + 1] - transect[i]) ** 2 for i in range(len(transect) - 1)) / max(1, len(transect) - 1)),
        1,
    )

    return {
        "size": size,
        "z": normalized,
        "transect": transect,
        "relief_m": relief_m,
        "slope_deg": slope_deg,
        "rms_step_m": rms_roughness_m,
    }


def query_copilot(
    catalog: dict[str, Any],
    analysis_result: dict[str, Any],
    question: str,
    lang: str = "en",
) -> dict[str, Any]:
    """Deterministic grounded RAG explainer: cites live scores, DOIs, and explicit scientific limits."""
    q = question.lower().strip()
    aoi = analysis_result["aoi"]
    mission = analysis_result["mission"]
    results = analysis_result["results"]
    top = results[0] if results else None

    # Identify referenced site if mentioned in question
    matched_site = None
    for res in results:
        tokens = [res["site_id"].split("_")[0], res["name"].lower().split(" ")[0], res["country"].lower()]
        if any(tok in q for tok in tokens if len(tok) > 3):
            matched_site = res
            break

    if "tindouf" in q:
        matched_site = next((r for r in results if r["site_id"] == "tindouf_sebkha"), matched_site)
    elif "atacama" in q:
        matched_site = next((r for r in results if r["site_id"] == "atacama_yungay"), matched_site)
    elif "mcmurdo" in q or "antarct" in q:
        matched_site = next((r for r in results if r["site_id"] == "mcmurdo_dry_valleys"), matched_site)
    elif "iriqui" in q or "maroc" in q or "morocco" in q or "draa" in q:
        matched_site = next((r for r in results if r["site_id"] == "iriqui_draa"), matched_site)

    target_site = matched_site or top
    if not target_site:
        return {
            "answer": "No candidate evaluation data is available yet. Run an analysis first.",
            "citations": [],
            "limits": [],
        }

    # Build grounded metric breakdown from live computation
    observed = [
        (cid, d["score"])
        for cid, d in target_site["criterion_details"].items()
        if d["status"] == "observed" and d["score"] is not None
    ]
    observed.sort(key=lambda kv: kv[1], reverse=True)
    strongest = observed[:2]
    weakest = observed[-1] if observed else None

    sim_pct = round(target_site["similarity_score"] * 100, 1)
    apt_pct = round(target_site["mission_aptitude_score"] * 100, 1)
    conf_pct = round(target_site["confidence_score"] * 100, 1)
    strong_txt = ", ".join(f"{c} ({round(s * 100, 1)}%)" for c, s in strongest)
    weak_txt = f"{weakest[0]} ({round(weakest[1] * 100, 1)}%)" if weakest else "N/A"

    if any(k in q for k in ("limit", "missing", "uncertaint", "confidence", "confiance", "manquant", "incertitude")):
        missing_str = ", ".join(target_site["missing_criteria"]) or "None"
        incomp_str = ", ".join(target_site["incompatible_criteria"]) or "None"
        if lang == "fr":
            answer = (
                f"Analyse de confiance et limites pour **{target_site['name']}** face à **{aoi['name']}** : "
                f"l'indice de Confiance est de **{conf_pct}%** (couverture pondérée : {round(target_site['coverage_ratio']*100)}%). "
                f"Variables manquantes : **{missing_str}** ; variables écartées par garde-fou scientifique : **{incomp_str}**. "
                f"Les poids manquants ne sont jamais remplacés par 0 ou 1 : ils sont redistribués et pénalisent la confiance."
            )
        else:
            answer = (
                f"Confidence & limits audit for **{target_site['name']}** against **{aoi['name']}**: "
                f"Confidence is **{conf_pct}%** (weighted coverage: {round(target_site['coverage_ratio']*100)}%). "
                f"Missing variables: **{missing_str}**; excluded by physical compatibility guardrail: **{incomp_str}**. "
                f"Missing criteria are never silently imputed—their weights are redistributed and explicitly reduce Confidence."
            )
    elif any(k in q for k in ("compare", "compar", "triad", "versus", "vs")):
        triad_ids = ("tindouf_sebkha", "atacama_yungay", "mcmurdo_dry_valleys")
        triad = [r for r in results if r["site_id"] in triad_ids] or results[:3]
        lines = [
            f"- **#{r['rank']} {r['name']}**: Similarity **{round(r['similarity_score']*100,1)}%** | Mission Aptitude **{round(r['mission_aptitude_score']*100,1)}%** | Confidence **{round(r['confidence_score']*100,1)}%**"
            for r in triad
        ]
        header = (
            f"Comparaison pour **{aoi['name']}** (scénario *{mission['name_fr']}*) :"
            if lang == "fr"
            else f"Comparison for **{aoi['name']}** under *{mission['name_en']}*:"
        )
        answer = header + "\n" + "\n".join(lines)
    else:
        if lang == "fr":
            answer = (
                f"Pour la cible **{aoi['name']}** et l'objectif **{mission['name_fr']}**, **{target_site['name']}** "
                f"(Rang #{target_site['rank']}) obtient une Similarité de **{sim_pct}%**, une Aptitude Mission de **{apt_pct}%** "
                f"et une Confiance de **{conf_pct}%**.\n\n"
                f"• **Points forts calculés** : {strong_txt}.\n"
                f"• **Critère le plus faible** : {weak_txt}.\n"
                f"• **Ancrage scientifique** : {target_site['summary']}"
            )
        else:
            answer = (
                f"For target **{aoi['name']}** under **{mission['name_en']}**, **{target_site['name']}** "
                f"(Rank #{target_site['rank']}) achieves **{sim_pct}% Similarity**, **{apt_pct}% Mission Aptitude**, "
                f"and **{conf_pct}% Confidence**.\n\n"
                f"• **Top computed drivers**: {strong_txt}.\n"
                f"• **Weakest comparable axis**: {weak_txt}.\n"
                f"• **Scientific context**: {target_site['summary']}"
            )

        if target_site["site_id"] == "tindouf_sebkha":
            if lang == "fr":
                answer += (
                    "\n\n> **Note d'orientation opérationnelle** : Le Bassin de Tindouf est un analogue d'excellence pour la **géochimie des sols, les sels solubles et les oxychlorines** (perchlorates, sulfates, chlorates ; Oberlin et al., 2018). Pour les essais mécaniques de franchissement et roulage de rover, privilégier la **Vallée du Drâa** et le **Lac Iriqui** (morphologie des terrasses et fentes polygonales)."
                )
            else:
                answer += (
                    "\n\n> **Operational Guidance Note**: The Tindouf Basin is a gold-standard benchmark for **soil geochemistry, soluble salts, and oxychlorines** (perchlorates, sulfates, chlorates; Oberlin et al., 2018). For mechanical rover mobility, slope negotiation, and drive testing, use the **Drâa Valley** and **Lake Iriqui** (fluvial terraces and desiccated mudcrack playas)."
                )

    citations = []
    for pub in target_site.get("publications", []):
        citations.append(
            {
                "title": pub["citation"],
                "doi": pub["doi"],
                "url": pub["url"],
                "finding": pub["key_finding"],
            }
        )
    for ds_id in aoi.get("datasets", [])[:2]:
        ds = next((d for d in catalog["datasets"] if d["id"] == ds_id), None)
        if ds:
            citations.append(
                {
                    "title": f"{ds['name']} ({ds['source']})",
                    "doi": ds["product"],
                    "url": ds["url"],
                    "finding": f"Resolution: {ds['resolution']} | Units: {ds['units']}",
                }
            )

    return {
        "site_id": target_site["site_id"],
        "answer": answer,
        "citations": citations,
        "limits": target_site.get("limits", []),
        "guardrail": "LLM explains computed scores and peer-reviewed evidence; it never fabricates measurements.",
    }


def build_report_payload(
    catalog: dict[str, Any],
    analysis_result: dict[str, Any],
    copilot_history: list[dict[str, Any]] | None = None,
    fmt: str = "json",
) -> dict[str, Any]:
    """Build exportable scientific report in CSV, GeoJSON, Word-compatible HTML, or JSON."""
    aoi = analysis_result["aoi"]
    mission = analysis_result["mission"]
    results = analysis_result["results"]

    if fmt == "csv":
        buf = io.StringIO()
        writer = csv.writer(buf)
        writer.writerow([
            "Rank", "Site ID", "Site Name", "Country", "Lat", "Lon",
            "Similarity (%)", "Mission Aptitude (%)", "Confidence (%)",
            "Missing Criteria", "Incompatible Criteria", "Primary Reference"
        ])
        for r in results:
            ref = r["publications"][0]["doi"] if r["publications"] else "Catalog"
            writer.writerow([
                r["rank"], r["site_id"], r["name"], r["country"], r["lat"], r["lon"],
                round(r["similarity_score"] * 100, 1),
                round(r["mission_aptitude_score"] * 100, 1),
                round(r["confidence_score"] * 100, 1),
                ";".join(r["missing_criteria"]) or "None",
                ";".join(r["incompatible_criteria"]) or "None",
                ref,
            ])
        return {"format": "csv", "filename": f"terra_x_{aoi['id']}_report.csv", "mime": "text/csv", "content": buf.getvalue()}

    if fmt == "geojson":
        features = []
        for r in results:
            features.append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": [r["lon"], r["lat"]]},
                "properties": {
                    "rank": r["rank"],
                    "site_id": r["site_id"],
                    "name": r["name"],
                    "country": r["country"],
                    "target_aoi": aoi["id"],
                    "mission": mission["id"],
                    "similarity_score": r["similarity_score"],
                    "mission_aptitude_score": r["mission_aptitude_score"],
                    "confidence_score": r["confidence_score"],
                    "status": r["status"],
                },
            })
        geojson = {"type": "FeatureCollection", "features": features}
        return {
            "format": "geojson",
            "filename": f"terra_x_{aoi['id']}_candidates.geojson",
            "mime": "application/geo+json",
            "content": json.dumps(geojson, indent=2),
        }

    if fmt == "doc":
        rows_html = "".join(
            f"<tr><td>#{r['rank']}</td><td>{r['name']} ({r['country']})</td>"
            f"<td>{round(r['similarity_score']*100,1)}%</td>"
            f"<td>{round(r['mission_aptitude_score']*100,1)}%</td>"
            f"<td>{round(r['confidence_score']*100,1)}%</td>"
            f"<td>{', '.join(r['missing_criteria']) or 'None'}</td></tr>"
            for r in results
        )
        limits_html = "".join(
            f"<li><strong>{r['name']}:</strong> {' '.join(r['limits'])}</li>"
            for r in results[:3]
        )
        doc_html = f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>TERRA-X Scientific Report — {aoi['name']}</title>
<style>body{{font-family:Arial,sans-serif;color:#111;max-width:850px;margin:24px auto;line-height:1.5}}
table{{border-collapse:collapse;width:100%;margin:16px 0}}th,td{{border:1px solid #cbd5e1;padding:8px;text-align:left}}
th{{background:#0f172a;color:#fff}}.note{{background:#f8fafc;border-left:4px solid #0ea5e9;padding:10px;margin:12px 0}}</style></head>
<body>
<h1>TERRA-X — Scientific Analog Analysis Report</h1>
<p><strong>Planetary Target:</strong> {aoi['body'].upper()} — {aoi['name']} ({aoi['target_crs']})</p>
<p><strong>Mission Scenario:</strong> {mission['name_en']} ({mission['focus']})</p>
<div class="note">{analysis_result['scientific_note']}</div>
<h2>1. Ranked Candidate Earth Analogs</h2>
<table><thead><tr><th>Rank</th><th>Candidate Site</th><th>Similarity</th><th>Mission Aptitude</th><th>Confidence</th><th>Missing Data</th></tr></thead>
<tbody>{rows_html}</tbody></table>
<h2>2. Sensitivity & Robustness</h2>
<p>Ranking Stability Score (±15% weight perturbation): <strong>{round(analysis_result['sensitivity']['stability_score']*100)}%</strong>
({analysis_result['sensitivity']['rank_flip_count']} top-rank change(s) across {analysis_result['sensitivity']['total_perturbations']} tests).</p>
<h2>3. Key Scientific Limitations</h2>
<ul>{limits_html}</ul>
<h2>4. Bibliography & Provenance</h2>
<ul>
<li>NASA PDS Geosciences Node — MOLA, CTX, HiRISE, CRISM, LOLA, LROC (https://pds.nasa.gov/)</li>
<li>Oberlin, E. A., Claire, M. W., &amp; Kounaves, S. P. (2018). Evaluation of the Tindouf Basin as a Mars Analog for Soluble Salt Geochemistry. <em>Astrobiology</em>, 18(10), 1275–1288. DOI: 10.1089/ast.2016.1557</li>
<li>Navarro-González, R. et al. (2003). Science, 302(5647). DOI: 10.1126/science.1089143</li>
</ul></body></html>"""
        return {
            "format": "doc",
            "filename": f"terra_x_{aoi['id']}_report.doc",
            "mime": "application/msword",
            "content": doc_html,
        }

    return {
        "format": "json",
        "filename": f"terra_x_{aoi['id']}_report.json",
        "mime": "application/json",
        "content": {
            "analysis": analysis_result,
            "datasets": [d for d in catalog["datasets"] if d["id"] in aoi.get("datasets", []) or d["body"] == "earth"],
            "copilot_notes": copilot_history or [],
        },
    }
