# Optional testnet transaction references

This directory is an opt-in example, not a universal deploy client. Install its locked `xahau@4.2.0` dependency with `npm ci --ignore-scripts --prefix assets/examples/deploy` from the skill root.

`submit-testnet.mjs` accepts only:

1. A plain single-hook first-install SetHook for an account with no installed hooks; matching structural/guard evidence is required.
2. The exact eight-byte self-Invoke used by `owner-setting.c`; an expected single installed HookHash is required.

It refuses replacement/deletion flags, prefilled Sequence/Fee and unrelated transaction fields. It does not bootstrap arbitrary projects, migrate namespaces, replace chains, perform recovery for an application or support mainnet. It checks server NetworkID, signer/account, installed hooks, a transaction-specific fee and the explicit cap before signing. It writes a journal with the signed transaction hash before exactly one submit call. It polls for validation; it never resubmits automatically.

Without `--submit` it performs offline review, reads no seed and makes no network requests. With `--submit`, it reads `XAHAU_TESTNET_SEED` from the process environment. No seed value is included in examples. Use a secure local secret mechanism or a session-only prompt rather than committing it or placing it in a shell command. See [quickstart](../../../QUICKSTART.md).

On timeout, the journal may remain `SIGNED_BEFORE_SUBMIT` even though submission reached the node. Read `tx` by its saved hash and check the ledger expiry before taking further action. Do not reuse or delete the journal merely to bypass this check. Validated engine success still requires application state readback; the reference emits installed-hook data for review rather than claiming a universal postcondition.

`read-state-websocket.mjs` is read-only. It uses the same identity checking and pinned-ledger pagination as the dependency-free HTTP reader. It permits explicitly configured mainnet reads. Neither it nor `doctor` needs a signer.

These examples are reviewed and offline-tested, but this release did not submit transactions. Verify the target node/API and run a controlled testnet trial before using a signing example operationally.

## Issuer examples

`prepare-issuer.mjs` creates unsigned URIToken or issued-TST teaching plans, with codec validation and explicit postconditions. `read-issuer-state.mjs` reads the expected token object or TST trust line on testnet at a pinned validated ledger. `verify-issuer.mjs` asserts a saved transaction result and readback against the fixed plan contract. These tools never sign or submit; they do not widen either submitter's accepted transaction types. Follow the [issuer walkthrough](../../../references/issuer-examples.md) for Hook sources, branches and verification boundaries.

## Module resolution

ES modules resolve `import 'xahau'` relative to the importing script, not the terminal cwd. Bundled scripts work from other directories when script/config paths are correct. `node -e 'import("xahau")'` resolves from cwd instead: run that inline probe inside `assets/examples/deploy` after installing its lock. For a project-owned script install `xahau` in that project. Moving a reference script alone breaks its relative imports to the skill's helpers; update those imports or retain the folder structure.

## Project operation template

`submit-project.mjs` is a separate Invoke template, with its protocol checks in `project-contract.mjs`. It demonstrates a sample `op=register`, ASCII `name`, UTF-8 HTTP(S) URL `value`; those fields are not a universal registration protocol. There is no corresponding deployable register Hook in this package. Adapt the validator to your reviewed Hook, including authorization and result semantics, before signing. See [project submitter instructions](../../../references/deployment.md#project-submitter-template).

The template checks expected Destination and installed HookHash, refuses other transaction fields, and retains testnet identity checks, explicit fee cap, hash journal and one submission. Validation requires successful HookExecution matching both account and hash. State readback and any emitted workflow remain project postconditions. Use a separate project workflow for Payment or asset operations; do not turn this validator into a permissive transaction pass-through.
