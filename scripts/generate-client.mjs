import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {args,required,jsonFile,main,print} from './lib.mjs';
import {validateInterface,createInterface} from './interface-codec.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--schema','--out'],['--help']);
  if(a['--help'])return print({usage:'node scripts/generate-client.mjs --schema hook-interface.json --out new-client.mjs',note:'Generates a standalone Node.js codec and unsigned Invoke builder only. No RPC, wallet, signing or SDK transport. Schema version 1 is package-specific, not a network ABI.'});
  const schema=validateInterface(jsonFile(required(a['--schema'],'--schema'))),out=required(a['--out'],'--out');
  const accounts=fs.readFileSync(fileURLToPath(new URL('./account-codec.mjs',import.meta.url)),'utf8').replace("import crypto from 'node:crypto';",'');
  const codec=fs.readFileSync(fileURLToPath(new URL('./interface-codec.mjs',import.meta.url)),'utf8').replace("import {decodeAccount,encodeAccount} from './account-codec.mjs';",'');
  const source='// Generated package-specific codec. No network or signer.\n'+codec+'\n'+accounts+'\nexport const client=createInterface('+JSON.stringify(schema)+');\n';
  fs.writeFileSync(out,source,{encoding:'utf8',flag:'wx'});print({file:out,...createInterface(schema).identity,scope:'CODEC_AND_UNSIGNED_INVOKE_ONLY'});
});
