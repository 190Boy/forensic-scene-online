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
    const o = FS.objById(C, s.a.obj);
    if (s.a.act === 'lum') {   // 魯米諾：關燈 → 噴灑 → 記錄螢光位置（燈關著才看得到）
      if (FS.isLit(C, st, o)) { at(st, 0, FS.objById(C, 'sw_' + o.room)); doA({ type: 'light', obj: 'sw_' + o.room }); }
      at(st, 0, { x: o.x, y: o.y }); doA(s.a); doA({ type: 'use', obj: o.id, act: 'lum_mk' }); continue;
    }
    at(st, 0, { x: o.x, y: o.y }); doA(s.a);
  }
  // 等實驗室報告（以時間計算）
  for (let t = 0; t < 200 && st.labs.some(l => !l.back); t++) FS.tick(C, st, 1);
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
  ok(st.spent <= C.labBudget - 2, `${diff}#${seed} 最省路線花實驗室額度 ${st.spent}，至少留 2 點餘裕（總 ${C.labBudget}）`);
}
console.log('最省路線最多花的實驗室額度：', maxCost, '手法分布：', methodsSeen);
// 4. 同種子 → 同案件；不同種子 → 會變
{ const a = GEN.generate(42, 'normal'), b = GEN.generate(42, 'normal'); ok(JSON.stringify(a.truth) === JSON.stringify(b.truth), '同種子產生同一案件');
  const set = new Set(); for (let i = 0; i < 60; i++) { const c = GEN.generate(i, 'normal'); set.add(c.culprit + c.method + c.location); } ok(set.size > 20, `60 局有 ${set.size} 種不同組合`); }
