import fs from 'node:fs';
import path from 'node:path';
import {Wallet} from 'xahau';
import {loadWallet} from './wallet.mjs';
import {assertTestnet,waitAccount,sleep,walletRecord} from './testnet-runtime.mjs';
export function cooldownMs(response,body,now=Date.now()){
  const retry=response.headers?.get?.('retry-after');
  let seconds=/^\d+$/.test(retry??'')?Number(retry):retry?Math.ceil((Date.parse(retry)-now)/1000):NaN;
  if(!Number.isFinite(seconds))seconds=Number(/\bwait\s+(\d+)\s*(?:seconds?|secs?|s)\b/i.exec(typeof body==='string'?body:JSON.stringify(body))?.[1]);
  return Number.isFinite(seconds)&&seconds>=0?Math.max(1000,seconds*1000):null;
}
export async function ensureWallet({client,cache,fund=false,faucet,fetcher=fetch,pause=sleep,attempts=30}){
  await assertTestnet(client);
  if(typeof cache!=='string'||!cache)throw new Error('Explicit private testnet wallet cache path required');
  fs.mkdirSync(path.dirname(path.resolve(cache)),{recursive:true});
  const lock=cache+'.lock';let fd;
  try{fd=fs.openSync(lock,'wx',0o600);}catch{throw new Error('Wallet cache is locked; inspect the existing operation before continuing');}
  try{
    let record;
    if(fs.existsSync(cache))record=walletRecord(cache);
    else{
      const wallet=Wallet.generate('ecdsa-secp256k1');
      record={schemaVersion:1,networkId:21338,address:wallet.classicAddress,seed:wallet.seed,algorithm:'ecdsa-secp256k1',funding:'NEW'};
      fs.writeFileSync(cache,JSON.stringify(record,null,2)+'\n',{encoding:'utf8',flag:'wx',mode:0o600});
    }
    const wallet=loadWallet(record.seed,record.address);
    const save=funding=>{record={...record,funding};fs.writeFileSync(cache,JSON.stringify(record,null,2)+'\n',{encoding:'utf8',mode:0o600});};
    try{const account=await waitAccount(client,record.address,{attempts:1,pause});if(record.funding!=='VALIDATED')save('VALIDATED');return {wallet,account,cached:true};}
    catch(error){if(!error.message.startsWith('Account is not yet'))throw error;}
    if(!fund||record.funding==='REQUESTED'){
      const account=await waitAccount(client,record.address,{attempts,pause});save('VALIDATED');return {wallet,account,cached:true};
    }
    const url=new URL(faucet);
    if(url.href!=='https://xahau-test.net/accounts')throw new Error('Funding reference supports explicit https://xahau-test.net/accounts only; custom faucet adapters require review');
    let waited=0,accepted=false;
    for(let i=0;i<3;++i){
      save('REQUESTED'); // Cached before requesting, so network ambiguity cannot lose the key/address.
      let response,body;
      try{
        response=await fetcher(url,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({destination:record.address}),signal:AbortSignal.timeout(15000)});
        const text=await response.text();try{body=JSON.parse(text);}catch{body=text;}
      }catch{throw new Error('Faucet outcome unknown; keep cache and query its address before any further funding request');}
      const delay=cooldownMs(response,body);
      const explicitError=body&&typeof body==='object'&&(body.error||body.status==='error');
      const throttled=response.status===429||((response.status===400||(response.ok&&explicitError))&&delay!==null&&/\bwait\b/i.test(JSON.stringify(body)));
      if(throttled){
        save('NEW'); // Explicit rate rejection permits bounded retry of this same cached address.
        if(i===2||delay===null||delay>90000||waited+delay>180000)throw new Error('Faucet cooldown exceeds bounded retry budget; reuse this cache later');
        for(let remaining=delay;remaining>0;remaining-=Math.min(remaining,1000))await pause(Math.min(remaining,1000));
        waited+=delay;continue;
      }
      if(!response.ok)throw new Error('Faucet request failed; outcome requires account inspection before retrying');
      if(body&&typeof body==='object'&&(body.error||body.status==='error'))throw new Error('Faucet reported an error; inspect the cached address before retrying');
      accepted=true;break;
    }
    if(!accepted)throw new Error('Funding was not acknowledged');
    const account=await waitAccount(client,record.address,{attempts,pause});save('VALIDATED');return {wallet,account,cached:false};
  }finally{fs.closeSync(fd);fs.unlinkSync(lock);}
}
