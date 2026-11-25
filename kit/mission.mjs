#!/usr/bin/env node
// Mission Kit CLI — nguồn sự thật duy nhất cho tiến độ, lỗi và cổng chất lượng.
// Dùng: node "$MISSION_KIT/mission.mjs" <lệnh> [tham số]   (chạy trong thư mục dự án)
//
//   init [--brief <tệp>] [--name <tên>]   tạo .mission/ (config, plan, brief, ledger, gates)
//   status                                tình trạng thật hiện tại
//   scan                                  quét đơn vị nguồn → đích, cập nhật manifest
//   unit set <id> [--completion N] [--note …] [--verified]
//   ledger add --severity S --why … --fix … [--unit U --loc L --category defect|attention|blocker|sweep
//              --source … --before … --after … --verify … --pattern P --status open|fixed|wontfix --by …]
//   ledger close <id> --verify … [--after …] [--status fixed|wontfix] [--by human:<tên>]
//   ledger list [--open] [--unit U] [--severity S] [--pattern P]
//   ledger repair                         chuyển dòng hỏng của ledger.jsonl sang ledger.bad.jsonl
//   gate set <unit|'*'> <gate> PASS|FAIL|NA --by <ai> --evidence … [--report .mission/reviews/<tệp>.md]
//   gate show [unit]
//   check [--full] [--file F]             chạy bộ kiểm tra, ghi kết quả
//   lint [tệp…|--all] [--summary]         chạy lint.rules
//   report                                sinh .mission/progress.md, ledger.md, gates.md
//   done                                  kiểm Definition of Done; mã thoát 1 nếu chưa đạt
//   backup                                sao lưu mã nguồn (git archive) + ship.backupFiles vào ship.backupDir (mặc định build/backup)
//   tidy [--save <nhãn>] [--compare <nhãn>] [--strict] [--conflicts]   đo độ gọn của mã; --conflicts: chỉ tên trùng, mã thoát 1 nếu có
// Tham số có giá trị có thể viết --why=… (dùng khi giá trị bắt đầu bằng "--").
import { readFileSync, writeFileSync, existsSync, mkdirSync, copyFileSync, cpSync, appendFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeConfig, findRoot, loadConfig, mpath, readJson, writeJson, readJsonl, writeJsonl, appendJsonl, git, gitInfo, globToRegex, matchAny, nowIso, mtime, MISSION_DIR, KIT_DIR, runCmd, privacyCheck, maskPrivate, toRel, lsFiles } from './lib.mjs';
import { statSync } from 'node:fs';
import { lintText } from './lint-core.mjs';
import { tidyConfig, tidyFiles, tidyScan, tidyMarkdown, tidyCompare } from './tidy-core.mjs';
import { statusLines, summary, unitVerdict, loadState, isOpen, gatesFor, STATUSES, CATEGORIES, unitFingerprint } from './status-core.mjs';
import { dangerousLinks } from './important-core.mjs';
import { checkFreshness, watchedFiles, fingerprint, fileHashes, checksHash } from './check-core.mjs';

const VALUE_FLAGS = new Set(['brief', 'name', 'completion', 'note', 'severity', 'why', 'fix', 'unit', 'loc', 'category', 'source', 'before', 'after', 'verify', 'pattern', 'status', 'by', 'evidence', 'report', 'file', 'save', 'compare']);
const argv = process.argv.slice(2);
const cmd = argv.shift();
const flags = {}, pos = [];
const die = (m, code = 2) => { console.error(m); process.exit(code); };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (!a.startsWith('--')) { pos.push(a); continue; }
  const eq = a.indexOf('=');
  const k = a.slice(2, eq > 0 ? eq : undefined);
  if (eq > 0) { flags[k] = a.slice(eq + 1); continue; }
  if (VALUE_FLAGS.has(k)) {
    if (i + 1 >= argv.length) die(`--${k} cần một giá trị`);
    flags[k] = argv[++i];
  } else flags[k] = true;
}
const ALLOWED = {
  init: 'brief name', status: '', backup: '', scan: '', unit: 'completion note verified', report: '', done: '', help: '',
  ledger: 'severity why fix unit loc category source before after verify pattern status by open',
  gate: 'by evidence report', check: 'full file', lint: 'all summary', tidy: 'save compare strict conflicts',
};
if (cmd && ALLOWED[cmd] !== undefined) {
  const ok = new Set(ALLOWED[cmd].split(' ').filter(Boolean).concat('help'));
  for (const k of Object.keys(flags)) {
    if (!ok.has(k)) die(`Lệnh «${cmd}» không có tham số --${k}${ok.size > 1 ? ` (có: ${[...ok].filter(x => x !== 'help').map(x => '--' + x).join(' ')})` : ''}. Gõ sai tên tham số thì lệnh sẽ làm việc khác ý bạn.`);
    if (!VALUE_FLAGS.has(k) && flags[k] !== true) die(`--${k} là cờ bật/tắt, không nhận giá trị («${flags[k]}»). Muốn tắt thì bỏ cờ đi.`);
  }
}
for (const [k, v] of Object.entries(flags)) {
  if (VALUE_FLAGS.has(k) && (v === true || !String(v).trim())) die(`--${k} không được để trống`);
  if (VALUE_FLAGS.has(k) && /^--[a-z]/.test(String(v)) && VALUE_FLAGS.has(String(v).slice(2).split('=')[0]) ) die(`--${k} thiếu giá trị (đang nuốt «${v}»). Giá trị bắt đầu bằng -- thì viết --${k}=…`);
}

if (!cmd || cmd === 'help' || flags.help) { console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 23).map(l => l.replace(/^\/\/ ?/, '')).join('\n')); process.exit(0); }

