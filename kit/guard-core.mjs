// Lõi dùng chung cho guard-paths và guard-bash: quyết định một ĐƯỜNG DẪN có được ghi hay không.
// Nguyên tắc: xét cả đường dẫn chữ và đường dẫn thật (đi qua symlink/junction), lấy kết quả nghiêm nhất.
import { existsSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, dirname, basename, join, relative, sep } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { KIT_DIR, WIN, matchAny, nativePath, globToRegex } from './lib.mjs';

const RANK = { allow: 0, ask: 1, deny: 2 };
export const stricter = (a, b) => (RANK[b?.kind] || 0) > (RANK[a?.kind] || 0) ? b : a;

const KIT_FILES = ['.mission/ledger.jsonl', '.mission/gates.json', '.mission/manifest.json'];
// Tên cụ thể dùng làm "ứng viên" khi đích ghi có ký tự đại diện (* ? [ ] { }).
export const SENSITIVE_CANDIDATES = ['.mission', ...KIT_FILES, '.mission/state', '.mission/state/last-check.json', '.mission/config.json',
  '.claude', '.claude/mission-kit', '.claude/mission-kit/mission.mjs', '.claude/mission-kit/hooks', '.claude/mission-kit/hooks/guard-bash.mjs',
  '.claude/mission-kit/hooks/guard-paths.mjs', '.claude/settings.json', '.claude/settings.local.json'];

