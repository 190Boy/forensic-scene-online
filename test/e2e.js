// NODE_PATH=<playwright> node test/e2e.js [baseUrl] — v2：用真的瀏覽器跑新手教學＋一局正式案件＋連線＋iPhone，截圖存到 /workspace/forensic_v2_*.png
const { chromium, webkit, devices } = require('playwright');
const BASE = process.argv[2] || 'http://localhost:3811/';
const OUT = '/workspace/forensic_v21_';
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
// 連線時不能瞬移（伺服器會檢查速度）：沿著路徑一小步一小步走
async function walkTo(pg, x, y, r = 12) {
  const path = await pg.evaluate(([x, y, r]) => { const G = __fs.G; return __fs.ENG.findPath(__fs.C, G.Me.x, G.Me.y, x, y, r) || []; }, [x, y, r]);
  let cur = await pg.evaluate(() => [__fs.G.Me.x, __fs.G.Me.y]);
  for (const q of path) { const n = Math.max(1, Math.ceil(Math.hypot(q.x - cur[0], q.y - cur[1]) / 22)); for (let i = 1; i <= n; i++) { const px = cur[0] + (q.x - cur[0]) * i / n, py = cur[1] + (q.y - cur[1]) * i / n; await pg.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; }, [px, py]); await sleep(120); } cur = [q.x, q.y]; }
  await sleep(400);
}
async function walkToObj(pg, id) { const o = await pg.evaluate(id => { const o = __fs.ENG.objById(__fs.C, id); return { x: o.x, y: o.y }; }, id); await walkTo(pg, o.x, o.y + 20, 60); await pg.waitForFunction(id => __fs.G.nearId === id, id, { timeout: 3000 }).catch(() => errors.push('連線走不到 ' + id)); }
const keyLog = [];
// 電腦版（body.kb）用鍵盤：讀清單上的編號再按鍵；手機版用點的
async function act(pg, label, o = {}) {
  const b = pg.locator('#act button', { hasText: label }).first(); await b.waitFor({ timeout: 4000 });
  const isMg = !!(await b.getAttribute('data-mg'));
  if (await pg.evaluate(() => document.body.classList.contains('kb'))) { const k = await b.getAttribute('data-key'); if (!k) throw new Error('沒有快捷鍵：' + label); keyLog.push(`${k.toUpperCase()}=${label}`); await pg.keyboard.press(k === 'e' ? 'e' : k); }
  else await b.click();
  await sleep(400);
  if (isMg) { await mgWaitOpen(pg).catch(() => errors.push('小遊戲沒有打開：' + label)); mgLog.push(label); if (!o.manual) await mgAuto(pg, o.score == null ? .95 : o.score); }
}
/* v16 完整教學：共用的步驟操作 */
const TUT_N = 25;
async function tutCop(pg, id = 'cop2') { const c = await pg.evaluate(id => { const c = __fs.G.st.cops.find(c => c.id === id); return { x: c.vx != null ? c.vx : c.x, y: c.vy != null ? c.vy : c.y }; }, id); await tp(pg, c.x + 40, c.y + 30); await pg.waitForFunction(id => __fs.G.nearId === 'cop:' + id, id, { timeout: 4000 }); await sleep(200); }
async function tutSus(pg) { const n = await pg.evaluate(() => { const G = __fs.G, ns = G.st.npcs.filter(n => n.mode !== 'gone').sort((a, b) => Math.hypot(a.x - G.Me.x, a.y - G.Me.y) - Math.hypot(b.x - G.Me.x, b.y - G.Me.y)); const n = ns[0]; n.path = []; return { id: n.id, x: n.vx != null ? n.vx : n.x, y: n.vy != null ? n.vy : n.y }; });
  await tp(pg, n.x + 30, n.y + 25); await pg.waitForFunction(id => __fs.G.nearId === 'npc:' + id, n.id, { timeout: 4000 }); await sleep(200); }
async function tutVan(pg) { await tp(pg, 336, 880); await pg.waitForFunction(() => __fs.G.nearId === 'van' || __fs.G.nearId === 'courier', null, { timeout: 3000 }).catch(() => { }); await sleep(200); await pg.click('#act [data-van]'); await sleep(400); }
async function tutGear(pg, tools) { await tutVan(pg); for (const t of tools) await pg.click('[data-tool="' + t + '"]'); await pg.click('#gearOk'); await sleep(300); }
async function tutAnalyze(pg, kind) { const sid = await pg.evaluate(k => { const m = __fs.G.st.players[__fs.G.me].samples.find(s => s.kind === k); return m && m.sid; }, kind); if (sid == null) throw new Error('沒有 ' + kind + ' 樣本'); await pg.click('[data-an="' + sid + '"]'); await sleep(400); }
async function tutSocial(pg, order = 'door') {
  await tutCop(pg); await act(pg, '聽取初步報告'); await waitStep(pg, 2);
  await act(pg, order === 'door' ? '守住大門' : '看住菜鳥'); await waitStep(pg, 3);
  await tutSus(pg); await act(pg, '觀察嫌疑人'); await sleep(1300); await waitStep(pg, 4);
  await tutSus(pg); await act(pg, '周旋'); await waitStep(pg, 5);
}
async function tutChase(pg, find, until, ms = 30000) { const t0 = Date.now(); while (Date.now() - t0 < ms && (await tutStep(pg)) < until) { const q = await pg.evaluate(find); if (q) await tp(pg, q.x + 6, q.y + 8); await sleep(200); } await waitStep(pg, until, 3000); }
// 從頭玩到「🎉 教學完成！」：每一步都檢查步驟號碼一格一格往前走（小遊戲自動給高分；opt.manual 讓呼叫的人自己玩）

