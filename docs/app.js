'use strict';
/* 鑑識現場 — 前端（單機模式直接跑 engine.js；連線模式由伺服器權威） */
let C = null; const GEN = window.FS_GEN, A = window.FS_ASSETS, ENG = window.FS;
const VER = '7';
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const CH = 112;   // 比例尺：成年角色身高 H（與 casegen H_REF 一致）
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
const G = { mode: null, st: null, me: 0, room: null, code: null, token: null, host: false, view: {}, Me: { x: 0, y: 0, dir: 1, moving: false, ang: 0 }, path: null, autoOpen: null, nearId: null, bubbles: {}, fx: [], floats: [], briefed: false, seen: new Set(), glinted: new Set(), tut: null };
const isHost = () => G.mode === 'solo' || G.host;
const meP = () => G.st && G.st.players[G.me];

function toast(msg, bad) {
  const box = $('#toasts'); const d = document.createElement('div'); d.className = 'toast' + (bad ? ' bad' : ''); d.textContent = msg; box.appendChild(d);
  while (box.children.length > 5) box.firstChild.remove();
  setTimeout(() => d.remove(), bad ? 4000 : 5500);
}
function card(id, lab) {
  const e = C.evidence[id]; if (!e) return;
  if (lab) return resultCard({ img: e.icon, kicker: '📨 實驗室報告回來了', big: e.name, text: e.text, where: whereEv(id), lab: true });
  const box = $('#cards'); const d = document.createElement('div'); d.className = 'evc soft';
  d.innerHTML = `<img src="${url(e.icon)}" alt=""><div><em>${lab ? '📨 實驗室報告回來了' : '🔎 新證據'}・已記錄到筆記本</em><b>${esc(e.name)}</b><span>${esc(e.text)}</span></div>`;
  d.onclick = () => d.remove(); box.appendChild(d);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => d.remove(), lab ? 11000 : 8000);
  Snd.ding(lab);
}
/* 大結果卡：自己用完工具，立刻看到「發現了什麼」和「之後去哪裡找」 */
function whereEv(id) { const f = G.st.found.find(x => x.id === id); return `📒 已記到筆記本「證據」第 ${f ? f.n : '?'} 項（標著<span class="newb">新</span>）`; }
function resultCard(o) {
  const box = $('#cards'); const d = document.createElement('div'); d.className = 'evc rc' + (o.lab ? ' lab' : '');
  d.innerHTML = `<div class="rh"><img src="${url(o.img)}" alt=""><div><em>${esc(o.kicker || '🔎 結果')}</em><div class="big">${esc(o.big)}</div><span>${esc(o.text || '')}</span></div></div>${o.where ? `<div class="where ${o.wait ? 'wait' : ''}">${o.where}</div>` : ''}`;
  d.onclick = () => d.remove(); box.appendChild(d);
  while (box.children.length > 2) box.firstChild.remove();
  setTimeout(() => d.remove(), o.lab ? 12000 : 9000);
  Snd.ding(o.lab);
}
const MACHINE_OF = { print: '指紋比對電腦', blood: '離心機', shoe: '鞋印資料庫' };
function myActionCard(evs) {
  const use = evs.find(e => e.k === 'use' && e.by === G.me), found = evs.filter(e => e.k === 'found' && e.by === G.me && !evs.some(x => x.k === 'lab_back' && x.id === e.id));
  const smp = evs.find(e => e.k === 'sample' && e.by === G.me), an = evs.find(e => e.k === 'analyze' && e.by === G.me);
  const bag = evs.find(e => e.k === 'bag' && e.by === G.me), sent = evs.find(e => e.k === 'lab_sent' && e.by === G.me);
  const o = use && ENG.objById(C, use.obj);
  if (found.length) {
    const e = C.evidence[found[0].id];
    resultCard({ img: e.icon, kicker: an ? `🔬 車上分析結果（${an.label}）` : `🔎 ${use ? use.label : '新發現'}${o ? '・' + o.name : ''}`, big: e.name, text: e.text + (found.length > 1 ? `（另外還有 ${found.length - 1} 項）` : ''), where: whereEv(found[0].id) });
    if (o) G.floats.push({ x: o.x, y: o.y - (o.flat ? 10 : o.h), text: e.name.replace(/^.*：/, ''), t: performance.now() });
    return true;
  }
  if (smp) { const t = C.tools.find(x => x.id === (use && use.tool)); resultCard({ img: t ? t.icon : 'ev_print', kicker: `🧫 ${use ? use.label : '採樣'}${o ? '・' + o.name : ''}`, big: '採到樣本：' + smp.label, text: '現在還不知道是誰的、什麼結果。', where: `⏳ 樣本在你身上（下方工具列 🧫）→ 回<b>鑑識車</b>用「${MACHINE_OF[smp.kind] || '設備'}」分析，結果會再跳出來`, wait: true }); return true; }
  if (use && use.tool === 'luminol') { resultCard({ img: 'tool_luminol', kicker: `🧪 噴好魯米諾・${o.name}`, big: use.lit ? '燈太亮，看不出有沒有螢光' : (use.reveal ? '黑暗中浮出藍色螢光！' : '暗處看起來沒有螢光'), text: use.lit ? '魯米諾的藍光很弱，要在暗處才看得到。' : '', where: use.lit ? `💡 請隊友（或自己）去關掉<b>${C.roomName[o.room]}的電燈開關</b>，再按「記錄螢光位置」` : '👉 接著按「記錄螢光位置」把結果記進筆記本', wait: true }); if (use.reveal) G.fx.push({ x: o.x, y: o.y, t: performance.now(), kind: 'spray' }); return true; }
  if (bag) { const ob = ENG.objById(C, bag.obj); resultCard({ img: ob ? ob.img : 'ev_lab', kicker: '🛍️ 裝進證物袋', big: bag.name, text: '證物袋在下方工具列。', where: '⏳ 拿回<b>鑑識車</b>交給快遞員小吳送實驗室，報告回來會再跳出結果卡', wait: true }); return true; }
  if (sent) { resultCard({ img: 'ev_lab', kicker: '🛵 交給小吳送實驗室', big: sent.name, text: '', where: `⏳ 實驗室額度 -${sent.cost}，約 ${C.labSec} 秒後報告回來（左上「待處理」看得到）`, wait: true }); return true; }
  if (use) { resultCard({ img: 'ev_photo', kicker: `🔎 ${use.label}・${o.name}`, big: '沒有新發現', text: '', where: '' }); return true; }
  return false;
}
const pname = pid => { const p = G.st && G.st.players[pid]; return p ? (pid === G.me ? '你' : p.name) : '隊友'; };

/* ---------- 音效（Web Audio 合成，不需要檔案） ---------- */
const Snd = {
  ctx: null,
  init() { try { this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state !== 'running') this.ctx.resume(); if (G.st) this.startAmb(); } catch (e) { } },
  tone(f, d, type, v, when) { const c = this.ctx; if (!c) return; const t = c.currentTime + (when || 0); const o = c.createOscillator(), g = c.createGain(); o.type = type || 'sine'; o.frequency.value = f; g.gain.setValueAtTime(v || .08, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .02); },
  ding(lab) { if (lab) { this.tone(660, .25, 'triangle', .1); this.tone(880, .3, 'triangle', .1, .12); this.tone(1320, .4, 'triangle', .08, .24); } else { this.tone(880, .2, 'sine', .08); this.tone(1175, .3, 'sine', .07, .08); } },
  spray() { const c = this.ctx; if (!c) return; const n = c.sampleRate * .35, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n); const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 3000; g.gain.value = .12; s.buffer = b; s.connect(f).connect(g).connect(c.destination); s.start(); },
  click() { this.tone(520, .06, 'square', .03); },
  bad() { this.tone(200, .18, 'sawtooth', .04); },
  soft() { this.tone(392, .7, 'triangle', .035); this.tone(523, .9, 'triangle', .025, .2); },      // 插曲：輕柔提示，不是警報
  low() { this.tone(196, .9, 'sine', .04); this.tone(185, 1.1, 'sine', .03, .25); },
  glint() { this.tone(1568, .5, 'sine', .018); this.tone(2349, .8, 'sine', .01, .07); },         // 走近／照到證物時的細微閃光聲
  sw() { this.tone(1800, .03, 'square', .03); this.tone(900, .04, 'square', .02, .03); },
  /* 環境音：雨聲、冰箱嗡嗡聲、低頻底噪、偶爾的木頭嘎吱聲與遠處狗叫（全部即時合成） */
  ambOn: LS.get('fs_amb', '1') === '1', amb: null,
  startAmb() {
    const c = this.ctx; if (!c || this.amb || !this.ambOn) return;
    const out = c.createGain(); out.gain.value = 0; out.connect(c.destination); out.gain.linearRampToValueAtTime(1, c.currentTime + 3);
    const n = c.sampleRate * 3, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let l = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; l = (l + .03 * w) / 1.03; d[i] = w * .5 + l * 2.5 + (Math.random() < .0006 ? (Math.random() - .5) * 3 : 0); }
    const rain = c.createBufferSource(); rain.buffer = b; rain.loop = true; const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500; const rg = c.createGain(); rg.gain.value = .02; rain.connect(lp).connect(rg).connect(out); rain.start();
    const h1 = c.createOscillator(), h2 = c.createOscillator(), hg = c.createGain(); h1.frequency.value = 59; h2.frequency.value = 118; h2.type = 'triangle'; hg.gain.value = 0; h1.connect(hg); h2.connect(hg); hg.connect(out); h1.start(); h2.start();
    const d1 = c.createOscillator(), d2 = c.createOscillator(), dg = c.createGain(); d1.frequency.value = 55; d2.frequency.value = 55.6; dg.gain.value = .007; d1.connect(dg); d2.connect(dg); dg.connect(out); d1.start(); d2.start();
    this.amb = { out, rg, hg, nodes: [rain, h1, h2, d1, d2], creak: c.currentTime + 12 + Math.random() * 15, dog: c.currentTime + 30 + Math.random() * 30 };
  },
  stopAmb() { if (!this.amb) return; for (const n of this.amb.nodes) try { n.stop(); } catch (e) { } try { this.amb.out.disconnect(); } catch (e) { } this.amb = null; },
  ambTick() {
    const a = this.amb, c = this.ctx; if (!a || !c || !G.st || !C) return; const t = c.currentTime;
    a.rg.gain.setTargetAtTime(G.st.flags && G.st.flags.rain ? .045 : .02, t, 2);
    const fr = Math.hypot(G.Me.x - 1225, G.Me.y - 860); a.hg.gain.setTargetAtTime(.014 * Math.max(0, 1 - fr / 520), t, .5);
    if (t > a.creak) { a.creak = t + 18 + Math.random() * 30; this.creak(); }
    if (t > a.dog) { a.dog = t + 45 + Math.random() * 60; this.dog(); }
  },
  creak() { const c = this.ctx, t = c.currentTime, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(70 + Math.random() * 40, t); o.frequency.linearRampToValueAtTime(45, t + .7); f.type = 'bandpass'; f.frequency.value = 500 + Math.random() * 400; f.Q.value = 9; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.03, t + .15); g.gain.exponentialRampToValueAtTime(.0001, t + .8); o.connect(f).connect(g).connect(this.amb.out); o.start(t); o.stop(t + .85); },
  dog() { const c = this.ctx; for (let k = 0; k < 2 + Math.floor(Math.random() * 2); k++) { const t = c.currentTime + k * .32, o = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(430, t); o.frequency.exponentialRampToValueAtTime(210, t + .14); f.type = 'lowpass'; f.frequency.value = 650; g.gain.setValueAtTime(.012, t); g.gain.exponentialRampToValueAtTime(.0001, t + .18); o.connect(f).connect(g).connect(this.amb.out); o.start(t); o.stop(t + .2); } }
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
  evs = evs || []; const big = myActionCard(evs);
  for (const e of evs) {
    const mine = e.by === G.me;
    switch (e.k) {
      case 'use': { const o = ENG.objById(C, e.obj); toast(`${pname(e.by)}：${e.label}（${o.name}）`); if (e.tool === 'luminol') Snd.spray(); else Snd.click(); if (G.tut) G.tut.ev.push(e); break; }
      case 'light': { toast(`💡 ${pname(e.by)}${e.on ? '打開' : '關掉'}了${C.roomName[e.room]}的燈`); Snd.sw(); break; }
      case 'found': if (!mine && !evs.some(x => x.k === 'lab_back' && x.id === e.id)) card(e.id, false); else if (mine && !big) card(e.id, false); break;
      case 'lab_back': card(e.id, true); toast(`📨 實驗室：${e.label} 的報告回來了`); break;
      case 'lab_sent': toast(`🛵 ${pname(e.by)} 把「${e.name}」交給小吳送實驗室（實驗室額度 -${e.cost}，約 ${C.labSec} 秒後回報）`); Snd.click(); break;
      case 'bag': toast(`🛍️ ${pname(e.by)} 把「${e.name}」裝進證物袋`); Snd.click(); break;
      case 'sample': toast(`🧫 ${pname(e.by)} 取得樣本：${e.label}（要拿回鑑識車分析）`); break;
      case 'analyze': toast(`🔬 ${pname(e.by)} 在車上分析：${e.label}`); Snd.click(); break;
      case 'gear': if (mine) toast('🧰 裝備就緒，慢慢看、仔細找'); else toast(`🧰 ${pname(e.by)} 換了裝備`); break;
      case 'refill': if (mine) toast(`🧪 魯米諾補滿了（${C.lumCharges} 次）`); break;
      case 'left': toast(`🚪 ${G.st.players[e.by] ? G.st.players[e.by].name : '隊友'} 離隊了`); break;
      case 'phase':
        if (e.phase === 'deduce') { toast(e.why === 'patience' ? '🌅 分局長的耐心用完了，現在提出推理' : '⚖️ 開始結案推理'); closeOv(); setTimeout(() => openDeduce(), 300); }
        if (e.phase === 'result') { setTimeout(() => openResult(), 200); }
        break;
      case 'start': case 'draft': break;
      case 'callcops': toast(`📣 ${pname(e.by)} 請${e.name}去攔住 ${(C.suspects.find(x => x.id === e.npc) || {}).name || '那個人'}`); Snd.soft && Snd.soft(); refreshAlert(); break;
      default: if (e.text) banner(e.text, e.k); if (/nervous|flee|held|fled/.test(e.k)) refreshAlert(); if (G.tut) G.tut.ev.push(e);
    }
  }
}

