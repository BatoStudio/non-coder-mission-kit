---
name: mission-deploy
description: Triển khai app theo bậc (bản xem trước → chủ dự án duyệt → trang thật) có đường lui. Chỉ chạy khi người dùng gõ /mission-deploy; nếu app có skill triển khai riêng (appSkills.deploy) thì dùng skill đó.
disable-model-invocation: true
argument-hint: "[preview | production]"
---

# Triển khai an toàn

Chế độ: `$ARGUMENTS`. Trống hoặc `preview` = **chỉ bản xem trước**. Chỉ chữ `production` mới được đưa lên **TRANG THẬT**.

**Mặc định dùng skill `ship`** (`appSkills.deploy`; `ship` tự nhường cho bản riêng của app nếu có). Skill này chỉ thêm: kiểm cổng trước (mục 1), luật bậc (mục 2) và ghi chú phát hành (mục 3).

## 1. Trước khi triển khai (cả preview lẫn production)

1. `node "$MISSION_KIT/mission.mjs" check --full` XANH; `done` không còn lỗi CRITICAL/HIGH mở.
2. Không có bí mật trong mã (luật lint `bi-mat`): khóa `service_role`, token API, mật khẩu. Khóa `anon` của Supabase chỉ được ở trình duyệt khi Row Level Security đã bật cho mọi bảng.
3. Phân quyền đã soát (Cloudflare Access / RLS), subagent `mission-security-reviewer` PASS.
4. Đổi cơ sở dữ liệu: có migration (skill `mission-db-migration`), đã thử trên bản sao, có cách quay lại; test phân quyền (`mission-access-test`) xanh.
4b. **Không lộ thông tin khách**: subagent `mission-privacy-auditor` (hoặc `appSkills.privacy`) soát đúng thư mục sắp đăng → PASS.
5. **Đường lui ghi rõ**: bản đang chạy là deployment/commit nào, quay lại bằng cách nào. Không có đường lui → không triển khai.

## 2. Luật bậc

| Chế độ | Lệnh dùng | Điều kiện |
|---|---|---|
| preview (mặc định) | `ship.previewCmd` | Có chữ «yes» của chủ dự án cho lần này. **Config không có `previewCmd` → DỪNG**, báo chủ dự án: "App này chưa có lệnh bản xem trước; chỉ có lệnh đưa lên trang thật." Không được dùng `deployCmd` thay. |
| production | `ship.deployCmd` | Chủ dự án đã xem bản xem trước (hoặc app không có preview và chủ dự án chấp nhận), **và** tin nhắn mới nhất của chủ dự án có chữ «yes» sau câu hỏi dưới đây. |

Trước khi chạy production, hỏi đúng một câu, viết hoa phần quan trọng:

> Sắp đưa bản `<số bản / commit>` lên **TRANG THẬT** `<siteUrl>` — khách/nhân viên sẽ thấy ngay. Đường lui: `<cách quay lại>`. Bạn trả lời **yes** để đăng.

Hook `guard-bash` cũng hỏi trước mọi lệnh triển khai (lệnh `deploy/publish/ship`, `wrangler`, `vercel`, `netlify`, và đúng `ship.deployCmd`/`previewCmd` trong config). Đó là lớp thứ hai, **không** thay cho chữ yes.

Sau triển khai: `web-smoke <URL>`; trang có đăng nhập thì thử một tài khoản được phép và một không được phép (hoặc nhờ chủ dự án mở kiểm).

## 3. Ghi chú phát hành

Tạo `.mission/release-notes/<phiên bản>.md`: thay đổi gì cho người dùng (lời thường), lỗi đã sửa (mã ledger), giới hạn đã biết, cách quay lại bản trước. Sao lưu: `node "$MISSION_KIT/mission.mjs" backup` (trong thư mục app, không phải Dropbox).
