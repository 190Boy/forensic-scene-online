// NODE_PATH=<playwright> node test/e2e.js [baseUrl] — 用真的瀏覽器從頭玩到尾，存截圖到 /workspace/forensic_*.png
const { chromium, webkit, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3811/';
const OUT = '/workspace/forensic_';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function tp(pg, x, y) { await pg.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; const p = G.st.players[G.me]; p.x = x; p.y = y; }, [x, y]); await sleep(250); }
async function toObj(pg, id) {
  const o = await pg.evaluate(id => { const o = __fs.ENG.objById(__fs.C, id); return { x: o.x, y: o.y, r: o.r || 60 }; }, id);
  const offs = []; for (const d of [30, 60, 100, 140]) for (let a = 0; a < 16; a++) offs.push([Math.round(Math.cos(a * Math.PI / 8) * d), Math.round(Math.sin(a * Math.PI / 8) * d * 0.8)]);
  for (const [dx, dy] of offs) {
    const ok = await pg.evaluate(([x, y]) => __fs.ENG.walkable(__fs.C, x, y), [o.x + dx, o.y + dy]); if (!ok) continue;
    await tp(pg, o.x + dx, o.y + dy); await sleep(150);
    if (await pg.evaluate(id => __fs.G.nearId === id, id)) return;
  }
  throw new Error('走不到 ' + id);
}
async function act(pg, label) { const b = pg.locator('#act button', { hasText: label }).first(); await b.waitFor({ timeout: 4000 }); await b.click(); await sleep(350); }
async function van(pg) { await tp(pg, 300, 690); await pg.evaluate(() => __fs.openVan()); await sleep(300); }
const errors = [];
async function page(browser, opts) { const ctx = await browser.newContext(opts); const pg = await ctx.newPage(); pg.on('pageerror', e => errors.push(e.message)); pg.on('console', m => { if (m.type() === 'error' && !/ERR_|404|WebSocket/.test(m.text())) errors.push(m.text()); }); return pg; }
(async () => {
  /* ---------- 桌機：單人完整一局 ---------- */
  const br = await chromium.launch();
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  await pg.goto(BASE + '?seed=158'); await sleep(1000);
  await pg.fill('#name', '百九'); await pg.selectOption('#diff', 'normal');
  await pg.screenshot({ path: OUT + 'lobby.png' });
  await pg.click('#bSolo'); await sleep(600);
  await pg.screenshot({ path: OUT + 'briefing.png' });
  await pg.click('#win footer [data-close]'); await sleep(300);
  // 鑑識車選裝備
  await van(pg);
  for (const t of ['camera', 'luminol', 'prints']) await pg.click(`[data-tool="${t}"]`);
  await pg.screenshot({ path: OUT + 'van_gear.png' });
  await pg.click('#gearOk'); await sleep(300); await pg.click('#win header [data-close]');
  // 現場勘查
  await toObj(pg, 'body'); await act(pg, '近拍傷口'); await act(pg, '檢查屍斑');
  await toObj(pg, 'frame'); await act(pg, '近拍');
  await toObj(pg, 'floor_living'); await act(pg, '噴灑魯米諾'); await sleep(500);
  await pg.screenshot({ path: OUT + 'scene.png' });
  await toObj(pg, 'w_statue'); await act(pg, '噴灑魯米諾'); await act(pg, '採集指紋');
  await toObj(pg, 'phone'); await act(pg, '裝袋帶走');
  // 回車上：分析指紋、手機送實驗室
  await van(pg);
  await pg.locator('[data-an]').first().click(); await sleep(400);
  await pg.locator('[data-lab]').first().click(); await sleep(400);
  await pg.screenshot({ path: OUT + 'van_lab.png' });
  await pg.click('#win header [data-close]');
  // 換裝備（-1）去量肝溫、看書桌，讓實驗室報告回來
  await van(pg); await pg.click('[data-tool="prints"]'); await pg.click('[data-tool="thermo"]'); await pg.click('#gearOk'); await sleep(300); await pg.click('#win header [data-close]');
  await toObj(pg, 'body'); await act(pg, '量測肝溫');
  await toObj(pg, 'desk'); await act(pg, '翻拍抽屜');
  await toObj(pg, 'mop'); await act(pg, '噴灑魯米諾'); await sleep(600);
  await pg.screenshot({ path: OUT + 'lab_result.png' });
  // 壓力系統：菜鳥員警闖入
  await pg.evaluate(() => { __fs.G.st.rookieAt = __fs.G.st.clock + 0.1; }); await sleep(2500);
  await tp(pg, 330, 900); await sleep(400);
  await pg.screenshot({ path: OUT + 'pressure.png' });
  // 筆記本：鑑識手冊
  await pg.evaluate(() => __fs.openNote()); await sleep(200); await pg.click('[data-tab="man"]'); await sleep(200);
  await pg.screenshot({ path: OUT + 'notebook.png' });
  await pg.click('#win header [data-close]');
  // 結案推理
  pg.once('dialog', d => d.accept()); await pg.click('#bClose'); await sleep(800);
  const ans = await pg.evaluate(() => { const C = __fs.C, d = __fs.ENG.deduce(C, __fs.G.st); return { d, C: { culprit: C.culprit, method: C.method, weapon: C.weapon, location: C.location } }; });
  console.log('推論：', JSON.stringify(ans.d), '真相：', JSON.stringify(ans.C));
  await pg.click(`[data-cul="${ans.d.suspects[0]}"]`); await sleep(200);
  await pg.click(`[data-df="method"][data-v="${ans.d.methods[0]}"]`); await sleep(150);
  await pg.click(`[data-df="weapon"][data-v="${ans.d.weapon}"]`); await sleep(150);
  await pg.click(`[data-df="location"][data-v="${ans.d.location}"]`); await sleep(150);
  for (const k of ['E_phone', 'E_fp_statue', 'E_motive']) { const el = pg.locator(`[data-key="${k}"]`); if (await el.count()) { await el.click(); await sleep(150); } }
  await pg.evaluate(() => document.querySelectorAll('#win .body, #win').forEach(e => e.scrollTop = 0)); await sleep(200);
  await pg.screenshot({ path: OUT + 'deduction.png' });
  pg.once('dialog', d => d.accept()); await pg.click('#submit'); await sleep(800);
  await pg.screenshot({ path: OUT + 'result.png' });
  const res = await pg.evaluate(() => __fs.G.st.result); console.log('結果：', res.rank, res.total, res.rows.map(r => r.label + (r.ok ? '✔' : '✖')).join(' '));
  /* ---------- 連線：兩個瀏覽器同一房 ---------- */
  const p1 = await page(br, { viewport: { width: 1280, height: 800 } }), p2 = await page(br, { viewport: { width: 1280, height: 800 } });
  await p1.goto(BASE); await sleep(800); await p1.fill('#name', '百九'); await p1.click('#bCreate');
  await p1.waitForFunction(() => /\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 8000 });
  const code = await p1.textContent('#rmCode');
  await p2.goto(BASE + '?room=' + code); await sleep(800); await p2.fill('#name', 'Cynthia'); await p2.click('#bJoin'); await sleep(1200);
  await p1.screenshot({ path: OUT + 'room.png' });
  await p1.click('#rmStart'); await sleep(1200);
  for (const p of [p1, p2]) { await p.click('#win footer [data-close]').catch(() => { }); }
  await p2.evaluate(() => { const G = __fs.G; G.Me.x = 360; G.Me.y = 760; }); await sleep(600);
  await p2.evaluate(() => { const ch = document.querySelector('#chatIn'); }); await p2.click('#bChat'); await p2.fill('#chatIn', '我去後院採鞋印'); await p2.press('#chatIn', 'Enter'); await sleep(700);
  await p1.screenshot({ path: OUT + 'online_game.png' });
  const seen = await p1.evaluate(() => { const v = __fs.G.view[1]; return v && Math.round(v.x) + ',' + Math.round(v.y); }); console.log('百九看到 Cynthia 在', seen);
  await br.close();
  /* ---------- iPhone 13（WebKit） ---------- */
  const wk = await webkit.launch();
  const ip = await page(wk, devices['iPhone 13']);
  await ip.goto(BASE + '?seed=158'); await sleep(1200); await ip.fill('#name', '百九');
  await ip.screenshot({ path: OUT + 'iphone_lobby.png' });
  await ip.tap('#bSolo'); await sleep(600); await ip.tap('#win footer [data-close]'); await sleep(300);
  await ip.evaluate(() => __fs.openVan()); await sleep(300);
  for (const t of ['camera', 'luminol', 'thermo']) await ip.tap(`[data-tool="${t}"]`);
  await ip.screenshot({ path: OUT + 'iphone_van.png' });
  await ip.tap('#gearOk'); await sleep(300); await ip.tap('#win header [data-close]');
  // 點地板自動走路（觸控）
  await ip.touchscreen.tap(330, 420); await sleep(1500);
  await toObj(ip, 'floor_living'); await act(ip, '噴灑魯米諾'); await sleep(400);
  await ip.screenshot({ path: OUT + 'iphone_scene.png' });
  await wk.close();
  console.log('頁面錯誤：', errors.length ? errors : '無');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
