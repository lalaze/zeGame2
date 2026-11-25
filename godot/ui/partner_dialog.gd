class_name PartnerDialog
extends RefCounted

## The café's partners (src/ui/partners.ts): who can join, who is on duty, what they specialise in, and their stories.

var _ui: CafeUi
var _session: CoreGameSession
var _root := Paper.col([], 10)
var _scroll: ScrollContainer = null


static func show_partners(ui: CafeUi, selected: String = "") -> void:
	var d := PartnerDialog.new()
	d._ui = ui
	d._session = ui.session
	d._root.set_meta("owner", d)
	CorePartners.sync_partners(ui.session.state)
	if selected.is_empty():
		d._list()
	else:
		d._profile(selected)
	d._scroll = ui.dialogs.show_dialog(_here("咖啡馆伙伴", "Café partners"), d._root, [{"label": _here("关闭", "Close")}], {"tall": true})["scroll"]


static func _here(zh: String, en: String) -> String:
	return UiWords.here(zh, en)


static func _num(n: float) -> String:
	return JsMath.number_to_string(n)


static func _count(n: float, zh: String, one: String, many: String) -> String:
	return "%s %s" % [_num(n), zh if I18n.locale == "zh" else (one if n == 1.0 else many)]


static func _role(id: String) -> String:
	return {"barista": _here("咖啡师", "Barista"), "server": _here("服务员", "Server"), "cook": _here("厨师", "Cook")}[id]


static func _specialty(role: String, choice: String) -> String:
	var first := choice == "a"
	match role:
		"barista": return _here("饮品专注：饮品制作时间 −20%，烘焙点单制作时间 +10%。适合饮品占多数的菜单。", "Drink focus: drink preparation −20%, bakery-order preparation +10%. Best for drink-heavy menus.") if first else _here("点心搭档：烘焙点单制作时间 −20%，饮品制作时间 +10%。适合点心占多数的菜单。", "Bakery focus: bakery-order preparation −20%, drink preparation +10%. Best for bakery-heavy menus.")
		"server": return _here("轻装快送：移动速度 +20%，每趟只能携带 1 单。适合短距离、少量订单。", "Light courier: movement +20%, but only 1 order per trip. Suits short routes and small queues.") if first else _here("批量配送：携带至少 2 单时速度 +10%，其他时候速度 −10%。适合集中配送。", "Batch delivery: movement +10% with at least 2 orders, −10% otherwise. Suits grouped deliveries.")
	return _here("专心制作：工位操作时间 −20%，移动速度 −10%。适合工位耗时较长的配方。", "Station focus: station time −20%, movement −10%. Suits recipes with long station work.") if first else _here("灵活走位：移动速度 +25%，工位操作时间 +10%。适合走动较多的配方。", "Kitchen runner: movement +25%, station time +10%. Suits recipes with more walking.")


func _page(children: Array) -> void:
	Paper.clear(_root)
	for c: Control in children:
		_root.add_child(c)
	if _scroll != null:
		_scroll.scroll_vertical = 0


static func _button(text: String, pressed: Callable, disabled: bool = false) -> Button:
	var b := Paper.button(text, "ghost", pressed)
	b.disabled = disabled
	return b


static func _identity(p: Dictionary) -> Control:
	return Paper.line([Portraits.person(p["look"], 48.0), Paper.col([Paper.words(p["name"][I18n.locale], "h3"), Paper.words(_role(p["role"]), "muted")], 2)], 10)


