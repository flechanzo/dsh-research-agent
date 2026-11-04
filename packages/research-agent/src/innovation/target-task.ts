import type { TargetTaskFields } from './schema.ts'

export const TARGET_TASK_LABELS: Record<keyof TargetTaskFields, string> = {
  domain: '研究领域', problem: '具体任务或问题', input: '输入', output: '输出', constraints: '约束',
  conditions: '适用条件', subtaskBoundary: '必要子任务边界', comparisonPoint: '比较时点（YYYY-MM-DD）',
}

/** Validate new confirmations without making historical research v1 records unreadable. */
export function targetTaskIssues(fields: TargetTaskFields): string[] {
  return Object.entries(TARGET_TASK_LABELS).flatMap(([name, label]) => {
    const value = fields[name as keyof TargetTaskFields].trim()
    if (!value) return [label + '不能为空']
    if (/待.{0,8}(?:确认|确定|补充)|尚未.{0,6}(?:确认|确定)|\b(?:unknown|unspecified|TBD|TODO)\b/iu.test(value))
      return [label + '仍包含未确认内容；请填写具体范围，或明确写出“不限定”的范围']
    if (name === 'comparisonPoint' && (!/^\d{4}-\d{2}-\d{2}$/u.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value))
      return [label + '必须是有效日期']
    return []
  })
}
