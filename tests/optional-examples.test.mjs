import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {firstInstall} from '../scripts/sethook-lib.mjs';
import {maskFor,typeIds} from '../scripts/hookon-lib.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const require=createRequire(path.join(root,'assets/examples/deploy/package.json'));
let xahau;try{xahau=require('xahau');}catch{/* Optional package absent: tests below report SKIP. */}
const account='rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh';
const wasm=Buffer.from('0061736d010000000104016000000302010007080104686f6f6b00000a040102000b','hex');
const evidence={structure:'PASS',guard:{result:'PASS'},bytes:wasm.length,sha256:crypto.createHash('sha256').update(wasm).digest('hex')};
const tx=firstInstall({wasm,evidence,account,namespace:'AB'.repeat(32),hookOn:maskFor(typeIds('Invoke')),networkId:21338});

test('optional Xahau codec encodes reference SetHook and self-Invoke without signing', {skip:!xahau},()=>{
  for(const input of [tx,{TransactionType:'Invoke',Account:account,NetworkID:21338,HookParameters:[{HookParameter:{HookParameterName:'73657474696E67',HookParameterValue:'000000000000002A'}}]}]){
    const filled={...input,Fee:'0',Sequence:1,LastLedgerSequence:100,SigningPubKey:''};
    const result=xahau.decode(xahau.encode(filled));
    assert.equal(result.TransactionType,input.TransactionType);assert.equal(result.NetworkID,21338);
    assert.equal(result.Account,account);assert.equal(result.Fee,'0');
  }
});
test('optional signer stays offline without submit and rejects mainnet, stale evidence and missing caps',{skip:!xahau},()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'xh-sign-reference-'));
  try{
    const config=path.join(temp,'network.json'),transaction=path.join(temp,'unsigned.json'),proof=path.join(temp,'inspection.json');
    fs.writeFileSync(config,JSON.stringify({networkId:21338,websocket:'ws://127.0.0.1:9'}));
    fs.writeFileSync(transaction,JSON.stringify(tx));fs.writeFileSync(proof,JSON.stringify(evidence));
    const run=(...extra)=>spawnSync(process.execPath,[path.join(root,'assets/examples/deploy/submit-testnet.mjs'),
      '--config',config,'--tx',transaction,'--evidence',proof,...extra],{encoding:'utf8',timeout:5000,env:{...process.env,XAHAU_TESTNET_SEED:''}});
    const offline=run();assert.equal(offline.status,0,offline.stderr);assert.equal(JSON.parse(offline.stdout).stage,'OFFLINE_REVIEW_ONLY');
    const missingCap=run('--submit');assert.equal(missingCap.status,1);assert.match(missingCap.stderr,/max-fee-drops/);
    fs.writeFileSync(proof,JSON.stringify({...evidence,sha256:'wrong'}));assert.equal(run().status,1);
    fs.writeFileSync(proof,JSON.stringify(evidence));
    fs.writeFileSync(config,JSON.stringify({networkId:21337,websocket:'ws://127.0.0.1:9'}));
    const mainnet=run('--submit');assert.equal(mainnet.status,1);assert.match(mainnet.stderr,/testnet NetworkID 21338 only/);
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
