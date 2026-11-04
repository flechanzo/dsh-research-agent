/** Fresh official Desktop profile for the ideation/Rubric regression. No user credentials or records. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import yaml from 'js-yaml';
import {prepareDesktopIsolation,verifyDesktopIsolation} from '../tests/acceptance/desktop-isolation.mjs';
import {assertFreshBuild} from './build-provenance.mjs';
const root=path.resolve('.acceptance/ideation-fix-20261104');
fs.mkdirSync(root,{recursive:true});
assert(!fs.existsSync(path.join(root,'context.json')),'Use a new validation directory for another run');
const manifest=assertFreshBuild();
const response=await fetch('https://download.deepseek.com/dsh-desk/feeds/win-x64/nightly.yml',{signal:AbortSignal.timeout(20000)});
assert(response.ok);const feedText=await response.text(),feed=yaml.load(feedText);
fs.writeFileSync(path.join(root,'nightly.yml'),feedText);
const desktopRoot=path.resolve('.acceptance/desktop-baseline-20261102/installer-unpacked');
const executable=path.join(desktopRoot,'DeepSeek Harness.exe');
const installer=fs.readFileSync('.acceptance/desktop-baseline-20261102/official-desktop-installer.exe');
assert.equal(createHash('sha512').update(installer).digest('base64'),feed.sha512);
const patch=[...['llm-deepseek','llm-deepseek-account','llm-pi-ai','llm-retry','session-title-llm','session-title-all-prompts-llm'].map(id=>({id,disabled:true})),
 {id:'ui-settings-account',config:{version:1,step:'done',completion:'api-key'}},
 {id:'agent-default-model',config:{provider:'research-mock',model:'research-fixture-b',reasoningEffort:'fixture-high'}},
 {id:'web',config:{fetchProvider:'research-rubric-public'}},
 {insert:[{id:'acceptance-runtime-isolation',name:path.resolve('tests/support/desktop-isolation-guard.mjs').replaceAll('\\','/')},
 {id:'acceptance-public-evidence',name:path.resolve('tests/support/rubric-evidence-desktop.mjs').replaceAll('\\','/')}]}];
const c=prepareDesktopIsolation({parent:root,executable,targetVersion:feed.version,patch});
c.desktopRoot=desktopRoot;
const file=path.join(c.profile,'cordis.patch.yml'),config=yaml.load(fs.readFileSync(file,'utf8'));
config.push({id:'research-agent-controller',config:{dataDirectory:c.researchData,innovationMode:'shadow',
 rubricModelRevision:'ideation-regression-mock-20261104',shadowMaxMilliseconds:300000,
 shadowMaxNetworkOperations:60,shadowMaxModelCalls:60}});
fs.writeFileSync(file,yaml.dump(config));
fs.writeFileSync(path.join(c.profile,'pnpm-workspace.yaml'),yaml.dump({packages:['.'],nodeLinker:'hoisted',autoInstallPeers:false}));
const prior=JSON.parse(fs.readFileSync('.acceptance/manual-20261103/context.json','utf8'));
const pdf=fs.readFileSync(path.join(prior.attachments,'DoRA-2402.09353v2-public.pdf'));
assert.equal(createHash('sha256').update(pdf).digest('hex'),'a1ebb6e59786a768bf0beea6352aa4ea81798b5de17b4089b54905d72c9d9dfe');
fs.writeFileSync(path.join(c.attachments,'DoRA-2402.09353v2-public.pdf'),pdf);
verifyDesktopIsolation(c);
fs.writeFileSync(path.join(root,'context.json'),JSON.stringify(c,null,2));
fs.writeFileSync(path.join(root,'build-manifest.json'),JSON.stringify(manifest,null,2));
fs.writeFileSync(path.join(root,'identity.json'),JSON.stringify({at:new Date().toISOString(),version:feed.version,
 sourceSha256:manifest.sourceSha256,installerFeedMatch:true,executable,
 exeSha256:createHash('sha256').update(fs.readFileSync(executable)).digest('hex')},null,2));
console.log(JSON.stringify(c,null,2));
