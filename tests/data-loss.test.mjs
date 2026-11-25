#!/usr/bin/env node
// LỖI 11: xóa/ghi đè dữ liệu quan trọng phải HỎI (nói rõ thư mục + số tệp); junction/symlink vào dữ liệu thật phải HỎI;
// xóa đệ quy xuyên junction phải HỎI; thư mục quan trọng bị làm trống giữa 2 phiên phải có cảnh báo.
// Chỉ dùng dữ liệu giả. Mọi junction trỏ vào thư mục giả trong thư mục tạm của chính bài test, và được gỡ bằng rmdir
// (KHÔNG xóa đệ quy) trước khi dọn.  Chạy: node tests/data-loss.test.mjs
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, rmdirSync, existsSync, symlinkSync, lstatSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const KITSRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const T = mkdtempSync(join(tmpdir(), 'data-loss-')).replace(/\\/g, '/');
const APP = T + '/app';
const FAKEHOME = T + '/home'; mkdirSync(FAKEHOME, { recursive: true });
const FAKETMP = T + '/faketmp'; mkdirSync(FAKETMP, { recursive: true });
const put = (rel, text = 'x') => { const f = join(APP, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); };
const many = (dir, n) => { for (let i = 0; i < n; i++) put(`${dir}/f${i}.txt`, 'fake data ' + i); };
const ENV = { HOME: FAKEHOME, USERPROFILE: FAKEHOME, TEMP: FAKETMP, TMP: FAKETMP, TMPDIR: FAKETMP, MISSION_APPS_ROOT: 'D:\\APPS' };
const sh = (c, a, env = {}, cwd = APP) => execFileSync(c, a, { cwd, stdio: 'pipe', encoding: 'utf8', env: { ...process.env, ...ENV, ...env } });

mkdirSync(APP, { recursive: true });
many('samples', 6); many('out/golden', 4); many('tests/pdf-library-x', 3); many('build/backup', 2); many('build/tmp', 2); many('build/logs', 1); many('src', 2);
sh('git', ['init', '-q', '-b', 'main']); sh('git', ['config', 'user.email', 't@t']); sh('git', ['config', 'user.name', 't']);
sh('git', ['add', '-A']); sh('git', ['commit', '-qm', 'init']);
sh('node', [join(KITSRC, 'install.mjs'), '--project', APP]);
const KIT = APP + '/.claude/mission-kit';
sh('node', [KIT + '/mission.mjs', 'init', '--name', 'data-loss'], { MISSION_KIT: KIT });
// bỏ samples khỏi protect.deny để thấy câu hỏi (deny thắng ask) — mặc định kit vẫn có protect.important
const cfgPath = APP + '/.mission/config.json';
const cfg0 = JSON.parse(readFileSync(cfgPath, 'utf8')); cfg0.protect = { ...(cfg0.protect || {}), deny: [] };
cfg0.checks = { ...(cfg0.checks || {}), full: [{ name: 'noop', cmd: 'node -e "0"' }] };
writeFileSync(cfgPath, JSON.stringify(cfg0, null, 2));

function hook(name, tool, input, extra = {}) {
  const r = spawnSync('node', [join(KIT, 'hooks', name + '.mjs')], { cwd: APP, encoding: 'utf8',
    input: JSON.stringify({ tool_name: tool, tool_input: input, cwd: APP, hook_event_name: 'PreToolUse', ...extra }),
    env: { ...process.env, ...ENV, MISSION_KIT: KIT, CLAUDE_PROJECT_DIR: APP } });
  let decision = 'allow', reason = '';
  try { const o = JSON.parse(r.stdout).hookSpecificOutput; decision = o.permissionDecision || 'allow'; reason = o.permissionDecisionReason || ''; } catch {}
  return { status: r.status, decision, reason, stderr: r.stderr || '', stdout: r.stdout || '' };
}
const bash = c => hook('guard-bash', 'Bash', { command: c });
const ps = c => hook('guard-bash', 'PowerShell', { command: c });

