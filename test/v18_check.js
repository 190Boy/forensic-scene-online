// v18：連線兩人各自推理、一起開獎（推理中看不到隊友答案、各自分數＋全員比較）＋側欄結果卡排版（標題不擠成窄欄、縮圖不變形）
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {')).replace(/forensic_v1\d_/, 'forensic_v18_');
eval(head + `
async function pick(pg, d) {
  await pg.click('#win [data-cul="' + d.culprit + '"]'); await sleep(200);
  for (const f of ['method', 'weapon', 'location']) { await pg.click('#win [data-df="' + f + '"][data-v="' + d[f] + '"]'); await sleep(150); }
}
(async () => {
  const br = await chromium.launch();
  const p1 = await page(br, { viewport: { width: 1280, height: 800 } }), p2 = await page(br, { viewport: { width: 1280, height: 800 } });
  await p1.goto(BASE); await sleep(800); await p1.fill('#name', '百九'); await p1.click('#bCreate');
  await p1.waitForFunction(() => /\\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 8000 });
  const code = await p1.textContent('#rmCode');
  await p2.goto(BASE + '?room=' + code); await sleep(800); await p2.fill('#name', 'Cynthia'); await p2.click('#bJoin'); await sleep(1200);
  await p1.click('#rmStart'); await sleep(1500);
  for (const p of [p1, p2]) { await closeWin(p); await p.click('#win footer [data-close]', { timeout: 1200 }).catch(() => { }); }
  /* 側欄結果卡排版（用鑑識結果卡，員警報告改走對話泡泡） */
  { await p1.evaluate(() => __fs.resultCard({ img: 'ev_photo', kicker: '🔎 近拍傷口・屍體', big: '傷口邊緣可見鈍器重擊造成的撕裂傷', text: '已記到筆記本', where: '📒 已記到筆記本' }));
    const okc = await p1.waitForFunction(() => document.querySelector('#cards .evc.rc .big'), null, { timeout: 2500 }).then(() => true, () => false);
    if (!okc) errors.push('拿不到側欄鑑識結果卡'); await sleep(200);
    const r = await p1.evaluate(() => { const c = document.querySelector('#cards .evc.rc'); if (!c) return null; const cb = c.getBoundingClientRect(), bg = c.querySelector('.big'), rg = document.createRange(), big = (rg.selectNodeContents(bg), { width: Math.max(...[...rg.getClientRects()].map(x => x.width)), left: bg.getBoundingClientRect().left }), sp = c.querySelector('.rh span'), im = c.querySelector('.rh img');
      const s = sp && sp.textContent ? sp.getBoundingClientRect() : null;
      return { card: Math.round(cb.width), big: Math.round(big.width), bigLeft: Math.round(big.left - cb.left), span: s ? Math.round(s.width) : 0, fit: getComputedStyle(im).objectFit, nat: im.naturalWidth / Math.max(1, im.naturalHeight), box: im.clientWidth / Math.max(1, im.clientHeight), x: !!c.querySelector('.rcx') }; });
    console.log('側欄結果卡：', JSON.stringify(r));
    if (!r) errors.push('側欄沒有鑑識結果卡');
    else { if (r.big < r.card * 0.55) errors.push('結果卡標題還是擠成窄欄（最長一行的寬度）：' + JSON.stringify(r)); if (r.span && r.span < r.card * 0.75) errors.push('結果卡內文沒有跨整張卡：' + JSON.stringify(r)); if (r.fit !== 'contain') errors.push('結果卡縮圖沒有保持比例（object-fit）：' + r.fit); }
    const lf = await p1.evaluate(() => { const i = document.querySelector('#log .lg img'); return i ? getComputedStyle(i).objectFit : 'none-img'; }); if (lf !== 'contain' && lf !== 'none-img') errors.push('紀錄縮圖沒有保持比例：' + lf);
    const box = await p1.locator('#cards .evc.rc').boundingBox(); if (box) await p1.screenshot({ path: '/workspace/forensic_v18_sidebar_card.png', clip: { x: 0, y: Math.max(0, box.y - 20), width: 300, height: Math.min(360, box.height + 40) } }); }
  /* 結案 → 兩人都進入推理 */
  await p1.click('#bClose'); for (const p of [p1, p2]) await p.waitForFunction(() => __fs.G.ovKind === 'deduce', null, { timeout: 6000 });
  const T = await p1.evaluate(() => { const C = __fs.C; return { culprit: C.culprit, method: C.method, weapon: C.weapon, location: C.location, wrong: C.suspects.find(s => s.id !== C.culprit).id }; });
  await pick(p1, T); await sleep(600);
  // 隊友看不到房主的答案
  { const v = await p2.evaluate(c => ({ drafts: Object.keys(__fs.G.st.drafts || {}), mine: (__fs.G.st.drafts || {})[__fs.G.me], on: !!document.querySelector('#win .su.on'), json: JSON.stringify(__fs.G.st.drafts || {}).includes(c), bar: (document.querySelector('#win .subBar') || {}).textContent || '' }), T.culprit);
    console.log('推理中隊友看到的：', JSON.stringify({ drafts: v.drafts, on: v.on, leak: v.json, bar: v.bar }));
    if (v.drafts.length !== 1 || v.on || v.json) errors.push('推理中隊友看得到房主的答案：' + JSON.stringify(v));
    if (!/已送出 0 \\/ 2 人/.test(v.bar) || !/思考中/.test(v.bar)) errors.push('推理畫面沒有送出狀態列：' + v.bar); }
  // 房主送出 → 鎖住、等待、有「立刻開獎」
  { const lbl = await p1.textContent('#submit'); if (!/送出我的推理報告/.test(lbl)) errors.push('多人時按鈕不是「送出我的推理報告」：' + lbl);
    const lbl2 = await p2.evaluate(() => { const b = document.querySelector('#submit'); return b ? b.textContent : '沒有按鈕'; }); if (!/送出我的推理報告/.test(lbl2)) errors.push('隊友沒有自己的送出按鈕：' + lbl2);
    await p1.click('#submit'); await sleep(800);
    const w = await p1.evaluate(() => ({ done: !!document.querySelector('#win .subDone'), force: !!document.querySelector('#forceRev'), dis: [...document.querySelectorAll('#win [data-df]')].every(b => b.disabled), bar: document.querySelector('#win .subBar').textContent, ph: __fs.G.st.phase }));
    console.log('房主送出後：', JSON.stringify(w)); if (!w.done || !w.force || !w.dis || w.ph !== 'deduce' || !/已送出 1 \\/ 2 人/.test(w.bar)) errors.push('房主送出後畫面不對：' + JSON.stringify(w));
    await shot(p1, 'deduce_waiting');
    // 關掉再回來：仍是已送出狀態
    await closeWin(p1); await p1.click('#bClose'); await sleep(400); const back = await p1.evaluate(() => ({ ov: __fs.G.ovKind, done: !!document.querySelector('#win .subDone') })); if (back.ov !== 'deduce' || !back.done) errors.push('已送出後關掉再回來狀態不對：' + JSON.stringify(back));
    const b2 = await p2.evaluate(() => ({ bar: document.querySelector('#win .subBar').textContent, json: JSON.stringify(__fs.G.st.drafts || {}) })); if (!/百九 ✅ 已送出/.test(b2.bar) || b2.json.includes(T.culprit)) errors.push('隊友畫面：送出狀態不對或看到答案 ' + JSON.stringify(b2)); }
  // 隊友（答錯兇手）送出 → 兩人自動開獎
  await pick(p2, Object.assign({}, T, { culprit: T.wrong })); await sleep(300); await p2.click('#submit');
  for (const p of [p1, p2]) await p.waitForFunction(() => __fs.G.st.phase === 'result' && __fs.G.ovKind === 'result', null, { timeout: 8000 }).catch(() => errors.push('全員送出後沒有自動開獎'));
  await sleep(500);
  const R = [];
  for (const [p, t] of [[p1, '房主'], [p2, '隊友']]) {
    const r = await p.evaluate(() => { const me = __fs.G.st.results[__fs.G.me]; const rows = [...document.querySelectorAll('#win .cmpR tr')].slice(1).map(tr => tr.textContent.replace(/\\s+/g, ' ').trim());
      return { rank: document.querySelector('#win .rank').textContent, total: me && me.total, myRank: me && me.rank, cul: me && me.rows[0].ok, rows, you: !!document.querySelector('#win .cmpR tr.me .tg'), top: !!document.querySelector('#win .cmpR .tg.top') }; });
    console.log(t + ' 結案報告：', JSON.stringify(r)); R.push(r);
    if (r.rank !== r.myRank) errors.push(t + ' 大字評價不是自己的成績');
    if (r.rows.length !== 2 || !r.you || !r.top) errors.push(t + ' 沒有全員成績比較表：' + JSON.stringify(r));
  }
  if (!(R[0].cul && !R[1].cul && R[0].total > R[1].total)) errors.push('兩人成績沒有各自計算：' + JSON.stringify(R));
  if (R[0].myRank !== 'S') console.log('（房主評價 ' + R[0].myRank + '）');
  if (!/百九/.test(R[0].rows[0]) || !/Cynthia/.test(R[0].rows[1])) errors.push('比較表沒有照分數排序：' + JSON.stringify(R[0].rows));
  await p1.evaluate(() => { const b = document.querySelector('#win .cmpR'); if (b) b.scrollIntoView({ block: 'center' }); }); await sleep(200);
  await p1.screenshot({ path: '/workspace/forensic_v18_multi_result.png' }); await p2.evaluate(() => { const b = document.querySelector('#win .cmpR'); if (b) b.scrollIntoView({ block: 'center' }); }); await p2.screenshot({ path: '/workspace/forensic_v18_multi_result_p2.png' });
  // 關掉結案報告 → 「📁 結案報告」回得去
  for (const p of [p1, p2]) { await closeWin(p); await p.click('#bClose'); await sleep(300); if ((await p.evaluate(() => __fs.G.ovKind)) !== 'result') errors.push('關掉結案報告後回不去'); }
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無'); await br.close(); process.exit(errors.length ? 1 : 0);
})();
`);
