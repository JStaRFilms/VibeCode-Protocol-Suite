# Task BLD-003: Improve OAuth-Router Report UI

## 🔧 Agent Setup
Follow `vibe-build`. Read `.pi/extensions/oauth-router/commands.ts`, provider/state/types, Pi TUI docs, and existing report command behavior.

## Objective
Replace plain string-array report widgets with readable themed report components, make health/quota/account state scannable, and provide predictable replacement/dismissal without changing routing or credential behavior.

## Scope
- `/router-status`, `/router-accounts`, `/router-usage`, `/router-quota`, `/router-usage-raw`, report-style login/account operations, and help/hint surfaces.
- One report widget key should replace prior content predictably.
- Add a clear/dismiss command or documented toggle using Pi-supported widget removal; reports must not remain stale indefinitely.
- Keep footer health status live.
- Theme-aware headings/status/icons/quota bars; bounded summaries and readable detailed sections.
- Avoid duplicated `notify()` where the widget/footer already confirms success; retain login/device-code instructions, warnings, failures, cancellation, and attention notifications.

## Visual Standard
Use native Pi restraint: no raw debug JSON walls, no duplicated headings, no excessive prose. Health and quota should scan quickly. Raw report remains detailed but formatted. Use active theme and terminal-width-aware layout. Sanitize presentation controls without changing underlying values.

## Definition Of Done
- Reports are themed, width-aware, and readable at 40/60/120 columns.
- Healthy/degraded/disabled/auth-failed/cooldown/penalty states are distinct.
- Provider quota versus locally observed usage is clearly labeled.
- Running a new report replaces the prior widget.
- User can dismiss the report predictably; session/command lifecycle does not resurrect stale content.
- No account secrets/tokens are newly exposed.
- Routing, OAuth, quota collection, and state behavior are unchanged.
- Focused tests and full `npm test` pass.

## Constraints
Only change `.pi/extensions/oauth-router` and focused tests/package wiring. Do not touch runtime/context/subagent files, `nul`, orchestration docs, or unrelated `assets/.agent/skills/shared-resend-portfolio/`.

## Verification
Test status/accounts/usage/raw/help/action reports, replacement/dismissal, narrow widths, control sanitization, secret redaction, and notification retention. Run `npm test` and `git diff --check`.