// ---------------- init ----------------
if (cmd === 'init') {
  const root = process.cwd();
  const dir = resolve(root, MISSION_DIR);
  mkdirSync(resolve(dir, 'state'), { recursive: true });
  mkdirSync(resolve(dir, 'reviews'), { recursive: true });
  const tpl = resolve(KIT_DIR, 'templates');
  if (!existsSync(resolve(dir, 'config.json'))) {
    const c = JSON.parse(readFileSync(resolve(tpl, 'config.template.json'), 'utf8'));
    c.name = flags.name || basename(root);
    if (privacyCheck(root, normalizeConfig({}), c.name)) { c.name = 'app-' + createHash('sha1').update(c.name).digest('hex').slice(0, 6); console.log(`🔒 tên dự án trông giống địa chỉ → dùng mã ${c.name} (đổi bằng --name <mã ngắn>)`); }
    const mb = git(root, ['symbolic-ref', '--short', 'HEAD']);
    if (mb) { c.mainBranch = mb; if (!c.protectedBranches.includes(mb)) c.protectedBranches.push(mb); }
    writeJson(resolve(dir, 'config.json'), c);
    console.log('tạo .mission/config.json');
  } else console.log('giữ nguyên .mission/config.json đã có');
  if (flags.brief) {
    copyFileSync(resolve(flags.brief), resolve(dir, 'brief.md')); console.log('chép yêu cầu → .mission/brief.md');
    const bt = readFileSync(resolve(dir, 'brief.md'), 'utf8');
    if (privacyCheck(root, normalizeConfig({}), bt)) console.log('⚠ Yêu cầu có vẻ chứa địa chỉ/tên khách hàng. Thay bằng mã ngắn trong .mission/brief.md trước khi commit.');
  }
  else if (!existsSync(resolve(dir, 'brief.md'))) writeFileSync(resolve(dir, 'brief.md'), '# Yêu cầu\n\n(Dán nguyên văn yêu cầu vào đây. Không tóm tắt. Không ghi địa chỉ/tên khách hàng — dùng mã ngắn.)\n');
  if (!existsSync(resolve(dir, 'plan.md'))) copyFileSync(resolve(tpl, 'plan.template.md'), resolve(dir, 'plan.md'));
  for (const [f, t] of [['HANDOVER.md', 'HANDOVER.template.md'], ['HTC.md', 'HTC.template.md'], ['LT.md', 'LT.template.md']])
    if (!existsSync(resolve(dir, f)) && existsSync(resolve(tpl, t))) copyFileSync(resolve(tpl, t), resolve(dir, f));
  if (!existsSync(resolve(dir, 'ledger.jsonl'))) writeFileSync(resolve(dir, 'ledger.jsonl'), '');
  if (!existsSync(resolve(dir, 'gates.json'))) writeJson(resolve(dir, 'gates.json'), {});
  { const gi = resolve(dir, '.gitignore'); const cur = existsSync(gi) ? readFileSync(gi, 'utf8') : '';
    const need = ['state/', 'shots/', 'logs/', 'manifest.json', 'ledger.bad.jsonl'].filter(l => !cur.split(/\r?\n/).includes(l));
    if (need.length) writeFileSync(gi, cur + (cur && !cur.endsWith('\n') ? '\n' : '') + need.join('\n') + '\n'); }
  console.log('Xong. Bước tiếp: điền .mission/config.json (skill «mission-init» hướng dẫn), rồi chạy «scan».');
  process.exit(0);
}

const root = findRoot();
if (!root) die('Không thấy .mission/config.json trong repo này. Chạy «/mission-init» (hoặc mission.mjs init) trước.');
let cfg;
try { cfg = loadConfig(root); } catch (e) { die(`.mission/config.json hỏng: ${e.message}`); }
const P = (...p) => mpath(root, ...p);
const head = () => git(root, ['rev-parse', '--short', 'HEAD']);
const guardPrivacy = (...vals) => {
  for (const v of vals) {
    const why = privacyCheck(root, cfg, v); if (!why) continue;
    const lines = String(v).split(/\r?\n/); const k = lines.findIndex(l => privacyCheck(root, cfg, l));
    const where = k >= 0 ? ` (dòng ${k + 1}: «${maskPrivate(root, cfg, lines[k]).trim().slice(0, 80)}»)` : '';
    die(`Từ chối ghi: nội dung ${why}${where}. Dùng mã ngắn thay cho địa chỉ/tên khách hàng/tên tệp mẫu. Nếu đây là chữ thường bị nhận nhầm, viết lại câu đó (vd. bỏ số đứng trước).`);
  }
};

// ---------------- status ----------------
if (cmd === 'status') { console.log(`# ${cfg.name}\n` + statusLines(root, cfg).join('\n')); process.exit(0); }

