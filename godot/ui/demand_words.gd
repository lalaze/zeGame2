class_name DemandWords
extends RefCounted

## Who comes and what they like (src/ui/customer-demand.ts).

const GUEST_COLORS := {
	"commuter": Color8(0xd8, 0xb2, 0x5a),
	"leisure": Color8(0xd9, 0x8a, 0x7a),
	"teaTime": Color8(0x8f, 0xb0, 0xcc),
}


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func kind(id: String) -> String:
	return _t("demand.kind.%s" % id)


static func _suits(coverage: float) -> String:
	return _t("demand.good" if coverage >= 0.8 else ("demand.some" if coverage >= 0.5 else "demand.limited"))


## Tilted yellow weather sticky note pinned to the chalkboard corner; null before guests have tastes.
static func sticky(s: Dictionary, narrow: bool = false) -> Control:
	if not CoreCustomerDemand.demand_enabled(s):
		return null
	var condition := CoreConditions.today_condition(s)
	var heading := _t("demand.title") if condition["id"] == "fair" else UiWords.condition_name(condition)
	var title_lbl := Paper.words(heading, "strong")
	title_lbl.add_theme_font_override("font", Paper.font(800))
	title_lbl.add_theme_font_size_override("font_size", 12 if narrow else 13)
	title_lbl.add_theme_color_override("font_color", Paper.INK_A)
	var hint_lbl := Paper.words(_t("demand.hint.%s" % condition["id"]))
	hint_lbl.add_theme_font_size_override("font_size", 10 if narrow else 11)
	hint_lbl.add_theme_color_override("font_color", Paper.NOTE_INK)
	var note := PaperChalkboard.StickyNote.new(narrow)
	note.add_child(Paper.col([title_lbl, hint_lbl], 2))
	return note


## Today's guests section on the chalkboard: heading, share bars, suitability summary, and tastes fold.
static func prep(s: Dictionary, items: Array, open: bool, turned: Callable, narrow: bool = false) -> Control:
	if not CoreCustomerDemand.demand_enabled(s):
		return null
	var plan := CoreCustomerDemand.demand_plan(s, items)
	var condition := CoreConditions.today_condition(s)
	var suited := plan["guests"].filter(func(g: Dictionary) -> bool: return g["coverage"] >= 0.8).map(func(g: Dictionary) -> String: return kind(g["kind"])) as Array
	var section := Paper.col([Paper.chalk_words(_t("prep.guestsTitle"), "strong")], 6)
	if not plan["guests"].is_empty():
		var bars := Paper.col([], 6)
		var is_zh := I18n.locale == "zh"
		var badge_max := 94.0 if narrow else (106.0 if is_zh else 128.0)
		for g: Dictionary in plan["guests"]:
			var pct := int(JsMath.js_round(g["share"] * 100.0))
			var ok: bool = g["coverage"] >= 0.8
			var name_lbl := Paper.chalk_words(kind(g["kind"]), "strong", false)
			name_lbl.add_theme_font_size_override("font_size", 11 if (narrow and not is_zh) else 12)
			if is_zh:
				name_lbl.custom_minimum_size.x = 52.0 if narrow else 60.0
			else:
				var name_w := 76.0 if narrow else 92.0
				if name_lbl.get_theme_font("font").get_string_size(name_lbl.text, HORIZONTAL_ALIGNMENT_LEFT, -1, name_lbl.get_theme_font_size("font_size")).x > name_w:
					name_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
					name_lbl.custom_minimum_size.x = name_w
			var bar_col: Color = GUEST_COLORS.get(g["kind"], Color8(0x9e, 0xc2, 0x96))
			var bar := Paper.progress_a(g["share"], 9.0, bar_col, Color(1.0, 1.0, 1.0, 0.12))
			bar.custom_minimum_size = Vector2(28.0, 9.0)
			bar.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			var pct_lbl := Paper.chalk_words("%d%%" % pct, "strong", false)
			pct_lbl.add_theme_font_override("font", Paper.font(800))
			pct_lbl.add_theme_font_size_override("font_size", 11 if narrow else 12)
			pct_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			pct_lbl.custom_minimum_size.x = 30.0 if narrow else 34.0
			var suit_text := _suits(g["coverage"])
			var badge_lbl := Paper.chalk_words(suit_text, "good" if ok else "muted", false)
			badge_lbl.add_theme_font_override("font", Paper.font(700))
			badge_lbl.add_theme_font_size_override("font_size", 10 if narrow else 11)
			badge_lbl.add_theme_color_override("font_color", Paper.CHALK_GOOD_INK if ok else Paper.CHALK_MUTED)
			badge_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			if badge_lbl.get_theme_font("font").get_string_size(suit_text, HORIZONTAL_ALIGNMENT_LEFT, -1, badge_lbl.get_theme_font_size("font_size")).x > badge_max:
				badge_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				badge_lbl.custom_minimum_size.x = badge_max
			var badge: PanelContainer
			if ok:
				badge = Paper.panel(Paper.cached_box(Color.TRANSPARENT, Paper.CHALK_GOOD, 1.5, 8.0, Vector2(6, 2)))
			else:
				badge = Paper.panel(Paper.cached_box(Color.TRANSPARENT, Color.TRANSPARENT, 0.0, 8.0, Vector2(6, 2)), Color(1.0, 1.0, 1.0, 0.4), 0.5, 8.0)
			badge.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			badge.add_child(badge_lbl)
			var row := Paper.line([name_lbl, bar, pct_lbl, badge], 6)
			row.alignment = BoxContainer.ALIGNMENT_CENTER
			bars.add_child(row)
		section.add_child(bars)
	section.add_child(Paper.chalk_words(_t("demand.empty") if items.is_empty() else (_t("demand.suited", {"groups": UiWords.join(suited)}) if not suited.is_empty() else _t("demand.limitedMenu")), "muted"))
	var details := Paper.col([Paper.chalk_words(_t("demand.explain"), "muted")], 6)
	for g: Dictionary in plan["guests"]:
		details.add_child(Paper.col([
			Paper.chalk_words(kind(g["kind"]), "strong"),
			Paper.chalk_words("%s · %s" % [_suits(g["coverage"]), _t("demand.share", {"pct": JsMath.js_round(g["share"] * 100.0)})], "small"),
			Paper.chalk_words(_t("demand.wants.%s" % g["kind"]), "muted"),
		], 2))
	for effect: String in UiWords.condition_effects(condition):
		details.add_child(Paper.chalk_words(effect, "muted"))
	details.add_child(Paper.chalk_words(_t("demand.forecastNote"), "muted"))
	section.add_child(Paper.chalk_fold(_t("demand.details"), Paper.padded(details, 6, 4, 6, 4), open, turned))
	return section


