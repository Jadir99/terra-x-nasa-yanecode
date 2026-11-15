import json

with open("data/scientific_catalog.json", "r", encoding="utf-8") as f:
    cat = json.load(f)

# Define spatial metadata for each earth site
spatial_metadata = {
    "tindouf_sebkha": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": 27.6700,
        "lon": -8.1400,
        "position_reference": "Barycentre de la Sebkha de Tindouf / station Oberlin 2018",
        "position_source": "Oberlin et al., 2018 (GPS terrain); Copernicus GLO-30",
        "bounding_box": [-8.3500, 27.4500, -7.9500, 27.8500],
        "raster_product": "Copernicus_DSM_COG_10_N27_00_W009_00_DEM",
        "grid_dx": 30,
        "is_regional": False,
        "sector_note": "Secteur d'évaporites et de croûtes salines hyperarides documenté par spectroscopie SWIR et diffraction RX."
    },
    "iriqui_draa": {
        "name": "Lake Iriqui — Sebkha & Paléolac (Southern Morocco)",
        "crs": "WGS 84 (EPSG:4326)",
        "lat": 29.8127,
        "lon": -6.5047,
        "position_reference": "Barycentre du paléolac asséché d'Iriqui (Playa centrale)",
        "position_source": "NASADEM_HGT_n29w007 / Ori et al., 2014",
        "bounding_box": [-6.5902, 29.7385, -6.4192, 29.8869],
        "raster_product": "NASADEM_HGT_n29w007",
        "grid_dx": 500,
        "is_regional": False,
        "sector_note": "Secteur paléolac à fond plat et argiles évaporitiques (parfait pour essais de mobilité basse pente et stratigraphie)."
    },
    "atacama_yungay": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": -24.0800,
        "lon": -69.9200,
        "position_reference": "Station d'échantillonnage biologique Yungay Core (Bassin d'Aguas Blancas)",
        "position_source": "Navarro-González et al. (2003); Copernicus DEM",
        "bounding_box": [-69.9513, -24.1742, -69.7887, -24.0258],
        "raster_product": "Copernicus_DSM_COG_10_S25_00_W070_00_DEM",
        "grid_dx": 500,
        "is_regional": False,
        "sector_note": "Secteur hyperaride d'Aguas Blancas avec grille altimétrique haute résolution Copernicus DEM."
    },
    "mcmurdo_dry_valleys": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": -77.8600,
        "lon": 160.7000,
        "position_reference": "Station permafrost University Valley (Beacon Valley ridge)",
        "position_source": "Doran et al., 2002; REMA / USGS LTER",
        "bounding_box": None,
        "raster_product": "REMA_8m_mosaic",
        "grid_dx": 1000,
        "is_regional": True,
        "sector_note": "Score régional · emprise de calcul non documentée (caractérisation stationnaire LTER)."
    },
    "haughton_impact": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": 75.3800,
        "lon": -89.6500,
        "position_reference": "Camp de base HMP / bordure centrale du cratère d'impact",
        "position_source": "Lee & Osinski, 2005; ArcticDEM",
        "bounding_box": None,
        "raster_product": "ArcticDEM_2m",
        "grid_dx": 500,
        "is_regional": True,
        "sector_note": "Score régional · emprise de calcul non documentée (synthèse de traverses rover)."
    },
    "rio_tinto": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": 37.7100,
        "lon": -6.5500,
        "position_reference": "Affleurement gossan minéralogique Peña de Hierro",
        "position_source": "Fernández-Remolar et al., 2005; IGN Espagne",
        "bounding_box": None,
        "raster_product": "MDT25_IGN",
        "grid_dx": 25,
        "is_regional": True,
        "sector_note": "Score régional · emprise de calcul non documentée (mesures ponctuelles de cours d'eau acide)."
    },
    "lanzarote_volcanic": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": 29.0200,
        "lon": -13.6500,
        "position_reference": "Tube de lave Cueva de los Verdes / terrain d'entraînement ESA PANGAEA",
        "position_source": "Sauro et al., 2019; Cabildo de Lanzarote LiDAR",
        "bounding_box": None,
        "raster_product": "LiDAR_IGN_Canarias",
        "grid_dx": 5,
        "is_regional": True,
        "sector_note": "Score régional · emprise de calcul non documentée (couloir de tube volcanique)."
    },
    "mojave_desert": {
        "crs": "WGS 84 (EPSG:4326)",
        "lat": 35.3400,
        "lon": -116.1200,
        "position_reference": "Playa de Silver Lake / corridor de test rover JPL",
        "position_source": "USGS 3DEP DEM / JPL Rover Field Tests",
        "bounding_box": None,
        "raster_product": "USGS_3DEP_10m",
        "grid_dx": 10,
        "is_regional": True,
        "sector_note": "Score régional · emprise de calcul non documentée (synthèse régionale de dunes et playas)."
    }
}

