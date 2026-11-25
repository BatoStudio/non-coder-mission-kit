---
name: mission-regression
description: Kiểm tra hồi quy trước commit trong dự án Mission Kit (diff, vùng bảo vệ, check --full, sổ lỗi). CHỈ dùng trong dự án đã có .mission/config.json hoặc khi gõ /mission-verify.
---

# Kiểm tra hồi quy

Chạy theo thứ tự; bước nào đỏ thì dừng, sửa, chạy lại từ đầu.

1. **Đọc diff** — `git diff --stat` rồi `git diff` từng tệp. Mọi thay đổi phải giải thích được bằng một mục ledger hoặc một việc trong plan. Thay đổi lạ → hoàn tác có chủ đích (hỏi nếu không phải của bạn).
2. **Vùng bảo vệ nguyên vẹn** — `git diff --name-only <base>... | grep -E '<glob protect.deny>'` phải rỗng. (Hook đã chặn khi sửa, bước này bắt các thay đổi đến từ script.)
3. **Không đụng nhầm** — tệp sinh tự động, lockfile, ảnh, thống kê có thay đổi không mong muốn? Kiểm tra `git status` có tệp lạ.
4. **Toàn bộ kiểm tra** — `node "$MISSION_KIT/mission.mjs" check --full` phải XANH (bước `severity: warning` được phép vàng nhưng phải đọc).
5. **Liên kết/tham chiếu chéo** — nếu dự án có kiểm tra link/anchor, nó phải nằm trong `checks.full`; nếu chưa có, chạy tay và đề xuất thêm.
6. **Nhất quán** — `node "$MISSION_KIT/mission.mjs" lint --all --summary`; so số liệu với lần trước (tăng lỗi = hồi quy).
7. **Dựng sản phẩm** — build lại deliverable nếu nguồn của nó đổi; chạy validator.
8. **Cập nhật sổ** — đóng các mục ledger đã sửa (`--verify`), `node "$MISSION_KIT/mission.mjs" scan` nếu đơn vị đổi, `node "$MISSION_KIT/mission.mjs" report`.
9. **Commit** — chỉ phần đã kiểm chứng, thông điệp nêu đơn vị + mã ledger. Không `git add -A` mù: xem lại `git status` trước.

Ghi tóm tắt kết quả (lệnh, XANH/ĐỎ, số liệu chính) vào thân commit hoặc `plan.md` để PR có bằng chứng.
