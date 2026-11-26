// 鑑識小遊戲（v9）：拍照、魯米諾、刷指紋、肝溫、鞋印、棉棒。
// 滑鼠／鍵盤／iPhone 觸控都能玩；分數 0–1 交給伺服器，伺服器決定樣本品質。
(function (root) {
'use strict';
const W = 640, H = 440;
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);
const dist = (a, b, x, y) => Math.hypot(a - x, b - y);
const MG = { on: false, W, H };
let box, cv, g, foot, titleEl, helpEl, timeEl, msgEl, game, opt, raf = 0, last = 0, ended = false, F = 1;
const inp = { x: W / 2, y: H / 2, px: W / 2, py: H / 2, down: false, on: false, speed: 0, d: 0, kb: false, ptype: 'mouse', sx: 0, sy: 0, st: 0 };
const keys = {};
const img = n => (opt && opt.img && opt.img(n)) || null;
const NAMES = { photo: '📷 拍照採證', lum: '🔦 魯米諾記錄', prints: '🖌️ 刷取指紋', thermo: '🌡️ 量肝溫', shoe: '👣 追蹤鞋印', swab: '🧪 棉棒採樣' };
MG.NAMES = NAMES;

function setup() {
  if (box) return;
  box = document.getElementById('mg'); cv = document.getElementById('mgC'); g = cv.getContext('2d'); cv.width = W; cv.height = H;
  foot = document.getElementById('mgF'); titleEl = document.getElementById('mgT'); helpEl = document.getElementById('mgHelp'); timeEl = document.getElementById('mgTime'); msgEl = document.getElementById('mgMsg');
  const pos = e => { const r = cv.getBoundingClientRect(); return [clamp((e.clientX - r.left) / r.width * W, 0, W), clamp((e.clientY - r.top) / r.height * H, 0, H)]; };
  cv.addEventListener('pointerdown', e => { if (!game || ended) return; e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) {} inp.ptype = e.pointerType || 'mouse'; inp.kb = false; [inp.x, inp.y] = pos(e); inp.px = inp.x; inp.py = inp.y; inp.sx = inp.x; inp.sy = inp.y; inp.st = performance.now(); inp.down = true; inp.on = true; if (game.press) game.press(); });
  cv.addEventListener('pointermove', e => { if (!game || ended) return; inp.ptype = e.pointerType || 'mouse'; if (inp.ptype !== 'mouse' && !inp.down) return; inp.kb = false; [inp.x, inp.y] = pos(e); inp.on = true; });
  const up = e => { if (!game || !inp.down) return; inp.down = false; const tap = dist(inp.x, inp.y, inp.sx, inp.sy) < 14 && performance.now() - inp.st < 450; if (game.release) game.release(); if (tap && game.tap) game.tap(inp.ptype); };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('pointerleave', () => { if (inp.ptype === 'mouse' && !inp.down) inp.on = false; });
  document.getElementById('mgX').onclick = () => MG.cancel();
}
function btns(list) {
  foot.innerHTML = ''; (list || []).forEach((b, i) => {
    const el = document.createElement('button'); el.className = 'mgb' + (b.hold ? ' hold' : '') + (b.main ? ' main' : ''); el.innerHTML = b.label + (b.k ? `<span class="kbonly"> [${b.k}]</span>` : ''); el.dataset.i = i; if (b.id) el.dataset.id = b.id;
    if (b.hold) {
      const on = e => { e.preventDefault(); inp.down = true; el.classList.add('on'); }, off = () => { inp.down = false; el.classList.remove('on'); };
      el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('pointerleave', off);
    } else el.onclick = e => { e.preventDefault(); if (!ended) b.fn(); };
    foot.appendChild(el);
  });
  game.btnList = list || [];
}
function say(t, bad) { if (!msgEl) return; msgEl.textContent = t || ''; msgEl.className = bad ? 'bad' : ''; }