// 5. 規則（v2：沒有個人行動點數；工具無限用、魯米諾有次數；送驗花全隊實驗室額度、報告依時間回來）
{
  const C = GEN.generate(5, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }, { pid: 1, name: 'B', ci: 1 }], { pressure: false });
  ok(st.budget === C.labBudget && st.players[0].ap === undefined, '全隊共用實驗室額度，沒有個人點數');
  ok(!FS.act(C, st, 0, { type: 'gear', tools: ['camera', 'luminol', 'prints', 'swab'] }).ok, '最多帶 3 件');
  ok(FS.act(C, st, 0, { type: 'gear', tools: ['camera', 'luminol', 'swab'] }).ok && st.players[0].lum === C.lumCharges, '帶魯米諾 → 有 ' + C.lumCharges + ' 次');
  ok(FS.act(C, st, 0, { type: 'gear', tools: ['camera', 'luminol', 'thermo'] }).ok && st.budget === C.labBudget, '換裝備免費');
  ok(!FS.act(C, st, 0, { type: 'use', obj: 'body', act: 'wound' }).ok, '離屍體太遠不能拍');
  at(st, 0, FS.objById(C, 'body')); const r = FS.act(C, st, 0, { type: 'use', obj: 'body', act: 'wound' });
  ok(r.ok && FS.hasEv(st, 'E_wound') && st.budget === C.labBudget, '近拍傷口不花額度、拿到證據');
  ok(!FS.act(C, st, 0, { type: 'use', obj: 'body', act: 'wound' }).ok, '同一件事不用做兩次');
  // 魯米諾次數
  let used = 0; for (const id of ['floor_living', 'floor_study', 'floor_kitchen', 'w_statue']) { const o = FS.objById(C, id); at(st, 0, o); if (FS.act(C, st, 0, { type: 'use', obj: id, act: 'lum' }).ok) used++; }
  ok(used === C.lumCharges && st.players[0].lum === 0, `魯米諾用 ${C.lumCharges} 次就空了`);
  at(st, 0, FS.objById(C, 'w_statue')); ok(FS.options(C, st, 0, 'w_statue').some(x => x.why && /用完/.test(x.why)), '用完時按鈕會說要回車上補充');
  ok(!FS.act(C, st, 0, { type: 'refill' }).ok, '不在車旁不能補充');
  at(st, 0, C.start[0]); ok(FS.act(C, st, 0, { type: 'refill' }).ok && st.players[0].lum === C.lumCharges, '回車上補充魯米諾（免費）');
  // 送實驗室：花全隊額度、時間到才回來
  at(st, 1, FS.objById(C, 'phone')); ok(FS.act(C, st, 1, { type: 'bag', obj: 'phone' }).ok && st.obj.phone.gone, '手機裝袋（免費），從現場消失');
  at(st, 1, C.start[1]); ok(FS.act(C, st, 1, { type: 'lab', obj: 'phone' }).ok && st.budget === C.labBudget - C.labCost[1], '送驗扣全隊實驗室額度');
  ok(!FS.hasEv(st, 'E_phone'), '報告還沒回來');
  for (let t = 0; t < C.labSec - 2; t++) FS.tick(C, st, 1); ok(!FS.hasEv(st, 'E_phone'), `${C.labSec} 秒前還沒回來`);
  for (let t = 0; t < 4; t++) FS.tick(C, st, 1); ok(FS.hasEv(st, 'E_phone'), '時間到 → 實驗室報告回來');
  st.budget = 2; const w = C.objects.find(o => o.courier); at(st, 0, w); ok(!FS.act(C, st, 0, { type: 'courier', obj: w.id }).ok, '額度不夠就不能送驗');
  // 結案：隨時可以送出
  ok(FS.act(C, st, 1, { type: 'close' }).ok && st.phase === 'deduce', '隨時可以結案');
  ok(!FS.act(C, st, 0, { type: 'submit' }).ok, '沒填完不能送出');
  for (const [f, v] of [['culprit', C.culprit], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) FS.act(C, st, 0, { type: 'draft', field: f, v });
  FS.act(C, st, 0, { type: 'draft', field: 'keys', v: ['E_phone', 'E_wound', 'nonexist'] });
  ok(st.draft.keys.length <= 2 && !st.draft.keys.includes('nonexist'), '關鍵證據只能選已找到的');
  ok(FS.act(C, st, 0, { type: 'submit' }).ok && st.result.total >= 85, '答對 → 高分 ' + (st.result && st.result.total));
  ok(st.result.timeB === 10 && st.result.budB >= 0, '早結案有時間獎勵、省額度有預算獎勵');
  const s2 = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false }); s2.patience = 30; s2.budget = 0; s2.phase = 'deduce';
  for (const [f, v] of [['culprit', C.culprit], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) FS.act(C, s2, 0, { type: 'draft', field: f, v });
  FS.act(C, s2, 0, { type: 'submit' }); ok(s2.result.total < st.result.total, `拖很久、額度花光 → 分數較低（${s2.result.total} < ${st.result.total}）`);
}
// 6. 壓力系統（v2：插曲稀疏、不重疊）：劣化、分局長巡視、兇手動證物／逃跑、員警裡的菜鳥
{
  let seen = { decay: 0, boss_in: 0, boss_fail: 0, tampered: 0, rookie: 0, rookie_hit: 0, flee: 0, fled: 0, caught: 0 }; let forced = 0, overlap = 0, minGap = 1e9;
  for (let seed = 1; seed <= 40; seed++) {
    const C = GEN.generate(seed, 'hard'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }]);
    st.players[0].ap = 999; st.players[0].x = 1620; st.players[0].y = 1050;
    let lastEnd = -1e9, busy = false;
    for (let t = 0; t < 1600 && st.phase === 'play'; t += 0.2) {
      if (Math.abs(t - 200) < 0.1) { for (const id of ['E_shoe', 'E_phone']) st.found.push({ id, n: 0 }); }
      for (const e of FS.tick(C, st, 0.2)) { if (e.k in seen) seen[e.k]++; if (e.k === 'boss_in' || e.k === 'rookie') minGap = Math.min(minGap, st.clock - lastEnd); }
      const nowBusy = st.boss.mode === 'in' || st.cops.some(c => c.mode === 'in');
      if (st.boss.mode === 'in' && st.cops.some(c => c.mode === 'in')) overlap++;
      if (busy && !nowBusy) lastEnd = st.clock; busy = nowBusy;
    }
    if (st.phase === 'deduce') forced++;
  }
  console.log('壓力事件次數（40 局困難、玩家不動）：', seen, '強制推理：', forced, '插曲間最短安靜秒數：', Math.round(minGap));
  ok(seen.decay > 0 && seen.boss_in > 0 && seen.boss_fail > 0 && seen.tampered > 0 && seen.rookie > 0 && seen.rookie_hit > 0 && seen.flee > 0 && seen.fled > 0, '劣化、分局長、動證物、菜鳥、逃跑都會發生');
  ok(forced === 40, '分局長耐心歸零 → 強制結案');
  ok(overlap === 0, '分局長巡視和菜鳥闖禍不會同時發生');
  ok(minGap >= 60, `插曲之間至少安靜 60 秒（實際 ${Math.round(minGap)}）`);
  ok(seen.boss_in / 40 <= 4 && seen.rookie / 40 <= 5, `插曲很稀疏：每局分局長 ${(seen.boss_in / 40).toFixed(1)} 次、菜鳥 ${(seen.rookie / 40).toFixed(1)} 次`);
  // 跟著想逃的人 → 攔得下來
  const C = GEN.generate(9, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }]); st.players[0].ap = 999;
  const n = st.npcs.find(x => x.id === C.culprit); st.players[0].x = n.x + 30; st.players[0].y = n.y;
  for (const id of ['E_shoe', 'E_phone']) st.found.push({ id, n: 0 });
  let held = false; for (let t = 0; t < 30; t += 0.2) { for (const e of FS.tick(C, st, 0.2)) if (e.k === 'held') held = true; const q = st.npcs.find(x => x.id === C.culprit); st.players[0].x = q.x + 20; st.players[0].y = q.y; }
  ok(held && FS.hasEv(st, 'E_held'), '跟著想逃的人 → 攔下並記錄可疑舉動');
}
// 7. 員警：人數依難度、菜鳥是誰由亂數決定、平常只巡邏；跑去碰菜鳥 → 被趕回崗位
{
  const who = new Set();
  for (const [d, n, rk] of [['easy', 3, 1], ['normal', 4, 1], ['hard', 5, 2]]) for (let seed = 1; seed <= 30; seed++) {
    const C = GEN.generate(seed, d), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false });
    ok(st.cops.length === n && st.cops.filter(c => c.rk).length === rk, `${d}#${seed} ${n} 位員警、${rk} 位菜鳥`);
    if (d === 'normal') who.add(st.cops.findIndex(c => c.rk));
    for (let t = 0; t < 60; t += 0.2) FS.tick(C, st, 0.2);
    ok(st.cops.every(c => FS.walkable(C, c.x, c.y) && c.mode !== 'in'), `${d}#${seed} 關掉壓力時員警只會巡邏`);
  }
  ok(who.size >= 3, `菜鳥每局是不同位員警（出現過 ${who.size} 種）`);
  const C = GEN.generate(11, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false }); st.players[0].ap = 999;
  const R = st.cops.find(c => c.rk); st.forceRookie = 'body'; const ev = FS.tick(C, st, 0.2);
  ok(ev.some(e => e.k === 'rookie' && e.cop === R.id) && R.mode === 'in', '菜鳥動手 → 發出警報（指出是哪位員警）');
  let stopped = false; for (let t = 0; t < 20 && !stopped; t += 0.2) { st.players[0].x = R.x + 30; st.players[0].y = R.y; for (const e of FS.tick(C, st, 0.2)) if (e.k === 'rookie_stop') stopped = true; }
  ok(stopped && R.mode === 'back' && R.known, '碰到菜鳥 → 被趕回崗位，之後標記為已知菜鳥');
  const s3 = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false }); s3.players[0].x = 300; s3.players[0].y = 690; s3.forceRookie = 'body'; let hit = null;
  for (let t = 0; t < 60 && !hit; t += 0.2) for (const e of FS.tick(C, s3, 0.2)) if (e.k === 'rookie_hit') hit = e;
  ok(!!hit, '沒人攔 → 菜鳥闖禍');
}
// 7b. 電燈開關：燈亮著看不到螢光；關燈才能記錄；開燈後記號留著
{
  const C = GEN.generate(31, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }, { pid: 1, name: 'B', ci: 1 }], { pressure: false });
  ok(C.switches.length === 3 && C.switches.every(k => st.lights[k] === true), '客廳、書房、廚房各有電燈開關，開局燈都亮著');
  at(st, 0, C.start[0]); FS.act(C, st, 0, { type: 'gear', tools: ['luminol', 'camera', 'prints'] });
  const fl = FS.objById(C, 'floor_living'); at(st, 0, fl);
  ok(FS.act(C, st, 0, { type: 'use', obj: 'floor_living', act: 'lum' }).ok && !FS.hasEv(st, 'E_floor_living'), '燈亮著噴魯米諾：還看不到結果');
  ok(!FS.act(C, st, 0, { type: 'use', obj: 'floor_living', act: 'lum_mk' }).ok, '燈亮著不能記錄螢光');
  ok(!FS.act(C, st, 1, { type: 'light', obj: 'sw_living' }).ok, '離開關太遠不能關燈');
  at(st, 1, FS.objById(C, 'sw_living'));
  ok(FS.act(C, st, 1, { type: 'light', obj: 'sw_living' }).ok && st.lights.living === false, '隊友關燈');
  ok(FS.act(C, st, 0, { type: 'use', obj: 'floor_living', act: 'lum_mk' }).ok && FS.hasEv(st, 'E_floor_living') && st.obj.floor_living.marked, '關燈後記錄螢光 → 證據進筆記本');
  FS.act(C, st, 1, { type: 'light', obj: 'sw_living' });
  ok(st.lights.living === true && st.obj.floor_living.marked && FS.hasEv(st, 'E_floor_living'), '開燈後螢光消失，但記號和證據留著');
}
// 8. 分局長：要求同步在狀態裡；完成後碰他 → 加點離開；沒做到 → 懲罰
{
  const C = GEN.generate(21, 'normal'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false });
  st.forceBoss = { kind: 'report', rep: 'wound' }; FS.tick(C, st, 0.2);
  ok(st.boss.mode === 'in' && st.boss.demand.rep === 'wound', '分局長進封鎖線，頭上要求：傷口照片');
  for (let t = 0; t < 5; t += 0.2) { st.players[0].x = st.boss.x; st.players[0].y = st.boss.y; FS.tick(C, st, 0.2); }
  ok(st.boss.mode === 'in', '還沒做到 → 碰他也不會走');
  st.found.push({ id: 'E_wound', n: 1 }); st.players[0].x = st.boss.x; st.players[0].y = st.boss.y; const ev = FS.tick(C, st, 0.2);
  ok(ev.some(e => e.k === 'boss_ok') && st.budget === C.labBudget + 2 && st.boss.mode === 'leave' && st.bossOk === 1, '做到後碰他 → 收下報告、實驗室額度 +2、離開');
  const s2 = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }, { pid: 1, name: 'B', ci: 1 }]); s2.players[0].x = 300; s2.players[0].y = 690; s2.players[1].x = 300; s2.players[1].y = 720;
  const p0 = s2.patience; s2.forceBoss = { kind: 'progress', pct: 100, wait: 5 }; let fl = 0; for (let t = 0; t < 8; t += 0.2) for (const e of FS.tick(C, s2, 0.2)) if (e.k === 'boss_fail') fl++;
  ok(fl === 1 && s2.costUp === 1 && s2.bossFail === 1 && s2.patience < p0 - 12, '不理他 → 耐心掉更快＋送驗變貴');
  s2.boss.mode = 'away'; s2.quietUntil = 0; s2.forceBoss = { kind: 'progress', pct: 100, wait: 3 }; for (let t = 0; t < 5; t += 0.2) FS.tick(C, s2, 0.2);
  const benched = Object.values(s2.players).find(p => p.benchUntil > s2.clock);
  ok(s2.bossFail === 2 && benched, '再不理 → 一位隊員被叫去寫報告');
  at(s2, benched.pid, FS.objById(C, 'body')); ok(!FS.act(C, s2, benched.pid, { type: 'use', obj: 'body', act: 'wound' }).ok, '被叫走的隊員暫時不能採證');
  // 每個案件的「報告」要求都做得到：一定有可採指紋與血液樣本；完整線索 → 進度 100%
  let feas = 0, full = 0;
  for (const d of ['easy', 'normal', 'hard']) for (let seed = 1; seed <= 100; seed++) {
    const C = GEN.generate(seed * 13 + 1, d);
    const samples = C.objects.flatMap(o => (o.acts || []).flatMap(a => [a.sample].concat((a.cond || []).map(c => c.sample)).filter(Boolean)));
    if (samples.some(x => x.kind === 'print') && samples.some(x => x.kind === 'blood') && C.objects.some(o => o.bag)) feas++;
    const all = Object.keys(C.evidence).filter(id => !['E_tod_wide', 'E_nails_ox', 'E_phone_wiped', 'E_shoe_rain'].includes(id) && !/^E_fp(wipe|con)_/.test(id));
    const s = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false }); if (FS.progress(C, s) === 0) { s.found = all.map((id, n) => ({ id, n })); if (FS.progress(C, s) === 100) full++; }
  }
  ok(feas === 300, `300 個案件都能交出指紋／血液／實驗室報告（${feas}）`);
  ok(full === 300, `開局進度 0%、完整線索進度 100%（${full}/300）`);
  // 同一份狀態在兩邊跑（伺服器 vs. 前端單機）結果完全一樣
  const a = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }]), b = JSON.parse(JSON.stringify(a));
  for (let t = 0; t < 400; t += 0.2) { FS.tick(C, a, 0.2); FS.tick(C, b, 0.2); }
  ok(JSON.stringify(a) === JSON.stringify(b), '壓力系統是決定性的（同狀態同結果）');
}
// 9. 新手教學：照教學步驟拿到的證據就能完整推理
{
  const C = GEN.generate(7, 'tut'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false, tut: true });
  const d = FS.deduce(C, st, ['E_wound', 'E_floor_living', 'E_wb_statue', 'E_fp_statue', 'E_phone']);
  ok(d.methods.length === 1 && d.methods[0] === C.method && d.suspects.length === 1 && d.suspects[0] === C.culprit && d.weapon === C.weapon && d.location === C.location, '教學步驟的證據 → 推理完整且正確');
  ok(C.labSec <= 10 && st.patience === 100, '教學：實驗室很快、分局長不會沒耐心');
}
// 10a. 比例尺：角色身高 H；3/4 俯視下家具比真實比例放大約 1.4 倍才不會看起來像玩具
{
  const C = GEN.generate(158, 'normal'), H = C.H, g = id => C.objects.find(o => o.id === id);
  const r = (v, lo, hi) => v >= lo * H && v <= hi * H;
  ok(H === 112 && C.map.wall >= H, `比例尺 H = 112、牆高 ${C.map.wall}（≥ H）`);
  ok(r(Math.hypot(g('body').w, g('body').h), 1.0, 1.3) && g('body').h < .7 * H, `屍體斜躺，對角長 ${Math.round(Math.hypot(g('body').w, g('body').h))}（約 1.05 H）`);
  ok(g('floor_living').w > g('sofa').w * 1.4 && g('floor_study').w > g('body').w * 1.4, '地毯比屍體、沙發大');
  ok(r(g('sofa').w, 1.7, 1.9) && g('sofa').h > H, `沙發長 ${g('sofa').w}（1.7–1.9 H）`);
  ok(r(g('bookshelf').h, 1.45, 1.55), `書櫃高 ${g('bookshelf').h}（≈1.5 H）`);
  ok(r(g('table').w, 1.05, 1.15) && r(g('desk').w, 1.5, 1.7) && r(g('w_hearth').w, 1.5, 1.7), '茶几 1.1 H、書桌 1.6 H、壁爐 1.6 H');
  ok(r(g('backdoor').h, 1.25, 1.35), `門高 ${g('backdoor').h}（≈1.3 H）`);
  const small = ['phone', 'w_teacup', 'w_opener', 'sw_living', 'w_glasses', 'w_knife', 'w_necktie'];
  ok(small.every(id => r(Math.max(g(id).w, g(id).h), .25, .6)), '小物件放大到看得清楚（0.25–0.6 H），但仍比角色小很多');
  ok(r(g('van').w, 2.5, 3.2) && r(g('tree').h, 1.8, 2.6) && g('courier').h === H && g('chief').h === H, '廂型車、路樹、快遞員、分局長比例一致');
}
// 10. 屍體一定畫在地毯上面（所有房間、所有手法，包括偽裝意外移屍到書房）
{
  let bad = 0, rooms = new Set();
  for (const diff of ['easy', 'normal', 'hard', 'tut']) for (let seed = 1; seed <= (diff === 'tut' ? 10 : 300); seed++) {
    const C = GEN.generate(seed, diff), order = FS.flatOrder(C), b = C.objects.find(o => o.id === 'body'); rooms.add(b.room);
    const bi = order.indexOf(b);
    if (order.some((o, i) => o.w * o.h >= 15000 && i > bi) || order.some((o, i) => o !== b && o.w * o.h < 15000 && i < bi) || !b.label || Math.hypot(b.w, b.h) < C.H || Math.hypot(b.w, b.h) > C.H * 1.3) bad++;
    if (!FS.walkable(C, b.x, b.y + b.h / 2 + 30) && !FS.walkable(C, b.x - b.w / 2 - 30, b.y) && !FS.walkable(C, b.x + b.w / 2 + 30, b.y)) bad++;
  }
  ok(bad === 0, `屍體畫在所有地毯之上、小證物之下、有「屍體（死者）」標籤、走得到旁邊（出現在 ${[...rooms].join('／')}）`);
}
// 11. 總分最多 100（獎勵另外顯示）
{
  const C = GEN.generate(5, 'easy'), st = FS.newGame(C, [{ pid: 0, name: 'A', ci: 0 }], { pressure: false }); st.phase = 'deduce';
  for (const [f, v] of [['culprit', C.culprit], ['method', C.method], ['weapon', C.weapon], ['location', C.location]]) FS.act(C, st, 0, { type: 'draft', field: f, v });
  st.found = C.objects.flatMap(o => (o.acts || []).flatMap(a => a.ev || [])).map(id => ({ id })); FS.act(C, st, 0, { type: 'draft', field: 'keys', v: C.keyEv || st.found.slice(0, 3).map(f => f.id) });
  FS.act(C, st, 0, { type: 'submit' }); const R = st.result;
  ok(R.total <= 100 && R.total === Math.min(100, R.base + R.bonus + R.pen) && R.bonus === R.timeB + R.budB, `總分上限 100（基本 ${R.base}＋獎勵 ${R.bonus} → ${R.total}）`);
}
// 12. 兇手想溜走：先有幾秒預警；人少可以叫員警攔；3 人以上自己碰
{
  const mk = (n) => { const C = GEN.generate(31, 'normal'); const ps = Array.from({ length: n }, (_, i) => ({ pid: i, name: 'P' + i, ci: i }));
    const st = FS.newGame(C, ps); st.found = Object.keys(C.evidence).map((id, k) => ({ id, n: k + 1 })); st.quietUntil = 1e9; st.boss.nextAt = 1e9; for (const c of st.cops) c.nextAt = 1e9; st.tamperAt = 1e9;
    for (const p of Object.values(st.players)) { p.x = C.start[0].x; p.y = C.start[0].y - 200; } // 都在屋內深處，離關係人遠
    return { C, st }; };
  const run = (C, st, sec, f) => { const ev = []; for (let t = 0; t < sec; t += 0.2) { for (const e of FS.tick(C, st, 0.2)) ev.push(e); if (f && f(ev)) break; } return ev; };
  { const { C, st } = mk(1); ok(FS.culpritHeat(C, st) >= 2, '測試設定：兇手熱度 ≥ 2');
    const ev = run(C, st, 30, ev => ev.some(e => e.k === 'nervous')); const n = st.npcs.find(x => x.id === C.culprit);
    ok(ev.some(e => e.k === 'nervous') && n.mode === 'nervous' && n.fleeAt - st.clock > 10, `單人：先緊張預警 ${Math.round(n.fleeAt - st.clock)} 秒才跑`);
    ok(!ev.some(e => e.k === 'flee'), '預警期間還沒真的跑');
    const r = FS.act(C, st, 0, { type: 'callcops' }); ok(r.ok && st.chase && st.cops.some(c => c.mode === 'chase'), '單人：按 E 叫員警去追');
    ok(!FS.act(C, st, 0, { type: 'callcops' }).ok, '員警已經在追，不會重複叫');
    const ev2 = run(C, st, 60, ev => ev.some(e => e.k === 'held' || e.k === 'fled'));
    ok(n.mode === 'held' && !st.fled && FS.hasEv(st, 'E_held') && !st.chase, '員警追上並攔下兇手');
    ok(st.cops.every(c => c.mode !== 'chase'), '員警攔完回崗位'); }
  { const { C, st } = mk(1); run(C, st, 30, ev => ev.some(e => e.k === 'nervous')); const n = st.npcs.find(x => x.id === C.culprit);
    const p = st.players[0]; p.x = n.x; p.y = n.y; run(C, st, 1); ok(n.mode === 'held', '預警時走過去碰他也能攔下'); }
  { const { C, st } = mk(1); const ev = run(C, st, 120, ev => ev.some(e => e.k === 'fled')); ok(ev.some(e => e.k === 'flee') && st.fled === C.culprit, '完全不理 → 兇手跑掉（扣分）'); }
  { const { C, st } = mk(2); run(C, st, 30, ev => ev.some(e => e.k === 'nervous')); const n = st.npcs.find(x => x.id === C.culprit); ok(Math.round(n.fleeAt - st.clock) <= 9 && FS.canCallCops(st), '2 人：預警 9 秒，也能叫員警'); }
  { const { C, st } = mk(3); run(C, st, 30, ev => ev.some(e => e.k === 'nervous')); const n = st.npcs.find(x => x.id === C.culprit);
    ok(Math.round(n.fleeAt - st.clock) <= 6 && !FS.act(C, st, 0, { type: 'callcops' }).ok, '3 人以上：預警 6 秒，要自己去攔'); }
}
console.log(fail ? `\n${fail} 項失敗（${okN} 項通過）` : `\n全部通過（${okN} 項）`); process.exit(fail ? 1 : 0);
