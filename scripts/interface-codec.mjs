import crypto from 'node:crypto';
import {decodeAccount,encodeAccount} from './account-codec.mjs';
const validName=name=>typeof name==='string'&&/^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(name)&&!['constructor','prototype'].includes(name);
const fromHex=(value,n)=>{if(typeof value!=='string'||!/^(?:[a-fA-F0-9]{2})*$/.test(value)||(n!==undefined&&value.length!==n*2))throw new Error('Invalid interface hex');return Buffer.from(value,'hex');};
const types=new Set(['uint8','uint32be','uint64be','string','bytes','account20']);
function fields(list,parameters=false){
  if(!Array.isArray(list)||list.length>32||new Set(list.map(f=>f.name)).size!==list.length)throw new Error('Invalid/duplicate field list');
  for(const f of list){
    if(!f||typeof f!=='object'||Array.isArray(f))throw new Error('Field must be an object');
    if(!validName(f.name)||!types.has(f.type)||Object.keys(f).some(k=>!['name','type','maxBytes','minBytes','noNul','bytes','const'].includes(k)))throw new Error('Invalid field name/type/options');
    if(f.type==='string'&&(!Number.isInteger(f.maxBytes)||f.maxBytes<1||f.maxBytes>256))throw new Error('String requires maxBytes 1..256');
    if(f.minBytes!==undefined&&(f.type!=='string'||!Number.isInteger(f.minBytes)||f.minBytes<0||f.minBytes>f.maxBytes))throw new Error('Invalid string minimum');
    if(f.noNul!==undefined&&(f.type!=='string'||typeof f.noNul!=='boolean'))throw new Error('Invalid noNul option');
    if(f.type==='bytes'&&(!Number.isInteger(f.bytes)||f.bytes<1||f.bytes>256))throw new Error('Bytes requires fixed byte length');
    if(parameters&&Buffer.byteLength(f.name)>32)throw new Error('Parameter name exceeds 32 bytes');
    if(f.const!==undefined)encodeField(f,f.const,!parameters);
  }
}
function encodeField(f,value,delimit){
  if(f.const!==undefined){if(value!==undefined&&String(value)!==String(f.const))throw new Error('Constant field mismatch: '+f.name);value=f.const;}
  if(f.type==='string'){
    if(typeof value!=='string')throw new Error('Expected UTF-8 string: '+f.name);
    const b=Buffer.from(value);if(new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(b)!==value||b.length>f.maxBytes||b.length<(f.minBytes??0)||f.noNul&&value.includes('\0'))throw new Error('Invalid/oversized UTF-8 field: '+f.name);
    if(!delimit)return b;const prefix=Buffer.alloc(2);prefix.writeUInt16BE(b.length);return Buffer.concat([prefix,b]);
  }
  if(f.type==='bytes')return fromHex(value,f.bytes);
  if(f.type==='account20')return typeof value==='string'&&/^[a-fA-F0-9]{40}$/.test(value)?fromHex(value,20):decodeAccount(value);
  const size={uint8:1,uint32be:4,uint64be:8}[f.type];
  if(f.type==='uint64be'&&typeof value!=='string'&&typeof value!=='bigint')throw new Error('uint64be requires a decimal string or BigInt');
  if(! /^(?:0|[1-9]\d*)$/.test(String(value))||typeof value==='number'&&!Number.isSafeInteger(value))throw new Error('Invalid unsigned integer');
  let n=BigInt(value);if(n>=(1n<<BigInt(size*8)))throw new Error('Unsigned integer overflow');
  const out=Buffer.alloc(size);for(let i=size-1;i>=0;--i){out[i]=Number(n&255n);n>>=8n;}return out;
}
function encodeFields(list,values){
  if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!list.some(f=>f.name===k)))throw new Error('Unknown/malformed field input');
  return Buffer.concat(list.map(f=>encodeField(f,values[f.name],true)));
}
function decodeFields(list,hex){
  const b=fromHex(hex);let offset=0;const out={};
  const take=n=>{if(offset+n>b.length)throw new Error('Truncated state');const data=b.subarray(offset,offset+n);offset+=n;return data;};
  for(const f of list){let value;
    if(f.type==='string'){const n=take(2).readUInt16BE();if(n>f.maxBytes||n<(f.minBytes??0))throw new Error('Invalid state string length');value=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(take(n));if(f.noNul&&value.includes('\0'))throw new Error('NUL in state string');}
    else if(f.type==='bytes')value=take(f.bytes).toString('hex').toUpperCase();
    else if(f.type==='account20')value=encodeAccount(take(20));
    else{const data=take({uint8:1,uint32be:4,uint64be:8}[f.type]);let n=0n;for(const byte of data)n=n*256n+BigInt(byte);value=f.type==='uint64be'?String(n):Number(n);}
    if(f.const!==undefined&&String(value)!==String(f.const))throw new Error('Unknown schema version or constant mismatch');out[f.name]=value;
  }
  if(offset!==b.length)throw new Error('Trailing state bytes');return out;
}
export function validateInterface(schema){
  if(!schema||schema.schemaVersion!==1||!(typeof schema.name==='string'&&/^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(schema.name))||typeof schema.version!=='string'||!schema.operations||typeof schema.operations!=='object'||Array.isArray(schema.operations)||!schema.state||typeof schema.state!=='object'||Array.isArray(schema.state)||Object.keys(schema).some(k=>!['schemaVersion','name','version','artifactSha256','operations','state'].includes(k)))throw new Error('Invalid hook interface header');
  if(schema.artifactSha256!==undefined)fromHex(schema.artifactSha256,32);
  if(Object.keys(schema.operations).length>32||Object.keys(schema.state).length>32)throw new Error('Too many interface entries');
  for(const [name,op]of Object.entries(schema.operations)){
    if(!op||typeof op!=='object'||Array.isArray(op))throw new Error('Operation must be an object');
    if(!validName(name)||!['self','destination'].includes(op.route)||Object.keys(op).some(k=>!['route','params','discriminator'].includes(k)))throw new Error('Invalid operation');fields(op.params,true);
    if(op.params.length+(op.discriminator?1:0)>16)throw new Error('This schema subset supports at most 16 parameters');
    if(op.discriminator){const d=op.discriminator;if(!validName(d.name)||op.params.some(f=>f.name===d.name)||Object.keys(d).some(k=>!['name','valueHex'].includes(k)))throw new Error('Invalid discriminator');if(fromHex(d.valueHex).length>256)throw new Error('Discriminator exceeds 256 bytes');}
  }
  for(const [name,layout]of Object.entries(schema.state)){
    if(!layout||typeof layout!=='object'||Array.isArray(layout))throw new Error('Layout must be an object');
    if(!validName(name)||!layout.key||Object.keys(layout).some(k=>!['key','fields'].includes(k)))throw new Error('Invalid state layout');fields(layout.fields);
    const k=layout.key;
    if(k.kind==='fixed'){fromHex(k.hex,32);if(Object.keys(k).some(p=>!['kind','hex'].includes(p)))throw new Error('Unknown key option');}
    else if(k.kind==='prefix-text'){
      const prefix=fromHex(k.prefixHex);if(!validName(k.field)||!Number.isInteger(k.maxBytes)||k.maxBytes<1||prefix.length+k.maxBytes>32||Object.keys(k).some(p=>!['kind','prefixHex','field','maxBytes'].includes(p)))throw new Error('Invalid prefix-text key');
    }else if(k.kind==='sha512half'){fromHex(k.prefixHex);fields(k.fields);if(Object.keys(k).some(p=>!['kind','prefixHex','fields'].includes(p)))throw new Error('Unknown hash key option');}
    else throw new Error('Unknown state key formula');
  }
  return schema;
}
export function createInterface(input){
  const schema=validateInterface(structuredClone(input)),schemaSha256=crypto.createHash('sha256').update(JSON.stringify(schema)).digest('hex');
  const own=(group,name)=>{if(!Object.hasOwn(group,name))throw new Error('Unknown interface entry');return group[name];};
  return {
    identity:{name:schema.name,version:schema.version,schemaSha256,artifactSha256:schema.artifactSha256??null},
    assertArtifact(hash){if(!schema.artifactSha256)throw new Error('Artifact binding is not configured');if(hash.toLowerCase()!==schema.artifactSha256.toLowerCase())throw new Error('Artifact/schema mismatch');return true;},
    encodeParameters(operation,values){const op=own(schema.operations,operation);if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).some(k=>!op.params.some(f=>f.name===k)))throw new Error('Unknown operation argument');
      const pairs=op.params.map(f=>[f.name,encodeField(f,values[f.name],false)]);if(op.discriminator)pairs.unshift([op.discriminator.name,fromHex(op.discriminator.valueHex)]);
      return pairs.map(([name,value])=>({HookParameter:{HookParameterName:Buffer.from(name).toString('hex').toUpperCase(),HookParameterValue:value.toString('hex').toUpperCase()}}));},
    buildInvoke(operation,values,{account,destination,networkId}){const op=own(schema.operations,operation);decodeAccount(account);if(!Number.isSafeInteger(networkId)||networkId<0||networkId>0xFFFFFFFF)throw new Error('Explicit NetworkID required');
      if(op.route==='self'&&destination!==undefined)throw new Error('Self-Invoke omits Destination');if(op.route==='destination'){decodeAccount(destination);if(destination===account)throw new Error('Destination must differ from Account');}
      return {TransactionType:'Invoke',Account:account,NetworkID:networkId,...(op.route==='destination'?{Destination:destination}:{}),HookParameters:this.encodeParameters(operation,values)};},
    encodeState(name,values){const data=encodeFields(own(schema.state,name).fields,values);if(data.length>256)throw new Error('State exceeds example limit 256');return data.toString('hex').toUpperCase();},
    decodeState(name,value){if(fromHex(value).length>256)throw new Error('State exceeds example limit 256');return decodeFields(own(schema.state,name).fields,value);},
    stateKey(name,values={}){const k=own(schema.state,name).key;if(k.kind==='fixed')return k.hex.toUpperCase();const prefix=fromHex(k.prefixHex);
      if(k.kind==='sha512half')return crypto.createHash('sha512').update(Buffer.concat([prefix,encodeFields(k.fields,values)])).digest().subarray(0,32).toString('hex').toUpperCase();
      const text=values[k.field];if(typeof text!=='string'||text.includes('\0'))throw new Error('Key text must be a string without NUL');const label=Buffer.from(text);if(!label.length||label.length>k.maxBytes||new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(label)!==text)throw new Error('Invalid/oversized key text');const key=Buffer.alloc(32);prefix.copy(key);label.copy(key,prefix.length);return key.toString('hex').toUpperCase();}
  };
}
