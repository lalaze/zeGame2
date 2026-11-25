class_name SmallDialogs
extends RefCounted

## Dialogs that only tell or ask something: money-details.ts, reputation.ts, sold-out.ts, moments.ts, service-help.ts.

static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func _back() -> Dictionary:
	return {"label": _t("settings.back"), "kind": "primary"}


## The balance, and what something costs, as written and to the last cent.
static func money(dialogs: PaperDialogs, balance: float, price: Variant = null) -> void:
	var say := func(write: Callable) -> Array:
		var out := []
		if price != null:
			out.append(_t("money.price", {"money": write.call(price)}))
		out.append(_t("money.balance", {"money": write.call(balance)}))
		if price != null and price > balance:
			out.append(_t("money.shortfall", {"money": write.call(price - balance)}))
		return out
	var body := Paper.col([])
	for text: String in say.call(CoreFormat.format_transaction_money) + [_t("money.precision")]:
		body.add_child(Paper.words(text))
	var exact := Paper.col([])
	for text: String in say.call(CoreFormat.format_exact_money):
		exact.add_child(Paper.words(text))
	body.add_child(Paper.fold(_t("money.fullPrecision"), exact))
	dialogs.show_dialog(_t("money.title"), body, [{"label": _t("settings.back")}])


# ---------------------------------------------------------------- reputation

static func rating_words(state: Dictionary) -> String:
	if state["reputation"]["recent"].is_empty():
		return _t("rating.new")
	return _t("rating.score", {"score": UiWords.fixed(CoreReputation.reputation_score(state["reputation"]), 2)})


static func rating_traffic(state: Dictionary) -> String:
	return _t("rating.traffic", {"pct": UiWords.percent(CoreReputation.reputation_traffic(state["reputation"]))})


## Five stars, as many of them in gold as given.
static func _stars(share: float) -> Control:
	var five := Paper.words("★★★★★", "strong", false)
	five.add_theme_color_override("font_color", Paper.SOFT_LINE)
	var gold := Paper.words("★★★★★", "strong", false)
	gold.add_theme_color_override("font_color", Paper.GOLD)
	var part := Control.new()
	part.clip_contents = true
	part.mouse_filter = Control.MOUSE_FILTER_IGNORE
	part.add_child(gold)
	five.add_child(part)
	five.resized.connect(func() -> void: part.size = Vector2(five.size.x * share / 5.0, five.size.y))
	return five


static func reputation(dialogs: PaperDialogs, state: Dictionary) -> void:
	var recent: Array = state["reputation"]["recent"]
	var overview := Paper.card("row")
	overview.add_child(Paper.col([Paper.words(rating_words(state), "name"), Paper.words(rating_traffic(state), "good")], 2))
	var body := Paper.col([overview, Paper.words(_t("rating.scope", {"n": float(recent.size())}), "muted"), Paper.words(_t("rating.effect"), "muted"), Paper.words(_t("rating.recent"), "h3")])
	if recent.is_empty():
		body.add_child(Paper.words(_t("rating.empty")))
	var latest := recent.slice(-5)
	latest.reverse()
	for review: Dictionary in latest:
		var stars := _stars(review["stars"])
		var lines := Paper.col([Paper.line([Paper.words(_t("rating.review", {"day": review["day"], "stars": UiWords.fixed(review["stars"], 1)}), "strong"), stars]), Paper.words(_t("rating.reason.%s" % review["reason"]))], 2)
		if review.has("taste") and review.get("items") is Array and not review["items"].is_empty():
			var names: Array = review["items"].map(func(id: String) -> String: return I18n.item_name(id, state))
			lines.add_child(Paper.words(_t("rating.mealTaste", {"items": UiWords.join(names), "score": UiWords.fixed(review["taste"], 1)}), "muted"))
		lines.add_child(Paper.seam())
		body.add_child(lines)
	body.add_child(Paper.fold(_t("rating.how"), Paper.col([Paper.words(_t("rating.rules"), "muted"), Paper.words(_t("rating.smoothing"), "muted"), Paper.words(_t("rating.fairness"), "muted")])))
	dialogs.show_dialog(_t("rating.title"), body, [_back()])


## A day's reviews, in its report.
static func rating_report(report: Dictionary) -> Control:
	var reviews: Dictionary = report["reviews"]
	var average: Variant = CoreReputation.review_average(reviews)
	var body := Paper.col([Paper.words(_t("rating.today"), "h3")], 4)
	if average == null:
		body.add_child(Paper.words(_t("rating.noReviews"), "muted"))
	else:
		body.add_child(Paper.words(_t("rating.summary", {"n": CoreReputation.review_count(reviews), "score": UiWords.fixed(average, 2)})))
		for reason: String in CoreReputation.REVIEW_REASONS:
			if reviews["reasons"].get(reason, 0.0) > 0.0:
				body.add_child(Paper.line([Paper.words(_t("rating.reason.%s" % reason)), Paper.words("×%s" % JsMath.number_to_string(reviews["reasons"][reason]), "strong", false)]))
	var now: String = _t("rating.score", {"score": UiWords.fixed(report["rating"], 2)}) if report["ratingCount"] > 0.0 else _t("rating.new")
	body.add_child(Paper.words("%s · %s" % [now, _t("rating.traffic", {"pct": UiWords.percent(report["ratingTraffic"])})], "good"))
	return body


