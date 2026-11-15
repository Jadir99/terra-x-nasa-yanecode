"""Comprehensive platform audit and tour script checking dimensions, overflow, and scrolling."""

import time
from playwright.sync_api import sync_playwright

def run_tour():
    results = {}
    with sync_playwright() as p:
        browser = p.chromium.launch()

        # VIEWPORTS TO AUDIT
        viewports = [
            ("desktop_1920", 1920, 1080),
            ("laptop_1280", 1280, 800),
            ("tablet_1024", 1024, 768),
            ("mobile_390", 390, 844),
        ]

        pages_to_test = [
            ("landing", "http://127.0.0.1:8088/"),
            ("workbench", "http://127.0.0.1:8088/workbench.html"),
            ("login", "http://127.0.0.1:8088/login.html"),
            ("atlas", "http://127.0.0.1:8088/atlas/index.html"),
            ("doc", "http://127.0.0.1:8088/doc/index.html"),
        ]

        for vp_name, width, height in viewports:
            print(f"\n=================== AUDITING VIEWPORT: {vp_name} ({width}x{height}) ===================")
            ctx = browser.new_context(viewport={"width": width, "height": height})
            page = ctx.new_page()

            # Pre-seed session for workbench
            session_json = '{"username":"analyst","name":"Dr. Sarah Chen","role":"Lead Astrobiologist","clearance":"Level 3","avatar":"SC","timestamp":1794590000000}'
            page.goto("http://127.0.0.1:8088/login.html")
            page.evaluate(f"localStorage.setItem('terra_x_session', '{session_json}')")

            for page_name, url in pages_to_test:
                page.goto(url)
                page.wait_for_load_state("networkidle")
                time.sleep(1.0)

                # Check horizontal overflow
                overflow_info = page.evaluate("""() => {
                    const docEl = document.documentElement;
                    const body = document.body;
                    const scrollW = Math.max(docEl.scrollWidth, body.scrollWidth);
                    const innerW = window.innerWidth;
                    const hasHorizontalOverflow = scrollW > innerW + 1; // 1px threshold for subpixel rounding

                    // Find overflowing elements if any
                    const overflowingElements = [];
                    if (hasHorizontalOverflow) {
                        const all = document.querySelectorAll('*');
                        for (let el of all) {
                            const rect = el.getBoundingClientRect();
                            if (rect.right > innerW + 2) {
                                overflowingElements.push({
                                    tag: el.tagName,
                                    class: el.className,
                                    id: el.id,
                                    right: Math.round(rect.right),
                                    width: Math.round(rect.width)
                                });
                                if (overflowingElements.length >= 5) break;
                            }
                        }
                    }

                    return {
                        scrollWidth: scrollW,
                        innerWidth: innerW,
                        hasHorizontalOverflow,
                        overflowingElements
                    };
                }""")

                # Special check for landing: Sign In button wrapping
                sign_in_wrapping = None
                if page_name == "landing":
                    sign_in_wrapping = page.evaluate("""() => {
                        const signBtn = document.querySelector('.nav-action-signin');
                        if (!signBtn) return null;
                        const rect = signBtn.getBoundingClientRect();
                        const isVisible = rect.width > 0 && rect.height > 0 && window.getComputedStyle(signBtn).display !== 'none';
                        return {
                            visible: isVisible,
                            width: Math.round(rect.width),
                            height: Math.round(rect.height),
                            lineHeight: window.getComputedStyle(signBtn).lineHeight,
                            fontSize: window.getComputedStyle(signBtn).fontSize
                        };
                    }""")

                # Special check for workbench: 3D Twin & scrolling
                workbench_info = None
                if page_name == "workbench":
                    # Switch to 3D tab
                    page.click("button[data-tab='view-3d']")
                    time.sleep(1.5)
                    workbench_info = page.evaluate("""() => {
                        const cs = document.querySelector('.center-stage');
                        const p3d = document.getElementById('plot-3d-aoi');
                        const sr = document.querySelector('.sidebar-right');
                        const canScrollVertical = cs ? cs.scrollHeight > cs.clientHeight : false;
                        const srRect = sr ? sr.getBoundingClientRect() : null;
                        const isSrVisible = srRect ? (srRect.right <= window.innerWidth && srRect.left >= 0) : false;
                        return {
                            canScrollVertical,
                            centerStageScrollHeight: cs ? cs.scrollHeight : 0,
                            centerStageClientHeight: cs ? cs.clientHeight : 0,
                            sidebarRightVisible: isSrVisible,
                            sidebarRightRight: srRect ? Math.round(srRect.right) : 0,
                            windowInnerWidth: window.innerWidth
                        };
                    }""")

                status_str = "❌ OVERFLOW" if overflow_info["hasHorizontalOverflow"] else "✅ CLEAN"
                print(f"[{vp_name}] {page_name.upper():<12} -> {status_str} (scrollW: {overflow_info['scrollWidth']}, innerW: {overflow_info['innerWidth']})")
                if overflow_info["hasHorizontalOverflow"]:
                    print(f"   Overflowing elements: {overflow_info['overflowingElements']}")
                if sign_in_wrapping and sign_in_wrapping["visible"]:
                    print(f"   Sign In button: width={sign_in_wrapping['width']}px, height={sign_in_wrapping['height']}px")
                if workbench_info:
                    print(f"   Workbench: vertical scrollable={workbench_info['canScrollVertical']} ({workbench_info['centerStageScrollHeight']}px/{workbench_info['centerStageClientHeight']}px), Copilot inside viewport={workbench_info['sidebarRightVisible']}")

            ctx.close()
        browser.close()

if __name__ == "__main__":
    run_tour()
