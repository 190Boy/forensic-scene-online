# MUSE 美術：重生狀態（v7 更新）

## v7 比例尺（所有圖都照這個換算）
成年角色身高 **H = 112** 世界單位（探員、員警、分局長、快遞員、嫌疑人都一樣；女兒 0.94 H）。
物件依真實比例設定在 `docs/casegen.js` 的 `SIZES`（寬或高 × H，長寬比照圖檔實際內容，圖檔都已裁到內容邊界）：
屍體身長 ≈1.05 H（斜躺 100×73）、客廳地毯 2.9 H、書房地毯 2.0 H、沙發 1.3 H 長、門 1.15 H 高、書櫃 1.1 H 高、
壁爐 1.2 H 寬、書桌 1.3 H 寬、流理台 150 寬、廂型車 2.9 H、路樹 2.3 H、手機 0.2 H、茶杯 0.17 H、刀架 0.32 H、開關 0.2 H。
**重生時**：構圖請填滿畫布（不要只畫在上半部）；匯入時會自動裁邊，尺寸由 `SIZES` 決定，不必配合畫布比例。

## v7 第二批重生（14 張）檢查結果
| 檔名 | v6 的問題 | v7 新圖 | 處理 |
|---|---|---|---|
| fx_luminol_spot | 畫成發藍光的書 | ✅ 純青色螢光斑 | 換上（不再用佔位圖） |
| fx_luminol_pool | 混進咖啡色碎片 | ✅ 純青色 | 換上 |
| prop_floor_mark | 畫成地磚 | ✅ 淡淡的拖地痕 | 換上（不再用佔位圖） |
| prop_curtain_cord | 畫成相框 | ✅ 金色編織繩＋流蘇，直式 | 換上 |
| prop_back_door | 只佔上方 1/3 | ✅ 細長側面門、填滿高度 | 換上 |
| prop_light_switch | 只佔上方 2/3 | ✅ | 換上 |
| prop_police_tape | 只佔上方 2/3 | ✅ 兩根柱子到底 | 換上 |
| floor_study | 粉紅接縫＋光影斑塊 | ✅ 均勻深色木地板，可無縫拼接 | 換上 |
| ground_grass | 大泥坑重複 | ✅ 只剩小泥點（2×2 拼接仍看得出規律，可接受） | 換上 |
| prop_body | 側躺、自帶米色區塊 | ✅ 趴姿（頭側向）、白色描邊、無地面區塊 | 換上，身長 ≈1.05 H |
| prop_rug_study | 斜角透視 | ✅ 接近正俯視 | 換上 |
| prop_necktie | 黑色一團 | ⚠️ 看得出是揉皺的深藍布，但仍沒有領結／大劍形狀 | 換上（比 v6 好），仍建議重生 |
| wall_foyer | 接縫殘影相框 | ⚠️ 相框殘影沒了，但下方護牆板仍有半透明「重影」面板，相框被上緣切到 | 換上，仍建議重生 |
| prop_carpet | 斜角透視 | ❌ 仍是斜角，而且變成很厚的床墊狀——屍體放上去像躺在床上 | **保留 v6 版本** |

## 仍建議重生（追加到原 prompt）
- **prop_necktie**：`a single silk necktie lying flat, top-down, clearly showing the knot at one end and the wide pointed blade at the other, dark navy with thin diagonal stripes, not crumpled, fills the canvas width`
- **wall_foyer**：`seamless horizontally; wainscoting panels evenly spaced with NO faded or semi-transparent duplicate panels; picture frames fully inside the tile with margin above them`
- **prop_carpet**：`perfectly top-down orthographic view of a thin flat cream area rug with tassels on the short ends, no thickness, no perspective, no 3D edge, fills the canvas`