let pass = 0, fail = 0;
const yes = (label, ok, info = '') => { if (ok) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log(`  ✗ ${label} ${info}`); } };
// phải HỎI, lý do nói tên thư mục và số tệp
const asks = (label, r, dirName) => yes(label, r.status === 0 && r.decision === 'ask' && r.reason.includes(dirName) && /\d+ tệp/.test(r.reason), `— nhận ${r.decision}: ${r.reason.slice(0, 200)}`);
const wants = (label, r, kind, re) => yes(label, r.status === 0 && r.decision === kind && (!re || re.test(r.reason)), `— nhận ${r.decision}: ${r.reason.slice(0, 200)}`);
const link = (target, at) => { mkdirSync(dirname(at), { recursive: true }); symlinkSync(target, at, 'junction'); };
const unlinkJ = p => { try { rmdirSync(p); } catch { try { rmSync(p); } catch {} } };

console.log('## 1. Xóa/ghi đè dữ liệu quan trọng → HỎI, nói rõ thư mục và số tệp');
for (const c of ['rm -rf samples', 'rm -r samples/', 'rm -rf ./samples', 'rm -fr "samples"', 'rm -rf out/golden', 'rm -rf tests/pdf-library-x', 'rm -rf build/backup', 'rm -rf build', 'rm -rf out', 'rm -rf samples/*'])
  asks(`bash: ${c}`, bash(c), c.includes('golden') || c === 'rm -rf out' ? 'out' : c.includes('pdf-library') ? 'pdf-library' : c.includes('backup') || c === 'rm -rf build' ? 'build/backup' : 'samples');
asks('bash: cmd //c "rd /s /q samples"', bash('cmd //c "rd /s /q samples"'), 'samples');
asks('bash: cmd /c "rmdir /s /q samples"', bash('cmd /c "rmdir /s /q samples"'), 'samples');
asks('bash: cmd //c "del /s /q samples\\*"', bash('cmd //c "del /s /q samples\\*"'), 'samples');
asks('bash: cmd.exe /c "rd /s /q out\\golden"', bash('cmd.exe /c "rd /s /q out\\golden"'), 'golden');
asks('bash: find samples -delete', bash('find samples -delete'), 'samples');
asks('bash: git clean -fdx (cả repo)', bash('git clean -fdx'), 'samples');
asks('bash: git clean -fd samples', bash('git clean -fd samples'), 'samples');
asks('bash: git rm -r samples', bash('git rm -r samples'), 'samples');
asks('bash: git rm -rf out/golden', bash('git rm -rf out/golden'), 'golden');
asks('bash: robocopy empty samples /MIR', bash('robocopy empty samples /MIR'), 'samples');
asks('bash: cmd //c "robocopy src samples /MIR /NFL"', bash('cmd //c "robocopy src samples /MIR /NFL"'), 'samples');
asks('bash: mv samples samples.old (dời dữ liệu đi)', bash('mv samples samples.old'), 'samples');
asks('bash: mv x.txt samples/f0.txt (đè tệp có sẵn)', bash('mv src/f0.txt samples/f0.txt'), 'samples');
asks('bash: cmd //c "move /y x samples\\f1.txt"', bash('cmd //c "move /y src\\f1.txt samples\\f1.txt"'), 'samples');
asks('ps: Remove-Item -Recurse -Force samples', ps('Remove-Item -Recurse -Force samples'), 'samples');
asks('ps: ri -r -fo samples', ps('ri -r -fo samples'), 'samples');
asks('ps: Remove-Item samples -Recurse', ps('Remove-Item samples -Recurse'), 'samples');
asks('ps: Remove-Item -Path out\\golden -Recurse', ps('Remove-Item -Path out\\golden -Recurse'), 'golden');
asks('ps: rmdir /s /q (qua cmd /c)', ps('cmd /c "rmdir /s /q samples"'), 'samples');
asks('ps: robocopy empty samples /MIR', ps('robocopy empty samples /MIR'), 'samples');
asks('ps: Move-Item samples samples.old', ps('Move-Item samples samples.old'), 'samples');
asks('ps: git clean -fdx', ps('git clean -fdx'), 'samples');

