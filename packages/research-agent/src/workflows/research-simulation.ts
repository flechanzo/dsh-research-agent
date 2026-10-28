import type { ResearchArtifact } from './research.ts'
import type { ResearchSimulationInput, ResearchSimulationRunner } from './research-coordinator.ts'

/** A fixed, deterministic numerical experiment shipped with the research Host. */
export const RESEARCH_NUMERICAL_SIMULATION_TASK = 'numerical-linear-regression' as const

interface Observation {
  readonly x: number
  readonly y: number
}

const DATASET: readonly Observation[] = [
  { x: 1, y: 2.1 },
  { x: 2, y: 3.9 },
  { x: 3, y: 6.2 },
  { x: 4, y: 8 },
  { x: 5, y: 10.1 },
]

function format(value: number): string {
  return value.toFixed(6)
}

function requireText(artifact: ResearchArtifact, label: string): void {
  if (artifact.content.trim().length === 0) throw new Error(`simulation requires a non-empty ${label} artifact`)
}

/**
 * Create the safe numerical adapter used by the standard research Host.
 *
 * The adapter executes one reviewed, fixed-template least-squares experiment
 * in the Host process. It never evaluates model-generated code, reads files,
 * starts a shell, or accesses the network. Its output is real computed
 * evidence for this numerical smoke task and is not evidence for the user's
 * proposed machine-learning method.
 *
 * @returns A bounded deterministic simulation runner.
 */
export function createNumericalResearchSimulationRunner(): ResearchSimulationRunner {
  return {
    run(input: ResearchSimulationInput, signal?: AbortSignal): Promise<string> {
      return Promise.resolve().then(() => {
        signal?.throwIfAborted()
        requireText(input.idea, 'idea')
        if (input.review !== undefined) requireText(input.review, 'review')
        const seed = input.seed ?? 0
        if (!Number.isSafeInteger(seed) || seed < 0) throw new Error('simulation seed must be a non-negative safe integer')

        const count = DATASET.length
        const meanX = DATASET.reduce((sum, point) => sum + point.x, 0) / count
        const meanY = DATASET.reduce((sum, point) => sum + point.y, 0) / count
        const centeredX = DATASET.map(point => point.x - meanX)
        const centeredY = DATASET.map(point => point.y - meanY)
        const denominator = centeredX.reduce((sum, value) => sum + value * value, 0)
        if (denominator === 0) throw new Error('simulation dataset has no x variance')
        const covariance = DATASET.reduce((sum, point) => sum + (point.x - meanX) * (point.y - meanY), 0)
        const slope = covariance / denominator
        const intercept = meanY - slope * meanX
        const residuals = DATASET.map(point => point.y - (intercept + slope * point.x))
        const sse = residuals.reduce((sum, value) => sum + value * value, 0)
        const total = centeredY.reduce((sum, value) => sum + value * value, 0)
        const mse = sse / count
        const rmse = Math.sqrt(mse)
        const r2 = total === 0 ? 1 : 1 - sse / total
        signal?.throwIfAborted()

        const node = input.researchNodeId === undefined ? 'unknown' : input.researchNodeId
        const branch = input.branchId === undefined ? 'unknown' : input.branchId
        const review = input.review === undefined ? '未提供' : input.review.title
        return [
          '## 数值仿真：固定数据集线性回归基准',
          '',
          '- 状态：completed',
          `- 任务：${RESEARCH_NUMERICAL_SIMULATION_TASK}`,
          '- 执行方式：DSH 内置固定模板；未执行模型生成代码、Shell、Python 或网络请求',
          `- 研究节点：${node}`,
          `- 研究分支：${branch}`,
          `- 候选方法：${input.idea.title}`,
          `- 审查证据：${review}`,
          `- 随机种子记录：${seed}（该固定数据集实验不采样随机数）`,
          `- 数据集：${count} 个观测点，x=1..5，y=[${DATASET.map(point => point.y).join(', ')}]`,
          '',
          '### 实际计算指标',
          '',
          `- 斜率：${format(slope)}`,
          `- 截距：${format(intercept)}`,
          `- MSE：${format(mse)}`,
          `- RMSE：${format(rmse)}`,
          `- R²：${format(r2)}`,
          '',
          '### 可复现记录',
          '',
          '- 算法：普通最小二乘（含截距）',
          '- 数据集与算法常量随适配器版本固定；改变用户想法不会改变该基准数据',
          '- 该结果只证明数值适配器和 ResearchArtifact 链路可运行，不能证明上传论文中的方法有效',
        ].join('\n')
      })
    },
  }
}
