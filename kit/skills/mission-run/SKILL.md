---
name: mission-run
description: Điều phối quy trình Mission Kit (đặc tả → làm theo lô → soát lỗi → 3 chuyên gia → kiểm chứng → bàn giao). CHỈ dùng khi thư mục dự án đã có .mission/config.json, hoặc khi người dùng gõ một lệnh /mission-*. Không tự khởi tạo .mission/.
---

# Mission Run — điều phối

CLI: `node "$MISSION_KIT/mission.mjs"` — luôn viết đầy đủ, có nháy kép (mỗi lần gọi là shell mới; đường dẫn có dấu cách). Gọi bằng công cụ **Bash** (Git Bash). Nếu chỉ có PowerShell: `node "$env:MISSION_KIT/mission.mjs" …`. Trạng thái ở `.mission/`:

| Tệp | Vai trò | Ai ghi |
| --- | --- | --- |
| `brief.md` | Yêu cầu gốc | chủ dự án |
| `config.json` | Phạm vi, vùng cấm sửa, lệnh kiểm tra, cổng, `appSkills` | `/mission-init` (sửa phải được đồng ý) |
| `plan.md` | Đặc tả, NOW/NEXT/LATER, quyết định, giả định | Claude |
| `manifest.json` | Danh sách đơn vị | `scan`, `unit set` |
| `ledger.jsonl` | Sổ ISSUE (lỗi/lưu ý) | chỉ `ledger` |
| `gates.json`, `reviews/` | Cổng + báo cáo soát | chỉ `gate` |
| `progress.md`, `ledger.md`, `gates.md`, `checks.md` | Báo cáo | `report`, `check` |
| `HANDOVER.md`, `HTC.md`, `LT.md` | Bàn giao phiên, quy ước hiện hành, bảng tra vị trí | Claude (skill `mission-handover`) |

## Nguyên tắc

1. **Sự thật trước.** Số liệu từ CLI và lệnh kiểm tra. Không nói «xong», «đạt», «đã thử» khi không có bằng chứng.
2. **Skill/hook riêng của app thắng.** Đọc `appSkills` trong config: `review` (vd. `ba-chuyen-gia`), `verify`, `deploy` (vd. `ship`), `drawings`… Có thì dùng skill của app; skill kit chỉ là dự phòng. Không khai lại việc hook riêng của app đã làm.
3. **3 chuyên gia.** Builder (Claude, tự soát hai lần) → checker → evaluator. Builder không tự chấm cổng độc lập. Mặc định 1 subagent mỗi lần soát, tối đa 3 vòng (`review`).
4. **Một nguồn sự thật.** Không nhân bản dữ liệu phải sửa ở hai nơi.
5. **Quyền riêng tư.** Không ghi địa chỉ, tên khách hàng, tên tệp mẫu vào ledger, cổng, báo cáo, commit — dùng mã ngắn. CLI chặn địa chỉ nhà và danh sách chặn của app.
6. **Không phá hỏng.** Không sửa `protect.deny`; không force-push; không merge PR; không triển khai/đổi cơ sở dữ liệu khi chưa được đồng ý. Git theo `git.mode`: `local-main` = commit thẳng nhánh chính trên máy, push phải hỏi; `branch-pr` = nhánh riêng + PR. Hooks chặn — đừng tìm cách lách; cần thì dừng và hỏi.
7. **Lỗi nào cũng kèm hướng sửa** (`--fix`). Phân biệt **lỗi** và **lưu ý** (`--category attention`).
8. **Sửa gốc rễ.** Lỗi lặp ≥2 lần → `--pattern`, quét toàn dự án, thêm luật lint/ca kiểm thử.
9. **Tiết kiệm token.** Làm theo lô; `check --full` và ảnh chụp ở **mốc** (cuối lô, trước commit), không sau từng sửa nhỏ; không đọc lại tệp lớn — sửa đúng đoạn; subagent chỉ khi đáng. Ngữ cảnh đầu phiên đã nạp sẵn (HANDOVER, HTC, sổ active) — xuất phát từ đó, tra `LT.md`/manifest bằng grep; cuối lô dùng skill `mission-handover`.
10. **Dữ liệu quan trọng (`protect.important`: samples/, out/golden/, tests/pdf-library*/, .mission/ledger.jsonl, build/backup/ — app sửa được).** Xóa/ghi đè/dời chúng, `git clean`, `robocopy /MIR` đều bị hook HỎI — dừng và hỏi chủ dự án, đừng tìm cách lách.
    - **Không dùng junction/symlink để chia sẻ dữ liệu** (samples, out/golden, node_modules…) giữa thư mục tạm, worktree và app thật. Dùng **chép** (`cp -r`, `robocopy` không `/MIR`). Dọn thư mục tạm có thể đi xuyên junction và xóa sạch dữ liệu thật.
    - **Gỡ junction/symlink chỉ bằng lệnh gỡ liên kết**: `cmd //c rmdir "<liên-kết>"` (PowerShell: `cmd /c rmdir "<liên-kết>"`) — KHÔNG `/s`, KHÔNG `rm -r`, KHÔNG `Remove-Item -Recurse`. Thấy liên kết trong thư mục sắp xóa: gỡ liên kết trước, rồi mới xóa phần còn lại.
