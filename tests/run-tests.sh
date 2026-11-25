#!/usr/bin/env bash
# Bộ kiểm thử hồi quy cho Mission Kit — tái hiện các lỗi mà vòng "3 chuyên gia" đã tìm ra.
# Chạy: bash tests/run-tests.sh   (cần node, git; chạy trên Linux/macOS/Git Bash)
set -u
KITSRC="$(cd "$(dirname "$0")/.." && pwd)"
T=$(mktemp -d)
WIN_BASH=; case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) WIN_BASH=1;; esac
# Git Bash: Node không hiểu /tmp/… và lấy thư mục nhà từ USERPROFILE, nên đưa đường dẫn dạng C:/… như Claude Code thật gửi.
if [ -n "$WIN_BASH" ]; then T=$(cygpath -m "$T"); export USERPROFILE="$T/home"; fi
export HOME="$T/home"; mkdir -p "$HOME"
PASS=0; FAIL=0
ok(){ PASS=$((PASS+1)); echo "  ✓ $1"; }
bad(){ FAIL=$((FAIL+1)); echo "  ✗ $1"; }
expect(){ # expect <mô tả> <mẫu cần có> <đầu ra>
  if grep -qE -- "$2" <<<"$3"; then ok "$1"; else bad "$1 — nhận: $(head -c 300 <<<"$3")"; fi; }
expect_not(){ if grep -qE -- "$2" <<<"$3"; then bad "$1 — nhận: $(head -c 300 <<<"$3")"; else ok "$1"; fi; }

P="$T/app dir"; mkdir -p "$P/src" "$P/samples" "$P/.claude/agents"
cd "$P"; git init -q -b main; git config user.email t@t; git config user.name t
echo good > src/app.js; echo pdf > samples/a.pdf
echo "agent riêng của app" > .claude/agents/security-reviewer.md
mkdir -p .claude/skills/ship; echo "ship riêng của app" > .claude/skills/ship/SKILL.md
printf '\xef\xbb\xbf{"hooks":{"PreToolUse":[{"matcher":"Bash","hooks":[{"type":"command","command":"node app-guard.mjs"}]}]}}' > .claude/settings.json
git add -A; git commit -qm init

echo "## Trình cài"
expect "không đối số → in hướng dẫn" "Chọn nơi cài" "$(node "$KITSRC/install.mjs" 2>&1)"
expect "--project thiếu đường dẫn → báo lỗi" "cần đường dẫn" "$(node "$KITSRC/install.mjs" --project --dry-run 2>&1)"
echo x > .claude/agents/mission-checker.md
expect "tệp trùng tên không phải của kit → từ chối, không ghi" "không ghi đè" "$(node "$KITSRC/install.mjs" --project "$P" 2>&1)"
[ ! -d .claude/mission-kit ] && ok "từ chối thì chưa ghi gì" || bad "đã ghi dở dang"
rm .claude/agents/mission-checker.md
out=$(node "$KITSRC/install.mjs" --project "$P" 2>&1); expect "cài được với settings.json có BOM" "Xong" "$out"
expect "giữ hook riêng của app" "app-guard.mjs" "$(cat .claude/settings.json)"
expect "matcher có PowerShell (trong settings.local.json)" "Bash\|PowerShell" "$(cat .claude/settings.local.json)"
expect_not "settings.json của app không bị đụng" "mission-kit" "$(cat .claude/settings.json)"
node "$KITSRC/install.mjs" --project "$P" >/dev/null 2>&1
n=$(grep -c 'guard-bash.mjs' .claude/settings.local.json); [ "$n" = 1 ] && ok "cài lại không nhân đôi hook" || bad "hook bị nhân đôi ($n)"
grep -q "agent riêng của app" .claude/agents/security-reviewer.md && ok "không đụng agent riêng của app" || bad "agent riêng bị đè"
grep -q "ship riêng của app" .claude/skills/ship/SKILL.md && ok "app có ship riêng → giữ bản của app" || bad "ship riêng bị đè"
[ -f .claude/skills/ba-chuyen-gia/SKILL.md ] && ok "app chưa có ba-chuyen-gia → cài bản kit" || bad "thiếu ba-chuyen-gia"
expect "báo đã giữ bản riêng" "Giữ bản riêng" "$out"
expect "cài: .gitignore có .claude/mission-kit/" "mission-kit/" "$(cat .gitignore)"

K="$P/.claude/mission-kit"; export MISSION_KIT="$K"; M(){ node "$K/mission.mjs" "$@"; }
M init --name t >/dev/null
node -e '
const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));
c.protect.deny=["samples/**"]; c.units=[{name:"f",list:["a"]}]; c.deliverables=[];
c.checks.full=[{name:"good",cmd:"grep -q good src/app.js"},{name:"kit-var",cmd:"node \"$MISSION_KIT/mission.mjs\" help >/dev/null"}];
c.checks.onEdit=[{name:"file-arg",glob:"src/**",cmd:"test -f {file}"}];
c.stopGate.watch=["src/**"]; c.privacy.patterns=["SECRETCLIENT"];
require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json"
M scan >/dev/null

echo "## CLI: kiểm tra, cổng, vân tay (C1)"
expect "check --full XANH (thay \$MISSION_KIT)" "^XANH" "$(M check --full 2>&1)"
mkdir -p "src/my dir"; echo good > "src/my dir/a b.js"
expect "{file} có dấu cách chạy đúng" "✓ file-arg" "$(M check --file "src/my dir/a b.js" 2>&1)"
rm -rf "src/my dir"
M check --full >/dev/null
for g in G1 G2 G3 G4 G5 G6 G7; do M gate set f:a $g PASS --by main --evidence ok >/dev/null; done
mkdir -p .mission/reviews
printf 'KẾT LUẬN: PASS   (hoặc  KẾT LUẬN: FAIL (…))\n' > .mission/reviews/mau.md
expect "báo cáo chép nguyên mẫu → từ chối" "chưa đạt" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/mau.md 2>&1)"
expect "cổng độc lập không có --report → từ chối" "cần --report" "$(M gate set f:a G8 PASS --by agent:x --evidence ok 2>&1)"
expect "cổng độc lập --by main → từ chối" "cổng độc lập" "$(M gate set f:a G8 PASS --by main --evidence ok 2>&1)"
printf 'lỗi nhỏ: nhãn nút\nKẾT LUẬN: PASS KÈM SỬA (2 lỗi nhỏ)\n' > .mission/reviews/k.md
expect "PASS KÈM SỬA → nhận" "G8=PASS" "$(M gate set f:a G8 PASS --by agent:ba-chuyen-gia --evidence ok --report .mission/reviews/k.md 2>&1)"
printf 'KẾT LUẬN: PASS (THIẾU BẰNG CHỨNG: trang 3D)\n' > .mission/reviews/tb.md
expect "kết luận PASS mà còn THIẾU BẰNG CHỨNG → từ chối" "THIẾU BẰNG CHỨNG" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/tb.md 2>&1)"
printf 'KẾT LUẬN: PASS - evidence missing: ui\n' > .mission/reviews/em.md
expect "kết luận PASS mà còn EVIDENCE MISSING → từ chối" "THIẾU BẰNG CHỨNG" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/em.md 2>&1)"
printf 'THIẾU BẰNG CHỨNG: luật\nKẾT LUẬN: FAIL (THIẾU BẰNG CHỨNG)\n' > .mission/reviews/tf.md
expect "FAIL vì thiếu bằng chứng → từ chối" "chưa đạt" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/tf.md 2>&1)"
printf 'THIẾU BẰNG CHỨNG: trang phụ (đã báo)\nKẾT LUẬN: PASS\n' > .mission/reviews/tp.md
expect "THIẾU BẰNG CHỨNG chỉ ở thân, kết luận cuối PASS → nhận" "G8=PASS" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/tp.md 2>&1)"
printf 'minor: button label\n**VERDICT: PASS WITH FIXES** (2 minor)\n' > .mission/reviews/en.md
expect "bản tiếng Anh: VERDICT: PASS WITH FIXES → nhận" "G8=PASS" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/en.md 2>&1)"
printf 'round 1\nVERDICT: PASS\nround 2\nVERDICT: FAIL (1 HIGH)\n' > .mission/reviews/enf.md
expect "bản tiếng Anh: VERDICT cuối FAIL → từ chối" "chưa đạt" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/enf.md 2>&1)"
printf 'VERDICT: PASS (EVIDENCE MISSING: 3D page)\n' > .mission/reviews/enm.md
expect "bản tiếng Anh: VERDICT PASS mà EVIDENCE MISSING → từ chối" "THIẾU BẰNG CHỨNG" "$(M gate set f:a G8 PASS --by agent:x --evidence ok --report .mission/reviews/enm.md 2>&1)"
printf 'vòng 1\nKẾT LUẬN: FAIL (1 HIGH)\nvòng 2\nKẾT LUẬN: PASS\n' > .mission/reviews/r.md
expect "báo cáo có PASS ở dòng kết luận cuối → nhận" "G8=PASS" "$(M gate set f:a G8 PASS --by agent:mission-checker --evidence ok --report .mission/reviews/r.md 2>&1)"
M report >/dev/null; git add -A; git commit -qm "đạt"
expect "luồng bình thường: kiểm tra → cổng → commit → ĐẠT (không báo cũ oan)" "ĐẠT Definition" "$(M done 2>&1)"
echo bad > src/app.js; git commit -qam bad; M report >/dev/null; git add -A; git commit -qm rep
out=$(M done 2>&1)
expect "C1: sửa rồi commit, không chạy lại → CHƯA ĐẠT" "CHƯA ĐẠT" "$out"
expect "C1: báo kiểm tra cũ" "Kiểm tra chạy SAU" "$out"
expect "C1: cổng thành CŨ" "CŨ" "$(M gate show 2>&1)"
echo good > src/app.js; git commit -qam fix

echo "## Sổ lỗi (H4, quyền riêng tư)"
expect "--status later → từ chối" "--status phải" "$(M ledger add --severity HIGH --why a --fix b --status later 2>&1)"
expect "--why để trống → từ chối" "cần một giá trị|không được để trống" "$(M ledger add --severity HIGH --fix b --why 2>&1)"
expect "--category audit → từ chối" "--category phải" "$(M ledger add --severity LOW --why a --fix b --category audit 2>&1)"
expect "thiếu --fix → từ chối" "--fix" "$(M ledger add --severity LOW --why a 2>&1)"
id=$(M ledger add --severity HIGH --why "sai" --fix "sửa" 2>&1 | grep -o 'L-[0-9]*')
expect "bỏ qua lỗi HIGH không có human: → từ chối" "chủ dự án" "$(M ledger close $id --status wontfix --verify x 2>&1)"
expect "địa chỉ nhà trong ledger → từ chối" "địa chỉ" "$(M ledger add --severity LOW --why 'mẫu ở 7 Sample Avenue lỗi' --fix x 2>&1)"
expect "mẫu riêng tư của dự án → từ chối" "riêng tư" "$(M ledger add --severity LOW --why 'của SECRETCLIENT' --fix x 2>&1)"
expect "--why=--giá trị bắt đầu bằng -- dùng được" "L-" "$(M ledger add --severity LOW --why=--flag-lạ --fix x 2>&1)"
echo '{hỏng' >> .mission/ledger.jsonl
expect "ledger có dòng hỏng không làm văng CLI" "mục" "$(M ledger list 2>&1)"
expect "ledger có dòng hỏng → add từ chối (không mất dữ liệu)" "dòng hỏng" "$(M ledger add --severity LOW --why x --fix y 2>&1)"
expect "ledger có dòng hỏng → done không đạt" "dòng hỏng" "$(M done 2>&1)"
sed -i '$d' .mission/ledger.jsonl

H(){ printf '%s' "$2" | node "$K/hooks/$1.mjs" 2>&1; }
J(){ MSYS_NO_PATHCONV=1 node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:process.argv[2],tool_input:{command:process.argv[3]}}))' "$P" "${2:-Bash}" "$1"; }
echo "## guard-bash (H2, H5, M3, M6) — chế độ local-main"
for c in 'git push -fu origin x' 'git -C . push --force origin x' 'git push origin +work/x' 'git push origin :old' 'git -c a=b push -f'; do
  expect "chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
