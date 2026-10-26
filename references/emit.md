# Emission, callbacks and recovery

For concrete C, exact state layout, native standalone reproduction and evidence boundaries, use [auto-forward](auto-forward.md). Its shared mock tests exercise error branches; native success, child engine failure and bounded owner recovery were separately validated.

## Establish the actual runtime contract

Before implementation inspect pinned headers, enabled amendments, node source and a known working example for the same runtime. Document preparation API signature, supported transaction serialization, fee/burden/generation rules, callback routing and how success/failure is observable. Modern preparation APIs may differ from older hand-built `EmitDetails` templates; do not mix them.

`cbak(reason)` receives a runtime-defined reason, not an assumed engine result. Do not promise that `otxn_slot` exposes transaction result metadata. Verify the exact callback object/result path for this node. Cover accepted-but-failed execution, expiry and callback absence according to the supported contract. If the contract remains unresolved, deliver a design and unverified boundary rather than a fabricated callback implementation.

## Separate milestones

```text
input validated -> pending persisted -> emission accepted
    -> emitted transaction validated -> application postcondition verified
    -> finalized OR recoverable/refund state
```

Emission accepted by the API is not successful ledger execution. A successful mint/offer is not recipient ownership. A parent `tesSUCCESS` is not confirmation of every emitted child. Map every business transition to an observable ledger fact.

Use deterministic correlation keys with collision/replay protection. Store the destination, amount, operation phase and information needed for recovery. Validate destination and refund amount independently of untrusted callback input.

## Failure and idempotency

Reserve needed emission capacity before building dependent transactions. Verify every serialization/preparation/emission return value. Do not delete pending merely because a refund was requested: define what happens if that refund expires, fails or its confirmation is missed. Record enough state to prevent duplicate refund while permitting legitimate recovery.

Make callback and public reconciliation idempotent. Authorize retries by the pending operation and ledger evidence, not an arbitrary caller-supplied amount. Define whether callback order matters and how stale or duplicate events behave. Bound the number of emissions and retry generations.

## Tests required for a production claim

- Successful child transaction and final readback.
- Preparation/emission rejection with no false completion.
- Validated child engine failure and supported expiry/failure callback.
- Repeated callback/reconciliation and callback absence recovery.
- Refund failure/retry without loss or double payment.
- State write failure at each transition, including native weak-phase behavior.

Mocked tests can check state-machine branches and serialization fixtures, but cannot establish real callback routing, native rollback semantics or acceptance by consensus. Keep those verification gaps visible.
