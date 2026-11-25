#!/usr/bin/env node
// Làm rối BẢN BUILD (chỉ dist/, không bao giờ đụng mã nguồn) để chống chép lại.
//   node protect.mjs <thư-mục-build> [--obfuscate] [--hard] [--keep <glob> …] [--no-minify] [--json] [--dry-run]
// Mặc định: rút gọn (minify) từng tệp .mjs bằng esbuild — đổi tên biến cục bộ, bỏ chú thích/khoảng trắng,
// GIỮ import/export nên app chạy y như cũ. --obfuscate thêm một lớp mã hóa chuỗi (javascript-obfuscator).
// KHÔNG tự tải gì khi --dry-run. Thư viện trong vendor/ và tệp *.min.js luôn được giữ nguyên.
//
// An toàn: TỪ CHỐI nếu thư mục đích chứa tệp đang được git theo dõi (đó là MÃ NGUỒN, không phải bản build).
// Bản build luôn dựng lại được từ nguồn, nên script không sao lưu — hỏng thì build lại.

import { readdirSync, statSync, readFileSync, writeFileSync, rmSync, existsSync, mkdtempSync } from 'node:fs';
import { resolve, relative, join, basename, extname, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

// Phiên bản ghim (xem lại được, đổi tay nếu cần). npx sẽ tải đúng bản này, không lấy "mới nhất".
export const ESBUILD_PIN = 'esbuild@0.24.2';
export const OBFUSCATOR_PIN = 'javascript-obfuscator@4.1.1';

const WIN = process.platform === 'win32';
const posix = p => p.split(sep).join('/');
const NPX = WIN ? 'npx.cmd' : 'npx';

// --- glob tối giản: **, *, ? trên đường dẫn posix ---
function globRe(g) {
  const re = g.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\u0000').replace(/\*/g, '[^/]*').replace(/\u0000/g, '.*').replace(/\?/g, '[^/]');
  return new RegExp('^' + re + '$', 'i');
}
const matchAny = (rel, globs) => globs.some(g => globRe(g).test(rel));

function listFiles(dir, base = dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e), st = statSync(p);
    if (st.isDirectory()) listFiles(p, base, out);
    else out.push(posix(relative(base, p)));
  }
  return out;
}

// Tệp đang được git theo dõi (đường dẫn TƯƠNG ĐỐI với absDir) = mã nguồn.
function trackedFiles(absDir) {
  const r = spawnSync('git', ['-C', absDir, 'ls-files', '-z', '--', '.'], { encoding: 'utf8' });
  if (r.status !== 0 || r.error) return null; // không phải repo / không có git → không chặn theo cách này
  return new Set((r.stdout || '').split('\0').filter(Boolean).map(posix));
}

