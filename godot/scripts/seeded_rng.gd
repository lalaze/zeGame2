class_name SeededRng
extends RefCounted

## Deterministic 32-bit LCG matching scripts/balance.test.ts:
## n = (n * 1664525 + 1013904223) >>> 0; return n / 2**32.

var _state: int = 1


func _init(seed_value: int = 1) -> void:
	_state = seed_value & 0xFFFFFFFF


func next_float() -> float:
	_state = (_state * 1664525 + 1013904223) & 0xFFFFFFFF
	return float(_state) / 4294967296.0


func next_int(bound: int) -> int:
	if bound <= 0:
		return 0
	return int(floor(next_float() * float(bound)))
