# 已确认街景素材接入验收 · 2026-11-09

用户批准的八款店面已经进入实际游戏交互街景。入口仍为咖啡馆「街道」按钮；点击招租牌/店面后打开情境面板，分别确认购地、装修。五街 × 五铺、经济、真实时间生产、v26 存档和启动修复均保留。没有重新生成图片，没有提交或推送 Git，没有访问真实玩家存档。

## 来源与加工

- [确认参考原图](source/approved-street-scenery-v4.png)，SHA256 `c9725546a8b2c10d08b1d7248ed7cae02d87d22da8ca84309e1cc9c871932447`。
- 传入 ZIP 的 SHA256 为 `70dc9fdd663d39f5c80727029a2a098b8b054aab130d254432cb02f4a4c86ff6`；八张独立透明 PNG、clean atlas、preview 和原说明完整保存于 [source/storefronts](source/storefronts/)。两份输入哈希实际核验一致。
- [加工脚本](process-assets.py)：`uv run --with pillow python docs/street-art-v2/process-assets.py`。按透明包围盒裁边，以统一 3:1 最近邻采样得到逻辑像素；桌面 3 倍、手机/较低视口 2 倍整数渲染。玻璃花草店保持较矮外形，各店门高接近，不拉伸成统一建筑高度。固定铺位宽度使装修换业态不会挤动邻居。
- [加工来源/输出哈希](provenance.json)、[招牌/门口锚点](../../public/art/street-art-v2/anchors.json)。输出 16 张 PNG，共 **282,038 字节**。运行时 JSON 作为构建模块导入，不新增启动网络依赖。
- 从参考图裁取云、远镇、干净砖面、路沿、长椅和路灯；丘陵沿原轮廓补齐被前景遮挡部分，颜色取样自参考图；砖面只补齐横向错缝与硬边。云/灯提取后去除背景碎点。地面、远景、建筑、行人是独立图层，没有整张效果图铺底，也没有烘焙前景房屋或人物。
- 主店→cafe；书店→bookshop；花草店→plant-shop；花店→florist；陶艺→pottery；茶铺→tea-shop。空铺通过街道索引与门牌奇偶稳定选择 brick / blue；购买前后外形保持。停用旧小屋、巨型商品、百叶叠图。真实 UI 招牌文字按各自招牌框定位；租牌无深描边。顾客按门锚点进出；减少动画时隐藏进店装饰顾客，保留街上静止行人。

## 本轮实际验证

```sh
npx vitest run src/render/street-art.test.ts src/ui/streets.test.ts src/game/streets.test.ts scripts/precache.test.mjs src/render/sign-font-loading.test.ts src/game/style-background-pause.test.ts src/ui/startup-ready.test.ts
npx tsc --noEmit
node scripts/subset-font.mjs
npx vite build --outDir /tmp/zeGame2-street-art-v2-stage-wpRS9y
node docs/street-art-v2/publish-staged.mjs
node docs/street-art-v2/verify.mjs
```

- **7 文件、84 测试通过，0 失败**：[tests.log](tests.log)。包括店面映射、PNG 比例/锚点、空铺变体、装修围挡、原有防误购/重复收获/键盘、经济与迁移、字体回退、隐藏主场景暂停、SW 安装与新资源离线合同。首轮新增测试有 2 项因 happy-dom 重写 `import.meta.url` 导致读文件失败，改用明确项目路径后通过；不是应用回归。没有把历史 70/111 项或用户独立测试当成本轮结果，也没有声称重跑历史 v25 浏览器流程。
- TypeScript exit 0：[typecheck.log](typecheck.log)。最终构建 exit 0，**229 modules，999ms**：[build.log](build.log)。外部 outDir 不清空的 Vite 提示是预期行为：最终构建使用全新 mktemp 目录，不在 serving dist 执行构建。
- **54 项浏览器/交付检查通过**，无 application page error、console error 或失败 HTTP 资源响应：[browser.log](browser.log)、[结构化记录](browser-validation.json)。桌面 1440×960；手机为 Chromium 触控模拟 **360×800 / 390×844**，不是物理手机。
- 实际鼠标原坐标 `(1265,600)` 双击、新店门双击、鼠标拖动、CDP touchStart/move/end 拖街均不扣钱；购地与装修分别打开报价、分别最终确认；店面箭头导航、关闭/Escape、回主店、跨街资产独立、单次收获防重复都通过。
- 五种业态及出售/已购空铺/装修/营业状态实际呈现。普通动画等待 450ms 后检查行人坐标确有变化，标签绘制顺序可读；减少动画保留静态行人、隐藏进店顾客。截图均 `animations: 'allow'`，没有用禁用动画掩盖动态问题。中文和英文手机界面均检查无页面溢出。
- 字体请求被故意挂起，仍达到真实 `cafe:ready`（最终记录约 **2,884ms**，字体仍 loading）；保留 2s 字体降级、90s 真启动期限和首帧后 SW 注册。
- 新隔离上下文**从未进入街道**，主店启动成功后才注册 SW，等待完整安装，检查全部 **16 张新 PNG 已缓存**，断网重载实际游戏再进入街道，所有图片、铺装、路沿及远景正常显示：[离线截图](offline-first-street.png)。没有删除 localStorage、IndexedDB 或真实应用缓存。

