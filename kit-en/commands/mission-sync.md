---
description: Quick check: do the commits, GitHub and the live site match (read only)
argument-hint: "[full | no-site]"
---
Run the check tool (read only, no push, no deploy). If the app has `tools/git-check.sh`, use it; otherwise use the kit's version:

```bash
S=tools/git-check.sh; [ -f "$S" ] || S="$MISSION_KIT/../skills/mission-github/scripts/git-check.sh"; sh "$S"
```

If `$ARGUMENTS` contains `full`, add `--full`; if it contains `no-site`, add `--no-site`.

**Answer very briefly, in plain English:**
- Copy exactly the 2–3 result lines (Máy (this machine) / GitHub / Site). Do not explain further when every line is OK.
- If there is a CHÚ Ý (attention) line: add **one** sentence saying what to do (for example "push the main branch?"). Do not push, deploy or commit on your own: wait for the project owner to say "yes".
