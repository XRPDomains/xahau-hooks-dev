import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createInterface} from '../scripts/interface-codec.mjs';
import {createMockRuntime} from '../assets/toolchain/mock-runtime.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const address='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',account='B5F762798A53D543A014CAF8B297CFF8F2F937E8';
const schemaFor=fields=>({schemaVersion:1,name:'constants',version:'1',operations:{set:{route:'self',params:fields}},state:{row:{key:{kind:'fixed',hex:'00'.repeat(32)},fields}}});

// Independent, compiler-free WASM probe of the pinned node's _g return contract.
// hook(n): require _g(1,1)==1; for(i=0; _g(2,4) && i<n; ++i) ++count;
//          accept(count). A fourth iteration must instead hit GUARD_VIOLATION.
function guardProbe(){
  const leb=n=>{const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b);}while(n);return out;};
  const str=s=>[...leb(Buffer.byteLength(s)),...Buffer.from(s)];
  const section=(id,bytes)=>[id,...leb(bytes.length),...bytes];
  const body=[1,2,0x7F,
    0x41,1,0x41,1,0x10,0,0x41,1,0x47,0x04,0x40,
    0x41,0,0x41,0,0x42,0xE9,7,0x10,2,0x0F,0x0B,
    0x02,0x40,0x03,0x40,0x41,2,0x41,4,0x10,0,0x45,0x0D,1,
    0x20,2,0x20,0,0x4F,0x0D,1,
    0x20,1,0x41,1,0x6A,0x21,1,0x20,2,0x41,1,0x6A,0x21,2,0x0C,0,0x0B,0x0B,
    0x41,0,0x41,0,0x20,1,0xAD,0x10,1,0x0B];
  return Buffer.from([0,97,115,109,1,0,0,0,
    ...section(1,[3,0x60,2,0x7F,0x7F,1,0x7F,0x60,3,0x7F,0x7F,0x7E,1,0x7E,0x60,1,0x7F,1,0x7E]),
    ...section(2,[3,...str('env'),...str('_g'),0,0,...str('env'),...str('accept'),0,1,...str('env'),...str('rollback'),0,1]),
    ...section(3,[1,2]),...section(5,[1,0,2]),...section(7,[1,...str('hook'),0,3]),
    ...section(10,[1,...leb(body.length),...body])]);
}

test('successful mock guards return one and boolean loop conditions execute their bodies',async()=>{
  const wasm=guardProbe();assert.equal(WebAssembly.validate(wasm),true);
  const runner=await createMockRuntime(wasm,{timeoutMs:3000});try{
    const zero=await runner.run({argument:0});assert.equal(zero.outcome,'accept');assert.equal(zero.code,'0000000000000000');
    const three=await runner.run({argument:3});assert.equal(three.outcome,'accept');assert.equal(three.code,'0000000000000003');assert.equal(three.guards.find(g=>g.id===2).visits,4);
  }finally{await runner.close();}
});
test('guard overflow still rolls back with the native error code after successful boolean visits',async()=>{
  const runner=await createMockRuntime(guardProbe(),{timeoutMs:3000});try{
    const result=await runner.run({argument:4});assert.equal(result.outcome,'rollback');assert.equal(result.committed,false);assert.equal(result.code,'fffffffffffffff0');assert.equal(result.guards.find(g=>g.id===2).visits,5);
  }finally{await runner.close();}
});
test('byte constants compare encoded bytes across hex case and reject actual mismatches',()=>{
  for(const constant of ['aa','AA']){
    const c=createInterface(schemaFor([{name:'tag',type:'bytes',bytes:1,const:constant}]));
    for(const tag of [undefined,'aa','AA'])assert.equal(c.encodeState('row',tag===undefined?{}:{tag}),'AA');
    assert.deepEqual(c.decodeState('row','aa'),{tag:'AA'});assert.equal(c.encodeParameters('set',{tag:'AA'})[0].HookParameter.HookParameterValue,'AA');
    assert.throws(()=>c.encodeState('row',{tag:'AB'}),/mismatch/);assert.throws(()=>c.decodeState('row','AB'),/mismatch/);
  }
});
test('account constants round-trip raw hex/r-address aliases but never accept a different AccountID',()=>{
  for(const constant of [account,account.toLowerCase(),address]){
    const c=createInterface(schemaFor([{name:'owner',type:'account20',const:constant}]));
    for(const owner of [undefined,account,account.toLowerCase(),address])assert.equal(c.encodeState('row',owner===undefined?{}:{owner}),account);
    assert.deepEqual(c.decodeState('row',account),{owner:address});assert.equal(c.encodeParameters('set',{owner:address})[0].HookParameter.HookParameterValue,account);
    assert.throws(()=>c.encodeState('row',{owner:'00'.repeat(20)}),/mismatch/);assert.throws(()=>c.decodeState('row','00'.repeat(20)),/mismatch/);
  }
});
test('numeric/string constants retain exact byte semantics, version checks and uint64 precision',()=>{
  const c=createInterface(schemaFor([{name:'version',type:'uint8',const:1},{name:'count',type:'uint32be',const:'42'},{name:'large',type:'uint64be',const:'18446744073709551615'},{name:'text',type:'string',maxBytes:10,const:'é'}]));
  const encoded='010000002AFFFFFFFFFFFFFFFF0002C3A9';assert.equal(c.encodeState('row',{version:'1',count:42,large:18446744073709551615n}),encoded);
  assert.deepEqual(c.decodeState('row',encoded),{version:1,count:42,large:'18446744073709551615',text:'é'});
  assert.throws(()=>c.encodeState('row',{text:'É'}),/mismatch/);assert.throws(()=>c.decodeState('row','02'+encoded.slice(2)),/mismatch/);
  assert.throws(()=>c.encodeState('row',{large:18446744073709551615}));
});
test('standalone generated clients preserve binary/account constant fixes outside the skill cwd',async()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-const-client-'));try{
    const file=path.join(dir,'schema.json'),out=path.join(dir,'client.mjs');fs.writeFileSync(file,JSON.stringify(schemaFor([{name:'tag',type:'bytes',bytes:1,const:'aa'},{name:'owner',type:'account20',const:account}])));
    const r=spawnSync(process.execPath,[path.join(root,'scripts/generate-client.mjs'),'--schema',file,'--out',out],{cwd:dir,timeout:60000,encoding:'utf8'});assert.equal(r.status,0,r.stderr);
    const {client}=await import(pathToFileURL(out));assert.deepEqual(client.decodeState('row',client.encodeState('row',{tag:'AA',owner:address})),{tag:'AA',owner:address});
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
