#!/usr/bin/env python3
"""
TERRA-X Documentation HTML Builder
Converts PLATFORM_GUIDE.md, REPORT_NASA_SPACE_APPS_2026.md, and RESOURCES.md
into responsive, publication-grade HTML documents with KaTeX math, Mermaid diagrams,
sticky TOC, and screenshot modals.
Outputs to:
  - doc/
  - static/doc/
"""

import os
import re
import shutil
import markdown

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_SCREENSHOTS = os.path.join(BASE_DIR, "docs", "screenshots")

DOC_ROOT = os.path.join(BASE_DIR, "doc")
STATIC_DOC_ROOT = os.path.join(BASE_DIR, "static", "doc")

HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — TERRA-X NASA Space Apps 2026 Documentation</title>
  
  <!-- Favicon -->
  <link rel="icon" type="image/png" href="/images/earth_analogs_logo.png">

  <!-- Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">

  <!-- KaTeX for Scientific Math -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js" onload="renderMathInElement(document.body, {{delimiters: [{{left: '$$', right: '$$', display: true}}, {{left: '$', right: '$', display: false}}], throwOnError: false}});"></script>

  <!-- Mermaid.js for Architecture & Flowcharts -->
  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"></script>
  <script>
    document.addEventListener("DOMContentLoaded", function() {{
      mermaid.initialize({{
        startOnLoad: true,
        theme: 'neutral',
        fontFamily: 'Inter, sans-serif'
      }});
    }});
  </script>

  <style>
    :root {{
      --color-primary: #078FE0;
      --color-primary-dark: #0566A8;
      --color-primary-light: #E7F5FF;
      --color-ink: #101820;
      --color-ink-muted: #536273;
      --color-ink-subtle: #71849A;
      --color-canvas: #FFFFFF;
      --color-canvas-soft: #F5F9FC;
      --color-surface-1: #FFFFFF;
      --color-surface-2: #EDF5FA;
      --color-hairline: #DCE5EC;
      --color-hairline-strong: #B7C9D8;
      --color-accent-orange: #E87532;
      --font-sans: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      --font-display: 'Space Grotesk', sans-serif;
      --font-mono: 'JetBrains Mono', monospace;
    }}

    * {{
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }}

    body {{
      font-family: var(--font-sans);
      color: var(--color-ink);
      background-color: var(--color-canvas);
      line-height: 1.65;
      font-size: 15px;
      -webkit-font-smoothing: antialiased;
    }}

    /* Top Navigation Bar */
    .topbar {{
      position: sticky;
      top: 0;
      z-index: 100;
      height: 56px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid var(--color-hairline);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
    }}

    .brand-wrap {{
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--color-ink);
    }}

    .brand-logo {{
      width: 28px;
      height: 28px;
      object-fit: contain;
    }}

    .brand-title {{
      font-family: var(--font-display);
      font-weight: 700;
      font-size: 16px;
      letter-spacing: -0.01em;
    }}

    .brand-badge {{
      font-family: var(--font-mono);
      font-size: 10px;
      background: var(--color-primary-light);
      color: var(--color-primary);
      padding: 2px 8px;
      border-radius: 999px;
      font-weight: 600;
      border: 1px solid rgba(7, 143, 224, 0.2);
    }}

    .nav-tabs {{
      display: flex;
      align-items: center;
      gap: 6px;
    }}

    .nav-tab {{
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      color: var(--color-ink-muted);
      transition: all 0.15s ease;
    }}

    .nav-tab:hover {{
      color: var(--color-primary);
      background: var(--color-surface-2);
    }}

    .nav-tab.active {{
      color: var(--color-primary);
      background: var(--color-primary-light);
      font-weight: 600;
    }}

    .nav-actions {{
      display: flex;
      align-items: center;
      gap: 10px;
    }}

    .btn-action {{
      padding: 6px 14px;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.15s ease;
    }}

    .btn-secondary {{
      background: var(--color-surface-2);
      color: var(--color-ink);
      border: 1px solid var(--color-hairline);
    }}

    .btn-secondary:hover {{
      background: var(--color-hairline);
    }}

    .btn-primary {{
      background: var(--color-primary);
      color: #FFFFFF;
      border: 1px solid transparent;
    }}

    .btn-primary:hover {{
      background: var(--color-primary-dark);
    }}

    /* Main Docs Layout */
    html, body {{
      overflow-x: hidden;
      width: 100%;
      position: relative;
    }}

    .docs-container {{
      max-width: 1400px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 40px;
      padding: 32px 24px 80px 24px;
      min-width: 0;
      overflow-x: hidden;
      width: 100%;
    }}

    /* Sidebar Navigation */
    .docs-sidebar {{
      position: sticky;
      top: 88px;
      max-height: calc(100vh - 120px);
      overflow-y: auto;
      padding-right: 16px;
    }}

    .sidebar-section-title {{
      font-family: var(--font-mono);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--color-ink-subtle);
      font-weight: 700;
      margin-bottom: 12px;
    }}

    .toc-list {{
      list-style: none;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }}

    .toc-item a {{
      display: block;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 13px;
      color: var(--color-ink-muted);
      text-decoration: none;
      line-height: 1.4;
      border-left: 2px solid transparent;
      transition: all 0.12s ease;
    }}

    .toc-item a:hover {{
      color: var(--color-primary);
      background: var(--color-surface-2);
      border-left-color: var(--color-primary);
    }}

    /* Content Styling */
    .docs-content {{
      min-width: 0;
      max-width: 960px;
      overflow-x: hidden;
    }}

    .article-body {{
      min-width: 0;
      max-width: 100%;
      overflow-x: hidden;
    }}

    .docs-header {{
      padding-bottom: 24px;
      margin-bottom: 32px;
      border-bottom: 1px solid var(--color-hairline);
    }}

    .docs-badge {{
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 999px;
      background: var(--color-surface-2);
      border: 1px solid var(--color-hairline);
      font-family: var(--font-mono);
      font-size: 11px;
      font-weight: 600;
      color: var(--color-primary);
      margin-bottom: 12px;
    }}

    .docs-title {{
      font-family: var(--font-display);
      font-size: 32px;
      font-weight: 700;
      letter-spacing: -0.02em;
      color: var(--color-ink);
      line-height: 1.25;
      margin-bottom: 10px;
    }}

    .docs-meta {{
      font-size: 14px;
      color: var(--color-ink-subtle);
      display: flex;
      align-items: center;
      gap: 16px;
    }}

    /* Markdown Element Typography */
    .docs-content h1 {{
      font-family: var(--font-display);
      font-size: 26px;
      font-weight: 700;
      margin: 40px 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--color-hairline);
      color: var(--color-ink);
    }}

    .docs-content h2 {{
      font-family: var(--font-display);
      font-size: 21px;
      font-weight: 600;
      margin: 32px 0 14px 0;
      color: var(--color-ink);
    }}

    .docs-content h3 {{
      font-family: var(--font-display);
      font-size: 17px;
      font-weight: 600;
      margin: 24px 0 10px 0;
      color: var(--color-ink);
    }}

    .docs-content p {{
      margin-bottom: 16px;
      color: var(--color-ink);
    }}

    .docs-content ul, .docs-content ol {{
      margin-bottom: 20px;
      padding-left: 24px;
    }}

    .docs-content li {{
      margin-bottom: 6px;
    }}

    .docs-content strong {{
      font-weight: 600;
      color: var(--color-ink);
    }}

    .docs-content a {{
      color: var(--color-primary);
      text-decoration: none;
      font-weight: 500;
    }}

    .docs-content a:hover {{
      text-decoration: underline;
    }}

    .docs-content hr {{
      border: 0;
      height: 1px;
      background: var(--color-hairline);
      margin: 36px 0;
    }}

    /* Tables */
    .table-wrapper {{
      width: 100%;
      max-width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      margin: 24px 0;
      border-radius: 8px;
      border: 1px solid var(--color-hairline);
      box-shadow: 0 1px 3px rgba(0,0,0,0.02);
    }}

    .docs-content table {{
      width: 100%;
      border-collapse: collapse;
      margin: 0;
      font-size: 13.5px;
      border: none;
    }}

    .docs-content th {{
      background: var(--color-surface-2);
      color: var(--color-ink);
      font-weight: 600;
      text-align: left;
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-hairline-strong);
      font-family: var(--font-mono);
      font-size: 12px;
      letter-spacing: 0.03em;
    }}

    .docs-content td {{
      padding: 10px 14px;
      border-bottom: 1px solid var(--color-hairline);
      vertical-align: top;
    }}

    .docs-content tr:last-child td {{
      border-bottom: none;
    }}

    .docs-content tr:hover td {{
      background: rgba(7, 143, 224, 0.02);
    }}

    /* Code Blocks */
    .docs-content code {{
      font-family: var(--font-mono);
      font-size: 12.5px;
      background: var(--color-surface-2);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--color-primary-dark);
      border: 1px solid rgba(0,0,0,0.04);
    }}

    .docs-content pre {{
      background: #0B1726;
      color: #E6EDF3;
      padding: 16px 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 20px 0;
      border: 1px solid #1E2D42;
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }}

    .docs-content pre code {{
      background: transparent;
      color: inherit;
      padding: 0;
      border: none;
      font-size: 13px;
      line-height: 1.5;
    }}

    /* Alerts */
    .docs-content blockquote {{
      margin: 20px 0;
      padding: 14px 18px;
      border-left: 4px solid var(--color-primary);
      background: var(--color-surface-2);
      border-radius: 0 8px 8px 0;
    }}

    .docs-content blockquote p:last-child {{
      margin-bottom: 0;
    }}

    .alert-card {{
      padding: 16px 20px;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid;
    }}

    .alert-important {{
      background: rgba(232, 117, 50, 0.06);
      border-color: rgba(232, 117, 50, 0.3);
      border-left: 4px solid var(--color-accent-orange);
    }}

    .alert-important h4 {{
      color: var(--color-accent-orange);
      font-family: var(--font-mono);
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 6px;
    }}

    .docs-content img {{
      max-width: 100%;
      height: auto;
    }}

    /* Screenshots & Visual Cards */
    .screenshot-card {{
      margin: 32px 0;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--color-hairline-strong);
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.08);
      background: #0B1726;
      display: flex;
      flex-direction: column;
    }}

    .screenshot-card img {{
      width: 100%;
      height: auto;
      max-height: 540px;
      object-fit: contain;
      background: #0B1726;
      display: block;
      margin: 0 auto;
      cursor: zoom-in;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }}

    .screenshot-card img:hover {{
      opacity: 0.96;
    }}

    .screenshot-caption {{
      padding: 11px 18px;
      background: #FFFFFF;
      border-top: 1px solid var(--color-hairline);
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--color-ink-muted);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }}

    .screenshot-caption strong {{
      color: var(--color-primary);
    }}

    /* Lightbox Modal */
    .lightbox-modal {{
      display: none;
      position: fixed;
      inset: 0;
      z-index: 9999;
      background: rgba(4, 9, 20, 0.9);
      backdrop-filter: blur(8px);
      align-items: center;
      justify-content: center;
      padding: 24px;
    }}

    .lightbox-modal.active {{
      display: flex;
    }}

    .lightbox-img {{
      max-width: 96%;
      max-height: 94vh;
      border-radius: 8px;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
    }}

    /* Footer */
    .docs-footer {{
      margin-top: 64px;
      padding-top: 28px;
      padding-bottom: 28px;
      border-top: 1px solid var(--color-hairline);
      font-size: 13px;
      color: var(--color-ink-subtle);
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
    }}

    .docs-footer-brand {{
      display: flex;
      align-items: center;
      gap: 14px;
    }}

    .docs-footer img.docs-footer-logo {{
      height: 44px !important;
      max-height: 44px !important;
      width: auto !important;
      object-fit: contain;
      border-radius: 6px;
      display: block;
    }}

    .docs-footer-info {{
      display: flex;
      flex-direction: column;
      gap: 2px;
    }}

    .docs-footer-title {{
      font-weight: 600;
      color: var(--color-ink);
      font-size: 14px;
    }}

    .docs-footer-sub {{
      font-size: 12px;
      color: var(--color-ink-muted);
      font-family: var(--font-mono);
    }}

    .docs-footer-meta {{
      font-size: 12px;
      color: var(--color-ink-subtle);
      text-align: right;
      line-height: 1.5;
    }}

    @media print {{
      .topbar, .docs-sidebar, .nav-actions, .lightbox-modal {{
        display: none !important;
      }}
      .docs-container {{
        display: block;
        padding: 0;
      }}
      .docs-content {{
        max-width: 100%;
      }}
      .screenshot-card {{
        break-inside: avoid;
        box-shadow: none;
        border: 1px solid #ccc;
      }}
      pre, table {{
        break-inside: avoid;
      }}
    }}

    @media (max-width: 900px) {{
      .topbar {{
        height: auto;
        padding: 10px 16px;
        flex-wrap: wrap;
        gap: 10px;
      }}
      .nav-tabs {{
        order: 3;
        width: 100%;
        overflow-x: auto;
        padding-bottom: 4px;
        justify-content: flex-start;
      }}
      .nav-tab {{
        white-space: nowrap;
        font-size: 12px;
        padding: 5px 10px;
      }}
      .nav-actions {{
        gap: 6px;
      }}
      .btn-action span {{
        font-size: 12px;
      }}
      .docs-container {{
        grid-template-columns: 1fr;
        padding: 16px;
      }}
      .docs-sidebar {{
        display: none;
      }}
      .docs-title {{
        font-size: 24px;
      }}
      .docs-footer {{
        flex-direction: column;
        align-items: flex-start;
        gap: 16px;
      }}
      .docs-footer-meta {{
        text-align: left;
      }}
    }}

    @media (max-width: 480px) {{
      .brand-badge {{
        display: none;
      }}
      .nav-actions .btn-secondary {{
        display: none;
      }}
      .docs-content table {{
        display: block;
        overflow-x: auto;
        width: 100%;
      }}
    }}
  </style>
