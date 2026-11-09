> 2026-11-09：已确认的八款新店面与分层像素街道已实际接入。当前素材、构建、截图及验收以[街景美术 v2](../street-art-v2/README.md)为准；下文保留历史轮次记录。

# 连续像素街景重设计

> 后续启动故障修复与最新构建记录见 [启动修复验收](../startup-repair/README.md)。下方街景测试数量仍为对应历史轮次。

> 当前交付以「最终 CSS 视觉收尾」为准。独立验收后修复与首轮验证为历史记录，不计入这次收尾的新跑数量。


## 最终 CSS 视觉收尾（当前交付）

本轮运行时代码仅改 `src/ui/streets.css`，不改购买、装修、存档、生产或渲染逻辑。其余新增内容均为验证脚本、截图与记录。保留全部已有改动，未 commit/push。

- **行人被石台裁切**：两条步行路径改为 `bottom:84px/80px`，完整 88px 人物位于石台前方；静态起点横移 90px，避免聚在门牌正下方。短高度视口相应使用 16px/8px。普通 1440×960 实测人物顶部 788/792px，最高石台底部 787px；人物脚底 876/880px，底部导航顶部 882px，因此也不会被导航裁掉身体。标签仍在前景，可读性保持。
- **招租牌棕字发糊**：仅招租类牌子（出售/空铺/锁定）添加 `text-shadow:none`，正常营业木牌描边不变。实测棕字与浅底对比度 **5.47:1**。
- **减少动画遮橱窗**：在 reduced-motion 下隐藏进店装饰顾客，不再固定右移遮住陈列。六位沿街行人保留并静止，场景仍有生活感；普通模式进店动画不变。

### 这次实际验证与最终构建

```sh
npx vitest run src/ui/streets.test.ts --maxWorkers=1
npm run build
node docs/street-scene-redesign/visual-polish/verify.mjs
```

- 针对性测试 **1 文件、14 项通过，0 失败**：[tests.log](visual-polish/tests.log)。没有把用户独立复跑的 70 项或之前 297 项算成本轮新跑，也没有重跑 v25/经济等已完成验收。
- **最后一次 `npm run build` exit 0**，包含 `tsc --noEmit`；Vite 最终输出 `✓ built in 6.54s`：[build.log](visual-polish/build.log)。最终 CSS 为 `assets/game-Dw8Uq1Wk.css`，主入口模块为 `assets/game-Hj7PjAum.js`。此后未修改运行时代码或再次构建。
- 实际最终生产构建的 **43 项浏览器/交付检查通过，0 失败**，无页面/console error：[browser-validation.log](visual-polish/browser-validation.log)、[JSON 数据](visual-polish/browser-validation.json)。覆盖 1440、360、390px 的运行动画、减少动画、石台完整身位、导航不遮挡、标签绘制顺序、陈列可见、页面无溢出及招租牌对比度。普通模式实际等待并验证行人位置变化，截图均使用 `animations: 'allow'`。
- 继续使用现有 PID 25261 的 4174 preview，没有启动测试服务器或重启服务。对安全本地来源及用户提供的 **https://lalazemac-mini.tailcec3d.ts.net:4174**，分别下载 `index.html`、`sw.js`、3 个入口 JS 与最终 CSS，共 12 个响应，**SHA-256 与最终 dist 全部逐字节一致**；HTTPS 根页面返回 **200**：[URL 状态](visual-polish/url-status.txt)。自动化浏览器渲染通过同一现有服务的本地来源完成，TLS 交付内容另行核对。
- 会话 `street-visual-polish` 已关闭，临时 state bundle/对比副本已清理，automation profile 残留 0：[清理检查](visual-polish/automation-processes-after.txt)、[服务保留](visual-polish/services-after.txt)。`git diff --check` 通过。

### 最终截图

- 桌面：[运行动画](visual-polish/1440-motion.png)、[路面与招租牌近景](visual-polish/desktop-motion-closeup.png)、[减少动画](visual-polish/1440-reduced.png)。
- 360px：[运行动画](visual-polish/360-motion.png)、[减少动画与完整橱窗](visual-polish/360-reduced.png)。
- 390px：[运行动画](visual-polish/390-motion.png)、[减少动画与完整橱窗](visual-polish/390-reduced.png)。

