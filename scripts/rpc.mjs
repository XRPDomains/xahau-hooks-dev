import {integer, hex} from './lib.mjs';
export async function snapshot(config, account, namespace) {
  const url = new URL(config.endpoint);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('An explicit HTTP(S) endpoint without embedded credentials is required');
  integer(config.networkId,0,0xFFFFFFFF,'networkId');
  const timeoutMs = integer(config.timeoutMs ?? 15000,100,60000,'timeoutMs');
  const maxPages = integer(config.maxPages ?? 100,1,10000,'maxPages');
  if (typeof account !== 'string' || !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(account)) throw new Error('Invalid account shape (checksum is verified by the node)');
  hex(namespace,32,'namespace');
  let count = 0;
  async function rpc(method, params = {}) {
    ++count;
    const response = await fetch(url, {method:'POST', headers:{'content-type':'application/json'},
      body:JSON.stringify({method,params:[params]}), signal:AbortSignal.timeout(timeoutMs)});
    if (!response.ok) throw new Error(`RPC HTTP ${response.status} during ${method}`);
    const body = await response.json(); const r = body.result;
    if (!r || r.error || r.status === 'error' || body.error) throw new Error(`RPC ${method}: ${r?.error ?? body.error?.code ?? 'invalid response'}`);
    return r;
  }
  const server = await rpc('server_info');
  if (server.info?.network_id !== config.networkId) throw new Error('Network ID missing or does not match configuration');
  const ledger = await rpc('ledger',{ledger_index:'validated',transactions:false,expand:false});
  const hash = ledger.ledger_hash ?? ledger.ledger?.ledger_hash;
  hex(hash,32,'validated ledger hash');
  if (ledger.validated !== true) throw new Error('Ledger response is not validated');
  const index = Number(ledger.ledger_index ?? ledger.ledger?.ledger_index);
  integer(index,1,Number.MAX_SAFE_INTEGER,'ledger index');
  const entries=[], keys=new Set(), markers=new Set(); let marker;
  for (let page=0;page<maxPages;++page) {
    const r = await rpc('account_namespace',{account,namespace_id:namespace.toUpperCase(),ledger_hash:hash,limit:200,...(marker === undefined ? {} : {marker})});
    if ((r.ledger_hash && r.ledger_hash.toUpperCase() !== hash.toUpperCase()) || r.validated === false ||
      (r.ledger_index !== undefined && Number(r.ledger_index) !== index)) throw new Error('Snapshot ledger mismatch');
    if (!Array.isArray(r.namespace_entries)) throw new Error('Missing namespace_entries');
    for (const entry of r.namespace_entries) {
      if (entry.LedgerEntryType !== 'HookState') throw new Error('Unexpected namespace entry type');
      const key = hex(entry.HookStateKey,32,'state key').toString('hex').toUpperCase();
      hex(entry.HookStateData,undefined,'state data');
      if (keys.has(key)) throw new Error('Duplicate state key across pages'); keys.add(key); entries.push(entry);
    }
    if (r.marker === undefined || r.marker === null) return {schemaVersion:1, networkId:config.networkId, account,
      namespace:namespace.toUpperCase(), ledgerHash:hash.toUpperCase(), ledgerIndex:index, requests:count, entries};
    marker=r.marker; const identity=JSON.stringify(marker);
    if(markers.has(identity)) throw new Error('Repeated pagination marker'); markers.add(identity);
  }
  throw new Error('Snapshot page limit reached');
}
