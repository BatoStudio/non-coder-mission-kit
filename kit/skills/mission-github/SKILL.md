---
name: mission-github
description: Đưa mã nguồn một app lên GitHub ở dạng private (đăng nhập gh, tạo repo, đẩy mọi nhánh), mở trong GitHub Desktop, và bật tự push sau mỗi commit. Dùng khi chủ dự án nói "đưa lên GitHub", "sao lưu lên GitHub", "tạo repo", "tự push", "mở GitHub Desktop", hoặc chuyển app sang máy khác cần bật lại tự push, hoặc hỏi "đã lên GitHub chưa", "site đang chạy bản nào" (lệnh `/mission-sync`). Mọi bước gửi ra ngoài đều phải có chữ "có" của chủ dự án.
argument-hint: "[tạo | tự-push | desktop | máy-mới]"
---

# GitHub cho app (private)

Mục đích: GitHub là **bản sao lưu riêng** của mã nguồn. Repo luôn **private**. Không bao giờ chuyển sang public khi chưa có chữ "có" của chủ dự án.

Mỗi bước có dấu 🔒 là bước gửi ra ngoài. Nói rõ sẽ làm gì, rồi **chờ chủ dự án trả lời "có"** mới chạy. Một lần "có" chỉ cho đúng bước đó.

## 0. Kiểm tra trước (chỉ đọc)

```bash
gh --version; gh auth status            # Windows: "C:\Program Files\GitHub CLI\gh.exe" nếu gh chưa có trong PATH
git remote -v; git branch -a; git count-objects -vH
git config --get core.hooksPath; ls .git/hooks | grep -v '\.sample$'
```

- **Chưa có `gh`:** dừng, nhờ chủ dự án cài GitHub CLI (winget `GitHub.cli`), rồi làm tiếp.
- **`privacy.blockPush` là `true`** trong `.mission/config.json`: **dừng hẳn**. Lịch sử git còn thông tin khách, phải làm sạch trước. Báo chủ dự án, không đẩy gì.
- **Quyền riêng tư:** chạy agent `mission-privacy-auditor` (hoặc `appSkills.privacy`) trên **toàn bộ lịch sử** git, không chỉ bản hiện tại. Có địa chỉ, tên khách, tệp mẫu của khách → dừng và báo.
- **Kích thước:** `size-pack` trên ~500 MB hoặc có video/tệp lớn trong lịch sử → báo chủ dự án trước (GitHub chặn tệp > 100 MB).
- **Tệp bí mật:** `git ls-files | grep -Ei '\.env|\.dev\.vars|secret|token|\.pem$|\.key$'` phải trống.

## 1. Đăng nhập GitHub CLI

- Đăng nhập **trong cửa sổ terminal của chủ dự án**, không chạy ngầm: lần chạy ngầm, mã thiết bị (device code) hết hạn trước khi chủ dự án kịp dán.
  Mở một tab terminal và chạy:
  ```bash
  gh auth login --web --git-protocol https
  ```
  Chủ dự án dán mã vào trang `https://github.com/login/device` và bấm cho phép. Chờ chủ dự án báo "xong".
- Sau đó cho git dùng chính đăng nhập này:
  ```bash
  gh auth setup-git
  ```
- Token nằm trong Windows keyring. **Không bao giờ** ghi token vào tệp, commit, log hay lời nhắn.

## 2. 🔒 Tạo repo private và đẩy mọi nhánh

Hỏi chủ dự án: tên repo (gợi ý tên thư mục app, viết thường, nối bằng `-`), tài khoản (mặc định tài khoản đang đăng nhập: `gh api user -q .login`), đẩy tất cả nhánh hay chỉ nhánh chính.

```bash
gh repo create <tài khoản>/<tên> --private --description "<một dòng>" --source . --remote origin
git push -u origin --all            # hoặc: git push -u origin <nhánh chính>
gh repo view <tài khoản>/<tên> --json visibility -q .visibility     # phải in PRIVATE
git fetch origin && git branch -vv  # mỗi nhánh có [origin/...], không "ahead"
```

Lệnh push sẽ qua hook của kit và hỏi lại; đó là bình thường.
Không đẩy tag (`--tags`). Không force-push.

## 3. Mở trong GitHub Desktop

```bash
"$LOCALAPPDATA/GitHubDesktop/bin/github" "<thư mục app>"
```

Nếu Desktop chưa cài: winget `GitHub.GitHubDesktop`. Lần đầu mở, chủ dự án đăng nhập GitHub trong Desktop (File → Options → Accounts).
Desktop chỉ đọc repo trên máy. Commit trong Desktop vẫn chạy hook git của repo, kể cả tự push ở bước 4.

## 4. 🔒 Bật tự push sau mỗi commit (tùy chọn)

Chỉ làm khi chủ dự án nói rõ "có, tự push" **cho app này**. Lý do phải hỏi: hook do git chạy, không qua lớp bảo vệ của kit. Bật lên thì mỗi commit, kể cả commit từ GitHub Desktop, sẽ lên GitHub mà không hỏi lại.

Không làm khi:
- `privacy.blockPush` là `true`.
- `core.hooksPath` đã trỏ chỗ khác, hoặc `.git/hooks/` có hook thật (không phải `*.sample`). `core.hooksPath` thay **cả** thư mục `.git/hooks`, nên các hook cũ sẽ ngừng chạy. Dừng và hỏi chủ dự án.

Các bước:

