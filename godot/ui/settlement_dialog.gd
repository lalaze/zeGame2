class_name SettlementDialog
extends RefCounted

## The day's report (src/ui/settlement.ts and main.ts showReport): a short summary and what to do next, with the whole
## ledger one fold away.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _money(n: float) -> String:
	return CoreFormat.format_account_money(n)


static func _num(n: float) -> String:
	return UiWords.grouped(n)


static func _row(label: String, value: String) -> Control:
	return Paper.line([Paper.words(label, "muted"), Paper.words(value, "strong", false)])


static func _reason(r: Dictionary) -> String:
	return _t("report.reason.%s" % r["kind"], {"n": _or(r.get("count")), "extra": _or(r.get("extra")), "money": _money(_or(r.get("amount")))})


static func _or(v: Variant) -> float:
	return v if v is float else 0.0


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
	var claimable: bool = advice.get("claimableGoal") != null
	var tab: String = advice["action"]["tab"]
	ui.dialogs.show_dialog(_t("report.title", {"n": report["day"]}), body(ui, report, advice), [
		{"label": _t("report.next"), "kind": "primary", "pressed": ui.session.next_day},
		{"label": _t("guide.viewReward") if claimable or advice["action"]["kind"] == "claimChapter" else _t("tab.%s" % tab), "pressed": func() -> void:
			ui.show_tab(tab)
			if claimable or advice["action"]["kind"] == "claimChapter":
				ui.ledger.reveal_goal()},
	], {"icon": ui.owner_icon()})


static func body(ui: CafeUi, report: Dictionary, advice: Dictionary) -> Control:
	var s := ui.session.state
	var profit: float = report["profit"]
	var out := Paper.col([], 10)
	var summary := Paper.card("row")
	var total := Paper.words("%s%s" % ["−" if profit < 0.0 else "+", _money(absf(profit))], "h1", false)
	total.add_theme_color_override("font_color", Paper.DANGER if profit < 0.0 else Paper.SAGE_DARK)
	var lines := Paper.col([_row(_t("report.served"), _num(report["served"])), _row(_t("report.revenue"), _money(report["revenue"])), _row(_t("report.cost"), "−" + _money(advice["totalCost"])), Paper.seam(), Paper.line([Paper.words(_t("report.profit"), "strong"), total])], 4)
	if report["day"] == 1.0 and report["ingredientCost"] > 0.0:
		lines.add_child(Paper.words(_t("report.starterNote"), "muted"))
	summary.add_child(lines)
	out.add_child(summary)
	var story := CafeLife.closing_story(s, report, ui.session.save_game)
	if story != null:
		out.add_child(story)
	for part: Control in [WishCard.report(s, report["day"]), TrialCards.result(ui.session, ui.session.trial_result_changed, report["trialSale"]) if report.get("trialSale") is Dictionary else null, MemoryNotes.report(s, report["day"])]:
		if part != null:
			out.add_child(part)
	# Every driver of a loss stays together; otherwise one, and the rest with the ledger.
	var reasons: Array = advice["reasons"]
	var first := reasons if profit < 0.0 else reasons.slice(0, 1)
	var others := reasons.filter(func(r: Dictionary) -> bool: return r not in first)
	out.add_child(_guidance(s, report, advice, first))
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
	out.add_child(Paper.fold(_t("report.details"), _details(s, report, others)))
	return out


static func _guidance(s: Dictionary, report: Dictionary, advice: Dictionary, reasons: Array) -> Control:
	var out := Paper.col([Paper.words(" ".join(PackedStringArray(reasons.map(_reason))))], 6)
	var goal: Variant = advice.get("claimableGoal")
	if goal != null:
		out.add_child(Paper.words(_t("report.goalReady", {"goal": _t("goal.%s" % goal["id"]), "reward": CoreFormat.format_money(goal["reward"])}), "good"))
	out.add_child(Paper.words("%s: %s" % [_t("report.nextStep"), _action(advice)], "strong"))
	if advice["action"]["kind"] not in ["restock", "upgrade"]:
		out.add_child(Paper.words(_t("report.stockFirst"), "muted"))
	var reached: Variant = report.get("newMilestones")
	if reached is Array and not reached.is_empty():
		out.add_child(Paper.words(_t("milestone.report", {"items": UiWords.join(reached.map(MilestoneBook.name))}), "good"))
	var tomorrow := UiWords.tomorrow(s, report["day"])
	if not tomorrow.is_empty():
		out.add_child(Paper.words(tomorrow))
	var demand := DemandWords.tomorrow(s, report["day"])
	if not demand.is_empty():
		out.add_child(Paper.words(" ".join(PackedStringArray(demand))))
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
