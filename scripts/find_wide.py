from playwright.sync_api import sync_playwright
import json

session_data = json.dumps({'username': 'analyst', 'name': 'Dr. Sarah Chen'})

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1024, 'height': 800})
    page.add_init_script(f'localStorage.setItem("terra_x_session", \'{session_data}\');')
    page.goto('http://127.0.0.1:8088/workbench.html', wait_until='networkidle')
    page.wait_for_timeout(500)
    
    wide_els = page.evaluate('''() => {
        return Array.from(document.querySelectorAll('*'))
            .filter(el => el.scrollWidth > 1050 || el.getBoundingClientRect().width > 1050)
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                className: el.className,
                scrollWidth: el.scrollWidth,
                width: Math.round(el.getBoundingClientRect().width)
            })).slice(0, 15);
    }''')
    for el in wide_els:
        print(el)
    browser.close()