func _list() -> void:
	var s := _session.state
	var each := CorePartners.PARTNERS.filter(func(p: Dictionary) -> bool: return p["role"] == "barista").size()
	var out: Array = [Paper.words(_here("一起把日子过好", "Good days, together"), "h3"),
		Paper.words(_here("%d 位候选伙伴，每种职业 %d 位。在「升级」里购买的岗位会自动免费补足人手；招募伙伴可以决定由谁上岗。店主始终一起工作，不占岗位。", "%d candidates, %d per role. Every staff slot you buy in Upgrades is filled automatically at no extra cost; recruiting a partner lets you choose who fills it. The owner always works too and never takes a slot.") % [CorePartners.PARTNERS.size(), each], "muted"),
		Paper.words(_here("关店后可以招募、换班和培养。故事随实际工作与不同营业日解锁，随时可稍后再看。", "Recruit, assign and train while closed. Stories unlock through real work across business days; read whenever you like."), "muted")]
	for role: String in CorePartners.PARTNER_ROLES:
		var slots := CorePartners.partner_slots(s, role)
		var active: Array = s["partners"]["active"][role]
		out.append(Paper.words("%s · %s%d/%s" % [_role(role), _here("上岗 ", "Active "), active.size(), _num(slots)], "h3"))
		if slots == 0.0:
			out.append(Paper.words({"barista": _here("还没有咖啡师岗位：在「升级」里雇用咖啡师即可增加。店主会照常在吧台工作。", "No barista slots yet: Hire Barista in Upgrades adds one. The owner keeps brewing at the counter."), "server": _here("还没有服务员岗位：在「升级」里雇用服务员即可增加。", "No server slots yet: Hire Server in Upgrades adds one."), "cook": _here("还没有厨师岗位：建好后厨后会自带一位厨师。", "No cook slots yet: building the kitchen comes with one cook.")}[role], "muted"))
		for p: Dictionary in CorePartners.PARTNERS:
			if p["role"] != role:
				continue
			var progress: Variant = s["partners"]["roster"].get(p["id"])
			var note := _here("尚未加入", "Not recruited")
			if progress != null:
				note = "%s · %s XP · %s" % [_here("在岗", "On duty") if p["id"] in active else _here("候补", "Reserve"), _num(progress["xp"]), _count(progress["workedDays"], "个营业日", "business day", "business days")]
			var card := Paper.card("row")
			card.add_child(Paper.col([_identity(p), Paper.words(note, "muted"), _button(_here("查看伙伴", "View partner"), _profile.bind(p["id"]))], 6))
			out.append(card)
	_page(out)


func _work(p: Dictionary) -> String:
	var s := _session.state
	var role: String = p["role"]
	if p["id"] not in s["partners"]["active"][role]:
		return _here("候补休息中", "Resting in reserve")
	if s["phase"] == "prep":
		return _here("关店准备中", "Preparing while closed")
	var mine := func(list: Array) -> Variant:
		for a: Variant in list:
			if a["partnerId"] is String and a["partnerId"] == p["id"]:
				return a
		return null
	if role == "server":
		var server: Variant = mine.call(_session.sim.servers)
		return _here("等待开工", "Ready for work") if server == null else (_here("正在配送", "Delivering orders") if not server["plates"].is_empty() else _here("等待取餐或返回中", "Collecting orders or returning"))
	if role == "barista":
		var barista: Variant = mine.call(_session.sim.baristas)
		return _here("等待下一单", "Waiting for the next order") if barista == null or barista["customerId"] == null else (_here("正在制作", "Preparing an order") if barista["remaining"] > 0.0 else _here("等待出餐", "Waiting to hand off"))
	var cook: Variant = mine.call(_session.sim.cooks)
	return _here("正在烘焙批次", "Working on a baking batch") if cook != null and cook["batch"] != null else _here("等待补货需求", "Waiting for restocking work")


func _commit(ok: bool, id: String) -> void:
	if ok:
		_session.sim.update(_session.state, 0.0)
		_session.save_game()
	_profile(id)


func _profile(id: String) -> void:
	var s := _session.state
	var p: Dictionary = CorePartners.partner_definition(id)
	var closed: bool = s["phase"] == "prep"
	var progress: Variant = s["partners"]["roster"].get(id)
	var card := Paper.col([_identity(p), Paper.words(CorePartnerStories.PARTNER_STORIES[id]["intro"][I18n.locale])], 8)
	if progress == null:
		var no_kitchen: bool = p["role"] == "cook" and not s["kitchen"]
		var cost: float = CorePartners.PARTNER_RECRUIT_COST
		card.add_child(Paper.words(_here("招募不增加岗位。购买岗位仍会自动补足人手；厨房伙伴需先建厨房。", "Recruiting does not add a slot. Purchased slots still supply staff automatically; cooks need an installed kitchen."), "muted"))
		card.add_child(_button("%s$%s" % [_here("招募候补 · ", "Recruit reserve · "), _num(cost)], func() -> void: _commit(CorePartners.recruit_partner(s, id), id), not closed or s["coins"] < cost or no_kitchen))
		# A disabled button always says what it is waiting for.
		var waiting := ""
		if not closed:
			waiting = _here("营业中不能招募，打烊后再来。", "Recruiting opens after closing.")
		elif no_kitchen:
			waiting = _here("先建好后厨，才能招募厨师。", "Build the kitchen first to recruit a cook.")
		elif s["coins"] < cost:
			waiting = "%s%s%s" % [_here("还差 ", "Need "), UiWords.money(cost - s["coins"]), _here("。", " more.")]
		if not waiting.is_empty():
			card.add_child(Paper.words(waiting, "bad"))
	else:
		_add_progress(card, s, p, progress, closed)
	_page([_button(_here("返回团队", "Back to team"), _list), card])


