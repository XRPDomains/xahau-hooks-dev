import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const directory=path.join(root,'assets/examples/prebuilt'),wasm=fs.readFileSync(path.join(directory,'minimal.wasm'));
const read=name=>JSON.parse(fs.readFileSync(path.join(directory,name)));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const run=(name,...args)=>spawnSync(process.execPath,[path.join(root,'scripts',name),...args],{encoding:'utf8',timeout:60000,cwd:os.tmpdir()});
test('prebuilt sample binds the original source, bytes, dependency lock and producer inspection',()=>{
  const p=read('minimal.provenance.json'),inspection=read('minimal.inspection.json');
  assert.equal(WebAssembly.validate(wasm),true);assert.equal(p.artifact.bytes,wasm.length);assert.equal(p.artifact.sha256,sha(wasm));assert.equal(p.source.sha256,sha(fs.readFileSync(path.join(root,p.source.path),'utf8').replace(/\r\n/g,'\n')));
  assert.equal(p.build.lockSha256,sha(fs.readFileSync(path.join(root,'assets/toolchain/package-lock.json'))));assert.equal(p.inspection.sha256,sha(fs.readFileSync(path.join(directory,'minimal.inspection.json'))));
  assert.equal(inspection.sha256,sha(wasm));assert.equal(inspection.structure,'PASS');assert.equal(inspection.guard.result,'PASS');assert.match(inspection.guard.log,/Hook validation successful!/);assert.equal(p.producerGuard.worstCaseInstructions,30);assert.equal(p.consumerGuardExecution,'NOT_RUN');assert.equal(p.nodeAcceptance,'NOT_RUN');
});
test('prebuilt bytes support compiler-free inspection and unsigned preparation, not a fresh guard claim',()=>{
  const inspected=run('inspect-artifact.mjs','--wasm',path.join(directory,'minimal.wasm'),'--policy',path.join(root,'assets/minimal-artifact-policy.json'));
  assert.equal(inspected.status,0,inspected.stderr);assert.equal(JSON.parse(inspected.stdout).structure,'PASS');assert.equal(JSON.parse(inspected.stdout).guard,'NOT_RUN');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'xh-prebuilt-'));try{
    const args=['--wasm',path.join(directory,'minimal.wasm'),'--evidence',path.join(directory,'minimal.inspection.json'),'--account','rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh','--namespace','AB'.repeat(32),'--types','Invoke','--network-id','21338','--out',path.join(dir,'unsigned.json')];
    const prepared=run('prepare-sethook.mjs',...args);assert.equal(prepared.status,0,prepared.stderr);const tx=JSON.parse(fs.readFileSync(path.join(dir,'unsigned.json')));assert.equal(tx.Hooks[0].Hook.CreateCode,wasm.toString('hex').toUpperCase());assert.equal(tx.TxnSignature,undefined);assert.equal(tx.Fee,undefined);
    const bad=path.join(dir,'bad.json');fs.writeFileSync(bad,JSON.stringify({...read('minimal.inspection.json'),sha256:'00'.repeat(32)}));args[3]=bad;args[args.length-1]=path.join(dir,'bad-unsigned.json');assert.equal(run('prepare-sethook.mjs',...args).status,1);assert.equal(fs.existsSync(args.at(-1)),false);
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
