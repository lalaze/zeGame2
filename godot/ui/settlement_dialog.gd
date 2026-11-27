class_name SettlementDialog
extends RefCounted

## The day's closing receipt (src/ui/settlement.ts and main.ts showReport): hanging wood plank header, white sawtooth
## receipt with red rubber stamp, profit, dotted ledger rows, top 3 sellers, partner cards, direct goal/chapter claim,
## pinned tomorrow sticky note, expandable business details, and fixed bottom golden button.

const _WX_ICON := {
	"fair": "sun",
	"rain": "rain",
	"hot": "sun",
	"crisp": "leaf",
	"market": "bag",
	"quiet": "cloud",
}

const _LOSS_FIELDS := [
	["report.missed", "missed"],
	["report.queueLost", "queueLost"],
	["report.tableLost", "tableLost"],
	["report.extraLost", "extraLost"],
	["report.doorLost", "doorLost"],
]


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_account_money(n)


static func _num(n: float) -> String:
	return UiWords.grouped(n)


static func _or(v: Variant) -> float:
	return v if v is float else 0.0


static func _row(label: String, value: String) -> Control:
	return Paper.line([Paper.words(label, "muted"), Paper.words(value, "strong", false)])


static func _dotted_row(label: String, value: String, bad: bool = false, narrow: bool = false) -> Control:
	var fs := 12 if narrow else 13
	var left := Paper.words(label, "strong" if bad else "", false)
	left.add_theme_font_size_override("font_size", fs)
	left.add_theme_color_override("font_color", PaperReceipt.LOSS_RED if bad else Paper.INK_A)
	var right := Paper.words(value, "strong", false)
	right.add_theme_font_override("font", Paper.font(800))
	right.add_theme_font_size_override("font_size", fs + 1)
	right.add_theme_color_override("font_color", PaperReceipt.LOSS_RED if bad else Paper.INK_A)
	var r := Paper.line([left, PaperReceipt.DottedLeader.new(bad), right], 5)
	r.alignment = BoxContainer.ALIGNMENT_CENTER
	return r


static func top_sellers(r: Dictionary) -> Array:
	var sales: Dictionary = r.get("sales", {})
	var entries := []
	for id: String in sales:
		var n: float = _or(sales[id])
		if n > 0.0:
			entries.append([id, n])
	return JsUtil.stable_sort(entries, func(a: Array, b: Array) -> float: return b[1] - a[1]).slice(0, 3)


static func top_loss(r: Dictionary) -> Dictionary:
	var best_key := ""
	var best_count := 0.0
	for pair: Array in _LOSS_FIELDS:
		var count := _or(r.get(pair[1]))
		if count > best_count:
			best_count = count
			best_key = pair[0]
	return {} if best_key.is_empty() else {"key": best_key, "count": best_count}


static func _reason(r: Dictionary) -> String:
	return _t("report.reason.%s" % r["kind"], {"n": _or(r.get("count")), "extra": _or(r.get("extra")), "money": _money(_or(r.get("amount")))})


static func _action(advice: Dictionary) -> String:
	var a: Dictionary = advice["action"]
	var ingredients: Variant = a.get("ingredients")
	var key := "report.action.%s" % a["kind"]
	if a["kind"] == "restock":
		key = "report.action.restockFull" if a["cost"] + 1e-6 >= advice["ingredientReserve"] else "report.action.restock"
	return _t(key, {
		"item": I18n.item_name(a["item"]) if a.get("item") is String else "",
		"items": Restocking.names(ingredients) if ingredients is Dictionary else "",
		"n": _or(a.get("amount")), "money": _money(a["cost"]), "reward": CoreFormat.format_money(_or(a.get("reward"))),
		"upgrade": _t("upgrade.%s.name" % a["upgrade"]) if a.get("upgrade") is String else "",
		"chapter": _t("milestone.chapter.%s" % a["goal"]) if a["kind"] == "claimChapter" and a.get("goal") is String else "",
	})


