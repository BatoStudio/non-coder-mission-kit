#!/usr/bin/env node
// PreToolUse (Bash|PowerShell): chặn thao tác không thể đảo ngược hoặc trái quy trình Git của dự án.
// Hai chế độ git (config.git.mode):
//   local-main (mặc định) — commit thẳng nhánh chính trên máy được phép; mọi git push phải hỏi.
//   branch-pr             — commit/merge trên nhánh bảo vệ bị cấm; làm trên nhánh riêng rồi mở PR.
// Lệnh được đọc như shell thật (ngoặc, ký tự thoát \ hoặc `, heredoc, lệnh con $(…)), rồi xét theo CẤU TRÚC:
// chương trình + tham số + đích chuyển hướng. Nội dung chữ (commit message, --why, thân heredoc) không bị coi là lệnh.
// Gom MỌI quyết định rồi trả kết quả nghiêm nhất (deny > ask).
// Đây là lưới an toàn, không phải sandbox (vd. `node -e` tự ghi tệp vẫn lọt).
import { readStdin, findRoot, loadConfigSafe, gitInfo, out, hookLog, matchAny, globToRegex } from '../lib.mjs';
import { pathKind, globKind, hasGlob, stricter, inFreeDir } from '../guard-core.mjs';
import { parseShell } from '../shell-parse.mjs';
import { commitPrivacy, parseCommit, messageIssue, verdictIssue, handoffCfg, readKind, isWideRoot, inExchange, exchangeContentIssue, nativePath, lockedGlobs } from '../data-core.mjs';
import { importantEntries, scanTree, within, isRealAppsPath, fmtCount } from '../important-core.mjs';
import { existsSync, statSync, readFileSync, readdirSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { resolve, relative, sep, basename, dirname } from 'node:path';
const shellMatch = (pat, g, rel) => { try { return globToRegex(g).test(rel); } catch { return false; } };

import { deferToOtherKit } from '../lib.mjs';
if (deferToOtherKit()) process.exit(0); // bản kit khác ($MISSION_KIT) đang lo việc này
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) process.exit(0);
const cmd = String(input.tool_input?.command || '');
const cwd0 = input.cwd || root;
let cwd = cwd0; // đổi theo cd/pushd/Set-Location trong cùng lệnh (luật ghi/xóa và git xét đúng thư mục)
const CD = /^(cd|pushd|chdir|set-location|sl|push-location)$/;
const POPD = /^(popd|pop-location)$/;
const isPS = input.tool_name === 'PowerShell';
if (!cmd.trim()) process.exit(0);

let best = null; const reasons = { deny: [], ask: [] };
const decide = (kind, reason) => { best = stricter(best, { kind }); if (!reasons[kind].includes(reason)) reasons[kind].push(reason); };
const { cfg, error } = loadConfigSafe(root);
if (error) decide('ask', error);

const { branch } = gitInfo(root);
const prot = cfg.protectedBranches.map(b => String(b).toLowerCase());
const curBranch = String(branch || '').toLowerCase();
const onProtected = prot.includes(curBranch);
const branchMode = cfg.git.mode === 'branch-pr';
const home = homedir();

// ---------- đọc lệnh thành các đoạn (gồm cả lệnh con, lệnh bọc bash -c / cmd /c / powershell -c / eval) ----------
const PREFIX = new Set(['command', 'env', 'sudo', 'nohup', 'time', 'exec', 'builtin', 'nice', 'ionice', 'stdbuf', 'xargs', 'then', 'do', 'else', 'elif', 'if', 'while', 'until', '!', '{', '}', '&', '.', 'call', 'start', 'start-process', 'timeout']);
const FLAGGED_PREFIX = new Set(['env', 'sudo', 'xargs', 'nice', 'stdbuf', 'start-process', 'timeout', 'start']);
const progName = t => String(t).replace(/^&(?=\S)/, '').split(/[\\/]/).pop().toLowerCase().replace(/\.(exe|cmd|bat|com)$/, '');
const WRAP = { bash: [/^-[a-z]*c$/, 'bash'], sh: [/^-[a-z]*c$/, 'bash'], zsh: [/^-[a-z]*c$/, 'bash'], dash: [/^-[a-z]*c$/, 'bash'], 'git-bash': [/^-[a-z]*c$/, 'bash'],
  cmd: [/^\/{1,2}[ck]$/i, 'cmd'], powershell: [/^-(c|command|encodedcommand|e|ec)$/i, 'ps'], pwsh: [/^-(c|command|encodedcommand|e|ec)$/i, 'ps'], wsl: [/^(-e|--exec|--)$/, 'bash'] };
