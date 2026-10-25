import crypto from 'node:crypto';
import {hex,integer} from './lib.mjs';
import {validateActivation} from './hookon-lib.mjs';
export function firstInstall({wasm,evidence,account,namespace,hookOn,networkId}) {
  if(!Buffer.isBuffer(wasm) || !WebAssembly.validate(wasm))throw new Error('Invalid WASM');
  const digest=crypto.createHash('sha256').update(wasm).digest('hex');
  if(evidence?.structure!=='PASS' || evidence.guard?.result!=='PASS' || evidence.sha256!==digest || evidence.bytes!==wasm.length)
    throw new Error('Require matching production structural and guard validation evidence');
  if(typeof account!=='string' || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account))throw new Error('Invalid account shape');
  integer(networkId,0,0xFFFFFFFF,'NetworkID');hex(namespace,32,'namespace');
  const hook=validateActivation({CreateCode:wasm.toString('hex').toUpperCase(),HookNamespace:namespace.toUpperCase(),HookApiVersion:0,HookOn:hookOn});
  return {TransactionType:'SetHook',Account:account,NetworkID:networkId,Hooks:[{Hook:hook}]};
}
export function validateFirstInstall(tx,networkId,account){
  if(tx.TransactionType!=='SetHook' || tx.NetworkID!==networkId || tx.Account!==account)throw new Error('Transaction account/network/type mismatch');
  const top=new Set(['TransactionType','Account','NetworkID','Hooks']);
  if(Object.keys(tx).some(k=>!top.has(k)))throw new Error('Reference accepts only a plain unsigned first-install transaction');
  if(!Array.isArray(tx.Hooks) || tx.Hooks.length!==1 || Object.keys(tx.Hooks[0]).join(',')!=='Hook')throw new Error('Reference supports one fresh installation only');
  const hook=tx.Hooks[0].Hook;
  const allowed=new Set(['CreateCode','HookNamespace','HookApiVersion','HookOn']);
  if(!hook || Object.keys(hook).some(k=>!allowed.has(k)))throw new Error('Unsupported hook field; replacement/deletion flags are refused');
  if(hook.HookApiVersion!==0)throw new Error('Reference requires HookApiVersion 0');
  const code=hex(hook.CreateCode,undefined,'CreateCode');if(!WebAssembly.validate(code))throw new Error('Invalid CreateCode WASM');
  hex(hook.HookNamespace,32,'HookNamespace');validateActivation(hook);
  if((BigInt('0x'+hook.HookOn)&(1n<<22n))!==0n)throw new Error('Reference refuses activation on SetHook');
  return tx;
}
export function validateSettingInvoke(tx,networkId,account){
  const allowed=new Set(['TransactionType','Account','NetworkID','HookParameters']);
  if(tx.TransactionType!=='Invoke'||tx.NetworkID!==networkId||tx.Account!==account||Object.keys(tx).some(k=>!allowed.has(k)))throw new Error('Only the owner-setting self-Invoke example is supported');
  if(!Array.isArray(tx.HookParameters)||tx.HookParameters.length!==1)throw new Error('Require one setting parameter');
  const row=tx.HookParameters[0];
  if(!row || Object.keys(row).join(',')!=='HookParameter')throw new Error('Invalid setting wrapper');
  const parameter=row.HookParameter;
  if(!parameter || Object.keys(parameter).sort().join(',')!=='HookParameterName,HookParameterValue')throw new Error('Invalid setting parameter');
  if(parameter.HookParameterName!=='73657474696E67')throw new Error('Only the setting parameter is supported');
  hex(parameter.HookParameterValue,8,'setting value');
  return tx;
}
