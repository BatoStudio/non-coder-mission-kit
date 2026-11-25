---
name: mission-access-test
description: Viết và chạy test phân quyền (ai KHÔNG xem/sửa được gì) cho app có đăng nhập, chỉ dùng dữ liệu giả. Dùng sau khi đổi bảng/hàm truy cập/route và trước cổng G5. App có skill riêng thì dùng skill đó.
---

# Test phân quyền — chứng minh điều KHÔNG được phép

Ẩn nút trên giao diện không phải phân quyền. Phân quyền thật nằm ở **phía máy chủ** (RLS của Supabase, lớp truy cập dữ liệu, hàm server, Cloudflare Access, bucket riêng tư). Test phải gọi đúng tầng đó.

## 0. App có skill riêng thì dùng skill đó

Tìm `.claude/skills/*access*` hoặc `appSkills.accessTest` trong `.mission/config.json` (vd. `app-access-test`). Có → chạy skill đó, dừng ở đây.

## 1. Bảng quyền là hợp đồng

- Lấy bảng **vai trò × đối tượng × hành động** từ `.mission/plan.md` (mục phân quyền) hoặc tài liệu của app. Chưa có → viết bảng nháp, **hỏi chủ dự án xác nhận** trước khi viết test (không tự quyết ai được xem gì).
- Vai trò tối thiểu: người chưa đăng nhập · người dùng A · người dùng B (cùng vai trò với A) · vai trò cao hơn (quản lý/giám đốc) · khách hàng (nếu app có portal khách). Có xác thực 2 bước → tách «quản lý chưa qua bước 2» và «quản lý đã qua bước 2».

| Đối tượng | Hành động | Chưa đăng nhập | A (của mình) | A xem của B | Quản lý | Khách |
| --- | --- | --- | --- | --- | --- | --- |
| ví dụ: hồ sơ đánh giá | đọc | từ chối | được | **không thấy** | được | từ chối |

## 2. Người và dữ liệu giả

- Chỉ dùng người giả (`SYN-A`, `SYN-B`, `Director-TEST`) và số giả, tròn và vô lý (vd. bậc lương 50–100). Không bao giờ dùng tên thật, lương thật, địa chỉ khách.
- Dùng một hàm dựng chung (`setup()`/fixture) cho mọi test; mở rộng nó, không dựng dữ liệu rời từng tệp.

## 3. Mỗi ô của bảng = một test

- **Được phép** → thành công (`ok`).
- **Không được phép** → thất bại với **đúng mã lỗi** app quy định (`forbidden`, `unauthenticated`, `mfa_required`…).
- **Đọc dữ liệu của người khác** → `not_found` (không lộ là bản ghi có tồn tại), không bao giờ trả dữ liệu, không trả một lỗi khác làm lộ sự tồn tại.
- Người dùng không tự đổi được cột trạng thái, chủ sở hữu, số tiền — trừ qua hàm chuyển trạng thái đã đặt tên.
- **Tệp**: bucket/R2 riêng tư; URL ký có hạn; khách không tải được tệp gốc (Revit/DWG/PDF đủ) bằng cách đoán đường dẫn.
- **Rò rỉ**: phản hồi, thông báo lỗi, log, PDF/CSV xuất ra, dữ liệu biểu đồ của người dùng thường không chứa dữ liệu mật hay dữ liệu người khác.
- **Toàn vẹn** (gọi thẳng cơ sở dữ liệu): ghi trỏ vào bản ghi cha của người khác → khóa ngoại từ chối; bản ghi bất biến không sửa/xóa được.

## 4. Chạy và báo

- Chạy test của app (`npm test` hoặc lệnh trong `checks.full`). Báo số đạt/hỏng và các khẳng định hỏng, bằng tiếng Việt.
- **Không bao giờ nới lỏng** một luật truy cập, trigger hay khóa ngoại để test qua. Test từ chối mà hỏng = **lỗi bảo mật**: ghi ledger mức HIGH trở lên (`--category blocker` nếu lộ dữ liệu), sửa ở tầng máy chủ.
- Xong → ghi bằng chứng cho cổng G5 rồi giao `mission-security-reviewer` soát độc lập.
