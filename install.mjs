#!/usr/bin/env node
// Cài Mission Kit cho Claude Code.
//   node install.mjs --project "<thư mục app>"   cài cho MỘT app (khuyên dùng)
//   node install.mjs --global                    cài cho cả máy (~/.claude)
//   node install.mjs --uninstall --project "<thư mục app>"  |  --uninstall --global
//   thêm --dry-run để xem trước, không ghi gì
//   thêm --lang en để cài bản tiếng Anh (English version); cài lại không ghi --lang thì giữ ngôn ngữ lần trước
//   node install.mjs --brief-prompt              in prompt viết brief cho ChatGPT, chép vào clipboard (không cài gì)
// Nguyên tắc an toàn:
//   - không bao giờ ghi đè skill/agent/lệnh/hook sẵn có không phải của kit (tên kit đều có tiền tố mission-)
//   - ghi danh sách tệp đã cài vào mission-kit/installed.json; gỡ chỉ xóa đúng các tệp đó
//   - kiểm tra mọi thứ (JSON, xung đột) TRƯỚC khi ghi
//   - nhớ nguyên bản (từng byte) của settings*.json và .gitignore lúc cài lần đầu; gỡ thì trả đúng nguyên bản
//   - --project: ghi thêm "model": "sonnet" và "advisorModel": "fable" vào .claude/settings.json của app (chỉ khi app chưa đặt giá trị khác);
//     manifest nhớ khóa nào do kit ghi (modelKeys) — gỡ chỉ bỏ đúng khóa đó và chỉ khi giá trị còn nguyên
//     (nếu sau đó bạn tự sửa các tệp này thì gỡ chỉ bỏ phần của kit, giữ phần bạn sửa)
import { cpSync, rmSync, mkdirSync, readdirSync, readFileSync, writeFileSync, existsSync, copyFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), 'kit');
const args = process.argv.slice(2);
const has = f => args.includes(f);
const dry = has('--dry-run'), uninstall = has('--uninstall'), global = has('--global'), verify = has('--verify');
const pi = args.indexOf('--project');
const projArg = pi >= 0 ? args[pi + 1] : undefined;
const die = m => { console.error('✗ ' + m); process.exit(2); };
// Ngôn ngữ: --lang vi (mặc định) | en. Bản tiếng Anh nằm ở kit-en/ cùng đường dẫn tương đối với kit/ — chỉ gồm tệp chữ (.md, mẫu);
// lúc cài, tệp tiếng Anh chép đè lên bản tiếng Việt tương ứng. Tên skill/lệnh/tệp giữ nguyên ở cả hai bản.
const ENSRC = resolve(dirname(fileURLToPath(import.meta.url)), 'kit-en');
const li = args.indexOf('--lang');
const langArg = li >= 0 ? args[li + 1] : undefined;
if (li >= 0 && !['vi', 'en'].includes(langArg)) die('--lang cần vi hoặc en (--lang must be vi or en)');
let lang = langArg || 'vi'; // cài lại không ghi --lang → giữ ngôn ngữ lần trước (đặt lại sau khi đọc installed.json)
const T = (vi, en) => lang === 'en' ? en : vi;
const enOf = p => { if (lang !== 'en') return null; const e = resolve(ENSRC, p.slice(SRC.length + 1)); return existsSync(e) ? e : null; };

