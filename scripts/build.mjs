import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {filesIn,hashFile,sourceIdentity,sdkIdentity} from './build-provenance.mjs';
const root=process.cwd();
const buildRoot=path.join(root,'.build');fs.mkdirSync(buildRoot,{recursive:true});
const stage=fs.mkdtempSync(path.join(buildRoot,'stage-'));
const lib=path.join(root,'packages/research-agent/lib');
// Quarantine before any dependency or compiler check: a failed build exposes no old lib.
if(fs.existsSync(lib))fs.renameSync(lib,path.join(stage,'previous-lib'));
try{
 const identity=sourceIdentity(root),sdk=sdkIdentity(root);
 for(const name of ['package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','tsconfig.host.json','tsconfig.client.json'])fs.copyFileSync(path.join(root,name),path.join(stage,name));
 fs.cpSync(path.join(root,'scripts'),path.join(stage,'scripts'),{recursive:true});
 fs.mkdirSync(path.join(stage,'packages'),{recursive:true});
 fs.cpSync(path.join(root,'packages/research-agent'),path.join(stage,'packages/research-agent'),{recursive:true,filter:p=>!p.split(path.sep).includes('node_modules')});
 fs.symlinkSync(path.join(root,'node_modules'),path.join(stage,'node_modules'),'junction');
 execFileSync(process.execPath,[path.join(stage,'scripts/compile.mjs')],{cwd:stage,stdio:'inherit'});
 if(sourceIdentity(root).sourceSha256!==identity.sourceSha256)throw new Error('Source changed during build; refusing publication.');
 const built=path.join(stage,'packages/research-agent/lib');
 const artifacts=Object.fromEntries(filesIn(built).map(p=>[p,hashFile(path.join(built,p))]));
 const manifest={schemaVersion:1,...identity,sdk,pluginVersion:JSON.parse(fs.readFileSync(path.join(root,'packages/research-agent/package.json'),'utf8')).version,node:process.version,builtAt:new Date().toISOString(),artifacts};
 fs.writeFileSync(path.join(built,'build-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 fs.renameSync(built,lib);
 console.log('Published clean build',identity.sourceSha256,'staging:',stage);
}catch(error){console.error('Build failed; previous artifacts remain quarantined at',stage);throw error;}
