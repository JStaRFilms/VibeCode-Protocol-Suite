# Takomi Design UI Boundary

## Goal

Make the Takomi lifecycle unambiguous: **Genesis** owns product planning, requirements, architecture, data models, API contracts, and implementation strategy. **Design** owns UI/UX only.

This prevents agents from treating "design" as a general architecture phase.

## Scope

- Clarify `.pi` prompt routing so `vibe-design` is visual and experiential.
- Clarify the Codex plugin skill lifecycle modes.
- Clarify packaged asset workflows and agent mode text that mention Design.
- Leave implementation architecture guidance in Genesis or Architect planning surfaces.

## Design Boundary

Design is responsible for:

- visual sitemap and screen inventory
- brand direction, color, typography, spacing, layout, and component appearance
- interaction flows, user journeys, empty/loading/error states, and responsive behavior
- design system artifacts and page mockups
- accessibility and usability expectations for frontend implementation

Design is not responsible for:

- application architecture
- database schema
- API contracts
- backend service boundaries
- deployment strategy
- implementation task planning outside UI/UX handoff constraints

## Data Flow

1. Genesis creates or updates the PRD, feature docs, issue/task breakdown, architecture decisions, database schema, API contracts, and build strategy.
2. Design reads Genesis artifacts and produces UI/UX artifacts only.
3. Build implements against Genesis technical guidance and Design UI/UX artifacts.
4. Review checks both technical correctness and UI/UX adherence.

## Database Schema

No database schema changes. This is a prompt, workflow, and documentation clarification.

## Verification

- Search protocol surfaces for Design wording that still assigns architecture or schema ownership to Design.
- Run package validation after plugin skill edits.

## Implementation Notes

- Updated Pi core prompts so Design is explicitly UI/UX only.
- Updated Genesis prompts so planning, architecture, data models, API contracts, and implementation strategy stay in Genesis.
- Updated the Codex plugin skill lifecycle description so Codex does not route architecture or interface contracts to Design.
- Updated packaged asset workflows and mode files that imported agents are likely to read.
