// v14：①聽取員警初步報告（桌機卡片在左側欄、記進筆記本）②調度員警（守大門／盯菜鳥＋名牌徽章）
//      ③觀察嫌疑人＋周旋安撫 ④手機版照常 ⑤連線同步調度＋按人數放慢節奏
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {')).replace("forensic_v13_", "forensic_v14_");
eval(head + `
async function nearCop(pg, pick) { // 站到一位一般員警旁邊（不是已知菜鳥）
  const c = await pg.evaluate(pick => { const st = __fs.G.st; st.quietUntil = 1e9; const cs = st.cops.filter(c => !c.rk && c.mode !== 'in'); const c = cs[pick % cs.length]; return { id: c.id, x: c.vx != null ? c.vx : c.x, y: c.vy != null ? c.vy : c.y }; }, pick);
  await tp(pg, c.x + 40, c.y + 30); await pg.waitForFunction(id => __fs.G.nearId === 'cop:' + id, c.id, { timeout: 4000 }).catch(() => errors.push('站到員警旁邊，提示卻不是他：' + c.id)); await sleep(250); return c.id;
}
async function nearSus(pg) {
  const n = await pg.evaluate(() => { const st = __fs.G.st; st.quietUntil = 1e9; const n = st.npcs.find(n => n.mode === 'idle') || st.npcs[0]; n.path = []; return { id: n.id, x: n.vx != null ? n.vx : n.x, y: n.vy != null ? n.vy : n.y }; });
  await tp(pg, n.x + 30, n.y + 25); await pg.waitForFunction(id => __fs.G.nearId === 'npc:' + id, n.id, { timeout: 4000 }).catch(() => errors.push('站到關係人旁邊，提示卻不是他')); await sleep(250); return n.id;
}
const stageClean = pg => pg.evaluate(() => { const sbw = __fs.stage().OX, bad = new Set();
  for (let x = sbw + 4; x < innerWidth; x += 16) for (let y = 2; y < innerHeight; y += 16) { const e = document.elementFromPoint(x, y); if (e && e.id !== 'cv' && !e.closest('#act')) bad.add((e.id || e.className || e.tagName) + ''); }
  return { bad: [...bad], toasts: document.querySelectorAll('#toasts .toast').length, floats: __fs.G.floats.length }; });
(async () => {
  const br = await chromium.launch();
  /* ---------- 桌機 1280×800 單人 ---------- */
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  await pg.goto(BASE + '?seed=158'); await sleep(900);
  await pg.fill('#name', '百九'); await pg.click('#bSolo'); await sleep(700);
  await closeWin(pg); await pg.click('#win footer [data-close]').catch(() => { }); await sleep(200);
  { const r = await pg.evaluate(() => ({ pace: __fs.G.st.pace, hud: document.querySelector('#hud').textContent.includes('×2.1'), lab: __fs.G.st.cops.filter(c => __fs.G.st.briefed[c.id] == null).length }));
    console.log('單人節奏：', JSON.stringify(r)); if (r.pace !== 2.1 || !r.hud) errors.push('單人節奏不是 ×2.1 或側欄沒顯示：' + JSON.stringify(r)); }
  // ① 聽取初步報告
  const cop = await nearCop(pg, 0);
  { const t = await pg.textContent('#act'); if (!/聽取初步報告/.test(t) || !/守住大門/.test(t) || !/看住菜鳥/.test(t) || !/回原位待命/.test(t)) errors.push('員警小清單缺按鈕：' + t); }
  await pg.keyboard.press('e'); await sleep(600);
  { const r = await pg.evaluate(id => { const c = document.querySelector('#cards .evc.rc'), cr = c && c.getBoundingClientRect(); return { card: c ? c.textContent.slice(0, 90) : '', r: cr ? Math.round(cr.right) : -1, sbw: Math.round(__fs.stage().OX), briefed: __fs.G.st.briefed[id] != null, rep: __fs.C.copReports[id].map(x => x.t), log: [...document.querySelectorAll('#log .lg')].some(x => /警員初步報告/.test(x.textContent)) }; }, cop);
    console.log('初步報告卡片：', JSON.stringify(r));
    if (!/警員初步報告/.test(r.card) || r.r > r.sbw) errors.push('初步報告卡不在左側欄：' + JSON.stringify(r));
    if (!r.briefed || !r.log) errors.push('聽完報告沒有記錄');
    const cul = await pg.evaluate(() => __fs.C.suspects.find(s => s.id === __fs.C.culpritId) || {}); if (r.rep.some(t => /兇手|就是他/.test(t))) errors.push('員警報告直接講出兇手'); }
  { const s = await stageClean(pg); if (s.bad.length || s.toasts || s.floats) errors.push('聽報告時畫布上有浮動元素：' + JSON.stringify(s)); }
  // ② 調度：守大門
  await pg.click('#act button[data-disp="door"]'); await sleep(500);
  { const r = await pg.evaluate(id => { const c = __fs.G.st.cops.find(c => c.id === id); return { order: c.order, mode: c.mode }; }, cop); console.log('派去守大門：', JSON.stringify(r)); if (r.order !== 'door') errors.push('守大門沒派成功：' + JSON.stringify(r)); }
  { const t0 = Date.now(); let lastD = 1e9, jumps = 0, prev = null;
    while (Date.now() - t0 < 25000) { const q = await pg.evaluate(id => { const c = __fs.G.st.cops.find(c => c.id === id), g = __fs.C.guardSpots.door; return { m: c.mode, x: c.vx, y: c.vy, d: Math.hypot(c.vx - g.x, c.vy - g.y) }; }, cop);
      if (prev && Math.hypot(q.x - prev.x, q.y - prev.y) > 60) jumps++; prev = q; if (q.m === 'guard') break; await sleep(150); }
    const m = await pg.evaluate(id => __fs.G.st.cops.find(c => c.id === id).mode, cop); console.log('走到大門：', m, '瞬移次數', jumps, Math.round((Date.now() - t0) / 100) / 10 + 's');
    if (m !== 'guard') errors.push('員警沒走到大門'); if (jumps) errors.push('員警走路會瞬移：' + jumps); }
  // 另一位去盯菜鳥
  const cop2 = await nearCop(pg, 1);
  if (cop2 !== cop) { await pg.click('#act button[data-disp="rookie"]'); await sleep(400); const o = await pg.evaluate(id => __fs.G.st.cops.find(c => c.id === id).order, cop2); console.log('盯菜鳥：', o); if (o !== 'rookie') errors.push('盯菜鳥沒派成功'); }
  // 截圖：走到守門員警旁邊再看一次報告 → 側欄卡片＋名牌徽章
  { const g = await pg.evaluate(() => __fs.C.guardSpots.door); await tp(pg, g.x + 50, g.y + 40); await pg.waitForFunction(id => __fs.G.nearId === 'cop:' + id, cop, { timeout: 4000 }).catch(() => { });
    await pg.keyboard.press('e'); await sleep(700);
    const r = await pg.evaluate(() => ({ act: document.querySelector('#act').textContent, card: (document.querySelector('#cards .evc.rc') || {}).textContent || '' }));
    if (!/守門中/.test(r.act)) errors.push('小清單沒顯示守門中：' + r.act.slice(0, 80));
    await pg.screenshot({ path: '/workspace/forensic_v14_officer_dispatch.png' }); }
  // 筆記本：員警分頁
  await pg.keyboard.press('n'); await sleep(400); await pg.click('#win [data-tab="cop"]'); await sleep(300);
  { const t = await pg.textContent('#win .body'); console.log('筆記本員警分頁：', t.replace(/\\s+/g, ' ').slice(0, 160)); if (!/初步報告/.test(t) || !/守門中/.test(t)) errors.push('筆記本員警分頁不完整'); }
  await shot(pg, 'note_cops'); await closeWin(pg);
  // ③ 觀察嫌疑人
  await pg.evaluate(() => { document.querySelector('#cards').innerHTML = ''; });
  const sus = await nearSus(pg);
  { const t = await pg.textContent('#act'); if (!/觀察嫌疑人/.test(t) || !/周旋／安撫/.test(t)) errors.push('關係人小清單缺按鈕：' + t); }
  await pg.click('#act button[data-obs]'); await sleep(1700);
  { const r = await pg.evaluate(id => ({ obs: !!__fs.G.st.obs[id], card: (document.querySelector('#cards .evc.rc') || {}).textContent || '', tells: __fs.C.tells[id] }), sus);
    console.log('觀察結果：', JSON.stringify(r)); if (!r.obs || !/觀察/.test(r.card)) errors.push('觀察沒有出結果卡'); }
  { const s = await stageClean(pg); if (s.bad.length || s.toasts || s.floats) errors.push('觀察時畫布上有浮動元素：' + JSON.stringify(s)); }
  await pg.screenshot({ path: '/workspace/forensic_v14_suspect_observe.png' });
  await pg.keyboard.press('n'); await sleep(400); await pg.click('#win [data-tab="sus"]'); await sleep(300);
  { const t = await pg.textContent('#win .body'); if (!/👀 觀察/.test(t)) errors.push('筆記本關係人沒有觀察紀錄'); }
  await shot(pg, 'note_observe'); await closeWin(pg);
  // 周旋
  await nearSus(pg); const calmId = await pg.getAttribute('#act button[data-calm]', 'data-calm'); await pg.click('#act button[data-calm]'); await sleep(500);   // v19：檢查實際被周旋的那個人（最近的關係人不一定是剛才觀察的那位）
  { const r = await pg.evaluate(id => { const n = __fs.G.st.npcs.find(n => n.id === id); return { id, cu: n.calmUntil, T: __fs.G.st.clock, news: (__fs.G.st.news || []).slice(-1)[0] }; }, calmId);
    console.log('周旋：', JSON.stringify(r)); if (!(r.cu > r.T + 40)) errors.push('周旋沒有延後他的行動'); }
  // 工具次數顯示
  await van(pg); for (const t of ['camera', 'luminol', 'thermo']) await pg.click('[data-tool="' + t + '"]').catch(() => { }); { const t = await pg.textContent('#win'); if (!/每次出門 \\d 次/.test(t)) errors.push('鑑識車沒顯示工具次數'); } await pg.click('#gearOk').catch(() => { }); await sleep(300); await closeWin(pg);
  { const n = await pg.evaluate(() => [...document.querySelectorAll('#bar .slot .chg')].map(x => x.textContent)); console.log('工具格次數：', n.join(' ')); if (n.length < 3) errors.push('工具格沒顯示剩餘次數'); }
  /* ---------- 手機 390×844 ---------- */
  const mp = await page(br, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await mp.goto(BASE + '?seed=158'); await sleep(900); await mp.fill('#name', '百九'); await mp.click('#bSolo'); await sleep(700);
  await closeWin(mp); await mp.click('#win footer [data-close]').catch(() => { }); await sleep(200);
  await nearCop(mp, 0); await mp.click('#act button[data-brief]'); await sleep(600);
  { const t = await mp.evaluate(() => (document.querySelector('#cards .evc.rc') || {}).textContent || ''); console.log('手機初步報告：', t.slice(0, 60)); if (!/警員初步報告/.test(t)) errors.push('手機沒有初步報告卡'); }
  await mp.click('#act button[data-disp="rookie"]'); await sleep(300);
  await nearSus(mp); await mp.click('#act button[data-obs]'); await sleep(1700);
  { const t = await mp.evaluate(() => (document.querySelector('#cards .evc.rc') || {}).textContent || ''); if (!/觀察/.test(t)) errors.push('手機沒有觀察卡'); }
  await shot(mp, 'mobile_observe');
  /* ---------- 連線：兩人調度同步 ---------- */
  const p1 = await page(br, { viewport: { width: 1280, height: 800 } }), p2 = await page(br, { viewport: { width: 1280, height: 800 } });
  await p1.goto(BASE); await sleep(800); await p1.fill('#name', '百九'); await p1.click('#bCreate');
  await p1.waitForFunction(() => /\\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 8000 });
  const code = await p1.textContent('#rmCode');
  await p2.goto(BASE + '?room=' + code); await sleep(800); await p2.fill('#name', 'Cynthia'); await p2.click('#bJoin'); await sleep(1200);
  await p1.click('#rmStart'); await sleep(1500);
  for (const p of [p1, p2]) await p.click('#win footer [data-close]').catch(() => { });
  { const pace = await p2.evaluate(() => __fs.G.st.pace); console.log('連線兩人節奏：', pace); if (pace !== 1.65) errors.push('兩人節奏不是 1.65：' + pace); }
  const oc = await p1.evaluate(() => { const G = __fs.G, cs = G.st.cops.filter(c => c.mode === 'post').sort((a, b) => Math.hypot(a.x - G.Me.x, a.y - G.Me.y) - Math.hypot(b.x - G.Me.x, b.y - G.Me.y)); const c = cs[0] || G.st.cops[0]; return { id: c.id, x: c.x, y: c.y }; });
  await walkTo(p1, oc.x + 25, oc.y + 20, 30); await sleep(600);
  await p1.waitForFunction(id => __fs.G.nearId === 'cop:' + id, oc.id, { timeout: 5000 }).catch(async () => errors.push('連線：站到員警旁邊沒提示 ' + await p1.evaluate(() => __fs.G.nearId + ' ' + JSON.stringify(__fs.G.st.cops.map(c => [c.id, c.mode, c.x, c.y, c.vx]))) + ' ' + JSON.stringify(oc)));
  await p1.keyboard.press('e'); await sleep(700);
  const canDisp = await p1.evaluate(() => !!document.querySelector('#act button[data-disp="door"]'));
  if (canDisp) await p1.click('#act button[data-disp="door"]');
  await p2.waitForFunction(id => { const c = __fs.G.st.cops.find(c => c.id === id); return c.order === 'door' && __fs.G.st.briefed[id] != null; }, oc.id, { timeout: 6000 }).then(() => console.log('連線：隊友看到報告＋守門同步')).catch(() => { if (canDisp) errors.push('連線：隊友那邊沒同步到調度/報告'); });
  await shot(p2, 'online_dispatch');
  await p2.evaluate(() => __fs.Net.send({ t: 'leave' })); await sleep(2500);
  { const pace = await p1.evaluate(() => __fs.G.st.pace); console.log('隊友離開後節奏：', pace); if (pace !== 2.1) errors.push('隊友離開後節奏沒變回 2.1：' + pace); }
  await br.close();
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無'); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
`);
