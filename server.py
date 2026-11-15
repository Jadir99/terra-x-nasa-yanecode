"""Lightweight zero-dependency HTTP & REST API server for the TERRA-X POC."""

from __future__ import annotations

import json
import mimetypes
import os
import sys
import uuid
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

from engine.similarity import (
    build_report_payload,
    discover_sites,
    generate_terrain_grid,
    load_catalog,
    query_copilot,
    run_analysis,
)
from engine.terrain_engine import (
    analyze_terrain,
    extract_subgrid_matrix,
    load_catalog_grids,
    stats as terrain_stats,
)

BASE_DIR = Path(__file__).resolve().parent
STATIC_DIR = BASE_DIR / "static"
CATALOG_PATH = BASE_DIR / "data" / "scientific_catalog.json"
TERRAIN_GRIDS_PATH = BASE_DIR / "data" / "terrain_grids.json"

CATALOG: dict[str, Any] = load_catalog(str(CATALOG_PATH))
TERRAIN_GRIDS_LIST: list[dict[str, Any]] = load_catalog_grids(TERRAIN_GRIDS_PATH)
TERRAIN_GRIDS_MAP: dict[str, dict[str, Any]] = {g["id"]: g for g in TERRAIN_GRIDS_LIST}
JOBS_STORE: dict[str, dict[str, Any]] = {}
CUSTOM_AOIS: dict[str, dict[str, Any]] = {}

PLANETARY_GRID_MAP = {
    "jezero_crater": "jezero",
    "mare_tranquillitatis": "tranquillite",
    "shackleton_rim": "nobile",
    "oxia_planum": "jezero",
    "gale_crater": "jezero",
}

EARTH_GRID_MAP = {
    "iriqui_draa": "iriqui",
    "draa_valley": "draa",
    "draa_fan": "draa",
    "iriqui_playa": "iriqui",
    "atacama_yungay": "atacama",
    "tindouf_sebkha": "iriqui",
}


def _json_bytes(payload: Any) -> bytes:
    return json.dumps(payload, ensure_ascii=False).encode("utf-8")