</head>
<body>

  <!-- Topbar -->
  <header class="topbar">
    <a href="/doc/" class="brand-wrap">
      <img src="/images/earth_analogs_logo.png" alt="TERRA-X Logo" class="brand-logo">
      <span class="brand-title">TERRA-X</span>
      <span class="brand-badge">NASA Space Apps 2026</span>
    </a>

    <nav class="nav-tabs">
      <a href="/doc/platform-guide.html" class="nav-tab {active_guide}">Platform Guide</a>
      <a href="/doc/nasa-report.html" class="nav-tab {active_report}">Scientific Report</a>
      <a href="/doc/resources.html" class="nav-tab {active_resources}">Technical Resources</a>
    </nav>

    <div class="nav-actions">
      <a href="/workbench.html" class="btn-action btn-primary">
        <span>Dashboard</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
      </a>
      <a href="/" class="btn-action btn-secondary">Landing Page</a>
      <button onclick="window.print()" class="btn-action btn-secondary" title="Print / Export PDF">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
        <span>Print PDF</span>
      </button>
    </div>
  </header>

  <!-- Main Container -->
  <div class="docs-container">
    
    <!-- Sidebar Table of Contents -->
    <aside class="docs-sidebar">
      <div class="sidebar-section-title">Table of Contents</div>
      <ul class="toc-list" id="sidebarToc">
        <!-- Dynamically populated or rendered -->
      </ul>
    </aside>

    <!-- Main Content Area -->
    <main class="docs-content" id="mainContent">
      <div class="docs-header">
        <div class="docs-badge">NASA Space Apps Challenge 2026 Documentation</div>
        <h1 class="docs-title">{doc_heading}</h1>
        <div class="docs-meta">
          <span>Official Reference Specification</span>
          <span>•</span>
          <span>Version 1.0.0-POC</span>
          <span>•</span>
          <span>NASA PDS &amp; Astrobiology Grounded</span>
        </div>
      </div>

      <!-- Converted Markdown HTML -->
      <article class="article-body">
        {content}
      </article>

      <!-- Footer -->
      <footer class="docs-footer">
        <div class="docs-footer-brand">
          <img src="/images/earth_analogs_logo.png" alt="EARTH ANALOGS / TERRA-X" class="docs-footer-logo" onerror="this.onerror=null; if(this.src.indexOf('images/')===-1) this.src='images/earth_analogs_logo.png'; else if(this.src.indexOf('screenshots/')===-1) this.src='screenshots/earth_analogs_logo.png';">
          <div class="docs-footer-info">
            <span class="docs-footer-title">TERRA-X • Planetary Intelligence &amp; Earth Analogs</span>
            <span class="docs-footer-sub">NASA Space Apps Challenge 2026 Reference Specification</span>
          </div>
        </div>
        <div class="docs-footer-meta">
          <div>Built for Autonomous Planetary Exploration &amp; Grounding</div>
          <div>NASA Planetary Data System (PDS) &amp; Astrobiology Literature Grounded</div>
        </div>
      </footer>
    </main>

  </div>

  <!-- Lightbox Modal -->
  <div class="lightbox-modal" id="lightboxModal" onclick="this.classList.remove('active')">
    <img src="" alt="Enlarged view" class="lightbox-img" id="lightboxImg">
  </div>

  <!-- Interactive Client Script -->
  <script>
    // Generate Sidebar TOC dynamically from h1, h2, h3
    document.addEventListener("DOMContentLoaded", function() {{
      const content = document.getElementById("mainContent");
      const headings = content.querySelectorAll("h1, h2, h3");
      const tocList = document.getElementById("sidebarToc");

      headings.forEach((h, index) => {{
        if (!h.id) {{
          h.id = "sec-" + index + "-" + h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
        }}
        
        // Skip document main title
        if (h.classList.contains("docs-title")) return;

        const li = document.createElement("li");
        li.className = "toc-item";
        if (h.tagName === "H3") li.style.paddingLeft = "14px";
        if (h.tagName === "H1") li.style.fontWeight = "600";

        const a = document.createElement("a");
        a.href = "#" + h.id;
        a.textContent = h.textContent;
        li.appendChild(a);
        tocList.appendChild(li);
      }});

      // Wrap image tags into interactive cards
      const images = content.querySelectorAll("img");
      images.forEach(img => {{
        if (img.classList.contains("brand-logo") || img.classList.contains("lightbox-img")) return;
        
        img.addEventListener("click", () => {{
          const modal = document.getElementById("lightboxModal");
          const modalImg = document.getElementById("lightboxImg");
          modalImg.src = img.src;
          modal.classList.add("active");
        }});
      }});
    }});
  </script>
