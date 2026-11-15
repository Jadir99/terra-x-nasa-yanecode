/** Module 08: Scientific Report Preview & Multi-Format Export (PDF, Word, CSV, GeoJSON). */

function triggerDownload(filename, mime, content) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function renderReportPreview(analysis) {
  const el = document.getElementById("report-preview");
  if (!el || !analysis) return;

  const { aoi, mission, results, sensitivity, weights } = analysis;
  const rows = results
    .map(
      (r) => `<tr>
      <td>#${r.rank}</td>
      <td><strong>${r.name}</strong><br/><span style="color:var(--text-muted)">${r.country}</span></td>
      <td>${Math.round(r.similarity_score * 100)}%</td>
      <td>${Math.round(r.mission_aptitude_score * 100)}%</td>
      <td>${Math.round(r.confidence_score * 100)}%</td>
      <td>${r.missing_criteria.join(", ") || "None"}</td>
      <td>${r.publications?.[0]?.doi || "Catalog"}</td>
    </tr>`
    )
    .join("");

  const weightsTxt = Object.entries(weights)
    .map(([k, v]) => `${k}: ${Math.round(v * 100)}%`)
    .join(" • ");

  const limitsHtml = results
    .slice(0, 3)
    .map((r) => `<li><strong>${r.name}:</strong> ${r.limits.join(" ")}</li>`)
    .join("");

  el.innerHTML = `
    <div class="report-section">
      <h4>1. Planetary Target &amp; Mission Context</h4>
      <p><strong>Body &amp; AOI:</strong> ${aoi.body.toUpperCase()} — ${aoi.name} (${aoi.area_km2} km², ${aoi.target_crs})</p>
      <p><strong>Mission Scenario:</strong> [${mission.code}] ${mission.name_en} — ${mission.focus}</p>
      <p><strong>Normalized Criterion Weights:</strong> <span style="font-family:'JetBrains Mono',monospace;font-size:11px">${weightsTxt}</span></p>
    </div>

    <div class="report-section">
      <h4>2. Ranked Candidate Analogs (Similarity ≠ Mission Aptitude ≠ Confidence)</h4>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th>Rank</th><th>Candidate Site</th><th>Similarity</th><th>Aptitude</th><th>Confidence</th><th>Missing Data</th><th>Primary Ref</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    </div>

    <div class="report-section">
      <h4>3. Uncertainty, Sensitivity &amp; Scientific Limits</h4>
      <p><strong>Weight Sensitivity (±15%):</strong> Stability ${Math.round(sensitivity.stability_score * 100)}% (${sensitivity.rank_flip_count} rank change across ${sensitivity.total_perturbations} tests).</p>
      <ul style="margin:6px 0 0 18px;padding:0;">${limitsHtml}</ul>
    </div>

    <div class="report-section">
      <h4>4. Reference Provenance</h4>
      <p class="mini-desc">
        NASA PDS (pds.nasa.gov) • NASA Earthdata (earthdata.nasa.gov) • Moon Trek (trek.nasa.gov/moon/) •
        Oberlin, Claire &amp; Kounaves (2018), Astrobiology, DOI 10.1089/ast.2016.1557 •
        Navarro-González et al. (2003), Science, DOI 10.1126/science.1089143
      </p>
    </div>
  `;
}

export async function exportReport(state, format) {
  if (format === "pdf") {
    // Switch to report tab briefly if needed, then invoke print stylesheet
    document.querySelector('[data-tab="view-report"]')?.click();
    setTimeout(() => window.print(), 120);
    return;
  }

  const res = await fetch("/api/reports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      aoi_id: state.aoiId,
      mission_id: state.missionId,
      weights: state.weights,
      discovery_mode: state.discoveryMode,
      format,
      copilot_history: state.copilotHistory,
    }),
  });
  if (!res.ok) return;
  const payload = await res.json();
  const content = typeof payload.content === "string" ? payload.content : JSON.stringify(payload.content, null, 2);
  triggerDownload(payload.filename, payload.mime, content);
}
