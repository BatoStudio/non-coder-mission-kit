---
description: Check whether customer information is leaking out (before commit, publish, share, sending to another AI)
argument-hint: "[commit|publish|share|history] (or dang|chia-se|lich-su; empty = all)"
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Hand the check to the **mission-privacy-auditor** subagent: $ARGUMENTS (accept either the English or the Vietnamese word: `commit`; `publish` or `dang`; `share` or `chia-se`; `history` or `lich-su`. Empty = all: changes about to be committed, the build about to be published, files about to be shared, git history).
If the app has its own agent (`appSkills.privacy`, e.g. `privacy-auditor`), hand it to that agent. Save the report to `.mission/reviews/privacy-<date>.md`. Do not print word for word what was found. Report to the project owner in plain English: safe or not yet, how many places remain, how to fix each one.
