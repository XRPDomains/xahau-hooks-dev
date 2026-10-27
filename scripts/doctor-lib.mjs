import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

export function probe(command, argv, run=spawnSync,timeoutMs=5000){
  const r=run(command,argv,{encoding:'utf8',timeout:timeoutMs,shell:false,windowsHide:true,maxBuffer:1024*1024});
  return {available:!r.error&&r.status===0,version:String(r.stdout??'').replaceAll('\0','').trim().split(/\r?\n/)[0],
    status:!r.error&&r.status===0?'OBSERVED':r.error?.code==='ENOENT'?'NOT_FOUND':r.error?.code==='ETIMEDOUT'?'TIMED_OUT':'PROBE_FAILED',
    error:r.error?.code??(r.status?`EXIT_${r.status}`:undefined)};
}
export function dependencyReport(root, directory){
  const folder=path.join(root,directory),manifest=JSON.parse(fs.readFileSync(path.join(folder,'package.json'),'utf8'));
  return Object.entries(manifest.dependencies).map(([name,expected])=>{
    let installed;try{installed=JSON.parse(fs.readFileSync(path.join(folder,'node_modules',name,'package.json'),'utf8')).version;}catch{}
    return {name,expected,installed:installed??null,available:installed===expected};
  });
}
// On Windows do not execute npm.cmd via a shell. Locate its JS entrypoint.
export function npmCommand(platform=process.platform,execPath=process.execPath,env=process.env,exists=fs.existsSync){
  if(platform!=='win32')return {command:'npm',argv:['--version']};
  const dirs=[path.dirname(execPath),...(env.PATH??env.Path??'').split(';').filter(Boolean)];
  for(const dir of dirs){
    const cli=path.join(dir.replace(/^"|"$/g,''),'node_modules/npm/bin/npm-cli.js');
    if(exists(cli))return {command:execPath,argv:[cli,'--version']};
  }
  return null;
}
export function readiness({nodeSupported,platform,tools,dependencies,wsl='NOT_RUN',guardFile}){
  const checks={
    sourceTools:{available:nodeSupported,missing:nodeSupported?[]:['Node >=20'],next:'node scripts/lint-source.mjs --source hook.c'},
    npmCompile:{available:nodeSupported&&dependencies.compiler.every(p=>p.available)&&dependencies.headersAvailable,
      missing:[...(!nodeSupported?['Node >=20']:[]),...dependencies.compiler.filter(p=>!p.available).map(p=>`${p.name}@${p.expected}`),...(!dependencies.headersAvailable?['Hook C headers']:[])],
      next:'npm ci --ignore-scripts --no-audit --no-fund --prefix assets/toolchain; then compile a fresh minimal example'},
    checkerBuild:{available:nodeSupported&&(platform==='win32'?!!wsl?.compiler?.available:!!tools['g++']?.available),
      missing:!nodeSupported?['Node >=20']:(platform==='win32'?(wsl?.compiler?.available?[]:[`WSL g++ not confirmed: ${wsl?.compiler?.status??'DISTRO_NOT_SELECTED'}`]):(tools['g++']?.available?[]:[`g++ not confirmed: ${tools['g++']?.status??'NOT_PROBED'}`])),
      next:platform==='win32'?'node scripts/setup-guard.mjs --out build/guard --wsl DISTRO':'node scripts/setup-guard.mjs --out build/guard'},
    nativeTests:{available:platform==='win32'?!!wsl?.cCompiler?.available:!!(tools.cc?.available||tools.clang?.available),next:'Compile the native C tests; sanitizer support is checked by the test command, not this report'},
    websocketExamples:{available:nodeSupported&&dependencies.deploy.every(p=>p.available),
      missing:[...(!nodeSupported?['Node >=20']:[]),...dependencies.deploy.filter(p=>!p.available).map(p=>`${p.name}@${p.expected}`)],
      next:'npm ci --ignore-scripts --no-audit --no-fund --prefix assets/examples/deploy'}
  };
  return {mode:'FULL_DIAGNOSTICS',summary:{source_tools:checks.sourceTools.available,compile_tools:checks.npmCompile.available,
      source_status:nodeSupported?'SOURCE_TOOLS_READY':'SOURCE_TOOLS_UNAVAILABLE',compile_status:checks.npmCompile.available?'COMPILE_PREREQUISITES_OBSERVED':'COMPILE_PREREQUISITES_MISSING'},checks,guardFile:guardFile??'NOT_CONFIGURED',
    evidence:'LOCAL_PREREQUISITES_ONLY: installed metadata is not a working compiler, complete dependency-tree validation, artifact validation or deployment authorization',
    fallback:'Missing build/checker does not block source review, protocol design or unsigned planning. Keep unavailable stages NOT_RUN; see references/environment-setup.md'};
}

// No subprocesses, dependency reads or native probes in source-only mode.
export function sourceReadiness(nodeSupported){
  return {mode:'SOURCE_ONLY',summary:{source_tools:nodeSupported,compile_tools:null,
      source_status:nodeSupported?'SOURCE_TOOLS_READY':'SOURCE_TOOLS_UNAVAILABLE',compile_status:'NOT_CHECKED'},
    checks:{sourceTools:{available:nodeSupported,missing:nodeSupported?[]:['Node >=20'],next:'node scripts/lint-source.mjs --source hook.c'},
      npmCompile:{available:null,status:'NOT_CHECKED'},checkerBuild:{available:null,status:'NOT_CHECKED'},
      nativeTests:{available:null,status:'NOT_CHECKED'},websocketExamples:{available:null,status:'NOT_CHECKED'}},
    evidence:'SOURCE_PREREQUISITES_ONLY: Node availability is not source correctness, compile/guard execution or deployment authorization',
    fallback:'Review, lint, scaffold, state design, HookOn and unsigned planning remain useful; compile/guard NOT_RUN until their tools execute'};
}
