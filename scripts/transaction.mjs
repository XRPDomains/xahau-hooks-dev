export function summarize(body) {
  const r=body.result ?? body;
  if (r.error) throw new Error(`RPC error: ${r.error}`);
  const meta=r.meta ?? r.metaData;
  if (!meta || typeof meta !== 'object') throw new Error('Transaction metadata object required');
  if (typeof meta.TransactionResult !== 'string') throw new Error('Missing TransactionResult');
  const executions=meta.HookExecutions ?? [];
  if (!Array.isArray(executions)) throw new Error('Invalid HookExecutions');
  const hooks=executions.map(item => {
    const e=item.HookExecution;
    if (!e || typeof e !== 'object') throw new Error('Invalid HookExecution');
    const raw=e.HookReturnString;
    return {account:e.HookAccount,hash:e.HookHash,result:e.HookResult,returnCode:e.HookReturnCode,
      returnString:typeof raw === 'string' && /^(?:[0-9a-fA-F]{2})*$/.test(raw) ? Buffer.from(raw,'hex').toString('utf8').replace(/\0+$/,'') : undefined,
      returnStringRaw:raw};
  });
  return {hash:r.hash ?? r.tx_json?.hash,validated:r.validated === true,ledgerIndex:r.ledger_index,
    transactionResult:meta.TransactionResult,hooks,
    stage:r.validated !== true ? 'NOT_VALIDATED' : hooks.length ? 'HOOK_EXECUTIONS_PRESENT' : 'NO_HOOK_EXECUTION',
    businessCompletion:'NOT_INFERRED'};
}
