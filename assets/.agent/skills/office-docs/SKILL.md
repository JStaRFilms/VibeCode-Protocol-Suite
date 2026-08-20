---
name: office-docs
displayName: Office Documents Suite
description: Use when reading, extracting text/tables, creating, editing, converting, merging, splitting, or formatting PDF, Word (DOCX), PowerPoint (PPTX), Excel (XLSX), or school exam paper documents.
version: 2.0.0
author: J StaR Films
tags: [pdf, docx, pptx, xlsx, exam, office, documents]
---

# Office Documents Suite

This is the router for office document processing, spreadsheet calculation, slide generation, and exam paper creation. Open and read the relevant sub-skill file for your document format:

## Document Formats & Tools

| Format | Sub-Skill Path | Use When |
|---|---|---|
| PDF (`.pdf`) | `pdf/SKILL.md` | Reading, extracting text/tables, merging, splitting, OCR, forms, watermark |
| Word (`.docx`) | `docx/SKILL.md` | Creating, editing, formatting, or parsing Word documents |
| PowerPoint (`.pptx`) | `pptx/SKILL.md` | Creating decks, pitch decks, editing slides, extracting text |
| Excel (`.xlsx`) | `xlsx/SKILL.md` | Reading spreadsheets, creating sheets, formulas, data tables |
| Exam Papers | `exam-creator-skill/SKILL.md` | Authoring exam question papers and marking schemes |

## Quick Rules

- Prefer reading documents programmatically through the scripts and instructions in each sub-skill.
- Keep output documents properly structured and formatted.
