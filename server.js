'use strict';
/* 鑑識現場 — 線上合作房間伺服器（伺服器權威：調查規則都在這裡跑；只依賴 ws） */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { WebSocketServer } = require('ws');
const GEN = require('./docs/casegen.js');
const FS = require('./docs/engine.js');

const PORT = +process.env.PORT || 3000;
const IDLE_CLOSE_MS = +process.env.IDLE_CLOSE_MS || 40 * 60 * 1000;   // 房間 40 分鐘沒人操作就斷線
const ROOM_IDLE_MS = +process.env.ROOM_IDLE_MS || 10 * 60 * 1000;     // 沒人在線多久後清掉房間
const POS_MS = 100;
const TICK_MS = 200;                                                  // 壓力系統（NPC、菜鳥、時限、劣化）更新間隔
const TIME_SCALE = +process.env.TIME_SCALE || 1;                      // 測試用：時間加速                                                   // 位置廣播間隔
const PUB = path.join(__dirname, 'docs');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json', '.mp3': 'audio/mpeg' };

/* ---------- HTTP：提供前端頁面 ---------- */
const server = http.createServer((req, res) => {
  const u = (req.url || '/').split('?')[0];
  if (u === '/health' || u === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (u === '/ice') return serveIce(req, res);
  let rel = '';
  try { rel = decodeURIComponent(u === '/' ? '/index.html' : u); } catch (e) { rel = '/x'; }
  const file = path.normalize(path.join(PUB, rel));
  if (file.startsWith(PUB + path.sep) && MIME[path.extname(file)]) {
    return fs.readFile(file, (e, d) => {
      if (e) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); return res.end('找不到頁面'); }
      const img = /\.(png|jpg|webp|svg)$/.test(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)], 'cache-control': img ? 'public, max-age=3600' : 'no-cache' });
      res.end(d);
    });
  }
  if (u === '/favicon.ico') { res.writeHead(204); return res.end(); }
  res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('找不到頁面');
});

