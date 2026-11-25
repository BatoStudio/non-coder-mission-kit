---
name: mission-rules-engine
description: Encode planning/building rules and drawing conventions as data with cited sources, fix guidance and test cases. ONLY use in a project that already has .mission/config.json; if the app has its own rules skill, use that skill.
---

# Rules as data you can verify

A wrong rule in the app is more dangerous than a broken button: users trust it and lodge applications based on it. Every rule must be traceable to the original document and checked against real projects.

## 1. Each rule is a data record, not `if`s scattered through the code

Store in `rules/` (JSON/YAML/JS object), one single source for every app that shares it. Minimum fields:

```json
{
  "id": "cdc-sd-ppos-min-area",
  "title": "Không gian riêng ngoài trời chính (PPOS) tối thiểu",
  "applies": { "pathway": "CDC", "type": "secondary-dwelling", "zones": ["R2"] },
  "check": { "metric": "ppos_area_m2", "op": ">=", "value": 24 },
  "level": "error",
  "fix": "Mở rộng sân/hiên để PPOS ≥ 24 m² và rộng ≥ 4 m, hoặc chuyển sang DA",
  "source": { "doc": "<tên văn bản>", "clause": "<điều/khoản>", "version": "<ngày hiệu lực>", "url": "<link>" },
  "verified": { "by": "human:<tên>", "date": "YYYY-MM-DD" },
  "tests": ["samples/<dự án>.json"]
}
```

- `level`: `error` (fails) or `attention` (note, needs a person to look — e.g. optional information, a T.B.C note, a small difference in value). Do not push a note up into an error.
- `fix`: **required** — users must know how to fix it, not just that it is wrong.
- Boundary: state clearly «exactly at the threshold: pass or not» (`>=` or `>`). This is where mistakes happen most.
- Rules that depend on council/zone/pathway (CDC vs DA) must be in `applies`, not assumed.

## 2. Sources and order of priority

1. Legal documents currently in force (e.g. in NSW: legislation.nsw.gov.au, NSW Planning Portal, the council's official DCP). Record the clause and the commencement date.
2. Internal conventions confirmed by the project owner (record `verified.by: human:…`).
3. **Your own real projects are the main source for building rules and test cases**; other people's projects are for reference only.

When Claude reads a document and finds it differs from the project owner's understanding: **do not change the rule on your own**. Record a ledger entry with `--category attention`, quote the clause word for word, state the two readings, and let the project owner decide.

## 3. Test cases

- Each sample project: input (`samples/…`) + expected result (`tests/expected/…json`) confirmed by a qualified person.
- Each rule has at least one **pass** case, one **fail** case, and one **exactly-at-threshold** case.
- The command that runs all cases must be in `checks.full`. Change a rule → run all cases again, not just the related ones.

## 4. Results shown to users

- Each finding: which rule, measured value vs requirement, level (error/note), **how to fix it**, the cited source (clickable to view).
- Preliminary results (feasibility, quick lookup) must be clearly marked **preliminary / for reference**, not stated as certain; list what has not been checked (e.g. no planning certificate yet, no survey yet).
- Data taken from outside services (e.g. in NSW: ePlanning, SIX Maps, Sydney Water…): record the source and the time it was taken; terms of use/licences go in the plan under «Assumptions» until permission is obtained.

## 5. Checking

Hand the subagent `mission-rules-checker` a review: does the rule match the document in force, is the boundary right, is any rule applied to the wrong council/zone, are results stated more certainly than allowed. Every rule change is recorded in the ledger with its source.
