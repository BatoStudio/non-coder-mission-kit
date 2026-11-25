---
description: Sửa một lỗi (hoặc một mẫu lỗi) theo quy trình 10 bước có ledger và truy quét toàn dự án
argument-hint: "<mã ledger L-xxxx | mô tả lỗi | tên mẫu lỗi>"
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Dùng skill **mission-defect-loop** cho: $ARGUMENTS

Nếu là mã ledger: đọc mục bằng `node "$MISSION_KIT/mission.mjs" ledger list` rồi sửa. Nếu là mô tả mới: xác định vị trí, ghi `ledger add … --why … --fix …` trước khi sửa.
Sau khi sửa: `ledger close … --verify "<bằng chứng>"`. Nếu có `--pattern` hoặc lỗi mang tính hệ thống: quét toàn dự án, sửa mọi chỗ trúng, ghi mục `--category sweep`, thêm luật vào `lint.rules` (cần người dùng đồng ý vì sửa config) và style guide.
