import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {compile,VERSIONS} from 'hooks-compiler';
import {args,required,main,print} from '../../scripts/lib.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--source','--out'],['--help']);
  if(a['--help'])return print({usage:'node assets/toolchain/compile.mjs --source project/hook/src/hook.c --out /new/output-directory',
    note:'Optional npm toolchain; npm ci required in assets/toolchain. Output directory must not exist. This wrapper does not patch compiler behavior or run a guard checker.'});
  const source=path.resolve(required(a['--source'],'--source')),out=path.resolve(required(a['--out'],'--out'));
  if(fs.existsSync(out))throw new Error('Output directory exists; choose a fresh directory to avoid stale artifacts');
  const own=path.dirname(fileURLToPath(import.meta.url));
  const headers=path.join(own,'node_modules/@xahau/hooks-cli/dist/npm/src/init/c/contracts/include');
  const files={};
  for(const name of fs.readdirSync(headers))if(name.endsWith('.h'))files[name]=fs.readFileSync(path.join(headers,name),'utf8');
  for(const name of fs.readdirSync(path.dirname(source)))if(name.endsWith('.h'))files[name]=fs.readFileSync(path.join(path.dirname(source),name),'utf8');
  const entry=path.basename(source);files[entry]=fs.readFileSync(source,'utf8');
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  const inputs=Object.fromEntries(Object.entries(files).sort().map(([name,data])=>[name,sha(data)]));
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.mkdirSync(out); // Keep leaf creation exclusive, including concurrent builds.
  fs.writeFileSync(path.join(out,'build.json'),JSON.stringify({result:'NOT_BUILT',inputs},null,2)+'\n');
  try{
    const result=await compile({files,entry,opt:'-O2'});
    if(!WebAssembly.validate(result.wasm))throw new Error('Cleaned artifact is invalid WASM');
    const {wasm,...metadata}=result;
    const report={...metadata,result:'COMPILED_NOT_GUARD_VALIDATED',bytes:wasm.length,sha256:sha(wasm),versions:VERSIONS,inputs,
      lockSha256:sha(fs.readFileSync(path.join(own,'package-lock.json'))),guard:'NOT_RUN',nodeValidation:'NOT_RUN'};
    fs.writeFileSync(path.join(out,'hook.cleaned.wasm'),wasm);
    fs.writeFileSync(path.join(out,'hook.cleaned.wasm.hex'),Buffer.from(wasm).toString('hex').toUpperCase()+'\n');
    fs.writeFileSync(path.join(out,'compiler.log'),result.logs.join('\n')+'\n');
    fs.writeFileSync(path.join(out,'build.json'),JSON.stringify(report,null,2)+'\n');
    print({output:out,bytes:wasm.length,sha256:report.sha256,result:report.result});
  }catch(error){fs.writeFileSync(path.join(out,'compiler.log'),String(error.stack ?? error)+'\n');throw error;}
});
