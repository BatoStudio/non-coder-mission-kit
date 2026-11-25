#!/usr/bin/env node
// PreCompact: trước khi ngữ cảnh bị nén, máy tự chụp tình trạng thật (git, NOW, ledger mở) vào
// .mission/state/auto-handover.md. Sau khi nén, SessionStart(compact) nạp lại ảnh chụp này cùng HANDOVER,
// nên việc đang dở không mất dù Claude chưa kịp ghi HANDOVER.
import { readStdin, findRoot, loadConfigSafe, hookLog, deferToOtherKit } from '../lib.mjs';
import { writeAutoSnapshot } from '../handover-core.mjs';

if (deferToOtherKit()) process.exit(0);
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) process.exit(0);
const { cfg } = loadConfigSafe(root);
try { writeAutoSnapshot(root, cfg, input.trigger || 'auto'); hookLog(root, 'pre-compact', `snapshot ${input.trigger || 'auto'}`); }
catch (e) { hookLog(root, 'pre-compact', 'lỗi: ' + e.message); }
process.exit(0);
