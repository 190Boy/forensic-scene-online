// node test/server15.test.js — v15 連線穩定度：斷線、重連、房主交接、幽靈隊員、同時操作、再玩一局
const { spawn } = require('child_process'); const path = require('path'); const WebSocket = require('ws');
const GEN = require('../docs/casegen.js'), ENG = require('../docs/engine.js');
let fail = 0, okN = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else { okN++; console.log('ok  ', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 4300 + Math.floor(Math.random() * 300);
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
const joined = c => c.wait(m => m.t === 'joined' || m.t === 'err');
async function walk(c, C, from, to, r) { for (const [x, y] of steps(C, from, to, r)) { c.send({ t: 'mv', x, y, d: 1 }); await sleep(110); } await sleep(300); }
(async () => {
  for (let i = 0; i < 50; i++) { try { const c = await client(); await c.close(); break; } catch (e) { await sleep(100); } }
  /* 1. 開房、加入、開始 */
  const A = await client(); A.send({ t: 'create', name: '百九', ci: 0 }); const ja = await joined(A);
  const B = await client(); B.send({ t: 'join', code: ja.code, name: 'Cynthia', ci: 1 }); const jb = await joined(B);
  const G = await client(); G.send({ t: 'join', code: ja.code, name: '幽靈', ci: 2 }); await joined(G); await G.close();   // 大廳裡斷線的人
  await sleep(1000);
  A.send({ t: 'start' }); const s0 = await B.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'start'));
  ok(s0 && Object.keys(s0.s.players).length === 2, '大廳裡斷線很久的人不會變成幽靈隊員（開局 ' + (s0 && Object.keys(s0.s.players).length) + ' 人）');
  const C = GEN.generate(s0.s.seed, s0.s.diff), body = ENG.objById(C, 'body');
  /* 2. 兩人同時做同一件事：只有一個成功；兩人同時開關燈：大家看到的一樣 */
  A.send({ t: 'act', a: { type: 'gear', tools: ['camera', 'thermo'] } }); B.send({ t: 'act', a: { type: 'gear', tools: ['camera', 'thermo'] } }); await sleep(400);
  await Promise.all([walk(A, C, C.start[0], body, 60), walk(B, C, C.start[1], body, 60)]);
  A.msgs = []; B.msgs = [];
  A.send({ t: 'act', a: { type: 'mgStart', obj: 'body', act: 'wound' } }); B.send({ t: 'act', a: { type: 'mgStart', obj: 'body', act: 'wound' } });
  await sleep(C.mgMin * 1000 + 600);
  A.send({ t: 'act', a: { type: 'use', obj: 'body', act: 'wound', score: .9 } }); B.send({ t: 'act', a: { type: 'use', obj: 'body', act: 'wound', score: .9 } });
  await sleep(700);
  const st1 = A.st, nUse = (st1.found || []).filter(f => /^E_wound/.test(f.id)).length;
  const errsAB = [...A.msgs, ...B.msgs].filter(m => m.t === 'err').map(m => m.msg);
  ok(nUse === 1 && !st1.players[0].mg && !st1.players[1].mg, '兩人同時交同一個小遊戲：只記一次結果，兩人都不會卡在「分析中」' + JSON.stringify({ nUse, mg: [st1.players[0].mg, st1.players[1].mg], tools: [st1.players[0].tools, st1.players[1].tools], pos: [st1.players[0].x, st1.players[0].y, st1.players[1].x, st1.players[1].y], errsAB }));
  /* 3. 小遊戲做到一半斷線 → 隊友那邊立刻看到他不在分析中；房主斷線 → 房主交給在線的人 */
  A.send({ t: 'act', a: { type: 'mgStart', obj: 'body', act: 'temp' } }); await A.wait(m => m.t === 'state' && m.s.players[0].mg);
  const tokA = ja.token; B.msgs = []; await A.close();
  const cleared = await B.wait(m => m.t === 'state' && !m.s.players[0].mg, 3000);
  ok(!!cleared, '小遊戲做到一半斷線 → 「分析中」立刻解除');
  const hostMsg = await B.wait(m => m.t === 'room' && m.room.players[jb.slot] && m.room.players[jb.slot].host, 4000);
  ok(!!hostMsg, '房主斷線 20 秒（測試 0.7 秒）→ 房主交給還在線的隊員');
  /* 4. 斷線太久 → 算離隊（證物交給隊友、節奏重算）；重連回來 → 回到隊伍 */
  const drop = await B.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'left' && e.drop), 5000);
  ok(drop && drop.s.players[0].active === false, '斷線太久 → 自動離隊（不會卡住證物）');
  await sleep(500); ok(B.st.pace === 2.1, '只剩一人 → 節奏變回單人 ×2.1（' + B.st.pace + '）');
  const A2 = await client(); A2.send({ t: 'join', code: ja.code, token: tokA, name: '百九' }); await joined(A2);
  const back = await B.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'rejoin'), 4000);
  ok(back && back.s.players[0].active === true && !back.s.players[0].mg, '同一個人重新連線 → 回到隊伍、可以繼續調查');
  await sleep(600);
  const r = await (async () => { A2.msgs = []; A2.send({ t: 'act', a: { type: 'gear', tools: ['camera'] } }); return A2.wait(m => m.t === 'err' || (m.t === 'state' && (m.ev || []).some(e => e.k === 'gear')), 2000); })();
  ok(r && r.t === 'state', '回來後可以照常操作（在車旁換裝備）');
  /* 5. 新房主結案、送出、再玩一局 → 全新的狀態 */
  B.send({ t: 'act', a: { type: 'close' } }); await B.wait(m => m.t === 'state' && m.s.phase === 'deduce');
  for (const [f, v] of [['culprit', C.culprit], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) B.send({ t: 'act', a: { type: 'draft', field: f, v } });
  await sleep(300);
  // v18：推理中看不到隊友的答案（只收到自己的草稿＋大家的送出狀態）
  { A2.msgs = []; const wrong = C.suspects.find(x => x.id !== C.culprit).id; A2.send({ t: 'act', a: { type: 'draft', field: 'culprit', v: wrong } });
    const v = await A2.wait(m => m.t === 'state' && m.s.phase === 'deduce' && m.s.drafts && m.s.drafts[0] && m.s.drafts[0].culprit === wrong);
    ok(v && !v.s.drafts[1] && v.s.draft.culprit === wrong && Object.keys(v.s.drafts).length === 1 && v.s.submitted && v.s.submitted[1] === false, 'v18：推理中隊友（A2）只收到自己的草稿，看不到房主的答案');
    ok(v && JSON.stringify(v.s).indexOf('"culprit":"' + C.culprit + '"') < 0 || C.culprit === wrong, 'v18：狀態裡完全沒有房主選的兇手');
    B.msgs = []; A2.msgs = []; B.send({ t: 'act', a: { type: 'submit' } });
    const w = await A2.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'submitted' && e.by === 1));
    ok(w && w.s.phase === 'deduce' && w.s.submitted[1] === true && !w.s.drafts[1], 'v18：房主送出 → 隊友看到「已送出」，但還是看不到答案、還在推理');
    for (const [f, v2] of [['method', C.method], ['weapon', C.weapon], ['location', C.location]]) A2.send({ t: 'act', a: { type: 'draft', field: f, v: v2 } });
    await sleep(300); A2.send({ t: 'act', a: { type: 'submit' } }); }
  const res = await B.wait(m => m.t === 'state' && m.s.phase === 'result'), resA = await A2.wait(m => m.t === 'state' && m.s.phase === 'result');
  ok(res && res.s.result.rows.every(x => x.ok), '新房主可以送出推理，答對全對');
  ok(resA && resA.s.result && !resA.s.result.rows[0].ok && resA.s.result.pid === 0 && resA.s.results && resA.s.results[1] && resA.s.results[1].total > resA.s.result.total, 'v18：非房主也能送出；全員送出自動開獎；每人拿到自己的成績＋全員比較');
  B.send({ t: 'again' }); ok(!!(await A2.wait(m => m.t === 'lobby', 3000)), '再玩一局 → 大家回到房間');
  A2.msgs = []; B.send({ t: 'start' }); const s2 = await A2.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'start'));
  const fresh = s2 && s2.s.found.length === 0 && Object.values(s2.s.drafts || {}).every(d => !d.culprit) && Object.values(s2.s.submitted || {}).every(x => !x) && !Object.keys(s2.s.results || {}).length && Object.keys(s2.s.briefed).length === 0 && s2.s.cops.every(c => !c.order) && Object.values(s2.s.players).every(p => p.active && !p.mg && !p.bag.length && !p.samples.length) && s2.s.boss.mode === 'away' && s2.s.seed !== s0.s.seed;
  ok(fresh, '新的一局：證據、員警報告、調度、小遊戲、證物袋、分局長全部重置，換新案件');
  /* 6. 連線交差：走過去自動交、按 E 交（每一位都可以） */
  { const H = await client(); H.send({ t: 'create', name: '甲', ci: 0 }); const jh = await joined(H);
    const K = await client(); K.send({ t: 'join', code: jh.code, name: '乙', ci: 1 }); await joined(K);
    H.send({ t: 'start' }); const s5 = await K.wait(m => m.t === 'state' && (m.ev || []).some(e => e.k === 'start')); const C5 = GEN.generate(s5.s.seed, s5.s.diff), bd = ENG.objById(C5, 'body');
    H.send({ t: 'act', a: { type: 'gear', tools: ['camera', 'thermo'] } }); await sleep(300);
    await walk(H, C5, C5.start[0], bd, 60);
    H.send({ t: 'act', a: { type: 'mgStart', obj: 'body', act: 'temp' } }); await sleep(C5.mgMin * 1000 + 500); H.send({ t: 'act', a: { type: 'use', obj: 'body', act: 'temp', score: .9 } }); await sleep(500);
    H.send({ t: 'dbg', forceBoss: { kind: 'report', rep: 'tod', wait: 600 } });
    await K.wait(m => m.t === 'state' && m.s.boss.mode === 'in', 4000);
    // 乙走過去追分局長（他會走動）：走到身邊就自動交差
    let me = { x: C5.start[1].x, y: C5.start[1].y }, okWalk = false;
    for (let i = 0; i < 400 && !okWalk; i++) { const pm = K.msgs.filter(m => m.t === 'pos' && m.b).pop(); const b = pm ? { x: pm.b[0], y: pm.b[1] } : s5.s.boss;
      const pa = ENG.findPath(C5, me.x, me.y, b.x, b.y, 20) || []; const q = pa[0] || b; const d = Math.hypot(q.x - me.x, q.y - me.y), st = Math.min(28, d); if (d > 1) { me = { x: Math.round(me.x + (q.x - me.x) / d * st), y: Math.round(me.y + (q.y - me.y) / d * st) }; K.send({ t: 'mv', x: me.x, y: me.y, d: 1 }); }
      await sleep(110); okWalk = !!(K.st && K.st.bossOk >= 1); }
    ok(okWalk, '連線：做完要求後隊友走到分局長身邊 → 自動交差');
    // 甲按 E 交差（第二個要求：傷口照片）
    await walk(H, C5, bd, bd, 60); H.send({ t: 'act', a: { type: 'mgStart', obj: 'body', act: 'wound' } }); await sleep(C5.mgMin * 1000 + 500); H.send({ t: 'act', a: { type: 'use', obj: 'body', act: 'wound', score: .9 } }); await sleep(400);
    H.send({ t: 'dbg', forceBoss: { kind: 'report', rep: 'wound', wait: 600 } }); await H.wait(m => m.t === 'state' && m.s.boss.mode === 'in' && m.s.boss.demand && m.s.boss.demand.rep === 'wound', 6000);
    let hx = H.st.players[0].x, hy = H.st.players[0].y, okE = false;
    for (let i = 0; i < 400 && !okE; i++) { const pm = H.msgs.filter(m => m.t === 'pos' && m.b).pop(); const b = pm ? { x: pm.b[0], y: pm.b[1] } : H.st.boss; const dd = Math.hypot(b.x - hx, b.y - hy);
      if (dd < 150) { H.msgs = H.msgs.filter(m => m.t !== 'err'); H.send({ t: 'act', a: { type: 'boss' } }); await sleep(250); if (H.st.bossOk >= 2) okE = true; continue; }
      const pa = ENG.findPath(C5, hx, hy, b.x, b.y, 20) || []; const q = pa[0] || b; const d = Math.hypot(q.x - hx, q.y - hy), stp = Math.min(28, d); if (d > 1) { hx = Math.round(hx + (q.x - hx) / d * stp); hy = Math.round(hy + (q.y - hy) / d * stp); H.send({ t: 'mv', x: hx, y: hy, d: 1 }); } await sleep(110); }
    ok(okE, '連線：靠近分局長按 E／點「交差」→ 交差成功');
    await H.close(); await K.close(); }
  ok(!/Error|TypeError/.test(srvErr), '伺服器沒有錯誤' + (srvErr ? '：' + srvErr.slice(0, 200) : ''));
  srv.kill(); console.log(fail ? `\n${fail} 項失敗（${okN} 項通過）` : `\n全部通過（${okN} 項）`); process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
