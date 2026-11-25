# MUSE 美術：需要重生的圖（v6 匯入時檢查）

已全部匯入 `docs/assets/`（98 張中 96 張用 MUSE 圖，2 張保留程式佔位圖），經過：裁掉透明邊、站立物件貼齊底部、平放物件置中、256 色量化（總計約 3.4 MB）。

| 檔名 | 問題 | 這次怎麼處理 | 重生提示詞建議（追加到原 prompt） |
|---|---|---|---|
| fx_luminol_spot | 畫成一本發藍光的書／板子，不是螢光斑點 | **保留佔位圖** | `ONLY a glowing cyan luminol smear with small speckles, no objects, no book, no tile, no surface, pure light effect on transparent background, top-down` |
| prop_floor_mark | 畫成 3×3 灰色地磚，不是拖地痕 | **保留佔位圖** | `top-down, only faint semi-transparent curved wet mop streaks, no tiles, no floor, no border, transparent background, very subtle grey-blue` |
| prop_curtain_cord | 畫成方形相框＋小流蘇，而且只佔畫布上方 1/3 | 貼齊底部（顯示偏小） | `tall vertical 1:3 composition filling the whole canvas height: a thick braided gold curtain tie-back cord with a tassel hanging straight down, no window, no frame` |
| prop_back_door | 正方形構圖，只佔畫布上方 1/3 | 貼齊底部（顯示偏小） | `very tall narrow 1:4 composition filling the full height: a wooden back door seen edge-on in a side wall, slightly ajar` |
| prop_light_switch | 只佔畫布上方 2/3 | 貼齊底部 | `fill the entire 48×88 canvas: tall cream switch plate, straight-on` |
| prop_police_tape | 只佔畫布上方 2/3 | 貼齊底部 | `fill the full tall 120×300 canvas, posts reaching the bottom edge` |
| prop_necktie | 很小、黑色一團，看不出是領帶 | 置中放大 | `top-down, clearly necktie-shaped (wide blade, knot end), dark navy silk with a subtle stripe, lying flat diagonally, filling the canvas width` |
| floor_study | 拼接處有粉紅色地毯邊條（十字形接縫）＋光影一塊一塊 | 程式修掉邊條、拉平光影（仍有淡淡方塊感） | `seamless tileable dark walnut floor planks running horizontally, perfectly even lighting, no rug, no border, no vignette` |
| ground_grass | 大塊泥水坑重複感很明顯 | 照用 | `seamless tileable dark night grass, small uniform details only, no large puddles or rocks` |
| wall_foyer | 左右接縫有半透明的「殘影」相框 | 照用 | `seamless horizontally, frames fully inside the tile, no faded duplicates at the edges` |
| fx_luminol_pool | 混進咖啡色碎木片 | 程式去掉非藍色部分 | `pure cyan glow only, no debris, no wood, no floor` |
| prop_body | 側躺露臉（prompt 是趴著），底下自帶米色粉筆區塊 | 照用（風格OK、不血腥） | 可選：`lying face down, top-down view, no ground patch` |
| prop_carpet / prop_rug_study | 斜角透視（不是正俯視） | 照用（和 45° 視角還算搭） | 可選：`perfectly top-down flat rectangle filling the canvas` |
