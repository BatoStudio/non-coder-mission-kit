#!/usr/bin/env node
// mission-protect: chỉ làm rối BẢN BUILD, từ chối mã nguồn (git-tracked), giữ vendor, bỏ source map,
// cảnh báo bí mật lọt ra client, bắt lỗi esbuild ghi .js lạ. Dùng esbuild GIẢ để test ngoại tuyến (tất định);
// có thêm 1 test esbuild THẬT kiểu best-effort (ngoại tuyến thì bỏ qua). Chạy: node tests/protect.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';

const KITSRC = join(dirname(fileURLToPath(import.meta.url)), '..');
const SCRIPT = join(KITSRC, 'kit', 'skills', 'mission-protect', 'scripts', 'protect.mjs');
let pass = 0, fail = 0;
const ok = (l) => { pass++; console.log('  ✓ ' + l); };
const bad = (l, info = '') => { fail++; console.log(`  ✗ ${l} ${info}`); };
const yes = (l, cond, info = '') => cond ? ok(l) : bad(l, info);

const T = mkdtempSync(join(tmpdir(), 'protect-test-')).replace(/\\/g, '/');
const WIN = process.platform === 'win32';

// esbuild GIẢ: bỏ chú thích //…, gộp khoảng trắng, ghi lại ĐÚNG đuôi .mjs (theo --out-extension). Ngoại tuyến, tất định.
const FAKE = join(T, 'fake-esbuild.mjs');
writeFileSync(FAKE, `
import { readFileSync, writeFileSync } from 'node:fs';
const args = process.argv.slice(2);
const rels = args.filter(a => !a.startsWith('-'));
for (const r of rels) { const t = readFileSync(r, 'utf8').replace(/^\\s*\\/\\/.*$/gm, '').replace(/\\n\\s*\\n/g, '\\n').replace(/\\s{2,}/g, ' '); writeFileSync(r, '/*min*/' + t.trim() + '\\n'); }
process.exit(0);
`);
// esbuild GIẢ HỎNG: ghi ra .js thay vì .mjs (giả lập lỗi cấu hình đuôi) → script phải bắt được
const FAKEBAD = join(T, 'fake-esbuild-badext.mjs');
writeFileSync(FAKEBAD, `
import { readFileSync, writeFileSync } from 'node:fs';
for (const r of process.argv.slice(2).filter(a => !a.startsWith('-') && a.endsWith('.mjs'))) writeFileSync(r.replace(/\\.mjs$/, '.js'), 'x\\n');
process.exit(0);
`);
const ESB = `node ${FAKE}`, ESB_BAD = `node ${FAKEBAD}`;

const run = (args, cwd) => spawnSync('node', [SCRIPT, ...args], { cwd, encoding: 'utf8' });
const git = (cwd, ...a) => spawnSync('git', ['-C', cwd, ...a], { encoding: 'utf8' });

// --- dựng repo: src/ (track = mã nguồn), dist/ (không track = bản build) ---
const APP = join(T, 'app'); mkdirSync(join(APP, 'src'), { recursive: true });
git(APP, 'init', '-q', '-b', 'main'); git(APP, 'config', 'user.email', 't@t'); git(APP, 'config', 'user.name', 't');
writeFileSync(join(APP, 'src', 'a.mjs'), 'export const x = 1;\n');
writeFileSync(join(APP, '.gitignore'), 'dist/\n');
git(APP, 'add', '-A'); git(APP, 'commit', '-qm', 'init');

function freshDist() {
  const d = join(APP, 'dist'); rmSync(d, { recursive: true, force: true });
  mkdirSync(join(d, 'property'), { recursive: true });
  mkdirSync(join(d, 'vendor', 'three'), { recursive: true });
  writeFileSync(join(d, 'app.mjs'), 'import {draw} from "./property/draw.mjs";\n// chú thích dài không cần\nconsole.log(draw(1,2));\n');
  writeFileSync(join(d, 'property', 'draw.mjs'), 'export function draw(soMot, soHai){\n  const ketQua = soMot + soHai;\n  return ketQua;\n}\n');
  writeFileSync(join(d, 'vendor', 'three', 'three.module.min.js'), 'export const THREE=1;//giữ nguyên\n');
  return d;
}

console.log('## mission-protect');

// 1. từ chối thư mục không có / trùng cwd / không có .mjs
yes('thiếu thư mục → lỗi', run([], APP).status !== 0);
yes('thư mục không tồn tại → lỗi', run(['khong-co'], APP).status !== 0);
{ const d = join(APP, 'onlyjs'); mkdirSync(d, { recursive: true }); writeFileSync(join(d, 'a.js'), 'var x=1\n');
  yes('chỉ có .js cổ điển → từ chối (chỉ nhận .mjs)', run([d, '--no-minify'], APP).status !== 0); }

// 2. CHẶN mã nguồn đang được git theo dõi
{ const r = run(['src', '--esbuild', ESB], APP);
  yes('chạy trên MÃ NGUỒN (git-tracked) → TỪ CHỐI', r.status !== 0 && /TỪ CHỐI|theo dõi/.test(r.stderr), r.stderr.slice(0, 120)); }