expect "local-main: commit trên main được phép" '^$' "$(H guard-bash "$(J 'git commit -m x')")"
expect "local-main: push thường → hỏi" '"ask"' "$(H guard-bash "$(J 'git push origin main')")"
expect "PowerShell Remove-Item -Recurse samples → chặn" '"deny"' "$(H guard-bash "$(J 'Remove-Item -Recurse -Force samples' PowerShell)")"
expect "PowerShell Set-Content vào samples → chặn" '"deny"' "$(H guard-bash "$(J 'Set-Content -Path samples/a.pdf -Value x' PowerShell)")"
expect "ghi đè gates.json bằng shell → chặn" '"deny"' "$(H guard-bash "$(J 'echo {} > .mission/gates.json')")"
expect "rm đường dẫn tuyệt đối vào samples → chặn" '"deny"' "$(H guard-bash "$(J "rm \"$P/samples/a.pdf\"")")"
expect_not "chỉ đọc samples (cat > /tmp) → không chặn" '"deny"' "$(H guard-bash "$(J 'cat samples/a.pdf > /tmp/out')")"
expect_not "cp samples → src (đọc nguồn) → không chặn" '"deny"' "$(H guard-bash "$(J 'cp samples/a.pdf src/')")"
expect_not "rm --recursive --force thư mục build trong dự án → không hỏi" '"ask"|"deny"' "$(H guard-bash "$(J 'rm --recursive --force build')")"
expect_not "rm -rf trong thư mục tạm → cho qua" '"ask"|"deny"' "$(H guard-bash "$(J 'rm -rf /tmp/khac')")"
expect "rm -rf ngoài dự án và ngoài thư mục tạm → hỏi" '"ask"' "$(H guard-bash "$(J 'rm -rf /opt/khac')")"
expect "wrangler deploy → hỏi" '"ask"' "$(H guard-bash "$(J 'npx wrangler pages deploy site')")"
echo "## LỖI 0: mọi dạng đường dẫn Windows cho cùng một kết quả"
DEC(){ local o; o=$(grep -oE '"permissionDecision":"[a-z]+"' <<<"$1" | grep -oE '"[a-z]+"$' | tr -d '"'); echo "${o:-allow}"; }
JCW(){ MSYS_NO_PATHCONV=1 node -e 'const a=process.argv;console.log(JSON.stringify({cwd:a[1],tool_name:a[2],tool_input:{file_path:a[3]}}))' "$1" "$2" "$3"; }
JC0(){ MSYS_NO_PATHCONV=1 node -e 'console.log(JSON.stringify({cwd:process.argv[1],source:"startup"}))' "$1"; }
if [ -n "$WIN_BASH" ]; then
  d0=$(tr 'A-Z' 'a-z' <<<"${P:0:1}"); PB="/$d0${P:2}"                # /c/Users/…  (Git Bash)
  PW="$P"; PBS=${P//\//\\}                                            # C:/…  và  C:\…
  PL='\\?\'"$PBS"                                                     # \\?\C:\…
  PU=$(tr 'a-z' 'A-Z' <<<"$P")                                        # viết hoa khác
  PT="/tmp/${P#*/Temp/}"                                              # /tmp/… của Git Bash (= %TEMP%)
  echo sửa-thử >> src/app.js   # để stop-gate có điều cần nhắc
  while IFS='|' read -r want tpl; do
    r0=$(DEC "$(H guard-bash "$(J "${tpl//@/}")")")
    r1=$(DEC "$(H guard-bash "$(J "${tpl//@/$PB/}")")")
    r2=$(DEC "$(H guard-bash "$(J "${tpl//@/$PW/}")")")
    [ "$r0" = "$want" ] && [ "$r1" = "$want" ] && [ "$r2" = "$want" ] && ok "3 dạng cùng kết quả ($want): $tpl" || bad "3 dạng khác nhau: $tpl — tương đối=$r0, /c/=$r1, C:/=$r2, cần $want"
  done <<'TPL'
deny|echo x > '@.mission/ledger.jsonl'
deny|echo '{}' >> '@.mission/ledger.jsonl'
deny|cp /tmp/x.jsonl '@.mission/ledger.jsonl'
deny|mv '@.mission/ledger.jsonl' /tmp/l.jsonl
deny|rm '@samples/a.pdf'
deny|rm -rf '@.mission'
deny|echo x | tee '@.claude/mission-kit/lib.mjs'
deny|sed -i s/a/b/ '@.mission/gates.json'
ask|cat '@.env'
TPL
  for form in "$PB/" "$PW/" "$PBS\\" "$PL\\" "$PU/" "$PT/"; do
    r=$(DEC "$(H guard-bash "$(J "echo x > '$form.mission/ledger.jsonl'")")"); [ "$r" = deny ] && ok "guard-bash ghi sổ qua dạng $form" || bad "guard-bash lọt dạng $form ($r)"
    r=$(DEC "$(H guard-paths "$(JCW "$P" Write "$form.mission/ledger.jsonl")")"); [ "$r" = deny ] && ok "guard-paths chặn dạng $form" || bad "guard-paths lọt dạng $form ($r)"
    r=$(DEC "$(H guard-read "$(JCW "$P" Read "$form.env")")"); [ "$r" = deny ] && ok "guard-read chặn .env dạng $form" || bad "guard-read lọt dạng $form ($r)"
    c="${form%?}"
    r=$(DEC "$(H guard-read "$(JCW "$c" Read ".env")")"); [ "$r" = deny ] && ok "guard-read: cwd dạng $form tìm thấy app" || bad "guard-read: cwd dạng $form không thấy app ($r)"
    rm -f .mission/state/stop-gate.json
    expect "stop-gate: cwd dạng $form tìm thấy app" "Mission Kit nhắc" "$(H stop-gate "$(JC0 "$c")")"
    expect "session-start: cwd dạng $form tìm thấy app" "# Mission Kit — " "$(H session-start "$(JC0 "$c")")"
    rm -f .mission/state/auto-handover.md; H pre-compact "$(JC0 "$c")" >/dev/null
    [ -f .mission/state/auto-handover.md ] && ok "pre-compact: cwd dạng $form tìm thấy app" || bad "pre-compact: cwd dạng $form không thấy app"
    rm -f .mission/state/auto-handover.md
  done
  rm -f .mission/state/stop-gate.json; git checkout -q src/app.js
fi
echo "## LỖI 5: biến trỏ thư mục tạm; lệnh nguy hiểm vẫn bị chặn"
PX="$P"; [ -n "$WIN_BASH" ] && PX="/$(tr 'A-Z' 'a-z' <<<"${P:0:1}")${P:2}"   # đường dẫn app kiểu shell (/c/… trên Git Bash)
PARENT=$(dirname "$P")
HB(){ H guard-bash "$(J "$1")"; }
# --- 8 lệnh phải cho qua ---
ALLOW=(
$'D=/tmp/r.x; mkdir -p $D; cat > $D/a.cjs <<\'EOF\'\nconsole.log(1)\nEOF\nnode $D/a.cjs'
'D=/tmp/r.x; sed -i "s#a#b#g" $D/a.cjs'
'rm -rf /tmp/r.x; git status'
'curl -s -D - -o /dev/null https://x.dev/ | grep -i location'
$'node -e "import(\'./ic.mjs\').then(({a})=>{for(const n of x){console.log(n)}})"'
$'S="/c/Users/u/AppData/Local/Temp/claude/x/scratchpad"; cat > "$S/cut.mjs" <<\'EOF\'\nconsole.log(1)\nEOF'
'T=/tmp/r3; TW=$(cygpath -m $T); ( node x.mjs --shots $TW/s > $T/a.log 2>&1 )'
'T=/tmp/r2; mkdir -p $T/work; cp -r src $T/work/'
'T=$(mktemp -d); node x.mjs > $T/b.html'
"export MISSION_KIT=\"$P/.claude/mission-kit\"; node -e \"console.log(1)\""
)
for c in "${ALLOW[@]}"; do expect_not "cho qua: ${c:0:70}" '"ask"|"deny"' "$(HB "$c")"; done
# --- 15 lệnh trong lời nhắn đầu + 5 lệnh bổ sung = 20 lệnh ---
DENY=(
'T=.mission; echo x > $T/ledger.jsonl'
"X=\"/tmp/../$PX/.mission\"; echo x > \"\$X/ledger.jsonl\""
"X=\"/tmp/../$PX/.mission\"; echo x > \$X/ledger.jsonl"
'T=/tmp/a; T=.mission; echo x > $T/ledger.jsonl'
$'D=.claude/mission-kit; cat > $D/hooks/guard-bash.mjs <<\'EOF\'\nx\nEOF'
"S=\"$P/.mission/claude/tmp\"; echo x > \"\$S/../../ledger.jsonl\""
"rm -rf \"/tmp/../$PX/.mission\""
"TMPDIR=\"$P/.mission\"; echo x > \$TMPDIR/gates.json"
'mv .mission/ledger.jsonl /tmp/l.jsonl'
'echo x | tee .claude/mission-kit/lib.mjs'
'git push --force origin main'
"echo '{}' >> .mission/ledger.jsonl"
'cp /tmp/x.jsonl .mission/ledger.jsonl'
'git commit -qm "fix 99 Fakename Street plan"'
)
for c in "${DENY[@]}"; do expect "chặn: ${c:0:70}" '"deny"' "$(HB "$c")"; done
for c in 'git push origin main' 'sh ship.sh deploy' 'npx wrangler pages deploy build' "rm -rf \"$PARENT\"" 'rm -rf /opt/khac-ngoai-app'; do
  expect "vẫn hỏi: ${c:0:70}" '"ask"' "$(HB "$c")"; done
for c in 'D=$(cygpath -m .mission); echo x > $D/ledger.jsonl' 'rm -rf ~' 'cat .env'; do
  expect "chặn hoặc hỏi: ${c:0:70}" '"ask"|"deny"' "$(HB "$c")"; done
# --- biến phải được theo dõi đúng như shell thật ---
expect "gán tiền tố giữ giá trị CŨ: \$T vẫn là .mission" '"deny"' "$(HB 'T=.mission; T=/tmp/a echo x > $T/ledger.jsonl')"
expect_not "gán tiền tố giữ giá trị CŨ: \$T vẫn là /tmp" '"ask"|"deny"' "$(HB 'T=/tmp/a; T=.mission echo x > $T/ledger.jsonl')"
expect "gán trong ( ) không ra ngoài" '"deny"' "$(HB 'T=.mission; (T=/tmp/a); echo x > $T/ledger.jsonl')"
expect "gán sau || không chắc chạy" '"ask"|"deny"' "$(HB 'T=.mission; true || T=/tmp/a; echo x > $T/ledger.jsonl')"
expect "gán trong if không chắc chạy" '"ask"|"deny"' "$(HB 'T=.mission; if true; then T=/tmp/a; fi; echo x > $T/ledger.jsonl')"
expect "eval đổi biến → không tin nữa" '"ask"|"deny"' "$(HB 'T=/tmp/a; eval "T=.mission"; echo x > $T/ledger.jsonl')"
expect "T+= → không tin nữa" '"ask"|"deny"' "$(HB 'T=/tmp/a; T+=/../../x; echo x > $T/y')"
expect "unset → không tin nữa" '"ask"|"deny"' "$(HB 'T=/tmp/a; unset T; echo x > $T/y')"
expect "export đổi biến về .mission → chặn" '"deny"' "$(HB 'T=/tmp/a; export T=.mission; echo x > $T/ledger.jsonl')"
expect "mảng T=(...) không phải đường dẫn" '"ask"|"deny"' "$(HB 'T=/tmp/a; T=(.mission x); echo x > $T/ledger.jsonl')"
expect "mktemp mẫu tương đối → không phải thư mục tạm" '"ask"|"deny"' "$(HB 'T=$(mktemp -d .mission/xXXX); echo x > $T/ledger.jsonl')"
expect "TMPDIR gán lại rồi mktemp → theo TMPDIR" '"ask"|"deny"' "$(HB 'TMPDIR=.mission; T=$(mktemp -d); echo x > $T/../ledger.jsonl')"
expect "biến có khoảng trắng không ngoặc → tách từ, không tin" '"deny"' "$(HB 'T=".mission/ledger.jsonl /tmp/x"; rm $T')"
expect "biến lạ vẫn hỏi" '"ask"' "$(HB 'rm -rf $KHONGBIET/x')"
expect "rm -rf cả /tmp → hỏi" '"ask"' "$(HB 'rm -rf /tmp')"
expect "rm -rf /tmp/* → hỏi" '"ask"' "$(HB 'rm -rf /tmp/*')"
expect "rm -rf mẫu thoát khỏi /tmp → hỏi" '"ask"' "$(HB 'rm -rf /tmp/*/../../khac')"
# --- bash.freeDirs ---
expect_not "freeDirs mặc định: rm -rf build/logs/x" '"ask"|"deny"' "$(HB 'rm -rf build/logs/x')"
[ -n "$WIN_BASH" ] && expect_not "freeDirs mặc định: %TEMP%/claude" '"ask"|"deny"' "$(HB 'rm -rf /c/Users/u/AppData/Local/Temp/claude/x')"
expect_not "freeDirs mặc định: thư mục tạm hệ thống" '"ask"|"deny"' "$(HB 'rm -rf "$TMPDIR/r5"')"
CFGF="$P/.mission/config.json"; cp "$CFGF" "$T/cfg.bak"
SETCFG(){ node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));eval(process.argv[2]);require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$CFGF" "$1"; }
SETCFG 'c.bash.freeDirs=[]'
expect "freeDirs rỗng: rm -rf /tmp/x phải hỏi" '"ask"' "$(HB 'rm -rf /tmp/r.x')"
SETCFG 'c.bash.freeDirs=[".mission/**"]'
expect "freeDirs không gỡ được chặn .mission" '"deny"' "$(HB 'echo x > .mission/ledger.jsonl')"
SETCFG 'c.bash.freeDirs=["generated/**"];c.protect.ask=["generated/**","other/**"]'
expect_not "freeDirs khai riêng: bỏ hỏi của protect.ask" '"ask"|"deny"' "$(HB 'echo x > generated/a.txt')"
expect "protect.ask ngoài freeDirs vẫn hỏi" '"ask"' "$(HB 'echo x > other/a.txt')"
cp "$T/cfg.bak" "$CFGF"
# --- lệnh chỉ đọc nhắc tới kit/config ---
expect_not "node -e đọc config → không hỏi" '"ask"|"deny"' "$(HB "node -e \"console.log(require('fs').readFileSync('.mission/config.json','utf8'))\"")"
expect_not "node -e đọc tệp kit → không hỏi" '"ask"|"deny"' "$(HB "node -e \"console.log(require('fs').readFileSync('.claude/mission-kit/lib.mjs','utf8').length)\"")"
expect "node -e đọc sổ → vẫn hỏi" '"ask"' "$(HB "node -e \"console.log(require('fs').readFileSync('.mission/ledger.jsonl','utf8').length)\"")"
expect "node -e GHI vào sổ → vẫn hỏi" '"ask"|"deny"' "$(HB "node -e \"require('fs').writeFileSync('.mission/ledger.jsonl','')\"")"
expect "chương trình lạ nhắc tới sổ → vẫn hỏi" '"ask"' "$(HB 'node tool.mjs .mission/ledger.jsonl')"
# --- mission status: dòng tổng kết hook ---
JS(){ MSYS_NO_PATHCONV=1 node -e 'const a=process.argv;console.log(JSON.stringify({cwd:a[1],session_id:a[2],tool_name:"Bash",tool_input:{command:a[3]}}))' "$P" "$1" "$2"; }
rm -f .mission/state/hooks.log.jsonl
H guard-bash "$(JS phien-cu 'git push origin main')" >/dev/null
H guard-bash "$(JS phien-moi 'git push origin main')" >/dev/null
H guard-bash "$(JS phien-moi 'git push origin main')" >/dev/null
H guard-bash "$(JS phien-moi 'echo x > .mission/ledger.jsonl')" >/dev/null
expect "status: đếm hỏi/chặn của phiên hiện tại, có kiểu" 'Hook phiên này: hỏi 2 lần \(kiểu: git push×2\), chặn 1 lần' "$(M status 2>&1)"
rm -f .mission/state/hooks.log.jsonl
expect "status: chưa có lần nào" 'Hook phiên này: hỏi 0 lần, chặn 0 lần' "$(M status 2>&1)"
echo "## LỖI 1: guard-read xét tên và vị trí THẬT (symlink, junction)"
SIMF="$T/sim-links.mjs"
cat > "$SIMF" <<'EOF'
// MÔ PHỎNG symlink tệp (máy Windows không có Developer Mode không tạo được symlink tệp thật): realpath trả về đích giả.
import fs from 'node:fs';
const key = p => String(p).replace(/\\/g, '/').toLowerCase();
const map = Object.fromEntries(Object.entries(JSON.parse(process.env.SIM_LINKS || '{}')).map(([k, v]) => [key(k), v]));
const orig = fs.realpathSync.native;
fs.realpathSync.native = function (p, o) { return map[key(p)] ?? orig.call(this, p, o); };
EOF
SIMRUN(){ SIM_LINKS="$1" node --import "file:///${SIMF#/}" "$K/hooks/$2.mjs" 2>&1 <<<"$3"; }
mkdir -p reference; echo bi-mat > reference/s.txt; echo "X=1" > .env; echo "X=" > .env.example; echo vo-hai > innocent.txt; echo vo-hai > ok-link.txt; echo vo-hai > alias.txt
if [ -z "$WIN_BASH" ]; then
  rm -f innocent.txt ok-link.txt alias.txt; ln -s .env innocent.txt; ln -s .env.example ok-link.txt; ln -s reference/s.txt alias.txt
  LB="(symlink thật)"; RD(){ H guard-read "$(JCW "$P" Read "$1")"; }
else
  LB="(MÔ PHỎNG symlink tệp)"
  SL=$(node -e 'const P=process.argv[1];console.log(JSON.stringify({[P+"/innocent.txt"]:P+"/.env",[P+"/ok-link.txt"]:P+"/.env.example",[P+"/alias.txt"]:P+"/reference/s.txt"}))' "$P")
  RD(){ SIMRUN "$SL" guard-read "$(JCW "$P" Read "$1")"; }
fi
expect "symlink tệp tới .env → chặn $LB" '"deny"' "$(RD innocent.txt)"
expect_not ".env.example vẫn đọc được" '"deny"|"ask"' "$(RD .env.example)"
expect_not "symlink tới .env.example vẫn đọc được $LB" '"deny"|"ask"' "$(RD ok-link.txt)"
expect_not "tệp thường vẫn đọc được" '"deny"|"ask"' "$(H guard-read "$(JCW "$P" Read src/app.js)")"
cp "$CFGF" "$T/cfg.bak"; SETCFG 'c.readGuard={extraSecrets:["reference/**"]}'
expect "symlink tệp vào extraSecrets → chặn $LB" '"deny"' "$(RD alias.txt)"
if [ -n "$WIN_BASH" ]; then
  JUNC(){ node -e 'require("fs").symlinkSync(process.argv[1],process.argv[2],"junction")' "$1" "$2"; }
  UNJ(){ node -e 'for (const p of process.argv.slice(1)) require("fs").rmdirSync(p)' "$@"; }
  mkdir -p "$HOME/.ssh"; echo k > "$HOME/.ssh/id_khong_ten"
  JUNC "$P/.mission" jm; JUNC "$P/.claude/mission-kit" jk; JUNC "$HOME/.ssh" js; JUNC "$P/reference" jr; JUNC "$P/.mission" "$T/jtmp"
  expect "junction vào .mission: Write → chặn" '"deny"' "$(H guard-paths "$(JCW "$P" Write jm/ledger.jsonl)")"
  expect "junction vào .mission: echo > → chặn" '"deny"' "$(HB 'echo x > jm/ledger.jsonl')"
  expect "junction vào .mission: rm → chặn" '"deny"' "$(HB 'rm jm/gates.json')"
  expect "junction vào kit: Write → chặn" '"deny"' "$(H guard-paths "$(JCW "$P" Write jk/lib.mjs)")"
  expect "junction vào kit: tee → chặn" '"deny"' "$(HB 'echo x | tee jk/lib.mjs')"
  expect "junction vào ~/.ssh: Read → chặn" '"deny"' "$(H guard-read "$(JCW "$P" Read js/id_khong_ten)")"
  expect "junction vào ~/.ssh: cat → chặn hoặc hỏi" '"deny"|"ask"' "$(HB 'cat js/id_khong_ten')"
  expect "junction vào extraSecrets: Read → chặn" '"deny"' "$(H guard-read "$(JCW "$P" Read jr/s.txt)")"
  expect "junction trong thư mục tạm trỏ vào .mission: ghi → chặn" '"deny"' "$(HB "T2=\"$T/jtmp\"; echo x > \"\$T2/ledger.jsonl\"")"
  expect "junction trong thư mục tạm trỏ vào .mission: rm -rf → không cho qua" '"deny"|"ask"' "$(HB "rm -rf \"$T/jtmp\"")"
  UNJ jm jk js jr "$T/jtmp"
