/* 美術資源清單＋佔位圖。
   每張圖都是 docs/assets/<name>.png；用 MUSE 生好同名、同比例的 PNG 直接覆蓋就會換上。
   檔案讀不到時，遊戲會用下面的程式畫佔位圖。tools/gen_assets.js 會把佔位圖輸出成 PNG、並產生 ART_PROMPTS.md。 */
(function (root) {
'use strict';
const STYLE = 'cozy-noir 2D game art in the style of a modern indie co-op game, clean bold dark outlines, soft cel shading, slightly chunky cute proportions, muted night palette (slate blue, warm wood, cream) with teal and amber accents, flat even lighting from the top-left, no text, no watermark, no logo';
const VIEW = 'seen from a fixed 3/4 oblique camera like Among Us (camera in front and above, looking down about 35 degrees, front faces and top faces both visible, no perspective vanishing)';
// g：分類；a：透明背景；w,h：檔案尺寸（px）；p：英文提示詞；z：中文說明
const M = [
  // ---- 角色 ----
  ...[['agent_1', 'teal', '青綠'], ['agent_2', 'amber orange', '琥珀橘'], ['agent_3', 'violet', '紫'], ['agent_4', 'sunflower yellow', '向日葵黃']].map(([n, c, zc], i) => ({ n, g: '角色', a: true, w: 192, h: 256,
    p: `full-body game sprite of a chibi forensic investigator in a white hooded Tyvek coverall with ${c} accent stripes, ${c} nitrile gloves, face mask and safety goggles pushed up, holding a small evidence case, ${['short black hair, calm', 'ponytail, energetic', 'round glasses, nerdy', 'buzz cut, sturdy build'][i]}, standing pose facing right, feet at the bottom center, about 2.5 heads tall`,
    z: `鑑識隊員 ${i + 1}（${zc}色），白色防護衣，面向右邊，腳在圖片底部中央` })),
  { n: 'npc_courier', g: '角色', a: true, w: 160, h: 224, p: 'full-body game sprite of a friendly police lab courier NPC, navy police windbreaker with reflective vest, motorcycle helmet under one arm, holding a sealed evidence box, standing pose facing left, feet at the bottom center, about 2.5 heads tall', z: '實驗室快遞員小吳，反光背心、抱著證物箱，面向左' },
  ...[
    ['npc_wife', 'an elegant middle-aged Taiwanese woman in a cream blouse and slacks, yoga mat on her shoulder, arms crossed nervously', '妻子陳美玲（現場站姿）'],
    ['npc_partner', 'a slim Taiwanese man in a navy suit jacket and tassel loafers, hands in pockets, too calm', '合夥人周子豪（現場站姿）'],
    ['npc_daughter', 'a young Taiwanese woman in an oversized grey hoodie and jeans, wiping tears, phone in hand', '女兒林佳穎（現場站姿）'],
    ['npc_maid', 'an older Taiwanese housekeeper with short permed grey hair, apron over floral blouse, holding a cloth bag', '管家吳淑芬（現場站姿）'],
    ['npc_neighbor', 'a balding retired Taiwanese man in a polo shirt and slippers, pointing at the house, grumpy', '鄰居黃國棟（現場站姿）'],
    ['npc_reporter', 'a Taiwanese female reporter in a trench coat with a press badge, holding up a phone to film', '記者蘇曉晴（現場站姿）'],
    ['npc_gardener', 'a tanned Taiwanese gardener in a straw hat, green work vest and rubber boots, holding pruning shears', '園丁高阿土（現場站姿）'],
    ['npc_supervisor', 'a stern 55-year-old Taiwanese police superintendent in a dark uniform with an overcoat and cap, holding a clipboard and a stopwatch', '分局長・鄭督察（設時限的上司）'],
    ['npc_rookie', 'a clumsy young Taiwanese rookie police officer, oversized cap tilted, coffee cup in one hand, tripping forward with a goofy worried face', '菜鳥員警小林（會闖進現場搗亂）']
  ].map(([n, p, z]) => ({ n, g: '角色', a: true, w: 160, h: 240, p: `full-body game sprite of ${p}, standing pose facing the camera slightly to the left, feet at the bottom center, about 2.5 heads tall, same chibi proportions as the forensic team`, z })),
  // ---- 人物肖像 ----
  { n: 'victim_photo', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 58-year-old Taiwanese man, wealthy art collector, silver swept-back hair, rimless glasses, burgundy cardigan over white shirt, dignified slight smile, plain dark teal background, like an ID photo', z: '死者林志遠，58 歲畫廊老闆，大頭照' },
  { n: 'suspect_wife', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 49-year-old elegant Taiwanese woman, shoulder-length wavy hair, pearl earrings, cream blouse, yoga mat strap on shoulder, worried composed expression, plain dark slate background', z: '嫌疑人：妻子陳美玲，49 歲，優雅、背瑜珈墊' },
  { n: 'suspect_partner', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 41-year-old Taiwanese man, gallery partner, slicked side-part hair, thin beard, navy wool suit jacket, open collar shirt, overly calm forced smile, plain dark slate background', z: '嫌疑人：合夥人周子豪，41 歲，深藍西裝外套（真兇，但表情別太明顯）' },
  { n: 'suspect_daughter', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 24-year-old Taiwanese woman, long hair with a pink hair clip missing on one side, oversized hoodie, teary defiant expression, plain dark slate background', z: '嫌疑人：女兒林佳穎，24 歲，帽T、平常戴粉紅髮夾' },
  { n: 'suspect_neighbor', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 55-year-old Taiwanese man, retired neighbor, balding with grey side hair, polo shirt and reading glasses on a cord, grumpy suspicious expression, plain dark slate background', z: '嫌疑人：鄰居黃國棟（目擊者），55 歲，脾氣差' },
  { n: 'suspect_reporter', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 30-year-old Taiwanese woman, crime reporter, short bob haircut, trench coat, press badge lanyard, holding a phone, sharp curious expression, plain dark slate background', z: '嫌疑人：社會線記者蘇曉晴，30 歲，風衣、記者證' },
  { n: 'suspect_gardener', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 50-year-old Taiwanese gardener, tanned skin, straw hat pushed back, green work vest, towel around neck, tired honest expression, plain dark slate background', z: '嫌疑人：園丁高阿土，50 歲，草帽、工作背心' },
  { n: 'suspect_maid', g: '肖像', a: false, w: 512, h: 512, p: 'bust portrait of a 61-year-old Taiwanese housekeeper, short permed grey hair, apron over floral blouse, rubber gloves in hand, nervous honest expression, plain dark slate background', z: '嫌疑人：管家吳淑芬，61 歲，圍裙、短燙髮' },
  // ---- 鑑識車 ----
  { n: 'van_exterior', g: '鑑識車', a: true, w: 640, h: 400, p: 'a white mobile forensic laboratory van (boxy panel van) with a teal stripe and amber roof light bar, side sliding door open showing equipment racks, parked facing left', z: '行動鑑識車外觀，側門打開，車頭朝左' },
  { n: 'van_interior', g: '鑑識車', a: false, w: 1280, h: 720, p: 'interior of a mobile forensic lab van seen from the open side door: stainless steel workbench, benchtop centrifuge, fingerprint comparison computer with two monitors, shoe-print database screen, wall racks with luminol spray bottles, fingerprint kits, swab tubes, evidence bags, warm work lamps, wide cinematic composition with empty space in the center for UI', z: '鑑識車內部背景（面板背景圖，中間留空給介面）' },
  // ---- 地板（可無縫重複） ----
  { n: 'floor_marble', g: '地板', a: false, w: 256, h: 256, p: 'seamless tileable floor texture, cream marble tiles with faint grey veins, top-down', z: '玄關大理石地板（無縫）' },
  { n: 'floor_wood', g: '地板', a: false, w: 256, h: 256, p: 'seamless tileable floor texture, warm honey oak parquet planks, top-down', z: '客廳木地板（無縫）' },
  { n: 'floor_study', g: '地板', a: false, w: 256, h: 256, p: 'seamless tileable floor texture, dark walnut wood planks with a subtle red persian rug pattern edge, top-down', z: '書房深色木地板（無縫）' },
  { n: 'floor_kitchen', g: '地板', a: false, w: 256, h: 256, p: 'seamless tileable floor texture, light grey and white checker ceramic kitchen tiles, top-down', z: '廚房磁磚（無縫）' },
  { n: 'ground_asphalt', g: '地板', a: false, w: 256, h: 256, p: 'seamless tileable ground texture, dark asphalt street at night with subtle speckles, top-down', z: '街道柏油路（無縫）' },
  { n: 'ground_grass', g: '地板', a: false, w: 256, h: 256, p: 'seamless tileable ground texture, short dark green lawn with a few muddy patches at night, top-down', z: '後院草地（無縫）' },
  // ---- 牆面（房間後牆的正面，可左右無縫重複） ----
  { n: 'wall_foyer', g: '牆面', a: false, w: 512, h: 168, p: 'seamless horizontally tileable interior back wall front face for a 2D game room, cream wainscoting with dark wood baseboard, small framed paintings, front view', z: '玄關後牆正面（左右無縫）' },
  { n: 'wall_living', g: '牆面', a: false, w: 512, h: 168, p: 'seamless horizontally tileable interior back wall front face, warm beige damask wallpaper, white crown molding, wooden baseboard, front view', z: '客廳後牆正面（左右無縫）' },
  { n: 'wall_study', g: '牆面', a: false, w: 512, h: 168, p: 'seamless horizontally tileable interior back wall front face, deep green wallpaper with brass picture rail, dark wood wainscoting, front view', z: '書房後牆正面（左右無縫）' },
  { n: 'wall_kitchen', g: '牆面', a: false, w: 512, h: 168, p: 'seamless horizontally tileable interior back wall front face, white subway tile backsplash with pale blue painted wall above, front view', z: '廚房後牆正面（左右無縫）' },
  // ---- 場景物件 ----
  ...[
    ['prop_police_tape', 120, 300, 'a yellow-and-black police crime scene tape strung between two orange traffic posts, vertical composition', '封鎖線'],
    ['prop_tree', 300, 380, 'a street tree with a round dark green canopy and a small grass bed', '路樹'],
    ['prop_shoe_rack', 200, 180, 'a low wooden shoe cabinet with neatly placed shoes and slippers on top', '鞋櫃'],
    ['prop_carpet', 760, 400, 'a large cream shaggy area rug lying flat on the floor, looks freshly cleaned, seen from above at an angle', '客廳米色長毛地毯（平放）'],
    ['prop_sofa', 460, 240, 'a brown leather three-seat chesterfield sofa facing the camera', '真皮沙發（面向鏡頭）'],
    ['prop_bookshelf', 260, 380, 'a tall dark wood bookshelf full of art books, one empty square spot on the top shelf', '書櫃，頂層有一格空位'],
    ['prop_statue', 140, 220, 'a heavy bronze art award trophy statuette of an abstract figure on a square bronze base, standing on a small black cabinet', '矮櫃上的銅雕獎座（方形底座）'],
    ['prop_coffee_table', 300, 140, 'a low walnut coffee table', '茶几'],
    ['prop_wine_glasses', 112, 104, 'two red wine glasses, one with a little wine left', '兩只紅酒杯（下毒兇器候選）'],
    ['prop_body', 380, 180, 'a middle-aged man in a burgundy cardigan lying face down on the floor, cartoonish and non-gory, no visible blood except a small dark stain near the head, with a chalk-style outline hint', '死者趴在地上（卡通、不血腥）'],
    ['prop_fireplace', 300, 280, 'a white marble fireplace with rounded corners, unlit, a small smear on one corner', '大理石壁爐（圓弧石角）'],
    ['prop_poker', 80, 200, 'an iron fireplace poker and tongs set on a small stand', '壁爐火鉗架'],
    ['prop_desk', 320, 220, 'a mahogany writing desk with stacks of gallery papers, a ledger and a desk lamp, one drawer slightly open', '紅木書桌'],
    ['prop_phone', 80, 52, 'a black smartphone lying flat on the floor, screen glowing with notifications', '地上的手機（平放）'],
    ['prop_planted_item', 68, 52, 'a small personal item (an earring, cufflink or hair clip) lying flat on the floor next to an evidence number marker', '屍體旁被栽贓的小物（平放，耳環／袖扣之類）'],
    ['prop_necktie', 140, 68, 'a dark silk necktie lying crumpled flat on the floor', '地上的絲質領帶（平放，勒斃兇器候選）'],
    ['prop_letter_opener', 100, 48, 'a long brass letter opener lying flat on the floor', '黃銅拆信刀（平放，刺殺兇器候選）'],
    ['prop_curtain_cord', 80, 240, 'a thick braided curtain cord with tassel hanging down beside a window frame', '窗簾繩（勒斃兇器候選）'],
    ['prop_knife_block', 120, 160, 'a wooden kitchen knife block with chef knives, one slot slightly askew', '刀架（刺殺兇器候選）'],
    ['prop_teacup', 80, 72, 'a white porcelain teacup with tea half full on a saucer', '茶杯（下毒兇器候選）'],
    ['prop_rug_study', 440, 220, 'a dark red persian rug lying flat on the floor', '書房波斯地毯（平放）'],
    ['prop_trash_can', 120, 160, 'a stainless steel kitchen pedal trash can with a crumpled pinkish wet towel on top', '垃圾桶＋濕毛巾'],
    ['prop_mop_bucket', 140, 200, 'a mop standing in a blue plastic bucket, mop head still wet', '拖把和水桶'],
    ['prop_counter', 420, 220, 'a kitchen counter with a sink, a bottle of bleach, a fridge with a paper chore chart taped on it', '流理台＋漂白水＋冰箱值日表'],
    ['prop_floor_mark', 300, 120, 'faint damp mop streaks on kitchen floor tiles, lying flat, very subtle', '後門前剛拖過的地板痕跡（平放、淡淡的）'],
    ['prop_back_door', 60, 260, 'a narrow wooden back door seen edge-on in a side wall, slightly ajar', '後門（側牆上，從側面看）'],
    ['prop_mud_prints', 400, 180, 'a trail of fresh men\'s loafer shoe prints in a muddy patch on the lawn, lying flat', '泥地上的一串樂福鞋印（平放）'],
    ['prop_garden_gate', 180, 240, 'a small wooden garden side gate, latch open', '後院側門'],
    ['prop_bush', 220, 160, 'a round garden bush', '樹叢']
  ].map(([n, w, h, p, z]) => ({ n, g: '場景物件', a: true, w, h, p: `single game prop: ${p}, isolated`, z })),
  // ---- 魯米諾特效 ----
  { n: 'fx_luminol_pool', g: '特效', a: true, w: 760, h: 400, p: 'glowing cyan-blue luminol reaction overlay: a large irregular blood pool stain shape with two long drag streaks leading to the right edge, soft neon glow, on transparent background, lying flat on the ground', z: '地毯上的魯米諾藍光：血泊＋往右的拖痕（疊在地毯上）' },
  { n: 'fx_luminol_spot', g: '特效', a: true, w: 160, h: 160, p: 'glowing cyan-blue luminol reaction overlay: small wiped smear and speckles, soft neon glow, transparent background', z: '小範圍魯米諾藍光（獎座、石角、拖把）' },
  // ---- 工具／設備／證物圖示 ----
  ...[
    ['tool_camera', 'a black forensic DSLR camera with a ring flash and a scale ruler', '鑑識相機'],
    ['tool_luminol', 'a luminol spray bottle glowing faint blue', '魯米諾噴瓶'],
    ['tool_prints', 'a fingerprint kit: magnetic brush, black powder jar and lifting tape', '指紋採集組'],
    ['tool_swab', 'a blood collection kit: sterile swab and sealed sample tube with red cap', '血液採取器'],
    ['tool_thermo', 'a digital forensic liver thermometer probe', '肝溫計'],
    ['tool_shoe', 'an electrostatic shoe-print lifter with a dental-stone cast', '足跡採集器'],
    ['eq_centrifuge', 'a benchtop laboratory centrifuge with lid open and sample tubes', '離心機'],
    ['eq_afis', 'a computer monitor showing two fingerprints side by side with matching points', '指紋比對電腦'],
    ['eq_shoedb', 'a tablet screen showing shoe sole patterns being compared', '鞋印資料庫'],
    ['ev_document', 'a paper document in a clear evidence sleeve with a red tag', '文件類證據'],
    ['ev_luminol', 'a glowing blue luminol stain sample on a card', '魯米諾反應'],
    ['ev_blood', 'a test tube of blood with a lab label', '血液檢驗'],
    ['ev_lab', 'a sealed lab report envelope with a police lab stamp', '實驗室報告'],
    ['ev_photo', 'a forensic photo print with an evidence number marker', '鑑識照片'],
    ['ev_print', 'a lifted fingerprint card', '指紋卡'],
    ['ev_thermo', 'a clock and thermometer symbol for time of death', '死亡時間'],
    ['ev_shoe', 'a shoe sole print card', '鞋印卡']
  ].map(([n, p, z]) => ({ n, g: '圖示', a: true, w: 128, h: 128, p: `game UI icon: ${p}, centered, simple readable silhouette, slight 3/4 angle`, z })),
  // ---- 介面 ----
  { n: 'title_logo', g: '介面', a: true, w: 1024, h: 320, p: 'game title logo artwork for a crime scene investigation co-op game: a magnifying glass, police tape and a fingerprint motif framing an EMPTY banner area (the Chinese title is added by the game, do not write any text)', z: '標題 Logo 底圖（不要有文字，中文標題遊戲會自己疊上）' },
  { n: 'lobby_bg', g: '介面', a: false, w: 1920, h: 1080, p: 'atmospheric night scene of a quiet Taiwanese suburban villa wrapped in police tape, a white forensic van with amber lights parked outside, light rain, wide composition with a dark calm area in the middle for menus', z: '大廳背景：夜晚別墅、封鎖線、鑑識車（中間留暗區放選單）' }
];
const byName = {}; M.forEach(m => { byName[m.n] = m; });

/* ---------------- 佔位圖（程式繪製） ---------------- */
const K = { ink: '#1d2333', suit: '#eef2f5', teal: '#2bb3a3', amber: '#f2a541', red: '#c8463d', violet: '#8a6fd1', yellow: '#f2d045', wood: '#a8743f', dwood: '#6b4426', cream: '#efe6d2', slate: '#2c3a4f', blue: '#4fd2ff', grey: '#9aa3ad' };
function rr(c, x, y, w, h, r, f, s, lw) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 3; c.stroke(); } }
function el(c, x, y, rx, ry, f, s, lw) { c.beginPath(); c.ellipse(x, y, Math.max(rx, .5), Math.max(ry, .5), 0, 0, Math.PI * 2); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 3; c.stroke(); } }
function pg(c, pts, f, s, lw) { c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1])); c.closePath(); if (f) { c.fillStyle = f; c.fill(); } if (s) { c.strokeStyle = s; c.lineWidth = lw || 3; c.stroke(); } }
function shade(hex, k) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); }
// 3/4 視角的箱子：上面 t 高的頂面＋正面
function box(c, x, y, w, h, t, col, lw) { const L = lw || 3; rr(c, x, y + t, w, h - t, 6, shade(col, -.18), K.ink, L); rr(c, x, y, w, t + 6, 6, shade(col, .12), K.ink, L); }
function shadowE(c, w, h, k) { el(c, w / 2, h - h * .06, w * (k || .42), h * .05, 'rgba(0,0,0,.25)'); }
function txt(c, s, x, y, sz, col, al) { c.font = `bold ${sz}px "Noto Sans CJK TC","Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif`; c.fillStyle = col || K.ink; c.textAlign = al || 'center'; c.textBaseline = 'middle'; c.fillText(s, x, y); }
function noise(c, w, h, col, n, sz, seed) { let s = seed || 7; const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280; c.fillStyle = col; for (let i = 0; i < n; i++) { c.globalAlpha = .25 + rnd() * .35; c.fillRect(rnd() * w, rnd() * h, sz * (0.5 + rnd()), sz * (0.5 + rnd())); } c.globalAlpha = 1; }
function agent(c, w, h, col, hair, extra) {
  const s = w / 192; c.save(); c.scale(s, s); const W = 192, H = 256;
  shadowE(c, W, H, .3);
  // 腳
  rr(c, 62, 206, 28, 38, 10, '#dfe5ea', K.ink, 4); rr(c, 102, 206, 28, 38, 10, '#dfe5ea', K.ink, 4);
  // 身體（防護衣）
  rr(c, 44, 104, 104, 116, 40, K.suit, K.ink, 5);
  c.fillStyle = col; c.fillRect(46, 160, 100, 12); c.fillRect(92, 108, 8, 108);
  // 證物箱
  rr(c, 130, 158, 40, 32, 5, K.slate, K.ink, 4); c.fillStyle = col; c.fillRect(138, 168, 24, 6);
  // 手
  el(c, 50, 168, 13, 13, col, K.ink, 4);
  // 頭（帽兜）
  el(c, 96, 74, 52, 50, K.suit, K.ink, 5);
  el(c, 104, 80, 36, 32, '#f3d2b3', K.ink, 4);
  // 頭髮
  c.fillStyle = hair; c.beginPath(); c.ellipse(104, 58, 34, 14, 0, Math.PI, 0); c.fill();
  // 眼睛
  el(c, 98, 80, 4, 5, K.ink); el(c, 120, 80, 4, 5, K.ink);
  // 護目鏡推到額頭
  rr(c, 70, 34, 64, 18, 9, col, K.ink, 4); el(c, 88, 43, 9, 6, '#bfe9ff'); el(c, 116, 43, 9, 6, '#bfe9ff');
  // 口罩
  rr(c, 92, 90, 34, 16, 6, '#cfe3ea', K.ink, 3);
  if (extra === 'glasses') { el(c, 98, 80, 9, 9, null, K.ink, 3); el(c, 120, 80, 9, 9, null, K.ink, 3); }
  c.restore();
}
function portrait(c, w, h, o) {
  const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, o.bg || '#34465e'); g.addColorStop(1, shade(o.bg || '#34465e', -.45)); c.fillStyle = g; c.fillRect(0, 0, w, h);
  const s = w / 512; c.save(); c.scale(s, s);
  // 肩膀衣服
  pg(c, [[86, 512], [110, 400], [180, 360], [332, 360], [402, 400], [426, 512]], o.cloth, K.ink, 6);
  if (o.collar) pg(c, [[226, 360], [256, 420], [286, 360]], o.collar, K.ink, 4);
  // 脖子臉
  rr(c, 226, 300, 60, 70, 20, o.skin || '#f0c9a5', K.ink, 5);
  if (o.hairBack) el(c, 256, 230, 118, 140, o.hair, K.ink, 6);
  el(c, 256, 220, 96, 112, o.skin || '#f0c9a5', K.ink, 6);
  // 頭髮
  c.fillStyle = o.hair; c.strokeStyle = K.ink; c.lineWidth = 6; c.beginPath(); c.ellipse(256, 168, 102, o.hairH || 66, 0, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
  // 五官
  el(c, 220, 222, 8, 10, K.ink); el(c, 292, 222, 8, 10, K.ink);
  c.strokeStyle = K.ink; c.lineWidth = 5; c.beginPath(); c.arc(256, o.sad ? 300 : 270, 22, o.sad ? 1.15 * Math.PI : .15 * Math.PI, o.sad ? 1.85 * Math.PI : .85 * Math.PI); c.stroke();
  if (o.glasses) { rr(c, 186, 200, 62, 42, 12, null, K.ink, 5); rr(c, 264, 200, 62, 42, 12, null, K.ink, 5); }
  if (o.beard) { c.fillStyle = 'rgba(40,30,30,.55)'; c.beginPath(); c.ellipse(256, 300, 60, 26, 0, 0, Math.PI); c.fill(); }
  if (o.clip) rr(c, 168, 150, 34, 14, 6, '#ff8fb8', K.ink, 3);
  if (o.pearl) { el(c, 160, 250, 8, 8, '#fff', K.ink, 3); el(c, 352, 250, 8, 8, '#fff', K.ink, 3); }
  c.restore();
  rr(c, 12, h - 58 * s, w - 24, 46 * s, 10 * s, 'rgba(10,15,25,.7)'); txt(c, o.label, w / 2, h - 35 * s, 26 * s, '#fff');
}
function tile(c, w, h, base, fn) { c.fillStyle = base; c.fillRect(0, 0, w, h); fn && fn(); }
function wall(c, w, h, base, fn) {
  c.fillStyle = base; c.fillRect(0, 0, w, h); fn && fn();
  c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, 0, w, 10);
  c.fillStyle = K.dwood; c.fillRect(0, h - 22, w, 22); c.fillStyle = 'rgba(0,0,0,.25)'; c.fillRect(0, h - 4, w, 4);
}
function icon(c, w, h, col, fn) { const s = w / 128; c.save(); c.scale(s, s); rr(c, 6, 6, 116, 116, 24, col, K.ink, 5); fn(c); c.restore(); }
function person(c, w, h, o) {
  const s = w / 160; c.save(); c.scale(s, s); shadowE(c, 160, 240, .3);
  rr(c, 52, 190, 22, 42, 8, o.leg || '#2a3550', K.ink, 4); rr(c, 86, 190, 22, 42, 8, o.leg || '#2a3550', K.ink, 4);
  rr(c, 34, 98, 92, 104, 32, o.cloth, K.ink, 5); if (o.stripe) { c.fillStyle = o.stripe; c.fillRect(36, 140, 88, 10); c.fillRect(36, 160, 88, 10); }
  el(c, 80, 62, 40, 40, o.skin || '#f0c9a5', K.ink, 5);
  if (o.hair) { c.fillStyle = o.hair; c.beginPath(); c.ellipse(80, 50, 42, o.hairH || 24, 0, Math.PI, 0); c.fill(); if (o.long) { c.fillRect(40, 50, 14, 40); c.fillRect(106, 50, 14, 40); } }
  if (o.hat) { c.fillStyle = o.hat; c.beginPath(); c.ellipse(80, 30, 52, 12, 0, 0, Math.PI * 2); c.fill(); rr(c, 52, 6, 56, 26, 10, o.hat, K.ink, 3); }
  el(c, 68, 66, 4, 5, K.ink); el(c, 92, 66, 4, 5, K.ink);
  if (o.prop) o.prop(c);
  c.restore();
}
const D = {
  npc_wife: (c, w, h) => person(c, w, h, { cloth: '#efe2c8', hair: '#3a2a20', long: true, leg: '#6b5a48', prop: c => rr(c, 118, 96, 16, 70, 6, '#8a6fd1', K.ink, 3) }),
  npc_partner: (c, w, h) => person(c, w, h, { cloth: '#23304f', hair: '#1d1d1d', leg: '#1d2333', prop: c => pg(c, [[70, 100], [80, 130], [90, 100]], '#dfe7f0', K.ink, 2) }),
  npc_daughter: (c, w, h) => person(c, w, h, { cloth: '#8c95a6', hair: '#26180f', long: true, leg: '#3d5a80', prop: c => rr(c, 50, 30, 14, 8, 3, '#ff8fb8', K.ink, 2) }),
  npc_maid: (c, w, h) => person(c, w, h, { cloth: '#b55a6a', hair: '#8f8f8f', hairH: 28, stripe: null, leg: '#4a3a3a', prop: c => rr(c, 50, 120, 60, 70, 8, '#f4f4f4', K.ink, 3) }),
  npc_neighbor: (c, w, h) => person(c, w, h, { cloth: '#4f7a6a', hair: '#9a9a9a', hairH: 10, leg: '#5a5040' }),
  npc_reporter: (c, w, h) => person(c, w, h, { cloth: '#b08a5a', hair: '#1d1d1d', hairH: 30, leg: '#2a2a2a', prop: c => { rr(c, 70, 104, 20, 26, 3, '#fff', K.ink, 2); rr(c, 118, 90, 22, 34, 4, '#1a1a1a', K.ink, 3); } }),
  npc_gardener: (c, w, h) => person(c, w, h, { cloth: '#5a7a3a', skin: '#c8956a', hat: '#d9c27a', leg: '#3a3a2a' }),
  npc_supervisor: (c, w, h) => person(c, w, h, { cloth: '#1f2a44', hat: '#1f2a44', leg: '#141b2c', stripe: '#c8a050', prop: c => rr(c, 112, 120, 30, 40, 3, '#e8e2d0', K.ink, 3) }),
  npc_rookie: (c, w, h) => person(c, w, h, { cloth: '#3a5a8a', hat: '#2a3a5a', leg: '#24324a', stripe: '#d7f24a', prop: c => { rr(c, 116, 112, 20, 26, 4, '#fff', K.ink, 3); el(c, 80, 84, 8, 5, K.ink); } }),
  suspect_neighbor: (c, w, h) => portrait(c, w, h, { cloth: '#4f7a6a', collar: '#fff', hair: '#9a9a9a', hairH: 26, glasses: true, label: '黃國棟・鄰居' }),
  suspect_reporter: (c, w, h) => portrait(c, w, h, { cloth: '#b08a5a', collar: '#f4f4f4', hair: '#1d1d1d', hairBack: true, hairH: 70, label: '蘇曉晴・記者' }),
  suspect_gardener: (c, w, h) => portrait(c, w, h, { cloth: '#5a7a3a', skin: '#c8956a', hair: '#d9c27a', hairH: 76, label: '高阿土・園丁' }),
  prop_planted_item: (c, w, h) => { el(c, w * .4, h * .55, w * .2, h * .22, '#ff8fb8', K.ink, 3); rr(c, w * .66, h * .1, w * .26, h * .5, 3, '#f2d045', K.ink, 2); },
  prop_necktie: (c, w, h) => { c.strokeStyle = '#2a3550'; c.lineWidth = h * .32; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * .1, h * .5); c.bezierCurveTo(w * .35, h * .1, w * .6, h * .9, w * .88, h * .45); c.stroke(); c.strokeStyle = '#c8463d'; c.lineWidth = 3; c.stroke(); },
  prop_letter_opener: (c, w, h) => { pg(c, [[w * .05, h * .5], [w * .62, h * .3], [w * .62, h * .7]], '#d9b25a', K.ink, 3); rr(c, w * .6, h * .28, w * .34, h * .44, 6, '#8a5a2a', K.ink, 3); },
  prop_curtain_cord: (c, w, h) => { rr(c, w * .05, h * .02, w * .5, h * .9, 4, '#8a2a3a', K.ink, 3); c.strokeStyle = '#c8a050'; c.lineWidth = 7; c.beginPath(); c.moveTo(w * .72, h * .02); c.quadraticCurveTo(w * .9, h * .5, w * .72, h * .78); c.stroke(); el(c, w * .72, h * .84, w * .14, h * .08, '#c8a050', K.ink, 3); },
  prop_knife_block: (c, w, h) => { shadowE(c, w, h); for (let i = 0; i < 3; i++) rr(c, w * (.3 + i * .14), h * .04, w * .06, h * .3, 2, '#3a2414', K.ink, 2); pg(c, [[w * .2, h * .3], [w * .8, h * .3], [w * .9, h * .94], [w * .1, h * .94]], '#a8743f', K.ink, 3); },
  prop_teacup: (c, w, h) => { el(c, w * .5, h * .82, w * .45, h * .12, '#f4f4f4', K.ink, 3); rr(c, w * .2, h * .3, w * .56, h * .5, 10, '#fff', K.ink, 3); el(c, w * .48, h * .32, w * .26, h * .08, '#b07a3a'); c.strokeStyle = K.ink; c.lineWidth = 3; c.beginPath(); c.arc(w * .82, h * .52, h * .12, -1.5, 1.5); c.stroke(); },
  prop_rug_study: (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 12, '#7a2633', '#c8a050', 6); rr(c, w * .1, h * .16, w * .8, h * .68, 8, null, '#c8a050', 4); el(c, w / 2, h / 2, w * .16, h * .18, null, '#e8d29a', 4); },
  agent_1: (c, w, h) => agent(c, w, h, K.teal, '#1d1d1d'),
  agent_2: (c, w, h) => agent(c, w, h, K.amber, '#5a3a22'),
  agent_3: (c, w, h) => agent(c, w, h, K.violet, '#2a2a40', 'glasses'),
  agent_4: (c, w, h) => agent(c, w, h, K.yellow, '#3d3d3d'),
  npc_courier: (c, w, h) => { const s = w / 160; c.save(); c.scale(s, s); shadowE(c, 160, 224, .32);
    rr(c, 48, 182, 24, 34, 8, '#2a3550', K.ink, 4); rr(c, 86, 182, 24, 34, 8, '#2a3550', K.ink, 4);
    rr(c, 34, 92, 92, 100, 34, '#25355a', K.ink, 5); c.fillStyle = '#d7f24a'; c.fillRect(36, 130, 88, 10); c.fillRect(36, 152, 88, 10);
    rr(c, 4, 120, 50, 40, 6, '#c9a36b', K.ink, 4); c.fillStyle = K.red; c.fillRect(8, 134, 42, 6);
    el(c, 82, 62, 40, 40, '#f0c9a5', K.ink, 5); c.fillStyle = '#222'; c.beginPath(); c.ellipse(82, 44, 40, 20, 0, Math.PI, 0); c.fill();
    el(c, 70, 64, 4, 5, K.ink); el(c, 92, 64, 4, 5, K.ink); c.beginPath(); c.arc(81, 74, 9, .2 * Math.PI, .8 * Math.PI); c.stroke();
    el(c, 132, 178, 22, 20, '#e8e8e8', K.ink, 4); c.restore(); },
  victim_photo: (c, w, h) => portrait(c, w, h, { bg: '#1f5c58', cloth: '#7a2633', collar: '#fff', hair: '#c9c9c9', hairH: 50, glasses: true, label: '林志遠（死者）' }),
  suspect_wife: (c, w, h) => portrait(c, w, h, { cloth: '#efe2c8', hair: '#3a2a20', hairBack: true, pearl: true, sad: true, label: '陳美玲・妻子' }),
  suspect_partner: (c, w, h) => portrait(c, w, h, { cloth: '#23304f', collar: '#dfe7f0', hair: '#1d1d1d', hairH: 54, beard: true, label: '周子豪・合夥人' }),
  suspect_daughter: (c, w, h) => portrait(c, w, h, { cloth: '#8c95a6', hair: '#26180f', hairBack: true, clip: true, sad: true, label: '林佳穎・女兒' }),
  suspect_maid: (c, w, h) => portrait(c, w, h, { cloth: '#b55a6a', collar: '#f4f4f4', hair: '#8f8f8f', hairH: 60, label: '吳淑芬・管家' }),
  van_exterior: (c, w, h) => { const s = w / 640; c.save(); c.scale(s, s); el(c, 320, 372, 290, 22, 'rgba(0,0,0,.3)');
    rr(c, 40, 120, 560, 230, 24, '#f4f6f8', K.ink, 6); rr(c, 40, 70, 470, 70, 18, '#ffffff', K.ink, 6);
    pg(c, [[40, 140], [40, 250], [-0, 250], [10, 170]], '#e8ecef', K.ink, 6);
    rr(c, 50, 150, 90, 70, 10, '#7fb6d6', K.ink, 5);
    c.fillStyle = K.teal; c.fillRect(42, 262, 556, 22);
    rr(c, 250, 150, 170, 170, 8, '#3a4352', K.ink, 5);
    for (let i = 0; i < 3; i++) { c.fillStyle = ['#4fd2ff', '#c8463d', '#f2a541'][i]; c.fillRect(268 + i * 50, 176, 30, 60); }
    c.fillStyle = '#aab4c0'; c.fillRect(262, 250, 146, 8); c.fillRect(262, 290, 146, 8);
    rr(c, 300, 50, 120, 22, 8, K.amber, K.ink, 4);
    el(c, 140, 350, 38, 38, '#2a2a2a', K.ink, 5); el(c, 140, 350, 16, 16, '#8a8a8a'); el(c, 500, 350, 38, 38, '#2a2a2a', K.ink, 5); el(c, 500, 350, 16, 16, '#8a8a8a');
    txt(c, '行動鑑識', 510, 210, 34, K.slate); c.restore(); },
  van_interior: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#3a4556'); g.addColorStop(1, '#1b2230'); c.fillStyle = g; c.fillRect(0, 0, w, h);
    const s = w / 1280; c.save(); c.scale(s, s);
    for (let i = 0; i < 5; i++) { rr(c, 60 + i * 240, 60, 200, 180, 10, '#2a3240', '#556070', 4); for (let j = 0; j < 4; j++) { c.fillStyle = ['#4fd2ff', '#f2a541', '#c8463d', '#9aa3ad'][(i + j) % 4]; c.fillRect(80 + i * 240 + j * 44, 90, 30, 60); } c.fillStyle = '#6b7686'; c.fillRect(70 + i * 240, 170, 180, 8); }
    rr(c, 0, 480, 1280, 240, 0, '#8d98a6'); c.fillStyle = '#b8c2cc'; c.fillRect(0, 470, 1280, 22);
    rr(c, 120, 360, 200, 120, 18, '#d9dee4', K.ink, 5); el(c, 220, 380, 70, 16, '#9aa3ad', K.ink, 4);
    rr(c, 520, 300, 240, 170, 10, '#1d2333', '#556070', 6); rr(c, 540, 318, 200, 130, 4, '#2bb3a3');
    rr(c, 960, 330, 200, 140, 10, '#1d2333', '#556070', 6); rr(c, 976, 346, 168, 108, 4, '#f2a541');
    c.fillStyle = 'rgba(255,220,150,.08)'; c.beginPath(); c.moveTo(560, 0); c.lineTo(720, 0); c.lineTo(900, 480); c.lineTo(380, 480); c.fill(); c.restore(); },
  floor_marble: (c, w, h) => tile(c, w, h, '#e6e2da', () => { c.strokeStyle = '#c9c3b8'; c.lineWidth = 3; c.strokeRect(1.5, 1.5, w / 2 - 3, h / 2 - 3); c.strokeRect(w / 2 + 1.5, h / 2 + 1.5, w / 2 - 3, h / 2 - 3); c.strokeRect(w / 2 + 1.5, 1.5, w / 2 - 3, h / 2 - 3); c.strokeRect(1.5, h / 2 + 1.5, w / 2 - 3, h / 2 - 3); noise(c, w, h, '#bdb6aa', 60, 3, 3); }),
  floor_wood: (c, w, h) => tile(c, w, h, '#c08a52', () => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? '#b77f48' : '#c99662'; c.fillRect(0, i * h / 8, w, h / 8 - 2); c.fillStyle = '#8e5f33'; c.fillRect(((i * 97) % w), i * h / 8, 3, h / 8); } }),
  floor_study: (c, w, h) => tile(c, w, h, '#5a3a24', () => { for (let i = 0; i < 6; i++) { c.fillStyle = i % 2 ? '#553620' : '#62412a'; c.fillRect(0, i * h / 6, w, h / 6 - 2); c.fillStyle = '#3b2414'; c.fillRect(((i * 131) % w), i * h / 6, 3, h / 6); } }),
  floor_kitchen: (c, w, h) => tile(c, w, h, '#e9edf0', () => { c.fillStyle = '#c4ccd3'; c.fillRect(0, 0, w / 2, h / 2); c.fillRect(w / 2, h / 2, w / 2, h / 2); c.strokeStyle = '#aab3bb'; c.lineWidth = 2; c.strokeRect(0, 0, w, h); }),
  ground_asphalt: (c, w, h) => tile(c, w, h, '#454b55', () => noise(c, w, h, '#6a717c', 220, 4, 11)),
  ground_grass: (c, w, h) => tile(c, w, h, '#4f7a3c', () => { noise(c, w, h, '#6f9a54', 260, 5, 5); noise(c, w, h, '#3c5e2d', 160, 5, 9); }),
  wall_foyer: (c, w, h) => wall(c, w, h, '#e8dcc3', () => { c.fillStyle = '#d5c6a8'; c.fillRect(0, h * .55, w, h * .45); rr(c, 60, 34, 70, 50, 4, '#6b8cae', K.dwood, 6); rr(c, 330, 30, 90, 56, 4, '#c8a050', K.dwood, 6); }),
  wall_living: (c, w, h) => wall(c, w, h, '#c9b79c', () => { for (let x = 16; x < w; x += 64) for (let y = 30; y < h - 30; y += 44) el(c, x + ((y / 44) % 2) * 32, y, 6, 9, 'rgba(255,255,255,.18)'); rr(c, 200, 30, 110, 70, 4, '#3f6b6a', '#c8a050', 7); }),
  wall_study: (c, w, h) => wall(c, w, h, '#40594b', () => { c.fillStyle = '#4a3020'; c.fillRect(0, h * .6, w, h * .4); c.fillStyle = '#c8a050'; c.fillRect(0, 26, w, 5); for (let x = 0; x < w; x += 64) { c.fillStyle = 'rgba(0,0,0,.15)'; c.fillRect(x, h * .6, 3, h * .4); } }),
  wall_kitchen: (c, w, h) => wall(c, w, h, '#bcd3df', () => { c.fillStyle = '#f2f4f5'; c.fillRect(0, h * .45, w, h * .55); c.strokeStyle = '#cfd6db'; c.lineWidth = 2; for (let y = h * .45; y < h - 22; y += 16) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); for (let x = ((y / 16) % 2) * 16; x < w; x += 32) { c.beginPath(); c.moveTo(x, y); c.lineTo(x, y + 16); c.stroke(); } } }),
  prop_police_tape: (c, w, h) => { shadowE(c, w, h, .3); rr(c, w * .4, h * .1, w * .2, h * .84, 6, K.amber, K.ink, 3); for (let i = 0; i < 4; i++) { c.fillStyle = '#fff'; c.fillRect(w * .4, h * (.2 + i * .2), w * .2, h * .05); } c.save(); c.translate(w / 2, h * .35); c.rotate(-.5); rr(c, -w, -10, w * 2, 20, 2, '#f2d045', K.ink, 2); c.fillStyle = K.ink; for (let x = -w; x < w; x += 22) c.fillRect(x, -10, 10, 20); c.restore(); },
  prop_tree: (c, w, h) => { shadowE(c, w, h, .35); rr(c, w * .44, h * .55, w * .12, h * .4, 8, K.dwood, K.ink, 4); el(c, w * .5, h * .38, w * .44, h * .32, '#2f5e3a', K.ink, 5); el(c, w * .38, h * .3, w * .2, h * .14, '#3f7a4a'); },
  prop_shoe_rack: (c, w, h) => { shadowE(c, w, h); box(c, w * .06, h * .3, w * .88, h * .62, h * .16, '#9a6a3c'); el(c, w * .3, h * .3, w * .12, h * .06, '#333'); el(c, w * .6, h * .3, w * .12, h * .06, '#a33'); },
  prop_handbag: (c, w, h) => { shadowE(c, w, h); c.strokeStyle = K.ink; c.lineWidth = 5; c.beginPath(); c.arc(w / 2, h * .42, w * .26, Math.PI, 0); c.stroke(); rr(c, w * .12, h * .4, w * .76, h * .5, 12, '#d8b98f', K.ink, 4); rr(c, w * .55, h * .28, w * .2, h * .2, 2, '#fff', K.ink, 2); },
  prop_carpet: (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 30, '#ede3cf', '#b9a98a', 6); rr(c, w * .08, h * .12, w * .84, h * .76, 24, null, '#d6c7a8', 5); noise(c, w, h, '#d2c3a5', 300, 4, 2); },
  prop_sofa: (c, w, h) => { shadowE(c, w, h, .46); rr(c, w * .04, h * .08, w * .92, h * .5, 26, '#7a4a2c', K.ink, 5); rr(c, w * .1, h * .44, w * .8, h * .3, 14, '#8f5934', K.ink, 4); rr(c, 0, h * .3, w * .12, h * .56, 16, '#6b3f24', K.ink, 5); rr(c, w * .88, h * .3, w * .12, h * .56, 16, '#6b3f24', K.ink, 5); rr(c, w * .1, h * .72, w * .8, h * .14, 6, '#5a3520', K.ink, 4); },
  prop_bookshelf: (c, w, h) => { shadowE(c, w, h); box(c, w * .06, h * .04, w * .88, h * .9, h * .06, '#5e3c22'); for (let i = 0; i < 4; i++) { const y = h * (.16 + i * .19); c.fillStyle = '#3b2414'; c.fillRect(w * .12, y + h * .15, w * .76, 6); for (let j = 0; j < 6; j++) { if (i === 0 && j === 4) continue; c.fillStyle = ['#c8463d', '#2bb3a3', '#f2a541', '#8a6fd1', '#e8e2d0', '#4f6d8f'][(i + j) % 6]; c.fillRect(w * (.14 + j * .12), y + h * .02, w * .09, h * .13); } } },
  prop_statue: (c, w, h) => { shadowE(c, w, h); box(c, w * .1, h * .62, w * .8, h * .32, h * .06, '#2b2b33'); rr(c, w * .26, h * .5, w * .48, h * .14, 3, '#9a6b2f', K.ink, 3); pg(c, [[w * .5, h * .06], [w * .66, h * .3], [w * .56, h * .5], [w * .44, h * .5], [w * .34, h * .28]], '#c08a3e', K.ink, 3); el(c, w * .5, h * .1, w * .1, h * .06, '#d9a24e', K.ink, 3); },
  prop_coffee_table: (c, w, h) => { shadowE(c, w, h, .46); box(c, w * .04, h * .1, w * .92, h * .6, h * .3, '#6b4426'); rr(c, w * .1, h * .66, w * .06, h * .28, 3, '#4a2e18', K.ink, 3); rr(c, w * .84, h * .66, w * .06, h * .28, 3, '#4a2e18', K.ink, 3); },
  prop_wine_glasses: (c, w, h) => { for (const x of [.3, .7]) { pg(c, [[w * (x - .16), h * .1], [w * (x + .16), h * .1], [w * (x + .1), h * .48], [w * (x - .1), h * .48]], 'rgba(220,235,245,.8)', K.ink, 3); c.fillStyle = '#7a1424'; c.fillRect(w * (x - .1), h * .34, w * .2, h * .12); c.fillStyle = K.ink; c.fillRect(w * x - 2, h * .48, 4, h * .32); el(c, w * x, h * .84, w * .14, h * .05, '#dfe8ef', K.ink, 2); } },
  prop_wine_bottle: (c, w, h) => { rr(c, w * .38, h * .02, w * .24, h * .3, 4, '#2c4a2a', K.ink, 3); rr(c, w * .12, h * .28, w * .76, h * .68, 12, '#24402a', K.ink, 3); rr(c, w * .2, h * .5, w * .6, h * .22, 3, '#efe6d2'); },
  prop_body: (c, w, h) => { c.setLineDash([10, 8]); rr(c, 6, 6, w - 12, h - 12, 40, null, 'rgba(255,255,255,.7)', 4); c.setLineDash([]); rr(c, w * .24, h * .26, w * .48, h * .44, 30, '#7a2633', K.ink, 4); el(c, w * .82, h * .46, w * .1, h * .2, '#bfbfbf', K.ink, 4); rr(c, w * .06, h * .3, w * .2, h * .14, 8, '#3a3f4a', K.ink, 3); rr(c, w * .06, h * .52, w * .2, h * .14, 8, '#3a3f4a', K.ink, 3); rr(c, w * .4, h * .06, w * .2, h * .16, 8, '#7a2633', K.ink, 3); rr(c, w * .44, h * .72, w * .2, h * .16, 8, '#7a2633', K.ink, 3); el(c, w * .9, h * .36, w * .04, h * .06, '#5a1a1a'); },
  prop_fireplace: (c, w, h) => { shadowE(c, w, h, .46); rr(c, w * .02, h * .06, w * .96, h * .2, 18, '#f3f1ec', K.ink, 4); rr(c, w * .08, h * .22, w * .84, h * .72, 14, '#e8e5de', K.ink, 4); rr(c, w * .26, h * .4, w * .48, h * .54, 40, '#2a2a2a', K.ink, 4); el(c, w * .14, h * .9, w * .1, h * .06, '#8a1f1f'); },
  prop_poker: (c, w, h) => { shadowE(c, w, h, .4); rr(c, w * .2, h * .84, w * .6, h * .1, 4, '#333', K.ink, 3); for (const x of [.32, .5, .68]) { c.strokeStyle = '#2a2a2a'; c.lineWidth = 6; c.beginPath(); c.moveTo(w * x, h * .86); c.lineTo(w * x, h * .08); c.stroke(); } el(c, w * .5, h * .06, w * .12, h * .04, '#c8a050', K.ink, 2); },
  prop_desk: (c, w, h) => { shadowE(c, w, h, .46); box(c, w * .04, h * .2, w * .92, h * .72, h * .26, '#7a3b24'); rr(c, w * .55, h * .58, w * .3, h * .12, 3, '#5f2c19', K.ink, 3); rr(c, w * .14, h * .06, w * .24, h * .2, 3, '#f3efe3', K.ink, 3); rr(c, w * .42, h * .1, w * .2, h * .16, 3, '#2d4a6b', K.ink, 3); el(c, w * .82, h * .1, w * .07, h * .08, K.amber, K.ink, 3); },
  prop_phone: (c, w, h) => { rr(c, 4, 4, w - 8, h - 8, 8, '#1a1a1a', K.ink, 3); rr(c, 10, 9, w - 20, h - 18, 4, '#4fd2ff'); },
  prop_hairclip: (c, w, h) => { rr(c, 4, h * .25, w - 8, h * .5, 8, '#ff8fb8', K.ink, 3); },
  prop_trash_can: (c, w, h) => { shadowE(c, w, h); rr(c, w * .14, h * .26, w * .72, h * .68, 10, '#b9c2cb', K.ink, 4); el(c, w * .5, h * .26, w * .38, h * .1, '#d4dbe1', K.ink, 4); el(c, w * .5, h * .16, w * .26, h * .1, '#e9b8b8', K.ink, 3); },
  prop_mop_bucket: (c, w, h) => { shadowE(c, w, h); c.strokeStyle = '#8a6a44'; c.lineWidth = 8; c.beginPath(); c.moveTo(w * .62, h * .02); c.lineTo(w * .5, h * .6); c.stroke(); rr(c, w * .14, h * .56, w * .72, h * .38, 10, '#3d7ec9', K.ink, 4); el(c, w * .5, h * .56, w * .36, h * .07, '#9fc4e6', K.ink, 3); },
  prop_counter: (c, w, h) => { shadowE(c, w, h, .48); box(c, w * .02, h * .36, w * .76, h * .58, h * .14, '#dfe3e6'); rr(c, w * .2, h * .38, w * .24, h * .08, 4, '#9aa3ad', K.ink, 3); rr(c, w * .8, h * .02, w * .18, h * .92, 8, '#f4f6f8', K.ink, 4); rr(c, w * .83, h * .2, w * .12, h * .14, 2, '#fff8c8', K.ink, 2); rr(c, w * .52, h * .16, w * .1, h * .22, 4, '#e8f4ff', K.ink, 3); },
  prop_floor_mark: (c, w, h) => { c.strokeStyle = 'rgba(120,150,170,.35)'; c.lineWidth = 10; for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(w * .05, h * (.2 + i * .2)); c.bezierCurveTo(w * .3, h * (.05 + i * .2), w * .6, h * (.35 + i * .2), w * .95, h * (.2 + i * .2)); c.stroke(); } },
  prop_back_door: (c, w, h) => { rr(c, w * .1, h * .02, w * .8, h * .96, 4, '#8a5a32', K.ink, 3); el(c, w * .5, h * .55, w * .14, h * .02, K.amber); },
  prop_mud_prints: (c, w, h) => { el(c, w / 2, h / 2, w * .48, h * .42, 'rgba(90,64,40,.75)'); for (let i = 0; i < 6; i++) { const x = w * (.1 + i * .15), y = h * (i % 2 ? .38 : .62); el(c, x, y, w * .045, h * .12, '#3a2614'); } },
  prop_garden_gate: (c, w, h) => { shadowE(c, w, h); for (let i = 0; i < 5; i++) rr(c, w * (.08 + i * .18), h * .12, w * .14, h * .82, 4, '#a07a52', K.ink, 3); c.fillStyle = '#7a5a3a'; c.fillRect(w * .06, h * .3, w * .88, h * .06); c.fillRect(w * .06, h * .7, w * .88, h * .06); },
  prop_bush: (c, w, h) => { shadowE(c, w, h, .4); el(c, w * .5, h * .55, w * .45, h * .36, '#2f5e3a', K.ink, 4); el(c, w * .36, h * .45, w * .18, h * .14, '#3f7a4a'); },
  fx_luminol_pool: (c, w, h) => { c.shadowColor = '#4fd2ff'; c.shadowBlur = 30; el(c, w * .4, h * .52, w * .2, h * .28, 'rgba(79,210,255,.55)'); el(c, w * .34, h * .44, w * .1, h * .12, 'rgba(160,240,255,.55)'); c.strokeStyle = 'rgba(79,210,255,.6)'; c.lineWidth = h * .07; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * .55, h * .45); c.lineTo(w * .98, h * .34); c.stroke(); c.beginPath(); c.moveTo(w * .55, h * .6); c.lineTo(w * .98, h * .5); c.stroke(); c.shadowBlur = 0; },
  fx_luminol_spot: (c, w, h) => { c.shadowColor = '#4fd2ff'; c.shadowBlur = 20; el(c, w * .5, h * .5, w * .3, h * .22, 'rgba(79,210,255,.55)'); for (let i = 0; i < 8; i++) el(c, w * (.2 + (i * 37 % 60) / 100), h * (.2 + (i * 53 % 60) / 100), 5, 4, 'rgba(160,240,255,.8)'); c.shadowBlur = 0; },
  tool_camera: (c, w, h) => icon(c, w, h, '#33415a', c => { rr(c, 22, 42, 84, 56, 10, '#1d1d1d', K.ink, 4); el(c, 64, 70, 20, 20, '#4a5a70', '#aab', 4); el(c, 64, 70, 8, 8, '#9fe'); rr(c, 30, 34, 22, 10, 3, '#1d1d1d'); }),
  tool_luminol: (c, w, h) => icon(c, w, h, '#1f3a5a', c => { rr(c, 44, 46, 40, 62, 10, '#e9f4ff', K.ink, 4); rr(c, 52, 26, 24, 22, 4, '#2bb3a3', K.ink, 4); c.fillStyle = '#4fd2ff'; c.fillRect(48, 70, 32, 22); el(c, 92, 34, 8, 6, 'rgba(79,210,255,.8)'); }),
  tool_prints: (c, w, h) => icon(c, w, h, '#3a3550', c => { for (let r = 10; r < 40; r += 7) { c.strokeStyle = '#e9e4ff'; c.lineWidth = 3; c.beginPath(); c.ellipse(64, 68, r * .8, r, 0, Math.PI * 1.1, Math.PI * 2.9); c.stroke(); } }),
  tool_swab: (c, w, h) => icon(c, w, h, '#4a2a33', c => { rr(c, 56, 24, 16, 74, 6, '#f3f3f3', K.ink, 3); rr(c, 52, 20, 24, 14, 4, K.red, K.ink, 3); c.fillStyle = '#b3202a'; c.fillRect(58, 70, 12, 24); }),
  tool_thermo: (c, w, h) => icon(c, w, h, '#2a4a40', c => { rr(c, 34, 30, 40, 60, 8, '#e8eef0', K.ink, 4); rr(c, 40, 38, 28, 18, 3, '#2bb3a3'); c.strokeStyle = '#ccd'; c.lineWidth = 6; c.beginPath(); c.moveTo(74, 80); c.lineTo(102, 104); c.stroke(); }),
  tool_shoe: (c, w, h) => icon(c, w, h, '#4a3a2a', c => { el(c, 64, 52, 18, 26, '#e7d9c4', K.ink, 3); el(c, 64, 90, 14, 14, '#e7d9c4', K.ink, 3); c.fillStyle = '#8a6a44'; for (let i = 0; i < 4; i++) c.fillRect(54, 38 + i * 9, 20, 3); }),
  eq_centrifuge: (c, w, h) => icon(c, w, h, '#33415a', c => { rr(c, 24, 50, 80, 50, 10, '#dfe5ea', K.ink, 4); el(c, 64, 50, 36, 12, '#9aa3ad', K.ink, 4); for (let i = 0; i < 6; i++) el(c, 64 + Math.cos(i) * 22, 50 + Math.sin(i) * 7, 4, 3, K.red); }),
  eq_afis: (c, w, h) => icon(c, w, h, '#2a3a4a', c => { rr(c, 18, 26, 92, 64, 6, '#1d2333', '#9ab', 4); for (const x of [42, 86]) for (let r = 6; r < 22; r += 5) { c.strokeStyle = '#4fd2ff'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, 58, r * .8, r, 0, 0, Math.PI * 2); c.stroke(); } rr(c, 54, 92, 20, 14, 2, '#9ab'); }),
  eq_shoedb: (c, w, h) => icon(c, w, h, '#3a3a2a', c => { rr(c, 26, 22, 76, 86, 8, '#1d2333', '#9ab', 4); el(c, 50, 58, 10, 22, K.amber); el(c, 80, 58, 10, 22, K.amber); }),
  ev_document: (c, w, h) => icon(c, w, h, '#4a4030', c => { rr(c, 34, 22, 60, 82, 4, '#fbf6ea', K.ink, 3); for (let i = 0; i < 5; i++) { c.fillStyle = '#9a8f7a'; c.fillRect(42, 36 + i * 12, 44, 4); } rr(c, 76, 86, 22, 12, 2, K.red); }),
  ev_luminol: (c, w, h) => icon(c, w, h, '#14243a', c => { c.shadowColor = '#4fd2ff'; c.shadowBlur = 14; el(c, 64, 66, 30, 22, 'rgba(79,210,255,.8)'); c.shadowBlur = 0; }),
  ev_blood: (c, w, h) => icon(c, w, h, '#3a1f26', c => { rr(c, 52, 20, 24, 88, 10, '#f3f3f3', K.ink, 3); c.fillStyle = '#b3202a'; c.fillRect(56, 56, 16, 46); rr(c, 48, 16, 32, 12, 4, '#ddd', K.ink, 3); }),
  ev_lab: (c, w, h) => icon(c, w, h, '#2a3a50', c => { rr(c, 22, 36, 84, 58, 6, '#e8dcc0', K.ink, 3); pg(c, [[22, 36], [64, 70], [106, 36]], '#d7c9a8', K.ink, 3); el(c, 64, 74, 12, 12, K.red, K.ink, 2); }),
  ev_photo: (c, w, h) => icon(c, w, h, '#30303a', c => { rr(c, 24, 28, 80, 66, 4, '#fff', K.ink, 3); rr(c, 32, 36, 64, 44, 2, '#5d6f8a'); pg(c, [[96, 80], [110, 104], [82, 104]], K.amber, K.ink, 3); }),
  ev_print: (c, w, h) => icon(c, w, h, '#30303a', c => { rr(c, 30, 24, 68, 80, 4, '#fff', K.ink, 3); for (let r = 6; r < 26; r += 5) { c.strokeStyle = '#333'; c.lineWidth = 2; c.beginPath(); c.ellipse(64, 64, r * .8, r, 0, Math.PI * 1.1, Math.PI * 2.9); c.stroke(); } }),
  ev_thermo: (c, w, h) => icon(c, w, h, '#2a3a30', c => { el(c, 54, 64, 30, 30, '#f4f4f4', K.ink, 4); c.strokeStyle = K.ink; c.lineWidth = 4; c.beginPath(); c.moveTo(54, 64); c.lineTo(54, 44); c.moveTo(54, 64); c.lineTo(68, 70); c.stroke(); rr(c, 90, 30, 12, 60, 6, '#fff', K.ink, 3); el(c, 96, 92, 10, 10, K.red, K.ink, 3); }),
  ev_shoe: (c, w, h) => icon(c, w, h, '#3a3020', c => { rr(c, 30, 22, 68, 84, 4, '#fff', K.ink, 3); el(c, 64, 52, 14, 20, '#5a4030'); el(c, 64, 86, 11, 11, '#5a4030'); }),
  title_logo: (c, w, h) => { const s = w / 1024; c.save(); c.scale(s, s); c.save(); c.translate(512, 160); c.rotate(-.06); rr(c, -520, -26, 1040, 52, 0, '#f2d045'); c.fillStyle = K.ink; for (let x = -520; x < 520; x += 60) { c.beginPath(); c.moveTo(x, -26); c.lineTo(x + 30, -26); c.lineTo(x + 10, 26); c.lineTo(x - 20, 26); c.fill(); } c.restore(); el(c, 140, 150, 80, 80, 'rgba(180,230,255,.25)', '#e8eef0', 16); c.strokeStyle = '#e8eef0'; c.lineWidth = 22; c.beginPath(); c.moveTo(196, 206); c.lineTo(250, 270); c.stroke(); c.restore(); },
  lobby_bg: (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0e1626'); g.addColorStop(.6, '#1d2a40'); g.addColorStop(1, '#0b0f18'); c.fillStyle = g; c.fillRect(0, 0, w, h); const s = w / 1920; c.save(); c.scale(s, s);
    pg(c, [[1150, 700], [1150, 420], [1420, 260], [1700, 420], [1700, 700]], '#2a3448', '#3d4a62', 6); for (const [x, y] of [[1220, 480], [1520, 480], [1220, 580], [1520, 580]]) rr(c, x, y, 90, 70, 4, '#f2c46a');
    rr(c, 0, 700, 1920, 380, 0, '#151b26'); c.fillStyle = '#f2d045'; c.fillRect(0, 760, 1920, 14); rr(c, 260, 560, 460, 180, 20, '#e8ecef'); c.fillStyle = K.teal; c.fillRect(262, 680, 456, 18); rr(c, 440, 540, 100, 20, 8, K.amber);
    c.fillStyle = 'rgba(160,190,230,.2)'; for (let i = 0; i < 160; i++) c.fillRect((i * 173) % 1920, (i * 97) % 1080, 2, 26); c.restore(); }
};
function paint(name, c, w, h) { const f = D[name]; if (!f) { rr(c, 2, 2, w - 4, h - 4, 10, '#8a6fd1', K.ink, 3); txt(c, name, w / 2, h / 2, Math.max(10, w / 10), '#fff'); return; } c.save(); f(c, w, h); c.restore(); }
const API = { STYLE, VIEW, list: M, byName, paint, K, el, rr, txt };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FS_ASSETS = API;
})(typeof self !== 'undefined' ? self : this);
