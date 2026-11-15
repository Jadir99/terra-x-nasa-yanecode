/** Module 04 & 07: Similarity Matrix Heatmap, 3-Score Breakdown, Sensitivity & Provenance. */

const CRITERION_LABELS = {
  altimetry: "Altimetry",
  slope_roughness: "Slope / Roughness",
  temperature: "Temperature",
  aridity: "Aridity",
  mineralogy: "Mineralogy",
  geochemistry: "Geochemistry",
};

export function renderSimilarityHeatmap(analysis) {
  const container = document.getElementById("similarity-heatmap");
  if (!container || !analysis || !analysis.results.length) return;

  const criteriaIds = Object.keys(CRITERION_LABELS);
  const xLabels = criteriaIds.map((c) => CRITERION_LABELS[c]);
  const sites = [...analysis.results].reverse();
  const yLabels = sites.map((s) => `#${s.rank} ${s.name.split("—")[0].trim()}`);

  const zValues = sites.map((s) =>
    criteriaIds.map((cid) => {
      const d = s.criterion_details[cid];
      return d && d.status === "observed" && d.score !== null ? Number(d.score.toFixed(2)) : null;
    })
  );

  const textValues = sites.map((s) =>
    criteriaIds.map((cid) => {
      const d = s.criterion_details[cid];
      if (!d) return "N/A";
      if (d.status === "missing") return "MISSING";
      if (d.status === "incompatible") return "GUARDRAIL";
      return d.score.toFixed(2);
    })
  );

  if (typeof window.Plotly !== "undefined") {
    const trace = {
      z: zValues,
      x: xLabels,
      y: yLabels,
      text: textValues,
      texttemplate: "%{text}",
      textfont: { color: "#101820", size: 11, family: "JetBrains Mono, monospace" },
      type: "heatmap",
      colorscale: [
        [0, "#E7F5FF"],
        [0.35, "#BEE3F8"],
        [0.7, "#078FE0"],
        [1.0, "#0566A8"],
      ],
      zmin: 0,
      zmax: 1,
      hoverongaps: false,
      colorbar: {
        title: "sᵢⱼ",
        tickfont: { color: "#536273" },
        titlefont: { color: "#101820" },
      },
    };

    const layout = {
      paper_bgcolor: "#FFFFFF",
      plot_bgcolor: "#F5F9FC",
      margin: { l: 195, r: 40, t: 16, b: 48 },
      xaxis: { tickfont: { color: "#536273", size: 11 }, side: "bottom" },
      yaxis: { tickfont: { color: "#101820", size: 11 } },
    };

    window.Plotly.react(container, [trace], layout, { responsive: true, displayModeBar: false, scrollZoom: false });
    return;
  }

  // Fallback HTML matrix if offline
  let html = `<table class="data-table"><thead><tr><th>Site</th>${xLabels.map((l) => `<th>${l}</th>`).join("")}</tr></thead><tbody>`;
  sites.reverse().forEach((s, idx) => {
    const rowText = textValues[sites.length - 1 - idx];
    html += `<tr><td><strong>#${s.rank} ${s.name}</strong></td>${rowText.map((v) => `<td>${v}</td>`).join("")}</tr>`;
  });
  html += "</tbody></table>";
  container.innerHTML = html;
}

export function renderSelectedBreakdown(site, weights) {
  const el = document.getElementById("selected-site-breakdown");
  if (!el || !site) return;

  const sim = Math.round(site.similarity_score * 100);
  const apt = Math.round(site.mission_aptitude_score * 100);
  const conf = Math.round(site.confidence_score * 100);

  const rows = Object.entries(site.criterion_details)
    .map(([cid, d]) => {
      const wPct = Math.round((weights[cid] || 0) * 100);
      if (d.status === "observed") {
        const sPct = Math.round(d.score * 100);
        return `<tr>
          <td>${CRITERION_LABELS[cid] || cid}</td>
          <td>${wPct}%</td>
          <td><strong>${sPct}%</strong></td>
          <td style="color:var(--text-muted)">${d.site_provenance} (${d.measurement_type})</td>
        </tr>`;
      }
      const tag = d.status === "incompatible" ? "Guardrail Excluded" : "Missing Data";
      return `<tr>
        <td>${CRITERION_LABELS[cid] || cid}</td>
        <td>${wPct}%</td>
        <td style="color:var(--amber)">${tag}</td>
        <td style="color:var(--text-muted)">${d.reason}</td>
      </tr>`;
    })
    .join("");

  el.innerHTML = `
    <div style="margin-bottom:8px;">
      <strong>#${site.rank} ${site.name}</strong> <span class="cand-country">(${site.country})</span>
      <p class="mini-desc">${site.summary}</p>
    </div>
    <div class="score-trio" style="margin-bottom:10px;">
      <div class="score-box"><span class="lbl">Similarity</span><span class="val" style="color:var(--cyan)">${sim}%</span></div>
      <div class="score-box"><span class="lbl">Aptitude</span><span class="val" style="color:var(--amber)">${apt}%</span></div>
      <div class="score-box"><span class="lbl">Confidence</span><span class="val" style="color:var(--green)">${conf}%</span></div>
    </div>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Criterion</th><th>Weight</th><th>Score / Status</th><th>Provenance</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderSensitivityPanel(sensitivity) {
  const el = document.getElementById("sensitivity-table");
  if (!el || !sensitivity) return;

  const rows = sensitivity.scenarios
    .map(
      (sc) => `<tr>
      <td>${CRITERION_LABELS[sc.criterion] || sc.criterion}</td>
      <td>${sc.delta_pct > 0 ? "+" : ""}${sc.delta_pct}%</td>
      <td>${sc.top_site_id}</td>
      <td style="color:${sc.rank_changed ? "var(--amber)" : "var(--green)"}">${sc.rank_changed ? "Rank Shifted" : "Stable"}</td>
    </tr>`
    )
    .join("");

  el.innerHTML = `
    <p class="mini-desc" style="margin-bottom:8px;">
      Stability Score: <strong style="color:var(--green)">${Math.round(sensitivity.stability_score * 100)}%</strong>
      (${sensitivity.rank_flip_count} top-rank shift across ${sensitivity.total_perturbations} weight perturbations).
    </p>
    <div class="table-scroll">
      <table class="data-table">
        <thead><tr><th>Perturbed Weight</th><th>Delta</th><th>Top Candidate</th><th>Result</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function renderProvenanceTable(datasets) {
  const tbody = document.querySelector("#provenance-table tbody");
  if (!tbody || !datasets) return;

  tbody.innerHTML = datasets
    .map(
      (ds) => `<tr>
      <td><span class="meta-pill">${ds.body.toUpperCase()}</span></td>
      <td><a class="cite-link" href="${ds.url}" target="_blank" rel="noopener">${ds.name}</a><span class="mini-desc">${ds.product}</span></td>
      <td>${ds.source}</td>
      <td style="font-family:'JetBrains Mono',monospace">${ds.resolution}</td>
      <td>${ds.units}</td>
    </tr>`
    )
    .join("");
}