fi
cp "$T/cfg.bak" "$CFGF"
rm -rf reference .env .env.example innocent.txt ok-link.txt alias.txt
echo "## LỖI 2: HANDOVER chỉ báo CŨ khi thật sự cũ"
HO="$T/ho"; mkdir -p "$HO/.mission"; ( cd "$HO"; git init -q -b main; git config user.email t@t; git config user.name t; echo '{"name":"ho"}' > .mission/config.json; echo a > a.txt; git add -A; git commit -qm dau )
HOGIT(){ ( cd "$HO"; "$@" ); }
echo "tình trạng việc" > "$HO/.mission/HANDOVER.md"; touch -d "5 seconds ago" "$HO/.mission/HANDOVER.md"; echo b > "$HO/b.txt"; HOGIT git add -A; HOGIT git commit -qm "ghi HANDOVER cùng việc khác"
expect_not "ghi HANDOVER rồi commit chung → không CŨ" 'CŨ hơn commit' "$(H session-start "$(JC0 "$HO")")"
echo c > "$HO/c.txt"; HOGIT git add -A; HOGIT git commit -qm "commit thêm tệp khác"
expect "sau đó commit thêm tệp khác → CŨ" 'CŨ hơn commit' "$(H session-start "$(JC0 "$HO")")"
echo "cập nhật mới" >> "$HO/.mission/HANDOVER.md"
expect_not "sửa lại HANDOVER chưa commit → không CŨ" 'CŨ hơn commit' "$(H session-start "$(JC0 "$HO")")"
HOGIT git add -A; HOGIT git commit -qm "HANDOVER mới"
expect_not "commit HANDOVER mới → không CŨ" 'CŨ hơn commit' "$(H session-start "$(JC0 "$HO")")"
echo "## LỖI 6: stop-gate không nhắc lặp"
SGC(){ printf '%s' "$(JC0 "$P")" | node "$K/hooks/stop-gate.mjs" 2>&1; }
rm -f .mission/state/stop-gate.json; echo sua-1 >> src/app.js
n=0; for i in 1 2 3; do grep -q "Mission Kit nhắc" <<<"$(SGC)" && n=$((n+1)); done
[ "$n" = 1 ] && ok "gọi stop-gate 3 lần không đổi gì → nhắc 1 lần" || bad "stop-gate nhắc $n lần (cần 1)"
echo x > src/moi.js
expect "danh sách tệp đổi → nhắc lại" "Mission Kit nhắc" "$(SGC)"
expect_not "không đổi nữa → im" "Mission Kit nhắc" "$(SGC)"
node -e 'const f=process.argv[1],s=JSON.parse(require("fs").readFileSync(f,"utf8"));s.t=Date.now()-31*60e3;require("fs").writeFileSync(f,JSON.stringify(s))' .mission/state/stop-gate.json
expect "quá 30 phút → nhắc lại" "Mission Kit nhắc" "$(SGC)"
cp "$CFGF" "$T/cfg.bak"; SETCFG 'c.stopGate.mode="block"'
expect "mode block vẫn chặn mỗi lần (lần 1)" '"decision":"block"' "$(SGC)"
expect "mode block vẫn chặn mỗi lần (lần 2)" '"decision":"block"' "$(SGC)"
cp "$T/cfg.bak" "$CFGF"; rm -f src/moi.js .mission/state/stop-gate.json; git checkout -q src/app.js
echo "## LỖI 4: che địa chỉ che luôn tên suburb"
cat > "$HO/.mission/plan.md" <<'EOF'
# Kế hoạch
## NOW
- sửa nhà 99 Fakename Street Fakeville
- nhà 12 Sample Road Fakeburg, NSW 2000
- nhà 7 Sample Avenue Fakedale NSW 2000
- nhà 8 Sample Road North Fakeham West Extra
- Street view OK
- nhà 5 Sample Road hôm nay xong
EOF
rm -f "$HO/.mission/state/auto-handover.md"; H pre-compact "$(JC0 "$HO")" >/dev/null
SNAP=$(cat "$HO/.mission/state/auto-handover.md" 2>/dev/null)
expect_not "ảnh chụp không còn tên suburb" 'Fakeville' "$SNAP"
expect "địa chỉ được che" 'sửa nhà «ẩn»' "$SNAP"
expect_not "dừng ở dấu phẩy, vẫn che suburb" 'Fakeburg' "$SNAP"
expect "dừng ở dấu phẩy: giữ phần sau" '«ẩn», NSW 2000' "$SNAP"
expect_not "dừng trước NSW, vẫn che suburb" 'Fakedale' "$SNAP"
expect "dừng trước NSW: giữ NSW" '«ẩn» NSW 2000' "$SNAP"
expect "che tối đa 2 từ viết hoa" '«ẩn» West Extra' "$SNAP"
expect "câu thường không bị che: Street view OK" 'Street view OK' "$SNAP"
expect "từ viết thường sau địa chỉ giữ nguyên" '«ẩn» hôm nay xong' "$SNAP"
echo "## LỖI 3: token Cloudflare kiểu cũ"
TK=$(printf 'a1B2c3D4e5%.0s' 1 2 3 4)   # 40 ký tự giả
C3="$T/c3"; mkdir -p "$C3/.mission"; ( cd "$C3"; git init -q -b main )
for cf in "$K/templates/config.template.json" "$K"/templates/examples/*.config.json; do
  n3=$(basename "$cf"); cp "$cf" "$C3/.mission/config.json"
  echo "CLOUDFLARE_API_TOKEN=\"$TK\"" > "$C3/a.env"
  expect "token Cloudflare 40 ký tự → block ($n3)" '"decision":"block"' "$(H post-edit-check "$(JCW "$C3" Write a.env)")"
  echo "const CF_DNS_KEY = '$TK'" > "$C3/b.js"
  expect "CF_..._KEY trong mã → block ($n3)" '"decision":"block"' "$(H post-edit-check "$(JCW "$C3" Write b.js)")"
  echo 'const x = 1' > "$C3/c.js"
  expect_not "mã thường không bị block ($n3)" '"decision":"block"' "$(H post-edit-check "$(JCW "$C3" Write c.js)")"
done
expect "README nhắc app đã cài phải tự thêm mẫu" 'đã cài trước đó.*tự thêm' "$(cat "$KITSRC/README.vi.md")"
# ---MỐC-CA-MỚI---
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.git.mode="branch-pr";require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json"

echo "## Vòng 2: các ca mới"
expect "cổng độc lập NA bởi builder → từ chối" "chủ dự án" "$(M gate set f:a G8 NA --by main --evidence x 2>&1)"
expect "attention + CRITICAL → từ chối" "attention" "$(M ledger add --severity CRITICAL --category attention --why a --fix b 2>&1)"
expect "--why chỉ có dấu cách → từ chối" "để trống" "$(M ledger add --severity LOW --why ' ' --fix ' ' 2>&1)"
expect "--verify nuốt cờ khác → từ chối" "thiếu giá trị" "$(M ledger close L-0001 --verify --status 2>&1)"
expect "--pattern chứa địa chỉ → từ chối" "địa chỉ" "$(M ledger add --severity LOW --why a --fix b --pattern '7 Sample Avenue' 2>&1)"
expect "địa chỉ viết thường → từ chối" "địa chỉ" "$(M ledger add --severity LOW --why 'mẫu 7 sample avenue' --fix b 2>&1)"
for c in '/usr/bin/git push -f origin x' '\git push -f origin x' 'bash -c "git push -f origin x"' 'echo $(git push -f origin x)' 'git send-pack --force origin x'; do
  expect "chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
for c in 'echo {} 1> .mission/gates.json' 'echo {} >| .mission/gates.json' 'echo {} &> .mission/gates.json' 'dd if=/dev/null of=.mission/gates.json' 'echo {} > .mission/state/last-check.json'; do
  expect "chặn ghi sổ: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
expect "Set-Content -Value x <đường dẫn sau> → chặn" '"deny"' "$(H guard-bash "$(J 'Set-Content -Value x .mission/gates.json' PowerShell)")"
expect "shell ghi config.json → hỏi" '"ask"' "$(H guard-bash "$(J "sed -i 's/a/b/' .mission/config.json")")"
expect "cwd=samples, rm a.pdf → chặn" '"deny"' "$(node -e 'console.log(JSON.stringify({cwd:process.argv[1]+"/samples",tool_input:{command:"rm a.pdf"}}))' "$P" | node "$K/hooks/guard-bash.mjs")"
expect "cwd=src, cp x ../samples/a.pdf → chặn" '"deny"' "$(node -e 'console.log(JSON.stringify({cwd:process.argv[1]+"/src",tool_input:{command:"cp x ../samples/a.pdf"}}))' "$P" | node "$K/hooks/guard-bash.mjs")"
expect "Write vào .mission/state → chặn" '"deny"' "$(H guard-paths "{\"cwd\":\"$P\",\"tool_input\":{\"file_path\":\"$P/.mission/state/last-check.json\"}}")"
echo 'good $HOME' > "src/a\$b.js"; git add -A; git commit -qm d
expect "tên tệp có \$ chạy đúng" "✓ file-arg" "$(M check --file 'src/a$b.js' 2>&1)"
git rm -q "src/a\$b.js"; git commit -qm rm
# watch mặc định = mọi tệp; tệp ở gốc
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.stopGate.watch=[];c.checks.full=[{name:"good",cmd:"grep -q good src/app.js"}];require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json"
M check --full >/dev/null
expect_not "watch rỗng: không bị CŨ do chính .mission tự ghi" "CŨ" "$(M status 2>&1)"
echo x > root.js; git add root.js; git commit -qm root
expect "watch rỗng: tệp ở gốc đổi + commit → kiểm tra CŨ" "CŨ" "$(M status 2>&1)"
M check --full >/dev/null
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.checks.full.push({name:"x",cmd:"true"});require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json"
expect "đổi checks.full trong config → kiểm tra CŨ" "checks.full" "$(M status 2>&1)"
# scan quyền riêng tư
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.units.push({name:"case",source:"samples/*.pdf",pair:"sameName"});require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json"
echo p > "samples/7 Sample Avenue Testville.pdf"
out=$(M scan 2>&1); expect "scan: tên tệp giống địa chỉ → mã ngắn" "mã ngắn" "$out"
expect_not "manifest không chứa địa chỉ trong mã đơn vị" '"id": "case:12' "$(cat .mission/manifest.json)"
expect "manifest.json không được commit" "manifest.json" "$(cat .mission/.gitignore)"
# thư mục không phải git
mkdir -p "$T/nogit/.mission"; cp .mission/config.json "$T/nogit/.mission/"; echo '' > "$T/nogit/.mission/ledger.jsonl"
expect "không phải repo git → done CHƯA ĐẠT" "repo git" "$(cd "$T/nogit" && node "$K/mission.mjs" done 2>&1)"

echo "## guard-bash — chế độ branch-pr"
expect_not "cp vào thư mục hiện tại → không chặn" '"deny"' "$(H guard-bash "$(J 'cp /tmp/x .')")"
expect "rm -r cả thư mục samples → chặn" '"deny"' "$(H guard-bash "$(J 'rm -rf samples')")"
for c in 'git -C . commit -m x' 'git -c user.name=a commit -m x' 'git push origin main' 'git push origin HEAD'; do
  expect "chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
expect_not "push nhánh feature/main-page → không chặn" '"deny"' "$(H guard-bash "$(J 'git push origin feature/main-page')")"
cp .mission/config.json /tmp/cfg.bak; echo '{ hỏng,' > .mission/config.json
echo "## config hỏng (M4)"
expect "guard-bash hỏi thay vì tắt bảo vệ" '"ask"' "$(H guard-bash "$(J 'echo hi')")"
expect "config hỏng: force-push vẫn bị cấm" '"deny"' "$(H guard-bash "$(J 'git push -f')")"
expect "guard-paths hỏi" '"ask"' "$(H guard-paths "{\"cwd\":\"$P\",\"tool_input\":{\"file_path\":\"$P/src/app.js\"}}")"
cp /tmp/cfg.bak .mission/config.json

echo "## lint (M1, M2)"
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.lint.rules=JSON.parse(require("fs").readFileSync(process.argv[2],"utf8")).lint.rules;require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json" "$K/templates/config.template.json"
for k in 'const k="sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAAAAAA"' 'const k="sk-proj-AAAAAAAAAAAAAAAAAAAAAAAA"' 'const t="cfut_AAAAAAAAAAAAAAAAAAAAAAAAAA"' 'const j="eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.AAAAAAAAAAAAAAAA"'; do
  echo "$k" > src/k.js; expect "bắt khóa: ${k:10:22}…" "bi-mat" "$(M check --file src/k.js 2>&1)"; done
echo '// dùng khóa service_role ở máy chủ' > src/k.js; expect_not "không báo nhầm dòng chú thích" "bi-mat" "$(M check --file src/k.js 2>&1)"
printf '```\nconst a="AKIAABCDEFGHIJKLMNOP"\n' > src/k.js; expect "dòng \`\`\` trong JS không tắt luật" "bi-mat" "$(M check --file src/k.js 2>&1)"
rm src/k.js

echo "## stop-gate"
echo changed > src/app.js
expect "mặc định chỉ nhắc (systemMessage), không chặn" 'systemMessage' "$(H stop-gate "{\"cwd\":\"$P\"}")"
node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.stopGate.mode="block";require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json"
expect "mode block → chặn" '"block"' "$(H stop-gate "{\"cwd\":\"$P\"}")"
expect "stop_hook_active → không chặn lặp" '^$' "$(H stop-gate "{\"cwd\":\"$P\",\"stop_hook_active\":true}")"
git checkout -q src/app.js

echo "## dự án không dùng kit"
mkdir -p "$T/other"; (cd "$T/other" && git init -q)
expect "hook im lặng ở dự án khác" '^$' "$(printf '{"cwd":"%s","tool_input":{"command":"git push -f"}}' "$T/other" | node "$K/hooks/guard-bash.mjs")"
mkdir -p "$T/parent/.mission"; echo '{}' > "$T/parent/.mission/config.json"; mkdir -p "$T/parent/child"; (cd "$T/parent/child" && git init -q)
expect "không bị .mission ở thư mục cha kéo vào" '^$' "$(printf '{"cwd":"%s","tool_input":{"command":"git push -f"}}' "$T/parent/child" | node "$K/hooks/guard-bash.mjs")"

echo "## rules-audit"
mkdir -p rules/tests; echo '[{"input":1,"expected":2}]' > rules/tests/case.json
echo '[{"id":"r1","level":"error","fix":"sửa thế này","source":{"doc":"X","clause":"1"},"tests":["rules/tests/case.json"]}]' > rules/r.json
expect "tệp ca kiểm thử trong rules/ không bị tính là luật" "1 luật · 0 lỗi" "$(node "$K/tools/rules-audit.mjs" rules 2>&1)"
rm -rf rules

echo "## Vòng 3: hook (C1, H1–H5, M1–M3)"
SETMODE(){ node -e 'const f=process.argv[1],c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.git.mode=process.argv[2];require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$P/.mission/config.json" "$1"; }
PJ(){ node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_input:{file_path:process.argv[2]}}))' "$P" "$1"; }
SETMODE local-main
expect "Edit hook của kit → chặn" '"deny"' "$(H guard-paths "$(PJ "$P/.claude/mission-kit/hooks/guard-bash.mjs")")"
expect "Edit mission.mjs của kit → chặn" '"deny"' "$(H guard-paths "$(PJ "$P/.claude/mission-kit/mission.mjs")")"
expect "Edit .claude/settings.json → hỏi" '"ask"' "$(H guard-paths "$(PJ "$P/.claude/settings.json")")"
expect "Edit settings.local.json → hỏi" '"ask"' "$(H guard-paths "$(PJ "$P/.claude/settings.local.json")")"
expect "Edit gates.json::\$DATA → chặn" '"deny"' "$(H guard-paths "$(PJ "$P/.mission/gates.json::\$DATA")")"
expect "Edit 'gates.json.' (dấu chấm cuối) → chặn" '"deny"' "$(H guard-paths "$(PJ "$P/.mission/gates.json.")")"
expect_not "Edit src/app.js → không chặn" '"deny"|"ask"' "$(H guard-paths "$(PJ "$P/src/app.js")")"
for c in 'echo x > .claude/mission-kit/hooks/guard-bash.mjs' 'echo x > .mission/ledger.json?' 'echo x >> .missio[n]/gates.json' 'echo x > $PWD/.mission/gates.json' \
  '/bin/rm .mission/ledger.jsonl' 'command rm .mission/gates.json' '(rm .mission/gates.json)' 'true & rm .mission/ledger.jsonl' \
  'find .mission -name gates.json -delete' 'curl -so .mission/gates.json file:///tmp/x' 'cp -t .mission evil.json' \
  'git -c alias.p=push p origin main' 'git config alias.ship push' 'mv .mission/state /tmp/x' 'ln -s .mission notes' \
  'f=.mission/gates.json; echo x > $f' 'bash -c "rm .mission/gates.json"' 'git push origin main; echo x > .mission/ledger.jsonl' 'rm -rf .claude'; do
  expect "chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
for c in 'sc .mission\gates.json "{}"' 'ac .mission\ledger.jsonl x' 'ni .mission\gates.json -Force -Value x' 'copy evil.json .mission\gates.json' 'Set-Content .mission\gates.js* x' 'cmd /c mklink /J notes .mission'; do
  expect "PowerShell chặn: $c" '"deny"' "$(H guard-bash "$(J "$c" PowerShell)")"; done
for c in 'ri C:\Temp\x -Recurse' 'Remove-Item /tmp/khac -r -Force' 'cmd /c rmdir /s /q /tmp/khac'; do
  expect "PowerShell xóa đệ quy ngoài dự án → hỏi: $c" '"ask"|"deny"' "$(H guard-bash "$(J "$c" PowerShell)")"; done
for c in 'ri dist -Recurse' 'Remove-Item -Recurse -Force dist' 'cmd /c rmdir /s /q dist'; do
  expect_not "PowerShell dọn thư mục build trong dự án → không hỏi: $c" '"ask"|"deny"' "$(H guard-bash "$(J "$c" PowerShell)")"; done
for c in 'npm run deploy' 'sh ship.sh deploy' 'cat .env' 'echo $GITHUB_TOKEN' 'git frobnicate'; do
  expect "hỏi: $c" '"ask"' "$(H guard-bash "$(J "$c")")"; done
for c in 'cat .mission/gates.json' 'git add .mission/gates.json && git commit -m "cập nhật cổng"' 'py -3 check.py samples/a.pdf' 'sh ship.sh' 'grep -r TODO src' 'find .mission -name "*.md"' "node \"\$MISSION_KIT/mission.mjs\" gate show" 'ls samples > /tmp/list.txt' 'git config --get alias.x'; do
  expect_not "không chặn/hỏi: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
expect_not "ls an toàn → im lặng" '"ask"' "$(H guard-bash "$(J 'ls -la src')")"
for c in 'node "$MISSION_KIT/tools/web-smoke.mjs" build/x.html --out .mission/shots' 'PYTHON="py -3" sh ship.sh' 'py -3 build.py && git add -A && git commit -m "v12"' 'rm -f build/tmp.txt'; do
  expect_not "lệnh thường không bị hỏi/chặn: $c" '"ask"|"deny"' "$(H guard-bash "$(J "$c")")"; done
SETMODE branch-pr
git switch -q -c work/r3
for c in 'git checkout main && git commit -am x' 'git branch -f main work/r3' 'git push --all origin' "git push origin ma''in" 'git update-ref refs/heads/main HEAD'; do
  expect "branch-pr chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
expect_not "branch-pr: commit trên nhánh làm việc → được" '"deny"' "$(H guard-bash "$(J 'git commit -am x')")"
git switch -q main
for c in 'git pull' 'git revert HEAD' 'git am x.patch'; do expect "branch-pr trên main chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
git branch -q -D work/r3

echo "## Vòng 4: hook đọc lệnh như shell thật"
SETMODE local-main
for c in 'echo HACK > .mis\sion/gates.json' 'cp src/a.js .mis\sion/gates.json' 'rm .mission/ledger.json\l' 'rm -f .claude/mission-k\it/hooks/guard-bash.mjs' 'cp src/a.js samp\les/a.pdf' 'g\it push -f origin main' "bash -c 'g\\it push -f origin main'" 'py -3 scripts/convert.py samples/a.pdf --out samples/a.png' 'curl -so .mission/gates.json file:///tmp/x' 'gh pr merge 3'; do
  expect "chặn: $c" '"deny"' "$(H guard-bash "$(J "$c")")"; done
for c in 'g`it push -f origin main' '& "g`it" push --force'; do
  expect "PowerShell chặn: $c" '"deny"' "$(H guard-bash "$(J "$c" PowerShell)")"; done
for c in 'tee .{m{i,}ssion,x}/gates.json' 'git apply x.patch'; do expect "hỏi: $c" '"ask"|"deny"' "$(H guard-bash "$(J "$c")")"; done
NL=$'\n'
for c in 'node "$MISSION_KIT/mission.mjs" ledger add --severity LOW --why "wrong file; see .claude/mission-kit docs" --fix x' \
  'node "$MISSION_KIT/mission.mjs" gate set f:a G1 PASS --by main --evidence "a | b in .mission/gates.json; git push not done; rm -rf ."' \
  'git commit -m "chore(mission): record gates in .mission/gates.json"' 'git commit -m "fix(ui): sửa nút (xem .mission/ledger.jsonl L-3)"' \
  "git commit -m \"\$(cat <<'EOF'${NL}feat: x${NL}- Recorded gates in .mission/gates.json; it's done${NL}EOF${NL})\"" \
  "git commit -m 'docs: mention \`.claude/mission-kit\` folder'" "cat > src/status.js <<'EOF'${NL}const p = '.mission/gates.json';${NL}rm -rf /${NL}EOF" \
  'git commit -m "docs: never run rm -rf . in scripts"' 'git stash push -m wip src/' 'git commit -m "chore: git push later"' \
  'rm -rf dist' 'rm -rf build/tmp' 'rm -rf node_modules/.cache' 'rm -r __pycache__' 'npm run release-notes' 'node build.mjs --release' 'env | grep NODE' \
  'npx wrangler pages deployment list' 'py -3 tools/report.py --input .mission/ledger.jsonl' 'cat .mission/gates.json | jq .' 'mkdir -p build && py -3 build.py'; do
  expect_not "không chặn nhầm: ${c:0:70}" '"deny"' "$(H guard-bash "$(J "$c")")"; done
for c in 'git stash push -m wip src/' 'git commit -m "chore: git push later"' 'rm -rf dist' 'npm run release-notes' 'node build.mjs --release' 'env | grep NODE' 'npx wrangler pages deployment list' 'git commit -m "docs: never run rm -rf . in scripts"'; do
  expect_not "không hỏi nhầm: $c" '"ask"' "$(H guard-bash "$(J "$c")")"; done
expect "đọc sổ bằng script lạ → chỉ hỏi" '"ask"' "$(H guard-bash "$(J 'node -p "require(\"./.mission/gates.json\")"')")"
expect "deployCmd và previewCmd có lý do riêng" "bản xem trước" "$(cd "$P" && QCFG2(){ :; }; node -e 'const f=".mission/config.json",c=JSON.parse(require("fs").readFileSync(f,"utf8"));c.ship={previewCmd:"sh ship.sh preview",deployCmd:"PYTHON=\"py -3\" sh ship.sh deploy"};require("fs").writeFileSync(f,JSON.stringify(c,null,2))'; H guard-bash "$(J 'sh ship.sh preview')")"
expect "deployCmd → TRANG THẬT" "TRANG THẬT" "$(H guard-bash "$(J 'PYTHON="py -3" sh ship.sh deploy')")"

echo "## Vòng 5: hook"
SETMODE local-main
NL=$'\n'
A="'"
for c in "git commit -m \"\$(cat <<'EOF'${NL}Don't break${NL}EOF${NL})\" && rm .mission/gates.json" \
  "git commit -m \"\$(cat <<'EOF'${NL}feat: add (beta${NL}EOF${NL})\" && rm .mission/gates.json" \
  "true # don't worry${NL}rm .mission/ledger.jsonl #'" 'echo .mission/ledger.jsonl | xargs rm -f' 'find .mission -name "*.json" | xargs rm' \
  "bash <<EOF${NL}rm .mission/gates.json${NL}EOF" "cat <<EOF | sh${NL}rm .mission/gates.json${NL}EOF" 'bash <<< "rm .mission/gates.json"' \
  "sh -s <<'X'${NL}git push --force${NL}X" "rm \$'\\x2emission/ledger.jsonl'" 'tee >(cat > .mission/gates.json)' "alias x='rm .mission/gates.json'; x"; do
  expect "chặn: ${c:0:60}" '"deny"' "$(H guard-bash "$(J "$c")")"; done
expect "commit có nháy đơn rồi git push → vẫn hỏi" '"ask"' "$(H guard-bash "$(J "git commit -m \"\$(cat <<'EOF'${NL}Don't break${NL}EOF${NL})\" && git push")")"
for c in "<# don't #> Remove-Item .mission\\gates.json" "Write-Host hi # don't${NL}Remove-Item .mission\\gates.json #'" 'Get-ChildItem .mission\state | Remove-Item -Recurse -Force' \
  'gci .mission -Filter gates.json | ri' 'Get-Item .mission\gates.json | Set-Content -Value "{}"' 'Remove-Item (Join-Path .mission ledger.jsonl)' 'Remove-Item -Path:.mission\ledger.jsonl' \
  'Set-Content -Path:.mission\gates.json -Value x' 'Copy-Item x -Destination:.mission\gates.json' '$a=@{Path=".mission\ledger.jsonl"}; Remove-Item @a' \
  "[IO.File]::WriteAllText('.mission\\ledger.jsonl','x')" '&git push -f'; do
  expect "PowerShell chặn: ${c:0:60}" '"deny"' "$(H guard-bash "$(J "$c" PowerShell)")"; done
expect "chương trình là biến → hỏi" '"ask"|"deny"' "$(H guard-bash "$(J 'g=git; $g push origin main')")"
for c in "git commit -m \"\$(cat <<'EOF'${NL}1) quote \" here; git push --force${NL}EOF${NL})\"" 'ls; # cleanup .mission/state later' 'npm run build # then deploy' \
  'npx playwright test && node scripts/release-notes.mjs' 'Get-Content samples\a.txt | Set-Content build\x.txt'; do
  expect_not "không chặn/hỏi nhầm: ${c:0:60}" '"deny"|"ask"' "$(H guard-bash "$(J "$c" "$( [[ $c == Get-* ]] && echo PowerShell || echo Bash)")")"; done

echo "## Vòng 3: CLI và cổng done"
Q="$T/q3"; mkdir -p "$Q/src" "$Q/samples/x" "$Q/samples/y"; cd "$Q"; git init -q -b main; git config user.email t@t; git config user.name t
QM(){ node "$K/mission.mjs" "$@"; }
QM init --name q >/dev/null
QCFG(){ node -e 'const f=".mission/config.json",c=JSON.parse(require("fs").readFileSync(f,"utf8"));eval(process.argv[1]);require("fs").writeFileSync(f,JSON.stringify(c,null,2))' "$1"; }
QCFG 'c.units=[{name:"f",list:["a"]}];c.gates=[{id:"G1",name:"soát"}];c.independentGates=[];c.deliverables=[];c.stopGate.watch=[];c.checks.full=[{name:"ok",cmd:"true"}];c.protect.deny=[]'
printf good > 'src/we"ird.js'; echo ok > src/app.js
BS=0; printf good > 'src/a\b.js' 2>/dev/null && [ -f 'src/a\b.js' ] && BS=1   # Windows không cho dấu \ trong tên tệp
FLOW(){ QM scan >/dev/null; QM check --full >/dev/null; QM gate set '*' G1 PASS --by main --evidence ok >/dev/null; QM report >/dev/null; git add -A; git commit -qm flow >/dev/null; }
FLOW
expect "luồng chuẩn → ĐẠT" "ĐẠT Definition" "$(QM done 2>&1)"
if [ "$BS" = 1 ]; then echo bad > 'src/a\b.js'; git commit -qam edit
expect "H1: tệp có \\ trong tên đổi → CHƯA ĐẠT" "CHƯA ĐẠT" "$(QM done 2>&1)"
else echo "  - H1 (dấu \\ trong tên): bỏ qua, hệ tệp không hỗ trợ"; fi
FLOW; echo bad2 > 'src/we"ird.js'; git commit -qam edit
expect "H1: tệp có \" trong tên đổi → CHƯA ĐẠT" "CHƯA ĐẠT" "$(QM done 2>&1)"
FLOW
QCFG 'c.units.push({name:"case",source:"samples/**/*.pdf"})'
echo p > samples/x/c.pdf; echo p > samples/y/c.pdf; git add -A; git commit -qm s
expect "H2: hai tệp nguồn trùng khóa → scan dừng" "cùng khóa" "$(QM scan 2>&1)"
rm samples/y/c.pdf; git add -A; git commit -qm s; FLOW
expect "sau khi bỏ trùng → ĐẠT" "ĐẠT Definition" "$(QM done 2>&1)"
echo p > samples/x/d.pdf; git add -A; git commit -qm s; QM check --full >/dev/null; QM report >/dev/null; git add -A; git commit -qm r >/dev/null
expect "H3: thêm tệp nguồn mà chưa scan → CHƯA ĐẠT" "phạm vi thực tế khác" "$(QM done 2>&1)"
git rm -q samples/x/d.pdf; git commit -qm s; FLOW
QM ledger add --severity LOW --category blocker --why "chờ chủ dự án" --fix "hỏi" >/dev/null; QM report >/dev/null; git add -A; git commit -qm b >/dev/null
expect "H4: blocker mức LOW mở → CHƯA ĐẠT" "vướng mắc" "$(QM done 2>&1)"
expect "H4: sweep mức CRITICAL → từ chối" "mức không chặn" "$(QM ledger add --severity CRITICAL --category sweep --pattern p --why x 2>&1)"
QM ledger add --severity LOW --why a --fix b --pattern pp >/dev/null; QM ledger add --severity LOW --why a --fix b --pattern pp >/dev/null
QM ledger add --severity LOW --category sweep --pattern pp --status open --why "định quét" >/dev/null
expect "H4: sweep còn open không tính là đã quét" "pp" "$(QM done 2>&1 | grep 'quét toàn dự án')"
QM ledger add --severity LOW --category sweep --pattern pp --why "rg pp → 0 chỗ" >/dev/null
expect_not "sweep xong (mặc định fixed) → mẫu đã quét" "✗ Mọi mẫu" "$(QM done 2>&1)"
QM report >/dev/null; QM check --full >/dev/null
expect "M7: báo cáo trước lần kiểm tra mới → báo cáo CŨ" "✗ Báo cáo" "$(QM done 2>&1)"
expect "LOW: tham số gõ sai → từ chối" "không có tham số" "$(QM check --fil x 2>&1)"
expect "LOW: --verified=false → từ chối" "không nhận giá trị" "$(QM unit set f:a --verified=false 2>&1)"
expect "LOW: check --file không có → báo lỗi gọn" "không thấy tệp" "$(QM check --file nope.js 2>&1)"
expect "LOW: check --file thư mục → báo lỗi gọn" "thư mục" "$(QM check --file src 2>&1)"
expect "LOW: check --file ngoài dự án → từ chối" "trong dự án" "$(QM check --file /etc/hostname 2>&1)"
QCFG 'c.units.push({name:"bad"})'
expect "LOW: nhóm thiếu source/list → báo lỗi gọn" "cần «source»" "$(QM scan 2>&1)"
QCFG 'c.units=c.units.filter(u=>u.name!=="bad");c.units.push({name:"g0",list:["z"],gates:[]})'; QM scan >/dev/null
expect "LOW: nhóm không có cổng → không PASS" "FAIL" "$(QM gate show g0:z 2>&1 | tail -1)"
QCFG 'c.units=c.units.filter(u=>u.name!=="g0");c.units.push({name:"p",list:["7 Sample Avenue"]})'
QM scan >/dev/null
expect_not "M6: list chứa địa chỉ → không lộ trong manifest" "Sample Avenue" "$(cat .mission/manifest.json)"
QCFG 'c.checks.full=[{name:"ls",cmd:"echo 7 Sample Avenue.pdf; false"}]'; QM check --full >/dev/null
expect_not "M6: đầu ra kiểm tra không lộ địa chỉ trong checks.md" "Sample Avenue" "$(cat .mission/checks.md)"
expect "M6: ledger close --by có địa chỉ → từ chối" "địa chỉ" "$(QM ledger close L-0001 --verify ok --by 'human:7 Sample Avenue' 2>&1)"
printf 'KẾT LUẬN: PASS\n' | iconv -f utf-8 -t utf-8 >/dev/null 2>&1
cd "$P"

