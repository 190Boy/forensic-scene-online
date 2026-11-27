// v17：①電腦版側欄——新手教學框不會被「待處理＋結果卡＋現場紀錄＋兩排快捷列」擠扁，快捷列永遠在畫面內　②肝溫小遊戲的紅色「讀數偏差」條＋教學保底提示　③關掉推理視窗後按「⚖️ 回到結案推理」回得去（草稿還在）
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {')).replace(/forensic_v1\d_/, 'forensic_v17_');
eval(head + `
async function measure(pg) {
  return pg.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || !e.offsetParent) return null; const b = e.getBoundingClientRect(); return { top: Math.round(b.top), bottom: Math.round(b.bottom), h: e.clientHeight, sh: e.scrollHeight }; };
    const slots = [...document.querySelectorAll('#bar .slot')].map(s => Math.round(s.getBoundingClientRect().top)); 
    return { vh: innerHeight, sb: document.body.classList.contains('sb'), tut: r('#tut'), labs: r('#labs'), tl: r('#hud .tl'), cards: r('#cards'), nCards: document.querySelectorAll('#cards > *').length, log: r('#logW'), nLog: document.querySelectorAll('#log .lg').length, bar: r('#bar'), rows: new Set(slots).size, step: __fs.G.tut && __fs.G.tut.i + 1, pend: ((document.querySelector('#labs') || {}).textContent || '').slice(0, 60), nPend: document.querySelectorAll('#labs .pend').length }; });
}
async function checkAt(pg, tag0, H, want, nPend) {
  const tag = tag0 + ' 第 ' + want + ' 步';
  if (!(await pg.evaluate(() => document.querySelectorAll('#cards > *').length))) errors.push(tag + ' 沒有停靠的結果卡');
  const m = await measure(pg); console.log(tag, JSON.stringify(m));
  if (m.step !== want) errors.push(tag + ' 不在預期的步驟：' + m.step);
  if (m.nPend < nPend || m.nLog < 3 || m.rows < 2 || !m.nCards) errors.push(tag + ' 測試情境不完整（待處理／紀錄／兩排快捷列／結果卡）：' + JSON.stringify({ nPend: m.nPend, nLog: m.nLog, rows: m.rows, cards: m.nCards }));
  if (!m.sb) errors.push(tag + ' 不是側欄版面');
  if (!m.labs || !m.tl || m.labs.top < m.tl.top - 1 || m.labs.bottom > m.tl.bottom + 1) errors.push(tag + ' 「📋 待處理」被擠出側欄可視範圍：' + JSON.stringify({ labs: m.labs, tl: m.tl }));
  if (!m.tut || m.tut.sh > m.tut.h + 2 || m.tut.h < 90) errors.push(tag + ' 新手教學框被擠扁：' + JSON.stringify(m.tut));
  if (!m.bar || m.bar.bottom > m.vh || m.bar.top < 0) errors.push(tag + ' 快捷列跑出畫面：' + JSON.stringify(m.bar));
  if (!m.log || m.log.h < (H > 780 ? 70 : 24)) errors.push(tag + ' 現場紀錄被擠到看不見：' + JSON.stringify(m.log));
  if (!m.cards || m.cards.h < 40) errors.push(tag + ' 結果卡被擠到看不見：' + JSON.stringify(m.cards));
  if (m.tut && m.bar && m.tut.bottom > m.bar.top) errors.push(tag + ' 教學框和快捷列重疊');
}
(async () => {
  const br = await chromium.launch();
  for (const H of [800, 720]) {
    const tag = '1280×' + H, pg = await page(br, { viewport: { width: 1280, height: H } });
    await pg.goto(BASE); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bTut'); await sleep(900);
    await tp(pg, 640, 718); await waitStep(pg, 1); await tutSocial(pg);
    await tutGear(pg, ['camera', 'luminol', 'prints']); await waitStep(pg, 6); await closeWin(pg);
    await toObj(pg, 'body'); await act(pg, '近拍傷口'); await waitStep(pg, 7);
    await toObj(pg, 'floor_living'); await act(pg, '噴灑魯米諾'); await toObj(pg, 'sw_living'); await act(pg, '燈'); await toObj(pg, 'floor_living'); await act(pg, '記錄螢光位置'); await waitStep(pg, 10);
    await toObj(pg, 'w_statue'); await act(pg, '噴灑魯米諾'); await act(pg, '記錄螢光位置'); await act(pg, '採集指紋'); await waitStep(pg, 11); await sleep(600);
    await checkAt(pg, tag, H, 12, 1);
    if (H === 800) await pg.screenshot({ path: '/workspace/forensic_v17_tut_sidebar.png' });
    else await pg.screenshot({ path: '/workspace/forensic_v17_tut_sidebar_720.png' });
    // 最糟情況（百九的截圖）：待處理 2 項（死者血液＋死者的手機）＋「裝進證物袋」結果卡＋教學框＋紀錄＋兩排快捷列
    await tutVan(pg); await tutAnalyze(pg, 'print'); await waitStep(pg, 12);
    for (const t of ['thermo', 'swab', 'shoe']) await pg.click('[data-tool="' + t + '"]'); await pg.click('#gearOk'); await waitStep(pg, 13); await closeWin(pg);
    await toObj(pg, 'body'); await act(pg, '量測肝溫', { manual: true }); await sleep(2500);   // 不按：指針掉出綠區
    { const d = await mgDbg(pg); console.log(tag, '肝溫：放著不按 2.5 秒 → 偏差', d.out.toFixed(2), 's / 綠區內', d.inB.toFixed(2), 's');
      if (!(d.out > 1)) errors.push(tag + ' 肝溫：指針在綠區外，紅色「讀數偏差」沒有上升 ' + JSON.stringify(d));
      if (H === 800) await pg.screenshot({ path: '/workspace/forensic_v17_thermo_meter.png' });
      await pg.evaluate(() => __fs.MG.finish(.2)); await mgWaitDone(pg); await sleep(500);
      const c = await pg.evaluate(() => document.querySelector('#cards').textContent);
      if (!/教學保底通過；正式案件誤差太高會讓結果失準/.test(c)) errors.push(tag + ' 教學低分的結果卡沒有「教學保底通過」提示：' + c.slice(0, 120));
      if (H === 800) await pg.screenshot({ path: '/workspace/forensic_v17_tut_easy_note.png' }); }
    await toObj(pg, 'body'); await act(pg, '採集死者血液'); await waitStep(pg, 15);
    await toObj(pg, 'phone'); await act(pg, '裝袋帶走'); await waitStep(pg, 16); await sleep(600);
    { const pend = await pg.evaluate(() => document.querySelector('#labs').textContent), card = await pg.evaluate(() => document.querySelector('#cards').textContent);
      if (!/血液/.test(pend) || !/手機/.test(pend) || !/手機/.test(card)) errors.push(tag + ' 最糟情境沒有重現：' + JSON.stringify({ pend: pend.slice(0, 80), card: card.slice(0, 40) })); }
    await checkAt(pg, tag, H, 17, 2);
    await pg.screenshot({ path: '/workspace/forensic_v17_tut_sidebar_worst' + (H === 720 ? '_720' : '') + '.png' });
    // 25 步的文字逐一放進教學框：每一步都完整顯示、沒有捲軸，快捷列也不會被推出畫面
    const all = await pg.evaluate(() => { const T = __fs.Tut, g = __fs.G.tut, i0 = g.i, out = [];
      for (let k = 0; k < T.steps.length; k++) { g.i = k; T.render(); const e = document.querySelector('#tut'), b = document.querySelector('#bar').getBoundingClientRect();
        out.push({ k: k + 1, h: e.clientHeight, sh: e.scrollHeight, bar: Math.round(b.bottom), skip: !!document.querySelector('#tutSkip, #tutHome') }); }
      g.i = i0; T.render(); return out; });
    const bad = all.filter(x => x.sh > x.h + 2 || x.h < 90 || !x.skip);   // 快捷列在「每一步實際的狀態」下另外檢查（tutFull）
    console.log(tag, '25 步教學框高度：', all.map(x => x.h).join(' '));
    if (all.length !== TUT_N || bad.length) errors.push(tag + ' 這些步驟的教學框顯示不完整：' + JSON.stringify(bad));
    await pg.close();
  }
  // 1280×720 從頭玩到「🎉 教學完成！」：每一步（實際狀態）教學框完整、快捷列在畫面內
  { const pg = await page(br, { viewport: { width: 1280, height: 720 } }); await pg.goto(BASE); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bTut'); await sleep(900);
    try { await tutFull(pg, '1280×720'); } catch (e) { errors.push('1280×720 教學：' + e.message); } await pg.close(); }
  // 推理視窗關掉（× / Esc / 看筆記本）→ 按「⚖️ 回到結案推理」回得去，草稿還在，送得出去
  { const pg = await page(br, { viewport: { width: 1280, height: 800 } }); await pg.goto(BASE + '?seed=158'); await sleep(900); await pg.fill('#name', '百九'); await pg.click('#bSolo'); await sleep(700);
    await closeWin(pg); await pg.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); await sleep(200);
    await pg.click('#bClose'); await pg.waitForFunction(() => __fs.G.ovKind === 'deduce', null, { timeout: 5000 });
    const cul = await pg.evaluate(() => __fs.C.suspects[2].id), met = await pg.evaluate(() => __fs.C.methods[1].id);
    await pg.click('[data-cul="' + cul + '"]'); await pg.click('[data-df="method"][data-v="' + met + '"]'); await sleep(300);
    const back = async how => { const b = await pg.evaluate(() => { const b = document.querySelector('#bClose'); return { vis: !!b.offsetParent && !b.disabled, t: b.textContent.trim(), ov: __fs.G.ovKind, ph: __fs.G.st.phase }; });
      if (!b.vis || !/回到結案推理/.test(b.t) || b.ov) errors.push('推理（' + how + '）關掉後按鈕不對：' + JSON.stringify(b));
      await pg.click('#bClose'); await sleep(400);
      const r = await pg.evaluate(([c, m]) => ({ ov: __fs.G.ovKind, cul: !!document.querySelector('#win .su.on[data-cul="' + c + '"]'), met: !!document.querySelector('#win [data-df="method"].on[data-v="' + m + '"]'), d: __fs.G.st.draft.culprit === c && __fs.G.st.draft.method === m }), [cul, met]);
      console.log('推理（' + how + '）→ 回到結案推理：', JSON.stringify(r)); if (r.ov !== 'deduce' || !r.cul || !r.met || !r.d) errors.push('推理（' + how + '）回不去或草稿不見：' + JSON.stringify(r)); };
    await closeWin(pg); await back('×');
    await pg.keyboard.press('Escape'); await sleep(300); await back('Esc');
    await closeWin(pg); await pg.click('#bNote'); await sleep(300); await pg.click('#win [data-tab="man"]').catch(() => { }); await sleep(200); await closeWin(pg); await back('筆記本');
    await shot(pg, 'deduce_reopened');
    await deduceAndSubmit(pg, null); await pg.waitForFunction(() => __fs.G.st.phase === 'result', null, { timeout: 5000 }).catch(() => errors.push('推理重新打開後送不出去'));
    await closeWin(pg); const rb = await pg.evaluate(() => document.querySelector('#bClose').textContent); await pg.click('#bClose'); await sleep(300);
    const rv = await pg.evaluate(() => __fs.G.ovKind); console.log('結案報告關掉 → 按鈕「' + rb.trim() + '」→', rv); if (rv !== 'result') errors.push('結案報告關掉後回不去');
    await pg.close(); }
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無'); await br.close(); process.exit(errors.length ? 1 : 0);
})();
`);
