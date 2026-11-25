#!/usr/bin/env node
// PostToolUse (Edit|Write|MultiEdit): kiểm tra nhanh đúng tệp vừa sửa.
//  - lint.rules (regex, chạy ngay trong hook)
//  - checks.onEdit: lệnh ngoài, {file} = đường dẫn tương đối (đã bọc nháy kép)
//  - privacy.clientCode: mã có thể tới trình duyệt mà nhắc dữ liệu mật → chặn để Claude chuyển sang phía máy chủ
//  - checks.remind: sửa tệp nào thì NHẮC chạy kiểm tra nào (không chạy — dành cho test chậm như Revit)
//  - tidy.onEdit (mặc định bật): cảnh báo tên trùng / hàm đã có ở tệp khác / khối lặp dính tới tệp vừa sửa; nhắc ghi tệp mới vào LT.md
// Lỗi -> "block" để Claude sửa ngay. Cảnh báo -> thêm vào ngữ cảnh.
// Nếu app đã có hook build/kiểm tra riêng, ĐỪNG khai lại lệnh đó ở checks.onEdit (tránh chạy hai lần).
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { readStdin, findRoot, loadConfigSafe, toRel, matchAny, out, writeJson, mpath, nowIso, hookLog, runCmd, lsFiles, git } from '../lib.mjs';
import { tidyConfig, tidyFiles, editIssues, ltMentions } from '../tidy-core.mjs';
import { lintText } from '../lint-core.mjs';
import { clientCodeIssue } from '../data-core.mjs';
import { isOutside } from '../lib.mjs';

import { deferToOtherKit } from '../lib.mjs';
if (deferToOtherKit()) process.exit(0); // bản kit khác ($MISSION_KIT) đang lo việc này
const input = await readStdin();
const root = findRoot(input.cwd);
if (!root) process.exit(0);
const { cfg, error } = loadConfigSafe(root);
if (error) out({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: error } });
const file = input.tool_input?.file_path || input.tool_input?.notebook_path;
if (!file) process.exit(0);
const rel = toRel(root, file);
if (isOutside(rel) || rel.toLowerCase().startsWith('.mission/')) process.exit(0);

writeJson(mpath(root, 'state', 'last-edit.json'), { t: nowIso(), file: rel });

const errors = [], warnings = [], reminders = [];
try {
  const text = readFileSync(resolve(root, rel), 'utf8');
  for (const f of lintText(rel, text, cfg.lint.rules)) (f.severity === 'error' ? errors : warnings).push(`${rel}:${f.line} ${f.message}  «${f.excerpt}»`);
  const cc = clientCodeIssue(cfg, rel, text); if (cc) errors.push(cc);
} catch {}
// Giữ mã gọn ngay từ đầu (thay vì đợi /mission-tidy): tên trùng, «đã có ở tệp khác», khối lặp, tệp mới chưa có trong bản đồ LT.md.
// Chỉ CẢNH BÁO. Tắt bằng config tidy.onEdit = false.
try {
  const t = tidyConfig(cfg);
  if (t.onEdit !== false && tidyFiles([rel], t).length) {
    const files = [];
    for (const f of tidyFiles(lsFiles(root, { others: true }), t)) { try { files.push({ path: f, text: readFileSync(resolve(root, f), 'utf8') }); } catch {} }
    const { conflicts, elsewhere, dups } = editIssues(files, t, rel);
    const at = p => `${p.path}:${p.line}`;
    for (const c of conflicts.slice(0, 5)) warnings.push(`Tên trùng «${c.name}» (bản nạp sau đè bản trước): ${c.places.map(at).join(' · ')} — giữ MỘT bản, xóa/đổi tên bản kia`);
    for (const e of elsewhere.slice(0, 5)) warnings.push(`«${e.name}» (${rel}:${e.line}) đã có ở ${e.places.map(at).join(' · ')} — dùng lại bản đó (chuyển sang thư mục dùng chung nếu cần) thay vì viết bản thứ hai; nếu khác việc thật thì đổi tên cho rõ`);
    for (const b of dups.slice(0, 3)) warnings.push(`Khối lặp ${b.size} dòng: ${b.places.map(p => `${p.path}:${p.line}-${p.endLine}`).join(' · ')} — gộp thành một hàm dùng chung`);
    const ltp = mpath(root, 'LT.md');
    if (existsSync(ltp) && !git(root, ['ls-files', '--', rel]) && !ltMentions(readFileSync(ltp, 'utf8'), rel))
      reminders.push(`Tệp mới ${rel} chưa có trong bản đồ .mission/LT.md — thêm 1 dòng ở mục «Tính năng» (bản tiếng Anh: «Features»): <tính năng> — <thư mục/tệp> — <hàm/khái niệm nó sở hữu>`);
  }
} catch {}
for (const r of cfg.checks.remind) {
  if (!r || !r.glob || !matchAny(rel, [].concat(r.glob))) continue;
  reminders.push(`${r.name ? r.name + ': ' : ''}${r.message || ('chạy ' + (r.cmd || 'kiểm tra tương ứng'))}${r.skill ? ` (xem skill ${r.skill})` : ''}`);
}

for (const c of cfg.checks.onEdit) {
  if (!matchAny(rel, [].concat(c.glob))) continue;
  const r = runCmd(root, c.cmd, { file: rel, timeout: c.timeout || 60 });
  const tail = r.out.trim().split('\n').slice(r.ok ? -15 : -25).join('\n');
  if (r.ok) { if (c.warnOnOutput && tail) warnings.push(`[${c.name || c.cmd}] ${tail}`); }
  else (c.severity === 'warning' ? warnings : errors).push(`[${c.name || c.cmd}] thất bại (mã ${r.code}):\n${tail}`);
}

hookLog(root, 'post-edit', `${rel}: ${errors.length} lỗi, ${warnings.length} cảnh báo`);
const cap = a => a.slice(0, 30).join('\n') + (a.length > 30 ? `\n… và ${a.length - 30} mục nữa` : '');
const remindText = reminders.length ? `Đã sửa ${rel}. Khi xong phần sửa này và TRƯỚC khi báo xong, chạy:\n- ${[...new Set(reminders)].join('\n- ')}` : '';
if (errors.length)
  out({ decision: 'block', reason: `Kiểm tra sau khi sửa ${rel} phát hiện lỗi. Sửa trước khi làm tiếp:\n${cap(errors)}${warnings.length ? '\n\nCảnh báo:\n' + cap(warnings) : ''}${remindText ? '\n\n' + remindText : ''}` });
if (warnings.length || remindText)
  out({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: [warnings.length ? `Cảnh báo cho ${rel} (xem xét, sửa nếu đúng là lỗi):\n${cap(warnings)}` : '', remindText].filter(Boolean).join('\n\n') } });
process.exit(0);
