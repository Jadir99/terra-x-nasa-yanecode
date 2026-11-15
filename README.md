# TERRA-X — Planetary Intelligence & Earth Analogs Discovery (POC)

Proof of Concept for **NASA Space Apps Challenge 2026** (*"Identify Earth Locations that Analog the Permanent Moon Base Locations and Mars"*), built with simple zero-build technologies (**Python 3.12 stdlib HTTP/REST server + HTML5/CSS3/Vanilla JS + Leaflet + Plotly**).

## Quick Start

```bash
python server.py
```

Open **http://127.0.0.1:8088** in your browser (or set `PORT=8090 python server.py`).

## Run Automated Tests

```bash
python -m unittest discover -s tests -v
```

## Integrated Modules (8/8)

1. **Planetary Explorer**: Mars (Jezero Crater, Oxia Planum, Gale Crater) & Moon (Shackleton Crater Rim, Mare Tranquillitatis) + custom AOI polygon draw.
2. **Earth Analogs Discovery**: Global, Regional (Morocco / North Africa), and Benchmark Triad modes.
3. **Geospatial Layers & Guardrails**: Altimetry, Slope/Roughness, Temperature, Aridity (automatically excluded for airless Lunar targets), Mineralogy, Geochemistry.
4. **Similarity Engine**: Transparent $S_j = \sum w_i \cdot s_{ij}$ separating **Similarity**, **Mission Aptitude**, and **Confidence** with explicit missing-data handling.
5. **3D Terrain Digital Twin**: Side-by-side 3D DEM relief surfaces and cross-section elevation profiles.
6. **Scientific AI Copilot**: Grounded Q&A citing live computed scores, DOIs, NASA PDS provenance, and explicit scientific limits.
7. **Mission Scenario Simulator**: Soil Geochemistry (A), Rover Mobility (B), Cold/Arid (C), Astrobiology (D) + interactive What-If weight sliders & $\pm 15\%$ rank-stability testing.
8. **Report Generator**: Printable **PDF**, **Word (`.doc`)**, **CSV**, and **GeoJSON** exports.

## Scientific & Data References

- NASA Space Apps 2026: https://spaceappschallenge.org/2026/challenges/permanent-moon-base-locations-and-mars/
- NASA PDS & PDS API: https://pds.nasa.gov/ | https://nasa-pds.github.io/pds-api/overview.html
- NASA Earthdata: https://earthdata.nasa.gov/
- Moon Trek: https://trek.nasa.gov/moon/
- Oberlin, Claire & Kounaves (2018), *Astrobiology*: https://doi.org/10.1089/ast.2016.1557
- Navarro-González et al. (2003), *Science*: https://doi.org/10.1126/science.1089143