console.log('## 1b. Lệnh vô hại vẫn chạy bình thường');
for (const c of ['rm -rf build/tmp', 'rm build/logs/f0.txt', 'rm -f src/f0.txt', 'rm -rf src', 'cmd //c "rmdir /s /q build\\tmp"', 'cmd //c "del build\\logs\\f0.txt"', 'find build/tmp -delete', 'git rm -r src', 'robocopy samples build/tmp /E', 'mv src/f0.txt build/tmp/f0.txt', 'cp -r samples build/tmp/copy'])
  wants(`bash: ${c} → cho chạy`, bash(c), 'allow');
for (const c of ['Remove-Item -Recurse build\\tmp', 'Remove-Item build\\logs\\f0.txt', 'ri -r -fo build\\tmp', 'Copy-Item -Recurse samples build\\tmp\\copy'])
  wants(`ps: ${c} → cho chạy`, ps(c), 'allow');

console.log('## 2. Tạo junction/symlink trỏ vào D:\\APPS hoặc dữ liệu quan trọng → HỎI (chỉ phân tích lệnh, không tạo liên kết thật)');
const LINKMSG = /chép|copy/i;
for (const [l, c] of [['bash', 'cmd //c "mklink /J jk D:\\APPS\\app1\\samples"'], ['bash', 'cmd /c "mklink /J jk D:\\APPS"'], ['bash', 'cmd //c "mklink /D jk D:\\APPS\\x\\node_modules"'],
  ['bash', 'ln -s /d/APPS/x/out/golden jk'], ['bash', 'ln -sf D:/APPS/x jk'], ['bash', 'cmd //c "mklink /J jk samples"'], ['bash', 'cmd //c "mklink /J jk out\\golden"'], ['bash', 'ln -s samples jk'], ['bash', 'ln -s tests/pdf-library-x jk'],
  ['ps', 'New-Item -ItemType Junction -Path jk -Target D:\\APPS\\x'], ['ps', 'New-Item -ItemType SymbolicLink -Path jk -Value samples'], ['ps', 'ni jk -ItemType Junction -Target out\\golden'], ['ps', 'mklink /J jk samples']])
  wants(`${l}: ${c}`, (l === 'ps' ? ps : bash)(c), 'ask', LINKMSG);
for (const [l, c] of [['bash', 'cmd //c "mklink /J jk build\\tmp"'], ['bash', 'ln -s src/f0.txt jk'], ['ps', 'New-Item -ItemType Junction -Path jk -Target build\\tmp'], ['ps', 'New-Item -ItemType Directory -Path build\\x']])
  wants(`${l}: ${c} → cho chạy`, (l === 'ps' ? ps : bash)(c), 'allow');

