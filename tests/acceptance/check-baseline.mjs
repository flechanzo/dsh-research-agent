import fs from 'node:fs';import {execFileSync,spawnSync} from 'node:child_process';
const paths=execFileSync('git',['ls-tree','-r','--name-only','4245985','packages/research-agent/src'],{encoding:'utf8'}).trim().split('\n').filter(Boolean);
const saved=new Map(paths.map(p=>[p,fs.existsSync(p)?fs.readFileSync(p):null]));
const run=(args,log)=>{const r=spawnSync(process.execPath,args,{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024});fs.writeFileSync(log,(r.stdout??'')+(r.stderr??'')+'\nexit='+r.status+'\n');return r;};
try {
 for(const p of paths)fs.writeFileSync(p,execFileSync('git',['show','4245985:'+p]));
 const b=run(['scripts/build.mjs'],'.acceptance/baseline-build.log');if(b.status!==0)throw Error('baseline build failed; see local log');
 const t=run(['node_modules/vitest/vitest.mjs','run','tests/research-coordinator.spec.ts','tests/refresh.spec.ts','tests/compatibility.spec.ts','tests/controller.spec.ts','tests/ui-regressions.spec.tsx','tests/legacy-ui/research-panel.client.spec.tsx','--reporter=json','--outputFile=docs/acceptance/baseline-confirmed.json'],'.acceptance/baseline-tests.log');
 console.log('Baseline regression exit',t.status,'timedOut',t.error?.code==='ETIMEDOUT');
}finally{
 for(const [p,bytes] of saved)if(bytes===null)fs.unlinkSync(p);else fs.writeFileSync(p,bytes);
 const b=run(['scripts/build.mjs'],'docs/acceptance/build.log');if(b.status!==0)throw Error('candidate rebuild failed');
}
