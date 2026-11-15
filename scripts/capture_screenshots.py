import time
import os
import shutil
import json
from playwright.sync_api import sync_playwright

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATIC_DOC_DIR = os.path.join(BASE_DIR, "static", "doc", "screenshots")
DOC_DIR = os.path.join(BASE_DIR, "doc", "screenshots")
DOCS_DIR = os.path.join(BASE_DIR, "docs", "screenshots")
ARTIFACT_DIR = r"C:\Users\moham\.gemini\antigravity\brain\5a80e1b3-8245-45e6-83b3-52d9a4052910\screenshots"

for d in [STATIC_DOC_DIR, DOC_DIR, DOCS_DIR, ARTIFACT_DIR]:
    os.makedirs(d, exist_ok=True)

def copy_to_artifact(name):
    src = os.path.join(STATIC_DOC_DIR, name)
    for dst_dir in [DOC_DIR, DOCS_DIR, ARTIFACT_DIR]:
        dst = os.path.join(dst_dir, name)
        if os.path.exists(src):
            shutil.copyfile(src, dst)
    print(f"Captured & Synced everywhere: {name}")

def run():
    print("=== LAUNCHING HIGH-FIDELITY SCREENSHOT RE-CAPTURE ===")
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # -------------------------------------------------------------
        # 1. LANDING PAGE SECTIONS (1440x900 Clean Editorial Frame)
        # -------------------------------------------------------------
        context_landing = browser.new_context(viewport={"width": 1440, "height": 900}, device_scale_factor=1.5)
        page_landing = context_landing.new_page()

        print("Navigating to landing page...")
        page_landing.goto("http://127.0.0.1:8088/")
        page_landing.wait_for_load_state("networkidle")
        time.sleep(1)

        # 01: Hero Section
        page_landing.screenshot(
            path=os.path.join(STATIC_DOC_DIR, "01_landing_hero.png"),
            clip={"x": 0, "y": 0, "width": 1440, "height": 860}
        )
        copy_to_artifact("01_landing_hero.png")

        # 02: Section 03 - About & Tindouf Core Sampling
        page_landing.locator("#about").screenshot(
            path=os.path.join(STATIC_DOC_DIR, "02_landing_about_tindouf.png")
        )
        copy_to_artifact("02_landing_about_tindouf.png")

        # 03: Section 04 - Research Domains & Modules
        page_landing.locator("#research").screenshot(
            path=os.path.join(STATIC_DOC_DIR, "03_landing_research_modules.png")
        )
        copy_to_artifact("03_landing_research_modules.png")

        # 04: Section 05 - Missions & Soil Adaptation Split
        page_landing.locator("#missions").screenshot(
            path=os.path.join(STATIC_DOC_DIR, "04_landing_missions_soil.png")
        )
        copy_to_artifact("04_landing_missions_soil.png")

        # 05: Section 06 - Planetary Trio
        page_landing.locator("#analogs").screenshot(
            path=os.path.join(STATIC_DOC_DIR, "05_landing_planetary_trio.png")
        )
        copy_to_artifact("05_landing_planetary_trio.png")

        # 06: Login Screen
        print("Capturing login screen...")
        page_landing.goto("http://127.0.0.1:8088/login.html")
        page_landing.wait_for_load_state("networkidle")
        time.sleep(1)
        page_landing.screenshot(path=os.path.join(STATIC_DOC_DIR, "06_login_screen.png"))
        copy_to_artifact("06_login_screen.png")

        page_landing.close()
        context_landing.close()

        # -------------------------------------------------------------
        # 2. WORKBENCH VIEWS (FULL HD 1920x1080 DESKTOP FLIGHT DECK)
        # -------------------------------------------------------------
        print("Launching 1920x1080 workbench session (Full 3-column view)...")
        context_wb = browser.new_context(viewport={"width": 1920, "height": 1080}, device_scale_factor=1.2)
        page_wb = context_wb.new_page()

        # Pre-seed authenticated session
        page_wb.goto("http://127.0.0.1:8088/login.html")
        session = {
            "username": "analyst",
            "name": "Dr. Sarah Chen",
            "role": "Lead Astrobiologist & Mission Specialist",
            "clearance": "Level 3 • Planetary Exploration",
            "avatar": "SC",
            "timestamp": 1794590000000
        }
        page_wb.evaluate(f"localStorage.setItem('terra_x_session', '{json.dumps(session)}')")

        # 07: Workbench 2D Discovery (Complete 3 Columns: Explorer, Dual Maps & Candidates, Copilot)
        page_wb.goto("http://127.0.0.1:8088/workbench.html")
        page_wb.wait_for_load_state("networkidle")
        time.sleep(2.5)
        page_wb.screenshot(path=os.path.join(STATIC_DOC_DIR, "07_workbench_2d_discovery.png"))
        copy_to_artifact("07_workbench_2d_discovery.png")

        # 08: Similarity & Decision (Tab 04 Matrix)
        print("Capturing Tab 04 Similarity & Decision...")
        page_wb.click("button[data-tab='view-matrix']")
        time.sleep(1.5)
        page_wb.screenshot(path=os.path.join(STATIC_DOC_DIR, "08_workbench_similarity_decision.png"))
        copy_to_artifact("08_workbench_similarity_decision.png")

        # 09: 3D Terrain Digital Twin (Tab 05)
        print("Capturing Tab 05 3D Terrain Digital Twin...")
        page_wb.click("button[data-tab='view-3d']")
        # Select Moon Shackleton + Earth Lake Iriqui & Draa Basin to test exact user scenario
        page_wb.evaluate("""() => {
            const planetBtn = document.querySelector('#planet-toggle button[data-body="moon"]');
            if (planetBtn) planetBtn.click();
            const aoiSelect = document.getElementById('aoi-select');
            if (aoiSelect) {
                aoiSelect.value = 'shackleton_rim';
                aoiSelect.dispatchEvent(new Event('change'));
            }
            setTimeout(() => {
                const twinSel = document.getElementById('twin-site-select');
                if (twinSel) {
                    twinSel.value = 'iriqui_draa';
                    twinSel.dispatchEvent(new Event('change'));
                }
            }, 600);
        }""")
        time.sleep(3.5)
        page_wb.screenshot(path=os.path.join(STATIC_DOC_DIR, "09_workbench_3d_terrain.png"))
        copy_to_artifact("09_workbench_3d_terrain.png")

        # 10: Report Generator (Tab 08)
        print("Capturing Tab 08 Report Generator...")
        page_wb.click("button[data-tab='view-report']")
        time.sleep(1.5)
        page_wb.screenshot(path=os.path.join(STATIC_DOC_DIR, "10_workbench_report_generator.png"))
        copy_to_artifact("10_workbench_report_generator.png")

        # 11: Scientific AI Copilot Grounded Response
        print("Capturing Copilot Audit in full context...")
        page_wb.click("button[data-tab='view-maps']")
        time.sleep(1.0)
        page_wb.evaluate("""() => {
            const inp = document.getElementById('copilotQuery');
            const snd = document.getElementById('btnCopilotSend');
            if (inp && snd) {
                inp.value = 'Why does Tindouf Basin Sebkha serve as an analog for Martian paleolake soil?';
                snd.click();
            }
        }""")
        time.sleep(3.0)
        page_wb.screenshot(path=os.path.join(STATIC_DOC_DIR, "11_workbench_copilot_audit.png"))
        copy_to_artifact("11_workbench_copilot_audit.png")

        browser.close()
        print("=== ALL SCREENSHOTS SUCCESSFULLY RE-CAPTURED AT 1920x1080 ===")

if __name__ == "__main__":
    run()
