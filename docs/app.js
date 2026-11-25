'use strict';
/* 鑑識現場 — 前端（單機模式直接跑 engine.js；連線模式由伺服器權威） */
let C = null; const GEN = window.FS_GEN, A = window.FS_ASSETS, ENG = window.FS;
const VER = '1';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AGENT_COL = ['#2bb3a3', '#f2a541', '#8a6fd1', '#f2d045'];
const qs = new URLSearchParams(location.search);
const LS = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }, del(k) { try { localStorage.removeItem(k); } catch (e) { } } };

/* ---------- 伺服器網址 ---------- */
const DEFAULT_SERVER = 'wss://forensic-scene-online.onrender.com/ws';
function serverWs() {
  const o = qs.get('server') || LS.get('fs_server', '');
  if (o) { if (qs.get('server')) LS.set('fs_server', o); return /^wss?:\/\//.test(o) ? o.replace(/\/?$/, '').replace(/(\/ws)?$/, '/ws') : 'wss://' + o.replace(/\/.*$/, '') + '/ws'; }
  const h = location.hostname;
  if (location.protocol.startsWith('http') && !/github\.io$/.test(h) && (/onrender\.com$/.test(h) || location.port || h === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(h)))
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws';
  return DEFAULT_SERVER;
}
const SERVER_WS = serverWs();

/* ---------- 美術：讀 assets/<name>.png，讀不到就用程式畫的佔位圖 ---------- */
const IMG = {}, URLS = {};
function placeholder(m) { const cv = document.createElement('canvas'); cv.width = m.w; cv.height = m.h; A.paint(m.n, cv.getContext('2d'), m.w, m.h); return cv; }
function loadAssets() {
  return Promise.all(A.list.map(m => new Promise(res => {
    const im = new Image(); let done = false;
    const fin = v => { if (done) return; done = true; IMG[m.n] = v; res(); };
    im.onload = () => fin(im); im.onerror = () => fin(placeholder(m));
    setTimeout(() => fin(placeholder(m)), 15000);
    im.src = 'assets/' + m.n + '.png?v=' + VER;
  })));
}
function url(n) {
  if (URLS[n]) return URLS[n];
  const im = IMG[n]; if (!im) return '';
  return (URLS[n] = im instanceof HTMLImageElement ? im.src : im.toDataURL());
}

/* ---------- 狀態 ---------- */
const G = { mode: null, st: null, me: 0, room: null, code: null, token: null, host: false, view: {}, Me: { x: 0, y: 0, dir: 1, moving: false }, path: null, autoOpen: null, nearId: null, bubbles: {}, fx: [], briefed: false };
const isHost = () => G.mode === 'solo' || G.host;
const meP = () => G.st && G.st.players[G.me];

function toast(msg, bad) {
  const box = $('#toasts'); const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg; box.appendChild(d);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => d.remove(), bad ? 4000 : 5500);
}
function card(id, lab) {
  const e = C.evidence[id]; if (!e) return;
  const box = $('#cards'); const d = document.createElement('div'); d.className = 'evc' + (lab ? ' lab' : '');
  d.innerHTML = `<img src="${url(e.icon)}" alt=""><div><em>${lab ? '📨 實驗室報告回來了' : '🔎 新證據'}・已記錄到筆記本</em><b>${esc(e.name)}</b><span>${esc(e.text)}</span></div>`;
  d.onclick = () => d.remove(); box.appendChild(d);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => d.remove(), lab ? 11000 : 8000);
  Snd.ding(lab);
}
const pname = pid => { const p = G.st && G.st.players[pid]; return p ? (pid === G.me ? '你' : p.name) : '隊友'; };

/* ---------- 音效（Web Audio 合成，不需要檔案） ---------- */
const Snd = {
  ctx: null,
  init() { try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state !== 'running') this.ctx.resume(); } catch (e) { } },
  tone(f, d, type, v, when) { const c = this.ctx; if (!c) return; const t = c.currentTime + (when || 0); const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || .08, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02); },
  ding(lab) { if (lab) { this.tone(660, .25, 'triangle', .1); this.tone(880, .3, 'triangle', .1, .12); this.tone(1320, .4, 'triangle', .08, .24); } else { this.tone(880, .2, 'sine', .08); this.tone(1175, .3, 'sine', .07, .08); } },
  spray() { const c = this.ctx; if (!c) return; const n = c.sampleRate * .35, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 3000; g.gain.value = .12; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(); },
  click() { this.tone(520, .06, 'square', .03); },
  bad() { this.tone(200, .18, 'sawtooth', .04); }
};

/* ---------- 動作：單機直接套用；連線送給伺服器 ---------- */
function doAct(a) {
  Snd.init();
  if (G.mode === 'solo') {
    const r = ENG.act(C, G.st, G.me, a);
    if (!r.ok) { toast(r.err, true); Snd.bad(); return; }
    onEvents(r.ev); saveSolo(); refresh();
  } else { Net.flushPos(true); Net.send({ t: 'act', a }); }
}
function onEvents(evs) {
  for (const e of evs || []) {
    const mine = e.by === G.me;
    switch (e.k) {
      case 'use': { const o = ENG.objById(C, e.obj); toast(`${pname(e.by)}：${e.label}（${o.name}，-${e.ap}）`); if (e.reveal) { G.fx.push({ x: o.x, y: o.y, t: performance.now(), kind: 'spray' }); Snd.spray(); } else Snd.click(); break; }
      case 'found': if (!evs.some(x => x.k === 'lab_back' && x.id === e.id)) card(e.id, false); break;
      case 'lab_back': card(e.id, true); toast(`📨 實驗室：${e.label} 的報告回來了`); break;
      case 'lab_sent': toast(`🛵 ${pname(e.by)} 把「${e.name}」交給小吳送實驗室（-${e.ap}，全隊再花 ${C.labDelay} 點後回報）`); Snd.click(); break;
      case 'bag': toast(`🛍️ ${pname(e.by)} 把「${e.name}」裝進證物袋（-${e.ap}）`); Snd.click(); break;
      case 'sample': toast(`🧫 ${pname(e.by)} 取得樣本：${e.label}（要拿回鑑識車分析）`); break;
      case 'analyze': toast(`🔬 ${pname(e.by)} 在車上分析：${e.label}（-${e.ap}）`); Snd.click(); break;
      case 'gear': if (mine) toast(e.cost ? `🧰 換好裝備（-${e.cost}）` : '🧰 裝備就緒，出發勘查！'); else toast(`🧰 ${pname(e.by)} 換了裝備`); break;
      case 'left': toast(`🚪 ${G.st.players[e.by] ? G.st.players[e.by].name : '隊友'} 離隊了，剩下的點數分給大家`); break;
      case 'phase':
        if (e.phase === 'deduce') { toast(e.why === 'ap' ? '⌛ 全隊行動點數用完了，開始推理！' : '⚖️ 提早結案，開始推理！'); closeOv(); setTimeout(() => openDeduce(), 300); }
        if (e.phase === 'result') { setTimeout(() => openResult(), 200); }
        break;
      case 'start': case 'draft': break;
      default: if (e.text) banner(e.text, e.k);
    }
  }
}

/* ---------- 單機存檔（重新整理不會不見） ---------- */
function saveSolo() { if (G.mode !== 'solo') return; try { const p = meP(); if (p) { p.x = G.Me.x; p.y = G.Me.y; } localStorage.setItem('fs_solo', JSON.stringify(G.st)); } catch (e) { } }
function startSolo(resume) {
  G.mode = 'solo'; G.me = 0; G.host = true; G.room = null;
  let st = null; if (resume) { try { st = JSON.parse(localStorage.getItem('fs_solo')); } catch (e) { } }
  if (!st || !st.seed || st.phase === 'result') {
    const seed = qs.get('seed') ? +qs.get('seed') : 1 + Math.floor(Math.random() * 2147483000);
    C = GEN.generate(seed, $('#diff').value); st = ENG.newGame(C, [{ pid: 0, name: myName(), ci: myCi() }]);
  } else C = GEN.generate(st.seed, st.diff);
  G.st = st; enterGame(!resume || !st.players[0].loaded);
}

