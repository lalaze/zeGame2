# B1：把玩法规则搬到 GDScript

用户已决定整体迁移到 Godot（B1 规则 → B2 楼房画面 → B3 界面 → B4 上机与存档导入）。B1 只搬规则，不做画面和界面。
**目标：同样的随机种子、同样的操作，Godot 和现有 TypeScript 逐步算出完全相同的结果。**

TypeScript（`src/game/`）是唯一标准。发现它有可疑行为也照搬，写进交付说明，不要"顺手修"。

## 总约束

- 只在本 worktree 里改。允许改：`godot/`、`scripts/godot-*`、`package.json` 的 scripts、`.gitignore` 里 Godot 段。
- 不改 `src/`、`public/`、`assets/`、`dist/`、`docs/`、已有测试；不加 npm 依赖，不用 Godot 插件；不 commit、不 push；不运行 `npm run build`；不碰 `/Volumes/data/code/zeGame2` 主检出、:4174、:4175；不操作模拟器和真机。
- B0 的 `cafe_sim.gd`、`cafe_state.gd`、`building_view.gd`、`main.gd`、`menu_panel.gd` 等先不动（B2、B3 再替换）。B0 的现有测试必须继续通过。
- 改坏实验放在临时目录的副本里做，不留在 worktree。

## 目录和写法

- 规则放 `godot/core/`，一个 TS 模块对应一个文件：`customer-demand.ts` → `core/customer_demand.gd`，`class_name CoreCustomerDemand`。函数名转 snake_case。内部函数也要一一对应，方便对照。
- 状态、顾客、店员等一律用 `Dictionary` / `Array`，**键名和存档 JSON 完全一致**（驼峰），插入顺序也照 TS。`undefined` 的可选字段 = 没有这个键；`null` = `null`。`delete x.y` = `erase`。
- 只有有状态的类（`Sim`、`MomentDirector`、`LivingCats`、`CustomerCastCycle`、`SaveSession`）写成 GDScript 类。
- `core/` 里不读时间、不读文件（数据加载器除外）、不用 `randf`、不依赖场景树和单例。`now`、随机源（返回 float 的 `Callable`）、翻译函数一律由参数传入，和 TS 的默认参数位置对应。
- 模块级可变状态（如 `layout.ts` 的 `sceneH`、`kitchenStage`）用 `static var` 照搬，并提供重置，测试之间不能互相污染。
- 表格型常量（`MENU`、`UPGRADES`、`RECIPES`、坐标、文案定义等导出常量）从 TS 导出成 JSON，不手抄。公式里的内联字面量可以照写，由向量测试保证。
- B0 的 `scripts/godot-data-export.mjs`、`godot/data/*.json` 可以扩充，但 B0 现有字段不能变。

## 已经实测过的数值陷阱（Godot 4.7.2 对 Node 22 / V8 12.4）

