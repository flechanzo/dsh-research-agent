/// <reference types="node" />
/** Immutable rule provenance; no rubric text is copied into Session state. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
export const RUBRIC_VERSION = '1.7.0' as const
export const RUBRIC_SHA256 = '50990acd698ac5fada0f9d055864c982fdec3361fc9bd3542ba96dbd076532ff'
export const ORIGINALITY_SCOPE = '本次仅审查候选方案的创新性：查新、实质计算/概念关系、与先例的差异、类别及去重计分。不审查数据质量、数据集真实性、实验数据、结果真实性或实验复现；不要求已有实验才能评价研究设想。verified仅表示在当前查新范围内可核验其技术描述和创新归属，不代表效果已经验证。候选的性能、因果效果和实验结果均不作为已证实事实或加分依据；缺少这些材料本身不作为拒绝创新性评分的理由。未取得关键先例或技术描述不足以比较时仍保持null，不虚构证据。'
/** Exact built source revision, required before persisted model outputs may cross Host lifetimes. */
export function rubricSourceRevision(): string {
  const root = dirname(createRequire(import.meta.url).resolve('dsh-research-agent/package.json'))
  const manifest = JSON.parse(readFileSync(join(root, 'lib/build-manifest.json'), 'utf8')) as { sourceSha256?: string }
  if (!manifest.sourceSha256 || !/^[a-f0-9]{64}$/u.test(manifest.sourceSha256)) throw new Error('Rubric build identity unavailable')
  return manifest.sourceSha256
}
/** Load and authenticate the packaged, unmodified rule document. */
export function loadInnovationRubric(): string {
  const root = dirname(createRequire(import.meta.url).resolve('dsh-research-agent/package.json'))
  const bytes = readFileSync(join(root, 'resources/rubrics/innovation/rubric_v1.7.0.md'))
  if (createHash('sha256').update(bytes).digest('hex') !== RUBRIC_SHA256)
    throw new Error('Rubric 1.7.0 integrity mismatch')
  return bytes.toString('utf8')
}
/** User-selected subset; the packaged source and its provenance remain unchanged. */
export function loadOriginalityRubric(): string {
  return loadInnovationRubric().replace(/### 2\.5 有效性核验最低标准[\s\S]*?(?=### 2\.6)/u,
    '### 2.5 本次审查范围\n\n' + ORIGINALITY_SCOPE + '\n\n') + '\n\n本次范围优先于完整论文评估流程中的实验有效性要求：' + ORIGINALITY_SCOPE
}
