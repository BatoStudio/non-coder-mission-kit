#!/usr/bin/env node
// PreToolUse (Read|Grep|Glob|NotebookRead): chặn đọc tệp bí mật, hỏi trước khi đọc thư mục riêng của chủ dự án.
//  - tệp bí mật (.env, .dev.vars, khóa .pem/.key, id_rsa…) và thư mục khóa của máy (~/.ssh, ~/.wrangler…) → từ chối
//  - readGuard.extraSecrets (glob trong app, vd. "reference/**", "**/*Payroll*") → từ chối
//  - thư mục riêng (Desktop, Documents, Dropbox, OneDrive… — readGuard.privateDirs) → hỏi
//  - tìm/liệt kê từ gốc ổ đĩa hoặc cả thư mục nhà → hỏi
// Lệnh shell (cat, Get-Content, find…) do guard-bash lo cùng luật này.
import { readStdin, findRoot, loadConfigSafe, out, hookLog, deferToOtherKit } from '../lib.mjs';
import { readKind, isWideRoot, cleanName } from '../data-core.mjs';

if (deferToOtherKit()) process.exit(0);
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) process.exit(0);
const { cfg } = loadConfigSafe(root); // config hỏng: vẫn dùng luật mặc định (an toàn hơn là tắt)
const ti = input.tool_input || {};
const cwd = input.cwd || root;
const tool = input.tool_name || '';
const cands = [ti.file_path, ti.notebook_path, ti.path].filter(Boolean);
// Glob: mẫu tuyệt đối (C:/Users/x/Desktop/**) cũng là đường dẫn
if (tool === 'Glob' && ti.pattern && /^([a-zA-Z]:|[\\/]|~|\.\.)/.test(ti.pattern)) cands.push(String(ti.pattern).replace(/[*?[{].*$/, '') || '/');
let best = null;
// Grep/Glob nhắm vào tệp bí mật qua tham số glob/mẫu (vd. glob ".env*") — app không bao giờ cần đọc nội dung chúng
for (const g of [tool === 'Grep' ? ti.glob : null, tool === 'Glob' ? ti.pattern : null].filter(Boolean)) {
  const last = cleanName(String(g).split(/[\\/]/).pop().replace(/[{}]/g, ''));
  if (/^\.env(?!\.(example|sample|template))|^\.dev\.vars|^\.ops\.vars|^id_(rsa|ed25519)|\.(pem|key|p12|pfx)\*?$|^\.?(git-)?credentials(\.json|\.\*)?\*?$/i.test(last.replace(/^\*+/, '')))
    best = { kind: 'deny', reason: 'Tìm trong tệp bí mật (.env, .dev.vars, khóa…). Không đọc nội dung; cần biết có biến nào thì đọc tệp mẫu (.env.example).' };
}
for (const p of cands) {
  const k = readKind(root, cfg, cwd, p);
  if (k && (!best || (k.kind === 'deny' && best.kind !== 'deny'))) best = k;
  if (!k && (tool === 'Grep' || tool === 'Glob') && isWideRoot(cwd, p))
    best ||= { kind: 'ask', reason: 'Tìm trên cả ổ đĩa hoặc cả thư mục nhà — dễ đụng tài liệu riêng. Thu hẹp vào thư mục cần tìm, hoặc để chủ dự án đồng ý.' };
}
if (best) {
  hookLog(root, 'guard-read', `${best.kind} ${tool} ${cands.join(' ')}`.slice(0, 200), best.reason);
  out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: best.kind, permissionDecisionReason: best.reason } });
}
process.exit(0);