</body>
</html>
"""

def normalize_markdown(text: str) -> str:
    """Normalize image paths and callout syntax in markdown."""
    # Replace absolute file paths with relative screenshots path
    text = re.sub(r'file:///c:/Users/moham/OneDrive/Bureau/Nasa/docs/screenshots/([a-zA-Z0-9_\-\.]+)', r'screenshots/\1', text, flags=re.IGNORECASE)
    text = re.sub(r'docs/screenshots/([a-zA-Z0-9_\-\.]+)', r'screenshots/\1', text, flags=re.IGNORECASE)
    
    # Fix unescaped underscores inside LaTeX \text{} to prevent KaTeX parse errors
    text = re.sub(r'\\text\{([a-zA-Z0-9]+)_([a-zA-Z0-9]+)\}', r'\\text{\1-\2}', text)

    # Transform mermaid blocks to <div class="mermaid">
    text = re.sub(r'```mermaid\n([\s\S]*?)```', r'<div class="mermaid">\n\1</div>', text)
    
    # Transform GitHub alert callouts: > [!IMPORTANT]
    text = re.sub(r'>\s*\[!IMPORTANT\]\s*\n((?:>.*\n)*)', r'<div class="alert-card alert-important"><h4>Important Scientific Axiom</h4>\1</div>\n', text)
    text = re.sub(r'>\s*\[!NOTE\]\s*\n((?:>.*\n)*)', r'<div class="alert-card alert-note"><h4>Note</h4>\1</div>\n', text)
    
    return text

def convert_and_wrap(md_path: str, title: str, doc_heading: str, doc_type: str) -> str:
    with open(md_path, "r", encoding="utf-8") as f:
        raw_md = f.read()

    normalized_md = normalize_markdown(raw_md)
    body_html = markdown.markdown(
        normalized_md,
        extensions=["fenced_code", "tables", "attr_list", "sane_lists"]
    )

    # Post-process img tags to wrap them in .screenshot-card with universal multi-path fallback
    def img_replacer(match):
        full_tag = match.group(0)
        src_match = re.search(r'src=["\']([^"\']+)["\']', full_tag)
        alt_match = re.search(r'alt=["\']([^"\']*)["\']', full_tag)
        if not src_match:
            return full_tag
        raw_src = src_match.group(1)
        alt = alt_match.group(1) if alt_match else ""
        filename = os.path.basename(raw_src)
        if not filename.lower().endswith(('.png', '.jpg', '.jpeg', '.webp', '.svg')):
            return full_tag
        img_tag = (
            f'<img src="screenshots/{filename}" data-filename="{filename}" alt="{alt}" loading="lazy" '
            f'onerror="this.onerror=null; if(this.src.indexOf(\'/screenshots/\')===-1) this.src=\'/screenshots/\'+this.dataset.filename; '
            f'else if(this.src.indexOf(\'/doc/\')===-1) this.src=\'/doc/screenshots/\'+this.dataset.filename;">'
        )
        return (
            f'<div class="screenshot-card">'
            f'{img_tag}'
            f'<div class="screenshot-caption">'
            f'<span><strong>SCREENSHOT:</strong> {alt or "TERRA-X Operational View"}</span>'
            f'<span style="font-size:11px; color:#71849A;">Click to enlarge</span>'
            f'</div>'
            f'</div>'
        )

    # Match <p><img ...></p> or standalone <img ...> regardless of attribute order
    body_html = re.sub(r'<p>\s*(<img[^>]+>)\s*</p>|(<img[^>]+>)', img_replacer, body_html)

    # Wrap markdown tables in responsive table-wrapper container
    body_html = re.sub(r'(<table>[\s\S]*?</table>)', r'<div class="table-wrapper">\1</div>', body_html)

    active_guide = "active" if doc_type == "guide" else ""
    active_report = "active" if doc_type == "report" else ""
    active_resources = "active" if doc_type == "resources" else ""

    rendered = HTML_TEMPLATE.format(
        title=title,
        doc_heading=doc_heading,
        content=body_html,
        active_guide=active_guide,
        active_report=active_report,
        active_resources=active_resources
    )
    return rendered

def build_all():
    print("=== BUILDING TERRA-X HTML DOCUMENTATION ===")
    
    # 1. Create target directories & stage screenshots and logo PNGs
    target_screenshot_dirs = [
        os.path.join(DOC_ROOT, "screenshots"),
        os.path.join(STATIC_DOC_ROOT, "screenshots"),
        os.path.join(BASE_DIR, "static", "screenshots")
    ]
    for sdir in target_screenshot_dirs:
        os.makedirs(sdir, exist_ok=True)
        if os.path.exists(SRC_SCREENSHOTS):
            for f in os.listdir(SRC_SCREENSHOTS):
                if f.endswith(".png") or f.endswith(".jpg"):
                    shutil.copyfile(os.path.join(SRC_SCREENSHOTS, f), os.path.join(sdir, f))

    # Stage logos across image directories
    target_img_dirs = [
        os.path.join(DOC_ROOT, "images"),
        os.path.join(STATIC_DOC_ROOT, "images"),
        os.path.join(DOC_ROOT, "screenshots"),
        os.path.join(STATIC_DOC_ROOT, "screenshots")
    ]
    for idir in target_img_dirs:
        os.makedirs(idir, exist_ok=True)
        for logo_name in ["earth_analogs_logo.png", "earth_analogs_logo_trans.png", "earth_analogs_logo_white.png"]:
            src_logo = os.path.join(BASE_DIR, "static", "images", logo_name)
            if os.path.exists(src_logo):
                shutil.copyfile(src_logo, os.path.join(idir, logo_name))
    print(f"Screenshots and PNG logos staged across doc/ and static/doc/")

    # 2. Files to generate:
    docs_to_build = [
        {
            "src": os.path.join(BASE_DIR, "PLATFORM_GUIDE.md"),
            "dest_name": "platform-guide.html",
            "title": "Platform User & Technical Guide",
            "heading": "TERRA-X Platform User Guide & Architecture",
            "type": "guide",
            "is_index": True
        },
        {
            "src": os.path.join(BASE_DIR, "REPORT_NASA_SPACE_APPS_2026.md"),
            "dest_name": "nasa-report.html",
            "title": "NASA Space Apps 2026 Scientific Report",
            "heading": "TERRA-X Scientific & Executive Report (NASA Space Apps 2026)",
            "type": "report",
            "is_index": False
        },
        {
            "src": os.path.join(BASE_DIR, "RESOURCES.md"),
            "dest_name": "resources.html",
            "title": "Technical Resources & APIs Blueprint",
            "heading": "TERRA-X Technical Resources & Dataset APIs",
            "type": "resources",
            "is_index": False
        }
    ]

    for item in docs_to_build:
        if not os.path.exists(item["src"]):
            print(f"Warning: source file not found: {item['src']}")
            continue

        print(f"Converting {os.path.basename(item['src'])} -> {item['dest_name']}...")
        html = convert_and_wrap(item["src"], item["title"], item["heading"], item["type"])

        # Write to doc/ and static/doc/
        for root in [DOC_ROOT, STATIC_DOC_ROOT]:
            out_file = os.path.join(root, item["dest_name"])
            with open(out_file, "w", encoding="utf-8") as f:
                f.write(html)
            
            # If default index, also write index.html
            if item["is_index"]:
                idx_file = os.path.join(root, "index.html")
                with open(idx_file, "w", encoding="utf-8") as f:
                    f.write(html)

    print(">>> HTML DOCUMENTATION SUCCESSFULLY BUILT & STAGED! <<<")

if __name__ == "__main__":
    build_all()
