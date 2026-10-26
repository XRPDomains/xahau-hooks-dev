import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {jsonFile,writeJSON} from '../scripts/lib.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const run=(script,...argv)=>spawnSync(process.execPath,[path.join(root,script),...argv],{encoding:'utf8',timeout:60000,env:{...process.env,XAHAU_TESTNET_SEED:''}});
const require=createRequire(path.join(root,'assets/examples/deploy/package.json'));
let xahau,loadWallet,runtime,funding;
try{xahau=require('xahau');({loadWallet}=await import('../assets/examples/deploy/wallet.mjs'));runtime=await import('../assets/examples/deploy/testnet-runtime.mjs');funding=await import('../assets/examples/deploy/testnet-funding.mjs');}catch(e){if(!['MODULE_NOT_FOUND','ERR_MODULE_NOT_FOUND'].includes(e.code))throw e;}
const account='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',other='rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',hash='AB'.repeat(32);
const tx=()=>({TransactionType:'Invoke',Account:account,NetworkID:21338,HookParameters:[{HookParameter:{HookParameterName:'6F70',HookParameterValue:'AABBCCDD'}}]});
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'xh-agent-workflow-'));

test('UTF JSON reader handles Windows BOM encodings and writer emits exclusive UTF-8',()=>{
  const dir=temporary();try{
    const obj={text:'Tên miền'},text=JSON.stringify(obj);
    for(const [name,bytes]of [['utf8',Buffer.from('\uFEFF'+text)],['le',Buffer.concat([Buffer.from([255,254]),Buffer.from(text,'utf16le')])],['be',Buffer.concat([Buffer.from([254,255]),Buffer.from(text,'utf16le').swap16()])]]){
      const file=path.join(dir,name);fs.writeFileSync(file,bytes);assert.deepEqual(jsonFile(file),obj);
    }
    const file=path.join(dir,'out.json');writeJSON(file,obj);assert.equal(fs.readFileSync(file)[0],123);assert.deepEqual(jsonFile(file),obj);assert.throws(()=>writeJSON(file,{}));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('core report CLIs write UTF-8 directly and refuse existing output',()=>{
  const dir=temporary();try{
    const fixture=path.join(dir,'tx.json'),source=path.join(dir,'hook.c');fs.writeFileSync(fixture,JSON.stringify({result:{validated:true,meta:{TransactionResult:'tesSUCCESS'}}}));fs.writeFileSync(source,'void f(){}');
    for(const [script,args]of [['decode-state',['--layout',path.join(root,'assets/state-layout.example.json'),'--hex','01000000000000002A']],['hookon',['--types','Invoke']],['summarize-tx',['--file',fixture]],['lint-source',['--source',source]],['doctor',[]],['validate-package',[]]]){
      const out=path.join(dir,script+'.json'),r=run(`scripts/${script}.mjs`,...args,'--out',out);assert.equal(r.status,0,r.stderr);assert.equal(fs.readFileSync(out)[0],123);assert.deepEqual(jsonFile(out),JSON.parse(r.stdout));
      if(script==='hookon')assert.equal(run(`scripts/${script}.mjs`,...args,'--out',out).status,1);
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('wallet loader derives both encoded seed families and checks actual address',{skip:!xahau},()=>{
  for(const algorithm of ['ecdsa-secp256k1','ed25519']){
    const wallet=xahau.Wallet.generate(algorithm);assert.equal(loadWallet(wallet.seed,wallet.classicAddress).classicAddress,wallet.classicAddress);
    assert.throws(()=>loadWallet(wallet.seed,other),/does not match/);
  }
  assert.throws(()=>loadWallet('invalid seed'),/Invalid testnet seed/);
});
test('generic Invoke accepts custom payloads, enforces self omission and refuses other/signed transactions',{skip:!xahau},()=>{
  assert.equal(runtime.validateGenericInvoke(tx(),account).Destination,undefined);
  assert.equal(runtime.validateGenericInvoke({...tx(),Destination:other},other).Destination,other);
  for(const bad of [{...tx(),Destination:account},{...tx(),TransactionType:'Payment'},{...tx(),NetworkID:21337},{...tx(),Fee:'1'},{...tx(),TxnSignature:'AA'},{...tx(),Amount:'1'}])assert.throws(()=>runtime.validateGenericInvoke(bad,account));
});
function mockedClient({network=21338,fee='10',engine='tesSUCCESS',lookupError=false,returnCode='0'}={}){
  let signed=0,submitted=0;
  const wallet={classicAddress:account,sign:()=>{++signed;return {hash:'CD'.repeat(32),tx_blob:'fake-signed-blob'};}};
  const client={
    request:async q=>{
      if(q.command==='server_info')return {result:{info:{network_id:network}}};
      if(q.command==='account_info')return {result:{validated:true,account_data:{Account:q.account,Balance:'100000000'}}};
      if(q.command==='account_objects')return {result:{account_objects:[{Hooks:[{Hook:{HookHash:hash}}]}]}};
      if(q.command==='fee')return {result:{drops:{base_fee:fee}}};
      if(q.command==='tx'){if(lookupError)throw {data:{error:'disconnected'}};return {result:{validated:true,ledger_index:10,meta:{TransactionResult:'tesSUCCESS',HookExecutions:[{HookExecution:{HookAccount:account,HookHash:hash,HookReturnCode:returnCode}}]}}};}
      throw new Error('Unexpected RPC');
    },
    autofill:async input=>({...input,Sequence:1,LastLedgerSequence:50}),
    submit:async()=>{++submitted;return {result:{engine_result:engine}};}
  };return {client,wallet,counts:()=>({signed,submitted})};
}
test('generic submit journals before exactly one submit and gates successful execution',{skip:!xahau},async()=>{
  const dir=temporary();try{
    for(const [name,options]of [['ok',{}],['cap',{fee:'1000'}],['network',{network:21337}],['reject',{engine:'temMALFORMED'}],['unknown',{lookupError:true}],['trace',{returnCode:'1'}]]){
      const m=mockedClient(options),journal=path.join(dir,name+'.json');
      const invoke=()=>runtime.submitInvoke({...m,tx:tx(),expectedAccount:account,expectedHash:hash,feeCap:'100',journal,pause:async()=>{},attempts:1});
      if(name==='ok'){assert.equal((await invoke()).feeDrops,'10');assert.equal(jsonFile(journal).stage,'VALIDATED');await assert.rejects(invoke,/Journal exists/);assert.deepEqual(m.counts(),{signed:1,submitted:1});}
      else{await assert.rejects(invoke);assert.equal(m.counts().submitted,['cap','network'].includes(name)?0:1);if(name==='reject')assert.equal(jsonFile(journal).stage,'SUBMIT_REJECTED');if(name==='unknown')assert.equal(jsonFile(journal).stage,'SIGNED_BEFORE_SUBMIT');}
    }
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('account validation waits only for actNotFound and rejects unrelated RPC failures',{skip:!xahau},async()=>{
  let calls=0,waits=0;const client={request:async()=>{if(++calls<3)throw {data:{error:'actNotFound'}};return {result:{validated:true,account_data:{Account:account,Balance:'1000'}}};}};
  await runtime.waitAccount(client,account,{attempts:3,pause:async()=>{++waits;}});assert.equal(calls,3);assert.equal(waits,2);
  await assert.rejects(runtime.waitAccount({request:async()=>{throw new Error('network');}},account,{pause:async()=>{}}),/network/);
});
test('faucet uses cached local identity, bounded cooldown and validated ledger readiness',{skip:!xahau},async()=>{
  const dir=temporary(),cache=path.join(dir,'testnet-wallet.json');let funded=0,polls=0,totalWait=0;
  try{
    const client={request:async q=>{
      if(q.command==='server_info')return {result:{info:{network_id:21338}}};
      if(funded<2||++polls<2)throw {data:{error:'actNotFound'}};
      return {result:{validated:true,account_data:{Account:q.account,Balance:'100000000'}}};
    }};
    const fetcher=async(_url,options)=>{assert.equal(JSON.parse(options.body).destination,jsonFile(cache).address);++funded;return {status:funded===1?429:200,ok:funded>1,headers:{get:()=>null},text:async()=>funded===1?'wait 2 seconds':'{"success":true}'};};
    const options={client,cache,fund:true,faucet:'https://xahau-test.net/accounts',fetcher,pause:async ms=>{totalWait+=ms;},attempts:3};
    const first=await funding.ensureWallet(options);assert.equal(funded,2);assert.equal(totalWait,4000);assert.equal(jsonFile(cache).funding,'VALIDATED');
    assert.equal((await funding.ensureWallet(options)).wallet.classicAddress,first.wallet.classicAddress);assert.equal(funded,2);
    if(process.platform!=='win32')assert.equal(fs.statSync(cache).mode&0o777,0o600);
    let requested=0;
    const successClient={request:async q=>{if(q.command==='server_info')return {result:{info:{network_id:21338}}};if(!requested)throw {data:{error:'actNotFound'}};return {result:{validated:true,account_data:{Account:q.account,Balance:'1000'}}};}};
    await funding.ensureWallet({client:successClient,cache:path.join(dir,'second.wallet.json'),fund:true,faucet:'https://xahau-test.net/accounts',pause:async()=>{},attempts:1,fetcher:async()=>{++requested;return {status:200,ok:true,headers:{get:()=>null},text:async()=>'\u007b"success":true,"message":"wait 2 seconds for ledger"}'};}});
    assert.equal(requested,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('ambiguous faucet response never triggers automatic repeat funding',{skip:!xahau},async()=>{
  const dir=temporary(),cache=path.join(dir,'testnet-wallet.json');let calls=0;
  try{
    const client={request:async q=>{if(q.command==='server_info')return {result:{info:{network_id:21338}}};throw {data:{error:'actNotFound'}};}};
    const opts={client,cache,fund:true,faucet:'https://xahau-test.net/accounts',fetcher:async()=>{++calls;throw new Error('timeout');},pause:async()=>{},attempts:1};
    await assert.rejects(funding.ensureWallet(opts),/outcome unknown/);assert.equal(jsonFile(cache).funding,'REQUESTED');
    await assert.rejects(funding.ensureWallet(opts),/not yet present/);assert.equal(calls,1);
    assert.equal(funding.cooldownMs({headers:{get:()=> '60'}},{}),60000);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('pipeline stops on lint finding with evidence and refuses reuse before any deployment',()=>{
  const dir=temporary();try{
    const source=path.join(dir,'bad.c'),work=path.join(dir,'run');fs.writeFileSync(source,'void hook(){ state_set(p,n,k,32); }');
    const argv=['--source',source,'--policy',path.join(root,'assets/minimal-artifact-policy.json'),'--guard',path.join(dir,'not-present'),'--work',work,'--testnet'];
    const result=run('scripts/agent-pipeline.mjs',...argv);assert.equal(result.status,1);const evidence=jsonFile(path.join(work,'evidence.json'));assert.equal(evidence.result,'STOPPED');assert.equal(evidence.stages.lint.result,'FAIL');assert.equal(evidence.stages.install,'NOT_RUN');
    assert.match(run('scripts/agent-pipeline.mjs',...argv).stderr,/Work directory exists/);
    assert.match(run('scripts/agent-pipeline.mjs',...argv,'--run-tests').stderr,/tests-file/);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

let compiler=false;try{createRequire(path.join(root,'assets/toolchain/package.json')).resolve('hooks-compiler');compiler=true;}catch{}
test('pipeline installs, smoke-checks and reads state using disposable keys and a local mock ledger only',{skip:!xahau||!compiler||!fs.existsSync(path.join(root,'build/guard/guard_checker'))},async()=>{
  const {WebSocketServer}=require('ws'),server=new WebSocketServer({host:'127.0.0.1',port:0});await new Promise(r=>server.once('listening',r));
  const dir=temporary(),work=path.join(dir,'run'),cache=path.join(dir,'testnet-wallet.json'),config=path.join(dir,'network.json');
  const wallet=xahau.Wallet.generate('ecdsa-secp256k1'),receipts=new Map();let submitted=0;
  fs.writeFileSync(cache,JSON.stringify({networkId:21338,address:wallet.classicAddress,seed:wallet.seed,funding:'VALIDATED'}),{mode:0o600});
  fs.writeFileSync(config,JSON.stringify({networkId:21338,websocket:`ws://127.0.0.1:${server.address().port}`}));
  server.on('connection',socket=>socket.on('message',bytes=>{
    const q=JSON.parse(bytes);let result;
    if(q.command==='server_info')result={info:{network_id:21338,build_version:'2026.10.13'}};
    else if(q.command==='account_info')result={validated:true,account_data:{Account:wallet.classicAddress,Balance:'100000000',OwnerCount:0,Sequence:submitted+1}};
    else if(q.command==='server_state')result={state:{validated_ledger:{reserve_base:1000000,reserve_inc:200000}}};
    else if(q.command==='account_objects')result={account_objects:submitted?[{Hooks:[{Hook:{HookHash:hash}}]}]:[]};
    else if(q.command==='fee')result={drops:{base_fee:'10'}};
    else if(q.command==='ledger')result={validated:true,ledger_hash:hash,ledger_index:101};
    else if(q.command==='submit'){
      ++submitted;const transaction=xahau.decode(q.tx_blob),txHash=xahau.hashes.hashSignedTx(q.tx_blob);
      receipts.set(txHash,{...transaction,hash:txHash,validated:true,ledger_index:101,meta:{TransactionResult:'tesSUCCESS',HookExecutions:transaction.TransactionType==='Invoke'?[{HookExecution:{HookAccount:wallet.classicAddress,HookHash:hash,HookReturnCode:'0000000000000000'}}]:[]}});
      result={engine_result:'tesSUCCESS'};
    }else if(q.command==='tx')result=receipts.get(q.transaction);
    else if(q.command==='account_namespace')result={validated:true,ledger_hash:hash,ledger_index:101,namespace_entries:[{LedgerEntryType:'HookState',HookStateKey:'0'.repeat(63)+'1',HookStateData:'01000000000000002A'}]};
    else{socket.send(JSON.stringify({id:q.id,type:'response',status:'error',error:'unknownCmd'}));return;}
    socket.send(JSON.stringify({id:q.id,type:'response',status:'success',result}));
  }));
  try{
    const args=[path.join(root,'scripts/agent-pipeline.mjs'),'--source',path.join(root,'assets/examples/owner-setting.c'),'--policy',path.join(root,'assets/owner-setting-artifact-policy.json'),'--guard',path.join(root,'build/guard/guard_checker'),...(process.platform==='win32'?['--wsl','Ubuntu']:[]),'--work',work,'--testnet','--submit','--config',config,'--contract',path.join(root,'assets/owner-setting-pipeline.json'),'--wallet-cache',cache,'--max-fee-drops','1000'];
    const r=await promisify(execFile)(process.execPath,args,{cwd:os.tmpdir(),timeout:60000,env:{...process.env,XAHAU_TESTNET_SEED:''}});
    assert.equal(JSON.parse(r.stdout).result,'VERIFIED_PROJECT_POSTCONDITIONS');assert.equal(submitted,2);
    const evidence=jsonFile(path.join(work,'evidence.json'));assert.equal(evidence.stages.readback.result,'PASS');assert.equal(evidence.stages.install.result,'PASS');
    assert.equal(JSON.stringify(evidence).includes(wallet.seed),false);assert.equal(r.stdout.includes(wallet.seed),false);
  }finally{for(const socket of server.clients)socket.terminate();await new Promise(r=>server.close(r));fs.rmSync(dir,{recursive:true,force:true});}
});
