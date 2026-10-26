import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconBranchOutlineRegular } from '@deepseek-ai/dsh-client-ui-primitives'

/** Title renderer for the research workflow page tab. */
export function ResearchTitle({ useTabInfo }: PropsRuntime<'sidebar.right.pane.tab.title'>) {
  const { tab } = useTabInfo()
  return <><IconBranchOutlineRegular size={14} />{tab.title}</>
}