echo "## Vòng 4: gỡ trả đúng từng byte"
R4="$T/r4 app"; mkdir -p "$R4/.claude/skills/ship" "$R4/.claude/skills/mission-old"; cd "$R4"; git init -q -b main; git config user.email t@t; git config user.name t
printf 'node_modules/\r\n*.log' > .gitignore
printf '{"hooks":{},"env":{},"permissions":{}}' > .claude/settings.json
echo "ship riêng" > .claude/skills/ship/SKILL.md
git add -A; git commit -qm init
node "$KITSRC/install.mjs" --project "$R4" >/dev/null 2>&1; node "$KITSRC/install.mjs" --project "$R4" >/dev/null 2>&1
# Đếm CRLF bằng node (grep của Git Bash bỏ ký tự CR trước khi so)
expect ".gitignore giữ CRLF khi thêm khối" "^[1-9]" "$(node -e 'process.stdout.write(String((require("fs").readFileSync(".gitignore","utf8").match(/\r\n/g)||[]).length))')"
expect "kit chép skill vào .gitignore" "skills/mission-run/" "$(cat .gitignore)"
expect_not "cài xong: git status không thấy tệp kit" "mission-kit|mission-run|settings.local" "$(git status --short)"
node -e 'const f=".claude/mission-kit/installed.json",m=JSON.parse(require("fs").readFileSync(f,"utf8"));m.files.push("skills/mission-old");require("fs").writeFileSync(f,JSON.stringify(m))'
node "$KITSRC/install.mjs" --project "$R4" >/dev/null 2>&1
[ ! -d .claude/skills/mission-old ] && ok "nâng cấp: xóa tệp mồ côi của bản cũ" || bad "còn tệp mồ côi"
node "$KITSRC/install.mjs" --uninstall --project "$R4" >/dev/null 2>&1
expect "gỡ: git status sạch (trả đúng từng byte)" '^$' "$(git status --short --untracked-files=all)"
cd "$P"