// ---------------- scan ----------------
let _all;
function listFiles(glob) {
  _all ||= lsFiles(root);
  const re = globToRegex(glob);
  return _all.filter(f => re.test(f)).sort();
}
const hid = s => 'm-' + createHash('sha1').update(s).digest('hex').slice(0, 6);
// commit mới nhất của từng tệp — MỘT lệnh git cho cả repo (thay vì một lệnh mỗi tệp)
let _revs;
function revOf(f) {
  if (!_revs) {
    _revs = new Map();
    try {
      const o = execFileSync('git', ['-c', 'core.quotePath=false', 'log', '--format=%x01%h', '--name-only', '-z', '--no-renames'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 512 << 20 });
      let h = null;
      for (const tok of o.split(/\0|\n/)) { if (!tok) continue; if (tok[0] === '\x01') { h = tok.slice(1); continue; } if (h && !_revs.has(tok)) _revs.set(tok, h); }
    } catch {}
  }
  return _revs.get(f) || null;
}
function pick(o) { if (!o) return {}; const r = {}; for (const k of ['completion', 'note', 'lastVerifiedCommit']) if (o[k] !== undefined) r[k] = o[k]; return r; }
// Tính phạm vi (đơn vị) từ config + tệp hiện có. Dùng chung cho scan và done (done so với manifest đã lưu).
function computeUnits(old = new Map(), { revs = true } = {}) {
  const units = [], warn = []; let priv = 0;
  for (const grp of cfg.units) {
    if (!grp || typeof grp.name !== 'string' || !grp.name) throw new Error('mỗi mục units[] cần «name»');
    if (grp.list) {
      for (const item of [].concat(grp.list)) {
        let id = `${grp.name}:${item}`;
        if (privacyCheck(root, cfg, String(item))) { id = `${grp.name}:${hid(String(item))}`; priv++; }
        units.push({ id, group: grp.name, ...pick(old.get(id)) });
      }
      continue;
    }
    if (typeof grp.source !== 'string' || !grp.source) throw new Error(`nhóm «${grp.name}» cần «source» (glob tệp nguồn) hoặc «list» (danh sách tên)`);
    const ex = f => grp.exclude && matchAny(f, [].concat(grp.exclude));
    const src = listFiles(grp.source).filter(f => !ex(f)), tgt = grp.target ? listFiles(grp.target).filter(f => !ex(f)) : [];
    const key = f => {
      const b = basename(f);
      if (grp.pair === 'numericPrefix') return b.match(/^(\d+)/)?.[1]?.replace(/^0+(?=\d)/, '') ?? b;
      if (grp.pair === 'map') return b;
      return b.replace(/\.[^.]+$/, '');
    };
    const dup = (list, what) => {
      const seen = new Map();
      for (const f of list) { const k = key(f); if (seen.has(k)) throw new Error(`nhóm «${grp.name}»: hai tệp ${what} cùng khóa «${privacyCheck(root, cfg, k) ? hid(k) : k}» (${[seen.get(k), f].map(x => privacyCheck(root, cfg, x) ? hid(x) : x).join(' và ')}). Đổi tên cho khác nhau — nếu không, cổng của tệp này sẽ bị tính cho tệp kia.`); seen.set(k, f); }
    };
    dup(src, 'nguồn'); if (grp.pair !== 'map') dup(tgt, 'đích');
    const tmap = new Map();
    if (grp.pair === 'map') for (const [s0, t] of Object.entries(grp.map || {})) tmap.set(s0, tgt.find(f => basename(f) === t));
    else for (const t of tgt) tmap.set(key(t), t);
    for (const s0 of src) {
      const k = key(s0), t = tmap.get(k);
      let id = `${grp.name}:${k}`;
      if (privacyCheck(root, cfg, id) || privacyCheck(root, cfg, s0)) { id = `${grp.name}:${hid(s0)}`; priv++; }
      units.push({
        id, group: grp.name, source: s0, sourceRev: revs ? revOf(s0) : null,
        target: grp.target ? (t || null) : s0, targetExists: grp.target ? !!t : true, ...pick(old.get(id)),
      });
    }
    if (grp.target) for (const o of tgt.filter(t => ![...tmap.entries()].some(([k, v]) => v === t && src.some(x => key(x) === k)))) warn.push(`⚠ tệp đích không khớp nguồn nào: ${privacyCheck(root, cfg, o) ? hid(o) : o}`);
  }
  const ids = new Map(); for (const u of units) { if (ids.has(u.id)) throw new Error(`hai đơn vị trùng mã «${u.id}» — đổi tên trong units[].list hoặc tên tệp`); ids.set(u.id, 1); }
  return { units, warn, priv };
}
if (cmd === 'scan') {
  const old = new Map((readJson(P('manifest.json'), { units: [] }).units || []).map(u => [u.id, u]));
  let r; try { r = computeUnits(old); } catch (e) { die(`scan dừng: ${e.message}`); }
  const { units, warn, priv } = r;
  warn.forEach(w => console.log(w));
  writeJson(P('manifest.json'), { generatedAt: nowIso(), head: head(), units });
  if (priv) console.log(`🔒 ${priv} đơn vị có tên giống địa chỉ/tên khách hàng → dùng mã ngắn (m-xxxxxx). Nên đổi tên tệp mẫu sang mã ngắn.`);
  console.log(`manifest: ${units.length} đơn vị; có đích ${units.filter(u => u.targetExists !== false).length}; thiếu ${units.filter(u => u.targetExists === false).map(u => u.id).join(', ') || 'không'}`);
  process.exit(0);
}

if (cmd === 'unit' && pos[0] === 'set') {
  const m = readJson(P('manifest.json'), { units: [] });
  const u = m.units.find(x => x.id === pos[1]) || die(`không có đơn vị ${pos[1]} (chạy scan?)`);
  if (flags.completion !== undefined) { const n = Number(flags.completion); if (!Number.isFinite(n)) die('--completion phải là số 0–100'); u.completion = Math.max(0, Math.min(100, n)); }
  if (flags.note) { guardPrivacy(flags.note); u.note = flags.note; }
  if (flags.verified) u.lastVerifiedCommit = head();
  writeJson(P('manifest.json'), m); console.log(JSON.stringify(u)); process.exit(0);
}

