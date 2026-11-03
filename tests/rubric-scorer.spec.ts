import { describe, expect, it } from 'vitest'
import { calculateRubricScore, RUBRIC_TABLE } from '../packages/research-agent/src/innovation/scorer.ts'
import { contributionSchema, type RubricCategory, type RubricFact } from '../packages/research-agent/src/innovation/schema.ts'
const fact=(id:string):RubricFact=>({id,statement:id,evidence:[{sourceId:'synthetic-original',location:id,quote:'Independently verified structural evidence for '+id}]})
function c(id:string,category:RubricCategory,S0=RUBRIC_TABLE[category][0],R=0,R_included=0){
 return contributionSchema.parse({id,claim:id,core:true,kind:'algorithm',evidence:fact(id).evidence,category,S0,R,R_included,eligibility:'verified',servesMainline:true,validityReview:'独立核验通过',validityFactIds:[id+'v'],categoryFactIds:[id+'c'],baseFactIds:[id+'b'],adaptationFactIds:[id+'r'],independenceFactIds:[id+'i'],sourceModuleAssessment:{origin:'来源',attribution:'归属',novelty:'新颖性',necessaryComplexity:'必要复杂性',role:'作用',factIds:[id+'s']},problemComparison:{oldProblem:'旧问题',newProblem:'新问题',obstacle:'障碍',mapping:'对应',effect:'作用证据',deduplication:'不同事实'},boundaryChecks:{lowerCategory:'边界',coreRelation:'计算关系',basicPrinciple:'基本原则',problemNonEquivalence:'非等价',nonFragmentation:'未拆分',c8HighEnd:'高端证据',e9Conditions:'基础门槛'}})
}
const facts=(cs:ReturnType<typeof c>[])=>cs.flatMap(k=>['v','c','b','r','i','s'].map(suffix=>fact(k.id+suffix)))
const score=(cs:ReturnType<typeof c>[],mainline:'established'|'failed'='established')=>calculateRubricScore(cs,facts(cs),[],mainline)
describe('Rubric 1.7.0 document §7 arithmetic examples',()=>{
 it.each([
  ['B2 same',c('m','B2',2.5),[],2.5],['B2 high',c('m','B2',3),[],3],
  ['B2 adaptation',c('m','B2',2.5,1),[],3.5],
  ['B3 plus two A2',c('m','B3',3.5,1),[c('a','A2'),c('b','A2')],5.5],
  ['B4 plus E1',c('m','B4',4,1),[c('e','E1')],6],
  ['C1',c('m','C1'),[],2],['C2',c('m','C2'),[],2.5],['C2 high R',c('m','C2',3,1),[],4],
  ['C3 included',c('m','C3',4,1.5,1.5),[],4],['C4 included',c('m','C4',5,2,2),[],5],
  ['C6 E1',c('m','C6'),[c('e','E1')],6],['C5 A2',c('m','C5'),[c('a','A2')],5],
  ['C8 middle E1',c('m','C8',6.5),[c('e','E1')],7.5],['C8 high E1',c('m','C8',7),[c('e','E1')],8],
  ['C8 high alone',c('m','C8',7),[],7],['A4 two A2',c('m','A4'),[c('a','A2'),c('b','A2')],3],
  ['D1',c('m','D1'),[],6.5],['D3',c('m','D3'),[],7.5],['D1 multiple C6',c('m','D1'),[c('a','C6'),c('b','C6')],7.5],
  ['D4 E1',c('m','D4'),[c('e','E1')],9],['E7 E1',c('m','E7'),[c('e','E1')],9],
  ['E11 cap',c('m','E11'),[c('e','E1')],10],['P3',c('m','P3'),[],5],['P4 E1',c('m','P4'),[c('e','E1')],7.5],
  ['E5',c('m','E5'),[],6],['B1 two A2 beyond Umain',c('m','B1'),[c('a','A2'),c('b','A2')],3],
 ] as const)('%s',(_name,main,secondary,expected)=>{const r=score([main,...secondary]);expect(r.S).toBe(expected);expect(r.S_main).toBeLessThanOrEqual(r.U_main??10)})
 it('M=4 caps without setting a floor',()=>{expect(score([c('m','C6'),c('b','B2')],'failed').S).toBe(4);expect(score([c('m','A2')],'failed').S).toBe(1)})
 it('promotes a stronger secondary',()=>{const r=score([c('b','B2'),c('c','C6')]);expect(r.mainId).toBe('c');expect(r.S).toBe(6)})
 it('does not decrease when a stronger B4 switches main',()=>{expect(score([c('c','C3',4.5),c('e','E1')]).S).toBe(5.5);expect(score([c('c','C3',4.5),c('e','E1'),c('b','B4',4,1)]).S).toBe(6)})
 it('excludes an invalid D2 and keeps a verified C5',()=>{expect(score([{...c('d','D2'),eligibility:'invalid'},c('c','C5')]).S).toBe(4.5)})
})
it.each(Object.keys(RUBRIC_TABLE) as RubricCategory[])('supports %s fixed or interval base with half steps',category=>{
 const r=score([c('m',category)]);expect(r.S).toBe(RUBRIC_TABLE[category][0]);expect(Number.isInteger((r.S??0)*2)).toBe(true)
})
it.each([0.25,3.75,NaN])('rejects illegal S0 %s',n=>expect(()=>score([{...c('m','B3'),S0:n}])).toThrow())
it('does not confuse P4 U0 with S0',()=>{const r=score([c('p','P4')]);expect(r.U_main).toBe(7.5);expect(r.S).toBe(6.5)})
it('rejects R outside B/C and partial R_included',()=>{
 expect(()=>score([{...c('a','A4'),R:1}])).toThrow();expect(()=>score([{...c('b','B3',3,1.5),R_included:1}])).toThrow()
})
it('rejects repeated adaptation and missing high-end facts',()=>{
 const a=c('b','B4',4,1);expect(()=>score([{...a,adaptationFactIds:a.baseFactIds}])).toThrow(/double-counts/)
 expect(()=>score([{...a,baseFactIds:[]}])).toThrow(/high-end/)
})
it('denies J for alias facts and identical quotes under new IDs',()=>{
 const cs=[c('m','C8',7),c('a','A2')];const f=facts(cs)
 expect(calculateRubricScore(cs,f,[['mc','ac']],'established').J).toBe(0)
 const same=f.map(k=>k.id==='ac'?{...k,evidence:f.find(v=>v.id==='mc')!.evidence}:k)
 expect(calculateRubricScore(cs,same,[],'established').J).toBe(0)
})
it('returns verified duplicate zero but rejects unresolved scientific judgements',()=>{
 const d={...c('d','A2'),eligibility:'duplicate' as const,category:null,S0:0}
 expect(score([d]).S).toBe(0);expect(()=>score([{...d,eligibility:'unknown'}])).toThrow(/unresolved/)
})
