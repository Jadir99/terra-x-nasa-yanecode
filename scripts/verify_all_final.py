import json
from playwright.sync_api import sync_playwright

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

    # =========================================================================
    # TEST 1: Landing Page Navbar ("Sign In" wrapping check across viewports)
    # =========================================================================
    print("--- TEST 1: Landing Page Navbar ---")
    for w in [375, 768, 1024, 1200, 1240, 1280, 1366, 1920]:
        page = browser.new_page(viewport={'width': w, 'height': 800})
        page.goto('http://127.0.0.1:8088/index.html', wait_until='networkidle')
        page.wait_for_timeout(400)
        
        info = page.evaluate('''() => {
            const signinBtn = document.querySelector('.nav-actions .nav-action-signin');
            const workbenchBtn = document.querySelector('.nav-actions .nav-action-workbench');
            const hamburger = document.querySelector('#mobileMenuToggle');
            const navMenu = document.querySelector('#navMenu');
            
            let signinWrapped = false;
            if (signinBtn && window.getComputedStyle(signinBtn).display !== 'none') {
                const span = signinBtn.querySelector('span');
                if (span) {
                    const rect = span.getBoundingClientRect();
                    // If span height is > 25px, it wrapped to 2 lines
                    if (rect.height > 25) signinWrapped = true;
                }
            }
            return {
                docScrollW: document.documentElement.scrollWidth,
                winW: window.innerWidth,
                hasDocOverflow: document.documentElement.scrollWidth > window.innerWidth,
                signinVisible: signinBtn ? window.getComputedStyle(signinBtn).display !== 'none' : false,
                signinWrapped: signinWrapped,
                hamburgerVisible: hamburger ? window.getComputedStyle(hamburger).display !== 'none' : false
            };
        }''')
        print(f"Viewport {w}px: {info}")
        if w in [1280, 375]:
            page.screenshot(path=f'static/doc/screenshots/final_landing_{w}.png')
        page.close()

    # =========================================================================
    # TEST 2: Documentation Guide Zero Overflow & Images
    # =========================================================================
    print("\n--- TEST 2: Documentation Guide ---")
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://127.0.0.1:8088/doc/index.html', wait_until='networkidle')
    page.wait_for_timeout(500)
    
    doc_info = page.evaluate('''() => {
        return {
            scrollWidth: document.documentElement.scrollWidth,
            clientWidth: document.documentElement.clientWidth,
            hasOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth
        };
    }''')
    print(f"Doc Guide 1280px: {doc_info}")
    page.screenshot(path='static/doc/screenshots/final_doc_1280.png')
    page.close()

    # =========================================================================
    # TEST 3: Workbench Scrolling & 3D Terrain Layout
    # =========================================================================
    print("\n--- TEST 3: Workbench Page Scrolling & 3D Twin ---")
    for w in [1024, 1280, 1366, 1600]:
        page = browser.new_page(viewport={'width': w, 'height': 800})
        page.add_init_script(f'localStorage.setItem("terra_x_session", \'{session_data}\');')
        page.goto('http://127.0.0.1:8088/workbench.html', wait_until='networkidle')
        page.wait_for_timeout(1000)
        
        # Click 3D tab
        page.evaluate("() => { const b = document.querySelector('button[data-tab=\"view-3d\"]'); if (b) b.click(); }")
        page.wait_for_timeout(1500)
        
        # Test scroll
        page.evaluate("window.scrollTo(0, 250);")
        page.wait_for_timeout(300)
        
        wb_info = page.evaluate('''() => {
            const docW = document.documentElement.scrollWidth;
            const winW = window.innerWidth;
            const sbR = document.querySelector('.sidebar-right');
            const p1 = document.querySelector('#plot-3d-aoi');
            const p2 = document.querySelector('#plot-3d-earth');
            return {
                windowWidth: winW,
                docScrollWidth: docW,
                hasOverflow: docW > winW,
                scrollY: window.scrollY,
                scrollHeight: document.documentElement.scrollHeight,
                clientH: document.documentElement.clientHeight,
                sidebarRightRight: sbR ? Math.round(sbR.getBoundingClientRect().right) : null,
                p1Width: p1 ? Math.round(p1.getBoundingClientRect().width) : null,
                p2Width: p2 ? Math.round(p2.getBoundingClientRect().width) : null
            };
        }''')
        print(f"Workbench {w}px: {wb_info}")
        page.screenshot(path=f'static/doc/screenshots/final_workbench_{w}.png')
        page.close()

    # =========================================================================
    # TEST 4: Atlas Demo Styling & Tabs
    # =========================================================================
    print("\n--- TEST 4: Atlas Demo ---")
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.goto('http://127.0.0.1:8088/atlas/index.html#mission', wait_until='networkidle')
    page.wait_for_timeout(800)
    page.screenshot(path='static/doc/screenshots/final_atlas_mission.png')
    
    page.goto('http://127.0.0.1:8088/atlas/index.html#analyse', wait_until='networkidle')
    page.wait_for_timeout(800)
    page.screenshot(path='static/doc/screenshots/final_atlas_analyse.png')
    
    page.goto('http://127.0.0.1:8088/atlas/index.html#sources', wait_until='networkidle')
    page.wait_for_timeout(800)
    page.screenshot(path='static/doc/screenshots/final_atlas_sources.png')
    
    atlas_info = page.evaluate('''() => {
        const primaryColor = window.getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim();
        const navyColor = window.getComputedStyle(document.documentElement).getPropertyValue('--color-navy').trim();
        return {
            primaryColor,
            navyColor,
            docScrollW: document.documentElement.scrollWidth,
            winW: window.innerWidth,
            hasOverflow: document.documentElement.scrollWidth > window.innerWidth
        };
    }''')
    print(f"Atlas Design Tokens & Layout: {atlas_info}")
    page.close()

    browser.close()
    print("\nAll Playwright verifications completed successfully!")
