import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {explorerProjections} from '../scripts/explorer-abi-lib.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f)));
const schema=read('assets/contact-book.interface.json'),example=read('assets/explorer-abi/contact-book.abi.json');
const fixed={schemaVersion:1,name:'fixed',version:'1',operations:{},state:{counter:{key:{kind:'fixed',hex:'00'.repeat(31)+'01'},fields:[{name:'version',type:'uint8',const:1},{name:'count',type:'uint32be'},{name:'drops',type:'uint64be'},{name:'raw',type:'bytes',bytes:2}]}}};
const run=(script,...args)=>spawnSync(process.execPath,[path.join(root,script),...args],{encoding:'utf8',timeout:60000,cwd:os.tmpdir()});
test('explorer adapter preserves contact prefix, exact 32-byte selector and version discrimination',()=>{
  const {projections}=explorerProjections(schema);assert.deepEqual(projections,example);
  assert.deepEqual(projections[0].selector,[{type:'Blob',label:'key.prefix',byteLength:4,pattern:'43544354',patternEncoding:'hex',exclude:true},{type:'VarString',label:'key.name',byteLength:28}]);
  assert.deepEqual(projections[0].data,[{type:'UInt8',label:'version',pattern:'1',patternEncoding:'ascii',exclude:true},{type:'AccountID',label:'account'}]);
});
test('adapter emits explicit BE integers and plain drops, never NativeAmount',()=>{
  const {projections:[p]}=explorerProjections(fixed);
  assert.equal(p.selector[0].pattern,'00'.repeat(31)+'01');assert.equal(p.data[1].endianness,'BE');assert.equal(p.data[2].type,'UInt64');assert.equal(p.data[2].endianness,'BE');assert.equal(p.data[3].byteLength,2);
  const padded=structuredClone(schema);padded.state.contact.key.maxBytes=10;
  assert.deepEqual(explorerProjections(padded).projections[0].selector[2],{type:'Null',label:'key.padding',byteLength:18,exclude:true});
});
test('adapter refuses hashed preimages, dynamic state string conversion and empty schemas',()=>{
  const hashed=structuredClone(fixed);hashed.state.counter.key={kind:'sha512half',prefixHex:'AB',fields:[]};assert.throws(()=>explorerProjections(hashed),/hashed keys/);
  const dynamic=structuredClone(fixed);dynamic.state.counter.fields=[{name:'url',type:'string',maxBytes:200}];assert.throws(()=>explorerProjections(dynamic),/length-prefixed/);
  assert.throws(()=>explorerProjections({...fixed,state:{}}),/no state/);
});
test('export CLI is offline, exclusive, portable and binds SHA256 separately from HookHash',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-export-abi-'));try{
    const wasm=Buffer.from('0061736d010000000104016000000302010007080104686f6f6b00000a040102000b','hex'),wasmFile=path.join(dir,'hook.wasm');fs.writeFileSync(wasmFile,wasm);
    const out=path.join(dir,'export'),args=['--schema',path.join(root,'assets/contact-book.interface.json'),'--metadata',path.join(root,'assets/explorer-abi/contact-book.metadata.json'),'--wasm',wasmFile,'--out',out];
    const r=run('scripts/export-explorer-abi.mjs',...args);assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);
    assert.equal(report.scope,'EXPLORER_ABI_DRAFT');assert.equal(report.coverage,'NOT_RUN');assert.equal(report.binding.artifactSha256,crypto.createHash('sha256').update(wasm).digest('hex'));assert.equal(report.binding.hookHash,crypto.createHash('sha512').update(wasm).digest('hex').slice(0,64).toUpperCase());
    assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out,'hook.manifest.json'))).abi.hookStates,example);assert.equal(run('scripts/export-explorer-abi.mjs',...args).status,1);
    const bound=path.join(dir,'bound.json');fs.writeFileSync(bound,JSON.stringify({...schema,artifactSha256:'00'.repeat(32)}));assert.match(run('scripts/export-explorer-abi.mjs','--schema',bound,'--wasm',wasmFile,'--out',path.join(dir,'bad')).stderr,/mismatch/);assert.equal(fs.existsSync(path.join(dir,'bad')),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// Optional integration: explicit external checkout, no automatic clone/npm/network calls.
const upstream=process.env.XAHAU_ABI_UPSTREAM?path.resolve(process.env.XAHAU_ABI_UPSTREAM):null;
test('pinned explorer decoder validates rows, exact-once account listing and projection coverage',{skip:!upstream},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-abi-coverage-'));
  const original=read('assets/explorer-abi/contact-book.check.json'),ns=original.hooks[0].namespace;
  const abi=path.join(dir,'contact-book.abi.json'),cfgFile=path.join(dir,'check.json');
  const check=(cfg=original,projection=example)=>{fs.writeFileSync(abi,JSON.stringify(projection));fs.writeFileSync(cfgFile,JSON.stringify(cfg));const r=run('scripts/check-explorer-abi.mjs','--upstream',upstream,'--check',cfgFile);return {...r,report:r.stdout?JSON.parse(r.stdout):null};};
  try{
    await t.test('real decoder agrees with account vector and keeps padded key bytes',()=>{
      const r=check();assert.equal(r.status,0,r.stderr);assert.equal(r.report.syntheticEntries,2);assert.equal(r.report.notes.length,0);assert.equal(r.report.problems.length,0);
      const row=r.report.namespaces[0].rows[0].matches[0].values;assert.equal(row.account,original.account);assert.equal(row['key.name'],'alice'+'\0'.repeat(23));
      assert.equal(r.report.namespaces[0].rows[0].origin,'SYNTHETIC_FIXTURE');
      assert.equal(r.report.hookIdentityValidation,'NOT_RUN');
    });
    await t.test('unmatched records, unknown versions and empty datasets fail',()=>{
      for(const mutate of [c=>c.extra[ns][0].v='02'+c.extra[ns][0].v.slice(2),c=>c.extra[ns][0].k='00'.repeat(32),c=>c.extra[ns]=[]]){const cfg=structuredClone(original);mutate(cfg);const r=check(cfg);assert.equal(r.status,1,r.stderr);assert.ok(r.report.problems.length>0);}
    });
    await t.test('multiple matches and unexercised projections fail, including cross-hook fallback',()=>{
      const duplicate=[...example,{...structuredClone(example[0]),name:'overlap'}];assert.ok(check(original,duplicate).report.problems.some(p=>p.issue==='MULTIPLE_MATCHES'));
      const unused=structuredClone(example[0]);unused.name='never-seen';unused.selector[0].pattern='44454144';assert.ok(check(original,[...example,unused]).report.problems.some(p=>p.issue==='UNTESTED_PROJECTION'));
    });
    await t.test('namespace fallback uses every hook; own namespace excludes unrelated hooks',()=>{
      const cfg=structuredClone(original);cfg.hooks.push({...cfg.hooks[0],hash:'CD'.repeat(32),namespace:'CD'.repeat(32)});
      assert.equal(check(cfg).status,1); // second projection has no sample in its own namespace
      cfg.extra['CD'.repeat(32)]=structuredClone(cfg.extra[ns]);assert.equal(check(cfg).status,0);
      cfg.extra['EF'.repeat(32)]=structuredClone(cfg.extra[ns]);const r=check(cfg);assert.equal(r.status,1);assert.ok(r.report.problems.some(p=>p.issue==='MULTIPLE_MATCHES'&&p.namespace==='EF'.repeat(32)));
    });
    await t.test('wrong-endian numeric data can match but expected-value assertion catches it',()=>{
      const p=explorerProjections(fixed).projections,cfg=structuredClone(original);
      cfg.extra[ns]=[{k:'00'.repeat(31)+'01',v:'0101020304000000000000002AABCD',note:'Synthetic independent BE vector',expect:{count:16909060,drops:'42',raw:'ABCD'}}];
      cfg.extra[ns].push({...cfg.extra[ns][0],v:'0101020304FFFFFFFFFFFFFFFFABCD',expect:{count:16909060,drops:'18446744073709551615',raw:'ABCD'}});
      assert.equal(check(cfg,p).status,0);
      const wrong=structuredClone(p);delete wrong[0].data[1].endianness;const r=check(cfg,wrong);assert.equal(r.status,1);assert.ok(r.report.problems.some(p=>p.issue==='VALUE_MISMATCH'&&p.label==='count'));
    });
    await t.test('saved core snapshots are supported; wrong account, paging and mixed ledgers fail',()=>{
      const cfg=structuredClone(original);delete cfg.extra;cfg.state={[ns]:'state.json'};const e=original.extra[ns][0];
      const snap={account:original.account,namespace:ns,ledgerHash:'11'.repeat(32),ledgerIndex:100,entries:[{HookStateKey:e.k,HookStateData:e.v}]};const file=path.join(dir,'state.json');
      fs.writeFileSync(file,JSON.stringify(snap));const checked=check(cfg);assert.equal(checked.status,0);assert.equal(checked.report.entriesFromFiles,1);assert.equal(checked.report.namespaces[0].rows[0].origin,'FILE_INPUT');
      for(const bad of [{...snap,account:'wrong'},{...snap,marker:'next'},{...snap,namespace:'CD'.repeat(32)},{result:{...snap,account:'wrong',namespace_entries:snap.entries}}]){fs.writeFileSync(file,JSON.stringify(bad));assert.equal(check(cfg).status,1);}
      fs.writeFileSync(file,JSON.stringify(snap));const other='CD'.repeat(32);cfg.state[other]='other.json';fs.writeFileSync(path.join(dir,'other.json'),JSON.stringify({...snap,namespace:other,ledgerHash:'22'.repeat(32)}));assert.equal(check(cfg).status,1);
    });
    await t.test('left-padded short key must not silently also decode as AccountID',()=>{
      const p=[{name:'short',selector:[{type:'Null',byteLength:30,exclude:true},{type:'Blob',label:'kind',byteLength:2,pattern:'4D43',patternEncoding:'hex',exclude:true}],data:[{type:'UInt8',label:'count'}]},
        {name:'account',selector:[{type:'Null',byteLength:12,exclude:true},{type:'AccountID',label:'owner'}],data:[{type:'UInt8',label:'count'}]}];
      const cfg=structuredClone(original);cfg.extra[ns]=[{k:'00'.repeat(30)+'4D43',v:'01',note:'Synthetic short-key/AccountID collision'}];
      const r=check(cfg,p);assert.equal(r.status,1);assert.ok(r.report.problems.some(p=>p.issue==='MULTIPLE_MATCHES'));
    });
    await t.test('report output is exclusive and regex execution has a worker deadline',()=>{
      const out=path.join(dir,'result.json');fs.writeFileSync(out,'preserve');
      assert.match(run('scripts/check-explorer-abi.mjs','--upstream',upstream,'--check',cfgFile,'--out',out).stderr,/exists/);assert.equal(fs.readFileSync(out,'utf8'),'preserve');
      const p=[{name:'slow',selector:[{type:'Blob',label:'key',byteLength:32}],data:[{type:'VarString',label:'data',byteLength:64,patternRegex:'^(a+)+$'}]}];
      const cfg=structuredClone(original);cfg.extra[ns]=[{k:'11'.repeat(32),v:Buffer.from('a'.repeat(63)+'!').toString('hex'),note:'Synthetic regex timeout test'}];
      fs.writeFileSync(abi,JSON.stringify(p));fs.writeFileSync(cfgFile,JSON.stringify(cfg));
      const r=run('scripts/check-explorer-abi.mjs','--upstream',upstream,'--check',cfgFile,'--timeout-ms','500');assert.equal(r.status,1);assert.match(r.stderr,/timed out/);
    });
    await t.test('modified upstream parser is rejected before optional modules execute',()=>{
      const copy=path.join(dir,'upstream'),pin=read('assets/explorer-abi-upstream.json');
      for(const file of Object.keys(pin.files)){const target=path.join(copy,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(path.join(upstream,file),target);}
      fs.appendFileSync(path.join(copy,'scripts/lib/parser.js'),'\n// changed\n');
      const r=run('scripts/check-explorer-abi.mjs','--upstream',copy,'--check',cfgFile);assert.equal(r.status,1);assert.match(r.stderr,/Pinned upstream file mismatch: scripts\/lib\/parser.js/);
    });
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
