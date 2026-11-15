"""
Terra-X terrain comparisons and morphometric calculations in Python.
Matches TXEngine (dist/engine.js) with 100% mathematical fidelity.
Elevation units: metres; dx, dy: horizontal metres.
"""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

FULL_BOX = [0.0, 0.0, 1.0, 1.0]
PROFILES = {"navigation": 15.0, "installation": 5.0}
METHOD_DESC = (
    "Similarité = somme pondérée de deux proximités. "
    "Pente : écart de pente médiane ramené à 15°. "
    "Relief : écart de relief P90−P10 divisé par le plus grand relief des deux zones, avec un plancher de 50 m. "
    "Chaque proximité est bornée entre 0 et 100."
)
LIMITATIONS = [
    "Les seuils de pente et les poids sont des hypothèses de démonstration. L'aptitude décrit uniquement la fraction de terrain sous le seuil retenu.",
    "La confiance est un indice de couverture et de comparabilité du pas des grilles. Elle ne quantifie pas l'incertitude instrumentale.",
    "La pente est estimée à l'échelle du pas d'échantillonnage. Rochers, portance, météo, éclairement, gravité et radiation ne sont pas modélisés.",
    "Le rectangle délimite la cible. Chaque candidat terrestre est évalué sur son emprise entière. Des emprises différentes peuvent modifier le relief interquantile.",
    "Les altitudes utilisent les références verticales de chaque corps ; la comparaison porte sur les variations locales. Un même pas de grille ne garantit pas une résolution native identique.",
]


def clamp(n: float, min_val: float, max_val: float) -> float:
    return max(min_val, min(max_val, n))


def quantile(sorted_list: list[float], fraction: float) -> float | None:
    if not sorted_list:
        return None
    index = (len(sorted_list) - 1) * fraction
    lower = int(math.floor(index))
    upper = int(math.ceil(index))
    if lower == upper:
        return sorted_list[lower]
    return sorted_list[lower] + (index - lower) * (sorted_list[upper] - sorted_list[lower])


def indices(grid: dict[str, Any], box: list[float] | tuple[float, ...]) -> tuple[int, int, int, int]:
    width = grid.get("width")
    height = grid.get("height")
    values = grid.get("values")
    dx = grid.get("dx", 0)
    dy = grid.get("dy", 0)
    bbox = grid.get("bbox")

    if (
        not isinstance(width, int)
        or not isinstance(height, int)
        or width < 1
        or height < 1
        or not values
        or len(values) != width * height
        or not (dx > 0 and dy > 0)
        or not bbox
        or len(bbox) != 4
    ):
        raise ValueError("Grille de relief invalide.")

    if not isinstance(box, (list, tuple)) or len(box) != 4 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in box):
        raise ValueError("La zone attend quatre coordonnées normalisées.")

    l, t, r, b = [clamp(float(v), 0.0, 1.0) for v in box]
    if r <= l or b <= t:
        raise ValueError("La zone sélectionnée est vide.")

    return (
        int(math.floor(l * width)),
        int(math.floor(t * height)),
        int(math.ceil(r * width)),
        int(math.ceil(b * height)),
    )


