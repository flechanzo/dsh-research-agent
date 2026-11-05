import {it,expect} from 'vitest'
import {compareReviews,type ReviewSubmission} from '../packages/research-agent/src/innovation/reviews.ts'
const make=(id:string,kind:ReviewSubmission['reviewer']['kind']='model'):ReviewSubmission=>({caseId:'case',targetTaskDigest:'a'.repeat(64),comparisonPoint:'2026-11-02',rubricSha256:'b'.repeat(64),reviewer:{id,kind,affiliation:'declared affiliation',expertise:'declared domain',independenceDeclaration:'must be externally verified'},reviewedAt:'2026-11-02T12:00:00Z',actualNetworkAudit:[1,2,3].map(n=>({query:'distinct '+n,at:'2026-11-02',sourceUrls:['https://example.test/paper'],bodyHashes:['c'.repeat(64)]})),status:'insufficient',score:null,mainId:null,categories:{c:null},R:{c:0},J:0,disagreements:[]})
it('multiple model outputs never constitute expert calibration',()=>{const r=compareReviews([make('m1'),make('m2')]);expect(r.independentExpertReviewCount).toBe(0);expect(r.expertCalibrationComplete).toBe(false);expect(r.pairs).toHaveLength(1)})
it('expert declarations permit reconciliation preparation without claiming calibration',()=>{const r=compareReviews([make('a','human-domain-expert'),make('b','human-domain-expert')]);expect(r.independentExpertReviewCount).toBe(2);expect(r.expertCalibrationComplete).toBe(false)})
it('rejects mismatched target task, date and reviewer identity',()=>{
 expect(()=>compareReviews([make('a'),{...make('b'),comparisonPoint:'2025-01-01'}])).toThrow(/different tasks/)
 expect(()=>compareReviews([make('a'),{...make('b'),targetTaskDigest:'d'.repeat(64)}])).toThrow()
 expect(()=>compareReviews([make('a'),make('a')])).toThrow(/Duplicate/)
})
it('does not convert missing score into numerical agreement',()=>{expect(compareReviews([make('a'),make('b')]).pairs[0]?.absoluteScoreDifference).toBeNull()})
it('accepts historical numeric fields without invoking a scorer',()=>{
 const result=compareReviews([{...make('a'),status:'complete',score:7},{...make('b'),status:'complete',score:8}])
 expect(result.pairs[0]?.absoluteScoreDifference).toBeNull()
 expect(result.expertCalibrationComplete).toBe(false)
})

