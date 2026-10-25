# Xahau Hooks Development

A reusable Agent Skill for designing, writing, building, reviewing, debugging, and operating C/WASM Hooks on Xahau. Use it with **Claude Code, Cursor, Codex**, or another agent that can read local Markdown and run the required tools. Version **1.1.0**.

It includes direct on-chain reads and transaction-based writes, beginner C guidance, small source examples, diagnostic tools, and evidence templates. It does **not** implement an application SDK, wallet adapter, indexer, or a universal deployment client.

**New to Hooks? Start with [QUICKSTART.md](QUICKSTART.md)**: install the optional compiler, build and guard-check a small hook, prepare a testnet install, explicitly sign/submit, write a setting and read its state back. Optional examples are restricted to a fresh testnet installation; they never automatically deploy an existing project.

## Installation

Clone this repository, download its source, or extract a release archive. Install the **whole skill folder**, named `xahau-hooks-dev`, at one of the locations below. Project paths are relative to the project where you want to use the skill; personal paths are relative to your home directory.

| Agent | Project installation | Personal installation | Explicit invocation |
|---|---|---|---|
| Claude Code | `.claude/skills/xahau-hooks-dev/` | `~/.claude/skills/xahau-hooks-dev/` | `/xahau-hooks-dev` |
| Cursor | `.cursor/skills/xahau-hooks-dev/` | `~/.cursor/skills/xahau-hooks-dev/` | Type `/` in Agent chat and select `xahau-hooks-dev` |
| Codex | `.agents/skills/xahau-hooks-dev/` | `~/.agents/skills/xahau-hooks-dev/` | `$xahau-hooks-dev` |
| Other agents | A readable local directory | A readable local directory | Use the direct-file prompt below |

Choose one installation per agent/scope to avoid conflicting copies. Some existing Codex installations also use `~/.codex/skills/`; keep a working installation there if your host discovers it. Do not assume one agent reads another agent's directories.

The installed structure should look like:

```text
xahau-hooks-dev/
    SKILL.md
    README.md
    agents/
    references/
    scripts/
    assets/
    tests/
```

On Windows, `~` normally corresponds to `%USERPROFILE%`; for example, Claude Code's personal installation is `%USERPROFILE%\.claude\skills\xahau-hooks-dev`. Refresh/restart the agent session if the skill does not appear. Check your host's current documentation for custom directories, managed installations, or remote environments.

For example, to install directly from GitHub for Claude Code on macOS/Linux:

```sh
mkdir -p ~/.claude/skills
git clone https://github.com/XRPDomains/xahau-hooks-dev.git ~/.claude/skills/xahau-hooks-dev
```

For Cursor or Codex, use the corresponding destination from the table. Run this only when the destination does not exist. Review and pin a trusted revision when reproducibility matters; cloning the default branch is not a version pin.

