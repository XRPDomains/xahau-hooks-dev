# Project contract template

## Target and scope

Project path, requested changes, permitted network actions, target identity and compatibility record.

## Operations

| Operation | Trigger/direction | Encoded inputs | Authority | Preconditions | Mutations | Completion | Error/replay |
|---|---|---|---|---|---|---|---|

## State

Namespace derivation, key preimages and independent vectors; record versions, lengths, offsets, units and endian; dynamic record inventory and deletion rules.

## Invariants and lifecycle

Authoritative ownership, asset permissions, transfer/reset/burn effects, primary/reverse validity. Pending transitions, observations authorizing finalization, bounded recovery and duplicate prevention.

## Resource budget

Maximum input/output bytes, record counts, guard visits including helper multiplicity, expected API/state calls, measured artifact size and execution cost.

## Verification plan

Boundary/malformed input, wrong authority, payment conditions, maximum inventory, state/API failure, weak phase, emit/callback/refund, upgrade preservation. Identify evidence level and tools for each case.
