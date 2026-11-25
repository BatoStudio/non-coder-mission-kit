# Non-coder Mission Kit — Claude Code for non-programmers

[Tiếng Việt](README.vi.md) · **English**

A reusable way of building apps with Claude Code, made for people who are not programmers. Your apps live in `D:\APPS` by default; change this with the `MISSION_APPS_ROOT` environment variable. The kit packages a working method (a **3-expert review**, every defect logged with a corrective action, a Definition of Done, NOW/NEXT/LATER planning) into:
- 25 skills: 23 `mission-*` skills plus `ba-chuyen-gia` ("three experts") and `ship`. They include `mission-video` for narrated videos and `mission-github` for backing up code to a private GitHub repo.
- 8 independent reviewer subagents.
- 16 slash commands (11 commands plus 5 skills you call with `/`).
- 7 automatic hooks, including a protection layer for client data and secret files.
- A tool that keeps a defect ledger and quality gates.

> **Language.** The kit comes in two languages: Vietnamese (the default) and **English**. Add `--lang en` when you install (step 3 below) to get the English skills, agents, commands and templates; Claude then talks to you in English. Names stay the same in both versions (`/mission-init`, `ba-chuyen-gia`…). The safety hooks and the `mission.mjs` tool still print their messages in Vietnamese: the English install tells Claude to read them and explain them to you in English. Reinstalling without `--lang` keeps the language you chose last time. To switch back to Vietnamese: `node install.mjs --lang vi --project "D:\APPS\MY APP"`. Files the kit already wrote in your app's `.mission/` folder (plan, LT, HANDOVER) stay in the language they were written in. On a new computer the kit is not committed, so always add `--lang en` when you reinstall.

**The kit does not replace what you already have.** Your app's own hooks, skills and agents keep working as before. Everything in the kit starts with `mission-`, so it never overwrites anything of your app's. The kit does nothing in an app until you run `/mission-init` there.

There are two ways to use it:

| | Light | Full |
| --- | --- | --- |
| What it is | One process file, `QUY-TRINH.md`, that each `CLAUDE.md` includes | The kit installed into an app |
| Enforced | No, only advice | Yes: blocking hooks, defect ledger, gates, `done` |
| Tokens | Almost none extra | About 2–3 thousand extra per session, plus reviews when you ask for them |
| Good for | Any app, today | New apps, or apps that must be right (rules and codes, client data) |

## Light way (2 minutes)

