import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
/** Read and validate this repository's already prepared private acceptance directories. */
export function isolatedContext(){
 const base=fs.realpathSync(path.resolve('.acceptance'));
 const c=JSON.parse(fs.readFileSync(path.join(base,'current.json'),'utf8'));
 for(const name of ['root','home','workspace','userData','evidence']){
  assert.equal(typeof c[name],'string',`missing isolated ${name}`);
  const real=fs.realpathSync(c[name]);
  assert.ok(real.startsWith(base+path.sep),`${name} must remain inside this repository's .acceptance`);
  if(name!=='root')assert.ok(real.startsWith(fs.realpathSync(c.root)+path.sep),`${name} must remain inside the current acceptance root`);
 }
 return c;
}
