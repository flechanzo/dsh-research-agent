// @vitest-environment jsdom
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { SessionId } from '@deepseek-ai/dsh-session'
import type { ResearchRemote } from '../packages/research-agent/src/client/remote-types.ts'
import { TargetTaskEditor } from '../packages/research-agent/src/client/TargetTaskEditor.tsx'
import { taskFields } from './support/rubric-fixture.mjs'
afterEach(cleanup)
it('requires repairing unresolved scope before the confirmation checkbox can be used', async () => {
  const research = { proposeTargetTask: async () => ({ ok: true, value: {
    fields: { ...taskFields, problem: '最终任务表述待用户确认。' }, contextDigest: 'a'.repeat(64),
  } }) } as unknown as ResearchRemote
  const onChange = vi.fn()
  const view = render(<TargetTaskEditor research={research} sessionId={SessionId('target-fix')} revision={1}
    signal={new AbortController().signal} onChange={onChange} />)
  const checkbox = await view.findByRole('checkbox') as HTMLInputElement
  expect(checkbox.disabled).toBe(true)
  expect(view.getByRole('alert').textContent).toContain('具体任务或问题')
  fireEvent.change(view.getByLabelText('具体任务或问题'), { target: { value: '检验幅值方向分解的低秩适配与全量微调的能力差距。' } })
  await waitFor(() => expect(checkbox.disabled).toBe(false))
  fireEvent.click(checkbox)
  expect(onChange.mock.lastCall?.[0].confirmed).toBe(true)
})
