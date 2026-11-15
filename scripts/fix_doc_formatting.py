"""Clean up screenshot card formatting in doc/index.html."""

from pathlib import Path

doc_path = Path("doc/index.html")
html = doc_path.read_text(encoding="utf-8")

# 1. Add CSS for .figure-caption-text
css_to_add = """
    .figure-caption-text {
      margin-top: 10px;
      margin-bottom: 28px;
      font-size: 13px;
      line-height: 1.5;
      color: #536273;
      text-align: center;
    }
"""

if ".figure-caption-text" not in html:
    html = html.replace("/* Lightbox Modal */", css_to_add + "\n    /* Lightbox Modal */")

# 2. Fix the invalid <p><div class="screenshot-card"> nesting
html = html.replace('<p><div class="screenshot-card">', '<div class="screenshot-card">')

# 3. Clean up the trailing figure captions
import re
html = re.sub(
    r'</div></div><br />\s*<em>(Figure \d+:[^<]+)</em></p>',
    r'</div></div>\n<p class="figure-caption-text"><em>\1</em></p>',
    html
)

doc_path.write_text(html, encoding="utf-8")
print("Successfully cleaned up doc/index.html screenshot markup and captions.")
