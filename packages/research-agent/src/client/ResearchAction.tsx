import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'
import css from './ResearchAction.module.css'

/** Runtime face supplied by the plugin for the header action. */
export interface ResearchActionInjected {
  readonly open: () => void
}

/** Props for the session header action. */
export type ResearchActionProps = PropsRuntime<'conversation.session.header.actions'> & PropsLocale<'researchAgent'> & ResearchActionInjected

/** Open the research branch navigator for the current Session. */
export function ResearchAction({ open, t }: ResearchActionProps) {
  return <button type="button" className={css.action} title={t('research.open')} aria-label={t('research.open')} onClick={open}><IconBranchOutlineRegular size={15} />{t('research.title')}</button>
}
