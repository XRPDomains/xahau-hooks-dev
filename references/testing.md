# Testing, audit and debugging

## Evidence levels

| Level | Proves | Does not prove |
|---|---|---|
| Source review | Identified invariants and plausible defects | Actual runtime behavior |
| Native C helper tests | Parser/buffer arithmetic under that compiler | Hook API, guards, WASM execution |
| Mocked production-WASM probes | Branch behavior under explicit host mocks | Native weak phase/callback/consensus |
| Static checker / node validation | Artifact acceptance/resource analysis | Business correctness |
| Validated live transactions | Observed network behavior for tested cases | Untested faults or all future inputs |
| Controlled native fault injection | Specific recovery/rollback failure path | Every environmental failure |

Keep missing levels explicit. One large PASS count cannot replace the distinction.

## Derive cases from the protocol

For each operation cover valid input, minimum/maximum bytes, one beyond each bound, missing/wrong type, malformed hex/UTF-8/number, unauthorized caller, missing state, duplicate/reordered request and maximum inventory. If JSON is supported, include nested keys, quoted braces, escaped quotes, duplicate fields and trailing garbage according to the parser's policy.

For payment-dependent operations cover wrong asset, wrong amount, destination, partial-payment semantics and insufficient funds/reserve. For asset rights, test issuer versus current owner and transactions that bypass the hook account entirely. For cleanup include predefined and custom keys, primary/reverse mappings and failed enumeration writes.

Fault-inject every significant state/emit boundary. Check terminal rollback behavior in mocks, count guard visits by ID, preserve the real artifact exports/imports, and exercise maximum supported inputs. Avoid tests that merely assert the implementation contains a particular string or mirrors its own encoder without independent vectors.

## Review record

Each finding includes severity, location, concrete trigger, expected/actual behavior, impact, reproduction level, fix and regression. Separate confirmed defects from questions and documented limitations. Close a finding with evidence, not a comment saying it was fixed. A request to review is not blanket permission to redesign roles or deploy.

## Diagnose by stage

| Symptom | First evidence to collect |
|---|---|
| C compilation failure | First actual error, pinned header signatures, flags |
| Unsupported imports/exports | Cleaned artifact inspection, optimizer/cleaner logs |
| Guard/depth rejection | Exact checker revision/log, disassembly of failing production path |
| SetHook rejection | Validated tx result or submission stage, node capabilities, actual bytes |
| Success but unchanged state | Expected HookExecutions, routing, operation parse, namespace/key |
| Unexpected rollback | Return code/string, API returns and exact input |
| Pending never completes | Parent/child correlation, actual result path, callbacks/recovery journal |
| Connection timeout | Endpoint, stage, connection/request timing, known tx hash |

Reproduce narrowly; change one cause; run targeted regressions plus required artifact validation. Stop live dependent steps after unexplained failure. Do not repeatedly rebuild the frontend, take screenshots, or rerun unrelated suites for a hook-only edit.

For C helpers, run strict warnings and native ASan/UBSan when available. Keep sanitizer builds separate from WASM. Add malformed inputs and property/fuzz tests where parsers or encoders warrant them; retain minimized failing inputs.
