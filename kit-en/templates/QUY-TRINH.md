# How to build an app (light version, no kit install needed)

Embed it in each app's CLAUDE.md with one line: `@../QUY-TRINH.md` (put this file in the parent folder that holds the apps, e.g. D:\APPS\).

## How to work
- Before a big change: state the plan in a few lines, commit/back up according to the app's rules, then do it.
- **Rewriting a large part or changing the architecture** (does not apply to bug fixes or ordinary new features): enter plan mode first (the project owner presses Shift+Tab, or Claude enters it on its own) — read the code, propose an approach, the project owner approves, and only then write code. Build the new version in a **git worktree** so the old version keeps running as is; run the same checks/reference samples on both, merge only if the new version is equal or better, then remove the old path. Data (samples, golden, node_modules) needed in the worktree must be **copied**, not linked with a junction/symlink. After merging: `git worktree remove`.
- Work in batches; group many fixes into one round. Run the full check and take snapshots only at milestones (end of a batch, before a commit), not after every small fix.
- Do not re-read large files — edit just the right section.
- Report briefly, in English: done · needs a decision · stuck. Use a table when it fits.

## Autonomy and when to ask
The project owner gives standing permission. The default is to keep going; only stop to ask for items on the ALWAYS ASK list.
- **Do it yourself, no separate report needed:** reading, searching, editing code within the scope of the assigned work, running tests/checks, draft scripts in the session's temp folder, writing the ledger/HANDOVER through the tools.
- **Do it, then report** (report in the summary at the end of the turn, do not ask first):
  - commit locally when checks are green and the privacy hook lets it through; commit messages use short codes; report the commit hash. In an app where a hook reports that the git history still has client information, still ask;
  - the next step in the brief or in an approved plan: once you have written «next, do X», do X right away, do not end the turn to wait for «continue»;
  - fix bugs in the same batch, run the 3 experts before calling it done;
  - when there are several approaches that can be rolled back with git: pick the most reasonable one, write down the reason.
- **Always ask:** deploy (live site or preview), push in an app that does not auto-push, merge, changing the database, deleting important data, switching the repo to public, money/accounts/keys, sending client or staff data outside, matters of taste (voice, images, logo), product decisions with a real trade-off, signing on behalf of the project owner (`--by human:`), and anything a hook has just blocked or asked about.
- Do not offer to deploy after every turn: group it into one sentence when the whole batch is done and the checks pass.
- Any command Claude can run itself, it runs itself and reads the result itself; only ask the project owner for things that need a password, 2FA, a permission approval, or software with a graphical interface. Do not tell the project owner to type /compact or open a new session in the middle of work: context compaction happens automatically, and the hook reloads what is needed.
- Reporting «done» must come with evidence seen with your own eyes (opened the page/file, a snapshot), not just «tests green».
- When you must ask: one sentence, in plain English, no technical codes; open the thing to look at beforehand and say clearly where it is; state the approach you propose.
- When a hook blocks: do not look for a way around it, do not retry the same way: read the message, do what it says, or stop and ask.

## ISSUE and TASK
- ISSUE (bug/note): record the location, why it is wrong, the **corrective action**, and the level CRITICAL / HIGH / MEDIUM / LOW. Notes (not wrong, but need a human to look) are kept separate from bugs.
- TASK (work to do): NOW / NEXT / LATER, with WHAT / WHO / WHEN, status ACTIVE / WAITING / BLOCKED / DONE.
- A bug that repeats 2 times or more: search the whole project, fix all of them, add a check so it does not come back.

## 3 experts before calling it done
The builder first reviews their own work twice (the 2nd time reading it as if someone else wrote it). Then **3 independent experts review in parallel**, each covering one area, none of them being the one who did the work:
1. Core / logic: is it correct, compare the version being edited with the committed version on every sample.
2. Data and edge cases: unusual, missing, or oversized input; privacy.
3. User / interface: is it usable, is it worth using, is there a better way?
Each one returns a list of bugs (level, how to reproduce, **how to fix**), writes `EVIDENCE MISSING` for parts that could not be checked, and a final line `VERDICT: PASS`, `PASS WITH FIXES` (only minor bugs left) or `FAIL`. The core reviewer always also asks: is there a **simpler** way? Fix → re-review the fixed parts, at most 3 rounds. Use only 1 expert (small jobs) when the project owner allows it.
Only report «done» when there is evidence (command + result) for each item of the Definition of Done.

## Always keep
- One source of truth: never let the same information need editing in two places.
- Do not write addresses, client names, or sample file names into logs, commits, or reports — use short codes.
- Do not deploy, do not change the database, do not push without the project owner's approval. Exception: an app where the project owner has turned on **auto-push after commit** (written with a date in `CLAUDE.md`, hook `tools/git-hooks/post-commit`): in that app, a commit is also a push.
- Keep the app's GitHub repo **private** (unless the project owner chooses otherwise); do not switch it to public without the project owner's approval.
- Results based on regulations (e.g. CDC, DCP, NCC in NSW) are preliminary: cite the clause source, do not state them as certain.
