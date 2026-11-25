class_name FloorsDepth
extends RefCounted

## How deep things stand: people and furniture at the y of their feet, the rest in bands above and below. The bands keep
## the web view's order (src/render/floors).

const SKY := -10.0
const BEHIND := -9.5
const EARTH := -3.0
## Over everyone in the rooms, under the pillars, beams and front walls.
const SHADE := 16000.0
const GLOW := 16001.0
## Pillars and beams stand in front of everyone.
const FRAME := 20000.0
## The front walls stand in front of everyone inside, under the pillars, beams and awning.
const WALL := FRAME - 3.0
## In front of the building and the people on the street, under the bubbles and cues.
const FRONT := 28000.0
## The marks of arranging, then bubbles, then words.
const MARKS := 36000.0
const BUBBLE := 40000.0
## Godot takes two y's closer than a hundred-thousandth of themselves for the same and goes by the order of the nodes, so
## far from 0 the small steps between a bubble and what is in it would be lost. A depth is a z step and a small y.
const STEP := 16.0


## Stands a node of the scene at a depth; what it shows is moved back by its `position.y`.
static func stand(node: Node2D, depth: float) -> void:
	var z := floori(depth / STEP)
	if node.z_index != z:
		node.z_index = z
	node.position.y = depth - z * STEP
