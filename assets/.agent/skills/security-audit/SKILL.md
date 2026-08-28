---
name: security-audit
description: Use when auditing code for security vulnerabilities, verifying auth/payment boundaries, scanning for secret leaks, or doing pre-deployment sanity checks.
author: J StaR Films
version: 2.0.0
---

# Security Audit Skill

A comprehensive, manual deep code audit protocol for security-critical systems. Includes fast "Vibe Coding Guardrails" for the most common AI-assisted development pitfalls.

## When to Use
- Before major releases
- Security review requests
- Auditing authentication/payment flows
- When "audit" or "security" is mentioned
- After scaffolding a new project with AI (vibe coding sanity check)
- Before first deploy of any user-facing app

## Audit Phases

### Phase 0: Scope Definition
Define boundaries:
- **FULL_SCAN**: Entire codebase
- **FEATURE_SCAN**: Specific feature (`docs/features/[Name].md`)
- **DIFF_SCAN**: `git diff --staged` or `git diff HEAD~1`

### Phase 1: The Detective (Static Analysis)
```bash
# 1. Detect package manager & run dependency audit
# Auto-detect: check which lockfile exists
# pnpm-lock.yaml → pnpm audit
# package-lock.json → npm audit
# yarn.lock → yarn audit
# bun.lockb → bun pm audit (or bunx audit)
pnpm audit  # ← swap for your package manager

# 2. Secret scanning (use jstar if available)
jstar detect

# 3. Manual grep patterns:
# Secrets
grep -rE "(api_key|secret|password|token)\s*[:=]\s*['\"\`][a-zA-Z0-9_\-\.]{10,}['\"\`]"

# RCE/Injection
grep -rE "(dangerouslySetInnerHTML|eval\(|exec\(|\.queryRaw)"

# Debugging
grep -rE "(console\.log|debugger|todo)"
```

### Phase 1.5: Vibe Coding Guardrails (AI-Specific Checks)

> These are fast, proactive checks that catch the most common vibe-coding security mistakes.
> Run these **before** deep analysis. Each takes ~2 minutes.

#### 1.5.1 — Ghost/Phantom Package Detection (Supply Chain)
**Risk:** AI models hallucinate package names. Attackers register malware under those names.

> **Note:** `npm view` queries the npm registry directly and works regardless of your package manager (pnpm, yarn, bun, etc.). You don't need npm installed — it's just a registry lookup.

```bash
# For each unfamiliar dependency in package.json:
# 1. Verify it exists on the real registry (works with ANY package manager)
npm view <package-name> version  # Should return a version, not 404
# Alt for pnpm users: pnpm info <package-name>
# Alt for bun users: bunx npm-cli view <package-name>

# 2. Check download stats (low downloads = suspicious)
npm view <package-name> --json | grep -E "downloads|modified"

# 3. Look for typosquatting (e.g., "lodahs" instead of "lodash")
# Compare against known-good package names
```
**Action:** Remove any package that doesn't exist on npm/PyPI or has suspiciously low downloads. Cross-reference with the official docs.

#### 1.5.2 — AI-Built Auth Detection
**Risk:** AI happily generates custom login systems that *look* like they work but have invisible holes (no CSRF, weak hashing, no session expiry, etc.).
```bash
# Scan for custom auth patterns (red flags):
grep -rE "(bcrypt\.hash|jwt\.sign|createHash|crypto\.createCipher)" --include="*.ts" --include="*.tsx" --include="*.js"
grep -rE "(password.*=.*req\.(body|query)|session\[|cookie\[)" --include="*.ts" --include="*.tsx" --include="*.js"

# Check if a battle-tested auth provider is installed:
grep -E "(next-auth|@auth/|@clerk|@supabase/auth|auth0|lucia|better-auth)" package.json
```
**Action:** If custom auth is found AND no established provider exists:
- Flag as **HIGH** severity
- Recommend migration to: **Clerk**, **NextAuth/Auth.js**, **Supabase Auth**, **Auth0**, **Lucia**, or **Better Auth**
- Custom auth is only acceptable if the team has dedicated security expertise