// ── 共用畫圖 ──
function dark(alpha) { g.fillStyle = `rgba(4,6,10,${alpha})`; g.fillRect(0, 0, W, H); }
function bg(name, a = 1) { const im = img(name); g.globalAlpha = a; if (im) g.drawImage(im, 0, 0, W, H); else { g.fillStyle = '#181c24'; g.fillRect(0, 0, W, H); } g.globalAlpha = 1; }
function hole(x, y, r, outA) { const gr = g.createRadialGradient(x, y, r * .55, x, y, r); gr.addColorStop(0, 'rgba(4,6,10,0)'); gr.addColorStop(1, `rgba(4,6,10,${outA})`); g.save(); g.fillStyle = gr; g.beginPath(); g.rect(0, 0, W, H); g.arc(x, y, r, 0, Math.PI * 2, true); g.fill('evenodd'); g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.restore(); }
function bar(x, y, w, v, col, label) { g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(x, y, w, 8); g.fillStyle = col; g.fillRect(x, y, w * clamp(v), 8); if (label) { g.fillStyle = '#cfd6e0'; g.font = '13px sans-serif'; g.textAlign = 'left'; g.fillText(label, x, y - 5); } }
function cursor(r, col) { g.strokeStyle = col || 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.beginPath(); g.arc(inp.x, inp.y, r, 0, Math.PI * 2); g.stroke(); }
function label(t, x, y, col, size) { g.font = `${size || 14}px sans-serif`; g.textAlign = 'center'; g.lineWidth = 4; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(t, x, y); g.fillStyle = col || '#fff'; g.fillText(t, x, y); }

// ── 1. 拍照：找出重點、停穩對焦、按快門 ──
const SPOTS = {
  wound: [[140, 192, '頭部傷口', 'w'], [178, 238, '傷口邊緣（角度）', 'w'], [104, 262, '地上的血滴', 'd']],
  livid: [[300, 272, '背側屍斑', 'l'], [486, 244, '腿部屍斑', 'l'], [318, 332, '手臂下側', 'l']],
  hands: [[345, 86, '右手掌心', 'h'], [335, 352, '左手掌心', 'h'], [298, 124, '右前臂內側', 'h']]
};
function photo(o) {
  const T = (SPOTS[o.act] || SPOTS.wound).map(([x, y, l, t]) => ({ x: x + rnd(-7, 7), y: y + rnd(-7, 7), l, t, got: false }));
  let film = 6, focus = 0, flash = 0, miss = 0, endIn = 0;
  // 重點痕跡：取景框裡全亮（有濕亮反光、淺色邊），框外較暗，保留「自己找」的感覺
  const drop = (x, y, r, rim, body, hi) => { g.fillStyle = body; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.strokeStyle = rim; g.lineWidth = 1.6; g.stroke(); g.fillStyle = hi; g.beginPath(); g.ellipse(x - r * .35, y - r * .4, r * .32, r * .2, -.6, 0, 7); g.fill(); };
  const mark = (s, a) => { g.save(); g.globalAlpha = a;
    if (s.t === 'w') { g.fillStyle = 'rgba(150,25,25,.55)'; g.beginPath(); g.ellipse(s.x + 4, s.y + 3, 15, 8, .6, 0, 7); g.fill();
      g.fillStyle = '#7a0f12'; g.beginPath(); g.ellipse(s.x, s.y, 11, 6, .6, 0, 7); g.fill(); g.strokeStyle = '#d0453f'; g.lineWidth = 2; g.stroke();
      g.strokeStyle = '#3a0406'; g.lineWidth = 2; g.beginPath(); g.moveTo(s.x - 6, s.y - 4); g.lineTo(s.x + 6, s.y + 4); g.stroke();
      g.fillStyle = 'rgba(255,215,210,.75)'; g.beginPath(); g.ellipse(s.x - 4, s.y - 3, 3, 1.4, .6, 0, 7); g.fill();
      g.strokeStyle = '#a3201f'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(s.x + 8, s.y + 5); g.quadraticCurveTo(s.x + 12, s.y + 12, s.x + 10, s.y + 18); g.stroke(); }
    else if (s.t === 'd') { g.fillStyle = 'rgba(160,30,30,.35)'; g.beginPath(); g.ellipse(s.x, s.y + 2, 20, 9, .2, 0, 7); g.fill();
      [[-13, -2, 5.5], [-3, 5, 4.6], [6, -3, 5], [14, 4, 3.8], [21, -1, 2.8]].forEach(([dx, dy, r]) => drop(s.x + dx, s.y + dy, r, '#e0574f', '#9a1a1c', 'rgba(255,225,220,.85)')); }
    else if (s.t === 'l') { const gr = g.createRadialGradient(s.x, s.y, 2, s.x, s.y, 18); gr.addColorStop(0, 'rgba(185,110,225,.95)'); gr.addColorStop(.7, 'rgba(140,75,190,.8)'); gr.addColorStop(1, 'rgba(120,60,170,0)');
      g.fillStyle = gr; g.beginPath(); g.ellipse(s.x, s.y, 19, 9, 0, 0, 7); g.fill(); g.fillStyle = 'rgba(215,160,245,.8)'; g.beginPath(); g.ellipse(s.x - 5, s.y - 1, 6, 2.5, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(s.x + 7, s.y + 2, 4, 2, 0, 0, 7); g.fill(); }
    else { [[-6, -3, 3.4], [0, 3, 3], [6, -2, 3.6], [2, -6, 2.2]].forEach(([dx, dy, r]) => drop(s.x + dx, s.y + dy, r, '#ffc08a', '#e2552e', 'rgba(255,240,220,.8)')); }
    g.restore(); };
  const scene = (a, m) => { bg('mg_body_closeup', a); T.forEach(s => mark(s, m == null ? a * .75 : m)); };
  const shoot = () => {
    if (film <= 0 || endIn) return; film--; flash = .22; if (opt.snd) opt.snd('shutter');
    const tg = T.filter(s => !s.got).sort((a, b) => dist(a.x, a.y, inp.x, inp.y) - dist(b.x, b.y, inp.x, inp.y))[0];
    if (focus >= .6 && tg && dist(tg.x, tg.y, inp.x, inp.y) < 36) { tg.got = true; say('拍到了：' + tg.l); }
    else { miss++; say(focus < .6 ? '失焦了，這張是糊的' : '這張沒拍到重點', true); }
    if (T.every(s => s.got) || film <= 0) endIn = .7;
  };
  return {
    limit: 45, tap: p => { if (p === 'mouse') shoot(); }, action: shoot,
    help: k => k === 'touch' ? '拖曳取景框找出重點 → 停穩等框變綠 → 按「📸 拍照」' : '移動取景框（滑鼠或方向鍵），停穩等框變綠，點一下或按空白鍵拍照',
    btns: () => [{ label: '📸 拍照', k: '空白', fn: shoot, main: true }, { label: '完成', k: 'Enter', fn: () => { endIn = .01; } }],
    step(dt) { focus = inp.speed < 55 ? Math.min(1, focus + dt / (.8 * F)) : Math.max(0, focus - dt * 4); flash -= dt; if (endIn && (endIn -= dt) <= 0) game.done = true; },
    draw() {
      scene(.42, .38); dark(.25);
      const r = 66, z = 1.9; g.save(); g.beginPath(); g.arc(inp.x, inp.y, r, 0, 7); g.clip(); g.translate(inp.x, inp.y); g.scale(z, z); g.translate(-inp.x, -inp.y); scene(1, 1);
      if (focus < .6) { g.fillStyle = `rgba(20,24,30,${.5 - focus * .6})`; g.fillRect(0, 0, W, H); } g.restore();
      const ok = focus >= .6, col = ok ? '#7dff9a' : '#f2d045', o = 8 + (1 - focus) * 18;
      g.strokeStyle = col; g.lineWidth = 3; g.beginPath(); g.arc(inp.x, inp.y, r, 0, 7); g.stroke();
      for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const cx = inp.x + sx * (r - 10 + o), cy = inp.y + sy * (r - 10 + o); g.beginPath(); g.moveTo(cx, cy - sy * 14); g.lineTo(cx, cy); g.lineTo(cx - sx * 14, cy); g.stroke(); }
      T.filter(s => s.got).forEach((s, i) => label('📷' + (i + 1), s.x, s.y - 12, '#7dff9a', 13));
      if (flash > 0) { g.fillStyle = `rgba(255,255,255,${flash * 3})`; g.fillRect(0, 0, W, H); }
      label(`底片 ${film}　已拍到 ${T.filter(s => s.got).length}/${T.length} 個重點`, W / 2, H - 14, '#e8ecf2', 15);
    },
    score: () => T.filter(s => s.got).length / T.length - .04 * miss,
    dbg: () => ({ targets: T.filter(s => !s.got).map(s => [s.x, s.y, s.t]), focus, film })
  };
}

