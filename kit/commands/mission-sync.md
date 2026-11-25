---
description: Kiểm tra nhanh: commit, GitHub và site live có khớp nhau không (chỉ đọc)
argument-hint: "[full | no-site]"
---
Chạy công cụ kiểm tra (chỉ đọc, không push, không deploy). Có `tools/git-check.sh` trong app thì dùng nó; không có thì dùng bản của kit:

```bash
S=tools/git-check.sh; [ -f "$S" ] || S="$MISSION_KIT/../skills/mission-github/scripts/git-check.sh"; sh "$S"
```

`$ARGUMENTS` có `full` thì thêm `--full`, có `no-site` thì thêm `--no-site`.

**Trả lời thật ngắn, bằng tiếng Việt:**
- Chép đúng 2–3 dòng kết quả (Máy / GitHub / Site). Không giải thích thêm khi mọi dòng đều OK.
- Có dòng CHÚ Ý: thêm **một** câu nói nên làm gì (ví dụ "đẩy nhánh main lên?"). Không tự push, không tự deploy, không commit: chờ chủ dự án nói "có".
