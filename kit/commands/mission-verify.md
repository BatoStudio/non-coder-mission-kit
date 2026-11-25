---
description: Kiểm tra hồi quy và kiểm chứng độc lập trạng thái trước khi commit/báo cáo
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Dùng skill **mission-regression**. Sau đó gọi subagent `mission-verifier` với danh sách các khẳng định bạn định báo cáo (độ phủ, lỗi đã sửa, kết quả kiểm tra, sản phẩm). Khẳng định nào SAI hoặc KHÔNG KIỂM ĐƯỢC thì sửa báo cáo, không làm tròn.
Cuối cùng chạy `node "$MISSION_KIT/mission.mjs" done` và trình bày kết quả nguyên văn.
