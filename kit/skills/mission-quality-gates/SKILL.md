---
name: mission-quality-gates
description: Chấm cổng chất lượng theo 3 chuyên gia có bằng chứng. CHỈ dùng trong dự án đã có .mission/config.json hoặc khi gõ /mission-review; nếu app có skill review riêng (appSkills.review, vd. ba-chuyen-gia) thì dùng skill đó.
---

# Cổng chất lượng — 3 chuyên gia

Cổng khai báo trong `.mission/config.json → gates` (nhóm đơn vị có thể chỉ dùng một phần qua `units[].gates`). Một đơn vị **PASS** chỉ khi: mọi cổng của nó PASS/NA và **không cũ hơn thay đổi cuối**, không còn lỗi CRITICAL/HIGH mở, và có sản phẩm. CLI tính — không tự tuyên bố.

## 0. Mặc định dùng skill `ba-chuyen-gia`

`appSkills.review` mặc định là `ba-chuyen-gia` (3 agent song song, mỗi người một mảng). Skill đó tự nhường cho bản riêng của app nếu có. Chạy nó, lưu báo cáo vào `.mission/reviews/`, rồi ghi cổng (bước 5). Phần dưới đây là cách nhẹ hơn (1 subagent) khi chủ dự án muốn tiết kiệm hoặc đặt `appSkills.review` rỗng.

## Bộ cổng mặc định cho app

| Cổng | Kiểm gì | Ai |
| --- | --- | --- |
| G1 Đúng yêu cầu | Đủ DoD trong plan | builder → checker |
| G2 Đúng luật, có nguồn | Điều khoản đang hiệu lực, đúng ngưỡng, đúng phạm vi | `mission-rules-checker` |
| G3 Dự án thật | Mẫu thật khớp kết quả kỳ vọng | checker (chạy test) |
| G4 Giao diện | 3 khổ màn hình | `mission-visual-qa` |
| G5 Phân quyền & bảo mật | Khách hàng không thấy tệp gốc; không lộ bí mật; không lộ thông tin khách | `mission-security-reviewer` + `mission-privacy-auditor`; app có đăng nhập: test của `mission-access-test` xanh |
| G6 Một nguồn sự thật | Không dữ liệu trùng phải sửa hai nơi | checker |
| G7 Kỹ thuật | Không lỗi console, build/test xanh | `web-smoke`, test |
| G8 Phản biện độc lập | Không còn phát hiện chặn | subagent, có tệp báo cáo |

## Quy trình một đơn vị (tiết kiệm token)

1. **Builder tự soát hai lần** (lần 2 đọc như người khác viết). Lỗi → `mission-defect-loop`.
2. **Ghi các cổng tự soát** có bằng chứng cụ thể:
   ```bash
   node "$MISSION_KIT/mission.mjs" gate set feature:kiem-tra G3 PASS --by main --evidence "npm test: 12/12 mẫu khớp expected"
   ```
   Không áp dụng → `NA` + lý do. Trượt → `FAIL` + mã ledger.
3. **Soát độc lập = 3 chuyên gia** (skill `ba-chuyen-gia`: 3 subagent song song, mỗi người một mảng, người làm không tự chấm). Việc nhỏ, rủi ro thấp: `/mission-review <đơn vị> nhanh` = 1 subagent `mission-checker`. Đơn vị rủi ro cao (luật, dữ liệu lương, quyền truy cập, triển khai) thì một trong ba mảng là chuyên môn đó (`mission-rules-checker`, `mission-security-reviewer`, `mission-visual-qa`). Prompt chỉ gồm: đường dẫn plan, tệp liên quan, mẫu, lệnh, tiêu chí — **không** đưa kết luận của bạn.
4. **Xử lý phát hiện** — kiểm lại bằng bằng chứng; đúng → ledger (kèm `--fix`) + sửa; sai → ghi lý do bác bỏ. Có sửa → soát lại **phần đã sửa**. **Tối đa `review.maxRounds` vòng (mặc định 3)**; quá số vòng mà còn vấn đề → ghi `ledger add --category blocker` để chủ dự án quyết, không lặp tiếp.
5. **Lưu báo cáo nguyên văn** của subagent vào `.mission/reviews/<đơn vị>-<cổng>-<ngày>.md` (thay mã ngắn nếu báo cáo có lỡ chứa tên/địa chỉ khách hàng), rồi ghi cổng độc lập:
   ```bash
   node "$MISSION_KIT/mission.mjs" gate set feature:kiem-tra G8 PASS --by agent:ba-chuyen-gia \
     --report .mission/reviews/feature-kiem-tra-G8-2026-11-08.md --evidence "vòng 2: 0 CRITICAL/HIGH"
   ```
   CLI từ chối nếu dòng kết luận cuối không phải «KẾT LUẬN: … PASS» (nhận cả «PASS KÈM SỬA»), hoặc còn chữ FAIL hay «THIẾU BẰNG CHỨNG». Đây vẫn là quy ước tin cậy (tác tử chính ghi tệp), nhưng để lại dấu vết kiểm toán được.
6. `gate show feature:kiem-tra` → phải là PASS. Sửa mã sau đó làm cổng thành **CŨ** — chấm lại phần bị ảnh hưởng. Rồi `report`.

Điểm số là phụ; không đánh dấu PASS để làm đẹp thống kê.
