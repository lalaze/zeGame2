# 启动超时与加载页居中修复

## 已证实的缺陷与证据

**已稳定复现截图相同的错误，但没有取得用户设备的原始请求日志，不能断言现场也是同一个字体请求卡住。** 普通本地网络、全新玩家及已有存档都能正常启动；下面的字体故障由隔离浏览器主动挂起该请求复现。

- 真实原构建、568×415、禁用 SW，除 `assets/pixel-zh-C-Ka8rhJ.woff2` 外所有请求结束，没有其他页面错误。进度停在 **399/404**，原有 **90 秒**时限后出现截图相同文案和 `Café startup timed out`。实际耗时 **90.418s**，没有加速计时：[真实复现数据](real-baseline.json)、[日志](real-baseline.log)、[原失败页](real-baseline-stalled-font.png)。另有 5 秒加速的早期反馈环：[baseline.json](baseline.json)。两者明确区分。
- 根因在 `loadSignFonts()`：它在 `CafeScene.preload/create` 的 Promise.all 中无限等待 `document.fonts.load()`。外层 `waitForStartupReady` 虽给 `document.fonts.ready` 两秒回退，但**渲染器自己的 Promise 已被同一个字体阻塞**，外层回退不能解开它。最初新增测试实际失败：[red-font-test.log](red-font-test.log)。
- 失败页偏左的原因是 `.loader-status` 继承进度行的 `text-align:left`，外层又是 space-between flex 行；隐藏百分比后没有切换成完整宽度的居中错误文本。固定屏幕容器还缺少显式 border-box/min-width 约束。
- 该复现不需要街道、不需要 SW，因此 **23 张街景 PNG 和隐藏主店相机不是此复现的必要条件**。现有预缓存共约 39.8MB，23 张街景约 1.32MB；首访同步开始全部预缓存会额外竞争带宽，已将安装移出首帧关键路径。没有把这一潜在竞争认定为用户现场的唯一根因。

## 实际修改

1. `src/render/sign-lettering.ts`：可选招牌字体最多等两秒，随后使用已有平台字形回退；字体稍后成功仍由 `signFontRevision` 自动重绘。超时后仍处理晚到的成功/失败，不产生未处理 rejection。**90 秒 renderer deadline 未延长。** 修复后同一字体一直挂起时 **2.665s** 进入真实游戏，记录仍显示 fonts=loading：[恢复截图](stalled-font-recovered.png)、[最终浏览器数据](browser-validation.json)。
2. `src/style.css`：Pixel ZH 使用 `font-display:swap`，字体不可用时启动/失败文案仍立即可读。
3. `index.html`：标题、人物、状态、百分比、按钮和技术详情按可见 viewport 居中；长文本限制宽度、允许换行，窄/矮视口调整留白。生产 Vite 会移除 entry script 的 id，启动错误监听补识别匿名 module script，防止入口 chunk 失败只留下无限等待。
4. `startup-loading.ts` / `startup-ready.ts`：超时文案不再一律声称网络故障，说明可重载、未清除进度；技术详情包含渲染阶段、图片计数、字体状态、视口、可见性、online 与 SW 控制状态。诊断读取被 sandbox 拒绝也不会掩盖原错误。没有采集存档、姓名、URL 查询参数或上传遥测。
5. `CafeGame` / `CafeScene`：记录 artwork、character atlases/optional lettering、scene initialization、first frame 阶段；首帧前 WebGL context 丢失时立即报告具体图形错误，而不是继续等到通用超时。街道相机隐藏行为不变。
6. `main.ts` / `scripts/precache.mjs`：只在真实首帧及启动工作成功后发送 `cafe:ready` 并注册/更新 SW。已有控制 worker 仍可直接提供离线启动；安装仍完整预缓存，包括 23 张街景 PNG。未改 `public/sw.js` 既有版本隔离、原子安装完成标记、ignoreVary、等待旧页面关闭、按作用域清理旧应用缓存的规则；不调用 skipWaiting。

没有新增清缓存按钮、自动清缓存或清存档逻辑。重试仍是普通重新加载；**不清 localStorage/IndexedDB**。正常 SW 激活只清它自己版本的静态应用缓存。

## 本轮实际验证

```sh
npx vitest run src/ui/startup-ready.test.ts src/ui/startup-loading.test.ts src/ui/startup-bootstrap.test.ts src/render/sign-font-loading.test.ts src/render/sign-lettering.test.ts src/render/phaser/cafe-scene-loading.test.ts src/render/phaser/cafe-scene-sign-readiness.test.ts scripts/precache.test.mjs src/game/save-session.test.ts src/game/style-background-pause.test.ts src/ui/streets.test.ts --maxWorkers=1 --testTimeout=20000
npx tsc --noEmit
npm run build
node docs/startup-repair/verify.mjs
```

