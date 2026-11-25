# Hướng dẫn nhờ ChatGPT viết brief cho /mission-init

Cập nhật: 2026-11

> Ví dụ trong tệp này lấy từ một công ty kiến trúc ở NSW (Úc). Thay bằng ngành nghề, luật và quy chuẩn của bạn.

## Cách dùng

Dán prompt ở mục dưới vào ChatGPT, để ChatGPT hỏi lại bạn đến khi đủ thông tin, rồi lưu kết quả thành `brief.md` và gõ `/mission-init "brief.md"` trong Claude Code. Brief tốt nghĩa là Claude điền được `plan.md` và `config.json` mà gần như không phải hỏi lại.

1. **Mở ChatGPT, dán prompt** (mục «Prompt dán vào ChatGPT»; hoặc chạy `node install.mjs --brief-prompt` trong thư mục kit để chép sẵn prompt vào clipboard), rồi kể ý tưởng app bằng lời thường — tiếng Việt, nói lộn xộn cũng được.
2. **Trả lời câu hỏi của ChatGPT.** Prompt bắt ChatGPT hỏi từng nhóm, tối đa 5 câu mỗi lượt. Câu nào chưa biết thì trả lời «chưa biết» — ChatGPT sẽ ghi vào mục Giả định hoặc Câu hỏi mở, không được tự bịa.
3. **Nhận brief theo mẫu chuẩn**, soát bằng danh sách kiểm ở cuối tài liệu, rồi lưu thành `brief.md` trong thư mục app (ví dụ `D:\APPS\<tên-app>\brief.md`). Lưu bằng Notepad thì ô «Save as type» chọn *All files*, Encoding *UTF-8*, để khỏi thành `brief.md.txt`.
4. **Trong Claude Code (mở ở thư mục app), gõ** `/mission-init brief.md`. Claude đọc brief + đọc những gì app đã có (CLAUDE.md, hook, skill, script) rồi điền `.mission/config.json` và `plan.md`, cuối cùng gửi bạn một lần các câu hỏi còn lại.

ChatGPT chỉ lo **phần nghiệp vụ** (app để làm gì, ai dùng, V1 gồm gì, thế nào là xong). Phần kỹ thuật bên trong app (hook, script, đường dẫn tệp) Claude tự đọc từ thư mục app — không cần ChatGPT đoán.

## Prompt dán vào ChatGPT

Chép nguyên khối dưới, dán vào đầu một cuộc trò chuyện mới. Nếu dùng thường xuyên, lưu nó thành một Custom GPT hoặc Project trong ChatGPT để khỏi dán lại.

