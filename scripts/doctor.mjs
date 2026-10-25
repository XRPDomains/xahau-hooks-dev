import {spawnSync} from 'node:child_process';
import {args, main, print} from './lib.mjs';
main(() => {
  const a = args(process.argv.slice(2), ['--image'], ['--docker', '--help']);
  if (a['--help']) return print({usage:'node doctor.mjs [--docker] [--image explicit-image-reference]', note:'Local diagnostics only. No RPC or network selection. --docker checks the daemon; --image inspects an existing local image, never pulls or runs it.'});
  const tools = {};
  for (const tool of ['clang', 'wasm-ld', 'wasm-opt', 'docker']) {
    const r = spawnSync(tool, ['--version'], {encoding:'utf8', timeout:5000, shell:false});
    tools[tool] = {available:!r.error && r.status === 0, version:(r.stdout ?? '').trim().split('\n')[0], error:r.error?.code};
  }
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
    platform:process.platform, architecture:process.arch, tools, dockerDaemon,image,
    guardChecker:'Supply explicit path to inspect-artifact; not discovered or installed.'});
  if (Number(process.versions.node.split('.')[0]) < 20) process.exitCode = 1;
});