static func show_report(ui: CafeUi, report: Dictionary) -> void:
	var s := ui.session.state
	var advice := CoreSettlementAdvice.settlement_advice(report, s)
	var vw := ui.get_viewport().get_visible_rect().size.x if ui.is_inside_tree() else 412.0
	var narrow := vw < 380.0
	var root := PanelContainer.new()
	root.add_theme_stylebox_override("panel", StyleBoxEmpty.new())
	root.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	root.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.mouse_filter = Control.MOUSE_FILTER_PASS

	var sign_row := _build_sign(s, report, narrow)
	var scroll_body := _build_scroll_body(ui, report, advice, narrow)
	var scroll := Paper.scroller(Paper.padded(scroll_body, 4 if narrow else 6, 10, 4 if narrow else 6, 10))

	var go := PaperChalkboard.GoButton.new(_t("report.next"), func() -> void:
		ui.dialogs.close()
		ui.session.next_day(), narrow, "sun")
	go.custom_minimum_size.y = 48.0 if narrow else 54.0
	var footer := Paper.padded(go, 4, 4, 4, 0)

	var shell := Paper.col([sign_row, scroll, footer], 6 if narrow else 7)
	shell.size_flags_vertical = Control.SIZE_EXPAND_FILL
	root.add_child(shell)
	ui.dialogs.show_custom(root, {
		"top_offset": 14.0 if narrow else 16.0,
		"side_margin": 8 if narrow else 10,
		"bottom_margin": 10 if narrow else 14,
	})


static func _build_sign(s: Dictionary, report: Dictionary, narrow: bool) -> Control:
	var cafe_name := ""
	if s.get("profile") is Dictionary:
		cafe_name = str(s["profile"].get("cafeName", ""))
	if cafe_name.is_empty():
		cafe_name = _t("app.title")
	var name_lbl := Label.new()
	name_lbl.text = cafe_name
	name_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	name_lbl.add_theme_font_override("font", Paper.font(700))
	name_lbl.add_theme_font_size_override("font_size", 11)
	name_lbl.add_theme_color_override("font_color", Color(1.0, 0.96, 0.88, 0.84))
	name_lbl.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var heading := Label.new()
	heading.text = _t("report.closedHeading", {"n": report["day"]})
	heading.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	heading.add_theme_font_override("font", Paper.font(800))
	heading.add_theme_font_size_override("font_size", 15 if narrow else 16)
	heading.add_theme_color_override("font_color", Color8(0xff, 0xf8, 0xea))
	heading.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var plank := Paper.plank(Vector2(18 if narrow else 20, 6 if narrow else 7), 12.0, true, false)
	plank.custom_minimum_size.x = 186.0 if narrow else 204.0
	plank.rope_height = 24.0
	plank.rope_right_inset = 28.0
	plank.add_child(Paper.col([name_lbl, heading], 1))
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(plank)
	return row


