---
name: mission-init
description: Khởi tạo Mission Kit cho một app — biến yêu cầu thành .mission/config.json, plan.md, manifest, nối với hook/skill/script sẵn có của app. Chỉ chạy khi người dùng gõ /mission-init.
disable-model-invocation: true
argument-hint: "[đường dẫn tệp yêu cầu]"
---

# /mission-init

Yêu cầu: $ARGUMENTS
(Trống → lấy yêu cầu người dùng vừa dán, ghi nguyên văn vào `.mission/brief.md`. Không ghi địa chỉ/tên khách hàng — thay bằng mã ngắn.)

## 1. Tạo khung

```bash
node "$MISSION_KIT/mission.mjs" init --brief "<tệp yêu cầu>" --name "<tên app>"
```

## 2. Đọc những gì app ĐÃ có (không làm lại, không đè lên)

- `CLAUDE.md`, `AGENTS.md`, README — ghi các luật bắt buộc vào `plan.md`.
- `.claude/settings.json` — hook riêng của app (guard, build sau khi sửa, privacy…). Chúng vẫn chạy song song với kit; **không** khai lại cùng việc ở `checks.onEdit` (tránh build hai lần).
- `.claude/skills/`, `.claude/agents/` — skill riêng cho review/kiểm tra/triển khai. Điền vào `appSkills` để kit dùng chúng thay vì skill chung:
  ```json
  "appSkills": { "review": "ba-chuyen-gia", "verify": "verify", "deploy": "ship", "drawings": "doc-ban-ve",
                 "privacy": "privacy-auditor", "accessTest": "access-test", "migration": "migration",
                 "newSample": "them-mau", "handoff": "gui-chatgpt" }
  ```
- Script kiểm tra sẵn có (`tools/`, `scripts/`, `package.json` scripts, `ship.sh`…) — dùng chúng làm `checks.full`.
- Danh sách chặn riêng tư sẵn có (vd. `.claude/redaction-denylist.txt`) — trỏ `privacy.denylistFiles` tới đó (một nguồn sự thật).
- Hook/agent riêng tư sẵn có (`privacy-guard`, `scan-client-leak`, `privacy-auditor`): đọc chúng để điền khối `privacy` cho đúng (thư mục mẫu, đuôi tệp cấm commit, tên dữ liệu mật phía máy chủ); hook của app vẫn chạy, kit chỉ thêm một lớp nữa. App có agent soát riêng tư riêng → `appSkills.privacy`.
- Quyền `deny` trong `.claude/settings.json` (Read `.env`, thư mục riêng, `INTERNAL`/`Payroll`…) → chuyển ý đó sang `readGuard` (kit hiểu cả lệnh shell, không chỉ công cụ Read).
- Hook khóa tệp/dòng, hook nhắc test chậm, quy trình gửi ChatGPT (hook kiểm nội dung gửi, skill đóng gói) → điền `protect.lockedText`, `checks.remind`, `handoff` (bảng dưới). Quy trình cũ chép sang Dropbox → **không chép đường dẫn Dropbox**: khai `handoff.exchangeDir` là hộp gửi trong app (vd. `docs/reviews/outbox`); việc gửi/nhận ChatGPT nay làm bằng trình duyệt của Claude (xem `/mission-handoff`).
- **Không khai lại việc hook của app đã làm** (hai hook cùng việc = Claude nhận hai lời nhắc/hai lần chặn): app đã có hook nhắc test chậm thì để `checks.remind` trống; đã có `scan-client-leak` thì để `privacy.clientCode` trống. Chỉ điền những luật app CHƯA có (vd. `readGuard`, kiểm lời nhắn commit).
- Skill riêng cho phân quyền, migration, bộ mẫu mới, gửi ChatGPT (vd. `access-test`, `migration`, `them-mau`, `gui-chatgpt`) → `appSkills.accessTest`, `appSkills.migration`, `appSkills.newSample`, `appSkills.handoff`.
- Cách dùng git: có remote không, có commit thẳng `main` không → chọn `git.mode`. Chưa có repo GitHub, hoặc app đã bật tự push (`git config --get core.hooksPath`, `tools/git-hooks/post-commit`) → ghi vào `plan.md`; muốn sao lưu lên GitHub thì dùng skill `mission-github` (chỉ khi chủ dự án đồng ý).

**Bắt buộc làm hết bước 2 rồi mới điền bước 3.** Khi báo xong `/mission-init`, `config.json` không được còn giá trị mẫu (`index.html`, `samples/*.pdf`, `skill ship` khi app dùng skill khác…) trừ khi app thật sự có chúng.

## 3. Điền `.mission/config.json`

