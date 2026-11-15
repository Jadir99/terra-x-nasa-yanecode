from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 390, 'height': 844})
    page.goto('http://127.0.0.1:8088/')
    page.wait_for_load_state('networkidle')

    sections = page.query_selector_all('section')
    for s in sections:
        sid = s.get_attribute('id') or 'no-id'
        box = s.bounding_box()
        if box:
            print(f"Section {sid}: w={box['width']:.1f}, h={box['height']:.1f}")

    imgs = page.query_selector_all('img')
    bad_imgs = []
    for im in imgs:
        if im.is_visible():
            box = im.bounding_box()
            if box and box['width'] > 390:
                bad_imgs.append((im.get_attribute('src'), box['width']))
    print('Imgs wider than 390px on mobile:', bad_imgs)

    browser.close()
