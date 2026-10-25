# Xahau Hooks Development

A reusable agent skill for designing, writing, building, reviewing, debugging, and operating C/WASM Hooks on Xahau. Version **1.0.0**.

It includes direct on-chain reads and transaction-based writes, beginner C guidance, small source examples, diagnostic tools, and evidence templates. It does **not** implement an application SDK, wallet adapter, indexer, or a universal deployment client.

## Installation

Extract the archive and copy its `xahau-hooks-dev` directory into the skills directory supported by your agent. For Codex, the normal user location is:

```text
~/.codex/skills/xahau-hooks-dev/
    SKILL.md
    README.md
    agents/
    references/
    scripts/
    assets/
    tests/
```

On Windows this is normally `%USERPROFILE%\.codex\skills\xahau-hooks-dev`. If `CODEX_HOME` is customized, use its `skills` directory. Refresh/restart the agent session if it does not discover the new skill. Other agents can read `SKILL.md` directly; discovery mechanisms and metadata support vary by host.

The skill is portable: it contains no project addresses, seeds, RPC presets, private environment files, or dependencies on a particular repository. Keep the `references`, `assets`, and `scripts` directories alongside `SKILL.md` when moving it.

## Agent discovery and invocation

`SKILL.md` contains the machine-readable name and description. `agents/openai.yaml` provides Codex display metadata and a default prompt. Automatic discovery is enabled, but it does not authorize deploying or spending funds.

Invoke explicitly with `$xahau-hooks-dev`. For a host without skill discovery, use:

```text
Read /path/to/xahau-hooks-dev/SKILL.md and follow it for the task below.
Only load the references relevant to this task.
Project: /path/to/project
Task: ...
Permitted changes and network actions: ...
```

### Create a hook

```text
Use $xahau-hooks-dev to create a minimal owner-controlled settings hook.
Project: /path/to/project. Target: my configured Xahau test network.
I am new to C: explain buffer lengths and API return checks beside the code.
Define operations, state layout, errors and invariants first; implement and test.
Build and validate the production artifact if the required tools are available.
Do not deploy or submit transactions. Report unverified assumptions explicitly.
```

### Review and fix

```text
Use $xahau-hooks-dev to review hook/ against protocol/.
Focus on authorization, pointer/length safety, guard budgets, state cleanup,
weak execution, pending/refund recovery, and production-WASM behavior.
Reproduce each actionable finding before fixing it where feasible.
Changes may touch hook/ and tests/; do not change the protocol or deploy.
Report severity, trigger, impact, location, evidence and remaining gaps.
```

### Investigate a build failure

```text
Use $xahau-hooks-dev to diagnose the guard-check failure in this build log.
Inspect the exact cleaned artifact and pinned compiler/checker versions.
Do not weaken validation, arbitrarily raise guards, or assume exported helpers
are accepted by production. Propose or implement the smallest verified fix.
```

### Read and write a hook

```text
Use $xahau-hooks-dev to document and demonstrate direct RPC reads and writes
for the operations defined in this project's protocol. Show key derivation,
byte decoding, Invoke or Payment fields, and transaction result interpretation.
Use my explicit endpoint/network configuration. Prepare unsigned writes only.
Do not create an SDK or indexer and do not sign or submit transactions.
```

### Deploy or upgrade

```text
Use $xahau-hooks-dev to deploy the reviewed artifact to the test network
specified in config, using the signer already configured for this task.
Verify network identity, artifact/checker evidence, hook configuration and fees.
Preserve existing state. Submit once, verify installed hashes, run the documented
bootstrap and smoke checks, and report transaction hashes and state readback.
Stop on unexplained failure; do not deploy mainnet or print signing secrets.
```

These are prompts, not permissions granted by installing the skill. Adapt paths, scope, target network, and desired outcome before use.

## Contents and learning path

1. [Architecture](references/architecture.md): operations, roles, state machines, project organization.
2. [C essentials](references/c-essentials.md): pointers, lengths, integers, binary data, lifetime.
3. [Runtime/API contracts](references/runtime.md): return values, routing, slots, execution phases.
4. [Build/resources](references/build.md): guards, inlining, memory, reproducible toolchains.
5. [State](references/state.md): layouts, key derivation, inventories, migration.
6. [Emit/recovery](references/emit.md): asynchronous outcomes and idempotent compensation.
7. [Read/write](references/read-write.md): RPC, unsigned transaction construction, result handling.
8. [Deployment](references/deployment.md): install, bootstrap, smoke and upgrade.
9. [Testing/debugging](references/testing.md): probes, failure injection, troubleshooting.
10. [Compatibility/sources](references/compatibility.md): authoritative references and version boundaries.

