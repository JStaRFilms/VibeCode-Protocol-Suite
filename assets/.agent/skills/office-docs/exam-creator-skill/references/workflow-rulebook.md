# OBHIS Exam Workflow Rulebook

This reference captures the current house style agreed during the Mathematics paper workflow.

## Scope

Use this rulebook for OBHIS / Olive Blessed Crest Academy exam generation unless the user gives a newer rule.

## Terminology Rule

When the user says **Gemini**, interpret that as **Gemini via the agy CLI** unless the user explicitly says otherwise.

## Workflow Summary

1. Gather source materials.
2. For photographed handwritten pages, run a multimodal-first extraction pass before OCR:
   - use direct model vision on the image files
   - batch images in small ordered groups, usually 3-5 images per model task
   - explicitly forbid OCR/Tesseract/Python preprocessing on the first pass
   - use OCR only as fallback when direct vision is unavailable or fails for a specific page
3. Confirm subject-specific mark pattern.
4. Create clean folder structure.
5. Draft question paper.
6. Build marking scheme only when requested.
7. Independently verify.
8. Incorporate user feedback.
9. Rerender deliverables.

## Folder Structure

Preferred output structure:

- `Questions/`
  - `questions.md`
  - final exam `.docx`
  - `assets/`
    - all SVG diagrams
    - all PNG diagram copies used for Word export
- `Marking Scheme/` only when requested
  - `marking-scheme.md`
  - `objective-validation.md`
  - `verification-report.md`
  - marking-scheme `.docx` if needed

## Subject Rules

### Mathematics and English

Default pattern:

- exam total = **40 marks**
- objective count = **50**
- objective marks = **0.5 each**
- objective total = **25 marks**
- theory questions = **5**
- answer any = **3**
- theory total = **15 marks**
- no separate short-answer section by default

### Other Subjects

Current preference:

- may still use open-ended and theory sections
- still intended to fit the 40-mark exam system
- exact split should be clarified before final generation if not explicitly stated

## Layout Rules

- use **Times New Roman**
- default body size **12 pt**
- narrow margins
- compact layout
- header must be 1-column and should include: school name, academic session, term/exam title, pupil name/date, examination number/time, class, arm, subject, and instructions
- body is **1-column by default**
- use 2-column/3-column body only when a dense objective paper genuinely needs it for fit; do not apply columns mechanically to every subject
- headings should be bold and black, not oversized
- objective options should appear inline or compactly, not stacked unless unavoidable
- remove `Total Marks` line unless requested
- try to keep each paper around **2 pages** where practical

## Diagram Rules

- store diagrams in `Questions/assets/`
- simple line/geometry diagrams: prefer SVG masters plus PNG export copies
- pictorial nursery/primary objects (mango, pot, bucket, moon, table, cup, animals, classroom objects, etc.): prefer Anti-Gravity image generation or another image-generation path instead of rough SVG-only drawings
- Anti-Gravity can generate images; when using it, instruct whether to generate images, use SVG, or use a hybrid method, and require a report of the method used
- do not include answer labels from the teacher’s source in the student-facing diagram, e.g. do not label the keyboard as “Keyboard” when the question asks pupils to identify it
- keep separate source drawings as separate assets unless the question explicitly presents them as one grouped diagram; this helps preserve order and layout
- for diagram-heavy papers, rebuild the draft directly from the original tagged images instead of relying only on extraction summaries
- do not show worked/grouped answers in division or counting diagrams when the child is supposed to solve them
- if pupils are asked to colour an object or flag, leave it as an outline unless the exam explicitly asks for a sample
- labels must be readable when labels are part of the prompt rather than the answer
- angle values must not be hidden by edges
- move text away from lines when needed
- rerender diagrams if the user reports visibility problems

## Review Rules

- objective answer validation is mandatory when a marking scheme or answer key is requested
- marking scheme must match final numbering when requested
- verification should independently confirm correctness
- for handwritten sources, infer unclear text aggressively from context before marking it unclear
- any remaining ambiguous handwriting must be captured in a user-review list with image filename/page reference, question number, and candidate interpretations
- if a wording ambiguity is found, fix the paper and then realign the scheme when a scheme exists

## Feedback Rules

- user feedback overrides previous assumptions
- update future papers to follow the corrected rule
- if a DOCX is locked, save a versioned file such as `v2`

## Notes

This rulebook is intentionally opinionated because it represents Johno's workflow. Keep it flexible enough to ask follow-up questions whenever a new subject or mark pattern does not clearly fit the stored defaults.