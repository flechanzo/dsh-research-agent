/** Synchronous research delegation on DSH 0.2 managed activations. */
import type { SubagentRuntime, SubagentStartRequest, SubagentActivation } from '@deepseek-ai/dsh-subagent'

/** Start a caller-owned activation and retain cancellation after publication.
 * @param runtime - Target DSH subagent service.
 * @param provider - Registered provider.
 * @param request - Research task and lifetime cancellation.
 * @returns Activation whose disposal awaits cancellation cleanup.
 */
export async function startResearchRun(
  runtime: SubagentRuntime,
  provider: string,
  request: SubagentStartRequest,
): Promise<SubagentActivation> {
  const { signal, label = 'research', ...task } = request
  const run = await runtime.startActivation({ provider, label, request: task, signal, delivery: 'caller' })
  let disposal: Promise<void> | undefined
  const dispose = (): Promise<void> => disposal ??= run.dispose()
  const abort = (): void => {
    // Event dispatch cannot await; the returned dispose observes the same rejection.
    void dispose().catch((_error: unknown) => undefined)
  }
  signal.addEventListener('abort', abort, { once: true })
  if (signal.aborted) abort()
  return { ...run, result: run.result.finally(() => { signal.removeEventListener('abort', abort) }), async dispose() {
    signal.removeEventListener('abort', abort)
    await dispose()
  } }
}
