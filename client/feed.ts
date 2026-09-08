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

/** 去重键：`id` 跨进程会重置，必须带上时间戳。 */
const keyOf = (entry: Logger.Record): string =>
    `${entry.timestamp}:${entry.id}`

/** 纯函数版：整份去重（首屏快照 / 数组被整体替换时用）。 */
export function buildFeed(
    logs: readonly Logger.Record[] | undefined
): Logger.Record[] {
    if (!logs || logs.length === 0) return []
    const seen = new Set<string>()
    const entries: Logger.Record[] = []
    for (const entry of logs) {
        const key = keyOf(entry)
        if (seen.has(key)) continue
        seen.add(key)
        entries.push(entry)
    }
    return entries
}

export interface FeedCache {
    /** 增量去重：返回当前完整 feed（追加时原地 push，引用不变）。 */
    update(logs: readonly Logger.Record[] | undefined): Logger.Record[]
}

/**
 * 增量 feed：快照之后 `store.logs` 只会尾部追加，因此缓存已处理长度与去重
 * 集合，只处理新增的尾部，避免每次 patch 都对整份列表做 O(N) 去重。
 * 数组被整体替换（重连 / 首屏）时自动退回整份去重。
 */
export function createFeed(): FeedCache {
    let input: readonly Logger.Record[] | undefined
    let processed = 0
    let feed: Logger.Record[] = []
    let seen = new Set<string>()

    /** 首 / 中 / 尾三个点都一致，才认为是「纯尾部追加」。 */
    const appendOnly = (logs: readonly Logger.Record[]): boolean => {
        if (input === undefined || processed === 0) return false
        if (logs.length <= processed) return false
        const mid = processed >> 1
        return (
            logs[0] === input[0] &&
            logs[mid] === input[mid] &&
            logs[processed - 1] === input[processed - 1]
        )
    }

    return {
        update(logs) {
            if (!logs || logs.length === 0) {
                if (processed !== 0 || feed.length !== 0) {
                    input = logs
                    processed = 0
                    feed = []
                    seen = new Set()
                }
                return feed
            }
            if (input === logs && processed === logs.length) return feed
            if (appendOnly(logs)) {
                for (let i = processed; i < logs.length; i++) {
                    const entry = logs[i]!
                    const key = keyOf(entry)
                    if (seen.has(key)) continue
                    seen.add(key)
                    feed.push(entry)
                }
                input = logs
                processed = logs.length
                return feed
            }
            const nextSeen = new Set<string>()
            const nextFeed: Logger.Record[] = []
            for (const entry of logs) {
                const key = keyOf(entry)
                if (nextSeen.has(key)) continue
                nextSeen.add(key)
                nextFeed.push(entry)
            }
            feed = nextFeed
            seen = nextSeen
            input = logs
            processed = logs.length
            return feed
        },
    }
}