- **11 文件、111 项通过，0 失败**：[regression-tests.log](regression-tests.log)。包括实际 preload/create 路径中字体无限等待的回归，以及原经济边界、存档锁、街道和 SW 安装/更新规则。57 项早期运行不是另加的新测试数量。
- 独立 tsc exit 0：[typescript.log](typescript.log)。最终 build（含 tsc）成功：**✓ built in 839ms**，[build.log](build.log)。`git diff --check` 通过。
- **75 项浏览器检查符合预期**：[完整数据](browser-validation.json)、[日志](browser-validation.log)。包含主动注入失败的场景，不能把这些场景的预期请求失败描述为「所有请求均成功」。正常路径无页面错误。
- 全新玩家、已有隔离测试存档；568×415 / 360×780 / 390×844 / 1440×960 冷启动；字体挂起、字体拒绝、100ms RTT + 2MiB/s 慢网（真实启动 23.750s）；主图失败、入口 chunk 失败、GPU context 丢失；中英文加载和错误页居中及无横向溢出；故障解除后重载恢复。
- 故障页布局检查为了快速复跑将 90 秒计时压缩到 4 秒；**不用于声称修前真实超时耗时**。真实 90 秒复现另有上面的独立日志。普通字体回退、慢网和正常启动未加速。
- 冷启动实际注册时间不早于 ready 信号；SW 完整安装后 23 PNG 全在缓存，断网刷新能启动。
- 用独立浏览器 context + 隔离 SW 作用域模拟旧构建 → 新构建。新 worker installed/waiting、旧 worker activated，controllerchange 为空，新旧完整缓存都保留；旧页面尚开时，新 HTML 使用对应新 chunk，并等待原存档锁；旧页面关闭后安全接管存档。全部旧客户端关闭后新版激活，随后离线加载新版 HTML 和对应 hash chunk。未发现此版本升级的强占或提前清缓存竞态。
- localStorage 存档、额外 sentinel 及 IndexedDB sentinel 全程核验；只在首次初始化种入，重载不重新注入，从而能发现误删除。测试 context 与真实用户 profile 完全隔离。

中间 SW 验证夹具曾用异步 waitForFunction predicate 提前返回，导致 waiting 状态假失败；改为同步轮询所持 registration 后完整重跑。另修了 happy-dom 单测夹具意外尝试加载虚假 script 的噪声。未将中间测试问题归咎产品或算作通过。

## 截图

- [原失败页 568×415](real-baseline-stalled-font.png) → [修复后中文失败页](timeout-zh-568x415.png)。
- [中文加载页](loading-zh-568x415.png)、[英文加载页](loading-en-568x415.png)、[英文失败页](timeout-en-568x415.png)。
- [360px 中文失败页](timeout-zh-360x780.png)、[390px 中文失败页](timeout-zh-390x844.png)、[360px 英文失败页](timeout-en-360x780.png)、[桌面中文失败页](timeout-zh-1440x960.png)。其余语言/视口截图也在本目录。
- [字体仍挂起时已进入游戏](stalled-font-recovered.png)、[图片加载失败](image-fail.png)、[module 失败](module-fail.png)、[GPU context 丢失](graphics-loss.png)。

## 交付与边界

仍使用原 PID 25261 的 4174 preview，没有新建测试服务器、替换或重启服务。用户 HTTPS URL：**https://lalazemac-mini.tailcec3d.ts.net:4174**。此环境 Chromium 对该地址仍报 ERR_CONNECTION_CLOSED，已实际尝试并记录；**交互、SW 和缓存验证是在同一现有服务的安全 loopback 来源完成，不能冒充用户真机 HTTPS 验证。** HTTPS 本身通过直连 curl 可访问。

最终重新构建后，将浏览器测试过的 index、SW、3 个主 JS chunk、CSS 的 SHA-256 与最终 dist、HTTPS 实际响应三方核对，6 文件完全一致：[final-build-identity.json](final-build-identity.json)。最终主模块 `game-BsEZmkNv.js`、CSS `game-CAE5aRNa.css`。

旧构建回放仅在随机命名的隔离目录/作用域中使用临时文件，完成后删除，不会接管真实根页面。`prior-build.zip` 仅含修前公开 HTML/JS/CSS/字体（没有存档），供脚本重放升级；临时解压和 state bundle 都在 finally 清理。运行验证前需用 agent-browser 启动隔离浏览器并开放 CDP 9224。

尚不能证实：用户设备上当时究竟哪个请求/图形阶段卡住、真实 WebView/真机 HTTPS 的表现。没有访问用户原浏览器数据。若现场仍发生超时，新错误页将提供阶段和图片计数，而不是只给笼统网络提示。本轮未进行全仓库回归，未继续美术扩展。未 commit/push，保留所有原有未提交修改。
