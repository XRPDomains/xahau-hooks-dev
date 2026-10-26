import {Wallet,isValidClassicAddress} from 'xahau';
// Prefix selects the encoded seed family; Wallet validates its checksum/format.
// secp256k1 seeds have more prefixes than just "ss". Never use masterAddress to
// conceal a derivation mismatch; require the actual key-derived address to match.
export function loadWallet(secret,address){
  if(typeof secret!=='string'||!secret.startsWith('s'))throw new Error('Invalid testnet seed');
  let wallet;
  try{wallet=Wallet.fromSeed(secret,{algorithm:secret.startsWith('sEd')?'ed25519':'ecdsa-secp256k1'});}
  catch{throw new Error('Invalid testnet seed');}
  if(address!==undefined&&(!isValidClassicAddress(address)||wallet.classicAddress!==address))throw new Error('Seed-derived address does not match the expected account; check the signing algorithm and faucet address');
  return wallet;
}