// ── 2. 魯米諾：關燈慢慢掃，螢光慢慢浮現，點一下標記 ──
function lum(o) {
  const n = o.specks || 0, CW = 40, cols = W / CW, rows = Math.ceil(H / CW), cov = new Uint8Array(cols * rows);
  const S = []; for (let i = 0; i < n; i++) { let x, y, k = 0; do { x = rnd(50, W - 50); y = rnd(50, H - 60); k++; } while (k < 40 && S.some(s => dist(s.x, s.y, x, y) < 80)); S.push({ x, y, r: rnd(9, 18), glow: 0, mk: false }); }
  let fast = 0, wrong = 0; const R = 64;
  const mark = () => {
    const s = S.filter(s => !s.mk && s.glow > .45).sort((a, b) => dist(a.x, a.y, inp.x, inp.y) - dist(b.x, b.y, inp.x, inp.y))[0];
    if (s && dist(s.x, s.y, inp.x, inp.y) < 34) { s.mk = true; say(`標記 #${S.filter(s => s.mk).length}`); if (opt.snd) opt.snd('pick'); } else { wrong++; say('這裡沒有螢光', true); }
  };
  return {
    limit: 50, tap: mark, action: mark,
    help: k => k === 'touch' ? '手指慢慢拖動紫外燈掃過地面；藍色光點浮現後點一下標記；掃完按「完成記錄」' : '慢慢移動紫外燈（滑鼠或方向鍵）掃過地面，藍光浮現後點一下或按空白鍵標記，掃完按 Enter',
    btns: () => [{ label: '📍 標記', k: '空白', fn: mark }, { label: '✅ 完成記錄', k: 'Enter', fn: () => { game.done = true; }, main: true, id: 'done' }],
    step(dt) {
      if (!inp.on) return;
      if (inp.speed > 230) { fast = .8; return; } fast -= dt;
      const c0 = Math.max(0, Math.floor((inp.x - R) / CW)), c1 = Math.min(cols - 1, Math.floor((inp.x + R) / CW)), r0 = Math.max(0, Math.floor((inp.y - R) / CW)), r1 = Math.min(rows - 1, Math.floor((inp.y + R) / CW));
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) if (dist(c * CW + CW / 2, r * CW + CW / 2, inp.x, inp.y) < R) cov[r * cols + c] = 1;
      S.forEach(s => { if (dist(s.x, s.y, inp.x, inp.y) < R) s.glow = Math.min(1, s.glow + dt / (1.5 * F)); });
    },
    draw() {
      g.fillStyle = '#020306'; g.fillRect(0, 0, W, H);
      if (inp.on) { g.save(); g.beginPath(); g.arc(inp.x, inp.y, R, 0, 7); g.clip(); bg('mg_floor_dark', .55); g.restore(); const gr = g.createRadialGradient(inp.x, inp.y, 4, inp.x, inp.y, R); gr.addColorStop(0, 'rgba(150,90,255,.28)'); gr.addColorStop(1, 'rgba(120,60,255,0)'); g.fillStyle = gr; g.beginPath(); g.arc(inp.x, inp.y, R, 0, 7); g.fill(); }
      g.save(); g.shadowColor = '#4fd2ff'; S.forEach(s => { if (s.glow <= 0) return; g.shadowBlur = 18 * s.glow; g.fillStyle = `rgba(90,215,255,${.85 * s.glow})`; g.beginPath(); g.ellipse(s.x, s.y, s.r, s.r * .7, 0, 0, 7); g.fill(); }); g.restore();
      S.filter(s => s.mk).forEach((s, i) => { g.fillStyle = '#f2d045'; g.beginPath(); g.moveTo(s.x + 14, s.y - 26); g.lineTo(s.x + 24, s.y - 8); g.lineTo(s.x + 4, s.y - 8); g.fill(); label(String(i + 1), s.x + 14, s.y - 11, '#111', 11); });
      if (inp.on) cursor(R, fast > 0 ? 'rgba(255,120,120,.8)' : 'rgba(180,150,255,.6)');
      const cv2 = cov.reduce((a, b) => a + b, 0) / cov.length;
      label(`已掃過 ${Math.round(cv2 * 100)}%　標記 ${S.filter(s => s.mk).length} 處`, W / 2, H - 14, '#cfd6e0', 15);
      if (fast > 0) label('太快了，慢一點……', W / 2, 30, '#ff9a9a', 18);
    },
    score() { const c = cov.reduce((a, b) => a + b, 0) / cov.length; return (n ? .35 * clamp(c / .8) + .65 * S.filter(s => s.mk).length / n : clamp(c / .75)) - .03 * wrong; },
    dbg: () => ({ specks: S.map(s => [s.x, s.y, s.glow, s.mk]), cov: cov.reduce((a, b) => a + b, 0) / cov.length })
  };
}

