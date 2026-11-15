import json
from engine.similarity import load_scientific_catalog, run_full_analysis

catalog = load_scientific_catalog()
analysis = run_full_analysis(catalog, aoi_id="jezero_crater", mission_id="soil_geochemistry")
print("Analysis ID:", analysis.get("analysis_id"))
print("Timestamp:", analysis.get("timestamp"))
print("AOI:", analysis.get("aoi", {}).get("name"))
print("Results count:", len(analysis.get("results", [])))
for r in analysis.get("results", [])[:3]:
    print(f"Rank #{r['rank']} | ID: {r['site_id']} | Name: {r['name']} | Sim: {r['similarity_score']} | Apt: {r['mission_aptitude_score']} | Conf: {r['confidence_score']}")
    print("  Keys:", list(r.keys()))
