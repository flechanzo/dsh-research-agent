import {isolatedContext} from './isolated-context.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import {isDeepStrictEqual} from 'node:util';import {Context} from '@deepseek-ai/cordis';import {SessionId} from '@deepseek-ai/dsh-session';import Controller,{researchDomain} from '../../packages/research-agent/lib/index.js';
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const c=isolatedContext();
const bytes=fs.readFileSync(path.join(c.root,'legacy/research.json'));
const input=JSON.parse(bytes);assert.equal(input.unit.version,1);assert.equal(Object.keys(input.tables.sessions).length,5);
const copy=fs.mkdtempSync(path.join(c.root,'legacy-branch-'));fs.writeFileSync(path.join(copy,'research.json'),bytes);
const ctx=new Context();const backends=new Map();ctx.provide('storage',{backend:{register:(id,b)=>{backends.set(id,b);return()=>backends.delete(id)},get:id=>backends.get(id)}});
ctx.provide('storageDomain',{open:()=>{throw Error('shared storage forbidden')}});
ctx.provide('sessionController',{resolveAgent:async()=>({agent:{session:{header:{}}}})});
const controller=new Controller(ctx,{dataDirectory:copy});const results=[];
try {
 for(const [key,row] of Object.entries(input.tables.sessions)) {
  researchDomain.tables.sessions.valueSchema.parse(row);
  const sessionId=SessionId(key);const read=await controller.read({sessionId});assert.ok(isDeepStrictEqual(read.state,row.state),'read changed legacy state');assert.equal(read.revision,row.revision);
  assert.deepEqual(fs.readFileSync(path.join(copy,'research.json')),bytes);
 }
 for(const [key,row] of Object.entries(input.tables.sessions)) {
  const sessionId=SessionId(key);const next=await controller.continueFromNode({sessionId,expectedRevision:row.revision,nodeId:row.state.selectedNodeId});
  assert.equal(next.snapshot.revision,row.revision+1);assert.notEqual(next.snapshot.state.activeBranchId,row.state.activeBranchId);
  for(const [id,node] of Object.entries(row.state.nodes))assert.ok(isDeepStrictEqual(next.snapshot.state.nodes[id],node),'ancestor changed');
  for(const [id,branch] of Object.entries(row.state.branches))assert.ok(isDeepStrictEqual(next.snapshot.state.branches[id],branch),'branch changed');
  assert.ok(isDeepStrictEqual(next.snapshot.state.artifacts,row.state.artifacts),'artifact changed');
  results.push({record:results.length+1,read:'PASS',branchCopy:'PASS',revisionBefore:row.revision,revisionAfter:next.snapshot.revision,ancestorsUnchanged:true});
 }
}finally{await ctx.fiber.dispose()}
assert.deepEqual(fs.readFileSync(path.join(c.root,'legacy/research.json')),bytes);
const realHash=crypto.createHash('sha256').update(fs.readFileSync('D:/DeepSeekHarness/data/storages/research.json')).digest('hex');
assert.equal(realHash,'ed17833ae3abdad8340954c4d3122b188fa2a62773707da46f8efbe0c0d4e2be');
fs.writeFileSync('docs/acceptance/legacy-v1.json',JSON.stringify({domainVersion:1,realSourceUnchanged:true,realSourceSha256:realHash,records:results,scope:'Target JSON backend and plugin controller; no model, no private text exported'},null,2)+'\n');console.log('PASS 5 v1 records: read without writes; branch on copies preserves every ancestor and artifact');