/* ---------- 網路 ---------- */
const Net = {
  ws: null, open: false, want: false, retry: 0, lastPos: 0, sentPos: null, queue: [],
  connect() {
    if (this.ws && (this.ws.readyState === 0 || this.ws.readyState === 1)) return;
    this.want = true; srvLine('連線中…（免費主機第一次連線可能要等 30～60 秒喚醒）');
    let ws; try { ws = new WebSocket(SERVER_WS); } catch (e) { srvLine('無法連線伺服器'); return; }
    this.ws = ws;
    ws.onopen = () => { this.open = true; this.retry = 0; srvLine('已連線'); if (G.code && G.token) this.send({ t: 'join', code: G.code, token: G.token, name: myName(), ci: myCi() }); this.queue.splice(0).forEach(m => this.send(m)); };
    ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this.onMsg(m); };
    ws.onclose = () => {
      this.open = false; if (this.ws !== ws) return; this.ws = null;
      if (Voice.on) Voice.leave(true);
      if (this.want && G.code) { const d = Math.min(8000, 800 * Math.pow(1.6, this.retry++)); srvLine('斷線了，重新連線中…'); toast('連線中斷，重新連線中…', true); setTimeout(() => this.connect(), d); }
      else if (this.want) srvLine('連不上伺服器，請稍後再試');
    };
  },
  send(m) { if (this.ws && this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); else if (m.t === 'create' || m.t === 'join') { this.queue.push(m); this.connect(); } },
  close() { this.want = false; G.code = null; G.token = null; if (this.ws) try { this.ws.close(); } catch (e) { } this.ws = null; },
  flushPos(force) {
    if (G.mode !== 'online' || !G.st) return;
    const now = performance.now(), M = G.Me;
    if (!force && now - this.lastPos < 90) return;
    const k = Math.round(M.x) + ',' + Math.round(M.y) + ',' + M.dir;
    if (k === this.sentPos) return;
    this.sentPos = k; this.lastPos = now; this.send({ t: 'mv', x: Math.round(M.x), y: Math.round(M.y), d: M.dir });
  },
  onMsg(m) {
    switch (m.t) {
      case 'joined':
        G.mode = 'online'; G.code = m.code; G.me = m.slot; G.token = m.token;
        LS.set('fs_tok_' + m.code, m.token); LS.set('fs_cur', m.code);
        history.replaceState(null, '', location.pathname + '?room=' + m.code + (qs.get('server') ? '&server=' + encodeURIComponent(qs.get('server')) : ''));
        if (!m.rejoin) toast('已加入房間 ' + m.code);
        Voice.onJoined();
        break;
      case 'room': G.room = m.room; G.host = !!(m.room.players[G.me] && m.room.players[G.me].host); if (!G.st || m.room.phase === 'lobby') showRoom(); Voice.sync(); refresh(); break;
      case 'state': {
        if (!C || C.seed !== m.s.seed || C.diff !== m.s.diff) { C = GEN.generate(m.s.seed, m.s.diff); G.view = {}; }
        const first = !G.st;
        const keep = G.st && G.st.players[G.me] ? { x: G.Me.x, y: G.Me.y } : null;
        G.st = m.s;
        const p = G.st.players[G.me];
        if (p && keep && !(m.ev || []).some(e => e.k === 'start')) { p.x = keep.x; p.y = keep.y; }
        if (first || (m.ev || []).some(e => e.k === 'start')) { enterGame(!(p && p.loaded)); }
        else onEvents(m.ev);
        if ((m.ev || []).some(e => e.k === 'sync')) { if (G.st.phase === 'deduce') openDeduce(); else if (G.st.phase === 'result') openResult(); }
        refresh();
        break;
      }
      case 'pos':
        for (const [pid, x, y, d] of m.p) { if (pid === G.me) continue; const v = G.view[pid] || (G.view[pid] = { x, y }); v.tx = x; v.ty = y; v.dir = d; }
        if (G.st && m.n) for (const [id, x, y, mode] of m.n) { const n = G.st.npcs.find(q => q.id === id); if (n) { n.tx = x; n.ty = y; n.mode = mode; if (n.vx == null) { n.vx = x; n.vy = y; } } }
        if (G.st) { if (m.k) { if (!G.st.rookie) G.st.rookie = { x: m.k[0], y: m.k[1] }; G.st.rookie.tx = m.k[0]; G.st.rookie.ty = m.k[1]; } else G.st.rookie = null; if (m.clock != null) G.st.clock = m.clock; }
        break;
      case 'fix': G.Me.x = m.x; G.Me.y = m.y; G.path = null; break;
      case 'chat': Chat.add(m.slot, m.name, m.text); break;
      case 'err': toast(m.msg || '錯誤', true); Snd.bad(); if (m.code === 'noroom' || m.code === 'full' || m.code === 'playing') { LS.del('fs_cur'); if (!G.st) { G.code = null; G.token = null; } } break;
      case 'lobby': G.st = null; closeOv(); showRoom(); break;
      case 'kicked': toast(m.msg, true); this.want = false; break;
      case 'left': backHome('你已離開房間'); break;
      case 'dissolved': backHome(m.msg || '房間已解散'); break;
      case 'idle': toast('太久沒有動作，已中斷連線', true); this.want = false; break;
      case 'rtc': Voice.onSignal(m); break;
    }
  }
};
function srvLine(t) { const e = $('#srvLine'); if (e) e.textContent = (t ? t + '｜' : '') + '伺服器：' + SERVER_WS.replace(/^wss?:\/\//, '').replace(/\/ws$/, ''); }
function backHome(msg) {
  if (Voice.on) Voice.leave(true);
  const code = G.code; if (code) LS.del('fs_tok_' + code); LS.del('fs_cur');
  Net.close(); G.st = null; G.room = null; G.mode = null; closeOv();
  history.replaceState(null, '', location.pathname + (qs.get('server') ? '?server=' + encodeURIComponent(qs.get('server')) : ''));
  $('#hud').classList.add('hidden'); $('#roomScr').classList.add('hidden'); $('#chat').classList.add('hidden'); $('#home').classList.remove('hidden');
  if (msg) toast(msg);
}

/* ---------- 首頁 ---------- */
function myName() { return ($('#name').value || '').trim().slice(0, 10) || '鑑識員'; }
function myCi() { return +LS.get('fs_ci', '0') || 0; }
function initHome() {
  $('#home').style.backgroundImage = `url(${url('lobby_bg')})`; $('#roomScr').style.backgroundImage = `url(${url('lobby_bg')})`;
  $('#logoImg').src = url('title_logo');
  $('#name').value = LS.get('fs_name', '');
  $('#diff').value = LS.get('fs_diff', 'normal'); $('#diff').onchange = () => LS.set('fs_diff', $('#diff').value);
  $('#name').oninput = () => LS.set('fs_name', $('#name').value.trim());
  const ag = $('#agents'); ag.innerHTML = [0, 1, 2, 3].map(i => `<button data-ci="${i}" class="${i === myCi() ? 'on' : ''}" title="隊員 ${i + 1}"><img src="${url('agent_' + (i + 1))}" alt=""></button>`).join('');
  ag.onclick = e => { const b = e.target.closest('[data-ci]'); if (!b) return; LS.set('fs_ci', b.dataset.ci); ag.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); if (G.mode === 'online' && G.room && G.room.phase === 'lobby') Net.send({ t: 'profile', name: myName(), ci: myCi() }); };
  let resumable = false; try { const s = JSON.parse(localStorage.getItem('fs_solo') || 'null'); resumable = s && s.seed && s.phase !== 'result' && s.spent > 0; } catch (e) { }
  $('#bSolo').textContent = resumable ? '🕵️ 繼續單人調查' : '🕵️ 單人調查';
  $('#bSolo').onclick = () => { Snd.init(); if (resumable && !confirm('要繼續上次的單人調查嗎？\n（取消＝重新開始）')) LS.del('fs_solo'), startSolo(false); else startSolo(resumable); };
  $('#bCreate').onclick = () => { Snd.init(); LS.set('fs_name', myName()); Net.connect(); Net.send({ t: 'create', name: myName(), ci: myCi() }); };
  $('#bJoin').onclick = () => { Snd.init(); const code = $('#joinCode').value.trim(); if (!/^\d{4}$/.test(code)) return toast('請輸入 4 位數房號', true); LS.set('fs_name', myName()); G.code = code; G.token = LS.get('fs_tok_' + code, null); Net.connect(); Net.send({ t: 'join', code, token: G.token || undefined, name: myName(), ci: myCi() }); };
  $('#joinCode').onkeydown = e => { if (e.key === 'Enter') $('#bJoin').click(); };
  srvLine('');
  const rc = qs.get('room') || LS.get('fs_cur', '');
  if (/^\d{4}$/.test(rc || '')) { $('#joinCode').value = rc; const tok = LS.get('fs_tok_' + rc, null); if (tok) { G.code = rc; G.token = tok; Net.connect(); } }
}
function showRoom() {
  $('#home').classList.add('hidden'); $('#hud').classList.add('hidden'); $('#roomScr').classList.remove('hidden');
  const r = G.room; if (!r) return;
  $('#rmCode').textContent = r.code;
  $('#plist').innerHTML = r.players.map((p, i) => p ? `<div class="pl" data-vs="${i}"><img src="${url('agent_' + (p.ci + 1))}" alt=""><div class="nm">${esc(p.name)}${i === G.me ? '（你）' : ''}</div>
    ${p.host ? '<span class="tag host">房主</span>' : ''}${p.online ? '<span class="tag ok">已連線</span>' : '<span class="tag off">離線</span>'}${p.voice ? `<span class="tag vc">${p.voice.muted ? '🔇 靜音' : '🎤 語音中'}</span>` : ''}</div>`
    : `<div class="pl" style="opacity:.5"><div class="nm">（空位）</div></div>`).join('');
  const n = r.players.filter(Boolean).length;
  const AP = GEN.DIFF[r.diff || 'normal'].teamAP;
  $('#rmDiff').value = r.diff || 'normal'; $('#rmDiff').disabled = !G.host;
  $('#rmNote').textContent = `${n} 人合作：全隊 ${AP} 點行動點數，每人 ${Math.floor(AP / n)}${AP % n ? '～' + Math.ceil(AP / n) : ''} 點（各自扣自己的）。`;
  $('#rmStart').style.display = G.host ? '' : 'none';
  $('#rmDissolve').classList.toggle('hidden', !G.host);
  $('#rmNote').textContent += G.host ? '' : '　等待房主開始…';
  Voice.render();
}
$('#bCopy').onclick = () => { const u = location.origin + location.pathname + '?room=' + G.code + (qs.get('server') ? '&server=' + encodeURIComponent(qs.get('server')) : ''); (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(() => toast('已複製邀請連結'), () => prompt('複製這個連結給隊友', u)); };
$('#rmStart').onclick = () => Net.send({ t: 'start' });
$('#rmDiff').onchange = e => Net.send({ t: 'diff', v: e.target.value });
$('#rmLeave').onclick = () => { if (confirm('確定離開房間？')) Net.send({ t: 'leave' }); };
$('#rmDissolve').onclick = () => { if (confirm('確定解散房間？所有人都會回到首頁。')) Net.send({ t: 'dissolve' }); };
$('#rmVoice').onclick = () => Voice.on ? Voice.leave() : Voice.join();
$('#rmChat').onclick = () => Chat.toggle();

/* ================= 畫面 ================= */
const cv = $('#cv'), ctx = cv.getContext('2d');
let VW = 0, VH = 0, DPR = 1, Z = 1, CAM = { x: 0, y: 0 };
function resize() { DPR = Math.min(2, window.devicePixelRatio || 1); VW = innerWidth; VH = innerHeight; cv.width = VW * DPR; cv.height = VH * DPR; Z = Math.max(.5, Math.min(1.2, Math.min(VW / 900, VH / 620))); }
addEventListener('resize', resize); resize();
const W2S = (x, y) => [(x - CAM.x) * Z + VW / 2, (y - CAM.y) * Z + VH / 2];
const S2W = (x, y) => [(x - VW / 2) / Z + CAM.x, (y - VH / 2) / Z + CAM.y];
function drawImg(n, x, y, w, h, opt) {
  const im = IMG[n]; if (!im) return; opt = opt || {};
  const iw = im.width || im.naturalWidth, ih = im.height || im.naturalHeight; const k = Math.min(w / iw, h / ih); const dw = iw * k, dh = ih * k;
  const dx = opt.flat ? x - dw / 2 : x - dw / 2, dy = opt.flat ? y - dh / 2 : y - dh;
  if (opt.flip) { ctx.save(); ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(im, -dw / 2, dy, dw, dh); ctx.restore(); }
  else ctx.drawImage(im, dx, dy, dw, dh);
}
function fillTiled(n, x, y, w, h, scale) {
  const im = IMG[n]; if (!im) return; const iw = (im.width || im.naturalWidth) * scale, ih = (im.height || im.naturalHeight) * scale;
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
  for (let yy = y; yy < y + h; yy += ih) for (let xx = x; xx < x + w; xx += iw) ctx.drawImage(im, xx, yy, iw + .5, ih + .5);
  ctx.restore();
}
function roomOf(id) { return C.map.rooms.find(r => r.id === id); }
function drawMap() {
  const M = C.map, WL = M.wall;
  for (const r of M.rooms) fillTiled(r.floor, r.x, r.y, r.w, r.h, .5);
  // 牆
  for (const r of M.rooms) {
    if (r.out) continue;
    fillTiled(r.wallImg, r.x, r.y, r.w, WL, WL / 168);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(r.x, r.y + WL - 6, r.w, 6);
    ctx.fillStyle = '#2a2230';
    ctx.fillRect(r.x - 7, r.y - 12, r.w + 14, 14); ctx.fillRect(r.x - 7, r.y - 12, 14, r.h + 19); ctx.fillRect(r.x + r.w - 7, r.y - 12, 14, r.h + 19); ctx.fillRect(r.x - 7, r.y + r.h - 7, r.w + 14, 14);
  }
  // 門
  for (const d of M.doors) {
    const cx = d.x + d.w / 2, cy = d.y + d.h / 2;
    const rr = d.v ? (M.rooms.find(r => !r.out && cx + d.w / 2 - 4 >= r.x && cx + d.w / 2 - 4 <= r.x + r.w && cy >= r.y && cy <= r.y + r.h) || M.rooms.find(r => cx >= r.x && cx <= r.x + r.w && cy >= r.y && cy <= r.y + r.h)) : M.rooms.find(r => cx >= r.x && cx <= r.x + r.w && d.y + d.h - 6 >= r.y && d.y + d.h - 6 <= r.y + r.h);
    if (!rr) continue;
    if (d.v) { fillTiled(rr.floor, d.x, d.y + 10, d.w, d.h - 10, .5); ctx.fillStyle = '#6b4426'; ctx.fillRect(d.x + d.w / 2 - 9, d.y - 4, 18, 14); ctx.fillRect(d.x + d.w / 2 - 9, d.y + d.h - 6, 18, 12); }
    else { fillTiled(rr.floor, d.x, d.y - 6, d.w, d.h + 6, .5); ctx.fillStyle = '#6b4426'; ctx.fillRect(d.x - 8, d.y - 6, 10, d.h + 6); ctx.fillRect(d.x + d.w - 2, d.y - 6, 10, d.h + 6); }
  }
  // 封鎖線（街道和玄關之間）
  ctx.strokeStyle = '#f2d045'; ctx.lineWidth = 6; ctx.setLineDash([16, 10]); ctx.beginPath(); ctx.moveTo(440, 300); ctx.lineTo(440, 552); ctx.moveTo(440, 660); ctx.lineTo(440, 1070); ctx.stroke(); ctx.setLineDash([]);
}
function available(o) {
  const p = meP(); if (!p || !G.st || G.st.phase !== 'play') return 0;
  const opts = ENG.options(C, G.st, G.me, o.id); if (!opts.length) return 0;
  if (opts.some(x => !x.why)) return 2; return opts.some(x => x.why && x.why !== '已完成' && x.why !== '已送驗') ? 1 : 0;
}
function people() {
  const list = [];
  for (const p of Object.values(G.st.players)) {
    if (!p.active) continue;
    let x = p.x, y = p.y, dir = p.dir, mv = false;
    if (p.pid === G.me) { x = G.Me.x; y = G.Me.y; dir = G.Me.dir; mv = G.Me.moving; }
    else if (G.mode === 'online') { const v = G.view[p.pid] || (G.view[p.pid] = { x, y, tx: x, ty: y }); x = v.x; y = v.y; dir = v.dir || 1; mv = Math.hypot(v.tx - v.x, v.ty - v.y) > 2; }
    list.push({ kind: 'p', p, x, y, dir, mv });
  }
  for (const n of G.st.npcs || []) { if (n.mode === 'gone') continue; const x = n.vx != null ? n.vx : n.x, y = n.vy != null ? n.vy : n.y; list.push({ kind: 'n', n, x, y, mv: ['wander', 'curious', 'sneak', 'back', 'flee'].includes(n.mode) }); }
  if (G.st.rookie) { const R = G.st.rookie; list.push({ kind: 'r', x: R.vx != null ? R.vx : R.x, y: R.vy != null ? R.vy : R.y, mv: true }); }
  return list;
}
function label(t, x, y, col, bg) { ctx.font = 'bold 14px "PingFang TC","Noto Sans TC","Noto Sans CJK TC",sans-serif'; const w = ctx.measureText(t).width + 12; ctx.fillStyle = bg || 'rgba(10,14,22,.75)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 11, w, 22, 8) : ctx.rect(x - w / 2, y - 11, w, 22); ctx.fill(); ctx.fillStyle = col || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1); }
function render(now) {
  const t = now / 1000; const late = [];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, VW, VH);
  if (!G.st || !C) return;
  // 鏡頭
  const M = C.map; const hw = VW / 2 / Z, hh = VH / 2 / Z;
  CAM.x = M.w < hw * 2 ? M.w / 2 : Math.max(hw - 40, Math.min(M.w - hw + 40, G.Me.x));
  CAM.y = M.h < hh * 2 ? M.h / 2 + 60 : Math.max(hh + 100, Math.min(M.h - hh + 40, G.Me.y - 30));
  ctx.setTransform(DPR * Z, 0, 0, DPR * Z, DPR * (VW / 2 - CAM.x * Z), DPR * (VH / 2 - CAM.y * Z));
  drawMap();
  const near = G.nearId;
  // 平放的東西
  for (const o of C.objects) {
    if (!o.flat || G.st.obj[o.id].gone) continue;
    drawImg(o.img, o.x, o.y, o.w, o.h, { flat: true });
    for (const fx of G.st.obj[o.id].revealed) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .75 + .25 * Math.sin(t * 3); const big = fx === 'fx_luminol_pool'; drawImg(fx, o.x + (big ? 0 : 0), o.y, big ? o.w : Math.max(110, o.w * .8), big ? o.h : Math.max(80, o.h), { flat: true }); ctx.restore(); }
  }
  // 依 y 排序：物件＋人物
  const items = [];
  for (const o of C.objects) if (!o.flat && !G.st.obj[o.id].gone) items.push({ kind: 'o', o, y: o.y });
  for (const q of people()) items.push(Object.assign(q, { y: q.y }));
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.kind === 'o') {
      const o = it.o; const hl = near === o.id;
      if (hl) { ctx.save(); ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 22 + 8 * Math.sin(t * 5); }
      drawImg(o.img, o.x, o.y, o.w, o.h);
      if (hl) ctx.restore();
      for (const fx of G.st.obj[o.id].revealed) { ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .7 + .3 * Math.sin(t * 3); drawImg(fx, o.x, o.y - o.h * .1, 110, 110); ctx.restore(); }
    } else if (it.kind === 'p') {
      const p = it.p, bob = it.mv ? Math.abs(Math.sin(t * 10)) * 5 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 22, 7, 0, 0, Math.PI * 2); ctx.fill();
      drawImg('agent_' + (p.ci + 1), it.x, it.y - bob, 66, 88, { flip: it.dir < 0 });
      label(p.pid === G.me ? p.name + '（你）' : p.name, it.x, it.y - 100, AGENT_COL[p.ci]);
      const b = G.bubbles[p.pid]; if (b && b.until > now) late.push([b.text, it.x, it.y - 128]);
      if (Voice.speak[p.pid]) { ctx.strokeStyle = '#8ff0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(it.x, it.y, 28, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (it.kind === 'n') {
      const n = it.n, bob = it.mv ? Math.abs(Math.sin(t * 8)) * 4 : 0, s = C.suspects.find(x => x.id === n.id);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
      if (near === 'npc:' + n.id) { ctx.save(); ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 20; }
      drawImg('npc_' + n.id, it.x, it.y - bob, 62, 92);
      if (near === 'npc:' + n.id) ctx.restore();
      const tag = n.mode === 'flee' ? '🏃 ' : n.mode === 'held' ? '🔒 ' : '';
      label(tag + (s ? s.name : ''), it.x, it.y - 102, n.mode === 'flee' ? '#ff9d93' : '#e6dcc8', n.mode === 'flee' ? 'rgba(90,20,20,.85)' : undefined);
    } else if (it.kind === 'r') {
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 20, 7, 0, 0, Math.PI * 2); ctx.fill();
      drawImg('npc_rookie', it.x, it.y - Math.abs(Math.sin(t * 9)) * 4, 62, 92);
      label('⚠️ 菜鳥員警', it.x, it.y - 102, '#ffd58a', 'rgba(90,60,10,.85)');
    }
  }
  // 可互動標記
  for (const o of C.objects) {
    if (o.deco || o.van || G.st.obj[o.id].gone) continue;
    const a = available(o); if (!a) continue;
    const yy = (o.flat ? o.y - o.h / 2 - 16 : o.y - o.h - 14) - Math.abs(Math.sin(t * 3 + o.x)) * 6;
    ctx.fillStyle = a === 2 ? '#f2a541' : '#7d8aa0'; ctx.beginPath(); ctx.arc(o.x, yy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2333'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', o.x, yy + 1);
  }
  if (near && !near.startsWith('npc:')) { const o = ENG.objById(C, near); if (o) label(o.name, o.x, o.npc ? o.y - o.h - 12 : o.flat ? o.y + o.h / 2 + 16 : o.y + 18, '#bfefff'); }
  for (const [tx, bx, by] of late) bubble(tx, bx, by);
  // 噴灑特效
  G.fx = G.fx.filter(f => now - f.t < 900);
  for (const f of G.fx) { const k = (now - f.t) / 900; ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#bfefff'; for (let i = 0; i < 18; i++) { const a = i * 2.4, r = 10 + k * 70 * ((i % 5) / 5 + .5); ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y - 40 + Math.sin(a) * r * .6, 3, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  // 夜晚手電筒光暈
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const [sx, sy] = W2S(G.Me.x, G.Me.y - 30); const g = ctx.createRadialGradient(sx, sy, 160 * Z, sx, sy, Math.max(VW, VH) * .75);
  g.addColorStop(0, 'rgba(5,8,20,0)'); g.addColorStop(1, 'rgba(5,8,20,.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 畫面外指示：菜鳥、逃跑中的人
  const marks = []; if (G.st.rookie) { const R = G.st.rookie; marks.push([R.vx != null ? R.vx : R.x, R.vy != null ? R.vy : R.y, '⚠️', '#f2a541']); }
  for (const n of G.st.npcs || []) if (n.mode === 'flee') marks.push([n.vx != null ? n.vx : n.x, n.vy != null ? n.vy : n.y, '🏃', '#e0645a']);
  for (const [x, y, ic, col] of marks) { let [px, py] = W2S(x, y - 40); if (px > 30 && px < VW - 30 && py > 60 && py < VH - 60) continue; px = Math.max(30, Math.min(VW - 30, px)); py = Math.max(90, Math.min(VH - 90, py)); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 20, 0, Math.PI * 2); ctx.fill(); ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic, px, py + 1); }
}
function bubble(text, x, y) { ctx.font = '14px "PingFang TC","Noto Sans TC",sans-serif'; const s = text.length > 18 ? text.slice(0, 18) + '…' : text; const w = ctx.measureText(s).width + 16; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 14, w, 28, 10) : ctx.rect(x - w / 2, y - 14, w, 28); ctx.fill(); ctx.fillStyle = '#1d2333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y + 1); }

