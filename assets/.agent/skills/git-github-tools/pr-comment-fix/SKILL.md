---
name: pr-comment-fix
description: >
  Automate fixing GitHub PR review comments. Use this skill whenever the user asks to
  "fix PR comments", "address review feedback", "resolve PR threads", or references
  a PR number/branch with unresolved review comments. Also trigger when the user says
  things like "go through the review comments on my PR", "handle the feedback on #123",
  or "clean up the review notes". Requires the `gh` CLI to be authenticated.
---

# PR Comment Fix Workflow

Checkout a PR branch, fetch unresolved review comments, fix each one, commit, reply, resolve, and push — all in one pass.

## Prerequisites

Before starting, verify `gh` is authenticated:

```bash
gh auth status
```

If it fails, stop and tell the user to run `gh auth login`.

## Step 1: Identify the PR

Determine the target PR from the user's message. They might give you a PR number (`#142`), a branch name (`feature/new-parser`), or a URL. Normalize to a PR number early:

```bash
# If given a branch name, find its open PR
gh pr list --head <branch-name> --state open --json number --jq '.[0].number'
```

Once you have the PR number, fetch the branch name and check it out:

```bash
gh pr checkout <pr-number>
```

This ensures you're on the exact branch the PR tracks — not a stale local copy.

## Step 2: Fetch unresolved review comments

Pull all review comments and filter to unresolved threads. Each comment has a thread ID, file path, line number, and body.

```bash
gh api graphql -f query='
  query($owner: String!, $repo: String!, $pr: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $pr) {
        reviewThreads(first: 100) {
          nodes {
            id
            isResolved
            comments(first: 10) {
              nodes {
                body
                path
                line
                author { login }
              }
            }
          }
        }
      }
    }
  }
' -f owner='{owner}' -f repo='{repo}' -F pr=<pr-number>
```

Extract `{owner}` and `{repo}` from the current git remote:

```bash
gh repo view --json owner,name --jq '"\(.owner.login) \(.name)"'
```

Filter to threads where `isResolved` is `false`. If every thread is already resolved, tell the user there's nothing to fix and stop.

## Step 3: Triage comments

Not every comment is actionable code feedback. Classify each unresolved thread:

- **Actionable** — requests a concrete code change (rename, refactor, fix bug, add validation, change logic, etc.)
- **Question / Discussion** — asks "why did you do X?" or debates an approach with no clear fix directive
- **Nit / Style** — trivial formatting or naming preferences
- **Praise / Acknowledgement** — compliments, thumbs-up, "looks good"

Fix **Actionable** and **Nit/Style** comments. For **Question/Discussion** threads, draft a reply but flag them for the user to review rather than guessing at a code change. Skip **Praise** threads entirely (don't resolve them — the author may want them visible).

## Step 4: Fix each comment

For each actionable comment, in the order they appear per-file:

1. **Read the file at the referenced path.** If the path no longer exists (file was renamed or deleted since the review), note this in your reply and skip.
2. **Locate the relevant code.** The line number in the comment refers to the diff, which may have shifted. Use the comment's surrounding code context to find the right location in the current file — do not blindly trust line numbers.
3. **Make the fix.** Apply the smallest change that fully addresses the feedback. If the reviewer's suggestion is ambiguous, prefer the most conservative interpretation.
4. **Validate the fix compiles/parses.** After each file edit, run the project's build or lint command if one is configured. Catch errors before committing. Validate against the current branch worktree — never against `main` or any other branch.

### Commit strategy

Group related fixes into logical commits rather than one commit per comment. Good groupings:

- All nit/style fixes in one commit
- Fixes in the same file or module together
- A single complex fix that touches multiple files in its own commit

Commit message format:

```
fix(review): <concise summary of what changed>

Addresses PR #<number> review feedback:
- <thread 1 summary>
- <thread 2 summary>
```

## Step 5: Reply and resolve threads

After committing the fixes, reply to each addressed thread and then resolve it:

```bash
# Reply to the thread
gh api graphql -f query='
  mutation($threadId: ID!, $body: String!) {
    addPullRequestReviewThreadReply(input: {pullRequestReviewThreadId: $threadId, body: $body}) {
      comment { id }
    }
  }
' -f threadId='<thread-id>' -f body='<reply>'

# Resolve the thread
gh api graphql -f query='
  mutation($threadId: ID!) {
    resolvePullRequestReviewThread(input: {threadId: $threadId}) {
      thread { isResolved }
    }
  }
' -f threadId='<thread-id>'
```

Reply guidelines:

- For straightforward fixes: `"Fixed — <brief description of what changed>."`
- For nits: `"Done."`  or `"Fixed, good catch."`
- For discussion threads you didn't change code for: Draft a substantive reply explaining the reasoning, but **do not resolve** — leave it for the user.

## Step 6: Push

```bash
git push
```

If the push is rejected (e.g., remote has new commits), rebase first:

```bash
git pull --rebase origin <branch-name>
```

If rebase conflicts arise, stop and tell the user — don't auto-resolve merge conflicts in a PR fix workflow.

## After completion

Summarize what you did:

1. How many threads were fixed and resolved
2. How many threads were replied to but left open (discussion/questions) — list these so the user can review
3. How many threads were skipped (praise, already resolved)
4. The commit SHAs created

If any fixes felt uncertain or the reviewer's intent was ambiguous, call those out explicitly so the user can double-check before the next review round.

## Error handling

- **`gh` not found or not authenticated** — Stop immediately, tell the user to install/auth `gh`.
- **No open PR for the given branch** — Tell the user; the PR may be closed or merged.
- **Comment references deleted file** — Reply noting the file no longer exists, skip the fix, don't resolve.
- **Build fails after a fix** — Revert that commit, note it in the summary, move on to other fixes.
- **Rate limiting from GitHub API** — Pause and retry with backoff. If persistent, batch remaining replies and tell the user.

---

Source: https://gist.github.com/GSonofNun/35c67304c35dac7d6b43308b5371f671
