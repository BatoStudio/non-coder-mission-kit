# Non-coder Mission Kit — Claude Code cho người không chuyên

**Tiếng Việt** · [English](README.md)

Quy trình làm app dùng lại được cho các app của bạn (mặc định ở `D:\APPS`, đổi bằng biến môi trường `MISSION_APPS_ROOT`). Kit đóng gói cách làm **3 chuyên gia**, ISSUE kèm hướng điều chỉnh, Definition of Done, NOW/NEXT/LATER thành:
- 25 skill (23 skill `mission-*` cùng `ba-chuyen-gia` và `ship` viết sẵn theo quy trình 3 chuyên gia), trong đó có `mission-video` để làm video có giọng đọc, và `mission-github` để sao lưu mã nguồn lên GitHub (private),
- 8 subagent soát độc lập,
- 16 lệnh gõ `/` (11 lệnh riêng + 5 skill gọi bằng `/`),
- 7 hook tự chạy (gồm lớp bảo vệ dữ liệu khách và tệp bí mật),
- một công cụ ghi sổ lỗi và cổng chất lượng.

**Kit không thay thứ bạn đã có.** Hook, skill và agent riêng của app (nếu có) vẫn chạy như cũ. Mọi thứ của kit đều có tiền tố `mission-` nên không đè lên đồ của app. App nào chưa gõ `/mission-init` thì kit không làm gì.

Có hai cách dùng:

| | Cách nhẹ | Cách đầy đủ |
| --- | --- | --- |
| Là gì | Một tệp quy trình `QUY-TRINH.md`, mỗi CLAUDE.md nhúng vào | Cài kit cho một app |
| Ép buộc | Không, chỉ dặn | Có: hook chặn, sổ lỗi, cổng, `done` |
| Token | Gần như không thêm | Thêm khoảng 2–3 nghìn mỗi phiên, cộng phần soát khi bạn gọi |
| Hợp với | Mọi app, ngay hôm nay | App mới hoặc app cần chắc chắn (luật/quy chuẩn, dữ liệu khách) |

## Cách nhẹ (2 phút)

