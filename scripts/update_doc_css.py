"""Comprehensive CSS and markup updater for all documentation pages."""

import os
import re
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DOC_FILES = [
    BASE_DIR / "static" / "doc" / "index.html",
    BASE_DIR / "static" / "doc" / "platform-guide.html",
    BASE_DIR / "static" / "doc" / "nasa-report.html",
    BASE_DIR / "static" / "doc" / "resources.html",
    BASE_DIR / "doc" / "index.html",
    BASE_DIR / "doc" / "platform-guide.html",
    BASE_DIR / "doc" / "nasa-report.html",
    BASE_DIR / "doc" / "resources.html",
]

def update_file(path: Path):
    if not path.exists():
        return
    html = path.read_text(encoding="utf-8")

    # 1. Ensure body & html have overflow-x hidden and box-sizing
    html = re.sub(
        r'/\* Main Docs Layout \*/\s*html,\s*body\s*\{[^}]*\}',
        """/* Main Docs Layout */
    html, body {
      overflow-x: hidden;
      max-width: 100vw;
      width: 100%;
      margin: 0;
      padding: 0;
      position: relative;
    }""",
        html
    )

    # 2. Ensure .topbar has max-width: 100vw, overflow-x: clip
    html = re.sub(
        r'\.topbar\s*\{[^}]*\}',
        """.topbar {
      position: sticky;
      top: 0;
      z-index: 100;
      min-height: 56px;
      max-width: 100vw;
      width: 100%;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--color-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      box-sizing: border-box;
      overflow-x: clip;
    }""",
        html,
        count=1
    )

    # 3. Ensure .docs-container has max-width: 1400px and minmax(0, 1fr)
    html = re.sub(
        r'\.docs-container\s*\{[^}]*\}',
        """.docs-container {
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 36px;
      padding: 32px 24px 80px 24px;
      min-width: 0;
      width: 100%;
      box-sizing: border-box;
      overflow-x: clip;
    }""",
        html,
        count=1
    )

    # Content & article sizing
    html = re.sub(
        r'\.docs-content\s*\{[^}]*\}\s*\.article-body\s*\{[^}]*\}',
        """.docs-content {
      min-width: 0 !important;
      max-width: 100% !important;
      width: 100%;
      overflow-x: clip;
    }

    .article-body {
      min-width: 0 !important;
      max-width: 100% !important;
      width: 100%;
      overflow-x: clip;
    }""",
        html
    )

    # Table wrapper overflow constraint
    html = re.sub(
        r'\.table-wrapper\s*\{[^}]*\}',
        """.table-wrapper {
      width: 100% !important;
      max-width: 100% !important;
      overflow-x: auto !important;
      -webkit-overflow-scrolling: touch;
      margin: 24px 0;
      border-radius: 8px;
      border: 1px solid var(--color-hairline);
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
      box-sizing: border-box;
    }""",
        html
    )

    # 4. Ensure .screenshot-card and img styling
    html = re.sub(
        r'/\* Screenshots & Visual Cards \*/\s*\.screenshot-card\s*\{[^}]*\}\s*\.screenshot-card img\s*\{[^}]*\}',
        """/* Screenshots & Visual Cards */
    .screenshot-card {
      margin: 28px 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--color-hairline-strong);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.06);
      background: #F8FAFC;
      display: flex;
      flex-direction: column;
      max-width: 100%;
      width: 100%;
      box-sizing: border-box;
    }

    .screenshot-card img {
      width: 100%;
      max-width: 100%;
      height: auto;
      max-height: 520px;
      object-fit: contain;
      background: #FFFFFF;
      display: block;
      margin: 0 auto;
      cursor: zoom-in;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }""",
        html
    )

    # 5. Ensure .figure-caption-text and .katex-display
    if ".figure-caption-text" not in html:
        caption_css = """
    .figure-caption-text {
      margin-top: 10px;
      margin-bottom: 28px;
      font-size: 13px;
      line-height: 1.5;
      color: #536273;
      text-align: center;
    }
    .katex-display {
      overflow-x: auto !important;
      overflow-y: hidden !important;
      max-width: 100% !important;
      -webkit-overflow-scrolling: touch;
      padding: 6px 0;
    }
"""
        html = html.replace("/* Lightbox Modal */", caption_css + "\n    /* Lightbox Modal */")
    elif ".katex-display" not in html:
        katex_css = """
    .katex-display {
      overflow-x: auto !important;
      overflow-y: hidden !important;
      max-width: 100% !important;
      -webkit-overflow-scrolling: touch;
      padding: 6px 0;
    }
"""
        html = html.replace("/* Lightbox Modal */", katex_css + "\n    /* Lightbox Modal */")

    # 6. Fix invalid <p><div class="screenshot-card"> nesting
    html = html.replace('<p><div class="screenshot-card">', '<div class="screenshot-card">')
    html = re.sub(
        r'</div></div><br />\s*<em>(Figure \d+:[^<]+)</em></p>',
        r'</div></div>\n<p class="figure-caption-text"><em>\1</em></p>',
        html
    )

    # 7. Update breakpoint for .topbar wrap: 1080px instead of 900px, and ensure minmax(0, 1fr)
    html = re.sub(
        r'@media\s*\(\s*max-width:\s*900px\s*\)\s*\{\s*\.topbar',
        '@media (max-width: 1080px) {\n      .topbar',
        html
    )
    html = re.sub(
        r'\.docs-container\s*\{\s*grid-template-columns:\s*1fr;',
        '.docs-container {\n        grid-template-columns: minmax(0, 1fr) !important;',
        html
    )

    path.write_text(html, encoding="utf-8")
    print(f"Updated {path.relative_to(BASE_DIR)}")

for f in DOC_FILES:
    update_file(f)
