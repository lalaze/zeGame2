# Tiny Bean Café — Godot 4.7

本目录是 Tiny Bean Café 向 Godot 4.7（GDScript + `gl_compatibility`）的迁移：**B1 玩法规则**（`core/`，和 `src/game/` 逐位一致）、**B2 楼房画面**（`view/`）、**B3 界面**（`ui/`）、**B4 上机与存档导入**。TypeScript 仍是唯一标准。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `project.godot` | Godot 4.7 工程配置（竖屏 412×915、`canvas_items` + `expand`、`gl_compatibility`），主场景 `scenes/cafe.tscn` |
| `export_presets.cfg` | Android `arm64-v8a` 和 iOS（Xcode 工程）导出预设 |
| `app/` | 入口（`cafe_app.gd`）和文案（`i18n.gd`） |
| `core/`、`data/rules.json` | 玩法规则 |
| `view/` | 楼房画面 |
| `ui/` | 界面 |
| `scripts/file_store.gd` | 存档落盘 |
| `data/locale-*.json` | 从 `src/locales` 复制的文案 |
| `fonts/` | OFL 字体子集（`nunito-latin.ttf` + `noto-sans-sc.ttf`，只含游戏里出现的字）及两份许可证 |
| `art/` *(gitignore)* | 同步自 `assets/generated/floor-sample-v1/build/` 的 `full/`（原尺寸）与 `half/`（半尺寸）贴图和清单 |
| `tests/` | 无头测试和对照、出图工具 |

## 常用命令（仓库根目录执行）

```bash
npm run godot:sync        # 同步贴图、从 TS 导出规则数据和文案、检查字体子集
/opt/homebrew/bin/godot --headless --path godot --import   # 导入资源（检查无 error）
npm run godot:test        # 全套测试（对照的快速版）
npm run godot:bench       # 规则、画面、界面各要多久
npm run godot:apk         # 导出 Android arm64-v8a 调试版 APK；加 -- --release 出发布版（同一把钥匙，可盖装）
npm run godot:ios         # 导出 Xcode 工程到 godot/build/ios/
npm run godot:move        # 从手机 Chrome 读出网页版存档；加 -- --push 写进应用
```

## B1：玩法规则（`core/`）

`src/game/*.ts` 的每个模块在 `core/` 有一个同名文件，`core/game_session.gd` 是 `src/main.ts` 里属于规则的编排（每帧推进、开店打烊日结、店长、离开回来、存档）。TypeScript 仍是唯一标准：**改玩法先改 `src/game/`，再改 `core/`，然后跑下面的对照**，差一位都会失败。

| 路径 | 说明 |
| --- | --- |
| `core/js_math.gd`、`js_json.gd`、`js_util.gd`、`js_bigint.gd` | 和 JS 逐位相同的数字解析与格式化、`Math.pow/log/hypot/round`、JSON、稳定排序等。规则里不用 `String.to_float`、`pow`、`sort_custom` 这些会差最后一位或不稳定的内置函数 |
| `core/rules_data.gd`、`data/rules.json` | 从 TS 导出的常量表（`npm run godot:sync` 生成）。数字按双精度的位存放 |
| `core/clock.gd` | 现在几点；测试用 `override` 固定 |
| `core/*.gd` | 规则模块。状态、客人、店员都是 `Dictionary`，键名和顺序同存档；数字一律 `float`；`undefined` = 没有这个键；随机源由调用者传入 |
| `core/sim.gd`、`sim_snapshot.gd`、`moments.gd`、`living_cats.gd`、`operations.gd` | 营业模拟、店内小事件、猫、营业提示 |
| `core/save_session.gd`、`storage.gd`、`game_session.gd` | 存档会话和整局流程。界面通过 `ui(what, args)` 信号收到“发生了什么”，通过变量告诉它“有没有弹窗、面板是否收起……” |
| `scripts/file_store.gd` | 存档落盘：写临时文件并读回核对，再改名替换，保留上一份；中途断电、磁盘满都能从完整的那份继续；读不出来的文件当作存档，不会被覆盖 |
| `tests/run_parity.gd` 等 | 对照用的无头脚本；TS 侧在 `scripts/godot-parity/` |
| `B1-PLAN.md` | B1 的范围、验收和实测过的数值陷阱 |

对照命令（向量和录像都现生成到 `godot/.parity/`，不入库）：

```bash
npm run godot:parity      # 数字底座 + 每个导出函数的随机用例 + 覆盖门禁 + 框架自检；可加模块名只跑一部分
npm run godot:lockstep    # 营业模拟、小事件、猫逐步对照（整天 × 早/中/晚店、操作、重载、缩放、边界、损坏的快照）
npm run godot:session     # 一家走遍各种分支的店，加 10 种子 × 3 种经营方式 × 30 天，TS 侧直接跑 src/main.ts 里的函数
npm run godot:bench       # 最忙的店一步要多久
npm run godot:test        # 以上的快速版 + 存档文件测试
```