/* ================= 移動與輸入 ================= */
const KEYS = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  KEYS[e.key.toLowerCase()] = true;
  if (!G.st || !$('#ov').classList.contains('hidden')) { if (e.key === 'Escape') closeOv(); return; }
  if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); interactNearest(); }
  if (e.key === 'n' || e.key === 'N') openNote();
  if (e.key === 'Enter' && G.mode === 'online') { e.preventDefault(); Chat.open(); }
});
addEventListener('keyup', e => { KEYS[e.key.toLowerCase()] = false; });
addEventListener('blur', () => { for (const k in KEYS) KEYS[k] = false; });
const PT = { id: null, sx: 0, sy: 0, x: 0, y: 0, joy: false, t0: 0 };
cv.addEventListener('pointerdown', e => { Snd.init(); if (PT.id !== null) return; PT.id = e.pointerId; PT.sx = PT.x = e.clientX; PT.sy = PT.y = e.clientY; PT.joy = false; PT.t0 = performance.now(); try { cv.setPointerCapture(e.pointerId); } catch (x) { } });
cv.addEventListener('pointermove', e => { if (e.pointerId !== PT.id) return; PT.x = e.clientX; PT.y = e.clientY; if (!PT.joy && Math.hypot(PT.x - PT.sx, PT.y - PT.sy) > 14) { PT.joy = true; G.path = null; G.autoOpen = null; const j = $('#joy'); j.style.left = PT.sx + 'px'; j.style.top = PT.sy + 'px'; j.classList.remove('hidden'); } if (PT.joy) { const dx = PT.x - PT.sx, dy = PT.y - PT.sy, d = Math.min(45, Math.hypot(dx, dy)), a = Math.atan2(dy, dx); $('#joy i').style.transform = `translate(${Math.cos(a) * d}px,${Math.sin(a) * d}px)`; } });
const ptEnd = e => { if (e.pointerId !== PT.id) return; PT.id = null; $('#joy').classList.add('hidden'); if (!PT.joy) tapAt(e.clientX, e.clientY); PT.joy = false; };
cv.addEventListener('pointerup', ptEnd); cv.addEventListener('pointercancel', e => { if (e.pointerId === PT.id) { PT.id = null; PT.joy = false; $('#joy').classList.add('hidden'); } });
function tapAt(cx, cy) {
  if (!G.st) return;
  const [wx, wy] = S2W(cx, cy);
  // 點到人？
  for (const q of people()) { if (q.kind !== 'n') continue; if (Math.abs(wx - q.x) < 30 && wy < q.y + 8 && wy > q.y - 92) { goTo(q.x, q.y + 30, 'npc:' + q.n.id); return; } }
  // 點到物件？（後面畫的優先）
  const hits = C.objects.filter(o => !G.st.obj[o.id].gone && (o.flat ? Math.abs(wx - o.x) < o.w / 2 && Math.abs(wy - o.y) < o.h / 2 : Math.abs(wx - o.x) < o.w / 2 && wy < o.y + 10 && wy > o.y - o.h)).sort((a, b) => b.y - a.y);
  const o = hits.find(o => !o.deco) || hits[0];
  if (o && !(o.flat && o.deco)) { goTo(o.x, o.y + (o.flat ? 0 : 20), o.id, o.r || (o.van ? 150 : 90)); return; }
  goTo(wx, wy, null);
}
function goTo(x, y, open, r) {
  const p = ENG.findPath(C, G.Me.x, G.Me.y, x, y, open ? Math.max(30, (r || 90) - 30) : 12);
  G.path = p && p.length ? p : null; G.autoOpen = open || null;
  if (open && !G.path) { G.nearId = open; refreshAct(true); }
}
function step(dt) {
  const M = G.Me; let vx = 0, vy = 0;
  if (KEYS.a || KEYS.arrowleft) vx -= 1; if (KEYS.d || KEYS.arrowright) vx += 1; if (KEYS.w || KEYS.arrowup) vy -= 1; if (KEYS.s || KEYS.arrowdown) vy += 1;
  if (PT.joy) { const dx = PT.x - PT.sx, dy = PT.y - PT.sy, d = Math.hypot(dx, dy); if (d > 10) { vx = dx / d * Math.min(1, d / 45); vy = dy / d * Math.min(1, d / 45); } }
  if (vx || vy) { G.path = null; G.autoOpen = null; }
  else if (G.path && G.path.length) { const t = G.path[0], dx = t.x - M.x, dy = t.y - M.y, d = Math.hypot(dx, dy); if (d < 6) { G.path.shift(); if (!G.path.length) { G.path = null; if (G.autoOpen) { G.nearId = G.autoOpen; refreshAct(true); G.autoOpen = null; } } } else { vx = dx / d; vy = dy / d; } }
  const sp = Math.hypot(vx, vy); M.moving = sp > 0.05;
  if (M.moving) {
    if (sp > 1) { vx /= sp; vy /= sp; }
    let rem = ENG.SPEED * dt; while (rem > 0) { const s = Math.min(rem, 8); rem -= s; [M.x, M.y] = ENG.moveTo(C, M.x, M.y, M.x + vx * s, M.y + vy * s); }
    if (Math.abs(vx) > .1) M.dir = vx < 0 ? -1 : 1;
    if (G.mode === 'solo') { const p = meP(); p.x = M.x; p.y = M.y; p.dir = M.dir; }
  }
  // 其他人／NPC 插值
  const k = Math.min(1, dt * 10);
  for (const v of Object.values(G.view)) if (v.tx != null) { v.x += (v.tx - v.x) * k; v.y += (v.ty - v.y) * k; }
  for (const n of G.st.npcs || []) if (n.tx != null) { n.vx += (n.tx - n.vx) * k; n.vy += (n.ty - n.vy) * k; }
  if (G.st.rookie && G.st.rookie.tx != null) { const R = G.st.rookie; if (R.vx == null) { R.vx = R.tx; R.vy = R.ty; } R.vx += (R.tx - R.vx) * k; R.vy += (R.ty - R.vy) * k; }
  Net.flushPos(false);
}
function nearest() {
  const p = { x: G.Me.x, y: G.Me.y }; let best = null, bd = 1e9;
  for (const o of C.objects) {
    if (G.st.obj[o.id].gone) continue; if (o.deco && !o.desc) continue;
    const r = o.deco ? 80 : null; const d = Math.hypot(o.x - p.x, o.y - p.y);
    if ((r ? d <= r : ENG.near(C, p, o)) && d < bd) { bd = d; best = o.id; }
  }
  for (const n of G.st.npcs || []) { if (n.mode === 'gone') continue; const x = n.vx != null ? n.vx : n.x, y = n.vy != null ? n.vy : n.y, d = Math.hypot(x - p.x, y - p.y); if (d < 90 && d < bd) { bd = d; best = 'npc:' + n.id; } }
  return best;
}
function interactNearest() { const id = nearest(); if (!id) return; if (id.startsWith('npc:')) return openPerson(id.slice(4)); const o = ENG.objById(C, id); if (o && o.van) openVan(); }

