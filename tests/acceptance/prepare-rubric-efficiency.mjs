/** Prepare all paths before the first official Desktop/CLI launch. No formal data copied. */
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import yaml from 'js-yaml';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {prepareDesktopIsolation,verifyDesktopIsolation,assertTestWrite} from './desktop-isolation.mjs';
import {openAsar} from '../../scripts/asar-reader.mjs';
const evidence=path.resolve('.acceptance/rubric-efficiency-20261103'),desktopRoot=path.resolve('.acceptance/desktop-baseline-20261102/installer-unpacked');
const executable=path.join(desktopRoot,'DeepSeek Harness.exe');
const feed=yaml.load(fs.readFileSync(path.join(evidence,'nightly.yml'),'utf8'));
const installer=fs.readFileSync('.acceptance/desktop-baseline-20261102/official-desktop-installer.exe');
assert.equal(createHash('sha512').update(installer).digest('base64'),feed.sha512,'Official feed differs from cached installer; obtain and verify new official archive');
const asar=openAsar(path.join(desktopRoot,'resources/app.asar')),app=JSON.parse(asar.read('package.json')),runtime=JSON.parse(asar.read('dsh/package.json'));asar.close();
assert.equal(app.version,feed.version);
const patch=[...['llm-deepseek','llm-deepseek-account','llm-pi-ai','session-title-llm','session-title-all-prompts-llm'].map(id=>({id,disabled:true})),
 {id:'ui-settings-account',config:{version:1,step:'done',completion:'api-key'}},
 {id:'agent-default-model',config:{provider:'research-mock',model:'research-fixture-b',reasoningEffort:'fixture-high'}},
 {id:'web',config:{fetchProvider:'research-rubric-public'}},
 {insert:[{id:'acceptance-runtime-isolation',name:path.resolve('tests/support/desktop-isolation-guard.mjs').replaceAll('\\','/')},
 {id:'acceptance-public-evidence',name:path.resolve('tests/support/rubric-evidence-desktop.mjs').replaceAll('\\','/')}]}];
const c=prepareDesktopIsolation({parent:os.tmpdir(),executable,targetVersion:feed.version,patch});c.desktopRoot=desktopRoot;
const config=yaml.load(fs.readFileSync(path.join(c.profile,'cordis.patch.yml'),'utf8'));
config.push({id:'research-agent-controller',config:{dataDirectory:c.researchData,innovationMode:'shadow',maxPdfPages:30,rubricModelRevision:'acceptance-mock-fixture-20261103',shadowMaxMilliseconds:180000,shadowMaxNetworkOperations:60,shadowMaxModelCalls:60,shadowMaxPromptCharacters:2000000,shadowMaxStageMilliseconds:60000,shadowMaxPdfPages:30,shadowMaxOcrPages:0}});
fs.writeFileSync(path.join(c.profile,'cordis.patch.yml'),yaml.dump(config));verifyDesktopIsolation(c);
const prior='C:/Users/destiny/AppData/Local/Temp/dsh-rubric-evidence-20261102-2ApRAQ/attachments/DoRA-2402.09353v2-public.pdf';
assert(fs.existsSync(prior),'Archived public test PDF missing');fs.copyFileSync(prior,assertTestWrite(c,path.join(c.attachments,path.basename(prior))));
fs.writeFileSync(path.join(evidence,'context.json'),JSON.stringify(c,null,2));
fs.writeFileSync(path.join(evidence,'official-desktop-identity.json'),JSON.stringify({observedAt:new Date().toISOString(),feed,desktop:app.version,runtime:runtime.version,channel:app.dshDesktopUpdateChannel,buildCommit:app.dshBuildCommit,exe:executable,exeSha256:createHash('sha256').update(fs.readFileSync(executable)).digest('hex'),asarSha256:createHash('sha256').update(fs.readFileSync(path.join(desktopRoot,'resources/app.asar'))).digest('hex'),installerSha512:feed.sha512,installerFeedMatch:true,publicPdfSha256:createHash('sha256').update(fs.readFileSync(prior)).digest('hex')},null,2));
console.log(JSON.stringify(c,null,2));
