---
name: conventional-commits
description: >
  Analyze a real Git diff and propose a Conventional Commits message grounded in
  the actual changes. Use when asked to "write a commit", "commit message",
  "conventional commit", or when preparing to commit work in this repository.
  Selects type and scope from the diff, writes clear English subjects, flags
  breaking changes, and refuses to invent changes that are not in the diff.
license: MIT
---

# Conventional Commits

## Purpose

Turn the real content of a Git diff into a single, standards-compliant
Conventional Commits message. The message must describe only what the diff
actually changes, pick a correct `type` and a coherent `scope`, and explain the
*why* when it is not obvious from the code.

This skill is scoped to **authoring commit messages** for this project. For
branching strategy, release/semver, changelogs, and PR workflow, defer to the
`git-workflow-and-versioning` skill instead of restating it here.

## When to Use

- The user asks to write a commit message or a conventional commit.
- Work is finished and staged (or about to be staged) and needs a message.
- A large change needs to be split into several atomic commits, each with its
  own message.

## Mandatory Pre-Flight: Read the Diff First

Never write a message from memory or from the chat description alone. Inspect
the actual changes:

```bash
git status                 # what is staged vs unstaged vs untracked
git diff --staged          # the exact staged changes the message must describe
git diff                   # unstaged changes (decide if they belong in this commit)
```

If nothing is staged, say so and propose what to stage — do not describe
changes that are not part of the commit.

Rules that follow from this:

1. **Never invent changes.** Every claim in the message must trace to a hunk in
   the diff.
2. **Never mix independent concerns.** If the diff touches auth and dashboard
   for unrelated reasons, propose two commits.
3. **Flag secrets.** If the diff adds `.env`, keys, tokens, or credentials, stop
   and warn before proposing a commit. Do not include secret values in the body.
4. **Recommend splitting** when the diff is large (> ~300 lines or > 1 logical
   change). Propose the split, one message per atomic commit.

## Format

```
<type>(<scope>): <description>

<optional body — explains why, wrapped at 72 cols>

<optional footer — BREAKING CHANGE / issue refs>
```

- Subject uses the **imperative mood**: "add", "fix", "remove" (not "added").
- Keep the subject ≤ 50 chars where possible; hard cap 72.
- No trailing period on the subject.
- Scope is optional but preferred; omit it only when no single module applies.
- Write messages in **English**, matching the ecosystem convention.

## Types

| Type       | Use for                                                        |
|------------|----------------------------------------------------------------|
| `feat`     | A new feature or user-facing capability                        |
| `fix`      | A bug fix                                                       |
| `docs`     | Documentation only                                             |
| `style`    | Formatting/whitespace, no behavior change                      |
| `refactor` | Code restructuring that neither adds a feature nor fixes a bug |
| `perf`     | A change that improves performance                             |
| `test`     | Adding or correcting tests                                     |
| `build`    | Build system or dependency changes (package.json, Prisma gen)  |
| `ci`       | CI configuration and scripts                                   |
| `chore`    | Maintenance that doesn't touch src or tests                    |
| `revert`   | Reverting a previous commit                                    |

When several could apply, pick the one matching the *primary intent* of the
diff. A feature that ships with its tests is still `feat`; a pure test addition
to existing code is `test`.

## Scope

Scope names the affected module. For this project (FitMind AI) use the module
the change belongs to, e.g.:

`auth`, `profile`, `workouts`, `nutrition`, `dashboard`, `recommendations`,
`exercises`, `food`, `db`/`database`, `api`, `ui`, `config`.

- Derive the scope from the paths in the diff (e.g. changes under
  `src/features/nutrition/**` → `nutrition`).
- Use one scope. If the change truly spans modules for one reason, omit the
  scope rather than listing several.

## Breaking Changes

Signal a breaking change in **both** ways when it removes or changes a contract
consumers depend on (API shape, DB schema a migration can't auto-handle, public
function signatures):

- Add `!` after the type/scope: `feat(api)!: ...`
- Add a footer: `BREAKING CHANGE: <what breaks and how to migrate>`

## Body and Footer

- Add a body only when the *why* is non-obvious, or to record a decision,
  trade-off, or migration note. Skip it when the subject is self-explanatory.
- Reference issues in the footer: `Closes #42`, `Refs #17`.
- Bullets use `-`.
- Do not add AI-attribution trailers unless the project explicitly requires one.

## Examples

```
feat(auth): implement user authentication
```

```
feat(workouts): add personalized workout plans
```

```
feat(nutrition): calculate daily calorie targets

Use Mifflin-St Jeor for BMR, apply the activity multiplier for TDEE,
then adjust by goal (e.g. -15% for fat loss). Clamps the result to a
safe floor so the planner never proposes an unsafe deficit.
```

```
fix(dashboard): correct progress chart calculation
```

```
test(workouts): add progression validation tests
```

```
docs(api): document nutrition endpoints
```

```
refactor(database): optimize workout relationships
```

Commit without a scope (cross-cutting):

```
chore: update dependencies to latest minor versions
```

Breaking change:

```
feat(api)!: replace /v1/plans with /v1/programs

BREAKING CHANGE: clients using GET /v1/plans must switch to
GET /v1/programs. The old route is removed, not aliased.
```

With a body explaining a decision and linking an issue:

```
fix(nutrition): prevent calorie target below BMR

A -25% deficit combined with a low TDEE produced targets under the
user's BMR. Clamp the target to max(BMR, computed) and surface a
"consult a professional" note instead.

Closes #231
```

## Validation Checklist

Before presenting a message, confirm:

- [ ] Every statement maps to a real hunk in the diff — nothing invented.
- [ ] `type` matches the primary intent of the change.
- [ ] `scope` matches the module from the changed paths (or is intentionally omitted).
- [ ] Subject is imperative, ≤ 72 chars, no trailing period.
- [ ] Independent concerns are split into separate commits.
- [ ] Breaking changes carry both `!` and a `BREAKING CHANGE:` footer.
- [ ] No secrets, credentials, or `.env` contents are introduced or quoted.
- [ ] Body is present only when it adds non-obvious context.

## Execution Boundaries

- Only propose the message as a ready-to-paste code block.
- Never run `git commit`, `git add -A`, or `git push` without explicit user
  authorization in the current turn.
- When staging is needed, propose specific files (`git add <path>`), never a
  blanket `git add .`.
