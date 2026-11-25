/* 鑑識現場 — 規則引擎（前端單機與伺服器共用；伺服器權威）
   C ＝ casegen.generate(seed, diff) 產生的案件。st ＝ 遊戲狀態（純 JSON，可整包同步）。
   行動點數：全隊總額依人數平分給每位隊員，各自扣自己的。
   壓力系統（tick）：證據劣化、混在關係人裡的兇手（動證物／逃跑／恐嚇落單隊員）、分局長時限、菜鳥員警闖入。 */
(function (root) {
'use strict';
const SPEED = 270, NPC_SPEED = 75, FLEE_SPEED = 105, ROOKIE_SPEED = 85;
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
  const n = players.length, base = Math.floor(C.teamAP / n), extra = C.teamAP - base * n;
  const st = { seed: C.seed, diff: C.diff, phase: 'play', spent: 0, seq: 0, sid: 0, clock: 0, rs: (C.seed * 7919 + 13) | 0, pressure: opts.pressure !== false,
    players: {}, obj: {}, found: [], labs: [], draft: { culprit: null, method: null, weapon: null, location: null, keys: [] }, result: null,
    flags: {}, ms: {}, labExtra: 0, analyzed: 0, npcs: [], rookie: null, fled: null, threats: 0, news: [] };
  players.forEach((p, i) => {
    const s = C.start[i % C.start.length], ap = base + (i < extra ? 1 : 0);
    st.players[p.pid] = { pid: p.pid, name: p.name, ci: p.ci, ap, apMax: ap, tools: [], loaded: false, bag: [], samples: [], x: s.x, y: s.y, dir: 1, active: true };
  });
  for (const o of C.objects) st.obj[o.id] = { done: {}, gone: false, revealed: [], courier: false, f: {} };
  st.npcs = C.npcStart.map(s => ({ id: s.id, x: s.x, y: s.y, hx: s.x, hy: s.y, mode: 'idle', path: null, wait: 3 + rnd(st) * 6, tgt: null, held: false }));
  st.tamperAt = C.pressure.tamperEvery * (0.6 + rnd(st) * 0.6);
  st.curiousAt = 40 + rnd(st) * 60;
  st.rookieAt = C.pressure.rookieEvery * (0.7 + rnd(st) * 0.6);
  return st;
}
const hasEv = (st, id) => st.found.some(f => f.id === id);
function addEv(C, st, ids, by, out) { for (const id of ids) { if (!id || hasEv(st, id)) continue; st.found.push({ id, by, n: st.found.length + 1, t: Math.round(st.clock) }); out.push({ k: 'found', id, by }); } }
function delay(C, st) { return C.labDelay + (st.labExtra || 0); }
function spend(C, st, p, ap, out) {
  p.ap = Math.max(0, p.ap - ap); st.spent += ap;
  for (const l of st.labs) if (!l.back && st.spent >= l.due) { l.back = true; addEv(C, st, [l.res], l.by, out); out.push({ k: 'lab_back', id: l.res, label: l.label }); }
  checkEnd(st, out);
}
function checkEnd(st, out) {
  if (st.phase !== 'play') return;
  const act = Object.values(st.players).filter(p => p.active);
  if (act.length && act.every(p => p.ap <= 0)) { st.phase = 'deduce'; out.push({ k: 'phase', phase: 'deduce', why: 'ap' }); }
}
function err(msg) { return { ok: false, err: msg, ev: [] }; }
// 條件分支：證據劣化（全域旗標）、被兇手擦拭、被菜鳥污染
function resolve(st, s, x) { for (const c of x.cond || []) if ((c.after && st.flags[c.after]) || (c.flag && s.f[c.flag])) return Object.assign({}, x, c); return x; }
function options(C, st, pid, oid) {
  const p = st.players[pid], o = objById(C, oid), s = st.obj[oid]; if (!p || !o || !s || s.gone || o.deco || o.van) return [];
  const res = [];
  for (const a of o.acts || []) {
    const tool = C.tools.find(t => t.id === a.tool); let why = '';
    if (s.done[a.id]) why = '已完成'; else if (a.need && !s.done[a.need]) why = '要先完成前一步';
    else if (a.tool && !p.tools.includes(a.tool)) why = '沒帶' + tool.name; else if (p.ap < a.ap) why = '點數不足';
    res.push({ kind: 'use', id: a.id, label: a.label, ap: a.ap, tool: a.tool, emoji: tool && tool.emoji, why });
  }
  if (o.bag) { const used = p.bag.reduce((t, b) => t + b.size, 0); res.push({ kind: 'bag', id: 'bag', label: o.bag.label, ap: o.bag.ap, emoji: '🛍️', size: o.bag.size, why: used + o.bag.size > C.bagSlots ? '證物袋滿了' : p.ap < o.bag.ap ? '點數不足' : '' }); }
  if (o.courier) res.push({ kind: 'courier', id: 'courier', label: o.courier.label, ap: o.courier.ap, emoji: '🛵', why: s.courier ? '已送驗' : p.ap < o.courier.ap ? '點數不足' : '' });
  return res;
}
function labPush(C, st, o, res, label, by, cost, out) {
  st.labs.push({ obj: o, label, res, by, due: st.spent + cost + delay(C, st), back: false });
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
  if (a.type === 'gear') {
    if (!nearVan(C, p)) return err('要回到鑑識車旁才能換裝備');
    const tools = Array.isArray(a.tools) ? [...new Set(a.tools)].filter(t => C.tools.some(x => x.id === t)) : null;
    if (!tools || tools.length > C.carryTools) return err(`最多帶 ${C.carryTools} 件工具`);
    if (tools.length === p.tools.length && tools.every(t => p.tools.includes(t))) return { ok: true, ev: [] };
    const cost = p.loaded ? C.gearSwapAP : 0; if (p.ap < cost) return err('點數不足');
    p.tools = tools; p.loaded = true; out.push({ k: 'gear', by: pid, tools, cost });
    if (cost) spend(C, st, p, cost, out);
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'use' || a.type === 'bag' || a.type === 'courier') {
    const o = objById(C, a.obj), s = st.obj[a.obj];
    if (!o || !s || o.deco || o.van) return err('沒有這個物件');
    if (s.gone) return err('這個證物已經被帶走了');
    if (!near(C, p, o)) return err('距離太遠，走近一點');
    if (a.type === 'use') {
      const x0 = (o.acts || []).find(q => q.id === a.act); if (!x0) return err('不能這樣做');
      if (s.done[x0.id]) return err('已經做過了');
      if (x0.need && !s.done[x0.need]) return err('要先完成前一步');
      if (x0.tool && !p.tools.includes(x0.tool)) return err('你沒有帶這件工具');
      if (p.ap < x0.ap) return err('行動點數不足');
      const x = resolve(st, s, x0);
      s.done[x0.id] = 'p' + pid; if (x.reveal) s.revealed.push(x.reveal);
      out.push({ k: 'use', by: pid, obj: o.id, act: x0.id, label: x0.label, ap: x0.ap, reveal: x.reveal || null });
      if (x.ev) addEv(C, st, x.ev, pid, out);
      if (x.sample) { const sm = { sid: ++st.sid, kind: x.sample.kind, label: x.sample.label, res: x.sample.res, lab: x.sample.lab || null, src: o.id }; p.samples.push(sm); out.push({ k: 'sample', by: pid, label: sm.label, kind: sm.kind }); }
      spend(C, st, p, x0.ap, out);
    } else if (a.type === 'bag') {
      if (!o.bag) return err('這個不能裝袋');
      if (p.bag.reduce((t, b) => t + b.size, 0) + o.bag.size > C.bagSlots) return err('證物袋滿了，先回車上送驗');
      if (p.ap < o.bag.ap) return err('行動點數不足');
      const lc = (o.bag.labCond || []).find(c => s.f[c.flag]);
      s.gone = true; p.bag.push({ obj: o.id, name: o.name, size: o.bag.size, img: o.img, res: lc ? lc.res : o.bag.lab });
      out.push({ k: 'bag', by: pid, obj: o.id, name: o.name, ap: o.bag.ap });
      spend(C, st, p, o.bag.ap, out);
    } else {
      if (!o.courier) return err('這個不能請快遞員取件'); if (s.courier) return err('已經送驗了'); if (p.ap < o.courier.ap) return err('行動點數不足');
      s.courier = true; if (o.bag) s.gone = true;
      labPush(C, st, o.id, o.courier.res, o.name, pid, o.courier.ap, out);
      out.push({ k: 'lab_sent', by: pid, obj: o.id, name: o.name, ap: o.courier.ap });
      spend(C, st, p, o.courier.ap, out);
    }
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'analyze' || a.type === 'slab') {
    if (!nearVan(C, p)) return err('要在鑑識車旁才能做');
    const i = p.samples.findIndex(s => s.sid === a.sid); if (i < 0) return err('沒有這個樣本');
    const sm = p.samples[i];
    if (a.type === 'analyze') {
      const m = C.machines.find(q => q.kind === sm.kind); if (p.ap < m.ap) return err('行動點數不足');
      p.samples.splice(i, 1); st.analyzed++;
      out.push({ k: 'analyze', by: pid, machine: m.id, label: sm.label, ap: m.ap, res: sm.res });
      addEv(C, st, [sm.res], pid, out); spend(C, st, p, m.ap, out);
    } else {
      if (!sm.lab) return err('這個樣本不用送實驗室'); if (p.ap < C.sampleLabAP) return err('行動點數不足');
      p.samples.splice(i, 1); labPush(C, st, sm.src, sm.lab, sm.label, pid, C.sampleLabAP, out);
      out.push({ k: 'lab_sent', by: pid, obj: sm.src, name: sm.label, ap: C.sampleLabAP }); spend(C, st, p, C.sampleLabAP, out);
    }
    st.seq++; return { ok: true, ev: out };
  }
  if (a.type === 'lab') {
    if (!nearVan(C, p)) return err('要把證物拿到車旁交給快遞員');
    const i = p.bag.findIndex(b => b.obj === a.obj); if (i < 0) return err('證物袋裡沒有這個');
    const b = p.bag[i], cost = C.labCost[b.size] || 3; if (p.ap < cost) return err('行動點數不足');
    p.bag.splice(i, 1); labPush(C, st, b.obj, b.res, b.name, pid, cost, out);
    out.push({ k: 'lab_sent', by: pid, obj: b.obj, name: b.name, ap: cost }); spend(C, st, p, cost, out);
    st.seq++; return { ok: true, ev: out };
  }
  return err('不明的動作');
}
function leave(C, st, pid) {
  const p = st.players[pid]; if (!p || !p.active) return [];
  p.active = false; const rest = Object.values(st.players).filter(q => q.active); const out = [{ k: 'left', by: pid }];
  if (rest.length && st.phase === 'play') {
    let ap = p.ap, i = 0; p.ap = 0; while (ap > 0) { rest[i % rest.length].ap++; rest[i % rest.length].apMax++; ap--; i++; }
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
const anyNear = (st, pt, r) => actives(st).some(p => Math.hypot(p.x - pt.x, p.y - pt.y) <= r);
function tick(C, st, dt) {
  const out = []; if (st.phase !== 'play') return out;
  st.clock += dt; const P = C.pressure, T = st.clock;
  const news = (k, text, extra) => { const e = Object.assign({ k, text }, extra || {}); out.push(e); st.news.push({ t: Math.round(T), text }); if (st.news.length > 30) st.news.shift(); };
  /* (a) 證據劣化 */
  if (st.pressure) {
    if (!st.flags.todWide && T >= P.todWideAt) { st.flags.todWide = true; news('decay', '🌡️ 屍溫已接近室溫：現在量肝溫只能得到不精確的死亡時間'); }
    if (!st.flags.oxidize && T >= P.oxidizeAt) { st.flags.oxidize = true; news('decay', '🩸 血跡開始氧化：之後採的皮屑樣本，車上驗不出血型（實驗室 DNA 仍可）'); }
    if (!st.flags.rain && T >= P.rainAt) { st.flags.rain = true; news('decay', '🌧️ 開始下大雨了：後院的鞋印被沖掉了'); }
  }
  /* (c) 分局長時限 */
  for (const m of P.milestones) {
    if (st.ms[m.id]) continue;
    const okNow = m.need.every(n => n === 'never' ? false : n === 'analyze' ? st.analyzed > 0 : Array.isArray(n) ? n.some(x => hasEv(st, x)) : hasEv(st, n));
    if (okNow) { st.ms[m.id] = 'ok'; for (const p of actives(st)) { p.ap++; p.apMax++; } news('ms_ok', `✅ 達成分局長要求「${m.t}」：${m.okT}`); continue; }
    if (T >= m.at && st.pressure) {
      st.ms[m.id] = 'fail';
      if (m.fail === 'ap') { for (let i = 0; i < 2; i++) { const q = actives(st).sort((a, b) => b.ap - a.ap)[0]; if (q && q.ap > 0) q.ap--; } }
      if (m.fail === 'lab') st.labExtra += 2;
      news('ms_fail', `❌ 沒達成「${m.t}」：${m.failT}`);
      if (m.fail === 'verdict') { st.phase = 'deduce'; out.push({ k: 'phase', phase: 'deduce', why: 'time' }); return out; }
    }
  }
  if (!st.pressure) { checkEnd(st, out); return out; }
  /* (b) 關係人 NPC＋混在其中的兇手 */
  const heat = culpritHeat(C, st);
  for (const n of st.npcs) {
    if (n.mode === 'gone') continue;
    const isC = n.id === C.culprit;
    if (n.mode === 'held') continue;
    if (n.mode === 'flee') {
      if (anyNear(st, n, 80)) { n.mode = 'held'; n.path = null; addEv(C, st, ['E_held'], null, out); news('held', `🚨 ${sname(C, n.id)} 想偷偷離開封鎖線，被你們攔下了！`, { npc: n.id }); continue; }
      if (walkNpc(C, n, dt, FLEE_SPEED)) { n.mode = 'gone'; st.fled = n.id; news('fled', `🏃 ${sname(C, n.id)} 趁亂離開了現場！（結案時會扣分）`, { npc: n.id }); }
      continue;
    }
    if (n.mode === 'idle') {
      n.wait -= dt;
      if (isC && heat >= 2 && !n.fleeTried) { n.fleeTried = true; n.mode = 'flee'; n.path = findPath(C, n.x, n.y, C.exit.x, C.exit.y); news('flee', `⚠️ 有關係人想趁亂溜走！快到封鎖線外攔住！`, { npc: n.id }); continue; }
      if (isC && T >= st.tamperAt) {
        st.tamperAt = T + P.tamperEvery * (0.7 + rnd(st) * 0.6);
        const cand = C.objects.filter(o => o.tamper && !st.obj[o.id].gone && !st.obj[o.id].f.tampered && !Object.keys(st.obj[o.id].done).includes('prints'));
        if (cand.length) { const o = cand[Math.floor(rnd(st) * cand.length)]; n.mode = 'sneak'; n.tgt = o.id; n.path = findPath(C, n.x, n.y, o.x, o.y + 10, 30); continue; }
      }
      if (!isC && T >= st.curiousAt) {   // 好奇的關係人也會溜進來看（讓兇手不那麼好認）
        st.curiousAt = T + 50 + rnd(st) * 70;
        const spots = [{ x: 600, y: 620 }, { x: 860, y: 520 }, { x: 1100, y: 640 }];
        const s = spots[Math.floor(rnd(st) * spots.length)]; n.mode = 'curious'; n.path = findPath(C, n.x, n.y, s.x, s.y); continue;
      }
      if (n.wait <= 0) { n.wait = 4 + rnd(st) * 8; n.path = findPath(C, n.x, n.y, 40 + rnd(st) * 360, 780 + rnd(st) * 270); n.mode = 'wander'; }
      // (b-2) 恐嚇落單的隊員
      if (isC && heat >= 1 && st.threats < (actives(st).length > 1 ? 2 : 1) && T >= (st.threatAt || 0)) {
        const v = actives(st).find(p => Math.hypot(p.x - n.x, p.y - n.y) < 70 && !actives(st).some(q => q !== p && Math.hypot(q.x - p.x, q.y - p.y) < 350));
        if (v) { st.threats++; st.threatAt = T + 90; if (v.ap > 0) v.ap--; addEv(C, st, ['E_threat'], null, out); news('threat', `😠 ${sname(C, n.id)} 靠近落單的 ${v.name}，低聲說「別多管閒事」——${v.name} 嚇得手一抖（-1 點）`, { npc: n.id, by: v.pid }); }
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
  /* (d) 菜鳥員警 */
  const R = st.rookie;
  if (!R && T >= st.rookieAt) {
    const cand = C.objects.filter(o => !o.deco && !o.van && !st.obj[o.id].gone && C.roomName[o.room] && o.room !== 'street' && (o.acts || []).some(a => !st.obj[o.id].done[a.id]));
    if (cand.length) { const o = cand[Math.floor(rnd(st) * cand.length)]; st.rookie = { x: C.exit.x + 20, y: C.exit.y - 20, tgt: o.id, mode: 'in', path: findPath(C, C.exit.x + 20, C.exit.y - 20, o.x, o.y + 10, 30) }; news('rookie', `🚓 菜鳥員警小林闖進封鎖線，往「${o.name}」走過去了！快去攔住他`, { obj: o.id }); }
    st.rookieAt = T + P.rookieEvery * (0.7 + rnd(st) * 0.6);
  } else if (R) {
    if (R.mode === 'in') {
      if (anyNear(st, R, 80)) { R.mode = 'out'; R.path = findPath(C, R.x, R.y, C.exit.x, C.exit.y); news('rookie_stop', '✋ 菜鳥員警被攔下來了，乖乖回車上待命'); }
      else if (walkNpc(C, R, dt, ROOKIE_SPEED)) {
        const o = objById(C, R.tgt), s = st.obj[o.id]; const roll = rnd(st);
        const hasCond = (o.acts || []).some(a => (a.cond || []).some(c => c.flag === 'contam') && !s.done[a.id]);
        if (hasCond && roll < .5) { s.f.contam = true; news('rookie_hit', `💥 菜鳥員警伸手摸了「${o.name}」——證物被污染了！`, { obj: o.id }); }
        else {
          const withTools = actives(st).filter(p => p.tools.length);
          if (roll < .75 && withTools.length) { const v = withTools.sort((a, b) => Math.hypot(a.x - R.x, a.y - R.y) - Math.hypot(b.x - R.x, b.y - R.y))[0]; const t = v.tools.splice(Math.floor(rnd(st) * v.tools.length), 1)[0]; const tn = (C.tools.find(x => x.id === t) || {}).name; news('rookie_hit', `💥 菜鳥員警踢翻了工具箱：${v.name} 的「${tn}」摔壞了，要回車上重新拿`, { by: v.pid }); }
          else { const v = actives(st).sort((a, b) => b.ap - a.ap)[0]; if (v && v.ap > 0) v.ap--; news('rookie_hit', `💥 菜鳥員警撞倒了證物標示牌，${v ? v.name : '大家'} 花時間收拾（-1 點）`, { by: v && v.pid }); }
        }
        R.mode = 'out'; R.path = findPath(C, R.x, R.y, C.exit.x, C.exit.y);
      }
    } else if (walkNpc(C, R, dt, ROOKIE_SPEED * 1.3)) st.rookie = null;
  }
  checkEnd(st, out);
  return out;
}

/* ---------- 推理：從已找到的證據推出還有哪些可能（筆記本和測試用） ---------- */
function deduce(C, st, ids) {
  ids = ids || st.found.map(f => f.id);
  const facts = ids.map(id => (C.evidence[id] || {}).f || {}).filter(f => !f.decoy);
  const sig = new Set(), neg = new Set(); let who = null, weapon = null, room = null; const negw = new Set(), noroom = new Set(); const traits = [];
  for (const f of facts) { (f.sig || []).forEach(s => sig.add(s)); (f.neg || []).forEach(s => neg.add(s)); if (f.who) who = f.who; if (f.weapon) weapon = f.weapon; if (f.room) room = f.room; if (f.negw) negw.add(f.negw); if (f.noroom) noroom.add(f.noroom); (f.trait || []).forEach(t => traits.push(t)); }
  const methods = C.methods.filter(m => [...sig].every(s => m.sigs.includes(s)) && ![...neg].some(s => m.sigs.includes(s))).map(m => m.id);
  const suspects = who ? [who] : C.suspects.filter(s => traits.every(([k, v]) => s[k] === v)).map(s => s.id);
  let loc = room;
  if (!loc && weapon && weapon !== 'hearth' && methods.length === 1 && methods[0] !== 'staged') loc = (C.objects.find(o => o.weapon === weapon) || {}).room || null;
  return { sig: [...sig], neg: [...neg], methods, suspects, weapon, location: loc };
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
  const total = Math.max(0, rows.reduce((t, r) => t + r.pts, 0) + Math.min(kp, 15) + pen);
  const rank = total >= 90 ? 'S' : total >= 75 ? 'A' : total >= 55 ? 'B' : total >= 35 ? 'C' : 'D';
  return { rows, keys, keyPts: Math.min(kp, 15), pen, fled: st.fled, total, rank, found: st.found.length, spent: st.spent, clock: Math.round(st.clock), ms: Object.assign({}, st.ms) };
}
const FS = { SPEED, walkable, moveTo, roomAt, near, nearVan, newGame, act, options, leave, move, tick, grade, deduce, hasEv, objById, findPath, walkRects, culpritHeat };
if (typeof module !== 'undefined' && module.exports) module.exports = FS; else root.FS = FS;
})(typeof self !== 'undefined' ? self : this);
