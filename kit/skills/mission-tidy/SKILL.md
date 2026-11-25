---
name: mission-tidy
description: Dọn mã của Mission Kit — đo code lặp, tên định nghĩa trùng (xung đột), tệp và hàm quá dài; 3 chuyên gia lập kế hoạch rút gọn và chia nhỏ; làm từng lô nhỏ không đổi cách app chạy; đo lại và so sánh trước/sau. CHỈ dùng khi chủ dự án gõ /mission-tidy hoặc nói rõ "dọn code", "rút gọn code", "chia nhỏ code", "code bị lặp/conflict".
---

# Dọn mã: rút gọn, gỡ trùng, chia nhỏ — không đổi cách app chạy

Mục tiêu duy nhất: mã dễ phát triển tiếp. **Hành vi của app phải giữ nguyên**: cùng đầu vào → cùng kết quả, cùng bản vẽ, cùng PDF. Dọn mã KHÔNG phải lúc thêm tính năng, sửa lỗi hay «tiện tay cải tiến».

Gọi CLI: `node "$MISSION_KIT/mission.mjs" tidy …`. Lệnh này chỉ đọc và ghi kết quả đo vào `.mission/tidy/`.

## 0. Điều kiện trước khi bắt đầu

1. `git status` sạch (hoặc chỉ có `.mission/`). Có thay đổi dở → hỏi chủ dự án commit trước; không trộn.
2. `mission check --full` **XANH** trên commit hiện tại. Đỏ → báo chủ dự án; dọn mã trên nền đỏ thì không biết lỗi do ai.
3. Có lưới an toàn: bộ test/hồi quy của app (`checks.full`, `tests/regression`, dự án mẫu). Phần nào **không có test phủ** thì ghi rõ trong kế hoạch và không đụng tới cho tới khi có test (hoặc chủ dự án đồng ý kiểm bằng tay).
4. Chưa có `tidy` trong config → đề xuất (sửa config phải hỏi chủ dự án): `include` (glob mã nguồn thật, không gồm bản build), `exclude`, và **`sharedScope`** nếu app ghép nhiều tệp thành một (build nối `src/js/*.js`) hoặc nạp nhiều `<script>` thường. Thiếu `sharedScope` thì kit chỉ thấy tên trùng trong cùng một tệp.

## 1. Đo trước

```
node "$MISSION_KIT/mission.mjs" tidy --save truoc-<yyyymmdd>
```

Đọc bản đầy đủ `.mission/tidy/truoc-….md`. Bốn nhóm:

| Nhóm | Vì sao quan trọng | Cách xử lý thường gặp |
| --- | --- | --- |
| Tên định nghĩa trùng | **Xung đột thật**: trong tệp ghép, bản nạp SAU đè bản trước, âm thầm. Sửa bản trước là sửa vào chỗ không chạy | Xác định bản nào đang chạy thật (theo thứ tự nạp/ghép). Giữ đúng hành vi của bản đó, xóa bản chết, hoặc đổi tên nếu cả hai đều được dùng |
| Khối mã lặp | Sửa một chỗ quên chỗ kia → lỗi lặp lại | Gộp thành một hàm dùng chung, đặt ở tệp hợp lý; mọi nơi gọi hàm đó |
| Hàm dài | Khó đọc, khó test | Tách thành các hàm nhỏ có tên nói rõ việc |
| Tệp dài | Khó tìm, nhiều người/agent sửa đụng nhau | Chia theo trách nhiệm (đọc dữ liệu / tính / vẽ / giao diện), giữ thứ tự nạp |

Số đo là **gợi ý**, không phải lệnh. Một khối lặp nhỏ cố ý (dễ đọc hơn) có thể giữ; ghi lý do.

## 2. Ba chuyên gia lập kế hoạch (chưa sửa gì)

Dùng skill `ba-chuyen-gia` (hoặc `appSkills.review`), ba mảng cố định cho việc dọn mã:
1. **Cấu trúc** — ranh giới tệp/hàm hợp lý, chỗ đặt hàm dùng chung, thứ tự nạp, phụ thuộc vòng.
2. **Hành vi và hồi quy** — với từng thay đổi đề xuất: bản nào đang chạy thật, điều gì có thể đổi ngầm (thứ tự nạp, biến toàn cục, `this`, giá trị mặc định khác nhau giữa hai bản «giống nhau»), test nào phủ, test nào còn thiếu.
3. **Người phát triển tiếp** — tên gọi, có dễ thêm tính năng mới không, có tạo trừu tượng thừa không (gộp 2 chỗ chỉ giống bề ngoài là sai).

