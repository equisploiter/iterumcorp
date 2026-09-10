#!/usr/bin/env python
"""
deck-ppsx · iterumcorp.org

Builds the PowerPoint show (.ppsx) offered next to the PDF on pitch.html.

  · Every page of the PDF becomes one slide-sized picture, so nothing on it can be retyped.
  · The clips listed in pitch.html (data-deck-page / data-deck-box) are placed over their still
    frames as real gifs (they animate in the show) and as embedded video (plays on click).
  · The file is saved as a *show* (opens straight into the slideshow) with a "password to
    modify": PowerPoint opens it read-only unless the password is typed, and it is marked as
    final. This is the strongest protection an Office file has; it is not DRM — someone can still
    copy the pictures out or screen-record. For a file nobody can alter at all, export a video.

    python scripts/deck-ppsx.py --password "…" [--pdf assets/pitch/void-singularcorp.pdf]
        [--html pitch.html] [--out assets/pitch/void-singularcorp.ppsx] [--last N] [--scale 2]

Needs PyMuPDF, python-pptx and Pillow:  python -m pip install pymupdf python-pptx pillow
"""
import argparse, base64, hashlib, io, os, re, secrets, struct, sys, tempfile, zipfile

try:
    import fitz  # PyMuPDF
    from PIL import Image
    from pptx import Presentation
    from pptx.util import Emu
except ImportError as e:
    sys.exit("missing dependency (%s): python -m pip install pymupdf python-pptx pillow" % e)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SPIN = 100000
CUSTOM_XML = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
              '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" '
              'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">'
              '<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="_MarkAsFinal"><vt:bool>true</vt:bool></property>'
              '</Properties>')


def clips_from_html(path):
    """The figures of the clips section: {page: [{box, src, poster, video}]}."""
    html = open(path, encoding="utf-8").read()
    clips = {}
    for m in re.finditer(r'<figure\b[^>]*\bdata-deck-page="(\d+)"[^>]*\bdata-deck-box="([^"]+)"[^>]*>([\s\S]*?)</figure>', html):
        page, box, body = int(m.group(1)), [float(v) for v in m.group(2).split()], m.group(3)
        src = re.search(r'<(?:source|img)\b[^>]*\bsrc="([^"]+)"', body)
        poster = re.search(r'\bposter="([^"]+)"', body)
        if not src or len(box) != 4:
            continue
        clips.setdefault(page, []).append({
            "box": box, "src": src.group(1), "poster": poster.group(1) if poster else None,
            "video": bool(re.search(r"<video\b", body)),
        })
    return clips


def build(pdf, clips, last, scale):
    doc = fitz.open(pdf)
    n = min(len(doc), last) if last else len(doc)
    prs = Presentation()
    r = doc[0].rect
    prs.slide_width = Emu(12192000)                                   # 13.333 in, the 16:9 default
    prs.slide_height = Emu(round(12192000 * r.height / r.width))
    W, H = prs.slide_width, prs.slide_height
    blank = prs.slide_layouts[6]
    for i in range(n):
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(scale, scale), alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
        buf = io.BytesIO(); img.save(buf, "JPEG", quality=86, optimize=True); buf.seek(0)
        slide = prs.slides.add_slide(blank)
        slide.shapes.add_picture(buf, 0, 0, W, H)
        for c in clips.get(i + 1, []):
            x, y, w, h = c["box"]
            left, top, width, height = (Emu(round(W * x / 100)), Emu(round(H * y / 100)), Emu(round(W * w / 100)), Emu(round(H * h / 100)))
            src = os.path.join(ROOT, c["src"])
            if c["video"]:
                poster = os.path.join(ROOT, c["poster"]) if c["poster"] else None
                slide.shapes.add_movie(src, left, top, width, height, poster_frame_image=poster, mime_type="video/mp4")
            else:
                pic = slide.shapes.add_picture(src, left, top, width, height)
                iw, ih = Image.open(src).size                            # cover the box, like the web page
                if iw / ih > width / height:
                    cut = (1 - (width / height) / (iw / ih)) / 2
                    pic.crop_left = pic.crop_right = cut
                else:
                    cut = (1 - (iw / ih) / (width / height)) / 2
                    pic.crop_top = pic.crop_bottom = cut
        print("  slide %02d%s" % (i + 1, "  + %d clip(s)" % len(clips[i + 1]) if clips.get(i + 1) else ""))
    prs.core_properties.title = "Singular · Pitch"
    prs.core_properties.author = "Iterum Corporation"
    return prs, n


