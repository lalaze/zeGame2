# Generated asset integrity checkpoint

Audited 2026-10-13, 08:26 UTC. Read-only inspection of assets and game source;
this report is the only file written by this audit.

## Result

- **44/44 runtime PNGs pass exact source-crop RGBA comparison:** 7,566,381
  pixels, including RGB values hidden under zero alpha. No mismatches or
  unverifiable runtime PNGs.
- All 44 `GENERATED_MAIN_ASSETS` URLs are unique, exist under
  `public/art/generated`, and account for every runtime PNG there.
- All current runtime assets are recoverable from repository-archived original
  sheets and their recorded rectangular crop coordinates. No image resizing,
  recoloring, alpha modification, or pixel edits were performed by this audit.
- All 31 production files under `src/game` are byte-identical to stableFull.

## Crop coverage

Paths below are relative to `assets/generated`, except the main-v1 manifest.

| Runtime family | PNGs | Crop evidence | Archived originals |
| --- | ---: | --- | --- |
| main-v1 | 4 | `public/art/generated/main-v1/manifest.json`, `sourceRect` | Two `main-v1/sources/*sample-v1.png` sheets |
| main-v2 | 7 | `main-v2/asset-manifest.json`, `source_crop` | `pastry-production-sheet.png`, `seating-production-sheet.png`, `wide-display-source.png` |
| staff-v2 | 9 | `staff-v2/renderer-manifest.json`, `source_crop` | `staff-v2/owner-source.png` |
| customer-0-v1 | 15 | `customer-0-v1/renderer-manifest.json`, `source` + `source_crop` | `mina-walk-source.png`, `mina-seated-source.png` |
| service-v1 | 6 | `service-v1/manifest.json`, `crop_sheet_bbox_px`; `pickup-hutch-two-tier-manifest-v2.json`, `crop_source_bbox_px` | `tiny-bean-service-props-sheet-v1.png`, `pickup-hutch-two-tier-source-v2.png` |
| wall-v1 | 3 | `wall-v1/manifest.json`, `source_crop` | `wall-v1/wall-source.png` |

Method: Pillow decoded each source and output as RGBA; crop bounds were checked
against source dimensions, then output dimensions and every RGBA byte were
compared with `source.crop(box).tobytes()`. Main-v1 uses `(x, y, width, height)`;
the other boxes use `(left, top, right, bottom)`, with exclusive right/bottom.
Recorded source SHA-256 values were also verified where supplied.

**Additional archived outputs:** 17/17 passed the same exact comparison:
main-v1 full cabinet (1), main-v2 former empty pastry cabinet (1), service pickup
hutch v1 (1), staff-v1 barista frames (9), staff-v1 historical seated customers
(2), and archived wall cutouts (3). The previously omitted staff-v1 seated
source and two cutouts are now present and verified; these retired characters
remain outside the runtime registry.

## Checkpoint fingerprints

SHA-256 aggregate method: sort repository-relative PNG paths; concatenate
`path + NUL + sha256(payload) + LF` as UTF-8, then hash the result. File payload
means complete PNG bytes; RGBA payload means decoded RGBA bytes.

```text
runtime PNG file aggregate
a53f4a50615a37214b8a7ba1c0fec84c17ff6d1c91d5c4fe2bdbcadd5b1e5e7f
runtime decoded RGBA aggregate
5f94f4b74f05996b558d4e16ef7a9afc7f584aa711d676134aa17ea71206740e
```

Source-sheet file SHA-256 values (paths relative to `assets/generated`):

```text
customer-0-v1/mina-seated-source.png d13ddc4261cb0e8a4c8125d1b1a448cb485926acbceb9c66334dc6b4cd8416f2
customer-0-v1/mina-walk-source.png ca28163192a80b1ad3babd89773bc22ddc8ad00f8b95d3004f6d41efd42220fd
main-v1/sources/tiny-bean-characters-plants-sample-v1.png c1fd8d102e889003fdfb8cbe5f70a3bf8eeb5ea7cb1b8547452a8c4933061435
main-v1/sources/tiny-bean-furniture-sample-v1.png de0455009ce45dca677f7aa9a1296891d00f5a84a56feeeb148e3cf241515811
main-v2/pastry-production-sheet.png 630823abaf20b313a4fd04e60a77650e46844478485ed34d468d29ab03d24142
main-v2/seating-production-sheet.png 656989fc8f17e07dadb22df0d6c1c1916f17279a152487fe27e1523f1e65e3a5
main-v2/wide-display-source.png 050f9be4011e36459cfdaf2ce3759fb5f47a5d75411e6c0274d1959f98d4f3e6
service-v1/pickup-hutch-two-tier-source-v2.png 6f72442fc992f2af582138ee672aad3a490c089a8e490c262f9e62826b28afbd
service-v1/tiny-bean-service-props-sheet-v1.png 473db5c3293bd20468271cf89e94275e618b194e782cf7220fd35585b4ee5b87
staff-v2/owner-source.png f9baaf7639aff4dbe67c01177b770e12740e88dcf5e91f4ca932cc5793edcbd0
wall-v1/wall-source.png 9cf1776ada6630fed2f015973247454541cc335d33ffd82542ca94a1b75b34c8
```

## Production simulation baseline

Compared directly with ZIP entries in
`/workspace/shared/zeGame2-recovery-backups/Tiny-Bean-Restored-Full-Source-2026-10-13.zip`.
Both trees contain 71 `src/game` files: no additions/removals, 70 byte-identical,
and only `operations.test.ts` differs. Its reviewed changes normalize seeded
test setup and derived restoration routes and add continuity assertions. No
production game bytes differ.

```text
stableFull ZIP SHA-256
0966f07f613fb2f88c69fd944d8135ad6e1f9db9bc4d8f19049cb6cbfc651a6a
31 production game files aggregate SHA-256
f7589c2fe8d4725d25a68e6f45cd8562468ce14b4c2c84107f426fb4deb80d3b
```

The game aggregate uses the same sorted-path recipe, with paths relative to
`src/game`, file-byte payloads, and `*.test.ts` excluded.

## Limits

- This establishes exact pixel provenance and production-game byte stability,
  not aesthetic acceptance, render placement, animation, or browser behavior.
- Pixel-equivalent reconstruction need not produce identical PNG encoding.
  Source sheets and manifests must remain in the backup, not only public files.
- Some archived manifest `file` values contain original scratch paths. Resolve
  their basenames within the listed runtime/archive family when reconstructing;
  those original scratch directories are not needed. The wide-display crop is
  recorded in the main-v2 manifest even though the older crop script omits it.
- Three unused service-manifest outputs (`open-pickup-shelf.png`,
  `glass-jar-tall.png`, `glass-jar-short.png`) have no delivered PNG to compare.
  Their source sheet and crop boxes exist; none is runtime-registered.
