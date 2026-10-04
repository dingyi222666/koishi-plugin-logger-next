/** 视口里的锚点参考线。 */
export type AnchorPosition = 'top' | 'middle' | 'bottom'

/**
 * 视图状态的会话级持久化（sessionStorage，刷新保留、新标签页从零开始）。
 * yOffset 是参考行内相对行首的偏移，不是容易失效的绝对 scrollTop。
 */
export interface ScrollAnchor {
    key: string
    /** 旧版本只保存 key，读取时按 middle + 行中点兼容。 */
    position?: AnchorPosition
    yOffset?: number
}

export interface ViewState {
    /** 滚动锚点：参考行 + 视口参考线 + 行内 y 偏移。 */
    anchor?: ScrollAnchor
    follow: boolean
    source: string
    query: string
    caseSensitive: boolean
    wrap: boolean
    /** 「清空视图」的水位（刷新后仍然生效）。 */
    cleared: { ts: number; id: number } | null
}

const KEY = 'logger-next.view'

export function loadState(): Partial<ViewState> {
    try {
        return JSON.parse(sessionStorage.getItem(KEY) ?? '{}')
    } catch {
        return {}
    }
}

export function saveState(state: ViewState): void {
    try {
        sessionStorage.setItem(KEY, JSON.stringify(state))
    } catch {}
}

export function createStateSaver(read: () => ViewState) {
    let timer: number | undefined
    const save = (): void => saveState(read())
    return {
        save,
        schedule(): void {
            if (timer !== undefined) window.clearTimeout(timer)
            timer = window.setTimeout(() => {
                timer = undefined
                save()
            }, 100)
        },
        cancel(): void {
            if (timer !== undefined) window.clearTimeout(timer)
            timer = undefined
        },
    }
}
