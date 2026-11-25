---
name: mission-app-spec
description: Viết đặc tả app trong .mission/plan.md — người dùng và quyền, một nguồn sự thật, V1, luật áp dụng, Definition of Done, NOW/NEXT/LATER. CHỈ dùng trong dự án đã có .mission/config.json.
---

# Đặc tả app

Viết vào `.mission/plan.md` (theo mẫu có sẵn). Đặc tả tốt là đặc tả mà người kiểm tra có thể nói «đạt» hay «chưa đạt» mà không cần hỏi lại.

## 1. Mục tiêu và người dùng

- Một câu: app giúp **ai** làm **việc gì** nhanh/đúng hơn thế nào.
- Bảng vai trò: nội bộ (công ty), khách hàng/đối tác, quản trị. Với mỗi vai trò: được xem gì, sửa gì, tải gì; **không** được gì.
- Mặc định an toàn: khách hàng không bao giờ truy cập tệp thiết kế gốc (Revit, DWG, PDF đầy đủ) trừ khi đặc tả nói rõ; chỉ thấy bản xem trước/được cấp.

## 2. Nguồn sự thật duy nhất

Mỗi loại dữ liệu chỉ nằm ở **một** chỗ; nơi khác chỉ tham chiếu. Nếu một thông tin phải sửa ở hai chỗ thì thiết kế sai — sửa thiết kế, đừng đồng bộ thủ công.

| Ví dụ | Gốc | Chỉ tham chiếu |
| --- | --- | --- |
| Tệp bản vẽ | Dropbox | Supabase lưu đường dẫn + ảnh xem trước + quyền |
| Danh mục module | một tệp dữ liệu/bảng | app, portal, catalogue đọc từ đó |
| Luật CDC/DCP | `rules/` có trích nguồn | app chỉ đọc |

## 3. Phạm vi V1

Nhỏ nhất mà vẫn dùng được thật. Ghi rõ «ngoài phạm vi» để không trôi phạm vi. Ưu tiên hoàn thiện một app trước khi mở app mới; tái dùng phần đã có từ app khác (đọc PDF, 3D, dữ liệu luật…) thay vì viết lại.

## 4. Luật và quy chuẩn (nếu app đụng tới)

Liệt kê văn bản áp dụng (vd. ở NSW: SEPP, DCP từng council, NCC/BCA, tiêu chuẩn bản vẽ nội bộ) kèm điều khoản và ngày hiệu lực. Chi tiết cách mã hóa: skill `mission-rules-engine`.

## 5. Definition of Done

Mỗi dòng phải kiểm chứng được: lệnh nào, dự án mẫu nào, ảnh chụp nào. Ví dụ:
- «Mở 5 bộ bản vẽ mẫu trong `samples/`, kết quả khớp `tests/expected/` 100%».
- «Không lỗi console ở 390/820/1440 px» (`web-smoke`).
- «Tài khoản khách hàng không tải được tệp gốc» (kiểm bằng tài khoản thử).

## 6. Chia việc

- Đơn vị công việc (`units` trong config): tính năng, màn hình, hoặc **dự án mẫu** (mỗi bộ bản vẽ/địa chỉ mẫu là một ca kiểm thử).
- Bảng NOW / NEXT / LATER với WHAT / WHO / WHEN và trạng thái ACTIVE / WAITING / BLOCKED / DONE.
- Phân biệt **ISSUE** (lỗi, ghi vào ledger) và **TASK** (việc phải làm, ghi vào plan).

## 7. Câu hỏi cho chủ dự án

Chỉ hỏi điều mà đoán sai sẽ tốn kém hoặc khó đảo ngược (quyền truy cập, dữ liệu thật, chi phí dịch vụ, tên miền, triển khai). Gom câu hỏi lại hỏi một lần; trong lúc chờ, làm phần không phụ thuộc.

## Kiểm tra đặc tả (3 nhân vật)

Trước khi bắt tay làm: tự đọc lại với vai **checker** (có mâu thuẫn, thiếu quyền, thiếu DoD không?) và gọi subagent `mission-evaluator` (người dùng thật có thấy app này đáng dùng không, thiếu gì?). Sửa đặc tả rồi mới làm.
