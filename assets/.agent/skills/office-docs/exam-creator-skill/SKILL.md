---
name: exam-creator-skill
description: Creates and revises school exam papers using Johno's preferred workflow. Use for JSS/Primary exam generation, remixing questions from lesson notes or chat transcripts, building question papers plus marking schemes, creating assets folders for diagrams, applying the 40-mark house style, producing compact DOCX output, and running draft/marking/verification passes with room for user feedback and revisions.
---

# Exam Creator Skill

Use this skill when building or revising school exam papers, especially for OBHIS / Olive Blessed Crest Academy.

See the detailed house rules in [references/workflow-rulebook.md](references/workflow-rulebook.md).
See the model routing policy in [references/model-routing-policy.md](references/model-routing-policy.md).

## Core Principle

Follow the user's house style by default, but always leave room for correction. If the user gives a new rule, prefer the new rule and update the working assumptions before generating more papers.

Terminology rule: when the user says **Gemini**, treat that as **Gemini via the agy CLI** unless the user explicitly says otherwise.

## Default Workflow

1. **Identify the subject, class, term, and destination folder.**
2. **Collect the authority material**:
   - lesson notes
   - ChatGPT transcripts
   - sample exam layout if provided
   - photographed handwritten pages, when provided
3. **For photographed handwritten pages, extract with multimodal vision first**:
   - use a multimodal model/subagent to read the image directly
   - batch images in small ordered groups, usually 3-5 images per extraction task
   - explicitly forbid OCR/Tesseract/Python preprocessing on the first pass unless the model is not multimodal
   - use OCR only as fallback when direct model vision is unavailable or fails on a specific page
   - preserve image filename/page references for every uncertain item
4. **Confirm the paper pattern before drafting** if any of these are unclear:
   - subject family (Mathematics/English vs other subjects)
   - mark split
   - question counts
   - whether theory is answer-all or answer-any
5. **Create or reuse clean folders**:
   - `Questions/`
   - `Marking Scheme/` only when requested
   - `Questions/assets/` for all generated SVG/PNG/image diagrams
6. **Draft the paper first.**
7. **Create the marking scheme second only when requested.**
8. **Run an independent verification pass third.**
9. **Apply user feedback and rerender** instead of defending the first draft.

## Preferred Multi-Agent Pattern

Default model split:
- orchestrator: parent assistant
- drafting: Gemini via agy CLI by default, escalate to GPT 5.4 High when the paper is tricky
- marking: Gemini via agy CLI
- verification: GPT

When subagents are available, use this split:

- **Drafting agent**: creates the paper and diagram assets.
- **Marking agent**: creates the marking scheme and validates every objective answer.
- **Review agent**: independently rechecks answers, numbering, marks, wording, and diagram correctness.

If subagents are not available, still preserve the same three-pass logic manually.

## House Rules To Hardcode

### 1) Marks and paper shape

#### Mathematics and English
Use this as the default unless the user overrides it:

- total exam score: **40 marks**
- **50 objective questions**
- each objective = **1/2 mark**
- objective total = **25 marks**
- **5 theory questions**
- student answers **any 3**
- theory total = **15 marks**
- no separate Section B short-answer block unless the user explicitly asks for one

#### Other subjects
Default assumption:

- still over **40 marks** total
- can include open-ended plus theory sections
- if the exact split is not stated, ask before finalizing

Never silently reuse the old 100-mark structure unless the user explicitly asks for it.

### 2) Layout rules

For the final paper DOCX, prefer:

