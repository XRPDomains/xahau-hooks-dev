import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'assets/examples/deploy/package.json'));
let xahau,lib;try{xahau=require('xahau');lib=await import('../assets/examples/deploy/issuer-plans.mjs');}catch(e){if(e.code!=='MODULE_NOT_FOUND'&&e.code!=='ERR_MODULE_NOT_FOUND')throw e;}
const issuer='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh',holder='rPT1Sjq2YGrBMTttX4GZHjKu9dyfzbpAYe',recipient='r9cZA1mLK5R5Am25ArfXFmqgNwjZgnfk59';
const hash='AB'.repeat(32),ledger={networkId:21338,validated:true,ledgerIndex:101,ledgerHash:hash};
test('issuer plans are offline, codec-valid and keep sale/cancel and native/issued amounts distinct',{skip:!xahau},()=>{
  const nft=lib.issuerPlan({kind:'uritoken',issuer,holder}),token=lib.issuerPlan({kind:'token',issuer,holder,recipient});
  assert.equal(nft.steps[0].tx.Flags,0);assert.equal(nft.steps[1].tx.Amount,'1000000');
  assert.equal(nft.steps[1].tx.URITokenID,nft.identity.tokenId);assert.equal(nft.alternatives[0].after,'offer');
  assert.deepEqual(token.steps[2].tx.Amount,{currency:'TST',issuer,value:'10'});
  for(const plan of [nft,token])for(const {tx} of [...plan.steps,...plan.alternatives]){
    const decoded=xahau.decode(xahau.encode({...tx,Fee:'0',Sequence:1,LastLedgerSequence:100,SigningPubKey:''}));
    assert.equal(decoded.TransactionType,tx.TransactionType);assert.equal(decoded.NetworkID,21338);assert.equal(tx.Fee,undefined);
  }
  for(const input of [{kind:'token',issuer,holder,recipient:holder},{kind:'uritoken',issuer,holder:issuer},{kind:'uritoken',issuer,holder,uri:'https://wrong'},{kind:'uritoken',issuer,holder,uri:'ipfs://'+'x'.repeat(194)}])assert.throws(()=>lib.issuerPlan(input));
});
test('NFT evidence checks receipt, owner, offer, identity, burn rights and ledger freshness',{skip:!xahau},()=>{
  const plan=lib.issuerPlan({kind:'uritoken',issuer,holder}),receipt=name=>({...plan.steps.find(s=>s.name===name).tx,validated:true,ledger_index:100,meta:{TransactionResult:'tesSUCCESS'}});
  const node={LedgerEntryType:'URIToken',index:plan.identity.tokenId,Issuer:issuer,URI:plan.identity.URI,Owner:issuer,Flags:0};
  const snapshot={...ledger,kind:'uritoken',tokenId:plan.identity.tokenId,node};
  assert.equal(lib.assertIssuerReadback(plan,'mint',snapshot,receipt('mint')),true);
  for(const bad of [{...snapshot,node:{...node,Owner:holder}},{...snapshot,node:{...node,Amount:'1'}},{...snapshot,node:{...node,Flags:1}},{...snapshot,ledgerIndex:99},{...snapshot,networkId:21337},{...snapshot,node:{...node,Issuer:holder}}])assert.throws(()=>lib.assertIssuerReadback(plan,'mint',bad,receipt('mint')));
  assert.throws(()=>lib.assertIssuerReadback(plan,'mint',snapshot,{...receipt('mint'),URI:'00'}));
  assert.equal(lib.assertIssuerReadback(plan,'buy',{...snapshot,node:{...node,Owner:holder}},receipt('buy')),true);
  assert.equal(lib.assertIssuerReadback(plan,'owner-burn',{...snapshot,node:null},receipt('owner-burn')),true);
  assert.throws(()=>lib.assertIssuerReadback(plan,'owner-burn',snapshot,receipt('owner-burn')));
});
test('token evidence uses holder-perspective exact decimal and exact issuer/currency',{skip:!xahau},()=>{
  const plan=lib.issuerPlan({kind:'token',issuer,holder,recipient}),step=plan.steps.find(s=>s.name==='issue');
  const receipt={...step.tx,validated:true,ledger_index:100,meta:{TransactionResult:'tesSUCCESS'}};
  const snapshot={...ledger,kind:'token',account:holder,issuer,currency:'TST',line:{account:issuer,currency:'TST',balance:'10.000'}};
  assert.equal(lib.assertIssuerReadback(plan,'issue',snapshot,receipt),true);
  for(const bad of [{...snapshot,account:issuer},{...snapshot,line:null},{...snapshot,line:{...snapshot.line,balance:'9.999999999999999'}},{...snapshot,line:{...snapshot.line,currency:'USD'}}])assert.throws(()=>lib.assertIssuerReadback(plan,'issue',bad,receipt));
  assert.throws(()=>lib.assertIssuerReadback(plan,'issue',snapshot,{...receipt,validated:false}));
});

