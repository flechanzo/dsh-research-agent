import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import yaml from 'js-yaml';import {_electron as electron} from 'playwright';import {assertFreshBuild} from '../../scripts/build-provenance.mjs';
const build=assertFreshBuild(),c=JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT??'.acceptance/rubric-evidence-20261102/context.json')),evidence=path.join(c.evidence,process.env.RESEARCH_RISK_EVIDENCE??'shadow-risk-host-cancel');fs.mkdirSync(evidence,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&!/^DSH_|^RESEARCH_/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
Object.assign(env,{DSH_HOME:c.home,DSH_DESKTOP_UPDATE_JOURNAL_DIR:path.join(c.root,'update-journal'),RESEARCH_CASE_SWITCH:path.join(c.root,'case-mode.txt'),RESEARCH_ACCEPTANCE_TRACE:path.join(evidence,'routing.jsonl'),RESEARCH_NETWORK_TRACE:path.join(evidence,'network.jsonl'),RESEARCH_NETWORK_BODIES:path.join(evidence,'bodies'),RESEARCH_OFFLINE_SWITCH:path.join(c.root,'offline.flag'),RESEARCH_BOUNDARY_TRACE:path.join(evidence,'boundary.json')});
let app,page,panel;
const results=[];const log=(name,value)=>{const record={at:new Date().toISOString(),name,value};results.push(record);console.log(JSON.stringify(record));fs.appendFileSync(path.join(evidence,'workflow.log'),JSON.stringify(record)+'\n')};
const screenshot=async name=>{const file=path.join(evidence,name);try{await page.screenshot({path:file,animations:'disabled',timeout:15000})}catch(error){log('screenshot-native-fallback',{name,error:String(error)});let timer;try{const data=await Promise.race([app.evaluate(async({BrowserWindow})=>{const w=BrowserWindow.getAllWindows().find(w=>w.isVisible());if(!w)throw Error('No visible official window');return(await w.capturePage()).toDataURL()}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Native capture deadline')),15000)})]);fs.writeFileSync(file,Buffer.from(data.split(',')[1],'base64'))}finally{clearTimeout(timer)}}};
const rows=()=>JSON.parse(fs.readFileSync(path.join(c.researchData,'research.json'))).tables.sessions;
const audits=sid=>Object.values(JSON.parse(fs.readFileSync(path.join(c.researchData,'research_shadow.json'))).tables.audits).filter(a=>a.sessionId===sid);
const wait=async(fn,timeout=30000)=>{const end=Date.now()+timeout;for(;;){if(await fn())return;if(Date.now()>end)throw Error('Acceptance condition timed out');await new Promise(resolve=>setTimeout(resolve,150))}};
const launch=async()=>{app=await electron.launch({executablePath:c.executable,args:['--user-data-dir='+c.userData],cwd:c.workspace,env,timeout:60000});app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(evidence,'stdout.log'),b));app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(evidence,'stderr.log'),b));const identity=await app.evaluate(({app})=>({desktop:app.getVersion(),exe:process.execPath,home:process.env.DSH_HOME,pid:process.pid}));assert.equal(identity.desktop,c.targetVersion);assert.equal(identity.home,c.home);assert.equal(path.resolve(identity.exe),path.resolve(c.executable));log('identity',identity);page=await app.firstWindow();await page.locator('[data-composer-input=true][contenteditable=true]').waitFor({timeout:60000})};
const idle=async()=>page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false',null,{timeout:180000});
const advance=async(allowFailure=false)=>{await idle();const before=await panel.getAttribute('data-research-selected-node');await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();await page.waitForFunction(old=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&(p.getAttribute('data-research-selected-node')!==old||p.querySelector('[role=alert]'))},before,{timeout:180000});if(!allowFailure&&await panel.locator('[role=alert]').count())throw Error(await panel.locator('[role=alert]').first().innerText())};
const newCandidate=async(label,mode)=>{
 fs.writeFileSync(env.RESEARCH_CASE_SWITCH,mode);
 const existing=new Set(Object.keys(rows()));
 const tabs=page.locator('[data-dockkit-tab]').filter({hasText:'自动科研流程'});while(await tabs.count())await tabs.last().locator('[data-dockkit-tab-close]').click();
 await page.getByText('新会话',{exact:true}).first().click();await page.getByTitle('选择新任务使用的 Agent 预设').click();await page.getByText('自动科研',{exact:true}).click();
 const input=page.locator('[data-composer-input=true][contenteditable=true]');await input.fill(label);await input.press('Enter');await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});
 await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();panel=page.locator('[data-research-panel]:visible').last();await panel.waitFor();await idle();
 await panel.locator('input[type=file]').setInputFiles(path.join(c.attachments,'DoRA-2402.09353v2-public.pdf'));await panel.locator('[data-research-node-detail="node-2"]').waitFor({timeout:60000});await idle();
 await advance();await advance();
 const editor=panel.locator('[data-target-task-editor]');await editor.getByLabel('具体任务或问题',{exact:true}).waitFor({timeout:45000});await editor.getByRole('checkbox',{name:'我已核对并确认目标任务及比较范围'}).check();
 const sid=Object.keys(rows()).find(id=>!existing.has(id));assert(sid);return sid;
};
const configFile=path.join(c.profile,'cordis.patch.yml'),originalConfig=fs.readFileSync(configFile,'utf8');
try{
 await launch();
 if(!process.env.RESEARCH_RISK_ONLY_CANCEL){
 const rejected=await newCandidate('Shadow三个旧拒绝-20261103','all-reject');const before=structuredClone(rows()[rejected]);
 await advance(true);assert.match(await panel.locator('[role=alert]').first().innerText(),/INNOVATION_SCORE_BELOW_THRESHOLD/);
 const rejectedAudits=audits(rejected);assert.equal(rejectedAudits.length,3);assert(rejectedAudits.every(a=>a.legacy.status==='reject'));assert(rejectedAudits.some(a=>a.assessment?.searchAudit.some(r=>r.completed)));assert.equal(rows()[rejected].revision,before.revision);assert.deepEqual(rows()[rejected].state,before.state);
 fs.writeFileSync(path.join(evidence,'all-rejected-audits.json'),JSON.stringify(rejectedAudits,null,2));await panel.locator('[data-shadow-audits] > summary').click();await screenshot('all-rejected.png');log('all-rejected',{sessionId:rejected,count:3,lifecycles:rejectedAudits.map(a=>a.lifecycle),revisionUnchanged:true});
 }
 const cancelled=await newCandidate('Shadow真实取消-20261103','delay-shadow');const cancelBefore=structuredClone(rows()[cancelled]);
 await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
 await wait(()=>fs.existsSync(env.RESEARCH_ACCEPTANCE_TRACE)&&fs.readFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'utf8').includes('waiting-shadow-cancellation'),30000);
 if(process.env.RESEARCH_CANCEL_BY_TAB==='true')await page.locator('[data-dockkit-tab]').filter({hasText:'自动科研流程'}).last().locator('[data-dockkit-tab-close]').click();
 else await panel.getByRole('button',{name:'取消当前科研任务',exact:true}).click();
 await wait(()=>audits(cancelled).some(a=>a.lifecycle==='cancelled'),30000);
 const cancelledAudits=audits(cancelled);assert.equal(cancelledAudits.length,1);assert.equal(cancelledAudits[0].legacy.status,'pass');assert.equal(cancelledAudits[0].assessment.score.S,null);assert.equal(rows()[cancelled].revision,cancelBefore.revision);
 fs.writeFileSync(path.join(evidence,'cancelled-audits.json'),JSON.stringify(cancelledAudits,null,2));await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();panel=page.locator('[data-research-panel]:visible').last();await idle();await screenshot('cancelled.png');log('user-cancelled',{sessionId:cancelled,oldPass:true,shadow:'cancelled',S:null,revisionUnchanged:true});
 await app.close();app=undefined;
 const patch=yaml.load(originalConfig);patch.find(p=>p.id==='research-agent-controller').config.shadowMaxMilliseconds=20;fs.writeFileSync(configFile,yaml.dump(patch));
 await launch();
 const timed=await newCandidate('Shadow真实超时-20261103','deadline-pass');await advance();const timedAudits=audits(timed);assert.equal(timedAudits.length,1);assert.equal(timedAudits[0].legacy.status,'pass');assert.equal(timedAudits[0].lifecycle,'budget-exhausted');assert.equal(timedAudits[0].assessment.score.S,null);
 fs.writeFileSync(path.join(evidence,'deadline-audits.json'),JSON.stringify(timedAudits,null,2));await screenshot('deadline-null.png');log('deadline',{sessionId:timed,oldPass:true,shadow:'budget-exhausted',S:null});
 fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({status:'passed',sourceSha256:build.sourceSha256,allRejected:process.env.RESEARCH_RISK_ONLY_CANCEL?null:true,legacyAttemptsPreserved:process.env.RESEARCH_RISK_ONLY_CANCEL?null:3,legacyDAGUnchangedOnFailure:process.env.RESEARCH_RISK_ONLY_CANCEL?null:true,userCancellationByExplicitNativePluginButton:process.env.RESEARCH_CANCEL_BY_TAB!=='true',userCancellationByTabClose:process.env.RESEARCH_CANCEL_BY_TAB==='true',deadlineDoesNotRejectLegacyPass:true,scientificScores:false,events:results},null,2));
}catch(e){log('failure',e.stack);process.exitCode=1;if(page){fs.writeFileSync(path.join(evidence,'failure-dom.txt'),await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{})}}
finally{if(app)await app.close().catch(e=>log('close-error',String(e)));fs.writeFileSync(configFile,originalConfig)}
