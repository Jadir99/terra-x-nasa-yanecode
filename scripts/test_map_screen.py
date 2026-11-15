import asyncio
import os
from playwright.async_api import async_playwright

artifact_dir = r"C:\Users\moham\.gemini\antigravity\brain\5a80e1b3-8245-45e6-83b3-52d9a4052910\screenshots"

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        context = await browser.new_context(viewport={"width": 1400, "height": 950})
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
        
        # Click on #1 Tindouf pill or #2 Iriqui pill in the navigation bar
        pills = await page.query_selector_all(".map-nav-pill")
        if pills and len(pills) > 0:
            await pills[0].click()
            await page.wait_for_timeout(1000)
            
        map_card = await page.wait_for_selector(".maps-split")
        await map_card.scroll_into_view_if_needed()
        await page.wait_for_timeout(1500)
        
        out_path = os.path.join(artifact_dir, "current_workbench_map_compact.png")
        await map_card.screenshot(path=out_path)
        print("Compact map screenshot saved to", out_path)
        
        # Click expand map button
        btn_expand = await page.query_selector("#btn-toggle-map-size")
        if btn_expand:
            await btn_expand.click()
            await page.wait_for_timeout(1000)
            out_path_exp = os.path.join(artifact_dir, "current_workbench_map_expanded.png")
            await map_card.screenshot(path=out_path_exp)
            print("Expanded map screenshot saved to", out_path_exp)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
