import fs from 'node:fs';
import {args,required,print} from './lib.mjs';
import {lintSource} from './source-lint.mjs';
try{
  const a=args(process.argv.slice(2),['--source'],['--help']);
  if(a['--help'])print({usage:'node scripts/lint-source.mjs --source hook.c',note:'Heuristic review hints, not an audit certificate. Exit 0=no findings, 1=review findings, 2=input error. No preprocessing or flow/type analysis.'});
  else{
    const file=required(a['--source'],'--source'),findings=lintSource(fs.readFileSync(file,'utf8'),file);
    print({result:findings.length?'REVIEW_REQUIRED':'NO_FINDINGS',scope:'LEXICAL_HEURISTIC_ONLY',findings});
    process.exitCode=findings.length?1:0;
  }
}catch(error){process.stderr.write(JSON.stringify({error:error.message})+'\n');process.exitCode=2;}
