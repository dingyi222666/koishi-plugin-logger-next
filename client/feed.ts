/**
 * 日志 feed（`store.logs` 的视图层派生）。
 *
 * koishi console 的数据面：客户端接入时服务端下发 `data`（DataService `get()`
 * 的整份快照，即当前日志文件里的全部历史），之后每次
 * `ctx.console.patch('logs', batch)` 以 `patch` 事件追加。快照与增量之间可能
 * 重叠（同一进程内 `id` 唯一，跨重启会重置），这里按 `timestamp:id` 去重——
 * 不截断、不排序，打开就是全部。
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
