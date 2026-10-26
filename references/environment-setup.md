# Machines with missing tools

Use this before the quickstart when the agent has source access but the environment is incomplete. Prefer an existing project toolchain over installing another one. This workflow prepares local tools; it does not authorize a ledger write.

## Bootstrap before Node exists

`doctor.mjs` cannot run without Node. First inspect the shell and OS: PowerShell `Get-Command node,npm -ErrorAction SilentlyContinue`, or POSIX `command -v node` and `command -v npm`. Check a configured bundled runtime or existing version manager before downloading anything. Use the [official Node distribution](https://nodejs.org/en/download), matching the OS/architecture, with npm. The package requires Node >=20; prefer a currently supported LTS. Verify published checksums/signatures for a downloaded portable runtime. An agent may use a user-local runtime when its environment permits downloads; do not replace the user's global Node or change system PATH just to run this skill. Invoke the chosen executable explicitly if necessary. Recheck `node --version` and `npm --version` in that same execution environment.

If download/network access or system installation is unavailable, report the exact missing prerequisite and the command/result that demonstrated it. Continue with protocol/source review and draft unsigned JSON where useful; mark executable checks NOT_RUN. A blocked package fetch is not proof that the source or package is defective.

## Diagnose and choose a route

From the skill root run `node scripts/doctor.mjs`. On Windows, if an existing WSL distribution is selected, use `node scripts/doctor.mjs --wsl Ubuntu --guard build/guard/guard_checker`. This explicitly starts/probes the named distro; plain doctor does not start WSL or contact Docker's daemon. `--docker` additionally checks the daemon; `--image NAME` inspects an existing local image. Nothing is installed, pulled or submitted by doctor.

The JSON `checks` report separates source tools, npm compiler, checker build, native tests and WebSocket examples. `available` means local prerequisites were observed, not that an operation succeeded. Package checks inspect direct installed versions and header presence; `npm ci` plus a real build/codec test remains necessary to validate the full dependency tree. Doctor exit 0 means it generated a report; inspect each capability. An unsupported Node exits 1.

Command probes distinguish `NOT_FOUND`, `TIMED_OUT`, `PROBE_FAILED` and `OBSERVED`. A cold WSL startup or a permission error must not be converted into “install the tool again.” Inspect the reported error and recheck the same selected route when appropriate; WSL compiler probes have a bounded 15-second timeout.

| Missing capability | Action within the selected route | Verification / remaining work |
|---|---|---|
| npm compiler dependencies or headers | `npm ci --ignore-scripts --no-audit --no-fund --prefix assets/toolchain` | Re-run doctor, compile `minimal.c` into a fresh directory; inspect its build log and artifact |
| WebSocket/transaction codec dependency | `npm ci --ignore-scripts --no-audit --no-fund --prefix assets/examples/deploy` | Re-run doctor, run offline codec/reference tests; no seed is needed |
| Native compiler for helper tests | Use installed `cc`/clang; on Ubuntu the system package is `build-essential` | Compile and execute native tests, with sanitizers where supported |
| Checker build compiler | Linux: `g++`; Windows: explicitly selected WSL distro with `g++` | Run `setup-guard`, then inspect the exact cleaned artifact with that checker |
| Windows WSL distro / first-run setup | Inspect `wsl --list --verbose`; use [Microsoft's setup instructions](https://learn.microsoft.com/en-us/windows/wsl/install) if this route is needed | Installation can require admin rights, restart and first-run account setup; explain that concrete blocker if the agent cannot complete it |
| macOS has a C++ compiler but no compatible checker | Verify the compiler can build the pinned sources; use an existing Linux/container route if needed | The package's verified checker build is Ubuntu/WSL. Do not label another platform verified before running it |
| Docker CLI but no daemon/image | Use npm route if possible; otherwise start the configured Linux daemon and build the documented local image | `doctor --docker --image NAME` is diagnostics, not a build or image pull |
| Network denies npm/checker downloads | Use a trusted existing cache or an artifact with recorded provenance | Do not remove locks, checksum pins, TLS checks or switch to an arbitrary mirror to make installation pass |
| No rights for system packages | Install only permitted user-local dependencies or continue with an available route | Report the specific admin/interactive step; retain useful review and unsigned preparation work |

These local `npm ci --prefix` commands are part of authorized setup and need no additional approval when the host allows them. They modify only those optional dependency directories; avoid running `npm ci` at an unrelated project root. System changes follow the user's authorization and the host's actual execution permissions. Do not ask for permission simply because a tool is missing; first determine whether an available local route solves it.

Use one OS environment consistently for platform-specific npm dependencies. Keep source mounted read-only in Docker. No Docker installation is required for the npm route. Do not install clang, wasm-opt or Docker merely because doctor reports them absent: the locked npm compiler already supplies its compiler/optimizer/cleaner stages.

## Finish with evidence, not a tool inventory

After installation, rerun diagnostics and the smallest operation that uses each installed component. Record runtime/package/compiler/checker identities, build hash, production checker result and unrun stages. A present checker file is `NOT_RUN` until used on the artifact; doctor deliberately does not execute an arbitrary `--guard` path. Without a working checker, compilation may be recorded as COMPILED_NOT_GUARD_VALIDATED. Continue source/native/offline work, but do not progress to an installation while claiming the missing validation passed.

Follow [toolchain setup](toolchain-setup.md) for exact build commands and [quickstart](../QUICKSTART.md) for the owner-setting walkthrough. Funding, signer setup, fee quote and authorized submission are later, separate prerequisites.