- **Times New Roman**
- use one font size consistently within a paper; **start with 14 pt** and only reduce it if layout pressure makes it necessary
- narrow margins
- every exam header should include, in this order where possible: school name, academic session, term/exam title, pupil name/date line, examination number/time line, class, arm, subject, and instructions
- header must be **1-column**
- body should be **1-column by default**; use 2-column or 3-column only when it genuinely improves fit for dense objective papers
- do not apply a multi-column body just because the skill mentions compact layout; use judgment per subject
- bold black headings instead of oversized decorative headings
- objective options must start on the **same line as the question** whenever possible; keep them inline with about 3 spaces between choices, not vertically stacked unless unavoidable
- if the paper looks like it will run to **3 pages**, try a **2-column or 3-column body layout** before reducing the font size; use judgment based on content density
- preserve the school name and student-detail heading fields from the source, or leave clear blanks/placeholders if they are not provided
- if the source uses an arm/stream/class line, keep it but do not hardcode labels like `Arm:` unless the source explicitly requires them
- when using separate header/body sections in DOCX, make the body section **continuous** so it does not jump to a new page
- avoid hard page breaks between the heading block and the paper body unless the user explicitly asks for a new page
- remove explicit `Total Marks: ...` header line unless requested
- target about **2 pages** per paper where practical

### 3) Diagram and image rules

- Keep all generated figures inside `Questions/assets/`.
- Choose the diagram method by complexity:
  - simple geometric/line diagrams, tables, clocks, arrows, and labels: SVG first; generate PNG copies if DOCX rendering needs them
  - pictorial objects for young pupils, e.g. mango, pot, bucket, moon, table, cup, house, animals, people, classroom objects: prefer Anti-Gravity image generation or another image-generation path, then place the generated PNG/JPG in `Questions/assets/`
  - hybrid diagrams: combine clean SVG labels/structure with generated image assets when useful
- When using Anti-Gravity for diagrams, explicitly tell it whether to generate images, use SVG, or use a hybrid method, and require it to report which method was used.
- Never include the teacher's written answer labels in student-facing diagrams. If the source labels a keyboard as "Keyboard" or groups division answers for marking guidance, remove that answer/label from the final exam.
- Keep diagrams separated when the source has separate question items or separate objects that must be arranged on the paper. Do not combine unrelated drawings into one asset just for convenience; combine only when the source/question explicitly presents them as one group.
- Preserve the source question order for diagram-heavy nursery/primary papers by rebuilding from the original images, not only from extraction summaries.
- If an item asks pupils to colour an object or flag, do not colour it in the exam; provide an outline only unless the instruction asks for a sample.
- Keep angle labels and vertex labels clearly visible for geometry.
- Avoid placing numbers directly on triangle edges.
- If labels are cramped, move them outward and add white-backed label boxes if needed.

### 4) Feedback loop

After each significant draft:

- expect user corrections
- revise quickly
- update the source files and rerender the DOCX
- if the DOCX is locked/open, save a `v2` file rather than failing the task

## Output Expectations

For each subject batch, try to maintain:

- editable paper source, usually `questions.md`
- concise support/source metadata if useful
- final DOCX for the paper
- marking scheme source
- final DOCX for the marking scheme when requested
- objective-validation notes
- verification report
- all diagrams in `Questions/assets/`

## Authoring Guidance

- Keep questions standard and school-appropriate.
- Remix questions reasonably from the provided curriculum material.
- Stay within the authority source unless the user allows expansion.
- Make objective questions unambiguous.
- Do not leak answers from teacher notes, source annotations, labels, grouped examples, or marking cues into the student-facing paper.
- For handwritten sources, try hard to infer unclear words from context, subject vocabulary, options, and neighboring pages before marking `[unclear]`.
- If uncertainty remains, create a user-review list with image filename/page number, question number, cropped/quoted context if possible, and the competing interpretations. Ask the user instead of leaving unexplained uncertainty in the final paper.
- Ensure the marking scheme matches final numbering exactly when a marking scheme is requested.
- For diagrams, refer to them consistently as Diagram A, B, C, etc.

## Required Clarifications

Ask the user before proceeding when any of the following is missing:

- subject
- class level
- authority source
- sample layout path if layout matching matters
- exact marks pattern for non-Math/non-English subjects
- desired final format if not obvious
- final interpretation of handwritten items that remain ambiguous after a multimodal-first extraction pass and contextual inference

## Safe Revision Rules

When updating an already-generated paper:

1. revise the editable source first
2. revise the marking scheme next if numbering/marks changed
3. rerun validation/verification if answers, wording, or diagrams changed
4. rerender DOCX last

## Reference

Load and follow [references/workflow-rulebook.md](references/workflow-rulebook.md) when you need the exact house style details.