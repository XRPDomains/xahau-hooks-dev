import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {Worker,isMainThread,parentPort,workerData} from 'node:worker_threads';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {args,jsonFile,hex,required,main,print} from './lib.mjs';
import {decodeAccount} from './account-codec.mjs';
const pin=jsonFile(fileURLToPath(new URL('../assets/explorer-abi-upstream.json',import.meta.url)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');

async function check(upstream,checkFile){
  // Verify the exact optional decoder/validator modules before importing them.
  for(const [file,expected]of Object.entries(pin.files))if(sha(fs.readFileSync(path.join(upstream,file),'utf8').replace(/\r\n/g,'\n'))!==expected)throw new Error('Pinned upstream file mismatch: '+file);
  const lock=jsonFile(path.join(upstream,'scripts/package-lock.json'));
  for(const [file,info]of Object.entries(lock.packages))if(file.startsWith('node_modules/')&&jsonFile(path.join(upstream,'scripts',file,'package.json')).version!==info.version)throw new Error('Optional dependency version mismatch: '+file);
  const io=await import(pathToFileURL(path.join(upstream,'scripts/lib/io.js')).href);
  const validator=await import(pathToFileURL(path.join(upstream,'scripts/lib/manifest.js')).href);
  const inputs=[];
  const read=file=>{const b=fs.readFileSync(file);if(b.length>8*1024*1024)throw new Error('Input file exceeds 8 MiB');inputs.push({path:file,sha256:sha(b)});return jsonFile(file);};
  const cfg=read(checkFile),relative=file=>path.resolve(path.dirname(checkFile),file);
  decodeAccount(cfg.account);
  if(!Array.isArray(cfg.hooks)||cfg.hooks.length<1||cfg.hooks.length>256)throw new Error('Expected 1..256 hooks in check config');
  const namespaces=obj=>{if(obj===undefined)return {};if(!obj||typeof obj!=='object'||Array.isArray(obj))throw new Error('Expected namespace map');const out={};for(const [key,value]of Object.entries(obj)){hex(key,32,'namespace');const ns=key.toUpperCase();if(Object.hasOwn(out,ns))throw new Error('Duplicate namespace differing only in case');out[ns]=value;}return out;};
  const files=namespaces(cfg.state),extra=namespaces(cfg.extra),notes=[],warnings=[],unused=new Set();let projectionCount=0;
  const hooks=cfg.hooks.map((h,index)=>{
    hex(h.hash,32,'HookHash');hex(h.namespace,32,'effective namespace');let projections=[];
    if(h.manifest){
      const validated=validator.normalise(read(relative(h.manifest))),manifest=validated.manifest;
      projections=io.projectionsOf(manifest);
      const lint=validator.lint(projections);if(lint.errors.length)throw new Error('Manifest lint errors: '+lint.errors.join('; '));
      notes.push(...validated.notes.map(message=>({hook:index,message})));warnings.push(...lint.warnings.map(message=>({hook:index,message})));
      if(new Set(projections.map(p=>p.name)).size!==projections.length)throw new Error('Duplicate projection names within a hook');
      for(const p of projections){const labels=[...p.selector,...p.data].filter(s=>!s.exclude).map(s=>s.label);if(new Set(labels).size!==labels.length)throw new Error('Duplicate visible labels within a projection');}
    }
    const rows=projections.map((p,j)=>{const id=index+':'+j;unused.add(id);++projectionCount;return {id,projection:p};});
    return {index,hash:h.hash.toUpperCase(),namespace:h.namespace.toUpperCase(),rows};
  });
  if(!projectionCount||projectionCount>2000)throw new Error('Expected 1..2000 projections');
  const parser=io.parser(),results=[],problems=[];let total=0,synthetic=0,comparisons=0;
  const ledgerHashes=new Set(),ledgerIndices=new Set(),networkIds=new Set();
  for(const ns of new Set([...Object.keys(files),...Object.keys(extra)])){
    let snapshots=[];
    if(files[ns]){
      const raw=read(relative(files[ns])),envelope=raw.result??raw;
      if(envelope.account!==undefined&&envelope.account!==cfg.account)throw new Error('Snapshot account mismatch');
      const namespace=envelope.namespace??envelope.namespace_id;
      if(namespace!==undefined){hex(namespace,32,'snapshot namespace');if(namespace.toUpperCase()!==ns)throw new Error('Snapshot namespace mismatch');}
      if(raw.marker!=null||envelope.marker!=null)throw new Error('Snapshot is still paginated');
      const hash=envelope.ledgerHash??envelope.ledger_hash,index=envelope.ledgerIndex??envelope.ledger_index;
      if(hash!==undefined){hex(hash,32,'ledger hash');ledgerHashes.add(hash.toUpperCase());}
      if(index!==undefined){if(!Number.isSafeInteger(index)||index<1)throw new Error('Invalid snapshot ledger index');ledgerIndices.add(index);}
      if(envelope.networkId!==undefined){if(!Number.isSafeInteger(envelope.networkId)||envelope.networkId<0||envelope.networkId>0xFFFFFFFF)throw new Error('Invalid snapshot NetworkID');networkIds.add(envelope.networkId);if(cfg.networkId!==undefined&&cfg.networkId!==envelope.networkId)throw new Error('Snapshot NetworkID mismatch');}
      snapshots=io.entriesOf(Array.isArray(raw.entries)?raw.entries:raw);
      if(new Set(snapshots.map(e=>e.k)).size!==snapshots.length)throw new Error('Duplicate keys in namespace snapshot');
    }
    if(extra[ns]!==undefined&&!Array.isArray(extra[ns]))throw new Error('Synthetic entries must be an array');
    const made=(extra[ns]??[]).map(e=>{if(typeof e.note!=='string'||!e.note.trim())throw new Error('Synthetic entry requires an explicit note');const [entry]=io.entriesOf([e]);return {...entry,synthetic:true,note:e.note,expect:e.expect};});
    const entries=[...snapshots,...made];synthetic+=made.length;total+=entries.length;if(total>10000)throw new Error('At most 10000 entries per check');
    const own=hooks.filter(h=>h.namespace===ns),listed=own.length?own:hooks,rows=[];
    for(const entry of entries){
      hex(entry.k,32,'state key');hex(entry.v,undefined,'state value');if(entry.v.length>131070)throw new Error('Oversized state value');
      const matches=[];
      for(const hook of listed)for(const {id,projection:p}of hook.rows){
        if(++comparisons>200000)throw new Error('Check comparison limit exceeded');
        const decoded=parser.decodeHookState(entry.k,entry.v,p);if(!decoded)continue;
        unused.delete(id);const values=Object.create(null);
        for(const [segments,decodedFields]of [[p.selector,decoded.HookStateKey],[p.data,decoded.HookStateData]])segments.forEach((s,j)=>{if(!s.exclude)values[s.label]=decodedFields[j].value;});
        matches.push({hook:hook.index,projection:p.name,id,values});
      }
      if(matches.length!==1)problems.push({namespace:ns,key:entry.k,matches:matches.map(m=>m.id),issue:matches.length?'MULTIPLE_MATCHES':'UNDECODED'});
      if(entry.expect!==undefined){
        if(!entry.expect||typeof entry.expect!=='object'||Array.isArray(entry.expect))throw new Error('Expected row values must be an object');
        for(const [label,value]of Object.entries(entry.expect))if(matches.length!==1||JSON.stringify(matches[0].values[label])!==JSON.stringify(value))problems.push({namespace:ns,key:entry.k,issue:'VALUE_MISMATCH',label,expected:value,actual:matches[0]?.values[label]});
      }
      // Keep one sample per projection and at most twenty problematic rows.
      if(matches.some(m=>!rows.some(r=>r.matches.some(other=>other.id===m.id)))||matches.length!==1&&rows.length<20)rows.push({key:entry.k,origin:entry.synthetic?'SYNTHETIC_FIXTURE':'FILE_INPUT',note:entry.note,matches});
    }
    results.push({namespace:ns,listing:own.length?'EFFECTIVE_NAMESPACE':'ALL_HOOKS_FALLBACK',entries:entries.length,rows});
  }
  if(ledgerHashes.size>1||ledgerIndices.size>1||networkIds.size>1)throw new Error('Namespace snapshots span different ledgers/networks');
  if(!total)problems.push({issue:'NO_ENTRIES'});
  for(const id of unused)problems.push({issue:'UNTESTED_PROJECTION',id});
  return {scope:'EXPLORER_ABI_LOCAL_CHECK',result:problems.length?'FAIL':'PASS',upstream:{repository:pin.repository,revision:pin.revision,filesVerified:true},account:cfg.account,entries:total,entriesFromFiles:total-synthetic,syntheticEntries:synthetic,projections:projectionCount,unusedProjections:[...unused],inputs,notes,warnings,problems,namespaces:results,hookIdentityValidation:'NOT_RUN',networkValidation:'NOT_RUN',publishing:'NOT_RUN'};
}

if(isMainThread)main(async()=>{
  const a=args(process.argv.slice(2),['--upstream','--check','--timeout-ms','--out'],['--help']);
  if(a['--help'])return print({usage:'node scripts/check-explorer-abi.mjs --upstream PINNED_REPO --check check.json [--timeout-ms 10000] [--out NEW_REPORT.json]',note:'Optional pinned upstream decoder; offline only. Requires npm ci in upstream/scripts. Exact-once coverage plus every projection exercised. No RPC, signing or publication.'});
  if(a['--out']&&fs.existsSync(a['--out']))throw new Error('Output file exists');
  const timeout=Number(a['--timeout-ms']??10000);if(!Number.isInteger(timeout)||timeout<10||timeout>60000)throw new Error('Timeout must be 10..60000 ms');
  const worker=new Worker(new URL(import.meta.url),{workerData:{upstream:path.resolve(required(a['--upstream'],'--upstream')),checkFile:path.resolve(required(a['--check'],'--check'))},execArgv:[]});
  let timer;const report=await new Promise((resolve,reject)=>{
    timer=setTimeout(()=>{worker.terminate();reject(new Error('Explorer ABI check timed out; worker terminated'));},timeout);
    worker.once('message',message=>message.error?reject(new Error(message.error)):resolve(message));worker.once('error',reject);worker.once('exit',code=>reject(new Error('Explorer worker exited: '+code)));
  }).finally(async()=>{clearTimeout(timer);await worker.terminate();});
  print(report,a['--out']);if(report.result!=='PASS')process.exitCode=1;
});
else check(workerData.upstream,workerData.checkFile).then(report=>parentPort.postMessage(report),error=>parentPort.postMessage({error:error.message}));
