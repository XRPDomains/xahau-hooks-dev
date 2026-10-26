# Configuration and templates

`contact-book.interface.json` and `contact-book.mock.json` pair with the C example and its artifact policy; see [offline framework](../references/offline-framework.md). `auto-forward-artifact-policy.json` and `auto-forward-evidence.json` pair with the runtime-pinned [emit/callback walkthrough](../references/auto-forward.md). Evidence labels distinguish mocks, production guard validation and standalone ledger execution.

`minimal-artifact-policy.json` is deliberately narrow: only the minimal pass-through Hook's imports/exports, with a conservative example byte budget. The budget is not a universal network limit. Add reviewed APIs only when the project uses them and the selected validator supports them. Policies require `maxBytes`, `allowedImports`, `requiredImports`, `allowedExports`, and `requiredExports`. Symbols include kind, e.g. `env.accept:function`.

`owner-setting-artifact-policy.json` covers the separate owner-setting example. Optional build recipes are in [toolchain](../references/toolchain-setup.md); optional testnet signing/WebSocket examples are in [deploy](examples/deploy/README.md). They have independent exact npm locks and do not change the dependency-free core scripts.

`state-layout.example.json` encodes a one-byte version followed by a BE uint64. The decoder supports fixed layouts with complete non-overlapping coverage, including explicit reserved bytes. A BE uint64 becomes a decimal string to avoid JavaScript precision loss. The decoder reports values; the caller must validate supported versions and business constraints.

Create a network config outside the skill using this shape:

```json
{
  "endpoint": "https://YOUR-NODE-HTTP-RPC-ENDPOINT",
  "networkId": 21338,
  "timeoutMs": 15000,
  "maxPages": 100
}
```

The network ID above is an example, not a default. Replace endpoint and ID with the intended network. HTTP RPC and WebSocket URLs are not interchangeable. Credentials in URLs are refused; this simple reader does not implement authenticated providers. The server must expose its matching network ID; otherwise the tool stops. It writes a snapshot only after all pages succeed and refuses to overwrite an existing file.

Use `project-contract.md` before building, and `report-template.md` when delivering evidence. They are templates to complete, not claims of verification.
