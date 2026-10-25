import {hex, integer} from './lib.mjs';
export function decode(layout, input) {
  integer(layout.length, 1, 1024*1024, 'layout length');
  const data = typeof input === 'string' ? hex(input, layout.length, 'state bytes') : input;
  if (!Buffer.isBuffer(data) || data.length !== layout.length) throw new Error('State length mismatch');
  if (!Array.isArray(layout.fields) || !layout.fields.length) throw new Error('Missing layout fields');
  const occupied = new Uint8Array(layout.length), seen = new Set(), output = {};
  const widths = {u8:1, u32be:4, u64be:8};
  for (const f of layout.fields) {
    if (typeof f.name !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(f.name) || seen.has(f.name)) throw new Error('Invalid or duplicate field name');
    seen.add(f.name);
    const length = f.type === 'bytes' ? integer(f.length,1,layout.length,'field length') : widths[f.type];
    if (!length) throw new Error(`Unsupported type: ${f.type}`);
    integer(f.offset,0,layout.length-1,'field offset');
    if (length > layout.length-f.offset) throw new Error('Field out of bounds');
    for (let i=f.offset;i<f.offset+length;++i) {
      if (occupied[i]) throw new Error('Overlapping layout fields'); occupied[i]=1;
    }
    output[f.name] = f.type === 'bytes' ? data.subarray(f.offset,f.offset+length).toString('hex').toUpperCase() :
      f.type === 'u8' ? data[f.offset] : f.type === 'u32be' ? data.readUInt32BE(f.offset) : data.readBigUInt64BE(f.offset).toString();
  }
  if (occupied.includes(0)) throw new Error('Layout has gaps; represent reserved bytes explicitly');
  return output;
}
