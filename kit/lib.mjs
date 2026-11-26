// Thư viện dùng chung cho hooks và CLI của Mission Kit. Không phụ thuộc gói ngoài.
// Mọi thứ xoay quanh tệp cấu hình <dự án>/.mission/config.json.
// Không có tệp đó  ->  kit coi như dự án không dùng quy trình và im lặng hoàn toàn.
import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync, lstatSync, appendFileSync, realpathSync } from 'node:fs';
import { resolve, relative, dirname, sep, isAbsolute, posix } from 'node:path';
import { execFileSync, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir, homedir } from 'node:os';

export const MISSION_DIR = '.mission';
export const KIT_DIR = dirname(fileURLToPath(import.meta.url));
export const WIN = process.platform === 'win32';

// ---------- đường dẫn trên Windows ----------
// Đổi mọi dạng về dạng Windows thường: /c/x (Git Bash) → C:/x; /tmp/x (Git Bash, = %TEMP%) → thư mục tạm; \\?\C:\x → C:\x.
// Trên Linux/macOS giữ nguyên. Hoa/thường do path.relative và matchAny lo.
// gitBashTmp = false: lệnh PowerShell/cmd, nơi /tmp là thư mục thật trên ổ hiện hành.
export function nativePath(p, { gitBashTmp = true } = {}) {
  if (!WIN) return String(p);
  let s = String(p).replace(/^["']|["']$/g, '').replace(/^[\\/]{2}[?.][\\/](UNC[\\/])?/i, (_, unc) => unc ? '//' : '');
  if (!/^\/(?!\/)/.test(s)) return s;
  s = posix.normalize(s); // /tmp/../c/x → /c/x, phải làm trước khi nhận dạng
  if (gitBashTmp && /^\/tmp(\/|$)/i.test(s)) return tmpdir().replace(/\\/g, '/').replace(/\/+$/, '') + s.slice(4);
  return s.replace(/^\/([a-zA-Z]):?(\/|$)/, (_, d) => d.toUpperCase() + ':/'); // "/d" → "D:/" (gốc ổ, không phải thư mục hiện hành của ổ)
}

// ---------- tìm gốc dự án ----------
// Dò ngược lên nhưng DỪNG ở thư mục có .git (gốc repo) — một .mission/ đặt nhầm ở thư mục cha
// (vd. D:\APPS) không được kéo mọi app con vào quy trình.
export function findRoot(start = process.cwd()) {
  if (process.env.CLAUDE_PROJECT_DIR && existsSync(resolve(nativePath(process.env.CLAUDE_PROJECT_DIR), MISSION_DIR, 'config.json')))
    return resolve(nativePath(process.env.CLAUDE_PROJECT_DIR));
  let d = resolve(nativePath(start || process.cwd()));
  while (true) {
    if (existsSync(resolve(d, MISSION_DIR, 'config.json'))) return d;
    if (existsSync(resolve(d, '.git'))) return null;
    const up = dirname(d);
    if (up === d) return null;
    d = up;
  }
}

export function mpath(root, ...p) { return resolve(root, MISSION_DIR, ...p); }

const stripBom = s => s.replace(/^\uFEFF/, '');
export function readJsonFile(p) { return JSON.parse(stripBom(readFileSync(p, 'utf8'))); }

const asArr = v => v == null ? [] : Array.isArray(v) ? v : [v];
// Nơi ghi/sửa/xóa không cần hỏi (bash.freeDirs). Luật chặn .mission, kit và protect.deny vẫn thắng.
// Dữ liệu KHÔNG được xóa/ghi đè/liên kết mà không hỏi (protect.important). Mỗi app sửa được trong .mission/config.json.
export const DEFAULT_IMPORTANT = ['samples/', 'out/golden/', 'tests/pdf-library*/', '.mission/ledger.jsonl', 'build/backup/'];
export const DEFAULT_FREE_DIRS = ['%TEMP%/**', '%TEMP%/claude/**', 'build/logs/**'];
export function loadConfig(root) { return normalizeConfig(readJsonFile(mpath(root, 'config.json'))); }
export function normalizeConfig(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('config phải là một đối tượng JSON');
  const d = {
    name: 'mission', mainBranch: 'main', protectedBranches: ['main', 'master'], workBranchPrefix: 'work/',
    git: { mode: 'local-main' },
    deliverables: [], protect: { deny: [], ask: [], lockedText: [] }, bash: { deny: [], ask: [] },
    checks: { onEdit: [], full: [], remind: [] }, lint: { rules: [] }, units: [], gates: [],
    independentGates: [], severities: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'], blockingSeverities: ['CRITICAL', 'HIGH'],
    stopGate: { watch: [], enabled: true, mode: 'remind' },
    privacy: { patterns: [], denylistFiles: [], allowPatterns: [], sampleDirs: [], blockCommitExtensions: [], blockPush: false, clientCode: {} },
    readGuard: {}, handoff: {},
    appSkills: { review: 'ba-chuyen-gia', deploy: 'ship' }, review: { defaultAgents: 3, maxRounds: 3 },
  };
  const c = { ...d, ...raw };
  for (const k of ['git', 'protect', 'bash', 'checks', 'lint', 'stopGate', 'privacy', 'review', 'appSkills', 'readGuard', 'handoff']) c[k] = { ...d[k], ...(raw[k] || {}) };
  // chuẩn hóa kiểu để config viết sai (chuỗi thay vì mảng) không làm văng hook
  c.protect.deny = asArr(c.protect.deny); c.protect.ask = asArr(c.protect.ask);
  c.protect.important = c.protect.important === undefined ? [...DEFAULT_IMPORTANT] : asArr(c.protect.important);
  c.bash.deny = asArr(c.bash.deny); c.bash.ask = asArr(c.bash.ask);
  c.bash.freeDirs = c.bash.freeDirs === undefined ? [...DEFAULT_FREE_DIRS] : asArr(c.bash.freeDirs);
  c.checks.onEdit = asArr(c.checks.onEdit); c.checks.full = asArr(c.checks.full);
  c.lint.rules = asArr(c.lint.rules); c.units = asArr(c.units); c.gates = asArr(c.gates);
  c.stopGate.watch = asArr(c.stopGate.watch); c.protectedBranches = asArr(c.protectedBranches);
  c.privacy.patterns = asArr(c.privacy.patterns); c.privacy.denylistFiles = asArr(c.privacy.denylistFiles);
  c.privacy.allowPatterns = asArr(c.privacy.allowPatterns); c.privacy.sampleDirs = asArr(c.privacy.sampleDirs);
  c.privacy.blockCommitExtensions = asArr(c.privacy.blockCommitExtensions);
  if (!c.privacy.clientCode || typeof c.privacy.clientCode !== 'object') c.privacy.clientCode = {};
  c.protect.lockedText = asArr(c.protect.lockedText); c.checks.remind = asArr(c.checks.remind);
  c.independentGates = asArr(c.independentGates);
  return c;
}

// Dùng trong hook: config hỏng thì KHÔNG được âm thầm tắt bảo vệ.
export function loadConfigSafe(root) {
  try { return { cfg: loadConfig(root) }; }
  catch (e) { return { cfg: normalizeConfig({}), error: `.mission/config.json hỏng (${e.message.split('\n')[0]}). Sửa tệp này trước; trong lúc đó mọi thao tác ghi đều phải hỏi.` }; }
}

// ---------- glob ----------
// Hỗ trợ: **  *  ?  {a,b}. Khớp theo đường dẫn tương đối, phân cách bằng '/'. Không phân biệt hoa/thường trên Windows.
export function globToRegex(g) {
  let re = '', i = 0;
  while (i < g.length) {
    const c = g[i];
    if (c === '*') {
      if (g[i + 1] === '*') { i += 2; if (g[i] === '/') { i++; re += '(?:.*/)?'; } else re += '.*'; continue; }
      re += '[^/]*';
    } else if (c === '?') re += '[^/]';
    else if (c === '{') { const j = g.indexOf('}', i); if (j < 0) re += '\\{'; else { re += '(?:' + g.slice(i + 1, j).split(',').map(esc).join('|') + ')'; i = j; } }
    else re += esc(c);
    i++;
  }
  return new RegExp('^' + re + '$', WIN ? 'i' : '');
}
const esc = s => s.replace(/[.+^$()|[\]\\]/g, '\\$&');
// ngoài dự án: «..» hoặc khác ổ đĩa (Windows: relative() trả về đường dẫn tuyệt đối «C:/...»)
export const isOutside = rel => rel.startsWith('..') || /^[a-zA-Z]:/.test(rel) || rel.startsWith('/');
export const toRel = (root, p) => relative(root, resolve(root, String(p).replace(/^["']|["']$/g, ''))).split(sep).join('/').replace(/\\/g, '/');
export function matchAny(rel, globs = []) { return asArr(globs).some(g => globToRegex(g).test(rel)); }

// ---------- git ----------
export function git(root, args) {
  try { return execFileSync('git', ['-c', 'core.quotePath=false', ...args], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
  catch { return null; }
}
// Danh sách tệp git (-z: tên có " \\ tab, xuống dòng, Unicode không bị bọc/escape).
export function lsFiles(root, { others = true } = {}) {
  try {
    const o = execFileSync('git', ['-c', 'core.quotePath=false', 'ls-files', '-z', '--cached', ...(others ? ['--others', '--exclude-standard'] : [])], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 << 20 });
    // chỉ tệp thường và symlink; bỏ thư mục (submodule, repo lồng nhau "tools/") — chúng không có nội dung để so
    return [...new Set(o.split('\0').filter(Boolean))].filter(f => {
      if (f.endsWith('/')) return false;
      try { const st = lstatSync(resolve(root, f)); return st.isFile() || st.isSymbolicLink(); } catch { return true; } // đã xóa: giữ để thấy thay đổi
    });
  } catch { return []; }
}
export function gitInfo(root) {
  const branch = git(root, ['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = git(root, ['rev-parse', '--short', 'HEAD']);
  let st = '';
  try { st = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }); } catch {}
  const parts = st.split('\0'); const changed = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]; if (!p) continue;
    const x = p[0]; changed.push(p.slice(3));
    if (x === 'R' || x === 'C') i++; // -z: tên cũ của tệp đổi tên nằm ở mục kế tiếp
  }
  return { isRepo: branch !== null, branch, head, changed };
}
// Tệp đã thay đổi kể từ một commit (gồm cả commit sau đó lẫn chưa commit). commit không hợp lệ → null.
export function changedSince(root, commit) {
  const { changed } = gitInfo(root);
  if (!commit) return null;
  const d = git(root, ['diff', '--name-only', commit, 'HEAD']);
  if (d === null) return null;
  return [...new Set([...d.split('\n').filter(Boolean), ...changed])];
}

// ---------- chạy lệnh kiểm tra (đa nền tảng) ----------
// - thay $MISSION_KIT / ${MISSION_KIT} / %MISSION_KIT% bằng đường dẫn thật (cmd.exe không hiểu $VAR)
// - {file} được bọc bằng nháy kép (hợp cả bash lẫn cmd.exe; chịu được dấu cách)
// - Windows: chạy bằng Git Bash nếu có (nhiều lệnh dự án là cú pháp sh), không thì cmd.exe
let _bash;
export function shellFor() {
  if (!WIN) return undefined;
  if (_bash !== undefined) return _bash || undefined;
  const cands = [process.env.MISSION_SHELL, 'C:\\Program Files\\Git\\bin\\bash.exe', 'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
    process.env.LOCALAPPDATA && resolve(process.env.LOCALAPPDATA, 'Programs/Git/bin/bash.exe')].filter(Boolean);
  _bash = cands.find(p => existsSync(p)) || '';
  return _bash || undefined;
}
export function expandCmd(cmd, file) {
  const kit = KIT_DIR.split(sep).join('/');
  let c = cmd.replace(/\$\{MISSION_KIT\}|\$MISSION_KIT\b|%MISSION_KIT%/g, kit);
  if (file !== undefined) {
    let q = JSON.stringify(String(file));
    if (!WIN || shellFor()) q = q.replace(/[$`]/g, '\\$&'); // bash: chặn diễn giải $ và ` trong tên tệp
    c = c.replaceAll('{file}', q);
  }
  return c;
}
export function runCmd(root, cmd, { file, timeout = 600 } = {}) {
  const command = expandCmd(cmd, file);
  const t0 = Date.now();
  try {
    const o = execSync(command, { cwd: root, encoding: 'utf8', timeout: timeout * 1000, stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 << 20, shell: shellFor(), env: { ...process.env, MISSION_KIT: KIT_DIR } });
    return { ok: true, code: 0, ms: Date.now() - t0, out: o };
  } catch (e) {
    return { ok: false, code: e.status ?? 'timeout', ms: Date.now() - t0, out: (e.stdout || '') + (e.stderr || '') };
  }
}

// ---------- quyền riêng tư ----------
// Mẫu cấm ghi vào sổ lỗi/cổng/báo cáo: địa chỉ nhà kiểu Úc + mẫu riêng + danh sách chặn của app (một nguồn sự thật).
// Hậu tố "mạnh" (hiếm gặp trong câu thường) — không phân biệt hoa/thường, 1–3 từ bất kỳ (kể cả chữ có dấu) đứng trước.
const STRONG = 'street|avenue|ave|road|crescent|cres|parade|pde|highway|hwy|boulevard|blvd|tce|circuit|cct|esplanade|promenade|parkway|pkwy|mews|quay|arcade';
// Hậu tố "yếu" (cũng là từ thường) — chỉ tính khi tên đường VIẾT HOA như địa chỉ thật: "12 Smith Close", "3 Bay Lane".
const WEAK = ['Street', 'Drive', 'Place', 'Way', 'Close', 'Square', 'Lane', 'Court', 'Grove', 'Terrace', 'Rise', 'Loop', 'Row', 'Walk', 'Glen', 'Ridge', 'View', 'Gardens', 'Mall',
  'St', 'Dr', 'Pl', 'Ct', 'Ln', 'Gr', 'Sq', 'Rd', 'Cl', 'Cres', 'Av', 'Ave', 'Tce'];
const WEAK_ALT = [...WEAK, ...WEAK.map(w => w.toUpperCase())].join('|');
const W = "[\\p{L}'’]+";
const ADDRESS = new RegExp(`(?<![\\p{L}\\d])\\d{1,5}[a-z]?[\\s._-]*(?:${W}[\\s._-]+){1,3}(?:${STRONG})(?![\\p{L}])`, 'iu');
const ADDRESS_WEAK = new RegExp(`(?<![\\p{L}\\d])\\d{1,5}[A-Za-z]?[\\s._-]*(?:(?:\\p{Lu}[\\p{L}'’]*|of|the)[\\s._-]+){0,2}\\p{Lu}[\\p{L}'’]*[\\s._-]+(?:${WEAK_ALT})(?![\\p{L}])`, 'u');
// viết thường kiểu ghi chú nhanh "12 smith st": viết tắt đứng cuối câu / trước dấu phẩy / bang / mã bưu điện
const ADDRESS_LOWER = new RegExp(`(?<![\\p{L}\\d])\\d{1,5}[a-z]?[\\s._-]*(?:${W}[\\s._-]+){1,3}(?:st|rd|dr|pl|ave|av|ct|cres|tce|hwy)\\.?(?=\\s*(?:$|[,;)]|\\s(?:nsw|vic|qld|wa|sa|tas|act|nt)\\b|\\s\\d{4}\\b))`, 'iu');
// viết dính kiểu tên tệp: 7SampleAvenue, 7-SampleStreet (chỉ hậu tố dài, để "2 OneDrive" không bị bắt)
const ADDRESS_CAMEL = /\d{1,5}[A-Za-z]?[\s._-]*(?:\p{Lu}\p{Ll}+){1,3}(?:Street|Avenue|Road|Crescent|Parade|Highway|Boulevard|Terrace|Grove|Circuit|Lane|Court|Ave|Rd)(?!\p{Ll})/u;
const ADDR_ALL = [ADDRESS, ADDRESS_WEAK, ADDRESS_LOWER, ADDRESS_CAMEL];
const ADDR_G = ADDR_ALL.map(r => new RegExp(r.source, r.flags + 'g'));
// Từ vựng nghề không phải địa chỉ: "3 m from street", "15 m road frontage", "2 lighting circuit", "2 x street-facing windows",
// "4 bedroom…". Từ đầu tiên sau con số là đơn vị/giới từ/từ chuyên môn → không phải địa chỉ.
const NOT_ADDR_FIRST = /^(m|mm|cm|km|m2|m²|sqm|metres?|meters?|x|by|to|from|of|per|wide|deep|high|long|storey|stories|storeys|levels?|bedrooms?|bed|bath(room)?s?|car|cars|lighting|power|secondary|primary|main|minor|major|lane|lanes|way|ways|sided|side|step|steps|phase|stage|units?|lots?)$/i;
// Từ nghề nhưng cũng là tên đường phổ biến: viết hoa cả tên lẫn hậu tố thì là địa chỉ ("99 Main Street"), trừ mạch điện ("2 Main Circuit").
const STREET_NAME_FIRST = /^(main|high|long|wide|deep|major|minor|lane)$/i;
function realAddress(m) {
  const words = m.replace(/^\d{1,5}[a-z]?[\s._-]*/i, '').split(/[\s._-]+/).filter(Boolean);
  if (!words.length) return false;
  if (NOT_ADDR_FIRST.test(words[0])) {
    const last = words[words.length - 1];
    return STREET_NAME_FIRST.test(words[0]) && /^\p{Lu}/u.test(words[0]) && /^\p{Lu}/u.test(last) && !/^(circuit|cct)$/i.test(last);
  }
  return true;
}
const addrHit = (rs, text) => rs.some(r => { const g = new RegExp(r.source, r.flags.includes('g') ? r.flags : r.flags + 'g'); for (const m of text.matchAll(g)) if (realAddress(m[0])) return true; return false; });
function denyWords(root, cfg) {
  const w = [];
  for (const f of cfg.privacy.denylistFiles) { try { w.push(...readFileSync(resolve(root, f), 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s.length >= 3 && !s.startsWith('#'))); } catch {} }
  return w;
}
// Che địa chỉ, phần căn hộ phía trước ("Unit 3/") và tên suburb phía sau. Giữ lại bang và mã bưu điện.
const STATES = 'NSW|VIC|QLD|WA|SA|TAS|ACT|NT';
const NOT_STATE = String.raw`(?!(?:${STATES})(?![\p{L}\d]))`;
const SUB_WORD = String.raw`${NOT_STATE}[\p{L}'’-]+`;
const SUB_CAP = String.raw`${NOT_STATE}\p{Lu}[\p{L}'’-]*`;
const SEGMENT_END = String.raw`(?=[ \t]*(?:$|[,;.:)|\r\n]))`;
// Thứ tự là ưu tiên; regex có cờ i không dùng được \p{Lu}, nên mẫu viết hoa chỉ có cờ u.
// 1. có bang/mã bưu điện theo sau: chắc là suburb, viết hoa hay thường, có phẩy hay không
const SUBURB_BEFORE_STATE = new RegExp(String.raw`^[ \t]*,?[ \t]*${SUB_WORD}(?:[ \t]+${SUB_WORD}){0,2}(?=[ \t,]*(?:(?:${STATES})(?![\p{L}\d])|\d{4}(?!\d)))`, 'iu');
// 2. sau dấu phẩy, một đoạn ngắn (1–3 từ) rồi hết vế; câu dài thì giữ nguyên
const SUBURB_COMMA_SHORT = new RegExp(String.raw`^[ \t]*,[ \t]*${SUB_WORD}(?:[ \t]+${SUB_WORD}){0,2}${SEGMENT_END}`, 'iu');
// 3. sau dấu phẩy, 1–3 từ viết hoa
const SUBURB_COMMA_CAP = new RegExp(String.raw`^[ \t]*,[ \t]*${SUB_CAP}(?:[ \t]+${SUB_CAP}){0,2}`, 'u');
// 4. không phẩy, 1–2 từ viết hoa
const SUBURB_AFTER = new RegExp(String.raw`^(?:[ \t]+${SUB_CAP}){1,2}`, 'u');
// 5. địa chỉ viết thường toàn bộ, không phẩy: 1–2 từ rồi hết vế (không có chữ hoa để nhận ra suburb)
const SUBURB_LOWER_SHORT = new RegExp(String.raw`^[ \t]+${SUB_WORD}(?:[ \t]+${SUB_WORD})?${SEGMENT_END}`, 'iu');
const UNIT_BEFORE = /(?<![\p{L}\d/])(?:(?:(?:unit|apartment|apt|flat|suite|shop|u)[ \t.]*)?\d{1,5}[a-z]?[ \t]*\/[ \t]*|(?:unit|apartment|apt|flat|suite|shop)[ \t.]*\d{1,5}[a-z]?[ \t]*,?[ \t]*)$/iu;
function suburbLength(rest, lowerAddress) {
  const hit = SUBURB_BEFORE_STATE.exec(rest) || SUBURB_COMMA_SHORT.exec(rest) || SUBURB_COMMA_CAP.exec(rest) || SUBURB_AFTER.exec(rest) || (lowerAddress && SUBURB_LOWER_SHORT.exec(rest));
  return hit ? hit[0].length : 0;
}
// Chỉ dùng khi che (không dùng để từ chối): viết thường, hậu tố ngắn hoặc "drive", có chữ khác theo sau: "99 fakename st testtown".
const ADDRESS_LOWER_BARE = /(?<![\p{L}\d])\d{1,5}[a-z]?[ \t]+(?:[\p{Ll}'’]+[ \t]+){1,3}?(?:st|rd|dr|pl|ct|drive)\.?(?![\p{L}\d])/gu;
// Từ không thể nằm trong tên đường viết thường: giới từ, đơn vị, thời gian, ổ đĩa ("15 minute drive", "2 hard drive", "12 of the pl").
const NOT_LOWER_NAME = /^(m|mm|cm|km|kms|m2|m²|sqm|metres?|meters?|x|by|to|from|of|per|the|a|an|and|or|for|with|in|on|at|into|via|is|are|was|were|this|that|my|your|our|minutes?|mins?|hours?|hrs?|days?|google|one|hard|flash|usb|disk|disc|network|shared|external|thumb|pen|test|belt|chain|wheel|ssd|hdd|cd|dvd|tape|team|cloud|icloud|motor|servo|gear)$/i;
const lowerName = m => !m.replace(/^\d{1,5}[a-z]?\s*/i, '').split(/\s+/).slice(0, -1).some(w => NOT_LOWER_NAME.test(w));
const MASK_STEPS = [[ADDR_G[0]], [ADDR_G[1]], [ADDR_G[2], lowerName], [ADDR_G[3]], [ADDRESS_LOWER_BARE, lowerName]];
function maskAddress(t, re, keep = () => true) {
  let out = '', last = 0;
  for (const m of t.matchAll(re)) {
    if (m.index < last || !keep(m[0])) continue;
    const end = m.index + m[0].length;
    const before = t.slice(last, m.index);
    out += before.slice(0, UNIT_BEFORE.exec(before)?.index ?? before.length) + '«ẩn»';
    last = end + suburbLength(t.slice(end), m[0] === m[0].toLowerCase());
  }
  return out + t.slice(last);
}
// Che thông tin riêng trong văn bản sẽ được ghi ra tệp/chat (đầu ra lệnh kiểm tra, đoạn kế hoạch…).
export function maskPrivate(root, cfg, text) {
  if (!text || typeof text !== 'string') return text;
  let t = text.normalize('NFC'); for (const [r, keep] of MASK_STEPS) t = maskAddress(t, r, keep);
  for (const p of cfg.privacy.patterns) { try { t = t.replace(new RegExp(p, 'gi'), '«ẩn»'); } catch {} }
  // Che cả bản không dấu và bản có dấu nối/gạch/dính liền ("Nguyễn Văn" → "nguyen-van", "NguyenVan"), giống bộ kiểm bên dưới.
  // Không đòi nguyên từ như bộ kiểm: tên trong tên tệp ("bao_gia_Nguyen.pdf") vẫn phải bị che.
  for (const w of denyWords(root, cfg)) t = t.replace(new RegExp(denyBody(w), 'giu'), '«ẩn»');
  return t;
}
const foldDia = s => s.normalize('NFD').replace(/[đĐ]/g, 'd').replace(/\p{M}/gu, '').toLowerCase();
const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// Mục trong danh sách chặn khớp theo NGUYÊN TỪ (không phân biệt dấu): "Mai" không bắt "main", "Hòa" không bắt "hoa don".
// Chữ có dấu trong danh sách khớp đúng dấu đó HOẶC chữ không dấu ("Nguyễn" bắt "Nguyen"), nhưng không bắt dấu khác ("Hòa" không bắt "hóa").
// Khoảng trắng giữa các từ của một mục khớp cả - _ / . hoặc dính liền: tên khách trong tên nhánh git ("work/nguyen-van") cũng bị bắt.
const denyBody = w => String(w).normalize('NFC').trim().split(/\s+/)
  .map(part => [...part].map(ch => { const b = foldDia(ch); return b && b !== ch.toLowerCase() ? `[${escRe(ch)}${escRe(b)}]` : escRe(ch); }).join(''))
  .join('[\\s_/.-]*');
export const denyWordRe = w => {
  const body = denyBody(w);
  return new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'iu');
};
// Dựng bộ kiểm MỘT lần (đọc danh sách chặn, dựng regex) rồi dùng cho nhiều đoạn văn bản — nhanh khi quét cả nghìn dòng.
// opts.address: 'all' (mặc định — sổ lỗi, cổng, báo cáo) | 'strong' (bỏ hậu tố đường "yếu" như Close, Way, Drive, View — dùng khi commit) | 'off'
export function makePrivacyChecker(root, cfg, opts = {}) {
  const allow = (cfg.privacy.allowPatterns || []).map(p => { try { return new RegExp(p, 'giu'); } catch { return null; } }).filter(Boolean);
  const mode = opts.address || 'all';
  const addr = mode === 'off' ? [] : mode === 'strong' ? [ADDRESS, ADDRESS_LOWER, ADDRESS_CAMEL] : ADDR_ALL;
  const pats = cfg.privacy.patterns.map(p => { try { return [p, new RegExp(p, 'i')]; } catch { return null; } }).filter(Boolean);
  // mọi mục chặn gộp thành MỘT regex (nhanh khi danh sách dài và văn bản dài)
  const words = denyWords(root, cfg);
  const deny = words.length ? [new RegExp(words.map(w => denyWordRe(w).source).join('|'), 'iu')] : [];
  return text => {
    if (!text || typeof text !== 'string') return null;
    text = text.normalize('NFC');
    for (const r of allow) text = text.replace(r, ' '); // mẫu được phép (vd. tên đường giả trong dữ liệu thử)
    if (addrHit(addr, text)) return 'có vẻ là địa chỉ nhà';
    for (const [p, r] of pats) if (r.test(text)) return `khớp mẫu riêng tư /${p}/`;
    if (deny.some(r => r.test(text))) return 'chứa một mục trong danh sách chặn (privacy.denylistFiles)';
    return null;
  };
}
export function privacyCheck(root, cfg, text, opts = {}) { return makePrivacyChecker(root, cfg, opts)(text); }

// ---------- stdin của hook ----------
let _sessionId = '';
export async function readStdin() {
  let s = '';
  for await (const chunk of process.stdin) s += chunk;
  let input; try { input = JSON.parse(s || '{}'); } catch { return {}; }
  if (typeof input?.session_id === 'string') _sessionId = input.session_id;
  if (WIN && input && typeof input === 'object') { // đường dẫn trong dữ liệu hook có thể ở dạng Git Bash hoặc \\?\
    if (typeof input.cwd === 'string') input.cwd = nativePath(input.cwd);
    const ti = input.tool_input;
    if (ti && typeof ti === 'object') for (const k of ['file_path', 'notebook_path', 'path']) if (typeof ti[k] === 'string') ti[k] = nativePath(ti[k]);
  }
  return input;
}

// ---------- JSONL / JSON ----------
// Dòng hỏng không làm văng hook; số dòng hỏng nằm ở rows.bad — CLI phải TỪ CHỐI ghi/đạt khi có dòng hỏng.
export function readJsonl(p) {
  const rows = []; rows.bad = [];
  if (!existsSync(p)) return rows;
  stripBom(readFileSync(p, 'utf8')).split('\n').forEach((l, i) => {
    if (!l.trim()) return;
    try { const o = JSON.parse(l); if (o && typeof o === 'object' && !Array.isArray(o)) rows.push(o); else rows.bad.push(i + 1); } catch { rows.bad.push(i + 1); }
  });
  return rows;
}
export function writeJsonl(p, rows) { writeFileSync(p, rows.map(r => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : '')); }
export function appendJsonl(p, row) { mkdirSync(dirname(p), { recursive: true }); appendFileSync(p, JSON.stringify(row) + '\n'); }
export function readJson(p, fallback) { try { return readJsonFile(p); } catch { return fallback; } }
export function writeJson(p, v) { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); }
export const mtime = p => { try { return statSync(p).mtimeMs; } catch { return 0; } };
export const nowIso = () => new Date().toISOString();

// reason (nếu có): lý do hỏi/chặn, chỉ lưu nhãn kiểu ngắn — không lưu nguyên văn.
const REASON_TAGS = [[/riêng tư|địa chỉ/i, 'thông tin khách'], [/push|đẩy/i, 'git push'], [/triển khai|deploy|TRANG THẬT|bản xem trước/i, 'triển khai'], [/cơ sở dữ liệu|SQL|migration|D1|bí mật\/dữ liệu/i, 'cơ sở dữ liệu'],
  [/biến|lệnh con/i, 'đường dẫn dùng biến'], [/ngoài thư mục dự án/i, 'xóa ngoài app'], [/tệp bí mật|khóa\/đăng nhập/i, 'tệp bí mật'], [/thư mục riêng/i, 'thư mục riêng'], [/thư mục trao đổi/i, 'thư mục trao đổi'],
  [/sổ|Mission Kit|kit/i, 'sổ/kit'], [/protect|vùng/i, 'vùng bảo vệ']];
export function hookLog(root, event, msg, reason) {
  const row = { t: nowIso(), event, msg };
  if (_sessionId) row.sid = _sessionId;
  if (reason) row.tag = REASON_TAGS.find(([re]) => re.test(reason))?.[1] || 'khác';
  try { appendJsonl(mpath(root, 'state', 'hooks.log.jsonl'), row); } catch {}
}
// Cài cả toàn máy lẫn trong app: bản TRONG APP luôn chạy. Chỉ bản TOÀN MÁY mới nhường, và chỉ khi app
// đang mở thật sự khai hook của kit trong settings (tránh hook chạy hai lần). Không chắc → chạy (thà hỏi hai lần còn hơn tắt).
export function deferToOtherKit() {
  const norm = p => { try { p = realpathSync.native(p); } catch {} return WIN ? p.toLowerCase() : p; };
  const globalKit = resolve(process.env.CLAUDE_CONFIG_DIR || resolve(homedir(), '.claude'), 'mission-kit');
  if (norm(KIT_DIR) !== norm(globalKit)) return false;
  const pd = process.env.CLAUDE_PROJECT_DIR;
  if (!pd || !existsSync(resolve(pd, '.claude', 'mission-kit', 'lib.mjs'))) return false;
  if (norm(resolve(pd, '.claude', 'mission-kit')) === norm(KIT_DIR)) return false;
  for (const f of ['settings.local.json', 'settings.json']) {
    try { if (/\.claude[\/]+mission-kit[\/]+hooks[\/]+guard-bash/.test(readFileSync(resolve(pd, '.claude', f), 'utf8').replace(/\\/g, '/'))) return true; } catch {}
  }
  return false;
}
export function out(obj) { process.stdout.write(JSON.stringify(obj)); process.exit(0); }
export { isAbsolute };
