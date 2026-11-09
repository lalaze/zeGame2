# A「奶油像素」：店内与街道统一 UI

2026-11-09 实装并发布。以用户批准的[左右共同参考](approved-reference.png)为方向，SHA256 `f5d573713206db5960f41479c3214a77df16ccd26ca4c4e9fea8b505c33facb0`。图片只用于参考，没有嵌进游戏，没有调用生成模型。

## 变更

- 新增 [共享组件样式](../../src/ui/cream-pixel.css)：奶油表面、默认松绿操作色、咖啡色阶梯九宫格边框、单像素亮边和 2–3px 零模糊硬阴影。真实元素不使用 clip-path，保留完整键盘焦点。按钮按下只改变阴影，不移动点击区域。
- 店内 HUD、移动导航、经营/菜单/装修面板、通用 button/chip/tab、资源、设置、模态框和输入共用此语言；街道工具栏、路牌选项、导航、收益标签和购买抽屉使用同一套 token/边框，不再独立重复定义按钮皮肤。
- `Pixel ZH` / `Pixel Digits` / `Pixelify Sans` 替换实际渲染中的系统/宋体，关闭 ligatures。没有新字体依赖或启动等待；已有 subset 流程输出 1,583 字符、49.7KB 中文字体及 800B 数字字体。移动文本输入 16px，交互目标至少 44px；中文、英文、短屏、减少动画和 forced-colors 均覆盖。
- 保留原装修配色功能：奶油形制固定，墙纸仍联动 mint / rose / terracotta / walnut / midnight 操作色；默认 classic 为松绿。危险操作维持红色，禁用操作有浅色/斜纹及原生 disabled 语义；锁定路牌同时保留锁图形和文字要求，可继续预览。
- 16 张已批准店面/街道 PNG 的 SHA256 与上一轮完全一致；未修改场景绘制、家具、经济、存档、购买与收获逻辑、600ms 防误触或报价校验。保留字体 2s 降级、启动 90s 期限、首帧后 SW 注册和等待旧页面关闭的更新策略。

本轮源码修改：[main.ts](../../src/main.ts) 仅加入共享样式 import；[style.css](../../src/style.css) 和 [ledger.css](../../src/ui/ledger.css) 移除按下位移；[street-pixel.css](../../src/ui/street-pixel.css) 改为共享皮肤的街道布局层。新增 [cream-pixel.test.ts](../../src/ui/cream-pixel.test.ts)；[dialog.test.ts](../../src/ui/dialog.test.ts) 补齐 DOM 测试的图像预览 mock，避免焦点测试触发真实素材网络。所有先前未提交改动保留，未 commit/push。

## 本轮验证

```sh
npx vitest run src/render/street-art.test.ts src/ui/streets.test.ts src/game/streets.test.ts scripts/precache.test.mjs src/render/sign-font-loading.test.ts src/game/style-background-pause.test.ts src/ui/startup-ready.test.ts src/ui/cream-pixel.test.ts src/ui/mobile-cafe-hud.test.ts src/ui/fullscreen-drawer.test.ts src/ui/dialog.test.ts src/ui/panel-browsing.test.ts
npx tsc --noEmit
node scripts/subset-font.mjs
npx vite build --outDir /tmp/zeGame2-ui-style-a-stage-t0GGlM
node docs/ui-style-a/publish-staged.mjs
node docs/ui-style-a/verify-indoor.mjs
node docs/ui-style-a/verify-street.mjs
```

