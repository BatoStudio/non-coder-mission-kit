#!/usr/bin/env node
// Stop: khi Claude định kết thúc lượt mà vùng theo dõi đã đổi sau lần kiểm tra đầy đủ gần nhất.
//   stopGate.mode = "remind" (mặc định) — chỉ hiện lời nhắc cho người dùng, KHÔNG chặn (tiết kiệm token)
//   stopGate.mode = "block"            — chặn một lần mỗi lượt, yêu cầu chạy lại kiểm tra
// Bước kiểm tra đỏ đã được ghi ledger (blocker/attention, loc "check:<tên>") thì không tính là vấn đề.
import { createHash } from 'node:crypto';
import { readStdin, findRoot, loadConfigSafe, readJson, readJsonl, writeJson, mpath, mtime, out, hookLog } from '../lib.mjs';
import { checkFreshness, acknowledgedFailures } from '../check-core.mjs';

import { deferToOtherKit } from '../lib.mjs';
if (deferToOtherKit()) process.exit(0); // bản kit khác ($MISSION_KIT) đang lo việc này
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) process.exit(0);
const { cfg, error } = loadConfigSafe(root);
if (error) out({ systemMessage: error });
if (!cfg.stopGate.enabled || input.stop_hook_active || !cfg.checks.full.length) process.exit(0);

const f = checkFreshness(root, cfg);
if (!f.dirtyWatched.length && f.fresh) process.exit(0);
const ledger = readJsonl(mpath(root, 'ledger.jsonl'));
const problems = [];
if (!f.fresh && (f.dirtyWatched.length || f.touched?.length)) problems.push(`Kiểm tra đầy đủ đã cũ (${f.why}) → node "$MISSION_KIT/mission.mjs" check --full`);
else if (f.lc && !f.lc.ok) { const a = acknowledgedFailures(f.lc, ledger); if (!a.all) problems.push(`Kiểm tra đầy đủ đang ĐỎ ở: ${a.missing.join(', ')} — sửa, hoặc ghi ledger --category blocker --loc "check:<tên bước>"`); }
const hasRecords = ledger.length > 0 || Object.keys(readJson(mpath(root, 'gates.json'), {})).length > 0;
if (hasRecords && Math.max(mtime(mpath(root, 'ledger.jsonl')), mtime(mpath(root, 'gates.json'))) > mtime(mpath(root, 'progress.md')))
  problems.push('Báo cáo tiến độ chưa cập nhật → node "$MISSION_KIT/mission.mjs" report');
if (!problems.length) process.exit(0);

if (cfg.stopGate.mode === 'block') {
  hookLog(root, 'stop-gate', `block: ${problems.join(' | ')}`);
  out({ decision: 'block', reason: `Trước khi dừng:\n- ${problems.join('\n- ')}` });
}
// remind: chỉ nhắc lại khi danh sách tệp cũ / vấn đề đã đổi, hoặc đã quá 30 phút
const REMIND_EVERY_MS = 30 * 60e3;
const fp = createHash('sha1').update(JSON.stringify([[...(f.touched || [])].sort(), [...f.dirtyWatched].sort(), problems])).digest('hex');
const statePath = mpath(root, 'state', 'stop-gate.json');
const last = readJson(statePath, null);
if (last?.fp === fp && Date.now() - last.t < REMIND_EVERY_MS) process.exit(0);
writeJson(statePath, { fp, t: Date.now() });
hookLog(root, 'stop-gate', `remind: ${problems.join(' | ')}`);
out({ systemMessage: `Mission Kit nhắc: ${problems.join(' · ')}` });
