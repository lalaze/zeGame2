# New generated asset samples: integration brief

Latest user direction: create new image assets matching the supplied fine pixel pseudo-3D reference before further code-painted refinements. The dimensions below are current integration bounds, not a requirement to generate tiny images or preserve the old simplified style. Generate detailed source art first; compare its reduced game-size appearance before accepting it.

## Shared view / files
- Reference: image(6).png, Library libfile_64c6d0b0212c81918aa7bd1d03e58955. Warm walnut, cream, brass, red gingham; elevated front view showing tops plus front faces, shallow side faces. It is fine pixel illustration, not smooth low-poly/clay.
- Main logical world320×240. Current fine backing640×480; density metadata can support higher source raster without changing gameplay geometry. Transparent PNG per independent object; alpha exterior genuinely transparent. No labels, grid, contact sheet borders or premultiplied dark fringes in production sprite files.
- Consistent warm upper-left/window key light, darker right/under surfaces and soft foot/contact shade. Do not bake a full floor, other furniture, people or long room-wide sunbeam into movable objects. Keep room daylight/night grade separate.
- Image samples may be larger than final bounds. Preserve source and a clear asset manifest with canvas size, alpha bounds, intended logical size, foot/attachment anchor and facing. Padding is allowed if its anchor is documented.

## First sample families and current anchors
| Asset | Current logical bounds / anchor | Required separation |
|---|---|---|
| Walnut counter | Main slab x64..234, top96, front107, bottom127; body170×31; optional taller hardware separate | Empty structural counter, espresso machine, pastry glass overlay, food and small props separate. No staff baked into counter. |
| Rear walnut cabinet | x72..254, top57/front63/bottom80;182×23 | Cabinet versus jars/bread/cake/cups separate; menu board and text remain independent. Side cupboard footprint40×28. |
| Table |33×27; sprite foot center(16,26); tabletop center(16,7). Current fine66×54 | Tablecloth/pedestal alone. Vase, meals, cups, seated people and chairs separate. Left/right chairs15×26 each, fine30×52. |
| Character | Standing18×28, foot baseline28, center x9; seated18×26; petting18×34 | First sample standing front and seated right of SAME identity; then back/side/walk. Four facing×3 stand/step frames, two sits and pet variants later. Sitting uses upper-body crop at logical20px and table/chair depth; keep complete uncropped source. |
| Door potted plant |16×23; center x8, floor contact y22; current32×46 | Pot/plant alone, transparent exterior. Ground shadow independently composited. Movable plants later may have different bounds. |
| Counter trailing plant |15×34 at x62,y84 | Pot+foliage/vines only; no countertop/floor. |

## Stateful and interaction constraints
- Keep simulation collision, seat/foot positions, furniture IDs, saved col/row and movement routes. Change display bounds/padding through explicit anchor metadata rather than moving game objects to match a baked composition.
- Counter cake display: x148..220,72 logical px wide; real stock/menu icons must remain dynamic. Decorative rear cake can be separate static prop, but must not imply sellable inventory.
- Main x projection is a reversible presentation-only convergence. Floor uses ground mapping; upright rear wall/cabinets anchor at y80, side cupboards108, main counter127. Do not pre-distort assets with a second inconsistent perspective. Final mapping and pickup/touch tests happen in engine.
- Painter/sprite caches are per fixed asset or texture-manager. No per-frame image decoding. Pooled images reset scale/crop/flip/alpha; high-resolution sprites carry density and logical crop conversion.
- Initial samples are art proposals, not actual-game screenshots. Main desktop and390 appearance must be checked after replacing current assets; only then expand all rooms/catalogs/animations. Current source checkpoint is Library libfile_8fa08daa6afc8191bc692cff8f814f38.