echo "## Vòng 4: CLI"
cd "$Q"; QCFG 'c.units=[{name:"f",list:["a"]}];c.checks.full=[{name:"ok",cmd:"true"}];c.ship={backupDir:"./build/backup",backupFiles:["src/app.js"]}'; QM ledger close L-0001 --verify "đã hỏi" >/dev/null; FLOW
expect "trước backup → ĐẠT" "ĐẠT Definition" "$(QM done 2>&1)"
QM backup >/dev/null 2>&1; QM backup >/dev/null 2>&1
expect "sau backup vẫn ĐẠT (không sửa .gitignore của app)" "ĐẠT Definition" "$(QM done 2>&1)"
expect "bản sao lưu không hiện trong git status" '^$' "$(git status --short)"
QCFG 'c.ship={backupDir:"."}'; expect "backupDir . → từ chối" "thư mục con" "$(QM backup 2>&1)"
QCFG 'c.ship={backupDir:"src"}'; expect "backupDir chứa tệp git → từ chối" "đang chứa tệp git" "$(QM backup 2>&1)"
QCFG 'c.ship={}'
expect "--report có tên giống địa chỉ → từ chối" "địa chỉ" "$(QM gate set f:a G1 PASS --by agent:x --evidence ok --report '.mission/reviews/7 Sample Avenue.md' 2>&1)"
expect "từ chối kèm số dòng" "dòng 2" "$(QM ledger add --severity LOW --why "$(printf 'dòng một\n7 Sample Avenue')" --fix x 2>&1)"
for t in 'rev 2 drawing set' 'upload 3 files to Google Drive' 'mission.mjs:212 ledger close' '3 issues still to close' 'test 01-login-flow-close.spec.js'; do
  expect "chữ thường không bị coi là địa chỉ: $t" "L-" "$(QM ledger add --severity LOW --why "$t" --fix x 2>&1)"; done
mkdir -p docs; echo a > "docs/7 Sample Avenue notes.txt"; git add -A; git commit -qm d; FLOW; echo b > "docs/7 Sample Avenue notes.txt"
expect_not "tên tệp giống địa chỉ không lộ trong status" "Sample Avenue" "$(QM status 2>&1)"
git checkout -q -- docs; git rm -rq docs; git commit -qm rmdocs; FLOW
printf 'x\r\n' > src/crlf.js; git add -A; git commit -qm crlf; FLOW
printf 'x\n' > src/crlf.js
expect "chỉ đổi CRLF→LF không làm kiểm tra CŨ" "✓ Kiểm tra chạy SAU" "$(QM done 2>&1)"
git checkout -q -- src/crlf.js
echo '{hỏng' >> .mission/ledger.jsonl
expect "ledger repair chuyển dòng hỏng" "Đã chuyển 1" "$(QM ledger repair 2>&1)"
expect "sau repair ghi được" "L-" "$(QM ledger add --severity LOW --why ok --fix ok 2>&1)"
expect "giữ nguyên văn dòng hỏng" "hỏng" "$(cat .mission/ledger.bad.jsonl)"
cd "$P"

echo "## Vòng 5: CLI và trình cài"
cd "$Q"; FLOW
ln -s src linkdir; mkdir -p tools/inner && (cd tools/inner && git init -q && echo x > a && git add a && git -c user.email=t@t -c user.name=t commit -qm i); git add -A 2>/dev/null; git commit -qm links >/dev/null 2>&1; FLOW
expect "symlink tới thư mục + repo lồng nhau → vẫn ĐẠT" "ĐẠT Definition" "$(QM done 2>&1)"
rm linkdir; git rm -rq --cached tools 2>/dev/null; rm -rf tools; git add -A; git commit -qm rmlinks >/dev/null 2>&1; FLOW
expect "ledger.bad.jsonl không phải commit" "ledger.bad.jsonl" "$(cat .mission/.gitignore)"
QCFG 'c.ship={backupDir:".git/bk"}'; expect "backupDir trong .git → từ chối" "thư mục con" "$(QM backup 2>&1)"; QCFG 'c.ship={}'
cp .mission/manifest.json /tmp/mf.bak; echo '{}' > .mission/manifest.json
expect_not "manifest {} → gate show không văng" "TypeError" "$(QM gate show 2>&1)"; cp /tmp/mf.bak .mission/manifest.json
mkdir -p "$T/7 sample avenue app"; cd "$T/7 sample avenue app" && git init -q && node "$K/mission.mjs" init >/dev/null; expect_not "init: tên thư mục giống địa chỉ → không vào config" "avenue" "$(cat .mission/config.json)"; cd "$P"
cd "$P"
R5="$T/r5 app"; mkdir -p "$R5"; cd "$R5"; git init -q -b main
printf '{"env":{"API_TOKEN":"abcd1234secret"}}' > .claude.tmp; mkdir -p .claude; mv .claude.tmp .claude/settings.local.json
node "$KITSRC/install.mjs" --project "$R5" >/dev/null 2>&1
expect_not "nguyên bản chứa token không bị lưu vào installed.json" "abcd1234secret" "$(cat .claude/mission-kit/installed.json)"
expect "hook nằm trong settings.local.json" "guard-bash" "$(cat .claude/settings.local.json)"
expect "installed.json ghi commit nguồn và mã băm sha256" '"commit".*' "$(node -e 'const j=require("./.claude/mission-kit/installed.json");console.log(JSON.stringify(j.source), Object.keys(j.hashes).length > 20)')"
expect "--verify: vừa cài → khớp" "khớp mã băm" "$(node "$KITSRC/install.mjs" --verify --project "$R5" 2>&1)"
cp .claude/mission-kit/lib.mjs /tmp/lib.bak; echo '// sửa' >> .claude/mission-kit/lib.mjs
expect "--verify: tệp kit bị sửa → báo" "đã bị sửa" "$(node "$KITSRC/install.mjs" --verify --project "$R5" 2>&1)"; cp /tmp/lib.bak .claude/mission-kit/lib.mjs
expect "token của người dùng còn nguyên" "abcd1234secret" "$(cat .claude/settings.local.json)"
DJ=$(node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:"Bash",tool_input:{command:"git push -f"}}))' "$R5")
node "$R5/.claude/mission-kit/mission.mjs" init >/dev/null 2>&1
expect "hook chạy khi \$MISSION_KIT trỏ đúng bản này" '"deny"' "$(printf '%s' "$DJ" | MISSION_KIT="$R5/.claude/mission-kit" node .claude/mission-kit/hooks/guard-bash.mjs)"
expect "bản trong app KHÔNG tự tắt dù \$MISSION_KIT trỏ nơi khác (worktree)" '"deny"' "$(printf '%s' "$DJ" | MISSION_KIT="$K" node .claude/mission-kit/hooks/guard-bash.mjs)"
GC="$T/gcfg"; mkdir -p "$GC"; cp -r "$R5/.claude/mission-kit" "$GC/mission-kit"
expect "bản toàn máy nhường khi app có hook kit" '^$' "$(printf '%s' "$DJ" | CLAUDE_CONFIG_DIR="$GC" CLAUDE_PROJECT_DIR="$R5" node "$GC/mission-kit/hooks/guard-bash.mjs")"
expect "bản toàn máy vẫn chạy khi app không có kit" '"deny"' "$(printf '%s' "$DJ" | CLAUDE_CONFIG_DIR="$GC" CLAUDE_PROJECT_DIR="$T" node "$GC/mission-kit/hooks/guard-bash.mjs")"
rm .claude/mission-kit/installed.json
expect "mất installed.json: gỡ vẫn được" "Đã gỡ" "$(node "$KITSRC/install.mjs" --uninstall --project "$R5" 2>&1)"
[ ! -d .claude/skills/mission-run ] && ok "gỡ được skill kit khi mất installed.json" || bad "còn skill kit"
expect "token của người dùng còn sau khi gỡ" "abcd1234secret" "$(cat .claude/settings.local.json)"
expect_not "không còn hook kit" "mission-kit" "$(cat .claude/settings.local.json)"
cd "$P"

echo "## Dọn mã (tidy)"
TD="$T/tidy app"; mkdir -p "$TD/src/js" "$TD/build"; cd "$TD"; git init -q -b main
node "$K/mission.mjs" init >/dev/null 2>&1
BODY='  const len = Math.hypot(w.x2 - w.x1, w.y2 - w.y1);
  const ang = Math.atan2(w.y2 - w.y1, w.x2 - w.x1);
  ctx.save(); ctx.translate(w.x1, w.y1); ctx.rotate(ang);
  ctx.fillStyle = w.color || "#cccccc";
  ctx.fillRect(0, -w.thick / 2, len, w.thick);
  ctx.strokeStyle = "#333333"; ctx.lineWidth = 1;
  ctx.strokeRect(0, -w.thick / 2, len, w.thick);
  ctx.restore();
  return len;'
