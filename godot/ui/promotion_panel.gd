class_name PromotionPanel
extends RefCounted

## Promotion campaigns (src/ui/promotion.ts): Direction A sky-tinted summary card, active campaign card,
## rules fold, platform section headers, and compact upgrade-row-style plan cards.

var _session: CoreGameSession
var _summary := Paper.words("", "strong")
var _pressure := Paper.words("", "small")
var _capped_badge: PanelContainer
var _active := Paper.panel(Paper.cached_box(Paper.SAGE_SOFT, Color8(0xb5, 0xca, 0xb0), 2, 14, Vector2(12, 10)))
var _active_name := Paper.words("", "h3")
var _active_status := Paper.words("", "small")
var _progress := Paper.progress_a(0.0, 6.0, Paper.SAGE_A, Paper.TRACK_A)
var _pause: Button
var _rows: Array = []


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


func _init(root: VBoxContainer, session: CoreGameSession, changed: Callable) -> void:
	_session = session
	# Compact sky-tinted summary card: today's cost, pressure, conditional red traffic-capped badge.
	_summary.add_theme_font_override("font", Paper.font(800))
	_summary.add_theme_font_size_override("font_size", 13)
	_summary.add_theme_color_override("font_color", Paper.INK_A)
	_pressure.add_theme_font_size_override("font_size", 11)
	_pressure.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var cap_lbl := Paper.words(_t("promo.cappedBadge"), "tiny", false)
	cap_lbl.add_theme_font_override("font", Paper.font(800))
	cap_lbl.add_theme_font_size_override("font_size", 11)
	cap_lbl.add_theme_color_override("font_color", Paper.BADGE_INK)
	_capped_badge = Paper.panel(Paper.cached_box(Paper.BADGE_BG, Color8(0xe3, 0xa7, 0x9c), 1, 8, Vector2(8, 2)))
	_capped_badge.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	_capped_badge.add_child(cap_lbl)
	_capped_badge.visible = false
	var sum_card := Paper.panel(Paper.cached_box(Paper.SKY_BG, Paper.SKY_EDGE, 2, 14, Vector2(12, 9)))
	sum_card.add_child(Paper.col([_summary, _pressure, _capped_badge], 4))
	root.add_child(sum_card)

	# Active campaign card directly under summary.
	_active_name.add_theme_font_size_override("font_size", 14)
	_active_name.add_theme_color_override("font_color", Paper.INK_A)
	_active_status.add_theme_color_override("font_color", Paper.INK_LIGHT)
	_pause = Paper.button("", "ghost", func() -> void:
		if CorePromotion.toggle_promotion(session.state):
			changed.call())
	_active.add_child(Paper.col([_active_name, _active_status, _progress, _pause], 6))
	root.add_child(_active)

	# Rules disclosure fold (holds former title, intro, red risk notice, and rules).
	var help_title := Paper.words(_t("promo.title"), "strong")
	help_title.add_theme_font_size_override("font_size", 12)
	help_title.add_theme_color_override("font_color", Paper.INK_A)
	var help_intro := Paper.words(_t("promo.intro"), "small")
	help_intro.add_theme_color_override("font_color", Paper.INK_LIGHT)
	var help_risk := Paper.words(_t("promo.risk"), "small")
	help_risk.add_theme_color_override("font_color", Paper.DANGER)
	var help_rules := Paper.words(_t("promo.rules"), "small")
	help_rules.add_theme_color_override("font_color", Paper.INK_LIGHT)
	root.add_child(Paper.help_fold(_t("promo.rulesTitle"), Paper.col([help_title, help_intro, help_risk, help_rules], 4)))

	var before := ""
	for plan: Dictionary in CorePromotion.PROMOTION_PLANS:
		var platform: String = plan["platform"]
		if platform != before:
			before = platform
			var p_name := Paper.words(_t("promo.platform.%s" % platform), "strong", false)
			p_name.add_theme_font_override("font", Paper.font(800))
			p_name.add_theme_font_size_override("font_size", 13)
			p_name.add_theme_color_override("font_color", Paper.INK_A)
			var p_desc := Paper.words(_t("promo.platform.%s.desc" % platform), "tiny")
			p_desc.add_theme_font_size_override("font_size", 10)
			p_desc.add_theme_color_override("font_color", Paper.INK_LIGHT)
			var seam_line := PaperSeam.new(Paper.SEAM_A)
			seam_line.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			seam_line.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			var name_row := Paper.line([p_name, seam_line], 6)
			name_row.alignment = BoxContainer.ALIGNMENT_CENTER
			var p_text := Paper.col([name_row, p_desc], 1)
			p_text.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			var header := Paper.line([Portraits.icon("promo:%s" % platform, 28.0), p_text], 7)
			header.alignment = BoxContainer.ALIGNMENT_CENTER
			root.add_child(header)

		var plan_name := Paper.words(_t("promo.%s" % plan["id"]), "strong")
		plan_name.add_theme_font_override("font", Paper.font(800))
		plan_name.add_theme_font_size_override("font_size", 14)
		plan_name.add_theme_color_override("font_color", Paper.INK_A)
		var offer_lbl := Paper.fitting(_t("promo.offer", {"pct": JsMath.js_round(plan["boost"] * 100.0), "hours": plan["seconds"] / CoreBusinessClock.SECONDS_PER_BUSINESS_HOUR}), "tiny", 178.0)
		offer_lbl.add_theme_font_override("font", Paper.font(800))
		offer_lbl.add_theme_font_size_override("font_size", 11)
		offer_lbl.add_theme_color_override("font_color", Paper.CARD_PRICE)
		var offer_pill := Paper.panel(Paper.cached_box(Paper.PILL_BG, Color.TRANSPARENT, 0, 8, Vector2(7, 2)))
		offer_pill.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		offer_pill.add_child(offer_lbl)
		var estimate := Paper.words("", "small")
		estimate.add_theme_font_size_override("font_size", 11)
		estimate.add_theme_color_override("font_color", Paper.INK_LIGHT)
		var book := Paper.two_line_buy(func() -> void:
			if CorePromotion.book_promotion(session.state, plan["id"]):
				changed.call(), 80.0)
		var left := Paper.col([plan_name, offer_pill, estimate], 3)
		var top_row := Paper.line([left, book], 8)
		top_row.alignment = BoxContainer.ALIGNMENT_CENTER
		var risk_lbl := Paper.words("", "small")
		risk_lbl.add_theme_font_size_override("font_size", 11)
		var unavail_lbl := Paper.words("", "small")
		unavail_lbl.add_theme_font_size_override("font_size", 11)
		unavail_lbl.add_theme_color_override("font_color", Paper.DANGER)
		var card := Paper.panel(Paper.card_a_box(Paper.CARD_BORDER, Color.WHITE, Vector2(10, 8)))
		card.add_child(Paper.col([top_row, PaperSeam.new(Color8(0xef, 0xe2, 0xcc)), risk_lbl, unavail_lbl], 4))
		root.add_child(card)
		_rows.append({"plan": plan, "button": book, "estimate": estimate, "risk": risk_lbl, "unavailable": unavail_lbl})


