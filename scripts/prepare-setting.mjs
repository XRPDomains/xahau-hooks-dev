import fs from 'node:fs';
import {args,required,integer,hex,main,print} from './lib.mjs';
import {validateSettingInvoke} from './sethook-lib.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--account','--network-id','--value-hex','--out'],['--help']);
  if(a['--help'])return print({usage:'node prepare-setting.mjs --account rAddress --network-id ID --value-hex HEX16 --out invoke.json',note:'Offline self-Invoke for the owner-setting example only. No fee filling, signing or submission.'});
  const account=required(a['--account'],'--account');
  if(!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account))throw new Error('Invalid account shape');
  const network=integer(Number(required(a['--network-id'],'--network-id')),0,0xFFFFFFFF,'NetworkID');
  const value=hex(required(a['--value-hex'],'--value-hex'),8,'setting value').toString('hex').toUpperCase();
  const tx=validateSettingInvoke({TransactionType:'Invoke',Account:account,NetworkID:network,
    HookParameters:[{HookParameter:{HookParameterName:'73657474696E67',HookParameterValue:value}}]},network,account);
  fs.writeFileSync(required(a['--out'],'--out'),JSON.stringify(tx,null,2)+'\n',{flag:'wx'});print({file:a['--out'],stage:'UNSIGNED_SETTING_INVOKE'});
});