# New dedicated candidate: Vallée du Drâa
draa_candidate = {
    "id": "draa_valley",
    "name": "Vallée du Drâa — Cône Alluvial & Chenaux Tressés (Morocco)",
    "country": "Morocco",
    "region_group": "north_africa",
    "crs": "WGS 84 (EPSG:4326)",
    "lat": 30.3650,
    "lon": -5.8400,
    "elevation_m": 310,
    "status": "Morphometric Rover Mobility Testbed",
    "accessibility_score": 0.94,
    "safety_score": 0.90,
    "terrain_seed": 508,
    "terrain_style": "delta_crater",
    "summary": "Braided fluvial fan system and low-slope alluvial gravel plains in the Moroccan Anti-Atlas, benchmarked for ExoMars rover mobility trials.",
    "position_reference": "Terrasse alluviale de Tagounite / cône fluviatile du Drâa",
    "position_source": "Copernicus DEM GLO-30 / Ori et al., 2014",
    "bounding_box": [-5.9260, 30.2908, -5.7540, 30.4392],
    "raster_product": "Copernicus_DSM_COG_10_N30_00_W006_00_DEM",
    "grid_dx": 500,
    "is_regional": False,
    "sector_note": "Secteur de cône alluvial et terrasses de cailloutis modélisé par grille Copernicus DEM 30m.",
    "publications": [
        {
            "id": "morocco_draa_ref",
            "citation": "Ori, G. G. et al. — Draa Mars Analog Field Campaigns (Morocco Planetary Analog Testbed).",
            "doi": "10.1016/j.pss.2014.05.002",
            "url": "https://doi.org/10.1016/j.pss.2014.05.002",
            "key_finding": "Fluvial fan gravels and terrace topography provide an ideal physical test corridor for planetary rover chassis and autonomous traverse algorithms."
        }
    ],
    "limits": [
        "Minimal clay and perchlorate deposits compared to Tindouf Sebkha evaporites.",
        "Vegetation pockets in oued margins require exclusion filters."
    ],
    "features": {
        "altimetry": {"value": 310, "unit": "m relief", "uncertainty": 14, "provenance": "Copernicus GLO-30 DEM", "resolution_m": 30, "measurement_type": "orbital"},
        "slope_roughness": {"value": 5.2, "unit": "deg mean slope", "uncertainty": 0.8, "provenance": "Copernicus DEM derivative", "resolution_m": 30, "measurement_type": "orbital"},
        "temperature": {"value": 22.0, "unit": "°C mean", "uncertainty": 1.8, "provenance": "Landsat LST", "resolution_m": 30, "measurement_type": "orbital"},
        "aridity": {"value": 0.90, "unit": "hyperarid index", "uncertainty": 0.03, "provenance": "TerraClimate P/PET", "resolution_m": 4000, "measurement_type": "climate_grid"},
        "mineralogy": {"value": 0.74, "tags": ["iron_oxide", "carbonate", "smectite", "regolith"], "unit": "class index", "uncertainty": 0.11, "provenance": "Landsat 8/9 + Sentinel-2 SWIR", "resolution_m": 20, "measurement_type": "orbital"},
        "geochemistry": {"value": 0.52, "tags": ["silicate_regolith", "neutral_alkaline_pH"], "unit": "salt/redox index", "uncertainty": 0.15, "provenance": "Field soil XRF", "resolution_m": 10, "measurement_type": "in_situ"}
    }
}

# Update existing earth sites with spatial metadata
existing_ids = set()
for site in cat["earth_sites"]:
    sid = site["id"]
    existing_ids.add(sid)
    if sid in spatial_metadata:
        for k, v in spatial_metadata[sid].items():
            site[k] = v

# Add draa_valley if not present
if "draa_valley" not in existing_ids:
    cat["earth_sites"].append(draa_candidate)

with open("data/scientific_catalog.json", "w", encoding="utf-8") as f:
    json.dump(cat, f, indent=2, ensure_ascii=False)

print("Updated data/scientific_catalog.json successfully! Earth sites count:", len(cat["earth_sites"]))