// ---------------- ledger ----------------
if (cmd === 'ledger') {
  const sub = pos[0];
  const rows = readJsonl(P('ledger.jsonl'));
  if ((sub === 'add' || sub === 'close') && rows.bad.length) die(`ledger.jsonl có dòng hỏng (dòng ${rows.bad.join(', ')}). Không ghi thêm để khỏi làm mất dữ liệu. Chạy: node "$MISSION_KIT/mission.mjs" ledger repair  (chuyển dòng hỏng sang .mission/ledger.bad.jsonl), rồi chạy lại lệnh.`);
  if (sub === 'repair') {
    const raw = existsSync(P('ledger.jsonl')) ? readFileSync(P('ledger.jsonl'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/) : [];
    if (!rows.bad.length) { console.log('ledger.jsonl không có dòng hỏng.'); process.exit(0); }
    const bad = rows.bad.map(n => raw[n - 1]);
    appendFileSync(P('ledger.bad.jsonl'), bad.map(l => JSON.stringify({ t: nowIso(), line: l })).join('\n') + '\n');
    writeJsonl(P('ledger.jsonl'), rows);
    console.log(`Đã chuyển ${bad.length} dòng hỏng sang .mission/ledger.bad.jsonl (giữ nguyên văn để xem lại); ledger.jsonl còn ${rows.length} mục.`);
    process.exit(0);
  }
  if (sub === 'add') {
    const sevr = String(flags.severity || '').toUpperCase();
    if (!cfg.severities.includes(sevr)) die(`--severity phải là một trong ${cfg.severities.join('/')}`);
    const category = flags.category || 'defect';
    if (!CATEGORIES.includes(category)) die(`--category phải là một trong ${CATEGORIES.join('/')}`);
    // sweep = đã quét toàn dự án xong (mặc định fixed); --status open nghĩa là mới lên kế hoạch quét, chưa tính
    const status = flags.status || (category === 'sweep' ? 'fixed' : 'open');
    if (category === 'sweep' && cfg.blockingSeverities.includes(sevr)) die(`«sweep» là ghi nhận đã quét, dùng mức không chặn (vd. LOW). Lỗi ${sevr} tìm thấy khi quét phải ghi thành mục riêng (defect).`);
    if (category === 'sweep' && !flags.pattern) die('«sweep» cần --pattern (mẫu lỗi đã quét).');
    if (!STATUSES.includes(status)) die(`--status phải là một trong ${STATUSES.join('/')}`);
    if (category === 'attention' && cfg.blockingSeverities.includes(sevr)) die(`«attention» (lưu ý) chỉ dùng với mức không chặn; vấn đề ${sevr} là lỗi thật — bỏ --category attention.`);
    if (!flags.why) die('--why (vì sao đây là lỗi) là bắt buộc');
    if (!flags.fix && category !== 'sweep') die('--fix (hướng điều chỉnh: sửa thế nào) là bắt buộc — lỗi nào cũng phải kèm cách sửa');
    if (status === 'fixed' && category !== 'sweep' && (!flags.after || !flags.verify)) die('Đánh dấu fixed cần cả --after (bản sửa) và --verify (đã kiểm chứng thế nào)');
    if (status === 'wontfix' && cfg.blockingSeverities.includes(sevr) && !/^human:/.test(flags.by || '')) die(`Bỏ qua lỗi ${sevr} cần chủ dự án quyết: --by human:<tên> --verify "<lý do>"`);
    guardPrivacy(flags.why, flags.fix, flags.loc, flags.source, flags.before, flags.after, flags.verify, flags.unit, flags.pattern, flags.by);
    const n = rows.length ? Math.max(...rows.map(r => Number(String(r.id).slice(2)) || 0)) + 1 : 1;
    const e = { id: 'L-' + String(n).padStart(4, '0'), t: nowIso(), unit: flags.unit || null, loc: flags.loc || null, severity: sevr,
      category, source: flags.source || null, before: flags.before || null, after: flags.after || null,
      why: flags.why, fix: flags.fix || null, verify: flags.verify || null, pattern: flags.pattern || null, status, by: flags.by || null, commit: head() };
    appendJsonl(P('ledger.jsonl'), e);
    console.log(`${e.id} [${e.severity}${category !== 'defect' ? '·' + category : ''}] ${e.status}`);
    if (e.pattern && category !== 'sweep') {
      const same = rows.filter(r => r.pattern === e.pattern && r.category !== 'sweep').length + 1;
      const swept = rows.some(r => r.pattern === e.pattern && r.category === 'sweep' && r.status === 'fixed');
      if (same >= 2 && !swept) console.log(`↻ Mẫu lỗi «${e.pattern}» đã gặp ${same} lần: quét toàn dự án rồi ghi «ledger add --category sweep --pattern "${e.pattern}" --severity LOW --why "<lệnh tìm + kết quả>"» (mặc định là đã quét xong).`);
    }
    process.exit(0);
  }
  if (sub === 'close') {
    const e = rows.find(r => r.id === pos[1]) || die(`không có ${pos[1]}`);
    const status = flags.status || 'fixed';
    if (!['fixed', 'wontfix'].includes(status)) die('--status khi đóng: fixed hoặc wontfix');
    if (!flags.verify) die('--verify là bắt buộc khi đóng lỗi (bằng chứng: lệnh + kết quả)');
    if (status === 'wontfix' && cfg.blockingSeverities.includes(e.severity) && !/^human:/.test(flags.by || '')) die(`Bỏ qua lỗi ${e.severity} cần chủ dự án quyết: --by human:<tên>`);
    guardPrivacy(flags.verify, flags.after, flags.by);
    Object.assign(e, { status, verify: flags.verify, after: flags.after || e.after, closedAt: nowIso(), closedCommit: head(), closedBy: flags.by || null });
    writeJsonl(P('ledger.jsonl'), rows); console.log(`${e.id} → ${e.status}`); process.exit(0);
  }
  if (sub === 'list' || !sub) {
    let r = rows;
    if (flags.open) r = r.filter(isOpen);
    if (flags.unit) r = r.filter(x => x.unit === flags.unit);
    if (flags.severity) r = r.filter(x => x.severity === String(flags.severity).toUpperCase());
    if (flags.pattern) r = r.filter(x => x.pattern === flags.pattern);
    for (const x of r) console.log(`${x.id} [${x.severity}${x.category !== 'defect' ? '·' + x.category : ''}] ${String(x.status).padEnd(7)} ${x.unit || '-'} ${x.loc || ''} — ${(x.why || '').slice(0, 90)}${x.fix ? '  → ' + x.fix.slice(0, 70) : ''}`);
    console.log(`(${r.length} mục)`); process.exit(0);
  }
  die('ledger add|close|list|repair');
}

// ---------------- gates ----------------
if (cmd === 'gate') {
  const gates = readJson(P('gates.json'), {});
  if (pos[0] === 'set') {
    const [, unit, gid, statusRaw] = pos;
    const status = String(statusRaw || '').toUpperCase();
    if (!cfg.gates.some(g => g.id === gid)) die(`cổng ${gid} không có trong config.gates (${cfg.gates.map(g => g.id).join(', ')})`);
    if (!['PASS', 'FAIL', 'NA'].includes(status)) die('trạng thái: PASS|FAIL|NA');
    if (!flags.by) die('--by là bắt buộc (ai/agent nào đã soát)');
    if (!flags.evidence) die('--evidence là bắt buộc: lệnh đã chạy, mục đã đọc, kết quả cụ thể (NA thì ghi vì sao không áp dụng)');
    guardPrivacy(flags.evidence, flags.by, flags.report);
    let report = null;
    if (cfg.independentGates.includes(gid) && status === 'NA' && !/^human:/.test(flags.by)) die(`${gid} là cổng độc lập: chỉ chủ dự án được đặt NA (--by human:<tên>).`);
    if (cfg.independentGates.includes(gid) && status === 'PASS') {
      if (!/^(agent|human):/.test(flags.by)) die(`${gid} là cổng độc lập: --by phải là «agent:<tên>» hoặc «human:<tên>», không phải người làm ra phần đó.`);
      if (/^agent:/.test(flags.by)) {
        if (!flags.report) die(`${gid}: cần --report .mission/reviews/<tệp>.md — báo cáo nguyên văn của subagent (có dòng «KẾT LUẬN: … PASS»).`);
        guardPrivacy(flags.report);
        const rp = resolve(root, flags.report);
        if (!toRel(root, rp).toLowerCase().startsWith('.mission/reviews/') || !existsSync(rp)) die('--report phải là tệp có thật trong .mission/reviews/');
        const txt = readFileSync(rp, 'utf8').replace(/^\uFEFF/, '').normalize('NFC');
        const verdicts = txt.split('\n').filter(l => /KẾT LUẬN[^:\n]*:/i.test(l));
        const last = verdicts.at(-1) || '';
        if (!/:\s*\**\s*PASS\b/i.test(last) || /\bFAIL\b/i.test(last)) die('Báo cáo không có dòng «KẾT LUẬN: … PASS» — cổng độc lập chưa đạt.');
        if (/THI[ẾE]U\s+B[ẰA]NG\s+CH[ỨU]NG|EVIDENCE\s+MISSING/i.test(last)) die('Dòng kết luận cuối còn «THIẾU BẰNG CHỨNG» — chưa đủ bằng chứng để chấm đạt cổng độc lập.');
        guardPrivacy(txt);
        report = toRel(root, rp);
      }
    }
    const st = loadState(root);
    const units = unit === '*' ? st.manifest.units.map(u => u.id) : [unit];
    if (unit === '*' && !units.length) die('manifest trống (chạy scan?)');
    let n = 0; const h0 = head();
    for (const u of units) {
      const uo = st.manifest.units.find(x => x.id === u);
      if (!uo) die(`không có đơn vị ${u} (chạy scan?). Lưu ý viết '*' trong nháy đơn.`);
      if (!gatesFor(cfg, uo).some(g => g.id === gid)) { if (unit !== '*') die(`${gid} không áp cho nhóm «${uo.group}» (units[].gates)`); continue; }
      if (status === 'PASS') {
        const blk = st.ledger.filter(e => e.unit === u && isOpen(e) && e.category !== 'sweep' && cfg.blockingSeverities.includes(e.severity));
        if (blk.length) console.log(`⚠ ${u} còn ${blk.length} lỗi chặn mở (${blk.map(b => b.id).join(', ')}): đơn vị vẫn chưa PASS tổng thể.`);
      }
      gates[u] ||= {};
      gates[u][gid] = { status, by: flags.by, evidence: flags.evidence, report, t: nowIso(), commit: h0, fp: unitFingerprint(root, cfg, uo) };
      n++;
    }
    writeJson(P('gates.json'), gates); console.log(`${n} đơn vị: ${gid}=${status}`); process.exit(0);
  }
  if (pos[0] === 'show' || !pos[0]) {
    const st = loadState(root);
    const ids = cfg.gates.map(g => g.id);
    console.log(['đơn vị'.padEnd(28), ...ids.map(i => i.padEnd(5)), 'KẾT LUẬN'].join(' '));
    for (const u of st.manifest.units.filter(u => !pos[1] || u.id === pos[1])) {
      const g = st.gates[u.id] || {};
      const v = unitVerdict(cfg, st, u.id, root);
      const cell = i => !v.ids.includes(i) ? '—' : v.stale.includes(i) ? 'CŨ' : (g[i]?.status || '·');
      const note = [v.blocking.length && `${v.blocking.length} lỗi chặn`, v.noTarget && 'chưa có sản phẩm', v.stale.length && `cổng cũ: ${v.stale.join(',')}`].filter(Boolean).join('; ');
      console.log([u.id.padEnd(28), ...ids.map(i => cell(i).padEnd(5)), v.verdict + (note ? ` (${note})` : '')].join(' '));
    }
    process.exit(0);
  }
  die('gate set|show');
}

// ---------------- check ----------------
if (cmd === 'check') {
  if (flags.file) {
    const rel = toRel(root, resolve(process.cwd(), flags.file));
    if (rel.startsWith('..') || /^[a-zA-Z]:/.test(rel)) die(`--file phải nằm trong dự án (${flags.file}).`);
    let isFile = false; try { isFile = statSync(resolve(root, rel)).isFile(); } catch {}
    if (!isFile) die(`--file: không thấy tệp «${flags.file}» (hoặc đó là thư mục).`);
    const res = cfg.checks.onEdit.filter(c => matchAny(rel, [].concat(c.glob))).map(c => ({ name: c.name || c.cmd, ...runCmd(root, c.cmd, { file: rel, timeout: c.timeout || 60 }) }));
    const lint = lintText(rel, readFileSync(resolve(root, rel), 'utf8'), cfg.lint.rules);
    for (const r of res) console.log(`${r.ok ? '✓' : '✗'} ${r.name}${r.ok ? '' : '\n' + r.out.trim().split('\n').slice(-15).join('\n')}`);
    for (const f of lint) console.log(`${f.severity === 'error' ? '✗' : '!'} ${rel}:${f.line} ${f.message} «${f.excerpt}»`);
    process.exit(res.every(r => r.ok) && !lint.some(f => f.severity === 'error') ? 0 : 1);
  }
  // LỖI 11: junction/symlink trong thư mục tạm của Claude và worktree trỏ vào dữ liệu thật — chỉ BÁO, không tự gỡ
  let danger = []; try { danger = dangerousLinks(root, cfg); } catch {}
  for (const d of danger) console.log(`⚠ JUNCTION NGUY HIỂM: ${d.path} → ${d.target} (trỏ vào ${d.hit}). Gỡ bằng lệnh gỡ liên kết (cmd /c rmdir "<liên-kết>", KHÔNG /s, KHÔNG xóa đệ quy), rồi dùng chép.`);
  if (!cfg.checks.full.length) die('checks.full trống trong config — chưa có gì để chạy.');
  const wf = watchedFiles(root, cfg); const files = fileHashes(root, wf);
  const results = [];
  if (danger.length) results.push({ name: 'junction/symlink nguy hiểm', ok: true, warn: true, code: 0, ms: 0, tail: danger.map(d => `${d.path} → ${d.target} (${d.hit})`).join('\n') });
  for (const c of cfg.checks.full) {
    const r = runCmd(root, c.cmd, { timeout: c.timeout || 600 });
    const warn = !r.ok && c.severity === 'warning';
    const row = { name: c.name || c.cmd, ok: r.ok || warn, warn, code: r.code, ms: r.ms, tail: maskPrivate(root, cfg, r.out.trim().split('\n').slice(r.ok ? -8 : -15).join('\n')) };
    results.push(row);
    console.log(`${row.ok ? (warn ? '!' : '✓') : '✗'} ${row.name} (${(row.ms / 1000).toFixed(1)}s)`);
    if (!r.ok) console.log('   ' + row.tail.replace(/\n/g, '\n   '));
  }
  const after = fileHashes(root, wf); if (JSON.stringify(after) !== JSON.stringify(files)) console.log('⚠ Tệp nguồn thay đổi TRONG lúc kiểm tra — kết quả sẽ bị coi là cũ.');
  const lc = { t: nowIso(), head: head(), fp: fingerprint(root, wf), files, checks: checksHash(cfg), dirty: gitInfo(root).changed.length, ok: results.every(r => r.ok), failed: results.filter(r => !r.ok).map(r => r.name), results };
  writeJson(P('state', 'last-check.json'), lc);
  writeFileSync(P('checks.md'), maskPrivate(root, cfg, `# Kết quả kiểm tra đầy đủ\n\n- Thời điểm: ${lc.t}\n- Commit: ${lc.head}${lc.dirty ? ` (+${lc.dirty} tệp chưa commit)` : ''}\n- Kết luận: ${lc.ok ? 'XANH' : 'ĐỎ'}\n\n` +
    results.map(r => `## ${r.ok ? (r.warn ? '!' : '✓') : '✗'} ${r.name}\n\n- Mã thoát: ${r.code}; ${(r.ms / 1000).toFixed(1)} giây\n\n\`\`\`\n${r.tail}\n\`\`\`\n`).join('\n')));
  console.log(lc.ok ? 'XANH' : `ĐỎ: ${lc.failed.join(', ')}`);
  process.exit(lc.ok ? 0 : 1);
}

// ---------------- lint ----------------
if (cmd === 'lint') {
  let files = pos;
  if (flags.all || !files.length) {
    const all = lsFiles(root, { others: false });
    files = all.filter(f => cfg.lint.rules.some(r => !r.glob || matchAny(f, [].concat(r.glob))));
  }
  let err = 0, warn = 0; const byRule = {};
  for (const f of files) {
    let text; try { text = readFileSync(resolve(root, f), 'utf8'); } catch { continue; }
    for (const x of lintText(f, text, cfg.lint.rules)) {
      x.severity === 'error' ? err++ : warn++; byRule[x.id] = (byRule[x.id] || 0) + 1;
      if (!flags.summary || x.severity === 'error') console.log(`${x.severity === 'error' ? '✗' : '!'} ${f}:${x.line} ${x.message} «${x.excerpt}»`);
    }
  }
  console.log(`\n${files.length} tệp · ${err} lỗi · ${warn} cảnh báo` + (Object.keys(byRule).length ? ' · theo luật: ' + Object.entries(byRule).map(([k, v]) => `${k}=${v}`).join(', ') : ''));
  process.exit(err ? 1 : 0);
}

// ---------------- tidy ----------------
// Chỉ đọc mã và ghi kết quả đo vào .mission/tidy/. Không bao giờ sửa mã.
if (cmd === 'tidy') {
  const t = tidyConfig(cfg);
  const safe = n => { if (!/^[\w.-]{1,60}$/.test(n)) die(`Nhãn «${n}» chỉ được dùng chữ, số, - _ . (tối đa 60 ký tự)`); return n; };
  const files = tidyFiles(lsFiles(root, { others: true }), t);
  const items = [];
  for (const f of files) { try { items.push({ path: f, text: readFileSync(resolve(root, f), 'utf8') }); } catch {} }
  const r = tidyScan(items, t);
  // --conflicts: bản gọn cho checks.full — chỉ tên định nghĩa trùng (xung đột thật), đỏ nếu có
  if (flags.conflicts) {
    if (flags.save || flags.compare || flags.strict) die('--conflicts dùng một mình (không kèm --save/--compare/--strict).');
    if (!r.conflicts.length) { console.log(`Không có tên định nghĩa trùng (${r.totals.files} tệp mã).`); process.exit(0); }
    console.log(maskPrivate(root, cfg, [`${r.conflicts.length} tên định nghĩa trùng (bản nạp sau đè bản trước) — giữ MỘT bản, xóa/đổi tên bản kia:`,
      ...r.conflicts.slice(0, 12).map(c => `- ${c.name}: ${c.places.map(p => `${p.path}:${p.line}`).join(' · ')}`),
      ...(r.conflicts.length > 12 ? [`- … và ${r.conflicts.length - 12} tên nữa (xem: tidy --save <nhãn>)`] : [])].join('\n')));
    process.exit(1);
  }
  r.t = nowIso(); r.head = gitInfo(root).head || null;
  const dir = P('tidy'); mkdirSync(dir, { recursive: true });
  let base = null;
  if (flags.compare) { const bp = resolve(dir, safe(flags.compare) + '.json'); if (!existsSync(bp)) die(`Chưa có lần đo «${flags.compare}» (.mission/tidy/${flags.compare}.json). Đo trước bằng: tidy --save ${flags.compare}`); base = readJson(bp, null); }
  if (flags.save) {
    const n = safe(flags.save);
    writeJson(resolve(dir, n + '.json'), r);
    writeFileSync(resolve(dir, n + '.md'), tidyMarkdown(r, { label: n }) + '\n');
  }
  console.log(maskPrivate(root, cfg, tidyMarkdown(r, { label: flags.save || '', top: 15 })));
  if (flags.save) console.log(`\nĐã lưu: .mission/tidy/${flags.save}.json và .md (bản đầy đủ)`);
  let worse = [];
  if (base) { const c = tidyCompare(base, r); worse = c.worse; console.log(`\n## So với «${flags.compare}»\n\n${c.table}` + (worse.length ? `\n\n⚠ Tăng lên: ${worse.join(', ')}. Dọn mã không được làm các chỉ số này tăng.` : '')); }
  if (flags.strict && (r.totals.conflicts || worse.length)) { console.log(`\nKHÔNG ĐẠT (--strict): ${[r.totals.conflicts && r.totals.conflicts + ' tên trùng', worse.length && 'chỉ số tăng'].filter(Boolean).join('; ')}`); process.exit(1); }
  process.exit(0);
}

// ---------------- report ----------------
// Dấu vân tay của mọi dữ liệu mà báo cáo dựa vào: báo cáo "cập nhật" khi dấu này khớp.
function reportInputs() {
  const h = createHash('sha1');
  for (const f of ['ledger.jsonl', 'gates.json', 'config.json', 'state/last-check.json', 'plan.md']) { h.update(f + '\0'); try { h.update(readFileSync(P(f))); } catch { h.update('-'); } }
  h.update(JSON.stringify((readJson(P('manifest.json'), { units: [] }).units || []).map(u => [u.id, u.targetExists, u.completion])));
  return h.digest('hex').slice(0, 16);
}
function cell(s) { return s ? String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 300) : ''; }
if (cmd === 'report') {
  const s = summary(root, cfg); const st = s.st; const g = gitInfo(root);
  const ids = cfg.gates.map(x => x.id);
  const patterns = {};
  for (const e of st.ledger) if (e.pattern) { const p = (patterns[e.pattern] ||= { n: 0, open: 0, swept: false }); if (e.category === 'sweep') { if (e.status === 'fixed') p.swept = true; } else { p.n++; if (isOpen(e)) p.open++; } }
  const touched = new Set(st.ledger.map(e => e.unit).filter(Boolean));
  const repaired = new Set(st.ledger.filter(e => e.status === 'fixed').map(e => e.unit).filter(Boolean));
  const plan = existsSync(P('plan.md')) ? readFileSync(P('plan.md'), 'utf8') : '';
  const sec = h => (plan.match(new RegExp('##\\s*' + h + '[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)'))?.[1] || '').split('\n').filter(l => l.trim() && !l.startsWith('>')).join('\n');
  const next = maskPrivate(root, cfg, ['NOW', 'NEXT', 'LATER'].map(h => { const b = sec(h); return b ? `**${h}**\n\n${b}` : ''; }).filter(Boolean).join('\n\n'));
  const md = [
    `# Báo cáo tiến độ — ${cfg.name}`, '',
    `Sinh tự động bởi Mission Kit lúc ${nowIso()} từ manifest, ledger, gates và lần kiểm tra gần nhất. Không chứa số ước lượng.`, '',
    '## Tổng quan', '', ...statusLines(root, cfg, { short: true }).map(l => '- ' + l), '',
    '## Phạm vi và độ phủ', '',
    `- Tổng số đơn vị: ${s.units.length}; đã có sản phẩm: ${s.present}${s.noTargetKind ? ` (${s.noTargetKind} đơn vị không có tệp đích)` : ''}; còn thiếu: ${s.units.filter(u => u.targetExists === false).map(u => u.id).join(', ') || 'không'}`,
    `- Đã kiểm toán (có mục trong ledger): ${touched.size}; đã sửa: ${repaired.size}`, '',
    '## Lỗi theo mức độ', '', '| Mức | Mở | Đã đóng |', '| --- | --- | --- |',
    ...Object.entries(s.sev).map(([k, v]) => `| ${k} | ${v.open} | ${v.fixed} |`), '',
    '## Mẫu lỗi lặp lại', '',
    ...(Object.keys(patterns).length ? ['| Mẫu | Số lần | Còn mở | Đã quét toàn dự án |', '| --- | --- | --- | --- |', ...Object.entries(patterns).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `| ${k} | ${v.n} | ${v.open} | ${v.swept ? 'có' : '**chưa**'} |`)] : ['(chưa có)']), '',
    '## Cổng chất lượng', '',
    ...(ids.length ? [`| Đơn vị | ${ids.join(' | ')} | Kết luận |`, `| --- | ${ids.map(() => '---').join(' | ')} | --- |`,
      ...s.units.map(u => { const v = unitVerdict(cfg, st, u.id, root); return `| ${u.id} | ${ids.map(i => !v.ids.includes(i) ? '—' : v.stale.includes(i) ? 'CŨ' : st.gates[u.id]?.[i]?.status || '·').join(' | ')} | ${v.verdict} |`; })] : ['(chưa khai báo cổng)']), '',
    '## Sản phẩm bàn giao', '', ...s.deliverables.map(d => `- \`${d.path}\` — ${d.description || ''}: ${d.exists ? (d.stale ? 'có, nhưng cũ hơn nguồn' : 'có, ' + new Date(d.t).toISOString().slice(0, 16)) : 'chưa có'}`), '',
    '## Vướng mắc', '', ...(s.blockers.length ? s.blockers.map(b => `- ${b.id}: ${b.why}`) : ['- không']), '',
    '## Việc tiếp theo (NOW / NEXT / LATER)', '', next || '(cập nhật các mục ## NOW, ## NEXT, ## LATER trong .mission/plan.md)', '',
    `Commit mới nhất: ${g.head || '-'} trên nhánh ${g.branch || '-'}.`, '',
    `<!-- mission-inputs: ${reportInputs()} -->`, '',
  ].join('\n');
  writeFileSync(P('progress.md'), maskPrivate(root, cfg, md));
  const lg = ['# Sổ hiệu chỉnh (ledger)', '', '| ID | Mức | Loại | Trạng thái | Đơn vị | Vị trí | Vì sao | Hướng điều chỉnh | Kiểm chứng |', '| --- | --- | --- | --- | --- | --- | --- | --- | --- |',
    ...st.ledger.map(e => `| ${e.id} | ${e.severity} | ${e.category} | ${e.status} | ${e.unit || ''} | ${e.loc || ''} | ${cell(e.why)} | ${cell(e.fix || e.after)} | ${cell(e.verify)} |`)].join('\n');
  writeFileSync(P('ledger.md'), maskPrivate(root, cfg, lg + '\n'));
  const gm = ['# Bằng chứng cổng chất lượng', '', ...s.units.flatMap(u => { const v = unitVerdict(cfg, st, u.id, root); return [`## ${u.id} — ${v.verdict}`, '', ...gatesFor(cfg, u).map(gg => { const x = st.gates[u.id]?.[gg.id]; return `- **${gg.id} ${gg.name}**: ${x ? `${x.status}${v.stale.includes(gg.id) ? ' (CŨ — cần chấm lại)' : ''} — ${x.by}, ${x.t.slice(0, 10)}, ${x.commit}: ${x.evidence}${x.report ? ` [báo cáo: ${x.report}]` : ''}` : 'chưa soát'}`; }), '']; })].join('\n');
  writeFileSync(P('gates.md'), maskPrivate(root, cfg, gm + '\n'));
  console.log('đã ghi .mission/progress.md, ledger.md, gates.md');
  process.exit(0);
}