def verifier(password):
    """ECMA-376 write protection: SHA-512 of salt + UTF-16LE password, then SPIN rounds with a counter."""
    salt = secrets.token_bytes(16)
    h = hashlib.sha512(salt + password.encode("utf-16-le")).digest()
    for i in range(SPIN):
        h = hashlib.sha512(h + struct.pack("<I", i)).digest()
    return ('<p:modifyVerifier cryptProviderType="rsaAES" cryptAlgorithmClass="hash" cryptAlgorithmType="typeAny" '
            'cryptAlgorithmSid="14" spinCount="%d" saltData="%s" hashData="%s"/>'
            % (SPIN, base64.b64encode(salt).decode(), base64.b64encode(h).decode()))


def finish(tmp, out, password):
    """Turn the saved .pptx into a read-only .ppsx: modify password, mark as final, show content type."""
    ver = verifier(password) if password else ""
    with zipfile.ZipFile(tmp) as zin, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zout:
        names = zin.namelist()
        for item in zin.infolist():
            data = zin.read(item.filename)
            if item.filename == "ppt/presentation.xml" and ver:
                s = data.decode("utf-8")
                s = s.replace("<p:extLst", ver + "<p:extLst", 1) if "<p:extLst" in s else s.replace("</p:presentation>", ver + "</p:presentation>")
                data = s.encode("utf-8")
            elif item.filename == "[Content_Types].xml":
                s = data.decode("utf-8").replace("presentationml.presentation.main+xml", "presentationml.slideshow.main+xml")
                if "docProps/custom.xml" not in names:
                    s = s.replace("</Types>", '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>')
                data = s.encode("utf-8")
            elif item.filename == "_rels/.rels" and "docProps/custom.xml" not in names:
                s = data.decode("utf-8").replace("</Relationships>", '<Relationship Id="rIdCustomProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>')
                data = s.encode("utf-8")
            zout.writestr(item, data)
        if "docProps/custom.xml" not in names:
            zout.writestr("docProps/custom.xml", CUSTOM_XML)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--pdf", default="assets/pitch/void-singularcorp.pdf")
    ap.add_argument("--html", default="pitch.html")
    ap.add_argument("--out", default="assets/pitch/void-singularcorp.ppsx")
    ap.add_argument("--password", default=None, help="password to modify (a random one is made and printed if omitted)")
    ap.add_argument("--last", type=int, default=None, help="stop after this page")
    ap.add_argument("--scale", type=float, default=2.0, help="render scale over the PDF points (2 = 1920x1080 for a 16:9 deck)")
    a = ap.parse_args()
    pdf, html, out = (os.path.join(ROOT, p) for p in (a.pdf, a.html, a.out))
    password = a.password if a.password is not None else secrets.token_urlsafe(9)
    clips = clips_from_html(html)
    print("clips from %s: %s" % (a.html, {k: len(v) for k, v in clips.items()} or "none"))
    prs, n = build(pdf, clips, a.last, a.scale)
    fd, tmp = tempfile.mkstemp(suffix=".pptx"); os.close(fd)
    try:
        prs.save(tmp)
        finish(tmp, out, password)
    finally:
        os.remove(tmp)
    print("wrote %s: %d slides, %.1f MB, password to modify: %s" % (a.out, n, os.path.getsize(out) / 1e6, password if password else "(none)"))


if __name__ == "__main__":
    main()