- **12 文件、161 项测试通过，0 失败**：[tests.log](tests.log)。TypeScript exit 0：[typecheck.log](typecheck.log)。含街道经济/迁移、付款保护、SW 合同、字体降级、后台主场景暂停、室内导航/焦点和新共享 UI 行为测试；没有将旧轮次测试算成本轮。
- 首轮新增 modal 测试未给出独立 Escape 回调，且既有 dialog 的 DOM 夹具漏 mock 图像资源，出现 1 个断言失败与 96 个网络异步错误；修正测试夹具后完整套件通过：[首轮日志](tests-first-run.log)。没有改应用 Escape 或资源加载逻辑掩盖问题。
- **室内 176 项浏览器检查通过**：[日志](indoor-browser.log)、[结构化结果](indoor-browser-validation.json)。覆盖主店 HUD、经营/菜单/装修/食材页、设置、名称输入/焦点、真实按下坐标、往返街道、装修配色、英文、减少动画和 forced-colors。每个上下文检查实际加载最终发布入口。姓名/标题/正文/数字共 **52 条 CDP 实际 glyph 证据**均为现有自定义像素字体；店名对比度 ≥4.5。
- **街道 129 项检查通过**：[日志](street-browser.log)、[结构化结果](street-browser-validation.json)。包括默认与锁定预览、44px 控件、键盘/Escape、鼠标与真实 CDP 触控拖街、原坐标及店门双击不付款、购地/装修各自显式确认、600ms 内灰色禁用保护、跨街独立、单次收获防重复、运行中动画与减少动画，以及 **16 条 glyph 证据**。
- 两套最终记录均 **0 page error、0 console error、0 HTTP 资源错误**。尺寸为 Chromium 桌面 1440×960，以及触控模拟 390×844、360×800、526×760、568×415；不是物理手机验收。
- 字体请求被故意挂起时仍达到真实首帧 ready；SW 注册不早于该信号。隔离新上下文从未进街道，完整 SW 安装后已缓存全部 16 新 PNG，断网重载后首次进入街道仍完整显示：[离线截图](offline-first-street.png)。没有清理真实存档或应用缓存。
- 实景迭代修正了 SVG 九宫格固有尺寸、旧 42/40px 按钮、按下位移、危险/禁用颜色优先级，以及桌面店名在奶油底上的低对比。最终实际截图已重新采集，不用 iteration 图替代。运行时代码在最终构建后未再修改。

## 最终发布

- 原 `com.lalaze.zegame-pwa` / PID **25261** / 4174 未重启；没有新建游戏服务器。
- 全新独立阶段输出，**229 modules，902ms，exit 0**：[build.log](build.log)。没有在 serving dist 清空构建。
- [发布脚本](publish-staged.mjs)先校验绝对路径和 symlink，再先发布资源，原子替换 HTML，最后 SW；保留发布前 **42 个旧 hashed 文件**，不 prune、不强制激活或清缓存。[发布记录](publish.log)、[最终标识](build.json)及[完整性记录](final-integrity.json)。
- **SW 版本 `e6dd0aee7fccab1dbff0`**；入口 `assets/game-D8zhlV7q.js`，样式 `assets/game-DOiyzF6t.css`。
- 阶段目录 **1,340 文件**与 dist 全部字节相同。安全本地 HTTP 及现有 HTTPS 各下载入口、SW、三个入口 JS、CSS、咖啡馆和铺装 PNG，16 个响应 SHA256 均匹配阶段构建和 dist；上一轮入口的 4 个资源仍能完整取回。
- 预览：[现有 HTTPS 入口](https://lalazemac-mini.tailcec3d.ts.net:4174/)。本端口由 HTTPS 转发，不能把返回 400 的 `http://100.96.195.115:4174` 当作可用入口。本环境 Chromium HTTPS 导航仍 `ERR_CONNECTION_CLOSED`，没有因该错误更改应用。自动化渲染使用原服务的安全本地来源，HTTPS 内容另外通过 curl 校验。
- 关闭了本轮 `ui-style-a` 自动化会话；[浏览器残留](automation-processes-after.txt)和[测试进程残留](test-processes-after.txt)均为 0，[原服务仍在](services-after.txt)。`git diff --check` 通过。没有覆盖旧 `docs/street-art-v2/` / `docs/street-ui-pixel/` 证据。

## 最终真实截图

- **390**：[主店](mobile-390-cafe.png) · [经营面板](mobile-390-panel.png) · [装修](mobile-390-decor.png) · [设置](mobile-390-settings.png) · [16px 输入焦点](mobile-390-profile-input.png) · [街道](mobile-390-street.png) · [购地确认抽屉](mobile-390-confirm.png)
- **526**：[主店](mobile-526-cafe.png) · [经营面板](mobile-526-panel.png) · [街道](mobile-526-street.png)
- **360**：[主店](mobile-360-cafe.png) · [经营面板](mobile-360-panel.png) · [街道](mobile-360-street.png) · [英文面板](mobile-360-panel-english.png)
- **1440**：[主店](desktop-cafe.png) · [经营面板](desktop-panel.png) · [街道](desktop-street.png) · [确认](desktop-land-confirm.png)
- **568×415**：[主店](mobile-568-cafe.png) · [经营面板](mobile-568-panel.png) · [街道](mobile-568-street.png)
- [主店减少动画](mobile-390-cafe-reduced.png) · [主店高对比模式](mobile-390-forced-colors.png) · [街道运行动画](desktop-running-animation.png) · [街道减少动画](desktop-reduced-motion.png) · [锁定街道](desktop-locked-preview.png) · [键盘焦点](desktop-keyboard-focus.png)

剩余限制仅为未做物理手机实测、本环境 Chromium 无法直接打开现有 HTTPS；没有已知未完成的 A 样式实施项。