// --brief-prompt: in prompt viết brief cho ChatGPT và chép vào clipboard (Windows) — không cài gì.
if (has('--brief-prompt')) {
  const gsrc = resolve(SRC, 'templates', 'HUONG-DAN-BRIEF-CHATGPT.md');
  const guide = readFileSync(enOf(gsrc) || gsrc, 'utf8');
  const m = guide.match(/## (?:Prompt dán vào ChatGPT|Prompt to paste into ChatGPT)[\s\S]*?```markdown\r?\n([\s\S]*?)\r?\n```/);
  if (!m) die(T('Không tìm thấy khối prompt trong templates/HUONG-DAN-BRIEF-CHATGPT.md', 'Prompt block not found in templates/HUONG-DAN-BRIEF-CHATGPT.md'));
  const prompt = m[1];
  let copied = false;
  if (process.platform === 'win32') {
    const tmp = join(tmpdir(), `mission-brief-prompt-${process.pid}.txt`);
    try {
      writeFileSync(tmp, prompt, 'utf8');
      execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', 'Set-Clipboard -Value (Get-Content -Raw -Encoding UTF8 -LiteralPath $env:MISSION_PROMPT_FILE)'],
        { env: { ...process.env, MISSION_PROMPT_FILE: tmp }, stdio: 'ignore' });
      copied = true;
    } catch { /* không chép được thì vẫn in ra */ } finally { rmSync(tmp, { force: true }); }
  }
  console.log(prompt + '\n');
  console.log(copied
    ? T('✓ Đã chép prompt trên vào clipboard. Mở ChatGPT, tạo cuộc trò chuyện mới, bấm Ctrl+V rồi Enter.', '✓ The prompt above is in your clipboard. Open ChatGPT, start a new chat, press Ctrl+V, then Enter.')
    : T('→ Chép toàn bộ prompt trên, dán vào một cuộc trò chuyện mới trong ChatGPT.', '→ Copy the whole prompt above and paste it into a new ChatGPT chat.'));
  process.exit(0);
}
if (pi >= 0 && (!projArg || projArg.startsWith('--'))) die(T('--project cần đường dẫn thư mục app, vd. --project "D:\\APPS\\MY APP"', '--project needs the app folder, e.g. --project "D:\\APPS\\MY APP"'));
if (!global && pi < 0) {
  console.log(T(`Chọn nơi cài:
  node install.mjs --project "<thư mục app>"   cài cho một app (khuyên dùng — thử trên một app trước)
  node install.mjs --global                    cài cho cả máy
Thêm --dry-run để xem trước; --uninstall để gỡ; --verify để đối chiếu mã băm bản đã cài.
  node install.mjs --brief-prompt              chép prompt viết brief cho ChatGPT vào clipboard
Bản tiếng Anh: thêm --lang en (English version: add --lang en).`, `Choose where to install:
  node install.mjs --lang en --project "<app folder>"   install for one app (recommended — try it on one app first)
  node install.mjs --lang en --global                    install for the whole computer
Add --dry-run to preview; --uninstall to remove; --verify to check the installed files against their hashes.
  node install.mjs --lang en --brief-prompt              copy the ChatGPT brief-writing prompt to your clipboard`));
  process.exit(1);
}
if (global && pi >= 0) die(T('Chọn một: --global hoặc --project', 'Choose one: --global or --project'));
const project = pi >= 0 ? resolve(projArg) : null;
if (project && !existsSync(project)) die(T(`Không thấy thư mục: ${project}`, `Folder not found: ${project}`));
const base = project ? resolve(project, '.claude') : resolve(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'));
const kitDir = resolve(base, 'mission-kit');
const manifestPath = resolve(kitDir, 'installed.json');
const log = m => console.log((dry ? '[thử] ' : '') + m);

const skills = readdirSync(resolve(SRC, 'skills'));
const agents = readdirSync(resolve(SRC, 'agents'));
const commands = readdirSync(resolve(SRC, 'commands'));
const isOurs = h => /mission-kit"?[\\/]+hooks[\\/]/.test(h.command || '');
const stripBom = s => s.replace(/^\uFEFF/, '');
const readSettings = f => {
  if (!existsSync(f)) return {};
  const t = stripBom(readFileSync(f, 'utf8')).trim();
  if (!t) return {};
  try { return JSON.parse(t); } catch (e) { die(`${f} không phải JSON hợp lệ (${e.message}). Sửa tệp này trước — chưa ghi gì.`); }
};
let prevManifest = { files: [] }, manifestLost = false;
if (existsSync(manifestPath)) { try { prevManifest = JSON.parse(stripBom(readFileSync(manifestPath, 'utf8'))); if (!Array.isArray(prevManifest.files)) throw new Error('thiếu files'); } catch { manifestLost = true; prevManifest = { files: [] }; } }
else if (existsSync(kitDir)) manifestLost = true;
if (!langArg && prevManifest.lang === 'en') lang = 'en';
const ours = new Set(prevManifest.files);

// Dấu vân tay sha256 của mọi tệp kit đã cài (kit, skill, agent, lệnh) — để biết có ai sửa sau khi cài
function walkFiles(p, acc = []) {
  if (!existsSync(p)) return acc;
  if (statSync(p).isDirectory()) { for (const e of readdirSync(p)) walkFiles(join(p, e), acc); } else acc.push(p);
  return acc;
}
const relBase = p => p.slice(base.length + 1).split(/[\\/]/).join('/');
function hashTree(entries) {
  const h = {};
  for (const e of entries) for (const f of walkFiles(resolve(base, e))) {
    const r = relBase(f);
    if (r !== 'mission-kit/installed.json') h[r] = createHash('sha256').update(readFileSync(f)).digest('hex');
  }
  return h;
}
if (verify) {
  if (!existsSync(manifestPath) || !prevManifest.hashes) die('Chưa có mã băm trong installed.json (cài bằng bản kit cũ). Cài lại kit rồi chạy --verify.');
  const now = hashTree(['mission-kit', ...prevManifest.files]);
  const changed = Object.keys(prevManifest.hashes).filter(k => now[k] && now[k] !== prevManifest.hashes[k]);
  const missing = Object.keys(prevManifest.hashes).filter(k => !now[k]);
  const added = Object.keys(now).filter(k => !prevManifest.hashes[k]);
  const src = prevManifest.source || {};
  console.log(`Bản cài: commit ${src.commit || '?'}${src.dirty ? ' (có sửa CHƯA commit lúc cài)' : ''}, lúc ${prevManifest.installedAt}`);
  for (const [t, l] of [['đã bị sửa', changed], ['bị xóa', missing], ['thêm mới (không do kit cài)', added]])
    if (l.length) console.log(`✗ ${l.length} tệp ${t}:`, ...l.slice(0, 30).map(x => '\n  ' + x));
  if (!changed.length && !missing.length && !added.length) console.log(`✓ ${Object.keys(now).length} tệp khớp mã băm lúc cài.`);
  process.exit(changed.length || missing.length || added.length ? 1 : 0);
}
// installed.json mất/hỏng: nhận lại đúng những mục GIỐNG HỆT bản kit (không đụng đồ của app)
const sameAsKit = (src, dst) => { try { const s0 = statSync(src).isDirectory() ? resolve(src, 'SKILL.md') : src, a = enOf(s0) || s0, b = statSync(src).isDirectory() ? resolve(dst, 'SKILL.md') : dst; return readFileSync(a, 'utf8') === readFileSync(b, 'utf8'); } catch { return false; } };

// ---- kiểm tra trước khi ghi bất cứ thứ gì ----
const settingsFile = resolve(base, 'settings.json');
const localFile = resolve(base, 'settings.local.json');
const settings = readSettings(settingsFile);
const local = project ? readSettings(localFile) : null;

const plan = []; // [nguồn, đích, loại]
for (const n of skills) plan.push([resolve(SRC, 'skills', n), resolve(base, 'skills', n), 'dir']);
for (const n of agents) plan.push([resolve(SRC, 'agents', n), resolve(base, 'agents', n), 'file']);
for (const n of commands) plan.push([resolve(SRC, 'commands', n), resolve(base, 'commands', n), 'file']);
if (manifestLost) {
  for (const [src, dst] of plan) if (existsSync(dst) && sameAsKit(src, dst)) ours.add(dst.slice(base.length + 1).split('\\').join('/'));
  if (!prevManifest.files.length) prevManifest.files = [...ours];
  console.log(`! installed.json của kit bị mất/hỏng — nhận lại ${ours.size} mục giống hệt bản kit; settings sẽ được gỡ theo cách bỏ phần của kit.`);
}
// cài ở cấp kia (toàn máy ↔ app) → nhắc: hook vẫn chỉ chạy một lần (bản trong app chạy, bản toàn máy nhường — xem deferToOtherKit), nhưng skill/lệnh sẽ hiện hai lần
{ const other = project ? resolve(process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude'), 'mission-kit') : null;
  if (!uninstall && other && existsSync(other)) console.log(T('! Kit cũng đang cài cho cả máy. Hook chỉ chạy một bản (bản của app), nhưng skill/lệnh sẽ hiện hai lần — nên gỡ bản toàn máy: node install.mjs --uninstall --global',
    '! The kit is also installed for the whole computer. Hooks run only once (the app\'s copy), but skills/commands will show twice — uninstall the computer-wide copy: node install.mjs --uninstall --global')); }
const createdBase = prevManifest.createdBase ?? !existsSync(base);

// Mô hình mặc định cho app: làm việc bằng Sonnet, hỏi cố vấn Fable (advisor) khi bí hoặc trước việc lớn.
const MODEL_KEYS = { model: 'sonnet', advisorModel: 'fable' };
const KIT_ALLOW = ['Bash(node "$MISSION_KIT/mission.mjs":*)', 'Bash(node $MISSION_KIT/mission.mjs:*)', 'PowerShell(node "$env:MISSION_KIT/mission.mjs":*)'];
function stripHooks(s) {
  for (const ev of Object.keys(s.hooks || {})) {
    s.hooks[ev] = s.hooks[ev].map(g => ({ ...g, hooks: (g.hooks || []).filter(h => !isOurs(h)) })).filter(g => g.hooks.length);
    if (!s.hooks[ev].length) delete s.hooks[ev];
  }
  if (s.hooks && !Object.keys(s.hooks).length) delete s.hooks;
  if (s.permissions?.allow) { s.permissions.allow = s.permissions.allow.filter(p => !KIT_ALLOW.includes(p)); if (!s.permissions.allow.length) delete s.permissions.allow; }
  if (s.permissions && !Object.keys(s.permissions).length) delete s.permissions;
  if (s.env) { delete s.env.MISSION_KIT; if (!Object.keys(s.env).length) delete s.env; }
}
// Nguyên bản của từng tệp kit đụng tới: { pre: nội dung trước khi kit cài lần đầu (null = chưa có), post: nội dung kit ghi lần cuối }
const orig = prevManifest.orig || {};
const rawRead = f => existsSync(f) ? readFileSync(f, 'utf8') : null;
const sha = t => t === null ? null : createHash('sha1').update(t).digest('hex'); // chỉ lưu dấu vân tay nội dung kit ghi, không lưu nội dung (có thể chứa token)
function writeTracked(key, f, text, what) {
  if (dry) return log(`${what} ${f}`);
  const cur = rawRead(f);
  // nguyên bản có vẻ chứa bí mật (token, khóa…) → KHÔNG lưu vào installed.json; gỡ sẽ dùng cách bỏ phần kit
  const secretish = t => t && /(token|secret|password|passwd|api[_-]?key|private[_-]?key)["']?\s*[:=]|sk-[A-Za-z0-9]|ghp_|github_pat_|xox[bp]-|AKIA[0-9A-Z]{12}|eyJ[A-Za-z0-9_-]{10,}\./i.test(t);
  if (!(key in orig)) orig[key] = { pre: secretish(cur) ? undefined : cur };
  else if (orig[key].post !== sha(cur)) orig[key].pre = undefined; // bạn đã sửa sau lần cài trước → không trả byte được, gỡ sẽ chỉ bỏ phần kit
  if (cur !== text) { mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, text); log(`${cur === null ? 'tạo' : what} ${f}`); }
  orig[key].post = sha(text);
}
// Trả nguyên bản nếu tệp vẫn đúng như kit ghi; không thì dùng cách dự phòng (bỏ phần của kit)
function restoreTracked(key, f, fallback) {
  const o = orig[key]; const cur = rawRead(f);
  if (o && o.pre !== undefined && 'post' in o && sha(cur) === o.post) {
    if (dry) return log(`trả nguyên bản ${f}`);
    if (o.pre === null) { if (cur !== null) rmSync(f); log(`xóa ${f} (do kit tạo)`); }
    else { writeFileSync(f, o.pre); log(`trả nguyên bản ${f}`); }
    return;
  }
  fallback();
}
const writeSettings = (key, f, s) => writeTracked(key, f, JSON.stringify(s, null, 2) + '\n', 'cập nhật');
// .gitignore của app: không commit bản sao kit (lõi, skill/agent/lệnh của kit) và cài đặt riêng của máy.
const GI_MARK = '# Mission Kit (tự thêm; gỡ kit sẽ xóa)';
const GI_END = '# /Mission Kit';
function giStrip(cur) {
  const eol = cur.includes('\r\n') ? '\r\n' : '\n';
  const lines = cur.split(/\r?\n/);
  const a = lines.indexOf(GI_MARK); if (a < 0) return cur;
  let b = lines.indexOf(GI_END, a); if (b < 0) { b = a; while (b + 1 < lines.length && lines[b + 1].startsWith('.claude/')) b++; }
  const before = lines.slice(0, a), after = lines.slice(b + 1);
  // dòng người dùng tự thêm vào giữa khối (không phải dòng kit sinh) thì giữ lại
  const known = new Set(orig.gitignore?.lines || []);
  const userInside = lines.slice(a + 1, b).filter(l => l.trim() && !known.has(l) && !/^\.claude\/(mission-kit\/|settings\.local\.json|skills\/(mission-[\w-]+|ba-chuyen-gia|ship)\/|agents\/mission-[\w-]+\.md|commands\/mission-[\w-]+\.md)$/.test(l));
  if (before.length && before.at(-1) === '' && !userInside.length) before.pop(); // dòng trống kit chèn trước khối
  return [...before, ...userInside, ...after].join(eol);
}
function gitignore(add, giLines = []) {
  if (!project) return;
  const gi = resolve(project, '.gitignore');
  if (!add) return restoreTracked('gitignore', gi, () => {
    const cur = rawRead(gi); if (cur === null) return;
    const t = giStrip(cur); if (t === cur || dry) return;
    if (!t.trim()) { rmSync(gi); log(`xóa ${gi} (chỉ có dòng của kit)`); } else { writeFileSync(gi, t); log(`bỏ dòng Mission Kit trong ${gi}`); }
  });
  const cur0 = rawRead(gi);
  const base0 = cur0 === null ? '' : giStrip(cur0);
  const eol = base0.includes('\r\n') ? '\r\n' : '\n';
  const block = [GI_MARK, ...giLines, GI_END].join(eol) + eol;
  const txt = base0 === '' ? block : base0 + (base0.endsWith('\n') ? '' : eol) + eol + block;
  writeTracked('gitignore', gi, txt, 'thêm dòng Mission Kit vào');
  if (orig.gitignore) orig.gitignore.lines = giLines;
}
const removeIfEmpty = d => { try { if (existsSync(d) && !readdirSync(d).length) { rmSync(d, { recursive: true }); log(`xóa thư mục trống ${d}`); } } catch {} };

if (uninstall) {
  if (!existsSync(manifestPath) && !manifestLost && !ours.size) die(`Không thấy ${manifestPath} — kit chưa được cài ở đây. Không xóa gì.`);
  for (const f of prevManifest.files) { const p = resolve(base, f); if (existsSync(p)) { log(`xóa ${p}`); if (!dry) rmSync(p, { recursive: true, force: true }); } }
  restoreTracked('settings', settingsFile, () => {
    if (!existsSync(settingsFile)) return;
    const before = JSON.stringify(settings); stripHooks(settings);
    for (const [k, v] of Object.entries(prevManifest.modelKeys || {})) if (settings[k] === v) { delete settings[k]; log(`bỏ "${k}" do kit ghi trong ${settingsFile}`); } // chỉ khóa kit ghi và còn nguyên giá trị
    if (JSON.stringify(settings) === before) return; // không có phần kit → không đụng
    if (!dry) writeFileSync(settingsFile, JSON.stringify(settings, null, 2) + '\n'); log(`bỏ hook/quyền của kit trong ${settingsFile}`);
  });
  if (project && existsSync(localFile)) restoreTracked('local', localFile, () => {
    stripHooks(local);
    const created = prevManifest.createdLocal ?? true; // bản cũ không ghi: tệp chỉ còn trống sau khi bỏ phần kit thì coi là do kit tạo
    if (created && !Object.keys(local).length) { log(`xóa ${localFile} (do kit tạo)`); if (!dry) rmSync(localFile); }
    else { if (!dry) writeFileSync(localFile, JSON.stringify(local, null, 2) + '\n'); log(`bỏ MISSION_KIT trong ${localFile}`); }
  });
  if (!dry) for (const f of [settingsFile, localFile]) for (const b of [`${f}.bak-mission-kit`]) if (existsSync(b)) rmSync(b);
  log(`xóa ${kitDir}`); if (!dry) rmSync(kitDir, { recursive: true, force: true });
  if (!dry) for (const d of ['skills', 'agents', 'commands']) removeIfEmpty(resolve(base, d));
  gitignore(false);
  if (!dry && project && createdBase) removeIfEmpty(base);
  log(T('Đã gỡ. Thư mục .mission/ của app được giữ nguyên; skill/agent/hook riêng của app không bị đụng tới.', 'Uninstalled. The app\'s .mission/ folder is kept; the app\'s own skills/agents/hooks were not touched.'));
  process.exit(0);
}

// Skill "mềm": app đã có bản riêng cùng tên thì GIỮ bản của app và bỏ qua bản kit (bản kit vốn tự nhường).
const SOFT = new Set(['ba-chuyen-gia', 'ship']);
const skipped = [];
for (let i = plan.length - 1; i >= 0; i--) {
  const [, dst, kind] = plan[i];
  const name = dst.split(/[\\/]/).pop();
  if (kind === 'dir' && SOFT.has(name) && existsSync(dst) && !ours.has(rel(dst))) { skipped.push(name); plan.splice(i, 1); }
}
const conflicts = plan.filter(([, dst]) => existsSync(dst) && !ours.has(rel(dst)));
function rel(p) { return p.slice(base.length + 1).split('\\').join('/'); }
if (conflicts.length) die(T(`Đã có tệp/thư mục trùng tên không phải do kit cài — không ghi đè:\n  ${conflicts.map(c => c[1]).join('\n  ')}\nĐổi tên hoặc xóa chúng nếu chắc chắn, rồi chạy lại. Chưa ghi gì.\n(Nếu trước đây đã cài bản tiếng Anh: chạy lại với --lang en. If you installed the English version before: run again with --lang en.)`,
  `Files/folders with the same names already exist and were not installed by the kit — not overwriting:\n  ${conflicts.map(c => c[1]).join('\n  ')}\nRename or delete them if you are sure, then run again. Nothing was written.\n(If the Vietnamese version was installed here before, run again with --lang vi.)`));

// ---- ghi ----
log(`chép lõi → ${kitDir}`);
if (!dry) {
  rmSync(kitDir, { recursive: true, force: true }); mkdirSync(kitDir, { recursive: true });
  for (const f of ['lib.mjs', 'lint-core.mjs', 'status-core.mjs', 'check-core.mjs', 'tidy-core.mjs', 'handover-core.mjs', 'guard-core.mjs', 'data-core.mjs', 'shell-parse.mjs', 'important-core.mjs', 'mission.mjs', 'hooks', 'tools', 'templates']) cpSync(resolve(SRC, f), resolve(kitDir, f), { recursive: true });
  const enTpl = enOf(resolve(SRC, 'templates'));
  if (enTpl) { cpSync(enTpl, resolve(kitDir, 'templates'), { recursive: true }); log('mẫu tiếng Anh (English templates) → templates'); }
}
const files = [];
for (const [src, dst, kind] of plan) {
  log(`${kind === 'dir' ? 'skill' : dst.includes(`${'agents'}`) ? 'agent' : 'lệnh'} ${rel(dst)}`);
  files.push(rel(dst));
  if (dry) continue;
  rmSync(dst, { recursive: true, force: true }); mkdirSync(dirname(dst), { recursive: true });
  kind === 'dir' ? cpSync(src, dst, { recursive: true }) : copyFileSync(src, dst);
  const en = enOf(src); // bản tiếng Anh: chép đè tệp chữ lên bản vừa chép (script/tài nguyên giữ nguyên)
  if (en) kind === 'dir' ? cpSync(en, dst, { recursive: true }) : copyFileSync(en, dst);
}
// nâng cấp: tệp của bản cũ không còn trong bản mới thì xóa (không để mồ côi)
for (const f of prevManifest.files) if (!files.includes(f)) { const p = resolve(base, f); if (existsSync(p)) { log(`xóa tệp cũ của kit ${rel(p)}`); if (!dry) rmSync(p, { recursive: true, force: true }); } }
const createdLocal = project ? (prevManifest.createdLocal ?? !existsSync(localFile)) : false;

const hookRef = project ? '"$CLAUDE_PROJECT_DIR"/.claude/mission-kit' : `"${kitDir}"`;
const H = name => ({ type: 'command', command: `node ${hookRef}/hooks/${name}.mjs`, timeout: name === 'post-edit-check' ? 120 : 30 });
// Cài cho app: hook/quyền/biến nằm trong settings.local.json (máy này, không commit) → settings.json của app KHÔNG bị đụng,
// và máy khác clone về không bị hook trỏ vào thư mục kit không có. Cài toàn máy: ~/.claude/settings.json.
const modelKeys = {};
if (project) {
  const b4 = JSON.stringify(settings); stripHooks(settings);
  const own = prevManifest.modelKeys || {};
  for (const [k, v] of Object.entries(MODEL_KEYS)) {
    const cur = settings[k];
    if (cur === undefined || (k in own && cur === own[k])) { settings[k] = v; modelKeys[k] = v; } // chưa có, hoặc chính kit ghi lần trước → (giữ) của kit
    else log(`! ${settingsFile} đã có "${k}": ${JSON.stringify(cur)} — giữ nguyên (kit đề nghị "${v}"; không ghi đè, gỡ kit cũng không đụng).`);
  }
  if (JSON.stringify(settings) !== b4) writeSettings('settings', settingsFile, settings);
}
const target = project ? local : settings;
stripHooks(target);
target.hooks ||= {};
const add = (ev, matcher, h) => { (target.hooks[ev] ||= []).push(matcher ? { matcher, hooks: [h] } : { hooks: [h] }); };
add('SessionStart', null, H('session-start'));
add('PreToolUse', 'Edit|Write|MultiEdit|NotebookEdit', H('guard-paths'));
add('PreToolUse', 'Bash|PowerShell', H('guard-bash'));
add('PreToolUse', 'Read|Grep|Glob|NotebookRead', H('guard-read'));
add('PostToolUse', 'Edit|Write|MultiEdit', H('post-edit-check'));
add('Stop', null, H('stop-gate'));
add('PreCompact', null, H('pre-compact'));
target.permissions ||= {}; target.permissions.allow ||= [];
for (const p of KIT_ALLOW) if (!target.permissions.allow.includes(p)) target.permissions.allow.push(p);
target.env ||= {}; target.env.MISSION_KIT = kitDir;
writeSettings(project ? 'local' : 'settings', project ? localFile : settingsFile, target);

gitignore(true, ['.claude/mission-kit/', '.claude/settings.local.json', ...files.map(f => '.claude/' + f + (f.startsWith('skills/') ? '/' : ''))]);
// nguồn: commit của repo kit và có sửa chưa commit không (cài từ mã chưa commit thì không truy lại được)
const source = (() => {
  const g = a => { try { return execFileSync('git', ['-C', dirname(SRC), ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return ''; } };
  const commit = g(['rev-parse', 'HEAD']);
  return commit ? { commit, dirty: !!g(['status', '--porcelain', '--', 'kit', 'install.mjs']) } : { commit: null, dirty: null };
})();
if (source.dirty) console.log('! Cài từ mã kit CHƯA commit — installed.json ghi commit gốc kèm cờ dirty; nên commit kit rồi cài lại.');
if (!dry) writeFileSync(manifestPath, JSON.stringify({ version: 5, installedAt: new Date().toISOString(), lang, source, base, files, createdLocal, createdBase, modelKeys, orig, hashes: hashTree(['mission-kit', ...files]) }, null, 2) + '\n');
else log('(thử) sẽ thêm khối dòng Mission Kit vào .gitignore của app');
if (skipped.length) log(T(`Giữ bản riêng của app (không cài bản kit): ${skipped.join(', ')}`, `Kept the app's own version (kit version not installed): ${skipped.join(', ')}`));
if (lang === 'en') {
  log(`\nDone (${project ? 'one app: ' + project : 'whole computer: ' + base}). Kit language: English.`);
  log(`
Next — talk your idea through with ChatGPT, save the brief, then initialise:
  1. Get the prompt: run the command below — it copies the prompt to your clipboard:
       node "${resolve(dirname(SRC), 'install.mjs')}" --lang en --brief-prompt
     (or open ${join(kitDir, 'templates', 'HUONG-DAN-BRIEF-CHATGPT.md')} and copy the «Prompt to paste into ChatGPT» block)
  2. Open ChatGPT, start a new chat, paste the prompt (Ctrl+V), then describe your app idea in plain words.
     ChatGPT asks back in groups, at most 5 questions per turn — if you don't know an answer, just say «don't know».
  3. When ChatGPT outputs the brief (one markdown block): click that block's Copy button, open Notepad, paste,
     Save as: ${join(project || '<app folder>', 'brief.md')}
     (set «Save as type» to All files and Encoding to UTF-8 — so it doesn't become brief.md.txt)
  4. Open Claude Code in the app folder and type:
       /mission-init brief.md
     Claude reads the brief, fills in .mission/config.json and plan.md, then asks you the missing questions once.
  Don't want to use ChatGPT: type /mission-brief in Claude Code — Claude asks you and writes brief.md.

Note: the kit's safety hooks print their messages in Vietnamese; Claude reads them and explains them to you in English.
Check the install: in Claude Code type /mission-status (if not initialised yet, it tells you to run /mission-init).
Uninstall: node install.mjs --uninstall ` + (project ? `--project "${project}"` : '--global'));
  process.exit(0);
}
log(`\nXong (${project ? 'một app: ' + project : 'cả máy: ' + base}).`);
const appDir = project || '<thư mục app>';
log(`
Bước tiếp — trao đổi ý tưởng với ChatGPT, lưu brief, rồi khởi tạo:
  1. Lấy prompt: chạy lệnh dưới — prompt được chép sẵn vào clipboard:
       node "${resolve(dirname(SRC), 'install.mjs')}" --brief-prompt
     (hoặc mở ${join(kitDir, 'templates', 'HUONG-DAN-BRIEF-CHATGPT.md')}, chép khối «Prompt dán vào ChatGPT»)
  2. Mở ChatGPT, tạo cuộc trò chuyện mới, dán prompt (Ctrl+V), rồi kể ý tưởng app bằng lời thường.
     ChatGPT hỏi lại từng nhóm, tối đa 5 câu mỗi lượt — câu nào chưa biết cứ trả lời «chưa biết».
  3. Khi ChatGPT xuất brief (một khối markdown, 15 mục): bấm nút Copy của khối đó, mở Notepad, dán,
     Lưu thành: ${join(appDir, 'brief.md')}
     (ô «Save as type» chọn All files, Encoding chọn UTF-8 — để khỏi thành brief.md.txt)
  4. Mở Claude Code trong thư mục app, gõ:
       /mission-init brief.md
     Claude đọc brief, điền .mission/config.json và plan.md, rồi hỏi bạn một lần các câu còn thiếu.
  Không muốn dùng ChatGPT: gõ /mission-brief trong Claude Code, Claude tự hỏi và viết brief.md.

Kiểm tra cài đặt: trong Claude Code gõ /mission-status (chưa khởi tạo thì báo cần /mission-init).
Gỡ: node install.mjs --uninstall ` + (project ? `--project "${project}"` : '--global'));
