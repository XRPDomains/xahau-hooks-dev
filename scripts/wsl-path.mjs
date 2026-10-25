import path from 'node:path';
export function wslPath(value){
  if(typeof value!=='string' || !/^[A-Za-z]:[\\/]/.test(value))throw new Error('WSL adapter requires absolute local drive paths');
  const resolved=path.win32.normalize(value);
  return '/mnt/'+resolved[0].toLowerCase()+resolved.slice(2).replaceAll('\\','/');
}
