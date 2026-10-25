---
name: xahau-hooks-dev
description: Design, write, build, test, review, debug, deploy, and upgrade C/WASM Hooks on Xahau, including direct RPC state reads and transaction-based writes. Use for Hook C safety, guards, binary state layouts, emitted transactions, callbacks, and deployment failures. Includes guidance for developers new to C; excludes building application SDKs and indexers.
metadata:
  version: "1.0.0"
---

# Xahau Hooks development

Work within the requested project and operation. Inspect its instructions, authoritative protocol, source, tests, build pipeline, and deployment evidence first. Preserve the user's authorized scope: using this skill does not authorize a network deployment, signing, source rewrite, or external publication.

## Establish the target

Record network identity, node/API capabilities, enabled amendments, headers, compiler/optimizer/cleaner versions, validator revision, and final artifact hash. Treat RPC URLs and protocol limits as configuration, not universal constants. Read [compatibility and sources](references/compatibility.md) when selecting tools or resolving conflicting documentation.

Distinguish protocol requirements, project conventions, and locally observed workarounds. Never turn a workaround from one compiler or application into a universal rule.

## Route by task

Read only relevant references:

| Task | Reference |
|---|---|
| New project, operations, authorization, state machine | [Architecture](references/architecture.md) |
| C beginner, pointer/length, overflow, byte handling | [C essentials](references/c-essentials.md) |
| Hook API return values, invocation, accept/rollback, slots | [Runtime and API contracts](references/runtime.md) |
| Compiler, guards, memory, block nesting, performance | [Build and resources](references/build.md) |
| Key derivation, binary layout, deletion, migration | [State](references/state.md) |
| Emission, callback, pending, failure and recovery | [Emit and recovery](references/emit.md) |
| RPC reads, Invoke/Payment writes, result interpretation | [Read and write](references/read-write.md) |
| SetHook, bootstrap, smoke, state-preserving upgrade | [Deployment](references/deployment.md) |
| Audit, regression, fault injection, error investigation | [Testing and debugging](references/testing.md) |

For a beginner, start with C essentials and the minimal examples in [examples](assets/examples/README.md). Explain the relevant C concept alongside each fix; avoid an unrelated C course.

## Essential invariants

- Account for every pointer's capacity and every API's returned byte count. An error must never become an unsigned length. Validate input before irreversible workflow transitions.
- Define byte order, lengths, units, key preimages, and schema versions explicitly. Check every significant state write and deletion; distinguish not-found from other failures.
- Derive guard budgets from worst-case invocation counts including helper reuse. Validate the cleaned production WASM; probe exports and mocked hosts are not production validation. Do not weaken the checker or inflate guards to hide a failure.
- Only use exports, imports, helper calls, and APIs accepted by the selected validator and network. Adding WASM helper exports is not a default solution to excessive inlining.
- Model originating transaction, emitted transaction, callback, and business completion separately. Inspect the actual runtime's callback contract; do not assume `reason` is an engine result or that an ordinary transaction slot contains result metadata.
- Resolve asset rights from protocol semantics. An issuer's ledger-level authority can differ from application ownership. State checks alone may not constrain transactions that never trigger the hook.
- A lost connection after submission is an unknown outcome, not permission to replay a payment. Recover by transaction hash and ledger evidence.

## Deterministic helpers

Node.js 20+; no npm installation is needed for bundled scripts. Run each with `--help`.

- `scripts/doctor.mjs`: report local runtimes; Docker daemon check only with `--docker`.
- `scripts/init-project.mjs`: create a new project source layout from the teaching example and contract template; refuse an existing destination. Does not install tools or create a deployment.
- `scripts/inspect-artifact.mjs`: WASM structure, exact imports/exports policy, byte budget, SHA-256; optionally execute a supplied guard checker without a shell. Does not implement a replacement guard checker.
- `scripts/decode-state.mjs`: validate a fixed binary layout and decode bytes/BE unsigned integers. Does not discover unknown state keys or verify project C layouts automatically.
- `scripts/read-state.mjs`: read-only HTTP JSON-RPC; verify network ID, pin a validated ledger, paginate a namespace, reject repeated markers. Never signs or submits.
- `scripts/summarize-tx.mjs`: summarize a saved `tx` response with validated status and HookExecutions. Does not infer completion of emitted workflows.

Policy/layout examples are under [assets](assets/README.md). Require explicit project-specific values; the supplied artifact policy is only for the minimal pass-through example.

## Evidence and completion

Use [the report template](assets/report-template.md). Label static inspection, native helper tests, mocked WASM probes, node validation, live validated transactions, and failure recovery separately. Record commands, versions, artifact hashes, and untested paths. Compile or static PASS never means production readiness.

For a fix, reproduce the narrow failure, patch its cause, run meaningful regressions, and report remaining limits. For deploy, stop on an unexplained compile/checker/SetHook/bootstrap failure instead of continuing with an uncertain artifact. Resume only after the cause is understood and the task still authorizes it. Never silently retry a fee-bearing submission.
