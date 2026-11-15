import asyncio
from playwright.async_api import async_playwright

async def check_page(page, url):
    print(f"\n--- Checking {url} ---")
    await page.goto(url, wait_until="networkidle")
    await page.wait_for_timeout(1000)
    
    # Check if page has horizontal scrollbar
    dims = await page.evaluate("""() => {
        return {
            windowWidth: window.innerWidth,
            docScrollWidth: document.documentElement.scrollWidth,
            bodyScrollWidth: document.body.scrollWidth,
            docClientWidth: document.documentElement.clientWidth
        };
    }""")
    print("Dimensions:", dims)
    
    # Find all elements where scrollWidth > clientWidth or bounding rect right > windowWidth
    overflowing = await page.evaluate("""() => {
        const winW = window.innerWidth;
        const elements = document.querySelectorAll('*');
        const bad = [];
        for (const el of elements) {
            const rect = el.getBoundingClientRect();
            if (rect.right > winW + 1) {
                bad.push({
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    right: rect.right,
                    width: rect.width,
                    scrollWidth: el.scrollWidth,
                    text: (el.innerText || '').slice(0, 40)
                });
            }
        }
        return bad.slice(0, 15);
    }""")
    if overflowing:
        print(f"Found {len(overflowing)} overflowing elements:")
        for item in overflowing:
            print("  ", item)
    else:
        print("No overflowing elements found!")

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1280, "height": 800})
        
        await check_page(page, "http://localhost:8088/doc/index.html")
        await check_page(page, "http://localhost:8088/workbench.html")
        await check_page(page, "http://localhost:8088/")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
