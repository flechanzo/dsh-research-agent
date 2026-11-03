import {assertFreshBuild} from '../../scripts/build-provenance.mjs';
const buildManifest=assertFreshBuild();
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
const c=JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT??'.acceptance/desktop-baseline-20261102/context.json','utf8'));
c.evidence=path.join(c.evidence,process.argv[2]??'workflow-rerun');fs.mkdirSync(c.evidence,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&!/^DSH_/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
env.DSH_HOME=c.home;
env.DSH_DESKTOP_UPDATE_JOURNAL_DIR=path.join(c.root,'update-journal');
const previousFiles=new Set(fs.readdirSync(c.workspace,{recursive:true}).map(String));
env.RESEARCH_ACCEPTANCE_TRACE=path.join(c.evidence,'model-routing.jsonl');
fs.writeFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'');
env.RESEARCH_MODEL_RESOLUTION_TRACE=path.join(c.evidence,'model-resolution.jsonl');
let app;
const log=[];
const record=(...items)=>{const line=items.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');log.push(line);console.log(line);};
try {
 app=await electron.launch({executablePath:c.executable,args:['--user-data-dir='+c.userData],env,cwd:c.workspace,timeout:45000});
 app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(c.evidence,'desktop-stdout.log'),b));
 app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(c.evidence,'desktop-stderr.log'),b));
 const identity=await app.evaluate(({app})=>({version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,exe:process.execPath,pid:process.pid,home:process.env.DSH_HOME,userData:app.getPath('userData'),appPath:app.getAppPath()}));
 assert.equal(path.resolve(identity.userData),path.resolve(c.userData));
 assert.equal(path.resolve(identity.appPath),path.resolve(c.desktopRoot,'resources/app.asar'));
 assert.equal(identity.version,c.targetVersion);
 assert.equal(path.resolve(identity.exe),path.resolve(c.executable));
 fs.writeFileSync(path.join(c.evidence,'tested-build-manifest.json'),JSON.stringify(buildManifest,null,2));
 fs.writeFileSync(path.join(c.evidence,'electron-identity.json'),JSON.stringify(identity,null,2));record('IDENTITY',identity);
 const pluginPath=fs.realpathSync(path.join(c.profile,'node_modules/dsh-research-agent'));
 assert.equal(pluginPath,fs.realpathSync('packages/research-agent'));
 fs.writeFileSync(path.join(c.evidence,'plugin-source-link.json'),JSON.stringify({pluginPath,sourceSha256:buildManifest.sourceSha256,artifacts:buildManifest.artifacts},null,2));
 const page=await app.firstWindow();
 await page.locator('body').waitFor();
 fs.writeFileSync(path.join(c.evidence,'native-controls.json'),JSON.stringify(await page.locator('button').evaluateAll(bs=>bs.map(b=>({text:b.innerText,title:b.title,aria:b.getAttribute('aria-label')}))),null,2));
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('[data-composer-input=true][contenteditable=true]').waitFor({timeout:60000});
 fs.writeFileSync(path.join(c.evidence,'native-controls-ready.json'),JSON.stringify(await page.locator('button').evaluateAll(bs=>bs.map(b=>({text:b.innerText,title:b.title,aria:b.getAttribute('aria-label')}))),null,2));
 await page.getByText('新会话',{exact:true}).first().click();
 await page.getByTitle('选择新任务使用的 Agent 预设').waitFor({timeout:15000});
 const preview=page.getByRole('button',{name:'继续',exact:true});if(await preview.isVisible())await preview.click();
 for(let attempt=0;attempt<4;attempt++) {
  const option=page.getByText('自动科研',{exact:true});
  if(!await option.isVisible())await page.getByTitle('选择新任务使用的 Agent 预设').click();
  try {await option.click({timeout:4000});break;}catch(error){if(attempt===3)throw error;}
 }
 const selectModel=async(label)=>{
  const current=page.getByText(/科研合成夹具 [AB]/,{exact:true}).last();
  const currentLabel=await current.innerText();
  if(currentLabel===label)return;
  await current.click();
  await page.getByText(currentLabel,{exact:true}).last().click();
  await page.getByText(label,{exact:true}).last().click();
  await page.getByText(label,{exact:true}).waitFor();
 };
 await selectModel('科研合成夹具 A');
 const input=page.locator('[data-composer-input=true][contenteditable=true]');
 const taskTitle='DSH科研验收-'+(process.argv[2]??'workflow');
 await input.fill(taskTitle);await input.press('Enter');
 await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});record('MOCK CHAT PASSED',page.url());
 await selectModel('科研合成夹具 B');
 record('MODEL SWITCH A -> B');
 await page.screenshot({path:path.join(c.evidence,'native-model-B.png'),timeout:15000});
 await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();
 const panel=page.locator('[data-research-panel]:visible').last();await panel.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false');
 await panel.locator('input[type=file]').setInputFiles({name:'synthetic-paper.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic paper: reproducible calibration under distribution shift. Method: least squares. Baseline: linear regression. Metric: mean squared error. All data is synthetic.')});
 await panel.locator('[data-research-node-detail="node-2"]').waitFor({timeout:30000});record('UPLOAD PASSED');
 for(let i=0;i<12;i++) {
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false');
  const before=await panel.getAttribute('data-research-selected-node');record('STAGE',i,before);
  const write=panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true});
  if(await write.count()) {await write.click();await panel.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});break;}
  await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
  await page.waitForFunction(old=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&(p.getAttribute('data-research-selected-node')!==old||p.querySelector('[role=alert]'));},before,{timeout:60000});
  if(await panel.locator('[role=alert]').count()){
   const message=await panel.locator('[role=alert]').innerText();
   if(!message.includes('ReplaceFileW EIO'))throw new Error(message);
   record('ENVIRONMENT FAILURE recovered by frontend reload',message);
   await page.screenshot({path:path.join(c.evidence,'filesystem-error-stage-'+i+'.png'),timeout:10000});
   await page.reload();await panel.waitFor();
  }
 }
 assert.match(await panel.innerText(),/科研方案已写入文件：/);
 await page.screenshot({path:path.join(c.evidence,'research-plan-first.png'),timeout:15000});
 const plans=fs.readdirSync(c.workspace,{recursive:true}).filter(p=>String(p).endsWith('research-plan.md')&&!previousFiles.has(String(p)));
 assert.equal(plans.length,1);const planPath=path.resolve(c.workspace,plans[0]);assert.ok(planPath.startsWith(path.resolve(c.workspace)+path.sep));assert.ok(fs.statSync(planPath).size>100);
 record('PLAN',planPath,'BYTES',fs.statSync(planPath).size);assert.deepEqual(errors,[]);
 record('PASS complete workflow with Mock services');
 const trace=fs.readFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 record('MODEL TRACE',trace);assert.equal(trace[0].model,'research-fixture');
 assert.ok(trace.slice(1).length>=8);assert.ok(trace.slice(1).every(row=>row.model==='research-fixture-b'));
 assert.ok(trace.slice(1).every(row=>row.reasoningEffort==='fixture-high'&&row.maxTokens===2048));
 record('PASS F02 actual subagents inherit B, B reasoning high, unconfigured maxTokens follows B default 2048 (A default was 768); provider is Mock');
 const statePaths=fs.readdirSync(c.workspace,{recursive:true}).map(String).filter(p=>p.endsWith('research-state.json')&&!previousFiles.has(p));assert.equal(statePaths.length,1);
 const stateFile=path.join(c.workspace,statePaths[0]);const backup=stateFile+'.acceptance-backup';const sessionId=path.basename(path.dirname(stateFile));
 const row=()=>JSON.parse(fs.readFileSync(path.join(c.researchData,'research.json'),'utf8')).tables.sessions[sessionId];
 fs.writeFileSync(path.join(c.evidence,'tested-session.json'),JSON.stringify({sessionId,taskTitle},null,2));
 await panel.locator('button[data-research-node="node-9"]').click();
 await page.waitForFunction(()=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&p.getAttribute('data-research-selected-node')==='node-9'});
 const originalNodes=structuredClone(row().state.nodes);
 const revision=row().revision;assert.ok(stateFile.startsWith(path.resolve(c.workspace)+path.sep));assert.ok(!fs.existsSync(backup));
 fs.renameSync(stateFile,backup);fs.mkdirSync(stateFile);
 try {
  await panel.getByRole('button',{name:'从这里继续（新分支）',exact:true}).click();
  await panel.getByRole('alert').waitFor({timeout:15000});
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false');
  assert.equal(row().revision,revision+1);assert.equal(await panel.getAttribute('data-research-selected-node'),row().state.selectedNodeId);
  record('PASS F01 commit survives real export filesystem failure and UI refreshes',revision,row().revision);
 } finally {fs.rmdirSync(stateFile);fs.renameSync(backup,stateFile);}
 const failedSelection=await panel.getAttribute('data-research-selected-node');
 await panel.getByRole('button',{name:'从这里继续（新分支）',exact:true}).click();
 await page.waitForFunction(old=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&p.getAttribute('data-research-selected-node')!==old;},failedSelection);
 assert.equal(row().revision,revision+2);assert.equal(await panel.locator('[role=alert]').count(),0);
 record('PASS F01 subsequent command succeeds without revision loop');
 const planHash=createHash('sha256').update(fs.readFileSync(planPath)).digest('hex');
 await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
 await panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true}).waitFor({timeout:30000});
 await panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true}).click();
 await panel.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});
 const branchPlans=fs.readdirSync(c.workspace,{recursive:true}).map(String).filter(p=>p.endsWith('research-plan.md')&&!previousFiles.has(p));
 assert.equal(branchPlans.length,2);
 assert.equal(createHash('sha256').update(fs.readFileSync(planPath)).digest('hex'),planHash);
 for(const [id,node] of Object.entries(originalNodes))assert.deepEqual(row().state.nodes[id],node);
 record('PASS historical nodes unchanged after continuation');
 for(const node of Object.values(row().state.nodes))assert.equal(new Set(node.artifactRefs).size,node.artifactRefs.length);
 record('PASS no duplicated per-node artifact references');
 record('PASS F12 separate branch plan files preserve the first plan',branchPlans);
 fs.writeFileSync(path.join(c.evidence,'persisted-row.json'),JSON.stringify(row(),null,2));
 const win=await app.browserWindow(page);
 await win.evaluate(w=>w.setSize(880,760));
 await page.screenshot({path:path.join(c.evidence,'research-narrow.png'),timeout:15000});
 await win.evaluate(w=>w.setSize(1440,960));
 await page.screenshot({path:path.join(c.evidence,'research-normal.png'),timeout:15000});
 await page.reload();
 await page.locator('[data-research-panel]:visible').last().waitFor({timeout:30000});
 await page.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});
 record('PASS F08 frontend reload restores committed plan');
 fs.writeFileSync(path.join(c.evidence,'electron-final-dom.txt'),await panel.innerText());
 try {await page.screenshot({path:path.join(c.evidence,'electron-completed.png'),timeout:5000});record('SCREENSHOT saved');}catch(error){record('SCREENSHOT unavailable',error.message.split('\n')[0]);}

 fs.writeFileSync(path.join(c.evidence,'electron-session-url.txt'),page.url());
 record('PASS formal installed Electron, mock model and literature, isolated workspace');
} catch(error) {record('FAIL',error.stack);if(app){const p=await app.firstWindow();record('FAIL BODY',await p.locator('body').innerText());await p.screenshot({path:path.join(c.evidence,'desktop-failure.png'),timeout:10000}).catch(()=>{});}process.exitCode=1;} finally {if(app)await Promise.race([app.close(),new Promise((_,reject)=>{const t=setTimeout(()=>reject(new Error('Desktop close timed out after 20s')),20000);t.unref()})]).catch(e=>{record('CLOSE FAILURE',String(e));process.exitCode=1;});fs.writeFileSync(path.join(c.evidence,'desktop-regression.log'),log.join('\n')+'\n');}
