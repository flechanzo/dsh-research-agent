import {it,expect,vi} from 'vitest';
import {Context} from '@deepseek-ai/cordis';
import {SessionId} from '@deepseek-ai/dsh-session';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import ResearchController from '../packages/research-agent/lib/index.js';
import {startResearchRun} from '../packages/research-agent/src/workflows/subagent-adapter.ts';
it('persists an explicit data directory across controller disposal without opening the shared route',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'research-domain-'));
 const open=vi.fn(()=>{throw Error('shared route must stay untouched')});
 const make=()=>{const ctx=new Context();const backends=new Map();ctx.provide('storage',{backend:{register:(id,backend)=>{backends.set(id,backend);return()=>backends.delete(id)},get:id=>backends.get(id)}} as never);ctx.provide('storageDomain',{open} as never);ctx.provide('sessionController',{resolveAgent:async()=>({agent:{session:{header:{}}}})} as never);return{ctx,controller:new ResearchController(ctx,{dataDirectory:dir})}};
 try{const first=make();try{await first.controller.selectNode({sessionId:SessionId('isolated'),expectedRevision:0,nodeId:'node-1'});}finally{await first.ctx.fiber.dispose()};const bytes=fs.readFileSync(path.join(dir,'research.json'),'utf8');expect(JSON.parse(bytes).tables.sessions.isolated.revision).toBe(1);const second=make();try{expect((await second.controller.read({sessionId:SessionId('isolated')})).revision).toBe(1)}finally{await second.ctx.fiber.dispose()};expect(open).not.toHaveBeenCalled();}finally{fs.rmSync(dir,{recursive:true,force:true})}
});
it('cancels a published activation once and observes teardown failures',async()=>{
 const signal=new AbortController();const failure=Error('cleanup failed');const dispose=vi.fn(async()=>{throw failure});const runtime={startActivation:vi.fn(async()=>({childId:SessionId('child'),result:new Promise(()=>{}),dispose}))};
 const run=await startResearchRun(runtime as never,'spawn',{signal:signal.signal,parent:{} as never,prompt:'fixture'} as never);signal.abort();await expect(run.dispose()).rejects.toBe(failure);expect(dispose).toHaveBeenCalledOnce();expect(runtime.startActivation.mock.calls[0]?.[0]).toMatchObject({delivery:'caller'});
});
