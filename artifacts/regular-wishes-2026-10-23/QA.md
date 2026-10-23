# 熟客心愿验证

日期：2026-10-23。基线 HEAD：`fa11363`。仅测试独立浏览器和人工准备的 QA 存档，未读写用户游戏存档。

## 实际流程

两条分支分别从第 2 天准备阶段开始：曾成功见过米娜一次，给予测试资金和库存，拿铁已解锁但未上架。这个初始条件是 fixture；后续选择、上架、营业、结算和查看纪念均通过真实 UI。

- 安静分支：界面选择留桌；主店左侧 1 号桌出现 M 留座牌；实际营业后 `rehearsedDay=2`。继续营业，米娜再次实际收到订单后 `completedDay=3`，地图出现在吧台前。刷新保留，手机熟客界面收起地图后保存为 `displayed=false`。
- 奶香分支：界面选择奶香饮品，未上架时显示缺少供应提示；勾选拿铁后开店。第 2 天真实营业消耗 15 单位牛奶，试讲完成；下一天回访获得奶香分支寄语及红色路线图。
- 英文手机纪念界面有正确分支正文和地图，无整页或对话框横向溢出。`browser-result.json` 保存数据和几何核对。
- 用安静分支实际赚取的存档重新载入，检查最终备店完成态。只有简短提示，没有重复显示大图和完整故事；卡片高 110.875px。见 `13-completed-prepare-compact.png`。
- `browser-errors.txt` 为空。临时 Chrome 均关闭；最终按用户指定的进程检查没有残留。

浏览器在隔离测试配置内将测试地址视作安全来源，以验证 Web Locks 和保存。此设置没有改变游戏或用户浏览器配置。390×844 是桌面 Chrome 视口模拟，不是真机测试。

## 自动验证

- `build-final.log`：最终生产构建成功。
- `focused-final.json`：相关 96 项测试通过；之后缩短备店卡的调整又由最终全量运行覆盖。
- `tests-final.json`：2,947 项，2,893 通过，52 跳过，2 失败。
- `baseline-balance.json`：干净 HEAD 的同一菜单平衡断言失败，数值同为 `251 > 294`，未放宽断言。
- `economy-lab-recheck.json`：全量中的一个 5 秒超时单独原设置重跑，4 通过、1 跳过。没有把这次结果描述成整个全量测试通过。

## 截图与记录

- `02-quiet-reservation.png`：实物留座牌。
- `03-quiet-rehearsal.png`：安静分支实际练习结算。
- `04-map-settlement.png`、`05-map-in-cafe.png`：后续来访获得地图与吧台展示。
- `06-mobile-memory.png`：中文手机纪念物与寄语。
- `08-mobile-missing-milk.png`、`09-mobile-milk-ready.png`：奶香方案供应提示及上架操作。
- `10-milk-rehearsal.png`、`milk-map-settlement.txt`：奶香分支进度与后续礼物。
- `12-milk-map-mobile.png`：英文手机奶香分支纪念。
- `13-completed-prepare-compact.png`：最终紧凑备店卡。
- `quiet-earned-save.json`：由测试条件开始、通过实际营业获得纪念物的存档，供复现。

早期 `01-prepare-choices.png`、`07-mobile-prepare-collapsed.png` 为迭代过程截图；最终准备界面采用更短的文案。自动化期间有一次热更新令操作目标消失、一次快照更新后旧元素引用失效；重新读取界面后继续，未归为产品故障。
