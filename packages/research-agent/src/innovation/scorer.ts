import type { RubricScore } from './schema.ts'

const caps = '自动 Rubric 评分已停用；此值仅用于读取历史记录。'

/**
 * Historical assessment rows may still contain a score object. New workflow
 * stages never calculate or emit a numeric Rubric score.
 */
export function unscoredRubric(): RubricScore {
  return { candidates: [], mainId: null, U_main: null, S_main: null, J: 0, M: 10, S: null, caps }
}

