import {Client} from 'xahau';
import {args,required,jsonFile,print,main} from '../../../scripts/lib.mjs';
import {testnetConfig} from './testnet-runtime.mjs';
import {ensureWallet} from './testnet-funding.mjs';
main(async()=>{
  const a=args(process.argv.slice(2),['--config','--cache','--faucet','--out'],['--fund-testnet','--help']);
  if(a['--help'])return print({usage:'node setup-testnet-wallet.mjs --config network.json --cache private/testnet-wallet.json [--fund-testnet --faucet https://xahau-test.net/accounts] [--out public-wallet-report.json]',note:'Explicit testnet 21338 only. Generates/caches a local throwaway seed with mode 0600 where supported; never prints it. --fund-testnet authorizes bounded faucet funding of that cached address. Otherwise only wait for validated account existence.'});
  const config=jsonFile(required(a['--config'],'--config'));testnetConfig(config);
  const cache=required(a['--cache'],'--cache');
  if(a['--fund-testnet'])required(a['--faucet'],'--faucet');
  const client=new Client(config.websocket,{connectionTimeout:6000,timeout:10000});
  try{await client.connect();const {wallet,account,cached}=await ensureWallet({client,cache,fund:!!a['--fund-testnet'],faucet:a['--faucet']});print({stage:'ACCOUNT_VALIDATED',address:wallet.classicAddress,networkId:21338,balanceDrops:account.account_data.Balance,cached,cache,secret:'STORED_PRIVATELY_NOT_PRINTED'},a['--out']);}
  finally{if(client.isConnected())await client.disconnect();}
});
