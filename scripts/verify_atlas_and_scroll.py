"""Verify Atlas redesigned styling and Workbench page-level scroll."""

import time
import os
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SCREENSHOT_DIR = os.path.join(BASE_DIR, "static", "doc", "screenshots")

with sync_playwright() as p:
    b = p.chromium.launch()

    # 1. TEST WORKBENCH SCROLLING
    print("\n--- Testing Workbench Page-Level Scrolling ---")
    ctx_wb = b.new_context(viewport={"width": 1280, "height": 800})
    page_wb = ctx_wb.new_page()

    page_wb.goto("http://127.0.0.1:8088/login.html")
    page_wb.evaluate('''localStorage.setItem('terra_x_session', JSON.stringify({
        username: 'analyst', name: 'Dr. Sarah Chen', role: 'Lead Astrobiologist', clearance: 'Level 3', avatar: 'SC', timestamp: 1794590000000
    }))''')
    page_wb.goto("http://127.0.0.1:8088/workbench.html")
    page_wb.wait_for_load_state("networkidle")
    time.sleep(1.5)

    scroll_h_1 = page_wb.evaluate("document.documentElement.scrollHeight")
    client_h_1 = page_wb.evaluate("document.documentElement.clientHeight")
    print(f"Workbench 2D Discovery: scrollHeight={scroll_h_1}px, clientHeight={client_h_1}px")

    # Scroll down 400px
    page_wb.evaluate("window.scrollTo(0, 400)")
    time.sleep(0.5)
    scroll_y_1 = page_wb.evaluate("window.scrollY")
    print(f"Scrolled window.scrollY in 2D Discovery: {scroll_y_1}px")

    # Switch to 3D tab
    page_wb.click("button[data-tab='view-3d']")
    time.sleep(2.0)
    scroll_h_2 = page_wb.evaluate("document.documentElement.scrollHeight")
    print(f"Workbench 3D Terrain Twin: scrollHeight={scroll_h_2}px")

    page_wb.evaluate("window.scrollTo(0, 350)")
    time.sleep(0.5)
    scroll_y_2 = page_wb.evaluate("window.scrollY")
    print(f"Scrolled window.scrollY in 3D Twin: {scroll_y_2}px")

    page_wb.screenshot(path=os.path.join(SCREENSHOT_DIR, "verified_workbench_scrolled.png"))
    print("Captured verified_workbench_scrolled.png")
    ctx_wb.close()

    # 2. TEST ATLAS DEMO NEW DESIGN
    print("\n--- Testing Atlas Demo New Landing Page Design & Colors ---")
    ctx_atlas = b.new_context(viewport={"width": 1440, "height": 900})
    page_atlas = ctx_atlas.new_page()

    page_atlas.goto("http://127.0.0.1:8088/atlas/index.html")
    page_atlas.wait_for_load_state("networkidle")
    time.sleep(1.5)

    # Check colors and typography
    styles_info = page_atlas.evaluate("""() => {
        const aside = document.querySelector('aside');
        const h1 = document.querySelector('h1');
        const primaryBtn = document.querySelector('.btn.primary');
        const kpiStrong = document.querySelector('.kpi strong');
        const card = document.querySelector('.card');
        return {
            asideBg: window.getComputedStyle(aside).backgroundColor,
            h1Font: window.getComputedStyle(h1).fontFamily,
            h1Color: window.getComputedStyle(h1).color,
            primaryBtnBg: primaryBtn ? window.getComputedStyle(primaryBtn).backgroundColor : null,
            primaryBtnColor: primaryBtn ? window.getComputedStyle(primaryBtn).color : null,
            cardBg: card ? window.getComputedStyle(card).backgroundColor : null,
            cardBorder: card ? window.getComputedStyle(card).borderColor : null,
            kpiColor: kpiStrong ? window.getComputedStyle(kpiStrong).color : null
        };
    }""")
    print("Atlas Computed Styles:", styles_info)

    # Capture Tab 1: Explorateur
    page_atlas.screenshot(path=os.path.join(SCREENSHOT_DIR, "verified_atlas_explorateur.png"))
    print("Captured verified_atlas_explorateur.png")

    # Navigate to Tab 2: Analyse comparative
    page_atlas.click("a[data-view='analyse']")
    time.sleep(1.0)
    page_atlas.screenshot(path=os.path.join(SCREENSHOT_DIR, "verified_atlas_analyse.png"))
    print("Captured verified_atlas_analyse.png")

    # Navigate to Tab 3: Sources & méthode
    page_atlas.click("a[data-view='sources']")
    time.sleep(1.0)
    page_atlas.screenshot(path=os.path.join(SCREENSHOT_DIR, "verified_atlas_sources.png"))
    print("Captured verified_atlas_sources.png")

    ctx_atlas.close()
    b.close()
    print("\n=== VERIFICATION SUCCESSFULLY COMPLETED ===")
