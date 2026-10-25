# Architecture and project organization

## Start from a contract

Write an operation table before implementing handlers: trigger transaction type/direction, input encoding, signer/role, preconditions, state reads/writes, emitted effects, success condition, error codes, replay behavior and resource bounds. Distinguish the hook account, transaction sender, issuer, asset owner, offer recipient and administrator; they need not be the same account.

Declare invariants such as: a completed operation has exactly one authoritative owner; a refund cannot be issued twice; no user record survives a required reset; a pending operation never appears as finalized; an unrecognized transaction follows an intentional pass-through or rejection policy. Domain-specific normalization belongs to the chosen protocol, not this skill.

For multi-step work, draw states and transitions. Example only:

```text
absent -> reserved -> emitted -> awaiting-claim -> active
                         |             |
                         +-> recovery <-+
```

Specify which ledger event authorizes each transition. Never advance ownership merely because an offer was created. Define reconciliation for mismatches between application state and ledger asset state.

## Optional organization

```text
protocol/             operations, errors, key/layout schemas
hook/src/             shared bounded helpers and handlers
hook/toolchain/       pinned compiler/cleaner/checker provenance
tests/                native, mocked-WASM, node, live evidence
scripts/              build, direct RPC, deployment verification
deployments/          public network-specific installed identities
docs/architecture/    state machine and trust boundaries
docs/review/          findings, evidence, unresolved gates
```

Adapt an existing project rather than restructuring it unnecessarily. Keep private signer configuration and generated artifacts outside tracked source. Separate public deployment identity from secrets.

## Split only when justified

A small hook can remain one artifact. Split handlers when measured code size, nesting or resource budgets justify it. For multiple hooks, document order, activation masks, shared namespace, each handler's responsibility, short-circuit behavior and instruction/fee impact. Test the complete installed chain; a handler passing alone does not prove chain routing. Do not copy another application's hook count or namespace strategy.

## Errors and user-facing meaning

Assign stable project return codes by cause: malformed input, unauthorized, conflict, missing state, resource limit, state write, emission, reconciliation required. Return strings should identify a short diagnostic; surrounding tooling can translate them into friendly messages. Keep transaction engine results separate from application error codes and from RPC/signing failures.