/* ================= 主迴圈 ================= */
let last = performance.now(), slowT = 0;
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (G.st && C) {
    step(dt);
    if (G.mode === 'solo' && G.st.phase === 'play' && document.visibilityState === 'visible') { const ev = ENG.tick(C, G.st, dt); if (ev.length) { onEvents(ev); refresh(); saveSolo(); } }
    const nid = nearest(); if (nid !== G.nearId) { G.nearId = nid; refreshAct(); }
    slowT += dt; if (slowT > .5) { slowT = 0; hudPress(); if (G.mode === 'solo') saveSolo(); }
  }
  render(now);
  requestAnimationFrame(loop);
}

/* ================= HUD ================= */
const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
function enterGame(needGear) {
  $('#home').classList.add('hidden'); $('#roomScr').classList.add('hidden'); $('#hud').classList.remove('hidden');
  const p = meP(); G.Me.x = p.x; G.Me.y = p.y; G.Me.dir = p.dir || 1; G.path = null; G.view = {}; G.nearId = null;
  for (const n of G.st.npcs || []) { n.vx = n.x; n.vy = n.y; }
  $('#bChat').classList.toggle('hidden', G.mode !== 'online');
  closeOv(); refresh();
  if (G.st.phase === 'deduce') openDeduce(); else if (G.st.phase === 'result') openResult(); else if (needGear) openBriefing();
}
function refresh() {
  if (!G.st || !C) return;
  const p = meP(); if (!p) return;
  $('#apN').textContent = p.ap; $('#apMax').textContent = ' / ' + p.apMax;
  $('#pips').innerHTML = Array.from({ length: Math.min(p.apMax, 40) }, (_, i) => `<i class="${i < p.ap ? '' : 'u'}"></i>`).join('');
  const ps = Object.values(G.st.players);
  $('#team').innerHTML = ps.length > 1 ? ps.map(q => `<span class="chip" style="${q.active ? '' : 'opacity:.4'}"><span class="dot" style="background:${AGENT_COL[q.ci]}"></span>${esc(q.name)} ⚡${q.ap}${Voice.badge(q.pid)}</span>`).join('') : '';
  const labs = G.st.labs.filter(l => !l.back);
  $('#labs').classList.toggle('hidden', !labs.length);
  $('#labs').innerHTML = labs.map(l => `🧪 ${esc(l.label)}：再 ${Math.max(0, l.due - G.st.spent)} 點回報`).join('<br>');
  const bar = [];
  for (let i = 0; i < C.carryTools; i++) { const t = C.tools.find(x => x.id === p.tools[i]); bar.push(`<div class="slot" title="${t ? esc(t.name) : '空工具格'}">${t ? `<img src="${url(t.icon)}" alt="">` : ''}</div>`); }
  bar.push('<div class="sep"></div>');
  let used = 0; for (const b of p.bag) { bar.push(`<div class="slot bag" title="${esc(b.name)}" style="${b.size > 1 ? 'width:' + (b.size * 54 + 6) + 'px' : ''}"><img src="${url(b.img)}" alt=""></div>`); used += b.size; }
  for (let i = used; i < C.bagSlots; i++) bar.push('<div class="slot bag" title="證物袋空格"></div>');
  if (p.samples.length) bar.push(`<div class="slot" title="樣本：${esc(p.samples.map(s => s.label).join('、'))}">🧫<small>${p.samples.length}</small></div>`);
  $('#bar').innerHTML = bar.join('');
  $('#bClose').style.display = G.st.phase === 'play' && isHost() ? '' : 'none';
  refreshAct(); hudPress(); Voice.render();
  if (G.ovKind && G.ovKind !== 'result' && G.ovKind !== 'brief' && G.ovKind !== 'person') G.ovRender && G.ovRender();
}
function hudPress() {
  if (!G.st || !C) return;
  const T = G.st.clock, P = C.pressure, rows = [];
  rows.push(`⏱ ${mmss(T)}`);
  if (G.st.phase === 'play') {
    for (const m of P.milestones) { const s = G.st.ms[m.id]; if (s) continue; const left = m.at - T; rows.push(`🎯 ${m.id === 'm3' ? '結案時限' : m.t}：<b style="color:${left < 60 ? '#ff9d93' : '#ffd58a'}">${mmss(left)}</b>`); break; }
    if (!G.st.flags.rain && P.rainAt - T < 120) rows.push(`🌧️ 下雨倒數 ${mmss(P.rainAt - T)}（後院鞋印）`);
    else if (!G.st.flags.todWide && P.todWideAt - T < 120) rows.push(`🌡️ 屍溫倒數 ${mmss(P.todWideAt - T)}`);
    if (G.st.rookie) rows.push('<b style="color:#ffd58a">⚠️ 菜鳥員警在現場！</b>');
  }
  const el = $('#labs'); let pr = $('#press'); if (!pr) { pr = document.createElement('div'); pr.id = 'press'; pr.className = 'chip labs'; el.parentNode.insertBefore(pr, el); }
  const h = rows.join('<br>'); if (pr.innerHTML !== h) pr.innerHTML = h;
}
function banner(text, k) {
  const bad = /fail|tamper|rookie_hit|fled|flee|threat|rookie$/.test(k || ''); const box = $('#cards'); const d = document.createElement('div');
  d.className = 'evc' + (bad ? ' lab' : ''); d.style.borderColor = bad ? '#e0645a' : '#2bb3a3'; d.innerHTML = `<div><span style="font-size:15px;color:#fff">${esc(text)}</span></div>`;
  d.onclick = () => d.remove(); box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), 7000);
  if (bad) Snd.bad(); else Snd.ding(false);
}
function refreshAct(force) {
  const box = $('#act'); const id = G.nearId;
  if (!G.st || !id || !$('#ov').classList.contains('hidden')) { box.classList.add('hidden'); return; }
  if (id.startsWith('npc:')) {
    const s = C.suspects.find(x => x.id === id.slice(4)); if (!s) return box.classList.add('hidden');
    box.innerHTML = `<h3>🧑 ${esc(s.name)}<small style="color:var(--dim);font-weight:400">（${esc(s.role)}）</small></h3><p>封鎖線外的關係人。兇手可能就是其中一位。</p><div class="btns"><button class="pri" data-person="${s.id}">💬 問話・查看資料（免費）</button></div>`;
    box.classList.remove('hidden'); return;
  }
  const o = ENG.objById(C, id); if (!o) return box.classList.add('hidden');
  if (o.van) {
    box.innerHTML = `<h3>🚐 ${esc(o.name)}</h3><p>${esc(o.desc)}</p><div class="btns"><button class="pri" data-van="1">🚐 打開鑑識車（換裝備／分析／送驗）</button></div>`;
    box.classList.remove('hidden'); return;
  }
  const opts = ENG.options(C, G.st, G.me, o.id); const done = G.st.obj[o.id];
  const tam = done.f && (done.f.tampered || done.f.contam) ? `<span class="why">⚠️ ${done.f.tampered ? '有人動過這裡' : '被菜鳥員警碰過'}</span>` : '';
  box.innerHTML = `<h3>${esc(o.name)} ${tam}</h3><p>${esc(o.desc || '')}</p><div class="btns">${opts.map(x => `<button data-k="${x.kind}" data-a="${x.id}" ${x.why ? 'disabled' : ''}>${x.emoji || ''} ${esc(x.label)} <span class="cost">-${x.ap}</span>${x.why ? `<span class="why">${esc(x.why)}</span>` : ''}</button>`).join('') || (o.deco ? '' : '<span class="note">這裡沒有可以做的事了</span>')}</div>`;
  box.dataset.obj = o.id; box.classList.remove('hidden');
}
$('#act').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.van) return openVan();
  if (b.dataset.person) return openPerson(b.dataset.person);
  const obj = $('#act').dataset.obj; const k = b.dataset.k;
  doAct(k === 'use' ? { type: 'use', obj, act: b.dataset.a } : { type: k, obj });
});