本次三项 CSS 视觉问题已完成；未扩展到新交互、美术重画、惯性或其他功能。

---

## 独立验收后修复（上轮记录）

保留原有未提交修改，未 commit/push，未重启/替换现有 PID 25261 的 4174 preview。没有修改经济、生产公式或 v26 迁移实现。

### 实际修复

- **P1-1 误购/误装修**：修前在真实构建复现 1440×960、(1265,600) 双击，余额 1,000,000 → 991,000：[数据](review-fixes/baseline.json)、[截图](review-fixes/before-doubleclick.png)。每次打开详情、付款确认、完成或取消付款，现在都重新建立 600ms 单调时钟防护，处理函数也校验，覆盖 detail=0 的单击/键盘激活，不只依赖 disabled 或 click count。购地与装修各有独立的明确付款确认，列出街道、门牌、业态、金额/工期，默认聚焦取消。原店面双击/拖动不扣款，长按 Enter/Space 的重复按键被拦截。收获仍只发放一次。
- 真实浏览器还发现禁用按钮点击可能把焦点模糊到 body，因此 `src/ui/modal.ts` 增加可选分层 Escape 处理，关闭时移除监听；街道在这种情况下仍先关闭付款/详情并恢复铺位焦点，再退出街景。其他未设置该选项的弹窗保持原行为。
- **P1-2 离线首访**：只向已有 `scripts/runtime-art.json` 增补新路径，保留用户已有条目及 `scripts/precache.test.mjs` 改动。当前 **23 张 PNG**（原 22 张 + 像素云）在 `dist/sw.js` 中均标记为 1。全新浏览器 context 从未进街道，等待 SW 完整安装并核对缓存 23 张图，然后断网刷新游戏、首次进街道并遍历五街，全部解码成功。
- **P1-3 标签遮挡**：顾客基准位置改到门前/门侧，标签使用独立前景层、不透明底色，店铺标签也高于沿街行人。普通模式采样完整 14 秒动画周期的 40 个时间点，检查真实浏览器绘制命中顺序；减少动画模式、360/390px 均检查。本轮所有截图使用 `animations: 'allow'`。
- 构建验证额外发现人物 CSS URL 问题：`BASE_URL='./'` 经 CSS 自定义属性使用时解析到 stylesheet 所在的 `assets/art/`。已用 `document.baseURI` 转绝对 URL，补单测、实际背景图片 MIME 与真实移动检查，避免只验证 DOM img 而遗漏人物。
- **视觉 P2**：city 招牌由 57% 改到 46%，五街截图确认位于木牌上；店铺统一 **268×320**，134×160 原图按精确 2× 渲染，移除 320/210px 非整数缩放。人物改为原图 80×88 帧和 960×88 图集，替代 0.8× 缩放。招牌用浅色字、深轮廓提高对比；矩形云替换为已有 cozy-world 像素云。远景与陈列继续复用素材，未整套重画。
- **交互/性能 P2**：店铺焦点下 Left/Right、Home/End 切换店铺焦点并沿街定位，不自动打开/购买，不抢 select 的原生方向键。街景遮挡主店时，`main.ts` 跳过 `CafeView.update` 与猫咪动画更新；Phaser 保留 tick 来更新街道 UI/真实时间状态，同时隐藏相机、跳过绘制准备、灯光与贴图工作。返回恢复。350ms 浏览器采样 GPU 绘制调用为 **30 → 0 → 42**；执行真实 frame 源的测试确认街道更新仍继续。
- **v25 补验**：合法旧档含前四间扩建、第五间在建、二级书签设施及一件扩建家具。从真实入口迁移，五铺保留且无额外收费，等级/在建工期/家具回仓正确，旧待收货只领取 **360 金币 + 24 灵感**；刷新不重复授予。

### 本轮实际新跑命令与结果

