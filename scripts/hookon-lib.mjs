import {hex, integer} from './lib.mjs';
// A deliberately small, reviewed convenience map; use server_definitions for others.
export const TYPES = Object.freeze({Payment:0, SetHook:22, URITokenMint:45, URITokenBurn:46,
  URITokenBuy:47, URITokenCreateSellOffer:48, URITokenCancelSellOffer:49, Invoke:99});
const ALL=(1n<<256n)-1n, SET_HOOK=1n<<22n;
export function typeIds(names, definitions) {
  const map=definitions?.TRANSACTION_TYPES ?? TYPES;
  if (!map || typeof map!=='object' || Array.isArray(map)) throw new Error('Expected TRANSACTION_TYPES mapping');
  if (names==='none') return [];
  if (typeof names!=='string' || !names.length) throw new Error('Specify transaction types, or none');
  const rows=names.split(',').map(name=>{
    name=name.trim();
    const id=/^\d+$/.test(name)?Number(name):map[name];
    integer(id,0,255,`transaction type ${name}`);
    return {name,id};
  });
  if(new Set(rows.map(r=>r.id)).size!==rows.length)throw new Error('Duplicate transaction type');
  return rows;
}
export function maskFor(rows,{allowSetHook=false}={}) {
  let mask=ALL ^ SET_HOOK; // Disabled everywhere; SetHook is active HIGH.
  for(const {id} of rows) {
    integer(id,0,255,'transaction type');
    if(id===22){if(!allowSetHook)throw new Error('SetHook activation requires --allow-sethook');mask |= SET_HOOK;}
    else mask &= ~(1n<<BigInt(id));
  }
  return mask.toString(16).toUpperCase().padStart(64,'0');
}
export function validateActivation(hook) {
  const legacy=Object.hasOwn(hook,'HookOn');
  const incoming=Object.hasOwn(hook,'HookOnIncoming'),outgoing=Object.hasOwn(hook,'HookOnOutgoing');
  if(legacy && (incoming||outgoing))throw new Error('HookOn is mutually exclusive with directional fields');
  if(incoming!==outgoing)throw new Error('Incoming and outgoing masks must be supplied together');
  if(!legacy && !incoming)throw new Error('Missing activation mask');
  for(const field of legacy?['HookOn']:['HookOnIncoming','HookOnOutgoing'])hex(hook[field],32,field);
  if(incoming && hook.HookOnIncoming.toUpperCase()===hook.HookOnOutgoing.toUpperCase())throw new Error('Equal directional masks must use HookOn instead');
  return hook;
}
