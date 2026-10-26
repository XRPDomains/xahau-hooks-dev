import {parentPort,workerData} from 'node:worker_threads';
import crypto from 'node:crypto';
import {exposeProbeMemory} from './wasm-probe.mjs';
import {decodeAccount,encodeAccount} from '../../scripts/account-codec.mjs';
const bytes=(value,length)=>{if(typeof value!=='string'||!/^(?:[a-fA-F0-9]{2})*$/.test(value)||(length!==undefined&&value.length!==length*2))throw new Error('Invalid fixture hex');return Buffer.from(value,'hex');};
let state=new Map(Object.entries(workerData.initialState).map(([k,v])=>[bytes(k,32).toString('hex'),bytes(v).toString('hex')]));
if([...state.values()].some(v=>v.length>512))throw new Error('Initial mock state exceeds 256 bytes');
const probe=exposeProbeMemory(workerData.wasm,workerData.maxMemoryPages),module=new WebAssembly.Module(probe.bytes);
const supported=new Set(['_g','accept','rollback','hook_account','otxn_type','otxn_generation','otxn_field','otxn_param','hook_param','otxn_id','state','state_set','util_accid','util_raddr','util_sha512h','etxn_reserve','prepare','emit','meta_slot','otxn_slot','slot_subfield','slot','ledger_seq','trace','trace_num']);
for(const name of probe.imports)if(!supported.has(name))throw new Error('Unsupported mock import: '+name);
parentPort.postMessage({scope:'MOCK_ONLY',originalSha256:probe.originalSha256,probeSha256:probe.probeSha256,memoryInstrumented:true,unsupportedAPIsFail:true});
parentPort.on('message',async({fixture:f})=>{
  try{
    if(f.phase&&f.phase!=='strong')throw new Error('Only a strong-invocation state overlay is modeled; weak/consensus semantics are unsupported');
    const overlay=new Map(state),guards=new Map(),calls={},traces=[],emitted=[],slots=new Map();let instance,reserved=0,prepares=0;
    const fieldObject=Object.fromEntries(Object.entries(f.fields??{}).map(([k,v])=>[k,bytes(v)]));
    const terminal=(outcome,p,n,code)=>{throw {terminal:true,outcome,code:BigInt.asUintN(64,code).toString(16).padStart(16,'0'),message:read(p,n).toString('utf8')};};
    function read(p,n){p>>>=0;n>>>=0;const memory=instance.exports.__probe_memory.buffer;if(p>memory.byteLength||n>memory.byteLength-p)throw new Error('Mock memory bounds violation');return Buffer.from(new Uint8Array(memory,p,n));}
    function write(p,cap,value){if(value===undefined)return -5n;const data=Buffer.from(value);read(p,cap);if(data.length>cap)return -4n;new Uint8Array(instance.exports.__probe_memory.buffer,p,data.length).set(data);return BigInt(data.length);}
    const param=(which,p,cap,k,n)=>write(p,cap,(f[which]??[]).find(item=>bytes(item.name).equals(read(k,n)))?.value===undefined?undefined:bytes((f[which]??[]).find(item=>bytes(item.name).equals(read(k,n))).value));
    const key=(p,n)=>{if(n<1||n>32)throw new Error('Mock state key must be 1..32 bytes');return read(p,n).toString('hex').padStart(64,'0');};
    const env={
      _g:(id,budget)=>{id>>>=0;budget>>>=0;const g=guards.get(id)??{id,budget,visits:0};if(g.budget!==budget||budget<1)throw new Error('Inconsistent guard budget');++g.visits;guards.set(id,g);if(g.visits>budget)throw {terminal:true,outcome:'rollback',code:'fffffffffffffff0',message:'GUARD_VIOLATION'};return 0;},
      accept:(p,n,c)=>terminal('accept',p,n,c),rollback:(p,n,c)=>terminal('rollback',p,n,c),
      hook_account:(p,n)=>write(p,n,f.hookAccount===undefined?undefined:bytes(f.hookAccount,20)),
      otxn_generation:()=>BigInt(f.generation??0),otxn_type:()=>BigInt(f.type??99),otxn_field:(p,n,field)=>write(p,n,fieldObject[field>>>0]),
      otxn_param:(...a)=>param('parameters',...a),hook_param:(...a)=>param('hookParameters',...a),
      otxn_id:(p,n,flags)=>{if(flags!==0)throw new Error('Mock supports otxn_id flags 0 only');return write(p,n,f.txId===undefined?undefined:bytes(f.txId,32));},
      state:(p,n,k,l)=>write(p,n,overlay.has(key(k,l))?bytes(overlay.get(key(k,l))):undefined),
      state_set:(p,n,k,l)=>{if(n>256)return -7n;const id=key(k,l);if(n===0){overlay.delete(id);return 0n;}overlay.set(id,read(p,n).toString('hex'));return BigInt(n);},
      util_accid:(p,n,s,l)=>{let decoded;try{decoded=decodeAccount(read(s,l).toString('ascii'));}catch{return -7n;}return write(p,n,decoded);},
      util_raddr:(p,n,s,l)=>{if(l!==20)return -7n;return write(p,n,Buffer.from(encodeAccount(read(s,l))));},
      util_sha512h:(p,n,s,l)=>write(p,n,crypto.createHash('sha512').update(read(s,l)).digest().subarray(0,32)),
      etxn_reserve:count=>{if(count<1||count>255)return -7n;reserved=count;return BigInt(count);},
      prepare:(p,n,s,l)=>{if(!reserved)return -9n;if(f.preparedHex===undefined)throw new Error('prepare requires explicit preparedHex fixture; mock does not implement native fee/preparation rules');read(s,l);++prepares;return write(p,n,bytes(f.preparedHex));},
      emit:(p,n,s,l)=>{if(!reserved||emitted.length>=reserved)return -9n;if(f.emittedId===undefined)throw new Error('emit requires explicit emittedId fixture');const blob=read(s,l),id=bytes(f.emittedId,32);const r=write(p,n,id);if(r===32n)emitted.push({id:id.toString('hex'),blob:blob.toString('hex')});return r;},
      meta_slot:slot=>{if(!f.metadata)return -9n;slots.set(slot,Object.fromEntries(Object.entries(f.metadata).map(([k,v])=>[k,bytes(v)])));return BigInt(slot);},
      otxn_slot:slot=>{slots.set(slot,fieldObject);return BigInt(slot);},
      slot_subfield:(from,field,to)=>{const value=slots.get(from)?.[field>>>0];if(value===undefined)return -5n;slots.set(to,value);return BigInt(to);},
      slot:(p,n,s)=>{const value=slots.get(s);if(!Buffer.isBuffer(value))return -7n;return write(p,n,value);},
      ledger_seq:()=>BigInt(f.ledgerIndex??1),
      trace:(p,n,s,l,asHex)=>{traces.push({label:read(p,n).toString('utf8'),value:read(s,l).toString(asHex?'hex':'utf8')});return 0n;},
      trace_num:(p,n,value)=>{traces.push({label:read(p,n).toString('utf8'),value:value.toString()});return 0n;}
    };
    for(const [name,fn]of Object.entries(env))env[name]=(...args)=>{calls[name]=(calls[name]??0)+1;const fault=f.faults?.[name];if(fault&&calls[name]===(fault.at??1)){if(['_g','accept','rollback'].includes(name))throw new Error('Terminal/guard fault injection unsupported');return BigInt(fault.code);}return fn(...args);};
    instance=await WebAssembly.instantiate(module,{env});
    let result;
    try{
      const entry=f.entry??'hook';if(!['hook','cbak'].includes(entry)||typeof instance.exports[entry]!=='function')throw new Error('Missing/invalid mock entry');
      instance.exports[entry](f.argument??0);throw new Error('Hook returned without terminal accept/rollback');
    }catch(error){
      if(error.terminal)result=error;
      else result={outcome:'trap',message:error.message,code:null};
    }
    if(result.outcome==='accept')state=overlay;
    parentPort.postMessage({scope:'MOCK_ONLY',...result,committed:result.outcome==='accept',state:Object.fromEntries(state),emitted:result.outcome==='accept'?emitted:[],discardedEmissions:result.outcome==='accept'?0:emitted.length,guards:[...guards.values()],calls,traces,prepares});
  }catch(error){parentPort.postMessage({error:error.message});}
});
