---
name: ship
description: Kiểm tra một thay đổi đã xong và — chỉ khi chủ dự án nói rõ "yes"/"đăng" cho đúng bản này — triển khai lên site thật, rồi kiểm tra sau triển khai, sao lưu, ghi git. Dùng khi chủ dự án nói ship, deploy, đăng, "đưa lên site", "cập nhật site", hoặc "chạy hết các kiểm tra" trước khi commit.
---

# Ship

Chủ dự án có thể không có nền IT: báo cáo **tiếng Việt**, ngắn, rõ; thuật ngữ kỹ thuật giữ tiếng Anh. Bước nào hỏng thì **dừng**, báo lỗi, không làm các bước sau.

## 0. App có bản riêng thì dùng bản riêng

Nếu thư mục app có `.claude/skills/ship/SKILL.md` khác tệp này, hoặc một skill đăng riêng (vd. `deploy`), hoặc `.mission/config.json` có `appSkills.deploy` trỏ tới skill khác: **đọc và làm theo skill đó**, bỏ qua phần dưới.

Cấu hình cho bản chung nằm ở `.mission/config.json → ship` (nếu chưa có, đọc `CLAUDE.md` để tìm lệnh build/kiểm tra/triển khai; không đoán — thiếu thì hỏi chủ dự án một lần):

```json
"ship": {
  "checkCmd": "PYTHON=\"py -3\" sh ship.sh",
  "previewCmd": "npx wrangler pages deploy dist --project-name <tên-dự-án> --branch preview",
  "deployCmd": "npx wrangler pages deploy dist --project-name <tên-dự-án> --branch main",
  "siteUrl": "https://<tên>.pages.dev",
  "lockChecks": [ { "url": "https://<tên>.pages.dev/member/", "expect": "302" } ],
  "backupDir": "build/backup",
  "backupFiles": ["build/<tệp-build>.html"],
  "tag": true
}
```

`deployCmd` là **TRANG THẬT** (trên Cloudflare Pages, `--branch main` = trang thật). `previewCmd` là bản xem trước — app nào không có thì để trống.

## 1. Kiểm tra (luôn làm, không cần xin phép)

1. Làm ở gốc thư mục app. Công việc phải được commit (`git status --short` rỗng); chưa thì commit trước.
2. Chạy kiểm tra: `ship.checkCmd`; không có thì `node "$MISSION_KIT/mission.mjs" check --full` (nếu app dùng Mission Kit) hoặc lệnh kiểm tra trong `CLAUDE.md`. Lệnh chạy lâu → chạy nền, ghi log vào `.mission/logs/` (app dùng Mission Kit; không commit) hoặc thư mục log riêng của app — **không** ghi vào thư mục build nếu nó nằm trong `protect.deny`; đọc phần cuối.
3. Có FAIL: đọc log/ảnh chụp, sửa **ở mã nguồn** (không bao giờ sửa tệp build), build lại, chạy lại. **Không triển khai khi còn FAIL.**
4. Báo: số bản/build id, commit, bảng kết quả kiểm tra (mỗi mục một dòng), và những gì **chưa** kiểm (điện thoại thật, màn cảm ứng, site thật).

## 2. Triển khai (chỉ khi có chữ "yes" rõ ràng)

- **Không bao giờ triển khai khi chưa có chữ "yes"/"đăng" rõ ràng của chủ dự án cho đúng bản này, trong tin nhắn mới nhất.** Trước đó hỏi một câu nói rõ đích: "Sắp đưa bản `<số>` lên **TRANG THẬT** `<siteUrl>`" (hoặc "lên **bản xem trước**"). Hook cũng hỏi trước lệnh triển khai — đó là lớp kiểm thứ hai, không thay cho chữ yes của chủ dự án.
- **Kiểm khoá trước** (nếu có `lockChecks`): mỗi URL phải trả đúng mã (vd. trang thành viên `302` tới Cloudflare Access, tệp khoá `403`). Sai → dừng, không triển khai.
- Lệnh triển khai luôn **ghi rõ đích** (tên dự án Pages/Worker). Tài khoản Cloudflare có nhiều app — không deploy, sửa hay xoá gì của app khác; không dùng lệnh wrangler trần.
- **Chọn đúng lệnh:**
  | Chủ dự án muốn | Lệnh | Câu hỏi trước khi chạy |
  |---|---|---|
  | Bản xem trước | `ship.previewCmd` | "Sắp đăng **bản xem trước** bản `<số>` …" — `previewCmd` trống → dừng, báo "app chưa có bản xem trước", **không** dùng `deployCmd` thay |
  | Trang thật | `ship.deployCmd` | "Sắp đưa bản `<số>` lên **TRANG THẬT** `<siteUrl>` …" |
  Chủ dự án chỉ nói "ship/đăng" mà không rõ → hỏi lại: xem trước hay trang thật.
- Chạy lệnh đã chọn ở chế độ nền, ghi log vào `.mission/logs/`, đọc phần cuối, rồi xoá log. Chỉ triển khai khi bước build in thành công (build lỗi mà vẫn triển khai có thể đăng thư mục rỗng).
- Đăng nhập: dùng phiên wrangler có sẵn trên máy. Hết hạn → nhờ chủ dự án tự chạy `npx wrangler login`; không tự nhập mật khẩu. Token/khoá bí mật: không bao giờ ghi vào tệp, commit, log hay câu trả lời.

## 3. Sau khi triển khai

1. Lặp lại `lockChecks` — tất cả phải đúng; sai một cái là báo chủ dự án ngay.
2. `node "$MISSION_KIT/tools/web-smoke.mjs" <siteUrl> --no-shots` nếu trang mở công khai; trang sau Cloudflare Access thì nhờ chủ dự án mở kiểm (hoặc dùng trình duyệt nếu đã kết nối).
3. Sao lưu: `node "$MISSION_KIT/mission.mjs" backup` (mã nguồn đã commit + `ship.backupFiles`, vào `ship.backupDir`, mặc định `build/backup/`; thư mục sao lưu tự có `.gitignore` riêng nên không bị commit; chạy được trên Windows không cần bash). App không dùng Mission Kit (PowerShell): `New-Item -ItemType Directory -Force build\backup | Out-Null; git archive --format=zip -o build/backup/src.zip HEAD` — và nhớ `build/backup/` phải có trong `.gitignore` của app. **Không** chép vào thư mục đồng bộ (Dropbox, OneDrive…) trừ khi app quy định.
4. Git: commit (nếu còn thay đổi) và, nếu `ship.tag`, gắn tag bản (`vNN`).
5. Nếu app dùng Mission Kit: ghi `.mission/release-notes/<bản>.md` (thay đổi gì, lỗi đã sửa kèm mã ledger, giới hạn, cách quay lại bản trước).

## 4. Báo chủ dự án (tiếng Việt, vài dòng)

1. Bản/build id và commit đã lên site; kiểm tra đã qua.
2. Cách kiểm trên site và cách cập nhật app đã cài (nếu là app cài được: bấm Update).
3. Có gì mới, nên thử gì — một hai dòng; những gì chưa kiểm.
4. Đường dẫn bản sao lưu; cách quay lại bản trước nếu cần.

## Những điều từng gây lỗi (Windows)

- Python gọi bằng `py -3` (lệnh `python` trần là bản giả của Windows Store).
- Dấu `\` trong đường dẫn trong lệnh dễ bị nuốt — dùng `/`.
- Trang đang mở giữ bản cũ đến khi tải lại.
