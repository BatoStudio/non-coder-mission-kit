# Guide: getting ChatGPT to write the brief for /mission-init

Updated: 2026-11

> The examples in this file come from an architecture firm in NSW (Australia). Replace them with your own industry, regulations and standards.

## How to use

Paste the prompt from the section below into ChatGPT, let ChatGPT ask you questions until it has enough information, then save the result as `brief.md` and type `/mission-init "brief.md"` in Claude Code. A good brief means Claude can fill in `plan.md` and `config.json` with almost no follow-up questions.

1. **Open ChatGPT, paste the prompt** (section «Prompt to paste into ChatGPT»; or run `node install.mjs --lang en --brief-prompt` in the kit folder to copy the prompt to the clipboard for you), then describe your app idea in everyday words — it is fine if it comes out messy.
2. **Answer ChatGPT's questions.** The prompt makes ChatGPT ask one group at a time, at most 5 questions per turn. For any question you do not know yet, answer «don't know yet» — ChatGPT will put it under Assumptions or Open questions, and is not allowed to make things up.
3. **Get the brief in the standard template**, review it with the checklist at the end of this document, then save it as `brief.md` in the app folder (for example `D:\APPS\<app-name>\brief.md`). If you save with Notepad, set «Save as type» to *All files* and Encoding to *UTF-8*, so it does not become `brief.md.txt`.
4. **In Claude Code (opened in the app folder), type** `/mission-init brief.md`. Claude reads the brief + reads what the app already has (CLAUDE.md, hooks, skills, scripts), then fills in `.mission/config.json` and `plan.md`, and finally sends you the remaining questions all at once.

ChatGPT only handles the **business side** (what the app is for, who uses it, what V1 includes, what counts as done). The technical side inside the app (hooks, scripts, file paths) Claude reads by itself from the app folder — ChatGPT does not need to guess it.

## Prompt to paste into ChatGPT

Copy the whole block below and paste it at the start of a new conversation. If you use it often, save it as a Custom GPT or a Project in ChatGPT so you do not have to paste it again.

