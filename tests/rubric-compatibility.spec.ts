import { rubricAssessmentSchema } from '../packages/research-agent/src/innovation/schema.ts'
import { expect, it } from 'vitest'
import { researchDomain } from '../packages/research-agent/lib/index.js'
import { appendResearchOutput, createResearchState, continueFromResearchNode } from '../packages/research-agent/src/workflows/research.ts'
import { insufficientRubric } from '../packages/research-agent/src/innovation/pipeline.ts'
import { taskFields } from './support/rubric-fixture.mjs'
const schema=researchDomain.tables.sessions.valueSchema
it('reads old v1 records without Rubric and preserves the exact historical 0–100 evaluation',()=>{
 const evaluation={score:83,threshold:70,overlap:false,rationale:'历史评分不重算'}
 const state=appendResearchOutput(createResearchState(),{stage:'idea-generation',kind:'idea',title:'旧结果',content:'创新点：旧结果',evaluation})
 const result=schema.parse({revision:12,state,updatedAt:1})
 expect(result.state.artifacts['artifact-1']?.evaluation).toEqual(evaluation)
 expect(result.state.artifacts['artifact-1']?.rubricAssessment).toBeUndefined()
 expect(researchDomain.version).toBe(1)
})
it('round-trips optional assessment and copies immutable task snapshots across branch continuation',()=>{
 const task={...taskFields,contextDigest:'a'.repeat(64),confirmedAt:1}
 const base=createResearchState();const root=base.nodes[base.selectedNodeId]!
 const withTask={...base,nodes:{...base.nodes,[root.nodeId]:{...root,memorySnapshot:{...root.memorySnapshot,targetTask:task}}}}
 const state=appendResearchOutput(withTask,{stage:'idea-generation',kind:'idea',title:'新结果',content:'创新点：新结果',rubricAssessment:insufficientRubric(task,'未联网')})
 const parsed=schema.parse({revision:2,state,updatedAt:2})
 const a=parsed.state.artifacts['artifact-1']!.rubricAssessment!
 expect(a.score.S).toBeNull();expect(a.targetTask).toEqual(task)
 const continued=continueFromResearchNode(parsed.state,parsed.state.selectedNodeId)
 expect(continued.nodes[continued.selectedNodeId]!.memorySnapshot.targetTask).toEqual(task)
 expect(parsed.state.artifacts['artifact-1']!.rubricAssessment).toEqual(a)
})

it('rejects contradictory assessment status, unsupported numeric claims and quarter-step scores',()=>{
 const a=insufficientRubric(null,'未联网')
 expect(rubricAssessmentSchema.safeParse({...a,score:{...a.score,S:0}}).success).toBe(false)
 expect(rubricAssessmentSchema.safeParse({...a,assessmentStatus:'complete'}).success).toBe(false)
 expect(rubricAssessmentSchema.safeParse({...a,assessmentStatus:'complete',score:{...a.score,S:0.25}}).success).toBe(false)
})