| 项 | 实测 | 要求 |
| --- | --- | --- |
| `JSON.parse_string`、`String.to_float` | 20000 个随机双精度里 6819 个差最后一位 | 自己写与 JS 逐位一致的数字解析（正确舍入）。所有规则数据、存档、对照数据都走它，或用双精度的十六进制位传输 |
| `JSON.stringify`、`str(float)` | `5.0` 输出 `5.0`；全精度模式仍有 1869/20000 与 JS 不同 | 自己写 JS 的 `Number::toString` 和 `JSON.stringify`（最短往返、指数格式、`-0`→`0`、`NaN/Infinity`→`null`、省略 `undefined`） |
| `Math.hypot` | `sqrt(x*x+y*y)` 42% 不一致；`Vector2.length()` 是单精度，100% 不一致 | 用 V8 的算法：`m=max(|a|,|b|)`，为 0 返回 0；对 `n=v/m` 做 Kahan 求和 `u=n*n-c; p=s+u; c=p-s-u; s=p`；返回 `sqrt(s)*m`。100 万组已验证与 V8 一致 |
| `**` / `Math.pow`、`Math.log`、`Math.log10` | 系统 libm 与 V8 有 4%～10% 差最后一位，且安卓、iOS、macOS 的 libm 彼此不同 | 在 GDScript 里移植 V8 用的 fdlibm（`e_pow`、`e_log`、`log10`），可加缓存。至少 20000 组随机 + 全部实际取值逐位一致 |
| `sqrt`、`fmod`、`floor`、`abs` | 一致 | 直接用 |
| `Math.round` | `round()` 对负的 .5 方向不同；`floor(x+0.5)` 在 0.49999999999999994 等处不同 | 照 JS 语义实现 |
| 整数与浮点 | `5/2==2`；`{5:…}.has(5.0)` 为假；`[5].has(5.0)` 为假（B0 因此出过倍速按钮的 bug） | JS 的数字在规则状态里一律存 `float`，只在做下标时转 `int`；不用数字当字典键（JS 对象的数字键就是字符串，且整数样式的键按升序枚举，例如 `guestMemories`） |
| `sort_custom` | 不稳定 | 写稳定排序，比较函数返回数字，语义同 JS `sort` |
| `Math.imul`、`>>>`、`^` | 64 位整数会溢出到高位 | 写 32 位帮助函数 |
| `localeCompare` | 与码点序不同 | 把实际会用到的 id 的顺序从 TS 导出成表，遇到表外的值要报错而不是悄悄退化 |
| `toFixed`、`toExponential` | 没有对应 | 照 JS 精确十进制语义实现 |
| `structuredClone`、展开运算符 | 浅拷贝/深拷贝要分清 | `{...x}` = `duplicate(false)`，`structuredClone` = `duplicate(true)` |
| `Map`/`Set`/对象的遍历顺序 | 插入序；删除后再插入排到最后 | Dictionary 同样是插入序，按此对照 |
| `Array.filter` 产生新数组、遍历中修改数组 | 语义容易走样 | 逐处对照 |

## 对照测试框架（B1a 建好，后面沿用）

- TS 侧用 vitest（worktree 里已有）直接 `import` 真正的 `src/game/*`，生成对照数据到 gitignore 的 `godot/.parity/`；Godot 侧无头脚本读入、执行、比较。对照数据**每次测试现生成**，不入库，所以 TS 一改测试就会失败。
- 比较一律**逐位相等**（双精度按位、字符串全等、键集合相等，数组顺序相等）；`-0` 与 `0` 视为不同，除非该处 TS 输出经 JSON 归一。不设容差。确有无法做到的，列进一个带理由的白名单文件，审核会逐条看。
- 每个用例 = 模块、函数、参数、返回值 + **所有被修改参数的调用后内容**（很多函数会原地改 `state`）。失败时打印第一个不同的路径、期望值、实际值。
- 输入来源要覆盖：真实 TS 跑出来的各阶段状态（新店、早期、中期、厨房各级、满级、多分店、有猫/伙伴/常客/招牌/试饮/订单/街道/装修各种组合）、带种子的随机参数、边界值（0、负数、NaN、空、上限、缺字段、畸形存档）。
- **覆盖门禁**：脚本在运行时枚举每个 TS 模块的全部导出。每个导出函数必须有 Godot 对应函数，并有足够的用例（默认不少于 30 个且至少 3 种不同结果；确实不可能的写白名单和理由）；每个导出常量必须逐值一致。少一个就失败。
- **抗假阳性**：对照框架自身要有测试，证明它能发现：差 1 ulp、少一个键、数组换序、少改一个字段、随机数多抽一次、Godot 脚本报错、提前退出。
- 入口：`npm run godot:parity`（可按模块过滤），并接进 `npm run godot:test`。输出各模块用例数和失败数；任何脚本错误、缺汇总行、用例数为 0 都算失败。整套在这台 Mac 上应控制在 5 分钟内。

## 分四块

