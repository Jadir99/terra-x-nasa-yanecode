import test from "node:test";
import assert from "node:assert/strict";
import handler from "../netlify/functions/api.mjs";

const get = (path) => handler(new Request(`http://localhost${path}`));
const post = (path, body) =>
  handler(
    new Request(`http://localhost${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );

test("Netlify function handles all TERRA-X API endpoints", async () => {
  const health = await get("/api/health");
  assert.equal(health.status, 200);

  const ds = await (await get("/api/datasets")).json();
  assert.ok(ds.planetary_aois.length >= 5);

  const regional = await (await post("/api/discovery/jobs", { mode: "regional" })).json();
  assert.equal(regional.status, "completed");
  assert.ok(regional.sites.some((s) => s.id === "iriqui_draa"));

  const moon = await (
    await post("/api/analyses", { aoi_id: "shackleton_rim", mission_id: "cold_arid" })
  ).json();
  assert.ok(moon.results[0].incompatible_criteria.includes("aridity"));

  const mars = await (
    await post("/api/analyses", { aoi_id: "jezero_crater", mission_id: "soil_geochemistry" })
  ).json();
  assert.equal(mars.results[0].site_id, "tindouf_sebkha");

  const terrain = await (
    await post("/api/terrain/compare", { aoi_id: "jezero_crater", site_id: "tindouf_sebkha" })
  ).json();
  assert.ok(Array.isArray(terrain.aoi.terrain.z));

  const copilot = await (await post("/api/copilot/query", { question: "Why Tindouf?" })).json();
  assert.ok(copilot.citations.some((c) => c.doi === "10.1089/ast.2016.1557"));

  const csvRep = await (await post("/api/reports", { format: "csv" })).json();
  assert.equal(csvRep.format, "csv");
  assert.ok(csvRep.content.includes("tindouf_sebkha"));
});
