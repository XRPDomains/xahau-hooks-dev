import fs from 'node:fs';
import path from 'node:path';
import {Client} from 'xahau';
import {args,required,jsonFile,hex,print,main} from '../../../scripts/lib.mjs';
import {loadWallet} from './wallet.mjs';
import {testnetConfig,validateGenericInvoke,submitInvoke,walletRecord} from './testnet-runtime.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--config','--tx','--expected-hook-account','--expected-hook-hash','--expected-return-code','--max-fee-drops','--journal','--wallet-cache','--out'],['--submit','--help']);
  if(a['--help'])return print({usage:'node submit-generic-invoke.mjs --config network.json --tx invoke.json --expected-hook-account rTarget --expected-hook-hash HEX64 [--expected-return-code HEX] [--submit --max-fee-drops LIMIT --journal new.json --wallet-cache private/testnet-wallet.json] [--out report.json]',note:'Arbitrary codec-valid unsigned Invoke payloads only, testnet 21338. Offline unless --submit. No Payment/SetHook, raw signed blobs, mainnet or automatic replay. Seed may alternatively come from XAHAU_TESTNET_SEED.'});
  const config=jsonFile(required(a['--config'],'--config'));testnetConfig(config);
  const tx=jsonFile(required(a['--tx'],'--tx')),expectedAccount=required(a['--expected-hook-account'],'--expected-hook-account'),expectedHash=required(a['--expected-hook-hash'],'--expected-hook-hash');
  hex(expectedHash,32,'expected hook hash');validateGenericInvoke(tx,expectedAccount);
  const returnCode=a['--expected-return-code']??'0';if(!/^[0-9a-fA-F]{1,16}$/.test(returnCode))throw new Error('Expected return code must be uint64 hex');
  if(!a['--submit'])return print({stage:'OFFLINE_REVIEW_ONLY',transaction:tx,expectedAccount,expectedHash,returnCode},a['--out']);
  const feeCap=required(a['--max-fee-drops'],'--max-fee-drops'),journal=required(a['--journal'],'--journal');
  if(!/^[1-9]\d*$/.test(feeCap))throw new Error('Fee cap must be positive drops');
  if(fs.existsSync(journal)||a['--out']&&(fs.existsSync(a['--out'])||path.resolve(a['--out'])===path.resolve(journal)))throw new Error('Journal/report must be separate new files; recover existing operations by hash');
  const cached=a['--wallet-cache']?walletRecord(a['--wallet-cache']):undefined;
  const seed=cached?.seed??required(process.env.XAHAU_TESTNET_SEED,'XAHAU_TESTNET_SEED or --wallet-cache');
  const wallet=loadWallet(seed,cached?.address??tx.Account);if(wallet.classicAddress!==tx.Account)throw new Error('Signer/account mismatch');
  const client=new Client(config.websocket,{connectionTimeout:6000,timeout:10000});
  try{await client.connect();const result=await submitInvoke({client,wallet,tx,expectedAccount,expectedHash,returnCode,feeCap,journal});print({stage:'VALIDATED_REVIEW_READBACK',hash:result.hash,feeDrops:result.feeDrops,journal},a['--out']);}
  finally{if(client.isConnected())await client.disconnect();}
});
