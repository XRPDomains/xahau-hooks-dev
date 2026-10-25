import fs from 'node:fs';
import {Client} from 'xahau';
import {args,required,jsonFile,main,print} from '../../../scripts/lib.mjs';
import {snapshot} from '../../../scripts/rpc.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--config','--account','--namespace','--out'],['--help']);
  if(a['--help'])return print({usage:'node read-state-websocket.mjs --config network.json --account rAddress --namespace HEX64 [--out snapshot.json]',note:'Read-only optional WebSocket reference. Shares network verification and pinned pagination with the HTTP reader. No seed required. Mainnet reads are allowed when network identity matches.'});
  const config=jsonFile(required(a['--config'],'--config'));
  const url=new URL(required(config.websocket,'config.websocket'));
  if(!['ws:','wss:'].includes(url.protocol)||url.username||url.password)throw new Error('Explicit WS(S) endpoint without embedded credentials required');
  const client=new Client(url.href,{connectionTimeout:6000,timeout:config.timeoutMs??15000});
  try{
    await client.connect();
    const result=await snapshot(config,required(a['--account'],'--account'),required(a['--namespace'],'--namespace'),
      (method,params)=>client.request({command:method,...params}));
    if(a['--out']){fs.writeFileSync(a['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx'});print({file:a['--out'],entries:result.entries.length,ledgerHash:result.ledgerHash});}
    else print(result);
  }finally{if(client.isConnected())await client.disconnect();}
});