/* ================= 視窗 ================= */
function openOv(kind, html, cls, rer) { G.ovKind = kind; G.ovRender = rer || null; const w = $('#win'); w.className = 'win ' + (cls || ''); w.innerHTML = html; $('#ov').classList.remove('hidden'); $('#act').classList.add('hidden'); }
function closeOv() { $('#ov').classList.add('hidden'); G.ovKind = null; G.ovRender = null; refreshAct(); }
$('#ov').addEventListener('click', e => { if (e.target.id === 'ov' && G.ovKind !== 'deduce' && G.ovKind !== 'result') closeOv(); const c = e.target.closest('[data-close]'); if (c) closeOv(); });
const hdr = (t, noClose) => `<header><h2>${t}</h2>${noClose ? '' : '<button data-close="1">✕</button>'}</header>`;
const evRow = f => { const e = C.evidence[f.id]; return `<div class="ev"><img src="${url(e.icon)}" alt=""><div><b>${esc(e.name)}</b><span>${esc(e.text)}</span><br><small>#${f.n}・${f.by == null ? '現場觀察' : esc(pname(f.by))}</small></div></div>`; };
function suspectCard(s, pick) {
  const st = G.st; const on = pick && st.draft.culprit === s.id; const n = (st.npcs || []).find(q => q.id === s.id);
  return `<div class="su ${pick ? 'pick' : ''} ${on ? 'on' : ''}" ${pick ? `data-cul="${s.id}"` : ''}><img src="${url(s.img)}" alt=""><div><b>${esc(s.name)}</b>（${esc(s.role)}）${n && n.mode === 'gone' ? ' <span class="tag off">已逃離</span>' : n && n.mode === 'held' ? ' <span class="tag host">被攔下</span>' : ''}<q>${esc(s.say)}</q>
    <span style="color:var(--dim)">警方建檔：</span>鞋 ${s.shoe} 號・${s.blood} 型・慣用${s.hand === 'R' ? '右' : '左'}手・指紋 ${s.print}</div></div>`;
}
function openBriefing() {
  const html = hdr('📋 案件簡報・' + esc(C.diffName)) + `<div class="body"><div class="ev"><img src="${url(C.victim.img)}" alt="" style="width:84px;height:84px"><div><b>死者：${esc(C.victim.name)}（${C.victim.age}）</b><span>${esc(C.victim.note)}</span></div></div>
    ${C.briefing.map(t => `<p style="line-height:1.7">${esc(t)}</p>`).join('')}
    <h4>怎麼玩</h4><div class="note" style="font-size:14px">
    1. 先到<b>鑑識車</b>選最多 ${C.carryTools} 件工具（第一次免費，之後每換一次 -${C.gearSwapAP} 點）。<br>
    2. 在現場對發光的「!」物件用工具：每個動作扣<b>自己</b>的行動點數，數字寫在按鈕上。<br>
    3. 血液、指紋、鞋印樣本要拿回車上用離心機／比對電腦分析；難判斷的證物交給快遞員小吳送實驗室（全隊再花 ${C.labDelay} 點才回來）。<br>
    4. 打開筆記本的<b>鑑識手冊</b>：每種行兇方式有 3 個特徵，像排除法一樣縮小範圍。<br>
    5. 小心：證據會隨時間劣化、分局長有時限、菜鳥員警會闖進來搗亂（走過去攔住他）、兇手會偷偷動證物或想逃跑（靠近就攔得住）。<br>
    6. 全隊點數用完、時限到，或房主按「⚖️ 結案推理」，就要指認兇手、行兇方式、兇器和第一現場。</div>
    <h4>關係人</h4><div class="sus">${C.suspects.map(s => suspectCard(s)).join('')}</div></div>
    <footer><button class="pri" data-close="1">🚐 前往鑑識車選裝備</button></footer>`;
  openOv('brief', html);
}
function openPerson(id) {
  const s = C.suspects.find(x => x.id === id); if (!s) return;
  openOv('person', hdr('🧑 ' + esc(s.name)) + `<div class="body"><div class="sus" style="grid-template-columns:1fr">${suspectCard(s)}</div><p class="note">兇手如果被你們撞見偷動證物、被攔下逃跑，筆記本會記下「可疑舉動」。</p></div><footer><button data-close="1">關閉</button></footer>`);
}
let vanSel = null;
function openVan() {
  const p = meP(); if (!p) return; vanSel = null;
  const draw = () => {
    const p = meP(); const near = ENG.nearVan(C, p); if (vanSel === null) vanSel = p.tools.slice();
    const same = vanSel.length === p.tools.length && vanSel.every(t => p.tools.includes(t));
    const cost = p.loaded ? C.gearSwapAP : 0;
    const html = hdr('🚐 行動鑑識車') + `<div class="body" style="--vanbg:url(${url('van_interior')})">
      ${near ? '' : '<p class="why" style="font-size:14px">⚠️ 你離車子太遠了，走回車旁才能操作。</p>'}
      <h4>🧰 裝備架（最多帶 ${C.carryTools} 件・${p.loaded ? `更換 -${cost} 點` : '第一次免費'}）</h4>
      <div class="grid">${C.tools.map(t => `<div class="tc ${vanSel.includes(t.id) ? 'on' : ''}" data-tool="${t.id}"><img src="${url(t.icon)}" alt=""><b>${t.emoji} ${esc(t.name)}</b><small>${esc(t.desc)}</small></div>`).join('')}</div>
      <div class="row"><button class="pri" id="gearOk" ${same || !near || !vanSel.length ? 'disabled' : ''}>✅ 確認裝備${cost && !same ? `（-${cost}）` : ''}</button><span class="note">已選 ${vanSel.length}/${C.carryTools}</span></div>
      <h4>🔬 車上設備（樣本要由採集的人帶回來）</h4>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${C.machines.map(m => { const ss = p.samples.filter(s => s.kind === m.kind);
        return `<div class="mc"><div class="hd"><img src="${url(m.icon)}" alt="">${esc(m.name)}</div>${ss.length ? ss.map(s => `<div class="it"><span class="grow">🧫 ${esc(s.label)}</span><button data-an="${s.sid}" ${near && p.ap >= m.ap ? '' : 'disabled'}>分析 <span class="cost">-${m.ap}</span></button>${s.lab ? `<button data-slab="${s.sid}" ${near && p.ap >= C.sampleLabAP ? '' : 'disabled'}>送實驗室 DNA <span class="cost">-${C.sampleLabAP}</span></button>` : ''}</div>`).join('') : '<span class="note">沒有這類樣本</span>'}</div>`; }).join('')}</div>
      <h4>🛵 實驗室快遞員・小吳</h4>
      <div class="mc">${p.bag.length ? p.bag.map(b => `<div class="it"><img src="${url(b.img)}" alt="" style="width:36px;height:36px"><span class="grow">${esc(b.name)}${b.size > 1 ? '（大型）' : ''}</span><button data-lab="${b.obj}" ${near && p.ap >= C.labCost[b.size] ? '' : 'disabled'}>送實驗室 <span class="cost">-${C.labCost[b.size]}</span></button></div>`).join('') : '<span class="note">證物袋是空的。在現場把證物「裝袋」帶回來，或請小吳到現場取件。</span>'}
      <div class="note">送驗後，全隊再花 ${C.labDelay + (G.st.labExtra || 0)} 點，報告才會回來${G.st.labExtra ? '（小吳被調走，延遲變長了）' : ''}。</div>
      ${G.st.labs.map(l => `<div class="it">${l.back ? '✅' : '⏳'} ${esc(l.label)}：${l.back ? '報告已回來' : `再 ${Math.max(0, l.due - G.st.spent)} 點`}</div>`).join('')}</div>
      </div><footer><span class="note" style="flex:1">⚡ 你還有 ${p.ap} 點</span><button data-close="1">關閉</button></footer>`;
    const sc = $('#win .body') ? $('#win .body').scrollTop : 0;
    openOv('van', html, 'van', draw); const b = $('#win .body'); if (b) b.scrollTop = sc;
  };
  draw();
}
$('#win').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]'); if (t && G.ovKind === 'van') { const id = t.dataset.tool; if (vanSel.includes(id)) vanSel = vanSel.filter(x => x !== id); else if (vanSel.length < C.carryTools) vanSel.push(id); else { vanSel.shift(); vanSel.push(id); } G.ovRender(); return; }
  if (e.target.closest('#gearOk')) { doAct({ type: 'gear', tools: vanSel }); vanSel = null; return; }
  const an = e.target.closest('[data-an]'); if (an) return doAct({ type: 'analyze', sid: +an.dataset.an });
  const sl = e.target.closest('[data-slab]'); if (sl) return doAct({ type: 'slab', sid: +sl.dataset.slab });
  const lb = e.target.closest('[data-lab]'); if (lb) return doAct({ type: 'lab', obj: lb.dataset.lab });
  const tb = e.target.closest('[data-tab]'); if (tb) { noteTab = tb.dataset.tab; G.ovRender(); return; }
  const cu = e.target.closest('[data-cul]'); if (cu) return doAct({ type: 'draft', field: 'culprit', v: cu.dataset.cul });
  const df = e.target.closest('[data-df]'); if (df) return doAct({ type: 'draft', field: df.dataset.df, v: df.dataset.v });
  const kk = e.target.closest('[data-key]'); if (kk) { const k = G.st.draft.keys.slice(); const i = k.indexOf(kk.dataset.key); if (i >= 0) k.splice(i, 1); else if (k.length < 3) k.push(kk.dataset.key); else return toast('關鍵證據最多選 3 項', true); return doAct({ type: 'draft', field: 'keys', v: k }); }
  if (e.target.closest('#submit')) { if (confirm('確定送出推理報告？')) doAct({ type: 'submit' }); return; }
  if (e.target.closest('#again')) { if (G.mode === 'solo') { LS.del('fs_solo'); startSolo(false); } else Net.send({ t: 'again' }); return; }
  if (e.target.closest('#home2')) { if (G.mode === 'solo') { LS.del('fs_solo'); backHome(); } else Net.send({ t: 'leave' }); return; }
});
let noteTab = 'ev';
function manualHtml() {
  const d = ENG.deduce(C, G.st);
  const rows = C.methods.map(m => `<tr><td><b>${esc(m.t)}</b>${d.methods.includes(m.id) ? '' : ' <span class="ng">✖ 排除</span>'}</td>${m.sigs.map(s => `<td class="${d.sig.includes(s) ? 'ok' : d.neg.includes(s) ? 'ng' : ''}">${d.sig.includes(s) ? '✔ ' : d.neg.includes(s) ? '✖ ' : ''}${esc(C.sigs[s].t)}<br><small style="color:var(--dim)">${esc(C.sigs[s].how)}</small></td>`).join('')}</tr>`).join('');
  return `<p class="note">每種行兇方式都會留下 3 個鑑識特徵。✔＝已確認、✖＝已排除（自動依你們找到的證據更新；誘餌線索不會算進來，但你得自己判斷）。</p>
    <div style="overflow:auto"><table style="width:100%;border-collapse:collapse;font-size:13px" class="man">${rows}</table></div>
    <h4>目前推論</h4><div class="note" style="font-size:14px">可能的手法：${d.methods.map(id => esc(C.methods.find(m => m.id === id).t)).join('、') || '（矛盾，請檢查誘餌）'}<br>
    符合特徵的關係人：${d.suspects.map(id => esc(C.suspects.find(s => s.id === id).name)).join('、')}${d.weapon ? `<br>兇器：${esc(C.weapons.find(w => w.id === d.weapon).t)}` : ''}${d.location ? `<br>第一現場：${esc(C.roomName[d.location])}` : ''}</div>`;
}
function openNote() {
  if (!G.st) return;
  const draw = () => {
    const st = G.st; const tabs = [['ev', `🔎 證據（${st.found.length}）`], ['man', '📖 鑑識手冊'], ['sus', '🧑 關係人'], ['log', '📰 現場動態'], ['brief', '📋 案情']];
    let body = '';
    if (noteTab === 'ev') body = st.found.length ? `<div class="evl">${st.found.slice().reverse().map(evRow).join('')}</div>` : '<p class="note">還沒有找到任何證據。</p>';
    else if (noteTab === 'man') body = manualHtml();
    else if (noteTab === 'sus') body = `<div class="sus">${C.suspects.map(s => suspectCard(s)).join('')}</div>`;
    else if (noteTab === 'log') body = (st.news || []).length ? st.news.slice().reverse().map(n => `<div class="it" style="margin:6px 0">⏱ ${mmss(n.t)}　${esc(n.text)}</div>`).join('') : '<p class="note">目前沒有特別狀況。</p>';
    else body = `<div class="ev"><img src="${url(C.victim.img)}" alt="" style="width:72px;height:72px"><div><b>死者：${esc(C.victim.name)}</b><span>${esc(C.victim.note)}</span></div></div>${C.briefing.map(t => `<p style="line-height:1.7">${esc(t)}</p>`).join('')}
      <h4>分局長的要求</h4>${C.pressure.milestones.map(m => `<div class="it">${st.ms[m.id] === 'ok' ? '✅' : st.ms[m.id] === 'fail' ? '❌' : '⏳'} ${mmss(m.at)} 前：${esc(m.t)}${m.okT ? `（達成：${esc(m.okT)}）` : ''}　失敗：${esc(m.failT)}</div>`).join('')}`;
    const sc = $('#win .body') && G.ovKind === 'note' ? $('#win .body').scrollTop : 0;
    openOv('note', hdr('📒 筆記本') + `<div class="body"><div class="tabs">${tabs.map(([k, t]) => `<button data-tab="${k}" class="${noteTab === k ? 'on' : ''}">${t}</button>`).join('')}</div><div style="margin-top:10px">${body}</div></div>`, '', draw);
    const b = $('#win .body'); if (b) b.scrollTop = sc;
  };
  draw();
}
function openDeduce() {
  const draw = () => {
    const st = G.st, D = st.draft; if (!st || st.phase !== 'deduce') return;
    const opt = (field, list) => `<div class="opts">${list.map(x => `<button data-df="${field}" data-v="${x.id}" class="${D[field] === x.id ? 'on' : ''}">${esc(x.t)}</button>`).join('')}</div>`;
    const html = hdr('⚖️ 結案推理報告', true) + `<div class="body">
      <p class="note">${G.mode === 'online' ? '大家可以一起改這份報告（即時同步），最後由房主送出。' : '填好後送出。'}點數已經不能再用了；可以打開「鑑識手冊」分頁對照。</p>
      <details><summary style="cursor:pointer;color:var(--amber)">📖 打開鑑識手冊／目前推論</summary>${manualHtml()}</details>
      <h4>1. 兇手是誰？（40 分）</h4><div class="sus">${C.suspects.map(s => suspectCard(s, true)).join('')}</div>
      <h4>2. 行兇方式（20 分）</h4>${opt('method', C.methods)}
      <h4>3. 兇器（15 分）</h4>${opt('weapon', C.weapons)}
      <h4>4. 第一現場（10 分）</h4>${opt('location', C.locations)}
      <h4>5. 關鍵證據（最多 3 項，最多 15 分）</h4>
      <div class="evl">${st.found.map(f => { const e = C.evidence[f.id]; const on = D.keys.includes(f.id); return `<div class="ev" data-key="${f.id}" style="cursor:pointer;${on ? 'border-color:var(--amber);background:#3d3012' : ''}"><img src="${url(e.icon)}" alt=""><div><b>${on ? '☑' : '☐'} ${esc(e.name)}</b><span>${esc(e.text)}</span></div></div>`; }).join('') || '<p class="note">沒有找到證據……只能憑直覺了。</p>'}</div>
      </div><footer>${isHost() ? `<button class="pri" id="submit" ${D.culprit && D.method && D.weapon && D.location ? '' : 'disabled'}>📨 送出推理報告</button>` : '<span class="note">等房主送出…</span>'}</footer>`;
    const sc = $('#win .body') && G.ovKind === 'deduce' ? $('#win .body').scrollTop : 0; const open = $('#win details') && $('#win details').open;
    openOv('deduce', html, '', draw); const b = $('#win .body'); if (b) b.scrollTop = sc; if (open) $('#win details').open = true;
  };
  draw();
}
function openResult() {
  const R = G.st.result; if (!R) return;
  const html = hdr('📁 結案報告', true) + `<div class="body res"><div class="rank">${R.rank}</div><p style="text-align:center;font-size:20px;margin:4px 0 12px">${R.total} 分</p>
    <table>${R.rows.map(r => `<tr><td>${r.label}</td><td class="${r.ok ? 'ok' : 'ng'}">${r.ok ? '✔' : '✖'} ${esc(r.pick)}${r.ok ? '' : `<br><small>正解：${esc(r.right)}</small>`}</td><td style="text-align:right">${r.pts}/${r.max}</td></tr>`).join('')}
    <tr><td>關鍵證據</td><td>${R.keys.map(k => `${esc(k.name)}（+${k.pts}）`).join('<br>') || '—'}</td><td style="text-align:right">${R.keyPts}/15</td></tr>
    ${R.pen ? `<tr><td>兇手逃離</td><td class="ng">讓兇手離開了現場</td><td style="text-align:right">${R.pen}</td></tr>` : ''}</table>
    <p class="note">找到 ${R.found} 項證據・花了 ${R.spent} 點・調查 ${mmss(R.clock)}・分局長要求：${Object.values(R.ms).filter(x => x === 'ok').length} 達成／${Object.values(R.ms).filter(x => x === 'fail').length} 失敗</p>
    <h4>🔍 真相</h4><div class="truth">${C.truth.map(t => `<p>${esc(t)}</p>`).join('')}</div></div>
    <footer>${G.mode === 'solo' ? '<button id="home2">🏠 回首頁</button><button class="pri" id="again">🔁 下一個案件</button>' : (isHost() ? '<button id="home2">🚪 離開房間</button><button class="pri" id="again">🔁 回房間開新案件</button>' : '<button id="home2">🚪 離開房間</button><span class="note">等房主開新案件…</span>')}</footer>`;
  openOv('result', html);
}
$('#bNote').onclick = () => openNote();
$('#bClose').onclick = () => { if (confirm('提早結案？剩下的行動點數就不能用了，直接進入推理。')) doAct({ type: 'close' }); };
$('#bMenu').onclick = () => {
  openOv('menu', hdr('☰ 選單') + `<div class="body"><div class="opts">
    <button data-m="brief">📋 案件簡報與玩法</button>
    ${G.mode === 'solo' ? '<button data-m="home">🏠 回首頁（進度會保存）</button>' : `<button data-m="leave">🚪 離開房間（點數分給隊友）</button>${G.host ? '<button data-m="dissolve" class="warn">💥 解散房間</button>' : ''}`}
    </div><p class="note">案件編號 #${C.seed}・難度 ${esc(C.diffName)}</p></div>`);
};
$('#win').addEventListener('click', e => {
  const m = e.target.closest('[data-m]'); if (!m) return; const k = m.dataset.m;
  if (k === 'brief') openBriefing();
  if (k === 'home') { saveSolo(); backHome(); }
  if (k === 'leave' && confirm('確定離開房間？')) Net.send({ t: 'leave' });
  if (k === 'dissolve' && confirm('確定解散房間？')) Net.send({ t: 'dissolve' });
});

