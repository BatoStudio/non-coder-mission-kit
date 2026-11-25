// Kết quả kiểm tra / cổng chất lượng còn hiệu lực không?
// Dùng DẤU VÂN TAY NỘI DUNG của các tệp nguồn (không dựa vào commit hay giờ sửa):
//  - commit sau khi kiểm tra không làm kết quả bị coi là cũ (nội dung không đổi)
//  - sửa rồi commit (kể cả nhiều commit) mà không chạy lại → vân tay khác → CŨ
import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, readlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { readJson, mpath, lsFiles, gitInfo, matchAny, maskPrivate } from './lib.mjs';

// Vùng theo dõi: stopGate.watch; để trống = MỌI tệp git đang quản lý. Luôn trừ .mission/** và protect.deny.
export function watchedFiles(root, cfg, globs = cfg.stopGate.watch) {
  return lsFiles(root)
    .filter(f => f && !/^\.mission\//i.test(f) && !matchAny(f, cfg.protect.deny) && (!globs.length || matchAny(f, globs))).sort();
}
export const isWatched = (cfg, f) => !/^\.mission\//i.test(f) && !matchAny(f, cfg.protect.deny) && (!cfg.stopGate.watch.length || matchAny(f, cfg.stopGate.watch));
export const checksHash = cfg => createHash('sha1').update(JSON.stringify(cfg.checks.full)).digest('hex').slice(0, 12);
// Nội dung dùng để tính vân tay: tệp chữ bỏ \r (CRLF ở Windows = LF ở máy khác), tệp nhị phân giữ nguyên.
const UTF8 = new TextDecoder('utf-8', { fatal: true });
function contentOf(root, f) {
  const p = resolve(root, f);
  if (lstatSync(p).isSymbolicLink()) return Buffer.from('symlink:' + readlinkSync(p));
  const b = readFileSync(p);
  if (b.includes(0)) return b;
  try { UTF8.decode(b); } catch { return b; } // không phải UTF-8 hợp lệ → coi là nhị phân, giữ nguyên byte
  return Buffer.from(b.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
}
export function fingerprint(root, files) {
  const h = createHash('sha1');
  for (const f of [...files].sort()) {
    h.update(f + '\0');
    try { h.update(createHash('sha1').update(contentOf(root, f)).digest('hex')); } catch { h.update('<thiếu>'); }
    h.update('\n');
  }
  return h.digest('hex').slice(0, 16);
}
// Vân tay theo từng tệp, để nói được tệp nào đã đổi
export function fileHashes(root, files) {
  const o = {};
  for (const f of files) { try { o[f] = createHash('sha1').update(contentOf(root, f)).digest('hex').slice(0, 12); } catch { o[f] = null; } }
  return o;
}

export function checkFreshness(root, cfg) {
  const lc = readJson(mpath(root, 'state', 'last-check.json'), null);
  const files = watchedFiles(root, cfg);
  const { changed } = gitInfo(root);
  const dirtyWatched = changed.filter(f => isWatched(cfg, f));
  if (!lc) return { lc: null, fresh: false, why: 'chưa chạy', dirtyWatched, touched: [] };
  if (!lc.fp) return { lc, fresh: false, why: 'kết quả cũ không có vân tay — chạy lại check --full', dirtyWatched, touched: [] };
  if (lc.checks && lc.checks !== checksHash(cfg)) return { lc, fresh: false, why: 'checks.full trong config đã đổi sau lần kiểm tra', dirtyWatched, touched: [] };
  const now = fileHashes(root, files);
  const before = lc.files || {};
  const touched = [...new Set([...Object.keys(now), ...Object.keys(before)])].filter(f => now[f] !== before[f] || now[f] === null); // tệp không đọc được = coi như đã đổi
  return { lc, fresh: touched.length === 0, why: touched.length ? `${touched.length} tệp đổi sau lần kiểm tra (vd. ${maskPrivate(root, cfg, touched.slice(0, 3).join(', '))})` : '', touched, dirtyWatched };
}

// Các bước đỏ đã được ghi nhận bằng mục ledger mở (category blocker/attention, loc = "check:<tên bước>")
export function acknowledgedFailures(lc, ledger) {
  if (!lc || lc.ok) return { all: true, missing: [] };
  const acked = new Set(ledger.filter(e => !['fixed', 'wontfix'].includes(e.status) && ['blocker', 'attention'].includes(e.category) && /^check:/.test(e.loc || '')).map(e => e.loc.slice(6)));
  const missing = (lc.failed || []).filter(n => !acked.has(n));
  return { all: missing.length === 0, missing };
}
