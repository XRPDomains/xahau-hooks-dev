import crypto from 'node:crypto';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
function leb(n){const out=[];do{let b=n%128;n=Math.floor(n/128);if(n)b|=128;out.push(b);}while(n);return Buffer.from(out);}
export function exposeProbeMemory(input,maxPages=64){
  const bytes=Buffer.from(input);if(bytes.length>1024*1024||!WebAssembly.validate(bytes))throw new Error('Invalid/oversized WASM probe input');
  const module=new WebAssembly.Module(bytes),imports=WebAssembly.Module.imports(module);
  if(imports.some(i=>i.module!=='env'||i.kind!=='function'))throw new Error('Probe supports env function imports and one defined memory only');
  let offset=8,memories=0,exported=false;const sections=[];
  function read(){let n=0,m=1;for(let j=0;j<5;++j){if(offset>=bytes.length)throw new Error('Truncated LEB');const b=bytes[offset++];n+=(b&127)*m;if(!(b&128))return n;m*=128;}throw new Error('Oversized LEB');}
  while(offset<bytes.length){const id=bytes[offset++],size=read(),start=offset,end=start+size;if(end>bytes.length)throw new Error('Truncated WASM section');let payload=bytes.subarray(start,end);
    if(id===5){memories=read();if(memories!==1)throw new Error('Exactly one memory required');const flags=read(),initial=read(),maximum=flags&1?read():undefined;if(flags>1||initial>maxPages)throw new Error('Unsupported or excessive memory');payload=Buffer.concat([leb(1),leb(1),leb(initial),leb(Math.min(maximum??maxPages,maxPages))]);}
    if(id===7){const count=read(),rest=bytes.subarray(offset,end);if(WebAssembly.Module.exports(module).some(e=>e.name==='__probe_memory'))throw new Error('Reserved probe export');payload=Buffer.concat([leb(count+1),rest,leb(14),Buffer.from('__probe_memory'),Buffer.from([2,0])]);exported=true;}
    sections.push(Buffer.concat([Buffer.from([id]),leb(payload.length),payload]));offset=end;
  }
  if(memories!==1||!exported)throw new Error('Module must define one memory and an export section');
  const instrumented=Buffer.concat([bytes.subarray(0,8),...sections]);
  if(!WebAssembly.validate(instrumented))throw new Error('Instrumented probe is invalid');
  return {bytes:instrumented,originalSha256:sha(bytes),probeSha256:sha(instrumented),imports:imports.map(i=>i.name)};
}