每块单独实施、单独审核，通过后再做下一块。

### B1a 数值底座与叶子模块
- `core/js_math.gd`、`core/js_json.gd` 等底座 + 上面的对照框架、覆盖门禁、数据导出。
- 模块：`data building-spots business-clock locations chain-bonuses signature-drinks flavors conditions customer-cast customer-demand regions layout furniture decor navigation traffic taste reputation regular-wishes regular-guests-content trial-sales partners partner-stories pets format`。
- 有些函数的类型是 `GameState`，但只读写其中几个字段，用真实 TS 状态做输入即可；运行时若确实 import 了 B1b 的模块，把那个函数留到 B1b 并在覆盖白名单里写明"B1b"。

### B1b 经济与存档
- 模块：`economy kitchen styles streets room-projects promotion manager chain orders cat-gifts regular-guests guest-memories goals milestones operations recovery settlement-advice first-service day state`。
- `serialize` 的字符串与 TS 全等；`deserialize` 对 v1～v27 的存档（从现有测试里的存档样例 + 各阶段真实存档 + 随机破坏的存档，合计不少于 500 份）结果逐位一致，再 `serialize` 也全等。
- 清空 B1a 留下的"B1b"白名单。

### B1c 营业模拟
- 模块：`sim sim-snapshot moments living-cats`。
- **锁步对照**：同种子、同初始状态、同脚本操作，TS 和 Godot 各自每 0.05 秒一步；每一步比较完整的 `state`、Sim 全部字段（含私有的 `spawnTimer`、`nextId`、`castRandomState`、`boostCooldown` 等）、事件列表、随机数抽取次数。至少：20 个种子 × 早/中/晚 3 种店 × 一整天（含打烊收尾），再加带操作的场景（催单、插队、荐饮、试饮、补货续开、中途升级、摆家具、改厨房等级、改倍速、店员增加）和快照保存→恢复→继续。
- `MomentDirector`、`LivingCats` 同样锁步。
- **性能**：最繁忙的满级店（厨房满级、30 人左右在场）无头运行 `update(0.05)`，这台 Mac 上平均 ≤ 1.0 ms、p99 ≤ 4 ms，测量脚本入库。达不到就优化写法，但结果必须仍逐位一致。

### B1d 会话与长跑
- `save-session storage`（持久化走 `user://`，写入要原子：先写临时文件再改名，并保留上一份）+ `core/game_session.gd`：把 `src/main.ts` 里属于规则的编排搬过来——`frame()` 的固定步长循环与倍速、开店/打烊/日结、售罄与补货续开、`managerTick`/`managerStartDay`/`managerReport`、`leaveCafe`/`settleAway`、`tickCatGifts`、`announceReadyOrder`、`settleLegacyInterior`、里程碑检查、`moments` 与 `livingCats` 的调用时机、自动存档时机。界面动作用信号/回调留给 B2、B3。
- TS 侧的对照驱动逐行照 `src/main.ts` 的调用顺序写，并注明对应行号。
- **30 天验收**：不少于 10 个种子 × 3 种经营策略（保守、扩张、全系统都用到），每天记录营收、客流、库存、口碑、里程碑、全部 `state`，30 天全程逐位一致；中间随机"离开—回来"和"存档—重启—继续"。
- 全部 `src/game` 模块的覆盖白名单只剩真正的浏览器专属项。

## 每块的交付

1. `npm run godot:test`、`npm run godot:parity` 通过；`npx tsc --noEmit` 通过；`npm test` 不比基线差（基线：2779 通过 / 582 跳过；新增的 vitest 文件算新增）。
2. `godot --headless --path godot --import` 无报错；Godot 输出里没有 `SCRIPT ERROR`、`Parse Error`、泄漏之外的错误。
3. 更新 `godot/README.md` 对应段落。
4. 交付说明：做了什么、每模块用例数、白名单逐条理由、发现的 TS 可疑行为、没做到的。不要写没有验证过的结论。
