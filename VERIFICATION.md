# Release verification: 1.0.0

Date: 2026-10-25. These are package verification results, not a deployment certification.

| Check | Result | Evidence/boundary |
|---|---|---|
| Skill frontmatter | PASS | Official skill-creator `quick_validate.py`, executed with Ubuntu Python/PyYAML |
| Node behavioral tests | PASS | `node --test tests/tools.test.mjs`; 16 tests, including local mock HTTP RPC and scaffold non-overwrite behavior |
| JavaScript syntax/local Markdown links | PASS | `node scripts/validate-package.mjs` |
| Decimal/hex/BE C helper tests | PASS | Ubuntu GCC 13.3.0; `-std=c11 -Wall -Wextra -Werror -pedantic -fsanitize=address,undefined`; assertions and sanitizers passed |
| Doctor CLI | PASS | Executed under Node 22.17.0 on Windows; reports missing native compilers and available Docker CLI without claiming daemon readiness |
| BE decoder CLI | PASS | `01000000000000002A` decoded to version 1 / decimal string 42 |
| Hook example production compilation | NOT_RUN | No production artifacts included; Docker Linux daemon unavailable during packaging |
| Hook example guard/node validation | NOT_RUN | Requires built artifacts, compatible checker and target node |
| Hook example live transactions/callbacks | NOT_RUN | No signing, deployment or live network actions performed |
| Independent agent task evaluation | NOT_RUN | Not performed in this packaging task |

Tool tests exercise exact-length/overflow-safe decoding, layout gaps/overlaps, uint64 precision, wrong/missing network identity, pinned-ledger pagination, duplicate keys/markers, malformed state, timeout/page limits, transaction trace interpretation, artifact-policy failure and guard evidence interpretation. They use synthetic data and loopback HTTP, not real chain state.

No complete emitted-transaction implementation is provided. Runtime callback and weak-phase recovery must be demonstrated in the consuming project before making a production claim. All examples identify their verification level.
