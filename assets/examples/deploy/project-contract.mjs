import {hex} from '../../../scripts/lib.mjs';
// Adapt this contract to your reviewed Hook protocol before using the template.
// Example only: Invoke Destination with op=register, name=ASCII label, value=UTF-8 URL.
export function validateProjectInvoke(tx, expectedAccount){
  const allowed=new Set(['TransactionType','Account','Destination','NetworkID','HookParameters']);
  if(!tx||typeof tx!=='object'||Array.isArray(tx)||Object.keys(tx).some(k=>!allowed.has(k)))throw new Error('Unexpected transaction fields; only unsigned project Invoke is supported');
  if(tx.TransactionType!=='Invoke'||tx.NetworkID!==21338)throw new Error('Project reference requires Invoke on testnet 21338');
  if(!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(tx.Account??'')||!/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(expectedAccount??'')||(tx.Destination??tx.Account)!==expectedAccount)throw new Error('Account or expected hook Destination mismatch');
  if(tx.Destination===tx.Account)throw new Error('Self-Invoke must omit Destination');
  if(!Array.isArray(tx.HookParameters)||tx.HookParameters.length!==3)throw new Error('Expected exactly op, name, value parameters');
  const params=new Map();
  for(const row of tx.HookParameters){
    const p=row?.HookParameter;
    if(Object.keys(row??{}).length!==1||!p||Object.keys(p).length!==2||!Object.hasOwn(p,'HookParameterName')||!Object.hasOwn(p,'HookParameterValue'))throw new Error('Unexpected parameter fields');
    const name=hex(p.HookParameterName,undefined,'parameter name').toString('hex');
    if(params.has(name))throw new Error('Duplicate parameter');
    params.set(name,hex(p.HookParameterValue,undefined,'parameter value'));
  }
  const op=params.get('6f70'),name=params.get('6e616d65'),value=params.get('76616c7565');
  if(op?.toString('hex')!=='7265676973746572'||!name||!value)throw new Error('Expected op=register, name and value');
  if(!/^[a-z0-9-]{1,28}$/.test(name.toString('latin1')))throw new Error('Invalid ASCII label');
  if(value.length<1||value.length>200)throw new Error('URL must be 1..200 UTF-8 bytes');
  const text=new TextDecoder('utf-8',{fatal:true}).decode(value),url=new URL(text);
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password)throw new Error('Expected HTTP(S) URL without credentials');
  return tx;
}
export function assertProjectExecution(receipt, expectedAccount, expectedHash){
  if(receipt.validated!==true||receipt.meta?.TransactionResult!=='tesSUCCESS')throw new Error('Expected validated tesSUCCESS');
  const executions=receipt.meta.HookExecutions;
  if(!Array.isArray(executions)||!executions.some(row=>{
    const e=row.HookExecution;
    return e?.HookAccount===expectedAccount&&e.HookHash?.toUpperCase()===expectedHash.toUpperCase()&&/^[0-9a-fA-F]{1,16}$/.test(e.HookReturnCode??'')&&BigInt('0x'+e.HookReturnCode)===0n;
  }))throw new Error('Expected successful hook execution for account and hash is missing; inspect journal and read state');
}