// 3. dry-run: không đổi tệp, liệt kê giữ vendor
{ freshDist(); const before = readFileSync(join(APP, 'dist', 'app.mjs'), 'utf8');
  const r = run(['dist', '--dry-run', '--esbuild', ESB], APP);
  yes('dry-run → thoát 0', r.status === 0);
  yes('dry-run → không sửa tệp', readFileSync(join(APP, 'dist', 'app.mjs'), 'utf8') === before);
  yes('dry-run → nêu giữ vendor', /vendor/.test(r.stdout), r.stdout.slice(0, 160)); }

// 4. pipeline đầy đủ với esbuild GIẢ: rút gọn .mjs, GIỮ vendor, bỏ .map, giữ import/export
{ const d = freshDist();
  writeFileSync(join(d, 'app.mjs.map'), '{"x":1}\n');
  writeFileSync(join(d, 'app.mjs'), 'import {draw} from "./property/draw.mjs";\nconsole.log(draw(1,2));\n//# sourceMappingURL=app.mjs.map\n');
  const r = run(['dist', '--esbuild', ESB], APP);
  yes('chạy xong → thoát 0', r.status === 0, r.stderr.slice(0, 160));
  const app = readFileSync(join(d, 'app.mjs'), 'utf8');
  yes('đã rút gọn (có dấu /*min*/)', app.includes('/*min*/'));
  yes('giữ import ./property/draw.mjs', app.includes('./property/draw.mjs'));
  yes('bỏ dòng sourceMappingURL', !app.includes('sourceMappingURL'));
  yes('xóa tệp .map', !existsSync(join(d, 'app.mjs.map')));
  yes('GIỮ NGUYÊN vendor/three', readFileSync(join(d, 'vendor', 'three', 'three.module.min.js'), 'utf8').includes('giữ nguyên'));
  yes('báo bỏ 1 source map', /bỏ 1 source map/.test(r.stdout), r.stdout); }

// 5. --keep thêm: giữ nguyên tệp chỉ định
{ const d = freshDist(); writeFileSync(join(d, 'property', 'keepme.mjs'), 'export const keep = true; // nguyên\n');
  run(['dist', '--esbuild', ESB, '--keep', '**/keepme.mjs'], APP);
  yes('--keep giữ tệp chỉ định', readFileSync(join(d, 'property', 'keepme.mjs'), 'utf8').includes('nguyên')); }

// 6. cảnh báo bí mật lọt ra client (quét ngược)
{ const d = freshDist(); const tok = 'ghp_' + 'A'.repeat(36);
  writeFileSync(join(d, 'property', 'draw.mjs'), `export const draw = () => "${tok}";\n`);
  const r = run(['dist', '--no-minify', '--json'], APP);
  const rep = JSON.parse(r.stdout);
  yes('bí mật trong bản client → cảnh báo', rep.warnings.some(w => /bí mật/.test(w)), JSON.stringify(rep.warnings)); }

// 7. esbuild ghi .js lạ (lỗi đuôi) → script phải DỪNG, không để bản gốc chưa rối
{ const d = freshDist(); const r = run(['dist', '--esbuild', ESB_BAD], APP);
  yes('esbuild tạo .js lạ → TỪ CHỐI (không deploy nhầm bản gốc)', r.status !== 0 && /\.js lạ|lạ/.test(r.stderr), r.stderr.slice(0, 160)); }

// 8. không phải repo git → vẫn chạy (không có lớp chặn git, nhưng không văng)
{ const solo = join(T, 'solo'); mkdirSync(solo, { recursive: true }); writeFileSync(join(solo, 'a.mjs'), 'export const x=1 // c\n');
  const r = run(['solo', '--esbuild', ESB], T); // cwd = cha, để không trúng chốt "trùng thư mục hiện tại"
  yes('thư mục không phải repo → vẫn rút gọn được', r.status === 0 && readFileSync(join(solo, 'a.mjs'), 'utf8').includes('/*min*/'), r.stderr.slice(0, 120)); }

// 9. best-effort: esbuild THẬT (ngoại tuyến thì BỎ QUA, tính là đạt)
{ const d = freshDist();
  const probe = spawnSync(WIN ? 'npx.cmd' : 'npx', ['-y', 'esbuild@0.24.2', '--version'], { encoding: 'utf8', shell: WIN, timeout: 120000 });
  if (probe.status === 0) {
    const r = run(['dist'], APP);
    const draw = existsSync(join(d, 'property', 'draw.mjs')) ? readFileSync(join(d, 'property', 'draw.mjs'), 'utf8') : '';
    yes('esbuild THẬT: rút gọn + giữ export draw', r.status === 0 && /export\s*{[^}]*draw|as draw/.test(draw) && !draw.includes('ketQua'), (r.stderr || draw).slice(0, 160));
    yes('esbuild THẬT: không để tệp .js lạ', !existsSync(join(d, 'app.js')) && !existsSync(join(d, 'property', 'draw.js')));
  } else { ok('esbuild THẬT: BỎ QUA (ngoại tuyến, không tải được esbuild@0.24.2)'); ok('esbuild THẬT (.js lạ): BỎ QUA (ngoại tuyến)'); }
}

rmSync(T, { recursive: true, force: true });
console.log(`\nKẾT QUẢ: ${pass} đạt, ${fail} hỏng`);
process.exit(fail ? 1 : 0);
