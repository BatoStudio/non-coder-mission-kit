#!/bin/sh
# Mission Kit: đối chiếu máy này với GitHub và với site live. CHỈ ĐỌC: không push, không deploy, không sửa gì.
#   sh git-check.sh            3 dòng tóm tắt: Máy / GitHub / Site
#   sh git-check.sh --full     thêm chi tiết (commit nào chưa lên, các lần deploy trước)
#   sh git-check.sh --no-site  bỏ phần site (không cần wrangler, nhanh)
#   --pages <tên project> --account <id>   chỉ định Cloudflare Pages khi không tự tìm được
# Site: tự tìm wrangler.toml có pages_build_output_dir (thư mục app hoặc một cấp dưới); account id lấy từ
# wrangler.toml, biến CLOUDFLARE_ACCOUNT_ID, hoặc dòng CLOUDFLARE_ACCOUNT_ID=... trong ship.sh / tools/*.sh.
# Commit đang chạy trên site lấy từ "wrangler pages deployment list" (cột Source). Cần wrangler sign-in.

FULL=0; SITE=1; PAGES=""; ACCOUNT="${CLOUDFLARE_ACCOUNT_ID:-}"
while [ $# -gt 0 ]; do case "$1" in
  --full) FULL=1;; --no-site) SITE=0;; --pages) PAGES="$2"; shift;; --account) ACCOUNT="$2"; shift;;
  *) echo "dùng: sh git-check.sh [--full] [--no-site] [--pages <tên>] [--account <id>]"; exit 2;; esac; shift; done
cd "$(git rev-parse --show-toplevel 2>/dev/null)" || { echo "Không phải thư mục git."; exit 2; }
GH="gh"; command -v gh >/dev/null 2>&1 || GH="/c/Program Files/GitHub CLI/gh.exe"
WARN=0; ISSUES=""
d()    { [ "$FULL" = 1 ] && printf '        %s\n' "$*"; return 0; }   # detail line, --full only
issue(){ ISSUES="${ISSUES:+$ISSUES; }$*"; WARN=$((WARN+1)); }
line() { if [ -n "$ISSUES" ]; then printf '%s: CHÚ Ý, %s\n' "$1" "$ISSUES"; else printf '%s: OK, %s\n' "$1" "$2"; fi; ISSUES=""; }

# ---- 1. Máy này
n=$(git status --porcelain | wc -l | tr -d ' ')
[ "$n" != 0 ] && issue "$n tệp sửa CHƯA commit"
cur=$(git symbolic-ref --short -q HEAD || echo '(không ở nhánh)')
line "Máy" "không có gì chưa commit (nhánh $cur)"

# ---- 2. GitHub
good=0
if ! git remote get-url origin >/dev/null 2>&1; then issue "chưa nối GitHub (không có remote origin)"
else
  git fetch --prune --quiet origin 2>/dev/null || issue "không lấy được tin từ GitHub (mất mạng?), số liệu có thể cũ"
  repo=$(git remote get-url origin | sed -E 's#.*github\.com[:/]##; s#\.git$##')
  vis=$("$GH" repo view "$repo" --json visibility -q .visibility 2>/dev/null)
  case "$vis" in PRIVATE) ;; "") issue "không hỏi được repo có private không (gh chưa đăng nhập?)";; *) issue "repo đang $vis, KHÔNG private!";; esac
  for b in $(git for-each-ref refs/heads --format='%(refname:short)'); do
    if ! git rev-parse -q --verify "refs/remotes/origin/$b" >/dev/null; then
      issue "$b chưa có trên GitHub"; continue; fi
    a=$(git rev-list --count "origin/$b..$b"); z=$(git rev-list --count "$b..origin/$b")
    if [ "$a" = 0 ] && [ "$z" = 0 ]; then good=$((good+1)); continue; fi
    if [ "$a" != 0 ]; then
      only=$(git rev-list --count "$b" --not --remotes=origin)
      if [ "$only" = 0 ]; then issue "$b trên GitHub chậm $a commit (mã đã lên qua nhánh khác)"
      else issue "$b có $only commit CHƯA lên GitHub"; [ "$FULL" = 1 ] && git log --format='        %h %s' "$b" --not --remotes=origin | head -5; fi
    fi
    [ "$z" != 0 ] && issue "$b: GitHub mới hơn máy $z commit (làm ở máy khác?)"
  done
