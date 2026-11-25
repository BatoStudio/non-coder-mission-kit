// Đo «độ gọn» của mã: tệp dài, hàm dài, khối mã lặp, tên định nghĩa trùng (xung đột).
// Chỉ đọc, không sửa gì. Dùng cho quy trình dọn mã (/mission-tidy): đo trước, đo sau, so sánh.
//
// config.tidy (mọi khóa đều có mặc định):
//   include       glob tệp mã cần đo
//   exclude       glob bỏ qua (thêm vào danh sách mặc định: node_modules, build, dist, *.min.js…)
//   maxFileLines  tệp dài hơn → «tệp dài» (mặc định 400)
//   maxFuncLines  hàm dài hơn → «hàm dài» (mặc định 80)
//   minDupLines   khối lặp ngắn nhất, tính theo dòng có nội dung (mặc định 8)
//   sharedScope   nhóm tệp chạy chung một phạm vi (build ghép tệp, hoặc nhiều <script> không phải module).
//                 Mỗi phần tử là một glob hoặc mảng glob = một nhóm. Tên định nghĩa ở cấp ngoài cùng trùng nhau
//                 trong cùng nhóm là XUNG ĐỘT thật: bản nạp sau âm thầm đè bản trước.
import { globToRegex } from './lib.mjs';

export const TIDY_DEFAULTS = {
  include: ['**/*.{js,mjs,cjs,ts,tsx,jsx,py,css}'],
  exclude: [],
  maxFileLines: 400, maxFuncLines: 80, minDupLines: 8,
  sharedScope: [],
  onEdit: true, // hook sau khi sửa: cảnh báo trùng tên / khối lặp dính tới tệp vừa sửa (false = tắt)
};
const ALWAYS_EXCLUDE = ['**/node_modules/**', '**/vendor/**', '**/dist/**', 'build/**', '**/*.min.{js,css}', '.mission/**', '.claude/**', '**/__pycache__/**', '**/*.d.ts', '**/package-lock.json'];

export function tidyConfig(cfg) {
  const t = { ...TIDY_DEFAULTS, ...((cfg && cfg.tidy) || {}) };
  const arr = v => (Array.isArray(v) ? v : v ? [v] : []);
  t.include = arr(t.include); t.exclude = arr(t.exclude);
  t.sharedScope = arr(t.sharedScope).map(g => arr(g)).filter(g => g.length);
  for (const k of ['maxFileLines', 'maxFuncLines', 'minDupLines']) { const n = Number(t[k]); t[k] = Number.isFinite(n) && n > 0 ? n : TIDY_DEFAULTS[k]; }
  return t;
}

export function tidyFiles(all, t) {
  const inc = t.include.map(globToRegex), exc = [...ALWAYS_EXCLUDE, ...t.exclude].map(globToRegex);
  return all.filter(f => inc.some(r => r.test(f)) && !exc.some(r => r.test(f)));
}

const lang = f => (/\.py$/i.test(f) ? 'py' : /\.css$/i.test(f) ? 'css' : 'js');