def stats(grid: dict[str, Any], box: list[float] | tuple[float, ...] = FULL_BOX) -> dict[str, Any]:
    left, top, right, bottom = indices(grid, box)
    west, south, east, north = grid["bbox"]
    width = grid["width"]
    height = grid["height"]
    dx = grid["dx"]
    dy = grid["dy"]
    values = grid["values"]

    def lon(x: float) -> float:
        return west + (east - west) * x / width

    def lat(y: float) -> float:
        return north - (north - south) * y / height

    def at(x: int, y: int) -> float | None:
        return values[y * width + x]

    elevations: list[float] = []
    slopes: list[float] = []
    profile: list[dict[str, Any]] = []

    mid_row = (top + bottom - 1) // 2

    for y in range(top, bottom):
        for x in range(left, right):
            z = at(x, y)
            if y == mid_row:
                profile.append({
                    "distance": (x - left) * dx,
                    "elevation": z if z is not None and math.isfinite(z) else None,
                })
            if z is None or not math.isfinite(z):
                continue
            elevations.append(z)
            if x == left or x == right - 1 or y == top or y == bottom - 1:
                continue
            neighbors = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)]
            if not all(n is not None and math.isfinite(n) for n in neighbors):
                continue
            dzdx = (neighbors[1] - neighbors[0]) / (2 * dx)
            dzdy = (neighbors[3] - neighbors[2]) / (2 * dy)
            slopes.append(math.atan(math.hypot(dzdx, dzdy)) * 180.0 / math.pi)

    elevations.sort()
    slopes.sort()

    valid = len(elevations)
    total = (right - left) * (bottom - top)
    interior = max(0, right - left - 2) * max(0, bottom - top - 2)

    slope_p50 = quantile(slopes, 0.5)
    elev_p90 = quantile(elevations, 0.9)
    elev_p10 = quantile(elevations, 0.1)
    relief = (elev_p90 - elev_p10) if valid and elev_p90 is not None and elev_p10 is not None else None
    median_elev = quantile(elevations, 0.5)

    coverage = 100.0 * valid / total if total > 0 else 0.0
    slope_coverage = 100.0 * len(slopes) / interior if interior > 0 else 0.0

    nav_thresh = PROFILES["navigation"]
    inst_thresh = PROFILES["installation"]

    gentle_nav = (
        100.0 * sum(1 for s in slopes if s <= nav_thresh) / len(slopes)
        if slopes
        else None
    )
    gentle_inst = (
        100.0 * sum(1 for s in slopes if s <= inst_thresh) / len(slopes)
        if slopes
        else None
    )

    return {
        "slope": slope_p50,
        "relief": relief,
        "median": median_elev,
        "valid": valid,
        "total": total,
        "coverage": round(coverage, 2),
        "slopeCount": len(slopes),
        "slopeCoverage": round(slope_coverage, 2),
        "gentleNavigation": round(gentle_nav, 2) if gentle_nav is not None else None,
        "gentleInstallation": round(gentle_inst, 2) if gentle_inst is not None else None,
        "profile": profile,
        "bbox": [lon(left), lat(bottom), lon(right), lat(top)],
        "indices": [left, top, right, bottom],
        "subgrid_shape": [bottom - top, right - left],
    }


def extract_subgrid_matrix(grid: dict[str, Any], box: list[float] | tuple[float, ...] = FULL_BOX) -> list[list[float | None]]:
    """Extract a 2D matrix of elevation values for the given bounding box."""
    left, top, right, bottom = indices(grid, box)
    width = grid["width"]
    values = grid["values"]
    matrix: list[list[float | None]] = []
    for y in range(top, bottom):
        row: list[float | None] = []
        for x in range(left, right):
            z = values[y * width + x]
            row.append(round(z, 2) if z is not None and math.isfinite(z) else None)
        matrix.append(row)
    return matrix


def combine_score(row: dict[str, Any], w: float) -> float | None:
    if (w > 0 and row.get("slopeScore") is None) or (w < 100 and row.get("reliefScore") is None):
        return None
    slope_s = row.get("slopeScore") or 0.0
    relief_s = row.get("reliefScore") or 0.0
    return (slope_s * w + relief_s * (100.0 - w)) / 100.0


def rank_rows(rows: list[dict[str, Any]], w: float) -> list[dict[str, Any]]:
    annotated = []
    for r in rows:
        sim = combine_score(r, w)
        entry = dict(r)
        entry["similarity"] = round(sim, 2) if sim is not None else None
        annotated.append(entry)

    # Sort descending by similarity, tie-break by ID
    annotated.sort(
        key=lambda item: (
            item["similarity"] if item["similarity"] is not None else -1e9,
            -ord(str(item["id"])[0]) if item.get("id") else 0,
        ),
        reverse=True,
    )

    previous = None
    previous_rank = None
    ranked = []
    for i, row in enumerate(annotated):
        sim = row["similarity"]
        if sim is None:
            ranked_row = dict(row)
            ranked_row["rank"] = None
            ranked.append(ranked_row)
            continue
        if previous is None or abs(previous - sim) > 1e-9:
            previous_rank = i + 1
        previous = sim
        ranked_row = dict(row)
        ranked_row["rank"] = previous_rank
        ranked.append(ranked_row)

    return ranked


