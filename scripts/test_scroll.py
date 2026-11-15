import asyncio
from playwright.async_api import async_playwright

async def test_workbench_scroll():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 720})
        
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
        await page.wait_for_timeout(1500)
        
        print("Current URL:", page.url)
        
        scroll_info = await page.evaluate("""() => {
            const body = document.body;
            const doc = document.documentElement;
            const scrollHeight = Math.max(body.scrollHeight, doc.scrollHeight);
            const clientHeight = window.innerHeight;
            return {
                scrollHeight,
                clientHeight,
                canScroll: scrollHeight > clientHeight,
                initialScrollY: window.scrollY,
                windowInnerHeight: window.innerHeight,
                docClientHeight: doc.clientHeight,
                bodyScrollHeight: body.scrollHeight,
                docScrollHeight: doc.scrollHeight
            };
        }""")
        print("Workbench scroll info:", scroll_info)
        
        await page.evaluate("window.scrollBy(0, 400)")
        await page.wait_for_timeout(300)
        new_y = await page.evaluate("window.scrollY")
        print("Scroll Y after window.scrollBy(0, 400):", new_y)
        
        elements = await page.evaluate("""() => {
            return [
                { sel: 'html', h: document.documentElement.scrollHeight, oh: document.documentElement.offsetHeight, ov: window.getComputedStyle(document.documentElement).overflowY },
                { sel: 'body', h: document.body.scrollHeight, oh: document.body.offsetHeight, ov: window.getComputedStyle(document.body).overflowY },
                { sel: '.app-shell', h: document.querySelector('.app-shell')?.scrollHeight, oh: document.querySelector('.app-shell')?.offsetHeight },
                { sel: '.workbench', h: document.querySelector('.workbench')?.scrollHeight, oh: document.querySelector('.workbench')?.offsetHeight },
                { sel: '.center-stage', h: document.querySelector('.center-stage')?.scrollHeight, oh: document.querySelector('.center-stage')?.offsetHeight },
            ];
        }""")
        for el in elements:
            print("  ", el)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_workbench_scroll())
