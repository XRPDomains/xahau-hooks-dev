# Installation and upgrade

## Prepare

Require task authorization for the particular network and action; never inherit an old project's deployment permission. Identify account, NetworkID, endpoint, signer mechanism, namespace(s), hook chain/order, activation masks and enabled amendments. Verify sufficient funds/reserve and a concrete fee budget. Public metadata and secrets belong in separate files.

Build from identified source with pinned tools. Record artifact SHA-256, size, import/export policy, checker output and relevant behavioral tests. A checker unavailable in this environment is a missing stage; do not label the artifact deployment-ready on structural validation alone. Where supported, validate against the target node as well.

Before upgrade, capture installed hook hashes/effective configuration and a validated namespace snapshot. Define how application invariants and pending operations survive the replacement. Plan forward recovery; redeploying older code is not automatically safe after new-format state writes.

## Submit and verify

Construct SetHook with the exact intended chain and namespace behavior. Replacing one hook must not accidentally erase other installations. Do not set deletion flags to achieve a routine upgrade. Review the serialized transaction, actual signer, fee and ledger expiry; submit once and retain its hash immediately.

Wait for a validated outcome. On connection failure, recover by hash before considering a new submission. On rejection, capture the full engine result and HookExecutions/validator output; stop dependent bootstrap/smoke steps. Do not vary flags, masks or artifact bytes by trial and error on a funded deployment.

Read installed configuration back from the ledger; verify effective namespaces, hashes, order and masks rather than just trusting SetHook success. Run protocol-defined bootstrap, verify state bytes at a validated ledger, then trigger the documented smoke input. Confirm the expected hook(s) actually executed and return code/string match the intended path.

## Deliver evidence

Report source revision, toolchain/checker identity, artifact digests/sizes, network/account, install/bootstrap/smoke hashes, validated ledger indices, hook traces, state-preservation comparison, retries and outstanding gates. Explorer links are conveniences, not the only evidence. Use network-configured explorer bases; do not tell a mainnet operator to use a testnet faucet.

No deployment helper is bundled: projects must supply their own reviewed SetHook/bootstrap/signing workflow. This avoids making a generic template silently replace a live chain or expose a signer.
