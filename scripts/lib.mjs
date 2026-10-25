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
export const jsonFile = p => JSON.parse(fs.readFileSync(p, 'utf8'));
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
export const print = x => process.stdout.write(JSON.stringify(x, null, 2) + '\n');
