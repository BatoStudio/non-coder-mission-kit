---
name: ba-chuyen-gia
description: Bước "3 chuyên gia" của chủ dự án trước khi gọi một việc là xong — ba agent soát độc lập song song, mỗi người một mảng, so bản đang sửa với bản đã commit, báo lỗi kèm cách tái hiện và cách sửa. Tốn token — chỉ dùng khi chủ dự án nói rõ "3 chuyên gia"/"ba chuyên gia"/"phản biện", gõ /mission-review, hoặc trước khi chấm cổng G8; câu thường như "kiểm tra lại" thì hỏi chủ dự án trước.
---

# Ba chuyên gia

## 0. App có bản riêng thì dùng bản riêng

Nếu thư mục app có `.claude/skills/ba-chuyen-gia/SKILL.md` khác tệp này, hoặc `.mission/config.json` có `appSkills.review` trỏ tới skill khác: **đọc và làm theo skill đó**, bỏ qua phần dưới. Bản riêng hiểu engine, mẫu và luật riêng tư của app hơn.

## 1. Chọn ba mảng

- Có `.mission/config.json → threeExperts.areas` (không rỗng) → dùng đúng ba mảng khai ở đó (tên, tệp/hàm cần soát, điều hay sai, lệnh được chạy).
- Chưa có → tự chia từ `git diff` và `CLAUDE.md` thành ba mảng **không chồng nhau**, theo khuôn:
  1. **Lõi / logic** — phần tính toán, đọc dữ liệu, luật (engine, bộ đọc PDF, luật CDC…): quy tắc bật nhầm ở dữ liệu không dành cho nó, đơn vị, ngưỡng, hồi quy trên mẫu thật.
  2. **Dữ liệu và ca biên** — đầu vào lạ, thiếu, sai định dạng; từ ngữ có thể hiểu khác; mẫu của khách hàng/loại công trình khác; dữ liệu cũ không có trường mới.
  3. **Người dùng / phía tiêu thụ** — giao diện, báo cáo, xuất tệp, 3D, trang review, lỗi console, nhiều khổ màn hình; và góc nhìn người dùng thật (có dùng được, có đáng dùng, có cách nào tốt hơn).
  Ghi ba mảng đã chọn vào báo cáo, và đề xuất thêm chúng vào `threeExperts.areas` để lần sau dùng lại.
- **Câu hỏi kiến trúc** — dù ba mảng lấy từ config hay tự chia, chuyên gia **thứ nhất** luôn phải trả lời thêm: «Có cách nào **đơn giản hơn** đạt cùng kết quả không?» (bớt tệp, bớt tầng, bớt thư viện, bớt cơ sở dữ liệu/đăng nhập/dịch vụ ngoài khi chưa cần; phần nào đang làm trước khi có nhu cầu thật). Trả lời bằng một mục riêng `ĐƠN GIẢN HƠN:` — có đề xuất thì nêu cách làm và cái được/mất; không có thì ghi «không thấy cách đơn giản hơn» kèm lý do ngắn.

## 2. Giao việc

**Phạm vi = phần vừa làm, không đọc lại cả dự án**. Trước khi mở agent, chạy `git diff --stat` + `git status --short`, chia các tệp đã đổi vào ba mảng.

Mở **ba agent trong cùng một lượt** (Agent tool, `general-purpose`, chạy nền, model `sonnet`; việc **khó** — diff nằm trong lõi dùng chung, luật nghiệp vụ/tuân thủ, bảo mật, hoặc đổi nhiều tệp — thì dùng `opus` và báo chủ dự án một dòng), mỗi agent một mảng, rồi chờ đủ ba báo cáo. Brief của mỗi agent gồm: **danh sách tệp đã đổi** thuộc mảng đó, lệnh xem diff (`git diff HEAD -- <các tệp>`; tệp mới thì đọc thẳng), và một dòng nói thay đổi nhằm làm gì; **không** nói bạn đoán họ sẽ tìm thấy gì. Agent đọc diff trước, rồi chỉ đọc các hàm đã đổi và nơi gọi trực tiếp (Grep theo tên), không đọc cả tệp, không quét cả dự án. Mảng không có tệp nào đổi: agent chỉ soát ảnh hưởng gián tiếp (ai gọi phần đã đổi) và ghi «không có tệp đổi trong mảng này» nếu không có gì — không tự đọc thêm.