1. Copy `kit-en/templates/QUY-TRINH.md` (English) or `kit/templates/QUY-TRINH.md` (Vietnamese) into `D:\APPS\`.
2. Add one line at the top of your app's `CLAUDE.md`: `@../QUY-TRINH.md`
3. The first time you open the app, Claude Code may ask whether it may read a file outside the app folder. Say yes.

## Full way: start in 5 minutes (Windows)

0. **Check that your computer has the tools.** Open PowerShell (press Start, type `powershell`, press Enter):
   ```powershell
   node -v          # must show v18 or later
   git --version    # must show "git version …"
   Test-Path "C:\Program Files\Git\bin\bash.exe"   # must show True
   claude --version # must show a Claude Code version number
   ```
   If a line shows an error or `False`, install that tool first:
   - Node.js (nodejs.org, the LTS version).
   - Git for Windows (git-scm.com; it includes Git Bash).
   - Claude Code (claude.com/claude-code).

   Optional: the GitHub CLI `gh` (for `mission-github`) and `wrangler` (if you deploy to Cloudflare). **Without Node, none of the kit's hooks run, and nothing tells you so.** After installing, close PowerShell and open it again.

   Only if you will make videos (`mission-video`), also check:
   ```powershell
   py -3 --version   # must show Python 3.x (use py -3, not python, which is a Windows Store stub)
   ffmpeg -version   # must show "ffmpeg version …"
   ```
   The Kokoro voice needs two model files, `kokoro-v1.0.onnx` and `voices-v1.0.bin` (338 MB), in `%USERPROFILE%\.cache\kokoro`. If you don't have them, download them from the kokoro-onnx releases page (`model-files-v1.0`, github.com/thewh1teagle/kokoro-onnx/releases). Install the libraries with `py -3 -m pip install kokoro-onnx edge-tts soundfile numpy scipy pyloudnorm pillow`. Vietnamese narration uses Edge (`--engine edge`, the female voice vi-VN-HoaiMyNeural, needs internet). Details are in `kit/skills/mission-video/references/voice.md`.
1. Download the kit, for example into `D:\APPS\_tools\non-coder-mission-kit`:
   ```powershell
   git clone https://github.com/BatoStudio/non-coder-mission-kit "D:\APPS\_tools\non-coder-mission-kit"
   ```
   Or, on GitHub, press **Code → Download ZIP** and unzip it into `D:\APPS\_tools\`. The unzipped folder is called `non-coder-mission-kit-main`: rename it to `non-coder-mission-kit` so the commands below work.

   If your apps are not in `D:\APPS`, set the `MISSION_APPS_ROOT` environment variable. Use absolute paths, and separate several folders with `;`. Without it, the kit cannot tell which folders are real apps when they sit outside `D:\APPS`.
2. Stay in the same PowerShell window for step 3.
3. Type these commands one by one. Change the app name to yours, and keep the quotes if the path has spaces:
   ```powershell
   cd "D:\APPS\_tools\non-coder-mission-kit"
   node install.mjs --lang en --project "D:\APPS\MY APP" --dry-run   # preview only, writes nothing
   node install.mjs --lang en --project "D:\APPS\MY APP"             # real install (English version)
   ```
   When it finishes you will see the line `Done (one app: …). Kit language: English.` What the installer changes in your app:
   - **Hooks** go into `.claude/settings.local.json`, which applies to this computer only.
   - **Model settings:** it adds exactly two keys to the app's `.claude/settings.json`, `"model": "sonnet"` and `"advisorModel": "fable"`. Claude then works with Sonnet and asks Fable for advice. If the app already set other values, the installer **keeps them and tells you**. If your Claude plan has no Fable, change `advisorModel` (for example to `opus`) or delete that key. Uninstalling removes only the keys the kit wrote.
   - **`.gitignore`:** it adds a block of lines so the kit's copy is never committed. Commit that change once.

   If you clone the app onto another computer, run the install command again there.

   **Try it on a side app first** for 1–2 weeks, then install it on your main app.
4. Open Claude Code in the app folder. In PowerShell type `cd "D:\APPS\MY APP"`, then `claude`, or open that folder in the Claude app. Type `/mission-status`. If it says to run `/mission-init`, the kit is installed correctly.
5. **Talk your idea through with ChatGPT to write a brief.** The installer prints these steps at the end. In short:
   - Get the prompt: run `node install.mjs --lang en --brief-prompt` in the kit folder. The English prompt is printed and **already copied to the clipboard**. Or open `kit-en/templates/HUONG-DAN-BRIEF-CHATGPT.md` and copy the block «Prompt to paste into ChatGPT».
   - Open ChatGPT, start a new chat, paste the prompt (Ctrl+V), then describe your app idea in plain words. ChatGPT asks back in groups, at most 5 questions at a time. If you don't know an answer, just say so.
   - When ChatGPT outputs the brief (one markdown block, 15 sections), press Copy and paste it into Notepad. **Save it as `brief.md` in the app folder.** In "Save as type" choose *All files* and set Encoding to *UTF-8*, so it doesn't become `brief.md.txt`.
   - Don't want to use ChatGPT? Type `/mission-brief` in Claude Code and Claude asks the questions and writes `brief.md` itself.
6. In Claude Code (opened in the app folder), type `/mission-init brief.md`. Claude will:
   - read the brief, then the app's existing hooks, skills and scripts;
   - connect them to the kit;
   - write the spec and a NOW/NEXT/LATER plan, then ask you all remaining questions at once.

**Uninstall:** `node install.mjs --uninstall --project "D:\APPS\MY APP"`. This removes only the files the kit installed. It returns `settings.json`, `settings.local.json` and `.gitignore` to **exactly the bytes** they had before the install. If you edited those files after installing, it removes only the kit's part and keeps your edits. The `.mission/` folder is kept.

**Install for the whole computer:** do this only after it has worked well on 1–2 apps. Command: `node install.mjs --lang en --global`. Note: the descriptions of the 20 auto-loading skills, 8 agents and 11 commands (about 3 thousand tokens) are then loaded in **every** Claude Code session, even in apps that don't use the kit. If an app has both the global copy and its own copy, the hooks run only once (the app's copy), but skills and commands appear twice. Pick one.

To run automatic UI tests (`web-smoke`), install once in each web app: `npm.cmd i -D playwright`, then `npx.cmd playwright install chromium`. In PowerShell, type `npm.cmd`/`npx.cmd` to avoid the error «npm.ps1 cannot be loaded».

## Commands

| Command | What it does |
| --- | --- |
| `/mission-brief [app name or idea]` | **Run before `/mission-init`** when you start a new project. Claude asks questions in groups A–K (at most 5 per turn, with default answers). It writes a 15-section `brief.md` and a `brief-chatgpt.md` for ChatGPT to critique. Nothing is sent out on its own: you paste it yourself, or say clearly «gửi giúp» ("send it for me") |
| `/mission-init [file]` | Sets up the app: spec, config, connects existing skills and hooks |
| `/mission-status` | Real progress, short |
| `/mission-sync [full\|no-site]` | A quick, read-only check, answered in 3 lines: uncommitted work, branches not yet on GitHub, whether the repo is still private, which commit the live site runs and how many commits are not deployed yet |
| `/mission-next [n]` | Works through the highest-priority batches until done or until it needs your decision |
| `/mission-review <unit> [nhanh\|full]` | Runs `ba-chuyen-gia` by default (3 experts in parallel); `nhanh` ("quick") = 1 subagent; at most 3 rounds |
| `/mission-tidy [measure\|plan\|do <batch>\|finish]` | Code clean-up. `measure` finds duplicated code, clashing names, and long files or functions. `plan` has 3 experts plan it. `do` works one small batch, and regression results must match exactly. `finish` shows a before/after table. The Vietnamese words `đo`, `kế hoạch`, `làm`, `kết thúc` also work |
| `/mission-fix <L-xxxx\|description>` | Fixes a defect in 10 steps, with a corrective action, and scans for the same mistake elsewhere |
| `/mission-options <problem>` | Options → Compare → Check → Critique → Decide |
| `/mission-verify` | Checks before a commit, and re-checks every "done" claim |
| `/mission-deploy [preview\|production]` | Deploys in stages, through the `ship` skill by default |
| `/mission-privacy [commit\|dang\|chia-se\|lich-su]` | Checks whether client information leaks out (agent `mission-privacy-auditor`). `dang` = posting, `chia-se` = sharing, `lich-su` = git history |
| `/mission-new-sample <short name>` | Adds a new drawing set or house sample to a drawing-reading app: read → overlay → you mark it up → fix by rule → keep old samples → lock the result |
| `/mission-handover [note]` | Session handover: rewrites `HANDOVER.md`, closes the ledger, updates HTC/LT/manifest so the next session doesn't reread the whole repo |
| `/mission-handoff <unit> <round>` | Packs a review round for ChatGPT: evidence, records, a fingerprint, a check that private information is masked, all written to an outbox in the app (`handoff.exchangeDir`, e.g. `docs/reviews/outbox`). Claude then opens ChatGPT in **Claude's own browser** to send it and read the verdict. You sign in yourself; no Dropbox. This works only in the Claude desktop app; if you run `claude` in a terminal, you paste it yourself. The verdict is saved word for word |
| `/mission-pr` | Advanced: only for the `branch-pr` git mode |

## Two familiar skills: `ba-chuyen-gia` and `ship`

They work in **any app**, even one that doesn't use the Mission Kit. Say «3 chuyên gia» ("3 experts") or «phản biện» ("critique") to call the three experts. Because this costs tokens, an ordinary phrase like "check again" only makes Claude ask you first. Say «ship» or «đưa lên site» ("put it on the site") to check and then publish.

| Skill | What it does |
| --- | --- |
| `ba-chuyen-gia` | 3 independent reviewer agents run in parallel, each on one area: core/logic · data and edge cases · user/interface. Each agent compares the working copy with the committed version on every sample. They don't edit files and don't print addresses or sample names. Claude then reports to you, fixes, reruns the tests, commits, and lists what was not fixed. The three areas can be set per app (`threeExperts.areas`). |
| `ship` | Check (always) → **deploy only when you clearly say «yes»**, after a question that states «TRANG THẬT» (the LIVE site) or «bản xem trước» (a preview) → check locks before and after the deploy → back up inside the app folder (`mission.mjs backup`, works on Windows) → git → report. Each app's own commands go under `ship` in the config: `previewCmd` = preview, `deployCmd` = live site. |

`/mission-deploy` on its own = **preview only**. If the app has no preview command, Claude stops and tells you; it never publishes to the live site by itself. To go live you must type `/mission-deploy production`.

**If an app has its own version, its own version is used.** For example, if an app already has its own `ba-chuyen-gia` or `ship` skill, the installer doesn't copy the kit's version over it. With a global install, the kit's version also reads and follows the app's version.

## Installing skills from GitHub: check first, install after

An unknown skill is instructions for Claude plus code that runs with your permissions. It can read every file, use the connectors you have turned on, and use the `wrangler` session on your computer. Type `/mission-skill-audit <GitHub link>`:
1. Claude downloads the skill into an isolated folder **outside the app** (the computer's temp folder).
2. It scans the skill read-only and runs nothing from it.
3. It reads every script from 3 angles (supply chain · Cloudflare/deployment · AI agents).
4. It rates the skill **GREEN / YELLOW / RED**.

Only when you say «cài» ("install") does Claude copy exactly the checked version into the app's `.claude/skills/`, recording the link and SHA in `SOURCE.md`. It never adds third-party marketplaces, because a self-updating marketplace would replace the checked version.

**Checking what is already installed:** type `/mission-config-audit` at any time. Three independent experts (supply chain · Cloudflare DevSecOps · AI agent security) review the app and `~/.claude`: plugins, skills, agents, hooks, MCP, connectors, permissions, auto-update settings, git hooks, CI, dependencies and `wrangler.toml`.
- It is **read-only**: it runs no script or hook, never opens secret files (it only notes they exist), and calls no connector.
- The report gives file:line, evidence, severity, a fix, and whether more investigation is needed.
- It is saved in `.mission/reviews/` only if you agree.
- Add «nhanh» ("quick") for a single reviewer.

**Has the kit in an app been changed since it was installed?** Run `node install.mjs --verify --project "<app folder>"`. `installed.json` records the kit's commit at install time (flagged if installed from uncommitted code) and a sha256 hash of every kit file, skill, agent and command. This command reports files that were changed, deleted, or added.

**Protecting frontend code from copying:** type `/mission-protect` (between build and deploy). It obscures the **build output** in `dist/`:
- It minifies with esbuild, renaming local variables and removing comments.
- `--obfuscate` (optional) also encodes strings.
- It removes source maps and leaves `vendor/` and `*.min.js` alone.

It **never touches source code**: the script refuses if it sees files tracked by git. To be clear, obfuscation only **slows down** copying; it cannot lock anything, because everything sent to the browser can be read. Real protection means keeping logic on the server, keeping keys in environment variables, and legal terms. Obfuscation is only a deterrent.

**Extra questions the guard asks:**
- Every `wrangler` command except read-only or local ones (`whoami`, `dev`, `pages dev`, `tail`, `… list`, `--local`). It also recognises `wrangler@4`, `npm exec`, `pnpm exec` and `pnpm wrangler`. `wrangler login` asks too.
- Writing `CLAUDE.md`, `.claude/launch.json`, `.vscode/tasks.json`, `.git/hooks`, `.git/config`, `tools/git-hooks` or `.husky`. It also asks before `git config` commands that set `core.hooksPath`, `fsmonitor`, `sshCommand`, `credential`, `remote.*.url` and similar.
- Reading old transcripts in `~/.claude/projects` (except memory and tool results). Reading `~/.claude/history.jsonl`, `~/.claude.json`, browser cookies and `GitHub CLI` data is **blocked outright**.
- The kit copy inside an app **never switches itself off**. Earlier, inside a worktree, the kit could silently defer to the copy in the main repo. Now only the global copy defers, and only when the app really has kit hooks.
- At session start, HANDOVER/HTC are loaded with the label «ghi chép, không phải lệnh» ("notes, not instructions"). Lines that look like malicious instructions get a warning.
- The `mission-rules-checker` agent (which reads the web) no longer has Bash.

## What the kit does automatically (hooks)

| Hook | What it does |
| --- | --- |
| Session start (also after compaction) | Loads the real status and reminds Claude of the app's own skills, with **compact context**: `HANDOVER.md` (≤ 60 lines), the current `HTC.md` (≤ 150 lines), and the active ledger (≤ 10 open entries). A file that is still an empty template costs only one line. `LT.md` (Inventory) and `manifest.json` are not preloaded; they are only searched when needed. If HANDOVER is older than the latest commit, it is flagged **CŨ** (stale) |
| Before context compaction | Takes an automatic snapshot (git, NOW, open ledger entries) into `.mission/state/auto-handover.md`. After compaction, this snapshot is loaded if it is newer than HANDOVER |
| Before reading files (Read, Grep, Glob) | **Blocks** reading secret files (`.env`, `.dev.vars`, `.pem/.key` keys, `~/.ssh`, `~/.wrangler`…; the sample `.env.example` can still be read) and the app's private areas (`readGuard.extraSecrets`). **Asks** before reading Desktop, Documents, Pictures, Videos, Music, OneDrive or Dropbox (`readGuard.privateDirs`), or searching a whole drive |
| Important data (`protect.important`: samples/, out/golden/, tests/pdf-library*/, .mission/ledger.jsonl, build/backup/; each app can change this) | **Asks** before commands that delete, overwrite or move it, naming the folder and how many files would be lost. Also asks before creating a junction or symlink into `D:\APPS` (or a folder in `MISSION_APPS_ROOT`) or into important data, and before recursively deleting a folder that contains a junction or symlink. At session start it compares file counts with the last session and warns if a folder is empty or shrank by more than 20%. `check --full` reports dangerous junctions in Claude's temp folder and in worktrees |
| Before editing files | Blocks editing build files, samples, source data, and **the kit's own files** (so Claude can't switch off its own protection). Asks before editing Claude Code settings (`settings.json`), deployment config, rules and expected results. The ledger and gates can only be written through the tool. **Locked lines** (`protect.lockedText`): the file can be edited, but that line cannot. **Sending to ChatGPT** (`handoff`): content written to the outbox (`exchangeDir`, inside the app) must pass the masking check. Only text in the outbox may be pasted into ChatGPT, and a verdict file can be written only once. **Asks** before adding or changing a skill, agent, command, hook, plugin or `.mcp.json` (in the app and in `~/.claude`), because those are new code and new instructions for Claude. |
| Before running commands (Bash and PowerShell) | **Blocks:** force-push, deleting remote branches, creating git aliases, merging PRs by itself, releasing by itself, and writing or deleting the ledger or protected areas, including through `*`, variables, PowerShell aliases or symlinks.<br>**Asks first:** every `git push`; deploy commands (`deploy`, `wrangler`…, and the exact commands in `ship`, saying whether it is the LIVE site or a preview); database changes; SQL deletes; `reset --hard`; recursive deletes **outside** the app folder; commands that print `.env` files or tokens; reading private folders; searching a whole drive; copying into the exchange folder when the hook can't check the content.<br>**Privacy at commit time:** it checks exactly what goes into the commit, including the commit message. It blocks the commit when it finds:<br>• a street address (by default only clear suffixes such as Street, Road, Avenue — `privacy.addressCheck`; it recognises only Australian/English-style addresses, so add patterns to `privacy.patterns` for other countries);<br>• a name on the block list, or a sample-set name or address taken from `privacy.sampleDirs`;<br>• a file with a forbidden extension (`privacy.blockCommitExtensions`, e.g. `.pdf`).<br>`privacy.blockPush` blocks pushes (including `gh repo … --push` and remote changes) while the history still contains client information. The block message points to `file:line`. If test data uses fake street names, declare them in `privacy.allowPatterns`.<br>The hook reads commands the way a real shell does: text inside a commit message, a ledger note or a heredoc body is not treated as a command, and cleaning a build folder (`rm -rf dist`) does not trigger a question. When one line holds several commands, the strictest result wins.<br>**Asks** before installing a skill, plugin or MCP (`npx skills add`, `claude plugin install`, `claude mcp add`), a global package (`npm i -g`), or downloading code and running it straight away (`curl … \| sh`, `irm … \| iex`). |
| After editing | Catches secret keys (Anthropic, OpenAI, Cloudflare, Supabase, AWS…) and runs quick checks on exactly the file just edited. Blocks code that may reach the browser if it mentions private data (`privacy.clientCode`). **Reminds** you, without running them, of slow tests (for example ones that need desktop software) when you edit the matching files (`checks.remind`). **Keeps code tidy from the start** (`tidy.onEdit`, on by default): it warns at once when the edited file has clashing names, a function with the same name as one in another file, or duplicated blocks. If you create a new file without adding it to the `.mission/LT.md` map (the «Tính năng» / Features section), it reminds you. It only warns, never blocks |
| When Claude is about to stop | Only **reminds** if the checks are stale; it doesn't block, to save tokens. To block instead, set `stopGate.mode: "block"` |

## Rules the tool enforces

- Every defect must have a **corrective action** (`--fix`). Notes (`attention`) are kept separate from defects and don't block.
- Every pass or fail needs evidence. An independent review gate must include the subagent's report file, and its last line must be `KẾT LUẬN: PASS` (verdict: pass) or `KẾT LUẬN: PASS KÈM SỬA (…)` (pass with fixes). If it still says `FAIL` or `THIẾU BẰNG CHỨNG` (missing evidence), the tool refuses.
- Waiving a CRITICAL/HIGH defect requires `human:<your name>`.
- **No street addresses or client names** in the ledger: the tool refuses them. You can point it at the app's existing block list.
- **Fixing and then committing doesn't get around the checks.** The kit remembers each file's content at check time. If a file changes afterwards (even if committed), or a check command in the config changes, the old result is marked **CŨ** (stale) and `done` reports not passed. In a folder that isn't a git repo, `done` never passes.
- `done` also checks that:
  - the declared scope matches the files present (adding a new sample without a `scan` means not passed);
  - no blocker is open at any level;
  - the ledger has no broken lines;
  - the report was generated after the last change to the ledger, gates or checks.
- An **independent review gate** cannot be set to "NA" unless the project owner writes `human:<name>`.
- **Sample file names that look like addresses** (even run together, like `12QuokkaAvenue`) are renamed by `scan` to short codes (`m-xxxxxx`). `manifest.json` is never committed. Check-command output and plan excerpts copied into reports have addresses masked.
- Two sample files with the same name in two folders → `scan` stops and reports it (otherwise one file's gate would count for the other).
- A defect that repeats 2 or more times makes the tool remind you to scan the whole project.
- If the ledger has a broken line, the tool won't add more. Run `node "$MISSION_KIT/mission.mjs" ledger repair` to move broken lines to `ledger.bad.jsonl` (kept word for word).
- `mission.mjs backup` backs up into `ship.backupDir` (default `build/backup`, inside the app, no Dropbox). It puts its own `.gitignore` inside the backup folder and doesn't touch the app's `.gitignore`.
- A file whose only change is line endings (Windows CRLF ↔ LF) is not treated as edited.

## Git

| Mode | When | Rules |
| --- | --- | --- |
| `local-main` (default) | The repo is on your computer; commit straight to `main` as save points | Commit freely; `git push` asks first; force-push is blocked |
| `branch-pr` | Working with others through GitHub | Work on your own branch, never commit to `main`, hand over through a PR |

**Backing up to GitHub (the `mission-github` skill):** creates a **private** repo, pushes the branches, and opens it in GitHub Desktop. Optionally it can **push automatically after every commit**, switched on only when you say "yes" for each app (the date is recorded in the app's `CLAUDE.md`).
- The app's `tools/git-hooks/post-commit` hook is run by git, so it does **not** go through the kit's `git push` question.
- It stops by itself when `privacy.blockPush` is `true`. It runs in the background and logs to `build/git-push.log`.
- On a new computer, run `git config core.hooksPath tools/git-hooks` again.
- Before each automatic push, the hook scans the commits not yet on GitHub. If it finds a token, a private key or a `.env`/`.dev.vars`/`.pem` file, it **does not push** and writes `SKIPPED … possible secret` to the log (file name only, never the secret).

## Glossary

| Term | Meaning |
| --- | --- |
| Skill | Instructions Claude reads by itself when the matching task comes up |
| Subagent | A helper Claude that runs separately for an independent review (read-only, reports only) |
| Hook | A check that runs automatically before or after each thing Claude does |
| Commit | A save point in git that you can go back to |
| Branch / PR | A separate working copy / a request to merge it into the main copy. Used only in `branch-pr` mode |
| Gate | A quality criterion (G1–G8) that must pass, with evidence |
| 3-level verdict | `PASS` (clean) · `PASS KÈM SỬA` (pass with fixes: only minor defects left, which must be logged) · `FAIL` (a serious defect, or missing evidence on an important part) |
| THIẾU BẰNG CHỨNG | "Missing evidence": the reviewer states what they could not check, instead of silently passing it |
| Ledger | The defect log: where, why it was wrong, the corrective action, and how it was verified |

## Contents

- **Skills:** `ba-chuyen-gia`, `ship`, `mission-run`, `mission-init`, `mission-app-spec`, `mission-repo-recon`, `mission-rules-engine`, `mission-drawing-check`, `mission-web-qa`, `mission-defect-loop`, `mission-quality-gates`, `mission-regression`, `mission-deploy`, `mission-pr`, `mission-tidy`, and these:
  - `mission-access-test`: permission tests (who must NOT see or edit what).
  - `mission-db-migration`: add-only database changes with a way back.
  - `mission-new-sample`, `mission-handoff`.
  - `mission-handover`: session handover, so the next session doesn't reread the whole repo.
  - `mission-video`: script → Kokoro voice → background music → logo → MP4.
  - `mission-skill-audit`: checks an unknown skill or plugin from GitHub before installing it.
  - `mission-config-audit`: 3 experts check, read-only, every plugin, skill, hook, MCP and permission installed for the app and for the computer.
  - `mission-protect`: obscures the frontend build against copying; only touches `dist/`, never the source.
  - `mission-github`: private GitHub repo, GitHub Desktop, and auto-push after commit if you turn it on.
- **Subagents** (each declares its `model:`; the main session's advisor `advisorModel` = fable). They review and only report:
  - `mission-checker`, `mission-evaluator`, `mission-rules-checker`, `mission-security-reviewer`, `mission-privacy-auditor` (opus);
  - `mission-verifier`, `mission-visual-qa` (sonnet, cheaper);
  - `mission-explorer` (haiku; finds and reads, with Read/Grep/Glob only).

  The main session uses sonnet.
- **Tools:** `mission.mjs` (ledger, gates, checks, reports, `done`), `kit/tools/web-smoke.mjs`, `kit/tools/rules-audit.mjs`.
- **Example config** (`kit/templates/examples/`): `cdc-granny-flat`, an app that looks things up in planning rules.
- **Brief template:** `kit/templates/HUONG-DAN-BRIEF-CHATGPT.md`, which shows how to have ChatGPT write a brief to pass to `/mission-init`.
- **The kit's own tests:** `bash tests/run-tests.sh`. It runs on Windows with Git Bash; on Linux fewer cases run, because the Windows-only ones are skipped. There are no cases yet for `mission-video`; that skill is checked by eye and ear (see step 7 in the skill).
- **Auto-push:** `tools/git-hooks/post-commit` pushes the current branch after every commit (GitHub Desktop commits included). It runs in the background and logs to `build/git-push.log`. Turn it on per computer with `git config core.hooksPath tools/git-hooks`, and again after a fresh clone. If it is off, nothing pushes automatically.

## Advanced

- **GitHub CI:** `kit/templates/ci/mission-check.yml`. It downloads the kit while it runs, because `.claude/mission-kit/` is never committed. It only checks; it never deploys.
- **`bash.freeDirs`:** places where shell commands may write, edit or delete without asking. Default: the system temp folder, `%TEMP%/claude/**` and `build/logs/**`. Targets are normalised (`../`, symlinks, junctions, cygpath) before the check. Anything that lands in `.mission/`, `.claude/mission-kit/` or `protect.deny` is still blocked.
- **Running commands on Windows:** the kit replaces `$MISSION_KIT` with the real path and uses Git Bash if available. Without Git Bash it uses cmd.exe, and then the commands in `checks` must not use sh-only syntax.

## Known limitations

- **Old-style Cloudflare tokens (40 characters, no `cfut_` prefix):** the `bi-mat-cloudflare` pattern is only in the new config. Apps installed earlier must add this pattern to `.mission/config.json` themselves (section `lint.rules`, copied from `kit/templates/config.template.json`).
- **Feature map and name-clash checks:** the after-edit hook arrives as soon as you reinstall the kit (`node install.mjs --lang en --project "<app folder>"` for the English version). Only newly initialised apps get the `tidy --conflicts` step in `checks.full` and the «Tính năng» (Features) section of `.mission/LT.md`. Apps installed earlier must add that step to `checks.full` themselves (copy it from `kit/templates/config.template.json`) and add the section to `LT.md` (copy it from `kit/templates/LT.template.md`). An app that already has clashing names will show red at this step in `check --full`: log it in the ledger, then clean up with `/mission-tidy`.
- **The case «H1: tệp có \ trong tên» (a file with `\` in its name) is skipped on Windows**, because Windows doesn't allow `\` in file names.
- **A hard link to `.env` cannot be detected by its path.** A hard link is another name for the same data, with no "real" path to compare, so the read hook cannot recognise it. Symlinks and junctions are checked by their real target.
- **The kit has been used for real on only a few apps, on Windows.** The full test suite passes on Windows with Git Bash, including a test install and uninstall (after uninstalling, hooks and permissions are identical to the original). Try it on a side app first.
- **The command-blocking hook is a pattern-based safety net, not an absolute barrier.** For example, a `node -e "…"` or `python -c "…"` snippet that writes a file still gets through, and so does `cd samples; rm a.pdf` in one command. The hook sometimes asks about or blocks a harmless command. When that happens, read the reason and type the command more explicitly.
- **The independent review gate still relies on trust.** The main agent is the one that saves the report file. In return, every gate leaves a trail that can be checked.
- **The kit is written for Windows** (PowerShell, Git Bash). macOS/Linux: not tested yet.
- The kit has not been checked for conflicts with your computer-wide `.claude` setup (`~/.claude`).
