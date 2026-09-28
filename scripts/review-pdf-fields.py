"""Propose nearby labels and create a human-review report for existing PDF fields."""

import csv
import hashlib
import html
import io
import json
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

import pdfplumber
from PIL import Image


def ocr_words(image, width, height):
    process = subprocess.run(["tesseract", str(image), "stdout", "tsv"], capture_output=True, text=True, check=True)
    rows = csv.DictReader(io.StringIO(process.stdout), delimiter="\t")
    words = []
    with Image.open(image) as bitmap:
        scale_x, scale_y = width / bitmap.width, height / bitmap.height
    for row in rows:
        value = row.get("text", "").strip()
        if row.get("level") != "5" or not value or float(row.get("conf", -1)) < 0:
            continue
        words.append({"text": value, "x0": float(row["left"]) * scale_x, "x1": (float(row["left"]) + float(row["width"])) * scale_x, "top": float(row["top"]) * scale_y, "bottom": (float(row["top"]) + float(row["height"])) * scale_y})
    return words


def proposals(rect, page_height, words):
    x0, _, x1, y1 = rect
    top = page_height - y1
    near = [word for word in words if x0 - 8 <= (word["x0"] + word["x1"]) / 2 <= x1 + 8 and top - 15 <= word["top"] <= top + 20]
    lines = defaultdict(list)
    for word in near:
        lines[round(word["top"] / 5) * 5].append(word)
    candidates = []
    for line in lines.values():
        ordered = sorted(line, key=lambda word: word["x0"])
        text = " ".join(word["text"] for word in ordered).strip()
        if text:
            distance = abs(sum(word["top"] for word in ordered) / len(ordered) - top)
            candidates.append((distance, text))
    return [text for _, text in sorted(candidates)[:3]]


def render_page(source, number, destination):
    subprocess.run(["pdftoppm", "-f", str(number), "-l", str(number), "-r", "180", "-singlefile", "-png", str(source), str(destination.with_suffix(""))], check=True, capture_output=True)


def report(source, directory):
    inventory_process = subprocess.run([sys.executable, str(Path(__file__).with_name("inspect-pdf-fields.py")), str(source)], check=True, capture_output=True, text=True)
    inventory = json.loads(inventory_process.stdout)
    if not inventory["fieldCount"]:
        raise ValueError("This PDF has no existing form fields to review.")
    directory.mkdir(parents=True, exist_ok=False)
    by_page = defaultdict(list)
    for field in inventory["fields"]:
        for placement in field["placements"]:
            by_page[placement["page"]].append((field, placement))
    entries = []
    sections = []
    with pdfplumber.open(source) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            page_fields = by_page[number]
            if not page_fields:
                sections.append(f"<details><summary>Page {number}: no existing fields</summary></details>")
                continue
            image = directory / f"page-{number:02d}.png"
            render_page(source, number, image)
            words = page.extract_words()
            text_source = "PDF text"
            if not words:
                words = ocr_words(image, page.width, page.height)
                text_source = "OCR"
            rows = []
            overlays = []
            for field, placement in page_fields:
                rect = placement["pdfRect"]
                candidates = proposals(rect, page.height, words) if rect else []
                entry = {"fieldId": field["fieldId"], "type": field["type"], "page": number, "pdfRect": rect, "label": candidates[0] if candidates else "", "labelCandidates": candidates, "reviewStatus": "unreviewed"}
                entries.append(entry)
                identifier = html.escape(field["fieldId"])
                options = " / ".join(html.escape(value) for value in candidates) or "No nearby text"
                rows.append(f"<tr><td>{identifier}</td><td>{html.escape(field['type'])}</td><td>{options}</td><td>Unreviewed</td></tr>")
                if rect:
                    x0, y0, x1, y1 = rect
                    overlays.append(f'<span class="box" title="{identifier}" style="left:{x0 / page.width * 100:.3f}%;top:{(page.height - y1) / page.height * 100:.3f}%;width:{(x1 - x0) / page.width * 100:.3f}%;height:{(y1 - y0) / page.height * 100:.3f}%"></span>')
            sections.append(f'<details open><summary>Page {number}: {len(page_fields)} fields; labels from {text_source}</summary><div class="page"><img src="{image.name}" alt="Page {number} PDF preview">{"".join(overlays)}</div><table><thead><tr><th>Field ID</th><th>Type</th><th>Nearby text candidates</th><th>Status</th></tr></thead><tbody>{"".join(rows)}</tbody></table></details>')
    result = {"format": "oyb-field-review", "version": 1, "pdfSha256": hashlib.sha256(source.read_bytes()).hexdigest(), "pageCount": inventory["pages"], "fieldCount": inventory["fieldCount"], "fields": entries, "unmatchedWidgets": inventory["unmatchedWidgets"], "note": "All labels are guesses and all fields are unreviewed. Edit labels in this JSON, then explicitly select field IDs for approve-fields."}
    (directory / "review.json").write_text(json.dumps(result, indent=2) + "\n")
    style = "body{font:15px system-ui;margin:2rem;max-width:1200px}details{margin:1rem 0;border:1px solid #aaa;padding:1rem}summary{font-weight:700;cursor:pointer}.page{position:relative;max-width:900px}.page img{display:block;width:100%}.box{position:absolute;border:2px solid #d00;box-sizing:border-box;pointer-events:none}table{border-collapse:collapse;width:100%;margin-top:1rem}td,th{border:1px solid #aaa;padding:.4rem;text-align:left;vertical-align:top}td:first-child{white-space:nowrap}"
    (directory / "review.html").write_text(f'<!doctype html><html lang="en"><meta charset="utf-8"><title>OYB PDF field review</title><style>{style}</style><h1>PDF field review</h1><p>{inventory["fieldCount"]} existing fields across {inventory["pages"]} pages. Red boxes show field positions. Nearby text is a guess; no field is approved. Edit labels in review.json before selecting field IDs with approve-fields.</p>{"".join(sections)}</html>')
    return {"fields": len(entries), "pages": inventory["pages"], "review": str(directory / "review.json"), "report": str(directory / "review.html")}


if __name__ == "__main__":
    try:
        if len(sys.argv) != 3:
            raise ValueError("Expected input PDF and a new review directory.")
        print(json.dumps(report(Path(sys.argv[1]), Path(sys.argv[2]))))
    except Exception as error:
        print(f"PDF review failed: {error}", file=sys.stderr)
        sys.exit(1)
