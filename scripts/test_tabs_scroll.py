from playwright.sync_api import sync_playwright
import json

session_data = json.dumps({'username': 'analyst', 'name': 'Dr. Sarah Chen'})

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    page.add_init_script(f'localStorage.setItem("terra_x_session", \'{session_data}\');')
    page.goto('http://127.0.0.1:8088/workbench.html', wait_until='networkidle')
    page.wait_for_timeout(1000)

    tabs = ['view-discovery', 'view-similarity', 'view-3d', 'view-report']
    for tab in tabs:
        page.evaluate(f"() => {{ const b = document.querySelector('button[data-tab=\"{tab}\"]'); if (b) b.click(); }}")
        page.wait_for_timeout(800)
        
        # Test scrolling down 300px
        page.evaluate("window.scrollTo(0, 300);")
        page.wait_for_timeout(200)
        
        info = page.evaluate('''() => {
            return {
                scrollY: window.scrollY,
                docScrollHeight: document.documentElement.scrollHeight,
                clientH: document.documentElement.clientHeight,
                bodyScrollHeight: document.body.scrollHeight,
                centerStageHeight: document.querySelector('.center-stage').offsetHeight,
                canScroll: document.documentElement.scrollHeight > document.documentElement.clientHeight
            };
        }''')
        print(f'Tab {tab}: {info}')
        page.screenshot(path=f'static/doc/screenshots/scroll_test_{tab}.png')
        page.evaluate("window.scrollTo(0, 0);")
        
    browser.close()
