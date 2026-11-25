// node test/engine.test.js — 規則／行動點數／程序生成案件「一定解得開」
const GEN = require('../docs/casegen.js'), FS = require('../docs/engine.js');
let fail = 0, okN = 0; const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else okN++; };
const at = (st, pid, pt) => { const p = st.players[pid]; p.x = pt.x; p.y = pt.y; };
// 照真相排出的最省路線（用來證明每個生成的案件都能在點數內解開）
function plan(C) {
  const m = C.method, w = C.objects.find(o => o.weapon === C.weapon), steps = [];
  const use = (obj, act, tool) => steps.push({ tool, a: { type: 'use', obj, act } });
  use('body', 'wound', 'camera'); use('body', 'livid', 'camera');
  if (m === 'blunt' || m === 'stab') { use('floor_' + C.location, 'lum', 'luminol'); use(w.id, 'lum', 'luminol'); }
  if (m === 'staged') { use('w_hearth', 'lum', 'luminol'); use('floor_' + C.location, 'lum', 'luminol'); }
  if (m === 'poison') { use('body', 'swab', 'swab'); steps.push({ van: 'analyzeAll' }); }
  if (m === 'strangle' || m === 'poison') { steps.push({ a: { type: 'bag', obj: w.id } }); steps.push({ van: 'labAll' }); }
  else { const fe = C.evidence['E_fp_' + C.weapon]; const partial = !fe || /半枚/.test(fe.name); if (!partial) { use(w.id, 'prints', 'prints'); steps.push({ van: 'analyzeAll' }); } else { steps.push({ a: { type: 'bag', obj: 'phone' } }); steps.push({ van: 'labAll' }); } }
  return steps;
}
function run(C, st, steps) {
  const p = st.players[0]; const errs = [];
  const tools = [...new Set(steps.filter(s => s.tool).map(s => s.tool))];
  const doA = a => { const r = FS.act(C, st, 0, a); if (!r.ok) errs.push(a.type + ':' + (a.obj || '') + ':' + r.err); return r; };
  at(st, 0, C.start[0]); doA({ type: 'gear', tools: tools.slice(0, 3) });
  for (const s of steps) {
    if (s.tool && !p.tools.includes(s.tool)) { at(st, 0, C.start[0]); const keep = p.tools.filter(t => steps.slice(steps.indexOf(s)).some(x => x.tool === t)).slice(0, 2); doA({ type: 'gear', tools: [...keep, s.tool] }); }
    if (s.van) { at(st, 0, C.start[0]); if (s.van === 'analyzeAll') for (const sm of p.samples.slice()) doA({ type: 'analyze', sid: sm.sid }); else for (const b of p.bag.slice()) doA({ type: 'lab', obj: b.obj }); continue; }
    const o = FS.objById(C, s.a.obj); at(st, 0, { x: o.x, y: o.y }); doA(s.a);
  }
  // 等實驗室：在車上幫忙（沒事做時，用剩下的點數做些便宜的動作）
  let guard = 0; while (st.labs.some(l => !l.back) && p.ap > 0 && guard++ < 20) {
    const o = C.objects.find(o => (o.acts || []).some(a => a.tool === 'camera' && !st.obj[o.id].done[a.id]) && !st.obj[o.id].gone);
    if (o && p.tools.includes('camera')) { at(st, 0, o); const a = o.acts.find(a => a.tool === 'camera' && !st.obj[o.id].done[a.id]); doA({ type: 'use', obj: o.id, act: a.id }); }
    else { const q = C.objects.find(o => (o.acts || []).some(a => p.tools.includes(a.tool) && !st.obj[o.id].done[a.id]) && !st.obj[o.id].gone); if (!q) { if (p.tools.includes('luminol')) break; at(st, 0, C.start[0]); doA({ type: 'gear', tools: ['camera', 'luminol', 'prints'] }); continue; } at(st, 0, q); const a = q.acts.find(a => p.tools.includes(a.tool) && !st.obj[q.id].done[a.id]); doA({ type: 'use', obj: q.id, act: a.id }); }
  }
  return errs;
}
const N = +process.argv[2] || 300; let maxCost = { easy: 0, normal: 0, hard: 0 };
const methodsSeen = {};
for (const diff of ['easy', 'normal', 'hard']) for (let seed = 1; seed <= N; seed++) {
  const C = GEN.generate(seed * 101 + 7, diff);
  methodsSeen[C.method] = (methodsSeen[C.method] || 0) + 1;
  // 1. 全部真線索都拿到時，答案唯一且正確
  const all = Object.keys(C.evidence).filter(id => !['E_tod_wide', 'E_nails_ox', 'E_phone_wiped', 'E_shoe_rain'].some(x => id === x) && !/^E_fp(wipe|con)_/.test(id));
  const d = FS.deduce(C, null, all);
  ok(d.methods.length === 1 && d.methods[0] === C.method, `${diff}#${seed} 完整線索 → 行兇方式唯一 (${d.methods})`);
  ok(d.suspects.length === 1 && d.suspects[0] === C.culprit, `${diff}#${seed} 完整線索 → 兇手唯一`);
  // 2. 只靠可觀察特徵（不用 DNA／指紋直接比對）也能把兇手和每位無辜者區分開
  const cu = C.suspects.find(s => s.id === C.culprit);
  const obs = ['shoe'].concat(C.methods.find(m => m.id === C.method) && ['blunt', 'stab', 'strangle', 'staged'].includes(C.method) ? ['blood'] : []).concat(['blunt', 'stab', 'strangle'].includes(C.method) ? ['hand'] : []);
  ok(C.suspects.every(s => s === cu || obs.some(k => s[k] !== cu[k])), `${diff}#${seed} 特徵組合能區分兇手`);
  // 3. 照最省路線，在點數內實際解開（關掉壓力系統）
  const st = FS.newGame(C, [{ pid: 0, name: 'T', ci: 0 }], { pressure: false });
  const errs = run(C, st, plan(C));
  ok(!errs.length, `${diff}#${seed} 路線執行無錯誤 ${errs.join(',')}`);
  const r = FS.deduce(C, st);
  ok(r.methods.length === 1 && r.methods[0] === C.method && r.suspects.length === 1 && r.suspects[0] === C.culprit && r.weapon === C.weapon && r.location === C.location,
    `${diff}#${seed} 點數內推出正確答案 m=${r.methods} s=${r.suspects} w=${r.weapon}/${C.weapon} l=${r.location}/${C.location} (${C.method})`);
  maxCost[diff] = Math.max(maxCost[diff], st.spent);
  ok(st.spent <= C.teamAP - 4, `${diff}#${seed} 最省路線花 ${st.spent} 點，至少留 4 點餘裕（總 ${C.teamAP}）`);
}
console.log('最省路線最多花：', maxCost, '手法分布：', methodsSeen);
// 4. 同種子 → 同案件；不同種子 → 會變
{ const a = GEN.generate(42, 'normal'), b = GEN.generate(42, 'normal'); ok(JSON.stringify(a.truth) === JSON.stringify(b.truth), '同種子產生同一案件');
  const set = new Set(); for (let i = 0; i < 60; i++) { const c = GEN.generate(i, 'normal'); set.add(c.culprit + c.method + c.location); } ok(set.size > 20, `60 局有 ${set.size} 種不同組合`); }
