# CLI Markdown-to-PDF review loop

## Goal

Let a person answer a long PDF form in a readable Markdown worksheet, review or edit OYB's suggestions there, and explicitly choose when to place those answers into a new copy of the PDF. Start with the Mentor Packet rather than redesigning the Chrome extension or introducing a general document framework.

## Proposed flow

1. Inspect the original PDF and extract its questions. Use embedded text when available and OCR for scanned pages. Review the result against rendered pages, especially tables, checkboxes, repeated sections, and instructions.
2. Create a blank Markdown worksheet with page references and stable question IDs. Keep a separate local question map that connects each ID to the source PDF, page, and eventual AcroForm field or page rectangle. Record unanswered, unclear, and user-decision questions explicitly.
3. Use the existing shared OYB answering logic to propose answers from the imported profile and enabled supporting documents. Write those proposals into a new worksheet without overwriting the blank one. Leave unsupported answers, sensitive identifiers, preferences, consent, attestations, and signatures for the person to handle.
4. Let the person edit the proposed worksheet in any text editor. Running the PDF fill command with that worksheet is the explicit handoff from answer review to document creation; it must not submit the form.
5. Validate the question IDs and source PDF identity, then place reviewed answers into a new PDF. Reopen it to verify stored field values and appearances, render the affected pages, and make the result available for final visual review.

The Markdown file is the human-readable answer surface. The question map is the placement record. Do not rely on Markdown labels alone to infer where an answer belongs in the PDF; repeated labels and OCR errors make that unsafe. Keep private worksheets and maps containing personal answers outside tracked repository files.

## Small first experiment

Use pages 1–5 of the Mentor Packet. The current private worksheet is a readable starting point, but it does not yet carry stable question IDs. Add IDs to a copy, map only a few straightforward text answers to the prepared editable PDF, and test the full round trip: blank worksheet → OYB suggestions → human edits → PDF values → rendered review. Keep the original PDF untouched and leave pages 6–19 alone during this experiment.

The existing CLI already has `preview-answers`, `inspect`, `approve-fields`, and a guarded `fill` path for prepared AcroForms. Reuse their provider orchestration, profile import, reviewed field map, and PDF verification. The next work should connect these pieces through an answer worksheet, not replace them. Command names and file schema can be chosen during that small implementation.

## Limits and upgrade trigger

The Mentor Packet's original PDF is scanned and nonfillable. A Markdown worksheet does not create PDF fields or reliable placement coordinates. The first experiment can use its already prepared editable copy and a manually reviewed map. For another scanned PDF, field creation and mapping still require visual review. If this workflow is useful across several different packets, automate more of the question extraction and map review; keep the review gate wherever OCR or layout inference is uncertain.

Checkboxes and repeated rows need explicit answer types and destination rules before OYB writes them. Signatures and legal attestations should remain in the final PDF for the person to review and complete. The output is a draft for review, not a submitted application.
