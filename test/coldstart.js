// v15：免費主機睡著（冷啟動）時：顯示「正在喚醒伺服器…（已等 N 秒）」、自動重試、醒來後自動開房；連按兩次也只開一間
const fs = require('fs');
const src = fs.readFileSync(__dirname + '/e2e.js', 'utf8'); const head = src.slice(0, src.indexOf('(async () => {'));
eval(head + `
(async () => {
  const br = await chromium.launch(); const PORT2 = 4700 + Math.floor(Math.random() * 200);
  const pg = await page(br, { viewport: { width: 1280, height: 800 } });
  await pg.goto(BASE + '?server=' + encodeURIComponent('ws://localhost:' + PORT2 + '/ws')); await sleep(800);
  await pg.fill('#name', '百九'); await pg.click('#bCreate'); await sleep(300); await pg.click('#bCreate'); await sleep(3500);
  const t1 = await pg.textContent('#srvLine'); console.log('伺服器還在睡：', t1);
  if (!/正在喚醒伺服器…（已等 \\d+ 秒/.test(t1)) errors.push('冷啟動時沒有顯示「正在喚醒伺服器…（已等 N 秒）」：' + t1);
  await sleep(4500); const t2 = await pg.textContent('#srvLine'); if (t2 === t1) errors.push('等待秒數沒有更新');
  // 8 秒後伺服器醒來
  process.env.PORT = String(PORT2); const { rooms } = require('../server.js');
  await pg.waitForFunction(() => /\\d{4}/.test(document.querySelector('#rmCode').textContent), null, { timeout: 20000 }).catch(() => errors.push('伺服器醒來後沒有自動開房'));
  await sleep(1500);
  console.log('醒來後：', await pg.textContent('#srvLine'), '房間數', rooms.size);
  if (rooms.size !== 1) errors.push('連按兩次「開房」開了 ' + rooms.size + ' 間房');
  await br.close();
  console.log('頁面／檢查錯誤：', errors.length ? errors : '無'); process.exit(errors.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
`);
