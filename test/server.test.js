// node test/server.test.js — 啟動本機伺服器，用多個 ws 客戶端測房間同步、重連、安全、語音信令、壓力系統
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');
let fail = 0, okN = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else { okN++; console.log('ok  ', m); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PORT = 3900 + Math.floor(Math.random() * 300);
const srv = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], { env: Object.assign({}, process.env, { PORT: String(PORT), LOBBY_RECLAIM_MS: '400', LIM_CREATEIP: '60', LIM_JOINIP: '200', TIME_SCALE: '30' }), stdio: ['ignore', 'ignore', 'pipe'] });
let srvErr = ''; srv.stderr.on('data', d => { srvErr += d; });
function client() {
  return new Promise((res, rej) => {
    const ws = new WebSocket(`ws://localhost:${PORT}/ws`); const c = { ws, msgs: [], waiters: [] };
    c.send = m => ws.send(typeof m === 'string' ? m : JSON.stringify(m));
    c.wait = (pred, ms = 4000) => new Promise(r => { const hit = c.msgs.find(pred); if (hit) return r(hit); const w = { pred, r }; c.waiters.push(w); setTimeout(() => { const i = c.waiters.indexOf(w); if (i >= 0) { c.waiters.splice(i, 1); r(null); } }, ms); });
    c.next = (pred, ms) => { c.msgs = []; return c.wait(pred, ms); };
    ws.on('message', raw => { const m = JSON.parse(raw); c.msgs.push(m); if (c.msgs.length > 400) c.msgs.splice(0, 200); for (const w of c.waiters.slice()) if (w.pred(m)) { c.waiters.splice(c.waiters.indexOf(w), 1); w.r(m); } });
    ws.on('open', () => res(c)); ws.on('error', rej);
    c.close = () => new Promise(r => { ws.once('close', r); ws.close(); });
  });
}
const joined = c => c.wait(m => m.t === 'joined' || m.t === 'err');
const get = p => new Promise(r => http.get(`http://localhost:${PORT}${p}`, res => { let d = ''; res.on('data', x => d += x); res.on('end', () => r({ status: res.statusCode, body: d })); }));
(async () => {
  for (let i = 0; i < 50; i++) { try { const c = await client(); await c.close(); break; } catch (e) { await sleep(100); } }
  ok((await get('/healthz')).body === 'ok', '/healthz');
  ok((await get('/')).body.includes('鑑識現場'), '首頁可以打開');
  ok((await get('/../server.js')).status === 404, '不能讀到伺服器原始碼');
  const ice = JSON.parse((await get('/ice')).body); ok(Array.isArray(ice.iceServers) && ice.iceServers.some(s => [].concat(s.urls).some(u => /^turns?:/.test(u))), '/ice 有 TURN 中繼');

  /* 開房、加入、改難度 */
  const A = await client(); A.send({ t: 'create', name: '百九', ci: 0 }); const ja = await joined(A);
  ok(ja.t === 'joined' && /^\d{4}$/.test(ja.code) && ja.slot === 0, '開房拿到 4 位數房號 ' + ja.code);
  const code = ja.code;
  const B = await client(); B.send({ t: 'join', code, name: 'Cynthia', ci: 0 }); const jb = await joined(B);
  ok(jb.t === 'joined' && jb.slot === 1, 'B 加入座位 1');
  const rb = await B.wait(m => m.t === 'room' && m.room.players[1]);
  ok(rb.room.players[1].ci !== 0, '隊員顏色重複時自動換一個');
  B.send({ t: 'diff', v: 'hard' }); A.send({ t: 'diff', v: 'easy' });
  ok(!!(await A.wait(m => m.t === 'room' && m.room.diff === 'easy')), '房主可以改難度（非房主不行）');
  /* 名字搶座位 */
  await B.close(); await sleep(150);
  const X = await client(); X.send({ t: 'join', code, name: 'Cynthia', ci: 1 }); const jx = await joined(X);
  ok(jx.t === 'joined' && jx.slot !== 1 && jx.token !== jb.token, '別人用同名加入 → 拿到別的座位，沒有 Cynthia 的 token');
  const B2 = await client(); B2.send({ t: 'join', code, token: jb.token, name: 'x' }); const jb2 = await joined(B2);
  ok(jb2.t === 'joined' && jb2.slot === 1 && jb2.rejoin, 'Cynthia 用 token 重連回到原座位');
  X.send({ t: 'leave' }); await X.wait(m => m.t === 'left');
  /* 開始 */
  ok((await (async () => { B2.send({ t: 'start' }); await sleep(200); return !B2.msgs.some(m => m.t === 'state'); })()), '非房主不能開始');
  A.msgs = []; B2.msgs = [];
  A.send({ t: 'start' });
  const sa = await A.wait(m => m.t === 'state'), sb = await B2.wait(m => m.t === 'state');
  ok(sa && sb && sa.s.seed === sb.s.seed && sa.s.diff === 'easy', '兩人收到同一個案件（種子相同、難度＝簡單）');
  ok(Object.keys(sa.s.players).length === 2 && sa.s.budget === 14 && sa.s.players[0].ap === undefined, '全隊共用實驗室額度（簡單 14），沒有個人點數');
  ok(!JSON.stringify(sa.s).includes(ja.token), '同步狀態裡沒有 token');
  /* 移動同步 */
  B2.msgs = []; A.send({ t: 'mv', x: 320, y: 700, d: -1 });
  const pos = await B2.wait(m => m.t === 'pos' && m.p.some(q => q[0] === 0 && q[1] === 320));
  ok(!!pos, 'A 移動 → B 收到位置');
  ok(pos && Array.isArray(pos.n) && pos.n.length === 4, '位置封包也帶 4 位關係人 NPC');
  ok(pos && Array.isArray(pos.c) && pos.c.length === sa.s.cops.length && pos.c.length >= 3, `位置封包帶封鎖線內 ${pos && pos.c ? pos.c.length : 0} 位員警`);
  ok(pos && Array.isArray(pos.b) && pos.b.length === 3, '位置封包帶分局長位置與狀態');
  ok(sa.s.cops.filter(c => c.rk).length >= 1, '員警裡至少有一位是菜鳥（由伺服器決定）');
  A.msgs = []; A.send({ t: 'mv', x: 1500, y: 900, d: 1 }); ok(!!(await A.wait(m => m.t === 'fix')), '瞬移太遠 → 伺服器拉回');
  /* 動作同步 */
  B2.msgs = []; A.send({ t: 'act', a: { type: 'gear', tools: ['camera', 'luminol', 'thermo'] } });
  const sg = await B2.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'gear'));
  ok(sg && sg.s.players[0].tools.length === 3 && sg.s.players[0].lum === 3, 'A 換裝備（魯米諾 3 次）→ B 看到');
  B2.msgs = []; B2.send({ t: 'act', a: { type: 'light', obj: 'sw_living' } }); ok(!!(await B2.wait(m => m.t === 'err' && /太遠/.test(m.msg))), '離開關太遠不能關燈');
  B2.send({ t: 'act', a: { type: 'gear', tools: ['prints', 'luminol', 'camera'] } }); await B2.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'gear'));
  for (const [x, y] of [[400, 690], [440, 640], [480, 610], [540, 600], [600, 590], [660, 590], [700, 580], [740, 540], [760, 500], [760, 480]]) { B2.send({ t: 'mv', x, y, d: 1 }); await sleep(130); }
  A.msgs = []; B2.send({ t: 'act', a: { type: 'light', obj: 'sw_living' } });
  const lt = await A.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'light'));
  ok(lt && lt.s.lights.living === false, 'B 關掉客廳的燈 → A 同步看到燈關了');
  /* v9 小遊戲：開始 → 隊友看到「分析中」→ 分數由伺服器檢查並決定品質 */
  A.msgs = []; B2.send({ t: 'act', a: { type: 'use', obj: 'w_statue', act: 'prints' } }); ok(!!(await B2.wait(m => m.t === 'err' && /小遊戲/.test(m.msg))), '沒玩小遊戲不能直接拿結果');
  B2.send({ t: 'act', a: { type: 'mgStart', obj: 'w_statue', act: 'prints' } });
  const mgs = await A.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'mg'));
  ok(mgs && mgs.s.players[1].mg && mgs.s.players[1].mg.kind === 'prints', 'B 開始刷指紋小遊戲 → A 看到 B 正在分析');
  await sleep(400); B2.msgs = []; B2.send({ t: 'act', a: { type: 'use', obj: 'w_statue', act: 'prints', score: 7 } }); ok(!!(await B2.wait(m => m.t === 'err' && /分數/.test(m.msg))), '分數超出範圍被拒絕');
  A.msgs = []; B2.send({ t: 'act', a: { type: 'use', obj: 'w_statue', act: 'prints', score: 0.9 } });
  const mgu = await A.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'use'));
  const ue = mgu && mgu.ev.find(e => e.k === 'use');
  ok(ue && ue.q === 'good' && ue.score === 0.9 && !mgu.s.players[1].mg && mgu.s.players[1].samples.length === 1 && mgu.s.players[1].samples[0].q === 'good', '分數 0.9 → 伺服器判定品質「好」、樣本帶著品質');
  A.msgs = []; A.send({ t: 'act', a: { type: 'use', obj: 'body', act: 'wound' } });
  ok(((await A.wait(m => m.t === 'err')) || {}).msg === '距離太遠，走近一點', '伺服器檢查距離');
  A.send({ t: 'act', a: { type: 'gear', tools: ['camera', 'camera', 'x', 'luminol', 'prints', 'swab'] } });
  ok(!!(await A.wait(m => m.t === 'err' && /最多/.test(m.msg))), '超過 3 件工具被拒絕');
  B2.msgs = []; B2.send({ t: 'act', a: { type: 'close' } }); ok(!!(await B2.wait(m => m.t === 'err' && /房主/.test(m.msg))), '只有房主能提早結案');
  /* 聊天 */
  B2.msgs = []; A.send({ t: 'chat', text: '<b>我去車上</b>' }); const ch = await B2.wait(m => m.t === 'chat');
  ok(ch && ch.slot === 0 && ch.name === '百九', '文字聊天轉送（' + (ch && ch.text) + '）');
  /* 語音信令 */
  A.send({ t: 'rtc', to: 1, vid: 'x', d: { type: 'offer', sdp: 'v=0' } }); await sleep(150);
  ok(!B2.msgs.some(m => m.t === 'rtc'), '沒加入語音不能送信令');
  A.send({ t: 'vjoin' }); B2.send({ t: 'vjoin' });
  const rv = await A.wait(m => m.t === 'room' && m.room.players[1] && m.room.players[1].voice && m.room.players[0].voice);
  A.send({ t: 'rtc', to: 1, vid: rv.room.players[1].voice.id, d: { type: 'offer', sdp: 'v=0 test' } });
  const sig = await B2.wait(m => m.t === 'rtc'); ok(sig && sig.from === 0 && sig.d.sdp === 'v=0 test', '語音信令只轉送給語音中的隊友');
  /* 壓力系統（TIME_SCALE=30 加速） */
  const pe = await A.wait(m => m.t === 'state' && m.ev.some(e => ['decay', 'rookie', 'boss_in', 'tampered'].includes(e.k)), 12000);
  ok(!!pe, '伺服器會推進壓力系統（' + (pe ? pe.ev.map(e => e.k).join(',') : '無') + '）');
  const bi = await A.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'boss_in'), 12000);
  ok(bi && bi.s.boss.mode === 'in' && bi.s.boss.demand, '分局長進封鎖線，要求同步給所有人（' + (bi ? JSON.stringify(bi.s.boss.demand) : '無') + '）');
  /* 斷線重連拿回狀態 */
  await B2.close(); await sleep(150);
  const B3 = await client(); B3.send({ t: 'join', code, token: jb.token }); const jb3 = await joined(B3);
  const s3 = await B3.wait(m => m.t === 'state');
  ok(jb3.t === 'joined' && jb3.slot === 1 && s3 && s3.s.seed === sa.s.seed, '調查中斷線 → 用 token 重連拿回同一局');
  const Y = await client(); Y.send({ t: 'join', code, name: 'Y' }); ok(((await joined(Y)) || {}).code === 'playing', '調查中不能用新身分加入');
  /* 離隊 */
  A.msgs = []; B3.send({ t: 'leave' }); const sl = await A.wait(m => m.t === 'state' && m.ev.some(e => e.k === 'left'));
  ok(sl && !sl.s.players[1].active && sl.s.phase === 'play', '隊友離隊 → 其他人繼續調查');
  /* 推理 → 結果 */
  A.send({ t: 'act', a: { type: 'close' } }); await A.wait(m => m.t === 'state' && m.s.phase === 'deduce');
  const Cg = require('../docs/casegen.js').generate(sa.s.seed, sa.s.diff);
  for (const [field, v] of [['culprit', Cg.suspects[0].id], ['method', 'blunt'], ['weapon', 'statue'], ['location', 'living']]) A.send({ t: 'act', a: { type: 'draft', field, v } });
  A.msgs = []; A.send({ t: 'act', a: { type: 'submit' } }); const res = await A.wait(m => m.t === 'state' && m.s.phase === 'result'); if (!res) console.log(A.msgs.filter(m => m.t === 'err'));
  ok(res && res.s.result && typeof res.s.result.total === 'number', '送出推理 → 結案報告 ' + (res && res.s.result.rank));
  A.send({ t: 'again' }); ok(!!(await A.wait(m => m.t === 'lobby')), '房主回房間開新案件');
  /* 亂七八糟的訊息 */
  A.send('not json'); A.send('[]'); A.send({ t: 'act', a: { type: 'use', obj: { x: 1 }, act: null } }); A.send({ t: 'mv', x: 'NaN' }); A.send({ t: 'rtc', to: 'x' }); A.send({ t: 'chat', text: 'x'.repeat(5000) });
  await sleep(200); A.msgs = []; A.send({ t: 'ping' }); ok(!!(await A.wait(m => m.t === 'pong')), '亂傳訊息伺服器不會壞');
  /* 解散 */
  const Z = await client(); Z.send({ t: 'join', code, name: 'Z' }); await joined(Z);
  A.send({ t: 'dissolve' }); ok(!!(await Z.wait(m => m.t === 'dissolved')), '房主解散 → 成員收到通知');
  /* 猜房號限制 */
  const G = await client(); let slow = false;
  for (let i = 0; i < 14; i++) { G.send({ t: 'join', code: String(1000 + i) }); const r = await G.next(m => m.t === 'err'); if (r && r.code === 'slow') { slow = true; break; } }
  ok(slow, '一直猜房號會被限制');
  for (const c of [A, B3, Y, Z, G]) try { c.ws.close(); } catch (e) { }
  srv.kill(); if (srvErr.trim()) console.log('伺服器錯誤輸出：', srvErr.slice(0, 500));
  console.log(fail ? `\n${fail} 項失敗` : `\n全部通過（${okN} 項）`); process.exit(fail || srvErr.includes('handle error') ? 1 : 0);
})().catch(e => { console.error(e); srv.kill(); process.exit(1); });