def analyze_terrain(
    target: dict[str, Any],
    candidates: list[dict[str, Any]],
    box: list[float] | tuple[float, ...] = FULL_BOX,
    profile: str = "navigation",
    weight: float = 60.0,
) -> dict[str, Any]:
    if profile not in PROFILES:
        raise ValueError(f"Profil invalide. Profils supportés: {list(PROFILES.keys())}")
    if not (isinstance(weight, (int, float)) and 0.0 <= weight <= 100.0):
        raise ValueError("Pondération invalide (doit être comprise entre 0 et 100).")

    ref_stats = stats(target, box)
    rows: list[dict[str, Any]] = []

    for grid in candidates:
        s = stats(grid)
        slope_score = (
            100.0 * clamp(1.0 - abs(ref_stats["slope"] - s["slope"]) / 15.0, 0.0, 1.0)
            if ref_stats["slope"] is not None and s["slope"] is not None
            else None
        )
        relief_denom = max(50.0, ref_stats["relief"] or 0.0, s["relief"] or 0.0)
        relief_score = (
            100.0 * (1.0 - abs((ref_stats["relief"] or 0.0) - (s["relief"] or 0.0)) / relief_denom)
            if ref_stats["relief"] is not None and s["relief"] is not None
            else None
        )

        step_ratio = (
            (min(target["dx"], grid["dx"]) / max(target["dx"], grid["dx"]))
            * (min(target["dy"], grid["dy"]) / max(target["dy"], grid["dy"]))
        )
        coverage = min(ref_stats["coverage"], s["coverage"])
        slope_coverage = min(ref_stats["slopeCoverage"], s["slopeCoverage"])

        aptitude = s["gentleNavigation"] if profile == "navigation" else s["gentleInstallation"]
        confidence = (
            math.sqrt(step_ratio) * (coverage * (100.0 - weight) + slope_coverage * weight) / 100.0
        )

        rows.append({
            "id": grid["id"],
            "name": grid["name"],
            "body": grid.get("body", "Terre"),
            "source": grid.get("source", ""),
            "datum": grid.get("datum", ""),
            "slopeScore": round(slope_score, 2) if slope_score is not None else None,
            "reliefScore": round(relief_score, 2) if relief_score is not None else None,
            "stats": s,
            "aptitude": round(aptitude, 2) if aptitude is not None else None,
            "confidence": round(confidence, 2),
        })

    ranked = rank_rows(rows, weight)
    trials = sorted(list({clamp(weight - 15.0, 0.0, 100.0), float(weight), clamp(weight + 15.0, 0.0, 100.0)}))
    trial_ranks = [rank_rows(rows, w) for w in trials]

    results = []
    for row in ranked:
        r_id = row["id"]
        r_rank = row["rank"]
        stable = (
            r_rank is not None
            and all(
                any(c["id"] == r_id and c["rank"] == r_rank for c in trial_set)
                for trial_set in trial_ranks
            )
        )
        r_copy = dict(row)
        r_copy["stable"] = stable
        results.append(r_copy)

    top_winner = results[0]["id"] if results and results[0].get("rank") == 1 else None
    top_wins = (
        sum(1 for t_rank in trial_ranks if t_rank and t_rank[0].get("id") == top_winner and t_rank[0].get("rank") == 1)
        if top_winner
        else 0
    )

    return {
        "target": ref_stats,
        "results": results,
        "box": list(box),
        "bbox": ref_stats["bbox"],
        "profile": profile,
        "weight": weight,
        "threshold": PROFILES[profile],
        "stability": {
            "trials": len(trials),
            "topWins": top_wins,
            "weights": trials,
            "is_rock_solid": top_wins == len(trials),
        },
        "method": METHOD_DESC,
        "limitations": LIMITATIONS,
    }


def load_catalog_grids(filepath: str | Path = "data/terrain_grids.json") -> list[dict[str, Any]]:
    p = Path(filepath)
    if not p.is_file():
        p = Path(__file__).resolve().parent.parent / "data" / "terrain_grids.json"
    with open(p, "r", encoding="utf-8") as f:
        return json.load(f)
