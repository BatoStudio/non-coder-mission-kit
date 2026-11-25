// Lõi "bảo vệ dữ liệu" dùng chung cho các hook: đọc tệp bí mật / thư mục riêng, quyền riêng tư khi commit,
// mã phía trình duyệt nhắc tới dữ liệu mật, dòng bị khóa, thư mục trao đổi với AI khác (ChatGPT) và tệp kết luận.
// Gom từ các hook riêng đã chạy thật ở nhiều app (privacy-guard, scan-client-leak, guard-exchange, guard-locked, guard_verdict, quyền deny Read).
// Lý do trả về KHÔNG bao giờ lặp lại nội dung bị bắt (tên tệp mẫu, địa chỉ, số tiền).
import { readFileSync, existsSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { resolve, relative, basename, sep, extname, isAbsolute } from 'node:path';
import { execFileSync } from 'node:child_process';
import { homedir, tmpdir } from 'node:os';
import { WIN, git, privacyCheck, makePrivacyChecker, matchAny, globToRegex, nativePath } from './lib.mjs';
export { nativePath };

const home = homedir();
const posix = p => String(p).split(sep).join('/').replace(/\\/g, '/');
const lc = s => WIN ? s.toLowerCase() : s;
export const fold = s => String(s).normalize('NFD').replace(/[đĐ]/g, 'd').replace(/\p{M}/gu, '').toLowerCase();
export const expandHome = p => nativePath(String(p).replace(/^~(?=[\\/]|$)/, home).replace(/^\$HOME(?=[\\/]|$)|^\$\{HOME\}(?=[\\/]|$)|^%USERPROFILE%|^\$env:USERPROFILE/i, home));
const real = p => { try { return realpathSync.native(p); } catch { return p; } };
// a nằm trong (hoặc là) thư mục d — so theo đường dẫn tuyệt đối đã chuẩn hóa
export function within(a, d) {
  const A = lc(posix(resolve(a))).replace(/\/+$/, ''), D = lc(posix(resolve(d))).replace(/\/+$/, '');
  return A === D || A.startsWith(D + '/');
}

// ======================= 1. Đọc tệp bí mật / thư mục riêng =======================
// Tệp bí mật: không bao giờ cần đọc nội dung — app dùng biến môi trường. Bản mẫu (.env.example…) thì được đọc.
const SECRET_NAME = /^(\.env(\.[\w.-]+)?|\.envrc|\.dev\.vars(\.[\w.-]+)?|\.ops\.vars|\.npmrc|\.netrc|\.pgpass|\.git-credentials|\.credentials\.json|credentials\.json|id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|.*\.(pem|p12|pfx|key|keystore|jks))$/i;
// Windows bỏ đuôi luồng NTFS (::$DATA) và dấu chấm/cách cuối tên — ".env." vẫn là ".env"
export const cleanName = n => String(n).replace(/:.*$/, '').replace(/[. ]+$/, '');
const SECRET_OK = /\.(example|sample|template|dist|defaults?)$|\.pub$/i;
const SECRET_DIRS = ['~/.ssh', '~/.aws', '~/.wrangler', '~/.cloudflared', '~/.config/.wrangler', '~/AppData/Roaming/xdg.config/.wrangler', '~/.config/gh', '~/AppData/Roaming/GitHub CLI', '~/.config/gcloud', '~/.docker', '~/.kube', '~/.azure', '~/.gnupg',
  // trình duyệt: cookie và mật khẩu đã lưu
  '~/AppData/Local/Google/Chrome/User Data', '~/AppData/Local/Microsoft/Edge/User Data', '~/Library/Application Support/Google/Chrome', '~/.config/google-chrome',
  // Claude Code: lịch sử lệnh (có thể còn token đã dán), cấu hình tài khoản
  '~/.claude/history.jsonl', '~/.claude.json', '~/.claude/shell-snapshots', '~/.claude/session-env'];
// Transcript cũ (~/.claude/projects): HỎI, không chặn — Claude Code tự bảo đọc transcript sau khi nén ngữ cảnh.
// Được đọc không hỏi: bộ nhớ (<app>/memory) và kết quả công cụ dài Claude Code lưu tạm (<app>/<phiên>/tool-results).
const TRANSCRIPTS = '~/.claude/projects';
const TRANSCRIPT_OK = /\/\.claude\/projects\/[^/]+\/(memory|[^/]+\/tool-results)(\/|$)/i;
// phần ~/.claude được đọc không hỏi (khi readGuard.outside = "ask"): skill, plugin, agent, lệnh, kit, kế hoạch
const CLAUDE_READ_OK = ['skills', 'plugins', 'agents', 'commands', 'mission-kit', 'plans'];
// Thư mục tạm riêng của phiên Claude Code (<TEMP>/claude/<máy>/<phiên>/scratchpad|tasks): chỉ chứa tệp Claude tự viết
// hoặc kết quả lệnh chạy nền → đọc lại / chạy script ở đó không hỏi. Cả đường dẫn thật (symlink) cũng phải nằm trong đó.
const SCRATCH_OK = /^[^/]+\/[^/]+\/(scratchpad|tasks)(\/|$)/i;
const inScratch = (...ps) => ps.every(p => { const r = posix(relative(resolve(tmpdir(), 'claude'), p)); return !r.startsWith('..') && !/^[a-zA-Z]:|^\//.test(r) && SCRATCH_OK.test(r); });
export const DEFAULT_PRIVATE_DIRS = ['~/Desktop', '~/Documents', '~/Pictures', '~/Videos', '~/Music', '~/OneDrive', '~/Dropbox', ...(WIN ? ['D:/Dropbox', 'C:/Dropbox', 'E:/Dropbox'] : [])];

export function readGuardCfg(cfg) {
  const g = cfg.readGuard || {};
  return {
    enabled: g.enabled !== false,
    secrets: g.secrets !== false,
    extraSecrets: [].concat(g.extraSecrets || []),       // glob tương đối với app, vd. "reference/**", "**/*Payroll*"
    // privateDirs khai = THAY danh sách mặc định; extraPrivateDirs = CỘNG thêm (thường dùng cái này)
    privateDirs: [...(g.privateDirs === undefined ? DEFAULT_PRIVATE_DIRS : [].concat(g.privateDirs || [])), ...[].concat(g.extraPrivateDirs || [])],
    denyDirs: [].concat(g.denyDirs || []),              // thư mục không bao giờ đọc (vd. các app khác) → từ chối
    allowDirs: [].concat(g.allowDirs || []),            // ngoại lệ trong thư mục riêng, vd. thư mục trao đổi
    outside: g.outside === 'ask' ? 'ask' : 'allow',     // đọc ngoài thư mục app (không phải thư mục riêng)
  };
}
// Trả {kind:'deny'|'ask', reason} hoặc null. p: đường dẫn người dùng/Claude đưa (tương đối với cwd hoặc tuyệt đối).
export function readKind(root, cfg, cwd, p) {
  const g = readGuardCfg(cfg);
  if (!g.enabled || !p) return null;
  const raw = expandHome(String(p).replace(/^["']|["']$/g, ''));
  // thiết bị đặc biệt (curl -o /dev/null, > NUL): không phải tệp — trên Windows resolve thành D:\dev\null nên phải bỏ qua trước
  if (/^(\/dev\/(null|zero|stdin|stdout|stderr|tty|u?random|fd\/\d+)|nul|\$null)$/i.test(posix(raw))) return null;
  const abs = resolve(nativePath(cwd || root), raw), ra = real(abs);
  const name = cleanName(basename(abs));
  const rel = posix(relative(root, abs));
  const inside = r => r === '' || !(r.startsWith('..') || /^[a-zA-Z]:/.test(r) || r.startsWith('/'));
  const inApp = inside(rel);
  const realRel = posix(relative(real(root), ra)); // vị trí THẬT trong app (symlink/junction không che được)
  const isSecret = n => SECRET_NAME.test(n) && !SECRET_OK.test(n);
  if (g.secrets) {
    if (isSecret(name) || isSecret(cleanName(basename(ra))))
      return { kind: 'deny', reason: `«${name}» là tệp bí mật (token, khóa, mật khẩu). Không đọc nội dung — app dùng biến môi trường; cần biết có biến nào thì đọc tệp mẫu (.env.example) hoặc hỏi chủ dự án.` };
    if (SECRET_DIRS.some(d => within(abs, expandHome(d)) || within(ra, expandHome(d))))
      return { kind: 'deny', reason: 'Thư mục chứa khóa/đăng nhập của máy (ssh, wrangler, gh, aws, cookie trình duyệt, lịch sử Claude…). Không đọc.' };
    if ((within(abs, expandHome(TRANSCRIPTS)) || within(ra, expandHome(TRANSCRIPTS))) && !TRANSCRIPT_OK.test(posix(abs)))
      return { kind: 'ask', reason: 'Transcript phiên Claude cũ (~/.claude/projects) có thể còn token từng dán vào chat. Chỉ đọc khi chủ dự án đồng ý (vd. đọc lại sau khi nén ngữ cảnh).' };
  }
  const inExtra = r => matchAny(r, g.extraSecrets) || matchAny(r + '/_', g.extraSecrets);
  if (g.extraSecrets.length && ((inApp && inExtra(rel)) || (inside(realRel) && inExtra(realRel))))
    return { kind: 'deny', reason: `${rel} nằm trong vùng dữ liệu mật của app (readGuard.extraSecrets). Không đọc; nếu thật sự cần, hỏi chủ dự án.` };
  if (inApp) return null;
  if (g.denyDirs.some(d => within(abs, expandHome(d)) || within(ra, expandHome(d))))
    return { kind: 'deny', reason: `Thư mục này nằm trong vùng không được đọc của app (readGuard.denyDirs). Không đọc; nếu thật sự cần, hỏi chủ dự án.` };
  if (g.allowDirs.some(d => within(abs, expandHome(d)))) return null;
  if (cfg.handoff?.exchangeDir && within(abs, expandHome(cfg.handoff.exchangeDir))) return null; // thư mục trao đổi: được đọc lại để so vân tay
  if (g.privateDirs.some(d => within(abs, expandHome(d)) || within(ra, expandHome(d))))
    return { kind: 'ask', reason: 'Đọc vào thư mục riêng của chủ dự án (Desktop, Documents, Dropbox… — readGuard.privateDirs). Chỉ đọc khi chủ dự án đồng ý cho lần này.' };
  if (g.outside === 'ask' && !inScratch(abs, ra) && !CLAUDE_READ_OK.some(d => within(abs, resolve(homeClaude(), d))) && !TRANSCRIPT_OK.test(posix(abs)) && !within(abs, process.env.MISSION_KIT || root))
    return { kind: 'ask', reason: 'Đọc ngoài thư mục app (readGuard.outside = "ask"). Cần chủ dự án đồng ý.' };
  return null;
}
const homeClaude = () => resolve(home, '.claude');
// Quét rộng: tìm/liệt kê đệ quy từ gốc ổ đĩa hoặc thư mục nhà
export const isWideRoot = (cwd, p) => { const a = resolve(nativePath(cwd), expandHome(p)); return a === resolve('/') || /^[a-zA-Z]:[\\/]?$/.test(posix(a).replace(/\/$/, '')) || lc(posix(a)).replace(/\/$/, '') === lc(posix(home)); };

// ======================= 2. Quyền riêng tư khi commit =======================
// Thư mục mẫu: privacy.sampleDirs + samples.dir (một nguồn — khai ở đâu cũng được tính).
export const sampleDirsOf = cfg => [...new Set([...[].concat(cfg.privacy.sampleDirs || []), ...(cfg.samples?.dir ? [cfg.samples.dir] : [])])];
// Tên tệp trong thư mục mẫu thường là "<số job> <địa chỉ>": giữ cả tên lẫn phần sau số job, khi có từ 2 từ cách nhau bằng KHOẢNG TRẮNG
// (tên một từ như mau-a, 10001_sample, sample-park là tên ngắn — được dùng). Bỏ những khóa khớp privacy.allowPatterns.
export function sampleKeys(root, cfg) {
  const keys = [];
  const allow = [].concat(cfg.privacy.allowPatterns || []).map(p => { try { return new RegExp(p, 'iu'); } catch { return null; } }).filter(Boolean);
  for (const d of sampleDirsOf(cfg)) {
    let ents = []; try { ents = readdirSync(resolve(root, d)); } catch { continue; }
    for (const f of ents) {
      const b = f.replace(/\.[a-z0-9]{2,5}$/i, '').trim(), rest = b.replace(/^\d+[\s_-]+/, '').trim();
      const multi = s => /\S\s+\S/.test(s);
      if (multi(b) && b.length >= 6) keys.push(b.toLowerCase());
      if (rest !== b && rest.length >= 8 && multi(rest)) keys.push(rest.toLowerCase());
    }
  }
  return [...new Set(keys)].filter(k => !allow.some(r => r.test(k)));
}
const TEXT_EXT = /\.(js|mjs|cjs|ts|tsx|jsx|json|md|txt|html?|css|svg|csv|ya?ml|toml|py|sql|xml|ps1|sh|vue|svelte)$/i;
// Đọc lệnh git commit: -a/--all, pathspec, lời nhắn (-m/--message/-F)
export function parseCommit(rest) {
  const o = { all: false, paths: [], messages: [], messageFiles: [], pathspecFiles: [] };
  const VAL_LONG = /^--(reuse-message|reedit-message|fixup|squash|author|date|gpg-sign|cleanup|template|pathspec-from-file)$/;
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a === '--') { o.paths.push(...rest.slice(i + 1)); break; }
    if (a === '--all') { o.all = true; continue; }
    if (a === '--message' || a === '--trailer') { o.messages.push(rest[++i] ?? ''); continue; }
    if (a.startsWith('--trailer=')) { o.messages.push(a.slice(10)); continue; }
    if (a.startsWith('--message=')) { o.messages.push(a.slice(10)); continue; }
    if (a === '--file') { o.messageFiles.push(rest[++i] ?? ''); continue; }
    if (a.startsWith('--file=')) { o.messageFiles.push(a.slice(7)); continue; }
    if (a === '--pathspec-from-file') { o.pathspecFiles.push(rest[++i] ?? ''); continue; }
    if (a.startsWith('--pathspec-from-file=')) { o.pathspecFiles.push(a.slice(21)); continue; }
    if (VAL_LONG.test(a)) { i++; continue; }
    if (a.startsWith('--')) continue;
    if (a.startsWith('-') && a.length > 1) { // cụm cờ ngắn: -am"msg", -vam x, -Fmsg.txt, -C <commit>
      for (let k = 1; k < a.length; k++) {
        const c = a[k];
        if (c === 'a') o.all = true;
        else if (c === 'm' || c === 'F' || c === 'C' || c === 'c' || c === 't' || c === 'S') {
          const v = a.slice(k + 1) || (c === 'S' ? '' : rest[++i] ?? '');
          if (c === 'm') o.messages.push(v); else if (c === 'F') o.messageFiles.push(v);
          break;
        }
      }
      continue;
    }
    o.paths.push(a);
  }
  return o;
}
// C-style: git bọc tên tệp lạ bằng nháy kép và mã bát phân cho byte UTF-8
const unquoteGit = n => {
  n = n.replace(/\t$/, '');
  if (!/^".*"$/.test(n)) return n;
  const bytes = []; const body = [...n.slice(1, -1)]; // theo điểm mã (emoji không bị tách đôi)
  for (let i = 0; i < body.length; i++) {
    if (body[i] !== '\\') { bytes.push(...Buffer.from(body[i], 'utf8')); continue; }
    const m = /^[0-7]{3}/.exec(body.slice(i + 1, i + 4).join(''));
    if (m) { bytes.push(parseInt(m[0], 8)); i += 3; continue; }
    const c = body[++i]; bytes.push(({ n: 10, t: 9, r: 13, a: 7, b: 8, f: 12, v: 11 })[c] ?? c.charCodeAt(0));
  }
  return Buffer.from(bytes).toString('utf8');
};
// Chỉ kiểm lời nhắn (git tag -m, git merge -m, lời nhắn viết qua heredoc/ống dẫn)
export function messageIssue(root, cfg, msgs) {
  const check = makePrivacyChecker(root, cfg, { address: cfg.privacy.addressCheck || 'strong' });
  const keys = sampleKeys(root, cfg);
  for (const m of msgs) {
    const low = String(m).toLowerCase();
    if (keys.some(k => low.includes(k))) return 'Lời nhắn nhắc tên bộ mẫu/địa chỉ khách. Thay bằng tên ngắn (số job, tên gọi).';
    for (const line of String(m).split('\n')) { const why = check(line); if (why) return `Lời nhắn ${why === 'có vẻ là địa chỉ nhà' ? 'có vẻ chứa địa chỉ nhà' : why}. Thay bằng tên ngắn hoặc dữ liệu giả.`; }
  }
  return null;
}
const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
// Kiểm đúng những gì sẽ vào commit. ctx: { all, paths, messages, messageFiles, addFirst } (addFirst = cùng lệnh có git add trước commit).
// Trả lý do (chỉ tên tệp và số dòng — không lặp nội dung) hoặc null.
export function commitPrivacy(root, cfg, ctx = {}) {
  const p = cfg.privacy, cwd = ctx.cwd || root;
  const check = makePrivacyChecker(root, cfg, { address: p.addressCheck || 'strong' });
  const base = git(root, ['rev-parse', '--verify', '-q', 'HEAD']) ? 'HEAD' : EMPTY_TREE; // repo chưa có commit: so với cây rỗng
  // pathspec viết theo thư mục hiện tại → đổi về gốc repo (git ở đây chạy tại gốc)
  ctx = { ...ctx, paths: (ctx.paths || []).map(x => /^:/.test(x) ? x : ':(top)' + relative(root, resolve(cwd, nativePath(x))).split(sep).join('/')) };
  for (const f of ctx.pathspecFiles || []) { try { ctx.paths.push(...readFileSync(resolve(cwd, nativePath(f)), 'utf8').split(/\r?\n/).filter(Boolean).map(x => ':(top)' + relative(root, resolve(cwd, nativePath(x))).split(sep).join('/'))); } catch {} }
  const exts = [].concat(p.blockCommitExtensions || []).map(e => String(e).replace(/^\./, '').toLowerCase()).filter(Boolean);
  const keys = sampleKeys(root, cfg);
  const fixHint = 'Thay bằng tên ngắn (số job, tên gọi) hoặc dữ liệu giả rồi commit lại. Nếu chắc chắn không phải thông tin khách, thêm mẫu vào privacy.allowPatterns.';
  // 1) lời nhắn commit
  const msgs = [...(ctx.messages || [])];
  for (const f of ctx.messageFiles || []) { try { msgs.push(readFileSync(resolve(cwd, f), 'utf8')); } catch {} }
  for (const m of msgs) {
    const low = String(m).toLowerCase();
    if (keys.some(k => low.includes(k))) return `Lời nhắn commit nhắc tên bộ mẫu/địa chỉ khách. ${fixHint}`;
    const why = check(String(m));
    if (why) return `Lời nhắn commit ${why === 'có vẻ là địa chỉ nhà' ? 'có vẻ chứa địa chỉ nhà' : why}. ${fixHint}`;
  }
  // 2) tệp sẽ vào commit: đã stage; + thay đổi chưa stage khi -a / có pathspec / cùng lệnh có git add; + tệp mới khi cùng lệnh có git add
  // -z: tên tệp nguyên văn (không bị git bọc nháy khi có ", \, tab, Unicode)
  const L = s => (s || '').split('\0').filter(Boolean);
  const spec = ctx.paths?.length ? ['--', ...ctx.paths] : [];
  const working = ctx.all || ctx.addFirst || (ctx.paths?.length > 0);
  const gz = args => { try { return execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 << 20 }); } catch { return ''; } };
  const names = new Set(L(gz(['diff', '--cached', '--name-only', '-z', '--no-renames', '--diff-filter=ACMR', ...spec])));
  if (working) for (const n of L(gz(['diff', base, '--name-only', '-z', '--no-renames', '--diff-filter=ACMR', ...spec]))) names.add(n);
  const tracked = new Set(L(gz(['ls-files', '-z'])));
  if (ctx.addFirst) for (const n of L(gz(['ls-files', '-z', '--others', '--exclude-standard', ...spec]))) names.add(n);
  if (!names.size) return null;
  if (exts.length) for (const n of names) if (exts.includes(extname(n).slice(1).toLowerCase()))
    return `${n}: tệp .${extname(n).slice(1).toLowerCase()} không được commit (privacy.blockCommitExtensions) — bản vẽ/tài liệu của khách không vào git. Bỏ tệp khỏi commit (git restore --staged, thêm vào .gitignore) rồi commit lại.`;
  for (const n of names) if (keys.some(k => n.toLowerCase().includes(k))) return `Một tệp sắp commit có tên chứa tên bộ mẫu/địa chỉ khách (trong ${n.split('/').slice(0, -1).join('/') || 'thư mục gốc'}). Đổi tên theo tên ngắn rồi commit lại.`;
  // nội dung: dòng thêm mới, theo từng tệp để chỉ ra tệp:dòng
  // một lần git diff cho mọi tệp đã theo dõi (nhanh cả khi sửa hàng nghìn tệp), tách theo tiêu đề "+++ b/<tệp>"
  // chỉ bỏ: sổ do CLI ghi (đã kiểm khi ghi) và bản build khai rõ generated:true. Tệp nhị phân: git diff tự bỏ; tệp mới thì xét byte NUL.
  const gen = [].concat(cfg.deliverables || []).filter(d => d && typeof d === 'object' && d.generated && d.path).map(d => d.path);
  const skip = n => matchAny(n, gen) || ['.mission/ledger.jsonl', '.mission/gates.json', '.mission/manifest.json'].includes(n);
  const added = new Map();
  { const d = git(root, ['diff', ...(working ? [base] : ['--cached']), '-U0', '--no-color', '--no-ext-diff', '--no-renames', '--src-prefix=a/', '--dst-prefix=b/', '--diff-filter=ACMR', ...spec]) ?? '';
    let file = null, ln = 0;
    for (const l of d.split('\n')) {
      if (l.startsWith('+++ ')) { const n0 = unquoteGit(l.slice(4)); file = n0.startsWith('b/') ? n0.slice(2) : null; if (file && (!names.has(file) || skip(file))) file = null; continue; }
      const h = /^@@ -\d+(?:,\d+)? \+(\d+)/.exec(l); if (h) { ln = +h[1]; continue; }
      if (file && l.startsWith('+')) { if (!added.has(file)) added.set(file, []); added.get(file).push([ln++, l.slice(1)]); }
    } }
  for (const n of names) {
    if (skip(n) || tracked.has(n) || added.has(n)) continue;
    try { const f = resolve(root, n); if (statSync(f).size < (4 << 20)) { const b = readFileSync(f); if (!b.subarray(0, 8000).includes(0)) added.set(n, b.toString('utf8').split('\n').map((t, i) => [i + 1, t])); } } catch {}
  }
  // quét TỪNG DÒNG (bộ kiểm đã dựng sẵn regex nên vẫn nhanh); không ghép dòng — tránh "$" sai và ghép nhầm dòng rời
  const secretRules = [].concat(cfg.lint?.rules || []).filter(r => r && r.severity === 'error' && r.pattern).map(r => { try { return [r, new RegExp(r.pattern, r.flags || '')]; } catch { return null; } }).filter(Boolean);
  for (const [n, lines] of added) for (const [ln, t] of lines) {
    for (const [r, re] of secretRules) if ((!r.glob || matchAny(n, [].concat(r.glob))) && !(r.skipLinePattern && new RegExp(r.skipLinePattern).test(t)) && re.test(t))
      return `${n}:${ln} vi phạm luật «${r.id || r.pattern}» (${r.message || 'lỗi'}). Không commit; sửa trước.`;
    if (keys.length) { const low = t.toLowerCase(); if (keys.some(k => low.includes(k))) return `${n}:${ln} nhắc tên bộ mẫu/địa chỉ khách (lấy từ thư mục mẫu). ${fixHint}`; }
    const why = check(t);
    if (why) return `${n}:${ln} ${why === 'có vẻ là địa chỉ nhà' ? 'có vẻ chứa địa chỉ nhà' : why}. ${fixHint}`;
  }
  return null;
}

// ======================= 3. Mã phía trình duyệt nhắc tới dữ liệu mật =======================
export function clientCodeIssue(cfg, rel, text) {
  const cc = cfg.privacy.clientCode || {};
  const ids = [].concat(cc.identifiers || []);
  if (!ids.length || !text) return null;
  const include = [].concat(cc.include || ['**/*.{js,jsx,ts,tsx,mjs,cjs,vue,svelte,html}']);
  const exclude = [].concat(cc.exclude || ['**/{supabase,server,workers,migrations,scripts,tests,test,__tests__,docs}/**', '**/*.{test,spec}.*', '.claude/**', '.mission/**']);
  if (!matchAny(rel, include) || matchAny(rel, exclude)) return null;
  if (cc.serverMarker) { try { if (new RegExp(cc.serverMarker, 'm').test(text) && !/^\s*['"]use client['"]/m.test(text)) return null; } catch {} }
  for (const id of ids) {
    let re; try { re = new RegExp(id, cc.ignoreCase ? 'i' : ''); } catch { continue; }
    const m = re.exec(text);
    if (m) {
      const line = text.slice(0, m.index).split('\n').length;
      return `${rel}:${line} nhắc tới dữ liệu mật «${m[0]}» trong mã có thể tới trình duyệt. Chuyển phần này sang mã phía máy chủ${cc.serverMarker ? ` (${cc.serverMarkerLabel || 'đánh dấu mã phía máy chủ như các tệp server khác'})` : ''} và chỉ gửi cho trình duyệt đúng phần vai trò đó được xem.`;
    }
  }
  return null;
}

// ======================= 4. Dòng bị khóa trong tệp vẫn được sửa =======================
// protect.lockedText: [{ glob, text, why, mode }] — tệp được sửa, nhưng chuỗi «text» phải còn nguyên (đủ số lần).
//   mode "untouchable": mọi lần sửa có đoạn cũ ĐỤNG vào chuỗi đó đều bị chặn (kể cả biến dòng đó thành chú thích).
const count = (hay, t) => { let n = 0, i = 0; while ((i = hay.indexOf(t, i)) >= 0) { n++; i += t.length || 1; } return n; };
const spans = (hay, t) => { const o = []; let i = 0; while ((i = hay.indexOf(t, i)) >= 0) { o.push([i, i + t.length]); i += t.length || 1; } return o; };
export function lockedTextIssue(root, cfg, rel, tool, ti) {
  const rules = [].concat(cfg.protect.lockedText || []).filter(r => r && r.glob && r.text);
  if (!rules.length) return null;
  const nl = x => String(x ?? '').replace(/\r\n/g, '\n'); // tệp CRLF (Windows): công cụ Edit so khớp không phân biệt kiểu xuống dòng
  let cur = null; try { cur = nl(readFileSync(resolve(root, rel), 'utf8')); } catch {}
  for (const r of rules) {
    if (!matchAny(rel, [].concat(r.glob))) continue;
    const t = nl(r.text), why = r.why ? ` (${r.why})` : '';
    const msg = `${rel}: lần sửa này đụng vào chuỗi bị khóa (protect.lockedText)${why}. Chỉ chủ dự án được đổi chuỗi đó; sửa phần khác của tệp thì chừa chuỗi khóa ra.`;
    if (tool === 'Write') {
      const before = cur === null ? 0 : count(cur, t);
      if (count(nl(ti.content), nl(t)) < before) return msg;
      continue;
    }
    if (cur === null) continue;
    // áp từng lần sửa lên nội dung hiện tại (như công cụ Edit/MultiEdit thật), rồi so số lần xuất hiện
    let text = cur;
    const edits = Array.isArray(ti.edits) ? ti.edits : [ti];
    for (const e of edits) {
      const o = nl(e.old_string), n = nl(e.new_string);
      if (!o) continue;
      if (r.mode === 'untouchable') {
        const locks = spans(text, t);
        const hits = e.replace_all ? spans(text, o) : (text.indexOf(o) >= 0 ? [[text.indexOf(o), text.indexOf(o) + o.length]] : []);
        if (hits.some(([a, b]) => locks.some(([c, d]) => a < d && c < b))) return msg;
      }
      text = e.replace_all ? text.split(o).join(n) : text.replace(o, () => n);
    }
    if (count(text, t) < count(cur, t)) return msg;
  }
  return null;
}
// Lệnh shell sửa tại chỗ (sed -i, perl -i…) trên tệp có chuỗi khóa → cần hỏi
export const lockedGlobs = cfg => [].concat(cfg.protect.lockedText || []).filter(r => r && r.glob).flatMap(r => [].concat(r.glob));

// ======================= 5. Trao đổi với AI khác (ChatGPT) =======================
// exchangeDir: thư mục "hộp gửi" TRONG app (vd. docs/reviews/outbox). Chỉ chữ đã ghi vào đây (qua kiểm che) mới được dán sang ChatGPT
// bằng trình duyệt của Claude. Đường dẫn tương đối tính từ gốc app (root). Bản cũ trỏ Dropbox vẫn được canh như trước.
export function handoffCfg(cfg, root) {
  const h = cfg.handoff || {};
  const dir = h.exchangeDir ? expandHome(h.exchangeDir) : '';
  return {
    exchangeDir: dir && root && !isAbsolute(dir) ? resolve(root, dir) : dir,
    blockNames: [].concat(h.blockNames ?? ['INTERNAL', 'Payroll']),
    blockExtensions: [].concat(h.blockExtensions ?? ['xlsx', 'xls', 'xlsm', 'pdf', 'zip']).map(e => String(e).replace(/^\./, '').toLowerCase()),
    syntheticAmountsFile: h.syntheticAmountsFile || '',
    blockAmounts: !!h.blockAmounts,
    verdictGlob: h.verdictGlob || '',
    verdictSourceLine: h.verdictSourceLine || '',
  };
}
export const inExchange = (cfg, cwd, p, root) => { const h = handoffCfg(cfg, root || nativePath(cwd)); return !!h.exchangeDir && !!p && within(resolve(nativePath(cwd), expandHome(String(p).replace(/^["']|["']$/g, ''))), h.exchangeDir); };

const CUR = '(?:VND|USD|AUD|EUR|SGD|GBP|đồng|dong|đ|₫|\\$|€|£)';
const NUM = '\\d{1,3}(?:[.,\\u00a0 ]\\d{3})+(?:[.,]\\d+)?|\\d+(?:[.,]\\d+)?\\s?(?:k|m|tr|triệu|million|bn)\\b|\\d{4,}';
const AMOUNT = new RegExp(`(?<![\\w.,])(?:${CUR}\\s?[+\\-]?\\s?(?:${NUM})|(?:${NUM})\\s?${CUR}(?![\\w]))`, 'giu');
// Giá trị số tiền: bỏ phần thập phân, nhân k/m/tr/bn.
const MULT = { k: 1e3, m: 1e6, tr: 1e6, 'triệu': 1e6, million: 1e6, bn: 1e9 };
export function amountValue(txt) {
  const m = new RegExp(NUM, 'iu').exec(String(txt)); if (!m) return null;
  let s = m[0].replace(/\s/g, '');
  const suf = /(k|m|tr|triệu|million|bn)$/i.exec(s); if (suf) s = s.slice(0, -suf[1].length);
  // dấu phân cách cuối cùng theo sau bởi 1–2 chữ số = phần thập phân
  s = s.replace(/[.,](\d{1,2})$/, (x, d) => suf ? '.' + d : '');
  const v = parseFloat(s.replace(/[.,\u00a0]/g, (c, i) => suf && i === s.lastIndexOf('.') ? '.' : ''));
  return Number.isFinite(v) ? Math.round(v * (suf ? MULT[suf[1].toLowerCase()] : 1)) : null;
}
// Nội dung sắp ra khỏi máy sang thư mục trao đổi. name: tên tệp đích (hoặc nguồn).
export function exchangeContentIssue(root, cfg, name, text) {
  const h = handoffCfg(cfg);
  const n = String(name || '');
  const ext = extname(n).slice(1).toLowerCase();
  if (ext && h.blockExtensions.includes(ext)) return `Tệp .${ext} không được chép sang thư mục trao đổi (handoff.blockExtensions). Chuyển thành văn bản đã che thông tin trước.`;
  if (h.blockNames.some(b => fold(n).includes(fold(b)))) return 'Tên tệp thuộc loại nội bộ (handoff.blockNames, vd. INTERNAL, Payroll). Không gửi ra ngoài.';
  if (text == null) return null;
  const why = privacyCheck(root, cfg, String(text));
  if (why) return `Nội dung gửi sang thư mục trao đổi ${why === 'có vẻ là địa chỉ nhà' ? 'có vẻ chứa địa chỉ nhà' : why}. Che (thay bằng dữ liệu giả) trước khi gửi.`;
  if (h.blockAmounts) {
    let ok = new Set();
    if (h.syntheticAmountsFile) { try { ok = new Set(readFileSync(resolve(root, h.syntheticAmountsFile), 'utf8').split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#')).map(l => amountValue(l) ?? amountValue(l + ' ')).filter(v => v !== null)); } catch {} }
    for (const m of String(text).matchAll(AMOUNT)) if (!ok.has(amountValue(m[0]))) return 'Nội dung có số tiền không nằm trong danh sách số giả (handoff.syntheticAmountsFile). Thay bằng số giả trước khi gửi.';
  }
  return null;
}
// Tệp kết luận (verdict) của người soát bên ngoài: ghi một lần, không sửa.
export function verdictIssue(root, cfg, rel, absPath, tool, ti) {
  const h = handoffCfg(cfg);
  if (!h.verdictGlob) return null;
  const r = globToRegex(h.verdictGlob);
  if (!r.test(rel) && !r.test(basename(absPath))) return null;
  if (tool !== 'Write') return 'Tệp kết luận của người soát bên ngoài là bản chép nguyên văn: không được sửa. Ghi nhận xét vào tệp khác.';
  if (existsSync(absPath)) return 'Tệp kết luận đã có: không được ghi đè. Vòng mới thì dùng tên tệp mới.';
  if (h.verdictSourceLine) {
    let re; try { re = new RegExp(h.verdictSourceLine); } catch { return null; }
    const head = String(ti.content ?? '').split('\n').slice(0, 5).join('\n');
    if (!re.test(head)) return 'Tệp kết luận phải bắt đầu bằng dòng nguồn (handoff.verdictSourceLine): ghi rõ chép từ đâu, lúc nào.';
  }
  return null;
}
