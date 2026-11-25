---
name: mission-github
description: Put an app's source code on GitHub as a private repo (sign in to gh, create the repo, push every branch), open it in GitHub Desktop, and turn on auto-push after each commit. Use when the project owner says "put it on GitHub", "back up to GitHub", "create a repo", "auto-push", "open GitHub Desktop", or moves the app to another computer and needs auto-push turned on again, or asks "is it on GitHub yet", "which version is the site running" (the `/mission-sync` command). Every step that sends anything out needs the project owner's "yes".
argument-hint: "[create | auto-push | desktop | new-machine]"
---

# GitHub for the app (private)

Arguments: `create` (or `tạo`), `auto-push` (or `tự-push`), `desktop`, `new-machine` (or `máy-mới`) — accept either the English or the Vietnamese word.

Purpose: GitHub is a **private backup** of the source code. The repo is always **private**. Never switch it to public without the project owner's "yes".

Every step marked 🔒 sends something out. Say clearly what you will do, then **wait for the project owner to answer "yes"** before running it. One "yes" covers only that exact step.

## 0. Check first (read only)

```bash
gh --version; gh auth status            # Windows: "C:\Program Files\GitHub CLI\gh.exe" nếu gh chưa có trong PATH
git remote -v; git branch -a; git count-objects -vH
git config --get core.hooksPath; ls .git/hooks | grep -v '\.sample$'
```

- **No `gh` yet:** stop, ask the project owner to install GitHub CLI (winget `GitHub.cli`), then continue.
- **`privacy.blockPush` is `true`** in `.mission/config.json`: **stop completely**. The git history still contains customer information and must be cleaned first. Tell the project owner, push nothing.
- **Privacy:** run the `mission-privacy-auditor` agent (or `appSkills.privacy`) on the **whole git history**, not only the current version. If there are addresses, customer names, customer sample files → stop and report.
- **Size:** `size-pack` above ~500 MB or videos/large files in the history → tell the project owner first (GitHub blocks files > 100 MB).
- **Secret files:** `git ls-files | grep -Ei '\.env|\.dev\.vars|secret|token|\.pem$|\.key$'` must be empty.

## 1. Sign in to GitHub CLI

- Sign in **in the project owner's terminal window**, not in the background: when run in the background, the device code expires before the project owner has time to paste it.
  Open a terminal tab and run:
  ```bash
  gh auth login --web --git-protocol https
  ```
  The project owner pastes the code into the page `https://github.com/login/device` and clicks to allow. Wait for the project owner to say "done".
- Then make git use this same sign-in:
  ```bash
  gh auth setup-git
  ```
- The token lives in the Windows keyring. **Never** write the token into a file, commit, log or message.

## 2. 🔒 Create a private repo and push every branch

Ask the project owner: the repo name (suggest the app folder name, lowercase, joined with `-`), the account (default is the signed-in account: `gh api user -q .login`), push all branches or only the main branch.

```bash
gh repo create <tài khoản>/<tên> --private --description "<một dòng>" --source . --remote origin
git push -u origin --all            # hoặc: git push -u origin <nhánh chính>
gh repo view <tài khoản>/<tên> --json visibility -q .visibility     # phải in PRIVATE
git fetch origin && git branch -vv  # mỗi nhánh có [origin/...], không "ahead"
```

(Placeholders: `<tài khoản>` = account, `<tên>` = repo name, `<một dòng>` = one-line description, `<nhánh chính>` = main branch. The visibility check must print PRIVATE; every branch must show `[origin/...]` and not "ahead".)

The push command goes through the kit's hook and asks again; that is normal.
Do not push tags (`--tags`). Do not force-push.

## 3. Open in GitHub Desktop

```bash
"$LOCALAPPDATA/GitHubDesktop/bin/github" "<thư mục app>"
```

If Desktop is not installed: winget `GitHub.GitHubDesktop`. The first time it opens, the project owner signs in to GitHub inside Desktop (File → Options → Accounts).
Desktop only reads the repo on this computer. Commits made in Desktop still run the repo's git hooks, including the auto-push from step 4.

## 4. 🔒 Turn on auto-push after each commit (optional)

Only do this when the project owner clearly says "yes, auto-push" **for this app**. Why you must ask: the hook is run by git, not through the kit's protection layer. Once it is on, every commit, including commits from GitHub Desktop, goes up to GitHub without asking again.

Do not do it when:
- `privacy.blockPush` is `true`.
- `core.hooksPath` already points somewhere else, or `.git/hooks/` has real hooks (not `*.sample`). `core.hooksPath` replaces the **whole** `.git/hooks` folder, so the old hooks would stop running. Stop and ask the project owner.

Steps:

