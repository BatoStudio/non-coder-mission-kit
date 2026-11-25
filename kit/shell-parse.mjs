// Bộ đọc lệnh shell cho hook: hiểu dấu ngoặc, ký tự thoát, chú thích, heredoc và lệnh con gần đúng như shell thật.
//   mode 'bash' : '…' nguyên văn; "…" chỉ \$ \` \" \\ là thoát; \x ngoài ngoặc = x; $'…' giải mã \xHH \NNN;
//                 # đầu từ = chú thích; $(…) `…` <(…) >(…) là lệnh con; heredoc <<TAG / <<-TAG / <<'TAG'
//   mode 'ps'   : PowerShell — ` là ký tự thoát; '…' nguyên văn (''=') ; "…" có $(…); # và <# … #> là chú thích;
//                 (…) ở vị trí tham số / sau tên phương thức là biểu thức con; here-string @'…'@ / @"…"@; & là toán tử gọi
//   mode 'cmd'  : cmd.exe — ^ là ký tự thoát; chỉ "…" là ngoặc; & là dấu nối lệnh
// Kết quả: { segs: [{ words, redirs:[{op,target}], piped, bodies:[chuỗi heredoc/here-string đưa vào stdin] }], nested: [chuỗi lệnh con] }
// Từ có lệnh con được thay bằng "$(…)" để bên gọi biết đó là giá trị không biết trước.
export function parseShell(src, mode = 'bash') {
  const r = parseAt(String(src), 0, mode, false);
  return { segs: r.segs, nested: r.nested };
}

function decodeAnsiC(s) {
  return s.replace(/\\(x[0-9a-fA-F]{1,2}|u[0-9a-fA-F]{1,4}|[0-7]{1,3}|.)/g, (m, e) => {
    if (e[0] === 'x' || e[0] === 'u') return String.fromCharCode(parseInt(e.slice(1), 16));
    if (/^[0-7]+$/.test(e)) return String.fromCharCode(parseInt(e, 8));
    return ({ n: '\n', t: '\t', r: '\r', e: '\x1b', a: '\x07', b: '\b', f: '\f', v: '\v' })[e] ?? e;
  });
}

