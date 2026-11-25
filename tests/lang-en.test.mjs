#!/usr/bin/env node
// Bản tiếng Anh (kit-en/): (1) đối chiếu với bản tiếng Việt — đủ tệp, frontmatter giống hệt (trừ description/argument-hint),
// khối mã giống từng byte, tên skill/lệnh không rơi, các chuỗi mã nguồn đọc được giữ đúng; (2) cài/gỡ bằng --lang en.
// Chạy: node tests/lang-en.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const VI = join(ROOT, 'kit'), EN = join(ROOT, 'kit-en');
let pass = 0, fail = 0;
const ok = l => { pass++; console.log('  ✓ ' + l); };
const bad = (l, info = '') => { fail++; console.log(`  ✗ ${l} ${info}`); };
const yes = (l, cond, info = '') => cond ? ok(l) : bad(l, info);
const walk = (d, acc = []) => { if (!existsSync(d)) return acc; for (const e of readdirSync(d)) { const p = join(d, e); statSync(p).isDirectory() ? walk(p, acc) : acc.push(p); } return acc; };
const rel = (b, p) => relative(b, p).split('\\').join('/');
const read = p => readFileSync(p, 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');

console.log('## Đủ tệp: mỗi tệp chữ của kit có bản tiếng Anh, kit-en không có tệp lạ');
const TEXT = /\.(md|json|yml)$/;
const viFiles = ['skills', 'agents', 'commands', 'templates'].flatMap(s => walk(join(VI, s))).filter(p => TEXT.test(p)).map(p => rel(VI, p));
const enFiles = walk(EN).map(p => rel(EN, p));
const missing = viFiles.filter(f => !enFiles.includes(f));
const extra = enFiles.filter(f => !existsSync(join(VI, f)));
yes(`${viFiles.length} tệp chữ đều có bản tiếng Anh`, !missing.length, missing.join(', '));
yes('kit-en không có tệp không có bản gốc', !extra.length, extra.join(', '));

const front = t => { const m = t.match(/^---\n([\s\S]*?)\n---\n/); if (!m) return null; const o = {}; for (const l of m[1].split('\n')) { const k = l.match(/^([\w-]+):\s*(.*)$/); if (k) o[k[1]] = k[2]; } return o; };
const CODE = /^(bash|sh|shell|powershell|ps1|pwsh|js|mjs|javascript|json|jsonc|yaml|yml|python|py|cmd|bat)$/i;
const fences = t => { const out = []; const re = /^(\s*)(```+)([^\n`]*)\n([\s\S]*?)\n\1\2\s*$/gm; let m; while ((m = re.exec(t))) if (CODE.test(m[3].trim())) out.push(m[3].trim() + '\n' + m[4]); return out; };
const names = t => new Set((t.match(/\b(mission-[a-z0-9]+(?:-[a-z0-9]+)*|ba-chuyen-gia)\b/g) || []).filter(n => !/^mission-(kit|inputs)$/.test(n)));

console.log('## Markdown: frontmatter, khối mã, tên skill/lệnh');
for (const f of viFiles.filter(f => f.endsWith('.md') && enFiles.includes(f))) {
  const v = read(join(VI, f)), e = read(join(EN, f));
  const fv = front(v), fe = front(e);
  if (fv || fe) {
    const diff = !fv || !fe ? ['(thiếu frontmatter)'] : [...new Set([...Object.keys(fv), ...Object.keys(fe)])].filter(k => !['description', 'argument-hint'].includes(k) && fv[k] !== fe[k]);
    if (diff.length) bad(`${f}: frontmatter khác ở`, diff.join(', '));
    else if (fv && fe.description === fv.description && ((fv.description || '').match(/[à-ỹđ]/gi) || []).length > 10) bad(`${f}: description chưa dịch`);
  }
  const cv = fences(v), ce = fences(e);
  const lost = cv.filter(b => !ce.includes(b));
  if (lost.length) bad(`${f}: ${lost.length} khối mã khác bản gốc`, JSON.stringify(lost[0].slice(0, 120)));
  const nv = names(v), ne = names(e);
  const gone = [...nv].filter(n => !ne.has(n));
  if (gone.length) bad(`${f}: rơi tên`, gone.join(', '));
}
ok('đã đối chiếu từng tệp .md (lỗi, nếu có, in ở trên)');

