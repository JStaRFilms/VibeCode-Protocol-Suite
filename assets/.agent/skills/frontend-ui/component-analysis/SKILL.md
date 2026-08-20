---
name: component-analysis
description: Analyze a React/TypeScript component for compliance with coding guidelines and suggest improvements.
---

# Component Analysis Skill

Analyze components for coding standards compliance and provide actionable improvements.

## When to Use
- Refactoring discussions
- Before major component changes
- When asked to "analyze" or "audit" a component
- Code review of specific files

## Analysis Process

### 1. Identify Component
Get from user or extract:
- **Component Path**: Full file path
- **Component Name**: The component name

### 2. Initial Examination
Read file and check:
- Code structure and organization
- Purpose and functionality
- Immediate issues
- **Total lines** (check 200-line rule)

### 3. Coding Guidelines Check

| Check | What to Look For |
|-------|------------------|
| **Size** | < 200 lines (refactor if exceeded) |
| **Single Responsibility** | Does one thing well |
| **TypeScript** | Proper types, interfaces for props |
| **Naming** | PascalCase components, camelCase functions, handle* events |
| **Hooks** | Proper use of React hooks and effects |
| **Documentation** | TSDoc/JSDoc comments |
| **Imports** | Organized, no unused imports |

### 4. Styling Check

| Check | What to Look For |
|-------|------------------|
| **Tailwind v4** | Using @theme integration |
| **Color Tokens** | Using primary, accent, semantic tokens |
| **Responsive** | Mobile-first (sm:, md:, lg:) |
| **Dark Mode** | dark: variants |
| **Performance** | Avoiding expensive backdrop-filter |

### 5. Mobile-First Check
- Mobile-first breakpoints
- Touch-friendly interactions
- Responsive typography
- Container responsiveness

### 6. Generate Report

```markdown
# Component Analysis: [Name]

**File:** `[path]`
**Lines:** [X] / 200 max
**Score:** [X]/10

## ✅ Compliant
- [Things done well]

## ⚠️ Warnings
- [Minor issues]

## ❌ Violations
- [Critical issues]

## 📋 Recommendations

### High Priority
1. [Critical fix]

### Medium Priority
1. [Improvement]

## 🔧 Suggested Fixes
[Before/After code examples]
```

### 7. Offer Next Steps
- **A)** Implement high-priority fixes
- **B)** Create feature documentation
- **C)** Refactor if > 200 lines

## Severity Levels
- 🔴 **Critical**: Breaking functionality, security issues
- 🟡 **Major**: Performance, accessibility violations
- 🟢 **Minor**: Code style, documentation

## Common Violations
1. No TypeScript interface for props → Define `interface ComponentProps`
2. useEffect missing dependencies → Add to dependency array
3. Hardcoded colors → Use Tailwind tokens
4. No dark mode → Add `dark:` variants
5. Missing alt text → Add descriptive alt attributes