| Khóa | Điền gì |
| --- | --- |
| `git.mode` | `local-main` (mặc định: commit thẳng nhánh chính trên máy, push phải hỏi — trừ khi chủ dự án đã bật tự push qua `mission-github`) hoặc `branch-pr` (nhánh riêng + PR) |
| `deliverables` | Sản phẩm thật (vd. tệp build), không phải tệp nguồn. `done` kiểm chúng có và mới hơn nguồn. |
| `protect.deny` | Không bao giờ sửa: dữ liệu gốc, mẫu đã có (`samples/**` — **chỉ thêm sau khi chủ dự án đã chép mẫu vào**). **Không** đưa tệp do build/script sinh ra vào đây: `deny` chặn cả lệnh build ghi tệp đó. Tệp sinh ra → `protect.ask` (hoặc để hook riêng của app lo). |
| `protect.ask` | Cần xác nhận: cấu hình triển khai, luật, kết quả kỳ vọng, CI. |
| `bash.ask` | Regex lệnh riêng của dự án cần hỏi thêm. Lệnh có chữ `deploy/publish/release/ship` và đúng `ship.deployCmd`/`previewCmd` **đã tự hỏi** — không cần khai lại. |
| `units` | Cách chia việc: tính năng (`list`), dự án mẫu, luật. `units[].gates` = danh sách cổng riêng cho nhóm (vd. mẫu chỉ cần G3, G7) để đỡ tốn công. |
| `gates` + `independentGates` | Mặc định G1–G8 (xem `mission-quality-gates`). |
| `checks.full` | Script sẵn có của app + `web-smoke` nếu là app web. Dùng `$MISSION_KIT` thoải mái — CLI tự thay đường dẫn, chạy được trên Windows. |
| `lint.rules` | Khóa bí mật, ngưỡng luật viết cứng… Luật `console-log`: bỏ đi nếu app cố ý dùng `console.log` (hàng trăm cảnh báo chỉ là tiếng ồn). |
| `privacy` | `patterns` (regex) và `denylistFiles` — CLI từ chối ghi sổ lỗi/cổng có nội dung khớp; hook chặn **commit** có nội dung khớp. Địa chỉ nhà kiểu Úc (mặc định của kit; app ở nước khác thì thêm mẫu riêng vào `patterns`) luôn bị chặn (trừ khi `addressCheck: "off"` — chỉ áp cho commit). Mẫu mặc định có số điện thoại Úc và `LOT n DP n`. App **không có dữ liệu khách** (game, cẩm nang công cộng) → `addressCheck: "off"` để địa chỉ công cộng/tên đường trong truyện không bị chặn. `allowPatterns`: dữ liệu giả được phép (vd. tên đường trong mẫu thử). `sampleDirs`: thư mục bản vẽ/hồ sơ khách (vd. `["samples"]`) — tên tệp trong đó (và phần địa chỉ sau số job) không được vào commit. `blockCommitExtensions`: đuôi tệp không bao giờ commit (vd. `["pdf","zip"]` khi mẫu là PDF của khách). `blockPush: true` khi lịch sử git còn thông tin khách chưa làm sạch. `clientCode`: `{ identifiers: [regex tên bảng/cột/khóa mật], serverMarker: "import .server-only.", serverMarkerLabel: "thêm import 'server-only'", ignoreCase: false }` — mã có thể tới trình duyệt mà nhắc chúng thì bị chặn ngay sau khi sửa. `addressCheck`: `"strong"` (mặc định khi commit: chỉ hậu tố đường rõ như Street, Road, Avenue, Crescent), `"all"` (cả Close, Way, Drive, View…), `"off"`. Lời chặn chỉ ra `tệp:dòng`; dữ liệu thử có tên đường giả → thêm vào `allowPatterns`. |
| `readGuard` | Mặc định đã chặn đọc tệp bí mật (`.env`, `.dev.vars`, khóa, `~/.ssh`, `~/.wrangler`…) và **hỏi** khi đọc Desktop/Documents/Pictures/Videos/Music/OneDrive/Dropbox. `extraPrivateDirs`: **cộng thêm** thư mục riêng (hỏi trước khi đọc); `privateDirs` thì **thay** cả danh sách mặc định — thường không dùng. `denyDirs`: thư mục không bao giờ đọc (vd. các app khác trong thư mục app — `MISSION_APPS_ROOT`). `extraSecrets`: glob trong app không được đọc (vd. `"reference/**"`, `"**/*Payroll*"`). `allowDirs`: ngoại lệ. `outside: "ask"` nếu muốn hỏi cả khi đọc mọi nơi ngoài app. |
| `protect.lockedText` | `[{ "glob": "tests/run.js", "text": "<chuỗi phải giữ nguyên>", "why": "vân tay luật đã khóa", "mode": "untouchable" }]` — tệp vẫn sửa được, riêng chuỗi đó thì không. `mode: "untouchable"`: chặn mọi lần sửa có đoạn cũ đụng vào chuỗi (kể cả biến dòng đó thành chú thích) — dùng cho vân tay/hash. |
| `checks.remind` | Kiểm tra quá chậm để tự chạy (cần phần mềm desktop, trình duyệt dài): `[{ "glob": "tools/slow/**/build.py", "name": "Slow", "message": "run_slow.ps1", "skill": "slow-test" }]` — sửa tệp khớp thì Claude được nhắc chạy trước khi báo xong. |
| `handoff` | Chỉ khi app gửi ChatGPT soát: `exchangeDir` = hộp gửi **trong app**, đường dẫn tương đối (vd. `"docs/reviews/outbox"`; không dùng Dropbox — ChatGPT nhận qua trình duyệt của Claude), `verdictGlob` (vd. `"**/*CHATGPT_VERDICT*"`), `verdictSourceLine` (regex dòng nguồn — **bắt buộc** khi có `verdictGlob`), `blockNames`, `blockExtensions` (khai là **thay** cả danh sách mặc định xlsx/xls/xlsm/pdf/zip — nhớ giữ chúng), `blockAmounts` + `syntheticAmountsFile` (app có số tiền thật). |
| `samples` | Chỉ app đọc bản vẽ: `dir`, `readCmd`, `overlayCmd`, `reviewCmd`, `checkCmds`, `expectedFile`, `historyFile` cho `/mission-new-sample`. Thêm `expectedFile` vào `protect.ask` (chỉ chủ dự án duyệt kết quả kỳ vọng). |
| `stopGate` | `watch` = để trống (mặc định: theo dõi mọi tệp git quản lý) hoặc khoanh thư mục nguồn thật; `mode` = `remind` (mặc định, chỉ nhắc) hoặc `block`. |
| `threeExperts.areas` | Ba mảng cho skill `ba-chuyen-gia`: mỗi mảng `name`, `files` (glob), `focus` (tìm gì), `commands` (lệnh kiểm). Không điền → dùng mặc định lõi/logic · dữ liệu và ca biên · người dùng/giao diện. |
| `tidy` | Cho `/mission-tidy`. `include`: glob mã nguồn thật (vd. `src/**/*.js`), không gồm bản build. **`sharedScope`**: nếu build ghép nhiều tệp thành một (vd. nối `src/js/*.js`) hoặc trang nạp nhiều `<script>` không phải module → khai mỗi nhóm một mục, vd. `[["src/js/*.js"]]`; khi đó kit bắt được hàm/biến trùng tên giữa các tệp (bản nạp sau đè bản trước). App dùng `import/export` → để trống. Ngưỡng mặc định: tệp 400 dòng, hàm 80 dòng, khối lặp 8 dòng. `onEdit` (mặc định `true`): hook sau khi sửa cảnh báo trùng lặp dính tới tệp vừa sửa; app rất lớn thấy hook chậm → `false`. |
| `ship` | `checkCmd` (kiểm tra, không đăng), `previewCmd` (bản xem trước — để trống nếu app không có), `deployCmd` (**trang thật**), `siteUrl`, `lockChecks` (URL + mã trả về mong đợi), `backupDir` (đường dẫn **tương đối** trong app, mặc định `build/backup`; không Dropbox, không chép đường dẫn tuyệt đối từ ghi chú cũ), `backupFiles`, `tag`. Lấy từ `CLAUDE.md`/`ship.sh` của app, không đoán. **Bản thử / bản sao** (brief hoặc chủ dự án nói «bản thử», hay thư mục không phải nơi app thật nằm): để `deployCmd` và `previewCmd` trống. |
| `mainBranch` | Nhánh chính (tự điền lúc init). Chỉ dùng khi mở PR ở chế độ `branch-pr`. |
| `review` | `defaultAgents` (mặc định 3 = ba chuyên gia; việc nhỏ dùng `/mission-review <đơn vị> nhanh` = 1), `maxRounds` (mặc định 3). |