/* ================= 聊天 ================= */
const QUICK = ['我去車上', '來這邊幫忙', '我攔菜鳥', '盯住關係人', '我送實驗室', '這是誘餌', '準備結案', '收到'];
const Chat = {
  unread: 0,
  toggle() { $('#chat').classList.toggle('hidden'); if (!$('#chat').classList.contains('hidden')) { this.unread = 0; this.badge(); } },
  open() { $('#chat').classList.remove('hidden'); this.unread = 0; this.badge(); $('#chatIn').focus(); },
  add(slot, name, text) {
    const log = $('#chatLog'); const d = document.createElement('div'); d.innerHTML = `<b style="color:${AGENT_COL[(G.room && G.room.players[slot] ? G.room.players[slot].ci : 0)]}">${esc(name)}</b>：${esc(text)}`; log.appendChild(d); log.scrollTop = log.scrollHeight;
    while (log.children.length > 80) log.firstChild.remove();
    G.bubbles[slot] = { text, until: performance.now() + 4500 };
    if ($('#chat').classList.contains('hidden')) { this.unread++; this.badge(); }
  },
  badge() { const t = this.unread ? `💬<span class="lbl">聊天</span> (${this.unread})` : '💬<span class="lbl">聊天</span>'; $('#bChat').innerHTML = t; $('#rmChat').textContent = this.unread ? `💬 聊天 (${this.unread})` : '💬 聊天'; }
};
$('#quick').innerHTML = QUICK.map(q => `<button type="button">${q}</button>`).join('');
$('#quick').onclick = e => { const b = e.target.closest('button'); if (b) Net.send({ t: 'chat', text: b.textContent }); };
$('#chatForm').onsubmit = e => { e.preventDefault(); const v = $('#chatIn').value.trim(); if (!v) return; Net.send({ t: 'chat', text: v }); $('#chatIn').value = ''; };
$('#bChat').onclick = () => Chat.toggle();

