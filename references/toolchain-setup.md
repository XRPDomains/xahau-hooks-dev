# Toolchain setup

Use this when a project has C source but no working build. The optional reference path below is now included; no global compiler installation is required for its npm build. It does not replace the target network validator.

For a machine without Node/npm, missing packages, blocked downloads or insufficient system privileges, first follow [environment setup](environment-setup.md). It maps each missing capability to a local route, an install/check command and useful work that can continue. Do not install every native tool reported absent by doctor.

## What each component does

| Stage | Role | Included reference |
|---|---|---|
| Headers | Exact API signatures, field/type/error constants | `@xahau/hooks-cli@3.0.0` C headers |
| C compiler/linker | Compile freestanding C and link WASM | `hooks-compiler@0.2.0` using its locked WASM compiler dependencies |
| Optimizer | Reduce size and simplify code | Locked compiler dependency |
| Cleaner | Produce the Hook-shaped module | Locked compiler dependency |
| Guard checker | Validate production structure, guards and worst-case paths | Pinned `Xahau/xahaud` source, checksum verified by `setup-guard.mjs` |
| Node validation | Apply rules supported by a particular network | Project's node/API; separate step |

`wasmcc` is one compiler front-end, not a required executable name. Native `clang --target=wasm32`/`wasm-ld`, `wasm-opt`, and a compatible cleaner are another route. Do not require “clang 18” for every toolchain: the selected headers, output and validator must agree. Community alternatives include [Hooks Toolkit](https://hooks-toolkit.com/) and [Hooks Builder](https://builder.xahau.network/); they are not the tested path bundled here.

## Prerequisites

Node.js 20+ and npm for the compiler; Linux/WSL with `g++` for the checker. On Ubuntu, install the system C++ build tools through your normal package manager, e.g. `sudo apt-get install build-essential`. This skill does not execute package-manager elevation automatically.

Run from the skill root. Outputs below are disposable and ignored by Git:

```sh
npm ci --ignore-scripts --no-audit --no-fund --prefix assets/toolchain
node scripts/doctor.mjs
mkdir -p build
node assets/toolchain/compile.mjs --source assets/examples/minimal.c --out build/minimal
node scripts/setup-guard.mjs --out build/guard
node scripts/inspect-artifact.mjs --wasm build/minimal/hook.cleaned.wasm --policy assets/minimal-artifact-policy.json --guard build/guard/guard_checker
```

`compile.mjs` refuses an existing output directory; choose another directory for a new build. It reads adjacent `.h` files, records source/header and lock hashes, and emits cleaned WASM, hex, metadata and logs. It does **not** patch the compiler to force arbitrary helpers inline. Production restrictions still apply; review a complex project's inlining/dispatch design instead of borrowing a hidden workaround.

Checker provenance is pinned in `assets/toolchain/guard-sources.json`. The setup tool downloads only the listed files at that revision, verifies their hashes, compiles them and keeps the upstream license. Its build success is not guard validation of any particular hook. If the target node is newer or uses different rules, select and review a compatible checker revision; the included pin is a reproducible baseline, not an automatic assertion of current network equivalence.

### Windows

The npm compiler can run on Windows. The checker built here is a Linux executable. With an installed Ubuntu WSL distribution and `g++`:

```powershell
node scripts/setup-guard.mjs --out build/guard --wsl Ubuntu
node scripts/inspect-artifact.mjs --wasm build/minimal/hook.cleaned.wasm --policy assets/minimal-artifact-policy.json --guard build/guard/guard_checker --wsl Ubuntu
```

The adapter uses executable argument arrays, not a shell command. It accepts local drive paths; UNC/network paths are not supported. Alternatively run the entire workflow inside WSL with Linux Node/npm. Do not mix a Linux `node_modules` tree with a native Windows installation when a dependency has platform-specific binaries.

## Optional Docker route

Docker Desktop must have a Linux daemon running. From the skill root:

```sh
docker build -f assets/toolchain/Dockerfile -t xahau-hooks-dev-toolchain:1.1 .
node scripts/doctor.mjs --docker --image xahau-hooks-dev-toolchain:1.1
mkdir -p build
docker run --rm --network none --mount "type=bind,source=$PWD/assets/examples,target=/src,readonly" --mount "type=bind,source=$PWD/build,target=/out" xahau-hooks-dev-toolchain:1.1 --source /src/minimal.c --out /out/minimal-docker
```

These mount commands are POSIX-shell examples. In PowerShell use absolute paths or `${PWD}`-appropriate expansion; all source mounts should remain read-only. The Dockerfile pins its base digest and npm lock. Record the resulting image ID/digest in the project; a local tag alone is mutable.

`doctor --docker` checks the daemon only. `--image NAME` additionally inspects that explicit existing local image. Neither option pulls an image or proves it can compile a hook. Docker compilation still requires separate artifact/guard/node validation. The Docker branch was not executed during this release because its daemon was unavailable; the npm branch was executed.

See [build/resource guidance](build.md) and [verification evidence](../VERIFICATION.md).
