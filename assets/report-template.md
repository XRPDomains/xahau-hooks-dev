# Hook verification report

Date; task scope; source revision/dirty status; network and account (public only).

## Artifact and environment

Headers, compiler/linker/optimizer/cleaner/checker identities; node version and amendments; production artifact path, bytes, SHA-256; raw command/log locations. Distinguish artifact SHA-256 from ledger HookHash; do not equate them.

## Verification

| Stage | PASS / FAIL / NOT_RUN | Evidence | Limits |
|---|---|---|---|
| Source/invariant review | | | |
| Native helper tests | | | |
| Structural/import/export policy | | | |
| Production guard checker | | | |
| Mocked production-WASM probes | | | |
| Node artifact validation | | | |
| Validated network operations | | | |
| Native weak-phase/failure recovery | | | |

## Network actions, if authorized

SetHook/bootstrap/smoke transaction hashes, validated ledgers, engine outcomes, expected HookExecutions (hash/account/code/string), installed configuration readback, before/after state comparison. Correlated emitted children and business postconditions. Retries with reason and duplicate-prevention evidence.

## Findings and remaining gates

Severity, location, concrete trigger/impact, reproduction level, fix and regression evidence. Explicitly list unresolved assumptions and missing tests; no blanket readiness claim.