Brief nào cũng có nguyên văn các luật sau:
- KHÔNG sửa tệp nào của dự án. Script nháp chỉ trong thư mục tạm của riêng bạn (`mktemp -d`, đặt tên rev1 / rev2 / rev3).
- Không bao giờ in hay ghi địa chỉ nhà, tên khách hàng/chủ nhà, email, số điện thoại hay tên tệp mẫu — chỉ dùng mã ngắn của mẫu.
- Không đọc cả `CLAUDE.md` hay tài liệu lịch sử: chỉ Grep đúng mục liên quan tới hàm/mẫu đã đổi. So bản đã commit (`git archive HEAD <thư mục> | tar -x -C <thư mục tạm>`) với bản đang sửa trên các mẫu/ca kiểm thử **mà thay đổi có thể chạm tới** (diff nằm trong code dùng chung → chạy tất cả); không ghi vào thư mục kết quả của dự án.
- Lệnh chạy ra nhiều dòng thì chỉ in dòng khác biệt/lỗi (`| tail -30`, grep DIFF/FAIL), không in cả danh sách.
- Lệnh được chạy: <liệt kê lệnh test/kiểm tra của app — lấy từ `threeExperts.areas[].commands`, `checks.full` hoặc `CLAUDE.md`>. Không commit, không push, không triển khai.
- Báo cáo ngắn (tối đa ~10 dòng), xếp hạng: tệp:dòng — điều gì sai — kịch bản lỗi cụ thể (tốt nhất là đã tái hiện bằng cách sửa dữ liệu trong bộ nhớ) — cách sửa. Chỉ ghi phát hiện đã kiểm chứng hoặc tin chắc; với những gì đã kiểm mà ổn, ghi «không vấn đề».
- Phần nào trong mảng của bạn **không kiểm được** (không chạy được lệnh, thiếu mẫu, thiếu quyền, không mở được trang…) thì ghi rõ `THIẾU BẰNG CHỨNG: <phần nào> — <vì sao>`. Không được im lặng bỏ qua, không được suy ra «chắc là ổn» từ lời người làm.
- Dòng cuối là **một trong ba**:
  - `KẾT LUẬN: PASS` — không còn lỗi nào và không có mục THIẾU BẰNG CHỨNG.
  - `KẾT LUẬN: PASS KÈM SỬA (<n> lỗi nhỏ)` — 0 CRITICAL/HIGH, chỉ còn lỗi MEDIUM/LOW; liệt kê từng lỗi kèm cách sửa.
  - `KẾT LUẬN: FAIL (…)` — có CRITICAL/HIGH, **hoặc** có mục THIẾU BẰNG CHỨNG ở phần quan trọng (luật, dữ liệu khách, quyền, tính toán chính).

Mặc định ba agent (thu hẹp phạm vi đọc, không thu hẹp số agent). Thay đổi rất nhỏ (một dòng, chỉ chữ) → chủ dự án có thể cho phép một agent; không tự giảm khi chưa được nói.

## 3. Sau khi có đủ ba báo cáo

1. Báo chủ dự án bằng tiếng Việt, vài dòng, **quan trọng trước**: mỗi chuyên gia tìm được gì, kết luận của từng người, mục THIẾU BẰNG CHỨNG (nếu có) và đề xuất `ĐƠN GIẢN HƠN` của chuyên gia thứ nhất. Đề xuất đơn giản hơn là để chủ dự án quyết, không tự làm.
2. Kiểm lại từng phát hiện bằng bằng chứng; đúng thì sửa, sai thì ghi lý do bác bỏ.
3. Chạy lại **toàn bộ** kiểm thử, rồi commit.
4. Liệt kê những gì **chưa sửa** và vì sao.
5. Có sửa đáng kể → cho chuyên gia liên quan soát lại **phần đã sửa** (tối đa 3 vòng; quá thì để chủ dự án quyết).

## 4. Nếu app dùng Mission Kit (`.mission/` có sẵn)

- Ghi mỗi phát hiện đúng vào sổ: `node "$MISSION_KIT/mission.mjs" ledger add --severity … --why … --fix … --unit …`.
- Lưu nguyên văn ba báo cáo vào `.mission/reviews/<đơn vị>-3cg-<ngày>-<1|2|3>.md`.
- Lỗi nhỏ trong `PASS KÈM SỬA` cũng phải vào sổ (mức medium/low) — sửa ngay hoặc để lại có lý do; không được chỉ nằm trong báo cáo.
- Khi cả ba đều `KẾT LUẬN: PASS` hoặc `PASS KÈM SỬA` (và lỗi nhỏ đã vào sổ), ghi cổng độc lập. Công cụ từ chối báo cáo có dòng kết luận cuối chứa `FAIL` hoặc `THIẾU BẰNG CHỨNG`:
  `node "$MISSION_KIT/mission.mjs" gate set <đơn vị> G8 PASS --by agent:ba-chuyen-gia --report .mission/reviews/<tệp của chuyên gia cuối>.md --evidence "3/3 PASS, vòng <n>"`