## 最终发布与预览

继续使用原 PID **25261** 的 4174 preview，未替换/重启，也未新建测试服务器。预览：[现有 HTTPS 地址](https://lalazemac-mini.tailcec3d.ts.net:4174/)。该端口通过 HTTPS 转发；直接 `http://100.96.195.115:4174` 实测返回 400 `Client sent an HTTP request to an HTTPS server`，所以不能把它作为可打开的 HTTP 预览地址。

- [安全发布脚本](publish-staged.mjs)验证 repo、stage、dist 的绝对路径和无 symlink 穿越。先逐个原子放入资产，再原子换入口 HTML，最后 SW；没有清空 dist、没有 prune 历史 hash。
- 最终独立阶段构建 **1,340 文件**全部与 dist 逐字节相同；最后一次发布时 **20 个已存在 hashed 文件**均保留且内容不变，包括初始发布的旧版本。dist 含额外保留资源是刻意设计，不把这些旧文件重新写入新版本预缓存清单。
- 最终入口 `assets/game-COVN2Bm9.js`，CSS `assets/game-DlY-SX4c.css`；SW 版本 **`584b7889ebac72a92c37`**。完整标识、SHA、发布时刻见 [build.json](build.json)。最终 source PNG 再运行加工脚本后与阶段构建仍字节一致。
- HTTP 及 HTTPS 分别下载入口、SW、三个入口 JS、CSS、咖啡馆和铺装 PNG，**16 个响应**的 SHA256 同时匹配最终阶段目录与 dist。浏览器 HTTPS 导航仍报 `net::ERR_CONNECTION_CLOSED`，如实保留；curl HTTPS 内容核验成功。浏览器场景与 SW 验收使用同一原服务的安全本地来源，不能当成该 HTTPS 在真机浏览器上的实测。
- SW 仍在旧控制页面存活时等待更新；本轮保留该策略，未强制激活、抢占或清缓存。已经打开的旧页面应先正常关闭再重新进入，避免依赖强制更新。

## 最终截图

- [参考与实际视觉对照](reference-comparison.png)
- [默认可购街景](desktop-default.png) · [混合业态](desktop-mixed-businesses.png) · [东侧花店/陶艺/茶铺](desktop-mixed-east.png)
- [出售/空铺/装修/营业混合状态](desktop-mixed-states.png) · [已购空铺面板](desktop-owned-vacant.png) · [现场装修](desktop-renovation.png)
- [运行动画](desktop-running-animation.png) · [减少动画](desktop-reduced-motion.png)
- [360 手机](mobile-360-default.png) · [390 手机](mobile-390-default.png) · [手机底部抽屉](mobile-390-drawer.png) · [手机减少动画](mobile-390-reduced-motion.png) · [英文手机](mobile-390-english.png)
- [花市](street-flowers.png) · [海风](street-seaside.png) · [杉影](street-forest.png) · [钟楼](street-city.png)

`first-*` 是制作中间截图，不是最终验收图。最终运行时代码构建后未再改变。自动化会话已关闭，[残留进程检查](automation-processes-after.txt)为空，[原服务仍在](services-after.txt)。没有临时服务器需要停止。余项仅为物理手机及本环境不可用的 Chromium HTTPS 导航验证；不存在已知未完成的接入或付款/存档问题。