- `scripts/godot-parity/allow.json` 是白名单：没有搬的模块（`notPorted`）、由别的检查比较的导出（`elsewhere`）、达不到通用门槛的函数、TS 里走不到的分支（`branches`、`lockstepBranches`、`sessionBranches`），逐条写了理由；多余的条目会让门禁失败。`src/game` 里新增的模块不写进来也会失败。
- `godot:session`（包括快速版）要求 `main.ts` 那些函数、`save-session.ts`、`storage.ts` 的每个分支都跑到；平常经营碰不到的分支由 `session.ts` 里的 `tour` 专门走一遍。
- `godot:session` 不重写 `main.ts`：`scripts/godot-parity/main-source.mjs` 按语法树把其中的函数原样取出来，放进只会记录的假页面里运行。`main.ts` 改名或删掉这些函数会直接报错。
- 浏览器专属、没有对应实现的：多标签页的 Web Locks（`acquireSaveSession` 的排队）、`watchSavePage`、后台标签页标题。

## B2：楼房画面（`view/`、`app/`）

范围、对应表和验收见 `B2-PLAN.md`。`scenes/cafe.tscn` 是主场景：`app/cafe_app.gd` 把 `CoreGameSession`、`FloorsScene` 和 `CafeUi` 接起来。

```bash
npm run godot:view                 # 画面的计算逐条对照 + 网页版场景逐帧对照
/opt/homebrew/bin/godot --headless --path godot --script res://tests/run_app_tests.gd   # 按手机入口玩一遍
/opt/homebrew/bin/godot --headless --path godot --script res://tests/bench_view.gd      # 每一部分要多久
# 出图（要开窗口）：--save=存档 --hour=20.5 --weather=rain --wall=1 --preset=half --focus=1100 --closed
/opt/homebrew/bin/godot --path godot --resolution 824x1830 --script res://tests/view_shot.gd -- --out=/tmp/shot.png
```

- 场景只读规则：每帧看谁在做什么，让人走到楼房里对应的位置。画面里的随机（猫的打算、特效）不影响规则。
- 图按“网页版的键”取（`build/` 下的文件名去掉扩展名）；第一次用到的客人、装饰、家具、猫、地点在后台载入。
- 改了 `src/render/floors/` 要跟着改 `view/`，`godot:view` 会指出哪一帧哪一项不同。

## B3：界面（`ui/`）

范围、对应表、验收和有意不同的地方见 `B3-PLAN.md`。`ui/cafe_ui.gd` 是根：它听 `CoreGameSession.ui` 说发生了什么，并告诉规则现在开着什么（`modal_open`、`drawer_paused`……）。每个弹窗一个文件，用 `ui/paper.gd` 的积木搭成。

```bash
npm run godot:ui                   # 网页界面和 Godot 界面一起随机走，每按一下比较；可加界面名只跑一部分，如 npm run godot:ui lab,street
/opt/homebrew/bin/godot --headless --path godot --script res://tests/bench_ui.gd        # 每页打开和刷新要多久
# 出图（要开窗口）：--save=存档 --steps=hud,menu,closed,street,lot
/opt/homebrew/bin/godot --path godot --resolution 824x1830 --script res://tests/ui_shot.gd -- --out=/tmp --steps=hud
```

- 走查失败时会说是哪个文件第几条、第几步、按了什么之后不一样；`-- --only=1 --walk=124` 只跑那一条。
- 滚动列表里的按钮和卡片用 `MOUSE_FILTER_PASS`，这样从按钮上开始拖也能滚；直接浮在楼房上的用 `Paper.firm()`，不让触摸漏到楼房。
- 规则里的 `undefined` 到这里是 `JsUndefined`，不是 `null`：取可能没有的东西时用 `is Dictionary`、`is String` 判断。

## B4：上机与存档导入

范围、验收和没做的事见 `B4-PLAN.md`。

```bash
npm run godot:apk                                  # godot/build/tiny-bean-cafe.apk（调试版）
npm run godot:apk -- --release                     # godot/build/tiny-bean-cafe-release.apk（同一把调试钥匙，可以盖装，存档还在）
adb install -r godot/build/tiny-bean-cafe.apk
npm run godot:move -- --serial=<设备>              # 手机 Chrome 里开着网页版时，读出存档到 godot/build/saves/，手机上什么都不改
npm run godot:move -- --serial=<设备> --push       # 再写进应用（只能写调试版；应用原来的店先在电脑和手机上各留一份）
npm run godot:ios                                  # godot/build/ios/TinyBeanCafe.xcodeproj，在 Xcode 里选签名和设备
```

- 需要 Godot 4.7.2 的导出模板（`~/Library/Application Support/Godot/export_templates/4.7.2.stable/`）：`android_debug.apk`、`android_release.apk`、`ios.zip`。
- iOS 模拟器：`xcodebuild -project godot/build/ios/TinyBeanCafe.xcodeproj -scheme TinyBeanCafe -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' ARCHS=x86_64 ONLY_ACTIVE_ARCH=NO CODE_SIGNING_ALLOWED=NO build`（官方模拟器库只有 x86_64）。真机要 Xcode 26 和签名。
- 存档在应用的 `files/save/`：`tiny-bean-cafe%2Fsave`、上一份 `.prev`、应用里导入时换下来的 `tiny-bean-cafe%2Freplaced%2F<时间>`、`godot:move` 换下来的 `…save-before-move-<时间>`。
- 应用里也能搬：设置 → “搬家”，经剪贴板复制或导入存档，格式和网页版相同。
- 桌面上量的帧时间不能和手机比；手机上看 `adb shell dumpsys gfxinfo` 或 `SurfaceFlinger --latency` 的真实呈现时间。
- Godot 编辑器进程（导入、导出、`--script`）退出时会关掉 adb 服务，接着用 adb 的命令可能断一次，重来即可。
