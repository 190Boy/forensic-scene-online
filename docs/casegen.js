/* 程序生成案件（恐鬼症式）：固定的「行兇方式 → 3 個鑑識特徵」對照表＋嫌疑人特徵表，
   每局用種子亂數決定兇手、行兇方式、兇器、第一現場、誘餌線索。前端與伺服器用同一個種子算出同一份案件。 */
(function (root) {
'use strict';
function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pick = (r, a) => a[Math.floor(r() * a.length)];
function shuffle(r, a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const hhmm = m => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/* ---------- 難度 ---------- */
const DIFF = {
  easy:   { name: '簡單', labBudget: 14, labSec: 40, patience: 1500, decoys: 1, tamperEvery: 300, rookieEvery: 380, rainAt: 960, oxidizeAt: 900, todWide: 660, ms: [0, 0, 1260], partialPrint: false, cops: 3, rookies: 1, boss: [170, 360, 210] },
  normal: { name: '普通', labBudget: 11, labSec: 55, patience: 1260, decoys: 2, tamperEvery: 240, rookieEvery: 320, rainAt: 780, oxidizeAt: 720, todWide: 540, ms: [0, 0, 1080], partialPrint: true, cops: 4, rookies: 1, boss: [150, 300, 180] },
  hard:   { name: '困難', labBudget: 9, labSec: 70, patience: 1020, decoys: 3, tamperEvery: 180, rookieEvery: 260, rainAt: 600, oxidizeAt: 560, todWide: 420, ms: [0, 0, 900], partialPrint: true, cops: 5, rookies: 2, boss: [130, 250, 150] },
  // 新手教學：固定案件、點數很多、沒有誘餌，壓力事件由教學腳本觸發
  tut:    { name: '新手教學', labBudget: 20, labSec: 6, patience: 1e9, decoys: 0, tamperEvery: 1e9, rookieEvery: 1e9, rainAt: 1e9, oxidizeAt: 1e9, todWide: 1e9, ms: [1e9, 1e9, 1e9], partialPrint: false, cops: 3, rookies: 1, boss: [1e9, 1e9, 1e9], hidden: true }
};
// 封鎖線內的員警崗哨（每位在兩點間來回巡邏）
const COP_POSTS = [
  [{ x: 520, y: 700 }, { x: 660, y: 700 }], [{ x: 1560, y: 880 }, { x: 1440, y: 1000 }], [{ x: 780, y: 1040 }, { x: 930, y: 1050 }],
  [{ x: 760, y: 700 }, { x: 1200, y: 720 }], [{ x: 1320, y: 620 }, { x: 1600, y: 620 }]
];
const COP_NAMES = ['王警員', '李警員', '張警員', '劉警員', '蔡警員', '許警員', '鄧警員'];
// 分局長會要求的報告（像恐鬼症的鬼：進封鎖線後頭上冒泡泡）
const REPORTS = {
  wound: { t: '傷口照片', icon: 'icon_req_wound', how: '用📷相機近拍屍體傷口' },
  tod: { t: '死亡時間', icon: 'icon_req_tod', how: '用🌡️肝溫計量屍體' },
  print: { t: '指紋比對', icon: 'icon_req_print', how: '採指紋 → 回車上用指紋比對電腦分析' },
  blood: { t: '血液報告', icon: 'icon_req_blood', how: '採血液 → 回車上用離心機分析' },
  lab: { t: '實驗室報告', icon: 'icon_req_lab', how: '證物交給小吳送驗，等報告回來' },
  progress: { t: '案情進度', icon: 'icon_req_progress', how: '找到能縮小範圍的證據（看筆記本的鑑識手冊）' }
};

/* ---------- 鑑識特徵（像恐鬼症的證據種類） ---------- */
const SIGS = {
  blunt: { t: '鈍器凹陷傷', how: '📷 相機拍屍體傷口' },
  sharp: { t: '銳器刺創', how: '📷 相機拍屍體傷口' },
  ligature: { t: '頸部勒痕＋點狀出血', how: '📷 相機拍屍體傷口' },
  nowound: { t: '無外傷・嘴唇發紺', how: '📷 相機拍屍體傷口' },
  spatter: { t: '第一現場大量血跡（被清洗過）', how: '🧪 魯米諾噴地板' },
  weaponblood: { t: '兇器上有血跡反應', how: '🧪 魯米諾噴可疑兇器' },
  skin: { t: '繩索／布料上有皮屑纖維', how: '🛍️ 兇器送實驗室' },
  toxin: { t: '死者血液驗出毒物', how: '💉 採死者血液→離心機' },
  residue: { t: '容器殘留毒物', how: '🛍️ 杯子送實驗室' },
  moved: { t: '屍斑位置不符（屍體被移動）', how: '📷 相機拍屍斑' },
  smear: { t: '撞擊處的血是抹上去的', how: '🧪 魯米諾噴壁爐石角' },
  contact: { t: '手掌皮膚有接觸性毒物灼斑', how: '📷 檢查死者雙手／🛍️ 可疑物品送實驗室' }
};
/* ---------- 行兇方式 → 3 個特徵 ---------- */
const METHODS = [
  { id: 'blunt', t: '鈍器重擊', sigs: ['blunt', 'spatter', 'weaponblood'], weapons: ['statue', 'poker'], hand: true, nails: true, blood: true },
  { id: 'stab', t: '刺殺', sigs: ['sharp', 'spatter', 'weaponblood'], weapons: ['opener', 'knife', 'poker'], hand: true, nails: true, blood: true },
  { id: 'strangle', t: '勒斃', sigs: ['ligature', 'skin', 'moved'], weapons: ['cord', 'necktie'], hand: true, nails: true, blood: false },
  { id: 'poison', t: '下毒', sigs: ['nowound', 'toxin', 'residue'], weapons: ['glasses', 'teacup'], hand: false, nails: false, blood: false },
  { id: 'staged', t: '推倒撞擊後佈置成意外', sigs: ['blunt', 'moved', 'smear'], weapons: ['hearth'], hand: false, nails: true, blood: true },
  // v9：同一件物品在不同案件裡意義不同（領帶不一定是勒斃：也可能塗了箭毒蛙毒，死者摸到就中毒）
  { id: 'contact', t: '接觸性毒物（塗在隨身物品上）', sigs: ['nowound', 'toxin', 'contact'], weapons: ['necktie', 'opener', 'statue'], hand: false, nails: false, blood: false }
];
// 物品可能扮演的角色（筆記本／手冊用：同一件東西每局意義可能不同）
const ROLES = { statue: ['blunt', 'contact'], poker: ['blunt', 'stab'], opener: ['stab', 'contact'], knife: ['stab'], necktie: ['strangle', 'contact'], cord: ['strangle'], glasses: ['poison'], teacup: ['poison'], hearth: ['staged'] };
// 勒斃：兇手勒完把屍體從椅子上拖到地上 → 屍斑不符；偽裝意外：在客廳／廚房推倒，搬到書房壁爐前

/* ---------- 嫌疑人池（現場的 NPC：家屬、目擊者、記者…） ---------- */
const PEOPLE = [
  { id: 'wife', name: '陳美玲', role: '死者妻子', img: 'suspect_wife', motive: '上個月壽險保額提高到 3000 萬，受益人是她', item: '珍珠耳環' },
  { id: 'partner', name: '周子豪', role: '畫廊合夥人', img: 'suspect_partner', motive: '經手的三幅畫被死者發現是偽作', item: '袖扣' },
  { id: 'daughter', name: '林佳穎', role: '死者女兒', img: 'suspect_daughter', motive: '傍晚為了錢跟死者大吵一架', item: '粉紅色髮夾' },
  { id: 'maid', name: '吳淑芬', role: '管家', img: 'suspect_maid', motive: '死者懷疑她偷拿古董，準備辭退她', item: '圍裙鈕扣' },
  { id: 'neighbor', name: '黃國棟', role: '鄰居（目擊者）', img: 'suspect_neighbor', motive: '為了圍牆和停車位跟死者打過官司', item: '打火機' },
  { id: 'reporter', name: '蘇曉晴', role: '社會線記者', img: 'suspect_reporter', motive: '死者威脅要告她的爆料報導', item: '記者證吊繩' },
  { id: 'gardener', name: '高阿土', role: '園丁', img: 'suspect_gardener', motive: '被死者欠了三個月薪水', item: '園藝手套' }
];
const BLOOD = ['A', 'B', 'O', 'AB'];

/* ---------- 固定地圖 ---------- */
// 比例尺：成年角色身高 H＝112（世界座標）。所有物件依真實比例換算（寬或高 × H），長寬比照圖檔實際內容
const H_REF = 112;
const SIZES = {"prop_body": [100, 73], "prop_carpet": [325, 215], "prop_rug_study": [224, 96], "prop_mud_prints": [168, 109], "prop_sofa": [202, 119], "prop_coffee_table": [123, 72], "prop_bookshelf": [74, 168], "prop_back_door": [24, 146], "prop_garden_gate": [138, 146], "prop_fireplace": [179, 180], "prop_desk": [179, 141], "prop_counter": [179, 152], "prop_shoe_rack": [123, 86], "prop_statue": [49, 95], "prop_poker": [61, 95], "prop_curtain_cord": [19, 90], "prop_knife_block": [58, 54], "prop_mop_bucket": [69, 95], "prop_trash_can": [56, 78], "prop_wine_glasses": [43, 40], "prop_teacup": [35, 29], "prop_necktie": [62, 41], "prop_letter_opener": [45, 9], "prop_phone": [34, 25], "prop_planted_item": [29, 11], "prop_light_switch": [16, 34], "prop_police_tape": [45, 112], "prop_bush": [134, 144], "prop_tree": [186, 258], "van_exterior": [325, 224], "prop_floor_mark": [123, 119]};
const BASE = {
  carryTools: 3, bagSlots: 3, lumCharges: 3, labCost: { 1: 3, 2: 5 }, sampleLabAP: 3,
  start: [{ x: 300, y: 690 }, { x: 350, y: 720 }, { x: 260, y: 740 }, { x: 390, y: 680 }],
  van: { x: 200, y: 600, r: 190 },
  exit: { x: 30, y: 1050 },
  map: {
    w: 1760, h: 1130, wall: 112,
    rooms: [
      { id: 'street', name: '街道・封鎖線外', x: 0, y: 200, w: 440, h: 910, out: true, floor: 'ground_asphalt' },
      { id: 'foyer', name: '玄關', x: 440, y: 440, w: 280, h: 300, floor: 'floor_marble', wallImg: 'wall_foyer' },
      { id: 'living', name: '客廳', x: 720, y: 200, w: 560, h: 580, floor: 'floor_wood', wallImg: 'wall_living' },
      { id: 'study', name: '書房', x: 1280, y: 200, w: 460, h: 460, floor: 'floor_study', wallImg: 'wall_study' },
      { id: 'kitchen', name: '廚房', x: 720, y: 780, w: 560, h: 330, floor: 'floor_kitchen', wallImg: 'wall_kitchen' },
      { id: 'yard', name: '後院', x: 1280, y: 660, w: 460, h: 450, out: true, floor: 'ground_grass' }
    ],
    doors: [
      { x: 424, y: 560, w: 48, h: 90, v: true }, { x: 692, y: 540, w: 56, h: 120, v: true }, { x: 1252, y: 420, w: 56, h: 120, v: true },
      { x: 900, y: 752, w: 110, h: 156, v: false }, { x: 1252, y: 900, w: 56, h: 110, v: true }
    ],
    solids: [
      { x: 50, y: 548, w: 300, h: 70 }, { x: 886, y: 338, w: 188, h: 46 }, { x: 1152, y: 344, w: 68, h: 38 },
      { x: 1514, y: 340, w: 172, h: 56 }, { x: 1326, y: 330, w: 168, h: 30 }, { x: 1056, y: 892, w: 168, h: 30 }
    ]
  },
  tools: [
    { id: 'camera', name: '鑑識相機', icon: 'tool_camera', emoji: '📷', desc: '近拍傷口、屍斑、翻拍文件' },
    { id: 'luminol', name: '魯米諾試劑', icon: 'tool_luminol', emoji: '🧪', desc: '讓擦掉的血跡發出藍光' },
    { id: 'prints', name: '指紋採集組', icon: 'tool_prints', emoji: '🔍', desc: '刷粉轉印指紋（車上比對）' },
    { id: 'swab', name: '血液採取器', icon: 'tool_swab', emoji: '💉', desc: '採血液／指甲縫樣本（車上離心機）' },
    { id: 'thermo', name: '肝溫計', icon: 'tool_thermo', emoji: '🌡️', desc: '量肝溫推算死亡時間（越晚越不準）' },
    { id: 'shoe', name: '足跡採集器', icon: 'tool_shoe', emoji: '👣', desc: '採集鞋印（車上比對鞋號）' }
  ],
  machines: [
    { id: 'centrifuge', name: '離心機＋血液快篩', icon: 'eq_centrifuge', emoji: '🌀', kind: 'blood', ap: 2 },
    { id: 'afis', name: '指紋比對電腦', icon: 'eq_afis', emoji: '🖥️', kind: 'print', ap: 1 },
    { id: 'shoedb', name: '鞋印資料庫', icon: 'eq_shoedb', emoji: '🗂️', kind: 'shoe', ap: 1 }
  ],
  rooms3: ['living', 'study', 'kitchen'],
  roomName: { living: '客廳', study: '書房', kitchen: '廚房', yard: '後院', foyer: '玄關', street: '街道' }
};
// 兇器候選（固定位置）
const WEAPONS = {
  statue: { name: '銅雕獎座', room: 'living', x: 800, y: 400, img: 'prop_statue', w: 70, h: 110, kind: 'blunt', size: 2, desc: '矮櫃上的銅雕獎座，沉甸甸的，底座是方形的。' },
  glasses: { name: '兩只紅酒杯', room: 'living', x: 1030, y: 478, img: 'prop_wine_glasses', w: 56, h: 52, kind: 'poison', size: 1, desc: '茶几上的兩只紅酒杯，一只還剩一點酒。' },
  necktie: { name: '絲質領帶', room: 'living', x: 870, y: 440, img: 'prop_necktie', w: 70, h: 34, kind: 'strangle', size: 1, flat: true, desc: '沙發旁地上一條深色絲質領帶。' },
  poker: { name: '壁爐火鉗', room: 'study', x: 1318, y: 376, img: 'prop_poker', w: 40, h: 100, kind: 'blunt', size: 2, desc: '鐵製火鉗，掛在壁爐旁的架子上。' },
  opener: { name: '黃銅拆信刀', room: 'study', x: 1600, y: 434, img: 'prop_letter_opener', w: 50, h: 24, kind: 'stab', size: 1, flat: true, desc: '書桌前地上的黃銅拆信刀，刀身細長。' },
  cord: { name: '窗簾繩', room: 'study', x: 1714, y: 372, img: 'prop_curtain_cord', w: 40, h: 120, kind: 'strangle', size: 1, desc: '窗邊垂下的粗編窗簾繩，有一截被扯鬆了。' },
  knife: { name: '刀架上的菜刀', room: 'kitchen', x: 985, y: 905, img: 'prop_knife_block', w: 60, h: 80, kind: 'stab', size: 1, desc: '木製刀架，少了一個刀位又被插回去了。' },
  teacup: { name: '流理台上的茶杯', room: 'kitchen', x: 1200, y: 942, img: 'prop_teacup', w: 40, h: 36, kind: 'poison', size: 1, desc: '流理台上一只喝了一半的茶杯。' },
  hearth: { name: '壁爐石角', room: 'study', x: 1410, y: 360, img: 'prop_fireplace', w: 150, h: 140, kind: 'staged', size: 0, desc: '大理石壁爐，石角上有一抹血跡。' }
};
const FLOOR = {
  living: { id: 'floor_living', name: '客廳地毯', x: 990, y: 600, img: 'prop_carpet', w: 380, h: 200, r: 170 },
  study: { id: 'floor_study', name: '書房地毯', x: 1420, y: 590, img: 'prop_rug_study', w: 220, h: 110, r: 120 },
  kitchen: { id: 'floor_kitchen', name: '廚房地板', x: 1130, y: 1000, img: 'prop_floor_mark', w: 180, h: 70, r: 120 }
};
const BODY_AT = { living: { x: 985, y: 610 }, study: { x: 1455, y: 545 }, kitchen: { x: 880, y: 975 } };
const DECO = [
  { id: 'tape', room: 'street', x: 432, y: 520, img: 'prop_police_tape', w: 60, h: 150, name: '封鎖線', deco: true },
  { id: 'tree', room: 'street', x: 90, y: 470, img: 'prop_tree', w: 150, h: 190, name: '路樹', deco: true },
  { id: 'shoerack', room: 'foyer', x: 640, y: 528, img: 'prop_shoe_rack', w: 100, h: 90, name: '鞋櫃', deco: true, desc: '鞋櫃擺得很整齊。' },
  { id: 'sofa', room: 'living', x: 980, y: 386, img: 'prop_sofa', w: 230, h: 120, name: '沙發', deco: true, desc: '真皮沙發，坐墊有兩個人坐過的凹痕。' },
  { id: 'bookshelf', room: 'living', x: 1185, y: 382, img: 'prop_bookshelf', w: 130, h: 190, name: '書櫃', deco: true, desc: '擺滿藝術畫冊。' },
  { id: 'table', room: 'living', x: 990, y: 486, img: 'prop_coffee_table', w: 150, h: 70, name: '茶几', deco: true },
  { id: 'counter', room: 'kitchen', x: 1140, y: 922, img: 'prop_counter', w: 210, h: 110, name: '流理台', deco: true, desc: '流理台上放著一瓶漂白水，冰箱上貼著值日表。' },
  { id: 'backdoor', room: 'kitchen', x: 1270, y: 955, img: 'prop_back_door', w: 30, h: 130, name: '後門', deco: true, desc: '後門沒有上鎖。' },
  { id: 'gate', room: 'yard', x: 1600, y: 795, img: 'prop_garden_gate', w: 90, h: 120, name: '側門', deco: true, desc: '通往小巷的側門，門閂是打開的。' },
  { id: 'bush', room: 'yard', x: 1365, y: 1060, img: 'prop_bush', w: 110, h: 80, name: '樹叢', deco: true }
];

function generate(seed, diff) {
  const D = DIFF[diff] || DIFF.normal; const r = rng(seed);
  const C = Object.assign({}, BASE, { id: 'gen', seed, diff: diff in DIFF ? diff : 'normal', diffName: D.name, labBudget: D.labBudget, labSec: D.labSec, sigs: SIGS });
  C._walk = null;
  /* --- 真相 --- */
  let method = pick(r, METHODS), wid = pick(r, method.weapons);
  if (D.hidden) { method = METHODS[0]; wid = 'statue'; }   // 新手教學：固定案件
  const W = WEAPONS[wid];
  const rv = rng((seed ^ 0x2545F491) >>> 0);   // 品質變化用的獨立亂數（不影響主要案件）
  const crime = method.id === 'staged' ? pick(r, ['living', 'kitchen']) : W.room;
  const bodyRoom = method.id === 'staged' ? 'study' : crime;
  const sus = shuffle(r, PEOPLE).slice(0, 4).map(p => Object.assign({}, p));
  const culprit = pick(r, sus);
  const tod = 20 * 60 + 30 + Math.floor(r() * 7) * 10;   // 20:30～21:30
  // 特徵：兇手的組合必須和每位無辜者至少一項可觀察特徵不同
  const obs = ['shoe']; if (method.nails) obs.push('blood'); if (method.hand) obs.push('hand');
  for (const s of sus) { s.blood = pick(r, BLOOD); s.shoe = 23 + Math.floor(r() * 6); s.hand = r() < .8 ? 'R' : 'L'; s.print = 'FP-' + (1000 + Math.floor(r() * 9000)); }
  for (const s of sus) if (s !== culprit) { let n = 0; while (obs.every(k => s[k] === culprit[k]) && n++ < 50) { s.shoe = 23 + Math.floor(r() * 6); s.blood = pick(r, BLOOD); } }
  // 不在場說法
  const others = sus.filter(s => s !== culprit);
  const ALIBI = [['在瑜珈教室上課', true], ['在朋友家慶生', true], ['在便利商店值大夜班', true], ['一個人在家看電視', false], ['在附近散步', false], ['開車在路上', false]];
  for (const s of sus) {
    const a = s === culprit ? pick(r, ALIBI.filter(x => !x[1])) : pick(r, ALIBI);
    s.alibi = a[0]; s.say = `${hhmm(tod - 60)} 到 ${hhmm(tod + 60)} 我${a[0]}。` + (s === culprit ? '' : '');
    s.alibiOk = s !== culprit && a[1];
  }
  C.victim = { name: '林志遠', age: 58, img: 'victim_photo', blood: pick(r, BLOOD), note: '遠山畫廊老闆，晚上被發現陳屍家中。' };
  C.suspects = sus; C.culprit = culprit.id; C.method = method.id; C.weapon = wid; C.location = crime; C.tod = tod;
  C.methods = METHODS.map(m => ({ id: m.id, t: m.t, sigs: m.sigs }));
  C.weapons = Object.keys(WEAPONS).map(k => ({ id: k, t: WEAPONS[k].name }));
  C.locations = BASE.rooms3.map(k => ({ id: k, t: BASE.roomName[k] }));
  C.briefing = [
    `晚上 22:10，有人報案：林志遠（58 歲，遠山畫廊老闆）陳屍在自家${BASE.roomName[bodyRoom]}。轄區員警初判可能是意外。`,
    `封鎖線外有 4 位關係人：${sus.map(s => s.name + '（' + s.role + '）').join('、')}。兇手可能就混在他們之中——他會趁你們不注意偷偷動證物，被逼急了還可能逃走。`,
    `難度「${D.name}」：工具隨便用，但送實驗室要花全隊共用的「實驗室額度」（${D.labBudget} 點），報告約 ${D.labSec} 秒後回來；現場有 ${D.decoys} 個誘餌線索。分局長的耐心有限，偶爾會進來巡視。`
  ];
  /* --- 證據與物件 --- */
  const E = {}; const O = DECO.map(o => Object.assign({}, o));
  const ev = (id, name, icon, text, f, x) => { E[id] = Object.assign({ name, icon, text, f: f || {} }, x || {}); return id; };
  const ALT = q => ({ alt: q });   // 小遊戲表現不好時的版本（部分／不完整／失真）
  C.room = { heater: rv() < .5, window: rv() < .5 };
  const who = s => `${s.name}（${s.role}）`;
  O.push({ id: 'van', room: 'street', x: 200, y: 600, img: 'van_exterior', w: 320, h: 200, name: '行動鑑識車', van: true, desc: '換裝備、用車上設備分析樣本、把證物交給快遞員送實驗室。' });
  O.push({ id: 'courier', room: 'street', x: 380, y: 610, img: 'npc_courier', w: 80, h: 112, name: '實驗室快遞員・小吳', van: true, npc: true, desc: '「證物交給我，我騎車送回局裡實驗室。」' });
  O.push({ id: 'chief', room: 'street', x: 90, y: 700, img: 'npc_supervisor', w: 75, h: 112, name: '分局長・鄭督察', van: true, npc: true, desc: '「時間就是證據。我要的東西，準時交上來。」' });
  // 屍體
  const B = BODY_AT[bodyRoom];
  const wound = { blunt: 'blunt', stab: 'sharp', strangle: 'ligature', poison: 'nowound', staged: 'blunt', contact: 'nowound' }[method.id];
  const WT = {
    blunt: '後腦有一個方形凹陷傷，邊緣銳利——鈍器重擊造成。', sharp: '左胸有一處深而窄的刺創——銳器（刀刃或尖端）造成。',
    ligature: '頸部有一圈水平勒痕，眼結膜有點狀出血——被勒斃。', nowound: '全身沒有明顯外傷，嘴唇和指甲發紺——疑似中毒。'
  };
  const handTxt = method.hand ? `傷口角度顯示兇手慣用${culprit.hand === 'R' ? '右' : '左'}手。` : '';
  const wneg = ['blunt', 'sharp', 'ligature', 'nowound'].filter(x => x !== wound);
  ev('E_wound', '屍體傷口：' + SIGS[wound].t, 'ev_photo', WT[wound] + handTxt, { sig: [wound], neg: wneg, trait: method.hand ? [['hand', culprit.hand]] : [] });
  ev('E_wound_p', '屍體傷口：' + SIGS[wound].t + '（照片不完整）', 'ev_photo', WT[wound] + '只拍到一部分，看不出傷口角度和兇手的慣用手。', { sig: [wound], neg: wneg }, ALT('fair'));
  ev('E_wound_x', '屍體傷口：照片模糊', 'ev_photo', '對焦沒對好，只看得出死者身上可能有異狀，判斷不了是什麼造成的。', {}, ALT('poor'));
  const contactM = method.id === 'contact';
  ev('E_hands', contactM ? '死者雙手：掌心有灼紅斑' : '死者雙手：沒有異常', 'ev_photo', contactM ? '右手掌心和指尖紅腫、起了小水泡——碰過接觸性毒物，毒素是從皮膚吸收的。' : '雙手皮膚正常，沒有灼傷或紅斑。', contactM ? { sig: ['contact'] } : { neg: ['contact'] });
  ev('E_hands_x', '死者雙手：照片看不清楚', 'ev_photo', '手部照片晃到了，看不出皮膚有沒有異狀。', {}, ALT('poor'));
  const moved = method.sigs.includes('moved');
  ev('E_livid', moved ? '屍斑位置不符（被移動過）' : '屍斑位置正常', 'ev_photo', moved ? '屍斑集中在背部，但屍體是趴著的 → 死後被搬動過。' : '屍斑和屍體姿勢一致，死後沒有被搬動。', moved ? { sig: ['moved'] } : { neg: ['moved'] });
  ev('E_livid_x', '屍斑照片曝光不足', 'ev_photo', '光線太暗、手又晃，照片看不出屍斑分布。', {}, ALT('poor'));
  { const b1 = (rv() < .5 ? -1 : 1) * 10, b2 = (rv() < .5 ? -1 : 1) * (45 + Math.floor(rv() * 2) * 15);
    ev('E_tod_f', `死亡時間 ${hhmm(tod + b1 - 35)}–${hhmm(tod + b1 + 35)}`, 'ev_thermo', `肝溫推算死亡時間約 ${hhmm(tod + b1 - 35)}–${hhmm(tod + b1 + 35)}（量測時溫度計不太穩，範圍比較寬）。`, { tod: 70 }, ALT('fair'));
    ev('E_tod_p', `死亡時間 ${hhmm(tod + b2 - 25)}–${hhmm(tod + b2 + 25)}`, 'ev_thermo', `肝溫推算死亡時間約 ${hhmm(tod + b2 - 25)}–${hhmm(tod + b2 + 25)}。`, { tod: 50 }, ALT('poor')); }
  ev('E_tod', `死亡時間 ${hhmm(tod - 15)}–${hhmm(tod + 15)}`, 'ev_thermo', `肝溫推算死亡時間約 ${hhmm(tod - 15)}–${hhmm(tod + 15)}。`, { tod: 30 });
  ev('E_tod_wide', `死亡時間 ${hhmm(tod - 75)}–${hhmm(tod + 45)}（不精確）`, 'ev_thermo', `量得太晚，屍溫已接近室溫，只能推算約 ${hhmm(tod - 75)}–${hhmm(tod + 45)}。`, { tod: 120 });
  const toxin = method.id === 'poison';
  ev('E_vblood', toxin ? '死者血液：驗出毒物' : `死者血液：${C.victim.blood} 型，無毒物`, 'ev_blood', toxin ? `離心快篩：死者 ${C.victim.blood} 型，血中驗出高濃度安眠藥與氰化物。` : `離心快篩：死者血型 ${C.victim.blood} 型，沒有驗出毒物。`, toxin || contactM ? { sig: ['toxin'] } : { neg: ['toxin'] });
  if (contactM) Object.assign(E.E_vblood, { name: '死者血液：驗出毒物', text: `離心快篩：死者 ${C.victim.blood} 型，血中驗出極微量的強效神經毒（類似箭毒蛙的蛙毒鹼）。` });
  ev('E_vblood_x', '死者血液：樣本被污染', 'ev_blood', '採樣時棉棒碰到地上的清潔劑，快篩結果判讀不了。', {}, ALT('poor'));
  // mg：這個動作要先玩小遊戲；q：表現普通／差時改用的結果
  const bodyActs = [
    { id: 'wound', tool: 'camera', ap: 1, label: '近拍傷口', ev: ['E_wound'], mg: 'photo', q: { fair: { ev: ['E_wound_p'] }, poor: { ev: ['E_wound_x'] } } },
    { id: 'livid', tool: 'camera', ap: 1, label: '檢查屍斑', ev: ['E_livid'], mg: 'photo', q: { poor: { ev: ['E_livid_x'] } } },
    { id: 'hands', tool: 'camera', ap: 1, label: '檢查雙手', ev: ['E_hands'], mg: 'photo', q: { poor: { ev: ['E_hands_x'] } } },
    { id: 'temp', tool: 'thermo', ap: 1, label: '量測肝溫', ev: ['E_tod'], mg: 'thermo', q: { fair: { ev: ['E_tod_f'] }, poor: { ev: ['E_tod_p'] } }, cond: [{ after: 'todWide', ev: ['E_tod_wide'] }] },
    { id: 'swab', tool: 'swab', ap: 1, label: '採集死者血液', mg: 'swab', sample: { kind: 'blood', label: '死者血液', res: 'E_vblood' }, q: { poor: { sample: { kind: 'blood', label: '死者血液（樣本可能不乾淨）', res: 'E_vblood_x' } } } }
  ];
  if (method.nails) {
    ev('E_nails', `指甲縫皮屑：${culprit.blood} 型`, 'ev_blood', `死者指甲縫裡有掙扎時抓下的皮屑，血型 ${culprit.blood} 型（不是死者的）。`, { trait: [['blood', culprit.blood]] });
    ev('E_nails_ox', '指甲縫皮屑：已氧化', 'ev_blood', '樣本放太久已經氧化，快篩驗不出血型（送實驗室驗 DNA 還可以）。', {});
    ev('E_nails_dna', `實驗室：指甲縫 DNA＝${culprit.name}`, 'ev_lab', `指甲縫皮屑的 DNA 與${who(culprit)}吻合。`, { who: culprit.id });
    ev('E_nails_x', '指甲縫皮屑：樣本被污染', 'ev_blood', '棉棒碰到死者自己的皮膚，兩種皮屑混在一起，判讀不出血型（實驗室 DNA 還可以試試）。', {}, ALT('poor'));
    bodyActs.push({ id: 'nails', tool: 'swab', ap: 1, label: '採集指甲縫皮屑', mg: 'swab', sample: { kind: 'blood', label: '指甲縫皮屑', res: 'E_nails', lab: 'E_nails_dna' }, q: { poor: { sample: { kind: 'blood', label: '指甲縫皮屑（樣本可能不乾淨）', res: 'E_nails_x', lab: 'E_nails_dna' } } }, cond: [{ after: 'oxidize', sample: { kind: 'blood', label: '指甲縫皮屑（已氧化）', res: 'E_nails_ox', lab: 'E_nails_dna' } }] });
  } else {
    ev('E_nails_none', '指甲縫乾淨', 'ev_photo', '指甲縫裡沒有皮屑，死者沒有掙扎過。', {});
    bodyActs.push({ id: 'nails', tool: 'camera', ap: 1, label: '檢查指甲縫', ev: ['E_nails_none'] });
  }
  O.push({ id: 'body', room: bodyRoom, x: B.x, y: B.y, img: 'prop_body', w: 100, h: 73, name: '屍體（死者・林志遠）', flat: true, label: '屍體（死者）', r: 105, desc: `死者倒在地上，已經沒有生命跡象。房間裡${C.room.heater ? '暖氣開著' : '暖氣沒開'}，${C.room.window ? '窗戶開著、有冷風吹進來' : '窗戶關著'}。`, acts: bodyActs });
  // 地板（每個房間一塊）
  for (const k of BASE.rooms3) {
    const F = FLOOR[k]; const isCrime = k === crime && method.blood;
    const id = 'E_floor_' + k;
    if (isCrime) ev(id, `${BASE.roomName[k]}：大量血跡反應`, 'ev_luminol', `魯米諾讓${F.name}出現大片藍光——這裡有過大量血跡，被人清洗過。${method.id === 'staged' ? '還有兩道拖痕往書房方向延伸 → 屍體是從這裡被拖走的。' : ''}`, method.id === 'staged' ? { sig: ['moved'], room: k } : { sig: ['spatter'], room: k });
    else ev(id, `${BASE.roomName[k]}：沒有血跡`, 'ev_luminol', `${F.name}沒有血跡反應。`, { noroom: k });
    O.push({ id: F.id, room: k, x: F.x, y: F.y, img: F.img, w: F.w, h: F.h, name: F.name, flat: true, r: F.r, desc: `${F.name}看起來很乾淨。`,
      acts: [{ id: 'lum', tool: 'luminol', ap: 2, label: '噴灑魯米諾', ev: [id], reveal: isCrime ? 'fx_luminol_pool' : null }] });
  }
  // 兇器候選（v9：同一件物品每局扮演的角色不同，看 ROLES）
  const partial = D.partialPrint && r() < .7;
  for (const k of Object.keys(WEAPONS)) {
    const w = WEAPONS[k]; const real = k === wid; const role = real ? method.id : null;
    const o = { id: 'w_' + k, room: w.room, x: w.x, y: w.y, img: w.img, w: w.w, h: w.h, name: w.name, flat: !!w.flat, r: 95, desc: w.desc, acts: [], weapon: k };
    if (k === 'hearth') {
      const sm = real; ev('E_hearth', sm ? '石角的血是抹上去的' : '壁爐石角沒有血跡', 'ev_luminol', sm ? '只有石角表面一抹血，周圍沒有噴濺或滴落 → 是有人抹上去的，佈置成撞到壁爐。' : '壁爐石角乾乾淨淨。', sm ? { sig: ['smear'], weapon: 'hearth' } : { neg: ['smear'] });
      o.acts.push({ id: 'lum', tool: 'luminol', ap: 2, label: '噴灑魯米諾', ev: ['E_hearth'], reveal: sm ? 'fx_luminol_spot' : null });
      if (real) o.desc = '大理石壁爐，石角上有一抹血跡——看起來像撞到這裡。'; else o.desc = '大理石壁爐。';
      O.push(o); continue;
    }
    if (['statue', 'poker', 'opener', 'knife'].includes(k)) {
      const bl = role === 'blunt' || role === 'stab';
      ev('E_wb_' + k, bl ? `${w.name}：血跡反應` : `${w.name}：沒有血跡`, 'ev_luminol', bl ? `${w.name}上出現強烈藍光——血被擦掉過。這就是兇器。` : `${w.name}沒有血跡反應（沒有被拿來打或刺）。`, bl ? { sig: ['weaponblood'], weapon: k } : {});
      o.acts.push({ id: 'lum', tool: 'luminol', ap: 2, label: '噴灑魯米諾', ev: ['E_wb_' + k], reveal: bl ? 'fx_luminol_spot' : null });
    }
    // 實驗室結果（依這局的角色決定）
    const lab = 'E_lab_' + k;
    if (role === 'blunt' || role === 'stab') ev(lab, `實驗室：${w.name}指紋＝${culprit.name}`, 'ev_lab', `強化後的指紋與${who(culprit)}吻合；血跡 DNA 屬於死者。`, { who: culprit.id, sig: ['weaponblood'], weapon: k });
    else if (role === 'strangle') ev(lab, `實驗室：${w.name}上有死者皮屑`, 'ev_lab', `${w.name}的纖維上有死者頸部皮屑，還驗出${who(culprit)}的 DNA。`, { sig: ['skin'], weapon: k, who: culprit.id });
    else if (role === 'poison') ev(lab, `實驗室：${w.name}殘留毒物`, 'ev_lab', `${w.name}的殘液驗出安眠藥與氰化物。杯身上的指紋 DNA 屬於${who(culprit)}。`, { sig: ['residue'], weapon: k, who: culprit.id });
    else if (role === 'contact') ev(lab, `實驗室：${w.name}表面驗出蛙毒鹼`, 'ev_lab', `${w.name}${k === 'necktie' ? '的絲面' : '的握柄'}被塗了一層箭毒蛙毒素（蛙毒鹼），碰到就會經皮膚中毒。塗抹處驗出${who(culprit)}的 DNA。`, { sig: ['contact'], weapon: k, who: culprit.id });
    else ev(lab, `實驗室：${w.name}沒有異常`, 'ev_lab', w.kind === 'poison' ? `${w.name}裡只有酒或茶，沒有毒物。` : `${w.name}上沒有血跡、毒物或死者皮屑。`, { negw: k });
    // 指紋（小遊戲：刷粉）
    ev('E_fp_' + k + '_smear', `${w.name}：指紋糊成一片`, 'ev_print', '粉刷太多、太用力，紋路糊掉了，比對不出來。', {}, ALT('poor'));
    const smear = { sample: { kind: 'print', label: w.name + '指紋（品質差）', res: 'E_fp_' + k + '_smear' } };
    if (real) {
      ev('E_fp_' + k, partial ? `${w.name}：半枚指紋` : `${w.name}：指紋＝${culprit.name}`, 'ev_print', partial ? `${w.name}上只剩半枚模糊指紋，車上比對不出來，要送實驗室強化。` : `${w.name}上的新鮮指紋與${who(culprit)}（${culprit.print}）吻合。`, partial ? {} : { who: culprit.id });
      ev('E_fp_' + k + '_part', `${w.name}：半枚指紋（比對不出來）`, 'ev_print', '只轉印到半枚，車上電腦比對不出來；可以把樣本送實驗室強化。', {}, ALT('fair'));
      ev('E_fpwipe_' + k, `${w.name}：指紋被擦掉了`, 'ev_print', `${w.name}被人擦拭過，現在什麼指紋都採不到。`, {});
      ev('E_fpcon_' + k, `${w.name}：指紋受污染`, 'ev_print', `菜鳥員警摸過了，現在只採到他的指紋。`, {});
      o.acts.push({ id: 'prints', tool: 'prints', ap: 2, label: '採集指紋', mg: 'prints', sample: { kind: 'print', label: w.name + '指紋', res: 'E_fp_' + k, lab: partial ? lab : null },
        q: { fair: { sample: { kind: 'print', label: w.name + '指紋（半枚）', res: 'E_fp_' + k + '_part', lab } }, poor: smear },
        cond: [{ flag: 'tampered', ev: ['E_fpwipe_' + k], sample: null }, { flag: 'contam', ev: ['E_fpcon_' + k], sample: null }] });
      o.tamper = true;
    } else {
      ev('E_fp_' + k, `${w.name}：指紋＝死者本人`, 'ev_print', `${w.name}上只有死者自己的指紋。`, {});
      o.acts.push({ id: 'prints', tool: 'prints', ap: 2, label: '採集指紋', mg: 'prints', sample: { kind: 'print', label: w.name + '指紋', res: 'E_fp_' + k }, q: { poor: smear } });
    }
    o.bag = { ap: w.size === 2 ? 2 : 1, size: w.size, label: w.size === 2 ? '裝袋帶走（大型證物）' : '裝袋帶走', lab };
    o.courier = { ap: w.size === 2 ? 6 : 4, label: '請小吳到現場取件送驗', res: lab };
    O.push(o);
  }
  // 後院鞋印（兇手從後門離開）
  ev('E_shoe', `後院鞋印：${culprit.shoe} 號`, 'ev_shoe', `新鮮鞋印 ${culprit.shoe} 號，從後門走向側門，步伐很急。`, { trait: [['shoe', culprit.shoe]] });
  ev('E_shoe_rain', '後院鞋印：被雨沖掉了', 'ev_shoe', '雨太大，鞋印已經糊成一片，採不到了。', {});
  { const cs = culprit.shoe, lo = cs - (rv() < .5 ? 1 : 0), off = rv() < .5 ? [cs + 1, cs + 2] : [cs - 2, cs - 1];
    ev('E_shoe_f', `後院鞋印：${lo}–${lo + 1} 號`, 'ev_shoe', `鞋印有一段被踩亂，只能估出鞋號範圍 ${lo}–${lo + 1} 號。`, { range: [['shoe', lo, lo + 1]] }, ALT('fair'));
    ev('E_shoe_p', `後院鞋印：${off[0]}–${off[1]} 號`, 'ev_shoe', `鞋印斷斷續續，估出鞋號範圍 ${off[0]}–${off[1]} 號。`, { range: [['shoe', off[0], off[1]]] }, ALT('poor')); }
  O.push({ id: 'mud', room: 'yard', x: 1440, y: 900, img: 'prop_mud_prints', w: 200, h: 90, name: '後院泥地上的鞋印', flat: true, r: 120, desc: '後院泥地上有一串鞋印，從後門走到側門。',
    acts: [{ id: 'cast', tool: 'shoe', ap: 2, label: '追蹤並採集鞋印', mg: 'shoe', sample: { kind: 'shoe', label: '後院鞋印', res: 'E_shoe' }, q: { fair: { sample: { kind: 'shoe', label: '後院鞋印（不完整）', res: 'E_shoe_f' } }, poor: { sample: { kind: 'shoe', label: '後院鞋印（斷斷續續）', res: 'E_shoe_p' } } }, cond: [{ flag: 'rain', ev: ['E_shoe_rain'], sample: null }] }] });
  // 手機（通聯）
  ev('E_phone', `實驗室：手機最後通聯＝${culprit.name}`, 'ev_lab', `解鎖手機：${hhmm(tod - 8)} ${who(culprit)}傳訊「我到了，開門」，之後死者再也沒有回覆。`, { who: culprit.id });
  ev('E_phone_wiped', '實驗室：手機被重設了', 'ev_lab', '手機在命案後被人恢復原廠設定，什麼都救不回來。', {});
  O.push({ id: 'phone', room: bodyRoom, x: B.x + 95, y: B.y + 55, img: 'prop_phone', w: 40, h: 26, name: '死者的手機', flat: true, r: 90, desc: '掉在屍體旁的手機，螢幕鎖著。', tamper: true,
    acts: [], bag: { ap: 1, size: 1, label: '裝袋帶走', lab: 'E_phone', labCond: [{ flag: 'tampered', res: 'E_phone_wiped' }] } });
  // 書桌文件（動機）
  ev('E_motive', `帳冊筆記：${culprit.name}`, 'ev_document', `死者的筆記：「${culprit.name}——${culprit.motive}。下週處理。」`, { motive: culprit.id });
  O.push({ id: 'desk', room: 'study', x: 1600, y: 396, img: 'prop_desk', w: 160, h: 110, name: '書桌', r: 110, desc: '紅木書桌，抽屜沒鎖。', acts: [{ id: 'ledger', tool: 'camera', ap: 1, label: '翻拍抽屜裡的筆記', ev: ['E_motive'] }] });
  // 清理痕跡（有血的手法）
  if (method.blood) {
    ev('E_towel', '實驗室：毛巾血跡＋皮屑', 'ev_lab', `毛巾上是死者的血，還夾著${who(culprit)}的皮屑——兇手用它擦過手。`, { who: culprit.id });
    ev('E_mop', '拖把強烈血跡反應', 'ev_luminol', '拖把和水桶強烈藍光，還是濕的 → 命案後有人拖過地。', {});
  } else {
    ev('E_towel', '實驗室：毛巾只是油污', 'ev_lab', '毛巾上只有廚房油污。', {});
    ev('E_mop', '拖把沒有血跡', 'ev_luminol', '拖把是乾的，沒有血跡反應。', {});
  }
  O.push({ id: 'trash', room: 'kitchen', x: 800, y: 930, img: 'prop_trash_can', w: 60, h: 80, name: '垃圾桶', r: 90, desc: '垃圾桶最上面有一條揉成一團的毛巾。', acts: [], bag: { ap: 1, size: 1, label: '把毛巾裝袋帶走', lab: 'E_towel' } });
  O.push({ id: 'mop', room: 'kitchen', x: 960, y: 1000, img: 'prop_mop_bucket', w: 70, h: 100, name: '拖把和水桶', r: 90, desc: '拖把和水桶放在廚房角落。', acts: [{ id: 'lum', tool: 'luminol', ap: 2, label: '噴灑魯米諾', ev: ['E_mop'], reveal: method.blood ? 'fx_luminol_spot' : null }] });
  /* --- 誘餌線索 --- */
  const decoyKinds = shuffle(r, ['oldprints', 'oldblood', 'frame', 'motive2']).slice(0, D.decoys);
  C.decoys = [];
  for (const d of decoyKinds) {
    const inn = pick(r, others);
    if (d === 'oldprints') {   // 無辜者的舊指紋留在一件「不是兇器」的東西上
      const k = pick(r, Object.keys(WEAPONS).filter(x => x !== wid && x !== 'hearth')); const id = 'E_fp_' + k;
      E[id] = { name: `${WEAPONS[k].name}：指紋＝${inn.name}`, icon: 'ev_print', text: `${WEAPONS[k].name}上有${who(inn)}（${inn.print}）的指紋。指紋上覆著一層灰，沒有血跡。`, f: { decoy: inn.id } };
      C.decoys.push(`${WEAPONS[k].name}上${inn.name}的舊指紋（灰塵覆蓋、沒有血，是以前留下的）`);
    } else if (d === 'oldblood') {
      const k = pick(r, BASE.rooms3.filter(x => x !== crime)); const id = 'E_floor_' + k;
      E[id] = { name: `${BASE.roomName[k]}：少量舊血跡`, icon: 'ev_luminol', text: `${FLOOR[k].name}有一小塊淡淡的藍光，形狀是幾滴、邊緣模糊。${inn.name}說上週在這裡割傷手。`, f: { decoy: inn.id, noroom: k } };
      const o = O.find(x => x.id === FLOOR[k].id); o.acts[0].reveal = 'fx_luminol_spot';
      C.decoys.push(`${BASE.roomName[k]}的舊血跡（${inn.name}上週割傷，量很少）`);
    } else if (d === 'frame') {   // 兇手栽贓：把無辜者的私人物品放在屍體旁
      ev('E_frame', `屍體旁的${inn.item}（${inn.name}的）`, 'ev_photo', `屍體旁邊有一個${inn.item}，是${who(inn)}的。`, { decoy: inn.id });
      ev('E_frame_lab', `實驗室：${inn.item}是事後放的`, 'ev_lab', `${inn.item}下方壓著已乾的血跡 → 是命案後才被放上去的（栽贓）。上面驗到${who(culprit)}的指紋。`, { who: culprit.id });
      O.push({ id: 'frame', room: bodyRoom, x: B.x - 85, y: B.y + 45, img: 'prop_planted_item', w: 34, h: 26, name: `地上的${inn.item}`, flat: true, r: 80, desc: `屍體附近地上的${inn.item}。`,
        acts: [{ id: 'photo', tool: 'camera', ap: 1, label: '近拍', ev: ['E_frame'] }], bag: { ap: 1, size: 1, label: '裝袋帶走', lab: 'E_frame_lab' } });
      C.decoys.push(`屍體旁${inn.name}的${inn.item}（兇手栽贓，送驗會發現是事後放的）`);
    } else if (d === 'motive2') {
      ev('E_motive2', `保單／存證信函：${inn.name}`, 'ev_document', `抽屜裡另一份文件：${inn.name}——${inn.motive}。`, { decoy: inn.id });
      O.find(x => x.id === 'desk').acts.push({ id: 'policy', tool: 'camera', ap: 1, label: '翻拍另一份文件', ev: ['E_motive2'] });
      C.decoys.push(`${inn.name}的動機文件（有動機不代表是兇手）`);
    }
  }
  // 兇手的可疑舉動（壓力系統觸發時才會出現）
  ev('E_sneak', `可疑舉動：${culprit.name}想碰證物`, 'ev_photo', `${who(culprit)}趁大家不注意摸進現場，靠近關鍵證物時被撞見。`, { sus: culprit.id });
  ev('E_held', `可疑舉動：${culprit.name}想逃離現場`, 'ev_photo', `${who(culprit)}想偷偷溜出封鎖線，被攔了下來。`, { sus: culprit.id });
  ev('E_threat', `可疑舉動：${culprit.name}恐嚇鑑識員`, 'ev_photo', `${who(culprit)}對落單的隊員低聲恐嚇「別多管閒事」。`, { sus: culprit.id });
  C.objects = O; C.evidence = E;
  /* --- 壓力系統設定 --- */
  C.pressure = {
    todWideAt: D.todWide,   // 這之後量肝溫只得到不精確的死亡時間
    oxidizeAt: D.oxidizeAt, rainAt: D.rainAt,
    tamperEvery: D.tamperEvery, rookieEvery: D.rookieEvery,
    milestones: [
      { id: 'm3', at: D.ms[2], t: '結案時限', need: ['never'], fail: 'verdict', failT: '時間到！分局長要你們立刻提出推理' }
    ],
    deadline: D.patience, patienceRate: 100 / D.patience,
    bossFirst: D.boss[0], bossEvery: D.boss[1], bossWait: D.boss[2], bossStrikes: 3
  };
  // NPC：4 位關係人在封鎖線外
  const SPOT = [{ x: 120, y: 800 }, { x: 330, y: 880 }, { x: 230, y: 980 }, { x: 80, y: 960 }];
  C.npcStart = sus.map((s, i) => ({ id: s.id, x: SPOT[i].x, y: SPOT[i].y }));
  // 推理選項中的兇器：所有候選
  C.truth = [
    `兇手是${who(culprit)}。動機：${culprit.motive}。`,
    `行兇方式：${method.t}。兇器：${W.name}。第一現場：${BASE.roomName[crime]}${bodyRoom !== crime ? '，屍體被搬到' + BASE.roomName[bodyRoom] : ''}。死亡時間約 ${hhmm(tod)}。`,
    `這個手法的三個鑑識特徵：${method.sigs.map(s => SIGS[s].t).join('、')}。`,
    `指向兇手的特徵：鞋號 ${culprit.shoe}${method.nails ? `、血型 ${culprit.blood}` : ''}${method.hand ? `、慣用${culprit.hand === 'R' ? '右' : '左'}手` : ''}；直接證據：兇器指紋／實驗室 DNA、手機通聯${method.blood ? '、毛巾皮屑' : ''}。`,
    C.decoys.length ? `誘餌：${C.decoys.join('；')}。` : ''
  ].filter(Boolean);
  /* --- 每個房間的電燈開關：魯米諾的螢光只有關燈才看得到（一人關燈、一人噴灑記錄） --- */
  const SW = { living: { x: 732, y: 470 }, study: { x: 1292, y: 600 }, kitchen: { x: 732, y: 1010 } };
  for (const k of Object.keys(SW)) O.push({ id: 'sw_' + k, room: k, x: SW[k].x, y: SW[k].y, img: 'prop_light_switch', w: 22, h: 40, name: BASE.roomName[k] + '電燈開關', sw: k, r: 50, acts: [], desc: '關燈後，噴過魯米諾的地方才看得到藍色螢光。' });
  C.switches = Object.keys(SW);
  for (const o of O) {
    const acts = o.acts || []; const lum = acts.filter(a => a.tool === 'luminol');
    for (const a of lum) {
      const mk = { id: a.id + '_mk', tool: null, ap: 1, label: '記錄螢光位置', need: a.id, dark: true, ev: a.ev, glow: !!a.reveal, mg: 'lum', specks: a.reveal === 'fx_luminol_pool' ? 7 : a.reveal ? 3 : 0 };
      if (a.reveal) {   // 掃太快／漏掉：看起來像「沒有螢光」（失真）
        const b0 = E[a.ev[0]], F = b0.f || {}, mf = {};
        if (F.room || F.noroom) mf.noroom = F.room || F.noroom; if (F.weapon && F.weapon !== 'hearth') mf.negw = F.weapon; if ((F.sig || []).includes('smear')) mf.neg = ['smear'];
        ev(a.ev[0] + '_miss', `${o.name}：沒看到螢光`, 'ev_luminol', `暗處掃過一遍，沒看到明顯的藍光反應。`, mf, ALT('poor'));
        mk.q = { poor: { ev: [a.ev[0] + '_miss'] } };
      }
      a.ap = 1; a.ev = []; acts.splice(acts.indexOf(a) + 1, 0, mk);
    }
  }
  /* --- 封鎖線內的員警（其中有菜鳥，誰是菜鳥由開局亂數決定） --- */
  const r2 = rng((seed ^ 0x5bd1e995) >>> 0);
  const posts = shuffle(r2, COP_POSTS).slice(0, D.cops), names = shuffle(r2, COP_NAMES);
  C.cops = posts.map((pp, i) => ({ id: 'cop' + i, name: names[i], img: 'npc_officer_' + (1 + Math.floor(r2() * 5)), posts: pp }));
  C.rookies = D.rookies; C.reports = REPORTS; C.roles = ROLES;
  C.mgMin = D.hidden ? 1.5 : 4;          // 小遊戲最少要花的秒數（伺服器檢查）
  C.mgEasy = !!D.hidden;                 // 新手教學：表現再差也給完整結果（但會顯示分數）
  for (const o of O) { const z = SIZES[o.img]; if (z) { o.w = z[0]; o.h = z[1]; } }
  C.H = H_REF;
  return C;
}
const API = { generate, ROLES, SIZES, H_REF, DIFF, REPORTS, COP_POSTS, METHODS, SIGS, PEOPLE, WEAPONS, BASE, rng, hhmm };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FS_GEN = API;
})(typeof self !== 'undefined' ? self : this);
