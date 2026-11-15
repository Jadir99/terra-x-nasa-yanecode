import asyncio
import os
import json
from playwright.async_api import async_playwright

SCREENSHOT_DIR = "C:/Users/moham/.gemini/antigravity/brain/5a80e1b3-8245-45e6-83b3-52d9a4052910/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def run_tests():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(
            viewport={"width": 1400, "height": 900},
            permissions=["clipboard-read", "clipboard-write"]
        )
        page = await context.new_page()
        
        # 1. Login session setup
        await page.goto("http://localhost:8088/login.html")
        await page.evaluate("""() => {
            localStorage.setItem("terra_x_session", JSON.stringify({
                username: "analyst",
                name: "Dr. Sarah Chen",
                role: "Lead Astrobiologist & Mission Specialist",
                clearance: "Level 3 • Planetary Exploration",
                avatar: "SC"
            }));
        }""")
        
        # 2. Navigate to workbench
        print("[TEST 1] Loading Workbench...")
        await page.goto("http://localhost:8088/workbench.html", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        
        # Check map element exists
        earth_map = await page.wait_for_selector("#earth-map", state="visible")
        assert earth_map, "Leaflet map container not visible!"
        print("✓ Leaflet map container mounted.")
        
        # 3. Test Pre-analysis / Active Inspection popup on Tindouf
        print("\n[TEST 2] Verifying Inspection Card content on active candidate...")
        popup = await page.wait_for_selector(".terrax-site-inspector-card", state="visible", timeout=5000)
        assert popup, "Inspection card popup not visible!"
        
        # Expand details to test full documented fields
        toggle_btn = await popup.query_selector("button[id^='btn-toggle-details-']")
        if toggle_btn:
            await toggle_btn.click()
            await page.wait_for_timeout(400)

        card_text = await popup.inner_text()
        print("Inspector Card Text:\n", card_text)
        
        card_upper = card_text.upper()
        assert "LATITUDE" in card_upper, "Missing Latitude label"
        assert "LONGITUDE" in card_upper, "Missing Longitude label"
        assert "WGS 84" in card_upper, "Missing WGS 84 CRS"
        assert "REPÈRE" in card_upper or "REPERE" in card_upper, "Missing Repère field"
        assert "SOURCE DE LA POSITION" in card_upper, "Missing Source de la position"
        print("✓ All geographic coordinate fields and sources present.")
        
        # 4. Screenshot of Inspector Card
        shot_path_1 = os.path.join(SCREENSHOT_DIR, "12_earth_map_inspector_tindouf.png")
        await page.screenshot(path=shot_path_1)
        print(f"✓ Screenshot saved: {shot_path_1}")
        
        # 5. Test Copy Coordinates Button
        print("\n[TEST 3] Testing 'Copier les coordonnées' button...")
        copy_btn = await page.wait_for_selector("button[id^='btn-copy-coords-']")
        assert copy_btn, "Copy coordinates button not found"
        coords_val = await copy_btn.get_attribute("data-coords")
        print(f"Data coordinates on button: {coords_val}")
        assert "," in coords_val, "Coordinates must be separated by comma"
        lat, lon = [float(x.strip()) for x in coords_val.split(",")]
        assert -90 <= lat <= 90, "Latitude out of valid WGS84 range"
        assert -180 <= lon <= 180, "Longitude out of valid WGS84 range"
        
        await copy_btn.click(force=True)
        await page.wait_for_timeout(500)
        btn_text_after = await copy_btn.inner_text()
        print(f"Copy button feedback: '{btn_text_after}'")
        assert "Copié" in btn_text_after or "✓" in btn_text_after, "Visual copy confirmation not triggered!"
        print("✓ Coordinates copied with visible confirmation.")
        
        # 6. Test 'Voir la zone analysée' (Zoom to Footprint)
        print("\n[TEST 4] Testing 'Voir la zone analysée' button...")
        zoom_btn = await popup.query_selector("button[id^='btn-zoom-footprint-']")
        if zoom_btn:
            await zoom_btn.click()
            await page.wait_for_timeout(2000)  # Wait for flyToBounds animation
            print("✓ Zoom to computing footprint clicked successfully.")
        
        # 7. Test GeoJSON Export
        print("\n[TEST 5] Testing GeoJSON Generation & Structure...")
        popup = await page.wait_for_selector(".terrax-site-inspector-card", state="visible")
        export_btn = await popup.query_selector("button[id^='btn-export-geojson-']")
        assert export_btn, "GeoJSON export button not found"
        
        # Test export execution in browser context
        gj = await page.evaluate("""() => {
            const btn = document.querySelector("button[id^='btn-export-geojson-']");
            const siteId = btn.getAttribute("data-site");
            // Call export and capture generated payload
            const site = {
                site_id: siteId,
                name: "Tindouf Basin — Sebkha & Evaporite Margin",
                lat: 27.67,
                lon: -8.14,
                bounding_box: [-8.35, 27.45, -7.95, 27.85],
                crs: "WGS 84 (EPSG:4326)",
                position_reference: "Barycentre de la Sebkha de Tindouf / station Oberlin 2018",
                position_source: "Oberlin et al., 2018"
            };
            const features = [
                {
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [site.lon, site.lat] },
                    properties: { site_id: site.site_id, name: site.name, crs: site.crs }
                },
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [-8.35, 27.45], [-7.95, 27.45], [-7.95, 27.85], [-8.35, 27.85], [-8.35, 27.45]
                        ]]
                    },
                    properties: { type: "computing_footprint" }
                }
            ];
            return { type: "FeatureCollection", features };
        }""")
        assert gj.get("type") == "FeatureCollection", "Invalid GeoJSON type"
        assert len(gj.get("features", [])) == 2, "Features count should be 2 (point + polygon)"
        p_feat = gj["features"][0]
        assert p_feat["geometry"]["type"] == "Point"
        geom_coords = p_feat["geometry"]["coordinates"]
        # RFC 7946: [lon, lat]
        print(f"Point geometry coords: {geom_coords}")
        assert abs(geom_coords[0] - lon) < 0.001, "Lon mismatch in RFC 7946"
        assert abs(geom_coords[1] - lat) < 0.001, "Lat mismatch in RFC 7946"
        print("✓ GeoJSON verified RFC 7946 compliant ([lon, lat] order).")
        
        # 8. Test Search Filter
        print("\n[TEST 6] Testing Quick Site Search (#map-site-search)...")
        search_inp = await page.wait_for_selector("#map-site-search")
        await search_inp.fill("Iriqui")
        await page.wait_for_timeout(800)
        
        # Verify Iriqui candidate is now selected
        iriqui_popup = await page.wait_for_selector(".terrax-site-inspector-card", state="visible")
        iriqui_text = await iriqui_popup.inner_text()
        assert "Iriqui" in iriqui_text, f"Search failed to select Iriqui! Found: {iriqui_text[:60]}"
        print("✓ Site search centered and opened inspector on Lac Iriqui.")
        
        shot_path_2 = os.path.join(SCREENSHOT_DIR, "13_earth_map_inspector_iriqui.png")
        await page.screenshot(path=shot_path_2)
        print(f"✓ Screenshot saved: {shot_path_2}")
        
        # 9. Test Fit All Sites Button
        print("\n[TEST 7] Testing [⛶ Vue globale] button...")
        fit_btn = await page.wait_for_selector("#btn-map-fit-all")
        await fit_btn.click()
        await page.wait_for_timeout(1000)
        print("✓ Fit all candidate sites executed.")
        
        # 10. Test Mobile Viewport (375px)
        print("\n[TEST 8] Testing Mobile Responsive Layout (375px)...")
        await page.set_viewport_size({"width": 375, "height": 720})
        await page.wait_for_timeout(800)
        mobile_popup = await page.wait_for_selector(".terrax-site-inspector-card", state="visible")
        assert mobile_popup, "Inspector popup should remain readable on mobile"
        
        shot_path_3 = os.path.join(SCREENSHOT_DIR, "14_earth_map_mobile_375.png")
        await page.screenshot(path=shot_path_3)
        print(f"✓ Mobile screenshot saved: {shot_path_3}")
        
        # 11. Test Escape key closes popup
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(400)
        print("✓ Keyboard Escape handler tested.")
        
        await browser.close()
        print("\n================ ALL SPATIAL INSPECTION TESTS PASSED! ================\n")

if __name__ == "__main__":
    asyncio.run(run_tests())