static func _build_scroll_body(ui: CafeUi, report: Dictionary, advice: Dictionary, narrow: bool) -> Control:
	var s := ui.session.state
	var profit: float = report["profit"]
	var out := Paper.col([], 7 if narrow else 8)
	out.add_child(Paper.padded(_build_receipt(ui, s, report, advice, narrow), 2 if narrow else 6, 0, 2 if narrow else 6, 0))

	# Below receipt: tomorrow sticky note (left, if applicable) + business details card (right), then full-width details body.
	var tomorrow_cond: Dictionary = CoreConditions.condition_def(CoreConditions.condition_on(s, report["day"] + 1.0))
	var has_tomorrow_weather: bool = tomorrow_cond["id"] != "fair"
	var has_tomorrow_demand := CoreCustomerDemand.demand_enabled({"day": report["day"] + 1.0})
	var has_sticky := has_tomorrow_weather or has_tomorrow_demand

	var below_row := HBoxContainer.new()
	below_row.add_theme_constant_override("separation", 8 if narrow else 10)
	below_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	below_row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if has_sticky:
		var note := PaperReceipt.TomorrowNote.new(narrow)
		note.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		var heading_text := _t("report.tomorrowWeather", {"name": UiWords.condition_name(tomorrow_cond)}) if has_tomorrow_weather else _t("demand.tomorrow")
		var wx_ic := Paper.mark(_WX_ICON.get(tomorrow_cond["id"], "sun"), 14.0, Paper.INK_A)
		var head_lbl := Paper.words(heading_text, "strong")
		head_lbl.add_theme_font_override("font", Paper.font(800))
		head_lbl.add_theme_font_size_override("font_size", 12 if narrow else 13)
		head_lbl.add_theme_color_override("font_color", Paper.INK_A)
		var head_row := Paper.line([wx_ic, head_lbl], 4)
		head_row.alignment = BoxContainer.ALIGNMENT_CENTER
		var note_col := Paper.col([head_row], 3)
		if has_tomorrow_demand:
			var hint_lbl := Paper.words(_t("demand.hint.%s" % tomorrow_cond["id"]), "small")
			hint_lbl.add_theme_font_size_override("font_size", 11 if narrow else 12)
			hint_lbl.add_theme_color_override("font_color", Paper.NOTE_INK)
			note_col.add_child(hint_lbl)
		note.add_child(note_col)
		below_row.add_child(note)

	var det_title := Paper.words(_t("report.detailsTitle"), "strong")
	det_title.add_theme_font_override("font", Paper.font(800))
	det_title.add_theme_font_size_override("font_size", 12 if narrow else 13)
	det_title.add_theme_color_override("font_color", Paper.INK_A)
	var chevron := Paper.mark("chevron", 14.0, Paper.INK_A)
	chevron.pivot_offset = Vector2(7.0, 7.0)
	var det_top := Paper.line([det_title, chevron], 4)
	det_top.alignment = BoxContainer.ALIGNMENT_CENTER
	var det_sub := Paper.words(_t("report.detailsSub"), "small")
	det_sub.add_theme_font_size_override("font_size", 10 if narrow else 11)
	det_sub.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var det_card := Paper.panel(Paper.box(Color(1.0, 250 / 255.0, 240 / 255.0, 0.96), Color.TRANSPARENT, 0.0, 12.0, Vector2(10 if narrow else 12, 9 if narrow else 10), Color(0.0, 0.0, 0.0, 0.18), 3.0))
	det_card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	det_card.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	det_card.set_meta("fold", true)
	det_card.add_child(Paper.col([det_top, det_sub], 3))
	if has_sticky:
		var det_wrap := Paper.padded(det_card, 0, 8, 0, 0)
		det_wrap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		det_wrap.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		below_row.add_child(det_wrap)
	else:
		below_row.add_child(det_card)
	out.add_child(below_row)

	# Full-width expandable details panel underneath both cards.
	var reasons: Array = advice["reasons"]
	var first := reasons if profit < 0.0 else reasons.slice(0, 1)
	var others := reasons.filter(func(r: Dictionary) -> bool: return r not in first)
	var det_body := _build_details_body(ui, s, report, advice, first, others)
	var det_panel := Paper.panel(Paper.box(Color(1.0, 250 / 255.0, 240 / 255.0, 0.97), Paper.LINE_A, 1.5, 12.0, Vector2(11 if narrow else 13, 10 if narrow else 12), Color(0.0, 0.0, 0.0, 0.18), 3.0))
	det_panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	det_panel.visible = false
	det_panel.add_child(det_body)
	det_card.set_meta("content", det_panel)
	det_card.gui_input.connect(func(e: InputEvent) -> void:
		if e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
			Paper._finish_typing(det_card)
			det_panel.visible = not det_panel.visible
			chevron.rotation_degrees = 90.0 if det_panel.visible else 0.0)
	out.add_child(det_panel)
	return out


