import { launchIsolatedDesktop as launchIsolated } from './desktop-isolation.mjs';
(async function legacyTest(){
 const fs=await import('node:fs'),path=await import('node:path'),assert=(await import('node:assert/strict')).default;
 const {_electron:electron}=await import('playwright');
 const {assertFreshBuild}=await import('../../scripts/build-provenance.mjs');const build=assertFreshBuild();
 const c=JSON.parse(fs.readFileSync('.acceptance/rubric170-20261102/context.json','utf8')),evidence=path.join(c.evidence,'legacy-v1');fs.mkdirSync(evidence,{recursive:true});
 const before=new Set(fs.readdirSync(c.workspace,{recursive:true}).map(String));
 const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&!/^DSH_|^RESEARCH_/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
 Object.assign(env,{DSH_HOME:c.home,DSH_DESKTOP_UPDATE_JOURNAL_DIR:path.join(c.root,'update-journal'),RESEARCH_ACCEPTANCE_TRACE:path.join(evidence,'routing.jsonl')});
 let app,page,panel;
 const log=(name,value)=>{console.log(name,JSON.stringify(value??null));fs.appendFileSync(path.join(evidence,'run.log'),JSON.stringify({name,value,at:new Date().toISOString()})+'\n')};
 const launch=async()=>{app=await launchIsolated({executablePath:c.executable,args:['--user-data-dir='+c.userData],env,cwd:c.workspace,timeout:60000});const id=await app.evaluate(({app})=>({version:app.getVersion(),exe:process.execPath,home:process.env.DSH_HOME,pid:process.pid}));assert.equal(id.version,c.targetVersion);assert.equal(path.resolve(id.exe),path.resolve(c.executable));log('identity',id);page=await app.firstWindow();await page.locator('[data-composer-input=true][contenteditable=true]').waitFor({timeout:60000})};
 const open=async()=>{panel=page.locator('[data-research-panel]:visible').last();if(!await panel.count())await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();await panel.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false')};
 try{
  await launch();await page.getByText('新会话',{exact:true}).first().click();await page.getByTitle('选择新任务使用的 Agent 预设').click();await page.getByText('自动科研',{exact:true}).click();
  const input=page.locator('[data-composer-input=true][contenteditable=true]');await input.fill('Legacy-v1-compat-20261102');await input.press('Enter');await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});await open();
  await panel.locator('input[type=file]').setInputFiles({name:'legacy-v1-synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic legacy v1 compatibility paper. A controlled local rule, baseline and limitation. No private data.')});
  await panel.locator('[data-research-node-detail="node-2"]').waitFor({timeout:30000});
  const files=fs.readdirSync(c.workspace,{recursive:true}).map(String).filter(p=>p.endsWith('research-state.json')&&!before.has(p));assert.equal(files.length,1);
  const sessionId=path.basename(path.dirname(path.join(c.workspace,files[0])));
  await app.close();app=undefined;
  const storage=path.join(c.researchData,'research.json'),data=JSON.parse(fs.readFileSync(storage,'utf8'));const row=data.tables.sessions[sessionId];
  fs.writeFileSync(path.join(evidence,'pre-seed-created-row.json'),JSON.stringify(row,null,2));
  const node=row.state.nodes[row.state.selectedNodeId],artifact=row.state.artifacts[node.artifactRefs.at(-1)];
  for(const n of Object.values(row.state.nodes))delete n.memorySnapshot.targetTask;
  for(const a of Object.values(row.state.artifacts)){delete a.rubricAssessment;delete a.paperRefs}
  node.stage='idea-generation';node.status='awaiting-confirmation';artifact.kind='idea';artifact.title='旧 v1 创新结果';artifact.content='创新点：纯合成旧版科研结果；保留原评分 83 / 100，threshold 70。';artifact.evaluation={score:83,threshold:70,overlap:false,rationale:'旧 v1 合成夹具，禁止静默重算'};row.revision=6;
  fs.writeFileSync(path.join(evidence,'legacy-v1-fixture-row.json'),JSON.stringify(row,null,2));fs.writeFileSync(storage,JSON.stringify(data,null,2));
  const calls=fs.readFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'utf8').trim().split('\n').length;
  await launch();await open();assert.match(await panel.innerText(),/旧 v1 创新结果/);assert.equal(await panel.locator('[data-rubric-assessment]').count(),0);
  const after=JSON.parse(fs.readFileSync(storage,'utf8')).tables.sessions[sessionId];assert.equal(after.revision,6);assert.deepEqual(after.state.artifacts[artifact.artifactId].evaluation,artifact.evaluation);
  assert.equal(fs.readFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'utf8').trim().split('\n').length,calls);
  await page.screenshot({path:path.join(evidence,'legacy-v1-open.png'),timeout:15000});
  fs.writeFileSync(path.join(evidence,'result.json'),JSON.stringify({status:'passed',sourceSha256:build.sourceSha256,sessionId,fixture:'pure synthetic old v1 row seeded while isolated Desktop was closed; main public flow was entirely UI-driven',legacyScore:83,threshold:70,revision:6,noAssessmentRequired:true,noRecalculation:true,noNewModelCall:true},null,2));log('passed',{sessionId,score:83,revision:6});
 }catch(e){log('failure',e.stack);process.exitCode=1;if(page)await page.screenshot({path:path.join(evidence,'failure.png'),timeout:10000}).catch(()=>{})}
 finally{if(app)await app.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