/* ================= 語音通話（WebRTC 點對點，做法和麻將相同；伺服器只轉送信令） ================= */
const VOICE_STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const IceCfg = {
  v: null, at: 0,
  url() { try { const u = new URL(SERVER_WS.replace(/^ws/, 'http')); u.pathname = u.pathname.replace(/\/ws$/, '') + '/ice'; u.search = ''; return u.href; } catch (e) { return null; } },
  async get() {
    if (window.FS_ICE) return { iceServers: window.FS_ICE, provider: 'test' };
    if (this.v && Date.now() - this.at < 30 * 60 * 1000) return this.v;
    try { const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 6000); const r = await fetch(this.url(), { signal: ctl.signal, cache: 'no-store' }); clearTimeout(t); const j = await r.json(); if (!Array.isArray(j.iceServers)) throw new Error('bad'); this.v = j; this.at = Date.now(); }
    catch (e) { this.v = { iceServers: VOICE_STUN, provider: 'stun-only', error: 'fetch' }; this.at = Date.now() - 25 * 60 * 1000; }
    return this.v;
  },
  hasRelay(v) { return !!(v && v.iceServers.some(x => [].concat(x.urls || []).some(u => /^turns?:/.test(u)))); }
};
const candType = c => { const m = /\btyp (\w+)/.exec(c || ''); return m ? m[1] : '?'; };
const Voice = {
  on: false, joining: false, stream: null, muted: false, myVid: null, myN: 0, peers: {}, meters: {}, speak: {}, KEY: 'fs_voice',
  supported() { return !!(window.isSecureContext !== false && navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.RTCPeerConnection); },
  pl(s) { return G.room && G.room.players[s]; },
  async join() {
    if (this.on || this.joining || G.mode !== 'online') return;
    if (!this.supported()) { toast(window.isSecureContext === false ? '語音需要 https 網址' : '這個瀏覽器不支援語音', true); return; }
    this.joining = true; this.render();
    try { this.stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }); }
    catch (e) { this.joining = false; this.render(); const n = e && e.name; toast(n === 'NotAllowedError' || n === 'SecurityError' ? '麥克風權限被拒絕（請到網址列旁的設定允許麥克風）' : n === 'NotFoundError' ? '找不到麥克風' : '沒有取得麥克風（' + (n || '未知錯誤') + '）', true); return; }
    this.ice = await IceCfg.get(); console.info('[voice] ICE provider:', this.ice.provider, 'TURN:', IceCfg.hasRelay(this.ice));
    this.joining = false; this.on = true; this.muted = false; try { sessionStorage.setItem(this.KEY, '1'); } catch (e) { }
    try { if (navigator.audioSession) navigator.audioSession.type = 'play-and-record'; } catch (e) { }
    Snd.init(); this.addMeter(G.me, this.stream); Net.send({ t: 'vjoin', muted: false }); toast('🎤 已加入語音'); this.render();
  },
  leave(silent) {
    for (const s of Object.keys(this.peers)) this.closePeer(+s);
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    const was = this.on; this.stream = null; this.on = false; this.joining = false; this.myVid = null; this.meters = {}; this.speak = {};
    if (!silent) { if (was) Net.send({ t: 'vleave' }); try { sessionStorage.removeItem(this.KEY); } catch (e) { } }
    try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { }
    this.render();
  },
  toggleMute() { if (!this.on) return; this.muted = !this.muted; this.stream.getAudioTracks().forEach(t => { t.enabled = !this.muted; }); Net.send({ t: 'vmute', muted: this.muted }); this.render(); },
  onJoined() { let want = false; try { want = sessionStorage.getItem(this.KEY) === '1'; } catch (e) { } if (want && !this.on) toast('點「🎤 語音」重新開啟語音'); },
  sync() {
    const r = G.room; if (!r) return; const me = r.players[G.me];
    if (this.on) {
      if (me && me.voice) { this.myVid = me.voice.id; this.myN = me.voice.n; }
      else if (this.myVid) { this.myVid = null; for (const s of Object.keys(this.peers)) this.closePeer(+s); Net.send({ t: 'vjoin', muted: this.muted }); }
    }
    for (let s = 0; s < 4; s++) {
      if (s === G.me) continue;
      const v = r.players[s] && r.players[s].voice, pe = this.peers[s];
      if (!this.on || !this.myVid || !v) { if (pe) this.closePeer(s); continue; }
      if (pe && pe.vid !== v.id) this.closePeer(s);
      if (!this.peers[s]) this.makePeer(s, v, this.myN > v.n);
    }
    this.render();
  },
  makePeer(s, v, offerer) {
    const ice = this.ice || { iceServers: VOICE_STUN, provider: 'stun-only' };
    let pc; try { pc = new RTCPeerConnection({ iceServers: ice.iceServers }); } catch (e) { return; }
    const pe = { pc, vid: v.id, state: 'connecting', q: [], audio: null, remoteSet: false, diag: { local: {}, remote: {}, relayCfg: IceCfg.hasRelay(ice), provider: ice.provider, t0: Date.now() } };
    this.peers[s] = pe; this.stream.getTracks().forEach(t => pc.addTrack(t, this.stream));
    pc.onicecandidate = e => { if (!e.candidate) return; const ty = candType(e.candidate.candidate); pe.diag.local[ty] = (pe.diag.local[ty] || 0) + 1; this.sig(s, { type: 'ice', c: e.candidate.toJSON ? e.candidate.toJSON() : e.candidate }); };
    pc.ontrack = e => {
      const st = (e.streams && e.streams[0]) || new MediaStream([e.track]);
      if (!pe.audio) { const a = document.createElement('audio'); a.autoplay = true; a.setAttribute('playsinline', ''); document.body.appendChild(a); pe.audio = a; }
      pe.audio.srcObject = st; const pl = pe.audio.play(); if (pl && pl.catch) pl.catch(() => { this.needTap = true; toast('點一下畫面開始播放語音'); });
      this.addMeter(s, st);
    };
    const upd = () => { if (this.peers[s] !== pe) return; const cs = pc.connectionState || '', is = pc.iceConnectionState || '';
      if (cs === 'connected' || is === 'connected' || is === 'completed') { pe.state = 'connected'; clearTimeout(pe.timer); }
      else if (cs === 'failed' || is === 'failed') { if (pe.state !== 'failed') { pe.state = 'failed'; this.diagnose(s, pe); } }
      this.render(); };
    pc.onconnectionstatechange = upd; pc.oniceconnectionstatechange = upd;
    pe.timer = setTimeout(() => { if (this.peers[s] === pe && pe.state !== 'connected') { pe.state = 'failed'; this.diagnose(s, pe); this.render(); } }, 25000);
    if (offerer) (async () => { try { const o = await pc.createOffer(); await pc.setLocalDescription(o); this.sig(s, { type: 'offer', sdp: pc.localDescription.sdp }); } catch (e) { pe.state = 'failed'; this.render(); } })();
  },
  sig(s, d) { const pe = this.peers[s]; if (pe) Net.send({ t: 'rtc', to: s, vid: pe.vid, d }); },
  async onSignal(m) {
    if (!this.on || !this.myVid) return;
    const s = m.from, d = m.d || {}; let pe = this.peers[s];
    if (!pe || pe.vid !== m.vid) { const v = this.pl(s) && this.pl(s).voice; if (!v || v.id !== m.vid || d.type !== 'offer') return; if (pe) this.closePeer(s); this.makePeer(s, v, false); pe = this.peers[s]; if (!pe) return; }
    const pc = pe.pc;
    try {
      if (d.type === 'offer') { await pc.setRemoteDescription({ type: 'offer', sdp: d.sdp }); pe.remoteSet = true; await this.flush(pe); const a = await pc.createAnswer(); await pc.setLocalDescription(a); this.sig(s, { type: 'answer', sdp: pc.localDescription.sdp }); }
      else if (d.type === 'answer') { if (pc.signalingState !== 'have-local-offer') return; await pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }); pe.remoteSet = true; await this.flush(pe); }
      else if (d.type === 'ice' && d.c) { const ty = candType(d.c.candidate); pe.diag.remote[ty] = (pe.diag.remote[ty] || 0) + 1; if (pe.remoteSet) await pc.addIceCandidate(d.c); else pe.q.push(d.c); }
    } catch (e) { console.warn('voice signal', e && e.message); }
  },
  diagnose(s, pe) {
    const d = pe.diag, L = d.local, R = d.remote, n = o => Object.values(o).reduce((a, b) => a + b, 0); let why;
    if (!n(R)) why = '沒收到對方的連線資訊'; else if (!L.srflx && !L.relay) why = '你的網路擋住了語音（可能是公司防火牆）'; else if (!d.relayCfg) why = '雙方無法直連，而且沒有中繼伺服器'; else if (!L.relay && !R.relay) why = '中繼伺服器也連不上'; else why = '雙方網路無法互通';
    pe.why = why; console.warn('[voice] 連線失敗', JSON.stringify({ slot: s, why, provider: d.provider, local: L, remote: R }));
    toast(`${(this.pl(s) || {}).name || ''} 語音連線失敗：${why}（點隊友旁的 ⚠️ 重試）`, true);
  },
  retry() { if (!this.on) return; for (const k of Object.keys(this.peers)) this.closePeer(+k); this.myVid = null; IceCfg.v = null; IceCfg.get().then(v => { this.ice = v; Net.send({ t: 'vjoin', muted: this.muted }); }); toast('重新連線語音…'); },
  async flush(pe) { for (const c of pe.q.splice(0)) { try { await pe.pc.addIceCandidate(c); } catch (e) { } } },
  closePeer(s) { const pe = this.peers[s]; if (!pe) return; delete this.peers[s]; clearTimeout(pe.timer); try { pe.pc.close(); } catch (e) { } if (pe.audio) { try { pe.audio.srcObject = null; } catch (e) { } pe.audio.remove(); } const mt = this.meters[s]; if (mt) { try { mt.src.disconnect(); } catch (e) { } delete this.meters[s]; } delete this.speak[s]; },
  addMeter(s, stream) { const c = Snd.ctx; if (!c || !stream.getAudioTracks().length) return; try { const src = c.createMediaStreamSource(stream), an = c.createAnalyser(); an.fftSize = 512; src.connect(an); this.meters[s] = { src, an, buf: new Uint8Array(512), hold: 0 }; } catch (e) { } },
  tick() {
    const now = Date.now();
    for (const k of Object.keys(this.meters)) { const s = +k, m = this.meters[k]; m.an.getByteTimeDomainData(m.buf); let sum = 0; for (let i = 0; i < m.buf.length; i++) { const x = (m.buf[i] - 128) / 128; sum += x * x; } if (Math.sqrt(sum / m.buf.length) > .035) m.hold = now + 350; let sp = m.hold > now; if (s === G.me && this.muted) sp = false; const v = this.pl(s) && this.pl(s).voice; if (s !== G.me && v && v.muted) sp = false; this.speak[s] = sp; }
  },
  badge(s) {
    if (G.mode !== 'online') return ''; const v = this.pl(s) && this.pl(s).voice; if (!v) return '';
    const pe = this.peers[s];
    if (s !== G.me && this.on && pe && pe.state === 'failed') return `<span class="vcBadge failed" data-vretry="1" title="${esc(pe.why || '')}">⚠️</span>`;
    return `<span class="vcBadge">${v.muted ? '🔇' : this.speak[s] ? '🗣️' : '🎤'}</span>`;
  },
  render() {
    const on = G.mode === 'online' && !!G.room;
    $('#bVc').classList.toggle('hidden', !on || this.on); $('#bVc').disabled = this.joining;
    $('#bVcMute').classList.toggle('hidden', !on || !this.on); $('#bVcMute').innerHTML = this.muted ? '🔇<span class="lbl">取消靜音</span>' : '🎙️<span class="lbl">靜音</span>';
    $('#bVcLeave').classList.toggle('hidden', !on || !this.on);
    $('#rmVoice').textContent = this.on ? '📴 離開語音' : this.joining ? '🎤 連線中…' : '🎤 加入語音';
  }
};
$('#bVc').onclick = () => Voice.join(); $('#bVcMute').onclick = () => Voice.toggleMute(); $('#bVcLeave').onclick = () => Voice.leave();
$('#team').addEventListener('click', e => { if (e.target.closest('[data-vretry]')) Voice.retry(); });
setInterval(() => { try { Voice.tick(); } catch (e) { } }, 150);
document.addEventListener('pointerdown', () => { if (!Voice.needTap) return; Voice.needTap = false; for (const pe of Object.values(Voice.peers)) if (pe.audio) pe.audio.play().catch(() => { }); }, { passive: true });
addEventListener('pagehide', () => { if (Voice.on) Voice.leave(true); saveSolo(); });

/* ================= 啟動 ================= */
loadAssets().then(() => { initHome(); requestAnimationFrame(loop); if (/autosolo/.test(location.hash)) startSolo(false); });
window.__fs = { G, get C() { return C; }, ENG, doAct, openVan, openNote, openDeduce, refresh };
