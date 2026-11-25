# B3：界面

把 `src/ui/*.ts` 和 `src/main.ts` 的页面代码（手机布局）搬到 `godot/ui/`，接到 B1 的规则和 B2 的楼房上。TypeScript 仍是唯一标准：**改界面先改 `src/ui/`，再改 `godot/ui/`，然后跑 `npm run godot:ui`。**

## 对应表

| 网页 | Godot |
| --- | --- |
| `main.ts` 里围着界面的部分（弹窗开关、账本、摆放、看桌位、找猫、补货绕路、分店、重置、提示） | `ui/cafe_ui.gd`、`app/cafe_app.gd` |
| `floors-ui.css` 的纸张风格、`floors-ui.ts` 的线条图标 | `ui/paper.gd`、`paper_stitched.gd`、`paper_seam.gd`、`paper_tool.gd` |
| `modal.ts`（弹窗、飘过的提示） | `ui/paper_dialog.gd` |
| `mobile-cafe-hud.ts`、`regions.ts` 的厨房卡、`play-flow.ts` 的帮忙按钮、外墙按钮 | `ui/hud.gd` |
| `panel.ts`（账本六页） | `ui/ledger.gd`、`ledger_rows.gd`、`ledger_cards.gd`、`ledger_decor.gd`、`restocking.gd` |
| `pets.ts`、`living-cats.ts`、`promotion.ts` | `ui/pet_panel.gd`、`living_cat_card.gd`、`promotion_panel.gd` |
| `prepare.ts`、`customer-demand.ts`、`conditions.ts`、`traffic-status.ts` | `ui/prepare_dialog.gd`、`demand_words.gd`、`ui_words.gd` |
| `settlement.ts`、`main.ts` 的 `showReport` | `ui/settlement_dialog.gd` |
| `first-service.ts`、`first-opening.ts`、`onboarding.ts` | `ui/first_service.gd`、`first_opening.gd`、`onboarding.gd`、`theme_preview.gd` |
| `partners.ts`、`regular-guests.ts`、`regular-wishes.ts`、`guest-memories.ts`、`cafe-life.ts` | `ui/partner_dialog.gd`、`regulars_dialog.gd`、`wish_card.gd`、`memory_notes.gd`、`cafe_life.gd` |
| `cafe-styles.ts`、`milestones.ts`、`taste.ts`、`trial-sales.ts`、`signature-drinks.ts` | `ui/style_dialog.gd`、`milestone_book.gd`、`taste_dialog.gd`、`trial_cards.gd`、`signature_lab.gd` |
| `chain-ui.ts`、`branch-map.ts` | `ui/chain_dialogs.gd` |
| `streets.ts`、`room-projects.ts` | `ui/street_map.gd`、`projects_dialog.gd` |
| `money-details.ts`、`reputation.ts`、`sold-out.ts`、`moments.ts`、`service-help.ts` | `ui/small_dialogs.gd` |
| `portrait-art.ts`、`icon-art.ts`、`floors-portraits.ts`、`floors-icons.ts` | `ui/portraits.gd` |
| `main.ts` 的 `openSettings` | `ui/settings_dialog.gd` |

不搬：桌面布局（边缘工具栏、侧栏、快捷键、焦点管理）、像素房间（`?pixel`）、多标签页和浏览器存储的提示、加载页（Godot 有自己的启动画面）。

## 验收

1. `npm run godot:ui`：同一家店、同一块界面，网页自己的 `src/ui` 代码（无浏览器，happy-dom）和 Godot 一起随机走（按按钮、打勾、选列表、填名字、展开折叠），**每按一下**比较界面上的全部文字、每个按钮能不能按、飘过的提示，走完比较存档，一个字都不能差。店来自 24 个种子的经营，再加一批随机改过的（有钱或破产、街道、连锁、外送、里程碑、许愿、回忆、满菜单……）。风格目标的每一条提示另外逐条比。哪块界面一次都没按过就失败。走查在最小的手机（360×640）上进行，每一步还检查没有文字、按钮和纸面伸出屏幕两侧。
2. `tests/run_app_tests.gd`：按手机入口从起名换装玩到第二天，走 `main.ts` 围着界面的那些流程：首日引导、设置和语言、编辑店主、补货绕路、营业状态、帮忙、熟客的故事、打烊确认、结算、摆放家具、看桌位、厨房、街道和返回键、分店、存档失败的提示、重置；真实触摸：在按钮上拖动是滚动、点一下才是按、按久了也算数；软键盘弹出时输入框和下一步都在键盘之上；反复开关各界面不留下节点；菜单分帧更新最后每行都是新的。
3. `npm run godot:bench`：满级的店，每页打开多久、每 0.25 秒刷新多久（上限 6 ms）。
4. 出图和网页版并排看（`tests/ui_shot.gd`）。
5. B0 样片删除；`npm run godot:test`、`npx tsc --noEmit`、`npm test` 全过。

## 和网页版有意不同的地方

- 账本打开时咖啡馆是暂停的，所以菜单、食材、装扮页不每 0.25 秒重算，只在余额、时段变了或玩家按了什么时更新；菜单只算看得见的行，其余每帧做一点（网页版每 0.25 秒全算一遍，就是当初嫌卡的那种停顿）。
- 设置里没有键盘快捷键那一行；“无法保存”的提示说的是手机空间，不是浏览器。
- 手机返回键：先关弹窗，再关街道的铺位、街道、摆放、“返回……”、账本、更多菜单，最后退出（退出前存档）。
- 飘过的提示固定在顶栏下面。
- 一个单位等于手机的一个点（宽 360–480）：矮屏和网页一样靠滚动，不把整个界面缩小；平板放大到 480 宽。安卓的密度取 `screen_get_dpi() / 160`：引擎在安卓上的 `screen_get_scale()` 是取整后又按 800×600 裁过的值，不是密度。
- 软键盘会盖住画面（安卓、iOS 都不自动让位），所以弹窗和开店流程缩到键盘之上，输入框滚到看得见的地方。按别的按钮之前，先收下正在输入的字（网页的输入框失焦也是这样）。
- 街道打开经营研究时，弹窗盖在街道上，关掉就回到街道（网页版是换掉再重开，结果一样）。
- 分店版图在没有任何加盟店时不列地点：网页版如此（`placesSig` 初值），照搬。
