import {describe,expect,it} from 'vitest'
import {researchDomain} from '../packages/research-agent/lib/index.js'
import {appendResearchOutput,createResearchState} from '../packages/research-agent/src/workflows/research.ts'
function row(){return {revision:2,updatedAt:1,state:appendResearchOutput(createResearchState(),{stage:'paper-read',kind:'summary',title:'Synthetic summary',content:'Synthetic fixture only'})}}
const schema=researchDomain.tables.sessions.valueSchema

describe('F19 durable research DAG integrity',()=>{
 it('keeps a valid v1 DAG and its legacy web alias readable',()=>{const r=row();r.state.nodes['node-1']!.memorySnapshot.literatureSources=['web','arxiv'];expect(schema.safeParse(r).success).toBe(true)})
 it('rejects a missing selected node',()=>{const r=row();r.state.selectedNodeId='missing';expect(schema.safeParse(r).success).toBe(false)})
 it('rejects a missing active branch',()=>{const r=row();r.state.activeBranchId='missing';expect(schema.safeParse(r).success).toBe(false)})
 it('rejects a dangling parent node',()=>{const r=row();r.state.nodes['node-2']!.parentNodeId='missing';expect(schema.safeParse(r).success).toBe(false)})
 it('rejects a parent self cycle',()=>{const r=row();r.state.nodes['node-1']!.parentNodeId='node-1';expect(schema.safeParse(r).success).toBe(false)})
 it('rejects a multi-node parent cycle',()=>{const r=row();r.state.nodes['node-1']!.parentNodeId='node-2';expect(schema.safeParse(r).success).toBe(false)})
 it('rejects a missing artifact reference',()=>{const r=row();r.state.nodes['node-2']!.artifactRefs.push('missing');expect(schema.safeParse(r).success).toBe(false)})
 it('rejects a branch containing a missing node',()=>{const r=row();r.state.branches['branch-1']!.nodeIds.push('missing');expect(schema.safeParse(r).success).toBe(false)})
})
