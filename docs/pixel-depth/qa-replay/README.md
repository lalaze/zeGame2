# Mina and cat component replay

This independent page runs the actual `CafeGame` / `CafeScene`, `CafeView`, `Sim`,
and `LivingCats`. It imports the synthetic main-art source fixture directly into
its bundle. It never loads the player application entry, `SaveSession`, browser
storage, or a service worker. The visible page label always says:

> Synthetic seeded component replay, not live player save

## Build and install

From the repository root:

```sh
npx vitest run docs/pixel-depth/qa-replay/replay-model.test.ts
node docs/pixel-depth/build-qa-replay.mjs
```

The separate build uses `configFile: false`, `publicDir: false`, `base: '/'`, and
`emptyOutDir: false`. Output is staged under `docs/pixel-depth/replay-dist`, whose
generated files are locally ignored. No existing production output is deleted.
The large PNG source tree is not copied. Current runtime images are requested
from the existing server's `/art/generated/` paths by the production loader.

After any normal `npm run build` has finished, install this entry with:

```sh
node docs/pixel-depth/build-qa-replay.mjs --publish
```

That copies only its entry and isolated assets to `dist/qa-replay`. A later normal
production build clears `dist`, so rerun the command afterward. On the existing
QA server, the entry is `/qa-replay/?qa-light=10`.

The source and build recipe are the deliverable. Do not include the staging
bundle in a source checkpoint. The approximately 1.9 MB JS bundle includes the
real Phaser renderer; there is no substitute hand-drawn screenshot canvas.

## Reproducible controls

- Seated idle: seed 52 simulation plus seed 694 Siamese engine, 177 updates.
- Pet A: the same engines, 300 updates. Cat response elapsed is exactly zero.
- Pet B: 313 updates. Response elapsed is 0.65 seconds, selecting the real second
  petting frame.
- Step +0.05: advances both existing engines normally once.
- Run / Pause: uses the same fixed-step simulation; Mina can naturally leave.
- Reset: reseeds and replays both engines, rather than assigning customer timers,
  actor coordinates, interactions, animation frames, or private guest bindings.
- Reduced-motion pose: an explicit QA-only preference on this scene. It exercises
  the production `still` branch, which forces Pet A. The browser/OS preference is
  not altered or saved.

At every stop, the renderer is unchanged. Simulation freezing is implemented in
the QA tick hook, not by setting `view.paused`, because the latter intentionally
forces the first pet frame. Ambient renderer effects can continue to animate.
Pointer actions are disabled so screenshots cannot accidentally boost or change
the seeded economic state. The component reports both generated-adapter ready
flags; a false Mina flag means the screenshot is showing normal fallback art and
must not be described as generated-Mina validation.

The main scene is always 320×240 logical units with the same fixed geometry and a
4× drawing buffer. CSS fitting keeps the entire room visible on smaller windows
without changing simulation coordinates. Head, arm, table, and cat layering all
come from the real scene, not a custom QA painter.

## Validation boundary

Five focused tests check all three natural stops, valid snapshots, no shortages,
deterministic reset of state and cast, and stepping to Pet B without replacing the
interaction object. The standalone TypeScript entry is also checked separately:

```sh
npx tsc --ignoreConfig --noEmit --strict --skipLibCheck --target ES2022 \
  --module ESNext --moduleResolution bundler --resolveJsonModule \
  --allowSyntheticDefaultImports --lib ES2022,DOM,DOM.Iterable \
  --types vite/client docs/pixel-depth/qa-replay/main.ts \
  docs/pixel-depth/qa-replay/replay-model.test.ts
```

Build/tests prove the fixture and code path, not final browser pixels. Visual
approval still requires opening this clearly labeled component page and checking
actual hands, cat contact, table occlusion, and the generated-adapter status.
