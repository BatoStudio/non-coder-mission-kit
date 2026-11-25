#!/usr/bin/env node
// Quét CHỈ ĐỌC một skill/plugin tải về (thư mục cách ly). Không chạy, không nạp, không import bất cứ tệp nào trong đó.
// Dùng: node scan.mjs <thư-mục-skill> [--json]
// In: kiểm kê tệp, các dấu hiệu theo 3 góc (chuỗi cung ứng · Cloudflare/triển khai · AI agent), và mức XANH / VÀNG / ĐỎ.
// Mức chỉ là gợi ý để đọc kỹ chỗ nào trước; quét theo mẫu KHÔNG chứng minh được skill an toàn.
import { readdirSync, lstatSync, readFileSync, openSync, readSync, closeSync } from 'node:fs';
import { join, relative, extname, basename, resolve } from 'node:path';

const args = process.argv.slice(2);
const root = args.find(a => !a.startsWith('--'));
const asJson = args.includes('--json');
if (!root) { console.error('Dùng: node scan.mjs <thư-mục-skill> [--json]'); process.exit(2); }
const ROOT = resolve(root);

const TEXT_EXT = new Set(['.md', '.mdc', '.txt', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.bat', '.cmd', '.rb', '.pl', '.html', '.htm', '.css', '.svg', '.xml', '.xsd', '.ini', '.cfg', '.env', '.php', '.vbs', '.vba', '.ipynb', '.lua', '.r', '.swift', '.kt', '.java', '.cs', '.go', '.rs', '.c', '.h', '.cpp', '.csv', '.tsv', '']);
// tệp chỉ là tài nguyên (ảnh, font, âm thanh, PDF): không quét chữ, nhưng vẫn soi phần đầu để bắt tệp chạy được đội lốt
const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.bmp', '.tif', '.tiff', '.avif', '.ttf', '.otf', '.woff', '.woff2', '.eot', '.mp3', '.wav', '.ogg', '.m4a', '.flac', '.mp4', '.webm', '.mov', '.pdf', '.onnx', '.bin']);
const SCRIPT_EXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.py', '.sh', '.bash', '.zsh', '.ps1', '.psm1', '.bat', '.cmd', '.rb', '.pl', '.php', '.vbs', '.vba', '.ipynb', '.lua', '.go', '.rs', '.java', '.cs', '.exe', '.dll', '.so', '.dylib', '.jar', '.wasm']);
const MAX_FILES = 5000, MAX_BYTES = 2 << 20;

// [mã, mức, góc, mô tả, regex] — mức: 3 = ĐỎ, 2 = VÀNG, 1 = ghi chú
const RULES = [
  ['run-remote', 3, 'chuỗi cung ứng', 'tải mã từ Internet rồi chạy ngay (curl|sh, irm|iex, bash <(curl))', /\b(curl|wget)\s[^\n|]*(https?:|\$\w|\s-[a-zA-Z])[^\n|]*\|\s*(sudo\s+)?(ba|z|da)?sh\b|\b(irm|iwr|invoke-(rest|web)request)\b[^\n|]*\|\s*(iex|invoke-expression)\b|\b(iex|invoke-expression)\s*\(?\s*\(?\s*(irm|iwr|new-object\s+net\.webclient)|<\(\s*(curl|wget)\b|\$\(\s*(curl|wget)\b[^)]*\)\s*"?\s*$/im],
  ['obfuscated', 3, 'chuỗi cung ứng', 'giải mã rồi chạy (base64/hex → eval/exec)', /(eval|exec|Function|execSync|spawn|system|Invoke-Expression|iex)\s*\(?[^\n]{0,80}(atob|b64decode|base64\s+-d|FromBase64String|Buffer\.from\([^)]*base64|fromhex|unhexlify)|-EncodedCommand\b|\bpowershell(\.exe)?\s+-e(nc)?\s+[A-Za-z0-9+/=]{20,}/i],
  ['cred-paths', 3, 'AI agent', 'nhắc tới tệp đăng nhập/khóa của máy (~/.ssh, .credentials.json, ~/.aws, wrangler, gh, .npmrc, keychain)', /(\.ssh[\\/]|id_rsa|id_ed25519|\.credentials\.json|\.aws[\\/]credentials|\.config[\\/](gh|gcloud)|(~|\$HOME|%USERPROFILE%|homedir\(\)|\.config)[\\/]+\.?wrangler[\\/]|wrangler[\\/]config[\\/]default|[\\/](Login Data|Local State|Cookies)\b|\.npmrc|\.netrc|\.git-credentials|security\s+find-generic-password|cookies\.sqlite)/i],
  ['hide-from-user', 2, 'AI agent', 'câu dặn giấu người dùng (đọc ngữ cảnh: có thể chỉ là hướng dẫn cách viết)', /\b(do\s+not|don'?t|never)\s+(tell|inform|mention|reveal|show)\s+(this\s+)?(to\s+)?the\s+user\b|without\s+(telling|informing)\s+the\s+user/i],
  ['injection', 3, 'AI agent', 'câu lệnh nhắm vào AI (bỏ qua chỉ dẫn, tự cấp quyền)', /\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|system)\s+(instructions|prompts?|rules)|\byou\s+are\s+now\s+(in\s+)?(developer|dan|unrestricted)|dangerously-?skip-?permissions|bypassPermissions|--no-verify\b/i],
  ['exfil', 3, 'AI agent', 'gửi dữ liệu ra ngoài (webhook, pastebin, ngrok, requestbin, discord/telegram bot)', /(webhook\.site|pastebin\.com|requestbin|pipedream\.net|ngrok(-free)?\.(io|app)|interact\.sh|burpcollaborator|discord(app)?\.com\/api\/webhooks|api\.telegram\.org\/bot|hooks\.slack\.com\/services)/i],
  ['hidden-unicode', 3, 'AI agent', 'ký tự ẩn/đảo chiều (giấu chữ khỏi mắt người đọc)', /[\u200B\u200E\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069]|(?<!^)\uFEFF|\uDB40[\uDC00-\uDC7F]/],
  ['self-modify', 3, 'AI agent', 'ghi vào cấu hình Claude (settings.json, hooks, ~/.claude, CLAUDE.md, .mcp.json)', /(>>?|writeFile\w*|Set-Content|Add-Content|Out-File|cp|copy|mv)\s[^\n]{0,80}(\.claude[\\/](settings|hooks|skills|agents|commands)|CLAUDE\.md|\.mcp\.json|\.claude\.json)/i],
  ['install', 2, 'chuỗi cung ứng', 'cài gói/skill khác (npx, npm -g, pip install, skills add…) — thường không khóa phiên bản', /\b(npx|bunx|pnpm\s+dlx)\s+(-y\s+)?[@\w][\w@/.-]*|\bnpm\s+(i|install)\s+(-g|--global)\b|\b(pip3?|uv\s+pip|pipx)\s+install\b|\bskills\s+add\b|\bclaude\s+(plugin|mcp)\s+(install|add|marketplace)\b|\bgo\s+install\b|\bcargo\s+install\b|\bbrew\s+install\b|\bwinget\s+install\b/i],
  ['exec', 2, 'chuỗi cung ứng', 'chạy lệnh hệ thống / mã động (subprocess, child_process, eval, shell=True)', /\b(child_process|execSync|spawnSync|execFile|os\.system|subprocess\.|shell\s*=\s*True|Runtime\.getRuntime|new Function\(|\beval\s*\(|Start-Process|Invoke-Expression)/],
  ['network', 2, 'chuỗi cung ứng', 'gọi mạng trong script (fetch, requests, urllib, curl, Invoke-WebRequest)', /\b(fetch\s*\(|axios|requests\.(get|post|put)|urllib\.request|http\.client|httpx\.|curl\s|wget\s|Invoke-(WebRequest|RestMethod)|new\s+WebSocket|net\.connect|socket\.connect)/i],
  ['env-secrets', 2, 'AI agent', 'đọc biến môi trường có tên token/key/secret', /(process\.env|os\.environ|os\.getenv|\$env:|\$\{?)[\[.("']*\w*(TOKEN|SECRET|API_?KEY|PASSWORD|CREDENTIAL|AUTH)\w*/i],
  ['deploy', 2, 'Cloudflare/triển khai', 'lệnh triển khai / sửa dữ liệu thật (wrangler deploy, secret put, d1 --remote, vercel, gh release)', /\bwrangler\s+(deploy|publish|pages\s+deploy|secret\s+put|d1\s+execute[^\n]*--remote|kv:?\s*key\s+put|r2\s+object\s+put)|\bvercel\s+(--prod|deploy)|\bnetlify\s+deploy|\bgh\s+(release|pr\s+merge|repo\s+(delete|edit))|\bgit\s+push\b[^\n]*(--force|-f\b)/i],
  ['cf-api', 2, 'Cloudflare/triển khai', 'gọi thẳng API Cloudflare / dùng token Cloudflare', /api\.cloudflare\.com|CLOUDFLARE_API_TOKEN|CF_API_TOKEN|CLOUDFLARE_ACCOUNT_ID/],
  ['auto-run', 2, 'AI agent', 'bảo Claude tự chạy / không hỏi / luôn cho phép', /\b(always|automatically)\s+(run|execute|allow|approve)\b|\bwithout\s+(confirmation|asking)\b|\bauto[- ]?approve\b|allowed-tools\s*:\s*[^\n]*\b(Bash|PowerShell)\b(?!\()/i],
  ['html-comment', 1, 'AI agent', 'chú thích HTML trong tệp .md (người xem bản hiển thị không thấy, AI vẫn đọc)', /<!--[\s\S]{12,}?-->/],
  ['urls', 1, 'chuỗi cung ứng', 'có URL ra ngoài (xem danh sách tên miền)', /https?:\/\/[^\s)"'`<>]+/i],
];
const SCRIPT_ONLY = new Set(['network', 'exec', 'env-secrets']);
const LEVEL_NAME = { 3: 'ĐỎ', 2: 'VÀNG', 1: 'ghi chú' };

const files = [], findings = [], domains = new Map(), notes = [];
const manifests = { hooks: [], mcp: [], plugin: [], packages: [], skills: [] };
function walk(dir) {
  let list; try { list = readdirSync(dir); } catch (e) { notes.push(`không đọc được ${relative(ROOT, dir) || '.'}: ${e.code}`); return; }
  for (const n of list) {
    if (files.length >= MAX_FILES) { notes.push(`dừng ở ${MAX_FILES} tệp — repo quá lớn, quét chưa hết`); return; }
    const p = join(dir, n); let st; try { st = lstatSync(p); } catch { continue; }
    const rel = relative(ROOT, p).split('\\').join('/');
    if (st.isSymbolicLink()) { findings.push({ rule: 'symlink', level: 3, lens: 'chuỗi cung ứng', what: 'liên kết tượng trưng (có thể trỏ ra ngoài thư mục skill)', file: rel, line: 0 }); continue; }
    if (st.isDirectory()) { if (n === '.git') continue; walk(p); continue; }
    files.push({ rel, size: st.size, ext: extname(n).toLowerCase(), name: n });
  }
}
function head(p, n = 4) { const b = Buffer.alloc(n); let fd; try { fd = openSync(p, 'r'); readSync(fd, b, 0, n, 0); } catch {} finally { if (fd !== undefined) closeSync(fd); } return b; }

walk(ROOT);
for (const f of files) {
  const p = join(ROOT, f.rel), lc = f.rel.toLowerCase();
  if (/(^|\/)hooks\.json$|(^|\/)hooks\/[^/]+\.(json|sh|js|mjs|py|ps1)$/.test(lc)) manifests.hooks.push(f.rel);
  if (/(^|\/)\.?mcp\.json$/.test(lc)) manifests.mcp.push(f.rel);
  if (/(^|\/)(plugin|marketplace)\.json$/.test(lc)) manifests.plugin.push(f.rel);
  if (/(^|\/)(package\.json|requirements[^/]*\.txt|pyproject\.toml|pipfile|go\.mod|cargo\.toml|gemfile)$/.test(lc)) manifests.packages.push(f.rel);
  if (/(^|\/)skill\.md$/.test(lc)) manifests.skills.push(f.rel);
  const h = head(p);
  if ((h[0] === 0x4d && h[1] === 0x5a) || (h[0] === 0x7f && h[1] === 0x45 && h[2] === 0x4c && h[3] === 0x46) || (h[0] === 0xcf && h[1] === 0xfa) || (h[0] === 0xca && h[1] === 0xfe))
    findings.push({ rule: 'binary-exec', level: 3, lens: 'chuỗi cung ứng', what: `tệp chạy được (exe/ELF/Mach-O)${SCRIPT_EXT.has(f.ext) ? '' : ' đội lốt đuôi ' + (f.ext || '(không đuôi)')}`, file: f.rel, line: 0 });
  if (!TEXT_EXT.has(f.ext) || f.size > MAX_BYTES) {
    // không quét được thì không được coi là sạch: ít nhất VÀNG, liệt kê ra để xem tay
    if (/\.(zip|tar|gz|tgz|7z|rar|whl|jar|xz|bz2)$/.test(lc)) findings.push({ rule: 'archive', level: 2, lens: 'chuỗi cung ứng', what: 'tệp nén — nội dung bên trong không được quét', file: f.rel, line: 0 });
    else if (TEXT_EXT.has(f.ext)) findings.push({ rule: 'unscanned', level: 2, lens: 'chuỗi cung ứng', what: `tệp chữ quá lớn (> ${MAX_BYTES >> 20} MB) — không quét, phải xem tay`, file: f.rel, line: 0 });
    else if (!ASSET_EXT.has(f.ext)) findings.push({ rule: 'unscanned', level: 2, lens: 'chuỗi cung ứng', what: 'loại tệp lạ — không quét, phải xem tay', file: f.rel, line: 0 });
    continue;
  }
  let text; try { text = readFileSync(p, 'utf8'); } catch { continue; }
  const lines = text.split(/\r?\n/);
  for (const [rule, level, lens, what, re] of RULES) {
    if (rule === 'html-comment' && f.ext !== '.md') continue;
    if (SCRIPT_ONLY.has(rule) && !SCRIPT_EXT.has(f.ext)) continue; // ví dụ mã trong tài liệu .md: không tính
    if (rule === 'urls') { for (const m of text.matchAll(new RegExp(re.source, 'gi'))) { try { const d = new URL(m[0]).hostname; domains.set(d, (domains.get(d) || 0) + 1); } catch {} } continue; }
    if (rule === 'html-comment') { const m = re.exec(text); if (m) findings.push({ rule, level, lens, what, file: f.rel, line: text.slice(0, m.index).split('\n').length }); continue; }
    let hits = 0;
    lines.forEach((ln, i) => { if (hits < 3 && re.test(ln)) { hits++; findings.push({ rule, level, lens, what, file: f.rel, line: i + 1 }); } });
  }
  if (/[A-Za-z0-9+/]{400,}={0,2}/.test(text) && !/\.(svg|xsd|xml)$/.test(lc)) findings.push({ rule: 'blob', level: 2, lens: 'chuỗi cung ứng', what: 'chuỗi base64 rất dài (có thể giấu mã/dữ liệu)', file: f.rel, line: 0 });
}
// hook hoặc MCP trong một skill/plugin: luôn tự chạy khi bật → ít nhất VÀNG, đọc từng dòng
for (const h of manifests.hooks) findings.push({ rule: 'hooks', level: 2, lens: 'AI agent', what: 'có hook — tự chạy mỗi phiên/mỗi lần dùng công cụ, không cần ai gọi', file: h, line: 0 });
for (const k of manifests.packages) findings.push({ rule: 'deps', level: 2, lens: 'chuỗi cung ứng', what: 'khai báo gói phụ thuộc — cài vào là kéo thêm mã của người khác (xem có khóa phiên bản không)', file: k, line: 0 });
for (const m of manifests.mcp) findings.push({ rule: 'mcp', level: 2, lens: 'AI agent', what: 'có máy chủ MCP — thêm công cụ mới cho Claude (có thể gọi mạng, đọc tệp)', file: m, line: 0 });

const scripts = files.filter(f => SCRIPT_EXT.has(f.ext));
const top = findings.reduce((m, f) => Math.max(m, f.level), 0);
let verdict = top >= 3 ? 'ĐỎ' : (top >= 2 || scripts.length) ? 'VÀNG' : 'XANH';
const summary = { root: ROOT, verdict, files: files.length, scripts: scripts.map(s => s.rel), manifests, domains: [...domains.entries()].sort((a, b) => b[1] - a[1]), findings, notes };

if (asJson) { console.log(JSON.stringify(summary, null, 2)); process.exit(0); }
const out = [];
out.push(`# Quét skill (chỉ đọc): ${basename(ROOT)}`, '');
out.push(`Mức gợi ý: **${verdict}** — ${verdict === 'XANH' ? 'chỉ có chữ/ảnh, không thấy dấu hiệu đáng ngờ' : verdict === 'VÀNG' ? 'có script hoặc dấu hiệu cần đọc kỹ' : 'có dấu hiệu nguy hiểm — KHÔNG cài khi chưa đọc và hiểu từng dòng được đánh dấu'}.`);
out.push(`Tệp: ${files.length} · script/tệp chạy được: ${scripts.length} · SKILL.md: ${manifests.skills.length}`);
for (const [k, label] of [['hooks', 'Hook'], ['mcp', 'MCP'], ['plugin', 'Manifest plugin'], ['packages', 'Khai báo gói phụ thuộc']]) if (manifests[k].length) out.push(`${label}: ${manifests[k].join(', ')}`);
if (scripts.length) out.push('', '## Script (đọc hết từng tệp)', ...scripts.slice(0, 60).map(s => `- ${s.rel} (${s.size} B)`), scripts.length > 60 ? `- … và ${scripts.length - 60} tệp nữa` : '');
for (const lv of [3, 2, 1]) {
  const fs = findings.filter(f => f.level === lv); if (!fs.length) continue;
  out.push('', `## ${LEVEL_NAME[lv]} (${fs.length})`);
  const byRule = new Map(); for (const f of fs) { if (!byRule.has(f.rule)) byRule.set(f.rule, []); byRule.get(f.rule).push(f); }
  for (const [rule, list] of byRule) {
    out.push(`- **${list[0].what}** [${list[0].lens}]`);
    for (const f of list.slice(0, 12)) out.push(`  - ${f.file}${f.line ? ':' + f.line : ''}`);
    if (list.length > 12) out.push(`  - … và ${list.length - 12} chỗ nữa`);
  }
}
if (domains.size) out.push('', '## Tên miền được nhắc tới', ...summary.domains.slice(0, 40).map(([d, n]) => `- ${d} (${n})`));
if (notes.length) out.push('', '## Ghi chú', ...notes.map(n => `- ${n}`));
out.push('', '_Quét theo mẫu chỉ chỉ ra chỗ cần đọc. Không thấy gì ≠ an toàn: vẫn phải đọc SKILL.md và mọi script._');
console.log(out.join('\n'));
