# B1 交付说明

范围和验收见 `B1-PLAN.md`。本文只记计划之外要知道的事。

## 没有搬的

- `save-session.acquireSaveSession` 的 Web Locks 排队、`watchSavePage`、`SAVE_LOCK`：浏览器多标签页用的。手机上只有一个游戏在跑；`CoreSaveSession.acquire` 只保留“存档读不了就开临时会话，不动原存档”。
- `main.ts` 的后台标签页标题（`updateAwayTitle`、`restoreTitle`）。
- 首日引导 `FirstServiceGuide`、售罄弹窗能不能续开的判断、结算建议的展示、准备与结算弹窗本身：属于界面，留给 B3。弹窗里买了东西之后要做的事已经有：`stock_changed`、`trial_result_changed`、`next_day`。它们影响流程的两个量（`guide_opening_step`、`guide_simplify`）由界面写进 `CoreGameSession`。

## 和计划不同的地方

- TS 侧没有用 vitest 生成向量：框架用 vite 把真正的 `src/game` 打成一个 Node 模块再跑，这样能拿到 V8 的分支覆盖，用来检查“TS 的每个分支都有用例走到”。
- B1d 的 TS 驱动没有手写：`main-source.mjs` 按语法树把 `main.ts` 的函数原样取出来跑，所以不需要行号对照。
- `FileStore`（落盘）放在 `godot/scripts/`，因为 `core/` 不读写文件。

## 对照时看到的 TS 行为（照搬，没有改）

- 厨房等级只能升不能降：营业中把 `upgrades.cook` 调低，`Sim.sync` 会因为厨师站的地方不通而抛异常。游戏里没有降级的途径。
- `validSnapshot` 用 `String(x.phase)` 判断阶段，所以阶段写成 `["queue"]` 这样的数组也会通过。只影响手改的存档。
- 存档里没有试饮活动（`trialSales.active` 为空）而 `trialSaleItem` 又要读它的分支走不到。

## 已知的性能数字（这台 Mac，无头）

- 最忙的店（76 人）一步 0.05 秒：平均 0.32 ms，p99 1.13 ms；猫和小事件另加 0.2 ms。
- 把最忙的店序列化成存档：平均 5.6 ms。手机上估计 20 ms 左右，每 5 秒一次，B4 要处理（放到线程里）。
