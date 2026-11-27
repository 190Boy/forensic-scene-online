// v15/v16 穩定度（瀏覽器）：A 教學鎖定非目標動作（員警仍可替你攔菜鳥）　A2 教學桌機＋手機從頭玩到完成　B 桌機＋手機完整一局到「再玩一局」　C 小遊戲各種中斷　D 連線兩人到再玩一局
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {')).replace(/forensic_v1\d_/, 'forensic_v16_');
eval(head + `
async function clickable(pg, sel, tag) {   // 按鈕整個在畫面內、沒有被別的東西蓋住
  const r = await pg.evaluate(sel => { const el = document.querySelector(sel); if (!el || !el.offsetParent) return { miss: true };
    el.scrollIntoView({ block: 'nearest' }); const b = el.getBoundingClientRect(), cx = b.left + b.width / 2, cy = b.top + b.height / 2, hit = document.elementFromPoint(cx, cy);
    return { in: b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1 && b.width > 8 && b.height > 8, top: !!hit && (el === hit || el.contains(hit)), hit: hit ? (hit.id || hit.className || hit.tagName) + '' : '' }; }, sel);
  if (r.miss || !r.in || !r.top) errors.push((tag || '') + ' 按鈕看不到或被蓋住：' + sel + ' ' + JSON.stringify(r)); return r;
}
async function nearCop(pg) { const c = await pg.evaluate(() => { const st = __fs.G.st; const c = st.cops.find(c => !c.rk && c.mode !== 'in') || st.cops[0]; return { id: c.id, x: c.vx != null ? c.vx : c.x, y: c.vy != null ? c.vy : c.y }; });
  await tp(pg, c.x + 40, c.y + 30); await pg.waitForFunction(id => __fs.G.nearId === 'cop:' + id, c.id, { timeout: 4000 }).catch(() => errors.push('站到員警旁邊沒提示')); await sleep(250); return c.id; }
async function nearSus(pg) { const n = await pg.evaluate(() => { const st = __fs.G.st; const n = st.npcs.find(n => n.mode === 'idle') || st.npcs[0]; n.path = []; return { id: n.id, x: n.vx != null ? n.vx : n.x, y: n.vy != null ? n.vy : n.y }; });
  await tp(pg, n.x + 30, n.y + 25); await pg.waitForFunction(id => __fs.G.nearId === 'npc:' + id, n.id, { timeout: 4000 }).catch(() => errors.push('站到關係人旁邊沒提示')); await sleep(250); return n.id; }
const canMove = async (pg, tag) => { const a = await pg.evaluate(() => ({ x: __fs.G.Me.x, mg: !!__fs.MG.on, pm: !!(__fs.G.st.players[__fs.G.me] || {}).mg })); await pg.keyboard.down('d'); await sleep(450); await pg.keyboard.up('d'); await pg.keyboard.down('a'); await sleep(450); await pg.keyboard.up('a');
  const moved = await pg.evaluate(x0 => { return __fs.G.Me.x !== x0 || __fs.G.Me.moving !== undefined; }, a.x); const b = await pg.evaluate(() => ({ mg: !!__fs.MG.on, pm: !!(__fs.G.st.players[__fs.G.me] || {}).mg }));
  if (b.mg || b.pm) errors.push(tag + '：還卡在小遊戲狀態 ' + JSON.stringify(b)); return !b.mg && !b.pm; };
async function moved(pg) { const x0 = await pg.evaluate(() => __fs.G.Me.x); await pg.keyboard.down('d'); await sleep(500); await pg.keyboard.up('d'); const x1 = await pg.evaluate(() => __fs.G.Me.x); await pg.keyboard.down('a'); await sleep(500); await pg.keyboard.up('a'); return Math.abs(x1 - x0) > 5; }
const stale = pg => pg.evaluate(() => ({ cards: document.querySelectorAll('#cards > *').length, toasts: document.querySelectorAll('#toasts .toast').length, logs: document.querySelectorAll('#log .lg').length, mg: !!__fs.MG.on, pmg: !!(__fs.G.st && __fs.G.st.players[__fs.G.me] || {}).mg, orders: __fs.G.st ? __fs.G.st.cops.filter(c => c.order).length : -1, briefed: __fs.G.st ? Object.keys(__fs.G.st.briefed || {}).length : -1, found: __fs.G.st ? __fs.G.st.found.length : -1, boss: __fs.G.st ? __fs.G.st.boss.mode : '', ov: __fs.G.ovKind || null, players: __fs.G.st ? Object.keys(__fs.G.st.players).length : 0 }));
(async () => {
  const br = await chromium.launch(); const T0 = Date.now(); const lap = n => console.log('⏱', n, Math.round((Date.now() - T0) / 1000) + 's');
  /* ---------- A. 新手教學鎖定：非當前目標的動作被隱藏；照順序仍可讓員警替你攔菜鳥 ---------- */
  { const tg = await page(br, { viewport: { width: 1280, height: 800 } });
    await tg.goto(BASE); await sleep(900); await tg.fill('#name', '百九'); await tg.click('#bTut'); await sleep(900);
    // 第一步就想拿工具／採證：應該被擋住
    await tp(tg, 336, 880); await sleep(300);
    const gated = await tg.evaluate(() => { const tools0 = (__fs.G.st.players[0].tools || []).slice(); __fs.doAct({ type: 'gear', tools: ['thermo', 'swab', 'shoe'] }); __fs.doAct({ type: 'use', obj: 'body', act: 'swab' }); return { i: __fs.G.tut.i, tools: (__fs.G.st.players[0].tools || []).slice(), swab: !!(__fs.G.st.obj.body && __fs.G.st.obj.body.done.swab), allow: __fs.tutAllows('body', 'swab') }; });
    console.log('A 第一步鎖定：', JSON.stringify(gated));
    if (gated.tools.length || gated.swab || gated.allow) errors.push('教學第一步不該能換裝或採血：' + JSON.stringify(gated));
    // 之後照順序走到調度「看住菜鳥」，再繼續把前面系統做完，讓員警替你攔菜鳥
    await tp(tg, 640, 718); await waitStep(tg, 1, 8000);
    await tutCop(tg); await act(tg, '聽取初步報告'); await waitStep(tg, 2);
    await act(tg, '看住菜鳥'); await waitStep(tg, 3);
    await tutSus(tg); await act(tg, '觀察嫌疑人'); await sleep(1300); await waitStep(tg, 4);
    await tutSus(tg); await act(tg, '周旋'); await waitStep(tg, 5);
    await van(tg); for (const t of ['camera', 'luminol', 'prints']) await tg.click('[data-tool="' + t + '"]'); await tg.click('#gearOk'); await sleep(300); await closeWin(tg);
    await toObj(tg, 'body');
    { const n = await tg.evaluate(() => [...document.querySelectorAll('#act button')].map(b => b.dataset.a || b.dataset.k).join(',')); if (n !== 'wound') errors.push('教學第 7 步清單不是只有近拍傷口：' + n); }
    await act(tg, '近拍傷口'); await toObj(tg, 'floor_living'); await act(tg, '噴灑魯米諾');
    await toObj(tg, 'sw_living'); await act(tg, '燈'); await toObj(tg, 'floor_living'); await act(tg, '記錄螢光位置');
    await toObj(tg, 'w_statue'); await act(tg, '噴灑魯米諾'); await act(tg, '記錄螢光位置'); await act(tg, '採集指紋');
    await van(tg); await tutAnalyze(tg, 'print'); await closeWin(tg);
    await van(tg); for (const t of ['thermo', 'swab', 'shoe']) await tg.click('[data-tool="' + t + '"]'); await tg.click('#gearOk'); await sleep(300); await closeWin(tg);
    await toObj(tg, 'body'); await act(tg, '量測肝溫'); await act(tg, '採集死者血液');
    await toObj(tg, 'phone'); await act(tg, '裝袋帶走');
    await toObj(tg, 'mud'); await act(tg, '採集鞋印');
    await van(tg); await tutAnalyze(tg, 'blood'); await tg.locator('[data-lab="phone"]').click(); await sleep(300); await closeWin(tg);
    await waitStep(tg, 19, 15000); console.log('A 順序做完 → 到第', (await tutStep(tg)) + 1, '步');
    await tg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 });
    await tutChase(tg, () => { const B = __fs.G.st.boss; return B.mode === 'in' ? { x: B.x, y: B.y } : null; }, 20);
    // 菜鳥：玩家站在車旁不動，由派去看菜鳥的員警攔下
    await tp(tg, 336, 880); await tg.waitForFunction(() => (__fs.G.st.cops || []).some(c => c.mode === 'in'), null, { timeout: 10000 });
    await waitStep(tg, 21, 45000);
    const how = await tg.evaluate(() => __fs.G.tut.ev.map(e => e.k).filter(k => /rookie/.test(k)).join(','));
    console.log('A 菜鳥由員警攔下：', how); if (!/rookie_guard/.test(how)) errors.push('教學：菜鳥步驟不是被員警攔下的（' + how + '）');
    await tg.evaluate(() => __fs.openNote()); await sleep(300); await tg.click('[data-tab="man"]'); await waitStep(tg, 22); await closeWin(tg);
    await clickable(tg, '#bClose', '教學'); await tg.click('#bClose'); await waitStep(tg, 23); await sleep(400);
    await deduceAndSubmit(tg, null); await waitStep(tg, 24); await sleep(400);
    console.log('A 教學亂序：完成，步驟', (await tutStep(tg)) + 1, '/', TUT_N); await tg.close(); }
  lap('A');
  /* ---------- A2. 新手教學從第 1 步照順序玩到「🎉 教學完成！」：桌機（鍵盤）＋手機（點按鈕） ---------- */
  for (const [tag, vp] of [['桌機', { viewport: { width: 1280, height: 800 } }], ['手機', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const pg = await page(br, vp); await pg.goto(BASE); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bTut'); await sleep(900);
    try { await tutFull(pg, 'A2 ' + tag); } catch (e) { errors.push('A2 ' + tag + ' 教學：' + e.message); await shot(pg, 'tut_fail_' + tag); }
    await pg.close();
  }
  lap('A2');
  /* ---------- B. 桌機＋手機：完整一局 → 再玩一局 ---------- */
  for (const [tag, vp] of [['桌機', { viewport: { width: 1280, height: 800 } }], ['手機', { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true }]]) {
    const pg = await page(br, vp); const e0 = errors.length;
    await pg.goto(BASE + '?seed=' + (tag === '桌機' ? 2024 : 777)); await sleep(900);
    await clickable(pg, '#bSolo', tag + ' 大廳'); await pg.fill('#name', '百九'); await pg.click('#bSolo'); await sleep(800);
    await clickable(pg, '#win footer [data-close], #win header [data-close]', tag + ' 簡報'); await closeWin(pg); await pg.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); await sleep(200);
    // 選工具（點車子 → 點工具 → 確認）
    await tp(pg, 336, 880); await pg.waitForFunction(() => __fs.G.nearId === 'van', null, { timeout: 3000 }).catch(() => { });
    await clickable(pg, '#act [data-van]', tag + ' 車子'); await pg.click('#act [data-van]'); await sleep(400);
    for (const t of ['camera', 'thermo', 'luminol']) { await clickable(pg, '[data-tool="' + t + '"]', tag + ' 工具'); await pg.click('[data-tool="' + t + '"]'); }
    await clickable(pg, '#gearOk', tag + ' 確認裝備'); await pg.click('#gearOk'); await sleep(300); await closeWin(pg);
    // 員警：報告＋調度
    await nearCop(pg); await clickable(pg, '#act button[data-brief]', tag + ' 聽取報告'); await pg.click('#act button[data-brief]'); await sleep(500);
    if (!(await pg.evaluate(() => Object.keys(__fs.G.st.briefed).length))) errors.push(tag + '：聽取報告沒反應');
    await clickable(pg, '#act button[data-disp="door"]', tag + ' 守大門'); await pg.click('#act button[data-disp="door"]'); await sleep(400);
    if (!(await pg.evaluate(() => __fs.G.st.cops.some(c => c.order === 'door')))) errors.push(tag + '：守大門沒派成功');
    // 關係人：觀察＋周旋
    await nearSus(pg); await clickable(pg, '#act button[data-obs]', tag + ' 觀察'); await pg.click('#act button[data-obs]'); await sleep(1600);
    await nearSus(pg); await clickable(pg, '#act button[data-calm]', tag + ' 周旋'); await pg.click('#act button[data-calm]'); await sleep(400);
    if (!(await pg.evaluate(() => Object.keys(__fs.G.st.obs).length && __fs.G.st.npcs.some(n => n.calmUntil)))) errors.push(tag + '：觀察／周旋沒反應');
    // 小遊戲：拍傷口、量肝溫
    await toObj(pg, 'body'); await act(pg, '近拍傷口', { score: .9 }); await toObj(pg, 'body'); await act(pg, '量測肝溫', { score: .9 });
    if (!(await moved(pg))) errors.push(tag + '：做完小遊戲後不能走路');
    // 分局長：要死亡時間 → 走過去交差
    await pg.evaluate(() => { const st = __fs.G.st; st.quietUntil = 0; st.forceBoss = { kind: 'report', rep: 'tod', wait: 400 }; });
    await pg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 }).catch(() => errors.push(tag + '：分局長沒進場'));
    for (let i = 0; i < 30 && !(await pg.evaluate(() => __fs.G.st.bossOk)); i++) { const b = await pg.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(pg, b.x + 10, b.y + 12); await sleep(250); }
    if (!(await pg.evaluate(() => __fs.G.st.bossOk))) errors.push(tag + '：走到分局長身上沒交差');
    // 筆記本
    await clickable(pg, '#bNote', tag + ' 筆記本'); await pg.click('#bNote'); await sleep(300);
    for (const t of ['ev', 'sus', 'cop', 'man', 'log']) { await pg.click('#win [data-tab="' + t + '"]'); await sleep(120); }
    await closeWin(pg);
    // 結案推理 → 送出 → 勝利畫面
    await clickable(pg, '#bClose', tag + ' 結案推理'); await pg.click('#bClose'); await sleep(800);
    await deduceAndSubmit(pg, null);
    await pg.waitForFunction(() => __fs.G.st.phase === 'result' && __fs.G.ovKind, null, { timeout: 5000 }).catch(() => errors.push(tag + '：沒有出現結案畫面'));
    const R = await pg.evaluate(() => __fs.G.st.result); if (!R || !R.rows.every(r => r.ok)) errors.push(tag + '：照真相作答卻沒全對 ' + JSON.stringify(R && R.rows.map(r => r.ok)));
    await shot(pg, tag === '桌機' ? 'result_desktop' : 'result_mobile');
    await clickable(pg, '#again', tag + ' 再玩一局'); await pg.click('#again'); await sleep(1200);
    await closeWin(pg); await pg.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); await sleep(300);
    const s = await stale(pg); console.log('B ' + tag + ' 再玩一局之後：', JSON.stringify(s));
    if (s.cards || s.mg || s.pmg || s.orders || s.briefed || s.found || s.boss !== 'away' || s.logs > 2) errors.push(tag + '：再玩一局後還留著上一局的東西 ' + JSON.stringify(s));
    if (!(await moved(pg))) errors.push(tag + '：新的一局不能走路');
    console.log('B ' + tag + '：' + (errors.length === e0 ? '完整一局 OK（評價 ' + R.rank + '，' + R.total + ' 分）' : '有問題')); await pg.close();
  }
  lap('B');
  /* ---------- C. 小遊戲中斷：連按、Esc、處理中按 Esc、耐心歸零 ---------- */
  { const pg = await page(br, { viewport: { width: 1280, height: 800 } });
    await pg.goto(BASE + '?seed=158'); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bSolo'); await sleep(700);
    await closeWin(pg); await pg.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); await sleep(200);
    await van(pg); for (const t of ['camera', 'thermo', 'luminol']) await pg.click('[data-tool="' + t + '"]'); await pg.click('#gearOk'); await sleep(300); await closeWin(pg);
    await toObj(pg, 'body');
    // 連按兩次開始 → 只有一個小遊戲；Esc 取消 → 可以走路、可以重做
    const k = await pg.locator('#act button', { hasText: '近拍傷口' }).first().getAttribute('data-key');
    await pg.keyboard.press(k); await pg.keyboard.press(k); await sleep(500);
    if (!(await pg.evaluate(() => __fs.MG.on))) errors.push('C：連按兩次後小遊戲沒開');
    await pg.keyboard.press('Escape'); await sleep(500);
    if (!(await moved(pg))) errors.push('C：Esc 取消後不能走路');
    if (await pg.evaluate(() => __fs.MG.on || !!__fs.G.st.players[0].mg)) errors.push('C：Esc 後還在小遊戲狀態');
    // 做完 → 「處理中」時按 Esc → 結果照算
    await toObj(pg, 'body'); await act(pg, '近拍傷口', { manual: true }); await pg.evaluate(() => __fs.MG.finish(.9)); await sleep(150); await pg.keyboard.press('Escape');
    await pg.waitForFunction(() => !__fs.MG.on, null, { timeout: 8000 }); await sleep(600);
    if (!(await pg.evaluate(() => __fs.G.st.obj.body.done.wound))) errors.push('C：處理中按 Esc，結果被丟掉了');
    // 處理中又開另一個小遊戲 → 新的不會被舊的計時器關掉
    await toObj(pg, 'body'); await act(pg, '量測肝溫', { manual: true }); await pg.evaluate(() => __fs.MG.finish(.9)); await sleep(100);
    await pg.evaluate(() => __fs.MG.open({ kind: 'photo', obj: 'body', act: 'livid', title: 't', minSec: 0, onDone: () => { }, onCancel: () => { } })); await sleep(5500);
    if (!(await pg.evaluate(() => __fs.MG.on))) errors.push('C：舊的「處理中」計時器把新開的小遊戲關掉了');
    await pg.evaluate(() => __fs.MG.close()); await sleep(300);
    // 小遊戲中耐心歸零 → 小遊戲關掉、直接進推理
    await toObj(pg, 'body'); await act(pg, '近拍屍斑', { manual: true }).catch(() => { });
    if (!(await pg.evaluate(() => __fs.MG.on))) { await toObj(pg, 'body'); const b = pg.locator('#act button[data-mg]:not([disabled])').first(); if (await b.count()) { await b.click(); await sleep(500); } }
    await pg.evaluate(() => { __fs.G.st.patience = 0.01; }); await pg.waitForFunction(() => __fs.G.st.phase === 'deduce', null, { timeout: 8000 }).catch(() => errors.push('C：耐心歸零沒進推理'));
    await sleep(800); const c = await pg.evaluate(() => ({ mg: __fs.MG.on, ov: __fs.G.ovKind }));
    console.log('C 耐心歸零時在做小遊戲：', JSON.stringify(c)); if (c.mg || c.ov !== 'deduce') errors.push('C：耐心歸零時小遊戲沒關、推理沒打開 ' + JSON.stringify(c));
    await pg.close(); }
  lap('C');
  /* ---------- D. 連線兩人：同時操作 → 結案 → 再玩一局 ---------- */
  { const p1 = await page(br, { viewport: { width: 1280, height: 800 } }), p2 = await page(br, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await p1.goto(BASE); await sleep(800); await p1.fill('#name', '百九'); await p1.click('#bCreate'); await p1.click('#bCreate', { timeout: 800 }).catch(() => { });   // 連按兩次也只開一間
    await p1.waitForFunction(() => /\\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 8000 });
    const code = await p1.textContent('#rmCode');
    await p2.goto(BASE + '?room=' + code); await sleep(800); await p2.fill('#name', 'Cynthia'); await p2.click('#bJoin'); await sleep(1200);
    await clickable(p1, '#rmStart', 'D 房間'); await p1.click('#rmStart'); await sleep(1500);
    for (const p of [p1, p2]) { await closeWin(p); await p.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); }
    const sw = await p1.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'sw_living'); return { x: o.x, y: o.y }; });
    await Promise.all([walkTo(p1, sw.x, sw.y + 30, 40), walkTo(p2, sw.x + 20, sw.y + 30, 40)]);
    await Promise.all([p1.evaluate(() => __fs.doAct({ type: 'light', obj: 'sw_living' })), p2.evaluate(() => __fs.doAct({ type: 'light', obj: 'sw_living' }))]); await sleep(900);
    const L = await Promise.all([p1, p2].map(p => p.evaluate(() => __fs.G.st.lights.living)));
    console.log('D 兩人同時按電燈：', JSON.stringify(L)); if (L[0] !== L[1]) errors.push('D：兩人看到的燈不一樣 ' + JSON.stringify(L));
    await p1.click('#bClose'); await sleep(1000);
    // v17：推理視窗關掉之後（房主、隊友都一樣）按「⚖️ 回到結案推理」回得去，草稿還在
    { const culs = await p1.evaluate(() => [__fs.C.suspects[1].id, __fs.C.suspects[2].id]);   // v18：每個人各自的草稿
      for (const p of [p1, p2]) await p.waitForFunction(() => __fs.G.ovKind === 'deduce', null, { timeout: 5000 }).catch(() => { });
      await p1.click('[data-cul="' + culs[0] + '"]'); await p2.click('[data-cul="' + culs[1] + '"]'); await sleep(500);
      for (const [p, t, cul] of [[p2, '隊友', culs[1]], [p1, '房主', culs[0]]]) {
        await p.waitForFunction(() => __fs.G.ovKind === 'deduce', null, { timeout: 5000 }).catch(() => errors.push('D：' + t + '沒打開推理'));
        await closeWin(p); await p.click('#bNote'); await sleep(300); await closeWin(p);
        const lb = await p.evaluate(() => { const b = document.querySelector('#bClose'); return { vis: !!b.offsetParent && !b.disabled, t: b.textContent, ov: __fs.G.ovKind }; });
        if (!lb.vis || !/回到結案推理/.test(lb.t) || lb.ov) errors.push('D：' + t + '關掉推理後沒有「回到結案推理」按鈕 ' + JSON.stringify(lb));
        await p.click('#bClose'); await sleep(400);
        const r = await p.evaluate(c => ({ ov: __fs.G.ovKind, draft: __fs.G.st.draft.culprit === c, on: !!document.querySelector('#win .su.on[data-cul="' + c + '"]') }), cul);
        console.log('D ' + t + ' 回到推理：', JSON.stringify(r)); if (r.ov !== 'deduce' || !r.draft || !r.on) errors.push('D：' + t + '按結案推理回不到推理／草稿不見 ' + JSON.stringify(r)); } }
    await deduceAndSubmit(p1, null); if ((await p1.evaluate(() => __fs.G.st.phase)) !== 'deduce') errors.push('D：只有房主送出就開獎了');
    await deduceAndSubmit(p2, null);   // v18：隊友也送出自己的報告 → 一起開獎
    await p2.waitForFunction(() => __fs.G.st.phase === 'result' && __fs.G.ovKind, null, { timeout: 6000 }).catch(() => errors.push('D：隊友沒看到結案畫面'));
    await clickable(p1, '#again', 'D 房主再玩一局'); await p1.click('#again'); await sleep(1500);
    await p2.waitForFunction(() => !__fs.G.st && !document.querySelector('#roomScr').classList.contains('hidden'), null, { timeout: 6000 }).catch(() => errors.push('D：隊友沒回到房間'));
    await p1.click('#rmStart'); await sleep(1800);
    for (const p of [p1, p2]) { await closeWin(p); await p.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); } await sleep(300);
    for (const [p, t] of [[p1, '房主'], [p2, '隊友']]) { const s = await stale(p); console.log('D ' + t + ' 新的一局：', JSON.stringify(s)); if (s.cards || s.mg || s.pmg || s.orders || s.briefed || s.found || s.players !== 2 || s.logs > 3) errors.push('D：' + t + '新的一局還留著舊東西 ' + JSON.stringify(s)); }
    const rooms = await p1.evaluate(() => __fs.G.code); console.log('D 房號：', rooms);
    await p1.close(); await p2.close(); }
  lap('D'); await br.close();
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無'); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('頁面／檢查錯誤：', errors); process.exit(1); });
`);
