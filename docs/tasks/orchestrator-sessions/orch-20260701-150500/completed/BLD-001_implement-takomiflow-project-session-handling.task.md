# BLD-001 - Implement TakomiFlow project session handling

## Objective

Update request parsing, CLI/MCP surfaces, browser session helpers, generation flow, docs, and tests so generations reuse a project, wait robustly for the UI, and recover bad chats by starting a new chat in the same project.

## Agent Setup

- Follow the Takomi Codex skill.
- Load relevant project docs and policies before implementation.
- Update this task file with outcome notes.

## Definition Of Done

- [ ] Scope completed
- [ ] Docs updated where needed
- [ ] Verification recorded

## Notes

Keep files below the 200-line pressure point by extracting a focused helper module if needed.

## Update 2026-07-01T16:10:09

Implementation approved by user. Starting request/session contract and browser project reuse changes.

## Update 2026-07-01T16:17:24

Implemented project-session request fields, CLI/MCP wiring, flow-project-session helper, generation reuse behavior, same-project fresh chat recovery, schemas, capabilities, templates, settingsPlan metadata, skill, and docs.
