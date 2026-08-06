# Zack Production Suite

Use `SKILL.md` as the only agent entry point. It routes into four internal skills:

1. legacy Higgsfield end-to-end producer;
2. TakomiFlow Google Flow provider;
3. browser research/pre-production planner;
4. local Flow production executor.

The browser planner and local producer communicate through the shared Zack
Production Package contract in `resources/shared/contracts/`.

## Recommended installation

Copy the entire `zack-production-suite` folder into the location your agent uses
for skills. Point the agent to the root `SKILL.md`; do not register all four
internal modules as simultaneous top-level triggers unless your harness requires
it.

## Quick validation

```bash
python resources/shared/scripts/validate_handoff.py \
  resources/shared/templates/zack-project/handoff.json
```

The template is intentionally `DRAFT` and has an empty generation queue, so it
validates as a no-spend starter package.
