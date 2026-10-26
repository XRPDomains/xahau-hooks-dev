import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {args, main, print} from './lib.mjs';
import {probe,dependencyReport,npmCommand,readiness} from './doctor-lib.mjs';
main(() => {
  const a = args(process.argv.slice(2), ['--image','--wsl','--guard','--out'], ['--docker', '--help']);
  if (a['--help']) return print({usage:'node doctor.mjs [--docker] [--image explicit-image-reference] [--wsl DISTRO] [--guard FILE] [--out report.json]', note:'Local diagnostics only; never installs, pulls, signs or uses RPC. Optional --wsl lists distros and probes g++/cc in that explicitly selected distro. --guard checks file presence only; it does not execute the checker. Exit 0 means report generated, not all capabilities ready.'});
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
