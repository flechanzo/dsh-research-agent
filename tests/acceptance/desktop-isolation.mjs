import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import yaml from 'js-yaml';
import {fileURLToPath} from 'node:url';
const hash=text=>createHash('sha256').update(text).digest('hex');
export function assertInside(root, target) {
  assert(path.isAbsolute(target),'Test path must be absolute');
  const base=fs.realpathSync(root);
  let parent=path.resolve(target),leaf=[];
  while(!fs.existsSync(parent)){leaf.unshift(path.basename(parent));const next=path.dirname(parent);assert.notEqual(next,parent,'No existing path ancestor');parent=next;}
  const real=path.resolve(fs.realpathSync(parent),...leaf),relative=path.relative(base,real);
  assert(relative!==''&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'Test path escapes isolated root: '+target);
  return real;
}
/** Must be called before any official EXE launch; incomplete/legacy contexts fail closed. */
export function verifyDesktopIsolation(c) {
  assert.equal(c.isolationVersion,1,'Isolation was not prepared before first launch');
  const marker=JSON.parse(fs.readFileSync(path.join(c.root,'.test-owner.json'),'utf8'));
  assert.equal(marker.owner,c.owner,'Test ownership mismatch');
  assert.equal(marker.root,fs.realpathSync(c.root));
  for(const key of ['home','profile','workspace','userData','researchData','attachments','evidence'])assertInside(c.root,c[key]);
  assert.equal(fs.realpathSync(c.profile),fs.realpathSync(path.join(c.home,'profiles/desktop')));
  const patch=fs.readFileSync(path.join(c.profile,'cordis.patch.yml'),'utf8');
  const entries=yaml.load(patch);
  const workspace=entries.filter(e=>e.id==='workspace-controller');
  assert.equal(workspace.length,1,'Exactly one workspace-controller path is required');
  assert.equal(fs.realpathSync(workspace[0].config.documentsDirectory),fs.realpathSync(c.workspace));
  assert.equal(hash(JSON.stringify(workspace[0])),marker.workspaceConfigSha256,'Workspace path changed after preparation');
  assert.equal(path.resolve(c.executable),path.resolve(marker.executable));
  return c;
}
/** Creates fresh owned paths and seals workspace config before returning a launchable context. */
export function prepareDesktopIsolation({parent,executable,targetVersion,patch=[]}) {
  const root=fs.mkdtempSync(path.join(parent,'rubric-efficiency-'));
  const c={isolationVersion:1,owner:randomUUID(),root,executable:path.resolve(executable),targetVersion};
  for(const [key,leaf] of Object.entries({home:'home',workspace:'workspace',userData:'electron-user',researchData:'research-data',attachments:'attachments',evidence:'evidence'})){c[key]=path.join(root,leaf);fs.mkdirSync(c[key],{recursive:true});}
  c.profile=path.join(c.home,'profiles/desktop');fs.mkdirSync(c.profile,{recursive:true});
  const workspace={id:'workspace-controller',config:{documentsDirectory:c.workspace}};
  assert(!patch.some(e=>e.id==='workspace-controller'),'Duplicate workspace patch');
  fs.writeFileSync(path.join(c.profile,'package.json'),JSON.stringify({name:'dsh-profile-desktop',private:true,dsh:{profile:{bundles:['@deepseek-ai/dsh-base','@deepseek-ai/dsh-web-app']}}},null,2));
  fs.writeFileSync(path.join(c.profile,'cordis.yml'),'[]\n');
  fs.writeFileSync(path.join(c.profile,'cordis.patch.yml'),yaml.dump([workspace,...patch]));
  fs.writeFileSync(path.join(root,'.test-owner.json'),JSON.stringify({owner:c.owner,root:fs.realpathSync(root),executable:c.executable,createdAt:new Date().toISOString(),workspaceConfigSha256:hash(JSON.stringify(workspace))}));
  verifyDesktopIsolation(c);return c;
}
/** Every upload/export/plan operation must call this after runtime workspace resolution. */
export function assertTestWrite(c,target) { verifyDesktopIsolation(c);return assertInside(c.root,target); }
export function verifyResolvedWorkspace(c,actualPath) {
  verifyDesktopIsolation(c);const real=assertInside(c.root,actualPath);
  const relative=path.relative(fs.realpathSync(c.workspace),real);
  assert(relative===''||(!relative.startsWith('..')&&!path.isAbsolute(relative)),'Resolved workspace differs from prepared workspace');
  return real;
}
export async function launchIsolatedDesktop(options) {
  if(!process.env.DSH_ACCEPTANCE_CONTEXT)throw Error('An explicit prepared DSH_ACCEPTANCE_CONTEXT is required');
  const c=verifyDesktopIsolation(JSON.parse(fs.readFileSync(process.env.DSH_ACCEPTANCE_CONTEXT,'utf8')));
  if(path.resolve(options.executablePath)!==c.executable||options.cwd!==c.workspace||options.env.DSH_HOME!==c.home)
    throw Error('Launch path/environment differs from prepared context');
  if(!options.args.includes('--user-data-dir='+c.userData))throw Error('Explicit isolated Electron userData required');
  const patch=fs.readFileSync(path.join(c.profile,'cordis.patch.yml'),'utf8');
  const guard=fileURLToPath(new URL('../support/desktop-isolation-guard.mjs',import.meta.url)).replaceAll('\\','/');
  if(!patch.replaceAll('\\','/').includes(guard))throw Error('Runtime isolation guard must be installed before EXE launch');
  options.env.DSH_TEST_ISOLATION_CONTEXT=process.env.DSH_ACCEPTANCE_CONTEXT;
  const {_electron}=await import('playwright');
  const launchedAt=Date.now(),app=await _electron.launch(options);
  try {
    const proof=path.join(c.evidence,'runtime-isolation.jsonl');
    for(let i=0;i<240;i++){
      if(fs.existsSync(proof)&&fs.readFileSync(proof,'utf8').trim().split('\n').some(line=>{const r=JSON.parse(line);return r.kind==='prepared'&&Date.parse(r.at)>=launchedAt;}))return app;
      await new Promise(resolve=>setTimeout(resolve,250));
    }
    throw Error('Runtime workspace-controller isolation proof was not produced');
  }catch(error){await app.close();throw error;}
}
