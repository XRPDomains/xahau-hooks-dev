import {args,required,jsonFile,print,main} from '../../../scripts/lib.mjs';
import {issuerPlan,assertIssuerReadback} from './issuer-plans.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--plan','--step','--snapshot','--receipt'],['--help']);
  if(a['--help'])return print({usage:'node verify-issuer.mjs --plan plan.json --step STEP --snapshot snapshot.json --receipt tx-result.json',note:'Offline assertion of saved evidence, not independent authentication of JSON or a live RPC query. Requires the raw tx result object, not its enclosing result wrapper.'});
  const input=jsonFile(required(a['--plan'],'--plan'));
  // Rebuild expectations from the fixed teaching contract; do not trust edited readback fields.
  const plan=issuerPlan({kind:input.kind,...input.identity,uri:input.kind==='uritoken'?Buffer.from(input.identity.URI,'hex').toString('utf8'):undefined});
  assertIssuerReadback(plan,required(a['--step'],'--step'),jsonFile(required(a['--snapshot'],'--snapshot')),jsonFile(required(a['--receipt'],'--receipt')));
  print({result:'SAVED_EVIDENCE_MATCHES_EXAMPLE',step:a['--step'],liveVerification:'NOT_RUN'});
});
