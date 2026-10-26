import fs from 'node:fs';
import {encode,isValidClassicAddress,validate} from 'xahau';
import {hex,integer,jsonFile} from '../../../scripts/lib.mjs';
export const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export function testnetConfig(config){
  if(config?.networkId!==21338)throw new Error('Explicit testnet NetworkID 21338 is required');
  const url=new URL(config.websocket);
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('WS(S) endpoint without credentials required');
  return url;
}
export async function assertTestnet(client){
  if((await client.request({command:'server_info'})).result.info?.network_id!==21338)throw new Error('Connected server is not Xahau testnet');
}
export async function waitAccount(client,account,{attempts=30,delayMs=2000,pause=sleep}={}){
  integer(attempts,1,60,'account wait attempts');integer(delayMs,0,5000,'account wait delay');
  if(!isValidClassicAddress(account))throw new Error('Invalid classic account');
  for(let i=0;i<attempts;++i){
    try{
      const r=(await client.request({command:'account_info',account,ledger_index:'validated'})).result;
      if(r.validated!==true||r.account_data?.Account!==account||typeof r.account_data?.Balance!=='string'||!/^\d+$/.test(r.account_data.Balance))throw new Error('Invalid validated account response');
      return r;
    }catch(error){if(error?.data?.error!=='actNotFound')throw error;}
    if(i+1<attempts)await pause(delayMs);
  }
  throw new Error('Account is not yet present in a validated ledger; keep the cached wallet and inspect funding, do not create another wallet');
}
export function validateGenericInvoke(tx,expectedAccount){
  const allowed=new Set(['TransactionType','Account','Destination','NetworkID','HookParameters','Memos','Blob']);
  if(!tx||typeof tx!=='object'||Array.isArray(tx)||Object.keys(tx).some(k=>!allowed.has(k)))throw new Error('Only plain unsigned Invoke business fields are accepted; no Fee, Sequence, signatures or arbitrary transaction types');
  if(tx.TransactionType!=='Invoke'||tx.NetworkID!==21338||!isValidClassicAddress(tx.Account)||!isValidClassicAddress(expectedAccount)||(tx.Destination??tx.Account)!==expectedAccount)throw new Error('Invoke account, network or target mismatch');
  if(tx.Destination===tx.Account)throw new Error('Self-Invoke must omit Destination');
  validate(tx);encode({...tx,Fee:'0',Sequence:1,LastLedgerSequence:100,SigningPubKey:''});
  return tx;
}
export function successfulExecution(receipt,account,hash,returnCode='0'){
  if(receipt.validated!==true||receipt.meta?.TransactionResult!=='tesSUCCESS')throw new Error('Expected validated tesSUCCESS');
  if(!/^[0-9a-fA-F]{1,16}$/.test(returnCode))throw new Error('Expected return code must be uint64 hex');
  if(!(receipt.meta.HookExecutions??[]).some(row=>{const e=row.HookExecution;return e?.HookAccount===account&&e.HookHash?.toUpperCase()===hash.toUpperCase()&&/^[0-9a-fA-F]{1,16}$/.test(e.HookReturnCode??'')&&BigInt('0x'+e.HookReturnCode)===BigInt('0x'+returnCode);}))throw new Error('Expected HookAccount/HookHash/return code execution is missing');
}
export async function submitInvoke({client,wallet,tx,expectedAccount,expectedHash,returnCode='0',feeCap,journal,pause=sleep,attempts=40}){
  validateGenericInvoke(tx,expectedAccount);hex(expectedHash,32,'expected hook hash');
  if(!/^[0-9a-fA-F]{1,16}$/.test(returnCode))throw new Error('Expected return code must be uint64 hex');
  if(!/^[1-9]\d*$/.test(feeCap??''))throw new Error('Explicit positive fee cap in drops required');
  if(typeof journal!=='string'||!journal)throw new Error('New journal path required');
  if(fs.existsSync(journal))throw new Error('Journal exists; recover by its hash instead of replaying');
  integer(attempts,1,60,'validation attempts');
  if(wallet.classicAddress!==tx.Account)throw new Error('Signer/account mismatch');
  await assertTestnet(client);await waitAccount(client,tx.Account,{pause});
  const installed=(await client.request({command:'account_objects',account:expectedAccount,type:'hook',ledger_index:'validated'})).result;
  if(installed.validated===false||installed.marker||!Array.isArray(installed.account_objects)||!installed.account_objects.some(o=>(o.Hooks??[]).some(h=>h.Hook?.HookHash?.toUpperCase()===expectedHash.toUpperCase())))throw new Error('Expected installed hook missing or inventory incomplete');
  const prepared=await client.autofill({...structuredClone(tx),Fee:'0'});prepared.SigningPubKey='';
  for(const [key,value]of Object.entries(tx))if(JSON.stringify(prepared[key])!==JSON.stringify(value))throw new Error('Autofill changed reviewed business fields');
  if(tx.Destination===undefined&&prepared.Destination!==undefined)throw new Error('Autofill added an unexpected Destination');
  if(!Number.isSafeInteger(prepared.LastLedgerSequence)||prepared.LastLedgerSequence<1)throw new Error('Missing bounded ledger expiry');
  const quote=(await client.request({command:'fee',tx_blob:encode(prepared)})).result.drops?.base_fee;
  if(typeof quote!=='string'||!/^[1-9]\d*$/.test(quote)||BigInt(quote)>BigInt(feeCap))throw new Error('Invalid fee quote or explicit cap exceeded');
  prepared.Fee=quote;delete prepared.SigningPubKey;
  const signed=wallet.sign(prepared);
  const record={stage:'SIGNED_BEFORE_SUBMIT',networkId:21338,account:tx.Account,hash:signed.hash,transaction:prepared,expectedAccount,expectedHash,returnCode};
  fs.writeFileSync(journal,JSON.stringify(record,null,2)+'\n',{encoding:'utf8',flag:'wx'});
  const save=(stage,fields)=>fs.writeFileSync(journal,JSON.stringify({...record,stage,...fields},null,2)+'\n','utf8');
  // Exactly one submission. A transport error preserves the signed hash for recovery.
  const submitted=await client.submit(signed.tx_blob);
  if(/^(tem|tel)/.test(submitted.result.engine_result??'')){save('SUBMIT_REJECTED',{submission:submitted.result});throw new Error('Submission rejected; inspect journal before another authorized attempt');}
  for(let i=0;i<attempts;++i){
    let receipt;
    try{receipt=(await client.request({command:'tx',transaction:signed.hash,binary:false})).result;}
    catch(error){if(error?.data?.error!=='txnNotFound')throw new Error('Status lookup failed; recover by journal hash before any replay');}
    if(receipt?.validated===true){save('VALIDATED',{receipt});successfulExecution(receipt,expectedAccount,expectedHash,returnCode);return {hash:signed.hash,receipt,feeDrops:quote};}
    if(i+1<attempts)await pause(1500);
  }
  throw new Error('Unknown submission outcome; recover by journal hash, never resubmit blindly');
}
export function walletRecord(file){
  let record;try{record=jsonFile(file);}catch{throw new Error('Cannot read testnet wallet cache');}
  if(record.networkId!==21338||typeof record.seed!=='string'||!isValidClassicAddress(record.address))throw new Error('Invalid testnet wallet cache');
  return record;
}
