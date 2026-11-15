import asyncio
import os
from playwright.async_api import async_playwright

session_obj = {
    "username": "analyst",
    "name": "Dr. Sarah Chen",
    "role": "Lead Astrobiologist",
    "clearance": "Level 3",
    "avatar": "SC"
}

artifact_dir = r"C:\Users\moham\.gemini\antigravity\brain\5a80e1b3-8245-45e6-83b3-52d9a4052910\screenshots"

async def test_static_pure_offline():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1400, "height": 900})
        page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
        page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))
        
        await page.goto("http://localhost:8088/login.html")
        await page.evaluate("(sess) => localStorage.setItem('terra_x_session', JSON.stringify(sess))", session_obj)
        
        print("\n--- [TEST 1] Loading Workbench on pure static http server ---")
        await page.goto("http://localhost:8088/workbench.html", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        
        # 1. Verify Catalog loaded
        aoi_options = await page.eval_on_selector("#aoi-select", "el => el.options.length")
        print(f"Target AOI options count: {aoi_options}")
        assert aoi_options >= 3, f"Expected at least 3 AOI options, got {aoi_options}"
        
        # 2. Verify Earth Map rendered candidate pills
        pills = await page.query_selector_all(".map-nav-pill")
        print(f"Candidate navigation pills count: {len(pills)}")
        assert len(pills) >= 8, f"Expected at least 8 pills, got {len(pills)}"
        
        # 3. Click #1 Tindouf pill and verify popup
        print("\n--- [TEST 2] Testing Candidate selection in static mode ---")
        await pills[0].click()
        await page.wait_for_timeout(1000)
        
        popup = await page.wait_for_selector(".terrax-site-inspector-card", state="visible")
        assert popup, "Inspector popup should be visible in static mode"
        popup_text = await popup.inner_text()
        print("Popup site name:", popup_text.split("\n")[0])
        
        # 4. Test 3D Terrain tab in static mode
        print("\n--- [TEST 3] Testing 3D Terrain Digital Twin in static mode ---")
        await page.click('button[data-tab="view-3d"]')
        await page.wait_for_timeout(2000)
        
        twin_earth_name = await page.inner_text("#twin-earth-name")
        print(f"3D Twin Earth Candidate: {twin_earth_name}")
        assert "EARTH" in twin_earth_name, "3D Terrain twin failed to load in static mode"
        
        # 5. Test Copilot query in static mode
        print("\n--- [TEST 4] Testing AI Copilot offline query ---")
        copilot_input = await page.wait_for_selector("#copilot-input")
        await copilot_input.fill("Why Tindouf?")
        await page.click("#copilot-form button[type='submit']")
        await page.wait_for_timeout(2000)
        
        feed_text = await page.inner_text("#copilot-feed")
        assert "Tindouf" in feed_text, "Copilot failed to answer in static mode"
        print("✓ Copilot answered offline query successfully!")
        
        # Screenshot full verification
        out_path = os.path.join(artifact_dir, "pure_static_mode_verified.png")
        await page.screenshot(path=out_path)
        print(f"✓ Screenshot saved: {out_path}")
        
        await browser.close()
    print("\n✅ All 4 Pure Static Offline Tests Passed!")

if __name__ == "__main__":
    asyncio.run(test_static_pure_offline())