11. **Cố vấn (advisor, Fable).** App chạy Sonnet; Fable là người cố vấn, không phải người làm.
    - Sửa **một lỗi 2 lần chưa đạt** → **DỪNG**, hỏi advisor tìm nguyên nhân gốc rồi mới sửa tiếp. Không thử lần 3 theo quán tính.
    - **Trước tính năng lớn hoặc sửa nhiều tệp** → hỏi advisor đánh giá kế hoạch (nêu việc, các tệp đụng tới, rủi ro) rồi mới làm.
    - **Ghi ledger mỗi lần hỏi:** `node "$MISSION_KIT/mission.mjs" ledger add --severity LOW --category attention --source advisor --why "Hỏi advisor: <chủ đề, mã đơn vị>" --fix "<kết luận/nguyên nhân gốc advisor đưa ra>"`. Áp dụng xong lời khuyên thì đóng: `ledger close <mã> --verify "<đã kiểm bằng gì>"` (mục này chỉ LOW/lưu ý, không chặn `done`).
    - Hook đầu phiên nhắc nếu chưa có `advisorModel` (gõ `/advisor fable`).

## Các giai đoạn

Chạy liên tục, không xin xác nhận giữa các giai đoạn. Chỉ dừng khi cần quyết định của chủ dự án mà đoán sai thì tốn kém/không đảo ngược được — ghi `ledger add --category blocker`, đưa vào «Câu hỏi mở» (WAITING), làm tiếp việc khác.

1. **Khởi động** — `status`. Chưa có `.mission/` → nhắc người dùng gõ `/mission-init` (không tự tạo).
2. **Đặc tả** — `mission-app-spec`.
3. **Kiểm kê** — `mission-repo-recon`; `scan`.
4. **Luật & mẫu** — nếu app theo luật/bản vẽ: `mission-rules-engine`, skill đọc bản vẽ của app (hoặc `mission-drawing-check`). Có bộ bản vẽ/mẫu nhà mới → nhắc chủ dự án gõ `/mission-new-sample <tên ngắn>` (skill chỉ chạy bằng lệnh).
   **Dữ liệu** — đổi schema: `mission-db-migration`; bảng/hàm truy cập/route mới ở app có đăng nhập: `mission-access-test`.
5. **Làm theo lô** (nhịp bên dưới).
6. **Soát lỗi** — `mission-defect-loop`; CRITICAL → HIGH trước.
7. **Cổng** — `mission-quality-gates`.
8. **Kiểm thử theo mốc** — `appSkills.verify` hoặc `mission-web-qa`.
9. **Hồi quy** — `mission-regression` trước commit lớn.
10. **Triển khai** — chỉ khi người dùng gõ `/mission-deploy`. Trước khi đăng/chia sẻ/gửi đi: `/mission-privacy` (agent `mission-privacy-auditor`). Chủ dự án muốn gửi ChatGPT soát → nhắc chủ dự án gõ `/mission-handoff <đơn vị> <vòng>` (skill chỉ chạy bằng lệnh).
11. **Bàn giao** — `done` phải ĐẠT; `/mission-pr` chỉ ở chế độ `branch-pr`.

## Nhịp một lô

```
chọn việc NOW → làm → hook post-edit báo lỗi thì sửa ngay → tự soát 2 lần
→ ledger (kèm --fix) → check --full (mốc) → 1 subagent soát → sửa (≤3 vòng)
→ gate set … → report → commit (nêu đơn vị + mã ledger) → cập nhật NOW/NEXT/LATER
```

## Báo cáo cho chủ dự án

Ngắn, bằng tiếng Việt, bảng khi hợp: đã xong · cần quyết định · vướng. Không kể lại quá trình.

## Kết thúc

Cuối mỗi lô và trước khi dừng phiên: skill `mission-handover` (ghi đè HANDOVER, đóng sổ, cập nhật HTC/LT).

Hook dừng (`stopGate.mode`: mặc định chỉ nhắc) báo khi kiểm tra đã cũ. Chỉ tuyên bố hoàn thành khi `done` in **ĐẠT Definition of Done**; nếu chưa, liệt kê đúng các điều kiện còn thiếu.
