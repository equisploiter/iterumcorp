#!/usr/bin/env python
"""
deck-boxes · iterumcorp.org

Prints, for every page of a PDF, the images it contains and where they sit, as the
percentages pitch.html expects in data-deck-box ("left top width height"). Run it after
replacing assets/pitch/void-singularcorp.pdf to find the still frames the clips replace
(PowerPoint exports a video or gif as its first frame), then update the figures in the
clips section of pitch.html.

    python scripts/deck-boxes.py assets/pitch/void-singularcorp.pdf [page ...]

Needs PyMuPDF:  python -m pip install pymupdf
"""
import sys

try:
    import fitz  # PyMuPDF
except ImportError:
    sys.exit("PyMuPDF is missing: python -m pip install pymupdf")

if len(sys.argv) < 2:
    sys.exit(__doc__)

doc = fitz.open(sys.argv[1])
only = {int(p) for p in sys.argv[2:]}
for i, page in enumerate(doc, 1):
    if only and i not in only:
        continue
    w, h = page.rect.width, page.rect.height
    text = " | ".join(page.get_text().split())[:70]
    print(f"\npage {i:02d}  {w:.0f}x{h:.0f}  {text}")
    for im in page.get_image_info(xrefs=True):
        x0, y0, x1, y1 = im["bbox"]
        if (x1 - x0) * (y1 - y0) < w * h * 0.02:   # icons and ornaments
            continue
        box = f"{x0 / w * 100:.2f} {y0 / h * 100:.2f} {(x1 - x0) / w * 100:.2f} {(y1 - y0) / h * 100:.2f}"
        print(f"  {im['width']:>5}x{im['height']:<5}  data-deck-page=\"{i}\" data-deck-box=\"{box}\"")
