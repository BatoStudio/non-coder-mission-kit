---
name: mission-pr
description: Open a draft PR with evidence (only for projects in git branch-pr mode). Runs only when the user types /mission-pr.
disable-model-invocation: true
---

## When called

Only use when `git.mode` is `branch-pr`. In `local-main` mode (repo on this computer, commit straight to the main branch): instead of a PR, run `check --full`, `report`, `done`, commit with a message naming the ledger ids, and tell the project owner.

 Run `check --full`, `report`, `done`; rebuild the app from a clean checkout and run `web-smoke`; write `.mission/pr-body.md` from `progress.md`, `gates.md`, `ledger.md`, `checks.md`; push the working branch; `gh pr create --draft`.
If `done` has not PASSED yet: you may still open a draft PR, but the title and description must clearly state the conditions still missing.


# Release candidate and PR

## 1. Final gate

```bash
node "$MISSION_KIT/mission.mjs" check --full && node "$MISSION_KIT/mission.mjs" report && node "$MISSION_KIT/mission.mjs" done
```
Needs the `gh` command (GitHub CLI), logged in; without it, stop and report.

`done` has not PASSED → do not open a "finished" PR. You may open a **draft PR** that clearly states the conditions still missing.

## 2. Reproducible

- Rebuild the product from a clean checkout (`RC=$(mktemp -d) && git worktree add "$RC" HEAD`, without touching the working folder) using exactly the commands in the docs; compare size and extracted content with the current build. When finished, `git worktree remove "$RC"`.
- Write the build commands into the project's README/build docs if they are not there yet.

## 3. Push the branch and PR

```bash
git push -u origin <nhánh làm việc>      # hook chặn đẩy lên nhánh bảo vệ
gh pr create --draft --base <mainBranch> --title "<tóm tắt>" --body-file .mission/pr-body.md
```

Content of `pr-body.md` (written from real data):

- Goal and scope; link to `.mission/brief.md`.
- Coverage table (from `progress.md`), quality gates (`gates.md`), defects by severity (`ledger.md`).
- Check results (`checks.md`) — with tool versions (e.g. Node version, Playwright version).
- Visual / compatibility checks: list **only** the browsers/devices actually tried; state clearly what was not tried. Include 2–3 important snapshots from `.mission/shots/`.
- If there is a deploy: link to the preview, the way back (the `/mission-deploy` command).
- Known limits, open questions for the reviewer.
- Reference commit (HEAD), rebuild commands.

Do not call `gh pr merge`, `gh release …`, do not push release tags — those commands are blocked by the hook and are the project owner's decision. If the repo has a workflow that releases automatically on merge, say so clearly in the PR.
