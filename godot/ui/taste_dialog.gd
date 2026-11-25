class_name TasteDialog
extends RefCounted

## A dish's taste and its research (src/ui/taste.ts).


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func label(state: Dictionary, id: String) -> String:
	return _t("taste.label", {"score": UiWords.fixed(CoreTaste.taste_score(state, id), 1), "tier": _t("taste.tier.%s" % CoreTaste.taste_tier(state, id))})


static func progress(state: Dictionary, id: String) -> String:
	var tier := CoreTaste.taste_tier(state, id)
	var sold: float = state["taste"]["served"].get(id, 0.0)
	if tier == "signature":
		return _t("taste.mastered")
	if sold >= CoreTaste.SIGNATURE_SERVINGS:
		return _t("taste.ready")
	return _t("taste.progressSkilled" if tier == "standard" else "taste.progressSignature", {"n": sold, "target": CoreTaste.SKILLED_SERVINGS if tier == "standard" else CoreTaste.SIGNATURE_SERVINGS})


static func show_taste(dialogs: PaperDialogs, session: CoreGameSession, id: String, researched: Callable) -> void:
	var state := session.state
	var block: Variant = CoreTaste.research_block(state, id)
	var item := I18n.item_name(id, state)
	var overview := Paper.card("row")
	overview.add_child(Paper.col([Paper.words(label(state, id), "strong"), Paper.words(progress(state, id), "muted")], 2))
	var body := Paper.col([overview, Paper.words(_t("taste.sold", {"n": state["taste"]["served"].get(id, 0.0)}))])
	for tier: String in ["standard", "skilled", "signature"]:
		body.add_child(Paper.words(_t("taste.%s" % tier)))
	body.add_child(Paper.words(_t("taste.rules"), "muted"))
	body.add_child(Paper.words(_t("taste.costRule"), "muted"))
	if block != null:
		body.add_child(Paper.words(_t("taste.block.%s" % block), "muted"))
	dialogs.show_dialog(_t("taste.title", {"item": item}), body, [
		{"label": _t("settings.back")},
		{"label": _t("taste.mastered") if block is String and block == "owned" else _t("taste.research", {"price": UiWords.money(CoreTaste.signature_cost(id))}), "kind": "primary", "disabled": block != null, "pressed": func() -> void:
			if CoreTaste.research_signature(state, id):
				researched.call()
				dialogs.note(_t("taste.researched", {"item": item}))},
	])