static func _build_receipt(ui: CafeUi, s: Dictionary, report: Dictionary, advice: Dictionary, narrow: bool) -> Control:
	var profit: float = report["profit"]
	var receipt := PaperReceipt.new(narrow)
	var col := Paper.col([], 5 if narrow else 6)

	# Header: title + duration/weather subtitle + top-right tilted red stamp (exact token order).
	var today_cond: Dictionary = CoreConditions.condition_def(CoreConditions.condition_on(s, report["day"]))
	var rcpt_title := Label.new()
	rcpt_title.text = _t("report.receiptTitle")
	rcpt_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rcpt_title.add_theme_font_override("font", Paper.font(800))
	rcpt_title.add_theme_font_size_override("font_size", 14 if narrow else 15)
	rcpt_title.add_theme_color_override("font_color", Paper.INK_A)
	var dt := Label.new()
	dt.text = "%s · %s" % [CoreBusinessClock.format_business_duration(report["duration"]), UiWords.condition_name(today_cond)]
	dt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dt.add_theme_font_size_override("font_size", 11)
	dt.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var head_copy := Paper.col([rcpt_title, dt], 1)
	head_copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL

	var stamp := PaperReceipt.RedStamp.new(
		_t("report.stampLoss" if profit < 0.0 else "report.stampGood"),
		_t("report.stampDay", {"n": report["day"]}),
		narrow,
	)
	var stamp_holder := Control.new()
	stamp_holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	stamp_holder.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stamp_holder.custom_minimum_size = Vector2(0.0, 0.0)
	stamp.set_anchors_and_offsets_preset(Control.PRESET_TOP_RIGHT)
	stamp.offset_left = -stamp.custom_minimum_size.x + 2.0
	stamp.offset_right = 2.0
	stamp.offset_top = -30.0 if narrow else -34.0
	stamp.offset_bottom = stamp.offset_top + stamp.custom_minimum_size.y
	stamp_holder.add_child(stamp)

	var head_wrap := VBoxContainer.new()
	head_wrap.add_theme_constant_override("separation", 0)
	head_wrap.mouse_filter = Control.MOUSE_FILTER_IGNORE
	head_wrap.add_child(head_copy)
	head_wrap.add_child(stamp_holder)
	col.add_child(head_wrap)
	col.add_child(PaperReceipt.DashedRule.new())

	# Profit block.
	var profit_lbl := Label.new()
	profit_lbl.text = _t("report.lostToday" if profit < 0.0 else "report.earnedToday")
	profit_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	profit_lbl.add_theme_font_override("font", Paper.font(700))
	profit_lbl.add_theme_font_size_override("font_size", 11 if narrow else 12)
	profit_lbl.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var profit_num := Label.new()
	profit_num.text = "%s%s" % ["−" if profit < 0.0 else "+", _money(absf(profit))]
	profit_num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	profit_num.add_theme_font_override("font", Paper.font(800))
	profit_num.add_theme_font_size_override("font_size", 30 if narrow else 34)
	profit_num.add_theme_color_override("font_color", PaperReceipt.LOSS_RED if profit < 0.0 else Paper.CARD_PRICE)
	col.add_child(Paper.col([profit_lbl, profit_num], 0))
	col.add_child(PaperReceipt.DashedRule.new())

	# Dotted-leader ledger rows.
	var rows := Paper.col([
		_dotted_row(_t("report.served"), _num(report["served"]), false, narrow),
		_dotted_row(_t("report.revenue"), _money(report["revenue"]), false, narrow),
		_dotted_row(_t("report.cost"), "−" + _money(advice["totalCost"]), false, narrow),
	], 3)
	var loss := top_loss(report)
	if not loss.is_empty():
		rows.add_child(_dotted_row(_t(loss["key"]), _num(loss["count"]), true, narrow))
	if report["day"] == 1.0 and report["ingredientCost"] > 0.0:
		var starter := Paper.words(_t("report.starterNote"), "muted")
		starter.add_theme_font_size_override("font_size", 11)
		rows.add_child(starter)
	col.add_child(rows)
	col.add_child(PaperReceipt.DashedRule.new())

	# Top 3 best sellers.
	var best_head := Paper.words(_t("report.bestSellers"), "strong")
	best_head.add_theme_font_override("font", Paper.font(800))
	best_head.add_theme_font_size_override("font_size", 12)
	best_head.add_theme_color_override("font_color", Paper.INK_A)
	var best_sec := Paper.col([best_head], 4)
	var sellers := top_sellers(report)
	if sellers.is_empty():
		var none_lbl := Paper.words(_t("report.none"), "muted")
		none_lbl.add_theme_font_size_override("font_size", 12)
		best_sec.add_child(none_lbl)
	else:
		var best_row := HBoxContainer.new()
		best_row.alignment = BoxContainer.ALIGNMENT_CENTER
		best_row.add_theme_constant_override("separation", 6)
		best_row.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		for i in sellers.size():
			var entry: Array = sellers[i]
			var pic := Portraits.icon("item:%s" % entry[0], 38.0 if narrow else 42.0)
			pic.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			var cnt := Paper.words("×%s" % JsMath.number_to_string(entry[1]), "strong", false)
			cnt.add_theme_font_override("font", Paper.font(800))
			cnt.add_theme_font_size_override("font_size", 12)
			cnt.add_theme_color_override("font_color", Paper.INK_A)
			var count_row := HBoxContainer.new()
			count_row.alignment = BoxContainer.ALIGNMENT_CENTER
			count_row.add_theme_constant_override("separation", 3)
			count_row.add_child(PaperReceipt.rank_dot(i))
			count_row.add_child(cnt)
			var item_col := Paper.col([pic, count_row], 2)
			item_col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			best_row.add_child(item_col)
		best_sec.add_child(best_row)
	col.add_child(best_sec)

	# Partner cards (2 per row, full width if only 1).
	var partners: Variant = report.get("partners")
	if partners is Array and not partners.is_empty():
		col.add_child(PaperReceipt.DashedRule.new())
		var pal_box := Paper.col([], 6)
		var i := 0
		while i < partners.size():
			var first_card := _partner_card(partners[i], narrow)
			if i + 1 < partners.size():
				var second_card := _partner_card(partners[i + 1], narrow)
				var pair := HBoxContainer.new()
				pair.add_theme_constant_override("separation", 7)
				pair.size_flags_horizontal = Control.SIZE_EXPAND_FILL
				pair.add_child(first_card)
				pair.add_child(second_card)
				pal_box.add_child(pair)
				i += 2
			else:
				pal_box.add_child(first_card)
				i += 1
		col.add_child(pal_box)

	# Extra receipt sections (closing story, regular wish, trial result, guest memories).
	var extras: Array[Control] = []
	var story := CafeLife.closing_story(s, report, ui.session.save_game)
	if story != null:
		extras.append(story)
	for part: Control in [
		WishCard.report(s, report["day"]),
		TrialCards.result(ui.session, ui.session.trial_result_changed, report["trialSale"]) if report.get("trialSale") is Dictionary else null,
		MemoryNotes.report(s, report["day"]),
	]:
		if part != null:
			extras.append(part)
	if not extras.is_empty():
		col.add_child(PaperReceipt.DashedRule.new())
		var extra_col := Paper.col([], 6)
		for part: Control in extras:
			extra_col.add_child(part)
		col.add_child(extra_col)

	# Direct claim bar (goal or chapter).
	var claim_bar := _build_claim_bar(ui, s, advice, narrow)
	if claim_bar != null:
		col.add_child(claim_bar)

	receipt.add_child(col)
	return receipt


