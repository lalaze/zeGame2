class_name LivingCatCard
extends RefCounted

## How a resident cat is (src/ui/living-cats.ts). Petting is only a fuss.


static func _t(key: String, params: Dictionary = {}) -> String:
	return I18n.t(key, params)


static func personality(pet: Dictionary) -> String:
	return _t("pet.living.personality", {"personality": _t("pet.living.personality.%s" % CorePets.pet_preferences(pet)["personality"])})


static func preference(pet: Dictionary) -> String:
	var p := CorePets.pet_preferences(pet)
	return _t("pet.living.preference", {"area": _t("pet.living.area.%s" % p["preferredArea"]), "spot": _t("pet.living.spot.%s" % p["preferredSpot"])})


static func activity(actor: Variant) -> String:
	if actor == null:
		return _t("pet.living.settling")
	var meeting: Variant = actor["interaction"] if "interaction" in actor else null
	var behavior: String = actor["behavior"]
	var watching: bool = behavior == "watch" and ("targetKind" in actor) and actor["targetKind"] is String and actor["targetKind"] == "window"
	var action := _t("pet.living.interaction.%s" % meeting["phase"]) if meeting != null else _t("pet.living.action.%s" % ("window" if watching else behavior))
	var fond: Variant = actor["affection"] if "affection" in actor else 0.0
	return _t("pet.living.activity", {"area": _t("pet.living.area.%s" % actor["area"]), "action": action}) + (" · %s" % _t("pet.living.happy") if fond is float and fond > 0.0 else "")


static func show_cat(dialogs: PaperDialogs, pet: Dictionary, actor: Variant, fuss: Callable, locate: Callable) -> void:
	var active := CorePets.pet_active(pet)
	var portrait := Portraits.cat(pet["id"], 96.0)
	portrait.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var body := Paper.col([portrait])
	for text: String in [personality(pet), activity(actor), preference(pet), _t("pet.living.caredFor" if active else "pet.living.needsCare"), _t("pet.living.petHint")]:
		body.add_child(Paper.words(text))
	dialogs.show_dialog(_t("pet.%s.name" % pet["id"]), body, [
		{"label": _t("pet.living.pet"), "kind": "primary", "disabled": not active, "pressed": fuss},
		{"label": _t("pet.living.locate"), "pressed": locate},
		{"label": _t("pet.living.letRest")},
	])
