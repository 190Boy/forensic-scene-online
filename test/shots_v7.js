// NODE_PATH=<playwright> node test/shots_v7.js [baseUrl] — v7 比例檢查用截圖
const { chromium, webkit, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3811/';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const tp = (pg, x, y) => pg.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; const p = G.st.players[G.me]; p.x = x; p.y = y; }, [x, y]);
const cop = (pg, x, y) => pg.evaluate(([x, y]) => { const c = __fs.G.st.cops[0]; if (c) { c.x = c.vx = x; c.y = c.vy = y; c.tx = x; c.ty = y; c.path = []; } }, [x, y]);
async function solo(br, opts, seed) {
  const pg = await (await br.newContext(opts)).newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(BASE + '?seed=' + seed); await sleep(1000); await pg.fill('#name', '百九');
  if (opts.isMobile) { await pg.tap('#bSolo'); await sleep(700); await pg.tap('#win footer [data-close]').catch(() => { }); }
  else { await pg.click('#bSolo'); await sleep(700); await pg.click('#win footer [data-close]').catch(() => { }); }
  await sleep(400); pg.errs = errs; return pg;
}
(async () => {
  const br = await chromium.launch(); const D = { viewport: { width: 1280, height: 800 } };
  const pg = await solo(br, D, 158);
  const b = await pg.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'body'); return { x: o.x, y: o.y, room: o.room }; });
  console.log('body', b);
  await tp(pg, b.x + 85, b.y + 20); await sleep(900); await pg.screenshot({ path: '/workspace/forensic_v7_living_body_player.png' });
  await tp(pg, 1060, 470); await cop(pg, 880, 470); await sleep(900); await pg.screenshot({ path: '/workspace/forensic_v7_sofa_door_officer.png' });
  await tp(pg, 1150, 990); await cop(pg, 1210, 1000); await sleep(900); await pg.screenshot({ path: '/workspace/forensic_v7_kitchen.png' });
  await tp(pg, 330, 700); await sleep(900); await pg.screenshot({ path: '/workspace/forensic_v7_van.png' });
  const r = await pg.evaluate(async () => { const o = __fs.ENG.objById(__fs.C, 'body'); __fs.G.camAt = { x: o.x, y: o.y + 40 }; await new Promise(r => setTimeout(r, 600)); const x = await __fs.bodyCheck(); __fs.G.camAt = null; return x; });
  console.log('bodyCheck', JSON.stringify(r));
  const wk = await webkit.launch(); const ip = await solo(wk, devices['iPhone 13'], 158);
  await tp(ip, b.x + 80, b.y + 25); await sleep(1000); await ip.screenshot({ path: '/workspace/forensic_v7_iphone.png' });
  console.log('errors', pg.errs.concat(ip.errs));
  await br.close(); await wk.close();
})().catch(e => { console.error(e); process.exit(1); });