static func _partner_card(p: Dictionary, narrow: bool) -> PanelContainer:
	var def: Variant = CorePartners.partner_definition(p["id"])
	var card := Paper.panel(Paper.cached_box(PaperReceipt.PAL_BG, Color.TRANSPARENT, 0.0, 12.0, Vector2(5 if narrow else 6, 4)))
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var name_lbl := Paper.words(def["name"][I18n.locale] if def is Dictionary else "", "strong")
	name_lbl.add_theme_font_override("font", Paper.font(800))
	name_lbl.add_theme_font_size_override("font_size", 11 if narrow else 12)
	name_lbl.add_theme_color_override("font_color", Paper.INK_A)
	var sub_text := _t("report.partnerJobs", {"n": p["jobs"]})
	if p["unlocked"] > 0.0:
		sub_text += " · " + _t("report.partnerNewStories", {"n": p["unlocked"]})
	var sub_lbl := Paper.words(sub_text, "small")
	sub_lbl.add_theme_font_size_override("font_size", 9 if narrow else 10)
	sub_lbl.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var copy := Paper.col([name_lbl, sub_lbl], 0)
	copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var items: Array = []
	if def is Dictionary:
		items.append(PaperReceipt.avatar(def["look"], 30.0 if narrow else 32.0))
	items.append(copy)
	var row := Paper.line(items, 5)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	card.add_child(row)
	return card


