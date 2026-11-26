// NODE_PATH=<playwright> node tools/map_overview.js [baseUrl] — 全地圖總覽圖（1:1，給美術重新設計室內用）
// 產生 /workspace/forensic_map_overview_clean.png（沒有人物）與 /workspace/forensic_map_overview_with_chars.png（有人物當比例參考）
const { chromium } = require('playwright'); const fs = require('fs');
const BASE = process.argv[2] || 'http://localhost:3811/';
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1760, height: 1130 }, deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  await pg.goto(BASE + '?seed=158'); await pg.waitForTimeout(900); await pg.fill('#name', '百九'); await pg.click('#bSolo'); await pg.waitForTimeout(700);
  await pg.click('#win footer [data-close]').catch(() => { }); await pg.waitForTimeout(300);
  await pg.evaluate(() => { const G = __fs.G, st = G.st; st.quietUntil = 1e9; for (const k in st.lights) st.lights[k] = true; G.Me.x = 900; G.Me.y = 690; const p = st.players[G.me]; p.x = 900; p.y = 690; });
  await pg.waitForTimeout(6000);   // 讓關係人、員警走到各自的位置
  for (const [mode, file] of [['clean', 'forensic_map_overview_clean.png'], ['chars', 'forensic_map_overview_with_chars.png']]) {
    const d = await pg.evaluate(m => __fs.mapPNG(m), mode); fs.writeFileSync('/workspace/' + file, Buffer.from(d.split(',')[1], 'base64')); console.log('/workspace/' + file);
  }
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
