---
name: mission-defect-loop
description: The Mission Kit's ledger-backed defect loop: find, classify, fix, verify, each defect with a corrective action, sweep for repeating defect patterns. Use ONLY in a project that already has .mission/config.json or when /mission-fix is typed.
---

# Defect loop with a ledger

Do not assume the work already done is correct. Go looking for defects, not for confirmation.

## Severity

| Severity | Meaning | Example in an app |
| --- | --- | --- |
| CRITICAL | A wrong result could make the user submit wrong documents/make a wrong decision; files/data exposed to people who are not allowed; data loss | a CDC rule with the wrong threshold; a customer can download the Revit file; the save button overwrites another project |
| HIGH | A main feature broken, results missing, the main flow does not work | cannot read one customer's title block; PDF export is blank |
| MEDIUM | Hard to use, interface broken at one screen size, confusing messages | table overflows on phones |
| LOW | Small differences in text, colour, alignment | button spacing |

Unsure → choose the higher severity, write the reason. Something that needs a person to look at but is not wrong → `--category attention` (does not block the gate).

## Ten steps for each defect

1. Exact location (file, function/screen, sample project, PDF page).
2. Get the reference to compare against (specification, rule clause, expected result).
3. Understand why — only fix once you can reproduce it.
4. Write down why it is wrong and the **corrective action**.
5. Fix — **fix the principle, not each example** (see below).
6. Compare with the reference again.
7. Re-run the related test cases.
8. Re-read the surrounding code — did the fix break something else?
9. Add a test case for this defect (a real defect → a permanent test case).
10. Look for similar defects elsewhere (sweep).

### Fix the principle, not each example

If the mistake is in a rule, a threshold, how data is read or an instruction to an agent, fix the **general rule** that produced the defect, not a one-off patch for a single sample.

- Do not add a special branch for one sample/customer/file (`if (sample code == …)`, an exception list by name, a threshold just for one project) unless the specification or rule clause says exactly that — in that case write the source into `--fix`.
- `--fix` must state what the correct rule is («the threshold uses `>=`»), not just «sample X now comes out right».
- Already patched examples ≥2 times for the same defect pattern → stop patching; rewrite that rule and remove the old patches.
- Check with the **whole set** of reference samples/expected results (`checks.full`, golden), not only the sample that just broke: a new rule that is right for this sample but shifts another sample is a regression.

## Recording in the ledger

Always write out the full `node "$MISSION_KIT/mission.mjs"` in every command (each call is a new shell; paths with spaces need double quotes). Do **not** record addresses, customer names or sample file names — use short codes; the CLI will refuse if it detects them.

```bash
node "$MISSION_KIT/mission.mjs" ledger add --severity HIGH --unit feature:kiem-tra --loc "rules/cdc.json#ppos" \
  --why "ngưỡng 24 m² đang dùng > thay vì >=; mẫu đúng 24 m² bị báo lỗi" \
  --fix "đổi op thành >=; thêm ca kiểm thử đúng ngưỡng" --pattern ranh-gioi-nguong
node "$MISSION_KIT/mission.mjs" ledger close L-0007 --after "op >=" --verify "chạy tests: 3/3 ca PPOS khớp kỳ vọng"
node "$MISSION_KIT/mission.mjs" ledger close L-0008 --status wontfix --by human:<tên> --verify "chủ dự án quyết ngày … giữ nguyên vì …"
```

(In this example: `--why` says "the 24 m² threshold uses > instead of >=; a sample at exactly 24 m² is flagged as an error"; `--fix` says "change op to >=; add a test case exactly at the threshold"; the first `--verify` says "ran tests: 3/3 PPOS cases match expected"; the second says "the project owner decided on … to keep it because …". `<tên>` = the person's name. Write your own values in English.)

`--verify` is evidence (command + result), not a promise.

## Sweep for repeating defect patterns

When the CLI reports «↻ Mẫu lỗi … đã gặp ≥2 lần» (defect pattern … seen ≥2 times) or a defect is clearly systemic:

1. Describe the sign to search for (regex, field name, rule type, customer type).
2. Search the whole project (and the apps that share the data); look at each result.
3. Fix every hit.
4. Record: `node "$MISSION_KIT/mission.mjs" ledger add --category sweep --pattern <name> --severity LOW --why "<search command> → N hits, fixed M, 0 left"`.
5. Prevent it from coming back: add a `lint.rules` rule (needs agreement because it edits the config) or a test case.

## Parallel work

Many units → hand them to subagents by unit (`mission-checker`, `mission-rules-checker`, `mission-security-reviewer`) — only when it is worth it (a large batch, high risk); handle small defects yourself to save tokens. Subagents only report; you re-check each finding before recording it in the ledger and fixing it. Disagreements → settle them with evidence (rule clause, run results), write the conclusion into the ledger.