async function checkTutCallout(pg, tag, step) {
  await pg.evaluate(() => { if (__fs.placeTut) __fs.placeTut(); });
  const r = await pg.evaluate(() => {
    const t = document.querySelector('#tut'), st = __fs.stage();
    if (!t || t.classList.contains('hidden')) return { missing: true };
    const hit = (a, b, pad) => a && b && a.l < b.r - pad && a.r > b.l + pad && a.t < b.b - pad && a.b > b.t + pad;
    const box = e => { const b = e.getBoundingClientRect(); return { l: +b.left.toFixed(1), t: +b.top.toFixed(1), r: +b.right.toFixed(1), b: +b.bottom.toFixed(1) }; };
    const tr = box(t), canvas = { l: st.OX, t: st.OY, r: st.OX + st.VW, b: st.OY + st.VH };
    const tg = __fs.tutTargetRect ? __fs.tutTargetRect() : null;
    const actEl = document.querySelector('#act');
    const act = actEl && !actEl.classList.contains('hidden') && actEl.getBoundingClientRect().width > 8 ? box(actEl) : null;
    const tgOn = tg && tg.r > canvas.l + 20 && tg.l < canvas.r - 20 && tg.b > canvas.t + 20 && tg.t < canvas.b - 20;
    const ov = document.querySelector('#ov'), mg = document.querySelector('#mg');
    const modal = (ov && !ov.classList.contains('hidden')) || (mg && !mg.classList.contains('hidden'));
    let btnHit = null;
    if (modal) {
      for (const sel of ['#gearOk', '#submit', '#win header [data-close]', '#win footer [data-close]', '#mgX', '#win [data-tab]', '#win [data-tool]', '#win [data-an]', '#win [data-lab]']) {
        const el = document.querySelector(sel); if (!el || el.disabled) continue;
        const b = box(el); if (b.r - b.l > 2 && hit(tr, b, 2)) btnHit = sel;
      }
    }
    return {
      step: __fs.G.tut ? __fs.G.tut.i + 1 : 0, missing: false, tut: tr, canvas, tg: tg && { l: +tg.l.toFixed(1), t: +tg.t.toFixed(1), r: +tg.r.toFixed(1), b: +tg.b.toFixed(1), id: tg.id }, tgOn, act,
      inside: tr.l >= canvas.l - 2 && tr.r <= canvas.r + 2 && tr.t >= canvas.t - 2 && tr.b <= canvas.b + 2,
      hitTarget: !!(tgOn && !modal && hit(tr, tg, 2)), hitAct: !!(act && hit(tr, act, 2)), modal, btnHit, dock: t.classList.contains('dock'),
      h: (t.querySelector('.tx') || t).clientHeight, sh: (t.querySelector('.tx') || t).scrollHeight,
      mini: ((document.querySelector('#tutMini') || {}).textContent || '').trim(), sb: document.body.classList.contains('sb')
    };
  });
  const label = `${tag} 第 ${step} 步教學提示`;
  if (r.missing) { errors.push(label + '：沒有出現'); return r; }
  if (!r.inside) errors.push(label + '：超出畫布 ' + JSON.stringify({ tut: r.tut, canvas: r.canvas }));
  if (r.sh > r.h + 4) errors.push(label + '：文字被裁切 ' + JSON.stringify({ h: r.h, sh: r.sh }));
  if (r.tgOn && r.hitTarget) errors.push(label + '：蓋到目標 ' + JSON.stringify({ tut: r.tut, tg: r.tg }));
  if (r.hitAct) errors.push(label + '：蓋到互動清單 ' + JSON.stringify({ tut: r.tut, act: r.act }));
  if (r.btnHit) errors.push(label + '：蓋到視窗按鈕 ' + r.btnHit);
  if (r.sb && !/新手教學/.test(r.mini)) errors.push(label + '：側欄沒有精簡教學列：' + r.mini);
  return r;
}
async function tutFull(pg, tag) {
  const seen = []; const mark = async n => { await waitStep(pg, n); seen.push(n); await sleep(120);
    const bar = await pg.evaluate(() => { const b = document.querySelector('#bar'); return b && Math.round(b.getBoundingClientRect().bottom); });
    if (bar > await pg.evaluate(() => innerHeight)) errors.push(`${tag} 第 ${n + 1} 步快捷列跑出畫面：` + bar);
    await checkTutCallout(pg, tag, n + 1); };
  await pg.evaluate(() => { window.__hlSeen = {}; setInterval(() => { const T = __fs.Tut, g = __fs.G.tut; const s = g && T.steps[g.i]; if (s && s.hl && s.hl.some(q => document.querySelector(q))) __hlSeen[g.i] = 1; }, 80); });
  await tp(pg, 640, 718); await mark(1);
  await tutCop(pg); await act(pg, '聽取初步報告'); await mark(2);
  await act(pg, '守住大門'); await mark(3);
  await tutSus(pg); await act(pg, '觀察嫌疑人'); await sleep(1300); await mark(4);
  await tutSus(pg); await act(pg, '周旋'); await mark(5);
  await tutGear(pg, ['camera', 'luminol', 'prints']); await mark(6); await closeWin(pg);
  await toObj(pg, 'body'); await act(pg, '近拍傷口'); await mark(7);
  await toObj(pg, 'floor_living'); await act(pg, '噴灑魯米諾'); await mark(8);
  await toObj(pg, 'sw_living'); await act(pg, '燈'); await mark(9);
  await toObj(pg, 'floor_living'); await act(pg, '記錄螢光位置'); await mark(10);
  await toObj(pg, 'w_statue'); await act(pg, '噴灑魯米諾'); await act(pg, '記錄螢光位置'); await act(pg, '採集指紋'); await mark(11);
  await tutVan(pg); await tutAnalyze(pg, 'print'); await mark(12);
  for (const t of ['thermo', 'swab', 'shoe']) await pg.click('[data-tool="' + t + '"]'); await pg.click('#gearOk'); await sleep(300); await mark(13); await closeWin(pg);
  await toObj(pg, 'body'); await act(pg, '量測肝溫'); await mark(14);
  await toObj(pg, 'body'); await act(pg, '採集死者血液'); await mark(15);
  await toObj(pg, 'phone'); await act(pg, '裝袋帶走'); await mark(16);
  await toObj(pg, 'mud'); await act(pg, '採集鞋印'); await mark(17);
  await tutVan(pg); await tutAnalyze(pg, 'blood'); await mark(18);
  await pg.click('[data-lab="phone"]'); await sleep(300); await mark(19); await closeWin(pg);
  await pg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 });
  await tutChase(pg, () => { const B = __fs.G.st.boss; return B.mode === 'in' ? { x: B.x, y: B.y } : null; }, 20); await mark(20);
  await pg.waitForFunction(() => (__fs.G.st.cops || []).some(c => c.mode === 'in'), null, { timeout: 8000 });
  await tutChase(pg, () => { const c = (__fs.G.st.cops || []).find(c => c.mode === 'in'); return c && { x: c.x, y: c.y }; }, 21); await mark(21);
  await pg.click('#bNote'); await sleep(300); for (const t of ['cop', 'cmp', 'man']) { await pg.click('#win [data-tab="' + t + '"]'); await sleep(150); } await mark(22); await closeWin(pg);
  await pg.click('#bClose'); await mark(23); await sleep(500);
  await deduceAndSubmit(pg, null); await mark(24); await sleep(400); await checkTutCallout(pg, tag, 25);
  const fin = await pg.evaluate(() => ({ i: __fs.G.tut.i, n: __fs.Tut.steps.length, txt: document.querySelector('#tut').textContent, home: !!document.querySelector('#tutHome'), res: __fs.G.st.result && __fs.G.st.result.rank }));
  console.log(`${tag} 完整教學：${fin.i + 1}/${fin.n} 步，結果 ${fin.res}`);
  if (fin.n !== TUT_N || fin.i !== TUT_N - 1 || !/教學完成/.test(fin.txt) || !fin.home) errors.push(tag + ' 教學沒有走到「🎉 教學完成！」：' + JSON.stringify(fin));
  const noHl = await pg.evaluate(() => __fs.Tut.steps.map((s, i) => s.hl && s.hl.length && !__hlSeen[i] ? i + 1 : 0).filter(Boolean));
  if (noHl.length) errors.push(tag + ' 這些步驟的提示框從沒對到畫面上的按鈕：' + noHl.join(','));
  if (seen.length !== TUT_N - 1) errors.push(tag + ' 步驟沒有一格一格走：' + seen.join(','));
  return fin;
}
/* v9 小遊戲 */
const mgLog = [];
async function mgWaitOpen(pg, ms = 5000) { await pg.waitForFunction(() => __fs.MG.on, null, { timeout: ms }); await sleep(250); }
async function mgWaitDone(pg, ms = 15000) { await pg.waitForFunction(() => !__fs.MG.on && !(__fs.G.st.players[__fs.G.me] || {}).mg, null, { timeout: ms }); await sleep(350); }
async function mgAuto(pg, score) { await pg.evaluate(s => __fs.mgFinish(s), score); await mgWaitDone(pg); }
const mgDbg = pg => pg.evaluate(() => __fs.mgDbg());
const mgPt = (pg, x, y) => pg.evaluate(([x, y]) => __fs.MG.toPage(x, y), [x, y]);
async function holdKey(pg, key, ms) { if (ms <= 0) return; await pg.keyboard.down(key); await sleep(ms); await pg.keyboard.up(key); }
// 滑鼠慢慢移動（每 22ms 3px），魯米諾／棉棒需要「慢」
async function slowMouse(pg, from, to, step = 3) { const n = Math.max(1, Math.ceil(Math.hypot(to[0] - from[0], to[1] - from[1]) / step)); for (let i = 1; i <= n; i++) { await pg.mouse.move(from[0] + (to[0] - from[0]) * i / n, from[1] + (to[1] - from[1]) * i / n); await sleep(22); } return to; }
// 觸控拖曳（WebKit 沒有 touchscreen.move，用 pointer 事件模擬手指）
async function touchDrag(pg, pts, ms = 22) {
  await pg.evaluate(([x, y]) => { const c = document.getElementById('mgC'); c.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })); }, pts[0]);
  for (const [x, y] of pts.slice(1)) { await pg.evaluate(([x, y]) => document.getElementById('mgC').dispatchEvent(new PointerEvent('pointermove', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })), [x, y]); await sleep(ms); }
  await pg.evaluate(([x, y]) => document.getElementById('mgC').dispatchEvent(new PointerEvent('pointerup', { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true, isPrimary: true })), pts[pts.length - 1]);
}
const line = (a, b, step = 3) => { const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step)); return Array.from({ length: n + 1 }, (_, i) => [a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n]); };
// 拍照（滑鼠）：移到重點 → 停穩對焦 → 點一下
async function playPhotoMouse(pg, shotName) {
  for (let k = 0; k < 3; k++) { const d = await mgDbg(pg); if (!d || !d.targets.length) break; const tg = d.targets.find(t => t[2] === 'd') || d.targets[0]; const [px, py] = await mgPt(pg, tg[0], tg[1]); await pg.mouse.move(px, py, { steps: 10 }); await sleep(1300); if (tg[2] === 'd' && shotName) await shot(pg, shotName); await pg.mouse.down(); await pg.mouse.up(); await sleep(300); }
}
// 拍照（iPhone 觸控）：點一下要拍的地方 → 等對焦 → 按快門按鈕
async function playPhotoTouch(pg, shotName) {
  for (let k = 0; k < 3; k++) { const d = await mgDbg(pg); if (!d || !d.targets.length) break; const [px, py] = await mgPt(pg, ...d.targets[0]); await pg.touchscreen.tap(px, py); await sleep(1300); if (k === 1 && shotName) await shot(pg, shotName); await pg.tap('#mgF .mgb.main'); await sleep(300); }
}
// 魯米諾（滑鼠慢掃＋空白鍵標記＋Enter 完成）
async function playLumMouse(pg, shotName) {
  const d = await mgDbg(pg); let cur = await mgPt(pg, 320, 220); await pg.mouse.move(cur[0], cur[1]); await sleep(400); let k = 0;
  for (const [x, y] of d.specks) { const to = await mgPt(pg, x, y); cur = await slowMouse(pg, cur, to); await sleep(1700); await pg.keyboard.press(' '); keyLog.push('空白=標記螢光'); await sleep(200); if (++k === 3 && shotName) await shot(pg, shotName); }
  for (const [x, y] of [[80, 80], [560, 80], [560, 360], [80, 360]]) cur = await slowMouse(pg, cur, await mgPt(pg, x, y), 5);
  await pg.keyboard.press('Enter'); keyLog.push('Enter=完成記錄');
}
// 刷指紋（只用鍵盤：方向鍵移動、按住空白鍵刷）
async function playPrintsKeys(pg, shotName) {
  const d = await mgDbg(pg), [cx, cy] = d.center, [rx, ry] = d.r, v = 190;
  const x0 = cx - rx * .8, y0 = cy - ry * .75;
  await holdKey(pg, x0 > 320 ? 'ArrowRight' : 'ArrowLeft', Math.abs(x0 - 320) / v * 1000); await holdKey(pg, y0 > 220 ? 'ArrowDown' : 'ArrowUp', Math.abs(y0 - 220) / v * 1000);
  await pg.keyboard.down(' '); let dir = 1;
  for (let r = 0; r < 6; r++) { await holdKey(pg, dir > 0 ? 'ArrowRight' : 'ArrowLeft', rx * 1.6 / v * 1000); dir = -dir; if (r === 3 && shotName) await shot(pg, shotName); await holdKey(pg, 'ArrowDown', 28 / v * 1000); }
  await pg.keyboard.up(' '); keyLog.push('空白＋方向鍵=刷粉'); const st = await mgDbg(pg); console.log('刷指紋（鍵盤）：', JSON.stringify({ rev: +st.rev.toFixed(2), sm: +st.sm.toFixed(2) }));
  await pg.keyboard.press('Enter');
}
async function van(pg) { await tp(pg, 336, 880); await pg.evaluate(() => __fs.openVan()); await sleep(300); }
async function closeWin(pg) { await pg.evaluate(() => { const b = document.querySelector('#win header [data-close]'); if (b && b.offsetParent) b.click(); }); await sleep(250); }
const tutStep = pg => pg.evaluate(() => __fs.G.tut ? __fs.G.tut.i : -1);
async function waitStep(pg, n, ms = 8000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { if ((await tutStep(pg)) >= n) return; await sleep(150); } throw new Error(`教學卡在第 ${await tutStep(pg)} 步（要到 ${n}）`); }
const errors = [];
// 屍體一定要真的畫在畫面上：畫的順序在地毯之後，而且畫面上那一塊有屍體的顏色
async function checkBody(pg, tag, file) {
  const o = await pg.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'body'); return { x: o.x, y: o.y, w: o.w, h: o.h }; });
  let spot = null; for (const [dx, dy] of [[0, 140], [0, -130], [-220, 60], [220, 60], [0, 180], [-260, 0], [260, 0]]) if (await pg.evaluate(([x, y]) => __fs.ENG.walkable(__fs.C, x, y), [o.x + dx, o.y + dy])) { spot = [o.x + dx, o.y + dy]; break; }
  if (spot) await tp(pg, spot[0], spot[1]); await sleep(600);
  const r = await pg.evaluate(() => __fs.bodyCheck());
  console.log(`屍體檢查［${tag}］：`, JSON.stringify(r));
  if (!(r.drawnOnTop && r.onScreen && r.ratio > 0.3)) errors.push(`屍體沒有畫出來［${tag}］：${JSON.stringify(r)}`);
  if (file) { await pg.screenshot({ path: '/workspace/' + file }); shots.push('/workspace/' + file); }
}
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
  await tp(tg, 640, 718); await waitStep(tg, 1);
  await tutCop(tg); await shot(tg, 'tut_2_officer'); await tg.keyboard.press('e'); await waitStep(tg, 2); await closeWin(tg);
  await tutCop(tg); await act(tg, '守住大門'); await waitStep(tg, 3);
  await tutSus(tg); await act(tg, '觀察嫌疑人'); await sleep(1300); await waitStep(tg, 4); await shot(tg, 'tut_3_observe'); await closeWin(tg);
  await tutSus(tg); await act(tg, '周旋'); await waitStep(tg, 5);
  await tp(tg, 336, 880); await sleep(300); await shot(tg, 'tut_4_van');
  await tg.keyboard.press('e'); await sleep(400);
  for (const t of ['camera', 'luminol', 'prints']) await tg.click(`[data-tool="${t}"]`);
  await shot(tg, 'tut_5_gear');
  await tg.click('#gearOk'); await waitStep(tg, 6); await closeWin(tg);
  await checkBody(tg, '教學・桌機', 'forensic_v3_body_tutorial.png');
  await toObj(tg, 'body'); await shot(tg, 'tut_6_highlight'); await act(tg, '近拍傷口', { manual: true }); await playPhotoMouse(tg, 'mg_photo'); await mgWaitDone(tg); await waitStep(tg, 7); await sleep(300);
  console.log('拍照（滑鼠）分數：', await tg.evaluate(() => __fs.MG.score));
  await shot(tg, 'tut_7_result_card');
  await toObj(tg, 'floor_living'); await act(tg, '噴灑魯米諾'); await waitStep(tg, 8);
  await shot(tg, 'tut_8_lights_on_no_glow');
  await toObj(tg, 'sw_living'); await act(tg, '燈'); await waitStep(tg, 9); await sleep(500);
  await toObj(tg, 'floor_living'); await sleep(300); await shot(tg, 'dark_1_glow');
  await act(tg, '記錄螢光位置', { manual: true }); await playLumMouse(tg, 'mg_lum_desktop'); await mgWaitDone(tg); console.log('魯米諾（滑鼠＋鍵盤）分數：', await tg.evaluate(() => __fs.MG.score));
  await waitStep(tg, 10); await sleep(500); await shot(tg, 'dark_2_recorded');
  await toObj(tg, 'w_statue'); await act(tg, '噴灑魯米諾'); await act(tg, '記錄螢光位置'); await act(tg, '採集指紋', { manual: true }); await playPrintsKeys(tg, 'mg_prints_desktop'); await mgWaitDone(tg); console.log('刷指紋分數：', await tg.evaluate(() => __fs.MG.score)); await waitStep(tg, 11);
  await tutVan(tg); await tutAnalyze(tg, 'print'); await waitStep(tg, 12); await sleep(300); await shot(tg, 'tut_9_gear2');
  for (const t of ['thermo', 'swab', 'shoe']) await tg.click(`[data-tool="${t}"]`); await tg.click('#gearOk'); await waitStep(tg, 13); await closeWin(tg);
  await toObj(tg, 'body'); await act(tg, '量測肝溫'); await waitStep(tg, 14);
  await toObj(tg, 'body'); await act(tg, '採集死者血液'); await waitStep(tg, 15);
  await toObj(tg, 'phone'); await act(tg, '裝袋帶走'); await waitStep(tg, 16);
  await toObj(tg, 'mud'); await shot(tg, 'tut_10_shoe'); await act(tg, '採集鞋印'); await waitStep(tg, 17);
  await tutVan(tg); await tutAnalyze(tg, 'blood'); await waitStep(tg, 18); await sleep(300);
  await tg.locator('[data-lab="phone"]').click(); await waitStep(tg, 19); await sleep(300); await closeWin(tg);
  // 分局長走進來 → 泡泡（死亡時間已經量好）→ 走到他旁邊交差
  await tg.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 15000 }); await sleep(3500);
  { const b = await tg.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(tg, b.x + 150, b.y); await sleep(400); await shot(tg, 'tut_11_supervisor_bubble'); }
  await tutChase(tg, () => { const B = __fs.G.st.boss; return B.mode === 'in' ? { x: B.x, y: B.y } : null; }, 20);
  // 菜鳥 ⚠️（玩家自己攔）
  await tg.waitForFunction(() => (__fs.G.st.cops || []).some(c => c.mode === 'in'), null, { timeout: 8000 });
  { const c = await tg.evaluate(() => { const c = __fs.G.st.cops.find(c => c.mode === 'in'); return { x: c.x, y: c.y }; }); await tp(tg, c.x + 130, c.y + 40); await sleep(300); await shot(tg, 'tut_12_rookie_alert'); }
  await tutChase(tg, () => { const c = (__fs.G.st.cops || []).find(c => c.mode === 'in'); return c && { x: c.x, y: c.y }; }, 21);
  await tg.click('#bNote'); await sleep(300); await tg.click('#win [data-tab="cop"]'); await sleep(200); await shot(tg, 'tut_13_note_cops'); await tg.click('#win [data-tab="cmp"]'); await sleep(200); await tg.click('#win [data-tab="man"]'); await waitStep(tg, 22); await shot(tg, 'tut_14_manual'); await closeWin(tg);
  await sleep(500); await shot(tg, 'tut_15_close_hint');
  await tg.click('#bClose'); await waitStep(tg, 23); await sleep(400);
  await deduceAndSubmit(tg, 'tut_16_deduce'); await waitStep(tg, 24); await sleep(500);
  await shot(tg, 'tut_17_done');
  { const f = await tg.evaluate(() => ({ i: __fs.G.tut.i, n: __fs.Tut.steps.length, t: document.querySelector('#tut').textContent })); console.log('教學步數：', f.i + 1, '/', f.n); if (f.n !== TUT_N || f.i !== TUT_N - 1 || !/教學完成/.test(f.t)) errors.push('桌機教學沒走到 🎉 教學完成：' + JSON.stringify(f)); }
  const tres = await tg.evaluate(() => __fs.G.st.result); console.log('教學結果：', tres.rank, tres.total);
  /* ---------- 2. 正式案件（桌機） ---------- */
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  await pg.goto(BASE + '?seed=158'); await sleep(900);
  await pg.fill('#name', '百九'); await pg.selectOption('#diff', 'normal'); await pg.click('#bSolo'); await sleep(700);
  await shot(pg, 'briefing'); await closeWin(pg); await pg.click('#win footer [data-close]').catch(() => { }); await sleep(200);
  await van(pg); for (const t of ['camera', 'luminol', 'prints']) await pg.click(`[data-tool="${t}"]`); await pg.click('#gearOk'); await sleep(300); await closeWin(pg);
  await toObj(pg, 'body'); await sleep(400);
  { const r = await pg.evaluate(() => { const b = document.querySelector('#act').getBoundingClientRect(), keys = [...document.querySelectorAll('#act button[data-key]')].map(x => x.dataset.key + ':' + x.textContent.trim().slice(0, 12)); return { w: Math.round(b.width), h: Math.round(b.height), area: Math.round(b.width * b.height / (innerWidth * innerHeight) * 1000) / 10, keys }; });
    console.log('電腦版互動清單：', JSON.stringify(r)); if (r.area > 9 || !r.keys.some(k => k.startsWith('1:'))) errors.push('電腦版清單太大或沒有數字鍵：' + JSON.stringify(r));
    await pg.screenshot({ path: '/workspace/forensic_v4_keys_desktop.png' }); shots.push('/workspace/forensic_v4_keys_desktop.png'); }
  await act(pg, '近拍傷口', { score: .1 }); await sleep(200); await shot(pg, 'result_card_poor');
  { const q = await pg.evaluate(() => __fs.G.st.found.map(f => f.id + ':' + f.q)); console.log('玩很差：', q.join(' ')); if (!q.some(x => /E_wound_x:poor/.test(x))) errors.push('分數 0.1 沒有變成品質差'); }
  await pg.evaluate(() => document.querySelectorAll('#cards > *').forEach(e => e.remove()));
  await act(pg, '重做：近拍傷口', { score: .95 }); await sleep(200); await shot(pg, 'result_card_good');
  { const q = await pg.evaluate(() => __fs.G.st.found.map(f => f.id + ':' + f.q)); console.log('重做玩好：', q.join(' ')); if (!q.some(x => /^E_wound:good/.test(x)) || q.some(x => /E_wound_x/.test(x))) errors.push('重做沒有換成好的結果'); }
  { const before = await pg.evaluate(() => __fs.G.st.found.length); await act(pg, '檢查屍斑'); const after = await pg.evaluate(() => __fs.G.st.found.length); if (after <= before) errors.push('按數字鍵沒有執行動作'); }
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
  await act(pg, '量測肝溫', { manual: true }); await holdKey(pg, ' ', 900); await sleep(600); await holdKey(pg, ' ', 700); await shot(pg, 'mg_thermo_desktop');
  await pg.evaluate(() => { __fs.MG.finish(.9); }); await mgWaitDone(pg); await sleep(300);
  // v10 回歸：量完肝溫後站到分局長身上（腳底差 95，畫面上已經疊在一起）一定要能交差
  { const okTod = await pg.evaluate(() => __fs.ENG.bossDone(__fs.C, __fs.G.st, __fs.G.st.boss.demand)); if (!okTod) errors.push('量完肝溫，分局長要求卻沒達成');
    for (let i = 0; i < 12; i++) { const b = await pg.evaluate(() => __fs.G.st.boss.mode === 'in' && ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); if (!b) break; await pg.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; const p = G.st.players[G.me]; p.x = x; p.y = y; }, [b.x, b.y + 95]); await sleep(250); }
    const r = await pg.evaluate(() => ({ ok: __fs.G.st.bossOk, mode: __fs.G.st.boss.mode })); console.log('量完肝溫→站到分局長身上：', JSON.stringify(r)); if (r.ok < 1) errors.push('量完肝溫站到分局長身上，還是不能交差'); }
  const bok = await pg.evaluate(() => __fs.G.st.bossOk); console.log('分局長交差次數：', bok);
  await sleep(400); await shot(pg, 'supervisor_satisfied');
  // 單人：兇手想溜走 → 預警 → 按 E 叫員警攔
  await pg.evaluate(() => { const st = __fs.G.st, n = st.npcs.find(x => x.id === __fs.C.culprit); n.mode = 'nervous'; n.fleeAt = st.clock + 12; n.path = []; __fs.refresh(); });
  await sleep(900); await pg.screenshot({ path: '/workspace/forensic_v4_flee_alert.png' }); shots.push('/workspace/forensic_v4_flee_alert.png');
  await pg.keyboard.press('e'); keyLog.push('E=叫員警攔人');
  await pg.waitForFunction(() => __fs.G.st.npcs.find(x => x.id === __fs.C.culprit).mode === 'held', null, { timeout: 30000 }).catch(() => errors.push('員警沒有攔下兇手'));
  console.log('兇手狀態：', await pg.evaluate(() => __fs.G.st.npcs.find(x => x.id === __fs.C.culprit).mode)); await sleep(500);
  await pg.screenshot({ path: '/workspace/forensic_v4_flee_caught.png' }); shots.push('/workspace/forensic_v4_flee_caught.png');
  // 關燈噴魯米諾
  await van(pg); await pg.click('[data-tool="thermo"]').catch(() => { }); await pg.click('[data-tool="prints"]').catch(() => { });
  await pg.evaluate(() => { const p = __fs.G.st.players[0]; }); await pg.click('#gearOk').catch(() => { }); await sleep(300); await closeWin(pg);
  await toObj(pg, 'floor_living'); await act(pg, '噴灑魯米諾');
  await toObj(pg, 'sw_living'); await act(pg, '燈'); await sleep(500);
  await toObj(pg, 'floor_living'); await sleep(300); await shot(pg, 'dark_3_case_glow'); await shot(pg, 'dark_luminol');
  await act(pg, '記錄螢光位置'); await sleep(500);
  await toObj(pg, 'sw_living'); await act(pg, '燈'); await sleep(500); await toObj(pg, 'floor_living'); await sleep(200);
  await shot(pg, 'dark_4_lights_back_marker');
  await pg.evaluate(() => document.querySelectorAll('#cards > *').forEach(e => e.remove()));
  { const o = await pg.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'floor_living'); return { x: o.x + o.w * .3, y: o.y + o.h * .2 }; }); await tp(pg, o.x + 70, o.y - 40); await sleep(500); }
  { const has = await pg.evaluate(() => { const f = __fs.G.st.obj.floor_living.marked; return f; }); if (!has) errors.push('地毯沒有證物標記'); }
  await pg.screenshot({ path: '/workspace/forensic_v4_marker_label.png' }); shots.push('/workspace/forensic_v4_marker_label.png');
  // 送實驗室 → 待處理倒數
  await toObj(pg, 'phone'); await act(pg, '裝袋帶走'); await van(pg); await pg.locator('[data-lab]').first().click(); await sleep(400); await shot(pg, 'van_budget'); await closeWin(pg);
  await sleep(800); await shot(pg, 'hud_pending');
  await pg.evaluate(() => { for (const l of __fs.G.st.labs) if (!l.back) l.due = __fs.G.st.clock + 0.5; }); await sleep(1600);
  await shot(pg, 'lab_result_card');
  // 棉棒（滑鼠拖曳）＋鞋印（滑鼠點）＋車上分析 → 筆記本比對頁
  await van(pg); for (const t of ['camera', 'luminol', 'prints', 'thermo']) await pg.click(`[data-tool="${t}"].on`).catch(() => { }); for (const t of ['swab', 'shoe', 'camera']) await pg.click(`[data-tool="${t}"]:not(.on)`).catch(() => { }); await pg.click('#gearOk'); await sleep(300); await closeWin(pg);
  console.log('換裝備：', await pg.evaluate(() => __fs.G.st.players[0].tools.join(',')));
  await toObj(pg, 'body'); await act(pg, '採集指甲縫皮屑', { manual: true });
  { const d = await mgDbg(pg); const c = await mgPt(pg, ...d.center); await pg.mouse.move(c[0], c[1]); await pg.mouse.down(); let cur = c;
    for (let i = 0; i < 14 && (await pg.evaluate(() => __fs.MG.on)); i++) { const to = await mgPt(pg, d.center[0] + (i % 2 ? 55 : -55), d.center[1] + ((i % 3) - 1) * 25); cur = await slowMouse(pg, cur, to, 4); if (i === 4) await shot(pg, 'mg_swab_desktop'); }
    await pg.mouse.up(); if (await pg.evaluate(() => __fs.MG.on)) await pg.keyboard.press('Enter'); await mgWaitDone(pg); console.log('棉棒（滑鼠）分數：', await pg.evaluate(() => __fs.MG.score)); }
  await toObj(pg, 'mud'); await act(pg, '追蹤並採集鞋印', { manual: true });
  { const d = await mgDbg(pg); for (let i = 0; i < d.trail.length; i++) { const [px, py] = await mgPt(pg, d.trail[i][0], d.trail[i][1]); await pg.mouse.move(px, py, { steps: 6 }); await sleep(250); await pg.mouse.down(); await pg.mouse.up(); await sleep(150); if (i === 4) await shot(pg, 'mg_shoe_desktop'); }
    await mgWaitDone(pg); console.log('鞋印（滑鼠）分數：', await pg.evaluate(() => __fs.MG.score)); }
  await van(pg); for (let i = 0; i < 6; i++) { const b = pg.locator('[data-an]:not([disabled])').first(); if (!(await b.count())) break; await b.click(); await sleep(400); } await closeWin(pg);
  await pg.evaluate(() => { __fs.openNote(); }); await sleep(300); await pg.click('[data-tab="cmp"]'); await sleep(300); await shot(pg, 'notebook_compare');
  { const t = await pg.evaluate(() => document.querySelector('table.cmp') && document.querySelector('table.cmp').innerText); if (!t || !/號/.test(t)) errors.push('筆記本比對頁沒有內容'); }
  await pg.click('[data-tab="man"]'); await sleep(200); await shot(pg, 'notebook_manual_roles'); await closeWin(pg);
  await pg.click('#bClose'); await sleep(800); await deduceAndSubmit(pg, null);
  await shot(pg, 'result');
  const res = await pg.evaluate(() => __fs.G.st.result); console.log('正式案件：', res.rank, res.total, 'time+', res.timeB, 'budget+', res.budB);
  /* ---------- 2a. 觸控筆電（寬螢幕＋觸控）：按一下鍵盤就切到精簡鍵盤清單（教學裡也一樣） ---------- */
  { const tp2 = await page(br, { viewport: { width: 1366, height: 768 }, hasTouch: true });
    await tp2.goto(BASE); await sleep(900); await tp2.fill('#name', '百九');
    await tp2.evaluate(() => document.getElementById('bTut').click()); await sleep(900);
    await tp2.evaluate(() => { document.body.classList.remove('kb'); });
    await tp2.keyboard.press('d'); await sleep(300);
    const kb = await tp2.evaluate(() => document.body.classList.contains('kb') && localStorage.getItem('fs_input'));
    console.log('觸控筆電按鍵後：', kb); if (kb !== 'kb') errors.push('觸控筆電按鍵後沒有切到鍵盤清單');
    await tp(tp2, 640, 718); await waitStep(tp2, 1); await tutSocial(tp2); await tp(tp2, 336, 880); await tp2.keyboard.press('e'); await sleep(400);
    for (const t of ['camera', 'luminol', 'prints']) await tp2.evaluate(t => document.querySelector(`[data-tool="${t}"]`).click(), t);
    await tp2.evaluate(() => document.getElementById('gearOk').click()); await waitStep(tp2, 6); await closeWin(tp2);
    await toObj(tp2, 'body'); await sleep(400);
    const r = await tp2.evaluate(() => { const b = document.querySelector('#act').getBoundingClientRect(); return { kb: document.body.classList.contains('kb'), area: Math.round(b.width * b.height / (innerWidth * innerHeight) * 1000) / 10, key1: !!document.querySelector('#act button[data-key="1"] kbd') }; });
    console.log('觸控筆電・教學清單：', JSON.stringify(r)); if (!r.kb || r.area > 9 || !r.key1) errors.push('觸控筆電教學清單不是精簡鍵盤版：' + JSON.stringify(r));
    await tp2.keyboard.press('1'); await mgWaitOpen(tp2); await mgAuto(tp2, .9); await waitStep(tp2, 7); console.log('觸控筆電按 1 → 近拍傷口完成');
    await tp2.touchscreen.tap(600, 400); await sleep(300);
    const t2 = await tp2.evaluate(() => document.body.classList.contains('kb')); console.log('之後用手指點畫面 → 觸控版：', !t2); if (t2) errors.push('手指觸控後沒有切回觸控版');
    await tp2.context().close(); }
  /* ---------- 2b. 屍體在每個可能的房間都看得到（客廳／書房＝偽裝意外移屍／廚房） ---------- */
  for (const [seed, room] of [[1, '客廳'], [2, '書房（偽裝意外）'], [10, '廚房']]) {
    const bp = await page(br, { viewport: { width: 1280, height: 800 } });
    await bp.goto(BASE + '?seed=' + seed); await sleep(900); await bp.fill('#name', '百九'); await bp.click('#bSolo'); await sleep(700); await bp.click('#win footer [data-close]').catch(() => { }); await sleep(300);
    await checkBody(bp, '正式案件・' + room, seed === 2 ? 'forensic_v3_body_case.png' : `forensic_v3_body_case_seed${seed}.png`);
    if (seed === 1) { const bc = await bp.evaluate(() => { const b = __fs.ENG.objById(__fs.C, 'body'), t = __fs.ENG.objById(__fs.C, 'table'); __fs.G.camAt = { x: b.x, y: b.y - 40 }; return { room: __fs.ENG.roomAt(__fs.C, b.x, b.y), body: [b.x, b.y, b.w, b.h], table: [t.x, t.y, t.w, t.h], gap: Math.round((b.y - b.h / 2) - t.y) }; });
      console.log('客廳屍體位置（新地圖）：', JSON.stringify(bc)); if (bc.room !== 'living' || bc.gap < 0) errors.push('屍體不在客廳地板或疊到茶几：' + JSON.stringify(bc));
      await sleep(600); await shot(bp, 'living_body'); await bp.evaluate(() => { __fs.G.camAt = null; }); }
    await bp.context().close();
  }
  /* ---------- 2c. v10：室內鞋印＋關係人身上的血漬＋關係人視窗 ---------- */
  { const vp = await page(br, { viewport: { width: 1280, height: 800 } });
    await vp.goto(BASE + '?seed=24'); await sleep(900); await vp.fill('#name', '百九'); await vp.click('#bSolo'); await sleep(700); await vp.click('#win footer [data-close]').catch(() => { }); await sleep(300);
    await vp.evaluate(() => { __fs.G.st.quietUntil = 1e9; });
    await van(vp); for (const t of ['swab', 'shoe', 'camera']) await vp.click(`[data-tool="${t}"]:not(.on)`).catch(() => { }); await vp.click('#gearOk'); await sleep(300); await closeWin(vp);
    const mud = await vp.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'mud'); return { room: o.room, name: o.name, ground: o.ground }; }); console.log('鞋印位置：', JSON.stringify(mud)); if (mud.room === 'yard') errors.push('seed 24 的鞋印應該在屋裡');
    await toObj(vp, 'mud'); await act(vp, '追蹤並採集鞋印', { manual: true }); await sleep(300);
    { const d = await mgDbg(vp); const [px, py] = await mgPt(vp, d.trail[0][0], d.trail[0][1]); await vp.mouse.move(px, py, { steps: 5 }); await sleep(300); await shot(vp, 'mg_shoe_indoor'); }
    await mgAuto(vp, .9);
    const sid = await vp.evaluate(() => __fs.C.culprit);
    for (let i = 0; i < 20; i++) { const n = await vp.evaluate(id => { const n = __fs.G.st.npcs.find(q => q.id === id); return { x: n.vx != null ? n.vx : n.x, y: n.vy != null ? n.vy : n.y }; }, sid); await tp(vp, n.x + 30, n.y + 12); if (await vp.evaluate(id => __fs.G.nearId === 'npc:' + id, sid)) break; }
    await sleep(300); await shot(vp, 'suspect_stain_prompt');
    { const cue = await vp.evaluate(() => document.querySelector('#act') && document.querySelector('#act').innerText); console.log('關係人提示：', (cue || '').replace(/\s+/g, ' ')); if (!/疑似血漬/.test(cue || '')) errors.push('靠近有血漬的關係人沒有提示'); }
    await act(vp, '的血漬', { manual: true }); await sleep(500); await shot(vp, 'mg_swab_suspect'); await mgAuto(vp, .9);
    const smp = await vp.evaluate(() => __fs.G.st.players[0].samples.map(x => x.label)); console.log('身上血漬樣本：', smp.join('、')); if (!smp.some(x => /血漬/.test(x))) errors.push('沒有採到關係人身上的血漬');
    await van(vp); for (let i = 0; i < 4; i++) { const b = vp.locator('[data-an]:not([disabled])').first(); if (!(await b.count())) break; await b.click(); await sleep(400); } await closeWin(vp);
    const stE = await vp.evaluate(() => __fs.G.st.found.map(f => __fs.C.evidence[f.id].name).filter(n => /血漬/.test(n))); console.log('血漬分析：', stE.join('、')); if (!stE.length) errors.push('血漬沒有分析結果');
    await vp.evaluate(id => __fs.openNote(), sid); await sleep(300); await vp.click('[data-tab="cmp"]'); await sleep(300); await shot(vp, 'notebook_compare_stain'); await closeWin(vp);
    await vp.evaluate(() => __fs.openPerson && __fs.openPerson('maid')); await sleep(400);
    await vp.screenshot({ path: '/workspace/forensic_v10_suspect_modal.png' }); shots.push('/workspace/forensic_v10_suspect_modal.png');
    { const r = await vp.evaluate(() => { const w = document.querySelector('#win'), b = w.querySelector('.body'), im = w.querySelector('.su img'); return { img: im && [Math.round(im.getBoundingClientRect().width), Math.round(im.getBoundingClientRect().height)], scroll: b ? b.scrollHeight > b.clientHeight + 2 : false, h: Math.round(w.getBoundingClientRect().height) }; });
      console.log('關係人視窗：', JSON.stringify(r)); if (!r.img || r.img[0] > 200 || r.scroll) errors.push('關係人視窗版面不對：' + JSON.stringify(r)); }
    await closeWin(vp); await vp.context().close(); }
  /* ---------- 2d. v11：電腦版右側固定側欄＋左邊乾淨的舞台（座標、點擊、分局長泡泡、現場紀錄） ---------- */
  { const vp = await page(br, { viewport: { width: 1366, height: 800 } });
    await vp.goto(BASE + '?seed=158'); await sleep(900); await vp.fill('#name', '百九'); await vp.click('#bSolo'); await sleep(700); await vp.click('#win footer [data-close]').catch(() => { }); await sleep(300);
    await vp.evaluate(() => { __fs.G.st.quietUntil = 1e9; });
    const L = await vp.evaluate(() => { const r = s => { const e = document.querySelector(s); if (!e || !e.getClientRects().length) return null; const b = e.getBoundingClientRect(); return { l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), w: Math.round(b.width), h: Math.round(b.height) }; };
      const o = { sb: document.body.classList.contains('sb'), hud: r('#hud'), cv: r('#cv'), stage: __fs.stage(), parts: {} }; for (const s of ['.room', '.tl', '.tr', '#bNote', '#bClose', '#bMenu', '#logW', '.bar', '.keyhelp']) o.parts[s] = r(s); return o; });
    console.log('v11 側欄：', JSON.stringify({ sb: L.sb, hud: L.hud, cv: L.cv }));
    if (!L.sb || !L.hud || L.hud.w < 268 || L.hud.w > 342) errors.push('側欄寬度不對：' + JSON.stringify(L.hud));
    if (!L.cv || Math.abs(L.cv.l) > 2 || Math.abs(L.hud.l - L.cv.r) > 2 || Math.abs(L.cv.w - (1366 - L.hud.w)) > 2 || L.hud.l < 1366 / 2) errors.push('畫布沒有貼齊左側舞台／側欄不在右邊：' + JSON.stringify({ cv: L.cv, hud: L.hud }));
    for (const [k, b] of Object.entries(L.parts)) { if (!b) errors.push('側欄少了 ' + k); else if (b.l < L.hud.l - 1 || b.r > L.hud.r + 1 || b.b > 801) errors.push('側欄元件跑出側欄：' + k + JSON.stringify(b)); }
    if (L.parts['#logW'] && L.parts['#logW'].h < 120) errors.push('現場紀錄太矮：' + L.parts['#logW'].h);
    // 現場紀錄：自動捲到最新；往上捲時不跳，出現「↓ 新訊息」
    { const r = await vp.evaluate(async () => { for (let i = 0; i < 40; i++) __fs.log('測試訊息 ' + i); const b = document.querySelector('#log'); const atEnd = b.scrollTop + b.clientHeight >= b.scrollHeight - 2; b.scrollTop = 0; await new Promise(r => setTimeout(r, 60)); __fs.log('往上捲時的新訊息'); const stay = b.scrollTop === 0, pill = !document.querySelector('#logNew').classList.contains('hidden'); document.querySelector('#logNew').click(); const back = b.scrollTop + b.clientHeight >= b.scrollHeight - 2; const time = (b.querySelector('.lg time') || {}).textContent; b.innerHTML = ''; return { atEnd, stay, pill, back, time }; });
      console.log('現場紀錄捲動：', JSON.stringify(r)); if (!r.atEnd || !r.stay || !r.pill || !r.back || !/\d+:\d\d/.test(r.time || '')) errors.push('現場紀錄捲動不對：' + JSON.stringify(r)); }
    // 點擊畫布上的物件（畫布在左側，座標要準）
    await tp(vp, 1300, 640); await sleep(800);
    { const st = await vp.evaluate(() => __fs.stage()); await vp.addStyleTag({ content: '#act{visibility:hidden!important}' });
      const objs = await vp.evaluate(() => { const C = __fs.C, G = __fs.G; return C.objects.filter(o => !o.deco && !o.van && !G.st.obj[o.id].gone && o.id !== 'floor_living').map(o => { const [cx, cy] = __fs.w2c(o.x, o.flat ? o.y : o.y - Math.min(30, (o.h || 40) / 3)); return { id: o.id, cx, cy }; }); });
      let ok = 0, tot = 0; const miss = [];
      for (const o of objs) { if (o.cx < st.OX + 8 || o.cx > st.OX + st.VW - 8 || o.cy < 8 || o.cy > st.VH - 8) continue; tot++;
        await vp.evaluate(() => { const G = __fs.G; G.autoOpen = null; G.path = null; G.nearId = null; }); await vp.mouse.click(o.cx, o.cy); await sleep(60);
        const a = await vp.evaluate(() => __fs.G.autoOpen || __fs.G.nearId); if (a === o.id) ok++; else miss.push(o.id + '→' + a); await tp(vp, 1300, 640); }
      console.log('點擊畫布物件：', ok + '/' + tot, miss.join(' ')); if (tot < 8 || ok < tot) errors.push('點擊畫布物件不準：' + ok + '/' + tot + ' ' + miss.join(' '));
      await vp.evaluate(() => { const s = [...document.querySelectorAll('style')].pop(); if (/visibility:hidden/.test(s.textContent)) s.remove(); }); }
    // 點地板：走到點的位置（世界座標要對）
    await tp(vp, 1480, 760); await vp.evaluate(() => { const G = __fs.G; G.autoOpen = null; G.path = null; }); await sleep(200);   // v19：先離開地毯（站在地毯上時物件小清單會蓋住要點的地板）
    { const [cx, cy] = await vp.evaluate(() => __fs.w2c(1440, 608)); await vp.mouse.click(cx, cy); await sleep(60); const end = await vp.evaluate(() => { const p = __fs.G.path; return p && p.length ? p[p.length - 1] : null; }); console.log('點地板走到：', JSON.stringify(end)); if (!end || Math.hypot(end.x - 1440, end.y - 608) > 30) errors.push('點地板走錯位置：' + JSON.stringify(end)); }
    await tp(vp, 336, 880); await vp.evaluate(() => __fs.doAct({ type: 'gear', tools: ['camera', 'thermo', 'swab'] })); await sleep(300);
    await toObj(vp, 'body'); await act(vp, '量測肝溫', { score: .9 }); await sleep(600);
    // 分局長走進來：泡泡在舞台裡，不會被任何 HUD 蓋住
    await vp.evaluate(() => { const st = __fs.G.st; st.quietUntil = 0; st.forceBoss = { kind: 'progress', pct: 60 }; });
    await vp.waitForFunction(() => __fs.G.st.boss && __fs.G.st.boss.mode === 'in', null, { timeout: 25000 }).catch(() => errors.push('分局長沒有進場'));
    await sleep(2500);
    { const b = await vp.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(vp, b.x + 150, b.y + 70); await sleep(900);
      await vp.evaluate(() => { document.querySelector('#cards').innerHTML = ''; });
      const r = await vp.evaluate(() => { const B = __fs.G.st.boss, st = __fs.stage(); const pts = []; for (const dx of [-110, -60, 0, 60, 110]) for (const dy of [-215, -185, -150, -110, -60, 0]) pts.push(__fs.w2c(B.x + dx, B.y + dy));
        const bad = pts.filter(([x, y]) => x >= st.OX && y >= 0 && x < st.OX + st.VW && y < innerHeight).map(([x, y]) => { const e = document.elementFromPoint(x, y); return e && e.id !== 'cv' && !e.closest('#act') && !e.closest('#tut') ? (e.id || e.className || e.tagName) + '@' + Math.round(x) + ',' + Math.round(y) : null; }).filter(Boolean);
        const [bx] = __fs.w2c(B.x, B.y); return { bad, inStage: bx > st.OX + 60 && bx < st.OX + st.VW - 60 }; });
      console.log('分局長泡泡：', JSON.stringify(r)); if (r.bad.length || !r.inStage) errors.push('分局長泡泡被蓋住或不在舞台內：' + JSON.stringify(r));
      await shot(vp, 'supervisor_clean'); }
    { const n = await vp.evaluate(() => document.querySelectorAll('#log .lg').length); console.log('現場紀錄筆數：', n); if (n < 3) errors.push('現場紀錄沒有記下事件：' + n); }
    await tp(vp, 1000, 720); await sleep(1200); await vp.evaluate(() => { document.querySelector('#cards').innerHTML = ''; }); await shot(vp, 'desktop_sidebar'); await shot(vp, 'desktop_newmap');
    // 側欄模式的小遊戲：在舞台中間，座標照樣準
    await toObj(vp, 'body'); await act(vp, '採集死者血液', { manual: true }); await sleep(400);
    { const r = await vp.evaluate(() => { const m = document.querySelector('.mgw').getBoundingClientRect(), st = __fs.stage(); return { l: Math.round(m.left), r: Math.round(m.right), OX: Math.round(st.OX), VW: Math.round(st.VW) }; }); console.log('側欄模式小遊戲位置：', JSON.stringify(r)); if (r.l < r.OX - 2 || r.r > r.OX + r.VW + 2) errors.push('小遊戲蓋到側欄：' + JSON.stringify(r)); }
    await mgAuto(vp, .9);
    await vp.close(); }

  /* ---------- 3. 連線：燈的開關同步 ---------- */
  const p1 = await page(br, { viewport: { width: 1280, height: 800 } }), p2 = await page(br, { viewport: { width: 1280, height: 800 } });
  await p1.goto(BASE); await sleep(800); await p1.fill('#name', '百九'); await p1.click('#bCreate');
  await p1.waitForFunction(() => /\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 8000 });
  const code = await p1.textContent('#rmCode');
  await p2.goto(BASE + '?room=' + code); await sleep(800); await p2.fill('#name', 'Cynthia'); await p2.click('#bJoin'); await sleep(1200);
  await shot(p1, 'room');
  await p1.click('#rmStart'); await sleep(1500);
  for (const p of [p1, p2]) await p.click('#win footer [data-close]').catch(() => { });
  { const o = await p2.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'body'); return { x: o.x, y: o.y }; }); await p2.evaluate(() => { __fs.G.Me.x = 400; __fs.G.Me.y = 700; }); await sleep(300); }
  { // 連線時鏡頭跟著自己，直接看屍體那一塊：先把鏡頭（本機畫面）移過去檢查像素
    const r = await p1.evaluate(async () => { const o = __fs.ENG.objById(__fs.C, 'body'); const G = __fs.G; G.camAt = { x: o.x, y: o.y + 60 }; await new Promise(r => setTimeout(r, 900)); let res = await __fs.bodyCheck(); if (!(res.ratio > 0.3)) { await new Promise(r => setTimeout(r, 500)); res = await __fs.bodyCheck(); } return res; });
    await p1.screenshot({ path: '/workspace/forensic_v3_body_online.png' }); shots.push('/workspace/forensic_v3_body_online.png'); await p1.evaluate(() => { __fs.G.camAt = null; });
    console.log('屍體檢查［連線］：', JSON.stringify(r)); if (!(r.drawnOnTop && r.onScreen && r.ratio > 0.18)) errors.push('連線時屍體沒有畫出來：' + JSON.stringify(r));
    await sleep(800);
  }
  for (const [x, y] of [[420, 860], [453, 827], [487, 793], [520, 760], [547, 747], [573, 733], [600, 720], [627, 713], [653, 707], [680, 700], [707, 693], [733, 687], [760, 680], [787, 673], [813, 667], [840, 660], [860, 657], [880, 653], [900, 650], [913, 640], [927, 630], [940, 620], [943, 600], [947, 580], [950, 560]]) { await p2.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; }, [x, y]); await sleep(170); }
  for (const [x, y] of [[420, 880], [453, 847], [487, 813], [520, 780], [547, 763], [573, 747], [600, 730], [627, 727], [653, 723], [680, 720], [707, 713], [733, 707], [760, 700]]) { await p1.evaluate(([x, y]) => { const G = __fs.G; G.Me.x = x; G.Me.y = y; G.path = null; }, [x, y]); await sleep(170); }
  await sleep(400); await p2.evaluate(() => __fs.doAct({ type: 'light', obj: 'sw_living' })); await sleep(900);
  const lit = await p1.evaluate(() => __fs.G.st.lights.living); console.log('Cynthia 關燈後，百九看到客廳的燈：', lit ? '亮' : '暗');
  if (lit !== false) errors.push('燈的狀態沒有同步');
  await shot(p1, 'dark_5_online_teammate_switch');
  // 連線：隊友在做小遊戲 → 其他人看到「🔬 分析中」
  await walkTo(p2, 336, 880); await p2.evaluate(() => __fs.doAct({ type: 'gear', tools: ['camera', 'luminol', 'prints'] })); await sleep(500);
  console.log('Cynthia 裝備：', await p2.evaluate(() => __fs.G.st.players[__fs.G.me].tools.join(',')));
  await walkToObj(p2, 'body'); await act(p2, '近拍傷口', { manual: true });
  { const o = await p1.evaluate(() => { const o = __fs.ENG.objById(__fs.C, 'body'); return { x: o.x, y: o.y }; }); await walkTo(p1, o.x + 150, o.y + 80, 60); }
  { const busy = await p1.evaluate(() => { const q = Object.values(__fs.G.st.players).find(p => p.pid !== __fs.G.me && p.mg); return q && q.mg.kind; }); console.log('百九看到 Cynthia 在做：', busy); if (busy !== 'photo') errors.push('連線時看不到隊友在分析'); }
  await shot(p1, 'online_teammate_analysing'); await shot(p2, 'online_mg_photo');
  await p2.evaluate(() => __fs.mgFinish(.9)); await p2.waitForFunction(() => __fs.G.st.found.some(f => f.id === 'E_wound'), null, { timeout: 15000 }).catch(() => errors.push('連線小遊戲沒有回傳結果'));
  console.log('連線小遊戲結果：', await p2.evaluate(() => (__fs.G.st.found.find(f => f.id === 'E_wound') || {}).q));
  /* ---------- 4. iPhone 13（WebKit） ---------- */
  await br.close();
  const wk = await webkit.launch();
  const ip = await page(wk, devices['iPhone 13']);
  await ip.goto(BASE); await sleep(1200); await ip.fill('#name', '百九');
  await shot(ip, 'iphone_lobby');
  await ip.tap('#bTut'); await sleep(900); await shot(ip, 'iphone_tutorial');
  await tp(ip, 640, 718); await waitStep(ip, 1); await tutSocial(ip); await tp(ip, 336, 880); await sleep(300); await ip.tap('#act [data-van]'); await sleep(400);
  for (const t of ['camera', 'luminol', 'prints']) await ip.tap(`[data-tool="${t}"]`); await ip.tap('#gearOk'); await waitStep(ip, 6); await closeWin(ip);
  await checkBody(ip, '教學・iPhone', 'forensic_v3_iphone_body.png');
  await toObj(ip, 'body'); await sleep(400);
  { const r = await ip.evaluate(() => { const b = document.querySelector('#act').getBoundingClientRect(); return { h: Math.round(b.height), area: Math.round(b.width * b.height / (innerWidth * innerHeight) * 1000) / 10, kb: document.body.classList.contains('kb') }; });
    console.log('iPhone 互動列：', JSON.stringify(r)); if (r.kb || r.area > 14) errors.push('iPhone 互動列太大：' + JSON.stringify(r)); }
  await ip.screenshot({ path: '/workspace/forensic_v4_iphone.png' }); shots.push('/workspace/forensic_v4_iphone.png');
  await toObj(ip, 'body'); await act(ip, '近拍傷口', { manual: true }); await playPhotoTouch(ip, 'iphone_mg_photo'); await mgWaitDone(ip); console.log('拍照（iPhone 觸控）分數：', await ip.evaluate(() => __fs.MG.score));
  await sleep(300); await shot(ip, 'iphone_result_card');
  await toObj(ip, 'floor_living'); await act(ip, '噴灑魯米諾'); await toObj(ip, 'sw_living'); await act(ip, '燈'); await sleep(500); await toObj(ip, 'floor_living'); await sleep(300);
  await shot(ip, 'dark_6_iphone');
  await act(ip, '記錄螢光位置', { manual: true });
  { const d = await mgDbg(ip); let cur = await mgPt(ip, 320, 220); const pts = [cur];
    for (const [x, y] of d.specks) { const to = await mgPt(ip, x, y); pts.push(...line(cur, to, 2.5).slice(1)); for (let k = 0; k < 40; k++) pts.push(to); cur = to; }
    await touchDrag(ip, pts, 20); let k = 0;
    for (const [x, y] of (await mgDbg(ip)).specks) { const [px, py] = await mgPt(ip, x, y); await ip.touchscreen.tap(px, py); await sleep(250); if (++k === 3) await shot(ip, 'iphone_mg_lum'); }
    const d2 = await mgDbg(ip); console.log('魯米諾（iPhone 觸控）：', JSON.stringify({ marked: d2.specks.filter(s => s[3]).length, of: d2.specks.length, cov: +d2.cov.toFixed(2) }));
    await ip.tap('#mgF [data-id="done"]'); await mgWaitDone(ip); console.log('魯米諾（iPhone）分數：', await ip.evaluate(() => __fs.MG.score)); }
  await ip.evaluate(() => { __fs.Tut.stop(); }); 
  const ip2 = await page(wk, devices['iPhone 13']);
  await ip2.goto(BASE + '?seed=158'); await sleep(1200); await ip2.fill('#name', '百九'); await ip2.tap('#bSolo'); await sleep(700); await ip2.tap('#win footer [data-close]').catch(() => { }); await sleep(300);
  await ip2.evaluate(() => { const st = __fs.G.st; st.quietUntil = 0; st.forceBoss = { kind: 'progress', pct: 30 }; });
  await ip2.waitForFunction(() => __fs.G.st.boss.mode === 'in', null, { timeout: 25000 }); await sleep(3500);
  { const b = await ip2.evaluate(() => ({ x: __fs.G.st.boss.x, y: __fs.G.st.boss.y })); await tp(ip2, b.x + 120, b.y + 40); await sleep(500); }
  await shot(ip2, 'iphone_supervisor_hud');
  { const r = await ip2.evaluate(() => { const c = document.querySelector('#cv').getBoundingClientRect(); return { sb: document.body.classList.contains('sb'), l: c.left, w: Math.round(c.width), iw: innerWidth, log: !!document.querySelector('#logW').offsetParent }; }); console.log('iPhone 版面：', JSON.stringify(r)); if (r.sb || r.l !== 0 || r.w !== r.iw || r.log) errors.push('iPhone 不該有側欄：' + JSON.stringify(r)); }
  await shot(ip2, 'iphone');
  await ip2.evaluate(() => __fs.openPerson(__fs.C.suspects[0].id)); await sleep(400); await shot(ip2, 'iphone_suspect_modal');
  { const r = await ip2.evaluate(() => { const im = document.querySelector('#win .su img'); return im && Math.round(im.getBoundingClientRect().height); }); console.log('iPhone 關係人照片高度：', r); if (!r || r > 150) errors.push('iPhone 關係人照片太大：' + r); }
  await closeWin(ip2);
  // iPhone：肝溫小遊戲（按住按鈕＝真的觸控按住）
  await tp(ip2, 336, 880); await ip2.evaluate(() => __fs.doAct({ type: 'gear', tools: ['camera', 'thermo', 'swab'] })); await sleep(300);
  await toObj(ip2, 'body'); await act(ip2, '量測肝溫', { manual: true });
  { const b = await ip2.locator('#mgF [data-id="hold"]').boundingBox(); await ip2.evaluate(() => { const b = document.querySelector('#mgF [data-id="hold"]'); b.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 9, pointerType: 'touch', bubbles: true })); }); await sleep(1200);
    await shot(ip2, 'iphone_mg_thermo'); await ip2.evaluate(() => { const b = document.querySelector('#mgF [data-id="hold"]'); b.dispatchEvent(new PointerEvent('pointerup', { pointerId: 9, pointerType: 'touch', bubbles: true })); }); }
  await ip2.evaluate(() => __fs.mgFinish(.85)); await mgWaitDone(ip2);
  await act(ip2, '採集死者血液', { manual: true }); await sleep(500); await shot(ip2, 'iphone_mg_swab'); await ip2.evaluate(() => __fs.mgFinish(.8)); await mgWaitDone(ip2); await sleep(300); await shot(ip2, 'iphone_sample_card');
  await wk.close();
  console.log('鍵盤操作：', [...new Set(keyLog)].join('  '));
  console.log('小遊戲：', mgLog.length, '次 —', [...new Set(mgLog)].join('、'));
  console.log('截圖：\n' + shots.join('\n'));
  console.log('頁面錯誤：', errors.length ? errors : '無');
  process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); console.log('截圖：\n' + shots.join('\n')); process.exit(1); });