Beginners should start with C essentials, then [examples](assets/examples/README.md). References are loaded on demand rather than injected together.

## Bundled tools

Requires Node.js **20+**. There are no third-party npm dependencies. Run commands from this skill directory or use absolute script paths.

```sh
node scripts/doctor.mjs
node scripts/doctor.mjs --docker
node scripts/init-project.mjs --out /new/project/path --name my-hook
node scripts/inspect-artifact.mjs --wasm /path/to/final.wasm --policy assets/minimal-artifact-policy.json
node scripts/inspect-artifact.mjs --wasm /path/to/final.wasm --policy /path/to/project-policy.json --guard /path/to/guard_checker
node scripts/decode-state.mjs --layout assets/state-layout.example.json --hex 01000000000000002A
node scripts/read-state.mjs --config /path/to/network.json --account rAddress --namespace HEX64 --out snapshot.json
node scripts/summarize-tx.mjs --file /path/to/tx-response.json
node --test tests/tools.test.mjs
node scripts/validate-package.mjs
```

- Artifact inspection without a guard checker reports **NOT_RUN** for the guard stage. A structural PASS is not a deployment PASS. Without a policy it reports observations and exits 2.
- Project initialization creates only a new source/documentation layout. Its parent must exist; an existing destination is refused. It does not install a toolchain, initialize Git or touch a network.
- The sample artifact policy accepts only the minimal pass-through example. Derive other policies from reviewed source and the target API; do not expand the policy just to silence an unknown import/export.
- `read-state` requires an explicit **HTTP(S)** JSON-RPC endpoint and expected network ID. It makes no WebSocket subscription, signs nothing, and reads no wallet configuration. Network ID must be returned by `server_info`; otherwise it fails closed. Use an endpoint with the required API rather than guessing the network.
- `summarize-tx` accepts a saved JSON `tx` response. `tesSUCCESS` alone does not prove the hook ran or that an emitted workflow completed.
- Commands emit JSON, errors to stderr, and nonzero exit codes on failure. No helper retries transaction submissions; there is no submission helper in this release.

The external guard checker must be executable in the same operating environment as Node. For a Linux checker on Windows, run Node and the inspection command inside WSL/Linux; the helper does not pass arbitrary shell commands. The success marker matches the reviewed checker family; a different checker output format needs an explicit reviewed adapter, not a false PASS. Import/export inspection checks names and kinds, not function signatures; the production validator remains required.

See [asset formats](assets/README.md) for configuration details. Tool tests use local fixtures and a mock HTTP server, never a live network.

## Evidence and compatibility

Use [the report template](assets/report-template.md). Keep compilation, static guard validation, native tests, mocked probes, node validation, live transactions, and recovery tests separate. Unavailable tools or untested phases remain **NOT_RUN**, not PASS.

This release's Node tools and portable C helper tests are locally verified; the bundled Hook entrypoints are **teaching source**, not prebuilt or independently network-certified contracts. No complete emitted-transaction serializer or callback implementation is shipped. Implement those only against the selected runtime contract and verify them on a suitable node.

See [release verification](VERIFICATION.md) for the actual checks and untested stages of this release.

Network capabilities and APIs evolve. The skill is not a frozen protocol specification: record the exact target headers, validator, amendments, toolchain, dependencies, artifact hashes and test evidence in each project. Consult [compatibility](references/compatibility.md) before adopting an example. A successful testnet deployment or review is not a mainnet certification.

## Maintenance and contributing

Add a rule when a reproducible failure demonstrates its value. Include symptom, cause, applicable versions, fix and regression coverage. Distinguish official rules from observed toolchain behavior. Avoid copying application-specific roles, constants or state keys into general guidance.

For changes, run the tool tests, validate local Markdown links and skill frontmatter, and execute any changed example at its claimed verification level. Never publish secrets, wallet seeds, real signing fixtures or private incident logs. Release archives should contain the skill folder, not runtime caches, `node_modules`, build outputs or local credentials.

## License

MIT; see [LICENSE](LICENSE). External documentation remains under its respective license and is linked rather than bundled. No third-party Hook source is vendored.
