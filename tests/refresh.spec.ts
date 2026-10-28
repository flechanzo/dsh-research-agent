import {it,expect,vi} from 'vitest'
import {SessionId} from '@deepseek-ai/dsh-session'
import {createResearchState} from '../packages/research-agent/src/workflows/research.ts'
import {loadResearchSession,publishResearchSession,researchSessionSnapshot} from '../packages/research-agent/src/client/research-session-store.ts'
it('F01/F08 refreshes a cached revision after a committed command fails during export',async()=>{
 const sessionId=SessionId('acceptance-export-refresh');const state=createResearchState()
 publishResearchSession(sessionId,{sessionId,revision:4,state})
 const remote={read:vi.fn(async()=>({ok:true as const,value:{sessionId,revision:5,state}}))}
 await loadResearchSession(remote,sessionId)
 expect(remote.read).toHaveBeenCalledOnce()
 expect(researchSessionSnapshot(sessionId)?.revision).toBe(5)
})
