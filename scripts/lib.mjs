import fs from 'node:fs';
export function args(argv, valued = [], flags = []) {
  const out = {};
  for (let i = 0; i < argv.length; ++i) {
    const key = argv[i];
    if (Object.hasOwn(out, key)) throw new Error(`Duplicate option: ${key}`);
    if (flags.includes(key)) out[key] = true;
    else if (valued.includes(key)) {
      if (!argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error(`Missing value: ${key}`);
      out[key] = argv[++i];
    } else throw new Error(`Unknown option: ${key}`);
  }
  return out;
}
export function jsonFile(p){
  const bytes=fs.readFileSync(p);let text;
  if(bytes[0]===0xFF&&bytes[1]===0xFE)text=bytes.subarray(2).toString('utf16le');
  else if(bytes[0]===0xFE&&bytes[1]===0xFF){const swapped=Buffer.from(bytes.subarray(2));if(swapped.length%2)throw new Error('Invalid UTF-16 JSON file');swapped.swap16();text=swapped.toString('utf16le');}
  else text=bytes.toString('utf8');
  return JSON.parse(text.replace(/^\uFEFF/,''));
}
export function writeJSON(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n',{encoding:'utf8',flag:'wx'});}
export function required(value, label) {
  if (value === undefined || value === '') throw new Error(`Required: ${label}`);
  return value;
}
export function hex(value, bytes, label = 'hex') {
  if (typeof value !== 'string' || !/^(?:[0-9a-fA-F]{2})*$/.test(value) ||
      (bytes !== undefined && value.length !== bytes * 2)) throw new Error(`Invalid ${label}`);
  return Buffer.from(value, 'hex');
}
export function integer(value, min, max, label) {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`Invalid ${label}`);
  return value;
}
export function main(fn) {
  Promise.resolve().then(fn).catch(error => {
    process.stderr.write(JSON.stringify({error: error.message}) + '\n'); process.exitCode = 1;
  });
}
export const print = (x,out) => {if(out)writeJSON(out,x);process.stdout.write(JSON.stringify(x,null,2)+'\n');};