test('issuer read-only CLI pins ledger, paginates and rejects wrong network/ledger against local WebSocket RPC',{skip:!xahau},async()=>{
  const {WebSocketServer}=require('ws'),server=new WebSocketServer({host:'127.0.0.1',port:0});
  await new Promise(r=>server.once('listening',r));
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xh-issuer-reader-')),config=path.join(temp,'network.json');
  let mode='token';const requests=[];
  server.on('connection',socket=>socket.on('message',bytes=>{
    const q=JSON.parse(bytes);requests.push(q);let result;
    if(q.command==='server_info')result={info:{network_id:mode==='mainnet'?21337:21338,build_version:'2026.10.13'}};
    else if(q.command==='ledger')result={validated:true,ledger_hash:hash,ledger_index:101};
    else if(q.command==='account_lines')result={validated:true,ledger_hash:mode==='mismatch'?'CD'.repeat(32):hash,ledger_index:101,
      lines:q.marker?[{account:issuer,currency:'TST',balance:'10'}]:[],...(q.marker?{}:{marker:'next'})};
    else if(q.command==='ledger_entry'){
      if(mode==='nft'){socket.send(JSON.stringify({id:q.id,type:'response',status:'success',result:{index:hash,node:{LedgerEntryType:'URIToken',Owner:holder},ledger_hash:hash}}));return;}
      socket.send(JSON.stringify({id:q.id,type:'response',status:'error',error:'entryNotFound',request:q}));return;
    }else{socket.send(JSON.stringify({id:q.id,type:'response',status:'error',error:'unknownCmd'}));return;}
    socket.send(JSON.stringify({id:q.id,type:'response',status:'success',result}));
  }));
  const run=async(...extra)=>{
    try{return {status:0,...await promisify(execFile)(process.execPath,[path.join(root,'assets/examples/deploy/read-issuer-state.mjs'),'--config',config,...extra],{timeout:20000,env:{...process.env,XAHAU_TESTNET_SEED:''}})};}
    catch(e){return {status:e.code,stderr:e.stderr};}
  };
  try{
    fs.writeFileSync(config,JSON.stringify({networkId:21338,websocket:`ws://127.0.0.1:${server.address().port}`}));
    const args=['--kind','token','--account',holder,'--issuer',issuer];
    const token=await run(...args);assert.equal(token.status,0,token.stderr);assert.equal(JSON.parse(token.stdout).line.balance,'10');
    for(const request of requests.filter(q=>['account_lines','ledger_entry'].includes(q.command)))assert.equal(request.ledger_hash,hash);
    mode='absent';const absent=await run('--kind','uritoken','--token-id',hash);assert.equal(absent.status,0,absent.stderr);assert.equal(JSON.parse(absent.stdout).node,null);
    mode='nft';const nft=await run('--kind','uritoken','--token-id',hash);assert.equal(nft.status,0,nft.stderr);assert.equal(JSON.parse(nft.stdout).node.index,hash);
    mode='mismatch';assert.match((await run(...args)).stderr,/ledger mismatch/);
    mode='mainnet';assert.match((await run(...args)).stderr,/not testnet/);
    assert.ok(requests.every(q=>['server_info','ledger','account_lines','ledger_entry'].includes(q.command)));
  }finally{for(const socket of server.clients)socket.terminate();await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
});

test('issuer prepare/verify CLIs refuse overwriting and reject edited receipt evidence',{skip:!xahau},()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-issuer-cli-')),planFile=path.join(dir,'plan.json'),snapshotFile=path.join(dir,'readback.json'),receiptFile=path.join(dir,'receipt.json');
  const run=(file,...args)=>spawnSync(process.execPath,[path.join(root,`assets/examples/deploy/${file}.mjs`),...args],{encoding:'utf8',timeout:10000,cwd:os.tmpdir()});
  try{
    const args=['--kind','uritoken','--issuer',issuer,'--holder',holder,'--out',planFile];
    assert.equal(run('prepare-issuer',...args).status,0);assert.equal(run('prepare-issuer',...args).status,1);
    const plan=JSON.parse(fs.readFileSync(planFile,'utf8'));
    fs.writeFileSync(snapshotFile,JSON.stringify({...ledger,kind:'uritoken',tokenId:plan.identity.tokenId,node:{LedgerEntryType:'URIToken',index:plan.identity.tokenId,Issuer:issuer,URI:plan.identity.URI,Owner:issuer,Flags:0}}));
    const receipt={...plan.steps[0].tx,validated:true,ledger_index:100,meta:{TransactionResult:'tesSUCCESS'}};fs.writeFileSync(receiptFile,JSON.stringify(receipt));
    const verify=['--plan',planFile,'--step','mint','--snapshot',snapshotFile,'--receipt',receiptFile];assert.equal(run('verify-issuer',...verify).status,0);
    fs.writeFileSync(receiptFile,JSON.stringify({...receipt,URI:'00'}));assert.equal(run('verify-issuer',...verify).status,1);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

// Test-only WASM export addition: same compiled code, host-visible memory for mocks.
// This instrumented module must never be deployed or used as production guard evidence.
function uleb(n){const out=[];do{let b=n&127;n>>>=7;if(n)b|=128;out.push(b);}while(n);return out;}
function exposeMemory(bytes){
  let offset=8;const out=[...bytes.subarray(0,8)];
  function read(){let n=0,shift=0,b;do{b=bytes[offset++];n|=(b&127)<<shift;shift+=7;}while(b&128);return n;}
  while(offset<bytes.length){const id=bytes[offset++],size=read(),start=offset;let payload;
    if(id===7){const count=read();payload=[...uleb(count+1),...bytes.subarray(offset,start+size),6,...Buffer.from('memory'),2,0];}
    else payload=[...bytes.subarray(start,start+size)];
    out.push(id,...uleb(payload.length),...payload);offset=start+size;
  }return Uint8Array.from(out);
}
let compiler=false;try{createRequire(path.join(root,'assets/toolchain/package.json')).resolve('hooks-compiler');compiler=true;}catch{}
test('issuer C production builds and mocked WASM policy/error branches',{skip:!compiler||!xahau},async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xh-issuer-probes-'));
  try{
    for(const kind of ['uritoken','issued-token']){
      const output=path.join(temp,kind),source=path.join(root,`assets/examples/${kind}-issuer.c`);
      const compile=spawnSync(process.execPath,[path.join(root,'assets/toolchain/compile.mjs'),'--source',source,'--out',output],{encoding:'utf8',timeout:60000});assert.equal(compile.status,0,compile.stderr);
      const bytes=fs.readFileSync(path.join(output,'hook.cleaned.wasm'));
      const inspect=spawnSync(process.execPath,[path.join(root,'scripts/inspect-artifact.mjs'),'--wasm',path.join(output,'hook.cleaned.wasm'),'--policy',path.join(root,`assets/${kind}-issuer-artifact-policy.json`)],{encoding:'utf8'});
      assert.equal(inspect.status,0,inspect.stderr);assert.equal(JSON.parse(inspect.stdout).guard,'NOT_RUN');
      let instance,fields,type,failXfl=false,nextXfl=1n;const xflValues=new Map([[0n,0n]]);
      const mockXfl=value=>{if(value===0n)return 0n;const id=nextXfl++;xflValues.set(id,value);return id;};
      const account=Buffer.alloc(20,7),stop=(accepted,code)=>{throw {accepted,code};};
      const write=(ptr,cap,data)=>{if(typeof data==='number')return BigInt(data);if(!data)return -5n;if(data.length>cap)return -4n;new Uint8Array(instance.exports.memory.buffer,ptr,data.length).set(data);return BigInt(data.length);};
      const env={_g:()=>0,hook_account:(p,n)=>write(p,n,account),otxn_type:()=>BigInt(type),otxn_field:(p,n,f)=>write(p,n,fields[f]),accept:(_p,_n,c)=>stop(true,c),rollback:(_p,_n,c)=>stop(false,c),
        float_sto_set:p=>{if(failXfl)return -1n;const raw=Buffer.from(new Uint8Array(instance.exports.memory.buffer,p,8)).readBigUInt64BE();
          const mantissa=raw&((1n<<54n)-1n),exponent=Number((raw>>54n)&255n)-97;
          // Mock compares integer sample values only, not a replacement XFL runtime.
          return mockXfl((raw&(1n<<62n)?1n:-1n)*mantissa*(exponent>=0?10n**BigInt(exponent):1n)/(exponent<0?10n**BigInt(-exponent):1n));},
        float_set:(_exponent,mantissa)=>mockXfl(mantissa),float_compare:(a,b,mode)=>{a=xflValues.get(a);b=xflValues.get(b);return ((a===b&&(mode&1))||(a<b&&(mode&2))||(a>b&&(mode&4)))?1n:0n;}};
      instance=(await WebAssembly.instantiate(exposeMemory(bytes),{env})).instance;
      const field={Account:(8<<16)+1,URI:(7<<16)+5,Flags:(2<<16)+2,Amount:(6<<16)+1};
      const execute=()=>{try{instance.exports.hook(0);assert.fail('Expected accept/rollback');}catch(e){if(typeof e.accepted!=='boolean')throw e;return e;}};
      const reset=()=>{type=kind==='uritoken'?45:0;failXfl=false;fields={[field.Account]:account};};
      const amount=(value='10',currency='TST',owner=issuer)=>{
        const data=Buffer.from(xahau.encode({Amount:{currency,issuer:owner,value}}).slice(2),'hex');account.copy(data,28);return data;
      };
      reset();fields[field.URI]=Buffer.from('ipfs://x');fields[field.Amount]=amount();assert.equal(execute().accepted,true);
      if(kind==='uritoken'){
        fields[field.URI]=Buffer.from('https://x');assert.equal(execute().code,2004n);
        fields[field.URI]=Buffer.from('ipfs://x');fields[field.Flags]=Buffer.from([0,0,0,1]);assert.equal(execute().code,2006n);
        fields[field.Flags]=-4;assert.equal(execute().code,2005n);
        delete fields[field.Flags];fields[field.URI]=Buffer.alloc(201);assert.equal(execute().code,2003n);
      }else{
        fields[field.Amount]=amount('101');assert.equal(execute().code,2108n);
        fields[field.Amount]=amount('0');assert.equal(execute().code,2108n);
        fields[field.Amount]=amount('-1');assert.equal(execute().code,2108n);
        fields[field.Amount]=amount('100');assert.equal(execute().accepted,true);
        fields[field.Amount]=amount('10','USD');assert.equal(execute().code,2104n);
        fields[field.Amount]=amount();fields[field.Amount][47]^=1;assert.equal(execute().code,2104n);
        fields[field.Amount]=amount();fields[field.Flags]=Buffer.from([0,2,0,0]);assert.equal(execute().code,2106n);
        delete fields[field.Flags];failXfl=true;assert.equal(execute().code,2107n);failXfl=false;
        fields[field.Amount]=Buffer.alloc(8);assert.equal(execute().accepted,true);
        fields[field.Amount]=-4;assert.equal(execute().code,2103n);
      }
      reset();fields[field.Account]=-4;assert.equal(execute().accepted,false);
      reset();fields[field.Account]=Buffer.alloc(20,8);assert.equal(execute().accepted,true);
      type=99;assert.equal(execute().accepted,true);type=-1;assert.equal(execute().accepted,false);
    }
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
