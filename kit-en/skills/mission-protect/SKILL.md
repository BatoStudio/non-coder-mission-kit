---
name: mission-protect
description: Obfuscate the frontend BUILD OUTPUT to make copying the code harder — minify, rename variables, encode strings, drop source maps; only processes the build folder (dist/), never touches the source code. Use when the project owner types /mission-protect, or says "protect the code from copying", "scramble the code", "obfuscate", "hide the code", "stop code theft" for a web app.
---

# Obfuscate the build to deter copying — only dist/, never the source

## The truth to say first (tell the project owner every time, do not promise more than this)

Obfuscating code **slows down** a copier, it **cannot lock** the code. Everything sent to the browser can be viewed with DevTools; obfuscation only makes it hard to read and hard to copy as a whole. The things that really protect you:

- **Keep important logic on the server** (Cloudflare Workers/Functions) — it is never sent to the user.
- **Keep keys/tokens in environment variables**, not embedded in client JS.
- **Server-side license checks** and **legal terms**.

Frontend obfuscation is **a deterrent layer**, an extra, not a replacement for the things above. Server code does **not need** obfuscating (it is not exposed in the first place).

## Hard rules

1. **Run only on the BUILD folder** (`dist/`, the version that will be deployed), **never** on `web/`, `src/` or any source code folder. The script refuses by itself if it sees files tracked by git (that is source).
2. **No backup, because the build can be rebuilt.** The process = fresh build → obfuscate → **test run** → if broken, rebuild. The safety net is the test run, not a backup.
3. **Do not decide to deploy on your own.** After obfuscating, still go through the `ship` skill / `/mission-deploy` as usual (with the project owner's ask step).
4. Third-party libraries in `vendor/` and `*.min.js` files **stay unchanged** (already minified; re-bundling breaks easily).
5. Only process `.mjs` (ES modules). Classic `.js` files loaded with a plain `<script>` are not touched automatically (different format, breaks easily) — if you find any, tell the project owner.

## When to run

Between **build** and **deploy**. For example:
1. Build a clean version: `node scripts/build-dist.mjs` (copies `web/` → `dist/`).
2. Obfuscate `dist/` (step below).
3. Test-run `dist/` (the `mission-web-qa` or `web-smoke` skill, or open it by hand): the page runs, no console errors, the main features still work.
4. Broken → **do not deploy**; rebuild from step 1, tell the project owner which file broke.
5. OK → deploy through `ship`/`/mission-deploy`.

## How to run

Read-only first (downloads nothing, changes nothing):
```
node .claude/skills/mission-protect/scripts/protect.mjs dist --dry-run
```

Minify (default — renames local variables, removes comments/whitespace, KEEPS import/export):
```
node .claude/skills/mission-protect/scripts/protect.mjs dist
```

Add a string obfuscation layer (stronger, still safe with ES modules):
```
node .claude/skills/mission-protect/scripts/protect.mjs dist --obfuscate
```

- `--hard`: also turns on control-flow obfuscation + self-defending. **Slower at runtime and breaks more easily** — use it only for a few core files, and test-run carefully.
- `--keep "<glob>"`: keep more files/folders unchanged (can be repeated). `**/vendor/**`, `**/*.min.js` are already kept by default.
- The first time, `npx` downloads exactly the versions pinned in the script (`esbuild@…`, `javascript-obfuscator@…`). The guard may ask — this is a build tool, click allow.

## After running

Read the «CẢNH BÁO» (WARNING) part the script prints:
- «có chuỗi giống bí mật» (a string that looks like a secret): a token/key has slipped into the client version — **stop**, fix it in the source (move it to the server/an environment variable), do not just obfuscate over it.
- «còn sourceMappingURL» (sourceMappingURL still present) / «còn … khối chú thích dài» (long comment blocks still present) / «vẫn N dòng» (still N lines): that file may not have been minified — check it again.
Then report to the project owner: number of files, how many % smaller, which files were left unchanged, and remind them this is only a deterrent layer (see the top section).

## Do not

- Do not obfuscate server code (`functions/`, `web/server/`): pointless and breaks easily.
- Do not commit the obfuscated version to git (dist/ must be in .gitignore).
- Do not embed keys/tokens in client JS and think obfuscation is enough — it is not.