# ---------------------------------------------------------------- sold out, a guest's question, help

## The decision happens before settlement, while the day's clock and ledger are retained.
static func sold_out(dialogs: PaperDialogs, session: CoreGameSession) -> void:
	var state := session.state
	var plan := CoreEconomy.restock_plan(state)
	var projected := state.duplicate(false)
	projected["pantry"] = state["pantry"].duplicate()
	for id: String in plan["buy"]:
		projected["pantry"][id] += plan["buy"][id]
	var can_resume: bool = plan["cost"] > 0.0 and state["dayTime"] < CoreData.DAY_SECONDS and CoreEconomy.has_service_supply(projected)
	var names := func(items: Dictionary) -> String: return UiWords.join(items.keys().map(func(id: String) -> String: return "%s ×%s" % [UiWords.ingredient(id), JsMath.number_to_string(items[id])]))
	var bought: String = names.call(plan["buy"])
	var body := Paper.col([Paper.words(_t("soldout.body")), Paper.words(_t("pantry.plan", {"items": bought if not bought.is_empty() else _t("prep.noPurchase"), "balance": UiWords.money(plan["balance"])}))])
	if plan["missingCost"] > 0.0:
		body.add_child(Paper.words(_t("pantry.unmet", {"items": names.call(plan["missing"]), "price": UiWords.money(plan["missingCost"])})))
	if not can_resume:
		body.add_child(Paper.words(_t("soldout.noBudget")))
	dialogs.show_dialog(_t("soldout.title"), body, [
		{"label": _t("soldout.resume", {"price": UiWords.money(plan["cost"])}), "kind": "primary", "disabled": not can_resume, "pressed": session.sold_out_resume},
		{"label": _t("soldout.finish"), "pressed": session.sold_out_finish},
	])


## A guest in line asks what to order: what they are in the mood for, and each dish's flavors.
static func recommend(dialogs: PaperDialogs, session: CoreGameSession, guest: Dictionary, options: Array) -> void:
	var state := session.state
	var taste := CoreFlavors.guest_taste(guest)
	var quote := Paper.card("soft")
	quote.add_child(Paper.words(_t("moment.recommend.ask", {"want": _t("moment.want.%s" % taste["liked"]), "avoid": _t("moment.avoid.%s" % taste["avoided"])})))
	var body := Paper.col([quote])
	for id: String in options:
		var flavors := CoreFlavors.item_flavors(id).map(func(f: String) -> String: return _t("moment.flavor.%s" % f))
		body.add_child(Paper.multi([
			[_t("memory.keepOrder" if id == guest["order"] else "memory.tryInstead"), "small"], [I18n.item_name(id, state), "strong"], [" · ".join(PackedStringArray(flavors)), "muted"],
			[_t("memory.optionDetail", {"price": CoreFormat.format_account_money(CoreEconomy.sale_price(state, id)), "seconds": UiWords.fixed(CoreEconomy.prep_time(state, id), 1)}), "small"],
		], Paper.art("fx/item-%s" % id, 40.0), func() -> void:
			dialogs.close()
			session.answer_recommendation(id)))
	body.add_child(Paper.words(_t("moment.recommend.note"), "muted"))
	if not CoreEconomy.is_bakery(guest["order"]) and guest.get("appearanceId") is float and CoreGuestMemories.memory_guest(guest["appearanceId"]):
		body.add_child(Paper.words(_t("memory.recommendNote"), "muted"))
	dialogs.show_dialog(_t("moment.recommend.title"), body, [{"label": _t("moment.recommend.skip"), "pressed": session.answer_recommendation.bind(null)}], {"back": func() -> void:
		dialogs.close()
		session.answer_recommendation(null)})


## One useful action is immediate; only genuine choices interrupt the room.
static func service_help(dialogs: PaperDialogs, session: CoreGameSession) -> bool:
	if not session.service_help_allowed():
		return false
	var options := session.service_help_options()
	var perform := func(option: Dictionary) -> bool:
		if not session.service_help_allowed():
			return false
		if session.perform_help(option):
			return true
		dialogs.note(_t("flow.helpUnavailable"))
		return false
	if not session.sim.help_ready():
		dialogs.note(_t("flow.helpCooldown"))
		return false
	if options.is_empty():
		dialogs.note(_t("flow.helpEmpty"))
		return false
	if options.size() == 1:
		return perform.call(options[0])
	var body := Paper.col([Paper.words(_t("flow.helpDetail"), "muted")])
	for option: Dictionary in options:
		var portrait: Control = null
		if option.has("customerId"):
			for c: Dictionary in session.sim.customers:
				if c["id"] == option["customerId"]:
					portrait = Portraits.guest(c["appearanceId"] if c.get("appearanceId") is float else c["id"], 44.0)
		body.add_child(Paper.multi([[option["title"], "strong"], [option["detail"], "muted"]], portrait, func() -> void:
			dialogs.close()
			perform.call(option)))
	dialogs.show_dialog(_t("flow.helpTitle"), body, [{"label": _t("flow.helpCancel")}])
	return true
