# Optional XahauWin explorer ABI integration

This layer learns from [XRPLWin/xahau-hooks-abi-skill](https://github.com/XRPLWin/xahau-hooks-abi-skill), reviewed on 2026-10-27 at revision `9e0eed4830535ed6b288820fb6aa116e0fd9844e`. It adds readable state projections and local coverage checks to our build/state workflow. It does not turn explorer metadata into an on-ledger authorization rule or introduce signing, RPC, indexer or application-SDK dependencies into the core.

## Two contracts with different purposes

| Layer | Purpose | Identity / verification |
|---|---|---|
| Our `hook-interface.json`, schema v1 | Encode business parameters, unsigned Invoke and exact state/key bytes | Schema hash/version; optional artifact SHA-256 binding; independently checked against C |
| Explorer `abi.hookStates` | Project each state key/value into readable columns | Manifest is associated with a HookHash; every observed record should match exactly one projection |
| Explorer manifest | Name/readme/license/publishers/namespace labels and ABI | Off-ledger, network-specific publication; author/version selection belongs to the explorer |

The exported ABI describes **state**, not an EVM-style callable ABI. A correct table does not prove Hook authorization, fee safety or business completion. Artifact SHA-256 and HookHash are different hashes. A rebuilt artifact requires rechecking the layouts and binding; a copied manifest's claimed identity is not evidence of an installed Hook.

## Inventory before generating

Inspect every source `state_set`/`state_foreign_set`, and relevant reads. Record the writer Hook, destination account, effective/foreign namespace, key preimage and actual key length, value length/fields, version, units and byte order. Native WASM integer storage is LE; explicitly encoded BE buffers need BE projections. A raw integer in drops is `UInt64`, not a serialized `NativeAmount`. Trace any helper/macro to its real byte operations.

Keys shorter than 32 bytes passed to the state API are **left-zero-padded**. This differs from a C application explicitly writing a full 32-byte prefix+text+right-zero-padded key, as contact-book does. A short literal key can also look like a valid AccountID; use disjoint patterns/lengths and negative fixtures. Coverage must account for foreign namespaces and projections from other installed Hooks, not only a single C file.

## Export the supported schema subset

Run from the skill root; the destination directory must be new:

```sh
node scripts/export-explorer-abi.mjs --schema assets/contact-book.interface.json --metadata assets/explorer-abi/contact-book.metadata.json --wasm build/contact-book/hook.cleaned.wasm --out build/contact-explorer
```

Build the contact example first using [offline framework](offline-framework.md) if its WASM is absent. The exporter needs only Node built-ins. It creates `hook.abi.json` (bare projection array), optional `hook.manifest.json` (metadata + `abi.hookStates`), and `export.json` with schema/artifact identity and warnings. A supplied WASM must be valid and must not have our test-only memory export. If the schema binds an artifact SHA-256, `--wasm` is required and checked. Without a WASM the export is unbound; even with it the calculated HookHash must still be compared with the actual installed HookHash. This command does not replace production guard validation.

Supported mappings: `uint8`, `uint32be`, `uint64be`, `account20`, fixed `bytes`, constants, fixed hex32 keys and full 32-byte `prefix-text` keys. BE integers receive explicit `endianness:"BE"`; constants become checked literal patterns. Only fixed literals/padding are excluded. Prefix text occupies its configured byte width: trailing NULs remain in decoded text/CSV, rather than being silently trimmed.

Hash-derived keys and uint16 length-prefixed variable state strings are **rejected** by the exporter. A hash's preimage cannot be recovered, and the explorer's tail-consuming `VarString` is not our length-prefixed codec. These need reviewed manual projections, not an approximate automatic conversion. Other upstream types, such as signed/LE integers, XFL, timestamps, arrays and serialized amounts, may be used manually with the upstream reference and decoder. Our exporter does not implement or claim those conversions.

## Use the actual pinned decoder, optionally

The upstream parser/validator is loaded from a separate checkout; its source is not bundled or reimplemented here. When network/setup is authorized and available:

```sh
git clone https://github.com/XRPLWin/xahau-hooks-abi-skill.git build/abi-upstream
git -C build/abi-upstream checkout --detach 9e0eed4830535ed6b288820fb6aa116e0fd9844e
npm ci --ignore-scripts --no-audit --no-fund --prefix build/abi-upstream/scripts
node scripts/check-explorer-abi.mjs --upstream build/abi-upstream --check assets/explorer-abi/contact-book.check.json --out build/contact-explorer/coverage.json
```

Use a fresh checkout destination, or inspect an existing checkout before switching revisions. On PowerShell, check `$LASTEXITCODE` after each native command before continuing, as in [Windows first Hook](windows-first-hook.md). The optional lock currently includes a dependency requiring Node **20.19+**; use a compatible Node runtime (verified here with Node 22.17.0). This does not change the core's separate Node 20+ dependency boundary. A sandbox can receive a trusted prepared checkout/dependency cache and run checks offline; this checker never downloads or contacts a node.

[explorer-abi-upstream.json](../assets/explorer-abi-upstream.json) pins the relevant upstream modules, package/lock and license by LF-normalized SHA-256. The checker verifies these before importing modules, and verifies installed dependency versions against that lock. Use `npm ci` for integrity-checked installation; version checks alone do not certify the contents of an arbitrary dependency cache. To update upstream, review the new revision and decoder behavior, refresh pins intentionally, and rerun compatibility vectors. Do not edit the pinned parser or loosen hashes to make a projection pass.

## Exact-once and semantic checks

The checker accepts the upstream check-file shape: `account`, `hooks:[{hash,namespace,manifest}]`, `state:{NAMESPACE:FILE}`, and `extra:{NAMESPACE:[{k,v,note,expect?}]}`. Paths are relative to the check file. `state` accepts upstream arrays/`account_namespace` responses and our saved read-state snapshot with `entries`. Synthetic records must have an explicit `note`; they remain labelled synthetic. `expect` is an optional map from visible column labels to independent expected values (e.g. `account`, `count`, decimal-string `drops`). The contact example uses only synthetic vectors and does not claim an installed account/namespace.

It uses the upstream manifest normalizer/linter and decoder. Under a namespace it tries the Hooks installed in that effective namespace; when none are listed, it tries every configured Hook, matching upstream's fallback rule. Empty datasets, undecoded records, multiple matches and projections with no exercised record fail. This last requirement is stricter than upstream `check.mjs`, which currently warns about unused projections. Same-record duplicates across Hooks can therefore be caught. An ABI matching every byte can still display a wrong number: assert independent expected values and inspect representative rows.

Output includes input hashes, sampled decoded rows, unused projections, errors, normalizer notes and lint warnings. Resolve/explain the notes and warnings before publication. Core snapshot account/namespace metadata is compared when provided; pagination markers, duplicate snapshot keys and conflicting ledger/network metadata fail. Snapshot authenticity, full namespace/account inventory and HookHash installation are **not** established by local files: `hookIdentityValidation`, `networkValidation` and `publishing` remain NOT_RUN. Include the separate validated ledger/installed-Hook evidence when handing over.

The checker caps input files at 8 MiB, total records at 10,000 and decoder comparisons at 200,000; it runs in a worker with a 10-second default deadline (`--timeout-ms`, up to 60 seconds on slow machines). A timed-out check produces no PASS. These are local-tool limits, not ledger limits. Treat manifests and check files as trusted reviewed inputs; a worker deadline is not a security sandbox for arbitrary code or files.

Run the four dependency-free exporter tests with `node --test tests/explorer-abi.test.mjs`; the upstream integration group reports SKIP unless `XAHAU_ABI_UPSTREAM` points at the prepared checkout. In PowerShell:

```powershell
$env:XAHAU_ABI_UPSTREAM = (Resolve-Path build/abi-upstream).Path
node --test tests/explorer-abi.test.mjs
Remove-Item Env:XAHAU_ABI_UPSTREAM
```

## Handoff and attribution

Hand over the ABI, manifest, export binding, exact source/build identity, check report, independent fixtures and actual installed HookHash/namespace evidence. Publish only within the user's explicit scope, using the explorer's current procedure; this integration does not upload or sign in. Testnet/mainnet metadata stores are separate. Recheck the returned published JSON and decoded rows; live publication/rendering is not proven by our offline tests.

Upstream is MIT, copyright 2026 XRPLWin; its optional checkout retains that license. Our adapter/check orchestration is original package code. The upstream decoder's XFL helper credits Transia-RnD; its implementation is used only through that separately obtained checkout. Authoritative pinned references: [format](https://github.com/XRPLWin/xahau-hooks-abi-skill/blob/9e0eed4830535ed6b288820fb6aa116e0fd9844e/reference/format.md), [namespace reader](https://github.com/XRPLWin/xahau-hooks-abi-skill/blob/9e0eed4830535ed6b288820fb6aa116e0fd9844e/reference/reader.md), [publishing](https://github.com/XRPLWin/xahau-hooks-abi-skill/blob/9e0eed4830535ed6b288820fb6aa116e0fd9844e/reference/publishing.md), [license](https://github.com/XRPLWin/xahau-hooks-abi-skill/blob/9e0eed4830535ed6b288820fb6aa116e0fd9844e/LICENSE).