// Bỏ chuỗi và chú thích để đếm ngoặc / so khối lặp không bị đánh lừa. Giữ nguyên số dòng.
function stripJs(text) {
  let out = '', i = 0, st = null; // st: ' " ` / (regex không xử lý: hiếm khi có ngoặc lệch)
  while (i < text.length) {
    const c = text[i], n = text[i + 1];
    if (!st) {
      if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (c === '/' && n === '*') { i += 2; while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) { if (text[i] === '\n') out += '\n'; i++; } i += 2; continue; }
      if (c === '"' || c === "'" || c === '`') { st = c; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (c === '\\') { i += 2; continue; }
    if (c === '\n') { out += '\n'; if (st !== '`') st = null; i++; continue; }
    if (c === st) { out += c; st = null; i++; continue; }
    i++;
  }
  return out;
}
const stripPy = text => text.split('\n').map(l => l.replace(/#.*$/, '')).join('\n');
const stripCss = text => text.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''));
const strip = (f, text) => (lang(f) === 'py' ? stripPy(text) : lang(f) === 'css' ? stripCss(text) : stripJs(text));

const JS_FUNC = [
  /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)\s*\(/,
  /^\s*(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>|[A-Za-z_$][\w$]*\s*=>)/,
  /^\s*([A-Za-z_$][\w$]*)\s*[:=]\s*(?:async\s+)?(?:function\b|\([^)]*\)\s*=>)/,
  /^\s+(?:static\s+)?(?:async\s+)?([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{\s*$/,
];
const NOT_FUNC = new Set(['if', 'for', 'while', 'switch', 'catch', 'return', 'function', 'else', 'do', 'try', 'with']);

function longFunctions(f, raw, clean, maxLen) {
  const lines = clean.split('\n'), res = [];
  if (lang(f) === 'py') {
    lines.forEach((l, i) => {
      const m = /^(\s*)(?:async\s+)?def\s+(\w+)/.exec(l); if (!m) return;
      const ind = m[1].length; let j = i + 1, last = i;
      for (; j < lines.length; j++) { const s = lines[j]; if (!s.trim()) continue; if (s.length - s.trimStart().length <= ind) break; last = j; }
      const len = last - i + 1; if (len > maxLen) res.push({ path: f, line: i + 1, name: m[2], len });
    });
    return res;
  }
  if (lang(f) === 'css') return res;
  lines.forEach((l, i) => {
    let name = null;
    for (const re of JS_FUNC) { const m = re.exec(l); if (m && !NOT_FUNC.has(m[1])) { name = m[1]; break; } }
    if (!name) return;
    // tìm «{» mở thân hàm trong 3 dòng đầu, rồi đếm ngoặc tới khi đóng
    let depth = 0, opened = false;
    for (let j = i; j < lines.length; j++) {
      for (const c of lines[j]) { if (c === '{') { depth++; opened = true; } else if (c === '}') depth--; }
      if (!opened && j - i >= 3) return;
      if (opened && depth <= 0) { const len = j - i + 1; if (len > maxLen) res.push({ path: f, line: i + 1, name, len }); return; }
    }
  });
  // hàm lồng trong hàm dài cũng bị đếm: giữ cả hai, vì cả hai đều đáng chia nhỏ
  return res;
}

// Định nghĩa ở cấp ngoài cùng (thụt đầu dòng 0): đủ cho tệp được ghép lại hoặc nạp bằng <script>.
function topDefs(f, clean) {
  const res = [];
  const lines = clean.split('\n');
  lines.forEach((l, i) => {
    let m;
    if (lang(f) === 'py') m = /^(?:async\s+)?(def|class)\s+(\w+)/.exec(l); // biến cấp ngoài gán lại là chuyện thường trong Python: không tính
    else if (lang(f) === 'js') m = /^(?:export\s+)?(?:default\s+)?(?:async\s+)?(function|class)\s*\*?\s*([A-Za-z_$][\w$]*)/.exec(l) || /^(?:export\s+)?(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=/.exec(l);
    if (m && m[1] === 'function' && /\.[mc]?tsx?$/i.test(f) && overloadSig(lines, i)) return; // chữ ký overload TypeScript: không phải định nghĩa
    if (m) res.push({ path: f, line: i + 1, kind: m[1], name: m[2] });
  });
  return res;
}

// Chữ ký overload TypeScript (`function f(a: string): string;`): không có thân — sau danh sách tham số gặp `;` trước `{`.
// Kiểu trả về là object (`): { a: 1 };`) gặp `{` trước → coi là có thân (thà báo thừa còn hơn bỏ sót xung đột thật).
function overloadSig(lines, i) {
  const s = lines.slice(i, i + 40).join('\n');
  let k = s.indexOf('('), depth = 0, params = false;
  if (k < 0) return false;
  for (; k < s.length; k++) {
    const c = s[k];
    if (c === '(' || c === '[') depth++;
    else if (c === ')' || c === ']') { depth--; if (depth === 0) params = true; }
    else if (depth === 0 && params && c === ';') return true;
    else if (depth === 0 && c === '{') return false;
  }
  return false;
}

// Khối lặp: so các cửa sổ minDupLines dòng có nội dung (đã bỏ chú thích, gộp khoảng trắng).
function dupBlocks(files, minLines) {
  const norm = files.map(({ path, clean }) => {
    const rows = [];
    clean.split('\n').forEach((l, i) => { const s = l.trim().replace(/\s+/g, ' '); if (s.length > 2 && !/^[{}()\[\];,]+$/.test(s)) rows.push({ s, line: i + 1 }); });
    return { path, rows };
  });
  const seen = new Map(); // hash cửa sổ → [{fi, wi}]
  norm.forEach(({ rows }, fi) => {
    for (let wi = 0; wi + minLines <= rows.length; wi++) {
      const w = rows.slice(wi, wi + minLines).map(r => r.s);
      if (w.join('').length < 160) continue; // bỏ khối quá vụn (toàn dấu ngoặc, break, return…)
      const key = w.join('\n');
      if (!seen.has(key)) seen.set(key, []);
      seen.get(key).push({ fi, wi });
    }
  });
  // đánh dấu cửa sổ có ở nơi khác, gộp các cửa sổ liền nhau thành một vùng
  const flagged = norm.map(() => new Map());
  for (const [key, places] of seen) if (places.length > 1) for (const p of places) flagged[p.fi].set(p.wi, key);
  const regions = [];
  flagged.forEach((m, fi) => {
    const idx = [...m.keys()].sort((a, b) => a - b);
    for (let k = 0; k < idx.length;) {
      let e = k; while (e + 1 < idx.length && idx[e + 1] === idx[e] + 1) e++;
      const rows = norm[fi].rows, a = idx[k], b = idx[e] + minLines - 1;
      regions.push({ path: norm[fi].path, line: rows[a].line, endLine: rows[b].line, size: b - a + 1, key: m.get(idx[k]) });
      k = e + 1;
    }
  });
  // nhóm các vùng theo cửa sổ đầu tiên chung
  const groups = new Map();
  for (const r of regions) { if (!groups.has(r.key)) groups.set(r.key, []); groups.get(r.key).push(r); }
  const out = [...groups.values()].filter(g => g.length > 1).map(g => ({ size: Math.max(...g.map(r => r.size)), places: g.map(({ path, line, endLine }) => ({ path, line, endLine })) }));
  out.sort((a, b) => b.size * b.places.length - a.size * a.places.length);
  const dupLines = regions.reduce((a, r) => a + r.size, 0);
  return { blocks: out, dupLines };
}

// files: [{ path, text }]
export function tidyScan(files, t) {
  const prepared = [], skipped = [];
  for (const { path, text } of files) {
    const lines = text.split('\n');
    if (text.length > 2_000_000 || (lines.length && text.length / lines.length > 300)) { skipped.push(path); continue; } // tệp nén / sinh tự động
    prepared.push({ path, text, clean: strip(path, text), lines: lines.length });
  }
  const fileStats = prepared.map(p => ({ path: p.path, lines: p.lines })).sort((a, b) => b.lines - a.lines);
  const longFiles = fileStats.filter(f => f.lines > t.maxFileLines);
  const longFuncs = prepared.flatMap(p => longFunctions(p.path, p.text, p.clean, t.maxFuncLines)).sort((a, b) => b.len - a.len);
  const { blocks, dupLines } = dupBlocks(prepared, t.minDupLines);

  // xung đột tên: cùng tệp luôn tính; khác tệp chỉ tính trong cùng một nhóm sharedScope
  const defs = prepared.filter(p => lang(p.path) !== 'css').flatMap(p => topDefs(p.path, p.clean));
  const scopes = t.sharedScope.map(g => g.map(globToRegex));
  const scopeOf = path => { const i = scopes.findIndex(rs => rs.some(r => r.test(path))); return i >= 0 ? 's' + i : 'f:' + path; };
  const byKey = new Map();
  for (const d of defs) { const k = scopeOf(d.path) + '\0' + d.name; if (!byKey.has(k)) byKey.set(k, []); byKey.get(k).push(d); }
  // gán đè một hàm/lớp đã khai báo (`ten = function…`, `window.ten = …`): cũng là bản sau đè bản trước
  for (const p of prepared) {
    if (lang(p.path) !== 'js') continue;
    const sc = scopeOf(p.path);
    p.clean.split('\n').forEach((l, i) => {
      const m = /^\s*(?:window\.|globalThis\.|self\.)?([A-Za-z_$][\w$]*)\s*=(?![=>])/.exec(l);
      if (!m || /^\s*(?:const|let|var)\b/.test(l)) return;
      const g = byKey.get(sc + '\0' + m[1]);
      if (g && g.some(d => d.kind === 'function' || d.kind === 'class')) g.push({ path: p.path, line: i + 1, kind: 'gán đè', name: m[1] });
    });
  }
  const conflicts = [...byKey.values()].filter(g => g.length > 1).map(g => ({ name: g[0].name, places: g.sort((a, b) => a.path.localeCompare(b.path) || a.line - b.line).map(({ path, line, kind }) => ({ path, line, kind })) }));
  conflicts.sort((a, b) => b.places.length - a.places.length || a.name.localeCompare(b.name));

  return {
    totals: { files: prepared.length, lines: prepared.reduce((a, p) => a + p.lines, 0), longFiles: longFiles.length, longFuncs: longFuncs.length, dupBlocks: blocks.length, dupLines, conflicts: conflicts.length },
    limits: { maxFileLines: t.maxFileLines, maxFuncLines: t.maxFuncLines, minDupLines: t.minDupLines, sharedScope: t.sharedScope },
    longFiles, longFuncs, dupBlocks: blocks, conflicts, skipped, biggest: fileStats.slice(0, 10),
  };
}

const at = p => `${p.path}:${p.line}`;
export function tidyMarkdown(r, { label = '', top = 1e9 } = {}) {
  const L = [`# Đo độ gọn của mã${label ? ' — ' + label : ''}`, '', `- Thời điểm: ${r.t || ''}${r.head ? ' · commit ' + r.head : ''}`,
    `- Ngưỡng: tệp > ${r.limits.maxFileLines} dòng, hàm > ${r.limits.maxFuncLines} dòng, khối lặp ≥ ${r.limits.minDupLines} dòng có nội dung` + (r.limits.sharedScope.length ? `; nhóm chung phạm vi: ${r.limits.sharedScope.map(g => g.join(' + ')).join(' · ')}` : '; chưa khai báo nhóm chung phạm vi (sharedScope) → chỉ tính trùng tên trong cùng tệp'), '',
    '| Chỉ số | Giá trị |', '| --- | --- |',
    `| Tệp mã đã đo | ${r.totals.files} (${r.totals.lines} dòng) |`, `| Tệp dài | ${r.totals.longFiles} |`, `| Hàm dài | ${r.totals.longFuncs} |`,
    `| Nhóm khối lặp | ${r.totals.dupBlocks} (${r.totals.dupLines} dòng nằm trong khối lặp) |`, `| Tên định nghĩa trùng (xung đột) | ${r.totals.conflicts} |`, ''];
  const sec = (title, rows, fmt) => { L.push(`## ${title}`, ''); if (!rows.length) L.push('(không có)'); rows.slice(0, top).forEach(x => L.push('- ' + fmt(x))); if (rows.length > top) L.push(`- … và ${rows.length - top} mục nữa (xem tệp .md đầy đủ)`); L.push(''); };
  sec('Tên định nghĩa trùng (bản nạp sau đè bản trước)', r.conflicts, c => `\`${c.name}\`: ${c.places.map(p => `${at(p)} (${p.kind})`).join(' · ')}`);
  sec('Khối mã lặp', r.dupBlocks, b => `${b.size} dòng × ${b.places.length} nơi: ${b.places.map(p => `${p.path}:${p.line}-${p.endLine}`).join(' · ')}`);
  sec('Hàm dài', r.longFuncs, f => `\`${f.name}\` ${f.len} dòng — ${at(f)}`);
  sec('Tệp dài', r.longFiles, f => `${f.path} — ${f.lines} dòng`);
  if (r.skipped.length) sec('Bỏ qua (tệp nén hoặc sinh tự động)', r.skipped, s => s);
  return L.join('\n');
}

export function tidyCompare(a, b) {
  const keys = [['files', 'Tệp mã'], ['lines', 'Tổng số dòng'], ['longFiles', 'Tệp dài'], ['longFuncs', 'Hàm dài'], ['dupBlocks', 'Nhóm khối lặp'], ['dupLines', 'Dòng trong khối lặp'], ['conflicts', 'Tên trùng (xung đột)']];
  const L = ['| Chỉ số | Trước | Sau | Thay đổi |', '| --- | --- | --- | --- |'];
  let worse = [];
  for (const [k, name] of keys) {
    const x = a.totals[k] ?? 0, y = b.totals[k] ?? 0, d = y - x;
    L.push(`| ${name} | ${x} | ${y} | ${d === 0 ? '0' : (d > 0 ? '+' : '') + d} |`);
    if (d > 0 && !['files', 'lines'].includes(k)) worse.push(name);
  }
  return { table: L.join('\n'), worse };
}

// ---- Kiểm ngay sau khi sửa một tệp (hook post-edit): chỉ những gì DÍNH tới tệp vừa sửa ----
// Mục tiêu: bắt trùng lặp lúc vừa sinh ra, thay vì đợi /mission-tidy dọn sau. Chỉ CẢNH BÁO, không chặn
// (app cũ đã có xung đột sẵn không bị khóa mọi lần sửa).
// Tên chung chung hay lặp hợp lệ giữa các module — không đáng cảnh báo «đã có ở tệp khác».
const COMMON_NAMES = new Set(['main', 'init', 'setup', 'run', 'render', 'handler', 'handle', 'start', 'stop', 'update', 'load', 'save', 'reset', 'test', 'default', 'App', 'index', 'get', 'set', 'create', 'build', 'helper', 'cb', 'fn']);
export const EDIT_SCAN_MAX_BYTES = 3_000_000; // tổng mã lớn hơn → bỏ phần khối lặp (giữ hook nhanh)

// files: [{ path, text }] (đã lọc theo tidyFiles), rel: tệp vừa sửa
export function editIssues(files, t, rel) {
  const me = files.find(f => f.path === rel);
  if (!me) return { conflicts: [], elsewhere: [], dups: [] };
  const r = tidyScan(files.reduce((a, f) => a + f.text.length, 0) > EDIT_SCAN_MAX_BYTES ? files.filter(f => f.path === rel || isSameScope(t, f.path, rel)) : files, t);
  const conflicts = r.conflicts.filter(c => c.places.some(p => p.path === rel));
  const dups = r.dupBlocks.filter(b => b.places.some(p => p.path === rel));
  // tên hàm/lớp cấp ngoài của tệp này đã được định nghĩa cấp ngoài ở tệp KHÁC (ngoài nhóm sharedScope: nhóm đó đã tính ở conflicts)
  const defsOf = f => (lang(f.path) === 'css' ? [] : topDefs(f.path, strip(f.path, f.text)).filter(d => /^(function|class|def)$/.test(d.kind)));
  const mine = defsOf(me).filter(d => !COMMON_NAMES.has(d.name) && d.name.length > 3);
  const elsewhere = [];
  if (mine.length) {
    const names = new Set(mine.map(d => d.name));
    const others = files.filter(f => f.path !== rel && !isSameScope(t, f.path, rel) && lang(f.path) === lang(rel)).flatMap(defsOf).filter(d => names.has(d.name));
    for (const d of mine) { const o = others.filter(x => x.name === d.name); if (o.length) elsewhere.push({ name: d.name, line: d.line, places: o.map(({ path, line }) => ({ path, line })) }); }
  }
  return { conflicts, elsewhere, dups };
}
function isSameScope(t, a, b) {
  return t.sharedScope.some(g => { const rs = g.map(globToRegex); return rs.some(r => r.test(a)) && rs.some(r => r.test(b)); });
}

// LT.md có nhắc tới tệp (hoặc thư mục cha của nó) không? — để nhắc ghi bản đồ khi tạo tệp/tính năng mới.
export function ltMentions(ltText, rel) {
  const txt = String(ltText || '').replace(/\\/g, '/');
  if (txt.includes(rel)) return true;
  // tách thành các «từ» đường dẫn (bỏ dấu ` | ( ) và khoảng trắng), bỏ / cuối: «src/features/upload/» → src/features/upload
  const words = new Set(txt.split(/[\s`|()[\]—,;]+/).map(w => w.replace(/\/+$/, '').replace(/:\d+$/, '')).filter(Boolean));
  const parts = rel.split('/');
  // thư mục gốc chung chung («src») không tính là đã ghi bản đồ cho tệp nằm sâu hơn (src/features/x/a.js)
  for (let i = parts.length - 1; i >= (parts.length > 2 ? 2 : 1); i--) if (words.has(parts.slice(0, i).join('/'))) return true;
  return false;
}