Mẫu: `$MISSION_KIT/templates/config.template.json` và `$MISSION_KIT/templates/examples/`.

**Máy khác / clone mới:** hook của kit nằm trong `.claude/settings.local.json` và bản sao kit không được commit, nên trên máy mới phải chạy lại `node install.mjs --project "<thư mục app>"`. `.mission/state/` và `manifest.json` cũng không được commit, nên cần chạy lại `scan` → `check --full` → `report` → commit thì `done` mới đạt (các cổng đã chấm vẫn còn hiệu lực nếu nội dung không đổi).

## 4. Kiểm cấu hình

```bash
node "$MISSION_KIT/mission.mjs" scan
node "$MISSION_KIT/mission.mjs" lint --all --summary
node "$MISSION_KIT/mission.mjs" check --full
node "$MISSION_KIT/mission.mjs" report
```

`check --full` đỏ lúc đầu là bình thường — đó là mốc so sánh. Với mỗi bước đỏ chưa sửa ngay, ghi `ledger add --category blocker --loc "check:<tên bước>" --severity … --why … --fix …` để hook dừng không nhắc mãi.

## 5. Đặc tả

Dùng skill `mission-app-spec` để điền phần còn lại của `plan.md`.

## 5a. Bản đồ tính năng (giữ mã gọn từ đầu, khỏi phải tidy định kỳ)

