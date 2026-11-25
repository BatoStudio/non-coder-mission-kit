// Tính tình trạng nhiệm vụ từ dữ liệu thật: manifest, gates, ledger, kiểm tra, git, sản phẩm.
import { resolve } from 'node:path';
import { existsSync, lstatSync } from 'node:fs';
import { readJson, readJsonl, mpath, gitInfo, git, mtime, matchAny, maskPrivate } from './lib.mjs';
import { checkFreshness, watchedFiles, fingerprint } from './check-core.mjs';

export const STATUSES = ['open', 'fixed', 'wontfix'];
export const CATEGORIES = ['defect', 'attention', 'blocker', 'sweep'];
export const isOpen = e => !['fixed', 'wontfix'].includes(e.status); // mọi trạng thái lạ đều coi là còn mở

export function loadState(root) {
  return {
    manifest: (m => ({ ...m, units: Array.isArray(m?.units) ? m.units : [] }))(readJson(mpath(root, 'manifest.json'), { units: [] })),
    gates: readJson(mpath(root, 'gates.json'), {}),
    ledger: readJsonl(mpath(root, 'ledger.jsonl')),
  };
}

// Cổng áp cho một đơn vị: units[].gates (danh sách id) nếu nhóm có khai, không thì toàn bộ.
export function gatesFor(cfg, unit) {
  const grp = cfg.units.find(g => g.name === unit?.group);
  const ids = grp?.gates ? [].concat(grp.gates) : cfg.gates.map(g => g.id);
  return cfg.gates.filter(g => ids.includes(g.id));
}

// Cổng bị coi là CŨ nếu nội dung tệp của đơn vị (đơn vị dạng tệp) hoặc toàn vùng theo dõi (đơn vị dạng danh sách)
// khác với lúc chấm. Bản ghi cũ không có vân tay → coi là cũ.
// Tệp của đơn vị: nguồn/đích (đơn vị dạng tệp); units[].files (glob khoanh vùng cho nhóm dạng danh sách); không có thì cả vùng theo dõi.
function groupOf(cfg, unit) { return cfg.units.find(g => g.name === unit?.group); }
export function unitFiles(root, cfg, unit) {
  if (unit?.source) return [unit.source, unit.target].filter((v, i, a) => v && a.indexOf(v) === i);
  const files = groupOf(cfg, unit)?.files;
  return files ? watchedFiles(root, cfg, [].concat(files)) : watchedFiles(root, cfg);
}
const _fp = new Map();
export function unitFingerprint(root, cfg, unit) {
  const k = unit?.source ? unit.id : (groupOf(cfg, unit)?.files ? 'grp:' + unit.group : '*');
  if (!_fp.has(k)) _fp.set(k, fingerprint(root, unitFiles(root, cfg, unit)));
  return _fp.get(k);
}
export function gateStale(root, cfg, unit, rec) {
  if (!rec) return false;
  if (!rec.fp) return true;
  return rec.fp !== unitFingerprint(root, cfg, unit);
}

export function unitVerdict(cfg, st, unitId, root = null) {
  const unit = (st.manifest.units || []).find(u => u.id === unitId);
  const blocking = st.ledger.filter(e => e.unit === unitId && isOpen(e) && e.category !== 'sweep' && cfg.blockingSeverities.includes(e.severity));
  const ids = gatesFor(cfg, unit).map(x => x.id);
  const noTarget = unit?.targetExists === false;
  const noGates = ids.length === 0; // nhóm không có cổng nào thì không thể «đạt»
  const g = st.gates[unitId] || {};
  const missing = ids.filter(id => !g[id]);
  const failed = ids.filter(id => g[id]?.status === 'FAIL');
  const stale = root ? ids.filter(id => g[id] && g[id].status !== 'FAIL' && gateStale(root, cfg, unit, g[id])) : [];
  const verdict = failed.length || blocking.length || noTarget || noGates || !unit ? 'FAIL' : (missing.length || stale.length) ? 'PENDING' : 'PASS';
  return { verdict, blocking, missing, failed, stale, noTarget, noGates, ids };
}

