---
name: mission-db-migration
description: Đổi cấu trúc cơ sở dữ liệu (Supabase, D1, SQLite) kiểu chỉ thêm, mỗi thay đổi một tệp, thử trên bản trống, có đường lui. Dùng mỗi khi schema đổi. App có skill riêng thì dùng skill đó.
---

# Migration chỉ thêm, không mất dữ liệu

Dữ liệu thật mất là không lấy lại được. Mọi thay đổi schema đi qua tệp migration, được thử trên bản trống trước, và chỉ chủ dự án quyết định áp lên cơ sở dữ liệu thật.

## 0. App có skill riêng thì dùng skill đó

`.claude/skills/*migration*` hoặc `appSkills.migration` trong `.mission/config.json` (vd. `app-migration`) → chạy skill đó, dừng ở đây.

## 1. Trước khi viết

- Đọc thiết kế dữ liệu của app (`.mission/plan.md`, `docs/`) và các migration đã có để theo đúng quy ước đặt tên, kiểu id, kiểu ngày giờ.
- Dữ liệu mật (lương, hợp đồng, thông tin khách) nằm ở đâu? Có hai kho (thường/mật) thì đặt cho đúng; **phân vân → kho mật**.
- Chưa rõ thì hỏi chủ dự án; không tự đặt ra bảng chứa dữ liệu nhạy cảm.

## 2. Luật

- **Chỉ thêm.** Không `DROP TABLE/COLUMN/VIEW/INDEX`, không `DELETE FROM`, không `TRUNCATE`, không đổi tên hay thu hẹp cột trên bảng đã có dữ liệu. Thay dữ liệu bằng cách **thay thế có lịch sử** (dòng mới + `supersedes_id`, `is_current`).
- Ngoại lệ duy nhất: thay mã trigger (`DROP TRIGGER` + `CREATE TRIGGER`), và dựng lại bảng có chép đủ mọi dòng **kèm test chứng minh**. Mọi việc phá hủy khác: **dừng và hỏi chủ dự án**.
- **Mỗi thay đổi một tệp**, số kế tiếp trong thư mục migration (`NNNN_ten_ngan.sql` hoặc đúng quy ước của app). Không bao giờ sửa migration đã áp lên môi trường dùng chung; viết tệp mới.
- Ràng buộc nằm trong cơ sở dữ liệu, không chỉ trong mã: `NOT NULL`, `CHECK` cho giá trị liệt kê và ngày, khóa ngoại (khóa ngoại kép cùng chủ sở hữu khi bản ghi con phải thuộc cùng người với bản ghi cha), trigger chặn sửa/xóa bản ghi bất biến.
- **Tiền**: số nguyên đơn vị nhỏ nhất + cột tiền tệ. Không dùng số thực.
- **Phân quyền** (Supabase): bật và ép RLS cho mọi bảng mới; policy cho từng vai trò; không cấp quyền cho `anon`/`authenticated` vào vùng mật. (D1/SQLite không có RLS: phân quyền nằm ở lớp truy cập dữ liệu — thêm hàm truy cập tương ứng.)
- Trigger ghi nhật ký (audit / op-context) chỉ ghi cột khóa và trạng thái — **không bao giờ** ghi số tiền, bậc lương, ghi chú, câu trả lời, thông tin liên lạc.
- Không ghi cứng người, bậc, trọng số, kết quả vào migration; dữ liệu gốc dùng chung thì ghi rõ là dữ liệu gốc.

## 3. Thử

1. Áp **toàn bộ** migration từ đầu lên bản trống (SQLite trong bộ nhớ, `supabase db reset` **cục bộ**, D1 `--local`). **Không bao giờ chạy lên máy chủ thật** — chỉ chủ dự án nói «có». Hook hỏi với `supabase db push/reset`, `wrangler d1 migrations apply` không có `--local`, `d1 execute --remote`; nhưng **không** thấy được bên trong `npm run …`: đọc script `db:*` trong `package.json` trước khi chạy, script nào áp lên máy chủ thật thì không chạy, và đề xuất thêm nó vào `bash.ask` (vd. `"npm run db:migrate\\b"`).
2. Chạy test của app. Thêm test cho ràng buộc mới (ghi sai phải bị từ chối với đúng mã lỗi).
3. Chạy skill **mission-access-test** cho mọi bảng/hàm truy cập mới.
4. Ghi **đường lui** vào `.mission/plan.md`: migration này đảo ngược bằng cách nào (thường là một migration mới), dữ liệu sao lưu ở đâu trước khi áp lên thật.

## 4. Xong

- Giao `mission-security-reviewer` soát migration (RLS, quyền, dữ liệu mật) rồi qua 3 chuyên gia như thường lệ.
- Báo chủ dự án bằng tiếng Việt: thay đổi gì, ai bị ảnh hưởng, lệnh áp lên thật là gì — **chờ chữ «có»** trước khi áp.
