// node test/server18.test.js — v18 連線：每個人各自推理、一起開獎（隱私、各自計分、房主立刻開獎、離隊／斷線自動開獎、再玩一局重置）
const { spawn } = require('child_process'); const path = require('path'); const WebSocket = require('ws');
const GEN = require('../docs/casegen.js'), ENG = require('../docs/engine.js');
let fail = 0, okN = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else { okN++; console.log('ok  ', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 4700 + Math.floor(Math.random() * 200);
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), SWEEP_MS: '250', HOST_GRACE_MS: '700', DROP_MS: '1500', LOBBY_RECLAIM_MS: '400', LIM_CREATEIP: '60', LIM_JOINIP: '200', PRESSURE: 'off', TEST_HOOKS: '1' }), stdio: ['ignore', 'ignore', 'pipe'] });
let srvErr = ''; srv.stderr.on('data', d => { srvErr += d; });
function steps(C, from, to, r) { const pts = [], pa = ENG.findPath(C, from.x, from.y, to.x, to.y, r || 12) || []; let cur = from; for (const q of pa) { const n = Math.max(1, Math.ceil(Math.hypot(q.x - cur.x, q.y - cur.y) / 30)); for (let i = 1; i <= n; i++) pts.push([Math.round(cur.x + (q.x - cur.x) * i / n), Math.round(cur.y + (q.y - cur.y) * i / n)]); cur = q; } return pts; }
function client() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`); const c = { ws, msgs: [], waiters: [], st: null, room: null };
    c.send = m => ws.send(JSON.stringify(m));
    c.wait = (pred, ms = 5000) => new Promise(r => { const hit = c.msgs.find(pred); if (hit) return r(hit); const w = { pred, r }; c.waiters.push(w); setTimeout(() => { const i = c.waiters.indexOf(w); if (i >= 0) { c.waiters.splice(i, 1); r(null); } }, ms); });
    c.next = (pred, ms) => { c.msgs = []; return c.wait(pred, ms); };
    ws.on('message', raw => { const m = JSON.parse(raw); if (m.t === 'state') c.st = m.s; if (m.t === 'room') c.room = m.room; c.msgs.push(m); if (c.msgs.length > 400) c.msgs.splice(0, 200); for (const w of c.waiters.slice()) if (w.pred(m)) { c.waiters.splice(c.waiters.indexOf(w), 1); w.r(m); } });
    ws.on('open', () => res(c)); ws.on('error', rej);
    c.close = () => new Promise(r => { ws.once('close', r); ws.close(); });
  });
}
const joined = c => c.wait(m => m.t === "joined" || m.t === "err");
async function room(n) {   // 開一間 n 人的房間並開始，回傳 [clients, C]
  const cs = [], names = ['百九', 'Cynthia', '阿明'];
  for (let i = 0; i < n; i++) { const c = await client(); if (i === 0) c.send({ t: 'create', name: names[i], ci: i }); else c.send({ t: 'join', code: cs[0].code, name: names[i], ci: i }); const j = await joined(c); c.code = j.code; c.slot = j.slot; c.token = j.token; cs.push(c); }
  await sleep(300); cs[0].send({ t: 'start' }); const s = await cs[n - 1].wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'start'));
  const C = GEN.generate(s.s.seed, s.s.diff);
  cs[0].send({ t: 'act', a: { type: 'close' } }); for (const c of cs) await c.wait(m => m.t === 'state' && m.s.phase === 'deduce');
  return [cs, C];
}
const fill = (c, C, cul, all = true) => { c.send({ t: 'act', a: { type: 'draft', field: 'culprit', v: cul } }); if (all) for (const [f, v] of [['method', C.method], ['weapon', C.weapon], ['location', C.location]]) c.send({ t: 'act', a: { type: 'draft', field: f, v } }); };
(async () => {
  for (let i = 0; i < 50; i++) { try { const c = await client(); await c.close(); break; } catch (e) { await sleep(100); } }
  /* 1. 三人：隱私、非房主不能立刻開獎、最後一人離隊 → 自動開獎 */
  { const [[A, B, K], C] = await room(3); const wrong = C.suspects.find(x => x.id !== C.culprit).id;
    fill(A, C, C.culprit); fill(B, C, wrong); await sleep(400);
    const vb = B.st, va = A.st;
    ok(vb.drafts[1].culprit === wrong && !vb.drafts[0] && !vb.drafts[2] && vb.draft.culprit === wrong, '推理中每個人只收到自己的草稿');
    ok(va.drafts[0].culprit === C.culprit && !va.drafts[1], '房主也看不到隊友的答案');
    B.msgs = []; B.send({ t: 'act', a: { type: 'forceReveal' } }); ok(!!(await B.wait(m => m.t === 'err' && /房主/.test(m.msg))), '只有房主可以立刻開獎');
    B.msgs = []; B.send({ t: 'act', a: { type: 'submit' } }); const sb = await A.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'submitted' && e.by === 1));
    ok(sb && sb.s.phase === 'deduce' && sb.s.submitted[1] && !sb.s.drafts[1], '非房主可以送出自己的報告；房主看到「已送出」但看不到內容');
    A.send({ t: 'act', a: { type: 'submit' } }); await sleep(300); ok(A.st.phase === 'deduce', '三人中兩人送出 → 繼續等第三人');
    A.msgs = []; B.msgs = []; K.send({ t: 'leave' });
    const ra = await A.wait(m => m.t === 'state' && m.s.phase === 'result'), rb = await B.wait(m => m.t === 'state' && m.s.phase === 'result');
    ok(ra && rb, '最後一個沒送出的人離開 → 自動開獎（房間不會卡住）');
    ok(ra && ra.s.result.pid === 0 && ra.s.result.rows.every(x => x.ok) && rb.s.result.pid === 1 && !rb.s.result.rows[0].ok, '每個人拿到自己的成績（房主全對、隊友兇手答錯）');
    ok(ra && ra.s.results[0].total > ra.s.results[1].total && !ra.s.results[2] && ra.s.drafts[1] && ra.s.drafts[1].culprit === wrong, '開獎後大家都看得到全員成績與答案（離開的人不計分）');
    A.send({ t: 'again' }); await B.wait(m => m.t === 'lobby'); A.msgs = []; B.msgs = []; A.send({ t: 'start' });
    const s2 = await B.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'start'));
    ok(s2 && s2.s.phase === 'play' && !Object.keys(s2.s.results || {}).length && Object.values(s2.s.submitted || {}).every(x => !x) && s2.s.draft && !s2.s.draft.culprit, '再玩一局：草稿、送出狀態、成績全部重置');
    for (const c of [A, B]) await c.close(); }
  /* 2. 兩人：房主立刻開獎（隊友沒送出 → 用目前草稿，空白 0 分） */
  { const [[A, B], C] = await room(2); fill(A, C, C.culprit); fill(B, C, C.culprit, false); await sleep(300);
    A.send({ t: 'act', a: { type: 'submit' } }); await sleep(300);
    A.msgs = []; B.msgs = []; A.send({ t: 'act', a: { type: 'forceReveal' } });
    const rb = await B.wait(m => m.t === 'state' && m.s.phase === 'result');
    ok(rb && (rb.ev || []).some(e => e.k === 'forced'), '房主立刻開獎 → 大家進入結案報告');
    const r1 = rb && rb.s.results[1]; ok(r1 && r1.submitted === false && r1.rows[0].ok && r1.rows.slice(1).every(x => !x.ok) && rb.s.result.pid === 1 && rb.s.result.submitted === false, '沒送出的人用草稿計分：選了的兇手算分，空白欄位 0 分');
    ok(rb && rb.s.results[0].total > rb.s.results[1].total, '送出完整報告的房主分數比較高');
    for (const c of [A, B]) await c.close(); }
  /* 3. 兩人：隊友斷線（沒回來）→ 斷線太久被當成離隊 → 自動開獎 */
  { const [[A, B], C] = await room(2); fill(A, C, C.culprit); await sleep(200); A.send({ t: 'act', a: { type: 'submit' } }); await sleep(300);
    A.msgs = []; await B.close();
    const ra = await A.wait(m => m.t === 'state' && m.s.phase === 'result', 8000);
    ok(ra && ra.s.result.rows.every(x => x.ok) && Object.keys(ra.s.results).length === 1, '推理中隊友斷線不回來 → 自動開獎（不用一直等）');
    await A.close(); }
  ok(!/Error|TypeError/.test(srvErr), '伺服器沒有錯誤' + (srvErr ? '：' + srvErr.slice(0, 200) : ''));
  srv.kill(); console.log(fail ? `\n${fail} 項失敗（${okN} 項通過）` : `\n全部通過（${okN} 項）`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
