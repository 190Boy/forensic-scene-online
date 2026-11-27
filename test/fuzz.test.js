// node test/fuzz.test.js — v15 穩定度：大量隨機案件逐一檢查
//  ①所有文字（線索、員警報告、觀察、筆記、推理選項、事件、分局長要求）沒有 undefined／NaN／[object Object]／null
//  ②每個證物、開關、屍體、鑑識車、員警崗位、關係人、守門點都走得到（從入口找得到路）
//  ③推理選項一定包含真相；答對一定贏、答錯會扣分；每種手法（含接觸性毒物）都出現
//  ④機器人把每個物件都做一遍：分局長每種要求都做得到（不會卡死）
const GEN = require('../docs/casegen.js'), FS = require('../docs/engine.js');
let fail = 0, okN = 0; const ok = (c, m) => { if (!c) { fail++; if (fail < 40) console.log('FAIL', m); } else okN++; };
const N = +process.env.FUZZ || 220, DIFFS = ['easy', 'normal', 'hard'];
const BAD = /undefined|NaN|\[object Object\]|(^|[^a-z_])null([^a-z_]|$)/;
function badStrings(x, path, out, seen = new Set()) {
  if (typeof x === 'string') { if (BAD.test(x)) out.push(path + ' = ' + x.slice(0, 80)); return out; }
  if (typeof x === 'number') { if (!Number.isFinite(x) && x !== Infinity) out.push(path + ' = ' + x); return out; }
  if (!x || typeof x !== 'object' || seen.has(x)) return out; seen.add(x);
  for (const k of Object.keys(x)) badStrings(x[k], path + '.' + k, out, seen); return out;
}
// 走得到：物件周圍（互動距離內）有一個可走的點，而且從入口找得到路過去
function reachable(C, pt, r) {
  const s = C.start[0];
  for (let d = 0; d <= r; d += 15) for (let a = 0; a < 16; a++) {
    const x = pt.x + Math.cos(a / 8 * Math.PI) * d, y = pt.y + Math.sin(a / 8 * Math.PI) * d;
    if (!FS.walkable(C, x, y)) continue; if (FS.findPath(C, s.x, s.y, x, y, 8)) return true;
  }
  return false;
}
const methods = {}, strBad = [], reachBad = [], dedBad = [], demBad = [], progLow = [];
let cases = 0, foundSum = 0, evSum = 0; const errKinds = {};
for (let sd = 1; sd <= N; sd++) for (const d of DIFFS) {
  const seed = (sd * 2654435761) % 2147483647 || sd, C = GEN.generate(seed, d); cases++;
  methods[C.method] = (methods[C.method] || 0) + 1;
  // ① 生成的文字
  badStrings(C, `${d}#${seed} C`, strBad);
  // ② 位置
  for (const o of C.objects) {
    if (o.deco && !o.desc) continue;
    if (!reachable(C, o, (o.r || (o.van ? C.van.r : 100)) + 40 - 5)) reachBad.push(`${d}#${seed} 物件 ${o.id}（${o.name}）@${Math.round(o.x)},${Math.round(o.y)}`);
  }
  const st = FS.newGame(C, [{ pid: 0, name: 'A' }, { pid: 1, name: 'B' }], { pressure: true });
  for (const c of C.cops) for (const q of c.posts) if (!FS.walkable(C, q.x, q.y) || !reachable(C, q, 10)) reachBad.push(`${d}#${seed} 員警崗位 ${c.id}@${q.x},${q.y}`);
  for (const n of st.npcs) { if (!FS.walkable(C, n.x, n.y)) reachBad.push(`${d}#${seed} 關係人 ${n.id} 站在牆裡 @${n.x},${n.y}`); if (!reachable(C, n, 120)) reachBad.push(`${d}#${seed} 關係人 ${n.id} 走不到`); }
  for (const k of Object.keys(C.guardSpots || {})) { const g = C.guardSpots[k]; if (!FS.walkable(C, g.x, g.y) || !reachable(C, g, 10)) reachBad.push(`${d}#${seed} 守門點 ${k}`); }
  for (const s of C.start) if (!FS.walkable(C, s.x, s.y)) reachBad.push(`${d}#${seed} 出生點在牆裡`);
  // ③ 推理選項含真相
  const has = (L, id) => (L || []).some(x => x.id === id);
  if (!has(C.suspects, C.culprit) || !has(C.methods, C.method) || !has(C.weapons, C.weapon) || !has(C.locations, C.location)) dedBad.push(`${d}#${seed} 推理選項缺真相`);
  for (const L of [C.suspects, C.methods, C.weapons, C.locations]) for (const x of L) if (!(x.t || x.name) || BAD.test(x.t || x.name)) dedBad.push(`${d}#${seed} 推理選項名稱壞掉 ${JSON.stringify(x).slice(0, 60)}`);
  // ④ 機器人：把每個物件的每個動作都做一遍（兩人：一人關燈一人做）
  const p = st.players[0]; p.tools = C.tools.map(t => t.id); p.uses = {}; for (const t of p.tools) p.uses[t] = 99; p.loaded = true;
  st.quietUntil = 1e9; st.tamperAt = 1e9; st.curiousAt = 1e9; for (const c of st.cops) c.nextAt = 1e9; st.boss.nextAt = 1e9;
  const evs = [], errs = [];
  const A = a => { const r = FS.act(C, st, 0, a); if (r.ok) evs.push(...(r.ev || [])); else errs.push(a.type + ':' + (a.obj || '') + ':' + (a.act || '') + ' ' + r.err); return r; };
  const T = (s) => { const e = FS.tick(C, st, s); evs.push(...e); };
  for (let pass = 0; pass < 3; pass++) for (const o of C.objects) {
    if (o.deco || o.van || !o.acts) continue; const s = st.obj[o.id]; if (s.gone) continue;
    for (const x of o.acts) {
      if (s.done[x.id] || (x.need && !s.done[x.need])) continue;
      const pos = FS.posO(st, o); p.x = pos.x; p.y = pos.y;
      if (o.npc) { const n = st.npcs.find(q => q.id === o.npc); if (!n || n.mode === 'gone') continue; }
      st.lights[o.room] = x.dark ? false : true;
      if (x.mg) { const r = A({ type: 'mgStart', obj: o.id, act: x.id }); if (!r.ok) continue; st.clock += C.mgMin; A({ type: 'use', obj: o.id, act: x.id, score: .95 }); }
      else A({ type: 'use', obj: o.id, act: x.id });
    }
  }
  for (const o of C.objects) st.lights[o.room] = true;
  p.x = C.start[0].x; p.y = C.start[0].y;
  for (const sm of p.samples.slice()) { if (sm.lab) A({ type: 'slab', sid: sm.sid }); else A({ type: 'analyze', sid: sm.sid }); }
  st.budget = 99; for (const o of C.objects) if (o.bag && !st.obj[o.id].gone) { const q = FS.posO(st, o); p.x = q.x; p.y = q.y; A({ type: 'bag', obj: o.id }); p.x = C.start[0].x; p.y = C.start[0].y; for (const b of p.bag.slice()) A({ type: 'lab', obj: b.obj }); }
  T(C.labSec + 1); T(.1);
  foundSum += st.found.length; evSum += evs.length; for (const e of errs) { const k = e.replace(/^(\S+?):.*? /, '$1 '); errKinds[k] = (errKinds[k] || 0) + 1; }
  // 引擎產生的文字：事件、現場動態、報告、觀察、分局長要求
  for (const e of evs) { const b = badStrings(e, `${d}#${seed} ev:${e.k}`, []); strBad.push(...b); }
  badStrings(st.news, `${d}#${seed} news`, strBad);
  for (const k of ['wound', 'tod', 'print', 'blood', 'lab', 'shoe']) { const t = FS.demandText(C, { kind: 'report', rep: k }); if (BAD.test(t) || !t) strBad.push(`${d}#${seed} 分局長要求 ${k}：${t}`); }
  // 分局長每種「報告」要求在機器人做完後都達成（= 一定做得到）
  for (const k of ['wound', 'tod', 'print', 'blood', 'lab']) if (!FS.bossDone(C, st, { kind: 'report', rep: k })) demBad.push(`${d}#${seed} 分局長要求「${k}」做不到`);
  // ⑤ 玩得很差（每個小遊戲都 0.05 分、重做一次也一樣差）→ 做到沒東西可做後，分局長不會再要「做不出來」的報告
  if (sd % 2 === 0) {
    const sp = FS.newGame(C, [{ pid: 0, name: 'A' }], { pressure: true }), q = sp.players[0];
    for (const k of ['wound', 'tod', 'print', 'blood']) if (!FS.canMake(C, sp, k)) demBad.push(`${d}#${seed} 開局就做不出「${k}」`);
    q.tools = C.tools.map(t => t.id); q.uses = {}; for (const t of q.tools) q.uses[t] = 99; sp.quietUntil = 1e9; sp.tamperAt = 1e9; sp.curiousAt = 1e9; for (const c of sp.cops) c.nextAt = 1e9; sp.boss.nextAt = 1e9;
    for (let pass = 0; pass < 4; pass++) for (const o of C.objects) {
      if (o.deco || o.van || !o.acts) continue; const s = sp.obj[o.id]; if (s.gone) continue;
      for (const x of o.acts) { if (x.need && !s.done[x.need]) continue; const pos = FS.posO(sp, o); q.x = pos.x; q.y = pos.y; sp.lights[o.room] = !x.dark;
        if (x.mg) { const r = FS.act(C, sp, 0, { type: 'mgStart', obj: o.id, act: x.id }); if (!r.ok) continue; sp.clock += C.mgMin; FS.act(C, sp, 0, { type: 'use', obj: o.id, act: x.id, score: .05 }); }
        else FS.act(C, sp, 0, { type: 'use', obj: o.id, act: x.id }); }
    }
    q.x = C.start[0].x; q.y = C.start[0].y; for (const sm of q.samples.slice()) FS.act(C, sp, 0, { type: 'analyze', sid: sm.sid });
    for (let i = 0; i < 40; i++) { const dm = FS.pickDemand(C, sp); if (dm.kind === 'report' && !FS.bossDone(C, sp, dm)) { demBad.push(`${d}#${seed} 玩很差之後分局長要了做不出來的「${dm.rep}」`); break; } }
    if (sp.players[0].mg) demBad.push(`${d}#${seed} 機器人做完還卡在小遊戲`);
  }
  const prog = FS.progress(C, st); if (prog < 100) progLow.push(`${d}#${seed} ${C.method} 全部做完進度只有 ${prog}%`);
  const dd = FS.deduce(C, st);
  if (!dd.suspects.includes(C.culprit) || !dd.methods.includes(C.method)) dedBad.push(`${d}#${seed} 推理把真相排除了：${JSON.stringify({ s: dd.suspects, m: dd.methods })}`);
  // 推理：答對一定滿分贏；答錯扣分
  const s2 = JSON.parse(JSON.stringify(st)); A({ type: 'close' });
  for (const [f, v] of [['culprit', C.culprit], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) A({ type: 'draft', field: f, v });
  const good = A({ type: 'submit' }); const R = st.result;
  if (!good.ok || !R || !R.rows.every(r => r.ok)) dedBad.push(`${d}#${seed} 答對卻沒有全對：${JSON.stringify(R && R.rows.map(r => r.ok))}`);
  badStrings(R, `${d}#${seed} result`, strBad);
  const wrong = C.suspects.find(x => x.id !== C.culprit).id;
  s2.phase = 'deduce'; for (const [f, v] of [['culprit', wrong], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) FS.act(C, s2, 0, { type: 'draft', field: f, v });
  FS.act(C, s2, 0, { type: 'submit' }); if (!s2.result || s2.result.rows[0].ok || s2.result.total >= R.total) dedBad.push(`${d}#${seed} 答錯兇手沒扣分`);
  const s3 = FS.newGame(C, [{ pid: 0, name: 'A' }]); FS.act(C, s3, 0, { type: 'close' }); const r3 = FS.act(C, s3, 0, { type: 'submit' }); if (r3.ok) dedBad.push(`${d}#${seed} 沒填完也能送出`);
  if (errs.some(e => /不明|undefined|TypeError/.test(e))) dedBad.push(`${d}#${seed} 機器人遇到奇怪錯誤：${errs.filter(e => /不明|undefined/.test(e)).slice(0, 3)}`);
}
const show = (L, m) => { const badN = new Set(L.map(x => x.split(' ')[0])).size; okN += cases - badN; fail += badN; console.log((badN ? 'FAIL ' : 'ok   ') + `${m}（${cases - badN}/${cases} 個案件）`); for (const x of L.slice(0, 6)) console.log('   ·', x); };
console.log(`機器人平均每案找到 ${(foundSum / cases).toFixed(1)} 項證據、${(evSum / cases).toFixed(0)} 個事件；被拒絕的動作：`, JSON.stringify(Object.entries(errKinds).sort((a, b) => b[1] - a[1]).slice(0, 8)));
console.log(`模糊測試：${cases} 個案件（${N} 種子 × ${DIFFS.length} 難度）；手法分布 ${JSON.stringify(methods)}`);
ok(Object.keys(methods).length === GEN.METHODS ? GEN.METHODS.length : Object.keys(methods).length >= 6, '六種手法都出現（含接觸性毒物）');
ok(methods.contact > 0, '接觸性毒物有出現：' + (methods.contact || 0));
show(strBad, '文字沒有 undefined／NaN／[object Object]／null');
show(reachBad, '所有物件、崗位、關係人、守門點都走得到');
show(dedBad, '推理選項含真相、答對全對、答錯扣分');
show(demBad, '分局長的每種報告要求都做得到');
show(progLow, '全部做完時案情進度能到 100%（分局長「進度」要求做得到）');
console.log(fail ? `失敗 ${fail} 項（通過 ${okN}）` : `全部通過（${okN} 項）`); process.exit(fail ? 1 : 0);
