---
name: office-docs
displayName: Office Documents Suite
description: Use when reading, extracting text/tables, creating, editing, converting, merging, splitting, or formatting PDF, Word (DOCX), PowerPoint (PPTX), or Excel (XLSX) documents.
version: 1.0.0
tags: [pdf, docx, pptx, xlsx, office, documents]
---

# Office Documents Suite

This is the router for office document processing and authoring. Open and read the relevant sub-skill file for your document format:

## Document Formats

| Format | Sub-Skill Path | Use When |
|---|---|---|
| PDF (`.pdf`) | `pdf/SKILL.md` | Reading, extracting text/tables, merging, splitting, OCR, forms, watermark |
| Word (`.docx`) | `docx/SKILL.md` | Creating, editing, formatting, or parsing Word documents |
| PowerPoint (`.pptx`) | `pptx/SKILL.md` | Creating decks, pitch decks, editing slides, extracting text |
| Excel (`.xlsx`) | `xlsx/SKILL.md` | Reading spreadsheets, creating sheets, calculations, data tables |

## Quick Rules

- Prefer reading documents programmatically through the scripts and instructions in each sub-skill.
- Keep output documents properly structured and formatted.
