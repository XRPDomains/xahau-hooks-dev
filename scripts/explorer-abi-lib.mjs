import {validateInterface} from './interface-codec.mjs';
import {decodeAccount} from './account-codec.mjs';

// Original adapter to the optional XRPLWin projection format; not a network ABI.
export function explorerProjections(input){
  const schema=validateInterface(structuredClone(input));
  const literal=(label,hex)=>({type:'Blob',label,byteLength:hex.length/2,pattern:hex.toUpperCase(),patternEncoding:'hex',exclude:true});
  const projections=Object.entries(schema.state).map(([name,layout])=>{
    const k=layout.key;let selector;
    if(k.kind==='fixed')selector=[literal('key.literal',k.hex)];
    else if(k.kind==='prefix-text'){
      selector=k.prefixHex.length?[literal('key.prefix',k.prefixHex)]:[];
      selector.push({type:'VarString',label:'key.'+k.field,byteLength:k.maxBytes});
      const padding=32-k.prefixHex.length/2-k.maxBytes;
      if(padding)selector.push({type:'Null',label:'key.padding',byteLength:padding,exclude:true});
    }else throw new Error(`Cannot export ${name}: hashed keys need a reviewed manual projection; preimages cannot be recovered`);
    const data=layout.fields.map(f=>{
      if(f.type==='string')throw new Error(`Cannot export ${name}.${f.name}: uint16 length-prefixed strings need a reviewed manual ABI`);
      const type={uint8:'UInt8',uint32be:'UInt32',uint64be:'UInt64',account20:'AccountID',bytes:'Blob'}[f.type];
      const s={type,label:f.name};
      if(f.type==='uint32be'||f.type==='uint64be')s.endianness='BE';
      if(f.type==='bytes')s.byteLength=f.bytes;
      if(f.const!==undefined){
        if(f.type==='bytes'||f.type==='account20'){
          s.pattern=f.type==='bytes'?f.const:(/^[a-fA-F0-9]{40}$/.test(f.const)?f.const:decodeAccount(f.const).toString('hex'));
          s.pattern=s.pattern.toUpperCase();s.patternEncoding='hex';
        }else{s.pattern=String(f.const);s.patternEncoding='ascii';}
        s.exclude=true;
      }
      return s;
    });
    return {name,description:'State layout '+name+'; review against the exact Hook C build.',selector,data};
  });
  if(!projections.length)throw new Error('Schema has no state layouts to export');
  return {projections,warnings:['Only schema-declared records are exported; inventory every C state writer and foreign namespace separately.',
    'prefix-text key columns retain NUL padding in the explorer/CSV; they are fixed-width byte slices, not length-prefixed strings.',
    'Numeric endianness is explicit; UInt64 is a plain integer, not a serialized NativeAmount.']};
}