```markdown
You are my business analyst. Task: help me write a BRIEF for an app, to give to Claude Code when it runs the /mission-init command. Claude will turn the brief into a plan (plan.md) and a configuration (config.json), so the brief must be clear enough that a reviewer can say «pass» or «not yet» without asking again.

Talk with me and write the brief in English.

HOW TO WORK
1. I will describe the app idea. Do NOT write the brief right away.
2. Ask me one group at a time from the list below, at most 5 questions per turn, skipping questions I have already answered. Each question comes with a suggested default answer so I only need to type «ok» or correct it.
3. If I answer «don't know yet» → put it under Assumptions (if there is a safe default) or Open questions. Do NOT make up numbers, regulation clauses, URLs or file names.
4. When you have enough, check the brief yourself with the checklist at the end, then output the brief in EXACTLY the template, in a single markdown block.

QUESTION GROUPS
A. Goal: the app helps whom do WHAT faster/more correctly, and how (one sentence). How is that work done today, and how long does it take.
B. Users and permissions: for each role (company internal, client, partner, admin), what they may view/edit/download and what they may NOT. Default: clients never download original files (Revit, DWG, full PDF). Is there a login.
C. V1 scope: the smallest version that is still really usable — a list of features/screens. And what is OUT of scope (later). Is any part reused from another company app.
D. Data: each kind of data lives in ONE place (Dropbox, Supabase, JSON file, Excel…), and who may edit it. Which source data must never be edited.
E. Privacy: does the app hold real client data (addresses, names, phone numbers, amounts, salaries). Are there client drawings/records used as samples, and in what file format. If it is a public app/has no client data, say so clearly.
F. Regulations/standards (if any): which documents (SEPP, the DCP of which council, NCC/BCA, internal drawing standards), clauses, versions. Not sure about a clause → put it in Open questions, do not guess numbers.
G. Sample projects for checking: which real projects/drawing sets are used for testing (write them as SHORT CODES such as job numbers, not addresses), and what the correct expected result is.
H. What counts as DONE (Definition of Done): every line must be verifiable by a command, a snapshot, or a real project. Examples: «Open 5 samples, results match 100%», «No console errors at 390/820/1440 px», «A client account cannot download original files». Vague lines such as «easy to use» or «fast» are not accepted.
I. Product and deployment: where the app runs (web page, desktop, Revit…), what the final product is (web page, PDF file, report…). Is it published online, domain/URL (if any), is there a preview version. Is this a REAL app or a TRIAL/copy.
J. Way of working: git commits straight to the main branch locally (default) or a separate branch + PR. Is the result sent to ChatGPT for review. Are there slow checks that must be run by hand (Revit, long browser runs). Which folders Claude must never read.
K. Prohibitions and priorities: what Claude must not do in this round. What is done first (NOW), after that (NEXT), later still (LATER).

WRITING RULES
- Do not write addresses, client names, phone numbers, lot numbers (LOT/DP), or real amounts — replace them with short codes (e.g. «job 10001»).
- Short sentences, in English, keep Australian terms as they are (DA, CDC, BCA, NCC, BASIX).
- Clearly separate: DECIDED / ASSUMPTION / OPEN QUESTION.
- Do not write code, do not choose the technology for me, do not set file paths (Claude reads them from the app folder).

BRIEF TEMPLATE (output exactly these sections; for a section that does not apply, write «Not applicable»)
# Brief — <app name>
## 1. Goal (one sentence)
## 2. Project type: real app / trial
## 3. Users and permissions (table: Role | Can do | Cannot do)
## 4. V1 scope (In / Out of scope / Reused from another app)
## 5. Source of truth (table: Data | Where it lives | Who edits) + Source data that must not be edited
## 6. Privacy (client data yes/no; sample file formats; files that must not be committed)
## 7. Regulations / standards (table: Regulation | Clause | Version | Sample to check)
## 8. Sample projects for checking (short code + expected result)
## 9. Definition of Done (checklist - [ ], every line verifiable)
## 10. Product and deployment (final product; where it runs; URL; preview)
## 11. Way of working (git; ChatGPT review; checks run by hand; folders not to read)
## 12. Prohibitions for this round
## 13. Priorities (NOW / NEXT / LATER)
## 14. Assumptions (need my confirmation)
## 15. Open questions

SELF-CHECK BEFORE OUTPUT
- The goal has all of: who + WHAT + HOW IT IS BETTER.
- Every role has both «can» and «cannot».
- There is an «out of scope» section.
- Each piece of data has only one source.
- Every DoD line is verifiable, with no vague adjectives.
- No real addresses/client names/phone numbers/amounts remain.
- No made-up regulation clauses, URLs or numbers.
- No two sections contradict each other.

Start with the sentence: «Tell me about your app idea.»
```

## Standard brief template

The brief has 15 fixed sections; each section has its own place in `plan.md` or `config.json`. If a section is missing, Claude must ask again or leave the default value.

| Brief section | Claude uses it for | If missing |
| --- | --- | --- |
| 1. Goal | `plan.md` → Goal | Claude does not know what to prioritise |
| 2. Real app / trial | `ship.deployCmd`, `previewCmd` (trial → leave empty) | A command that publishes to the live site may get set up for a trial |
| 3. Users and permissions | `plan.md` → roles table; gate G5 | Permissions cannot be checked |
| 4. V1 scope | `plan.md` → V1; `units` (feature list) | Scope drift, doing work that is not needed |
| 5. Source of truth | `plan.md`; `protect.deny` (source data); gate G6 | Data has to be edited in two places |
| 6. Privacy | `privacy` (`addressCheck`, `sampleDirs`, `blockCommitExtensions`) | Either blocks by mistake (public app), or client information leaks |
| 7. Regulations / standards | `plan.md` → regulations table; gate G2 | No source to check against |
| 8. Sample projects | `units` of type `case`; `samples`; gate G3 | No proof it works correctly on real projects |
| 9. Definition of Done | `plan.md` → DoD; gate G1 | No way to know when it is done |
| 10. Product and deployment | `deliverables`; `ship` (`siteUrl`…) | The `done` command cannot check the product |
| 11. Way of working | `git.mode`; `handoff`; `checks.remind`; `readGuard.denyDirs` | Defaults are used: commit straight to `main`, no extra folders blocked |
| 12. Prohibitions | `plan.md` → Decisions made; `protect`, `bash.ask` | Claude may do things you do not want |
| 13. Priorities | `plan.md` → NOW / NEXT / LATER | Claude sets the order by itself |
| 14. Assumptions | `plan.md` → Assumptions | — |
| 15. Open questions | `plan.md` → Open questions (WAITING) | — |

