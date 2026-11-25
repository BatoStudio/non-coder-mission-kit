---
name: mission-drawing-check
description: Hướng dẫn chung khi xây tính năng đọc/kiểm tra bộ bản vẽ PDF. CHỈ dùng trong dự án đã có .mission/config.json VÀ app chưa có skill đọc bản vẽ riêng (nếu có, dùng skill của app).
---

# Đọc và kiểm tra bộ bản vẽ PDF

## 1. Bộ mẫu trước, mã sau

- **Chủ dự án** chép bộ PDF thật vào `samples/` (Claude không chép/di chuyển mẫu). Đặt tên bằng **mã ngắn** (vd. `abc-001`, `j00001`), không dùng địa chỉ hay tên khách hàng. Sau khi có mẫu, thêm `samples/**` vào `protect.deny`.
- Với mỗi mẫu, người có chuyên môn ghi kết quả kỳ vọng vào `tests/expected/<dự án>.json`: danh sách trang (số hiệu, tên, revision), khung tên của ai, khách hàng, các lỗi và lưu ý đúng ra phải bắt được.
- Mỗi khách hàng có quy ước riêng (khung tên, logo, trang bắt buộc theo giai đoạn Tender/Preliminary/Construction). Quy ước ghi thành dữ liệu theo skill `mission-rules-engine`, không viết cứng trong mã.

## 2. Đọc PDF

- Ưu tiên lớp chữ của PDF (pdf.js / pdfjs-dist trong trình duyệt; pdfplumber/PyMuPDF nếu xử lý phía máy). Chỉ OCR khi trang là ảnh quét, và đánh dấu kết quả OCR là kém tin cậy.
- Định vị khung tên theo vùng tọa độ + từ khóa, không theo thứ tự chữ (thứ tự chữ PDF không ổn định).
- Ghi lại cho từng trường đã đọc: giá trị, trang, vị trí, độ tin cậy. Không đọc được → **lưu ý** «không đọc được, cần người kiểm», không đoán.
- Kích thước/tỷ lệ: lấy từ thanh tỷ lệ hoặc kích thước ghi trên bản vẽ; luôn đối chiếu với một kích thước đã biết (vd. chiều dài module tiêu chuẩn).

## 3. Quy ước thường gặp (xác nhận lại với từng dự án)

- Revision chữ cái = sơ bộ, số = thi công. Revision tên tệp và ISSUE trên từng trang là hai hệ độc lập; các trang trong một bộ có thể khác revision. Lệch giữa tên tệp và ISSUE cao nhất là **lưu ý**, không phải lỗi.
- Khách hàng trên khung tên không được trùng công ty có logo trên chính khung tên đó.
- Ghi chú «T.B.C» không phải lỗi.
- Mục chỉ là tùy chọn (vd. NGL trên mặt đứng) → lưu ý, không phải lỗi.

## 4. Kết quả cho người dùng

Bảng: trang · hạng mục · kết quả (đạt / lỗi / lưu ý) · giá trị đọc được · yêu cầu · **hướng điều chỉnh**. Có nút mở đúng trang PDF. Xuất được báo cáo (PDF/CSV) để gửi kèm.

## 5. Kiểm thử

- `checks.full` chạy toàn bộ mẫu và so với `tests/expected/` — lệch một ô cũng là ĐỎ.
- Thêm một mẫu mới mỗi khi gặp lỗi thật ngoài đời (lỗi trở thành ca kiểm thử vĩnh viễn).
- Khi đổi bộ đọc PDF hoặc quy ước: chạy lại toàn bộ mẫu của **mọi** khách hàng, không chỉ khách hàng đang sửa.
- 3D/mặt bằng dựng từ PDF: chụp ảnh (`web-smoke --script`) và so kích thước tổng, số phòng, vị trí cửa với bản vẽ gốc; giao `mission-visual-qa` soát.
