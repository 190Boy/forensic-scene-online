// v21：電腦版側欄在右邊、畫布點擊仍準、25 步教學提示錨在目標旁且不蓋住目標／清單（桌機 1280×800、1280×720、手機 390×844）
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {')).replace(/forensic_v1\d_/, 'forensic_v21_');
eval(head + `
(async () => {
  const br = await chromium.launch();
  const pageErr = [];
  /* ---------- ① 桌機 1280×800：側欄在右、點擊 11/11 ---------- */
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  pg.on('pageerror', e => pageErr.push('desk ' + e));
  await pg.goto(BASE + '?seed=158'); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bSolo'); await sleep(700);
  await closeWin(pg); await pg.click('#win footer [data-close]').catch(() => {}); await sleep(200);
  { const L = await pg.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), w: Math.round(b.width), t: Math.round(b.top), btm: Math.round(b.bottom) }; };
      return { sb: document.body.classList.contains('sb'), hud: r('#hud'), cv: r('#cv'), st: __fs.stage() }; });
    console.log('側欄位置：', JSON.stringify(L));
    if (!L.sb || !L.hud || L.hud.l < 1280 / 2) errors.push('側欄不在右邊：' + JSON.stringify(L));
    if (!L.cv || Math.abs(L.cv.l) > 2 || Math.abs(L.hud.l - L.cv.r) > 2) errors.push('畫布沒有貼在左側：' + JSON.stringify(L));
    if (L.hud.w < 268 || L.hud.w > 342) errors.push('側欄寬度不對：' + JSON.stringify(L.hud)); }
  await tp(pg, 1300, 640); await sleep(600);
  { const st = await pg.evaluate(() => __fs.stage()); await pg.addStyleTag({ content: '#act{visibility:hidden!important}' });
    const objs = await pg.evaluate(() => { const C = __fs.C, G = __fs.G; return C.objects.filter(o => !o.deco && !o.van && !G.st.obj[o.id].gone && o.id !== 'floor_living').map(o => { const [cx, cy] = __fs.w2c(o.x, o.flat ? o.y : o.y - Math.min(30, (o.h || 40) / 3)); return { id: o.id, cx, cy }; }); });
    let ok = 0, tot = 0; const miss = [];
    for (const o of objs) { if (o.cx < st.OX + 8 || o.cx > st.OX + st.VW - 8 || o.cy < 8 || o.cy > st.VH - 8) continue; tot++;
      await pg.evaluate(() => { const G = __fs.G; G.autoOpen = null; G.path = null; G.nearId = null; }); await pg.mouse.click(o.cx, o.cy); await sleep(60);
      const a = await pg.evaluate(() => __fs.G.autoOpen || __fs.G.nearId); if (a === o.id) ok++; else miss.push(o.id + '→' + a); await tp(pg, 1300, 640); }
    console.log('點擊畫布物件：', ok + '/' + tot, miss.join(' ')); if (tot < 8 || ok < tot) errors.push('點擊畫布物件不準：' + ok + '/' + tot + ' ' + miss.join(' '));
    await pg.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); if (/visibility:hidden/.test(s.textContent)) s.remove(); }); }
  await pg.close();

  /* ---------- ② 教學 25 步：提示在畫布內、不蓋目標／清單 ---------- */
  // 先單獨開教學到第 7 步拍桌機／手機（目標＋單一動作清單＋提示在旁邊）
  { const d = await page(br, { viewport: { width: 1280, height: 800 } });
    d.on('pageerror', e => pageErr.push('shot ' + e));
    await d.goto(BASE); await sleep(900); await d.fill('#name', '百九'); await d.click('#bTut'); await sleep(900);
    await tp(d, 640, 718); await waitStep(d, 1);
    await tutSocial(d);
    await tutGear(d, ['camera', 'luminol', 'prints']); await waitStep(d, 6); await closeWin(d);
    await toObj(d, 'body'); await sleep(400); await checkTutCallout(d, '1280×800', 7);
    await d.screenshot({ path: '/workspace/forensic_v21_right_sidebar.png' });
    await d.close(); }
  { const m = await page(br, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    m.on('pageerror', e => pageErr.push('mshot ' + e));
    await m.goto(BASE); await sleep(900); await m.fill('#name', '百九'); await m.tap('#bTut'); await sleep(900);
    await tp(m, 640, 718); await waitStep(m, 1);
    await tutSocial(m);
    await tutGear(m, ['camera', 'luminol', 'prints']); await waitStep(m, 6); await closeWin(m);
    await toObj(m, 'body'); await sleep(400); await checkTutCallout(m, '390×844', 7);
    await m.screenshot({ path: '/workspace/forensic_v21_tut_callout_mobile.png' });
    await m.close(); }

  for (const size of [{ width: 1280, height: 800 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const tag = size.width + '×' + size.height;
    const p = await page(br, { viewport: size, isMobile: size.width < 500, hasTouch: size.width < 500 });
    p.on('pageerror', e => pageErr.push(tag + ' ' + e));
    await p.goto(BASE); await sleep(900); await p.fill('#name', '百九');
    if (size.width < 500) await p.tap('#bTut'); else await p.click('#bTut');
    await sleep(900);
    try { await tutFull(p, tag); } catch (e) { errors.push(tag + ' 完整教學：' + (e && e.message || e)); }
    await p.close();
  }

  if (pageErr.length) errors.push('頁面錯誤：' + pageErr.join(' | '));
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無');
  await br.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
`);