console.log('## 3. Xóa đệ quy trong thư mục có junction/symlink bên trong → HỎI (kể cả trong thư mục tạm được miễn)');
const REAL = T + '/fakedata'; mkdirSync(REAL, { recursive: true }); writeFileSync(REAL + '/precious.txt', 'fake');
const SC = T + '/scratch'; mkdirSync(SC, { recursive: true }); writeFileSync(SC + '/keep.txt', 'k'); link(REAL, SC + '/jk');
yes('(giàn dựng) junction được Node nhận là liên kết', lstatSync(SC + '/jk').isSymbolicLink());
const jl = /junction|symlink|liên kết/i;
wants('bash: rm -rf <thư mục tạm có junction>', bash(`rm -rf "${SC}"`), 'ask', jl);
wants('bash: rm -rf chính junction', bash(`rm -rf "${SC}/jk"`), 'ask', jl);
wants('bash: cmd //c "rd /s /q <có junction>"', bash(`cmd //c "rd /s /q ${SC.replace(/\//g, '\\')}"`), 'ask', jl);
wants('ps: Remove-Item -Recurse <có junction>', ps(`Remove-Item -Recurse -Force "${SC}"`), 'ask', jl);
const IN = APP + '/build/tmp/withlink'; mkdirSync(IN, { recursive: true }); link(REAL, IN + '/jk');
wants('bash: rm -rf thư mục trong dự án có junction', bash('rm -rf build/tmp/withlink'), 'ask', jl);
const CLEAN = T + '/scratch2'; mkdirSync(CLEAN, { recursive: true }); writeFileSync(CLEAN + '/a.txt', 'x');
wants('bash: rm -rf thư mục tạm KHÔNG có junction → cho chạy', bash(`rm -rf "${CLEAN}"`), 'allow');
// xóa theo ký tự đại diện (kiểu dọn thư mục tạm dễ gây mất dữ liệu), robocopy /MIR, git clean, find -delete
wants('bash: rm -rf "<thư mục có junction>"/*', bash(`rm -rf "${SC}"/*`), 'ask', jl);
wants('bash: rm -rf "<thư mục có junction>"/jk*', bash(`rm -rf "${SC}"/jk*`), 'ask', jl);
wants('ps: Remove-Item "<thư mục có junction>\\*" -Recurse', ps(`Remove-Item "${SC.replace(/\//g, '\\')}\\*" -Recurse -Force`), 'ask', jl);
wants('bash: rm -rf "<thư mục KHÔNG có junction>"/* → cho chạy', bash(`rm -rf "${CLEAN}"/*`), 'allow');
wants('bash: rm -rf src/*.tmp (glob cuối, không khớp gì) → cho chạy', bash('rm -rf src/*.tmp'), 'allow');
wants('bash: robocopy empty <thư mục có junction> /MIR', bash(`robocopy empty "${SC.replace(/\//g, '\\')}" /MIR`), 'ask', jl);
wants('bash: robocopy empty <thư mục KHÔNG có junction> /MIR → cho chạy', bash(`robocopy empty "${CLEAN.replace(/\//g, '\\')}" /MIR`), 'allow');
wants('bash: git clean -fd <thư mục có junction>', bash('git clean -fd build/tmp/withlink'), 'ask', jl);
wants('bash: find <thư mục có junction> -delete', bash(`find "${SC}" -delete`), 'ask', jl);
wants('bash: find <thư mục KHÔNG có junction> -delete → cho chạy', bash(`find "${CLEAN}" -delete`), 'allow');
wants('bash: gỡ junction bằng cmd //c rmdir (không /s) → cho chạy', bash(`cmd //c "rmdir ${SC.replace(/\//g, '\\')}\\jk"`), 'allow');
wants('ps: gỡ junction bằng cmd /c rmdir (không /s) → cho chạy', ps(`cmd /c "rmdir ${SC.replace(/\//g, '\\')}\\jk"`), 'allow');
unlinkJ(SC + '/jk'); unlinkJ(IN + '/jk');
yes('(dọn) junction đã gỡ, dữ liệu giả còn nguyên', !existsSync(SC + '/jk') && existsSync(REAL + '/precious.txt'));

console.log('## 4. Thư mục quan trọng bị làm trống giữa 2 phiên → cảnh báo (không chặn phiên)');
const session = () => { const r = spawnSync('node', [join(KIT, 'hooks', 'session-start.mjs')], { cwd: APP, encoding: 'utf8', input: JSON.stringify({ cwd: APP, source: 'startup', hook_event_name: 'SessionStart' }),
  env: { ...process.env, ...ENV, MISSION_KIT: KIT, CLAUDE_PROJECT_DIR: APP } }); let ctx = ''; try { ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext; } catch {} return { status: r.status, ctx, stderr: r.stderr }; };
