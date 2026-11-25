---
name: mission-repo-recon
description: Kiểm kê repo trước khi sửa (nhánh, thay đổi chưa commit, hướng dẫn, build, skill/hook riêng của app, phần tái dùng được) và lập manifest. CHỈ dùng trong dự án đã có .mission/config.json.
---

# Kiểm kê repository

Mục tiêu: biết **thật** dự án đang ở đâu trước khi chạm vào. Không giả định số tệp, tỷ lệ hoàn thành hay chất lượng.

## Danh sách việc

1. **Vị trí và Git** — `git rev-parse --show-toplevel`, `git branch --show-current`, `git log --oneline -10`, `git status --short`, `git stash list`, các remote. Có thay đổi chưa commit → **giữ nguyên**, ghi lại; không stash/reset hộ.
2. **Không clone lại** nếu repo đã có trong workspace. Không tạo bản sao trùng.
3. **Đọc hết** hướng dẫn: `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING*`, `README*`, style guide, `docs/`. Tệp dài vẫn đọc hết phần quy tắc. Ghi các luật bắt buộc vào `plan.md`.
4. **Hệ thống build/CI** — `package.json` scripts, Makefile, `tools/`, `scripts/`, `.github/workflows/*`. Với mỗi workflow: chạy khi nào, có **phát hành/đẩy** gì không (đánh dấu để không kích hoạt nhầm). Thêm script nguy hiểm vào `protect.ask`/`bash.ask`.
5. **Tài sản đã có** — mã, dữ liệu luật, dự án mẫu, phần dùng chung với app khác (đọc PDF, 3D…), báo cáo QA cũ, danh sách lỗi mở, issue. Đánh giá có tái dùng được không (đọc mẫu thật, không chỉ nhìn tên tệp).
6. **Bản đồ phạm vi** — khai báo `units` trong config rồi `node "$MISSION_KIT/mission.mjs" scan`. Đối chiếu số đơn vị với đếm thủ công (`ls | wc -l`, số mục trong tệp…). Sai lệch → sửa cấu hình, không sửa số.
7. **Tình trạng từng đơn vị** — với mỗi đơn vị có sản phẩm: ước tính hoàn thành bằng đo được (số mục khớp, tỷ lệ độ dài, test pass), ghi bằng `node "$MISSION_KIT/mission.mjs" unit set <id> --completion N --note "<cách đo>"`.
8. **Đường cơ sở** — `node "$MISSION_KIT/mission.mjs" check --full`, `node "$MISSION_KIT/mission.mjs" lint --all --summary`. Ghi kết quả vào `plan.md` mục «Hiện trạng».

## Đầu ra

- `plan.md` mục «Hiện trạng» điền đủ: nhánh/HEAD, tái dùng được gì, thiếu/hỏng gì, rủi ro.
- `manifest.json` cập nhật.
- Ledger: mỗi vấn đề hệ thống phát hiện được ghi một mục (`--category attention`, kèm `--fix`).
- `node "$MISSION_KIT/mission.mjs" report`.

Ghi lại hook/skill/agent riêng của app (`.claude/`) và đề xuất `appSkills` — kit dùng chúng thay vì làm lại.

Repo lớn: chia việc đọc cho subagent `mission-explorer` (Haiku, chỉ tìm/đọc) theo thư mục và chỉ nhận kết luận; vẫn tự đọc các tệp quy tắc.