func _add_progress(card: VBoxContainer, s: Dictionary, p: Dictionary, progress: Dictionary, closed: bool) -> void:
	var id: String = p["id"]
	var active: Array = s["partners"]["active"][p["role"]]
	card.add_child(Paper.words(_work(p)))
	card.add_child(Paper.words("%s XP · %s · %s%s/3" % [_num(progress["xp"]), _count(progress["workedDays"], "个营业日", "business day", "business days"), _here("故事 ", "Stories "), _num(progress["unlocked"])], "muted"))
	var slots := Paper.flow([])
	for slot in int(CorePartners.partner_slots(s, p["role"])):
		var here: bool = slot < active.size() and active[slot] is String and active[slot] == id
		slots.add_child(_button("%s%d%s" % [_here("安排岗位 ", "Assign slot "), slot + 1, " ✓" if here else ""], func() -> void: _commit(CorePartners.assign_partner(s, id, float(slot)), id), not closed or here))
	card.add_child(slots)
	card.add_child(Paper.words(_here("职业专长", "Specialty"), "strong"))
	card.add_child(Paper.words(_here("20 XP 后可选一项，每次学习或切换 $80；只在关店时生效，不叠加。", "Choose one at 20 XP. Learning or switching costs $80, only while closed. Specialties never stack."), "muted"))
	for choice: String in ["a", "b"]:
		var chosen: bool = progress["specialty"] is String and progress["specialty"] == choice
		card.add_child(Paper.words(_specialty(p["role"], choice)))
		card.add_child(_button(_here("已学习", "Selected") if chosen else _here("学习 · $80", "Train · $80"), func() -> void: _commit(CorePartners.train_partner(s, id, choice), id), not closed or progress["xp"] < CorePartners.PARTNER_TRAIN_XP or s["coins"] < CorePartners.PARTNER_TRAIN_COST or chosen))
	card.add_child(Paper.words(_here("伙伴故事", "Partner stories"), "strong"))
	for index in CorePartners.PARTNER_NODES.size():
		var n: Dictionary = CorePartners.PARTNER_NODES[index]
		var unlocked: bool = index < int(progress["unlocked"])
		var label := "%s%d" % [_here("第 ", "Chapter "), index + 1]
		if unlocked:
			label += _here(" · 回看", " · Replay") if float(index) in progress["read"] else _here(" · 新故事", " · New")
		else:
			label += " · %s / %s" % [_count(n["jobs"], "次工作", "job", "jobs"), _count(n["days"], "个营业日", "business day", "business days")]
		card.add_child(_button(label, _story.bind(id, index), not unlocked))
	card.add_child(Paper.words(_here("每次实际制作、成功交付或完成烘焙批次获得 1 XP。离线、阅读、暂停与未完成工作不计经验。", "Each real brew, successful delivery or completed baking batch earns 1 XP. Offline time, reading, pauses and unfinished work earn none."), "muted"))


func _story(id: String, index: int) -> void:
	var s := _session.state
	var progress: Variant = s["partners"]["roster"].get(id)
	if progress == null or index >= int(progress["unlocked"]):
		return
	var card := Paper.card("row")
	card.add_child(Paper.col([Paper.words("%s · %s%d" % [CorePartners.partner_definition(id)["name"][I18n.locale], _here("第 ", "Chapter "), index + 1], "h3"), Paper.words(CorePartnerStories.PARTNER_STORIES[id]["chapters"][index][I18n.locale])]))
	_page([card, _button(_here("读完了", "Finished reading"), func() -> void:
		if CorePartners.read_partner_chapter(s, id, float(index)):
			_session.save_game()
		_profile(id)), _button(_here("稍后再看", "Read later"), _profile.bind(id)), _button(_here("返回团队", "Back to team"), _list)])