/* ---------- 語音的 ICE 伺服器（STUN＋TURN 中繼），做法和麻將相同 ----------
   1. CF_TURN_KEY_ID + CF_TURN_API_TOKEN   Cloudflare Realtime TURN
   2. METERED_DOMAIN + METERED_SECRET_KEY 或 METERED_API_KEY
   3. TURN_URLS + TURN_SECRET              自架 coturn（HMAC 短效帳密）
   4. TURN_URLS + TURN_USERNAME + TURN_CREDENTIAL
   都沒設 → Open Relay 公開 static-auth；TURN_DEFAULT=off 可關掉。 */
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }];
const ICE_TTL = 6 * 3600;
const OPENRELAY = { urls: ['turn:staticauth.openrelay.metered.ca:80', 'turn:staticauth.openrelay.metered.ca:80?transport=tcp', 'turn:staticauth.openrelay.metered.ca:443', 'turns:staticauth.openrelay.metered.ca:443?transport=tcp'], secret: 'openrelayprojectsecret' };
let iceCache = null;
function hmacTurn(urls, secret) {
  const username = `${Math.floor(Date.now() / 1000) + ICE_TTL}:fs${crypto.randomBytes(3).toString('hex')}`;
  return { urls, username, credential: crypto.createHmac('sha1', secret).update(username).digest('base64') };
}
const splitUrls = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
async function iceServers() {
  const E = process.env;
  if (E.CF_TURN_KEY_ID && E.CF_TURN_API_TOKEN) {
    if (iceCache && iceCache.until > Date.now()) return iceCache.v;
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(E.CF_TURN_KEY_ID)}/credentials/generate-ice-servers`, {
      method: 'POST', headers: { authorization: 'Bearer ' + E.CF_TURN_API_TOKEN, 'content-type': 'application/json' }, body: JSON.stringify({ ttl: ICE_TTL }) });
    if (!r.ok) throw new Error('cloudflare ' + r.status);
    const j = await r.json(); const list = Array.isArray(j.iceServers) ? j.iceServers : [j.iceServers];
    const v = { provider: 'cloudflare', iceServers: STUN.concat(list.filter(Boolean)) };
    iceCache = { v, until: Date.now() + (ICE_TTL - 600) * 1000 }; return v;
  }
  if (E.METERED_DOMAIN && (E.METERED_SECRET_KEY || E.METERED_API_KEY)) {
    if (iceCache && iceCache.until > Date.now()) return iceCache.v;
    const q = E.METERED_API_KEY ? 'apiKey=' + encodeURIComponent(E.METERED_API_KEY) : 'secretKey=' + encodeURIComponent(E.METERED_SECRET_KEY);
    const r = await fetch(`https://${E.METERED_DOMAIN.replace(/^https?:\/\//, '')}/api/v1/turn/credentials?${q}`);
    if (!r.ok) throw new Error('metered ' + r.status);
    const v = { provider: 'metered', iceServers: STUN.concat(await r.json()) };
    iceCache = { v, until: Date.now() + 3600 * 1000 }; return v;
  }
  if (E.TURN_URLS && E.TURN_SECRET) return { provider: 'coturn', iceServers: STUN.concat([hmacTurn(splitUrls(E.TURN_URLS), E.TURN_SECRET)]) };
  if (E.TURN_URLS && E.TURN_USERNAME) return { provider: 'static', iceServers: STUN.concat([{ urls: splitUrls(E.TURN_URLS), username: E.TURN_USERNAME, credential: E.TURN_CREDENTIAL || '' }]) };
  if (E.TURN_DEFAULT === 'off') return { provider: 'none', iceServers: STUN };
  return { provider: 'openrelay', iceServers: STUN.concat([hmacTurn(OPENRELAY.urls, OPENRELAY.secret)]) };
}
function serveIce(req, res) {
  const hd = { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' };
  if (over(ipLog(clientIp(req)).ice, LIM.iceIp, Date.now())) { res.writeHead(429, hd); return res.end('{"error":"slow"}'); }
  iceServers().then(v => { res.writeHead(200, hd); res.end(JSON.stringify(Object.assign({ ttl: ICE_TTL }, v))); },
    e => { console.error('ice', e.message); res.writeHead(200, hd); res.end(JSON.stringify({ ttl: 600, provider: 'stun-only', error: 'turn unavailable', iceServers: STUN })); });
}

/* ---------- 防濫用 ---------- */
const LIM = {
  joinConn: [8, 60 * 1000],          // 每條連線每分鐘最多試 8 次加入
  joinIp: [30, 10 * 60 * 1000],      // 每個 IP 10 分鐘最多 30 次加入新座位
  failIp: [12, 10 * 60 * 1000],      // 每個 IP 10 分鐘最多 12 次「找不到房號」
  createIp: [12, 10 * 60 * 1000],    // 每個 IP 10 分鐘最多開 12 間房
  msgConn: [400, 10 * 1000],         // 每條連線 10 秒最多 400 則訊息（含移動）
  actConn: [30, 10 * 1000],          // 調查動作 10 秒最多 30 次
  bcastConn: [40, 10 * 1000],        // 會廣播給全房的動作 10 秒最多 40 次
  iceIp: [60, 10 * 60 * 1000]
};
Object.keys(LIM).forEach(k => { const e = process.env['LIM_' + k.toUpperCase()]; if (e) LIM[k] = [+e, LIM[k][1]]; });   // 測試用
const MAX_ROOMS = +process.env.MAX_ROOMS || 2000;
const LOBBY_RECLAIM_MS = +process.env.LOBBY_RECLAIM_MS || 60 * 1000;
const ipLogs = new Map();
function over(log, [max, win], now) { while (log.length && now - log[0] > win) log.shift(); if (log.length >= max) return true; log.push(now); return false; }
function ipLog(ip) { let l = ipLogs.get(ip); if (!l) ipLogs.set(ip, l = { join: [], fail: [], create: [], ice: [], t: 0 }); l.t = Date.now(); return l; }
function clientIp(req) {
  const h = req.headers || {};
  const v = h['cf-connecting-ip'] || h['true-client-ip'] || String(h['x-forwarded-for'] || '').split(',')[0].trim() || (req.socket && req.socket.remoteAddress) || '?';
  return String(v).slice(0, 64);
}

/* ---------- 房間 ---------- */
const rooms = new Map();
const token = () => crypto.randomBytes(12).toString('hex');
function newCode() { let c; do { c = String(1000 + crypto.randomInt(9000)); } while (rooms.has(c)); return c; }
const send = (ws, msg) => { if (ws && ws.readyState === 1) ws.send(JSON.stringify(msg)); };
let voiceSeq = 0;
const RTC_MAX = 300, RTC_WIN = 20000;
function createRoom() {
  const code = newCode();
  const room = { code, slots: [null, null, null, null], phase: 'lobby', st: null, C: null, diff: 'normal', dead: false, lastActive: Date.now(), lastMsg: Date.now(), posDirty: false, posTimer: null };
  rooms.set(code, room); return room;
}
function roomView(room) {
  return { code: room.code, phase: room.phase, diff: room.diff, players: room.slots.map((p, i) => p ? { slot: i, name: p.name, ci: p.ci, host: !!p.host, online: !!p.ws, voice: p.voice ? { id: p.voice.id, n: p.voice.n, muted: p.voice.muted } : null, inGame: !!(room.st && room.st.players[i] && room.st.players[i].active) } : null) };
}
function each(room, f) { room.slots.forEach((p, i) => { if (p && p.ws) f(p, i); }); }
function broadcastRoom(room) { const v = roomView(room); each(room, p => send(p.ws, { t: 'room', room: v })); }
function broadcastState(room, ev) { if (!room.st) return; each(room, p => send(p.ws, { t: 'state', s: room.st, ev: ev || [] })); }
function startGame(room) {
  const players = room.slots.map((p, i) => p ? { pid: i, name: p.name, ci: p.ci } : null).filter(Boolean);
  const seed = crypto.randomInt(1, 2 ** 31 - 1);
  room.C = GEN.generate(seed, room.diff);
  room.st = FS.newGame(room.C, players, { pressure: process.env.PRESSURE !== 'off' }); room.phase = 'play';
  broadcastRoom(room); broadcastState(room, [{ k: 'start' }]);
  if (!room.posTimer) room.posTimer = setInterval(() => flushPos(room), POS_MS);
  if (!room.tickTimer) room.tickTimer = setInterval(() => tickRoom(room), TICK_MS);
}
function tickRoom(room) {
  if (room.dead || !room.st) { clearInterval(room.tickTimer); room.tickTimer = null; return; }
  if (room.st.phase !== 'play') return;
  if (!room.slots.some(p => p && p.ws)) return;     // 沒人在線就暫停時間
  const ev = FS.tick(room.C, room.st, TICK_MS / 1000 * TIME_SCALE);
  if (room.st.phase === 'deduce') room.phase = 'deduce';
  if (ev.length) broadcastState(room, ev);
  room.posDirty = true;
}
function flushPos(room) {
  if (room.dead) { clearInterval(room.posTimer); room.posTimer = null; return; }
  if (!room.posDirty || !room.st) return; room.posDirty = false;
  const st = room.st;
  const p = Object.values(st.players).filter(q => q.active).map(q => [q.pid, q.x, q.y, q.dir]);
  const n = st.npcs.filter(q => q.mode !== 'gone').map(q => [q.id, Math.round(q.x), Math.round(q.y), q.mode]);
  const c = (st.cops || []).map(q => [q.id, Math.round(q.x), Math.round(q.y), q.mode]);
  const b = st.boss ? [Math.round(st.boss.x), Math.round(st.boss.y), st.boss.mode] : null;
  each(room, s => send(s.ws, { t: 'pos', p, n, c, b, clock: Math.round(st.clock) }));
}
function cleanName(n) { return String(n || '').replace(/[<>&"'`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 10) || '鑑識員'; }
function cleanCi(ci) { ci = +ci; return Number.isInteger(ci) && ci >= 0 && ci < 4 ? ci : 0; }
function cleanText(t) { return String(t || '').replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 120); }
// 只留下動作需要的欄位、型別正確（規則引擎還會再驗證一次）
function cleanAct(a) {
  if (!a || typeof a !== 'object' || Array.isArray(a)) return null;
  const T = ['gear', 'light', 'refill', 'callcops', 'boss', 'brief', 'dispatch', 'observe', 'calm', 'mgStart', 'mgCancel', 'use', 'bag', 'courier', 'analyze', 'slab', 'lab', 'close', 'draft', 'submit'];
  if (!T.includes(a.type)) return null;
  const o = { type: a.type }, s = v => typeof v === 'string' ? v.slice(0, 40) : undefined;
  if (s(a.obj)) o.obj = s(a.obj);
  if (s(a.act)) o.act = s(a.act);
  if (Number.isInteger(a.sid)) o.sid = a.sid;
  if (typeof a.score === 'number' && Number.isFinite(a.score)) o.score = a.score;   // 小遊戲分數（引擎再檢查範圍與時間）
  if (Array.isArray(a.tools)) o.tools = a.tools.slice(0, 8).map(s).filter(Boolean);
  if (s(a.field)) o.field = s(a.field);
  if (a.v === null || typeof a.v === 'string') o.v = a.v === null ? null : a.v.slice(0, 40);
  else if (Array.isArray(a.v)) o.v = a.v.slice(0, 10).map(s).filter(Boolean);
  return o;
}
function attach(ws, room, s, isNew) {
  const p = room.slots[s];
  if (p.ws && p.ws !== ws) { send(p.ws, { t: 'kicked', msg: '你在別的分頁連線了' }); p.ws.ctx = null; try { p.ws.close(); } catch (e) { } }
  p.ws = ws; p.offAt = 0; ws.ctx = { room, slot: s }; room.lastActive = room.lastMsg = Date.now();
  send(ws, { t: 'joined', code: room.code, slot: s, token: p.token, rejoin: !isNew });
  broadcastRoom(room);
  if (room.st) { const q = room.st.players[s]; if (q && q.mg) q.mg = null;   // 重新連線：之前沒做完的小遊戲作廢（不然會一直卡在「分析中」）
    send(ws, { t: 'state', s: room.st, ev: [{ k: 'sync' }] }); }
}
function detach(ws) {
  const c = ws.ctx; if (!c) return; ws.ctx = null;
  const { room, slot } = c; const p = room.slots[slot];
  if (!p || p.ws !== ws) return;
  p.ws = null; p.voice = null; p.offAt = Date.now(); room.lastActive = Date.now();
  broadcastRoom(room);
}
function detachSeat(ws, leaving) {
  const c = ws.ctx; if (!c) return;
  const { room, slot } = c; const p = room.slots[slot];
  detach(ws);
  if (!leaving || room.slots[slot] !== p) return;
  room.slots[slot] = null;
  if (!room.slots.some(Boolean)) return dissolveRoom(room, '');
  if (room.st && room.st.players[slot]) { const ev = FS.leave(room.C, room.st, slot); broadcastState(room, ev); }
  if (p.host) { const n = room.slots.find(x => x && x.ws) || room.slots.find(Boolean); if (n) n.host = true; }
  broadcastRoom(room);
}
function dissolveRoom(room, msg) {
  if (room.dead) return;
  room.dead = true; rooms.delete(room.code); clearInterval(room.posTimer); clearInterval(room.tickTimer); room.posTimer = room.tickTimer = null;
  for (const q of room.slots) { if (!q) continue; if (q.ws) { send(q.ws, { t: 'dissolved', msg }); q.ws.ctx = null; } q.ws = null; q.token = null; }
}

/* ---------- WebSocket ---------- */
const wss = new WebSocketServer({ server, path: '/ws', maxPayload: 24 * 1024 });
wss.on('connection', (ws, req) => {
  ws.isAlive = true; ws.on('pong', () => { ws.isAlive = true; });
  ws.ctx = null; ws.ip = clientIp(req); ws.lim = { join: [], msg: [], act: [], bcast: [] };
  ws.on('message', raw => {
    if (over(ws.lim.msg, LIM.msgConn, Date.now())) { try { ws.close(1008, 'too many messages'); } catch (e) { } return; }
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') return;
    try { handle(ws, m); } catch (e) { console.error('handle error', e); send(ws, { t: 'err', msg: '伺服器錯誤' }); }
  });
  ws.on('close', () => detach(ws));
});
const BCAST = new Set(['start', 'again', 'diff', 'vjoin', 'vleave', 'vmute', 'profile', 'leave', 'dissolve', 'chat']);
function handle(ws, m) {
  const c = ws.ctx;
  switch (m.t) {
    case 'ping': return send(ws, { t: 'pong' });
    case 'create': {
      const now = Date.now();
      if (over(ipLog(ws.ip).create, LIM.createIp, now)) return send(ws, { t: 'err', code: 'slow', msg: '開房太頻繁了，請稍後再試' });
      if (rooms.size >= MAX_ROOMS) return send(ws, { t: 'err', code: 'busy', msg: '伺服器房間已滿，請稍後再試' });
      if (c) detachSeat(ws, true);
      const room = createRoom();
      room.slots[0] = { name: cleanName(m.name), ci: cleanCi(m.ci), token: token(), ws: null, host: true };
      return attach(ws, room, 0, true);
    }
    case 'join': {
      const now = Date.now(), il = ipLog(ws.ip);
      const slow = () => send(ws, { t: 'err', code: 'slow', msg: '嘗試加入太多次了，請稍後再試' });
      if (over(ws.lim.join, LIM.joinConn, now) || il.fail.filter(t => now - t < LIM.failIp[1]).length >= LIM.failIp[0]) return slow();
      const room = rooms.get(String(m.code || '').trim().slice(0, 8));
      if (!room) { over(il.fail, LIM.failIp, now); return send(ws, { t: 'err', code: 'noroom', msg: '找不到這個房號（可能已過期）' }); }
      // 斷線重連只認 token，不用名字比對（避免別人用同名搶座位）
      const tok = typeof m.token === 'string' && /^[0-9a-f]{24}$/.test(m.token) ? m.token : null;
      let s = tok ? room.slots.findIndex(p => p && p.token === tok) : -1;
      if (c && !(c.room === room && c.slot === s)) detachSeat(ws, true);
      if (s >= 0) return attach(ws, room, s, false);
      if (over(il.join, LIM.joinIp, now)) return slow();
      if (room.phase !== 'lobby') return send(ws, { t: 'err', code: 'playing', msg: '這一房已經開始調查了，等他們結案再加入' });
      s = room.slots.findIndex(p => !p);
      if (s < 0) s = room.slots.findIndex(p => p && !p.ws && p.offAt && now - p.offAt > LOBBY_RECLAIM_MS);   // 大廳：遞補離線很久的座位（給新 token）
      if (s < 0) return send(ws, { t: 'err', code: 'full', msg: '房間已滿（4 人）' });
      const used = new Set(room.slots.filter((p, i) => p && i !== s).map(p => p.ci));
      let ci = cleanCi(m.ci); if (used.has(ci)) ci = [0, 1, 2, 3].find(i => !used.has(i));
      const hasHost = room.slots.some((p, i) => p && p.host && i !== s);
      room.slots[s] = { name: cleanName(m.name), ci, token: token(), ws: null, host: !hasHost };
      return attach(ws, room, s, true);
    }
  }
  if (!c) return send(ws, { t: 'err', msg: '尚未加入房間' });
  const { room, slot } = c; const p = room.slots[slot]; if (!p) return;
  room.lastActive = Date.now(); if (m.t !== 'mv') room.lastMsg = Date.now();
  if (BCAST.has(m.t) && over(ws.lim.bcast, LIM.bcastConn, Date.now())) return send(ws, { t: 'err', code: 'slow', msg: '操作太頻繁了，休息一下～' });
  switch (m.t) {
    case 'start': if (p.host && room.phase === 'lobby') startGame(room); break;
    case 'diff': if (p.host && room.phase === 'lobby' && GEN.DIFF[m.v]) { room.diff = m.v; broadcastRoom(room); } break;
    case 'again': if (p.host && room.phase !== 'lobby') { room.phase = 'lobby'; room.st = null; room.C = null; broadcastRoom(room); each(room, q => send(q.ws, { t: 'lobby' })); } break;
    case 'mv': {
      if (!room.st) break;
      const now = Date.now(), dt = (now - (p.mvAt || now - 100)) / 1000; p.mvAt = now;
      if (FS.move(room.C, room.st, slot, m.x, m.y, m.d, dt)) room.posDirty = true;
      else { const q = room.st.players[slot]; if (q) send(ws, { t: 'fix', x: q.x, y: q.y }); }
      break;
    }
    case 'act': {
      if (!room.st) break;
      if (over(ws.lim.act, LIM.actConn, Date.now())) return send(ws, { t: 'err', code: 'slow', msg: '動作太快了' });
      const a = cleanAct(m.a); if (!a) break;
      if ((a.type === 'close' || a.type === 'submit') && !p.host) return send(ws, { t: 'err', msg: '只有房主可以' + (a.type === 'close' ? '提早結案' : '送出推理報告') });
      const r = FS.act(room.C, room.st, slot, a);
      if (!r.ok) { if (a.type === 'boss' && m.a.quiet === true) break; return send(ws, { t: 'err', code: 'act', msg: r.err }); }   // 自動交差試不成就安靜略過
      if (room.st.phase === 'result') room.phase = 'result'; else if (room.st.phase === 'deduce') room.phase = 'deduce';
      broadcastState(room, r.ev);
      break;
    }
    case 'chat': {
      const text = cleanText(m.text); if (!text) break;
      each(room, q => send(q.ws, { t: 'chat', slot, name: p.name, text }));
      break;
    }
    case 'profile': if (room.phase === 'lobby') { p.name = cleanName(m.name); const ci = cleanCi(m.ci); if (!room.slots.some((q, i) => q && i !== slot && q.ci === ci)) p.ci = ci; broadcastRoom(room); } break;
    case 'vjoin': p.voice = { id: crypto.randomBytes(4).toString('hex'), n: ++voiceSeq, muted: !!m.muted }; broadcastRoom(room); break;
    case 'vleave': if (p.voice) { p.voice = null; broadcastRoom(room); } break;
    case 'vmute': if (p.voice) { p.voice.muted = !!m.muted; broadcastRoom(room); } break;
    case 'rtc': {   // 只轉送 offer / answer / ice；聲音本身 P2P，不經過伺服器
      if (!p.voice) break;
      const to = +m.to; const q = room.slots[to];
      const d = m.d || {}; if (!Number.isInteger(to) || to === slot || !q || !q.ws || !q.voice || !['offer', 'answer', 'ice'].includes(d.type)) break;
      if (m.vid !== q.voice.id) break;
      const now = Date.now(); p.rtcLog = (p.rtcLog || []).filter(t => now - t < RTC_WIN);
      if (p.rtcLog.length >= RTC_MAX) break; p.rtcLog.push(now);
      const out = { type: d.type };
      if (d.type === 'ice') out.c = d.c && typeof d.c === 'object' ? { candidate: String(d.c.candidate || '').slice(0, 1000), sdpMid: d.c.sdpMid == null ? null : String(d.c.sdpMid).slice(0, 32), sdpMLineIndex: d.c.sdpMLineIndex == null ? null : +d.c.sdpMLineIndex } : null;
      else out.sdp = String(d.sdp || '').slice(0, 15000);
      send(q.ws, { t: 'rtc', from: slot, vid: p.voice.id, d: out });
      break;
    }
    case 'leave': detachSeat(ws, true); send(ws, { t: 'left' }); break;
    case 'dissolve': if (p.host) dissolveRoom(room, '房主解散了房間'); break;
  }
}
/* 心跳 + 清理空房（不會對外 ping 任何服務，Render 沒人用就讓它睡） */
setInterval(() => {
  wss.clients.forEach(ws => { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; try { ws.ping(); } catch (e) { } });
  const now = Date.now();
  for (const [ip, l] of ipLogs) if (now - l.t > 15 * 60 * 1000) ipLogs.delete(ip);
  for (const [code, room] of rooms) {
    if (room.slots.some(p => p && p.ws)) {
      const talking = room.slots.filter(p => p && p.ws && p.voice).length >= 2;
      if (!talking && now - room.lastMsg > IDLE_CLOSE_MS) { for (const p of room.slots) if (p && p.ws) { send(p.ws, { t: 'idle' }); try { p.ws.close(); } catch (e) { } } }
      else { room.lastActive = now; continue; }
    }
    if (now - room.lastActive > ROOM_IDLE_MS) { room.dead = true; clearInterval(room.posTimer); clearInterval(room.tickTimer); rooms.delete(code); }
  }
}, +process.env.SWEEP_MS || 25000);

server.listen(PORT, () => console.log(`鑑識現場伺服器啟動：http://localhost:${PORT}  (rooms via /ws)`));
module.exports = { rooms, server };