const segs = []; const assigns = []; const nestedTexts = [];
const DOWNLOADERS = /^(curl|wget|irm|iwr|invoke-restmethod|invoke-webrequest)$/;
const RUN_PIPED = /^(sh|bash|zsh|dash|git-bash|pwsh|powershell|cmd|iex|invoke-expression|python3?|py|node|perl|ruby)$/;
const RUN_REMOTE = 'Tải mã từ Internet rồi chạy ngay (… | sh, … | iex) — không ai đọc được mã trước khi nó chạy với quyền của chủ máy. Tải về tệp, đọc, rồi mới chạy; cần chủ dự án đồng ý.';
const INSTALL_CODE = 'Cài skill/plugin/máy chủ MCP hoặc gói toàn máy = đưa mã lạ vào máy (chạy với quyền của chủ dự án, đọc được mọi tệp). Kiểm trước bằng /mission-skill-audit; chỉ chạy khi chủ dự án nói rõ «có».';
const SHELLS = { bash: 'bash', sh: 'bash', zsh: 'bash', dash: 'bash', 'git-bash': 'bash', pwsh: 'ps', powershell: 'ps', cmd: 'cmd' };
const PS_VALUE_PARAMS = /^-(value|filter|include|exclude|encoding|itemtype|name|argumentlist|delimiter|stream|credential|newname|destination|path|literalpath|filepath)$/i;
// PowerShell: if (…) { lệnh } elseif (…) { … } else { … }, while/foreach/for/switch, try/catch/finally →
// bỏ điều kiện, thân khối thành các lệnh thường (để git commit, Remove-Item… bên trong vẫn được xét).
function psFlatten(t) {
  let out = '', i = 0;
  const KW = /^(if|elseif|while|foreach|for|switch|until)\s*\(/i, KW2 = /^(else|try|finally|do|catch(\s*\[[^\]]*\])?)\s*\{/i;
  while (i < t.length) {
    const atStart = i === 0 || /[;\n{}|&]\s*$/.test(t.slice(Math.max(0, i - 20), i)) || /^\s*$/.test(t.slice(0, i));
    const rest = t.slice(i);
    let m;
    if (atStart && (m = KW.exec(rest))) {
      let j = i + m[0].length, d = 1;
      while (j < t.length && d) { if (t[j] === '(') d++; else if (t[j] === ')') d--; j++; }
      const b = /^\s*\{/.exec(t.slice(j)); out += ';'; i = b ? j + b[0].length : j; continue;
    }
    if (atStart && (m = KW2.exec(rest))) { out += ';'; i += m[0].length; continue; }
    if (t[i] === '}') { out += ';'; i++; continue; }
    if (t[i] === "'" ) { const e = t.indexOf("'", i + 1); const k = e < 0 ? t.length : e + 1; out += t.slice(i, k); i = k; continue; }
    if (t[i] === '"') { let k = i + 1; while (k < t.length && !(t[k] === '"' && t[k - 1] !== '`')) k++; out += t.slice(i, k + 1); i = k + 1; continue; }
    out += t[i++];
  }
  return out;
}
// ---------- theo dõi biến trong cùng một lệnh bash ----------
// vars: tên → giá trị chắc chắn, hoặc null = không biết (giữ nguyên $T, xét theo luật «đích dùng biến» như cũ).
// Mọi chỗ không chắc (gán có điều kiện, vòng lặp, eval, source, read…) đều đưa về null. Thà hỏi thừa còn hơn lọt.
let vars = new Map(), scopeStack = [], trackOff = false, envTempDirty = false;
const ASSIGN = /^[A-Za-z_]\w*=/;
const CONTROL = /^(if|then|elif|else|fi|for|select|while|until|do|done|case|esac|\{|\}|function|coproc)$/;
const TEMP_VARS = new Set(['TMPDIR', 'TEMP', 'TMP']);
const NO_EXPAND = new Set(['echo', 'printf', 'write-output', 'write-host', 'eval', 'alias', ...Object.keys(WRAP)]); // tham số là văn bản hoặc lệnh, không phải đường dẫn
const poisonAll = () => { for (const k of [...vars.keys(), ...TEMP_VARS]) vars.set(k, null); trackOff = true; };
function syncScope(scope) { // ( … ) chạy trong shell con: gán bên trong không ra ngoài
  let k = 0;
  while (k < scopeStack.length && k < scope.length && scopeStack[k].id === scope[k]) k++;
  while (scopeStack.length > k) vars = scopeStack.pop().saved;
  for (; k < scope.length; k++) scopeStack.push({ id: scope[k], saved: new Map(vars) });
}
function varValue(n) {
  if (vars.has(n)) return vars.get(n) ?? undefined;
  if (TEMP_VARS.has(n)) return process.env[n] || tmpdir().replace(/\\/g, '/');
  return undefined;
}
function resolveSub(text) { // chỉ hiểu mktemp và cygpath; lệnh con khác là «không biết»
  if (!text) return undefined;
  let p; try { p = parseShell(text, 'bash'); } catch { return undefined; }
  if (p.segs.length !== 1 || p.nested.length) return undefined;
  const s = p.segs[0];
  if (s.redirs.length || s.piped || s.bodies.length) return undefined;
  const w = s.words.map((x, i) => expandWord(x, s.metas[i]));
  const name = progName(w[0] || ''), args = w.slice(1);
  if (name === 'mktemp') {
    let base, useTmp = false; const pos = [];
    for (let i = 0; i < args.length; i++) {
      const a = args[i];
      if (/^-[dqu]+$/.test(a) || /^--(directory|quiet|dry-run)$/.test(a) || /^--suffix=/.test(a)) continue;
      if (a === '-t') { useTmp = true; continue; }
      if (a === '--tmpdir') { useTmp = true; continue; }
      if (a === '-p') { useTmp = true; base = args[++i]; continue; }
      if (/^--tmpdir=/.test(a)) { useTmp = true; base = a.slice(9); continue; }
      if (a.startsWith('-')) return undefined;
      pos.push(a);
    }
    if (pos.length > 1 || (pos[0] && (!useTmp || /[\\/]/.test(pos[0])))) return undefined; // mẫu không -t/-p: tạo ngay trong thư mục hiện hành
    base ??= vars.has('TMPDIR') ? varValue('TMPDIR') : (process.env.TMPDIR || '/tmp');
    if (!base || /[$`]/.test(base)) return undefined;
    return base.replace(/[\\/]+$/, '') + '/tmp.mktemp';
  }
  if (name === 'cygpath') {
    const pos = args.filter(a => !a.startsWith('-'));
    if (pos.length !== 1 || args.some(a => a.startsWith('-') && !/^-[mwua]+$|^--(mixed|windows|unix|absolute)$/.test(a))) return undefined;
    return /[$`]/.test(pos[0]) ? undefined : pos[0];
  }
  return undefined;
}
// Thay $T, ${T}, $(mktemp…), $(cygpath…) bằng giá trị đã biết; không biết thì giữ nguyên.
function expandWord(x, meta = {}, assign = false) {
  if (!x.includes('$')) return x;
  const fit = (m, v) => v === undefined || (meta.uq && !assign && /\s/.test(v)) ? m : v; // không ngoặc + có khoảng trắng = shell tách thành nhiều từ
  let i = 0;
  const a = x.replace(/\$\(…\)/g, m => fit(m, resolveSub(meta.subs?.[i++])));
  return a.replace(/\$\{([A-Za-z_]\w*)\}|\$([A-Za-z_]\w*)/g, (m, p, q) => fit(m, varValue(p || q)));
}
function setVar(word, meta, sg, upstreamN, sure = true) {
  const k = word.indexOf('='), name = word.slice(0, k);
  const unsure = !sure || trackOff || sg.piped || sg.op === '&' || upstreamN > 0 || (/^(&&|\|\|)$/.test(sg.opBefore || '') && !lastLiteralAssign);
  const v = unsure ? null : expandWord(word.slice(k + 1), meta, true);
  vars.set(name, v === null || /[$`]/.test(v) ? null : v);
}
let lastLiteralAssign = false; // đoạn trước chỉ gán giá trị chữ: chắc chắn thành công, nên «&&» sau nó vẫn chắc chạy
function collect(text, mode, depth = 0) {
  if (depth > 5) { decide('ask', 'Lệnh lồng quá sâu — hook không đọc hết được, cần người dùng xem.'); return; }
  if (depth > 0) { // lệnh con, bash -c, heredoc, eval: phạm vi biến riêng; biến cha coi như không biết
    const saved = [vars, scopeStack, trackOff, lastLiteralAssign];
    vars = new Map(); scopeStack = []; trackOff = false; lastLiteralAssign = false;
    collectBody(text, mode, depth);
    [vars, scopeStack, trackOff, lastLiteralAssign] = saved;
    return;
  }
  collectBody(text, mode, depth);
}
function collectBody(text, mode, depth) {
  if (mode === 'ps' && /\b(if|while|foreach|for|switch|try|do)\b/i.test(text)) text = psFlatten(text);
  const { segs: ss, nested } = parseShell(text, mode);
  const track = mode === 'bash';
  for (const n of nested) { nestedTexts.push(n); if (track && /^\(.*[^=!<>]=[^=]/s.test(n)) poisonAll(); collect(n, mode, depth + 1); } // $(( T=1 )) đổi biến
  let pipeline = [];
  for (const sg of ss) {
    if (track) {
      syncScope(sg.scope || []);
      if (CONTROL.test(sg.words[0] || '')) { trackOff = true; if (/^(for|select)$/.test(sg.words[0]) && sg.words[1]) vars.set(sg.words[1], null); }
      for (const x of sg.words) for (const m of x.matchAll(/\$\{([A-Za-z_]\w*):?=/g)) vars.set(m[1], null); // ${T:=x} gán ngầm
      const plus = /^([A-Za-z_]\w*)\+=/.exec(sg.words[0] || ''); if (plus) vars.set(plus[1], null);
    }
    const expand = (x, m) => track ? expandWord(x, m) : x;
    // redirect và tệp stdin dùng giá trị biến TRƯỚC khi đoạn lệnh này gán
    const redirs = sg.redirs.map(r => ({ ...r, target: expand(r.target, r.meta) }));
    const inputs = (sg.inputs || []).map((x, i) => expand(x, sg.inputMetas?.[i]));
    sg.expArgs = sg.words.slice(1).map((x, i) => expand(x, sg.metas?.[i + 1]));
    const upstream = pipeline; pipeline = sg.piped ? [...pipeline, sg] : [];
    let viaXargs = false;
    let w = sg.words.slice();
    // PowerShell: -Path:giá-trị → -Path giá-trị
    if (mode === 'ps') w = w.flatMap(x => { const m = /^(-[A-Za-z]\w*):(.+)$/.exec(x); return m ? [m[1], m[2]] : [x]; });
    const metaAt = rest => sg.metas?.[sg.words.length - rest];
    while (w.length) {
      const p0 = progName(w[0]);
      if (mode === 'ps' && /^\$[\w:]+/.test(w[0]) && (w[1] === '=' || /^\$[\w:]+=/.test(w[0]))) {
        if (/^\$env:(TEMP|TMP)\b/i.test(w[0])) envTempDirty = true;
        assigns.push(w[1] === '=' ? w.slice(2).join(' ') : w.join(' ').slice(w[0].indexOf('=') + 1)); w = []; break;
      }
      if (ASSIGN.test(w[0])) {
        assigns.push(w[0].slice(w[0].indexOf('=') + 1));
        if (track && w.every(x => ASSIGN.test(x))) setVar(w[0], metaAt(w.length), sg, upstream.length); // gán trần; gán tiền tố (T=x cmd) không đổi biến của shell
        w = w.slice(1); continue;
      }
      if (PREFIX.has(p0)) {
        if (p0 === 'xargs') viaXargs = true;
        if (track && p0 === '.') poisonAll();
        w = w.slice(1);
        if (FLAGGED_PREFIX.has(p0)) while (w.length && /^[-/]/.test(w[0])) { const f = w.shift(); if (/^-(u|g|n|I|d|P|s|L|t)$/.test(f) && w.length) w.shift(); }
        if (p0 === 'timeout') while (w.length && /^\d/.test(w[0])) w.shift();
        continue;
      }
      break;
    }
    if (track) lastLiteralAssign = !w.length && sg.words.length > 0 && sg.metas.every(m => !m.subs.length && !m.uq) && !trackOff;
    if (!w.length) { segs.push({ prog: '', args: [], redirs, inputs, piped: sg.piped, mode }); continue; }
    const prog = progName(w[0]);
    if (track && /^(export|declare|typeset|readonly|local)$/.test(prog)) { // chỉ gán biến, không chạy gì
      let sure = true;
      w.slice(1).forEach((a, k, rest) => {
        const m = metaAt(rest.length - k);
        if (/^-/.test(a)) { if (!/^-[xrg]+$/.test(a)) sure = false; return; }
        if (ASSIGN.test(a)) { assigns.push(a.slice(a.indexOf('=') + 1)); setVar(a, m, sg, upstream.length, sure); }
        else if (/^[A-Za-z_]\w*$/.test(a)) { if (prog !== 'export' || !sure) vars.set(a, null); }
        else poisonAll();
      });
      if (redirs.length) segs.push({ prog: '', args: [], redirs, inputs, piped: sg.piped, mode });
      continue;
    }
    if (track && (/^(read|unset|source|getopts|mapfile|readarray|let|trap)$/.test(prog) || (prog === 'printf' && w.includes('-v')))) poisonAll();
    if (mode === 'cmd' && prog === 'set') envTempDirty = true;
    if (track && !NO_EXPAND.has(prog)) { const n = w.length; w = [w[0], ...w.slice(1).map((a, k) => expandWord(a, metaAt(n - 1 - k)))]; }
    // shell nhận lệnh từ heredoc / here-string / ống dẫn (bash <<EOF, cat <<EOF | sh, echo "…" | sh) → đọc cả nội dung đó
    if (SHELLS[prog] && !w.slice(1).some(a => !/^[-/]/.test(a))) {
      const feeds = [...sg.bodies, ...upstream.flatMap(u => [...u.bodies, ...(/^(echo|printf|write-output|cat|type|gc|get-content)$/.test(progName(u.words[0] || '')) && /^(echo|printf|write-output)$/.test(progName(u.words[0] || '')) ? [u.words.slice(1).join(' ')] : [])])];
      for (const b of feeds) collect(b, SHELLS[prog], depth + 1);
      if (upstream.length && !feeds.length) decide('ask', `Lệnh đưa nội dung vào «${prog}» qua ống dẫn — hook không đọc được nội dung đó, cần người dùng xem.`);
    }
    if (prog === 'alias') { for (const a of w.slice(1)) { const k = a.indexOf('='); if (k > 0) collect(a.slice(k + 1), mode, depth + 1); } continue; }
    const wr = WRAP[prog];
    const wi = wr ? w.findIndex((t, k) => k > 0 && wr[0].test(t)) : -1;
    if (wi > 0) {
      if (/^-(encodedcommand|e|ec)$/i.test(w[wi]) && wr[1] === 'ps') decide('ask', 'Lệnh PowerShell mã hóa (-EncodedCommand) — không đọc được nội dung, cần người dùng xem.');
      collect(wr[1] === 'bash' ? (w[wi + 1] ?? '') : w.slice(wi + 1).join(' '), wr[1], depth + 1);
      segs.push({ prog, args: w.slice(1, wi + 1), redirs, piped: sg.piped, mode, wrapper: true });
      continue;
    }
    // tải mã từ Internet rồi chạy ngay (curl … | sh, irm … | iex, iex (irm …)): không ai đọc được mã trước khi nó chạy
    if (upstream.some(u => DOWNLOADERS.test(progName(u.words[0] || ''))) && RUN_PIPED.test(prog)) {
      // python/node/perl/ruby chỉ CHẠY mã từ ống dẫn khi không có script, không có -c/-e/-m (curl … | python -m json.tool là đọc dữ liệu)
      const interp = /^(python3?|py|node|perl|ruby)$/.test(prog), rest = w.slice(1);
      const codeFromStdin = !interp || rest.includes('-') || !rest.some(a => !a.startsWith('-') || /^(-[a-z]*[cemp]|--eval|--print|-pe)$/i.test(a));
      if (codeFromStdin) decide('ask', RUN_REMOTE);
    }
    if ((prog === 'iex' || prog === 'invoke-expression') && /\b(irm|iwr|invoke-restmethod|invoke-webrequest|curl|wget|downloadstring|downloadfile)\b/i.test(w.slice(1).join(' '))) decide('ask', RUN_REMOTE);
    if (prog === 'eval' || prog === 'invoke-expression' || prog === 'iex') { if (track) poisonAll(); collect(w.slice(1).join(' '), mode, depth + 1); continue; }
    segs.push({ prog, args: w.slice(1), redirs, inputs, piped: sg.piped, mode, viaXargs, upstream: upstream.map(u => u.expArgs) });
  }
}
collect(cmd, isPS ? 'ps' : 'bash');
// bash <(curl …), sh -c "$(curl …)": tải về và chạy luôn qua thế chỗ tiến trình/lệnh
if (/\b(ba|z|da)?sh\b[^|;&\n]*(<\(|\$\()\s*(curl|wget)\b/i.test(cmd)) decide('ask', RUN_REMOTE);

// ---------- git ----------
const GIT_KNOWN = new Set(('add am apply archive bisect blame branch bundle checkout cherry-pick citool clean clone commit config describe diff difftool fetch format-patch fsck gc grep gui help init log ls-files ls-remote ls-tree merge merge-base mergetool mv notes pull push range-diff rebase reflog remote repack replace reset restore revert rev-list rev-parse rm shortlog show show-ref sparse-checkout stash status submodule switch tag worktree version cat-file hash-object update-index update-ref symbolic-ref write-tree read-tree for-each-ref check-ignore check-attr lfs credential name-rev count-objects verify-commit maintenance var whatchanged annotate request-pull').split(' '));
function gitSplit(args) {
  let i = 0; const opts = [];
  while (i < args.length) {
    const a = args[i];
    if (/^-(C|c)$/.test(a) || /^--(git-dir|work-tree|namespace|exec-path|config-env)$/.test(a)) { opts.push([a, args[i + 1] || '']); i += 2; continue; }
    if (/^-/.test(a)) { opts.push([a, a.includes('=') ? a.split('=').slice(1).join('=') : '']); i++; continue; }
    break;
  }
  return { opts, sub: (args[i] || '').toLowerCase(), rest: args.slice(i + 1) };
}
const branchName = r => { const x = r.split(':').pop().replace(/^refs\/heads\//i, '').toLowerCase(); return (x === 'head' || x === '@') ? curBranch : x; };
const COMMITTING = new Set(['commit', 'merge', 'cherry-pick', 'rebase', 'revert', 'am', 'pull']);
function gitTrackCd(prev, S) {
  if (POPD.test(S.prog)) return null;
  const t = S.args.find(a => !a.startsWith('-') || a === '-'); if (!t) return prev; if (t === '-') return null;
  if (/[$`%]/.test(t)) return prev;
  const d = resolve(prev || cwd0, nativePath(t.replace(/^~(?=[\\/]|$)/, homedir())));
  try { return statSync(d).isDirectory() ? d : prev; } catch { return prev; }
}
let movesToProtected = false, commitsSomewhere = false, addSeen = false;
if (cfg.privacy.blockPush) for (const S of segs) if (S.prog === 'gh' && S.args[0] === 'repo' && (/^(sync|fork)$/.test(S.args[1] || '') || S.args.includes('--push')))
  decide('deny', 'Hook quyền riêng tư: dự án đang chặn đẩy git lên máy chủ (privacy.blockPush). Hỏi chủ dự án.');

let gTracked = null;
for (const S of segs) {
  if (CD.test(S.prog) || POPD.test(S.prog)) { gTracked = gitTrackCd(gTracked, S); continue; }
  if (S.prog !== 'git') continue;
  const { opts, sub, rest } = gitSplit(S.args);
  const gdirs = [...new Set([cwd0, gTracked].filter(Boolean))].map(b => opts.filter(([o]) => o === '-C').reduce((d, [, v]) => resolve(d, nativePath(v)), b));
  if (opts.some(([o, v]) => /^-c$|^--config-env/.test(o) && /^alias\./i.test(v)) || opts.some(([o]) => /^-c\s*alias\./i.test(o)))
    decide('deny', 'Không tạo alias cho git: alias có thể che lệnh push/commit khỏi lớp bảo vệ. Gõ lệnh git đầy đủ.');
  if (!sub) continue;
  if (sub === 'send-pack') { decide('deny', 'git send-pack bị cấm (đẩy thẳng lên máy chủ).'); continue; }
  if (!GIT_KNOWN.has(sub)) { decide('ask', `«git ${sub}» không phải lệnh git chuẩn (có thể là alias) — cần người dùng xem.`); continue; }
  if (sub === 'config' && rest.some(a => /^alias\./i.test(a)) && !rest.some(a => /^(--get\S*|--list|-l|--show-origin)$/.test(a)))
    decide('deny', 'Không tạo alias cho git: alias có thể che lệnh push/commit khỏi lớp bảo vệ. Gõ lệnh git đầy đủ.');
  if (sub === 'push') {
    if (rest.some(a => /^--force(-with-lease|-if-includes)?(=|$)|^--mirror$|^--delete$|^--prune$|^-[a-zA-Z]*[fd][a-zA-Z]*$/.test(a)) || rest.some(a => /^\+/.test(a) || /^:/.test(a)))
      decide('deny', 'Không force-push / xóa nhánh từ xa. Lịch sử đã đẩy lên phải được giữ nguyên.');
    const targets = rest.filter(a => !a.startsWith('-')).slice(1).map(branchName);
    if (branchMode && (rest.includes('--all') || rest.includes('--branches') || targets.some(r => prot.includes(r)) || (onProtected && targets.length === 0)))
      decide('deny', 'Chế độ branch-pr: không đẩy thẳng (hoặc --all) lên nhánh được bảo vệ. Đẩy nhánh làm việc rồi mở PR.');
    if (!branchMode) decide('ask', 'Chế độ local-main: đẩy lên máy chủ từ xa (git push) cần chủ dự án đồng ý.');
  }
  if (['checkout', 'switch'].includes(sub)) {
    const tgt = rest.filter(a => !a.startsWith('-'));
    if (!rest.some(a => /^-(b|B|c|C)$|^--orphan$/.test(a)) && tgt.length === 1 && prot.includes(tgt[0].toLowerCase())) movesToProtected = true;
  }
  if (COMMITTING.has(sub)) commitsSomewhere = true;
  // quyền riêng tư: thông tin khách không vào git (privacy.*)
  if (sub === 'add') addSeen = true;
  if (sub === 'commit' || ((sub === 'tag' || sub === 'merge') && rest.some(a => /^(-m|--message|-F|--file)(=|$)|^-[a-zA-Z]*m/.test(a)))) {
    const pc = parseCommit(rest);
    // lời nhắn viết bằng $(cat <<'EOF' … EOF), -F - <<EOF, echo … | git commit -F -: đọc cả nội dung lệnh
    if (pc.messages.some(m => m.includes('$(…)')) || pc.messageFiles.includes('-') || S.upstream?.length || S.piped) {
      const why = messageIssue(root, cfg, [cmd]); if (why) decide('deny', 'Hook quyền riêng tư: ' + why);
    }
    if (sub !== 'commit') { const why = messageIssue(root, cfg, pc.messages); if (why) decide('deny', 'Hook quyền riêng tư: ' + why); }
  }
  if (sub === 'commit') for (const gdir of gdirs) { const pc = parseCommit(rest); if (pc.pathspecFiles.includes('-')) decide('ask', 'git commit đọc danh sách tệp từ stdin — hook không kiểm được tệp nào vào commit.'); const why = commitPrivacy(root, cfg, { ...pc, addFirst: addSeen, cwd: gdir }); if (why) decide('deny', 'Hook quyền riêng tư: ' + why); }
  if (cfg.privacy.blockPush && (sub === 'push' || (sub === 'remote' && /^(add|set-url|rename)$/.test(rest[0] || '')) || (sub === 'config' && rest.some(a => /^remote\./i.test(a)) && !rest.some(a => /^(--get\S*|--list|-l)$/.test(a)))))
    decide('deny', 'Hook quyền riêng tư: dự án đang chặn đẩy git lên máy chủ (privacy.blockPush) — lịch sử git còn thông tin khách cần làm sạch trước. Hỏi chủ dự án.');
  if (branchMode) {
    if (onProtected && COMMITTING.has(sub))
      decide('deny', `Chế độ branch-pr: đang ở nhánh được bảo vệ «${branch}». Tạo nhánh làm việc trước: git switch -c ${cfg.workBranchPrefix}<tên>`);
    if (sub === 'branch' && rest.some(a => /^-(f|M|C|m|c)$|^--force$/.test(a)) && rest.some(a => prot.includes(a.toLowerCase())))
      decide('deny', 'Chế độ branch-pr: không ép/đổi tên nhánh được bảo vệ.');
    if (sub === 'update-ref' && rest.some(a => /^refs\/heads\//i.test(a) && prot.includes(branchName(a))))
      decide('deny', 'Chế độ branch-pr: không sửa trực tiếp con trỏ nhánh được bảo vệ.');
  }
  // lệnh git cần hỏi
  const has = re => rest.some(a => re.test(a));
  if (sub === 'reset' && has(/^--hard$/)) decide('ask', 'git reset --hard xóa thay đổi chưa commit.');
  if (sub === 'clean' && has(/^-[a-zA-Z]*f/)) decide('ask', 'git clean -f xóa tệp chưa theo dõi.');
  if (['checkout', 'restore'].includes(sub) && rest.filter(a => !a.startsWith('-')).some(a => a === '.' || a === ':/')) decide('ask', 'Lệnh này bỏ toàn bộ thay đổi chưa commit.');
  if (sub === 'branch' && has(/^-D$/)) decide('ask', 'Xóa nhánh chưa merge.');
  if (['rebase', 'filter-branch', 'filter-repo'].includes(sub)) decide('ask', 'Viết lại lịch sử Git.');
  if (sub === 'stash' && /^(drop|clear)$/.test(rest[0] || '')) decide('ask', 'Xóa stash.');
  if (['apply', 'am'].includes(sub)) decide('ask', 'Áp bản vá (git apply/am) có thể sửa cả sổ .mission và vùng bảo vệ — xem nội dung bản vá trước.');
}
if (branchMode && movesToProtected && commitsSomewhere)
  decide('deny', 'Chế độ branch-pr: lệnh vừa chuyển sang nhánh được bảo vệ vừa commit/merge. Làm trên nhánh riêng rồi mở PR.');

// ---------- ghi vào vùng cấm ----------
const READONLY = new Set(('cat type gc get-content head tail less more grep egrep fgrep rg ag findstr select-string sls wc ls ll dir gci get-childitem ' +
  'stat file diff cmp jq yq test [ realpath readlink basename dirname du md5sum sha1sum sha256sum shasum echo printf write-output write-host ' +
  'cd pushd popd set-location sl test-path resolve-path get-item gi get-itemproperty split-path join-path measure-object where where-object which whereis tree ' +
  'sort uniq cut column nl od xxd hexdump strings true false exit sleep date pwd whoami hostname format-table ft format-list fl select-object select foreach-object % ? out-host out-null get-filehash convertfrom-json').split(' '));
const SENS_TEXT = /\.mission[\\/]+(ledger\.jsonl|gates\.json|manifest\.json|state)|\.claude[\\/]+mission-kit/i;
const nullTarget = t => /^(\/dev\/null|nul|\$null|null|\/dev\/stdout|\/dev\/stderr)$/i.test(t);
const envTemp = () => (process.env.TEMP || tmpdir()).replace(/\\/g, '/');
const expandEnvTemp = t => envTempDirty ? t : t.replace(/%(TEMP|TMP)%|\$env:(TEMP|TMP)\b/gi, () => envTemp());
const expandVars = t => expandEnvTemp(t).replace(/^~\+(?=[\\/]|$)/, cwd).replace(/\$\{?PWD\}?|\$\(pwd\)|\$pwd\b/gi, cwd).replace(/\$\{?CLAUDE_PROJECT_DIR\}?|\$env:CLAUDE_PROJECT_DIR/gi, root)
  .replace(/^~(?=[\\/]|$)/, home).replace(/\$\{?HOME\}?|\$env:USERPROFILE|%USERPROFILE%/gi, home);
const varTargetSensitive = () => assigns.some(a => SENS_TEXT.test(a) || /\.mission|\.claude/i.test(a));
const isVar = x => (/[$`%]/.test(x) && !/^\$null$/i.test(x)) || /^@\w+$/.test(x);
const nestedSensitive = () => nestedTexts.some(t => /\.mission|\.claude|mission-kit/i.test(t));
const inProject = x => { const r = relative(root, resolve(cwd, x)); return r && !r.startsWith('..') && !/^[a-zA-Z]:/.test(r); };

let curMode = 'bash'; // ngôn ngữ của đoạn lệnh đang xét: chỉ Git Bash mới coi /tmp là %TEMP%
const np = p => nativePath(p, { gitBashTmp: curMode === 'bash' });
const samePath = (a, b) => relative(a, b) === '';
function judge(t, { soft = false, ci = false } = {}) {
  if (!t || nullTarget(t)) return;
  let x = expandVars(String(t).replace(/^-{1,2}[\w-]+=/, ''));
  if (curMode !== 'bash' && /^\/tmp(\/|$)/i.test(x)) x = resolve(cwd, x);
  if (isVar(x)) {
    if (soft) return;
    decide(SENS_TEXT.test(x) || /mission|\.claude/i.test(x) || varTargetSensitive() || (x.includes('$(…)') && nestedSensitive()) ? 'deny' : 'ask', `Đích ghi «${t}» dùng biến/lệnh con — hook không biết nó trỏ tới đâu. Viết đường dẫn cụ thể.`);
    return;
  }
  // chỉ "nhắc tới" (vd. đoạn mã node -e có { { lồng nhau) thì không phải đích ghi — bỏ qua; tệp kit vẫn bị bắt ở SENS_TEXT
  if (/\{[^}]*\{/.test(x)) { if (soft) return; decide('ask', `Mẫu «${t}» có ngoặc nhọn lồng nhau — hook không đọc được, viết đường dẫn cụ thể.`); return; }
  if (!soft) { // dòng khóa và tệp kết luận chỉ được sửa bằng công cụ Edit/Write (hook kiểm được nội dung)
    const abs = resolve(cwd, np(x.replace(/^["']|["']$/g, ''))), rel = relative(root, abs).split(sep).join('/');
    const lg = lockedGlobs(cfg);
    if (lg.length && !rel.startsWith('..') && (matchAny(rel, lg) || (hasGlob(x) && lg.some(g => shellMatch(x, g, rel)))))
      decide('ask', `Lệnh shell ghi/xóa «${t}» — tệp có chuỗi bị khóa (protect.lockedText). Dùng công cụ Edit để hook kiểm được chuỗi khóa còn nguyên.`);
    const h = handoffCfg(cfg);
    if (h.verdictGlob && (globToRegex(h.verdictGlob).test(rel) || globToRegex(h.verdictGlob).test(basename(abs)) || (hasGlob(x) && /VERDICT/i.test(x))) && (existsSync(abs) || hasGlob(x)))
      decide('deny', 'Tệp kết luận của người soát bên ngoài chỉ ghi một lần và không sửa — kể cả bằng lệnh shell.');
  }
  const k = hasGlob(x) ? globKind(root, cfg, cwd, x, ci) : pathKind(root, cfg, cwd, x);
  if (!k) return;
  if (soft) { if (k.tier === 'kit') decide('ask', `Lệnh nhắc tới «${t}». ${k.reason} Nếu lệnh chỉ ĐỌC thì đồng ý được.`); return; }
  if (k.tier === 'protectAsk' && inFreeDir(root, cfg, cwd, curMode === 'bash' ? x : resolve(cwd, np(x)))) return; // bash.freeDirs: không hỏi (chặn vẫn thắng)
  decide(k.kind,k.kind === 'deny' ? `Lệnh có vẻ ghi/xóa «${t}». ${k.reason}` : k.reason);
}
const RREC = /^-(r(e(c(u(r(s(e)?)?)?)?)?)?)$/i;
function recursiveDelete(S, targets) {
  for (const t of targets) {
    const x = expandVars(t);
    if (isVar(x)) { decide('ask', `Xóa đệ quy «${t}» (đường dẫn dùng biến) — kiểm tra lại.`); continue; }
    const nx = np(x.replace(/^["']|["']$/g, ''));
    const abs = resolve(cwd, nx);
    const r = relative(root, abs);
    if (samePath(abs, root) || samePath(abs, home) || samePath(abs, resolve('/')) || /^[a-zA-Z]:[\\/]?$/.test(abs) || x === '*' || x === './*' || (hasGlob(x) && relative(root, resolve(cwd, nx.replace(/[*?[\]{}].*$/, ''))) === ''))
      decide('deny', 'Lệnh xóa đệ quy ở gốc hệ thống/dự án bị cấm.');
    else if ((r.startsWith('..') || /^[a-zA-Z]:/.test(r)) && !inFreeDir(root, cfg, cwd, curMode === 'bash' ? nx : abs)) decide('ask', `Xóa đệ quy «${t}» nằm ngoài thư mục dự án — kiểm tra lại.`);
    judge(t, { ci: S.mode !== 'bash' });
    linkInside(t, scanTargets(x));
  }
}

// ---------- LỖI 11: dữ liệu quan trọng (protect.important), junction/symlink ----------
let _imp; const IMP = () => _imp ??= importantEntries(root, cfg);
const relShow = (abs, isDir) => { const r = relative(root, abs).split(sep).join('/'); return (r && !r.startsWith('..') && !/^[a-zA-Z]:/.test(r) ? r : abs.split(sep).join('/')) + (isDir ? '/' : ''); };
const GLOBCH = /[*?[\]{}]/;
const isDirAbs = a => { try { return statSync(a).isDirectory(); } catch { return false; } };
// đường dẫn trong lệnh → tuyệt đối (có ký tự đại diện: lấy phần thư mục đứng trước nó). null = không biết (biến).
function absOf(t) {
  const x = expandVars(String(t).replace(/^["']|["']$/g, '')); if (!x || isVar(x)) return null;
  const nx = np(x);
  const pre = GLOBCH.test(nx) ? (nx.replace(/[\\/]*[^\\/]*[*?[\]{}].*$/, '') || '.') : nx;
  return resolve(cwd, pre);
}
// Mục quan trọng bị đụng bởi đích «abs»: đích nằm trong mục, hoặc mục nằm trong đích.
function impHits(abs) {
  const out = [];
  for (const e of IMP()) {
    if (within(abs, e.abs)) out.push({ shown: relShow(abs, isDirAbs(abs)), abs });
    else if (within(e.abs, abs)) out.push({ shown: relShow(e.abs, e.isDir), abs: e.abs });
  }
  return out;
}
function askImportant(verb, S, abs) {
  for (const h of impHits(abs)) {
    const c = scanTree(h.abs);
    decide('ask', `Lệnh «${S.prog}» sẽ ${verb} «${h.shown}» — thư mục/tệp quan trọng (protect.important): ${fmtCount(c)} có thể MẤT. Dừng lại, hỏi chủ dự án; cần làm thật thì sao lưu (chép) trước.`);
  }
}
const PSREC = /^-r(e(c(u(r(s(e)?)?)?)?)?)?$/i;
const recFlag = S => S.mode === 'ps' ? S.args.some(a => PSREC.test(a)) : S.args.some(a => /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(a) || a === '--recursive' || /^\/s$/i.test(a));
// tham số không phải cờ (PowerShell: lấy cả giá trị của -Path/-LiteralPath, bỏ giá trị của các tham số khác; cmd: bỏ /s /q /MIR…)
function plainArgs(S) {
  const { args } = S, out = [];
  for (let k = 0; k < args.length; k++) {
    if (S.mode === 'ps' && PS_VALUE_PARAMS.test(args[k])) { if (/^-(path|literalpath)$/i.test(args[k]) && args[k + 1]) out.push(args[k + 1]); k++; continue; }
    if (/^-/.test(args[k]) || (S.mode !== 'bash' && /^\/[a-z]{1,5}(:\S*)?$/i.test(args[k]))) continue;
    out.push(args[k]);
  }
  return out;
}
function importantSeg(S) {
  const { prog, args } = S; const positional = plainArgs(S);
  const each = (list, verb) => list.forEach(t => { const a = absOf(t); if (a) askImportant(verb, S, a); });
  if (/^(rm|rmdir|unlink|del|erase|rd|ri|remove-item)$/.test(prog)) {
    if (recFlag(S) || (/^(rmdir|rd)$/.test(prog) && args.some(a => /^\/s$/i.test(a)))) each(positional, 'xóa đệ quy');
    else each(positional.filter(t => GLOBCH.test(t) || isDirAbs(absOf(t) || '')), 'xóa hàng loạt tệp trong');
    return;
  }
  if (prog === 'find' && (args.includes('-delete') || args.some((a, i) => a === '-exec' && /^(rm|rmdir|del)$/.test(args[i + 1] || '')))) {
    const starts = []; for (const a of args) { if (/^-|^[!()]/.test(a)) break; starts.push(a); }
    each(starts.length ? starts : ['.'], 'xóa'); (starts.length ? starts : ['.']).forEach(t => linkInside(t, scanTargets(t))); return;
  }
  if (prog === 'git') {
    const { opts, sub, rest } = gitSplit(args);
    const base = opts.filter(([o]) => o === '-C').reduce((d, [, v]) => resolve(d, nativePath(v)), cwd);
    const specs = rest.filter(a => !a.startsWith('-'));
    const run = (list, verb) => (list.length ? list : ['.']).forEach(t => askImportant(verb, S, /^(\.|:\/)$/.test(t) ? base : resolve(base, np(t))));
    const cleaning = sub === 'clean' && rest.some(a => /^-[a-zA-Z]*f|^--force$/.test(a)) && !rest.some(a => /^-[a-zA-Z]*n|^--dry-run$/.test(a));
    if (cleaning) { run(specs, 'xóa (tệp chưa theo dõi/bị ignore — tối đa)'); (specs.length ? specs : ['.']).forEach(t => linkInside(t, /^(\.|:\/)$/.test(t) ? [base] : scanTargets(resolve(base, np(t))))); }
    if (sub === 'rm' && rest.some(a => /^-[a-zA-Z]*r|^--recursive$/.test(a)) && !rest.includes('--cached')) run(specs, 'xóa khỏi cây làm việc');
    return;
  }
  if (prog === 'robocopy' && args.some(a => /^\/(mir|purge)$/i.test(a))) { if (positional[1]) { each([positional[1]], 'xóa sạch và ghi đè (robocopy /MIR)'); linkInside(positional[1], scanTargets(positional[1])); } return; }
  if (/^(mv|move|move-item|mi|rename-item|rni|ren|rename)$/.test(prog)) {
    const ti = args.findIndex(a => /^(-t|--target-directory|-destination)$/i.test(a)); const t = ti >= 0 ? args[ti + 1] : undefined;
    const srcs = t ? positional.filter(a => a !== t) : positional.slice(0, -1), dst = t || positional.at(-1);
    each(srcs, 'dời/đổi tên (biến mất khỏi chỗ cũ)');
    if (dst) { const a = absOf(dst); if (a && existsSync(a) && !isDirAbs(a)) askImportant('ghi đè lên', S, a); }
  }
}
function linkSeg(S) {
  const { prog, args } = S; const positional = plainArgs(S);
  const named = re => { const i = args.findIndex(a => re.test(a)); return i >= 0 ? args[i + 1] : undefined; };
  let target, link;
  if (prog === 'mklink' || prog === 'junction') [link, target] = positional;
  else if (prog === 'ln' && args.some(a => /^-[a-zA-Z]*s|^--symbolic$/.test(a))) [target, link] = positional;
  else if (/^(new-item|ni)$/.test(prog) && /^(junction|symboliclink|symlink|hardlink)$/i.test(named(/^-(itemtype|type)$/i) || '')) { target = named(/^-(target|value)$/i); link = named(/^-(path|name)$/i) ?? positional[0]; }
  else return;
  const x = target ? expandVars(String(target).replace(/^["']|["']$/g, '')) : null;
  if (x === null || isVar(x)) { decide('ask', `Tạo junction/symlink «${link ?? '?'}» với đích «${target ?? '(không rõ)'}» không đọc được — hook không biết nó trỏ vào đâu. Dùng CHÉP (cp -r / robocopy không /MIR) thay vì liên kết.`); return; }
  const nx = np(x), cands = [resolve(cwd, nx)];
  if (link) cands.push(resolve(dirname(resolve(cwd, np(expandVars(String(link))))), nx)); // đích tương đối tính từ chỗ đặt liên kết
  for (const a of cands) {
    if (isRealAppsPath(a) || isRealAppsPath(x)) { decide('ask', `Tạo junction/symlink «${link ?? '?'}» → «${target}» trỏ vào thư mục app thật (MISSION_APPS_ROOT). Xóa/dọn qua liên kết sẽ xóa dữ liệu thật (đã từng mất samples, out\\golden, node_modules). Dùng CHÉP (cp -r / robocopy không /MIR) thay vì liên kết.`); return; }
    const h = impHits(a)[0];
    if (h) { decide('ask', `Tạo junction/symlink «${link ?? '?'}» → «${target}» trỏ vào thư mục quan trọng «${h.shown}» (protect.important). Xóa/dọn qua liên kết sẽ xóa dữ liệu thật. Dùng CHÉP (cp -r / robocopy không /MIR) thay vì liên kết.`); return; }
  }
}
// Đích thật cần quét liên kết. Có ký tự đại diện ở đoạn cuối (rm -rf dir/*): mở rộng MỘT cấp như shell rồi quét từng mục khớp
// (không quét cả thư mục cha — `rm *.tmp` ở gốc dự án sẽ quét cả dự án). Ký tự đại diện ở giữa: quét phần thư mục đứng trước (trừ gốc dự án).
function scanTargets(x0) {
  const nx = np(String(x0).replace(/^["']|["']$/g, ''));
  if (!GLOBCH.test(nx)) return [resolve(cwd, nx)];
  const m = /^(.*[\\/])?([^\\/]*)$/.exec(nx), dirPart = m[1] || '', last = m[2];
  if (!GLOBCH.test(dirPart)) {
    const d = resolve(cwd, dirPart || '.'); let names = [], re;
    try { re = globToRegex(last); names = readdirSync(d); } catch { return []; }
    return names.filter(n => re.test(n)).map(n => resolve(d, n));
  }
  const pre = resolve(cwd, nx.replace(/[\\/]*[^\\/]*[*?[\]{}].*$/, '') || '.');
  return samePath(pre, root) ? [] : [pre];
}
// Xóa đệ quy: đích là/chứa junction hoặc symlink → hỏi, KỂ CẢ trong thư mục tạm được miễn (nơi rủi ro này hay gặp).
function linkInside(t, list) {
  let truncated = false;
  for (const abs of list) {
    const L = scanTree(abs, { maxEntries: 150000, maxMs: 2500, stopAtLinks: 3, bytes: false });
    if (L.links.length) {
      const first = L.links.slice(0, 3).map(l => `«${relShow(resolve(l.path), false)}»${l.target ? ' → ' + l.target : ''}`).join(', ');
      decide('ask', `Xóa đệ quy «${t}» ${L.links[0].self ? 'là' : 'có bên trong'} junction/symlink ${first}. Xóa đệ quy có thể đi xuyên liên kết và xóa dữ liệu thật ở đích. Gỡ liên kết trước bằng lệnh gỡ liên kết (cmd //c rmdir "<liên-kết>" — KHÔNG /s, KHÔNG rm -r), rồi mới xóa phần còn lại. Muốn chia sẻ dữ liệu thì CHÉP.`);
      return;
    }
    if (L.truncated) truncated = true;
  }
  if (truncated) decide('ask', `Xóa đệ quy «${t}»: thư mục quá lớn, hook không quét hết để chắc chắn bên trong không có junction/symlink. Kiểm tra thủ công trước (dir /AL /S).`);
}

const DEPLOY_WORD = /^([\w.-]*[\/:])?(deploy|publish|release)(:[\w-]+)?$/i;
const DEPLOY_SCRIPT = /(^|[\\/])(deploy|publish|release)([-_](prod|production|live|site|web|all|pages))?\.(sh|ps1|py|mjs|cjs|js|cmd|bat)$/i;
const RUNNERS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'make', 'sh', 'bash', 'py', 'python', 'python3', 'node', 'npx', 'bunx', 'pwsh', 'powershell']);
const shipCmds = [['deployCmd', 'TRANG THẬT'], ['previewCmd', 'bản xem trước']].map(([k, label]) => {
  const c = cfg.ship?.[k]; if (typeof c !== 'string' || !c.trim()) return null;
  const segsC = []; const { segs: ss } = parseShell(c, 'bash');
  for (const sg of ss) { const w = sg.words.filter(x => !/^[A-Za-z_]\w*=/.test(x)); if (w.length) segsC.push(w.map(progName).join(' ')); }
  return { k, label, words: segsC.at(-1) };
}).filter(Boolean);
const coreWords = S => [S.prog, ...S.args.map(a => (/[\\/]/.test(a) && !a.startsWith('-')) ? progName(a) : a)].join(' ');

// Thư mục sau cd/pushd/Set-Location: hook không biết chắc lệnh cd nằm trong ( ), $( ), bash -c hay đã popd / cd -,
// nên xét MỖI đoạn lệnh ở cả thư mục ban đầu lẫn thư mục sau cd, lấy kết quả nghiêm hơn.
function trackCd(prev, S) {
  if (!CD.test(S.prog) && !/^popd$/.test(S.prog)) return prev;
  if (POPD.test(S.prog)) return null;
  const t = S.args.find(a => !a.startsWith('-') || a === '-');
  if (!t) return S.prog === 'cd' || S.prog === 'chdir' ? homedir() : prev;
  if (t === '-') return null;
  const x = expandVars(t); if (isVar(x)) return prev;
  const d = resolve(prev || cwd0, nativePath(x));
  try { return statSync(d).isDirectory() ? d : prev; } catch { return prev; }
}
function checkSeg(S) {
  const { prog, args } = S;
  curMode = S.mode || 'bash';
  const ci = S.mode !== 'bash' || /-(item|content)$|^(sc|ac|ni|mi|ri|cpi|rni|clc|del|erase|rd|ren|copy|move|md|mkdir)$/.test(prog);
  for (const r of S.redirs) judge(r.target, { ci });
  if (S.wrapper) return;
  if (!prog) return;
  importantSeg(S); linkSeg(S);
  if (/^[$@]/.test(prog)) { decide(varTargetSensitive() ? 'deny' : 'ask', `Tên chương trình «${prog}» là biến — hook không biết lệnh thật là gì, cần người dùng xem.`); return; }
  if (/^\[(system\.)?io\.(file|directory|path)\]::/i.test(prog) || /^\[/.test(prog) && /::(write|append|delete|copy|move|replace|create|open|setcontent)/i.test(prog)) {
    decide(nestedSensitive() ? 'deny' : 'ask', 'Gọi thẳng .NET ([IO.File]::…) để ghi/xóa tệp — ' + (nestedSensitive() ? 'nhắm vào sổ/tệp kit, không được.' : 'cần người dùng xem.'));
    return;
  }
  // lệnh xóa/ghi lấy đường dẫn từ ống dẫn hoặc xargs: đường dẫn ở các lệnh phía trước là đích thật
  if (/^(rm|rmdir|unlink|del|erase|rd|ri|remove-item|set-content|sc|add-content|ac|clear-content|clc|move-item|mi|rename-item|rni|copy-item|cpi|out-file|mv|cp|shred|truncate|chmod)$/.test(prog)) {
    const positional = []; for (let k = 0; k < args.length; k++) { if (S.mode === 'ps' && PS_VALUE_PARAMS.test(args[k])) { k++; continue; } if (!/^-/.test(args[k])) positional.push(args[k]); }
    const hasPath = positional.length || args.some(a => /^-(path|literalpath|filepath)$/i.test(a));
    if (S.viaXargs || (S.upstream?.length && !hasPath)) for (const u of S.upstream || []) u.filter(a => !/^-/.test(a)).forEach(a => judge(a, { ci }));
  }
  const nonFlag = args.filter(x => !/^-/.test(x) && !/^\/[a-z]$/i.test(x));
  const named = re => { const i = args.findIndex(a => re.test(a)); return i >= 0 ? args[i + 1] : undefined; };
  // công cụ của chính kit (mission.mjs, tools/*.mjs): tin cậy, tham số là ghi chú, không xét
  const first = args.find(a => !a.startsWith('-'));
  if (prog === 'node' && first && (/(\$\{?(env:)?MISSION_KIT\}?|mission-kit)[\\/]+(mission\.mjs|tools[\\/]+[\w-]+\.mjs)$/i.test(first) || /(^|[\\/])mission\.mjs$/i.test(first))) {
    // ngoại lệ: «--by human:<tên>» là chữ ký của chủ dự án (bỏ qua lỗi nặng, đặt cổng NA) — Claude không được tự ký thay
    const byHuman = args.some((a, k) => /^--by=human:/i.test(a) || (a === '--by' && /^human:/i.test(args[k + 1] || '')));
    if (byHuman) decide('ask', 'Lệnh ghi «--by human:<tên>»: đây là chữ ký của chủ dự án (bỏ qua lỗi nặng hoặc đặt cổng NA). Chỉ chạy khi chính chủ dự án vừa quyết trong chat; Claude không ký thay.');
    return;
  }

  // --- chặn hẳn ---
  if (prog === 'gh' && args[0] === 'pr' && args[1] === 'merge') decide('deny', 'Không tự merge PR. Việc merge do chủ dự án quyết định.');
  if (prog === 'gh' && args[0] === 'release' && /^(create|upload|delete|edit)$/.test(args[1] || '')) decide('deny', 'Không tự tạo/sửa/xóa GitHub Release hay thay asset đã phát hành.');
  if (/^(npm|pnpm|yarn)$/.test(prog) && args[0] === 'publish') decide('deny', 'Không tự phát hành gói.');
  const joined = [prog, ...args].join(' ');
  for (const r of cfg.bash.deny) { try { if (new RegExp(r, 'i').test(joined)) decide('deny', `Lệnh khớp luật cấm riêng của dự án: /${r}/`); } catch {} }
  for (const r of cfg.bash.ask) { try { if (new RegExp(r, 'i').test(joined)) decide('ask', `Lệnh khớp luật «cần xác nhận» của dự án: /${r}/ (đọc script trước khi chạy).`); } catch {} }
  if (prog === 'git') {
    const { sub, rest, opts } = gitSplit(args);
    if (['checkout', 'restore', 'rm', 'mv', 'clean', 'reset', 'stash'].includes(sub)) rest.filter(a => !a.startsWith('-')).forEach(a => judge(a, { ci }));
    // git config đặt khóa chạy lệnh (hooksPath, fsmonitor, sshCommand, alias, credential helper…): mã tự chạy về sau
    if (sub === 'config' && !rest.some(a => /^(--get(-all|-regexp)?|-l|--list|--show-origin|--unset(-all)?)$/.test(a))) {
      const pos = []; for (let k = 0; k < rest.length; k++) { if (/^(-f|--file|--blob|-t|--type|--default|--comment)$/.test(rest[k])) { k++; continue; } if (!rest[k].startsWith('-')) pos.push(rest[k]); }
      if (/^(set|get|get-all|get-regexp|list|unset|unset-all|edit|rename-section|remove-section|get-urlmatch|get-color|get-colorbool)$/.test(pos[0] || '')) { if (pos[0] !== 'set') pos.length = 0; else pos.shift(); }
      const key = pos[0];
      if (key && pos.length >= 2 &&/^(core\.(hookspath|fsmonitor|sshcommand|pager|editor|askpass|gitproxy)|alias\.|credential\.|url\..*\.insteadof|include\.|includeif\.|filter\.|diff\..*\.(textconv|command)|merge\..*\.driver|sequence\.editor|gpg\.program|remote\..*\.(url|pushurl|receivepack|uploadpack))/i.test(key))
        decide('ask', `git config ${key}: khóa này làm git tự chạy lệnh hoặc đổi nơi đẩy mã. Cần chủ dự án đồng ý.`);
    }
    for (const [o, v] of opts) if (/^-c$/.test(o) && /^(core\.(hookspath|fsmonitor|sshcommand)|alias\.|credential\.)/i.test(v)) decide('ask', `git -c ${v.split('=')[0]}: chạy git với lệnh tự chạy lạ. Cần chủ dự án đồng ý.`);
    if (sub === 'clone') { // thư mục đích (vd. .claude/skills/x) cũng là chỗ ghi
      const pos = []; for (let k = 0; k < rest.length; k++) { if (/^(-b|--branch|--depth|-o|--origin|-c|--config|--reference|--separate-git-dir|-j|--jobs|-u|--upload-pack|--template|--shallow-since|--shallow-exclude)$/.test(rest[k])) { k++; continue; } if (!rest[k].startsWith('-')) pos.push(rest[k]); }
      if (pos.length >= 2) judge(pos.at(-1), { ci });
    }
    return;
  }
  // --- cài skill/plugin/MCP/gói toàn máy ---
  if (prog === 'claude' && ((/^plugins?$/.test(args[0] || '') && args.slice(1).some(a => /^(install|i|add|update|enable)$/.test(a))) || (args[0] === 'mcp' && /^add/.test(args[1] || ''))))
    decide('ask', INSTALL_CODE);
  // giải nén / clone vào đâu: thư mục đích là chỗ ghi (vd. .claude/skills/x)
  if (prog === 'tar') { const t = named(/^(-C|--directory)$/); if (t) judge(t, { ci }); for (const a of args) { const m = /^--directory=(.+)$/.exec(a); if (m) judge(m[1], { ci }); } }
  if (prog === 'gh' && args[0] === 'repo' && args[1] === 'clone') { const pos = args.slice(2).filter(a => !a.startsWith('-')); if (pos.length >= 2) judge(pos[1], { ci }); }
  if (/^(expand-archive)$/.test(prog)) { const t = named(/^-(destinationpath|destination|d)$/i); if (t) judge(t, { ci }); else if (nonFlag.length >= 2) judge(nonFlag[1], { ci }); }
  if (/^(7z|7za|7zr)$/.test(prog)) for (const a of args) { const m = /^-o(.+)$/.exec(a); if (m) judge(m[1], { ci }); }
  if (/^(npm|pnpm|bun)$/.test(prog) && args.some(a => /^(i|in|install|add)$/.test(a)) && args.some(a => /^(-g|--global|--location=global)$/.test(a))) decide('ask', INSTALL_CODE);
  if (prog === 'yarn' && args[0] === 'global' && args[1] === 'add') decide('ask', INSTALL_CODE);

  // --- triển khai / dữ liệu thật ---
  // trình chạy gói: npx/bunx X, pnpm|yarn|bun dlx|exec|x X, npm exec|x X, pnpm|yarn X (chạy bin cục bộ). Bỏ hậu tố @phiên-bản.
  const bare = t => { const n = progName(t); return n.startsWith('@') ? n.replace(/^(@[^@]+)@.*$/, '$1') : n.replace(/@.*$/, ''); };
  let tool = prog, targs = args;
  {
    const from = /^(npx|bunx)$/.test(prog) ? 0 : ((/^(pnpm|yarn|bun)$/.test(prog) && /^(dlx|exec|x)$/.test(args[0] || '')) || (prog === 'npm' && /^(exec|x)$/.test(args[0] || ''))) ? 1 : -1;
    let k = -1;
    if (from >= 0) for (let i = from; i < args.length; i++) { if (/^(-p|--package|-c|--call)$/.test(args[i])) { i++; continue; } if (args[i] === '--' || args[i].startsWith('-')) continue; k = i; break; }
    else if (/^(pnpm|yarn)$/.test(prog) && /^(wrangler|vercel|netlify|firebase|supabase|gh-pages|surge)$/.test(bare(args[0] || ''))) k = 0;
    if (k >= 0) { tool = bare(args[k]); targs = args.slice(k + 1); }
  }
  if (tool !== prog && (/^add-skills?$/.test(tool) || (tool === 'skills' && /^(add|install|i|update|upgrade)$/.test(targs[0] || '')))) decide('ask', INSTALL_CODE);
  if (tool === 'wrangler') {
    // mặc định HỎI; chỉ cho qua lệnh chỉ đọc hoặc chạy trên máy (--local, dev)
    const w = targs.filter(a => !a.startsWith('-')), w0 = w[0] || '', w1 = w[1] || '', w2 = w[2] || '';
    const local = targs.includes('--local') && !targs.includes('--remote');
    const READ_ONLY = !w0 || /^(whoami|help|types|tail|dev|docs|check)$/.test(w0) ||
      (w0 === 'pages' && (w1 === 'dev' || (/^(deployment|project)$/.test(w1) && /^(list|tail)$/.test(w2)))) ||
      (/^(deployments|versions|secret)$/.test(w0) && /^(list|view|status)$/.test(w1)) ||
      (w0 === 'd1' && (/^(list|info)$/.test(w1) || (w1 === 'migrations' && w2 === 'list'))) ||
      (w0 === 'kv' && /^(namespace|key)$/.test(w1) && w2 === 'list') || (w0 === 'r2' && w1 === 'bucket' && w2 === 'list') ||
      (/^(d1|kv|r2)$/.test(w0) && local && w0 !== 'secret');
    const VERSION = targs.some(a => /^(-v|--version|-h|--help)$/.test(a)) && !w0;
    if (!READ_ONLY && !VERSION) {
      const deploy = /^(deploy|publish)$/.test(w0) || (w0 === 'pages' && w1 === 'deploy') || (w0 === 'versions' && /^(deploy|upload)$/.test(w1));
      decide('ask', deploy ? 'Triển khai lên Cloudflare: người dùng thật có thể thấy ngay. Cần chủ dự án đồng ý.'
        : (w0 === 'd1' && w1 === 'migrations' && w2 === 'apply') ? 'Áp migration lên cơ sở dữ liệu D1 trên máy chủ (dữ liệu thật). Chỉ chạy khi chủ dự án nói rõ «có»; thử trước bằng --local.'
        : `Lệnh wrangler «${w.slice(0, 3).join(' ')}» có thể sửa bí mật, dữ liệu hoặc cấu hình trên Cloudflare. Cần chủ dự án đồng ý.`);
    }
  }
  if (tool === 'vercel' && !targs.some(a => /^(--version|-v|ls|list|inspect|logs|whoami|help)$/.test(a))) decide('ask', 'Triển khai Vercel: cần chủ dự án đồng ý.');
  if ((tool === 'netlify' || tool === 'firebase') && targs.includes('deploy')) decide('ask', `Triển khai ${tool}: cần chủ dự án đồng ý.`);
  if (tool === 'gh-pages' || tool === 'surge') decide('ask', 'Triển khai lên web: cần chủ dự án đồng ý.');
  if (tool === 'supabase' && ((targs[0] === 'db' && /^(push|reset)$/.test(targs[1] || '')) || (targs[0] === 'migration' && /^(repair|squash)$/.test(targs[1] || '')))) decide('ask', 'Thay đổi cơ sở dữ liệu Supabase (có thể mất dữ liệu thật).');
  if (/^(psql|sqlite3|mysql|supabase|wrangler|turso)$/.test(tool) && /\b(drop\s+table|truncate\s+table|delete\s+from)\b/i.test(targs.join(' '))) decide('ask', 'Lệnh SQL xóa dữ liệu.');
  if ((RUNNERS.has(prog) && nonFlag.some(a => DEPLOY_WORD.test(a) || DEPLOY_SCRIPT.test(a))) || DEPLOY_SCRIPT.test(prog))
    decide('ask', 'Lệnh triển khai/phát hành (deploy/publish/release). Chỉ chạy khi chủ dự án nói rõ «có» cho lần này.');
  for (const sc of shipCmds) if (sc.words && coreWords(S).toLowerCase().startsWith(sc.words.toLowerCase()) && coreWords(S).length - sc.words.length < 40)
    decide('ask', sc.k === 'deployCmd' ? 'Đây là lệnh đưa lên TRANG THẬT của dự án (ship.deployCmd). Chỉ chạy khi chủ dự án nói rõ «yes» cho lần này.' : 'Đây là lệnh đăng bản xem trước (ship.previewCmd). Chỉ chạy khi chủ dự án đồng ý.');

  // --- in bí mật ra chat ---
  if (/^(cat|type|gc|get-content|more|less|head|tail|bat)$/.test(prog) && nonFlag.some(a => /(^|[\\/])\.(env([.\w-]*)?|dev\.vars)$/i.test(a) && !/\.(example|sample|template|dist|defaults?)$/i.test(a))) decide('ask', 'Lệnh in tệp bí mật (.env/.dev.vars) ra chat. Không in token/khóa.');
  if (/^(echo|printf|write-output|write-host)$/.test(prog) && args.some(a => /\$(env:)?\{?\w*(token|secret|key|password|passwd|api)\w*/i.test(a))) decide('ask', 'Lệnh in biến có thể chứa bí mật ra chat.');
  if (/^(printenv|env|set)$/.test(prog) && !args.length && !S.piped) decide('ask', 'Lệnh in toàn bộ biến môi trường (có thể lộ token) ra chat.');
  if (/^(gci|dir|get-childitem|ls)$/.test(prog) && args.some(a => /^env:/i.test(a)) && !S.piped) decide('ask', 'Lệnh in biến môi trường (có thể lộ token) ra chat.');

  // --- công cụ ghi/xóa đã biết ---
  if (['rm', 'rmdir', 'del', 'erase', 'rd', 'ri', 'remove-item'].includes(prog)) {
    const recursive = args.some(a => /^-[a-zA-Z]*[rR][a-zA-Z]*$/.test(a) && !/^-(path|literalpath)$/i.test(a) || a === '--recursive' || RREC.test(a) || /^\/s$/i.test(a)) || (prog === 'rmdir' && args.some(a => /^\/s$/i.test(a)));
    const tg = nonFlag.concat(['-path', '-literalpath'].map(n => named(new RegExp(`^${n}$`, 'i'))).filter(Boolean));
    if (recursive) recursiveDelete(S, tg); else tg.forEach(a => judge(a, { ci }));
    return;
  }
  if (['unlink', 'truncate', 'shred', 'chmod', 'chown', 'touch', 'ln', 'mklink', 'tee', 'tee-object', 'clear-content', 'clc', 'new-item', 'ni', 'icacls', 'attrib', 'set-content', 'sc', 'add-content', 'ac', 'out-file', 'export-csv', 'set-itemproperty'].includes(prog)) {
    nonFlag.forEach(a => judge(a, { ci }));
    ['path', 'literalpath', 'filepath'].forEach(n => { const v = named(new RegExp(`^-${n}$`, 'i')); if (v) judge(v, { ci }); });
    return;
  }
  if (['mkdir', 'md'].includes(prog)) { nonFlag.forEach(a => judge(a, { soft: true, ci })); return; } // tạo thư mục không hại; chỉ cảnh báo thư mục của kit
  if (['cp', 'mv', 'rsync', 'install', 'scp', 'copy', 'move', 'xcopy', 'robocopy', 'copy-item', 'cpi', 'move-item', 'mi', 'rename-item', 'rni', 'ren', 'rename'].includes(prog)) {
    const t = named(/^(-t|--target-directory)$/) || named(/^-(destination|newname)$/i);
    if (t) judge(t, { ci }); else if (nonFlag.length) judge(nonFlag.at(-1), { ci });
    for (const a of args) { const m = /^--target-directory=(.+)$/.exec(a); if (m) judge(m[1], { ci }); }
    if (/^(mv|move|move-item|mi|rename-item|rni|ren|rename|robocopy)$/.test(prog)) nonFlag.forEach(a => judge(a, { ci }));
    return;
  }
  if (/^(sed|perl|ruby)$/.test(prog)) { if (args.some(x => /^-[a-zA-Z]*i/.test(x) || /^--in-place/.test(x))) nonFlag.slice(1).forEach(a => judge(a, { ci })); return; }
  if (prog === 'find') { if (args.some(x => /^-(delete|exec|execdir|ok|okdir|fprint\S*|fls)$/.test(x))) nonFlag.forEach(a => judge(a, { ci })); return; }
  if (prog === 'dd') { args.forEach(a => { const m = /^of=(.+)$/.exec(a); if (m) judge(m[1], { ci }); }); return; }
  if (READONLY.has(prog)) return;

  // --- chương trình lạ: cờ ghi ra tệp là đích thật; tham số khác chỉ là "nhắc tới" ---
  // node -e chỉ ĐỌC (không có lệnh ghi, chạy tiến trình, nạp mã động): đoạn mã nhắc tới kit/config không cần hỏi. Sổ thì vẫn hỏi.
  const INLINE_FLAG = /^(-e|--eval|-p|--print|-pe)$/;
  const INLINE_LEDGER = /\.mission[\\/]+(ledger\.jsonl|gates\.json|manifest\.json|state)/i;
  const INLINE_WRITES = /\b(write|append|create|rm|rmdir|unlink|rename|copy|cp|mkdir|mkdtemp|truncate|chmod|chown|symlink|link|utimes|open)\w*\s*\(|child_process|\bspawn|\bexec|\beval\b|\bFunction\s*\(|\bimport\s*\(|require\s*\(\s*[^'"`\s]|process\.binding|\.write\s*\(|\[[^\]]*['"`+][^\]]*\]/i;
  const inlineRead = prog === 'node' ? args.findIndex((a, i) => i > 0 && INLINE_FLAG.test(args[i - 1]) && !INLINE_WRITES.test(a) && !INLINE_LEDGER.test(a)) : -1;
  args.forEach((a, i) => {
    if (i === inlineRead) return;
    if (/^(curl|wget)$/.test(prog) && /^-[a-zA-Z]*[oO]$/.test(args[i - 1] || '')) return judge(a, { ci });
    if (/^(-o|-O|--output|-outfile|--out-file|--outfile|--out|-out|--output-dir|--output-document|-d|--dest|--outdir|--out-dir|--target)$/i.test(args[i - 1] || '')) judge(a, { ci });
    else if (/^--(output|output-document|out-file|outfile|out|outdir|out-dir|output-dir|dest|target)=/i.test(a)) judge(a, { ci });
    else if (!/^-[\w-]+$/.test(a)) judge(a, { soft: true, ci });
  });
  if (args.some((a, i) => i !== inlineRead && SENS_TEXT.test(a))) decide('ask', `Lệnh «${prog}» nhắc tới sổ/tệp kit (.mission/ledger|gates|manifest|state hoặc .claude/mission-kit). Sổ chỉ ghi qua CLI mission.mjs — đồng ý nếu lệnh chỉ ĐỌC.`);
}
{ let tracked = null;
  for (const S of segs) {
    if (CD.test(S.prog) || POPD.test(S.prog)) { cwd = cwd0; for (const r of S.redirs) judge(r.target, { ci: S.mode !== 'bash' }); tracked = trackCd(tracked, S); continue; }
    cwd = cwd0; checkSeg(S);
    if (tracked && tracked !== cwd0) { cwd = tracked; checkSeg(S); }
  }
  cwd = cwd0; }

// ---------- đọc tệp bí mật / thư mục riêng, quét rộng, gửi sang thư mục trao đổi ----------
const looksPath = a => /[\\/~]|^\.[\w-]|^[a-zA-Z]:|\.[a-z0-9]{1,5}$/i.test(a) && !/^[a-z+.-]+:\/\//i.test(a);
const COPYISH = /^(cp|copy|copy-item|cpi|xcopy|robocopy|mv|move|move-item|mi|rsync|scp|install)$/;
const WIDE_PROG = /^(find|rg|grep|egrep|ag|ls|dir|gci|get-childitem|tree|du|findstr|select-string|sls|where)$/;
const ENV_FLAG = /^--?(env-file|env|env-path|dotenv)$/i;
const lockG = lockedGlobs(cfg);
function dataSeg(S, wd) {
  curMode = S.mode || 'bash';
  const vals = [];
  for (let i = 0; i < S.args.length; i++) {
    const a = S.args[i];
    if (ENV_FLAG.test(a)) { i++; continue; }                     // node --env-file .env, wrangler dev --env-file .dev.vars: app tự nạp, không in ra
    if (/^--?(env-file|env|env-path|dotenv)=/i.test(a)) continue;
    const m = /^-{1,2}[\w-]+[=:](.+)$/.exec(a); const v = m ? m[1] : a;
    if (/^-/.test(v) || (S.mode === 'cmd' && /^\/\w$/.test(v))) continue;
    vals.push(v);
  }
  const ex = a => np(expandVars(String(a)));
  const paths = vals.map(ex).filter(a => a && !isVar(a) && looksPath(a));
  // 1) đọc tệp bí mật / thư mục riêng (bash: luôn "hỏi" vì hook đọc lệnh gần đúng). Tên tệp trần (cfg.key) chỉ tính khi tệp có thật.
  // lệnh chỉ xem thông tin tệp (không in nội dung) và đích chép của cp → không tính là đọc
  const INFO = /^(ls|ll|dir|stat|test|\[|touch|file|du|wc|test-path|get-item|gi|mkdir|md|echo|printf|write-output|write-host|code|explorer|start)$/;
  const gitNoIndex = S.prog === 'git' && /^(diff|grep)$/.test(S.args.find(a => !a.startsWith('-')) || '') && S.args.includes('--no-index');
  if ((S.prog !== 'git' || gitNoIndex) && !INFO.test(S.prog)) {
    const readArgs = COPYISH.test(S.prog) && paths.length > 1 ? paths.slice(0, -1) : paths;
    for (const a of readArgs) {
      if (/[*?]/.test(a)) { // mẫu: mở rộng trong thư mục rồi xét từng tệp; mẫu nhắm tệp bí mật thì hỏi luôn
        const dir = resolve(wd, a.replace(/[^\\/]*[*?].*$/, '') || '.'), last = a.split(/[\\/]/).pop();
        if (/^\.?(env|dev\.vars|ops\.vars)/i.test(last.replace(/^\*+/, '')) && !/\.(example|sample|template)$/i.test(last)) { decide('ask', 'Lệnh đọc tệp bí mật qua mẫu (vd. .env*). Không in token/khóa.'); continue; }
        let ents = []; try { ents = readdirSync(dir); } catch {}
        const re = new RegExp('^' + last.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        for (const e of ents) if (re.test(e)) { const k = readKind(root, cfg, wd, resolve(dir, e)); if (k) { decide('ask', k.reason); break; } }
        const k = readKind(root, cfg, wd, dir); if (k) decide('ask', k.reason);
        continue;
      }
      if (!/[\\/~]/.test(a) && !existsSync(resolve(wd, a))) continue;
      const k = readKind(root, cfg, wd, a); if (k) decide('ask', k.reason);
    }
  }
  // npm/pnpm/yarn run <script>: đọc câu lệnh thật trong package.json
  if (/^(npm|pnpm|yarn|bun)$/.test(S.prog)) {
    const i0 = S.args.findIndex(a => !a.startsWith('-')); const name = /^(run|run-script)$/.test(S.args[i0] || '') ? S.args[i0 + 1] : (S.prog === 'yarn' ? S.args[i0] : null);
    if (name) { try { const pj = JSON.parse(readFileSync(resolve(wd, 'package.json'), 'utf8')); const sc = pj.scripts?.[name];
      if (sc && /--remote\b|migrations?\s+apply|db\s+(push|reset)|\bdeploy\b|\bpublish\b|wrangler\s+(d1|kv|r2|secret)\b/i.test(sc) && !/--local\b/.test(sc))
        decide('ask', `Script «${name}» trong package.json chạy lệnh đụng máy chủ thật (triển khai / cơ sở dữ liệu từ xa). Chỉ chạy khi chủ dự án nói rõ «có».`); } catch {} }
  }
  for (const t of S.inputs || []) { const k = readKind(root, cfg, wd, ex(t)); if (k) decide('ask', k.reason); }
  if ((S.prog === '.' || S.prog === 'source') && vals[0]) { const k = readKind(root, cfg, wd, ex(vals[0])); if (k) decide('ask', k.reason); }
  if (/^\.(env|envrc|dev\.vars|ops\.vars)\b/i.test(S.prog)) { const k = readKind(root, cfg, wd, S.prog); if (k) decide('ask', k.reason + ' (nạp bằng «.»/source cũng in được giá trị qua lệnh sau)'); }
  // 2) quét rộng từ gốc ổ đĩa / thư mục nhà
  if (WIDE_PROG.test(S.prog) && (vals.some(a => isWideRoot(wd, ex(a))) || (!vals.filter(looksPath).length && isWideRoot(wd, '.'))))
    decide('ask', 'Lệnh tìm/liệt kê trên cả ổ đĩa hoặc cả thư mục nhà — dễ đụng tài liệu riêng. Thu hẹp vào thư mục cần tìm, hoặc để chủ dự án đồng ý.');
  // 3) sửa tại chỗ tệp có chuỗi khóa
  if (lockG.length && /^(sed|perl|ruby)$/.test(S.prog) && S.args.some(x => /^-[a-zA-Z]*i/.test(x) || /^--in-place/.test(x)) &&
      paths.some(a => { const r = relative(root, resolve(wd, a)).split(sep).join('/'); return matchAny(r, lockG); }))
    decide('ask', 'Sửa tại chỗ (sed/perl -i) một tệp có chuỗi bị khóa (protect.lockedText) — hook không kiểm được chuỗi khóa còn nguyên. Dùng công cụ Edit.');
  // 4) gửi sang thư mục trao đổi (handoff.exchangeDir): kiểm từng tệp nguồn; không kiểm được thì hỏi
  const inEx = a => inExchange(cfg, wd, ex(a), root);
  const outRedirs = S.redirs.filter(r => /^>|^\d?>/.test(r.op));
  const toEx = [...vals, ...outRedirs.map(r => r.target)].some(inEx);
  if (toEx) {
    if (COPYISH.test(S.prog)) {
      const srcs = vals.filter(a => !inEx(a));
      if (!srcs.length) decide('ask', 'Lệnh chép/đổi tên trong thư mục trao đổi — xem lại trước khi gửi ra ngoài.');
      for (const a0 of srcs) {
        const a = ex(a0), f = resolve(wd, a.replace(/^["']|["']$/g, ''));
        let st = null; try { st = existsSync(f) ? statSync(f) : null; } catch {}
        if (!st || isVar(a) || /[*?[{]/.test(a)) { decide('ask', `Gửi «${a0}» sang thư mục trao đổi — hook không kiểm được nội dung (mẫu/biến/không thấy tệp). Chép từng tệp cụ thể.`); continue; }
        if (st.isDirectory()) { decide('ask', `Gửi cả thư mục «${a0}» sang thư mục trao đổi — chép từng tệp đã kiểm.`); continue; }
        let text = null; try { if (st.size < (8 << 20)) text = readFileSync(f, 'utf8'); } catch {}
        const why = exchangeContentIssue(root, cfg, a, text); if (why) decide('deny', why);
      }
    } else if (!READONLY.has(S.prog) || outRedirs.some(r => inEx(r.target)))
      decide('ask', 'Lệnh ghi vào thư mục trao đổi bằng cách hook không kiểm được nội dung. Dùng công cụ Write (được kiểm che thông tin) hoặc cp từng tệp.');
  }
}
{ let tracked = null;
  for (const S of segs) {
    if (CD.test(S.prog)) { const t = S.args.find(a => !a.startsWith('-')); if (t) {
      const x = nativePath(expandVars(t));
      if (/[*?]/.test(x)) { const base = tracked || nativePath(cwd0), dir = resolve(base, x.replace(/[^\\/]*[*?].*$/, '') || '.'), last = x.replace(/[\\/]+$/, '').split(/[\\/]/).pop();
        const re = new RegExp('^' + last.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$', 'i');
        let ents = []; try { ents = readdirSync(dir); } catch {}
        for (const e of ents) if (re.test(e)) { const k = readKind(root, cfg, base, resolve(dir, e)); if (k) { decide('ask', k.reason); break; } } }
      const k = readKind(root, cfg, tracked || nativePath(cwd0), x); if (k) decide('ask', k.reason); } }
    if ((CD.test(S.prog) || POPD.test(S.prog)) && S.redirs.some(r => inExchange(cfg, nativePath(cwd0), nativePath(expandVars(String(r.target))), root)))
      decide('ask', 'Lệnh ghi vào thư mục trao đổi bằng cách hook không kiểm được nội dung. Dùng công cụ Write hoặc cp từng tệp.');
    if (CD.test(S.prog) || POPD.test(S.prog)) { tracked = trackCd(tracked, S); continue; }
    if (!S.prog || S.wrapper) continue;
    dataSeg(S, nativePath(cwd0));
    if (tracked && tracked !== cwd0) dataSeg(S, nativePath(tracked));
  } }

if (best && best.kind !== 'allow') {
  const kind = best.kind;
  hookLog(root, 'guard-bash', `${kind}: ${cmd.slice(0, 200)}`, reasons[kind].join(' | '));
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: kind, permissionDecisionReason: reasons[kind].join(' | ') } });
}
process.exit(0);
