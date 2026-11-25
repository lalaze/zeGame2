class_name PromotionPanel
extends RefCounted

## Promotion campaigns (src/ui/promotion.ts).

var _session: CoreGameSession
var _summary := Paper.words("")
var _pressure := Paper.words("", "muted")
var _active := Paper.card("sage")
var _active_name := Paper.words("", "h3")
var _active_status := Paper.words("")
var _progress := Paper.progress(0.0)
var _pause: Button
var _rows: Array = []


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _init(root: VBoxContainer, session: CoreGameSession, changed: Callable) -> void:
	_session = session
	var risk := Paper.words(_t("promo.risk"), "muted")
	risk.add_theme_color_override("font_color", Paper.DANGER)
	root.add_child(Paper.col([Paper.words(_t("promo.title"), "h3"), Paper.words(_t("promo.intro"), "muted"), _summary, _pressure, risk, Paper.fold(_t("promo.rulesTitle"), Paper.words(_t("promo.rules"), "muted"))], 8))
	_pause = Paper.button("", "ghost", func() -> void:
		if CorePromotion.toggle_promotion(session.state):
			changed.call())
	_active.add_child(Paper.col([_active_name, _active_status, _progress, _pause]))
	root.add_child(_active)
	var before := ""
	for plan: Dictionary in CorePromotion.PROMOTION_PLANS:
		var platform: String = plan["platform"]
		if platform != before:
			before = platform
			root.add_child(Paper.line([Portraits.icon("promo:%s" % platform, 40.0), Paper.col([Paper.words(_t("promo.platform.%s" % platform), "h3"), Paper.words(_t("promo.platform.%s.desc" % platform), "muted")], 2)]))
		var book := Paper.button(_t("promo.book", {"cost": UiWords.money(plan["cost"])}), "primary", func() -> void:
			if CorePromotion.book_promotion(session.state, plan["id"]):
				changed.call())
		var row := {"plan": plan, "button": book, "estimate": Paper.words("", "muted"), "risk": Paper.words("", "muted"), "unavailable": Paper.words("", "muted")}
		var card := Paper.card("row")
		card.add_child(Paper.col([Paper.words(_t("promo.%s" % plan["id"]), "strong"), Paper.words(_t("promo.offer", {"pct": JsMath.js_round(plan["boost"] * 100.0), "hours": plan["seconds"] / CoreBusinessClock.SECONDS_PER_BUSINESS_HOUR}), "good"), row["estimate"], row["risk"], row["unavailable"], book], 6))
		root.add_child(card)
		_rows.append(row)


func update() -> void:
	var s := _session.state
	var campaign: Variant = s["promotion"]
	# Rates are guests per business day, the same unit as the opening forecast.
	var base := CoreEconomy.base_arrival_rate(s) * CoreData.DAY_SECONDS
	var capacity := CoreEconomy.service_capacity(s) * CoreData.DAY_SECONDS
	var menu := CoreEconomy.menu_items(s)
	var empty_stock := menu.any(func(m: Dictionary) -> bool: return CoreEconomy.servings_left(s, m["id"]) < 1.0)
	_summary.text = _t("promo.summary", {"cost": CoreFormat.format_account_money(s["today"]["promotionCost"])})
	_pressure.text = _t("promo.pressure", {"arrivals": JsMath.js_round(CoreEconomy.arrival_rate(s) * CoreData.DAY_SECONDS), "capacity": JsMath.js_round(capacity)})
	_active.visible = campaign != null
	if campaign != null:
		var plan: Dictionary = CorePromotion.promotion_plan(campaign["id"])
		_active_name.text = "%s · %s" % [_t("promo.platform.%s" % plan["platform"]), _t("promo.%s" % plan["id"])]
		var status := _t("promo.paused" if campaign["paused"] else ("promo.running" if s["phase"] == "open" else "promo.waiting"))
		_active_status.text = _t("promo.active", {"status": status, "time": CoreFormat.format_duration(ceilf(CoreBusinessClock.business_seconds(campaign["remaining"])), I18n.t), "pct": JsMath.js_round(plan["boost"] * 100.0)})
		_progress.value = campaign["remaining"] / plan["seconds"]
		_pause.text = _t("promo.resume" if campaign["paused"] else "promo.pause")
	for row: Dictionary in _rows:
		var plan: Dictionary = row["plan"]
		var boosted: float = base * (1.0 + plan["boost"])
		row["estimate"].text = _t("promo.estimate", {"before": JsMath.js_round(base), "after": JsMath.js_round(boosted)})
		var risk := "noMenu" if menu.is_empty() else ("stock" if empty_stock else ("overload" if boosted > capacity else ("busy" if boosted > capacity * 0.85 else "headroom")))
		row["risk"].text = _t("promo.%s" % risk)
		row["risk"].add_theme_color_override("font_color", Paper.MUTED if risk == "headroom" else Paper.DANGER)
		row["button"].disabled = campaign != null or s["phase"] == "closing" or menu.is_empty() or s["coins"] < plan["cost"]
		Paper.say(row["unavailable"], _t("promo.oneAtATime") if campaign != null else (_t("promo.closing") if s["phase"] == "closing" else (_t("promo.insufficient") if s["coins"] < plan["cost"] else "")))
