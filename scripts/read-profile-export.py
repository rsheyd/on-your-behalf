"""Validate a browser-created OYB profile ZIP and return its data to the CLI."""
import json
import sys
import zipfile


def main(path):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if len(names) != len(set(names)) or len(names) > 12:
            raise ValueError("Invalid OYB export entries.")
        for item in archive.infolist():
            if item.file_size > 1_000_000 or item.compress_size > 1_000_000 or item.is_dir():
                raise ValueError("Invalid OYB export entry size or type.")
        if "manifest.json" not in names or "profile.md" not in names:
            raise ValueError("Missing OYB export files.")
        manifest = json.loads(archive.read("manifest.json"))
        if manifest.get("format") != "oyb-profile" or manifest.get("version") != 1 or not isinstance(manifest.get("documents"), list):
            raise ValueError("Unsupported OYB export format.")
        metadata = manifest["documents"]
        expected = {"manifest.json", "profile.md"} | {f"supporting/{index:04d}.txt" for index in range(1, len(metadata) + 1)}
        if set(names) != expected or len(metadata) > 10:
            raise ValueError("Unexpected OYB export files.")
        profile = archive.read("profile.md").decode("utf-8")
        if len(profile) > 200_000:
            raise ValueError("Profile is too large.")
        documents = []
        for index, document in enumerate(metadata, 1):
            entry = f"supporting/{index:04d}.txt"
            if not isinstance(document, dict) or document.get("path") != entry:
                raise ValueError("Invalid supporting document metadata.")
            item = {key: document.get(key) for key in ("id", "name", "type", "importedAt", "enabled")}
            if not isinstance(item["id"], str) or not item["id"] or not isinstance(item["name"], str) or not item["name"] or not isinstance(item["enabled"], bool):
                raise ValueError("Invalid supporting document metadata.")
            item["text"] = archive.read(entry).decode("utf-8")
            if not item["text"]:
                raise ValueError("Empty supporting document.")
            documents.append(item)
        if sum(len(item["text"]) for item in documents) > 200_000:
            raise ValueError("Supporting documents are too large.")
        print(json.dumps({"profile": profile, "supportingDocuments": documents}))


if __name__ == "__main__":
    try:
        main(sys.argv[1])
    except (ValueError, KeyError, UnicodeError, zipfile.BadZipFile, FileNotFoundError, IndexError) as error:
        print(f"Invalid OYB profile export: {error}", file=sys.stderr)
        sys.exit(1)
