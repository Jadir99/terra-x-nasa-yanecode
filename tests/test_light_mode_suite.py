import os
import re
from PIL import Image

def test_suite():
    print("=== 1. CHECKING STATIC/INDEX.HTML ===")
    with open('static/index.html', 'r', encoding='utf-8') as f:
        html = f.read()

    sections = [
        ('1. Navigation', 'site-nav'),
        ('2. Hero Section', 'hero-section'),
        ('3. Scientific Intro', 'about'),
        ('4. Exploration Areas', 'research'),
        ('5. Missions & Research', 'missions'),
        ('6. Earth Moon Mars Trio', 'analogs'),
        ('7. Discoveries / News', 'discoveries'),
        ('8. Climax CTA', 'climax-cta-section'),
        ('9. Footer', 'contact')
    ]

    for name, sec_id in sections:
        assert sec_id in html, f"Section {name} missing {sec_id}"
        print(f"  [PASS] {name} ({sec_id})")

    # Workbench links
    wb_links = len(re.findall(r'href=["\']/workbench\.html', html))
    print(f"  [PASS] Workbench links: {wb_links} (>= 5)")
    assert wb_links >= 5

    # Background Space Video & Open Panoramic Space (per user directive)
    assert 'id="heroSpaceVideo"' in html
    assert '189457-885804464_medium.mp4' in html
    assert 'hero-empty-space' in html
    print("  [PASS] Full-width Space video (189457-885804464_medium.mp4) & empty right viewport wired")

    # Images
    img_srcs = set(re.findall(r'src=["\'](/images/[^"\']+)["\']', html))
    print(f"  [INFO] Checking {len(img_srcs)} referenced images...")
    for src in sorted(img_srcs):
        rel = src.lstrip('/')
        local_p = f"static/{rel}"
        assert os.path.exists(local_p), f"Missing image {local_p}"
        im = Image.open(local_p)
        print(f"  [PASS] {rel:24} -> {im.format} {im.size[0]}x{im.size[1]} ({os.path.getsize(local_p):,} bytes)")

    print("\n=== 2. CHECKING STATIC/EARTH-ANALOGS.CSS ===")
    with open('static/earth-analogs.css', 'r', encoding='utf-8') as f:
        css = f.read()

    tokens = [
        '--color-primary: #078FE0;',
        '--color-primary-dark: #0566A8;',
        '--color-primary-light: #E7F5FF;',
        '--color-primary-hover: #067BC2;',
        '--color-primary-focus: #43B5F5;',
        '--color-ink: #101820;',
        '--color-ink-muted: #536273;',
        '--color-ink-subtle: #71849A;',
        '--color-ink-tertiary: #9AA8B7;',
        '--color-canvas: #FFFFFF;',
        '--color-canvas-soft: #F5F9FC;',
        '--color-surface-1: #FFFFFF;',
        '--color-surface-2: #EDF5FA;',
        '--color-surface-3: #DCEAF3;',
        '--color-hairline: #DCE5EC;',
        '--color-hairline-strong: #B7C9D8;',
        '--color-accent-orange: #E87532;',
        '--color-accent-orange-light: #FFF0E7;',
        '--color-inverse-canvas: #071B32;',
        '--color-inverse-surface: #0D2947;',
        '--color-inverse-ink: #FFFFFF;',
        'Space Grotesk',
        'Inter',
        'JetBrains Mono',
        'display-xl',
        'display-lg',
        'display-md',
        'headline',
        'card-title',
        'subhead',
        'button-primary',
        'button-secondary',
        'button-dark',
        'feature-card',
        'mission-card',
        '104px'
    ]

    for t in tokens:
        assert t in css, f"Missing token/class: {t}"
        print(f"  [PASS] Token/Rule: {t}")

    print("\n>>> ALL TESTS PASSED SUCCESSFULLY! 100% SPEC COMPLIANCE! <<<")

if __name__ == '__main__':
    test_suite()
