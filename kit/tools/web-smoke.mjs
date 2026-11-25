#!/usr/bin/env node
// Mở một app web (tệp HTML hoặc URL) trong Chrome không giao diện:
//  - bắt lỗi JavaScript, lỗi console, yêu cầu mạng hỏng
//  - chụp ảnh ở 3 khổ màn hình (điện thoại, máy tính bảng, máy tính) — tùy chọn chế độ tối
//  - tùy chọn chạy một kịch bản thao tác (--script tệp.mjs, export default async (page) => {...})
// Dùng: node web-smoke.mjs <index.html | http://…> [--out .mission/shots] [--dark] [--wait 1500]
//                          [--sizes 390x844,820x1180,1440x900] [--script steps.mjs] [--no-shots]
// Cần Playwright (npm i -D playwright && npx playwright install chromium) HOẶC puppeteer/puppeteer-core
// + Chrome (đặt CHROME=<đường dẫn chrome> nếu không tự tìm được).
import { existsSync, mkdirSync } from 'node:fs';
import { resolve, basename } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const target = args.find((a, i) => !a.startsWith('--') && !(args[i - 1] || '').match(/^--(out|wait|sizes|script|lib)$/));
if (!target) { console.error('Dùng: node web-smoke.mjs <index.html | URL> [--dark] [--sizes 390x844,1440x900] [--script steps.mjs]'); process.exit(2); }
const url = /^https?:\/\//.test(target) ? target : pathToFileURL(resolve(target)).href;
const outDir = resolve(opt('out', '.mission/shots'));
const sizes = opt('sizes', '390x844,820x1180,1440x900').split(',').map(s => s.split('x').map(Number));
const wait = Number(opt('wait', 1200));
const dark = args.includes('--dark');
const shots = !args.includes('--no-shots');

// ---- tìm thư viện trình duyệt: trong dự án trước, rồi cài toàn cục ----
async function load(name) {
  // gốc dự án, --lib <thư mục>, rồi các thư mục test hay gặp (app có thể cài playwright trong tests/smoke, tools…)
  const extra = [opt('lib'), 'tests/smoke', 'tests', 'tools', 'e2e', 'test'].filter(Boolean);
  const bases = [resolve('package.json'), ...extra.map(d => resolve(d, 'package.json'))];
  try { bases.push(resolve(execSync('npm root -g', { encoding: 'utf8' }).trim(), '..', 'package.json')); } catch {}
  for (const b of bases) {
    try { const req = createRequire(b); return await import(pathToFileURL(req.resolve(name)).href); } catch {}
  }
  return null;
}
const CHROMES = [process.env.CHROME, 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].filter(Boolean);
const chrome = CHROMES.find(p => existsSync(p));

let browser, newPage, kind;
const pw = (await load('playwright')) || (await load('playwright-core'));
if (pw) {
  const chromium = pw.chromium || pw.default?.chromium;
  try { browser = await chromium.launch(); }
  catch { try { browser = await chromium.launch({ channel: 'chrome' }); } catch { browser = await chromium.launch(chrome ? { executablePath: chrome } : {}); } }
  kind = 'playwright';
  newPage = async (w, h) => { const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: dark ? 'dark' : 'light', deviceScaleFactor: 1 }); return ctx.newPage(); };
} else {
  const pp = (await load('puppeteer')) || (await load('puppeteer-core'));
  if (!pp) { console.error('Thiếu trình duyệt tự động (đã tìm ở gốc dự án, tests/smoke, tests, tools, e2e). Cài: npm i -D playwright && npx playwright install chromium, hoặc chỉ chỗ đã cài bằng --lib <thư mục>'); process.exit(3); }
  const puppeteer = pp.default || pp;
  browser = await puppeteer.launch({ headless: 'new', executablePath: chrome, args: ['--no-sandbox', '--allow-file-access-from-files'] });
  kind = 'puppeteer';
  newPage = async (w, h) => { const p = await browser.newPage(); await p.setViewport({ width: w, height: h }); if (dark) await p.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: 'dark' }]); return p; };
}

const problems = [];
const stepsMod = opt('script') ? (await import(pathToFileURL(resolve(opt('script'))).href)).default : null;
if (shots) mkdirSync(outDir, { recursive: true });
const name = basename(target).replace(/[^a-z0-9.-]+/gi, '_').replace(/\.html?$/, '') || 'page';
for (const [w, h] of sizes) {
  const page = await newPage(w, h);
  page.on('pageerror', e => problems.push(`[${w}px] Lỗi JavaScript: ${e.message}`));
  page.on('console', m => { const t = typeof m.type === 'function' ? m.type() : m.type; if (t === 'error') problems.push(`[${w}px] console.error: ${m.text()}`); });
  page.on('requestfailed', r => problems.push(`[${w}px] Tải hỏng: ${r.url()}`));
  try {
    await page.goto(url, { waitUntil: kind === 'playwright' ? 'load' : 'load', timeout: 30000 });
    await new Promise(r => setTimeout(r, wait));
    if (stepsMod) await stepsMod(page, { width: w, height: h });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (overflow > 2) problems.push(`[${w}px] Tràn ngang ${overflow}px (có phần tử rộng hơn màn hình)`);
    if (shots) { const f = resolve(outDir, `${name}-${w}${dark ? '-dark' : ''}.png`); await page.screenshot({ path: f, fullPage: true }); console.log(`ảnh: ${f}`); }
  } catch (e) { problems.push(`[${w}px] Không mở được trang: ${e.message}`); }
  await page.close();
}
await browser.close();
console.log(`${kind} · ${url} · ${sizes.map(s => s[0]).join('/')}px${dark ? ' · tối' : ''}`);
for (const p of [...new Set(problems)]) console.log('✗ ' + p);
console.log(problems.length ? `ĐỎ: ${problems.length} vấn đề` : 'XANH: không lỗi JavaScript/console/tải hỏng/tràn ngang');
process.exit(problems.length ? 1 : 0);