1. Chép hook vào **thư mục được git theo dõi** của app, không trỏ vào bản kit trong `.claude/` (git bỏ qua thư mục đó, nên máy khác không có):
   ```bash
   mkdir -p tools/git-hooks
   cp "$MISSION_KIT/../skills/mission-github/scripts/post-commit" tools/git-hooks/post-commit
   chmod +x tools/git-hooks/post-commit
   git update-index --add --chmod=+x tools/git-hooks/post-commit 2>/dev/null || true
   ```
   (`$MISSION_KIT` trỏ vào `.claude/mission-kit`; skill nằm ở `.claude/skills/mission-github/`. Không thấy thì lấy từ kit gốc `<thư mục kit gốc>\kit\skills\mission-github\scripts\`.)
2. Giữ xuống dòng kiểu LF cho hook (Windows có thể đổi sang CRLF khi clone, làm hook hỏng). Thêm vào `.gitattributes` của app:
   ```
   tools/git-hooks/* text eol=lf
   ```
3. Bật trên máy này:
   ```bash
   git config core.hooksPath tools/git-hooks
   ```
   Guard của kit sẽ **hỏi** ở bước 1 (ghi vào `tools/git-hooks/`) và bước này (`core.hooksPath`), vì hook git tự chạy mỗi lần commit. Đó là đúng thiết kế: chủ dự án bấm đồng ý khi đã nói "có" ở trên.
4. Đảm bảo `build/` nằm trong `.gitignore` (log ở `build/git-push.log`).
5. Ghi vào `CLAUDE.md` của app một dòng có ngày: tự push bật theo ý chủ dự án, hook ở đâu, log ở đâu, máy mới phải chạy lại lệnh ở bước 3.
6. Commit (hook, `.gitattributes`, `CLAUDE.md`). Chính commit này là phép thử:
   ```bash
   cat build/git-push.log              # đợi vài giây: phải có dòng "OK"
   git fetch origin && git status -sb  # không còn "ahead"
   ```

Tắt tự push: `git config --unset core.hooksPath`, rồi sửa dòng trong `CLAUDE.md`.

**Quét bí mật trước khi push.** Trước mỗi lần push, hook quét mọi commit chưa có trên GitHub. Nó tìm token (GitHub, AWS, Anthropic, OpenAI, Slack, Google, Stripe, JWT), khóa riêng (`BEGIN … PRIVATE KEY`), các dòng gán kiểu `API_KEY = "…"`, và tệp `.env`, `.dev.vars`, `*.pem`, `*.p12`, `id_rsa`, `credentials.json`. Thấy thì **không push**, ghi `SKIPPED … possible secret` vào `build/git-push.log` kèm mã commit và tên tệp (không ghi bí mật). Khi gặp dòng này:
1. Báo chủ dự án bằng lời thường: commit nào, tệp nào. **Không** in nội dung tệp ra chat.
2. Nếu là bí mật thật: coi như đã lộ trên máy, nhắc chủ dự án **đổi/thu hồi** khóa đó. Sau đó gỡ khỏi các commit chưa push (vd. `git reset --soft origin/<nhánh>`, bỏ tệp, thêm vào `.gitignore`, commit lại). Chỉ xóa khỏi commit mới nhất thì chưa đủ: hook vẫn thấy nó trong lịch sử chưa push. Viết lại lịch sử là việc cần chủ dự án đồng ý.
3. Nếu là báo nhầm (chuỗi mẫu, dữ liệu test): thêm chú thích `mission:allow-secret` vào đúng dòng đó và commit lại. Tệp bị bắt vì **tên** nhưng không chứa bí mật (chứng chỉ công khai `.pem`…) thì ghi đường dẫn của nó, mỗi dòng một tệp, vào `tools/git-hooks/allow-secret-files` (git theo dõi tệp này). Hỏi chủ dự án trước khi thêm. Không có cách tắt quét cho cả repo.

## 5. Máy mới / clone mới

```bash
gh repo clone <tài khoản>/<tên> "<thư mục>"     # cần bước 1 trên máy đó trước
cd "<thư mục>" && git config core.hooksPath tools/git-hooks   # chỉ khi app đã bật tự push
node "<kit>/install.mjs" --project "<thư mục>"                # cài lại Mission Kit nếu app dùng kit
```

Không để thư mục app trong thư mục Dropbox đồng bộ (git và Dropbox giẫm lên nhau).

## 6. Kiểm tra đối chiếu (chỉ đọc, `/mission-sync`)

```bash
sh "$MISSION_KIT/../skills/mission-github/scripts/git-check.sh"   # hoặc tools/git-check.sh nếu app có bản riêng
```

In 3 dòng: **Máy** (tệp chưa commit), **GitHub** (từng nhánh so với GitHub, repo PRIVATE, tự push, lần push cuối),
**Site** (commit đang chạy trên Cloudflare Pages theo `wrangler pages deployment list`, commit đó đã lên GitHub chưa, còn bao nhiêu commit chưa deploy).
`--full` thêm chi tiết, `--no-site` bỏ phần site. Tự tìm `wrangler.toml` có `pages_build_output_dir`; không thấy thì bỏ qua phần site
(chỉ định tay: `--pages <tên> --account <id>`). Có dòng CHÚ Ý thì nói một câu nên làm gì, rồi chờ chữ "có"; không tự push hay deploy.

## 7. Báo chủ dự án

Bằng tiếng Việt, ngắn gọn:
- Link repo, và kết quả kiểm tra (PRIVATE).
- Những nhánh đã lên.
- Tự push đã bật hay chưa.
- Việc chủ dự án cần làm, nếu có (đăng nhập Desktop, chạy lệnh trên máy khác).
