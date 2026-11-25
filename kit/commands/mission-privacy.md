---
description: Soát thông tin khách có lọt ra ngoài không (trước commit, đăng, chia sẻ, gửi AI khác)
argument-hint: "[commit|dang|chia-se|lich-su] (để trống = tất cả)"
---
(`$MISSION_KIT` đã có sẵn trong phiên, trỏ tới kit; dùng thẳng, không đi tìm kit ở nơi khác.)
Giao subagent **mission-privacy-auditor** soát: $ARGUMENTS (để trống = tất cả: thay đổi sắp commit, bản build sắp đăng, tệp sắp chia sẻ, lịch sử git).
App có agent riêng (`appSkills.privacy`, vd. `privacy-auditor`) thì giao agent đó. Lưu báo cáo vào `.mission/reviews/privacy-<ngày>.md`. Không in nguyên văn thứ tìm thấy. Báo chủ dự án bằng tiếng Việt: an toàn hay chưa, còn mấy chỗ, cách sửa từng chỗ.
