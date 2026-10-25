import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {args,required,main,print} from './lib.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--out','--wsl'],['--help']);
  if(a['--help'])return print({usage:'node setup-guard.mjs --out /path/to/checker [--wsl Ubuntu]',
    note:'Downloads pinned, checksum-verified upstream checker sources and builds using g++. No npm or compiler installation. Windows requires an explicit WSL distribution.'});
  const out=path.resolve(required(a['--out'],'--out'));
  if(process.platform==='win32' && !a['--wsl'])throw new Error('Windows: specify --wsl DISTRO or run inside Linux/WSL');
  if(a['--wsl'] && process.platform!=='win32')throw new Error('--wsl is only supported on Windows');
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  const manifest=JSON.parse(fs.readFileSync(path.join(root,'assets/toolchain/guard-sources.json'),'utf8'));
  const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
  fs.mkdirSync(out,{recursive:true});
  for(const row of manifest.files){
    const destination=path.join(out,row.file);
    if(fs.existsSync(destination) && sha(fs.readFileSync(destination))===row.sha256)continue;
    const response=await fetch(`https://raw.githubusercontent.com/Xahau/xahaud/${manifest.revision}/${manifest.path}/${row.file}`,{signal:AbortSignal.timeout(20000)});
    if(!response.ok)throw new Error(`Checker source download failed: ${row.file}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    if(sha(bytes)!==row.sha256)throw new Error(`Checker source checksum mismatch: ${row.file}`);
    fs.writeFileSync(destination,bytes);
  }
  let command='g++',commandArgs=['guard_checker.cpp','-std=c++17','-O2','-o','guard_checker'];
  if(a['--wsl']){
    if(!/^[A-Za-z]:[\\/]/.test(out))throw new Error('WSL adapter requires a local drive path');
    const linuxPath='/mnt/'+out[0].toLowerCase()+out.slice(2).replaceAll('\\','/');
    command='wsl';commandArgs=['-d',a['--wsl'],'--cd',linuxPath,'--','g++',...commandArgs];
  }
  const result=spawnSync(command,commandArgs,{cwd:out,encoding:'utf8',shell:false,timeout:60000,maxBuffer:4*1024*1024});
  if(result.error || result.status!==0)throw new Error('Checker build failed: '+(result.error?.message ?? result.stderr));
  const executable=path.join(out,'guard_checker');
  const license=await fetch(`https://raw.githubusercontent.com/Xahau/xahaud/${manifest.revision}/LICENSE.md`,{signal:AbortSignal.timeout(20000)});
  if(!license.ok)throw new Error('Checker built, but upstream license download failed; do not redistribute until resolved');
  fs.writeFileSync(path.join(out,'UPSTREAM-LICENSE.txt'),await license.text());
  const report={revision:manifest.revision,executable,sha256:sha(fs.readFileSync(executable)),validation:'NOT_RUN',wsl:a['--wsl']};
  fs.writeFileSync(path.join(out,'provenance.json'),JSON.stringify(report,null,2)+'\n');print(report);
});
