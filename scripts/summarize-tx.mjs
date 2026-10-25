import {args, jsonFile, main, print, required} from './lib.mjs';
import {summarize} from './transaction.mjs';
main(() => {
  const a=args(process.argv.slice(2), ['--file'], ['--help']);
  if(a['--help']) return print({usage:'node summarize-tx.mjs --file tx-response.json', note:'Reports validation and HookExecutions; never infers emitted workflow completion.'});
  print(summarize(jsonFile(required(a['--file'],'--file'))));
});