const s1 = session();
yes('phiên 1: chạy bình thường, không cảnh báo mất dữ liệu', s1.status === 0 && s1.ctx.includes('Mission Kit') && !/CẢNH BÁO MẤT DỮ LIỆU/.test(s1.ctx), s1.ctx.slice(0, 200));
const baseF = APP + '/.mission/state/important.json';
yes('phiên 1: ghi số tệp/dung lượng vào .mission/state/important.json', existsSync(baseF) && (() => { const b = JSON.parse(readFileSync(baseF, 'utf8')); const e = b.entries || b; return JSON.stringify(e).includes('samples') && JSON.stringify(e).includes('"files":6'); })(), existsSync(baseF) ? readFileSync(baseF, 'utf8').slice(0, 200) : 'không có tệp');
for (let i = 0; i < 6; i++) rmSync(APP + `/samples/f${i}.txt`);
const s2 = session();
yes('phiên 2: samples trống → cảnh báo rõ (tên thư mục, 6 → 0), phiên vẫn chạy', s2.status === 0 && /CẢNH BÁO MẤT DỮ LIỆU/.test(s2.ctx) && /samples/.test(s2.ctx) && /6/.test(s2.ctx) && /0 tệp/.test(s2.ctx), s2.ctx.slice(0, 300));
const s2b = session();
yes('phiên 3: chưa phục hồi → vẫn cảnh báo (mốc cũ được giữ, không bị ghi đè)', /CẢNH BÁO MẤT DỮ LIỆU/.test(s2b.ctx) && /samples/.test(s2b.ctx));
many('samples', 6);
const s3 = session();
yes('phục hồi đủ tệp → hết cảnh báo', !/CẢNH BÁO MẤT DỮ LIỆU/.test(s3.ctx), s3.ctx.slice(0, 200));
rmSync(APP + '/samples/f0.txt'); rmSync(APP + '/samples/f1.txt'); // 6 → 4: giảm 33%
yes('giảm 33% → cảnh báo', /CẢNH BÁO MẤT DỮ LIỆU/.test(session().ctx));
many('samples', 6);
session();
rmSync(APP + '/samples/f0.txt'); // 6 → 5: giảm 17%
yes('giảm 17% (dưới ngưỡng 20%) → không cảnh báo', !/CẢNH BÁO MẤT DỮ LIỆU/.test(session().ctx));
rmSync(APP + '/out/golden', { recursive: true }); many('out/golden', 0); mkdirSync(APP + '/out/golden');
yes('out/golden bị làm trống → cảnh báo, nêu golden', (() => { const c = session().ctx; return /CẢNH BÁO MẤT DỮ LIỆU/.test(c) && /golden/.test(c); })());
many('out/golden', 4);
session();

console.log('## 5. check --full: tìm junction trong thư mục tạm của Claude và worktree trỏ vào dữ liệu thật');
const CT = FAKETMP + '/claude/proj'; mkdirSync(CT, { recursive: true });
const runCheck = () => { const r = spawnSync('node', [KIT + '/mission.mjs', 'check', '--full'], { cwd: APP, encoding: 'utf8', env: { ...process.env, ...ENV, MISSION_KIT: KIT } }); return (r.stdout || '') + (r.stderr || ''); };
yes('không có liên kết nguy hiểm → check không báo junction', !/JUNCTION NGUY HIỂM/i.test(runCheck()));
link(APP + '/samples', CT + '/samples-link');
const c1 = runCheck();
yes('junction trong thư mục tạm của Claude trỏ vào samples → báo', /JUNCTION NGUY HIỂM/i.test(c1) && c1.includes('samples-link') && /samples/.test(c1), c1.slice(-400));
unlinkJ(CT + '/samples-link');
const WT = T + '/wt'; sh('git', ['worktree', 'add', '-q', '-b', 'wt1', WT]);
link(APP + '/out/golden', WT + '/golden-link');
const c2 = runCheck();
yes('junction trong worktree trỏ vào out/golden → báo', /JUNCTION NGUY HIỂM/i.test(c2) && c2.includes('golden-link'), c2.slice(-400));
unlinkJ(WT + '/golden-link');
yes('gỡ liên kết xong → hết báo', !/JUNCTION NGUY HIỂM/i.test(runCheck()));

console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} hỏng`);
for (const p of [SC + '/jk', IN + '/jk', CT + '/samples-link', WT + '/golden-link']) if (existsSync(p) && lstatSync(p).isSymbolicLink()) unlinkJ(p);
try { sh('git', ['worktree', 'remove', '--force', WT]); } catch {}
try { rmSync(T, { recursive: true, force: true }); } catch {}
process.exit(fail ? 1 : 0);
