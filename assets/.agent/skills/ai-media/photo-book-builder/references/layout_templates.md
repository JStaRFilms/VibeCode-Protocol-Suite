# Photo Book Layout Grid Templates Reference

This reference documents the exact coordinate maps, margins, gaps, and cell dimensions for the 12" × 30" (9000 × 3600 px at 300 DPI) full-bleed masonry layout spreads.

## Page Dimensions
*   **Total Spread Canvas**: $9000 \times 3600$ pixels.
*   **Page Halves**: 
    *   **Left Page (Page A)**: $x \in [0, 4500]$, $y \in [0, 3600]$
    *   **Right Page (Page B)**: $x \in [4500, 9000]$, $y \in [0, 3600]$
*   **Outer Margins**: Exactly **150 pixels** on the top, bottom, and outside edges of each page half.
*   **Gaps Between Images**: Exactly **40 pixels** horizontally and vertically.
*   **Center Seam Gutter**: Exactly **150 pixels** total (no image placed between $x = 4425$ and $x = 4575$).
*   **Active Page Half Grid Size**: $4275 \times 3300$ pixels.
    *   Left Page active $x$ range: $[150, 4425]$
    *   Right Page active $x$ range: $[4575, 8850]$
    *   Active $y$ range: $[150, 3450]$

---

## Column Configurations & Dimensions

To cover the active area completely without vertical white spaces, we use three specific column widths:
*   **Large Landscape Column**: $2550$ px wide.
*   **Medium Landscape Column**: $1350$ px wide (only when paired with a $2550$ px column).
*   **Narrow Landscape / Portrait Column**: $1685$ px wide.
*   **Symmetric Double-Portrait Column**: $2118$ / $2117$ px wide.

---

## Template Layouts

### Template 5A (5 Photos: 4 Landscapes, 1 Portrait)
*   **Column A (2550 px wide)**:
    *   Row 1: 1 Large Landscape ($2550 \times 1630$ px)
    *   Row 2: 2 Small Landscapes side-by-side ($1255 \times 1630$ px each)
*   **Column B (1685 px wide)**:
    *   Row 1: 1 Portrait ($1685 \times 2480$ px)
    *   Row 2: 1 Panoramic Landscape ($1685 \times 780$ px)
*   *Sum of widths*: $2550 + 1685 + 40 \text{ (gap)} = 4275$ px.
*   *Sum of heights*: 
    *   Col A: $1630 + 1630 + 40 = 3300$ px.
    *   Col B: $2480 + 780 + 40 = 3300$ px.

### Template 6A (6 Photos: 5 Landscapes, 1 Portrait)
*   **Column A (2550 px wide)**:
    *   Row 1: 2 Small Landscapes side-by-side ($1255 \times 1630$ px each)
    *   Row 2: 2 Small Landscapes side-by-side ($1255 \times 1630$ px each)
*   **Column B (1685 px wide)**:
    *   Row 1: 1 Portrait ($1685 \times 2480$ px)
    *   Row 2: 1 Panoramic Landscape ($1685 \times 780$ px)
*   *Sum of widths*: $2550 + 1685 + 40 \text{ (gap)} = 4275$ px.
*   *Sum of heights*: $3300$ px.

### Template 6B (6 Photos: 4 Landscapes, 2 Portraits)
*   **Column A (2118 px wide)**:
    *   Row 1: 1 Large Landscape ($2118 \times 1630$ px)
    *   Row 2: 1 Large Landscape ($2118 \times 1630$ px)
*   **Column B (2117 px wide)**:
    *   Row 1: 2 Portraits side-by-side ($1038 \times 1630$ px each)
    *   Row 2: 2 Landscapes side-by-side ($1038 \times 1630$ px each)
*   *Sum of widths*: $2118 + 2117 + 40 \text{ (gap)} = 4275$ px.
*   *Sum of heights*: $3300$ px.

---

## Deterministic Page Swapping

To vary the page designs dynamically across the book:
*   Swap Left Page columns if `page_num % 2 == 0`.
*   Swap Right Page columns if `page_num % 3 == 0`.

When swapping a column layout, Column B's starting $x$ coordinate is placed at the outer margin, and Column A's starting $x$ coordinate is placed after it.
