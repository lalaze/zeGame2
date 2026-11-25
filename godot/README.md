# Tiny Bean Café — Godot 4.7 B0 样片

本目录是 Tiny Bean Café 向 Godot 4.7（GDScript + `gl_compatibility`）迁移的 **B0 样片**，用于真机对比网页版（Phaser 4 PWA）的帧率、内存、发热与中文渲染效果。

## 目录结构

| 路径 | 说明 |
| --- | --- |
| `project.godot` | Godot 4.7 工程配置（竖屏 412×915、`canvas_items` + `expand`、`gl_compatibility`） |
| `export_presets.cfg` | Android `arm64-v8a` Debug 导出预设（包名 `com.lalaze.tinybeancafe.sample`，无明文密码） |
| `data/*.json` | 由 `scripts/godot-sync.mjs` 从 TS 源数据导出的菜单、原料、公式常量、布局坐标与中英文文案 |
| `fonts/` | OFL 字体子集（`nunito-latin.ttf` + `noto-sans-sc.ttf`）及两份 `OFL-*.txt` 许可证 |
| `art/` *(gitignore)* | 同步自 `assets/generated/floor-sample-v1/build/` 的 `full/`（原尺寸）与 `half/`（半尺寸）贴图 |
| `build/` *(gitignore)* | 导出的 Android APK 输出目录 |
| `scenes/main.tscn` | 主场景入口 |
| `scripts/game_data.gd` | JSON 数据读取、格式化、时钟、坐标换算与纸张主题（`floors-ui.css` 配色） |
| `scripts/seeded_rng.gd` | 与 TS 基准一致的 32 位 LCG 确定性随机源 |
| `scripts/cafe_state.gd` | 菜单定价、里程碑、升级扣款、库存扣减与日结账本 |
| `scripts/cafe_sim.gd` | 一楼固定步长（0.05s）营业模拟（排队、点单、冲泡、外带/送桌、坐下饮用、超耐心离开、打烊收尾） |
| `scripts/building_view.gd` | 整栋楼渲染（屋顶/3F/2F/地下厨房静态层 + 1F 完整可玩层、人物 y-sort 与动画、全/半尺寸切换、30 人基准场景） |
| `scripts/menu_panel.gd` | 可滚动菜单管理抽屉（关闭时严格不刷新） |
| `scripts/bench_runner.gd` | 30 秒性能测试采样器，输出结果到屏幕及 `user://bench.json`（`full`/`half` 分预设存储） |
| `scripts/main.gd` | HUD、安全区适配、中英文切换、安卓返回键处理、日结弹窗与 CLI 自动化入口 |
| `tests/run_tests.gd` | 无头 GDScript 测试集 |
| `tests/run_baseline.gd` | 20 种子对照基准脚本 |

## 常用命令（仓库根目录执行）

```bash
# 1. 同步原尺寸 + 半尺寸贴图、从 TS 导出 JSON 数据并检查字体子集
npm run godot:sync

# 2. 导入资源（检查无 error）
/opt/homebrew/bin/godot --headless --path godot --import

# 3. 运行全套 Godot 样片测试（GDScript 测试 + TS 数据漂移与字符覆盖测试）
npm run godot:test

# 4. 运行 20 种子 TS vs GDScript 对照基准
npm run godot:baseline

# 5. 导出 Android arm64-v8a Debug APK（输出到 godot/build/tiny-bean-cafe-b0.apk）
npm run godot:apk
```

## 性能测试与真机对比口径

- **桌面端结果不能用于与手机或网页版对比**：桌面窗口管理器/合成器（尤其是关闭 VSync 或未对齐显示刷新周期时）可能产生交替帧间隔（例如 3 ms / 13 ms）与高于刷新率的虚高帧率，无法反映真实屏幕呈现。
- **自动节拍自检**：`user://bench.json` 会记录 `vsync_mode`、`refresh_rate_hz`（读取不到或 ≤ 0 时记为 `null` 并标注无法自检）以及 `pacing_invalid`。当 `avg_fps > 1.05 × refresh_rate_hz` 时自动标记 `pacing_invalid: true`，并在屏幕结果页给出醒目警告。
- **真机呈现核对**：在 Android 真机上测试时，除读取 `user://bench.json` 外，必须结合 `adb shell dumpsys SurfaceFlinger --latency <layer>` 的真实呈现时间戳核对帧节拍。
- **跨引擎对比指标**：Godot 帧时间 `p50` / `p95` 与网页端 `requestAnimationFrame`（rAF）回调并不完全同口径；对比 Godot 样片与网页版时，主要对比**每秒真实呈现帧数**与**卡顿次数（超过 25 ms 的慢帧数）**，同时观察内存与发热表现。

## B0 的刻意简化

为了尽快在真机验证性能与中文显示，B0 只包含核心闭环（含 VIP 5× 付费与一楼完整送餐/清场规则），**不包含**（均留待 B1 及后续补齐）：
- 伙伴系统与店员换色/换装（一楼使用 `owner` 与 `barista` 原贴图）
- 常客、口碑评分及口碑对客流的影响（`reputationTraffic`）、第 3 天起的 `demandPlan` 客群需求模型、招牌饮品、试饮活动
- 猫咪与猫咪礼物、街道商铺、分店与连锁、店长离线收益、宣传、天气/昼夜光照、厨房烘焙与地下室厨师
- 2F/3F/屋顶扩建后上楼服务（其余楼层仅作为静态层渲染并支持上下拖动浏览，使 GPU/贴图负载与网页版可比）
- 除菜单页以外的其他经营手账页（食材页、升级页、装扮页）与本地持久化存档

## 下一阶段（B1–B4）需要替换与补齐的内容

1. **B1（玩法与经济）**：补齐完整 `GameState` 序列化/存档迁移、厨房烘焙与多楼层桌位、伙伴/常客/口碑/天气/经营风格/宣传/街道/分店系统，并将 `cafe_sim.gd` 拆分为独立的模拟与寻路模块。
2. **B2（楼房画面）**：补齐昼夜天空与灯光渐变（`floors-sky.ts`）、动态换装与装修切换（`decor` 全槽位 + 升级机器/厨房拼接）、员工动态染色（`staff-paint.ts`）、猫咪动画、气泡/飘字/思考泡泡与楼梯井裁剪（`inWell`/`wellSink`）。
3. **B3（界面）**：补齐完整经营手账各标签页、引导流程、家具摆放交互及更精细的字体粗细变体（如静态 Regular/Bold 字重分离）。
4. **B4（上机与发布）**：基于 B0 真机 `user://bench.json` 数据决策默认贴图分辨率（`full` 或 `half` / VRAM 压缩格式如 ETC2/ASTC）、iOS Xcode 导出与包体优化。
