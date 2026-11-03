
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {_electron as electron} from 'playwright';import {assertFreshBuild} from '../../scripts/build-provenance.mjs';
const build=assertFreshBuild(),c=JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT,'utf8'));
const evidence=path.join(c.evidence,process.argv[2]??'ui');fs.mkdirSync(evidence,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&!/^DSH_|^RESEARCH_/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
Object.assign(env,{DSH_HOME:c.home,DSH_DESKTOP_UPDATE_JOURNAL_DIR:path.join(c.root,'update-journal'),RESEARCH_ACCEPTANCE_TRACE:path.join(evidence,'routing.jsonl')});
let app,page,panel;const events=[];
const record=(name,data)=>{events.push({name,data});console.log(name,JSON.stringify(data??null));fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(events,null,2))};
const idle=()=>page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false',null,{timeout:90000});
const launch=async()=>{
 app=await electron.launch({executablePath:c.executable,args:['--user-data-dir='+c.userData],env,cwd:c.workspace,timeout:60000});
 app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(evidence,'stdout.log'),b));app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(evidence,'stderr.log'),b));
 const id=await app.evaluate(({app})=>({version:app.getVersion(),exe:process.execPath,home:process.env.DSH_HOME,userData:app.getPath('userData'),node:process.versions.node,electron:process.versions.electron}));
 assert.equal(id.version,c.targetVersion);assert.equal(path.resolve(id.home),path.resolve(c.home));record('official-identity',id);
 page=await app.firstWindow();await page.locator('[data-composer-input=true][contenteditable=true]').waitFor({timeout:60000});
};
const open=async()=>{panel=page.locator('[data-research-panel]:visible').last();if(!await panel.count())await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();await panel.waitFor();await idle()};
const screenshot=async(name,width=1440)=>{
 const window=await app.browserWindow(page);await window.evaluate((w,size)=>{w.setSize(size,960);w.show();w.focus()},width);
 await panel.evaluate(el=>{el.scrollTop=0});await page.waitForTimeout(800);
 try {await page.screenshot({path:path.join(evidence,name+'.png'),timeout:20000,animations:'disabled'})} catch(error) {record('screenshot-retry',error.message);await page.screenshot({path:path.join(evidence,name+'.png'),timeout:20000,animations:'disabled'})}
 const layout=await panel.evaluate(el=>({width:el.clientWidth,scrollWidth:el.scrollWidth,height:el.clientHeight,scrollHeight:el.scrollHeight}));
 assert(layout.scrollWidth<=layout.width+2,'Panel horizontal overflow: '+JSON.stringify(layout));record('layout-'+name,layout);
};
try{
 await launch();assert.equal(fs.realpathSync(path.join(c.profile,'node_modules/dsh-research-agent')),fs.realpathSync('packages/research-agent'));
 await page.getByText('新会话',{exact:true}).first().click();
 const preview=page.getByRole('button',{name:'继续',exact:true});if(await preview.isVisible())await preview.click();
 await page.getByTitle('选择新任务使用的 Agent 预设').click();await page.getByText('自动科研',{exact:true}).click();
 const input=page.locator('[data-composer-input=true][contenteditable=true]');
 await input.fill('科研界面回归 2026-11-03');await input.press('Enter');await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});record('native-chat',page.url());
 await open();await screenshot('01-upload');
 await panel.locator('input[type=file]').setInputFiles({name:'synthetic-ui-paper.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic paper: reproducible calibration under distribution shift. Least squares baseline, mean squared error metric. All data is synthetic.')});
 await panel.locator('[data-research-node-detail="node-2"]').waitFor({state:'attached',timeout:60000});await idle();
 const article=panel.locator('[data-research-main-node="node-2"]'),toggle=article.locator(':scope > button');
 await toggle.click();assert.equal(await article.getAttribute('data-expanded'),'false');await toggle.click();assert.equal(await article.getAttribute('data-expanded'),'true');
 await article.locator('[data-research-main-content]').click();assert.equal(await article.getAttribute('data-expanded'),'true');record('content-interaction','Header toggles; body preserves expansion');
 let exported=false;
 for(let i=0;i<12;i++){
  await idle();const editor=panel.locator('[data-target-task-editor]');
  if(await editor.count()){
   await editor.getByLabel('具体任务或问题',{exact:true}).waitFor({timeout:60000});await editor.getByRole('checkbox').check();await editor.scrollIntoViewIfNeeded();
   await page.screenshot({path:path.join(evidence,'02-target-form.png')});await screenshot('03-narrow',880);await (await app.browserWindow(page)).evaluate(w=>w.setSize(1440,960));record('target-confirmation','Local fixture draft explicitly confirmed');
  }
  const write=panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true});
  if(await write.count()){await write.click();await panel.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:60000});exported=true;break}
  const old=await panel.getAttribute('data-research-selected-node');await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
  await page.waitForFunction(old=>{const el=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return el?.getAttribute('aria-busy')==='false'&&(el.getAttribute('data-research-selected-node')!==old||el.querySelector('[role=alert]'))},old,{timeout:90000});
  assert.deepEqual(await panel.locator('[role=alert]').allTextContents(),[]);record('stage',await panel.getAttribute('data-research-selected-node'));
 }
 assert(exported,'Final plan was not exported');await screenshot('04-complete');
 await panel.getByRole('tab',{name:'分支关系',exact:true}).click();
 assert.equal(await panel.locator('[role=tabpanel]:visible').count(),1);
 assert.equal(await panel.locator('[data-research-view-panel=content]').isVisible(),false);
 assert.equal(await panel.locator('[data-research-view-panel=details]').isVisible(),false);await panel.locator('[data-research-branch-section]').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'05-branches.png')});
 await panel.getByRole('tab',{name:'节点详情',exact:true}).click();
 assert.equal(await panel.locator('[role=tabpanel]:visible').count(),1);
 assert.equal(await panel.locator('[data-research-branch-section]').isVisible(),false);
 await page.screenshot({path:path.join(evidence,'05-details.png')});
 await panel.getByRole('tab',{name:'科研内容',exact:true}).click();
 assert.equal(await panel.locator('[role=tabpanel]:visible').count(),1);
 record('independent-tabs','Content, branches and node details render in separate views; exactly one is visible');
 const selected=await panel.getAttribute('data-research-selected-node'),persisted=JSON.parse(fs.readFileSync(path.join(c.researchData,'research.json'),'utf8'));
 fs.writeFileSync(path.join(evidence,'persisted-row.json'),JSON.stringify(persisted,null,2));await app.close();app=undefined;
 await launch();await open();assert.equal(await panel.getAttribute('data-research-selected-node'),selected);assert.deepEqual(JSON.parse(fs.readFileSync(path.join(c.researchData,'research.json'),'utf8')),persisted);
 await screenshot('06-restarted',880);record('restart','Exact research state restored after Electron exit and restart');
 const plans=fs.readdirSync(c.workspace,{recursive:true}).map(String).filter(p=>p.endsWith('research-plan.md'));assert(plans.length>0);record('export',plans);
 fs.writeFileSync(path.join(evidence,'build-manifest.json'),JSON.stringify(build,null,2));record('PASS','Official Desktop; native chat, upload, target confirmation, stages, export, responsive layout, restart. All model/web responses are local fixtures.');
}catch(e){record('FAIL',e.stack);process.exitCode=1;if(page){fs.writeFileSync(path.join(evidence,'failure-dom.txt'),await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(evidence,'failure.png'),timeout:10000}).catch(()=>{})}}
finally{if(app)await app.close()}

