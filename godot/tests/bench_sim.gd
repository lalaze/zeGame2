extends SceneTree

## How long one simulation step takes in the busiest cafés, and one step of the cats and moments beside it:
## `-- --dir=<a folder of lockstep runs>`. Fails when a step is too slow for a phone's frame.

const MEAN_MS := 1.0
const P99_MS := 4.0


func _init() -> void:
	var dir := ""
	for arg in OS.get_cmdline_user_args():
		dir = arg.trim_prefix("--dir=")
	var sim_times: Array[float] = []
	var cat_times: Array[float] = []
	var save_times: Array[float] = []
	var people := 0
	for file in DirAccess.get_files_at(dir):
		if not file.begins_with("late"):
			continue
		var f := FileAccess.open(dir.path_join(file), FileAccess.READ)
		var start: Dictionary = JSON.parse_string(f.get_line())
		var wire := ParityWire.new()
		var state: Dictionary = wire.value(start["state"])
		var rng := ParityCompare.CountedRng.new(int(start["seed"]))
		CoreLayout.reset_layout_state()
		CoreLayout.set_scene_height(wire.value(start["height"]))
		CoreDay.open_shop(state)
		var sim := CoreSim.new(rng.next_float)
		var cats := CoreLivingCats.new(rng.next_float)
		var moments := CoreMoments.MomentDirector.new(rng.next_float)
		for id: String in ["ginger", "tuxedo", "calico"]:
			state["pets"].append({"id": id, "careSeconds": 900.0, "autoRefill": true})
		for i in 6000:
			var t := Time.get_ticks_usec()
			sim.update(state, 0.05)
			sim_times.append((Time.get_ticks_usec() - t) / 1000.0)
			t = Time.get_ticks_usec()
			moments.update(state, sim, 0.05, 0.05)
			cats.update(state, 0.05, sim.customers, sim.servers)
			cat_times.append((Time.get_ticks_usec() - t) / 1000.0)
			if i % 100 == 99:
				t = Time.get_ticks_usec()
				var payload := state.duplicate(false)
				payload["runtime"] = sim.snapshot(state)
				CoreState.serialize(payload)
				save_times.append((Time.get_ticks_usec() - t) / 1000.0)
			people = maxi(people, sim.customers.size() + sim.servers.size() + sim.cooks.size() + sim.baristas.size())
			if state["phase"] == "closing" and sim.finished_service():
				break
	var fast := _report("SIM_BENCH", sim_times, people)
	_report("CATS_BENCH", cat_times, people)
	_report("SAVE_BENCH", save_times, people)
	quit(0 if fast else 1)


func _report(label: String, times: Array[float], people: int) -> bool:
	if times.is_empty():
		return false
	times.sort()
	var sum := 0.0
	for t in times:
		sum += t
	var mean := sum / times.size()
	var p99 := times[int(times.size() * 0.99)]
	print("%s steps=%d mean=%.3f ms p50=%.3f p95=%.3f p99=%.3f max=%.2f most_people=%d" % [label, times.size(), mean, times[times.size() / 2], times[int(times.size() * 0.95)], p99, times[-1], people])
	return mean <= MEAN_MS and p99 <= P99_MS and people >= 30
