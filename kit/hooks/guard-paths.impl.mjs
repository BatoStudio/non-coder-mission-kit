#!/usr/bin/env node
// PreToolUse (Edit|Write|MultiEdit|NotebookEdit): chặn sửa tệp được bảo vệ.
//  - sổ .mission (ledger, gates, manifest, state/) và tệp của chính kit (.claude/mission-kit/**) -> từ chối
//  - protect.deny  -> từ chối hẳn (vd. dự án mẫu, tài liệu tham chiếu, dữ liệu gốc)
//  - .mission/config.json, .claude/settings*.json, protect.ask -> hỏi người dùng
//  - config.json hỏng -> hỏi (không âm thầm tắt bảo vệ)
//  - protect.lockedText -> từ chối lần sửa đụng vào dòng bị khóa (tệp vẫn sửa được phần khác)
//  - handoff: tệp kết luận của người soát bên ngoài chỉ ghi một lần; nội dung ghi vào thư mục trao đổi phải qua kiểm che thông tin
// Xét cả đường dẫn thật (symlink/junction) và bỏ đuôi luồng NTFS (::$DATA).
import { readStdin, findRoot, loadConfigSafe, out, hookLog } from '../lib.mjs';
import { pathKind } from '../guard-core.mjs';
import { lockedTextIssue, verdictIssue, inExchange, exchangeContentIssue, expandHome, nativePath } from '../data-core.mjs';
import { resolve, relative, sep, basename } from 'node:path';

import { deferToOtherKit } from '../lib.mjs';
if (deferToOtherKit()) process.exit(0); // bản kit khác ($MISSION_KIT) đang lo việc này
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) process.exit(0);
const ti = input.tool_input || {};
const file = ti.file_path || ti.notebook_path || ti.path;
if (!file) process.exit(0);

const { cfg, error } = loadConfigSafe(root);
const k = pathKind(root, cfg, input.cwd || root, file);
const decide = (kind, reason) => { hookLog(root, 'guard-paths', `${kind} ${file}`, reason); out({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: kind, permissionDecisionReason: reason } }); };
if (k?.kind === 'deny') decide('deny', k.reason);
{ // dòng khóa, tệp kết luận, thư mục trao đổi
  const cwd = nativePath(input.cwd || root), abs = resolve(cwd, expandHome(String(file).replace(/^["']|["']$/g, '')));
  const rel = relative(root, abs).split(sep).join('/');
  const tool = input.tool_name || (ti.content !== undefined ? 'Write' : 'Edit');
  const inside = !(rel.startsWith('..') || /^[a-zA-Z]:/.test(rel));
  const lk = inside && lockedTextIssue(root, cfg, rel, tool, ti); if (lk) decide('deny', lk);
  const vd = verdictIssue(root, cfg, rel, abs, tool, ti); if (vd) decide('deny', vd);
  if (inExchange(cfg, cwd, file, root)) {
    const text = tool === 'Write' ? ti.content : Array.isArray(ti.edits) ? ti.edits.map(e => e.new_string ?? '').join('\n') : (ti.new_string ?? ti.new_source ?? '');
    const ex = exchangeContentIssue(root, cfg, basename(abs), text); if (ex) decide('deny', ex);
  }
}
if (error) { if (/[\\/]\.mission[\\/]config\.json$|^\.mission[\\/]config\.json$/i.test(String(file))) process.exit(0); decide('ask', error); }
if (k) decide(k.kind, k.reason);
process.exit(0);
