// node tools/gen_assets.js — 把 docs/assets.js 的佔位圖輸出成 docs/assets/*.png，並產生 ART_PROMPTS.md
// 需要 Playwright（NODE_PATH 指到有 playwright 的 node_modules）。已經換成 MUSE 圖的檔案不會被覆蓋（加 --force 才會）。
const fs = require('fs'), path = require('path');
const A = require('../docs/assets.js');
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'docs', 'assets');
const force = process.argv.includes('--force'), promptsOnly = process.argv.includes('--prompts');
function prompts() {
  const groups = {}; A.list.forEach(m => (groups[m.g] = groups[m.g] || []).push(m));
  let md = `# 美術提示詞（給 MUSE 生圖用）

共 **${A.list.length} 張圖**。每張圖都放在 \`docs/assets/<檔名>.png\`，**用同樣檔名、同樣比例的 PNG 直接覆蓋**就會換上（不用改程式）。
現在資料夾裡的是程式畫的佔位圖；檔案不見時遊戲也會自動畫佔位圖，不會壞掉。

## 共用風格（每一張提示詞都已經包含，換風格時兩段一起改）

- **STYLE**：${A.STYLE}
- **VIEW（場景、角色、物件用）**：${A.VIEW}

## 規則

- 「透明背景：是」＝輸出 PNG 透明背景（MUSE 選去背／transparent background），物體下緣貼齊圖片底部中央（角色腳底、家具底部）。
- 「平放」的物件（地毯、屍體、手機…）是躺在地上的，從斜上方看。
- 地板要能**上下左右無縫重複**；牆面要能**左右無縫重複**。
- 尺寸是建議的輸出像素；比例對就好，大一點沒關係（遊戲會等比縮放）。
- 角色一律朝右（隊員）或朝鏡頭偏左（NPC），遊戲會自動左右翻轉。

`;
  for (const [g, list] of Object.entries(groups)) {
    md += `\n## ${g}（${list.length}）\n`;
    for (const m of list) {
      const isTex = /^(floor|ground|wall)_/.test(m.n), isIcon = /^(tool|eq|ev)_/.test(m.n), isUi = /^(title|lobby)/.test(m.n), isPortrait = /^(suspect|victim)_/.test(m.n);
      const view = isTex ? 'straight top-down / front view texture' : isIcon ? 'icon, slight 3/4 angle' : isPortrait ? 'front-facing bust portrait' : isUi ? 'illustration' : A.VIEW;
      const full = `${m.p}. ${isTex || isIcon || isPortrait || isUi ? '' : A.VIEW + '. '}${A.STYLE}${m.a ? ', transparent background, PNG' : ''}.`;
      md += `\n### \`${m.n}.png\`\n- 尺寸：${m.w}×${m.h}px（${(m.w / m.h).toFixed(2)}:1）・透明背景：${m.a ? '是' : '否'}・視角：${isTex ? '貼圖' : isIcon ? '圖示' : isPortrait ? '正面半身' : isUi ? '插畫' : '3/4 斜俯視（Among Us 式）'}\n- 說明：${m.z}\n\n\`\`\`\n${full}\n\`\`\`\n`;
    }
  }
  fs.writeFileSync(path.join(ROOT, 'ART_PROMPTS.md'), md);
  console.log('ART_PROMPTS.md：', A.list.length, '張');
}
async function pngs() {
  const { chromium } = require('playwright');
  const b = await chromium.launch(); const pg = await b.newPage();
  await pg.setContent('<html><body></body></html>');
  await pg.addScriptTag({ path: path.join(ROOT, 'docs', 'assets.js') });
  fs.mkdirSync(OUT, { recursive: true }); let n = 0;
  for (const m of A.list) {
    const f = path.join(OUT, m.n + '.png');
    if (fs.existsSync(f) && !force && !fs.readFileSync(f).includes('fs-placeholder')) continue;   // 已經換成真的圖就不動
    const data = await pg.evaluate(([n, w, h]) => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; FS_ASSETS.paint(n, cv.getContext('2d'), w, h); return cv.toDataURL('image/png'); }, [m.n, m.w, m.h]);
    const buf = Buffer.from(data.split(',')[1], 'base64');
    // 在 PNG 裡加一個 tEXt 標記，之後重跑時才知道這張還是佔位圖
    const txt = Buffer.from('Comment\0fs-placeholder'); const chunk = Buffer.alloc(12 + txt.length); chunk.writeUInt32BE(txt.length, 0); chunk.write('tEXt', 4); txt.copy(chunk, 8);
    chunk.writeUInt32BE(crc(Buffer.concat([Buffer.from('tEXt'), txt])), 8 + txt.length);
    fs.writeFileSync(f, Buffer.concat([buf.subarray(0, 33), chunk, buf.subarray(33)])); n++;
  }
  await b.close(); console.log('PNG 佔位圖：', n, '張');
}
function crc(buf) { let c, t = []; for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } let r = 0xFFFFFFFF; for (const b of buf) r = t[(r ^ b) & 255] ^ (r >>> 8); return (r ^ 0xFFFFFFFF) >>> 0; }
prompts(); if (!promptsOnly) pngs().catch(e => { console.error(e); process.exit(1); });