Installation paths and invocation are documented by [Claude Code](https://code.claude.com/docs/en/skills), [Cursor](https://cursor.com/docs/skills), and [Codex](https://learn.chatgpt.com/docs/build-skills). These are installation instructions, not a claim that this release has been behaviorally tested in all three agents.

The skill is portable: it contains no project addresses, seeds, RPC presets, private environment files, or dependencies on a particular repository. Keep the `references`, `assets`, and `scripts` directories alongside `SKILL.md` when moving it.

## Agent discovery and invocation

`SKILL.md` is the shared entrypoint: its name and description help compatible hosts select the skill, and its body routes the agent to relevant references. `agents/openai.yaml` is optional Codex-specific metadata; other hosts do not need it to follow the shared instructions. Discovery and permission behavior remain controlled by each host.

Use your agent's invocation from the table, followed by the task. The task prompts below deliberately avoid host-specific command syntax. For an agent without native skill discovery, start with this direct-file prompt:

```text
Read /path/to/xahau-hooks-dev/SKILL.md and follow it for the task below.
Only load the references relevant to this task.
Project: /path/to/project
Task: ...
Permitted changes and network actions: ...
```

Replace the paths and task fields before sending. The agent must be able to read the skill and project directories. Running the bundled tools requires a terminal with Node.js 20+; compiling and deploying Hooks requires the project's separate toolchain and network access. A chat-only agent can discuss the instructions but cannot verify local builds or submit transactions without those capabilities.

For repeated use, add a short pointer to the project's supported instruction file, such as `CLAUDE.md`, `AGENTS.md`, or a Cursor project rule:

```text
For Xahau C/WASM Hook tasks, read /path/to/xahau-hooks-dev/SKILL.md first.
Load only the references needed for the task. Follow this project's protocol
and respect the network actions explicitly authorized for the current task.
```

Installing or invoking the skill does not authorize deployment, signing, or spending funds. Xahau blockchain Hooks in this package are unrelated to agent lifecycle hooks provided by coding tools.

### Create a hook

```text
Use the xahau-hooks-dev skill to create a minimal owner-controlled settings hook.
Project: /path/to/project. Target: my configured Xahau test network.
I am new to C: explain buffer lengths and API return checks beside the code.
Define operations, state layout, errors and invariants first; implement and test.
Build and validate the production artifact if the required tools are available.
Do not deploy or submit transactions. Report unverified assumptions explicitly.
```

### Review and fix

```text
Use the xahau-hooks-dev skill to review hook/ against protocol/.
Focus on authorization, pointer/length safety, guard budgets, state cleanup,
weak execution, pending/refund recovery, and production-WASM behavior.
Reproduce each actionable finding before fixing it where feasible.
Changes may touch hook/ and tests/; do not change the protocol or deploy.
Report severity, trigger, impact, location, evidence and remaining gaps.
```

### Investigate a build failure

```text
Use the xahau-hooks-dev skill to diagnose the guard-check failure in this build log.
Inspect the exact cleaned artifact and pinned compiler/checker versions.
Do not weaken validation, arbitrarily raise guards, or assume exported helpers
are accepted by production. Propose or implement the smallest verified fix.
```

### Read and write a hook

```text
Use the xahau-hooks-dev skill to document and demonstrate direct RPC reads and writes
for the operations defined in this project's protocol. Show key derivation,
byte decoding, Invoke or Payment fields, and transaction result interpretation.
Use my explicit endpoint/network configuration. Prepare unsigned writes only.
Do not create an SDK or indexer and do not sign or submit transactions.
```

### Deploy or upgrade

```text
Use the xahau-hooks-dev skill to deploy the reviewed artifact to the test network
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

First-run guides: [toolchain setup](references/toolchain-setup.md), [HookOn calculator](references/hookon.md), [funding/fees/reserve](references/funding-and-fees.md), [common errors](references/first-run-errors.md), and [testnet signing references](assets/examples/deploy/README.md).

Beginners should start with C essentials, then [examples](assets/examples/README.md). References are loaded on demand rather than injected together.

## Bundled tools

Requires Node.js **20+**. Core scripts have no third-party npm dependencies. The optional compiler and signing/WebSocket examples have their own exact dependency versions and locks; see [toolchain setup](references/toolchain-setup.md) and [the deployment reference](assets/examples/deploy/README.md). Run commands from this skill directory or use absolute script paths.

```sh
node scripts/doctor.mjs
node scripts/doctor.mjs --docker
node scripts/doctor.mjs --docker --image xahau-hooks-dev-toolchain:1.1
node scripts/hookon.mjs --types Payment,Invoke
node scripts/init-project.mjs --out /new/project/path --name my-hook
node scripts/inspect-artifact.mjs --wasm /path/to/final.wasm --policy assets/minimal-artifact-policy.json
node scripts/inspect-artifact.mjs --wasm /path/to/final.wasm --policy /path/to/project-policy.json --guard /path/to/guard_checker
node scripts/decode-state.mjs --layout assets/state-layout.example.json --hex 01000000000000002A
node scripts/read-state.mjs --config /path/to/network.json --account rAddress --namespace HEX64 --out snapshot.json
node scripts/summarize-tx.mjs --file /path/to/tx-response.json
node --test tests/tools.test.mjs tests/beginner-tools.test.mjs tests/optional-examples.test.mjs
node scripts/validate-package.mjs
```

- Artifact inspection without a guard checker reports **NOT_RUN** for the guard stage. A structural PASS is not a deployment PASS. Without a policy it reports observations and exits 2.
- Project initialization creates only a new source/documentation layout. Its parent must exist; an existing destination is refused. It does not install a toolchain, initialize Git or touch a network.
- The sample artifact policy accepts only the minimal pass-through example. Derive other policies from reviewed source and the target API; do not expand the policy just to silence an unknown import/export.
- `read-state` requires an explicit **HTTP(S)** JSON-RPC endpoint and expected network ID. The optional `assets/examples/deploy/read-state-websocket.mjs` supports WS(S) using the locked Xahau library. Both pin validated reads and check network identity; neither signs or subscribes. Use the appropriate transport rather than passing a WebSocket URL to the HTTP reader.
- `summarize-tx` accepts a saved JSON `tx` response. `tesSUCCESS` alone does not prove the hook ran or that an emitted workflow completed.
- Commands emit JSON, errors to stderr, and nonzero exit codes on failure. The optional testnet submission reference requires `--submit`, a matching signer, explicit fee cap and new journal; no helper automatically resubmits a transaction. Network writes require authorization for the current task.

The external guard checker must be executable in Node's operating environment, or use the explicit Windows `--wsl DISTRO` adapter for a Linux checker. No arbitrary shell commands are passed. The success marker matches the reviewed checker family; a different checker output format needs an explicit reviewed adapter, not a false PASS. Import/export inspection checks names and kinds, not function signatures; the production validator remains required.

See [asset formats](assets/README.md) for configuration details. Tool tests use local fixtures and a mock HTTP server, never a live network. The optional codec/signer tests report SKIP when their npm dependencies are absent; install that directory's lock to exercise them.

## Evidence and compatibility

Use [the report template](assets/report-template.md). Keep compilation, static guard validation, native tests, mocked probes, node validation, live transactions, and recovery tests separate. Unavailable tools or untested phases remain **NOT_RUN**, not PASS.

This release's core tools, portable C helpers and the optional npm builds of both small Hook examples are locally verified, including production guard validation. They remain teaching examples, not independently network-certified contracts. The optional signer was not exercised with live transactions; Docker and target-node validation are separate evidence stages. No complete emitted-transaction serializer or callback implementation is shipped.

See [release verification](VERIFICATION.md) for the actual checks and untested stages of this release.

Network capabilities and APIs evolve. The skill is not a frozen protocol specification: record the exact target headers, validator, amendments, toolchain, dependencies, artifact hashes and test evidence in each project. Consult [compatibility](references/compatibility.md) before adopting an example. A successful testnet deployment or review is not a mainnet certification.

## Maintenance and contributing

Add a rule when a reproducible failure demonstrates its value. Include symptom, cause, applicable versions, fix and regression coverage. Distinguish official rules from observed toolchain behavior. Avoid copying application-specific roles, constants or state keys into general guidance.

For changes, run the tool tests, validate local Markdown links and skill frontmatter, and execute any changed example at its claimed verification level. Never publish secrets, wallet seeds, real signing fixtures or private incident logs. Release archives should contain the skill folder, not runtime caches, `node_modules`, build outputs or local credentials.

## License

MIT; see [LICENSE](LICENSE). External documentation remains under its respective license and is linked rather than bundled. No third-party Hook source is vendored.
