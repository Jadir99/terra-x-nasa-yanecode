"""Unit and HTTP API integration tests for the TERRA-X POC."""

from __future__ import annotations

import json
import threading
import unittest
from http.server import ThreadingHTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

from engine.similarity import (
    build_report_payload,
    discover_sites,
    generate_terrain_grid,
    load_catalog,
    normalize_weights,
    query_copilot,
    run_analysis,
)
from server import TerraXHandler

CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "scientific_catalog.json"


class TestScientificEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.catalog = load_catalog(str(CATALOG_PATH))

    def test_weight_normalization(self) -> None:
        w = normalize_weights({"altimetry": 2, "geochemistry": 6, "mineralogy": 2})
        self.assertAlmostEqual(sum(w.values()), 1.0, places=5)
        self.assertAlmostEqual(w["geochemistry"], 0.6, places=5)

        zero_w = normalize_weights({"altimetry": 0})
        self.assertAlmostEqual(sum(zero_w.values()), 1.0, places=5)

    def test_moon_aridity_guardrail(self) -> None:
        res = run_analysis(self.catalog, aoi_id="shackleton_rim", mission_id="cold_arid")
        for site in res["results"]:
            self.assertIn("aridity", site["incompatible_criteria"])
            self.assertEqual(site["criterion_details"]["aridity"]["status"], "incompatible")

    def test_missing_value_reduces_confidence(self) -> None:
        res = run_analysis(self.catalog, aoi_id="jezero_crater", mission_id="soil_geochemistry")
        by_id = {r["site_id"]: r for r in res["results"]}
        tindouf = by_id["tindouf_sebkha"]
        iriqui = by_id["iriqui_draa"]
        self.assertIn("geochemistry", iriqui["missing_criteria"])
        self.assertEqual(tindouf["missing_criteria"], [])
        self.assertGreater(tindouf["confidence_score"], iriqui["confidence_score"])

    def test_mission_scenario_shifts_ranking(self) -> None:
        geochem = run_analysis(self.catalog, aoi_id="jezero_crater", mission_id="soil_geochemistry")
        cold = run_analysis(self.catalog, aoi_id="jezero_crater", mission_id="cold_arid")
        geochem_top = geochem["results"][0]["site_id"]
        cold_by_id = {r["site_id"]: r for r in cold["results"]}
        geochem_by_id = {r["site_id"]: r for r in geochem["results"]}

        self.assertIn(geochem_top, ("tindouf_sebkha", "atacama_yungay"))
        self.assertGreater(
            cold_by_id["mcmurdo_dry_valleys"]["similarity_score"],
            geochem_by_id["mcmurdo_dry_valleys"]["similarity_score"],
        )

    def test_regional_discovery_morocco(self) -> None:
        regional = discover_sites(self.catalog, mode="regional", region_group="north_africa")
        ids = {s["id"] for s in regional}
        self.assertIn("tindouf_sebkha", ids)
        self.assertIn("iriqui_draa", ids)
        self.assertNotIn("atacama_yungay", ids)

    def test_terrain_grid_matches_relief(self) -> None:
        grid = generate_terrain_grid(seed=42, style="delta_crater", relief_m=680.0, slope_deg=8.4)
        flat = [v for row in grid["z"] for v in row]
        self.assertAlmostEqual(max(flat) - min(flat), 680.0, places=1)
        self.assertEqual(len(grid["transect"]), grid["size"])

    def test_copilot_grounded_citations(self) -> None:
        analysis = run_analysis(self.catalog, aoi_id="jezero_crater", mission_id="soil_geochemistry")
        ans = query_copilot(self.catalog, analysis, "Why Tindouf?", lang="en")
        dois = [c["doi"] for c in ans["citations"]]
        self.assertIn("10.1089/ast.2016.1557", dois)
        self.assertTrue(len(ans["limits"]) > 0)

    def test_report_exports(self) -> None:
        analysis = run_analysis(self.catalog, aoi_id="jezero_crater", mission_id="soil_geochemistry")
        csv_rep = build_report_payload(self.catalog, analysis, fmt="csv")
        self.assertIn("tindouf_sebkha", csv_rep["content"])

        geo_rep = build_report_payload(self.catalog, analysis, fmt="geojson")
        gj = json.loads(geo_rep["content"])
        self.assertEqual(gj["type"], "FeatureCollection")
        self.assertEqual(len(gj["features"]), len(analysis["results"]))

        doc_rep = build_report_payload(self.catalog, analysis, fmt="doc")
        self.assertIn("TERRA-X", doc_rep["content"])


class TestServerAPI(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.httpd = ThreadingHTTPServer(("127.0.0.1", 0), TerraXHandler)
        cls.port = cls.httpd.server_address[1]
        cls.thread = threading.Thread(target=cls.httpd.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.httpd.shutdown()
        cls.httpd.server_close()

    def _get(self, path: str) -> tuple[int, bytes]:
        with urlopen(f"http://127.0.0.1:{self.port}{path}") as resp:
            return resp.status, resp.read()

    def _post(self, path: str, payload: dict) -> tuple[int, dict]:
        req = Request(
            f"http://127.0.0.1:{self.port}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urlopen(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))

    def test_api_endpoints(self) -> None:
        code, html = self._get("/")
        self.assertEqual(code, 200)
        self.assertIn(b"TERRA-X", html)

        code, raw_ds = self._get("/api/datasets")
        self.assertEqual(code, 200)
        ds = json.loads(raw_ds.decode("utf-8"))
        self.assertGreaterEqual(len(ds["planetary_aois"]), 5)

        code, job = self._post("/api/discovery/jobs", {"mode": "regional"})
        self.assertEqual(code, 200)
        self.assertEqual(job["status"], "completed")
        code, fetched_raw = self._get(f"/api/jobs/{job['job_id']}")
        self.assertEqual(code, 200)
        self.assertEqual(json.loads(fetched_raw.decode("utf-8"))["job_id"], job["job_id"])

        code, analysis = self._post("/api/analyses", {"aoi_id": "oxia_planum", "mission_id": "astrobiology"})
        self.assertEqual(code, 200)
        self.assertEqual(analysis["aoi"]["id"], "oxia_planum")

        code, terrain = self._post("/api/terrain/compare", {"aoi_id": "jezero_crater", "site_id": "tindouf_sebkha"})
        self.assertEqual(code, 200)
        self.assertIn("z", terrain["aoi"]["terrain"])

        code, copilot = self._post("/api/copilot/query", {"question": "Why Tindouf?"})
        self.assertEqual(code, 200)
        self.assertIn("Tindouf", copilot["answer"])

        code, rep = self._post("/api/reports", {"format": "csv"})
        self.assertEqual(code, 200)
        self.assertEqual(rep["format"], "csv")


if __name__ == "__main__":
    unittest.main()
