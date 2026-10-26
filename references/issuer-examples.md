# Issuer examples: URITokens and issued currency

These two small examples exercise **issuer-originating strong execution**. They are not a complete asset platform, an SDK or an emitted-transaction implementation. Transaction planning is offline; ledger operations require a separately reviewed project signing workflow. Neither existing reference signer accepts these asset transactions.

## Build and run offline first

Install only the tool dependencies needed by [environment setup](environment-setup.md). Commands below are from the skill root, using Linux/WSL; on native Windows append `--wsl DISTRO` to checker commands.

```sh
node assets/toolchain/compile.mjs --source assets/examples/uritoken-issuer.c --out build/uritoken-issuer
node scripts/inspect-artifact.mjs --wasm build/uritoken-issuer/hook.cleaned.wasm --policy assets/uritoken-issuer-artifact-policy.json --guard build/guard/guard_checker
node assets/toolchain/compile.mjs --source assets/examples/issued-token-issuer.c --out build/issued-token-issuer
node scripts/inspect-artifact.mjs --wasm build/issued-token-issuer/hook.cleaned.wasm --policy assets/issued-token-issuer-artifact-policy.json --guard build/guard/guard_checker
```

Use fresh output directories on subsequent builds. The tests distinguish real compilation/guard validation from mocked host behavior. Do not deploy a WASM variant exported for test memory inspection.

For first installation on a fresh issuer account, use the [unsigned SetHook preparer](../scripts/prepare-sethook.mjs) with that artifact's own policy evidence, a project namespace and `--types URITokenMint` or `--types Payment`, respectively. Use the calculator, not guessed masks. With the selected node supporting directional masks, configure issuer outgoing routing appropriately. Verify actual HookHash/account execution in a controlled authorized testnet install; fixture tests do not prove stakeholder routing.

## URIToken issuer

[uritoken-issuer.c](../assets/examples/uritoken-issuer.c) checks only mints originating from the Hook account: URI must be 8..200 bytes starting with `ipfs://`, and no transaction-specific mint flags are permitted. The common canonical signature flag is accepted. The initial example therefore does not opt into issuer burn authority. Other transaction types/minters pass; later sale/burn policy is not implemented by this Hook.

The sample URI is illustrative. The prefix check neither validates an IPFS CID nor fetches/verifies content availability.

