# First Hook on Windows PowerShell and Cursor

Start with local lint -> build -> guard, without a wallet or faucet. Compilation runs in Windows Node; the verified checker route runs in Ubuntu WSL. This is a PowerShell 5.1/7 walkthrough. Missing Node/npm, Ubuntu or `g++`? Follow [environment setup](environment-setup.md) first; then [toolchain setup](toolchain-setup.md). No script installs WSL or elevates system packages automatically.

## Cursor discovery (optional setup)

A Codex installation alone does not establish Cursor discovery. Cursor documents project `.cursor/skills/` and personal `~/.cursor/skills/`; see [Cursor Skills](https://cursor.com/docs/skills). To install a separate personal checkout explicitly, run this once:

```powershell
$skillDir = Join-Path $env:USERPROFILE '.cursor\skills\xahau-hooks-dev'
if (Test-Path -LiteralPath $skillDir) { throw 'Skill already exists; inspect its version/local changes before updating.' }
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $skillDir) | Out-Null
git clone https://github.com/XRPDomains/xahau-hooks-dev.git $skillDir
if ($LASTEXITCODE -ne 0) { throw 'Clone failed.' }
```

Review the checkout and pin a trusted commit if reproducibility matters. A clone of the default branch is not a version pin. Preserve local changes when updating; do not overwrite another installation blindly. The whole skill folder is needed, not only SKILL.md. For project-scoped discovery, use `<project>\.cursor\skills\xahau-hooks-dev` instead; do not install both scopes unnecessarily. Restart/refresh Cursor and check its Skills settings or slash menu. Directly asking the Agent to read the absolute SKILL.md path is a fallback, not proof that slash discovery works.

A project rule is optional when skill discovery is insufficient. Create a rule through Cursor's rule UI, scoped by description to Xahau Hook work, with the body: `For Xahau C/WASM Hook work, read <actual installed skill path>/SKILL.md and follow its task routing.` Replace the path; avoid forcing the whole skill into unrelated tasks. [Cursor Rules](https://cursor.com/docs/rules) describes the `.mdc` format and activation settings. Installing a skill/rule does not establish behavioral evaluation of Cursor.

## Prepare local tools

Work from the skill checkout, either your repository or the installation above. Replace this example location with the actual one:

```powershell
Set-Location 'C:\work\xahau-hooks-dev'
node scripts/doctor.mjs --wsl Ubuntu --guard build/guard/guard_checker
if ($LASTEXITCODE -ne 0) { throw 'Doctor command failed; inspect diagnostics.' }
npm ci --ignore-scripts --no-audit --no-fund --prefix assets/toolchain
if ($LASTEXITCODE -ne 0) { throw 'Compiler dependency installation failed.' }
if (-not (Test-Path -LiteralPath 'build/guard/guard_checker')) {
    node scripts/setup-guard.mjs --out build/guard --wsl Ubuntu
    if ($LASTEXITCODE -ne 0) { throw 'Checker setup failed; inspect its output before retrying.' }
}
```

Doctor's exit status is not a readiness certificate: inspect its per-task results. An existing checker path is not evidence of validation; check its pinned provenance, then let the pipeline execute it. If a partial setup directory exists but no checker was produced, inspect it and select a fresh checker output path rather than deleting evidence automatically. No deploy dependencies are needed for this local route.

PowerShell's `$ErrorActionPreference = 'Stop'` alone does not reliably stop failed native commands across versions. The explicit `$LASTEXITCODE` checks above stop dependent steps. Commands use `--out`/pipeline evidence instead of shell redirection.

## Run the first local pipeline

```powershell
$run = 'build/first-hook-' + [guid]::NewGuid().ToString('N')
node scripts/agent-pipeline.mjs --source assets/examples/owner-setting.c --policy assets/owner-setting-artifact-policy.json --guard build/guard/guard_checker --wsl Ubuntu --work $run --testnet
if ($LASTEXITCODE -ne 0) { throw "Pipeline stopped; inspect $run/evidence.json and stage logs." }
$evidence = Get-Content -LiteralPath (Join-Path $run 'evidence.json') -Raw | ConvertFrom-Json
if ($evidence.result -ne 'LOCAL_VALIDATION_ONLY') { throw 'Unexpected pipeline result.' }
$evidence.stages | ConvertTo-Json -Depth 8
```

`--testnet` is the pipeline's required target declaration; without `--submit`, it does not fund, sign or submit a transaction. Expect lint/build/guard PASS, and tests/wallet/reserve/install/smoke/readback NOT_RUN. This first milestone verifies the production artifact against the selected checker, not business correctness or acceptance by a network node. Add reviewed source-specific tests later with `--run-tests --tests-file <project.test.mjs>`; tool tests alone do not prove your Hook's logic.

Fresh output directories protect against mixing old artifacts or overwriting evidence. A generated name is appropriate for repeated **local** builds. For a fee-bearing run with an unknown result, keep the original journals and recover by hash; never choose a new directory merely to bypass replay protection. No automatic checker weakening or retry is needed to make the local workflow approachable.

## Continue only when needed

For offline business tests, try [the contact-book mock/schema example](offline-framework.md). For testnet install/write/readback, use the [configured pipeline](agent-workflow.md#pipeline-authorized-install-smoke-and-readback) with a reviewed contract, a private cached disposable wallet and explicit fee/reserve budgets. The cache workflow avoids a Bash `read -s` seed prompt. Funding and submission are separate authorized steps. PowerShell public environment values use `$env:NAME = 'value'`; do not paste private seeds into commands or transcripts.

If using the longer [POSIX quickstart](../QUICKSTART.md), keep its shell syntax in Bash/WSL. Do not translate only `export` while leaving Bash command substitutions in a PowerShell session. Run bundled scripts by path; inline `import('xahau')` still resolves from the deploy dependency directory.
