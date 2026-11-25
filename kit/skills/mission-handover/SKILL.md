---
name: mission-handover
description: Ghi bàn giao giữa các phiên để phiên sau không phải đọc lại cả repo — ghi đè .mission/HANDOVER.md, cập nhật HTC/LT/ledger/manifest. Dùng khi kết thúc một lô việc, trước khi dừng phiên, khi phiên đã dài (sắp nén), hoặc khi chủ dự án gõ /mission-handover, nói «handover», «bàn giao phiên». KHÁC mission-handoff (gửi ChatGPT soát).
---

# Bàn giao phiên — chống «đọc lại cả thế giới»

Hook `session-start` đã tự nạp vào đầu mỗi phiên (cả sau khi nén): trạng thái kit, **HANDOVER**, **HTC hiện hành**, **sổ active** (ledger đang mở). Hook `pre-compact` tự chụp tình trạng máy (git, NOW, ledger mở) vào `.mission/state/auto-handover.md` trước khi nén. Skill này lo phần máy không tự làm được: **ghi lại điều chỉ Claude biết**.

## 5 lớp và trần độ dài

| # | Tệp | Nạp sẵn? | Trần | Ghi bởi |
| --- | --- | --- | --- | --- |
| 1 | `.mission/HANDOVER.md` | có | 60 dòng | Claude, **ghi đè** cuối phiên |
| 2 | `.mission/HTC.md` (hiện hành) | có | 150 dòng | Claude; bản cũ → `.mission/archive/HTC-<yyyymmdd>.md` |
| 3 | Sổ active (ledger mở) | có, ≤10 mục | — | chỉ CLI `ledger` |
| 4 | `.mission/LT.md` (Inventory: tệp/module/thuật ngữ/hàm dùng chung → vị trí) | **không** — chỉ grep | — | Claude, 1 dòng mỗi mục |
| 5 | `.mission/manifest.json` | **không** — tra theo id | — | `scan`, `unit set` |

Vượt trần thì hook cắt và báo — đó là tín hiệu phải rút gọn, không phải nâng trần.

## Luật khi làm việc

1. Xuất phát từ phần đã nạp. **Không** đọc lại cả repo để «nắm lại dự án».
2. Cần biết X ở đâu → `grep` trong `.mission/LT.md` trước, rồi đọc đúng tệp, đúng đoạn (offset/limit).
3. Không đọc: `.mission/archive/`, ledger đã đóng, HTC cũ, `progress.md`/`ledger.md`/`gates.md` (báo cáo sinh lại được), log, bản build.
4. Tệp đã ghi trong manifest mà vân tay chưa đổi → tin trạng thái manifest, không đọc lại.
5. Tìm rộng nhiều tệp → subagent `mission-explorer` (Haiku, chỉ tìm/đọc), chỉ nhận kết luận.
6. Đầu ra dài → lọc (`--summary`, `| tail -20`); không dán lại nội dung tệp vào trả lời, dẫn `tệp:dòng`.

## Khi bàn giao (cuối lô / cuối phiên / phiên đã dài)

1. **Đóng sổ trước**: mục ledger đã xong → `node "$MISSION_KIT/mission.mjs" ledger close <id> --verify "…"`. Không ghi trạng thái lỗi vào HANDOVER — sổ active là nguồn sự thật.
2. **Quy ước mới** → sửa `HTC.md`. Đổi lớn: chép bản cũ sang `.mission/archive/HTC-<yyyymmdd>.md` trước.
3. **Tệp/module/thuật ngữ mới** → thêm 1 dòng vào `LT.md`: `<tên> — <đường dẫn[:dòng]> — <một câu vai trò>`. Tính năng mới → mục «Tính năng»: `<tính năng> — <thư mục> — <hàm/khái niệm nó sở hữu>` (nên ghi ngay lúc tạo, hook sau khi sửa sẽ nhắc).
4. **Đơn vị đổi** → `node "$MISSION_KIT/mission.mjs" scan`.
5. **Ghi đè** `.mission/HANDOVER.md` theo mẫu `templates/HANDOVER.template.md` (≤ 60 dòng). Chỉ ghi điều chưa có ở nơi khác: đang dở ở đâu (tệp:dòng), 1–3 việc NOW theo thứ tự, quyết định mới (đã chuyển vào plan.md/HTC chưa), bẫy vừa phát hiện, những gì **không cần đọc lại**.
6. Không nối thêm lịch sử. Muốn giữ lịch sử thì đó là việc của git và ledger.

## Đầu phiên (khi HANDOVER thiếu hoặc bị đánh dấu CŨ)

Dựng lại từ `git log -10 --oneline`, sổ active, NOW của `plan.md` và ảnh chụp tự động (nếu hook đã nạp) — rồi ghi HANDOVER mới. Báo chủ dự án một dòng. Không quét cả repo.

## Không làm

- Không xóa HANDOVER/HTC/LT; không sửa `ledger.jsonl`, `manifest.json`, `state/` bằng tay (hook chặn).
- Không ghi địa chỉ, tên khách, số tiền thật vào HANDOVER/HTC/LT — dùng mã ngắn.
