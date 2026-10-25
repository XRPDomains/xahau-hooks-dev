import fs from 'node:fs';
import {args,required,jsonFile,main,print} from './lib.mjs';
import {firstInstall} from './sethook-lib.mjs';
import {maskFor,typeIds} from './hookon-lib.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--wasm','--evidence','--account','--namespace','--types','--network-id','--out'],['--help']);
  if(a['--help'])return print({usage:'node prepare-sethook.mjs --wasm final.wasm --evidence inspection.json --account rAddress --namespace HEX64 --types Invoke --network-id ID --out unsigned.json',
    note:'Offline unsigned first-install template only; requires evidence for the same bytes. No flags, signing or network calls. The optional signer example permits testnet only.'});
  const tx=firstInstall({wasm:fs.readFileSync(required(a['--wasm'],'--wasm')),evidence:jsonFile(required(a['--evidence'],'--evidence')),
    account:required(a['--account'],'--account'),namespace:required(a['--namespace'],'--namespace'),
    hookOn:maskFor(typeIds(required(a['--types'],'--types'))),networkId:Number(required(a['--network-id'],'--network-id'))});
  fs.writeFileSync(required(a['--out'],'--out'),JSON.stringify(tx,null,2)+'\n',{flag:'wx'});
  print({file:a['--out'],stage:'UNSIGNED_FIRST_INSTALL',networkId:tx.NetworkID,account:tx.Account});
});
