# TERRA-X — Master Resource & Technical Architecture Documentation
**Planetary Intelligence & Earth Analogs Discovery Platform**  
*NASA Space Apps Challenge 2026 Reference Documentation*

---

## 1. Executive Summary & Foundational Axiom

TERRA-X is an integrated scientific intelligence platform designed to discover, benchmark, and evaluate Earth analog locations for Lunar base camps (Artemis program) and Martian surface exploration.

### Foundational Scientific Axiom (Osinski et al., 2006; Oberlin et al., 2018)
> **"A terrestrial analog reproduces specific relevant physical, mineralogical, or geochemical properties, never Mars or the Moon in their entirety."**

Because Earth possesses a thick atmosphere, active hydrology, and pervasive biology, no single Earth site is 100% Mars or Moon. Therefore, TERRA-X rejects simplistic single-percentage matching scores in favor of a **rigorous 3-Pillar Decoupled Decision Framework**:
1. **Similarity ($S_j$)**: Physical, morphological, and geochemical resemblance.
2. **Mission Aptitude ($A_j$)**: Practical feasibility, logistics, trafficability, and safety.
3. **Scientific Confidence ($C_j$)**: Ground-truth data density, sensor resolution, and citation backing.

---

## 2. Peer-Reviewed Academic Literature & Scientific Benchmarks

The following peer-reviewed papers establish the scientific validity, geochemical benchmarks, and methodology of the platform:

