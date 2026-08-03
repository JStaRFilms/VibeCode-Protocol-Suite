# Harness Review

Notes on the context-mode / subagent harness as presented through its tool surface.
Caveat: this is a read-of-the-descriptions review, not a behavioural one. Nothing here
was validated by running the tools.

## Core assessment

The central idea is sound. "Think in code, print only the derived answer" is the right
instinct: running a script over a 700KB log and emitting a 3KB summary preserves
reasoning capacity in a way that reading the log never can. Pairing that with an
FTS5/BM25 index, so bulk content is *retrievable* rather than *resident*, is the correct
architecture for long sessions.

## Pushback

### 1. The tool surface is crowded

There are two overlapping delegation systems (`subagent` and `takomi_subagent`), two
supervisor channels (`intercom` and `subagent_supervisor`), three skill-loading tools
(`skill_index`, `skill_manifest`, `skill_load`), and three policy tools.

Every ambiguous pair costs a decision that has to be made correctly under uncertainty,
and the failure mode is silent: the wrong one gets picked and nobody sees the fork.
Consolidating or clearly scoping the duplicates would buy more reliability than any new
capability.

### 2. "Read/edit files -> ctx_execute_file" is wrong for edits

`ctx_execute_file` is an *analysis* surface. It hands code a `FILE_CONTENT` variable and
returns whatever gets printed. It cannot produce a reviewable diff.

For anything being modified, the exact text has to be in hand to match against, so
`read` then `edit` is correct. Routing edits through the sandbox means writing files
blind.

### 3. `ctx_batch_execute`'s ranking overlaps its actual value oddly

It sits at the top of the hierarchy, but its real advantage is fetch parallelism plus
inline queries. For a single command with short output it is strictly more overhead than
`bash`. Treating it as a default rather than a batch-and-query tool adds ceremony to
trivial steps.

## Keep untouched

- Auto-indexing outputs above ~5KB with an `intent` label.
- Per-call TTL on fetches.
- The `background: true` escape hatch for servers and daemons.

These are small, well-chosen affordances.

## Suggested next step

Exercise the harness rather than reading it: run `ctx_doctor`, check `ctx_stats`, and
confirm the indexing and search paths behave as advertised. An opinion drawn from tool
descriptions is worth less than one drawn from watching the thing work.
