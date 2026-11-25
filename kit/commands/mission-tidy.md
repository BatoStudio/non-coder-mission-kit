---
description: Dọn mã — đo code lặp, tên trùng (xung đột), tệp/hàm dài; 3 chuyên gia lập kế hoạch; làm từng lô nhỏ không đổi cách app chạy; so sánh trước/sau
argument-hint: "[đo | kế hoạch | làm <lô> | kết thúc]"
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Dùng skill **mission-tidy** cho: $ARGUMENTS

- Không có tham số hoặc `đo` → bước 0 và 1 (điều kiện + đo trước), báo kết quả, dừng.
- `kế hoạch` → bước 2: ba chuyên gia đề xuất, gộp thành bảng lô, **chờ chủ dự án duyệt**.
- `làm <lô>` (vd. `làm 1`, `làm 1-3`, `làm hết`) → bước 3 cho các lô đã được duyệt trong `.mission/plan.md`. Lô chưa duyệt thì hỏi.
- `kết thúc` → bước 4: đo sau, so sánh, ba chuyên gia soát toàn bộ diff, report.

Không push, không deploy. Không cập nhật baseline hồi quy trong lúc dọn mã.
