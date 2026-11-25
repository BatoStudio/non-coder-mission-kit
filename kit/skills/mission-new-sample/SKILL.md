---
name: mission-new-sample
description: Đưa bộ bản vẽ/mẫu nhà mới vào app đọc bản vẽ: đọc, vẽ chồng, chủ dự án đánh dấu, sửa theo quy luật, giữ mẫu cũ, khóa kết quả. Chỉ chạy khi gõ /mission-new-sample <tên ngắn>.
disable-model-invocation: true
---

# Một bộ mẫu mới

Tham số: **tên ngắn** của bộ mẫu (`$ARGUMENTS`) — số job (`12`, `10001`) hoặc tên gọi (`mau-a`), là phần đầu tên tệp trong thư mục mẫu.
**Không bao giờ in, ghi hay commit tên tệp đầy đủ hay địa chỉ** — chỉ tên ngắn. Hook quyền riêng tư luôn chặn commit có địa chỉ; riêng **tên tệp trong thư mục mẫu** chỉ bị chặn khi đã khai `privacy.sampleDirs` hoặc `samples.dir` — kiểm ở bước 1. Báo ngắn bằng tiếng Việt.

## 0. App có skill riêng thì dùng skill đó

App có skill riêng (`appSkills.newSample`) → skill đó thường chỉ chạy bằng lệnh (`disable-model-invocation`): **dừng và nhắc chủ dự án gõ `/<tên skill> <tham số>`**, hoặc đọc `.claude/skills/<tên>/SKILL.md` của app và làm đúng từng bước trong đó. Không tự làm theo bản chung của kit khi app đã có bản riêng.

## 1. Biết app làm thế nào

Đọc `.mission/config.json → samples` (nếu có) — mỗi khóa là một lệnh của app:

| Khóa | Ví dụ | Dùng ở bước |
| --- | --- | --- |
| `dir` | `samples` | thư mục mẫu (chủ dự án chép vào; Claude không chép/di chuyển mẫu). Hook quyền riêng tư tự đọc khóa này. |
| `readCmd` | `node tools/run-samples.js "samples/{file}"` | 2 |
| `overlayCmd` | `node tools/plan-overlay.js {name}` | 3 |
| `reviewCmd` | `npm run review -- {name}` | 3, 4 |
| `checkCmds` | `["npm test", "npm run check"]` | 5 |
| `expectedFile` | `tests/expected.json` | 6 |
| `historyFile` | `docs/history.md` | 2, 5 |

Chưa có khối `samples` → tìm trong `package.json`, `CLAUDE.md`, `tools/`; đề xuất khối đó cho chủ dự án (ghi `.mission/config.json` cần đồng ý). Đọc thêm skill đọc bản vẽ của app (vd. `doc-ban-ve`) hoặc `mission-drawing-check` của kit, và `historyFile` (Grep đúng trường hợp, không đọc cả tệp): phần lớn lỗi ở bộ mới là trường hợp đã gặp.

## 2. Đọc

Chạy `readCmd` cho bộ mới. Xem **từng dòng kiểm tra**: diện tích sàn (so với số ghi trên bản vẽ), tường, cửa sổ/cửa đi (so với ký hiệu trên mặt bằng và bảng thống kê), mái, cao độ, chiều cao, khu đất. Không đọc được view nào → tìm nguyên nhân trong chính bản vẽ (tên view nhỏ, mặt bằng đặt tên theo tầng, khung view bị view bên cạnh cắt).

## 3. Vẽ chồng lên bản vẽ

Chạy `overlayCmd` và `reviewCmd`; mở trang kết quả trong trình duyệt của app (preview) và chụp hình. Kiểm cả mặt bằng mái: cạnh mái và các mặt mái bộ đọc dựng ra phải trùng bản vẽ.

## 4. Chủ dự án đánh dấu

Đưa trang review cho chủ dự án đánh dấu (Sai / Thiếu / Thừa / Hỏi / Đúng). Đọc các dấu, gom theo nhóm (tường, ô cửa, mái, cao độ, khu đất, thiết bị). Với mỗi nhóm, tìm nguyên nhân trong **dữ liệu vector của bản vẽ** quanh điểm đó (màu, nét, kiểu nét, vùng tô).

Sửa bộ đọc **bằng một quy luật về cách bản vẽ được vẽ**, không bao giờ bằng tọa độ hay tên của riêng bộ này.

## 5. Không làm hỏng mẫu cũ

Sau **mỗi** lần sửa: chạy hết `checkCmds` trên **mọi** mẫu. Số của mẫu khác đổi → phải giải thích được (một lỗi đọc thật vừa được sửa) hoặc hoàn tác. Ghi trường hợp mới vào `historyFile` dưới một tiêu đề riêng, kèm số liệu.

## 6. Xong

1. 3 chuyên gia (`/mission-review`), sửa phát hiện, chạy lại tất cả.
2. Dựng lại trang review và bản build; cho chủ dự án xem trang review và 3D.
3. Commit (hook kiểm tên tệp và địa chỉ).
4. **Chỉ khi chủ dự án xác nhận** bộ đọc đúng (`expectedFile` nên nằm trong `protect.ask` để hook hỏi) → thêm bộ này vào `expectedFile` (diện tích, cao độ, ô cửa, mái) để từ nay `checkCmds` canh giữ nó.
