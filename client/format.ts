/**
 * 运行日志的展示 token：级别徽标、logger 名配色、时间格式。
 *
 * 控制台面板是固定深色（见 `./index.scss`），这里的颜色都按深底可读选。
 */
import type { Logger } from 'koishi'

export type LogLevel = Logger.Type

export const LEVEL_META: Record<LogLevel, { letter: string; color: string }> = {
    error: { letter: 'E', color: '#f14c4c' },
    warn: { letter: 'W', color: '#f5f543' },
    success: { letter: 'S', color: '#23d18b' },
    // INFO 青：终端日志的默认心智
    info: { letter: 'I', color: '#29b8db' },
    debug: { letter: 'D', color: '#a1a1aa' },
}

/** reggol `Logger.code` 的 c16 哈希用色表（koishi 同款），取 16 色集的亮色位。 */
const NAME_COLORS = [
    '#f14c4c',
    '#23d18b',
    '#f5f543',
    '#3b8eea',
    '#d670d6',
    '#29b8db',
]

/** logger 名配色：reggol `Logger.code` 的 c16 哈希原算法，同名恒同色。 */
export function nameColor(name: string): string {
    let hash = 0
    for (let i = 0; i < name.length; i++) {
        hash = (hash << 3) - hash + name.charCodeAt(i) + 13
        hash |= 0
    }
    return NAME_COLORS[Math.abs(hash) % NAME_COLORS.length]!
}

/** `yyyy-MM-dd HH:mm:ss`（日志行保留到秒，减少头部占用）。 */
export function formatTime(ts: number): string {
    const at = new Date(ts)
    const pad = (value: number, width = 2): string =>
        String(value).padStart(width, '0')
    return (
        `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())} ` +
        `${pad(at.getHours())}:${pad(at.getMinutes())}:${pad(at.getSeconds())}`
    )
}
