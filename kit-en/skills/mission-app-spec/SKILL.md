---
name: mission-app-spec
description: Write the app spec in .mission/plan.md — users and permissions, one source of truth, V1, applicable rules, Definition of Done, NOW/NEXT/LATER. ONLY use in a project that already has .mission/config.json.
---

# App spec

Write into `.mission/plan.md` (following the existing template). A good spec is one where a checker can say «passes» or «does not pass yet» without having to ask again.

## 1. Goal and users

- One sentence: the app helps **whom** do **what** faster/more correctly, and how.
- Role table: internal (company), customers/partners, admin. For each role: what they can view, edit, download; what they can **not** do.
- Safe by default: customers never access original design files (Revit, DWG, full PDF) unless the spec says so clearly; they only see previews/what they are granted.

## 2. One single source of truth

Each kind of data lives in **one** place only; other places only reference it. If one piece of information has to be edited in two places, the design is wrong — fix the design, do not sync by hand.

| Example | Origin | Reference only |
| --- | --- | --- |
| Drawing files | Dropbox | Supabase stores the path + preview image + permissions |
| Module catalogue | one data file/table | app, portal, catalogue read from it |
| CDC/DCP rules | `rules/` with cited sources | app only reads |

## 3. V1 scope

The smallest thing that is still really usable. Write down «out of scope» clearly so the scope does not drift. Prefer finishing one app before opening a new one; reuse parts already built in other apps (PDF reading, 3D, rules data…) instead of rewriting them.

## 4. Rules and standards (if the app touches them)

List the applicable documents (e.g. in NSW: SEPP, each council's DCP, NCC/BCA, internal drawing standards) with clauses and commencement dates. Details of how to encode them: the skill `mission-rules-engine`.

## 5. Definition of Done

Every line must be verifiable: which command, which sample project, which snapshot. Examples:
- «Open the 5 sample drawing sets in `samples/`, results match `tests/expected/` 100%».
- «No console errors at 390/820/1440 px» (`web-smoke`).
- «A customer account cannot download original files» (checked with a test account).

## 6. Splitting the work

- Work units (`units` in config): a feature, a screen, or a **sample project** (each sample drawing set/address is one test case).
- NOW / NEXT / LATER table with WHAT / WHO / WHEN and status ACTIVE / WAITING / BLOCKED / DONE.
- Tell apart an **ISSUE** (a defect, recorded in the ledger) and a **TASK** (work to do, recorded in the plan).

## 7. Questions for the project owner

Only ask about things where a wrong guess is costly or hard to reverse (access, real data, service costs, domain names, deploying). Gather the questions and ask them once; while waiting, do the parts that do not depend on them.

## Checking the spec (3 roles)

Before starting work: reread it yourself in the role of **checker** (any contradictions, missing permissions, missing DoD?) and call the subagent `mission-evaluator` (would a real user find this app worth using, what is missing?). Fix the spec, then start.
