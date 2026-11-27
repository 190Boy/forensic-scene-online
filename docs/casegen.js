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
const COP_POSTS = [   // v12：座標寫的是地圖原圖（map_mansion.jpg）的像素，載入時乘上 MS 換成世界座標
  [{ x: 850, y: 905 }, { x: 1070, y: 900 }], [{ x: 2380, y: 1160 }, { x: 2170, y: 1300 }], [{ x: 1260, y: 1390 }, { x: 1500, y: 1400 }],
  [{ x: 1250, y: 960 }, { x: 1800, y: 990 }], [{ x: 2012, y: 706 }, { x: 2340, y: 880 }]
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
// v12：手繪地圖 map_mansion.jpg（2752×1536）。世界座標＝原圖像素 × MS；下面的房間、牆、門、碰撞、物件都用原圖像素量好再換算
const MS = 0.8, MAP_SRC = [2752, 1536];
const q = v => Math.round(v * MS);
const scR = r => Object.assign({}, r, { x: q(r.x), y: q(r.y), w: q(r.w), h: q(r.h) }, r.wall != null ? { wall: q(r.wall) } : {});
const scP = o => Object.assign({}, o, { x: q(o.x), y: q(o.y) });
const SIZES = {"prop_body": [100, 73], "prop_carpet": [325, 215], "prop_rug_study": [224, 96], "prop_mud_prints": [168, 109], "prop_sofa": [202, 119], "prop_coffee_table": [123, 72], "prop_bookshelf": [74, 168], "prop_back_door": [24, 146], "prop_garden_gate": [138, 146], "prop_fireplace": [179, 180], "prop_desk": [179, 141], "prop_counter": [179, 152], "prop_shoe_rack": [123, 86], "prop_statue": [49, 95], "prop_poker": [61, 95], "prop_curtain_cord": [19, 90], "prop_knife_block": [58, 54], "prop_mop_bucket": [69, 95], "prop_trash_can": [56, 78], "prop_wine_glasses": [43, 40], "prop_teacup": [35, 29], "prop_necktie": [62, 41], "prop_letter_opener": [45, 9], "prop_phone": [34, 25], "prop_planted_item": [29, 11], "prop_light_switch": [16, 34], "prop_police_tape": [45, 112], "prop_bush": [134, 144], "prop_tree": [186, 258], "van_exterior": [325, 224], "prop_floor_mark": [123, 119]};
const BASE = {
  carryTools: 3, bagSlots: 3, lumCharges: 3,
  // v14 裝備次數：每件工具帶出門的可用次數（回鑑識車免費補滿）；1–2 人時多給一點（smallBonus），而且靠近車子會自動補滿
  toolUses: { camera: 5, luminol: 3, prints: 3, swab: 3, thermo: 3, shoe: 2 },
  smallBonus: { camera: 2, luminol: 1, prints: 1, swab: 1, thermo: 0, shoe: 0 },
  // v14 員警調度的站位（原圖像素，載入時換算）：守大門＝玄關門內；盯菜鳥＝客廳門口（離三個房間都近）
  guardSpots: { door: scP({ x: 885, y: 905 }), rookie: scP({ x: 1250, y: 830 }) }, labCost: { 1: 3, 2: 5 }, sampleLabAP: 3,
  start: [{ x: 420, y: 1100 }, { x: 490, y: 1130 }, { x: 350, y: 1140 }, { x: 560, y: 1100 }].map(scP),
  van: { x: q(300), y: q(990), r: 190 },
  exit: { x: q(420), y: q(1465) },
  map: {
    w: q(MAP_SRC[0]), h: q(MAP_SRC[1]), wall: 112, bg: 'map_mansion', src: MAP_SRC,
    // wall＝房間上緣到地板開始的高度（原圖的牆面＋護牆板）
    rooms: [
      { id: 'street', name: '街道・封鎖線外', x: 0, y: 250, w: 800, h: 1286, out: true, floor: 'ground_asphalt' },
      { id: 'foyer', name: '玄關', x: 795, y: 520, w: 360, h: 490, wall: 225, floor: 'floor_marble', wallImg: 'wall_foyer' },
      { id: 'living', name: '客廳', x: 1150, y: 175, w: 732, h: 870, wall: 280, floor: 'floor_wood', wallImg: 'wall_living' },
      { id: 'study', name: '書房', x: 1902, y: 160, w: 650, h: 755, wall: 310, floor: 'floor_study', wallImg: 'wall_study' },
      { id: 'kitchen', name: '廚房', x: 1150, y: 1045, w: 755, h: 465, wall: 195, floor: 'floor_kitchen', wallImg: 'wall_kitchen' },
      { id: 'yard', name: '後院', x: 1905, y: 960, w: 620, h: 576, out: true, floor: 'ground_grass' }
    ].map(scR),
    doors: [
      { x: 760, y: 805, w: 80, h: 185, v: true }, { x: 1115, y: 760, w: 75, h: 130, v: true }, { x: 1850, y: 525, w: 92, h: 210, v: true },
      { x: 1405, y: 1000, w: 120, h: 262, v: false }, { x: 1860, y: 1315, w: 110, h: 100, v: true }
    ].map(scR),
    // 碰撞：畫在地圖上的家具、樹叢、圍籬、樹（原圖像素）
    solids: [
      // 街道：左側石牆、花台樹、盆栽、石頭、門廊屋簷、樹籬、左下大樹、鑑識車
      { x: 0, y: 250, w: 80, h: 520 }, { x: 160, y: 520, w: 255, h: 125 }, { x: 85, y: 620, w: 65, h: 70 }, { x: 85, y: 715, w: 75, h: 55 },
      { x: 640, y: 520, w: 160, h: 270 }, { x: 690, y: 250, w: 110, h: 270 }, { x: 0, y: 1000, w: 150, h: 180 }, { x: 80, y: 1160, w: 70, h: 55 },
      { x: 690, y: 1010, w: 110, h: 526 }, { x: 110, y: 905, w: 380, h: 85 },
      // 玄關：鞋櫃、衣帽架、長椅、傘架
      { x: 950, y: 735, w: 160, h: 55 }, { x: 825, y: 735, w: 70, h: 43 }, { x: 925, y: 945, w: 140, h: 55 }, { x: 1065, y: 935, w: 60, h: 65 },
      // 客廳：獎座台、邊桌、沙發、書櫃、茶几
      { x: 1160, y: 455, w: 160, h: 70 }, { x: 1310, y: 455, w: 245, h: 40 }, { x: 1735, y: 455, w: 90, h: 65 }, { x: 1375, y: 625, w: 215, h: 45 },
      // 書房：柴架、書桌＋椅子、紙箱、檯燈邊桌
      { x: 1922, y: 470, w: 78, h: 50 }, { x: 2225, y: 470, w: 220, h: 30 }, { x: 2375, y: 470, w: 65, h: 65 }, { x: 2410, y: 800, w: 115, h: 80 }, { x: 2445, y: 650, w: 85, h: 70 },
      // 廚房：上排水槽＋冰箱、下排爐台＋流理台、右下垃圾桶、左下水管
      { x: 1545, y: 1240, w: 245, h: 60 }, { x: 1320, y: 1440, w: 485, h: 70 }, { x: 1815, y: 1450, w: 75, h: 60 }, { x: 1150, y: 1340, w: 75, h: 170 },
      // 後院：樹叢花台、工具、右下圍籬、側門
      { x: 1985, y: 1340, w: 265, h: 100 }, { x: 2005, y: 1060, w: 90, h: 40 }, { x: 2240, y: 1430, w: 285, h: 106 }, { x: 2255, y: 1040, w: 165, h: 45 }
    ].map(scR)
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
  statue: { name: '銅雕獎座', room: 'living', x: 1240, y: 525, baked: true, bw: 60, bh: 125, img: 'prop_statue', w: 70, h: 110, kind: 'blunt', size: 2, desc: '矮櫃上的銅雕獎座，沉甸甸的，底座是方形的。' },
  glasses: { name: '兩只紅酒杯', room: 'living', x: 1425, y: 628, img: 'prop_wine_glasses', w: 56, h: 52, kind: 'poison', size: 1, desc: '茶几上的兩只紅酒杯，一只還剩一點酒。' },
  necktie: { name: '絲質領帶', room: 'living', x: 1360, y: 585, baked: true, bw: 80, bh: 50, img: 'prop_necktie', w: 70, h: 34, kind: 'strangle', size: 1, flat: true, desc: '沙發旁地上一條深色絲質領帶。' },
  poker: { name: '壁爐火鉗', room: 'study', x: 1948, y: 472, img: 'prop_poker', w: 40, h: 100, kind: 'blunt', size: 2, desc: '鐵製火鉗，掛在壁爐旁的架子上。' },
  opener: { name: '黃銅拆信刀', room: 'study', x: 2300, y: 565, img: 'prop_letter_opener', w: 50, h: 24, kind: 'stab', size: 1, flat: true, desc: '書桌前地上的黃銅拆信刀，刀身細長。' },
  cord: { name: '窗簾繩', room: 'study', x: 2522, y: 470, img: 'prop_curtain_cord', w: 40, h: 120, kind: 'strangle', size: 1, desc: '窗邊垂下的粗編窗簾繩，有一截被扯鬆了。' },
  knife: { name: '刀架上的菜刀', room: 'kitchen', x: 1585, y: 1236, img: 'prop_knife_block', w: 60, h: 80, kind: 'stab', size: 1, desc: '木製刀架，少了一個刀位又被插回去了。' },
  teacup: { name: '流理台上的茶杯', room: 'kitchen', x: 1760, y: 1452, img: 'prop_teacup', w: 40, h: 36, kind: 'poison', size: 1, desc: '流理台上一只喝了一半的茶杯。' },
  hearth: { name: '壁爐石角', room: 'study', x: 2089, y: 494, baked: true, bw: 236, bh: 236, img: 'prop_fireplace', w: 150, h: 140, kind: 'staged', size: 0, desc: '大理石壁爐，石角上有一抹血跡。' }
};
const FLOOR = {   // 原圖像素；baked＝已經畫在地圖上（不另外畫圖，只留互動範圍與光暈）
  living: { id: 'floor_living', name: '客廳地毯', x: 1515, y: 715, img: 'prop_carpet', baked: true, bw: 460, bh: 258, r: 170 },
  study: { id: 'floor_study', name: '書房地毯', x: 2101, y: 811, img: 'prop_rug_study', baked: true, bw: 295, bh: 123, r: 120 },
  kitchen: { id: 'floor_kitchen', name: '廚房地板', x: 1450, y: 1365, img: 'prop_floor_mark', w: 180, h: 70, r: 120 }
};
// 屍體（原圖像素）：客廳在茶几地毯下方的人字拼木地板上，不會壓到茶几
const BODY_AT = { living: { x: 1500, y: 935 }, study: { x: 2085, y: 565 }, kitchen: { x: 1380, y: 1330 } };
const DECO = [
  { id: 'tape', room: 'street', x: 612, y: 1000, img: 'prop_police_tape', w: 60, h: 150, name: '封鎖線', deco: true },
  { id: 'tree', room: 'street', x: 285, y: 644, img: 'prop_tree', baked: true, bw: 252, bh: 348, name: '路樹', deco: true },
  { id: 'shoerack', room: 'foyer', x: 1034, y: 784, img: 'prop_shoe_rack', baked: true, bw: 162, bh: 175, name: '鞋櫃', deco: true, desc: '鞋櫃擺得很整齊。' },
  { id: 'sofa', room: 'living', x: 1495, y: 495, img: 'prop_sofa', baked: true, bw: 260, bh: 115, name: '沙發', deco: true, desc: '真皮沙發，坐墊有兩個人坐過的凹痕。' },
  { id: 'bookshelf', room: 'living', x: 1780, y: 520, img: 'prop_bookshelf', baked: true, bw: 95, bh: 230, name: '書櫃', deco: true, desc: '擺滿藝術畫冊。' },
  { id: 'table', room: 'living', x: 1527, y: 719, img: 'prop_coffee_table', baked: true, bw: 200, bh: 112, name: '茶几', deco: true },
  { id: 'counter', room: 'kitchen', x: 1694, y: 1250, img: 'prop_counter', baked: true, bw: 225, bh: 175, name: '流理台', deco: true, desc: '流理台上放著一瓶漂白水，冰箱上貼著值日表。' },
  { id: 'backdoor', room: 'kitchen', x: 1895, y: 1344, img: 'prop_back_door', baked: true, bw: 45, bh: 210, name: '後門', deco: true, desc: '後門沒有上鎖。' },
  { id: 'gate', room: 'yard', x: 2335, y: 1085, img: 'prop_garden_gate', baked: true, bw: 175, bh: 165, name: '側門', deco: true, desc: '通往小巷的側門，門閂是打開的。' },
  { id: 'bush', room: 'yard', x: 2021, y: 1438, img: 'prop_bush', baked: true, bw: 169, bh: 185, name: '樹叢', deco: true }
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
  O.push({ id: 'van', room: 'street', x: 300, y: 990, img: 'van_exterior', w: 320, h: 200, name: '行動鑑識車', van: true, desc: '換裝備、用車上設備分析樣本、把證物交給快遞員送實驗室。' });
  O.push({ id: 'courier', room: 'street', x: 565, y: 980, img: 'npc_courier', w: 80, h: 112, name: '實驗室快遞員・小吳', van: true, npc: true, desc: '「證物交給我，我騎車送回局裡實驗室。」' });
  O.push({ id: 'chief', room: 'street', x: 260, y: 1300, img: 'npc_supervisor', w: 75, h: 112, name: '分局長・鄭督察', van: true, npc: true, desc: '「時間就是證據。我要的東西，準時交上來。」' });
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
  { const rt = 18 + (C.room.heater ? 6 : 0) - (C.room.window ? 4 : 0);
    ev('E_roomtemp', `室溫 ${rt}°C：${C.room.heater ? '暖氣開著' : '暖氣沒開'}、${C.room.window ? '窗戶開著' : '窗戶關著'}`, 'ev_thermo', `${BASE.roomName[bodyRoom]}室溫約 ${rt}°C。${rt >= 22 ? '屍體降溫比平常慢，肝溫推算的死亡時間可能偏晚，要往前校正一點。' : rt <= 16 ? '冷風讓屍體降溫比平常快，肝溫推算的死亡時間可能偏早，要往後校正一點。' : '室溫正常，肝溫推算不用特別校正。'}`, {}); }
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
    { id: 'room', tool: 'thermo', ap: 1, label: '量測室溫（校正肝溫）', ev: ['E_roomtemp'] },
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
    O.push({ id: F.id, room: k, x: F.x, y: F.y, img: F.img, w: F.w, h: F.h, baked: F.baked, bw: F.bw, bh: F.bh, name: F.name, flat: true, r: F.r, desc: `${F.name}看起來很乾淨。`,
      acts: [{ id: 'lum', tool: 'luminol', ap: 2, label: '噴灑魯米諾', ev: [id], reveal: isCrime ? 'fx_luminol_pool' : null }] });
  }
  // 兇器候選（v9：同一件物品每局扮演的角色不同，看 ROLES）
  const partial = D.partialPrint && r() < .7;
  for (const k of Object.keys(WEAPONS)) {
    const w = WEAPONS[k]; const real = k === wid; const role = real ? method.id : null;
    const o = { id: 'w_' + k, room: w.room, x: w.x, y: w.y, img: w.img, w: w.w, h: w.h, name: w.name, flat: !!w.flat, r: 95, desc: w.desc, acts: [], weapon: k };
    if (w.baked) Object.assign(o, { baked: true, bw: w.bw, bh: w.bh });
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
  // 兇手的鞋印：每局出現的地方不同（後院泥地／玄關、廚房的泥鞋印／客廳、書房的灰塵或血鞋印）；教學固定在後院
  const SPOTS = {
    yard: { x: 2235, y: 1215, img: 'prop_mud_prints', where: '後院', name: '後院泥地上的鞋印', desc: '後院泥地上有一串鞋印，從後門走到側門。', trail: '從後門走向側門，步伐很急', ground: 'mud', out: true },
    foyer: { x: 960, y: 870, w: 160, h: 76, img: 'prop_mud_prints', where: '玄關', name: '玄關地上的泥鞋印', desc: '玄關大理石地上有一串帶泥的鞋印，從大門往屋裡走。', trail: '從大門往屋裡走，步伐很急', ground: 'mud' },
    kitchen: { x: 1700, y: 1370, w: 140, h: 64, img: 'prop_mud_prints', where: '廚房', name: '廚房地板上的泥鞋印', desc: '廚房磁磚上有幾個帶泥的鞋印，從後門方向走進來。', trail: '從後門方向走進廚房', ground: 'mud' },
    living: { x: 1700, y: 940, w: 150, h: 70, img: 'prop_floor_prints', where: '客廳', name: '客廳地板上的鞋印', desc: '手電筒斜照，客廳地板浮出一串淡淡的灰塵鞋印。', trail: '在客廳裡來回走動', ground: 'floor' },
    study: { x: 2300, y: 845, w: 150, h: 70, img: 'prop_floor_prints', where: '書房', name: '書房地板上的鞋印', desc: '手電筒斜照，書房地板浮出一串淡淡的灰塵鞋印。', trail: '走到書桌前又折返', ground: 'floor' }
  };
  const sk = D.hidden ? 'yard' : ['yard', 'yard', 'foyer', 'kitchen', 'living', 'study'][Math.floor(rv() * 6)];
  const SP = Object.assign({ room: sk }, SPOTS[sk]);
  if (!SP.out && sk === crime && method.blood) Object.assign(SP, { img: 'prop_blood_prints', ground: 'blood', name: `${SP.where}地板上的血鞋印`, desc: `${SP.where}地板上有幾個沾了血的鞋印，像是踩過血泊後走開。`, trail: '踩過血泊後往門口走' });
  C.shoeSpot = { room: sk, out: !!SP.out, ground: SP.ground, where: SP.where };
  const SWN = SP.where + '鞋印';
  ev('E_shoe', `${SWN}：${culprit.shoe} 號`, 'ev_shoe', `新鮮鞋印 ${culprit.shoe} 號，${SP.trail}。`, { trait: [['shoe', culprit.shoe]] });
  ev('E_shoe_rain', `${SWN}：被雨沖掉了`, 'ev_shoe', '雨太大，鞋印已經糊成一片，採不到了。', {});
  { const cs = culprit.shoe, lo = cs - (rv() < .5 ? 1 : 0), off = rv() < .5 ? [cs + 1, cs + 2] : [cs - 2, cs - 1];
    ev('E_shoe_f', `${SWN}：${lo}–${lo + 1} 號`, 'ev_shoe', `鞋印有一段被踩亂，只能估出鞋號範圍 ${lo}–${lo + 1} 號。`, { range: [['shoe', lo, lo + 1]] }, ALT('fair'));
    ev('E_shoe_p', `${SWN}：${off[0]}–${off[1]} 號`, 'ev_shoe', `鞋印斷斷續續，估出鞋號範圍 ${off[0]}–${off[1]} 號。`, { range: [['shoe', off[0], off[1]]] }, ALT('poor')); }
  O.push({ id: 'mud', room: sk, x: SP.x, y: SP.y, img: SP.img, w: SP.w || 200, h: SP.h || 90, ownSize: !SP.out, name: SP.name, flat: true, r: 120, desc: SP.desc, ground: SP.ground,
    acts: [{ id: 'cast', tool: 'shoe', ap: 2, label: '追蹤並採集鞋印', mg: 'shoe', sample: { kind: 'shoe', label: SWN, res: 'E_shoe' }, q: { fair: { sample: { kind: 'shoe', label: SWN + '（不完整）', res: 'E_shoe_f' } }, poor: { sample: { kind: 'shoe', label: SWN + '（斷斷續續）', res: 'E_shoe_p' } } }, cond: SP.out ? [{ flag: 'rain', ev: ['E_shoe_rain'], sample: null }] : [] }] });
  // v14：第二組鞋印（誘餌）——最先到場的員警或無辜關係人留下的舊鞋印，讓足跡採集器有第二個值得採的目標
  if (!D.hidden) {
    const k2 = shuffle(rv, ['foyer', 'kitchen', 'living', 'study'].filter(k => k !== sk && k !== bodyRoom))[0], S2 = SPOTS[k2], cop = rv() < .5, inn2 = others[Math.floor(rv() * others.length)];
    const W2 = S2.where + '另一組鞋印', size2 = cop ? 26 + Math.floor(rv() * 3) : inn2.shoe;
    ev('E_shoe2', cop ? `${W2}：警用制式鞋 ${size2} 號` : `${W2}：${size2} 號（舊的）`, 'ev_shoe', cop ? `鞋底是警用制式皮鞋的紋路，${size2} 號——是最先到場的員警踩的，和案情無關。` : `${size2} 號鞋印，上面覆著一層灰，是好幾天前留下的（${inn2.name}平常會來這裡）。`, cop ? {} : { decoy: inn2.id });
    ev('E_shoe2_p', `${W2}：斷斷續續`, 'ev_shoe', '鞋印斷斷續續，看不出鞋號。', {}, ALT('poor'));
    O.push({ id: 'mud2', room: k2, x: S2.x + 40, y: S2.y + 30, img: S2.ground === 'mud' ? 'prop_mud_prints' : 'prop_floor_prints', w: 120, h: 56, ownSize: true, name: S2.where + '的另一組鞋印', flat: true, r: 100, desc: S2.ground === 'mud' ? '一組比較淡的泥鞋印，邊緣已經乾了。' : '手電筒斜照，浮出一組比較淡的鞋印。', ground: S2.ground,
      acts: [{ id: 'cast', tool: 'shoe', ap: 2, label: '採集鞋印', mg: 'shoe', sample: { kind: 'shoe', label: W2, res: 'E_shoe2' }, q: { poor: { sample: { kind: 'shoe', label: W2 + '（斷斷續續）', res: 'E_shoe2_p' } } } }] });
  }
  // 手機（通聯）
  // 關係人身上的血漬（v10）：兇手可能沾到死者的血；無辜的人也可能有誘餌污漬（自己割傷／生肉血水／紅酒）——光有血漬不代表是兇手
  C.stains = [];
  if (!D.hidden) {
    const inn = sus.filter(x => x.id !== culprit.id), list = [];
    if (method.blood && rv() < .7) list.push([culprit, 'victim']);
    if (!list.length || rv() < .5) list.push([inn[Math.floor(rv() * inn.length)], ['own', 'meat', 'wine'][Math.floor(rv() * 3)]]);
    const vb = C.victim.blood;
    for (const [sp, src] of list) {
      const spot = ['袖口', '衣角', '鞋尖', '褲管'][Math.floor(rv() * 4)], L = `${sp.name}${spot}上的血漬`, k = 'E_st_' + sp.id;
      const same = src === 'own' && sp.blood === vb;
      const cent = src === 'victim' ? [`${L}：${vb} 型（和死者同型）`, `離心快篩：人血，${vb} 型，和死者血型一樣——很可疑。送實驗室驗 DNA 可以確定是不是死者的血。`]
        : src === 'own' ? [`${L}：${sp.blood} 型（${same ? '和死者同型' : '和死者不同'}）`, `離心快篩：人血，${sp.blood} 型。${same ? '剛好和死者同型，要送實驗室驗 DNA 才能確定。' : `死者是 ${vb} 型，這不是死者的血。`}`]
        : src === 'meat' ? [`${L}：不是人血`, '離心快篩：動物血（像是生肉的血水），不是死者的血。']
        : [`${L}：不是血`, '離心快篩：沒有血紅素反應，是紅酒或顏料之類的污漬，不是死者的血。'];
      ev(k, cent[0], 'ev_blood', cent[1], { stain: [sp.id, src === 'victim' || same ? 'type' : 'no'] });
      if (src === 'victim') ev(k + '_dna', `實驗室：${L}與死者 DNA 吻合`, 'ev_lab', `DNA 比對：${sp.name}${spot}上的血就是死者的血。`, { who: sp.id, stain: [sp.id, 'dna'] });
      else ev(k + '_dna', `實驗室：${L}不是死者的血`, 'ev_lab', `DNA 比對：非死者血液——${src === 'own' ? `是${sp.name}本人的血（手上有新的割傷）` : src === 'meat' ? '是生肉的血水（傍晚在廚房處理過食材）' : '是紅酒漬'}。`, { stain: [sp.id, 'clear'] });
      ev(k + '_x', `${L}：樣本被污染`, 'ev_blood', '棉棒碰到衣服上的其他污漬，快篩結果判讀不了。', {}, ALT('poor'));
      C.stains.push({ id: 'stain_' + sp.id, npc: sp.id, name: L, spot, r: 75,
        acts: [{ id: 'swab', tool: 'swab', ap: 1, label: `採集${spot}的血漬`, mg: 'swab', sample: { kind: 'blood', label: L, res: k, lab: k + '_dna' }, q: { poor: { sample: { kind: 'blood', label: L + '（被污染）', res: k + '_x' } } } }] });
      sp.stain = spot;
    }
  }
  ev('E_phone', `實驗室：手機最後通聯＝${culprit.name}`, 'ev_lab', `解鎖手機：${hhmm(tod - 8)} ${who(culprit)}傳訊「我到了，開門」，之後死者再也沒有回覆。`, { who: culprit.id });
  ev('E_phone_wiped', '實驗室：手機被重設了', 'ev_lab', '手機在命案後被人恢復原廠設定，什麼都救不回來。', {});
  O.push({ id: 'phone', room: bodyRoom, x: B.x + 120, y: B.y + 70, img: 'prop_phone', w: 40, h: 26, name: '死者的手機', flat: true, r: 90, desc: '掉在屍體旁的手機，螢幕鎖著。', tamper: true,
    acts: [], bag: { ap: 1, size: 1, label: '裝袋帶走', lab: 'E_phone', labCond: [{ flag: 'tampered', res: 'E_phone_wiped' }] } });
  // 書桌文件（動機）
  ev('E_motive', `帳冊筆記：${culprit.name}`, 'ev_document', `死者的筆記：「${culprit.name}——${culprit.motive}。下週處理。」`, { motive: culprit.id });
  O.push({ id: 'desk', room: 'study', x: 2351, y: 540, img: 'prop_desk', baked: true, bw: 237, bh: 181, name: '書桌', r: 110, desc: '紅木書桌，抽屜沒鎖。', acts: [{ id: 'ledger', tool: 'camera', ap: 1, label: '翻拍抽屜裡的筆記', ev: ['E_motive'] }] });
  // 清理痕跡（有血的手法）
  if (method.blood) {
    ev('E_towel', '實驗室：毛巾血跡＋皮屑', 'ev_lab', `毛巾上是死者的血，還夾著${who(culprit)}的皮屑——兇手用它擦過手。`, { who: culprit.id });
    ev('E_mop', '拖把強烈血跡反應', 'ev_luminol', '拖把和水桶強烈藍光，還是濕的 → 命案後有人拖過地。', {});
  } else {
    ev('E_towel', '實驗室：毛巾只是油污', 'ev_lab', '毛巾上只有廚房油污。', {});
    ev('E_mop', '拖把沒有血跡', 'ev_luminol', '拖把是乾的，沒有血跡反應。', {});
  }
  O.push({ id: 'trash', room: 'kitchen', x: 1250, y: 1263, img: 'prop_trash_can', baked: true, bw: 72, bh: 100, name: '垃圾桶', r: 90, desc: '垃圾桶最上面有一條揉成一團的毛巾。', acts: [], bag: { ap: 1, size: 1, label: '把毛巾裝袋帶走', lab: 'E_towel' } });
  ev('E_mopT', method.blood ? '水桶的水還是溫的' : '水桶的水是冷的', 'ev_thermo', method.blood ? `水桶裡的水約 31°C，比室溫高很多 → 大約 1 小時內有人用熱水拖過地（${hhmm(tod)} 前後屋裡有人在清理）。` : '水桶裡的水和室溫一樣，拖把也是乾的——好幾天沒用了。', {});
  O.push({ id: 'mop', room: 'kitchen', x: 1528, y: 1306, img: 'prop_mop_bucket', w: 70, h: 100, name: '拖把和水桶', r: 90, desc: '拖把和水桶放在廚房角落。', acts: [{ id: 'lum', tool: 'luminol', ap: 2, label: '噴灑魯米諾', ev: ['E_mop'], reveal: method.blood ? 'fx_luminol_spot' : null }, { id: 'temp', tool: 'thermo', ap: 1, label: '量水桶的水溫', ev: ['E_mopT'] }] });
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
      O.push({ id: 'frame', room: bodyRoom, x: B.x - 105, y: B.y + 56, img: 'prop_planted_item', w: 34, h: 26, name: `地上的${inn.item}`, flat: true, r: 80, desc: `屍體附近地上的${inn.item}。`,
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
  const SPOT = [{ x: 230, y: 1090 }, { x: 430, y: 1260 }, { x: 320, y: 1410 }, { x: 590, y: 1330 }].map(scP);
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
  const SW = { living: { x: 1168, y: 650 }, study: { x: 1932, y: 860 }, kitchen: { x: 1168, y: 1300 } };   // 原圖像素
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
  C.cops = posts.map((pp, i) => ({ id: 'cop' + i, name: names[i], img: 'npc_officer_' + (1 + Math.floor(r2() * 5)), posts: pp.map(scP) }));
  C.rookies = D.rookies; C.reports = REPORTS; C.roles = ROLES;
  if (D.hidden) C.tutRookie = 'cop1';   // v16：教學的菜鳥固定是屋裡的李警員；封鎖線入口的蔡警員是一般員警
  /* --- v14 警員初步報告：每位員警 1–2 條和這個案件有關的線索（不直接點名兇手，只指向要去驗證的房間／物品／人） --- */
  const r3 = rng((seed ^ 0x27d4eb2f) >>> 0), RN = BASE.roomName;
  const disc = pick(r3, sus), watchS = pick(r3, sus), off = [-10, 0, 10][Math.floor(r3() * 3)];
  const SOUND = { blunt: '「咚」一聲很重的悶響', stab: '一聲短促的尖叫', strangle: '有人在吵架，接著是椅子倒地的聲音', poison: '有人在聊天、碰杯，之後就很安靜', staged: '一聲悶響，像有很重的東西倒下', contact: '沒有聽到什麼聲音，只有屋裡的音樂一直開著' };
  const pool = [
    { k: 'call', t: `報案的是${disc.name}（${disc.role.replace(/（.*）/, '')}）：22:05 左右來找死者，看到${RN[bodyRoom]}燈亮著、人倒在地上，馬上打 110。` },
    { k: 'sound', t: `隔壁住戶說，大約 ${hhmm(tod + off)} 聽到${SOUND[method.id]}，之後就沒有動靜了。` },
    { k: 'room', t: method.blood ? `我們到的時候，${RN[crime]}的地板特別乾淨，還聞得到清潔劑的味道。` : method.id === 'strangle' ? `${RN[crime]}的椅子歪在一邊，地毯被拖得皺皺的。` : `${RN[W.room]}桌上的東西被人動過，擺得跟平常不太一樣（管家說的）。` },
    { k: 'shoe', t: `我在${C.shoeSpot.where}看到地上有鞋印，已經請大家繞開別踩。` },
    { k: 'sus', t: r3() < .5 ? `${watchS.name}從我們到場就一直問什麼時候可以走，很不耐煩。` : `${watchS.name}說${hhmm(tod - 60)} 之後${watchS.alibi}，講到一半改口了一次，你們可以再確認。` },
    { k: 'phone', t: `死者的手機掉在${RN[bodyRoom]}屍體旁邊，螢幕一直有訊息跳出來，我們沒碰。` }
  ];
  const st0 = (C.stains || [])[0]; if (st0) { const sp0 = sus.find(x => x.id === st0.npc); pool.push({ k: 'stain', t: `${sp0.name}的${st0.spot}好像沾到深色的東西，本人好像沒注意到。` }); }
  const pl = shuffle(r3, pool); C.copReports = {};
  C.cops.forEach((c, i) => { C.copReports[c.id] = [pl[i % pl.length]]; });
  pl.slice(C.cops.length).forEach((x, i) => { const c = C.cops[i % C.cops.length]; if (C.copReports[c.id].length < 2) C.copReports[c.id].push(x); });
  /* --- v14 觀察關係人：兇手的「破綻」和案情一致；無辜的人也可能有看起來可疑、但有合理解釋的樣子 --- */
  const PHYS = [];
  if (method.nails) PHYS.push('手背上有兩三道新的抓痕，袖子一直往下拉。');
  if (method.blood) PHYS.push('身上有淡淡的漂白水／清潔劑味道。');
  if (C.shoeSpot.ground === 'mud') PHYS.push('鞋底邊緣卡著還沒乾的泥巴。');
  if (method.id === 'poison') PHYS.push('外套口袋露出一角藥袋，被問到就塞回去。');
  if (method.id === 'contact') PHYS.push('一直不肯脫手套，露出來的指尖有點紅腫。');
  if (method.id === 'strangle') PHYS.push('手掌有一道細細的紅色壓痕，像用力拉過繩子。');
  if (!PHYS.length) PHYS.push('衣服換過了，跟鄰居描述傍晚看到的不一樣。');
  const BEH = [`說話時眼神一直飄向${RN[crime]}的方向。`, `回答很快、像背好的，問到 ${hhmm(tod)} 前後就變得含糊。`, '你一靠近，他就下意識把手藏到背後。'];
  const RH = { gardener: '鞋上沾滿泥巴（他是園丁，整天在院子工作）。', maid: '手上有漂白水味（說今天下午才打掃過廚房）。', daughter: '眼睛又紅又腫，一直在哭，問話時情緒很激動。', reporter: '一直偷偷用手機拍現場，被發現就說是工作需要。', neighbor: '身上有很重的菸味，手一直在發抖（說是天氣冷）。', wife: '一直打電話給保險公司，語氣冷靜得有點奇怪。', partner: '一直看錶、傳訊息，說等一下還有客戶要見。' };
  const CALM = '神情疲憊但很配合，前後說法一致，看不出特別的異狀。';
  C.tells = {};
  for (const sp of sus) {
    if (sp === culprit) { C.tells[sp.id] = [pick(r3, PHYS), pick(r3, BEH)]; continue; }
    const L = [r3() < .6 ? RH[sp.id] : CALM];
    const so = (C.stains || []).find(x => x.npc === sp.id);
    if (so) { const t = (E['E_st_' + sp.id + '_dna'] || {}).text || ''; L.push(/割傷/.test(t) ? '手指貼著 OK 繃（說傍晚切水果割到）。' : /生肉/.test(t) ? `${so.spot}有點腥味（說傍晚在廚房處理過生肉）。` : /紅酒/.test(t) ? `${so.spot}聞得到紅酒味。` : ''); }
    C.tells[sp.id] = L.filter(Boolean);
  }
  C.mgMin = D.hidden ? 1.5 : 4;          // 小遊戲最少要花的秒數（伺服器檢查）
  C.mgEasy = !!D.hidden;                 // 新手教學：表現再差也給完整結果（但會顯示分數）
  for (const o of O) { const z = SIZES[o.img]; if (o.baked) { o.w = q(o.bw); o.h = q(o.bh); delete o.bw; delete o.bh; } else if (z && !o.ownSize) { o.w = z[0]; o.h = z[1]; } }
  for (const o of O) { if (typeof o.x === 'number') o.x = q(o.x); if (typeof o.y === 'number') o.y = q(o.y); }   // v12：原圖像素 → 世界座標
  C.H = H_REF;
  return C;
}
const API = { MS, q, generate, ROLES, SIZES, H_REF, DIFF, REPORTS, COP_POSTS, METHODS, SIGS, PEOPLE, WEAPONS, BASE, rng, hhmm };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else root.FS_GEN = API;
})(typeof self !== 'undefined' ? self : this);
