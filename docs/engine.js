/* 鑑識現場 — 規則引擎（前端單機與伺服器共用；伺服器權威）
   C ＝ casegen.generate(seed, diff) 產生的案件。st ＝ 遊戲狀態（純 JSON，可整包同步）。
   行動點數：全隊總額依人數平分給每位隊員，各自扣自己的。
   壓力系統（tick）：證據劣化、混在關係人裡的兇手（動證物／逃跑／恐嚇落單隊員）、分局長時限、菜鳥員警闖入。 */
(function (root) {
'use strict';
const SPEED = 270, NPC_SPEED = 75, FLEE_SPEED = 105, CHASE_SPEED = 170, ROOKIE_SPEED = 80, COP_SPEED = 55, BOSS_SPEED = 70;
const NEVER = 1e9;
const REACH = 40;
/* ---------- 地圖 ---------- */
function walkRects(C) {
  if (C._walk) return C._walk;
  const M = C.map, W = M.wall, rs = [];
  for (const r of M.rooms) rs.push(r.out ? { x: r.x + 10, y: r.y + 30, w: r.w - 20, h: r.h - 46 } : { x: r.x + 16, y: r.y + W, w: r.w - 32, h: r.h - W - 16 });
  for (const d of M.doors) rs.push(d);
  C._walk = rs; return rs;
}
const inR = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
function walkable(C, x, y) { if (!Number.isFinite(x) || !Number.isFinite(y)) return false; if (!walkRects(C).some(r => inR(x, y, r))) return false; return !C.map.solids.some(s => inR(x, y, s)); }
function roomAt(C, x, y) { const r = C.map.rooms.find(r => inR(x, y, r)); return r ? r.id : null; }
function moveTo(C, x, y, nx, ny) { if (walkable(C, nx, ny)) return [nx, ny]; if (walkable(C, nx, y)) return [nx, y]; if (walkable(C, x, ny)) return [x, ny]; return [x, y]; }
// 格子 BFS 找路（20px 格），回傳路點；goal(x,y) 判斷是否到達
const GS = 20;
function grid(C) {
  if (C._grid) return C._grid;
  const W = Math.ceil(C.map.w / GS), H = Math.ceil(C.map.h / GS), g = new Uint8Array(W * H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) g[j * W + i] = walkable(C, i * GS + GS / 2, j * GS + GS / 2) ? 1 : 0;
  return (C._grid = { W, H, g });
}
function los(C, a, b) { const d = Math.hypot(b.x - a.x, b.y - a.y), n = Math.ceil(d / 8); for (let i = 1; i <= n; i++) { const t = i / n; if (!walkable(C, a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t)) return false; } return true; }
function findPath(C, sx, sy, tx, ty, goalR) {
  const { W, H, g } = grid(C); const ci = (x, y) => Math.max(0, Math.min(W - 1, Math.floor(x / GS))) + Math.max(0, Math.min(H - 1, Math.floor(y / GS))) * W;
  const s = ci(sx, sy); const R = goalR || 12; const prev = new Int32Array(W * H).fill(-1); const q = [s]; prev[s] = s; let end = -1;
  let best = -1, bestD = 1e9;
  for (let h = 0; h < q.length; h++) {
    const c = q[h], x = (c % W) * GS + GS / 2, y = Math.floor(c / W) * GS + GS / 2, d = Math.hypot(x - tx, y - ty);
    if (d <= Math.max(R, GS)) { end = c; break; }
    if (d < bestD) { bestD = d; best = c; }
    const cx = c % W, cy = (c - cx) / W;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue; const n = ny * W + nx;
      if (prev[n] >= 0 || !g[n]) continue; if (dx && dy && (!g[cy * W + nx] || !g[ny * W + cx])) continue;
      prev[n] = c; q.push(n);
    }
  }
  if (end < 0) end = best; if (end < 0) return null;
  const pts = []; for (let c = end; c !== s; c = prev[c]) pts.push({ x: (c % W) * GS + GS / 2, y: Math.floor(c / W) * GS + GS / 2 });
  pts.reverse(); if (Math.hypot(tx - (pts.length ? pts[pts.length - 1].x : sx), ty - (pts.length ? pts[pts.length - 1].y : sy)) < R + GS && walkable(C, tx, ty)) pts.push({ x: tx, y: ty });
  // 視線平滑
  const out = []; let cur = { x: sx, y: sy }, i = 0;
  while (i < pts.length) { let j = pts.length - 1; while (j > i && !los(C, cur, pts[j])) j--; out.push(pts[j]); cur = pts[j]; i = j + 1; }
  return out;
}
const objById = (C, id) => C.objects.find(o => o.id === id);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
function near(C, p, o) { return dist(p, o) <= (o.r || (o.van ? C.van.r : 100)) + REACH; }
function nearVan(C, p) { return dist(p, C.van) <= C.van.r + REACH || dist(p, objById(C, 'courier')) <= 120 + REACH; }

/* ---------- 亂數（存在 st 裡，伺服器可重現） ---------- */
function rnd(st) { let a = st.rs | 0; a = a + 0x6D2B79F5 | 0; st.rs = a; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }

function newGame(C, players, opts) {
  opts = opts || {};
  const st = { budget: C.labBudget, budgetMax: C.labBudget, costUp: 0, patience: 100, seed: C.seed, diff: C.diff, phase: 'play', spent: 0, seq: 0, sid: 0, clock: 0, rs: (C.seed * 7919 + 13) | 0, pressure: opts.pressure !== false,
    players: {}, obj: {}, found: [], labs: [], draft: { culprit: null, method: null, weapon: null, location: null, keys: [] }, result: null,
    flags: {}, ms: {}, labExtra: 0, analyzed: 0, npcs: [], fled: null, threats: 0, news: [], tut: !!opts.tut,
    rep: { print: 0, blood: 0, shoe: 0, lab: 0 }, lights: {}, bossOk: 0, bossFail: 0, cops: [], boss: null, forceBoss: null, forceRookie: null, chase: null };
  players.forEach((p, i) => {
    const s = C.start[i % C.start.length];
    st.players[p.pid] = { pid: p.pid, name: p.name, ci: p.ci, lum: 0, tools: [], loaded: false, bag: [], samples: [], x: s.x, y: s.y, dir: 1, active: true, benchUntil: 0, mg: null };
  });
  for (const o of C.objects) st.obj[o.id] = { done: {}, gone: false, revealed: [], courier: false, f: {}, marked: false, q: {}, got: {}, tries: {}, score: {} };
  for (const k of C.switches || []) st.lights[k] = true;
  st.npcs = C.npcStart.map(s => ({ id: s.id, x: s.x, y: s.y, hx: s.x, hy: s.y, mode: 'idle', path: null, wait: 3 + rnd(st) * 6, tgt: null, held: false }));
  st.tamperAt = C.pressure.tamperEvery * (0.8 + rnd(st) * 0.5);
  st.curiousAt = 90 + rnd(st) * 90;
  // 封鎖線內的員警：其中 C.rookies 位是菜鳥（外表一樣，動手時才會現形）
  st.cops = (C.cops || []).map(c => ({ id: c.id, x: c.posts[0].x, y: c.posts[0].y, leg: 0, mode: 'post', wait: 2 + rnd(st) * 8, path: null, rk: false, known: false, nextAt: NEVER, tgt: null }));
  const order = st.cops.map((c, i) => [rnd(st), i]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
  order.slice(0, C.rookies || 0).forEach((i, k) => { const c = st.cops[i]; c.rk = true; c.nextAt = C.pressure.rookieEvery * (0.7 + rnd(st) * 0.6 + k * 0.5); });
  const home = objById(C, 'chief') || { x: 90, y: 700 };
  st.boss = { mode: 'away', x: home.x, y: home.y, path: null, wait: 0, demand: null, until: 0, t0: 0, nextAt: C.pressure.bossFirst || NEVER };
  return st;
}
const hasEv = (st, id) => st.found.some(f => f.id === id);
function addEv(C, st, ids, by, out, q, sc) { for (const id of ids) { if (!id || hasEv(st, id)) continue; const f = { id, by, n: st.found.length ? Math.max(...st.found.map(x => x.n)) + 1 : 1, t: Math.round(st.clock) }; if (q) { f.q = q; f.sc = sc; } st.found.push(f); out.push({ k: 'found', id, by, q: q || null }); } }
/* ---------- v9 小遊戲：表現 → 結果品質（伺服器依分數決定，結果是決定性的） ---------- */
const MG_GOOD = 0.7, MG_FAIR = 0.4, MG_TRIES = 2;
const QN = { good: '好', fair: '普通', poor: '差' };
function qOf(C, score, cap) { if (C.mgEasy) return 'good'; let q = score >= MG_GOOD ? 'good' : score >= MG_FAIR ? 'fair' : 'poor'; if (cap === 'fair' && q === 'good') q = 'fair'; return q; }
// 已經做過、但品質不夠好 → 可以重做一次（代價：時間；魯米諾要再用一次、指紋／鞋印最多只能到「普通」）
function canRedo(C, s, x) { return !!(x.mg && s.done[x.id] && s.q && s.q[x.id] && s.q[x.id] !== 'good' && (s.tries[x.id] || 1) < MG_TRIES && !C.mgEasy); }
function useCheck(C, st, p, o, s, x0) {
  if (s.done[x0.id] && !canRedo(C, s, x0)) return '已經做過了';
  if (x0.need && !s.done[x0.need]) return '要先完成前一步';
  if (x0.tool && !p.tools.includes(x0.tool)) return '你沒有帶這件工具';
  if (x0.dark && isLit(C, st, o)) return '燈太亮了，看不到螢光：先關掉這個房間的燈';
  if ((x0.tool === 'luminol' || (x0.dark && s.done[x0.id])) && p.lum <= 0) return '魯米諾用完了：回鑑識車補充';
  return null;
}
// 唯一要省的資源：全隊共用的實驗室額度（送大型／硬證物去實驗室）
const labCostOf = (C, st, base) => base + (st.costUp || 0);
function pay(st, cost) { if (st.budget < cost) return false; st.budget -= cost; st.spent += cost; return true; }
function checkEnd() { }
function err(msg) { return { ok: false, err: msg, ev: [] }; }
// 條件分支：證據劣化（全域旗標）、被兇手擦拭、被菜鳥污染
function resolve(st, s, x) { for (const c of x.cond || []) if ((c.after && st.flags[c.after]) || (c.flag && s.f[c.flag])) return Object.assign({}, x, c); return x; }
function options(C, st, pid, oid) {
  const p = st.players[pid], o = objById(C, oid), s = st.obj[oid]; if (!p || !o || !s || s.gone || o.deco || o.van) return [];
  const res = [];
  if (o.sw) return [{ kind: 'light', id: 'light', label: st.lights[o.sw] === false ? '開燈' : '關燈', ap: 0, emoji: '💡', why: '' }];
  for (const a of o.acts || []) {
    const tool = C.tools.find(t => t.id === a.tool); let why = '';
    if (canRedo(C, s, a)) { const w2 = useCheck(C, st, p, o, s, a); res.push({ kind: 'use', id: a.id, label: '重做：' + a.label, tool: a.tool, emoji: '🔁', why: w2 || '', redo: true, mg: a.mg, q: s.q[a.id], uses: a.dark ? p.lum : null }); continue; }
    if (s.done[a.id]) why = '已完成'; else if (a.need && !s.done[a.need]) why = '要先完成前一步';
    else if (a.tool && !p.tools.includes(a.tool)) why = '沒帶' + tool.name; else if (a.dark && isLit(C, st, o)) why = '要先關燈才看得到螢光'; else if (a.tool === 'luminol' && p.lum <= 0) why = '魯米諾用完了（回車上補充）';
    res.push({ kind: 'use', id: a.id, label: a.label, tool: a.tool, emoji: tool && tool.emoji, why, uses: a.tool === 'luminol' ? p.lum : null, mg: a.mg || null, q: s.q && s.q[a.id] || null });
  }
  if (o.bag) { const used = p.bag.reduce((t, b) => t + b.size, 0); res.push({ kind: 'bag', id: 'bag', label: o.bag.label, emoji: '🛍️', size: o.bag.size, why: used + o.bag.size > C.bagSlots ? '證物袋滿了' : '' }); }
  if (o.courier) { const cost = labCostOf(C, st, o.courier.ap); res.push({ kind: 'courier', id: 'courier', label: o.courier.label, cost, emoji: '🛵', why: s.courier ? '已送驗' : st.budget < cost ? '實驗室額度不夠' : '' }); }
  if (res.length && p.benchUntil > st.clock) res.forEach(x => { if (!x.why) x.why = '你被叫去寫報告了'; });
  if (res.length && p.mg) res.forEach(x => { if (!x.why) x.why = '你正在做分析'; });
  return res;
}
function isLit(C, st, o) { return st.lights[o.room] !== false; }
function labPush(C, st, o, res, label, by, cost, out) {
  st.labs.push({ obj: o, label, res, by, sent: st.clock, due: st.clock + C.labSec, back: false });
}
function act(C, st, pid, a) {
  const p = st.players[pid]; if (!p || !a || typeof a !== 'object') return err('沒有這位玩家');
  const out = [];
  if (a.type === 'draft') {
    if (st.phase !== 'deduce') return err('還沒到推理階段');
    const D = st.draft, ok = (list, v) => v === null || list.some(s => s.id === v);
    if (a.field === 'culprit' && ok(C.suspects, a.v)) D.culprit = a.v;
    else if (a.field === 'method' && ok(C.methods, a.v)) D.method = a.v;
    else if (a.field === 'weapon' && ok(C.weapons, a.v)) D.weapon = a.v;
    else if (a.field === 'location' && ok(C.locations, a.v)) D.location = a.v;
    else if (a.field === 'keys' && Array.isArray(a.v)) D.keys = [...new Set(a.v.filter(id => typeof id === 'string' && hasEv(st, id)))].slice(0, 3);
    else return err('欄位不正確');
    st.seq++; return { ok: true, ev: [{ k: 'draft', by: pid }] };
  }
  if (a.type === 'submit') {
    if (st.phase !== 'deduce') return err('還沒到推理階段');
    const D = st.draft; if (!D.culprit || !D.method || !D.weapon || !D.location) return err('兇手、行兇方式、兇器、第一現場都要填');
    st.result = grade(C, st); st.phase = 'result'; st.seq++;
    return { ok: true, ev: [{ k: 'phase', phase: 'result' }] };
  }
  if (a.type === 'close') { if (st.phase !== 'play') return err('已經在推理了'); st.phase = 'deduce'; st.seq++; return { ok: true, ev: [{ k: 'phase', phase: 'deduce', why: 'close', by: pid }] }; }
  if (st.phase !== 'play') return err('調查已經結束');
  if (!p.active) return err('你已經離隊');
  if (p.benchUntil > st.clock && a.type !== 'light' && a.type !== 'callcops') return err(`你被分局長叫去車上寫報告，約 ${Math.ceil(p.benchUntil - st.clock)} 秒後回來`);
  if (a.type === 'callcops') {
    const n = runner(st); if (!n) return err('現在沒有人想溜走');
    if (!canCallCops(st)) return err('人手夠，自己去攔他（走過去碰他）');
    if (st.chase) return err('員警已經去追了');
    const pool = (st.cops || []).filter(c => c.mode !== 'in'), list = pool.length ? pool : (st.cops || []);
    const c = list.slice().sort((a1, b1) => (a1.rk - b1.rk) || dist(a1, n) - dist(b1, n))[0]; if (!c) return err('附近沒有員警');
    c.mode = 'chase'; c.tgt = n.id; c.repath = 0; st.chase = { cop: c.id, npc: n.id, by: pid };
    const D = (C.cops || []).find(x => x.id === c.id);
    out.push({ k: 'callcops', by: pid, cop: c.id, npc: n.id, name: D ? D.name : '員警' }); st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'mgCancel') { if (!p.mg) return { ok: true, ev: [] }; p.mg = null; out.push({ k: 'mgEnd', by: pid, cancel: true }); st.seq++; return { ok: true, ev: out }; }
  if (a.type === 'mgStart') {
    const o = objById(C, a.obj), s = st.obj[a.obj]; if (!o || !s || o.deco || o.van) return err('沒有這個物件');
    if (s.gone) return err('這個證物已經被帶走了'); if (!near(C, p, o)) return err('距離太遠，走近一點');
    const x0 = (o.acts || []).find(q => q.id === a.act); if (!x0 || !x0.mg) return err('這個不用小遊戲');
    const e = useCheck(C, st, p, o, s, x0); if (e) return err(e);
    p.mg = { obj: o.id, act: x0.id, kind: x0.mg, t0: st.clock, redo: !!s.done[x0.id] };
    out.push({ k: 'mg', by: pid, obj: o.id, act: x0.id, kind: x0.mg, redo: p.mg.redo, specks: x0.specks || 0 }); st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'refill') { if (!nearVan(C, p)) return err('要回到鑑識車旁才能補充'); if (!p.tools.includes('luminol')) return err('你沒帶魯米諾'); p.lum = C.lumCharges; out.push({ k: 'refill', by: pid }); st.seq++; return { ok: true, ev: out }; }
  if (a.type === 'gear') {
    if (!nearVan(C, p)) return err('要回到鑑識車旁才能換裝備');
    const tools = Array.isArray(a.tools) ? [...new Set(a.tools)].filter(t => C.tools.some(x => x.id === t)) : null;
    if (!tools || tools.length > C.carryTools) return err(`最多帶 ${C.carryTools} 件工具`);
    if (tools.length === p.tools.length && tools.every(t => p.tools.includes(t))) return { ok: true, ev: [] };
    p.tools = tools; p.loaded = true; p.lum = tools.includes('luminol') ? C.lumCharges : 0; out.push({ k: 'gear', by: pid, tools });
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'light') {
    const o = objById(C, a.obj); if (!o || !o.sw) return err('這裡沒有電燈開關');
    if (!near(C, p, o)) return err('距離太遠，走近一點');
    st.lights[o.sw] = st.lights[o.sw] === false; out.push({ k: 'light', by: pid, room: o.sw, on: st.lights[o.sw] });
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'use' || a.type === 'bag' || a.type === 'courier') {
    const o = objById(C, a.obj), s = st.obj[a.obj];
    if (!o || !s || o.deco || o.van) return err('沒有這個物件');
    if (s.gone) return err('這個證物已經被帶走了');
    if (!near(C, p, o)) return err('距離太遠，走近一點');
    if (a.type === 'use') {
      const x0 = (o.acts || []).find(q => q.id === a.act); if (!x0) return err('不能這樣做');
      const e0 = useCheck(C, st, p, o, s, x0); if (e0) return err(e0);
      let q = null, sc = null; const redo = !!s.done[x0.id];
      if (x0.mg) {   // 小遊戲：前端算分數送上來，伺服器檢查範圍與時間，決定品質
        if (!p.mg || p.mg.obj !== o.id || p.mg.act !== x0.id) return err('要先完成小遊戲');
        if (st.clock - p.mg.t0 < C.mgMin - 0.05) return err('太快了，再仔細一點');
        sc = Number(a.score); if (!Number.isFinite(sc) || sc < 0 || sc > 1) return err('分數不正確');
        sc = Math.round(sc * 100) / 100; p.mg = null;
        q = qOf(C, sc, redo && (x0.tool === 'prints' || x0.tool === 'shoe') ? 'fair' : null);
      }
      if (redo) {   // 重做：舊結果作廢，換成新的
        const old = s.got[x0.id] || []; st.found = st.found.filter(f => !old.includes(f.id));
        for (const q2 of Object.values(st.players)) q2.samples = q2.samples.filter(m => !(m.src === o.id && m.act === x0.id));
        s.tries[x0.id] = (s.tries[x0.id] || 1) + 1;
        if (x0.dark) p.lum--;
      } else if (x0.tool === 'luminol') p.lum--;
      let x = resolve(st, s, x0);
      if (x === x0 && q && x0.q && x0.q[q]) x = Object.assign({}, x0, x0.q[q]);
      if (x0.dark) s.marked = true;
      s.done[x0.id] = 'p' + pid; if (x.reveal && !s.revealed.includes(x.reveal)) s.revealed.push(x.reveal);
      if (q) { s.q[x0.id] = q; s.score[x0.id] = sc; }
      s.got[x0.id] = (x.ev || []).concat(x.sample ? [x.sample.res] : []);
      out.push({ k: 'use', by: pid, obj: o.id, act: x0.id, label: x0.label, reveal: x.reveal || null, tool: x0.tool || null, dark: !!x0.dark, lit: isLit(C, st, o), q, score: sc, redo });
      if (x0.mg) out.push({ k: 'mgEnd', by: pid });
      if (x.ev) addEv(C, st, x.ev, pid, out, q, sc);
      if (x.sample) { const sm = { sid: ++st.sid, kind: x.sample.kind, label: x.sample.label, res: x.sample.res, lab: x.sample.lab || null, src: o.id, act: x0.id, q, sc }; p.samples.push(sm); out.push({ k: 'sample', by: pid, label: sm.label, kind: sm.kind, q, lab: !!sm.lab }); }
    } else if (a.type === 'bag') {
      if (!o.bag) return err('這個不能裝袋');
      if (p.bag.reduce((t, b) => t + b.size, 0) + o.bag.size > C.bagSlots) return err('證物袋滿了，先回車上送驗');
      const lc = (o.bag.labCond || []).find(c => s.f[c.flag]);
      s.gone = true; p.bag.push({ obj: o.id, name: o.name, size: o.bag.size, img: o.img, res: lc ? lc.res : o.bag.lab });
      out.push({ k: 'bag', by: pid, obj: o.id, name: o.name });
    } else {
      if (!o.courier) return err('這個不能請快遞員取件'); if (s.courier) return err('已經送驗了');
      const cost = labCostOf(C, st, o.courier.ap); if (!pay(st, cost)) return err('實驗室額度不夠了');
      s.courier = true; if (o.bag) s.gone = true;
      labPush(C, st, o.id, o.courier.res, o.name, pid, cost, out);
      out.push({ k: 'lab_sent', by: pid, obj: o.id, name: o.name, cost });
    }
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'analyze' || a.type === 'slab') {
    if (!nearVan(C, p)) return err('要在鑑識車旁才能做');
    const i = p.samples.findIndex(s => s.sid === a.sid); if (i < 0) return err('沒有這個樣本');
    const sm = p.samples[i];
    if (a.type === 'analyze') {
      const m = C.machines.find(q => q.kind === sm.kind);
      p.samples.splice(i, 1); st.analyzed++; st.rep[sm.kind] = (st.rep[sm.kind] || 0) + 1;
      out.push({ k: 'analyze', by: pid, machine: m.id, label: sm.label, res: sm.res, src: sm.src, q: sm.q || null });
      addEv(C, st, [sm.res], pid, out, sm.q, sm.sc);
    } else {
      if (!sm.lab) return err('這個樣本不用送實驗室'); const cost = labCostOf(C, st, C.sampleLabAP); if (!pay(st, cost)) return err('實驗室額度不夠了');
      p.samples.splice(i, 1); labPush(C, st, sm.src, sm.lab, sm.label, pid, cost, out);
      out.push({ k: 'lab_sent', by: pid, obj: sm.src, name: sm.label, cost });
    }
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'lab') {
    if (!nearVan(C, p)) return err('要把證物拿到車旁交給快遞員');
    const i = p.bag.findIndex(b => b.obj === a.obj); if (i < 0) return err('證物袋裡沒有這個');
    const b = p.bag[i], cost = labCostOf(C, st, C.labCost[b.size] || 3); if (!pay(st, cost)) return err('實驗室額度不夠了');
    p.bag.splice(i, 1); labPush(C, st, b.obj, b.res, b.name, pid, cost, out);
    out.push({ k: 'lab_sent', by: pid, obj: b.obj, name: b.name, cost });
    st.seq++; return { ok: true, ev: out };
  }
  return err('不明的動作');
}
function leave(C, st, pid) {
  const p = st.players[pid]; if (!p || !p.active) return [];
  p.active = false; p.mg = null; const rest = Object.values(st.players).filter(q => q.active); const out = [{ k: 'left', by: pid }];
  if (rest.length && st.phase === 'play') {
    rest[0].samples.push(...p.samples); p.samples = [];
    for (const b of p.bag) { const s = st.obj[b.obj]; if (s) s.gone = false; } p.bag = [];
  }
  checkEnd(st, out); st.seq++; return out;
}
function move(C, st, pid, x, y, dir, dt) {
  const p = st.players[pid]; if (!p) return false; x = +x; y = +y;
  if (!walkable(C, x, y)) return false;
  if (Math.hypot(x - p.x, y - p.y) > SPEED * Math.min(Math.max(dt, 0.05), 1.5) * 1.6 + 40) return false;
  p.x = Math.round(x); p.y = Math.round(y); p.dir = dir < 0 ? -1 : 1; return true;
}

/* ---------- 壓力系統 ---------- */
const sname = (C, id) => (C.suspects.find(s => s.id === id) || {}).name || '?';
function culpritHeat(C, st) {   // 已經找到幾條指向兇手的證據
  const cu = C.suspects.find(s => s.id === C.culprit);
  return st.found.filter(f => { const e = C.evidence[f.id]; if (!e) return false; const F = e.f || {}; return F.who === C.culprit || (F.trait || []).some(([k, v]) => cu[k] === v); }).length;
}
function walkNpc(C, n, dt, sp) {
  if (!n.path || !n.path.length) return true;
  let left = sp * dt;
  while (left > 0 && n.path.length) { const t = n.path[0], d = Math.hypot(t.x - n.x, t.y - n.y); if (d <= left) { n.x = t.x; n.y = t.y; n.path.shift(); left -= d; } else { n.x += (t.x - n.x) / d * left; n.y += (t.y - n.y) / d * left; left = 0; } }
  n.x = Math.round(n.x * 10) / 10; n.y = Math.round(n.y * 10) / 10;
  return !n.path.length;
}
const actives = st => Object.values(st.players).filter(p => p.active);
// 兇手想溜走前的預警秒數：人越少，預警越長
const warnSec = st => { const n = actives(st).length; return n <= 1 ? 12 : n === 2 ? 9 : 6; };
// 人少（1～2 人）時可以叫員警去攔人；3 人以上維持「自己去碰他」
const canCallCops = st => actives(st).length <= 2;
const runner = st => (st.npcs || []).find(n => n.mode === 'nervous' || n.mode === 'flee');
// 正在玩小遊戲（分析中）的隊員顧不到四周：攔人、趕菜鳥、交差都要靠其他隊員
const watchers = st => actives(st).filter(p => !p.mg);
const anyNear = (st, pt, r) => watchers(st).some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= r);
function tick(C, st, dt) {
  const out = []; if (st.phase !== 'play') return out;
  st.clock += dt; const P = C.pressure, T = st.clock;
  for (const p of Object.values(st.players)) if (p.mg && T - p.mg.t0 > 300) { p.mg = null; out.push({ k: 'mgEnd', by: p.pid, cancel: true }); }
  for (const l of st.labs) if (!l.back && st.clock >= l.due) { l.back = true; st.rep.lab++; addEv(C, st, [l.res], l.by, out); out.push({ k: 'lab_back', id: l.res, label: l.label }); }
  const news = (k, text, extra) => { const e = Object.assign({ k, text }, extra || {}); out.push(e); st.news.push({ t: Math.round(T), text }); if (st.news.length > 30) st.news.shift(); };
  /* (a) 證據劣化 */
  if (st.pressure) {
    if (!st.flags.todWide && T >= P.todWideAt) { st.flags.todWide = true; news('decay', '🌡️ 屍溫已接近室溫：現在量肝溫只能得到不精確的死亡時間'); }
    if (!st.flags.oxidize && T >= P.oxidizeAt) { st.flags.oxidize = true; news('decay', '🩸 血跡開始氧化：之後採的皮屑樣本，車上驗不出血型（實驗室 DNA 仍可）'); }
    if (!st.flags.rain && T >= P.rainAt) { st.flags.rain = true; news('decay', '🌧️ 開始下大雨了：後院的鞋印被沖掉了'); }
  }
  /* (c) 分局長的耐心：慢慢下降；他的要求擺著不理會降得更快；歸零 → 強制結案 */
  if (st.pressure) {
    const B = st.boss, pend = B && B.mode === 'in' && !bossDone(C, st, B.demand);
    st.patience = Math.max(0, st.patience - P.patienceRate * (pend ? 3 : 1) * dt);
    if (!st.flags.pat50 && st.patience <= 50) { st.flags.pat50 = true; news('patience', '🕰️ 夜深了，分局長看了好幾次手錶。'); }
    if (!st.flags.pat20 && st.patience <= 20) { st.flags.pat20 = true; news('patience', '🌅 天快亮了，分局長的耐心快用完了——差不多該結案了。'); }
    if (st.patience <= 0) { st.ms.m3 = 'fail'; news('boss_fail', '🌅 分局長的耐心用完了：「天亮了，現在就結案。」'); st.phase = 'deduce'; out.push({ k: 'phase', phase: 'deduce', why: 'patience' }); return out; }
  }
  /* (c) 分局長巡視（像恐鬼症的鬼：進封鎖線、頭上冒出要求） */
  if (bossTick(C, st, dt, T, news, out)) return out;
  /* (d) 員警與混在其中的菜鳥 */
  copsTick(C, st, dt, T, news, out);
  if (!st.pressure) { checkEnd(st, out); return out; }
  /* (b) 關係人 NPC＋混在其中的兇手 */
  const heat = culpritHeat(C, st);
  for (const n of st.npcs) {
    if (n.mode === 'gone') continue;
    const isC = n.id === C.culprit;
    if (n.mode === 'held') continue;
    if (n.mode === 'nervous') {   // 預警：緊張、慢慢往出口挪；幾秒後才真的跑
      if (anyNear(st, n, 80)) { n.mode = 'held'; n.path = null; addEv(C, st, ['E_held'], null, out); news('held', `🚨 ${sname(C, n.id)} 正想開溜，被你們攔下了！`, { npc: n.id }); continue; }
      walkNpc(C, n, dt, NPC_SPEED * 0.35);
      if (T >= n.fleeAt) { n.mode = 'flee'; n.path = findPath(C, n.x, n.y, C.exit.x, C.exit.y); news('flee', `🏃 ${sname(C, n.id)} 往封鎖線外跑了！${canCallCops(st) ? (st.chase ? '員警正在追。' : '按 E 叫員警攔住他，或自己追上去碰他。') : '快去攔住他！'}`, { npc: n.id }); }
      continue;
    }
    if (n.mode === 'flee') {
      if (anyNear(st, n, 80)) { n.mode = 'held'; n.path = null; addEv(C, st, ['E_held'], null, out); news('held', `🚨 ${sname(C, n.id)} 想偷偷離開封鎖線，被你們攔下了！`, { npc: n.id }); continue; }
      if (walkNpc(C, n, dt, FLEE_SPEED)) { n.mode = 'gone'; st.fled = n.id; news('fled', `🏃 ${sname(C, n.id)} 趁亂離開了現場！（結案時會扣分）`, { npc: n.id }); }
      continue;
    }
    if (n.mode === 'idle') {
      n.wait -= dt;
      if (isC && heat >= 2 && !n.fleeTried) {
        n.fleeTried = true; n.mode = 'nervous'; n.fleeAt = T + warnSec(st);
        const full = findPath(C, n.x, n.y, C.exit.x, C.exit.y) || []; n.path = full.slice(0, Math.max(1, Math.floor(full.length * .4)));
        news('nervous', `😰 ${sname(C, n.id)} 看起來很緊張，一直往出口瞄…${canCallCops(st) ? '（按 E 請員警盯住他，或走過去碰他）' : '（走過去碰他就能攔下）'}`, { npc: n.id }); continue;
      }
      if (isC && T >= st.tamperAt) {
        st.tamperAt = T + P.tamperEvery * (0.7 + rnd(st) * 0.6);
        const cand = C.objects.filter(o => o.tamper && !st.obj[o.id].gone && !st.obj[o.id].f.tampered && !Object.keys(st.obj[o.id].done).includes('prints'));
        if (cand.length) { const o = cand[Math.floor(rnd(st) * cand.length)]; n.mode = 'sneak'; n.tgt = o.id; n.path = findPath(C, n.x, n.y, o.x, o.y + 10, 30); continue; }
      }
      if (!isC && T >= st.curiousAt) {   // 好奇的關係人也會溜進來看（讓兇手不那麼好認）
        st.curiousAt = T + 120 + rnd(st) * 120;
        const spots = [{ x: 600, y: 620 }, { x: 860, y: 520 }, { x: 1100, y: 640 }];
        const s = spots[Math.floor(rnd(st) * spots.length)]; n.mode = 'curious'; n.path = findPath(C, n.x, n.y, s.x, s.y); continue;
      }
      if (n.wait <= 0) { n.wait = 4 + rnd(st) * 8; n.path = findPath(C, n.x, n.y, 40 + rnd(st) * 360, 780 + rnd(st) * 270); n.mode = 'wander'; }
      // (b-2) 恐嚇落單的隊員
      if (isC && heat >= 1 && st.threats < (actives(st).length > 1 ? 2 : 1) && T >= (st.threatAt || 0)) {
        const v = actives(st).find(p => Math.hypot(p.x - n.x, p.y - n.y) < 70 && !actives(st).some(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 350));
        if (v) { st.threats++; st.threatAt = T + 120; addEv(C, st, ['E_threat'], null, out); news('threat', `… ${sname(C, n.id)} 不知什麼時候站到落單的 ${v.name} 身後，低聲說「別多管閒事」。`, { npc: n.id, by: v.pid }); }
      }
      continue;
    }
    if (n.mode === 'wander') { if (walkNpc(C, n, dt, NPC_SPEED * .7)) n.mode = 'idle'; continue; }
    if (n.mode === 'curious') {
      if (anyNear(st, n, 110)) { n.mode = 'back'; n.path = findPath(C, n.x, n.y, n.hx, n.hy); news('shoo', `🙅 ${sname(C, n.id)} 跑進封鎖線想偷看，被請了出去`, { npc: n.id }); continue; }
      if (walkNpc(C, n, dt, NPC_SPEED)) { n.mode = 'back'; n.path = findPath(C, n.x, n.y, n.hx, n.hy); }
      continue;
    }
    if (n.mode === 'sneak') {
      const o = objById(C, n.tgt);
      if (anyNear(st, n, 150)) { n.mode = 'back'; n.path = findPath(C, n.x, n.y, n.hx, n.hy); addEv(C, st, ['E_sneak'], null, out); news('caught', `👀 ${sname(C, n.id)} 鬼鬼祟祟摸到「${o.name}」旁邊，被你們撞見，假裝走錯路離開了`, { npc: n.id }); continue; }
      if (walkNpc(C, n, dt, NPC_SPEED)) {
        const s = st.obj[o.id]; if (!s.gone) { s.f.tampered = true; news('tampered', `⚠️ 有人動過${C.roomName[o.room] || ''}的「${o.name}」！上面的痕跡可能被破壞了`, { obj: o.id }); }
        n.mode = 'back'; n.path = findPath(C, n.x, n.y, n.hx, n.hy);
      }
      continue;
    }
    if (n.mode === 'back') { if (walkNpc(C, n, dt, NPC_SPEED)) { n.mode = 'idle'; n.wait = 3 + rnd(st) * 5; } continue; }
  }
  checkEnd(st, out);
  return out;
}

// 插曲（分局長巡視、菜鳥闖禍）一次只發生一件，結束後至少安靜 QUIET 秒
const QUIET = 75;
function busy(st) { return (st.boss && st.boss.mode !== 'away') || (st.cops || []).some(c => c.mode === 'in') || st.clock < (st.quietUntil || 0); }
const ROAM = [{ x: 600, y: 700 }, { x: 800, y: 700 }, { x: 1180, y: 720 }, { x: 1340, y: 620 }, { x: 1580, y: 620 }, { x: 820, y: 1040 }, { x: 1540, y: 880 }, { x: 1440, y: 1000 }];
const repName = (C, k) => ((C.reports || {})[k] || {}).t || k;
function demandText(C, d) { return !d ? '' : d.kind === 'progress' ? `案情進度要到 ${d.pct}%` : `交出「${repName(C, d.rep)}」報告`; }
function bossDone(C, st, d) {
  if (!d) return false;
  if (d.kind === 'progress') return progress(C, st) >= d.pct;
  if (d.rep === 'wound') return hasEv(st, 'E_wound') || hasEv(st, 'E_wound_p');
  if (d.rep === 'tod') return ['E_tod', 'E_tod_wide', 'E_tod_f', 'E_tod_p'].some(id => hasEv(st, id));
  return (st.rep[d.rep] || 0) > 0;
}
function pickDemand(C, st) {
  const cands = ['wound', 'tod', 'print', 'blood', 'lab'].filter(k => !bossDone(C, st, { kind: 'report', rep: k }) && (k !== 'lab' || st.labs.some(l => !l.back)));
  const first = st.bossOk + st.bossFail === 0, prog = progress(C, st);
  let pool = first ? cands.filter(k => k === 'wound' || k === 'tod') : cands;
  if (!pool.length) pool = cands;
  if (!pool.length || (!first && prog < 85 && rnd(st) < 0.35)) return { kind: 'progress', pct: Math.min(100, Math.ceil((prog + 20) / 10) * 10) };
  return { kind: 'report', rep: pool[Math.floor(rnd(st) * pool.length)] };
}
function bossRoam(C, B, st) { const t = ROAM[Math.floor(rnd(st) * ROAM.length)]; B.path = findPath(C, B.x, B.y, t.x, t.y) || []; B.wait = 3 + rnd(st) * 4; }
function bossTick(C, st, dt, T, news, out) {
  const B = st.boss, P = C.pressure; if (!B) return false;
  const home = objById(C, 'chief') || { x: 90, y: 700 };
  if (B.mode === 'away') {
    if (st.forceBoss || (st.pressure && T >= B.nextAt && !busy(st))) {
      const d = st.forceBoss && typeof st.forceBoss === 'object' ? Object.assign({}, st.forceBoss) : pickDemand(C, st); st.forceBoss = null;
      B.demand = d; B.mode = 'in'; B.t0 = T; B.until = T + (d.wait || P.bossWait); bossRoam(C, B, st);
      news('boss_in', `👔 分局長鄭督察走進封鎖線：「${demandText(C, d)}」做完後去碰他交差！`, { demand: d });
    }
  } else if (B.mode === 'in') {
    if (bossDone(C, st, B.demand) && anyNear(st, B, 80)) {
      st.bossOk++; st.budget += 2; st.budgetMax += 2; st.patience = Math.min(100, st.patience + 8);
      news('boss_ok', `✅ 分局長收下了「${demandText(C, B.demand).replace(/^交出/, '')}」：「嗯，繼續。」——實驗室額度 +2，耐心回升`, { demand: B.demand });
      B.mode = 'leave'; B.path = findPath(C, B.x, B.y, home.x, home.y) || []; B.nextAt = T + P.bossEvery;
    } else if (T >= B.until && !st.tut) {
      st.bossFail++; const d = B.demand;
      B.mode = 'leave'; B.path = findPath(C, B.x, B.y, home.x, home.y) || []; B.nextAt = T + P.bossEvery;
      st.patience = Math.max(0, st.patience - 12);
      const act = actives(st);
      if (st.bossFail % 2 === 1) { st.costUp++; news('boss_fail', `分局長沒等到「${demandText(C, d).replace(/^交出/, '')}」，搖搖頭走了。之後每次送實驗室多花 1 點額度，耐心也降了一截。`); }
      else if (act.length > 1) { const v = act[Math.floor(rnd(st) * act.length)]; v.benchUntil = T + 60; news('boss_fail', `分局長沒等到要求，把 ${v.name} 叫去車上寫報告（約 1 分鐘不能採證）。`, { by: v.pid }); }
      else { st.budget = Math.max(0, st.budget - 2); news('boss_fail', `分局長沒等到要求，刪了 2 點實驗室額度。`); }
    } else if (B.path && B.path.length) walkNpc(C, B, dt, BOSS_SPEED);
    else { B.wait -= dt; if (B.wait <= 0) bossRoam(C, B, st); }
  } else if (B.mode === 'leave') { if (walkNpc(C, B, dt, BOSS_SPEED * 1.2)) { B.mode = 'away'; B.demand = null; st.quietUntil = T + QUIET; } }
  return false;
}
function copsTick(C, st, dt, T, news, out) {
  const P = C.pressure;
  for (const c of st.cops || []) {
    const D = (C.cops || []).find(x => x.id === c.id); if (!D) continue;
    if (c.mode === 'chase') {   // 被叫去攔人的員警：一路追，追上就攔下
      const n = (st.npcs || []).find(x => x.id === c.tgt);
      if (!n || n.mode === 'gone' || n.mode === 'held') { c.mode = 'back'; c.path = findPath(C, c.x, c.y, D.posts[c.leg].x, D.posts[c.leg].y) || []; st.chase = null; continue; }
      if (dist(c, n) < 45) { n.mode = 'held'; n.path = null; addEv(C, st, ['E_held'], null, out); news('held', `🚨 ${D.name}攔下了 ${sname(C, n.id)}：「先別走，配合調查。」`, { npc: n.id, cop: c.id }); c.mode = 'back'; c.path = findPath(C, c.x, c.y, D.posts[c.leg].x, D.posts[c.leg].y) || []; st.chase = null; continue; }
      c.repath -= dt; if (c.repath <= 0 || !c.path || !c.path.length) { c.repath = 0.4; c.path = findPath(C, c.x, c.y, n.x, n.y) || [{ x: n.x, y: n.y }]; }
      walkNpc(C, c, dt, CHASE_SPEED); continue;
    }
    if (c.mode === 'in') {
      if (anyNear(st, c, 80)) { c.mode = 'back'; c.known = true; c.path = findPath(C, c.x, c.y, D.posts[c.leg].x, D.posts[c.leg].y) || []; c.nextAt = T + P.rookieEvery * (0.7 + rnd(st) * 0.6); st.quietUntil = T + QUIET; news('rookie_stop', `✋ ${D.name}被攔下來了：「對不起！我回崗位站好……」`, { cop: c.id }); continue; }
      if (c.delay > 0) { c.delay -= dt; continue; }   // 先東張西望幾秒，給玩家反應時間
      if (walkNpc(C, c, dt, ROOKIE_SPEED)) {
        const o = objById(C, c.tgt), s = st.obj[o.id]; const roll = rnd(st);
        if (st.tut) news('rookie_hit', `😅 ${D.name}差點碰到「${o.name}」——教學關卡這次沒事，下次記得早點攔住他`, { cop: c.id, obj: o.id });
        else {
          const hasCond = (o.acts || []).some(a => (a.cond || []).some(q => q.flag === 'contam') && !s.done[a.id]);
          if (hasCond && roll < .5) { s.f.contam = true; news('rookie_hit', `💥 菜鳥${D.name}伸手摸了「${o.name}」——證物被污染了！`, { obj: o.id, cop: c.id }); }
          else {
            const withTools = actives(st).filter(p => p.tools.length);
            if (roll < .75 && withTools.length) { const v = withTools.sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0]; const t = v.tools.splice(Math.floor(rnd(st) * v.tools.length), 1)[0]; const tn = (C.tools.find(x => x.id === t) || {}).name; news('rookie_hit', `💥 菜鳥${D.name}踢翻了工具箱：${v.name} 的「${tn}」摔壞了，要回車上重新拿`, { by: v.pid, cop: c.id }); }
            else { const v = actives(st).filter(p => p.lum > 0)[0]; if (v) v.lum--; news('rookie_hit', `💥 菜鳥${D.name}撞翻了證物箱${v ? `，${v.name} 的魯米諾灑掉一份` : '，東西散了一地'}`, { by: v && v.pid, cop: c.id }); }
          }
        }
        c.mode = 'back'; c.known = true; c.path = findPath(C, c.x, c.y, D.posts[c.leg].x, D.posts[c.leg].y) || []; c.nextAt = T + P.rookieEvery * (0.7 + rnd(st) * 0.6); st.quietUntil = T + QUIET;
      }
      continue;
    }
    if (c.mode === 'back' || c.mode === 'patrol') { if (walkNpc(C, c, dt, COP_SPEED)) { c.mode = 'post'; c.wait = 5 + rnd(st) * 9; } }
    const forced = st.forceRookie && c.rk;
    if (c.rk && (forced || (st.pressure && T >= c.nextAt && !busy(st))) && c.mode !== 'back') {
      const cand = C.objects.filter(o => !o.deco && !o.van && !st.obj[o.id].gone && C.roomName[o.room] && o.room !== 'street' && (o.acts || []).some(a => !st.obj[o.id].done[a.id]));
      const far = cand.filter(o => Math.hypot(o.x - c.x, o.y - c.y) >= 380), pool = far.length ? far : cand;
      const o = typeof st.forceRookie === 'string' && objById(C, st.forceRookie) ? objById(C, st.forceRookie) : pool[Math.floor(rnd(st) * pool.length)];
      st.forceRookie = null;
      if (o) { c.mode = 'in'; c.delay = st.tut ? 2 : 4; c.tgt = o.id; c.path = findPath(C, c.x, c.y, o.x, o.y + 10, 30) || []; news('rookie', `🚨 ${D.name}是菜鳥！他正走向「${o.name}」要亂碰證物——快去攔住他！`, { cop: c.id, obj: o.id }); continue; }
      c.nextAt = T + P.rookieEvery;
    }
    if (c.mode === 'post') { c.wait -= dt; if (c.wait <= 0) { c.leg ^= 1; const t = D.posts[c.leg]; c.path = findPath(C, c.x, c.y, t.x, t.y) || []; c.mode = 'patrol'; } }
  }
}
function progress(C, st) {
  const d = deduce(C, st), nm = C.methods.length, ns = C.suspects.length;
  const m = d.methods.length ? (nm - d.methods.length) / (nm - 1) : 0, s = d.suspects.length ? (ns - d.suspects.length) / (ns - 1) : 0;
  return Math.round(100 * (m * .35 + s * .35 + (d.weapon ? .15 : 0) + (d.location ? .15 : 0)));
}
/* ---------- 推理：從已找到的證據推出還有哪些可能（筆記本和測試用） ---------- */
// opt.reliable：不採用「樣本品質：差」的結果（筆記本的切換鈕）
function deduce(C, st, ids, opt) {
  ids = ids || st.found.filter(f => !(opt && opt.reliable && f.q === 'poor')).map(f => f.id);
  const facts = ids.map(id => (C.evidence[id] || {}).f || {}).filter(f => !f.decoy);
  const sig = new Set(), neg = new Set(); let who = null, weapon = null, room = null; const negw = new Set(), noroom = new Set(); const traits = [], ranges = [];
  for (const f of facts) { (f.sig || []).forEach(s => sig.add(s)); (f.neg || []).forEach(s => neg.add(s)); if (f.who) who = f.who; if (f.weapon) weapon = f.weapon; if (f.room) room = f.room; if (f.negw) negw.add(f.negw); if (f.noroom) noroom.add(f.noroom); (f.trait || []).forEach(t => traits.push(t)); (f.range || []).forEach(t => ranges.push(t)); }
  const methods = C.methods.filter(m => [...sig].every(s => m.sigs.includes(s)) && ![...neg].some(s => m.sigs.includes(s))).map(m => m.id);
  const suspects = who ? [who] : C.suspects.filter(s => traits.every(([k, v]) => s[k] === v) && ranges.every(([k, lo, hi]) => s[k] >= lo && s[k] <= hi)).map(s => s.id);
  let loc = room;
  if (!loc && weapon && weapon !== 'hearth' && methods.length === 1 && methods[0] !== 'staged') loc = (C.objects.find(o => o.weapon === weapon) || {}).room || null;
  return { sig: [...sig], neg: [...neg], methods, suspects, weapon, location: loc, noroom: [...noroom], negw: [...negw] };
}
function grade(C, st) {
  const D = st.draft, rows = [];
  const add = (key, label, pick, right, pts, list) => { const nm = id => (list.find(x => x.id === id) || {}).t || (list.find(x => x.id === id) || {}).name || '—'; const ok = pick === right; rows.push({ key, label, pick: nm(pick), right: nm(right), ok, pts: ok ? pts : 0, max: pts }); };
  add('culprit', '兇手', D.culprit, C.culprit, 40, C.suspects);
  add('method', '行兇方式', D.method, C.method, 20, C.methods);
  add('weapon', '兇器', D.weapon, C.weapon, 15, C.weapons);
  add('location', '第一現場', D.location, C.location, 10, C.locations);
  const cu = C.suspects.find(s => s.id === C.culprit), msig = C.methods.find(m => m.id === C.method).sigs;
  let kp = 0; const keys = D.keys.map(id => { const f = (C.evidence[id] || {}).f || {}; let v = 0;
    if (f.who === C.culprit) v = 5; else if ((f.trait || []).some(([k, x]) => cu[k] === x)) v = 3; else if ((f.sig || []).some(s => msig.includes(s))) v = 2;
    kp += v; return { id, name: C.evidence[id].name, pts: v }; });
  const pen = st.fled ? -10 : 0;
  const base = rows.reduce((t, r) => t + r.pts, 0) + Math.min(kp, 15);
  const timeB = base >= 50 ? Math.round((st.patience || 0) / 10) : 0, budB = base >= 50 ? Math.round(5 * (st.budget || 0) / Math.max(1, st.budgetMax || 1)) : 0;   // 答得夠好才有效率獎勵
  const bonus = timeB + budB, raw = base + bonus + pen, total = Math.max(0, Math.min(100, raw));
  const rank = total >= 100 ? 'S' : total >= 82 ? 'A' : total >= 60 ? 'B' : total >= 40 ? 'C' : 'D';
  return { rows, keys, keyPts: Math.min(kp, 15), timeB, budB, pen, base, bonus, raw, fled: st.fled, total, rank, found: st.found.length, spent: st.spent, clock: Math.round(st.clock), ms: Object.assign({}, st.ms), bossOk: st.bossOk || 0, bossFail: st.bossFail || 0 };
}
// 平放在地上的物件畫的順序：大塊地毯／地板先畫 → 屍體（壓在地毯上面）→ 小證物（手機、相框等，放在屍體旁也看得到）
function flatOrder(C) {
  const rank = o => o.id === 'body' ? 1 : (o.w * o.h >= 15000 ? 0 : 2);
  return C.objects.filter(o => o.flat).map((o, i) => ({ o, i })).sort((a, b) => rank(a.o) - rank(b.o) || (rank(a.o) === 0 ? b.o.w * b.o.h - a.o.w * a.o.h : 0) || a.i - b.i).map(x => x.o);
}
const FS = { qOf, canRedo, QN, MG_GOOD, MG_FAIR, watchers, SPEED, flatOrder, canCallCops, runner, warnSec, NEVER, isLit, progress, bossDone, demandText, walkable, moveTo, roomAt, near, nearVan, newGame, act, options, leave, move, tick, grade, deduce, hasEv, objById, findPath, walkRects, culpritHeat };
if (typeof module !== 'undefined' && module.exports) module.exports = FS; else root.FS = FS;
})(typeof self !== 'undefined' ? self : this);
