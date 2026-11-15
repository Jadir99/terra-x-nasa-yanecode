import asyncio
from playwright.async_api import async_playwright

async def inspect_heights():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        
        await page.goto("http://localhost:8088/login.html")
        await page.evaluate("""() => {
            localStorage.setItem("terrax_user", JSON.stringify({
                email: "juror@nasa-spaceapps.org",
                role: "juror",
                token: "jury-token-2026"
            }));
        }""")
        await page.goto("http://localhost:8088/workbench.html", wait_until="networkidle")
        await page.wait_for_timeout(1000)
        
        info = await page.evaluate("""() => {
            const getBox = (sel) => {
                const el = document.querySelector(sel);
                if (!el) return null;
                const style = window.getComputedStyle(el);
                return {
                    selector: sel,
                    offsetHeight: el.offsetHeight,
                    scrollHeight: el.scrollHeight,
                    clientHeight: el.clientHeight,
                    overflowY: style.overflowY,
                    height: style.height,
                    maxHeight: style.maxHeight
                };
            };
            return [
                getBox('html'),
                getBox('body'),
                getBox('.app-shell'),
                getBox('.workbench'),
                getBox('.center-stage'),
                getBox('#view-maps'),
                getBox('#candidate-cards')
            ];
        }""")
        for item in info:
            print(item)
            
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_heights())
