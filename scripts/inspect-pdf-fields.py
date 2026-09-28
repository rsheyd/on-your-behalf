"""Print a read-only inventory of a PDF's existing AcroForm fields."""

import json
import sys
from pathlib import Path

from pypdf import PdfReader


FIELD_TYPES = {"/Tx": "text", "/Btn": "button", "/Ch": "choice", "/Sig": "signature"}


def field_name(widget):
    parts = []
    current = widget
    seen = set()
    while current is not None:
        identity = id(current)
        if identity in seen:
            break
        seen.add(identity)
        name = current.get("/T")
        if name:
            parts.append(str(name))
        parent = current.get("/Parent")
        current = parent.get_object() if parent else None
    return ".".join(reversed(parts))


def inspect(path):
    reader = PdfReader(path)
    canonical = reader.get_fields() or {}
    fields = {
        name: {"fieldId": name, "type": FIELD_TYPES.get(str(field.get("/FT")), "unknown"), "placements": []}
        for name, field in canonical.items()
    }
    unmatched = []
    for number, page in enumerate(reader.pages, 1):
        for reference in page.get("/Annots", []):
            widget = reference.get_object()
            if widget.get("/Subtype") != "/Widget":
                continue
            name = field_name(widget)
            rectangle = widget.get("/Rect")
            placement = {"page": number, "pdfRect": [float(value) for value in rectangle]} if rectangle and len(rectangle) == 4 else {"page": number, "pdfRect": None}
            if name in fields:
                fields[name]["placements"].append(placement)
            else:
                unmatched.append({"fieldId": name or None, **placement})
    return {"pdf": str(path), "pages": len(reader.pages), "fieldCount": len(fields), "widgetCount": sum(len(field["placements"]) for field in fields.values()) + len(unmatched), "fields": list(fields.values()), "unmatchedWidgets": unmatched}


if __name__ == "__main__":
    try:
        if len(sys.argv) != 2:
            raise ValueError("Expected one PDF path.")
        print(json.dumps(inspect(Path(sys.argv[1])), separators=(",", ":")))
    except Exception as error:
        print(f"PDF inspection failed: {error}", file=sys.stderr)
        sys.exit(1)