```markdown
Bạn là chuyên gia phân tích nghiệp vụ cho tôi. Nhiệm vụ: giúp tôi viết BRIEF cho một app, để đưa cho Claude Code chạy lệnh /mission-init. Claude sẽ biến brief thành kế hoạch (plan.md) và cấu hình (config.json), nên brief phải đủ rõ để người kiểm tra nói được «đạt» hay «chưa đạt» mà không phải hỏi lại.

CÁCH LÀM
1. Tôi sẽ kể ý tưởng app. Bạn KHÔNG viết brief ngay.
2. Hỏi tôi theo từng nhóm bên dưới, tối đa 5 câu mỗi lượt, bỏ qua câu tôi đã trả lời. Mỗi câu kèm gợi ý đáp án mặc định để tôi chỉ cần gõ «ok» hoặc sửa.
3. Tôi trả lời «chưa biết» → ghi vào Giả định (nếu có mặc định an toàn) hoặc Câu hỏi mở. KHÔNG tự bịa số liệu, điều khoản luật, URL hay tên tệp.
4. Khi đủ, tự soát brief bằng danh sách kiểm ở cuối, rồi xuất brief theo ĐÚNG mẫu, trong một khối markdown duy nhất.

CÁC NHÓM CÂU HỎI
A. Mục tiêu: app giúp ai làm VIỆC GÌ nhanh/đúng hơn thế nào (một câu). Hiện nay việc đó đang làm thế nào, mất bao lâu.
B. Người dùng và quyền: mỗi vai trò (nội bộ công ty, khách hàng, đối tác, quản trị) được xem/sửa/tải gì và KHÔNG được gì. Mặc định: khách hàng không bao giờ tải tệp gốc (Revit, DWG, PDF đầy đủ). Có đăng nhập không.
C. Phạm vi V1: bản nhỏ nhất vẫn dùng được thật — danh sách tính năng/màn hình. Và NGOÀI phạm vi (để sau). Có tái dùng phần nào từ app khác của công ty không.
D. Dữ liệu: mỗi loại dữ liệu nằm ở MỘT chỗ nào (Dropbox, Supabase, tệp JSON, Excel…), ai được sửa. Dữ liệu gốc nào tuyệt đối không được sửa.
E. Riêng tư: app có dữ liệu khách thật không (địa chỉ, tên, số điện thoại, số tiền, lương). Có bản vẽ/hồ sơ khách làm mẫu không, dạng tệp gì. Nếu là app công cộng/không có dữ liệu khách thì ghi rõ.
F. Luật/quy chuẩn (nếu có): văn bản nào (SEPP, DCP của council nào, NCC/BCA, tiêu chuẩn bản vẽ nội bộ), điều khoản, phiên bản. Chưa chắc điều khoản → để Câu hỏi mở, không đoán số.
G. Dự án mẫu để kiểm: những dự án/bộ bản vẽ thật nào dùng để thử (ghi bằng MÃ NGẮN như số job, không ghi địa chỉ), kết quả đúng mong đợi là gì.
H. Thế nào là XONG (Definition of Done): mỗi dòng phải kiểm chứng được bằng lệnh, ảnh chụp hoặc dự án thật. Ví dụ: «Mở 5 mẫu, kết quả khớp 100%», «Không lỗi console ở 390/820/1440 px», «Tài khoản khách không tải được tệp gốc». Không chấp nhận câu mơ hồ như «dễ dùng», «nhanh».
I. Sản phẩm và triển khai: app chạy ở đâu (trang web, máy tính, Revit…), sản phẩm cuối là gì (trang web, tệp PDF, báo cáo…). Có đăng lên mạng không, tên miền/URL (nếu có), có bản xem trước không. Đây là app THẬT hay BẢN THỬ/bản sao.
J. Cách làm việc: git commit thẳng nhánh chính trên máy (mặc định) hay nhánh riêng + PR. Có gửi ChatGPT soát kết quả không. Có kiểm tra chậm cần chạy tay (Revit, trình duyệt dài) không. Thư mục nào Claude không bao giờ được đọc.
K. Điều cấm và ưu tiên: việc gì Claude không được làm trong đợt này. Việc gì làm trước (NOW), sau (NEXT), để sau nữa (LATER).

QUY TẮC GHI
- Không ghi địa chỉ, tên khách, số điện thoại, số lô (LOT/DP), số tiền thật — thay bằng mã ngắn (vd. «job 10001»).
- Câu ngắn, tiếng Việt, thuật ngữ Úc giữ nguyên (DA, CDC, BCA, NCC, BASIX).
- Phân biệt rõ: ĐÃ QUYẾT / GIẢ ĐỊNH / CÂU HỎI MỞ.
- Không viết mã, không chọn công nghệ thay tôi, không đặt đường dẫn tệp (Claude tự đọc từ thư mục app).

MẪU BRIEF (xuất đúng các mục, mục không áp dụng ghi «Không áp dụng»)
# Brief — <tên app>
## 1. Mục tiêu (một câu)
## 2. Loại dự án: app thật / bản thử
## 3. Người dùng và quyền (bảng: Vai trò | Được làm | Không được làm)
## 4. Phạm vi V1 (Trong / Ngoài phạm vi / Tái dùng từ app khác)
## 5. Nguồn sự thật (bảng: Dữ liệu | Nằm ở đâu | Ai sửa) + Dữ liệu gốc không được sửa
## 6. Riêng tư (có/không dữ liệu khách; mẫu dạng tệp gì; tệp không được commit)
## 7. Luật / quy chuẩn (bảng: Luật | Điều khoản | Phiên bản | Mẫu để kiểm)
## 8. Dự án mẫu để kiểm (mã ngắn + kết quả mong đợi)
## 9. Definition of Done (checklist - [ ], mỗi dòng kiểm chứng được)
## 10. Sản phẩm và triển khai (sản phẩm cuối; chạy ở đâu; URL; bản xem trước)
## 11. Cách làm việc (git; soát ChatGPT; kiểm tra chạy tay; thư mục cấm đọc)
## 12. Điều cấm trong đợt này
## 13. Ưu tiên (NOW / NEXT / LATER)
## 14. Giả định (cần tôi xác nhận)
## 15. Câu hỏi mở

DANH SÁCH TỰ SOÁT TRƯỚC KHI XUẤT
- Mục tiêu có đủ ai + VIỆC GÌ + TỐT HƠN THẾ NÀO.
- Mỗi vai trò có cả «được» và «không được».
- Có mục «ngoài phạm vi».
- Mỗi dữ liệu chỉ một nguồn.
- Mỗi dòng DoD kiểm chứng được, không có tính từ mơ hồ.
- Không còn địa chỉ/tên khách/số điện thoại/số tiền thật.
- Không có điều khoản luật, URL hay số liệu bịa.
- Không có hai mục mâu thuẫn nhau.

Bắt đầu bằng câu: «Kể cho tôi ý tưởng app của bạn.»
```

