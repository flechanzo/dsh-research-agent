/** Acceptance-only guard; never shipped or installed in a formal profile. */
import fs from 'node:fs';import path from 'node:path';
import {verifyDesktopIsolation,verifyResolvedWorkspace,assertTestWrite} from '../acceptance/desktop-isolation.mjs';
export const inject=['workspaceController','workspaceRegistry','sessionController','attachments','fs'];
export function apply(ctx){
 const file=process.env.DSH_TEST_ISOLATION_CONTEXT;if(!file)throw Error('Missing prepared isolation context');
 const c=verifyDesktopIsolation(JSON.parse(fs.readFileSync(file,'utf8')));
 if(fs.realpathSync(process.env.DSH_HOME)!==fs.realpathSync(c.home))throw Error('Unexpected DSH_HOME');
 verifyResolvedWorkspace(c,ctx.workspaceController.config.documentsDirectory);
 const log=(kind,value)=>fs.appendFileSync(path.join(c.evidence,'runtime-isolation.jsonl'),JSON.stringify({at:new Date().toISOString(),kind,value})+'\n');
 const verifyRegistry=()=>{for(const w of ctx.workspaceRegistry.list())verifyResolvedWorkspace(c,w.path)};
 const wrappedFs=new WeakSet();
 const guardFs=service=>{
  if(wrappedFs.has(service))return;wrappedFs.add(service);
  const original=service.writeText;service.writeText=async function(target,...args){assertTestWrite(c,target.displayPath);log('write-path',target.displayPath);return original.call(this,target,...args)};
  ctx.effect(()=>()=>{service.writeText=original});
 };
 guardFs(ctx.fs);
 const check=async (controller,request)=>{
  verifyDesktopIsolation(c);verifyRegistry();
  const agent=await controller.agent(request.sessionId);
  if(!agent.session.header.cwd)throw Error('Test Session cwd not initialized');
  verifyResolvedWorkspace(c,agent.session.header.cwd);
  guardFs(agent.ctx.get('fs')??ctx.fs);
  log('before-operation',{sessionId:request.sessionId,cwd:agent.session.header.cwd});
 };
 ctx.inject(['researchController'],scope=>{
 for(const name of ['upload','confirm','resyncProject','resumeRubric']){
  const controller=scope.researchController;
  const original=controller[name];controller[name]=async function(request,...args){await check(controller,request);return original.call(this,request,...args)};
  scope.effect(()=>()=>{controller[name]=original});
 }
 log('operation-guard-ready',true);
 });
 for(const name of ['saveFile','saveFileStream','admitEncodedFile']){
 const attachment=ctx.attachments[name];
 ctx.attachments[name]=async function(...args){verifyDesktopIsolation(c);verifyRegistry();log('before-attachment',{home:c.home,method:name});return attachment.apply(this,args)};
 ctx.effect(()=>()=>{ctx.attachments[name]=attachment});
 }
 verifyRegistry();log('prepared',{home:c.home,profile:c.profile,documentsDirectory:ctx.workspaceController.config.documentsDirectory,registry:ctx.workspaceRegistry.list().map(w=>w.path)});
}
