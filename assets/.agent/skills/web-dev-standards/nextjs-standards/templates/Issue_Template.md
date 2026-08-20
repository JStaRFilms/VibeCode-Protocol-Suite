# Issue Template

Use this format for all GitHub Issues created during Genesis.

---

## Template

```markdown
# [FR-XXX] Feature Title

## Labels
`MUS`, `enhancement`, `[module-name]`

## User Story
As a [user type], I want to [action], so that [benefit].

## Proposed Solution

### Overview
Brief description of the approach.

### Implementation Flow
1. **Step One** — What happens first
2. **Step Two** — What happens next
3. **Step Three** — Final step

### Technical Approach

```[language]
// Suggested implementation pattern
// This is GUIDANCE, not gospel — adapt as architecture evolves

// Example function signatures
export function doSomething(input: InputType): OutputType { ... }
```

### Key Considerations
- Important point 1
- Important point 2
- Edge case to handle

## Acceptance Criteria

- [ ] Testable outcome 1
- [ ] Testable outcome 2
- [ ] Testable outcome 3
```

---

## Guidelines

### User Story
- Keep it simple: As a WHO, I want WHAT, so that WHY
- Focus on the user's goal, not implementation details

### Proposed Solution
- **Overview**: 1-2 sentences explaining the approach
- **Implementation Flow**: High-level steps in plain English
- **Technical Approach**: Code patterns that GUIDE but don't dictate
- **Key Considerations**: Edge cases, potential issues, design decisions

### Acceptance Criteria
- Each item should be independently testable
- Use checkboxes `- [ ]` so agents can mark completion
- Focus on observable outcomes, not implementation steps

---

## Examples

### Simple UI Feature

```markdown
# [FR-003] User Profile Page

## Labels
`MUS`, `enhancement`, `users`

## User Story
As a user, I want to view my profile, so that I can see my account information.

## Proposed Solution

### Overview
Create a profile page at `/profile` that displays user info from the session.

### Implementation Flow
1. Create `/app/profile/page.tsx` as a Server Component
2. Fetch user data from session
3. Display name, email, and role

### Technical Approach

```tsx
// app/profile/page.tsx
export default async function ProfilePage() {
  const session = await getSession();
  if (!session) redirect('/login');
  
  return <ProfileCard user={session.user} />;
}
```

### Key Considerations
- Handle unauthenticated users (redirect to login)
- Consider adding edit functionality later

## Acceptance Criteria

- [ ] Profile page exists at /profile
- [ ] Shows user name and email
- [ ] Redirects to login if not authenticated
```

### Complex Backend Feature

```markdown
# [FR-007] Payment Processing

## Labels
`MUS`, `enhancement`, `payments`, `critical`

## User Story
As an admin, I want to process payments, so that team members get paid.

## Proposed Solution

### Overview
Integrate with Paystack to process payouts to team members.

### Implementation Flow
1. Create Paystack service for API calls
2. Create transfer recipients from bank details
3. Initiate bulk transfers for approved payouts
4. Handle webhook callbacks for status updates

### Technical Approach

```typescript
// features/payments/paystack.service.ts
export const paystackService = {
  async createRecipient(bankDetails: BankDetails) { ... },
  async initiateTransfer(recipientCode: string, amount: number) { ... },
  async handleWebhook(event: PaystackEvent) { ... }
};
```

### Key Considerations
- Store Paystack recipient codes to avoid re-creating
- Handle failed transfers gracefully
- Verify webhook signatures for security
- Test mode vs live mode handling

## Acceptance Criteria

- [ ] Can create transfer recipients
- [ ] Can initiate single transfer
- [ ] Can initiate bulk transfers
- [ ] Webhook updates payout status
- [ ] Failed transfers are logged and retryable
```

---

## File Structure

**One Issue Per File** — Each FR gets its own file for GitHub ops compatibility.

```
docs/issues/
├── FR-001.md    # One file per FR
├── FR-002.md
├── FR-003.md
└── ...
```

### Sub-Issues (Optional)

If an FR is complex, the Genesis agent can create sub-issues within the same directory:

```
docs/issues/
├── FR-001.md           # Main issue
├── FR-001-a.md         # Sub-issue A (optional)
├── FR-001-b.md         # Sub-issue B (optional)
└── ...
```

Sub-issues should:
- Reference the parent: `## Parent: FR-001`
- Be smaller, focused tasks
- Still have their own acceptance criteria
