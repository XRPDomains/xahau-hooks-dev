# Prebuilt minimal Hook: compiler-free teaching sample

This is the compiled [minimal.c](../minimal.c) pass-through Hook, **not** owner-setting or a replacement artifact for new/modified C. It accepts without storing application state. Use it to learn artifact inspection and unsigned first-install preparation on a machine without the optional compiler. Nothing in this walkthrough signs, funds or submits.

`minimal.wasm` is 171 bytes, SHA-256 `8edda57b05db46e794d11d0843e87551f5dfe13f00715baf3bb0c6463beb3b17`. [Provenance](minimal.provenance.json) records exact source/header/lock identities, compiler versions and the producer's pinned checker result. [Producer inspection](minimal.inspection.json) records structure/guard PASS and worst-case 30 instructions. Its diagnostic file paths identify the producer build; they are not executable paths required on your machine. Node acceptance and deployment remain NOT_RUN.

From the skill root, with Node 20+ and no npm dependencies:

```sh
node scripts/inspect-artifact.mjs --wasm assets/examples/prebuilt/minimal.wasm --policy assets/minimal-artifact-policy.json --out NEW_INSPECTION.json
node -e "const fs=require('node:fs'),c=require('node:crypto');const p=JSON.parse(fs.readFileSync('assets/examples/prebuilt/minimal.provenance.json'));const hash=c.createHash('sha256').update(fs.readFileSync('assets/examples/prebuilt/minimal.wasm')).digest('hex');if(hash!==p.artifact.sha256)throw Error('Prebuilt hash mismatch');console.log(hash)"
```

Replace output placeholders with new paths. The first command must report structural PASS and **guard NOT_RUN** when you supplied no checker. That does not supersede or relabel the separately recorded producer validation. Hash comparison detects corruption relative to the manifest; trust still comes from reviewing/pinning the repository revision, not from hashes stored beside untrusted bytes.

For an offline unsigned template, supply your actual **public** target account, namespace and network values. The following placeholders are not a funded wallet:

```sh
node scripts/prepare-sethook.mjs --wasm assets/examples/prebuilt/minimal.wasm --evidence assets/examples/prebuilt/minimal.inspection.json --account PUBLIC_TESTNET_ADDRESS --namespace HEX64_NAMESPACE --types Invoke --network-id 21338 --out NEW_UNSIGNED.json
```

This deliberately uses the bundled producer inspection for those exact bytes, allowing preparation without a local checker. The newly created structure-only report cannot substitute for a guard PASS. No seed or signing library is required. The output is a first-install draft, not a validated transaction; don't feed it into the owner-setting smoke contract because minimal.c does not write that setting.

If a compatible checker is available, independently execute it on `minimal.wasm` with `inspect-artifact --guard PATH` (plus `--wsl Ubuntu` on Windows) and retain a new report. Before any authorized installation, compare provenance/checker rules with the actual node, check network/account/fees/reserve and follow the [deployment workflow](../../../references/deployment.md). A producer's old checker PASS alone is not a claim of current network compatibility.

To reproduce the bytes with the optional compiler, compile `assets/examples/minimal.c` into a fresh directory and compare its SHA-256 and build manifest with provenance, then run the pinned checker on the original production WASM. Never alter C and keep using this sample to claim the changed code was built or audited. Binary Git attributes protect the WASM from text line-ending conversion.
