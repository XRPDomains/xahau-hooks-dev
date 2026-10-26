import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {probe,dependencyReport,npmCommand,readiness} from '../scripts/doctor-lib.mjs';

test('doctor distinguishes missing command, bad exit and observed version without a shell',()=>{
  let options;
  assert.equal(probe('missing',[],(_c,_a,o)=>{options=o;return {error:{code:'ENOENT'}};}).available,false);
  assert.equal(options.shell,false);
  assert.equal(probe('bad',[],()=>({status:1,stdout:''})).available,false);
  assert.equal(probe('slow',[],()=>({error:{code:'ETIMEDOUT'}})).status,'TIMED_OUT');
  assert.equal(probe('ok',[],()=>({status:0,stdout:'v1\nsecond line'})).version,'v1');
});
test('doctor sees absent/wrong/exact optional dependency versions independently',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'xh-doctor-'));
  try{
    fs.mkdirSync(path.join(root,'optional'));fs.writeFileSync(path.join(root,'optional/package.json'),JSON.stringify({dependencies:{demo:'1.2.3'}}));
    assert.equal(dependencyReport(root,'optional')[0].available,false);
    fs.mkdirSync(path.join(root,'optional/node_modules/demo'),{recursive:true});
    const file=path.join(root,'optional/node_modules/demo/package.json');
    fs.writeFileSync(file,JSON.stringify({version:'1.2.2'}));assert.equal(dependencyReport(root,'optional')[0].available,false);
    fs.writeFileSync(file,JSON.stringify({version:'1.2.3'}));assert.equal(dependencyReport(root,'optional')[0].available,true);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('Windows npm diagnostics locate JS entrypoint rather than spawning a cmd shell',()=>{
  const exe=path.join('runtime','node.exe'),cli=path.join('tools','node_modules/npm/bin/npm-cli.js');
  const result=npmCommand('win32',exe,{PATH:'absent;tools'},p=>p===cli);
  assert.deepEqual(result,{command:exe,argv:[cli,'--version']});
  assert.equal(npmCommand('win32',exe,{},()=>false),null);
  assert.equal(npmCommand('linux').command,'npm');
});
test('missing tools retain source/offline work and never imply artifact/deployment validation',()=>{
  const dependencies={compiler:[{name:'compiler',expected:'1',available:false}],deploy:[{name:'xahau',expected:'4',available:false}],headersAvailable:false};
  const result=readiness({nodeSupported:true,platform:'win32',tools:{},dependencies});
  assert.equal(result.checks.sourceTools.available,true);assert.equal(result.checks.npmCompile.available,false);
  assert.equal(result.checks.checkerBuild.available,false);assert.equal(result.checks.websocketExamples.available,false);
  assert.match(result.evidence,/not.*deployment/);assert.match(result.fallback,/NOT_RUN/);
  dependencies.compiler[0].available=true;dependencies.deploy[0].available=true;dependencies.headersAvailable=true;
  const withWsl=readiness({nodeSupported:true,platform:'win32',tools:{},dependencies,wsl:{compiler:{available:true},cCompiler:{available:true}},guardFile:{exists:true,execution:'NOT_RUN'}});
  assert.equal(withWsl.checks.npmCompile.available,true);assert.equal(withWsl.checks.checkerBuild.available,true);
  assert.equal(withWsl.guardFile.execution,'NOT_RUN');
  assert.equal(readiness({nodeSupported:false,platform:'linux',tools:{},dependencies}).checks.npmCompile.available,false);
  assert.equal(readiness({nodeSupported:true,platform:'linux',tools:{'g++':{available:true}},dependencies}).checks.checkerBuild.available,true);
});
