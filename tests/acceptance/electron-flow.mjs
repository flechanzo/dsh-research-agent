import {isolatedContext} from './isolated-context.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {_electron as electron} from 'playwright';
const c=isolatedContext();
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
env.DSH_HOME=c.home;
env.DSH_DESKTOP_UPDATE_JOURNAL_DIR=path.join(c.root,'update-journal');
let app;
const log=[];
const record=(...items)=>{const line=items.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');log.push(line);console.log(line);};
try {
 app=await electron.launch({executablePath:'F:/deepseek/DeepSeek Harness.exe',args:['--user-data-dir='+c.userData],env,cwd:c.workspace,timeout:45000});
 const identity=await app.evaluate(({app})=>({version:app.getVersion(),userData:app.getPath('userData'),appPath:app.getAppPath()}));
 assert.equal(path.resolve(identity.userData),path.resolve(c.userData));
 assert.match(identity.appPath,/F:[\\/]deepseek[\\/]resources[\\/]app.asar/);
 fs.writeFileSync(path.join(c.evidence,'electron-identity.json'),JSON.stringify(identity,null,2));record('IDENTITY',identity);
 const page=await app.firstWindow();
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.locator('[data-composer-input=true][contenteditable=true]').waitFor({timeout:60000});
 const preview=page.getByRole('button',{name:'继续',exact:true});if(await preview.isVisible())await preview.click();
 for(let attempt=0;attempt<4;attempt++) {
  const option=page.getByText('自动科研',{exact:true});
  if(!await option.isVisible())await page.getByTitle('选择新任务使用的 Agent 预设').click();
  try {await option.click({timeout:4000});break;}catch(error){if(attempt===3)throw error;}
 }
 const input=page.locator('[data-composer-input=true][contenteditable=true]');
 await input.fill('隔离最终验收：只输出合成响应，不执行工具。');await input.press('Enter');
 await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});record('MOCK CHAT PASSED',page.url());
 await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();
 const panel=page.locator('[data-research-panel]');await panel.waitFor();
 await page.waitForFunction(()=>document.querySelector('[data-research-panel]')?.getAttribute('aria-busy')==='false');
 await panel.locator('input[type=file]').setInputFiles({name:'synthetic-paper.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic paper: reproducible calibration under distribution shift. Method: least squares. Baseline: linear regression. Metric: mean squared error. All data is synthetic.')});
 await panel.locator('[data-research-node-detail="node-2"]').waitFor({timeout:30000});record('UPLOAD PASSED');
 for(let i=0;i<12;i++) {
  await page.waitForFunction(()=>document.querySelector('[data-research-panel]')?.getAttribute('aria-busy')==='false');
  const before=await panel.getAttribute('data-research-selected-node');record('STAGE',i,(await panel.innerText()).slice(-1700));
  const write=panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true});
  if(await write.count()) {await write.click();await panel.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});break;}
  await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
  await page.waitForFunction(old=>{const p=document.querySelector('[data-research-panel]');return p?.getAttribute('aria-busy')==='false'&&(p.getAttribute('data-research-selected-node')!==old||p.querySelector('[role=alert]'));},before,{timeout:60000});
  if(await panel.locator('[role=alert]').count())throw new Error(await panel.locator('[role=alert]').innerText());
 }
 assert.match(await panel.innerText(),/科研方案已写入文件：/);
 const plans=fs.readdirSync(c.workspace,{recursive:true}).filter(p=>String(p).endsWith('research-plan.md'));
 assert.equal(plans.length,1);const planPath=path.resolve(c.workspace,plans[0]);assert.ok(planPath.startsWith(path.resolve(c.workspace)+path.sep));assert.ok(fs.statSync(planPath).size>100);
 record('PLAN',planPath,'BYTES',fs.statSync(planPath).size);assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(c.evidence,'electron-completed.png')});
 fs.writeFileSync(path.join(c.evidence,'electron-session-url.txt'),page.url());
 record('PASS formal installed Electron, mock model and literature, isolated workspace');
} catch(error) {record('FAIL',error.stack);process.exitCode=1;} finally {if(app)await app.close();fs.writeFileSync(path.join(c.evidence,'electron-flow.log'),log.join('\n')+'\n');}
