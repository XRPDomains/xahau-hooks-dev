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
