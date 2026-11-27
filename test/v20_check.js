// v20：NPC 頭上對話泡泡、教學第 7 步只顯示引導動作、正式案件清單精簡、桌機＋手機零頁面錯誤
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {')).replace(/forensic_v1\d_/, 'forensic_v20_');
eval(head + `
async function nearCop(pg, pick = 0) {
  const c = await pg.evaluate(pick => { const st = __fs.G.st; st.quietUntil = 1e9; const cs = st.cops.filter(c => !c.rk && c.mode !== 'in'); const c = cs[pick % cs.length]; return { id: c.id, x: c.vx != null ? c.vx : c.x, y: c.vy != null ? c.vy : c.y }; }, pick);
  await tp(pg, c.x + 40, c.y + 30); await pg.waitForFunction(id => __fs.G.nearId === 'cop:' + id, c.id, { timeout: 4000 }).catch(() => errors.push('站到員警旁邊，提示卻不是他：' + c.id)); await sleep(250); return c.id;
}
(async () => {
  const br = await chromium.launch();
  /* ---------- ① 教學鎖定：第 7 步屍體清單只有「近拍傷口」，其他 ! 隱藏 ---------- */
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  const pageErr = []; pg.on('pageerror', e => pageErr.push(String(e)));
  await pg.goto(BASE); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bTut'); await sleep(900);
  // 第 1 步：點鑑識車／屍體不應開出完整清單
  await tp(pg, 336, 880); await sleep(400);
  { const r = await pg.evaluate(() => { const a = document.querySelector('#act'); __fs.refresh && __fs.G.nearId; return { i: __fs.G.tut.i, near: __fs.G.nearId, allowVan: __fs.tutAllows('van', 'van'), html: (a && !a.classList.contains('hidden') ? a.textContent : ''), wound: !!document.querySelector('#act [data-a="wound"]'), bang: [...(__fs.C.objects || [])].filter(o => !o.deco && !o.van && !o.sw && !__fs.G.st.obj[o.id].gone).filter(o => __fs.tutAllows(o.id)).map(o => o.id) }; });
    console.log('教學第 1 步鎖定：', JSON.stringify(r));
    if (r.i !== 0) errors.push('教學不是從第 1 步開始：' + r.i);
    if (r.allowVan || r.wound) errors.push('教學第 1 步不該能操作鑑識車或近拍傷口：' + JSON.stringify(r));
    if (r.bang.length) errors.push('教學第 1 步不該有物件 ! 標記：' + r.bang.join(',')); }
  // 依序走到第 7 步（屍體近拍）
  await tp(pg, 640, 718); await waitStep(pg, 1, 8000);
  await tutCop(pg); await act(pg, '聽取初步報告'); await waitStep(pg, 2);
  { const sp = await pg.evaluate(() => { const s = __fs.G.speech; return s && { text: s.text, id: s.id, on: s.until > performance.now() }; });
    console.log('員警泡泡：', JSON.stringify(sp));
    if (!sp || !sp.on || !sp.text) errors.push('聽取報告後沒有員警對話泡泡：' + JSON.stringify(sp));
    const card = await pg.evaluate(() => !!(document.querySelector('#cards .evc.rc') && /警員初步報告/.test(document.querySelector('#cards .evc.rc').textContent)));
    if (card) errors.push('桌機教學不該再跳出員警報告結果卡');
    await shot(pg, 'npc_bubble');
    // also copy to the requested path
    await pg.screenshot({ path: '/workspace/forensic_v20_npc_bubble.png' }); }
  await act(pg, '守住大門'); await waitStep(pg, 3);
  await tutSus(pg); await act(pg, '觀察嫌疑人'); await sleep(1300); await waitStep(pg, 4);
  await tutSus(pg); await act(pg, '周旋'); await waitStep(pg, 5);
  { const sp = await pg.evaluate(() => __fs.G.speech && __fs.G.speech.text); console.log('周旋泡泡：', sp); if (!sp) errors.push('周旋後沒有關係人對話泡泡'); }
  await van(pg); for (const t of ['camera', 'luminol', 'prints']) await pg.click('[data-tool="' + t + '"]');
  { const extra = await pg.evaluate(() => [...document.querySelectorAll('[data-tool]')].map(x => x.dataset.tool));
    console.log('教學換裝可見工具：', extra.join(','));
    if (extra.some(t => !['camera', 'luminol', 'prints'].includes(t))) errors.push('教學換裝不該看到其他工具：' + extra.join(',')); }
  await pg.click('#gearOk'); await sleep(300); await closeWin(pg); await waitStep(pg, 6);
  await toObj(pg, 'body'); await sleep(400);
  { const r = await pg.evaluate(() => {
      const btns = [...document.querySelectorAll('#act button')].map(b => ({ a: b.dataset.a, t: b.textContent.replace(/\\s+/g, ' ').trim() }));
      const ids = (__fs.C.objects || []).filter(o => !o.deco && !o.van && !o.sw && !__fs.G.st.obj[o.id].gone);
      const marked = ids.filter(o => __fs.tutAllows(o.id)).map(o => o.id);
      const speech = __fs.G.speech;
      return { i: __fs.G.tut.i + 1, near: __fs.G.nearId, btns, marked, act: document.querySelector('#act').classList.contains('hidden') ? '' : document.querySelector('#act').textContent.replace(/\\s+/g, ' ').trim() };
    });
    console.log('教學第 7 步清單：', JSON.stringify(r));
    if (r.i !== 7) errors.push('還沒到教學第 7 步：' + r.i);
    if (r.near !== 'body') errors.push('第 7 步沒站在屍體旁：' + r.near);
    if (r.btns.length !== 1 || r.btns[0].a !== 'wound' || !/近拍傷口/.test(r.btns[0].t)) errors.push('第 7 步屍體清單不是只有近拍傷口：' + JSON.stringify(r.btns));
    if (r.marked.some(id => id !== 'body')) errors.push('第 7 步還有其他物件 ! 標記：' + r.marked.join(','));
    await shot(pg, 'tut_focused');
    await pg.screenshot({ path: '/workspace/forensic_v20_tut_focused.png' }); }
  await pg.close();

  /* ---------- ② 正式案件：沒帶的工具收成一行提示 ---------- */
  const fm = await page(br, { viewport: { width: 1280, height: 800 } });
  fm.on('pageerror', e => pageErr.push('formal ' + e));
  await fm.goto(BASE + '?seed=158'); await sleep(900); await fm.fill('#name', '百九'); await fm.click('#bSolo'); await sleep(700); await closeWin(fm); await fm.click('#win footer [data-close]').catch(() => {});
  await tp(fm, 336, 880); await fm.evaluate(() => __fs.doAct({ type: 'gear', tools: ['camera', 'luminol', 'prints'] })); await sleep(300);
  await toObj(fm, 'body'); await sleep(400);
  { const r = await fm.evaluate(() => {
      const act = document.querySelector('#act');
      const btns = [...act.querySelectorAll('button')].map(b => ({ a: b.dataset.a, dis: b.disabled, why: (b.querySelector('.why') || {}).textContent || '', t: b.textContent.replace(/\\s+/g, ' ').trim() }));
      const more = (act.querySelector('.dn.more') || {}).textContent || '';
      return { btns, more, html: act.textContent.replace(/\\s+/g, ' ').trim() };
    });
    console.log('正式案件屍體清單：', JSON.stringify(r));
    if (r.btns.some(b => /沒帶/.test(b.why) || /沒帶/.test(b.t))) errors.push('正式案件還顯示「沒帶工具」的灰列：' + JSON.stringify(r.btns));
    if (!/另有 \\d 項需回車上換工具/.test(r.more) && !/另有 \\d 項需回車上換工具/.test(r.html)) errors.push('正式案件沒有精簡的換工具提示：' + r.html);
    if (!r.btns.some(b => /近拍傷口/.test(b.t) && !b.dis)) errors.push('正式案件看不到可用的近拍傷口：' + JSON.stringify(r.btns)); }

  /* ---------- ③ 正式案件 NPC 泡泡（非教學） ---------- */
  await nearCop(fm); await fm.click('#act button[data-brief]'); await sleep(500);
  { const r = await fm.evaluate(() => ({ speech: __fs.G.speech && __fs.G.speech.text, log: [...document.querySelectorAll('#log .lg')].some(x => /警員初步報告|初步報告/.test(x.textContent)), card: !!(document.querySelector('#cards .evc.rc') && /警員初步報告/.test((document.querySelector('#cards .evc.rc') || {}).textContent || '')) }));
    console.log('正式案件員警泡泡：', JSON.stringify(r));
    if (!r.speech) errors.push('正式案件聽報告沒有對話泡泡');
    if (!r.log) errors.push('正式案件聽報告沒有記到現場紀錄');
    if (r.card) errors.push('桌機正式案件不該再跳出員警報告結果卡'); }

  /* ---------- ④ 手機 390×844 無頁面錯誤，仍可看到短結果卡（魯米諾燈太亮） ---------- */
  const ip = await page(br, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  ip.on('pageerror', e => pageErr.push('mobile ' + e));
  await ip.goto(BASE + '?seed=158'); await sleep(900); await ip.fill('#name', '百九'); await ip.tap('#bSolo'); await sleep(700); await closeWin(ip); await ip.tap('#win footer [data-close]').catch(() => {});
  await tp(ip, 336, 880); await ip.evaluate(() => __fs.doAct({ type: 'gear', tools: ['camera', 'luminol', 'prints'] })); await sleep(300);
  await toObj(ip, 'floor_living'); await act(ip, '噴灑魯米諾'); await sleep(500);
  { const t = await ip.evaluate(() => (document.querySelector('#cards .evc.rc') || {}).textContent || ''); console.log('手機魯米諾卡：', t.slice(0, 80)); if (!/燈太亮/.test(t)) errors.push('手機沒有燈太亮結果卡：' + t.slice(0, 80)); }
  await nearCop(ip, 0); await ip.tap('#act button[data-brief]').catch(() => {}); await sleep(600);
  { const r = await ip.evaluate(() => ({ speech: __fs.G.speech && __fs.G.speech.text, card: (document.querySelector('#cards .evc.rc') || {}).textContent || '' }));
    console.log('手機員警：', JSON.stringify({ speech: r.speech, card: (r.card || '').slice(0, 50) }));
    if (!r.speech && !/警員初步報告/.test(r.card)) errors.push('手機聽報告沒有泡泡也沒有短卡'); }

  if (pageErr.length) errors.push('頁面錯誤：' + pageErr.join(' | '));
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無');
  await br.close(); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
`);