console.log('## Chuỗi mã nguồn đọc từ tài liệu');
const enT = f => read(join(EN, 'templates', f));
yes('QUY-TRINH: có mục «## Autonomy and when to ask» và mục sau nó', /^## Autonomy and when to ask\n[\s\S]*?^## /m.test(enT('QUY-TRINH.md')));
yes('HUONG-DAN-BRIEF: khối prompt khớp regex của install.mjs', /## (?:Prompt dán vào ChatGPT|Prompt to paste into ChatGPT)[\s\S]*?```markdown\r?\n([\s\S]*?)\r?\n```/.test(enT('HUONG-DAN-BRIEF-CHATGPT.md')));
yes('plan.template: giữ ## NOW / ## NEXT / ## LATER', ['NOW', 'NEXT', 'LATER'].every(h => new RegExp(`^##\\s*${h}\\b`, 'm').test(enT('plan.template.md'))));
yes('LT.template: có mục Features', /^##.*Features/m.test(enT('LT.template.md')));
const PROSE = new Set(['description', '_note', 'focus', 'message']);
const strip = o => Array.isArray(o) ? o.map(strip) : o && typeof o === 'object' ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, PROSE.has(k) && typeof v === 'string' ? '' : strip(v)])) : o;
for (const f of viFiles.filter(f => f.endsWith('.json'))) {
  let ej; try { ej = JSON.parse(read(join(EN, f))); } catch (e) { bad(`${f}: JSON hỏng`, e.message); continue; }
  const vj = JSON.parse(read(join(VI, f)));
  yes(`${f}: chỉ khác ở description/_note/focus/message`, JSON.stringify(strip(vj)) === JSON.stringify(strip(ej)));
}
for (const f of viFiles.filter(f => f.endsWith('.yml'))) {
  const keep = t => t.split('\n').map(l => l.replace(/\s+#.*$/, '').replace(/^\s*#.*$/, '').replace(/^(\s*-?\s*name:).*$/, '$1')).filter(l => l.trim()).join('\n');
  yes(`${f}: chỉ khác ở chú thích và nhãn name:`, keep(read(join(VI, f))) === keep(read(join(EN, f))));
}

console.log('## Cài/gỡ bằng --lang en');
const T = mkdtempSync(join(tmpdir(), 'lang-en-'));
const APP = join(T, 'app'); mkdirSync(APP);
writeFileSync(join(APP, 'index.html'), '<p>hi</p>\n');
const snap = d => Object.fromEntries(walk(d).filter(p => !p.includes(`${join(d, '.git')}`)).map(p => [rel(d, p), readFileSync(p, 'utf8')]));
const before = snap(APP);
const env = { ...process.env, CLAUDE_CONFIG_DIR: join(T, 'home-claude') };
const inst = (...a) => spawnSync('node', [join(ROOT, 'install.mjs'), ...a], { encoding: 'utf8', env });
let r = inst('--lang', 'en', '--project', APP);
yes('cài --lang en chạy được', r.status === 0, r.stderr + r.stdout.slice(-400));
yes('lời nhắn cuối bằng tiếng Anh', /Done \(one app/.test(r.stdout) && /Kit language: English/.test(r.stdout));
const C = join(APP, '.claude');
const man = JSON.parse(readFileSync(join(C, 'mission-kit', 'installed.json'), 'utf8'));
yes('installed.json ghi lang: en', man.lang === 'en');
yes('skill mission-run là bản tiếng Anh', read(join(C, 'skills', 'mission-run', 'SKILL.md')) === read(join(EN, 'skills', 'mission-run', 'SKILL.md')));
yes('agent và lệnh là bản tiếng Anh', read(join(C, 'agents', 'mission-checker.md')) === read(join(EN, 'agents', 'mission-checker.md')) && read(join(C, 'commands', 'mission-status.md')) === read(join(EN, 'commands', 'mission-status.md')));
yes('mẫu QUY-TRINH là bản tiếng Anh', read(join(C, 'mission-kit', 'templates', 'QUY-TRINH.md')) === enT('QUY-TRINH.md'));
const scripts = walk(join(VI, 'skills')).filter(p => !TEXT.test(p)).map(p => rel(VI, p));
yes(`script/tài nguyên của skill vẫn đủ (${scripts.length} tệp)`, scripts.every(s => existsSync(join(C, s))));
r = inst('--verify', '--project', APP);
yes('--verify khớp mã băm', r.status === 0, r.stdout.slice(-300));
const sessStart = () => { const ss = spawnSync('node', [join(C, 'mission-kit', 'hooks', 'session-start.mjs')], { cwd: APP, encoding: 'utf8', env, input: JSON.stringify({ cwd: APP, source: 'startup', hook_event_name: 'SessionStart' }) }); try { return JSON.parse(ss.stdout).hookSpecificOutput.additionalContext; } catch { return ss.stdout + ss.stderr; } };
let ctx = sessStart();
yes('session-start (app chưa khởi tạo): dặn nói tiếng Anh', /Kit language: English/.test(ctx), ctx.slice(0, 300));
mkdirSync(join(APP, '.git')); mkdirSync(join(APP, '.mission'));
writeFileSync(join(APP, '.mission', 'config.json'), readFileSync(join(EN, 'templates', 'config.template.json')));
ctx = sessStart();
rmSync(join(APP, '.mission'), { recursive: true, force: true }); rmSync(join(APP, '.git'), { recursive: true, force: true });
yes('session-start (app đã khởi tạo): dặn nói tiếng Anh', /Kit language: English/.test(ctx), ctx.slice(0, 300));
yes('session-start: nạp mục Autonomy and when to ask', /## Autonomy and when to ask/.test(ctx));
r = inst('--project', APP);
yes('cài lại không ghi --lang → giữ tiếng Anh', r.status === 0 && JSON.parse(readFileSync(join(C, 'mission-kit', 'installed.json'), 'utf8')).lang === 'en' && read(join(C, 'skills', 'mission-run', 'SKILL.md')) === read(join(EN, 'skills', 'mission-run', 'SKILL.md')));
r = inst('--lang', 'vi', '--project', APP);
yes('đổi sang --lang vi → về bản tiếng Việt', r.status === 0 && read(join(C, 'skills', 'mission-run', 'SKILL.md')) === read(join(VI, 'skills', 'mission-run', 'SKILL.md')) && read(join(C, 'mission-kit', 'templates', 'QUY-TRINH.md')) === read(join(VI, 'templates', 'QUY-TRINH.md')));
r = inst('--lang', 'en', '--project', APP);
r = inst('--uninstall', '--project', APP);
yes('gỡ chạy được', r.status === 0, r.stderr);
yes('gỡ xong app trở lại đúng từng byte', JSON.stringify(snap(APP)) === JSON.stringify(before), Object.keys(snap(APP)).join(', '));
r = inst('--lang', 'xx', '--project', APP);
yes('--lang lạ → từ chối', r.status === 2);
r = inst('--lang', 'en', '--brief-prompt');
yes('--brief-prompt --lang en in prompt tiếng Anh', r.status === 0 && /The prompt above|Copy the whole prompt/.test(r.stdout) && !/[ạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹđ]/i.test(r.stdout.split('\n').slice(0, 30).join('\n')), r.stdout.slice(0, 200));
rmSync(T, { recursive: true, force: true });

console.log(`\n${pass} đạt, ${fail} lỗi`);
process.exit(fail ? 1 : 0);
