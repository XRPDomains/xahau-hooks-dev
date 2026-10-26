# Runtime and API contracts

## Entry and routing

Record the target header signatures for `hook` and, if used, `cbak`. A hook is activated by configured transaction masks/directions and installation context; an arbitrary Invoke is not automatically routed to the intended account or operation. Specify Destination and operation encoding according to the project's protocol and target transaction definitions.

Self-Invoke targets the signing Account's own installation by **omitting Destination**. An Invoke with `Destination === Account` is rejected by the locked Xahau transaction validator; do not translate self calls into explicit equal-address routing. For another installation use a distinct Destination, then verify whether that account's execution is strong/weak under the selected amendments. Trigger masks and a valid Invoke shape alone do not prove the business handler ran.

Handle unrelated transactions intentionally. Do not turn a missing operation into a successful write. For chains, test sender, destination, installed order, namespace and every participating handler.

## Read each API as a contract

For each call document:

1. Input representation and length, including key length and whether zero means deletion.
2. Output capacity and expected returned length/type.
3. Meaning of negative results, especially not-found versus malformed/access/size errors.
4. Whether partial output is possible and whether a second read is needed.
5. Allowed invocation contexts and mutation/rollback semantics.

Use pinned headers for error constants; do not invent numeric fallbacks to silence compilation unless verified against the target definitions. Check exact lengths for fixed-size fields. For variable data, reject truncation according to the API contract rather than guessing from the buffer size.

`accept` and `rollback` are terminal operations in the Hook runtime. If a mock returns from them, the mock needs to model terminal control flow explicitly, such as a trap/exception with captured arguments. Do not test impossible fall-through behavior. Do not assume accepting one handler skips every later hook.

## Slots and serialized fields

Account for slot allocation, slot content type, `slot_subfield` failure and copied byte length. Confirm whether a slot contains a transaction, metadata or a ledger object before requesting its fields. Field names and serialization differ by object and transaction type. Construct raw transaction templates only with canonical field order, lengths and current definitions.

`sfMemos` is a serialized array, not a raw JSON substring. A memo walker must enforce bounds at each nesting/length step and match the intended MemoType. In JSON RPC, MemoData is hex; in a serialized field blob it may already be raw decoded bytes. Do not hex-decode twice. Test both the parser boundary and the ledger serialization boundary.

## Transaction phases

Distinguish outgoing/incoming activation and strong/weak participation using the target runtime's documentation and tests. In a weak phase a rollback may not reverse the triggering ledger operation. Do not make the application's integrity depend on a rollback that the runtime cannot enforce. Persist enough bounded information to reconcile with authoritative ledger state, and test a native failure after the relevant ledger mutation.

The callback argument is not automatically an engine result. See [emit](emit.md). When documentation and source disagree, record the versions and resolve against the selected node plus controlled integration evidence.
