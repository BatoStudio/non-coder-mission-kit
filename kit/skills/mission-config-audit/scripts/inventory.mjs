#!/usr/bin/env node
// Kiểm kê CHỈ ĐỌC cấu hình Claude Code của một app + của máy, cho skill mission-config-audit.
// Dùng: node inventory.mjs --app <thư-mục-app> [--out <tệp.json> | --stdout] [--no-scan]
//  - Không ghi gì vào app hay ~/.claude. Mặc định ghi JSON vào thư mục tạm của máy và in đường dẫn.
//  - Không mở tệp bí mật (.credentials.json, .env, ~/.wrangler…): chỉ xem có hay không (stat).
//  - Giá trị có tên giống token/khóa/mật khẩu, và chuỗi trông như token, đều bị thay bằng <ẩn>.
//  - Không in email/tài khoản trong ~/.claude.json (oauthAccount…): chỉ đọc mcpServers và cấu hình của app.
//  - Skill/plugin đã cài được quét bằng scan.mjs của mission-skill-audit (chỉ đọc chữ, không chạy mã của skill).
import { readFileSync, readdirSync, statSync, lstatSync, existsSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname, basename, relative } from 'node:path';
import { homedir, tmpdir } from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const opt = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : undefined; };
const APP = resolve(opt('--app') || process.env.CLAUDE_PROJECT_DIR || process.cwd());
const STDOUT = argv.includes('--stdout');
const OUT = opt('--out') || (STDOUT ? null : join(tmpdir(), `mission-config-audit-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}.json`));
const SCAN = !argv.includes('--no-scan');
const HOME = homedir();
const CDIR = process.env.CLAUDE_CONFIG_DIR || join(HOME, '.claude');
const HERE = dirname(fileURLToPath(import.meta.url));
const SCANNER = [join(HERE, '..', '..', 'mission-skill-audit', 'scripts', 'scan.mjs')].find(existsSync);

// ---------- che bí mật ----------
const SECRET_KEY = /(token|secret|passw|api[_-]?key|apikey|auth|cookie|bearer|credential|private[_-]?key|session)/i;
const looksSecret = s => /^(gh[pousr]_|github_pat_|sk-|sk_live_|xox[abprs]-|AKIA|AIza|npm_|eyJ)/.test(s) || (s.length >= 32 && /[A-Z]/.test(s) && /[a-z]/.test(s) && /\d/.test(s) && !/[\s/\\]/.test(s));
const maskStr = s => String(s).replace(/(Bearer\s+)\S+/gi, '$1<ẩn>').replace(/[A-Za-z0-9_\-+/=.]{24,}/g, m => looksSecret(m) ? '<ẩn>' : m);
function mask(v, key = '') {
  if (v === null || v === undefined) return v;
  if (typeof v === 'string') return SECRET_KEY.test(key) && v ? '<ẩn>' : maskStr(v);
  if (Array.isArray(v)) return v.map(x => mask(x, key));
  if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, mask(x, k)]));
  return v;
}
const keysOnly = o => o && typeof o === 'object' ? Object.keys(o) : [];

