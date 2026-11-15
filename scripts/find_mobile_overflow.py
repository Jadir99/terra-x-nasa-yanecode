from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 320, 'height': 568})
    page.goto('http://127.0.0.1:8088/index.html', wait_until='networkidle')
    page.wait_for_timeout(400)
    
    wide = page.evaluate('''() => {
        const winW = window.innerWidth;
        const res = [];
        for (const el of document.querySelectorAll('*')) {
            const rect = el.getBoundingClientRect();
            if (rect.right > winW + 1) {
                res.push({
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    right: Math.round(rect.right),
                    width: Math.round(rect.width)
                });
            }
        }
        return res.slice(0, 10);
    }''')
    for el in wide:
        print(el)
    browser.close()
