---
description: Báo cáo tiến độ thật của nhiệm vụ (từ manifest, ledger, gates, kết quả kiểm tra)
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Chạy `node "$MISSION_KIT/mission.mjs" status`, `node "$MISSION_KIT/mission.mjs" gate show` và `node "$MISSION_KIT/mission.mjs" report`.
Báo cáo ngắn bằng tiếng Việt, dạng bảng khi hợp: phạm vi và độ phủ, lỗi theo mức (mở/đã đóng), mẫu lỗi lặp, cổng chất lượng, sản phẩm bàn giao, lần kiểm tra gần nhất, vướng mắc, việc tiếp theo (lấy từ `.mission/plan.md`).
Chỉ dùng số do CLI in ra; không ước lượng. Nêu rõ cái gì chưa kiểm được.
