import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {args,jsonFile,required,main,print,writeJSON} from './lib.mjs';
import {createInterface} from './interface-codec.mjs';
import {explorerProjections} from './explorer-abi-lib.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--schema','--wasm','--metadata','--out'],['--help']);
  if(a['--help'])return print({usage:'node scripts/export-explorer-abi.mjs --schema interface.json --out NEW_DIRECTORY [--wasm production.wasm] [--metadata manifest-fields.json]',note:'Offline, package-schema fixed layouts -> optional XahauWin state projections. Rejects hashed keys and variable-length state strings. No upload, signing or RPC. Directory --out is exclusive.'});
  const schema=jsonFile(required(a['--schema'],'--schema')),iface=createInterface(schema),converted=explorerProjections(schema);
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');let binding=null;
  if(a['--wasm']){
    const wasm=fs.readFileSync(a['--wasm']);if(!WebAssembly.validate(wasm))throw new Error('Invalid WASM');
    if(WebAssembly.Module.exports(new WebAssembly.Module(wasm)).some(e=>e.name==='__probe_memory'))throw new Error('Test probe WASM must not bind an explorer manifest');
    const artifactSha256=sha(wasm);if(schema.artifactSha256)iface.assertArtifact(artifactSha256);
    binding={artifactSha256,hookHash:crypto.createHash('sha512').update(wasm).digest().subarray(0,32).toString('hex').toUpperCase()};
  }else if(schema.artifactSha256)throw new Error('Bound schema requires --wasm to verify the artifact hash');
  let manifest;
  if(a['--metadata']){
    const meta=jsonFile(a['--metadata']);
    if(!meta||typeof meta!=='object'||Array.isArray(meta)||typeof meta.name!=='string'||!meta.name.trim()||Object.keys(meta).some(k=>!['name','description','readme','repo','license','publishers','namespaces'].includes(k)))throw new Error('Metadata must supply a name and only explorer manifest metadata fields');
    manifest={...meta,abi:{hookStates:converted.projections}};
  }
  const out=path.resolve(required(a['--out'],'--out'));if(fs.existsSync(out))throw new Error('Output directory exists; choose a new directory');
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
  writeJSON(path.join(out,'hook.abi.json'),converted.projections);
  if(manifest)writeJSON(path.join(out,'hook.manifest.json'),manifest);
  const report={scope:'EXPLORER_ABI_DRAFT',interface:iface.identity,binding,projections:converted.projections.length,abiSha256:sha(fs.readFileSync(path.join(out,'hook.abi.json'))),warnings:converted.warnings,explorerValidation:'NOT_RUN',coverage:'NOT_RUN',publishing:'NOT_RUN'};
  writeJSON(path.join(out,'export.json'),report);print({output:out,...report});
});
