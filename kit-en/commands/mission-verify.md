---
description: Run regression checks and independently verify the state before committing/reporting
---
(`$MISSION_KIT` is already set in the session and points to the kit; use it directly, do not go looking for the kit elsewhere.)
Use the **mission-regression** skill. Then call the `mission-verifier` subagent with the list of claims you plan to report (coverage, bugs fixed, check results, products). For any claim that is FALSE or CANNOT VERIFY, correct the report, do not round up.
Finally run `node "$MISSION_KIT/mission.mjs" done` and present the result word for word.