// Bỏ đuôi luồng NTFS (tệp.json::$DATA, tệp.json:x) và dấu chấm/cách ở cuối tên (Windows tự bỏ).
export function cleanPath(p) {
  let s = String(p).replace(/^["']|["']$/g, '');
  const m = /^([a-zA-Z]:)?([\s\S]*)$/.exec(s); // [\s\S]: đối số có thể nhiều dòng, dấu chấm không khớp xuống dòng
  const drive = m[1] || '', rest = m[2].split(/[\\/]/).map(seg => seg.replace(/:[\s\S]*$/, '').replace(/[. ]+$/, s => (seg === '.' || seg === '..') ? s : ''));
  return drive + rest.join('/');
}

function realAbs(abs) {
  let cur = abs; const tail = [];
  while (!existsSync(cur)) { const up = dirname(cur); if (up === cur) return abs; tail.unshift(basename(cur)); cur = up; }
  try { return join(realpathSync.native(cur), ...tail); } catch { return abs; }
}
const relPosix = (from, to) => relative(from, to).split(sep).join('/');
const norm = s => WIN ? s.toLowerCase() : s;

function kindForRel(rel, cfg) {
  if (rel === '' || rel.startsWith('..') || /^[a-zA-Z]:/.test(rel) || rel.startsWith('/')) return null;
  const lc = rel.toLowerCase().replace(/\/+$/, '');
  if (KIT_FILES.includes(lc) || lc === '.mission' || lc === '.mission/state' || lc.startsWith('.mission/state/'))
    return { kind: 'deny', reason: `${rel}: sổ/cổng của Mission Kit chỉ được ghi qua CLI node "$MISSION_KIT/mission.mjs" (giữ luật PASS và lịch sử kiểm toán).`, tier: 'kit' };
  if (lc === '.claude' || lc === '.claude/mission-kit' || lc.startsWith('.claude/mission-kit/'))
    return { kind: 'deny', reason: `${rel}: tệp của chính Mission Kit (hook, CLI). Sửa nó là tắt lớp bảo vệ — chỉ chủ dự án cài/gỡ bằng install.mjs.`, tier: 'kit' };
  if (matchAny(rel, cfg.protect.deny) || matchAny(rel.replace(/\/$/, '') + '/_', cfg.protect.deny))
    return { kind: 'deny', reason: `${rel} nằm trong vùng bảo vệ (protect.deny trong .mission/config.json). Không được sửa; nếu thật sự cần, dừng lại và hỏi chủ dự án.`, tier: 'deny' };
  if (lc === '.mission/config.json')
    return { kind: 'ask', reason: 'Ghi .mission/config.json làm thay đổi luật bảo vệ và cổng chất lượng. Cần người dùng đồng ý.' };
  if (/^\.claude\/settings(\.local)?\.json$/.test(lc))
    return { kind: 'ask', reason: `${rel}: cài đặt Claude Code (hook, quyền). Thay đổi có thể tắt lớp bảo vệ — cần người dùng đồng ý.` };
  if (lc === '.mcp.json' || /^\.claude\/(skills|agents|commands|hooks|plugins)(\/|$)/.test(lc))
    return { kind: 'ask', reason: `${rel}: ${CODE_INTAKE}` };
  if (/^(\.claude\/)?claude(\.local)?\.md$/.test(lc) || lc === '.claude/launch.json' || lc === '.vscode/tasks.json')
    return { kind: 'ask', reason: `${rel}: ${AUTO_RUN}` };
  if (lc === '.git/config' || /^\.git\/hooks(\/|$)/.test(lc) || /^(tools\/git-hooks|\.githooks|\.husky)(\/|$)/.test(lc))
    return { kind: 'ask', reason: `${rel}: hook/cấu hình git tự chạy mỗi lần commit hoặc push (có thể tự đẩy mã lên GitHub). Cần chủ dự án đồng ý.` };
  if (matchAny(rel, cfg.protect.ask))
    return { kind: 'ask', reason: `${rel} thuộc vùng nhạy cảm (protect.ask). Xác nhận trước khi sửa.`, tier: 'protectAsk' };
  return null;
}
// CLAUDE.md được nạp đầu MỌI phiên; launch.json/tasks.json chạy lệnh khi mở xem trước hoặc mở thư mục.
export const AUTO_RUN = 'tệp này được nạp hoặc tự chạy ở các phiên sau (lời dặn cho Claude, lệnh khởi động). Lời dặn lạ chép vào đây sẽ sống mãi — cần chủ dự án đồng ý.';
// Skill, agent, lệnh, hook, plugin, máy chủ MCP: Claude sẽ làm theo lời dặn và chạy mã trong đó với quyền của chủ máy.
export const CODE_INTAKE = 'thêm/sửa skill, agent, lệnh, hook, plugin hoặc máy chủ MCP = đưa mã và lời dặn mới cho Claude làm theo. Nguồn lạ (GitHub…) phải qua /mission-skill-audit trước; cần chủ dự án đồng ý.';

function kindForAbs(abs) {
  const home = homedir();
  const kit = norm(resolve(KIT_DIR)), a = norm(abs);
  if (a === kit || a.startsWith(kit + sep) || a.startsWith(kit + '/'))
    return { kind: 'deny', reason: 'Tệp của chính Mission Kit (hook, CLI). Chỉ chủ dự án cài/gỡ bằng install.mjs.', tier: 'kit' };
  if (/[\\/]\.claude[\\/]settings(\.local)?\.json$/i.test(abs) && norm(dirname(dirname(abs))) === norm(home))
    return { kind: 'ask', reason: 'Cài đặt Claude Code toàn máy (~/.claude/settings.json). Cần người dùng đồng ý.' };
  const hc = norm(resolve(home, '.claude'));
  if ((a.startsWith(hc + sep) || a.startsWith(hc + '/')) && /^(skills|agents|commands|hooks|plugins)([\\/]|$)/.test(a.slice(hc.length + 1)))
    return { kind: 'ask', reason: `~/.claude (toàn máy): ${CODE_INTAKE}` };
  if (a === norm(resolve(home, '.claude.json')))
    return { kind: 'ask', reason: '~/.claude.json: cấu hình Claude Code toàn máy (máy chủ MCP, quyền). Cần người dùng đồng ý.' };
  return null;
}

// Trả {kind, reason} hoặc null. p: đường dẫn (tương đối với cwd, hoặc tuyệt đối).
export function pathKind(root, cfg, cwd, p) {
  const abs = resolve(nativePath(cwd || root), cleanPath(nativePath(p)));
  let best = kindForAbs(abs) || null;
  const lexRel = relPosix(root, abs);
  best = stricter(best, kindForRel(lexRel, cfg));
  // tổ tiên của tệp bảo vệ (xóa/ghi đè cả thư mục)
  if (lexRel && !lexRel.startsWith('..') && !/^[a-zA-Z]:/.test(lexRel)) {
    const pre = lexRel.toLowerCase().replace(/\/+$/, '') + '/';
    if (SENSITIVE_CANDIDATES.some(c => c.startsWith(pre)) && !best) best = { kind: 'deny', reason: `${lexRel} chứa tệp của Mission Kit hoặc Claude Code — không xóa/ghi đè cả thư mục.`, tier: 'kit' };
  }
  const real = realAbs(abs);
  if (real !== abs) {
    let rroot = root; try { rroot = realpathSync.native(root); } catch {}
    best = stricter(best, kindForAbs(real));
    best = stricter(best, kindForRel(relPosix(rroot, real), cfg));
  }
  return best;
}

// ---- bash.freeDirs: nơi ghi/sửa/xóa không cần hỏi ----
const slashed = s => String(s).split(sep).join('/').replace(/\\/g, '/').replace(/\/+$/, '');
// Thư mục tạm của hệ thống, cả dạng thật. Bỏ gốc ổ đĩa, phòng biến môi trường đặt sai.
export function tempRoots() {
  const raw = ['/tmp', tmpdir(), process.env.TMPDIR, process.env.TEMP, process.env.TMP].filter(Boolean).map(p => nativePath(p));
  const all = raw.flatMap(p => { try { return [p, realpathSync.native(p)]; } catch { return [p]; } }).map(slashed);
  if (WIN) all.push('*:/Users/*/AppData/Local/Temp');
  return [...new Set(all)].filter(r => r && !/^[a-zA-Z]:$/.test(r));
}
function freeGlobs(root, cfg) {
  const L = [];
  for (const e0 of [].concat(cfg.bash?.freeDirs || [])) {
    const e = String(e0).replace(/\\/g, '/');
    const m = /^(%TEMP%|%TMP%|\$TEMP|\$TMPDIR|\$TMP|\$\{TMPDIR\})(?=\/|$)/i.exec(e);
    const tail = g => /[*?]/.test(g) ? g : g.replace(/\/+$/, '') + '/**';
    if (m) { for (const r of tempRoots()) L.push({ glob: tail(r + e.slice(m[0].length)), temp: true }); continue; }
    const x = nativePath(e.replace(/^~(?=\/|$)/, homedir()));
    L.push({ glob: tail(/^([a-zA-Z]:)?\//.test(x) ? x : slashed(resolve(root)) + '/' + x), temp: false });
  }
  return L;
}
// Đích nằm HẲN trong một freeDirs, xét cả đường dẫn chữ lẫn đường dẫn thật (symlink/junction).
// Thư mục tạm không được chứa hoặc nằm trong app (app đặt trong thư mục tạm vẫn được bảo vệ bình thường).
export function inFreeDir(root, cfg, cwd, p) {
  const raw = cleanPath(nativePath(p));
  const base = hasGlob(raw) ? raw.replace(/[*?[\]{}].*$/, '') : raw;
  if (hasGlob(raw) && /(^|\/)\.\.(\/|$)/.test(raw.slice(base.length))) return false;
  const abs = resolve(nativePath(cwd || root), base), real = realAbs(abs);
  let rroot = root; try { rroot = realpathSync.native(root); } catch {}
  const roots = [slashed(resolve(root)), slashed(rroot)].map(norm);
  const nearApp = t => roots.some(r => { const a = norm(t); return a === r || a.startsWith(r + '/') || r.startsWith(a + '/'); });
  const globs = freeGlobs(root, cfg).map(g => ({ ...g, re: globToRegex(g.glob) }));
  return [slashed(abs), slashed(real)].every(t => globs.some(g => g.re.test(t) && !(g.temp && nearApp(t))));
}

// ---- đích có ký tự đại diện: thử với các tên nhạy cảm + mục thật trên đĩa (2 tầng) ----
const escRe = s => s.replace(/[.+^$()|\\/]/g, '\\$&');
const ANY_CHAR = '[^/]';
// Vị trí dấu ] đóng theo luật shell: ] đứng đầu là chữ thường.
function bracketEnd(g, i) {
  let j = i + 1;
  if (g[j] === '!' || g[j] === '^') j++;
  if (g[j] === ']') j++;
  j = g.indexOf(']', j);
  return j;
}
// Ngoặc hợp lệ thì giữ nguyên nghĩa. Ngoặc sai như [z-a] coi như «một ký tự bất kỳ»:
// khớp rộng hơn thì tệp bảo vệ vẫn bị bắt, và không bao giờ sinh regex sai.
function bracketRe(body) {
  const neg = /^[!^]/.test(body);
  const re = '[' + (neg ? '^' : '') + (neg ? body.slice(1) : body).replace(/[\\\][^]/g, '\\$&') + ']';
  try { new RegExp(re); return re; } catch { return ANY_CHAR; }
}
function globBody(g, startsSeg) {
  let re = '', i = 0;
  while (i < g.length) {
    const c = g[i];
    const segStart = i === 0 ? startsSeg : g[i - 1] === '/';
    if (c === '*') { re += (segStart ? '(?!\\.)' : '') + '[^/]*'; }
    else if (c === '?') re += (segStart ? '(?!\\.)' : '') + '[^/]';
    else if (c === '[') { const j = bracketEnd(g, i); if (j < 0) re += '\\['; else { re += bracketRe(g.slice(i + 1, j)); i = j; } }
    else if (c === '{') { const j = g.indexOf('}', i); if (j < 0) re += '\\{'; else { re += '(?:' + g.slice(i + 1, j).split(',').map(alt => globBody(alt, segStart)).join('|') + ')'; i = j; } }
    else re += escRe(c);
    i++;
  }
  return re;
}
export function shellGlobRe(pattern, ci) {
  return new RegExp('^' + globBody(pattern, true) + '$', ci ? 'i' : '');
}
export const hasGlob = s => /[*?[\]{}]/.test(s);

function diskCandidates(root) {
  const outL = [];
  const walk = (dir, rel, depth) => {
    let ents = []; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      const r = rel ? rel + '/' + e.name : e.name; outL.push(r);
      if (e.isDirectory() && depth < 2) walk(join(dir, e.name), r, depth + 1);
    }
  };
  walk(root, '', 0);
  return outL;
}

// [[:alpha:]] đổi thành ? trước khi cleanPath, vì cleanPath coi dấu : là đuôi luồng NTFS và cắt mất phần sau.
const POSIX_CLASS = /\[[!^]?[^\]/]*\[:\w+:\][^\]/]*\]/g;
export function globKind(root, cfg, cwd, pattern, ci) {
  const absPat = resolve(nativePath(cwd || root), cleanPath(nativePath(pattern.replace(POSIX_CLASS, '?')))).split(sep).join('/');
  const rootP = resolve(root).split(sep).join('/');
  if (!absPat.toLowerCase().startsWith(rootP.toLowerCase() + '/')) return null;
  const relPat = absPat.slice(rootP.length + 1);
  const re = shellGlobRe(relPat, ci || WIN);
  let best = null;
  for (const c of [...new Set([...SENSITIVE_CANDIDATES, ...diskCandidates(root)])])
    if (re.test(c)) best = stricter(best, pathKind(root, cfg, root, c));
  return best && { kind: best.kind, tier: best.tier, reason: `Mẫu «${pattern}» khớp tệp được bảo vệ. ${best.reason}` };
}
