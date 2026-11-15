from playwright.sync_api import sync_playwright
import json

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
    for w in [1024, 1200, 1280, 1366, 1440, 1600]:
        page = browser.new_page(viewport={'width': w, 'height': 800})
        # Set session before loading page
        page.add_init_script(f"localStorage.setItem('terra_x_session', '{session_data}');")
        page.goto('http://127.0.0.1:8088/workbench.html', wait_until='networkidle')
        page.wait_for_timeout(1000)
        
        # Click the 3D terrain tab
        page.evaluate("() => { const b = document.querySelector('button[data-tab=\"view-3d\"]'); if (b) b.click(); }")
        page.wait_for_timeout(1500)
        
        # Trigger copilot query
        page.evaluate("() => { const c = document.querySelector('.chip-btn'); if (c) c.click(); }")
        page.wait_for_timeout(1200)
        
        page.screenshot(path=f'static/doc/screenshots/debug_wb_{w}.png')
        
        info = page.evaluate('''() => {
            const bodyW = document.body.scrollWidth;
            const docW = document.documentElement.scrollWidth;
            const winW = window.innerWidth;
            const sbR = document.querySelector('.sidebar-right') ? document.querySelector('.sidebar-right').getBoundingClientRect() : null;
            const center = document.querySelector('.center-stage') ? document.querySelector('.center-stage').getBoundingClientRect() : null;
            const wb = document.querySelector('.workbench').getBoundingClientRect();
            return {
                windowWidth: winW,
                bodyScrollWidth: bodyW,
                docScrollWidth: docW,
                hasOverflow: docW > winW,
                workbenchWidth: wb.width,
                centerStageWidth: center ? center.width : null,
                sidebarRightWidth: sbR ? sbR.width : null,
                sidebarRightRight: sbR ? sbR.right : null,
            };
        }''')
        print(f'Width {w}: {info}')
        page.close()
    browser.close()
