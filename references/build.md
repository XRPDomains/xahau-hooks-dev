# Build, guards and resource budgets

## Reproducible target

Pin compiler, headers, optimizer, cleaner and checker revisions or immutable image digests. Retain commands, logs, source/dependency hashes, raw/optimized/final sizes and final artifact SHA-256. Verify the exact cleaned bytes later submitted, not an earlier object or probe build. Do not globally silence compiler warnings to conceal pointer/signature problems.

Typical stages: compile -> link -> optimize -> clean -> WASM structural inspection -> production guard validation -> optional node validation -> behavioral probes/integration. The [optional setup guide](toolchain-setup.md) provides a pinned npm compiler/header recipe, Dockerfile and checker source manifest; no third-party binary or header source is vendored.

Use `inspect-artifact.mjs` with a reviewed policy. It reports structure and runs an optional external checker; it does not compute instruction counts, block depth or stack usage. Obtain those from a compatible disassembler/validator and preserve their raw output. The target's `hook_validate` endpoint, where available, is another validation layer, not a behavioral test.

## Guard calculation

Every runtime loop must meet the target validator's placement rule. Derive a guard budget from all visits to the guard site during one invocation, including final condition checks, nested loops and repeated helper calls. Do not double-add the condition-check allowance if the selected macro already adds it. Unique sites need stable non-colliding IDs after source composition.

A helper scanning up to 20 bytes, called up to 10 times, needs an analysis of cumulative visits, not just a local bound of 20. Early exits can tighten a proven bound; average input cannot. Keep a table of guard site, local bound, call multiplicity, worst visits and boundary test.

Changing an ID does not make a shared helper site independent across runtime calls. Native no-op guard mocks cannot detect budget exhaustion. A mocked WASM host should count calls by ID and trap at the configured bound.

## Inlining and nesting

Cleaner behavior and validator function-call restrictions can force helper inlining. Extra helper exports accepted by a test harness may be rejected on-chain. Do not assume export retention solves block depth.

First measure the production artifact and identify the deep path. Prefer flatter dispatch, early terminal errors, bounded operation-specific handlers, elimination of redundant parsing and smaller shared code. Split installed hooks only if routing, shared state, resource limits and chain-wide semantics are explicitly verified. Keep the guard checker unmodified.

## Memory and performance

Measure final bytes, worst-case instructions/fees, memory pages, stack pressure and state/API call counts for maximum supported input. Reduce repeated hashing, field extraction and state reads when the cached result remains valid within the operation. Avoid holding duplicate large buffers concurrently; do not remove validation to save bytes.

Fewer source lines do not imply fewer WASM instructions. Do not remove roles or recovery semantics solely to fit a binary without explicit protocol agreement. Keep protocol limits configurable and verified against the target runtime rather than embedding a historical limit in the skill.