printf 'function drawWall(ctx, w) {\n%s\n}\nvar scale = 1;\n' "$BODY" > src/js/01-a.js
printf '// chép lại\nfunction drawWall(ctx, w) {\n%s\n}\nfunction once() { return "{ ngoặc trong chuỗi"; }\n' "$BODY" > src/js/02-b.js
{ echo 'function big() {'; for i in $(seq 1 90); do echo "  let v$i = $i;"; done; echo '}'; } > src/js/03-c.js
printf 'function dup() {}\nfunction dup() { return 2; }\nfunction patched() {}\n  patched = function () { return 3; };\nlet n = 1;\nn = 2;\n' > src/js/04-d.js
printf 'export function ov(a: string): string;
export function ov(a: number): number;
export function ov(a: unknown): unknown { return a; }
export function twice(a: string): string;
export function twice(a: unknown): unknown { return a; }
export function twice(a: unknown): unknown { return 1; }
export function ml(
  a: string,
): string;
export function ml(a: unknown): unknown { return a; }
' > src/js/05-e.ts
cp src/js/01-a.js build/app.js; printf 'x=1;%.0s' $(seq 1 400) > src/js/99.min.js
git add -A >/dev/null 2>&1; git -c user.email=t@t -c user.name=t commit -qm init >/dev/null 2>&1
out=$(node "$K/mission.mjs" tidy --save truoc 2>&1)
expect "tidy: bắt hàm dài" "big. 92 dòng" "$out"
expect "tidy: bắt khối lặp giữa 2 tệp" "× 2 nơi: src/js/01-a.js:1-.* · src/js/02-b.js" "$out"
expect "tidy: tên trùng trong cùng tệp" "dup.: src/js/04-d.js:1" "$out"
expect "tidy: gán đè một hàm đã khai báo → xung đột" "patched.: src/js/04-d.js:3 \(function\) · src/js/04-d.js:4 \(gán đè\)" "$out"
expect_not "tidy: gán lại biến thường không phải xung đột" '^- .n.:' "$out"
expect_not "tidy: chưa có sharedScope → không coi trùng khác tệp là xung đột" "drawWall.: src" "$out"
expect_not "tidy: bỏ qua build/ và *.min.js" "build/app.js|99.min.js" "$out"
expect_not "tidy: ngoặc trong chuỗi không làm sai số dòng hàm" "once. " "$out"
expect_not "tidy: chữ ký overload TypeScript không phải xung đột" "ov.: src|ml.: src" "$out"
expect "tidy: overload TS kèm hai thân trùng tên vẫn là xung đột" "twice.: src/js/05-e.ts:5 \(function\) · src/js/05-e.ts:6" "$out"
[ -f .mission/tidy/truoc.json ] && [ -f .mission/tidy/truoc.md ] && ok "tidy --save ghi .json và .md" || bad "tidy --save không ghi tệp"
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.tidy={sharedScope:[["src/js/*.js"]]};fs.writeFileSync(f,JSON.stringify(c))'
out=$(node "$K/mission.mjs" tidy --compare truoc --strict 2>&1); rc=$?
expect "tidy: sharedScope → bắt hàm trùng tên giữa 2 tệp" "drawWall.: src/js/01-a.js:1 \(function\) · src/js/02-b.js:2" "$out"
expect "tidy --compare: báo chỉ số tăng" "Tăng lên: Tên trùng" "$out"
[ $rc = 1 ] && ok "tidy --strict: có xung đột → mã thoát 1" || bad "tidy --strict mã thoát $rc"
expect "tidy: nhãn lạ bị từ chối" "chỉ được dùng" "$(node "$K/mission.mjs" tidy --save '../x' 2>&1)"
expect "tidy: so với lần đo chưa có → báo rõ" "Chưa có lần đo" "$(node "$K/mission.mjs" tidy --compare khong-co 2>&1)"
expect "tidy: tham số sai tên bị từ chối" "không có tham số --sav" "$(node "$K/mission.mjs" tidy --sav x 2>&1)"
git status --porcelain src | grep -q . && bad "tidy đã sửa mã nguồn" || ok "tidy không sửa mã nguồn"
out=$(node "$K/mission.mjs" tidy --conflicts 2>&1); rc=$?
expect "tidy --conflicts: chỉ in tên trùng" "drawWall: src/js/01-a.js:1 · src/js/02-b.js:2" "$out"
expect_not "tidy --conflicts: không in phần hàm dài" "Hàm dài" "$out"
[ $rc = 1 ] && ok "tidy --conflicts: có xung đột → mã thoát 1" || bad "tidy --conflicts mã thoát $rc"
expect "tidy --conflicts không kèm --save" "dùng một mình" "$(node "$K/mission.mjs" tidy --conflicts --save x 2>&1)"
expect "mẫu config: checks.full có bước tidy --conflicts" "tidy --conflicts" "$(cat "$K/templates/config.template.json")"
expect "init: LT.md có mục Tính năng" "## Tính năng" "$(cat .mission/LT.md)"
out=$(H post-edit-check "$(JCW "$TD" Edit src/js/02-b.js)")
expect "sửa xong: cảnh báo tên trùng dính tới tệp vừa sửa" "Tên trùng «drawWall»" "$out"
expect "sửa xong: cảnh báo khối lặp dính tới tệp vừa sửa" "Khối lặp .* src/js/01-a.js" "$out"
expect_not "sửa xong: trùng lặp chỉ cảnh báo, không chặn" '"decision":"block"' "$out"
mkdir -p src/lib; printf 'function formatDate(d) { return d; }\n' > src/lib/a.js; git add src/lib/a.js
printf 'export function formatDate(d) { return String(d); }\nfunction init() {}\n' > src/lib/b.js; printf 'function init() {}\n' > src/lib/c.js
out=$(H post-edit-check "$(JCW "$TD" Write src/lib/b.js)")
expect "tệp mới: hàm cùng tên đã có ở tệp khác → cảnh báo" "«formatDate» \(src/lib/b.js:1\) đã có ở src/lib/a.js:1" "$out"
expect_not "tên chung chung (init) không bị cảnh báo" "«init»" "$out"
expect "tệp mới chưa có trong LT.md → nhắc ghi bản đồ" "Tệp mới src/lib/b.js chưa có trong bản đồ" "$out"
printf -- '- Định dạng — `src/lib/` — formatDate\n' >> .mission/LT.md
expect_not "tệp mới nằm trong thư mục đã ghi ở LT.md → không nhắc" "chưa có trong bản đồ" "$(H post-edit-check "$(JCW "$TD" Write src/lib/b.js)")"
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.tidy.onEdit=false;fs.writeFileSync(f,JSON.stringify(c))'
expect_not "tidy.onEdit=false → tắt cảnh báo trùng lặp" "formatDate|Khối lặp" "$(H post-edit-check "$(JCW "$TD" Write src/lib/b.js)")"
expect "đầu phiên: nhắc tra bản đồ trước khi viết mới" "Giữ mã gọn từ đầu" "$(H session-start "$(JCW "$TD" x x)")"
rm -rf src/lib; git rm -rqf --cached src/lib >/dev/null 2>&1
[ -f "$P/.claude/skills/mission-tidy/SKILL.md" ] && [ -f "$P/.claude/commands/mission-tidy.md" ] && ok "cài: có skill và lệnh mission-tidy" || bad "thiếu skill/lệnh mission-tidy"
[ -f "$P/.claude/commands/mission-brief.md" ] && ok "cài: có lệnh mission-brief" || bad "thiếu lệnh mission-brief"
cd "$P"

echo "## Bảo vệ dữ liệu (riêng tư, bí mật, dòng khóa, trao đổi)"
D="$T/data app"; mkdir -p "$D/src" "$D/samples" "$D/server" "$HOME/Desktop" "$HOME/.ssh" "$T/exchange"; cd "$D"; git init -q -b main; git config user.email t@t; git config user.name t
node "$K/mission.mjs" init >/dev/null 2>&1
echo ok > src/a.js; echo "SECRET=1" > .env; echo "SECRET=" > .env.example; echo x > "$HOME/Desktop/note.txt"; echo k > "$HOME/.ssh/id_rsa"
echo pdf > "samples/10001 Sample Grove Road.pdf"; printf 'samples/\n.env\n' > .gitignore
git add -A; git commit -qm init
node -e '
const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f,"utf8"));
c.privacy.sampleDirs=["samples"]; c.privacy.blockCommitExtensions=["pdf","zip"];
c.privacy.clientCode={identifiers:["\\bsalary_bands\\b"],serverMarker:"import .server-only."};
c.protect.lockedText=[{glob:"src/lock.js",text:"HASH=abc123",why:"vân tay luật"}];
c.checks.remind=[{glob:"src/slow/**",name:"Slow",message:"run_slow.ps1",skill:"slow-test"}];
c.readGuard={extraSecrets:["**/*Payroll*"]};
c.handoff={exchangeDir:process.argv[1],verdictGlob:"**/*CHATGPT_VERDICT*",verdictSourceLine:"^Nguồn: "};
fs.writeFileSync(f,JSON.stringify(c,null,2))' "$T/exchange"
HD(){ printf '%s' "$2" | node "$K/hooks/$1.mjs" 2>&1; }
RJ(){ node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:process.argv[2],tool_input:JSON.parse(process.argv[3])}))' "$D" "$1" "$2"; }
BJ(){ node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:"Bash",tool_input:{command:process.argv[2]}}))' "$D" "$1"; }
expect "Read .env → chặn" '"deny"' "$(HD guard-read "$(RJ Read '{"file_path":".env"}')")"
expect_not "Read .env.example → được" '"deny"|"ask"' "$(HD guard-read "$(RJ Read '{"file_path":".env.example"}')")"
expect "Read ~/.ssh/id_rsa → chặn" '"deny"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$HOME/.ssh/id_rsa\"}")")"
expect "Read ~/Desktop → hỏi" '"ask"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$HOME/Desktop/note.txt\"}")")"
expect "Read tệp Payroll (extraSecrets) → chặn" '"deny"' "$(HD guard-read "$(RJ Read '{"file_path":"docs/Payroll-2026.md"}')")"
expect_not "Read src/a.js → được" '"deny"|"ask"' "$(HD guard-read "$(RJ Read '{"file_path":"src/a.js"}')")"
expect "Grep cả thư mục nhà → hỏi" '"ask"' "$(HD guard-read "$(RJ Grep "{\"pattern\":\"x\",\"path\":\"$HOME\"}")")"
expect "Glob mẫu tuyệt đối trong Desktop → hỏi" '"ask"' "$(HD guard-read "$(RJ Glob "{\"pattern\":\"$HOME/Desktop/**\"}")")"
expect "bash: cat ~/Desktop/note.txt → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'cat ~/Desktop/note.txt')")"
expect "bash: Get-Content .env → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'grep SECRET .env')")"
expect "bash: find / → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'find / -name "*.dwg"')")"
expect_not "bash: ls src → được" '"ask"|"deny"' "$(HD guard-bash "$(BJ 'ls src')")"
echo 'const addr = "12 Sample Grove Road";' > src/b.js; git add src/b.js
expect "commit có địa chỉ → chặn" '"deny".*riêng tư' "$(HD guard-bash "$(BJ 'git commit -m x')")"
echo 'const a = "Sample Grove Road dữ liệu";' > src/b.js; git add src/b.js
expect "commit nhắc tên bộ mẫu (sampleDirs) → chặn" '"deny".*bộ mẫu' "$(HD guard-bash "$(BJ 'git commit -m x')")"
echo 'const a = 1;' > src/b.js; echo pdf > src/plan.pdf; git add -A
expect "commit có tệp .pdf → chặn" '"deny".*\.pdf' "$(HD guard-bash "$(BJ 'git add -A && git commit -m x')")"
rm src/plan.pdf; git add -A
expect_not "commit sạch → không chặn" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.privacy.blockPush=true;fs.writeFileSync(f,JSON.stringify(c,null,2))'
expect "blockPush → chặn push" '"deny"' "$(HD guard-bash "$(BJ 'git push origin main')")"
expect "blockPush → chặn remote add" '"deny"' "$(HD guard-bash "$(BJ 'git remote add origin https://x')")"
PJD(){ node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:process.argv[2],tool_input:JSON.parse(process.argv[3])}))' "$D" "$1" "$2"; }
printf 'const x = 1;\nconst HASH=abc123;\n' > src/lock.js
expect "Edit đụng dòng khóa → chặn" '"deny".*khóa' "$(HD guard-paths "$(PJD Edit '{"file_path":"src/lock.js","old_string":"const HASH=abc123;","new_string":"const HASH=zzz;"}')")"
expect_not "Edit phần khác của tệp có dòng khóa → được" '"deny"' "$(HD guard-paths "$(PJD Edit '{"file_path":"src/lock.js","old_string":"const x = 1;","new_string":"const x = 2;"}')")"
expect "Write thiếu dòng khóa → chặn" '"deny"' "$(HD guard-paths "$(PJD Write '{"file_path":"src/lock.js","content":"const x = 3;"}')")"
expect "Write tệp kết luận thiếu dòng nguồn → chặn" '"deny"' "$(HD guard-paths "$(PJD Write '{"file_path":"docs/R1_CHATGPT_VERDICT.md","content":"PASS"}')")"
expect_not "Write tệp kết luận có dòng nguồn → được" '"deny"' "$(HD guard-paths "$(PJD Write '{"file_path":"docs/R1_CHATGPT_VERDICT.md","content":"Nguồn: ChatGPT 2026-11-09\nPASS"}')")"
mkdir -p docs; echo "Nguồn: x" > docs/R1_CHATGPT_VERDICT.md
expect "ghi đè tệp kết luận → chặn" '"deny"' "$(HD guard-paths "$(PJD Write '{"file_path":"docs/R1_CHATGPT_VERDICT.md","content":"Nguồn: y"}')")"
expect "Edit tệp kết luận → chặn" '"deny"' "$(HD guard-paths "$(PJD Edit '{"file_path":"docs/R1_CHATGPT_VERDICT.md","old_string":"x","new_string":"y"}')")"
expect "Write sang thư mục trao đổi có địa chỉ → chặn" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$T/exchange/b.md\",\"content\":\"Khách ở 12 Sample Grove Road\"}")")"
expect_not "Write sang thư mục trao đổi sạch → được" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$T/exchange/b.md\",\"content\":\"Báo cáo vòng 1\"}")")"
expect "Write tệp .xlsx sang thư mục trao đổi → chặn" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$T/exchange/luong.xlsx\",\"content\":\"a\"}")")"
echo "12 Sample Grove Road" > src/addr.txt; echo "sạch" > src/clean.txt
expect "cp tệp có địa chỉ sang thư mục trao đổi → chặn" '"deny"' "$(HD guard-bash "$(BJ "cp src/addr.txt \"$T/exchange/\"")")"
expect_not "cp tệp sạch sang thư mục trao đổi → được" '"deny"|"ask"' "$(HD guard-bash "$(BJ "cp src/clean.txt \"$T/exchange/\"")")"
expect "cp cả thư mục sang thư mục trao đổi → hỏi" '"ask"' "$(HD guard-bash "$(BJ "cp -r src \"$T/exchange/\"")")"
expect "echo > thư mục trao đổi → hỏi" '"ask"' "$(HD guard-bash "$(BJ "echo hi > \"$T/exchange/x.md\"")")"
PE(){ node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:"Write",tool_input:{file_path:process.argv[2]}}))' "$D" "$1"; }
echo 'export const b = salary_bands;' > src/ui.js
expect "mã trình duyệt nhắc dữ liệu mật → chặn" '"block".*salary_bands' "$(HD post-edit-check "$(PE src/ui.js)")"
printf "import 'server-only';\nexport const b = salary_bands;\n" > src/ui.js
expect_not "mã phía máy chủ (server-only) → được" '"block"' "$(HD post-edit-check "$(PE src/ui.js)")"
echo 'export const b = salary_bands;' > server/db.js
expect_not "thư mục server/ → được" '"block"' "$(HD post-edit-check "$(PE server/db.js)")"
mkdir -p src/slow; echo x > src/slow/build.py
expect "sửa tệp test chậm → nhắc chạy test (không chạy)" 'run_slow.ps1.*slow-test' "$(HD post-edit-check "$(PE src/slow/build.py)")"
expect "denylist không phân biệt dấu" "danh sách chặn" "$(cd "$D" && echo 'Nguyễn Văn' > .claude-deny.txt && node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.privacy.denylistFiles=[".claude-deny.txt"];fs.writeFileSync(f,JSON.stringify(c,null,2))' && node "$K/mission.mjs" ledger add --severity LOW --why "lỗi của Nguyen Van" --fix x 2>&1)"
expect "cài: hook guard-read đã nối" "guard-read" "$(cat "$P/.claude/settings.local.json")"
[ -f "$K/data-core.mjs" ] && ok "cài: có data-core.mjs" || bad "thiếu data-core.mjs"
cd "$P"

