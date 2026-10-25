import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {args, main, print, required} from './lib.mjs';
main(() => {
  const a=args(process.argv.slice(2),['--out','--name'],['--help']);
  if(a['--help'])return print({usage:'node init-project.mjs --out /new/project/path --name my-hook',
    note:'Creates a new source layout only; no toolchain installation, git initialization, network access or deployment. Refuses an existing destination. Parent directory must exist.'});
  const out=path.resolve(required(a['--out'],'--out'));
  const name=required(a['--name'],'--name');
  if(!/^[a-z][a-z0-9-]{0,62}$/.test(name))throw new Error('Use a lowercase project name, 1..63 characters');
  if(fs.existsSync(out))throw new Error('Destination already exists; no files changed');
  if(!fs.statSync(path.dirname(out)).isDirectory())throw new Error('Parent must be an existing directory');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  // Read bundled assets before creating anything, so a broken package fails cleanly.
  const contract=fs.readFileSync(path.join(root,'assets/project-contract.md'),'utf8');
  const minimal=fs.readFileSync(path.join(root,'assets/examples/minimal.c'),'utf8');
  const files={
    'README.md':`# ${name}\n\nXahau Hook project scaffold. No production build or deployment has been performed.\n\n1. Complete protocol/contract.md.\n2. Select and pin headers, compiler, optimizer, cleaner and guard checker.\n3. Replace the teaching hook with the reviewed operations and tests.\n4. Verify the cleaned artifact and target network before any authorized deployment.\n\nSee docs/architecture/README.md and docs/review/README.md.\n`,
    '.gitignore':'hook/build/\nnode_modules/\n.env\n.env.*\n*.seed\n*.pem\n',
    'protocol/contract.md':contract,
    'hook/src/hook.c':minimal,
    'hook/toolchain/README.md':'# Toolchain\n\nRecord immutable image/repository identities, headers, versions, commands, expected imports/exports and validator limits here. No compiler or checker is installed by this scaffold.\n',
    'tests/README.md':'# Verification\n\nOrganize native helper tests, production-WASM probes, node tests and live evidence separately. Begin with invariants from protocol/contract.md. Record NOT_RUN stages explicitly.\n',
    'scripts/README.md':'# Project operations\n\nAdd reviewed build and direct RPC scripts here. Keep signer configuration external. Require explicit target network and account for writes.\n',
    'deployments/README.md':'# Public deployments\n\nStore network-specific artifact identity, installed HookHashes/configuration, transaction hashes and verification evidence. Do not store seeds or infer a deployment from a local build.\n',
    'docs/architecture/README.md':'# Architecture\n\nDocument execution routing, operation authority, state lifecycle, key/layout versions and recovery invariants. Use protocol/contract.md as the application contract.\n',
    'docs/review/README.md':'# Review evidence\n\nKeep actionable findings, reproductions, fixes, regression results and unresolved production gates here. Separate static, mocked and native evidence.\n'
  };
  fs.mkdirSync(out);
  for(const [relative,content] of Object.entries(files)){
    const destination=path.join(out,relative);fs.mkdirSync(path.dirname(destination),{recursive:true});
    fs.writeFileSync(destination,content,{flag:'wx'});
  }
  print({directory:out,files:Object.keys(files).length,result:'SOURCE_SCAFFOLD_CREATED',build:'NOT_RUN',deployment:'NOT_RUN'});
});
