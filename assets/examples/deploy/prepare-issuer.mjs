import fs from 'node:fs';
import {args,required,print,main} from '../../../scripts/lib.mjs';
import {issuerPlan} from './issuer-plans.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--kind','--issuer','--holder','--recipient','--uri','--out'],['--help']);
  if(a['--help'])return print({usage:'node prepare-issuer.mjs --kind uritoken|token --issuer rIssuer --holder rHolder [--recipient rRecipient] [--uri ipfs://value] [--out new-plan.json]',note:'Offline unsigned teaching plan. Does not install Hooks, sign, submit or use RPC. Token requires a distinct recipient.'});
  const plan=issuerPlan({kind:required(a['--kind'],'--kind'),issuer:required(a['--issuer'],'--issuer'),holder:required(a['--holder'],'--holder'),recipient:a['--recipient'],uri:a['--uri']});
  if(a['--out']){fs.writeFileSync(a['--out'],JSON.stringify(plan,null,2)+'\n',{flag:'wx'});print({file:a['--out'],stage:plan.stage});}else print(plan);
});
