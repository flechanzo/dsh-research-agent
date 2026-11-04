import {afterEach, describe, expect, it} from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {prepareDesktopIsolation,verifyDesktopIsolation,assertTestWrite,verifyResolvedWorkspace} from './acceptance/desktop-isolation.mjs'
const roots:string[]=[]
afterEach(()=>{for(const r of roots.splice(0))fs.rmSync(r,{recursive:true,force:true})})
function setup(){const parent=fs.mkdtempSync(path.join(os.tmpdir(),'rubric-isolation-test-'));roots.push(parent);return prepareDesktopIsolation({parent,executable:path.join(parent,'official.exe'),targetVersion:'fixture'})}
describe('Desktop isolation fails closed before EXE startup',()=>{
 it('prepares all paths before a launchable context exists',()=>{const c=setup();expect(verifyDesktopIsolation(c)).toBe(c);expect(assertTestWrite(c,path.join(c.workspace,'new','plan.md'))).toContain(c.workspace)})
 it('rejects old initialization order and missing configuration',()=>{const c=setup();expect(()=>verifyDesktopIsolation({...c,isolationVersion:undefined})).toThrow(/before first launch/);fs.writeFileSync(path.join(c.profile,'cordis.patch.yml'),'[]');expect(()=>verifyDesktopIsolation(c)).toThrow(/workspace-controller/)})
 it('rejects a formal F drive fallback and changed workspace config',()=>{const c=setup();expect(()=>assertTestWrite(c,'F:\\research\\plan.md')).toThrow();expect(()=>verifyResolvedWorkspace(c,path.dirname(c.root))).toThrow();fs.writeFileSync(path.join(c.profile,'cordis.patch.yml'),'- id: workspace-controller\n  config:\n    documentsDirectory: F:/research\n');expect(()=>verifyDesktopIsolation(c)).toThrow()})
 it('rejects traversal and a sibling root sharing the same prefix',()=>{const c=setup();expect(()=>assertTestWrite(c,path.join(c.root,'..',path.basename(c.root)+'-other','plan.md'))).toThrow(/escapes/);expect(()=>assertTestWrite(c,path.join(c.workspace,'..','..','plan.md'))).toThrow(/escapes/)})
 it('resolves junctions before accepting write paths',()=>{const c=setup();const outside=fs.mkdtempSync(path.join(os.tmpdir(),'rubric-outside-'));roots.push(outside);fs.symlinkSync(outside,path.join(c.workspace,'escape'),'junction');expect(()=>assertTestWrite(c,path.join(c.workspace,'escape','plan.md'))).toThrow(/escapes/)})
 it('rejects forged ownership and verifies actual controller path',()=>{const c=setup();expect(()=>verifyDesktopIsolation({...c,owner:'other'})).toThrow(/ownership/);expect(verifyResolvedWorkspace(c,c.workspace)).toBe(fs.realpathSync(c.workspace));expect(()=>verifyResolvedWorkspace(c,c.home)).toThrow(/differs/)})
})
