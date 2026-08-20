# Coding Guidelines

> **This document is the LAW.** Follow it without exception.

---

## 🛑 The Verification Protocol (MANDATORY)

### After EVERY TypeScript/TSX File Edit

```bash
npx tsc --noEmit
```

**If this command fails:**
1. **STOP.** Do not touch another file.
2. Read the error message carefully.
3. Fix the type error.
4. Re-run the command.
5. Only proceed when it passes.

### Before Any Handoff or "Done" Claim

```bash
python scripts/vibe-verify.py
```

All checks must pass. No exceptions.

---

## The Blueprint & Build Protocol

### Phase 1: Blueprint (Before Writing Code)

Before implementing any non-trivial feature:

1. **Context Analysis**
   - Check `docs/features/` for existing implementations
   - Check if existing components/hooks can be reused
   - Identify potential impact on other features

2. **Create the Plan**
   - Create `docs/features/FeatureName.md` with:
     - High-Level Goal
     - Component Breakdown (label Server/Client)
     - Logic & Data Breakdown
     - Step-by-Step Implementation Plan

3. **Get Approval**
   - Present the plan to the user
   - Wait for explicit approval before coding

### Phase 2: Build (Implementation)

1. **Announce**: "Implementing FR-XXX: [Title]"
2. **Reference**: Open the corresponding issue in `docs/issues/`
3. **Implement**: One file at a time
4. **Verify**: `npx tsc --noEmit` after each file
5. **Mark Complete**: Check off acceptance criteria as you complete them
6. **Update Issue**: Edit the issue file to reflect progress

### Phase 3: Finalization

1. Run `python scripts/vibe-verify.py`
2. Update all acceptance criteria checkboxes
3. Generate handoff summary

---

## Full-Stack Type Safety

### The Golden Rule

> If you change the backend, the frontend MUST type-check.  
> If type-check fails, THE CHANGE BROKE SOMETHING.  
> Fix it before moving on.

### How It Works

1. **Prisma/DB Changes** → Regenerate client → Type-check
2. **API Route Changes** → Frontend consumers must type-check
3. **Server Component Changes** → Props must align with parent

### Tools That Help

- **tRPC**: Frontend imports backend types directly
- **Server Components**: Backend code returns UI with type safety
- **Zod**: Runtime validation that generates types

---

## Next.js App Router Architecture

### Server vs Client Components

| Use Server Components For | Use Client Components For |
|---------------------------|---------------------------|
| Data fetching | Event handlers (onClick) |
| Database access | useState, useEffect |
| Rendering static content | Browser APIs (localStorage) |
| Accessing backend services | Interactivity |

**Default**: Server Component (no directive)  
**Client**: Add `'use client'` at top of file

### Data Fetching

```tsx
// ✅ GOOD: Fetch in Server Component
async function ProductList() {
  const products = await db.product.findMany();
  return <ul>{products.map(p => <li key={p.id}>{p.name}</li>)}</ul>;
}

// ❌ BAD: useEffect fetching
function ProductList() {
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch('/api/products').then(...); // Avoid this
  }, []);
}
```

### Route Structure

```
app/
├── page.tsx              # Home page
├── layout.tsx            # Root layout
├── api/
│   └── [resource]/
│       └── route.ts      # API endpoints
├── (auth)/               # Route group
│   ├── login/page.tsx
│   └── register/page.tsx
└── dashboard/
    ├── page.tsx
    └── settings/page.tsx
```

---

## File Structure (Feature-Sliced)

```
src/
├── app/                    # Next.js App Router
├── features/               # Business domains
│   └── [FeatureName]/
│       ├── components/     # Feature UI
│       ├── hooks/          # Feature hooks
│       ├── [name].service.ts
│       └── types.ts
├── components/
│   ├── ui/                 # Reusable: Button, Card, Input
│   └── layout/             # Navbar, Sidebar, Footer
├── lib/                    # Utilities
│   ├── db.ts               # Prisma client
│   └── utils.ts
└── scripts/
    └── vibe-verify.py
```

---

## Component Rules

### The 200-Line Rule

A component file exceeding **200 lines** is a code smell.

**When you hit the limit:**
1. Extract logic into a custom hook
2. Extract sub-components into separate files
3. Move business logic to a service file

### Props & Types

```tsx
// ✅ GOOD: Interface for props
interface UserCardProps {
  user: User;
  onEdit?: (id: string) => void;
}

function UserCard({ user, onEdit }: UserCardProps) {
  // ...
}

// ❌ BAD: No types
function UserCard(props) {
  const user = props.user; // No type safety
}
```

### Custom Hooks

Extract stateful logic into hooks:

```tsx
// hooks/useUser.ts
export function useUser(userId: string) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchUser(userId).then(setUser).finally(() => setLoading(false));
  }, [userId]);
  
  return { user, loading };
}
```

---

## Styling (Tailwind CSS v4)

### Setup

```css
/* globals.css */
@import "tailwindcss";

@theme {
  --color-background: #ffffff;
  --color-foreground: #0b1221;
  --color-border: #e5e7eb;
  --color-ring: #3b82f6;
  
  /* Brand colors */
  --color-primary: #2563eb;
  --color-secondary: #7c3aed;
}

@theme .dark {
  --color-background: #0b1221;
  --color-foreground: #f3f4f6;
  --color-border: #374151;
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground; }
}
```

### Rules

1. **Utility-first**: Apply Tailwind classes in JSX
2. **No custom CSS**: Unless absolutely necessary
3. **Dark mode**: Use `dark:` prefix, controlled by `.dark` class
4. **Tokens**: Define in `@theme`, not `tailwind.config`

---

## Backend / API Design

### Service Layer Pattern

```
Route Handler (route.ts)     →  Controller (parse, respond)
         ↓
Service (*.service.ts)       →  Business logic
         ↓
Database (Prisma)            →  Data access
```

### Example

```tsx
// app/api/users/route.ts (Controller)
export async function POST(request: Request) {
  const body = await request.json();
  const validated = createUserSchema.parse(body); // Zod validation
  const user = await userService.createUser(validated);
  return NextResponse.json({ data: user }, { status: 201 });
}

// features/users/user.service.ts (Service)
export const userService = {
  async createUser(data: CreateUserInput) {
    return db.user.create({ data });
  }
};
```

### Validation with Zod

```tsx
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['USER', 'ADMIN']).default('USER'),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
```

**All inputs must be validated. No exceptions.**

---

## Recovery Protocol

If you break something:

```bash
# See what changed
git status
git diff

# Revert a specific file
git checkout -- path/to/file.tsx

# Save changes and revert
git stash

# Restore saved changes
git stash pop
```

---

## Quick Reference

| Command | When to Run |
|---------|-------------|
| `npx tsc --noEmit` | After every TS/TSX edit |
| `python scripts/vibe-verify.py` | Before handoff |
| `python scripts/vibe-verify.py --quick` | Quick check (no build) |
| `npm run lint` | Check code style |
| `npm run build` | Full production build |
| `npx prisma generate` | After schema changes |
| `npx prisma migrate dev` | Apply DB migrations |
