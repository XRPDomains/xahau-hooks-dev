import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {decode} from '../scripts/layout.mjs';
import {snapshot} from '../scripts/rpc.mjs';
import {summarize} from '../scripts/transaction.mjs';
import {args} from '../scripts/lib.mjs';
import {guardResult} from '../scripts/guard.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const layout=JSON.parse(fs.readFileSync(path.join(root,'assets/state-layout.example.json'),'utf8'));
const account='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
const namespace='AB'.repeat(32), hash='CD'.repeat(32);
const entry=n=>({LedgerEntryType:'HookState',HookStateKey:n.toString(16).padStart(64,'0'),HookStateData:'01'});

async function withServer(handler, run) {
  const calls=[];
  const server=http.createServer(async(req,res)=>{
    try {
      let raw=''; for await(const chunk of req) raw+=chunk;
      const body=JSON.parse(raw); calls.push(body);
      const result=handler(body,calls);
      res.writeHead(200,{'content-type':'application/json'}); res.end(JSON.stringify({result}));
    } catch(error) {res.writeHead(500); res.end(error.message);}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try { return await run({endpoint:`http://127.0.0.1:${server.address().port}`,networkId:21338,timeoutMs:1000,maxPages:5},calls); }
  finally {server.closeAllConnections(); await new Promise(resolve=>server.close(resolve));}
}
function defaults(body) {
  if(body.method==='server_info')return {info:{network_id:21338}};
  if(body.method==='ledger')return {validated:true,ledger_hash:hash,ledger_index:42};
}

test('decode BE uint64 without precision loss',()=>{
  assert.deepEqual(decode(layout,'01FFFFFFFFFFFFFFFF'),{version:1,value:'18446744073709551615'});
  assert.deepEqual(decode(layout,'01000000000000002A'),{version:1,value:'42'});
});
test('reject invalid bytes, wrong length and unsupported type',()=>{
  assert.throws(()=>decode(layout,'01F'),/Invalid/);
  assert.throws(()=>decode(layout,'GG'.repeat(9)),/Invalid/);
  assert.throws(()=>decode(layout,Buffer.alloc(8)),/length/);
  assert.throws(()=>decode({length:1,fields:[{name:'value',offset:0,type:'bool'}]},'00'),/Unsupported/);
});
test('reject gaps, overlaps, duplicate names and out-of-bounds layout',()=>{
  assert.throws(()=>decode({length:2,fields:[{name:'a',offset:0,type:'u8'}]},'0000'),/gaps/);
  assert.throws(()=>decode({length:1,fields:[{name:'a',offset:0,type:'u8'},{name:'b',offset:0,type:'u8'}]},'00'),/Overlapping/);
  assert.throws(()=>decode({length:2,fields:[{name:'a',offset:0,type:'u8'},{name:'a',offset:1,type:'u8'}]},'0000'),/duplicate/);
  assert.throws(()=>decode({length:1,fields:[{name:'a',offset:0,type:'u64be'}]},'00'),/bounds/);
});
test('unsigned 32-bit flags are not truncated to boolean',()=>{
  assert.equal(decode({length:4,fields:[{name:'flags',offset:0,type:'u32be'}]},'80000000').flags,2147483648);
});
test('RPC pins validated ledger, carries opaque marker, returns complete snapshot',async()=>{
  await withServer((b,c)=>defaults(b)??{ledger_hash:hash,ledger_index:42,namespace_entries:[entry(c.length)],...(c.length===3?{marker:{page:2}}:{})},async(config,calls)=>{
    const s=await snapshot(config,account,namespace);
    assert.equal(s.entries.length,2); assert.equal(s.requests,4); assert.equal(s.ledgerIndex,42);
    assert.equal(calls[2].params[0].ledger_hash,hash); assert.deepEqual(calls[3].params[0].marker,{page:2});
    assert.deepEqual(calls.map(x=>x.method),['server_info','ledger','account_namespace','account_namespace']);
  });
});
test('RPC rejects wrong or missing network before reading state',async()=>{
  for(const network_id of [1,undefined]) await withServer(()=>({info:{network_id}}),async(config,calls)=>{
    await assert.rejects(snapshot(config,account,namespace),/Network ID/); assert.equal(calls.length,1);
  });
});
test('RPC rejects repeated marker even when state pages are empty',async()=>{
  await withServer(b=>defaults(b)??{namespace_entries:[],marker:'same'},async config=>{
    await assert.rejects(snapshot(config,account,namespace),/Repeated/);
  });
});
test('RPC rejects duplicate keys, ledger mismatch, malformed data and wrong entry type',async()=>{
  for(const mode of ['duplicate','hash','index','type','data']) await withServer((b,c)=>{
    const r=defaults(b);if(r)return r;
    if(mode==='duplicate')return {namespace_entries:[entry(1)],...(c.length===3?{marker:'next'}:{})};
    if(mode==='hash')return {namespace_entries:[],ledger_hash:'00'.repeat(32)};
    if(mode==='index')return {namespace_entries:[],ledger_index:43};
    if(mode==='type')return {namespace_entries:[{...entry(1),LedgerEntryType:'AccountRoot'}]};
    return {namespace_entries:[{...entry(1),HookStateData:'XYZ'}]};
  },async config=>assert.rejects(snapshot(config,account,namespace),/Duplicate|mismatch|entry type|state data/));
});
test('RPC rejects unvalidated ledger, server errors and page cap',async()=>{
  await withServer(b=>b.method==='server_info'?defaults(b):{validated:false,ledger_hash:hash,ledger_index:42},async c=>assert.rejects(snapshot(c,account,namespace),/not validated/));
  await withServer(()=>({error:'noPermission'}),async c=>assert.rejects(snapshot(c,account,namespace),/noPermission/));
  await withServer((b,c)=>defaults(b)??{namespace_entries:[],marker:String(c.length)},async c=>assert.rejects(snapshot({...c,maxPages:1},account,namespace),/page limit/));
});
test('RPC rejects request timeout and credential/transport mistakes',async()=>{
  await assert.rejects(snapshot({endpoint:'wss://localhost',networkId:1},account,namespace),/HTTP/);
  await assert.rejects(snapshot({endpoint:'https://secret:password@localhost',networkId:1},account,namespace),/credentials/);
  const server=http.createServer(()=>{});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {await assert.rejects(snapshot({endpoint:`http://127.0.0.1:${server.address().port}`,networkId:21338,timeoutMs:100},account,namespace),/timeout/i);}
  finally {server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
});
test('tx success without hook execution is reported, not business success',()=>{
  const r=summarize({result:{validated:true,hash:'A',meta:{TransactionResult:'tesSUCCESS'}}});
  assert.equal(r.stage,'NO_HOOK_EXECUTION');assert.equal(r.businessCompletion,'NOT_INFERRED');
});
test('tx hook trace preserves raw return code and decoded text',()=>{
  const r=summarize({validated:true,meta:{TransactionResult:'tecHOOK_REJECTED',HookExecutions:[{HookExecution:{HookReturnCode:'FFFFFFFFFFFFFFFF',HookReturnString:'6F776E6572206F6E6C7900',HookHash:'ABC'}}]}});
  assert.equal(r.hooks[0].returnString,'owner only');assert.equal(r.hooks[0].returnCode,'FFFFFFFFFFFFFFFF');
  assert.equal(r.transactionResult,'tecHOOK_REJECTED');
  assert.equal(summarize({validated:false,meta:{TransactionResult:'tesSUCCESS'}}).stage,'NOT_VALIDATED');
  assert.throws(()=>summarize({validated:true}),/metadata/);
});
test('artifact inspection separates structural PASS from missing guard check',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-skill-'));
  try {
    const wasm=path.join(dir,'hook.wasm'),policy=path.join(dir,'policy.json');
    fs.writeFileSync(wasm,Buffer.from('0061736d010000000104016000000302010007080104686f6f6b00000a040102000b','hex'));
    fs.writeFileSync(policy,JSON.stringify({maxBytes:100,allowedImports:[],requiredImports:[],allowedExports:['hook:function'],requiredExports:['hook:function']}));
    const run=(...extra)=>spawnSync(process.execPath,[path.join(root,'scripts/inspect-artifact.mjs'),'--wasm',wasm,...extra],{encoding:'utf8'});
    const ok=run('--policy',policy);assert.equal(ok.status,0,ok.stderr);
    const parsed=JSON.parse(ok.stdout);assert.equal(parsed.structure,'PASS');assert.equal(parsed.guard,'NOT_RUN');assert.equal(parsed.sha256.length,64);
    assert.equal(run().status,2);
    const p=JSON.parse(fs.readFileSync(policy));p.maxBytes=1;fs.writeFileSync(policy,JSON.stringify(p));
    assert.equal(run('--policy',policy).status,1);
    p.maxBytes=100;p.requiredExports=['cbak:function'];fs.writeFileSync(policy,JSON.stringify(p));
    assert.equal(run('--policy',policy).status,1);
    fs.writeFileSync(wasm,'invalid');assert.equal(run('--policy',policy).status,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('CLI rejects typos, duplicate flags and missing values',()=>{
  assert.throws(()=>args(['--unknown']),/Unknown/);
  assert.throws(()=>args(['--file'],['--file']),/Missing/);
  assert.throws(()=>args(['--file','a','--file','b'],['--file']),/Duplicate/);
});
test('guard evidence requires both zero exit and explicit checker success',()=>{
  assert.equal(guardResult({status:0,stdout:'Hook validation successful!'},'checker').result,'PASS');
  assert.equal(guardResult({status:1,stdout:'Hook validation successful!'},'checker').result,'FAIL');
  assert.equal(guardResult({status:0,stdout:'unrecognized output'},'checker').result,'FAIL');
  assert.equal(guardResult({status:0,stdout:'Hook validation successful!',error:new Error('timeout')},'checker').result,'FAIL');
});
test('project scaffold creates expected layout and refuses existing destinations',()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xh-scaffold-'));
  try {
    const out=path.join(temp,'project');
    const run=()=>spawnSync(process.execPath,[path.join(root,'scripts/init-project.mjs'),'--out',out,'--name','example-hook'],{encoding:'utf8'});
    const first=run();assert.equal(first.status,0,first.stderr);
    assert.equal(JSON.parse(first.stdout).deployment,'NOT_RUN');
    assert.ok(fs.existsSync(path.join(out,'protocol/contract.md')));
    assert.ok(fs.existsSync(path.join(out,'hook/src/hook.c')));
    fs.writeFileSync(path.join(out,'README.md'),'preserve');
    assert.equal(run().status,1);assert.equal(fs.readFileSync(path.join(out,'README.md'),'utf8'),'preserve');
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
