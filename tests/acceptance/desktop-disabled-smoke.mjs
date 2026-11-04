import { launchIsolatedDesktop as launchIsolated } from './desktop-isolation.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {assertFreshBuild} from '../../scripts/build-provenance.mjs';
const build=assertFreshBuild();
const c=JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT??'.acceptance/desktop-baseline-20261102/context-c.json','utf8'));
const evidence=path.join(c.evidence,process.env.RESEARCH_DISABLED_EVIDENCE??'plugin-disabled-final');fs.mkdirSync(evidence,{recursive:true});
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

 record('INFO pnpm retained local junction after package removal',{junctionPresent:fs.existsSync(path.join(c.profile,'node_modules/dsh-research-agent'))});
 const profilePackage=JSON.parse(fs.readFileSync(path.join(c.profile,'package.json'),'utf8'));assert.equal(profilePackage.dependencies?.['dsh-research-agent'],undefined);assert.ok(!profilePackage.dsh.profile.bundles.includes('dsh-research-agent'));record('PASS official CLI removed research dependency and bundle registration from isolated profile');
 await page.getByText('新会话',{exact:true}).first().click();const picker=page.getByTitle('选择新任务使用的 Agent 预设');await picker.waitFor();await picker.click();
 assert.equal(await page.getByText('自动科研',{exact:true}).count(),0);assert.ok(await page.getByText('标准模式',{exact:true}).count());await page.keyboard.press('Escape');
 await input.fill('DSH插件移除后普通聊天验收');await input.press('Enter');await page.getByText('合成科研输出',{exact:false}).first().waitFor({timeout:30000});
 await page.getByText(/^已完成，用时/).first().waitFor({timeout:30000});
 assert.equal(await page.getByRole('button',{name:'打开自动科研流程',exact:true}).count(),0);assert.equal(await page.locator('[data-research-panel]').count(),0);record('PASS ordinary native chat and preset picker after research plugin removal');
 await page.screenshot({path:path.join(evidence,'ordinary-after-removal.png')});fs.writeFileSync(path.join(evidence,'native-dom.txt'),await page.locator('body').innerText());
} catch(error){record('FAIL',error.stack);if(app){const p=await app.firstWindow();fs.writeFileSync(path.join(evidence,'failure-dom.txt'),await p.locator('body').innerText());await p.screenshot({path:path.join(evidence,'failure.png')}).catch(()=>{});}process.exitCode=1;}finally{
 if(app)await Promise.race([app.close(),new Promise((_,reject)=>{const timer=setTimeout(()=>reject(new Error('Close timed out')),20000);timer.unref()})]).then(()=>record('PASS normal close')).catch(e=>{record('FAIL close',String(e));process.exitCode=1;});
 const after=processSnapshot('after-close');if(after.processes.length){record('FAIL remaining test process',after);process.exitCode=1;}else record('PASS test process tree and listeners cleared');
 fs.writeFileSync(path.join(evidence,'build-manifest.json'),JSON.stringify(build,null,2));
}
