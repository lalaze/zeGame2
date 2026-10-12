# 手机体验证据包

先看 [ACCEPTANCE.md](ACCEPTANCE.md)：结果、六条经营流程、修复清单和真机验证边界。

## 建议查看的截图

- `screenshots/final-360-en-reopened.jpg`：360px 英文再次营业。
- `screenshots/final-390-zh-settlement.jpg`：390px 中文关店结算。
- `screenshots/final-430-en-management.jpg`：430px 经营面板。
- `screenshots/final-360-en-long-feedback.jpg`：长提示与服务操作分开。
- `screenshots/final-360-zh-held-quantity.jpg`：输入与按住加号后的 28。
- `screenshots/final-360-en-invalid-furniture.jpg`：非法位置红色预览与反馈。
- `screenshots/final-430-en-furniture-placement.jpg`、`final-430-en-moved-furniture.jpg`：家具放置及移动。
- `screenshots/final-390-zh-furniture.jpg`：中文布置模式。
- `screenshots/final-720x390-landscape.jpg`、`final-desktop-restored.jpg`：短横屏和桌面恢复。
- `screenshots/native-pause-before.png`、`native-pause-return.png`、`native-pause-resumed.png`：真正原生标签切换前、返回、继续运行。
- `screenshots/bakery-before-overflow.jpg` 和各 `final-*-bakery.jpg`：烘焙列表修前/修后。

截图来自测试咖啡馆。带标题的手机尺寸画面是桌面 Chromium 内的 CSS 视口模拟，鼠标操作不等于触摸操作。

追加 P3 跨断点滚动修复：见 ACCEPTANCE.md 的追加章节、`logs/scroll-fix-ui.json` 和 `screenshots/scroll-fix-*.jpg`。

## 原始记录

- `logs/ui-actions.json`：按时间记录的 UI 操作与可见页面快照。后续修复均追加对应复测。
- `logs/final-runs.json`、`final-reports.json`：完整经营循环与刷新金额。
- `logs/final-target-audit.json`、`final-bakery-audit.json`：布局和触控尺寸辅助审计。
- `logs/scroll-regression.json`、`final-feedback.json`、`frame-timing.json`、`native-pause-timing.json`：专项测量。
- `logs/final-tests.log`、`final-build.log`：最终通过结果；`review-final-*` 为独立隔离构建的最终结果（666 passed）。
- `PLAN.md`、`PROGRESS.md`：分阶段目标、完成证据与恢复方法。
- `MANIFEST.json`：证据文件 SHA-256 和对应源码状态指纹（不包含源码内容）。

仅包含文档、截图、测试/测量日志。没有用户存档、源码包、凭据或授权资料。早期 stage 日志用于追溯，以 final 日志为最终结果。测试工具与浏览器使用各自运行时钟；不要以日志时区差异推断执行顺序，操作记录的 ISO 时间为 UI 顺序依据。
