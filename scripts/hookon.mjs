import {args,jsonFile,main,print} from './lib.mjs';
import {typeIds,maskFor,validateActivation} from './hookon-lib.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--types','--incoming','--outgoing','--definitions'],['--allow-sethook','--help']);
  if(a['--help'])return print({usage:'node hookon.mjs --types Payment,Invoke [--definitions server-definitions.json] [--allow-sethook]\nOR --incoming Payment --outgoing Invoke',
    note:'Use none to disable one direction. Directional output targets HookOnV2_1; confirm amendment support. Bit 22 is active-high.'});
  const definitions=a['--definitions']?jsonFile(a['--definitions']):undefined;
  const def=definitions?.result ?? definitions;
  const rows=[],options={allowSetHook:!!a['--allow-sethook']};let hook;
  if(a['--types']!==undefined){
    if(a['--incoming']!==undefined || a['--outgoing']!==undefined)throw new Error('Choose --types OR directional options');
    const selected=typeIds(a['--types'],def);rows.push(...selected.map(r=>({...r,direction:'both'})));hook={HookOn:maskFor(selected,options)};
  }else{
    const incoming=typeIds(a['--incoming'],def),outgoing=typeIds(a['--outgoing'],def);
    rows.push(...incoming.map(r=>({...r,direction:'incoming'})),...outgoing.map(r=>({...r,direction:'outgoing'})));
    hook={HookOnIncoming:maskFor(incoming,options),HookOnOutgoing:maskFor(outgoing,options)};
  }
  validateActivation(hook);
  print({hook,selected:rows,semantics:'0 enables ordinary transaction types; SetHook bit 22 is enabled by 1.',
    definitions:a['--definitions']?'caller-supplied server_definitions':'small reviewed convenience map; not the complete transaction catalog'});
});
