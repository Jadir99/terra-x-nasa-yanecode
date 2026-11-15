from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:8088/doc/")
    page.wait_for_load_state("networkidle")

    imgs = page.query_selector_all(".screenshot-card img")
    print(f"Total screenshot images found: {len(imgs)}")
    for i, img in enumerate(imgs):
        img.scroll_into_view_if_needed()
        page.wait_for_timeout(200)
        box = img.bounding_box()
        src = img.get_attribute("src")
        natural = page.evaluate("(el) => ({ w: el.naturalWidth, h: el.naturalHeight })", img)
        print(f"Img {i+1}: src={src} -> natural: {natural['w']}x{natural['h']} | rendered box: {box['width']:.1f}w x {box['height']:.1f}h")

    # Take a screenshot of the first screenshot card and the workbench card
    page.query_selector(".screenshot-card").screenshot(path="docs/verification_sample_card.png")
    browser.close()
    print("Verification completed successfully!")
