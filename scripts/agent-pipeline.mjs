import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {args,required,jsonFile,hex,print} from './lib.mjs';
import {firstInstall} from './sethook-lib.mjs';
import {maskFor,typeIds} from './hookon-lib.mjs';
import {snapshot} from './rpc.mjs';
import {npmCommand} from './doctor-lib.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
let report,file,work,evidenceOwned=false;
const save=()=>fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n','utf8');
try{
  const a=args(process.argv.slice(2),['--source','--policy','--guard','--wsl','--work','--out','--tests-file','--config','--contract','--wallet-cache','--faucet','--max-fee-drops'],['--testnet','--run-tests','--setup-tools','--submit','--fund-testnet','--help']);
  if(a['--help']){
    print({usage:'node scripts/agent-pipeline.mjs --source hook.c --policy policy.json --guard checker --work new-directory --testnet [--wsl DISTRO] [--run-tests --tests-file project.test.mjs] [--setup-tools] [--submit --config network.json --contract contract.json --wallet-cache private/testnet-wallet.json --max-fee-drops LIMIT] [--fund-testnet --faucet https://xahau-test.net/accounts] [--out new-evidence.json]',note:'Local lint/build/guard by default. Submission requires the complete project contract, explicit fee/reserve budget, new journals and expected state bytes. Never guesses an arbitrary Hook smoke operation; never automatically resumes or replays an existing run.'});
  }else{
    if(!a['--testnet'])throw new Error('Explicit --testnet required; mainnet is unsupported');
    if(a['--fund-testnet']&&!a['--submit'])throw new Error('--fund-testnet requires --submit and explicit network configuration');
    const source=path.resolve(required(a['--source'],'--source')),policy=path.resolve(required(a['--policy'],'--policy')),guard=path.resolve(required(a['--guard'],'--guard'));
    if(a['--run-tests'])required(a['--tests-file'],'--tests-file for source-specific tests');
    work=path.resolve(required(a['--work'],'--work'));
    if(fs.existsSync(work))throw new Error('Work directory exists; inspect evidence/journal hashes instead of replaying the pipeline');
    file=a['--out']?path.resolve(a['--out']):path.join(work,'evidence.json');
    if(fs.existsSync(file))throw new Error('Evidence file exists');
    fs.mkdirSync(path.dirname(work),{recursive:true});fs.mkdirSync(work);
    report={schemaVersion:1,result:'IN_PROGRESS',source,networkId:21338,stages:{lint:'NOT_RUN',tests:'NOT_RUN',build:'NOT_RUN',guard:'NOT_RUN',wallet:'NOT_RUN',reserve:'NOT_RUN',install:'NOT_RUN',smoke:'NOT_RUN',readback:'NOT_RUN'}};
    fs.writeFileSync(file,JSON.stringify(report,null,2)+'\n',{encoding:'utf8',flag:'wx'});
    evidenceOwned=true;
    function run(stage,command,argv,{cwd=root,env=process.env,parse=false}={}){
      const r=spawnSync(command,argv,{cwd,env,encoding:'utf8',shell:false,windowsHide:true,timeout:60000,maxBuffer:8*1024*1024});
      const log=path.join(work,stage+'.log');fs.writeFileSync(log,(r.stdout??'')+(r.stderr??''),'utf8');
      report.stages[stage]={result:r.error||r.status!==0?'FAIL':'PASS',exitCode:r.status,error:r.error?.code,log};save();
      if(r.error||r.status!==0)throw new Error(`Pipeline ${stage} failed; inspect its log and evidence`);
      if(parse)return JSON.parse(r.stdout);
      return r.stdout;
    }
    const cli=(stage,script,argv=[],options={})=>run(stage,process.execPath,[path.join(root,script),...argv],options);
    if(a['--setup-tools']){
      const npm=npmCommand();if(!npm)throw new Error('npm unavailable; follow references/environment-setup.md');
      for(const dir of ['assets/toolchain',...(a['--submit']?['assets/examples/deploy']:[])])run('setup-'+path.basename(dir),npm.command,[...npm.argv.slice(0,-1),'ci','--ignore-scripts','--no-audit','--no-fund','--prefix',path.join(root,dir)]);
      if(!fs.existsSync(guard))cli('setup-guard','scripts/setup-guard.mjs',['--out',path.dirname(guard),...(a['--wsl']?['--wsl',a['--wsl']]:[])]);
    }
    cli('lint','scripts/lint-source.mjs',['--source',source,'--out',path.join(work,'lint.json')]);
    if(a['--run-tests'])run('tests',process.execPath,['--test',path.resolve(a['--tests-file'])]);
    const buildDir=path.join(work,'build');
    const build=cli('build','assets/toolchain/compile.mjs',['--source',source,'--out',buildDir],{parse:true});report.artifact=build;save();
    const wasm=path.join(buildDir,'hook.cleaned.wasm'),inspectionFile=path.join(work,'inspection.json');
    const inspection=cli('guard','scripts/inspect-artifact.mjs',['--wasm',wasm,'--policy',policy,'--guard',guard,...(a['--wsl']?['--wsl',a['--wsl']]:[]),'--out',inspectionFile],{parse:true});
    if(inspection.structure!=='PASS'||inspection.guard?.result!=='PASS')throw new Error('Matching production artifact and guard PASS required');
    if(a['--submit']){
      const config=jsonFile(required(a['--config'],'--config')),contract=jsonFile(required(a['--contract'],'--contract'));
      const cap=required(a['--max-fee-drops'],'--max-fee-drops');if(!/^[1-9]\d*$/.test(cap))throw new Error('Fee cap must be positive drops');
      hex(contract.namespace,32,'contract namespace');
      if(!Array.isArray(contract.readback)||!contract.readback.length||!contract.invoke||!/^\d+$/.test(contract.extraReserveDrops??''))throw new Error('Contract requires invoke, nonempty readback and explicit extraReserveDrops');
      for(const item of contract.readback){hex(item.key,32,'expected state key');hex(item.hex,undefined,'expected state bytes');}
      if(new Set(contract.readback.map(item=>item.key.toUpperCase())).size!==contract.readback.length||contract.readback.some(item=>item.hex.length===0))throw new Error('Readback assertions require distinct keys and nonempty stored values');
      if(!/^[0-9a-fA-F]{1,16}$/.test(contract.returnCode??'0'))throw new Error('Invalid expected return code');
      if(!typeIds(contract.types??'Invoke').some(row=>row.id===99))throw new Error('Pipeline smoke Invoke requires Invoke activation');
      if(Object.keys(contract.invoke).some(k=>!['HookParameters','Memos','Blob'].includes(k)))throw new Error('Contract invoke contains unsupported routing/transaction fields');
      const target=await import(pathToFileURL(path.join(root,'assets/examples/deploy/node_modules/xahau/dist/npm/index.js')).href);
      const {Client}=target;
      const runtime=await import(pathToFileURL(path.join(root,'assets/examples/deploy/testnet-runtime.mjs')).href);
      const funding=await import(pathToFileURL(path.join(root,'assets/examples/deploy/testnet-funding.mjs')).href);
      runtime.testnetConfig(config);
      const cache=path.resolve(required(a['--wallet-cache'],'--wallet-cache'));
      if(cache.startsWith(work+path.sep))throw new Error('Keep private wallet cache outside the public pipeline evidence directory');
      const client=new Client(config.websocket,{connectionTimeout:6000,timeout:10000});
      try{
        await client.connect();
        report.stages.wallet={result:'IN_PROGRESS'};save();
        const {wallet,account}=await funding.ensureWallet({client,cache,fund:!!a['--fund-testnet'],faucet:a['--faucet']});
        report.stages.wallet={result:'PASS',address:wallet.classicAddress,validated:true};save();
        report.stages.reserve={result:'IN_PROGRESS'};save();
        const feeState=(await client.request({command:'server_state'})).result.state?.validated_ledger;
        const units=v=>{if(!/^\d+$/.test(String(v??''))||typeof v==='number'&&!Number.isSafeInteger(v))throw new Error('Missing exact reserve values in drops');return BigInt(v);};
        const owners=account.account_data.OwnerCount;if(!Number.isSafeInteger(owners)||owners<0)throw new Error('Invalid OwnerCount');
        const requiredBalance=units(feeState?.reserve_base)+BigInt(owners)*units(feeState?.reserve_inc)+BigInt(contract.extraReserveDrops)+2n*BigInt(cap);
        if(BigInt(account.account_data.Balance)<requiredBalance)throw new Error('Insufficient balance for current reserve, two fee caps and explicit additional reserve budget');
        report.stages.reserve={result:'PASS',requiredBalanceDrops:String(requiredBalance),extraReserveDrops:contract.extraReserveDrops,note:'Additional Hook/state reserve budget is supplied by the reviewed project contract, not inferred universally'};save();
        const tx=firstInstall({wasm:fs.readFileSync(wasm),evidence:inspection,account:wallet.classicAddress,namespace:contract.namespace,hookOn:maskFor(typeIds(contract.types??'Invoke')),networkId:21338});
        const unsigned=path.join(work,'install.unsigned.json'),installJournal=path.join(work,'install-journal.json');fs.writeFileSync(unsigned,JSON.stringify(tx,null,2)+'\n',{encoding:'utf8',flag:'wx'});
        cli('install','assets/examples/deploy/submit-testnet.mjs',['--config',path.resolve(a['--config']),'--tx',unsigned,'--evidence',inspectionFile,'--submit','--max-fee-drops',cap,'--journal',installJournal],{env:{...process.env,XAHAU_TESTNET_SEED:wallet.seed}});
        const installed=jsonFile(installJournal),hashes=(installed.installedHooks??[]).flatMap(o=>o.Hooks??[]).flatMap(h=>h.Hook?.HookHash?[h.Hook.HookHash]:[]);
        if(hashes.length!==1)throw new Error('Expected exactly one installed HookHash');
        const invoke={TransactionType:'Invoke',Account:wallet.classicAddress,NetworkID:21338,...contract.invoke};
        report.stages.smoke={result:'IN_PROGRESS',journal:path.join(work,'smoke-journal.json')};save();
        const smoked=await runtime.submitInvoke({client,wallet,tx:invoke,expectedAccount:wallet.classicAddress,expectedHash:hashes[0],returnCode:contract.returnCode??'0',feeCap:cap,journal:path.join(work,'smoke-journal.json')});
        report.stages.smoke={result:'PASS',hash:smoked.hash};save();
        report.stages.readback={result:'IN_PROGRESS'};save();
        const state=await snapshot(config,wallet.classicAddress,contract.namespace,async(method,params)=>({result:(await client.request({command:method,...params})).result}));
        fs.writeFileSync(path.join(work,'state.json'),JSON.stringify(state,null,2)+'\n',{encoding:'utf8',flag:'wx'});
        const receiptLedger=Number(smoked.receipt.ledger_index);if(!Number.isSafeInteger(receiptLedger)||state.ledgerIndex<receiptLedger)throw new Error('Readback predates validated smoke transaction');
        for(const expected of contract.readback)if(!state.entries.some(e=>e.HookStateKey.toUpperCase()===expected.key.toUpperCase()&&e.HookStateData.toUpperCase()===expected.hex.toUpperCase()))throw new Error('Expected state key/value not found in validated readback');
        report.stages.readback={result:'PASS',ledgerHash:state.ledgerHash,ledgerIndex:state.ledgerIndex,assertions:contract.readback.length};save();
      }finally{if(client.isConnected())await client.disconnect();}
    }
    report.result=a['--submit']?'VERIFIED_PROJECT_POSTCONDITIONS':'LOCAL_VALIDATION_ONLY';save();print({result:report.result,evidence:file});
  }
}catch(error){
  if(evidenceOwned){
    report.result='STOPPED';report.error=error.message;
    for(const stage of Object.values(report.stages))if(stage?.result==='IN_PROGRESS')stage.result='STOPPED_CHECK_EVIDENCE';
    report.recovery=[];
    for(const name of ['install-journal.json','smoke-journal.json']){
      const journal=path.join(work,name);
      if(fs.existsSync(journal)){try{const saved=jsonFile(journal);report.recovery.push({journal,stage:saved.stage,hash:saved.hash});}catch{report.recovery.push({journal,error:'Inspect journal manually'});}}
    }
    save();
  }
  process.stderr.write(JSON.stringify({error:error.message,evidence:file})+'\n');process.exitCode=1;
}
