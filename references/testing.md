# Testing, audit and debugging

## Evidence levels

For an initial source pass, run `node scripts/lint-source.mjs --source hook/src/hook.c`. JSON findings include file, line and rule. Exit codes: `0` = no heuristic findings, `1` = review findings, `2` = invalid input. It reports obvious discarded Hook API calls, direct unsigned declaration/cast of API results, and loops lacking a recognized `_g`, `GUARD` or `XH_GUARD` in their header/first body statement.

This is a lexical hint tool, not C analysis or enforcement of every invariant. Comments/strings are masked; macros/includes/conditional compilation are not expanded. It cannot prove that an assigned signed result is later checked, infer unsigned types through typedefs/reassignments, detect all discarded calls, validate guard budgets/placement in compiled WASM, or prove authorization, rollback and recovery. Custom guard macros and do/while tails can produce false positives; disabled code can be flagged. Review findings in context and record the reason for dismissing them. `NO_FINDINGS` never means audit PASS; retain manual source review, native tests and production artifact validation.

The [native variable-state test](../assets/examples/variable-state.test.c) is a starting point for round-trip and key-derivation regression coverage. From the skill root on Linux/WSL:

```sh
cc -std=c11 -Wall -Wextra -Werror -pedantic -fsanitize=address,undefined assets/examples/variable-state.test.c -o /tmp/xh-variable-state-test
/tmp/xh-variable-state-test
node --input-type=module -e 'import {labelKey,encodeText} from "./assets/examples/variable-state.mjs"; console.log(labelKey("abc").toString("hex")); console.log(encodeText("https://example.com").toString("hex"));'
```

The final two commands must produce the same two hex lines; the native executable also asserts lengths 1..200, bounds, malformed states and sentinel preservation. Replace the schema/fixtures for your application. This C example is a native codec, with unguarded loops and libc calls; do not copy it into a production Hook without target-specific adaptation and artifact validation.

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
