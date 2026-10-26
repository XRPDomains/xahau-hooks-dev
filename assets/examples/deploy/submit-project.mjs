import fs from 'node:fs';
import {Client,Wallet,encode} from 'xahau';
import {args,required,jsonFile,main,print,hex} from '../../../scripts/lib.mjs';
import {validateProjectInvoke,assertProjectExecution} from './project-contract.mjs';

// Project Invoke teaching template; review project-contract.mjs before adapting.
main(async()=>{
  const a=args(process.argv.slice(2),['--config','--tx','--expected-hook-account','--expected-hook-hash','--max-fee-drops','--journal'],['--submit','--help']);
  if(a['--help'])return print({usage:'node submit-project.mjs --config network.json --tx unsigned.json --expected-hook-account rAddress --expected-hook-hash HEX64 [--submit --max-fee-drops LIMIT --journal new-journal.json]',
    note:'Without --submit: offline review only. Only the example register Invoke contract is supported; adapt project-contract.mjs for your protocol. Submission is testnet 21338 only, seed from XAHAU_TESTNET_SEED, one submission, no retry. Requires explicit fee cap and new journal.'});
  const config=jsonFile(required(a['--config'],'--config')),tx=jsonFile(required(a['--tx'],'--tx'));
  if(config.networkId!==21338)throw new Error('Reference signer supports testnet NetworkID 21338 only; mainnet and custom networks are refused');
  const expectedAccount=required(a['--expected-hook-account'],'--expected-hook-account');
  validateProjectInvoke(tx,expectedAccount);
  const expectedHookHash=hex(required(a['--expected-hook-hash'],'--expected-hook-hash'),32,'expected HookHash').toString('hex').toUpperCase();
  if(!a['--submit'])return print({stage:'OFFLINE_REVIEW_ONLY',transaction:tx,expectedAccount,expectedHookHash});
  const cap=required(a['--max-fee-drops'],'--max-fee-drops');if(!/^[1-9]\d*$/.test(cap))throw new Error('Fee cap must be a positive integer in drops');
  const journal=required(a['--journal'],'--journal');if(fs.existsSync(journal))throw new Error('Journal exists; inspect it instead of repeating a submission');
  const url=new URL(required(config.websocket,'config.websocket'));
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Explicit WS(S) endpoint without embedded credentials required');
  const seed=process.env.XAHAU_TESTNET_SEED;if(!seed)throw new Error('XAHAU_TESTNET_SEED is required for submission');
  let wallet;try{wallet=Wallet.fromSeed(seed);}catch{throw new Error('Invalid testnet signer seed');}
  if(wallet.classicAddress!==tx.Account)throw new Error('Signer does not match the reviewed transaction account');
  const client=new Client(url.href,{connectionTimeout:6000,timeout:10000});
  const save=record=>fs.writeFileSync(journal,JSON.stringify(record,null,2)+'\n',{flag:'wx'});
  try{
    await client.connect();
    const info=(await client.request({command:'server_info'})).result.info;
    if(info.network_id!==21338)throw new Error('Connected server is not Xahau testnet');
    const existing=(await client.request({command:'account_objects',account:expectedAccount,type:'hook',ledger_index:'validated'})).result;
    if(existing.marker || !Array.isArray(existing.account_objects))throw new Error('Incomplete installed-hook inventory');
    const hookHashes=existing.account_objects.flatMap(o=>o.Hooks??[]).flatMap(h=>h.Hook?.HookHash?[h.Hook.HookHash.toUpperCase()]:[]);
    if(!hookHashes.includes(expectedHookHash))throw new Error('Expected hook is not installed on Destination');
    const prepared=await client.autofill({...tx,Fee:'0'});prepared.SigningPubKey='';
    const quote=(await client.request({command:'fee',tx_blob:encode(prepared)})).result.drops?.base_fee;
    if(typeof quote!=='string'||!/^[1-9]\d*$/.test(quote))throw new Error('Missing valid transaction-specific fee quote');
    if(BigInt(quote)>BigInt(cap))throw new Error('Quoted fee exceeds explicit cap; no transaction submitted');
    prepared.Fee=quote;delete prepared.SigningPubKey;
    const signed=wallet.sign(prepared);
    const record={stage:'SIGNED_BEFORE_SUBMIT',networkId:21338,account:tx.Account,hash:signed.hash,feeDrops:quote,
      lastLedgerSequence:prepared.LastLedgerSequence,expectedAccount,expectedHookHash,transaction:prepared};
    save(record);print({stage:record.stage,hash:signed.hash,feeDrops:quote,journal});
    const submitted=await client.submit(signed.tx_blob); // Exactly one submit call.
    print({stage:'SUBMITTED',hash:signed.hash,engineResult:submitted.result.engine_result});
    if(/^(tem|tel)/.test(submitted.result.engine_result??'')){
      fs.writeFileSync(journal,JSON.stringify({...record,stage:'SUBMIT_REJECTED',submission:submitted.result},null,2)+'\n');
      throw new Error('Submission rejected before validation; inspect the saved engine result and fix the cause before another authorized attempt');
    }
    for(let i=0;i<40;++i){
      await new Promise(resolve=>setTimeout(resolve,1500));
      let receipt;
      try{receipt=await client.request({command:'tx',transaction:signed.hash,binary:false});}
      catch(error){if(error?.data?.error==='txnNotFound')continue;throw new Error('Status lookup failed; inspect journal hash before retrying any payment');}
      if(receipt.result.validated!==true)continue;
      fs.writeFileSync(journal,JSON.stringify({...record,stage:'VALIDATED',receipt:receipt.result},null,2)+'\n');
      if(receipt.result.meta?.TransactionResult!=='tesSUCCESS')throw new Error('Transaction validated with a non-success result; see journal');
      assertProjectExecution(receipt.result,expectedAccount,expectedHookHash);
      const installed=(await client.request({command:'account_objects',account:expectedAccount,type:'hook',ledger_index:'validated'})).result;
      fs.writeFileSync(journal,JSON.stringify({...record,stage:'VALIDATED',receipt:receipt.result,installedHooks:installed.account_objects},null,2)+'\n');
      print({stage:'VALIDATED_REVIEW_READBACK',hash:signed.hash,installedHooks:installed.account_objects});return;
    }
    throw new Error('Validation wait ended with unknown outcome; use journal hash to recover, do not submit again blindly');
  }finally{if(client.isConnected())await client.disconnect();}
});