// 5. 規則：工具上限、換裝備扣點、距離、袋子、實驗室延遲
{
  const C = GEN.generate(5, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }, { pid: 1, name: 'B', ci: 1 }], { pressure: false });
  ok(st.players[0].ap + st.players[1].ap === C.teamAP, '點數依人數平分');
  const half = st.players[0].ap;
  ok(!FS.act(C, st, 0, { type: 'gear', tools: ['camera', 'luminol', 'prints', 'swab'] }).ok, '最多帶 3 件');
  ok(FS.act(C, st, 0, { type: 'gear', tools: ['camera', 'luminol', 'swab'] }).ok && st.players[0].ap === half, '第一次裝備免費');
  ok(FS.act(C, st, 0, { type: 'gear', tools: ['camera', 'luminol', 'thermo'] }).ok && st.players[0].ap === half - 1, '之後換裝備 -1');
  ok(!FS.act(C, st, 0, { type: 'use', obj: 'body', act: 'wound' }).ok, '離屍體太遠不能拍');
  at(st, 0, FS.objById(C, 'body')); const r = FS.act(C, st, 0, { type: 'use', obj: 'body', act: 'wound' });
  ok(r.ok && FS.hasEv(st, 'E_wound') && st.players[0].ap === half - 2, '近拍傷口 -1 拿到證據');
  ok(!FS.act(C, st, 0, { type: 'use', obj: 'body', act: 'wound' }).ok, '同一件事不能做兩次');
  ok(!FS.act(C, st, 1, { type: 'use', obj: 'body', act: 'temp' }).ok, 'B 沒裝備、也不在旁邊');
  at(st, 0, FS.objById(C, 'phone')); ok(FS.act(C, st, 0, { type: 'bag', obj: 'phone' }).ok && st.obj.phone.gone, '手機裝袋，從現場消失');
  at(st, 0, C.start[0]); FS.act(C, st, 0, { type: 'lab', obj: 'phone' });
  const due = st.labs[0].due; ok(due === st.spent + C.labDelay, '送驗：再花 labDelay 點才回來');
  ok(!FS.hasEv(st, 'E_phone'), '報告還沒回來');
  at(st, 1, C.start[1]); FS.act(C, st, 1, { type: 'gear', tools: ['camera', 'luminol', 'thermo'] });
  for (const id of ['desk']) { at(st, 1, FS.objById(C, id)); FS.act(C, st, 1, { type: 'use', obj: id, act: 'ledger' }); }
  at(st, 1, FS.objById(C, 'body')); FS.act(C, st, 1, { type: 'use', obj: 'body', act: 'livid' }); FS.act(C, st, 1, { type: 'use', obj: 'body', act: 'temp' });
  at(st, 1, FS.objById(C, 'floor_living')); FS.act(C, st, 1, { type: 'use', obj: 'floor_living', act: 'lum' });
  ok(st.spent >= due ? FS.hasEv(st, 'E_phone') : true, '隊友花點數也會推進實驗室進度');
  // 點數用完 → 推理
  FS.tick(C, st, 0.1); for (const p of Object.values(st.players)) p.ap = 0; FS.tick(C, st, 0.1);
  ok(st.phase === 'deduce', '全隊點數用完 → 進入推理');
  ok(!FS.act(C, st, 0, { type: 'submit' }).ok, '沒填完不能送出');
  for (const [f, v] of [['culprit', C.culprit], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) FS.act(C, st, 0, { type: 'draft', field: f, v });
  FS.act(C, st, 0, { type: 'draft', field: 'keys', v: ['E_phone', 'E_wound', 'nonexist'] });
  ok(st.draft.keys.length <= 2 && !st.draft.keys.includes('nonexist'), '關鍵證據只能選已找到的');
  ok(FS.act(C, st, 0, { type: 'submit' }).ok && st.result.total >= 85, '答對 → 高分 ' + (st.result && st.result.total));
}
// 6. 壓力系統：劣化、分局長、兇手動證物／逃跑、菜鳥
{
  let seen = { decay: 0, ms_fail: 0, tampered: 0, rookie: 0, rookie_hit: 0, flee: 0, fled: 0, held: 0, caught: 0, rookie_stop: 0, curious: 0 }; let forced = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const C = GEN.generate(seed, 'hard'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }]);
    st.players[0].ap = 999; st.players[0].x = 1620; st.players[0].y = 1050;
    for (let t = 0; t < 900 && st.phase === 'play'; t += 0.2) {
      if (Math.abs(t - 200) < 0.1) { for (const id of ['E_shoe', 'E_phone']) st.found.push({ id, n: 0 }); }   // 調查有進展 → 兇手會想逃
      for (const e of FS.tick(C, st, 0.2)) if (e.k in seen) seen[e.k]++; else if (e.k === 'shoo') seen.curious++;
    }
    if (st.phase === 'deduce') forced++;
  }
  console.log('壓力事件次數（40 局困難、玩家不動）：', seen, '時間到強制推理：', forced);
  ok(seen.decay > 0 && seen.ms_fail > 0 && seen.tampered > 0 && seen.rookie > 0 && seen.rookie_hit > 0 && seen.flee > 0 && seen.fled > 0, '劣化、時限、動證物、菜鳥、逃跑都會發生');
  ok(forced === 40, '結案時限到 → 強制推理');
  // 玩家守在旁邊 → 攔得下來
  const C = GEN.generate(9, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }]); st.players[0].ap = 999;
  const n = st.npcs.find(x => x.id === C.culprit); st.players[0].x = n.x + 30; st.players[0].y = n.y;
  for (const id of ['E_shoe', 'E_phone']) st.found.push({ id, n: 0 });
  let held = false; for (let t = 0; t < 30; t += 0.2) { for (const e of FS.tick(C, st, 0.2)) if (e.k === 'held') held = true; const q = st.npcs.find(x => x.id === C.culprit); st.players[0].x = q.x + 20; st.players[0].y = q.y; }
  ok(held && FS.hasEv(st, 'E_held'), '跟著想逃的人 → 攔下並記錄可疑舉動');
  // 菜鳥：有人站在他路線上就會被攔
  const C2 = GEN.generate(11, 'normal'), s2 = FS.newGame(C2, [{ pid: 0, name: 'A', ci: 0 }]); s2.players[0].ap = 999; s2.rookieAt = 0; s2.players[0].x = 60; s2.players[0].y = 1020;
  let stopped = false; for (let t = 0; t < 10; t += 0.2) for (const e of FS.tick(C2, s2, 0.2)) if (e.k === 'rookie_stop') stopped = true;
  ok(stopped, '站在入口 → 攔下菜鳥員警');
}
console.log(fail ? `\n${fail} 項失敗（${okN} 項通過）` : `\n全部通過（${okN} 項）`); process.exit(fail ? 1 : 0);
