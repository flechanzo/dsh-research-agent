import fs from 'node:fs';import {withPage} from './browser-helper.mjs';
await withPage(async(page,errors)=>{

 await page.getByRole('button',{name:'打开自动科研流程',exact:true}).click();
 const panel=page.locator('[data-research-panel]');await panel.waitFor();
 if(await panel.getAttribute('data-research-selected-node')==='node-1'){await panel.locator('input[type=file]').setInputFiles({name:'synthetic-paper.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic paper: reproducible calibration under distribution shift. Method: least squares. Baseline: linear regression. Metric: mean squared error. All data is synthetic.')});
 await panel.locator('[data-research-node-detail="node-2"]').waitFor({timeout:30000});
 console.log('UPLOAD PASSED');}
 for(let i=0;i<12;i++){
  await page.waitForFunction(()=>document.querySelector('[data-research-panel]')?.getAttribute('aria-busy')==='false');
  const before=await panel.getAttribute('data-research-selected-node');
  console.log('STAGE',i,(await panel.innerText()).slice(-2200));
  const write=panel.getByRole('button',{name:'确认并写入 Markdown 文件',exact:true});
  if(await write.count()){await write.click();await page.waitForFunction(()=>document.querySelector('[data-research-panel]')?.getAttribute('aria-busy')==='false');await panel.getByText('科研方案已写入文件：',{exact:false}).waitFor();console.log('WRITE',(await panel.innerText()).slice(-2200));break;}
  await panel.getByRole('button',{name:'确认并进入下一步',exact:true}).click();
  await page.waitForFunction(old=>{const p=document.querySelector('[data-research-panel]');return p?.getAttribute('aria-busy')==='false'&&(p.getAttribute('data-research-selected-node')!==old||p.querySelector('[role=alert]'));},before,{timeout:60000});
  if(await panel.locator('[role=alert]').count())throw new Error(await panel.locator('[role=alert]').innerText());
 }
 if(!(await panel.innerText()).includes('科研方案已写入文件：'))throw Error('Plan was not written');if(errors.length)throw Error(errors.join('\n'));await page.screenshot({path:'docs/research-completed.png'});console.log('ERRORS',errors);
});