echo "## Bảo vệ dữ liệu — vòng soát 3 chuyên gia"
cd "$D"; git add -A >/dev/null 2>&1; git commit -qm base >/dev/null 2>&1
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.privacy.blockPush=false;c.privacy.denylistFiles=[".claude-deny.txt"];fs.writeFileSync(f,JSON.stringify(c,null,2))'
printf 'Mai\nHòa\n' > .claude-deny.txt; git add .claude-deny.txt; git commit -qm deny >/dev/null 2>&1
echo 'const branch = "main"; // hóa đơn' > src/c.js; git add src/c.js
expect_not "danh sách chặn khớp nguyên từ: 'Mai' không bắt 'main', 'Hòa' không bắt 'hóa'" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
echo 'const who = "anh Mai";' > src/c.js; git add src/c.js
expect "danh sách chặn: nguyên từ 'Mai' → chặn, chỉ ra tệp:dòng" '"deny".*src/c.js:1' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git restore --staged src/c.js; rm src/c.js
expect "lời nhắn commit có địa chỉ → chặn" '"deny".*Lời nhắn' "$(HD guard-bash "$(BJ 'git commit --allow-empty -m "fix 12 Smith Street sample"')")"
echo pdf > docs-old.pdf; git add -f docs-old.pdf; git commit -qm addpdf >/dev/null 2>&1; git rm -q --cached docs-old.pdf
echo "Sample Grove Road ghi chú" > scratch.txt
expect_not "commit dọn dẹp (git rm --cached .pdf) + tệp nháp chưa theo dõi → không chặn" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m "remove client files"')")"
expect "git add -A && commit thì tệp nháp có tên bộ mẫu → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git add -A && git commit -m x')")"
git commit -qm rmpdf >/dev/null 2>&1; rm -f scratch.txt docs-old.pdf
echo 'const views = ["Module 3 Rear View", "1 Garage Door Drive"];' > src/v.js; git add src/v.js
expect_not "hậu tố đường yếu (View, Drive) không chặn commit (addressCheck strong)" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
echo pdf > "samples/10001_sample.pdf"; echo 'const s = "10001_sample";' > src/v.js; git add src/v.js
expect_not "tên mẫu một từ (10001_sample) được dùng" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git commit -qm v >/dev/null 2>&1
printf 'a\nconst LIMIT = 60;\nb\n' > src/lock.js
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.protect.lockedText=[{glob:"src/lock.js",text:"const LIMIT = 60;"},{glob:"tests/run.js",text:"HASH9ff",mode:"untouchable"}];fs.writeFileSync(f,JSON.stringify(c,null,2))'
expect "Edit chồng một phần dòng khóa → chặn" '"deny"' "$(HD guard-paths "$(PJD Edit '{"file_path":"src/lock.js","old_string":"60;\nb","new_string":"90;\nb"}')")"
expect "Edit replace_all một ký tự trong dòng khóa → chặn" '"deny"' "$(HD guard-paths "$(PJD Edit '{"file_path":"src/lock.js","old_string":"6","new_string":"9","replace_all":true}')")"
expect_not "Edit dòng khác → được" '"deny"' "$(HD guard-paths "$(PJD Edit '{"file_path":"src/lock.js","old_string":"a\n","new_string":"aa\n"}')")"
mkdir -p tests; printf "assert.equal(fp(),'HASH9ff');\n" > tests/run.js
expect "mode untouchable: biến dòng khóa thành chú thích → chặn" '"deny"' "$(HD guard-paths "$(PJD Edit "{\"file_path\":\"tests/run.js\",\"old_string\":\"assert.equal(fp(),'HASH9ff');\",\"new_string\":\"// assert.equal(fp(),'HASH9ff');\"}")")"
expect "sed -i trên tệp có chuỗi khóa → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'sed -i s/60/90/ src/lock.js')")"
expect "Grep glob .env* → chặn" '"deny"' "$(HD guard-read "$(RJ Grep '{"pattern":"KEY","glob":".env*"}')")"
expect "Read '.env.' (Windows bỏ dấu chấm cuối) → chặn" '"deny"' "$(HD guard-read "$(RJ Read '{"file_path":".env."}')")"
mkdir -p "$HOME/.claude"; echo x > "$HOME/.claude/.credentials.json"; echo x > "$HOME/.git-credentials"
expect "Read ~/.claude/.credentials.json → chặn" '"deny"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$HOME/.claude/.credentials.json\"}")")"
expect "Read ~/.git-credentials → chặn" '"deny"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$HOME/.git-credentials\"}")")"
expect_not "Read ~/.claude/settings.json → được" '"deny"|"ask"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$HOME/.claude/settings.json\"}")")"
expect_not "node --env-file=.env → không hỏi" '"ask"' "$(HD guard-bash "$(BJ 'node --env-file=.env server.js')")"
expect_not "grep chuỗi 'cfg.key' → không hỏi" '"ask"' "$(HD guard-bash "$(BJ 'grep -rn "cfg.key" src')")"
expect_not "cat .env.example → không hỏi" '"ask"' "$(HD guard-bash "$(BJ 'cat .env.example')")"
expect "cat < .env → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'wc -l < .env')")"
echo "12 Sample Grove Road" > leak.md
expect "cd thư mục trao đổi && cp tệp có địa chỉ . → chặn" '"deny"' "$(HD guard-bash "$(BJ "cd \"$T/exchange\" && cp \"$D/leak.md\" .")")"
expect "cd ~ && grep -r . → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'cd ~ && grep -r KEY .')")"
rm leak.md
echo "Nguồn: x" > "$T/exchange/R2_CHATGPT_VERDICT.md"
expect "ghi đè tệp kết luận bằng đường dẫn tuyệt đối khác cwd → chặn" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$T/exchange/R2_CHATGPT_VERDICT.md\",\"content\":\"Nguồn: y\"}")")"
# hộp gửi trong app (đường tương đối, gửi ChatGPT bằng trình duyệt của Claude thay cho Dropbox)
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.handoff.exchangeDir="docs/reviews/outbox";fs.writeFileSync(f,JSON.stringify(c,null,2))'
expect "Write địa chỉ vào hộp gửi tương đối → chặn" '"deny"' "$(HD guard-paths "$(PJD Write '{"file_path":"docs/reviews/outbox/P1-R1/GUI-CHATGPT.md","content":"Khách ở 12 Sample Grove Road"}')")"
expect_not "Write chữ sạch vào hộp gửi tương đối → được" '"deny"' "$(HD guard-paths "$(PJD Write '{"file_path":"docs/reviews/outbox/P1-R1/GUI-CHATGPT.md","content":"Soát cổng G1, G2. Mã khách C-01."}')")"
expect "Write hộp gửi bằng đường tuyệt đối → vẫn chặn địa chỉ" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$D/docs/reviews/outbox/x.md\",\"content\":\"12 Sample Grove Road\"}")")"
echo "12 Sample Grove Road" > leak.md
expect "cp tệp có địa chỉ vào hộp gửi tương đối → chặn" '"deny"' "$(HD guard-bash "$(BJ 'cp leak.md docs/reviews/outbox/leak.md')")"
rm leak.md
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.handoff.exchangeDir=process.argv[1];fs.writeFileSync(f,JSON.stringify(c,null,2))' "$T/exchange"
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.privacy.blockPush=true;c.handoff.blockAmounts=true;c.handoff.syntheticAmountsFile="syn.txt";c.readGuard={extraPrivateDirs:["/opt/riengtu"],denyDirs:[process.argv[1]]};fs.writeFileSync(f,JSON.stringify(c,null,2))' "$T/other app"
printf '5000\n1200\n' > syn.txt
expect_not "số giả \$5k, \$1,200.50 khớp danh sách số giả → được" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$T/exchange/c.md\",\"content\":\"Lương \$5k, thưởng \$1,200.50\"}")")"
expect "số tiền thật → chặn" '"deny"' "$(HD guard-paths "$(PJD Write "{\"file_path\":\"$T/exchange/c.md\",\"content\":\"Lương \$87,300\"}")")"
expect "blockPush: gh repo create --push → chặn" '"deny"' "$(HD guard-bash "$(BJ 'gh repo create x --source . --push')")"
expect "blockPush: git config remote.origin.url → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git config remote.origin.url https://x')")"
expect "denyDirs → chặn đọc app khác" '"deny"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$T/other app/x.js\"}")")"
expect "extraPrivateDirs giữ cả Desktop mặc định" '"ask"' "$(HD guard-read "$(RJ Read "{\"file_path\":\"$HOME/Desktop/note.txt\"}")")"
expect "wrangler d1 migrations apply --remote → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'npx wrangler d1 migrations apply app-core --remote')")"
expect_not "wrangler d1 migrations apply --local → không hỏi" '"ask"' "$(HD guard-bash "$(BJ 'npx wrangler d1 migrations apply app-core --local')")"
cd "$P"

echo "## Bảo vệ dữ liệu — vòng 2"
cd "$D"; node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.privacy.blockPush=false;fs.writeFileSync(f,JSON.stringify(c,null,2))'
git add -A >/dev/null 2>&1; git commit -qm r2base >/dev/null 2>&1
echo "ok" > "has space.md"; git add "has space.md"; git commit -qm sp >/dev/null 2>&1
echo "Khách ở 12 Quokka Avenue Testville" >> "has space.md"
expect "tên tệp có dấu cách: commit -am vẫn kiểm nội dung" '"deny".*has space.md:2' "$(HD guard-bash "$(BJ 'git commit -am x')")"
git add "has space.md"
expect "tên tệp có dấu cách: đã stage rồi commit → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git checkout -q -- "has space.md" 2>/dev/null; git restore --staged "has space.md"; git checkout -q -- "has space.md"
expect "commit -am\"…\" (dính liền) vẫn đọc được lời nhắn" '"deny".*Lời nhắn' "$(HD guard-bash "$(BJ 'git commit -am"fix 12 Smith Street"')")"
mkdir -p src/sub; echo "ok" > src/sub/n.md; git add src/sub/n.md; git commit -qm n >/dev/null 2>&1; echo "12 Quokka Avenue" >> src/sub/n.md
expect "cd thư mục con && commit pathspec → vẫn kiểm" '"deny"' "$(HD guard-bash "$(BJ 'cd src/sub && git commit -m x n.md')")"
expect "git -C src/sub commit pathspec → vẫn kiểm" '"deny"' "$(HD guard-bash "$(BJ 'git -C src/sub commit -m x n.md')")"
git checkout -q -- src/sub/n.md
E0="$T/empty repo"; mkdir -p "$E0"; cd "$E0"; git init -q; node "$K/mission.mjs" init >/dev/null 2>&1; echo "12 Quokka Avenue Testville" > note.md; git add note.md
expect "repo chưa có commit: commit -a → chặn" '"deny"' "$(printf '%s' "$(node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:"Bash",tool_input:{command:"git commit -a -m init"}}))' "$E0")" | node "$K/hooks/guard-bash.mjs")"
cd "$D"
expect ". .env → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'set -a; . .env; set +a')")"
printf 'a\r\nconst LIMIT = 60;\r\nb\r\n' > src/lock.js
expect "tệp CRLF: Edit xóa dòng khóa → chặn" '"deny"' "$(HD guard-paths "$(PJD Edit '{"file_path":"src/lock.js","old_string":"a\nconst LIMIT = 60;\n","new_string":"a\n"}')")"
expect "cd samples && rm tệp mẫu → chặn (luật cũ theo cd)" '"deny"' "$(HD guard-bash "$(BJ 'cd samples && rm 10001_sample.pdf')")"
expect "cd .. && rm -rf app → chặn" '"deny"' "$(HD guard-bash "$(BJ "cd .. && rm -rf \"data app\"")")"
expect_not "Grep glob *Credentials*.ts (mã nguồn) → không chặn" '"deny"' "$(HD guard-read "$(RJ Grep '{"pattern":"x","glob":"useCredentials.ts"}')")"
expect "wrangler d1 migrations apply --local --remote → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'npx wrangler d1 migrations apply db --local --remote')")"
{ for i in $(seq 1 20000); do echo "const v$i = $i;"; done; } > big.js; for i in $(seq 1 300); do echo "Ten$i Ho$i"; done > .claude-deny.txt; git add -A
t0=$(date +%s%N); out=$(HD guard-bash "$(BJ 'git commit -m big')"); t1=$(date +%s%N); ms=$(( (t1-t0)/1000000 ))
[ $ms -lt 5000 ] && ok "commit 20.000 dòng, 300 mục chặn: ${ms} ms" || bad "commit chậm: ${ms} ms"
git reset -q; rm big.js
cd "$P"

echo "## Bảo vệ dữ liệu — vòng 3"
cd "$D"; printf '' > .claude-deny.txt; git add -A >/dev/null 2>&1; git commit -qm r3base >/dev/null 2>&1
for c in '(cd src && ls); rm samples/10001_sample.pdf' 'echo $(cd src; pwd); rm samples/10001_sample.pdf' 'bash -c "cd src"; rm samples/10001_sample.pdf' 'pushd src; popd; rm samples/10001_sample.pdf' 'cd src; cd -; rm samples/10001_sample.pdf' 'cd khong-co; rm samples/10001_sample.pdf'; do
  expect "cd không làm lọt luật cũ: $c" '"deny"' "$(HD guard-bash "$(BJ "$c")")"; done
echo ok > src/sub/n.md; git add -A; git commit -qm n2 >/dev/null 2>&1; echo "12 Quokka Avenue" >> src/sub/n.md
expect "(cd src && ls); git commit pathspec → vẫn kiểm" '"deny"' "$(HD guard-bash "$(BJ '(cd src && ls); git commit -m x src/sub/n.md')")"
git checkout -q -- src/sub/n.md
printf 'giao tai 12 smith st\nroi goi dien\n' > low.md; git add low.md
expect "địa chỉ viết thường ở cuối dòng (không phải dòng cuối) → chặn" '"deny".*low.md:1' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git rm -q --cached low.md; rm low.md
printf 'Buoc 3\nMain Street la ten bien\n' > ok.md; git add ok.md
expect_not "các dòng rời không bị ghép thành địa chỉ" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git commit -qm ok >/dev/null 2>&1
printf 'ok\n' > 'q"uote.md'; printf 'ok\n' > 'back\slash.md'; git add -A; git commit -qm q >/dev/null 2>&1
echo "12 Quokka Avenue Testville" >> 'q"uote.md'; echo "12 Quokka Avenue Testville" >> 'back\slash.md'
expect "tên tệp có nháy kép: commit -am → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git commit -am x')")"
git add -A
expect "tên tệp có nháy/gạch chéo ngược: đã stage → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git reset -q --hard
expect "--pathspec-from-file=- → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'git commit -m x --pathspec-from-file=-')")"
cd "$P"

echo "## Bảo vệ dữ liệu — vòng 4"
cd "$D"; git add -A >/dev/null 2>&1; git commit -qm r4base >/dev/null 2>&1
HEREDOC_CMD="git commit --allow-empty -m \"\$(cat <<'EOF'
Fix 12 Quokka Avenue Testville
EOF
)\""
expect "lời nhắn commit qua heredoc \$(cat <<EOF) → chặn" '"deny"' "$(HD guard-bash "$(BJ "$HEREDOC_CMD")")"
expect "lời nhắn qua echo | git commit -F - → chặn" '"deny"' "$(HD guard-bash "$(BJ 'echo "Fix 12 Quokka Avenue Testville" | git commit --allow-empty -F -')")"
expect "--trailer có địa chỉ → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git commit --allow-empty -m x --trailer "Site: 12 Quokka Avenue"')")"
expect "git tag -m có địa chỉ → chặn" '"deny"' "$(HD guard-bash "$(BJ 'git tag -a v1 -m "12 Quokka Avenue Testville"')")"
echo "Khách ở 12 Quokka Avenue Testville" >> .mission/brief.md
expect ".mission/brief.md vẫn được quét khi commit" '"deny".*brief.md' "$(HD guard-bash "$(BJ 'git commit -am x')")"
git checkout -q -- .mission/brief.md 2>/dev/null
echo "<p>12 Quokka Avenue Testville</p>" > index.html; git add index.html
expect "index.html (deliverable mặc định) vẫn được quét" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
git rm -q --cached index.html; rm index.html
printf 'ok\n' > Notes.cs; git add Notes.cs; git commit -qm cs >/dev/null 2>&1; echo '// 12 Quokka Avenue Testville' >> Notes.cs
expect "tệp .cs (ngoài danh sách đuôi cũ) vẫn được quét" '"deny"' "$(HD guard-bash "$(BJ 'git commit -am x')")"
git checkout -q -- Notes.cs
printf 'a\nconst LIMIT = 60;\nb\n' > src/lock.js
CAT_CMD="cat > src/lock.js <<X
x
X"
for c in 'echo x > src/lock.js' "$CAT_CMD" 'cp /tmp/x.js src/lock.js' 'rm src/lock.js'; do
  expect "ghi tệp có dòng khóa bằng shell → hỏi: ${c%%$'\n'*}" '"ask"|"deny"' "$(HD guard-bash "$(BJ "$c")")"; done
mkdir -p docs; echo "Nguồn: x" > docs/R9_CHATGPT_VERDICT.md
expect "echo > tệp kết luận → chặn" '"deny"' "$(HD guard-bash "$(BJ 'echo "KẾT LUẬN: PASS" > docs/R9_CHATGPT_VERDICT.md')")"
expect "cd . > .mission/ledger.jsonl → chặn (hồi quy)" '"deny"' "$(HD guard-bash "$(BJ 'cd . > .mission/ledger.jsonl')")"
for t in "3 m from street" "15 m road frontage" "2 lighting circuit" "2 x street-facing windows" "2 m to secondary road"; do
  echo "// $t" > src/t.js; git add src/t.js; expect_not "từ vựng nghề không bị coi là địa chỉ: $t" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"; done
