/** Module 05: 3D Terrain Digital Twin (Planetary AOI vs Earth Candidate). */

function despikeMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length === 0) return matrix;
  const h = matrix.length;
  const w = Array.isArray(matrix[0]) ? matrix[0].length : 0;
  if (w === 0) return matrix;
  const out = matrix.map(row => (Array.isArray(row) ? [...row] : row));
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = matrix[y][x];
      if (typeof v !== "number" || isNaN(v)) continue;
      const nbrs = [];
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dy === 0 && dx === 0) continue;
          const ny = y + dy, nx = x + dx;
          if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
            const nv = matrix[ny][nx];
            if (typeof nv === "number" && !isNaN(nv)) nbrs.push(nv);
          }
        }
      }
      if (nbrs.length >= 3) {
        nbrs.sort((a, b) => a - b);
        const med = nbrs[Math.floor(nbrs.length / 2)];
        if (Math.abs(v - med) > 35) {
          out[y][x] = med;
        }
      }
    }
  }
  return out;
}

function renderSurfacePlot(containerId, terrain, colorscale, title) {
  const el = document.getElementById(containerId);
  if (!el || !terrain) return;

  if (typeof window.Plotly === "undefined") {
    el.innerHTML = `<div style="padding:16px;color:var(--text-muted)">
      3D surface library offline. Relief: ${terrain.relief_m} m | Mean Slope: ${terrain.slope_deg}° | RMS Step: ${terrain.rms_step_m} m
    </div>`;
    return;
  }

  const relief = typeof terrain.relief_m === "number" ? terrain.relief_m : 200;
  const zAspect = Math.min(0.32, Math.max(0.13, (relief / 2000) * 0.30));
  const cleanZ = despikeMatrix(terrain.z);

  const trace = {
    z: cleanZ,
    type: "surface",
    colorscale,
    showscale: false,
    contours: {
      z: { show: true, usecolormap: true, highlightcolor: "#ffffff", project: { z: false } },
    },
    lighting: {
      ambient: 0.85,
      diffuse: 0.85,
      specular: 0.15,
      roughness: 0.5,
      fresnel: 0.2,
    },
  };

  const layout = {
    paper_bgcolor: "#FFFFFF",
    plot_bgcolor: "#F8FAFC",
    margin: { l: 15, r: 15, t: 10, b: 22 },
    scene: {
      aspectmode: "manual",
      aspectratio: { x: 1.05, y: 1.05, z: zAspect },
      camera: {
        eye: { x: 1.5, y: -1.5, z: 0.95 },
        center: { x: 0, y: 0, z: -0.12 }
      },
      xaxis: {
        title: { text: "X (km)", font: { size: 10, color: "#536273" } },
        showgrid: true,
        gridcolor: "#DCE5EC",
        tickfont: { color: "#536273", size: 8.5 },
        zerolinecolor: "#DCE5EC"
      },
      yaxis: {
        title: { text: "Y (km)", font: { size: 10, color: "#536273" } },
        showgrid: true,
        gridcolor: "#DCE5EC",
        tickfont: { color: "#536273", size: 8.5 },
        zerolinecolor: "#DCE5EC"
      },
      zaxis: {
        title: { text: "Elev (m)", font: { size: 10, color: "#536273" } },
        showgrid: true,
        gridcolor: "#DCE5EC",
        tickfont: { color: "#536273", size: 8.5 },
        zerolinecolor: "#DCE5EC"
      },
      bgcolor: "#F8FAFC",
    },
    title: title ? { text: title, font: { size: 11, color: "#101820" } } : undefined,
  };

  window.Plotly.react(el, [trace], layout, { responsive: true, displayModeBar: false, scrollZoom: false });
}

function renderTransect(aoiData, earthData) {
  const el = document.getElementById("plot-transect");
  if (!el || typeof window.Plotly === "undefined") return;

  const x = aoiData.terrain.transect.map((_, i) => i * 50);
  const traces = [
    {
      x,
      y: aoiData.terrain.transect,
      name: `${aoiData.name} (${aoiData.terrain.relief_m}m relief)`,
      type: "scatter",
      mode: "lines",
      line: { color: "#E87532", width: 2.5 },
    },
    {
      x,
      y: earthData.terrain.transect,
      name: `${earthData.name} (${earthData.terrain.relief_m}m relief)`,
      type: "scatter",
      mode: "lines",
      line: { color: "#078FE0", width: 2.5 },
    },
  ];

  const layout = {
    paper_bgcolor: "#FFFFFF",
    plot_bgcolor: "#F5F9FC",
    margin: { l: 50, r: 20, t: 14, b: 36 },
    xaxis: { title: "Transect Distance (m)", color: "#536273", gridcolor: "#DCE5EC" },
    yaxis: { title: "Relative Elevation (m)", color: "#536273", gridcolor: "#DCE5EC" },
    legend: { font: { color: "#101820", size: 11 }, orientation: "h", y: 1.15 },
  };

  window.Plotly.react(el, traces, layout, { responsive: true, displayModeBar: false });
}

