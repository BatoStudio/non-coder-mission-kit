// Bộ lint văn bản theo luật regex khai báo trong config.lint.rules.
// Mỗi luật: { id, glob, pattern, flags?, message, severity: "error"|"warning",
//             skipLinePattern?, maxSentenceLength?, includeCode? }
// - pattern: regex tìm chỗ sai (vd. khóa bí mật trong mã, console.log, TODO, giá trị cấm).
// - skipLinePattern: bỏ qua dòng khớp (vd. dòng "- Nguồn:" được phép chứa chữ Hán).
// - maxSentenceLength: thay cho pattern, báo câu dài hơn N ký tự.
// - Khối mã ``` chỉ được bỏ qua trong tệp .md (trong mã nguồn, dòng bắt đầu bằng ``` không tắt luật).
import { globToRegex } from './lib.mjs';

export function lintText(rel, text, rules = []) {
  const findings = [];
  const lines = text.split('\n');
  for (const r of rules) {
    if (r.glob && ![].concat(r.glob).some(g => globToRegex(g).test(rel))) continue;
    const skip = r.skipLinePattern ? new RegExp(r.skipLinePattern) : null;
    const re = r.pattern ? new RegExp(r.pattern, (r.flags || '').replace('g', '') + 'g') : null;
    let inFence = false;
    const md = /\.(md|markdown)$/i.test(rel);
    lines.forEach((line, i) => {
      if (md && /^\s*```/.test(line)) inFence = !inFence;
      if (inFence && !r.includeCode) return;
      if (skip && skip.test(line)) return;
      if (r.maxSentenceLength) {
        for (const s of line.split(/(?<=[.!?。！？])\s+/))
          if (s.length > r.maxSentenceLength) findings.push(f(r, i, s.slice(0, 60) + '…', `${r.message} (${s.length} ký tự)`));
        return;
      }
      if (!re) return;
      for (const m of line.matchAll(re)) {
        const a = Math.max(0, m.index - 20);
        findings.push(f(r, i, line.slice(a, m.index + m[0].length + 20), r.message));
        if (r.oncePerLine !== false) break;
      }
    });
  }
  return findings;
}
const f = (r, i, excerpt, message) => ({ id: r.id, line: i + 1, severity: r.severity || 'warning', message: `[${r.id}] ${message}`, excerpt: excerpt.trim() });
