---
name: mission-pr
description: Mở draft PR có bằng chứng (chỉ cho dự án chế độ git branch-pr). Chỉ chạy khi người dùng gõ /mission-pr.
disable-model-invocation: true
---

## Khi được gọi

Chỉ dùng khi `git.mode` là `branch-pr`. Ở chế độ `local-main` (repo trên máy, commit thẳng nhánh chính): thay vì PR, chạy `check --full`, `report`, `done`, commit có thông điệp nêu mã ledger, và báo cho chủ dự án.

 Chạy `check --full`, `report`, `done`; dựng lại app từ checkout sạch và chạy `web-smoke`; viết `.mission/pr-body.md` từ `progress.md`, `gates.md`, `ledger.md`, `checks.md`; đẩy nhánh làm việc; `gh pr create --draft`.
Nếu `done` chưa ĐẠT: vẫn có thể mở draft PR nhưng tiêu đề và mô tả phải nói rõ các điều kiện còn thiếu.


# Ứng viên phát hành và PR

## 1. Cổng cuối

```bash
node "$MISSION_KIT/mission.mjs" check --full && node "$MISSION_KIT/mission.mjs" report && node "$MISSION_KIT/mission.mjs" done
```
Cần lệnh `gh` (GitHub CLI) đã đăng nhập; không có thì dừng và báo.

`done` chưa ĐẠT → không mở PR "hoàn thành". Có thể mở **draft PR** nêu rõ điều kiện còn thiếu.

## 2. Tái lập được

- Dựng lại sản phẩm từ một bản checkout sạch (`RC=$(mktemp -d) && git worktree add "$RC" HEAD`, không đụng thư mục làm việc) bằng đúng lệnh trong tài liệu; so kích thước và nội dung trích với bản đang có. Xong thì `git worktree remove "$RC"`.
- Ghi lệnh dựng vào README/tài liệu build của dự án nếu chưa có.

## 3. Đẩy nhánh và PR

```bash
git push -u origin <nhánh làm việc>      # hook chặn đẩy lên nhánh bảo vệ
gh pr create --draft --base <mainBranch> --title "<tóm tắt>" --body-file .mission/pr-body.md
```

Nội dung `pr-body.md` (viết từ dữ liệu thật):

- Mục tiêu và phạm vi; liên kết `.mission/brief.md`.
- Bảng độ phủ (từ `progress.md`), cổng chất lượng (`gates.md`), lỗi theo mức (`ledger.md`).
- Kết quả kiểm tra (`checks.md`) — kèm phiên bản công cụ (vd. phiên bản Node, Playwright).
- Kiểm tra trực quan / tương thích: **chỉ** liệt kê trình duyệt/thiết bị đã thử thật; ghi rõ cái chưa thử. Kèm 2–3 ảnh chụp quan trọng từ `.mission/shots/`.
- Nếu có triển khai: link bản xem trước, đường lui (lệnh `/mission-deploy`).
- Giới hạn đã biết, câu hỏi mở cho người duyệt.
- Commit tham chiếu (HEAD), lệnh dựng lại.

Không gọi `gh pr merge`, `gh release …`, không đẩy tag phát hành — các lệnh đó bị hook chặn và là quyết định của chủ dự án. Nếu repo có workflow tự phát hành khi merge, nhắc rõ trong PR.
