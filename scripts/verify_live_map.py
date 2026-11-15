import json
import os
from playwright.sync_api import sync_playwright

session_obj = {
    "username": "analyst",
    "name": "Dr. Sarah Chen",
    "role": "Lead Astrobiologist",
    "clearance": "Level 3",
    "avatar": "SC"
}

artifact_dir = r"C:\Users\moham\.gemini\antigravity\brain\5a80e1b3-8245-45e6-83b3-52d9a4052910\screenshots"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1366, "height": 850})
    page.goto("https://terra-x-nasa-2026.netlify.app/login.html")
    page.evaluate("(sess) => localStorage.setItem('terra_x_session', JSON.stringify(sess))", session_obj)
    page.goto("https://terra-x-nasa-2026.netlify.app/workbench.html", wait_until="networkidle")
    page.wait_for_timeout(2500)
    
    pills = page.query_selector_all(".map-nav-pill")
    print(f"Live Netlify pills count: {len(pills)}")
    
    # Click pill #1 (Tindouf)
    if pills:
        pills[0].click()
        page.wait_for_timeout(1500)
    
    out_path = os.path.join(artifact_dir, "live_netlify_map_compact.png")
    maps_split = page.locator(".maps-split")
    if maps_split.count() > 0:
        maps_split.screenshot(path=out_path)
        print(f"Captured {out_path} from live Netlify!")
    
    # Test pill #2 (Lake Iriqui)
    if len(pills) > 1:
        pills[1].click()
        page.wait_for_timeout(1500)
        out_path2 = os.path.join(artifact_dir, "live_netlify_map_iriqui.png")
        maps_split.screenshot(path=out_path2)
        print(f"Captured {out_path2} from live Netlify!")
        
    browser.close()
print("Live test complete!")
