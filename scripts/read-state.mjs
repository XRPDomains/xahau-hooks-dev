import fs from 'node:fs';
import {args, jsonFile, main, print, required} from './lib.mjs';
import {snapshot} from './rpc.mjs';
main(async () => {
  const a = args(process.argv.slice(2), ['--config','--account','--namespace','--out'], ['--help']);
  if (a['--help']) return print({usage:'node read-state.mjs --config network.json --account rAddress --namespace HEX64 [--out snapshot.json]',
    note:'Read-only HTTP(S) JSON-RPC; checks network_id, pins a validated ledger, paginates namespace. Output file must not already exist.'});
  const result = await snapshot(jsonFile(required(a['--config'],'--config')), required(a['--account'],'--account'),required(a['--namespace'],'--namespace'));
  if(a['--out']) { fs.writeFileSync(a['--out'],JSON.stringify(result,null,2)+'\n',{flag:'wx'}); print({file:a['--out'],entries:result.entries.length,ledgerHash:result.ledgerHash,requests:result.requests}); }
  else print(result);
});
