extends SceneTree

## Runs N seeds of the B0 GDScript simulation with the starter Day 1 config
## and outputs a single JSON line `BASELINE_JSON:{...}` for comparison against TS Sim.

func _init() -> void:
	call_deferred("_run")


func _run() -> void:
	var count := 20
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--seeds="):
			count = int(a.substr(8))

	var data := GameData.new()
	var results: Array[Dictionary] = []
	var served_sum := 0.0
	var rev_sum := 0.0

	for seed_val in range(1, count + 1):
		var state := CafeState.new(data)
		var sim := CafeSim.new(data, state, seed_val)
		state.open_shop()
		var reports: Array[Dictionary] = []
		sim.day_finished.connect(func(r: Dictionary) -> void: reports.append(r))
		var ticks := 0
		while state.phase != "prep" and ticks < 12000:
			sim.step_fixed(0.05)
			ticks += 1
		var report: Dictionary = reports[0] if not reports.is_empty() else sim.close_shop_now()
		var served := int(report.get("served", 0))
		var rev := float(report.get("revenue", 0.0))
		served_sum += float(served)
		rev_sum += rev
		results.append({"seed": seed_val, "served": served, "revenue": snappedf(rev, 0.01)})

	var summary := {
		"seeds": count,
		"servedMean": snappedf(served_sum / float(count), 0.01),
		"revenueMean": snappedf(rev_sum / float(count), 0.01),
		"runs": results,
	}
	print("BASELINE_JSON:" + JSON.stringify(summary))
	quit(0)
