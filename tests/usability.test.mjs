import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {lintSource} from '../scripts/source-lint.mjs';
import {encodeText,decodeText,labelKey} from '../assets/examples/variable-state.mjs';
import {validateProjectInvoke,assertProjectExecution} from '../assets/examples/deploy/project-contract.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=async(script,...argv)=>{
  try{return {status:0,...await promisify(execFile)(process.execPath,[path.join(root,script),...argv],{timeout:60000,cwd:os.tmpdir(),env:{...process.env,XAHAU_TESTNET_SEED:''}})};}
  catch(e){return {status:e.code,stdout:e.stdout,stderr:e.stderr};}
};
const account='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',hash='AB'.repeat(32);
const tx=()=>({TransactionType:'Invoke',Account:account,NetworkID:21338,
  HookParameters:Object.entries({op:'register',name:'abc',value:'https://example.com'}).map(([k,v])=>({HookParameter:{HookParameterName:Buffer.from(k).toString('hex'),HookParameterValue:Buffer.from(v).toString('hex')}}))});
test('HTTP read CLI accepts explicit endpoint/network or JSON file and rejects URL config clearly',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-read-cli-'));let count=0;
  const server=http.createServer(async(req,res)=>{
    let body='';for await(const c of req)body+=c;
    const {method,params}=JSON.parse(body);++count;
    let result;
    if(method==='server_info')result={info:{network_id:21338}};
    else if(method==='ledger')result={validated:true,ledger_hash:hash,ledger_index:42};
    else{assert.equal(params[0].ledger_hash,hash);result={namespace_entries:[]};}
    res.setHeader('content-type','application/json');res.end(JSON.stringify({result}));
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    const endpoint=`http://127.0.0.1:${server.address().port}`,config=path.join(dir,'rpc.json');
    fs.writeFileSync(config,JSON.stringify({endpoint,networkId:21338}));
    const base=['--account',account,'--namespace',hash];
    for(const options of [['--endpoint',endpoint,'--network-id','21338'],['--config',config]]){
      const r=await run('scripts/read-state.mjs',...base,...options);
      assert.equal(r.status,0,r.stderr);assert.equal(JSON.parse(r.stdout).ledgerHash,hash);
    }
    assert.equal(count,6);
    const bad=await run('scripts/read-state.mjs',...base,'--config',endpoint);
    assert.equal(bad.status,1);assert.match(bad.stderr,/JSON file.*--endpoint/);assert.equal(count,6);
    for(const opts of [['--endpoint',endpoint],['--config',config,'--endpoint',endpoint],['--endpoint',endpoint,'--network-id','21337']])assert.equal((await run('scripts/read-state.mjs',...base,...opts)).status,1);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
test('source lint finds discarded/unsigned API returns and unguarded loops without matching comments or strings',()=>{
  const code=`// state_set(0); for(;;){}
  char *s="otxn_field(0); while(1){}";
  void f(){ state_set(p,n,k,32);
    uint64_t len = otxn_field(p,n,f);
    len = (uint32_t) state(p,n,k,32);
    for(int i=0;i<2;++i){work();}
    int64_t rc=state_set(p,n,k,32); if(rc!=n) rollback(0,0,1);
    for(int i=0; GUARD(2),i<2;++i){work();}
    while(x){ _g(1,3); work(); }
  }`;
  const findings=lintSource(code);
  assert.deepEqual(findings.map(f=>f.rule),['ignored-api-result','unsigned-api-result','unsigned-api-result','loop-guard-review']);
  assert.deepEqual(findings.map(f=>f.line),[3,4,5,6]);
  assert.equal(lintSource('if(state_set(p,n,k,32)!=n) rollback(0,0,1);').length,0);
});
test('lint CLI distinguishes review findings, no findings and input errors',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-lint-')),file=path.join(dir,'hook.c');
  try{
    fs.writeFileSync(file,'void f(){ state_set(p,n,k,32); }');
    assert.equal((await run('scripts/lint-source.mjs','--source',file)).status,1);
    fs.writeFileSync(file,'void f(){ if(state_set(p,n,k,32)!=n) rollback(0,0,1); }');
    const clean=await run('scripts/lint-source.mjs','--source',file);assert.equal(clean.status,0);assert.equal(JSON.parse(clean.stdout).result,'NO_FINDINGS');
    assert.equal((await run('scripts/lint-source.mjs','--source',file+'missing')).status,2);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('variable state round-trip validates byte lengths, version, UTF-8 and exact key vector',()=>{
  for(const text of ['a','https://example.com','Tên miền','x'.repeat(200)])assert.equal(decodeText(encodeText(text).toString('hex')).text,text);
  assert.equal(encodeText('https://example.com').toString('hex'),'01001368747470733a2f2f6578616d706c652e636f6d');
  assert.equal(labelKey('abc').toString('hex'),'534c4b31616263'+'00'.repeat(25));
  for(const text of ['', 'x'.repeat(201),'ế'.repeat(67),'\uD800'])assert.throws(()=>encodeText(text));
  for(const label of ['', 'ABC','a\0','x'.repeat(29)])assert.throws(()=>labelKey(label));
  for(const value of ['','010001','02000161','010000','0100016162','010001ff','0g'])assert.throws(()=>decodeText(value));
});
test('project Invoke rejects unrelated writes and binds successful execution to account/hash',()=>{
  assert.equal(validateProjectInvoke(tx(),account).NetworkID,21338);
  for(const input of [{...tx(),Fee:'1'},{...tx(),NetworkID:21337},{...tx(),TransactionType:'Payment'},{...tx(),Destination:'wrong'},{...tx(),HookParameters:[...tx().HookParameters,tx().HookParameters[0]]}])assert.throws(()=>validateProjectInvoke(input,account));
  const duplicate=tx();duplicate.HookParameters[1]=duplicate.HookParameters[0];assert.throws(()=>validateProjectInvoke(duplicate,account));
  const url=tx();url.HookParameters[2].HookParameter.HookParameterValue=Buffer.from('javascript:alert(1)').toString('hex');assert.throws(()=>validateProjectInvoke(url,account));
  const receipt={validated:true,meta:{TransactionResult:'tesSUCCESS',HookExecutions:[{HookExecution:{HookAccount:account,HookHash:hash,HookReturnCode:'0000000000000000'}}]}};
  assert.doesNotThrow(()=>assertProjectExecution(receipt,account,hash));
  for(const r of [{...receipt,validated:false},{...receipt,meta:{TransactionResult:'tesSUCCESS'}},{...receipt,meta:{...receipt.meta,HookExecutions:[{HookExecution:{HookAccount:account,HookHash:hash,HookReturnCode:'1'}}]}}])assert.throws(()=>assertProjectExecution(r,account,hash));
  assert.throws(()=>assertProjectExecution(receipt,'wrong',hash));assert.throws(()=>assertProjectExecution(receipt,account,'CD'.repeat(32)));
});
const require=createRequire(path.join(root,'assets/examples/deploy/package.json'));
let xahau;try{xahau=require('xahau');}catch{}
test('project submitter from unrelated cwd stays offline and enforces submit boundaries',{skip:!xahau},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-project-')),config=path.join(dir,'network.json'),file=path.join(dir,'invoke.json'),journal=path.join(dir,'journal.json');
  try{
    fs.writeFileSync(config,JSON.stringify({networkId:21338,websocket:'ws://127.0.0.1:9'}));fs.writeFileSync(file,JSON.stringify(tx()));
    const base=['--config',config,'--tx',file,'--expected-hook-account',account,'--expected-hook-hash',hash];
    const offline=await run('assets/examples/deploy/submit-project.mjs',...base);assert.equal(offline.status,0,offline.stderr);assert.equal(JSON.parse(offline.stdout).stage,'OFFLINE_REVIEW_ONLY');
    const decoded=xahau.decode(xahau.encode({...tx(),Fee:'0',Sequence:1,LastLedgerSequence:100,SigningPubKey:''}));assert.equal(decoded.Destination,undefined);
    assert.match((await run('assets/examples/deploy/submit-project.mjs',...base,'--submit')).stderr,/max-fee-drops/);
    fs.writeFileSync(journal,'existing');
    assert.match((await run('assets/examples/deploy/submit-project.mjs',...base,'--submit','--max-fee-drops','1000','--journal',journal)).stderr,/Journal exists/);
    fs.writeFileSync(config,JSON.stringify({networkId:21337}));
    assert.match((await run('assets/examples/deploy/submit-project.mjs',...base,'--submit')).stderr,/testnet NetworkID/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
let compilerAvailable=false;try{createRequire(path.join(root,'assets/toolchain/package.json')).resolve('hooks-compiler');compilerAvailable=true;}catch{}
test('compiler creates missing output parents and still refuses an existing output',{skip:!compilerAvailable},async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-compile-')),out=path.join(dir,'absent','build','minimal');
  try{
    const command=['--source',path.join(root,'assets/examples/minimal.c'),'--out',out];
    const r=await run('assets/toolchain/compile.mjs',...command);assert.equal(r.status,0,r.stderr);
    assert.ok(WebAssembly.validate(fs.readFileSync(path.join(out,'hook.cleaned.wasm'))));
    const before=fs.readFileSync(path.join(out,'build.json'),'utf8');
    const again=await run('assets/toolchain/compile.mjs',...command);assert.equal(again.status,1);assert.match(again.stderr,/Output directory exists/);
    assert.equal(fs.readFileSync(path.join(out,'build.json'),'utf8'),before);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
