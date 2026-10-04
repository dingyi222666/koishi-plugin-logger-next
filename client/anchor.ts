import type { ScrollAnchor } from './state'

export interface AnchorRow {
    key: string
}

export interface AnchorLayout {
    length: number
    totalHeight: number
    find(offset: number): number
    prefix(index: number): number
    height(index: number): number
}

/** 保存视口上 / 中 / 下参考线命中的行，以及参考线在行内的偏移。 */
export function captureAnchor(
    el: HTMLElement,
    rows: readonly AnchorRow[],
    layout: AnchorLayout,
): ScrollAnchor | undefined {
    if (rows.length === 0 || layout.length === 0) return
    const max = Math.max(0, el.scrollHeight - el.clientHeight)
    const position =
        el.scrollTop <= 1 ? 'top' : max - el.scrollTop <= 1 ? 'bottom' : 'middle'
    const reference =
        position === 'top'
            ? el.scrollTop
            : position === 'bottom'
              ? el.scrollTop + el.clientHeight
              : el.scrollTop + el.clientHeight / 2
    const index = layout.find(reference)
    const row = rows[index]
    if (!row) return
    return { key: row.key, position, yOffset: reference - layout.prefix(index) }
}

/** 按保存的参考线和行内偏移恢复滚动位置，返回命中的行下标。 */
export function restoreAnchor(
    el: HTMLElement,
    anchor: ScrollAnchor,
    rows: readonly AnchorRow[],
    layout: AnchorLayout,
): number {
    const index = rows.findIndex((row) => row.key === anchor.key)
    if (index < 0) return -1
    const position = anchor.position ?? 'middle'
    const yOffset = Number.isFinite(anchor.yOffset)
        ? anchor.yOffset!
        : layout.height(index) / 2
    const viewportOffset =
        position === 'top'
            ? 0
            : position === 'bottom'
              ? el.clientHeight
              : el.clientHeight / 2
    const target = layout.prefix(index) + yOffset - viewportOffset
    const max = Math.max(0, layout.totalHeight - el.clientHeight)
    el.scrollTop = Math.min(max, Math.max(0, target))
    return index
}
