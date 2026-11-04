import { launchIsolatedDesktop as launchIsolated } from './desktop-isolation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {assertFreshBuild} from '../../scripts/build-provenance.mjs';
const build=assertFreshBuild();
const c=JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT??'.acceptance/desktop-baseline-20261102/context-c.json','utf8'));
const evidence=path.join(c.evidence,'native-final');fs.mkdirSync(evidence,{recursive:true});
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&!/^DSH_/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
Object.assign(env,{DSH_HOME:c.home,DSH_DESKTOP_UPDATE_JOURNAL_DIR:path.join(c.root,'update-journal'),RESEARCH_ACCEPTANCE_TRACE:path.join(evidence,'model-routing.jsonl'),RESEARCH_MODEL_RESOLUTION_TRACE:path.join(evidence,'model-resolution.jsonl')});
const events=[];const record=(name,data)=>{events.push({time:new Date().toISOString(),name,data});console.log(name,JSON.stringify(data??''));fs.writeFileSync(path.join(evidence,'results.json'),JSON.stringify(events,null,2));};
const processSnapshot=label=>{
 const script=`$all=@(Get-CimInstance Win32_Process); $ids=[System.Collections.Generic.HashSet[int]]::new(); foreach($p in $all){if($p.ExecutablePath -eq $env:RESEARCH_TEST_EXE){[void]$ids.Add([int]$p.ProcessId)}}; do {$added=$false;foreach($p in $all){if($ids.Contains([int]$p.ParentProcessId) -and $ids.Add([int]$p.ProcessId)){$added=$true}}}while($added); $rows=@($all | Where-Object {$ids.Contains([int]$_.ProcessId)} | Select-Object ProcessId,ParentProcessId,ExecutablePath,CommandLine); $ports=@(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object {$ids.Contains([int]$_.OwningProcess)} | Select-Object LocalAddress,LocalPort,OwningProcess); @{processes=$rows;listeners=$ports} | ConvertTo-Json -Depth 5`;
 const value=JSON.parse(execFileSync('powershell.exe',['-NoProfile','-Command',script],{encoding:'utf8',windowsHide:true,env:{...env,RESEARCH_TEST_EXE:c.executable}}));
 fs.writeFileSync(path.join(evidence,'processes-'+label+'.json'),JSON.stringify(value,null,2));return value;
};
let app;
try{
 app=await launchIsolated({executablePath:c.executable,args:['--user-data-dir='+c.userData],env,cwd:c.workspace,timeout:60000});
 app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(evidence,'stdout.log'),b));app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(evidence,'stderr.log'),b));
 const identity=await app.evaluate(({app})=>({version:app.getVersion(),electron:process.versions.electron,node:process.versions.node,exe:process.execPath,pid:process.pid,home:process.env.DSH_HOME,userData:app.getPath('userData'),appPath:app.getAppPath()}));assert.equal(identity.version,c.targetVersion);assert.equal(path.resolve(identity.exe),path.resolve(c.executable));record('IDENTITY',identity);
 const page=await app.firstWindow();const input=page.locator('[data-composer-input=true][contenteditable=true]');await input.waitFor({timeout:60000});
 processSnapshot('running');
 const tested=JSON.parse(fs.readFileSync(path.join(c.evidence,'final-rc5/tested-session.json'),'utf8'));
 await page.getByText(tested.taskTitle,{exact:true}).first().click();
 const open=page.getByRole('button',{name:'打开自动科研流程',exact:true});if(await open.isVisible())await open.click();
 const panel=page.locator('[data-research-panel]:visible').last();await panel.waitFor({timeout:30000});
 await page.getByText('科研方案已写入文件：',{exact:false}).waitFor({timeout:30000});
 const expected=JSON.parse(fs.readFileSync(path.join(c.evidence,'final-rc5/persisted-row.json'),'utf8'));
 const current=JSON.parse(fs.readFileSync(path.join(c.researchData,'research.json'),'utf8')).tables.sessions[tested.sessionId];assert.deepEqual(current,expected);assert.equal(await panel.getAttribute('data-research-selected-node'),expected.state.selectedNodeId);record('PASS real EXE restart restores exact committed research row',{sessionId:tested.sessionId,revision:current.revision});
 await page.screenshot({path:path.join(evidence,'restart-restored.png')});
 await page.getByRole('button',{name:'账号菜单',exact:true}).click();
 fs.writeFileSync(path.join(evidence,'account-menu-dom.txt'),await page.locator('body').innerText());
 await page.screenshot({path:path.join(evidence,'account-menu.png')});
 await page.getByText('设置',{exact:true}).last().click();
 await page.getByRole('button',{name:'模型',exact:true}).click();
 await page.getByText('模型服务',{exact:false}).first().waitFor({timeout:15000}).catch(()=>{});
 fs.writeFileSync(path.join(evidence,'model-settings-dom.txt'),await page.locator('[role=dialog]').innerText());
 fs.writeFileSync(path.join(evidence,'settings-controls.json'),JSON.stringify(await page.locator('button,a,[role=tab]').evaluateAll(els=>els.map(e=>({tag:e.tagName,text:e.innerText,aria:e.getAttribute('aria-label'),title:e.title}))),null,2));
 await page.screenshot({path:path.join(evidence,'settings.png')});record('PASS native model settings opens');
 await page.getByRole('button',{name:'关闭',exact:true}).last().click();
 const selected=await panel.getAttribute('data-research-selected-node');
 await panel.getByRole('button',{name:'分支关系',exact:true}).click();
 await panel.locator('[data-research-branch-section]').scrollIntoViewIfNeeded();
 await page.screenshot({path:path.join(evidence,'branch-tree.png')});
 const coords=await panel.locator('[data-research-node]').evaluateAll(els=>els.map(e=>({id:e.getAttribute('data-research-node'),branch:e.getAttribute('data-research-branch'),x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y})));fs.writeFileSync(path.join(evidence,'tree-coordinates.json'),JSON.stringify(coords,null,2));
 const newSession=async(preset,title,model='科研合成夹具 B')=>{
  await page.getByText('新会话',{exact:true}).first().click();await page.getByTitle('选择新任务使用的 Agent 预设').waitFor();
  const picker=page.getByTitle('选择新任务使用的 Agent 预设');if((await picker.innerText()).trim()!==preset){await picker.click();await page.getByText(preset,{exact:true}).last().click();}
  const current=page.getByText(/科研合成夹具 [AB]/,{exact:true}).last();const old=await current.innerText();if(old!==model){await current.click();await page.getByText(old,{exact:true}).last().click();await page.getByText(model,{exact:true}).last().click();}
  await input.fill(title);await input.press('Enter');await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});
 };
 await newSession('标准模式','DSH原生普通会话验收');record('PASS ordinary native chat');
 await page.getByText(tested.taskTitle,{exact:true}).first().click();await panel.waitFor();assert.equal(await panel.getAttribute('data-research-selected-node'),selected);record('PASS native session list switches between ordinary chat and research');
 const pdf=texts=>{
  const pages=[],streams=[],refs=[];const first=3,contentFirst=first+texts.length;
  texts.forEach((text,i)=>{refs.push((first+i)+' 0 R');const stream=text?'BT /F1 8 Tf 10 50 Td ('+text+') Tj ET':'0 0 0 rg 10 10 100 80 re f';pages.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 120 100] /Resources << /Font << /F1 '+(contentFirst+texts.length)+' 0 R >> >> /Contents '+(contentFirst+i)+' 0 R >>');streams.push('<< /Length '+stream.length+' >>\nstream\n'+stream+'\nendstream');});
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids ['+refs.join(' ')+'] /Count '+texts.length+' >>',...pages,...streams,'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];let data='%PDF-1.7\n';const offsets=[0];objects.forEach((v,i)=>{offsets.push(data.length);data+=(i+1)+' 0 obj\n'+v+'\nendobj\n';});const xref=data.length;data+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';for(const o of offsets.slice(1))data+=String(o).padStart(10,'0')+' 00000 n \n';data+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n';return Buffer.from(data);
 };
 const route=()=>fs.existsSync(env.RESEARCH_ACCEPTANCE_TRACE)?fs.readFileSync(env.RESEARCH_ACCEPTANCE_TRACE,'utf8').trim().split('\n').filter(Boolean).map(line=>JSON.parse(line)):[];
 const readPdf=async(name,texts,model)=>{
  await newSession('自动科研','DSH PDF '+name,model);const opener=page.getByRole('button',{name:'打开自动科研流程',exact:true});if(await opener.isVisible())await opener.click();await panel.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1)?.getAttribute('aria-busy')==='false');
  const before=route().length;await panel.locator('input[type=file]').setInputFiles({name:name+'.pdf',mimeType:'application/pdf',buffer:pdf(texts)});
  await page.waitForFunction(()=>{const p=[...document.querySelectorAll('[data-research-panel]')].filter(p=>p.checkVisibility()).at(-1);return p?.getAttribute('aria-busy')==='false'&&(p.getAttribute('data-research-selected-node')!=='node-1'||p.querySelector('[role=alert]'));},null,{timeout:60000});
  const text=await panel.innerText();fs.writeFileSync(path.join(evidence,name+'-dom.txt'),text);await page.screenshot({path:path.join(evidence,name+'.png')});return {text,trace:route().slice(before),alert:await panel.locator('[role=alert]').allTextContents()};
 };
 const paragraph='Synthetic selectable PDF text with enough words to avoid OCR fallback. Calibration under distribution shift uses least squares, fixed baselines and reproducible synthetic metrics. All content is synthetic for Desktop acceptance.';
 const embedded=await readPdf('embedded-two-pages',[paragraph,paragraph],'科研合成夹具 B');assert.equal(embedded.alert.length,0);assert.match(embedded.text,/embedded-text/);assert.match(embedded.text,/2/);assert.ok(embedded.trace.some(r=>r.containsSyntheticPdfText&&r.model==='research-fixture-b'&&r.imageBlockCount===0));record('PASS actual Desktop PDF text extraction and B summary',embedded.trace);
 const denied=await readPdf('scan-model-B',[''],'科研合成夹具 B');record('OCR text-only result',denied);assert.ok(denied.alert.length>0);assert.match(denied.alert.join(' '),/PDF_OCR_FAILED/);assert.match(denied.alert.join(' '),/image|图像|图片|modality|support/i);assert.ok(denied.trace.every(r=>r.imageBlockCount===0));record('PASS OCR respects current B text-only capability and returns visible error');
 const allowed=await readPdf('scan-model-A',[''],'科研合成夹具 A');assert.equal(allowed.alert.length,0);assert.match(allowed.text,/ocr/);assert.ok(allowed.trace.some(r=>r.model==='research-fixture'&&r.imageBlockCount>0));record('PASS actual Desktop OCR uses current image-capable A through official Subagent',allowed.trace);

} catch(error){record('FAIL',error.stack);if(app){const p=await app.firstWindow();fs.writeFileSync(path.join(evidence,'failure-dom.txt'),await p.locator('body').innerText());await p.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});}process.exitCode=1;}finally{
 if(app)await Promise.race([app.close(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Close timed out')),20000);timer.unref()})]).then(()=>record('PASS normal close')).catch(e=>{record('FAIL close',String(e));process.exitCode=1;});
 const after=processSnapshot('after-close');if(after.processes.length){record('FAIL remaining test process',after);process.exitCode=1;}else record('PASS test process tree and listeners cleared');
 fs.writeFileSync(path.join(evidence,'build-manifest.json'),JSON.stringify(build,null,2));
}
