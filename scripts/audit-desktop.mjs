import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {execFileSync} from 'node:child_process';import {openAsar} from './asar-reader.mjs';
const root=process.cwd(),run=path.join(root,'.acceptance/desktop-baseline-20261102');
const hash=p=>createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const installed='F:/deepseek',target=path.join(run,'installer-unpacked');
const identities={};
for(const [name,dir] of Object.entries({installed,target})){
 const asar=path.join(dir,'resources/app.asar'),a=openAsar(asar);
 const app=JSON.parse(a.read('package.json')),runtime=JSON.parse(a.read('dsh/package.json'));
 identities[name]={exe:path.join(dir,'DeepSeek Harness.exe'),exeSha256:hash(path.join(dir,'DeepSeek Harness.exe')),asar,asarSha256:hash(asar),desktop:app.version,runtime:runtime.version,electron:fs.readFileSync(path.join(dir,'version'),'utf8').trim(),channel:app.dshDesktopUpdateChannel,buildCommit:app.dshBuildCommit,buildDirty:app.dshBuildDirty,dependencies:runtime.dependencies};
 a.close();
}
const old=openAsar(identities.installed.asar),targetAsar=openAsar(identities.target.asar);
const changes=[];
for(const name of ['dsh-agent','dsh-subagent','dsh-agent-preset','dsh-api-gateway','dsh-api-session-controller','dsh-client-ui-sidebar-right','dsh-storage-domain','dsh-typert-protocol']){
 const prefix='dsh/node_modules/@deepseek-ai/'+name+'/';
 function walk(p){for(const f of targetAsar.list(p)){const q=p+'/'+f;if(targetAsar.isDirectory(q))walk(q);else if(q.endsWith('.d.ts')){let before;try{before=old.read(q);}catch{}const after=targetAsar.read(q);if(before!==after)changes.push({package:name,file:q,oldPresent:before!==undefined,oldSha256:before===undefined?null:createHash('sha256').update(before).digest('hex'),newSha256:createHash('sha256').update(after).digest('hex')});}}}
 walk(prefix+'lib/types');
}
old.close();targetAsar.close();
fs.writeFileSync(path.join(run,'desktop-version-audit.json'),JSON.stringify({observedAt:new Date().toISOString(),commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),...identities,declarationComparisonAvailable:false,declarationNote:"Desktop omits SDK .d.ts; do not interpret an empty list as API equality. Registry SDK declarations are checked separately.",typeDeclarationChanges:changes},null,2));
const c={root:run,desktopRoot:target,executable:identities.target.exe,targetVersion:identities.target.desktop,home:path.join(run,'home'),profile:path.join(run,'home/profiles/desktop'),workspace:path.join(run,'workspace'),researchData:path.join(run,'research-data'),attachments:path.join(run,'attachments'),userData:path.join(run,'electron-user'),evidence:path.join(run,'evidence')};
for(const p of [c.home,c.profile,c.workspace,c.researchData,c.attachments,c.userData,c.evidence])fs.mkdirSync(p,{recursive:true});
fs.writeFileSync(path.join(run,'context.json'),JSON.stringify(c,null,2));
console.log(JSON.stringify({installed:{...identities.installed,dependencies:undefined},target:{...identities.target,dependencies:undefined},typeDeclarationChanges:changes},null,2));
