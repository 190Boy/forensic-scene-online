// NODE_PATH=<playwright> node test/e2e.js [baseUrl] — v2：用真的瀏覽器跑新手教學＋一局正式案件＋連線＋iPhone，截圖存到 /workspace/forensic_v2_*.png
const { chromium, webkit, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3811/';
const OUT = '/workspace/forensic_v2_';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shots = [];
async function shot(pg, name) { await pg.screenshot({ path: OUT + name + '.png' }); shots.push(OUT + name + '.png'); }
async function tp(pg, x, y) { await pg.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; const p = G.st.players[G.me]; p.x = x; p.y = y; }, [x, y]); await sleep(250); }
async function toObj(pg, id) {
  const o = await pg.evaluate(id => { const o = __fs.ENG.objById(__fs.C, id); return { x: o.x, y: o.y }; }, id);
  for (const d of [30, 60, 100, 140]) for (let a = 0; a < 16; a++) {
    const x = o.x + Math.round(Math.cos(a * Math.PI / 8) * d), y = o.y + Math.round(Math.sin(a * Math.PI / 8) * d * 0.8);
    if (!(await pg.evaluate(([x, y]) => __fs.ENG.walkable(__fs.C, x, y), [x, y]))) continue;
    await tp(pg, x, y); await sleep(150);
    if (await pg.evaluate(id => __fs.G.nearId === id, id)) return;
  }
  throw new Error('走不到 ' + id);
}
async function act(pg, label) { const b = pg.locator('#act button', { hasText: label }).first(); await b.waitFor({ timeout: 4000 }); await b.click(); await sleep(400); }
async function van(pg) { await tp(pg, 300, 690); await pg.evaluate(() => __fs.openVan()); await sleep(300); }
async function closeWin(pg) { await pg.evaluate(() => { const b = document.querySelector('#win header [data-close]'); if (b && b.offsetParent) b.click(); }); await sleep(250); }
const tutStep = pg => pg.evaluate(() => __fs.G.tut ? __fs.G.tut.i : -1);
async function waitStep(pg, n, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await tutStep(pg)) >= n) return; await sleep(150); } throw new Error(`教學卡在第 ${await tutStep(pg)} 步（要到 ${n}）`); }
const errors = [];
async function page(browser, opts) { const ctx = await browser.newContext(opts); const pg = await ctx.newPage(); pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ERR_|404|WebSocket/.test(m.text())) errors.push(m.text()); }); pg.on('dialog', d => d.accept()); return pg; }
async function chase(pg, find, ms = 15000) { // 追上某個移動中的人（員警／分局長）
  const t0 = Date.now(); while (Date.now() - t0 < ms) { const p = await pg.evaluate(find); if (p) await tp(pg, p.x, p.y + 6); else await sleep(200); if (await pg.evaluate(() => 0)) break; await sleep(150); if (!(await pg.evaluate(find))) return true; } return false;
}
async function deduceAndSubmit(pg, name) {
  const ans = await pg.evaluate(() => { const C = __fs.C, d = __fs.ENG.deduce(C, __fs.G.st); return { suspects: d.suspects.length === 1 ? d.suspects : [C.culprit], methods: d.methods.length === 1 ? d.methods : [C.method], weapon: d.weapon || C.weapon, location: d.location || C.location }; });
  await pg.click(`[data-cul="${ans.suspects[0]}"]`); await sleep(150);
  await pg.click(`[data-df="method"][data-v="${ans.methods[0]}"]`); await sleep(120);
  await pg.click(`[data-df="weapon"][data-v="${ans.weapon}"]`); await sleep(120);
  await pg.click(`[data-df="location"][data-v="${ans.location}"]`); await sleep(120);
  const keys = await pg.evaluate(() => __fs.G.st.found.map(f => f.id).slice(0, 6)); for (const k of keys) { const el = pg.locator(`[data-key="${k}"]`); if (await el.count()) { await el.first().click().catch(() => { }); await sleep(80); } }
  if (name) await shot(pg, name);
  await pg.click('#submit'); await sleep(900);
}
(async () => {
  const br = await chromium.launch();
  /* ---------- 1. 新手教學（桌機 1280） ---------- */
  const tg = await page(br, { viewport: { width: 1280, height: 800 } });
  await tg.goto(BASE); await sleep(900); await tg.fill('#name', '百九');
  await shot(tg, 'lobby');
  await tg.click('#bTut'); await sleep(900);
  await shot(tg, 'tut_1_walk');
  await tp(tg, 470, 600); await waitStep(tg, 1);
  await tp(tg, 300, 690); await sleep(300); await shot(tg, 'tut_2_van');
  await tg.evaluate(() => __fs.openVan()); await waitStep(tg, 2);
  for (const t of ['camera', 'luminol', 'prints']) await tg.click(`[data-tool="${t}"]`);
  await shot(tg, 'tut_3_gear');
  await tg.click('#gearOk'); await waitStep(tg, 3); await closeWin(tg);
  await toObj(tg, 'body'); await shot(tg, 'tut_4_highlight'); await act(tg, '近拍傷口'); await waitStep(tg, 4); await sleep(300);
  await shot(tg, 'tut_5_result_card');
  await toObj(tg, 'floor_living'); await act(tg, '噴灑魯米諾'); await waitStep(tg, 5);
  await shot(tg, 'tut_6_lights_on_no_glow');
  await toObj(tg, 'sw_living'); await tg.click('#act [data-k="light"]'); await waitStep(tg, 6); await sleep(500);
  await toObj(tg, 'floor_living'); await sleep(300); await shot(tg, 'dark_1_glow');
  await act(tg, '記錄螢光位置'); await waitStep(tg, 7); await sleep(500); await shot(tg, 'dark_2_recorded');
  await toObj(tg, 'w_statue'); await act(tg, '噴灑魯米諾'); await act(tg, '記錄螢光位置'); await act(tg, '採集指紋'); await waitStep(tg, 8);
  await van(tg); await tg.locator('[data-an]').first().click(); await waitStep(tg, 9); await sleep(300); await closeWin(tg);
  await toObj(tg, 'phone'); await act(tg, '裝袋帶走'); await waitStep(tg, 10);
  await van(tg); await tg.locator('[data-lab]').first().click(); await waitStep(tg, 11); await sleep(300); await closeWin(tg);
  // 分局長走進來 → 泡泡 → 走到他旁邊交差
  await tg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 }); await sleep(3500);
  { const b = await tg.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(tg, b.x + 150, b.y); await sleep(400); await shot(tg, 'tut_7_supervisor_bubble'); }
  for (let i = 0; i < 30 && (await tutStep(tg)) < 12; i++) { const b = await tg.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(tg, b.x + 10, b.y + 10); await sleep(200); }
  await waitStep(tg, 12, 6000);
  // 菜鳥 ⚠️
  await tg.waitForFunction(() => (__fs.G.st.cops || []).some(c => c.mode === 'in'), null, { timeout: 8000 });
  { const c = await tg.evaluate(() => { const c = __fs.G.st.cops.find(c => c.mode === 'in'); return { x: c.x, y: c.y }; }); await tp(tg, c.x + 130, c.y + 40); await sleep(300); await shot(tg, 'tut_8_rookie_alert'); }
  for (let i = 0; i < 60 && (await tutStep(tg)) < 13; i++) { const c = await tg.evaluate(() => { const c = (__fs.G.st.cops || []).find(c => c.mode === 'in'); return c && { x: c.x, y: c.y }; }); if (c) await tp(tg, c.x, c.y + 8); await sleep(200); }
  await waitStep(tg, 13);
  await tg.evaluate(() => __fs.openNote()); await sleep(300); await tg.click('[data-tab="man"]'); await waitStep(tg, 14); await shot(tg, 'tut_9_manual'); await closeWin(tg);
  await sleep(500); await shot(tg, 'tut_10_close_hint');
  await tg.click('#bClose'); await waitStep(tg, 15); await sleep(400);
  await deduceAndSubmit(tg, 'tut_11_deduce'); await waitStep(tg, 16); await sleep(500);
  await shot(tg, 'tut_12_done');
  const tres = await tg.evaluate(() => __fs.G.st.result); console.log('教學結果：', tres.rank, tres.total);
  /* ---------- 2. 正式案件（桌機） ---------- */
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  await pg.goto(BASE + '?seed=158'); await sleep(900);
  await pg.fill('#name', '百九'); await pg.selectOption('#diff', 'normal'); await pg.click('#bSolo'); await sleep(700);
  await shot(pg, 'briefing'); await closeWin(pg); await pg.click('#win footer [data-close]').catch(() => { }); await sleep(200);
  await van(pg); for (const t of ['camera', 'luminol', 'prints']) await pg.click(`[data-tool="${t}"]`); await pg.click('#gearOk'); await sleep(300); await closeWin(pg);
  await toObj(pg, 'body'); await act(pg, '近拍傷口'); await sleep(200); await shot(pg, 'result_card');
  // 員警巡邏，其中一位是菜鳥
  await pg.evaluate(() => { const st = __fs.G.st; st.quietUntil = 0; st.forceRookie = 'w_statue'; }); 
  await pg.waitForFunction(() => (__fs.G.st.cops || []).some(c => c.mode === 'in'), null, { timeout: 10000 });
  await sleep(1200); { const c = await pg.evaluate(() => { const c = __fs.G.st.cops.find(c => c.mode === 'in'); return { x: c.x, y: c.y }; }); await tp(pg, c.x + 150, c.y + 30); await sleep(400); }
  await shot(pg, 'officers_rookie_alert');
  for (let i = 0; i < 60; i++) { const c = await pg.evaluate(() => { const c = (__fs.G.st.cops || []).find(c => c.mode === 'in'); return c && { x: c.x, y: c.y }; }); if (!c) break; await tp(pg, c.x, c.y + 8); await sleep(200); }
  // 分局長：泡泡要求
  await pg.evaluate(() => { const st = __fs.G.st; st.quietUntil = 0; st.forceBoss = { kind: 'report', rep: 'tod' }; });
  await pg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 25000 }); await sleep(3500);
  { const b = await pg.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(pg, b.x + 140, b.y + 20); await sleep(500); }
  await shot(pg, 'supervisor_bubble');
  await toObj(pg, 'body'); const hasThermo = await pg.evaluate(() => __fs.G.st.players[0].tools.includes('thermo'));
  if (!hasThermo) { await van(pg); await pg.click('[data-tool="prints"]'); await pg.click('[data-tool="thermo"]'); await pg.click('#gearOk'); await sleep(300); await closeWin(pg); await toObj(pg, 'body'); }
  await act(pg, '量測肝溫'); await sleep(300);
  for (let i = 0; i < 20; i++) { const b = await pg.evaluate(() => __fs.G.st.boss.mode === 'in' && ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); if (!b) break; await tp(pg, b.x + 10, b.y + 10); await sleep(200); }
  const bok = await pg.evaluate(() => __fs.G.st.bossOk); console.log('分局長交差次數：', bok);
  await sleep(400); await shot(pg, 'supervisor_satisfied');
  // 關燈噴魯米諾
  await van(pg); await pg.click('[data-tool="thermo"]').catch(() => { }); await pg.click('[data-tool="prints"]').catch(() => { });
  await pg.evaluate(() => { const p = __fs.G.st.players[0]; }); await pg.click('#gearOk').catch(() => { }); await sleep(300); await closeWin(pg);
  await toObj(pg, 'floor_living'); await act(pg, '噴灑魯米諾');
  await toObj(pg, 'sw_living'); await pg.click('#act [data-k="light"]'); await sleep(500);
  await toObj(pg, 'floor_living'); await sleep(300); await shot(pg, 'dark_3_case_glow');
  await act(pg, '記錄螢光位置'); await sleep(500);
  await toObj(pg, 'sw_living'); await pg.click('#act [data-k="light"]'); await sleep(500); await toObj(pg, 'floor_living'); await sleep(200);
  await shot(pg, 'dark_4_lights_back_marker');
  // 送實驗室 → 待處理倒數
  await toObj(pg, 'phone'); await act(pg, '裝袋帶走'); await van(pg); await pg.locator('[data-lab]').first().click(); await sleep(400); await shot(pg, 'van_budget'); await closeWin(pg);
  await sleep(800); await shot(pg, 'hud_pending');
  await pg.evaluate(() => { for (const l of __fs.G.st.labs) if (!l.back) l.due = __fs.G.st.clock + 0.5; }); await sleep(1600);
  await shot(pg, 'lab_result_card');
  await pg.click('#bClose'); await sleep(800); await deduceAndSubmit(pg, null);
  await shot(pg, 'result');
  const res = await pg.evaluate(() => __fs.G.st.result); console.log('正式案件：', res.rank, res.total, 'time+', res.timeB, 'budget+', res.budB);
  /* ---------- 3. 連線：燈的開關同步 ---------- */
  const p1 = await page(br, { viewport: { width: 1280, height: 800 } }), p2 = await page(br, { viewport: { width: 1280, height: 800 } });
  await p1.goto(BASE); await sleep(800); await p1.fill('#name', '百九'); await p1.click('#bCreate');
  await p1.waitForFunction(() => /\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 8000 });
  const code = await p1.textContent('#rmCode');
  await p2.goto(BASE + '?room=' + code); await sleep(800); await p2.fill('#name', 'Cynthia'); await p2.click('#bJoin'); await sleep(1200);
  await shot(p1, 'room');
  await p1.click('#rmStart'); await sleep(1500);
  for (const p of [p1, p2]) await p.click('#win footer [data-close]').catch(() => { });
  for (const [x, y] of [[400, 690], [440, 640], [480, 610], [540, 600], [600, 590], [660, 590], [700, 580], [740, 540], [760, 500], [760, 480]]) { await p2.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; }, [x, y]); await sleep(170); }
  for (const [x, y] of [[400, 700], [440, 650], [480, 620], [540, 610], [600, 610], [640, 640]]) { await p1.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; }, [x, y]); await sleep(170); }
  await sleep(400); await p2.evaluate(() => __fs.doAct({ type: 'light', obj: 'sw_living' })); await sleep(900);
  const lit = await p1.evaluate(() => __fs.G.st.lights.living); console.log('Cynthia 關燈後，百九看到客廳的燈：', lit ? '亮' : '暗');
  if (lit !== false) errors.push('燈的狀態沒有同步');
  await shot(p1, 'dark_5_online_teammate_switch');
  /* ---------- 4. iPhone 13（WebKit） ---------- */
  await br.close();
  const wk = await webkit.launch();
  const ip = await page(wk, devices['iPhone 13']);
  await ip.goto(BASE); await sleep(1200); await ip.fill('#name', '百九');
  await shot(ip, 'iphone_lobby');
  await ip.tap('#bTut'); await sleep(900); await shot(ip, 'iphone_tutorial');
  await tp(ip, 470, 600); await waitStep(ip, 1); await ip.evaluate(() => __fs.openVan()); await waitStep(ip, 2);
  for (const t of ['camera', 'luminol', 'prints']) await ip.tap(`[data-tool="${t}"]`); await ip.tap('#gearOk'); await waitStep(ip, 3); await closeWin(ip);
  await toObj(ip, 'body'); await act(ip, '近拍傷口'); await sleep(300); await shot(ip, 'iphone_result_card');
  await toObj(ip, 'floor_living'); await act(ip, '噴灑魯米諾'); await toObj(ip, 'sw_living'); await ip.tap('#act [data-k="light"]'); await sleep(500); await toObj(ip, 'floor_living'); await sleep(300);
  await shot(ip, 'dark_6_iphone');
  await ip.evaluate(() => { __fs.Tut.stop(); }); 
  const ip2 = await page(wk, devices['iPhone 13']);
  await ip2.goto(BASE + '?seed=158'); await sleep(1200); await ip2.fill('#name', '百九'); await ip2.tap('#bSolo'); await sleep(700); await ip2.tap('#win footer [data-close]').catch(() => { }); await sleep(300);
  await ip2.evaluate(() => { const st = __fs.G.st; st.quietUntil = 0; st.forceBoss = { kind: 'progress', pct: 30 }; });
  await ip2.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 25000 }); await sleep(3500);
  { const b = await ip2.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(ip2, b.x + 120, b.y + 40); await sleep(500); }
  await shot(ip2, 'iphone_supervisor_hud');
  await wk.close();
  console.log('截圖：\n' + shots.join('\n'));
  console.log('頁面錯誤：', errors.length ? errors : '無');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('截圖：\n' + shots.join('\n')); process.exit(1); });
