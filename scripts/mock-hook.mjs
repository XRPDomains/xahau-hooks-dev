import fs from 'node:fs';
import {args,required,jsonFile,main,print} from './lib.mjs';
import {createMockRuntime} from '../assets/toolchain/mock-runtime.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--wasm','--cases','--out','--timeout-ms'],['--help']);
  if(a['--help'])return print({usage:'node scripts/mock-hook.mjs --wasm hook.cleaned.wasm --cases fixtures.json [--timeout-ms 1000] [--out mock.json]',note:'Offline strong-invocation host mocks, not a ledger emulator. Unknown imports fail. Temporary memory export is never deployment code.'});
  const input=jsonFile(required(a['--cases'],'--cases'));
  if(!Array.isArray(input.cases)||input.cases.length<1||input.cases.length>1000)throw new Error('Expected 1..1000 cases');
  const start=performance.now(),runner=await createMockRuntime(fs.readFileSync(required(a['--wasm'],'--wasm')),{timeoutMs:Number(a['--timeout-ms']??1000),initialState:input.initialState??{}});
  const instantiated=performance.now(),results=[];
  try{for(const item of input.cases){const result=await runner.run(item.fixture??{});let pass=true;for(const [key,value]of Object.entries(item.expect??{}))if(JSON.stringify(result[key])!==JSON.stringify(value))pass=false;results.push({name:item.name,result,assertions:pass?'PASS':'FAIL'});}}
  finally{await runner.close();}
  print({scope:'MOCK_ONLY',identity:runner.identity,initMs:instantiated-start,runMs:performance.now()-instantiated,cases:results,result:results.every(r=>r.assertions==='PASS'&&r.result.outcome!=='trap')?'PASS':'FAIL'},a['--out']);
  if(results.some(r=>r.assertions==='FAIL'||r.result.outcome==='trap'))process.exitCode=1;
});