## Mẫu brief chuẩn

Brief gồm 15 mục cố định; mỗi mục có chỗ dùng riêng trong `plan.md` hoặc `config.json`. Mục nào thiếu, Claude phải hỏi lại hoặc để giá trị mặc định.

| Mục brief | Claude dùng vào | Thiếu thì sao |
| --- | --- | --- |
| 1. Mục tiêu | `plan.md` → Mục tiêu | Claude không biết ưu tiên gì |
| 2. App thật / bản thử | `ship.deployCmd`, `previewCmd` (bản thử → để trống) | Có thể cài lệnh đăng lên trang thật cho bản thử |
| 3. Người dùng và quyền | `plan.md` → bảng vai trò; cổng G5 | Không kiểm được phân quyền |
| 4. Phạm vi V1 | `plan.md` → V1; `units` (danh sách tính năng) | Trôi phạm vi, làm thêm việc không cần |
| 5. Nguồn sự thật | `plan.md`; `protect.deny` (dữ liệu gốc); cổng G6 | Dữ liệu phải sửa hai nơi |
| 6. Riêng tư | `privacy` (`addressCheck`, `sampleDirs`, `blockCommitExtensions`) | Hoặc chặn nhầm (app công cộng), hoặc lọt thông tin khách |
| 7. Luật / quy chuẩn | `plan.md` → bảng luật; cổng G2 | Không có nguồn để kiểm |
| 8. Dự án mẫu | `units` loại `case`; `samples`; cổng G3 | Không chứng minh được chạy đúng với dự án thật |
| 9. Definition of Done | `plan.md` → DoD; cổng G1 | Không biết khi nào là xong |
| 10. Sản phẩm và triển khai | `deliverables`; `ship` (`siteUrl`…) | Lệnh `done` không kiểm được sản phẩm |
| 11. Cách làm việc | `git.mode`; `handoff`; `checks.remind`; `readGuard.denyDirs` | Dùng mặc định: commit thẳng `main`, không chặn thư mục nào thêm |
| 12. Điều cấm | `plan.md` → Quyết định đã chốt; `protect`, `bash.ask` | Claude có thể làm việc bạn không muốn |
| 13. Ưu tiên | `plan.md` → NOW / NEXT / LATER | Claude tự xếp thứ tự |
| 14. Giả định | `plan.md` → Giả định | — |
| 15. Câu hỏi mở | `plan.md` → Câu hỏi mở (WAITING) | — |

Ví dụ một brief ngắn đã đạt (rút gọn, chỉ để thấy mức độ cụ thể cần có):

