/// <reference types="node" />
/** Immutable rule provenance; no rubric text is copied into Session state. */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
export const RUBRIC_VERSION = '1.7.0' as const
export const RUBRIC_SHA256 = '50990acd698ac5fada0f9d055864c982fdec3361fc9bd3542ba96dbd076532ff'
/** Load and authenticate the packaged, unmodified rule document. */
export function loadInnovationRubric(): string {
  const root = dirname(createRequire(import.meta.url).resolve('dsh-research-agent/package.json'))
  const bytes = readFileSync(join(root, 'resources/rubrics/innovation/rubric_v1.7.0.md'))
  if (createHash('sha256').update(bytes).digest('hex') !== RUBRIC_SHA256)
    throw new Error('Rubric 1.7.0 integrity mismatch')
  return bytes.toString('utf8')
}
