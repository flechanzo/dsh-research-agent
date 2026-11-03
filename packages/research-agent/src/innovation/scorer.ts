/** Rubric §3 and §5: these constants and arithmetic never come from an LLM. */
import type { RubricCategory, RubricContribution, RubricFact, RubricScore } from './schema.ts'
export const RUBRIC_TABLE: Readonly<Record<RubricCategory, readonly [
  number,
  number,
  number,
]>> = {
  A1: [0.5, 0.5, 1], A2: [1, 1, 1.5], A3: [1.5, 1.5, 2], A4: [2, 2, 2],
  B1: [2, 2.5, 2.5], B2: [2.5, 3, 3.5], B3: [3, 3.5, 4], B4: [3.5, 4, 4.5],
  C1: [2, 2.5, 2.5], C2: [2.5, 3, 3.5], C3: [4, 4.5, 5.5], C4: [5, 5.5, 6.5],
  C5: [4.5, 5, 6], C6: [5, 5.5, 6.5], C7: [5.5, 6, 7], C8: [6, 7, 7],
  D1: [6.5, 6.5, 7.5], D2: [7, 7, 8], D3: [7.5, 7.5, 8], D4: [8, 8, 8],
  E1: [2.5, 2.5, 3.5], E2: [3, 3, 4], E3: [4, 4, 4.5], E4: [5, 5, 6], E5: [6, 6, 7],
  E6: [7, 7, 8], E7: [8, 8, 8.5], E8: [8.5, 8.5, 9.5], E9: [9, 9, 10], E10: [9.5, 9.5, 10], E11: [10, 10, 10],
  P1: [2, 2, 3], P2: [3.5, 3.5, 4.5], P3: [5, 5, 6], P4: [6.5, 6.5, 7.5],
}
const caps = '先按 U_i 截断各贡献 S_i；再选最高合格 S_i 为主导，加独立 J；最后仅 min(10,M,S_main+J)，不再按 U_main 截断。'
/** A null score is an absence of a scientific judgement, never a zero. */
export function unscoredRubric(): RubricScore {
  return { candidates: [], mainId: null, U_main: null, S_main: null, J: 0, M: 10, S: null, caps }
}
const normalize = (s: string): string => s.replace(/\s+/gu, ' ').trim().toLowerCase()
/** Canonicalize explicit aliases AND identical quoted facts to defeat renamed fact IDs. */
function factResolver(facts: readonly RubricFact[], groups: readonly (readonly string[])[]): (ids: readonly string[]) => Set<string> {
  const parents = new Map<string, string>()
  const root = (id: string): string => {
    const parent = parents.get(id)
    if (parent === undefined)
      throw new Error('unknown evidence fact: ' + id)
    if (parent === id)
      return id
    const found = root(parent)
    parents.set(id, found)
    return found
  }
  const merge = (a: string, b: string): void => { parents.set(root(a), root(b)) }
  const quotes = new Map<string, string>()
  for (const f of facts) {
    if (parents.has(f.id))
      throw new Error('duplicate fact id: ' + f.id)
    parents.set(f.id, f.id)
    if (f.evidence.length === 0)
      throw new Error('fact lacks source evidence: ' + f.id)
    for (const e of f.evidence) {
      const key = e.sourceId + '|' + normalize(e.quote)
      const old = quotes.get(key)
      if (old !== undefined)
        merge(f.id, old)
      else
        quotes.set(key, f.id)
    }
  }
  for (const group of groups)
    for (const id of group.slice(1)) {
      const first = group.at(0)
      if (first !== undefined)
        merge(first, id)
    }
  return ids => new Set(ids.map(root))
}
function intersects(a: ReadonlySet<string>, b: ReadonlySet<string>): boolean { return [...a].some(x => b.has(x)) }
/** Validate and compute contributions, deduplication, main switches and all caps. */
export function calculateRubricScore(contributions: readonly RubricContribution[], facts: readonly RubricFact[], sameFactGroups: readonly (readonly string[])[], mainline: 'established' | 'failed' | 'unknown'): RubricScore {
  if (mainline === 'unknown' || contributions.some(c => c.eligibility === 'unknown'))
    throw new Error('critical scientific judgement unresolved')
  if (contributions.length === 0)
    throw new Error('no contributions were evaluated')
  if (new Set(contributions.map(c => c.id)).size !== contributions.length)
    throw new Error('duplicate contribution id')
  const resolve = factResolver(facts, sameFactGroups)
  const usedFacts = new Map<string, Set<string>>()
  const rows = contributions.map((c) => {
    const fields = [
      c.categoryFactIds,
      c.baseFactIds,
      c.adaptationFactIds,
      c.independenceFactIds,
      c.validityFactIds,
      c.sourceModuleAssessment.factIds,
    ]
    fields.forEach(resolve)
    const all = resolve([...c.categoryFactIds, ...c.baseFactIds, ...c.adaptationFactIds, ...c.independenceFactIds])
    usedFacts.set(c.id, all)
    if (c.validityFactIds.length === 0)
      throw new Error('validity/duplicate finding lacks facts: ' + c.id)
    if (c.eligibility !== 'verified')
      return {
        id: c.id, category: c.category, L: 0, H: 0, S0: 0, R: 0, R_included: 0, Delta_R: 0, U0: 0, U_class: null, U_i: 0, S_i: 0, j_i: 0, disposition: 'excluded' as const, reason: c.eligibility,
      }
    if (c.category === null)
      throw new Error('verified contribution requires a category')
    const [L, H, U0] = RUBRIC_TABLE[c.category]
    if (!Number.isFinite(c.S0) || !Number.isInteger(c.S0 * 2) || c.S0 < L || c.S0 > H)
      throw new Error('invalid S0 for ' + c.category)
    const reuse = c.category.startsWith('B') || c.category.startsWith('C')
    if (![0, 1, 1.5, 2].includes(c.R) || ![0, c.R].includes(c.R_included))
      throw new Error('invalid R or R_included')
    if (!reuse && (c.R !== 0 || c.R_included !== 0))
      throw new Error('only B/C permit R')
    if (c.categoryFactIds.length === 0)
      throw new Error('classification lacks facts')
    if (c.S0 > L && reuse && c.baseFactIds.length === 0)
      throw new Error('high-end S0 lacks source-module facts')
    const Delta_R = c.R - c.R_included
    if (Delta_R > 0) {
      if (c.adaptationFactIds.length === 0)
        throw new Error('unincluded adaptation lacks independent facts')
      if (intersects(resolve(c.adaptationFactIds), resolve([...c.categoryFactIds, ...c.baseFactIds])))
        throw new Error('adaptation double-counts classification or high-end S0')
    }
    const U_class = c.category.startsWith('B') ? 5 : c.category.startsWith('C') ? 7 : null
    const U_i = reuse ? Math.min(U_class ?? U0, U0 + Delta_R) : U0
    const S_i = Math.min(U_i, c.S0 + Delta_R)
    return {
      id: c.id, category: c.category, L, H, S0: c.S0, R: c.R, R_included: c.R_included, Delta_R, U0, U_class, U_i, S_i, j_i: 0, disposition: 'excluded' as 'main' | 'secondary' | 'excluded', reason: '未选为主导或尚无独立性证据',
    }
  })
  const eligible = rows.filter(row => contributions.find(c => c.id === row.id)?.eligibility === 'verified' && (mainline === 'failed' || contributions.find(c => c.id === row.id)?.servesMainline === true))
  eligible.sort((a, b) => b.S_i - a.S_i || b.U_i - a.U_i || a.id.localeCompare(b.id))
  const main = eligible.at(0)
  if (main === undefined && rows.some(r => r.S_i > 0))
    throw new Error('no verified contribution supports the mainline')
  const consumed = new Set(main === undefined ? [] : usedFacts.get(main.id))
  for (const row of [...rows].sort((a, b) => b.S_i - a.S_i || a.id.localeCompare(b.id))) {
    const c = contributions.find(item => item.id === row.id)
    if (c === undefined)
      throw new Error('missing candidate')
    if (row === main) {
      row.disposition = 'main'
      row.reason = '最高合格 S_i；并列依次按 U_i、稳定贡献 id 选择'
      continue
    }
    if (c.eligibility !== 'verified' || !c.servesMainline || c.independenceFactIds.length === 0 || row.S_i === 0)
      continue
    const all = usedFacts.get(c.id) ?? new Set<string>()
    if (intersects(all, consumed)) {
      row.reason = '与主导或已计次要项复用相同事实；不领取 J'
      continue
    }
    row.j_i = row.S_i <= 2 ? 0.5 : 1
    row.disposition = 'secondary'
    row.reason = '有效、直接补充主线且有独立、互不重叠事实'
    for (const fact of all)
      consumed.add(fact)
  }
  const J = Math.min(1, rows.reduce((sum, row) => sum + row.j_i, 0))
  const M = mainline === 'failed' ? 4 : 10
  return {
    candidates: rows,
    mainId: main?.id ?? null,
    U_main: main?.U_i ?? 0,
    S_main: main?.S_i ?? 0,
    J,
    M,
    S: Math.min(10,
      M,
      (main?.S_i ?? 0) + J),
    caps,
  }
}