Brief giao kèm tệp `.mission/tidy/truoc-….md` và luật: **không sửa tệp nào**, chỉ đề xuất. Mỗi đề xuất ghi: vị trí, làm gì, rủi ro, test kiểm chứng.

Gộp thành **kế hoạch theo lô**, ghi vào `.mission/plan.md` (mục NOW/NEXT) và báo chủ dự án bằng bảng ngắn:

| Lô | Việc | Tệp | Rủi ro | Kiểm bằng |
| --- | --- | --- | --- | --- |

Thứ tự ưu tiên: (1) tên trùng/xung đột, (2) khối lặp đã từng gây lỗi (xem ledger `--pattern`), (3) khối lặp khác, (4) chia hàm dài, (5) chia tệp dài. **Chờ chủ dự án duyệt kế hoạch** rồi mới làm. Chủ dự án có thể bỏ hoặc đổi thứ tự lô.

## 3. Làm từng lô

Mỗi lô:
1. **Một việc**, đủ nhỏ để đọc hết diff (thường dưới ~300 dòng thay đổi). Không sửa vùng `protect`; không sửa bản build (sửa nguồn rồi build lại).
2. Ghi sổ trước khi sửa: `ledger add --category attention --severity LOW --pattern tidy --why "<lặp/trùng/dài ở đâu>" --fix "<sẽ gộp/tách thế nào>" --loc <tệp:dòng>`. Tên trùng mà hai bản **khác nhau** về hành vi → `--category defect`, mức theo hậu quả (có thể HIGH): đó là lỗi tiềm ẩn, báo chủ dự án.
3. Sửa. Chỉ di chuyển/gộp/đổi tên; không đổi công thức, ngưỡng, chữ hiển thị, thứ tự kết quả.
4. Kiểm: `mission check --full` phải XANH. Hồi quy trên dự án mẫu phải **khớp y nguyên** — tuyệt đối không cập nhật baseline trong lúc dọn mã (cập nhật baseline = đã đổi hành vi → dừng lại, báo chủ dự án).
5. `mission tidy --compare truoc-<yyyymmdd>`: không chỉ số nào được **tăng** (có ⚠ → xem lại lô này).
6. `ledger close <id> --verify "<check XANH + hồi quy khớp + số đo trước/sau>"`, commit riêng lô đó: `Dọn mã: <việc>` (theo `git.mode`; không push).
7. Đỏ mà sửa 2 lần chưa được → `git restore`/`git revert` lô đó, ghi `blocker`, sang lô khác hoặc báo chủ dự án.

## 4. Kết thúc

1. `mission tidy --save sau-<yyyymmdd> --compare truoc-<yyyymmdd>` → bảng trước/sau.
2. Ba chuyên gia soát **toàn bộ diff** từ commit trước khi dọn tới giờ (cùng ba mảng ở bước 2), tìm thay đổi hành vi ngầm. Kết quả → `.mission/reviews/`, gate G8 nếu có.
3. Cập nhật mục «Tính năng» của `.mission/LT.md` theo cấu trúc mới (thư mục nào là của tính năng nào, hàm dùng chung nằm đâu), để lần sau Claude tra được thay vì viết lại. Hook sau khi sửa và bước `tidy --conflicts` giữ cho mã không trùng lại.
4. `mission report`. Báo chủ dự án bằng tiếng Việt, vài dòng: bảng trước/sau, các xung đột đã gỡ (bản nào được giữ, vì sao), lô nào bỏ qua, phần nào chưa có test phủ.

## Không được

- Không gộp hai đoạn chỉ giống bề ngoài nhưng phục vụ hai luật khác nhau (vd. hai công ty, hai loại phòng) — sau này chúng sẽ cần khác nhau.
- Không đổi định dạng dữ liệu lưu, tên trường JSON, tên tệp xuất, URL, khóa localStorage — dữ liệu cũ của người dùng phải mở được.
- Không thêm thư viện mới để «gọn hơn».
- Không dọn mã và sửa lỗi/thêm tính năng trong cùng một lô hay một commit.