// ── 3. 刷指紋：按住拖曳刷粉，紋路出現就停，刷太多會糊 ──
function prints(o) {
  const CS = 8, cols = W / CS, rows = H / CS, pw = new Float32Array(cols * rows), inP = new Uint8Array(cols * rows), rid = new Uint8Array(cols * rows);
  const cx = rnd(230, 410), cy = rnd(150, 280), rx = 64, ry = 86, rot = rnd(-.5, .5), cr = Math.cos(rot), sr = Math.sin(rot); let total = 0;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) { const x = c * CS + 4 - cx, y = r * CS + 4 - cy, u = (x * cr + y * sr) / rx, v = (-x * sr + y * cr) / ry, d = Math.hypot(u, v); if (d < 1) { inP[r * cols + c] = 1; total++; if (Math.sin(Math.hypot(u, v * 1.15 - .2) * 30 + Math.atan2(v, u) * .6) > .1) rid[r * cols + c] = 1; } }
  let over = 0; const BR = 30;
  return {
    limit: 45, hold: true,
    help: k => k === 'touch' ? '手指按住拖曳來刷粉；看到指紋紋路就停手，刷太多會糊掉；好了按「貼膠帶轉印」' : '按住滑鼠拖曳（或按住空白鍵＋方向鍵）刷粉；紋路清楚就停，刷太多會糊掉；好了按 Enter 轉印',
    btns: () => [{ label: '🩹 貼膠帶轉印', k: 'Enter', fn: () => { game.done = true; }, main: true, id: 'done' }],
    step(dt) {
      over -= dt; if (!inp.down || !inp.on) return;
      const amt = Math.min(inp.d, 30) * .009 + dt * .22;
      const c0 = Math.max(0, Math.floor((inp.x - BR) / CS)), c1 = Math.min(cols - 1, Math.floor((inp.x + BR) / CS)), r0 = Math.max(0, Math.floor((inp.y - BR) / CS)), r1 = Math.min(rows - 1, Math.floor((inp.y + BR) / CS));
      for (let c = c0; c <= c1; c++) for (let r = r0; r <= r1; r++) { const d = dist(c * CS + 4, r * CS + 4, inp.x, inp.y); if (d < BR) { const i = r * cols + c; pw[i] += amt * (1 - d / BR * .6); if (inP[i] && pw[i] > 1.25) over = .6; } }
    },
    draw() {
      bg('mg_print_surface', .9);
      for (let i = 0; i < pw.length; i++) { const p = pw[i]; if (p < .03) continue; const x = (i % cols) * CS, y = Math.floor(i / cols) * CS;
        if (inP[i] && p > 1.25) g.fillStyle = `rgba(150,145,135,${Math.min(.85, .5 + (p - 1.25))})`;
        else if (inP[i] && rid[i] && p >= .35) g.fillStyle = 'rgba(240,235,220,.92)';
        else g.fillStyle = `rgba(200,192,176,${Math.min(.5, .1 + p * .4)})`;
        g.fillRect(x, y, CS, CS); }
      cursor(BR, inp.down ? 'rgba(242,208,69,.9)' : 'rgba(255,255,255,.55)');
      if (over > 0) label('刷太多了，紋路糊掉了', W / 2, 30, '#ff9a9a', 18);
      label('慢慢刷：紋路浮現就換地方', W / 2, H - 14, '#cfd6e0', 14);
    },
    stats() { let rev = 0, sm = 0; for (let i = 0; i < pw.length; i++) if (inP[i]) { if (pw[i] > 1.25) sm++; else if (pw[i] >= .35) rev++; } return { rev: rev / total, sm: sm / total }; },
    score() { const s = this.stats(); return clamp((s.rev - 1.3 * s.sm) / .7); },
    dbg() { return Object.assign({ center: [cx, cy], r: [rx, ry] }, this.stats()); }
  };
}

