export function guardResult(result, checker) {
  const log=(result.stdout ?? '')+(result.stderr ?? '');
  return {result:!result.error && result.status === 0 && log.includes('Hook validation successful!') ? 'PASS' : 'FAIL',
    checker,exitCode:result.status,error:result.error?.message,log};
}
