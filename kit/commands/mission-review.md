---
description: Chấm cổng chất lượng cho một đơn vị theo 3 chuyên gia (mặc định skill ba-chuyen-gia; "nhanh" = 1 subagent)
argument-hint: "<id đơn vị> [nhanh|full]"
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Dùng skill **mission-quality-gates** cho: $ARGUMENTS (xem id bằng `node "$MISSION_KIT/mission.mjs" gate show`).

1. Mặc định (`appSkills.review` = `ba-chuyen-gia`) → chạy skill `ba-chuyen-gia` (3 chuyên gia song song; tự dùng bản riêng của app nếu có).
2. Có chữ `nhanh` (chủ dự án đã cho phép dùng 1 chuyên gia cho việc nhỏ) → builder tự soát hai lần; rồi 1 subagent `mission-checker`. `appSkills.review` rỗng **không** tự giảm xuống 1 — vẫn chạy 3 chuyên gia bằng `mission-checker`, `mission-evaluator` và một subagent chuyên môn, trừ khi chủ dự án cho phép. `full` = như mặc định nhưng một trong ba mảng là chuyên môn rủi ro (luật / bảo mật / giao diện).
3. Kiểm lại từng phát hiện; ghi ledger (kèm `--fix`); sửa; soát lại phần đã sửa. Tối đa 3 vòng, quá thì ghi `blocker`.
4. Lưu báo cáo subagent vào `.mission/reviews/`, `gate set` kèm `--evidence` (cổng độc lập kèm `--report`), `gate show`, `report`. Báo ngắn bằng tiếng Việt.
