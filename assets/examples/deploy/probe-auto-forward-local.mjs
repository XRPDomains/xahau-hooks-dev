import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {Client,Wallet,encode} from 'xahau';
import {args,required,main,print} from '../../../scripts/lib.mjs';

// Optional native integration test. No configurable remote endpoint or cached secrets.
main(async()=>{
  const a=args(process.argv.slice(2),['--wasm','--out'],['--help']);
  if(a['--help'])return print({usage:'node probe-auto-forward-local.mjs --wasm final.wasm --out new-evidence.json',requires:'Explicitly started standalone loopback node: ws://127.0.0.1:18275, NetworkID 2133900, HooksUpdate2 enabled in genesis config. Destructive only to this disposable ledger.'});
  const out=required(a['--out'],'--out');
  if(fs.existsSync(out))throw new Error('Evidence exists; choose a fresh path');
  const wasm=fs.readFileSync(required(a['--wasm'],'--wasm'));
  const client=new Client('ws://127.0.0.1:18275');
  const receipts=[];
  await client.connect();
  try{
    const info=(await client.request({command:'server_info'})).result.info;
    assert.equal(info.network_id,2133900,'Dedicated disposable network required');
    await client.request({command:'ledger_accept'}); // Only standalone accepts this command.
    const root=Wallet.fromEntropy(crypto.createHash('sha512').update('masterpassphrase').digest().subarray(0,16),{algorithm:'ecdsa-secp256k1'});
    assert.equal(root.classicAddress,'rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh');
    const owner=Wallet.generate(),savings=Wallet.generate();
    async function submit(wallet,tx){
      const prepared=await client.autofill({...tx,Account:wallet.classicAddress,NetworkID:2133900,Fee:'0'});
      prepared.SigningPubKey='';
      const fee=(await client.request({command:'fee',tx_blob:encode(prepared)})).result.drops.base_fee;
      assert.match(fee,/^[1-9]\d*$/);assert.ok(BigInt(fee)<1000000000n,'Local fee cap');
      prepared.Fee=fee;delete prepared.SigningPubKey;
      const signed=wallet.sign(prepared);
      receipts.push({hash:signed.hash,transaction:prepared,stage:'SIGNED_BEFORE_SINGLE_SUBMIT'});
      fs.writeFileSync(out,JSON.stringify({scope:'LOCAL_STANDALONE_IN_PROGRESS',receipts},null,2)+'\n',{encoding:'utf8',flag:receipts.length===1?'wx':'w'});
      const response=(await client.submit(signed.tx_blob)).result;
      if(!['tesSUCCESS','terQUEUED'].includes(response.engine_result))throw new Error('Submit: '+JSON.stringify(response));
      await client.request({command:'ledger_accept'});
      const receipt=(await client.request({command:'tx',transaction:signed.hash,binary:false})).result;
      receipts.at(-1).receipt=receipt;
      fs.writeFileSync(out,JSON.stringify({scope:'LOCAL_STANDALONE_IN_PROGRESS',receipts},null,2)+'\n','utf8');
      assert.equal(receipt.validated,true);assert.equal(receipt.meta.TransactionResult,'tesSUCCESS');
      return receipt;
    }
    const balance=async account=>BigInt((await client.request({command:'account_info',account,ledger_index:'validated'})).result.account_data.Balance);
    const state=async()=>{
      const objects=(await client.request({command:'account_namespace',account:owner.classicAddress,namespace_id:'AF'.repeat(32),ledger_index:'validated'})).result;
      assert.equal(objects.marker,undefined);
      const item=objects.namespace_entries.find(o=>o.LedgerEntryType==='HookState'&&o.HookStateKey==='41465744'+'00'.repeat(28));
      if(!item)throw new Error('Forward state missing: '+JSON.stringify(objects));
      const b=Buffer.from(item.HookStateData,'hex');assert.equal(b.length,95);assert.equal(b[0],1);
      return {status:b[1],child:b.subarray(2,34).toString('hex').toUpperCase(),drops:b.readBigUInt64BE(34).toString(),attempts:b[62],hex:item.HookStateData};
    };
    const settle=async()=>{await client.request({command:'ledger_accept'});await client.request({command:'ledger_accept'});return state();};
    for(const wallet of [owner,savings])await submit(root,{TransactionType:'Payment',Destination:wallet.classicAddress,Amount:'1000000000'});
    const account20=(await import('../../../scripts/account-codec.mjs')).decodeAccount(savings.classicAddress).toString('hex').toUpperCase();
    const hookHash=crypto.createHash('sha512').update(wasm).digest().subarray(0,32).toString('hex').toUpperCase();
    const callback=receipt=>{
      assert.equal(receipt.validated,true);assert.equal(receipt.Destination,savings.classicAddress);
      assert.ok(receipt.meta.HookExecutions.some(({HookExecution:e})=>e.HookAccount===owner.classicAddress&&e.HookHash===hookHash&&e.HookReturnCode==='0'&&e.HookStateChangeCount===1&&(e.Flags&2)!==0),'Expected callback/state write missing');
    };
    await submit(owner,{TransactionType:'SetHook',Hooks:[{Hook:{CreateCode:wasm.toString('hex').toUpperCase(),HookOn:'0'.repeat(64),HookNamespace:'AF'.repeat(32),HookApiVersion:0,HookParameters:[{HookParameter:{HookParameterName:Buffer.from('savings').toString('hex').toUpperCase(),HookParameterValue:account20}}]}}]});
    const before=await balance(savings.classicAddress);
    await submit(root,{TransactionType:'Payment',Destination:owner.classicAddress,Amount:'1000000'});
    const pendingSuccess=await state();assert.equal(pendingSuccess.status,1);
    const success=await settle();assert.equal(success.status,2);assert.equal(success.drops,'50000');assert.equal(await balance(savings.classicAddress)-before,50000n);
    const successChild=(await client.request({command:'tx',transaction:success.child,binary:false})).result;
    assert.equal(successChild.meta.TransactionResult,'tesSUCCESS');callback(successChild);assert.equal(successChild.Amount,'50000');
    await submit(savings,{TransactionType:'AccountSet',SetFlag:1}); // RequireDestTag, deliberately fail the child.
    const beforeFailure=await balance(savings.classicAddress);
    await submit(root,{TransactionType:'Payment',Destination:owner.classicAddress,Amount:'2000000'});
    const pendingFailure=await state();assert.equal(pendingFailure.status,1);
    const failed=await settle();assert.equal(failed.status,3);assert.equal(failed.attempts,1);assert.equal(await balance(savings.classicAddress),beforeFailure);
    const failedChild=(await client.request({command:'tx',transaction:failed.child,binary:false})).result;
    assert.equal(failedChild.meta.TransactionResult,'tecDST_TAG_NEEDED');callback(failedChild);assert.equal(failedChild.Amount,'100000');
    await submit(savings,{TransactionType:'AccountSet',ClearFlag:1});
    const beforeRetry=await balance(savings.classicAddress);
    await submit(owner,{TransactionType:'Invoke',HookParameters:[{HookParameter:{HookParameterName:'6F70',HookParameterValue:'7265747279'}}]});
    const pendingRetry=await state();assert.equal(pendingRetry.status,1);
    const recovered=await settle();assert.equal(recovered.status,2);assert.equal(recovered.attempts,2);assert.notEqual(recovered.child,failed.child);assert.equal(await balance(savings.classicAddress)-beforeRetry,100000n);
    const recoveredChild=(await client.request({command:'tx',transaction:recovered.child,binary:false})).result;
    assert.equal(recoveredChild.meta.TransactionResult,'tesSUCCESS');callback(recoveredChild);assert.equal(recoveredChild.Amount,'100000');
    const report={scope:'LOCAL_STANDALONE',result:'PASS',networkId:2133900,buildVersion:info.build_version,artifactSha256:crypto.createHash('sha256').update(wasm).digest('hex'),hookHash,accounts:{owner:owner.classicAddress,savings:savings.classicAddress},pending:{success:pendingSuccess,failure:pendingFailure,retry:pendingRetry},balanceChecks:{successDelta:'50000',failedDelta:'0',retryDelta:'100000',asserted:true},success,failed,recovered,children:[successChild,failedChild,recoveredChild],receipts,nativeExpiry:'NOT_RUN',nativeCallbackWriteFault:'NOT_RUN'};
    fs.writeFileSync(out,JSON.stringify(report,null,2)+'\n','utf8');print({result:'PASS',out,success:success.status,failed:failed.status,recovered:recovered.status});
  }finally{await client.disconnect();}
});
