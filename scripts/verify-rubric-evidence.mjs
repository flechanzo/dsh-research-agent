import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const dir=path.resolve(process.argv[2]??'.acceptance/rubric-evidence-20261102/checks');fs.mkdirSync(dir,{recursive:true});
const commands=[
 ['typecheck',['scripts/verify-build.mjs']],
 ['host-types',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/research-agent/tsconfig.host.json']],
 ['client-types',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/research-agent/tsconfig.client.json']],
 ['strict-client',['node_modules/typescript/bin/tsc','--noEmit','--skipLibCheck','false','-p','packages/research-agent/tsconfig.client.json']],
 ['strict-host',['node_modules/typescript/bin/tsc','--noEmit','--skipLibCheck','false','-p','packages/research-agent/tsconfig.host.json']],
 ['lint',['node_modules/oxlint/bin/oxlint','--type-aware','--tsconfig','tsconfig.lint.json','packages/research-agent/src','--format','json']],
 ['tests',['node_modules/vitest/vitest.mjs','run','--reporter=dot','--reporter=json','--outputFile='+path.join(dir,'vitest.json')]]
];
const results=[];
for(const [name,args] of commands){const startedAt=new Date().toISOString();const r=spawnSync(process.execPath,args,{encoding:'utf8',windowsHide:true,maxBuffer:25e6});fs.writeFileSync(path.join(dir,name+'.log'),(r.stdout??'')+(r.stderr??''));const item={name,startedAt,status:r.status,error:r.error?String(r.error):null};results.push(item);console.log(JSON.stringify(item));}
fs.writeFileSync(path.join(dir,'result.json'),JSON.stringify(results,null,2));if(results.some(r=>r.name!=='strict-host'&&r.status!==0))process.exitCode=1;