static func _build_claim_bar(ui: CafeUi, s: Dictionary, advice: Dictionary, narrow: bool) -> Control:
	var goal: Variant = advice.get("claimableGoal")
	var chapter_id := ""
	if goal == null and advice["action"]["kind"] == "claimChapter" and advice["action"].get("goal") is String:
		chapter_id = advice["action"]["goal"]
	if goal == null and chapter_id.is_empty():
		return null
	var strip := PaperReceipt.ClaimStrip.new()
	var trophy := Paper.mark("trophy", 17.0, PaperReceipt.TROPHY_GOLD)
	var title_text := _t("report.claimGoalTitle", {"goal": _t("goal.%s" % goal["id"])}) if goal != null else _t("report.claimChapterTitle", {"chapter": _t("milestone.chapter.%s" % chapter_id)})
	var title_lbl := Paper.words(title_text, "strong")
	title_lbl.add_theme_font_override("font", Paper.font(800))
	title_lbl.add_theme_font_size_override("font_size", 11 if narrow else 12)
	title_lbl.add_theme_color_override("font_color", Paper.INK_A)
	var btn_text := _t("report.claimGoalBtn", {"reward": UiWords.money(goal["reward"])}) if goal != null else _t("report.claimChapterBtn")
	var btn := Paper.button(btn_text, "primary")
	btn.custom_minimum_size = Vector2(0.0, 30.0)
	btn.add_theme_font_override("font", Paper.font(800))
	btn.add_theme_font_size_override("font_size", 11 if narrow else 12)
	var normal := Paper.box(Paper.SAGE_A, Color.TRANSPARENT, 0.0, 10.0, Vector2(9, 5), Paper.SAGE_A_DARK, 2.0)
	var down := Paper.box(Paper.SAGE_A_DARK, Color.TRANSPARENT, 0.0, 10.0, Vector2(9, 5))
	var off := Paper.box(Color8(0xe8, 0xde, 0xcb), Color8(0xc8, 0xb6, 0x9b), 1.0, 10.0, Vector2(9, 5))
	for st: String in ["normal", "hover", "focus"]:
		btn.add_theme_stylebox_override(st, normal)
	btn.add_theme_stylebox_override("pressed", down)
	btn.add_theme_stylebox_override("hover_pressed", down)
	btn.add_theme_stylebox_override("disabled", off)
	btn.add_theme_color_override("font_disabled_color", Paper.INK_LIGHT)
	btn.pressed.connect(func() -> void:
		if btn.disabled:
			return
		if goal != null:
			var reward := CoreGoals.claim_goal(s)
			if reward > 0.0:
				ui.session.panel_changed("goal", JsMath.number_to_string(reward))
				ui.refresh()
				btn.disabled = true
				btn.text = _t("report.claimedGoalBtn", {"reward": UiWords.money(reward)})
				strip.set_claimed(true)
		else:
			var cid := MilestoneBook.claim(ui.dialogs, s)
			if not cid.is_empty():
				ui.session.panel_changed("milestone", cid)
				ui.refresh()
				btn.disabled = true
				btn.text = _t("report.claimedChapterBtn")
				strip.set_claimed(true))
	var row := Paper.line([trophy, title_lbl, btn], 6)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	strip.add_child(row)
	return strip


static func _build_details_body(ui: CafeUi, s: Dictionary, report: Dictionary, advice: Dictionary, first: Array, others: Array) -> Control:
	var out := Paper.col([], 8)
	out.add_child(_guidance(ui, s, report, advice, first))
	var guests := DemandWords.report(report)
	if guests != null:
		out.add_child(guests)
	var partners: Variant = report.get("partners")
	if partners is Array and not partners.is_empty():
		var list := Paper.col([Paper.words(UiWords.here("今日伙伴贡献", "Today’s partner contributions"), "h3")], 4)
		for p: Dictionary in partners:
			var def: Variant = CorePartners.partner_definition(p["id"])
			list.add_child(Paper.words("%s · %s · %s XP%s" % [def["name"][I18n.locale] if def is Dictionary else "", _t("report.partnerJobs", {"n": p["jobs"]}), JsMath.number_to_string(p["xp"]), " · %s" % _t("report.partnerNewStories", {"n": p["unlocked"]}) if p["unlocked"] > 0.0 else ""]))
		out.add_child(list)
	out.add_child(_details(s, report, others))
	return out


static func _guidance(ui: CafeUi, _s: Dictionary, report: Dictionary, advice: Dictionary, reasons: Array) -> Control:
	var tab: String = advice["action"]["tab"]
	var out := Paper.col([Paper.words(" ".join(PackedStringArray(reasons.map(_reason))))], 6)
	var goal: Variant = advice.get("claimableGoal")
	if goal != null:
		out.add_child(Paper.words(_t("report.goalReady", {"goal": _t("goal.%s" % goal["id"]), "reward": CoreFormat.format_money(goal["reward"])}), "good"))
	out.add_child(Paper.words("%s: %s" % [_t("report.nextStep"), _action(advice)], "strong"))
	var tab_btn := Paper.button(_t("tab.%s" % tab), "ghost", func() -> void:
		ui.dialogs.close()
		ui.show_tab(tab))
	tab_btn.custom_minimum_size = Vector2(0.0, 34.0)
	tab_btn.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	out.add_child(tab_btn)
	if advice["action"]["kind"] not in ["restock", "upgrade"]:
		out.add_child(Paper.words(_t("report.stockFirst"), "muted"))
	var reached: Variant = report.get("newMilestones")
	if reached is Array and not reached.is_empty():
		out.add_child(Paper.words(_t("milestone.report", {"items": UiWords.join(reached.map(MilestoneBook.name))}), "good"))
	var card := Paper.card("soft")
	card.add_child(out)
	return card


