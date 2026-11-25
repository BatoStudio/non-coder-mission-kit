---
name: mission-defect-loop
description: Vòng ghi sổ lỗi của Mission Kit: tìm, phân loại, sửa, kiểm chứng, mỗi lỗi kèm hướng điều chỉnh, quét mẫu lỗi lặp. CHỈ dùng trong dự án đã có .mission/config.json hoặc khi gõ /mission-fix.
---

# Vòng lỗi có ghi sổ

Không giả định phần đã làm là đúng. Đi tìm lỗi, không đi xác nhận.

## Mức độ

| Mức | Nghĩa | Ví dụ trong app |
| --- | --- | --- |
| CRITICAL | Kết quả sai có thể khiến người dùng nộp hồ sơ sai/quyết định sai; lộ tệp/dữ liệu cho người không được phép; mất dữ liệu | luật CDC sai ngưỡng; khách hàng tải được tệp Revit; nút lưu ghi đè dự án khác |
| HIGH | Tính năng chính hỏng, kết quả thiếu, luồng chính không chạy | không đọc được khung tên một khách hàng; xuất PDF trống |
| MEDIUM | Khó dùng, giao diện vỡ ở một khổ màn hình, thông báo khó hiểu | bảng tràn trên điện thoại |
| LOW | Lệch nhỏ về chữ, màu, căn lề | khoảng cách nút |

Phân vân → chọn mức cao hơn, ghi lý do. Việc cần người xem nhưng không sai → `--category attention` (không chặn cổng).

## Mười bước cho mỗi lỗi

1. Vị trí chính xác (tệp, hàm/màn hình, dự án mẫu, trang PDF).
2. Lấy chuẩn so sánh (đặc tả, điều luật, kết quả kỳ vọng).
3. Hiểu vì sao — tái hiện được thì mới sửa.
4. Ghi vì sao sai và **hướng điều chỉnh**.
5. Sửa — **sửa nguyên tắc, không sửa từng ví dụ** (xem dưới).
6. So lại với chuẩn.
7. Chạy lại ca kiểm thử liên quan.
8. Đọc lại phần xung quanh — sửa có làm hỏng chỗ khác?
9. Thêm ca kiểm thử cho lỗi này (lỗi thật → ca kiểm thử vĩnh viễn).
10. Tìm lỗi tương tự nơi khác (truy quét).

### Sửa nguyên tắc, không sửa từng ví dụ

Sai ở luật, ngưỡng, cách đọc dữ liệu hay lời dặn cho agent thì sửa **quy tắc chung** sinh ra lỗi, không vá riêng cho một mẫu.

- Không thêm nhánh riêng cho một mẫu/khách/tệp (`if (mã mẫu == …)`, danh sách ngoại lệ theo tên, ngưỡng riêng cho một dự án) trừ khi đặc tả hay điều luật nói đúng như vậy — khi đó ghi nguồn vào `--fix`.
- `--fix` phải nêu quy tắc đúng là gì («ngưỡng tính bằng `>=`»), không chỉ «mẫu X giờ ra đúng».
- Đã vá ví dụ ≥2 lần cho cùng một mẫu lỗi → dừng vá; viết lại quy tắc đó rồi bỏ các bản vá cũ.
- Kiểm bằng **cả bộ** mẫu chuẩn/kết quả kỳ vọng (`checks.full`, golden), không chỉ mẫu vừa hỏng: quy tắc mới đúng cho mẫu này mà làm lệch mẫu khác là hồi quy.

## Ghi sổ

Luôn viết đầy đủ `node "$MISSION_KIT/mission.mjs"` trong mỗi lệnh (mỗi lần gọi là một shell mới; đường dẫn có dấu cách cần nháy kép). **Không** ghi địa chỉ, tên khách hàng hay tên tệp mẫu — dùng mã ngắn; CLI sẽ từ chối nếu phát hiện.

```bash
node "$MISSION_KIT/mission.mjs" ledger add --severity HIGH --unit feature:kiem-tra --loc "rules/cdc.json#ppos" \
  --why "ngưỡng 24 m² đang dùng > thay vì >=; mẫu đúng 24 m² bị báo lỗi" \
  --fix "đổi op thành >=; thêm ca kiểm thử đúng ngưỡng" --pattern ranh-gioi-nguong
node "$MISSION_KIT/mission.mjs" ledger close L-0007 --after "op >=" --verify "chạy tests: 3/3 ca PPOS khớp kỳ vọng"
node "$MISSION_KIT/mission.mjs" ledger close L-0008 --status wontfix --by human:<tên> --verify "chủ dự án quyết ngày … giữ nguyên vì …"
```

`--verify` là bằng chứng (lệnh + kết quả), không phải lời hứa.

## Truy quét mẫu lỗi lặp

Khi CLI báo «↻ Mẫu lỗi … đã gặp ≥2 lần» hoặc lỗi rõ ràng mang tính hệ thống:

1. Mô tả dấu hiệu tìm được (regex, tên trường, loại luật, loại khách hàng).
2. Tìm toàn dự án (và các app dùng chung dữ liệu); xem từng kết quả.
3. Sửa mọi chỗ trúng.
4. Ghi: `node "$MISSION_KIT/mission.mjs" ledger add --category sweep --pattern <tên> --severity LOW --why "<lệnh tìm> → N chỗ, sửa M, còn 0"`.
5. Ngăn tái phát: thêm luật `lint.rules` (cần đồng ý vì sửa config) hoặc ca kiểm thử.

## Song song hóa

Nhiều đơn vị → giao subagent theo đơn vị (`mission-checker`, `mission-rules-checker`, `mission-security-reviewer`) — chỉ khi đáng (lô lớn, rủi ro cao); lỗi nhỏ thì tự xử lý để tiết kiệm token. Subagent chỉ báo cáo; bạn kiểm lại từng phát hiện rồi mới ghi sổ và sửa. Bất đồng → giải bằng bằng chứng (điều luật, kết quả chạy), ghi kết luận vào ledger.
