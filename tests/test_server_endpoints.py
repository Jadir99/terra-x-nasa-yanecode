"""Test server endpoints with the new real DEMs and terrain engine."""

import json
from server import TerraXHandler, CATALOG, TERRAIN_GRIDS_MAP
from io import BytesIO


class DummyRequest:
    def __init__(self, body_bytes: bytes = b""):
        self._body = body_bytes

    def makefile(self, *args, **kwargs):
        return BytesIO(self._body)

    def sendall(self, data):
        pass


def test_real_terrain_compare():
    import urllib.request
    from http.server import HTTPServer
    import threading

    server = HTTPServer(("127.0.0.1", 0), TerraXHandler)
    port = server.server_port
    t = threading.Thread(target=server.serve_forever, daemon=True)
    t.start()

    base = f"http://127.0.0.1:{port}"

    # 1. Test /atlas route
    req = urllib.request.urlopen(f"{base}/atlas/index.html")
    assert req.status == 200
    html = req.read().decode("utf-8")
    assert "Terra-X" in html
    assert "data.js" in html
    print("[PASS] GET /atlas/index.html served correctly")

    # 2. Test /api/terrain/compare (Full Jezero vs Drâa)
    payload = json.dumps({"aoi_id": "jezero_crater", "site_id": "iriqui_draa", "box": [0, 0, 1, 1]}).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/terrain/compare", data=payload, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    data = json.loads(resp.read().decode("utf-8"))
    assert data["aoi"]["terrain"]["is_real_measurement"] is True
    assert "MOLA" in data["aoi"]["terrain"]["badge"]
    assert data["earth"]["terrain"]["is_real_measurement"] is True
    assert "Copernicus" in data["earth"]["terrain"]["badge"]
    assert len(data["aoi"]["terrain"]["z"]) == 33
    assert len(data["aoi"]["terrain"]["z"][0]) == 33
    print(f"[PASS] /api/terrain/compare: Jezero ({data['aoi']['terrain']['relief_m']}m relief) vs Draa ({data['earth']['terrain']['relief_m']}m relief)")

    # 3. Test /api/terrain/analyze
    payload = json.dumps({
        "target": "jezero",
        "candidates": ["draa", "iriqui", "atacama"],
        "box": [0, 0, 1, 1],
        "profile": "navigation",
        "weight": 60
    }).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/terrain/analyze", data=payload, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    analysis = json.loads(resp.read().decode("utf-8"))
    top = analysis["results"][0]
    assert top["id"] == "draa"
    assert top["similarity"] > 90.0
    print(f"[PASS] /api/terrain/analyze: Top candidate = {top['name']} ({top['similarity']}/100)")

    # 4. Test /api/regions/planetary with box slice (East Half)
    payload = json.dumps({"aoi_id": "jezero_crater", "box": [0.5, 0, 1, 1]}).encode("utf-8")
    req = urllib.request.Request(f"{base}/api/regions/planetary", data=payload, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req)
    reg_data = json.loads(resp.read().decode("utf-8"))
    assert "bbox" in reg_data["region"]
    print(f"[PASS] /api/regions/planetary (East Half): bbox={reg_data['region']['bbox']}, slope={reg_data['region']['features']['slope_roughness']['value']}°")

    server.shutdown()
    print("ALL SERVER TESTS PASSED!")


if __name__ == "__main__":
    test_real_terrain_compare()
