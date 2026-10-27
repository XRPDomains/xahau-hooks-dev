import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {args, main, print} from './lib.mjs';
import {probe,dependencyReport,npmCommand,readiness,sourceReadiness} from './doctor-lib.mjs';
main(() => {
  const a = args(process.argv.slice(2), ['--image','--wsl','--guard','--out'], ['--source-only','--docker', '--help']);
  if (a['--help']) return print({usage:'node doctor.mjs --source-only [--out report.json] OR node doctor.mjs [--docker] [--image IMAGE] [--wsl DISTRO] [--guard FILE] [--out report.json]', note:'Local diagnostics only; never installs, pulls, signs or uses RPC. --source-only skips every subprocess/native/dependency probe; compile_tools is null (unexamined). Full mode reports compiler prerequisite metadata, not a proven working compiler. Optional --wsl lists distros and probes g++/cc in that explicitly selected distro. --guard checks file presence only. Exit 0 means report generated, not all capabilities ready.'});
  if(a['--source-only']){
    if(['--docker','--image','--wsl','--guard'].some(key=>a[key]!==undefined))throw new Error('--source-only cannot be combined with tool/native probe options');
    const nodeSupported=Number(process.versions.node.split('.')[0])>=20;
    print({node:process.version,nodeSupported,platform:process.platform,architecture:process.arch,tools:'NOT_RUN',dependencies:'NOT_RUN',...sourceReadiness(nodeSupported)},a['--out']);
    if(!nodeSupported)process.exitCode=1;
    return;
  }
  if(a['--wsl']&&process.platform!=='win32')throw new Error('--wsl is only supported on Windows');
  if(a['--wsl']?.startsWith('-'))throw new Error('Invalid WSL distribution');
  const tools = {};
  for (const tool of ['clang', 'wasm-ld', 'wasm-opt', 'docker','g++','cc'])tools[tool]=probe(tool,['--version']);
  const npm=npmCommand();tools.npm=npm?probe(npm.command,npm.argv):{available:false,error:'NPM_ENTRYPOINT_NOT_FOUND'};
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const dependencies={compiler:dependencyReport(root,'assets/toolchain'),deploy:dependencyReport(root,'assets/examples/deploy'),
    headersAvailable:fs.existsSync(path.join(root,'assets/toolchain/node_modules/@xahau/hooks-cli/dist/npm/src/init/c/contracts/include/hookapi.h'))};
  let wsl='NOT_RUN';
  if(a['--wsl']){
    const inventory=spawnSync('wsl',['--list','--quiet'],{encoding:'utf8',timeout:15000,shell:false,windowsHide:true});
    wsl={distribution:a['--wsl'],inventory:{available:!inventory.error&&inventory.status===0,
      distributions:String(inventory.stdout??'').replaceAll('\0','').trim().split(/\r?\n/).filter(Boolean),error:inventory.error?.code},
      compiler:probe('wsl',['-d',a['--wsl'],'--','g++','--version'],spawnSync,15000),cCompiler:probe('wsl',['-d',a['--wsl'],'--','cc','--version'],spawnSync,15000)};
  }
  const guardFile=a['--guard']?{path:path.resolve(a['--guard']),exists:fs.existsSync(a['--guard'])&&fs.statSync(a['--guard']).isFile(),execution:'NOT_RUN'}:undefined;
  let dockerDaemon = 'NOT_RUN';
  if (a['--docker']) {
    const r = spawnSync('docker', ['info', '--format', '{{.ServerVersion}}'], {encoding:'utf8', timeout:10000, shell:false});
    dockerDaemon = {available:!r.error && r.status === 0, version:(r.stdout ?? '').trim()};
  }
  let image='NOT_RUN';
  if(a['--image']){
    if(a['--image'].startsWith('-'))throw new Error('Invalid image reference');
    const r=spawnSync('docker',['image','inspect',a['--image'],'--format','{{json .}}'],{encoding:'utf8',timeout:10000,shell:false,maxBuffer:1024*1024});
    const details=!r.error && r.status===0?JSON.parse(r.stdout):undefined;
    image={reference:a['--image'],available:!!details,id:details?.Id,repoDigests:details?.RepoDigests,error:r.error?.code};
  }
  print({node:process.version, nodeSupported:Number(process.versions.node.split('.')[0]) >= 20,
    platform:process.platform, architecture:process.arch, tools, dependencies,wsl,dockerDaemon,image,
    ...readiness({nodeSupported:Number(process.versions.node.split('.')[0])>=20,platform:process.platform,tools,dependencies,wsl,guardFile}),
    guardChecker:'Pass --guard to report file presence; use inspect-artifact to execute it on the selected artifact.'},a['--out']);
  if (Number(process.versions.node.split('.')[0]) < 20) process.exitCode = 1;
});