class TerraXHandler(BaseHTTPRequestHandler):
    """HTTP handler serving static assets and TERRA-X scientific API endpoints."""

    server_version = "TerraX-POC/1.0"

    def log_message(self, fmt: str, *args: Any) -> None:
        """Keep console logging concise."""
        sys.stderr.write(f"[TERRA-X] {self.address_string()} - {fmt % args}\n")

    def _send_json(self, payload: Any, status: int = HTTPStatus.OK) -> None:
        data = _json_bytes(payload)
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def _read_json_body(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _serve_static(self, rel_path: str, is_head: bool = False) -> None:
        clean_rel = rel_path.lstrip("/") or "index.html"
        target = (STATIC_DIR / clean_rel).resolve()
        if target.is_dir():
            target = target / "index.html"
        if not str(target).startswith(str(STATIC_DIR.resolve())) or not target.is_file():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        mime, _ = mimetypes.guess_type(str(target))
        mime = mime or "application/octet-stream"
        content_type = (
            f"{mime}; charset=utf-8"
            if mime.startswith("text/") or mime in ("application/javascript", "application/json")
            else mime
        )

        file_size = target.stat().st_size
        range_header = self.headers.get("Range")

        if range_header and range_header.startswith("bytes="):
            try:
                ranges = range_header[6:].split("-")
                start = int(ranges[0]) if ranges[0] else 0
                end = int(ranges[1]) if ranges[1] else file_size - 1
                if start >= file_size or end >= file_size or start > end:
                    self.send_response(HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    self.send_header("Content-Range", f"bytes */{file_size}")
                    self.end_headers()
                    return

                length = end - start + 1
                self.send_response(HTTPStatus.PARTIAL_CONTENT)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Range", f"bytes {start}-{end}/{file_size}")
                self.send_header("Content-Length", str(length))
                self.send_header("Accept-Ranges", "bytes")
                self.send_header("Cache-Control", "public, max-age=3600")
                self.end_headers()

                if not is_head:
                    with open(target, "rb") as f:
                        f.seek(start)
                        self.wfile.write(f.read(length))
                return
            except Exception:
                pass

        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(file_size))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Cache-Control", "public, max-age=3600")
        self.end_headers()

        if not is_head:
            with open(target, "rb") as f:
                self.wfile.write(f.read())

    def do_HEAD(self) -> None:
        self.do_GET(is_head=True)

    def do_GET(self, is_head: bool = False) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/health":
            self._send_json({"status": "ok", "version": CATALOG["metadata"]["version"]})
            return

        if path == "/api/datasets":
            qs = parse_qs(parsed.query)
            body_filter = qs.get("body", [None])[0]
            datasets = CATALOG["datasets"]
            if body_filter:
                datasets = [d for d in datasets if d["body"] == body_filter]
            self._send_json({
                "datasets": datasets,
                "criteria": CATALOG["criteria"],
                "planetary_aois": CATALOG["planetary_aois"],
                "missions": CATALOG["missions"],
            })
            return

        if path.startswith("/api/jobs/"):
            job_id = path.split("/api/jobs/", 1)[1]
            job = JOBS_STORE.get(job_id)
            if not job:
                self._send_json({"error": "Job not found"}, status=HTTPStatus.NOT_FOUND)
                return
            self._send_json(job)
            return

        if path.startswith("/api/"):
            self._send_json({"error": "Endpoint not found"}, status=HTTPStatus.NOT_FOUND)
            return

        if path in ("/workbench", "/app"):
            self._serve_static("workbench.html", is_head=is_head)
            return

        if path in ("/login", "/signin", "/auth"):
            self._serve_static("login.html", is_head=is_head)
            return

        if path in ("/doc", "/docs"):
            self._serve_static("doc/index.html", is_head=is_head)
            return

        if path in ("/atlas", "/atlas/"):
            self._serve_static("atlas/index.html", is_head=is_head)
            return

        self._serve_static("index.html" if path == "/" else path, is_head=is_head)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        try:
            body = self._read_json_body()
        except Exception as exc:
            self._send_json({"error": f"Invalid JSON body: {exc}"}, status=HTTPStatus.BAD_REQUEST)
            return

        try:
            if path == "/api/regions/planetary":
                aoi_id = body.get("aoi_id", "jezero_crater")
                aois_map = {a["id"]: a for a in CATALOG["planetary_aois"]}
                if aoi_id not in aois_map:
                    self._send_json({"error": f"Unknown AOI {aoi_id}"}, status=HTTPStatus.BAD_REQUEST)
                    return
                region = dict(aois_map[aoi_id])
                region["features"] = dict(region["features"])
                region["features"]["slope_roughness"] = dict(region["features"]["slope_roughness"])
                region["features"]["altimetry"] = dict(region["features"]["altimetry"])

                box = body.get("box")
                if box and isinstance(box, list) and len(box) == 4:
                    region["box"] = box
                    grid_id = PLANETARY_GRID_MAP.get(aoi_id)
                    grid = TERRAIN_GRIDS_MAP.get(grid_id)
                    if grid:
                        st = terrain_stats(grid, box)
                        region["bbox"] = st["bbox"]
                        if st.get("slope") is not None:
                            region["features"]["slope_roughness"]["value"] = round(st["slope"], 2)
                        if st.get("relief") is not None:
                            region["features"]["altimetry"]["value"] = round(st["relief"], 1)
                        # Total 33x33 cells at 500m is 16.5 km x 16.5 km = 272.25 km2
                        region["area_km2"] = round((box[2] - box[0]) * (box[3] - box[1]) * 272.25, 1)

                if "custom_polygon" in body and body["custom_polygon"]:
                    region["polygon"] = body["custom_polygon"]
                if "area_km2" in body and body["area_km2"] and not box:
                    region["area_km2"] = float(body["area_km2"])
                CUSTOM_AOIS[aoi_id] = region
                self._send_json({"status": "selected", "region": region})
                return

            if path == "/api/discovery/jobs":
                mode = body.get("mode", "global")
                region_group = body.get("region_group")
                max_slope = body.get("max_slope_deg")
                min_aridity = body.get("min_aridity")
                sites = discover_sites(
                    CATALOG,
                    mode=mode,
                    region_group=region_group,
                    max_slope_deg=float(max_slope) if max_slope is not None else None,
                    min_aridity=float(min_aridity) if min_aridity is not None else None,
                )
                job_id = str(uuid.uuid4())[:8]
                job = {
                    "job_id": job_id,
                    "status": "completed",
                    "mode": mode,
                    "count": len(sites),
                    "sites": sites,
                }
                JOBS_STORE[job_id] = job
                self._send_json(job)
                return

            if path in ("/api/analyses", "/api/missions/simulate"):
                aoi_id = body.get("aoi_id", "jezero_crater")
                mission_id = body.get("mission_id", "soil_geochemistry")
                raw_weights = body.get("weights")
                discovery_mode = body.get("discovery_mode", "global")
                region_group = body.get("region_group")
                custom_override = CUSTOM_AOIS.get(aoi_id)
                result = run_analysis(
                    CATALOG,
                    aoi_id=aoi_id,
                    mission_id=mission_id,
                    raw_weights=raw_weights,
                    discovery_mode=discovery_mode,
                    region_group=region_group,
                    custom_aoi_override=custom_override,
                )
                self._send_json(result)
                return

            if path == "/api/terrain/analyze":
                target_id = body.get("target", "jezero")
                candidate_ids = body.get("candidates", ["draa", "iriqui", "atacama"])
                box = body.get("box", [0.0, 0.0, 1.0, 1.0])
                profile = body.get("profile", "navigation")
                weight = float(body.get("weight", 60.0))

                target = TERRAIN_GRIDS_MAP.get(target_id)
                candidates = [TERRAIN_GRIDS_MAP[cid] for cid in candidate_ids if cid in TERRAIN_GRIDS_MAP]
                if not target or not candidates:
                    self._send_json({"error": "Target or candidate grids not found"}, status=HTTPStatus.BAD_REQUEST)
                    return

                analysis = analyze_terrain(target, candidates, box=box, profile=profile, weight=weight)
                self._send_json(analysis)
                return

            if path == "/api/terrain/compare":
                aoi_id = body.get("aoi_id", "jezero_crater")
                site_id = body.get("site_id", "tindouf_sebkha")
                box = body.get("box", [0.0, 0.0, 1.0, 1.0])
                aoi = next((a for a in CATALOG["planetary_aois"] if a["id"] == aoi_id), None)
                site = next((s for s in CATALOG["earth_sites"] if s["id"] == site_id), None)
                if not aoi or not site:
                    self._send_json({"error": "Invalid aoi_id or site_id"}, status=HTTPStatus.BAD_REQUEST)
                    return

                target_grid = TERRAIN_GRIDS_MAP.get(PLANETARY_GRID_MAP.get(aoi_id))
                site_grid = TERRAIN_GRIDS_MAP.get(EARTH_GRID_MAP.get(site_id))

                if target_grid and site_grid:
                    aoi_stats = terrain_stats(target_grid, box)
                    site_stats = terrain_stats(site_grid, [0.0, 0.0, 1.0, 1.0])
                    aoi_matrix = extract_subgrid_matrix(target_grid, box)
                    site_matrix = extract_subgrid_matrix(site_grid, [0.0, 0.0, 1.0, 1.0])

                    aoi_terrain = {
                        "z": aoi_matrix,
                        "transect": [p["elevation"] for p in aoi_stats["profile"] if p["elevation"] is not None],
                        "relief_m": round(aoi_stats["relief"], 1) if aoi_stats["relief"] is not None else 200.0,
                        "slope_deg": round(aoi_stats["slope"], 2) if aoi_stats["slope"] is not None else 3.0,
                        "rms_step_m": round(target_grid.get("dx", 500) * 0.05, 1),
                        "is_real_measurement": True,
                        "badge": f"[Mesure Réelle · {target_grid.get('source', 'NASA PDS')}]",
                        "source": target_grid.get("source"),
                        "product": target_grid.get("product"),
                        "datum": target_grid.get("datum"),
                        "resolution": target_grid.get("nativeResolution"),
                        "bbox": aoi_stats["bbox"],
                        "coverage_pct": aoi_stats["coverage"],
                    }
                    site_terrain = {
                        "z": site_matrix,
                        "transect": [p["elevation"] for p in site_stats["profile"] if p["elevation"] is not None],
                        "relief_m": round(site_stats["relief"], 1) if site_stats["relief"] is not None else 250.0,
                        "slope_deg": round(site_stats["slope"], 2) if site_stats["slope"] is not None else 3.5,
                        "rms_step_m": round(site_grid.get("dx", 500) * 0.05, 1),
                        "is_real_measurement": True,
                        "badge": f"[Mesure Réelle · {site_grid.get('source', 'Copernicus DEM')}]",
                        "source": site_grid.get("source"),
                        "product": site_grid.get("product"),
                        "datum": site_grid.get("datum"),
                        "resolution": site_grid.get("nativeResolution"),
                        "bbox": site_stats["bbox"],
                        "coverage_pct": site_stats["coverage"],
                    }
                else:
                    aoi_terrain = generate_terrain_grid(
                        seed=aoi.get("terrain_seed", 1),
                        style=aoi.get("terrain_style", "delta_crater"),
                        relief_m=float(aoi["features"]["altimetry"]["value"]),
                        slope_deg=float(aoi["features"]["slope_roughness"]["value"]),
                    )
                    aoi_terrain["is_real_measurement"] = False
                    aoi_terrain["badge"] = "[Modélisation 3D / Synthèse]"

                    site_terrain = generate_terrain_grid(
                        seed=site.get("terrain_seed", 2),
                        style=site.get("terrain_style", "clay_plain"),
                        relief_m=float(site["features"]["altimetry"]["value"]),
                        slope_deg=float(site["features"]["slope_roughness"]["value"]),
                    )
                    site_terrain["is_real_measurement"] = False
                    site_terrain["badge"] = "[Modélisation 3D / Synthèse]"

                self._send_json({
                    "aoi": {"id": aoi["id"], "name": aoi["name"], "body": aoi["body"], "terrain": aoi_terrain},
                    "earth": {"id": site["id"], "name": site["name"], "country": site["country"], "terrain": site_terrain},
                })
                return

            if path == "/api/copilot/query":
                aoi_id = body.get("aoi_id", "jezero_crater")
                mission_id = body.get("mission_id", "soil_geochemistry")
                raw_weights = body.get("weights")
                discovery_mode = body.get("discovery_mode", "global")
                question = body.get("question", "Why Tindouf?")
                lang = body.get("lang", "en")

                analysis = run_analysis(
                    CATALOG,
                    aoi_id=aoi_id,
                    mission_id=mission_id,
                    raw_weights=raw_weights,
                    discovery_mode=discovery_mode,
                )
                response = query_copilot(CATALOG, analysis, question=question, lang=lang)
                self._send_json(response)
                return

            if path == "/api/reports":
                aoi_id = body.get("aoi_id", "jezero_crater")
                mission_id = body.get("mission_id", "soil_geochemistry")
                raw_weights = body.get("weights")
                discovery_mode = body.get("discovery_mode", "global")
                fmt = body.get("format", "json")
                copilot_history = body.get("copilot_history", [])

                analysis = run_analysis(
                    CATALOG,
                    aoi_id=aoi_id,
                    mission_id=mission_id,
                    raw_weights=raw_weights,
                    discovery_mode=discovery_mode,
                )
                report = build_report_payload(CATALOG, analysis, copilot_history=copilot_history, fmt=fmt)
                self._send_json(report)
                return

            self._send_json({"error": "Endpoint not found"}, status=HTTPStatus.NOT_FOUND)
        except ValueError as exc:
            self._send_json({"error": str(exc)}, status=HTTPStatus.BAD_REQUEST)
        except Exception as exc:
            self._send_json({"error": f"Internal server error: {exc}"}, status=HTTPStatus.INTERNAL_SERVER_ERROR)


def run_server(host: str = "127.0.0.1", port: int = 8088) -> None:
    """Start the TERRA-X ThreadingHTTPServer."""
    server = ThreadingHTTPServer((host, port), TerraXHandler)
    print(f"TERRA-X POC running at http://{host}:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down TERRA-X server.")
        server.server_close()


if __name__ == "__main__":
    port_env = int(os.environ.get("PORT", "8088"))
    run_server(port=port_env)
