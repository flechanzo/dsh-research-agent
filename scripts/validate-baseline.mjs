import fs from 'node:fs';import path from 'node:path';import {spawn} from 'node:child_process';import {assertFreshBuild} from './build-provenance.mjs';
const c=JSON.parse(fs.readFileSync('.acceptance/desktop-baseline-20261102/context.json','utf8'));const suffix=process.argv[2]??'initial';assertFreshBuild();
async function check(name,args){const start=new Date();return await new Promise(resolve=>{const child=spawn(process.execPath,args,{cwd:process.cwd(),env:process.env,windowsHide:true});let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);child.on('error',e=>output+=e.stack);child.on('close',(code,signal)=>{const result={name,args,startedAt:start.toISOString(),endedAt:new Date().toISOString(),exitCode:code,signal,log:path.join(c.evidence,name+'-'+suffix+'.log')};fs.writeFileSync(result.log,output);console.log(name,'exit',code,output.slice(-1800));resolve(result);});});}
const results=await Promise.all([
 (async()=>[await check('typecheck-host',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/research-agent/tsconfig.host.json']),await check('typecheck-client',['node_modules/typescript/bin/tsc','--noEmit','-p','packages/research-agent/tsconfig.client.json'])])(),
 check('lint',['node_modules/oxlint/bin/oxlint','--type-aware','--tsconfig','tsconfig.lint.json','packages/research-agent/src']),
 check('vitest',['node_modules/vitest/vitest.mjs','run','--reporter=default','--reporter=json','--outputFile.json='+path.join(c.evidence,'vitest-'+suffix+'.json')])
]);
fs.writeFileSync(path.join(c.evidence,'checks-'+suffix+'.json'),JSON.stringify(results.flat(),null,2));if(results.flat().some(r=>r.exitCode!==0))process.exitCode=1;
