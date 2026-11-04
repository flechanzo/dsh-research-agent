import type { RemoteResult } from '@deepseek-ai/dsh-typert-protocol'

/** A stream ending without the final result must never look like a successful mutation. */
export async function consumeResearchStream<T>(
  stream: AsyncIterable<{ readonly type: 'progress' } | { readonly type: 'result'; readonly value: T }>,
): Promise<RemoteResult<T>> {
  for await (const event of stream) {
    if (event.type === 'result') return { ok: true, value: event.value }
  }
  throw new Error('科研连接已中断；已完成的检查点已保留，可重试继续。')
}
