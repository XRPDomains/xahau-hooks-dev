import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {args,required,jsonFile,main,print} from './lib.mjs';
main(()=>{
  const a=args(process.argv.slice(2),['--source','--mock','--wasm','--policy','--guard','--wsl','--baseline','--out'],['--help']);
  if(a['--help'])return print({usage:'node scripts/profile-guards.mjs --source hook.c [--mock mock.json] [--wasm final.wasm --policy policy.json --guard checker --wsl DISTRO] [--baseline prior-profile.json] [--out profile.json]',note:'Source literal budgets + observed visits + optional real checker totals. Does not attribute exact instructions per loop, estimate gas from visits, rewrite guards or optimize C.'});
  const file=required(a['--source'],'--source'),source=fs.readFileSync(file,'utf8');
  const masked=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,s=>s.replace(/[^\n]/g,' '));
  const guards=[...masked.matchAll(/\b_g\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/g)].map(m=>({id:Number(m[1]),declaredBudget:Number(m[2]),file,line:masked.slice(0,m.index).split('\n').length,observedMax:null}));
  const literalCalls=guards.length,totalCalls=[...masked.matchAll(/\b_g\s*\(/g)].length;
  if(a['--mock']){
    const mock=jsonFile(a['--mock']);if(mock.scope!=='MOCK_ONLY'||!Array.isArray(mock.cases))throw new Error('Expected mock-hook report');
    const identity=mock.identity?.originalSha256;if(!/^[a-f0-9]{64}$/.test(identity??''))throw new Error('Mock artifact identity missing');
    if(a['--wasm']&&crypto.createHash('sha256').update(fs.readFileSync(a['--wasm'])).digest('hex')!==identity)throw new Error('Mock/production artifact mismatch');
    for(const g of guards)for(const item of mock.cases)for(const observed of item.result?.guards??[])if(observed.id===g.id)g.observedMax=Math.max(g.observedMax??0,observed.visits);
  }
  let checker=null;
  if(a['--wasm']||a['--guard']||a['--policy']){
    const cli=path.join(path.dirname(fileURLToPath(import.meta.url)),'inspect-artifact.mjs');
    const result=spawnSync(process.execPath,[cli,'--wasm',required(a['--wasm'],'--wasm'),'--policy',required(a['--policy'],'--policy'),'--guard',required(a['--guard'],'--guard'),...(a['--wsl']?['--wsl',a['--wsl']]:[])],{encoding:'utf8',shell:false,timeout:40000,maxBuffer:4*1024*1024});
    if(result.status!==0||result.error)throw new Error('Production checker/structural validation failed; inspect artifact directly');
    const inspected=JSON.parse(result.stdout);checker={artifactSha256:inspected.sha256,checkerSha256:inspected.guard.sha256,worstCaseCounts:[...inspected.guard.log.matchAll(/(?:worse|worst)-case execution count:\s*(\d+)/gi)].map(m=>Number(m[1]))};
    if(!checker.worstCaseCounts.length)throw new Error('Checker passed but total count format is not recognized');
  }
  let comparison=null;
  if(a['--baseline']){const baseline=jsonFile(a['--baseline']).checker;if(!checker||!baseline||checker.checkerSha256!==baseline.checkerSha256||checker.worstCaseCounts.length!==baseline.worstCaseCounts.length)throw new Error('Comparable totals require the same checker and entry count');comparison={worstCaseDeltas:checker.worstCaseCounts.map((n,i)=>n-baseline.worstCaseCounts[i])};}
  print({scope:'GUARD_DIAGNOSTICS',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),guards,unresolvedCalls:totalCalls-literalCalls,sourceLimits:'No macro expansion, constant-expression evaluation, preprocessor or C-to-WASM source mapping',checker,comparison,perGuardInstructionCosts:'NOT_AVAILABLE',warning:'Observed visits are input-specific. Never reduce budgets without worst-case proof and production revalidation.'},a['--out']);
});