## Who a dish suits; "" without anyone.
static func dish(s: Dictionary, item: Dictionary) -> String:
	if not CoreCustomerDemand.demand_enabled(s):
		return ""
	var kinds := CoreCustomerDemand.GUEST_KINDS.filter(func(k: String) -> bool: return CoreCustomerDemand.guest_affinity(k, item) >= 0.8).map(kind)
	return _t("demand.dish", {"groups": UiWords.join(kinds)}) if not kinds.is_empty() else ""


## What to expect tomorrow, for the day's report: its heading and hint, or nothing.
static func tomorrow(s: Dictionary, day: float) -> Array:
	if not CoreCustomerDemand.demand_enabled({"day": day + 1.0}):
		return []
	return [_t("demand.tomorrow"), _t("demand.hint.%s" % CoreConditions.condition_on(s, day + 1.0))]


## What each kind of guest did today; null without any.
static func report(r: Dictionary) -> Control:
	var guests: Dictionary = r["guests"]
	var groups := CoreCustomerDemand.GUEST_KINDS.filter(func(k: String) -> bool: return guests[k]["arrived"] > 0.0)
	if groups.is_empty():
		return null
	var best: String = JsUtil.stable_sort(groups.duplicate(), func(a: String, b: String) -> float: return guests[b]["served"] - guests[a]["served"])[0]
	var details := Paper.col([], 6)
	for k: String in groups:
		var g: Dictionary = guests[k]
		details.add_child(Paper.words(kind(k), "strong"))
		details.add_child(Paper.words(_t("demand.results", {"arrived": g["arrived"], "served": g["served"], "paired": g["paired"], "money": CoreFormat.format_account_money(g["revenue"])})))
		if g["stockLost"] > 0.0 or g["waitLost"] > 0.0:
			details.add_child(Paper.words(_t("demand.losses", {"stock": g["stockLost"], "wait": g["waitLost"]}), "muted"))
		if g["cancelled"] > 0.0 or g["dismissed"] > 0.0:
			details.add_child(Paper.words(_t("demand.closed", {"cancelled": g["cancelled"], "dismissed": g["dismissed"]}), "muted"))
	details.add_child(Paper.words(_t("demand.observedOnly"), "muted"))
	return Paper.col([Paper.words(_t("demand.report"), "strong"), Paper.words(_t("demand.reportBest", {"group": kind(best), "n": guests[best]["served"]}) if guests[best]["served"] > 0.0 else _t("demand.noService")), Paper.fold(_t("demand.reportDetails"), details)], 6)
