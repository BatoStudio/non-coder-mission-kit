#!/usr/bin/env node
// Model AI: install --project ghi "model":"sonnet" + "advisorModel":"fable" vào .claude/settings.json của app;
// đã có giá trị khác thì giữ nguyên và báo; gỡ chỉ bỏ đúng khóa do kit ghi. session-start nhắc khi thiếu advisorModel.
// Chạy: node tests/model-config.test.mjs
import { spawnSync, execFileSync } from 'node:child_process';
import { readdirSync, mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const KITSRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = mkdtempSync(join(tmpdir(), 'model-cfg-')).replace(/\\/g, '/');
const HOME = T + '/home'; mkdirSync(HOME, { recursive: true });
const ENV = { HOME, USERPROFILE: HOME, CLAUDE_CONFIG_DIR: HOME + '/.claude' };
let pass = 0, fail = 0;
const yes = (label, ok, info = '') => { if (ok) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log(`  ✗ ${label} ${info}`); } };
let n = 0;
const app = (settings) => { const d = `${T}/app${++n}`; mkdirSync(d + '/.claude', { recursive: true }); mkdirSync(d + '/src', { recursive: true }); writeFileSync(d + '/src/a.js', 'x\n');
  if (settings !== undefined) writeFileSync(d + '/.claude/settings.json', settings);
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: d }); return d; };
const install = (d, extra = []) => { const r = spawnSync('node', [join(KITSRC, 'install.mjs'), '--project', d, ...extra], { encoding: 'utf8', env: { ...process.env, ...ENV } }); return (r.stdout || '') + (r.stderr || ''); };
const uninstall = d => { const r = spawnSync('node', [join(KITSRC, 'install.mjs'), '--uninstall', '--project', d], { encoding: 'utf8', env: { ...process.env, ...ENV } }); return (r.stdout || '') + (r.stderr || ''); };
const rd = d => { try { return JSON.parse(readFileSync(d + '/.claude/settings.json', 'utf8')); } catch { return null; } };
const manifest = d => JSON.parse(readFileSync(d + '/.claude/mission-kit/installed.json', 'utf8'));

console.log('## cài mới (chưa có settings.json)');
let d = app();
let o = install(d);
yes('settings.json có model=sonnet và advisorModel=fable', rd(d)?.model === 'sonnet' && rd(d)?.advisorModel === 'fable', JSON.stringify(rd(d)));
yes('manifest nhớ cả 2 khóa do kit ghi', manifest(d).modelKeys?.model === 'sonnet' && manifest(d).modelKeys?.advisorModel === 'fable');
yes('settings.json KHÔNG chứa hook của kit (hook vẫn ở settings.local.json)', !/mission-kit/.test(readFileSync(d + '/.claude/settings.json', 'utf8')));
o = uninstall(d);
yes('gỡ: settings.json do kit tạo được xóa sạch', !existsSync(d + '/.claude/settings.json'), o.slice(-300));

console.log('## cài đè lên settings.json có sẵn (khóa khác) rồi gỡ → trả đúng từng byte');
const ORIG = '{\n  "permissions": { "allow": ["Bash(ls:*)"] },\n  "theme": "dark"\n}\n';
d = app(ORIG); install(d);
yes('đã thêm 2 khóa, giữ khóa của app', rd(d)?.model === 'sonnet' && rd(d)?.advisorModel === 'fable' && rd(d)?.theme === 'dark');
uninstall(d);
yes('gỡ → settings.json y nguyên bản gốc', readFileSync(d + '/.claude/settings.json', 'utf8') === ORIG);

