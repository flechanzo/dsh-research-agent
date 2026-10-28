import {isolatedContext} from './isolated-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
const c=isolatedContext();
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
env.DSH_HOME=c.home;
env.DSH_DESKTOP_UPDATE_JOURNAL_DIR=path.join(c.root,'update-journal');
const previousFiles=new Set(fs.readdirSync(c.workspace,{recursive:true}).map(String));
env.RESEARCH_ACCEPTANCE_TRACE=path.join(c.evidence,'model-routing.jsonl');
fs.writeFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'');
let app;
const log=[];
const record=(...items)=>{const line=items.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');log.push(line);console.log(line);};
try {
 app=await electron.launch({executablePath:'F:/deepseek/DeepSeek Harness.exe',args:['--no-sandbox','--user-data-dir='+c.userData],env,cwd:c.workspace,timeout:45000});
 const identity=await app.evaluate(({app})=>({version:app.getVersion(),userData:app.getPath('userData'),appPath:app.getAppPath()}));
 assert.equal(path.resolve(identity.userData),path.resolve(c.userData));
 assert.match(identity.appPath,/F:[\\/]deepseek[\\/]resources[\\/]app.asar/);
 fs.writeFileSync(path.join(c.evidence,'electron-identity.json'),JSON.stringify(identity,null,2));record('IDENTITY',identity);
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('[data-composer-input=true][contenteditable=true]').waitFor({timeout:60000});
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
 await input.fill('隔离最终验收：只输出合成响应，不执行工具。');await input.press('Enter');
 await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});record('MOCK CHAT PASSED',page.url());
 await selectModel('科研合成夹具 B');
 record('MODEL SWITCH A -> B');
 await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();
 const panel=page.locator('[data-research-panel]:visible').last();await panel.waitFor();
 await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false');
 await page.setViewportSize({width:900,height:760}); await panel.locator('input[type=file]').setInputFiles({name:'synthetic-paper.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic paper: reproducible calibration under distribution shift. Method: least squares. Baseline: linear regression. Metric: mean squared error. All data is synthetic.')});
 await panel.locator('[data-research-node-detail="node-2"]').waitFor({timeout:30000});record('UPLOAD PASSED'); await page.screenshot({path:path.join(c.evidence,'electron-running-rc5.png'),timeout:5000});
 for(let i=0;i<12;i++) {
  await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false');
  const before=await panel.getAttribute('data-research-selected-node');record('STAGE',i,before);
  const write=panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true});
  if(await write.count()) {await write.click();await panel.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});break;}
  await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
  await page.waitForFunction(old=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&(p.getAttribute('data-research-selected-node')!==old||p.querySelector('[role=alert]'));},before,{timeout:60000});
  if(await panel.locator('[role=alert]').count())throw new Error(await panel.locator('[role=alert]').innerText());
 }
 assert.match(await panel.innerText(),/科研方案已写入文件：/);
 const plans=fs.readdirSync(c.workspace,{recursive:true}).filter(p=>String(p).endsWith('research-plan.md')&&!previousFiles.has(String(p)));
 assert.equal(plans.length,1);const planPath=path.resolve(c.workspace,plans[0]);assert.ok(planPath.startsWith(path.resolve(c.workspace)+path.sep));assert.ok(fs.statSync(planPath).size>100);
 record('PLAN',planPath,'BYTES',fs.statSync(planPath).size);assert.deepEqual(errors,[]);
 record('PASS complete workflow with Mock services');
 const trace=fs.readFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'utf8').trim().split('\n').map(line=>JSON.parse(line));
 record('MODEL TRACE',trace);assert.equal(trace[0].model,'research-fixture');
 assert.ok(trace.slice(1).length>=8);assert.ok(trace.slice(1).every(row=>row.model==='research-fixture-b'));
 record('PASS F02 actual subagents inherit B; provider is Mock');
 const statePaths=fs.readdirSync(c.workspace,{recursive:true}).map(String).filter(p=>p.endsWith('research-state.json')&&!previousFiles.has(p));assert.equal(statePaths.length,1);
 const stateFile=path.join(c.workspace,statePaths[0]);const backup=stateFile+'.acceptance-backup';const sessionId=path.basename(path.dirname(stateFile));
 const row=()=>JSON.parse(fs.readFileSync(path.join(c.home,'storages/research.json'),'utf8')).tables.sessions[sessionId];
 await panel.locator('button[data-research-node="node-9"]').click();
 await page.waitForFunction(()=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&p.getAttribute('data-research-selected-node')==='node-9'});
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
 record('PASS F12 separate branch plan files preserve the first plan',branchPlans);
 await page.reload();
 await page.locator('[data-research-panel]:visible').last().waitFor({timeout:30000});
 await page.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});
 record('PASS F08 frontend reload restores committed plan');
 fs.writeFileSync(path.join(c.evidence,'electron-final-dom.txt'),await panel.innerText());
 try {await page.screenshot({path:path.join(c.evidence,'electron-completed.png'),timeout:5000});record('SCREENSHOT saved');}catch(error){record('SCREENSHOT unavailable',error.message.split('\n')[0]);}

 fs.writeFileSync(path.join(c.evidence,'electron-session-url.txt'),page.url());
 record('PASS formal installed Electron, mock model and literature, isolated workspace');
} catch(error) {record('FAIL',error.stack);if(app)record('FAIL BODY',await (await app.firstWindow()).locator('body').innerText());process.exitCode=1;} finally {if(app)await app.close();fs.writeFileSync(path.join(c.evidence,'electron-final.txt'),log.join('\n')+'\n');}