```sh
npx vitest run src/ui/streets.test.ts src/game/streets.test.ts src/game/room-projects.test.ts src/ui/room-projects.test.ts src/game/save-session.test.ts src/game/chain.test.ts src/game/regions.test.ts src/i18n.test.ts src/game/game.test.ts src/game/economy-invariants.test.ts src/game/manager.test.ts src/game/locations.test.ts src/game/chain-bonuses.test.ts src/ui/fullscreen-drawer.test.ts src/ui/fullscreen-layout.test.ts src/ui/room-viewport.test.ts src/ui/room-overview.test.ts src/ui/kitchen-door.test.ts src/render/passages.test.ts src/game/style-background-pause.test.ts scripts/precache.test.mjs --maxWorkers=1 --testTimeout=20000
npx tsc --noEmit
npm run build
node scripts/street-review-qa.mjs
```

- 最终 **21 文件、297 项测试通过，0 失败**：[regression-tests.log](review-fixes/regression-tests.log)。包含已有经济/迁移/生产和新增误购/确认/键盘/frame/预缓存回归。
- 独立 tsc exit 0：[typescript.log](review-fixes/typescript.log)；最终 build（含 tsc）通过：[build.log](review-fixes/build.log)。`git diff --check` 通过。
- 新浏览器脚本直接测试现有服务的 **dist 生产构建**，**49 项检查通过**，页面错误、console error、HTTP 失败均为 0：[日志](review-fixes/browser-validation.log)、[JSON，含缓存与 GPU 数据](review-fixes/browser-validation.json)。新建独立 context/测试存档，不访问真实用户浏览器 profile。
- 红阶段：误购/预缓存新增测试先为 2 失败 / 32 通过，隐藏渲染测试先为 1 失败 / 14 通过：[red-tests.log](review-fixes/red-tests.log)、[red-render-test.log](review-fixes/red-render-test.log)。实现中一个 TS6133 未使用变量已移除。浏览器中间运行暴露 body/Escape 和生产 CSS 图片问题，已修复；动画断言改为考虑原有负延迟，v25 夹具由非法跳序校正为旧版合法扩建顺序，最终完整重跑，不把失败算成通过。

### 新截图

- [双击保护](review-fixes/doubleclick-protected.png)、[付款确认](review-fixes/payment-confirmation.png)、[首次离线进入](review-fixes/first-visit-offline.png)。
- 五街运行截图：[橡木](review-fixes/street-town-animated.png)、[花市](review-fixes/street-flowers-animated.png)、[海风](review-fixes/street-seaside-animated.png)、[杉影](review-fixes/street-forest-animated.png)、[钟楼](review-fixes/street-city-animated.png)。
- [运行动画标签](review-fixes/labels-motion-live.png)、[减少动画标签](review-fixes/labels-reduced-motion.png)。
- [360px 运行](review-fixes/mobile-360-live.png)、[360px 静止](review-fixes/mobile-360-reduced.png)、[390px 运行](review-fixes/mobile-390-live.png)、[390px 静止](review-fixes/mobile-390-reduced.png)、[真实 v25 迁移](review-fixes/v25-migrated.png)。

### 服务、复跑和范围

预览沿用用户提供的 **https://lalazemac-mini.tailcec3d.ts.net:4174**，现有 PID 25261 仍读最新 dist；没有新建测试服务器或重启该服务。此环境 Chromium 对该 HTTPS 地址出现 ERR_CONNECTION_CLOSED/ERR_EMPTY_RESPONSE（直连 curl 返回 200），因此自动化通过**同一现有 4174 服务的安全 loopback 来源**完成 SW、持久存档和全部构建验证，没有用不安全 HTTP 来源冒充 SW 验证。

`street-review-qa.mjs` 支持 `STREET_REVIEW_URL`、`STREET_QA_CDP`；默认连接已有 4174 与显式 CDP 9224。需先用 agent-browser 启动隔离浏览器。脚本生成测试 state bundle 到系统临时目录，finally 清理并关闭自己的 context。本轮 `street-review-fix` 会话已关闭，automation profile 残留为 0；[进程检查](review-fixes/automation-processes-after.txt)、[现有服务保留证据](review-fixes/services-after.txt)。