1. Copy the hook into a **folder that git tracks** in the app, do not point at the kit copy inside `.claude/` (git ignores that folder, so other computers would not have it):
   ```bash
   mkdir -p tools/git-hooks
   cp "$MISSION_KIT/../skills/mission-github/scripts/post-commit" tools/git-hooks/post-commit
   chmod +x tools/git-hooks/post-commit
   git update-index --add --chmod=+x tools/git-hooks/post-commit 2>/dev/null || true
   ```
   (`$MISSION_KIT` points to `.claude/mission-kit`; the skill lives in `.claude/skills/mission-github/`. If you cannot find it, take it from the original kit `<original kit folder>\kit\skills\mission-github\scripts\`.)
2. Keep LF line endings for the hook (Windows may change them to CRLF on clone, which breaks the hook). Add to the app's `.gitattributes`:
   ```
   tools/git-hooks/* text eol=lf
   ```
3. Turn it on for this computer:
   ```bash
   git config core.hooksPath tools/git-hooks
   ```
   The kit's guard will **ask** at step 1 (writing into `tools/git-hooks/`) and at this step (`core.hooksPath`), because git hooks run by themselves on every commit. That is by design: the project owner clicks allow, having already said "yes" above.
4. Make sure `build/` is in `.gitignore` (the log is at `build/git-push.log`).
5. Write one dated line into the app's `CLAUDE.md`: auto-push turned on at the project owner's request, where the hook is, where the log is, and that a new computer must run the command from step 3 again.
6. Commit (the hook, `.gitattributes`, `CLAUDE.md`). This very commit is the test:
   ```bash
   cat build/git-push.log              # đợi vài giây: phải có dòng "OK"
   git fetch origin && git status -sb  # không còn "ahead"
   ```
   (Wait a few seconds: the log must have an "OK" line; the status must no longer show "ahead".)

Turn auto-push off: `git config --unset core.hooksPath`, then edit the line in `CLAUDE.md`.

**Secret scan before pushing.** Before every push, the hook scans every commit not yet on GitHub. It looks for tokens (GitHub, AWS, Anthropic, OpenAI, Slack, Google, Stripe, JWT), private keys (`BEGIN … PRIVATE KEY`), assignment lines like `API_KEY = "…"`, and the files `.env`, `.dev.vars`, `*.pem`, `*.p12`, `id_rsa`, `credentials.json`. If it finds any, it **does not push**, and writes `SKIPPED … possible secret` into `build/git-push.log` with the commit id and file name (not the secret). When you see this line:
1. Tell the project owner in plain words: which commit, which file. Do **not** print the file's contents in chat.
2. If it is a real secret: treat it as already exposed on this computer, remind the project owner to **change/revoke** that key. Then remove it from the unpushed commits (e.g. `git reset --soft origin/<branch>`, drop the file, add it to `.gitignore`, commit again). Removing it only from the latest commit is not enough: the hook still sees it in the unpushed history. Rewriting history needs the project owner's agreement.
3. If it is a false alarm (sample string, test data): add the comment `mission:allow-secret` on exactly that line and commit again. A file caught because of its **name** but containing no secret (a public `.pem` certificate…) → write its path, one file per line, into `tools/git-hooks/allow-secret-files` (git tracks this file). Ask the project owner before adding it. There is no way to turn the scan off for the whole repo.

## 5. New computer / fresh clone

```bash
gh repo clone <tài khoản>/<tên> "<thư mục>"     # cần bước 1 trên máy đó trước
cd "<thư mục>" && git config core.hooksPath tools/git-hooks   # chỉ khi app đã bật tự push
node "<kit>/install.mjs" --project "<thư mục>"                # cài lại Mission Kit nếu app dùng kit
```

(Line 1 needs step 1 on that computer first; line 2 only if the app has auto-push turned on; line 3 reinstalls the Mission Kit if the app uses the kit — add `--lang en` after `install.mjs` to keep the English version.)

Do not keep the app folder inside a synced Dropbox folder (git and Dropbox step on each other).

## 6. Cross-check (read only, `/mission-sync`)

```bash
sh "$MISSION_KIT/../skills/mission-github/scripts/git-check.sh"   # hoặc tools/git-check.sh nếu app có bản riêng
```

(Or `tools/git-check.sh` if the app has its own copy.)

Prints 3 lines: **Máy** (this computer: uncommitted files), **GitHub** (each branch compared with GitHub, PRIVATE repo, auto-push, last push),
**Site** (the commit running on Cloudflare Pages according to `wrangler pages deployment list`, whether that commit is on GitHub yet, how many commits are not yet deployed).
`--full` adds detail, `--no-site` skips the site part. It finds a `wrangler.toml` with `pages_build_output_dir` by itself; if none is found it skips the site part
(set it by hand: `--pages <name> --account <id>`). If there is a «CHÚ Ý» (attention) line, say in one sentence what should be done, then wait for "yes"; do not push or deploy on your own.

## 7. Report to the project owner

In English, briefly:
- The repo link, and the check result (PRIVATE).
- Which branches went up.
- Whether auto-push is on or not.
- What the project owner needs to do, if anything (sign in to Desktop, run a command on another computer).