// ── 4. 肝溫：按住讓讀數待在綠色區間；再依現場暖氣／窗戶修正 ──
function thermo(o) {
  const room = o.room || {}; let ph = 1, m = .5, c = .55, nz = 0, inB = 0, el = 0, pick = -1, temp = 31 + Math.random() * 3; const need = 14 * F, BW = .18;
  const ans = room.heater && !room.window ? 0 : room.window && !room.heater ? 1 : 2;
  const choose = i => { if (ph !== 2) return; pick = i; game.done = true; };
  const g2 = () => { ph = 2; btns([0, 1, 2].map(i => ({ label: ['⏪ 死亡時間往前推', '⏩ 死亡時間往後推', '不用修正'][i], k: String(i + 1), fn: () => choose(i), id: 'c' + i }))); helpEl.textContent = '現場溫度會影響屍體降溫速度：暖氣讓它降得慢、開窗（冷風）讓它降得快。要怎麼修正？'; };
  const self = {
    limit: 40, hold: true, choose,
    help: k => k === 'touch' ? '按住「推進探針」讓讀數往上，放開會往下；讓指針待在綠色區間直到量完' : '按住空白鍵（或滑鼠／「推進探針」）讓指針往上，放開往下；保持在綠色區間直到量完',
    btns: () => [{ label: '按住：推進探針', k: '空白', hold: true, main: true, id: 'hold' }],
    step(dt) {
      if (ph !== 1) return; el += dt; c = .55 + .16 * Math.sin(el * .55) + .05 * Math.sin(el * 1.7);
      nz += (rnd(-1, 1) * 2.2 - nz * .9) * dt; m = clamp(m + ((inp.down ? .36 : -.32) + nz * .22) * dt);
      if (Math.abs(m - c) < BW / 2) inB += dt;
      if (el >= need) g2();
    },
    draw() {
      g.fillStyle = '#0b0e14'; g.fillRect(0, 0, W, H); bg('mg_body_closeup', .18);
      const th = img('mg_thermo'); if (th) g.drawImage(th, 200, 70 + (ph === 1 ? (1 - m) * 20 : 0), 80, 300);
      const gx = 420, gy = 50, gh = 300; g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(gx, gy, 46, gh);
      g.fillStyle = 'rgba(90,220,120,.35)'; g.fillRect(gx, gy + (1 - c - BW / 2) * gh, 46, BW * gh);
      g.fillStyle = Math.abs(m - c) < BW / 2 ? '#7dff9a' : '#ffb35a'; g.fillRect(gx - 8, gy + (1 - m) * gh - 3, 62, 6);
      const inn = Math.abs(m - c) < BW / 2; label(ph === 1 ? (inn ? temp.toFixed(1) + '°C' : (temp + rnd(-3, 3)).toFixed(1) + '°C') : temp.toFixed(1) + '°C', 240, 60, inn || ph === 2 ? '#a9f5c0' : '#f7c58a', 22);
      if (ph === 1) { bar(40, 400, 300, el / need, '#4fd2ff', '量測中…'); label('讓指針待在綠色區間', gx + 23, gy + gh + 30, '#cfd6e0', 14); }
      else { label(`現場：暖氣 ${room.heater ? '🔥開著' : '關著'}　窗戶 ${room.window ? '🪟開著' : '關著'}`, W / 2, 400, '#f2d045', 17); }
    },
    score: () => .7 * clamp(el ? inB / el / .85 : 0) + .3 * (pick === ans ? 1 : 0),
    dbg: () => ({ ph, m, c, inB, el, ans })
  };
  return self;
}