// ---------------- done ----------------
if (cmd === 'done') {
  const s = summary(root, cfg); const g = gitInfo(root);
  const rows = [];
  const add = (ok, label, detail = '') => rows.push({ ok, label, detail });
  add(g.isRepo, 'Thư mục là repo git (cần để kiểm thay đổi)', g.isRepo ? '' : 'git init rồi commit');
  const wcount = watchedFiles(root, cfg).length;
  add(wcount > 0, 'Vùng theo dõi có tệp nguồn', wcount ? '' : 'stopGate.watch không khớp tệp nào');
  add(s.units.length > 0, 'Đã kê khai phạm vi (manifest có đơn vị)', `${s.units.length}`);
  let scope = '';
  try { const now = computeUnits(new Map(), { revs: false }).units.map(u => u.id).sort(); const saved = s.units.map(u => u.id).sort(); if (JSON.stringify(now) !== JSON.stringify(saved)) scope = `phạm vi thực tế khác manifest (${now.length} so với ${saved.length} đơn vị) — chạy scan rồi soát lại`; }
  catch (e) { scope = e.message; }
  add(!scope, 'Manifest khớp phạm vi hiện tại (config + tệp)', scope);
  add(!s.st.ledger.bad?.length, 'ledger.jsonl đọc được toàn bộ', s.st.ledger.bad?.length ? `dòng hỏng: ${s.st.ledger.bad.join(', ')}` : '');
  add(!s.badDeliverables, 'Mọi mục deliverables có «path»', s.badDeliverables ? `${s.badDeliverables} mục thiếu path` : '');
  add(s.units.every(u => u.targetExists !== false), 'Mọi đơn vị trong phạm vi đều có sản phẩm', s.units.filter(u => u.targetExists === false).map(u => u.id).join(', '));
  const notPass = s.units.map(u => [u, unitVerdict(cfg, s.st, u.id, root)]).filter(([, v]) => v.verdict !== 'PASS');
  add(!notPass.length, 'Mọi đơn vị qua đủ cổng chất lượng (và cổng không cũ hơn thay đổi)', notPass.slice(0, 10).map(([u, v]) => `${u.id}${v.stale.length ? '(cũ)' : ''}`).join(', ') + (notPass.length > 10 ? ` …(+${notPass.length - 10})` : ''));
  const blk = s.st.ledger.filter(e => isOpen(e) && e.category !== 'sweep' && cfg.blockingSeverities.includes(e.severity));
  add(!blk.length, `Không còn lỗi ${cfg.blockingSeverities.join('/')} mở`, blk.map(e => e.id).join(', '));
  const vm = s.st.ledger.filter(e => isOpen(e) && e.category === 'blocker');
  add(!vm.length, 'Không còn vướng mắc (blocker) mở, ở mọi mức', vm.map(e => e.id).join(', '));
  const pat = {}; for (const e of s.st.ledger) if (e.pattern) { const p = (pat[e.pattern] ||= { n: 0, s: false }); if (e.category === 'sweep') { if (e.status === 'fixed') p.s = true; } else p.n++; }
  const unswept = Object.entries(pat).filter(([, v]) => v.n >= 2 && !v.s);
  add(!unswept.length, 'Mọi mẫu lỗi lặp lại đã được quét toàn dự án', unswept.map(([k]) => k).join(', '));
  const f = s.fresh;
  add(!!f.lc && f.lc.ok, 'Bộ kiểm tra đầy đủ XANH', f.lc ? (f.lc.ok ? f.lc.t : f.lc.failed.join(', ')) : 'chưa chạy');
  add(!!f.lc && f.fresh, 'Kiểm tra chạy SAU thay đổi cuối (tính cả thay đổi đã commit)', f.why);
  for (const d of s.deliverables) add(d.exists && !d.stale, `Sản phẩm ${d.path} có và mới hơn nguồn`);
  if (cfg.git.mode === 'branch-pr') add(!cfg.protectedBranches.includes(g.branch), 'Làm việc trên nhánh riêng (chế độ branch-pr)', g.branch || '');
  const dirty = g.changed.filter(x => !/^\.mission\/(state|shots)\//i.test(x));
  add(!dirty.length, 'Thay đổi đã được commit', dirty.slice(0, 8).join(', '));
  const rep = existsSync(P('progress.md')) ? (readFileSync(P('progress.md'), 'utf8').match(/<!-- mission-inputs: (\w+) -->/)?.[1] || '') : '';
  add(rep === reportInputs(), 'Báo cáo tiến độ cập nhật (khớp ledger, cổng, kiểm tra, manifest, kế hoạch)', rep ? 'dữ liệu đã đổi sau lần «report» — chạy report rồi commit' : 'chưa có .mission/progress.md — chạy report');
  for (const r of rows) console.log(maskPrivate(root, cfg, `${r.ok ? '✓' : '✗'} ${r.label}${!r.ok && r.detail ? ' — ' + r.detail : ''}`));
  const ok = rows.every(r => r.ok);
  console.log(ok ? '\nĐẠT Definition of Done.' : `\nCHƯA ĐẠT: ${rows.filter(r => !r.ok).length} điều kiện.`);
  process.exit(ok ? 0 : 1);
}

// ---------------- backup ----------------
// Đa nền tảng (không cần bash/zip): git archive cho mã nguồn đã commit + chép tệp build. Luôn trong thư mục app, không phải Dropbox.
if (cmd === 'backup') {
  const sh = cfg.ship || {};
  const dirRel = toRel(root, resolve(root, String(sh.backupDir || 'build/backup'))).replace(/\/+$/, '');
  if (!dirRel || dirRel === '.' || /^\.git(\/|$)/i.test(dirRel) || /^\.mission(\/|$)/i.test(dirRel) || dirRel.startsWith('..') || /^[a-zA-Z]:/.test(dirRel) || /dropbox/i.test(resolve(root, dirRel)))
    die(`ship.backupDir phải là một thư mục con trong app và không phải Dropbox (đang là «${sh.backupDir}»).`);
  const tracked = lsFiles(root, { others: false }).filter(f => f === dirRel || f.startsWith(dirRel + '/'));
  if (tracked.length) die(`ship.backupDir «${dirRel}» đang chứa tệp git quản lý (vd. ${tracked[0]}) — chọn thư mục riêng cho sao lưu, vd. build/backup.`);
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 13);
  const dest = resolve(root, dirRel, stamp);
  mkdirSync(dest, { recursive: true });
  // tự loại thư mục sao lưu khỏi git bằng .gitignore NẰM TRONG nó (không sửa .gitignore của app → không làm cổng thành CŨ)
  const gi = resolve(root, dirRel, '.gitignore');
  if (!existsSync(gi)) writeFileSync(gi, '# Mission Kit: bản sao lưu không commit\n*\n');
  const h = head();
  if (h) { try { execFileSync('git', ['archive', '--format=zip', '-o', resolve(dest, `src-${h}.zip`), 'HEAD'], { cwd: root, stdio: 'ignore' }); console.log(`✓ mã nguồn (commit ${h}) → ${dirRel}/${stamp}/src-${h}.zip`); } catch { console.log('✗ git archive lỗi'); } }
  for (const f of [].concat(sh.backupFiles || [])) {
    const src = resolve(root, f);
    if (!existsSync(src)) { console.log(`! không thấy ${maskPrivate(root, cfg, f)} (bỏ qua)`); continue; }
    cpSync(src, resolve(dest, basename(src)), { recursive: true }); console.log(`✓ ${maskPrivate(root, cfg, f)}`);
  }
  console.log(`Sao lưu xong: ${dirRel}/${stamp}`);
  process.exit(0);
}

die(`Lệnh không rõ: ${cmd}. Xem: node "$MISSION_KIT/mission.mjs" help`);