export function summary(root, cfg) {
  const st = loadState(root);
  const units = st.manifest.units || [];
  const sev = Object.fromEntries(cfg.severities.map(s => [s, { open: 0, fixed: 0 }]));
  for (const e of st.ledger) if (sev[e.severity] && e.category !== 'sweep') sev[e.severity][isOpen(e) ? 'open' : 'fixed']++;
  const verdicts = { PASS: 0, FAIL: 0, PENDING: 0 };
  const vOf = {};
  for (const u of units) { const v = unitVerdict(cfg, st, u.id, root).verdict; vOf[u.id] = v; verdicts[v]++; }
  // Chỉ đếm «có sản phẩm» khi đơn vị có tệp đích và tệp đó tồn tại. Đơn vị dạng danh sách (không có tệp đích)
  // không được coi là xong chỉ vì không có gì để thiếu: % hoàn thành của nó lấy theo cổng (PASS = 100, còn lại 0).
  const present = units.filter(u => u.targetExists === true).length;
  const noTargetKind = units.filter(u => u.targetExists === undefined || u.targetExists === null).length;
  const completion = units.length ? units.reduce((a, u) => a + (u.completion ?? (u.targetExists === true ? 100 : u.targetExists === false ? 0 : (vOf[u.id] === 'PASS' ? 100 : 0))), 0) / units.length : 0;
  const fresh = checkFreshness(root, cfg);
  // sản phẩm cũ nếu có tệp trong vùng theo dõi mới hơn nó
  let newestSrc = 0; for (const f of watchedFiles(root, cfg)) { try { const t = lstatSync(resolve(root, f)).mtimeMs; if (t > newestSrc) newestSrc = t; } catch {} }
  const deliverables = cfg.deliverables.filter(d => d && typeof d.path === 'string' && d.path).map(d => {
    const p = resolve(root, d.path); const t = mtime(p);
    return { ...d, exists: existsSync(p), t, stale: t > 0 && newestSrc > t };
  });
  const blockers = st.ledger.filter(e => isOpen(e) && e.category === 'blocker');
  const badDeliverables = cfg.deliverables.filter(d => !(d && typeof d.path === 'string' && d.path)).length;
  return { st, units, sev, verdicts, present, noTargetKind, completion, deliverables, badDeliverables, blockers, fresh };
}

export function statusLines(root, cfg, opts) { return statusLinesRaw(root, cfg, opts).map(l => maskPrivate(root, cfg, l)); }
// «Phiên này» = session_id của dòng log mới nhất; log cũ không có session_id thì tính 12 giờ gần nhất.
function hookSessionLine(root) {
  const all = readJsonl(mpath(root, 'state', 'hooks.log.jsonl'));
  const sid = all.at(-1)?.sid;
  const since = Date.now() - 12 * 3600e3;
  const rows = all.filter(r => (sid ? r.sid === sid : Date.parse(r.t) >= since) && /^guard-/.test(r.event || ''));
  const asks = rows.filter(r => /^ask\b/.test(r.msg || '')), denies = rows.filter(r => /^deny\b/.test(r.msg || ''));
  const kinds = {}; for (const r of asks) { const k = r.tag || r.event; kinds[k] = (kinds[k] || 0) + 1; }
  const list = Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}×${n}`).join(', ');
  return `Hook phiên này: hỏi ${asks.length} lần${list ? ` (kiểu: ${list})` : ''}, chặn ${denies.length} lần`;
}
function statusLinesRaw(root, cfg, { short = false } = {}) {
  const s = summary(root, cfg);
  const g = gitInfo(root);
  const L = [];
  L.push(g.isRepo ? `Git: nhánh ${g.branch} @ ${g.head}; ${g.changed.length} tệp chưa commit (chế độ ${cfg.git.mode})` : 'Git: (không phải repo)');
  L.push(`Phạm vi: ${s.units.length} đơn vị; có sản phẩm ${s.present}/${s.units.length - s.noTargetKind}${s.noTargetKind ? ` (+${s.noTargetKind} đơn vị không có tệp đích, tính xong theo cổng)` : ''}; hoàn thành TB ${s.completion.toFixed(0)}%`);
  L.push(`Cổng chất lượng: PASS ${s.verdicts.PASS} · FAIL ${s.verdicts.FAIL} · CHƯA XONG ${s.verdicts.PENDING}`);
  if (s.st.ledger.bad?.length) L.push(`⚠ ledger.jsonl có ${s.st.ledger.bad.length} dòng hỏng (dòng ${s.st.ledger.bad.join(', ')}) — done sẽ không đạt cho tới khi sửa.`);
  L.push('Lỗi (mở/đã đóng): ' + Object.entries(s.sev).map(([k, v]) => `${k} ${v.open}/${v.fixed}`).join(' · '));
  const lc = s.fresh.lc;
  L.push(lc ? `Kiểm tra đầy đủ: ${lc.ok ? 'XANH' : 'ĐỎ (' + lc.failed.join(', ') + ')'} lúc ${lc.t.slice(0, 16)} @ ${lc.head}${s.fresh.fresh ? '' : ' — CŨ: ' + s.fresh.why}` : 'Kiểm tra đầy đủ: chưa chạy');
  for (const d of s.deliverables) L.push(`Sản phẩm ${d.path}: ${d.exists ? (d.stale ? 'có nhưng CŨ hơn nguồn' : 'có') : 'CHƯA CÓ'}`);
  if (s.blockers.length) L.push(`Vướng mắc mở: ${s.blockers.map(b => b.id + ' ' + (b.why || '').slice(0, 60)).join('; ')}`);
  if (!short) {
    L.push(hookSessionLine(root));
    const openTop = s.st.ledger.filter(e => isOpen(e) && e.category !== 'sweep').sort((a, b) => cfg.severities.indexOf(a.severity) - cfg.severities.indexOf(b.severity)).slice(0, 10);
    if (openTop.length) { L.push('', 'Lỗi mở ưu tiên cao nhất:'); for (const e of openTop) L.push(`  ${e.id} [${e.severity}] ${e.unit || ''} ${e.loc || ''} — ${(e.why || '').slice(0, 90)}`); }
  }
  return L;
}