// ── 5. 鞋印：手電筒照路，依序點出同一雙鞋的腳印（別點到員警的靴印） ──
function shoe(o) {
  const N = 9, ph = rnd(0, 6), T = [], D = [];
  for (let i = 0; i < N; i++) { const x = 60 + i * (520 / (N - 1)), y = 220 + 75 * Math.sin(x / 115 + ph), a = Math.atan2(75 / 115 * Math.cos(x / 115 + ph) * (520 / (N - 1)), 520 / (N - 1)), s = i % 2 ? 1 : -1; T.push({ x: x - Math.sin(a) * 13 * s, y: y + Math.cos(a) * 13 * s, a, ok: false }); }
  const tr = new Set(); while (tr.size < 2) tr.add(2 + Math.floor(Math.random() * (N - 4)));
  for (let k = 0; k < 40 && D.length < 5; k++) { const x = rnd(40, W - 40), y = rnd(40, H - 60); if (T.every(t => dist(t.x, t.y, x, y) > 60) && D.every(d => dist(d.x, d.y, x, y) > 50)) D.push({ x, y, a: rnd(0, 6) }); }
  let next = 0, pen = 0; const R = 92;
  const gr = o.ground || 'mud', PC = gr === 'blood' ? ['rgba(165,32,30,.92)', 'rgba(120,110,100,.55)'] : gr === 'floor' ? ['rgba(215,205,180,.75)', 'rgba(140,135,125,.5)'] : ['rgba(25,18,10,.85)', 'rgba(18,14,10,.75)'];
  const mark = () => {
    const near = (arr) => arr.map((t, i) => [dist(t.x, t.y, inp.x, inp.y), i]).sort((a, b) => a[0] - b[0])[0];
    const nt = near(T), nd = near(D);
    if (nt && nt[0] < 26 && (!nd || nt[0] <= nd[0])) { const i = nt[1]; if (T[i].ok) return; if (i === next) { T[i].ok = true; next++; say(`第 ${next} 步 ✓`); if (opt.snd) opt.snd('pick'); if (next === N) game.done = true; } else { pen += .05; say('順序不對：先找前一個腳印', true); } }
    else if (nd && nd[0] < 30) { pen += .1; say('這是員警的靴印，不是兇手的', true); }
    else say('這裡沒有鞋印', true);
  };
  const foot = (x, y, a, col, boot) => { g.save(); g.translate(x, y); g.rotate(a + Math.PI / 2); g.fillStyle = col; if (boot) { g.fillRect(-11, -18, 22, 36); g.clearRect && 0; g.fillStyle = 'rgba(0,0,0,.35)'; for (let k = -14; k < 16; k += 6) g.fillRect(-11, k, 22, 2); } else { g.beginPath(); g.ellipse(0, -6, 7, 10, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(0, 10, 5.5, 6, 0, 0, 7); g.fill(); } g.restore(); };
  return {
    limit: 50, tap: mark, action: mark,
    help: k => k === 'touch' ? '拖動手電筒照地面，從「起點」開始依序點出同一雙鞋的腳印；被員警踩過的地方要仔細看' : '移動手電筒（滑鼠或方向鍵），從「起點」開始依序點一下（或空白鍵）同一雙鞋的腳印；別點到員警的靴印',
    btns: () => [{ label: '👣 標記腳印', k: '空白', fn: mark, main: true }, { label: '完成', k: 'Enter', fn: () => { game.done = true; } }],
    step() {},
    draw() {
      if (gr === 'mud') bg('mg_mud_ground', 1); else { bg('mg_floor_dark', 1); g.fillStyle = 'rgba(255,240,220,.07)'; g.fillRect(0, 0, W, H); }
      T.forEach((t, i) => { foot(t.x, t.y, t.a, t.ok ? 'rgba(242,208,69,.9)' : PC[0]); if (tr.has(i)) foot(t.x + 8, t.y - 4, t.a + .7, PC[1], true); });
      D.forEach(d => foot(d.x, d.y, d.a, PC[1], true));
      dark(0); hole(inp.on ? inp.x : -999, inp.on ? inp.y : -999, R, .9);
      label('起點', T[0].x, T[0].y - 22, '#f2d045', 13);
      T.forEach((t, i) => { if (t.ok) label(String(i + 1), t.x, t.y - 16, '#f2d045', 12); });
      label(`已追蹤 ${next}/${N} 步`, W / 2, H - 14, '#cfd6e0', 15);
    },
    score: () => next / N - pen,
    dbg: () => ({ trail: T.map(t => [t.x, t.y, t.ok]), decoys: D.map(d => [d.x, d.y]), next })
  };
}

// ── 6. 棉棒：按住在污漬範圍內穩穩地擦，碰到外面或太用力會污染 ──
function swab(o) {
  const cx = 320 + rnd(-60, 60), cy = 210 + rnd(-30, 30), rx = 92, ry = 66; let prog = 0, con = 0, warn = 0, wt = '';
  const blobs = Array.from({ length: 9 }, () => [rnd(-.6, .6) * rx, rnd(-.6, .6) * ry, rnd(14, 34)]);
  const inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1;
  return {
    limit: 35, hold: true,
    help: k => k === 'touch' ? '手指按住在污漬（虛線內）來回輕擦；不要擦到外面、不要太快' : '按住滑鼠（或空白鍵＋方向鍵）在虛線內來回輕擦；擦到外面或太用力會污染樣本',
    btns: () => [{ label: '封存樣本（完成）', k: 'Enter', fn: () => { game.done = true; }, id: 'done' }],
    step(dt) {
      warn -= dt; if (!inp.down || !inp.on) return;
      if (!inside(inp.x, inp.y)) { con += dt * .45; warn = .5; wt = '碰到旁邊了，樣本會被污染！'; }
      else if (inp.speed > 380) { con += dt * .3; warn = .5; wt = '太用力了，輕一點'; }
      else if (inp.speed > 20) prog += dt * Math.min(inp.speed, 260) / (950 * F);
      if (prog >= 1) game.done = true;
    },
    draw() {
      bg('mg_print_surface', .7);
      g.fillStyle = o.act === 'nails' ? 'rgba(120,70,60,.85)' : 'rgba(90,10,12,.85)'; blobs.forEach(([x, y, r]) => { g.beginPath(); g.arc(cx + x, cy + y, r, 0, 7); g.fill(); });
      g.setLineDash([8, 6]); g.strokeStyle = 'rgba(242,208,69,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.stroke(); g.setLineDash([]);
      if (inp.on) { g.strokeStyle = '#e8e8e8'; g.lineWidth = 4; g.beginPath(); g.moveTo(inp.x, inp.y); g.lineTo(inp.x + 40, inp.y + 60); g.stroke(); g.fillStyle = inp.down ? '#fff' : '#ddd'; g.beginPath(); g.ellipse(inp.x, inp.y, 8, 11, -.6, 0, 7); g.fill(); }
      bar(40, 400, 260, prog, '#4fd2ff', '採集量'); bar(340, 400, 260, con, '#ff7a7a', '污染');
      if (warn > 0) label(wt, W / 2, 30, '#ff9a9a', 18);
    },
    score: () => clamp(prog) * (1 - clamp(con)),
    dbg: () => ({ center: [cx, cy], r: [rx, ry], prog, con })
  };
}

const KINDS = { photo, lum, prints, thermo, shoe, swab };
function loop(ts) {
  if (!MG.on) return; raf = requestAnimationFrame(loop);
  const dt = Math.min(.05, (ts - (last || ts)) / 1000); last = ts; if (ended) return;
  // 鍵盤：方向鍵／WASD 移動虛擬游標
  const kx = (keys.ArrowRight || keys.d ? 1 : 0) - (keys.ArrowLeft || keys.a ? 1 : 0), ky = (keys.ArrowDown || keys.s ? 1 : 0) - (keys.ArrowUp || keys.w ? 1 : 0);
  if (kx || ky) { const l = Math.hypot(kx, ky); inp.x = clamp(inp.x + kx / l * 190 * dt, 0, W); inp.y = clamp(inp.y + ky / l * 190 * dt, 0, H); inp.kb = true; inp.on = true; }
  inp.d = dist(inp.x, inp.y, inp.px, inp.py); const sp = dt > 0 ? inp.d / dt : 0; inp.speed = inp.speed * .7 + sp * .3; inp.px = inp.x; inp.py = inp.y;
  MG.t += dt; game.step(dt); game.draw();
  if (inp.kb) { g.fillStyle = '#fff'; g.fillRect(inp.x - 1, inp.y - 6, 2, 12); g.fillRect(inp.x - 6, inp.y - 1, 12, 2); }
  const left = Math.max(0, Math.ceil(game.limit * MG.lim - MG.t)); timeEl.textContent = `剩 ${left} 秒`; timeEl.className = left <= 8 ? 'low' : '';
  if (game.done || MG.t >= game.limit * MG.lim) MG.finish();
}
MG.open = function (o) {
  setup(); opt = o; F = o.fast || 1; MG.lim = o.fast ? Math.max(.35, o.fast) : 1; ended = false; MG.t = 0; MG.t0 = performance.now(); MG.kind = o.kind; MG.act = o.act; MG.obj = o.obj; MG.score = null;
  game = KINDS[o.kind](o); MG.on = true; inp.down = false; inp.on = false; inp.x = W / 2; inp.y = H / 2; inp.px = inp.x; inp.py = inp.y; inp.speed = 0; Object.keys(keys).forEach(k => delete keys[k]);
  titleEl.textContent = (o.title || NAMES[o.kind]) + (o.redo ? '（重做）' : ''); say(o.sub || '');
  helpEl.textContent = game.help(o.touch ? 'touch' : 'desk'); btns(game.btns.call(game));
  box.classList.remove('hidden'); box.dataset.kind = o.kind; last = 0; cancelAnimationFrame(raf); raf = requestAnimationFrame(loop);
};
MG.finish = function (forced) {
  if (!MG.on || ended) return; ended = true; const sc = Math.round(clamp(forced != null ? forced : game.score()) * 1000) / 1000; MG.score = sc;
  inp.down = false; foot.innerHTML = '<div class="mgwait">樣本處理中…</div>';
  const wait = Math.max(0, (opt.minSec || 0) * 1000 + 250 - (performance.now() - MG.t0));
  setTimeout(() => { const o = opt; MG.close(); if (o.onDone) o.onDone(sc); }, wait);
};
MG.cancel = function () { if (!MG.on) return; const o = opt; MG.close(); if (o && o.onCancel) o.onCancel(); };
MG.close = function () { MG.on = false; ended = true; cancelAnimationFrame(raf); if (box) box.classList.add('hidden'); game = null; };
MG.key = function (e, down) {
  if (!MG.on || !game) return false; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (down && k === 'Escape') { MG.cancel(); return true; }
  if (ended) return true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd'].includes(k)) { keys[k] = down; return true; }
  if (k === ' ') { if (game.hold) { inp.down = down; if (down) { inp.on = true; inp.kb = true; } } else if (down && !e.repeat && game.action) { inp.on = true; game.action(); } return true; }
  if (down && !e.repeat && (k === 'Enter' || /^[1-9]$/.test(k))) {
    const list = game.btnList || []; const b = k === 'Enter' ? list.find(b => b.k === 'Enter') : list.find(b => b.k === k);
    if (b && b.fn) b.fn(); return true;
  }
  return true;
};
// e2e／除錯：把邏輯座標轉成畫面座標
MG.toPage = (x, y) => { const r = cv.getBoundingClientRect(); return [r.left + x / W * r.width, r.top + y / H * r.height]; };
MG.dbg = () => game && game.dbg ? Object.assign({ kind: MG.kind, t: MG.t }, game.dbg()) : null;
root.FS_MG = MG;
})(typeof self !== 'undefined' ? self : this);
