// Lớp bọc của guard-bash, guard-paths, guard-read: hook gặp lỗi bên trong thì trả về HỎI và ghi hooks.log.
// Không có lớp này, hook đổ vỡ (exit 1) bị Claude Code coi là lỗi không chặn và thao tác chạy mà không qua kiểm tra.
// Tệp này không import gì của kit, để vẫn chạy được khi lib.mjs hay guard-core.mjs hỏng hoặc thiếu.
import { appendFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';

function missionRoot() {
  const env = process.env.CLAUDE_PROJECT_DIR;
  if (env && existsSync(join(env, '.mission'))) return env;
  for (let d = process.cwd(), up; ; d = up) {
    if (existsSync(join(d, '.mission'))) return d;
    up = dirname(d);
    if (up === d) return null;
  }
}

function logCrash(name, text) {
  try {
    const root = missionRoot();
    if (root) appendFileSync(join(root, '.mission', 'state', 'hooks.log.jsonl'),
      JSON.stringify({ t: new Date().toISOString(), event: name, msg: `ask lỗi bên trong: ${text}`, tag: 'lỗi hook' }) + '\n');
  } catch {} // không ghi được log thì vẫn phải hỏi
}

export async function runGuarded(name, load) {
  try {
    await load();
  } catch (e) {
    const first = String(e?.message || e).split('\n')[0].slice(0, 200);
    const where = /[\w.-]+\.mjs:\d+/.exec(String(e?.stack || ''))?.[0] || '';
    logCrash(name, `${first}${where ? ` (${where})` : ''}`);
    const reason = `Hook ${name} gặp lỗi bên trong (${first}), nên chưa kiểm tra được thao tác này. Cần người dùng xem trước khi cho chạy.`;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
    process.exit(0);
  }
}