An example of a short brief that passes (shortened, only to show the level of detail needed):

```markdown
# Brief — House design viewer app
## 1. Goal
Help sales staff show clients the floor plans, elevations and 3D of the granny flat designs in under 1 minute, instead of opening separate PDFs.
## 2. Project type
Real app.
## 3. Users and permissions
| Role | Can do | Cannot do |
| Company internal | edit the design catalogue | — |
| Sales staff | view, share preview links | download Revit/DWG files |
| Client | view shared links | download any original file |
## 9. Definition of Done
- [ ] All 6 designs in the catalogue open, with all 3 views
- [ ] No console errors at 390/820/1440 px
- [ ] A test client account cannot download original files
## 15. Open questions
- Which domain to use?
```

The numbers in the example (6 designs, 1 minute) are only for illustration — a real brief uses your own numbers.

## Checklist before giving the brief to Claude

Takes about 2 minutes; if any box fails, go back to ChatGPT and fix it first.

- [ ] The goal has all three parts: **who**, **what work**, **how it is better**.
- [ ] It says clearly whether this is a real app or a trial.
- [ ] Every role has both «can» and «cannot»; clients cannot download original files (unless you decide otherwise).
- [ ] There is an **out of scope** list.
- [ ] Each kind of data lives in only one place.
- [ ] Every Definition of Done line can be checked by a command, a snapshot or a sample project — no «easy to use», «fast», «nice-looking».
- [ ] Sample projects are written as short codes; **no addresses, client names, phone numbers, LOT/DP or real amounts remain**. (The kit's hook will block commits that contain Australian-style addresses, so a clean brief from the start saves trouble.)
- [ ] Regulation clauses, URLs, numbers: either you have confirmed them, or they are in Open questions. ChatGPT often fills in clause numbers that sound right.
- [ ] No code, file names or paths guessed by ChatGPT.
- [ ] No two sections contradict each other (e.g. V1 has a login but «out of scope» lists permissions).

## Common mistakes and how to fix them

When you hit one, paste the matching «Say to ChatGPT» sentence into that same conversation.

| Mistake | Say to ChatGPT |
| --- | --- |
| ChatGPT writes the brief right away without asking anything | «Stop. Ask me by groups A–K first, at most 5 questions per turn.» |
| Vague DoD («user-friendly interface») | «Rewrite section 9: every line must be checkable by a command, a snapshot or a sample project.» |
| Made-up regulation clauses or numbers | «Move every clause and number I have not confirmed into section 15 Open questions.» |
| The brief has addresses or client names | «Replace every address, name and phone number with a short job code.» |
| ChatGPT picks the technology, writes code, names files | «Drop the technical part; Claude will read it from the app folder. Keep only the business side.» |
| V1 is too big (more than about 5–7 features) | «Cut V1 down to the smallest version that is still really usable; move the rest to LATER.» |
| Missing sections (ChatGPT dropped some) | «Output all 15 sections again following the template; for a section that does not apply, write ‘Not applicable’.» |

If the brief still has a few gaps, that is fine: `/mission-init` will gather the missing questions and ask you all at once at the last step.