export async function loadAndRenderTerrainTwin(aoiId, siteId, box = null) {
  const reqBody = { aoi_id: aoiId, site_id: siteId };
  if (box && Array.isArray(box) && box.length === 4) {
    reqBody.box = box;
  }
  const res = await fetch("/api/terrain/compare", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(reqBody),
  });
  if (!res.ok) return;
  const data = await res.json();

  const aoiNameEl = document.getElementById("twin-aoi-name");
  const aoiMetricsEl = document.getElementById("twin-aoi-metrics");
  const aoiBadgeEl = document.getElementById("twin-aoi-badge");
  const earthNameEl = document.getElementById("twin-earth-name");
  const earthMetricsEl = document.getElementById("twin-earth-metrics");
  const earthBadgeEl = document.getElementById("twin-earth-badge");

  if (aoiNameEl) aoiNameEl.textContent = `${data.aoi.body.toUpperCase()} — ${data.aoi.name}`;
  if (aoiBadgeEl) {
    aoiBadgeEl.textContent = data.aoi.terrain.badge || (data.aoi.terrain.is_real_measurement ? "[Mesure Réelle MOLA]" : "[Modélisation 3D]");
    aoiBadgeEl.style.background = data.aoi.terrain.is_real_measurement ? "#e2f4df" : "#f1f5f9";
    aoiBadgeEl.style.color = data.aoi.terrain.is_real_measurement ? "#286324" : "#475569";
    aoiBadgeEl.style.border = data.aoi.terrain.is_real_measurement ? "1px solid #a3e69f" : "1px solid #cbd5e1";
  }
  if (aoiMetricsEl) {
    aoiMetricsEl.textContent = `Relief: ${data.aoi.terrain.relief_m}m | Pente: ${data.aoi.terrain.slope_deg}° | RMS: ${data.aoi.terrain.rms_step_m}m`;
  }
  if (earthNameEl) earthNameEl.textContent = `EARTH — ${data.earth.name}`;
  if (earthBadgeEl) {
    earthBadgeEl.textContent = data.earth.terrain.badge || (data.earth.terrain.is_real_measurement ? "[Mesure Réelle Copernicus DEM]" : "[Modélisation 3D]");
    earthBadgeEl.style.background = data.earth.terrain.is_real_measurement ? "#e2f4df" : "#f1f5f9";
    earthBadgeEl.style.color = data.earth.terrain.is_real_measurement ? "#286324" : "#475569";
    earthBadgeEl.style.border = data.earth.terrain.is_real_measurement ? "1px solid #a3e69f" : "1px solid #cbd5e1";
  }
  if (earthMetricsEl) {
    earthMetricsEl.textContent = `Relief: ${data.earth.terrain.relief_m}m | Pente: ${data.earth.terrain.slope_deg}° | RMS: ${data.earth.terrain.rms_step_m}m`;
  }

  const planetaryColors =
    data.aoi.body === "moon"
      ? [
          [0, "#1e293b"],
          [0.5, "#64748b"],
          [1, "#e2e8f0"],
        ]
      : [
          [0, "#451a03"],
          [0.5, "#c2410c"],
          [1, "#fdba74"],
        ];

  const earthColors = [
    [0, "#0f172a"],
    [0.45, "#0d9488"],
    [0.8, "#84cc16"],
    [1, "#fef08a"],
  ];

  renderSurfacePlot("plot-3d-aoi", data.aoi.terrain, planetaryColors, "");
  renderSurfacePlot("plot-3d-earth", data.earth.terrain, earthColors, "");
  renderTransect(data.aoi, data.earth);

  // Guarantee Plotly synchronizes with container dimensions
  setTimeout(() => {
    try {
      const p1 = document.getElementById("plot-3d-aoi");
      const p2 = document.getElementById("plot-3d-earth");
      const pt = document.getElementById("plot-transect");
      if (window.Plotly) {
        if (p1 && p1.data) window.Plotly.Plots.resize(p1);
        if (p2 && p2.data) window.Plotly.Plots.resize(p2);
        if (pt && pt.data) window.Plotly.Plots.resize(pt);
      }
    } catch (_) {}
  }, 120);
}
