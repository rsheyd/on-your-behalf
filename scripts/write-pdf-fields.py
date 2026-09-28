"""Write reviewed OYB text answers to a copy of an AcroForm PDF and verify them."""

import json
import os
import sys
import tempfile
from pathlib import Path

from pypdf import PdfReader, PdfWriter


def main():
    if len(sys.argv) != 3:
        raise ValueError("Expected input and output PDF paths.")
    source, destination = map(Path, sys.argv[1:])
    if source.resolve() == destination.resolve() or destination.exists():
        raise ValueError("The output must be a new path distinct from the input PDF.")
    values = json.load(sys.stdin).get("values", {})
    if not isinstance(values, dict) or not values or any(not isinstance(name, str) or not isinstance(value, str) or not value.strip() for name, value in values.items()):
        raise ValueError("Expected non-empty text values keyed by field name.")
    reader = PdfReader(source)
    fields = reader.get_fields() or {}
    missing = sorted(set(values) - set(fields))
    if missing:
        raise ValueError(f"PDF fields not found: {missing}")
    if any(fields[name].get("/FT") != "/Tx" for name in values):
        raise ValueError("This preview fills text fields only.")
    writer = PdfWriter()
    writer.clone_document_from_reader(reader)
    appearances = {name: (value, "/Helv", 9) for name, value in values.items()}
    writer.update_page_form_field_values(None, appearances, auto_regenerate=False)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=destination.parent, prefix=".oyb-", suffix=".pdf", delete=False) as stream:
        temporary = Path(stream.name)
    try:
        with temporary.open("wb") as stream:
            writer.write(stream)
        written = PdfReader(temporary)
        written_fields = written.get_fields() or {}
        if set(written_fields) != set(fields):
            raise ValueError("The PDF field tree changed unexpectedly.")
        for name, expected in values.items():
            if str(written_fields[name].get("/V", "")) != expected:
                raise ValueError(f"Stored value mismatch for {name}.")
        verified_widgets = set()
        for page in written.pages:
            for annotation in page.get("/Annots", []):
                widget = annotation.get_object()
                if widget.get("/Subtype") != "/Widget":
                    continue
                parent = widget.get("/Parent")
                effective = parent.get_object() if parent else widget
                name = str(widget.get("/T") or effective.get("/T") or "")
                if name not in values:
                    continue
                if str(widget.get("/V", effective.get("/V", ""))) != values[name]:
                    raise ValueError(f"Widget value mismatch for {name}.")
                appearance = widget.get("/AP", {}).get("/N")
                if not appearance or not appearance.get_object().get_data():
                    raise ValueError(f"Missing visible appearance for {name}.")
                verified_widgets.add(name)
        if verified_widgets != set(values):
            raise ValueError("One or more filled fields have no page widget.")
        os.replace(temporary, destination)
    finally:
        temporary.unlink(missing_ok=True)
    print(json.dumps({"filled": len(values), "fieldIds": sorted(values)}))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)
