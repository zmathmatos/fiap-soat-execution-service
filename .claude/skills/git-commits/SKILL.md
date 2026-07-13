---
name: git-commits
description: Use when the user asks to commit changes, write a commit message, or amend a commit message in this repo. Generates commit messages that follow the Conventional Commits format already used in this project's history (feat, fix, refactor, chore, docs, etc.), optionally with a scope.
---

# Git Commits (Conventional Commits)

Generate commit messages for this repository following the [Conventional Commits](https://www.conventionalcommits.org/) format:

```
<type>(<optional scope>): <short summary>

<optional body>
```

## Steps

1. Run `git status` and `git diff --staged` (fall back to `git diff` if nothing is staged) to see exactly what changed. Never guess the contents of a commit from conversation context alone.
2. Run `git log --oneline -10` to confirm current style conventions haven't drifted.
3. Pick the `type` that matches the *primary* intent of the change:
   - `feat` — a new feature or capability
   - `fix` — a bug fix
   - `refactor` — code change that neither fixes a bug nor adds a feature
   - `chore` — tooling, dependencies, build config, maintenance (e.g. `chore(deps): ...`)
   - `docs` — documentation only
   - `test` — adding or fixing tests only
   - `style` — formatting only, no code meaning change
   - `perf` — performance improvement
   - `ci` — CI/CD pipeline changes
4. Add a `scope` in parentheses when it clarifies *where* the change applies (e.g. `fix(docker)`, `chore(deps)`, `fix(cd)`). Omit the scope when the change is broad or a scope wouldn't add clarity — this repo's history mixes both styles.
5. Write the summary in imperative mood, lowercase after the colon, no trailing period, focused on *why*/*what changed* rather than restating the diff line by line.
6. Only add a body when the summary line isn't enough to explain the motivation (non-obvious constraint, breaking change, follow-up needed). Keep it to 1-3 short sentences or bullet points. Don't add a body just to restate the diff.
7. Never invent a `BREAKING CHANGE:` footer or issue references unless the user mentions them.

## Style notes specific to this repo

- Real examples from history: `feat: added a new endpoint for creating OS by the customers`, `fix(cd): configure New Relic agent fully via env vars (bypass file config)`, `chore(deps): upgrade newrelic agent 12.5.0 -> 14.x for Express 5 support`, `refactor: remove authentication to the service order creation by customer`.
- No commitlint/commitizen is configured here — style is enforced by convention, not tooling, so match the tone above rather than a stricter external spec.
- When multiple unrelated changes are staged together, prefer asking the user whether to split the commit rather than writing one summary that tries to cover everything.

## Output

This skill only drafts the message — it never runs `git commit` (or any other git command that mutates the repo). Output the drafted message as plain text, in a fenced code block so it's easy to copy, and nothing else. Do not stage files, create the commit, or ask the user whether to commit; if the user wants it committed, that's a separate explicit instruction.