console.log('## app đã đặt giá trị khác → giữ nguyên, báo, gỡ không đụng');
d = app('{\n  "model": "opus"\n}\n');
o = install(d);
yes('báo «giữ nguyên» khóa model', /đã có "model": "opus" — giữ nguyên/.test(o), o.slice(0, 400));
yes('model vẫn là opus; advisorModel được thêm', rd(d)?.model === 'opus' && rd(d)?.advisorModel === 'fable');
yes('manifest chỉ nhớ advisorModel', manifest(d).modelKeys?.model === undefined && manifest(d).modelKeys?.advisorModel === 'fable');
// app tự sửa thêm sau khi cài → gỡ phải đi đường «bỏ phần của kit», không trả byte cũ
const s = rd(d); s.theme = 'light'; writeFileSync(d + '/.claude/settings.json', JSON.stringify(s, null, 2));
uninstall(d);
yes('gỡ (app đã sửa tệp): model=opus còn, theme còn, advisorModel của kit bị bỏ', rd(d)?.model === 'opus' && rd(d)?.theme === 'light' && rd(d)?.advisorModel === undefined, JSON.stringify(rd(d)));

console.log('## app tự đặt đúng giá trị kit định ghi (model=sonnet) → không phải của kit, gỡ giữ lại');
d = app('{\n  "model": "sonnet"\n}\n'); install(d);
yes('manifest không nhận model là của kit', manifest(d).modelKeys?.model === undefined);
const s2 = rd(d); s2.x = 1; writeFileSync(d + '/.claude/settings.json', JSON.stringify(s2));
uninstall(d);
yes('gỡ: model=sonnet của app còn nguyên', rd(d)?.model === 'sonnet' && rd(d)?.advisorModel === undefined, JSON.stringify(rd(d)));

