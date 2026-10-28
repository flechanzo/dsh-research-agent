import type {ReactNode} from 'react'
// Host-owned rendering is exercised in Electron; unit tests isolate plugin interactions.
export const Tooltip=({children}:{children:ReactNode})=>children
export const MarkdownText=({text}:{text:string})=><div>{text}</div>
export const IconBranchOutlineRegular=()=>null
export const IconChevronDownOutlineRegular=()=>null
export const IconChevronRightOutlineRegular=()=>null
export const IconInspectOutlineRegular=()=>null
export const IconSearchOutlineRegular=()=>null
export const IconSlidersTwoOutlineRegular=()=>null
export const IconWorkspaceTreeOutlineRegular=()=>null
export const IconCheckOutlineRegular=()=>null
export const IconFlatListOutlineRegular=()=>null
export const IconPlayOutlineRegular=()=>null
