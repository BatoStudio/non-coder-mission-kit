// LỖI 11 — chống mất dữ liệu quan trọng: danh sách protect.important, đếm tệp, tìm junction/symlink, mốc giữa các phiên.
// Mọi lần duyệt thư mục: dùng lstat/Dirent, KHÔNG BAO GIỜ đi vào junction/symlink; có trần số mục và thời gian; lỗi → trả kết quả «chưa quét hết».
import { readdirSync, lstatSync, readlinkSync, readFileSync, writeFileSync, mkdirSync, existsSync, renameSync } from 'node:fs';
import { resolve, join, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { WIN, globToRegex, mpath } from './lib.mjs';

const GLOB = /[*?[\]{}]/;
const fwd = p => String(p).replace(/\\/g, '/');
const key = p => { const s = fwd(resolve(p)).replace(/\/+$/, ''); return WIN ? s.toLowerCase() : s; };
export const within = (child, parent) => { const c = key(child), p = key(parent); return c === p || c.startsWith(p + '/'); };
// Thư mục chứa các app thật: biến môi trường MISSION_APPS_ROOT (nhiều thư mục cách nhau bằng ;), mặc định D:\APPS.
// Nhận cả dạng D:\, D:/ và /d/ (Git Bash).
const normDrive = p => fwd(p).replace(/^\/\/\?\//, '').replace(/^\/([a-z])(?=\/|$)/i, '$1:').replace(/\/+$/, '').toLowerCase();
export const APPS_ROOTS = String(process.env.MISSION_APPS_ROOT || 'D:\\APPS').split(';').map(s => s.trim()).filter(Boolean);
export const isRealAppsPath = p => { const n = normDrive(p); return APPS_ROOTS.some(r => { const k = normDrive(r); return n === k || n.startsWith(k + '/'); }); };
export const fmtBytes = n => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : n < 1073741824 ? `${(n / 1048576).toFixed(1)} MB` : `${(n / 1073741824).toFixed(2)} GB`;
export const fmtCount = c => `${c.truncated ? 'hơn ' : ''}${c.files} tệp (${fmtBytes(c.bytes)})`;
export const linkTarget = p => { try { return readlinkSync(p).replace(/^\\\\\?\\/, ''); } catch { return ''; } };

// protect.important → các mục CÓ THẬT trên đĩa: [{ rel, abs, isDir }]. Hỗ trợ ký tự đại diện trong từng đoạn (tests/pdf-library*/).
export function importantEntries(root, cfg) {
  const out = [], seen = new Set();
  for (const g of [].concat(cfg?.protect?.important || [])) {
    const pat = fwd(g).replace(/^\.\//, '').replace(/\/+$/, '').replace(/\/\*\*$/, '');
    if (!pat || pat.startsWith('..') || /^([a-z]:)?\//i.test(pat)) continue;
    let cands = [{ abs: resolve(root), rel: '' }];
    for (const seg of pat.split('/')) {
      const next = [];
      if (GLOB.test(seg)) {
        let re; try { re = globToRegex(seg); } catch { cands = []; break; }
        for (const c of cands) { let names = []; try { names = readdirSync(c.abs); } catch {} for (const n of names) if (re.test(n)) next.push({ abs: join(c.abs, n), rel: c.rel ? c.rel + '/' + n : n }); }
      } else for (const c of cands) next.push({ abs: join(c.abs, seg), rel: c.rel ? c.rel + '/' + seg : seg });
      cands = next;
    }
    for (const c of cands) {
      let st; try { st = lstatSync(c.abs); } catch { continue; }
      if (seen.has(key(c.abs))) continue; seen.add(key(c.abs));
      out.push({ rel: c.rel, abs: c.abs, isDir: st.isDirectory() });
    }
  }
  return out;
}

// Duyệt cây bằng lstat. Trả { files, bytes, links:[{path,target,self}], truncated }.
// stopAtLinks: dừng sớm khi đã thấy ≥ n liên kết. Liên kết KHÔNG bao giờ được đi vào.
export function scanTree(abs, { maxEntries = 200000, maxMs = 3000, stopAtLinks = 0, bytes = true } = {}) {
  const res = { files: 0, bytes: 0, links: [], truncated: false };
  const t0 = Date.now(); let seen = 0;
  let st; try { st = lstatSync(abs); } catch { return res; }
  if (st.isSymbolicLink()) { res.links.push({ path: abs, target: linkTarget(abs), self: true }); return res; }
  if (!st.isDirectory()) { res.files = 1; res.bytes = st.size; return res; }
  const stack = [abs];
  while (stack.length) {
    const d = stack.pop(); let ents;
    try { ents = readdirSync(d, { withFileTypes: true }); } catch { res.truncated = true; continue; }
    for (const e of ents) {
      if (++seen > maxEntries || ((seen & 255) === 0 && Date.now() - t0 > maxMs)) { res.truncated = true; return res; }
      const p = join(d, e.name);
      if (e.isSymbolicLink()) { res.links.push({ path: p, target: linkTarget(p) }); if (stopAtLinks && res.links.length >= stopAtLinks) return res; continue; }
      if (e.isDirectory()) { stack.push(p); continue; }
      res.files++;
      if (bytes) { try { res.bytes += lstatSync(p).size; } catch {} }
    }
  }
  return res;
}

// ---------- mốc giữa các phiên ----------
const metric = e => e.kind === 'dir' ? e.files : e.bytes;
export function snapshotImportant(root, cfg) {
  const entries = {}; const t0 = Date.now();
  for (const e of importantEntries(root, cfg)) {
    const left = Math.max(500, 6000 - (Date.now() - t0));
    const c = scanTree(e.abs, { maxEntries: 300000, maxMs: left });
    entries[e.rel + (e.isDir ? '/' : '')] = { kind: e.isDir ? 'dir' : 'file', files: c.files, bytes: c.bytes, ...(c.truncated ? { truncated: true } : {}) };
  }
  return entries;
}
export const STATE_FILE = root => mpath(root, 'state', 'important.json');
// Đọc mốc cũ, so với hiện tại, ghi mốc mới. Có cảnh báo thì GIỮ mốc cũ (cảnh báo không biến mất sau một lần). Trả về các dòng cảnh báo.
export function watchImportant(root, cfg) {
  const f = STATE_FILE(root);
  let prev = null; try { prev = JSON.parse(readFileSync(f, 'utf8')); } catch {}
  const cur = snapshotImportant(root, cfg);
  const pe = prev?.entries && typeof prev.entries === 'object' ? prev.entries : {};
  const warns = [], next = {};
  for (const [k, p] of Object.entries(pe)) {
    const c = cur[k];
    if (!p || p.truncated || !(metric(p) > 0)) continue;
    const now = c ? metric(c) : 0;
    if (c?.truncated) { next[k] = c; continue; }
    if (now === 0 || now < metric(p) * 0.8) {
      next[k] = p;
      const unit = p.kind === 'dir' ? 'tệp' : 'byte';
      warns.push(`⚠ CẢNH BÁO MẤT DỮ LIỆU: «${k}» ${c ? '' : 'không còn thấy nữa — '}trước đây ${p.files} tệp (${fmtBytes(p.bytes)}), bây giờ ${c ? c.files : 0} tệp (${fmtBytes(c ? c.bytes : 0)})` +
        (p.kind === 'file' ? ` — giảm ${Math.round(100 - 100 * now / Math.max(1, metric(p)))}% ${unit}` : ` — ${now === 0 ? 'TRỐNG' : 'giảm ' + Math.round(100 - 100 * now / metric(p)) + '%'}`) + '.');
    }
  }
  for (const [k, c] of Object.entries(cur)) if (!(k in next)) next[k] = c;
  if (warns.length) warns.push('  Việc cần làm ngay: DỪNG ghi/xóa, kiểm tra git status, thùng rác và build/backup/; báo chủ dự án. Nếu việc giảm là chủ ý: xóa .mission/state/important.json để đặt mốc mới. (Phiên vẫn chạy bình thường.)');
  const nextText = JSON.stringify({ v: 1, t: new Date().toISOString(), entries: next }, null, 1) + '\n';
  try { if (!prev || JSON.stringify(prev.entries) !== JSON.stringify(next)) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f + '.tmp', nextText); renameSync(f + '.tmp', f); } } catch {}
  return warns;
}

// ---------- check --full: junction/symlink nguy hiểm trong thư mục tạm của Claude và worktree ----------
function worktreeDirs(root) {
  const dirs = [];
  try {
    const r = spawnSync('git', ['worktree', 'list', '--porcelain'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    for (const l of String(r.stdout || '').split(/\r?\n/)) { const m = /^worktree (.+)$/.exec(l); if (m && key(m[1]) !== key(root)) dirs.push(m[1]); }
  } catch {}
  const w = join(root, '.claude', 'worktrees'); try { for (const n of readdirSync(w)) dirs.push(join(w, n)); } catch {}
  return dirs;
}
export function claudeTempDirs() { return [join(process.env.TEMP || process.env.TMPDIR || tmpdir(), 'claude'), join(tmpdir(), 'claude')]; }
// Trả [{ path, target, hit }] — liên kết có đích là (hoặc chứa) dữ liệu quan trọng của app, hoặc nằm trong thư mục app thật (MISSION_APPS_ROOT).
export function dangerousLinks(root, cfg, { maxMs = 8000 } = {}) {
  const imp = importantEntries(root, cfg);
  const found = []; const t0 = Date.now();
  const judgeLink = p => {
    const target = linkTarget(p); if (!target) return;
    const abs = resolve(dirname(p), target);
    let hit = null;
    if (isRealAppsPath(abs)) hit = APPS_ROOTS.join(';');
    for (const e of imp) if (!hit && (within(abs, e.abs) || within(e.abs, abs))) hit = e.rel + (e.isDir ? '/' : '');
    if (hit) found.push({ path: p, target: abs, hit });
  };
  const seenRoots = new Set();
  for (const r0 of [...claudeTempDirs(), ...worktreeDirs(root)]) {
    if (seenRoots.has(key(r0)) || !existsSync(r0)) continue; seenRoots.add(key(r0));
    const stack = [[r0, 0]]; let n = 0;
    while (stack.length) {
      const [d, depth] = stack.pop(); let ents; try { ents = readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const e of ents) {
        if (++n > 100000 || ((n & 255) === 0 && Date.now() - t0 > maxMs)) { stack.length = 0; break; }
        const p = join(d, e.name);
        if (e.isSymbolicLink()) { judgeLink(p); continue; }
        if (e.isDirectory() && depth < 8 && e.name !== '.git' && e.name !== 'node_modules') stack.push([p, depth + 1]);
      }
    }
  }
  return found;
}
