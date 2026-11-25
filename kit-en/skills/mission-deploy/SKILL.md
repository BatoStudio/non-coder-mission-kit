---
name: mission-deploy
description: Deploy the app in stages (preview → project owner approves → live site) with a way back. Runs only when the user types /mission-deploy; if the app has its own deploy skill (appSkills.deploy), use that skill.
disable-model-invocation: true
argument-hint: "[preview | production]"
---

# Safe deploy

Mode: `$ARGUMENTS`. Empty or `preview` = **preview only**. Only the word `production` may put it on the **LIVE SITE**.

**By default, use the skill `ship`** (`appSkills.deploy`; `ship` hands over to the app's own version by itself if there is one). This skill only adds: checking the gates first (section 1), the stage rules (section 2) and the release notes (section 3).

## 1. Before deploying (both preview and production)

1. `node "$MISSION_KIT/mission.mjs" check --full` GREEN (the CLI prints «XANH»); `done` has no CRITICAL/HIGH defects still open.
2. No secrets in the code (lint rule `bi-mat`): `service_role` keys, API tokens, passwords. The Supabase `anon` key may only be in the browser when Row Level Security is enabled for every table.
3. Permissions reviewed (Cloudflare Access / RLS), subagent `mission-security-reviewer` PASS.
4. Database changes: there is a migration (skill `mission-db-migration`), tried on a copy, with a way to roll back; permission tests (`mission-access-test`) green.
4b. **No customer information exposed**: subagent `mission-privacy-auditor` (or `appSkills.privacy`) reviews exactly the folder about to be published → PASS.
5. **The way back is written down**: which deployment/commit is currently running, how to go back to it. No way back → no deploy.

## 2. Stage rules

| Mode | Command used | Condition |
|---|---|---|
| preview (default) | `ship.previewCmd` | The project owner has said «yes» for this time. **Config has no `previewCmd` → STOP**, tell the project owner: "This app has no preview command yet; it only has a command that puts it on the live site." Do not use `deployCmd` instead. |
| production | `ship.deployCmd` | The project owner has looked at the preview (or the app has no preview and the project owner accepts that), **and** the project owner's latest message contains the word «yes» after the question below. |

Before running production, ask exactly one question, with the important part in capitals:

> About to put version `<version / commit>` on the **LIVE SITE** `<siteUrl>` — customers/staff will see it straight away. Way back: `<how to roll back>`. Reply **yes** to publish.

The `guard-bash` hook also asks before every deploy command (`deploy/publish/ship` commands, `wrangler`, `vercel`, `netlify`, and exactly `ship.deployCmd`/`previewCmd` in config). That is a second layer, and does **not** replace the word yes.

After deploying: `web-smoke <URL>`; for a site with login, try one account that is allowed and one that is not (or ask the project owner to open it and check).

## 3. Release notes

Create `.mission/release-notes/<version>.md`: what changed for users (in plain words), defects fixed (ledger ids), known limits, how to go back to the previous version. Backup: `node "$MISSION_KIT/mission.mjs" backup` (in the app folder, not Dropbox).