触控保留直接拖动，未加入惯性，避免在付款防误触修复中叠加释放后位移。未做全仓库回归、真机 Safari/Android 或全素材像素密度重绘；不计为已完成。P1 与本轮必要 QA 已完成。

---

## 首轮实现与验证（历史记录）

本轮在已有未提交的街道方案上继续实现。未 reset、commit 或 push；没有改动经济函数、v26 数据结构与迁移规则，也没有重写此前的主店、房间和离线缓存工作。

## 实际变化

- `src/ui/streets.ts` / `.css`：全视图连续街道，默认不选铺、不显示经营面板。鼠标/触控拖动，左右按钮及键盘方向键、Home/End 浏览；主店建筑入口和固定返回按钮都能返回咖啡馆。五街五铺仍独立，主店所在街另有主店。
- 点建筑/招租牌打开情境面板；360/390px 为可滚动底部抽屉。购买土地后聚焦业态选择，装修后聚焦关闭；关闭恢复铺位焦点。Escape 先关详情，再离开街道；Tab 在打开的情境面板内循环。拖动事件不触发店铺点击，键盘激活不会被拖动残留状态吞掉。
- 地价、装修价和合计提前展示，五种业态均显示装修报价。锁定街、招租、已购空铺、装修围挡/梯子、营业橱窗与待收获提示直接在场景中体现。原有收获、升级、三档生产节奏、永久蓝图入口保留。
- `src/render/street-art.ts` / `public/art/street-scene/`：使用已有 cozy-idle 店铺、cozy-world 远景/树木、cozy-furniture 陈列、cozy-cast 顾客，以及 neighborhood-reserve 长椅、自行车、时钟、花车和种植床。不是 SVG 建筑或 emoji 美术；不同街道保留各自像素建筑，业务通过橱窗陈列区分。
- 人物沿街行走，营业店顾客进出；装饰人口固定上限，CSS 动画不改变生产、顾客服务模拟或存档。图片共约 1.3 MiB，复用浏览器缓存；仅状态/业态改变时重建建筑美术，不在每次倒计时更新时替换按钮。静态 PNG 图集使 reduced-motion 同时停止人物步态与位移动画。
- 中英文补齐导航、报价、关闭等文本。素材提取脚本 `scripts/build-street-scene-art.mjs` 依赖 macOS `sips`；已生成的 PNG 可直接用于普通构建，无新增运行依赖。

## 本轮实际验证

最终测试命令（详细输出在 [regression-tests.log](regression-tests.log)）：

```sh
npx vitest run src/ui/streets.test.ts src/game/streets.test.ts src/game/room-projects.test.ts src/ui/room-projects.test.ts src/game/save-session.test.ts src/game/chain.test.ts src/game/regions.test.ts src/i18n.test.ts src/game/game.test.ts src/game/economy-invariants.test.ts src/game/manager.test.ts src/game/locations.test.ts src/game/chain-bonuses.test.ts src/ui/fullscreen-drawer.test.ts src/ui/fullscreen-layout.test.ts src/ui/room-viewport.test.ts src/ui/room-overview.test.ts src/ui/kitchen-door.test.ts src/render/passages.test.ts --maxWorkers=1 --testTimeout=20000
```

19 文件、250 项通过，0 失败。包含既有街道经济、v26 迁移、SaveSession、离线生产、分店资产及主店相关回归。本轮另有早期 34 项和 71 项运行日志，最终 250 项已经包含相关覆盖，数量不相加。没有运行全仓库测试；没有把旧文档的 3,062 项当作本轮结果。

`npm run build` 通过；其第一步 `tsc --noEmit` 通过，Vite/离线资源构建也通过，见 [build.log](build.log)。开发早期另单独执行过 `npx tsc --noEmit`，通过。

