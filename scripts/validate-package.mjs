import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {args, main, print} from './lib.mjs';
main(() => {
  const a=args(process.argv.slice(2),[],['--help']);
  if(a['--help'])return print({usage:'node validate-package.mjs',note:'Checks local Markdown links and JavaScript syntax. Does not replace skill frontmatter or behavioral validation.'});
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
  const files=walk(root),errors=[];let links=0,modules=0;
  for(const file of files) {
    if(file.endsWith('.md')) {
      const content=fs.readFileSync(file,'utf8');
      for(const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target=match[1].split('#')[0];
        if(!target || /^[a-z][a-z0-9+.-]*:/i.test(target))continue;
        ++links;
        const resolved=path.resolve(path.dirname(file),target);
        if(!resolved.startsWith(root+path.sep) && resolved!==root)errors.push(`Link escapes package: ${file}: ${target}`);
        else if(!fs.existsSync(resolved))errors.push(`Missing local link: ${file}: ${target}`);
      }
    }
    if(file.endsWith('.mjs')) {
      ++modules;const r=spawnSync(process.execPath,['--check',file],{encoding:'utf8',shell:false});
      if(r.error || r.status!==0)errors.push(`Syntax check failed: ${file}: ${r.stderr ?? r.error?.message}`);
    }
  }
  print({files:files.length,localLinks:links,javascriptModules:modules,result:errors.length?'FAIL':'PASS',errors});
  if(errors.length)process.exitCode=1;
});
