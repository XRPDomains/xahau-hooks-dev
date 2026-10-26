// Lexical review hints only: no preprocessing, C type system or control-flow proof.
export function lintSource(source, file='<source>') {
  const code=source.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g,
    s=>s.replace(/[^\n]/g,' '));
  const findings=[];
  const add=(rule,index,message)=>findings.push({file,line:1+code.slice(0,index).split('\n').length-1,rule,message});
  const api='(?:state(?:_foreign)?(?:_set)?|otxn_\\w+|hook_param|hook_account|emit|etxn_reserve)';
  // Only standalone call statements: assignments and conditions need manual flow review.
  const ignored=new RegExp('(?:^|[;{}])\\s*(?:\\(\\s*void\\s*\\)\\s*)?('+api+')\\s*\\(','g');
  for(const m of code.matchAll(ignored))add('ignored-api-result',m.index+m[0].indexOf(m[1]),`Review discarded ${m[1]} result; validate status/byte count before using data or accepting mutation.`);
  const unsigned=new RegExp('(?:\\b(?:uint(?:8|16|32|64)_t|size_t|unsigned(?:\\s+(?:int|long|short))?)\\s+\\w+\\s*=\\s*|\\(\\s*(?:uint(?:8|16|32|64)_t|size_t|unsigned(?:\\s+(?:int|long|short))?)\\s*\\)\\s*)('+api+')\\s*\\(','g');
  for(const m of code.matchAll(unsigned))add('unsigned-api-result',m.index,'Potential negative API error converted to unsigned; retain signed return and check it first.');
  function closing(start){let depth=0;for(let i=start;i<code.length;i++){if(code[i]==='(')++depth;if(code[i]===')'&&!--depth)return i;}return -1;}
  for(const m of code.matchAll(/\b(for|while|do)\b/g)){
    let header='',bodyStart=m.index+m[0].length;
    if(m[1]!=='do'){
      const open=code.indexOf('(',bodyStart);if(open<0)continue;
      const end=closing(open);if(end<0)continue;
      header=code.slice(open,end+1);bodyStart=end+1;
    }
    // Only the header or first body statement can satisfy this local heuristic.
    const first=code.slice(bodyStart).replace(/^\s*\{?\s*/,'').split(';',1)[0];
    if(!/\b(?:_g|GUARD|XH_GUARD)\s*\(/.test(header+' '+first))add('loop-guard-review',m.index,'No recognized guard in loop header/first statement; inspect macros and production WASM. do/while tails may be reported separately.');
  }
  return findings.sort((a,b)=>a.line-b.line||a.rule.localeCompare(b.rule));
}
