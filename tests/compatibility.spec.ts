import {it,expect} from 'vitest'
import {researchDomain} from '../packages/research-agent/lib/index.js'
import {createResearchState} from '../packages/research-agent/src/workflows/research.ts'
it('preserves the legacy v1 web alias and ancestors when parsing a durable row',()=>{
 const state=createResearchState();const root=state.nodes['node-1']!
 const row={revision:7,updatedAt:1,state:{...state,nodes:{...state.nodes,'node-1':{...root,memorySnapshot:{...root.memorySnapshot,literatureSources:['web','arxiv']}}}}}
 expect(researchDomain.version).toBe(1)
 expect(researchDomain.tables.sessions.valueSchema.parse(row)).toEqual(row)
})
