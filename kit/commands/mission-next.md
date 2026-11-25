---
description: Làm lô việc ưu tiên cao nhất tiếp theo, tiếp tục đến khi xong hoặc cần chủ dự án quyết định
argument-hint: "[số lô tối đa — trống = chạy tiếp]"
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Dùng skill **mission-run**. Đọc `node "$MISSION_KIT/mission.mjs" status`, `ledger list --open`, `gate show` và mục NOW/NEXT trong `.mission/plan.md`.

Thứ tự ưu tiên: (1) lỗi CRITICAL mở → (2) HIGH mở → (3) việc NOW đang ACTIVE → (4) mẫu lỗi lặp chưa quét → (5) đơn vị chưa có sản phẩm → (6) đơn vị có cổng FAIL/chưa soát → (7) NEXT → (8) MEDIUM/LOW → (9) bàn giao. Nếu app có skill riêng cho việc đang làm (`appSkills`), dùng skill đó.

Làm theo lô, kiểm thử trực quan ở cuối mỗi lô (không sau từng sửa nhỏ). Giới hạn số lô: $ARGUMENTS. Trước khi dừng: cập nhật NOW/NEXT/LATER và trạng thái ACTIVE/WAITING/BLOCKED/DONE trong plan, chạy `report`, báo ngắn: đã xong · cần quyết định · vướng.

**Chuỗi lô dài, chưa cần chủ dự án quyết gì:** cuối lần báo, đưa sẵn **một dòng** `/goal` để chủ dự án dán nếu muốn Claude tự chạy tiếp qua nhiều lượt. Điều kiện phải kiểm được và có giới hạn, ví dụ: `/goal mission.mjs done in ra «ĐẠT Definition of Done» và không còn lỗi CRITICAL/HIGH mở, hoặc dừng sau 20 lượt, hoặc khi cần chủ dự án quyết định`. Chỉ chủ dự án gõ được `/goal` (Claude không tự đặt); `/goal clear` để tắt. Người chấm của `/goal` chỉ thấy những gì in ra trong hội thoại, nên khi đang có goal, cuối mỗi lô phải in kết quả `done`/`status` thật — không tóm tắt «đã đạt» khi chưa chạy. `/goal` không đổi quyền: hook và danh sách LUÔN HỎI vẫn áp như cũ.