// Windows: spawn .cmd phải qua shell; tự bọc nháy cho tham số có khoảng trắng.
function spawnTool(cmd, args, opts = {}) {
  if (!WIN) return spawnSync(cmd, args, { encoding: 'utf8', ...opts });
  const q = a => /[\s"^&|<>]/.test(a) ? '"' + a.replace(/"/g, '\\"') + '"' : a;
  return spawnSync(q(cmd), args.map(q), { encoding: 'utf8', shell: true, ...opts });
}

const SECRET_RE = /-----BEGIN [A-Z ]*PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|AKIA[0-9A-Z]{16}|sk-ant-[A-Za-z0-9_-]{20,}|xox[abprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{30,}|sk_live_[0-9A-Za-z]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/;
const SMAP_RE = /^[ \t]*\/\/[#@][ \t]*sourceMappingURL=.*$/gm;
const SMAP_BLOCK_RE = /\/\*[#@][ \t]*sourceMappingURL=[\s\S]*?\*\//g;

function parseArgs(argv) {
  const o = { keep: [], obfuscate: false, hard: false, noMinify: false, json: false, dry: false, dir: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--obfuscate') o.obfuscate = true;
    else if (a === '--hard') { o.obfuscate = true; o.hard = true; }
    else if (a === '--no-minify') o.noMinify = true;
    else if (a === '--json') o.json = true;
    else if (a === '--dry-run') o.dry = true;
    else if (a === '--keep') o.keep.push(argv[++i]);
    else if (a === '--esbuild') o.esbuild = argv[++i];
    else if (a === '--obfuscator') o.obfuscator = argv[++i];
    else if (!a.startsWith('-') && !o.dir) o.dir = a;
    else throw new Error(`Tham số lạ: ${a}`);
  }
  return o;
}

// Rút gọn: một lần gọi esbuild cho mọi tệp .mjs. Đường dẫn TƯƠNG ĐỐI + cwd=absDir, outbase=. giữ cây thư mục.
function minify(absDir, rels, esbuildCmd) {
  const cmd = esbuildCmd ? esbuildCmd.split(' ') : [NPX, '-y', ESBUILD_PIN];
  // --out-extension giữ đuôi .mjs (mặc định esbuild ghi .js, để lại tệp .mjs gốc chưa rút gọn bên cạnh)
  const args = [...cmd.slice(1), ...rels, '--minify', '--format=esm', '--charset=utf8',
    '--outdir=.', '--outbase=.', '--out-extension:.js=.mjs', '--allow-overwrite', '--log-level=warning'];
  const r = spawnTool(cmd[0], args, { cwd: absDir });
  if (r.error) throw new Error(`Không chạy được esbuild (${cmd[0]}): ${r.error.message}. Cài esbuild hoặc cho mạng để npx tải ${ESBUILD_PIN}.`);
  if (r.status !== 0) throw new Error(`esbuild lỗi:\n${(r.stderr || r.stdout || '').slice(0, 800)}`);
  return r.stderr || '';
}

function obfuscate(absDir, rels, cmd, hard) {
  const base = cmd ? cmd.split(' ') : [NPX, '-y', OBFUSCATOR_PIN];
  // CLI chỉ nhận .js → chép tạm sang .js, làm rối, ghi kết quả trở lại .mjs
  const tmp = mkdtempSync(join(tmpdir(), 'mission-protect-'));
  try {
    for (const rel of rels) {
      const src = join(absDir, rel), tIn = join(tmp, 'in.js'), tOut = join(tmp, 'out.js');
      writeFileSync(tIn, readFileSync(src));
      // không đổi tên biến toàn cục (--rename-globals false) để giữ tên export → import các tệp khác vẫn khớp
      const args = [...base.slice(1), tIn, '--output', tOut, '--target', 'browser',
        '--compact', 'true', '--string-array', 'true', '--string-array-threshold', '0.75',
        '--string-array-encoding', 'base64', '--rename-globals', 'false', '--identifier-names-generator', 'mangled',
        '--self-defending', String(hard), '--control-flow-flattening', String(hard)];
      const r = spawnTool(base[0], args);
      if (r.error) throw new Error(`Không chạy được javascript-obfuscator: ${r.error.message}`);
      if (r.status !== 0) throw new Error(`javascript-obfuscator lỗi ở ${rel}:\n${(r.stderr || '').slice(0, 500)}`);
      writeFileSync(src, readFileSync(tOut));
    }
  } finally { rmSync(tmp, { recursive: true, force: true }); }
}

export function run(argv) {
  const o = parseArgs(argv);
  if (!o.dir) throw new Error('Thiếu thư mục build. Ví dụ: node protect.mjs dist');
  const absDir = resolve(o.dir);
  if (!existsSync(absDir) || !statSync(absDir).isDirectory()) throw new Error(`Không thấy thư mục: ${absDir}`);
  if (absDir === resolve('.') || absDir === resolve(process.cwd())) throw new Error('Thư mục đích trùng thư mục hiện tại — đây không phải thư mục build riêng. Dừng lại.');

  const KEEP = ['**/vendor/**', '**/*.min.js', '**/*.map', ...o.keep];
  const all = listFiles(absDir);
  const targets = all.filter(r => extname(r).toLowerCase() === '.mjs' && !matchAny(r, KEEP));
  if (!targets.length) throw new Error(`Không có tệp .mjs nào để xử lý trong ${absDir} (đã bỏ vendor/ và *.min.js). Chỉ nhận .mjs; .js cổ điển không tự xử lý.`);

  // chặn fail-closed: tệp đang được git theo dõi là MÃ NGUỒN (tracked và targets đều tương đối với absDir)
  const tracked = trackedFiles(absDir);
  if (tracked) {
    const bad = targets.filter(r => tracked.has(r));
    if (bad.length) throw new Error(`TỪ CHỐI: ${bad.length} tệp đang được git theo dõi (vd. ${bad.slice(0, 3).join(', ')}). Đó là mã nguồn, không phải bản build. Chỉ chạy trên thư mục build (dist/) đã bị .gitignore bỏ qua.`);
  }

  const report = { dir: posix(absDir), json: o.json, targets: targets.length, kept: all.filter(r => (extname(r) === '.mjs' || extname(r) === '.js') && matchAny(r, KEEP)), minify: !o.noMinify, obfuscate: o.obfuscate, hard: o.hard, warnings: [], bytesBefore: 0, bytesAfter: 0 };
  for (const r of targets) report.bytesBefore += statSync(join(absDir, r)).size;

  if (o.dry) {
    report.dryRun = true;
    report.tools = [o.noMinify ? null : (o.esbuild || ESBUILD_PIN), o.obfuscate ? (o.obfuscator || OBFUSCATOR_PIN) : null].filter(Boolean);
    return report;
  }

  if (!o.noMinify) minify(absDir, targets, o.esbuild);
  // esbuild có thể ghi ra .js thay vì .mjs (lỗi cấu hình đuôi) → để lại bản gốc chưa rối. Bắt lỗi này.
  const strayJs = targets.map(r => r.replace(/\.mjs$/, '.js')).filter(j => !all.includes(j) && existsSync(join(absDir, j)));
  if (strayJs.length) throw new Error(`esbuild tạo tệp .js lạ (${strayJs.slice(0, 3).join(', ')}) thay vì ghi đè .mjs — bản gốc chưa rối vẫn còn. Dừng để khỏi deploy nhầm; báo lỗi này.`);
  if (o.obfuscate) obfuscate(absDir, targets, o.obfuscator, o.hard);

  // bỏ source map (lộ lại mã gốc)
  let mapsDeleted = 0;
  for (const r of all) if (r.endsWith('.map')) { rmSync(join(absDir, r)); mapsDeleted++; }
  report.mapsDeleted = mapsDeleted;
  for (const r of targets) {
    const f = join(absDir, r); let t = readFileSync(f, 'utf8');
    const t2 = t.replace(SMAP_RE, '').replace(SMAP_BLOCK_RE, '');
    if (t2 !== t) writeFileSync(f, t2);
    report.bytesAfter += Buffer.byteLength(t2);
  }

  // quét ngược bản ra: còn chú thích dài, source map, hay chuỗi giống bí mật không
  for (const r of all.filter(x => /\.(mjs|js|css|html?)$/i.test(x) && !matchAny(x, ['**/vendor/**', '**/*.map']))) {
    let t; try { t = readFileSync(join(absDir, r), 'utf8'); } catch { continue; }
    if (SECRET_RE.test(t)) report.warnings.push(`${r}: có chuỗi GIỐNG bí mật trong bản gửi xuống trình duyệt — kiểm lại, không để lọt token/khóa ra client.`);
    if (/sourceMappingURL=/.test(t)) report.warnings.push(`${r}: còn tham chiếu sourceMappingURL — map lộ lại mã gốc.`);
    const longComments = (t.match(/\/\*[\s\S]{200,}?\*\//g) || []).length;
    if (extname(r).toLowerCase() === '.mjs' && longComments) report.warnings.push(`${r}: còn ${longComments} khối chú thích dài (>200 ký tự) sau khi rút gọn — có thể minify đã bỏ sót tệp này.`);
    if (extname(r).toLowerCase() === '.mjs' && targets.includes(r)) {
      const lines = t.split('\n').length, sz = Buffer.byteLength(t);
      if (lines > 40 && sz > 4000 && !o.noMinify) report.warnings.push(`${r}: vẫn ${lines} dòng sau khi rút gọn — xem lại tệp này đã được xử lý chưa.`);
    }
  }
  report.savedPct = report.bytesBefore ? Math.round((1 - report.bytesAfter / report.bytesBefore) * 100) : 0;
  return report;
}

// chạy trực tiếp
if (import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(posix(process.argv[1]))) {
  try {
    const rep = run(process.argv.slice(2));
    if (rep.json) process.stdout.write(JSON.stringify(rep, null, 2) + '\n');
    else {
      if (rep.dryRun) {
        console.log(`[thử] sẽ xử lý ${rep.targets} tệp .mjs trong ${rep.dir}`);
        console.log(`[thử] giữ nguyên: ${rep.kept.length ? rep.kept.join(', ') : '(không có)'}`);
        console.log(`[thử] công cụ: ${rep.tools.join(', ') || '(không rút gọn)'}`);
      } else {
        console.log(`Đã xử lý ${rep.targets} tệp .mjs trong ${rep.dir}`);
        console.log(`  rút gọn: ${rep.minify ? 'có' : 'không'} · làm rối: ${rep.obfuscate ? (rep.hard ? 'mạnh' : 'có') : 'không'} · bỏ ${rep.mapsDeleted} source map`);
        console.log(`  dung lượng: ${(rep.bytesBefore / 1024).toFixed(1)} KB → ${(rep.bytesAfter / 1024).toFixed(1)} KB${rep.savedPct >= 0 ? ` (giảm ${rep.savedPct}%)` : ' (obfuscate làm tăng dung lượng — bình thường, đó là bộ mã hóa chuỗi)'}`);
        console.log(`  giữ nguyên: ${rep.kept.length ? rep.kept.join(', ') : '(không có)'}`);
        if (rep.warnings.length) { console.log('  ⚠ CẢNH BÁO:'); for (const w of rep.warnings) console.log('    - ' + w); }
        else console.log('  ✓ không thấy bí mật, source map hay tệp bỏ sót trong bản ra.');
      }
    }
    process.exit(0);
  } catch (e) {
    console.error('✗ ' + e.message);
    process.exit(1);
  }
}
