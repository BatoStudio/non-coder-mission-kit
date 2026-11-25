---
name: mission-rules-engine
description: Mã hóa luật quy hoạch/xây dựng và quy ước bản vẽ thành dữ liệu có trích nguồn, hướng điều chỉnh và ca kiểm thử. CHỈ dùng trong dự án đã có .mission/config.json; nếu app có skill luật riêng thì dùng skill đó.
---

# Luật thành dữ liệu kiểm chứng được

Một luật sai trong app nguy hiểm hơn một nút bấm hỏng: người dùng tin và nộp hồ sơ theo nó. Mỗi luật phải truy được về văn bản gốc và được kiểm bằng dự án thật.

## 1. Mỗi luật là một bản ghi dữ liệu, không phải `if` rải rác trong mã

Lưu trong `rules/` (JSON/YAML/JS object), một nguồn duy nhất cho mọi app dùng chung. Trường tối thiểu:

```json
{
  "id": "cdc-sd-ppos-min-area",
  "title": "Không gian riêng ngoài trời chính (PPOS) tối thiểu",
  "applies": { "pathway": "CDC", "type": "secondary-dwelling", "zones": ["R2"] },
  "check": { "metric": "ppos_area_m2", "op": ">=", "value": 24 },
  "level": "error",
  "fix": "Mở rộng sân/hiên để PPOS ≥ 24 m² và rộng ≥ 4 m, hoặc chuyển sang DA",
  "source": { "doc": "<tên văn bản>", "clause": "<điều/khoản>", "version": "<ngày hiệu lực>", "url": "<link>" },
  "verified": { "by": "human:<tên>", "date": "YYYY-MM-DD" },
  "tests": ["samples/<dự án>.json"]
}
```

- `level`: `error` (không đạt) hoặc `attention` (lưu ý, cần người xem — vd. thông tin tùy chọn, ghi chú T.B.C, giá trị chênh nhỏ). Không đẩy lưu ý thành lỗi.
- `fix`: **bắt buộc** — người dùng phải biết sửa thế nào, không chỉ biết là sai.
- Ranh giới: ghi rõ «bằng đúng ngưỡng thì đạt hay không» (`>=` hay `>`). Đây là chỗ hay sai nhất.
- Luật phụ thuộc council/zone/lộ trình (CDC vs DA) phải nằm trong `applies`, không ngầm định.

## 2. Nguồn và thứ tự ưu tiên

1. Văn bản pháp lý đang có hiệu lực (vd. ở NSW: legislation.nsw.gov.au, NSW Planning Portal, DCP chính thức của council). Ghi điều khoản và ngày hiệu lực.
2. Quy ước nội bộ đã được chủ dự án xác nhận (ghi `verified.by: human:…`).
3. **Dự án thật của bạn là nguồn chính để lập luật và ca kiểm thử**; dự án của người khác chỉ để tham khảo.

Khi Claude đọc văn bản thấy khác với cách hiểu của chủ dự án: **không tự sửa luật**. Ghi ledger `--category attention`, trích nguyên văn điều khoản, nêu hai cách hiểu, để chủ dự án quyết.

## 3. Ca kiểm thử

- Mỗi dự án mẫu: đầu vào (`samples/…`) + kết quả kỳ vọng (`tests/expected/…json`) do người có chuyên môn xác nhận.
- Mỗi luật có ít nhất một ca **đạt**, một ca **không đạt**, và một ca **đúng ngưỡng**.
- Lệnh chạy toàn bộ ca phải nằm trong `checks.full`. Đổi luật → chạy lại toàn bộ, không chỉ ca liên quan.

## 4. Kết quả hiển thị cho người dùng

- Mỗi phát hiện: luật nào, giá trị đo được vs yêu cầu, mức (lỗi/lưu ý), **hướng điều chỉnh**, trích nguồn (bấm xem được).
- Kết quả sơ bộ (khả thi, tra cứu nhanh) phải ghi rõ là **sơ bộ / tham khảo**, không khẳng định chắc chắn; nêu những gì chưa kiểm (vd. chưa có chứng chỉ quy hoạch, chưa đo đạc).
- Dữ liệu lấy từ dịch vụ ngoài (vd. ở NSW: ePlanning, SIX Maps, Sydney Water…): ghi nguồn và thời điểm lấy; điều khoản sử dụng/giấy phép để trong plan mục «Giả định» cho đến khi xin xong.

## 5. Kiểm tra

Giao subagent `mission-rules-checker` soát: luật có khớp văn bản đang hiệu lực không, ranh giới đúng không, có luật nào áp nhầm council/zone không, kết quả có bị nói chắc hơn mức cho phép không. Mọi thay đổi luật ghi ledger kèm nguồn.
