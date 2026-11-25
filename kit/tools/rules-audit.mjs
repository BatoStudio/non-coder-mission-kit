#!/usr/bin/env node
// Kiểm tra dữ liệu luật (skill mission-rules-engine): mỗi luật phải có id duy nhất, tiêu đề, mức
// (error|attention), hướng điều chỉnh (fix), nguồn (văn bản + điều khoản [+ ngày hiệu lực]),
// và ca kiểm thử tồn tại. Đọc mọi tệp .json trong thư mục (mảng luật, hoặc { "rules": [...] }).
// Dùng: node rules-audit.mjs [thư mục=rules] [--require-version] [--require-verified] [--no-tests]
// Đường dẫn trong "tests" tính từ thư mục đang chạy (gốc dự án). Tệp JSON không giống luật (vd. ca kiểm thử) được bỏ qua.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { resolve, join, relative } from 'node:path';

const args = process.argv.slice(2);
const dir = resolve(args.find(a => !a.startsWith('--')) || 'rules');
const needVersion = args.includes('--require-version');
const needVerified = args.includes('--require-verified');
const needTests = !args.includes('--no-tests');
if (!existsSync(dir)) { console.error(`Không thấy thư mục luật: ${dir}`); process.exit(2); }

const walk = d => readdirSync(d).flatMap(f => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : p.endsWith('.json') ? [p] : []; });
const errs = [], warns = [], ids = new Map();
let n = 0;
for (const file of walk(dir)) {
  const rel = relative(process.cwd(), file);
  let data; try { data = JSON.parse(readFileSync(file, 'utf8')); } catch (e) { errs.push(`${rel}: JSON hỏng — ${e.message}`); continue; }
  const rules = Array.isArray(data) ? data : Array.isArray(data.rules) ? data.rules : null;
  const looksLikeRule = r => r && typeof r === 'object' && ('level' in r || 'check' in r || 'source' in r || 'fix' in r);
  if (!rules || !rules.length || !rules.some(looksLikeRule)) { warns.push(`${rel}: không phải danh sách luật (bỏ qua)`); continue; }
  rules.forEach((r, i) => {
    n++;
    const at = `${rel}#${r.id || '[' + i + ']'}`;
    const E = m => errs.push(`${at}: ${m}`), W = m => warns.push(`${at}: ${m}`);
    if (!r.id) E('thiếu id'); else if (ids.has(r.id)) E(`id trùng với ${ids.get(r.id)}`); else ids.set(r.id, rel);
    if (!r.title) W('thiếu title');
    if (!['error', 'attention'].includes(r.level)) E(`level phải là "error" hoặc "attention" (đang là ${JSON.stringify(r.level)})`);
    if (!r.fix || String(r.fix).trim().length < 5) E('thiếu fix (hướng điều chỉnh cho người dùng)');
    const s = r.source || {};
    if (!s.doc) E('thiếu source.doc (tên văn bản/quy ước)');
    if (!s.clause) E('thiếu source.clause (điều/khoản/mục)');
    if (needVersion && !s.version) E('thiếu source.version (ngày hiệu lực)'); else if (!s.version) W('chưa ghi source.version (ngày hiệu lực)');
    if (needVerified && !r.verified?.by) E('chưa có verified.by (người xác nhận)');
    if (r.check && r.check.op && !['>', '>=', '<', '<=', '==', '!=', 'in', 'not-in', 'exists', 'matches'].includes(r.check.op)) E(`check.op lạ: ${r.check.op}`);
    if (needTests) {
      const t = [].concat(r.tests || []);
      if (!t.length) E('chưa có ca kiểm thử (tests)');
      for (const f of t) if (!existsSync(resolve(f))) E(`ca kiểm thử không tồn tại: ${f}`);
      if (t.length && t.length < 2) W('nên có ít nhất ca đạt, ca không đạt và ca đúng ngưỡng');
    }
  });
}
for (const e of errs) console.log('✗ ' + e);
for (const w of warns) console.log('! ' + w);
console.log(`\n${n} luật · ${errs.length} lỗi · ${warns.length} cảnh báo`);
process.exit(errs.length ? 1 : 0);
