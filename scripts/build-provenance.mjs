import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
export const hashFile=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
export function filesIn(dir){return fs.readdirSync(dir,{recursive:true}).map(String).filter(p=>fs.statSync(path.join(dir,p)).isFile()).sort();}
export function sourceIdentity(root){
 const files=['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.host.json','tsconfig.client.json','scripts/build.mjs','scripts/compile.mjs','scripts/generate-protocol.mjs','scripts/prepare-protocol-sdk.mjs','scripts/build-provenance.mjs','scripts/verify-build.mjs',...filesIn(path.join(root,'packages/research-agent')).filter(p=>!p.startsWith('lib'+path.sep)&&!p.startsWith('node_modules'+path.sep)).map(p=>'packages/research-agent/'+p.replaceAll(path.sep,'/'))].sort();
 const inputs=Object.fromEntries(files.map(p=>[p,hashFile(path.join(root,p))]));
 const sourceSha256=createHash('sha256').update(JSON.stringify(inputs)).digest('hex');
 const commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 return {commit,sourceSha256,inputs};
}
export function sdkIdentity(root){
 const declared=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).dependencies;
 return Object.fromEntries(Object.keys(declared).filter(n=>n.startsWith('@deepseek-ai/')).sort().map(n=>{
  const actual=JSON.parse(fs.readFileSync(path.join(root,'node_modules',n,'package.json'),'utf8')).version;
  if(actual!==declared[n])throw new Error('SDK version mismatch: '+n+' '+actual+' != '+declared[n]);
  return [n,actual];
 }));
}
export function assertFreshBuild(root=process.cwd()){
 const lib=path.join(root,'packages/research-agent/lib');
 const manifest=JSON.parse(fs.readFileSync(path.join(lib,'build-manifest.json'),'utf8'));
 const identity=sourceIdentity(root);
 if(manifest.sourceSha256!==identity.sourceSha256||manifest.commit!==identity.commit)throw new Error('Stale build: run npm run build before checking or testing.');
 if(JSON.stringify(sdkIdentity(root))!==JSON.stringify(manifest.sdk))throw new Error('Installed SDK differs from the verified build.');
 const artifacts=filesIn(lib).filter(p=>p!=='build-manifest.json');
 if(JSON.stringify(artifacts)!==JSON.stringify(Object.keys(manifest.artifacts)))throw new Error('Build contains missing or unexpected files.');
 for(const file of artifacts)if(hashFile(path.join(lib,file))!==manifest.artifacts[file])throw new Error('Build hash mismatch: '+file);
 return manifest;
}
