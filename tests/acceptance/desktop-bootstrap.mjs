import { launchIsolatedDesktop as launchIsolated } from './desktop-isolation.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {_electron as electron} from 'playwright';
const root=process.cwd(),run=path.join(root,'.acceptance/desktop-baseline-20261102'),c=JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT??path.join(run,'context.json'),'utf8'));
const env=Object.fromEntries(Object.entries(process.env).filter(([k])=>!/(KEY|TOKEN|SECRET|PASSWORD)/i.test(k)&&!/^DSH_/i.test(k)&&k!=='ELECTRON_RUN_AS_NODE'));
Object.assign(env,{DSH_HOME:c.home,DSH_DESKTOP_UPDATE_JOURNAL_DIR:path.join(c.root,'update-journal')});
let app;const log=[];const record=(...v)=>{const line=v.map(x=>typeof x==='string'?x:JSON.stringify(x)).join(' ');log.push(line);console.log(line);};
try{
 app=await launchIsolated({executablePath:c.executable,args:['--user-data-dir='+c.userData],cwd:c.workspace,env,timeout:60000});
 const identity=await app.evaluate(({app})=>({desktop:app.getVersion(),electron:process.versions.electron,node:process.versions.node,exe:process.execPath,appPath:app.getAppPath(),userData:app.getPath('userData'),home:process.env.DSH_HOME,pid:process.pid}));
 assert.equal(identity.desktop,c.targetVersion);assert.equal(path.resolve(identity.exe),path.resolve(c.executable));assert.equal(path.resolve(identity.userData),path.resolve(c.userData));assert.equal(path.resolve(identity.home),path.resolve(c.home));
 fs.writeFileSync(path.join(c.evidence,'bootstrap-identity.json'),JSON.stringify(identity,null,2));record('IDENTITY',identity);
 app.process().stdout?.on('data',b=>fs.appendFileSync(path.join(c.evidence,'bootstrap-stdout.log'),b));app.process().stderr?.on('data',b=>fs.appendFileSync(path.join(c.evidence,'bootstrap-stderr.log'),b));
 const page=await app.firstWindow();record('WINDOW',page.url());
 await page.locator('body').waitFor();
 await page.screenshot({path:path.join(c.evidence,'bootstrap-window.png'),timeout:15000});
 const composer=page.locator('[data-composer-input=true][contenteditable=true]');
 try{await composer.waitFor({timeout:60000});record('PASS native composer visible');}catch(e){record('BOOTSTRAP BODY',await page.locator('body').innerText());throw e;}
 fs.writeFileSync(path.join(c.evidence,'bootstrap-dom.txt'),await page.locator('body').innerText());
 await page.screenshot({path:path.join(c.evidence,'native-before-plugin.png'),timeout:15000});
 record('PASS native Desktop profile initialized');
}catch(e){record('FAIL',e.stack);process.exitCode=1;}finally{
 if(app)await app.close().catch(e=>record('CLOSE FAILURE',String(e)));
 fs.writeFileSync(path.join(c.evidence,'bootstrap.log'),log.join('\n')+'\n');
}