/* ---------- 單機存檔（重新整理不會不見） ---------- */
function saveSolo() { if (G.mode !== 'solo' || G.tut) return; try { const p = meP(); if (p) { p.x = G.Me.x; p.y = G.Me.y; } localStorage.setItem('fs_solo', JSON.stringify(G.st)); } catch (e) { } }
function startSolo(resume) {
  G.mode = 'solo'; G.me = 0; G.host = true; G.room = null; Tut.stop();
  let st = null; if (resume) { try { st = JSON.parse(localStorage.getItem('fs_solo')); } catch (e) { } }
  if (!st || !st.seed || st.phase === 'result') {
    const seed = qs.get('seed') ? +qs.get('seed') : 1 + Math.floor(Math.random() * 2147483000);
    C = GEN.generate(seed, $('#diff').value); st = ENG.newGame(C, [{ pid: 0, name: myName(), ci: myCi() }]);
  } else C = GEN.generate(st.seed, st.diff);
  G.st = st; loadSeen(); enterGame(!resume || !st.players[0].loaded);
}
function loadSeen() { G.seen = new Set(); G.glinted = new Set(); try { const a = JSON.parse(LS.get('fs_seen_' + G.st.seed, '[]')); a.forEach(x => G.seen.add(x)); } catch (e) { } }
function saveSeen() { if (G.st && !G.tut) LS.set('fs_seen_' + G.st.seed, JSON.stringify([...G.seen])); }

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
        if (!C || C.seed !== m.s.seed || C.diff !== m.s.diff) { C = GEN.generate(m.s.seed, m.s.diff); G.view = {}; G.st = null; }
        if (!G.st || G.st.seed !== m.s.seed) { G.st = m.s; loadSeen(); G.st = null; }
        if (G.st) { for (const c of m.s.cops || []) { const o = (G.st.cops || []).find(q => q.id === c.id); if (o && o.vx != null) { c.vx = o.vx; c.vy = o.vy; } } if (m.s.boss && G.st.boss && G.st.boss.vx != null) { m.s.boss.vx = G.st.boss.vx; m.s.boss.vy = G.st.boss.vy; } for (const n of m.s.npcs || []) { const o = G.st.npcs.find(q => q.id === n.id); if (o && o.vx != null) { n.vx = o.vx; n.vy = o.vy; } } }
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
        if (G.st && m.c) for (const [id, x, y, mode] of m.c) { const c = (G.st.cops || []).find(q => q.id === id); if (c) { c.tx = x; c.ty = y; c.mode = mode; if (c.vx == null) { c.vx = x; c.vy = y; } } }
        if (G.st && m.b && G.st.boss) { const B = G.st.boss; B.tx = m.b[0]; B.ty = m.b[1]; B.mode = m.b[2]; if (B.vx == null) { B.vx = m.b[0]; B.vy = m.b[1]; } }
        if (G.st && m.clock != null) G.st.clock = m.clock;
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
  if (Voice.on) Voice.leave(true); Tut.stop(); Snd.stopAmb();
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
  let resumable = false; try { const s = JSON.parse(localStorage.getItem('fs_solo') || 'null'); resumable = s && s.seed && s.budget != null && s.phase !== 'result' && (s.clock > 5 || s.spent > 0); } catch (e) { }
  $('#bSolo').textContent = resumable ? '🕵️ 繼續單人調查' : '🕵️ 單人調查';
  $('#bSolo').onclick = () => { Snd.init(); if (resumable && !confirm('要繼續上次的單人調查嗎？\n（取消＝重新開始）')) LS.del('fs_solo'), startSolo(false); else startSolo(resumable); };
  $('#bCreate').onclick = () => { Snd.init(); LS.set('fs_name', myName()); Net.connect(); Net.send({ t: 'create', name: myName(), ci: myCi() }); };
  $('#bJoin').onclick = () => { Snd.init(); const code = $('#joinCode').value.trim(); if (!/^\d{4}$/.test(code)) return toast('請輸入 4 位數房號', true); LS.set('fs_name', myName()); G.code = code; G.token = LS.get('fs_tok_' + code, null); Net.connect(); Net.send({ t: 'join', code, token: G.token || undefined, name: myName(), ci: myCi() }); };
  $('#joinCode').onkeydown = e => { if (e.key === 'Enter') $('#bJoin').click(); };
  $('#bTut').onclick = () => Tut.start(); $('#bTut').classList.toggle('glow', LS.get('fs_tutDone', '') !== '1');
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
  const DD = GEN.DIFF[r.diff || 'normal'];
  $('#rmDiff').value = r.diff || 'normal'; $('#rmDiff').disabled = !G.host;
  $('#rmNote').textContent = `${n} 人合作：工具隨便用，送實驗室共用 ${DD.labBudget} 點額度。可以分工：一人關燈、一人噴灑記錄、一人跑車上。`;
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
  for (const c of G.st.cops || []) list.push({ kind: 'c', c, x: c.vx != null ? c.vx : c.x, y: c.vy != null ? c.vy : c.y, mv: c.mode !== 'post' });
  const B = G.st.boss; if (B && B.mode !== 'away') list.push({ kind: 'b', b: B, x: B.vx != null ? B.vx : B.x, y: B.vy != null ? B.vy : B.y, mv: !!(B.path && B.path.length) || B.mode === 'leave' });
  return list;
}
function label(t, x, y, col, bg) { ctx.font = 'bold 14px "PingFang TC","Noto Sans TC","Noto Sans CJK TC",sans-serif'; const w = ctx.measureText(t).width + 12; ctx.fillStyle = bg || 'rgba(10,14,22,.75)'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 11, w, 22, 8) : ctx.rect(x - w / 2, y - 11, w, 22); ctx.fill(); ctx.fillStyle = col || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t, x, y + 1); }
const DK = document.createElement('canvas'), dk = DK.getContext('2d');
const copDef = id => (C.cops || []).find(c => c.id === id) || { name: '員警', img: 'npc_officer_1' };
const bodyRoom = () => { const b = ENG.objById(C, 'body'); return b ? b.room : null; };
const angOf = q => q.pid === G.me ? G.Me.ang : ((G.view[q.pid] || {}).ang || 0);
function lightCone(c, x, y, a, L, alpha) {
  const g = c.createRadialGradient(x, y, 10, x, y, L); g.addColorStop(0, `rgba(0,0,0,${alpha})`); g.addColorStop(.65, `rgba(0,0,0,${alpha * .85})`); g.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = g; c.beginPath(); c.moveTo(x, y); c.arc(x, y, L, a - .55, a + .55); c.closePath(); c.fill();
  const h = c.createRadialGradient(x, y, 0, x, y, 95); h.addColorStop(0, `rgba(0,0,0,${alpha * .8})`); h.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = h; c.beginPath(); c.arc(x, y, 95, 0, Math.PI * 2); c.fill();
}
function render(now) {
  const t = now / 1000; const late = [];
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.fillStyle = '#0b0f18'; ctx.fillRect(0, 0, VW, VH);
  if (!G.st || !C) return;
  const M = C.map; const hw = VW / 2 / Z, hh = VH / 2 / Z;
  CAM.x = M.w < hw * 2 ? M.w / 2 : Math.max(hw - 40, Math.min(M.w - hw + 40, G.camAt ? G.camAt.x : G.Me.x));
  CAM.y = M.h < hh * 2 ? M.h / 2 + 60 : Math.max(hh + 100, Math.min(M.h - hh + 40, (G.camAt ? G.camAt.y : G.Me.y) - 30));
  const WT = [DPR * Z, 0, 0, DPR * Z, DPR * (VW / 2 - CAM.x * Z), DPR * (VH / 2 - CAM.y * Z)];
  ctx.setTransform(...WT);
  drawMap();
  // 屍體所在的房間：微微偏冷的紫紅色調（氣氛用，不洩漏答案）
  const br = roomOf(bodyRoom()); if (br) { ctx.fillStyle = 'rgba(70,20,70,.13)'; ctx.fillRect(br.x, br.y, br.w, br.h); }
  const near = G.nearId, lights = G.st.lights || {}; const tentLabels = [];
  G.flatDrawn = [];
  for (const o of ENG.flatOrder(C)) {
    if (G.st.obj[o.id].gone || (o.id === 'body' && G.hideBody)) continue;
    if (o.id === 'body') { // 屍體：先畫一圈淡淡的粉筆輪廓與陰影，讓它在任何地毯上都看得清楚
      ctx.save(); ctx.fillStyle = 'rgba(10,12,20,.28)'; ctx.beginPath(); ctx.ellipse(o.x, o.y + 4, o.w * .56, o.h * .62, 0, 0, Math.PI * 2); ctx.fill();
      ctx.setLineDash([9, 7]); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.w * .58, o.h * .66, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    }
    drawImg(o.img, o.x, o.y, o.w, o.h, { flat: true }); G.flatDrawn.push(o.id);
  }
  const items = [];
  for (const o of C.objects) if (!o.flat && !G.st.obj[o.id].gone && !(o.id === 'chief' && G.st.boss && G.st.boss.mode !== 'away')) items.push({ kind: 'o', o, y: o.sw ? o.y - 60 : o.y });
  for (const q of people()) items.push(Object.assign(q, { y: q.y }));
  items.sort((a, b) => a.y - b.y);
  for (const it of items) {
    if (it.kind === 'o') {
      const o = it.o; const hl = near === o.id;
      if (hl) { ctx.save(); ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 22 + 8 * Math.sin(t * 5); }
      drawImg(o.img, o.x, o.y, o.w, o.h);
      if (hl) ctx.restore();
    } else if (it.kind === 'p') {
      const p = it.p, bob = it.mv ? Math.abs(Math.sin(t * 10)) * 5 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 26, 8, 0, 0, Math.PI * 2); ctx.fill();
      drawImg('agent_' + (p.ci + 1), it.x, it.y - bob, 84, CH, { flip: it.dir < 0 });
      late.push(['label', p.pid === G.me ? p.name + '（你）' : p.name, it.x, it.y - CH - 12, AGENT_COL[p.ci]]);
      const b = G.bubbles[p.pid]; if (b && b.until > now) late.push(['bubble', b.text, it.x, it.y - CH - 40]);
      if (Voice.speak[p.pid]) { ctx.strokeStyle = '#8ff0a8'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(it.x, it.y, 28, 10, 0, 0, Math.PI * 2); ctx.stroke(); }
    } else if (it.kind === 'n') {
      const n = it.n, bob = it.mv ? Math.abs(Math.sin(t * 8)) * 4 : 0, s = C.suspects.find(x => x.id === n.id);
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (near === 'npc:' + n.id) { ctx.save(); ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 20; }
      const nh = n.id === 'daughter' ? CH * .94 : CH; drawImg('npc_' + n.id, it.x, it.y - bob, nh * 2 / 3, nh);
      if (near === 'npc:' + n.id) ctx.restore();
      const tag = n.mode === 'flee' ? '🏃 ' : n.mode === 'nervous' ? '😰 ' : n.mode === 'held' ? '🔒 ' : '';
      label(tag + (s ? s.name : ''), it.x, it.y - nh - 12, n.mode === 'flee' || n.mode === 'nervous' ? '#ffb3a8' : '#e6dcc8');
      if (n.mode === 'nervous') { ctx.font = '26px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('😰', it.x + 34, it.y - nh - 28 - Math.abs(Math.sin(t * 3)) * 4); }
    } else if (it.kind === 'c') {
      const c = it.c, d = copDef(c.id), bob = it.mv ? Math.abs(Math.sin(t * 7)) * 3 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (c.mode === 'in') { const a = .35 + .15 * Math.sin(t * 2.2); ctx.strokeStyle = `rgba(242,165,65,${a})`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(it.x, it.y, 34, 12, 0, 0, Math.PI * 2); ctx.stroke(); }
      drawImg(d.img, it.x, it.y - bob, CH * 2 / 3, CH, { flip: (c.vx != null && c.tx != null ? c.tx < c.vx : false) });
      late.push(['label', (c.mode === 'in' ? '⚠️ 菜鳥 ' : c.known ? '😅 ' : '') + d.name, it.x, it.y - CH - 12, c.mode === 'in' ? '#ffd58a' : '#cfe0ff', c.mode === 'in' ? 'rgba(80,55,15,.88)' : 'rgba(10,14,22,.6)']);
      if (c.mode === 'in') late.push(['img', 'ui_alert', it.x, it.y - CH - 32 - Math.abs(Math.sin(t * 2)) * 5, 34]);
    } else if (it.kind === 'b') {
      const B = it.b, bob = it.mv ? Math.abs(Math.sin(t * 6)) * 3 : 0;
      ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(it.x, it.y, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
      if (near === 'boss') { ctx.save(); ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 20; }
      drawImg('npc_supervisor', it.x, it.y - bob, CH * 2 / 3, CH);
      if (near === 'boss') ctx.restore();
      late.push(['label', '分局長・鄭督察', it.x, it.y - CH - 12, '#e8dcc0']);
      if (B.mode === 'in' && B.demand) late.push(['boss', B, it.x, it.y - CH - 50]);
    }
  }
  // 關燈的房間：暗下來，只有手電筒照得到（燈亮的房間維持正常亮度）
  const dark = (C.switches || []).filter(k => lights[k] === false);
  if (dark.length) {
    if (DK.width !== cv.width || DK.height !== cv.height) { DK.width = cv.width; DK.height = cv.height; }
    dk.setTransform(1, 0, 0, 1, 0, 0); dk.globalCompositeOperation = 'source-over'; dk.clearRect(0, 0, DK.width, DK.height);
    dk.setTransform(...WT);
    for (const k of dark) { const r = roomOf(k); dk.fillStyle = 'rgba(3,5,14,.9)'; dk.fillRect(r.x - 8, r.y - 12, r.w + 16, r.h + 20); }
    dk.globalCompositeOperation = 'destination-out';
    for (const q of people()) if (q.kind === 'p') lightCone(dk, q.x, q.y - 40, angOf(q.p), 340, 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(DK, 0, 0); ctx.setTransform(...WT);
    // 手電筒的暖色光（隊友的手電筒也看得到）
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (const q of people()) if (q.kind === 'p') { const rr = ENG.roomAt(C, q.x, q.y); if (!dark.includes(rr)) continue; const a = angOf(q.p), g = ctx.createRadialGradient(q.x, q.y - 40, 10, q.x, q.y - 40, 330); g.addColorStop(0, 'rgba(255,225,160,.10)'); g.addColorStop(1, 'rgba(255,225,160,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(q.x, q.y - 40); ctx.arc(q.x, q.y - 40, 330, a - .55, a + .55); ctx.closePath(); ctx.fill(); }
    ctx.restore();
  }
  // 魯米諾螢光：只有房間燈關著才看得到（暗處特別亮）
  for (const o of C.objects) {
    const S = G.st.obj[o.id]; if (S.gone || !S.revealed.length) continue;
    const isDark = lights[o.room] === false;
    if (isDark) for (const fx of S.revealed) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = .6 + .15 * Math.sin(t * 1.6);
      const big = fx === 'fx_luminol_pool';
      if (o.flat) drawImg(fx, o.x, o.y, big ? o.w : Math.max(70, o.w * .8), big ? o.h : Math.max(50, o.h), { flat: true }); else { const gz = Math.max(56, Math.min(110, Math.max(o.w, o.h) * 1.4)); drawImg(fx, o.x, o.y - o.h * .35, gz, gz); }
      ctx.shadowColor = '#4fd2ff'; ctx.shadowBlur = 30; ctx.globalAlpha = .25; ctx.fillStyle = '#4fd2ff'; ctx.beginPath(); ctx.ellipse(o.x, o.flat ? o.y : o.y - o.h * .4, big ? o.w * .4 : 40, big ? o.h * .35 : 30, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      if (!S.marked && !G.glinted.has('g' + o.id) && Math.hypot(G.Me.x - o.x, G.Me.y - o.y) < 320) { G.glinted.add('g' + o.id); Snd.glint(); }
    }
    if (S.marked) {   // 記錄過的位置：黃色證物標示牌（開燈後螢光消失，但標示留著）
      const f = G.st.found.find(x => (ENG.objById(C, o.id).acts || []).some(a => a.dark && (a.ev || []).includes(x.id)));
      const mx = o.x + (o.flat ? o.w * .3 : 26), my = o.flat ? o.y + o.h * .2 : o.y + 6;
      ctx.fillStyle = '#f2d045'; ctx.strokeStyle = '#1d2333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(mx - 12, my); ctx.lineTo(mx, my - 22); ctx.lineTo(mx + 12, my); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#1d2333'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f ? f.n : '•', mx, my - 7);
      { const [sx, sy] = W2S(mx, my - 10), hov = Math.hypot(MOUSE.x - sx, MOUSE.y - sy) < 26, close = Math.hypot(G.Me.x - mx, G.Me.y - my) < 170;
        if (hov || close) { const e = f && C.evidence[f.id]; tentLabels.push([`🔺 證物標記 ${f ? f.n : ''}：${e ? e.name : '魯米諾反應'}（已記入筆記本）`, mx, my - 36]); } }
      if (S.revealed.length && !isDark) { ctx.save(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(242,208,69,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(o.x, o.flat ? o.y : o.y - o.h * .4, o.flat ? o.w * .4 : 34, o.flat ? o.h * .35 : 26, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
    }
  }
  // 可互動標記（電燈開關用燈泡）
  for (const o of C.objects) {
    if (o.deco || o.van || G.st.obj[o.id].gone) continue;
    const yy = (o.flat ? o.y - o.h / 2 - 16 : o.y - o.h - 14) - Math.abs(Math.sin(t * 2 + o.x)) * 5;
    if (o.sw) { const on = lights[o.sw] !== false; ctx.fillStyle = on ? '#ffe9a8' : '#3a4560'; ctx.beginPath(); ctx.arc(o.x, yy, 10, 0, Math.PI * 2); ctx.fill(); ctx.font = '13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('💡', o.x, yy + 1); continue; }
    const a = available(o); if (!a) continue;
    ctx.fillStyle = a === 2 ? '#f2a541' : '#7d8aa0'; ctx.beginPath(); ctx.arc(o.x, yy, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1d2333'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('!', o.x, yy + 1);
    if (a === 2 && !G.glinted.has(o.id) && Math.hypot(G.Me.x - o.x, G.Me.y - o.y) < 150) { G.glinted.add(o.id); Snd.glint(); }
  }
  { const bo = ENG.objById(C, 'body'); if (bo && near !== 'body') label(bo.label || '屍體', bo.x, bo.y + bo.h / 2 + 18, '#ffd9d9'); }
  for (const [t, x, y] of tentLabels) label(t, x, y, '#1d2333', 'rgba(242,208,69,.95)');
  if (near && !near.startsWith('npc:') && near !== 'boss') { const o = ENG.objById(C, near); if (o) label(o.name, o.x, o.npc ? o.y - o.h - 12 : o.flat ? o.y + o.h / 2 + 16 : o.y + 18, '#bfefff'); }
  // 教學箭頭
  const tg = Tut.target(); if (tg) drawImg('ui_tut_arrow', tg.x, tg.y - 20 - Math.abs(Math.sin(t * 3)) * 12, 46, 46);
  for (const L of late) {
    if (L[0] === 'label') label(L[1], L[2], L[3], L[4], L[5]);
    else if (L[0] === 'bubble') bubble(L[1], L[2], L[3]);
    else if (L[0] === 'img') drawImg(L[1], L[2], L[3] + L[4] / 2, L[4], L[4]);
    else if (L[0] === 'boss') bossBubble(L[1], L[2], L[3], t);
  }
  // 噴灑特效、浮動文字
  G.fx = G.fx.filter(f => now - f.t < 900);
  for (const f of G.fx) { const k = (now - f.t) / 900; ctx.save(); ctx.globalAlpha = 1 - k; ctx.fillStyle = '#bfefff'; for (let i = 0; i < 18; i++) { const a = i * 2.4, r = 10 + k * 70 * ((i % 5) / 5 + .5); ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * r, f.y - 40 + Math.sin(a) * r * .6, 3, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); }
  G.floats = G.floats.filter(f => now - f.t < 2600);
  for (const f of G.floats) { const k = (now - f.t) / 2600; ctx.save(); ctx.globalAlpha = Math.min(1, (1 - k) * 2); label('🔎 ' + f.text, f.x, f.y - 20 - k * 40, '#8ff0df', 'rgba(6,30,34,.9)'); ctx.restore(); }
  // 夜色：畫面四周很淡的暗角
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const [sx, sy] = W2S(G.Me.x, G.Me.y - 30); const g = ctx.createRadialGradient(sx, sy, 220 * Z, sx, sy, Math.max(VW, VH) * .8);
  g.addColorStop(0, 'rgba(5,8,20,0)'); g.addColorStop(1, 'rgba(5,8,20,.45)'); ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  // 畫面外指示：菜鳥、分局長、逃跑中的人、教學目標
  const marks = [];
  for (const c of G.st.cops || []) if (c.mode === 'in') marks.push([c.vx != null ? c.vx : c.x, c.vy != null ? c.vy : c.y, '⚠️', '#c98a3a']);
  const B = G.st.boss; if (B && B.mode === 'in') marks.push([B.vx != null ? B.vx : B.x, B.vy != null ? B.vy : B.y, '👔', '#5a6a8a']);
  for (const n of G.st.npcs || []) if (n.mode === 'flee' || n.mode === 'nervous') marks.push([n.vx != null ? n.vx : n.x, n.vy != null ? n.vy : n.y, '🏃', '#b8574f']);
  if (tg) marks.push([tg.x, tg.y + 40, '⬇️', '#1f8f82']);
  for (const [x, y, ic, col] of marks) { let [px, py] = W2S(x, y - 40); const [fx, fy] = W2S(x, y), [hx, hy] = W2S(x, y - CH - 30); if (fx > -20 && fx < VW + 20 && fy > -10 && hy < VH + 10) continue; px = Math.max(30, Math.min(VW - 30, px)); py = Math.max(90, Math.min(VH - 90, py)); ctx.globalAlpha = .85; ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px, py, 19, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1; ctx.font = '18px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(ic, px, py + 1); }
}
// 分局長頭上的泡泡：要求圖示＋文字，下方一條慢慢變短的「耐心」條（不顯示秒數）
function bossBubble(B, x, y, t) {
  const d = B.demand, done = ENG.bossDone(C, G.st, d), R = C.reports[d.kind === 'progress' ? 'progress' : d.rep];
  const txt = d.kind === 'progress' ? `進度 ${d.pct}%` : R.t, sub = done ? '✅ 完成了，碰我交差' : d.kind === 'progress' ? `現在 ${ENG.progress(C, G.st)}%` : '報告';
  ctx.font = 'bold 15px "PingFang TC","Noto Sans TC",sans-serif'; const w = Math.max(132, ctx.measureText(txt).width + 70), h = 58;
  ctx.fillStyle = done ? '#e8fff6' : '#fffaf0'; ctx.strokeStyle = done ? '#2bb3a3' : '#1d2333'; ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - h / 2, w, h, 14) : ctx.rect(x - w / 2, y - h / 2, w, h); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 8, y + h / 2 - 1); ctx.lineTo(x, y + h / 2 + 12); ctx.lineTo(x + 8, y + h / 2 - 1); ctx.fill();
  drawImg(R.icon, x - w / 2 + 26, y + 20, 38, 38);
  ctx.fillStyle = '#1d2333'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(txt, x - w / 2 + 50, y - 9);
  ctx.font = '12px "PingFang TC","Noto Sans TC",sans-serif'; ctx.fillStyle = done ? '#147a6c' : '#5a6070'; ctx.fillText(sub, x - w / 2 + 50, y + 10);
  const left = Math.max(0, Math.min(1, (B.until - G.st.clock) / Math.max(1, B.until - B.t0)));
  ctx.fillStyle = '#d9d2c0'; ctx.fillRect(x - w / 2 + 50, y + 21, w - 62, 4); ctx.fillStyle = left > .3 ? '#8a9ab0' : '#b07a5a'; ctx.fillRect(x - w / 2 + 50, y + 21, (w - 62) * left, 4);
}
function bubble(text, x, y) { ctx.font = '14px "PingFang TC","Noto Sans TC",sans-serif'; const s = text.length > 18 ? text.slice(0, 18) + '…' : text; const w = ctx.measureText(s).width + 16; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x - w / 2, y - 14, w, 28, 10) : ctx.rect(x - w / 2, y - 14, w, 28); ctx.fill(); ctx.fillStyle = '#1d2333'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(s, x, y + 1); }

/* ================= 移動與輸入 ================= */
const KEYS = {};
addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  KEYS[e.key.toLowerCase()] = true;
  if (!G.st || !$('#ov').classList.contains('hidden')) { if (e.key === 'Escape') closeOv(); return; }
  if ((e.key === 'e' || e.key === 'E' || e.key === ' ') && ENG.runner(G.st) && ENG.canCallCops(G.st) && !G.st.chase) { e.preventDefault(); doAct({ type: 'callcops' }); return; }
  if (e.key === 'e' || e.key === 'E' || e.key === ' ') { e.preventDefault(); const b = document.querySelector('#act:not(.hidden) button[data-key="e"]'); if (b && !b.disabled) b.click(); else if (!b) interactNearest(); else toast(b.classList.contains('done') ? '這一項已經做過了（結果在筆記本）' : b.querySelector('.why') ? b.querySelector('.why').textContent : '現在不能這樣做', true); }
  if (/^[1-9]$/.test(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) { const b = document.querySelector(`#act:not(.hidden) button[data-key="${e.key}"]`); if (b) { e.preventDefault(); if (!b.disabled) b.click(); else toast(b.classList.contains('done') ? '這一項已經做過了（結果在筆記本）' : b.querySelector('.why') ? b.querySelector('.why').textContent : '現在不能這樣做', true); } }
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
  for (const q of people()) { if (q.kind !== 'n') continue; if (Math.abs(wx - q.x) < 36 && wy < q.y + 8 && wy > q.y - CH) { goTo(q.x, q.y + 30, 'npc:' + q.n.id); return; } }
  // 點到物件？（後面畫的優先）
  const hits = C.objects.filter(o => !G.st.obj[o.id].gone && (o.flat ? Math.abs(wx - o.x) < Math.max(o.w, 44) / 2 && Math.abs(wy - o.y) < Math.max(o.h, 36) / 2 : Math.abs(wx - o.x) < Math.max(o.w, 44) / 2 && wy < o.y + 10 && wy > o.y - Math.max(o.h, 44))).sort((a, b) => b.y - a.y);
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
    turnTo(M, Math.atan2(vy, vx), dt);
    if (G.mode === 'solo') { const p = meP(); p.x = M.x; p.y = M.y; p.dir = M.dir; }
  }
  else if (G.nearId && !G.nearId.startsWith('npc:') && G.nearId !== 'boss') { const o = ENG.objById(C, G.nearId); if (o) turnTo(M, Math.atan2(o.y - 20 - (M.y - 40), o.x - M.x), dt); }   // 停下來時，手電筒照向眼前的物件
  // 其他人／NPC 插值
  const k = Math.min(1, dt * 10);
  for (const v of Object.values(G.view)) if (v.tx != null) { const dx = v.tx - v.x, dy = v.ty - v.y; if (Math.hypot(dx, dy) > 3) turnTo(v, Math.atan2(dy, dx), dt); v.x += dx * k; v.y += dy * k; }
  for (const n of G.st.npcs || []) if (n.tx != null) { n.vx += (n.tx - n.vx) * k; n.vy += (n.ty - n.vy) * k; }
  for (const c of G.st.cops || []) if (c.tx != null) { c.vx += (c.tx - c.vx) * k; c.vy += (c.ty - c.vy) * k; }
  const B = G.st.boss; if (B && B.tx != null) { if (B.vx == null) { B.vx = B.tx; B.vy = B.ty; } B.vx += (B.tx - B.vx) * k; B.vy += (B.ty - B.vy) * k; }
  Net.flushPos(false);
}
function turnTo(o, a, dt) { let d = a - (o.ang || 0); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; o.ang = (o.ang || 0) + d * Math.min(1, dt * 9); }
function nearest() {
  const p = { x: G.Me.x, y: G.Me.y }; let best = null, bd = 1e9;
  for (const o of C.objects) {
    if (G.st.obj[o.id].gone) continue; if (o.deco && !o.desc) continue;
    const r = o.deco ? 80 : null; const d = Math.hypot(o.x - p.x, o.y - p.y);
    if ((r ? d <= r : ENG.near(C, p, o)) && d < bd) { bd = d; best = o.id; }
  }
  for (const n of G.st.npcs || []) { if (n.mode === 'gone') continue; const x = n.vx != null ? n.vx : n.x, y = n.vy != null ? n.vy : n.y, d = Math.hypot(x - p.x, y - p.y); if (d < 90 && d < bd) { bd = d; best = 'npc:' + n.id; } }
  const B = G.st.boss; if (B && B.mode === 'in') { const x = B.vx != null ? B.vx : B.x, y = B.vy != null ? B.vy : B.y, d = Math.hypot(x - p.x, y - p.y); if (d < 110 && d < bd + 40) { bd = d; best = 'boss'; } }
  return best;
}
function interactNearest() { const id = nearest(); if (!id || id === 'boss') return; const ob = ENG.objById(C, id); if (ob && ob.sw) return doAct({ type: 'light', obj: id }); if (id.startsWith('npc:')) return openPerson(id.slice(4)); const o = ENG.objById(C, id); if (o && o.van) openVan(); }

/* ================= 主迴圈 ================= */
let last = performance.now(), slowT = 0;
// 電腦（滑鼠＋鍵盤）用精簡的鍵盤清單；觸控裝置用按鈕
// 輸入方式：先猜（滑鼠＋寬螢幕＝鍵盤清單），之後依「實際」輸入切換並記住——
// 按鍵或滑鼠移動 → 鍵盤清單；手指觸控 → 觸控按鈕列（觸控筆電也能正確切換）
let INPUT = null; try { INPUT = localStorage.getItem('fs_input'); } catch (e) { }
function setKB() { const kb = INPUT ? INPUT === 'kb' : (matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(any-pointer: fine)').matches) && innerWidth > 640; document.body.classList.toggle('kb', kb); }
function useInput(m) { if (INPUT === m) return; INPUT = m; try { localStorage.setItem('fs_input', m); } catch (e) { } setKB(); if (typeof refreshAct === 'function' && G.st) refreshAct(); }
setKB(); addEventListener('resize', setKB);
addEventListener('keydown', e => { if (/^(w|a|s|d|e|n|arrow\w+|[1-9]| )$/i.test(e.key)) useInput('kb'); }, true);
// 滑鼠只在「有精細指標」的裝置上才算數，而且剛摸過螢幕的 1 秒內不算（手機點擊會附帶模擬的滑鼠事件）
let lastTouch = 0; const realMouse = e => e.pointerType === 'mouse' && performance.now() - lastTouch > 1000 && matchMedia('(any-pointer: fine)').matches;
addEventListener('touchstart', () => { lastTouch = performance.now(); useInput('touch'); }, { passive: true, capture: true });
addEventListener('pointermove', e => { if (realMouse(e) && (Math.abs(e.movementX) + Math.abs(e.movementY) > 0)) useInput('kb'); }, { passive: true });
addEventListener('pointerdown', e => { if (e.pointerType === 'touch' || e.pointerType === 'pen') { lastTouch = performance.now(); useInput('touch'); } else if (realMouse(e)) useInput('kb'); }, { passive: true, capture: true });
const MOUSE = { x: -1, y: -1 }; addEventListener('mousemove', e => { MOUSE.x = e.clientX; MOUSE.y = e.clientY; }, { passive: true });
function loop(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (G.st && C) {
    step(dt);
    if (G.mode === 'solo' && G.st.phase === 'play' && document.visibilityState === 'visible') { const ev = ENG.tick(C, G.st, dt); if (ev.length) { onEvents(ev); refresh(); saveSolo(); } }
    const nid = nearest(); if (nid !== G.nearId) { G.nearId = nid; refreshAct(); }
    slowT += dt; if (slowT > .3) { slowT = 0; hudPress(); if (G.mode === 'solo') saveSolo(); Snd.ambTick(); if (G.tut) Tut.tick(); if (G.st.boss && G.st.boss.mode === 'in' && G.nearId === 'boss') refreshAct(); }
  }
  render(now); try { placeAct(); } catch (e) { }
  requestAnimationFrame(loop);
}

/* ================= HUD ================= */
const mmss = s => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`;
function enterGame(needGear) {
  $('#home').classList.add('hidden'); $('#roomScr').classList.add('hidden'); $('#hud').classList.remove('hidden');
  const p = meP(); G.Me.x = p.x; G.Me.y = p.y; G.Me.dir = p.dir || 1; G.path = null; G.view = {}; G.nearId = null;
  for (const n of G.st.npcs || []) { n.vx = n.x; n.vy = n.y; }
  $('#bChat').classList.toggle('hidden', G.mode !== 'online');
  for (const c of G.st.cops || []) { c.vx = c.x; c.vy = c.y; } if (G.st.boss) { G.st.boss.vx = G.st.boss.x; G.st.boss.vy = G.st.boss.y; }
  G.Me.ang = -Math.PI / 6; Snd.startAmb();
  closeOv(); refresh();
  if (G.st.phase === 'deduce') openDeduce(); else if (G.st.phase === 'result') openResult(); else if (needGear) openBriefing();
}
// 手機：結果卡／提示卡放在左上 HUD（和教學框）的下方，不要蓋住它們
function layoutCards() {
  const cards = $('#cards'); if (!cards) return;
  const tut = $('#tut');
  if (innerWidth > 640) { cards.style.top = ''; if (tut) tut.style.top = ''; return; }
  const tl = document.querySelector('.tl'); if (tut && tl) tut.style.top = Math.round(tl.getBoundingClientRect().bottom + 6) + 'px';
  let bottom = 0; for (const sel of ['.tl', '#tut']) { const e = document.querySelector(sel); if (e && e.offsetParent && !e.classList.contains('hidden')) bottom = Math.max(bottom, e.getBoundingClientRect().bottom); }
  if (bottom) cards.style.top = Math.round(bottom + 8) + 'px';
}
setInterval(() => { try { layoutCards(); } catch (e) { } }, 250);
addEventListener('resize', () => layoutCards());
function refresh() {
  if (!G.st || !C) return;
  const p = meP(); if (!p) return;
  $('#apN').textContent = G.st.budget; $('#apMax').textContent = ' / ' + G.st.budgetMax + (G.st.costUp ? `（送驗 +${G.st.costUp}）` : '');
  const pat = Math.round(G.st.patience == null ? 100 : G.st.patience);
  $('#pips').innerHTML = G.tut ? '' : `<span class="patl">👔 分局長的耐心</span><span class="patb"><i style="width:${pat}%;background:${pat > 50 ? '#8a9ab0' : pat > 20 ? '#b0946a' : '#b0705a'}"></i></span>`;
  const ps = Object.values(G.st.players);
  $('#team').innerHTML = ps.length > 1 ? ps.map(q => `<span class="chip" style="${q.active ? '' : 'opacity:.4'}"><span class="dot" style="background:${AGENT_COL[q.ci]}"></span>${esc(q.name)}${q.benchUntil > G.st.clock ? ' 📝寫報告中' : ''}${Voice.badge(q.pid)}</span>`).join('') : '';
  // 案情進度、下一步、待處理
  const pr = ENG.progress(C, G.st); $('#progN').textContent = pr + '%'; $('#progBar').style.width = pr + '%';
  const pend = [];
  for (const sm of p.samples) pend.push(`<div class="pend">🧫 <span>${esc(sm.label)}<br><small>回車上用「${MACHINE_OF[sm.kind] || '設備'}」分析</small></span></div>`);
  for (const b of p.bag) pend.push(`<div class="pend">🛍️ <span>${esc(b.name)}<br><small>回車上交給小吳送驗</small></span></div>`);
  for (const l of G.st.labs.filter(l => !l.back)) pend.push(`<div class="pend">⏳ <span>實驗室：${esc(l.label)}<br><small>約 ${Math.max(1, Math.ceil(l.due - G.st.clock))} 秒後回報</small></span></div>`);
  $('#labs').classList.toggle('hidden', !pend.length);
  $('#labs').innerHTML = pend.length ? '<b style="font-size:12px;color:var(--dim)">📋 待處理</b>' + pend.join('') : '';
  const ob = objective(); $('#obj').classList.toggle('hidden', !ob); $('#obj').innerHTML = ob;
  const unseen = G.st.found.filter(f => !G.seen.has(f.id)).length;
  $('#bNote').innerHTML = `📒<span class="lbl">筆記本</span>${unseen ? ` <span class="newb">${unseen} 新</span>` : ''}`;
  const bar = [];
  for (let i = 0; i < C.carryTools; i++) { const t = C.tools.find(x => x.id === p.tools[i]); bar.push(`<div class="slot" title="${t ? esc(t.name) + (t.id === 'luminol' ? `（剩 ${p.lum} 次）` : '') : '空工具格'}">${t ? `<img src="${url(t.icon)}" alt="">${t.id === 'luminol' ? `<span class="chg${p.lum ? '' : ' z'}">${p.lum}/${C.lumCharges}</span>` : ''}` : ''}</div>`); }
  bar.push('<div class="sep"></div>');
  let used = 0; for (const b of p.bag) { bar.push(`<div class="slot bag" title="${esc(b.name)}" style="${b.size > 1 ? 'width:' + (b.size * 54 + 6) + 'px' : ''}"><img src="${url(b.img)}" alt=""></div>`); used += b.size; }
  for (let i = used; i < C.bagSlots; i++) bar.push('<div class="slot bag" title="證物袋空格"></div>');
  if (p.samples.length) bar.push(`<div class="slot" title="樣本：${esc(p.samples.map(s => s.label).join('、'))}">🧫<small>${p.samples.length}</small></div>`);
  $('#bar').innerHTML = bar.join('');
  $('#bClose').style.display = G.st.phase === 'play' && isHost() ? '' : 'none';
  refreshAct(); hudPress(); Voice.render();
  if (G.ovKind && G.ovKind !== 'result' && G.ovKind !== 'brief' && G.ovKind !== 'person') G.ovRender && G.ovRender();
}
// 下一步提示（HUD 左上）
function objective() {
  const st = G.st, p = meP(); if (!p || st.phase !== 'play' || G.tut) return '';
  const R = (st.cops || []).find(c => c.mode === 'in'); if (R) return `⚠️ ${esc(copDef(R.id).name)}好像要去碰證物——<b>走過去碰他</b>，請他回崗位`;
  const B = st.boss; if (B && B.mode === 'in') return ENG.bossDone(C, st, B.demand) ? '👔 分局長的要求做到了：<b>走到他旁邊</b>交差' : `👔 分局長想要：<b>${esc(ENG.demandText(C, B.demand))}</b>`;
  if (!p.loaded) return '👉 先到左邊的<b>鑑識車</b>選 3 件工具';
  if (!p.tools.length) return '👉 工具壞了：回<b>鑑識車</b>重新拿';
  const glow = C.objects.find(o => { const S = st.obj[o.id]; return S.revealed.length && !S.marked && (o.acts || []).some(a => a.dark && !S.done[a.id]); });
  if (glow) return ENG.isLit(C, st, glow) ? `💡 「${esc(glow.name)}」噴過魯米諾了：關掉<b>${esc(C.roomName[glow.room])}的燈</b>，再記錄螢光` : `🔦 燈關著：走到「${esc(glow.name)}」按<b>記錄螢光位置</b>`;
  if (p.samples.length) return `👉 你身上有 ${p.samples.length} 個樣本：回<b>鑑識車</b>分析`;
  if (p.bag.length) return '👉 把證物袋拿回<b>鑑識車</b>交給小吳';
  const pr = ENG.progress(C, st);
  if (pr >= 100) return '✅ 線索都齊了：打開筆記本對照，按<b>⚖️ 結案推理</b>';
  if (p.benchUntil > st.clock) return `📝 你被分局長叫去寫報告，約 ${Math.ceil(p.benchUntil - st.clock)} 秒後才能繼續採證（還是可以走動、看筆記本）`;
  if (p.tools.includes('luminol') && p.lum <= 0 && C.objects.some(o => (o.acts || []).some(a => a.tool === 'luminol' && !st.obj[o.id].done[a.id]))) return '🧪 魯米諾用完了：回<b>鑑識車</b>補充';
  if (!C.objects.some(o => !o.sw && available(o) === 2)) return '👉 這些工具能做的都做了：回鑑識車<b>換工具</b>（-1）';
  return '👉 慢慢走、仔細看：靠近發亮的 <b>「!」</b> 用工具，工具隨便用，不用省';
}
const gameTime = () => { const m = 22 * 60 + 40 + Math.floor((100 - (G.st.patience == null ? 100 : G.st.patience)) / 100 * 410); return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
// 有人想溜走時的提示列：人少時可以按 E／點按鈕叫員警去攔
function refreshAlert() {
  const el = $('#alertBar'); if (!el) return; const st = G.st; const n = st && st.phase === 'play' && ENG.runner(st);
  if (!n) { el.classList.add('hidden'); return; }
  const nm = (C.suspects.find(x => x.id === n.id) || {}).name || '關係人', act = n.mode === 'flee' ? '往外跑了' : '很緊張，好像想溜走';
  let html;
  if (st.chase) { const D = (C.cops || []).find(c => c.id === st.chase.cop); html = `👮 ${esc(D ? D.name : '員警')}正在追 ${esc(nm)}…`; }
  else if (ENG.canCallCops(st)) html = `😰 ${esc(nm)} ${act}　<button id="callCops"><span class="kbonly"><kbd class="k">E</kbd></span> 叫員警攔住他</button><small>或自己走過去碰他</small>`;
  else html = `😰 ${esc(nm)} ${act}——走過去碰他就能攔下`;
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  el.classList.toggle('run', n.mode === 'flee'); el.classList.remove('hidden');
}
function hudPress() {
  try { refreshAlert(); } catch (e) { }
  if (!G.st || !C) return;
  const T = G.st.clock, P = C.pressure, rows = [];
  if (G.st.phase === 'play' && !G.tut) {
    const f = 1 - G.st.patience / 100;
    rows.push(`🕰️ ${gameTime()}　<span style="color:var(--dim)">${f < .5 ? '夜還很長' : f < .8 ? '過了午夜' : '天快亮了，差不多該結案'}</span>`);
  } else if (G.tut) rows.push('🎓 新手教學');
  const el = $('#labs'); let pr = $('#press'); if (!pr) { pr = document.createElement('div'); pr.id = 'press'; pr.className = 'chip labs'; el.parentNode.insertBefore(pr, el); }
  const h = rows.join('<br>'); if (pr.innerHTML !== h) pr.innerHTML = h;
}
// 插曲提示：安靜的卡片＋輕柔音效（不閃爍、不用警報聲）
function banner(text, k) {
  k = k || ''; const bad = /fail|tamper|rookie_hit|fled|threat/.test(k), inter = /^(rookie|boss_in|flee|nervous)$/.test(k);
  const box = $('#cards'); const d = document.createElement('div');
  d.className = 'evc soft'; d.style.borderColor = bad ? '#8a5a5a' : inter ? '#8a7a4a' : '#3a6a6a'; d.innerHTML = `<div><span style="font-size:14px;color:#e8eef6;line-height:1.6">${esc(text)}</span></div>`;
  d.onclick = () => d.remove(); box.appendChild(d); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => d.remove(), inter ? 9000 : 7000);
  if (inter) Snd.soft(); else if (bad) Snd.low(); else if (k !== 'decay') Snd.ding(false); else Snd.low();
}
// 互動清單：電腦版在物件旁邊顯示小小的半透明清單（數字鍵 1–5＝用工具、E＝互動），手機版是一排可滑動的小按鈕
const isKB = () => document.body.classList.contains('kb');
function keyed(items) { // 編號固定：工具動作依物件上的順序 1、2、3…（做完的變灰但號碼不變）；第一個還沒做的非工具互動＝E，其餘非工具接在後面
  const isDone = x => x.why === '已完成' || x.why === '已送驗'; let n = 0, e = false;
  for (const x of items) { x.done = isDone(x); if (x.tool) x.key = String(++n); }
  for (const x of items) if (!x.tool) { if (!e && !x.done && !x.why) { x.key = 'e'; e = true; } else x.key = String(++n); }
  const live = items.filter(x => !x.done), doneN = items.length - live.length;
  return { live: items.sort((p, q) => (p.key === 'e') - (q.key === 'e') || (+p.key || 0) - (+q.key || 0)), doneN, anyLive: live.length };
}
function btnHtml(x, extra) { return `<button class="${x.done ? 'done' : ''}" data-k="${x.k}" data-a="${x.a || ''}" data-key="${x.key}" ${extra || ''} ${x.why ? 'disabled' : ''}><kbd>${x.key === 'e' ? 'E' : x.key}</kbd>${x.emoji || ''} ${esc(x.label)}${x.cost ? `<span class="cost">額度 -${x.cost}</span>` : x.uses != null ? `<span class="cost">剩 ${x.uses} 次</span>` : ''}${x.done ? '<span class="ok">✓</span>' : x.why ? `<span class="why">${esc(x.why)}</span>` : ''}</button>`; }
function refreshAct(force) {
  const box = $('#act'); const id = G.nearId;
  if (!G.st || !id || !$('#ov').classList.contains('hidden')) { box.classList.add('hidden'); return; }
  box.dataset.at = id;
  if (id === 'boss') {
    const B = G.st.boss; if (!B || B.mode !== 'in') return box.classList.add('hidden');
    const d = B.demand, done = ENG.bossDone(C, G.st, d), R = C.reports[d.kind === 'progress' ? 'progress' : d.rep];
    box.innerHTML = `<div class="ah"><img class="ai" src="${url(R.icon)}" alt=""><b>👔 分局長：${esc(ENG.demandText(C, d))}</b></div><div class="ad">${done ? '<b style="color:#8ff0df">✅ 做到了——站在他旁邊就會交差</b>' : `怎麼做：${esc(R.how)}${d.kind === 'progress' ? `（現在 ${ENG.progress(C, G.st)}%）` : ''}`}</div>`;
    box.classList.remove('hidden'); return;
  }
  if (id.startsWith('npc:')) {
    const sp = C.suspects.find(x => x.id === id.slice(4)); if (!sp) return box.classList.add('hidden');
    box.innerHTML = `<div class="ah"><b>🧑 ${esc(sp.name)}</b><small>（${esc(sp.role)}・關係人）</small></div><div class="btns">${btnHtml({ k: 'person', key: 'e', emoji: '💬', label: '問話・查看資料' }, `data-person="${sp.id}"`)}</div>`;
    box.classList.remove('hidden'); return;
  }
  const o = ENG.objById(C, id); if (!o) return box.classList.add('hidden');
  if (o.van) {
    box.innerHTML = `<div class="ah"><b>🚐 ${esc(o.name)}</b></div><div class="btns">${btnHtml({ k: 'van', key: 'e', emoji: '🚐', label: '打開鑑識車（換裝備／分析／送驗）' }, 'data-van="1"')}</div>`;
    box.classList.remove('hidden'); return;
  }
  const opts = ENG.options(C, G.st, G.me, o.id); const st = G.st.obj[o.id];
  const tam = st.f && (st.f.tampered || st.f.contam) ? `<span class="why">⚠️ ${st.f.tampered ? '有人動過' : '被菜鳥碰過'}</span>` : '';
  const { live } = keyed(opts.map(x => ({ k: x.kind, a: x.id, label: x.label, emoji: x.emoji, why: x.why, cost: x.cost, uses: x.uses, tool: x.kind === 'use' && x.tool })));
  box.innerHTML = `<div class="ah"><b>${esc(o.name)}</b>${tam}</div>${o.desc ? `<div class="ad">${esc(o.desc)}</div>` : ''}<div class="btns">${live.map(x => btnHtml(x)).join('')}${!live.length && !o.deco ? '<span class="dn">這裡沒有可以做的事</span>' : ''}</div>`;
  box.dataset.obj = o.id; box.classList.remove('hidden');
}
// 電腦版：把清單放在物件旁邊（每一格畫面更新位置）
function placeAct() {
  const box = $('#act'); if (!isKB() || box.classList.contains('hidden')) { if (box.style.left) { box.style.left = ''; box.style.top = ''; } return; }
  const id = box.dataset.at; let wx = G.Me.x, wy = G.Me.y - 60;
  const o = id && !id.startsWith('npc:') && id !== 'boss' ? ENG.objById(C, id) : null;
  if (o) { wx = o.x; wy = o.flat ? o.y : o.y - (o.h || 80) * .55; }
  const [px, py] = W2S(wx, wy), bw = box.offsetWidth, bh = box.offsetHeight, ow = o ? (o.w || 80) * Z / 2 : 40;
  let x = px + ow + 18; if (x + bw > VW - 10) x = px - ow - 18 - bw; x = Math.max(10, Math.min(VW - bw - 10, x));
  const y = Math.max(70, Math.min(VH - bh - 70, py - bh / 2));
  box.style.left = Math.round(x) + 'px'; box.style.top = Math.round(y) + 'px';
}
document.addEventListener('click', e => { if (e.target.closest('#callCops')) doAct({ type: 'callcops' }); });
$('#act').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.disabled) return;
  if (b.dataset.van) return openVan();
  if (b.dataset.person) return openPerson(b.dataset.person);
  if (b.dataset.k === 'van' || b.dataset.k === 'person') return;
  const obj = $('#act').dataset.obj; const k = b.dataset.k;
  doAct(k === 'use' ? { type: 'use', obj, act: b.dataset.a } : { type: k, obj });
});

/* ================= 視窗 ================= */
function openOv(kind, html, cls, rer) { G.ovKind = kind; G.ovRender = rer || null; const w = $('#win'); w.className = 'win ' + (cls || ''); w.innerHTML = html; $('#ov').classList.remove('hidden'); $('#act').classList.add('hidden'); }
function closeOv() { if (G.ovKind === 'note' && G.noteSaw) { G.noteSaw.forEach(id => G.seen.add(id)); G.noteSaw = null; saveSeen(); } $('#ov').classList.add('hidden'); G.ovKind = null; G.ovRender = null; refreshAct(); if (G.st) refresh(); }
$('#ov').addEventListener('click', e => { if (e.target.id === 'ov' && G.ovKind !== 'deduce' && G.ovKind !== 'result') closeOv(); const c = e.target.closest('[data-close]'); if (c) closeOv(); });
const hdr = (t, noClose) => `<header><h2>${t}</h2>${noClose ? '' : '<button data-close="1">✕</button>'}</header>`;
const evRow = f => { const e = C.evidence[f.id], nw = !G.seen.has(f.id); return `<div class="ev ${nw ? 'isnew' : ''}"><img src="${url(e.icon)}" alt=""><div><b>${nw ? '<span class="newb">新</span>' : ''}${esc(e.name)}</b><span>${esc(e.text)}</span><br><small>#${f.n}・${f.by == null ? '現場觀察' : esc(pname(f.by))}</small></div></div>`; };
function suspectCard(s, pick) {
  const st = G.st; const on = pick && st.draft.culprit === s.id; const n = (st.npcs || []).find(q => q.id === s.id);
  return `<div class="su ${pick ? 'pick' : ''} ${on ? 'on' : ''}" ${pick ? `data-cul="${s.id}"` : ''}><img src="${url(s.img)}" alt=""><div><b>${esc(s.name)}</b>（${esc(s.role)}）${n && n.mode === 'gone' ? ' <span class="tag off">已逃離</span>' : n && n.mode === 'held' ? ' <span class="tag host">被攔下</span>' : ''}<q>${esc(s.say)}</q>
    <span style="color:var(--dim)">警方建檔：</span>鞋 ${s.shoe} 號・${s.blood} 型・慣用${s.hand === 'R' ? '右' : '左'}手・指紋 ${s.print}</div></div>`;
}
function openBriefing() {
  const html = hdr('📋 案件簡報・' + esc(C.diffName)) + `<div class="body"><div class="ev"><img src="${url(C.victim.img)}" alt="" style="width:84px;height:84px"><div><b>死者：${esc(C.victim.name)}（${C.victim.age}）</b><span>${esc(C.victim.note)}</span></div></div>
    ${C.briefing.map(t => `<p style="line-height:1.7">${esc(t)}</p>`).join('')}
    <h4>怎麼玩（第一次玩建議先跑「新手教學」）</h4><div class="note" style="font-size:14px;line-height:1.8">
    🚐 到<b>鑑識車</b>選 ${C.carryTools} 件工具 → 🔎 走近發亮的「<b>!</b>」用工具（電腦：<b>數字鍵 1–5</b> 用工具、<b>E</b> 互動；手機：點小按鈕），工具<b>隨便用</b>（魯米諾一瓶 ${C.lumCharges} 次，回車上補充），結果會立刻跳出來、記進筆記本。<br>
    💡 魯米諾要<b>關燈</b>才看得到藍光：一人關燈、一人噴灑並記錄螢光位置。<br>
    🧫 樣本拿回車上分析；手機等證物交給小吳送實驗室：花<b>全隊共用的實驗室額度</b>（${C.labBudget} 點），約 ${C.labSec} 秒後報告回來。<br>
    📖 筆記本的<b>鑑識手冊</b>會自動打 ✔／✖，左上角「案情進度」跟著上升。<br>
    👔 分局長偶爾會走進來，頭上泡泡是他的要求，做到後走到他旁邊交差；員警裡藏著<b>菜鳥</b>，頭上冒 ⚠️ 時走過去碰他。<br>
    ⚖️ 線索夠了隨時可以結案（分局長耐心歸零也會被要求結案）。分數＝答對多少＋早點結案＋省下的額度。</div>
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
    const cost = 0;
    const html = hdr('🚐 行動鑑識車') + `<div class="body" style="--vanbg:url(${url('van_interior')})">
      ${near ? '' : '<p class="why" style="font-size:14px">⚠️ 你離車子太遠了，走回車旁才能操作。</p>'}
      <h4>🧰 裝備架（最多帶 ${C.carryTools} 件・隨時免費更換）</h4>
      <div class="grid">${C.tools.map(t => `<div class="tc ${vanSel.includes(t.id) ? 'on' : ''}" data-tool="${t.id}"><img src="${url(t.icon)}" alt=""><b>${t.emoji} ${esc(t.name)}</b><small>${esc(t.desc)}</small></div>`).join('')}</div>
      <div class="row"><button class="pri" id="gearOk" ${same || !near || !vanSel.length ? 'disabled' : ''}>✅ 確認裝備${cost && !same ? `（-${cost}）` : ''}</button><span class="note">已選 ${vanSel.length}/${C.carryTools}</span>${p.tools.includes('luminol') ? `<button id="refill" ${near && p.lum < C.lumCharges ? '' : 'disabled'}>🧪 補充魯米諾（${p.lum}/${C.lumCharges}）</button>` : ''}</div>
      <h4>🔬 車上設備（樣本要由採集的人帶回來）</h4>
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(240px,1fr))">${C.machines.map(m => { const ss = p.samples.filter(s => s.kind === m.kind);
        return `<div class="mc"><div class="hd"><img src="${url(m.icon)}" alt="">${esc(m.name)}</div>${ss.length ? ss.map(s => `<div class="it"><span class="grow">🧫 ${esc(s.label)}</span><button data-an="${s.sid}" ${near ? '' : 'disabled'}>分析（免費）</button>${s.lab ? `<button data-slab="${s.sid}" ${near && G.st.budget >= C.sampleLabAP + G.st.costUp ? '' : 'disabled'}>送實驗室 DNA <span class="cost">額度 -${C.sampleLabAP + G.st.costUp}</span></button>` : ''}</div>`).join('') : '<span class="note">沒有這類樣本</span>'}</div>`; }).join('')}</div>
      <h4>🛵 實驗室快遞員・小吳</h4>
      <div class="mc">${p.bag.length ? p.bag.map(b => `<div class="it"><img src="${url(b.img)}" alt="" style="width:36px;height:36px"><span class="grow">${esc(b.name)}${b.size > 1 ? '（大型）' : ''}</span><button data-lab="${b.obj}" ${near && G.st.budget >= C.labCost[b.size] + G.st.costUp ? '' : 'disabled'}>送實驗室 <span class="cost">額度 -${C.labCost[b.size] + G.st.costUp}</span></button></div>`).join('') : '<span class="note">證物袋是空的。在現場把證物「裝袋」帶回來，或請小吳到現場取件。</span>'}
      <div class="note">送驗花<b>全隊共用的實驗室額度</b>（剩 ${G.st.budget} 點），約 ${C.labSec} 秒後報告回來${G.st.costUp ? `；分局長不高興，每次多花 ${G.st.costUp} 點` : ''}。</div>
      ${G.st.labs.map(l => `<div class="it">${l.back ? '✅' : '⏳'} ${esc(l.label)}：${l.back ? '報告已回來' : `約 ${Math.max(1, Math.ceil(l.due - G.st.clock))} 秒`}</div>`).join('')}</div>
      </div><footer><span class="note" style="flex:1">🧪 實驗室額度 ${G.st.budget}／${G.st.budgetMax}</span><button data-close="1">關閉</button></footer>`;
    const sc = $('#win .body') ? $('#win .body').scrollTop : 0;
    openOv('van', html, 'van', draw); const b = $('#win .body'); if (b) b.scrollTop = sc;
  };
  draw();
}
$('#win').addEventListener('click', e => {
  const t = e.target.closest('[data-tool]'); if (t && G.ovKind === 'van') { const id = t.dataset.tool; if (vanSel.includes(id)) vanSel = vanSel.filter(x => x !== id); else if (vanSel.length < C.carryTools) vanSel.push(id); else { vanSel.shift(); vanSel.push(id); } G.ovRender(); return; }
  if (e.target.closest('#refill')) return doAct({ type: 'refill' });
  if (e.target.closest('#gearOk')) { doAct({ type: 'gear', tools: vanSel }); vanSel = null; return; }
  const an = e.target.closest('[data-an]'); if (an) return doAct({ type: 'analyze', sid: +an.dataset.an });
  const sl = e.target.closest('[data-slab]'); if (sl) return doAct({ type: 'slab', sid: +sl.dataset.slab });
  const lb = e.target.closest('[data-lab]'); if (lb) return doAct({ type: 'lab', obj: lb.dataset.lab });
  const tb = e.target.closest('[data-tab]'); if (tb) { noteTab = tb.dataset.tab; if (noteTab === 'man' && G.tut) G.tut.sawMan = true; G.ovRender(); return; }
  const cu = e.target.closest('[data-cul]'); if (cu) return doAct({ type: 'draft', field: 'culprit', v: cu.dataset.cul });
  const df = e.target.closest('[data-df]'); if (df) return doAct({ type: 'draft', field: df.dataset.df, v: df.dataset.v });
  const kk = e.target.closest('[data-key]'); if (kk) { const k = G.st.draft.keys.slice(); const i = k.indexOf(kk.dataset.key); if (i >= 0) k.splice(i, 1); else if (k.length < 3) k.push(kk.dataset.key); else return toast('關鍵證據最多選 3 項', true); return doAct({ type: 'draft', field: 'keys', v: k }); }
  if (e.target.closest('#submit')) { if (confirm('確定送出推理報告？')) doAct({ type: 'submit' }); return; }
  if (e.target.closest('#tutHome2')) { LS.set('fs_tutDone', '1'); Tut.stop(); closeOv(); backHome('教學完成！可以開始正式案件了'); return; }
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
    if (noteTab === 'ev') G.noteSaw = st.found.map(f => f.id);
    if (noteTab === 'ev') body = st.found.length ? `<div class="evl">${st.found.slice().reverse().map(evRow).join('')}</div>` : '<p class="note">還沒有找到任何證據。</p>';
    else if (noteTab === 'man') body = manualHtml();
    else if (noteTab === 'sus') body = `<div class="sus">${C.suspects.map(s => suspectCard(s)).join('')}</div>`;
    else if (noteTab === 'log') body = (st.news || []).length ? st.news.slice().reverse().map(n => `<div class="it" style="margin:6px 0">⏱ ${mmss(n.t)}　${esc(n.text)}</div>`).join('') : '<p class="note">目前沒有特別狀況。</p>';
    else body = `<div class="ev"><img src="${url(C.victim.img)}" alt="" style="width:72px;height:72px"><div><b>死者：${esc(C.victim.name)}</b><span>${esc(C.victim.note)}</span></div></div>${C.briefing.map(t => `<p style="line-height:1.7">${esc(t)}</p>`).join('')}
      <h4>分局長鄭督察</h4><div class="note" style="font-size:14px">他偶爾會走進封鎖線巡視，頭上的泡泡寫著要求（某份報告，或案情進度百分比）。做到之後走到他旁邊就算交差（每人 +1 點）；拖太久他會離開並扣點或拖慢實驗室，連續 ${C.pressure.bossStrikes} 次就要求立刻結案。目前：交差 ${st.bossOk || 0} 次、沒做到 ${st.bossFail || 0} 次。</div>
      <h4>💡 電燈開關</h4><div class="note" style="font-size:14px">魯米諾的藍光很弱：一個人關燈、另一個人噴灑並「記錄螢光位置」。開燈後螢光看不到了，但黃色標示牌和筆記會留著。</div>`;
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
      <p class="note">${G.mode === 'online' ? '大家可以一起改這份報告（即時同步），最後由房主送出。' : '填好後送出。'}可以打開「鑑識手冊」對照。</p>
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
  const html = hdr('📁 結案報告', true) + `<div class="body res"><div class="rank">${R.rank}</div><p style="text-align:center;font-size:20px;margin:4px 0 12px">${R.total} / 100 分${R.bonus ? `<br><small style="color:var(--dim);font-size:13px">基本 ${R.base}＋獎勵 ${R.bonus}${R.pen ? ` ${R.pen}` : ''}${R.raw > 100 ? '（滿分 100）' : ''}</small>` : ''}</p>
    <table>${R.rows.map(r => `<tr><td>${r.label}</td><td class="${r.ok ? 'ok' : 'ng'}">${r.ok ? '✔' : '✖'} ${esc(r.pick)}${r.ok ? '' : `<br><small>正解：${esc(r.right)}</small>`}</td><td style="text-align:right">${r.pts}/${r.max}</td></tr>`).join('')}
    <tr><td>關鍵證據</td><td>${R.keys.map(k => `${esc(k.name)}（+${k.pts}）`).join('<br>') || '—'}</td><td style="text-align:right">${R.keyPts}/15</td></tr>
    ${R.timeB != null ? `<tr><td>結案速度</td><td>分局長耐心還剩 ${Math.round(G.st.patience)}%</td><td style="text-align:right">+${R.timeB || 0}/10</td></tr><tr><td>實驗室額度</td><td>花了 ${R.spent} 點（剩 ${G.st.budget}／${G.st.budgetMax}）</td><td style="text-align:right">+${R.budB || 0}/5</td></tr>` : ''}
    ${R.pen ? `<tr><td>兇手逃離</td><td class="ng">讓兇手離開了現場</td><td style="text-align:right">${R.pen}</td></tr>` : ''}</table>
    <p class="note">找到 ${R.found} 項證據・調查 ${mmss(R.clock)}・分局長：交差 ${R.bossOk || 0} 次／沒做到 ${R.bossFail || 0} 次</p>
    <h4>🔍 真相</h4><div class="truth">${C.truth.map(t => `<p>${esc(t)}</p>`).join('')}</div></div>
    <footer>${G.tut ? '<button class="pri" id="tutHome2">🎓 完成教學，回首頁</button>' : G.mode === 'solo' ? '<button id="home2">🏠 回首頁</button><button class="pri" id="again">🔁 下一個案件</button>' : (isHost() ? '<button id="home2">🚪 離開房間</button><button class="pri" id="again">🔁 回房間開新案件</button>' : '<button id="home2">🚪 離開房間</button><span class="note">等房主開新案件…</span>')}</footer>`;
  openOv('result', html);
}
$('#bNote').onclick = () => openNote();
$('#bClose').onclick = () => { if (confirm('結案進入推理？之後就不能再採證了。\n（越早結案、省下越多實驗室額度，分數越高）')) doAct({ type: 'close' }); };
$('#bMenu').onclick = () => {
  openOv('menu', hdr('☰ 選單') + `<div class="body"><div class="opts">
    <button data-m="brief">📋 案件簡報與玩法</button>
    <button data-m="amb">${Snd.ambOn ? '🔊 環境音：開' : '🔇 環境音：關'}</button>
    ${G.tut ? '<button data-m="tquit">🏠 離開教學</button>' : G.mode === 'solo' ? '<button data-m="home">🏠 回首頁（進度會保存）</button>' : `<button data-m="leave">🚪 離開房間</button>${G.host ? '<button data-m="dissolve" class="warn">💥 解散房間</button>' : ''}`}
    </div><p class="note">案件編號 #${C.seed}・難度 ${esc(C.diffName)}</p></div>`);
};
$('#win').addEventListener('click', e => {
  const m = e.target.closest('[data-m]'); if (!m) return; const k = m.dataset.m;
  if (k === 'brief') openBriefing();
  if (k === 'amb') { Snd.ambOn = !Snd.ambOn; LS.set('fs_amb', Snd.ambOn ? '1' : '0'); if (Snd.ambOn) { Snd.init(); Snd.startAmb(); } else Snd.stopAmb(); m.textContent = Snd.ambOn ? '🔊 環境音：開' : '🔇 環境音：關'; }
  if (k === 'home') { saveSolo(); backHome(); }
  if (k === 'tquit') { Tut.stop(); backHome(); }
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
/* ================= 新手教學（固定案件、一步一步帶著做、不會失敗） ================= */
const TUT_SEED = 7;
const Tut = {
  steps: [
    { t: '這裡是命案別墅。慢慢來，這一關<b>不會失敗</b>。<br>用 <b>WASD／方向鍵</b>（手機：在畫面上<b>拖曳</b>）走到箭頭指的<b>封鎖線入口</b>。', at: () => ({ x: 470, y: 600 }), done: () => Math.hypot(G.Me.x - 470, G.Me.y - 600) < 90 },
    { t: '很好。工具都在<b>鑑識車</b>裡：走回車子旁邊，點車子<span class="kbonly">（或按 <kbd class="k">E</kbd>）</span>打開它。', at: () => ENG.objById(C, 'van'), done: () => G.ovKind === 'van', hl: ['#act [data-van]'] },
    { t: '選 <b>📷 鑑識相機</b>、<b>🧪 魯米諾</b>、<b>🔍 指紋採集組</b>，再按 <b>✅ 確認裝備</b>（隨時可以免費更換）。', done: () => { const p = meP(); return p.loaded && ['camera', 'luminol', 'prints'].every(t => p.tools.includes(t)); }, hl: ['[data-tool="camera"]', '[data-tool="luminol"]', '[data-tool="prints"]', '#gearOk'] },
    { t: '關掉車上視窗，走到客廳的<b>屍體</b>旁，用 <b>📷 近拍傷口</b>。<br><span class="kbonly">靠近物件時旁邊會出現小清單：<b>數字鍵 1–5</b> 用工具、<b>E</b> 互動（裝袋、開關燈、記錄螢光、開車門、問話），滑鼠點也可以。這裡按清單上近拍傷口前面的數字。<br></span><span class="touchonly">靠近物件時下方會出現一排小按鈕，點它就好。<br></span>用完工具會立刻跳出<b>結果卡</b>，告訴你發現什麼、記在哪裡。', at: () => ENG.objById(C, 'body'), done: () => ENG.hasEv(G.st, 'E_wound'), hl: ['#act [data-a="wound"]', '#win [data-close]'] },
    { t: '看到結果卡了嗎？證據已經記進筆記本。<br>接著對<b>客廳地毯</b>按 <b>🧪 噴灑魯米諾</b>——燈亮著是看不到藍光的。<br>魯米諾一瓶 3 次，工具格右下角會顯示剩幾次，用完回車上補充。', at: () => ENG.objById(C, 'floor_living'), done: () => G.st.obj.floor_living.done.lum, hl: ['#act [data-a="lum"]'] },
    { t: '去客廳門邊的 <b>💡 電燈開關</b>把燈關掉<span class="kbonly">（按 <kbd class="k">E</kbd>）</span>。<br>多人時可以一人關燈、一人噴灑記錄。', at: () => ENG.objById(C, 'sw_living'), done: () => G.st.lights.living === false, hl: ['#act [data-k="light"]'] },
    { t: '暗下來了，手電筒照向你面對的方向。地毯浮出<b>藍色螢光</b>！<br>回到地毯按 <b>記錄螢光位置</b><span class="kbonly">（按 <kbd class="k">E</kbd>）</span>。', at: () => ENG.objById(C, 'floor_living'), done: () => G.st.obj.floor_living.marked, hl: ['#act [data-a="lum_mk"]'] },
    { t: '記下來了（黃色標示牌，開燈後也會留著）。<br>燈還關著，去<b>銅雕獎座</b>：先 <b>🧪 噴灑魯米諾</b>、<b>記錄螢光位置</b>，再按 <b>🔍 採集指紋</b>。<br>指紋是「樣本」，要拿回車上分析才知道是誰的。', at: () => ENG.objById(C, 'w_statue'), done: () => ENG.hasEv(G.st, 'E_wb_statue') && ((meP().samples.length > 0) || G.st.rep.print > 0), hl: ['#act [data-a="lum"]', '#act [data-a="lum_mk"]', '#act [data-a="prints"]'] },
    { t: '左上角的 <b>📋 待處理</b> 會列出樣本。回<b>鑑識車</b>，在「指紋比對電腦」按 <b>分析</b>。', at: () => ENG.objById(C, 'van'), done: () => G.st.rep.print > 0, hl: ['#act [data-van]', '[data-an]'] },
    { t: '指紋比對出來了！再去拿<b>死者的手機</b>：按 <b>🛍️ 裝袋帶走</b><span class="kbonly">（按 <kbd class="k">E</kbd>）</span>。', at: () => ENG.objById(C, 'phone'), done: () => G.st.obj.phone.gone, hl: ['#act [data-k="bag"]', '#win [data-close]'] },
    { t: '回車上把手機交給快遞員<b>小吳</b>（車旁那位）送實驗室：按 <b>送實驗室</b>。<br>送驗會花<b>全隊共用的實驗室額度</b>（上方 🧪），這是唯一要省著用的東西。', at: () => ENG.objById(C, 'courier'), done: () => G.st.labs.length > 0, hl: ['#act [data-van]', '[data-lab]'] },
    { t: '實驗室要等一下才回報（左上「待處理」看得到）。<br>咦，<b>分局長</b>走進封鎖線了。他頭上的<b>泡泡</b>就是他的要求——你剛好做完了，<b>走到他旁邊</b>交差。', enter() { G.st.forceBoss = { kind: 'report', rep: 'print' }; }, at: () => { const B = G.st.boss; return B && B.mode === 'in' ? { x: B.x, y: B.y - 110 } : null; }, done: () => G.st.bossOk > 0 },
    { t: '有位員警頭上冒出 <b>⚠️</b>——他其實是<b>菜鳥</b>，想去亂碰證物！<br>每局誰是菜鳥都不一定。<b>走過去碰他</b>，請他回崗位。', enter() { G.st.forceRookie = 'w_statue'; }, at: () => { const c = (G.st.cops || []).find(c => c.mode === 'in'); return c ? { x: c.x, y: c.y - 110 } : null; }, done: () => G.tut.ev.some(e => e.k === 'rookie_stop'), tick() { if (G.tut.ev.some(e => e.k === 'rookie_hit') && !(G.st.cops || []).some(c => c.mode === 'in')) { G.tut.ev = []; G.st.forceRookie = 'w_statue'; } } },
    { t: '做得好。打開 <b>📒 筆記本</b>，看看「證據」（新的有<span class="newb">新</span>標記），再切到 <b>📖 鑑識手冊</b>：每種手法有 3 個特徵，✔ 是確認、✖ 是排除。', enter() { for (const l of G.st.labs) if (!l.back) l.due = G.st.clock; }, done: () => G.tut.sawMan, hl: ['#bNote', '[data-tab="man"]'] },
    { t: '線索齊了（左上「案情進度」）。關掉筆記本，按 <b>⚖️ 結案推理</b>。', done: () => G.st.phase !== 'play', hl: ['#bClose', '#win [data-close]'] },
    { t: '照鑑識手冊選：兇手、行兇方式、兇器、第一現場，再勾 1～3 項關鍵證據，按 <b>📨 送出推理報告</b>。', done: () => G.st.phase === 'result', hl: ['#submit'] },
    { t: '🎉 <b>教學完成！</b>正式案件裡兇手、手法、房間每局都不同，分局長和菜鳥偶爾才會出現。兇手想溜走前頭上會冒 <b>😰</b>，人少時按 <b>E</b>（或點提示列的按鈕）叫員警攔住他。不理分局長，他的<b>耐心</b>會掉得更快；耐心歸零就得結案。<br>分數＝答對多少＋早點結案＋省下的實驗室額度。<br>多人時可以分工：一人關燈、一人噴灑、一人跑車上。', last: true }
  ],
  start() {
    Snd.init(); this.stop(); G.mode = 'solo'; G.me = 0; G.host = true; G.room = null;
    C = GEN.generate(TUT_SEED, 'tut'); G.st = ENG.newGame(C, [{ pid: 0, name: myName(), ci: myCi() }], { pressure: false, tut: true });
    G.tut = { i: 0, ev: [], sawMan: false }; G.seen = new Set(); G.glinted = new Set(); document.body.classList.add('tutOn');
    enterGame(false); this.render(); Snd.startAmb();
  },
  stop() { G.tut = null; document.body.classList.remove('tutOn'); const b = $('#tut'); if (b) b.classList.add('hidden'); document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl')); },
  cur() { return G.tut && this.steps[G.tut.i]; },
  target() { const s = this.cur(); if (!s || !s.at || !G.st) return null; const p = s.at(); if (!p) return null; const o = p.h ? { x: p.x, y: p.y - (p.flat ? 0 : p.h) } : p; return o; },
  tick() {
    const s = this.cur(); if (!s) return;
    if (s.tick) s.tick();
    if (s.done && s.done()) { G.tut.i++; const n = this.cur(); if (n && n.enter) n.enter(); Snd.ding(false); this.render(); if (n && n.last) LS.set('fs_tutDone', '1'); }
    document.querySelectorAll('.hl').forEach(e => e.classList.remove('hl'));
    const c = this.cur(); if (c && c.hl) for (const sel of c.hl) document.querySelectorAll(sel).forEach(e => e.classList.add('hl'));
  },
  render() {
    const s = this.cur(), b = $('#tut'); if (!s) return;
    b.innerHTML = `<img src="${url('mentor_portrait')}" alt=""><div class="tx"><div class="st">🎓 新手教學　${G.tut.i + 1} / ${this.steps.length}　・沈組長</div>${s.t}<div>${s.last ? '<button class="pri" id="tutHome">🏠 回首頁開始正式案件</button>' : '<button id="tutSkip" style="font-size:12px;padding:4px 8px">跳過教學</button>'}</div></div>`;
    b.classList.remove('hidden');
  }
};
$('#tut').addEventListener('click', e => { if (e.target.closest('#tutSkip') && confirm('跳過新手教學？')) { Tut.stop(); backHome(); } if (e.target.closest('#tutHome')) { Tut.stop(); closeOv(); backHome(); } });
loadAssets().then(() => { initHome(); requestAnimationFrame(loop); if (/autosolo/.test(location.hash)) startSolo(false); if (/tutorial/.test(location.hash)) Tut.start(); });
// 測試用：屍體有沒有真的畫在畫面上（畫的順序＋實際像素：有屍體 vs 暫時拿掉屍體，畫面要明顯不同）
async function bodyCheck() {
  const o = ENG.objById(C, 'body'), fd = G.flatDrawn || [], i = fd.indexOf('body');
  const covers = ENG.flatOrder(C).filter(q => q.id !== 'body' && q.w * q.h >= 15000 && Math.abs(q.x - o.x) < (q.w + o.w) / 2 && Math.abs(q.y - o.y) < (q.h + o.h) / 2).map(q => q.id);
  const drawnOnTop = i >= 0 && covers.every(id => fd.indexOf(id) < i);
  const frame = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const grab = () => { const [x0, y0] = W2S(o.x - o.w * .35, o.y - o.h * .25), [x1, y1] = W2S(o.x + o.w * .35, o.y + o.h * .25), k = cv.width / VW;
    const sx = Math.max(0, Math.round(x0 * k)), sy = Math.max(0, Math.round(y0 * k)), sw = Math.min(Math.round((x1 - x0) * k), cv.width - sx), sh = Math.min(Math.round((y1 - y0) * k), cv.height - sy);
    return sw > 0 && sh > 0 ? ctx.getImageData(sx, sy, sw, sh).data : null; };
  await frame(); const A = grab(); if (!A) return { drawnOnTop, covers, onScreen: false, ratio: 0 };
  G.hideBody = true; await frame(); const B = grab(); G.hideBody = false; await frame();
  let diff = 0; for (let j = 0; j < A.length; j += 4) if (Math.abs(A[j] - B[j]) + Math.abs(A[j + 1] - B[j + 1]) + Math.abs(A[j + 2] - B[j + 2]) > 45) diff++;
  return { drawnOnTop, covers, onScreen: true, ratio: +(diff / (A.length / 4)).toFixed(3) };
}
window.__fs = { G, get C() { return C; }, ENG, doAct, openVan, openNote, openDeduce, refresh, Tut, bodyCheck };
