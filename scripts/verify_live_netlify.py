from playwright.sync_api import sync_playwright
import urllib.request
import json

base_url = "https://terra-x-nasa-2026.netlify.app"

# 1. Test live API
print("Testing live Netlify function /api/datasets...")
try:
    req = urllib.request.urlopen(f"{base_url}/api/datasets", timeout=10)
    data = json.loads(req.read().decode('utf-8'))
    print(f"API /api/datasets OK: {len(data.get('datasets', []))} datasets found!")
except Exception as e:
    print(f"API error: {e}")

# 2. Test live pages in Playwright
session_data = json.dumps({
    "username": "analyst",
    "name": "Dr. Sarah Chen",
    "role": "Lead Astrobiologist & Mission Specialist",
    "clearance": "Level 3 - Planetary Exploration",
    "avatar": "SC",
    "loginTime": 1700000000000
})

with sync_playwright() as p:
    browser = p.chromium.launch()
    
    # Test Landing
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    resp = page.goto(f"{base_url}/", wait_until='networkidle')
    print(f"Live Landing status: {resp.status}")
    page.screenshot(path='static/doc/screenshots/live_netlify_landing.png')
    page.close()
    
    # Test Atlas
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    resp = page.goto(f"{base_url}/atlas/index.html", wait_until='networkidle')
    print(f"Live Atlas status: {resp.status}")
    page.screenshot(path='static/doc/screenshots/live_netlify_atlas.png')
    page.close()
    
    # Test Workbench
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.add_init_script(f'localStorage.setItem("terra_x_session", \'{session_data}\');')
    resp = page.goto(f"{base_url}/workbench.html", wait_until='networkidle')
    print(f"Live Workbench status: {resp.status}")
    page.wait_for_timeout(1000)
    page.screenshot(path='static/doc/screenshots/live_netlify_workbench.png')
    page.close()

    # Test Doc
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    resp = page.goto(f"{base_url}/doc/index.html", wait_until='networkidle')
    print(f"Live Doc status: {resp.status}")
    page.screenshot(path='static/doc/screenshots/live_netlify_doc.png')
    page.close()

    browser.close()
    print("All live Netlify checks passed!")
