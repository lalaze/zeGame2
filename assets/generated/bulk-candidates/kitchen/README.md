# Tiny Bean Café — 18 kitchen body candidates

All 18 requested static modules are generated and packaged as independent lossless RGBA crops. They are generation candidates, not runtime-approved replacements. No repository code was changed and no integration was attempted.

## Contents

cooler, dryStore, handSink, mixer, proofer, kettle, deckOven, convection, fryer, hood, bench, sheeter, standMixer, rack, pastryFridge, bins, dishPit, hookup.

The three original six-module sheets are immutable. hood-correction-source.png replaces the first hood candidate with a shallower, wider version. Exact prompts and specs.json are retained. renderer-manifest.json is the source of truth for crop rectangles, dimensions, alpha>128 boxes, semantic support/mount anchors, logical envelopes, native aspect, uniform contained scales, overlay requirements and attachment/stock geometry.

All visual content was authored with built-in image_gen. Python performed only lossless cropping, measurements, hashing and source-pixel comparison. No recoloring, alpha cleanup, pixel repainting or image distortion was used. RGB behind alpha zero remains untouched and is not a visible backdrop. Some faint nonzero-alpha fringe remains as generated.

## Layer and installation contract

The bodies are empty and switched off. Food, ingredients, stock, quantity labels, display text, water, boiling bubbles, steam, heat glow and status lamps remain runtime layers. Rack, pantry, proofing cabinet, pastry fridge and bench shelves have no stock baked in. Prep island has no food or tabletop tools; sheeter and standMixer are independent objects.

Moving solid parts are explicitly reused from existing runtime drawings: industrial mixer spiral hook/shaft, stand-mixer beater/shaft, convection fan blades and cooler active door-gap representation. Each applicable body lists overlayRequired and estimated placement geometry. Bodies alone do not establish complete animated geometry or correct occlusion. In particular, the cooler's closed opaque door needs a validated active opening/covering solution; the new source's hinges differ from the old tiny drawing. Do not simply place an old gap at an assumed coordinate.

hookup.png is the capped pipe/socket module for uninstalled equipment. Installed state hides this layer, so no blank installed-state bitmap is needed. The locked room must not render working equipment bodies.

## Honest geometry gaps

All PNGs are complete candidate objects, but several source aspect ratios differ by more than25% from their legacy logical envelope: cooler, dryStore, handSink, mixer, proofer, kettle, deckOven and hood. The manifest provides uniform contained fits and height at requested logical width; do not squeeze their width/height independently. Integration must choose a reviewed uniform fit or request improved proportions without changing collision footprints.

The corrected hood has native aspect approximately4.72, versus target154:23 (6.70). At154world-pixel width, it would be32.6px tall, approximately9.6px over the23px envelope. Uniform contained fit keeps it23px tall but only108.6px wide. This remains a specific pending aspect/overflow review, not an accepted full-width hot-line replacement.

## Validation performed

18 unique output hashes; exact pixel equality with every selected source rectangle; transparent-alpha presence; source/crop visual review for independent complete equipment, empty inventory, absent mixer moving shafts/fan blades and unlit controls. Crops use measured sheet regions, including narrow pantry/proofer gutter and disconnected handSink dispensers/hookup pieces. validation.json records these checks.

Next-stage checks remain: world and thumbnail proportions, unchanged footprints/occlusion/routes, native-aspect fit, all dynamic overlay placement/order, stock slot coordinates, operating/idle transitions, installed/uninstalled/locked gating, and game-scale readability. Only after the requested commit/push checkpoint should those integration checks begin.
