// v13：①電腦版右側畫布上沒有任何浮動的系統訊息／結果卡 ②單人時走到畫出來的分局長身上一定交得了差
//      ③物件旁的小清單不會被畫布右邊切掉 ④手機版結果卡照舊
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {'));
eval(head + `
(async () => {
  const br = await chromium.launch();
  /* ---------- ① 桌機 1280×800：結果卡在左側欄 ---------- */
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  await pg.goto(BASE + '?seed=158'); await sleep(900);
  await pg.fill('#name', '百九'); await pg.click('#bSolo'); await sleep(700);
  await closeWin(pg); await pg.click('#win footer [data-close]').catch(() => { }); await sleep(200);
  await van(pg); for (const t of ['camera', 'luminol', 'thermo']) await pg.click('[data-tool="' + t + '"]').catch(() => { }); await pg.click('#gearOk'); await sleep(300); await closeWin(pg);
  await toObj(pg, 'floor_living'); await act(pg, '噴灑魯米諾'); await sleep(700);
  await pg.evaluate(() => { __fs.toast('測試提示：系統訊息'); __fs.toast('測試提示：失敗', true); __fs.banner('分局長鄭督察走進封鎖線：測試插曲', 'boss_in'); __fs.banner('有人在外面鬼鬼祟祟', 'tamper'); });
  await sleep(500);
  const a = await pg.evaluate(() => {
    const st = __fs.stage(), sbw = st.OX; const card = document.querySelector('#cards .evc.rc');
    const cr = card && card.getBoundingClientRect(); const hud = document.querySelector('#hud'), cards = document.querySelector('#cards');
    const bar = document.querySelector('#bar').getBoundingClientRect(), log = document.querySelector('#logW').getBoundingClientRect();
    const bad = new Set();
    for (let x = sbw + 4; x < innerWidth; x += 16) for (let y = 2; y < innerHeight; y += 16) { const e = document.elementFromPoint(x, y); if (e && e.id !== 'cv' && !e.closest('#act')) bad.add((e.id || e.className || e.tagName) + ''); }
    const over = [...document.querySelectorAll('body *')].filter(e => { if (e.closest('#act') || e.id === 'cv' || e.closest('.hidden')) return false; const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && r.right > sbw + 1 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight; }).map(e => e.id || e.className || e.tagName);
    return { sbw: Math.round(sbw), card: card ? { text: card.textContent.slice(0, 70), l: Math.round(cr.left), r: Math.round(cr.right), t: Math.round(cr.top), b: Math.round(cr.bottom), close: !!card.querySelector('.rcx') } : null,
      cardsOverflowX: cards.scrollWidth > cards.clientWidth + 1, hudOverflowX: hud.scrollWidth > hud.clientWidth + 1, barBottom: Math.round(bar.bottom), vh: innerHeight, logH: Math.round(log.height), logAboveBar: log.bottom <= bar.top + 1, cardAboveLog: cr ? cards.getBoundingClientRect().bottom <= log.top + 1 && cr.bottom <= cards.getBoundingClientRect().bottom + 1 : null,
      toastsShown: document.querySelectorAll('#toasts .toast').length, floats: __fs.G.floats.length, logHas: [...document.querySelectorAll('#log .lg')].map(x => x.textContent).filter(t => /測試提示|測試插曲|鬼鬼祟祟|噴灑魯米諾|魯米諾/.test(t)).length, stageBad: [...bad], over: [...new Set(over)] };
  });
  console.log('桌機檢查：', JSON.stringify(a));
  if (!a.card || !/燈太亮/.test(a.card.text)) errors.push('沒有出現「燈太亮」結果卡：' + JSON.stringify(a.card));
  else { if (a.card.r > a.sbw || a.card.l < 0) errors.push('結果卡不在左側欄裡'); if (!a.card.close) errors.push('結果卡沒有 ✕'); if (!a.cardAboveLog) errors.push('結果卡不在現場紀錄上方'); }
  if (a.cardsOverflowX || a.hudOverflowX) errors.push('側欄橫向溢出');
  if (a.barBottom > a.vh || !a.logAboveBar || a.logH < 60) errors.push('快捷列被擠出畫面或紀錄太小：' + JSON.stringify(a));
  if (a.toastsShown) errors.push('桌機還有浮動 toast：' + a.toastsShown); // 畫布微回饋 pill（G.floats）是 v20 刻意加上的，不算系統訊息
  if (a.logHas < 4) errors.push('系統訊息沒有記到現場紀錄：' + a.logHas);
  if (a.stageBad.length || a.over.length) errors.push('舞台上有浮動元素：' + JSON.stringify({ bad: a.stageBad, over: a.over }));
  await pg.screenshot({ path: '/workspace/forensic_v13_desktop_clear.png' });
  await pg.evaluate(() => { for (let i = 0; i < 3; i++) __fs.resultCard({ img: 'ev_luminol', kicker: '🧪 測試・很長的卡片', big: '很長的標題'.repeat(4), text: '很長的內文，'.repeat(30), where: '下一步提示'.repeat(10) }); });
  await sleep(300);
  { const r = await pg.evaluate(() => { const b = document.querySelector('#bar').getBoundingClientRect(), c = document.querySelector('#cards'); return { n: c.children.length, barBottom: Math.round(b.bottom), vh: innerHeight, cardsH: Math.round(c.getBoundingClientRect().height), right: Math.round(c.getBoundingClientRect().right), sbw: Math.round(__fs.stage().OX), ox: c.scrollWidth > c.clientWidth + 1 }; });
    console.log('長卡片：', JSON.stringify(r)); if (r.n !== 1 || r.barBottom > r.vh || r.cardsH > 310 || r.ox || r.right > r.sbw) errors.push('長卡片時側欄排版壞掉：' + JSON.stringify(r)); }
  await pg.click('#cards .rcx'); await sleep(200);
  { const n = await pg.evaluate(() => document.querySelectorAll('#cards > *').length); console.log('按 ✕ 後剩下卡片：', n); if (n) errors.push('✕ 關不掉結果卡'); }
  { const r = await pg.evaluate(() => { const C = __fs.C, f = __fs.ENG.objById(C, 'floor_living'), b = __fs.ENG.objById(C, 'body'); return { labelBottom: f.y + f.h / 2 - 24 + 11, bodyTop: b.y - b.h / 2, same: b.room === 'living' }; });
    console.log('地毯標籤：', JSON.stringify(r)); if (r.same && r.labelBottom >= r.bodyTop - 8) errors.push('地毯標籤碰到屍體：' + JSON.stringify(r)); }
  /* ---------- ② 單人：量完肝溫（死亡時間）→ 走到畫出來的分局長身上 → 立刻交差 ---------- */
  await toObj(pg, 'body'); await act(pg, '量測肝溫', { score: .9 }); await sleep(600);
  await pg.evaluate(() => { document.querySelector('#cards').innerHTML = ''; const st = __fs.G.st; st.quietUntil = 0; st.forceBoss = { kind: 'report', rep: 'tod', wait: 400 }; });
  // 先站遠一點，讓他走進來晃一下
  await tp(pg, 1700, 1000); await pg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 }).catch(() => errors.push('分局長沒有進場'));
  const done0 = await pg.evaluate(() => __fs.ENG.bossDone(__fs.C, __fs.G.st, __fs.G.st.boss.demand)); if (!done0) errors.push('量完肝溫，死亡時間要求卻沒算做到');
  let maxGap = 0; for (let i = 0; i < 6; i++) { await sleep(400); const g = await pg.evaluate(() => { const B = __fs.G.st.boss; return B.mode === 'in' ? Math.hypot(B.vx - B.x, B.vy - B.y) : 0; }); maxGap = Math.max(maxGap, g); }
  console.log('分局長畫面位置和引擎位置最大差距：', Math.round(maxGap)); if (maxGap > 6) errors.push('單人時畫出來的分局長和引擎位置不一樣：' + Math.round(maxGap));
  const ok0 = await pg.evaluate(() => __fs.G.st.bossOk);
  if (await pg.evaluate(() => __fs.G.st.boss.mode === 'in')) {
    const bp = await pg.evaluate(() => { const B = __fs.G.st.boss; B.path = []; B.wait = 99; return { x: B.vx, y: B.vy, sub: '' }; });   // 讓他站著，模擬玩家走過去
    await walkTo(pg, bp.x, bp.y + 30, 40);
    const t0 = Date.now(); await pg.waitForFunction(n => __fs.G.st.bossOk > n, ok0, { timeout: 3000 }).catch(() => { });
    const r = await pg.evaluate(() => ({ ok: __fs.G.st.bossOk, mode: __fs.G.st.boss.mode }));
    console.log('走到畫出來的分局長身上：', JSON.stringify(r), (Date.now() - t0) + 'ms'); if (r.ok <= ok0) errors.push('走到分局長身上沒有交差：' + JSON.stringify(r));
    await shot(pg, 'boss_turnin');
  } else if ((await pg.evaluate(() => __fs.G.st.bossOk)) <= ok0) errors.push('分局長離開了卻沒交差');
  /* ---------- ③ 物件旁小清單：靠近畫布右邊也不會被切掉 ---------- */
  { const res = []; await pg.evaluate(() => { document.querySelector('#cards').innerHTML = ''; });
    for (const id of ['w_cord', 'desk', 'gate', 'bookshelf', 'sw_study']) {
      await toObj(pg, id).catch(() => { }); await sleep(250);
      await pg.evaluate(() => { const G = __fs.G, s = __fs.stage(); G.camAt = { x: G.Me.x - (s.VW / 2 - 60) / s.Z, y: G.Me.y }; }); await sleep(300);
      res.push(await pg.evaluate(id => { const b = document.querySelector('#act'); if (b.classList.contains('hidden')) return { id, hidden: true }; const r = b.getBoundingClientRect(), s = __fs.stage(); const inner = [...b.querySelectorAll('*')].some(e => { const q = e.getBoundingClientRect(); return q.width && (q.right > innerWidth - 2 || q.right > r.right + 1); }); return { id, l: Math.round(r.left), r: Math.round(r.right), W: innerWidth, OX: Math.round(s.OX), inner }; }, id));
    }
    await pg.evaluate(() => { __fs.G.camAt = null; });
    console.log('右邊的小清單：', JSON.stringify(res)); for (const r of res) if (!r.hidden && (r.r > r.W - 4 || r.l < r.OX || r.inner)) errors.push('小清單被切掉：' + JSON.stringify(r)); }
  // 分局長的小清單（站在畫布最右邊的分局長旁）
  { await pg.evaluate(() => { const st = __fs.G.st; st.boss.mode = 'away'; st.quietUntil = 0; st.forceBoss = { kind: 'progress', pct: 100, wait: 400 }; }); await pg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 }).catch(() => { });
    const sp = await pg.evaluate(() => { const C = __fs.C, E = __fs.ENG; const o = E.objById(C, 'w_cord'); for (const [dx, dy] of [[0, 60], [-40, 60], [-80, 40], [0, 100], [-120, 60]]) if (E.walkable(C, o.x + dx, o.y + dy)) return [o.x + dx, o.y + dy]; return null; });
    if (sp) { await tp(pg, sp[0], sp[1]); await pg.evaluate(([x, y]) => { const B = __fs.G.st.boss; B.x = x - 40; B.y = y; B.path = []; B.wait = 99; const G = __fs.G, s = __fs.stage(); G.camAt = { x: x - (s.VW / 2 - 50) / s.Z, y }; }, sp); await sleep(900);
      const r = await pg.evaluate(() => { const b = document.querySelector('#act'); const rc = b.getBoundingClientRect(); return { at: b.dataset.at, hidden: b.classList.contains('hidden'), l: Math.round(rc.left), r: Math.round(rc.right), W: innerWidth, text: b.textContent.slice(0, 30), sw: b.scrollWidth, cw: b.clientWidth }; });
      console.log('分局長小清單：', JSON.stringify(r)); if (r.hidden || r.at !== 'boss' || r.r > r.W - 4 || r.sw > r.cw + 1) errors.push('分局長小清單被切掉或沒出現：' + JSON.stringify(r));
      await shot(pg, 'boss_popover_edge'); await pg.evaluate(() => { __fs.G.camAt = null; }); } }
  /* ---------- ④ 手機 390×844 ---------- */
  const ip = await page(br, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ip.goto(BASE + '?seed=158'); await sleep(1000); await ip.fill('#name', '百九'); await ip.tap('#bSolo'); await sleep(700);
  await ip.tap('#win footer [data-close]').catch(() => { }); await sleep(200); await closeWin(ip);
  await van(ip); for (const t of ['camera', 'luminol', 'prints']) await ip.tap('[data-tool="' + t + '"]'); await ip.tap('#gearOk'); await sleep(300); await closeWin(ip);
  await toObj(ip, 'floor_living'); await ip.locator('#act button', { hasText: '噴灑魯米諾' }).first().tap(); await sleep(700);
  { const r = await ip.evaluate(() => { const c = document.querySelector('#cards .evc.rc'); if (!c) return null; const b = c.getBoundingClientRect(); return { text: c.textContent.slice(0, 40), l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), pos: getComputedStyle(document.querySelector('#cards')).position, sb: document.body.classList.contains('sb') }; });
    console.log('手機結果卡：', JSON.stringify(r)); if (!r || !/燈太亮/.test(r.text) || r.pos !== 'absolute' || r.sb || r.l < 0 || r.r > 390) errors.push('手機結果卡不對：' + JSON.stringify(r)); }
  await ip.screenshot({ path: '/workspace/forensic_v13_mobile_card.png' });
  await ip.evaluate(() => __fs.toast('手機測試提示')); await sleep(200);
  { const n = await ip.evaluate(() => document.querySelectorAll('#toasts .toast').length); console.log('手機 toast：', n); if (!n) errors.push('手機 toast 不見了'); }
  await br.close();
  console.log('頁面／檢查錯誤：', errors.length ? errors.join('\\n') : '無'); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });`);
