---
name: mission-handover
description: Writes the handover between sessions so the next session does not have to re-read the whole repo — overwrites .mission/HANDOVER.md, updates HTC/LT/ledger/manifest. Use when finishing a batch of work, before stopping a session, when the session has grown long (context compaction coming), or when the project owner types /mission-handover, says «handover», «session handover» or «bàn giao phiên». DIFFERENT from mission-handoff (sending to ChatGPT for review).
---

# Session handover — avoiding «re-reading the whole world»

The `session-start` hook already loads into the start of every session (also after context compaction): the kit status, **HANDOVER**, **current HTC**, **active ledger** (open entries). The `pre-compact` hook automatically takes a snapshot of the machine state (git, NOW, open ledger entries) into `.mission/state/auto-handover.md` before compaction. This skill handles what the machine cannot do on its own: **write down what only Claude knows**.

## 5 layers and length limits

| # | File | Preloaded? | Limit | Written by |
| --- | --- | --- | --- | --- |
| 1 | `.mission/HANDOVER.md` | yes | 60 lines | Claude, **overwritten** at the end of the session |
| 2 | `.mission/HTC.md` (current) | yes | 150 lines | Claude; old version → `.mission/archive/HTC-<yyyymmdd>.md` |
| 3 | Active ledger (open entries) | yes, ≤10 entries | — | only the `ledger` CLI |
| 4 | `.mission/LT.md` (Inventory: files/modules/terms/shared functions → location) | **no** — grep only | — | Claude, 1 line per entry |
| 5 | `.mission/manifest.json` | **no** — look up by id | — | `scan`, `unit set` |

Going over a limit makes the hook cut and report — that is a signal to shorten, not to raise the limit.

## Rules while working

1. Start from what is already loaded. Do **not** re-read the whole repo to «get back up to speed on the project».
2. Need to know where X is → `grep` in `.mission/LT.md` first, then read exactly the right file and the right part (offset/limit).
3. Do not read: `.mission/archive/`, closed ledger entries, old HTC, `progress.md`/`ledger.md`/`gates.md` (reports that can be regenerated), logs, builds.
4. A file recorded in the manifest whose fingerprint has not changed → trust the manifest status, do not re-read it.
5. Broad search across many files → the `mission-explorer` subagent (Haiku, search/read only), take only its conclusion.
6. Long output → filter it (`--summary`, `| tail -20`); do not paste file contents back into answers, cite `file:line`.

## When handing over (end of batch / end of session / session has grown long)

1. **Close ledger entries first**: finished ledger entries → `node "$MISSION_KIT/mission.mjs" ledger close <id> --verify "…"`. Do not write bug status into HANDOVER — the active ledger is the source of truth.
2. **New conventions** → edit `HTC.md`. For big changes: copy the old version to `.mission/archive/HTC-<yyyymmdd>.md` first.
3. **New files/modules/terms** → add 1 line to `LT.md`: `<name> — <path[:line]> — <one sentence on its role>`. New feature → section «Features»: `<feature> — <folder> — <functions/concepts it owns>` (best written right when created; the post-edit hook will remind you).
4. **Units changed** → `node "$MISSION_KIT/mission.mjs" scan`.
5. **Overwrite** `.mission/HANDOVER.md` following the template `templates/HANDOVER.template.md` (≤ 60 lines). Write only what is not recorded elsewhere: where work is in progress (file:line), 1–3 NOW items in order, new decisions (already moved into plan.md/HTC or not), traps just discovered, what **does not need re-reading**.
6. Do not append history. Keeping history is the job of git and the ledger.

## Start of session (when HANDOVER is missing or marked CŨ (stale))

Rebuild it from `git log -10 --oneline`, the active ledger, the NOW section of `plan.md` and the automatic snapshot (if the hook loaded it) — then write a new HANDOVER. Tell the project owner in one line. Do not scan the whole repo.

## Do not

- Do not delete HANDOVER/HTC/LT; do not edit `ledger.jsonl`, `manifest.json`, `state/` by hand (the hook blocks it).
- Do not write addresses, customer names, real money amounts into HANDOVER/HTC/LT — use short codes.
