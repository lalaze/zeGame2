# Café restoration verification — 2026-10-13 UTC

Recovered prior gameplay work into a fresh clone at `/workspace/shared/zeGame2`, branch `joyful-sloth`. Remote and current HEAD: `f45237a319917b987eb30457a17b66baaf3176d6`.

## What was restored

The full reviewed gameplay source archive supplies all 1,037 files: six operating styles, regular guests, living cats, signature drinks and reviewed fixes, 90-second traffic waves, service shortcuts and contextual pantry return. Against the clean clone: 753 identical files, 32 changed files and 252 additions; no remote-only tracked files. Original 13 archived QA files are preserved. Full path lists are in RESTORATION.json. No duplicate feature patches were applied.

The old A pixel-art redesign remains in its separate existing archive and was not applied. This recovery is not the new non-pixel 3D redesign.

## Checks performed now

- All 1,037 source members byte-match the verified source archive after restoration. An independent read-only reviewer repeated this check, checked the 13 QA members, unchanged HEAD, and absence of A-specific changes.
- npm ci succeeded with a writable `/workspace/shared/npm-cache`. Initial installation failed because the default `/home/agent/.npm/_cacache` path was unavailable; no dependency or lockfile change was needed.
- Full tests: 104 suites passed, 1 suite skipped; 1,098 tests passed, 26 skipped. Command: `npm test -- --maxWorkers=2`.
- Production build: `npm run build` passed (TypeScript and Vite).
- Existing tests include explicit constructed v12 migrations, v14-to-signature migration, current SAVE_VERSION=15 round trips, in-flight custom-order exactly-once delivery, and repeated live reload/settlement checks. These are automated synthetic tests, not a claim to have opened a real user's save.
- This round's live browser check was not completed: isolated port 5313 initially refused connection; after cloud desktop hosting, rebinding the error page encountered a URL-policy protocol rejection. No browser-policy bypass was attempted. No access to original 5173 player origin or real save.

## Reproducibility and limitations

Source is restored as uncommitted working-tree changes on the real remote history. The vanished unpushed commit graph, including historical 515a1f2 identity, is not reconstructed by copying source. No Git commit, branch publication, push or deployment was made. This cloud directory is a working copy, not a guarantee of permanent storage.

To run after restoring source: `npm ci --cache <writable-cache-path>`, `npm test -- --maxWorkers=2`, `npm run build`. Use a new preview port/profile to protect player saves. Source-Core is self-contained for default tests/dev/build. Full-Source also includes historical economy raw evidence/screenshots. Node modules and .git are excluded from source ZIPs.

Production comparison against prior playable ZIP: 31 members, 0 mismatches. All production members match byte-for-byte.