function parseAt(src, i0, mode, closeParen) {
  const ps = mode === 'ps', cmdm = mode === 'cmd', bash = mode === 'bash';
  const ESC = ps ? '`' : cmdm ? '^' : '\\';
  const segs = [], nested = [];
  let words = [], metas = [], redirs = [], bodies = [], inputs = [], inputMetas = [], cur = null, pending = null, heredocs = [];
  // meta của từ đang đọc: subs = văn bản từng lệnh con theo thứ tự, uq = có $ nằm ngoài ngoặc (sẽ bị tách từ)
  let meta = { subs: [], uq: false };
  const n = src.length;
  let depth = 0;
  // opBefore / op: toán tử nối trước / sau đoạn lệnh. scope: các nhóm ( ) đang mở (id).
  let nextOp = null, scopeId = 0;
  const scopes = [];
  const pushWord = () => {
    if (cur === null) return;
    if (pending) {
      if (pending === '<<' || pending === '<<-') { const h = { tag: cur, strip: pending === '<<-', body: '' }; heredocs.push(h); bodies.push(h); }
      else if (pending === '<<<') bodies.push({ body: cur });
      else if (pending === '<') { inputs.push(cur); inputMetas.push(meta); } // tệp đưa vào stdin (chỉ đọc)
      else redirs.push({ op: pending, target: cur, meta });
      pending = null;
    } else { words.push(cur); metas.push(meta); }
    cur = null; meta = { subs: [], uq: false };
  };
  const endSeg = (piped = false, op = piped ? '|' : null) => {
    pushWord(); pending = null;
    const has = words.length || redirs.length || bodies.length || inputs.length;
    if (has) segs.push({ words, metas, redirs, piped, bodies, inputs, inputMetas, scope: [...scopes], opBefore: nextOp, op });
    if (has) nextOp = op ?? ';'; else if (op && op !== ';') nextOp = op;
    words = []; metas = []; redirs = []; bodies = []; inputs = []; inputMetas = [];
  };
  const add = s => { cur = (cur ?? '') + s; };
  const sub = j => { const r = parseAt(src, j, mode, true); const text = src.slice(j, r.end); nested.push(text); meta.subs.push(text); return r.end; }; // trả vị trí ')' đóng
  let i = i0;
  while (i < n) {
    const c = src[i];
    if (c === '\n' || c === '\r') {
      endSeg(); i += (c === '\r' && src[i + 1] === '\n') ? 2 : 1;
      for (const h of heredocs) {
        const lines = [];
        while (i < n) {
          let e = src.indexOf('\n', i); if (e < 0) e = n;
          let line = src.slice(i, e).replace(/\r$/, ''); if (h.strip) line = line.replace(/^\t+/, '');
          i = e + 1; if (line === h.tag) break; lines.push(line);
        }
        h.body = lines.join('\n');
      }
      heredocs = [];
      continue;
    }
    if (c === ' ' || c === '\t') { pushWord(); i++; continue; }
    // chú thích
    if (!cmdm && c === '#' && cur === null) { while (i < n && src[i] !== '\n' && src[i] !== '\r') i++; continue; }
    if (ps && c === '<' && src[i + 1] === '#') { const e = src.indexOf('#>', i + 2); i = e < 0 ? n : e + 2; continue; }
    if (c === ESC) { if (src[i + 1] === '\n') { i += 2; continue; } if (src[i + 1] === '\r' && src[i + 2] === '\n') { i += 3; continue; } add(src[i + 1] ?? ''); i += 2; continue; }
    if (c === "'" && !cmdm) {
      if (ps) { let j = i + 1, s = ''; while (j < n) { if (src[j] === "'") { if (src[j + 1] === "'") { s += "'"; j += 2; continue; } break; } s += src[j++]; } add(s); i = j + 1; continue; }
      const j = src.indexOf("'", i + 1), e = j < 0 ? n : j; add(src.slice(i + 1, e)); i = e + 1; continue;
    }
    if (c === '"') {
      let j = i + 1, s = '';
      while (j < n && src[j] !== '"') {
        const d = src[j];
        if (bash && d === '\\' && '$`"\\\n'.includes(src[j + 1] ?? '')) { s += src[j + 1]; j += 2; continue; }
        if (ps && d === '`') { s += src[j + 1] ?? ''; j += 2; continue; }
        if (!cmdm && d === '$' && src[j + 1] === '(') { const e = sub(j + 2); s += '$(…)'; j = e + 1; continue; }
        if (bash && d === '`') { const e = src.indexOf('`', j + 1), ee = e < 0 ? n : e; nested.push(src.slice(j + 1, ee)); meta.subs.push(src.slice(j + 1, ee)); s += '$(…)'; j = ee + 1; continue; }
        s += d; j++;
      }
      add(s); i = j + 1; continue;
    }
    if (!cmdm && c === '$' && src[i + 1] === '(') { meta.uq = true; const e = sub(i + 2); add('$(…)'); i = e + 1; continue; }
    if (bash && c === '$' && src[i + 1] === "'") { let j = i + 2, s = ''; while (j < n && src[j] !== "'") { if (src[j] === '\\') { s += src.slice(j, j + 2); j += 2; continue; } s += src[j++]; } add(decodeAnsiC(s)); i = j + 1; continue; }
    if (bash && c === '`') { const e = src.indexOf('`', i + 1), ee = e < 0 ? n : e; nested.push(src.slice(i + 1, ee)); meta.uq = true; meta.subs.push(src.slice(i + 1, ee)); add('$(…)'); i = ee + 1; continue; }
    if (bash && (c === '<' || c === '>') && src[i + 1] === '(') { pushWord(); const e = sub(i + 2); add('$(…)'); i = e + 1; continue; } // <(…) >(…)
    if (ps && c === '@' && (src[i + 1] === "'" || src[i + 1] === '"') && cur === null) {
      const q = src[i + 1], endTok = '\n' + q + '@', e = src.indexOf(endTok, i + 2), ee = e < 0 ? n : e;
      const body = src.slice(i + 2, ee);
      if (q === '"') for (const m of body.matchAll(/\$\(([^)]*)\)/g)) nested.push(m[1]);
      add(body); i = e < 0 ? n : e + endTok.length; continue;
    }
    // PowerShell: (…) ở vị trí tham số hoặc dính sau tên (gọi phương thức) là biểu thức con
    if (ps && c === '(' && (cur !== null || words.length)) { const e = sub(i + 1); add('$(…)'); i = e + 1; continue; }
    const two = src.slice(i, i + 2);
    if (two === '&&' || two === '||') { endSeg(false, two); i += 2; continue; }
    if (c === ';') { endSeg(false, ';'); i++; continue; }
    if (c === '|') { endSeg(true); i += src[i + 1] === '&' ? 2 : 1; continue; }
    // mảng bash T=(a b): đọc như lệnh con để lấy nội dung, nhưng giá trị là «không biết» (null)
    if (bash && c === '(' && cur !== null && /^[A-Za-z_]\w*\+?=$/.test(cur)) { const e = sub(i + 1); meta.subs[meta.subs.length - 1] = null; add('$(…)'); i = e + 1; continue; }
    if (c === '(') { endSeg(); depth++; scopes.push(++scopeId); i++; continue; }
    if (c === ')') { if (closeParen && depth === 0) { endSeg(); for (const s of segs) s.bodies = s.bodies.map(b => b.body); return { segs, nested, end: i }; } endSeg(); depth = Math.max(0, depth - 1); scopes.pop(); i++; continue; }
    // chuyển hướng: [n]> [n]>> >| &> &>> *> < << <<- <<< ; n>&m là nhân bản fd (không có tệp đích)
    if (c === '>' || c === '<' || (c === '&' && src[i + 1] === '>')) {
      const m = /^(&>>?|>>?\|?|<<<|<<-?|<>?|>&)/.exec(src.slice(i));
      let op = m[1];
      if (cur !== null && (/^\d+$/.test(cur) || cur === '*')) cur = null; // số fd / * dính liền trước toán tử
      else pushWord();
      i += op.length;
      if (op === '>' && src[i] === '&') { i++; op = '>&'; }
      if (op === '>&') { const d = /^\d+-?|^-/.exec(src.slice(i)); if (d) { i += d[0].length; continue; } op = '>'; }
      if (op === '<>') op = '>';
      pending = op; continue;
    }
    if (c === '&' && !ps) { endSeg(false, '&'); i++; continue; } // chạy nền = dấu nối lệnh (PowerShell: & là toán tử gọi)
    if (c === '$') meta.uq = true;
    add(c); i++;
  }
  endSeg();
  for (const s of segs) s.bodies = s.bodies.map(b => b.body);
  return { segs, nested, end: n };
}
