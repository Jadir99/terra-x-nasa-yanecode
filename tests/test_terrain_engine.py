"""Unit tests verifying terrain_engine against TXEngine reference standards."""

import math
from engine.terrain_engine import (
    analyze_terrain,
    extract_subgrid_matrix,
    load_catalog_grids,
    stats,
)


def make_grid(gid: str, fn, width: int = 5, height: int = 5):
    return {
        "id": gid,
        "name": gid,
        "width": width,
        "height": height,
        "bbox": [-5.0, -5.0, 5.0, 5.0],
        "dx": 100.0,
        "dy": 100.0,
        "values": [fn(i % width, i // width) for i in range(width * height)],
    }


def test_engine_reference_compliance():
    flat = make_grid("flat", lambda x, y: 0.0)
    inclined = make_grid("ramp", lambda x, y: float(x * 10))
    empty = make_grid("missing", lambda x, y: None)

    res = analyze_terrain(inclined, [flat, inclined, empty])
    assert res["results"][0]["id"] == "ramp"
    assert res["results"][0]["similarity"] == 100.0
    assert res["results"][0]["confidence"] == 100.0
    assert res["results"][0]["aptitude"] == 100.0

    res_inst = analyze_terrain(inclined, [inclined], profile="installation")
    assert res_inst["results"][0]["aptitude"] == 0.0

    assert res["results"][2]["rank"] is None
    assert res["results"][2]["aptitude"] is None
    assert res["results"][2]["confidence"] == 0.0
    assert res["stability"]["topWins"] == 3

    expected_slope = math.atan(0.1) * 180.0 / math.pi
    assert abs(res["target"]["slope"] - expected_slope) < 1e-7

    s_box = stats(inclined, [0, 0, 0.6, 1])
    assert s_box["bbox"] == [-5.0, -5.0, 1.0, 5.0]

    s_empty = stats(empty)
    assert s_empty["relief"] is None

    # Repeatability
    r1 = analyze_terrain(flat, [inclined])
    r2 = analyze_terrain(flat, [inclined])
    assert r1 == r2
    print("Terrain engine passed all mathematical reference tests!")


def test_real_grids_loading_and_slicing():
    grids = load_catalog_grids()
    assert len(grids) == 6
    grid_map = {g["id"]: g for g in grids}

    jezero = grid_map["jezero"]
    draa = grid_map["draa"]
    iriqui = grid_map["iriqui"]
    atacama = grid_map["atacama"]

    # Test full Jezero vs earth candidates on navigation profile
    analysis_full = analyze_terrain(jezero, [draa, iriqui, atacama], box=[0, 0, 1, 1], profile="navigation", weight=60)
    assert len(analysis_full["results"]) == 3
    # On full Jezero with navigation 60%, Drâa is top candidate (~92-93)
    top_cand = analysis_full["results"][0]
    assert top_cand["id"] == "draa"
    assert top_cand["similarity"] > 90.0
    assert top_cand["stable"] is True

    # Test east-half Jezero crop [0.5, 0, 1, 1]
    analysis_east = analyze_terrain(jezero, [draa, iriqui, atacama], box=[0.5, 0, 1, 1], profile="navigation", weight=60)
    # The bounding box must adjust
    assert analysis_east["bbox"][0] > analysis_full["bbox"][0]
    # Sliced matrix must have expected sub-dimensions
    submat = extract_subgrid_matrix(jezero, box=[0.5, 0, 1, 1])
    assert len(submat) == 33
    assert len(submat[0]) == 17  # 33 - floor(0.5 * 33) = 33 - 16 = 17
    print(f"Jezero Full: Top={top_cand['id']} ({top_cand['similarity']}%), bbox={analysis_full['bbox']}")
    print(f"Jezero East Half: Top={analysis_east['results'][0]['id']} ({analysis_east['results'][0]['similarity']}%), bbox={analysis_east['bbox']}")


if __name__ == "__main__":
    test_engine_reference_compliance()
    test_real_grids_loading_and_slicing()
