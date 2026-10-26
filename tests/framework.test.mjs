import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {decodeAccount,encodeAccount} from '../scripts/account-codec.mjs';
import {createInterface,validateInterface} from '../scripts/interface-codec.mjs';
import {createMockRuntime} from '../assets/toolchain/mock-runtime.mjs';
import {exposeProbeMemory} from '../assets/toolchain/wasm-probe.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const schema=JSON.parse(fs.readFileSync(path.join(root,'assets/contact-book.interface.json'))),client=createInterface(schema);
const address='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',account='B5F762798A53D543A014CAF8B297CFF8F2F937E8';
const run=(script,...args)=>spawnSync(process.execPath,[path.join(root,script),...args],{encoding:'utf8',timeout:60000,cwd:root});
test('classic AccountID codec matches known genesis vector and rejects checksum corruption',()=>{
  assert.equal(decodeAccount(address).toString('hex').toUpperCase(),account);assert.equal(encodeAccount(Buffer.from(account,'hex')),address);
  for(let i=0;i<30;++i){const b=crypto.randomBytes(20);assert.deepEqual(decodeAccount(encodeAccount(b)),b);}
  assert.throws(()=>decodeAccount(address.slice(0,-1)+'r'));assert.throws(()=>encodeAccount(Buffer.alloc(19)));
});
test('contact schema matches independent fixed record/key vectors and self routing',()=>{
  assert.equal(client.encodeState('contact',{account:address}),'01'+account);
  assert.deepEqual(client.decodeState('contact','01'+account),{version:1,account:address});
  assert.equal(client.stateKey('contact',{name:'alice'}),'43544354616C696365'+'00'.repeat(23));
  const tx=client.buildInvoke('set',{name:'alice',addr:address},{account:address,networkId:21338});
  assert.equal(tx.Destination,undefined);assert.equal(tx.HookParameters[2].HookParameter.HookParameterValue,account);
  assert.throws(()=>client.buildInvoke('set',{}, {account:address,destination:address,networkId:21338}));
  assert.throws(()=>client.decodeState('contact','02'+account));assert.throws(()=>client.decodeState('contact','01'+account+'00'));
});
test('schema bounds UTF8, key ambiguity, unknown fields and artifact binding',()=>{
  for(const name of ['\0','a\0b','é'.repeat(15),''])assert.throws(()=>client.stateKey('contact',{name}));
  assert.throws(()=>client.encodeParameters('set',{name:'é'.repeat(15),addr:address}));
  for(const name of ['', 'a\0b'])assert.throws(()=>client.encodeParameters('set',{name,addr:address}));
  assert.throws(()=>client.encodeParameters('set',{name:'a',addr:address,typo:1}));
  assert.throws(()=>client.assertArtifact('AB'.repeat(32)));
  const bound=createInterface({...schema,artifactSha256:'ab'.repeat(32)});assert.equal(bound.assertArtifact('AB'.repeat(32)),true);assert.throws(()=>bound.assertArtifact('00'.repeat(32)));
  for(const bad of [{...schema,operations:[]},{...schema,schemaVersion:2},{...schema,unknown:true}])assert.throws(()=>validateInterface(bad));
  const tooMany=Array.from({length:17},(_,i)=>({name:'p'+i,type:'uint8'}));
  assert.throws(()=>validateInterface({...schema,operations:{set:{route:'self',params:tooMany}}}),/16 parameters/);
  assert.equal(validateInterface({...schema,name:'contact-book'}).name,'contact-book');
});
test('variable strings, integers and hash key use explicit BE bytes without uint64 precision loss',()=>{
  const fields=[{name:'text',type:'string',maxBytes:10},{name:'small',type:'uint32be'},{name:'large',type:'uint64be'}];
  const c=createInterface({schemaVersion:1,name:'vector',version:'1',operations:{},state:{row:{fields,key:{kind:'sha512half',prefixHex:'AB',fields}}}});
  const values={text:'é',small:42,large:'18446744073709551615'},hex='0002C3A90000002AFFFFFFFFFFFFFFFF';
  assert.equal(c.encodeState('row',values),hex);assert.deepEqual(c.decodeState('row',hex),values);
  assert.equal(c.stateKey('row',values),crypto.createHash('sha512').update(Buffer.from('AB'+hex,'hex')).digest('hex').slice(0,64).toUpperCase());
  for(const large of [1,'18446744073709551616','-1','01'])assert.throws(()=>c.encodeState('row',{...values,large}));
  assert.throws(()=>c.decodeState('row','0001FF0000002AFFFFFFFFFFFFFFFF'));
});
test('generated client is portable, independent of optional npm dependencies and exclusive',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-client-')),out=path.join(dir,'client.mjs');
  try{const args=['--schema',path.join(root,'assets/contact-book.interface.json'),'--out',out];assert.equal(run('scripts/generate-client.mjs',...args).status,0);assert.equal(run('scripts/generate-client.mjs',...args).status,1);
    const generated=await import(pathToFileURL(out));assert.equal(generated.client.encodeState('contact',{account:address}),'01'+account);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test('guard source diagnostics ignore comments and decline per-loop instruction attribution',()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-profile-'));try{
    const source=path.join(dir,'hook.c');fs.writeFileSync(source,'// _g(9,99)\n_g(1,21); _g(ID,BUDGET); "_g(4,5)";');
    const r=run('scripts/profile-guards.mjs','--source',source);assert.equal(r.status,0,r.stderr);const report=JSON.parse(r.stdout);
    assert.equal(report.guards.length,1);assert.equal(report.guards[0].line,2);assert.equal(report.unresolvedCalls,1);assert.equal(report.perGuardInstructionCosts,'NOT_AVAILABLE');
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
let compiler=false;try{createRequire(path.join(root,'assets/toolchain/package.json')).resolve('hooks-compiler');compiler=true;}catch{}
test('shared mock executes production C contact and emitted lifecycle with rollback/fault isolation',{skip:!compiler},async t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-framework-'));let contact,forward;
  try{
    async function build(name){const out=path.join(dir,name),r=run('assets/toolchain/compile.mjs','--source',path.join(root,`assets/examples/${name}.c`),'--out',out);assert.equal(r.status,0,r.stderr);return fs.readFileSync(path.join(out,'hook.cleaned.wasm'));}
    const contactWasm=await build('contact-book'),forwardWasm=await build('auto-forward');
    await t.test('mock CLI writes exclusive evidence and diagnostics reject mixed artifact identities',async()=>{
      const out=path.join(dir,'mock.json'),wasm=path.join(dir,'contact-book/hook.cleaned.wasm'),fixtures=path.join(root,'assets/contact-book.mock.json');
      const args=['--wasm',wasm,'--cases',fixtures,'--timeout-ms','3000','--out',out];
      const r=run('scripts/mock-hook.mjs',...args);assert.equal(r.status,0,r.stderr);assert.equal(run('scripts/mock-hook.mjs',...args).status,1);
      const report=JSON.parse(fs.readFileSync(out));assert.equal(report.result,'PASS');assert.equal(report.cases.length,3);
      const source=path.join(root,'assets/examples/contact-book.c');
      const profile=run('scripts/profile-guards.mjs','--source',source,'--mock',out);assert.equal(profile.status,0,profile.stderr);assert.equal(JSON.parse(profile.stdout).guards[1].observedMax,21);
      const mixed=run('scripts/profile-guards.mjs','--source',source,'--mock',out,'--wasm',path.join(dir,'auto-forward/hook.cleaned.wasm'));assert.equal(mixed.status,1);assert.match(mixed.stderr,/artifact mismatch/);
      const empty=path.join(dir,'empty.json');fs.writeFileSync(empty,'{"cases":[]}');assert.equal(run('scripts/mock-hook.mjs','--wasm',wasm,'--cases',empty).status,1);
    });
    const probe=exposeProbeMemory(contactWasm);assert.notEqual(probe.originalSha256,probe.probeSha256);assert.equal(WebAssembly.Module.exports(new WebAssembly.Module(contactWasm)).some(e=>e.name==='__probe_memory'),false);
    contact=await createMockRuntime(contactWasm,{timeoutMs:3000});forward=await createMockRuntime(forwardWasm,{timeoutMs:3000});
    const params=client.encodeParameters('set',{name:'alice',addr:address}).map(p=>({name:p.HookParameter.HookParameterName,value:p.HookParameter.HookParameterValue}));
    const base={hookAccount:account,fields:{524289:account},parameters:params};
    await t.test('generated params -> C -> schema-decoded state; unauthorized and write fault preserve state',async()=>{
      const saved=await contact.run(base),key=client.stateKey('contact',{name:'alice'}).toLowerCase();assert.equal(saved.outcome,'accept');assert.deepEqual(client.decodeState('contact',saved.state[key]),{version:1,account:address});
      for(const bad of [{...base,fields:{524289:'11'.repeat(20)}},{...base,faults:{state_set:{code:-4}}},{...base,parameters:params.slice(0,2)}]){const r=await contact.run(bad);assert.equal(r.outcome,'rollback');assert.deepEqual(r.state,saved.state);}
      assert.equal(saved.guards.find(g=>g.id===2).visits,21);
    });
    const key='41465744'+'00'.repeat(28),child='AB'.repeat(32),owner=account,target='22'.repeat(20),sender='33'.repeat(20);
    const pay={type:0,hookAccount:owner,fields:{524289:sender,524291:owner,393217:'40000000000F4240'},txId:'CD'.repeat(32),hookParameters:[{name:'736176696E6773',value:target}],preparedHex:'120000',emittedId:child};
    await t.test('prepare/emit/state failure rollback; accepted parent pending then metadata callback success',async()=>{
      for(const api of ['prepare','emit','state_set']){const r=await forward.run({...pay,faults:{[api]:{code:-4}}});assert.equal(r.outcome,'rollback');assert.deepEqual(r.state,{});assert.deepEqual(r.emitted,[]);}
      const p=await forward.run(pay);assert.equal(p.outcome,'accept');assert.equal(Buffer.from(p.state[key],'hex')[1],1);assert.equal(p.emitted.length,1);
      assert.equal((await forward.run(pay)).outcome,'rollback');
      const cb={entry:'cbak',txId:child,metadata:{1048579:'00'}};
      const unknown=await forward.run({...cb,metadata:undefined});assert.equal(unknown.state[key],p.state[key]);
      const wrong=await forward.run({...cb,txId:'00'.repeat(32)});assert.equal(wrong.state[key],p.state[key]);
      const fault=await forward.run({...cb,faults:{state_set:{code:-4}}});assert.equal(fault.code,'00000000000007d5');assert.equal(fault.state[key],p.state[key]);
      const done=await forward.run(cb);assert.equal(Buffer.from(done.state[key],'hex')[1],2);assert.deepEqual((await forward.run(cb)).state,done.state);
    });
    await t.test('failed callback -> owner retry -> expiry fixture; bounded and pending never replay',async()=>{
      await forward.run(pay);const failed=await forward.run({entry:'cbak',txId:child,metadata:{1048579:'8F'}});assert.equal(Buffer.from(failed.state[key],'hex')[1],3);
      const retry={...pay,type:99,fields:{524289:owner},parameters:[{name:'6F70',value:'7265747279'}],emittedId:'EF'.repeat(32)};
      assert.equal((await forward.run({...retry,fields:{524289:sender}})).outcome,'rollback');
      const p=await forward.run(retry);assert.equal(Buffer.from(p.state[key],'hex')[62],2);assert.equal((await forward.run(retry)).outcome,'rollback');
      const expired=await forward.run({entry:'cbak',argument:1,txId:retry.emittedId});assert.equal(Buffer.from(expired.state[key],'hex')[1],3);
      await forward.run(retry);await forward.run({entry:'cbak',argument:1,txId:retry.emittedId});assert.equal((await forward.run(retry)).outcome,'rollback');
    });
    await t.test('unsupported imports, excessive memory and timeout fail closed',async()=>{
      const unknown=Buffer.from(contactWasm);const at=unknown.indexOf(Buffer.from('state_set'));unknown.write('other_api',at);await assert.rejects(()=>createMockRuntime(unknown,{timeoutMs:3000}),/Unsupported mock import/);
      assert.throws(()=>exposeProbeMemory(contactWasm,1),/memory/);
      // Small test module: hook loops forever, one bounded memory; worker must die.
      const infinite=Buffer.from('0061736d0100000001040160000003020100050301000107080104686f6f6b00000a0901070003400c000b0b','hex');
      const runner=await createMockRuntime(infinite,{timeoutMs:1000});try{await assert.rejects(()=>runner.run(),/timed out/);await assert.rejects(()=>runner.run(),/unavailable/);}finally{await runner.close();}
      await assert.rejects(()=>contact.run({...base,phase:'weak'}),/weak/);
    });
  }finally{await contact?.close();await forward?.close();fs.rmSync(dir,{recursive:true,force:true});}
});
