import asyncio
import os
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\moham\.gemini\antigravity\brain\5a80e1b3-8245-45e6-83b3-52d9a4052910\screenshots"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={"width": 1400, "height": 900})
        page = await context.new_page()
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
        await page.goto("http://localhost:8088/workbench.html", wait_until="networkidle")
        await page.wait_for_timeout(2000)
        
        # Click Moon button
        await page.click('button[data-body="moon"]')
        await page.wait_for_timeout(1000)
        
        # Click 3D tab
        await page.click('button[data-tab="view-3d"]')
        await page.wait_for_timeout(2000)
        
        # Select Earth site
        twin_site = await page.input_value("#twin-site-select")
        print("Initial twin earth site:", twin_site)
        
        # Scroll to 3D twin section
        twin_section = await page.wait_for_selector(".twin-grid")
        await twin_section.scroll_into_view_if_needed()
        await page.wait_for_timeout(3000)
        
        out_path = os.path.join(artifact_dir, "current_3d_twin_moon.png")
        await twin_section.screenshot(path=out_path)
        print("Screenshot saved to", out_path)
        
        # Also select iriqui_draa specifically
        await page.select_option("#twin-site-select", "iriqui_draa")
        await page.wait_for_timeout(3000)
        out_path_iriqui = os.path.join(artifact_dir, "current_3d_twin_moon_iriqui.png")
        await twin_section.screenshot(path=out_path_iriqui)
        print("Screenshot saved to", out_path_iriqui)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
