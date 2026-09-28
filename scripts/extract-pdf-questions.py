"""Extract a reviewable question worksheet from a PDF without answering it."""

import hashlib
import re
import subprocess
import sys
from pathlib import Path

import pdfplumber


LABEL = re.compile(r"(?:^|\s{2,})([^:?!]{2,65}:)(?=\s|$)")
BLANK = re.compile(r"_{3,}|\.{4,}")
QUESTION_START = re.compile(r"^(?:how|what|when|where|why|who|which|do|does|did|are|is|have|has|can|will|would|were|was|if|list|describe|explain|provide|name|date|address|phone|email|signature|initials)\b", re.I)


def clean(value):
    return re.sub(r"\s+", " ", value).strip(" |\t")


def escape(value):
    return value.replace("\\", "\\\\").replace("`", "\\`").replace("[", "\\[").replace("]", "\\]")


def ocr_page(source, number):
    rendered = subprocess.run(["pdftoppm", "-f", str(number), "-l", str(number), "-r", "180", "-singlefile", "-png", str(source)], capture_output=True, check=True)
    result = subprocess.run(["tesseract", "stdin", "stdout"], input=rendered.stdout, capture_output=True, check=True)
    return result.stdout.decode("utf-8", errors="replace")


def candidates(line):
    line = clean(line)
    if not line or len(line) > 250:
        return []
    if "?" in line and ":" in line:
        before, after = line.split("?", 1)
        question = clean(before) + "?"
        trailing_label = clean(after.rsplit(")", 1)[-1].split(":", 1)[0])
        return [question] + ([trailing_label + ":"] if 2 <= len(trailing_label) <= 40 else [])
    labels = [clean(match.group(1)) for match in LABEL.finditer(line)]
    if line.count(":") >= 2:
        # A grid row can contain several labels with only one space between them.
        labels = [clean(part) + ":" for part in re.findall(r"(?:^|(?<=:)\s+)([^:]{2,55}):", line)] or labels
    if labels:
        return [label for label in labels if label[0].isupper() and ". " not in label and not re.search(r"^(?:note|website|www|for agency use only|contact|type of business):$", label, re.I)]
    if "?" in line or BLANK.search(line) or (QUESTION_START.match(line) and len(line) <= 100):
        if len(line) > 150 or (line.endswith(".") and "?" not in line):
            return []
        return [line]
    return []


def worksheet(source):
    digest = hashlib.sha256(source.read_bytes()).hexdigest()
    sections = [f"# Questions from {escape(source.name)}", "", f"Source PDF SHA-256: `{digest}`", "", "Draft extraction for review. OCR can miss, combine, or misread questions. Compare each page with the PDF before using these answers. This worksheet does not map answers to PDF fields.", ""]
    count = 0
    with pdfplumber.open(source) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            embedded = page.extract_text() or ""
            method = "embedded text" if len(clean(embedded)) >= 80 else "OCR"
            extracted = embedded if method == "embedded text" else ocr_page(source, number)
            lines = [clean(line) for line in extracted.splitlines() if clean(line)]
            sections.extend([f"## Page {number}", "", f"Extraction: {method}.", "", "### Possible questions and answer fields", ""])
            page_count = 0
            for line in lines:
                for question in candidates(line):
                    page_count += 1
                    count += 1
                    sections.extend([f"#### P{number:02d}-Q{page_count:03d} · {escape(question)}", "", "Answer:", ""])
            if not page_count:
                sections.extend(["No answer fields detected on this page. Check the source page.", ""])
            sections.extend(["### Extracted page text for comparison", "", "```text", *[line.replace("```", "'''") for line in lines], "```", ""])
    return "\n".join(sections), len(pdf.pages), count


def main():
    if len(sys.argv) != 3:
        raise ValueError("Expected an input PDF and a new output Markdown path.")
    source, output = map(Path, sys.argv[1:])
    if not source.is_file() or source.suffix.lower() != ".pdf":
        raise ValueError("Input must be an existing PDF.")
    content, pages, questions = worksheet(source)
    with output.open("x", encoding="utf-8") as destination:
        destination.write(content)
    print(f"Created {output} with {questions} possible answer items across {pages} pages. Review against the PDF.")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as error:
        print(f"Question extraction failed: {error}", file=sys.stderr)
        sys.exit(1)
