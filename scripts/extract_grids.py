import json
import re
from pathlib import Path

data_js = Path("static/atlas/data.js")
text = data_js.read_text(encoding="utf-8")
m = re.search(r"window\.TERRA_GRIDS\s*=\s*(\[.*\]);?\s*$", text, re.DOTALL)
if m:
    data = json.loads(m.group(1))
    out_path = Path("data/terrain_grids.json")
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Successfully extracted {len(data)} grids to {out_path}:")
    for g in data:
        print(f"  - {g['id']}: {g['name']} ({g['body']}) - {len(g['values'])} cells (min: {min([v for v in g['values'] if v is not None])}m, max: {max([v for v in g['values'] if v is not None])}m)")
else:
    print("Error: Could not find window.TERRA_GRIDS in static/atlas/data.js")