```markdown
# Brief — App xem mẫu nhà
## 1. Mục tiêu
Giúp nhân viên bán hàng cho khách xem mặt bằng, mặt đứng và 3D các mẫu granny flat trong dưới 1 phút, thay vì mở PDF rời.
## 2. Loại dự án
App thật.
## 3. Người dùng và quyền
| Vai trò | Được làm | Không được làm |
| Nội bộ công ty | sửa danh mục mẫu | — |
| Nhân viên bán hàng | xem, chia sẻ link xem trước | tải tệp Revit/DWG |
| Khách hàng | xem link được chia sẻ | tải bất kỳ tệp gốc nào |
## 9. Definition of Done
- [ ] 6 mẫu trong danh mục mở được, đủ 3 góc nhìn
- [ ] Không lỗi console ở 390/820/1440 px
- [ ] Tài khoản khách thử không tải được tệp gốc
## 15. Câu hỏi mở
- Tên miền dùng gì?
```

Các con số trong ví dụ (6 mẫu, 1 phút) chỉ để minh họa — brief thật dùng số của bạn.

## Danh sách kiểm trước khi đưa brief cho Claude

Mất khoảng 2 phút; một ô không đạt thì quay lại ChatGPT sửa trước.

- [ ] Mục tiêu có đủ ba phần: **ai**, **việc gì**, **tốt hơn thế nào**.
- [ ] Ghi rõ app thật hay bản thử.
- [ ] Mỗi vai trò có cả «được» và «không được»; khách hàng không tải được tệp gốc (trừ khi bạn quyết khác).
- [ ] Có danh sách **ngoài phạm vi**.
- [ ] Mỗi loại dữ liệu chỉ nằm một chỗ.
- [ ] Mỗi dòng Definition of Done kiểm được bằng lệnh, ảnh hoặc dự án mẫu — không có «dễ dùng», «nhanh», «đẹp».
- [ ] Dự án mẫu ghi bằng mã ngắn; **không còn địa chỉ, tên khách, số điện thoại, LOT/DP, số tiền thật**. (Hook của kit sẽ chặn commit có địa chỉ kiểu Úc, nên brief sạch ngay từ đầu đỡ vướng.)
- [ ] Điều khoản luật, URL, số liệu: hoặc bạn đã xác nhận, hoặc nằm ở Câu hỏi mở. ChatGPT hay tự điền số điều khoản nghe có vẻ đúng.
- [ ] Không có mã, tên tệp hay đường dẫn do ChatGPT đoán.
- [ ] Không có hai mục mâu thuẫn (vd. V1 có đăng nhập nhưng «ngoài phạm vi» lại ghi phân quyền).

## Lỗi thường gặp và cách sửa

Gặp lỗi nào thì dán câu «Nói với ChatGPT» tương ứng vào đúng cuộc trò chuyện đó.

| Lỗi | Nói với ChatGPT |
| --- | --- |
| ChatGPT viết brief ngay, không hỏi gì | «Dừng. Hỏi tôi theo nhóm A–K trước, tối đa 5 câu mỗi lượt.» |
| DoD mơ hồ («giao diện thân thiện») | «Viết lại mục 9: mỗi dòng phải kiểm được bằng lệnh, ảnh chụp hoặc dự án mẫu.» |
| Tự bịa điều khoản luật hoặc số liệu | «Chuyển mọi điều khoản và số liệu tôi chưa xác nhận sang mục 15 Câu hỏi mở.» |
| Brief có địa chỉ hoặc tên khách | «Thay mọi địa chỉ, tên, số điện thoại bằng mã job ngắn.» |
| ChatGPT chọn công nghệ, viết mã, đặt tên tệp | «Bỏ phần kỹ thuật; Claude sẽ tự đọc từ thư mục app. Chỉ giữ nghiệp vụ.» |
| V1 quá to (hơn khoảng 5–7 tính năng) | «Cắt V1 xuống bản nhỏ nhất vẫn dùng được thật; phần còn lại chuyển sang LATER.» |
| Thiếu mục (ChatGPT bỏ bớt) | «Xuất lại đủ 15 mục theo mẫu; mục không áp dụng ghi ‘Không áp dụng’.» |

Nếu brief vẫn còn vài chỗ hở cũng không sao: `/mission-init` sẽ gom các câu hỏi còn thiếu và hỏi bạn một lần ở bước cuối.
