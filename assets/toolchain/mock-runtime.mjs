import {Worker} from 'node:worker_threads';
export async function createMockRuntime(wasm,{timeoutMs=1000,maxMemoryPages=64,initialState={}}={}){
  if(!Number.isInteger(timeoutMs)||timeoutMs<10||timeoutMs>10000||!Number.isInteger(maxMemoryPages)||maxMemoryPages<1||maxMemoryPages>256)throw new Error('Invalid probe limits');
  const worker=new Worker(new URL('./mock-worker.mjs',import.meta.url),{workerData:{wasm:Buffer.from(wasm),maxMemoryPages,initialState},execArgv:[]});
  let dead=false,busy=false,handler;
  worker.on('message',message=>handler?.(null,message));worker.on('error',error=>{dead=true;handler?.(error);});
  worker.on('exit',code=>{dead=true;if(busy)handler?.(new Error('Mock worker exited: '+code));});
  function exchange(message){return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{dead=true;worker.terminate();reject(new Error('Mock execution timed out; worker terminated and no state result committed'));},timeoutMs);
    handler=(error,result)=>{clearTimeout(timer);handler=undefined;busy=false;if(error)reject(error);else if(result?.error)reject(new Error(result.error));else resolve(result);};
    if(message)worker.postMessage(message);
  });}
  const ready=await exchange();
  return {identity:ready,
    async run(fixture={}){if(dead||busy)throw new Error('Mock runtime unavailable or busy');busy=true;return exchange({fixture});},
    async close(){dead=true;await worker.terminate();}
  };
}