func update() -> void:
	var s := _session.state
	var campaign: Variant = s["promotion"]
	# Rates are guests per business day, the same unit as the opening forecast.
	var base := CoreEconomy.base_arrival_rate(s) * CoreData.DAY_SECONDS
	var base_demand := CoreEconomy.base_traffic_demand(s)
	var cap := CoreEconomy.arrival_cap(s)
	var capped := CoreEconomy.is_traffic_capped(s)
	var capacity := CoreEconomy.service_capacity(s) * CoreData.DAY_SECONDS
	var menu := CoreEconomy.menu_items(s)
	var base_capped := not menu.is_empty() and base_demand >= cap
	var empty_stock := menu.any(func(m: Dictionary) -> bool: return CoreEconomy.servings_left(s, m["id"]) < 1.0)
	_summary.text = _t("promo.summary", {"cost": CoreFormat.format_account_money(s["today"]["promotionCost"])})
	_pressure.text = _t("promo.pressureCapped" if capped else "promo.pressure", {"arrivals": JsMath.js_round(CoreEconomy.arrival_rate(s) * CoreData.DAY_SECONDS), "capacity": JsMath.js_round(capacity)})
	_capped_badge.visible = capped
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
		var boosted: float = JsMath.js_min(base_demand * (1.0 + plan["boost"]), cap) * CoreData.DAY_SECONDS
		row["estimate"].text = _t("promo.estimate", {"before": JsMath.js_round(base), "after": JsMath.js_round(boosted)})
		var risk := "noMenu" if menu.is_empty() else ("stock" if empty_stock else ("capped" if base_capped else ("overload" if boosted > capacity else ("busy" if boosted > capacity * 0.85 else "headroom"))))
		row["risk"].text = _t("promo.%s" % risk)
		row["risk"].add_theme_color_override("font_color", Paper.INK_LIGHT if risk == "headroom" else Paper.DANGER)
		var enabled: bool = campaign == null and s["phase"] != "closing" and not menu.is_empty() and s["coins"] >= plan["cost"]
		Paper.set_two_line_buy(row["button"], _t("promo.bookShort"), UiWords.money(plan["cost"]), enabled)
		Paper.say(row["unavailable"], _t("promo.oneAtATime") if campaign != null else (_t("promo.closing") if s["phase"] == "closing" else (_t("promo.insufficient") if s["coins"] < plan["cost"] else "")))
