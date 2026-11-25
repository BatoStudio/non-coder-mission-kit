---
name: mission-drawing-check
description: General guidance when building a feature that reads/checks PDF drawing sets. ONLY use in a project that already has .mission/config.json AND the app does not yet have its own drawing-reading skill (if it has one, use the app's skill).
---

# Reading and checking PDF drawing sets

## 1. Sample sets first, code second

- **The project owner** copies the real PDF sets into `samples/` (Claude does not copy/move samples). Name them with a **short code** (e.g. `abc-001`, `j00001`), not addresses or customer names. Once there are samples, add `samples/**` to `protect.deny`.
- For each sample, a qualified person records the expected result in `tests/expected/<project>.json`: the list of sheets (number, title, revision), whose title block it is, the customer, the errors and notes that should be caught.
- Each customer has their own conventions (title block, logo, sheets required by stage Tender/Preliminary/Construction). Conventions are recorded as data following the skill `mission-rules-engine`, not hard-coded.

## 2. Reading the PDF

- Prefer the PDF's text layer (pdf.js / pdfjs-dist in the browser; pdfplumber/PyMuPDF if processing on the machine). Only OCR when the page is a scanned image, and mark OCR results as less reliable.
- Locate the title block by coordinate region + keywords, not by text order (PDF text order is not stable).
- For each field read, record: value, page, position, confidence. Cannot be read → **note** «could not read, needs a person to check», do not guess.
- Dimensions/scale: take them from the scale bar or the dimensions written on the drawing; always cross-check against a known dimension (e.g. the length of a standard module).

## 3. Common conventions (confirm again with each project)

- Letter revision = preliminary, number = construction. The file-name revision and the ISSUE on each sheet are two independent systems; sheets in one set may have different revisions. A mismatch between the file name and the highest ISSUE is a **note**, not an error.
- The customer on the title block must not be the same as the company whose logo is on that same title block.
- A «T.B.C» note is not an error.
- An item that is only optional (e.g. NGL on an elevation) → note, not an error.

## 4. Results for the user

Table: sheet · item · result (pass / error / note) · value read · requirement · **how to fix it**. A button that opens the right PDF page. A report can be exported (PDF/CSV) to send along.

## 5. Testing

- `checks.full` runs all samples and compares with `tests/expected/` — a single cell off is RED too.
- Add a new sample every time a real-world error is found (the error becomes a permanent test case).
- When changing the PDF reader or the conventions: rerun all samples of **every** customer, not only the customer being worked on.
- 3D/floor plans built from the PDF: take snapshots (`web-smoke --script`) and compare overall dimensions, number of rooms, door positions with the original drawing; hand `mission-visual-qa` the review.
