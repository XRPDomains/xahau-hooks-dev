import fs from 'node:fs';
import crypto from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {args, integer, jsonFile, main, print, required} from './lib.mjs';
import {guardResult} from './guard.mjs';
main(() => {
  const a = args(process.argv.slice(2), ['--wasm', '--policy', '--guard'], ['--help']);
  if (a['--help']) return print({usage:'node inspect-artifact.mjs --wasm final.wasm [--policy policy.json] [--guard /path/to/guard_checker]',
    exitCodes:{0:'Structural policy passed; inspect guard stage separately',1:'Invalid artifact/policy or guard failure',2:'Policy not configured'},
    note:'External checker receives the artifact path as its sole argument. No shell, no custom flags. Does not measure nesting/stack/instruction count.'});
  const artifact = required(a['--wasm'], '--wasm');
  const bytes = fs.readFileSync(artifact);
  const module = new WebAssembly.Module(bytes);
  const imports = WebAssembly.Module.imports(module).map(x => `${x.module}.${x.name}:${x.kind}`).sort();
  const exports = WebAssembly.Module.exports(module).map(x => `${x.name}:${x.kind}`).sort();
  const report = {bytes:bytes.length, sha256:crypto.createHash('sha256').update(bytes).digest('hex'),
    wasmValid:true, imports, exports, structure:'NOT_CONFIGURED', guard:'NOT_RUN'};
  if (a['--policy']) {
    const p = jsonFile(a['--policy']);
    integer(p.maxBytes, 1, 64 * 1024 * 1024, 'maxBytes');
    for (const k of ['allowedImports', 'requiredImports', 'allowedExports', 'requiredExports']) {
      if (!Array.isArray(p[k]) || p[k].some(x => typeof x !== 'string')) throw new Error(`Invalid ${k}`);
    }
    const failures = [];
    if (bytes.length > p.maxBytes) failures.push('Byte budget exceeded');
    for (const [actual, allowed, requiredValues, label] of [
      [imports,p.allowedImports,p.requiredImports,'import'],[exports,p.allowedExports,p.requiredExports,'export']]) {
      for (const x of actual) if (!allowed.includes(x)) failures.push(`Unexpected ${label}: ${x}`);
      for (const x of requiredValues) if (!actual.includes(x)) failures.push(`Missing ${label}: ${x}`);
    }
    report.structure = failures.length ? 'FAIL' : 'PASS'; report.failures = failures;
    if (failures.length) { print(report); process.exitCode = 1; return; }
  }
  if (a['--guard']) {
    const r = spawnSync(a['--guard'], [artifact], {encoding:'utf8', shell:false, timeout:30000, maxBuffer:4*1024*1024});
    report.guard = guardResult(r,a['--guard']);
    if (report.guard.result !== 'PASS') process.exitCode = 1;
  }
  print(report);
  if (report.structure === 'NOT_CONFIGURED' && !process.exitCode) process.exitCode = 2;
});