Điền mục «Tính năng» của `.mission/LT.md`, mỗi tính năng một dòng: `<tính năng> — <thư mục/tệp> — <hàm/khái niệm nó sở hữu>`.

- **App mới:** đặt mỗi tính năng một thư mục (vd. `src/features/<tên>/`), phần ≥2 tính năng dùng → một thư mục chung (vd. `src/shared/`). Ghi cách chia này vào `HTC.md` (mục «Quy ước mã»).
- **App đã có:** **không dời tệp** để cho đẹp. Chỉ ghi bản đồ theo cấu trúc hiện tại (tính năng nào ở tệp nào, hàm nào là chủ). Chia lại thư mục là việc của `/mission-tidy`, khi chủ dự án đồng ý.
- Mỗi khái niệm (định dạng ngày, tính diện tích, gọi API…) chỉ có **một** chủ; các nơi khác gọi vào.
- Hook sau khi sửa tự cảnh báo: tên trùng, hàm cùng tên đã có ở tệp khác, khối lặp, tệp mới chưa có trong LT.md. Bước `tidy --conflicts` trong `checks.full` chặn tên trùng thật ở mốc kiểm tra. App cũ đang có sẵn xung đột → `check --full` đỏ ở bước đó: ghi `ledger add --category blocker --loc "check:tên trùng (xung đột)" …` rồi dọn bằng `/mission-tidy`; không gỡ bước kiểm khỏi config.

## 5b. Khối «Không được đổi» trong `CLAUDE.md`

`CLAUDE.md` nạp ở **mọi** phiên, kể cả khi hook kit không chạy (máy thiếu Node, chưa cài kit, bản nhẹ). Nên những điều không bao giờ được đổi phải nằm ở đó, không chỉ trong `HTC.md`/`plan.md`.

- Đọc `CLAUDE.md` hiện có. Đã có mục tương tự (luật bất biến, «không bao giờ», «điều cấm»…) → chỉ đề xuất bổ sung dòng còn thiếu, không viết lại.
- Soạn khối `## Không được đổi` ≤ 30 dòng, mỗi dòng một điều kiểm được: kiến trúc (vd. «logic tính luật chỉ ở server»), ranh giới bảo mật (khóa ở biến môi trường, repo private), dữ liệu khách (không vào commit/log), dữ liệu gốc và kết quả kỳ vọng (chỉ chủ dự án đổi), cách chứng minh «xong» (lệnh kiểm tra nào phải xanh). Lấy từ brief, `CLAUDE.md`/README cũ và config vừa điền — không bịa luật mới.
- Không chép lại nội dung `QUY-TRINH.md` hay hướng dẫn chung; chỉ điều riêng của app. Chi tiết dài để ở `HTC.md`, `CLAUDE.md` chỉ giữ một dòng cho mỗi điều.
- **Cho chủ dự án xem khối này trong phần báo bước 6 và chỉ ghi vào `CLAUDE.md` khi chủ dự án đồng ý** (hook cũng hỏi trước khi ghi `CLAUDE.md`). Đồng ý xong, ghi mục «Điều cấm» của `HTC.md` trỏ về khối đó (một nguồn sự thật).

## 5c. Model AI

App mới nhận cấu hình model (phiên chính `sonnet`, cố vấn `fable`) từ `node "<thư mục kit>\install.mjs" --project <thư mục app>` — chạy lệnh này nếu `.claude/settings.json` của app chưa có `model`/`advisorModel`. Giá trị app đã tự đặt thì giữ nguyên. Subagent của kit đã khai `model:` trong tệp của chúng (opus: soát; sonnet: kiểm/chụp; haiku: tìm đọc), không cần chép thêm.

## 6. Báo cho chủ dự án

Ngắn, bằng tiếng Việt: phạm vi V1, hiện trạng (mốc kiểm tra), skill riêng của app sẽ được dùng, giả định, câu hỏi cần trả lời (gom một lần).