static func _sum(counts: Dictionary) -> float:
	var n := 0.0
	for id: String in counts:
		n += counts[id]
	return n


static func _counted(counts: Dictionary, s: Dictionary) -> String:
	return UiWords.join(counts.keys().map(func(id: String) -> String: return "%s ×%s" % [I18n.item_name(id, s), JsMath.number_to_string(counts[id])]))


static func _details(s: Dictionary, r: Dictionary, others: Array) -> Control:
	var out := Paper.col([
		_row(_t("report.missed"), _t("report.missedValue", {"n": r["missed"], "sold": r["soldOut"]})), _row(_t("report.queueLost"), _num(r["queueLost"])), _row(_t("report.tableLost"), _num(r["tableLost"])),
		_row(_t("report.extraLost"), _num(r["extraLost"])), _row(_t("report.doorLost"), _num(r["doorLost"])), _row(_t("report.duration"), CoreBusinessClock.format_business_duration(r["duration"])),
		_row(_t("report.ingredients"), "−" + _money(r["ingredientCost"])),
	], 4)
	if r["petCost"] > 0.0:
		out.add_child(_row(_t("pet.expense"), "−" + _money(r["petCost"])))
	if r["promotionCost"] > 0.0:
		out.add_child(_row(_t("promo.expense"), "−" + _money(r["promotionCost"])))
	var baked := _sum(r["baked"])
	var stale := _sum(r["stale"])
	if baked > 0.0:
		out.add_child(_row(_t("report.baked"), _num(baked)))
		out.add_child(_row(_t("report.stale"), _t("report.staleValue", {"n": stale, "money": CoreFormat.format_money(r["staleCost"])}) if stale > 0.0 else "0"))
	out.add_child(Paper.words(_t("report.costNote"), "muted"))
	var minutes := CoreBusinessClock.business_elapsed_minutes(r["duration"])
	out.add_child(Paper.words(_t("report.perMinute", {"money": _money(r["profit"] / minutes)}) if minutes >= 1.0 else _t("report.shortSample"), "muted"))
	if not others.is_empty():
		out.add_child(Paper.words(" ".join(PackedStringArray(others.map(_reason))), "muted"))
	out.add_child(SmallDialogs.rating_report(r))
	var best: Variant = r["bestSeller"]
	out.add_child(Paper.line([Portraits.icon("item:%s" % best, 36.0), Paper.words(UiWords.plain(_t("report.best", {"item": I18n.item_name(best, s), "n": r["sales"].get(best, 0.0)})))]) if best is String else Paper.words(_t("report.none")))
	if not r["shortages"].is_empty():
		out.add_child(Paper.words(_t("report.shortages", {"items": _counted(r["shortages"], s)}), "muted"))
	var plain := func(ids: Array) -> String: return UiWords.join(ids.map(func(id: String) -> String: return I18n.item_name(id)))
	if not r["shelfSoldOut"].is_empty():
		out.add_child(Paper.words(UiWords.plain(_t("report.shelfOut", {"items": plain.call(r["shelfSoldOut"])})), "muted"))
	# Leftovers of a dish that also sold out point to batch timing, not to baking too much.
	for short: bool in [false, true]:
		var group := {}
		for id: String in r["stale"]:
			if r["stale"][id] > 0.0 and (r["shortages"].get(id, 0.0) > 0.0) == short:
				group[id] = r["stale"][id]
		if not group.is_empty():
			out.add_child(Paper.words(_t("report.staleShort" if short else "report.staleItems", {"items": _counted(group, s)}), "muted"))
	if not r["outOfStock"].is_empty():
		out.add_child(Paper.words(_t("report.outOfStock", {"items": plain.call(r["outOfStock"])}), "bad"))
	return out
