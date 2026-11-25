---
name: mission-web-qa
description: Kiểm thử app web theo mốc (web-smoke 3 khổ màn hình, lỗi console, kịch bản thao tác, phân quyền, xuất tệp). CHỈ dùng trong dự án đã có .mission/config.json; nếu app có skill kiểm tra riêng (appSkills.verify) thì dùng skill đó.
---

# Kiểm thử app web

Nếu `appSkills.verify` có giá trị (vd. `verify`, `ship` ở chế độ kiểm tra), dùng skill đó của app trước; phần dưới đây là bổ sung/dự phòng.

Kiểm thử **theo mốc** (sau một lô thay đổi), không phải sau từng sửa nhỏ — tiết kiệm thời gian và chi phí. Hook `post-edit-check` đã lo kiểm tra nhanh từng tệp.

## 1. Chạy thử tự động

```bash
node "$MISSION_KIT/tools/web-smoke.mjs" index.html                    # 390 / 820 / 1440 px
node "$MISSION_KIT/tools/web-smoke.mjs" index.html --dark             # chế độ tối (nếu app hỗ trợ)
node "$MISSION_KIT/tools/web-smoke.mjs" http://localhost:5173 --script tests/smoke/mo-du-an.mjs
```

Báo ĐỎ khi có lỗi JavaScript, `console.error`, tài nguyên tải hỏng, hoặc tràn ngang. Ảnh lưu ở `.mission/shots/`.

Kịch bản thao tác (`--script`) là tệp `export default async (page) => { … }` — mô phỏng luồng chính: mở dự án mẫu, nhập PDF, bấm kiểm tra, xuất báo cáo. Mỗi luồng chính của Definition of Done nên có một kịch bản và nằm trong `checks.full`.

## 2. Những gì phải kiểm ở mỗi mốc

| Hạng mục | Cách kiểm |
| --- | --- |
| Luồng chính chạy hết | kịch bản `--script` |
| Không lỗi console | web-smoke |
| 3 khổ màn hình, chữ không bị cắt, nút bấm được trên điện thoại | ảnh chụp → subagent `mission-visual-qa` |
| Dữ liệu mẫu cho kết quả đúng | so `tests/expected/` |
| Xuất tệp (PDF/PNG/CSV/DXF) mở được và đúng nội dung | mở tệp xuất ra, đọc lại |
| Lưu và mở lại dữ liệu (localStorage, Supabase) không mất | kịch bản: lưu → tải lại trang → kiểm |
| Phân quyền: tài khoản khách hàng không thấy/tải được tệp gốc | tài khoản thử từng vai trò → subagent `mission-security-reviewer` |
| Ngoại tuyến / mạng chậm (nếu app cần) | Playwright `context.setOffline(true)` trong kịch bản |
| Tiếng Việt / ký hiệu đo (m², °) hiển thị đúng | ảnh chụp |

## 3. App một tệp HTML

- Giữ mọi thứ trong một tệp nếu đó là quyết định của dự án; không tách tệp khi chưa được đồng ý.
- Thư viện ngoài (CDN) phải ghim phiên bản; kiểm app vẫn chạy khi mở bằng `file://` nếu người dùng mở trực tiếp.
- Sao lưu: trước thay đổi lớn, commit Git; nếu dự án có quy định sao lưu zip (vd. `build/backup/`), làm theo đúng chỗ dự án quy định.

## 4. Báo cáo

Ngắn, bằng tiếng Việt: luồng nào chạy, lỗi nào còn, ảnh nào cần chủ dự án nhìn. Chỉ nói «đã thử trên X» với trình duyệt/thiết bị thật sự đã chạy.
