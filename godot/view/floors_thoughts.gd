class_name FloorsThoughts
extends RefCounted

## What guests and staff think, in words, in a paper bubble over whoever thinks it. Port of floors-thoughts.ts; what is
## thought, and when, is in FloorsThinking.

const _SIZE := 46.0
const _WRAP := 470.0
const _INK := Color8(0x4f, 0x3b, 0x2f)
## Who is thinking aloud now ("customer:7", "barista:0"): the picture over their head makes way.
var speaking: Dictionary = {}
var _scene: FloorsScene
var _pacing := FloorsThinking.Pacing.new()
## {"key", "box", "size"} by who.
var _shown: Dictionary = {}


func _init(scene: FloorsScene) -> void:
	_scene = scene


func update(dt: float, s: Dictionary, enabled: bool) -> void:
	var rect := _scene.view()
	var view := {"x": float(rect.position.x), "y": float(rect.position.y), "w": float(rect.size.x), "h": float(rect.size.y)}
	var candidates := FloorsThinking.candidates(_scene.sim(), s)
	# A guest's answer to the player speaks at once.
	var reply: Variant = _scene.feed.moment_reaction
	if reply != null and _scene.sim().customers.any(func(c: Dictionary) -> bool: return c["id"] == reply["customerId"]):
		var id := "customer:%d" % int(reply["customerId"])
		candidates = candidates.filter(func(c: Dictionary) -> bool: return c["id"] != id)
		candidates.append({"id": id, "key": reply["key"], "x": 0.0, "y": 0.0, "priority": FloorsThinking.URGENT, "context": reply["context"]})
	var moment: Variant = _scene.feed.moment
	var open := FloorsThinking.showable(candidates, _scene.thinker, view, moment.get("customerId") if moment != null else null)
	var selected := _pacing.update(dt, "building", enabled and s["phase"] == "open" and not _scene.session.hidden, open)
	speaking.clear()
	for thought: Dictionary in selected:
		speaking[thought["id"]] = true
		_say(thought)
	for id: String in _shown.keys():
		if speaking.has(id):
			continue
		var box: FloorsBubble = _shown[id]["box"]
		_shown.erase(id)
		var tween := _scene.create_tween()
		tween.tween_property(box, "modulate:a", 0.0, 0.16)
		tween.tween_callback(box.queue_free)


func _say(thought: Dictionary) -> void:
	var id: String = thought["id"]
	if _shown.has(id) and _shown[id]["key"] != thought["key"]:
		_shown[id]["box"].queue_free()
		_shown.erase(id)
	if not _shown.has(id):
		var box := FloorsBubble.new(_scene.session.translate.call(thought["key"], {}), _SIZE, _WRAP, _INK)
		_scene.add_child(box)
		box.modulate.a = 0.0
		_scene.create_tween().tween_property(box, "modulate:a", 1.0, 0.16)
		_shown[id] = {"key": thought["key"], "box": box}
	# The bubble keeps inside the building; its dots always lead to the head.
	var bubble: FloorsBubble = _shown[id]["box"]
	var size := bubble.extent
	var x := clampf(thought["x"], 96.0 + size.x / 2.0, FloorsLayout.WORLD_W - 96.0 - size.x / 2.0)
	bubble.put(Vector2(x, thought["y"] - 44.0 - size.y / 2.0), thought["x"] - x)