1. Chép `kit/templates/QUY-TRINH.md` vào `D:\APPS\`.
2. Thêm một dòng vào đầu `CLAUDE.md` của app: `@../QUY-TRINH.md`
3. Lần đầu mở app, Claude Code có thể hỏi có cho đọc tệp nằm ngoài thư mục app không: chọn đồng ý.

## Cách đầy đủ: bắt đầu trong 5 phút (Windows)

0. **Kiểm tra máy có đủ đồ nghề** (mở PowerShell: bấm Start, gõ `powershell`, Enter):
   ```powershell
   node -v          # phải ra v18 trở lên
   git --version    # phải ra "git version …"
   Test-Path "C:\Program Files\Git\bin\bash.exe"   # phải ra True
   claude --version # phải ra số phiên bản Claude Code
   ```
   Dòng nào báo lỗi hoặc ra `False` thì cài trước: Node.js (nodejs.org, bản LTS) Git for Windows (git-scm.com, đã kèm Git Bash) và Claude Code (claude.com/claude-code). Tuỳ chọn: GitHub CLI `gh` (cho `mission-github`), `wrangler` (nếu triển khai lên Cloudflare). **Thiếu Node thì mọi hook của kit lặng lẽ không chạy** — không báo gì cả. Cài xong, đóng và mở lại PowerShell.

   Chỉ khi cần làm video (`mission-video`), kiểm thêm:
   ```powershell
   py -3 --version   # phải ra Python 3.x (dùng py -3, không dùng python — đó là bản giả của Windows Store)
   ffmpeg -version   # phải ra "ffmpeg version …"
   ```
   Giọng đọc Kokoro cần hai tệp mô hình `kokoro-v1.0.onnx` và `voices-v1.0.bin` (338 MB) trong `%USERPROFILE%\.cache\kokoro`. Chưa có thì tải ở trang releases của kokoro-onnx (`model-files-v1.0`, github.com/thewh1teagle/kokoro-onnx/releases). Cài thư viện: `py -3 -m pip install kokoro-onnx edge-tts soundfile numpy scipy pyloudnorm pillow`. Giọng tiếng Việt dùng Edge (`--engine edge`, giọng nữ vi-VN-HoaiMyNeural, cần mạng). Chi tiết trong `kit/skills/mission-video/references/voice.md`.
1. Tải kit về, ví dụ vào `D:\APPS\_tools\non-coder-mission-kit`:
   ```powershell
   git clone https://github.com/BatoStudio/non-coder-mission-kit "D:\APPS\_tools\non-coder-mission-kit"
   ```
   (hoặc bấm **Code → Download ZIP** trên GitHub rồi giải nén vào `D:\APPS\_tools\`. Thư mục giải ra tên là `non-coder-mission-kit-main`: đổi tên thành `non-coder-mission-kit` cho khớp các lệnh bên dưới). Các app của bạn không nằm ở `D:\APPS`? Đặt biến môi trường `MISSION_APPS_ROOT` (đường dẫn tuyệt đối, nhiều thư mục cách nhau bằng `;`; app nằm ngoài `D:\APPS` mà không đặt biến này thì kit không nhận ra đâu là thư mục app thật) để kit biết đâu là thư mục app thật.
2. Vẫn trong cửa sổ PowerShell đó, làm bước 3.
3. Gõ lần lượt các lệnh (đổi tên app cho đúng; đường dẫn có dấu cách thì giữ nguyên dấu ngoặc kép):
   ```powershell
   cd "D:\APPS\_tools\non-coder-mission-kit"
   node install.mjs --project "D:\APPS\MY APP" --dry-run   # xem trước, chưa ghi gì
   node install.mjs --project "D:\APPS\MY APP"             # cài thật
   # bản tiếng Anh (English version): thêm --lang en, vd. node install.mjs --lang en --project "D:\APPS\MY APP"
   ```
   Cài xong sẽ thấy dòng `Xong (một app: …)`. Hook của kit nằm trong `.claude/settings.local.json` (chỉ máy này). Trình cài chỉ thêm vào `.claude/settings.json` của app đúng 2 khóa `"model": "sonnet"` và `"advisorModel": "fable"` (làm việc bằng Sonnet, hỏi cố vấn Fable) — app đã đặt giá trị khác thì **giữ nguyên và báo**; gói Claude của bạn không có Fable thì đổi `advisorModel` (vd. `opus`) hoặc xóa khóa đó; gỡ kit chỉ bỏ khóa do kit ghi. Nó thêm một khối dòng vào `.gitignore` của app (để không commit bản sao kit) — commit thay đổi đó một lần. Clone app sang máy khác thì chạy lại lệnh cài trên máy đó.

   **Nên thử trước trên một app phụ**, dùng 1–2 tuần, rồi mới cài cho app chính.
4. Mở Claude Code trong thư mục app: trong PowerShell gõ `cd "D:\APPS\MY APP"` rồi `claude` (hoặc mở thư mục đó trong ứng dụng Claude). Gõ `/mission-status`. Nếu thấy «Chạy /mission-init» là đã cài đúng.
5. **Trao đổi ý tưởng với ChatGPT để viết brief.** Trình cài in sẵn các bước này ở cuối; tóm tắt:
   - Lấy prompt: `node install.mjs --brief-prompt` (chạy trong thư mục kit) — prompt được in ra và **chép sẵn vào clipboard**. Hoặc mở `kit/templates/HUONG-DAN-BRIEF-CHATGPT.md`, chép khối «Prompt dán vào ChatGPT».
   - Mở ChatGPT, tạo cuộc trò chuyện mới, dán prompt (Ctrl+V), rồi kể ý tưởng app bằng lời thường. ChatGPT hỏi lại từng nhóm, tối đa 5 câu mỗi lượt; câu nào chưa biết cứ trả lời «chưa biết».
   - Khi ChatGPT xuất brief (một khối markdown, 15 mục): bấm Copy, dán vào Notepad, **lưu thành `brief.md` trong thư mục app** (ô «Save as type» chọn *All files*, Encoding *UTF-8* — để khỏi thành `brief.md.txt`).
   - Không muốn dùng ChatGPT: gõ `/mission-brief` trong Claude Code, Claude tự hỏi và viết `brief.md`.
6. Trong Claude Code (mở ở thư mục app), gõ `/mission-init brief.md`. Claude sẽ:
   - đọc brief, rồi đọc hook, skill và script sẵn có của app;
   - nối chúng vào kit;
   - viết đặc tả và kế hoạch NOW/NEXT/LATER, cuối cùng hỏi bạn một lần các câu còn thiếu.

**Gỡ cài đặt:** `node install.mjs --uninstall --project "D:\APPS\MY APP"`. Lệnh này chỉ xóa đúng các tệp kit đã cài và trả `settings.json`, `settings.local.json`, `.gitignore` về **đúng từng byte** như trước khi cài (nếu sau khi cài bạn tự sửa các tệp đó thì chỉ bỏ phần của kit, giữ phần bạn sửa). Thư mục `.mission/` được giữ lại.

**Cài cho cả máy:** chỉ làm khi đã thử ổn trên 1–2 app. Lệnh: `node install.mjs --global`. Lưu ý: khi đó mô tả của 20 skill tự nạp, 8 agent và 11 lệnh (khoảng 3 nghìn token) được nạp ở **mọi** phiên Claude Code, cả app chưa dùng kit. Nếu một app vừa có bản toàn máy vừa có bản riêng, hook chỉ chạy một lần (bản của app), nhưng skill/lệnh hiện hai lần — nên chọn một.

Để chạy thử giao diện tự động (`web-smoke`), cài một lần trong mỗi app web: `npm.cmd i -D playwright` rồi `npx.cmd playwright install chromium` (trong PowerShell nên gõ `npm.cmd`/`npx.cmd` để khỏi bị lỗi «npm.ps1 cannot be loaded»).

## Lệnh

| Lệnh | Việc |
| --- | --- |
| `/mission-brief [tên app hoặc ý tưởng]` | **Gõ trước `/mission-init`** khi bắt đầu dự án mới: Claude hỏi theo nhóm A–K (tối đa 5 câu mỗi lượt, có đáp án mặc định), viết `brief.md` 15 mục và `brief-chatgpt.md` để nhờ ChatGPT phản biện. Không tự gửi ra ngoài: bạn tự dán, hoặc nói rõ «gửi giúp» |
| `/mission-init [tệp]` | Khởi tạo cho app: đặc tả, cấu hình, nối skill/hook sẵn có |
| `/mission-status` | Tiến độ thật, ngắn, bằng tiếng Việt |
| `/mission-sync [full\|no-site]` | Đối chiếu nhanh, chỉ đọc: còn gì chưa commit, nhánh nào chưa lên GitHub, repo còn private, site live chạy commit nào và còn bao nhiêu commit chưa deploy. Trả lời 3 dòng |
| `/mission-next [n]` | Làm các lô ưu tiên cao nhất, chạy tiếp đến khi xong hoặc cần bạn quyết |
| `/mission-review <đơn vị> [nhanh\|full]` | Mặc định chạy `ba-chuyen-gia` (3 chuyên gia song song); `nhanh` = 1 subagent; tối đa 3 vòng |
| `/mission-tidy [đo\|kế hoạch\|làm <lô>\|kết thúc]` | Dọn mã: đo code lặp, tên trùng (xung đột), tệp/hàm dài → 3 chuyên gia lập kế hoạch → làm từng lô nhỏ, hồi quy phải khớp y nguyên → bảng trước/sau |
| `/mission-fix <L-xxxx\|mô tả>` | Sửa lỗi 10 bước, có hướng điều chỉnh, quét mẫu lỗi lặp |
| `/mission-options <vấn đề>` | Phương án → So sánh → Kiểm tra → Phản biện → Quyết định |
| `/mission-verify` | Kiểm tra trước khi commit + kiểm chứng lại các tuyên bố «đã xong» |
| `/mission-deploy [preview\|production]` | Triển khai theo bậc, mặc định qua skill `ship` |
| `/mission-privacy [commit\|dang\|chia-se\|lich-su]` | Soát thông tin khách có lọt ra ngoài không (agent `mission-privacy-auditor`) |
| `/mission-new-sample <tên ngắn>` | Đưa bộ bản vẽ/mẫu nhà mới vào app đọc bản vẽ: đọc → vẽ chồng → bạn đánh dấu → sửa theo quy luật → giữ mẫu cũ → khóa kết quả |
| `/mission-handover [ghi chú]` | Bàn giao phiên: ghi đè `HANDOVER.md`, đóng sổ, cập nhật HTC/LT/manifest để phiên sau không đọc lại cả repo |
| `/mission-handoff <đơn vị> <vòng>` | Đóng gói vòng soát gửi ChatGPT: bằng chứng, hồ sơ, vân tay, kiểm che thông tin, ghi vào hộp gửi trong app (`handoff.exchangeDir`, vd. `docs/reviews/outbox`), rồi Claude mở ChatGPT bằng **trình duyệt của Claude** để gửi và đọc kết luận (bạn tự đăng nhập; không qua Dropbox; chỉ trong ứng dụng Claude desktop — chạy `claude` trong terminal thì bạn tự dán), lưu nguyên văn kết luận |
| `/mission-pr` | Nâng cao: chỉ cho chế độ git `branch-pr` |

## Hai skill quen thuộc: `ba-chuyen-gia` và `ship`

Dùng được ở **mọi app**, cả khi app chưa dùng Mission Kit. Nói «3 chuyên gia» (hoặc «phản biện») để gọi ba chuyên gia — vì tốn token, câu thường như «kiểm tra lại» chỉ làm Claude hỏi lại trước. Nói «ship» hay «đưa lên site» để kiểm tra rồi đăng.

| Skill | Làm gì |
| --- | --- |
| `ba-chuyen-gia` | 3 agent soát độc lập chạy song song, mỗi người một mảng: lõi/logic · dữ liệu và ca biên · người dùng/giao diện. Mỗi agent so bản đang sửa với bản đã commit trên mọi mẫu, không sửa tệp, không in địa chỉ/tên mẫu. Sau đó Claude báo bạn bằng tiếng Việt, sửa, chạy lại test, commit, và liệt kê những gì chưa sửa. Ba mảng có thể khai sẵn cho từng app (`threeExperts.areas`). |
| `ship` | Kiểm tra (luôn làm) → **chỉ triển khai khi bạn nói rõ «yes»**, sau câu hỏi ghi rõ «TRANG THẬT» hay «bản xem trước» → kiểm khóa trước và sau triển khai → sao lưu trong thư mục app (`mission.mjs backup`, chạy được trên Windows) → git → báo cáo. Lệnh riêng của từng app khai ở `ship` trong config: `previewCmd` = bản xem trước, `deployCmd` = trang thật. |

`/mission-deploy` không kèm gì = **chỉ bản xem trước**. App không có lệnh xem trước thì Claude dừng và báo, không tự đăng lên trang thật. Muốn lên trang thật phải gõ `/mission-deploy production`.

**App đã có bản riêng thì bản riêng được dùng.** Ví dụ app đã có skill `ba-chuyen-gia` hoặc `ship` của riêng nó: ở những app đó, trình cài không chép bản kit đè lên. Nếu có cài toàn máy thì bản kit cũng tự đọc và làm theo bản của app.

## Cài skill từ GitHub: kiểm trước, cài sau

Skill lạ là lời dặn cho Claude cộng với mã chạy bằng quyền của bạn: đọc được mọi tệp, dùng được connector đang bật và phiên `wrangler` trên máy. Gõ `/mission-skill-audit <link GitHub>`. Claude tải skill về một thư mục cách ly **ngoài app** (thư mục tạm của máy), quét chỉ đọc (không chạy gì của skill), đọc từng script theo 3 góc (chuỗi cung ứng · Cloudflare/triển khai · AI agent), rồi chấm **XANH / VÀNG / ĐỎ**. Chỉ khi bạn nói «cài», Claude mới chép đúng bản đã kiểm (ghi link và SHA vào `SOURCE.md`) vào `.claude/skills/` của app. Không thêm marketplace của bên thứ ba, vì marketplace tự cập nhật sẽ thay bản đã kiểm.

**Kiểm thứ đã cài:** gõ `/mission-config-audit` lúc nào cũng được. Ba chuyên gia độc lập (chuỗi cung ứng · Cloudflare DevSecOps · bảo mật AI agent) soát plugin, skill, agent, hook, MCP, connector, quyền, cơ chế tự cập nhật, git hook, CI, gói phụ thuộc và `wrangler.toml` của app cùng `~/.claude`. **Chỉ đọc**: không chạy script hay hook nào, không mở tệp bí mật (chỉ biết là có), không gọi connector. Báo cáo có tệp:dòng, bằng chứng, mức độ, cách khắc phục và có cần điều tra thêm không. Lưu vào `.mission/reviews/` chỉ khi bạn đồng ý. Nói thêm «nhanh» thì chỉ một người soát.

**Kit trong app có bị sửa sau khi cài không:** `node install.mjs --verify --project "<thư mục app>"`. `installed.json` ghi commit của kit lúc cài (kèm cờ nếu cài từ mã chưa commit) và mã băm sha256 của từng tệp kit, skill, agent, lệnh. Lệnh này báo tệp bị sửa, bị xóa hoặc thêm lạ.

**Chống chép code frontend:** gõ `/mission-protect` (giữa bước build và deploy). Nó làm rối **bản build** trong `dist/` — rút gọn bằng esbuild (đổi tên biến cục bộ, bỏ chú thích), tùy chọn `--obfuscate` để mã hóa chuỗi, bỏ source map, giữ nguyên `vendor/` và `*.min.js`. **Không bao giờ đụng mã nguồn**: script tự từ chối nếu thấy tệp đang được git theo dõi. Lưu ý thẳng: làm rối chỉ **làm chậm** người chép, không khóa được (mọi thứ gửi xuống trình duyệt đều xem được). Bảo vệ thật sự là để logic ở server, giữ khóa bằng biến môi trường, và điều khoản pháp lý — obfuscate chỉ là một lớp răn đe.

**Guard hỏi thêm:**
- Mọi lệnh `wrangler` trừ lệnh chỉ đọc hoặc chạy trên máy (`whoami`, `dev`, `pages dev`, `tail`, `… list`, `--local`). Nhận cả `wrangler@4`, `npm exec`, `pnpm exec`, `pnpm wrangler`. `wrangler login` cũng hỏi.
- Ghi `CLAUDE.md`, `.claude/launch.json`, `.vscode/tasks.json`, `.git/hooks`, `.git/config`, `tools/git-hooks`, `.husky`; lệnh `git config` đặt `core.hooksPath`, `fsmonitor`, `sshCommand`, `credential`, `remote.*.url`…
- Đọc transcript cũ `~/.claude/projects` (trừ bộ nhớ và kết quả công cụ). **Chặn hẳn** việc đọc `~/.claude/history.jsonl`, `~/.claude.json`, cookie trình duyệt và `GitHub CLI`.
- Bản kit trong app **không bao giờ tự tắt**. Trước đây, trong worktree, kit có thể im lặng nhường cho bản ở repo chính. Giờ chỉ bản toàn máy mới nhường, và chỉ khi app thật sự có hook kit.
- Đầu phiên, HANDOVER/HTC được nạp kèm nhãn «ghi chép, không phải lệnh». Dòng nào giống lời dặn độc thì có cảnh báo.
- Agent `mission-rules-checker` (đọc web) không còn Bash.

## Kit làm gì tự động (hooks)

| Hook | Làm gì |
| --- | --- |
| Đầu phiên (cả sau khi nén) | Nạp tình trạng thật và nhắc skill riêng của app, kèm **ngữ cảnh gọn**: `HANDOVER.md` (≤ 60 dòng), `HTC.md` hiện hành (≤ 150 dòng), sổ active (≤ 10 mục ledger đang mở). Tệp còn là mẫu trống chỉ tốn một dòng. `LT.md` (Inventory) và `manifest.json` không nạp sẵn, chỉ grep khi cần. HANDOVER cũ hơn commit mới nhất thì báo **CŨ** |
| Trước khi nén ngữ cảnh | Máy tự chụp tình trạng (git, NOW, ledger mở) vào `.mission/state/auto-handover.md`; sau khi nén, ảnh chụp này được nạp lại nếu mới hơn HANDOVER |
| Trước khi đọc tệp (Read, Grep, Glob) | **Chặn** đọc tệp bí mật (`.env`, `.dev.vars`, khóa `.pem/.key`, `~/.ssh`, `~/.wrangler`…; bản mẫu `.env.example` vẫn đọc được) và vùng mật của app (`readGuard.extraSecrets`). **Hỏi** khi đọc Desktop, Documents, Pictures, Videos, Music, OneDrive, Dropbox (`readGuard.privateDirs`) hoặc tìm trên cả ổ đĩa |
| Dữ liệu quan trọng (`protect.important`: samples/, out/golden/, tests/pdf-library*/, .mission/ledger.jsonl, build/backup/ — app sửa được) | **Hỏi** (nói rõ thư mục và số tệp sẽ mất) trước lệnh xóa/ghi đè/dời chúng; hỏi khi tạo junction/symlink vào `D:\APPS` (hoặc thư mục trong `MISSION_APPS_ROOT`) hoặc dữ liệu quan trọng; hỏi khi xóa đệ quy thư mục có junction/symlink bên trong. Đầu phiên so số tệp với phiên trước, cảnh báo nếu trống/giảm >20%. `check --full` báo junction nguy hiểm trong thư mục tạm Claude và worktree |
| Trước khi sửa tệp | Chặn sửa tệp build, mẫu, dữ liệu gốc, và **chính các tệp của kit** (để Claude không tự tắt lớp bảo vệ). Hỏi trước khi sửa cài đặt Claude Code (`settings.json`), cấu hình triển khai, luật, kết quả kỳ vọng. Sổ lỗi và cổng chỉ ghi được qua công cụ. **Dòng bị khóa** (`protect.lockedText`): tệp sửa được, riêng dòng đó thì không. **Gửi ChatGPT** (`handoff`): nội dung ghi vào hộp gửi (`exchangeDir`, trong app) phải qua kiểm che thông tin — chỉ chữ trong hộp gửi mới được dán vào ChatGPT; tệp kết luận chỉ ghi một lần. **Hỏi** trước khi thêm/sửa skill, agent, lệnh, hook, plugin hay `.mcp.json` (trong app và `~/.claude`): đó là mã và lời dặn mới cho Claude. |
| Trước khi chạy lệnh (Bash và PowerShell) | **Chặn:** force-push, xóa nhánh từ xa, tạo alias git, tự merge PR, tự release, ghi/xóa sổ lỗi hay vùng bảo vệ (kể cả qua `*`, biến, lệnh viết tắt PowerShell, symlink). **Hỏi trước:** mọi `git push`, lệnh triển khai (`deploy`, `wrangler`…, và đúng lệnh trong `ship` — nói rõ TRANG THẬT hay bản xem trước), đổi cơ sở dữ liệu, lệnh SQL xóa, `reset --hard`, xóa đệ quy **ngoài** thư mục app, lệnh in `.env`/token ra màn hình, đọc thư mục riêng, tìm trên cả ổ đĩa, chép vào thư mục trao đổi mà hook không kiểm được nội dung. **Quyền riêng tư khi commit:** chỉ xét đúng những gì sẽ vào commit (kể cả lời nhắn commit), chặn khi có địa chỉ nhà (mặc định chỉ hậu tố rõ như Street, Road, Avenue — `privacy.addressCheck`; chỉ nhận địa chỉ kiểu Úc/tiếng Anh, địa chỉ Việt Nam thì thêm mẫu vào `privacy.patterns`), tên trong danh sách chặn, tên bộ mẫu/địa chỉ lấy từ `privacy.sampleDirs`, hoặc tệp có đuôi bị cấm (`privacy.blockCommitExtensions`, vd. `.pdf`); `privacy.blockPush` chặn push (cả `gh repo … --push`, đổi remote) khi lịch sử còn thông tin khách. Lời chặn chỉ ra `tệp:dòng`; dữ liệu thử có tên đường giả thì khai `privacy.allowPatterns`. Hook đọc lệnh như shell thật: chữ trong commit message, ghi chú sổ lỗi hay thân heredoc không bị coi là lệnh; dọn thư mục build (`rm -rf dist`) không bị hỏi. Có nhiều lệnh trong một dòng thì lấy kết quả nghiêm nhất. **Hỏi** trước khi cài skill/plugin/MCP (`npx skills add`, `claude plugin install`, `claude mcp add`), gói toàn máy (`npm i -g`), hoặc tải mã rồi chạy ngay (`curl … | sh`, `irm … | iex`). |
| Sau khi sửa | Bắt khóa bí mật (Anthropic, OpenAI, Cloudflare, Supabase, AWS…) và chạy kiểm tra nhanh cho đúng tệp vừa sửa. Chặn mã có thể tới trình duyệt mà nhắc dữ liệu mật (`privacy.clientCode`). **Nhắc** (không chạy) test chậm (vd. cần phần mềm desktop) khi sửa đúng tệp (`checks.remind`). **Giữ mã gọn từ đầu** (`tidy.onEdit`, mặc định bật): cảnh báo ngay khi tệp vừa sửa có tên trùng, hàm cùng tên đã có ở tệp khác, hoặc khối mã lặp; tạo tệp mới mà chưa ghi vào bản đồ `.mission/LT.md` (mục «Tính năng») thì nhắc ghi. Chỉ cảnh báo, không chặn |
| Khi Claude định dừng | Chỉ **nhắc** nếu kiểm tra đã cũ, không chặn, để đỡ tốn token. Muốn chặn hẳn thì đặt `stopGate.mode: "block"` |

## Luật mà công cụ tự áp

- Lỗi nào cũng phải có **hướng điều chỉnh** (`--fix`). Lưu ý (`attention`) tách riêng khỏi lỗi và không chặn.
- Chấm đạt hay trượt đều phải có bằng chứng. Cổng soát độc lập phải kèm tệp báo cáo của subagent, dòng kết luận cuối là `KẾT LUẬN: PASS` hoặc `KẾT LUẬN: PASS KÈM SỬA (…)`; còn chữ `FAIL` hay `THIẾU BẰNG CHỨNG` thì công cụ từ chối.
- Bỏ qua một lỗi CRITICAL/HIGH phải có chữ `human:<tên bạn>`.
- **Không ghi địa chỉ nhà, tên khách hàng** vào sổ lỗi: công cụ từ chối. Có thể trỏ tới danh sách chặn sẵn có của app.
- **Sửa rồi commit cũng không qua mặt được.** Kit nhớ nội dung từng tệp lúc kiểm tra. Tệp nào đổi sau đó (kể cả đã commit), hoặc lệnh kiểm tra trong config đổi, thì kết quả cũ bị đánh dấu **CŨ** và `done` báo chưa đạt. Thư mục không phải repo git thì `done` không bao giờ đạt.
- `done` còn kiểm: phạm vi đã khai khớp với tệp hiện có (thêm mẫu mới mà chưa `scan` là chưa đạt), không còn vướng mắc (`blocker`) mở ở bất kỳ mức nào, sổ lỗi không có dòng hỏng, báo cáo được sinh sau thay đổi cuối của sổ/cổng/kiểm tra.
- **Cổng soát độc lập** không đặt được «NA» trừ khi chủ dự án ghi `human:<tên>`.
- **Tên tệp mẫu giống địa chỉ** (kể cả viết dính như `12QuokkaAvenue`) được `scan` đổi sang mã ngắn (`m-xxxxxx`); `manifest.json` không được commit; đầu ra lệnh kiểm tra và đoạn kế hoạch chép vào báo cáo được che địa chỉ.
- Hai tệp mẫu trùng tên ở hai thư mục → `scan` dừng và báo (nếu không, cổng của tệp này bị tính cho tệp kia).
- Lỗi lặp lại từ 2 lần trở lên thì công cụ nhắc quét toàn dự án.
- Sổ lỗi có dòng hỏng thì công cụ không ghi thêm; chạy `node "$MISSION_KIT/mission.mjs" ledger repair` để chuyển dòng hỏng sang `ledger.bad.jsonl` (giữ nguyên văn).
- `mission.mjs backup` sao lưu vào `ship.backupDir` (mặc định `build/backup`, trong app, không Dropbox), tự đặt `.gitignore` bên trong thư mục sao lưu — không sửa `.gitignore` của app.
- Tệp chỉ đổi kiểu xuống dòng (CRLF Windows ↔ LF) không bị coi là đã sửa.

## Git

| Chế độ | Khi nào | Luật |
| --- | --- | --- |
| `local-main` (mặc định) | Repo trên máy, commit thẳng `main` làm mốc | Commit thoải mái; `git push` phải hỏi; force-push bị chặn |
| `branch-pr` | Làm việc qua GitHub với người khác | Làm trên nhánh riêng, không commit vào `main`, bàn giao bằng PR |

**Sao lưu lên GitHub (skill `mission-github`):** tạo repo **private**, đẩy các nhánh, mở trong GitHub Desktop. Tùy chọn **tự push sau mỗi commit**: chỉ bật khi bạn nói "có" cho từng app (ghi ngày vào `CLAUDE.md` của app). Hook `tools/git-hooks/post-commit` của app do git chạy, nên **không** qua bước hỏi `git push` của kit; nó tự dừng khi `privacy.blockPush` là `true`, chạy ngầm, ghi log vào `build/git-push.log`. Máy mới: chạy lại `git config core.hooksPath tools/git-hooks`. Trước mỗi lần tự push, hook quét các commit chưa lên GitHub; thấy token, khóa riêng hay tệp `.env`/`.dev.vars`/`.pem` thì **không push** và ghi `SKIPPED … possible secret` vào log (chỉ ghi tên tệp, không ghi bí mật).

## Thuật ngữ

| Từ | Nghĩa |
| --- | --- |
| Skill | Bản hướng dẫn Claude tự đọc khi gặp đúng việc |
| Subagent | Một Claude phụ, chạy riêng để soát độc lập (chỉ đọc, chỉ báo cáo) |
| Hook | Đoạn kiểm tra tự chạy trước hoặc sau mỗi thao tác của Claude |
| Commit | Một mốc lưu trong git, có thể quay lại |
| Nhánh / PR | Bản làm việc tách riêng / yêu cầu gộp vào bản chính. Chỉ dùng ở chế độ `branch-pr` |
| Cổng (gate) | Một tiêu chí chất lượng (G1–G8) phải đạt, có bằng chứng |
| Kết luận 3 mức | `PASS` (sạch) · `PASS KÈM SỬA` (chỉ còn lỗi nhỏ, phải vào sổ) · `FAIL` (có lỗi nặng hoặc thiếu bằng chứng ở phần quan trọng) |
| THIẾU BẰNG CHỨNG | Người soát ghi rõ phần mình không kiểm được, thay vì im lặng cho qua |
| Ledger | Sổ lỗi: vị trí, vì sao sai, hướng điều chỉnh, đã kiểm chứng thế nào |

## Thành phần

- **Skills:** `ba-chuyen-gia`, `ship`, `mission-run`, `mission-init`, `mission-app-spec`, `mission-repo-recon`, `mission-rules-engine`, `mission-drawing-check`, `mission-web-qa`, `mission-defect-loop`, `mission-quality-gates`, `mission-regression`, `mission-deploy`, `mission-pr`, `mission-tidy`, `mission-access-test` (test phân quyền: ai KHÔNG xem/sửa được gì), `mission-db-migration` (đổi cơ sở dữ liệu chỉ thêm, có đường lui), `mission-new-sample`, `mission-handoff`, `mission-handover` (bàn giao phiên, chống đọc lại cả repo), `mission-video` (kịch bản → giọng Kokoro → nhạc nền → logo → MP4), `mission-skill-audit` (kiểm skill/plugin lạ từ GitHub trước khi cài), `mission-config-audit` (3 chuyên gia kiểm bảo mật, chỉ đọc, toàn bộ plugin/skill/hook/MCP/quyền đang cài cho app và cho máy), `mission-protect` (làm rối bản build frontend để chống chép — chỉ xử lý dist/, không đụng nguồn), `mission-github` (repo private trên GitHub, GitHub Desktop, tự push sau commit nếu bạn bật)
- **Subagents** (mỗi agent khai rõ `model:`; cố vấn của phiên chính `advisorModel` = fable): soát, chỉ báo cáo — `mission-checker`, `mission-evaluator`, `mission-rules-checker`, `mission-security-reviewer`, `mission-privacy-auditor` (opus); `mission-verifier`, `mission-visual-qa` (sonnet, rẻ hơn); `mission-explorer` (haiku, tìm và đọc, chỉ Read/Grep/Glob). Phiên chính: sonnet.
- **Công cụ:** `mission.mjs` (sổ lỗi, cổng, kiểm tra, báo cáo, `done`), `kit/tools/web-smoke.mjs`, `kit/tools/rules-audit.mjs`
- **Mẫu cấu hình** (`kit/templates/examples/`): `cdc-granny-flat` (app tra cứu theo luật quy hoạch)
- **Mẫu brief:** `kit/templates/HUONG-DAN-BRIEF-CHATGPT.md` — cách nhờ ChatGPT viết brief để dán vào `/mission-init`
- **Kiểm thử của chính kit:** `bash tests/run-tests.sh` (chạy trên Windows/Git Bash; trên Linux chạy ít ca hơn vì bỏ các ca chỉ dành cho Windows). Chưa có ca nào cho `mission-video` — skill này kiểm bằng mắt và tai (xem bước 7 trong skill)
- **Tự push:** `tools/git-hooks/post-commit` đẩy nhánh hiện tại sau mỗi commit (cả từ GitHub Desktop), chạy ngầm, log ở `build/git-push.log`. Bật trên từng máy bằng `git config core.hooksPath tools/git-hooks`; clone mới thì chạy lại. Không bật thì không có gì tự push.

## Nâng cao

- **CI GitHub:** `kit/templates/ci/mission-check.yml` (tự tải kit trong lúc chạy, vì `.claude/mission-kit/` không được commit). Chỉ kiểm tra, không triển khai.
- **`bash.freeDirs`:** nơi ghi, sửa, xóa bằng lệnh shell mà không hỏi. Mặc định: thư mục tạm của hệ thống, `%TEMP%/claude/**`, `build/logs/**`. Đích được chuẩn hóa (`../`, symlink, junction, cygpath) trước khi xét; rơi vào `.mission/`, `.claude/mission-kit/` hay `protect.deny` thì vẫn bị chặn.
- **Chạy lệnh trên Windows:** kit tự thay `$MISSION_KIT` bằng đường dẫn thật và dùng Git Bash nếu có. Không có Git Bash thì dùng cmd.exe; khi đó lệnh trong `checks` không được dùng cú pháp riêng của sh.

## Giới hạn đã biết

- **Token Cloudflare kiểu cũ (40 ký tự, không có tiền tố `cfut_`):** mẫu `bi-mat-cloudflare` chỉ có trong config mới. App đã cài trước đó phải tự thêm mẫu này vào `.mission/config.json` (mục `lint.rules`, chép từ `kit/templates/config.template.json`).
- **Bản đồ tính năng và kiểm tên trùng:** hook sau khi sửa có ngay khi cài lại kit (`node install.mjs --project "<thư mục app>"`). Riêng bước `tidy --conflicts` trong `checks.full` và mục «Tính năng» của `.mission/LT.md` chỉ app khởi tạo mới mới có; app đã cài trước đó phải tự thêm bước này vào `checks.full` (chép từ `kit/templates/config.template.json`) và thêm mục «Tính năng» vào `LT.md` (chép từ `kit/templates/LT.template.md`). App đang có sẵn tên trùng thì `check --full` sẽ đỏ ở bước này: ghi vào sổ lỗi rồi dọn bằng `/mission-tidy`.
- **Ca «H1: tệp có \ trong tên» được bỏ qua trên Windows** (Windows không cho đặt tên tệp có dấu `\`).
- **Hard link tới `.env` không phát hiện được qua đường dẫn.** Hard link là một tên khác của cùng dữ liệu, không có đường dẫn «thật» nào để so, nên hook đọc đường dẫn không nhận ra. Symlink và junction thì được xét theo đích thật.
- **Kit mới dùng thật trên một số ít app, trên Windows.** Bộ kiểm thử đầy đủ chạy đạt trên Windows bằng Git Bash, gồm cả cài/gỡ thử (sau khi gỡ, hook và quyền giống hệt bản gốc). Hãy thử trên một app phụ trước.
- **Hook chặn lệnh là lưới an toàn dựa trên mẫu chữ, không phải hàng rào tuyệt đối.** Ví dụ một đoạn mã `node -e "…"` hay `python -c "…"` tự ghi tệp vẫn lọt; `cd samples; rm a.pdf` trong cùng một lệnh cũng lọt. Hook đôi khi hỏi/chặn nhầm một lệnh vô hại — khi đó đọc lý do và gõ lệnh rõ ràng hơn.
- **Cổng soát độc lập vẫn dựa trên tin cậy.** Tác tử chính là bên lưu tệp báo cáo. Đổi lại, mọi cổng đều để lại dấu vết kiểm tra được.
- **Kit viết cho Windows** (PowerShell, Git Bash). macOS/Linux: chưa thử.
- Kit chưa kiểm tra xung đột với thiết lập `.claude` cấp máy (`~/.claude`) của bạn.
