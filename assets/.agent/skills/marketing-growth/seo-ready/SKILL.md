---
name: seo-ready
description: Make any Next.js page SEO-ready with metadata, structured data, sitemap, and accessibility best practices.
---

# SEO Ready Skill

Transform Next.js pages into fully SEO-optimized pages.

## When to Use
- SEO optimization requests
- Before launching pages to production
- When asked about metadata or search visibility
- Accessibility audits

## Phase 1: Global Setup (Once Per Project)

### Check Root Metadata
```bash
head -50 src/app/layout.tsx
```

Required in `layout.tsx`:
```typescript
export const metadata: Metadata = {
  title: { default: "Site Name", template: "%s | Site Name" },
  description: "...",
  metadataBase: new URL("https://your-domain.com"),
  openGraph: { /* ... */ },
  twitter: { /* ... */ },
};
```

### Sitemap
```bash
ls src/app/sitemap.ts 2>/dev/null || echo "MISSING"
```

If missing, create `src/app/sitemap.ts`:
```typescript
import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = 'https://your-domain.com'
  return [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'yearly', priority: 1 },
  ]
}
```

### Robots.txt
Create `src/app/robots.ts` if missing.

### Web Manifest (PWA)
Create `src/app/manifest.ts` if missing.

### Icons
Check: `src/app/icon.png`, `src/app/apple-icon.png`

### OpenGraph Image
Options:
- **Static**: `src/app/opengraph-image.png` (1200x630px)
- **Dynamic**: `src/app/opengraph-image.tsx`

### JSON-LD Structured Data
Add to `<body>` in layout:
```tsx
<script
  type="application/ld+json"
  dangerouslySetInnerHTML={{
    __html: JSON.stringify({
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      "name": "Your App",
    })
  }}
/>
```

## Phase 2: Per-Page Optimization

### Server Component Check
If page starts with `'use client'`, refactor:
- Move client logic to `src/features/<feature>/components/`
- Page file becomes Server Component that imports client component

### Page Metadata
```typescript
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Page Title",  // Becomes "Page Title | Site Name"
  description: "Specific description for this page.",
};
```

### Semantic HTML Audit
- `<main>` for primary content
- `<section>` with `id` for anchors
- `<article>` for standalone content
- Proper heading hierarchy (`<h1>` → `<h2>` etc.)

### Image Optimization
- Use `<Image>` component
- Required: `alt`, `width`, `height`

## Phase 3: Accessibility

- ARIA labels on interactive elements
- `<html lang="en">` set correctly
- Keyboard navigable

## Phase 4: Verification

```bash
pnpm build
pnpm dev
# Visit /sitemap.xml and /robots.txt
```

## Checklist
| Item | Status |
|------|--------|
| Root metadata | [ ] |
| sitemap.ts | [ ] |
| robots.ts | [ ] |
| manifest.ts | [ ] |
| Icons | [ ] |
| OpenGraph image | [ ] |
| JSON-LD | [ ] |
| Page metadata | [ ] |
| Semantic HTML | [ ] |
| Build passes | [ ] |

## References

Content writing patterns merged from [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills):

- [AEO & GEO Patterns](references/aeo-geo-patterns.md): Content blocks optimized for answer engines and AI citation
- [AI Writing Detection](references/ai-writing-detection.md): Words and phrases to avoid (the "anti-slop" guide)
