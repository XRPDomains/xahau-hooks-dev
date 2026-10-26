# Auto-forward: emitted Payment, callback and bounded recovery

[auto-forward.c](../assets/examples/auto-forward.c) is a teaching implementation that forwards floor(5% of a qualifying incoming native Payment) to an install-time `savings` AccountID. This is a single-operation example, not a general escrow/refund service. Requires the runtime's `prepare` API and **HooksUpdate2**; do not assume a public endpoint has activated it.

## Protocol and state

Only incoming direct native Payments to the Hook account qualify; outgoing self payments and emitted generations pass without forwarding. Partial-payment and other noncanonical flags are rejected. Payments below 20 drops have no forward amount. Savings must differ from the Hook account. Configure `savings` as 20 raw AccountID bytes in HookParameters; no public configuration operation exists.

Use one Hook, one namespace and one outstanding transfer. Pending or failed operations block another qualifying incoming Payment with rollback. A successful record can be replaced by the next operation. The record is 95 bytes at key ASCII `AFWD` followed by 28 zero bytes:

| Offset | Bytes | Meaning |
|---|---|---|
| 0 | 1 | version `01` |
| 1 | 1 | 1 pending, 2 success, 3 confirmed failure |
| 2 | 32 | current emitted child transaction ID |
| 34 | 8 | forward amount, drops, unsigned BE |
| 42 | 20 | savings AccountID |
| 62 | 1 | attempts, max 3 including initial emission |
| 63 | 32 | original incoming parent transaction ID |

The C builds a 34-byte partial Payment (type, native Amount, Destination). After checked `etxn_reserve(1)`, `prepare` supplies native emission details/fee. Its signed return is checked before conversion to length. `emit` must return exactly 32 bytes and the pending record write must succeed; otherwise strong invocation rolls back. The forward amount excludes fees: the Hook account separately pays execution/emission fees and must retain reserve.

Callback correlates `otxn_id(...,0)` with the stored child. `reason=0` reads actual result via `meta_slot` -> `sfTransactionResult` -> one byte; zero means success, otherwise confirmed failure. `reason=1` is the tested-source expiry path. Other reasons, missing metadata, wrong child, duplicate callback or settled state do not finalize the current operation. This mapping is tied to the pinned runtime below, not inferred from a normal transaction slot.

Retry is an owner self-Invoke with Destination omitted and `op` bytes `retry` (`7265747279`). It is allowed only from status 3, with fewer than three attempts. The amount and destination come from stored state, and the child ID changes. Retry of pending/unknown or exhausted operations rolls back. No caller can supply a replacement amount or destination.

Callbacks run weakly. A callback state-write failure leaves the record pending even if the child already moved funds; return code 2005 is diagnostic, not reversal. Callback absence/unknown result likewise remains pending. Stop and reconcile the saved child hash, validated result, balance and state; this example deliberately provides no blind pending reset/resend command. A production application needs an independently reviewed ledger-proof reconciliation/migration procedure for that case.

## Reproduce locally

Build and validate the unmodified production artifact:

```sh
node assets/toolchain/compile.mjs --source assets/examples/auto-forward.c --out build/forward
node scripts/profile-guards.mjs --source assets/examples/auto-forward.c --wasm build/forward/hook.cleaned.wasm --policy assets/auto-forward-artifact-policy.json --guard build/guard/guard_checker --wsl Ubuntu --out build/forward/profile.json
node --test tests/framework.test.mjs
```

For native integration, independently obtain and verify the official node for the pinned release; no binary is bundled or downloaded automatically. On a disposable standalone ledger, enable HooksUpdate2 explicitly at genesis. Example config (replace every absolute data/log path, keep ports bound to loopback):

```ini
[server]
port_rpc
port_ws
[port_rpc]
ip = 127.0.0.1
port = 18274
admin = 127.0.0.1
protocol = http
[port_ws]
ip = 127.0.0.1
port = 18275
admin = 127.0.0.1
protocol = ws
[network_id]
2133900
[node_size]
tiny
[node_db]
type=NuDB
path=/ABSOLUTE/DISPOSABLE/DB
[database_path]
/ABSOLUTE/DISPOSABLE/DB
[debug_logfile]
/ABSOLUTE/DISPOSABLE/debug.log
[features]
HooksUpdate2
```

Start `xahaud --standalone --start --conf /ABSOLUTE/local.cfg` using a fresh database. Never point this config at an existing ledger. The local `[features]` rule override is not proof of public amendment activation; the feature RPC can still report its amendment ledger entry disabled while local rules enable the API. The probe establishes behavior by installing/executing the actual artifact on this configured node.

After `npm ci` in `assets/examples/deploy`, explicitly run:

```sh
node assets/examples/deploy/probe-auto-forward-local.mjs --wasm build/forward/hook.cleaned.wasm --out build/forward/native-evidence.json
```

The probe has a fixed loopback endpoint and dedicated NetworkID 2133900. It requires admin `ledger_accept` before deriving a disposable genesis signer, generates fresh owner/savings wallets in memory, journals hashes before single submission, closes ledgers, and checks validated receipts, callback HookHash/account/return code/state writes, child amounts, state and savings balance changes. It tests success, `tecDST_TAG_NEEDED`, then owner recovery after clearing RequireDestTag. It does not print/store seeds or work on remote/testnet/mainnet. Output journal is exclusive; retain an incomplete report after failure rather than replaying against shared state. Stop the disposable node after the run.

## Evidence and limits

[Saved evidence summary](../assets/auto-forward-evidence.json) identifies the runtime release/revision, production/checker hashes, child receipts and final states observed locally. The native node binary digest was checked against the official release asset. Source behavior was inspected at that same revision; the checker has a separately pinned older revision recorded in the report. This combination passed locally; it does not certify all nodes or amendments.

Offline WASM tests cover preparation/emission/state-write faults, authorization, unknown/duplicate/wrong callbacks, pending replay refusal, metadata failure, expiry fixture and attempt exhaustion. Native tests establish successful callback execution, validated child engine failure and subsequent recovery. Native expiry and native weak state-write fault injection are **NOT_RUN**; mock coverage cannot close those gaps. No public-network deployment was performed.

Authoritative references: [prepare API](https://xahau.network/docs/hooks/functions/emitted-transaction/prepare/), [callback API](https://xahau.network/docs/hooks/functions/developer-defined/cbak-callback/), [pinned node release](https://github.com/Xahau/xahaud/releases/tag/2026.10.13-release%2B4119), [HookAPI source](https://github.com/Xahau/xahaud/blob/d20e8ffb561034101d24668adbe9a513f639cb37/src/xrpld/app/hook/detail/HookAPI.cpp).
