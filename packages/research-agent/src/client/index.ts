import { TYPERT_REMOTE } from '../../lib/typert.remote-client.js'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
/** Native sidebar and session-header integration for automatic research. */
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-api-gateway/client'
import type {} from '@deepseek-ai/dsh-client-file-upload/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar-right/client'
import type {} from 'dsh-research-agent/remote'
import { ResearchPanel } from './ResearchPanel.tsx'
import { ResearchTitle } from './ResearchTitle.tsx'
import { ResearchAction } from './ResearchAction.tsx'
import { researchDefinition, RESEARCH_ID, RESEARCH_KIND } from './research-definition.ts'
import { NS, en, zh, type WorkflowRunKey } from './locales.ts'
export type * from '../types.ts'
export type { ResearchRemote } from './remote-types.ts'
declare module '@deepseek-ai/dsh-client-ui-slots' { interface LocaleNamespaceMap { researchAgent: WorkflowRunKey } }
export const inject = ['slots', 'locale', 'sidebarRightTabs', 'sidebarRight', 'remote', 'fileUpload']
/** Register research navigation and its complete checkpoint panel.
 * @param ctx - Desktop browser context.
 */
export async function apply(ctx: Context): Promise<void> {
  const disposeRemote = await ctx.remote.$mount(TYPERT_REMOTE)
  ctx.effect(() => disposeRemote)
  ctx.inject(['remote.research'], (ctx) => {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }))
  const t = ctx.locale.bind(NS)
  ctx.effect(() => ctx.sidebarRightTabs.register(researchDefinition(t)))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab', key: RESEARCH_ID, locale: NS,
    inject: () => ({ research: ctx.remote.research, fileUpload: ctx.fileUpload }),
  }, ResearchPanel)))
  ctx.effect(() => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
    name: 'sidebar.right.pane.tab.title', key: RESEARCH_ID, locale: NS,
  }, ResearchTitle)))
  ctx.effect(() => ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions', id: 'research-agent-open', order: 30, locale: NS,
    inject: (sessionId) => ({ open: () => ctx.sidebarRight.openTab(RESEARCH_KIND, { params: { sessionId } }) }),
  }, ResearchAction)))
  })
}
