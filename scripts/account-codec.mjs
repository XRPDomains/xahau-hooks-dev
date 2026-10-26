import crypto from 'node:crypto';
// Classic XRPL/Xahau AccountID: version 0 + 20 bytes + SHA256d checksum.
const alphabet='rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz';
const checksum=bytes=>crypto.createHash('sha256').update(crypto.createHash('sha256').update(bytes).digest()).digest().subarray(0,4);
export function decodeAccount(address){
  if(typeof address!=='string'||address.length<25||address.length>35)throw new Error('Invalid classic address');
  let n=0n;for(const c of address){const i=alphabet.indexOf(c);if(i<0)throw new Error('Invalid classic address');n=n*58n+BigInt(i);}
  let hex=n.toString(16);if(hex.length%2)hex='0'+hex;let bytes=n===0n?Buffer.alloc(0):Buffer.from(hex,'hex');
  let zeros=0;while(address[zeros]===alphabet[0])++zeros;bytes=Buffer.concat([Buffer.alloc(zeros),bytes]);
  if(bytes.length!==25||bytes[0]!==0||!checksum(bytes.subarray(0,21)).equals(bytes.subarray(21)))throw new Error('Invalid classic address checksum/version');
  return bytes.subarray(1,21);
}
export function encodeAccount(account){
  const bytes=Buffer.from(account);if(bytes.length!==20)throw new Error('AccountID must be 20 bytes');
  const payload=Buffer.concat([Buffer.from([0]),bytes]),full=Buffer.concat([payload,checksum(payload)]);
  let n=BigInt('0x'+full.toString('hex')),out='';while(n){out=alphabet[Number(n%58n)]+out;n/=58n;}
  for(const byte of full){if(byte!==0)break;out=alphabet[0]+out;}return out;
}
