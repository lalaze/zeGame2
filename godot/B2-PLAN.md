# B2：楼房画面

把网页版的剖面楼房（`src/render/floors/*`）搬到 Godot，由 B1 的 `core/` 驱动。TypeScript 仍是唯一标准。

## 范围

| 网页版 | Godot |
| --- | --- |
| `floors-layout.ts` | `view/floors_layout.gd` |
| `floors-cat-places.ts`、`floors-cats.ts` | `view/floors_cat_places.gd`、`view/floors_cats.gd` |
| `floors-sky-light.ts`、`floors-sky.ts`（含用到的 `lighting.ts`、`business-light.ts`） | `view/floors_sky_light.gd`、`view/floors_sky.gd` |
| `floors-decor-layers.ts`、`floors-places.ts`、`floors-work.ts`、`floors-fx.ts`（图的选择）、`floors-looks.ts`（衣着编号与颜色）、`floors-upgrades.ts`（拼件）、`floors-front.ts`（菜单板的行）、`idle-props-art.ts` 的小费罐 | `view/floors_art.gd` |
| `floors-scene.ts` | `view/floors_scene.gd` |
| `floors-props.ts`、`floors-thoughts.ts`、`thoughts.ts`、`thought-bubbles.ts`（节奏）、`floors-front.ts`、`floors-upgrades.ts`、`staff-paint.ts` + `floors-looks.ts`、`textures.ts` + `floors-fx.ts`（拼气泡） | `view/floors_props.gd`、`floors_thoughts.gd` + `floors_bubble.gd`、`floors_thinking.gd`、`floors_front.gd`、`floors_upgrades.gd`、`floors_staff.gd`、`floors_textures.gd` |
| `cafe-view.ts` 里楼房用到的部分（销售、小费、帮忙的字、闪光、摸猫） | `view/floors_feed.gd` |
| Phaser 的图片、动画、载入 | `view/floors_pic.gd`、`floors_text.gd`、`floors_marks.gd`、`floors_library.gd`、`floors_depth.gd` |
| `src/i18n.ts`、`src/ui/item-name.ts` | `app/i18n.gd`（文案表 `data/locale-*.json` 由 `godot:sync` 从 `src/locales` 复制） |

另有 `app/cafe_app.gd` + `scenes/cafe.tscn`：能玩的入口（主场景），控件是临时的，B3 换成真正的界面。

不在 B2：街道、分店地图、人物头像、图标、主题预览（`floors-street/portraits/icons/theme-preview.ts`），以及所有网页界面——B3。B0 样片（`scripts/`、`scenes/main.tscn`、`tests/run_tests.gd`）留到 B3 一起撤掉。

## 验收

1. `npm run godot:view`：
   - 纯函数逐条和 TS 一致（布局、走路、猫的路线与选择、光照、图的选择、衣着、拼件、想法与节奏，含常量表）。
   - 场景逐帧一致：TS 侧不重写，直接跑网页版的 `FloorsScene`（`scripts/godot-parity/fake-phaser.ts` 只提供会记住位置的图片对象），Godot 重复同一家店、同样的操作，比较每个人的位置、路线、速度、透明度、朝向、图和帧、深度，道具、气泡、进度条，猫，礼物，打翻的杯子，提示气泡，谁在说话，镜头，外墙，家具和摆放，灯，昼夜颜色。影片里必须真的出现过的东西（厨师在每个灶台、两位厨师的每一格动作、炉光、每种道具、猫的每种打算……）列在 `view-scene.ts` 的 `MUST`，缺一样就失败；每个比较的帧还检查深的一定排在浅的之后。
2. 截图与网页版并排：打烊的店中午、晚上 SSIM ≥ 0.98（差别只在猫、云、字体）。
3. `tests/run_app_tests.gd`：按手机上的入口启动，开店、营业、点击、外墙、一整天、存档、切后台、再次启动、扩建、开分店，以及成交、小费、帮忙的一次性特效，摆放的点击范围，真实的触摸、拖动和放开正在跟随的猫。`tests/run_view_drawn.gd`（要有窗口）真正画出来检查：深的画在浅的上面、描边的粗细。
4. 性能：`tests/bench_view.gd` 最忙的店 `FloorsScene.update` 平均 < 4 ms（这台 Mac，无头），节点 < 900。
5. `npm run godot:test`、`npx tsc --noEmit`、`npm test` 全过。

## 和网页版有意不同的地方

- 店员换色用着色器算，不逐像素画新图：同一套公式，少一步 8 位取整。
- 暂停时走路的腿停住（网页版只停位置，腿还在动）。
- 时刻的小费落在提示气泡处。网页版 `floors-cats.ts` 先取走了 `view.tips`，非猫的时刻小费会弹在画面左上角外（`momentTarget` 是占位的 0,0），看不到。
- 帮忙的字按客人编号找人，不按投影后的位置找最近的人。
- 深度分层的数值（`floors_depth.gd`）比网页版紧，顺序相同。Godot 排序时把相差不到十万分之一的 y 当作相等，所以一个深度拆成 z 层（每 16 一层）和剩下的小 y。
- 半尺寸图（`godot/art/half`）：内存小的手机用；清单仍是原尺寸像素，`FloorsLibrary` 换算。默认用哪套在 B4 定。