Xahau uses [URITokens](https://xahau.org/docs/what-is-different/), not the XRPL XLS-20 mint/offer workflow. Under [URITokenMint's flag rules](https://xahau.network/docs/protocol-reference/transactions/transaction-types/uritokenmint/), owner burn and issuer burn authority are different rights. Disabling issuer burn authority at mint does not prevent the owner from burning. Do not promise an application owner check can override ledger authority.

Set public environment variables `ISSUER` and `HOLDER` to **distinct, funded disposable testnet addresses**. Then create an offline plan:

```sh
node assets/examples/deploy/prepare-issuer.mjs --kind uritoken --issuer "$ISSUER" --holder "$HOLDER" --uri ipfs://example-teaching-asset --out build/nft-plan.json
```

The plan derives the expected ID with the locked Xahau codec and contains unsigned transactions; it makes no connection. Execute one reviewed step at a time, validating and reading back before the next:

| Step | Transaction actor | Required postcondition |
|---|---|---|
| mint | Issuer, `URITokenMint` | Ledger object has expected ID, Issuer, URI and issuer Owner; no offer |
| offer | Current owner, `URITokenCreateSellOffer` | Owner stays issuer, Amount is 1000000 drops, Destination is holder |
| buy | Holder, `URITokenBuy` | Owner becomes holder; offer fields are removed |
| owner-burn | Holder, `URITokenBurn` | Exact ID is absent at a pinned validated ledger |
| cancel-instead-of-buy | Issuer, `URITokenCancelSellOffer`, alternate branch after offer | Issuer remains owner, offer is removed; buying the canceled offer must fail |

Offer creation is not ownership transfer. The cancel branch is an alternative to buy, not another step to submit after the full happy path. After cancellation, recreate an authorized offer if you want to continue buying. ID derivation is a prediction; reconcile it with mint metadata and the actual ledger object.

Negative cases: wrong URI prefix, oversized URI, burnable mint flag, duplicate mint, wrong buyer for a destination-restricted offer, insufficient buy amount, canceled offer and former owner's burn after a sale. The first three are Hook policy checks; the others depend on the ledger and account state. Test their actual engine results on the selected node instead of hardcoding one universal error code.

For pending/recovery, retain the mint hash before submit. After a timeout, query that hash and the predicted ID before considering another mint. If an application later emits mint/sale transactions, persist correlation/pending state and reconcile child results/ownership; these direct-transaction examples do not implement a callback or refund. See [emit recovery](emit.md).

## Issued-currency issuer

[issued-token-issuer.c](../assets/examples/issued-token-issuer.c) checks issuer-originating `Payment`: native XAH expenses pass; issued amounts must be **TST from this issuer**, positive and <=100 per transaction. It checks the 48-byte issued-amount layout, exact 20-byte currency/issuer and XFL API results, and rejects transaction-specific flags including partial payment. Incoming payments pass, permitting redemption. This is a per-Payment teaching limit, not an outstanding-supply cap: repeated payments, DEX/Remit or another issuance path are outside the example.

Use three distinct funded accounts and fresh TST trust lines. Issuer account configuration is an explicit project decision: this simple case assumes no authorization/freeze/clawback/transfer-fee policy and a suitable rippling configuration for holder-to-holder transfers. Review and set the needed AccountSet options before issuing; do not reset an existing issuer. The planner does not change account settings.

For this fresh-account teaching route, explicitly enable the issuer's `asfDefaultRipple` before holders create their lines: the unsigned operation is `{"TransactionType":"AccountSet","Account":"YOUR_ISSUER","NetworkID":21338,"SetFlag":8}`. Validate it against the selected library/node, use the project signer only when authorized, and read `account_info.account_data.Flags` at a validated ledger to confirm `lsfDefaultRipple` (`0x00800000`). Do not set RequireAuth for this simplified route; it needs a separate authorization sequence. These are [account configuration choices](https://xahau.network/docs/protocol-reference/transactions/transaction-types/accountset/), not fields to append to the issuance Payment.

```sh
node assets/examples/deploy/prepare-issuer.mjs --kind token --issuer "$ISSUER" --holder "$HOLDER" --recipient "$RECIPIENT" --out build/token-plan.json
```

| Step | Actor / input | Required postcondition |
|---|---|---|
| holder-trust / recipient-trust | Each holder sends TrustSet for TST/issuer, limit 1000 | Matching line exists with zero initial balance |
| issue | Issuer pays holder 10 TST | Holder-perspective balance is 10 |
| transfer | Holder pays recipient 2 TST | Recipient balance is 2; separately verify holder balance is 8 |
| redeem | Recipient returns 2 TST to issuer | Recipient balance is zero; holder remains 8 |

Amounts are decimal **strings** with `(currency, issuer)` identity. They are not native drops and must not pass through JavaScript Number or integer-drop arithmetic. [Payment](https://xahau.network/docs/protocol-reference/transactions/transaction-types/payment/) and [TrustSet](https://xahau.network/docs/protocol-reference/transactions/transaction-types/trustset/) define the ledger operations; missing trust lines or incorrect account settings can reject a valid-looking plan. A zero-balance trust line need not disappear.

Negative cases: issue >100, zero/negative amount, wrong currency/issuer, native XAH versus issued asset confusion, partial-payment flag, missing trust line and transfer without sufficient balance. Mocked WASM tests cover the Hook branches. Trust-line/rippling/reserve behavior, delivered amount and transfer/redemption require node/live tests. For holder-to-holder transfers, do not assume the issuer is a strong stakeholder or can universally veto; inspect target amendments and actual traces. [Weak/strong documentation](https://xahau.network/docs/hooks/concepts/weak-and-strong/) can lag amendments, so pin the node behavior for URIToken owner/issuer operations too.

## Read and verify saved evidence

`build/network.json` must explicitly contain `{"networkId":21338,"websocket":"wss://YOUR_TESTNET_PROVIDER"}`. These read-only commands verify server NetworkID, obtain a validated ledger hash and pin every object/line page to it:

```sh
node assets/examples/deploy/read-issuer-state.mjs --config build/network.json --kind uritoken --token-id HEX64 --out build/nft-readback.json
node assets/examples/deploy/read-issuer-state.mjs --config build/network.json --kind token --account "$HOLDER" --issuer "$ISSUER" --out build/token-readback.json
node assets/examples/deploy/verify-issuer.mjs --plan build/nft-plan.json --step mint --snapshot build/nft-readback.json --receipt build/mint-tx-result.json
node assets/examples/deploy/verify-issuer.mjs --plan build/token-plan.json --step issue --snapshot build/token-readback.json --receipt build/issue-tx-result.json
```

Replace HEX64 with `identity.tokenId` from the plan. Save the raw `tx` **result object** with `validated`, `ledger_index`, transaction fields/`tx_json` and `meta`; unwrap `result` first if needed. Verification rebuilds expectations from the fixed example contract, checks receipt transaction identity, then readback at or after its ledger. It does not authenticate user-edited JSON; retain trusted RPC provenance. Do not use a snapshot taken before the transaction, a different issuer/currency, or an issuer-perspective balance to claim a holder balance.

For each applicable issuer-originating mint/issue, also assert expected HookAccount/HookHash and return code using the project's installed identity. These examples do not require a HookExecution for buyer/trust-line operations where the selected configuration does not run the issuer Hook. Neither `tesSUCCESS` nor a matching saved fixture proves all subsequent operations work.

## Verification boundary

No signing or live ledger mutation is performed by these tools. Real npm build and pinned production guard-check are separate from mocked WASM probes and offline Xahau codec fixtures. Live installation, actual trust-line changes, owner transfer/burn and failure recovery remain NOT_RUN until executed with explicit testnet authorization in a project.