git commit -qm t >/dev/null 2>&1
PSJ(){ node -e 'console.log(JSON.stringify({cwd:process.argv[1],tool_name:"PowerShell",tool_input:{command:process.argv[2]}}))' "$D" "$1"; }
expect "PowerShell if (\$?) { git commit } vẫn kiểm lời nhắn → chặn" '"deny"' "$(HD guard-bash "$(PSJ 'git add -A; if ($?) { git commit --allow-empty -m "12 Quokka Avenue Testville" }')")"
expect_not "PowerShell if (Test-Path build) { … } không hỏi nhầm" '"ask"|"deny"' "$(HD guard-bash "$(PSJ 'if (Test-Path build) { Write-Output ok }; if ($LASTEXITCODE -ne 0) { exit 1 }')")"
expect "PowerShell if (\$true) { Remove-Item -Recurse .mission } → chặn" '"deny"' "$(HD guard-bash "$(PSJ 'if ($true) { Remove-Item -Recurse .mission }')")"
expect "cat .env* → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'cat .env*')")"
expect "git diff --no-index ~/.ssh/id_rsa → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'git diff --no-index /dev/null ~/.ssh/id_rsa')")"
expect "Read .dev.vars.staging → chặn" '"deny"' "$(HD guard-read "$(RJ Read '{"file_path":".dev.vars.staging"}')")"
for c in 'cp .env.example .env' 'touch .env' 'ls -la .env' 'test -f .env'; do expect_not "không hỏi nhầm: $c" '"ask"' "$(HD guard-bash "$(BJ "$c")")"; done
printf '{"scripts":{"migrate:remote":"wrangler d1 migrations apply db --remote","test":"node t.js"}}' > package.json
expect "npm run script chạy --remote → hỏi" '"ask"' "$(HD guard-bash "$(BJ 'npm run migrate:remote')")"
expect_not "npm run test → không hỏi" '"ask"' "$(HD guard-bash "$(BJ 'npm run test')")"
rm package.json
node -e 'const f=".mission/config.json",fs=require("fs"),c=JSON.parse(fs.readFileSync(f));c.readGuard.extraSecrets=["docs/{a,b"];fs.writeFileSync(f,JSON.stringify(c,null,2))'
RIN="$(RJ Read '{"file_path":"src/a.js"}')"
out=$(printf '%s' "$RIN" | timeout 10 node "$K/hooks/guard-read.mjs"; echo "rc=$?")
expect "glob có { không đóng không làm treo hook" 'rc=0' "$out"
cd "$P"

echo "## Bàn giao phiên (handover) — chống đọc lại cả repo"
expect "cài: có hook PreCompact" 'pre-compact.mjs' "$(cat .claude/settings.local.json)"
[ -f .claude/skills/mission-handover/SKILL.md ] && ok "cài: có skill mission-handover" || bad "thiếu skill mission-handover"
[ -f .claude/commands/mission-handover.md ] && ok "cài: có lệnh /mission-handover" || bad "thiếu lệnh /mission-handover"
HO=.mission/HANDOVER.md; HB="$HO.bak-test"; [ -f "$HO" ] && cp "$HO" "$HB"
rm -f "$HO" .mission/HTC.md .mission/state/auto-handover.md
cp "$K/templates/HANDOVER.template.md" "$HO"; cp "$K/templates/HTC.template.md" .mission/HTC.md
out=$(H session-start "{\"cwd\":\"$P\"}")
expect "HANDOVER còn là mẫu trống → một dòng" 'mẫu trống — chưa điền' "$out"
expect_not "mẫu trống không bị nạp nguyên văn" 'Đang làm dở|Quy ước giao diện' "$out"
rm -f "$HO" .mission/HTC.md
out=$(H session-start "{\"cwd\":\"$P\",\"source\":\"startup\"}")
expect "chưa có HANDOVER → hướng dẫn tạo" 'chưa có .mission/HANDOVER.md' "$out"
expect "luôn có luật chống đọc lại cả repo" 'KHÔNG đọc lại cả repo' "$out"
expect "luôn có sổ active" 'Sổ active' "$out"
{ echo "# HANDOVER"; echo "## NOW"; echo "- việc-NOW-1 SECRETCLIENT"; } > "$HO"
out=$(H session-start "{\"cwd\":\"$P\",\"source\":\"startup\"}")
expect "nạp HANDOVER" 'việc-NOW-1' "$out"
expect_not "HANDOVER bị che thông tin riêng" 'SECRETCLIENT' "$out"
expect_not "HANDOVER mới → không báo CŨ" 'CŨ hơn commit' "$out"
for i in $(seq 1 90); do echo "dòng $i"; done >> "$HO"
out=$(H session-start "{\"cwd\":\"$P\",\"source\":\"startup\"}")
expect "HANDOVER vượt 60 dòng → cắt và báo" 'cắt ở 60/' "$out"
expect_not "dòng sau trần không bị nạp" 'dòng 80' "$out"
for i in $(seq 1 200); do echo "quy-ước $i"; done > .mission/HTC.md
out=$(H session-start "{\"cwd\":\"$P\",\"source\":\"startup\"}")
expect "nạp HTC hiện hành, cắt ở 150" 'cắt ở 150/200' "$out"
mkdir -p .mission/archive; echo "HTC-CŨ-KHÔNG-NẠP" > .mission/archive/HTC-20200101.md
expect_not "không nạp HTC cũ trong archive" 'HTC-CŨ-KHÔNG-NẠP' "$(H session-start "{\"cwd\":\"$P\"}")"
echo "LT-KHÔNG-NẠP-SẴN" > .mission/LT.md
out=$(H session-start "{\"cwd\":\"$P\"}")
expect_not "LT/Inventory không nạp sẵn" 'LT-KHÔNG-NẠP-SẴN' "$out"
expect "LT chỉ được chỉ đường để grep" 'Tra cứu \(không nạp sẵn\): .mission/LT.md' "$out"
M ledger add --severity HIGH --unit f:a --why "lỗi-mở-HO" --fix "sửa" >/dev/null 2>&1
expect "sổ active có mục ledger đang mở" 'lỗi-mở-HO' "$(H session-start "{\"cwd\":\"$P\"}")"
touch -d '2001-01-01' "$HO"
expect "HANDOVER cũ hơn commit → báo CŨ" 'CŨ hơn commit' "$(H session-start "{\"cwd\":\"$P\"}")"
expect "pre-compact im lặng" '^$' "$(H pre-compact "{\"cwd\":\"$P\",\"trigger\":\"auto\"}")"
[ -f .mission/state/auto-handover.md ] && ok "pre-compact ghi ảnh chụp tự động" || bad "không có ảnh chụp tự động"
expect "ảnh chụp có ledger mở và commit gần nhất" 'lỗi-mở-HO' "$(cat .mission/state/auto-handover.md)"
expect "sau nén (compact) → nạp ảnh chụp tự động" 'Ảnh chụp tự động trước lần nén' "$(H session-start "{\"cwd\":\"$P\",\"source\":\"compact\"}")"
touch "$HO"
expect_not "HANDOVER mới hơn ảnh chụp → không nạp ảnh chụp" 'Ảnh chụp tự động trước lần nén' "$(H session-start "{\"cwd\":\"$P\",\"source\":\"compact\"}")"
expect "Claude được ghi HANDOVER.md (không bị chặn)" '^$' "$(H guard-paths "{\"cwd\":\"$P\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$P/.mission/HANDOVER.md\"}}")"
expect "Claude không được sửa ảnh chụp trong state/" '"deny"' "$(H guard-paths "{\"cwd\":\"$P\",\"tool_name\":\"Write\",\"tool_input\":{\"file_path\":\"$P/.mission/state/auto-handover.md\"}}")"
expect "pre-compact im lặng ở dự án khác" '^$' "$(printf '{"cwd":"%s"}' "$T/other" | node "$K/hooks/pre-compact.mjs")"
rm -rf .mission/archive .mission/LT.md .mission/HTC.md "$HO"; [ -f "$HB" ] && mv "$HB" "$HO"

echo "## LỖI 7: hook không đổ vỡ với [ ], lỗi nội bộ thì hỏi"
o=$(node "$KITSRC/tests/hook-safety.test.mjs" 2>&1) && ok "tests/hook-safety.test.mjs — $(tail -1 <<<"$o")" || bad "tests/hook-safety.test.mjs — $(grep -E '✗|KẾT QUẢ|Error' <<<"$o" | head -8)"

echo "## LỖI 11: chống xóa dữ liệu quan trọng, chặn junction"
o=$(node "$KITSRC/tests/data-loss.test.mjs" 2>&1) && ok "tests/data-loss.test.mjs — $(tail -1 <<<"$o")" || bad "tests/data-loss.test.mjs — $(grep -E '✗|KẾT QUẢ|Error' <<<"$o" | head -8)"

echo "## Model AI: Sonnet + Opus cố vấn (cài mới, cài đè, gỡ)"
o=$(node "$KITSRC/tests/model-config.test.mjs" 2>&1) && ok "tests/model-config.test.mjs — $(tail -1 <<<"$o")" || bad "tests/model-config.test.mjs — $(grep -E '✗|KẾT QUẢ|Error' <<<"$o" | head -8)"

echo "## mission-protect: làm rối bản build (chỉ dist/, không đụng nguồn)"
o=$(node "$KITSRC/tests/protect.test.mjs" 2>&1) && ok "tests/protect.test.mjs — $(tail -1 <<<"$o")" || bad "tests/protect.test.mjs — $(grep -E '✗|KẾT QUẢ|Error' <<<"$o" | head -8)"

echo "## Bản tiếng Anh (kit-en, install --lang en)"
o=$(node "$KITSRC/tests/lang-en.test.mjs" 2>&1) && ok "tests/lang-en.test.mjs — $(tail -1 <<<"$o")" || bad "tests/lang-en.test.mjs — $(grep -E '✗|Error' <<<"$o" | head -8)"

echo "## LỖI 8: che suburb sau dấu phẩy (địa chỉ giả)"
MASK8(){ node --input-type=module -e 'import { pathToFileURL as u } from "node:url"; const { maskPrivate } = await import(u(process.argv[1] + "/kit/lib.mjs").href); console.log(maskPrivate(".", { privacy: { patterns: [], denylistFiles: [] } }, process.argv[2]));' "$KITSRC" "$1" 2>&1; }
mask_is(){ local got; got=$(MASK8 "$1"); if [ "$got" = "$2" ]; then ok "«$1» → «$2»"; else bad "«$1» — muốn «$2», nhận «$got»"; fi; }
# có phẩy; có/không có bang, mã bưu điện
mask_is "99 Fakename Street, Testtown NSW 2000" "«ẩn» NSW 2000"
mask_is "99 Fakename Street, Testtown VIC 3000" "«ẩn» VIC 3000"
mask_is "99 Fakename Street, Testtown QLD 4000" "«ẩn» QLD 4000"
mask_is "99 Fakename Street, Testtown NSW" "«ẩn» NSW"
mask_is "99 Fakename Street, Testtown 2000" "«ẩn» 2000"
mask_is "99 Fakename Street, Testtown" "«ẩn»"
mask_is "99 Fakename Street, Testtown, NSW 2000" "«ẩn», NSW 2000"
mask_is "99 Fakename Street, Upper Testtown Heights NSW 2000" "«ẩn» NSW 2000"
mask_is "99 Fakename Drive, Testtown QLD 4000" "«ẩn» QLD 4000"
mask_is "sửa nhà 99 Fakename Street, Testtown NSW 2000 hôm nay" "sửa nhà «ẩn» NSW 2000 hôm nay"
# không có phẩy
mask_is "99 Fakename Street Testtown NSW 2000" "«ẩn» NSW 2000"
mask_is "99 Fakename Street Testtown 2000" "«ẩn» 2000"
mask_is "99 Fakename Street Testtown" "«ẩn»"
# viết thường
mask_is "99 fakename street, testtown nsw 2000" "«ẩn» nsw 2000"
mask_is "99 fakename street, testtown 2000" "«ẩn» 2000"
mask_is "99 fakename street, testtown" "«ẩn»"
mask_is "99 fakename street testtown nsw 2000" "«ẩn» nsw 2000"
mask_is "99 fakename street testtown 2000" "«ẩn» 2000"
mask_is "99 fakename street testtown" "«ẩn»"
mask_is "99 fakename st, testtown vic 3000" "«ẩn» vic 3000"
# căn hộ
mask_is "Unit 3/99 Fakename Street, Testtown NSW 2000" "«ẩn» NSW 2000"
mask_is "Unit 3/99 Fakename Street Testtown" "«ẩn»"
mask_is "unit 3/99 fakename street, testtown" "«ẩn»"
mask_is "3/99 Fakename Street, Testtown VIC 3000" "«ẩn» VIC 3000"
mask_is "Unit 3, 99 Fakename Street, Testtown" "«ẩn»"
# không che quá tay
mask_is "99 Fakename Street, NSW 2000" "«ẩn», NSW 2000"
mask_is "99 Fakename Street, we replaced the whole roof today" "«ẩn», we replaced the whole roof today"
mask_is "99 Fakename Street needs repair" "«ẩn» needs repair"
mask_is "99 fakename street needs a new roof today" "«ẩn» needs a new roof today"
mask_is "sheet 12 of the plan, Testtown" "sheet 12 of the plan, Testtown"

echo "## LỖI 9: chặn tên đường phổ biến, hậu tố viết thường (địa chỉ giả)"
cd "$D"; git reset -q --hard; git add -A >/dev/null 2>&1; git commit -qm l9base >/dev/null 2>&1
for a in "99 Main Street" "12 High St" "5 Long Road" "99 MAIN STREET" "7 Wide Avenue"; do
  expect "lời nhắn commit có «$a» → chặn" '"deny"' "$(HD guard-bash "$(BJ "git commit --allow-empty -m \"sua $a\"")")"
  echo "// $a" > src/l9.js; git add src/l9.js
  expect "tệp đưa vào commit có «$a» → chặn" '"deny".*l9.js' "$(HD guard-bash "$(BJ 'git commit -m x')")"
  git rm -q --cached src/l9.js; rm src/l9.js
done
for t in "2 main road frontage" "3 long street frontage" "5 high road clearance" "2 Main Circuit" "2 High Circuit breaker"; do
  echo "// $t" > src/l9.js; git add src/l9.js
  expect_not "chống chặn quá tay: «$t»" '"deny"' "$(HD guard-bash "$(BJ 'git commit -m x')")"
  git rm -q --cached src/l9.js; rm src/l9.js
done
cd "$P"
for s in st street rd road dr drive ave avenue pde cres pl ct; do
  mask_is "99 fakename $s" "«ẩn»"
  mask_is "99 fakename $s, testtown" "«ẩn»"
  mask_is "99 fakename $s testtown" "«ẩn»"
  mask_is "99 fakename $s testtown nsw 2000" "«ẩn» nsw 2000"
  mask_is "sửa nhà 99 fakename $s needs a new roof today" "sửa nhà «ẩn» needs a new roof today"
done
mask_is "unit 3/99 fakename drive testtown" "«ẩn»"
mask_is "99 fakename st. testtown" "«ẩn»"
for t in "upload 3 files to google drive" "a 15 minute drive" "copy 2 files to the hard drive" "2 hard drive" "4 wheel drive" "sheet 12 of the pl drawings" "1 st floor" "3 rd floor plan" "2 m to the st" "5 km drive"; do
  mask_is "$t" "$t"
done

echo "## gỡ cài đặt"
node "$KITSRC/install.mjs" --uninstall --project "$P" >/dev/null 2>&1
[ ! -d .claude/mission-kit ] && [ ! -d .claude/skills/mission-run ] && ok "gỡ sạch tệp của kit" || bad "còn sót tệp kit"
grep -q "agent riêng của app" .claude/agents/security-reviewer.md && ok "agent riêng của app còn nguyên sau khi gỡ" || bad "agent riêng bị xóa"
grep -q "ship riêng của app" .claude/skills/ship/SKILL.md && ok "ship riêng còn nguyên sau khi gỡ" || bad "ship riêng bị xóa"
[ ! -d .claude/skills/ba-chuyen-gia ] && ok "gỡ bản kit ba-chuyen-gia" || bad "còn ba-chuyen-gia của kit"
expect "hook riêng của app còn nguyên sau khi gỡ" "app-guard.mjs" "$(cat .claude/settings.json)"
expect_not "không còn hook của kit" "mission-kit" "$(cat .claude/settings.json)"
expect_not "gỡ: .gitignore không còn dòng của kit" "Mission Kit" "$(cat .gitignore 2>/dev/null)"
n=$(ls .claude/*.bak-* 2>/dev/null | wc -l); [ "$n" -le 2 ] && ok "không chất đống .bak ($n tệp)" || bad "còn $n tệp .bak"

echo; echo "KẾT QUẢ: $PASS đạt, $FAIL hỏng"
rm -rf "$T"
[ $FAIL = 0 ]
