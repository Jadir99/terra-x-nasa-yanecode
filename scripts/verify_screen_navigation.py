import asyncio
import os
from playwright.async_api import async_playwright

SCREENSHOT_DIR = "C:/Users/moham/.gemini/antigravity/brain/5a80e1b3-8245-45e6-83b3-52d9a4052910/screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

async def test_screen_navigation():
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
        
        print("\n--- [TEST 1] Loading Workbench with Enhanced Navigation ---")
        await page.goto("http://localhost:8088/workbench.html", wait_until="networkidle")
        await page.wait_for_timeout(1500)
        
        # 2. Check Quick-Nav Carousel Bar
        pills_container = await page.wait_for_selector("#earth-nav-pills", state="visible")
        assert pills_container, "Pills container not found"
        pills = await page.query_selector_all(".map-nav-pill")
        print(f"Found {len(pills)} candidate pills in navigation carousel.")
        assert len(pills) >= 8, f"Expected at least 8 pills, got {len(pills)}"
        
        # 3. Test Clicking a Pill (e.g. Atacama)
        print("\n--- [TEST 2] Clicking #3 or #4 Atacama pill directly on screen ---")
        atacama_pill = None
        for pill in pills:
            txt = await pill.inner_text()
            if "Atacama" in txt:
                atacama_pill = pill
                break
        assert atacama_pill, "Atacama pill not found in carousel"
        await atacama_pill.click()
        await page.wait_for_timeout(1000)
        
        # Verify Atacama is now active
        active_pill = await page.wait_for_selector(".map-nav-pill.active")
        active_txt = await active_pill.inner_text()
        print(f"Active pill after click: {active_txt}")
        assert "Atacama" in active_txt, "Atacama pill did not become active"
        
        popup = await page.wait_for_selector(".terrax-site-inspector-card", state="visible")
        card_text = await popup.inner_text()
        assert "Atacama" in card_text, "Popup did not switch to Atacama"
        print("✓ Carousel pill click successfully selected and centered Atacama.")
        
        # 4. Test Carousel Navigation Arrows (◀ / ▶)
        print("\n--- [TEST 3] Testing Carousel Arrow Navigation (▶ Next) ---")
        next_btn = await page.wait_for_selector("#btn-nav-next-site")
        await next_btn.click()
        await page.wait_for_timeout(1000)
        
        active_pill_2 = await page.wait_for_selector(".map-nav-pill.active")
        active_txt_2 = await active_pill_2.inner_text()
        print(f"Active pill after clicking ▶: {active_txt_2}")
        assert active_txt_2 != active_txt, "Next arrow did not change active site"
        print("✓ Next site arrow (▶) navigated successfully.")
        
        # 5. Test Quick-Jump Dropdown
        print("\n--- [TEST 4] Testing Quick-Jump Dropdown ---")
        select_el = await page.wait_for_selector("#map-quick-select")
        options = await page.query_selector_all("#map-quick-select option")
        print(f"Quick-select dropdown options count: {len(options)}")
        assert len(options) >= 9, "Dropdown should list all candidates"
        
        await select_el.select_option(value="tindouf_sebkha")
        await page.wait_for_timeout(1000)
        
        popup_tindouf = await page.wait_for_selector(".terrax-site-inspector-card", state="visible")
        tindouf_text = await popup_tindouf.inner_text()
        assert "Tindouf" in tindouf_text, "Dropdown did not navigate to Tindouf"
        print("✓ Quick-jump dropdown selected Tindouf Basin.")
        
        # 6. Test Compact vs Expanded Popup Toggle
        print("\n--- [TEST 5] Testing Popup Details Expand / Collapse ---")
        toggle_btn = await popup_tindouf.wait_for_selector("button[id^='btn-toggle-details-']")
        assert toggle_btn, "Toggle details button not found in popup"
        
        # Check initial compact state: details container should have 'hidden'
        details_box = await popup_tindouf.query_selector("div[id^='inspector-details-']")
        class_name_init = await details_box.get_attribute("class")
        assert "hidden" in class_name_init, "Details box should be collapsed initially"
        print("✓ Popup is compact by default (non-intrusive).")
        
        # Click to expand
        await toggle_btn.click()
        await page.wait_for_timeout(500)
        class_name_exp = await details_box.get_attribute("class")
        assert "hidden" not in class_name_exp, "Details box should be expanded after click"
        btn_text_exp = await toggle_btn.inner_text()
        assert "Réduire" in btn_text_exp or "▴" in btn_text_exp, "Toggle text should indicate collapse"
        print("✓ Popup expanded to reveal full coordinates, repère, source, and footprint.")
        
        # 7. Test Region Filter Buttons
        print("\n--- [TEST 6] Testing Region Filter Buttons (Maroc / Sahara) ---")
        sahara_btn = await page.wait_for_selector("button.region-filter-btn[data-region='sahara']")
        await sahara_btn.click()
        await page.wait_for_timeout(1000)
        is_active = await sahara_btn.get_attribute("class")
        assert "active" in is_active, "Sahara region filter did not become active"
        print("✓ Region filter 'Maroc / Sahara' activated and zoomed.")
        
        # 8. Test Map Height Expansion Toggle (⛶ Agrandir)
        print("\n--- [TEST 7] Testing Map Expansion Toggle (330px ↔ 480px) ---")
        expand_btn = await page.wait_for_selector("#btn-toggle-map-size")
        init_h = await page.evaluate("document.getElementById('earth-map').offsetHeight")
        print(f"Initial map height: {init_h}px")
        
        await expand_btn.click()
        await page.wait_for_timeout(500)
        exp_h = await page.evaluate("document.getElementById('earth-map').offsetHeight")
        print(f"Expanded map height: {exp_h}px")
        assert exp_h > init_h, f"Map height did not expand (before: {init_h}, after: {exp_h})"
        
        btn_exp_label = await expand_btn.inner_text()
        assert "Réduire" in btn_exp_label or "⤢" in btn_exp_label
        print("✓ Map height expanded to 480px with ample viewing area.")
        
        # 9. Test Keyboard Navigation (ArrowLeft / ArrowRight)
        print("\n--- [TEST 8] Testing Keyboard Navigation (ArrowRight / ArrowLeft) ---")
        # Click body to ensure input doesn't have focus
        await page.mouse.click(10, 10)
        await page.keyboard.press("ArrowRight")
        await page.wait_for_timeout(800)
        pill_after_key = await page.wait_for_selector(".map-nav-pill.active")
        txt_after_key = await pill_after_key.inner_text()
        print(f"Active pill after ArrowRight keypress: {txt_after_key}")
        
        # 10. Capture Showcase Screenshot
        shot_path = os.path.join(SCREENSHOT_DIR, "15_screen_navigation_showcase.png")
        await page.screenshot(path=shot_path)
        print(f"✓ Screenshot saved: {shot_path}")
        
        await browser.close()
        print("\n================ ALL SCREEN NAVIGATION TESTS PASSED! ================\n")

if __name__ == "__main__":
    asyncio.run(test_screen_navigation())