浏览器使用 agent-browser 创建隔离 Chromium，会话 `street-scene-redesign`；脚本通过其显式 CDP 端口连接。最终 `node scripts/street-scene-qa.mjs` 的 **40 项检查通过**，页面错误、控制台 error、失败请求均为 0，见 [browser-validation.json](browser-validation.json) 与 [browser-validation.log](browser-validation.log)。覆盖：

- 桌面 1440×960 默认街景；真实鼠标拖动不打开详情/购买。
- 购买土地 → 单独付装修费 → 现场围挡 → 完成装修/营业陈列 → 收获 → 快速双击不重复到账 → 升级。
- 跨街资产独立、锁定街可预览但不可购买、主店位置/区域不重置、从主店门返回。
- 关闭/Escape/焦点恢复、情境面板 Tab 循环、键盘 Home/End 浏览。
- 360×844、390×844 的 CDP 真实 touchStart/touchMove/touchEnd；拖动不误购、抽屉内购买装修、关闭恢复逛街、页面无溢出，reduced-motion 停止所有步态/位移。
- 五条街均渲染五种业态陈列；英文入口与情境控件。
- 另在同一隔离浏览器上下文的安全本地来源运行真实游戏：真实 Streets 入口 → 购买装修写入 v26 SaveSession → 返回主店 → 刷新 → 在建铺位恢复。真实用户的浏览器 profile/存档未访问。为避免等待真实 30 分钟，营业收获测试仅调整隔离夹具中的时间戳，生产公式保持原实现。

扩展浏览器脚本时曾有一次英语检查失败：动态导入了没有 Vite HMR 时间戳的第二份 i18n 模块，未切换夹具正在使用的语言实例。已改为调用夹具提供的同一实例并完整重跑通过。没有把这次失败算成产品通过，也没有更改产品语言逻辑去迎合夹具。

## 截图

- 旧版对比：[桌面](before-desktop.png)、[360px](before-mobile-360.png)。这两张是工作开始时已有截图的副本，不是本轮重新操作旧版生成。
- 新版：[桌面逛街](desktop-initial.png)、[购铺报价](desktop-purchase.png)、[装修围挡](desktop-renovation.png)、[营业待收获](desktop-open-ready.png)、[锁定海风街](desktop-locked-seaside.png)。
- [五业态陈列](desktop-city-businesses.png)、[英文](desktop-english.png)、[真实游戏存档场景](game-desktop-renovation.png)。
- 手机：[360px 逛街](mobile-360-initial.png)、[360px 购买](mobile-360-purchase.png)、[360px 装修](mobile-360-renovation.png)、[390px 逛街](mobile-390-initial.png)、[390px 购买](mobile-390-purchase.png)、[390px 装修](mobile-390-renovation.png)。

## 预览与复跑

已有预览 PID 25261，端口 4174，绑定 127.0.0.1。未停止、替换或重配该进程。

本轮另启临时 Vite PID 93691（执行会话 71110），绑定 0.0.0.0:5173，验证 URL 为 **http://100.96.195.115:5173**。安全上下文存档验证内部使用同一临时服务的 loopback 来源。验收结束已停止临时 5173 服务与本轮自动化 Chromium，并检查临时 automation profile 残留；该验证 URL 结束后不再在线。

复跑时先自行启动临时 Vite，再运行：

```sh
agent-browser --session street-scene-redesign --args '--remote-debugging-port=9224' open http://100.96.195.115:5173
node scripts/street-scene-qa.mjs
agent-browser --session street-scene-redesign close
```

脚本自动生成并在 finally 删除 `.street-scene-qa.html`，使用全新浏览器 context，不读写真实用户存档。支持 `STREET_QA_URL`、`STREET_QA_CDP`、`STREET_QA_SAVE_URL`、`STREET_QA_PLAYWRIGHT`；默认从已安装 agent-browser 定位其 Playwright。最后关闭自行启动的临时 Vite。

## 限定范围

本轮指定功能已实现并完成上述验证。街边顾客是装饰动画，不引入一套新的行人经济模拟。没有做全仓库回归或真机 Safari/Android 验证；手机检查是实际 Chromium 的触摸输入与窄视口。已有大量未提交代码仍保留，未创建提交。