### A. Geochemical & Soil Chemistry Analogs
* **Oberlin, E. A., Claire, M. W., & Kounaves, S. P. (2018)**. *Evaluation of the Tindouf Basin Region in Southern Morocco as an Analogue Site for Soil Geochemistry on Noachian Mars*. **Astrobiology**, 18(10), 1318–1328.  
  *DOI*: [10.1089/ast.2016.1557](https://doi.org/10.1089/ast.2016.1557)  
  *Key Finding*: Demonstrates that Tindouf evaporite salt crusts naturally produce and retain oxychlorines (perchlorates/chlorates), sulfates, and chlorides with ionic ratios ($\text{NO}_3^-/\text{Cl}^-$, $\text{SO}_4^{2-}/\text{Cl}^-$) matching Mars Phoenix Lander (WCL) and Curiosity (SAM) data.
* **Navarro-González, R., Rainey, F. A., McKay, C. P., et al. (2003)**. *Mars-Like Soils in the Atacama Desert, Chile, and the Dry Limit of Microbial Life*. **Science**, 302(5647), 1018–1021.  
  *DOI*: [10.1126/science.1089143](https://doi.org/10.1126/science.1089143)  
  *Key Finding*: Establishes the hyperarid Yungay core of the Atacama Desert as the gold standard for testing the detection limits of life and organic preservation under extreme UV desiccation.

### B. Terrestrial Analog Methodology & Fidelity Models
* **Osinski, G. R., Léveillé, R., Berinstain, A., Lebeuf, M., & Bamsey, M. (2006)**. *Terrestrial analogues to Mars and the Moon: Concepts, fidelity, and future exploration*. **Planetary and Space Science**, 54(11), 1045–1054.  
  *DOI*: [10.1016/j.pss.2006.05.010](https://doi.org/10.1016/j.pss.2006.05.010)  
  *Key Finding*: Formulates the classical definition of **Fidelity** ($F$): the degree to which an Earth site reproduces specific planetary environmental properties. Classifies analogs into *process*, *material*, and *environmental* analogs.
* **Martins, Z., et al. (2017)**. *Earth as a tool for astrobiology—A European roadmap for terrestrial analogues*. **Astrobiology**, 17(9), 807–849.  
  *DOI*: [10.1089/ast.2016.1585](https://doi.org/10.1089/ast.2016.1585)  
  *Key Finding*: Comprehensive European Space Agency (ESA) database of planetary analogs, fieldwork standards, and sample curation protocols.
* **Preston, L. J., & Dartnell, L. R. (2014)**. *Planetary habitability: Lessons learned from terrestrial analogues*. **International Journal of Astrobiology**, 13(1), 81–98.  
  *DOI*: [10.1017/S1473550413000388](https://doi.org/10.1017/S1473550413000388)  
  *Key Finding*: Systematic review connecting terrestrial extremophile habitats to specific Martian and Icy Moon target regions.

### C. Cryogenic & Cold Desert Analogs
* **Marchant, D. R., & Head, J. W. (2007)**. *Antarctic dry valleys: Microclimate zonation, variable vitrification, and hyperarid regolith development as analogs for cold, dry Mars*. **Icarus**, 192(1), 187–222.  
  *DOI*: [10.1016/j.icarus.2007.06.018](https://doi.org/10.1016/j.icarus.2007.06.018)  
  *Key Finding*: Permafrost stability, thermal contraction crack polygons, and microclimates of Beacon and University Valleys as analogs for Amazonian Mars.

### D. Lunar South Pole & Artemis Mission Targets
* **Lemelin, M., Lucey, P. G., et al. (2014)**. *Mineralogy and albedo of the Moon's South Pole-Aitken basin*. **Icarus**, 243, 8–16.  
  *Key Finding*: High-resolution mineral maps of Shackleton Rim and the South Pole-Aitken basin derived from Kaguya Spectral Profiler and Lunar Reconnaissance Orbiter (LRO).

---

## 3. Space Agency Open Datasets & REST/STAC APIs

Production applications must stream Analysis-Ready Data (ARD) via Cloud-Optimized GeoTIFFs (COGs) and open APIs rather than bundling static raster files.

### 1. USGS Astrogeology Planetary STAC API
* **STAC Endpoint**: `https://stac.astrogeology.usgs.gov/api`
* **STAC Browser**: `https://stac.astrogeology.usgs.gov/`
* **Format**: SpatioTemporal Asset Catalog (STAC) providing Cloud-Optimized GeoTIFFs (COGs) for Mars and the Moon.
* **Key Datasets**:
  * Mars Reconnaissance Orbiter (MRO) CTX Global Digital Elevation Models (20 m/px).
  * HiRISE High-Resolution DTMs (1–2 m/px) covering Jezero Crater, Gale Crater, and Oxia Planum.
  * Lunar Reconnaissance Orbiter (LRO) LOLA Global Altimetry (5–20 m/px).
* **Usage**: Stream windowed raster slices using `pystac-client` and `rasterio` without downloading entire multi-gigabyte files.

### 2. NASA Planetary Data System (PDS) Geosciences Node
* **Orbital Data Explorer (ODE) REST API**: `https://oderest.rsl.wustl.edu/service`
* **Official Docs**: [https://oderest.rsl.wustl.edu/](https://oderest.rsl.wustl.edu/)
* **Parameters**:
  * `target`: `mars` | `moon`
  * `mission`: `mro` | `lro` | `mgs`
  * `instrument`: `crism` (Spectrometer) | `lola` (Altimeter) | `ctx` | `hirise`
  * `ptype`: Product type (e.g., `trdr` for CRISM targeted hyperspectral cubes).
  * `west`, `east`, `south`, `north`: Spatial bounding box.
  * `results`: `json` | `xml` | `tabular`

### 3. NASA Solar System Treks WMTS Tile Service
* **Service URL Pattern**:
  ```text
  https://trek.nasa.gov/tiles/{body}/EQ/{layer}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg
  ```
* **Supported Bodies**: `Mars`, `Moon`, `Vesta`, `Ceres`, `Mercury`, `Titan`.
* **Standard Global Layers**:
  * Mars Color Hillshade (MOLA): `Mars_MGS_MOLA_ClrShade_merge_global_463m`
  * Mars MDIM 2.1 Color Mosaic (Viking/Valles): `Mars_Viking_MDIM21_ClrMosaic_global_232m`
  * Moon LOLA Elevation Color Shaded: `Moon_LRO_LOLA_ClrShade_Global_128ppd`
  * Moon LROC WAC Global Morphology: `Moon_LRO_LROC_WAC_Global_Morphology`
* **Integration**: Compatible directly with **Leaflet**, **MapLibre GL JS**, **OpenLayers**, and **CesiumJS**.

### 4. Copernicus Data Space Ecosystem (Earth Remote Sensing)
* **Portal**: `https://dataspace.copernicus.eu/`
* **STAC Endpoint**: `https://catalogue.dataspace.copernicus.eu/stac`
* **Key Collections**:
  * `SENTINEL-2`: Multi-Spectral Instrument (MSI) Level-2A (Bottom-of-Atmosphere surface reflectance, 10–20m).
  * `COP-DEM-GLO-30`: Copernicus Global Digital Elevation Model (30m worldwide).
* **Mineral Indices for Earth Analogs**:
  * **Clay Mineral Ratio (CMR)**: $\frac{\text{Band 11 (SWIR-1)}}{\text{Band 12 (SWIR-2)}}$
  * **Ferrous Minerals Index**: $\frac{\text{Band 11 (SWIR-1)}}{\text{Band 8A (NIR)}}$
  * **Normalized Difference Salinity Index (NDSI)**: $\frac{\text{Band 4 (Red)} - \text{Band 11 (SWIR-1)}}{\text{Band 4 (Red)} + \text{Band 11 (SWIR-1)}}$

### 5. NASA Earthdata CMR (Common Metadata Repository)
* **Endpoint**: `https://cmr.earthdata.nasa.gov/search/granules.json`
* **Access**: Free account at [URS Earthdata](https://urs.earthdata.nasa.gov/).
* **Key Products**:
  * ASTER Global Digital Elevation Model (ASTGTM v003, 30m).
  * Landsat 8/9 Operational Land Imager (OLI) Collection 2 Surface Reflectance.

---

## 4. Mathematical Modeling & Algorithmic Foundations

To maintain mathematical rigor, the platform separates candidate evaluation into three decoupled functions:

### Pillar 1: Similarity Score ($S_j$)
$$S_j = w_{\text{spec}} \cdot s_{\text{spectral}} + w_{\text{morph}} \cdot s_{\text{morph}} + w_{\text{env}} \cdot s_{\text{env}}$$
where $\sum w_i = 1.0$.

#### 1. Spectral Angle Mapper (SAM)
For planetary target reflectance spectrum $\mathbf{u} = (u_1, \dots, u_N)$ and analog spectrum $\mathbf{v} = (v_1, \dots, v_N)$:
$$\theta = \cos^{-1}\left( \frac{\mathbf{u} \cdot \mathbf{v}}{\|\mathbf{u}\|_2 \|\mathbf{v}\|_2} \right) = \cos^{-1}\left( \frac{\sum_{k=1}^N u_k v_k}{\sqrt{\sum_{k=1}^N u_k^2} \sqrt{\sum_{k=1}^N v_k^2}} \right)$$
$$s_{\text{spectral}} = 1.0 - \frac{\theta}{\pi/2} \quad \in [0, 1]$$
*SAM is mathematically invariant to scene illumination differences, topography shadowing, and solar zenith angles.*

#### 2. Morphological Topographic Distance
Using normalized elevation relief ($\Delta h$), mean slope ($\bar{\alpha}$), and RMS surface roughness ($\xi_{\text{RMS}}$):
$$d_{\text{morph}} = \sqrt{ \left( \frac{\Delta h_p - \Delta h_a}{\sigma_{\Delta h}} \right)^2 + \left( \frac{\bar{\alpha}_p - \bar{\alpha}_a}{\sigma_{\bar{\alpha}}} \right)^2 + \left( \frac{\xi_p - \xi_a}{\sigma_\xi} \right)^2 }$$
$$s_{\text{morph}} = \exp\left( - \frac{d_{\text{morph}}}{\gamma} \right)$$

### Pillar 2: Mission Aptitude Score ($A_j$)
Evaluates operational readiness and field campaign viability:
$$A_j = \left( T_{\text{trafficability}} \right)^{0.35} \cdot \left( L_{\text{logistics}} \right)^{0.25} \cdot \left( S_{\text{safety}} \right)^{0.20} \cdot \left( P_{\text{permits}} \right)^{0.20}$$
* **Trafficability**: Surface bearing capacity, boulder distribution, wheel-slip hazard.
* **Logistics**: Distance to nearest all-weather airstrip, hospital, and potable water.
* **Safety**: Ambient thermal envelope (operating window between $-20^\circ\text{C}$ and $+45^\circ\text{C}$).
* **Permits**: Legal jurisdiction, protected wilderness status, drone flight clearance.

### Pillar 3: Scientific Confidence Score ($C_j$)
Evaluates the empirical certainty and ground-truth validation:
$$C_j = \lambda_1 \cdot \text{CitationGroundingScore} + \lambda_2 \cdot \left(1.0 - \frac{\text{GSD}_{\text{sensor}}}{\text{GSD}_{\text{target}}}\right) - \sigma_{\text{uncertainty}}$$
* Ensures that missing variables or low-resolution proxy data downgrade the certainty rather than arbitrarily skewing similarity.

---

## 5. Technology Stack & Software Engineering Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js 14+)                         │
│  • MapLibre GL JS / Leaflet (Dual Synchronized 2D Canvases)           │
│  • CesiumJS / Three.js (3D Terrain Digital Twin from Dem)              │
│  • Tailwind CSS + shadcn/ui (NASA Clean Scientific Design System)      │
│  • TanStack Query / Zustand (Server State & Parameter Synchronization) │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ REST / WebSocket
┌────────────────────────────────────▼───────────────────────────────────┐
│                    API GATEWAY & BACKEND (FastAPI)                     │
│  • Async REST Endpoints (/discovery, /score, /terrain, /copilot)      │
│  • Celery Workers + Redis (Heavy Geospatial Raster Processing)        │
│  • Scientific Engine: GDAL, Rasterio, Xarray, Scipy, NumPy            │
└───────────────────┬─────────────────────────────────┬──────────────────┘
                    │                                 │
┌───────────────────▼──────────────┐   ┌──────────────▼──────────────────┐
│  GEOSPATIAL STORAGE (PostGIS)    │   │  AI COPILOT RAG (pgvector)      │
│  • planetary_regions (IAU CRS)   │   │  • Astrobiology Papers (PDFs)   │
│  • earth_analog_sites (EPSG:4326)│   │  • Text-Embedding-3-Large / Llama│
│  • Cloud-Optimized GeoTIFF (S3)  │   │  • Source Quotation & Citations │
└──────────────────────────────────┘   └─────────────────────────────────┘
```

### Python Scientific Libraries
* **`rasterio`**: Cloud-Optimized GeoTIFF reading using HTTP Range requests without loading entire files into memory.
* **`pyproj`**: Critical for projecting planetary coordinates between terrestrial WGS84 (`EPSG:4326`) and non-terrestrial bodies:
  * Mars: `IAU2000:49900` (Mars Sphere) / `IAU2000:49901` (Mars Spheroid)
  * Moon: `IAU2000:30100` (Moon Sphere)
* **`xarray`**: Multi-dimensional spatial arrays for hyperspectral data cubes (wavelength, lat, lon).
* **`scipy` / `scikit-learn`**: Numerical optimization, Principal Component Analysis (PCA), and Spectral Unmixing.
* **`geopandas` / `shapely`**: Vector geometries, Area of Interest (AOI) polygon intersection, and coordinate clipping.

---

## 6. Implementation Recipes & Code Examples

### Recipe 1: Querying the USGS Astrogeology Planetary STAC API (Python)
```python
from pystac_client import Client
import json

def query_planetary_data(target_body: str, bbox: list):
    """
    Query USGS Planetary STAC catalog for Cloud-Optimized GeoTIFFs (COGs).
    target_body: 'mars' or 'moon'
    bbox: [min_lon, min_lat, max_lon, max_lat]
    """
    stac_url = "https://stac.astrogeology.usgs.gov/api"
    client = Client.open(stac_url)

    # Search by planetary collection and bounding box
    search = client.search(
        collections=[f"{target_body}_ctx_dtm", f"{target_body}_mola_elevation"],
        bbox=bbox,
        limit=5
    )

    items = list(search.items())
    print(f"Discovered {len(items)} planetary scenes for {target_body}:")
    for item in items:
        # Asset URL pointing directly to Cloud-Optimized GeoTIFF
        cog_href = item.assets.get("data", {}).href
        print(f" - {item.id} | Resolution: {item.properties.get('gsd', 'N/A')}m | URL: {cog_href}")
    return items

# Example: Jezero Crater AOI Bounding Box
# query_planetary_data('mars', [77.2, 18.2, 77.8, 18.6])
```

### Recipe 2: Streaming a Cloud-Optimized GeoTIFF Window with `rasterio`
```python
import rasterio
from rasterio.windows import from_bounds
import numpy as np

def extract_dem_metrics(cog_url: str, min_x, min_y, max_x, max_y):
    """
    Streams only the targeted window of a multi-gigabyte COG over HTTP.
    Calculates elevation delta, slope, and surface roughness.
    """
    with rasterio.open(cog_url) as src:
        # Calculate window from bounding box coordinates
        window = from_bounds(min_x, min_y, max_x, max_y, src.transform)
        dem = src.read(1, window=window)

        # Mask invalid NoData pixels
        valid_dem = np.ma.masked_equal(dem, src.nodata)
        
        # Calculate elevation range
        elev_min = valid_dem.min()
        elev_max = valid_dem.max()
        relief = elev_max - elev_min

        # Calculate slope via gradient
        gy, gx = np.gradient(valid_dem, src.res[0], src.res[1])
        slope_rad = np.arctan(np.sqrt(gx**2 + gy**2))
        mean_slope_deg = np.degrees(slope_rad).mean()

        return {
            "elevation_min_m": float(elev_min),
            "elevation_max_m": float(elev_max),
            "relief_m": float(relief),
            "mean_slope_deg": float(mean_slope_deg)
        }
```

### Recipe 3: Integrating NASA Moon & Mars WMTS Tiles into Leaflet
```javascript
// Planetary Map Initialization with NASA Solar System Treks WMTS
function initPlanetaryMap(containerId, body) {
  const map = L.map(containerId, {
    center: [0, 0],
    zoom: 2,
    minZoom: 1,
    maxZoom: 8,
    crs: L.CRS.EPSG4326 // Equirectangular Projection
  });

  // Layer Identifier (e.g., Mars MOLA Color Shaded Relief)
  const layerName = body === 'mars' 
    ? 'Mars_MGS_MOLA_ClrShade_merge_global_463m'
    : 'Moon_LRO_LOLA_ClrShade_Global_128ppd';

  // OGC RESTful WMTS URL Template
  const wmtsUrl = `https://trek.nasa.gov/tiles/${body}/EQ/${layerName}/1.0.0/default/default028mm/{z}/{y}/{x}.jpg`;

  L.tileLayer(wmtsUrl, {
    attribution: 'NASA / JPL-Caltech / USGS Astrogeology',
    tileSize: 256,
    noWrap: true
  }).addTo(map);

  return map;
}
```

---

## 7. Curated Master Database of Verified Global Terrestrial Analogs

| Analog Site | Location | Target Body | Primary Analogy Features | Peer-Reviewed Benchmark Citation |
| :--- | :--- | :--- | :--- | :--- |
| **Tindouf Basin Sebkha** | Morocco / Algeria (`27.67°N, 8.14°W`) | Mars (Noachian) | Soluble salts (chlorides, sulfates, natural perchlorate retention), paleolake evaporites | Oberlin, Claire, & Kounaves (2018), *Astrobiology*, DOI: 10.1089/ast.2016.1557 |
| **Atacama Desert (Yungay)** | Chile (`24.04°S, 69.87°W`) | Mars (Hyperarid) | Extreme desiccation, UV radiation, dry limits of microbial survival, organic preservation | Navarro-González et al. (2003), *Science*, DOI: 10.1126/science.1089143 |
| **McMurdo Dry Valleys** | Antarctica (`77.85°S, 160.70°E`) | Mars (Amazonian Cryogenic) | Sub-zero hyperaridity, permafrost polygons, endolithic communities in sandstone | Marchant & Head (2007), *Icarus*, DOI: 10.1016/j.icarus.2007.06.018 |
| **Lanzarote Lava Tubes** | Canary Islands, Spain (`29.04°N, 13.58°W`) | Moon & Mars (Subsurface) | Basaltic lava tubes, subterranean planetary shelter analogs, planetary rover mobility | Martins et al. (2017), *Astrobiology* (ESA Pangea Program) |
| **Haughton Impact Structure** | Devon Island, High Arctic (`75.38°N, 89.67°W`) | Moon & Mars (Impact Geology) | Hydrothermal impact alteration, shattered dolomite, shatter cones, cold desert | Osinski et al. (2006), *Planetary and Space Science* |
| **Lake Iriqui & Draa Basin** | Southern Morocco (`29.83°N, 6.51°W`) | Mars (Lacustrine Delta) | Desert playa mudcracks, clay mineralogy, ancient river sediment delta deposit | Preston & Dartnell (2014), *Int. J. Astrobiology* |
| **Mauna Kea Basaltic Slopes** | Hawaii, USA (`19.82°N, 155.47°W`) | Moon (Lunar Regolith Simulant) | Abrasive basaltic tephra, volcanic glass, rover wheel traction, drill heat dissipation | NASA In-Situ Resource Utilization (ISRU) Analog |
| **Icelandic Volcanic Highlands** | Iceland (`64.93°N, 16.65°W`) | Moon & Mars (Mafic Volcanism) | Unvegetated basalt sand, glaciovolcanic palagonite, rover autonomy testing | Westall et al. (2015), *Astrobiology* |

---

## 8. Development Roadmap for a Production Platform

1. **Sprint 1: Cloud Data Connectors**: Connect `pystac-client` to USGS Astrogeology and Copernicus Data Space. Ingest DTMs and surface reflectance rasters directly as COGs.
2. **Sprint 2: PostGIS & IAU Planetary Coordinate Support**: Configure PostgreSQL with PostGIS schemas capable of handling non-terrestrial planetary coordinate systems (`IAU2000:49900` for Mars, `IAU2000:30100` for Moon).
3. **Sprint 3: Vector Knowledge Base (Astrobiology RAG)**: Ingest research PDFs into `pgvector` with hybrid keyword/vector search to provide exact scientific provenance and DOI references for the AI Copilot.
4. **Sprint 4: 3D Terrain Digital Twin (CesiumJS)**: Convert local elevation grids into Quantized-Mesh tiles (`.terrain`) or glTF format for interactive 3D flyovers and rover trajectory simulation.
5. **Sprint 5: Mission Simulator & Sensitivity Engine**: Implement real-time parameter weighting sliders with automated rank-stability testing ($\pm 15\%$ perturbation analysis).
