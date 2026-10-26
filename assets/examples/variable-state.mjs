import {hex} from '../../scripts/lib.mjs';
// Example protocol: version:u8, UTF-8 byte count:u16 BE, payload:1..200 bytes.
export function encodeText(text){
  if(typeof text!=='string')throw new Error('Expected text');
  const bytes=Buffer.from(text,'utf8');
  if(new TextDecoder('utf-8',{fatal:true}).decode(bytes)!==text)throw new Error('Invalid Unicode input');
  if(bytes.length<1||bytes.length>200)throw new Error('Text must be 1..200 UTF-8 bytes');
  const out=Buffer.alloc(3+bytes.length);out[0]=1;out.writeUInt16BE(bytes.length,1);bytes.copy(out,3);return out;
}
export function decodeText(valueHex){
  const bytes=hex(valueHex,undefined,'state hex');
  if(bytes.length<4||bytes[0]!==1)throw new Error('Unknown version or truncated state');
  const length=bytes.readUInt16BE(1);
  if(length<1||length>200||bytes.length!==3+length)throw new Error('Invalid payload length or trailing bytes');
  return {version:1,byteLength:length,text:new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(3))};
}
// Fixed-width key, no hash: SLK1 + lower-case ASCII label + zero padding to 32 bytes.
export function labelKey(label){
  if(typeof label!=='string'||!/^[a-z0-9-]{1,28}$/.test(label))throw new Error('Label must be 1..28 lower-case ASCII letters, digits or hyphens');
  const key=Buffer.alloc(32);key.write('SLK1');key.write(label,4,'ascii');return key;
}