// ---------- đọc an toàn ----------
const rel = p => { const r = relative(APP, p); return r && !r.startsWith('..') && !/^[a-zA-Z]:/.test(r) ? r.split('\\').join('/') : p.replace(HOME, '~').split('\\').join('/'); };
const readText = p => { try { return readFileSync(p, 'utf8').replace(/^\uFEFF/, ''); } catch { return null; } };
const readJson = p => { const t = readText(p); if (t === null) return undefined; try { return JSON.parse(t); } catch (e) { return { __error: 'JSON hỏng: ' + e.message.slice(0, 80) }; } };
const ls = d => { try { return readdirSync(d); } catch { return []; } };
const isDir = p => { try { return statSync(p).isDirectory(); } catch { return false; } };
const stat = p => { try { const s = lstatSync(p); return { exists: true, size: s.size, modified: s.mtime.toISOString().slice(0, 10), symlink: s.isSymbolicLink() }; } catch { return { exists: false }; } };
const git = (...a) => { try { return execFileSync('git', ['-c', 'core.quotePath=false', ...a], { cwd: APP, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim(); } catch { return null; } };
const frontmatter = t => { const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(t || ''); if (!m) return {}; const o = {}; for (const ln of m[1].split(/\r?\n/)) { const k = /^([\w-]+):\s*(.*)$/.exec(ln); if (k) o[k[1]] = k[2].slice(0, 300); } return o; };

function scanDir(dir) {
  if (!SCAN || !SCANNER) return { verdict: SCANNER ? 'chưa quét (--no-scan)' : 'không có scan.mjs' };
  const r = spawnSync(process.execPath, [SCANNER, dir, '--json'], { encoding: 'utf8', timeout: 60000, maxBuffer: 64 << 20 });
  try {
    const j = JSON.parse(r.stdout);
    const red = j.findings.filter(f => f.level === 3).slice(0, 8).map(f => `${f.rule} ${f.file}${f.line ? ':' + f.line : ''}`);
    const yellow = [...new Set(j.findings.filter(f => f.level === 2).map(f => f.rule))];
    return { verdict: j.verdict, files: j.files, scripts: j.scripts.length, hooks: j.manifests.hooks, mcp: j.manifests.mcp, red, yellow, domains: j.domains.slice(0, 8).map(d => d[0]) };
  } catch { return { verdict: 'lỗi quét', error: (r.stderr || '').slice(0, 200) }; }
}

// hook trong settings: chỉ lấy sự kiện, matcher, lệnh (đã che)
function hooksOf(s) {
  const out = [];
  for (const [ev, groups] of Object.entries(s?.hooks || {})) for (const g of [].concat(groups || [])) for (const h of [].concat(g.hooks || []))
    out.push({ event: ev, matcher: g.matcher || '*', type: h.type, command: maskStr(h.command || h.url || h.prompt || '').slice(0, 300) });
  return out;
}
function settingsSummary(p) {
  const s = readJson(p);
  if (s === undefined) return { path: rel(p), exists: false };
  if (s.__error) return { path: rel(p), error: s.__error };
  return {
    path: rel(p), exists: true,
    permissions: { allow: s.permissions?.allow || [], ask: s.permissions?.ask || [], deny: s.permissions?.deny || [], defaultMode: s.permissions?.defaultMode, additionalDirectories: s.permissions?.additionalDirectories },
    hooks: hooksOf(s), disableAllHooks: s.disableAllHooks,
    enabledPlugins: s.enabledPlugins, extraKnownMarketplaces: mask(s.extraKnownMarketplaces),
    enableAllProjectMcpServers: s.enableAllProjectMcpServers, enabledMcpjsonServers: s.enabledMcpjsonServers, disabledMcpjsonServers: s.disabledMcpjsonServers,
    envKeys: keysOnly(s.env), apiKeyHelper: s.apiKeyHelper ? '<có>' : undefined, statusLine: s.statusLine ? mask(s.statusLine) : undefined,
    skipDangerousModePermissionPrompt: s.skipDangerousModePermissionPrompt, sandbox: s.sandbox ? mask(s.sandbox) : undefined,
    otherKeys: Object.keys(s).filter(k => !['permissions', 'hooks', 'enabledPlugins', 'extraKnownMarketplaces', 'env', 'statusLine', 'sandbox'].includes(k)),
  };
}
const mcpSummary = servers => Object.fromEntries(Object.entries(servers || {}).map(([n, v]) => [n, { type: v.type || (v.url ? 'http' : 'stdio'), command: v.command, args: mask(v.args), url: v.url ? maskStr(v.url) : undefined, envKeys: keysOnly(v.env), headerKeys: keysOnly(v.headers) }]));

function listItems(base, kind) { // skills/agents/commands/hooks trong một thư mục .claude
  const d = join(base, kind);
  return ls(d).filter(n => !n.startsWith('.')).map(n => {
    const p = join(d, n), st = stat(p);
    const item = { name: n, path: rel(p), symlink: st.symlink || undefined };
    if (kind === 'skills' && isDir(p)) { const fm = frontmatter(readText(join(p, 'SKILL.md'))); item.description = fm.description; item['allowed-tools'] = fm['allowed-tools']; item.scan = scanDir(p); }
    if (kind === 'agents' || kind === 'commands') { const fm = frontmatter(readText(p)); item.tools = fm.tools || fm['allowed-tools']; item.model = fm.model; }
    return item;
  });
}

const inv = { generated: new Date().toISOString(), app: APP, home: '~', configDir: rel(CDIR), notes: [] };

// ---------- 1. Máy (toàn bộ người dùng) ----------
inv.user = {
  settings: settingsSummary(join(CDIR, 'settings.json')),
  settingsLocal: settingsSummary(join(CDIR, 'settings.local.json')),
  skills: listItems(CDIR, 'skills'), agents: listItems(CDIR, 'agents'), commands: listItems(CDIR, 'commands'), hooksDir: listItems(CDIR, 'hooks'),
};
// skill đồng bộ từ claude.ai (skills/synced/<bucket>/<tên>)
inv.user.syncedSkills = ls(join(CDIR, 'skills', 'synced')).filter(b => isDir(join(CDIR, 'skills', 'synced', b))).flatMap(b => ls(join(CDIR, 'skills', 'synced', b)).filter(n => isDir(join(CDIR, 'skills', 'synced', b, n))).map(n => ({ name: n, path: rel(join(CDIR, 'skills', 'synced', b, n)) })));
// ~/.claude.json: chỉ máy chủ MCP và mục của đúng app này (bỏ tài khoản, email, bộ đệm)
{
  const cj = readJson(join(HOME, '.claude.json'));
  if (cj && !cj.__error) {
    const norm = p => String(p).replace(/\\/g, '/').toLowerCase();
    const proj = Object.entries(cj.projects || {}).find(([p]) => norm(p) === norm(APP))?.[1] || {};
    inv.user.claudeJson = { mcpServers: mcpSummary(cj.mcpServers), project: { mcpServers: mcpSummary(proj.mcpServers), allowedTools: proj.allowedTools, enabledMcpjsonServers: proj.enabledMcpjsonServers, disabledMcpjsonServers: proj.disabledMcpjsonServers, hasTrustDialogAccepted: proj.hasTrustDialogAccepted } };
  } else inv.user.claudeJson = cj?.__error ? { error: cj.__error } : { exists: false };
}
// tệp đăng nhập của máy: CHỈ xem có hay không (không mở)
inv.user.credentialFiles = Object.fromEntries([
  ['claude .credentials.json', join(CDIR, '.credentials.json')], ['wrangler (Windows)', join(HOME, 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml')],
  ['wrangler', join(HOME, '.wrangler', 'config', 'default.toml')], ['wrangler (.config)', join(HOME, '.config', '.wrangler', 'config', 'default.toml')],
  ['gh hosts.yml', join(HOME, '.config', 'gh', 'hosts.yml')], ['gh hosts.yml (Windows)', join(HOME, 'AppData', 'Roaming', 'GitHub CLI', 'hosts.yml')],
  ['~/.npmrc', join(HOME, '.npmrc')], ['~/.git-credentials', join(HOME, '.git-credentials')], ['~/.aws/credentials', join(HOME, '.aws', 'credentials')], ['~/.ssh', join(HOME, '.ssh')],
].map(([k, p]) => [k, stat(p).exists ? { path: rel(p), ...stat(p) } : false]).filter(([, v]) => v));
// tác vụ hẹn giờ (chạy không người trông)
inv.user.scheduledTasks = ls(join(CDIR, 'scheduled-tasks')).filter(n => isDir(join(CDIR, 'scheduled-tasks', n))).map(n => { const fm = frontmatter(readText(join(CDIR, 'scheduled-tasks', n, 'SKILL.md'))); return { name: n, description: fm.description, path: rel(join(CDIR, 'scheduled-tasks', n)) }; });

// ---------- 2. Plugin và marketplace ----------
{
  const ip = readJson(join(CDIR, 'plugins', 'installed_plugins.json'));
  const km = readJson(join(CDIR, 'plugins', 'known_marketplaces.json'));
  const enabled = { ...(inv.user.settings.enabledPlugins || {}) };
  inv.plugins = [];
  const used = new Set();
  for (const [id, list] of Object.entries(ip?.plugins || {})) for (const e of [].concat(list)) {
    const p = e.installPath; if (p) used.add(resolve(p));
    const man = readJson(join(p || '', '.claude-plugin', 'plugin.json')) || readJson(join(p || '', 'plugin.json')) || {};
    const mcpFile = typeof man.mcpServers === 'string' ? join(p, man.mcpServers) : join(p || '', '.mcp.json');
    const mcp = typeof man.mcpServers === 'object' ? man.mcpServers : readJson(mcpFile)?.mcpServers;
    const hooksFile = typeof man.hooks === 'string' ? join(p, man.hooks) : join(p || '', 'hooks', 'hooks.json');
    const hooksJson = typeof man.hooks === 'object' ? man.hooks : readJson(hooksFile);
    const skillsDir = join(p || '', 'skills');
    inv.plugins.push({
      id, enabled: enabled[id] === true, scope: e.scope, version: e.version, gitCommitSha: e.gitCommitSha, installedAt: e.installedAt?.slice(0, 10), lastUpdated: e.lastUpdated?.slice(0, 10),
      autoFollowsBranch: !!(e.gitCommitSha && e.version && e.gitCommitSha.startsWith(e.version)) || undefined,
      path: p ? rel(p) : undefined, author: man.author?.name, repository: man.repository,
      mcpServers: mcpSummary(mcp), hooks: hooksJson ? hooksOf(hooksJson.hooks ? hooksJson : { hooks: hooksJson }) : [],
      agents: ls(join(p || '', 'agents')).length, commands: ls(join(p || '', 'commands')).length,
      skills: ls(skillsDir).filter(n => isDir(join(skillsDir, n))).map(n => ({ name: n, scan: scanDir(join(skillsDir, n)) })),
    });
  }
  inv.marketplaces = Object.entries(km || {}).map(([n, v]) => ({ name: n, source: mask(v.source), lastUpdated: v.lastUpdated?.slice(0, 10), autoUpdate: v.autoUpdate }));
  // bản cũ còn nằm trong cache (không được quét, có thể bị nạp lại nếu cài lại)
  const cache = join(CDIR, 'plugins', 'cache');
  inv.staleCache = ls(cache).flatMap(m => ls(join(cache, m)).flatMap(pl => ls(join(cache, m, pl)).map(v => join(cache, m, pl, v)))).filter(d => isDir(d) && !used.has(resolve(d))).map(rel);
}

// ---------- 3. App ----------
{
  const C = join(APP, '.claude');
  const installed = readJson(join(C, 'mission-kit', 'installed.json'));
  const kitFiles = new Set(installed?.files || []);
  const tag = (items, kind) => items.map(i => ({ ...i, source: kitFiles.has(`${kind}/${i.name}`) ? 'Mission Kit' : 'riêng của app / bên ngoài' }));
  inv.app = {
    settings: settingsSummary(join(C, 'settings.json')), settingsLocal: settingsSummary(join(C, 'settings.local.json')),
    mcpJson: (() => { const m = readJson(join(APP, '.mcp.json')); return m === undefined ? { exists: false } : m.__error ? m : { exists: true, servers: mcpSummary(m.mcpServers) }; })(),
    skills: tag(listItems(C, 'skills'), 'skills'), agents: tag(listItems(C, 'agents'), 'agents'), commands: tag(listItems(C, 'commands'), 'commands'), hooksDir: listItems(C, 'hooks'),
    missionKit: installed ? { version: installed.version, installedAt: installed.installedAt?.slice(0, 10) } : null,
    launchJson: (() => { const l = readJson(join(C, 'launch.json')); return l && !l.__error ? (l.configurations || []).map(c => ({ name: c.name, run: maskStr([c.runtimeExecutable, ...(c.runtimeArgs || [])].join(' ')).slice(0, 300), url: c.url })) : undefined; })(),
    claudeMd: ['CLAUDE.md', '.claude/CLAUDE.md', 'CLAUDE.local.md'].filter(f => existsSync(join(APP, f))),
  };
  // git: hook tự chạy, remote, tệp bí mật bị theo dõi
  const hp = git('config', '--get', 'core.hooksPath');
  const hookDir = hp ? resolve(APP, hp) : join(APP, '.git', 'hooks');
  inv.app.git = {
    isRepo: git('rev-parse', '--is-inside-work-tree') === 'true', branch: git('branch', '--show-current'), remotes: (git('remote', '-v') || '').split('\n').filter(Boolean).map(maskStr).filter((x, i, a) => a.indexOf(x) === i),
    hooksPath: hp, activeHooks: ls(hookDir).filter(n => !n.endsWith('.sample')).map(n => rel(join(hookDir, n))),
    trackedSecretLike: (git('ls-files') || '').split('\n').filter(f => /(^|\/)(\.env(\.[\w.-]+)?|\.dev\.vars(\.[\w.-]+)?|id_(rsa|ed25519|ecdsa)|[^/]*\.(pem|p12|pfx)|\.npmrc|\.git-credentials|credentials\.json)$/i.test(f) && !/\.(example|sample|template)$/i.test(f)),
  };
  // tệp bí mật trên máy trong app: chỉ tên, có bị git bỏ qua không
  const secretNames = []; const walk = (d, depth) => { if (depth > 3) return; for (const n of ls(d)) { if (/^(node_modules|\.git|dist|build|\.wrangler)$/.test(n)) continue; const p = join(d, n); if (isDir(p)) walk(p, depth + 1); else if (/^(\.env(\.[\w.-]+)?|\.dev\.vars(\.[\w.-]+)?|[^/]*\.(pem|p12|pfx))$/i.test(n) && !/\.(example|sample|template)$/i.test(n)) secretNames.push(rel(p)); } };
  walk(APP, 0);
  inv.app.secretFiles = secretNames.map(f => ({ path: f, gitignored: git('check-ignore', '-q', f) !== null }));
  // CI
  const wf = join(APP, '.github', 'workflows');
  inv.app.ci = ls(wf).filter(n => /\.ya?ml$/.test(n)).map(n => {
    const t = readText(join(wf, n)) || '';
    const uses = [...t.matchAll(/uses:\s*([^\s#]+)/g)].map(m => m[1]);
    return { file: rel(join(wf, n)), triggers: (/^on:\s*([\s\S]*?)^\S/m.exec(t)?.[1] || '').replace(/\s+/g, ' ').trim().slice(0, 160), pullRequestTarget: /pull_request_target/.test(t),
      unpinnedActions: uses.filter(u => !u.startsWith('./') && !/@[0-9a-f]{40}$/.test(u)), secretsUsed: [...new Set([...t.matchAll(/secrets\.(\w+)/g)].map(m => m[1]))], permissions: /^permissions:/m.test(t) ? 'có khai' : 'không khai (mặc định)' };
  });
  // gói phụ thuộc
  const pj = readJson(join(APP, 'package.json'));
  if (pj && !pj.__error) {
    const deps = { ...pj.dependencies, ...pj.devDependencies, ...pj.optionalDependencies };
    inv.app.npm = { deps: Object.keys(deps).length, lockfile: ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'].filter(f => existsSync(join(APP, f))),
      risky: Object.entries(deps).filter(([, v]) => /^(latest|\*|x|git|github:|https?:|file:)|^[^\d^~<>=]/.test(String(v))).map(([k, v]) => `${k}@${v}`),
      installScripts: Object.fromEntries(Object.entries(pj.scripts || {}).filter(([k]) => /^(pre|post)?install$|^prepare$/.test(k)).map(([k, v]) => [k, maskStr(v)])) };
  }
  const req = ls(APP).filter(n => /^requirements.*\.txt$/.test(n));
  if (req.length) inv.app.python = req.map(f => { const lines = (readText(join(APP, f)) || '').split(/\r?\n/).filter(l => l.trim() && !l.startsWith('#')); return { file: f, total: lines.length, unpinned: lines.filter(l => !/==/.test(l)).slice(0, 20) }; });
  // Cloudflare
  for (const f of ['wrangler.toml', 'wrangler.json', 'wrangler.jsonc']) {
    const t = readText(join(APP, f)); if (t === null) continue;
    inv.app.wrangler = { file: f, name: /^name\s*=\s*"([^"]+)"/m.exec(t)?.[1], bindings: [...t.matchAll(/^\s*binding\s*=\s*"([^"]+)"/gm)].map(m => m[1]),
      varsKeys: (/^\[vars\]([\s\S]*?)(^\[|$(?![\s\S]))/m.exec(t)?.[1] || '').split(/\r?\n/).map(l => /^\s*([\w-]+)\s*=/.exec(l)?.[1]).filter(Boolean),
      secretLookingValues: (t.match(/=\s*"[^"]{20,}"/g) || []).filter(v => looksSecret(v.replace(/^=\s*"|"$/g, ''))).length, routes: [...t.matchAll(/pattern\s*=\s*"([^"]+)"/g)].map(m => m[1]) };
  }
  const mcfg = readJson(join(APP, '.mission', 'config.json'));
  if (mcfg && !mcfg.__error) inv.app.missionConfig = { gitMode: mcfg.git?.mode, blockPush: mcfg.privacy?.blockPush, readGuard: mask(mcfg.readGuard), bashAsk: mcfg.bash?.ask?.length, bashDeny: mcfg.bash?.deny?.length, ship: mcfg.ship ? { deployCmd: maskStr(mcfg.ship.deployCmd || ''), previewCmd: maskStr(mcfg.ship.previewCmd || '') } : undefined, commandsRunByHooks: [...new Set(JSON.stringify(mcfg.checks || {}).match(/"(cmd|command)":\s*"[^"]{0,200}"/g) || [])].slice(0, 15).map(maskStr) };
}
inv.notes.push('Connector của tài khoản (Cloudflare, Dropbox, Notion, Chrome, computer-use…) không nằm trong tệp: Claude phải tự liệt kê từ danh sách công cụ của phiên, KHÔNG gọi thử.');
if (!SCANNER) inv.notes.push('Không thấy mission-skill-audit/scripts/scan.mjs: skill/plugin chưa được quét nội dung.');

const json = JSON.stringify(inv, null, 2);
if (OUT) { writeFileSync(OUT, json); console.log(`Đã ghi ${OUT} (${(json.length / 1024).toFixed(0)} KB). Plugin: ${inv.plugins.length}, skill của app: ${inv.app.skills.length}, skill toàn máy: ${inv.user.skills.length}.`); }
else console.log(json);
