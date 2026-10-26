import {args, jsonFile, main, print, required} from './lib.mjs';
import {decode} from './layout.mjs';
main(() => {
  const a = args(process.argv.slice(2), ['--layout','--hex','--out'], ['--help']);
  if(a['--help']) return print({usage:'node decode-state.mjs --layout layout.json --hex HEX [--out decoded.json]', types:['bytes','u8','u32be','u64be'],note:'u64be is emitted as a decimal string; full fixed-length coverage is required.'});
  print(decode(jsonFile(required(a['--layout'],'--layout')), required(a['--hex'],'--hex')),a['--out']);
});