console.log('## cài đè lần 2');
d = app(); install(d); const before = readFileSync(d + '/.claude/settings.json', 'utf8');
o = install(d);
yes('cài đè lần 2: settings.json không đổi, không báo «giữ nguyên»', readFileSync(d + '/.claude/settings.json', 'utf8') === before && !/giữ nguyên \(kit đề nghị/.test(o), o.slice(0, 300));
yes('cài đè: quyền sở hữu 2 khóa còn nguyên', manifest(d).modelKeys?.model === 'sonnet' && manifest(d).modelKeys?.advisorModel === 'fable');
uninstall(d);
yes('cài 2 lần rồi gỡ → sạch (không còn settings.json)', !existsSync(d + '/.claude/settings.json'));
d = app(); install(d);
const s3 = rd(d); s3.model = 'haiku'; writeFileSync(d + '/.claude/settings.json', JSON.stringify(s3, null, 2));
o = install(d);
yes('app đổi model→haiku sau khi cài: cài đè giữ haiku và báo', rd(d)?.model === 'haiku' && /đã có "model": "haiku" — giữ nguyên/.test(o), o.slice(0, 300));
yes('…và không còn coi model là của kit', manifest(d).modelKeys?.model === undefined && manifest(d).modelKeys?.advisorModel === 'fable');
uninstall(d);
yes('gỡ: haiku còn, advisorModel của kit bị bỏ', rd(d)?.model === 'haiku' && rd(d)?.advisorModel === undefined, JSON.stringify(rd(d)));

console.log('## --dry-run và cài toàn máy không đụng model');
d = app(); o = install(d, ['--dry-run']);
yes('--dry-run: không tạo settings.json', !existsSync(d + '/.claude/settings.json'));

console.log('## session-start: nhắc 1 dòng khi không thấy advisorModel');
const session = dir => { const r = spawnSync('node', [join(dir, '.claude/mission-kit/hooks/session-start.mjs')], { cwd: dir, encoding: 'utf8', input: JSON.stringify({ cwd: dir, source: 'startup' }),
  env: { ...process.env, ...ENV, MISSION_KIT: dir + '/.claude/mission-kit', CLAUDE_PROJECT_DIR: dir } }); let c = ''; try { c = JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch {} return { r, c }; };
const withMission = dir => execFileSync('node', [dir + '/.claude/mission-kit/mission.mjs', 'init', '--name', 'm'], { cwd: dir, stdio: 'pipe', env: { ...process.env, ...ENV, MISSION_KIT: dir + '/.claude/mission-kit' } });
d = app(); install(d); withMission(d);
let r1 = session(d);
yes('cài mới (có advisorModel) → không nhắc', r1.r.status === 0 && r1.c.includes('Mission Kit') && !/Chưa bật advisor/.test(r1.c), r1.c.slice(0, 200));
const s4 = rd(d); delete s4.advisorModel; writeFileSync(d + '/.claude/settings.json', JSON.stringify(s4, null, 2));
r1 = session(d);
yes('thiếu advisorModel → đúng 1 dòng nhắc /advisor fable, phiên vẫn chạy', r1.r.status === 0 && (r1.c.match(/Chưa bật advisor/g) || []).length === 1 && /\/advisor fable/.test(r1.c));
mkdirSync(HOME + '/.claude', { recursive: true }); writeFileSync(HOME + '/.claude/settings.json', JSON.stringify({ advisorModel: 'fable' }));
r1 = session(d);
yes('advisorModel ở settings cấp máy → không nhắc', !/Chưa bật advisor/.test(r1.c));
rmSync(HOME + '/.claude/settings.json');
writeFileSync(d + '/.claude/settings.local.json', JSON.stringify({ ...JSON.parse(readFileSync(d + '/.claude/settings.local.json', 'utf8')), advisorModel: 'fable' }));
r1 = session(d);
yes('advisorModel ở settings.local.json → không nhắc', !/Chưa bật advisor/.test(r1.c));

console.log('## ledger: lệnh ghi lần hỏi advisor trong skill mission-run chạy được');
const skill = readFileSync(KITSRC + '/kit/skills/mission-run/SKILL.md', 'utf8');
const m = /`node "\$MISSION_KIT\/mission\.mjs" (ledger add --severity LOW[^`]*--source advisor[^`]*)`/.exec(skill);
yes('skill có lệnh ledger add cho lần hỏi advisor', !!m);
if (m) {
  const args = m[1].replace('<chủ đề, mã đơn vị>', 'nguyên nhân gốc lỗi X (u1)').replace('<kết luận/nguyên nhân gốc advisor đưa ra>', 'đọc sai đơn vị mm');
  const re = [...args.matchAll(/"[^"]*"|\S+/g)].map(x => x[0].replace(/^"|"$/g, ''));
  const rr = spawnSync('node', [d + '/.claude/mission-kit/mission.mjs', ...re], { cwd: d, encoding: 'utf8', env: { ...process.env, ...ENV, MISSION_KIT: d + '/.claude/mission-kit' } });
  yes('lệnh được mission.mjs chấp nhận (thoát 0)', rr.status === 0, (rr.stdout + rr.stderr).slice(0, 300));
  yes('dòng sổ có nguồn advisor', /advisor/.test(readFileSync(d + '/.mission/ledger.jsonl', 'utf8')));
  const run = a => spawnSync('node', [d + '/.claude/mission-kit/mission.mjs', ...a], { cwd: d, encoding: 'utf8', env: { ...process.env, ...ENV, MISSION_KIT: d + '/.claude/mission-kit' } });
  const dn = run(['done']);
  yes('mục advisor (LOW/lưu ý) đang mở KHÔNG chặn Definition of Done', /✓ Không còn lỗi CRITICAL\/HIGH mở/.test(dn.stdout) && /✓ Không còn vướng mắc/.test(dn.stdout));
  const cl = run(['ledger', 'close', 'L-0001', '--verify', 'đã áp dụng lời khuyên; test đạt']);
  yes('đóng mục advisor bằng ledger close theo lời trong skill', cl.status === 0 && /fixed/.test(cl.stdout), (cl.stdout + cl.stderr).slice(0, 200));
  yes('skill có dặn đóng sổ sau khi áp dụng', /ledger close <mã> --verify/.test(skill));
}

console.log('## mỗi subagent khai model rõ (không inherit)');
const want = { 'mission-explorer': 'haiku', 'mission-verifier': 'sonnet', 'mission-visual-qa': 'sonnet' };
for (const f of readdirSync(join(KITSRC, 'kit/agents')).filter(x => x.endsWith('.md'))) {
  const nm = f.replace(/\.md$/, ''); const m = (readFileSync(join(KITSRC, 'kit/agents', f), 'utf8').match(/^model:\s*(\S+)/m) || [])[1];
  yes(nm + ': model ' + (want[nm] || 'opus'), m === (want[nm] || 'opus'), String(m));
}

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} hỏng`);
try { rmSync(T, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
