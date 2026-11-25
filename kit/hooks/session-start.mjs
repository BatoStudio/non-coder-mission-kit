#!/usr/bin/env node
// SessionStart: nạp tình trạng thật của nhiệm vụ + ngữ cảnh gọn (HANDOVER, HTC, sổ active) vào ngữ cảnh.
// Có trần độ dài để phiên mới không phải đọc lại cả repo. Chạy cả sau khi nén (source=compact).
import { readStdin, findRoot, loadConfigSafe, gitInfo, out } from '../lib.mjs';
import { statusLines } from '../status-core.mjs';
import { handoverLines } from '../handover-core.mjs';
import { watchImportant } from '../important-core.mjs';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve, join } from 'node:path';

import { deferToOtherKit } from '../lib.mjs';
if (deferToOtherKit()) process.exit(0); // bản kit khác ($MISSION_KIT) đang lo việc này
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) {
  // kit đã cài nhưng app chưa khởi tạo: nói rõ kit ở đâu để Claude khỏi đi tìm
  if (process.env.MISSION_KIT) out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'Mission Kit đã cài, app chưa khởi tạo (.mission/ chưa có). CLI: node "$MISSION_KIT/mission.mjs" (biến đã có sẵn, không cần đi tìm kit). Bắt đầu bằng /mission-init.' } });
  process.exit(0);
}
const { cfg, error } = loadConfigSafe(root);
if (error) out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `Mission Kit: ${error}` } });
let lines;
try { lines = [`# Mission Kit — ${cfg.name}`, ...statusLines(root, cfg, { short: true })]; }
catch (e) { lines = [`# Mission Kit — ${cfg.name}`, `(không đọc được trạng thái: ${e.message})`]; }
const g = gitInfo(root);
if (cfg.git.mode === 'branch-pr' && g.isRepo && cfg.protectedBranches.includes(g.branch))
  lines.push(`⚠ Chế độ branch-pr, đang ở «${g.branch}». Trước khi sửa: git switch -c ${cfg.workBranchPrefix}<tên-việc>`);
const skills = Object.entries(cfg.appSkills || {}).filter(([, v]) => v);
if (skills.length) lines.push('Ưu tiên skill riêng của app: ' + skills.map(([k, v]) => `${k} → ${v}`).join(' · '));
try { lines.push(...handoverLines(root, cfg, input.source || 'startup')); }
catch (e) { lines.push(`(không nạp được ngữ cảnh gọn: ${e.message})`); }
// LỖI 11: so số tệp các thư mục quan trọng với phiên trước; trống/giảm >20% → cảnh báo (không chặn phiên)
try { const w = watchImportant(root, cfg); if (w.length) lines.unshift(...w, ''); }
catch (e) { lines.push(`(không kiểm được thư mục quan trọng: ${e.message})`); }
// Advisor (cố vấn Fable): không thấy advisorModel ở app/máy thì nhắc 1 dòng
try {
  const has = f => { try { return !!JSON.parse(readFileSync(f, 'utf8').replace(/^﻿/, '')).advisorModel; } catch { return false; } };
  const cdir = process.env.CLAUDE_CONFIG_DIR || join(homedir(), '.claude');
  if (![resolve(root, '.claude', 'settings.json'), resolve(root, '.claude', 'settings.local.json'), resolve(cdir, 'settings.json')].some(has))
    lines.push('ℹ Chưa bật advisor (không thấy advisorModel): gõ /advisor fable để có cố vấn Fable cho lỗi khó và việc lớn.');
} catch {}
// Quyền tự quyết: một nguồn duy nhất là mục «Tự quyết và khi nào hỏi» trong templates/QUY-TRINH.md
try {
  const qt = readFileSync(new URL('../templates/QUY-TRINH.md', import.meta.url), 'utf8');
  const sec = qt.match(/^## Tự quyết và khi nào hỏi\r?\n([\s\S]*?)(?=^## )/m);
  if (sec) lines.push('', '## Tự quyết và khi nào hỏi (chủ dự án cho phép thường trực)', sec[1].trim());
} catch {}
lines.push('', 'Quy trình: skill «mission-run». CLI: node "$MISSION_KIT/mission.mjs" <status|ledger|gate|check|report|done>.');
out({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: lines.join('\n') } });
