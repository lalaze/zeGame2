# 推荐记忆验证

日期：2026-10-23。基线：`c785828`。本轮从干净工作区开始，以下验证在提交前完成。

## 自动检查

- `targeted-tests.log`：8 个测试文件、114 项通过，包含推荐、记忆、试卖、保存、熟客记录、想法和双语文本。
- `build.log`：生产构建和 TypeScript 检查通过。
- `full-tests.json`：2,992 项，2,939 通过、52 跳过、1 失败。
- 唯一失败仍是 `scripts/balance.test.ts` 的菜单平衡断言 `251 > 294`。此前干净 HEAD 的相同失败证据已提交于 `artifacts/regular-wishes-2026-10-23/baseline-balance.json`，本轮没有放宽或跳过断言。
- `git diff --check` 通过。

新增测试验证真实推荐交付、制作前后不提前记忆、运行快照恢复、真实后续来访与无重复小费、缺货／取消／普通销售／不合适口味不记忆、组合饮品位置、具名熟客隔离、试卖到正式上架、自创配方改名删除、旧存档与异常记录、1× 和 4× 的推荐机会。中英文 DOM 测试检查选项、跳过、过期按钮、安全文本、便笺和结算只读行为。

## 浏览器流程与边界

使用独立 Chrome 临时配置，预览地址 `http://100.96.195.115:4187`。仅该配置将此预览视为安全来源，用于验证 Web Locks 和保存；没有读写用户浏览器存档。

`browser-fixture.js` 记录人工初始条件：第 11 天、给定库存与资金，通过实际 Sim 建立队列，再将队尾设为喜欢奶味的普通形象 11、前方设为具名熟客，并延后新抵达，让推荐对象和提示时机可复现。该 fixture 不写入任何推荐、记忆或复点结果；它不是新存档成长／自然回访频率的测试。

之后所有进度走现有游戏循环：

1. 用正常 Enter 快捷键打开出现的推荐。两款菜单即可显示“保留原单：浓缩”与“试试另一款：拿铁”，包含风味、价格和制作时间。初次手动按键早于提示，未产生结果；从相同 fixture 重试，以定时键盘事件等待界面出现。
2. 手机界面点击拿铁。即时保存中 `recommendation=latte`、`hasCup=false`，记忆仍为空，见 `pending-recommendation.json`。
3. 刷新，使用正常 4× 控件继续服务。实际交付后形成 `source=recommend`、`learnedDay=11`、`returns=0`。当天后续正常来访又成功点回两次，见 `earned-memory.json`。
4. 在营业结算点击准备明天、开始营业。第 12 天实际队列捕获同一形象 11 的 `rememberedOrder=latte`、`order=latte`，没有 `momentTip`，交付前仍只有两次历史复点；见 `actual-return.json`。
5. 第 12 天自然收店，记忆初次发现日仍为 11、最近送达日为 12、实际复点次数变为 3。结算显示一位回头客重新喝到熟悉味道。
6. 通过设置切换英文，在熟客记录展开口味便笺，确认头像、饮品、发现日、复点次数和供应提示。数据与布局见 `browser-result.json`。

桌面 1280×900、手机 390×844（桌面 Chrome 视口模拟，非真机）。推荐及便笺均无横向溢出。截图逐张目视检查：

- `01-desktop-recommendation.png`：中文桌面推荐。
- `02-mobile-recommendation.png`：中文手机推荐。
- `03-mobile-earned-memory.png`：实际交付后获得的便笺。
- `04-return-settlement.png`：次日回访结算。
- `05-mobile-en-journal.png`：英文手机永久便笺。

`browser-errors.txt` 为空。已关闭临时浏览器，并按用户指定命令检查进程，没有 `agent-browser-chrome-*` 或 `agent-browser-darwin-arm64` 残留。预览服务保留供体验。
