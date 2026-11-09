# A UI 边框清理 · 2026-11-09

已修复并发布。本轮运行时代码只修改 [cream-pixel.css](../../src/ui/cream-pixel.css)，不改场景、布局功能、经营、存档或购买逻辑，不生成图片，不 commit/reset/push，也未覆盖上一轮证据。

**实际原因**：[修复前 computed styles](computed-before.json)确认，按钮有九宫格深/浅两个 SVG 环、两条 inset 亮暗线、2×3px drop-shadow；父 dock 还有九宫格、两层 inset 和外影。图标伪元素的 shadow/filter 均为 none，旧 ledger/mobile 样式未在这些装饰属性上胜出。不是缓存问题。[修复前截图](before-mobile-390.png)。

**修正**：共享按钮改为单条 2px 深咖啡实线，去除 border-image、默认/hover/active inset 与 drop-shadow；面板也取消套环和投影；dock 只留低对比 1px 轮廓。hover/active 仅轻微填色，热区不移动。奶油/绿、危险红、禁用斜纹/disabled 语义、44px 目标、16px 输入及键盘 focus-visible 保留。普通状态没有额外装饰圈，键盘焦点时的橙色 outline 是明确的交互反馈。

## 本轮真实验证

```sh
npx vitest run src/ui/cream-pixel.test.ts src/ui/mobile-cafe-hud.test.ts src/ui/fullscreen-drawer.test.ts src/ui/dialog.test.ts src/ui/streets.test.ts
npx tsc --noEmit
node scripts/subset-font.mjs
npx vite build --outDir /tmp/zeGame2-ui-style-a-border-fix-stage-NJaUMZ
node docs/ui-style-a-border-fix/publish-staged.mjs
node docs/ui-style-a-border-fix/verify.mjs
```

- **5 文件、52 项 UI 测试通过，0 失败**：[tests.log](tests.log)。TypeScript exit 0：[typecheck.log](typecheck.log)。没有重跑或计入无关经济/美术测试。
- 最终 build exit 0，**5.64s**：[build.log](build.log)。独立全新 outDir，未清空 serving dist。
- **175 项浏览器检查通过，0 page/console/HTTP 资源错误**：[browser.log](browser.log)、[实际样式及状态数据](browser-validation.json)。覆盖 390×844、526×760 dock，360×800 面板/街道，1440×960 桌面；普通、hover、pressed、keyboard focus；检查实际无 inset/无 drop-shadow/无 border-image，按钮 ≥44px，按下前后坐标和尺寸不变，焦点可见且不被裁切，经营面板/街道/返回主店仍可使用。
- 页面全部实际加载最终 hash 入口。原服务 HTTP 入口、SW 和四个入口资源的 SHA256 与阶段目录及 dist 一致；阶段 **1,340 文件**与 dist 全部字节相同：[final-integrity.json](final-integrity.json)。
- 发布版本 **`8375b110b7fe1f9eb105`**；入口 `assets/game-Cf-GtJBg.js`，CSS `assets/game-BiXdOF27.css`：[build.json](build.json)。先发布资源，再原子换 HTML/SW，保留发布前 **44 个旧 hash 文件**。
- 原 4174 / PID **25261** 保留未重启：[services-after.txt](services-after.txt)。隔离浏览器已关闭，自动化残留为 0：[automation-processes-after.txt](automation-processes-after.txt)。临时 fixture 已清理，`git diff --check` 通过。
- 本轮按授权使用原服务本地 HTTP 完成校验，未重复尝试此前失败的 HTTPS，也未声称真机实测。

## 最终真实截图

- [390 主店](mobile-390-cafe.png) · [390 面板](mobile-390-panel.png) · [390 街道](mobile-390-street.png)
- **[390 dock 正常近景](mobile-390-dock-normal.png)** · **[390 dock 键盘焦点近景](mobile-390-dock-keyboard-focus.png)**
- [526 dock 正常近景](mobile-526-dock-normal.png) · [526 dock 键盘焦点近景](mobile-526-dock-keyboard-focus.png)
- [360 面板](mobile-360-panel.png) · [360 街道](mobile-360-street.png) · [桌面主店](desktop-cafe.png) · [桌面街道](desktop-street.png)

近景为真实页面截图直接裁剪。没有使用生成图或旧轮次截图。