#### 1.5.3 — .gitignore Verification
**Risk:** Vibe coding moves fast. One missing `.gitignore` entry = secrets pushed to public GitHub. Bots scan for exposed keys 24/7.
```bash
# 1. Check .gitignore exists
test -f .gitignore && echo "EXISTS" || echo "MISSING — CRITICAL"

# 2. Verify essential entries are present:
for pattern in ".env" ".env.local" ".env.*.local" "node_modules" "*.pem" "*.key" ".DS_Store"; do
  grep -qF "$pattern" .gitignore || echo "MISSING from .gitignore: $pattern"
done

# 3. Check if .env is already tracked (damage already done):
git ls-files --cached | grep -E "\.env$|\.env\.local$|\.pem$|\.key$"
# If output exists → secrets are already in git history. Rotate ALL keys immediately.
```
**Action:** If `.gitignore` is missing or incomplete → flag as **CRITICAL**. If `.env` is already tracked → **CRITICAL** + recommend `git filter-branch` or `BFG Repo-Cleaner` + immediate key rotation.

#### 1.5.4 — Rate Limiting Check
**Risk:** Any public API route without rate limiting = bots will abuse it (spam, brute force, API cost drain).
```bash
# Check if rate limiting middleware is installed:
grep -E "(rate-limit|@upstash/ratelimit|express-rate-limit|limiter)" package.json

# Check if it's actually applied to API routes:
grep -rE "(rateLimit|rateLimiter|Ratelimit|slidingWindow)" --include="*.ts" --include="*.tsx" --include="*.js" src/app/api/ app/api/ pages/api/
```
**Action:** If no rate limiter is found on public API routes:
- Flag as **HIGH** severity
- Recommend: `@upstash/ratelimit` (serverless), `express-rate-limit` (Express), or custom middleware
- Minimum: 100 requests/hour/IP for forms, 10 requests/minute for auth endpoints
- AI-powered endpoints (LLM calls) should have even stricter limits to prevent cost attacks

#### 1.5.5 — Row Level Security (RLS) Check
**Risk:** By default, databases let anyone see everyone's data. Forgetting RLS = instant data leak.
```bash
# Check if Supabase is used (most common vibe-coding DB):
grep -E "(supabase|@supabase)" package.json

# If Supabase: verify RLS is mentioned in migration files or setup:
grep -rE "(enable_rls|row_level_security|CREATE POLICY|ALTER TABLE.*ENABLE ROW LEVEL SECURITY)" --include="*.sql" --include="*.ts"

# For Prisma: check for tenant/user scoping in queries:
grep -rE "where:.*userId|where:.*user_id|where:.*tenantId" --include="*.ts" --include="*.tsx"

# For raw SQL: check for user-scoped WHERE clauses:
grep -rE "(SELECT|UPDATE|DELETE).*FROM" --include="*.ts" --include="*.tsx" | grep -v "WHERE.*user"
```
**Action:** If database is used but no RLS/user-scoping is found:
- Flag as **CRITICAL** severity
- For Supabase: Enable RLS on ALL tables, create policies for `SELECT`, `INSERT`, `UPDATE`, `DELETE`
- For Prisma/raw SQL: Ensure every query that touches user data includes a `userId`/`tenantId` filter
- Rule of thumb: **If a user can see another user's data, it's a data breach**

---

### Phase 2: The Graph (Data Flow)
- Identify Entry Points (Routes, Actions, CLI)
- **Trace Input**: User input → Service → Database
- **Verify Validation**: Zod/Typebox at edge boundaries

### Phase 3: The Auditor (Spec vs Code)
- Read `docs/features/*.md` for scope
- **Gap Analysis**: Features in Docs but missing in Code
- **Orphan Analysis**: Code not in Docs (zombie code)

### Phase 4: The Judge (Logic Probing)
Pick highest-risk file and simulate:
- "What if I send `null`? Empty string? Negative ID?"
- "What if two requests hit this at once?" (race conditions)
- "Can I access this Service function directly?" (auth bypass)

### Phase 5: The Architect (Quality)
- **Performance**: `await` in loops → N+1 queries
- **Bloat**: Files > 200 lines? Functions > 50 lines?
- **Types**: Any use of `any` or `as unknown`?
- **Structure**: Feature-Sliced Design compliance?

### Phase 6: Report
Create `.jstar/audit_report.md`:

| Severity | Category | Location | Issue | Recommendation |
|----------|----------|----------|-------|----------------|
| CRITICAL | SECURITY | `api/auth` | ... | ... |
| HIGH | LOGIC | `service.ts:42` | ... | ... |
| HIGH | GUARDRAIL | `package.json` | No rate limiter installed | Add `@upstash/ratelimit` |

Severities: `CRITICAL`, `HIGH`, `WARNING`, `INFO`
Categories: `SECURITY`, `LOGIC`, `COMPLETENESS`, `QUALITY`, `GUARDRAIL`

### Phase 7: Remediation
For each CRITICAL/HIGH:
1. Implement fix
2. Run build/tests
3. Re-verify with grep/logic check
4. Stage changes
