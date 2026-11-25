---
name: mission-protect
description: Làm rối (obfuscate) BẢN BUILD frontend để chống chép lại mã — rút gọn, đổi tên biến, mã hóa chuỗi, bỏ source map; chỉ xử lý thư mục build (dist/), không bao giờ đụng mã nguồn. Dùng khi chủ dự án gõ /mission-protect, hoặc nói "chống sao chép code", "làm rối code", "obfuscate", "giấu code", "chống ăn cắp code" cho một app web.
---

# Làm rối bản build để chống chép — chỉ dist/, không đụng nguồn

## Sự thật phải nói trước (nói với chủ dự án mỗi lần, đừng hứa hơn mức này)

Làm rối mã **làm chậm** người chép, **không khóa được**. Mọi thứ gửi xuống trình duyệt đều xem được bằng DevTools; obfuscate chỉ khiến khó đọc, khó chép nguyên khối. Thứ bảo vệ thật sự:

- **Logic quan trọng để ở server** (Cloudflare Workers/Functions) — nó không gửi cho người dùng.
- **Khóa/token giữ bằng biến môi trường**, không nhúng vào JS client.
- **License kiểm phía server** và **điều khoản pháp lý**.

Obfuscate frontend là **một lớp răn đe**, làm thêm, không phải để thay các thứ trên. Mã server thì **không cần** làm rối (vốn đã không lộ).

## Luật cứng

1. **Chỉ chạy trên thư mục BUILD** (`dist/`, bản sẽ deploy), **không bao giờ** trên `web/`, `src/` hay bất cứ thư mục mã nguồn nào. Script tự từ chối nếu thấy tệp đang được git theo dõi (đó là nguồn).
2. **Không sao lưu, vì bản build dựng lại được.** Quy trình = build mới → làm rối → **chạy thử** → hỏng thì build lại. Lưới an toàn là bước chạy thử, không phải bản backup.
3. **Không tự quyết deploy.** Làm rối xong vẫn qua skill `ship`/`/mission-deploy` như thường (có bước hỏi của chủ dự án).
4. Thư viện ngoài trong `vendor/` và tệp `*.min.js` **giữ nguyên** (đã minify sẵn; bundle lại dễ hỏng).
5. Chỉ xử lý `.mjs` (ES module). Tệp `.js` cổ điển nạp bằng `<script>` thường không tự đụng (format khác, dễ hỏng) — gặp thì báo chủ dự án.

## Khi nào chạy

Giữa **build** và **deploy**. Ví dụ:
1. Dựng bản sạch: `node scripts/build-dist.mjs` (chép `web/` → `dist/`).
2. Làm rối `dist/` (bước dưới).
3. Chạy thử `dist/` (skill `mission-web-qa` hoặc `web-smoke`, hoặc mở bằng tay): trang chạy, không lỗi console, các tính năng chính còn hoạt động.
4. Hỏng → **không deploy**; dựng lại từ bước 1, báo chủ dự án tệp nào gãy.
5. Ổn → deploy qua `ship`/`/mission-deploy`.

## Cách chạy

Chỉ đọc trước (không tải gì, không sửa gì):
```
node .claude/skills/mission-protect/scripts/protect.mjs dist --dry-run
```

Rút gọn (mặc định — đổi tên biến cục bộ, bỏ chú thích/khoảng trắng, GIỮ import/export):
```
node .claude/skills/mission-protect/scripts/protect.mjs dist
```

Thêm lớp làm rối chuỗi (mạnh hơn, vẫn an toàn với ES module):
```
node .claude/skills/mission-protect/scripts/protect.mjs dist --obfuscate
```

- `--hard`: bật thêm làm rối luồng điều khiển + tự vệ. **Chậm hơn khi chạy và dễ gãy hơn** — chỉ dùng cho vài tệp cốt lõi, và phải chạy thử kỹ.
- `--keep "<glob>"`: giữ nguyên thêm tệp/thư mục (lặp lại được). Mặc định đã giữ `**/vendor/**`, `**/*.min.js`.
- Lần đầu, `npx` tải đúng bản đã ghim trong script (`esbuild@…`, `javascript-obfuscator@…`). Guard có thể hỏi — đây là công cụ build, bấm đồng ý.

## Sau khi chạy

Đọc phần CẢNH BÁO script in ra:
- "có chuỗi giống bí mật": có token/khóa lọt vào bản client — **dừng**, sửa ở nguồn (đưa ra server/biến môi trường), đừng chỉ obfuscate đè lên.
- "còn sourceMappingURL" / "còn chú thích dài" / "vẫn N dòng": tệp đó có thể chưa được rút gọn — xem lại.
Rồi báo chủ dự án: số tệp, dung lượng giảm bao nhiêu %, tệp nào giữ nguyên, và nhắc đây chỉ là lớp răn đe (xem phần đầu).

## Không làm

- Không obfuscate mã server (`functions/`, `web/server/`): vô ích và dễ gãy.
- Không commit bản đã làm rối vào git (dist/ phải nằm trong .gitignore).
- Không nhúng khóa/token vào JS client rồi tưởng obfuscate là đủ — không đủ.
