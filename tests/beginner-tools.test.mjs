import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {typeIds,maskFor,validateActivation} from '../scripts/hookon-lib.mjs';
import {firstInstall,validateFirstInstall,validateSettingInvoke} from '../scripts/sethook-lib.mjs';
import {snapshot} from '../scripts/rpc.mjs';
import {wslPath} from '../scripts/wsl-path.mjs';

test('HookOn ordinary active-low bits and SetHook active-high exception',()=>{
  const disabled=BigInt('0x'+maskFor([]));
  assert.equal(disabled & (1n<<22n),0n);
  assert.equal(disabled | (1n<<22n),(1n<<256n)-1n);
  const payment=BigInt('0x'+maskFor(typeIds('Payment')));
  assert.equal(payment&1n,0n);assert.equal(payment&(1n<<99n),1n<<99n);
  assert.equal(payment&(1n<<22n),0n);
  const both=maskFor(typeIds('Payment,Invoke'));
  assert.equal(both.length,64);assert.equal(BigInt('0x'+both)&(1n<<99n),0n);
  assert.throws(()=>maskFor(typeIds('SetHook')),/allow-sethook/);
  assert.notEqual(BigInt('0x'+maskFor(typeIds('SetHook'),{allowSetHook:true}))&(1n<<22n),0n);
});
test('HookOn parses explicit definitions, none and numeric types; rejects unknowns',()=>{
  assert.deepEqual(typeIds('none'),[]);
  assert.equal(typeIds('NewType',{TRANSACTION_TYPES:{NewType:200}})[0].id,200);
  assert.equal(typeIds('255')[0].id,255);
  for(const input of ['256','-1','Wrong','Payment,0','Payment,'])assert.throws(()=>typeIds(input));
});
test('HookOnV2_1 mask validation rejects mixed, incomplete or equal masks',()=>{
  const a=maskFor(typeIds('Payment')),b=maskFor(typeIds('Invoke'));
  assert.ok(validateActivation({HookOn:a}));assert.ok(validateActivation({HookOnIncoming:a,HookOnOutgoing:b}));
  for(const input of [{},{HookOn:a,HookOnIncoming:a,HookOnOutgoing:b},{HookOnIncoming:a},
    {HookOnIncoming:a,HookOnOutgoing:a},{HookOn:'123'}])assert.throws(()=>validateActivation(input));
});
const wasm=Buffer.from('0061736d010000000104016000000302010007080104686f6f6b00000a040102000b','hex');
const account='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
const evidence={structure:'PASS',guard:{result:'PASS'},bytes:wasm.length,sha256:crypto.createHash('sha256').update(wasm).digest('hex')};
const input=()=>({wasm,evidence,account,namespace:'AB'.repeat(32),hookOn:maskFor(typeIds('Invoke')),networkId:21338});
test('unsigned first-install preserves bytes and carries explicit network/namespace',()=>{
  const tx=firstInstall(input());assert.equal(tx.Hooks[0].Hook.CreateCode,wasm.toString('hex').toUpperCase());
  assert.equal(tx.NetworkID,21338);assert.equal(tx.Hooks[0].Hook.Flags,undefined);
  assert.equal(validateFirstInstall(tx,21338,account),tx);
});
test('unsigned builder rejects stale, missing or failed production evidence',()=>{
  for(const bad of [undefined,{...evidence,sha256:'wrong'},{...evidence,bytes:999},
    {...evidence,structure:'FAIL'},{...evidence,guard:'NOT_RUN'}])assert.throws(()=>firstInstall({...input(),evidence:bad}),/evidence/);
  assert.throws(()=>firstInstall({...input(),wasm:Buffer.from('invalid')}),/WASM/);
});
test('reference first-install refuses override, reset, alternate routing and filled tx fields',()=>{
  for(const mutate of [tx=>tx.Hooks[0].Hook.Flags=1,tx=>tx.Hooks[0].Hook.Flags=2,
    tx=>tx.Hooks.push({Hook:{}}),tx=>tx.Fee='1',tx=>tx.Destination=account,
    tx=>tx.Hooks[0].Hook.HookHash='00'.repeat(32),tx=>tx.Hooks[0].Hook.HookOn=maskFor(typeIds('SetHook'),{allowSetHook:true})]){
    const tx=firstInstall(input());mutate(tx);assert.throws(()=>validateFirstInstall(tx,21338,account));
  }
  assert.throws(()=>validateFirstInstall(firstInstall(input()),21337,account),/mismatch/);
});
test('HookOn CLI returns usable JSON and rejects ambiguous directions',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const run=(...args)=>spawnSync(process.execPath,[path.join(root,'scripts/hookon.mjs'),...args],{encoding:'utf8'});
  const result=run('--types','Payment,Invoke');assert.equal(result.status,0,result.stderr);
  assert.equal(JSON.parse(result.stdout).hook.HookOn,maskFor(typeIds('Payment,Invoke')));
  assert.equal(run('--incoming','Payment','--outgoing','Payment').status,1);
});
test('optional dependencies are exact versions with committed locks',()=>{
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  for(const relative of ['assets/toolchain','assets/examples/deploy']){
    const pkg=JSON.parse(fs.readFileSync(path.join(root,relative,'package.json')));
    const lock=JSON.parse(fs.readFileSync(path.join(root,relative,'package-lock.json')));
    assert.equal(pkg.private,true);
    for(const [name,version] of Object.entries(pkg.dependencies)){
      assert.match(version,/^\d+\.\d+\.\d+$/);assert.equal(lock.packages['node_modules/'+name].version,version);
    }
  }
});
test('WSL adapter normalizes drive paths and preserves spaces without a shell',()=>{
  assert.equal(wslPath('C:\\work space\\build\\..\\hook.wasm'),'/mnt/c/work space/hook.wasm');
  assert.equal(wslPath('D:/checker/guard_checker'),'/mnt/d/checker/guard_checker');
  for(const p of ['relative/path','\\\\server\\share\\file','/linux/path'])assert.throws(()=>wslPath(p));
});
test('setting Invoke is limited to exact self-write fields and eight bytes',()=>{
  const tx={TransactionType:'Invoke',Account:account,NetworkID:21338,HookParameters:[{HookParameter:{HookParameterName:'73657474696E67',HookParameterValue:'000000000000002A'}}]};
  assert.equal(validateSettingInvoke(tx,21338,account),tx);
  assert.throws(()=>validateSettingInvoke({...tx,Destination:account},21338,account));
  assert.throws(()=>validateSettingInvoke({...tx,HookParameters:[]},21338,account));
  const bad=structuredClone(tx);bad.HookParameters[0].HookParameter.HookParameterValue='01';
  assert.throws(()=>validateSettingInvoke(bad,21338,account));
});
test('read-only transport adapter retains network checking and supports explicit mainnet reads',async()=>{
  const calls=[];
  const result=await snapshot({networkId:21337},account,'AB'.repeat(32),async(method,params)=>{
    calls.push({method,params});
    if(method==='server_info')return {result:{info:{network_id:21337}}};
    if(method==='ledger')return {result:{validated:true,ledger_hash:'CD'.repeat(32),ledger_index:42}};
    return {result:{namespace_entries:[]}};
  });
  assert.equal(result.networkId,21337);assert.equal(calls[2].params.ledger_hash,'CD'.repeat(32));
  await assert.rejects(snapshot({networkId:21338},account,'AB'.repeat(32),async()=>({result:{info:{network_id:21337}}})),/Network ID/);
});
