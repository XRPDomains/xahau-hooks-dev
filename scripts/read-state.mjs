import fs from 'node:fs';
import {args, jsonFile, main, print, required} from './lib.mjs';
import {snapshot} from './rpc.mjs';
main(async () => {
  const a = args(process.argv.slice(2), ['--config','--endpoint','--network-id','--account','--namespace','--out'], ['--help']);
  if (a['--help']) return print({usage:'node read-state.mjs (--config network.json | --endpoint https://RPC --network-id ID) --account rAddress --namespace HEX64 [--out snapshot.json]',
    note:'Read-only HTTP(S) JSON-RPC; checks network_id, pins a validated ledger, paginates namespace. Output file must not already exist.'});
  if(a['--config'] && (a['--endpoint'] || a['--network-id']))throw new Error('Choose --config FILE or --endpoint URL --network-id ID, not both');
  if(a['--config'] && /^[a-z][a-z0-9+.-]*:\/\//i.test(a['--config']))throw new Error('--config expects a JSON file with endpoint and networkId; use --endpoint URL --network-id ID for a URL');
  const config=a['--config']?jsonFile(a['--config']):{endpoint:required(a['--endpoint'],'--endpoint or --config'),networkId:Number(required(a['--network-id'],'--network-id'))};
  const result = await snapshot(config, required(a['--account'],'--account'),required(a['--namespace'],'--namespace'));
  if(a['--out']) { fs.writeFileSync(a['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx'}); print({file:a['--out'],entries:result.entries.length,ledgerHash:result.ledgerHash,requests:result.requests}); }
  else print(result);
});