fi
hp=$(git config --get core.hooksPath); auto="tự push tắt"
if [ -f tools/git-hooks/post-commit ]; then
  if [ "$hp" = tools/git-hooks ]; then auto="tự push bật"; else issue "app có hook tự push nhưng máy này chưa bật (git config core.hooksPath tools/git-hooks)"; fi
fi
if [ -f build/git-push.log ]; then
  last=$(grep -E '^(OK|FAILED|== .* SKIPPED)' build/git-push.log | tail -n 1)
  case "$last" in FAILED*) issue "lần tự push cuối LỖI (xem build/git-push.log)";; *"possible secret"*) issue "tự push bị chặn: có thể có bí mật trong commit chưa lên GitHub (xem build/git-push.log)";; *SKIPPED*) issue "tự push đang bị chặn (privacy.blockPush)";; esac
fi
line "GitHub" "$good nhánh khớp, ${vis:-?}, $auto"

# ---- 3. Site live (Cloudflare Pages)
if [ "$SITE" = 1 ]; then
  dir=""
  for f in wrangler.toml */wrangler.toml; do
    [ -f "$f" ] && grep -q '^pages_build_output_dir' "$f" || continue
    dir=$(dirname "$f"); [ -z "$PAGES" ] && PAGES=$(sed -nE 's/^name *= *"([^"]+)".*/\1/p' "$f" | head -n 1)
    [ -z "$ACCOUNT" ] && ACCOUNT=$(sed -nE 's/^account_id *= *"([0-9a-f]{32})".*/\1/p' "$f" | head -n 1); break
  done
  [ -z "$ACCOUNT" ] && ACCOUNT=$(cat ship.sh tools/*.sh 2>/dev/null | grep -oE 'CLOUDFLARE_ACCOUNT_ID=[0-9a-f]{32}' | head -n 1 | cut -d= -f2)
  if [ -z "$PAGES" ]; then printf '%s: (app không có site Cloudflare Pages, bỏ qua)\n' "Site"
  else
    list=$(cd "${dir:-.}" && CLOUDFLARE_ACCOUNT_ID=$ACCOUNT npx --yes wrangler@3 pages deployment list --project-name "$PAGES" --environment production 2>/dev/null)
    rows=$(printf '%s\n' "$list" | grep '│ Production' | awk -F'│' '{gsub(/ /,"",$4); gsub(/^ +| +$/,"",$6); print $4 "|" $6}')
    live=$(printf '%s\n' "$rows" | head -n 1 | cut -d'|' -f1); age=$(printf '%s\n' "$rows" | head -n 1 | cut -d'|' -f2)
    msg=""
    if [ -z "$live" ]; then issue "không đọc được danh sách deploy của $PAGES (chạy: npx wrangler@3 login)"
    elif ! git cat-file -e "$live^{commit}" 2>/dev/null; then issue "site chạy commit $live ($age) mà máy này không có"
    else
      git branch -r --contains "$live" 2>/dev/null | grep -q . || issue "commit $live đang chạy trên site CHƯA có trên GitHub"
      msg="chạy $live ($age)"
      if git merge-base --is-ancestor "$live" HEAD; then c=$(git rev-list --count "$live..HEAD")
        [ "$c" = 0 ] && msg="$msg, đúng bản nhánh $cur" || msg="$msg, nhánh $cur có $c commit chưa deploy"
      else msg="$msg, nhánh $cur rẽ khác bản trên site"; fi
      d "$(git log -1 --format='%h %s' "$live" | cut -c1-90)"
      printf '%s\n' "$rows" | sed -n '2,4p' | while IFS='|' read -r h t; do d "lần trước: $h ($t)"; done
    fi
    line "Site" "$msg"
  fi
fi
exit 0
