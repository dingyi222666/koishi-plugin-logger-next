/**
 * 日志 feed（`store.logs` 的视图层派生）。
 *
 * 服务端 `get()` 只下发最近的窗口，`logs/fetch` 往前回拉更早的历史，`patch`
 * 往后追加新日志。快照与增量之间可能重叠（同一进程内 `id` 唯一，跨重启会重置），
 * 这里按 `timestamp:id` 去重。
 */
import type { Logger } from 'koishi'

export function buildFeed(
    logs: readonly Logger.Record[] | undefined
): Logger.Record[] {
    if (!logs || logs.length === 0) return []
    const seen = new Set<string>()
    const entries: Logger.Record[] = []
    for (const entry of logs) {
        const key = `${entry.timestamp}:${entry.id}`
        if (seen.has(key)) continue
        seen.add(key)
        entries.push(entry)
    }
    return entries
}
