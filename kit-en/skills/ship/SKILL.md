---
name: ship
description: Checks a finished change and — only when the project owner clearly says "yes"/"publish" (or "đăng") for exactly this version — deploys it to the live site, then checks after deploying, backs up, and records it in git. Use when the project owner says ship, deploy, publish, "đăng", "put it on the site", "update the site", or "run all the checks" before committing.
---

# Ship

The project owner may have no IT background: report in **plain English**, short and clear; keep technical terms as they are. If any step fails, **stop**, report the error, do not do the later steps.

## 0. If the app has its own version, use it

If the app folder has a `.claude/skills/ship/SKILL.md` that differs from this file, or its own publishing skill (e.g. `deploy`), or `.mission/config.json` has `appSkills.deploy` pointing to another skill: **read and follow that skill**, skip everything below.

The configuration for this general version is in `.mission/config.json → ship` (if it is not there, read `CLAUDE.md` to find the build/check/deploy commands; do not guess — if something is missing, ask the project owner once):

```json
"ship": {
  "checkCmd": "PYTHON=\"py -3\" sh ship.sh",
  "previewCmd": "npx wrangler pages deploy dist --project-name <tên-dự-án> --branch preview",
  "deployCmd": "npx wrangler pages deploy dist --project-name <tên-dự-án> --branch main",
  "siteUrl": "https://<tên>.pages.dev",
  "lockChecks": [ { "url": "https://<tên>.pages.dev/member/", "expect": "302" } ],
  "backupDir": "build/backup",
  "backupFiles": ["build/<tệp-build>.html"],
  "tag": true
}
```

`deployCmd` is the **LIVE SITE** (on Cloudflare Pages, `--branch main` = the live site). `previewCmd` is the preview version — leave it empty for apps that do not have one.

## 1. Check (always do this, no permission needed)

1. Work at the root of the app folder. The work must be committed (`git status --short` empty); if not, commit first.
2. Run the checks: `ship.checkCmd`; if there is none, `node "$MISSION_KIT/mission.mjs" check --full` (if the app uses the Mission Kit) or the check command in `CLAUDE.md`. A long-running command → run it in the background, write the log to `.mission/logs/` (apps using the Mission Kit; not committed) or the app's own log folder — **not** into the build folder if it is in `protect.deny`; read the end of it.
3. Any FAIL: read the log/snapshots, fix **in the source code** (never edit build files), rebuild, re-run. **Do not deploy while anything still FAILs.**
4. Report: version number/build id, commit, a table of check results (one line per item), and what has **not** been checked (real phone, touch screen, live site).

## 2. Deploy (only with a clear "yes")

- **Never deploy without a clear "yes"/"publish" (or "đăng") from the project owner for exactly this version, in the latest message.** Before that, ask one question that states the target clearly: "About to put version `<number>` on the **LIVE SITE** `<siteUrl>`" (or "on the **preview**"). The hook also asks before deploy commands — that is a second layer of checking, it does not replace the project owner's yes.
- **Check the locks first** (if there are `lockChecks`): each URL must return the exact code (e.g. the member page `302` to Cloudflare Access, locked files `403`). Wrong → stop, do not deploy.
- Deploy commands always **state the target explicitly** (the Pages/Worker project name). The Cloudflare account has many apps — do not deploy, edit or delete anything belonging to another app; do not use bare wrangler commands.
- **Choose the right command:**
  | Project owner wants | Command | Question before running |
  |---|---|---|
  | Preview | `ship.previewCmd` | "About to publish a **preview** of version `<number>` …" — `previewCmd` empty → stop, report "the app has no preview yet", do **not** use `deployCmd` instead |
  | Live site | `ship.deployCmd` | "About to put version `<number>` on the **LIVE SITE** `<siteUrl>` …" |
  The project owner only says "ship/publish" without being clear → ask again: preview or live site.
- Run the chosen command in the background, write the log to `.mission/logs/`, read the end of it, then delete the log. Deploy only when the build step prints success (deploying after a failed build can publish an empty folder).
- Login: use the wrangler session already on the machine. Expired → ask the project owner to run `npx wrangler login` themselves; do not type passwords yourself. Tokens/secret keys: never write them into files, commits, logs or answers.

## 3. After deploying

1. Repeat the `lockChecks` — all must be correct; if one is wrong, tell the project owner immediately.
2. `node "$MISSION_KIT/tools/web-smoke.mjs" <siteUrl> --no-shots` if the site is public; for pages behind Cloudflare Access, ask the project owner to open and check them (or use the browser if connected).
3. Back up: `node "$MISSION_KIT/mission.mjs" backup` (committed source code + `ship.backupFiles`, into `ship.backupDir`, default `build/backup/`; the backup folder gets its own `.gitignore` so it is not committed; works on Windows without bash). Apps not using the Mission Kit (PowerShell): `New-Item -ItemType Directory -Force build\backup | Out-Null; git archive --format=zip -o build/backup/src.zip HEAD` — and remember `build/backup/` must be in the app's `.gitignore`. Do **not** copy into a synced folder (Dropbox, OneDrive…) unless the app says so.
4. Git: commit (if there are still changes) and, if `ship.tag`, tag the version (`vNN`).
5. If the app uses the Mission Kit: write `.mission/release-notes/<version>.md` (what changed, bugs fixed with ledger ids, limitations, how to roll back to the previous version).

## 4. Report to the project owner (plain English, a few lines)

1. Version/build id and commit now on the site; checks passed.
2. How to check on the site and how to update the installed app (if it is an installable app: press Update).
3. What is new, what to try — one or two lines; what has not been checked.
4. Path to the backup; how to roll back to the previous version if needed.

## Things that have caused problems before (Windows)

- Call Python with `py -3` (the bare `python` command is a Windows Store fake).
- `\` in paths inside commands is easily swallowed — use `/`.
- A page that is already open keeps the old version until it is reloaded.
