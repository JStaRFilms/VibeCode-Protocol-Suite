# Reference Site Section Detection Rubric

Use this when Auto mode crawls a reference site and needs to infer which 21st.dev component families to search.

## Detection Order

1. Capture the page at the top of the viewport.
2. Identify the persistent shell first:
   - announcement bar
   - navbar / header
   - sidebar / dock
3. Walk top to bottom through the main content:
   - hero
   - trust / logos
   - features
   - stats / numbers
   - gallery / image / video blocks
   - testimonials
   - pricing / comparison
   - FAQ / accordion
   - forms / CTA
   - footer
4. Record both structure and visual traits:
   - column count
   - card density
   - media-heavy or text-heavy
   - dark / light
   - animated / static
   - decorative borders, shaders, or backgrounds

## DOM / Visual Heuristics

| Signal | Likely section |
|---|---|
| Top horizontal bar with few links + logo + CTA | `header`, `navbar` |
| Large headline + supporting copy + CTA near page top | `hero` |
| Repeating 3-6 cards with icons or short bullets | `features` |
| Customer quotes, avatars, star ratings | `testimonials` |
| Tiered cards with prices, plan names, feature lists | `pricing` |
| Expand/collapse question rows | `faq` |
| Long form fields, search, email capture, sign-in area | `form`, `auth` |
| Fixed left navigation or app shell | `sidebar` |
| Repeating rows/columns of data | `table`, `dashboard` |
| Large media, video poster, or carousel | `video`, `gallery`, `carousel` |

## Category Mapping Rules

- Prefer the exact section category first, then layer supporting categories.
- For minimalist landing pages, combine `hero` with `text`, `image`, `background`, or `border`.
- For app-like layouts, combine `sidebar`, `table`, `tabs`, `card`, and `pagination`.
- If a block is visually impressive but structurally thin, use a decorative category like `background`, `shader`, or `border` in addition to the main section category.

## Selection Rules

- Match structure before style.
- Prefer fewer external dependencies when two candidates are equally good.
- Prefer components whose dependency list fits the target repo.
- Prefer components whose layout can be adapted without rewriting most of the markup.
- If the site has a clearly custom section with no close match, fall back to Manual mode for that section only.
