# Quy trình làm app (bản nhẹ, không cần cài kit)

Nhúng vào CLAUDE.md của mỗi app bằng một dòng: `@../QUY-TRINH.md` (đặt tệp này ở thư mục cha chứa các app, vd. D:\APPS\).

## Cách làm việc
- Trước thay đổi lớn: nói kế hoạch vài dòng, commit/sao lưu theo quy định của app, rồi làm.
- **Viết lại một phần lớn hoặc đổi kiến trúc** (không áp cho sửa lỗi, thêm tính năng thường): vào plan mode trước (chủ dự án bấm Shift+Tab, hoặc Claude tự vào) — đọc mã, đề xuất cách làm, chủ dự án duyệt rồi mới viết mã. Làm bản mới trong **git worktree** để bản cũ chạy nguyên; chạy cùng bộ kiểm tra/mẫu chuẩn trên cả hai, bản mới bằng hoặc hơn mới gộp, rồi gỡ đường cũ. Dữ liệu (mẫu, golden, node_modules) cần trong worktree thì **chép**, không dùng junction/symlink. Gộp xong: `git worktree remove`.
- Làm theo lô; gom nhiều sửa vào một lượt. Kiểm tra đầy đủ và chụp ảnh chỉ ở mốc (cuối lô, trước commit), không sau từng sửa nhỏ.
- Không đọc lại tệp lớn — sửa đúng đoạn.
- Báo cáo ngắn, bằng tiếng Việt: đã xong · cần quyết định · vướng. Dùng bảng khi hợp.

## Tự quyết và khi nào hỏi
Chủ dự án cho phép thường trực. Mặc định là làm tiếp; chỉ dừng hỏi ở danh sách LUÔN HỎI.
- **Tự làm, không cần báo riêng:** đọc, tìm, sửa mã trong phạm vi việc được giao, chạy test/kiểm tra, script nháp trong thư mục tạm của phiên, ghi sổ lỗi/HANDOVER qua công cụ.
- **Làm rồi báo** (báo trong phần tóm tắt cuối lượt, không hỏi trước):
  - commit trên máy khi kiểm tra xanh và hook quyền riêng tư cho qua; lời commit dùng mã ngắn; báo mã commit. App có hook báo lịch sử git còn thông tin khách thì vẫn hỏi;
  - việc tiếp theo trong yêu cầu hoặc kế hoạch đã duyệt: đã viết «tiếp theo làm X» thì làm X luôn, không kết thúc lượt để chờ «tiếp tục»;
  - sửa lỗi cùng lô, chạy 3 chuyên gia trước khi gọi là xong;
  - khi có vài cách làm mà quay lại được bằng git: chọn cách hợp lý nhất, ghi lý do.
- **Luôn hỏi:** deploy (trang thật hay bản xem trước), push ở app không tự push, merge, đổi cơ sở dữ liệu, xóa dữ liệu quan trọng, đổi repo sang public, tiền/tài khoản/khóa, gửi dữ liệu khách hoặc nhân viên ra ngoài, gu thẩm mỹ (giọng, hình, logo), quyết định sản phẩm có đánh đổi thật, ký thay chủ dự án (`--by human:`), và mọi việc hook vừa chặn hoặc hỏi.
- Không mời deploy sau mỗi lượt: gom thành một câu khi cả lô xong và kiểm tra đạt.
- Lệnh nào Claude tự chạy được thì tự chạy và tự đọc kết quả; chỉ nhờ chủ dự án việc cần mật khẩu, 2FA, duyệt quyền hoặc phần mềm có giao diện. Không bảo chủ dự án gõ /compact hay mở phiên mới giữa việc: ngữ cảnh tự nén, hook tự nạp lại.
- Báo «xong» phải kèm bằng chứng đã thấy tận mắt (đã mở trang/tệp, ảnh chụp), không chỉ «test xanh».
- Khi phải hỏi: một câu, tiếng Việt thường, không mã kỹ thuật; tự mở sẵn chỗ cần xem và ghi rõ ở đâu; nêu cách đề xuất.
- Hook chặn thì không tìm cách lách, không thử lại cùng kiểu: đọc lời báo, làm theo cách nó chỉ, hoặc dừng hỏi.

## ISSUE và TASK
- ISSUE (lỗi/lưu ý): ghi vị trí, vì sao sai, **hướng điều chỉnh**, mức CRITICAL / HIGH / MEDIUM / LOW. Lưu ý (không sai, cần người xem) tách riêng khỏi lỗi.
- TASK (việc phải làm): NOW / NEXT / LATER, kèm WHAT / WHO / WHEN, trạng thái ACTIVE / WAITING / BLOCKED / DONE.
- Lỗi lặp lại từ 2 lần: tìm toàn dự án, sửa hết, thêm kiểm tra để không tái phát.

## 3 chuyên gia trước khi gọi là xong
Người làm (builder) tự soát hai lần trước (lần 2 đọc như người khác viết). Sau đó **3 chuyên gia độc lập soát song song**, mỗi người một mảng, không ai là người đã làm:
1. Lõi / logic: tính đúng không, so bản đang sửa với bản đã commit trên mọi mẫu.
2. Dữ liệu và ca biên: đầu vào lạ, thiếu, quá lớn; quyền riêng tư.
3. Người dùng / giao diện: có dùng được, có đáng dùng, có cách nào tốt hơn?
Mỗi người trả danh sách lỗi (mức, cách tái hiện, **hướng sửa**), ghi `THIẾU BẰNG CHỨNG` cho phần không kiểm được, và dòng cuối `KẾT LUẬN: PASS`, `PASS KÈM SỬA` (chỉ còn lỗi nhỏ) hoặc `FAIL`. Người soát phần lõi luôn hỏi thêm: có cách nào **đơn giản hơn** không? Sửa → soát lại phần đã sửa, tối đa 3 vòng. Chỉ dùng 1 chuyên gia (việc nhỏ) khi chủ dự án cho phép.
Chỉ báo «xong» khi có bằng chứng (lệnh + kết quả) cho từng mục của Definition of Done.

## Luôn giữ
- Một nguồn sự thật: không để cùng một thông tin phải sửa ở hai nơi.
- Không ghi địa chỉ, tên khách hàng, tên tệp mẫu vào log, commit, báo cáo — dùng mã ngắn.
- Không triển khai, không đổi cơ sở dữ liệu, không push khi chưa được chủ dự án đồng ý. Ngoại lệ: app chủ dự án đã bật **tự push sau commit** (ghi có ngày trong `CLAUDE.md`, hook `tools/git-hooks/post-commit`): ở app đó, commit cũng là push.
- Repo GitHub của app để **private** (trừ khi chủ dự án chọn khác); không đổi sang public khi chưa được chủ dự án đồng ý.
- Kết quả theo luật (vd. CDC, DCP, NCC ở NSW) là sơ bộ: ghi nguồn điều khoản, không khẳng định chắc chắn.
