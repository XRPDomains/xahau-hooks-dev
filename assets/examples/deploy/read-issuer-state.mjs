import fs from 'node:fs';
import {Client,isValidClassicAddress} from 'xahau';
import {args,required,jsonFile,hex,print,main} from '../../../scripts/lib.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--config','--kind','--token-id','--account','--issuer','--out'],['--help']);
  if(a['--help'])return print({usage:'node read-issuer-state.mjs --config network.json --kind uritoken --token-id HEX64 [--out new.json] OR --kind token --account rHolder --issuer rIssuer',note:'Read-only testnet WebSocket example; verifies NetworkID and pins validated reads. No wallet/seed/sign/submit.'});
  const config=jsonFile(required(a['--config'],'--config')),kind=required(a['--kind'],'--kind');
  if(config.networkId!==21338)throw new Error('Issuer examples require explicit testnet NetworkID 21338');
  if(!['uritoken','token'].includes(kind))throw new Error('Unknown kind');
  const tokenId=kind==='uritoken'?hex(required(a['--token-id'],'--token-id'),32,'token ID').toString('hex').toUpperCase():undefined;
  if(kind==='token'&&(!isValidClassicAddress(a['--account'])||!isValidClassicAddress(a['--issuer'])))throw new Error('Valid account and issuer required');
  if(a['--out']&&fs.existsSync(a['--out']))throw new Error('Output exists; choose a new snapshot path');
  const url=new URL(required(config.websocket,'config.websocket'));
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Explicit WS(S) URL without credentials required');
  const client=new Client(url.href,{connectionTimeout:6000,timeout:10000});
  try{
    await client.connect();
    if((await client.request({command:'server_info'})).result.info?.network_id!==21338)throw new Error('Connected server is not testnet');
    const ledger=(await client.request({command:'ledger',ledger_index:'validated',transactions:false,expand:false})).result;
    const ledgerHash=hex(ledger.ledger_hash??ledger.ledger?.ledger_hash,32,'ledger hash').toString('hex').toUpperCase();
    const ledgerIndex=Number(ledger.ledger_index??ledger.ledger?.ledger_index);
    if(ledger.validated!==true||!Number.isSafeInteger(ledgerIndex)||ledgerIndex<1)throw new Error('Missing validated ledger identity');
    function check(result){
      if(result.validated===false||(result.ledger_hash&&result.ledger_hash.toUpperCase()!==ledgerHash)||(result.ledger_index!==undefined&&Number(result.ledger_index)!==ledgerIndex))throw new Error('Readback ledger mismatch');
    }
    let result={kind,networkId:21338,validated:true,ledgerHash,ledgerIndex};
    if(kind==='uritoken'){
      let node;
      try{const r=(await client.request({command:'ledger_entry',index:tokenId,ledger_hash:ledgerHash,binary:false})).result;check(r);if(!r.node)throw new Error('Missing node');node={...r.node,index:r.node.index??r.index??tokenId};if(node.index.toUpperCase()!==tokenId)throw new Error('Token index mismatch');}
      catch(error){if(error?.data?.error!=='entryNotFound')throw error;node=null;}
      result={...result,tokenId,node};
    }else{
      const markers=new Set();let marker,line,complete=false;
      for(let page=0;page<100;++page){
        const r=(await client.request({command:'account_lines',account:a['--account'],peer:a['--issuer'],ledger_hash:ledgerHash,limit:200,...(marker===undefined?{}:{marker})})).result;check(r);
        if(!Array.isArray(r.lines))throw new Error('Missing lines');
        for(const item of r.lines)if(item.account===a['--issuer']&&item.currency==='TST'){if(line)throw new Error('Duplicate TST trust line');line=item;}
        if(r.marker===undefined||r.marker===null){complete=true;break;}
        marker=r.marker;const key=JSON.stringify(marker);if(markers.has(key))throw new Error('Repeated marker');markers.add(key);
      }
      if(!complete)throw new Error('Readback page limit');
      result={...result,account:a['--account'],issuer:a['--issuer'],currency:'TST',line:line??null};
    }
    if(a['--out']){fs.writeFileSync(a['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx'});print({file:a['--out'],ledgerHash,ledgerIndex});}else print(result);
  }finally{if(client.isConnected())await client.disconnect();}
});
